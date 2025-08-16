(function () {
  'use strict';

  // ---------------- Small utils ----------------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  function debounce(fn, d) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); }; }
  function raf(fn) { return new Promise(r => requestAnimationFrame(() => { try { fn(); } finally { r(); } })); }
  function $(s, r = document) { return r.querySelector(s); }
  function $all(s, r = document) { return Array.from(r.querySelectorAll(s)); }
  function isVideoPage(p = location.pathname) { return /^\/v[A-Za-z0-9]+(?:[\/\.-]|$)/.test(p); }

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
    const ext = extMatch ? extMatch[1].toLowerCase() : (typeof urlOrExt === 'string' && urlOrExt.startsWith('.') ? urlOrExt.slice(1) : 'mp4');
    const base = sanitizeFilename(title);
    const res = label ? ` - ${label}` : '';
    return `${base}${res}.${ext}`;
  }
  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, n = bytes; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n >= 10 ? 0 : 1)} ${u[i]}`;
  }
  const safeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------- Simple per-video cache ----------------
  const CACHE_NS = 'rud_cache_v1';
  function getVideoIdFromString(str) {
    if (!str) return null;
    const m = str.match(/\/v([A-Za-z0-9]+)(?:[\/\.-]|$)/);
    return m ? m[1] : null;
  }
  function getVideoId() {
    let id = getVideoIdFromString(location.pathname);
    if (id) return id;
    const canonical = $('link[rel="canonical"]')?.href;
    if (canonical) { id = getVideoIdFromString(canonical); if (id) return id; }
    const og = $('meta[property="og:url"]')?.content || $('meta[property="og:video:url"]')?.content;
    if (og) { id = getVideoIdFromString(og); if (id) return id; }
    return null;
  }
  function getCacheKey() {
    const vid = getVideoId();
    return vid ? `${CACHE_NS}:${vid}` : `${CACHE_NS}:path:${location.pathname}`;
  }
  function loadCachedList() {
    try {
      const raw = localStorage.getItem(getCacheKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items) || !parsed.items.length) return null;
      return parsed.items;
    } catch { return null; }
  }
  function saveCachedList(items) {
    try {
      if (!Array.isArray(items) || !items.length) return;
      const payload = { savedAt: Date.now(), items };
      localStorage.setItem(getCacheKey(), JSON.stringify(payload));
    } catch { /* ignore */ }
  }
  function clearCacheForPage() {
    try { localStorage.removeItem(getCacheKey()); } catch { }
  }

  // ---------------- Embedded js-tar (very small) ----------------
  const untar = (() => {
    function TarHeader(buffer, offset) { this._buffer = buffer; this._offset = offset || 0; }
    TarHeader.prototype = {
      get name() { return this._getString(0, 100); },
      get size() { return this._getOctal(124, 12); },
      get prefix() { return this._getString(345, 155); },
      _getString(offset, size) {
        const view = this._buffer.subarray(this._offset + offset, this._offset + offset + size);
        let str = new TextDecoder().decode(view);
        const i = str.indexOf('\0'); if (i >= 0) str = str.substring(0, i);
        return str;
      },
      _getOctal(offset, size) { return parseInt(this._getString(offset, size), 8) || 0; },
    };
    return async function untar(arrayBuffer) {
      const files = [];
      let offset = 0;
      const u8 = new Uint8Array(arrayBuffer);
      while (offset + 512 <= u8.byteLength) {
        const hdr = new TarHeader(u8, offset);
        const name = hdr.name;
        if (!name) break;
        const dataSize = hdr.size;
        const dataOffset = offset + 512;
        files.push({ name: (hdr.prefix || '') + name, buffer: arrayBuffer.slice(dataOffset, dataOffset + dataSize) });
        offset += 512 + (Math.ceil(dataSize / 512) * 512);
      }
      return files;
    };
  })();

  // ---------------- Playlist helpers (gzip + best match) ----------------
  async function maybeGunzip(buf) {
    const u8 = new Uint8Array(buf);
    const gz = u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b;
    if (!gz) return buf;
    if (typeof DecompressionStream === 'function') {
      const ds = new DecompressionStream('gzip');
      const out = await new Response(new Blob([buf]).stream().pipeThrough(ds)).arrayBuffer();
      return out;
    }
    throw new Error('Playlist is gzip-compressed, but this browser lacks gzip support.');
  }
  async function readTextMaybeGzip(file) {
    try {
      const ab = await maybeGunzip(file.buffer);
      return new TextDecoder().decode(ab);
    } catch {
      return '';
    }
  }
  async function findPlaylistsInTar(files) {
    const out = [];
    const byName = files.filter(f => /\.(?:m3u8|m3u)(?:\.gz)?$/i.test(f.name));
    for (const f of byName) {
      const t = await readTextMaybeGzip(f);
      if (/#EXTM3U/.test(t)) out.push({ file: f, text: t });
    }
    if (!out.length) {
      for (const f of files) {
        if (f.buffer.byteLength > 512 * 1024) continue;
        const t = await readTextMaybeGzip(f);
        if (/#EXTM3U/.test(t)) out.push({ file: f, text: t });
      }
    }
    return out;
  }

  // ---------------- TAR download + combine to .ts ----------------
  async function processTarFile(url, btn, menuApi, title) {
    const original = btn.innerHTML;
    const setBtn = (text, disabled = true) => {
      btn.disabled = disabled;
      const label = btn.querySelector('span, .rud-btn-label');
      if (label) label.textContent = text; else btn.textContent = text;
    };
    try {
      setBtn('Downloading…', true);
      await menuApi.setStatusMuted(`Downloading TAR…`);
      const response = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET', url, responseType: 'arraybuffer', timeout: 180000,
          onprogress: (e) => {
            if (e.lengthComputable) {
              const pct = Math.max(1, Math.round((e.loaded / e.total) * 100));
              setBtn(`DL ${pct}%`, true);
            }
          },
          onload: (res) => (res.status >= 200 && res.status < 400) ? resolve(res) : reject(new Error(`HTTP ${res.status}`)),
          onerror: () => reject(new Error('Network error during TAR download.')),
          ontimeout: () => reject(new Error('TAR download timed out.')),
        });
      });

      const tarBuffer = response.response;
      await menuApi.setStatusMuted(`Extracting TAR (${formatBytes(tarBuffer.byteLength)})…`);
      setBtn('Extracting…', true);

      // 2 GB soft-guard: browser memory often struggles beyond this
      const twoGB = 2 * 1024 * 1024 * 1024;
      if (tarBuffer.byteLength >= twoGB) {
        await menuApi.setStatusMuted(`Warning: ${formatBytes(tarBuffer.byteLength)}. Browser-side Combine often fails around ~2 GB.`);
      }

      const extracted = await untar(tarBuffer);

      // Map for segments
      const segmentFileMap = new Map(
        extracted
          .filter(f => /\.(ts|m4s)$/i.test(f.name))
          .map(f => [f.name, f.buffer])
      );

      // Find plausible playlists
      const playlists = await findPlaylistsInTar(extracted);
      if (!playlists.length) throw new Error('No playlist (.m3u8/.m3u) found in TAR.');

      // Choose the playlist with the most hits against present segments
      let best = null;
      for (const p of playlists) {
        const lines = p.text.split('\n').map(s => s.trim());
        const segs = lines.filter(s => s && !s.startsWith('#'));
        let hits = 0;
        for (const n of segs) {
          if (segmentFileMap.has(n)) { hits++; continue; }
          // nested folders inside tar: allow suffix match
          const found = Array.from(segmentFileMap.keys()).some(k => k.endsWith('/' + n));
          if (found) hits++;
        }
        p.segments = segs;
        p.hits = hits;
        p.isFmp4 = /#EXT-X-MAP:/i.test(p.text) || /\.m4s(\?|$)/i.test(p.text);
        if (!best || p.hits > best.hits || (!best.hits && best.isFmp4 && !p.isFmp4)) best = p;
      }
      if (!best || !best.segments.length) throw new Error('Playlist found, but no referenced segments present in TAR.');
      if (best.isFmp4) throw new Error('This TAR uses fMP4 (.m4s) HLS. Browser-side “Combine” is not supported. Use the raw TAR download.');

      await menuApi.setStatusMuted(`Combining ${best.hits}/${best.segments.length} segments…`);
      setBtn('Combining…', true);

      // Build ordered segment list
      const ordered = [];
      let totalSize = 0;
      for (const name of best.segments) {
        let key = segmentFileMap.has(name) ? name : Array.from(segmentFileMap.keys()).find(k => k.endsWith('/' + name));
        if (!key) throw new Error(`Missing segment in TAR: ${name}`);
        const u8 = new Uint8Array(segmentFileMap.get(key));
        ordered.push(u8); totalSize += u8.byteLength;
      }

      // Concatenate to a single TS file
      const combined = new Uint8Array(totalSize);
      let off = 0;
      for (const seg of ordered) { combined.set(seg, off); off += seg.length; }

      await menuApi.setStatusMuted(`Done. Final size: ${formatBytes(totalSize)}.`);
      const blob = new Blob([combined], { type: 'video/mp2t' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filenameWithExt(title, 'combined', '.ts');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setBtn('Done!', true);
      setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, 1200);

    } catch (e) {
      console.error('Rumble Downloader TAR Error:', e);
      await menuApi.setStatusMuted(`Error: ${e && e.message ? e.message : e}`);
      setBtn('Error', true);
      btn.style.backgroundColor = '#b91c1c';
      setTimeout(() => { btn.innerHTML = original; btn.disabled = false; btn.style.backgroundColor = ''; }, 3500);
    }
  }

  // ---------------- Probing pipeline (find MP4/TAR/AUDIO candidates) ----------------
  const CDN_HOST = 'https://hugh.cdn.rumble.cloud';
  const TOKEN_LABELS = { haa: '1080p', gaa: '720p', caa: '480p', baa: '360p', oaa: '240p' };
  const TOKENS = ['haa', 'gaa', 'caa', 'baa', 'oaa'];
  const PROBE_CONCURRENCY = 6;
  const COLLECTION_GRACE_MS = 3000;
  const COLLECTION_TICK_MS = 300;
  let EMBED_META = null; // { fps, bitrateKbps }

  function tokenToLabel(t) {
    const low = (t || '').toLowerCase();
    if (!low || low === 'faa') return null;
    return TOKEN_LABELS[low] || low;
  }
  function tokenRank(t) {
    switch ((t || '').toLowerCase()) {
      case 'haa': return 50; case 'gaa': return 40; case 'caa': return 30; case 'baa': return 20; case 'oaa': return 10;
      default: return 0;
    }
  }
  function typeFromUrl(u) {
    if (/\.tar(\?|$)/i.test(u)) return 'tar';
    if (/\.(aac|m4a)(\?|$)/i.test(u)) return 'audio';
    return 'mp4';
  }
  function extractTokenFromUrl(u) { const m = u.match(/\.([A-Za-z]{3})(?:\.rec)?\.(?:mp4|tar)\b/i); return m ? m[1] : null; }
  function hostScore(u) { try { const h = new URL(u, location.href).host; return h.includes('hugh.cdn.rumble.cloud') ? 2 : 1; } catch { return 0; } }

  function parseTotalSizeFromHeaders(h) {
    let m = h?.match(/content-range:\s*bytes\s+\d+-\d+\/(\d+)/i);
    if (m) { const n = +m[1]; return Number.isFinite(n) ? n : undefined; }
    m = h?.match(/content-length:\s*(\d+)/i);
    if (m) { const n = +m[1]; return Number.isFinite(n) ? n : undefined; }
    return undefined;
  }
  function probeUrl(url, timeout = 12000) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok, size) => { if (!done) { done = true; resolve({ ok, size }); } };
      GM_xmlhttpRequest({
        method: 'HEAD', url, timeout,
        onload: (r) => { const ok = r.status >= 200 && r.status < 400; finish(ok, parseTotalSizeFromHeaders(r.responseHeaders || '')); },
        onerror: () => {
          GM_xmlhttpRequest({
            method: 'GET', url, timeout, headers: { Range: 'bytes=0-0' },
            onload: (r2) => { const ok = r2.status >= 200 && r2.status < 400; finish(ok, parseTotalSizeFromHeaders(r2.responseHeaders || '')); },
            onerror: () => finish(false), ontimeout: () => finish(false)
          });
        },
        ontimeout: () => finish(false)
      });
    });
  }

  // Capture outgoing URLs to improve candidate pool
  const captured = new Set();
  const embedSeen = new Set();
  function maybeCapture(url) {
    try {
      const u = new URL(url, location.href).href;
      if (/\/video\/[^\s"'<>]+\.(?:mp4|tar)\b/i.test(u)) captured.add(u);
      else if (/rumble\.com\/embedJS\//i.test(u)) embedSeen.add(u);
      else if (/\.(?:m3u8|ts|aac|m4a)\b/i.test(u)) captured.add(`__HINT__${u}`);
      else if (/[?&]r_file=/.test(u)) {
        try { const qs = new URL(u).searchParams.get('r_file'); if (qs) captured.add(`__HINT__${qs}`); } catch { }
      }
    } catch { }
  }
  const _fetch = window.fetch;
  if (typeof _fetch === 'function') {
    window.fetch = function (input, init) {
      try { const url = typeof input === 'string' ? input : input?.url; if (url) maybeCapture(url); } catch { }
      return _fetch.apply(this, arguments);
    };
  }
  const XO = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) { try { if (url) maybeCapture(url); } catch { } return XO.apply(this, arguments); };

  function collectFromLocationParams(sink) {
    try {
      const usp = new URLSearchParams(location.search);
      const rfile = usp.get('r_file');
      if (rfile) sink.add(`__HINT__${rfile}`);
    } catch { }
  }

  function findMediaInDom() {
    const out = new Set();
    const addAbs = (u) => { try { out.add(new URL(u, location.href).href); } catch { } };
    const add = (u) => { if (!u) return; if (/^__HINT__/.test(u)) out.add(u); else addAbs(u); };

    $all('[src],[href]').forEach(el => {
      const v = el.getAttribute('src') || el.getAttribute('href') || '';
      if (/\/video\/.+\.(?:mp4|tar)(?:\?|$)/i.test(v)) add(v);
      if (/\.(?:aac|m4a)(?:\?|$)/i.test(v)) add(v);
      if (/rumble\.com\/embedJS\//i.test(v)) { try { embedSeen.add(new URL(v, location.href).href); } catch { } }
      if (/\.(?:m3u8|ts|aac|m4a)(?:\?|$)/i.test(v)) add(`__HINT__${v}`);
      if (/[?&]r_file=/.test(v)) {
        try { const q = new URL(v, location.href).searchParams.get('r_file'); if (q) add(`__HINT__${q}`); } catch { }
      }
    });

    $all('video,source').forEach(el => {
      const v = el.src || '';
      if (/\/video\/.+\.(?:mp4|tar)(?:\?|$)/i.test(v)) add(v);
      if (/\.(?:aac|m4a)(?:\?|$)/i.test(v)) add(v);
      if (/\.(?:m3u8|ts|aac|m4a)(?:\?|$)/i.test(v)) add(`__HINT__${v}`);
    });

    const reDL = /https?:\/\/[^\s"'<>]+\/video\/[^\s"'<>]+\.(?:mp4|tar)\b[^\s"'<>]*/gi;
    const reE = /https?:\/\/rumble\.com\/embedJS\/[^\s"'<>]+/gi;
    const reH = /https?:\/\/[^\s"'<>]+\.(?:m3u8|ts|aac|m4a)\b[^\s"'<>]*/gi;
    for (const s of $all('script')) {
      const text = (s.textContent || '').slice(0, 300000);
      let m; while ((m = reDL.exec(text))) add(m[0]);
      let e; while ((e = reE.exec(text))) embedSeen.add(e[0]);
      let h; while ((h = reH.exec(text))) add(`__HINT__${h[0]}`);
      const m2 = text.match(/r_file=([^\s"'&]+)/);
      if (m2 && m2[1]) add(`__HINT__${m2[1]}`);
    }

    const html = document.documentElement.outerHTML.slice(0, 1500000);
    let m; const re2 = /https?:\/\/[^\s"'<>]+\/video\/[^\s"'<>]+\.(?:mp4|tar)\b[^\s"'<>]*/gi;
    while ((m = re2.exec(html))) add(m[0]);
    let e; const re2E = /https?:\/\/rumble\.com\/embedJS\/[^\s"'<>]+/gi;
    while ((e = re2E.exec(html))) embedSeen.add(e[0]);
    let h; const re2H = /https?:\/\/[^\s"'<>]+\.(?:m3u8|ts|aac|m4a)\b[^\s"'<>]*/gi;
    while ((h = re2H.exec(html))) add(`__HINT__${h[0]}`);

    for (const u of captured) add(u);
    collectFromLocationParams(out);
    return Array.from(out);
  }

  function parseFromMp4Url(mp4Url) {
    try {
      const u = new URL(mp4Url, location.href);
      const m = u.pathname.match(/\/video\/(.+?)\/([^\/]+)$/i);
      if (!m) return null;
      const pathPart = m[1], file = m[2];
      const fm = file.match(/^([A-Za-z0-9_-]+)\.([A-Za-z]{3})(?:\.rec)?\.mp4$/);
      if (!fm) return null;
      const baseId = fm[1], token = fm[2], isLive = /\.rec\.mp4$/i.test(file);
      return { pathPart, baseId, token, isLive };
    } catch { return null; }
  }
  function parseFromTarUrl(tarUrl) {
    try {
      const u = new URL(tarUrl, location.href);
      const m = u.pathname.match(/\/video\/(.+?)\/([^\/]+)$/i);
      if (!m) return null;
      const pathPart = m[1], file = m[2];
      const fm = file.match(/^([A-Za-z0-9_-]+)\.([A-Za-z]{3})(?:\.rec)?\.tar$/i);
      if (!fm) return null;
      const baseId = fm[1], token = fm[2], isLive = /\.rec\.tar$/i.test(file);
      return { pathPart, baseId, token, isLive };
    } catch { return null; }
  }
  function parseFromImageUrl(imgUrl) {
    try {
      const u = new URL(imgUrl, location.href);
      if (!/\/video\//.test(u.pathname)) return null;
      const m = u.pathname.match(/\/video\/(.+?)\/([^\/]+)$/i);
      if (!m) return null;
      const pathPart = m[1], file = m[2];
      const fm = file.match(/^([A-Za-z0-9_-]+)\./);
      if (!fm) return null;
      const baseId = fm[1];
      return { pathPart, baseId, token: null, isLive: null };
    } catch { return null; }
  }
  function buildCdnUrl(pathPart, baseId, token, kind, live) {
    if (kind === 'tar') {
      const rec = live ? '.rec' : '';
      return `${CDN_HOST}/video/${pathPart}/${baseId}.${token}${rec}.tar`;
    }
    return `${CDN_HOST}/video/${pathPart}/${baseId}.${token}.mp4`;
  }
  function generateCandidates(parts) {
    const { pathPart, baseId } = parts;
    const triesLive = parts.isLive === null ? [true, false] : [!!parts.isLive];
    const out = [];
    for (const live of triesLive) {
      for (const t of TOKENS) {
        const cap = t[0].toUpperCase() + t.slice(1);
        out.push({ url: buildCdnUrl(pathPart, baseId, t, 'tar', live), type: 'tar', labelToken: t, caseVariant: 'lower', origin: 'generated', pri: (live ? 1 : 3) });
        out.push({ url: buildCdnUrl(pathPart, baseId, cap, 'tar', live), type: 'tar', labelToken: t, caseVariant: 'cap', origin: 'generated', pri: (live ? 1 : 3) });
        if (!live) {
          out.push({ url: buildCdnUrl(pathPart, baseId, t, 'mp4', false), type: 'mp4', labelToken: t, caseVariant: 'lower', origin: 'generated', pri: 2 });
          out.push({ url: buildCdnUrl(pathPart, baseId, cap, 'mp4', false), type: 'mp4', labelToken: t, caseVariant: 'cap', origin: 'generated', pri: 2 });
        }
      }
    }
    out.sort((a, b) => a.pri - b.pri || tokenRank(b.labelToken) - tokenRank(a.labelToken) || (a.caseVariant === 'lower' ? -1 : 1));
    return out;
  }

  async function fetchEmbedMeta() {
    try {
      for (const s of $all('script[type="application/ld+json"], script')) {
        const text = (s.textContent || '').slice(0, 500000);
        if (!/"fps"|"frameRate"|"bitrate"/i.test(text)) continue;
        let fps, bitrateKbps;
        let m = text.match(/"fps"\s*:\s*([0-9]{1,3}(?:\.[0-9]+)?)/i) || text.match(/"frameRate"\s*:\s*"?([0-9]{1,3}(?:\.[0-9]+)?)"?/i);
        if (m) fps = Math.round(parseFloat(m[1]));
        let b = text.match(/"bitrate"\s*:\s*([0-9]{2,7})/i) || text.match(/"bitrateKbps"\s*:\s*([0-9]{2,7})/i);
        if (b) {
          const val = parseInt(b[1], 10);
          bitrateKbps = val > 200000 ? Math.round(val / 1000) : val;
        }
        if (fps || bitrateKbps) return { fps, bitrateKbps };
      }
      for (const u of Array.from(embedSeen)) {
        const text = await new Promise((resolve) => {
          GM_xmlhttpRequest({
            method: 'GET', url: u, timeout: 12000,
            onload: (r) => resolve(r.responseText || ''),
            onerror: () => resolve(''), ontimeout: () => resolve('')
          });
        });
        if (!text) continue;
        let fps, bitrateKbps;
        let m = text.match(/"fps"\s*:\s*([0-9]{1,3}(?:\.[0-9]+)?)/i) || text.match(/"frameRate"\s*:\s*"?([0-9]{1,3}(?:\.[0-9]+)?)"?/i);
        if (m) fps = Math.round(parseFloat(m[1]));
        let b = text.match(/"bitrate"\s*:\s*([0-9]{2,7})/i) || text.match(/"bitrateKbps"\s*:\s*([0-9]{2,7})/i);
        if (b) {
          const val = parseInt(b[1], 10);
          bitrateKbps = val > 200000 ? Math.round(val / 1000) : val;
        }
        if (fps || bitrateKbps) return { fps, bitrateKbps };
      }
    } catch { }
    return { fps: undefined, bitrateKbps: undefined };
  }

  async function harvestUrlsFromEmbedAll() {
    return [];
  }

  async function collectAllLinksVerbose() {
    findMediaInDom();
    const ticks = Math.max(1, Math.floor(COLLECTION_GRACE_MS / COLLECTION_TICK_MS));
    for (let i = 1; i <= ticks; i++) { await sleep(COLLECTION_TICK_MS); findMediaInDom(); }
    const embedLinks = await harvestUrlsFromEmbedAll();
    return Array.from(new Set([...findMediaInDom(), ...embedLinks]));
  }

  function deriveParts(allLinks) {
    const tar = allLinks.find(u => /\.tar(\?|$)/i.test(u));
    const mp4 = allLinks.find(u => /\.mp4(\?|$)/i.test(u));
    let parts = null;
    if (tar) parts = parseFromTarUrl(tar);
    if (!parts && mp4) parts = parseFromMp4Url(mp4);
    if (!parts) {
      const img = allLinks.find(u => /^__IMG__https?:\/\//.test(u));
      if (img) {
        const parsed = parseFromImageUrl(img.replace(/^__IMG__/, ''));
        if (parsed) parts = parsed;
      }
    }
    return parts;
  }

  async function probeTargetsFast(targets, menuApi) {
    const probedUrls = new Set(), satisfied = new Set();
    let done = 0, okCount = 0;
    const total = targets.length;

    await menuApi.setStatusMuted(`Scanning…`);

    const queue = targets.slice();
    async function worker() {
      while (true) {
        const t = queue.shift();
        if (!t) break;
        const tok = (t.labelToken || extractTokenFromUrl(t.url) || '').toLowerCase();
        const label = tokenToLabel(tok) || (t.type === 'audio' ? 'Audio' : 'detected');
        const keyQT = `${tok}|${t.type}`;
        if (satisfied.has(keyQT) || probedUrls.has(t.url)) { done++; continue; }
        probedUrls.add(t.url);
        let pr = await probeUrl(t.url);
        if (!pr.ok && t.origin === 'generated' && t.caseVariant) {
          const swapped = t.caseVariant === 'lower'
            ? t.url.replace(/\.([a-z])([a-z]{2})(\.)/i, (_, a, b, dot) => `.${a.toUpperCase()}${b}${dot}`)
            : t.url.replace(/\.([A-Z])([a-z]{2})(\.)/, (_, a, b, dot) => `.${a.toLowerCase()}${b}${dot}`);
          if (swapped !== t.url && !probedUrls.has(swapped)) {
            probedUrls.add(swapped);
            const pr2 = await probeUrl(swapped);
            if (pr2.ok) { t.url = swapped; pr = pr2; }
          }
        }
        done++;
        if (pr.ok) {
          okCount++;
          menuApi.addOrUpdate({ label, type: t.type, url: t.url, size: pr.size, bitrate: EMBED_META?.bitrateKbps, fps: EMBED_META?.fps });
          satisfied.add(keyQT);
        }
        await sleep(0);
      }
    }
    const workers = Array.from({ length: Math.min(PROBE_CONCURRENCY, total) }, worker);
    await Promise.all(workers);
    return okCount;
  }

  // ---------------- UI (compact with center metadata; popup to the right) ----------------
  GM_addStyle(`
    :root {
      --rud-font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --rud-font-mono: 'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
      --rud-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
      --rud-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
    }
    #rud-portal.rud-dark {
      --rud-bg-primary: #111827; --rud-bg-secondary: #1f2937; --rud-bg-tertiary: #374151;
      --rud-text-primary: #f9fafb; --rud-text-secondary: #d1d5db; --rud-text-muted: #9ca3af;
      --rud-border-color: #374151;
      --rud-accent: #22c55e; --rud-accent-hover: #16a34a; --rud-accent-text: #ffffff;
      --rud-shadow: 0 10px 30px rgba(0,0,0,0.5);
      --rud-backdrop-blur: blur(12px);
    }
    #rud-portal.rud-light {
      --rud-bg-primary: #ffffff; --rud-bg-secondary: #f3f4f6; --rud-bg-tertiary: #e5e7eb;
      --rud-text-primary: #111827; --rud-text-secondary: #374151; --rud-text-muted: #6b7280;
      --rud-border-color: #e5e7eb;
      --rud-accent: #16a34a; --rud-accent-hover: #15803d; --rud-accent-text: #ffffff;
      --rud-shadow: 0 10px 25px rgba(0,0,0,0.1);
      --rud-backdrop-blur: blur(12px);
    }

    #rud-portal { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; font-family: var(--rud-font-sans); font-size: 14px; }
    .rud-inline-wrap { position: relative; display: inline-flex; }
    .rud-inline-wrap.rud-right { margin-left: auto; }

    #rud-download-btn {
      position: relative; display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.1rem;
      font-size: 14px; font-weight: 600; line-height: 1; color: var(--rud-text-primary);
      background-color: #374151;
      border: none; border-radius: 999px;
      cursor: pointer; margin-left: 12px;
      transition: all .2s var(--rud-ease-out);
    }
    #rud-download-btn:hover:not(:disabled) {
      background-color: var(--rud-accent);
      color: var(--rud-accent-text);
      transform: translateY(-2px);
      box-shadow: 0 6px 15px rgba(34, 197, 94, 0.3);
    }
    #rud-download-btn:active:not(:disabled) { transform: translateY(0px); box-shadow: none; }
    #rud-download-btn:disabled { opacity: .7; cursor: default; }
    #rud-download-btn .rud-btn-text { display: inline-flex; align-items: center; gap: 0.5rem; }

    .rud-panel {
      position: fixed;
      background: rgba(16, 16, 16, 0.8); color: var(--rud-text-primary);
      border: 1px solid var(--rud-border-color); border-radius: 12px;
      box-shadow: var(--rud-shadow); overflow: hidden; display: none;
      pointer-events: auto; backdrop-filter: var(--rud-backdrop-blur); -webkit-backdrop-filter: var(--rud-backdrop-blur);
      opacity: 0; transform: translateX(-10px) scale(0.98);
      transition: opacity 0.25s var(--rud-ease-out), transform 0.25s var(--rud-ease-out);
      width: 560px; max-width: 95vw;
    }
    .rud-panel.open { display: flex; flex-direction: column; opacity: 1; transform: translateX(0) scale(1); }

    .rud-header { display: flex; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--rud-border-color); }
    .rud-status { flex-grow: 1; font-size: 13px; color: var(--rud-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rud-header-controls { display: flex; align-items: center; gap: 8px; }
    .rud-icon-btn { display: flex; padding: 6px; background: none; border: none; border-radius: 8px; cursor: pointer; color: var(--rud-text-muted); transition: background .2s, color .2s; }
    .rud-icon-btn:hover { background: var(--rud-bg-secondary); color: var(--rud-text-primary); }
    .rud-icon-btn svg { width: 18px; height: 18px; }

    .rud-body { max-height: 60vh; overflow-y: auto; }
    .rud-list { display: flex; flex-direction: column; padding: 6px; }
    .rud-item { display: grid; grid-template-columns: 70px 55px 1fr 75px 210px; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 8px; transition: background .2s var(--rud-ease-in-out); }
    .rud-item + .rud-item { margin-top: 2px; }
    .rud-item:hover { background: var(--rud-bg-secondary); }
    .rud-item-res { font-weight: 700; font-size: 14px; color: var(--rud-text-primary); }
    .rud-item-badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; background: var(--rud-bg-tertiary); color: var(--rud-text-secondary); text-transform: uppercase; text-align: center;}
    .rud-item-meta { font-size: 12px; color: var(--rud-text-muted); text-align: center; white-space: nowrap; }
    .rud-item-size { font-size: 13px; color: var(--rud-text-muted); font-family: var(--rud-font-mono); text-align: right; }
    .rud-item-actions { display: inline-flex; gap: 6px; justify-content: flex-end; }
    .rud-item-actions a, .rud-item-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; text-decoration: none; font-size: 12px; font-weight: 600; padding: 5px 8px; border-radius: 6px; transition: all .2s var(--rud-ease-in-out); border: 1px solid transparent; flex-shrink: 0; }
    .rud-item-actions .rud-copy-btn { background: var(--rud-bg-tertiary); color: var(--rud-text-secondary); border-color: var(--rud-border-color); cursor: pointer; }
    .rud-item-actions .rud-copy-btn:hover { background: var(--rud-border-color); color: var(--rud-text-primary); }
    .rud-item-actions .rud-dl-link { background: var(--rud-accent); color: var(--rud-accent-text); border-color: var(--rud-accent); }
    .rud-item-actions .rud-dl-link:hover { background: var(--rud-accent-hover); }
    .rud-item-actions .rud-second { background: var(--rud-bg-tertiary); color: var(--rud-text-secondary); border-color: var(--rud-border-color); }
    .rud-item-actions svg { width: 14px; height: 14px; }
    
    .rud-footer { padding: 10px 14px; border-top: 1px solid var(--rud-border-color); background: var(--rud-bg-secondary); }
    .rud-tar-note { font-size: 12px; color: var(--rud-text-muted); line-height: 1.5; }
    .rud-tar-note strong { color: var(--rud-text-secondary); }

    .rud-empty { padding: 40px 20px; text-align: center; color: var(--rud-text-muted); font-size: 14px; line-height: 1.6; }
    .rud-empty svg { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.4; }

    [data-rud-tooltip] { position: relative; }
    [data-rud-tooltip]::after {
      content: attr(data-rud-tooltip); position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%);
      background: #111827; color: #f9fafb; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 6px;
      white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s var(--rud-ease-out);
    }
    [data-rud-tooltip]:hover::after { opacity: 1; transform: translateX(-50%) translateY(-4px); }
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
      <span class="rud-btn-text">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11m0 0l4-4m-4 4L8 10M5 21h14"></path></svg>
        <span class="rud-btn-label">Download</span>
      </span>`;
    return btn;
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
            <button class="rud-icon-btn rud-theme-toggle" type="button" title="Toggle Theme" data-rud-tooltip="Toggle Theme">
              <svg class="rud-theme-sun" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              <svg class="rud-theme-moon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="display:none;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            </button>
            <button class="rud-icon-btn rud-close-btn" type="button" title="Close" data-rud-tooltip="Close">
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
            <div><strong>Note:</strong> Browser-side “Combine” often fails around ~2 GB. If the archive is that large, prefer the raw TAR download.</div>
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
        const gap = 12;
        let left = Math.round(rect.right + gap);
        left = Math.max(16, Math.min(left, window.innerWidth - 16 - w));
        const top = Math.round(rect.top);
        menu.style.left = `${left}px`;
        menu.style.top = `${top}px`;
      });
    }
    async function open() {
      if (!menu.classList.contains('open')) {
        menu.classList.add('open');
        await positionMenu();
      }
    }
    async function close() {
      if (menu.classList.contains('open')) {
        menu.classList.remove('open');
      }
    }
    async function toggle() { if (menu.classList.contains('open')) await close(); else await open(); }

    async function setStatusMuted(text) {
      refs().statusEl.innerHTML = `<span class="muted">${safeHtml(text)}</span>`;
      await positionMenu();
    }
    async function showEmpty(message) {
      const r = refs();
      r.listEl.innerHTML = '';
      r.listEl.style.display = 'none';
      r.emptyEl.style.display = 'block';
      r.emptyEl.innerHTML = `
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        ${message || 'No verified downloads were found.'}`;
      await positionMenu();
    }
    async function hideEmpty() { const r = refs(); r.listEl.style.display = 'flex'; r.emptyEl.style.display = 'none'; }
    async function maybeToggleFooter() {
      const r = refs();
      const hasTar = !!r.listEl.querySelector('[data-type="tar"]');
      r.footerEl.style.display = hasTar ? 'block' : 'none';
      await positionMenu();
    }

    const byKey = new Map();

    function replaceNode(oldNode, newNode) {
      if (oldNode && oldNode.parentElement) oldNode.parentElement.replaceChild(newNode, oldNode);
    }

    function metaText({ fps, bitrate }) {
      const parts = [];
      if (Number.isFinite(fps) && fps > 0) parts.push(`${fps} FPS`);
      if (Number.isFinite(bitrate) && bitrate > 0) parts.push(`${bitrate} kbps`);
      return parts.join(' · ');
    }

    function addOrUpdate(dl) {
      const { label, type, url, size } = dl;
      if (!label || !type || !url) return;
      const r = refs();
      const key = `${label.toLowerCase()}|${type}`;
      const title = getVideoTitle();
      const fname = filenameWithExt(title, label === 'Audio' ? 'audio' : label, url);
      const menuApi = api;
      const mtxt = metaText({ fps: dl.fps, bitrate: dl.bitrate });

      const buildItem = () => {
        const item = document.createElement('div');
        item.className = 'rud-item';
        item.dataset.type = type;

        const actions =
          type === 'tar'
            ? `
              <a href="${url}" target="_blank" rel="noopener" download="${fname}" class="rud-dl-link" data-rud-tooltip="Download .tar">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                <span>Tar</span>
              </a>
              <button type="button" class="rud-combine-btn rud-second" data-url="${url}" data-rud-tooltip="Extract + Combine to .ts">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h6m-6 4h6m-6 4h6"></path></svg>
                <span>Combine</span>
              </button>
              <button type="button" class="rud-copy-btn" data-url="${url}" data-rud-tooltip="Copy Link">
                 <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2z"></path></svg>
              </button>`
            : `
              <a href="${url}" target="_blank" rel="noopener" download="${fname}" class="rud-dl-link" data-rud-tooltip="Download">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                <span>DL</span>
              </a>
              <button type="button" class="rud-copy-btn" data-url="${url}" data-rud-tooltip="Copy Link">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2z"></path></svg>
              </button>`;

        item.innerHTML = `
          <div class="rud-item-res">${safeHtml(label)}</div>
          <div class="rud-item-badge">${safeHtml(type)}</div>
          <div class="rud-item-meta">${safeHtml(mtxt || '')}</div>
          <div class="rud-item-size">${formatBytes(size)}</div>
          <div class="rud-item-actions">
            ${actions}
          </div>`;

        const copyBtn = item.querySelector('.rud-copy-btn');
        copyBtn?.addEventListener('click', (e) => {
          const b = e.currentTarget;
          GM_setClipboard(b.dataset.url);
          const orig = b.dataset.rudTooltip;
          b.dataset.rudTooltip = 'Copied!';
          setTimeout(() => { b.dataset.rudTooltip = orig; }, 1800);
        });

        const combineBtn = item.querySelector('.rud-combine-btn');
        if (combineBtn) {
          combineBtn.addEventListener('click', (e) => {
            processTarFile(e.currentTarget.dataset.url, e.currentTarget, menuApi, getVideoTitle());
          });
        }
        return item;
      };

      const existing = byKey.get(key);
      if (existing) {
        const oldSize = Number(existing.size) || 0;
        const newSize = Number(size) || 0;
        if (newSize > oldSize || (newSize && !oldSize)) {
          const newNode = buildItem();
          replaceNode(existing.node, newNode);
          byKey.set(key, { node: newNode, url, size: newSize, meta: { fps: dl.fps, bitrate: dl.bitrate } });
        }
        return;
      }

      const item = buildItem();
      byKey.set(key, { node: item, url, size: Number(size) || 0, meta: { fps: dl.fps, bitrate: dl.bitrate } });

      const rank = type === 'audio' ? -1 : tokenRank(extractTokenFromUrl(url) || '');
      let placed = false;
      for (const child of r.listEl.children) {
        const childUrl = child.querySelector('.rud-item-actions .rud-dl-link, .rud-item-actions .rud-copy-btn')?.getAttribute('href') || child.querySelector('.rud-copy-btn')?.getAttribute('data-url') || '';
        const childType = child.getAttribute('data-type') || '';
        const childRank = childType === 'audio' ? -1 : tokenRank(extractTokenFromUrl(childUrl) || '');
        if (rank > childRank) { r.listEl.insertBefore(item, child); placed = true; break; }
      }
      if (!placed) r.listEl.appendChild(item);
      queueMicrotask(() => { maybeToggleFooter(); });
    }

    function exportListForCache() {
      const out = [];
      for (const [key, val] of byKey.entries()) {
        const [labelLower, type] = key.split('|');
        const label = labelLower === 'audio' ? 'Audio' : (labelLower.toUpperCase() === labelLower ? labelLower : labelLower);
        out.push({
          label,
          type,
          url: val.url,
          size: val.size,
          fps: val.meta?.fps,
          bitrate: val.meta?.bitrate
        });
      }
      return out;
    }

    function limitToTopThree() {
      const allItems = Array.from(byKey.values());
      const videoItems = allItems.filter(item => {
        const type = item.node.dataset.type;
        return type === 'tar' || type === 'mp4';
      });

      if (videoItems.length <= 3) return; // No need to filter

      const getUrl = (item) => item.node.querySelector('[data-url]')?.dataset.url || '';

      videoItems.sort((a, b) => {
        const rankA = tokenRank(extractTokenFromUrl(getUrl(a)));
        const rankB = tokenRank(extractTokenFromUrl(getUrl(b)));
        return rankB - rankA;
      });

      const topThreeItems = new Set(videoItems.slice(0, 3));

      allItems.forEach(item => {
        const type = item.node.dataset.type;
        // Always show audio, otherwise check if it's in the top 3
        if (type === 'audio' || topThreeItems.has(item)) {
          item.node.style.display = 'grid';
        } else {
          item.node.style.display = 'none';
        }
      });
    }

    const api = {
      open, close, toggle,
      setStatusMuted,
      clearLists: async () => { const r = refs(); byKey.clear(); r.listEl.innerHTML = ''; await hideEmpty(); await maybeToggleFooter(); },
      addOrUpdate,
      showEmpty, hideEmpty,
      haveAny: () => byKey.size > 0,
      ensureVisible: async () => { if (!menu.classList.contains('open')) await open(); },
      positionMenu,
      exportListForCache,
      limitToTopThree
    };
    return api;
  }

  // ---------------- Main click with caching ----------------
  async function onDownloadClick(btn) {
    const menuApi = createMenu(btn);
    await menuApi.ensureVisible();

    // Try cache first
    const cached = loadCachedList();
    if (cached && cached.length) {
      await menuApi.clearLists();
      for (const it of cached) {
        menuApi.addOrUpdate({ label: it.label, type: it.type, url: it.url, size: it.size, fps: it.fps, bitrate: it.bitrate });
      }
      menuApi.limitToTopThree(); // Apply filter to cached results
      await menuApi.setStatusMuted('Ready (cached).');
      return; // near-instant reuse
    }

    await menuApi.setStatusMuted('Preparing…');
    try {
      const all = await collectAllLinksVerbose();
      EMBED_META = await fetchEmbedMeta();
      const parts = deriveParts(all);

      const directRaw = all.filter(u => /\/video\/.+\.(?:mp4|tar)\b/i.test(u) || /\.(?:aac|m4a)(?:\?|$)/i.test(u));
      const direct = [];
      const seenDirect = new Set();
      for (const u of directRaw) {
        if (seenDirect.has(u)) continue;
        seenDirect.add(u);
        const tok = extractTokenFromUrl(u);
        const t = typeFromUrl(u);
        if (t === 'audio' || ((tok || '').toLowerCase() !== 'faa')) {
          direct.push({ url: u, type: t, labelToken: (tok || '').toLowerCase(), origin: 'direct', pri: (hostScore(u) === 2 ? 0 : 4) });
        }
      }

      let generated = parts ? generateCandidates(parts).map(c => ({ ...c, labelToken: (c.labelToken || '').toLowerCase() })) : [];
      const rawTargets = [...direct, ...generated];
      rawTargets.sort((a, b) => a.pri - b.pri || tokenRank(b.labelToken) - tokenRank(a.labelToken) || (hostScore(b.url) - hostScore(a.url)));
      const targets = [];
      const seen = new Set();
      for (const t of rawTargets) { if (t && t.url && !seen.has(t.url)) { seen.add(t.url); targets.push(t); } }

      await menuApi.clearLists();

      if (!targets.length) {
        await menuApi.showEmpty('No candidates to probe. Play or seek the video, then click Download again.');
        clearCacheForPage();
        return;
      }

      await probeTargetsFast(targets, menuApi);
      menuApi.limitToTopThree(); // Apply filter after probing

      await menuApi.setStatusMuted('Ready.');

      // Save cache only after we fully processed the targets and have items
      if (menuApi.haveAny()) {
        const list = menuApi.exportListForCache();
        if (list.length) saveCachedList(list);
      }

      await menuApi.ensureVisible();
    } catch (e) {
      console.error('Rumble Downloader Error:', e);
      await menuApi.showEmpty(`An unexpected error occurred:<br>${e && (e.message || e)}`);
      clearCacheForPage();
    }
  }

  // ---------------- Mount button (module style) ----------------
  const ACTION_BAR_SELECTORS = [
    '.media-by-channel-actions-container.pr-8.mt-4.shrink-0.items-center.flex',
    '.media-by-channel-actions-container',
    '.media-by-actions-container',
    '.media-header__actions',
    '.media-by__actions',
    'div[data-js="video_action_button_group"]'
  ];

  function mountButton() {
    if (!isVideoPage() || document.getElementById('rud-download-btn')) return;

    for (const sel of ACTION_BAR_SELECTORS) {
      const container = $(sel);
      if (container) {
        const btn = createButton();
        const wrap = document.createElement('span');
        wrap.className = 'rud-inline-wrap rud-right';
        wrap.appendChild(btn);
        container.appendChild(wrap);

        const menuApi = createMenu(btn);

        // If cached exists, prime menu so first click is instant
        const cached = loadCachedList();
        if (cached && cached.length) {
          menuApi.clearLists().then(() => {
            cached.forEach(it => menuApi.addOrUpdate({ label: it.label, type: it.type, url: it.url, size: it.size, fps: it.fps, bitrate: it.bitrate }));
            menuApi.limitToTopThree(); // Apply filter to primed cached results
            menuApi.setStatusMuted('Ready (cached).');
          });
        }

        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          // If already have entries, just toggle open/close
          const cachedNow = loadCachedList();
          if (cachedNow && cachedNow.length) {
            if (!btn.disabled) menuApi.toggle();
            return;
          }
          if (menuApi.haveAny() && !btn.disabled) menuApi.toggle();
          else onDownloadClick(btn);
        }, { passive: true });

        return;
      }
    }
  }

  const routeObs = new MutationObserver(debounce(() => { mountButton(); }, 200));
  routeObs.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButton, { passive: true });
  else mountButton();

  // Quietly surface page errors inside header line without adding extra UI height
  window.addEventListener('error', (ev) => {
    const menu = document.querySelector('#rud-portal .rud-panel');
    if (menu) {
      const statusEl = menu.querySelector('.rud-status');
      if (statusEl) statusEl.textContent = `Page Error: ${ev.message || ev.error || 'unknown'}`;
    }
  }, { passive: true });

})();