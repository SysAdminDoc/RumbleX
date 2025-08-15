// This is the content for res-downloader.js
// It's an IIFE (Immediately Invoked Function Expression) to keep its scope private.
(function() {
    'use strict';

    // --- [EMBEDDED LIBRARY] js-tar (for TAR extraction) ---
    const untar = (() => {
        function TarHeader(buffer, offset) {
            this._buffer = buffer;
            this._offset = offset || 0;
        }
        TarHeader.prototype = {
            get name() { return this._getString(0, 100); },
            get size() { return this._getOctal(124, 12); },
            get prefix() { return this._getString(345, 155); },
            _getString: function (offset, size) {
                let str = new TextDecoder().decode(this._buffer.subarray(this._offset + offset, this._offset + offset + size));
                return str.substring(0, str.indexOf('\0'));
            },
            _getOctal: function (offset, size) {
                return parseInt(this._getString(offset, size), 8) || 0;
            },
        };
        return async function untar(arrayBuffer) {
            const files = [];
            let offset = 0;
            while (offset < arrayBuffer.byteLength - 512) {
                const header = new TarHeader(new Uint8Array(arrayBuffer), offset);
                if (header.name === '') break;
                const dataSize = header.size;
                const dataOffset = offset + 512;
                files.push({
                    name: header.prefix + header.name,
                    buffer: arrayBuffer.slice(dataOffset, dataOffset + dataSize),
                });
                offset += 512 + (Math.ceil(dataSize / 512) * 512);
            }
            return files;
        };
    })();

    // --- TAR Processing Function ---
    async function processTarFile(url, btn, menuApi, title) {
        const originalButtonContent = btn.innerHTML;
        const setButtonState = (text, disabled = true) => {
            btn.disabled = disabled;
            const label = btn.querySelector('span');
            if (label) label.textContent = text;
            else btn.textContent = text;
        };

        try {
            setButtonState('Downloading...', true);
            await menuApi.setStatus(`Downloading TAR from ${url.substring(0, 60)}...`);

            const response = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET', url, responseType: 'arraybuffer',
                    onprogress: (e) => {
                        if (e.lengthComputable) {
                            const percent = Math.round((e.loaded / e.total) * 100);
                            setButtonState(`DL ${percent}%`, true);
                        }
                    },
                    onload: (res) => (res.status >= 200 && res.status < 400) ? resolve(res) : reject(new Error(`HTTP error: ${res.status}`)),
                    onerror: () => reject(new Error('Network error during TAR download.')),
                    ontimeout: () => reject(new Error('TAR download timed out.')),
                });
            });

            const tarBuffer = response.response;
            await menuApi.setStatus(`Download complete (${formatBytes(tarBuffer.byteLength)}). Extracting...`);
            setButtonState('Extracting...', true);

            const extractedFiles = await untar(tarBuffer);
            const playlistFile = extractedFiles.find(f => f.name.endsWith('.m3u8'));
            if (!playlistFile) throw new Error('No .m3u8 playlist found in TAR.');

            const tsFiles = new Map(extractedFiles.filter(f => f.name.endsWith('.ts')).map(f => [f.name, f.buffer]));
            await menuApi.setStatus(`Found playlist and ${tsFiles.size} video segments. Combining...`);
            setButtonState('Combining...', true);

            const playlistText = new TextDecoder().decode(playlistFile.buffer);
            const segmentNames = playlistText.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
            if (segmentNames.length === 0) throw new Error('Playlist is empty or invalid.');

            const orderedSegments = [];
            let totalSize = 0;
            for (const name of segmentNames) {
                if (tsFiles.has(name)) {
                    const buffer = tsFiles.get(name);
                    orderedSegments.push(new Uint8Array(buffer));
                    totalSize += buffer.byteLength;
                }
            }

            const combinedVideo = new Uint8Array(totalSize);
            let currentOffset = 0;
            for (const segment of orderedSegments) {
                combinedVideo.set(segment, currentOffset);
                currentOffset += segment.length;
            }

            await menuApi.setStatus(`Combination complete. Final size: ${formatBytes(totalSize)}.`);
            const blob = new Blob([combinedVideo], { type: 'video/mp2t' });
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filenameWithExt(title, 'combined', '.ts');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            setButtonState('Done!', true);
            setTimeout(() => {
                btn.innerHTML = originalButtonContent;
                btn.disabled = false;
            }, 3000);

        } catch (e) {
            console.error("Rumble Downloader TAR Error:", e);
            await menuApi.setStatus(`Error: ${e.message}`);
            setButtonState('Error!', true);
            btn.style.backgroundColor = '#b91c1c';
            setTimeout(() => {
                btn.innerHTML = originalButtonContent;
                btn.disabled = false;
                btn.style.backgroundColor = '';
            }, 5000);
        }
    }


    // ---------------- Config ----------------
    const ACTION_BAR_SELECTORS = [
        '.media-by-channel-actions-container',
        '.media-header__actions',
        '.media-by__actions',
        'div[data-js="video_action_button_group"]'
    ];

    // ---------------- Small utils ----------------
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    function debounce(fn, d) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); }; }
    function raf(fn) { return new Promise(r => requestAnimationFrame(() => { try { fn(); } finally { r(); } })); }
    function $(s, r = document) { return r.querySelector(s); }
    function $all(s, r = document) { return Array.from(r.querySelectorAll(s)); }
    function isVideoPage(p = location.pathname) { return /^\/v[A-Za-z0-9]+(?:[\/\.-]|$)/.test(p); }

    function getVideoIdFromString(str) {
        if (!str) return null;
        // Updated regex to better capture the video ID from various URL formats
        const m = str.match(/(?:\/v|\/embed\/|\?v=)([a-zA-Z0-9]{5,})/);
        return m ? m[1] : null;
    }
    function getVideoId() {
        let id = getVideoIdFromString(location.pathname + location.search);
        if (id) return id;
        const canonical = $('link[rel="canonical"]')?.href;
        if (canonical) { id = getVideoIdFromString(canonical); if (id) return id; }
        const og = $('meta[property="og:url"]')?.content || $('meta[property="og:video:url"]')?.content;
        if (og) { id = getVideoIdFromString(og); if (id) return id; }
        // Fallback for player elements
        const playerSrc = $('iframe[src*="rumble.com/embed/"]')?.src;
        if(playerSrc) { id = getVideoIdFromString(playerSrc); if (id) return id; }
        return null;
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
    function sanitizeFilename(name) {
        return String(name)
            .replace(/[\\/:*?"<>|]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 180);
    }
    function filenameWithExt(title, label, url) {
        const extMatch = /\.([a-z0-9]+)(?:$|\?)/i.exec(url);
        // Default to mp4 if no extension found, common for blobs
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

    // ---------------- NEW: Direct API Fetch & Parse ----------------
    async function fetchVideoMetadata(videoId) {
        if (!videoId) {
            throw new Error("Video ID could not be found.");
        }
        const url = `https://rumble.com/embedJS/u3/?request=video&v=${videoId}`;
        
        const response = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 15000,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 400) {
                        try {
                            resolve(JSON.parse(res.responseText));
                        } catch (e) {
                            reject(new Error("Failed to parse video metadata."));
                        }
                    } else {
                        reject(new Error(`Failed to fetch video metadata (HTTP ${res.status}).`));
                    }
                },
                onerror: () => reject(new Error('Network error while fetching metadata.')),
                ontimeout: () => reject(new Error('Metadata request timed out.')),
            });
        });

        return parseMetadata(response);
    }

    function parseMetadata(data) {
        const downloads = [];
        const fps = data.fps || 0;

        if (!data.ua) {
            return [];
        }

        // Process video streams (tar, mp4)
        for (const type of ['tar', 'mp4']) {
            if (data.ua[type]) {
                for (const key in data.ua[type]) {
                    const item = data.ua[type][key];
                    if (item.url && item.meta) {
                        downloads.push({
                            label: `${item.meta.h}p` || `${key}p`,
                            height: item.meta.h || 0,
                            type: type,
                            url: item.url,
                            size: item.meta.size,
                            bitrate: item.meta.bitrate,
                            fps: fps,
                        });
                    }
                }
            }
        }
        
        // Process audio-only stream
        if (data.ua.audio) {
            for (const key in data.ua.audio) {
                 const item = data.ua.audio[key];
                 if (item.url && item.meta) {
                    downloads.push({
                        label: `Audio`,
                        height: 0, // Special value for sorting
                        type: 'aac',
                        url: item.url,
                        size: item.meta.size,
                        bitrate: item.meta.bitrate,
                        fps: 0,
                    });
                 }
            }
        }

        // Sort by height (desc), then by type (mp4 first)
        downloads.sort((a, b) => {
            if (b.height !== a.height) {
                return b.height - a.height;
            }
            return a.type.localeCompare(b.type);
        });

        return downloads;
    }


    // ---------------- UI (Premium Redesign) ----------------
    GM_addStyle(`
    :root {
      --rud-font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --rud-font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      --rud-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    #rud-portal.rud-dark {
      --rud-bg-primary: #111827; --rud-bg-secondary: #1f2937; --rud-bg-tertiary: #374151;
      --rud-text-primary: #f9fafb; --rud-text-secondary: #d1d5db; --rud-text-muted: #9ca3af;
      --rud-border-color: #374151;
      --rud-accent: #22c55e; --rud-accent-hover: #16a34a; --rud-accent-text: #ffffff;
      --rud-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
      --rud-backdrop-blur: blur(8px);
    }
    #rud-portal.rud-light {
      --rud-bg-primary: #ffffff; --rud-bg-secondary: #f3f4f6; --rud-bg-tertiary: #e5e7eb;
      --rud-text-primary: #111827; --rud-text-secondary: #374151; --rud-text-muted: #6b7280;
      --rud-border-color: #e5e7eb;
      --rud-accent: #16a34a; --rud-accent-hover: #15803d; --rud-accent-text: #ffffff;
      --rud-shadow: 0 10px 15px -3px rgba(0,0,0,0.07), 0 4px 6px -2px rgba(0,0,0,0.04);
      --rud-backdrop-blur: blur(8px);
    }

    #rud-portal { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; font-family: var(--rud-font-sans); }
    .rud-inline-wrap { position: relative; display: inline-block; }

    #rud-download-btn {
      position: relative; display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;
      font-size: 14px; font-weight: 600; line-height: 1; letter-spacing: 0.02em;
      background-image: linear-gradient(to top, #15803d, #16a34a);
      color: #fff; border: 1px solid #16a34a; border-radius: 8px;
      cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1);
      transition: all .2s var(--rud-ease-out); overflow: hidden;
    }
    #rud-download-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1); background-image: linear-gradient(to top, #16a34a, #22c55e); }
    #rud-download-btn:active:not(:disabled) { transform: translateY(0px); }
    #rud-download-btn:disabled { opacity: .7; cursor: default; }
    #rud-download-btn .rud-btn-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; background: rgba(255,255,255,0.2); transition: width .2s var(--rud-ease-out); pointer-events:none; }
    #rud-download-btn .rud-btn-text { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 0.5rem; }

    .rud-panel {
      position: fixed; left: 0; top: 0; /* JS positioned */
      width: 640px; max-width: 95vw;
      background: var(--rud-bg-primary); color: var(--rud-text-primary);
      border: 1px solid var(--rud-border-color); border-radius: 12px;
      box-shadow: var(--rud-shadow); overflow: hidden; display: none;
      pointer-events: auto;
      backdrop-filter: var(--rud-backdrop-blur);
      -webkit-backdrop-filter: var(--rud-backdrop-blur);
      opacity: 0; transform: translateY(-10px) scale(0.98);
      transition: opacity 0.2s var(--rud-ease-out), transform 0.2s var(--rud-ease-out);
    }
    .rud-panel.open { display: flex; flex-direction: column; opacity: 1; transform: translateY(0) scale(1); }

    .rud-header { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--rud-border-color); }
    .rud-status { flex-grow: 1; font-size: 14px; color: var(--rud-text-secondary); }
    .rud-status .muted { color: var(--rud-text-muted); }
    .rud-header-controls { display: flex; align-items: center; gap: 8px; }
    .rud-icon-btn { display: flex; padding: 4px; background: none; border: none; border-radius: 6px; cursor: pointer; color: var(--rud-text-muted); transition: background .2s, color .2s; }
    .rud-icon-btn:hover { background: var(--rud-bg-secondary); color: var(--rud-text-primary); }
    .rud-icon-btn svg { width: 18px; height: 18px; }

    .rud-body { max-height: 60vh; overflow-y: auto; }
    .rud-list { display: flex; flex-direction: column; padding: 8px; }
    .rud-item { display: grid; grid-template-columns: 80px 60px 60px 1fr auto; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; transition: background .2s; }
    .rud-item + .rud-item { margin-top: 4px; }
    .rud-item:hover { background: var(--rud-bg-secondary); }
    .rud-item-res { font-weight: 700; font-size: 15px; color: var(--rud-text-primary); }
    .rud-item-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; background: var(--rud-bg-tertiary); color: var(--rud-text-secondary); text-transform: uppercase; text-align: center;}
    .rud-item-bitrate { font-size: 13px; color: var(--rud-text-muted); font-family: var(--rud-font-mono); white-space: nowrap; }
    .rud-item-size { font-size: 14px; color: var(--rud-text-secondary); font-family: var(--rud-font-mono); margin-left: auto; text-align: right; }
    .rud-item-actions { display: flex; gap: 8px; }
    .rud-item-actions a, .rud-item-actions button { display: flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 6px; transition: all .2s; }
    .rud-item-actions .rud-copy-btn { background: var(--rud-bg-tertiary); color: var(--rud-text-secondary); border: 1px solid var(--rud-border-color); cursor: pointer; }
    .rud-item-actions .rud-copy-btn:hover { background: var(--rud-border-color); color: var(--rud-text-primary); }
    .rud-item-actions .rud-dl-link { background: var(--rud-accent); color: var(--rud-accent-text); border: 1px solid var(--rud-accent); }
    .rud-item-actions .rud-dl-link:hover { background: var(--rud-accent-hover); }
    .rud-item-actions svg { width: 14px; height: 14px; }

    .rud-footer { padding: 12px 16px; border-top: 1px solid var(--rud-border-color); background: var(--rud-bg-secondary); }
    .rud-tar-note { font-size: 12px; color: var(--rud-text-muted); line-height: 1.5; }
    .rud-tar-note strong { color: var(--rud-text-secondary); }
    .rud-tar-note .rud-disclaimer { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--rud-border-color); }
    .rud-tar-note .rud-disclaimer svg { vertical-align: middle; margin-right: 4px; width: 14px; height: 14px; }

    .rud-empty { padding: 48px 24px; text-align: center; color: var(--rud-text-muted); font-size: 14px; line-height: 1.6; }
    .rud-empty svg { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5; }

    [data-rud-tooltip] { position: relative; }
    [data-rud-tooltip]::after {
      content: attr(data-rud-tooltip); position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
      background: #111827; color: #f9fafb; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 4px;
      white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;
    }
    [data-rud-tooltip]:hover::after { opacity: 1; transform: translateX(-50%) translateY(-2px); }

    #rud-comments-spacer { width: 100%; height: 0px; transition: height 0.2s var(--rud-ease-out); }
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0 0l4-4m-4 4L8 10M5 21h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        <span class="rud-btn-label">Download</span>
      </span>`;
        return btn;
    }

    function setButtonState(btn, text, disabled = false) {
        btn.disabled = disabled;
        const label = btn.querySelector('.rud-btn-label');
        if (label) label.textContent = text;
    }

    function getCommentsEl() {
        return document.querySelector('.media-page-comments-container, #video-comments');
    }

    function ensureSpacerBeforeComments() {
        const comments = getCommentsEl();
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
          <div class="rud-status"><span class="muted">Ready.</span></div>
          <div class="rud-header-controls">
            <button class="rud-icon-btn rud-theme-toggle" type="button" data-rud-tooltip="Toggle Theme">
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
                <div><strong>How to Play TAR files:</strong> 1. Download & Extract the .tar file (e.g., with 7-Zip). 2. Drag the <strong>.m3u8</strong> file into a player like VLC.</div>
                <div class="rud-disclaimer">
                  The 
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h6m-6 4h6m-6 4h6"></path></svg>
                  <strong>Combine</strong> button processes the file in your browser. This is convenient but may fail on files larger than ~2GB due to memory limits. Use the 
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  <strong>Download</strong> button for larger files.
                </div>
            </div>
        </div>`;
            portal.appendChild(menu);

            menu.querySelector('.rud-close-btn').addEventListener('click', () => close());
            menu.querySelector('.rud-theme-toggle').addEventListener('click', () => {
                const newTheme = portal.classList.contains('rud-dark') ? 'rud-light' : 'rud-dark';
                portal.className = newTheme;
                localStorage.setItem('rud-theme', newTheme);
                updateThemeIcons();
            });

            const updateThemeIcons = () => {
                const isDark = portal.classList.contains('rud-dark');
                menu.querySelector('.rud-theme-sun').style.display = isDark ? 'none' : 'block';
                menu.querySelector('.rud-theme-moon').style.display = isDark ? 'block' : 'none';
            };
            updateThemeIcons();
        }

        const refs = () => ({
            statusEl: menu.querySelector('.rud-status'),
            listEl: menu.querySelector('.rud-list'),
            bodyEl: menu.querySelector('.rud-body'),
            emptyEl: menu.querySelector('.rud-empty'),
            footerEl: menu.querySelector('.rud-footer')
        });

        async function positionMenu() {
            await raf(() => {
                const rect = btn.getBoundingClientRect();
                const w = menu.offsetWidth;
                const gap = 8;
                let left = Math.round(rect.left + (rect.width / 2) - (w / 2));
                left = Math.max(16, Math.min(left, window.innerWidth - 16 - w));
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
                spacer.style.height = `${menu.offsetHeight + 16}px`;
            });
        }

        function onDocClick(e) {
            if (!menu.classList.contains('open')) return;
            if (!menu.contains(e.target) && !btn.contains(e.target)) close();
        }
        function onEsc(e) { if (e.key === 'Escape') close(); }
        document.addEventListener('click', onDocClick, true);
        document.addEventListener('keydown', onEsc, { passive: true });

        const reposition = debounce(() => { if (menu.classList.contains('open')) { positionMenu(); adjustSpacer(); } }, 50);
        window.addEventListener('scroll', reposition, { passive: true });
        window.addEventListener('resize', reposition, { passive: true });

        async function open() {
            if (!menu.classList.contains('open')) {
                menu.classList.add('open');
                await positionMenu();
                await adjustSpacer();
            }
        }
        async function close() {
            if (menu.classList.contains('open')) {
                menu.classList.remove('open');
                await adjustSpacer();
            }
        }
        async function toggle() {
            if (menu.classList.contains('open')) await close();
            else await open();
        }

        async function setStatus(text) { refs().statusEl.textContent = text; await positionMenu(); await adjustSpacer(); }
        async function setStatusMuted(text) {
            refs().statusEl.innerHTML = `<span class="muted">${String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</span>`;
            await positionMenu(); await adjustSpacer();
        }
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

        const byKey = new Map();
        function addOrUpdate(dl) {
            const { label, type, url, size, bitrate, fps } = dl;
            if (!label) return;
            const r = refs();
            const key = `${label.toLowerCase()}|${type}`;
            const title = getVideoTitle();
            const fname = filenameWithExt(title, label, url);
            const menuApi = this;

            if (byKey.has(key)) { return; }

            const item = document.createElement('div');
            item.className = 'rud-item';
            item.dataset.type = type;

            let actionButtonsHTML = '';

            if (type === 'tar') {
                actionButtonsHTML = `
                    <button type="button" class="rud-combine-btn rud-dl-link" data-url="${url}" data-rud-tooltip="Extract & download as .ts file">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h6m-6 4h6m-6 4h6"></path></svg>
                        <span>Combine</span>
                    </button>
                    <a href="${url}" target="_blank" rel="noopener" download="${fname}" class="rud-dl-link" data-rud-tooltip="Download .tar Archive">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    </a>
                `;
            } else { // For MP4s and AAC
                actionButtonsHTML = `
                    <a href="${url}" target="_blank" rel="noopener" download="${fname}" class="rud-dl-link" data-rud-tooltip="Download File">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    </a>`;
            }

            item.innerHTML = `
                <div class="rud-item-res">${label}</div>
                <div class="rud-item-badge">${type}</div>
                <div class="rud-item-badge">${Math.round(fps)} FPS</div>
                <div class="rud-item-bitrate">${formatBitrate(bitrate)}</div>
                <div class="rud-item-actions">
                    <span class="rud-item-size">${formatBytes(size)}</span>
                    <button type="button" class="rud-copy-btn" data-url="${url}" data-rud-tooltip="Copy Link">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                    ${actionButtonsHTML}
                </div>`;
            
            // Hide FPS badge for audio
            if (type === 'aac') {
                const fpsBadge = item.querySelector('.rud-item-badge:nth-of-type(2)');
                if (fpsBadge) fpsBadge.style.display = 'none';
            }
            
            item.querySelector('.rud-copy-btn').addEventListener('click', (e) => {
                const btn = e.currentTarget;
                GM_setClipboard(btn.dataset.url);
                const originalTooltip = btn.dataset.rudTooltip;
                btn.dataset.rudTooltip = 'Copied!';
                setTimeout(() => { btn.dataset.rudTooltip = originalTooltip; }, 2000);
            });
            
            const combineBtn = item.querySelector('.rud-combine-btn');
            if (combineBtn) {
                combineBtn.addEventListener('click', (e) => {
                    processTarFile(e.currentTarget.dataset.url, e.currentTarget, menuApi, title);
                });
            }

            byKey.set(key, { node: item, url, size });
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
        
        // If the menu is already open with items, just toggle it
        if (menuApi.haveAny() && menu.classList.contains('open')) {
            menuApi.close();
            return;
        }

        await menuApi.ensureVisible();
        await menuApi.setStatusMuted('Fetching video info...');
        setButtonState(btn, 'Loading...', true);

        try {
            const videoId = getVideoId();
            if (!videoId) {
                throw new Error("Could not find Video ID on this page.");
            }
            
            const downloads = await fetchVideoMetadata(videoId);
            await menuApi.clearLists();
            
            if (!downloads || downloads.length === 0) {
                await menuApi.showEmpty('No download links found in the video metadata.');
            } else {
                downloads.forEach(dl => menuApi.addOrUpdate(dl));
                await menuApi.setStatus(`Found ${downloads.length} download option(s).`);
            }
            
            setButtonState(btn, 'Download', false);

        } catch (e) {
            console.error("Rumble Downloader Error:", e);
            await menuApi.showEmpty(`An error occurred:<br>${e && (e.message || e)}`);
            setButtonState(btn, 'Error', true);
            setTimeout(() => setButtonState(btn, 'Download', false), 3000);
        }
    }

    // ---------------- Mount button ----------------
    function mountButton() {
        if (!isVideoPage() || document.getElementById('rud-download-btn')) return;
        for (const sel of ACTION_BAR_SELECTORS) {
            const container = $(sel);
            if (container) {
                const btn = createButton();
                const menuApi = createMenu(btn); // Create menu instance early
                
                btn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    // If the menu has items, just toggle it. Otherwise, fetch data.
                    if (menuApi.haveAny()) {
                        menuApi.toggle();
                    } else {
                        onDownloadClick(btn);
                    }
                });
                
                const wrap = document.createElement('span');
                wrap.className = 'rud-inline-wrap';
                // Prepend to be one of the first action buttons
                container.prepend(wrap);
                wrap.appendChild(btn);
                return; // Mount only once
            }
        }
    }

    const routeObs = new MutationObserver(debounce(() => { mountButton(); }, 200));
    routeObs.observe(document.documentElement, { childList: true, subtree: true });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountButton, { passive: true });
    } else {
        mountButton();
    }

})();