// RumbleX v1.8.0 - Options Page
// Standalone settings management via chrome.storage.local (rx_settings key).
// Mirrors Astra Deck's settings page pattern: dirty-draft workflow with
// search, group nav, stats overview, and export/import/reset.
(function () {
    'use strict';

    const BRAND_NAME = 'RumbleX';
    const STORAGE_KEY = 'rx_settings';

    // Full defaults catalog — must stay in sync with content.js Settings._defaults
    const DEFAULTS = {
        // Ad Blocking
        adNuker: true,
        feedCleanup: true,
        hideReposts: true,
        hidePremium: true,
        shortsFilter: true,
        sponsorBlock: true,
        // Video Player
        theaterSplit: true,
        autoTheater: false,
        speedController: true,
        scrollVolume: true,
        defaultMaxVolume: false,
        autoMaxQuality: true,
        autoplayBlock: true,
        loopControl: true,
        miniPlayer: true,
        keyboardNav: true,
        videoStats: true,
        chapters: true,
        autoplayScheduler: false,
        // Theme & Layout
        darkEnhance: true,
        wideLayout: true,
        logoToFeed: true,
        autoExpand: true,
        notifEnhance: true,
        fullTitles: true,
        titleFont: false,
        // Downloads & Capture
        videoDownload: true,
        audioOnly: true,
        videoClips: true,
        liveDVR: false,
        batchDownload: false,
        screenshotBtn: true,
        shareTimestamp: true,
        subtitleSidecar: true,
        transcripts: true,
        // History & Bookmarks
        watchProgress: true,
        watchHistory: true,
        searchHistory: true,
        quickBookmark: true,
        quickSave: true,
        // Comments & Chat
        liveChatEnhance: true,
        chatAutoScroll: true,
        uniqueChatters: true,
        chatUserBlock: true,
        chatSpamDedup: true,
        chatExport: true,
        popoutChat: true,
        videoTimestamps: true,
        commentNav: true,
        commentSort: true,
        rantHighlight: true,
        rantPersist: true,
        // Feed Controls
        channelBlocker: true,
        keywordFilter: true,
        relatedFilter: true,
        exactCounts: true,
        // Non-toggle
        splitRatio: 75,
        hiddenCategories: [],
        theme: 'catppuccin',
        playbackSpeed: 1.0,
        blockedChannels: [],
        blockedChatters: [],
        blockedKeywords: [],
        sponsorSegments: {},
        autoplayQueue: [],
        bookmarks: [],

        // v1.9.0 — Rumble Enhancement Suite port
        // Interactive modules
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
        // Main Page Layout
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
        // Video Page Layout
        hideRelatedOnLive: false,
        hideRelatedSidebar: false,
        widenContent: false,
        hideVideoDescription: false,
        hidePausedVideoAds: false,
        // Player Controls
        hideRewindButton: false,
        hideFastForwardButton: false,
        hideCCButton: false,
        hideAutoplayButton: false,
        hideTheaterButton: false,
        hidePipButton: false,
        hideFullscreenButton: false,
        hidePlayerRumbleLogo: false,
        hidePlayerGradient: false,
        // Video Buttons
        hideLikeDislikeButton: false,
        hideShareButton: false,
        hideRepostButton: false,
        hideEmbedButton: false,
        hideSaveButton: false,
        hideCommentButton: false,
        hideReportButton: false,
        hidePremiumJoinButtons: false,
        // Comments
        moveReplyButton: false,
        hideCommentReportLink: false,
        // Chat
        cleanLiveChat: false,
    };

    // Per-key metadata: group + human label + description
    const META = {
        adNuker: { group: 'ad-blocking', label: 'Ad Nuker', desc: 'Block ads, pause overlays, premium nags, IMA SDK' },
        feedCleanup: { group: 'ad-blocking', label: 'Feed Cleanup', desc: 'Remove premium promos from feeds' },
        hideReposts: { group: 'ad-blocking', label: 'Hide Reposts', desc: 'Hide reposted videos from feeds' },
        hidePremium: { group: 'ad-blocking', label: 'Hide Premium', desc: 'Hide premium/PPV videos from feeds' },
        shortsFilter: { group: 'ad-blocking', label: 'Shorts Filter', desc: 'Hide Shorts from all feeds' },
        sponsorBlock: { group: 'ad-blocking', label: 'SponsorBlock', desc: 'Local per-video segments with auto-skip' },

        theaterSplit: { group: 'video-player', label: 'Theater Split', desc: 'Fullscreen video with scroll-to-reveal side panel' },
        autoTheater: { group: 'video-player', label: 'Auto Theater', desc: 'Auto-enter native theater mode on load' },
        speedController: { group: 'video-player', label: 'Speed Control', desc: 'Persistent playback speed with live detection' },
        scrollVolume: { group: 'video-player', label: 'Scroll Volume', desc: 'Mouse wheel volume + middle-click mute' },
        defaultMaxVolume: { group: 'video-player', label: 'Default Max Volume', desc: 'Start videos at 100% volume' },
        autoMaxQuality: { group: 'video-player', label: 'Auto Max Quality', desc: 'Auto-select highest resolution on load' },
        autoplayBlock: { group: 'video-player', label: 'Autoplay Block', desc: 'Prevent auto-play of next video' },
        loopControl: { group: 'video-player', label: 'Loop Control', desc: 'Full video loop + A-B segment loop' },
        miniPlayer: { group: 'video-player', label: 'Mini Player', desc: 'Floating draggable video when scrolling away' },
        keyboardNav: { group: 'video-player', label: 'Keyboard Nav', desc: 'YouTube-style hotkeys (J/K/L, F, M, 0-9)' },
        videoStats: { group: 'video-player', label: 'Video Stats', desc: 'Resolution, codec, buffer, frames overlay' },
        chapters: { group: 'video-player', label: 'Chapters', desc: 'Parse description timestamps + seekbar markers' },
        autoplayScheduler: { group: 'video-player', label: 'Autoplay Queue', desc: 'Queue Rumble URLs, auto-advance at end' },
        playbackSpeed: { group: 'video-player', label: 'Playback Speed', desc: 'Saved playback rate (0.25-3x)' },

        darkEnhance: { group: 'theme-layout', label: 'Dark Theme', desc: 'Theme engine with player bar coloring' },
        wideLayout: { group: 'theme-layout', label: 'Wide Layout', desc: 'Full-width responsive grid on home & subs' },
        logoToFeed: { group: 'theme-layout', label: 'Logo to Feed', desc: 'Rumble logo navigates to Subscriptions' },
        autoExpand: { group: 'theme-layout', label: 'Auto Expand', desc: 'Auto-expand descriptions & comments' },
        notifEnhance: { group: 'theme-layout', label: 'Notif Enhance', desc: 'Themed notification dropdown + bell pulse' },
        fullTitles: { group: 'theme-layout', label: 'Full Titles', desc: 'Remove title truncation on video cards' },
        titleFont: { group: 'theme-layout', label: 'Title Font', desc: 'Unbold + normalize title typography' },
        theme: { group: 'theme-layout', label: 'Theme', desc: 'catppuccin | youtube | midnight | rumbleGreen' },
        splitRatio: { group: 'theme-layout', label: 'Split Ratio', desc: 'Theater split panel width % (40-90)' },

        videoDownload: { group: 'downloads', label: 'Video Download', desc: 'Download as direct MP4 or HLS-to-MP4/TS' },
        audioOnly: { group: 'downloads', label: 'Low-Bitrate MP4', desc: 'Download the smallest video variant for background listening (saved as .mp4).' },
        videoClips: { group: 'downloads', label: 'Video Clips', desc: 'Mark In/Out and export clip as MP4' },
        liveDVR: { group: 'downloads', label: 'Live DVR', desc: 'Save the last N seconds of a live stream' },
        batchDownload: { group: 'downloads', label: 'Batch Download', desc: 'Multi-select thumbnails from feeds' },
        screenshotBtn: { group: 'downloads', label: 'Screenshot', desc: 'Capture current video frame as PNG' },
        shareTimestamp: { group: 'downloads', label: 'Share @ Time', desc: 'Copy video URL at current playback time' },
        subtitleSidecar: { group: 'downloads', label: 'Subtitle Sidecar', desc: 'Load local SRT/VTT and overlay captions' },
        transcripts: { group: 'downloads', label: 'Transcripts', desc: 'Clickable transcript panel synced to player' },

        watchProgress: { group: 'history', label: 'Watch Progress', desc: 'Save/resume position + red progress bars' },
        watchHistory: { group: 'history', label: 'Watch History', desc: 'Local browsable watch history with search' },
        searchHistory: { group: 'history', label: 'Search History', desc: 'Recent searches dropdown on search input' },
        quickBookmark: { group: 'history', label: 'Bookmarks', desc: 'Save videos locally for later (200 max)' },
        quickSave: { group: 'history', label: 'Quick Save', desc: 'Watch Later button on thumbnail hover' },
        bookmarks: { group: 'history', label: 'Bookmarks (data)', desc: 'Bookmarks live in localStorage, not here' },

        liveChatEnhance: { group: 'comments-chat', label: 'Chat Enhance', desc: '@mention highlights, message filter bar' },
        chatAutoScroll: { group: 'comments-chat', label: 'Chat Scroll', desc: 'Smart auto-scroll with pause on scroll-up' },
        uniqueChatters: { group: 'comments-chat', label: 'Unique Chatters', desc: 'Live counter of unique chatters + messages' },
        chatUserBlock: { group: 'comments-chat', label: 'User Block', desc: 'Per-user chat hide (click "block")' },
        chatSpamDedup: { group: 'comments-chat', label: 'Spam Dedup', desc: 'Hide recently-repeated identical messages' },
        chatExport: { group: 'comments-chat', label: 'Chat Export', desc: 'Export chat as TXT (click) or JSON (shift-click)' },
        popoutChat: { group: 'comments-chat', label: 'Popout Chat', desc: 'Open chat in separate resizable window' },
        videoTimestamps: { group: 'comments-chat', label: 'Timestamps', desc: 'Clickable timestamps in comments/description' },
        commentNav: { group: 'comments-chat', label: 'Comment Nav', desc: 'Navigate, expand/collapse, OP-only filter' },
        commentSort: { group: 'comments-chat', label: 'Comment Sort', desc: 'Top / New / Oldest / Controversial' },
        rantHighlight: { group: 'comments-chat', label: 'Rant Highlight', desc: 'Glow rants by tier + running $ total' },
        rantPersist: { group: 'comments-chat', label: 'Rant Persist', desc: 'Keep rants visible past expiry + export' },
        blockedChatters: { group: 'comments-chat', label: 'Blocked Chatters', desc: 'Usernames hidden in live chat' },

        channelBlocker: { group: 'feed-controls', label: 'Channel Blocker', desc: 'Block/hide channels from all feeds' },
        keywordFilter: { group: 'feed-controls', label: 'Keyword Filter', desc: 'Hide videos whose titles match keywords' },
        relatedFilter: { group: 'feed-controls', label: 'Related Filter', desc: 'Search & filter related sidebar videos' },
        exactCounts: { group: 'feed-controls', label: 'Exact Counts', desc: 'Full numbers instead of 1.2K/3.5M' },
        blockedChannels: { group: 'feed-controls', label: 'Blocked Channels', desc: 'Channel names hidden from feeds' },
        blockedKeywords: { group: 'feed-controls', label: 'Blocked Keywords', desc: 'Title keywords that trigger hide' },
        hiddenCategories: { group: 'feed-controls', label: 'Hidden Categories', desc: 'Homepage sections to hide' },

        sponsorSegments: { group: 'advanced', label: 'Sponsor Segments', desc: 'Per-video SponsorBlock data (JSON)' },
        autoplayQueue: { group: 'advanced', label: 'Autoplay Queue', desc: 'URLs queued for autoplay scheduler' },

        // ── v1.9.0 — Rumble Enhancement Suite port ──
        // Interactive modules
        autoHideHeader: { group: 'layout', label: 'Auto-hide Header', desc: 'Fade the header out; shows again when cursor enters the top 80px.' },
        autoHideNavSidebar: { group: 'layout', label: 'Auto-hide Nav Sidebar', desc: 'Hide the nav sidebar; reveals on hover over the left edge.' },
        autoLike: { group: 'video-player', label: 'Auto Like', desc: 'Auto-click the like button when a watch page opens.' },
        autoLoadComments: { group: 'comments-chat', label: 'Auto Load Comments', desc: 'Automatically click "Show more comments" as you scroll.' },
        fullWidthPlayer: { group: 'video-page', label: 'Full-Width Player', desc: 'Maximize player width. On live streams, switches to a side-by-side chat layout.' },
        adaptiveLiveLayout: { group: 'video-page', label: 'Adaptive Live Layout', desc: 'On live, widens main content whenever the chat is visible.' },
        commentBlocking: { group: 'comments-chat', label: 'Comment Blocking', desc: 'Adds a Block button to comments; hides blocked users.' },
        siteThemeSync: { group: 'theme-layout', label: 'Sync Rumble Site Theme', desc: 'Mirror Rumble\u2019s native system/dark/light theme setting.' },
        siteTheme: { group: 'theme-layout', label: 'Site Theme', desc: '"system" | "dark" | "light" \u2014 only applied when Sync is on.' },
        blockedCommenters: { group: 'comments-chat', label: 'Blocked Commenters', desc: 'Usernames hidden from the comment section.' },

        // Main Page Layout (hide-X)
        widenSearchBar: { group: 'main-page', label: 'Widen Search Bar', desc: 'Expand the header search bar.' },
        hideUploadIcon: { group: 'main-page', label: 'Hide Upload Icon', desc: 'Hide the upload/stream icon in the header.' },
        hideHeaderAd: { group: 'main-page', label: 'Hide Go-Ad-Free Button', desc: 'Hide the header\u2019s "Go Ad-Free" button.' },
        hideProfileBacksplash: { group: 'main-page', label: 'Hide Profile Backsplash', desc: 'Hide the large channel header image.' },
        hideFeaturedBanner: { group: 'main-page', label: 'Hide Featured Banner', desc: 'Top homepage category banner.' },
        hideEditorPicks: { group: 'main-page', label: 'Hide Editor Picks', desc: 'Editor Picks row on the home page.' },
        hideTopLiveCategories: { group: 'main-page', label: 'Hide Top Live', desc: 'Top-Live-Categories row on the home page.' },
        hidePremiumRow: { group: 'main-page', label: 'Hide Premium Row', desc: 'Rumble Premium row on the home page.' },
        hideHomepageAd: { group: 'main-page', label: 'Hide Homepage Ad', desc: 'Ad container on the home page.' },
        hideForYouRow: { group: 'main-page', label: 'Hide For-You Row', desc: '"For You" recommendations.' },
        hideGamingRow: { group: 'main-page', label: 'Hide Gaming Row', desc: 'Gaming row on the home page.' },
        hideFinanceRow: { group: 'main-page', label: 'Hide Finance Row', desc: 'Finance & Crypto row.' },
        hideLiveRow: { group: 'main-page', label: 'Hide Live Row', desc: 'Live row on the home page.' },
        hideFeaturedPlaylistsRow: { group: 'main-page', label: 'Hide Featured Playlists', desc: 'Featured Playlists row.' },
        hideSportsRow: { group: 'main-page', label: 'Hide Sports Row', desc: 'Sports row on the home page.' },
        hideViralRow: { group: 'main-page', label: 'Hide Viral Row', desc: 'Viral row on the home page.' },
        hidePodcastsRow: { group: 'main-page', label: 'Hide Podcasts Row', desc: 'Podcasts row on the home page.' },
        hideLeaderboardRow: { group: 'main-page', label: 'Hide Leaderboard Row', desc: 'Leaderboard row on the home page.' },
        hideVlogsRow: { group: 'main-page', label: 'Hide Vlogs Row', desc: 'Vlogs row on the home page.' },
        hideNewsRow: { group: 'main-page', label: 'Hide News Row', desc: 'News row on the home page.' },
        hideScienceRow: { group: 'main-page', label: 'Hide Science Row', desc: 'Health & Science row.' },
        hideMusicRow: { group: 'main-page', label: 'Hide Music Row', desc: 'Music row on the home page.' },
        hideEntertainmentRow: { group: 'main-page', label: 'Hide Entertainment Row', desc: 'Entertainment row.' },
        hideCookingRow: { group: 'main-page', label: 'Hide Cooking Row', desc: 'Cooking row on the home page.' },
        hideFooter: { group: 'main-page', label: 'Hide Footer', desc: 'Hide the site footer entirely.' },

        // Video Page Layout
        hideRelatedOnLive: { group: 'video-page', label: 'Hide Related on Live', desc: 'Hide "Related Media" under the player on live streams.' },
        hideRelatedSidebar: { group: 'video-page', label: 'Hide Related Sidebar', desc: 'Hide the related-videos sidebar.' },
        widenContent: { group: 'video-page', label: 'Widen Content Area', desc: 'Expand the main content (pairs with hidden sidebar).' },
        hideVideoDescription: { group: 'video-page', label: 'Hide Video Description', desc: 'Hide the description, tags, and views block.' },
        hidePausedVideoAds: { group: 'video-page', label: 'Hide Paused-Video Ads', desc: 'Hide the pause-overlay ad canvas.' },

        // Player Controls (hide-X)
        hideRewindButton: { group: 'player-controls', label: 'Hide Rewind', desc: 'Hide the rewind button in the player.' },
        hideFastForwardButton: { group: 'player-controls', label: 'Hide Fast Forward', desc: 'Hide the fast-forward button.' },
        hideCCButton: { group: 'player-controls', label: 'Hide CC Button', desc: 'Hide the (CC) button.' },
        hideAutoplayButton: { group: 'player-controls', label: 'Hide Autoplay Toggle', desc: 'Hide the autoplay toggle in controls.' },
        hideTheaterButton: { group: 'player-controls', label: 'Hide Theater Button', desc: 'Hide the theater-mode button.' },
        hidePipButton: { group: 'player-controls', label: 'Hide PiP Button', desc: 'Hide the picture-in-picture button.' },
        hideFullscreenButton: { group: 'player-controls', label: 'Hide Fullscreen Button', desc: 'Hide the fullscreen button.' },
        hidePlayerRumbleLogo: { group: 'player-controls', label: 'Hide Player Rumble Logo', desc: 'Hide the Rumble logo in the player.' },
        hidePlayerGradient: { group: 'player-controls', label: 'Hide Player Gradient', desc: 'Remove the cloudy gradient at the bottom of the player.' },

        // Video Buttons (below-player)
        hideLikeDislikeButton: { group: 'video-buttons', label: 'Hide Like/Dislike', desc: 'Hide like and dislike buttons.' },
        hideShareButton: { group: 'video-buttons', label: 'Hide Share', desc: 'Hide the share button.' },
        hideRepostButton: { group: 'video-buttons', label: 'Hide Repost', desc: 'Hide the repost button.' },
        hideEmbedButton: { group: 'video-buttons', label: 'Hide Embed', desc: 'Hide the embed button.' },
        hideSaveButton: { group: 'video-buttons', label: 'Hide Save', desc: 'Hide the save-to-playlist button.' },
        hideCommentButton: { group: 'video-buttons', label: 'Hide Comment', desc: 'Hide the main comment button.' },
        hideReportButton: { group: 'video-buttons', label: 'Hide 3-dot Menu', desc: 'Hide the 3-dot menu containing report.' },
        hidePremiumJoinButtons: { group: 'video-buttons', label: 'Hide Premium/Join', desc: 'Hide Rumble Premium and Join buttons.' },

        // Comments (CSS)
        moveReplyButton: { group: 'comments-chat', label: 'Move Reply Button', desc: 'Move Reply next to like/dislike on comments.' },
        hideCommentReportLink: { group: 'comments-chat', label: 'Hide Comment Report', desc: 'Hide the "report" link on comments.' },

        // Chat
        cleanLiveChat: { group: 'comments-chat', label: 'Clean Live Chat UI', desc: 'Hide pinned messages, chat header, and rant UI.' },
    };

    const GROUPS = [
        { id: 'all', label: 'All Settings' },
        { id: 'ad-blocking', label: 'Ad Blocking' },
        { id: 'video-player', label: 'Video Player' },
        { id: 'player-controls', label: 'Player Controls' },
        { id: 'video-page', label: 'Video Page Layout' },
        { id: 'video-buttons', label: 'Video Buttons' },
        { id: 'main-page', label: 'Main Page Layout' },
        { id: 'layout', label: 'Navigation & Chrome' },
        { id: 'theme-layout', label: 'Theme & Layout' },
        { id: 'downloads', label: 'Downloads & Capture' },
        { id: 'history', label: 'History & Bookmarks' },
        { id: 'comments-chat', label: 'Comments & Chat' },
        { id: 'feed-controls', label: 'Feed Controls' },
        { id: 'advanced', label: 'Advanced' },
    ];

    const INTERNAL_SETTING_KEY_PREFIX = '_';
    const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
    const IMPORT_LIMITS = Object.freeze({
        blockedChannels: 2000,
        blockedKeywords: 1000,
        blockedChatters: 2000,
        totalBytes: 4.5 * 1024 * 1024,
    });

    const manifest = chrome.runtime.getManifest();
    const elements = {
        pageShell: document.querySelector('.page-shell'),
        version: document.getElementById('version'),
        exportButton: document.getElementById('export-btn'),
        importButton: document.getElementById('import-btn'),
        importFile: document.getElementById('import-file'),
        resetButton: document.getElementById('reset-btn'),
        storageInfo: document.getElementById('storage-info'),
        status: document.getElementById('status'),
        statFeatures: document.getElementById('stat-features'),
        statSize: document.getElementById('stat-size'),
        statChannels: document.getElementById('stat-channels'),
        statKeywords: document.getElementById('stat-keywords'),
        statChatters: document.getElementById('stat-chatters'),
        openSettingsModalButton: document.getElementById('open-settings-modal-btn'),
        settingsModalShell: document.getElementById('settings-modal-shell'),
        closeSettingsModalButton: document.getElementById('close-settings-modal-btn'),
        settingsSearch: document.getElementById('settings-search'),
        settingsGroups: document.getElementById('settings-groups'),
        settingsList: document.getElementById('settings-list'),
        settingsEmpty: document.getElementById('settings-empty'),
        settingsTotalCount: document.getElementById('settings-total-count'),
        settingsDirtyCount: document.getElementById('settings-dirty-count'),
        settingsProblemChip: document.getElementById('settings-problem-chip'),
        settingsProblemCount: document.getElementById('settings-problem-count'),
        settingsModalSummary: document.getElementById('settings-modal-summary'),
        settingsModalStatus: document.getElementById('settings-modal-status'),
        settingsSaveButton: document.getElementById('settings-save-btn'),
        settingsDiscardButton: document.getElementById('settings-discard-btn'),
        settingsRestoreDefaultsButton: document.getElementById('settings-restore-defaults-btn'),
        settingsClearSearchButton: document.getElementById('settings-clear-search-btn'),
        settingsWorkspaceBanner: document.getElementById('settings-workspace-banner'),
        settingsWorkspaceTitle: document.getElementById('settings-workspace-title'),
        settingsWorkspaceNote: document.getElementById('settings-workspace-note'),
        settingsClearFiltersButton: document.getElementById('settings-clear-filters-btn'),
        settingsEmptyEyebrow: document.querySelector('#settings-empty .settings-empty-eyebrow'),
        settingsEmptyTitle: document.querySelector('#settings-empty .settings-empty-title'),
        settingsEmptyCopy: document.querySelector('#settings-empty .settings-empty-copy'),
        settingsEmptyResetButton: document.getElementById('settings-empty-reset-btn'),
    };

    const state = {
        modalOpen: false,
        storedSettings: {},
        resolvedSettings: {},
        draftSettings: {},
        dirtyKeys: new Set(),
        invalidKeys: new Set(),
        activeGroup: 'all',
        search: '',
        lastFocusedElement: null,
        bodyOverflowBeforeModal: '',
    };

    elements.version.textContent = 'v' + manifest.version;

    // ── Status helpers ──
    function showStatus(message, type) {
        elements.status.textContent = message;
        elements.status.className = 'status ' + type;
    }
    function showModalStatus(message, type) {
        elements.settingsModalStatus.textContent = message;
        elements.settingsModalStatus.className = 'settings-modal-status ' + type;
    }
    function clearModalStatus() {
        elements.settingsModalStatus.textContent = '';
        elements.settingsModalStatus.className = 'settings-modal-status';
    }
    function pluralize(count, singular, plural = singular + 's') {
        return count === 1 ? singular : plural;
    }

    function setButtonBusy(button, busy, busyLabel = '') {
        if (!(button instanceof HTMLButtonElement)) return;
        if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent;
        if (busy) {
            button.setAttribute('aria-busy', 'true');
            if (busyLabel) button.textContent = busyLabel;
            return;
        }
        button.removeAttribute('aria-busy');
        if (button.dataset.idleLabel) button.textContent = button.dataset.idleLabel;
    }

    async function runWithBusyButton(button, busyLabel, task, onSettled = null) {
        const previouslyDisabled = button instanceof HTMLButtonElement ? button.disabled : false;
        if (button instanceof HTMLButtonElement) {
            setButtonBusy(button, true, busyLabel);
            button.disabled = true;
        }
        try {
            return await task();
        } finally {
            if (button instanceof HTMLButtonElement) {
                setButtonBusy(button, false);
                if (typeof onSettled === 'function') onSettled(previouslyDisabled);
                else button.disabled = previouslyDisabled;
            }
        }
    }

    // ── Format helpers ──
    function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    function deepClone(value) {
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }
    function safeSerialize(value, sortKeys = false) {
        try {
            if (sortKeys) {
                return JSON.stringify(value, (_, v) =>
                    v && typeof v === 'object' && !Array.isArray(v)
                        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
                        : v
                );
            }
            return JSON.stringify(value);
        } catch { return String(value); }
    }
    function areValuesEqual(a, b) {
        return safeSerialize(a, true) === safeSerialize(b, true);
    }
    function isPlainObject(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }
    function isSafeObjectKey(key) {
        return typeof key === 'string' && !UNSAFE_OBJECT_KEYS.has(key);
    }
    function sanitizeSettingsObject(settings) {
        if (!isPlainObject(settings)) return {};
        const out = {};
        for (const [k, v] of Object.entries(settings)) {
            if (isSafeObjectKey(k)) out[k] = v;
        }
        return out;
    }
    function sanitizeStringArray(value, limit) {
        if (!Array.isArray(value)) return [];
        const seen = new Set();
        const out = [];
        for (const entry of value) {
            if (typeof entry !== 'string') continue;
            const trimmed = entry.trim().slice(0, 200);
            if (!trimmed || seen.has(trimmed)) continue;
            seen.add(trimmed);
            out.push(trimmed);
            if (limit && out.length >= limit) break;
        }
        return out;
    }

    function humanizeKey(key) {
        const meta = META[key];
        if (meta?.label) return meta.label;
        const normalized = String(key)
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return normalized.split(' ').map((w) => {
            const lower = w.toLowerCase();
            if (['url', 'urls', 'api', 'id', 'ids', 'ui', 'dvr', 'hls', 'mp4', 'vtt', 'srt'].includes(lower)) {
                return lower.toUpperCase();
            }
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        }).join(' ');
    }

    function inferGroup(key) {
        return META[key]?.group || 'advanced';
    }

    function formatValuePreview(value) {
        if (typeof value === 'boolean') return value ? 'On' : 'Off';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') {
            const compact = value.replace(/\s+/g, ' ').trim();
            if (!compact) return 'Empty';
            return compact.length > 60 ? compact.slice(0, 57) + '…' : compact;
        }
        if (Array.isArray(value)) return value.length + (value.length === 1 ? ' item' : ' items');
        if (value && typeof value === 'object') return Object.keys(value).length + ' keys';
        return 'Not set';
    }

    function toDomIdFragment(key) {
        return String(key).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'setting';
    }

    // ── Focus trap ──
    function getFocusableElements(root) {
        if (!root) return [];
        return Array.from(root.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter((el) => {
            if (!(el instanceof HTMLElement)) return false;
            if (el.hidden) return false;
            if (el.getAttribute('aria-hidden') === 'true') return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });
    }
    function trapFocusWithin(root, event) {
        if (event.key !== 'Tab') return;
        const focusable = getFocusableElements(root);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey) {
            if (active === first || !root.contains(active)) { event.preventDefault(); last.focus(); }
            return;
        }
        if (active === last || !root.contains(active)) { event.preventDefault(); first.focus(); }
    }

    // ── Confirmation dialog ──
    function confirmAction({ eyebrow = 'Confirm', title, message, confirmLabel = 'Continue', cancelLabel = 'Cancel', tone = 'default' }) {
        return new Promise((resolve) => {
            const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const shell = document.createElement('div');
            shell.className = 'confirm-shell';
            const backdrop = document.createElement('div');
            backdrop.className = 'confirm-backdrop';
            const dialog = document.createElement('section');
            dialog.className = 'confirm-dialog' + (tone === 'danger' ? ' is-danger' : '');
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'confirm-title');
            dialog.setAttribute('aria-describedby', 'confirm-copy');
            const eyebrowEl = document.createElement('span');
            eyebrowEl.className = 'confirm-eyebrow'; eyebrowEl.textContent = eyebrow;
            const titleEl = document.createElement('h2');
            titleEl.className = 'confirm-title'; titleEl.id = 'confirm-title'; titleEl.textContent = title;
            const copyEl = document.createElement('p');
            copyEl.className = 'confirm-copy'; copyEl.id = 'confirm-copy'; copyEl.textContent = message;
            const actions = document.createElement('div');
            actions.className = 'confirm-actions';
            const cancelButton = document.createElement('button');
            cancelButton.type = 'button'; cancelButton.textContent = cancelLabel;
            const confirmButton = document.createElement('button');
            confirmButton.type = 'button';
            confirmButton.className = tone === 'danger' ? 'danger' : 'primary';
            confirmButton.textContent = confirmLabel;
            actions.append(cancelButton, confirmButton);
            dialog.append(eyebrowEl, titleEl, copyEl, actions);
            shell.append(backdrop, dialog);
            document.body.appendChild(shell);
            const finish = (confirmed) => {
                shell.removeEventListener('keydown', handleKeydown);
                shell.remove();
                requestAnimationFrame(() => previousFocus?.focus?.());
                resolve(confirmed);
            };
            function handleKeydown(event) {
                event.stopPropagation();
                if (event.key === 'Escape') { event.preventDefault(); finish(false); return; }
                trapFocusWithin(dialog, event);
            }
            backdrop.addEventListener('click', () => finish(false));
            cancelButton.addEventListener('click', () => finish(false));
            confirmButton.addEventListener('click', () => finish(true));
            shell.addEventListener('keydown', handleKeydown);
            requestAnimationFrame(() => (tone === 'danger' ? cancelButton : confirmButton).focus());
        });
    }

    // ── Storage & state ──
    function isUserFacingSettingKey(key) {
        return !String(key).startsWith(INTERNAL_SETTING_KEY_PREFIX);
    }

    function getSettingKeys() {
        const keySet = new Set([
            ...Object.keys(DEFAULTS || {}),
            ...Object.keys(state.storedSettings || {}),
            ...Object.keys(state.draftSettings || {}),
        ]);
        return Array.from(keySet)
            .filter(isUserFacingSettingKey)
            .sort((a, b) => humanizeKey(a).localeCompare(humanizeKey(b)));
    }

    function matchesSearch(key, value) {
        if (!state.search) return true;
        const hay = [key, humanizeKey(key), inferGroup(key), META[key]?.desc || '', formatValuePreview(value)].join(' ').toLowerCase();
        return hay.includes(state.search);
    }
    function getActiveGroupLabel() {
        return GROUPS.find((g) => g.id === state.activeGroup)?.label || 'All Settings';
    }
    function updateSettingsSearchState() {
        elements.settingsClearSearchButton.hidden = !elements.settingsSearch.value.trim();
    }
    function clearSettingsFilters({ focusSearch = false, announce = false } = {}) {
        const hadFilters = state.activeGroup !== 'all' || !!elements.settingsSearch.value.trim();
        state.activeGroup = 'all';
        state.search = '';
        elements.settingsSearch.value = '';
        updateSettingsSearchState();
        renderSettingsWorkspace();
        if (announce && hadFilters) showModalStatus('Filters cleared. Showing every setting again.', 'info');
        if (focusSearch) requestAnimationFrame(() => elements.settingsSearch.focus());
    }
    function getVisibleKeys() {
        return getSettingKeys().filter((key) => {
            if (!matchesSearch(key, state.draftSettings[key])) return false;
            if (state.activeGroup === 'all') return true;
            return inferGroup(key) === state.activeGroup;
        });
    }

    function summarizeData(settings) {
        return {
            enabledFeatures: Object.entries(settings).filter(([k, v]) => typeof v === 'boolean' && v && META[k]).length,
            totalFeatures: Object.entries(DEFAULTS).filter(([k, v]) => typeof v === 'boolean' && META[k]).length,
            sizeBytes: new Blob([JSON.stringify(settings)]).size,
            channels: (settings.blockedChannels || []).length,
            keywords: (settings.blockedKeywords || []).length,
            chatters: (settings.blockedChatters || []).length,
        };
    }

    async function renderStorageInfo() {
        try {
            const store = await chrome.storage.local.get(STORAGE_KEY);
            const settings = { ...DEFAULTS, ...(store[STORAGE_KEY] || {}) };
            const s = summarizeData(settings);
            elements.statFeatures.textContent = `${s.enabledFeatures}/${s.totalFeatures}`;
            elements.statSize.textContent = formatBytes(s.sizeBytes);
            elements.statChannels.textContent = String(s.channels);
            elements.statKeywords.textContent = String(s.keywords);
            elements.statChatters.textContent = String(s.chatters);
            elements.storageInfo.textContent =
                `Local storage is ready: ${s.enabledFeatures} of ${s.totalFeatures} feature toggles enabled, about ${formatBytes(s.sizeBytes)} stored. ` +
                `${s.channels} blocked ${pluralize(s.channels, 'channel')}, ` +
                `${s.keywords} blocked ${pluralize(s.keywords, 'keyword')}, ` +
                `and ${s.chatters} blocked ${pluralize(s.chatters, 'chatter')} are saved for backup or reset.`;
        } catch (err) {
            elements.storageInfo.textContent = 'Unable to read extension storage.';
            for (const el of [elements.statFeatures, elements.statSize, elements.statChannels, elements.statKeywords, elements.statChatters]) {
                el.textContent = '—';
            }
            showStatus('Storage read failed: ' + err.message, 'error');
        }
    }

    async function exportSettings() {
        try {
            const store = await chrome.storage.local.get(STORAGE_KEY);
            const settings = store[STORAGE_KEY] || {};

            // Collect per-site data from an open Rumble tab if one exists.
            // This matches the multi-key backup behaviour of the Astra Deck
            // options page — a reset/restore cycle actually round-trips
            // watch progress, bookmarks, search history, rant archives, etc.
            // If no Rumble tab is open, we fall back to settings-only.
            let localData = {};
            let tabsTouched = 0;
            try {
                const resp = await chrome.runtime.sendMessage({ action: 'getLocalData' });
                if (resp?.ok) {
                    localData = resp.data || {};
                    tabsTouched = resp.tabs || 0;
                }
            } catch { /* no tabs / no receiver → settings-only export */ }

            const data = {
                settings: sanitizeSettingsObject(settings),
                localData, // empty object when no Rumble tab was available
                exportVersion: 2,
                exportDate: new Date().toISOString(),
                rumblexVersion: manifest.version,
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(blob),
                download: 'rumblex_settings_' + new Date().toISOString().slice(0, 10) + '.json',
            });
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 60000);

            const localKeys = Object.keys(localData).length;
            const suffix = localKeys
                ? ` Included ${localKeys} per-site ${localKeys === 1 ? 'key' : 'keys'} from your open Rumble tab.`
                : (tabsTouched === 0 ? ' Tip: open a Rumble tab first to include watch history, bookmarks, etc.' : '');
            showStatus('Settings exported successfully.' + suffix, 'success');
        } catch (err) {
            showStatus('Export failed: ' + err.message, 'error');
        }
    }

    // Known numeric bounds — anything imported outside these ranges gets
    // clamped so bad data can't wedge the extension (e.g. splitRatio = 9999).
    const NUMERIC_BOUNDS = {
        splitRatio: { min: 20, max: 95 },
        playbackSpeed: { min: 0.1, max: 4 },
    };
    const VALID_THEMES = new Set(['catppuccin', 'youtube', 'midnight', 'rumbleGreen']);
    const VALID_SITE_THEMES = new Set(['system', 'dark', 'light']);

    function filterToKnownKeys(obj) {
        // Drop any top-level key not present in DEFAULTS. This prevents junk
        // keys from polluting storage after an import while still allowing
        // newer builds to carry forward unknown values via migration if ever
        // needed (DEFAULTS is the source of truth for supported settings).
        const known = new Set(Object.keys(DEFAULTS));
        const out = {};
        for (const [k, v] of Object.entries(obj)) if (known.has(k)) out[k] = v;
        return out;
    }

    function normaliseImported(raw) {
        const sanitized = filterToKnownKeys(sanitizeSettingsObject(raw));

        // List fields
        if (Array.isArray(sanitized.blockedChannels)) sanitized.blockedChannels = sanitizeStringArray(sanitized.blockedChannels, IMPORT_LIMITS.blockedChannels);
        if (Array.isArray(sanitized.blockedKeywords)) sanitized.blockedKeywords = sanitizeStringArray(sanitized.blockedKeywords, IMPORT_LIMITS.blockedKeywords);
        if (Array.isArray(sanitized.blockedChatters)) sanitized.blockedChatters = sanitizeStringArray(sanitized.blockedChatters, IMPORT_LIMITS.blockedChatters);
        if (!Array.isArray(sanitized.autoplayQueue)) delete sanitized.autoplayQueue;
        if (!Array.isArray(sanitized.hiddenCategories)) delete sanitized.hiddenCategories;

        // Numeric bounds
        for (const [key, { min, max }] of Object.entries(NUMERIC_BOUNDS)) {
            if (typeof sanitized[key] === 'number' && Number.isFinite(sanitized[key])) {
                sanitized[key] = Math.max(min, Math.min(max, sanitized[key]));
            } else if (key in sanitized) {
                delete sanitized[key]; // invalid number → fall back to default
            }
        }

        // Theme — reject unknown strings rather than applying a typo
        if (typeof sanitized.theme === 'string' && !VALID_THEMES.has(sanitized.theme)) {
            delete sanitized.theme;
        }
        if (typeof sanitized.siteTheme === 'string' && !VALID_SITE_THEMES.has(sanitized.siteTheme)) {
            delete sanitized.siteTheme;
        }

        // sponsorSegments must be a plain object keyed by videoId; drop if not
        if (sanitized.sponsorSegments && !isPlainObject(sanitized.sponsorSegments)) {
            delete sanitized.sponsorSegments;
        }
        return sanitized;
    }

    async function importSettings(file) {
        if (!file) return;
        try {
            if (file.size > 10 * 1024 * 1024) throw new Error('Import file exceeds 10 MB limit');
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data || typeof data !== 'object') throw new Error('Invalid format');

            // Back-compat: v1 export = { settings, exportVersion: 1 }.
            //              v2 export = { settings, localData, exportVersion: 2 }.
            //              ancient   = raw settings object at top level.
            let incoming;
            if (isPlainObject(data.settings)) incoming = data.settings;
            else if (isPlainObject(data)) incoming = data;
            else throw new Error('No settings block found');
            const sanitized = normaliseImported(incoming);

            if (new Blob([JSON.stringify(sanitized)]).size > IMPORT_LIMITS.totalBytes) {
                throw new Error('Import data is too large for extension storage');
            }

            await chrome.storage.local.set({ [STORAGE_KEY]: sanitized });

            // v2+: restore per-site data to any open Rumble tabs. If no tab
            // is open we silently skip — the payload is already gone from the
            // imported file after this return, so the user should reimport
            // after opening a Rumble tab. We tell them so in the toast.
            let restoreSummary = '';
            const localData = isPlainObject(data.localData) ? data.localData : null;
            if (localData && Object.keys(localData).length) {
                try {
                    const resp = await chrome.runtime.sendMessage({ action: 'setLocalData', data: localData });
                    if (resp?.ok) {
                        if (resp.tabs === 0) {
                            restoreSummary = ' Open a Rumble tab and re-import to restore per-site data (watch history, bookmarks).';
                        } else {
                            restoreSummary = ` Restored ${resp.written} per-site ${resp.written === 1 ? 'key' : 'keys'} to ${resp.tabs} open ${resp.tabs === 1 ? 'tab' : 'tabs'}.`;
                        }
                    }
                } catch { /* no receiver — silently skip */ }
            }

            await renderStorageInfo();
            await refreshSettingsState({ resetDraft: true });
            if (state.modalOpen) renderSettingsWorkspace();
            showStatus('Settings imported. Reload open Rumble tabs to apply.' + restoreSummary, 'success');
        } catch (err) {
            showStatus('Import failed: ' + err.message, 'error');
        } finally {
            elements.importFile.value = '';
        }
    }

    async function resetSettings() {
        const confirmed = await confirmAction({
            eyebrow: 'Destructive action',
            title: 'Reset all local data?',
            message: `This clears ${BRAND_NAME} settings from extension storage AND per-site data ` +
                     `from open Rumble tabs: watch progress, watch/search history, bookmarks, ` +
                     `volume memory, and SponsorBlock/rant archives. This cannot be undone.`,
            confirmLabel: 'Reset All Data',
            tone: 'danger',
        });
        if (!confirmed) return;
        try {
            // 1) Clear extension storage (settings + popup UI state).
            await chrome.storage.local.remove(STORAGE_KEY);
            try { await chrome.storage.local.remove('rx_popup_ui'); } catch {}

            // 2) Ask any open Rumble tabs to wipe their own localStorage.
            // Tabs that aren't open simply won't be touched — next time they
            // load, their defaults kick in. We report what the broadcast
            // cleared so users get honest feedback.
            let broadcast = { ok: false };
            try {
                broadcast = await chrome.runtime.sendMessage({ action: 'clearLocalData' });
            } catch (e) {
                // No response is fine; it just means no Rumble tabs were open.
            }

            await renderStorageInfo();
            await refreshSettingsState({ resetDraft: true });
            if (state.modalOpen) renderSettingsWorkspace();
            const tabsTouched = broadcast?.tabs || 0;
            const cleared = broadcast?.cleared || 0;
            const suffix = tabsTouched
                ? ` Cleared ${cleared} per-site ${cleared === 1 ? 'key' : 'keys'} across ${tabsTouched} open ${tabsTouched === 1 ? 'Rumble tab' : 'Rumble tabs'}.`
                : ' Open Rumble tabs will reset on next load.';
            showStatus('All settings cleared.' + suffix, 'success');
        } catch (err) {
            showStatus('Reset failed: ' + err.message, 'error');
        }
    }

    async function refreshSettingsState({ resetDraft = false } = {}) {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        state.storedSettings = sanitizeSettingsObject(result[STORAGE_KEY] || {});
        state.resolvedSettings = { ...deepClone(DEFAULTS), ...deepClone(state.storedSettings) };
        if (resetDraft || !state.modalOpen || state.dirtyKeys.size === 0) {
            state.draftSettings = deepClone(state.resolvedSettings);
            state.dirtyKeys.clear();
            state.invalidKeys.clear();
        }
    }

    function updateDirtyStateForKey(key) {
        if (areValuesEqual(state.draftSettings[key], state.resolvedSettings[key])) {
            state.dirtyKeys.delete(key);
        } else {
            state.dirtyKeys.add(key);
        }
    }

    function updateModalHeaderState() {
        const totalCount = getSettingKeys().length;
        const visibleCount = getVisibleKeys().length;
        const dirtyCount = state.dirtyKeys.size;
        const invalidCount = state.invalidKeys.size;
        const searchValue = elements.settingsSearch.value.trim();
        const hasFilters = state.activeGroup !== 'all' || !!searchValue;
        const activeGroupLabel = getActiveGroupLabel();

        elements.settingsTotalCount.textContent = String(totalCount);
        elements.settingsDirtyCount.textContent = String(dirtyCount);
        elements.settingsProblemCount.textContent = String(invalidCount);
        elements.settingsProblemChip.hidden = invalidCount === 0;
        elements.settingsSaveButton.disabled = dirtyCount === 0 || invalidCount > 0;
        elements.settingsDiscardButton.disabled = dirtyCount === 0 && invalidCount === 0;
        elements.settingsRestoreDefaultsButton.disabled = Object.keys(DEFAULTS).length === 0;
        elements.settingsClearFiltersButton.hidden = !hasFilters;
        updateSettingsSearchState();

        const banner = elements.settingsWorkspaceBanner;
        banner.classList.remove('is-warning', 'is-error', 'is-filtered');

        let title = 'Everything is in sync';
        let note = 'Changes stay local until you save them.';

        if (invalidCount > 0) {
            banner.classList.add('is-error');
            title = `${invalidCount} ${pluralize(invalidCount, 'field')} need${invalidCount === 1 ? 's' : ''} attention`;
            note = 'Fix the highlighted cards before saving.';
        } else if (dirtyCount > 0) {
            banner.classList.add('is-warning');
            title = `${dirtyCount} unsaved ${pluralize(dirtyCount, 'change')} ready`;
            note = 'Review the highlighted cards, then save to apply. Reload open Rumble tabs after save.';
        } else if (hasFilters) {
            banner.classList.add('is-filtered');
            title = visibleCount === 0 ? 'Filtered view is empty' : `Showing ${visibleCount} ${pluralize(visibleCount, 'setting')}`;
            if (state.activeGroup !== 'all' && searchValue) note = `Viewing ${activeGroupLabel.toLowerCase()} settings matching "${searchValue}".`;
            else if (state.activeGroup !== 'all') note = `Viewing only the ${activeGroupLabel.toLowerCase()} group.`;
            else note = `Showing settings matching "${searchValue}".`;
        }
        elements.settingsWorkspaceTitle.textContent = title;
        elements.settingsWorkspaceNote.textContent = note;

        let summary = hasFilters
            ? `${visibleCount} of ${totalCount} ${pluralize(totalCount, 'setting')} visible`
            : `${totalCount} ${pluralize(totalCount, 'setting')} ready to review`;
        if (state.activeGroup !== 'all' && searchValue) summary += ` in ${activeGroupLabel} for "${searchValue}"`;
        else if (state.activeGroup !== 'all') summary += ` in ${activeGroupLabel}`;
        else if (searchValue) summary += ` matching "${searchValue}"`;
        summary += '.';
        if (dirtyCount > 0) summary += ` ${dirtyCount} unsaved ${pluralize(dirtyCount, 'change')} ready to apply.`;
        if (invalidCount > 0) summary += ` ${invalidCount} ${pluralize(invalidCount, 'field')} need${invalidCount === 1 ? 's' : ''} attention.`;
        elements.settingsModalSummary.textContent = summary;
    }

    function updateCardState(card, key) {
        const dirty = state.dirtyKeys.has(key);
        const invalid = state.invalidKeys.has(key);
        const currentValue = state.draftSettings[key];
        const storedValue = state.resolvedSettings[key];
        const defaultValue = DEFAULTS[key];
        card.classList.toggle('is-dirty', dirty);
        card.classList.toggle('is-invalid', invalid);
        card.querySelectorAll('input, textarea, select').forEach((control) => {
            control.setAttribute('aria-invalid', invalid ? 'true' : 'false');
        });
        const badge = card.querySelector('.settings-item-state');
        if (badge) {
            badge.classList.toggle('is-problem', invalid);
            badge.hidden = !dirty && !invalid;
            badge.textContent = invalid ? 'Needs Fix' : dirty ? 'Pending Save' : '';
        }
        const footer = card.querySelector('.settings-item-footer');
        if (footer && !card.classList.contains('is-complex')) footer.hidden = !dirty && !invalid;
        const hint = card.querySelector('.settings-item-hint');
        if (hint) {
            if (invalid) {
                hint.textContent = 'Fix this field before saving. Invalid draft values stay local to this editor.';
            } else if (dirty) {
                if (defaultValue !== undefined && areValuesEqual(currentValue, defaultValue)) {
                    hint.textContent = `Back at the default (${formatValuePreview(defaultValue)}). Save to replace the stored value.`;
                } else if (defaultValue === undefined) {
                    hint.textContent = `Stored: ${formatValuePreview(storedValue)}. Save to keep this custom value.`;
                } else {
                    hint.textContent = `Stored: ${formatValuePreview(storedValue)} • Default: ${formatValuePreview(defaultValue)}. Save to apply.`;
                }
            } else {
                hint.textContent = defaultValue === undefined
                    ? 'Stored setting with no default.'
                    : areValuesEqual(storedValue, defaultValue)
                        ? `At the default: ${formatValuePreview(defaultValue)}.`
                        : `Stored: ${formatValuePreview(storedValue)} • Default: ${formatValuePreview(defaultValue)}.`;
            }
        }
    }

    function focusFirstInvalidControl() {
        const card = elements.settingsList.querySelector('.settings-item.is-invalid');
        if (!card) return;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        const ctl = card.querySelector('input, textarea, select');
        if (ctl instanceof HTMLElement) {
            ctl.focus();
            if (typeof ctl.select === 'function' && (ctl.tagName === 'INPUT' || ctl.tagName === 'TEXTAREA')) ctl.select();
        }
    }

    function parseListInput(rawValue, referenceArray) {
        const lines = rawValue.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const template = Array.isArray(referenceArray) ? referenceArray.find((item) => item != null) : undefined;
        const itemType = typeof template;
        if (itemType === 'number') {
            const parsed = lines.map(Number);
            if (parsed.some(Number.isNaN)) throw new Error('List expects numbers');
            return parsed;
        }
        if (itemType === 'boolean') {
            return lines.map((l) => {
                const lo = l.toLowerCase();
                if (lo === 'true') return true;
                if (lo === 'false') return false;
                throw new Error('List expects true/false values');
            });
        }
        return lines;
    }

    function applyControlAccessibility(control, key, meta, opts = {}) {
        control.id = meta.controlId;
        control.name = key;
        control.setAttribute('aria-labelledby', meta.titleId);
        control.setAttribute('aria-describedby', `${meta.descriptionId} ${meta.hintId}`);
        if ('autocomplete' in control) control.autocomplete = opts.autocomplete || 'off';
        if ('spellcheck' in control && opts.spellcheck === false) control.spellcheck = false;
        return control;
    }

    // Keys whose values are restricted to a small known set. Rendering these
    // as <select> dropdowns prevents users from typing typos that would
    // silently fall back to the default at runtime.
    const ENUM_CHOICES = {
        theme: [
            { value: 'catppuccin', label: 'Catppuccin Mocha' },
            { value: 'youtube', label: 'YouTubify' },
            { value: 'midnight', label: 'Midnight AMOLED' },
            { value: 'rumbleGreen', label: 'Rumble Green' },
        ],
        siteTheme: [
            { value: 'system', label: 'System' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
        ],
    };

    function inferControlKind(value, defaultValue, key) {
        if (key && ENUM_CHOICES[key]) return 'enum';
        const ref = value !== undefined ? value : defaultValue;
        if (typeof ref === 'boolean') return 'toggle';
        if (typeof ref === 'number') return 'number';
        if (Array.isArray(ref)) {
            return ref.every((item) => item == null || ['string', 'number', 'boolean'].includes(typeof item)) ? 'list' : 'json';
        }
        if (ref && typeof ref === 'object') return 'json';
        if (typeof ref === 'string' && (ref.includes('\n') || ref.length > 70)) return 'textarea';
        return 'text';
    }
    function formatControlKindLabel(k) {
        return { toggle: 'Toggle', number: 'Number', list: 'List', json: 'JSON', textarea: 'Long Text', enum: 'Choice' }[k] || 'Text';
    }

    function renderEnumControl(card, key, value, meta) {
        const select = document.createElement('select');
        applyControlAccessibility(select, key, meta);
        // Apply consistent styling via the same selectors as other inputs.
        select.style.cssText = 'width:100%;background:rgba(6,8,12,0.8);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;font:inherit;font-size:12px;';
        const choices = ENUM_CHOICES[key] || [];
        for (const choice of choices) {
            const opt = document.createElement('option');
            opt.value = choice.value;
            opt.textContent = choice.label;
            if (choice.value === value) opt.selected = true;
            select.appendChild(opt);
        }
        select.addEventListener('change', () => {
            state.draftSettings[key] = select.value;
            state.invalidKeys.delete(key);
            updateDirtyStateForKey(key);
            updateCardState(card, key);
            updateModalHeaderState();
        });
        return select;
    }

    function renderTextControl(card, key, value, isMultiline, meta) {
        const input = document.createElement(isMultiline ? 'textarea' : 'input');
        if (!isMultiline) input.type = 'text';
        applyControlAccessibility(input, key, meta, { spellcheck: false });
        input.value = value == null ? '' : String(value);
        input.addEventListener('input', () => {
            state.draftSettings[key] = input.value;
            state.invalidKeys.delete(key);
            updateDirtyStateForKey(key);
            updateCardState(card, key);
            updateModalHeaderState();
        });
        return input;
    }
    function renderNumberControl(card, key, value, meta) {
        const input = document.createElement('input');
        input.type = 'number';
        input.inputMode = Number.isInteger(value) ? 'numeric' : 'decimal';
        applyControlAccessibility(input, key, meta);
        input.value = String(value ?? 0);
        input.step = Number.isInteger(value) ? '1' : 'any';
        input.addEventListener('input', () => {
            if (input.value.trim() === '') {
                state.invalidKeys.add(key);
            } else {
                const n = Number(input.value);
                if (Number.isNaN(n)) state.invalidKeys.add(key);
                else { state.draftSettings[key] = n; state.invalidKeys.delete(key); updateDirtyStateForKey(key); }
            }
            updateCardState(card, key);
            updateModalHeaderState();
        });
        return input;
    }
    function renderToggleControl(card, key, value, meta) {
        const label = document.createElement('label');
        label.className = 'settings-item-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(value);
        applyControlAccessibility(input, key, meta);
        const track = document.createElement('span');
        track.className = 'settings-item-toggle-track';
        input.addEventListener('change', () => {
            state.draftSettings[key] = input.checked;
            state.invalidKeys.delete(key);
            updateDirtyStateForKey(key);
            updateCardState(card, key);
            updateModalHeaderState();
        });
        label.append(input, track);
        return label;
    }
    function renderListControl(card, key, value, defaultValue, meta) {
        const ta = document.createElement('textarea');
        applyControlAccessibility(ta, key, meta, { spellcheck: false });
        ta.value = Array.isArray(value) ? value.join('\n') : '';
        ta.addEventListener('input', () => {
            try {
                state.draftSettings[key] = parseListInput(ta.value, value ?? defaultValue);
                state.invalidKeys.delete(key);
                updateDirtyStateForKey(key);
            } catch { state.invalidKeys.add(key); }
            updateCardState(card, key);
            updateModalHeaderState();
        });
        return ta;
    }
    function renderJsonControl(card, key, value, meta) {
        const ta = document.createElement('textarea');
        applyControlAccessibility(ta, key, meta, { spellcheck: false });
        ta.value = JSON.stringify(value ?? {}, null, 2);
        ta.addEventListener('input', () => {
            try {
                const parsed = JSON.parse(ta.value);
                if (value != null && typeof value === 'object' && (typeof parsed !== 'object' || parsed === null)) {
                    state.invalidKeys.add(key);
                } else {
                    state.draftSettings[key] = parsed;
                    state.invalidKeys.delete(key);
                    updateDirtyStateForKey(key);
                }
            } catch { state.invalidKeys.add(key); }
            updateCardState(card, key);
            updateModalHeaderState();
        });
        return ta;
    }

    function renderSettingsGroups() {
        const keys = getSettingKeys().filter((k) => matchesSearch(k, state.draftSettings[k]));
        const counts = new Map();
        GROUPS.forEach((g) => counts.set(g.id, 0));
        keys.forEach((k) => {
            const g = inferGroup(k);
            counts.set(g, (counts.get(g) || 0) + 1);
            counts.set('all', (counts.get('all') || 0) + 1);
        });
        if (state.activeGroup !== 'all' && (counts.get(state.activeGroup) || 0) === 0) state.activeGroup = 'all';

        const frag = document.createDocumentFragment();
        GROUPS.forEach((group) => {
            if (group.id !== 'all' && (counts.get(group.id) || 0) === 0) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'settings-group-button' + (state.activeGroup === group.id ? ' active' : '');
            btn.dataset.group = group.id;
            if (state.activeGroup === group.id) btn.setAttribute('aria-current', 'true');
            const label = document.createElement('span');
            label.textContent = group.label;
            const count = document.createElement('span');
            count.className = 'settings-group-count';
            count.textContent = String(counts.get(group.id) || 0);
            btn.append(label, count);
            btn.addEventListener('click', () => { state.activeGroup = group.id; renderSettingsWorkspace(); });
            frag.appendChild(btn);
        });
        elements.settingsGroups.replaceChildren(frag);
    }

    function createSettingsCard(key) {
        const currentValue = state.draftSettings[key];
        const defaultValue = DEFAULTS[key];
        const groupId = inferGroup(key);
        const groupLabel = GROUPS.find((g) => g.id === groupId)?.label || 'Advanced';
        const controlKind = inferControlKind(currentValue, defaultValue, key);
        const controlKindLabel = formatControlKindLabel(controlKind);
        const isToggle = controlKind === 'toggle';
        const isComplex = controlKind === 'list' || controlKind === 'json' || controlKind === 'textarea';
        const idBase = toDomIdFragment(key);
        const controlMeta = {
            controlId: `settings-control-${idBase}`,
            titleId: `settings-title-${idBase}`,
            descriptionId: `settings-description-${idBase}`,
            hintId: `settings-hint-${idBase}`,
        };

        const card = document.createElement('article');
        card.className = 'settings-item' + (isToggle ? ' is-toggle' : '') + (isComplex ? ' is-complex' : '');
        card.dataset.key = key;
        card.tabIndex = -1;
        card.title = key;
        card.setAttribute('aria-labelledby', controlMeta.titleId);

        const titleRow = document.createElement('div');
        titleRow.className = 'settings-item-title-row';
        const title = document.createElement('h3');
        title.className = 'settings-item-title';
        title.id = controlMeta.titleId;
        title.textContent = humanizeKey(key);
        titleRow.appendChild(title);

        const groupTag = document.createElement('span');
        groupTag.className = 'settings-item-group';
        groupTag.textContent = groupLabel;
        titleRow.appendChild(groupTag);

        if (isComplex) {
            const typeBadge = document.createElement('span');
            typeBadge.className = 'settings-item-type';
            typeBadge.textContent = controlKindLabel;
            titleRow.appendChild(typeBadge);
        }

        const stateBadge = document.createElement('span');
        stateBadge.className = 'settings-item-badge settings-item-state';
        stateBadge.hidden = true;
        titleRow.appendChild(stateBadge);

        if (isToggle) {
            const right = document.createElement('div');
            right.className = 'settings-item-right';
            right.appendChild(renderToggleControl(card, key, currentValue, controlMeta));
            card.appendChild(titleRow);
            card.appendChild(right);
        } else {
            card.appendChild(titleRow);
            const desc = META[key]?.desc;
            if (desc || isComplex) {
                const description = document.createElement('p');
                description.className = 'settings-item-description';
                description.id = controlMeta.descriptionId;
                description.textContent = desc || `Editing a ${controlKindLabel.toLowerCase()} setting.`;
                card.appendChild(description);
            }
            const wrap = document.createElement('div');
            wrap.className = 'settings-item-control';
            if (controlKind === 'number') wrap.appendChild(renderNumberControl(card, key, currentValue, controlMeta));
            else if (controlKind === 'list') wrap.appendChild(renderListControl(card, key, currentValue, defaultValue, controlMeta));
            else if (controlKind === 'json') wrap.appendChild(renderJsonControl(card, key, currentValue, controlMeta));
            else if (controlKind === 'enum') wrap.appendChild(renderEnumControl(card, key, currentValue, controlMeta));
            else wrap.appendChild(renderTextControl(card, key, currentValue, controlKind === 'textarea', controlMeta));
            card.appendChild(wrap);
        }

        const footer = document.createElement('div');
        footer.className = 'settings-item-footer';
        if (!isComplex) footer.hidden = true;
        const hint = document.createElement('div');
        hint.className = 'settings-item-hint';
        hint.id = controlMeta.hintId;
        footer.appendChild(hint);

        const resetBtn = document.createElement('button');
        resetBtn.type = 'button';
        resetBtn.className = 'settings-reset-inline';
        resetBtn.textContent = 'Reset';
        resetBtn.disabled = defaultValue === undefined;
        if (defaultValue === undefined) {
            resetBtn.title = 'No default available.';
            resetBtn.setAttribute('aria-label', `Reset ${humanizeKey(key)} (no default available)`);
        } else {
            resetBtn.title = `Reset ${humanizeKey(key)} to ${formatValuePreview(defaultValue)}`;
            resetBtn.setAttribute('aria-label', `Reset ${humanizeKey(key)} to ${formatValuePreview(defaultValue)}`);
        }
        resetBtn.addEventListener('click', () => {
            if (defaultValue === undefined) return;
            state.draftSettings[key] = deepClone(defaultValue);
            state.invalidKeys.delete(key);
            updateDirtyStateForKey(key);
            renderSettingsWorkspace({ preserveScroll: true });
            showModalStatus(`${humanizeKey(key)} restored to its default. Save to apply.`, 'info');
        });
        footer.appendChild(resetBtn);
        card.appendChild(footer);

        updateCardState(card, key);
        return card;
    }

    function updateSettingsEmptyState(totalCount) {
        const searchValue = elements.settingsSearch.value.trim();
        const activeGroupLabel = getActiveGroupLabel();
        const hasFilters = state.activeGroup !== 'all' || !!searchValue;
        let eyebrow = 'Filtered View';
        let title = 'No settings match this view';
        let copy = 'Try a broader search or switch back to All Settings.';
        let showReset = hasFilters;
        if (totalCount === 0) {
            eyebrow = 'Catalog'; title = 'No settings are available';
            copy = 'No defaults or stored settings were found.'; showReset = false;
        } else if (state.activeGroup !== 'all' && searchValue) {
            title = 'No settings match this search here';
            copy = `Try a broader search or clear the ${activeGroupLabel.toLowerCase()} filter.`;
        } else if (state.activeGroup !== 'all') {
            title = `No settings found in ${activeGroupLabel}`;
            copy = 'Switch groups or jump back to All Settings.';
        } else if (searchValue) {
            title = 'No settings match this search';
            copy = 'Try a shorter keyword or clear the filter.';
        }
        elements.settingsEmptyEyebrow.textContent = eyebrow;
        elements.settingsEmptyTitle.textContent = title;
        elements.settingsEmptyCopy.textContent = copy;
        elements.settingsEmptyResetButton.hidden = !showReset;
    }

    function renderSettingsList() {
        const visibleKeys = getVisibleKeys();
        const totalCount = getSettingKeys().length;
        elements.settingsEmpty.hidden = visibleKeys.length > 0;
        elements.settingsList.hidden = visibleKeys.length === 0;
        if (visibleKeys.length === 0) {
            elements.settingsList.replaceChildren();
            updateSettingsEmptyState(totalCount);
            return;
        }
        const frag = document.createDocumentFragment();
        visibleKeys.forEach((k) => frag.appendChild(createSettingsCard(k)));
        elements.settingsList.replaceChildren(frag);
    }

    function renderSettingsWorkspace({ preserveScroll = false } = {}) {
        const prev = preserveScroll ? elements.settingsList.scrollTop : 0;
        renderSettingsGroups();
        renderSettingsList();
        updateModalHeaderState();
        if (preserveScroll) elements.settingsList.scrollTop = prev;
    }

    async function openSettingsModal() {
        try {
            await refreshSettingsState({ resetDraft: true });
        } catch (err) {
            showStatus('Unable to open settings right now: ' + err.message, 'error');
            return;
        }
        clearModalStatus();
        state.activeGroup = 'all';
        state.search = '';
        elements.settingsSearch.value = '';
        updateSettingsSearchState();
        state.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        state.bodyOverflowBeforeModal = document.body.style.overflow;
        state.modalOpen = true;
        if (elements.pageShell) {
            elements.pageShell.setAttribute('aria-hidden', 'true');
            elements.pageShell.inert = true;
        }
        document.body.style.overflow = 'hidden';
        elements.settingsModalShell.hidden = false;
        renderSettingsWorkspace();
        requestAnimationFrame(() => elements.settingsSearch.focus());
    }

    async function requestCloseSettingsModal() {
        if (state.dirtyKeys.size > 0 || state.invalidKeys.size > 0) {
            const parts = [];
            if (state.dirtyKeys.size > 0) parts.push(`${state.dirtyKeys.size} unsaved ${pluralize(state.dirtyKeys.size, 'change')}`);
            if (state.invalidKeys.size > 0) parts.push(`${state.invalidKeys.size} ${pluralize(state.invalidKeys.size, 'invalid field')}`);
            const ok = await confirmAction({
                eyebrow: 'Unsaved draft',
                title: 'Close without saving?',
                message: `This will discard ${parts.join(' and ')} and close the settings editor.`,
                confirmLabel: 'Discard Draft',
                tone: 'danger',
            });
            if (!ok) return;
        }
        state.modalOpen = false;
        elements.settingsModalShell.hidden = true;
        if (elements.pageShell) {
            elements.pageShell.removeAttribute('aria-hidden');
            elements.pageShell.inert = false;
        }
        document.body.style.overflow = state.bodyOverflowBeforeModal;
        clearModalStatus();
        const restoreTarget = state.lastFocusedElement && state.lastFocusedElement.isConnected
            ? state.lastFocusedElement
            : elements.openSettingsModalButton;
        state.lastFocusedElement = null;
        requestAnimationFrame(() => restoreTarget?.focus());
    }

    async function saveSettingsDraft() {
        if (state.invalidKeys.size > 0) {
            showModalStatus('Fix invalid fields before saving.', 'error');
            focusFirstInvalidControl();
            return;
        }
        try {
            let merged;
            if (state.dirtyKeys.size > 0) {
                const fresh = await chrome.storage.local.get(STORAGE_KEY);
                const latest = fresh[STORAGE_KEY] || {};
                const base = { ...deepClone(DEFAULTS), ...deepClone(latest) };
                for (const k of state.dirtyKeys) base[k] = deepClone(state.draftSettings[k]);
                merged = base;
            } else {
                merged = deepClone(state.draftSettings);
            }
            const next = sanitizeSettingsObject(merged);
            await chrome.storage.local.set({ [STORAGE_KEY]: next });

            state.storedSettings = deepClone(next);
            state.resolvedSettings = { ...deepClone(DEFAULTS), ...deepClone(next) };
            state.draftSettings = deepClone(state.resolvedSettings);
            state.dirtyKeys.clear();
            state.invalidKeys.clear();

            renderSettingsWorkspace({ preserveScroll: true });
            await renderStorageInfo();
            showStatus('Settings saved. Reload open Rumble tabs to apply.', 'success');
            showModalStatus('Settings saved. Reload open Rumble tabs to apply.', 'success');
        } catch (err) {
            showModalStatus('Save failed: ' + err.message, 'error');
        }
    }

    function discardDraft() {
        state.draftSettings = deepClone(state.resolvedSettings);
        state.dirtyKeys.clear();
        state.invalidKeys.clear();
        renderSettingsWorkspace({ preserveScroll: true });
        showModalStatus('Draft discarded. You are back in sync with stored settings.', 'info');
    }

    function restoreDefaultsDraft() {
        state.draftSettings = deepClone(DEFAULTS);
        state.invalidKeys.clear();
        state.dirtyKeys.clear();
        getSettingKeys().forEach((k) => updateDirtyStateForKey(k));
        renderSettingsWorkspace({ preserveScroll: true });
        showModalStatus('Defaults loaded into the draft. Save to apply them.', 'info');
    }

    // ── Event wiring ──
    elements.exportButton.addEventListener('click', () => {
        void runWithBusyButton(elements.exportButton, 'Exporting…', exportSettings);
    });
    elements.importButton.addEventListener('click', () => elements.importFile.click());
    elements.importFile.addEventListener('change', (e) => {
        const [file] = e.target.files || [];
        void runWithBusyButton(elements.importButton, 'Importing…', () => importSettings(file));
    });
    elements.resetButton.addEventListener('click', () => {
        void runWithBusyButton(elements.resetButton, 'Confirming…', resetSettings);
    });
    elements.openSettingsModalButton.addEventListener('click', () => {
        void runWithBusyButton(elements.openSettingsModalButton, 'Loading…', openSettingsModal);
    });
    elements.closeSettingsModalButton.addEventListener('click', () => void requestCloseSettingsModal());
    elements.settingsModalShell.addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-close-settings-modal')) void requestCloseSettingsModal();
    });

    let _searchDebounce = null;
    elements.settingsSearch.addEventListener('input', () => {
        state.search = elements.settingsSearch.value.trim().toLowerCase();
        updateSettingsSearchState();
        clearTimeout(_searchDebounce);
        _searchDebounce = setTimeout(() => renderSettingsWorkspace(), 200);
    });
    elements.settingsClearSearchButton.addEventListener('click', () => {
        clearTimeout(_searchDebounce);
        elements.settingsSearch.value = '';
        state.search = '';
        updateSettingsSearchState();
        renderSettingsWorkspace();
        elements.settingsSearch.focus();
    });
    elements.settingsClearFiltersButton.addEventListener('click', () => {
        clearTimeout(_searchDebounce);
        clearSettingsFilters({ focusSearch: true, announce: true });
    });
    elements.settingsEmptyResetButton.addEventListener('click', () => {
        clearTimeout(_searchDebounce);
        clearSettingsFilters({ focusSearch: true, announce: true });
    });
    elements.settingsSaveButton.addEventListener('click', () => {
        void runWithBusyButton(elements.settingsSaveButton, 'Saving…', saveSettingsDraft, () => updateModalHeaderState());
    });
    elements.settingsDiscardButton.addEventListener('click', discardDraft);
    elements.settingsRestoreDefaultsButton.addEventListener('click', restoreDefaultsDraft);

    document.addEventListener('keydown', (event) => {
        if (!state.modalOpen) return;
        if (event.key === 'Escape') { void requestCloseSettingsModal(); return; }
        if (event.key === 'Tab') {
            const dialog = elements.settingsModalShell.querySelector('.settings-modal');
            trapFocusWithin(dialog, event);
        }
    });

    window.addEventListener('beforeunload', (event) => {
        if (!state.modalOpen) return;
        if (state.dirtyKeys.size === 0 && state.invalidKeys.size === 0) return;
        event.preventDefault();
        event.returnValue = '';
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        void (async () => {
            try {
                if (areaName !== 'local') return;
                await renderStorageInfo();
                if (!changes[STORAGE_KEY]) return;
                if (!state.modalOpen) return;
                const newValue = changes[STORAGE_KEY].newValue;
                if (newValue && areValuesEqual(newValue, state.storedSettings)) return;
                if (state.dirtyKeys.size === 0 && state.invalidKeys.size === 0) {
                    await refreshSettingsState({ resetDraft: true });
                    renderSettingsWorkspace();
                } else {
                    showModalStatus('Stored settings changed elsewhere. Save or discard your draft to resync.', 'info');
                }
            } catch (err) {
                console.warn('[RumbleX options] storage change handler failed:', err);
            }
        })();
    });

    void renderStorageInfo().catch((err) => {
        console.warn('[RumbleX options] initial render failed:', err);
        showStatus('Could not read extension storage: ' + err.message, 'error');
    });
})();
