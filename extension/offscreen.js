// RumbleX v3.2.0 — Offscreen document
// Runs in the extension origin. Carries DOM access the MV3 service worker
// can't have. Spun up by background.js via chrome.offscreen.createDocument
// with reasons ["DOM_PARSER", "BLOBS", "WORKERS"].
//
// Today this scaffold handles two atomic message actions:
//   - parseHtml: take an HTML string, return structured probe data via DOMParser.
//   - hashBlob: take a URL, fetch as Blob, return its SHA-256 digest.
//
// Both are read-only operations. The full deep-scan probe path will move
// here in v3.3 once Mediabunny replaces mux.js so we can drop the Web Worker
// + offscreen split for one home. For now the live download flows stay in
// content.js + worker.js.
'use strict';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.target !== 'offscreen') return;

    if (msg.action === 'parseHtml') {
        try {
            const doc = new DOMParser().parseFromString(String(msg.html || ''), 'text/html');
            const out = {
                title: doc.title || '',
                metaCount: doc.querySelectorAll('meta').length,
                scriptCount: doc.querySelectorAll('script').length,
                // Extract every <a href> and <video src>/<source src> URL.
                // Caller decides what to do with the list.
                hrefs: Array.from(doc.querySelectorAll('a[href]'), (a) => a.getAttribute('href')).slice(0, 500),
                videoSources: Array.from(doc.querySelectorAll('video[src], video > source[src]'), (el) => el.getAttribute('src')).slice(0, 50),
            };
            sendResponse({ ok: true, parsed: out });
        } catch (e) {
            sendResponse({ ok: false, reason: String(e?.message || e) });
        }
        return true;
    }

    if (msg.action === 'hashBlob') {
        const url = String(msg.url || '');
        if (!url) { sendResponse({ ok: false, reason: 'no-url' }); return true; }
        (async () => {
            try {
                const resp = await fetch(url, { method: 'GET', credentials: 'omit' });
                if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                const buf = await resp.arrayBuffer();
                const digest = await crypto.subtle.digest('SHA-256', buf);
                const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
                sendResponse({ ok: true, sha256: hex, bytes: buf.byteLength });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true; // keep channel open for async sendResponse
    }
});

console.log('[RumbleX offscreen] ready');
