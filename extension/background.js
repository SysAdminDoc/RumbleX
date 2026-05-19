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
    // v3.5.0 — Register context-menu items on install/update.
    rxSyncContextMenus().catch((e) => console.warn('[RumbleX] context menu sync failed:', e));
    // v3.7.0 — Sync side-panel behavior with the user's preference.
    rxSyncSidePanel().catch((e) => console.warn('[RumbleX] side panel sync failed:', e));
});

// v3.7.0 — chrome.sidePanel integration.
// When `sidePanelEnabled` is on, clicking the toolbar icon opens the side
// panel instead of the popup. The side panel hosts pages/options.html which
// already has the full settings + snapshot + privacy UI; this gives users a
// persistent panel that survives htmx navigation (popup closes on every
// out-of-popup click). Chrome / Edge only — Firefox MV2 doesn't have the
// API; rxSyncSidePanel becomes a no-op there.
async function rxIsSidePanelEnabled() {
    try {
        const data = await chrome.storage.local.get('rx_settings');
        const s = data.rx_settings || {};
        return s.sidePanelEnabled === true;
    } catch { return false; }
}

async function rxSyncSidePanel() {
    if (!chrome.sidePanel) return;
    const enabled = await rxIsSidePanelEnabled();
    try {
        // setPanelBehavior controls what happens when the toolbar icon is
        // clicked. `openPanelOnActionClick: true` makes the icon open the
        // side panel directly (suppressing the popup). When OFF, Chrome
        // falls back to default_popup from the manifest.
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: enabled });
    } catch (e) {
        console.warn('[RumbleX] sidePanel.setPanelBehavior failed:', e);
    }
}

// v3.5.0 — Context menus.
// Three unambiguous wins:
//   - Copy clean URL  (strips e9s, utm_*, fbclid, etc.)
//   - Copy URL at video timestamp  (only useful on watch pages)
//   - Open RumbleX settings  (page-level entry, always available on Rumble)
// All entries scoped to *://*.rumble.com/* via documentUrlPatterns so they
// never appear on other sites.
const RX_CM_IDS = {
    copyClean: 'rx-copy-clean-url',
    copyAtTime: 'rx-copy-url-at-time',
    openSettings: 'rx-open-settings',
};

async function rxIsContextMenusEnabled() {
    try {
        const data = await chrome.storage.local.get('rx_settings');
        const s = data.rx_settings || {};
        // Default ON when key missing — matches Settings._defaults.
        return s.contextMenusEnabled !== false;
    } catch { return true; }
}

async function rxSyncContextMenus() {
    if (!chrome.contextMenus) return;
    await new Promise((res) => chrome.contextMenus.removeAll(() => res()));
    if (!(await rxIsContextMenusEnabled())) return;
    const docPatterns = ['*://rumble.com/*', '*://*.rumble.com/*'];
    chrome.contextMenus.create({
        id: RX_CM_IDS.copyClean,
        title: 'Copy clean URL (strip tracking)',
        contexts: ['link', 'page'],
        documentUrlPatterns: docPatterns,
        // Link context already filters by target; page context lets the
        // user copy the current page URL when right-clicking blank space.
    });
    chrome.contextMenus.create({
        id: RX_CM_IDS.copyAtTime,
        title: 'Copy URL at current time',
        contexts: ['page', 'video'],
        documentUrlPatterns: docPatterns,
    });
    chrome.contextMenus.create({
        id: RX_CM_IDS.openSettings,
        title: 'Open RumbleX settings',
        contexts: ['page', 'action'],
        documentUrlPatterns: docPatterns,
    });
}

// React to the user toggling `contextMenusEnabled` or `sidePanelEnabled` in
// settings without requiring a reload. storage.onChanged fires for every
// settings flush.
if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.rx_settings) return;
        rxSyncContextMenus().catch(() => {});
        rxSyncSidePanel().catch(() => {});
    });
}

// Allowlist of tracking params to strip — kept in sync with content.js
// StripTrackingParams. Duplicated here because the SW handles the link-
// context case where the user right-clicked a link (whose URL the content
// script never saw).
const RX_CM_TRACKING_PARAMS = new Set([
    'e9s', 'ref', 'referrer', 'src',
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'campaign', 'mtm_source', 'mtm_medium', 'mtm_campaign',
    'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid', '_ga', 'yclid',
]);

function rxStripTrackingFromUrl(href) {
    try {
        const u = new URL(href);
        if (!/(^|\.)rumble\.com$/i.test(u.hostname)) return href;
        for (const k of [...u.searchParams.keys()]) {
            if (RX_CM_TRACKING_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
        }
        return u.toString();
    } catch { return href; }
}

async function rxCopyToActiveTab(tabId, text) {
    // Service workers can't access navigator.clipboard reliably; the only
    // safe path is to inject a tiny copy script into the content tab.
    if (!chrome.scripting || typeof tabId !== 'number') return false;
    try {
        const [res] = await chrome.scripting.executeScript({
            target: { tabId },
            func: (t) => {
                try { navigator.clipboard.writeText(t); return true; }
                catch {
                    // Fallback: legacy execCommand via a temporary textarea.
                    const ta = document.createElement('textarea');
                    ta.value = t;
                    ta.style.position = 'fixed';
                    ta.style.top = '-10000px';
                    document.body.appendChild(ta);
                    ta.select();
                    try { return document.execCommand('copy'); }
                    finally { ta.remove(); }
                }
            },
            args: [text],
        });
        return !!(res && res.result);
    } catch (e) {
        console.warn('[RumbleX] copy script injection failed:', e);
        return false;
    }
}

if (chrome.contextMenus) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        if (!tab || typeof tab.id !== 'number') return;
        const tabId = tab.id;
        switch (info.menuItemId) {
            case RX_CM_IDS.copyClean: {
                const target = info.linkUrl || info.pageUrl || tab.url || '';
                const cleaned = rxStripTrackingFromUrl(target);
                await rxCopyToActiveTab(tabId, cleaned);
                return;
            }
            case RX_CM_IDS.copyAtTime: {
                // Ask the content script for the current video time + clean URL.
                chrome.tabs.sendMessage(tabId, { action: 'getVideoStateAtTime' }, async (resp) => {
                    void chrome.runtime.lastError;
                    if (!resp?.ok) {
                        // Fall back to the plain clean URL if there's no
                        // video on the page (e.g. user right-clicked on
                        // a feed/home/channel page).
                        await rxCopyToActiveTab(tabId, rxStripTrackingFromUrl(tab.url || ''));
                        return;
                    }
                    let out = resp.cleanUrl || tab.url || '';
                    if (resp.isWatch && Number.isFinite(resp.currentTime) && resp.currentTime > 0) {
                        try {
                            const u = new URL(out);
                            // Rumble's native timestamp param is `start`,
                            // per their share modal and existing v1.x
                            // shareTimestamp module. Stay consistent.
                            u.searchParams.set('start', String(resp.currentTime));
                            out = u.toString();
                        } catch {}
                    }
                    await rxCopyToActiveTab(tabId, out);
                });
                return;
            }
            case RX_CM_IDS.openSettings: {
                try {
                    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
                } catch (e) { console.warn('[RumbleX] openOptionsPage failed:', e); }
                return;
            }
        }
    });
}

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
    // v3.6.0 — Group all open Rumble tabs into a single colored tab group.
    // Chrome-only (tabGroups API not in Firefox/MV2). Returns { ok, count,
    // groupId } on success or { ok: false, reason } on failure. Popup
    // invokes via `groupRumbleTabs` message.
    if (message.action === 'groupRumbleTabs') {
        (async () => {
            if (!chrome.tabs?.group || !chrome.tabGroups) {
                sendResponse({ ok: false, reason: 'no-tabgroups-api' });
                return;
            }
            try {
                const tabs = await chrome.tabs.query({ url: ['*://rumble.com/*', '*://*.rumble.com/*'] });
                const tabIds = (tabs || []).filter((t) => typeof t.id === 'number').map((t) => t.id);
                if (tabIds.length === 0) {
                    sendResponse({ ok: false, reason: 'no-rumble-tabs' });
                    return;
                }
                const groupId = await chrome.tabs.group({ tabIds });
                await chrome.tabGroups.update(groupId, {
                    title: 'Rumble',
                    color: 'green',
                    collapsed: false,
                });
                sendResponse({ ok: true, count: tabIds.length, groupId });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true;
    }

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
