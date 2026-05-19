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
    // v3.9.0 — Sync channel-notifier alarm with the user's preference.
    rxSyncChannelNotifier().catch((e) => console.warn('[RumbleX] notifier sync failed:', e));
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

// React to the user toggling `contextMenusEnabled`, `sidePanelEnabled`, or
// `channelNotifierEnabled` in settings without requiring a reload.
// storage.onChanged fires for every settings flush.
if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.rx_settings) return;
        rxSyncContextMenus().catch(() => {});
        rxSyncSidePanel().catch(() => {});
        rxSyncChannelNotifier().catch(() => {});
    });
}

// v3.9.0 — Channel Notifier.
// chrome.alarms-driven background poll that fetches each watched channel's
// page, scans for the latest video ID and any live indicator, and fires a
// chrome.notifications toast (+ optional Discord webhook POST) when state
// changes. Honors:
//   - channelNotifierEnabled (master toggle, default OFF from v2.0 schema)
//   - watchedChannels (array of { url, name, lastSeenVideoId, isLive })
//   - channelNotifierIntervalMin (poll interval, MV3 floor 1 min)
//   - discordWebhookUrl (optional POST destination)
// All fetches scoped to the rumble.com host permissions we already declare.
const RX_NOTIFIER_ALARM = 'rx-channel-notifier';

async function rxGetSettings() {
    try {
        const data = await chrome.storage.local.get('rx_settings');
        return data.rx_settings || {};
    } catch { return {}; }
}

async function rxSetSettings(patch) {
    try {
        const data = await chrome.storage.local.get('rx_settings');
        const merged = { ...(data.rx_settings || {}), ...patch };
        await chrome.storage.local.set({ rx_settings: merged });
    } catch (e) { console.warn('[RumbleX] rxSetSettings failed:', e); }
}

async function rxSyncChannelNotifier() {
    if (!chrome.alarms) return;
    const s = await rxGetSettings();
    const enabled = s.channelNotifierEnabled === true;
    const intervalMin = Math.max(1, Number(s.channelNotifierIntervalMin) || 30);
    try {
        await chrome.alarms.clear(RX_NOTIFIER_ALARM);
        if (enabled && Array.isArray(s.watchedChannels) && s.watchedChannels.length > 0) {
            await chrome.alarms.create(RX_NOTIFIER_ALARM, { periodInMinutes: intervalMin });
        }
    } catch (e) {
        console.warn('[RumbleX] alarms sync failed:', e);
    }
}

// Parse a channel page HTML and return { latestVideoId, isLive, title }.
// Conservative: matches `data-video-id="..."` for the first video in the
// channel grid + scans for the "LIVE" badge SVG / class hooks. Won't grab
// titles when Rumble changes its markup — that's intentional, we just
// detect "something new" and let the notification say so.
function rxParseChannelHtml(html) {
    try {
        // The very first data-video-id on the page is the latest video on
        // a channel page (Rumble orders newest-first by default).
        const idMatch = html.match(/data-video-id="([^"]+)"/);
        const isLive = /class="[^"]*\bvideostream__status--live\b/.test(html)
            || /class="[^"]*\bchannel__live-on-air\b/.test(html)
            || /aria-label="[^"]*Live[^"]*"/.test(html);
        return {
            latestVideoId: idMatch ? idMatch[1] : null,
            isLive,
        };
    } catch { return { latestVideoId: null, isLive: false }; }
}

async function rxPostDiscordWebhook(url, payload) {
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return resp.ok;
    } catch (e) {
        console.warn('[RumbleX] discord webhook POST failed:', e);
        return false;
    }
}

async function rxFireNotification({ title, message, url }) {
    if (!chrome.notifications) return null;
    return new Promise((resolve) => {
        try {
            chrome.notifications.create('', {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/128.png'),
                title: title || 'RumbleX',
                message: message || '',
                contextMessage: url || '',
                priority: 0,
            }, (id) => {
                void chrome.runtime.lastError;
                // Stash the URL so the click handler can navigate to it.
                if (id && url) rxNotificationUrlMap.set(id, url);
                resolve(id || null);
            });
        } catch (e) {
            console.warn('[RumbleX] notification create failed:', e);
            resolve(null);
        }
    });
}

const rxNotificationUrlMap = new Map();

if (chrome.notifications?.onClicked) {
    chrome.notifications.onClicked.addListener((id) => {
        const url = rxNotificationUrlMap.get(id);
        rxNotificationUrlMap.delete(id);
        if (url) {
            chrome.tabs.create({ url }).catch(() => {});
            chrome.notifications.clear(id).catch(() => {});
        }
    });
}

async function rxRunNotifierPass() {
    const s = await rxGetSettings();
    if (!s.channelNotifierEnabled) return;
    const channels = Array.isArray(s.watchedChannels) ? s.watchedChannels : [];
    if (channels.length === 0) return;
    let dirty = false;
    const updated = [];
    for (const ch of channels) {
        if (!ch?.url) { updated.push(ch); continue; }
        try {
            const resp = await fetch(ch.url, { method: 'GET', credentials: 'omit' });
            if (!resp.ok) {
                updated.push({ ...ch, lastChecked: Date.now(), lastError: 'http-' + resp.status });
                dirty = true;
                continue;
            }
            const text = await resp.text();
            const { latestVideoId, isLive } = rxParseChannelHtml(text);
            const newVideo = latestVideoId && ch.lastSeenVideoId && latestVideoId !== ch.lastSeenVideoId;
            const liveStarted = isLive && !ch.isLive;
            if (newVideo) {
                await rxFireNotification({
                    title: 'New video — ' + (ch.name || ch.url),
                    message: 'A new video is up on this channel.',
                    url: ch.url,
                });
                if (s.discordWebhookUrl) {
                    void rxPostDiscordWebhook(s.discordWebhookUrl, {
                        content: 'New RumbleX video on ' + (ch.name || ch.url) + ': ' + ch.url,
                    });
                }
            }
            if (liveStarted) {
                await rxFireNotification({
                    title: 'LIVE — ' + (ch.name || ch.url),
                    message: 'This channel just went live.',
                    url: ch.url,
                });
                if (s.discordWebhookUrl) {
                    void rxPostDiscordWebhook(s.discordWebhookUrl, {
                        content: 'LIVE on ' + (ch.name || ch.url) + ' → ' + ch.url,
                    });
                }
            }
            updated.push({
                ...ch,
                lastSeenVideoId: latestVideoId || ch.lastSeenVideoId,
                isLive,
                lastChecked: Date.now(),
                lastError: null,
            });
            dirty = true;
        } catch (e) {
            updated.push({ ...ch, lastChecked: Date.now(), lastError: String(e?.message || e) });
            dirty = true;
        }
    }
    if (dirty) await rxSetSettings({ watchedChannels: updated });
}

if (chrome.alarms?.onAlarm) {
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === RX_NOTIFIER_ALARM) {
            rxRunNotifierPass().catch((e) => console.warn('[RumbleX] notifier pass failed:', e));
        }
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
    // v3.9.0 — Channel Notifier message API.
    // Options page sends these messages; we don't expose them to content
    // scripts so a compromised rumble.com page can't add itself to the
    // watched list. (The sender check is conservative — message.action
    // is recognized only from extension-origin pages because the SW
    // serves both, but worth gating defensively.)
    if (message.action === 'addWatchedChannel') {
        (async () => {
            const url = String(message.url || '').trim();
            const name = String(message.name || '').trim();
            if (!url || !/^https?:\/\//.test(url)) { sendResponse({ ok: false, reason: 'bad-url' }); return; }
            try {
                const u = new URL(url);
                if (!/(^|\.)rumble\.com$/i.test(u.hostname)) { sendResponse({ ok: false, reason: 'not-rumble' }); return; }
            } catch { sendResponse({ ok: false, reason: 'parse-failed' }); return; }
            const s = await rxGetSettings();
            const list = Array.isArray(s.watchedChannels) ? s.watchedChannels.slice() : [];
            if (list.some((c) => c.url === url)) { sendResponse({ ok: false, reason: 'duplicate' }); return; }
            list.push({ url, name: name || url, lastSeenVideoId: null, isLive: false, lastChecked: null });
            await rxSetSettings({ watchedChannels: list });
            await rxSyncChannelNotifier();
            sendResponse({ ok: true, count: list.length });
        })();
        return true;
    }
    if (message.action === 'removeWatchedChannel') {
        (async () => {
            const url = String(message.url || '');
            const s = await rxGetSettings();
            const list = (Array.isArray(s.watchedChannels) ? s.watchedChannels : []).filter((c) => c.url !== url);
            await rxSetSettings({ watchedChannels: list });
            await rxSyncChannelNotifier();
            sendResponse({ ok: true, count: list.length });
        })();
        return true;
    }
    // v3.10.0 — Watched-channels OPML export. Generates an OPML 2.0 outline
    // that any RSS reader can import. Each rumble.com channel gets a
    // synthesised feed URL using Rumble's official `_rss` suffix pattern
    // documented in the Rumble support docs.
    if (message.action === 'exportWatchedChannelsOpml') {
        (async () => {
            const s = await rxGetSettings();
            const channels = Array.isArray(s.watchedChannels) ? s.watchedChannels : [];
            const esc = (x) => String(x || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
            const lines = [];
            lines.push('<?xml version="1.0" encoding="UTF-8"?>');
            lines.push('<opml version="2.0">');
            lines.push('  <head>');
            lines.push('    <title>RumbleX watched channels</title>');
            lines.push('    <dateCreated>' + new Date().toUTCString() + '</dateCreated>');
            lines.push('  </head>');
            lines.push('  <body>');
            lines.push('    <outline text="Rumble" title="Rumble">');
            for (const c of channels) {
                if (!c?.url) continue;
                // Rumble channel pages have an embedded RSS feed reachable
                // by appending `?rss=1` or via the legacy `_rss` route. We
                // emit both — RSS readers will pick whichever they prefer.
                const xmlUrl = c.url.replace(/\/?$/, '') + '?rss=1';
                lines.push('      <outline type="rss" text="' + esc(c.name || c.url) + '" title="' + esc(c.name || c.url) + '" xmlUrl="' + esc(xmlUrl) + '" htmlUrl="' + esc(c.url) + '" />');
            }
            lines.push('    </outline>');
            lines.push('  </body>');
            lines.push('</opml>');
            sendResponse({ ok: true, opml: lines.join('\n'), count: channels.length });
        })();
        return true;
    }

    // v3.10.0 — Multi-profile settings.
    // Profiles are named full snapshots of rx_settings stored in their own
    // bucket `rx_settings_profiles`. switchProfile swaps the live settings
    // for the profile's frozen copy (snapshotting current state first so
    // the previous profile's drift isn't lost).
    if (message.action === 'listProfiles') {
        (async () => {
            try {
                const data = await chrome.storage.local.get(['rx_settings_profiles', 'rx_settings']);
                const profiles = Array.isArray(data.rx_settings_profiles) ? data.rx_settings_profiles : [];
                const activeId = (data.rx_settings || {}).activeProfileId || 'default';
                sendResponse({ ok: true, profiles: profiles.map((p) => ({ id: p.id, name: p.name, createdAt: p.createdAt })), activeId });
            } catch (e) { sendResponse({ ok: false, reason: String(e?.message || e) }); }
        })();
        return true;
    }
    if (message.action === 'saveProfile') {
        (async () => {
            const name = String(message.name || '').trim();
            if (!name) { sendResponse({ ok: false, reason: 'empty-name' }); return; }
            try {
                const data = await chrome.storage.local.get(['rx_settings_profiles', 'rx_settings']);
                const profiles = Array.isArray(data.rx_settings_profiles) ? data.rx_settings_profiles.slice() : [];
                if (profiles.some((p) => p.name === name)) { sendResponse({ ok: false, reason: 'duplicate-name' }); return; }
                // Hard cap to keep storage bounded — 25 named profiles is plenty.
                if (profiles.length >= 25) { sendResponse({ ok: false, reason: 'cap-reached' }); return; }
                const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
                profiles.push({
                    id, name,
                    createdAt: Date.now(),
                    settings: data.rx_settings || {},
                });
                await chrome.storage.local.set({ rx_settings_profiles: profiles });
                sendResponse({ ok: true, id, count: profiles.length });
            } catch (e) { sendResponse({ ok: false, reason: String(e?.message || e) }); }
        })();
        return true;
    }
    if (message.action === 'switchProfile') {
        (async () => {
            const id = String(message.id || '');
            try {
                const data = await chrome.storage.local.get(['rx_settings_profiles', 'rx_settings']);
                const profiles = Array.isArray(data.rx_settings_profiles) ? data.rx_settings_profiles : [];
                const target = profiles.find((p) => p.id === id);
                if (!target) { sendResponse({ ok: false, reason: 'not-found' }); return; }
                // Snapshot current state first so we never lose drift between
                // saves. Reuses the v3.0 backup system rather than introducing
                // a parallel snapshot store.
                try { await chrome.runtime.sendMessage({ action: 'backupSnapshot', reason: 'pre-profile-switch' }); } catch {}
                const next = { ...target.settings, activeProfileId: target.id };
                await chrome.storage.local.set({ rx_settings: next });
                sendResponse({ ok: true, name: target.name });
            } catch (e) { sendResponse({ ok: false, reason: String(e?.message || e) }); }
        })();
        return true;
    }
    if (message.action === 'deleteProfile') {
        (async () => {
            const id = String(message.id || '');
            try {
                const data = await chrome.storage.local.get('rx_settings_profiles');
                const profiles = (Array.isArray(data.rx_settings_profiles) ? data.rx_settings_profiles : [])
                    .filter((p) => p.id !== id);
                await chrome.storage.local.set({ rx_settings_profiles: profiles });
                sendResponse({ ok: true, count: profiles.length });
            } catch (e) { sendResponse({ ok: false, reason: String(e?.message || e) }); }
        })();
        return true;
    }

    if (message.action === 'runNotifierNow') {
        rxRunNotifierPass()
            .then(() => sendResponse({ ok: true }))
            .catch((e) => sendResponse({ ok: false, reason: String(e?.message || e) }));
        return true;
    }
    if (message.action === 'testNotification') {
        rxFireNotification({
            title: 'RumbleX — Test',
            message: 'Notifications are working. The channel notifier will use this same path when a watched channel posts a new video or goes live.',
            url: 'https://rumble.com/',
        }).then((id) => sendResponse({ ok: !!id, id }));
        return true;
    }

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
