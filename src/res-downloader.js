(function() {
    'use strict';

    // ---------------- Small utils ----------------
    const debounce = (fn, d) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); }; };
    const raf = (fn) => new Promise(r => requestAnimationFrame(() => { try { fn(); } finally { r(); } }));
    const $ = (s, r = document) => r.querySelector(s);
    const isVideoPage = (p = location.pathname) => /^\/v[A-Za-z0-9]+(?:[\/\.-]|$)/.test(p);

    function sanitizeFilename(name) {
        return String(name).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
    }
    function getVideoTitle() {
        const og = $('meta[property="og:title"]')?.content?.trim();
        if (og) return og;
        const docTitle = document.title?.trim();
        if (docTitle) {
            const cleaned = docTitle.replace(/\s*[-–—]\s*Rumble\s*$/i, '').trim();
            if (cleaned) return cleaned;
        }
        const h1 = $('h1')?.textContent?.trim();
        if (h1) return h1;
        return 'video';
    }
    function filenameWithExt(title, label, urlOrExt) {
        const extMatch = /\.([a-z0-9]+)(?:$|\?)/i.exec(urlOrExt);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'ts';
        const base = sanitizeFilename(title);
        const res = label ? ` - ${label}` : '';
        return `${base}${res}.${ext}`;
    }
    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return 'N/A';
        const u = ['B', 'KB', 'MB', 'GB', 'TB'];
        let i = 0, n = bytes; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
        return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
    }
    function formatBitrate(bitrate) {
        if (!Number.isFinite(bitrate) || bitrate <= 0) return '';
        return `${Math.round(bitrate)} kbps`;
    }

    // ---------------- Metadata discovery (robust) ----------------
    const EMBEDJS_URL_RE = /https:\/\/rumble\.com\/embedJS\/[^\s"'<>]+(?:\?|&)[^"'<>]*\brequest=video\b[^"'<>]*\bv=[^"'\s<>&]+/i;

    function extractVCodeFromUrl(u) {
        if (!u) return null;
        const m1 = u.match(/[?&]v=([a-z0-9]+)/i);
        if (m1) return m1[1];
        const m2 = u.match(/\/embed\/([a-z0-9]+)/i);
        if (m2) return m2[1];
        return null;
    }
    function buildEmbedJsUrlFromV(vcode) {
        if (!vcode) return null;
        return `https://rumble.com/embedJS/u3/?request=video&ver=2&v=${encodeURIComponent(vcode)}&ifr=0&dref=rumble.com`;
    }

    function scanForEmbedJsUrlDirect() {
        // inline script content
        const scripts = document.querySelectorAll('script');
        for (const s of scripts) {
            const t = s.textContent || '';
            const m = t.match(EMBEDJS_URL_RE);
            if (m && m[0]) return m[0];
        }
        // whole DOM
        const m2 = document.documentElement.outerHTML.match(EMBEDJS_URL_RE);
        if (m2 && m2[0]) return m2[0];
        // iframe
        const iframe = document.querySelector('iframe[src*="embedJS"]');
        const src = iframe?.getAttribute('src') || iframe?.src;
        if (src && EMBEDJS_URL_RE.test(src)) return src;
        return null;
    }
    function tryDeriveEmbedJsUrlFromMeta() {
        const metas = [
            $('meta[property="og:video:url"]')?.content,
            $('meta[property="og:video"]')?.content,
            $('meta[name="twitter:player"]')?.content
        ].filter(Boolean);
        for (const u of metas) {
            const v = extractVCodeFromUrl(u);
            const built = buildEmbedJsUrlFromV(v);
            if (built) return built;
        }
        const ldBlocks = document.querySelectorAll('script[type="application/ld+json"]');
        for (const s of ldBlocks) {
            const t = s.textContent?.trim();
            if (!t) continue;
            const m = t.match(/"embedUrl"\s*:\s*"([^"]+)"/i);
            if (m && m[1]) {
                const v = extractVCodeFromUrl(m[1]);
                const built = buildEmbedJsUrlFromV(v);
                if (built) return built;
            }
            try {
                const obj = JSON.parse(t);
                const urls = [];
                if (Array.isArray(obj)) {
                    for (const it of obj) if (it && it.embedUrl) urls.push(it.embedUrl);
                } else if (obj && obj.embedUrl) urls.push(obj.embedUrl);
                for (const u2 of urls) {
                    const v = extractVCodeFromUrl(u2);
                    const built = buildEmbedJsUrlFromV(v);
                    if (built) return built;
                }
            } catch {}
        }
        const iframeEmbed = document.querySelector('iframe[src*="/embed/"]');
        const iSrc = iframeEmbed?.getAttribute('src') || iframeEmbed?.src;
        if (iSrc) {
            const v = extractVCodeFromUrl(iSrc);
            const built = buildEmbedJsUrlFromV(v);
            if (built) return built;
        }
        return null;
    }
    async function waitForMetadataUrl(maxMs = 20000) {
        const start = Date.now();
        let direct = scanForEmbedJsUrlDirect();
        if (direct) return direct;
        let derived = tryDeriveEmbedJsUrlFromMeta();
        if (derived) return derived;

        let resolver, rejecter;
        const doneP = new Promise((res, rej) => { resolver = res; rejecter = rej; });
        const observer = new MutationObserver(() => {
            direct = scanForEmbedJsUrlDirect();
            if (direct) { cleanup(); resolver(direct); return; }
            derived = tryDeriveEmbedJsUrlFromMeta();
            if (derived) { cleanup(); resolver(derived); return; }
            if (Date.now() - start >= maxMs) { cleanup(); rejecter(new Error('Timed out waiting for video data.')); }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        const poll = setInterval(() => {
            direct = scanForEmbedJsUrlDirect();
            if (direct) { cleanup(); resolver(direct); return; }
            derived = tryDeriveEmbedJsUrlFromMeta();
            if (derived) { cleanup(); resolver(derived); return; }
            if (Date.now() - start >= maxMs) { cleanup(); rejecter(new Error('Timed out waiting for video data.')); }
        }, 250);
        const hard = setTimeout(() => { cleanup(); rejecter(new Error('Timed out waiting for video data.')); }, maxMs + 500);
        function cleanup() { clearInterval(poll); clearTimeout(hard); observer.disconnect(); }
        return doneP;
    }

    async function fetchVideoMetadata(url) {
        if (!url) throw new Error("Video metadata URL could not be found on this page.");
        const referer = location.href;
        const data = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET', url,
                headers: { 'Accept': 'application/json, */*;q=0.1', 'Referer': referer },
                timeout: 30000,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 400) {
                        try { resolve(JSON.parse(res.responseText)); }
                        catch { reject(new Error("Failed to parse video metadata.")); }
                    } else reject(new Error(`Failed to fetch video metadata (HTTP ${res.status}).`));
                },
                onerror: () => reject(new Error('Network error while fetching metadata.')),
                ontimeout: () => reject(new Error('Metadata request timed out.')),
            });
        });
        return parseMetadata(data);
    }

    // ---------------- Parse metadata -> downloads ----------------
    function parseMetadata(data) {
        const downloads = [];
        const fps = data.fps || 0;

        function push({label, height, type, url, size, bitrate}) {
            if (!url) return;
            downloads.push({
                label: label || (height ? `${height}p` : 'Unknown'),
                height: Number.isFinite(height) ? height : 0,
                type,
                url,
                size: Number.isFinite(size) ? size : 0,
                bitrate: Number.isFinite(bitrate) ? bitrate : 0,
                fps: Number.isFinite(fps) ? fps : 0
            });
        }

        function collect(group) {
            if (!group) return;
            if (group.tar) {
                if (group.tar.url) {
                    const h = group.tar.meta?.h || 0;
                    push({label: `${h || 'tar'}`, height: h, type: 'tar', url: group.tar.url, size: group.tar.meta?.size, bitrate: group.tar.meta?.bitrate});
                } else {
                    for (const k of Object.keys(group.tar)) {
                        const it = group.tar[k];
                        if (it?.url) {
                            const h = it.meta?.h || parseInt(k, 10) || 0;
                            push({label: `${h}p`, height: h, type: 'tar', url: it.url, size: it.meta?.size, bitrate: it.meta?.bitrate});
                        }
                    }
                }
            }
            if (group.mp4) {
                for (const k of Object.keys(group.mp4)) {
                    const it = group.mp4[k];
                    if (it?.url) {
                        const h = it.meta?.h || parseInt(k, 10) || 0;
                        push({label: `${h}p`, height: h, type: 'mp4', url: it.url, size: it.meta?.size, bitrate: it.meta?.bitrate});
                    }
                }
            }
            if (group.audio) {
                for (const k of Object.keys(group.audio)) {
                    const it = group.audio[k];
                    if (it?.url) {
                        push({label: 'Audio', height: 0, type: 'aac', url: it.url, size: it.meta?.size, bitrate: it.meta?.bitrate});
                    }
                }
            }
            if (group.hls) {
                if (group.hls.url) push({label: 'HLS (auto)', height: 0, type: 'hls', url: group.hls.url, size: 0, bitrate: 0});
                if (group.hls.auto?.url) push({label: 'HLS (auto)', height: 0, type: 'hls', url: group.hls.auto.url, size: 0, bitrate: 0});
            }
        }

        collect(data.u);
        collect(data.ua);

        const typeRank = { mp4: 0, tar: 1, hls: 2, aac: 3 };
        downloads.sort((a, b) => {
            if (b.height !== a.height) return b.height - a.height;
            const ar = typeRank[a.type] ?? 99, br = typeRank[b.type] ?? 99;
            return ar - br;
        });

        // Do not dedupe by URL; dedupe by (label|type) keeping the largest size
        const best = new Map();
        for (const d of downloads) {
            const key = `${d.label.toLowerCase()}|${d.type}`;
            const prev = best.get(key);
            if (!prev || (d.size || 0) > (prev.size || 0)) best.set(key, d);
        }
        return Array.from(best.values());
    }

    // ---------------- TAR extractor + combiner (restored & hardened) ----------------
    const untar = (() => {
        function TarHeader(buffer, offset) { this._buffer = buffer; this._offset = offset || 0; }
        TarHeader.prototype = {
            get name() { return this._getString(0, 100); },
            get size() { return this._getOctal(124, 12); },
            get prefix() { return this._getString(345, 155); },
            _getString(offset, size) {
                const view = this._buffer.subarray(this._offset + offset, this._offset + offset + size);
                let str = new TextDecoder().decode(view);
                const nul = str.indexOf('\0');
                if (nul !== -1) str = str.substring(0, nul);
                return str;
            },
            _getOctal(offset, size) { return parseInt(this._getString(offset, size).trim(), 8) || 0; },
        };
        return async function untar(arrayBuffer) {
            const files = [];
            let offset = 0;
            const u8 = new Uint8Array(arrayBuffer);
            while (offset + 512 <= arrayBuffer.byteLength) {
                const header = new TarHeader(u8, offset);
                const name = header.name;
                if (!name) break;
                const dataSize = header.size;
                const dataOffset = offset + 512;
                files.push({ name: (header.prefix || '') + name, buffer: arrayBuffer.slice(dataOffset, dataOffset + dataSize) });
                const blocks = Math.ceil(dataSize / 512);
                offset += 512 + (blocks * 512);
            }
            return files;
        };
    })();

    async function processTarFile(url, btn, menuApi, title) {
        const original = btn.innerHTML;
        const setBtn = (text, disabled = true) => {
            btn.disabled = disabled;
            const label = btn.querySelector('span');
            if (label) label.textContent = text; else btn.textContent = text;
        };
        try {
            setBtn('Downloading...', true);
            await menuApi.setStatus(`Downloading TAR from ${url.substring(0, 60)}...`);
            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET', url, responseType: 'arraybuffer', timeout: 120000,
                    onprogress: (e) => {
                        if (e.lengthComputable) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            setBtn(`DL ${percent}%`, true);
                        }
                    },
                    onload: (res) => (res.status >= 200 && res.status < 400) ? resolve(res) : reject(new Error(`HTTP error: ${res.status}`)),
                    onerror: () => reject(new Error('Network error during TAR download.')),
                    ontimeout: () => reject(new Error('TAR download timed out.')),
                });
            });
            const tarBuffer = response.response;
            await menuApi.setStatus(`Download complete (${formatBytes(tarBuffer.byteLength)}). Extracting...`);
            setBtn('Extracting...', true);

            const extractedFiles = await untar(tarBuffer);
            // Find playlist
            const playlistFile = extractedFiles.find(f => f.name.toLowerCase().endsWith('.m3u8'));
            if (!playlistFile) throw new Error('No .m3u8 playlist found in TAR.');

            // Collect segments
            const tsFiles = new Map(extractedFiles.filter(f => f.name.toLowerCase().endsWith('.ts')).map(f => [f.name, f.buffer]));
            await menuApi.setStatus(`Found playlist and ${tsFiles.size} video segments. Combining...`);
            setBtn('Combining...', true);

            const playlistText = new TextDecoder().decode(playlistFile.buffer);
            const segmentNames = playlistText.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
            if (segmentNames.length === 0) throw new Error('Playlist is empty or invalid.');

            const orderedSegments = [];
            let totalSize = 0;
            for (const name of segmentNames) {
                // exact match or path-suffix match inside TAR
                let key = null;
                if (tsFiles.has(name)) key = name;
                else {
                    const found = Array.from(tsFiles.keys()).find(k => k.endsWith('/' + name));
                    if (found) key = found;
                }
                if (!key) throw new Error(`Missing segment in TAR: ${name}`);
                const buffer = tsFiles.get(key);
                const u8 = new Uint8Array(buffer);
                orderedSegments.push(u8);
                totalSize += u8.byteLength;
            }

            const combinedVideo = new Uint8Array(totalSize);
            let offset = 0;
            for (const seg of orderedSegments) { combinedVideo.set(seg, offset); offset += seg.length; }

            await menuApi.setStatus(`Combination complete. Final size: ${formatBytes(totalSize)}.`);
            const blob = new Blob([combinedVideo], { type: 'video/mp2t' });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filenameWithExt(title, 'combined', '.ts');
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            setBtn('Done!', true);
            setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 3000);
        } catch (e) {
            console.error("Rumble Downloader TAR Error:", e);
            await menuApi.setStatus(`Error: ${e.message}`);
            setBtn('Error!', true);
            btn.style.backgroundColor = '#b91c1c';
            setTimeout(() => { btn.innerHTML = original; btn.disabled = false; btn.style.backgroundColor = ''; }, 5000);
        }
    }

    // ---------------- UI (condensed + right placement) ----------------
    GM_addStyle(`
    :root {
      --rud-font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --rud-font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
      --rud-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    #rud-portal.rud-dark {
      --rud-bg-primary:#111827; --rud-bg-secondary:#1f2937; --rud-bg-tertiary:#374151;
      --rud-text-primary:#f9fafb; --rud-text-secondary:#d1d5db; --rud-text-muted:#9ca3af;
      --rud-border-color:#303846;
      --rud-accent:#22c55e; --rud-accent-hover:#16a34a; --rud-accent-text:#ffffff;
      --rud-shadow:0 6px 10px rgba(0,0,0,.18);
    }
    #rud-portal.rud-light {
      --rud-bg-primary:#ffffff; --rud-bg-secondary:#f8fafc; --rud-bg-tertiary:#e5e7eb;
      --rud-text-primary:#111827; --rud-text-secondary:#374151; --rud-text-muted:#6b7280;
      --rud-border-color:#e5e7eb;
      --rud-accent:#16a34a; --rud-accent-hover:#15803d; --rud-accent-text:#ffffff;
      --rud-shadow:0 6px 10px rgba(0,0,0,.08);
    }

    #rud-portal { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; font-family: var(--rud-font-sans); }
    .rud-inline-wrap { position: relative; display: inline-flex; }
    .media-by-channel-actions-container .rud-inline-wrap.rud-right { margin-left: auto; } /* push to far right */
    .media-by-channel-actions-container .rud-inline-wrap.rud-right #rud-download-btn { margin-left: 12px; } /* spacing from neighbor buttons */

    #rud-download-btn {
      position: relative; display: inline-flex; align-items: center; gap: .4rem; padding: .4rem .7rem;
      font-size: 13px; font-weight: 700; line-height: 1;
      background-image: linear-gradient(to top,#15803d,#16a34a);
      color:#fff; border:1px solid #16a34a; border-radius:8px; cursor:pointer;
      box-shadow:0 1px 2px rgba(0,0,0,0.1); transition:all .15s var(--rud-ease-out);
      pointer-events:auto;
    }
    #rud-download-btn:hover:not(:disabled){ transform:translateY(-1px); background-image:linear-gradient(to top,#16a34a,#22c55e); }
    #rud-download-btn:disabled{ opacity:.75; cursor:default; }
    #rud-download-btn .rud-btn-fill{ position:absolute; left:0; top:0; bottom:0; width:0%; background:rgba(255,255,255,.25); transition:width .15s; pointer-events:none; }
    #rud-download-btn svg{ width:16px; height:16px; }

    .rud-panel {
      position: fixed; left: 0; top: 0;
      width: 560px; max-width: 92vw;
      background: var(--rud-bg-primary); color: var(--rud-text-primary);
      border: 1px solid var(--rud-border-color); border-radius: 10px;
      box-shadow: var(--rud-shadow); overflow: hidden; display: none; pointer-events: auto;
      opacity: 0; transform: translateY(-8px) scale(.985);
      transition: opacity .15s var(--rud-ease-out), transform .15s var(--rud-ease-out);
    }
    .rud-panel.open { display:flex; flex-direction:column; opacity:1; transform:translateY(0) scale(1); }

    .rud-header { display:flex; align-items:center; padding:6px 8px; border-bottom:1px solid var(--rud-border-color); }
    .rud-status { flex:1; font-size:12px; color:var(--rud-text-muted); min-height: 14px; } /* slim and can be blank */
    .rud-header-controls { display:flex; gap:6px; }
    .rud-icon-btn { display:flex; padding:4px; background:none; border:none; border-radius:6px; cursor:pointer; color:var(--rud-text-muted); }
    .rud-icon-btn:hover{ background:var(--rud-bg-secondary); color:var(--rud-text-primary); }
    .rud-icon-btn svg{ width:16px; height:16px; }

    .rud-body{ max-height: 48vh; overflow-y:auto; }
    .rud-list{ display:flex; flex-direction:column; padding:6px; gap:4px; }
    .rud-item{
      display:grid; grid-template-columns: 58px 46px 1fr auto; align-items:center;
      gap:8px; padding:6px 8px; border-radius:8px; background:transparent;
      border:1px solid transparent;
    }
    .rud-item:hover{ background:var(--rud-bg-secondary); border-color:var(--rud-border-color); }
    .rud-item-res{ font-weight:800; font-size:13px; }
    .rud-item-badge{ font-size:10px; font-weight:700; padding:2px 6px; border-radius:999px; background:var(--rud-bg-tertiary); color:var(--rud-text-secondary); text-transform:uppercase; justify-self:start; }
    .rud-item-bitrate{ font-size:11px; color:var(--rud-text-muted); font-family:var(--rud-font-mono); white-space:nowrap; }
    .rud-item-size{ font-size:12px; color:var(--rud-text-secondary); font-family:var(--rud-font-mono); margin-right:8px; }
    .rud-item-actions{ display:flex; gap:6px; }
    .rud-item-actions a, .rud-item-actions button{
      display:inline-flex; align-items:center; justify-content:center; gap:6px; text-decoration:none;
      font-size:12px; font-weight:700; padding:5px 8px; border-radius:6px; transition:background .15s; border:1px solid var(--rud-border-color);
    }
    .rud-item-actions .rud-copy-btn{ background:var(--rud-bg-tertiary); color:var(--rud-text-secondary); }
    .rud-item-actions .rud-copy-btn:hover{ background:var(--rud-border-color); color:var(--rud-text-primary); }
    .rud-item-actions .rud-dl-link{ background:var(--rud-accent); color:var(--rud-accent-text); border-color:var(--rud-accent); }
    .rud-item-actions .rud-dl-link:hover{ background:var(--rud-accent-hover); }
    .rud-item-actions svg{ width:13px; height:13px; }

    .rud-footer{ padding:8px 10px; border-top:1px solid var(--rud-border-color); background:var(--rud-bg-secondary); }
    .rud-tar-note{ font-size:11px; color:var(--rud-text-muted); line-height:1.4; }

    .rud-empty{ padding:24px 16px; text-align:center; color:var(--rud-text-muted); font-size:13px; line-height:1.5; }
    .rud-empty svg{ width:36px; height:36px; margin-bottom:8px; opacity:.6; }

    [data-rud-tooltip]{ position:relative; }
    [data-rud-tooltip]::after{
      content: attr(data-rud-tooltip); position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%);
      background:#111827; color:#f9fafb; font-size:11px; font-weight:700; padding:3px 6px; border-radius:4px;
      white-space:nowrap; opacity:0; pointer-events:none; transition:opacity .15s, transform .15s;
    }
    [data-rud-tooltip]:hover::after{ opacity:1; transform:translateX(-50%) translateY(-2px); }

    #rud-comments-spacer{ width:100%; height:0px; transition: height .15s var(--rud-ease-out); }
    `);

    function ensurePortal() {
        let p = document.getElementById('rud-portal');
        if (!p) {
            p = document.createElement('div');
            p.id = 'rud-portal';
            document.documentElement.appendChild(p);
            p.className = localStorage.getItem('rud-theme') || 'rud-dark';
        }
        return p;
    }

    function createButton() {
        const btn = document.createElement('button');
        btn.id = 'rud-download-btn';
        btn.type = 'button';
        btn.innerHTML = `
      <div class="rud-btn-fill"></div>
      <span class="rud-btn-text">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0 0l4-4m-4 4L8 10M5 21h14" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        <span class="rud-btn-label">Download</span>
      </span>`;
        return btn;
    }
    function setButtonState(btn, text, disabled = false) {
        btn.disabled = disabled;
        const label = btn.querySelector('.rud-btn-label');
        if (label) label.textContent = text;
    }

    function ensureSpacerBeforeComments() {
        const comments = document.querySelector('.media-page-comments-container, #video-comments');
        if (!comments || !comments.parentElement) return null;
        let spacer = document.getElementById('rud-comments-spacer');
        if (!spacer) {
            spacer = document.createElement('div');
            spacer.id = 'rud-comments-spacer';
            comments.parentElement.insertBefore(spacer, comments);
        }
        return spacer;
    }

    function createMenu(btn) {
        const portal = ensurePortal();
        let menu = portal.querySelector('.rud-panel[data-for="' + btn.id + '"]');
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'rud-panel';
            menu.setAttribute('data-for', btn.id);
            menu.innerHTML = `
        <div class="rud-header">
          <div class="rud-status"></div>
          <div class="rud-header-controls">
            <button class="rud-icon-btn rud-theme-toggle" type="button" data-rud-tooltip="Theme">
              <svg class="rud-theme-sun" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              <svg class="rud-theme-moon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="display:none;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            </button>
            <button class="rud-icon-btn rud-close-btn" type="button" data-rud-tooltip="Close">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>
        <div class="rud-body">
            <div class="rud-list"></div>
            <div class="rud-empty" style="display:none;"></div>
        </div>
        <div class="rud-footer" style="display:none;">
            <div class="rud-tar-note">
              <strong>Tip:</strong> "Combine" merges the TAR playlist into a single .ts in-browser. Large files may exceed memory. Use raw TAR download if that happens.
            </div>
        </div>`;
            portal.appendChild(menu);

            const updateThemeIcons = () => {
                const isDark = portal.classList.contains('rud-dark');
                menu.querySelector('.rud-theme-sun').style.display = isDark ? 'none' : 'block';
                menu.querySelector('.rud-theme-moon').style.display = isDark ? 'block' : 'none';
            };
            menu.querySelector('.rud-close-btn').addEventListener('click', () => close(), { passive: true });
            menu.querySelector('.rud-theme-toggle').addEventListener('click', () => {
                const newTheme = portal.classList.contains('rud-dark') ? 'rud-light' : 'rud-dark';
                portal.className = newTheme;
                localStorage.setItem('rud-theme', newTheme);
                updateThemeIcons();
            }, { passive: true });
            updateThemeIcons();
        }

        const refs = () => ({
            statusEl: menu.querySelector('.rud-status'),
            listEl: menu.querySelector('.rud-list'),
            emptyEl: menu.querySelector('.rud-empty'),
            footerEl: menu.querySelector('.rud-footer')
        });

        async function positionMenu() {
            await raf(() => {
                const rect = btn.getBoundingClientRect();
                const w = menu.offsetWidth;
                const gap = 6;
                let left = Math.round(rect.left + (rect.width / 2) - (w / 2));
                left = Math.max(10, Math.min(left, window.innerWidth - 10 - w));
                const top = Math.round(rect.bottom + gap);
                menu.style.left = `${left}px`;
                menu.style.top = `${top}px`;
            });
        }
        async function adjustSpacer() {
            await raf(() => {
                const spacer = ensureSpacerBeforeComments();
                if (!spacer) return;
                if (!menu.classList.contains('open')) {
                    spacer.style.height = '0px';
                    return;
                }
                spacer.style.height = `${menu.offsetHeight + 12}px`;
            });
        }

        function onDocClick(e) {
            if (!menu.classList.contains('open')) return;
            if (!menu.contains(e.target) && !btn.contains(e.target)) close();
        }
        function onEsc(e) { if (e.key === 'Escape') close(); }
        document.addEventListener('click', onDocClick, true);
        document.addEventListener('keydown', onEsc, { passive: true });

        const reposition = debounce(() => { if (menu.classList.contains('open')) { positionMenu(); adjustSpacer(); } }, 60);
        window.addEventListener('scroll', reposition, { passive: true });
        window.addEventListener('resize', reposition, { passive: true });

        async function open() { if (!menu.classList.contains('open')) { menu.classList.add('open'); await positionMenu(); await adjustSpacer(); } }
        async function close() { if (menu.classList.contains('open')) { menu.classList.remove('open'); await adjustSpacer(); } }
        async function toggle() { if (menu.classList.contains('open')) await close(); else await open(); }

        async function setStatus(text) { refs().statusEl.textContent = text || ''; await positionMenu(); await adjustSpacer(); }
        async function setStatusMuted(text) { refs().statusEl.textContent = text || ''; await positionMenu(); await adjustSpacer(); }

        async function showEmpty(message) {
            const r = refs();
            r.listEl.innerHTML = '';
            r.listEl.style.display = 'none';
            r.emptyEl.style.display = 'block';
            r.emptyEl.innerHTML = `
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        ${message || 'No verified downloads were found.'}`;
            await positionMenu(); await adjustSpacer();
        }
        async function hideEmpty() { const r = refs(); r.listEl.style.display = 'flex'; r.emptyEl.style.display = 'none'; }

        async function maybeToggleFooter() {
            const r = refs();
            const hasTar = !!r.listEl.querySelector('[data-type="tar"]');
            r.footerEl.style.display = hasTar ? 'block' : 'none';
            await positionMenu(); await adjustSpacer();
        }

        // Dedup map: label|type -> node, tracking size to prefer larger file
        const byKey = new Map();

        function addOrUpdate(dl) {
            const { label, type, url, size, bitrate, fps } = dl;
            if (!label) return;
            const r = refs();
            const key = `${label.toLowerCase()}|${type}`;
            const title = getVideoTitle();
            const fname = filenameWithExt(title, label, url);
            const menuApi = this;

            const renderInto = (item) => {
                let actionButtonsHTML = '';
                if (type === 'tar') {
                    actionButtonsHTML = `
                      <button type="button" class="rud-combine-btn rud-dl-link" data-url="${url}" data-rud-tooltip="Combine to .ts">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h6m-6 4h6m-6 4h6"></path></svg>
                        <span>Combine</span>
                      </button>
                      <a href="${url}" target="_blank" rel="noopener" download="${fname}" class="rud-dl-link" data-rud-tooltip="Download .tar">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        <span>Tar</span>
                      </a>`;
                } else {
                    actionButtonsHTML = `
                      <a href="${url}" target="_blank" rel="noopener" download="${fname}" class="rud-dl-link" data-rud-tooltip="Download">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        <span>Get</span>
                      </a>`;
                }

                item.innerHTML = `
                  <div class="rud-item-res">${label}</div>
                  <div class="rud-item-badge">${type}</div>
                  <div class="rud-item-bitrate">${fps ? `${Math.round(fps)}fps · ` : ''}${formatBitrate(bitrate)}</div>
                  <div class="rud-item-actions">
                    <span class="rud-item-size">${formatBytes(size)}</span>
                    <button type="button" class="rud-copy-btn" data-url="${url}" data-rud-tooltip="Copy">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                      <span>Copy</span>
                    </button>
                    ${actionButtonsHTML}
                  </div>`;

                if (type === 'aac' || type === 'hls') {
                    const fpsBadge = item.querySelector('.rud-item-bitrate');
                    if (fpsBadge) fpsBadge.textContent = formatBitrate(bitrate);
                }

                item.dataset.type = type;

                item.querySelector('.rud-copy-btn')?.addEventListener('click', (e) => {
                    const b = e.currentTarget;
                    GM_setClipboard(b.dataset.url);
                    const t = b.dataset.rudTooltip;
                    b.dataset.rudTooltip = 'Copied!';
                    setTimeout(() => { b.dataset.rudTooltip = t; }, 1500);
                }, { passive: true });

                const combineBtn = item.querySelector('.rud-combine-btn');
                if (combineBtn) {
                    combineBtn.addEventListener('click', (e) => {
                        processTarFile(e.currentTarget.dataset.url, e.currentTarget, menuApi, title);
                    });
                }
            };

            // Dedupe by (label|type): keep the larger size; replace content/links if bigger arrives
            if (byKey.has(key)) {
                const existing = byKey.get(key);
                const oldSize = existing.size || 0;
                const newSize = size || 0;
                if (newSize > oldSize) {
                    // Replace in-place: update content while keeping position
                    renderInto(existing.node);
                    existing.size = size;
                    existing.url = url;
                }
                return;
            }

            const item = document.createElement('div');
            item.className = 'rud-item';
            renderInto(item);
            byKey.set(key, { node: item, url, size });

            // Insert in sorted order: by height desc, then mp4/tar preference (already pre-sorted before addOrUpdate in parse)
            r.listEl.appendChild(item);
            queueMicrotask(() => { maybeToggleFooter(); });
        }

        return {
            open, close, toggle,
            setStatus, setStatusMuted,
            clearLists: async () => { const r = refs(); byKey.clear(); r.listEl.innerHTML = ''; await hideEmpty(); await maybeToggleFooter(); },
            addOrUpdate, showEmpty, hideEmpty,
            haveAny: () => byKey.size > 0,
            ensureVisible: async () => { if (!menu.classList.contains('open')) await open(); },
            positionMenu, adjustSpacer
        };
    }

    // ---------------- Main click ----------------
    async function onDownloadClick(btn) {
        const menuApi = createMenu(btn);
        await menuApi.ensureVisible();
        await menuApi.setStatusMuted('Finding video info…');
        setButtonState(btn, 'Loading…', true);

        try {
            const metadataUrl = await waitForMetadataUrl(20000);
            const downloads = await fetchVideoMetadata(metadataUrl);
            await menuApi.clearLists();

            if (!downloads || downloads.length === 0) {
                await menuApi.showEmpty('No download links found in the video metadata.');
            } else {
                downloads.forEach(dl => menuApi.addOrUpdate(dl));
                // Do NOT print "Found N…" to save vertical space
                await menuApi.setStatus('');
            }

            setButtonState(btn, 'Download', false);
        } catch (e) {
            console.error("Rumble Downloader Error:", e);
            await menuApi.showEmpty(`An error occurred:<br>${e && (e.message || e)}`);
            setButtonState(btn, 'Error', true);
            setTimeout(() => setButtonState(btn, 'Download', false), 2500);
        }
    }

    // ---------------- Mount button (right side of the action bar) ----------------
    const ACTION_BAR_SELECTORS = [
        '.media-by-channel-actions-container', // primary target area (your provided container)
        '.media-header__actions',
        '.media-by__actions',
        'div[data-js="video_action_button_group"]'
    ];

    function mountButton() {
        if (!isVideoPage()) return;

        // Find target container
        let container = null;
        for (const sel of ACTION_BAR_SELECTORS) {
            const c = $(sel);
            if (c) { container = c; break; }
        }
        if (!container) return;

        // Get or create button once; reparent it if needed (prevents duplicates even with SPA changes)
        let btn = document.getElementById('rud-download-btn');
        if (!btn) {
            btn = createButton();
            btn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const menuApi = createMenu(btn);
                if (menuApi.haveAny() && !btn.disabled) {
                    await menuApi.toggle();
                } else {
                    onDownloadClick(btn);
                }
            }, { passive: false });
        }

        // Wrap and append on the right
        const wrap = document.createElement('span');
        wrap.className = 'rud-inline-wrap rud-right';
        wrap.appendChild(btn);
        container.appendChild(wrap); // append -> bottom right side of the bar; margin-left:auto pushes it right

        // Clean up any empty stale wrappers created by SPA reflows
        document.querySelectorAll('.rud-inline-wrap').forEach(w => { if (!w.firstElementChild) w.remove(); });
    }

    const routeObs = new MutationObserver(debounce(() => { mountButton(); }, 200));
    routeObs.observe(document.documentElement, { childList: true, subtree: true });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountButton, { passive: true });
    } else {
        mountButton();
    }
})();
