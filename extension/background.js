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
    // v3.18.0 — ensure the archive-queue drain alarm exists across SW restarts.
    rxSyncArchiveAlarm().catch((e) => console.warn('[RumbleX] archive alarm sync failed:', e));
});

// chrome.runtime.onStartup re-registers the alarm if the browser restarted
// (chrome.alarms survive across SW restarts, but only across SW activations,
// not full browser restarts on some platforms — sync is cheap and idempotent).
if (chrome.runtime?.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
        rxSyncArchiveAlarm().catch(() => {});
        rxSyncChannelNotifier().catch(() => {});
    });
}

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
    blockChannel: 'rx-block-channel',
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
    // v3.14.0 — Block-channel entry. Shows up on right-click of any
    // /c/<slug> or /user/<slug> link, or on the watch page itself when
    // right-clicked on the channel link. The slug-extraction logic in the
    // click handler accepts both link context (info.linkUrl) and page
    // context (tab.url for a watch page) and falls through gracefully
    // when neither has a usable /c/ or /user/ path.
    chrome.contextMenus.create({
        id: RX_CM_IDS.blockChannel,
        title: 'Block this channel from feeds',
        contexts: ['link', 'page'],
        documentUrlPatterns: docPatterns,
        targetUrlPatterns: ['*://rumble.com/c/*', '*://rumble.com/user/*', '*://*.rumble.com/c/*', '*://*.rumble.com/user/*'],
    });
    chrome.contextMenus.create({
        id: RX_CM_IDS.openSettings,
        title: 'Open RumbleX settings',
        contexts: ['page', 'action'],
        documentUrlPatterns: docPatterns,
    });
}

// v3.14.0 — Extract the channel slug (`/c/<slug>` or `/user/<slug>`) from
// a URL. Returns the lowercase slug or null. Used by the block-channel
// context-menu entry — ChannelBlocker normalizes lowercase already so we
// match its storage shape exactly.
function rxExtractChannelSlug(href) {
    try {
        const u = new URL(href);
        if (!/(^|\.)rumble\.com$/i.test(u.hostname)) return null;
        const m = u.pathname.match(/^\/(?:c|user)\/([^/?#]+)/);
        return m ? decodeURIComponent(m[1]).toLowerCase() : null;
    } catch { return null; }
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
        if (alarm.name === RX_ARCHIVE_ALARM) {
            rxRunArchiveTick().catch((e) => console.warn('[RumbleX] archive tick failed:', e));
        }
    });
}

// v3.18.0 — Channel Archive Queue. A persistent chrome.storage.local-backed
// job queue that lives across SW restarts. A chrome.alarms tick drains up to
// `downloadConcurrency` pending jobs per minute. Each job:
//   1. SW-fetches https://rumble.com/embedJS/u3/?request=video&v=<embedId>
//      (the same endpoint VideoDownloader uses in content.js).
//   2. Picks the highest-resolution `ua.mp4.*` direct URL.
//   3. Calls chrome.downloads.download() — same path as the manual download.
//   4. Tracks the downloadId; chrome.downloads.onChanged marks the job
//      completed/failed when the download finishes.
// Queue cap: 500 jobs. Completed jobs older than 7 days are auto-pruned on
// each tick.
const RX_ARCHIVE_ALARM = 'rx-archive-tick';
const RX_ARCHIVE_KEY = 'rx_archive_queue';
const RX_ARCHIVE_MAX_JOBS = 500;
const RX_ARCHIVE_COMPLETED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function rxSyncArchiveAlarm() {
    try {
        const existing = await chrome.alarms.get(RX_ARCHIVE_ALARM);
        if (!existing) {
            await chrome.alarms.create(RX_ARCHIVE_ALARM, { periodInMinutes: 1 });
        }
    } catch (e) {
        console.warn('[RumbleX] archive alarm sync failed:', e);
    }
}

async function rxLoadArchiveQueue() {
    try {
        const got = await chrome.storage.local.get([RX_ARCHIVE_KEY]);
        const root = got[RX_ARCHIVE_KEY];
        if (root && typeof root === 'object' && Array.isArray(root.jobs)) return root;
    } catch {}
    return { jobs: [], paused: false, version: 1 };
}

async function rxSaveArchiveQueue(root) {
    try { await chrome.storage.local.set({ [RX_ARCHIVE_KEY]: root }); } catch {}
}

function rxArchiveSanitizeFilename(s) {
    const cleaned = String(s || 'rumble-video')
        .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    return cleaned || 'rumble-video';
}

// v3.24.0 — Subfolder sanitizer. Strips drive letters, leading slashes,
// path separators, parent-traversal segments, and unsafe filename chars.
// Falls back to 'RumbleX' if the cleaned result is empty.
function rxArchiveSanitizeSubfolder(s) {
    let raw = String(s == null ? 'RumbleX' : s);
    // Collapse backslashes to forward slashes for uniform splitting.
    raw = raw.replace(/\\+/g, '/');
    const parts = raw.split('/')
        .map((p) => p.trim())
        // Drop drive letters, parent-segments, and empty/dot pieces.
        .filter((p) => p && p !== '.' && p !== '..' && !/^[a-z]:$/i.test(p))
        .map((p) => p.replace(/[<>:"|?*\u0000-\u001f]+/g, '').replace(/\s+/g, ' ').trim())
        .filter((p) => p);
    const joined = parts.slice(0, 4).join('/').slice(0, 120);
    return joined || 'RumbleX';
}

async function rxDiscoverVideoQuality(videoSlug, maxHeight) {
    // videoSlug is the "v..." prefix from the path. embedJS expects the slug
    // *minus* the leading "v". Existing content.js code does the same strip:
    // `embedId.replace('v', '')` — see line ~2886.
    // maxHeight: number cap (e.g. 1080) or 0 / null for "best".
    const numericId = String(videoSlug || '').replace(/^v/, '');
    if (!numericId) throw new Error('bad-video-id');
    const url = 'https://rumble.com/embedJS/u3/?request=video&ver=2&v=' + encodeURIComponent(numericId);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('embedJS http-' + resp.status);
    const data = await resp.json();
    const src = data.ua || data.u || {};
    const cap = (typeof maxHeight === 'number' && maxHeight > 0) ? maxHeight : Infinity;
    let bestUrl = null;
    let bestHeight = 0;
    let bestLabel = '';
    let title = data.title || data.full_title || data.video?.title || null;
    const consider = (u, h) => {
        if (!u || !(h > 0)) return;
        if (h > cap) return;
        if (h > bestHeight) {
            bestUrl = u;
            bestHeight = h;
            bestLabel = h + 'p';
        }
    };
    for (const fmt of ['mp4', 'webm']) {
        const group = src[fmt];
        if (!group || typeof group !== 'object') continue;
        if (group.url && group.meta?.h > 0) consider(group.url, group.meta.h);
        for (const [, val] of Object.entries(group)) {
            if (!val?.url || !val?.meta?.h) continue;
            consider(val.url, val.meta.h);
        }
    }
    if (!bestUrl) {
        // If a cap is in effect but no quality fit, throw a specific reason so
        // the queue UI can show a useful error instead of a generic miss.
        if (cap !== Infinity) throw new Error('no-direct-mp4-under-' + cap + 'p');
        throw new Error('no-direct-mp4');
    }
    return { url: bestUrl, quality: bestLabel, height: bestHeight, title };
}

async function rxRunArchiveTick() {
    const root = await rxLoadArchiveQueue();
    if (root.paused) return;
    // Auto-prune old completed jobs.
    const now = Date.now();
    const before = root.jobs.length;
    root.jobs = root.jobs.filter((j) => {
        if (j.status !== 'completed') return true;
        return !(j.completedAt && (now - j.completedAt) > RX_ARCHIVE_COMPLETED_TTL_MS);
    });
    if (root.jobs.length !== before) await rxSaveArchiveQueue(root);

    // Honor downloadConcurrency from settings.
    let concurrency = 2;
    try {
        const got = await chrome.storage.local.get(['rx_settings']);
        const s = got.rx_settings || {};
        const n = Number(s.downloadConcurrency);
        if (Number.isFinite(n) && n >= 1 && n <= 8) concurrency = Math.floor(n);
    } catch {}

    const inFlight = root.jobs.filter((j) => j.status === 'discovering' || j.status === 'downloading').length;
    const slots = Math.max(0, concurrency - inFlight);
    if (slots === 0) return;

    const pending = root.jobs.filter((j) => j.status === 'pending').slice(0, slots);
    if (pending.length === 0) return;
    for (const job of pending) job.status = 'discovering';
    await rxSaveArchiveQueue(root);

    await Promise.all(pending.map((job) => rxProcessArchiveJob(job.id).catch((e) => {
        console.warn('[RumbleX] archive job ' + job.id + ' failed:', e);
    })));
}

async function rxUpdateArchiveJob(id, patch) {
    const root = await rxLoadArchiveQueue();
    const idx = root.jobs.findIndex((j) => j.id === id);
    if (idx < 0) return null;
    root.jobs[idx] = { ...root.jobs[idx], ...patch };
    await rxSaveArchiveQueue(root);
    return root.jobs[idx];
}

async function rxProcessArchiveJob(id) {
    const root = await rxLoadArchiveQueue();
    const job = root.jobs.find((j) => j.id === id);
    if (!job) return;
    try {
        // Honor channelArchiveMaxHeight from settings — 'best' / '' / numeric.
        let cap = 0;
        try {
            const got = await chrome.storage.local.get(['rx_settings']);
            const raw = String(got?.rx_settings?.channelArchiveMaxHeight || 'best').toLowerCase();
            if (raw !== 'best' && raw !== '') {
                const n = parseInt(raw, 10);
                if (Number.isFinite(n) && n > 0) cap = n;
            }
        } catch {}
        const discovered = await rxDiscoverVideoQuality(job.videoId, cap);
        const title = job.videoTitle || discovered.title || job.videoId;
        // Subfolder sourced from settings (default 'RumbleX'); sanitized so a
        // malformed user value can't escape the Downloads root.
        let subfolder = 'RumbleX';
        try {
            const got = await chrome.storage.local.get(['rx_settings']);
            subfolder = rxArchiveSanitizeSubfolder(got?.rx_settings?.channelArchiveSubfolder);
        } catch {}
        const filename = subfolder + '/' + rxArchiveSanitizeFilename(title) + '_' + discovered.quality + '.mp4';
        if (!isAllowedDownloadUrl(discovered.url)) {
            await rxUpdateArchiveJob(id, { status: 'failed', error: 'url-not-allowlisted', completedAt: Date.now() });
            return;
        }
        const downloadId = await new Promise((resolve, reject) => {
            chrome.downloads.download(
                { url: discovered.url, filename, saveAs: false, conflictAction: 'uniquify' },
                (dlId) => {
                    const err = chrome.runtime.lastError;
                    if (err) reject(new Error(err.message));
                    else resolve(dlId);
                }
            );
        });
        await rxUpdateArchiveJob(id, {
            status: 'downloading',
            qualityFound: discovered.quality,
            videoTitle: title,
            filename,
            downloadId,
        });
    } catch (e) {
        await rxUpdateArchiveJob(id, {
            status: 'failed',
            error: String(e?.message || e).slice(0, 200),
            completedAt: Date.now(),
        });
    }
}

if (chrome.downloads?.onChanged) {
    chrome.downloads.onChanged.addListener(async (delta) => {
        if (!delta.state) return;
        const newState = delta.state.current;
        if (newState !== 'complete' && newState !== 'interrupted') return;
        const root = await rxLoadArchiveQueue();
        const job = root.jobs.find((j) => j.downloadId === delta.id);
        if (!job) return;
        if (newState === 'complete') {
            await rxUpdateArchiveJob(job.id, { status: 'completed', completedAt: Date.now() });
        } else {
            await rxUpdateArchiveJob(job.id, {
                status: 'failed',
                error: 'download-interrupted',
                completedAt: Date.now(),
            });
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
            case RX_CM_IDS.blockChannel: {
                // Prefer the link target — that's the channel the user
                // right-clicked on. Fall back to the page URL when they
                // right-clicked on a channel page itself.
                const candidate = info.linkUrl || info.pageUrl || tab.url || '';
                const slug = rxExtractChannelSlug(candidate);
                if (!slug) {
                    // The targetUrlPatterns filter on the entry should
                    // prevent this, but guard anyway: a creator's display
                    // name (Killstream) is NOT the channel slug
                    // (KillstreamLive) — extracting from the URL is the
                    // only reliable path.
                    return;
                }
                const s = await rxGetSettings();
                const list = Array.isArray(s.blockedChannels) ? s.blockedChannels.slice() : [];
                if (list.includes(slug)) {
                    // No-op when already blocked. Try to surface via a
                    // page-level toast through the existing in-content
                    // settings panel — only if the user is on a Rumble tab.
                    try {
                        chrome.tabs.sendMessage(tabId, {
                            action: 'rxShowToast',
                            text: `Channel "${slug}" already blocked`,
                        }, () => { void chrome.runtime.lastError; });
                    } catch {}
                    return;
                }
                list.push(slug);
                await rxSetSettings({ blockedChannels: list });
                try {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'rxShowToast',
                        text: `Blocked channel "${slug}" (${list.length} total). Reload feed to apply.`,
                    }, () => { void chrome.runtime.lastError; });
                } catch {}
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
    // v3.13.0 — Import followed channels into the v3.9 watchedChannels list.
    // One-click bulk-add: fetches /account/following with the user's session
    // cookies, parses each <li class="followed-channel"> for URL + name,
    // merges into watchedChannels skipping duplicates. The user's actual
    // followed list becomes the seed for the notifier without a manual
    // per-channel paste.
    //
    // Failure modes the user can see:
    //   - not logged in → page returns login redirect; we extract 0
    //     channels and the toast suggests opening a Rumble tab + signing in
    //   - 0 entries on a logged-in account → fine, toast says so
    //   - fetch error → toast with HTTP status
    // v3.15.0 — Watch History export.
    // Fetches /account/playlists/watch-history with the user's session,
    // parses each <li class="videostream__details" data-video-id="..."> row,
    // returns a structured JSON dump. Rumble doesn't natively offer this.
    //
    // Failure modes:
    //   - not logged in   → page returns logged-out shell with no items
    //   - empty history   → 0-row response, ok:true
    //   - HTTP error      → returned as { ok:false, reason:'http-NNN' }
    if (message.action === 'exportWatchHistory') {
        (async () => {
            try {
                const resp = await fetch('https://rumble.com/account/playlists/watch-history', {
                    method: 'GET', credentials: 'include',
                });
                if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                const html = await resp.text();
                // Guard: the logged-out shell omits videostream__list/details
                // entirely, so we can detect "not logged in" by absence of
                // the watch-history playlist data marker.
                if (!html.includes('data-playlist="watch-history"') && !html.includes('videostream_details')) {
                    sendResponse({ ok: false, reason: 'not-logged-in' });
                    return;
                }
                // Pull each <li class="videostream__details" data-video-id="...">.
                // Tolerate attribute-order variation by anchoring on the class
                // marker, then a non-greedy capture up to </li>.
                const rows = [];
                const re = /<li[^>]*\bvideostream__details\b[^>]*\bdata-video-id="(\d+)"[\s\S]*?<\/li>/g;
                let m;
                while ((m = re.exec(html))) {
                    const block = m[0];
                    const videoId = m[1];
                    const titleMatch = block.match(/<h3[^>]*\bthumbnail__title\b[^>]*title="([^"]*)"/) || block.match(/<h3[^>]*\bthumbnail__title\b[^>]*>([^<]+)/);
                    const urlMatch = block.match(/<a[^>]*videostream__link[^>]*href="([^"]+)"/) || block.match(/<a[^>]*title__link[^>]*href="([^"]+)"/);
                    const durMatch = block.match(/videostream__status--duration[^>]*>\s*([^<]+?)\s*</);
                    const pctMatch = block.match(/--watched-percentage:\s*([\d.]+)%/);
                    const thumbMatch = block.match(/<img[^>]*\bthumbnail__image\b[^>]*src="([^"]+)"/);
                    const channelMatch = block.match(/<a[^>]*\bchannel__link\b[^>]*href="([^"]+)"[^>]*>([^<]+)</);
                    // Clean URL: strip e9s/playlist_id query so the export is
                    // canonical (consistent with v2.4 StripTrackingParams).
                    let cleanUrl = urlMatch ? urlMatch[1] : null;
                    if (cleanUrl) {
                        try {
                            const u = new URL(cleanUrl, 'https://rumble.com');
                            for (const k of ['e9s', 'playlist_id']) u.searchParams.delete(k);
                            cleanUrl = u.toString();
                        } catch {}
                    }
                    rows.push({
                        videoId,
                        title: titleMatch ? titleMatch[1].trim() : null,
                        url: cleanUrl,
                        duration: durMatch ? durMatch[1].trim() : null,
                        watchedPercentage: pctMatch ? Number(pctMatch[1]) : null,
                        thumbnail: thumbMatch ? thumbMatch[1] : null,
                        channelUrl: channelMatch ? channelMatch[1] : null,
                        channelName: channelMatch ? channelMatch[2].trim() : null,
                    });
                }
                sendResponse({
                    ok: true,
                    count: rows.length,
                    exportedAt: new Date().toISOString(),
                    items: rows,
                });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true;
    }

    // v3.17.0 — Encrypted Gist Sync. Push: encrypt rx_settings with a
    // passphrase-derived AES-GCM key, store the ciphertext as a single file
    // in a GitHub gist. Pull: GET the gist, decrypt with the same passphrase.
    // The passphrase is NEVER stored — caller passes it in on every call.
    // host_permissions for api.github.com is declared in manifest.json.
    if (message.action === 'gistSyncPush' || message.action === 'gistSyncPull') {
        (async () => {
            try {
                const stored = await new Promise((resolve) => {
                    chrome.storage.local.get(['rx_settings'], resolve);
                });
                const settings = (stored && stored.rx_settings && typeof stored.rx_settings === 'object') ? stored.rx_settings : {};
                const token = (settings.encryptedGistSyncToken || '').trim();
                const gistId = (settings.encryptedGistSyncId || '').trim();
                const passphrase = (message.passphrase || '').trim();
                if (!token) { sendResponse({ ok: false, reason: 'missing-token' }); return; }
                if (!passphrase || passphrase.length < 8) { sendResponse({ ok: false, reason: 'weak-passphrase' }); return; }

                const enc = new TextEncoder();
                const dec = new TextDecoder();
                const baseKey = await crypto.subtle.importKey(
                    'raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
                );

                const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
                const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

                if (message.action === 'gistSyncPush') {
                    const salt = crypto.getRandomValues(new Uint8Array(16));
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const aesKey = await crypto.subtle.deriveKey(
                        { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
                        baseKey,
                        { name: 'AES-GCM', length: 256 },
                        false,
                        ['encrypt']
                    );
                    const plaintext = enc.encode(JSON.stringify(settings));
                    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
                    const payload = {
                        rumblex: {
                            schemaVersion: 3,
                            cipher: 'AES-GCM-256',
                            kdf: 'PBKDF2-SHA256-200000',
                            salt: b64(salt),
                            iv: b64(iv),
                            ciphertext: b64(cipherBuf),
                            encryptedAt: new Date().toISOString(),
                        },
                    };

                    const body = JSON.stringify({
                        description: 'RumbleX encrypted settings backup',
                        public: false,
                        files: { 'rumblex-settings.enc.json': { content: JSON.stringify(payload, null, 2) } },
                    });
                    const url = gistId ? ('https://api.github.com/gists/' + gistId) : 'https://api.github.com/gists';
                    const resp = await fetch(url, {
                        method: gistId ? 'PATCH' : 'POST',
                        headers: {
                            'Accept': 'application/vnd.github+json',
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json',
                            'X-GitHub-Api-Version': '2022-11-28',
                        },
                        body,
                    });
                    if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                    const data = await resp.json();
                    const newId = data && data.id ? data.id : gistId;
                    // Persist the gist id if this was a CREATE.
                    if (!gistId && newId) {
                        const next = { ...settings, encryptedGistSyncId: newId };
                        await new Promise((resolve) => chrome.storage.local.set({ rx_settings: next }, resolve));
                    }
                    sendResponse({ ok: true, gistId: newId, bytes: JSON.stringify(payload).length });
                    return;
                }

                // Pull
                if (!gistId) { sendResponse({ ok: false, reason: 'missing-gist-id' }); return; }
                const resp = await fetch('https://api.github.com/gists/' + gistId, {
                    headers: {
                        'Accept': 'application/vnd.github+json',
                        'Authorization': 'Bearer ' + token,
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                });
                if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                const data = await resp.json();
                const files = data && data.files ? data.files : {};
                const file = files['rumblex-settings.enc.json'] || Object.values(files)[0];
                if (!file || !file.content) { sendResponse({ ok: false, reason: 'no-payload' }); return; }
                let parsed;
                try { parsed = JSON.parse(file.content); } catch { sendResponse({ ok: false, reason: 'bad-json' }); return; }
                const env = parsed && parsed.rumblex;
                if (!env || !env.ciphertext || !env.iv || !env.salt) { sendResponse({ ok: false, reason: 'malformed-payload' }); return; }
                const aesKey = await crypto.subtle.deriveKey(
                    { name: 'PBKDF2', salt: fromB64(env.salt), iterations: 200000, hash: 'SHA-256' },
                    baseKey,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['decrypt']
                );
                let plainBuf;
                try {
                    plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(env.iv) }, aesKey, fromB64(env.ciphertext));
                } catch {
                    sendResponse({ ok: false, reason: 'bad-passphrase' });
                    return;
                }
                let pulled;
                try { pulled = JSON.parse(dec.decode(plainBuf)); } catch { sendResponse({ ok: false, reason: 'bad-decoded-json' }); return; }
                // Take a backup snapshot before overwriting — same pattern as
                // the v3.0 backup system uses for any settings overwrite.
                try {
                    const snapList = await new Promise((resolve) => chrome.storage.local.get(['rx_settings_snapshots'], resolve));
                    const arr = Array.isArray(snapList?.rx_settings_snapshots) ? snapList.rx_settings_snapshots : [];
                    arr.push({ at: new Date().toISOString(), reason: 'pre-gist-pull', settings });
                    while (arr.length > 50) arr.shift();
                    await new Promise((resolve) => chrome.storage.local.set({ rx_settings_snapshots: arr }, resolve));
                } catch {}
                // Preserve the LOCAL token + gist id so the user doesn't get
                // logged out of their own sync target after a pull.
                pulled.encryptedGistSyncToken = token;
                pulled.encryptedGistSyncId = gistId;
                await new Promise((resolve) => chrome.storage.local.set({ rx_settings: pulled }, resolve));
                sendResponse({ ok: true, encryptedAt: env.encryptedAt || null, keyCount: Object.keys(pulled).length });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true;
    }

    if (message.action === 'importFollowedChannels') {
        (async () => {
            try {
                const resp = await fetch('https://rumble.com/account/following', {
                    method: 'GET',
                    credentials: 'include',
                });
                if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                const html = await resp.text();
                // Verify the response is actually the followed-channels page,
                // not a login redirect. The page is identified by its
                // `data-js="followed-channels__section"` attribute on the
                // wrapping section.
                if (!html.includes('followed-channels__section')) {
                    sendResponse({ ok: false, reason: 'not-logged-in' });
                    return;
                }
                // Parse each <li class="followed-channel"> block. We scan the
                // whole document body — the row count varies with sort/paging.
                const rows = [];
                const re = /<li[^>]*class="[^"]*\bfollowed-channel\b[^"]*"[^>]*data-type="channel"[\s\S]*?<\/li>/g;
                let m;
                while ((m = re.exec(html))) {
                    const block = m[0];
                    // Channel URL: prefer /c/ links; fall back to /user/.
                    const linkMatch = block.match(/href="([^"]*\/(?:c|user)\/[^"]+?)"/);
                    if (!linkMatch) continue;
                    // Strip query params so the import URL stays canonical.
                    let url = linkMatch[1];
                    try { const u = new URL(url, 'https://rumble.com'); u.search = ''; url = u.toString(); } catch {}
                    // Channel name from <span class="line-clamp-2">.
                    const nameMatch = block.match(/<span class="line-clamp-2"[^>]*>([^<]+)<\/span>/);
                    const name = nameMatch ? nameMatch[1].trim() : url;
                    rows.push({ url, name });
                }
                if (rows.length === 0) { sendResponse({ ok: true, scanned: 0, added: 0, duplicates: 0 }); return; }
                // Merge into watchedChannels, skipping anything we already track.
                const s = await rxGetSettings();
                const existing = Array.isArray(s.watchedChannels) ? s.watchedChannels : [];
                const known = new Set(existing.map((c) => c.url));
                let added = 0;
                let duplicates = 0;
                const next = existing.slice();
                for (const r of rows) {
                    if (known.has(r.url)) { duplicates++; continue; }
                    next.push({
                        url: r.url,
                        name: r.name,
                        lastSeenVideoId: null,
                        isLive: false,
                        lastChecked: null,
                    });
                    known.add(r.url);
                    added++;
                }
                await rxSetSettings({ watchedChannels: next });
                await rxSyncChannelNotifier();
                sendResponse({ ok: true, scanned: rows.length, added, duplicates, total: next.length });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
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

    // v3.18.0 — Channel Archive Queue message API.
    if (message.action === 'archiveEnqueueChannel') {
        (async () => {
            try {
                const channelUrl = (message.channelUrl || '').trim();
                if (!/^https?:\/\/(www\.)?rumble\.com\/(c|user)\//i.test(channelUrl)) {
                    sendResponse({ ok: false, reason: 'bad-channel-url' });
                    return;
                }
                const maxItems = Math.max(1, Math.min(500, parseInt(message.maxItems, 10) || 50));
                const filterClips = !!message.filterClips;
                const resp = await fetch(channelUrl, { credentials: 'include' });
                if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                const html = await resp.text();
                // Parse the channel page for video entries. The channel grid uses
                // <a class="videostream__link ..." href="/v..."> elements paired
                // with <h3 class="thumbnail__title" title="...">.
                const seen = new Set();
                const found = [];
                // Walk anchor tags; each video card has data-video-id or a /v link.
                const re = /<a[^>]*\bvideostream__link\b[^>]*href="(\/v[^"]+)"[^>]*>[\s\S]*?<h3[^>]*\bthumbnail__title\b[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)<\/h3>/g;
                let m;
                while ((m = re.exec(html)) && found.length < maxItems) {
                    const href = m[1];
                    const titleAttr = (m[2] || m[3] || '').trim();
                    if (seen.has(href)) continue;
                    seen.add(href);
                    if (filterClips && /^Clip:\s/i.test(titleAttr)) continue;
                    if (filterClips && /\/clips?\//i.test(href)) continue;
                    // Extract the v-slug.
                    const slugMatch = href.match(/^\/(v[a-z0-9]+)/i);
                    if (!slugMatch) continue;
                    found.push({
                        videoId: slugMatch[1],
                        videoUrl: 'https://rumble.com' + href,
                        videoTitle: titleAttr || null,
                    });
                }
                if (found.length === 0) {
                    // Fallback parse for older row markup.
                    const reAlt = /<a[^>]*href="(\/v[a-z0-9][^"]*)"[^>]*>[\s\S]*?<\/a>/gi;
                    let mm;
                    while ((mm = reAlt.exec(html)) && found.length < maxItems) {
                        const href = mm[1];
                        if (seen.has(href)) continue;
                        seen.add(href);
                        const slugMatch = href.match(/^\/(v[a-z0-9]+)/i);
                        if (!slugMatch) continue;
                        found.push({
                            videoId: slugMatch[1],
                            videoUrl: 'https://rumble.com' + href,
                            videoTitle: null,
                        });
                    }
                }
                if (found.length === 0) {
                    sendResponse({ ok: false, reason: 'no-videos-found' });
                    return;
                }
                // Channel name: from <h1> or <meta property="og:title">.
                let channelName = null;
                const ogt = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
                if (ogt) channelName = ogt[1].trim();
                const root = await rxLoadArchiveQueue();
                let enqueued = 0;
                let skipped = 0;
                for (const v of found) {
                    // Skip duplicates already in queue (by videoId).
                    if (root.jobs.some((j) => j.videoId === v.videoId)) { skipped++; continue; }
                    if (root.jobs.length >= RX_ARCHIVE_MAX_JOBS) break;
                    root.jobs.push({
                        id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
                        channelUrl,
                        channelName,
                        videoId: v.videoId,
                        videoUrl: v.videoUrl,
                        videoTitle: v.videoTitle,
                        status: 'pending',
                        addedAt: Date.now(),
                    });
                    enqueued++;
                }
                await rxSaveArchiveQueue(root);
                // Kick a tick now so the user sees progress immediately.
                rxRunArchiveTick().catch(() => {});
                sendResponse({ ok: true, enqueued, skipped, channelName });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true;
    }

    if (message.action === 'archiveGetQueue') {
        rxLoadArchiveQueue().then((root) => sendResponse({ ok: true, queue: root }));
        return true;
    }

    if (message.action === 'archivePauseQueue' || message.action === 'archiveResumeQueue') {
        (async () => {
            const root = await rxLoadArchiveQueue();
            root.paused = (message.action === 'archivePauseQueue');
            await rxSaveArchiveQueue(root);
            sendResponse({ ok: true, paused: root.paused });
        })();
        return true;
    }

    if (message.action === 'archiveClearCompleted') {
        (async () => {
            const root = await rxLoadArchiveQueue();
            const before = root.jobs.length;
            root.jobs = root.jobs.filter((j) => j.status !== 'completed');
            await rxSaveArchiveQueue(root);
            sendResponse({ ok: true, removed: before - root.jobs.length });
        })();
        return true;
    }

    if (message.action === 'archiveClearQueue') {
        (async () => {
            const root = await rxLoadArchiveQueue();
            const before = root.jobs.length;
            root.jobs = [];
            await rxSaveArchiveQueue(root);
            sendResponse({ ok: true, removed: before });
        })();
        return true;
    }

    if (message.action === 'archiveRemoveJob') {
        (async () => {
            const root = await rxLoadArchiveQueue();
            const before = root.jobs.length;
            root.jobs = root.jobs.filter((j) => j.id !== message.id);
            await rxSaveArchiveQueue(root);
            sendResponse({ ok: true, removed: before - root.jobs.length });
        })();
        return true;
    }

    if (message.action === 'archiveRetryJob') {
        (async () => {
            const root = await rxLoadArchiveQueue();
            const job = root.jobs.find((j) => j.id === message.id);
            if (!job) { sendResponse({ ok: false, reason: 'not-found' }); return; }
            job.status = 'pending';
            job.error = null;
            job.completedAt = null;
            job.downloadId = null;
            await rxSaveArchiveQueue(root);
            rxRunArchiveTick().catch(() => {});
            sendResponse({ ok: true });
        })();
        return true;
    }

    if (message.action === 'archiveRunNow') {
        rxRunArchiveTick().then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, reason: String(e?.message || e) }));
        return true;
    }
});
