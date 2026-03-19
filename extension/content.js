// RumbleX v1.7.0 - Content Script
// Rumble enhancement suite - Chrome/Firefox extension
'use strict';

// ── Version ──
const VERSION = '1.7.0';

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
    },
    async init() {
        const data = await chrome.storage.local.get('rx_settings');
        this._cache = { ...this._defaults, ...(data.rx_settings || {}) };
        this._ready = true;
    },
    get(key) {
        if (!this._cache) return this._defaults[key];
        return this._cache[key];
    },
    set(key, val) {
        this._cache[key] = val;
        chrome.storage.local.set({ rx_settings: this._cache });
    },
    toggle(key) {
        const v = !this.get(key);
        this.set(key, v);
        return v;
    }
};

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
    `,

    _downloadSVG: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',

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
        TheaterSplit._switchTab('download');
        const panel = qs('#rx-tab-download');
        if (!panel || panel.dataset.loaded) return;
        panel.dataset.loaded = '1';
        this._loadQualities();
    },

    _getBody() {
        return qs('#rx-tab-download .rx-dl-body');
    },

    _setBody(html) {
        const body = this._getBody();
        if (body) body.innerHTML = html;
        return body;
    },

    async _loadQualities() {
        const embedId = this._getEmbedId();
        if (!embedId) { this._setBody('<div class="rx-dl-error">Could not find video embed ID</div>'); return; }

        try {
            const data = await this._fetchEmbedData(embedId);
            this._embedData = data;
            console.log('[RumbleX] Embed API response:', JSON.stringify(data.ua || data.u, null, 2));
            this._hlsUrl = data.u?.hls?.auto?.url || data.ua?.hls?.auto?.url || `https://rumble.com/hls-vod/${embedId.replace('v','')}/playlist.m3u8`;
            const qualities = this._parseQualities(data);

            if (!qualities.length) { this._setBody('<div class="rx-dl-error">No downloadable qualities found</div>'); return; }

            const body = this._setBody('');
            const title = this._getTitle();

            for (const q of qualities) {
                const row = document.createElement('div');
                row.className = 'rx-dl-quality';
                const sizeInfo = q.size ? ` - ~${this._formatSize(q.size)}` : '';
                const bitrateInfo = q.bitrate ? ` - ${q.bitrate} kbps` : '';
                const dimInfo = q.width ? `${q.width}x${q.height}` : `${q.height}p`;
                const directBadge = q.directUrl ? ' (Direct MP4)' : ' (HLS)';
                row.innerHTML = `
                    <div>
                        <div class="rx-dl-quality-label">${q.label} ${q.height >= 720 ? '(HD)' : ''}${directBadge}</div>
                        <div class="rx-dl-quality-meta">${dimInfo}${bitrateInfo}${sizeInfo}</div>
                    </div>`;
                row.addEventListener('click', () => this._showFormatPicker(q, title));
                body.appendChild(row);
            }
        } catch (e) {
            this._setBody(`<div class="rx-dl-error">Failed to load video data: ${e.message}</div>`);
        }
    },

    _showFormatPicker(quality, title) {
        // If direct MP4 URL available, skip format picker and download directly
        if (quality.directUrl) {
            this._startDirectDownload(quality, title);
            return;
        }

        const body = this._setBody(`
            <div class="rx-dl-status">Selected: ${quality.label} (${quality.width}x${quality.height})</div>
            <div class="rx-dl-format-row"></div>`);

        const row = body.querySelector('.rx-dl-format-row');

        const mp4Btn = document.createElement('button');
        mp4Btn.className = 'rx-dl-format-btn';
        mp4Btn.innerHTML = 'MP4<small>Converted in browser</small>';
        mp4Btn.addEventListener('click', () => this._startDownload(quality, title, 'mp4'));

        const tsBtn = document.createElement('button');
        tsBtn.className = 'rx-dl-format-btn';
        tsBtn.innerHTML = 'TS<small>Raw stream (fast)</small>';
        tsBtn.addEventListener('click', () => this._startDownload(quality, title, 'ts'));

        row.appendChild(mp4Btn);
        row.appendChild(tsBtn);
    },

    async _startDirectDownload(quality, title) {
        const filename = `${title} - ${quality.label}.mp4`;
        console.log('[RumbleX] Direct download:', quality.directUrl, filename);

        this._setBody(`
            <div class="rx-dl-progress-wrap">
                <div class="rx-dl-status">Starting download via browser...</div>
            </div>`);

        try {
            // Use chrome.downloads API via background script for proper cookie/redirect handling
            chrome.runtime.sendMessage({
                action: 'download',
                data: { url: quality.directUrl, filename }
            }, (resp) => {
                if (chrome.runtime.lastError) {
                    console.error('[RumbleX] Download message error:', chrome.runtime.lastError);
                    this._setBody(`<div class="rx-dl-error">Download failed: ${chrome.runtime.lastError.message}</div>`);
                    return;
                }
                if (resp?.downloadId) {
                    this._setBody('<div class="rx-dl-done">Download started! Check your browser downloads.</div>');
                } else {
                    this._setBody('<div class="rx-dl-error">Download failed to start</div>');
                }
            });
        } catch (e) {
            this._setBody(`<div class="rx-dl-error">Error: ${e.message}</div>`);
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
        }
    },

    _bindVideo(video) {
        if (video.dataset.rxVolBound) return;
        video.dataset.rxVolBound = '1';
        this._restoreVolume(video);
        video.addEventListener('loadedmetadata', () => this._restoreVolume(video));
        video.addEventListener('play', () => this._restoreVolume(video), { once: true });
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
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._overlayEl?.remove();
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

    _selectBest() {
        if (this._attempted) return;
        // Rumble's quality menu: find the settings gear, open it, pick highest
        // The player uses class .touched_overlay_item for the settings button area
        const settingsBtn = qs('.touched_overlay_item + div button, [class*="quality-menu"], .videoPlayer-Rumble-cls button[aria-label*="Settings"]');
        if (settingsBtn) {
            this._attempted = true;
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
            // Click the highest quality (first item is usually highest, or sort by resolution)
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

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._attempted = false;

        // Try multiple times as the player loads async
        const attempts = [1500, 3000, 5000, 8000];
        for (const delay of attempts) {
            setTimeout(() => {
                if (!this._attempted) this._selectBest();
            }, delay);
        }

        // Also watch for player DOM changes
        this._obs = new MutationObserver(() => {
            if (!this._attempted) this._selectBest();
        });
        waitFor('#videoPlayer, .videoPlayer-Rumble-cls').then(el => {
            this._obs.observe(el, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._obs?.disconnect();
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

        const resume = () => {
            video.currentTime = entry.t;
            toast.classList.remove('rx-visible');
            setTimeout(() => toast.remove(), 300);
        };

        toast.addEventListener('click', resume);

        // Auto-dismiss after 8s
        setTimeout(() => {
            toast.classList.remove('rx-visible');
            setTimeout(() => toast.remove(), 300);
        }, 8000);
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
            // Highlight @mentions
            el.innerHTML = el.innerHTML.replace(/@(\w+)/g, '<span class="rx-chat-mention">@$1</span>');
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
            document.addEventListener('click', (e) => {
                if (!wrapper.contains(e.target)) this._dropdown.classList.remove('show');
            });

            // Record on form submit
            const form = input.closest('form');
            if (form) {
                form.addEventListener('submit', () => {
                    this._recordSearch(input.value);
                });
            }
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._dropdown?.remove();
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
            z-index: 99999;
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
        this._mini.addEventListener('mousedown', (e) => {
            if (e.target.closest('.rx-miniplayer-close')) return;
            this._dragState = {
                x: e.clientX - this._mini.offsetLeft,
                y: e.clientY - this._mini.offsetTop
            };
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!this._dragState) return;
            const x = Math.max(0, Math.min(window.innerWidth - this._mini.offsetWidth, e.clientX - this._dragState.x));
            const y = Math.max(0, Math.min(window.innerHeight - this._mini.offsetHeight, e.clientY - this._dragState.y));
            this._mini.style.left = x + 'px';
            this._mini.style.top = y + 'px';
            this._mini.style.right = 'auto';
            this._mini.style.bottom = 'auto';
        });
        document.addEventListener('mouseup', () => { this._dragState = null; });
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
            this._obs = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) {
                        // Don't activate mini player in TheaterSplit mode - player is always visible
                        if (TheaterSplit._isActive) return;
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
        this._styleEl?.remove();
        this._mini?.remove();
        this._obs?.disconnect();
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

        // Also click any "Show more" button that exists
        waitFor('.media-description-section').then(() => {
            setTimeout(() => {
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
            { id: 'autoMaxQuality', label: 'Auto Max Quality', desc: 'Auto-select highest resolution on load' },
            { id: 'autoplayBlock', label: 'Autoplay Block', desc: 'Prevent auto-play of next video' },
            { id: 'loopControl', label: 'Loop Control', desc: 'Full video loop + A-B segment loop' },
            { id: 'miniPlayer', label: 'Mini Player', desc: 'Floating draggable video when scrolling away' },
            { id: 'keyboardNav', label: 'Keyboard Nav', desc: 'YouTube-style hotkeys (J/K/L, F, M, 0-9)' },
            { id: 'videoStats', label: 'Video Stats', desc: 'Resolution, codec, buffer, frames overlay' },
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
        ],
    },
    {
        id: 'downloads', label: 'Downloads & Capture', color: '#f9e2af',
        icon: '<path d="M12 3a1 1 0 011 1v9.59l3.3-3.3a1 1 0 011.4 1.42l-5 5a1 1 0 01-1.4 0l-5-5a1 1 0 011.4-1.42L11 13.59V4a1 1 0 011-1zM5 19a1 1 0 100 2h14a1 1 0 100-2H5z"/>',
        features: [
            { id: 'videoDownload', label: 'Video Download', desc: 'Download as direct MP4 or HLS-to-MP4/TS' },
            { id: 'screenshotBtn', label: 'Screenshot', desc: 'Capture current video frame as PNG' },
            { id: 'shareTimestamp', label: 'Share@Time', desc: 'Copy video URL at current playback time' },
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
            { id: 'videoTimestamps', label: 'Timestamps', desc: 'Clickable timestamps in comments/description' },
            { id: 'commentNav', label: 'Comment Nav', desc: 'Navigate, expand/collapse, OP-only filter' },
            { id: 'rantHighlight', label: 'Rant Highlight', desc: 'Glow rants by tier + running $ total' },
        ],
    },
    {
        id: 'feed-controls', label: 'Feed Controls', color: '#74c7ec',
        icon: '<path d="M3 5a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 5a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm5 5a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z"/>',
        features: [
            { id: 'channelBlocker', label: 'Channel Blocker', desc: 'Block/hide channels from all feeds' },
            { id: 'relatedFilter', label: 'Related Filter', desc: 'Search & filter related sidebar videos' },
            { id: 'exactCounts', label: 'Exact Counts', desc: 'Show full numbers instead of 1.2K/3.5M' },
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

        /* ── Responsive ── */
        @media (max-width: 700px) {
            #rx-modal { width: 98%; height: 90vh; max-height: none; border-radius: 14px; }
            .rx-m-sidebar { width: 56px; padding: 6px 4px; }
            .rx-m-nav-btn span:not(.rx-m-nav-icon) { display: none; }
            .rx-m-nav-icon { width: 36px; height: 36px; }
            .rx-m-search-wrap { display: none; }
        }
    `,

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
        info.innerHTML = `<div class="rx-m-card-name">${feat.label}</div><div class="rx-m-card-desc">${feat.desc}</div>`;
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
        if (cat.id === 'feed-controls') this._buildBlockedSection(pane);
        if (cat.id === 'ad-blocking') this._buildCategorySection(pane);

        return pane;
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
            chip.innerHTML = `<span class="rx-m-theme-dot" style="background:${theme.accent}"></span>${theme.label}`;
            chip.addEventListener('click', () => {
                Settings.set('theme', id);
                for (const c of grid.querySelectorAll('.rx-m-chip')) c.classList.remove('rx-m-chip-active');
                chip.classList.add('rx-m-chip-active');
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
                chip.innerHTML = `${ch} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
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
    }
};

// ═══════════════════════════════════════════
//  FEATURE REGISTRY & INIT
// ═══════════════════════════════════════════
const features = [AdNuker, FeedCleanup, HidePremium, CategoryFilter, DarkEnhance, TheaterSplit, VideoDownloader, LogoToFeed, SpeedController, ScrollVolume, AutoMaxQuality, WatchProgress, ChannelBlocker, KeyboardNav, AutoTheater, LiveChatEnhance, VideoTimestamps, ScreenshotBtn, WatchHistoryFeature, AutoplayBlock, SearchHistory, MiniPlayer, VideoStats, LoopControl, QuickBookmark, CommentNav, RantHighlight, RelatedFilter, ExactCounts, ShareTimestamp, ShortsFilter, ChatAutoScroll, AutoExpand, NotifEnhance, PlaylistQuickSave];

async function boot() {
    await Settings.init();

    onReady(() => {
        for (const feat of features) {
            try { feat.init(); } catch (e) { console.error(`[RumbleX] ${feat.id || feat.name} init failed:`, e); }
        }
        try { SettingsPanel.init(); } catch (e) { console.error('[RumbleX] Settings panel init failed:', e); }
        console.log(`[RumbleX] v${VERSION} loaded - ${features.filter(f => Settings.get(f.id)).map(f => f.name).join(', ')}`);
    });
}

boot();

// Listen for popup messages
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'openSettingsModal') {
        document.body.classList.add('rx-panel-open');
    }
});
