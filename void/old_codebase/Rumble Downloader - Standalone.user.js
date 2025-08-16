// ==UserScript==
// @name         Rumble Universal Downloader — Premium UI Edition
// @namespace    https://github.com/gemini-scripts/rumble-enhancement-suite
// @version      5.0.0
// @description  A refined Rumble downloader with a premium, modern UI. Features a clean, full-width layout, dark/light themes, enhanced user feedback, and copy-to-clipboard functionality. Built upon the original's robust DOM/Network/EmbedJS detection.
// @author       Steve (UI by Gemini)
// @match        *://rumble.com/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @require      https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @connect      *
// ==/UserScript==
(function() {
  'use strict';

  // ---------------- Config ----------------
  const CDN_HOST = 'https://hugh.cdn.rumble.cloud';
  const ACTION_BAR_SELECTORS = [
    '.media-by-channel-actions-container',
    '.media-header__actions',
    '.media-by__actions'
  ];

  // exclude 'faa' per request
  const TOKEN_LABELS = { haa: '1080p', gaa: '720p', caa: '480p', baa: '360p', oaa: '240p' };
  const TOKENS = ['haa', 'gaa', 'caa', 'baa', 'oaa'];

  const PROBE_CONCURRENCY = 6;
  const COLLECTION_GRACE_MS = 3500;
  const COLLECTION_TICK_MS = 350;

  const EMBED_UNITS = ['u0','u1','u2','u3','u4'];
  const EMBED_VARIANTS = [
    ({v}) => `https://rumble.com/embedJS/u0/?request=video&v=${encodeURIComponent(v)}`,
    ({v, dref='rumble.com'}) => `https://rumble.com/embedJS/u3/?ifr=0&dref=${encodeURIComponent(dref)}&request=video&ver=2&v=${encodeURIComponent(v)}`
  ];

  // ---------------- Small utils ----------------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  function debounce(fn, d) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), d); }; }
  function raf(fn){ return new Promise(r=> requestAnimationFrame(()=>{ try{ fn(); }finally{ r(); } })); }
  function $(s, r=document){ return r.querySelector(s); }
  function $all(s, r=document){ return Array.from(r.querySelectorAll(s)); }
  function isVideoPage(p = location.pathname) { return /^\/v[A-Za-z0-9]+(?:[\/\.-]|$)/.test(p); }

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
    const ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
    const base = sanitizeFilename(title);
    const res = label ? ` - ${label}` : '';
    return `${base}${res}.${ext}`;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const u = ['B','KB','MB','GB','TB'];
    let i=0,n=bytes; while (n>=1024 && i<u.length-1){ n/=1024; i++; }
    return `${n.toFixed(n>=10?0:1)} ${u[i]}`;
  }
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
        onload: (r) => { const ok = r.status>=200 && r.status<400; finish(ok, parseTotalSizeFromHeaders(r.responseHeaders||'')); },
        onerror: () => {
          GM_xmlhttpRequest({
            method: 'GET', url, timeout, headers: { Range: 'bytes=0-0' },
            onload: (r2)=>{ const ok = r2.status>=200 && r2.status<400; finish(ok, parseTotalSizeFromHeaders(r2.responseHeaders||'')); },
            onerror: ()=>finish(false), ontimeout: ()=>finish(false)
          });
        },
        ontimeout: ()=>finish(false)
      });
    });
  }

  function tokenToLabel(t) {
    const low = (t||'').toLowerCase();
    if (!low || low==='faa') return null;
    return TOKEN_LABELS[low] || low;
  }
  function tokenRank(t) {
    switch ((t||'').toLowerCase()) {
      case 'haa': return 50; case 'gaa': return 40; case 'caa': return 30; case 'baa': return 20; case 'oaa': return 10; default: return 0;
    }
  }
  function typeFromUrl(u){ return /\.tar(\?|$)/i.test(u) ? 'tar' : 'mp4'; }
  function extractTokenFromUrl(u){ const m = u.match(/\.([A-Za-z]{3})(?:\.rec)?\.(?:mp4|tar)\b/i); return m ? m[1] : null; }
  function hostScore(u){ try{ const h=new URL(u,location.href).host; return h.includes('hugh.cdn.rumble.cloud')?2:1; }catch{ return 0; } }

  // ---------------- Network & DOM capture ----------------
  const captured = new Set();
  const embedSeen = new Set();

  function maybeCapture(url) {
    try{
      const u = new URL(url, location.href).href;
      if (/\/video\/[^\s"'<>]+\.(?:mp4|tar)\b/i.test(u)) captured.add(u);
      else if (/rumble\.com\/embedJS\//i.test(u)) embedSeen.add(u);
      else if (/\.(?:m3u8|ts)\b/i.test(u)) captured.add(`__HINT__${u}`);
      else if (/[?&]r_file=/.test(u)) {
        try { const qs = new URL(u).searchParams.get('r_file'); if (qs) captured.add(`__HINT__${qs}`); } catch {}
      }
    }catch{}
  }

  const _fetch = window.fetch;
  if (typeof _fetch === 'function') {
    window.fetch = function(input, init) {
      try { const url = typeof input === 'string' ? input : input?.url; if (url) maybeCapture(url); } catch {}
      return _fetch.apply(this, arguments);
    };
  }
  const XO = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    try { if (url) maybeCapture(url); } catch {}
    return XO.apply(this, arguments);
  };

  function collectFromLocationParams(sink) {
    try {
      const usp = new URLSearchParams(location.search);
      const rfile = usp.get('r_file');
      if (rfile) sink.add(`__HINT__${rfile}`);
    } catch {}
  }

  function findMediaInDom() {
    const out = new Set();
    const addAbs = (u)=>{ try{ out.add(new URL(u, location.href).href); }catch{} };
    const add = (u)=>{ if (!u) return; if (/^__HINT__/.test(u)) out.add(u); else addAbs(u); };

    $all('[src],[href]').forEach(el=>{
      const v = el.getAttribute('src') || el.getAttribute('href') || '';
      if (/\/video\/.+\.(?:mp4|tar)(?:\?|$)/i.test(v)) add(v);
      if (/rumble\.com\/embedJS\//i.test(v)) { try{ embedSeen.add(new URL(v,location.href).href); }catch{} }
      if (/\.(?:m3u8|ts)(?:\?|$)/i.test(v)) add(`__HINT__${v}`);
      if (/[?&]r_file=/.test(v)) {
        try { const q = new URL(v, location.href).searchParams.get('r_file'); if (q) add(`__HINT__${q}`); } catch {}
      }
    });

    $all('video,source').forEach(el=>{
      const v = el.src || '';
      if (/\/video\/.+\.(?:mp4|tar)(?:\?|$)/i.test(v)) add(v);
      if (/\.(?:m3u8|ts)(?:\?|$)/i.test(v)) add(`__HINT__${v}`);
    });

    const reDL = /https?:\/\/[^\s"'<>]+\/video\/[^\s"'<>]+\.(?:mp4|tar)\b[^\s"'<>]*/gi;
    const reE  = /https?:\/\/rumble\.com\/embedJS\/[^\s"'<>]+/gi;
    const reH  = /https?:\/\/[^\s"'<>]+\.(?:m3u8|ts)\b[^\s"'<>]*/gi;
    for (const s of $all('script')) {
      const text = (s.textContent||'').slice(0, 300000);
      let m; while ((m=reDL.exec(text))) add(m[0]);
      let e; while ((e=reE.exec(text))) embedSeen.add(e[0]);
      let h; while ((h=reH.exec(text))) add(`__HINT__${h[0]}`);
      const m2 = text.match(/r_file=([^\s"'&]+)/);
      if (m2 && m2[1]) add(`__HINT__${m2[1]}`);
    }

    const html = document.documentElement.outerHTML.slice(0, 1500000);
    let m; const re2=/https?:\/\/[^\s"'<>]+\/video\/[^\s"'<>]+\.(?:mp4|tar)\b[^\s"'<>]*/gi;
    while ((m=re2.exec(html))) add(m[0]);
    let e; const re2E=/https?:\/\/rumble\.com\/embedJS\/[^\s"'<>]+/gi;
    while ((e=re2E.exec(html))) embedSeen.add(e[0]);
    let h; const re2H=/https?:\/\/[^\s"'<>]+\.(?:m3u8|ts)\b[^\s"'<>]*/gi;
    while ((h=re2H.exec(html))) add(`__HINT__${h[0]}`);

    for (const u of captured) add(u);
    collectFromLocationParams(out);

    return Array.from(out);
  }

  // ---------------- EmbedJS fetch & parse ----------------
  function fetchEmbedJsonBy(url) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 15000,
        onload: (res) => { try{ if (res.status<200||res.status>=400) return resolve(null); resolve(JSON.parse(res.responseText)); }catch{ resolve(null); } },
        onerror: ()=>resolve(null), ontimeout: ()=>resolve(null)
      });
    });
  }
  async function fetchEmbedCandidatesByVideoId(vid) {
    const urls = new Set();
    for (const build of EMBED_VARIANTS) urls.add(build({ v: vid, dref: 'rumble.com' }));
    for (const unit of EMBED_UNITS) urls.add(`https://rumble.com/embedJS/${unit}/?request=video&v=${encodeURIComponent(vid)}`);
    const outs = [];
    for (const url of urls) {
      const j = await fetchEmbedJsonBy(url);
      if (j) outs.push(j);
    }
    return outs;
  }
  function collectFromEmbedJson(json, sink) {
    const add = (u)=>{ if (u && /\/video\/.+\.(?:mp4|tar)\b/i.test(u)) sink.add(u); };
    try {
      if (json.u) { add(json.u.tar?.url); add(json.u.timeline?.url); }
      if (json.ua) {
        for (const group of Object.values(json.ua)) {
          if (group && typeof group === 'object') {
            for (const k of Object.keys(group)) add(group[k]?.url);
          } else if (typeof group === 'string') add(group);
        }
      }
      if (json.i && /\/video\//.test(json.i)) sink.add(`__IMG__${json.i}`);
    } catch {}
  }
  async function harvestUrlsFromEmbedAll() {
    const out = new Set();
    for (const e of Array.from(embedSeen)) {
      const j = await fetchEmbedJsonBy(e);
      if (j) collectFromEmbedJson(j, out);
    }
    const vid = getVideoId();
    if (vid) {
      for (const j of await fetchEmbedCandidatesByVideoId(vid)) collectFromEmbedJson(j, out);
    }
    return Array.from(out);
  }

  // ---------------- Base derivation ----------------
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
    const triesLive = parts.isLive===null ? [true,false] : [!!parts.isLive];
    const out = [];
    for (const live of triesLive) {
      for (const t of TOKENS) {
        const cap = t[0].toUpperCase()+t.slice(1);
        out.push({ url: buildCdnUrl(pathPart, baseId, t,   'tar', live), type:'tar', labelToken: t, caseVariant:'lower', origin:'generated', pri: (live?1:3) });
        out.push({ url: buildCdnUrl(pathPart, baseId, cap, 'tar', live), type:'tar', labelToken: t, caseVariant:'cap',   origin:'generated', pri: (live?1:3) });
        if (!live) {
          out.push({ url: buildCdnUrl(pathPart, baseId, t,   'mp4', false), type:'mp4', labelToken: t, caseVariant:'lower', origin:'generated', pri: 2 });
          out.push({ url: buildCdnUrl(pathPart, baseId, cap, 'mp4', false), type:'mp4', labelToken: t, caseVariant:'cap',   origin:'generated', pri: 2 });
        }
      }
    }
    out.sort((a,b)=> a.pri-b.pri || tokenRank(b.labelToken)-tokenRank(a.labelToken) || (a.caseVariant==='lower'? -1:1));
    return out;
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
    .rud-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; transition: background .2s; }
    .rud-item + .rud-item { margin-top: 4px; }
    .rud-item:hover { background: var(--rud-bg-secondary); }
    .rud-item-res { font-weight: 700; font-size: 15px; color: var(--rud-text-primary); min-width: 60px; }
    .rud-item-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; background: var(--rud-bg-tertiary); color: var(--rud-text-secondary); text-transform: uppercase; }
    .rud-item-size { font-size: 14px; color: var(--rud-text-muted); font-family: var(--rud-font-mono); margin-left: auto; }
    .rud-item-actions { display: flex; gap: 8px; margin-left: 16px; }
    .rud-item-actions a, .rud-item-actions button { display: flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 6px; transition: all .2s; }
    .rud-item-actions .rud-copy-btn { background: var(--rud-bg-tertiary); color: var(--rud-text-secondary); border: 1px solid var(--rud-border-color); cursor: pointer; }
    .rud-item-actions .rud-copy-btn:hover { background: var(--rud-border-color); color: var(--rud-text-primary); }
    .rud-item-actions .rud-dl-link { background: var(--rud-accent); color: var(--rud-accent-text); border: 1px solid var(--rud-accent); }
    .rud-item-actions .rud-dl-link:hover { background: var(--rud-accent-hover); }
    .rud-item-actions svg { width: 14px; height: 14px; }

    .rud-footer { padding: 12px 16px; border-top: 1px solid var(--rud-border-color); background: var(--rud-bg-secondary); }
    .rud-tar-note { font-size: 12px; color: var(--rud-text-muted); line-height: 1.5; }
    .rud-tar-note strong { color: var(--rud-text-secondary); }

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

  function setButtonProgress(btn, done, total, scanning) {
    const label = btn.querySelector('.rud-btn-label');
    const fill = btn.querySelector('.rud-btn-fill');
    if (scanning) {
      btn.disabled = true;
      const pct = total ? Math.max(1, Math.round((done / total) * 100)) : 1;
      label.textContent = `Scanning ${done}/${total}`;
      fill.style.width = `${pct}%`;
    } else {
      btn.disabled = false;
      label.textContent = 'Download';
      fill.style.width = '0%';
    }
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
                <strong>How to Play TAR files:</strong> 1. Download & Extract the .tar file (e.g., with 7-Zip). 2. Drag the <strong>.m3u8</strong> file into a player like VLC.
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

    async function positionMenu(){
      await raf(()=>{
        const rect = btn.getBoundingClientRect();
        const w = menu.offsetWidth;
        const gap = 8;
        let left = Math.round(rect.left + (rect.width / 2) - (w / 2));
        left = Math.max(16, Math.min(left, window.innerWidth - 16 - w));
        const top = Math.round(rect.bottom + gap);
        menu.style.left = `${left}px`;
        menu.style.top  = `${top}px`;
      });
    }

    async function adjustSpacer(){
      await raf(()=>{
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
    function onEsc(e){ if (e.key === 'Escape') close(); }
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onEsc, { passive: true });

    const reposition = debounce(()=>{ if (menu.classList.contains('open')) { positionMenu(); adjustSpacer(); } }, 50);
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition, { passive: true });

    async function open(){
      if (!menu.classList.contains('open')) {
        menu.classList.add('open');
        await positionMenu();
        await adjustSpacer();
      }
    }
    async function close(){
      if (menu.classList.contains('open')) {
        menu.classList.remove('open');
        await adjustSpacer();
      }
    }
    async function toggle(){
      const isOpen = menu.classList.contains('open');
      if (isOpen) {
        await close();
      } else {
        await open();
      }
    }

    async function setStatus(text) { refs().statusEl.textContent = text; await positionMenu(); await adjustSpacer(); }
    async function setStatusMuted(text) {
      refs().statusEl.innerHTML = `<span class="muted">${String(text).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))}</span>`;
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
    function addOrUpdate(label, type, url, size) {
      if (!label) return;
      const r = refs();
      const key = `${label.toLowerCase()}|${type}`;
      const title = getVideoTitle();
      const fname = filenameWithExt(title, label, url);

      if (byKey.has(key)) {
        const existing = byKey.get(key);
        if ((size||0) > (existing.size||0)) {
          existing.size = size;
          existing.url = url;
          const dlLink = existing.node.querySelector('.rud-dl-link');
          dlLink.href = url;
          dlLink.setAttribute('download', fname);
          const copyBtn = existing.node.querySelector('.rud-copy-btn');
          copyBtn.dataset.url = url;
          existing.node.querySelector('.rud-item-size').textContent = formatBytes(size);
        }
        return;
      }
      const item = document.createElement('div');
      item.className = 'rud-item';
      item.dataset.type = type;
      item.innerHTML = `
        <div class="rud-item-res">${label}</div>
        <div class="rud-item-badge">${type}</div>
        <div class="rud-item-size">${formatBytes(size)}</div>
        <div class="rud-item-actions">
          <button type="button" class="rud-copy-btn" data-url="${url}" data-rud-tooltip="Copy Link">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          </button>
          <a href="${url}" target="_blank" rel="noopener" download="${fname}" class="rud-dl-link" data-rud-tooltip="Download File">
             <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          </a>
        </div>`;

      item.querySelector('.rud-copy-btn').addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const urlToCopy = btn.dataset.url;
        GM_setClipboard(urlToCopy);
        const originalTooltip = btn.dataset.rudTooltip;
        btn.dataset.rudTooltip = 'Copied!';
        setTimeout(() => { btn.dataset.rudTooltip = originalTooltip; }, 2000);
      });

      byKey.set(key, { node: item, url, size });

      const rank = tokenRank(extractTokenFromUrl(url) || '');
      let placed = false;
      for (const child of r.listEl.children) {
        const childAnchor = child.querySelector('.rud-dl-link');
        const childRank = tokenRank(extractTokenFromUrl(childAnchor?.href) || '');
        if (rank > childRank) { r.listEl.insertBefore(item, child); placed = true; break; }
      }
      if (!placed) r.listEl.appendChild(item);
      queueMicrotask(()=>{ maybeToggleFooter(); });
    }

    return {
      open, close, toggle,
      setStatus, setStatusMuted,
      clearLists: async ()=>{ const r=refs(); byKey.clear(); r.listEl.innerHTML=''; await hideEmpty(); await maybeToggleFooter(); },
      addOrUpdate, showEmpty, hideEmpty,
      haveAny: ()=> byKey.size > 0,
      ensureVisible: async ()=> { if (!menu.classList.contains('open')) await open(); },
      positionMenu, adjustSpacer
    };
  }

  // ---------------- Collection ----------------
  async function collectAllLinksVerbose() {
    findMediaInDom();
    const ticks = Math.max(1, Math.floor(COLLECTION_GRACE_MS / COLLECTION_TICK_MS));
    for (let i = 1; i <= ticks; i++) { await sleep(COLLECTION_TICK_MS); findMediaInDom(); }
    const embedLinks = await harvestUrlsFromEmbedAll();
    return Array.from(new Set([...findMediaInDom(), ...embedLinks]));
  }

  function deriveParts(allLinks) {
    const tar = allLinks.find(u=>/\.tar(\?|$)/i.test(u));
    const mp4 = allLinks.find(u=>/\.mp4(\?|$)/i.test(u));
    let parts = null;
    if (tar) parts = parseFromTarUrl(tar);
    if (!parts && mp4) parts = parseFromMp4Url(mp4);
    if (!parts) {
      const img = allLinks.find(u=>/^__IMG__https?:\/\//.test(u));
      if (img) {
        const parsed = parseFromImageUrl(img.replace(/^__IMG__/, ''));
        if (parsed) parts = parsed;
      }
    }
    return parts;
  }

  // ---------------- Probe (fast) ----------------
  async function probeTargetsFast(targets, menuApi, btn) {
    const probedUrls = new Set(), satisfied = new Set();
    let done = 0, okCount = 0;
    const total = targets.length;
    await menuApi.setStatus(`Scanning 0/${total}`);
    setButtonProgress(btn, 0, total, true);

    let lastStatusTick = 0;
    async function updateStatus() {
      const now = Date.now();
      if (now - lastStatusTick > 80) {
        lastStatusTick = now;
        await menuApi.setStatus(`Scanning ${done}/${total} candidates...`);
        setButtonProgress(btn, done, total, true);
      }
    }

    const queue = targets.slice();

    async function worker() {
      while (true) {
        const t = queue.shift();
        if (!t) break;
        const tok = (t.labelToken || extractTokenFromUrl(t.url) || '').toLowerCase();
        const label = tokenToLabel(tok) || 'detected';
        const keyQT = `${tok}|${t.type}`;
        if (satisfied.has(keyQT) || probedUrls.has(t.url)) {
          done++; await updateStatus(); continue;
        }
        probedUrls.add(t.url);
        let pr = await probeUrl(t.url);
        if (!pr.ok && t.origin === 'generated' && t.caseVariant) {
          const swapped = t.caseVariant === 'lower'
            ? t.url.replace(/\.([a-z])([a-z]{2})(\.)/i, (_, a, b, dot)=> `.${a.toUpperCase()}${b}${dot}`)
            : t.url.replace(/\.([A-Z])([a-z]{2})(\.)/, (_, a, b, dot)=> `.${a.toLowerCase()}${b}${dot}`);
          if (swapped !== t.url && !probedUrls.has(swapped)) {
            probedUrls.add(swapped);
            const pr2 = await probeUrl(swapped);
            if (pr2.ok) { t.url = swapped; pr = pr2; }
          }
        }
        done++;
        if (pr.ok) { okCount++; menuApi.addOrUpdate(label, t.type, t.url, pr.size); satisfied.add(keyQT); }
        await updateStatus();
        await sleep(0);
      }
    }

    const workers = Array.from({ length: Math.min(PROBE_CONCURRENCY, total) }, worker);
    await Promise.all(workers);
    return okCount;
  }

  // ---------------- Main click ----------------
  async function onDownloadClick(btn) {
    const menuApi = createMenu(btn);
    await menuApi.hideEmpty();
    await menuApi.ensureVisible();
    await menuApi.setStatusMuted('Preparing to scan...');
    await sleep(0);
    try {
      setButtonProgress(btn, 0, 0, true);
      const all = await collectAllLinksVerbose();
      await menuApi.setStatus(`Collected ${all.length} potential link(s)`);

      const parts = deriveParts(all);
      if (parts) await menuApi.setStatusMuted('Base video identified, generating candidates...');
      else await menuApi.setStatusMuted('No base found, probing collected links...');

      const directRaw = all.filter(u => /\/video\/.+\.(?:mp4|tar)\b/i.test(u));
      const direct = [];
      const seenDirect = new Set();
      for (const u of directRaw) {
        if (seenDirect.has(u)) continue;
        seenDirect.add(u);
        const tok = extractTokenFromUrl(u);
        if ((tok||'').toLowerCase() !== 'faa') direct.push({ url: u, type: typeFromUrl(u), labelToken: (tok||'').toLowerCase(), origin: 'direct', pri: (hostScore(u)===2?0:4) });
      }

      let generated = parts ? generateCandidates(parts).map(c => ({...c, labelToken: (c.labelToken||'').toLowerCase()})) : [];

      const rawTargets = [...direct, ...generated];
      rawTargets.sort((a,b)=> a.pri-b.pri || tokenRank(b.labelToken)-tokenRank(a.labelToken) || (hostScore(b.url)-hostScore(a.url)));
      const targets = [];
      const seen = new Set();
      for (const t of rawTargets) {
        if (t && t.url && !seen.has(t.url)) { seen.add(t.url); targets.push(t); }
      }

      await menuApi.clearLists();

      if (!targets.length) {
        setButtonProgress(btn, 0, 0, false);
        await menuApi.showEmpty('No candidates to probe.<br>Try playing or seeking the video, then click Download again.');
        return;
      }

      const ok = await probeTargetsFast(targets, menuApi, btn);
      if (!ok) {
        await menuApi.showEmpty('No verified downloads were found.');
      } else {
        await menuApi.setStatus(`Found ${ok} unique download option(s)`);
      }

      setButtonProgress(btn, 0, 0, false);
      await menuApi.ensureVisible();
    } catch (e) {
      console.error("Rumble Downloader Error:", e);
      await menuApi.showEmpty(`An unexpected error occurred:<br>${e && (e.message || e)}`);
      setButtonProgress(btn, 0, 0, false);
    }
  }

  // ---------------- Mount button ----------------
  function mountButton() {
    if (!isVideoPage() || document.getElementById('rud-download-btn')) return;
    for (const sel of ACTION_BAR_SELECTORS) {
      const container = $(sel);
      if (container) {
        const btn = createButton();
        btn.addEventListener('click', (ev)=>{
          ev.stopPropagation();
          const menuApi = createMenu(btn);
          if (menuApi.haveAny() && !btn.disabled) {
            menuApi.toggle();
          } else {
            onDownloadClick(btn);
          }
        }, { passive: true });
        const wrap = document.createElement('span');
        wrap.className = 'rud-inline-wrap';
        container.prepend(wrap);
        wrap.appendChild(btn);
        return;
      }
    }
  }

  const routeObs = new MutationObserver(debounce(()=>{ mountButton(); }, 200));
  routeObs.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButton, { passive: true });
  else mountButton();

  window.addEventListener('error', (ev)=>{
    const menu = document.querySelector('#rud-portal .rud-panel');
    if (menu) {
      const statusEl = menu.querySelector('.rud-status');
      if (statusEl) statusEl.textContent = `Page Error: ${ev.message || ev.error || 'unknown'}`;
    }
  }, { passive: true });

})();