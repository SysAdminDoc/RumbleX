// ==UserScript==
// @name         Rumble URL Extractor
// @namespace    Rumble URL Extractor
// @version      1.0.0
// @description  Tool for download function testing. It fetches the per-video embedJS, parses it and shows/copies all URLs found.
// @author       Matthew Parker
// @match        https://rumble.com/*
// @exclude      https://rumble.com/user/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rumble.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      githubusercontent.com
// @connect      googleapis.com
// @connect      rumble.com
// @connect      1a-1791.com
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-core.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-styles.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-features.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-ui.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-downloader.js
// @updateURL    https://github.com/SysAdminDoc/RumbleEnhancementSuite/raw/refs/heads/main/void/tools/Rumble%20URL%20Extractor-1.0.0.user.js
// @downloadURL  https://github.com/SysAdminDoc/RumbleEnhancementSuite/raw/refs/heads/main/void/tools/Rumble%20URL%20Extractor-1.0.0.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ---------- Small utils ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  function $(s, r = document) { return r.querySelector(s); }
  function $all(s, r = document) { return Array.from(r.querySelectorAll(s)); }
  function safeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
  function isVideoPath(path = location.pathname) { return /^\/v[A-Za-z0-9]+(?:[\/\.-]|$)/.test(path); }
  function getVideoIdFromString(str) {
    if (!str) return null;
    const m = str.match(/\/v([A-Za-z0-9]+)(?:[\/\.-]|$)/);
    return m ? m[1] : null;
  }
  function getVideoId() {
    let id = getVideoIdFromString(location.pathname);
    if (id) return id;
    const canonical = $('link[rel="canonical"]')?.href;
    if (canonical && (id = getVideoIdFromString(canonical))) return id;
    const og = $('meta[property="og:url"]')?.content || $('meta[property="og:video:url"]')?.content;
    if (og && (id = getVideoIdFromString(og))) return id;
    // Try title patterns like "... - Rumble" not helpful for id; bail out if not found
    return null;
  }
  function unique(arr) { return Array.from(new Set(arr)); }

  // ---------- Styles ----------
  GM_addStyle(`
    #rux-float-btn {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483646;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      font: 600 14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      color: #fff;
      background: #10b981;
      border: none;
      border-radius: 999px;
      cursor: grab;
      box-shadow: 0 10px 20px rgba(0,0,0,.25);
      user-select: none;
      transition: transform .12s ease, box-shadow .12s ease, background .2s ease;
    }
    #rux-float-btn:hover { background: #059669; transform: translateY(-1px); }
    #rux-float-btn:active { cursor: grabbing; transform: translateY(0); }
    #rux-float-btn .rux-icon { width: 16px; height: 16px; }

    #rux-popup {
      position: fixed;
      top: 80px;
      left: 80px;
      z-index: 2147483647;
      display: none;
      min-width: 320px;
      max-width: min(92vw, 1300px);
      max-height: 70vh;
      background: rgba(17,24,39,0.96);
      color: #e5e7eb;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      box-shadow: 0 20px 60px rgba(0,0,0,.45);
      overflow: hidden;
      font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    }
    #rux-popup.rux-open { display: grid; grid-template-rows: auto 1fr auto; }

    #rux-popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(31,41,55,0.9);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      cursor: move;
      user-select: none;
    }
    #rux-title { font: 700 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #f9fafb; }
    .rux-header-actions { display: inline-flex; gap: 8px; }
    .rux-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 10px; border-radius: 7px;
      background: #374151; color: #e5e7eb; border: 1px solid rgba(255,255,255,0.08);
      cursor: pointer; font: 600 12px/1 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      transition: background .2s ease, color .2s ease, transform .1s ease;
    }
    .rux-btn:hover { background: #4b5563; }
    .rux-btn:active { transform: translateY(1px); }
    .rux-btn--primary { background: #10b981; border-color: #10b981; color: #06281f; }
    .rux-btn--primary:hover { background: #059669; border-color: #059669; color: #eafff6; }
    .rux-btn--ghost { background: transparent; border-color: rgba(255,255,255,0.08); }

    #rux-popup-body {
      padding: 8px;
      overflow: auto;
    }

    /* Auto-fit to the longest line: we measure then set width; while showing, keep pre-wrap for visibility */
    #rux-urls {
      white-space: pre;
      word-break: break-word;
      color: #e5e7eb;
      tab-size: 2;
    }
    #rux-count { color: #9ca3af; font-weight: 600; margin-left: 6px; }

    #rux-popup-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      background: rgba(31,41,55,0.9);
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    #rux-status { color: #9ca3af; font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .rux-hidden { display: none !important; }
  `);

  // ---------- Floating button + popup elements ----------
  function createUI() {
    if (document.getElementById('rux-float-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'rux-float-btn';
    btn.type = 'button';
    btn.innerHTML = `
      <svg class="rux-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l4-4m-4 4l-4-4M5 21h14"/></svg>
      <span>Extract URLs</span>
    `;
    document.documentElement.appendChild(btn);

    const popup = document.createElement('div');
    popup.id = 'rux-popup';
    popup.innerHTML = `
      <div id="rux-popup-header">
        <div id="rux-title">Rumble URL Extractor <span id="rux-count"></span></div>
        <div class="rux-header-actions">
          <button id="rux-copy" class="rux-btn rux-btn--primary" title="Copy URLs">Copy</button>
          <button id="rux-close" class="rux-btn rux-btn--ghost" title="Close">Close</button>
        </div>
      </div>
      <div id="rux-popup-body">
        <pre id="rux-urls"></pre>
      </div>
      <div id="rux-popup-footer">
        <div id="rux-status">Ready.</div>
        <div>
          <button id="rux-clear" class="rux-btn" title="Clear output">Clear</button>
          <button id="rux-reload" class="rux-btn" title="Re-scan">Re-scan</button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(popup);

    // Draggable button (by itself)
    makeDraggable(btn, { constrainToViewport: true });

    // Draggable popup (drag by header)
    makeDraggable(popup, { handle: popup.querySelector('#rux-popup-header'), constrainToViewport: true });

    // Events
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      openPopup();
      await runExtraction();
    });

    popup.querySelector('#rux-close').addEventListener('click', () => closePopup());
    popup.querySelector('#rux-clear').addEventListener('click', () => setUrls([]));
    popup.querySelector('#rux-reload').addEventListener('click', async () => { await runExtraction(true); });
    popup.querySelector('#rux-copy').addEventListener('click', () => {
      const text = popup.querySelector('#rux-urls').textContent || '';
      if (!text.trim()) { setStatus('Nothing to copy.'); return; }
      GM_setClipboard(text, 'text');
      setStatus('Copied to clipboard.');
    });
  }

  function openPopup() { const p = document.getElementById('rux-popup'); if (p) p.classList.add('rux-open'); }
  function closePopup() { const p = document.getElementById('rux-popup'); if (p) p.classList.remove('rux-open'); }
  function setStatus(msg) { const s = document.getElementById('rux-status'); if (s) s.textContent = msg; }
  function setUrls(urls) {
    const list = unique(urls).sort();
    const pre = document.getElementById('rux-urls');
    const count = document.getElementById('rux-count');
    if (pre) pre.textContent = list.join('\n');
    if (count) count.textContent = `(${list.length})`;
    // Auto-fit width to longest line, within max; measure via canvas
    autoFitPopupWidth(list);
  }

  function autoFitPopupWidth(lines) {
    const popup = document.getElementById('rux-popup');
    if (!popup) return;
    const body = document.getElementById('rux-popup-body');
    if (!body) return;

    const font = getComputedStyle(popup).font || '13px ui-monospace';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = font;

    const pad = 20; // padding buffer
    let max = 320;  // min
    for (const line of lines) {
      const w = ctx.measureText(line).width + pad;
      if (w > max) max = Math.ceil(w);
    }
    // Clamp to viewport
    const vw = Math.max(360, Math.min(window.innerWidth * 0.92, 1300));
    popup.style.width = Math.min(max, vw) + 'px';
  }

  // ---------- Draggability ----------
  function makeDraggable(el, opts = {}) {
    const handle = opts.handle || el;
    let dragging = false, startX = 0, startY = 0, origX = 0, origY = 0;

    const onDown = (ev) => {
      if (ev.button !== 0) return;
      dragging = true;
      const rect = el.getBoundingClientRect();
      startX = ev.clientX; startY = ev.clientY;
      origX = rect.left; origY = rect.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp, { once: true });
      ev.preventDefault();
    };
    const onMove = (ev) => {
      if (!dragging) return;
      let nx = origX + (ev.clientX - startX);
      let ny = origY + (ev.clientY - startY);
      if (opts.constrainToViewport) {
        const w = el.offsetWidth, h = el.offsetHeight;
        nx = Math.max(0, Math.min(nx, window.innerWidth - w));
        ny = Math.max(0, Math.min(ny, window.innerHeight - h));
      }
      el.style.left = nx + 'px';
      el.style.top = ny + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    };
    const onUp = () => {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
    };

    handle.addEventListener('mousedown', onDown);
  }

  // ---------- embedJS discovery ----------
  // We attempt three strategies to get the correct per-video embedJS URL:
  // 1) Sniff any embedJS URLs already present in the DOM/scripts.
  // 2) Capture any embedJS URL requested by the page via fetch/XHR (post-load).
  // 3) Construct a canonical embedJS URL from the video id as a fallback.
  const seenEmbed = new Set();

  // Capture via fetch/XHR so if the page loads it later, we can use it
  (function hookNetwork() {
    try {
      const _fetch = window.fetch;
      if (typeof _fetch === 'function') {
        window.fetch = function(input, init) {
          try {
            const url = typeof input === 'string' ? input : input?.url;
            if (url && /rumble\.com\/embedJS\//i.test(url)) seenEmbed.add(new URL(url, location.href).href);
          } catch {}
          return _fetch.apply(this, arguments);
        };
      }
      const XO = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        try {
          if (url && /rumble\.com\/embedJS\//i.test(url)) seenEmbed.add(new URL(url, location.href).href);
        } catch {}
        return XO.apply(this, arguments);
      };
    } catch {}
  })();

  function findEmbedJsCandidatesInDom() {
    const out = new Set();
    // Attributes
    $all('[src],[href]').forEach(el => {
      const v = el.getAttribute('src') || el.getAttribute('href') || '';
      if (/rumble\.com\/embedJS\//i.test(v)) {
        try { out.add(new URL(v, location.href).href); } catch {}
      }
    });
    // Inline scripts
    const re = /https?:\/\/rumble\.com\/embedJS\/[^\s"'<>]+/gi;
    for (const s of $all('script')) {
      const text = (s.textContent || '').slice(0, 500000);
      let m;
      while ((m = re.exec(text))) out.add(m[0]);
    }
    // Full HTML sweep (bounded)
    const html = document.documentElement.outerHTML.slice(0, 1500000);
    let m; const re2 = /https?:\/\/rumble\.com\/embedJS\/[^\s"'<>]+/gi;
    while ((m = re2.exec(html))) out.add(m[0]);

    // Add any captured by hooks
    for (const u of Array.from(seenEmbed)) out.add(u);

    return Array.from(out);
  }

  function buildFallbackEmbedUrl() {
    const vid = getVideoId();
    if (!vid) return null;
    // Common working shape; extra params (ext, ad_wt, dref) are not required for retrieving the JSON blob
    const usp = new URLSearchParams({
      ifr: '0',
      dref: 'rumble.com',
      request: 'video',
      ver: '2',
      v: `v${vid}`
    });
    return `https://rumble.com/embedJS/u3/?${usp.toString()}`;
  }

  async function getBestEmbedUrl() {
    // Prefer explicitly seen/captured ones
    const found = findEmbedJsCandidatesInDom();
    if (found.length) {
      // Prefer ones that contain &request=video and &v=...
      found.sort((a, b) => {
        const as = scoreEmbedUrl(a);
        const bs = scoreEmbedUrl(b);
        return bs - as;
      });
      return found[0];
    }
    // Fallback to constructed
    return buildFallbackEmbedUrl();
  }

  function scoreEmbedUrl(u) {
    try {
      const url = new URL(u, location.href);
      const s = url.searchParams;
      let score = 0;
      if (/\/embedJS\/u\d+\//.test(url.pathname)) score += 2;
      if (s.get('request') === 'video') score += 2;
      if (s.get('v')) score += 2;
      if (s.get('ifr') === '0') score += 1;
      return score;
    } catch { return 0; }
  }

  // ---------- Fetch + Parse blob ----------
  function gmFetchText(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout,
        onload: (r) => {
          if (r.status >= 200 && r.status < 400) resolve(r.responseText || '');
          else reject(new Error(`HTTP ${r.status}`));
        },
        onerror: () => reject(new Error('Network error')),
        ontimeout: () => reject(new Error('Request timed out')),
      });
    });
  }

  // Try hard to extract a JSON object from arbitrary JS response
  function extractFirstJsonObject(text) {
    // Fast path: text itself is JSON
    const t = text.trim();
    if (t.startsWith('{') && t.endsWith('}')) {
      try { return JSON.parse(t); } catch {}
    }
    // Look for the first balanced {...} block that parses as JSON
    const start = t.indexOf('{');
    if (start === -1) return null;
    // Scan for balanced braces to guess object boundaries
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < t.length; i++) {
      const ch = t[i];
      if (inStr) {
        if (esc) { esc = false; }
        else if (ch === '\\') { esc = true; }
        else if (ch === '"') { inStr = false; }
        continue;
      } else {
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            const candidate = t.slice(start, i + 1);
            try { return JSON.parse(candidate); } catch { /* keep scanning */ }
          }
        }
      }
    }
    // Fallback: sometimes JSON is stringified inside quotes; try JSON.parse("...json...")
    const m = t.match(/JSON\.parse\(\s*"(.*?)"\s*\)/s);
    if (m && m[1]) {
      try {
        const unescaped = m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        return JSON.parse(unescaped);
      } catch {}
    }
    return null;
  }

  function collectUrlsFromAny(o, bag = new Set()) {
    const urlRe = /\bhttps?:\/\/[^\s"'<>)\]}]+/g;
    const visit = (val) => {
      if (val == null) return;
      const t = typeof val;
      if (t === 'string') {
        // If string itself is a URL, add it. Also scan inside string for embedded URLs.
        if (/^https?:\/\//i.test(val)) bag.add(val);
        const matches = val.match(urlRe);
        if (matches) matches.forEach(u => bag.add(u));
      } else if (t === 'object') {
        if (Array.isArray(val)) val.forEach(visit);
        else for (const k in val) visit(val[k]);
      }
    };
    visit(o);
    return Array.from(bag);
  }

  async function runExtraction(force = false) {
    if (!isVideoPath()) {
      setStatus('This does not look like a video page.');
      setUrls([]);
      return;
    }
    setStatus('Locating embedJS…');

    let embedUrl = await getBestEmbedUrl();

    // If none found, give the page a moment (SPA route delays)
    if (!embedUrl && !force) {
      await sleep(600);
      embedUrl = await getBestEmbedUrl();
    }
    if (!embedUrl) {
      setStatus('Could not determine embedJS URL for this video.');
      setUrls([]);
      return;
    }

    setStatus('Fetching embedJS…');
    let text = '';
    try {
      text = await gmFetchText(embedUrl, 20000);
    } catch (e) {
      setStatus(`Fetch failed: ${e && e.message ? e.message : e}`);
      setUrls([]);
      return;
    }

    setStatus('Parsing blob…');

    // Preferred: find a JSON object and extract URL-like strings
    const json = extractFirstJsonObject(text);
    let urls = [];
    if (json) {
      urls = collectUrlsFromAny(json);
    } else {
      // Fallback: just scrape every URL from the file text
      const all = text.match(/\bhttps?:\/\/[^\s"'<>)\]}]+/g) || [];
      urls = unique(all);
    }

    setUrls(urls);
    setStatus(`Done. Found ${urls.length} URL${urls.length === 1 ? '' : 's'}.`);
  }

  // ---------- Mount on video pages and keep alive across SPA nav ----------
  function mount() {
    if (!isVideoPath()) return;
    createUI();
  }

  // Initial
  mount();

  // Observe SPA route changes
  const mo = new MutationObserver(() => {
    if (!document.getElementById('rux-float-btn')) mount();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

})();
