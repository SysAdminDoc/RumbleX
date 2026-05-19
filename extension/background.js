// RumbleX v3.2.0 - Background Service Worker
'use strict';

// Guard rails for download URLs accepted from the content script. We trust
// the content script because it can only be injected on rumble.com, but we
// still refuse downloads targeting unrelated hosts so a compromised page
// can't turn the extension into a general file grabber.
const ALLOWED_DOWNLOAD_HOSTS = [
    'rumble.com',
    '1a-1791.com',
    'rumble.cloud',
];

// v3.2.0 — Offscreen document lifecycle.
// MV3 service workers can't touch the DOM (no DOMParser, no Blob URL creation
// in many shapes, no WebRTC). We spin a single offscreen document with
// reasons DOM_PARSER + BLOBS + WORKERS and reuse it across requests. Chrome
// API enforces one offscreen doc per extension per profile so we don't fight
// the runtime — `hasDocument()` is the contract.
const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');

async function ensureOffscreenDocument() {
    if (!chrome.offscreen) return false; // older Chrome / Firefox MV2 — caller falls back
    try {
        const has = await chrome.offscreen.hasDocument();
        if (has) return true;
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['DOM_PARSER', 'BLOBS', 'WORKERS'],
            justification: 'Parse HTML probe results, hash media blobs, and host long-running download work that the service worker cannot do alone.',
        });
        return true;
    } catch (e) {
        // Swallow — caller falls back to in-content-script processing.
        console.warn('[RumbleX] ensureOffscreenDocument failed:', e);
        return false;
    }
}

async function callOffscreen(action, payload) {
    const ok = await ensureOffscreenDocument();
    if (!ok) return { ok: false, reason: 'no-offscreen' };
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ target: 'offscreen', action, ...payload }, (resp) => {
                void chrome.runtime.lastError;
                resolve(resp || { ok: false, reason: 'no-response' });
            });
        } catch (e) {
            resolve({ ok: false, reason: String(e?.message || e) });
        }
    });
}

function isAllowedDownloadUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
        const host = u.hostname.toLowerCase();
        return ALLOWED_DOWNLOAD_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    } catch {
        return false;
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('[RumbleX] Extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Pass-through reads — kept for parity with earlier versions in case any
    // consumer (popup, options, userscript) still asks the worker for state.
    if (message.action === 'getSettings') {
        chrome.storage.local.get('rx_settings', (data) => {
            sendResponse(data.rx_settings || {});
        });
        return true;
    }

    if (message.action === 'saveSettings') {
        chrome.storage.local.set({ rx_settings: message.data }, () => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.action === 'checkUpdate') {
        const currentVersion = chrome.runtime.getManifest().version;
        fetch('https://api.github.com/repos/SysAdminDoc/RumbleX/releases/latest', {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
        })
            .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
            .then((data) => {
                const latest = (data.tag_name || '').replace(/^v/, '');
                sendResponse({
                    current: currentVersion,
                    latest,
                    url: data.html_url || '',
                    hasUpdate: !!latest && latest !== currentVersion,
                });
            })
            .catch((err) => {
                sendResponse({ error: String(err), current: currentVersion });
            });
        return true;
    }

    if (message.action === 'openSettings') {
        // Shift-click in the popup asks the active tab to open its in-page
        // settings modal. This only works when the active tab is running the
        // RumbleX content script (rumble.com).
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || typeof tab.id !== 'number') {
                sendResponse({ ok: false, reason: 'no active tab' });
                return;
            }
            chrome.tabs.sendMessage(tab.id, { action: 'openSettingsModal' }, () => {
                // chrome.runtime.lastError is set when no receiver (non-Rumble
                // tab). We still need to clear it to avoid console noise.
                const err = chrome.runtime.lastError;
                sendResponse(err
                    ? { ok: false, reason: err.message }
                    : { ok: true }
                );
            });
        });
        return true;
    }

    if (message.action === 'clearLocalData') {
        // Broadcast to every open Rumble tab so each self-clears its own
        // localStorage. The extension origin cannot touch rumble.com's
        // localStorage directly, so this is the only way to actually reset
        // per-site data (watch history, bookmarks, rant archive, etc).
        chrome.tabs.query({ url: ['*://rumble.com/*', '*://*.rumble.com/*'] }, (tabs) => {
            if (!tabs || !tabs.length) { sendResponse({ ok: true, tabs: 0, cleared: 0 }); return; }
            let totalCleared = 0;
            let answered = 0;
            for (const tab of tabs) {
                if (typeof tab.id !== 'number') { answered++; continue; }
                chrome.tabs.sendMessage(tab.id, { action: 'clearLocalData' }, (resp) => {
                    // Swallow lastError (some tabs may not have the CS loaded yet).
                    void chrome.runtime.lastError;
                    if (resp?.ok && typeof resp.cleared === 'number') totalCleared += resp.cleared;
                    answered++;
                    if (answered === tabs.length) sendResponse({ ok: true, tabs: tabs.length, cleared: totalCleared });
                });
            }
        });
        return true;
    }

    if (message.action === 'getLocalData') {
        // Ask the first available Rumble tab for its localStorage payload.
        // We query a single tab (not all) because localStorage is identical
        // per-origin, so multiple tabs would return the same data — wasteful
        // and noisy. If no Rumble tab is open, respond with an empty payload
        // and let the caller proceed with a settings-only export.
        chrome.tabs.query({ url: ['*://rumble.com/*', '*://*.rumble.com/*'] }, (tabs) => {
            const tab = tabs && tabs.find((t) => typeof t.id === 'number');
            if (!tab) { sendResponse({ ok: true, data: {}, tabs: 0 }); return; }
            chrome.tabs.sendMessage(tab.id, { action: 'getLocalData' }, (resp) => {
                void chrome.runtime.lastError;
                sendResponse({
                    ok: true,
                    tabs: tabs.length,
                    data: (resp?.ok && resp.data) ? resp.data : {},
                    keys: resp?.keys || 0,
                });
            });
        });
        return true;
    }

    if (message.action === 'setLocalData') {
        // Push an imported localStorage payload to every open Rumble tab.
        // They're on the same origin so any one write would be observable in
        // all tabs on refresh, but writing to each avoids needing a reload.
        const payload = message.data || {};
        chrome.tabs.query({ url: ['*://rumble.com/*', '*://*.rumble.com/*'] }, (tabs) => {
            if (!tabs || !tabs.length) { sendResponse({ ok: true, tabs: 0, written: 0 }); return; }
            let totalWritten = 0;
            let answered = 0;
            for (const tab of tabs) {
                if (typeof tab.id !== 'number') { answered++; continue; }
                chrome.tabs.sendMessage(tab.id, { action: 'setLocalData', data: payload }, (resp) => {
                    void chrome.runtime.lastError;
                    if (resp?.ok && typeof resp.written === 'number') totalWritten = Math.max(totalWritten, resp.written);
                    answered++;
                    if (answered === tabs.length) sendResponse({ ok: true, tabs: tabs.length, written: totalWritten });
                });
            }
        });
        return true;
    }

    // v3.2.0 — Offscreen proxies. Content scripts cannot create offscreen
    // documents directly; they go through the service worker. Both calls
    // are async and use the keep-channel-open pattern. Falls back to a
    // structured failure response if offscreen is unsupported (Firefox MV2
    // or older Chrome) so the caller can degrade gracefully.
    if (message.action === 'parseHtmlOffscreen') {
        callOffscreen('parseHtml', { html: message.html || '' }).then(sendResponse);
        return true;
    }
    if (message.action === 'hashBlobOffscreen') {
        callOffscreen('hashBlob', { url: message.url || '' }).then(sendResponse);
        return true;
    }

    if (message.action === 'download') {
        const url = message?.data?.url;
        const filename = message?.data?.filename;
        if (!isAllowedDownloadUrl(url)) {
            sendResponse({ error: 'Download URL is not allowed' });
            return true;
        }
        chrome.downloads.download(
            { url, filename, saveAs: true },
            (downloadId) => {
                const err = chrome.runtime.lastError;
                if (err) sendResponse({ error: err.message });
                else sendResponse({ downloadId });
            }
        );
        return true;
    }
});
