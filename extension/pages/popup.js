// RumbleX v3.47.0 - Popup Script
'use strict';

const RXSettingsSchema = globalThis.RumbleXSettingsSchema;
if (!RXSettingsSchema) throw new Error('RumbleX settings schema is missing');

// Feature list grouped by category. Order within a group controls display
// order in the popup; values and defaults come from the shared schema.
const GROUPS = [
    {
        id: 'ad-blocking', label: 'Ad Blocking',
        features: [
            { id: 'adNuker', label: 'Ad Nuker' },
            { id: 'feedCleanup', label: 'Feed Cleanup' },
            { id: 'hideReposts', label: 'Hide Reposts' },
            { id: 'hidePremium', label: 'Hide Premium' },
            { id: 'shortsFilter', label: 'Shorts Filter' },
            { id: 'sponsorBlock', label: 'SponsorBlock' },
        ],
    },
    {
        id: 'video-player', label: 'Video Player',
        features: [
            { id: 'theaterSplit', label: 'Theater Split' },
            { id: 'autoTheater', label: 'Auto Theater' },
            { id: 'speedController', label: 'Speed Control' },
            { id: 'scrollVolume', label: 'Scroll Volume' },
            { id: 'defaultMaxVolume', label: 'Default Max Volume' },
            { id: 'autoMaxQuality', label: 'Auto Max Quality' },
            { id: 'autoplayBlock', label: 'Autoplay Block' },
            { id: 'loopControl', label: 'Loop Control' },
            { id: 'miniPlayer', label: 'Mini Player' },
            { id: 'legacyKeyboardNav', label: 'Keyboard Nav (legacy)' },
            { id: 'videoStats', label: 'Video Stats' },
            { id: 'timeRemaining', label: 'Time Left' },
            { id: 'chapters', label: 'Chapters' },
            { id: 'autoplayScheduler', label: 'Autoplay Queue' },
        ],
    },
    {
        id: 'theme-layout', label: 'Theme & Layout',
        features: [
            { id: 'darkEnhance', label: 'Dark Theme' },
            { id: 'wideLayout', label: 'Wide Layout' },
            { id: 'logoToFeed', label: 'Logo to Feed' },
            { id: 'autoExpand', label: 'Auto Expand' },
            { id: 'notifEnhance', label: 'Notif Enhance' },
            { id: 'fullTitles', label: 'Full Titles' },
            { id: 'titleFont', label: 'Title Font' },
            { id: 'titleNormalizer', label: 'Title Normalizer' },
            { id: 'perChannelVolumeMemory', label: 'Per-Channel Playback' },
            { id: 'rssExportEnabled', label: 'Channel RSS' },
        ],
    },
    {
        id: 'downloads', label: 'Downloads & Capture',
        features: [
            { id: 'videoDownload', label: 'Video Download' },
            { id: 'audioOnly', label: 'Low-Bitrate MP4' },
            { id: 'videoClips', label: 'Video Clips' },
            { id: 'liveDVR', label: 'Live DVR' },
            { id: 'batchDownload', label: 'Batch Download' },
            { id: 'screenshotBtn', label: 'Screenshot' },
            { id: 'shareTimestamp', label: 'Share@Time' },
            { id: 'subtitleSidecar', label: 'Subtitle Sidecar' },
            { id: 'transcripts', label: 'Transcripts' },
        ],
    },
    {
        id: 'history', label: 'History & Bookmarks',
        features: [
            { id: 'watchProgress', label: 'Watch Progress' },
            { id: 'watchHistory', label: 'Watch History' },
            { id: 'searchHistory', label: 'Search History' },
            { id: 'quickBookmark', label: 'Bookmarks' },
            { id: 'quickSave', label: 'Quick Save' },
        ],
    },
    {
        id: 'comments-chat', label: 'Comments & Chat',
        features: [
            { id: 'liveChatEnhance', label: 'Chat Enhance' },
            { id: 'chatAutoScroll', label: 'Chat Scroll' },
            { id: 'uniqueChatters', label: 'Unique Chatters' },
            { id: 'chatUserBlock', label: 'User Block' },
            { id: 'chatSpamDedup', label: 'Spam Dedup' },
            { id: 'chatExport', label: 'Chat Export' },
            { id: 'popoutChat', label: 'Popout Chat' },
            { id: 'videoTimestamps', label: 'Timestamps' },
            { id: 'commentNav', label: 'Comment Nav' },
            { id: 'commentSort', label: 'Comment Sort' },
            { id: 'rantHighlight', label: 'Rant Highlight' },
            { id: 'rantPersist', label: 'Rant Persist' },
        ],
    },
    {
        id: 'feed-controls', label: 'Feed Controls',
        features: [
            { id: 'channelBlocker', label: 'Channel Blocker' },
            { id: 'keywordFilter', label: 'Keyword Filter' },
            { id: 'relatedFilter', label: 'Related Filter' },
            { id: 'exactCounts', label: 'Exact Counts' },
            // v3.1.0 — Rumble Shorts (launched Feb 2026)
            { id: 'disableShortsFeed', label: 'Disable Shorts Feed' },
        ],
    },
    // ── v1.9.0 — Rumble Enhancement Suite port ──
    {
        id: 'layout', label: 'Navigation & Chrome',
        features: [
            { id: 'autoHideHeader', label: 'Auto-hide Header' },
            { id: 'autoHideNavSidebar', label: 'Auto-hide Nav Sidebar' },
            { id: 'widenSearchBar', label: 'Widen Search Bar' },
            { id: 'hideUploadIcon', label: 'Hide Upload Icon' },
            { id: 'hideHeaderAd', label: 'Hide Go-Ad-Free Button' },
            { id: 'hideProfileBacksplash', label: 'Hide Profile Backsplash' },
            { id: 'hideFooter', label: 'Hide Footer' },
            { id: 'siteThemeSync', label: 'Sync Rumble Site Theme' },
        ],
    },
    {
        id: 'main-page', label: 'Main Page Rows',
        features: [
            { id: 'hideFeaturedBanner', label: 'Hide Featured Banner' },
            { id: 'hideEditorPicks', label: 'Hide Editor Picks' },
            { id: 'hideTopLiveCategories', label: 'Hide Top Live' },
            { id: 'hidePremiumRow', label: 'Hide Premium Row' },
            { id: 'hideHomepageAd', label: 'Hide Homepage Ad' },
            { id: 'hideForYouRow', label: 'Hide For-You Row' },
            { id: 'hideLiveRow', label: 'Hide Live Row' },
            { id: 'hideGamingRow', label: 'Hide Gaming Row' },
            { id: 'hideFinanceRow', label: 'Hide Finance Row' },
            { id: 'hideFeaturedPlaylistsRow', label: 'Hide Featured Playlists' },
            { id: 'hideSportsRow', label: 'Hide Sports Row' },
            { id: 'hideViralRow', label: 'Hide Viral Row' },
            { id: 'hidePodcastsRow', label: 'Hide Podcasts Row' },
            { id: 'hideLeaderboardRow', label: 'Hide Leaderboard Row' },
            { id: 'hideVlogsRow', label: 'Hide Vlogs Row' },
            { id: 'hideNewsRow', label: 'Hide News Row' },
            { id: 'hideScienceRow', label: 'Hide Science Row' },
            { id: 'hideMusicRow', label: 'Hide Music Row' },
            { id: 'hideEntertainmentRow', label: 'Hide Entertainment Row' },
            { id: 'hideCookingRow', label: 'Hide Cooking Row' },
        ],
    },
    {
        id: 'video-page', label: 'Video Page Layout',
        features: [
            { id: 'fullWidthPlayer', label: 'Full-Width Player' },
            { id: 'adaptiveLiveLayout', label: 'Adaptive Live Layout' },
            { id: 'hideRelatedSidebar', label: 'Hide Related Sidebar' },
            { id: 'hideRelatedOnLive', label: 'Hide Related on Live' },
            { id: 'widenContent', label: 'Widen Content Area' },
            { id: 'hideVideoDescription', label: 'Hide Video Description' },
            { id: 'hidePausedVideoAds', label: 'Hide Paused-Video Ads' },
        ],
    },
    {
        id: 'player-controls', label: 'Player Controls',
        features: [
            { id: 'autoLike', label: 'Auto Like' },
            { id: 'hideRewindButton', label: 'Hide Rewind' },
            { id: 'hideFastForwardButton', label: 'Hide Fast Forward' },
            { id: 'hideCCButton', label: 'Hide CC' },
            { id: 'hideAutoplayButton', label: 'Hide Autoplay Toggle' },
            { id: 'hideTheaterButton', label: 'Hide Theater Button' },
            { id: 'hidePipButton', label: 'Hide PiP Button' },
            { id: 'hideFullscreenButton', label: 'Hide Fullscreen Button' },
            { id: 'hidePlayerRumbleLogo', label: 'Hide Player Logo' },
            { id: 'hidePlayerGradient', label: 'Hide Player Gradient' },
        ],
    },
    {
        id: 'video-buttons', label: 'Video Buttons',
        features: [
            { id: 'hideLikeDislikeButton', label: 'Hide Like/Dislike' },
            { id: 'hideShareButton', label: 'Hide Share' },
            { id: 'hideRepostButton', label: 'Hide Repost' },
            { id: 'hideEmbedButton', label: 'Hide Embed' },
            { id: 'hideSaveButton', label: 'Hide Save' },
            { id: 'hideCommentButton', label: 'Hide Comment' },
            { id: 'hideReportButton', label: 'Hide 3-dot Menu' },
            { id: 'hidePremiumJoinButtons', label: 'Hide Premium/Join' },
            // v3.1.0 — Rumble Wallet (launched Jan 2026)
            { id: 'hideWalletTipButton', label: 'Hide Wallet Tip Button' },
        ],
    },
    {
        id: 'comments-extra', label: 'Comments & Chat (extras)',
        features: [
            { id: 'commentBlocking', label: 'Comment Blocking' },
            { id: 'autoLoadComments', label: 'Auto Load Comments' },
            { id: 'moveReplyButton', label: 'Move Reply Button' },
            { id: 'hideCommentReportLink', label: 'Hide Comment Report' },
            { id: 'cleanLiveChat', label: 'Clean Live Chat UI' },
        ],
    },
];

// By default, show only the first three groups expanded. The user's choice
// is persisted (not in rx_settings — popup-local UI state lives in its own
// storage key so it doesn't bloat the sync payload).
const DEFAULT_EXPANDED = new Set(['ad-blocking', 'video-player', 'theme-layout']);

const DEFAULTS = RXSettingsSchema.DEFAULTS;

const UI_STATE_KEY = 'rx_popup_ui';
const GROUP_MESSAGE_KEYS = {
    'ad-blocking': 'groupAdBlocking',
    'video-player': 'groupVideoPlayer',
    'theme-layout': 'groupThemeLayout',
    'downloads': 'groupDownloads',
    'history': 'groupHistory',
    'comments-chat': 'groupChat',
    'feed-controls': 'groupFeedControls',
    'layout': 'groupNavigation',
    'main-page': 'groupMainPage',
    'video-page': 'groupVideoPage',
    'player-controls': 'groupPlayerControls',
    'video-buttons': 'groupVideoButtons',
    'comments-extra': 'groupCommentsExtra',
};
const FEATURE_MESSAGE_KEYS = {
    disableShortsFeed: 'tipDisableShortsFeed',
    hideWalletTipButton: 'tipHideWalletTipButton',
};

function i18n(key, fallback = '') {
    if (!key) return fallback;
    const testMessages = globalThis.__RUMBLEX_TEST_I18N;
    if (testMessages && typeof testMessages[key] === 'string') return testMessages[key] || fallback;
    try {
        return chrome.i18n?.getMessage?.(key) || fallback;
    } catch {
        return fallback;
    }
}

function applyI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = i18n(el.dataset.i18n, el.textContent);
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
        el.setAttribute('aria-label', i18n(el.dataset.i18nAriaLabel, el.getAttribute('aria-label') || ''));
    });
    root.querySelectorAll('[data-i18n-tooltip]').forEach((el) => {
        el.dataset.tooltip = i18n(el.dataset.i18nTooltip, el.dataset.tooltip || '');
    });
}

function groupLabel(group) {
    return i18n(GROUP_MESSAGE_KEYS[group.id], group.label);
}

function featureLabel(feature) {
    return i18n(FEATURE_MESSAGE_KEYS[feature.id], feature.label);
}

function makeToggle(featId, labelText, initialChecked, onChange) {
    const toggle = document.createElement('label');
    toggle.className = 'toggle';
    toggle.setAttribute('aria-label', labelText);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initialChecked;
    input.setAttribute('aria-label', labelText);
    input.addEventListener('change', () => {
        onChange(input.checked);
    });

    const track = document.createElement('div');
    track.className = 'toggle-track';
    const thumb = document.createElement('div');
    thumb.className = 'toggle-thumb';

    toggle.append(input, track, thumb);
    return toggle;
}

// Debounce popup writes — users sometimes rapid-fire toggles. Without this
// each click triggers an independent storage.set + onChanged broadcast to
// every open tab. 120 ms is imperceptible but coalesces bursts.
//
// Popup windows have an unforgiving lifecycle: a click outside (or the
// gear button opening the options page) destroys the popup. We always hold
// the latest state in `_pendingSettings` so the pagehide flush can write
// the most recent value synchronously regardless of which toggle fired last.
let _saveTimer = null;
let _pendingSettings = null;
// chrome.storage.local.set reports failure through the callback's
// chrome.runtime.lastError, not by throwing, so the previous synchronous
// try/catch could never have caught a real persist failure. A dropped write
// left the toggle looking saved when it was not.
function persistSettings(settings) {
    try {
        chrome.storage.local.set({ rx_settings: settings }, () => {
            const err = chrome.runtime.lastError;
            if (err) reportSaveFailure(err.message);
        });
    } catch (e) {
        reportSaveFailure(e?.message || String(e));
    }
}

function reportSaveFailure(message) {
    console.warn('[RumbleX] settings save failed:', message);
    const banner = document.getElementById('save-error');
    if (!banner) return;
    banner.textContent = 'Settings could not be saved — your last change was not applied.';
    banner.hidden = false;
}

function saveSettings(settings) {
    _pendingSettings = settings;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        _saveTimer = null;
        persistSettings(_pendingSettings);
        _pendingSettings = null;
    }, 120);
}
function flushPendingSave() {
    if (_saveTimer == null) return;
    clearTimeout(_saveTimer);
    _saveTimer = null;
    if (_pendingSettings) {
        persistSettings(_pendingSettings);
        _pendingSettings = null;
    }
}
// pagehide is the only reliable "popup is closing" signal in Chromium; blur
// fires too during normal interaction (e.g. clicking the search box in the
// active tab). Flush on pagehide, not blur.
window.addEventListener('pagehide', flushPendingSave);

async function loadUiState() {
    try {
        const res = await chrome.storage.local.get(UI_STATE_KEY);
        const stored = res?.[UI_STATE_KEY];
        if (stored && Array.isArray(stored.expanded)) return new Set(stored.expanded);
    } catch {}
    return new Set(DEFAULT_EXPANDED);
}

function saveUiState(expanded) {
    try { chrome.storage.local.set({ [UI_STATE_KEY]: { expanded: [...expanded] } }); } catch {}
}

async function init() {
    applyI18n();
    const manifest = chrome.runtime.getManifest();
    const ver = `v${manifest.version}`;
    document.getElementById('version').textContent = ver;
    document.getElementById('footer-version').textContent = ver;

    const [data, expanded] = await Promise.all([
        chrome.storage.local.get('rx_settings'),
        loadUiState(),
    ]);
    const settings = { ...DEFAULTS, ...(data.rx_settings || {}) };

    const container = document.getElementById('features');

    for (const group of GROUPS) {
        const groupEl = document.createElement('section');
        groupEl.className = 'feat-group' + (expanded.has(group.id) ? '' : ' collapsed');
        groupEl.dataset.groupId = group.id;

        // Header (button so it's keyboard-activatable + announced correctly)
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'feat-group-header';
        header.setAttribute('aria-expanded', expanded.has(group.id) ? 'true' : 'false');

        const label = document.createElement('span');
        label.textContent = groupLabel(group);

        const rightWrap = document.createElement('span');
        rightWrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
        const enabled = group.features.filter((f) => settings[f.id] === true).length;
        const count = document.createElement('span');
        count.className = 'feat-group-count';
        count.textContent = `${enabled}/${group.features.length}`;

        const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        caret.setAttribute('class', 'feat-group-caret');
        caret.setAttribute('viewBox', '0 0 10 10');
        caret.setAttribute('fill', 'none');
        caret.setAttribute('stroke', 'currentColor');
        caret.setAttribute('stroke-width', '2');
        caret.setAttribute('stroke-linecap', 'round');
        caret.setAttribute('stroke-linejoin', 'round');
        caret.innerHTML = '<polyline points="2,3.5 5,6.5 8,3.5"/>';
        rightWrap.append(count, caret);

        header.append(label, rightWrap);

        const body = document.createElement('div');
        body.className = 'feat-group-body';

        for (const feat of group.features) {
            const row = document.createElement('div');
            row.className = 'feat-row';

            const rowLabel = document.createElement('span');
            rowLabel.className = 'feat-label';
            const localizedLabel = featureLabel(feat);
            rowLabel.textContent = localizedLabel;

            const toggle = makeToggle(feat.id, localizedLabel, settings[feat.id] ?? true, (checked) => {
                settings[feat.id] = checked;
                saveSettings(settings);
                // Keep the enabled-count badge in sync as the user toggles.
                const countEl = groupEl.querySelector('.feat-group-count');
                if (countEl) {
                    const now = group.features.filter((f) => settings[f.id] === true).length;
                    countEl.textContent = `${now}/${group.features.length}`;
                }
            });

            row.append(rowLabel, toggle);
            body.appendChild(row);
        }

        header.addEventListener('click', () => {
            const isCollapsed = groupEl.classList.toggle('collapsed');
            header.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
            if (isCollapsed) expanded.delete(group.id);
            else expanded.add(group.id);
            saveUiState(expanded);
        });

        groupEl.append(header, body);
        container.appendChild(groupEl);
    }

    // Theme Picker — sits below the grouped toggles
    const themeSection = document.createElement('div');
    themeSection.className = 'theme-section';
    const themeLabel = document.createElement('div');
    themeLabel.className = 'theme-label';
    themeLabel.textContent = i18n('themeLabel', 'Theme');
    themeSection.appendChild(themeLabel);

    const themeGrid = document.createElement('div');
    themeGrid.className = 'theme-grid';
    // Colors must match THEMES[id].accent in content.js
    const themes = [
        { id: 'catppuccin', label: 'Catppuccin Mocha', color: '#89b4fa' },
        { id: 'youtube', label: 'YouTubify', color: '#3ea6ff' },
        { id: 'midnight', label: 'Midnight AMOLED', color: '#818cf8' },
        { id: 'rumbleGreen', label: 'Rumble Green', color: '#85c742' },
        { id: 'oledGreen', label: 'OLED Green', color: '#85c742' },
    ];
    for (const t of themes) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'theme-chip' + (settings.theme === t.id ? ' active' : '');
        const dot = document.createElement('span');
        dot.className = 'theme-dot';
        dot.style.background = t.color;
        chip.append(dot, t.label);
        chip.addEventListener('click', () => {
            settings.theme = t.id;
            saveSettings(settings);
            for (const c of themeGrid.querySelectorAll('.theme-chip')) c.classList.remove('active');
            chip.classList.add('active');
        });
        themeGrid.appendChild(chip);
    }
    themeSection.appendChild(themeGrid);
    container.appendChild(themeSection);

    // Prominent CTA — opens the full options page.
    const openOptions = () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html') });
        }
        window.close();
    };
    document.getElementById('open-options').addEventListener('click', openOptions);

    // Footer gear — click opens the dedicated options page (full editor).
    // v3.6.0 — Group all open Rumble tabs into one colored tab group.
    // Chrome only; gracefully degrades on Firefox/MV2 (button stays but
    // the SW responds with `no-tabgroups-api` and we flash the error tint).
    const groupBtn = document.getElementById('btn-group-tabs');
    if (groupBtn) {
        groupBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'groupRumbleTabs' }, (res) => {
                if (!res?.ok) {
                    groupBtn.classList.add('error');
                    const orig = groupBtn.dataset.tooltip;
                    if (res?.reason === 'no-rumble-tabs') {
                        groupBtn.dataset.tooltip = i18n('noRumbleTabsOpen', 'No Rumble tabs open');
                    } else if (res?.reason === 'no-tabgroups-api') {
                        groupBtn.dataset.tooltip = i18n('tabGroupsUnsupported', 'Tab groups not supported in this browser');
                    } else {
                        groupBtn.dataset.tooltip = i18n('groupFailed', 'Group failed');
                    }
                    setTimeout(() => {
                        groupBtn.classList.remove('error');
                        if (orig) groupBtn.dataset.tooltip = orig;
                    }, 2500);
                    return;
                }
                // Success — flash a brief confirmation.
                const orig = groupBtn.dataset.tooltip;
                groupBtn.dataset.tooltip = `Grouped ${res.count} ${res.count === 1 ? 'tab' : 'tabs'}`;
                setTimeout(() => { if (orig) groupBtn.dataset.tooltip = orig; }, 2000);
            });
        });
    }

    // Shift-click asks the active Rumble tab to open its in-page settings. If
    // the tab cannot handle the request, fall back to the full options page.
    document.getElementById('btn-settings').addEventListener('click', async (e) => {
        if (!e.shiftKey) { openOptions(); return; }
        try {
            const res = await chrome.runtime.sendMessage({ action: 'openSettings' });
            if (res?.ok) window.close();
            else openOptions();
        } catch {
            openOptions();
        }
    });

    // Update check
    const updateBtn = document.getElementById('btn-update');
    updateBtn.addEventListener('click', () => {
        if (updateBtn.classList.contains('has-update')) {
            const url = updateBtn.dataset.releaseUrl;
            if (url) chrome.tabs.create({ url });
            return;
        }
        updateBtn.classList.add('checking');
        updateBtn.dataset.tooltip = i18n('checkingUpdates', 'Checking...');
        chrome.runtime.sendMessage({ action: 'checkUpdate' }, (res) => {
            updateBtn.classList.remove('checking');
            if (res && res.error) {
                updateBtn.classList.add('error');
                updateBtn.dataset.tooltip = res.rateLimited
                    ? i18n('checkRateLimited', 'GitHub rate limit reached — try again later')
                    : i18n('checkFailed', 'Check failed');
                setTimeout(() => {
                    updateBtn.classList.remove('error');
                    updateBtn.dataset.tooltip = i18n('checkForUpdates', 'Check for updates');
                }, 3000);
                return;
            }
            if (res && res.hasUpdate) {
                updateBtn.classList.add('has-update');
                updateBtn.dataset.tooltip = `Update available: v${res.latest}`;
                updateBtn.dataset.releaseUrl = res.url;
            } else {
                updateBtn.dataset.tooltip = i18n('upToDate', 'Up to date!');
                setTimeout(() => { updateBtn.dataset.tooltip = i18n('checkForUpdates', 'Check for updates'); }, 3000);
            }
        });
    });
}

init();
