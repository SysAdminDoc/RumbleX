// RumbleX v1.8.0 - Popup Script
'use strict';

// Feature list grouped by category. Order within a group controls display
// order in the popup. Must stay in sync with Settings._defaults in content.js
// and with META/DEFAULTS in options.js — parity is enforced by CI.
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
            { id: 'keyboardNav', label: 'Keyboard Nav' },
            { id: 'videoStats', label: 'Video Stats' },
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

const DEFAULTS = {
    adNuker: true,
    theaterSplit: true,
    feedCleanup: true,
    darkEnhance: true,
    hideReposts: true,
    wideLayout: true,
    videoDownload: true,
    splitRatio: 75,
    hiddenCategories: [],
    logoToFeed: true,
    hidePremium: true,
    speedController: true,
    scrollVolume: true,
    defaultMaxVolume: false,
    autoMaxQuality: true,
    watchProgress: true,
    channelBlocker: true,
    keyboardNav: true,
    autoTheater: false,
    liveChatEnhance: true,
    videoTimestamps: true,
    screenshotBtn: true,
    watchHistory: true,
    autoplayBlock: true,
    searchHistory: true,
    miniPlayer: true,
    videoStats: true,
    loopControl: true,
    quickBookmark: true,
    commentNav: true,
    rantHighlight: true,
    relatedFilter: true,
    exactCounts: true,
    shareTimestamp: true,
    shortsFilter: true,
    chatAutoScroll: true,
    autoExpand: true,
    notifEnhance: true,
    quickSave: true,
    theme: 'catppuccin',
    playbackSpeed: 1.0,
    blockedChannels: [],
    bookmarks: [],
    // v1.8.0
    fullTitles: true,
    titleFont: false,
    uniqueChatters: true,
    chatUserBlock: true,
    chatSpamDedup: true,
    chatExport: true,
    rantPersist: true,
    commentSort: true,
    popoutChat: true,
    keywordFilter: true,
    autoplayScheduler: false,
    chapters: true,
    sponsorBlock: true,
    videoClips: true,
    liveDVR: false,
    subtitleSidecar: true,
    transcripts: true,
    audioOnly: true,
    batchDownload: false,
    blockedChatters: [],
    blockedKeywords: [],
    sponsorSegments: {},
    autoplayQueue: [],
    // v1.9.0 — Rumble Enhancement Suite port
    autoHideHeader: false,
    autoHideNavSidebar: false,
    autoLike: false,
    autoLoadComments: true,
    fullWidthPlayer: false,
    adaptiveLiveLayout: true,
    commentBlocking: true,
    siteThemeSync: false,
    siteTheme: 'system',
    blockedCommenters: [],
    widenSearchBar: false,
    hideUploadIcon: false,
    hideHeaderAd: false,
    hideProfileBacksplash: false,
    hideFeaturedBanner: false,
    hideEditorPicks: false,
    hideTopLiveCategories: false,
    hidePremiumRow: false,
    hideHomepageAd: false,
    hideForYouRow: false,
    hideGamingRow: false,
    hideFinanceRow: false,
    hideLiveRow: false,
    hideFeaturedPlaylistsRow: false,
    hideSportsRow: false,
    hideViralRow: false,
    hidePodcastsRow: false,
    hideLeaderboardRow: false,
    hideVlogsRow: false,
    hideNewsRow: false,
    hideScienceRow: false,
    hideMusicRow: false,
    hideEntertainmentRow: false,
    hideCookingRow: false,
    hideFooter: false,
    hideRelatedOnLive: false,
    hideRelatedSidebar: false,
    widenContent: false,
    hideVideoDescription: false,
    hidePausedVideoAds: false,
    hideRewindButton: false,
    hideFastForwardButton: false,
    hideCCButton: false,
    hideAutoplayButton: false,
    hideTheaterButton: false,
    hidePipButton: false,
    hideFullscreenButton: false,
    hidePlayerRumbleLogo: false,
    hidePlayerGradient: false,
    hideLikeDislikeButton: false,
    hideShareButton: false,
    hideRepostButton: false,
    hideEmbedButton: false,
    hideSaveButton: false,
    hideCommentButton: false,
    hideReportButton: false,
    hidePremiumJoinButtons: false,
    moveReplyButton: false,
    hideCommentReportLink: false,
    cleanLiveChat: false,
};

const UI_STATE_KEY = 'rx_popup_ui';

function makeToggle(featId, initialChecked, onChange) {
    const toggle = document.createElement('label');
    toggle.className = 'toggle';
    toggle.setAttribute('aria-label', featId);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initialChecked;
    input.addEventListener('change', () => onChange(input.checked));

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
function saveSettings(settings) {
    _pendingSettings = settings;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        _saveTimer = null;
        try { chrome.storage.local.set({ rx_settings: _pendingSettings }); } catch {}
        _pendingSettings = null;
    }, 120);
}
function flushPendingSave() {
    if (_saveTimer == null) return;
    clearTimeout(_saveTimer);
    _saveTimer = null;
    if (_pendingSettings) {
        try { chrome.storage.local.set({ rx_settings: _pendingSettings }); } catch {}
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
        label.textContent = group.label;

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
            rowLabel.textContent = feat.label;

            const toggle = makeToggle(feat.id, settings[feat.id] ?? true, (checked) => {
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
    themeLabel.textContent = 'Theme';
    themeSection.appendChild(themeLabel);

    const themeGrid = document.createElement('div');
    themeGrid.className = 'theme-grid';
    // Colors must match THEMES[id].accent in content.js
    const themes = [
        { id: 'catppuccin', label: 'Catppuccin Mocha', color: '#89b4fa' },
        { id: 'youtube', label: 'YouTubify', color: '#3ea6ff' },
        { id: 'midnight', label: 'Midnight AMOLED', color: '#818cf8' },
        { id: 'rumbleGreen', label: 'Rumble Green', color: '#85c742' },
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
    // Shift-click tries the on-page Ctrl+Shift+X modal for quick toggles but
    // only if the active tab is actually rumble.com; otherwise we gracefully
    // fall through to the options page so the click isn't wasted.
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
        updateBtn.dataset.tooltip = 'Checking...';
        chrome.runtime.sendMessage({ action: 'checkUpdate' }, (res) => {
            updateBtn.classList.remove('checking');
            if (res && res.error) {
                updateBtn.classList.add('error');
                updateBtn.dataset.tooltip = 'Check failed';
                setTimeout(() => {
                    updateBtn.classList.remove('error');
                    updateBtn.dataset.tooltip = 'Check for Updates';
                }, 3000);
                return;
            }
            if (res && res.hasUpdate) {
                updateBtn.classList.add('has-update');
                updateBtn.dataset.tooltip = `Update available: v${res.latest}`;
                updateBtn.dataset.releaseUrl = res.url;
            } else {
                updateBtn.dataset.tooltip = 'Up to date!';
                setTimeout(() => { updateBtn.dataset.tooltip = 'Check for Updates'; }, 3000);
            }
        });
    });
}

init();
