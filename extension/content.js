// RumbleX v1.9.3 - Content Script
// Rumble enhancement suite - Chrome/Firefox extension
'use strict';

// ── Version ──
const VERSION = chrome.runtime?.getManifest?.()?.version || '1.9.3';

// ── Settings Manager (chrome.storage.local) ──
const Settings = {
    _cache: null,
    _ready: false,
    _defaults: {
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
        // v1.8.0 additions
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
        // Main Page Layout (CSS hide-X toggles — all default OFF)
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
    },
    _writeTimer: null,
    _pendingWrite: false,
    // Tracks keys the user has changed locally but hasn't yet been flushed to
    // chrome.storage. If an external change arrives inside the debounce
    // window, we merge external values UNDER these pending keys — otherwise
    // the user's in-flight toggle would be silently discarded.
    _pendingKeys: null,
    // Track the last-known value of rx_settings we either read from or wrote
    // to storage. Used by the onChanged listener to tell "this change was me"
    // from "this change was a different tab/window/options page".
    _lastWritten: null,
    _externalHandlers: [],

    async init() {
        const data = await chrome.storage.local.get('rx_settings');
        this._cache = { ...this._defaults, ...(data.rx_settings || {}) };
        this._lastWritten = JSON.stringify(this._cache);
        this._pendingKeys = new Set();
        this._ready = true;
    },
    get(key) {
        if (!this._cache) return this._defaults[key];
        return this._cache[key];
    },
    set(key, val) {
        if (!this._cache) this._cache = { ...this._defaults };
        this._cache[key] = val;
        if (!this._pendingKeys) this._pendingKeys = new Set();
        this._pendingKeys.add(key);
        this._scheduleWrite();
    },
    // Coalesce rapid writes into a single storage.local.set call. Without
    // this, features that update settings on keystroke (search history,
    // volume slider, etc.) could thrash storage. 120ms is short enough to
    // feel instant and long enough to batch bursts.
    _scheduleWrite() {
        this._pendingWrite = true;
        clearTimeout(this._writeTimer);
        this._writeTimer = setTimeout(() => this._flush(), 120);
    },
    _flush() {
        if (!this._pendingWrite || !this._cache) return;
        this._pendingWrite = false;
        const snapshot = JSON.stringify(this._cache);
        this._lastWritten = snapshot;
        // Writes confirmed: clear the pending-key set so the NEXT external
        // event is free to overwrite any key again.
        this._pendingKeys?.clear();
        try {
            chrome.storage.local.set({ rx_settings: this._cache });
        } catch (e) {
            console.warn('[RumbleX] settings flush failed:', e);
        }
    },
    toggle(key) {
        const v = !this.get(key);
        this.set(key, v);
        return v;
    },
    onExternalChange(fn) {
        this._externalHandlers.push(fn);
    },
    // Called by chrome.storage.onChanged when rx_settings changed in another
    // tab or from the options page. Refreshes our cache in place and fires
    // subscribers so features can react (show a toast, re-run, etc.).
    //
    // `newValue === undefined` means the key was removed (e.g. options-page
    // reset): reset our cache to defaults instead of silently ignoring so
    // subsequent Settings.get() calls return the right value without needing
    // a page reload.
    _applyExternal(newValue) {
        const isReset = newValue === undefined;
        if (!isReset && (!newValue || typeof newValue !== 'object')) return;
        const incoming = isReset ? '__reset__' : JSON.stringify(newValue);
        if (incoming === this._lastWritten) return; // our own write, ignore

        if (isReset) {
            // Reset is explicit user intent: wipe pending too so we don't
            // resurrect discarded values on the next flush.
            this._pendingKeys?.clear();
            this._cache = { ...this._defaults };
        } else {
            // Build the merged cache from external, then layer our still-
            // pending changes ON TOP so an in-flight toggle isn't lost just
            // because another tab happened to save first.
            const merged = { ...this._defaults, ...newValue };
            if (this._cache && this._pendingKeys && this._pendingKeys.size > 0) {
                for (const k of this._pendingKeys) {
                    if (k in this._cache) merged[k] = this._cache[k];
                }
            }
            this._cache = merged;
        }
        this._lastWritten = incoming;
        for (const fn of this._externalHandlers) {
            try { fn(isReset); } catch (e) { console.warn('[RumbleX] external-change handler failed:', e); }
        }
    },
};

if (chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (!changes.rx_settings) return;
        Settings._applyExternal(changes.rx_settings.newValue);
    });
}
// Ensure pending writes land before the page unloads.
window.addEventListener('pagehide', () => Settings._flush(), { capture: true });

// ── Page Detection ──
const Page = {
    isWatch: () => /^\/v[a-z0-9]+-/.test(location.pathname) || location.pathname.startsWith('/video/'),
    isFeed: () => location.pathname === '/' || location.pathname === '/subscriptions' || location.pathname === '/for-you',
    isHome: () => location.pathname === '/',
    isEmbed: () => location.pathname.startsWith('/embed/'),
    isSearch: () => location.pathname === '/search/video' || location.pathname.startsWith('/search/'),
    isChannel: () => location.pathname.startsWith('/c/') || location.pathname.startsWith('/user/'),
    isLive: () => !!document.querySelector('.media-description-info-stream-time') || !!document.querySelector('#chat-history-list'),
};

// ── Anti-FOUC: Inject immediately at document-start ──
const ANTI_FOUC_CSS = `
    html.rumblex-active #pause-ads__container,
    html.rumblex-active #pause-ads__backdrop,
    html.rumblex-active #pause-ads__backdrop_click,
    html.rumblex-active #pause-ads__play-button-container,
    html.rumblex-active #pause-ads__entity,
    html.rumblex-active .host-read-ad-entry,
    html.rumblex-active .js-host-read-container,
    html.rumblex-active .js-host-read-ad-entry__text,
    html.rumblex-active .js-rac-desktop-container,
    html.rumblex-active .js-rac-tablet-container,
    html.rumblex-active .js-rac-mobile-container,
    html.rumblex-active [hx-get*="premium-value-prop"],
    html.rumblex-active .btn-premium-lg,
    html.rumblex-active .ima-sdk-frame,
    html.rumblex-active .lrt-container,
    html.rumblex-active [class*="premium-banner"] {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        overflow: hidden !important;
    }
`;
const earlyStyle = document.createElement('style');
earlyStyle.id = 'rumblex-antifouc';
earlyStyle.textContent = ANTI_FOUC_CSS;
(document.head || document.documentElement).appendChild(earlyStyle);
document.documentElement.classList.add('rumblex-active');

// ── Wait for DOM ready ──
function onReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
        fn();
    }
}

// ── CSS Injector ──
function injectStyle(css, id) {
    const existing = document.getElementById(id);
    if (existing) { existing.textContent = css; return existing; }
    const el = document.createElement('style');
    el.id = id;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
    return el;
}

// ── Utility ──
function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return (root || document).querySelectorAll(sel); }

function waitFor(selector, timeout = 8000) {
    return new Promise((resolve, reject) => {
        const el = qs(selector);
        if (el) return resolve(el);
        const obs = new MutationObserver(() => {
            const found = qs(selector);
            if (found) { obs.disconnect(); clearTimeout(timer); resolve(found); }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
        const timer = setTimeout(() => { obs.disconnect(); reject(new Error('Timeout: ' + selector)); }, timeout);
    });
}

// ═══════════════════════════════════════════
//  FEATURE: Ad Nuker
// ═══════════════════════════════════════════
const AdNuker = {
    id: 'adNuker',
    name: 'Ad Nuker',
    _styleEl: null,

    _css: `
        /* Pause/overlay ads */
        #pause-ads__container,
        #pause-ads__backdrop,
        #pause-ads__backdrop_click,
        #pause-ads__play-button-container,
        #pause-ads__entity { display: none !important; }
        /* Host-read ads */
        .host-read-ad-entry,
        .js-host-read-container,
        .js-host-read-ad-entry__text { display: none !important; }
        /* RAC (Rumble Ad Container) */
        .js-rac-desktop-container,
        .js-rac-tablet-container,
        .js-rac-mobile-container { display: none !important; }
        /* Premium nags */
        [hx-get*="premium-value-prop"],
        .btn-premium-lg,
        a[href*="/premium"][class*="bg-"],
        [class*="premium-value-prop"],
        [class*="premium-banner"],
        [id*="premium__promo"] { display: none !important; }
        /* External ad iframes */
        iframe[src*="googlead"],
        iframe[src*="doubleclick"],
        iframe[src*="pagead"],
        .ima-sdk-frame { display: none !important; }
        /* LRT (Locals/Rumble tracking) container */
        .lrt-container { display: none !important; }
        /* Upcoming video overlay (auto-play next) */
        .js-player-upcoming-button { display: none !important; }
    `,

    _domClean() {
        const selectors = [
            '#pause-ads__container',
            '.host-read-ad-entry',
            '.js-host-read-container',
            '.js-rac-desktop-container',
            '.js-rac-tablet-container',
            '.js-rac-mobile-container',
        ];
        for (const sel of selectors) {
            for (const el of qsa(sel)) el.remove();
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-adnuker');
        this._domClean();
        this._obs = new MutationObserver(() => this._domClean());
        this._obs.observe(document.body, { childList: true, subtree: true });
    },
    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Feed Cleanup
// ═══════════════════════════════════════════
const FeedCleanup = {
    id: 'feedCleanup',
    name: 'Feed Cleanup',
    _styleEl: null,

    _css: `
        .thumbnail__grid a[href*="/premium"],
        .streams__container a[href*="/premium"] { display: none !important; }
        .text-link-green[href*="/premium"] { display: none !important; }
        .js-rac-desktop-container,
        .js-rac-tablet-container,
        .js-rac-mobile-container { display: none !important; }
        footer.page__footer { display: none !important; }
    `,

    _repostCSS: `
        .videostream--repost { display: none !important; }
    `,

    _wideCSS: `
        .constrained {
            max-width: 100% !important;
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
        }
        .thumbnail__grid { gap: 12px !important; }
        @supports (display:grid) {
            .thumbnail__grid { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 1600px) {
            @supports (display:grid) { .thumbnail__grid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; } }
        }
        @media (max-width: 1200px) {
            @supports (display:grid) { .thumbnail__grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
        }
        @media (max-width: 900px) {
            @supports (display:grid) { .thumbnail__grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
        }
        @media (max-width: 600px) {
            @supports (display:grid) { .thumbnail__grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
        }
        .videostream__footer { padding: 6px 4px 8px !important; }
        .homepage-section .constrained { max-width: 100% !important; }
    `,

    _repostStyleEl: null,
    _wideStyleEl: null,

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-feedcleanup');
        if (Settings.get('hideReposts')) {
            this._repostStyleEl = injectStyle(this._repostCSS, 'rx-hidereposts');
        }
        if (Settings.get('wideLayout') && (Page.isHome() || Page.isFeed())) {
            this._wideStyleEl = injectStyle(this._wideCSS, 'rx-widelayout');
        }
    },
    destroy() {
        this._styleEl?.remove();
        this._repostStyleEl?.remove();
        this._wideStyleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Hide Premium
// ═══════════════════════════════════════════
const HidePremium = {
    id: 'hidePremium',
    name: 'Hide Premium',
    _styleEl: null,

    _css: `
        .videostream:has(.videostream__label a[href="/premium"]) {
            display: none !important;
        }
    `,

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-hidepremium');
    },

    destroy() {
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Category Filter (Homepage)
// ═══════════════════════════════════════════
const CategoryFilter = {
    id: 'categoryFilter',
    name: 'Category Filter',
    _styleEl: null,

    _allCategories: [
        { id: 'editor-picks', label: "Editor's Picks" },
        { id: 'shorts', label: 'Shorts' },
        { id: 'continue-watching', label: 'Continue Watching' },
        { id: 'top-live', label: 'Top Live' },
        { id: 'premium-videos', label: 'Premium Videos' },
        { id: 'personal-recommendations', label: 'Recommendations' },
        { id: 'reposts', label: 'Reposts' },
        { id: 'gaming', label: 'Gaming' },
        { id: 'finance', label: 'Finance' },
        { id: 'live-videos', label: 'Live Videos' },
        { id: 'featured-playlists', label: 'Featured Playlists' },
        { id: 'sports', label: 'Sports' },
        { id: 'viral', label: 'Viral' },
        { id: 'podcasts', label: 'Podcasts' },
        { id: 'leaderboard', label: 'Leaderboard' },
        { id: 'vlogs', label: 'Vlogs' },
        { id: 'news', label: 'News' },
        { id: 'science', label: 'Science' },
        { id: 'music', label: 'Music' },
        { id: 'entertainment', label: 'Entertainment' },
        { id: 'cooking', label: 'Cooking' },
    ],

    _buildCSS() {
        const hidden = Settings.get('hiddenCategories') || [];
        if (!hidden.length) return '';
        const selectors = hidden.flatMap(id => [
            `#section-${id}`,
            `.constrained:has(#section-${id})`,
        ]);
        return selectors.join(',\n') + ' { display: none !important; }';
    },

    _apply() {
        if (this._styleEl) this._styleEl.remove();
        const css = this._buildCSS();
        if (css) this._styleEl = injectStyle(css, 'rx-catfilter');
    },

    init() {
        if (!Page.isHome()) return;
        this._apply();
    },

    destroy() {
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Dark Theme Enhancement
// ═══════════════════════════════════════════
const THEMES = {
    catppuccin: {
        label: 'Catppuccin Mocha',
        base: '#1e1e2e', mantle: '#181825', crust: '#11111b',
        surface0: '#313244', surface1: '#45475a', surface2: '#585b70',
        text: '#cdd6f4', subtext: '#a6adc8', subtext0: '#6c7086',
        accent: '#89b4fa', green: '#a6e3a1', red: '#f38ba8',
        yellow: '#f9e2af', peach: '#fab387', brand: '#89b4fa',
        selectionBg: 'rgba(137,180,250,0.25)',
        hoverBg: 'rgba(49,50,68,0.3)',
    },
    youtube: {
        label: 'YouTubify',
        base: '#0f0f0f', mantle: '#0f0f0f', crust: '#0f0f0f',
        surface0: '#272727', surface1: '#3f3f3f', surface2: '#535353',
        text: '#f1f1f1', subtext: '#aaaaaa', subtext0: '#717171',
        accent: '#3ea6ff', green: '#2ba640', red: '#ff0000',
        yellow: '#ffb84d', peach: '#ff8c42', brand: '#ff0000',
        selectionBg: 'rgba(62,166,255,0.25)',
        hoverBg: 'rgba(255,255,255,0.1)',
    },
    midnight: {
        label: 'Midnight AMOLED',
        base: '#000000', mantle: '#000000', crust: '#000000',
        surface0: '#111111', surface1: '#1a1a1a', surface2: '#2a2a2a',
        text: '#e4e4e7', subtext: '#a1a1aa', subtext0: '#71717a',
        accent: '#818cf8', green: '#4ade80', red: '#f87171',
        yellow: '#fbbf24', peach: '#fb923c', brand: '#818cf8',
        selectionBg: 'rgba(129,140,248,0.25)',
        hoverBg: 'rgba(255,255,255,0.06)',
    },
    rumbleGreen: {
        label: 'Rumble Green',
        base: '#141c0f', mantle: '#0f1509', crust: '#0a0f06',
        surface0: '#1e2a14', surface1: '#2a3a1e', surface2: '#3a4f2a',
        text: '#d6e8c4', subtext: '#a8c490', subtext0: '#6e8f56',
        accent: '#85c742', green: '#85c742', red: '#e55c5c',
        yellow: '#d4a843', peach: '#c98042', brand: '#85c742',
        selectionBg: 'rgba(133,199,66,0.25)',
        hoverBg: 'rgba(30,42,20,0.5)',
    },
};

const DarkEnhance = {
    id: 'darkEnhance',
    name: 'Dark Theme',
    _styleEl: null,
    _playerStyleEl: null,

    _buildCSS(t) {
        return `
        :root {
            --rx-base: ${t.base};
            --rx-mantle: ${t.mantle};
            --rx-crust: ${t.crust};
            --rx-surface0: ${t.surface0};
            --rx-surface1: ${t.surface1};
            --rx-surface2: ${t.surface2};
            --rx-text: ${t.text};
            --rx-subtext: ${t.subtext};
            --rx-subtext0: ${t.subtext0};
            --rx-accent: ${t.accent};
            --rx-green: ${t.green};
            --rx-red: ${t.red};
            --rx-yellow: ${t.yellow};
            --rx-peach: ${t.peach};
            --rx-overlay: rgba(0, 0, 0, 0.85);
        }

        /* ── Base ── */
        html.rumblex-active body {
            background-color: var(--rx-crust) !important;
            color: var(--rx-text) !important;
        }

        /* ── Header / Nav ── */
        html.rumblex-active .header {
            background: var(--rx-mantle) !important;
            border-bottom: 1px solid var(--rx-surface0) !important;
        }
        html.rumblex-active nav,
        html.rumblex-active .sidenav,
        html.rumblex-active #main-menu,
        html.rumblex-active .main-menu-item__nav,
        html.rumblex-active .hover-menu {
            background: var(--rx-mantle) !important;
        }
        html.rumblex-active .main-menu-item-label,
        html.rumblex-active .main-menu-heading {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .main-menu-item__nav:hover,
        html.rumblex-active .main-menu-item-channel:hover {
            background: var(--rx-surface0) !important;
        }
        html.rumblex-active .main-menu-divider {
            border-color: var(--rx-surface0) !important;
        }

        /* ── Search ── */
        html.rumblex-active .header-search-field,
        html.rumblex-active .header-search input {
            background: var(--rx-base) !important;
            color: var(--rx-text) !important;
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .header-search-field:focus,
        html.rumblex-active .header-search input:focus {
            border-color: var(--rx-accent) !important;
        }

        /* ── Video Cards / Feed ── */
        html.rumblex-active .videostream {
            background: var(--rx-base) !important;
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .videostream:hover {
            background: var(--rx-surface0) !important;
        }
        html.rumblex-active .videostream__footer {
            color: var(--rx-subtext) !important;
        }
        html.rumblex-active .videostream__date,
        html.rumblex-active .videostream__views,
        html.rumblex-active .mediaList-timestamp,
        html.rumblex-active .mediaList-earnings {
            color: var(--rx-subtext0) !important;
        }
        html.rumblex-active .thumbnail__title,
        html.rumblex-active .videostream__link {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .channel__link {
            color: var(--rx-subtext) !important;
        }

        /* ── Homepage Sections ── */
        html.rumblex-active .homepage-content {
            background: var(--rx-crust) !important;
        }
        html.rumblex-active .homepage-heading__title,
        html.rumblex-active .homepage-heading {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .homepage-featured {
            background: var(--rx-mantle) !important;
            border-color: var(--rx-surface0) !important;
        }

        /* ── Video Page ── */
        html.rumblex-active .media-container,
        html.rumblex-active .main-and-sidebar,
        html.rumblex-active .media-description,
        html.rumblex-active .media-description-section {
            background: var(--rx-crust) !important;
            color: var(--rx-text) !important;
        }
        html.rumblex-active .video-header-container__title {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .media-heading-name {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .media-heading-num-followers {
            color: var(--rx-subtext0) !important;
        }
        html.rumblex-active .media-description-info-views,
        html.rumblex-active .media-description-info-stream-time,
        html.rumblex-active .streamed-on {
            color: var(--rx-subtext) !important;
        }

        /* ── Rating / Votes ── */
        html.rumblex-active .rumbles-vote-pill {
            background: var(--rx-surface0) !important;
            border-color: var(--rx-surface1) !important;
        }
        html.rumblex-active .rumbles-vote-up { color: var(--rx-green) !important; }
        html.rumblex-active .rumbles-vote-down { color: var(--rx-red) !important; }
        html.rumblex-active .rating-bar {
            background: var(--rx-surface0) !important;
        }
        html.rumblex-active .rating-bar__fill {
            background: var(--rx-green) !important;
        }

        /* ── Comments ── */
        html.rumblex-active .comment-item {
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .comment-text {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .comments-meta-author {
            color: var(--rx-accent) !important;
        }
        html.rumblex-active .comments-sort-by {
            background: var(--rx-surface0) !important;
            color: var(--rx-text) !important;
            border-color: var(--rx-surface1) !important;
        }
        html.rumblex-active .comment-actions button {
            color: var(--rx-subtext) !important;
        }

        /* ── Related Videos Sidebar ── */
        html.rumblex-active .mediaList-item {
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .mediaList-item:hover {
            background: ${t.hoverBg} !important;
        }
        html.rumblex-active .mediaList-heading {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .mediaList-by-heading {
            color: var(--rx-subtext) !important;
        }

        /* ── Buttons ── */
        html.rumblex-active .btn-grey {
            background: var(--rx-surface0) !important;
            color: var(--rx-text) !important;
            border-color: var(--rx-surface1) !important;
        }
        html.rumblex-active .btn-grey:hover {
            background: var(--rx-surface1) !important;
        }

        /* ── Chat ── */
        html.rumblex-active .chat--header {
            background: var(--rx-mantle) !important;
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .chat--input {
            background: var(--rx-base) !important;
            color: var(--rx-text) !important;
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .chat--rant-button {
            background: var(--rx-surface0) !important;
        }

        /* ── Popouts / Dropdowns ── */
        html.rumblex-active .popout__menu-container {
            background: var(--rx-base) !important;
            border-color: var(--rx-surface0) !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
        }
        html.rumblex-active .popout__menu-button:hover {
            background: var(--rx-surface0) !important;
        }

        /* ── Notifications ── */
        html.rumblex-active .user-notifications {
            background: var(--rx-base) !important;
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .user-notifications--header {
            border-color: var(--rx-surface0) !important;
        }

        /* ── Footer ── */
        html.rumblex-active .page__footer {
            background: var(--rx-mantle) !important;
            color: var(--rx-subtext0) !important;
        }
        html.rumblex-active .foot__nav-item a,
        html.rumblex-active .foot__legal-item a {
            color: var(--rx-subtext) !important;
        }

        /* ── Scrollbar ── */
        html.rumblex-active ::-webkit-scrollbar { width: 8px; height: 8px; }
        html.rumblex-active ::-webkit-scrollbar-track { background: var(--rx-crust); }
        html.rumblex-active ::-webkit-scrollbar-thumb {
            background: var(--rx-surface1);
            border-radius: 4px;
        }
        html.rumblex-active ::-webkit-scrollbar-thumb:hover {
            background: var(--rx-accent);
        }

        /* ── Selection ── */
        html.rumblex-active ::selection {
            background: ${t.selectionBg};
            color: var(--rx-text);
        }

        /* ── Links ── */
        html.rumblex-active .media-description a,
        html.rumblex-active .media-description-tags-container a {
            color: var(--rx-accent) !important;
        }

        /* ── Verification badge ── */
        html.rumblex-active .verification-badge-icon { opacity: 0.9; }

        /* ── Player Progress Bar & Controls ── */
        html.rumblex-active rum-player-control-progress .rum-progress-thumb {
            border-color: ${t.brand} !important;
        }
        html.rumblex-active rum-player-control-progress .rum-progress-hovered {
            background-color: ${t.brand} !important;
            opacity: 0.5 !important;
        }
        html.rumblex-active {
            --brand-500: ${t.brand} !important;
            --brand-500-rgb: unset !important;
            --rumble-green: ${t.brand} !important;
        }
        html.rumblex-active .bg-green,
        html.rumblex-active rum-button[state="primary"] {
            background-color: ${t.brand} !important;
        }
        html.rumblex-active rum-button[state="ghost"] {
            border-color: ${t.brand} !important;
        }
        `;
    },

    init() {
        if (!Settings.get(this.id)) return;
        const themeId = Settings.get('theme') || 'catppuccin';
        const t = THEMES[themeId] || THEMES.catppuccin;
        this._styleEl = injectStyle(this._buildCSS(t), 'rx-darkenhance');
    },
    destroy() {
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Theater Split
// ═══════════════════════════════════════════
const TheaterSplit = {
    id: 'theaterSplit',
    name: 'Theater Split',

    _isSplit: false,
    _isActive: false,
    _isLive: false,
    _activeTab: 'chat',
    _splitWrapper: null,
    _origPlayerParent: null,
    _origPlayerNext: null,
    _origChatParent: null,
    _origChatNext: null,
    _origCommentsParent: null,
    _origCommentsNext: null,
    _positionedEls: [],
    _wheelHandler: null,
    _touchStartY: 0,
    _touchHandler: null,
    _rightWheelHandler: null,
    _rightTouchHandler: null,
    _playerResizeObs: null,
    _styleEl: null,
    _windowResizeHandler: null,

    _css: `
        html.rx-theater,
        html.rx-theater body { overflow: hidden !important; }
        html.rx-theater .header,
        html.rx-theater .page__footer,
        html.rx-theater nav.sidenav,
        html.rx-theater .media-page-related-media-mobile { display: none !important; }
        html.rx-theater main.nonconstrained { visibility: hidden !important; }

        #rx-split-wrapper {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 9999;
            display: flex;
            flex-direction: row;
            background: #000;
            overflow: hidden;
        }
        #rx-split-left {
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
            position: relative;
            overflow: hidden;
        }
        #rx-split-left #videoPlayer,
        #rx-split-left .video-player {
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            max-height: none !important;
        }
        #rx-split-left .videoPlayer-Rumble-cls {
            width: 100% !important;
            height: 100% !important;
            max-height: none !important;
            aspect-ratio: unset !important;
        }
        #rx-split-left .videoPlayer-Rumble-cls > div {
            position: absolute !important;
            inset: 0 !important;
        }
        #rx-split-left video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
        }

        #rx-split-divider {
            flex: 0 0 0px;
            width: 0;
            cursor: col-resize;
            background: rgba(255,255,255,0.06);
            transition: flex-basis 0.35s cubic-bezier(.4,0,.2,1),
                        width 0.35s cubic-bezier(.4,0,.2,1),
                        background 0.15s;
            position: relative;
            z-index: 10;
        }
        #rx-split-divider:hover,
        #rx-split-divider.rx-dragging { background: rgba(137,180,250,0.35); }
        #rx-split-divider::after {
            content: '';
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%,-50%);
            width: 4px; height: 32px;
            border-radius: 2px;
            background: rgba(255,255,255,0.25);
            opacity: 0;
            transition: opacity 0.2s;
        }
        #rx-split-divider:hover::after { opacity: 1; }

        #rx-split-right {
            flex: 0 0 0;
            width: 0;
            overflow: hidden;
            opacity: 0;
            background: var(--rx-base, #1e1e2e);
            transition: flex-basis 0.4s cubic-bezier(.4,0,.2,1),
                        opacity 0.35s ease;
            display: flex;
            flex-direction: column;
        }
        #rx-split-right.rx-expanded {
            opacity: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }
        #rx-split-right.rx-tabbed { overflow: hidden !important; }
        #rx-split-right::-webkit-scrollbar { width: 5px; }
        #rx-split-right::-webkit-scrollbar-track { background: transparent; }
        #rx-split-right::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.14);
            border-radius: 3px;
        }
        #rx-split-right::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); }

        #rx-split-right .media-page-comments-container,
        #rx-split-right #video-comments,
        #rx-split-right .comments-1 {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
        }
        #rx-split-right .comment-item {
            padding: 8px 12px !important;
            border-bottom: 1px solid rgba(255,255,255,0.06) !important;
        }
        #rx-split-right .comments-meta-author { font-size: 12px !important; }
        #rx-split-right .comment-text { font-size: 13px !important; line-height: 1.4 !important; }


        #rx-split-right .rx-panel-header {
            padding: 12px 12px 10px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            flex-shrink: 0;
            display: flex;
            align-items: flex-start;
            gap: 10px;
        }
        #rx-split-right .rx-panel-header .rx-header-info { flex: 1; min-width: 0; }
        #rx-split-right .rx-panel-header h3 {
            margin: 0 0 4px;
            font-size: 15px;
            font-weight: 600;
            color: var(--rx-text, #cdd6f4);
            line-height: 1.3;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        #rx-split-right .rx-panel-header .rx-channel {
            font-size: 12px;
            color: var(--rx-subtext, #a6adc8);
        }
        #rx-split-right .rx-panel-header .rx-header-actions {
            display: flex;
            gap: 6px;
            flex-shrink: 0;
            align-items: center;
        }
        #rx-split-right .rx-panel-header .rx-hdr-btn {
            width: 32px; height: 32px;
            border-radius: 50%;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, border-color 0.15s, transform 0.15s;
            text-decoration: none;
            padding: 0;
        }
        #rx-split-right .rx-panel-header .rx-hdr-btn:hover {
            background: rgba(255,255,255,0.12);
            border-color: rgba(137,180,250,0.4);
            transform: scale(1.1);
        }
        #rx-split-right .rx-panel-header .rx-hdr-btn svg { width: 16px; height: 16px; }
        #rx-split-right .rx-panel-header #rx-hdr-home:hover { border-color: rgba(133,213,81,0.5); }
        #rx-split-right .rx-panel-header #rx-hdr-settings svg {
            transition: transform 0.3s cubic-bezier(.4,0,.2,1);
        }

        #rx-tab-bar {
            display: flex;
            flex-shrink: 0;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            background: rgba(0,0,0,0.15);
        }
        .rx-tab {
            flex: 1;
            padding: 9px 0;
            text-align: center;
            font-size: 12px;
            font-weight: 600;
            color: var(--rx-subtext, #a6adc8);
            cursor: pointer;
            border: none;
            background: transparent;
            border-bottom: 2px solid transparent;
            transition: color 0.15s, border-color 0.2s, background 0.15s;
            letter-spacing: 0.3px;
        }
        .rx-tab:hover {
            color: var(--rx-text, #cdd6f4);
            background: rgba(255,255,255,0.03);
        }
        .rx-tab.rx-tab-active {
            color: var(--rx-accent, #89b4fa);
            border-bottom-color: var(--rx-accent, #89b4fa);
        }

        #rx-tab-chat {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        #rx-tab-chat .media-page-chat-aside-chat,
        #rx-tab-chat .media-page-chat-aside-chat-wrapper-fixed {
            position: static !important;
            width: 100% !important;
            height: 100% !important;
            top: auto !important;
            right: auto !important;
            display: flex !important;
            flex-direction: column !important;
        }
        #rx-tab-chat .media-page-chat-container-toggle-btn { display: none !important; }
        #rx-tab-chat .chat--header { flex-shrink: 0; }
        #rx-tab-chat #chat-history-list {
            flex: 1;
            overflow-y: auto !important;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        #rx-tab-chat #chat-history-list::-webkit-scrollbar { width: 5px; }
        #rx-tab-chat #chat-history-list::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.14);
            border-radius: 3px;
        }
        #rx-tab-chat .chat-form-overflow-wrapper { flex-shrink: 0; }

        #rx-tab-comments {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }
        #rx-tab-comments::-webkit-scrollbar { width: 5px; }
        #rx-tab-comments::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.14);
            border-radius: 3px;
        }

        .rx-tab-content { display: none; }
        .rx-tab-content.rx-tab-visible { display: flex; }

        html.rx-theater .media-page-chat-aside-chat { display: none !important; }
        #rx-tab-chat .media-page-chat-aside-chat { display: flex !important; }

        #rx-collapse-strip {
            position: sticky;
            top: 0;
            z-index: 15;
            height: 3px;
            background: transparent;
            transition: background 0.2s, height 0.2s;
            cursor: n-resize;
            flex-shrink: 0;
        }
        #rx-collapse-strip:hover {
            height: 6px;
            background: linear-gradient(180deg, rgba(137,180,250,0.3) 0%, transparent 100%);
        }
    `,

    _buildOverlay() {
        const wrapper = document.createElement('div');
        wrapper.id = 'rx-split-wrapper';

        const left = document.createElement('div');
        left.id = 'rx-split-left';


        const divider = document.createElement('div');
        divider.id = 'rx-split-divider';

        const right = document.createElement('div');
        right.id = 'rx-split-right';

        wrapper.appendChild(left);
        wrapper.appendChild(divider);
        wrapper.appendChild(right);

        return { wrapper, left, divider, right };
    },

    _initDividerDrag(divider, left, right) {
        divider.addEventListener('mousedown', (e) => {
            e.preventDefault();
            divider.classList.add('rx-dragging');
            const wrapper = this._splitWrapper;
            const totalW = wrapper.getBoundingClientRect().width;
            const startX = e.clientX;
            const startLeftFrac = left.getBoundingClientRect().width / totalW * 100;

            const shield = document.createElement('div');
            shield.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;cursor:col-resize;';
            document.body.appendChild(shield);

            const onMove = (me) => {
                const dx = me.clientX - startX;
                const newLeft = Math.max(30, Math.min(80, startLeftFrac + (dx / totalW * 100)));
                const newRight = 100 - newLeft;
                right.style.flexBasis = newRight + '%';
                Settings.set('splitRatio', Math.round(newLeft));
            };

            const onUp = () => {
                divider.classList.remove('rx-dragging');
                shield.remove();
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
            };

            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
        });
    },

    _expandSplit() {
        if (this._isSplit) return;
        this._isSplit = true;
        document.documentElement.classList.add('rx-split');

        const right = qs('#rx-split-right');
        const divider = qs('#rx-split-divider');
        if (!right || !divider) return;

        const leftPct = Settings.get('splitRatio') || 75;
        const rightPct = 100 - leftPct;

        divider.style.flexBasis = '6px';
        divider.style.width = '6px';
        right.style.flexBasis = rightPct + '%';
        right.classList.add('rx-expanded');

        this._populateRight(right);
        this._attachRightScrollHandlers(right);
    },

    _collapseSplit() {
        if (!this._isSplit) return;
        this._isSplit = false;
        document.documentElement.classList.remove('rx-split');

        const right = qs('#rx-split-right');
        const divider = qs('#rx-split-divider');
        if (!right || !divider) return;

        right.style.flexBasis = '0';
        right.classList.remove('rx-expanded');
        divider.style.flexBasis = '0';
        divider.style.width = '0';

        this._detachRightScrollHandlers();
    },

    _detectLive() {
        return !!qs('.media-page-chat-aside-chat') || !!qs('#chat-history-list');
    },

    _switchTab(tabName) {
        this._activeTab = tabName;
        const right = qs('#rx-split-right');
        if (!right) return;
        for (const tab of qsa('.rx-tab', right)) {
            tab.classList.toggle('rx-tab-active', tab.dataset.tab === tabName);
        }
        for (const panel of qsa('.rx-tab-content', right)) {
            panel.classList.toggle('rx-tab-visible', panel.id === 'rx-tab-' + tabName);
        }
    },

    _buildHeader() {
        const header = document.createElement('div');
        header.className = 'rx-panel-header';

        const titleEl = qs('.video-header-container__title') || qs('h1');
        const channelEl = qs('.media-heading-name');

        const info = document.createElement('div');
        info.className = 'rx-header-info';
        info.innerHTML = `<h3>${titleEl ? titleEl.textContent.trim() : 'Video'}</h3>
            <span class="rx-channel">${channelEl ? channelEl.textContent.trim() : ''}</span>`;

        const actions = document.createElement('div');
        actions.className = 'rx-header-actions';

        const homeBtn = document.createElement('a');
        homeBtn.id = 'rx-hdr-home';
        homeBtn.className = 'rx-hdr-btn';
        homeBtn.href = Settings.get('logoToFeed') ? 'https://rumble.com/subscriptions' : 'https://rumble.com/';
        homeBtn.title = Settings.get('logoToFeed') ? 'My Feed' : 'Rumble Home';
        homeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 3C4.015 3 2 5.015 2 7.5v9C2 18.985 4.015 21 6.5 21h11c2.485 0 4.5-2.015 4.5-4.5v-9C22 5.015 19.985 3 17.5 3h-11zm3.25 4.5c.69 0 1.25.56 1.25 1.25v1.5l2.5-2.25c.33-.3.76-.5 1.22-.5h.78c.97 0 1.45 1.17.77 1.85L13.5 12l2.72 2.65c.68.68.2 1.85-.77 1.85h-.78c-.46 0-.89-.18-1.22-.5L11 13.75v1.5c0 .69-.56 1.25-1.25 1.25S8.5 15.94 8.5 15.25v-7.5c0-.69.56-1.25 1.25-1.25z" fill="#85d551"/></svg>';

        const gearBtn = document.createElement('button');
        gearBtn.id = 'rx-hdr-settings';
        gearBtn.className = 'rx-hdr-btn';
        gearBtn.title = 'RumbleX Settings';
        gearBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

        gearBtn.addEventListener('click', () => {
            document.body.classList.toggle('rx-panel-open');
        });

        actions.appendChild(homeBtn);

        if (Settings.get('videoDownload')) {
            const dlBtn = document.createElement('button');
            dlBtn.id = 'rx-hdr-download';
            dlBtn.className = 'rx-hdr-btn';
            dlBtn.title = 'Download Video';
            dlBtn.innerHTML = VideoDownloader._downloadSVG;
            dlBtn.addEventListener('click', () => VideoDownloader._showDownloadTab());
            actions.appendChild(dlBtn);
        }

        actions.appendChild(gearBtn);

        header.appendChild(info);
        header.appendChild(actions);
        return header;
    },

    _populateRight(right) {
        if (right.querySelector('.rx-panel-header')) return;

        right.innerHTML = '';
        this._isLive = this._detectLive();

        const strip = document.createElement('div');
        strip.id = 'rx-collapse-strip';
        strip.title = 'Scroll up to collapse';
        strip.addEventListener('click', () => this._collapseSplit());
        right.appendChild(strip);

        right.appendChild(this._buildHeader());

        right.classList.add('rx-tabbed');

        const tabBar = document.createElement('div');
        tabBar.id = 'rx-tab-bar';
        const defaultTab = this._isLive ? 'chat' : 'comments';

        if (this._isLive) {
            const chatTab = document.createElement('button');
            chatTab.className = 'rx-tab rx-tab-active';
            chatTab.dataset.tab = 'chat';
            chatTab.textContent = 'Live Chat';
            chatTab.addEventListener('click', () => this._switchTab('chat'));
            tabBar.appendChild(chatTab);
        }

        const commentsTab = document.createElement('button');
        commentsTab.className = 'rx-tab' + (this._isLive ? '' : ' rx-tab-active');
        commentsTab.dataset.tab = 'comments';
        commentsTab.textContent = 'Comments';
        commentsTab.addEventListener('click', () => this._switchTab('comments'));
        tabBar.appendChild(commentsTab);

        if (Settings.get('videoDownload')) {
            const dlTab = document.createElement('button');
            dlTab.className = 'rx-tab';
            dlTab.dataset.tab = 'download';
            dlTab.textContent = 'Download';
            dlTab.addEventListener('click', () => this._switchTab('download'));
            tabBar.appendChild(dlTab);
        }

        right.appendChild(tabBar);

        if (this._isLive) {
            const chatPanel = document.createElement('div');
            chatPanel.id = 'rx-tab-chat';
            chatPanel.className = 'rx-tab-content rx-tab-visible';
            const chatEl = qs('.media-page-chat-aside-chat');
            if (chatEl) {
                this._origChatParent = chatEl.parentElement;
                this._origChatNext = chatEl.nextSibling;
                chatPanel.appendChild(chatEl);
            } else {
                chatPanel.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,0.4);text-align:center;font-size:13px;">Chat not available</div>';
            }
            right.appendChild(chatPanel);
        }

        const commentsPanel = document.createElement('div');
        commentsPanel.id = 'rx-tab-comments';
        commentsPanel.className = 'rx-tab-content' + (this._isLive ? '' : ' rx-tab-visible');
        const commentsSource = qs('.media-page-comments-container') || qs('#video-comments');
        if (commentsSource) {
            this._origCommentsParent = commentsSource.parentElement;
            this._origCommentsNext = commentsSource.nextSibling;
            commentsSource.style.display = 'block';
            commentsSource.style.padding = '0 8px';
            commentsPanel.appendChild(commentsSource);
        } else {
            commentsPanel.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,0.4);text-align:center;font-size:13px;">No comments yet</div>';
        }
        right.appendChild(commentsPanel);

        if (Settings.get('videoDownload')) {
            const dlPanel = document.createElement('div');
            dlPanel.id = 'rx-tab-download';
            dlPanel.className = 'rx-tab-content';
            dlPanel.innerHTML = '<div class="rx-dl-body"><div class="rx-dl-status">Click to load available qualities...</div></div>';
            right.appendChild(dlPanel);
        }

        this._activeTab = defaultTab;
    },

    _attachRightScrollHandlers(right) {
        const getScrollTarget = () => {
            if (this._activeTab === 'chat') return qs('#chat-history-list');
            return qs('#rx-tab-' + this._activeTab) || right;
        };

        this._rightWheelHandler = (e) => {
            const scrollTarget = getScrollTarget();
            if (scrollTarget && scrollTarget.scrollTop <= 0 && e.deltaY < 0) {
                this._collapseSplit();
            }
        };
        this._rightTouchHandler = null;
        let touchY = 0;

        const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
        const onTouchMove = (e) => {
            const scrollTarget = getScrollTarget();
            const dy = e.touches[0].clientY - touchY;
            if (scrollTarget && scrollTarget.scrollTop <= 0 && dy > 40) {
                this._collapseSplit();
            }
        };

        right.addEventListener('wheel', this._rightWheelHandler, { passive: true });
        right.addEventListener('touchstart', onTouchStart, { passive: true });
        right.addEventListener('touchmove', onTouchMove, { passive: true });
        this._rightTouchHandler = { start: onTouchStart, move: onTouchMove };
    },

    _detachRightScrollHandlers() {
        const right = qs('#rx-split-right');
        if (!right) return;
        if (this._rightWheelHandler) right.removeEventListener('wheel', this._rightWheelHandler);
        if (this._rightTouchHandler) {
            right.removeEventListener('touchstart', this._rightTouchHandler.start);
            right.removeEventListener('touchmove', this._rightTouchHandler.move);
        }
    },

    _mountOverlay() {
        if (this._isActive) return;

        const player = qs('#videoPlayer');
        if (!player) return;

        this._isActive = true;
        document.documentElement.classList.add('rx-theater');

        this._origPlayerParent = player.parentElement;
        this._origPlayerNext = player.nextSibling;

        const { wrapper, left, divider, right } = this._buildOverlay();
        this._splitWrapper = wrapper;

        const video = player.querySelector('video');
        const wasPlaying = video && !video.paused;

        left.insertBefore(player, left.firstChild);
        document.body.appendChild(wrapper);

        if (wasPlaying && video) {
            requestAnimationFrame(() => video.play().catch(() => {}));
        }

        this._initDividerDrag(divider, left, right);

        this._wheelHandler = (e) => {
            if (!this._isSplit && e.deltaY > 0) {
                this._expandSplit();
                return;
            }
            if (this._isSplit) {
                if (this._isLive && this._activeTab === 'chat') {
                    const chatList = qs('#chat-history-list');
                    if (chatList && chatList.scrollTop <= 0 && e.deltaY < 0) {
                        this._collapseSplit();
                    } else if (chatList) {
                        chatList.scrollBy({ top: e.deltaY, behavior: 'auto' });
                    }
                    return;
                }
                const scrollTarget = this._isLive ? qs('#rx-tab-comments') : right;
                if (scrollTarget && scrollTarget.scrollTop <= 0 && e.deltaY < 0) {
                    this._collapseSplit();
                } else if (scrollTarget) {
                    scrollTarget.scrollBy({ top: e.deltaY, behavior: 'auto' });
                }
            }
        };

        this._touchStartY = 0;
        const onTouchStart = (e) => { this._touchStartY = e.touches[0].clientY; };
        const onTouchMove = (e) => {
            if (!this._isSplit && this._touchStartY - e.touches[0].clientY > 30) {
                this._expandSplit();
            }
        };

        left.addEventListener('wheel', this._wheelHandler, { passive: true, capture: true });
        left.addEventListener('touchstart', onTouchStart, { passive: true });
        left.addEventListener('touchmove', onTouchMove, { passive: true });
        this._touchHandler = { start: onTouchStart, move: onTouchMove };

        this._windowResizeHandler = () => {
            if (this._isSplit) {
                const leftPct = Settings.get('splitRatio') || 75;
                const rightPct = 100 - leftPct;
                right.style.flexBasis = rightPct + '%';
            }
        };
        window.addEventListener('resize', this._windowResizeHandler);

        this._playerResizeObs = new ResizeObserver(() => {
            const v = left.querySelector('video');
            if (v) { v.style.width = '100%'; v.style.height = '100%'; }
        });
        this._playerResizeObs.observe(left);
    },

    _unmount() {
        if (!this._isActive) return;

        const player = qs('#videoPlayer');
        const video = player?.querySelector('video');
        const wasPlaying = video && !video.paused;

        if (player && this._origPlayerParent) {
            if (this._origPlayerNext) {
                this._origPlayerParent.insertBefore(player, this._origPlayerNext);
            } else {
                this._origPlayerParent.appendChild(player);
            }
        }

        const chatEl = qs('.media-page-chat-aside-chat');
        if (chatEl && this._origChatParent) {
            if (this._origChatNext) {
                this._origChatParent.insertBefore(chatEl, this._origChatNext);
            } else {
                this._origChatParent.appendChild(chatEl);
            }
        }

        const commentsEl = qs('.media-page-comments-container') || qs('#video-comments');
        if (commentsEl && this._origCommentsParent) {
            commentsEl.style.display = '';
            commentsEl.style.padding = '';
            if (this._origCommentsNext) {
                this._origCommentsParent.insertBefore(commentsEl, this._origCommentsNext);
            } else {
                this._origCommentsParent.appendChild(commentsEl);
            }
        }

        if (wasPlaying && video) {
            requestAnimationFrame(() => video.play().catch(() => {}));
        }

        this._splitWrapper?.remove();
        this._splitWrapper = null;
        this._isActive = false;
        this._isSplit = false;
        this._isLive = false;

        document.documentElement.classList.remove('rx-theater', 'rx-split');

        this._playerResizeObs?.disconnect();
        if (this._windowResizeHandler) window.removeEventListener('resize', this._windowResizeHandler);
        this._detachRightScrollHandlers();

        this._origPlayerParent = null;
        this._origPlayerNext = null;
        this._origChatParent = null;
        this._origChatNext = null;
        this._origCommentsParent = null;
        this._origCommentsNext = null;
        this._positionedEls = [];
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-theater-css');
        waitFor('#videoPlayer').then(() => this._mountOverlay()).catch(() => {});
    },

    destroy() {
        this._unmount();
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Video Downloader
// ═══════════════════════════════════════════
const VideoDownloader = {
    id: 'videoDownload',
    name: 'Video Download',
    _styleEl: null,
    _worker: null,

    _css: `
        #rx-download-btn:hover { border-color: rgba(166,227,161,0.6) !important; }
        #rx-hdr-download:hover { border-color: rgba(166,227,161,0.6) !important; }

        #rx-tab-download {
            flex-direction: column;
            padding: 16px;
            overflow-y: auto;
        }
        #rx-tab-download .rx-dl-body { padding: 0; }

        .rx-dl-quality {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            margin: 4px 0;
            border-radius: 10px;
            background: rgba(49,50,68,0.4);
            border: 1px solid rgba(255,255,255,0.04);
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s;
        }
        .rx-dl-quality:hover {
            background: rgba(49,50,68,0.7);
            border-color: rgba(137,180,250,0.2);
        }
        .rx-dl-quality-label {
            font-size: 14px;
            font-weight: 600;
            color: var(--rx-text, #cdd6f4);
        }
        .rx-dl-quality-meta {
            font-size: 11px;
            color: var(--rx-subtext, #a6adc8);
        }

        .rx-dl-progress-wrap { margin-top: 12px; }
        .rx-dl-status {
            font-size: 12px;
            color: var(--rx-subtext, #a6adc8);
            margin-bottom: 8px;
        }
        .rx-dl-bar-bg {
            width: 100%;
            height: 6px;
            background: rgba(49,50,68,0.6);
            border-radius: 3px;
            overflow: hidden;
        }
        .rx-dl-bar-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, var(--rx-accent, #89b4fa), #a6e3a1);
            border-radius: 3px;
            transition: width 0.15s ease;
        }
        .rx-dl-done {
            text-align: center;
            padding: 20px 0;
            color: #a6e3a1;
            font-weight: 600;
            font-size: 14px;
        }
        .rx-dl-error {
            color: #f38ba8;
            font-size: 12px;
            margin-top: 8px;
            word-break: break-word;
        }

        .rx-dl-format-row {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
        .rx-dl-format-btn {
            flex: 1;
            padding: 8px;
            border-radius: 8px;
            border: 1px solid rgba(137,180,250,0.15);
            background: rgba(49,50,68,0.4);
            color: var(--rx-text, #cdd6f4);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            text-align: center;
            transition: background 0.15s, border-color 0.15s;
        }
        .rx-dl-format-btn:hover {
            background: rgba(49,50,68,0.7);
            border-color: rgba(137,180,250,0.3);
        }
        .rx-dl-format-btn small {
            display: block;
            font-weight: 400;
            font-size: 10px;
            color: var(--rx-subtext, #a6adc8);
            margin-top: 2px;
        }

        /* ── Deep scan (RUD) additions ── */
        .rx-dl-scan-bar {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 10px; margin-bottom: 8px;
            background: rgba(137,180,250,0.08); border: 1px solid rgba(137,180,250,0.18);
            border-radius: 8px;
            font: 11px system-ui, sans-serif; color: var(--rx-subtext, #a6adc8);
        }
        .rx-dl-scan-bar .rx-dl-scan-label { flex: 1; }
        .rx-dl-scan-bar .rx-dl-scan-counter {
            font-variant-numeric: tabular-nums; color: var(--rx-text, #cdd6f4); font-weight: 600;
        }
        .rx-dl-scan-bar .rx-dl-scan-mini {
            width: 60px; height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;
        }
        .rx-dl-scan-bar .rx-dl-scan-mini > div {
            height: 100%; width: 0%; background: var(--rx-accent, #89b4fa);
            transition: width 0.2s ease;
        }
        .rx-dl-scan-bar.done {
            background: rgba(166,227,161,0.08);
            border-color: rgba(166,227,161,0.18);
            color: #a6e3a1;
        }

        .rx-dl-group-title {
            font: 700 10px/1 system-ui, sans-serif;
            color: var(--rx-subtext, #a6adc8);
            text-transform: uppercase; letter-spacing: 0.08em;
            padding: 8px 4px 4px;
        }
        .rx-dl-group-title:first-child { padding-top: 0; }

        .rx-dl-quality {
            gap: 8px;
        }
        .rx-dl-quality-row-inner {
            display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;
        }
        .rx-dl-quality-main {
            flex: 1; min-width: 0;
        }
        .rx-dl-type-badge {
            display: inline-block; padding: 1px 6px; margin-left: 6px;
            font: 600 9px/1.4 system-ui, sans-serif; letter-spacing: 0.04em; text-transform: uppercase;
            border-radius: 999px;
            background: rgba(255,255,255,0.06); color: var(--rx-subtext, #a6adc8);
        }
        .rx-dl-type-badge.type-tar {
            background: rgba(249,226,175,0.14); color: #f9e2af;
        }
        .rx-dl-copy-btn {
            background: transparent; border: 0; padding: 4px; margin: 0;
            color: var(--rx-subtext, #a6adc8); cursor: pointer; opacity: 0;
            transition: opacity 0.12s, color 0.12s;
            border-radius: 4px; display: flex; align-items: center; justify-content: center;
        }
        .rx-dl-quality:hover .rx-dl-copy-btn { opacity: 0.7; }
        .rx-dl-copy-btn:hover { opacity: 1; color: var(--rx-text, #cdd6f4); background: rgba(255,255,255,0.06); }
        .rx-dl-copy-btn.copied { color: #a6e3a1; opacity: 1; }
        .rx-dl-copy-btn svg { width: 12px; height: 12px; }

        .rx-dl-tar-note {
            margin-top: 6px; padding: 8px 10px;
            background: rgba(249,226,175,0.06); border: 1px solid rgba(249,226,175,0.16);
            border-radius: 6px;
            font: 10px/1.5 system-ui, sans-serif; color: var(--rx-subtext, #a6adc8);
        }
        .rx-dl-tar-note strong { color: #f9e2af; }
    `,

    _downloadSVG: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    _copySVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
    _checkSVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',

    // ── RUD (Rumble Universal Downloader) constants ──
    _CDN_HOST: 'https://hugh.cdn.rumble.cloud',
    _TOKEN_LABELS: { haa: '1080p', gaa: '720p', caa: '480p', baa: '360p', oaa: '240p' },
    _TOKENS: ['haa', 'gaa', 'caa', 'baa', 'oaa'],
    _EMBED_UNITS: ['u0', 'u1', 'u2', 'u3', 'u4'],
    _PROBE_CONCURRENCY: 6,
    _PROBE_TIMEOUT_MS: 12000,
    _scanController: null,
    _scanSeq: 0, // guards against late results after the user navigates away

    _getEmbedId() {
        const player = qs('[id^="vid_v"]');
        if (player) return player.id.replace('vid_', '');
        const oembed = qs('link[href*="oembed"]');
        if (oembed) {
            const m = oembed.href.match(/embed%2F(v[a-z0-9]+)/i);
            if (m) return m[1];
        }
        return null;
    },

    _getTitle() {
        const el = qs('.video-header-container__title') || qs('h1');
        return el ? el.textContent.trim().replace(/[<>:"/\\|?*]/g, '_').substring(0, 120) : 'rumble_video';
    },

    async _fetchEmbedData(embedId) {
        const url = `https://rumble.com/embedJS/u3/?request=video&ver=2&v=${embedId}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
    },

    _parseQualities(data) {
        const qualities = [];
        const src = data.ua || data.u || {};

        // Check for direct MP4/webm URLs (NOT tar - those are HLS containers)
        for (const fmt of ['mp4', 'webm']) {
            const group = src[fmt];
            if (!group || typeof group !== 'object') continue;
            if (group.url && group.meta?.h > 0) {
                qualities.push({
                    key: fmt, label: `${group.meta.h}p`, height: group.meta.h,
                    width: group.meta.w || 0, bitrate: group.meta.bitrate || 0,
                    size: group.meta.size || 0, directUrl: group.url,
                });
                continue;
            }
            for (const [key, val] of Object.entries(group)) {
                if (!val?.url || !val?.meta?.h) continue;
                qualities.push({
                    key, label: `${val.meta.h}p`, height: val.meta.h,
                    width: val.meta.w || 0, bitrate: val.meta.bitrate || 0,
                    size: val.meta.size || 0, directUrl: val.url,
                });
            }
        }

        // Add entries from tar metadata (tar URLs are HLS containers, NOT direct MP4s)
        const tar = src.tar;
        if (tar && typeof tar === 'object') {
            for (const [key, val] of Object.entries(tar)) {
                if (!val?.meta?.h) continue;
                const h = val.meta.h;
                if (qualities.some(q => q.height === h)) continue;
                qualities.push({
                    key, label: `${h}p`, height: h,
                    width: val.meta.w || 0, bitrate: val.meta.bitrate || 0,
                    size: val.meta.size || 0, directUrl: null,
                });
            }
        }

        qualities.sort((a, b) => b.height - a.height);
        const seen = new Map();
        for (const q of qualities) {
            const existing = seen.get(q.height);
            if (!existing || (q.directUrl && !existing.directUrl) || q.bitrate > existing.bitrate) {
                seen.set(q.height, q);
            }
        }
        return [...seen.values()];
    },

    _parseMasterPlaylist(text, baseUrl) {
        const variants = [];
        const lines = text.trim().split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
                const info = lines[i];
                const url = lines[i + 1]?.trim();
                if (url && !url.startsWith('#')) {
                    const resMatch = info.match(/RESOLUTION=(\d+)x(\d+)/);
                    const bwMatch = info.match(/BANDWIDTH=(\d+)/);
                    variants.push({
                        url: new URL(url, baseUrl).href,
                        width: resMatch ? parseInt(resMatch[1]) : 0,
                        height: resMatch ? parseInt(resMatch[2]) : 0,
                        bandwidth: bwMatch ? parseInt(bwMatch[1]) : 0,
                    });
                }
            }
        }
        return variants;
    },

    _parseSegmentPlaylist(text, baseUrl) {
        const segments = [];
        const lines = text.trim().split('\n');
        for (const line of lines) {
            const t = line.trim();
            if (t && !t.startsWith('#')) {
                segments.push(new URL(t, baseUrl).href);
            }
        }
        return segments;
    },

    async _getWorker() {
        if (this._worker) return this._worker;
        // Fetch worker + mux.js source and create blob Worker
        // (content script can't construct Workers from chrome-extension:// URLs)
        const [workerSrc, muxSrc] = await Promise.all([
            fetch(chrome.runtime.getURL('worker.js')).then(r => r.text()),
            fetch(chrome.runtime.getURL('lib/mux.min.js')).then(r => r.text()),
        ]);
        const blob = new Blob([muxSrc, '\n', workerSrc.replace(/^importScripts\([^)]*\);?\s*/m, '')], { type: 'application/javascript' });
        this._worker = new Worker(URL.createObjectURL(blob));
        return this._worker;
    },

    async _transmuxWithWorker(tsBuffers) {
        const worker = await this._getWorker();
        return new Promise((resolve, reject) => {
            const id = Date.now();

            const handler = (e) => {
                if (e.data.id !== id) return;
                // Debug message (not final result)
                if (e.data.debug) {
                    console.log('[RumbleX] Transmux debug:\n' + e.data.debug);
                    return;
                }
                worker.removeEventListener('message', handler);
                if (e.data.error) reject(new Error(e.data.error));
                else resolve(e.data.blob);
            };

            worker.addEventListener('message', handler);
            // Transfer ArrayBuffers to worker (zero-copy)
            const transferable = tsBuffers.map(b => b instanceof ArrayBuffer ? b : b.buffer);
            worker.postMessage({ id, action: 'transmux', buffers: tsBuffers }, transferable);
        });
    },

    _triggerSave(data, filename, mimeType) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    },

    _formatSize(bytes) {
        if (bytes > 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
        if (bytes > 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
        return (bytes / 1024).toFixed(0) + ' KB';
    },

    _showDownloadTab() {
        // Preferred path: the TheaterSplit side panel owns a #rx-tab-download.
        // If TheaterSplit is enabled and initialized, route there.
        if (Settings.get('theaterSplit') && qs('#rx-tab-download')) {
            TheaterSplit._switchTab('download');
            const panel = qs('#rx-tab-download');
            if (panel && !panel.dataset.loaded) {
                panel.dataset.loaded = '1';
                this._loadQualities();
            }
            return;
        }
        // Fallback: TheaterSplit is disabled. Mount a standalone overlay so
        // the download feature is still useful on its own.
        this._showDownloadOverlay();
    },

    _showDownloadOverlay() {
        // Idempotent — reopening just re-focuses the existing overlay.
        const existing = qs('#rx-download-overlay');
        if (existing) {
            existing.classList.add('open');
            return;
        }
        injectStyle(`
            #rx-download-overlay {
                position: fixed; inset: 0; z-index: 80010;
                background: rgba(0,0,0,0.65);
                display: none; align-items: center; justify-content: center;
                backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
            }
            #rx-download-overlay.open { display: flex; }
            #rx-download-overlay .rx-dl-card {
                width: min(560px, calc(100vw - 32px));
                max-height: calc(100vh - 64px); overflow-y: auto;
                background: #0e1017; color: #cdd6f4;
                border: 1px solid rgba(255,255,255,0.08); border-radius: 14px;
                box-shadow: 0 24px 64px rgba(0,0,0,0.55);
                font-family: system-ui, sans-serif;
            }
            #rx-download-overlay .rx-dl-card-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            #rx-download-overlay .rx-dl-card-header h2 {
                margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
            }
            #rx-download-overlay .rx-dl-card-close {
                background: transparent; border: 0; color: #a6adc8; cursor: pointer;
                padding: 6px; border-radius: 6px; display: flex;
            }
            #rx-download-overlay .rx-dl-card-close:hover {
                background: rgba(255,255,255,0.06); color: #fff;
            }
            #rx-download-overlay .rx-dl-body { padding: 14px 16px; }
        `, 'rx-download-overlay-css');

        const overlay = document.createElement('div');
        overlay.id = 'rx-download-overlay';
        overlay.className = 'open';
        const card = document.createElement('div');
        card.className = 'rx-dl-card';

        const header = document.createElement('div');
        header.className = 'rx-dl-card-header';
        const title = document.createElement('h2');
        title.textContent = 'Download Video';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'rx-dl-card-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>';
        closeBtn.addEventListener('click', () => this._closeDownloadOverlay());

        // We need an element with id `rx-tab-download` containing `.rx-dl-body`
        // because the rest of VideoDownloader's code queries those selectors.
        // Re-using the existing selector contract avoids a broader refactor.
        const tab = document.createElement('div');
        tab.id = 'rx-tab-download';
        const body = document.createElement('div');
        body.className = 'rx-dl-body';
        tab.appendChild(body);

        header.append(title, closeBtn);
        card.append(header, tab);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._closeDownloadOverlay();
        });
        this._overlayKeyHandler = (e) => {
            if (e.key === 'Escape') this._closeDownloadOverlay();
        };
        document.addEventListener('keydown', this._overlayKeyHandler);

        this._loadQualities();
    },

    _closeDownloadOverlay() {
        // Aborts in-flight deep scan so probes don't keep firing in the
        // background after the user closes the dialog.
        this._scanController?.abort();
        this._scanController = null;
        this._scanSeq++;
        if (this._overlayKeyHandler) {
            document.removeEventListener('keydown', this._overlayKeyHandler);
            this._overlayKeyHandler = null;
        }
        qs('#rx-download-overlay')?.remove();
    },

    _getBody() {
        return qs('#rx-tab-download .rx-dl-body');
    },

    _setBody(html) {
        const body = this._getBody();
        if (body) body.innerHTML = html;
        return body;
    },

    // Safe-by-default alternative used for any content that includes data
    // we didn't author (error messages, HLS hostnames, API responses). This
    // avoids accidentally rendering a crafted string as HTML.
    _setBodyText(className, text) {
        const body = this._getBody();
        if (!body) return null;
        body.textContent = ''; // clear without innerHTML
        const el = document.createElement('div');
        if (className) el.className = className;
        el.textContent = text == null ? '' : String(text);
        body.appendChild(el);
        return body;
    },

    // ───────────────────────────────────────────────────────────
    //  RUD helpers — direct port from "Rumble Enhancement Suite"
    //  v11 with extension-native fetch instead of GM_xmlhttpRequest.
    //  Used by _loadQualities() for progressive CDN probing once the
    //  fast embedJS path has rendered.
    // ───────────────────────────────────────────────────────────
    _tokenToLabel(t) {
        const low = String(t || '').toLowerCase();
        if (!low || low === 'faa') return null;
        return this._TOKEN_LABELS[low] || low;
    },
    _tokenRank(t) {
        switch (String(t || '').toLowerCase()) {
            case 'haa': return 50;
            case 'gaa': return 40;
            case 'caa': return 30;
            case 'baa': return 20;
            case 'oaa': return 10;
            default: return 0;
        }
    },
    _typeFromUrl(u) { return /\.tar(\?|$)/i.test(u) ? 'tar' : 'mp4'; },
    _extractTokenFromUrl(u) {
        const m = u.match(/\.([A-Za-z]{3})(?:\.rec)?\.(?:mp4|tar)\b/i);
        return m ? m[1] : null;
    },
    _parseSize(headers) {
        const cr = headers.get('content-range');
        if (cr) {
            const m = cr.match(/bytes\s+\d+-\d+\/(\d+)/i);
            if (m) return Number(m[1]);
        }
        const cl = headers.get('content-length');
        if (cl) return Number(cl);
        return undefined;
    },

    async _probeUrl(url) {
        const signal = this._scanController?.signal;
        if (signal?.aborted) return { ok: false };
        const timed = () => {
            // Compose per-probe timeout with the scan-wide abort signal.
            if (typeof AbortSignal?.any === 'function' && signal) {
                return AbortSignal.any([signal, AbortSignal.timeout(this._PROBE_TIMEOUT_MS)]);
            }
            return AbortSignal.timeout(this._PROBE_TIMEOUT_MS);
        };
        // HEAD first — cheapest and most accurate.
        try {
            const r = await fetch(url, { method: 'HEAD', signal: timed() });
            if (r.ok || r.status === 206) return { ok: true, size: this._parseSize(r.headers) };
        } catch {}
        if (signal?.aborted) return { ok: false };
        // HEAD may be blocked or unsupported — fall back to a 1-byte Range GET.
        try {
            const r = await fetch(url, {
                method: 'GET',
                headers: { Range: 'bytes=0-0' },
                signal: timed(),
            });
            // Release the body immediately; we only wanted the headers.
            r.body?.cancel?.();
            if (r.ok || r.status === 206) return { ok: true, size: this._parseSize(r.headers) };
        } catch {}
        return { ok: false };
    },

    // Try every known embedJS endpoint. Each returns slightly different
    // metadata; together they cover variants a single URL misses.
    //
    // `primedJson` — the embedJS response the caller already fetched
    // (via _fetchEmbedData). Passing it through lets us skip the duplicate
    // HTTP round-trip for the u3 endpoint _loadQualities already hit.
    async _fetchAllEmbeds(embedId, primedJson) {
        const primedUrl = `https://rumble.com/embedJS/u3/?request=video&ver=2&v=${encodeURIComponent(embedId)}`;
        const urls = new Set();
        for (const unit of this._EMBED_UNITS) {
            if (unit === 'u3') continue; // we already have the base u3 response from _loadQualities
            urls.add(`https://rumble.com/embedJS/${unit}/?request=video&v=${encodeURIComponent(embedId)}`);
        }
        urls.add(`https://rumble.com/embedJS/u3/?ifr=0&dref=rumble.com&request=video&ver=2&v=${encodeURIComponent(embedId)}`);
        const signal = this._scanController?.signal;

        // Fire all requests in parallel. `allSettled` so one 404 doesn't
        // abort the rest, and aborts produce a resolved (failed) entry
        // rather than an unhandled rejection.
        const fetchOne = async (url) => {
            if (signal?.aborted) return null;
            try {
                const r = await fetch(url, { signal });
                if (!r.ok) return null;
                const j = await r.json();
                return j && typeof j === 'object' ? j : null;
            } catch { return null; }
        };
        const results = (await Promise.allSettled([...urls].map(fetchOne)))
            .map((s) => (s.status === 'fulfilled' ? s.value : null))
            .filter(Boolean);
        if (primedJson && typeof primedJson === 'object') results.unshift(primedJson);
        return results;
    },

    _collectMediaUrlsFromEmbed(json) {
        const out = new Set();
        const add = (u) => { if (u && /\/video\/.+\.(?:mp4|tar)\b/i.test(u)) out.add(u); };
        try {
            if (json.u) { add(json.u.tar?.url); add(json.u.timeline?.url); }
            if (json.ua) {
                for (const group of Object.values(json.ua)) {
                    if (group && typeof group === 'object') {
                        for (const v of Object.values(group)) add(v?.url);
                    } else if (typeof group === 'string') add(group);
                }
            }
        } catch {}
        return [...out];
    },

    _collectMediaUrlsFromDom() {
        const out = new Set();
        const addAbs = (u) => {
            if (!u) return;
            try { out.add(new URL(u, location.href).href); } catch {}
        };
        const isMedia = (u) => /\/video\/.+\.(?:mp4|tar)(?:\?|$)/i.test(u);
        for (const el of qsa('[src], [href]')) {
            const v = el.getAttribute('src') || el.getAttribute('href') || '';
            if (isMedia(v)) addAbs(v);
        }
        for (const el of qsa('video, source')) {
            const v = el.src || '';
            if (isMedia(v)) addAbs(v);
        }
        const scriptRe = /https?:\/\/[^\s"'<>]+\/video\/[^\s"'<>]+\.(?:mp4|tar)\b[^\s"'<>]*/gi;
        for (const s of qsa('script')) {
            const text = (s.textContent || '').slice(0, 300000);
            let m;
            while ((m = scriptRe.exec(text))) addAbs(m[0]);
        }
        return [...out];
    },

    // Derive {pathPart, baseId, token, isLive} from any direct media URL.
    // Once we have these, we can synthesize URLs for every quality token.
    _deriveParts(urls) {
        const parsePathFile = (u) => {
            try {
                const uo = new URL(u, location.href);
                const m = uo.pathname.match(/\/video\/(.+?)\/([^\/]+)$/i);
                return m ? { pathPart: m[1], file: m[2] } : null;
            } catch { return null; }
        };
        const tar = urls.find((u) => /\.tar(\?|$)/i.test(u));
        if (tar) {
            const pp = parsePathFile(tar);
            if (pp) {
                const fm = pp.file.match(/^([A-Za-z0-9_-]+)\.([A-Za-z]{3})(?:\.rec)?\.tar$/i);
                if (fm) return { pathPart: pp.pathPart, baseId: fm[1], token: fm[2], isLive: /\.rec\.tar$/i.test(pp.file) };
            }
        }
        const mp4 = urls.find((u) => /\.mp4(\?|$)/i.test(u));
        if (mp4) {
            const pp = parsePathFile(mp4);
            if (pp) {
                const fm = pp.file.match(/^([A-Za-z0-9_-]+)\.([A-Za-z]{3})(?:\.rec)?\.mp4$/);
                if (fm) return { pathPart: pp.pathPart, baseId: fm[1], token: fm[2], isLive: /\.rec\.mp4$/i.test(pp.file) };
            }
        }
        return null;
    },

    _buildCdnUrl(pathPart, baseId, token, kind, live) {
        if (kind === 'tar') {
            const rec = live ? '.rec' : '';
            return `${this._CDN_HOST}/video/${pathPart}/${baseId}.${token}${rec}.tar`;
        }
        return `${this._CDN_HOST}/video/${pathPart}/${baseId}.${token}.mp4`;
    },

    // Generate candidate URLs for every token × (mp4,tar) × (live,vod) combo,
    // both case variants. Sorted so the highest-quality probes fire first.
    _generateCandidates(parts) {
        const { pathPart, baseId, isLive } = parts;
        const triesLive = isLive == null ? [true, false] : [!!isLive];
        const out = [];
        for (const live of triesLive) {
            for (const t of this._TOKENS) {
                const cap = t[0].toUpperCase() + t.slice(1);
                out.push({ url: this._buildCdnUrl(pathPart, baseId, t, 'tar', live), type: 'tar', token: t, pri: live ? 1 : 3 });
                out.push({ url: this._buildCdnUrl(pathPart, baseId, cap, 'tar', live), type: 'tar', token: t, pri: live ? 1 : 3 });
                if (!live) {
                    out.push({ url: this._buildCdnUrl(pathPart, baseId, t, 'mp4', false), type: 'mp4', token: t, pri: 2 });
                    out.push({ url: this._buildCdnUrl(pathPart, baseId, cap, 'mp4', false), type: 'mp4', token: t, pri: 2 });
                }
            }
        }
        out.sort((a, b) => a.pri - b.pri || this._tokenRank(b.token) - this._tokenRank(a.token));
        return out;
    },

    // Run the full deep scan with the given abort-signal seq. Invokes
    // `onResult({ label, type, url, size, token })` each time a probe succeeds.
    //
    // `primedJson` — the embedJS response the caller already obtained. We pass
    // it through `_fetchAllEmbeds` so the deep scan doesn't duplicate that
    // HTTP request (Rumble's u3 endpoint is rate-sensitive).
    async _deepScan(embedId, seq, onResult, primedJson) {
        const isAlive = () => seq === this._scanSeq && !this._scanController?.signal?.aborted;

        // Step 1: harvest URLs from every embedJS endpoint and the live DOM.
        const jsons = await this._fetchAllEmbeds(embedId, primedJson);
        if (!isAlive()) return { done: 0, total: 0 };
        const embedUrls = jsons.flatMap((j) => this._collectMediaUrlsFromEmbed(j));
        const domUrls = this._collectMediaUrlsFromDom();
        const directUrls = [...new Set([...embedUrls, ...domUrls])]
            .filter((u) => /\/video\/.+\.(?:mp4|tar)\b/i.test(u));

        // Step 2: derive base pattern and generate every candidate.
        const parts = this._deriveParts(directUrls);
        const generated = parts ? this._generateCandidates(parts) : [];

        // Step 3: combine. Direct URLs get priority 0/4 depending on host score.
        const directTargets = directUrls.map((u) => ({
            url: u,
            type: this._typeFromUrl(u),
            token: String(this._extractTokenFromUrl(u) || '').toLowerCase(),
            pri: u.includes('hugh.cdn.rumble.cloud') ? 0 : 4,
        })).filter((t) => t.token !== 'faa');
        const combined = [...directTargets, ...generated];
        const seenUrls = new Set();
        const targets = [];
        for (const t of combined) {
            if (!t.url || seenUrls.has(t.url)) continue;
            seenUrls.add(t.url);
            targets.push(t);
        }
        if (!targets.length) return { done: 0, total: 0 };

        // Step 4: concurrent probe. Skip quality/type pairs we've already verified.
        const satisfied = new Set();
        const queue = [...targets];
        let done = 0;
        const total = targets.length;
        const worker = async () => {
            while (queue.length && isAlive()) {
                const t = queue.shift();
                const key = `${t.token}|${t.type}`;
                if (satisfied.has(key)) { done++; onResult?.(null, done, total); continue; }
                const result = await this._probeUrl(t.url);
                done++;
                if (result.ok && isAlive()) {
                    const label = this._tokenToLabel(t.token) || 'detected';
                    satisfied.add(key);
                    onResult?.({ label, type: t.type, url: t.url, size: result.size, token: t.token }, done, total);
                } else {
                    onResult?.(null, done, total);
                }
            }
        };
        await Promise.all(
            Array.from({ length: Math.min(this._PROBE_CONCURRENCY, total) }, () => worker())
        );
        return { done, total };
    },

    _copyToClipboard(text) {
        try {
            navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Legacy fallback for older contexts.
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                return true;
            } catch { return false; }
        }
    },

    // Build a single result row. Works for both the initial embedJS rows and
    // progressive deep-scan additions — the shape is the same. Uses DOM APIs
    // rather than innerHTML so label/dims are rendered as text regardless of
    // what the upstream API hands us.
    _makeRow(q, title) {
        const row = document.createElement('div');
        row.className = 'rx-dl-quality';
        row.dataset.key = `${String(q.label || '').toLowerCase()}|${q.type || 'mp4'}`;
        row.dataset.token = String(q.token || '').toLowerCase();

        const inner = document.createElement('div');
        inner.className = 'rx-dl-quality-row-inner';

        const main = document.createElement('div');
        main.className = 'rx-dl-quality-main';

        const label = document.createElement('div');
        label.className = 'rx-dl-quality-label';
        label.textContent = q.label || 'detected';
        if (Number.isFinite(q.height) && q.height >= 720) {
            label.appendChild(document.createTextNode(' (HD)'));
        }
        const badge = document.createElement('span');
        badge.className = 'rx-dl-type-badge' + (q.type === 'tar' ? ' type-tar' : '');
        badge.textContent = q.type === 'tar' ? 'TAR' : (q.directUrl ? 'MP4' : 'HLS');
        label.appendChild(badge);
        main.appendChild(label);

        const metaParts = [];
        if (q.width && q.height) metaParts.push(`${q.width}×${q.height}`);
        else if (q.label) metaParts.push(q.label);
        if (q.bitrate) metaParts.push(`${q.bitrate} kbps`);
        if (q.size) metaParts.push(`~${this._formatSize(q.size)}`);
        const meta = document.createElement('div');
        meta.className = 'rx-dl-quality-meta';
        meta.textContent = metaParts.join(' · ');
        main.appendChild(meta);

        inner.appendChild(main);
        row.appendChild(inner);

        // Copy-link button (works for anything with a directUrl)
        if (q.directUrl) {
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'rx-dl-copy-btn';
            copyBtn.title = 'Copy link';
            copyBtn.innerHTML = this._copySVG;
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this._copyToClipboard(q.directUrl)) {
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = this._checkSVG;
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = this._copySVG;
                    }, 1500);
                }
            });
            row.appendChild(copyBtn);
        }

        row.addEventListener('click', () => this._showFormatPicker(q, title));
        return row;
    },

    async _loadQualities() {
        const embedId = this._getEmbedId();
        if (!embedId) { this._setBody('<div class="rx-dl-error">Could not find video embed ID</div>'); return; }

        // Cancel any previous scan before starting a new one.
        this._scanController?.abort();
        this._scanController = new AbortController();
        const seq = ++this._scanSeq;

        try {
            const data = await this._fetchEmbedData(embedId);
            if (seq !== this._scanSeq) return; // user already kicked off another scan
            this._embedData = data;
            this._hlsUrl = data.u?.hls?.auto?.url || data.ua?.hls?.auto?.url || `https://rumble.com/hls-vod/${embedId.replace('v', '')}/playlist.m3u8`;
            const qualities = this._parseQualities(data);

            const body = this._setBody('');
            const title = this._getTitle();

            // Track rows by "{label}|{type}" so deep-scan can upgrade them in place
            // rather than duplicating when it re-discovers the same quality.
            const rowByKey = new Map();
            const upsert = (q) => {
                const key = `${(q.label || '').toLowerCase()}|${q.type || 'mp4'}`;
                const existing = rowByKey.get(key);
                if (existing) {
                    // Already have this quality. Prefer the entry with a real
                    // size — the probe result is more accurate than the API's
                    // claimed number.
                    const prev = existing.q;
                    const better = (q.size || 0) > (prev.size || 0) || (!prev.directUrl && q.directUrl);
                    if (better) {
                        const replacement = this._makeRow(q, title);
                        existing.row.replaceWith(replacement);
                        rowByKey.set(key, { row: replacement, q });
                    }
                    return;
                }
                const row = this._makeRow(q, title);
                // Insert in quality-descending order so new rows slot in correctly.
                const rank = this._tokenRank(q.token || '');
                let placed = false;
                for (const child of body.children) {
                    if (!child.classList || !child.classList.contains('rx-dl-quality')) continue;
                    const childRank = this._tokenRank(child.dataset.token || '');
                    if (rank > childRank) { body.insertBefore(row, child); placed = true; break; }
                }
                if (!placed) body.appendChild(row);
                rowByKey.set(key, { row, q });
            };

            // ── Initial rows from the embed API ──
            for (const q of qualities) {
                // Normalize token (the API-provided entries don't always carry one).
                if (q.directUrl && !q.token) q.token = String(this._extractTokenFromUrl(q.directUrl) || '').toLowerCase();
                if (!q.type) q.type = q.directUrl ? this._typeFromUrl(q.directUrl) : 'mp4';
                upsert(q);
            }

            // Empty-state placeholder: dismissed automatically as soon as the
            // first row (from embed API OR deep scan) lands, so users never
            // see "scanning the CDN…" next to actual results.
            let emptyEl = null;
            if (rowByKey.size === 0) {
                emptyEl = document.createElement('div');
                emptyEl.className = 'rx-dl-status';
                emptyEl.textContent = 'No qualities from the embed API yet — scanning the CDN…';
                body.appendChild(emptyEl);
            }
            const dismissEmpty = () => {
                if (emptyEl) { emptyEl.remove(); emptyEl = null; }
            };

            // ── Deep-scan progress bar ──
            // Built via DOM APIs rather than innerHTML so nothing user- or
            // network-influenced ever reaches the HTML parser here.
            const scanBar = document.createElement('div');
            scanBar.className = 'rx-dl-scan-bar';
            const scanLabel = document.createElement('span');
            scanLabel.className = 'rx-dl-scan-label';
            scanLabel.textContent = 'Deep scan for more qualities';
            const scanCounter = document.createElement('span');
            scanCounter.className = 'rx-dl-scan-counter';
            scanCounter.textContent = '0 / 0';
            const scanMini = document.createElement('div');
            scanMini.className = 'rx-dl-scan-mini';
            const scanFill = document.createElement('div');
            scanMini.appendChild(scanFill);
            scanBar.append(scanLabel, scanCounter, scanMini);
            body.prepend(scanBar);

            // ── Run deep scan (fire-and-forget; updates live) ──
            this._deepScan(embedId, seq, (hit, done, total) => {
                if (seq !== this._scanSeq) return;
                scanCounter.textContent = `${done} / ${total}`;
                scanFill.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
                if (hit) {
                    dismissEmpty();
                    // Fake a `directUrl` + `height` from the token label for display.
                    const heightFromLabel = parseInt(String(hit.label).match(/(\d+)/)?.[1] || '0', 10) || undefined;
                    upsert({
                        label: hit.label,
                        type: hit.type,
                        directUrl: hit.url,
                        size: hit.size,
                        height: heightFromLabel,
                        token: hit.token,
                    });
                }
            }, data).then(({ done, total }) => {
                if (seq !== this._scanSeq) return;
                scanBar.classList.add('done');
                scanLabel.textContent = total
                    ? `Deep scan complete · probed ${total} candidate${total === 1 ? '' : 's'}`
                    : 'Deep scan found nothing extra to probe';
                setTimeout(() => { if (seq === this._scanSeq) scanBar.remove(); }, 2800);

                // If nothing showed up anywhere, replace the "scanning…" text
                // with an honest dead-end message so the panel isn't empty.
                if (rowByKey.size === 0 && emptyEl) {
                    emptyEl.textContent = 'No downloads found. Try playing the video first, then reopen this panel.';
                }

                // Any TAR rows present? Append a "how to play" note at the bottom.
                const hasTar = body.querySelector('.rx-dl-quality[data-key*="|tar"]');
                if (hasTar && !body.querySelector('.rx-dl-tar-note')) {
                    const note = document.createElement('div');
                    note.className = 'rx-dl-tar-note';
                    // Build with textContent + span hierarchy rather than innerHTML.
                    const strong1 = document.createElement('strong');
                    strong1.textContent = 'TAR archives';
                    const strong2 = document.createElement('strong');
                    strong2.textContent = '.m3u8';
                    note.append(
                        strong1,
                        document.createTextNode(' are live-replay bundles. Extract with 7-Zip, then drag the '),
                        strong2,
                        document.createTextNode(' file into VLC.'),
                    );
                    body.appendChild(note);
                }
            }).catch((e) => {
                if (seq !== this._scanSeq) return;
                scanLabel.textContent = 'Deep scan failed — using embed-API results only';
                console.warn('[RumbleX] deep scan failed:', e);
            });
        } catch (e) {
            this._setBodyText('rx-dl-error', 'Failed to load video data: ' + (e?.message || e));
        }
    },

    _showFormatPicker(quality, title) {
        // Direct CDN URL (MP4 or TAR) — straight to browser download.
        if (quality.directUrl) {
            this._startDirectDownload(quality, title);
            return;
        }

        const dimsLabel = quality.width && quality.height
            ? `${quality.label} (${quality.width}x${quality.height})`
            : (quality.label || 'Selected');
        const body = this._getBody();
        if (!body) return;
        body.textContent = '';
        const status = document.createElement('div');
        status.className = 'rx-dl-status';
        status.textContent = 'Selected: ' + dimsLabel;
        body.appendChild(status);
        const row = document.createElement('div');
        row.className = 'rx-dl-format-row';
        body.appendChild(row);

        const makeBtn = (main, note, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rx-dl-format-btn';
            btn.appendChild(document.createTextNode(main));
            if (note) {
                const small = document.createElement('small');
                small.textContent = note;
                btn.appendChild(small);
            }
            btn.addEventListener('click', onClick);
            return btn;
        };
        row.appendChild(makeBtn('MP4', 'Converted in browser', () => this._startDownload(quality, title, 'mp4')));
        row.appendChild(makeBtn('TS', 'Raw stream (fast)', () => this._startDownload(quality, title, 'ts')));
    },

    async _startDirectDownload(quality, title) {
        // Honour a per-quality extension — RUD results may be .tar archives.
        const ext = quality.type === 'tar' ? 'tar' : (quality.ext || 'mp4');
        const filename = `${title} - ${quality.label}.${ext}`;

        // Build progress block with DOM APIs so no response text or error
        // message can ever reach the HTML parser.
        const body = this._getBody();
        if (!body) return;
        body.textContent = '';
        const wrap = document.createElement('div');
        wrap.className = 'rx-dl-progress-wrap';
        const status = document.createElement('div');
        status.className = 'rx-dl-status';
        status.textContent = 'Starting download via browser…';
        wrap.appendChild(status);
        body.appendChild(wrap);

        try {
            chrome.runtime.sendMessage({
                action: 'download',
                data: { url: quality.directUrl, filename },
            }, (resp) => {
                if (chrome.runtime.lastError) {
                    console.error('[RumbleX] Download message error:', chrome.runtime.lastError);
                    this._setBodyText('rx-dl-error', 'Download failed: ' + chrome.runtime.lastError.message);
                    return;
                }
                if (resp?.error) {
                    this._setBodyText('rx-dl-error', 'Download rejected: ' + resp.error);
                } else if (resp?.downloadId) {
                    this._setBodyText('rx-dl-done', 'Download started! Check your browser downloads.');
                } else {
                    this._setBodyText('rx-dl-error', 'Download failed to start');
                }
            });
        } catch (e) {
            this._setBodyText('rx-dl-error', 'Error: ' + (e?.message || e));
            console.error('[RumbleX] Direct download failed:', e);
        }
    },

    async _startDownload(quality, title, format) {
        const body = this._setBody(`
            <div class="rx-dl-progress-wrap">
                <div class="rx-dl-status">Fetching stream playlist...</div>
                <div class="rx-dl-bar-bg"><div class="rx-dl-bar-fill"></div></div>
            </div>`);

        const statusEl = body.querySelector('.rx-dl-status');
        const barEl = body.querySelector('.rx-dl-bar-fill');
        const setProgress = (pct, msg) => {
            barEl.style.width = pct + '%';
            if (msg) statusEl.textContent = msg;
        };

        try {
            // Fetch master playlist
            const masterResp = await fetch(this._hlsUrl);
            const masterText = await masterResp.text();
            const variants = this._parseMasterPlaylist(masterText, this._hlsUrl);

            // Find matching quality variant
            let variant = variants.find(v => v.height === quality.height);
            if (!variant) variant = variants.reduce((a, b) =>
                Math.abs(b.height - quality.height) < Math.abs(a.height - quality.height) ? b : a, variants[0]);
            if (!variant) throw new Error('No matching stream variant found');

            setProgress(2, 'Fetching segment list...');

            const variantResp = await fetch(variant.url);
            const variantText = await variantResp.text();
            const segmentUrls = this._parseSegmentPlaylist(variantText, variant.url);

            if (!segmentUrls.length) throw new Error('No segments found in playlist');

            const total = segmentUrls.length;
            const CONCURRENT = 6;
            let completed = 0;

            if (format === 'mp4') {
                // MP4: download all segments then transmux in Web Worker
                setProgress(5, `Downloading 0/${total} segments...`);
                const tsBuffers = [];

                for (let i = 0; i < total; i += CONCURRENT) {
                    const batch = segmentUrls.slice(i, i + CONCURRENT);
                    const results = await Promise.all(batch.map(async (url) => {
                        const resp = await fetch(url);
                        return resp.arrayBuffer();
                    }));
                    tsBuffers.push(...results);
                    completed += batch.length;
                    const pct = 5 + (completed / total) * 70;
                    setProgress(pct, `Downloading ${completed}/${total} segments...`);
                }

                setProgress(78, 'Converting to MP4 (Web Worker)...');
                const mp4Blob = await this._transmuxWithWorker(tsBuffers);
                tsBuffers.length = 0;

                setProgress(100, 'Starting download...');
                this._triggerSave(mp4Blob, `${title} - ${quality.label}.mp4`, 'video/mp4');
                this._setBody('<div class="rx-dl-done">Download complete!</div>');
            } else {
                // TS: download in chunks, build Blob
                setProgress(5, `Downloading 0/${total} segments...`);
                const tsParts = [];

                for (let i = 0; i < total; i += CONCURRENT) {
                    const batch = segmentUrls.slice(i, i + CONCURRENT);
                    const results = await Promise.all(batch.map(async (url) => {
                        const resp = await fetch(url);
                        return resp.arrayBuffer();
                    }));
                    tsParts.push(...results);
                    completed += results.length;
                    const pct = 5 + (completed / total) * 90;
                    setProgress(pct, `Downloading ${completed}/${total} segments...`);
                }

                setProgress(95, 'Preparing download...');
                const blob = new Blob(tsParts, { type: 'video/mp2t' });
                tsParts.length = 0;
                setProgress(100, 'Starting download...');
                this._triggerSave(blob, `${title} - ${quality.label}.ts`, 'video/mp2t');
                this._setBody('<div class="rx-dl-done">Download complete!</div>');
            }
        } catch (e) {
            const errorEl = document.createElement('div');
            errorEl.className = 'rx-dl-error';
            errorEl.textContent = 'Error: ' + e.message;
            body.appendChild(errorEl);
            console.error('[RumbleX] Download failed:', e);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-download-css');
    },

    destroy() {
        // Cancel any deep-scan probes in flight so they don't resolve into
        // a now-detached DOM and so we stop pinging the CDN after disable.
        this._scanController?.abort();
        this._scanController = null;
        this._scanSeq++;
        this._closeDownloadOverlay?.();
        this._styleEl?.remove();
        this._worker?.terminate();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Logo to Feed
// ═══════════════════════════════════════════
const LogoToFeed = {
    id: 'logoToFeed',
    name: 'Logo to Feed',
    _obs: null,

    _redirectLogos() {
        // Primary target: the flex logo link with Rumble SVGs
        for (const a of qsa('a[href="/"].flex')) {
            if (a.querySelector('use[href*="rumble-logo"]')) {
                a.href = '/subscriptions';
            }
        }
        // Video player logo: svg.RumbleElm with logo viewBox (not play/pause/other controls)
        for (const svg of qsa('svg.RumbleElm[viewBox="0 0 140 35"], svg.RumbleElm[viewBox="0 0 35 35"]')) {
            if (svg.dataset.rxFeedBound) continue;
            svg.dataset.rxFeedBound = '1';
            svg.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                location.href = 'https://rumble.com/subscriptions';
            }, true);
            svg.style.cursor = 'pointer';
        }
        // Secondary: any header/nav link to "/" containing SVG/img (logo variants)
        for (const a of qsa('a[href="/"]')) {
            if (a.href.endsWith('/') && a.closest('.header, nav, .sidenav') && (a.querySelector('svg, img') || a.classList.toString().toLowerCase().includes('logo'))) {
                a.href = '/subscriptions';
            }
        }
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._redirectLogos();
        this._obs = new MutationObserver(() => this._redirectLogos());
        this._obs.observe(document.body, { childList: true, subtree: true });
    },

    destroy() {
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Speed Controller
// ═══════════════════════════════════════════
const SpeedController = {
    id: 'speedController',
    name: 'Speed Control',
    _styleEl: null,
    _obs: null,
    _overlayEl: null,
    _overlayTimer: null,

    _css: `
        #rx-speed-overlay {
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            padding: 6px 16px;
            background: rgba(0,0,0,0.8);
            color: #cdd6f4;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            z-index: 100000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #rx-speed-overlay.rx-visible { opacity: 1; }
    `,

    _speeds: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0],

    _isLive() {
        return !!qs('.media-description-info-stream-time') || !!qs('#chat-history-list');
    },

    _showOverlay(text) {
        if (!this._overlayEl) {
            this._overlayEl = document.createElement('div');
            this._overlayEl.id = 'rx-speed-overlay';
            document.body.appendChild(this._overlayEl);
        }
        this._overlayEl.textContent = text;
        this._overlayEl.classList.add('rx-visible');
        clearTimeout(this._overlayTimer);
        this._overlayTimer = setTimeout(() => this._overlayEl.classList.remove('rx-visible'), 1200);
    },

    _applySpeed(video) {
        if (this._isLive()) return;
        const speed = Settings.get('playbackSpeed') || 1.0;
        if (video.playbackRate !== speed) {
            video.playbackRate = speed;
        }
    },

    _cycleSpeed(direction) {
        if (this._isLive()) {
            this._showOverlay('Speed: 1.0x (Live)');
            return;
        }
        const current = Settings.get('playbackSpeed') || 1.0;
        const idx = this._speeds.indexOf(current);
        let newIdx;
        if (direction > 0) {
            newIdx = idx < this._speeds.length - 1 ? idx + 1 : idx;
        } else {
            newIdx = idx > 0 ? idx - 1 : 0;
        }
        const newSpeed = this._speeds[newIdx];
        Settings.set('playbackSpeed', newSpeed);
        for (const v of qsa('video')) v.playbackRate = newSpeed;
        this._showOverlay(`Speed: ${newSpeed}x`);
    },

    _bindVideo(video) {
        if (video.dataset.rxSpeedBound) return;
        video.dataset.rxSpeedBound = '1';
        this._applySpeed(video);
        video.addEventListener('play', () => this._applySpeed(video));
        video.addEventListener('ratechange', () => {
            const target = Settings.get('playbackSpeed') || 1.0;
            if (!this._isLive() && Math.abs(video.playbackRate - target) > 0.01) {
                video.playbackRate = target;
            }
        });
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-speed-css');
        for (const v of qsa('video')) this._bindVideo(v);
        this._obs = new MutationObserver(() => {
            for (const v of qsa('video')) this._bindVideo(v);
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._overlayEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Scroll Volume Control
// ═══════════════════════════════════════════
const ScrollVolume = {
    id: 'scrollVolume',
    name: 'Scroll Volume',
    _styleEl: null,
    _obs: null,
    _overlayEl: null,
    _overlayTimer: null,

    _css: `
        #rx-volume-overlay {
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            padding: 8px 18px;
            background: rgba(0,0,0,0.85);
            color: #cdd6f4;
            font-size: 13px;
            font-weight: 600;
            border-radius: 8px;
            z-index: 100000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #rx-volume-overlay.rx-visible { opacity: 1; }
        #rx-volume-overlay .rx-vol-bar {
            width: 80px;
            height: 4px;
            background: rgba(255,255,255,0.15);
            border-radius: 2px;
            overflow: hidden;
        }
        #rx-volume-overlay .rx-vol-fill {
            height: 100%;
            background: var(--rx-accent, #89b4fa);
            border-radius: 2px;
            transition: width 0.1s ease;
        }
    `,

    STEP: 0.05,
    STORAGE_KEY: 'rx_volume',

    _showOverlay(text, pct) {
        if (!this._overlayEl) {
            this._overlayEl = document.createElement('div');
            this._overlayEl.id = 'rx-volume-overlay';
            this._overlayEl.innerHTML = '<span></span><div class="rx-vol-bar"><div class="rx-vol-fill"></div></div>';
            document.body.appendChild(this._overlayEl);
        }
        this._overlayEl.querySelector('span').textContent = text;
        this._overlayEl.querySelector('.rx-vol-fill').style.width = pct + '%';
        this._overlayEl.classList.add('rx-visible');
        clearTimeout(this._overlayTimer);
        this._overlayTimer = setTimeout(() => this._overlayEl.classList.remove('rx-visible'), 1500);
    },

    _saveVolume(vol) {
        try { localStorage.setItem(this.STORAGE_KEY, vol.toString()); } catch {}
    },

    _loadVolume() {
        try {
            const v = parseFloat(localStorage.getItem(this.STORAGE_KEY));
            return isNaN(v) ? null : Math.min(1, Math.max(0, v));
        } catch { return null; }
    },

    _onWheel(e) {
        // Only handle if cursor is directly over the video/player area
        const playerArea = e.target.closest('#rx-split-left, .videoPlayer-Rumble-cls, #videoPlayer, video');
        if (!playerArea) return;
        // Don't intercept if over the right panel in theater split
        if (e.target.closest('#rx-split-right, #rx-tab-bar, .rx-panel-header')) return;
        // When TheaterSplit is active, yield all wheel events on the player area —
        // TheaterSplit uses scroll to expand/collapse the split panel.
        // Volume can still be adjusted via keyboard (ArrowUp/Down) or middle-click.
        if (TheaterSplit._isActive && playerArea.closest('#rx-split-left')) return;
        const video = playerArea.tagName === 'VIDEO' ? playerArea : playerArea.querySelector('video');
        if (!video) return;

        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -this.STEP : this.STEP;
        let newVol = Math.min(1, Math.max(0, video.volume + delta));
        newVol = Math.round(newVol * 100) / 100;

        if (newVol > 0 && video.muted) video.muted = false;
        video.volume = newVol;
        this._saveVolume(newVol);
        this._showOverlay(`${Math.round(newVol * 100)}%`, Math.round(newVol * 100));
    },

    _onMiddleClick(e) {
        if (e.button !== 1) return;
        const video = e.target.closest('video') || (e.target.closest('#rx-split-left, .videoPlayer-Rumble-cls, #videoPlayer') || document).querySelector('video');
        if (!video) return;
        e.preventDefault();
        video.muted = !video.muted;
        const pct = Math.round(video.volume * 100);
        this._showOverlay(video.muted ? 'Muted' : `${pct}%`, video.muted ? 0 : pct);
    },

    _restoreVolume(video) {
        const saved = this._loadVolume();
        if (saved !== null) {
            video.volume = saved;
            if (saved > 0) video.muted = false;
        } else if (Settings.get('defaultMaxVolume')) {
            video.volume = 1;
            video.muted = false;
            this._saveVolume(1);
        }
    },

    _bindVideo(video) {
        if (video.dataset.rxVolBound) return;
        video.dataset.rxVolBound = '1';
        this._restoreVolume(video);
        video.addEventListener('loadedmetadata', () => this._restoreVolume(video));
        video.addEventListener('play', () => this._restoreVolume(video), { once: true });
    },

    _volPinned: false,
    _volPinTimer: null,
    _volPopup: null,
    _volPopupObs: null,

    _isVolPopup(el) {
        if (!el || el.nodeType !== 1 || el.tagName !== 'DIV') return false;
        const s = el.style;
        return s.position === 'absolute' &&
               s.backdropFilter && s.backdropFilter.includes('blur') &&
               parseInt(s.width) <= 20 &&
               parseInt(s.height) >= 60 &&
               s.bottom;
    },

    _pinPopup(popup) {
        if (popup._rxVolBound) return;
        popup._rxVolBound = true;
        this._volPopup = popup;

        // Direct hover on popup: pin indefinitely until mouseleave
        popup.addEventListener('mouseenter', () => {
            clearTimeout(this._volPinTimer);
            this._volPinned = true;
        });
        popup.addEventListener('mouseleave', () => {
            this._volPinTimer = setTimeout(() => {
                this._volPinned = false;
            }, 300);
        });

        // Watch for Rumble showing/hiding the popup via inline style changes
        this._volPopupObs = new MutationObserver(() => {
            const s = popup.style;
            const isHidden = s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0;

            if (!isHidden && !this._volPinned) {
                // Popup just became visible — grant a grace period to reach it
                clearTimeout(this._volPinTimer);
                this._volPinned = true;
                this._volPinTimer = setTimeout(() => {
                    if (!popup.matches(':hover')) {
                        this._volPinned = false;
                    }
                }, 800);
            }

            if (isHidden && this._volPinned) {
                // Rumble trying to hide while pinned — revert
                s.display = 'block';
                s.visibility = 'visible';
                s.opacity = '1';
            }
        });
        this._volPopupObs.observe(popup, { attributes: true, attributeFilter: ['style'] });
    },

    _scanForVolPopup() {
        if (this._volPopup) return;
        const player = qs('#videoPlayer, .videoPlayer-Rumble-cls');
        if (!player) return;
        for (const el of player.querySelectorAll('div[style*="backdrop-filter"]')) {
            if (this._isVolPopup(el)) {
                this._pinPopup(el);
                return;
            }
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-scrollvol-css');

        this._wheelFn = (e) => this._onWheel(e);
        this._midclickFn = (e) => this._onMiddleClick(e);
        document.addEventListener('wheel', this._wheelFn, { passive: false, capture: true });
        document.addEventListener('mousedown', this._midclickFn, { capture: true });

        for (const v of qsa('video')) this._bindVideo(v);

        this._obs = new MutationObserver(() => {
            for (const v of qsa('video')) this._bindVideo(v);
            if (!this._volPopup) this._scanForVolPopup();
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });

        // Also scan after a delay since the player renders async
        setTimeout(() => this._scanForVolPopup(), 2000);
        setTimeout(() => this._scanForVolPopup(), 5000);
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._volPopupObs?.disconnect();
        this._overlayEl?.remove();
        clearTimeout(this._volPinTimer);
        this._volPinned = false;
        this._volPopup = null;
        if (this._wheelFn) document.removeEventListener('wheel', this._wheelFn, { capture: true });
        if (this._midclickFn) document.removeEventListener('mousedown', this._midclickFn, { capture: true });
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Auto Max Quality
// ═══════════════════════════════════════════
const AutoMaxQuality = {
    id: 'autoMaxQuality',
    name: 'Auto Max Quality',
    _obs: null,
    _attempted: false,
    _timers: [],

    _clearTimers() {
        for (const t of this._timers) clearTimeout(t);
        this._timers = [];
    },

    _selectBest() {
        if (this._attempted) return;
        // Rumble's quality menu: find the settings gear, open it, pick highest
        // The player uses class .touched_overlay_item for the settings button area
        const settingsBtn = qs('.touched_overlay_item + div button, [class*="quality-menu"], .videoPlayer-Rumble-cls button[aria-label*="Settings"]');
        if (settingsBtn) {
            this._attempted = true;
            this._clearTimers();
            this._obs?.disconnect();
            this._tryQualitySelect();
            return;
        }
        // Alternative: directly manipulate through Rumble's player API if available
        this._tryAPIApproach();
    },

    _tryAPIApproach() {
        // Rumble stores quality options in the player. Try to access via the embed API
        const player = qs('#videoPlayer, .videoPlayer-Rumble-cls');
        if (!player) return;

        // Look for quality selector buttons in the player overlay
        const qualityItems = qsa('.quality-menu-item, [data-quality], .videoPlayer-Rumble-cls [class*="quality"]');
        if (qualityItems.length > 0) {
            this._attempted = true;
            this._clearTimers();
            this._obs?.disconnect();
            let best = qualityItems[0];
            for (const item of qualityItems) {
                const text = item.textContent;
                const match = text.match(/(\d+)p/);
                if (match) {
                    const res = parseInt(match[1]);
                    const bestMatch = best.textContent.match(/(\d+)p/);
                    if (bestMatch && res > parseInt(bestMatch[1])) best = item;
                }
            }
            best.click();
            return;
        }

        // Fallback: use the DOM-clicking approach from the Greasyfork scripts
        this._tryDOMClick();
    },

    _tryDOMClick() {
        // Approach inspired by "Rumble - Auto Best Video Quality" userscript
        // Navigate: settings overlay > last child (quality menu) > click highest option
        try {
            const overlay = qs('.touched_overlay_item');
            if (!overlay) return;
            const settingsPanel = overlay.nextElementSibling;
            if (!settingsPanel) return;
            const qualitySection = settingsPanel.lastChild?.lastChild;
            if (!qualitySection) return;

            // Click the settings button to open
            const settingsClick = settingsPanel.firstChild;
            if (settingsClick) settingsClick.click();

            // Short delay then pick highest quality (last child of quality list)
            setTimeout(() => {
                const qualityList = qualitySection.lastChild;
                if (qualityList) {
                    // Get all quality options, pick the one with highest resolution
                    const options = qualityList.children;
                    let best = null;
                    let bestRes = 0;
                    for (const opt of options) {
                        const text = opt.textContent.trim();
                        if (text.toLowerCase() === 'auto') continue;
                        const m = text.match(/(\d+)/);
                        if (m && parseInt(m[1]) > bestRes) {
                            bestRes = parseInt(m[1]);
                            best = opt;
                        }
                    }
                    if (best) {
                        this._attempted = true;
                        this._clearTimers();
                        this._obs?.disconnect();
                        best.click();
                    }
                }
            }, 300);
        } catch {}
    },

    _tryQualitySelect() {
        // Direct interaction with quality menu items
        setTimeout(() => {
            const items = qsa('[class*="quality"] li, [class*="quality"] div[role="option"], [class*="quality"] button');
            if (!items.length) return;
            let best = null;
            let bestRes = 0;
            for (const item of items) {
                const text = item.textContent.trim();
                if (text.toLowerCase() === 'auto') continue;
                const m = text.match(/(\d+)/);
                if (m && parseInt(m[1]) > bestRes) {
                    bestRes = parseInt(m[1]);
                    best = item;
                }
            }
            if (best) best.click();
        }, 500);
    },

    // Preferred path (ported from Rumble Enhancement Suite v11): directly ask
    // hls.js for the top level once the manifest is parsed. Much more reliable
    // than clicking through the overlay when the player exposes an hls.js
    // instance on the <video> element. We retain a reference to the bound
    // listener so destroy() can unhook it instead of leaving a handler
    // attached to the hls instance for the life of the page.
    _hlsInstances: null, // WeakRef-less Set — hls instances we've bound to
    _hlsApply: null,

    _tryHlsDirect() {
        if (this._attempted) return false;
        const video = qs('#videoPlayer video, video');
        const hls = video?.hls;
        if (!hls) return false;
        const apply = () => {
            if (Array.isArray(hls.levels) && hls.levels.length > 1) {
                try {
                    hls.nextLevel = hls.levels.length - 1;
                    this._attempted = true;
                    this._clearTimers();
                    this._obs?.disconnect();
                    return true;
                } catch {}
            }
            return false;
        };
        if (apply()) return true;
        // If the manifest isn't parsed yet, hook the event. hls.js exposes
        // Hls.Events.MANIFEST_PARSED === 'hlsManifestParsed' — use the string
        // so we don't depend on a global Hls binding.
        try {
            hls.on?.('hlsManifestParsed', apply);
            this._hlsInstances = this._hlsInstances || new Set();
            this._hlsInstances.add({ hls, apply });
        } catch {}
        return false;
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._attempted = false;
        this._hlsInstances = new Set();

        // Try the hls.js direct path immediately, and retry a few times as
        // the player hot-swaps its <video> element during loading.
        this._timers = [];
        const attempts = [500, 1500, 3000, 5000, 8000];
        for (const delay of attempts) {
            this._timers.push(setTimeout(() => {
                if (this._attempted) return;
                if (this._tryHlsDirect()) return;
                this._selectBest();
            }, delay));
        }

        // Also watch for player DOM changes
        this._obs = new MutationObserver(() => {
            if (this._attempted) return;
            if (this._tryHlsDirect()) return;
            this._selectBest();
        });
        waitFor('#videoPlayer, .videoPlayer-Rumble-cls').then(el => {
            this._obs.observe(el, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._clearTimers();
        this._obs?.disconnect();
        // Detach each hls.js listener we bound, so we don't leave handlers
        // hanging on the player after the feature is disabled.
        if (this._hlsInstances) {
            for (const entry of this._hlsInstances) {
                try { entry.hls.off?.('hlsManifestParsed', entry.apply); } catch {}
            }
            this._hlsInstances.clear();
        }
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Watch Progress (Resume Playback)
// ═══════════════════════════════════════════
const WatchProgress = {
    id: 'watchProgress',
    name: 'Watch Progress',
    _styleEl: null,
    _saveInterval: null,
    _obs: null,

    STORAGE_KEY: 'rx_watch_progress',
    MAX_ENTRIES: 500,
    SAVE_INTERVAL: 5000,
    RESUME_THRESHOLD: 5, // don't resume if < 5s in
    COMPLETE_THRESHOLD: 0.95, // consider complete at 95%

    _css: `
        .rx-progress-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: transparent;
            z-index: 5;
            pointer-events: none;
        }
        .rx-progress-fill {
            height: 100%;
            background: #f38ba8;
            border-radius: 0 2px 2px 0;
            transition: width 0.3s ease;
        }
        .rx-resume-toast {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            padding: 10px 20px;
            background: rgba(24,24,37,0.95);
            border: 1px solid rgba(137,180,250,0.2);
            color: #cdd6f4;
            font-size: 13px;
            border-radius: 10px;
            z-index: 100001;
            opacity: 0;
            transition: opacity 0.3s, transform 0.3s;
            cursor: pointer;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .rx-resume-toast.rx-visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        .rx-resume-toast:hover {
            border-color: rgba(137,180,250,0.4);
        }
    `,

    _getVideoId() {
        // Extract from URL path: /vXXXXXX-slug.html
        const m = location.pathname.match(/\/(v[a-z0-9]+)-/);
        if (m) return m[1];
        // Fallback: embed ID from player
        const player = qs('[id^="vid_v"]');
        if (player) return player.id.replace('vid_', '');
        return null;
    },

    _getStore() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
        } catch { return {}; }
    },

    _saveStore(store) {
        // Prune old entries
        const entries = Object.entries(store);
        if (entries.length > this.MAX_ENTRIES) {
            entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
            const pruned = Object.fromEntries(entries.slice(entries.length - this.MAX_ENTRIES));
            store = pruned;
        }
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(store)); } catch {}
    },

    _savePosition(video) {
        const id = this._getVideoId();
        if (!id || !video.duration || video.duration < 30) return;
        const fraction = video.currentTime / video.duration;
        if (fraction > this.COMPLETE_THRESHOLD) {
            // Video complete, remove entry
            const store = this._getStore();
            delete store[id];
            this._saveStore(store);
            return;
        }
        if (video.currentTime < this.RESUME_THRESHOLD) return;
        const store = this._getStore();
        store[id] = { t: Math.floor(video.currentTime), d: Math.floor(video.duration), ts: Date.now() };
        this._saveStore(store);
    },

    _tryResume(video) {
        const id = this._getVideoId();
        if (!id) return;
        const store = this._getStore();
        const entry = store[id];
        if (!entry || entry.t < this.RESUME_THRESHOLD) return;

        const fmtTime = (s) => {
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m}:${sec.toString().padStart(2, '0')}`;
        };

        const toast = document.createElement('div');
        toast.className = 'rx-resume-toast';
        toast.textContent = `Resume from ${fmtTime(entry.t)}?`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('rx-visible'));

        let dismissed = false;
        const dismiss = () => {
            if (dismissed) return;
            dismissed = true;
            toast.classList.remove('rx-visible');
            setTimeout(() => toast.remove(), 300);
        };

        toast.addEventListener('click', () => {
            if (video && video.isConnected && isFinite(entry.t)) {
                video.currentTime = entry.t;
            }
            dismiss();
        });

        // Auto-dismiss after 8s
        setTimeout(dismiss, 8000);
    },

    _addProgressBars() {
        const store = this._getStore();
        // Add progress indicators to video thumbnails in feeds
        for (const entry of qsa('.videostream, .video-listing-entry')) {
            const link = entry.querySelector('a[href*="/v"]');
            if (!link) continue;
            const m = link.href.match(/\/(v[a-z0-9]+)-/);
            if (!m) continue;
            const id = m[1];
            const progress = store[id];
            if (!progress || progress.t < this.RESUME_THRESHOLD) continue;

            const thumb = entry.querySelector('.videostream__image, .thumbnail__image, [class*="thumbnail"]');
            if (!thumb || thumb.querySelector('.rx-progress-bar')) continue;

            const pct = Math.min(100, (progress.t / progress.d) * 100);
            const bar = document.createElement('div');
            bar.className = 'rx-progress-bar';
            bar.innerHTML = `<div class="rx-progress-fill" style="width:${pct}%"></div>`;
            thumb.style.position = 'relative';
            thumb.appendChild(bar);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-watchprogress-css');

        if (Page.isWatch()) {
            waitFor('video').then(video => {
                this._tryResume(video);
                this._saveInterval = setInterval(() => this._savePosition(video), this.SAVE_INTERVAL);
                video.addEventListener('pause', () => this._savePosition(video));
                video.addEventListener('ended', () => this._savePosition(video));
            }).catch(() => {});
        }

        if (Page.isFeed() || Page.isHome()) {
            // Add progress bars after page loads
            setTimeout(() => this._addProgressBars(), 1000);
            this._obs = new MutationObserver(() => this._addProgressBars());
            this._obs.observe(document.body, { childList: true, subtree: true });
        }
    },

    destroy() {
        this._styleEl?.remove();
        if (this._saveInterval) clearInterval(this._saveInterval);
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Channel Blocker
// ═══════════════════════════════════════════
const ChannelBlocker = {
    id: 'channelBlocker',
    name: 'Channel Blocker',
    _styleEl: null,
    _obs: null,

    _css: `
        .rx-block-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: transparent;
            border: 1px solid transparent;
            color: rgba(255,255,255,0.3);
            cursor: pointer;
            font-size: 11px;
            line-height: 1;
            transition: all 0.15s;
            margin-left: 4px;
            vertical-align: middle;
            padding: 0;
        }
        .rx-block-btn:hover {
            color: #f38ba8;
            border-color: rgba(243,139,168,0.3);
            background: rgba(243,139,168,0.1);
        }
        .rx-block-btn svg {
            width: 12px;
            height: 12px;
        }
        .rx-blocked-channel {
            display: none !important;
        }
        .rx-unblock-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            padding: 3px 8px 3px 10px;
            border-radius: 12px;
            border: 1px solid rgba(243,139,168,0.2);
            background: rgba(243,139,168,0.08);
            color: #f38ba8;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s;
        }
        .rx-unblock-chip:hover {
            background: rgba(243,139,168,0.15);
            border-color: rgba(243,139,168,0.4);
        }
        .rx-unblock-chip svg { width: 10px; height: 10px; }
    `,

    _blockSVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',

    _getBlocked() {
        return Settings.get('blockedChannels') || [];
    },

    _blockChannel(name) {
        const blocked = this._getBlocked();
        const normalized = name.trim().toLowerCase();
        if (blocked.includes(normalized)) return;
        blocked.push(normalized);
        Settings.set('blockedChannels', blocked);
        this._filterFeed();
    },

    _unblockChannel(name) {
        let blocked = this._getBlocked();
        blocked = blocked.filter(c => c !== name.trim().toLowerCase());
        Settings.set('blockedChannels', blocked);
        this._filterFeed();
    },

    _filterFeed() {
        const blocked = this._getBlocked();
        if (!blocked.length) return;

        for (const entry of qsa('.videostream, .video-listing-entry')) {
            const channelEl = entry.querySelector('.videostream__author, .video-listing-entry--by-name, [class*="channel-name"], .videostream__footer a[href*="/c/"], .videostream__footer a[href*="/user/"]');
            if (!channelEl) continue;
            const name = channelEl.textContent.trim().toLowerCase();
            if (blocked.includes(name)) {
                entry.classList.add('rx-blocked-channel');
            } else {
                entry.classList.remove('rx-blocked-channel');
            }
        }
    },

    _addBlockButtons() {
        for (const entry of qsa('.videostream, .video-listing-entry')) {
            if (entry.querySelector('.rx-block-btn')) continue;
            const channelEl = entry.querySelector('.videostream__author, .video-listing-entry--by-name, .videostream__footer a[href*="/c/"], .videostream__footer a[href*="/user/"]');
            if (!channelEl) continue;

            const btn = document.createElement('button');
            btn.className = 'rx-block-btn';
            btn.title = 'Block this channel';
            btn.innerHTML = this._blockSVG;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._blockChannel(channelEl.textContent);
            });
            channelEl.parentElement.appendChild(btn);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isFeed() && !Page.isHome()) return;
        this._styleEl = injectStyle(this._css, 'rx-chanblocker-css');
        setTimeout(() => {
            this._addBlockButtons();
            this._filterFeed();
        }, 1000);
        this._obs = new MutationObserver(() => {
            this._addBlockButtons();
            this._filterFeed();
        });
        this._obs.observe(document.body, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Keyboard Navigation
// ═══════════════════════════════════════════
const KeyboardNav = {
    id: 'keyboardNav',
    name: 'Keyboard Nav',
    _handler: null,

    _getVideo() {
        return qs('#rx-split-left video') || qs('#videoPlayer video') || qs('.videoPlayer-Rumble-cls video') || qs('video');
    },

    _isTyping(e) {
        const tag = e.target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable ||
               e.target.closest('.chat--input, .comments-create, [contenteditable]');
    },

    _showOverlay(text) {
        SpeedController._showOverlay?.(text) || (() => {
            // Fallback if speed controller is off
            let el = qs('#rx-kbd-overlay');
            if (!el) {
                el = document.createElement('div');
                el.id = 'rx-kbd-overlay';
                el.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);padding:6px 16px;background:rgba(0,0,0,0.8);color:#cdd6f4;font-size:14px;font-weight:600;border-radius:8px;z-index:100000;pointer-events:none;opacity:0;transition:opacity 0.3s;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
                document.body.appendChild(el);
            }
            el.textContent = text;
            el.style.opacity = '1';
            clearTimeout(el._timer);
            el._timer = setTimeout(() => { el.style.opacity = '0'; }, 1200);
        })();
    },

    _fmtTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;

        this._handler = (e) => {
            if (this._isTyping(e)) return;
            const video = this._getVideo();
            if (!video) return;

            const key = e.key.toLowerCase();

            switch (key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    video.paused ? video.play() : video.pause();
                    break;

                case 'j':
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    this._showOverlay(this._fmtTime(video.currentTime));
                    break;

                case 'l':
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
                    this._showOverlay(this._fmtTime(video.currentTime));
                    break;

                case 'arrowleft':
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - 5);
                    this._showOverlay(this._fmtTime(video.currentTime));
                    break;

                case 'arrowright':
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
                    this._showOverlay(this._fmtTime(video.currentTime));
                    break;

                case 'arrowup':
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.05);
                    if (video.muted) video.muted = false;
                    ScrollVolume._saveVolume?.(video.volume);
                    this._showOverlay(`${Math.round(video.volume * 100)}%`);
                    break;

                case 'arrowdown':
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.05);
                    ScrollVolume._saveVolume?.(video.volume);
                    this._showOverlay(`${Math.round(video.volume * 100)}%`);
                    break;

                case 'f':
                    e.preventDefault();
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    } else {
                        (video.closest('.videoPlayer-Rumble-cls') || video).requestFullscreen().catch(() => {});
                    }
                    break;

                case 'm':
                    e.preventDefault();
                    video.muted = !video.muted;
                    this._showOverlay(video.muted ? 'Muted' : `${Math.round(video.volume * 100)}%`);
                    break;

                case ',':
                    if (video.paused) {
                        e.preventDefault();
                        video.currentTime = Math.max(0, video.currentTime - (1 / 30));
                    }
                    break;

                case '.':
                    if (video.paused) {
                        e.preventDefault();
                        video.currentTime = Math.min(video.duration, video.currentTime + (1 / 30));
                    }
                    break;

                case '<':
                    e.preventDefault();
                    SpeedController._cycleSpeed?.(-1);
                    break;

                case '>':
                    e.preventDefault();
                    SpeedController._cycleSpeed?.(1);
                    break;

                default:
                    // Number keys 0-9: seek to percentage
                    if (/^[0-9]$/.test(key) && video.duration) {
                        e.preventDefault();
                        video.currentTime = (parseInt(key) / 10) * video.duration;
                        this._showOverlay(this._fmtTime(video.currentTime));
                    }
                    break;
            }
        };

        document.addEventListener('keydown', this._handler);
    },

    destroy() {
        if (this._handler) document.removeEventListener('keydown', this._handler);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Auto Theater Mode
// ═══════════════════════════════════════════
const AutoTheater = {
    id: 'autoTheater',
    name: 'Auto Theater',

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        // Don't fight with TheaterSplit - if that's enabled, it handles theater
        if (Settings.get('theaterSplit')) return;

        // Click Rumble's native theater button
        const tryClick = () => {
            const theaterBtn = qs('[data-js="theater-mode-toggle"]') ||
                qs('button[title*="heater" i]') ||
                qs('button[aria-label*="heater" i]') ||
                qs('#theaterVideoPlayer');
            if (theaterBtn) {
                const isActive = theaterBtn.classList.contains('active') ||
                    document.body.classList.contains('theater-mode') ||
                    document.documentElement.classList.contains('theater-mode');
                if (!isActive) {
                    theaterBtn.click();
                    return true;
                }
                return true; // already active
            }
            return false;
        };

        // Retry since player loads async
        const attempts = [1500, 3000, 5000, 8000];
        for (const delay of attempts) {
            setTimeout(() => tryClick(), delay);
        }
    },

    destroy() {}
};

// ═══════════════════════════════════════════
//  FEATURE: Live Chat Enhance
// ═══════════════════════════════════════════
const LiveChatEnhance = {
    id: 'liveChatEnhance',
    name: 'Chat Enhance',
    _styleEl: null,
    _obs: null,
    _highlightWords: [],

    _css: `
        .rx-chat-highlight {
            background: rgba(137,180,250,0.15) !important;
            border-left: 2px solid var(--rx-accent, #89b4fa) !important;
        }
        .rx-chat-mention {
            color: var(--rx-accent, #89b4fa);
            font-weight: 600;
        }
        #rx-chat-filter {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            flex-shrink: 0;
        }
        #rx-chat-filter input {
            flex: 1;
            background: rgba(49,50,68,0.5);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 11px;
            color: var(--rx-text, #cdd6f4);
            outline: none;
        }
        #rx-chat-filter input:focus {
            border-color: rgba(137,180,250,0.3);
        }
        #rx-chat-filter input::placeholder {
            color: rgba(255,255,255,0.25);
        }
        .rx-chat-badge-rant {
            display: inline-block;
            padding: 1px 5px;
            border-radius: 4px;
            background: rgba(243,139,168,0.15);
            color: #f38ba8;
            font-size: 10px;
            font-weight: 600;
            margin-left: 4px;
        }
        .rx-chat-hidden { display: none !important; }
    `,

    _highlightMentions(msgEl) {
        const textEls = msgEl.querySelectorAll('.chat--message-text, .chat--message');
        for (const el of textEls) {
            if (el.dataset.rxMentionDone) continue;
            el.dataset.rxMentionDone = '1';
            // Walk the element's text nodes and replace @mentions *in place*.
            // Previously we did `el.innerHTML = el.innerHTML.replace(...)` which
            // re-parses the whole subtree — accidentally re-triggering any
            // markup side-effects (e.g. <img onerror>) that Rumble's chat
            // renderer happened to have emitted. Text-node walking keeps us
            // strictly inside Text nodes, so any existing HTML is untouched.
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const targets = [];
            while (walker.nextNode()) {
                const node = walker.currentNode;
                if (!node.nodeValue || !/@\w+/.test(node.nodeValue)) continue;
                // Skip text inside nodes we already wrapped or inside elements
                // that shouldn't carry mention styling (links, our own span).
                const parent = node.parentElement;
                if (!parent || parent.classList?.contains('rx-chat-mention')) continue;
                targets.push(node);
            }
            for (const node of targets) {
                const frag = document.createDocumentFragment();
                const text = node.nodeValue;
                let lastIdx = 0;
                const re = /@(\w+)/g;
                let m;
                while ((m = re.exec(text)) !== null) {
                    if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
                    const span = document.createElement('span');
                    span.className = 'rx-chat-mention';
                    span.textContent = '@' + m[1];
                    frag.appendChild(span);
                    lastIdx = m.index + m[0].length;
                }
                if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
                node.parentNode?.replaceChild(frag, node);
            }
        }
    },

    _processMessages() {
        const messages = qsa('#chat-history-list li, .chat--message-container');
        for (const msg of messages) {
            if (msg.dataset.rxProcessed) continue;
            msg.dataset.rxProcessed = '1';
            this._highlightMentions(msg);
        }

        // Apply filter if active
        this._applyFilter();
    },

    _applyFilter() {
        const filterInput = qs('#rx-chat-filter-input');
        if (!filterInput || !filterInput.value.trim()) return;

        const term = filterInput.value.trim().toLowerCase();
        const messages = qsa('#chat-history-list li, .chat--message-container');
        for (const msg of messages) {
            const text = msg.textContent.toLowerCase();
            msg.classList.toggle('rx-chat-hidden', !text.includes(term));
        }
    },

    _clearFilter() {
        for (const msg of qsa('.rx-chat-hidden')) {
            msg.classList.remove('rx-chat-hidden');
        }
    },

    _addFilterBar() {
        const chatHeader = qs('.chat--header') || qs('#rx-tab-chat .chat--header');
        if (!chatHeader || qs('#rx-chat-filter')) return;

        const filterBar = document.createElement('div');
        filterBar.id = 'rx-chat-filter';
        const input = document.createElement('input');
        input.id = 'rx-chat-filter-input';
        input.type = 'text';
        input.placeholder = 'Filter chat...';
        input.addEventListener('input', () => {
            if (input.value.trim()) {
                this._applyFilter();
            } else {
                this._clearFilter();
            }
        });
        filterBar.appendChild(input);
        chatHeader.after(filterBar);
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-livechat-css');

        // Wait for chat to appear
        const startObs = () => {
            this._addFilterBar();
            this._processMessages();
            this._obs = new MutationObserver(() => {
                this._processMessages();
                if (!qs('#rx-chat-filter')) this._addFilterBar();
            });
            const chatList = qs('#chat-history-list') || qs('.chat--height');
            if (chatList) {
                this._obs.observe(chatList, { childList: true, subtree: true });
            }
        };

        waitFor('#chat-history-list, .chat--height').then(() => {
            setTimeout(startObs, 500);
        }).catch(() => {
            // Not a live stream, that's fine
        });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Video Timestamps
// ═══════════════════════════════════════════
const VideoTimestamps = {
    id: 'videoTimestamps',
    name: 'Timestamps',
    _styleEl: null,
    _obs: null,

    _css: `
        .rx-timestamp-link {
            color: var(--rx-accent, #89b4fa);
            cursor: pointer;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
            text-decoration: none;
            border-bottom: 1px dotted rgba(137,180,250,0.3);
            transition: color 0.15s, border-color 0.15s;
        }
        .rx-timestamp-link:hover {
            color: #b4d0fb;
            border-bottom-color: rgba(137,180,250,0.6);
        }
    `,

    // Match timestamps like 0:00, 1:23, 01:23, 1:23:45, 01:23:45
    _timestampRegex: /\b(\d{1,2}:(?:[0-5]\d)(?::[0-5]\d)?)\b/g,

    _parseTimestamp(str) {
        const parts = str.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return 0;
    },

    _seekTo(seconds) {
        const video = qs('#rx-split-left video') || qs('#videoPlayer video') || qs('video');
        if (video) {
            video.currentTime = seconds;
            if (video.paused) video.play().catch(() => {});
        }
    },

    _processElement(el) {
        if (el.dataset.rxTimestampDone) return;
        if (el.querySelector('.rx-timestamp-link')) return;

        // Only process text nodes that actually contain timestamps
        const text = el.textContent;
        if (!this._timestampRegex.test(text)) return;
        this._timestampRegex.lastIndex = 0;

        el.dataset.rxTimestampDone = '1';

        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (this._timestampRegex.test(node.textContent)) {
                this._timestampRegex.lastIndex = 0;
                textNodes.push(node);
            }
            this._timestampRegex.lastIndex = 0;
        }

        for (const textNode of textNodes) {
            const frag = document.createDocumentFragment();
            let lastIndex = 0;
            const content = textNode.textContent;
            this._timestampRegex.lastIndex = 0;
            let match;

            while (match = this._timestampRegex.exec(content)) {
                // Add text before the match
                if (match.index > lastIndex) {
                    frag.appendChild(document.createTextNode(content.slice(lastIndex, match.index)));
                }
                // Create clickable timestamp
                const link = document.createElement('span');
                link.className = 'rx-timestamp-link';
                link.textContent = match[1];
                link.title = `Seek to ${match[1]}`;
                const seconds = this._parseTimestamp(match[1]);
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._seekTo(seconds);
                });
                frag.appendChild(link);
                lastIndex = match.index + match[0].length;
            }

            if (lastIndex < content.length) {
                frag.appendChild(document.createTextNode(content.slice(lastIndex)));
            }

            if (frag.childNodes.length > 0) {
                textNode.parentNode.replaceChild(frag, textNode);
            }
        }
    },

    _processAll() {
        // Process comments
        for (const el of qsa('.comment-text')) {
            this._processElement(el);
        }
        // Process description
        const desc = qs('.media-description');
        if (desc) this._processElement(desc);
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-timestamps-css');

        setTimeout(() => this._processAll(), 2000);
        this._obs = new MutationObserver(() => this._processAll());
        waitFor('.media-page-comments-container, #video-comments').then(el => {
            this._obs.observe(el, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: PiP Button
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  FEATURE: Screenshot Button
// ═══════════════════════════════════════════
const ScreenshotBtn = {
    id: 'screenshotBtn',
    name: 'Screenshot',
    _btn: null,

    _css: `
        .rx-screenshot-btn {
            position: absolute;
            top: 10px; left: 10px;
            z-index: 100;
            background: rgba(17,17,27,0.75);
            border: 1px solid rgba(205,214,244,0.2);
            color: #cdd6f4;
            border-radius: 6px;
            padding: 6px 10px;
            cursor: pointer;
            font: 700 12px/1 system-ui, sans-serif;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .videoPlayer-Rumble-cls:hover .rx-screenshot-btn,
        #videoPlayer:hover .rx-screenshot-btn { opacity: 1; }
        .rx-screenshot-btn:hover { background: rgba(17,17,27,0.9); border-color: #89b4fa; }
        .rx-screenshot-btn svg { width: 14px; height: 14px; fill: currentColor; }
    `,

    _capture() {
        const video = qs('video');
        if (!video || !video.videoWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const title = qs('.video-header-container__title, h1')?.textContent?.trim() || 'rumble';
            const safe = title.replace(/[^a-z0-9]+/gi, '_').substring(0, 60);
            const time = Math.floor(video.currentTime);
            const filename = `${safe}_${time}s.png`;

            // Try extension download API first, fall back to link click
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'download', data: { url, filename } }, () => {
                    URL.revokeObjectURL(url);
                });
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 5000);
            }
        }, 'image/png');
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch() && !Page.isEmbed()) return;
        this._styleEl = injectStyle(this._css, 'rx-screenshot-css');

        waitFor('#videoPlayer, .videoPlayer-Rumble-cls').then(container => {
            const btn = document.createElement('button');
            btn.className = 'rx-screenshot-btn';
            btn.title = 'Screenshot frame';
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>Snap`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._capture(); });
            container.style.position = container.style.position || 'relative';
            container.appendChild(btn);
            this._btn = btn;
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Watch History
// ═══════════════════════════════════════════
const WatchHistoryFeature = {
    id: 'watchHistory',
    name: 'Watch History',
    _MAX: 500,
    _KEY: 'rx_watch_history',

    _getHistory() {
        try { return JSON.parse(localStorage.getItem(this._KEY) || '[]'); }
        catch { return []; }
    },

    _saveHistory(entries) {
        localStorage.setItem(this._KEY, JSON.stringify(entries.slice(0, this._MAX)));
    },

    _recordCurrent() {
        if (!Page.isWatch()) return;
        const title = qs('.video-header-container__title, h1')?.textContent?.trim();
        const channel = qs('.media-heading-name, .media-by--a')?.textContent?.trim();
        const thumb = qs('meta[property="og:image"]')?.content || '';
        if (!title) return;

        const entry = {
            url: location.href,
            title,
            channel: channel || '',
            thumb,
            time: Date.now()
        };

        const history = this._getHistory().filter(e => e.url !== entry.url);
        history.unshift(entry);
        this._saveHistory(history);
    },

    _injectHistoryPage() {
        // Inject a watch history section on /account/history or our custom route
        // We'll add a link in the sidebar and show history on the subscriptions/feed page via a button
        const btn = document.createElement('button');
        btn.className = 'rx-history-btn';
        btn.textContent = 'Watch History';
        btn.title = 'View local watch history';
        btn.addEventListener('click', () => this._showOverlay());

        // Add to nav or toolbar area
        waitFor('.main-and-sidebar, .constrained-container, .subscriptions-header, .homepage-container').then(container => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'padding:8px 16px;';
            wrapper.appendChild(btn);
            container.parentNode?.insertBefore(wrapper, container);
        }).catch(() => {});
    },

    _css: `
        .rx-history-btn {
            background: #313244; color: #cdd6f4; border: 1px solid #45475a;
            border-radius: 6px; padding: 6px 14px; cursor: pointer;
            font: 600 13px/1.4 system-ui, sans-serif;
            transition: background 0.2s, border-color 0.2s;
        }
        .rx-history-btn:hover { background: #45475a; border-color: #89b4fa; }
        .rx-history-overlay {
            position: fixed; inset: 0; z-index: 100000;
            background: rgba(0,0,0,0.7); display: flex;
            justify-content: center; align-items: flex-start;
            padding: 40px 20px; overflow-y: auto;
        }
        .rx-history-panel {
            background: #1e1e2e; border: 1px solid #45475a;
            border-radius: 12px; max-width: 800px; width: 100%;
            padding: 24px; color: #cdd6f4;
            font-family: system-ui, sans-serif;
            max-height: calc(100vh - 80px); overflow-y: auto;
        }
        .rx-history-panel h2 { margin: 0 0 16px; font-size: 20px; color: #89b4fa; }
        .rx-history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .rx-history-clear { background: #f38ba8; color: #1e1e2e; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-weight: 600; font-size: 12px; }
        .rx-history-clear:hover { opacity: 0.85; }
        .rx-history-close { background: none; border: none; color: #6c7086; font-size: 24px; cursor: pointer; padding: 0 4px; }
        .rx-history-close:hover { color: #cdd6f4; }
        .rx-history-item {
            display: flex; gap: 12px; padding: 10px;
            border-radius: 8px; transition: background 0.15s;
            text-decoration: none; color: inherit; border-bottom: 1px solid #313244;
        }
        .rx-history-item:hover { background: #313244; }
        .rx-history-item img { width: 160px; height: 90px; object-fit: cover; border-radius: 6px; background: #313244; flex-shrink: 0; }
        .rx-history-meta { flex: 1; min-width: 0; }
        .rx-history-meta .title { font-weight: 600; font-size: 14px; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rx-history-meta .channel { color: #a6adc8; font-size: 12px; }
        .rx-history-meta .date { color: #6c7086; font-size: 11px; margin-top: 4px; }
        .rx-history-empty { text-align: center; color: #6c7086; padding: 40px 0; }
        .rx-history-search { width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #45475a; background: #313244; color: #cdd6f4; font-size: 13px; margin-bottom: 12px; outline: none; }
        .rx-history-search:focus { border-color: #89b4fa; }
    `,

    _showOverlay() {
        if (qs('.rx-history-overlay')) return;
        const history = this._getHistory();
        const overlay = document.createElement('div');
        overlay.className = 'rx-history-overlay';
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        const panel = document.createElement('div');
        panel.className = 'rx-history-panel';

        const header = document.createElement('div');
        header.className = 'rx-history-header';
        header.innerHTML = `<h2>Watch History (${history.length})</h2><div></div>`;

        const search = document.createElement('input');
        search.className = 'rx-history-search';
        search.placeholder = 'Search history...';
        search.type = 'text';

        const btnGroup = header.querySelector('div');
        const clearBtn = document.createElement('button');
        clearBtn.className = 'rx-history-clear';
        clearBtn.textContent = 'Clear All';
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem(this._KEY);
            overlay.remove();
        });
        const closeBtn = document.createElement('button');
        closeBtn.className = 'rx-history-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => overlay.remove());
        btnGroup.appendChild(clearBtn);
        btnGroup.appendChild(closeBtn);

        const list = document.createElement('div');
        const renderList = (filter = '') => {
            list.innerHTML = '';
            const filtered = filter
                ? history.filter(e => e.title.toLowerCase().includes(filter) || e.channel.toLowerCase().includes(filter))
                : history;
            if (!filtered.length) {
                list.innerHTML = '<div class="rx-history-empty">No watch history yet.</div>';
                return;
            }
            for (const e of filtered) {
                const a = document.createElement('a');
                a.className = 'rx-history-item';
                a.href = e.url;
                const date = new Date(e.time);
                const ago = this._timeAgo(date);
                a.innerHTML = `${e.thumb ? `<img src="${e.thumb}" loading="lazy" alt="">` : ''}
                    <div class="rx-history-meta">
                        <div class="title">${this._esc(e.title)}</div>
                        <div class="channel">${this._esc(e.channel)}</div>
                        <div class="date">${ago}</div>
                    </div>`;
                list.appendChild(a);
            }
        };
        renderList();
        search.addEventListener('input', () => renderList(search.value.toLowerCase()));

        panel.appendChild(header);
        panel.appendChild(search);
        panel.appendChild(list);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        search.focus();
    },

    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

    _timeAgo(date) {
        const s = Math.floor((Date.now() - date.getTime()) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s/60)}m ago`;
        if (s < 86400) return `${Math.floor(s/3600)}h ago`;
        if (s < 604800) return `${Math.floor(s/86400)}d ago`;
        return date.toLocaleDateString();
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-watch-history-css');
        // Record current video after page loads
        if (Page.isWatch()) {
            setTimeout(() => this._recordCurrent(), 3000);
        }
        // Show history button on feed pages
        if (Page.isFeed()) {
            this._injectHistoryPage();
        }
    },

    destroy() {
        this._styleEl?.remove();
        qs('.rx-history-overlay')?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Autoplay Block
// ═══════════════════════════════════════════
const AutoplayBlock = {
    id: 'autoplayBlock',
    name: 'Autoplay Block',
    _obs: null,

    _css: `
        .js-player-upcoming-button,
        .player-upcoming-overlay,
        [class*="upcoming-overlay"],
        [class*="autoplay-countdown"] { display: none !important; }
    `,

    _blockAutoplay() {
        // Remove upcoming/autoplay overlays
        for (const el of qsa('.js-player-upcoming-button, .player-upcoming-overlay, [class*="upcoming-overlay"], [class*="autoplay-countdown"]')) {
            el.remove();
        }
        // Pause any auto-started next video
        const video = qs('video');
        if (video && video.dataset.rxBlocked) return;
        // Intercept the autoplay trigger by watching for src changes
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-autoplay-block-css');

        // Observe for dynamically inserted autoplay elements
        this._obs = new MutationObserver(() => this._blockAutoplay());
        waitFor('#videoPlayer, .videoPlayer-Rumble-cls').then(el => {
            this._obs.observe(el, { childList: true, subtree: true });
        }).catch(() => {});

        // Also observe document for any autoplay popups
        this._docObs = new MutationObserver(() => this._blockAutoplay());
        this._docObs.observe(document.documentElement, { childList: true, subtree: true });

        // Initial pass
        setTimeout(() => this._blockAutoplay(), 2000);
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._docObs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Search History
// ═══════════════════════════════════════════
const SearchHistory = {
    id: 'searchHistory',
    name: 'Search History',
    _KEY: 'rx_search_history',
    _MAX: 100,
    _dropdown: null,
    _input: null,

    _css: `
        .rx-search-dropdown {
            position: absolute;
            top: 100%; left: 0; right: 0;
            background: #1e1e2e;
            border: 1px solid #45475a;
            border-top: none;
            border-radius: 0 0 8px 8px;
            z-index: 100001;
            max-height: 320px;
            overflow-y: auto;
            display: none;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .rx-search-dropdown.show { display: block; }
        .rx-search-dropdown-item {
            padding: 8px 14px;
            cursor: pointer;
            font-size: 13px;
            color: #cdd6f4;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #313244;
        }
        .rx-search-dropdown-item:hover { background: #313244; }
        .rx-search-dropdown-item svg { width: 14px; height: 14px; fill: #6c7086; flex-shrink: 0; }
        .rx-search-dropdown-item .text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rx-search-dropdown-item .remove {
            color: #6c7086; font-size: 16px; cursor: pointer; padding: 0 4px;
            opacity: 0; transition: opacity 0.15s;
        }
        .rx-search-dropdown-item:hover .remove { opacity: 1; }
        .rx-search-dropdown-item .remove:hover { color: #f38ba8; }
        .rx-search-dropdown-header {
            padding: 6px 14px; font-size: 11px; color: #6c7086;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #313244;
        }
        .rx-search-dropdown-header button {
            background: none; border: none; color: #f38ba8; cursor: pointer;
            font-size: 11px; padding: 0;
        }
        .rx-search-dropdown-header button:hover { text-decoration: underline; }
    `,

    _getHistory() {
        try { return JSON.parse(localStorage.getItem(this._KEY) || '[]'); }
        catch { return []; }
    },

    _saveHistory(entries) {
        localStorage.setItem(this._KEY, JSON.stringify(entries.slice(0, this._MAX)));
    },

    _recordSearch(query) {
        const q = query.trim();
        if (!q) return;
        const history = this._getHistory().filter(e => e !== q);
        history.unshift(q);
        this._saveHistory(history);
    },

    _showDropdown(filter = '') {
        if (!this._dropdown) return;
        const history = this._getHistory();
        const filtered = filter
            ? history.filter(q => q.toLowerCase().includes(filter.toLowerCase()))
            : history;

        this._dropdown.innerHTML = '';
        if (!filtered.length) {
            this._dropdown.classList.remove('show');
            return;
        }

        const header = document.createElement('div');
        header.className = 'rx-search-dropdown-header';
        header.innerHTML = '<span>Recent searches</span>';
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear all';
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            localStorage.removeItem(this._KEY);
            this._dropdown.classList.remove('show');
        });
        header.appendChild(clearBtn);
        this._dropdown.appendChild(header);

        for (const q of filtered.slice(0, 15)) {
            const item = document.createElement('div');
            item.className = 'rx-search-dropdown-item';
            item.innerHTML = `<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18z"/></svg>`;
            const text = document.createElement('span');
            text.className = 'text';
            text.textContent = q;
            const remove = document.createElement('span');
            remove.className = 'remove';
            remove.innerHTML = '&times;';
            remove.addEventListener('click', (e) => {
                e.stopPropagation();
                this._saveHistory(this._getHistory().filter(x => x !== q));
                item.remove();
                if (!this._dropdown.querySelector('.rx-search-dropdown-item')) {
                    this._dropdown.classList.remove('show');
                }
            });
            item.appendChild(text);
            item.appendChild(remove);
            item.addEventListener('click', () => {
                if (this._input) this._input.value = q;
                this._dropdown.classList.remove('show');
                // Submit the search
                const form = this._input?.closest('form');
                if (form) form.submit();
                else location.href = `/search/video?q=${encodeURIComponent(q)}`;
            });
            this._dropdown.appendChild(item);
        }
        this._dropdown.classList.add('show');
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-search-history-css');

        // Record searches from search page
        if (Page.isSearch()) {
            const params = new URLSearchParams(location.search);
            const q = params.get('q');
            if (q) this._recordSearch(q);
        }

        // Attach to search input
        waitFor('input[name="q"], input[type="search"], .search-input input, #search-input').then(input => {
            this._input = input;
            const wrapper = input.closest('form') || input.parentElement;
            if (!wrapper) return;
            wrapper.style.position = wrapper.style.position || 'relative';

            this._dropdown = document.createElement('div');
            this._dropdown.className = 'rx-search-dropdown';
            wrapper.appendChild(this._dropdown);

            input.addEventListener('focus', () => this._showDropdown(input.value));
            input.addEventListener('input', () => this._showDropdown(input.value));
            // Store the bound handler so destroy() can actually remove it.
            // Previously this was anonymous and leaked forever after the
            // feature was disabled, holding references to `wrapper` + `_dropdown`.
            this._outsideClickHandler = (e) => {
                if (this._dropdown && !wrapper.contains(e.target)) {
                    this._dropdown.classList.remove('show');
                }
            };
            document.addEventListener('click', this._outsideClickHandler);

            // Record on form submit
            const form = input.closest('form');
            if (form) {
                this._formSubmitHandler = () => this._recordSearch(input.value);
                form.addEventListener('submit', this._formSubmitHandler);
                this._boundForm = form;
            }
        }).catch(() => {});
    },

    destroy() {
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
            this._outsideClickHandler = null;
        }
        if (this._boundForm && this._formSubmitHandler) {
            this._boundForm.removeEventListener('submit', this._formSubmitHandler);
        }
        this._boundForm = null;
        this._formSubmitHandler = null;
        this._styleEl?.remove();
        this._dropdown?.remove();
        this._dropdown = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Mini Player
// ═══════════════════════════════════════════
const MiniPlayer = {
    id: 'miniPlayer',
    name: 'Mini Player',
    _mini: null,
    _obs: null,
    _active: false,
    _dragState: null,

    _css: `
        .rx-miniplayer {
            position: fixed;
            bottom: 24px; right: 24px;
            width: 400px; height: 225px;
            z-index: 9998;
            background: #11111b;
            border: 1px solid #45475a;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            display: none;
            cursor: move;
            transition: box-shadow 0.2s;
        }
        .rx-miniplayer:hover { box-shadow: 0 16px 48px rgba(0,0,0,0.8); }
        .rx-miniplayer.active { display: block; }
        .rx-miniplayer video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain;
        }
        .rx-miniplayer-bar {
            position: absolute; top: 0; left: 0; right: 0;
            display: flex; justify-content: space-between; align-items: center;
            padding: 6px 10px;
            background: linear-gradient(to bottom, rgba(17,17,27,0.85), transparent);
            opacity: 0; transition: opacity 0.2s;
            z-index: 2;
        }
        .rx-miniplayer:hover .rx-miniplayer-bar { opacity: 1; }
        .rx-miniplayer-title {
            color: #cdd6f4; font: 600 11px/1.3 system-ui, sans-serif;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            max-width: 300px;
        }
        .rx-miniplayer-close {
            background: rgba(243,139,168,0.2); border: none; color: #f38ba8;
            border-radius: 4px; cursor: pointer; font-size: 14px; padding: 2px 6px;
            line-height: 1;
        }
        .rx-miniplayer-close:hover { background: rgba(243,139,168,0.4); }
    `,

    _show(video) {
        if (this._active || !video) return;
        const clone = video.cloneNode(false);
        clone.muted = false;
        clone.currentTime = video.currentTime;
        clone.playbackRate = video.playbackRate;
        clone.autoplay = true;

        // Sync from original to clone
        this._syncFrom = video;
        this._syncClone = clone;
        const syncTime = () => {
            if (!this._active) return;
            if (Math.abs(video.currentTime - clone.currentTime) > 1) {
                clone.currentTime = video.currentTime;
            }
            requestAnimationFrame(syncTime);
        };

        const title = qs('.video-header-container__title, h1')?.textContent?.trim() || '';
        this._mini.innerHTML = '';
        const bar = document.createElement('div');
        bar.className = 'rx-miniplayer-bar';
        bar.innerHTML = `<span class="rx-miniplayer-title">${this._esc(title)}</span>`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'rx-miniplayer-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this._hide(); });
        bar.appendChild(closeBtn);

        this._mini.appendChild(bar);
        this._mini.appendChild(clone);
        this._mini.classList.add('active');
        this._active = true;

        // Pause original, play clone
        video.pause();
        clone.play().catch(() => {});
        syncTime();
    },

    _hide() {
        if (!this._active) return;
        this._active = false;
        this._mini.classList.remove('active');

        // Resume original video
        const video = qs('video');
        if (video && this._syncClone) {
            video.currentTime = this._syncClone.currentTime;
            video.play().catch(() => {});
        }
        this._mini.innerHTML = '';
        this._syncClone = null;
    },

    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

    _initDrag() {
        // Store bound handlers so destroy() can actually remove them.
        this._dragMousedown = (e) => {
            if (e.target.closest('.rx-miniplayer-close')) return;
            this._dragState = {
                x: e.clientX - this._mini.offsetLeft,
                y: e.clientY - this._mini.offsetTop,
            };
            e.preventDefault();
        };
        this._dragMousemove = (e) => {
            if (!this._dragState || !this._mini) return;
            const x = Math.max(0, Math.min(window.innerWidth - this._mini.offsetWidth, e.clientX - this._dragState.x));
            const y = Math.max(0, Math.min(window.innerHeight - this._mini.offsetHeight, e.clientY - this._dragState.y));
            this._mini.style.left = x + 'px';
            this._mini.style.top = y + 'px';
            this._mini.style.right = 'auto';
            this._mini.style.bottom = 'auto';
        };
        this._dragMouseup = () => { this._dragState = null; };
        this._mini.addEventListener('mousedown', this._dragMousedown);
        document.addEventListener('mousemove', this._dragMousemove);
        document.addEventListener('mouseup', this._dragMouseup);
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-miniplayer-css');

        this._mini = document.createElement('div');
        this._mini.className = 'rx-miniplayer';
        document.body.appendChild(this._mini);
        this._initDrag();

        // Watch for video scrolling out of viewport
        waitFor('#videoPlayer, .videoPlayer-Rumble-cls, video').then(playerEl => {
            // Don't observe if TheaterSplit is active — player is always fullscreen
            if (TheaterSplit._isActive) return;
            this._obs = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (TheaterSplit._isActive) return;
                    if (!entry.isIntersecting) {
                        const video = qs('video');
                        if (video && !video.paused && !video.ended) {
                            this._show(video);
                        }
                    } else {
                        this._hide();
                    }
                }
            }, { threshold: 0.3 });
            this._obs.observe(playerEl);
        }).catch(() => {});
    },

    destroy() {
        this._hide();
        if (this._dragMousemove) document.removeEventListener('mousemove', this._dragMousemove);
        if (this._dragMouseup) document.removeEventListener('mouseup', this._dragMouseup);
        this._dragMousemove = this._dragMouseup = this._dragMousedown = null;
        this._dragState = null;
        this._styleEl?.remove();
        this._mini?.remove();
        this._mini = null;
        this._obs?.disconnect();
        this._obs = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Video Stats
// ═══════════════════════════════════════════
const VideoStats = {
    id: 'videoStats',
    name: 'Video Stats',
    _overlay: null,
    _interval: null,
    _visible: false,

    _css: `
        .rx-stats-btn {
            position: absolute;
            top: 10px; right: 10px;
            z-index: 100;
            background: rgba(17,17,27,0.75);
            border: 1px solid rgba(205,214,244,0.2);
            color: #cdd6f4;
            border-radius: 6px;
            padding: 6px 10px;
            cursor: pointer;
            font: 700 11px/1 system-ui, sans-serif;
            opacity: 0; transition: opacity 0.2s;
            pointer-events: auto;
        }
        .videoPlayer-Rumble-cls:hover .rx-stats-btn,
        #videoPlayer:hover .rx-stats-btn { opacity: 1; }
        .rx-stats-btn:hover { background: rgba(17,17,27,0.9); border-color: #89b4fa; }
        .rx-stats-overlay {
            position: absolute;
            top: 44px; right: 10px;
            z-index: 100;
            background: rgba(17,17,27,0.88);
            border: 1px solid #45475a;
            border-radius: 8px;
            padding: 12px 16px;
            color: #cdd6f4;
            font: 11px/1.6 'Courier New', monospace;
            pointer-events: none;
            min-width: 260px;
            display: none;
        }
        .rx-stats-overlay.show { display: block; }
        .rx-stats-overlay .label { color: #89b4fa; }
        .rx-stats-overlay .val { color: #a6e3a1; }
        .rx-stats-overlay .warn { color: #f9e2af; }
        .rx-stats-overlay .bad { color: #f38ba8; }
    `,

    _formatBytes(b) {
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1048576).toFixed(2) + ' MB';
    },

    _update() {
        const video = qs('video');
        if (!video || !this._overlay) return;

        const w = video.videoWidth || 0;
        const h = video.videoHeight || 0;
        const res = w && h ? `${w}x${h}` : 'N/A';
        const dur = video.duration ? video.duration.toFixed(1) + 's' : 'N/A';
        const cur = video.currentTime.toFixed(1) + 's';
        const vol = Math.round(video.volume * 100) + '%';
        const rate = video.playbackRate + 'x';
        const paused = video.paused ? 'Yes' : 'No';
        const loop = video.loop ? 'Yes' : 'No';
        const net = ['EMPTY', 'IDLE', 'LOADING', 'LOADED'][video.networkState] || video.networkState;
        const ready = ['NOTHING', 'METADATA', 'CURRENT', 'FUTURE', 'ENOUGH'][video.readyState] || video.readyState;

        // Buffer info
        let buffered = '0s';
        if (video.buffered.length > 0) {
            const end = video.buffered.end(video.buffered.length - 1);
            buffered = (end - video.currentTime).toFixed(1) + 's ahead';
        }

        // Dropped frames (Chrome only)
        const quality = video.getVideoPlaybackQuality?.();
        let frames = 'N/A';
        let frameClass = 'val';
        if (quality) {
            const dropped = quality.droppedVideoFrames;
            const total = quality.totalVideoFrames;
            frames = `${dropped}/${total}`;
            if (dropped > total * 0.05) frameClass = 'bad';
            else if (dropped > 0) frameClass = 'warn';
        }

        // Current src
        const src = video.currentSrc || video.src || 'N/A';
        const srcShort = src.length > 50 ? '...' + src.slice(-47) : src;

        this._overlay.innerHTML = `
            <span class="label">Resolution:</span> <span class="val">${res}</span><br>
            <span class="label">Duration:</span> <span class="val">${dur}</span> | <span class="label">Position:</span> <span class="val">${cur}</span><br>
            <span class="label">Speed:</span> <span class="val">${rate}</span> | <span class="label">Volume:</span> <span class="val">${vol}</span><br>
            <span class="label">Paused:</span> <span class="val">${paused}</span> | <span class="label">Loop:</span> <span class="val">${loop}</span><br>
            <span class="label">Network:</span> <span class="val">${net}</span> | <span class="label">Ready:</span> <span class="val">${ready}</span><br>
            <span class="label">Buffer:</span> <span class="val">${buffered}</span><br>
            <span class="label">Frames (drop/total):</span> <span class="${frameClass}">${frames}</span><br>
            <span class="label">Source:</span> <span class="val" style="font-size:9px">${this._esc(srcShort)}</span>
        `;
    },

    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

    _toggle() {
        this._visible = !this._visible;
        if (this._visible) {
            this._overlay.classList.add('show');
            this._interval = setInterval(() => this._update(), 500);
            this._update();
        } else {
            this._overlay.classList.remove('show');
            clearInterval(this._interval);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch() && !Page.isEmbed()) return;
        this._styleEl = injectStyle(this._css, 'rx-stats-css');

        waitFor('#videoPlayer, .videoPlayer-Rumble-cls').then(container => {
            container.style.position = container.style.position || 'relative';

            const btn = document.createElement('button');
            btn.className = 'rx-stats-btn';
            btn.textContent = 'Stats';
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._toggle(); });
            container.appendChild(btn);
            this._btn = btn;

            this._overlay = document.createElement('div');
            this._overlay.className = 'rx-stats-overlay';
            container.appendChild(this._overlay);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
        this._overlay?.remove();
        clearInterval(this._interval);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Loop Control
// ═══════════════════════════════════════════
const LoopControl = {
    id: 'loopControl',
    name: 'Loop Control',
    _btn: null,
    _abBar: null,
    _loopA: null,
    _loopB: null,
    _looping: false,
    _fullLoop: false,
    _checkInterval: null,

    _css: `
        .rx-loop-btn {
            position: absolute;
            bottom: 52px; right: 10px;
            z-index: 100;
            background: rgba(17,17,27,0.75);
            border: 1px solid rgba(205,214,244,0.2);
            color: #cdd6f4;
            border-radius: 6px;
            padding: 5px 10px;
            cursor: pointer;
            font: 700 11px/1 system-ui, sans-serif;
            opacity: 0; transition: opacity 0.2s;
            pointer-events: auto;
            display: flex; align-items: center; gap: 6px;
        }
        .videoPlayer-Rumble-cls:hover .rx-loop-btn,
        #videoPlayer:hover .rx-loop-btn { opacity: 1; }
        .rx-loop-btn:hover { background: rgba(17,17,27,0.9); border-color: #89b4fa; }
        .rx-loop-btn.active { border-color: #a6e3a1; color: #a6e3a1; }
        .rx-loop-btn svg { width: 14px; height: 14px; fill: currentColor; }
        .rx-loop-ab-bar {
            position: absolute;
            bottom: 78px; right: 10px;
            z-index: 100;
            background: rgba(17,17,27,0.85);
            border: 1px solid #45475a;
            border-radius: 6px;
            padding: 6px 10px;
            display: none;
            gap: 6px; align-items: center;
            font: 600 11px/1 system-ui, sans-serif;
            color: #cdd6f4;
        }
        .rx-loop-ab-bar.show { display: flex; }
        .rx-loop-ab-bar button {
            background: #313244; border: 1px solid #45475a; color: #cdd6f4;
            border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 11px;
        }
        .rx-loop-ab-bar button:hover { border-color: #89b4fa; }
        .rx-loop-ab-bar button.set { border-color: #a6e3a1; color: #a6e3a1; }
        .rx-loop-ab-bar .info { color: #6c7086; font-size: 10px; }
    `,

    _formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    },

    _toggleLoop() {
        const video = qs('video');
        if (!video) return;

        if (this._looping) {
            // Clear AB loop
            this._loopA = null;
            this._loopB = null;
            this._looping = false;
            clearInterval(this._checkInterval);
            this._abBar?.classList.remove('show');
            this._btn.classList.remove('active');
            this._btn.classList.add('active');
            // Switch to full loop
            this._fullLoop = !this._fullLoop;
            video.loop = this._fullLoop;
            if (!this._fullLoop) this._btn.classList.remove('active');
            return;
        }

        if (this._fullLoop) {
            // Turn off full loop
            this._fullLoop = false;
            video.loop = false;
            this._btn.classList.remove('active');
            return;
        }

        // Start full loop
        this._fullLoop = true;
        video.loop = true;
        this._btn.classList.add('active');
    },

    _startABMode() {
        this._abBar?.classList.add('show');
    },

    _setA() {
        const video = qs('video');
        if (!video) return;
        this._loopA = video.currentTime;
        this._updateABBar();
        if (this._loopA !== null && this._loopB !== null) this._activateAB();
    },

    _setB() {
        const video = qs('video');
        if (!video) return;
        this._loopB = video.currentTime;
        this._updateABBar();
        if (this._loopA !== null && this._loopB !== null) this._activateAB();
    },

    _activateAB() {
        if (this._loopA >= this._loopB) {
            [this._loopA, this._loopB] = [this._loopB, this._loopA];
        }
        this._looping = true;
        this._fullLoop = false;
        const video = qs('video');
        if (video) video.loop = false;
        this._btn.classList.add('active');

        clearInterval(this._checkInterval);
        this._checkInterval = setInterval(() => {
            const v = qs('video');
            if (!v || !this._looping) return;
            if (v.currentTime >= this._loopB || v.currentTime < this._loopA) {
                v.currentTime = this._loopA;
            }
        }, 100);
        this._updateABBar();
    },

    _clearAB() {
        this._loopA = null;
        this._loopB = null;
        this._looping = false;
        clearInterval(this._checkInterval);
        this._abBar?.classList.remove('show');
        this._btn.classList.remove('active');
    },

    _updateABBar() {
        if (!this._abBar) return;
        const aBtn = this._abBar.querySelector('.rx-ab-a');
        const bBtn = this._abBar.querySelector('.rx-ab-b');
        const info = this._abBar.querySelector('.info');
        if (aBtn) aBtn.classList.toggle('set', this._loopA !== null);
        if (bBtn) bBtn.classList.toggle('set', this._loopB !== null);
        if (info) {
            const a = this._loopA !== null ? this._formatTime(this._loopA) : '--:--';
            const b = this._loopB !== null ? this._formatTime(this._loopB) : '--:--';
            info.textContent = `${a} - ${b}`;
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch() && !Page.isEmbed()) return;
        this._styleEl = injectStyle(this._css, 'rx-loop-css');

        waitFor('#videoPlayer, .videoPlayer-Rumble-cls').then(container => {
            container.style.position = container.style.position || 'relative';

            // Main loop button
            const btn = document.createElement('button');
            btn.className = 'rx-loop-btn';
            btn.title = 'Click: toggle loop | Right-click: A-B loop';
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>Loop`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._toggleLoop(); });
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault(); e.stopPropagation();
                this._startABMode();
            });
            container.appendChild(btn);
            this._btn = btn;

            // AB loop bar
            const abBar = document.createElement('div');
            abBar.className = 'rx-loop-ab-bar';
            const aBtn = document.createElement('button');
            aBtn.className = 'rx-ab-a';
            aBtn.textContent = 'Set A';
            aBtn.addEventListener('click', (e) => { e.stopPropagation(); this._setA(); });
            const bBtn = document.createElement('button');
            bBtn.className = 'rx-ab-b';
            bBtn.textContent = 'Set B';
            bBtn.addEventListener('click', (e) => { e.stopPropagation(); this._setB(); });
            const info = document.createElement('span');
            info.className = 'info';
            info.textContent = '--:-- - --:--';
            const clearBtn = document.createElement('button');
            clearBtn.textContent = 'Clear';
            clearBtn.addEventListener('click', (e) => { e.stopPropagation(); this._clearAB(); });

            abBar.appendChild(aBtn);
            abBar.appendChild(bBtn);
            abBar.appendChild(info);
            abBar.appendChild(clearBtn);
            container.appendChild(abBar);
            this._abBar = abBar;
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
        this._abBar?.remove();
        clearInterval(this._checkInterval);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Cinema Mode
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  FEATURE: Quick Bookmark
// ═══════════════════════════════════════════
const QuickBookmark = {
    id: 'quickBookmark',
    name: 'Quick Bookmark',
    _KEY: 'rx_bookmarks',
    _MAX: 200,
    _btn: null,

    _css: `
        .rx-bookmark-btn {
            display: inline-flex; align-items: center; gap: 4px;
            background: #313244; border: 1px solid #45475a;
            color: #cdd6f4; border-radius: 6px;
            padding: 5px 12px; cursor: pointer;
            font: 600 12px/1.4 system-ui, sans-serif;
            transition: all 0.2s;
            margin-left: 8px;
        }
        .rx-bookmark-btn:hover { border-color: #89b4fa; background: #45475a; }
        .rx-bookmark-btn.saved { border-color: #f9e2af; color: #f9e2af; }
        .rx-bookmark-btn svg { width: 14px; height: 14px; fill: currentColor; }
        .rx-bookmarks-overlay {
            position: fixed; inset: 0; z-index: 100000;
            background: rgba(0,0,0,0.7); display: flex;
            justify-content: center; align-items: flex-start;
            padding: 40px 20px; overflow-y: auto;
        }
        .rx-bookmarks-panel {
            background: #1e1e2e; border: 1px solid #45475a;
            border-radius: 12px; max-width: 800px; width: 100%;
            padding: 24px; color: #cdd6f4;
            font-family: system-ui, sans-serif;
            max-height: calc(100vh - 80px); overflow-y: auto;
        }
        .rx-bookmarks-panel h2 { margin: 0 0 16px; font-size: 20px; color: #f9e2af; }
        .rx-bookmarks-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .rx-bookmarks-close { background: none; border: none; color: #6c7086; font-size: 24px; cursor: pointer; }
        .rx-bookmarks-close:hover { color: #cdd6f4; }
        .rx-bookmark-item {
            display: flex; gap: 12px; padding: 10px;
            border-radius: 8px; transition: background 0.15s;
            border-bottom: 1px solid #313244;
            align-items: center;
        }
        .rx-bookmark-item:hover { background: #313244; }
        .rx-bookmark-item img { width: 140px; height: 79px; object-fit: cover; border-radius: 6px; background: #313244; flex-shrink: 0; }
        .rx-bookmark-item .meta { flex: 1; min-width: 0; }
        .rx-bookmark-item .meta a {
            font-weight: 600; font-size: 14px; color: #cdd6f4;
            text-decoration: none; display: block;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .rx-bookmark-item .meta a:hover { color: #89b4fa; }
        .rx-bookmark-item .meta .channel { color: #a6adc8; font-size: 12px; margin-top: 2px; }
        .rx-bookmark-item .meta .date { color: #6c7086; font-size: 11px; margin-top: 2px; }
        .rx-bookmark-item .remove-bm {
            background: none; border: none; color: #6c7086; font-size: 18px;
            cursor: pointer; padding: 4px 8px; flex-shrink: 0;
        }
        .rx-bookmark-item .remove-bm:hover { color: #f38ba8; }
        .rx-bookmarks-empty { text-align: center; color: #6c7086; padding: 40px 0; }
        .rx-bookmarks-viewall {
            background: #313244; color: #cdd6f4; border: 1px solid #45475a;
            border-radius: 6px; padding: 5px 12px; cursor: pointer;
            font: 600 12px/1.4 system-ui, sans-serif;
        }
        .rx-bookmarks-viewall:hover { border-color: #f9e2af; }
    `,

    _getBookmarks() {
        try { return JSON.parse(localStorage.getItem(this._KEY) || '[]'); }
        catch { return []; }
    },

    _saveBookmarks(bm) {
        localStorage.setItem(this._KEY, JSON.stringify(bm.slice(0, this._MAX)));
    },

    _isBookmarked(url) {
        return this._getBookmarks().some(b => b.url === url);
    },

    _toggleBookmark() {
        const url = location.href;
        let bookmarks = this._getBookmarks();
        if (this._isBookmarked(url)) {
            bookmarks = bookmarks.filter(b => b.url !== url);
            this._saveBookmarks(bookmarks);
            this._btn?.classList.remove('saved');
        } else {
            const title = qs('.video-header-container__title, h1')?.textContent?.trim() || document.title;
            const channel = qs('.media-heading-name, .media-by--a')?.textContent?.trim() || '';
            const thumb = qs('meta[property="og:image"]')?.content || '';
            bookmarks.unshift({ url, title, channel, thumb, time: Date.now() });
            this._saveBookmarks(bookmarks);
            this._btn?.classList.add('saved');
        }
    },

    _esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

    _timeAgo(date) {
        const s = Math.floor((Date.now() - date) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s/60)}m ago`;
        if (s < 86400) return `${Math.floor(s/3600)}h ago`;
        if (s < 604800) return `${Math.floor(s/86400)}d ago`;
        return new Date(date).toLocaleDateString();
    },

    _showOverlay() {
        if (qs('.rx-bookmarks-overlay')) return;
        const bookmarks = this._getBookmarks();
        const overlay = document.createElement('div');
        overlay.className = 'rx-bookmarks-overlay';
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        const panel = document.createElement('div');
        panel.className = 'rx-bookmarks-panel';

        const header = document.createElement('div');
        header.className = 'rx-bookmarks-header';
        header.innerHTML = `<h2>Bookmarks (${bookmarks.length})</h2>`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'rx-bookmarks-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => overlay.remove());
        header.appendChild(closeBtn);
        panel.appendChild(header);

        if (!bookmarks.length) {
            panel.innerHTML += '<div class="rx-bookmarks-empty">No bookmarks yet. Click the bookmark icon on any video to save it.</div>';
        } else {
            for (const bm of bookmarks) {
                const item = document.createElement('div');
                item.className = 'rx-bookmark-item';
                item.innerHTML = `
                    ${bm.thumb ? `<img src="${this._esc(bm.thumb)}" loading="lazy" alt="">` : ''}
                    <div class="meta">
                        <a href="${this._esc(bm.url)}">${this._esc(bm.title)}</a>
                        <div class="channel">${this._esc(bm.channel)}</div>
                        <div class="date">${this._timeAgo(bm.time)}</div>
                    </div>`;
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-bm';
                removeBtn.innerHTML = '&times;';
                removeBtn.addEventListener('click', () => {
                    const updated = this._getBookmarks().filter(b => b.url !== bm.url);
                    this._saveBookmarks(updated);
                    item.remove();
                    if (bm.url === location.href) this._btn?.classList.remove('saved');
                    header.querySelector('h2').textContent = `Bookmarks (${updated.length})`;
                    if (!updated.length) {
                        panel.querySelector('.rx-bookmark-item')?.remove();
                        panel.innerHTML += '<div class="rx-bookmarks-empty">No bookmarks.</div>';
                    }
                });
                item.appendChild(removeBtn);
                panel.appendChild(item);
            }
        }

        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-bookmark-css');

        // Add bookmark button on watch pages
        if (Page.isWatch()) {
            waitFor('.video-header-container, .media-description, .media-heading').then(container => {
                const btn = document.createElement('button');
                btn.className = 'rx-bookmark-btn';
                if (this._isBookmarked(location.href)) btn.classList.add('saved');
                btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg><span>Bookmark</span>`;
                btn.addEventListener('click', () => this._toggleBookmark());
                container.appendChild(btn);
                this._btn = btn;
            }).catch(() => {});
        }

        // Add "View Bookmarks" button on feed pages
        if (Page.isFeed()) {
            waitFor('.main-and-sidebar, .constrained-container, .subscriptions-header, .homepage-container').then(container => {
                const btn = document.createElement('button');
                btn.className = 'rx-bookmarks-viewall';
                btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor;vertical-align:-2px;margin-right:4px"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>Bookmarks`;
                btn.addEventListener('click', () => this._showOverlay());
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'padding:8px 16px; display: inline-block;';
                wrapper.appendChild(btn);
                container.parentNode?.insertBefore(wrapper, container);
            }).catch(() => {});
        }
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
        qs('.rx-bookmarks-overlay')?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Comment Navigator
// ═══════════════════════════════════════════
const CommentNav = {
    id: 'commentNav',
    name: 'Comment Nav',
    _bar: null,
    _idx: -1,
    _items: [],

    _css: `
        .rx-comment-nav {
            position: sticky; top: 0; z-index: 100;
            background: #1e1e2e; border: 1px solid #45475a;
            border-radius: 8px; padding: 6px 10px;
            display: flex; align-items: center; gap: 8px;
            margin-bottom: 12px;
            font: 600 12px/1.4 system-ui, sans-serif;
            color: #cdd6f4;
        }
        .rx-comment-nav button {
            background: #313244; border: 1px solid #45475a; color: #cdd6f4;
            border-radius: 4px; padding: 3px 10px; cursor: pointer; font-size: 11px;
            transition: border-color 0.15s;
        }
        .rx-comment-nav button:hover { border-color: #89b4fa; }
        .rx-comment-nav button.active { border-color: #a6e3a1; color: #a6e3a1; }
        .rx-comment-nav .count { color: #6c7086; font-size: 11px; margin-left: auto; }
        .rx-comment-highlight { outline: 2px solid #89b4fa; outline-offset: 2px; border-radius: 4px; }
    `,

    _refresh() {
        this._items = [...qsa('li.comment-item[data-comment-id]')];
        const countEl = this._bar?.querySelector('.count');
        if (countEl) countEl.textContent = `${this._items.length} comments`;
    },

    _goto(idx) {
        if (!this._items.length) return;
        // Remove previous highlight
        this._items[this._idx]?.classList.remove('rx-comment-highlight');
        // Clamp
        this._idx = Math.max(0, Math.min(idx, this._items.length - 1));
        const el = this._items[this._idx];
        el.classList.add('rx-comment-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    _next() { this._refresh(); this._goto(this._idx + 1); },
    _prev() { this._refresh(); this._goto(this._idx - 1); },

    _collapseAll() {
        for (const btn of qsa('button.comment-toggle-replies')) {
            const action = btn.querySelector('.comment-toggle-replies-action');
            if (action && action.textContent.includes('Hide')) btn.click();
        }
    },

    _expandAll() {
        for (const btn of qsa('button.comment-toggle-replies')) {
            const action = btn.querySelector('.comment-toggle-replies-action');
            if (action && action.textContent.includes('Show')) btn.click();
        }
    },

    _filterOP() {
        const opOnly = this._bar?.querySelector('.rx-op-filter')?.classList.toggle('active');
        for (const item of qsa('li.comment-item[data-comment-id]')) {
            const isOP = !!item.querySelector('.comments-meta-author-video-owner');
            if (opOnly && !isOP) {
                item.style.display = 'none';
            } else {
                item.style.display = '';
            }
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-comment-nav-css');

        waitFor('#video-comments, .media-page-comments-container').then(container => {
            const bar = document.createElement('div');
            bar.className = 'rx-comment-nav';

            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Prev';
            prevBtn.addEventListener('click', () => this._prev());

            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next';
            nextBtn.addEventListener('click', () => this._next());

            const expandBtn = document.createElement('button');
            expandBtn.textContent = 'Expand All';
            expandBtn.addEventListener('click', () => this._expandAll());

            const collapseBtn = document.createElement('button');
            collapseBtn.textContent = 'Collapse All';
            collapseBtn.addEventListener('click', () => this._collapseAll());

            const opBtn = document.createElement('button');
            opBtn.textContent = 'OP Only';
            opBtn.className = 'rx-op-filter';
            opBtn.addEventListener('click', () => this._filterOP());

            const count = document.createElement('span');
            count.className = 'count';

            bar.appendChild(prevBtn);
            bar.appendChild(nextBtn);
            bar.appendChild(expandBtn);
            bar.appendChild(collapseBtn);
            bar.appendChild(opBtn);
            bar.appendChild(count);

            container.insertBefore(bar, container.firstChild);
            this._bar = bar;
            setTimeout(() => this._refresh(), 2000);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._bar?.remove();
        for (const el of qsa('.rx-comment-highlight')) el.classList.remove('rx-comment-highlight');
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Rant Highlight
// ═══════════════════════════════════════════
const RantHighlight = {
    id: 'rantHighlight',
    name: 'Rant Highlight',
    _tracker: null,
    _obs: null,
    _total: 0,

    _css: `
        .rx-rant-tracker {
            position: sticky; top: 0; z-index: 101;
            background: linear-gradient(135deg, #1e1e2e 0%, #2a1f3d 100%);
            border: 1px solid #45475a;
            border-radius: 8px; padding: 8px 14px;
            display: flex; align-items: center; gap: 12px;
            font: 600 12px/1.4 system-ui, sans-serif;
            color: #cdd6f4; margin-bottom: 8px;
        }
        .rx-rant-tracker .label { color: #f9e2af; }
        .rx-rant-tracker .total { color: #a6e3a1; font-size: 16px; font-weight: 700; }
        .rx-rant-tracker .rant-count { color: #6c7086; }

        /* Enhance rant visibility by tier */
        .chat-history--rant[data-level="1"] { box-shadow: 0 0 8px rgba(166,227,161,0.2); }
        .chat-history--rant[data-level="2"] { box-shadow: 0 0 12px rgba(137,180,250,0.3); }
        .chat-history--rant[data-level="3"] { box-shadow: 0 0 12px rgba(249,226,175,0.3); }
        .chat-history--rant[data-level="4"] { box-shadow: 0 0 16px rgba(249,226,175,0.4); }
        .chat-history--rant[data-level="5"] { box-shadow: 0 0 20px rgba(243,139,168,0.4); }
        .chat-history--rant[data-level="6"],
        .chat-history--rant[data-level="7"],
        .chat-history--rant[data-level="8"],
        .chat-history--rant[data-level="9"],
        .chat-history--rant[data-level="10"] {
            box-shadow: 0 0 24px rgba(243,139,168,0.5);
            animation: rx-rant-glow 2s ease-in-out infinite alternate;
        }
        @keyframes rx-rant-glow {
            from { box-shadow: 0 0 20px rgba(243,139,168,0.4); }
            to { box-shadow: 0 0 30px rgba(243,139,168,0.7); }
        }
    `,

    _parsePrice(text) {
        const m = text.match(/\$(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
    },

    _scan() {
        let total = 0;
        let count = 0;
        for (const rant of qsa('.chat-history--rant')) {
            const priceEl = rant.querySelector('.chat-history--rant-price');
            if (priceEl) {
                total += this._parsePrice(priceEl.textContent);
                count++;
            }
        }
        this._total = total;
        if (this._tracker) {
            this._tracker.querySelector('.total').textContent = `$${total}`;
            this._tracker.querySelector('.rant-count').textContent = `${count} rants`;
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-rant-highlight-css');

        // Use waitFor instead of Page.isLive() — chat loads async, isLive() may be false at init time
        waitFor('#chat-history-list, .chat-history').then(chatEl => {
            // Insert tracker above chat
            const tracker = document.createElement('div');
            tracker.className = 'rx-rant-tracker';
            tracker.innerHTML = `<span class="label">Rant Total:</span><span class="total">$0</span><span class="rant-count">0 rants</span>`;
            chatEl.parentNode?.insertBefore(tracker, chatEl);
            this._tracker = tracker;

            // Observe for new rants
            this._obs = new MutationObserver(() => this._scan());
            this._obs.observe(chatEl, { childList: true, subtree: true });
            this._scan();
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._tracker?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Related Filter
// ═══════════════════════════════════════════
const RelatedFilter = {
    id: 'relatedFilter',
    name: 'Related Filter',
    _bar: null,

    _css: `
        .rx-related-filter {
            padding: 8px 0;
            display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
        }
        .rx-related-search {
            flex: 1; min-width: 120px;
            padding: 5px 10px; border-radius: 6px;
            border: 1px solid #45475a; background: #313244;
            color: #cdd6f4; font-size: 12px; outline: none;
        }
        .rx-related-search:focus { border-color: #89b4fa; }
        .rx-related-filter button {
            background: #313244; border: 1px solid #45475a; color: #cdd6f4;
            border-radius: 4px; padding: 3px 8px; cursor: pointer;
            font-size: 11px; white-space: nowrap;
            transition: border-color 0.15s;
        }
        .rx-related-filter button:hover { border-color: #89b4fa; }
        .rx-related-filter button.active { border-color: #a6e3a1; color: #a6e3a1; }
        .rx-related-hidden { display: none !important; }
    `,

    _filter(query, hideWatched) {
        const q = query.toLowerCase();
        for (const item of qsa('.mediaList-item')) {
            const title = item.querySelector('.mediaList-heading')?.textContent?.toLowerCase() || '';
            const channel = item.querySelector('.mediaList-by-heading')?.textContent?.toLowerCase() || '';
            const matchQuery = !q || title.includes(q) || channel.includes(q);

            // Check if watched (has progress bar or in localStorage watch history)
            let isWatched = false;
            if (hideWatched) {
                const link = item.querySelector('.mediaList-link');
                const href = link?.getAttribute('href') || '';
                const key = `rx_progress_${href}`;
                isWatched = !!localStorage.getItem(key);
            }

            if (matchQuery && (!hideWatched || !isWatched)) {
                item.classList.remove('rx-related-hidden');
            } else {
                item.classList.add('rx-related-hidden');
            }
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-related-filter-css');

        waitFor('.mediaList-list, .media-page-related-media-desktop-sidebar').then(sidebar => {
            const bar = document.createElement('div');
            bar.className = 'rx-related-filter';

            const search = document.createElement('input');
            search.className = 'rx-related-search';
            search.placeholder = 'Filter related...';
            search.type = 'text';

            const hideWatchedBtn = document.createElement('button');
            hideWatchedBtn.textContent = 'Hide Watched';
            let hideWatched = false;

            search.addEventListener('input', () => this._filter(search.value, hideWatched));
            hideWatchedBtn.addEventListener('click', () => {
                hideWatched = !hideWatched;
                hideWatchedBtn.classList.toggle('active', hideWatched);
                this._filter(search.value, hideWatched);
            });

            bar.appendChild(search);
            bar.appendChild(hideWatchedBtn);

            // Insert before the list
            const list = sidebar.querySelector('.mediaList-list') || sidebar;
            list.parentNode?.insertBefore(bar, list);
            this._bar = bar;
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._bar?.remove();
        for (const el of qsa('.rx-related-hidden')) el.classList.remove('rx-related-hidden');
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Exact Counts
// ═══════════════════════════════════════════
const ExactCounts = {
    id: 'exactCounts',
    name: 'Exact Counts',
    _obs: null,

    _css: `
        .rx-exact-count { font-variant-numeric: tabular-nums; }
    `,

    _formatNumber(n) {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    _processCards() {
        // Feed cards: use data-views attribute for exact count
        for (const viewEl of qsa('.videostream__views[data-views]')) {
            if (viewEl.dataset.rxExact) continue;
            const exact = parseInt(viewEl.dataset.views, 10);
            if (!isNaN(exact)) {
                const countSpan = viewEl.querySelector('.videostream__views--count');
                if (countSpan) {
                    countSpan.textContent = '\u00a0' + this._formatNumber(exact) + '\u00a0';
                    countSpan.classList.add('rx-exact-count');
                    viewEl.dataset.rxExact = '1';
                }
            }
        }

        // Also expand title tooltips that have exact counts
        for (const viewEl of qsa('.videostream__views[title]')) {
            if (viewEl.dataset.rxExact) continue;
            const title = viewEl.getAttribute('title');
            const m = title?.match(/^([\d,]+)$/);
            if (m) {
                const countSpan = viewEl.querySelector('.videostream__views--count');
                if (countSpan) {
                    countSpan.textContent = '\u00a0' + m[1] + '\u00a0';
                    countSpan.classList.add('rx-exact-count');
                    viewEl.dataset.rxExact = '1';
                }
            }
        }

        // Related sidebar: expand titles on mediaList items
        for (const item of qsa('.mediaList-rumbles[title], .mediaList-plays[title]')) {
            if (item.dataset.rxExact) continue;
            const title = item.getAttribute('title');
            if (title && /\d/.test(title)) {
                item.textContent = title;
                item.classList.add('rx-exact-count');
                item.dataset.rxExact = '1';
            }
        }

        // Video page: expand vote counts
        const upVotes = qs('[data-js="rumbles_up_votes"]');
        const downVotes = qs('[data-js="rumbles_down_votes"]');
        if (upVotes?.title && !upVotes.dataset.rxExact) {
            upVotes.textContent = upVotes.title;
            upVotes.dataset.rxExact = '1';
        }
        if (downVotes?.title && !downVotes.dataset.rxExact) {
            downVotes.textContent = downVotes.title;
            downVotes.dataset.rxExact = '1';
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-exact-counts-css');

        // Process on load and watch for dynamic content
        setTimeout(() => this._processCards(), 1500);
        this._obs = new MutationObserver(() => this._processCards());
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Share Timestamp
// ═══════════════════════════════════════════
const ShareTimestamp = {
    id: 'shareTimestamp',
    name: 'Share Timestamp',
    _btn: null,
    _toast: null,

    _css: `
        .rx-share-ts-btn {
            position: absolute;
            bottom: 52px; right: 80px;
            z-index: 100;
            background: rgba(17,17,27,0.75);
            border: 1px solid rgba(205,214,244,0.2);
            color: #cdd6f4;
            border-radius: 6px;
            padding: 5px 10px;
            cursor: pointer;
            font: 700 11px/1 system-ui, sans-serif;
            opacity: 0; transition: opacity 0.2s;
            pointer-events: auto;
            display: flex; align-items: center; gap: 5px;
        }
        .videoPlayer-Rumble-cls:hover .rx-share-ts-btn,
        #videoPlayer:hover .rx-share-ts-btn { opacity: 1; }
        .rx-share-ts-btn:hover { background: rgba(17,17,27,0.9); border-color: #89b4fa; }
        .rx-share-ts-btn svg { width: 14px; height: 14px; fill: currentColor; }
        .rx-share-toast {
            position: fixed; bottom: 80px; left: 50%;
            transform: translateX(-50%);
            background: #313244; color: #a6e3a1;
            border: 1px solid #a6e3a1;
            border-radius: 8px; padding: 8px 18px;
            font: 600 13px/1.4 system-ui, sans-serif;
            z-index: 100001;
            opacity: 0; transition: opacity 0.3s;
            pointer-events: none;
        }
        .rx-share-toast.show { opacity: 1; }
    `,

    _formatTime(s) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        if (h > 0) return `${h}h${m}m${sec}s`;
        if (m > 0) return `${m}m${sec}s`;
        return `${sec}s`;
    },

    _copyURL() {
        const video = qs('video');
        if (!video) return;
        const time = Math.floor(video.currentTime);
        const url = new URL(location.href);
        url.searchParams.set('start', time);
        // Clean hash
        url.hash = '';

        navigator.clipboard.writeText(url.toString()).then(() => {
            this._showToast(`Copied URL at ${this._formatTime(time)}`);
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = url.toString();
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            this._showToast(`Copied URL at ${this._formatTime(time)}`);
        });
    },

    _showToast(msg) {
        if (!this._toast) {
            this._toast = document.createElement('div');
            this._toast.className = 'rx-share-toast';
            document.body.appendChild(this._toast);
        }
        this._toast.textContent = msg;
        this._toast.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this._toast.classList.remove('show'), 2000);
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch() && !Page.isEmbed()) return;
        this._styleEl = injectStyle(this._css, 'rx-share-ts-css');

        waitFor('#videoPlayer, .videoPlayer-Rumble-cls').then(container => {
            container.style.position = container.style.position || 'relative';
            const btn = document.createElement('button');
            btn.className = 'rx-share-ts-btn';
            btn.title = 'Copy URL at current time';
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>Share@Time`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._copyURL(); });
            container.appendChild(btn);
            this._btn = btn;
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
        this._toast?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Shorts Filter
// ═══════════════════════════════════════════
const ShortsFilter = {
    id: 'shortsFilter',
    name: 'Shorts Filter',
    _obs: null,

    _css: `
        /* Hide Shorts cards from feeds - detected by #shorts__label SVG badge */
        .rx-shorts-hidden { display: none !important; }
        /* Hide the entire Shorts homepage section */
        #section-shorts.rx-section-hidden { display: none !important; }
    `,

    _isShortsCard(el) {
        // Shorts cards have the #shorts__label SVG badge and hidden duration
        if (el.querySelector('use[href="#shorts__label"]')) return true;
        if (el.querySelector('.videostream__status--hidden')) return true;
        // Shorts URLs contain /shorts/ or /v-shorts
        const link = el.querySelector('a[href*="/shorts/"]') || el.querySelector('a[href*="-short-"]');
        if (link) return true;
        return false;
    },

    _filterAll() {
        // Filter individual shorts cards from feed grids
        for (const card of qsa('.videostream, .thumbnail__grid--item')) {
            if (this._isShortsCard(card)) {
                card.classList.add('rx-shorts-hidden');
            }
        }
        // Hide the dedicated Shorts section on homepage
        const shortsSection = qs('#section-shorts');
        if (shortsSection) shortsSection.classList.add('rx-section-hidden');
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isFeed() && !Page.isHome() && !Page.isChannel()) return;
        this._styleEl = injectStyle(this._css, 'rx-shorts-filter-css');

        setTimeout(() => this._filterAll(), 1000);
        this._obs = new MutationObserver(() => this._filterAll());
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        for (const el of qsa('.rx-shorts-hidden')) el.classList.remove('rx-shorts-hidden');
        qs('#section-shorts')?.classList.remove('rx-section-hidden');
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Chat Auto-Scroll
// ═══════════════════════════════════════════
const ChatAutoScroll = {
    id: 'chatAutoScroll',
    name: 'Chat Auto-Scroll',
    _chatEl: null,
    _paused: false,
    _obs: null,
    _jumpBtn: null,

    _css: `
        .rx-chat-jump {
            position: absolute;
            bottom: 60px; left: 50%;
            transform: translateX(-50%);
            z-index: 200;
            background: rgba(137,180,250,0.9);
            color: #1e1e2e;
            border: none; border-radius: 16px;
            padding: 5px 14px;
            font: 700 11px/1.4 system-ui, sans-serif;
            cursor: pointer;
            display: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: opacity 0.2s;
        }
        .rx-chat-jump.show { display: block; }
        .rx-chat-jump:hover { background: #89b4fa; }
    `,

    _isNearBottom() {
        if (!this._chatEl) return true;
        const threshold = 80;
        return (this._chatEl.scrollHeight - this._chatEl.scrollTop - this._chatEl.clientHeight) < threshold;
    },

    _scrollToBottom() {
        if (!this._chatEl) return;
        this._chatEl.scrollTop = this._chatEl.scrollHeight;
        this._paused = false;
        this._jumpBtn?.classList.remove('show');
    },

    _onScroll() {
        if (this._isNearBottom()) {
            this._paused = false;
            this._jumpBtn?.classList.remove('show');
        } else {
            this._paused = true;
            this._jumpBtn?.classList.add('show');
        }
    },

    _onNewMessages() {
        if (!this._paused) {
            requestAnimationFrame(() => this._scrollToBottom());
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-chat-autoscroll-css');

        waitFor('#chat-history-list, .chat-history').then(chatEl => {
            this._chatEl = chatEl;

            // Scroll listener to detect user scroll-up
            this._boundScroll = () => this._onScroll();
            chatEl.addEventListener('scroll', this._boundScroll, { passive: true });

            // Create jump-to-latest button
            const parent = chatEl.parentElement;
            if (parent) {
                parent.style.position = parent.style.position || 'relative';
                this._jumpBtn = document.createElement('button');
                this._jumpBtn.className = 'rx-chat-jump';
                this._jumpBtn.textContent = 'Jump to latest';
                this._jumpBtn.addEventListener('click', () => this._scrollToBottom());
                parent.appendChild(this._jumpBtn);
            }

            // Observe new chat messages
            this._obs = new MutationObserver(() => this._onNewMessages());
            this._obs.observe(chatEl, { childList: true });

            // Initial scroll to bottom
            this._scrollToBottom();
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._jumpBtn?.remove();
        this._obs?.disconnect();
        if (this._chatEl && this._boundScroll) {
            this._chatEl.removeEventListener('scroll', this._boundScroll);
        }
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Auto-Expand Description
// ═══════════════════════════════════════════
const AutoExpand = {
    id: 'autoExpand',
    name: 'Auto Expand',

    _css: `
        /* Force description to be fully visible */
        .media-description {
            max-height: none !important;
            overflow: visible !important;
            -webkit-line-clamp: unset !important;
        }
        .media-description-section [data-js="media_long_description_container"] {
            max-height: none !important;
            overflow: visible !important;
        }
        /* Hide the "Show more"/"Show less" toggle if present */
        .media-description-section .show-more-toggle,
        .media-description-section [data-js="media_description_show_more"],
        .media-description-section [data-js="media_description_show_less"] {
            display: none !important;
        }
        /* Also expand comment text that might be truncated */
        .comment-text {
            max-height: none !important;
            overflow: visible !important;
            -webkit-line-clamp: unset !important;
        }
    `,

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-auto-expand-css');

        // Also click any "Show more" button that exists. Track the timer so
        // destroy() can cancel — otherwise disabling the feature within the
        // 1500 ms window still fires the click against a page where the user
        // has explicitly turned AutoExpand off.
        waitFor('.media-description-section').then(() => {
            this._timer = setTimeout(() => {
                this._timer = null;
                const showMore = qs('[data-js="media_description_show_more"]') ||
                    qs('.media-description-section .show-more-toggle') ||
                    qs('.media-description-section button[class*="show-more"]');
                if (showMore && showMore.offsetParent !== null) {
                    showMore.click();
                }
            }, 1500);
        }).catch(() => {});
    },

    destroy() {
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Notification Enhance
// ═══════════════════════════════════════════
const NotifEnhance = {
    id: 'notifEnhance',
    name: 'Notification Enhance',

    _css: `
        /* Restyle notification dropdown with Catppuccin Mocha */
        .user-notifications {
            background: #1e1e2e !important;
            border: 1px solid #45475a !important;
            border-radius: 12px !important;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5) !important;
            max-height: 500px !important;
            overflow-y: auto !important;
        }
        .user-notifications--header {
            background: #181825 !important;
            border-bottom: 1px solid #313244 !important;
            padding: 10px 16px !important;
            font-weight: 700 !important;
            color: #cdd6f4 !important;
        }
        .user-notifications--list-wrapper {
            padding: 4px !important;
        }
        .user-notifications--list-wrapper a,
        .user-notifications--list-wrapper > div {
            border-radius: 8px !important;
            padding: 8px 12px !important;
            margin: 2px 0 !important;
            transition: background 0.15s !important;
        }
        .user-notifications--list-wrapper a:hover,
        .user-notifications--list-wrapper > div:hover {
            background: #313244 !important;
        }
        .user-notifications--show-more {
            background: #313244 !important;
            color: #89b4fa !important;
            border: 1px solid #45475a !important;
            border-radius: 6px !important;
            margin: 8px 12px !important;
            padding: 6px !important;
            font-weight: 600 !important;
            transition: border-color 0.15s !important;
        }
        .user-notifications--show-more:hover {
            border-color: #89b4fa !important;
        }
        .user-notifications--loading-bar {
            color: #6c7086 !important;
        }
        /* Enhanced bell animation for unread */
        .user-notifications--bell-button--unread::after {
            background: #f38ba8 !important;
            animation: rx-bell-pulse 2s ease-in-out infinite !important;
        }
        @keyframes rx-bell-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.7; }
        }
        /* Notification close button */
        .user-notifications--close {
            color: #6c7086 !important;
            transition: color 0.15s !important;
        }
        .user-notifications--close:hover {
            color: #cdd6f4 !important;
        }
        /* Scrollbar inside notifications */
        .user-notifications::-webkit-scrollbar { width: 6px; }
        .user-notifications::-webkit-scrollbar-track { background: transparent; }
        .user-notifications::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }
        .user-notifications::-webkit-scrollbar-thumb:hover { background: #585b70; }
    `,

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-notif-enhance-css');
    },

    destroy() {
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Playlist Quick Save
// ═══════════════════════════════════════════
const PlaylistQuickSave = {
    id: 'quickSave',
    name: 'Quick Save',
    _obs: null,

    _css: `
        .rx-quick-save {
            position: absolute;
            top: 6px; right: 6px;
            z-index: 50;
            background: rgba(17,17,27,0.8);
            border: 1px solid rgba(205,214,244,0.15);
            color: #cdd6f4;
            border-radius: 6px;
            width: 28px; height: 28px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s, background 0.15s, border-color 0.15s;
            pointer-events: auto;
        }
        .thumbnail__thumb:hover .rx-quick-save,
        .videostream:hover .rx-quick-save { opacity: 1; }
        .rx-quick-save:hover { background: rgba(17,17,27,0.95); border-color: #89b4fa; }
        .rx-quick-save.saved { border-color: #a6e3a1; color: #a6e3a1; }
        .rx-quick-save svg { width: 16px; height: 16px; fill: currentColor; pointer-events: none; }
        .rx-save-toast {
            position: fixed; bottom: 80px; left: 50%;
            transform: translateX(-50%);
            background: #313244; color: #a6e3a1;
            border: 1px solid #a6e3a1;
            border-radius: 8px; padding: 8px 18px;
            font: 600 13px/1.4 system-ui, sans-serif;
            z-index: 100001;
            opacity: 0; transition: opacity 0.3s;
            pointer-events: none;
        }
        .rx-save-toast.show { opacity: 1; }
    `,

    _toast: null,
    _toastTimer: null,

    _showToast(msg) {
        if (!this._toast) {
            this._toast = document.createElement('div');
            this._toast.className = 'rx-save-toast';
            document.body.appendChild(this._toast);
        }
        this._toast.textContent = msg;
        this._toast.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this._toast.classList.remove('show'), 2000);
    },

    _clickNativeWatchLater(card) {
        // Find the native playlist-menu and trigger "Save to Watch Later"
        const menu = card.querySelector('.playlist-menu, [data-js="playlist_menu"]');
        if (!menu) return false;

        const menuBtn = menu.querySelector('.playlist-menu__button, [data-js="playlist_menu_button"]');
        if (menuBtn) {
            // Open menu
            menuBtn.click();
            // Wait for menu to render, then click Watch Later option
            setTimeout(() => {
                const watchLaterOpt = menu.querySelector('[data-playlist-option="watch-later-add"]');
                if (watchLaterOpt) {
                    watchLaterOpt.click();
                    this._showToast('Saved to Watch Later');
                    return;
                }
                // Close menu if option not found
                menuBtn.click();
            }, 100);
            return true;
        }
        return false;
    },

    _addButtons() {
        for (const thumb of qsa('.thumbnail__thumb')) {
            if (thumb.querySelector('.rx-quick-save')) continue;
            const card = thumb.closest('.videostream, .thumbnail__grid--item');
            if (!card) continue;

            // Need relative positioning on thumb
            thumb.style.position = thumb.style.position || 'relative';

            const btn = document.createElement('button');
            btn.className = 'rx-quick-save';
            btn.title = 'Save to Watch Later';
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 6v6l4 2-1 1.7L10 13V6h2zm0-4C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"/></svg>`;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this._clickNativeWatchLater(card)) {
                    btn.classList.add('saved');
                } else {
                    // Fallback: save to our local bookmarks
                    const link = card.querySelector('.videostream__link, .title__link, a[href*="/v"]');
                    const title = card.querySelector('.thumbnail__title')?.textContent?.trim() || '';
                    if (link?.href && title) {
                        const key = 'rx_bookmarks';
                        try {
                            const bm = JSON.parse(localStorage.getItem(key) || '[]');
                            if (!bm.some(b => b.url === link.href)) {
                                const channel = card.querySelector('.channel__name')?.textContent?.trim() || '';
                                const img = card.querySelector('.thumbnail__image');
                                bm.unshift({ url: link.href, title, channel, thumb: img?.src || '', time: Date.now() });
                                localStorage.setItem(key, JSON.stringify(bm.slice(0, 200)));
                                btn.classList.add('saved');
                                this._showToast('Bookmarked locally');
                            } else {
                                btn.classList.add('saved');
                                this._showToast('Already saved');
                            }
                        } catch { /* ignore */ }
                    }
                }
            });
            thumb.appendChild(btn);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isFeed() && !Page.isHome() && !Page.isChannel() && !Page.isSearch()) return;
        this._styleEl = injectStyle(this._css, 'rx-quick-save-css');

        setTimeout(() => this._addButtons(), 1500);
        this._obs = new MutationObserver(() => this._addButtons());
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._toast?.remove();
        for (const el of qsa('.rx-quick-save')) el.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Settings Panel (Categorized Modal)
// ═══════════════════════════════════════════
const RX_CATEGORIES = [
    {
        id: 'ad-blocking', label: 'Ad Blocking', color: '#f38ba8',
        icon: '<path d="M18.36 6.64a1 1 0 00-1.41 0L12 11.59 7.05 6.64a1 1 0 10-1.41 1.41L10.59 13l-4.95 4.95a1 1 0 101.41 1.41L12 14.41l4.95 4.95a1 1 0 001.41-1.41L13.41 13l4.95-4.95a1 1 0 000-1.41z"/>',
        features: [
            { id: 'adNuker', label: 'Ad Nuker', desc: 'Block ads, pause overlays, premium nags, IMA SDK' },
            { id: 'feedCleanup', label: 'Feed Cleanup', desc: 'Remove premium promos from feeds' },
            { id: 'hideReposts', label: 'Hide Reposts', desc: 'Hide reposted videos from feeds', parent: 'feedCleanup' },
            { id: 'hidePremium', label: 'Hide Premium', desc: 'Hide premium/PPV videos from feeds' },
            { id: 'shortsFilter', label: 'Shorts Filter', desc: 'Hide Shorts from all feeds' },
            { id: 'sponsorBlock', label: 'SponsorBlock', desc: 'Local per-video segments with auto-skip' },
        ],
    },
    {
        id: 'video-player', label: 'Video Player', color: '#a78bfa',
        icon: '<path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zm5.5 4.5l6 4.5-6 4.5v-9z"/>',
        features: [
            { id: 'theaterSplit', label: 'Theater Split', desc: 'Fullscreen video with scroll-to-reveal side panel' },
            { id: 'autoTheater', label: 'Auto Theater', desc: 'Auto-enter native theater mode on load' },
            { id: 'speedController', label: 'Speed Control', desc: 'Persistent playback speed with live detection' },
            { id: 'scrollVolume', label: 'Scroll Volume', desc: 'Mouse wheel volume + middle-click mute' },
            { id: 'defaultMaxVolume', label: 'Default Max Volume', desc: 'Start videos at 100% volume', parent: 'scrollVolume' },
            { id: 'autoMaxQuality', label: 'Auto Max Quality', desc: 'Auto-select highest resolution on load' },
            { id: 'autoplayBlock', label: 'Autoplay Block', desc: 'Prevent auto-play of next video' },
            { id: 'loopControl', label: 'Loop Control', desc: 'Full video loop + A-B segment loop' },
            { id: 'miniPlayer', label: 'Mini Player', desc: 'Floating draggable video when scrolling away' },
            { id: 'keyboardNav', label: 'Keyboard Nav', desc: 'YouTube-style hotkeys (J/K/L, F, M, 0-9)' },
            { id: 'videoStats', label: 'Video Stats', desc: 'Resolution, codec, buffer, frames overlay' },
            { id: 'chapters', label: 'Chapters', desc: 'Parse description timestamps + seekbar markers' },
            { id: 'autoplayScheduler', label: 'Autoplay Queue', desc: 'Queue Rumble URLs, auto-advance at end' },
        ],
    },
    {
        id: 'theme-layout', label: 'Theme & Layout', color: '#fab387',
        icon: '<path d="M12 2a1 1 0 011 1v1a1 1 0 01-2 0V3a1 1 0 011-1zm6.36 3.05a1 1 0 010 1.41l-.7.71a1 1 0 01-1.42-1.42l.71-.7a1 1 0 011.41 0zM21 11a1 1 0 010 2h-1a1 1 0 010-2h1zM4 11a1 1 0 010 2H3a1 1 0 010-2h1zm2.05-5.95a1 1 0 011.41 0l.71.7a1 1 0 01-1.42 1.42l-.7-.71a1 1 0 010-1.41zM12 7a5 5 0 100 10 5 5 0 000-10z"/>',
        features: [
            { id: 'darkEnhance', label: 'Dark Theme', desc: 'Theme engine with player bar coloring' },
            { id: 'wideLayout', label: 'Wide Layout', desc: 'Full-width responsive grid on home & subs' },
            { id: 'logoToFeed', label: 'Logo to Feed', desc: 'Rumble logo navigates to Subscriptions' },
            { id: 'autoExpand', label: 'Auto Expand', desc: 'Auto-expand descriptions & comments' },
            { id: 'notifEnhance', label: 'Notif Enhance', desc: 'Themed notification dropdown + bell pulse' },
            { id: 'fullTitles', label: 'Full Titles', desc: 'Remove title truncation on video cards' },
            { id: 'titleFont', label: 'Title Font', desc: 'Unbold + normalize title typography' },
        ],
    },
    {
        id: 'downloads', label: 'Downloads & Capture', color: '#f9e2af',
        icon: '<path d="M12 3a1 1 0 011 1v9.59l3.3-3.3a1 1 0 011.4 1.42l-5 5a1 1 0 01-1.4 0l-5-5a1 1 0 011.4-1.42L11 13.59V4a1 1 0 011-1zM5 19a1 1 0 100 2h14a1 1 0 100-2H5z"/>',
        features: [
            { id: 'videoDownload', label: 'Video Download', desc: 'Download as direct MP4 or HLS-to-MP4/TS' },
            { id: 'audioOnly', label: 'Low-Bitrate MP4', desc: 'Download smallest video variant for listening (saved as .mp4)' },
            { id: 'videoClips', label: 'Video Clips', desc: 'Mark In/Out and export clip as MP4' },
            { id: 'liveDVR', label: 'Live DVR', desc: 'Save the last N seconds of a live stream' },
            { id: 'batchDownload', label: 'Batch Download', desc: 'Multi-select thumbnails from feeds to download' },
            { id: 'screenshotBtn', label: 'Screenshot', desc: 'Capture current video frame as PNG' },
            { id: 'shareTimestamp', label: 'Share@Time', desc: 'Copy video URL at current playback time' },
            { id: 'subtitleSidecar', label: 'Subtitle Sidecar', desc: 'Load local SRT/VTT and overlay captions' },
            { id: 'transcripts', label: 'Transcripts', desc: 'Clickable transcript panel synced to player' },
        ],
    },
    {
        id: 'history', label: 'History & Bookmarks', color: '#89b4fa',
        icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>',
        features: [
            { id: 'watchProgress', label: 'Watch Progress', desc: 'Save/resume position + red progress bars' },
            { id: 'watchHistory', label: 'Watch History', desc: 'Local browsable watch history with search' },
            { id: 'searchHistory', label: 'Search History', desc: 'Recent searches dropdown on search input' },
            { id: 'quickBookmark', label: 'Bookmarks', desc: 'Save videos locally for later (200 max)' },
            { id: 'quickSave', label: 'Quick Save', desc: 'Watch Later button on thumbnail hover' },
        ],
    },
    {
        id: 'comments-chat', label: 'Comments & Chat', color: '#a6e3a1',
        icon: '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>',
        features: [
            { id: 'liveChatEnhance', label: 'Chat Enhance', desc: '@mention highlights, message filter bar' },
            { id: 'chatAutoScroll', label: 'Chat Scroll', desc: 'Smart auto-scroll with pause on scroll-up' },
            { id: 'uniqueChatters', label: 'Unique Chatters', desc: 'Live counter of unique chatters + messages' },
            { id: 'chatUserBlock', label: 'User Block', desc: 'Per-user chat hide (click "block" on message)' },
            { id: 'chatSpamDedup', label: 'Spam Dedup', desc: 'Hide recently-repeated identical messages' },
            { id: 'chatExport', label: 'Chat Export', desc: 'Export chat as TXT (click) or JSON (shift-click)' },
            { id: 'popoutChat', label: 'Popout Chat', desc: 'Open chat in separate resizable window' },
            { id: 'videoTimestamps', label: 'Timestamps', desc: 'Clickable timestamps in comments/description' },
            { id: 'commentNav', label: 'Comment Nav', desc: 'Navigate, expand/collapse, OP-only filter' },
            { id: 'commentSort', label: 'Comment Sort', desc: 'Sort comments: Top / New / Oldest / Controversial' },
            { id: 'rantHighlight', label: 'Rant Highlight', desc: 'Glow rants by tier + running $ total' },
            { id: 'rantPersist', label: 'Rant Persist', desc: 'Keep rants visible past expiry + export JSON' },
            { id: 'commentBlocking', label: 'Comment Blocking', desc: 'Block users from the comment section' },
            { id: 'autoLoadComments', label: 'Auto Load Comments', desc: 'Auto-click "Show more comments" on scroll' },
            { id: 'moveReplyButton', label: 'Move Reply Button', desc: 'Move Reply next to like/dislike on comments' },
            { id: 'hideCommentReportLink', label: 'Hide Comment Report', desc: 'Hide the "report" link on comments' },
            { id: 'cleanLiveChat', label: 'Clean Live Chat UI', desc: 'Hide pinned messages + chat header + rant UI' },
        ],
    },
    {
        id: 'feed-controls', label: 'Feed Controls', color: '#74c7ec',
        icon: '<path d="M3 5a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 5a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm5 5a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z"/>',
        features: [
            { id: 'channelBlocker', label: 'Channel Blocker', desc: 'Block/hide channels from all feeds' },
            { id: 'keywordFilter', label: 'Keyword Filter', desc: 'Hide videos whose titles match blocked keywords' },
            { id: 'relatedFilter', label: 'Related Filter', desc: 'Search & filter related sidebar videos' },
            { id: 'exactCounts', label: 'Exact Counts', desc: 'Show full numbers instead of 1.2K/3.5M' },
        ],
    },
    // ── v1.9.0 — Rumble Enhancement Suite port ──
    {
        id: 'nav-chrome', label: 'Navigation & Chrome', color: '#94e2d5',
        icon: '<path d="M4 6h16v2H4zM4 11h16v2H4zM4 16h10v2H4z"/>',
        features: [
            { id: 'autoHideHeader', label: 'Auto-hide Header', desc: 'Fade header out; shows on top-edge hover' },
            { id: 'autoHideNavSidebar', label: 'Auto-hide Nav Sidebar', desc: 'Hide sidebar; slides in on left-edge hover' },
            { id: 'widenSearchBar', label: 'Widen Search Bar', desc: 'Expand the header search bar' },
            { id: 'hideUploadIcon', label: 'Hide Upload Icon', desc: 'Hide the upload/stream icon in the header' },
            { id: 'hideHeaderAd', label: 'Hide "Go Ad-Free"', desc: 'Hide the Go-Ad-Free button in the header' },
            { id: 'hideProfileBacksplash', label: 'Hide Profile Backsplash', desc: 'Hide the large channel header image' },
            { id: 'hideFooter', label: 'Hide Footer', desc: 'Hide the site footer entirely' },
            { id: 'siteThemeSync', label: 'Sync Site Theme', desc: "Mirror Rumble's native system/dark/light toggle" },
        ],
    },
    {
        id: 'main-page', label: 'Main Page Rows', color: '#b4befe',
        icon: '<path d="M3 4h18v4H3zM3 10h18v4H3zM3 16h18v4H3z"/>',
        features: [
            { id: 'hideFeaturedBanner', label: 'Featured Banner', desc: 'Top homepage banner' },
            { id: 'hideEditorPicks', label: 'Editor Picks', desc: 'Editor Picks row' },
            { id: 'hideTopLiveCategories', label: 'Top Live', desc: 'Top Live Categories row' },
            { id: 'hidePremiumRow', label: 'Premium Row', desc: 'Rumble Premium row' },
            { id: 'hideHomepageAd', label: 'Homepage Ad', desc: 'Ad container on home page' },
            { id: 'hideForYouRow', label: 'For You', desc: 'For-You recommendations row' },
            { id: 'hideLiveRow', label: 'Live Row', desc: 'Live videos row' },
            { id: 'hideGamingRow', label: 'Gaming', desc: 'Gaming row' },
            { id: 'hideFinanceRow', label: 'Finance', desc: 'Finance & Crypto row' },
            { id: 'hideFeaturedPlaylistsRow', label: 'Featured Playlists', desc: 'Featured Playlists row' },
            { id: 'hideSportsRow', label: 'Sports', desc: 'Sports row' },
            { id: 'hideViralRow', label: 'Viral', desc: 'Viral row' },
            { id: 'hidePodcastsRow', label: 'Podcasts', desc: 'Podcasts row' },
            { id: 'hideLeaderboardRow', label: 'Leaderboard', desc: 'Leaderboard row' },
            { id: 'hideVlogsRow', label: 'Vlogs', desc: 'Vlogs row' },
            { id: 'hideNewsRow', label: 'News', desc: 'News row' },
            { id: 'hideScienceRow', label: 'Science', desc: 'Health & Science row' },
            { id: 'hideMusicRow', label: 'Music', desc: 'Music row' },
            { id: 'hideEntertainmentRow', label: 'Entertainment', desc: 'Entertainment row' },
            { id: 'hideCookingRow', label: 'Cooking', desc: 'Cooking row' },
        ],
    },
    {
        id: 'video-page', label: 'Video Page Layout', color: '#f5c2e7',
        icon: '<path d="M4 5h16v11H4zM4 18h8v2H4zM14 18h6v2h-6z"/>',
        features: [
            { id: 'fullWidthPlayer', label: 'Full-Width Player', desc: 'Maximize player width; live = side-by-side chat' },
            { id: 'adaptiveLiveLayout', label: 'Adaptive Live Layout', desc: 'On live, expand main content when chat is visible' },
            { id: 'hideRelatedSidebar', label: 'Hide Related Sidebar', desc: 'Hide the related-videos sidebar' },
            { id: 'hideRelatedOnLive', label: 'Hide Related on Live', desc: 'Hide related media under the player on live' },
            { id: 'widenContent', label: 'Widen Content', desc: 'Expand main content (pair with hidden sidebar)' },
            { id: 'hideVideoDescription', label: 'Hide Description', desc: 'Hide description, tags, and views block' },
            { id: 'hidePausedVideoAds', label: 'Hide Paused Ads', desc: 'Hide pause-overlay ads on the player' },
        ],
    },
    {
        id: 'player-controls', label: 'Player Controls', color: '#fab387',
        icon: '<path d="M5 4v16l4-4v-8zM15 4v16l4-4v-8z"/>',
        features: [
            { id: 'autoLike', label: 'Auto Like', desc: 'Auto-like a video when its watch page opens' },
            { id: 'hideRewindButton', label: 'Hide Rewind', desc: 'Hide the rewind button' },
            { id: 'hideFastForwardButton', label: 'Hide Fast Forward', desc: 'Hide the fast-forward button' },
            { id: 'hideCCButton', label: 'Hide CC', desc: 'Hide the closed-captions button' },
            { id: 'hideAutoplayButton', label: 'Hide Autoplay Toggle', desc: 'Hide the autoplay toggle switch' },
            { id: 'hideTheaterButton', label: 'Hide Theater Button', desc: 'Hide the theater-mode button' },
            { id: 'hidePipButton', label: 'Hide PiP Button', desc: 'Hide the picture-in-picture button' },
            { id: 'hideFullscreenButton', label: 'Hide Fullscreen Button', desc: 'Hide the fullscreen button' },
            { id: 'hidePlayerRumbleLogo', label: 'Hide Player Logo', desc: 'Hide the Rumble logo in the player' },
            { id: 'hidePlayerGradient', label: 'Hide Player Gradient', desc: 'Remove the cloudy gradient at the bottom' },
        ],
    },
    {
        id: 'video-buttons', label: 'Video Buttons', color: '#f38ba8',
        icon: '<path d="M4 8h16v2H4zM4 14h16v2H4z"/>',
        features: [
            { id: 'hideLikeDislikeButton', label: 'Hide Like/Dislike', desc: 'Hide like and dislike buttons' },
            { id: 'hideShareButton', label: 'Hide Share', desc: 'Hide the share button' },
            { id: 'hideRepostButton', label: 'Hide Repost', desc: 'Hide the repost button' },
            { id: 'hideEmbedButton', label: 'Hide Embed', desc: 'Hide the embed button' },
            { id: 'hideSaveButton', label: 'Hide Save', desc: 'Hide the save-to-playlist button' },
            { id: 'hideCommentButton', label: 'Hide Comment', desc: 'Hide the main comment button' },
            { id: 'hideReportButton', label: 'Hide 3-dot Menu', desc: 'Hide the 3-dot menu (report link lives here)' },
            { id: 'hidePremiumJoinButtons', label: 'Hide Premium/Join', desc: 'Hide Rumble Premium and Join buttons' },
        ],
    },
];

const SettingsPanel = {
    _styleEl: null,
    _panelEl: null,
    _overlayEl: null,
    _toolbarEl: null,

    _css: `
        /* ── Toolbar (FAB) ── */
        html.rx-theater #rx-toolbar { display: none !important; }
        #rx-toolbar {
            position: fixed; bottom: 20px; right: 20px; z-index: 10010;
            display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        #rx-toolbar .rx-tb-btn {
            width: 42px; height: 42px; border-radius: 50%;
            background: rgba(30,30,46,0.9); border: 1px solid rgba(137,180,250,0.25);
            color: rgba(255,255,255,0.7); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.2s, transform 0.2s, border-color 0.2s;
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.4); text-decoration: none;
        }
        #rx-toolbar .rx-tb-btn:hover {
            background: rgba(49,50,68,0.95); border-color: rgba(137,180,250,0.5); transform: scale(1.08);
        }
        #rx-home-btn svg { width: 20px; height: 20px; }
        #rx-home-btn:hover { border-color: rgba(133,213,81,0.6) !important; }
        #rx-settings-btn svg { transition: transform 0.3s cubic-bezier(.4,0,.2,1); }

        /* ── Overlay ── */
        #rx-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 80000;
            opacity: 0; pointer-events: none; transition: opacity 300ms ease;
        }
        body.rx-panel-open #rx-overlay { opacity: 1; pointer-events: auto; }

        /* ── Modal ── */
        #rx-modal {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%,-50%) scale(0.96);
            width: 95%; max-width: 960px; height: 82vh; max-height: 720px;
            background: #0a0a0b; border: 1px solid #2a2a2e; border-radius: 20px;
            box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset;
            z-index: 80001; display: flex; flex-direction: column; overflow: hidden;
            opacity: 0; pointer-events: none;
            transition: all 300ms cubic-bezier(0.32,0.72,0,1);
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            color: #f0f0f0;
        }
        body.rx-panel-open #rx-modal {
            opacity: 1; pointer-events: auto; transform: translate(-50%,-50%) scale(1);
        }

        /* ── Header ── */
        .rx-m-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 24px; background: #111113;
            border-bottom: 1px solid #2a2a2e; flex-shrink: 0;
        }
        .rx-m-brand { display: flex; align-items: center; gap: 10px; }
        .rx-m-title {
            font-size: 20px; font-weight: 700; letter-spacing: -0.5px;
        }
        .rx-m-title-rx {
            background: linear-gradient(135deg, #85d551 0%, #4aba0e 50%, #85d551 100%);
            background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            animation: rx-shimmer 3s linear infinite;
        }
        @keyframes rx-shimmer { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
        .rx-m-badge {
            padding: 3px 10px; font-size: 9px; font-weight: 700; text-transform: uppercase;
            color: #fff; background: linear-gradient(135deg, #85d551, #4aba0e);
            border-radius: 100px; box-shadow: 0 2px 8px rgba(133,213,81,0.35);
        }
        .rx-m-close {
            display: flex; align-items: center; justify-content: center;
            width: 32px; height: 32px; background: #17171a; border: 1px solid #2a2a2e;
            border-radius: 8px; cursor: pointer; color: #a1a1aa;
            transition: all 180ms cubic-bezier(0.4,0,0.2,1);
        }
        .rx-m-close:hover { background: #ef4444; border-color: #ef4444; color: #fff; }
        .rx-m-close svg { width: 14px; height: 14px; }

        /* ── Body ── */
        .rx-m-body { display: flex; flex: 1; overflow: hidden; }

        /* ── Sidebar ── */
        .rx-m-sidebar {
            display: flex; flex-direction: column; width: 220px;
            padding: 8px 6px; background: #111113; border-right: 1px solid #2a2a2e;
            overflow-y: auto; flex-shrink: 0; gap: 2px;
        }
        .rx-m-search-wrap {
            position: relative; padding: 4px 6px 8px;
        }
        .rx-m-search {
            width: 100%; padding: 8px 12px 8px 32px; background: #17171a;
            border: 1px solid #2a2a2e; border-radius: 8px; color: #f0f0f0;
            font-size: 13px; transition: all 180ms; outline: none;
        }
        .rx-m-search:focus { border-color: #85d551; box-shadow: 0 0 0 3px rgba(133,213,81,0.12); }
        .rx-m-search-icon {
            position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
            color: #71717a; pointer-events: none;
        }
        .rx-m-search-icon svg { width: 14px; height: 14px; }
        .rx-m-nav-btn {
            display: flex; align-items: center; gap: 10px; width: 100%;
            padding: 7px 10px; background: transparent; border: none;
            border-radius: 8px; cursor: pointer; text-align: left;
            transition: all 180ms; color: #a1a1aa; font-size: 13px; font-weight: 500;
        }
        .rx-m-nav-btn:hover { background: #1e1e22; }
        .rx-m-nav-btn.active { background: #27272a; color: #f0f0f0; font-weight: 600; }
        .rx-m-nav-icon {
            display: flex; align-items: center; justify-content: center;
            width: 30px; height: 30px; background: #17171a; border-radius: 6px;
            flex-shrink: 0; transition: all 180ms;
        }
        .rx-m-nav-icon svg { width: 16px; height: 16px; fill: currentColor; }
        .rx-m-nav-btn.active .rx-m-nav-icon {
            background: var(--rx-cat-color); color: #fff;
            box-shadow: 0 2px 10px color-mix(in srgb, var(--rx-cat-color) 40%, transparent);
        }
        .rx-m-nav-count {
            margin-left: auto; font-size: 10px; font-weight: 600; color: #71717a;
            background: #17171a; padding: 2px 7px; border-radius: 100px;
        }
        .rx-m-nav-btn.active .rx-m-nav-count { background: rgba(255,255,255,0.12); color: #f0f0f0; }

        /* ── Content ── */
        .rx-m-content { flex: 1; padding: 20px 24px; overflow-y: auto; background: #0a0a0b; }
        .rx-m-pane { display: none; animation: rx-pane-in 250ms ease; }
        .rx-m-pane.active { display: block; }
        @keyframes rx-pane-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .rx-m-pane-header {
            display: flex; align-items: center; justify-content: space-between;
            margin: 0 0 16px; padding: 0 0 14px; border-bottom: 1px solid #2a2a2e;
        }
        .rx-m-pane-title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
        .rx-m-toggle-all {
            display: flex; align-items: center; gap: 8px;
            font-size: 11px; color: #a1a1aa; cursor: pointer; user-select: none;
        }
        .rx-m-features-grid { display: flex; flex-direction: column; gap: 6px; }

        /* ── Feature Card ── */
        .rx-m-card {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 14px; background: #17171a;
            border: 1px solid rgba(255,255,255,0.04); border-left: 3px solid transparent;
            border-radius: 8px; transition: all 180ms;
        }
        .rx-m-card:hover { background: #1e1e22; transform: translateX(2px); }
        .rx-m-card.rx-m-enabled {
            border-left-color: var(--rx-cat-color);
            background: color-mix(in srgb, var(--rx-cat-color) 4%, #17171a);
        }
        .rx-m-card.rx-m-sub { margin-left: 18px; border-left-width: 2px; }
        .rx-m-card-info { flex: 1; min-width: 0; padding-right: 16px; }
        .rx-m-card-name { font-size: 13px; font-weight: 600; color: #f0f0f0; margin: 0 0 2px; }
        .rx-m-card-desc { font-size: 11px; color: #71717a; margin: 0; line-height: 1.4; }

        /* ── Switch ── */
        .rx-m-switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
        .rx-m-switch input { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; z-index: 1; margin: 0; }
        .rx-m-switch-track {
            position: absolute; inset: 0; background: #27272a; border: 1px solid #2a2a2e;
            border-radius: 100px; transition: all 180ms;
        }
        .rx-m-switch.active .rx-m-switch-track {
            background: var(--rx-switch-color, #85d551); border-color: transparent;
            box-shadow: 0 0 14px color-mix(in srgb, var(--rx-switch-color, #85d551) 45%, transparent);
        }
        .rx-m-switch-thumb {
            position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
            background: #fff; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.3);
            transition: all 180ms cubic-bezier(0.4,0,0.2,1);
        }
        .rx-m-switch.active .rx-m-switch-thumb { transform: translateX(18px); }

        /* ── Special Sections ── */
        .rx-m-section-title {
            font-size: 11px; font-weight: 600; color: #a1a1aa; text-transform: uppercase;
            letter-spacing: 0.5px; margin: 20px 0 10px; padding: 0 0 8px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .rx-m-chip-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .rx-m-chip {
            font-size: 11px; padding: 5px 12px; border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.08); background: #17171a;
            color: #f0f0f0; cursor: pointer; user-select: none;
            transition: all 180ms; display: flex; align-items: center; gap: 6px;
        }
        .rx-m-chip:hover { background: #1e1e22; border-color: rgba(255,255,255,0.15); }
        .rx-m-chip.rx-m-chip-active {
            border-color: var(--rx-cat-color, #85d551);
            background: color-mix(in srgb, var(--rx-cat-color, #85d551) 10%, #17171a);
            box-shadow: 0 0 8px color-mix(in srgb, var(--rx-cat-color, #85d551) 20%, transparent);
        }
        .rx-m-chip.rx-m-chip-hidden {
            opacity: 0.4; text-decoration: line-through; background: #0a0a0b;
            border-color: rgba(255,255,255,0.03);
        }
        .rx-m-theme-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .rx-m-unblock-chip svg { width: 10px; height: 10px; margin-left: 4px; flex-shrink: 0; }
        .rx-m-slider-row {
            display: flex; align-items: center; gap: 12px; padding: 4px 0 8px;
        }
        .rx-m-slider-row input[type=range] { flex: 1; accent-color: #85d551; height: 4px; }
        .rx-m-slider-label { font-size: 13px; font-weight: 600; color: #85d551; min-width: 36px; }
        .rx-m-empty { font-size: 11px; color: #71717a; padding: 2px 0; }

        /* ── Footer ── */
        .rx-m-footer {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 24px; background: #111113;
            border-top: 1px solid #2a2a2e; flex-shrink: 0;
        }
        .rx-m-footer-left { display: flex; align-items: center; gap: 12px; }
        .rx-m-footer-right { display: flex; align-items: center; gap: 8px; }
        .rx-m-version { font-size: 11px; color: #71717a; }
        .rx-m-shortcut { font-size: 10px; color: #52525b; padding: 2px 8px; background: #17171a; border-radius: 4px; }
        .rx-m-btn {
            display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
            font-size: 12px; font-weight: 600; border: none; border-radius: 8px;
            cursor: pointer; transition: all 180ms; font-family: inherit;
        }
        .rx-m-btn-primary {
            color: #fff; background: linear-gradient(135deg, #85d551, #4aba0e);
            box-shadow: 0 2px 8px rgba(133,213,81,0.3);
        }
        .rx-m-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(133,213,81,0.4); }
        .rx-m-btn-secondary {
            color: #a1a1aa; background: #17171a; border: 1px solid #2a2a2e;
        }
        .rx-m-btn-secondary:hover { background: #1e1e22; color: #f0f0f0; }
        .rx-m-reload-note { font-size: 10px; color: rgba(166,173,200,0.5); text-align: center; padding: 12px 0 4px; }

        /* ── Settings toast ── */
        .rx-m-toast {
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            background: #313244; color: #a6e3a1; border: 1px solid #a6e3a1;
            border-radius: 8px; padding: 8px 18px; font: 600 13px/1.4 system-ui, sans-serif;
            z-index: 100001; opacity: 0; transition: opacity 0.3s; pointer-events: none;
        }
        .rx-m-toast.show { opacity: 1; }

        /* ── Responsive ── */
        @media (max-width: 700px) {
            #rx-modal { width: 98%; height: 90vh; max-height: none; border-radius: 14px; }
            .rx-m-sidebar { width: 56px; padding: 6px 4px; }
            .rx-m-nav-btn span:not(.rx-m-nav-icon) { display: none; }
            .rx-m-nav-icon { width: 36px; height: 36px; }
            .rx-m-search-wrap { display: none; }
        }
    `,

    _toastEl: null,
    _toastTimer: null,

    _showToast(msg) {
        if (!this._toastEl) {
            this._toastEl = document.createElement('div');
            this._toastEl.className = 'rx-m-toast';
            document.body.appendChild(this._toastEl);
        }
        this._toastEl.textContent = msg;
        this._toastEl.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this._toastEl.classList.remove('show'), 2000);
    },

    _makeSwitch(featureId, catColor) {
        const wrap = document.createElement('label');
        wrap.className = 'rx-m-switch' + (Settings.get(featureId) ? ' active' : '');
        wrap.style.setProperty('--rx-switch-color', catColor);
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Settings.get(featureId);
        input.dataset.featureId = featureId;
        input.addEventListener('change', () => {
            Settings.set(featureId, input.checked);
            wrap.classList.toggle('active', input.checked);
            const card = wrap.closest('.rx-m-card');
            if (card && !card.classList.contains('rx-m-sub')) card.classList.toggle('rx-m-enabled', input.checked);
            this._updateNavCounts();
            // Hot-reload: try to toggle the feature without a page reload
            const feat = features.find(f => f.id === featureId);
            if (feat && feat.destroy && feat.init) {
                try { feat.destroy(); } catch {}
                if (input.checked) { try { feat.init(); } catch {} }
                this._showToast(input.checked ? 'Enabled' : 'Disabled');
            } else {
                this._showToast('Reload page to apply');
            }
        });
        const track = document.createElement('div');
        track.className = 'rx-m-switch-track';
        const thumb = document.createElement('div');
        thumb.className = 'rx-m-switch-thumb';
        wrap.append(input, track, thumb);
        return wrap;
    },

    _makeCard(feat, catColor, isSub) {
        const card = document.createElement('div');
        card.className = 'rx-m-card' + (isSub ? ' rx-m-sub' : '') + (Settings.get(feat.id) ? ' rx-m-enabled' : '');
        card.style.setProperty('--rx-cat-color', catColor);
        card.dataset.featureId = feat.id;
        card.dataset.searchText = (feat.label + ' ' + feat.desc).toLowerCase();
        const info = document.createElement('div');
        info.className = 'rx-m-card-info';
        const nameDiv = document.createElement('div');
        nameDiv.className = 'rx-m-card-name';
        nameDiv.textContent = feat.label;
        const descDiv = document.createElement('div');
        descDiv.className = 'rx-m-card-desc';
        descDiv.textContent = feat.desc;
        info.append(nameDiv, descDiv);
        card.append(info, this._makeSwitch(feat.id, catColor));
        return card;
    },

    _updateNavCounts() {
        for (const btn of this._navBtns || []) {
            const catId = btn.dataset.tab;
            const cat = RX_CATEGORIES.find(c => c.id === catId);
            if (!cat) continue;
            const total = cat.features.filter(f => !f.parent).length;
            const enabled = cat.features.filter(f => !f.parent && Settings.get(f.id)).length;
            const countEl = btn.querySelector('.rx-m-nav-count');
            if (countEl) countEl.textContent = `${enabled}/${total}`;
        }
    },

    _buildPane(cat) {
        const pane = document.createElement('section');
        pane.className = 'rx-m-pane';
        pane.id = 'rx-pane-' + cat.id;
        pane.style.setProperty('--rx-cat-color', cat.color);

        // Header with title + enable-all toggle
        const header = document.createElement('div');
        header.className = 'rx-m-pane-header';
        const title = document.createElement('div');
        title.className = 'rx-m-pane-title';
        title.textContent = cat.label;
        header.appendChild(title);

        const toggleAll = document.createElement('label');
        toggleAll.className = 'rx-m-toggle-all';
        toggleAll.innerHTML = '<span>Enable All</span>';
        const allSwitch = this._makeSwitch('_all_' + cat.id, cat.color);
        const mainFeats = cat.features.filter(f => !f.parent);
        const allOn = mainFeats.every(f => Settings.get(f.id));
        allSwitch.classList.toggle('active', allOn);
        allSwitch.querySelector('input').checked = allOn;
        allSwitch.querySelector('input').dataset.featureId = '';
        allSwitch.querySelector('input').addEventListener('change', (e) => {
            e.stopImmediatePropagation();
            const isOn = e.target.checked;
            allSwitch.classList.toggle('active', isOn);
            for (const f of mainFeats) {
                Settings.set(f.id, isOn);
                const cb = pane.querySelector(`[data-feature-id="${f.id}"] input`);
                if (cb) { cb.checked = isOn; cb.dispatchEvent(new Event('change', { bubbles: true })); }
            }
        }, true);
        toggleAll.appendChild(allSwitch);
        header.appendChild(toggleAll);
        pane.appendChild(header);

        // Feature cards
        const grid = document.createElement('div');
        grid.className = 'rx-m-features-grid';
        for (const feat of cat.features) {
            grid.appendChild(this._makeCard(feat, cat.color, !!feat.parent));
        }
        pane.appendChild(grid);

        // Special sections per category
        if (cat.id === 'theme-layout') this._buildThemeSection(pane, cat.color);
        if (cat.id === 'video-player') this._buildSpeedSection(pane);
        if (cat.id === 'feed-controls') { this._buildBlockedSection(pane); this._buildKeywordSection(pane); }
        if (cat.id === 'ad-blocking') this._buildCategorySection(pane);
        if (cat.id === 'comments-chat') { this._buildBlockedChattersSection(pane); this._buildBlockedCommentersSection(pane); }

        return pane;
    },

    _buildListSection(pane, titleText, emptyText, placeholder, settingsKey) {
        const title = document.createElement('div');
        title.className = 'rx-m-section-title';
        title.textContent = titleText;
        pane.appendChild(title);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.style.cssText = 'width:100%;background:rgba(49,50,68,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:6px 10px;color:#cdd6f4;font-size:12px;margin-bottom:8px;outline:none;';
        pane.appendChild(input);

        const grid = document.createElement('div');
        grid.className = 'rx-m-chip-grid';
        pane.appendChild(grid);

        const renderEmpty = () => {
            const empty = document.createElement('span');
            empty.className = 'rx-m-empty';
            empty.textContent = emptyText;
            grid.appendChild(empty);
        };

        const render = () => {
            grid.innerHTML = '';
            const list = Settings.get(settingsKey) || [];
            if (!list.length) { renderEmpty(); return; }
            for (const item of list) {
                const chip = document.createElement('div');
                chip.className = 'rx-m-chip';
                const nameSpan = document.createElement('span');
                nameSpan.textContent = item;
                const close = document.createElement('span');
                close.textContent = '×';
                close.style.cssText = 'margin-left:6px;cursor:pointer;color:#f38ba8;font-weight:700;';
                chip.append(nameSpan, close);
                chip.addEventListener('click', () => {
                    const cur = Settings.get(settingsKey) || [];
                    const idx = cur.indexOf(item);
                    if (idx >= 0) cur.splice(idx, 1);
                    Settings.set(settingsKey, cur);
                    render();
                });
                grid.appendChild(chip);
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                const val = input.value.trim().toLowerCase();
                const cur = Settings.get(settingsKey) || [];
                if (!cur.includes(val)) {
                    cur.push(val);
                    Settings.set(settingsKey, cur);
                }
                input.value = '';
                render();
            }
        });

        render();
    },

    _buildKeywordSection(pane) {
        this._buildListSection(pane, 'Blocked Keywords', 'No keywords blocked', 'Add keyword (Enter to save)...', 'blockedKeywords');
    },

    _buildBlockedChattersSection(pane) {
        this._buildListSection(pane, 'Blocked Chatters', 'No chatters blocked', 'Add username (Enter to save)...', 'blockedChatters');
    },

    _buildBlockedCommentersSection(pane) {
        this._buildListSection(pane, 'Blocked Commenters', 'No commenters blocked', 'Add username (Enter to save)...', 'blockedCommenters');
    },

    _buildThemeSection(pane, color) {
        const title = document.createElement('div');
        title.className = 'rx-m-section-title';
        title.textContent = 'Theme';
        pane.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'rx-m-chip-grid';
        const currentTheme = Settings.get('theme') || 'catppuccin';
        for (const [id, theme] of Object.entries(THEMES)) {
            const chip = document.createElement('div');
            chip.className = 'rx-m-chip' + (id === currentTheme ? ' rx-m-chip-active' : '');
            chip.style.setProperty('--rx-cat-color', color);
            const dot = document.createElement('span');
            dot.className = 'rx-m-theme-dot';
            dot.style.background = theme.accent;
            chip.append(dot, theme.label);
            chip.addEventListener('click', () => {
                Settings.set('theme', id);
                for (const c of grid.querySelectorAll('.rx-m-chip')) c.classList.remove('rx-m-chip-active');
                chip.classList.add('rx-m-chip-active');
                SettingsPanel._showToast('Theme changed — reload page to apply');
            });
            grid.appendChild(chip);
        }
        pane.appendChild(grid);
    },

    _buildSpeedSection(pane) {
        const title = document.createElement('div');
        title.className = 'rx-m-section-title';
        title.textContent = 'Playback Speed';
        pane.appendChild(title);

        const row = document.createElement('div');
        row.className = 'rx-m-slider-row';
        const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
        const slider = document.createElement('input');
        slider.type = 'range'; slider.min = '0'; slider.max = '9'; slider.step = '1';
        slider.value = speeds.indexOf(Settings.get('playbackSpeed') || 1.0);
        if (slider.value === '-1') slider.value = '3';
        const label = document.createElement('span');
        label.className = 'rx-m-slider-label';
        label.textContent = (Settings.get('playbackSpeed') || 1.0) + 'x';
        slider.addEventListener('input', () => {
            const speed = speeds[parseInt(slider.value)];
            label.textContent = speed + 'x';
            Settings.set('playbackSpeed', speed);
            for (const v of qsa('video')) v.playbackRate = speed;
            SettingsPanel._showToast(`Speed: ${speed}x`);
        });
        row.append(slider, label);
        pane.appendChild(row);
    },

    _buildBlockedSection(pane) {
        const title = document.createElement('div');
        title.className = 'rx-m-section-title';
        title.textContent = 'Blocked Channels';
        pane.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'rx-m-chip-grid';
        grid.id = 'rx-blocked-list';
        const blocked = Settings.get('blockedChannels') || [];
        if (blocked.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'rx-m-empty';
            empty.textContent = 'No channels blocked';
            grid.appendChild(empty);
        } else {
            for (const ch of blocked) {
                const chip = document.createElement('div');
                chip.className = 'rx-m-chip';
                const nameSpan = document.createElement('span');
                nameSpan.textContent = ch;
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
                svg.setAttribute('stroke-width', '2.5');
                svg.setAttribute('stroke-linecap', 'round');
                const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                l1.setAttribute('x1', '18'); l1.setAttribute('y1', '6'); l1.setAttribute('x2', '6'); l1.setAttribute('y2', '18');
                const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                l2.setAttribute('x1', '6'); l2.setAttribute('y1', '6'); l2.setAttribute('x2', '18'); l2.setAttribute('y2', '18');
                svg.append(l1, l2);
                chip.append(nameSpan, svg);
                chip.title = 'Unblock ' + ch;
                chip.addEventListener('click', () => {
                    ChannelBlocker._unblockChannel(ch);
                    chip.remove();
                    if (!grid.children.length) {
                        const empty = document.createElement('span');
                        empty.className = 'rx-m-empty';
                        empty.textContent = 'No channels blocked';
                        grid.appendChild(empty);
                    }
                });
                grid.appendChild(chip);
            }
        }
        pane.appendChild(grid);
    },

    _buildCategorySection(pane) {
        const title = document.createElement('div');
        title.className = 'rx-m-section-title';
        title.textContent = 'Homepage Categories';
        pane.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'rx-m-chip-grid';
        const hiddenCats = Settings.get('hiddenCategories') || [];
        for (const cat of CategoryFilter._allCategories) {
            const chip = document.createElement('div');
            chip.className = 'rx-m-chip' + (hiddenCats.includes(cat.id) ? ' rx-m-chip-hidden' : '');
            chip.textContent = cat.label;
            chip.addEventListener('click', () => {
                const current = Settings.get('hiddenCategories') || [];
                const idx = current.indexOf(cat.id);
                if (idx >= 0) { current.splice(idx, 1); chip.classList.remove('rx-m-chip-hidden'); }
                else { current.push(cat.id); chip.classList.add('rx-m-chip-hidden'); }
                Settings.set('hiddenCategories', current);
                if (Page.isHome()) CategoryFilter._apply();
            });
            grid.appendChild(chip);
        }
        pane.appendChild(grid);
    },

    _build() {
        this._navBtns = [];

        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'rx-overlay';
        overlay.addEventListener('click', () => this._close());
        this._overlayEl = overlay;

        // Modal
        const modal = document.createElement('div');
        modal.id = 'rx-modal';

        // Header
        const header = document.createElement('div');
        header.className = 'rx-m-header';
        header.innerHTML = `
            <div class="rx-m-brand">
                <span class="rx-m-title"><span class="rx-m-title-rx">Rumble</span>X</span>
                <span class="rx-m-badge">v${VERSION}</span>
            </div>`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'rx-m-close';
        closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        closeBtn.addEventListener('click', () => this._close());
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'rx-m-body';

        // Sidebar
        const sidebar = document.createElement('nav');
        sidebar.className = 'rx-m-sidebar';
        const searchWrap = document.createElement('div');
        searchWrap.className = 'rx-m-search-wrap';
        searchWrap.innerHTML = '<span class="rx-m-search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>';
        const searchInput = document.createElement('input');
        searchInput.className = 'rx-m-search';
        searchInput.placeholder = 'Search features...';
        searchInput.type = 'text';
        let searchTimer = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this._filterSearch(searchInput.value), 150);
        });
        searchWrap.appendChild(searchInput);
        sidebar.appendChild(searchWrap);

        // Content
        const content = document.createElement('div');
        content.className = 'rx-m-content';
        this._contentEl = content;

        for (let i = 0; i < RX_CATEGORIES.length; i++) {
            const cat = RX_CATEGORIES[i];
            // Nav button
            const navBtn = document.createElement('button');
            navBtn.className = 'rx-m-nav-btn' + (i === 0 ? ' active' : '');
            navBtn.dataset.tab = cat.id;
            navBtn.style.setProperty('--rx-cat-color', cat.color);
            const navIcon = document.createElement('span');
            navIcon.className = 'rx-m-nav-icon';
            navIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">${cat.icon}</svg>`;
            const navLabel = document.createElement('span');
            navLabel.textContent = cat.label;
            const mainFeats = cat.features.filter(f => !f.parent);
            const enabledCount = mainFeats.filter(f => Settings.get(f.id)).length;
            const navCount = document.createElement('span');
            navCount.className = 'rx-m-nav-count';
            navCount.textContent = `${enabledCount}/${mainFeats.length}`;
            navBtn.append(navIcon, navLabel, navCount);
            navBtn.addEventListener('click', () => this._switchTab(cat.id));
            sidebar.appendChild(navBtn);
            this._navBtns.push(navBtn);

            // Pane
            const pane = this._buildPane(cat);
            if (i === 0) pane.classList.add('active');
            content.appendChild(pane);
        }

        body.append(sidebar, content);
        modal.appendChild(body);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'rx-m-footer';
        footer.innerHTML = `
            <div class="rx-m-footer-left">
                <span class="rx-m-version">v${VERSION}</span>
                <span class="rx-m-shortcut">Ctrl+Shift+X</span>
            </div>
            <div class="rx-m-footer-right"></div>`;
        const exportBtn = document.createElement('button');
        exportBtn.className = 'rx-m-btn rx-m-btn-primary';
        exportBtn.textContent = 'Export';
        exportBtn.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(Settings._cache, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = 'rumblex-settings.json'; a.click();
            URL.revokeObjectURL(a.href);
        });
        const importBtn = document.createElement('button');
        importBtn.className = 'rx-m-btn rx-m-btn-secondary';
        importBtn.textContent = 'Import';
        importBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.addEventListener('change', () => {
                const file = input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const data = JSON.parse(reader.result);
                        Object.assign(Settings._cache, data);
                        chrome.storage.local.set({ rx_settings: Settings._cache });
                        location.reload();
                    } catch (e) { console.error('[RumbleX] Import failed:', e); }
                };
                reader.readAsText(file);
            });
            input.click();
        });
        footer.querySelector('.rx-m-footer-right').append(importBtn, exportBtn);
        modal.appendChild(footer);

        this._panelEl = modal;

        // Toolbar (FAB buttons)
        const toolbar = document.createElement('div');
        toolbar.id = 'rx-toolbar';
        const homeBtn = document.createElement('a');
        homeBtn.id = 'rx-home-btn';
        homeBtn.className = 'rx-tb-btn';
        homeBtn.href = Settings.get('logoToFeed') ? 'https://rumble.com/subscriptions' : 'https://rumble.com/';
        homeBtn.title = Settings.get('logoToFeed') ? 'My Feed' : 'Rumble Home';
        homeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 3C4.015 3 2 5.015 2 7.5v9C2 18.985 4.015 21 6.5 21h11c2.485 0 4.5-2.015 4.5-4.5v-9C22 5.015 19.985 3 17.5 3h-11zm3.25 4.5c.69 0 1.25.56 1.25 1.25v1.5l2.5-2.25c.33-.3.76-.5 1.22-.5h.78c.97 0 1.45 1.17.77 1.85L13.5 12l2.72 2.65c.68.68.2 1.85-.77 1.85h-.78c-.46 0-.89-.18-1.22-.5L11 13.75v1.5c0 .69-.56 1.25-1.25 1.25S8.5 15.94 8.5 15.25v-7.5c0-.69.56-1.25 1.25-1.25z" fill="#85d551"/></svg>';
        toolbar.appendChild(homeBtn);

        if (Page.isWatch() && Settings.get('videoDownload')) {
            const dlBtn = document.createElement('button');
            dlBtn.id = 'rx-download-btn'; dlBtn.className = 'rx-tb-btn'; dlBtn.title = 'Download Video';
            dlBtn.innerHTML = VideoDownloader._downloadSVG;
            dlBtn.addEventListener('click', () => VideoDownloader._showDownloadTab());
            toolbar.appendChild(dlBtn);
        }

        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'rx-settings-btn'; settingsBtn.className = 'rx-tb-btn'; settingsBtn.title = 'RumbleX Settings';
        settingsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';
        settingsBtn.addEventListener('click', () => this._toggle());
        toolbar.appendChild(settingsBtn);
        this._toolbarEl = toolbar;

        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
                e.preventDefault(); this._toggle();
            }
            if (e.key === 'Escape' && document.body.classList.contains('rx-panel-open')) {
                this._close();
            }
        });
    },

    _toggle() {
        document.body.classList.toggle('rx-panel-open');
    },

    _close() {
        document.body.classList.remove('rx-panel-open');
    },

    _switchTab(catId) {
        for (const btn of this._navBtns) btn.classList.toggle('active', btn.dataset.tab === catId);
        for (const pane of this._contentEl.querySelectorAll('.rx-m-pane')) {
            pane.classList.toggle('active', pane.id === 'rx-pane-' + catId);
        }
    },

    _filterSearch(query) {
        query = query.toLowerCase().trim();
        const allPanes = this._contentEl.querySelectorAll('.rx-m-pane');
        const allCards = this._contentEl.querySelectorAll('.rx-m-card');

        if (!query) {
            allCards.forEach(c => c.style.display = '');
            allPanes.forEach(p => p.style.display = '');
            // Restore first active
            const activeBtn = this._navBtns.find(b => b.classList.contains('active'));
            allPanes.forEach(p => p.classList.remove('active'));
            if (activeBtn) {
                const pane = this._contentEl.querySelector('#rx-pane-' + activeBtn.dataset.tab);
                if (pane) pane.classList.add('active');
            }
            return;
        }

        // Show all panes, filter cards
        allPanes.forEach(p => { p.classList.add('active'); p.style.display = ''; });
        let anyMatch = false;
        allCards.forEach(card => {
            const text = card.dataset.searchText || '';
            const match = text.includes(query);
            card.style.display = match ? '' : 'none';
            if (match) anyMatch = true;
        });

        // Hide panes with zero visible cards
        allPanes.forEach(pane => {
            const visible = pane.querySelectorAll('.rx-m-card:not([style*="display: none"])').length;
            if (visible === 0) pane.style.display = 'none';
        });
    },

    init() {
        this._styleEl = injectStyle(this._css, 'rx-settings-css');
        this._build();
        document.body.appendChild(this._overlayEl);
        document.body.appendChild(this._panelEl);
        document.body.appendChild(this._toolbarEl);
    },

    destroy() {
        this._styleEl?.remove();
        this._overlayEl?.remove();
        this._panelEl?.remove();
        this._toolbarEl?.remove();
        this._toastEl?.remove();
        clearTimeout(this._toastTimer);
        this._styleEl = null;
        this._overlayEl = null;
        this._panelEl = null;
        this._toolbarEl = null;
        this._toastEl = null;
        this._navBtns = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Full Titles (no truncation)
// ═══════════════════════════════════════════
const FullTitles = {
    id: 'fullTitles',
    name: 'Full Titles',
    _styleEl: null,
    _css: `
        html.rumblex-active .thumbnail__title,
        html.rumblex-active .videostream__title,
        html.rumblex-active .mediaList-heading,
        html.rumblex-active .media-item__title,
        html.rumblex-active h3.thumbnail__title {
            -webkit-line-clamp: unset !important;
            line-clamp: unset !important;
            display: block !important;
            overflow: visible !important;
            white-space: normal !important;
            text-overflow: clip !important;
            max-height: none !important;
        }
    `,
    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-fulltitles-css');
    },
    destroy() { this._styleEl?.remove(); }
};

// ═══════════════════════════════════════════
//  FEATURE: Title Font Override
// ═══════════════════════════════════════════
const TitleFont = {
    id: 'titleFont',
    name: 'Title Font',
    _styleEl: null,
    _css: `
        html.rumblex-active .thumbnail__title,
        html.rumblex-active .videostream__title,
        html.rumblex-active .mediaList-heading,
        html.rumblex-active .video-header-container__title,
        html.rumblex-active h1.video-header-container__title {
            font-weight: 500 !important;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif !important;
            letter-spacing: 0 !important;
        }
    `,
    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-titlefont-css');
    },
    destroy() { this._styleEl?.remove(); }
};

// ═══════════════════════════════════════════
//  FEATURE: Unique Chatters / Message Count
// ═══════════════════════════════════════════
const UniqueChatters = {
    id: 'uniqueChatters',
    name: 'Unique Chatters',
    _styleEl: null,
    _obs: null,
    _bar: null,
    _users: null,
    _msgCount: 0,

    _css: `
        .rx-chatter-bar {
            display: flex; gap: 14px; padding: 6px 10px;
            background: rgba(30,30,46,0.85);
            border-bottom: 1px solid rgba(255,255,255,0.05);
            font: 600 11px/1 system-ui, sans-serif;
            color: #cdd6f4; flex-shrink: 0;
        }
        .rx-chatter-bar .rx-cb-label { color: #a6adc8; font-weight: 500; }
        .rx-chatter-bar .rx-cb-val { color: var(--rx-accent, #89b4fa); }
    `,

    _msgSel: '#chat-history-list li, .chat--message-container',

    _rescan() {
        this._users = new Set();
        this._msgCount = 0;
        for (const m of qsa(this._msgSel)) {
            const u = rxReadUsername(m);
            if (u) { this._users.add(u); this._msgCount++; }
        }
        this._paint();
    },

    _paint() {
        if (!this._bar) return;
        this._bar.querySelector('.rx-cb-users').textContent = this._users?.size || 0;
        this._bar.querySelector('.rx-cb-msgs').textContent = this._msgCount;
    },

    _mount(chatEl) {
        if (this._bar) return;
        const bar = document.createElement('div');
        bar.className = 'rx-chatter-bar';
        bar.innerHTML = `
            <span><span class="rx-cb-label">Chatters:</span> <span class="rx-cb-val rx-cb-users">0</span></span>
            <span><span class="rx-cb-label">Messages:</span> <span class="rx-cb-val rx-cb-msgs">0</span></span>`;
        chatEl.parentNode?.insertBefore(bar, chatEl);
        this._bar = bar;
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-chatters-css');
        waitFor('#chat-history-list').then((chatEl) => {
            this._mount(chatEl);
            this._rescan();
            // Debounce — a full re-scan on every message mutation is O(n) and
            // high-traffic streams can fire many mutations per second.
            this._obs = new MutationObserver(() => {
                clearTimeout(this._t);
                this._t = setTimeout(() => this._rescan(), 250);
            });
            this._obs.observe(chatEl, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        clearTimeout(this._t);
        this._bar?.remove();
        this._bar = null;
    }
};

// ═══════════════════════════════════════════
//  Shared chat helpers (used by ChatUserBlock / UniqueChatters / ChatExport)
// ═══════════════════════════════════════════
// Defensive username reader: honour data-username first, otherwise read the
// element's own text BUT strip any RX-injected children (block button, rant
// badge). Without this, ChatUserBlock's own button text would be appended to
// the username and break exact-match blocking.
function rxReadUsername(msg) {
    const el = msg.querySelector('.chat-history--username, .chat--message-username, [data-username]');
    if (!el) return null;
    if (el.dataset && el.dataset.username) return el.dataset.username.trim().toLowerCase();
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.rx-chat-block-btn, .rx-rant-persist-badge').forEach((n) => n.remove());
    return (clone.textContent || '').trim().toLowerCase();
}

// ═══════════════════════════════════════════
//  FEATURE: Chat User Block (per-user hide)
// ═══════════════════════════════════════════
const ChatUserBlock = {
    id: 'chatUserBlock',
    name: 'Chat User Block',
    _styleEl: null,
    _obs: null,

    _css: `
        .rx-blocked-msg { display: none !important; }
        /* Rendered inline AFTER the username element so username readers don't
           see the button's text. Shown only on hover. */
        .rx-chat-block-btn {
            margin-left: 6px; cursor: pointer; opacity: 0; transition: opacity .15s;
            font: 600 9px/1.4 system-ui, sans-serif; color: #f38ba8;
            background: rgba(243,139,168,0.1); border: 1px solid rgba(243,139,168,0.3);
            border-radius: 4px; padding: 1px 5px; vertical-align: baseline;
        }
        #chat-history-list li:hover .rx-chat-block-btn,
        .chat--message-container:hover .rx-chat-block-btn { opacity: 1; }
        .rx-chat-block-btn:hover { background: rgba(243,139,168,0.25); }
    `,

    _blocked() {
        return new Set((Settings.get('blockedChatters') || []).map((u) => String(u).toLowerCase()));
    },

    _process() {
        const blocked = this._blocked();
        const sel = '#chat-history-list li, .chat--message-container';
        for (const msg of qsa(sel)) {
            const u = rxReadUsername(msg);
            if (!u) continue;
            msg.classList.toggle('rx-blocked-msg', blocked.has(u));
            if (msg.dataset.rxBlockBtn) continue;
            const nameEl = msg.querySelector('.chat-history--username, .chat--message-username');
            if (!nameEl) continue; // retry on next tick — don't mark as processed yet
            msg.dataset.rxBlockBtn = '1';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rx-chat-block-btn';
            btn.textContent = 'block';
            btn.title = `Block ${u} in chat`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const list = Settings.get('blockedChatters') || [];
                if (!list.map((x) => String(x).toLowerCase()).includes(u)) {
                    list.push(u);
                    Settings.set('blockedChatters', list);
                }
                this._process();
            });
            // Insert AFTER the username element, not inside it, so other modules
            // (rxReadUsername / ChatExport) don't read "username block" as the name.
            nameEl.insertAdjacentElement('afterend', btn);
        }
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-chatuserblock-css');
        waitFor('#chat-history-list').then((chatEl) => {
            this._process();
            this._obs = new MutationObserver(() => this._process());
            this._obs.observe(chatEl, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Chat Spam Dedup
// ═══════════════════════════════════════════
const ChatSpamDedup = {
    id: 'chatSpamDedup',
    name: 'Chat Spam Dedup',
    _styleEl: null,
    _obs: null,
    _last: [],
    _MAX_WINDOW: 30,

    _css: `.rx-spam-dup { display: none !important; }`,

    _textOf(msg) {
        const el = msg.querySelector('.chat--message-text, .chat--message, .chat-history--message');
        return (el ? el.textContent : msg.textContent || '').trim().toLowerCase();
    },

    _process() {
        for (const msg of qsa('#chat-history-list li, .chat--message-container')) {
            if (msg.dataset.rxDedupSeen) continue;
            msg.dataset.rxDedupSeen = '1';
            const t = this._textOf(msg);
            if (t && t.length >= 3 && this._last.includes(t)) {
                msg.classList.add('rx-spam-dup');
            }
            this._last.push(t);
            if (this._last.length > this._MAX_WINDOW) this._last.shift();
        }
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-spamdedup-css');
        waitFor('#chat-history-list').then(chatEl => {
            this._process();
            this._obs = new MutationObserver(() => this._process());
            this._obs.observe(chatEl, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._last = [];
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Chat Export
// ═══════════════════════════════════════════
const ChatExport = {
    id: 'chatExport',
    name: 'Chat Export',
    _styleEl: null,
    _btn: null,

    _css: `
        .rx-chat-export-btn {
            background: rgba(49,50,68,0.5); border: 1px solid rgba(137,180,250,0.25);
            color: #cdd6f4; border-radius: 6px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif; margin-left: 6px;
            transition: background .15s, border-color .15s;
        }
        .rx-chat-export-btn:hover { background: rgba(49,50,68,0.8); border-color: rgba(137,180,250,0.5); }
    `,

    _collect() {
        const out = [];
        for (const msg of qsa('#chat-history-list li, .chat--message-container')) {
            if (msg.classList.contains('rx-blocked-msg') || msg.classList.contains('rx-spam-dup')) continue;
            const textEl = msg.querySelector('.chat--message-text, .chat-history--message');
            const timeEl = msg.querySelector('.chat-history--timestamp, time');
            const rantEl = msg.querySelector('.chat-history--rant-price');
            // Use the shared reader so RX-injected button/badge text doesn't
            // leak into the exported username.
            const user = rxReadUsername(msg) || '';
            // For readable text, strip known RX classes the same way.
            let text = '';
            if (textEl) text = textEl.textContent.trim();
            else {
                const cl = msg.cloneNode(true);
                cl.querySelectorAll('.rx-chat-block-btn, .rx-rant-persist-badge').forEach((n) => n.remove());
                text = (cl.textContent || '').trim();
            }
            out.push({
                time: timeEl ? timeEl.textContent.trim() : '',
                user,
                text,
                rant: rantEl ? rantEl.textContent.trim() : null,
            });
        }
        return out;
    },

    _download(format) {
        const msgs = this._collect();
        const title = (qs('.video-header-container__title') || qs('h1'))?.textContent?.trim() || 'rumble';
        const safe = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 80);
        let blob;
        if (format === 'json') {
            blob = new Blob([JSON.stringify(msgs, null, 2)], { type: 'application/json' });
        } else {
            const txt = msgs.map(m => `[${m.time}] ${m.user}${m.rant ? ' (' + m.rant + ')' : ''}: ${m.text}`).join('\n');
            blob = new Blob([txt], { type: 'text/plain' });
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${safe} - chat.${format === 'json' ? 'json' : 'txt'}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    },

    _mount() {
        const header = qs('.chat--header');
        if (!header || qs('.rx-chat-export-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'rx-chat-export-btn';
        btn.textContent = 'Export';
        btn.title = 'Export chat (click: TXT, shift-click: JSON)';
        btn.addEventListener('click', (e) => this._download(e.shiftKey ? 'json' : 'txt'));
        header.appendChild(btn);
        this._btn = btn;
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-chatexport-css');
        waitFor('.chat--header').then(() => this._mount()).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Rant Persist (keep rants past expiry + export)
// ═══════════════════════════════════════════
const RantPersist = {
    id: 'rantPersist',
    name: 'Rant Persist',
    _styleEl: null,
    _obs: null,
    _cached: [],

    _css: `
        .chat-history--rant.rx-rant-persist {
            animation: none !important;
            opacity: 1 !important;
            filter: none !important;
            display: flex !important;
            visibility: visible !important;
        }
        .rx-rant-persist-badge {
            display: inline-block; margin-left: 6px; padding: 1px 5px;
            background: rgba(249,226,175,0.15); color: #f9e2af;
            border-radius: 4px; font: 600 9px/1.4 system-ui, sans-serif;
        }
        .rx-rant-export-btn {
            position: absolute; top: 4px; right: 4px;
            background: rgba(30,30,46,0.9); border: 1px solid rgba(249,226,175,0.3);
            color: #f9e2af; border-radius: 5px; padding: 2px 8px; cursor: pointer;
            font: 600 10px/1 system-ui, sans-serif; opacity: 0.8;
        }
        .rx-rant-export-btn:hover { opacity: 1; }
    `,

    _MAX_PER_VIDEO: 500,
    _MAX_KEPT_VIDEOS: 100,

    _videoKey() {
        const m = location.pathname.match(/^\/(v[a-z0-9]+)/);
        return m ? 'rx_rants_' + m[1] : null;
    },

    // Keep localStorage growth bounded. Same pattern as WatchProgress /
    // WatchHistory: prune the oldest rx_rants_* keys when we exceed the cap.
    _pruneGlobal() {
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('rx_rants_')) keys.push(k);
            }
            if (keys.length <= this._MAX_KEPT_VIDEOS) return;
            // Sort by max ts in each entry (fallback to 0). Oldest first.
            const scored = keys.map((k) => {
                let maxTs = 0;
                try {
                    const arr = JSON.parse(localStorage.getItem(k)) || [];
                    for (const e of arr) if (e && e.ts > maxTs) maxTs = e.ts;
                } catch {}
                return { k, maxTs };
            }).sort((a, b) => a.maxTs - b.maxTs);
            const drop = scored.slice(0, keys.length - this._MAX_KEPT_VIDEOS);
            for (const { k } of drop) localStorage.removeItem(k);
        } catch {}
    },

    _cache(rantEl) {
        const priceEl = rantEl.querySelector('.chat-history--rant-price');
        const userEl = rantEl.querySelector('.chat-history--username');
        const textEl = rantEl.querySelector('.chat--message, .chat-history--message');
        const level = rantEl.getAttribute('data-level') || '1';
        // Strip RX-injected children when reading the username so the cache
        // stores the real chatter name (consistent with rxReadUsername).
        let user = '';
        if (userEl) {
            const clone = userEl.cloneNode(true);
            clone.querySelectorAll('.rx-chat-block-btn, .rx-rant-persist-badge').forEach((n) => n.remove());
            user = (clone.textContent || '').trim();
        }
        const entry = {
            price: priceEl ? priceEl.textContent.trim() : '',
            user,
            text: textEl ? textEl.textContent.trim() : '',
            level, ts: Date.now(),
        };
        if (this._cached.some((c) => c.user === entry.user && c.text === entry.text && c.price === entry.price)) return;
        this._cached.push(entry);
        // Cap per-video so one stream can't hog localStorage on its own.
        if (this._cached.length > this._MAX_PER_VIDEO) {
            this._cached.splice(0, this._cached.length - this._MAX_PER_VIDEO);
        }
        const key = this._videoKey();
        if (!key) return;
        try {
            localStorage.setItem(key, JSON.stringify(this._cached));
        } catch {
            // QuotaExceeded — prune and retry once
            this._pruneGlobal();
            try { localStorage.setItem(key, JSON.stringify(this._cached)); } catch {}
        }
    },

    _persist() {
        for (const r of qsa('.chat-history--rant')) {
            if (r.dataset.rxPersisted) {
                if (!r.classList.contains('rx-rant-persist')) r.classList.add('rx-rant-persist');
                continue;
            }
            r.dataset.rxPersisted = '1';
            r.classList.add('rx-rant-persist');
            const userEl = r.querySelector('.chat-history--username');
            if (userEl && !r.querySelector('.rx-rant-persist-badge')) {
                const badge = document.createElement('span');
                badge.className = 'rx-rant-persist-badge';
                badge.textContent = 'RX';
                // Insert as sibling AFTER the username element so username readers
                // in other modules (ChatUserBlock/UniqueChatters/ChatExport) don't
                // pick up the badge text as part of the username.
                userEl.insertAdjacentElement('afterend', badge);
            }
            this._cache(r);
        }
    },

    _export() {
        const blob = new Blob([JSON.stringify(this._cached, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rumble-rants.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-rantpersist-css');
        // Run global prune at most once per page-load to bound growth over time.
        this._pruneGlobal();
        const key = this._videoKey();
        if (key) {
            try {
                const raw = localStorage.getItem(key);
                if (raw) this._cached = JSON.parse(raw) || [];
            } catch {}
        }
        waitFor('#chat-history-list, .chat-history').then(chatEl => {
            this._persist();
            this._obs = new MutationObserver(() => this._persist());
            // childList+subtree is enough — we override fade-out via !important CSS,
            // so we don't need to react to attribute/class changes (expensive).
            this._obs.observe(chatEl, { childList: true, subtree: true });
            const tracker = qs('.rx-rant-tracker');
            if (tracker && !tracker.querySelector('.rx-rant-export-btn')) {
                const btn = document.createElement('button');
                btn.className = 'rx-rant-export-btn';
                btn.textContent = 'Export';
                btn.addEventListener('click', () => this._export());
                tracker.style.position = 'relative';
                tracker.appendChild(btn);
            }
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Comment Sort
// ═══════════════════════════════════════════
const CommentSort = {
    id: 'commentSort',
    name: 'Comment Sort',
    _styleEl: null,
    _bar: null,

    _css: `
        .rx-comment-sort-bar {
            display: flex; gap: 6px; padding: 8px 0; margin-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .rx-comment-sort-btn {
            background: rgba(49,50,68,0.4); border: 1px solid rgba(255,255,255,0.06);
            color: #a6adc8; border-radius: 14px; padding: 4px 12px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif; transition: all .15s;
        }
        .rx-comment-sort-btn:hover { background: rgba(49,50,68,0.8); }
        .rx-comment-sort-btn.active {
            background: rgba(137,180,250,0.15); color: var(--rx-accent, #89b4fa);
            border-color: rgba(137,180,250,0.4);
        }
    `,

    // Looks at the item's direct vote widget only — not nested replies'.
    _parseVotes(item) {
        const widget = item.querySelector(':scope > .comment-actions, :scope > .comments-meta, :scope .comment-actions')
            || item;
        const up = widget.querySelector('.comment-vote-count, .rumbles-vote--value');
        if (!up) return 0;
        const n = parseInt((up.textContent || '0').replace(/[^\d-]/g, ''), 10);
        return Number.isFinite(n) ? n : 0;
    },

    _parseTime(item) {
        const t = item.querySelector('time, .comment-meta--time');
        if (!t) return 0;
        const dt = t.getAttribute('datetime') || t.dataset?.time;
        if (dt) { const n = Date.parse(dt); if (!Number.isNaN(n)) return n; }
        return 0;
    },

    // Sort only TOP-LEVEL comments. Nested replies stay in place under each
    // parent so the thread structure is preserved.
    _sort(mode) {
        const container = qs('#video-comments, .media-page-comments-container');
        if (!container) return;
        // Rumble typically puts comments inside `<ul>` — top-level items are
        // direct children of that list. Fall back to the container itself.
        const listRoot = container.querySelector(':scope > ul') || container;
        const items = Array.from(
            listRoot.querySelectorAll(':scope > li.comment-item[data-comment-id], :scope > li.comment-item')
        );
        if (items.length < 2) return;
        const scored = items.map((el) => ({
            el, votes: this._parseVotes(el), time: this._parseTime(el),
        }));
        if (mode === 'top') scored.sort((a, b) => b.votes - a.votes);
        else if (mode === 'new') scored.sort((a, b) => b.time - a.time);
        else if (mode === 'old') scored.sort((a, b) => a.time - b.time);
        else if (mode === 'controversial') scored.sort((a, b) => Math.abs(a.votes) - Math.abs(b.votes));
        const frag = document.createDocumentFragment();
        for (const s of scored) frag.appendChild(s.el);
        listRoot.appendChild(frag);
    },

    _mount() {
        const container = qs('#video-comments, .media-page-comments-container');
        if (!container || qs('.rx-comment-sort-bar')) return;
        const bar = document.createElement('div');
        bar.className = 'rx-comment-sort-bar';
        const modes = [
            { id: 'top', label: 'Top' },
            { id: 'new', label: 'New' },
            { id: 'old', label: 'Oldest' },
            { id: 'controversial', label: 'Controversial' },
        ];
        for (const m of modes) {
            const btn = document.createElement('button');
            btn.className = 'rx-comment-sort-btn';
            btn.textContent = m.label;
            btn.addEventListener('click', () => {
                for (const b of bar.querySelectorAll('.rx-comment-sort-btn')) b.classList.remove('active');
                btn.classList.add('active');
                this._sort(m.id);
            });
            bar.appendChild(btn);
        }
        container.prepend(bar);
        this._bar = bar;
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-commentsort-css');
        waitFor('#video-comments, .media-page-comments-container').then(() => {
            setTimeout(() => this._mount(), 1200);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._bar?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Popout Chat
// ═══════════════════════════════════════════
const PopoutChat = {
    id: 'popoutChat',
    name: 'Popout Chat',
    _styleEl: null,
    _btn: null,

    _css: `
        .rx-popout-chat-btn {
            background: rgba(49,50,68,0.5); border: 1px solid rgba(137,180,250,0.25);
            color: #cdd6f4; border-radius: 6px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif; margin-left: 6px;
            transition: background .15s, border-color .15s;
        }
        .rx-popout-chat-btn:hover { background: rgba(49,50,68,0.8); border-color: rgba(137,180,250,0.5); }
    `,

    _popout() {
        // Prefer Rumble's own chat popup control if the page exposes it —
        // clicking it toggles the native in-page popup chat overlay.
        const native = qs('#chat-toggle-popup');
        if (native instanceof HTMLElement) {
            native.click();
            return;
        }
        // If the page exposes an explicit chat popout link/anchor, open it.
        const link = qs('a[href*="chat/popup" i], a[href*="chat_popout" i]');
        if (link instanceof HTMLAnchorElement && link.href) {
            window.open(link.href, 'rumblex_chat_popout', 'width=420,height=720,resizable=yes,scrollbars=yes');
            return;
        }
        // Last-resort fallback: open the current watch URL in a narrow window.
        // Not a true chat-only window, but at least it doesn't 404 on users.
        window.open(location.href, 'rumblex_chat_popout', 'width=460,height=820,resizable=yes,scrollbars=yes');
    },

    _mount() {
        const header = qs('.chat--header');
        if (!header || qs('.rx-popout-chat-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'rx-popout-chat-btn';
        btn.textContent = 'Popout';
        btn.title = 'Open chat in separate window';
        btn.addEventListener('click', () => this._popout());
        header.appendChild(btn);
        this._btn = btn;
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-popoutchat-css');
        waitFor('.chat--header').then(() => this._mount()).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Keyword Filter (hide videos by title keyword)
// ═══════════════════════════════════════════
const KeywordFilter = {
    id: 'keywordFilter',
    name: 'Keyword Filter',
    _styleEl: null,
    _obs: null,

    _css: `.rx-kw-hidden { display: none !important; }`,

    _keywords() {
        return (Settings.get('blockedKeywords') || []).map(k => k.toLowerCase()).filter(Boolean);
    },

    _process() {
        const kws = this._keywords();
        if (!kws.length) {
            for (const el of qsa('.rx-kw-hidden')) el.classList.remove('rx-kw-hidden');
            return;
        }
        const cards = qsa('.videostream, .video-item, article.video-item, .mediaList-item, .thumbnail__grid-item');
        for (const card of cards) {
            const titleEl = card.querySelector(
                '.thumbnail__title, .videostream__title, .mediaList-heading, .media-item__title'
            );
            if (!titleEl) {
                // No title element — leave the card alone rather than match
                // against the entire card text (which would false-positive on
                // channel names, view counts, timestamps, etc).
                card.classList.remove('rx-kw-hidden');
                continue;
            }
            const t = titleEl.textContent.toLowerCase();
            const hit = kws.some((k) => k.length > 0 && t.includes(k));
            card.classList.toggle('rx-kw-hidden', hit);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-keywordfilter-css');
        this._process();
        this._obs = new MutationObserver(() => {
            clearTimeout(this._t);
            this._t = setTimeout(() => this._process(), 150);
        });
        this._obs.observe(document.body, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        clearTimeout(this._t);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Autoplay Scheduler / Queue
// ═══════════════════════════════════════════
const AutoplayScheduler = {
    id: 'autoplayScheduler',
    name: 'Autoplay Scheduler',
    _styleEl: null,
    _panel: null,
    _endHandler: null,

    _css: `
        .rx-queue-fab {
            position: fixed; bottom: 20px; right: 74px; z-index: 10008;
            width: 42px; height: 42px; border-radius: 50%;
            background: rgba(30,30,46,0.9); border: 1px solid rgba(137,180,250,0.25);
            color: rgba(255,255,255,0.7); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .rx-queue-fab:hover { border-color: rgba(137,180,250,0.6); }
        html.rx-theater .rx-queue-fab { display: none; }
        .rx-queue-panel {
            position: fixed; bottom: 76px; right: 20px; z-index: 10009;
            width: 320px; max-height: 420px; overflow-y: auto;
            background: rgba(17,17,27,0.98); border: 1px solid rgba(137,180,250,0.2);
            border-radius: 12px; padding: 12px;
            color: #cdd6f4; font: 12px system-ui, sans-serif;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            backdrop-filter: blur(16px); display: none;
        }
        .rx-queue-panel.open { display: block; }
        .rx-queue-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .rx-queue-title { font-weight: 700; font-size: 13px; color: #f0f0f0; }
        .rx-queue-add {
            display: flex; gap: 6px; margin-bottom: 8px;
        }
        .rx-queue-add input {
            flex: 1; background: rgba(49,50,68,0.5); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 6px; padding: 5px 8px; color: #cdd6f4; font-size: 11px; outline: none;
        }
        .rx-queue-add button {
            background: rgba(137,180,250,0.15); border: 1px solid rgba(137,180,250,0.3);
            color: var(--rx-accent, #89b4fa); border-radius: 6px; padding: 4px 10px;
            cursor: pointer; font-weight: 600; font-size: 11px;
        }
        .rx-queue-item {
            display: flex; align-items: center; gap: 6px; padding: 6px;
            border-radius: 6px; margin-bottom: 4px; background: rgba(49,50,68,0.3);
        }
        .rx-queue-item .rx-qi-url { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
        .rx-queue-item button {
            background: transparent; border: none; color: #f38ba8; cursor: pointer; font-size: 14px;
        }
        .rx-queue-empty { padding: 16px; text-align: center; color: #6c7086; font-size: 11px; }
    `,

    _queue() {
        return Settings.get('autoplayQueue') || [];
    },

    _saveQueue(q) {
        Settings.set('autoplayQueue', q);
    },

    _addCurrent() {
        const q = this._queue();
        if (!q.includes(location.href)) {
            q.push(location.href);
            this._saveQueue(q);
            this._renderList();
        }
    },

    _addUrl(url) {
        url = (url || '').trim();
        if (!url || !/^https:\/\/(www\.)?rumble\.com\//.test(url)) return;
        const q = this._queue();
        if (!q.includes(url)) {
            q.push(url);
            this._saveQueue(q);
            this._renderList();
        }
    },

    _playNext() {
        const q = this._queue();
        if (!q.length) return;
        const next = q.shift();
        this._saveQueue(q);
        location.href = next;
    },

    _renderList() {
        if (!this._panel) return;
        const list = this._panel.querySelector('.rx-queue-list');
        const q = this._queue();
        list.innerHTML = '';
        if (!q.length) {
            list.innerHTML = '<div class="rx-queue-empty">Queue is empty. Add video URLs above.</div>';
            return;
        }
        q.forEach((url, i) => {
            const row = document.createElement('div');
            row.className = 'rx-queue-item';
            const span = document.createElement('span');
            span.className = 'rx-qi-url';
            span.textContent = url.replace('https://rumble.com/', '');
            const del = document.createElement('button');
            del.textContent = '×';
            del.title = 'Remove';
            del.addEventListener('click', () => {
                const nq = this._queue();
                nq.splice(i, 1);
                this._saveQueue(nq);
                this._renderList();
            });
            row.append(span, del);
            list.appendChild(row);
        });
    },

    _build() {
        const fab = document.createElement('button');
        fab.className = 'rx-queue-fab';
        fab.title = 'Autoplay Queue';
        fab.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="14" y2="18"/><polygon points="18 15 24 18 18 21" fill="currentColor"/></svg>';
        document.body.appendChild(fab);

        const panel = document.createElement('div');
        panel.className = 'rx-queue-panel';
        panel.innerHTML = `
            <div class="rx-queue-header">
                <span class="rx-queue-title">Autoplay Queue</span>
                <button class="rx-queue-add-current" title="Add current video">+ current</button>
            </div>
            <div class="rx-queue-add">
                <input type="text" placeholder="Paste Rumble URL..." />
                <button>Add</button>
            </div>
            <div class="rx-queue-list"></div>`;
        document.body.appendChild(panel);
        this._panel = panel;

        fab.addEventListener('click', () => {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) this._renderList();
        });

        panel.querySelector('.rx-queue-add-current').addEventListener('click', () => {
            if (Page.isWatch()) this._addCurrent();
        });
        const input = panel.querySelector('input');
        const addBtn = panel.querySelector('.rx-queue-add button');
        const doAdd = () => { this._addUrl(input.value); input.value = ''; };
        addBtn.addEventListener('click', doAdd);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });

        // Style buttons in header
        const headerBtn = panel.querySelector('.rx-queue-add-current');
        headerBtn.style.cssText = 'background:rgba(137,180,250,0.15);border:1px solid rgba(137,180,250,0.3);color:var(--rx-accent,#89b4fa);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px;font-weight:600;';
    },

    _hookVideoEnd() {
        const video = qs('video');
        if (!video || video.dataset.rxQueueBound) return;
        video.dataset.rxQueueBound = '1';
        this._endHandler = () => this._playNext();
        video.addEventListener('ended', this._endHandler);
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-autoplayscheduler-css');
        onReady(() => this._build());
        if (Page.isWatch()) {
            waitFor('video', 12000).then(() => this._hookVideoEnd()).catch(() => {});
        }
    },

    destroy() {
        this._styleEl?.remove();
        this._panel?.remove();
        qs('.rx-queue-fab')?.remove();
        const v = qs('video');
        if (v && this._endHandler) v.removeEventListener('ended', this._endHandler);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Chapters (parse description timestamps)
// ═══════════════════════════════════════════
const Chapters = {
    id: 'chapters',
    name: 'Chapters',
    _styleEl: null,
    _markers: null,
    _list: null,
    _chapters: [],
    _obs: null,

    _css: `
        .rx-chapter-markers {
            position: absolute; left: 0; right: 0; bottom: 0;
            height: 4px; pointer-events: none; z-index: 5;
        }
        .rx-chapter-mark {
            position: absolute; top: 0; bottom: 0; width: 2px;
            background: rgba(255,255,255,0.75);
            box-shadow: 0 0 4px rgba(0,0,0,0.5);
            pointer-events: auto; cursor: pointer;
        }
        .rx-chapter-mark:hover { background: #fff; width: 3px; }
        .rx-chapter-tooltip {
            position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.92); color: #fff; padding: 4px 8px;
            border-radius: 4px; font: 600 11px/1.2 system-ui, sans-serif;
            white-space: nowrap; opacity: 0; pointer-events: none;
            transition: opacity .15s;
        }
        .rx-chapter-mark:hover .rx-chapter-tooltip { opacity: 1; }
        .rx-chapters-panel {
            margin: 12px 0; padding: 10px 12px;
            background: rgba(30,30,46,0.5); border: 1px solid rgba(137,180,250,0.12);
            border-radius: 8px;
        }
        .rx-chapters-title {
            font: 700 12px/1 system-ui, sans-serif; color: #a6adc8;
            margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .rx-chapters-list { display: flex; flex-direction: column; gap: 2px; }
        .rx-chapters-item {
            display: flex; gap: 8px; padding: 5px 8px; cursor: pointer;
            border-radius: 5px; font-size: 12px; color: #cdd6f4;
            transition: background .15s;
        }
        .rx-chapters-item:hover { background: rgba(137,180,250,0.1); }
        .rx-chapters-item .rx-ci-time {
            color: var(--rx-accent, #89b4fa); font-weight: 600; font-variant-numeric: tabular-nums;
            min-width: 52px;
        }
    `,

    _tsToSec(ts) {
        const p = ts.split(':').map(n => parseInt(n, 10));
        if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
        if (p.length === 2) return p[0] * 60 + p[1];
        return 0;
    },

    _parseDescription() {
        const desc = qs('.media-description, [data-js="media_description"]');
        if (!desc) return [];
        // innerText honours <br> and display-aware line breaks; fall back to
        // textContent which always exists but mushes everything together.
        const text = desc.innerText || desc.textContent || '';
        const chapters = [];
        const seen = new Set();
        for (const raw of text.split(/\r?\n/)) {
            const line = raw.trim();
            if (!line) continue;
            // Anchored to line start so we don't match incidental timestamps
            // that appear mid-sentence in body text.
            const m = line.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—:.]?\s+(.{1,120})$/);
            if (!m) continue;
            const ts = (m[1] ? m[1] + ':' : '') + m[2] + ':' + m[3];
            const label = (m[4] || '').trim();
            if (!label) continue;
            const time = this._tsToSec(ts);
            const key = time + '|' + label;
            if (seen.has(key)) continue;
            seen.add(key);
            chapters.push({ time, label: label.substring(0, 80) });
        }
        return chapters.sort((a, b) => a.time - b.time);
    },

    _seek(t) {
        const v = qs('video');
        if (v) { v.currentTime = t; v.play().catch(() => {}); }
    },

    _findSeekbar() {
        // Prefer specific seekbar/progress selectors. Do NOT fall back to the
        // video container — overlaying markers on the video frame is wrong
        // and confusing.
        return qs(
            '.video-player-seekbar, .progress-bar__container, [class*="progress-bar"], [class*="seekbar"]'
        );
    },

    _renderMarkers(duration) {
        const bar = this._findSeekbar();
        if (!bar || !duration || !Number.isFinite(duration)) return;
        this._markers?.remove();
        const wrap = document.createElement('div');
        wrap.className = 'rx-chapter-markers';
        for (const c of this._chapters) {
            if (c.time > duration) continue;
            const pct = (c.time / duration) * 100;
            const m = document.createElement('div');
            m.className = 'rx-chapter-mark';
            m.style.left = pct + '%';
            m.title = c.label;
            const tip = document.createElement('div');
            tip.className = 'rx-chapter-tooltip';
            tip.textContent = c.label;
            m.appendChild(tip);
            m.addEventListener('click', (e) => { e.stopPropagation(); this._seek(c.time); });
            wrap.appendChild(m);
        }
        if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
        bar.appendChild(wrap);
        this._markers = wrap;
    },

    _renderPanel() {
        const desc = qs('.media-description-section, .media-description');
        if (!desc || this._list) return;
        const panel = document.createElement('div');
        panel.className = 'rx-chapters-panel';
        panel.innerHTML = `<div class="rx-chapters-title">Chapters (${this._chapters.length})</div><div class="rx-chapters-list"></div>`;
        const list = panel.querySelector('.rx-chapters-list');
        for (const c of this._chapters) {
            const row = document.createElement('div');
            row.className = 'rx-chapters-item';
            const ts = document.createElement('span');
            ts.className = 'rx-ci-time';
            const h = Math.floor(c.time / 3600), mm = Math.floor((c.time % 3600) / 60), ss = c.time % 60;
            ts.textContent = (h ? h + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
            const lbl = document.createElement('span');
            lbl.textContent = c.label;
            row.append(ts, lbl);
            row.addEventListener('click', () => this._seek(c.time));
            list.appendChild(row);
        }
        desc.prepend(panel);
        this._list = panel;
    },

    async _run() {
        const chapters = this._parseDescription();
        if (!chapters.length) return;
        this._chapters = chapters;
        try {
            const v = await waitFor('video', 10000);
            const drawOnce = () => {
                if (!v.duration || isNaN(v.duration)) return;
                this._renderMarkers(v.duration);
                this._renderPanel();
            };
            if (v.duration) drawOnce();
            else v.addEventListener('loadedmetadata', drawOnce, { once: true });
        } catch (e) {}
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-chapters-css');
        waitFor('.media-description, .media-description-section', 10000).then(() => {
            setTimeout(() => this._run(), 800);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._markers?.remove();
        this._list?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: SponsorBlock (local segments, skip sponsors)
// ═══════════════════════════════════════════
const SponsorBlockRX = {
    id: 'sponsorBlock',
    name: 'SponsorBlock',
    _styleEl: null,
    _panel: null,
    _segments: [],
    _skipHandler: null,
    _markerEl: null,

    _css: `
        .rx-sb-markers {
            position: absolute; left: 0; right: 0; bottom: 0; height: 4px;
            pointer-events: none; z-index: 4;
        }
        .rx-sb-segment {
            position: absolute; top: 0; height: 100%;
            background: rgba(255,188,42,0.7); border-radius: 1px;
        }
        .rx-sb-segment.category-intro { background: rgba(137,180,250,0.7); }
        .rx-sb-segment.category-outro { background: rgba(249,226,175,0.7); }
        .rx-sb-segment.category-selfpromo { background: rgba(203,166,247,0.7); }
        .rx-sb-segment.category-sponsor { background: rgba(243,139,168,0.75); }
        .rx-sb-notice {
            position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
            padding: 8px 16px; background: rgba(30,30,46,0.95);
            border: 1px solid rgba(243,139,168,0.4); border-radius: 8px;
            color: #f38ba8; font: 600 12px/1 system-ui, sans-serif;
            z-index: 10020; box-shadow: 0 6px 20px rgba(0,0,0,0.5);
            opacity: 0; transition: opacity .3s;
        }
        .rx-sb-notice.visible { opacity: 1; }

        .rx-sb-panel {
            margin: 8px 0; padding: 10px;
            background: rgba(243,139,168,0.08); border: 1px solid rgba(243,139,168,0.2);
            border-radius: 8px;
        }
        .rx-sb-title { font: 700 11px/1 system-ui, sans-serif; color: #f38ba8; margin-bottom: 6px; text-transform: uppercase; }
        .rx-sb-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
        .rx-sb-btn {
            background: rgba(49,50,68,0.4); border: 1px solid rgba(255,255,255,0.06);
            color: #cdd6f4; border-radius: 5px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif;
        }
        .rx-sb-btn:hover { background: rgba(49,50,68,0.7); }
        .rx-sb-list { display: flex; flex-direction: column; gap: 3px; font-size: 11px; }
        .rx-sb-item {
            display: flex; gap: 6px; align-items: center; padding: 3px 6px;
            background: rgba(49,50,68,0.3); border-radius: 4px;
        }
        .rx-sb-item select {
            background: rgba(30,30,46,0.8); color: #cdd6f4;
            border: 1px solid rgba(255,255,255,0.08); border-radius: 4px;
            font-size: 10px; padding: 1px 4px;
        }
        .rx-sb-item button { background: transparent; border: none; color: #f38ba8; cursor: pointer; }
    `,

    _videoKey() {
        const m = location.pathname.match(/^\/(v[a-z0-9]+)/);
        return m ? m[1] : null;
    },

    _loadSegments() {
        const key = this._videoKey();
        if (!key) return;
        const all = Settings.get('sponsorSegments') || {};
        this._segments = all[key] || [];
    },

    _saveSegments() {
        const key = this._videoKey();
        if (!key) return;
        const all = Settings.get('sponsorSegments') || {};
        all[key] = this._segments;
        Settings.set('sponsorSegments', all);
    },

    _fmt(t) {
        t = Math.max(0, Math.floor(t));
        const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
        return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    },

    _notice(msg) {
        let el = qs('.rx-sb-notice');
        if (!el) {
            el = document.createElement('div');
            el.className = 'rx-sb-notice';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('visible');
        clearTimeout(this._noticeT);
        this._noticeT = setTimeout(() => el.classList.remove('visible'), 2200);
    },

    _findSeekbar() {
        return qs(
            '.video-player-seekbar, .progress-bar__container, [class*="progress-bar"], [class*="seekbar"]'
        );
    },

    _renderMarkers(duration) {
        const bar = this._findSeekbar();
        if (!bar || !duration || !Number.isFinite(duration)) return;
        this._markerEl?.remove();
        const wrap = document.createElement('div');
        wrap.className = 'rx-sb-markers';
        for (const s of this._segments) {
            const seg = document.createElement('div');
            seg.className = 'rx-sb-segment category-' + (s.category || 'sponsor');
            seg.style.left = (s.start / duration * 100) + '%';
            seg.style.width = Math.max(0.3, (s.end - s.start) / duration * 100) + '%';
            seg.title = `${s.category}: ${this._fmt(s.start)} → ${this._fmt(s.end)}`;
            wrap.appendChild(seg);
        }
        if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
        bar.appendChild(wrap);
        this._markerEl = wrap;
    },

    _attachSkip() {
        const v = qs('video');
        if (!v || v.dataset.rxSbBound) return;
        v.dataset.rxSbBound = '1';
        this._skipHandler = () => {
            const t = v.currentTime;
            for (const s of this._segments) {
                if (t >= s.start && t < s.end - 0.5) {
                    v.currentTime = s.end;
                    this._notice(`Skipped ${s.category}`);
                    return;
                }
            }
        };
        v.addEventListener('timeupdate', this._skipHandler);
        v.addEventListener('loadedmetadata', () => this._renderMarkers(v.duration), { once: true });
        if (v.duration) this._renderMarkers(v.duration);
    },

    _addSegment(start, end, category = 'sponsor') {
        if (end <= start) return;
        this._segments.push({ start, end, category });
        this._segments.sort((a, b) => a.start - b.start);
        this._saveSegments();
        this._refreshPanel();
        const v = qs('video');
        if (v?.duration) this._renderMarkers(v.duration);
    },

    _refreshPanel() {
        if (!this._panel) return;
        const list = this._panel.querySelector('.rx-sb-list');
        list.innerHTML = '';
        if (!this._segments.length) {
            list.innerHTML = '<div style="color:#6c7086;font-size:11px;padding:4px;">No segments yet. Use Mark Start / Mark End.</div>';
            return;
        }
        this._segments.forEach((s, i) => {
            const row = document.createElement('div');
            row.className = 'rx-sb-item';
            const range = document.createElement('span');
            range.style.flex = '1';
            range.textContent = `${this._fmt(s.start)} → ${this._fmt(s.end)}`;
            const sel = document.createElement('select');
            for (const c of ['sponsor', 'intro', 'outro', 'selfpromo', 'interaction']) {
                const o = document.createElement('option'); o.value = c; o.textContent = c;
                if (c === (s.category || 'sponsor')) o.selected = true;
                sel.appendChild(o);
            }
            sel.addEventListener('change', () => { s.category = sel.value; this._saveSegments(); });
            const del = document.createElement('button');
            del.textContent = '×';
            del.addEventListener('click', () => {
                this._segments.splice(i, 1);
                this._saveSegments();
                this._refreshPanel();
                const v = qs('video');
                if (v?.duration) this._renderMarkers(v.duration);
            });
            row.append(range, sel, del);
            list.appendChild(row);
        });
    },

    _renderPanel() {
        const host = qs('.media-description-section, .media-description');
        if (!host || this._panel) return;
        const panel = document.createElement('div');
        panel.className = 'rx-sb-panel';
        panel.innerHTML = `
            <div class="rx-sb-title">SponsorBlock (local)</div>
            <div class="rx-sb-actions">
                <button class="rx-sb-btn rx-sb-start">Mark Start</button>
                <button class="rx-sb-btn rx-sb-end">Mark End</button>
                <button class="rx-sb-btn rx-sb-export">Export</button>
                <button class="rx-sb-btn rx-sb-import">Import</button>
            </div>
            <div class="rx-sb-list"></div>`;
        host.prepend(panel);
        this._panel = panel;

        let pending = null;
        panel.querySelector('.rx-sb-start').addEventListener('click', () => {
            const v = qs('video'); if (!v) return;
            pending = v.currentTime;
            this._notice(`Start: ${this._fmt(pending)}`);
        });
        panel.querySelector('.rx-sb-end').addEventListener('click', () => {
            const v = qs('video'); if (!v || pending == null) { this._notice('Mark start first'); return; }
            this._addSegment(pending, v.currentTime, 'sponsor');
            pending = null;
        });
        panel.querySelector('.rx-sb-export').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(this._segments, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = 'sponsorblock-' + (this._videoKey() || 'rumble') + '.json'; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        });
        panel.querySelector('.rx-sb-import').addEventListener('click', () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
            input.addEventListener('change', () => {
                const f = input.files[0]; if (!f) return;
                const r = new FileReader();
                r.onload = () => {
                    try {
                        const data = JSON.parse(r.result);
                        if (Array.isArray(data)) { this._segments = data; this._saveSegments(); this._refreshPanel();
                            const v = qs('video'); if (v?.duration) this._renderMarkers(v.duration);
                        }
                    } catch (e) { this._notice('Invalid JSON'); }
                };
                r.readAsText(f);
            });
            input.click();
        });
        this._refreshPanel();
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-sponsorblock-css');
        this._loadSegments();
        waitFor('video', 12000).then(() => this._attachSkip()).catch(() => {});
        waitFor('.media-description, .media-description-section', 12000).then(() => {
            setTimeout(() => this._renderPanel(), 800);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._panel?.remove();
        this._markerEl?.remove();
        const v = qs('video');
        if (v && this._skipHandler) v.removeEventListener('timeupdate', this._skipHandler);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Video Clips (mark in/out, export segment)
// ═══════════════════════════════════════════
const VideoClips = {
    id: 'videoClips',
    name: 'Video Clips',
    _styleEl: null,
    _panel: null,
    _inT: null, _outT: null,
    _busy: false,

    _css: `
        .rx-clip-panel {
            margin: 8px 0; padding: 10px;
            background: rgba(166,227,161,0.06); border: 1px solid rgba(166,227,161,0.2);
            border-radius: 8px;
        }
        .rx-clip-title { font: 700 11px/1 system-ui, sans-serif; color: #a6e3a1; margin-bottom: 6px; text-transform: uppercase; }
        .rx-clip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
        .rx-clip-btn {
            background: rgba(49,50,68,0.4); border: 1px solid rgba(255,255,255,0.06);
            color: #cdd6f4; border-radius: 5px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif;
        }
        .rx-clip-btn:hover { background: rgba(49,50,68,0.7); }
        .rx-clip-btn.primary { background: rgba(166,227,161,0.15); color: #a6e3a1; border-color: rgba(166,227,161,0.3); }
        .rx-clip-info { font: 11px/1.4 system-ui, sans-serif; color: #a6adc8; margin: 4px 0; font-variant-numeric: tabular-nums; }
        .rx-clip-status { font: 11px/1.4 system-ui, sans-serif; color: var(--rx-accent, #89b4fa); margin-top: 4px; }
        .rx-clip-bar-bg { height: 4px; background: rgba(49,50,68,0.5); border-radius: 2px; overflow: hidden; margin-top: 4px; }
        .rx-clip-bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg,#a6e3a1,#89b4fa); transition: width .2s; }
    `,

    _fmt(t) {
        t = Math.max(0, Math.floor(t));
        const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
        return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    },

    _updateInfo() {
        const info = this._panel?.querySelector('.rx-clip-info');
        if (!info) return;
        const inS = this._inT != null ? this._fmt(this._inT) : '—';
        const outS = this._outT != null ? this._fmt(this._outT) : '—';
        const len = (this._inT != null && this._outT != null) ? ` (${this._fmt(this._outT - this._inT)})` : '';
        info.textContent = `In: ${inS}   Out: ${outS}${len}`;
    },

    _setStatus(msg, pct) {
        const s = this._panel?.querySelector('.rx-clip-status');
        if (s) s.textContent = msg || '';
        if (pct != null) {
            const bar = this._panel?.querySelector('.rx-clip-bar-fill');
            if (bar) bar.style.width = pct + '%';
        }
    },

    async _export() {
        if (this._busy) { this._setStatus('Export already running…'); return; }
        if (this._inT == null || this._outT == null || this._outT <= this._inT) {
            this._setStatus('Set In and Out first'); return;
        }
        this._busy = true;
        const exportBtn = this._panel?.querySelector('.rx-clip-export');
        if (exportBtn) exportBtn.disabled = true;
        try {
            this._setStatus('Fetching playlist...', 2);
            const embedId = VideoDownloader._getEmbedId();
            if (!embedId) throw new Error('No embed id');
            if (!VideoDownloader._hlsUrl) {
                const data = await VideoDownloader._fetchEmbedData(embedId);
                VideoDownloader._hlsUrl = data.u?.hls?.auto?.url || data.ua?.hls?.auto?.url ||
                    `https://rumble.com/hls-vod/${embedId.replace('v','')}/playlist.m3u8`;
            }
            const masterResp = await fetch(VideoDownloader._hlsUrl);
            const variants = VideoDownloader._parseMasterPlaylist(await masterResp.text(), VideoDownloader._hlsUrl);
            const variant = variants.sort((a, b) => b.height - a.height)[0];
            if (!variant) throw new Error('No variant');
            this._setStatus('Parsing segments...', 5);
            const variantResp = await fetch(variant.url);
            const vtxt = await variantResp.text();
            const segUrls = VideoDownloader._parseSegmentPlaylist(vtxt, variant.url);
            const segDurs = [];
            for (const line of vtxt.split('\n')) {
                const m = line.match(/^#EXTINF:([\d.]+)/);
                if (m) segDurs.push(parseFloat(m[1]));
            }
            let acc = 0, inIdx = 0, outIdx = segUrls.length - 1;
            for (let i = 0; i < segDurs.length; i++) {
                if (acc <= this._inT) inIdx = i;
                if (acc < this._outT) outIdx = i;
                acc += segDurs[i];
            }
            const picked = segUrls.slice(inIdx, outIdx + 1);
            const title = VideoDownloader._getTitle();
            const CONCURRENT = 6;
            const buffers = [];
            for (let i = 0; i < picked.length; i += CONCURRENT) {
                const batch = picked.slice(i, i + CONCURRENT);
                const results = await Promise.all(batch.map(u => fetch(u).then(r => r.arrayBuffer())));
                buffers.push(...results);
                this._setStatus(`Downloading ${buffers.length}/${picked.length}...`, 5 + (buffers.length / picked.length) * 70);
            }
            this._setStatus('Converting to MP4...', 80);
            const blob = await VideoDownloader._transmuxWithWorker(buffers);
            this._setStatus('Saving clip...', 100);
            VideoDownloader._triggerSave(blob, `${title} - clip ${this._fmt(this._inT)}-${this._fmt(this._outT)}.mp4`, 'video/mp4');
            this._setStatus('Clip saved!', 100);
        } catch (e) {
            this._setStatus('Error: ' + e.message);
        } finally {
            this._busy = false;
            const btn = this._panel?.querySelector('.rx-clip-export');
            if (btn) btn.disabled = false;
        }
    },

    _mount() {
        const host = qs('.media-description-section, .media-description');
        if (!host || this._panel) return;
        const panel = document.createElement('div');
        panel.className = 'rx-clip-panel';
        panel.innerHTML = `
            <div class="rx-clip-title">Create Clip</div>
            <div class="rx-clip-row">
                <button class="rx-clip-btn rx-clip-in">Mark In</button>
                <button class="rx-clip-btn rx-clip-out">Mark Out</button>
                <button class="rx-clip-btn primary rx-clip-export">Export MP4</button>
                <button class="rx-clip-btn rx-clip-reset">Reset</button>
            </div>
            <div class="rx-clip-info">In: —   Out: —</div>
            <div class="rx-clip-status"></div>
            <div class="rx-clip-bar-bg"><div class="rx-clip-bar-fill"></div></div>`;
        host.prepend(panel);
        this._panel = panel;
        panel.querySelector('.rx-clip-in').addEventListener('click', () => {
            const v = qs('video'); if (v) { this._inT = v.currentTime; this._updateInfo(); }
        });
        panel.querySelector('.rx-clip-out').addEventListener('click', () => {
            const v = qs('video'); if (v) { this._outT = v.currentTime; this._updateInfo(); }
        });
        panel.querySelector('.rx-clip-export').addEventListener('click', () => this._export());
        panel.querySelector('.rx-clip-reset').addEventListener('click', () => {
            this._inT = this._outT = null; this._updateInfo(); this._setStatus('', 0);
        });
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-clips-css');
        waitFor('.media-description, .media-description-section', 12000).then(() => {
            setTimeout(() => this._mount(), 900);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._panel?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Live DVR (save last N seconds of live stream)
// ═══════════════════════════════════════════
const LiveDVR = {
    id: 'liveDVR',
    name: 'Live DVR',
    _styleEl: null,
    _panel: null,
    _busy: false,

    _css: `
        .rx-dvr-panel {
            margin: 8px 0; padding: 10px;
            background: rgba(249,226,175,0.06); border: 1px solid rgba(249,226,175,0.22);
            border-radius: 8px;
        }
        .rx-dvr-title { font: 700 11px/1 system-ui, sans-serif; color: #f9e2af; margin-bottom: 6px; text-transform: uppercase; }
        .rx-dvr-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .rx-dvr-btn {
            background: rgba(49,50,68,0.4); border: 1px solid rgba(255,255,255,0.06);
            color: #cdd6f4; border-radius: 5px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif;
        }
        .rx-dvr-btn:hover { background: rgba(49,50,68,0.7); }
        .rx-dvr-status { font: 11px/1.4 system-ui, sans-serif; color: var(--rx-accent, #89b4fa); margin-top: 4px; }
    `,

    _setStatus(msg) {
        const s = this._panel?.querySelector('.rx-dvr-status');
        if (s) s.textContent = msg || '';
    },

    async _save(seconds) {
        if (this._busy) { this._setStatus('Save already running…'); return; }
        this._busy = true;
        const buttons = this._panel?.querySelectorAll('.rx-dvr-btn') || [];
        buttons.forEach((b) => { b.disabled = true; });
        try {
            this._setStatus(`Fetching live playlist...`);
            const embedId = VideoDownloader._getEmbedId();
            if (!embedId) throw new Error('No embed id');
            const data = await VideoDownloader._fetchEmbedData(embedId);
            const hls = data.u?.hls?.auto?.url || data.ua?.hls?.auto?.url;
            if (!hls) throw new Error('No HLS URL');
            const master = await fetch(hls).then(r => r.text());
            const variants = VideoDownloader._parseMasterPlaylist(master, hls);
            const variant = variants.sort((a, b) => b.height - a.height)[0];
            if (!variant) throw new Error('No variant');
            const vtxt = await fetch(variant.url).then(r => r.text());
            const segUrls = VideoDownloader._parseSegmentPlaylist(vtxt, variant.url);
            const segDurs = [];
            for (const line of vtxt.split('\n')) {
                const m = line.match(/^#EXTINF:([\d.]+)/);
                if (m) segDurs.push(parseFloat(m[1]));
            }
            let acc = 0, startIdx = 0;
            for (let i = segDurs.length - 1; i >= 0; i--) {
                acc += segDurs[i];
                if (acc >= seconds) { startIdx = i; break; }
            }
            const picked = segUrls.slice(startIdx);
            this._setStatus(`Downloading ${picked.length} segments (~${Math.round(acc)}s)...`);
            const CONCURRENT = 6;
            const buffers = [];
            for (let i = 0; i < picked.length; i += CONCURRENT) {
                const batch = picked.slice(i, i + CONCURRENT);
                const results = await Promise.all(batch.map(u => fetch(u).then(r => r.arrayBuffer())));
                buffers.push(...results);
                this._setStatus(`Downloading ${buffers.length}/${picked.length}...`);
            }
            this._setStatus('Converting to MP4...');
            const blob = await VideoDownloader._transmuxWithWorker(buffers);
            const title = VideoDownloader._getTitle();
            VideoDownloader._triggerSave(blob, `${title} - last ${seconds}s.mp4`, 'video/mp4');
            this._setStatus(`Saved last ${seconds}s!`);
        } catch (e) {
            this._setStatus('Error: ' + e.message);
        } finally {
            this._busy = false;
            buttons.forEach((b) => { b.disabled = false; });
        }
    },

    _mount() {
        const host = qs('.media-description-section, .media-description');
        if (!host || this._panel || !Page.isLive()) return;
        const panel = document.createElement('div');
        panel.className = 'rx-dvr-panel';
        panel.innerHTML = `
            <div class="rx-dvr-title">Live DVR</div>
            <div class="rx-dvr-row">
                <button class="rx-dvr-btn" data-sec="30">Save last 30s</button>
                <button class="rx-dvr-btn" data-sec="60">Save last 1m</button>
                <button class="rx-dvr-btn" data-sec="300">Save last 5m</button>
                <button class="rx-dvr-btn" data-sec="600">Save last 10m</button>
            </div>
            <div class="rx-dvr-status"></div>`;
        host.prepend(panel);
        this._panel = panel;
        for (const b of panel.querySelectorAll('.rx-dvr-btn')) {
            b.addEventListener('click', () => this._save(parseInt(b.dataset.sec, 10)));
        }
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-livedvr-css');
        waitFor('.media-description, .media-description-section', 12000).then(() => {
            setTimeout(() => this._mount(), 1000);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._panel?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Subtitle Sidecar (load SRT/VTT file, overlay captions)
// ═══════════════════════════════════════════
const SubtitleSidecar = {
    id: 'subtitleSidecar',
    name: 'Subtitle Sidecar',
    _styleEl: null,
    _panel: null,
    _cues: [],
    _overlayEl: null,
    _timeHandler: null,

    _css: `
        .rx-sub-panel {
            margin: 8px 0; padding: 10px;
            background: rgba(137,180,250,0.06); border: 1px solid rgba(137,180,250,0.2);
            border-radius: 8px;
        }
        .rx-sub-title { font: 700 11px/1 system-ui, sans-serif; color: var(--rx-accent,#89b4fa); margin-bottom: 6px; text-transform: uppercase; }
        .rx-sub-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .rx-sub-btn {
            background: rgba(49,50,68,0.4); border: 1px solid rgba(255,255,255,0.06);
            color: #cdd6f4; border-radius: 5px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif;
        }
        .rx-sub-btn:hover { background: rgba(49,50,68,0.7); }
        .rx-sub-status { font: 11px system-ui; color: #a6adc8; }
        .rx-sub-overlay {
            position: absolute; left: 50%; bottom: 12%; transform: translateX(-50%);
            max-width: 85%; padding: 6px 14px;
            background: rgba(0,0,0,0.78); color: #fff;
            font: 600 18px/1.3 system-ui, sans-serif; text-align: center;
            border-radius: 4px; pointer-events: none; z-index: 20;
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
            white-space: pre-line;
        }
    `,

    _tsToSec(ts) {
        const m = ts.match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)/);
        if (!m) return 0;
        return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2]) * 60) + parseInt(m[3]) + (parseInt(m[4]) / 1000);
    },

    _parse(text) {
        text = text.replace(/^WEBVTT.*\n/, '').replace(/\r/g, '');
        const blocks = text.split(/\n\n+/);
        const cues = [];
        for (const b of blocks) {
            const line = b.split('\n').find(l => l.includes('-->'));
            if (!line) continue;
            const [a, c] = line.split('-->').map(s => s.trim());
            const lines = b.split('\n');
            const idx = lines.findIndex(l => l.includes('-->'));
            const content = lines.slice(idx + 1).join('\n').trim();
            if (content) cues.push({ start: this._tsToSec(a), end: this._tsToSec(c), text: content });
        }
        return cues.sort((a, b) => a.start - b.start);
    },

    _attach() {
        const v = qs('video');
        if (!v) return;
        if (!this._overlayEl) {
            const overlay = document.createElement('div');
            overlay.className = 'rx-sub-overlay';
            overlay.style.display = 'none';
            const parent = v.parentElement || v.closest('[id^="vid_v"]') || document.body;
            parent.style.position = parent.style.position || 'relative';
            parent.appendChild(overlay);
            this._overlayEl = overlay;
        }
        if (!this._timeHandler) {
            this._timeHandler = () => {
                const t = v.currentTime;
                const active = this._cues.find(c => t >= c.start && t <= c.end);
                if (active) {
                    this._overlayEl.textContent = active.text;
                    this._overlayEl.style.display = 'block';
                } else {
                    this._overlayEl.style.display = 'none';
                }
            };
            v.addEventListener('timeupdate', this._timeHandler);
        }
    },

    _load(text) {
        this._cues = this._parse(text);
        const s = this._panel?.querySelector('.rx-sub-status');
        if (s) s.textContent = `${this._cues.length} cues loaded`;
        this._attach();
        Transcripts?._loadExternalCues?.(this._cues);
    },

    _mount() {
        const host = qs('.media-description-section, .media-description');
        if (!host || this._panel) return;
        const panel = document.createElement('div');
        panel.className = 'rx-sub-panel';
        panel.innerHTML = `
            <div class="rx-sub-title">Subtitles</div>
            <div class="rx-sub-row">
                <button class="rx-sub-btn rx-sub-upload">Load SRT/VTT...</button>
                <button class="rx-sub-btn rx-sub-clear">Clear</button>
                <span class="rx-sub-status"></span>
            </div>`;
        host.prepend(panel);
        this._panel = panel;
        panel.querySelector('.rx-sub-upload').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.vtt,.srt,.txt';
            input.addEventListener('change', () => {
                const f = input.files[0]; if (!f) return;
                const r = new FileReader();
                r.onload = () => this._load(r.result);
                r.readAsText(f);
            });
            input.click();
        });
        panel.querySelector('.rx-sub-clear').addEventListener('click', () => {
            this._cues = [];
            if (this._overlayEl) this._overlayEl.style.display = 'none';
            const s = panel.querySelector('.rx-sub-status'); if (s) s.textContent = '';
            Transcripts?._loadExternalCues?.([]);
        });
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-subsidecar-css');
        waitFor('.media-description, .media-description-section', 12000).then(() => {
            setTimeout(() => this._mount(), 900);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._panel?.remove();
        this._overlayEl?.remove();
        const v = qs('video');
        if (v && this._timeHandler) v.removeEventListener('timeupdate', this._timeHandler);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Transcripts (clickable transcript panel)
// ═══════════════════════════════════════════
const Transcripts = {
    id: 'transcripts',
    name: 'Transcripts',
    _styleEl: null,
    _panel: null,
    _cues: [],

    _css: `
        .rx-trans-panel {
            margin: 8px 0; padding: 10px;
            background: rgba(203,166,247,0.06); border: 1px solid rgba(203,166,247,0.22);
            border-radius: 8px;
        }
        .rx-trans-title { font: 700 11px/1 system-ui, sans-serif; color: #cba6f7; margin-bottom: 6px; text-transform: uppercase; }
        .rx-trans-hint { font: 11px system-ui; color: #6c7086; margin-bottom: 6px; }
        .rx-trans-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
        .rx-trans-row {
            display: flex; gap: 8px; padding: 4px 6px; cursor: pointer;
            border-radius: 4px; font: 12px/1.4 system-ui;
        }
        .rx-trans-row:hover { background: rgba(203,166,247,0.1); }
        .rx-trans-row .rx-tr-time {
            color: #cba6f7; font-weight: 600; font-variant-numeric: tabular-nums;
            min-width: 52px; flex-shrink: 0;
        }
        .rx-trans-search {
            width: 100%; background: rgba(49,50,68,0.5);
            border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
            padding: 5px 8px; color: #cdd6f4; font-size: 11px; margin-bottom: 6px; outline: none;
        }
    `,

    _fmt(t) {
        t = Math.max(0, Math.floor(t));
        const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
        return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    },

    _render() {
        if (!this._panel) return;
        const list = this._panel.querySelector('.rx-trans-list');
        list.innerHTML = '';
        if (!this._cues.length) {
            list.innerHTML = '<div class="rx-trans-hint">No transcript loaded. Load a VTT/SRT via the Subtitles panel.</div>';
            return;
        }
        for (const c of this._cues) {
            const row = document.createElement('div');
            row.className = 'rx-trans-row';
            const ts = document.createElement('span'); ts.className = 'rx-tr-time'; ts.textContent = this._fmt(c.start);
            const tx = document.createElement('span'); tx.textContent = c.text;
            row.append(ts, tx);
            row.addEventListener('click', () => {
                const v = qs('video');
                if (v) { v.currentTime = c.start; v.play().catch(() => {}); }
            });
            list.appendChild(row);
        }
    },

    _filter(q) {
        q = (q || '').toLowerCase();
        const rows = this._panel?.querySelectorAll('.rx-trans-row') || [];
        for (const row of rows) {
            const t = row.textContent.toLowerCase();
            row.style.display = !q || t.includes(q) ? '' : 'none';
        }
    },

    _loadExternalCues(cues) {
        this._cues = cues || [];
        this._render();
    },

    _mount() {
        const host = qs('.media-description-section, .media-description');
        if (!host || this._panel) return;
        const panel = document.createElement('div');
        panel.className = 'rx-trans-panel';
        panel.innerHTML = `
            <div class="rx-trans-title">Transcript</div>
            <input type="text" class="rx-trans-search" placeholder="Search transcript...">
            <div class="rx-trans-list"></div>`;
        host.prepend(panel);
        this._panel = panel;
        panel.querySelector('.rx-trans-search').addEventListener('input', (e) => this._filter(e.target.value));
        this._render();
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-transcripts-css');
        waitFor('.media-description, .media-description-section', 12000).then(() => {
            setTimeout(() => this._mount(), 950);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._panel?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Low-Bitrate MP4 (for background listening)
// ═══════════════════════════════════════════
// Note: true audio-only extraction from a TS/HLS source requires an audio
// demuxer (e.g. ffmpeg.wasm) we don't ship. Instead we fetch the lowest
// bandwidth variant which is full-video-but-tiny, suitable for listening.
// The setting key stays `audioOnly` for compatibility with saved settings.
const AudioOnly = {
    id: 'audioOnly',
    name: 'Low-Bitrate MP4',
    _styleEl: null,
    _obs: null,
    _busy: false,

    _css: `
        .rx-dl-audio-btn {
            display: block; width: 100%; margin-top: 8px;
            background: rgba(249,226,175,0.12); border: 1px solid rgba(249,226,175,0.3);
            color: #f9e2af; border-radius: 8px; padding: 10px; cursor: pointer;
            font: 600 12px/1 system-ui, sans-serif;
            transition: background .15s;
        }
        .rx-dl-audio-btn:hover { background: rgba(249,226,175,0.2); }
        .rx-dl-audio-btn:disabled { opacity: 0.55; cursor: progress; }
        .rx-dl-audio-note {
            font: 10px/1.4 system-ui, sans-serif; color: var(--rx-subtext, #a6adc8);
            margin-top: 4px; padding: 0 4px;
        }
    `,

    async _extractAudio() {
        if (this._busy) return;
        const panel = qs('#rx-tab-download .rx-dl-body');
        if (!panel) return;
        this._busy = true;
        const btn = qs('.rx-dl-audio-btn');
        if (btn) btn.disabled = true;

        const status = document.createElement('div');
        status.className = 'rx-dl-status';
        panel.appendChild(status);
        const setStatus = (m) => { status.textContent = m; };
        try {
            setStatus('Fetching embed data...');
            const embedId = VideoDownloader._getEmbedId();
            if (!embedId) throw new Error('No embed id');
            const data = VideoDownloader._embedData || await VideoDownloader._fetchEmbedData(embedId);
            VideoDownloader._embedData = data;
            const hls = data.u?.hls?.auto?.url || data.ua?.hls?.auto?.url ||
                `https://rumble.com/hls-vod/${embedId.replace('v', '')}/playlist.m3u8`;
            const master = await fetch(hls).then((r) => r.text());
            const variants = VideoDownloader._parseMasterPlaylist(master, hls);
            const variant = [...variants].sort((a, b) => (a.bandwidth || 0) - (b.bandwidth || 0))[0];
            if (!variant) throw new Error('No stream variant found');
            const vtxt = await fetch(variant.url).then((r) => r.text());
            const segUrls = VideoDownloader._parseSegmentPlaylist(vtxt, variant.url);
            if (!segUrls.length) throw new Error('No segments in playlist');

            const buffers = [];
            const CONCURRENT = 6;
            for (let i = 0; i < segUrls.length; i += CONCURRENT) {
                const batch = segUrls.slice(i, i + CONCURRENT);
                const results = await Promise.all(batch.map((u) => fetch(u).then((r) => r.arrayBuffer())));
                buffers.push(...results);
                setStatus(`Downloading ${buffers.length}/${segUrls.length}...`);
            }
            setStatus('Packaging MP4...');
            const blob = await VideoDownloader._transmuxWithWorker(buffers);
            const title = VideoDownloader._getTitle();
            const tag = variant.height ? `${variant.height}p` : 'lo';
            VideoDownloader._triggerSave(blob, `${title} - ${tag}.mp4`, 'video/mp4');
            setStatus('Saved. Low-bitrate MP4 is full video at the smallest size — good for listening.');
        } catch (e) {
            setStatus('Error: ' + e.message);
        } finally {
            this._busy = false;
            if (btn) btn.disabled = false;
        }
    },

    _mountBtn() {
        const body = qs('#rx-tab-download .rx-dl-body');
        if (!body || qs('.rx-dl-audio-btn')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rx-dl-audio-btn';
        btn.textContent = 'Low-Bitrate MP4 (for listening)';
        btn.addEventListener('click', () => this._extractAudio());
        body.appendChild(btn);
        const note = document.createElement('div');
        note.className = 'rx-dl-audio-note';
        note.textContent = 'Fetches the smallest video variant. Not audio-only — saves as .mp4 at lowest quality.';
        body.appendChild(note);
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-audioonly-css');
        this._obs = new MutationObserver(() => {
            const body = qs('#rx-tab-download .rx-dl-body');
            if (body && body.children.length && !body.querySelector('.rx-dl-audio-btn')) {
                this._mountBtn();
            }
        });
        this._obs.observe(document.body, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Batch Download (multi-select from feed)
// ═══════════════════════════════════════════
const BatchDownload = {
    id: 'batchDownload',
    name: 'Batch Download',
    _styleEl: null,
    _obs: null,
    _queue: null,
    _selected: null,
    _busy: false,

    _css: `
        .rx-batch-chk {
            position: absolute; top: 6px; left: 6px; z-index: 4;
            width: 20px; height: 20px; border-radius: 4px;
            background: rgba(0,0,0,0.7); border: 2px solid rgba(255,255,255,0.5);
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity .15s;
        }
        .videostream:hover .rx-batch-chk,
        .rx-batch-mode .rx-batch-chk { opacity: 1; }
        .rx-batch-chk.checked {
            background: var(--rx-accent, #89b4fa); border-color: var(--rx-accent, #89b4fa);
        }
        .rx-batch-chk.checked::after { content: '✓'; color: #0f0f0f; font: 700 12px system-ui; }

        .rx-batch-bar {
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            z-index: 10020; display: flex; gap: 10px; align-items: center;
            background: rgba(30,30,46,0.97); border: 1px solid rgba(137,180,250,0.3);
            border-radius: 12px; padding: 10px 14px;
            font: 600 12px system-ui, sans-serif; color: #cdd6f4;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;
        }
        .rx-batch-bar.visible { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
        .rx-batch-bar button {
            background: rgba(137,180,250,0.15); border: 1px solid rgba(137,180,250,0.3);
            color: var(--rx-accent, #89b4fa); border-radius: 6px; padding: 5px 10px;
            cursor: pointer; font: 600 11px system-ui;
        }
        .rx-batch-bar button:hover { background: rgba(137,180,250,0.25); }
        .rx-batch-bar .rx-batch-clear { color: #f38ba8; border-color: rgba(243,139,168,0.3); background: rgba(243,139,168,0.1); }
    `,

    _attachToCard(card) {
        if (card.dataset.rxBatch) return;
        card.dataset.rxBatch = '1';
        card.style.position = card.style.position || 'relative';
        const chk = document.createElement('div');
        chk.className = 'rx-batch-chk';
        chk.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            chk.classList.toggle('checked');
            const a = card.querySelector('a[href*="/v"]');
            const url = a ? a.href : '';
            if (!url) return;
            if (chk.classList.contains('checked')) this._selected.add(url);
            else this._selected.delete(url);
            this._updateBar();
        });
        card.appendChild(chk);
    },

    _scan() {
        for (const c of qsa('.videostream, article.video-item')) this._attachToCard(c);
    },

    _updateBar() {
        if (!this._queue) return;
        const bar = this._queue;
        const count = this._selected.size;
        bar.querySelector('.rx-batch-count').textContent = `${count} selected`;
        bar.classList.toggle('visible', count > 0);
    },

    _extractEmbedId(url) {
        try {
            const u = new URL(url, location.origin);
            const m = u.pathname.match(/^\/(v[a-z0-9]+)/i);
            return m ? m[1] : null;
        } catch { return null; }
    },

    _titleFromUrl(url) {
        try {
            const u = new URL(url, location.origin);
            const slug = u.pathname
                .replace(/^\/v[a-z0-9]+-?/i, '')
                .replace(/\.html?$/i, '');
            const decoded = decodeURIComponent(slug || 'rumble_video');
            return decoded.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').substring(0, 80) || 'rumble_video';
        } catch { return 'rumble_video'; }
    },

    async _downloadOne(url) {
        const embedId = this._extractEmbedId(url);
        if (!embedId) throw new Error('Not a Rumble video URL');
        const data = await VideoDownloader._fetchEmbedData(embedId);
        const qualities = VideoDownloader._parseQualities(data);
        // Prefer a direct MP4 (fastest); HLS-only variants need transmux which
        // is too expensive to run in a batch.
        const pick = qualities.find((q) => q.directUrl);
        if (!pick) throw new Error('No direct MP4 available');
        const title = this._titleFromUrl(url);
        await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'download',
                data: { url: pick.directUrl, filename: `${title} - ${pick.label}.mp4` },
            }, () => resolve());
        });
    },

    async _downloadAll() {
        if (this._busy) return;
        const items = [...this._selected];
        if (!items.length) return;
        const status = this._queue.querySelector('.rx-batch-status');
        const CONCURRENT = 3;
        this._busy = true;
        let done = 0;
        let failed = 0;
        const queue = [...items];
        const render = () => { status.textContent = `Downloading ${done + failed}/${items.length}...`; };
        render();

        const worker = async () => {
            while (queue.length) {
                const url = queue.shift();
                try {
                    await this._downloadOne(url);
                    done++;
                } catch (err) {
                    failed++;
                    console.warn('[RumbleX] batch item failed:', url, err);
                }
                render();
            }
        };
        try {
            await Promise.all(
                Array.from({ length: Math.min(CONCURRENT, items.length) }, () => worker())
            );
        } finally {
            this._busy = false;
        }
        status.textContent = failed
            ? `Done: ${done} saved, ${failed} failed (see console for details)`
            : `Done: ${done} saved`;
        setTimeout(() => {
            this._selected.clear();
            for (const c of qsa('.rx-batch-chk.checked')) c.classList.remove('checked');
            this._updateBar();
            status.textContent = '';
        }, 3500);
    },

    _mountBar() {
        if (this._queue) return;
        const bar = document.createElement('div');
        bar.className = 'rx-batch-bar';
        bar.innerHTML = `
            <span class="rx-batch-count">0 selected</span>
            <button class="rx-batch-go">Download all</button>
            <button class="rx-batch-clear">Clear</button>
            <span class="rx-batch-status" style="color:#a6adc8;font-size:11px;"></span>`;
        document.body.appendChild(bar);
        bar.querySelector('.rx-batch-go').addEventListener('click', () => this._downloadAll());
        bar.querySelector('.rx-batch-clear').addEventListener('click', () => {
            this._selected.clear();
            for (const c of qsa('.rx-batch-chk.checked')) c.classList.remove('checked');
            this._updateBar();
        });
        this._queue = bar;
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isFeed() && !Page.isChannel() && !Page.isSearch() && !Page.isHome()) return;
        this._styleEl = injectStyle(this._css, 'rx-batch-css');
        this._selected = new Set();
        this._mountBar();
        this._scan();
        this._obs = new MutationObserver(() => {
            clearTimeout(this._t);
            this._t = setTimeout(() => this._scan(), 150);
        });
        this._obs.observe(document.body, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._queue?.remove();
        for (const c of qsa('.rx-batch-chk')) c.remove();
        clearTimeout(this._t);
    }
};

// ═══════════════════════════════════════════
//  RES PORT — CSS-toggle registry + factory
// ═══════════════════════════════════════════
// Ported from "Rumble Enhancement Suite" userscript (v11.0 by Matthew Parker).
// Every entry here becomes its own RumbleX feature module with identical
// init/destroy semantics as the handwritten modules. Consolidating them
// into a registry keeps the file readable while still giving each feature
// a dedicated setting key, panel card, and hot-reload hook.
//
// Shape: { id, label, desc, css, page?, default? }
//   page: 'watch' | 'feed' | 'home' | 'channel' | 'live' (optional gate)
//   default: defaults to `false` — all hide-X toggles ship opt-in so the
//   port doesn't silently change the user's feed on update.
const RX_CSS_TOGGLES = [
    // ── Main Page Layout ────────────────────────────────────
    { id: 'widenSearchBar', label: 'Widen Search Bar', desc: 'Expand the search bar to fill available header space.',
        css: `.header .header-div { display: flex; align-items: center; gap: 1rem; padding-right: 1.5rem; box-sizing: border-box; } .header-search { flex-grow: 1; max-width: none !important; } .header-search .header-search-field { width: 100% !important; }` },
    { id: 'hideUploadIcon', label: 'Hide Upload Icon', desc: 'Hide the upload/stream-live icon in the header.',
        css: `button.header-upload { display: none !important; }` },
    { id: 'hideHeaderAd', label: 'Hide "Go Ad-Free" Button', desc: 'Hide the "Go Ad-Free" button in the header.',
        css: `span.hidden.lg\\:flex:has(button[hx-get*="premium-value-prop"]) { display: none !important; }` },
    { id: 'hideProfileBacksplash', label: 'Hide Profile Backsplash', desc: 'Hide the large header image on channel profiles.',
        css: `div.channel-header--backsplash { display: none !important; } html.main-menu-mode-permanent { margin-top: 30px !important; }`, page: 'channel' },
    { id: 'hideFeaturedBanner', label: 'Hide Featured Banner', desc: 'Hide the top category banner on the home page.',
        css: `div.homepage-featured { display: none !important; }`, page: 'home' },
    { id: 'hideEditorPicks', label: "Hide Editor Picks", desc: "Hide the main 'Editor Picks' row on the home page.",
        css: `#section-editor-picks { display: none !important; }`, page: 'home' },
    { id: 'hideTopLiveCategories', label: "Hide 'Top Live' Row", desc: "Hide the 'Top Live Categories' row on the home page.",
        css: `section#section-top-live { display: none !important; }`, page: 'home' },
    { id: 'hidePremiumRow', label: "Hide Premium Row", desc: "Hide the Rumble Premium row on the home page.",
        css: `section#section-premium-videos { display: none !important; }`, page: 'home' },
    { id: 'hideHomepageAd', label: "Hide Ad Section (home)", desc: "Hide the ad container on the home page.",
        css: `section.homepage-section:has(.js-rac-desktop-container) { display: none !important; }`, page: 'home' },
    { id: 'hideForYouRow', label: "Hide 'For You' Row", desc: "Hide 'For You' recommendations on the home page.",
        css: `section#section-personal-recommendations { display: none !important; }`, page: 'home' },
    { id: 'hideGamingRow', label: "Hide Gaming Row", desc: "Hide the Gaming row on the home page.",
        css: `section#section-gaming { display: none !important; }`, page: 'home' },
    { id: 'hideFinanceRow', label: "Hide Finance & Crypto Row", desc: "Hide the Finance & Crypto row on the home page.",
        css: `section#section-finance { display: none !important; }`, page: 'home' },
    { id: 'hideLiveRow', label: "Hide Live Row", desc: "Hide the Live row on the home page.",
        css: `section#section-live-videos { display: none !important; }`, page: 'home' },
    { id: 'hideFeaturedPlaylistsRow', label: "Hide Featured Playlists", desc: "Hide the Featured Playlists row on the home page.",
        css: `section#section-featured-playlists { display: none !important; }`, page: 'home' },
    { id: 'hideSportsRow', label: "Hide Sports Row", desc: "Hide the Sports row on the home page.",
        css: `section#section-sports { display: none !important; }`, page: 'home' },
    { id: 'hideViralRow', label: "Hide Viral Row", desc: "Hide the Viral row on the home page.",
        css: `section#section-viral { display: none !important; }`, page: 'home' },
    { id: 'hidePodcastsRow', label: "Hide Podcasts Row", desc: "Hide the Podcasts row on the home page.",
        css: `section#section-podcasts { display: none !important; }`, page: 'home' },
    { id: 'hideLeaderboardRow', label: "Hide Leaderboard Row", desc: "Hide the Leaderboard row on the home page.",
        css: `section#section-leaderboard { display: none !important; }`, page: 'home' },
    { id: 'hideVlogsRow', label: "Hide Vlogs Row", desc: "Hide the Vlogs row on the home page.",
        css: `section#section-vlogs { display: none !important; }`, page: 'home' },
    { id: 'hideNewsRow', label: "Hide News Row", desc: "Hide the News row on the home page.",
        css: `section#section-news { display: none !important; }`, page: 'home' },
    { id: 'hideScienceRow', label: "Hide Health & Science Row", desc: "Hide the Health & Science row on the home page.",
        css: `section#section-science { display: none !important; }`, page: 'home' },
    { id: 'hideMusicRow', label: "Hide Music Row", desc: "Hide the Music row on the home page.",
        css: `section#section-music { display: none !important; }`, page: 'home' },
    { id: 'hideEntertainmentRow', label: "Hide Entertainment Row", desc: "Hide the Entertainment row on the home page.",
        css: `section#section-entertainment { display: none !important; }`, page: 'home' },
    { id: 'hideCookingRow', label: "Hide Cooking Row", desc: "Hide the Cooking row on the home page.",
        css: `section#section-cooking { display: none !important; }`, page: 'home' },
    { id: 'hideFooter', label: 'Hide Footer', desc: 'Remove the site footer entirely.',
        css: `footer.page__footer.foot.nav--transition { display: none !important; }` },

    // ── Video Page Layout ────────────────────────────────────
    { id: 'hideRelatedOnLive', label: 'Hide Related Media on Live', desc: 'Hide the "Related Media" section below the player on live streams.',
        css: `.media-page-related-media-desktop-floating { display: none !important; }`, page: 'watch' },
    { id: 'hideRelatedSidebar', label: 'Hide Related Sidebar', desc: 'Hide the related-videos sidebar for a focused view.',
        css: `aside.media-page-related-media-desktop-sidebar { display: none !important; }`, page: 'watch' },
    { id: 'widenContent', label: 'Widen Content Area', desc: 'Expand the main content area. Best used with the related sidebar hidden.',
        css: `body:has(aside.media-page-related-media-desktop-sidebar[style*="display: none"]) .main-and-sidebar .main-content { width: 100% !important; max-width: 100% !important; }`, page: 'watch' },
    { id: 'hideVideoDescription', label: 'Hide Video Description', desc: 'Hide the description, tags, and views block.',
        css: `.media-description-section { display: none !important; }`, page: 'watch' },
    { id: 'hidePausedVideoAds', label: 'Hide Paused-Video Ads', desc: 'Hide the ad overlay that appears when you pause a video.',
        css: `canvas#pause-ads__canvas { display: none !important; }`, page: 'watch' },

    // ── Player Controls (hide-X) ─────────────────────────────
    { id: 'hideRewindButton', label: 'Hide Rewind Button', desc: 'Hide the rewind button in the player controls.',
        css: `div[title="Rewind"] { display: none !important; }`, page: 'watch' },
    { id: 'hideFastForwardButton', label: 'Hide Fast Forward', desc: 'Hide the fast-forward button in the player controls.',
        css: `div[title="Fast forward"] { display: none !important; }`, page: 'watch' },
    { id: 'hideCCButton', label: 'Hide Closed Captions', desc: 'Hide the (CC) button in the player controls.',
        css: `div[title="Toggle closed captions"] { display: none !important; }`, page: 'watch' },
    { id: 'hideAutoplayButton', label: 'Hide Autoplay Toggle', desc: 'Hide the autoplay-toggle switch in player controls.',
        css: `div[title="Autoplay"] { display: none !important; }`, page: 'watch' },
    { id: 'hideTheaterButton', label: 'Hide Theater Button', desc: 'Hide the theater-mode button in player controls.',
        css: `div[title="Toggle theater mode"] { display: none !important; }`, page: 'watch' },
    { id: 'hidePipButton', label: 'Hide Picture-in-Picture', desc: 'Hide the PiP button in player controls.',
        css: `div[title="Toggle picture-in-picture mode"] { display: none !important; }`, page: 'watch' },
    { id: 'hideFullscreenButton', label: 'Hide Fullscreen Button', desc: 'Hide the fullscreen button in player controls.',
        css: `div[title="Toggle fullscreen"] { display: none !important; }`, page: 'watch' },
    { id: 'hidePlayerRumbleLogo', label: 'Hide Rumble Logo (player)', desc: 'Hide the Rumble logo inside the player.',
        css: `div:has(> div > svg[viewBox="0 0 140 35"]) { display: none !important; }`, page: 'watch' },
    { id: 'hidePlayerGradient', label: 'Hide Player Gradient', desc: 'Remove the cloudy gradient at the bottom of the player.',
        css: `.touched_overlay > div[style*="linear-gradient"] { display: none !important; }`, page: 'watch' },

    // ── Video Buttons (hide-X) ───────────────────────────────
    { id: 'hideLikeDislikeButton', label: 'Hide Like/Dislike', desc: 'Hide the like and dislike buttons below the player.',
        css: `div[data-js="media_action_vote_button"] { display: none !important; }`, page: 'watch' },
    { id: 'hideShareButton', label: 'Hide Share Button', desc: 'Hide the share button below the player.',
        css: `div[data-js="video_action_button_visible_location"][data-type="share"] { display: none !important; }`, page: 'watch' },
    { id: 'hideRepostButton', label: 'Hide Repost Button', desc: 'Hide the repost button below the player.',
        css: `div[data-js="video_action_button_visible_location"][data-type="reposts"] { display: none !important; }`, page: 'watch' },
    { id: 'hideEmbedButton', label: 'Hide Embed Button', desc: 'Hide the embed button below the player.',
        css: `div[data-js="video_action_button_visible_location"][data-type="embed"] { display: none !important; }`, page: 'watch' },
    { id: 'hideSaveButton', label: 'Hide Save Button', desc: 'Hide the save-to-playlist button below the player.',
        css: `div[data-js="video_action_button_visible_location"][data-type="playlist"] { display: none !important; }`, page: 'watch' },
    { id: 'hideCommentButton', label: 'Hide Comment Button', desc: 'Hide the main comment button below the player.',
        css: `div[data-js="video_action_button_visible_location"][data-type="comments"] { display: none !important; }`, page: 'watch' },
    { id: 'hideReportButton', label: 'Hide 3-dot Menu', desc: 'Hide the 3-dot menu containing the report option.',
        css: `.video-action-sub-menu-wrapper { display: none !important; }`, page: 'watch' },
    { id: 'hidePremiumJoinButtons', label: 'Hide Premium/Join', desc: 'Hide the "Rumble Premium" and "Join" buttons.',
        css: `button[hx-get*="premium-value-prop"], button[data-js="locals-subscription-button"] { display: none !important; }`, page: 'watch' },

    // ── Comments ─────────────────────────────────────────────
    { id: 'moveReplyButton', label: 'Move Reply Button', desc: 'Move the reply button next to the like/dislike buttons.',
        css: `.comment-actions-wrapper { display: flex; align-items: center; } .comment-actions-wrapper .comment-actions { margin-left: 12px; }`, page: 'watch' },
    { id: 'hideCommentReportLink', label: 'Hide Comment Report Link', desc: 'Hide the "report" link on user comments.',
        css: `.comments-action-report.comments-action { display: none !important; }`, page: 'watch' },

    // ── Chat ─────────────────────────────────────────────────
    { id: 'cleanLiveChat', label: 'Clean Live Chat UI', desc: 'Hide pinned messages, chat header, and Rant buttons for a cleaner live-chat look.',
        css: `
            div.chat-pinned-ui__pinned-message-container,
            div.chat__pinned-ui-container { display: none !important; }
            div.chat--header { display: none !important; }
            section.chat.relative { margin-top: -71px !important; height: 715px !important; }
            button.media-page-chat-container-toggle-btn { margin-top: 580px !important; margin-left: -48px !important; }
            div.chat-message-form-section.chat-message-form-section-justify-between,
            .chat-message-form-section .user-image { display: none !important; }
        `, page: 'watch' },
];

// Factory — turns an RX_CSS_TOGGLES entry into a feature module object with
// RumbleX's standard init/destroy interface.
function makeCssToggleFeature(entry) {
    const pagePredicates = {
        watch: () => Page.isWatch(),
        home: () => Page.isHome(),
        feed: () => Page.isFeed(),
        channel: () => Page.isChannel(),
        live: () => Page.isLive(),
    };
    return {
        id: entry.id,
        name: entry.label,
        _styleEl: null,
        init() {
            if (!Settings.get(this.id)) return;
            if (entry.page && pagePredicates[entry.page] && !pagePredicates[entry.page]()) return;
            this._styleEl = injectStyle(entry.css, 'rx-css-' + entry.id);
        },
        destroy() {
            this._styleEl?.remove();
            this._styleEl = null;
        },
    };
}

// Materialize all CSS-toggle modules eagerly — they're cheap and referenced
// by the features[] array below.
const RX_CSS_FEATURES = RX_CSS_TOGGLES.map(makeCssToggleFeature);

// ═══════════════════════════════════════════
//  RES PORT — Auto-hide Header
// ═══════════════════════════════════════════
const AutoHideHeader = {
    id: 'autoHideHeader',
    name: 'Auto-hide Header',
    _styleEl: null,
    _handler: null,

    _css: `
        body.rx-autohide-header-active header.header {
            position: fixed; top: 0; left: 0; right: 0; z-index: 1001;
            opacity: 0; transition: opacity 0.3s ease-in-out; pointer-events: none;
        }
        body.rx-autohide-header-active.rx-header-visible header.header {
            opacity: 1; pointer-events: auto;
        }
        body.rx-autohide-header-active { padding-top: 0 !important; }
    `,

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-autohide-header-css');
        document.body.classList.add('rx-autohide-header-active');
        this._handler = (e) => {
            if (e.clientY < 80) {
                document.body.classList.add('rx-header-visible');
            } else if (!e.target.closest || !e.target.closest('header.header')) {
                document.body.classList.remove('rx-header-visible');
            }
        };
        document.addEventListener('mousemove', this._handler);
    },
    destroy() {
        if (this._handler) document.removeEventListener('mousemove', this._handler);
        this._handler = null;
        this._styleEl?.remove();
        document.body.classList.remove('rx-autohide-header-active', 'rx-header-visible');
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Auto-hide Navigation Sidebar
// ═══════════════════════════════════════════
const AutoHideNavSidebar = {
    id: 'autoHideNavSidebar',
    name: 'Auto-hide Nav Sidebar',
    _styleEl: null,
    _trigger: null,

    _css: `
        body.rx-autohide-nav-active nav.navs {
            position: fixed; top: 0; left: 0;
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
            z-index: 1002; height: 100vh; opacity: 0.95; visibility: hidden;
        }
        body.rx-autohide-nav-active main.nav--transition { margin-left: 0 !important; }
        #rx-nav-sidebar-trigger {
            position: fixed; top: 80px; left: 0; width: 30px; height: calc(100% - 80px); z-index: 1001;
        }
        #rx-nav-sidebar-trigger:hover + nav.navs,
        body.rx-autohide-nav-active nav.navs:hover {
            transform: translateX(0); opacity: 1; visibility: visible;
        }
    `,

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-autohide-nav-css');
        document.body.classList.add('rx-autohide-nav-active');
        if (!qs('#rx-nav-sidebar-trigger')) {
            const trigger = document.createElement('div');
            trigger.id = 'rx-nav-sidebar-trigger';
            document.body.appendChild(trigger);
            this._trigger = trigger;
        }
    },
    destroy() {
        this._styleEl?.remove();
        document.body.classList.remove('rx-autohide-nav-active');
        qs('#rx-nav-sidebar-trigger')?.remove();
        this._trigger = null;
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Auto-like
// ═══════════════════════════════════════════
const AutoLike = {
    id: 'autoLike',
    name: 'Auto Like',
    _clicked: false,
    // Generation counter guards against a late `waitFor` resolution firing a
    // click after the feature has been destroyed and re-initialised (or just
    // disabled). Each `init()` bumps `_gen`; the promise callback checks that
    // it still matches before acting.
    _gen: 0,

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._clicked = false;
        const myGen = ++this._gen;
        waitFor('button.rumbles-vote-pill-up', 15000).then((btn) => {
            if (myGen !== this._gen || this._clicked) return;
            if (!btn.classList.contains('active')) {
                btn.click();
                this._clicked = true;
            }
        }).catch(() => {});
    },
    destroy() {
        this._gen++; // invalidates any still-pending waitFor promise
        this._clicked = false;
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Auto Load Comments
// ═══════════════════════════════════════════
const AutoLoadComments = {
    id: 'autoLoadComments',
    name: 'Auto Load Comments',
    _handler: null,

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        const isInView = (el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.top <= (window.innerHeight || document.documentElement.clientHeight);
        };
        this._handler = () => {
            const btn = qs('li.show-more-comments > button');
            if (btn && isInView(btn)) btn.click();
        };
        window.addEventListener('scroll', this._handler, { passive: true });
    },
    destroy() {
        if (this._handler) window.removeEventListener('scroll', this._handler);
        this._handler = null;
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Full-Width Player (with live two-column mode)
// ═══════════════════════════════════════════
const FullWidthPlayer = {
    id: 'fullWidthPlayer',
    name: 'Full-Width Player',
    _styleEl: null,
    _liveObs: null,
    _resizeHandler: null,
    _chatToggleHandler: null,

    _standardCss: `
        body.rx-full-width-player nav.navs,
        body.rx-full-width-player aside.media-page-related-media-desktop-sidebar,
        body.rx-full-width-player #player-spacer { display: none !important; }
        body.rx-full-width-player main.nav--transition { margin-left: 0 !important; }
        body.rx-full-width-player .main-and-sidebar { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
        body.rx-full-width-player .main-content,
        body.rx-full-width-player .media-container { width: 100% !important; max-width: 100% !important; }
        body.rx-full-width-player .video-player,
        body.rx-full-width-player [id^="vid_v"] {
            width: 100vw !important;
            height: calc(100vw * 9 / 16) !important;
            max-height: 100vh;
        }
        body.rx-full-width-player #videoPlayer video { object-fit: contain !important; }
    `,

    _liveCss: `
        body.rx-live-two-col:not(.rumble-player--fullscreen) .main-and-sidebar {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) var(--rx-chat-w, 360px);
            width: 100vw; max-width: 100vw; margin: 0; padding: 0; align-items: stretch;
        }
        body.rx-live-two-col:not(.rumble-player--fullscreen) .main-and-sidebar .main-content {
            display: flex; flex-direction: column;
        }
        body.rx-live-two-col:not(.rumble-player--fullscreen) .media-container { flex-grow: 1; }
        body.rx-live-two-col:not(.rumble-player--fullscreen) aside.media-page-chat-aside-chat {
            width: var(--rx-chat-w, 360px) !important;
            min-width: var(--rx-chat-w, 360px) !important;
            max-width: clamp(320px, var(--rx-chat-w, 360px), 480px) !important;
            position: relative; z-index: 1;
        }
        body.rx-live-two-col:not(.rumble-player--fullscreen) .video-player { margin-top: -30px; }
        body.rx-live-two-col:not(.rumble-player--fullscreen) .video-player,
        body.rx-live-two-col:not(.rumble-player--fullscreen) #videoPlayer,
        body.rx-live-two-col:not(.rumble-player--fullscreen) #videoPlayer > div,
        body.rx-live-two-col:not(.rumble-player--fullscreen) [id^="vid_v"] {
            width: 100% !important; height: 100% !important; max-height: none !important; background-color: #000;
        }
        body.rx-live-two-col:not(.rumble-player--fullscreen) #videoPlayer video {
            width: 100% !important; height: 100% !important; object-fit: contain;
        }
        body.rx-live-two-col.rx-live-chat-collapsed:not(.rumble-player--fullscreen) .main-and-sidebar {
            display: block !important;
        }
        body.rx-live-two-col.rx-live-chat-collapsed:not(.rumble-player--fullscreen) .video-player,
        body.rx-live-two-col.rx-live-chat-collapsed:not(.rumble-player--fullscreen) [id^="vid_v"] {
            width: 100vw !important; height: calc(100vw * 9 / 16) !important; max-height: 100vh !important; margin-top: 0;
        }
        @media (max-width: 1100px) {
            body.rx-live-two-col:not(.rumble-player--fullscreen) .main-and-sidebar {
                grid-template-columns: 1fr; align-items: start; width: auto; max-width: 100%;
            }
            body.rx-live-two-col:not(.rumble-player--fullscreen) aside.media-page-chat-aside-chat {
                width: 100% !important; min-width: 0 !important; max-width: none !important; height: 70vh;
            }
            body.rx-live-two-col:not(.rumble-player--fullscreen) .video-player { margin-top: 0; }
        }
        body.rx-live-two-col button.media-page-chat-container-toggle-btn { z-index: 2; }
    `,

    _activateLive() {
        document.body.classList.add('rx-live-two-col');
        const setChatWidthVar = () => {
            const chat = qs('aside.media-page-chat-aside-chat');
            let w = 360;
            if (chat && getComputedStyle(chat).display !== 'none') {
                const rect = chat.getBoundingClientRect();
                w = Math.max(320, Math.min(Math.round(rect.width || 360), 480));
            }
            document.documentElement.style.setProperty('--rx-chat-w', `${w}px`);
        };
        setChatWidthVar();
        this._resizeHandler = setChatWidthVar;
        window.addEventListener('resize', this._resizeHandler);
        waitFor('aside.media-page-chat-aside-chat', 15000).then((chat) => {
            this._liveObs = new MutationObserver(setChatWidthVar);
            this._liveObs.observe(chat, { attributes: true, attributeFilter: ['style', 'class'] });
        }).catch(() => {});
        this._chatToggleHandler = (e) => {
            const btn = e.target.closest('[data-js="media_page_chat_container_toggle_btn"]');
            if (!btn) return;
            setTimeout(() => {
                const chat = qs('aside.media-page-chat-aside-chat');
                const hidden = chat && getComputedStyle(chat).display === 'none';
                document.body.classList.toggle('rx-live-chat-collapsed', !!hidden);
            }, 50);
        };
        document.addEventListener('click', this._chatToggleHandler, true);
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        // Defer so the page's live badge renders first.
        setTimeout(() => {
            const isLive = !!qs('.video-header-live-info, .media-header-live-badge, .video-badge--live') || Page.isLive();
            if (isLive) {
                this._styleEl = injectStyle(this._liveCss, 'rx-fullwidth-css');
                this._activateLive();
            } else {
                this._styleEl = injectStyle(this._standardCss, 'rx-fullwidth-css');
                document.body.classList.add('rx-full-width-player');
            }
        }, 250);
    },
    destroy() {
        this._liveObs?.disconnect();
        this._liveObs = null;
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        this._resizeHandler = null;
        if (this._chatToggleHandler) document.removeEventListener('click', this._chatToggleHandler, true);
        this._chatToggleHandler = null;
        document.documentElement.style.removeProperty('--rx-chat-w');
        this._styleEl?.remove();
        document.body.classList.remove('rx-full-width-player', 'rx-live-two-col', 'rx-live-chat-collapsed');
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Adaptive Live Layout
// ═══════════════════════════════════════════
// On live pages, widens the main content whenever chat is visible. Plays
// nicely with FullWidthPlayer's live mode — but either is usable alone.
const AdaptiveLiveLayout = {
    id: 'adaptiveLiveLayout',
    name: 'Adaptive Live Layout',
    _obs: null,
    _styleId: 'rx-adaptive-live-css',

    _applyStyles(isChatVisible) {
        const css = isChatVisible
            ? `body:not(.rx-full-width-player):not(.rx-live-two-col) .main-and-sidebar .main-content { width: calc(100% - 350px) !important; max-width: none !important; }`
            : '';
        injectStyle(css, this._styleId);
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        if (!qs('.video-header-live-info')) return;
        waitFor('aside.media-page-chat-aside-chat', 15000).then((chat) => {
            this._obs = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.attributeName === 'style') {
                        const visible = getComputedStyle(m.target).display !== 'none';
                        this._applyStyles(visible);
                    }
                }
            });
            this._obs.observe(chat, { attributes: true, attributeFilter: ['style'] });
            this._applyStyles(getComputedStyle(chat).display !== 'none');
        }).catch(() => {});
    },
    destroy() {
        this._obs?.disconnect();
        this._obs = null;
        document.getElementById(this._styleId)?.remove();
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Comment Blocking (parallel to ChatUserBlock for comments)
// ═══════════════════════════════════════════
const CommentBlocking = {
    id: 'commentBlocking',
    name: 'Comment Blocking',
    _styleEl: null,
    _obs: null,

    _css: `
        .rx-blocked-comment { display: none !important; }
        .rx-comment-block-btn {
            margin-left: 8px; padding: 2px 8px;
            background: rgba(243,139,168,0.12); border: 1px solid rgba(243,139,168,0.3);
            color: #f38ba8; border-radius: 4px; cursor: pointer; opacity: 0;
            font: 600 10px/1.2 system-ui, sans-serif;
            transition: opacity .15s, background .15s;
        }
        .comment-item:hover .rx-comment-block-btn { opacity: 1; }
        .rx-comment-block-btn:hover { background: rgba(243,139,168,0.25); }
    `,

    _blocked() {
        return new Set((Settings.get('blockedCommenters') || []).map((u) => String(u).toLowerCase()));
    },

    _apply() {
        const blocked = this._blocked();
        for (const c of qsa('li.comment-item[data-username]')) {
            const u = (c.dataset.username || '').toLowerCase();
            c.classList.toggle('rx-blocked-comment', !!u && blocked.has(u));
            if (c.dataset.rxBlockBtn) continue;
            const meta = c.querySelector('.comments-meta');
            if (!meta) continue;
            c.dataset.rxBlockBtn = '1';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rx-comment-block-btn';
            btn.textContent = 'Block';
            btn.title = `Block ${u} from comments`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const list = Settings.get('blockedCommenters') || [];
                if (!list.map((x) => String(x).toLowerCase()).includes(u) && u) {
                    list.push(u);
                    Settings.set('blockedCommenters', list);
                }
                this._apply();
            });
            meta.appendChild(btn);
        }
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-commentblock-css');
        waitFor('#video-comments, .media-page-comments-container', 15000).then((root) => {
            this._apply();
            this._obs = new MutationObserver(() => this._apply());
            this._obs.observe(root, { childList: true, subtree: true });
        }).catch(() => {});
    },
    destroy() {
        this._obs?.disconnect();
        this._obs = null;
        this._styleEl?.remove();
        for (const c of qsa('li.comment-item[data-rx-block-btn]')) delete c.dataset.rxBlockBtn;
        for (const b of qsa('.rx-comment-block-btn')) b.remove();
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Site Theme sync (mirror Rumble's native light/dark/system)
// ═══════════════════════════════════════════
const SiteTheme = {
    id: 'siteTheme',
    name: 'Site Theme Sync',
    _obs: null,

    // Settings.get('siteTheme') is a string: 'system' | 'dark' | 'light'
    _apply(themeValue) {
        const target = qs(`a.main-menu-item.theme-option[data-theme-option="${themeValue}"]`);
        if (target instanceof HTMLElement && !target.classList.contains('main-menu-item--active')) {
            try { target.click(); } catch {}
        }
    },

    _sync() {
        const activeEl = qs('a.main-menu-item.theme-option.main-menu-item--active');
        const active = activeEl?.dataset?.themeOption || 'system';
        if (Settings.get('siteTheme') !== active) {
            Settings.set('siteTheme', active);
        }
    },

    init() {
        if (!Settings.get('siteThemeSync')) return;
        this._apply(Settings.get('siteTheme') || 'system');
        waitFor('.theme-option-group', 15000).then((el) => {
            this._obs = new MutationObserver(() => this._sync());
            this._obs.observe(el, { attributes: true, subtree: true, attributeFilter: ['class'] });
        }).catch(() => {});
    },
    destroy() {
        this._obs?.disconnect();
        this._obs = null;
    },
};

// ═══════════════════════════════════════════
//  FEATURE REGISTRY & INIT
// ═══════════════════════════════════════════
const features = [
    AdNuker, FeedCleanup, HidePremium, CategoryFilter, DarkEnhance, TheaterSplit,
    VideoDownloader, LogoToFeed, SpeedController, ScrollVolume, AutoMaxQuality,
    WatchProgress, ChannelBlocker, KeyboardNav, AutoTheater, LiveChatEnhance,
    VideoTimestamps, ScreenshotBtn, WatchHistoryFeature, AutoplayBlock,
    SearchHistory, MiniPlayer, VideoStats, LoopControl, QuickBookmark, CommentNav,
    RantHighlight, RelatedFilter, ExactCounts, ShareTimestamp, ShortsFilter,
    ChatAutoScroll, AutoExpand, NotifEnhance, PlaylistQuickSave,
    // v1.8.0 additions
    FullTitles, TitleFont, UniqueChatters, ChatUserBlock, ChatSpamDedup,
    ChatExport, RantPersist, CommentSort, PopoutChat, KeywordFilter,
    AutoplayScheduler, Chapters, SponsorBlockRX, VideoClips, LiveDVR,
    SubtitleSidecar, Transcripts, AudioOnly, BatchDownload,
    // v1.9.0 — Rumble Enhancement Suite port
    AutoHideHeader, AutoHideNavSidebar, AutoLike, AutoLoadComments,
    FullWidthPlayer, AdaptiveLiveLayout, CommentBlocking, SiteTheme,
    ...RX_CSS_FEATURES,
];

async function boot() {
    await Settings.init();

    onReady(() => {
        for (const feat of features) {
            try { feat.init(); } catch (e) { console.error(`[RumbleX] ${feat.id || feat.name} init failed:`, e); }
        }
        try { SettingsPanel.init(); } catch (e) { console.error('[RumbleX] Settings panel init failed:', e); }

        // Surface cross-tab / options-page saves. We don't silently hot-reload
        // features here because most of them stash state in their init path;
        // the user-visible toast prompts a reload so the new config actually
        // takes effect. (Hot-reload still works from the in-page modal via
        // the Switch change-handler, which destroys + re-inits per feature.)
        Settings.onExternalChange((isReset) => {
            try {
                SettingsPanel._showToast?.(isReset
                    ? 'RumbleX was reset — reload to see defaults'
                    : 'Settings changed elsewhere — reload to apply');
            } catch {}
        });

        console.log(`[RumbleX] v${VERSION} loaded - ${features.filter(f => Settings.get(f.id)).map(f => f.name).join(', ')}`);
    });
}

boot();

// The per-feature localStorage keys we write on Rumble's origin. Kept in one
// place so the options-page "Reset All Data" action can actually wipe them —
// the options page lives in the extension origin and cannot touch Rumble's
// localStorage directly. On reset it messages the active tab to self-clear.
const RX_LOCAL_STORAGE_KEYS = [
    'rx_volume',
    'rx_watch_progress',
    'rx_watch_history',
    'rx_search_history',
    'rx_bookmarks',
];
// Plus any key starting with these prefixes (per-video caches).
const RX_LOCAL_STORAGE_PREFIXES = ['rx_rants_'];

function rxClearLocalStorage() {
    let cleared = 0;
    try {
        for (const k of RX_LOCAL_STORAGE_KEYS) {
            if (localStorage.getItem(k) !== null) { localStorage.removeItem(k); cleared++; }
        }
        // Collect prefix-matched keys first (removing while iterating shifts
        // indices) then delete.
        const toDrop = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && RX_LOCAL_STORAGE_PREFIXES.some((p) => k.startsWith(p))) toDrop.push(k);
        }
        for (const k of toDrop) { localStorage.removeItem(k); cleared++; }
    } catch (e) {
        console.warn('[RumbleX] localStorage clear failed:', e);
    }
    return cleared;
}

// Read every RumbleX-owned localStorage key on this origin into a plain
// object. Used by the options page to include per-site data (bookmarks,
// watch progress, rant archives…) in Export Backup so a reset/restore
// cycle actually round-trips the user's full state.
function rxReadLocalStorage() {
    const out = {};
    try {
        for (const k of RX_LOCAL_STORAGE_KEYS) {
            const v = localStorage.getItem(k);
            if (v !== null) out[k] = v;
        }
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (RX_LOCAL_STORAGE_PREFIXES.some((p) => k.startsWith(p))) {
                out[k] = localStorage.getItem(k);
            }
        }
    } catch (e) {
        console.warn('[RumbleX] localStorage read failed:', e);
    }
    return out;
}

// Restore values written by rxReadLocalStorage. Only accepts string values
// and keys that match our known list or prefixes, so an imported file can't
// smuggle unrelated keys onto rumble.com's origin.
function rxWriteLocalStorage(data) {
    if (!data || typeof data !== 'object') return 0;
    let written = 0;
    const allowed = (k) => RX_LOCAL_STORAGE_KEYS.includes(k)
        || RX_LOCAL_STORAGE_PREFIXES.some((p) => k.startsWith(p));
    try {
        for (const [k, v] of Object.entries(data)) {
            if (typeof k !== 'string' || typeof v !== 'string') continue;
            if (!allowed(k)) continue;
            // chrome.storage.local has no quota on file; localStorage does
            // (5–10 MB). If we blow it, stop writing rather than throw.
            try { localStorage.setItem(k, v); written++; } catch { break; }
        }
    } catch (e) {
        console.warn('[RumbleX] localStorage write failed:', e);
    }
    return written;
}

// Listen for control messages from popup / background / options.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.action === 'openSettingsModal') {
        document.body.classList.add('rx-panel-open');
        return;
    }
    if (msg.action === 'clearLocalData') {
        const cleared = rxClearLocalStorage();
        sendResponse({ ok: true, cleared });
        return true; // keep the channel open for async sendResponse
    }
    if (msg.action === 'getLocalData') {
        const data = rxReadLocalStorage();
        sendResponse({ ok: true, data, keys: Object.keys(data).length });
        return true;
    }
    if (msg.action === 'setLocalData') {
        const written = rxWriteLocalStorage(msg.data);
        sendResponse({ ok: true, written });
        return true;
    }
});
