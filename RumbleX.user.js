// ==UserScript==
// @name         RumbleX
// @namespace    https://github.com/SysAdminDoc/RumbleX
// @version      0.4.0
// @description  Rumble enhancement suite - ad/bloat removal, theater split view, and dark theme polish.
// @author       SysAdminDoc
// @license      MIT
// @match        https://rumble.com/*
// @match        https://*.rumble.com/*
// @icon         https://rumble.com/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      rumble.com
// @connect      1a-1791.com
// @connect      cdn.jsdelivr.net
// @run-at       document-start
// ==/UserScript==

(function RumbleX() {
    'use strict';

    // ── Version ──
    const VERSION = '0.3.0';

    // ── Settings Manager ──
    const Settings = {
        _cache: null,
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
        },
        get(key) {
            if (!this._cache) {
                this._cache = {};
                for (const [k, v] of Object.entries(this._defaults)) {
                    this._cache[k] = GM_getValue('rx_' + k, v);
                }
            }
            return this._cache[key];
        },
        set(key, val) {
            this._cache[key] = val;
            GM_setValue('rx_' + key, val);
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
    };

    // ── Anti-FOUC: Inject immediately at document-start ──
    const ANTI_FOUC_CSS = `
        /* ═══ RumbleX Anti-FOUC ═══ */
        html.rumblex-active #pause-ads__container,
        html.rumblex-active #pause-ads__backdrop,
        html.rumblex-active #pause-ads__backdrop_click,
        html.rumblex-active #pause-ads__play-button-container,
        html.rumblex-active #pause-ads__entity,
        html.rumblex-active .host-read-ad-entry,
        html.rumblex-active .js-host-read-container,
        html.rumblex-active .js-rac-desktop-container,
        html.rumblex-active .js-rac-tablet-container,
        html.rumblex-active .js-rac-mobile-container,
        html.rumblex-active [hx-get*="premium-value-prop"],
        html.rumblex-active .btn-premium-lg {
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
        document.head.appendChild(el);
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

    // ── Cross-origin fetch via GM_xmlhttpRequest ──
    function gmFetch(url, responseType = 'text') {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                responseType,
                onload: (r) => {
                    if (r.status >= 200 && r.status < 300) resolve(r.response);
                    else reject(new Error(`HTTP ${r.status} for ${url}`));
                },
                onerror: () => reject(new Error('Network error: ' + url)),
            });
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
            /* Pause ads overlay */
            #pause-ads__container,
            #pause-ads__backdrop,
            #pause-ads__backdrop_click,
            #pause-ads__play-button-container,
            #pause-ads__entity { display: none !important; }

            /* Host-read / sponsor ads */
            .host-read-ad-entry,
            .js-host-read-container { display: none !important; }

            /* RAC banner ad containers */
            .js-rac-desktop-container,
            .js-rac-tablet-container,
            .js-rac-mobile-container { display: none !important; }

            /* Premium upsell banners & buttons */
            [hx-get*="premium-value-prop"],
            .btn-premium-lg,
            a[href*="/premium"][class*="bg-"] { display: none !important; }

            /* Premium banner images */
            [style*="rumble-premium-banner"],
            [class*="rumble-premium-banner"] { display: none !important; }

            /* Generic ad iframes */
            iframe[src*="googlead"],
            iframe[src*="doubleclick"],
            iframe[src*="pagead"] { display: none !important; }
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
            /* Premium promo links in feed */
            .thumbnail__grid a[href*="/premium"],
            .streams__container a[href*="/premium"] { display: none !important; }

            /* Premium text badges */
            .text-link-green[href*="/premium"] { display: none !important; }

            /* Ad containers in feed */
            .js-rac-desktop-container,
            .js-rac-tablet-container,
            .js-rac-mobile-container { display: none !important; }

            /* Footer */
            footer.page__footer { display: none !important; }
        `,

        _repostCSS: `
            /* Hide reposted videos from feeds */
            .videostream--repost { display: none !important; }
        `,

        _wideCSS: `
            /* Full-width layout for homepage & subscriptions */
            .constrained {
                max-width: 100% !important;
                padding-left: 1.5rem !important;
                padding-right: 1.5rem !important;
            }

            /* Tighter grid: more columns, smaller gaps */
            .thumbnail__grid {
                gap: 12px !important;
            }

            /* More columns at each breakpoint */
            @supports (display:grid) {
                .thumbnail__grid {
                    grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
                }
            }
            @media (max-width: 1600px) {
                @supports (display:grid) {
                    .thumbnail__grid {
                        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
                    }
                }
            }
            @media (max-width: 1200px) {
                @supports (display:grid) {
                    .thumbnail__grid {
                        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                    }
                }
            }
            @media (max-width: 900px) {
                @supports (display:grid) {
                    .thumbnail__grid {
                        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
                    }
                }
            }
            @media (max-width: 600px) {
                @supports (display:grid) {
                    .thumbnail__grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                    }
                }
            }

            /* Tighter video card spacing */
            .videostream__footer {
                padding: 6px 4px 8px !important;
            }

            /* Homepage grid sections also go wider */
            .homepage-section .constrained {
                max-width: 100% !important;
            }
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
            // Match both <section id="section-{id}"> and <div id="section-{id}"> patterns,
            // plus hide parent .constrained wrapper when it contains a hidden section
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
    const DarkEnhance = {
        id: 'darkEnhance',
        name: 'Dark Theme',
        _styleEl: null,

        _css: `
            /* ═══ Catppuccin Mocha overrides ═══ */
            :root {
                --rx-base: #1e1e2e;
                --rx-mantle: #181825;
                --rx-crust: #11111b;
                --rx-surface0: #313244;
                --rx-surface1: #45475a;
                --rx-text: #cdd6f4;
                --rx-subtext: #a6adc8;
                --rx-accent: #89b4fa;
                --rx-green: #a6e3a1;
                --rx-red: #f38ba8;
                --rx-overlay: rgba(17, 17, 27, 0.85);
            }

            html.rumblex-active body {
                background-color: var(--rx-crust) !important;
                color: var(--rx-text) !important;
            }

            /* Header */
            html.rumblex-active .header {
                background: var(--rx-mantle) !important;
                border-bottom: 1px solid var(--rx-surface0) !important;
            }

            /* Sidebar nav */
            html.rumblex-active nav,
            html.rumblex-active .sidenav {
                background: var(--rx-mantle) !important;
            }

            /* Video cards */
            html.rumblex-active .videostream {
                background: var(--rx-base) !important;
                border-color: var(--rx-surface0) !important;
            }

            /* Comments */
            html.rumblex-active .comment-item {
                border-color: var(--rx-surface0) !important;
            }

            /* Branded scrollbar */
            html.rumblex-active ::-webkit-scrollbar { width: 8px; height: 8px; }
            html.rumblex-active ::-webkit-scrollbar-track { background: var(--rx-crust); }
            html.rumblex-active ::-webkit-scrollbar-thumb {
                background: var(--rx-surface1);
                border-radius: 4px;
            }
            html.rumblex-active ::-webkit-scrollbar-thumb:hover {
                background: var(--rx-accent);
            }

            /* Footer */
            html.rumblex-active .page__footer {
                background: var(--rx-mantle) !important;
            }
        `,

        init() {
            if (!Settings.get(this.id)) return;
            this._styleEl = injectStyle(this._css, 'rx-darkenhance');
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

        // State
        _isSplit: false,
        _isActive: false,
        _isLive: false,
        _activeTab: 'chat', // 'chat' or 'comments'
        _splitWrapper: null,
        _origPlayerParent: null,
        _origPlayerNext: null,
        _origChatParent: null,
        _origChatNext: null,
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
            /* ═══ Theater Split Layout ═══ */

            /* Lock body scroll when theater is active */
            html.rx-theater,
            html.rx-theater body {
                overflow: hidden !important;
            }

            /* Hide page chrome when theater is active */
            html.rx-theater .header,
            html.rx-theater .page__footer,
            html.rx-theater nav.sidenav,
            html.rx-theater .media-page-related-media-mobile {
                display: none !important;
            }

            /* Hide default page content behind overlay */
            html.rx-theater main.nonconstrained {
                visibility: hidden !important;
            }

            /* Split wrapper - fullscreen fixed overlay */
            #rx-split-wrapper {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                z-index: 9999;
                display: flex;
                flex-direction: row;
                background: #000;
                overflow: hidden;
            }

            /* Left panel - video */
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

            /* Divider */
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
            #rx-split-divider.rx-dragging {
                background: rgba(137,180,250,0.35);
            }
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

            /* Right panel - comments */
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
            /* When tabbed (live), right panel is flex container - tabs scroll themselves */
            #rx-split-right.rx-tabbed {
                overflow: hidden !important;
            }

            /* Right panel scrollbar */
            #rx-split-right::-webkit-scrollbar { width: 5px; }
            #rx-split-right::-webkit-scrollbar-track { background: transparent; }
            #rx-split-right::-webkit-scrollbar-thumb {
                background: rgba(255,255,255,0.14);
                border-radius: 3px;
            }
            #rx-split-right::-webkit-scrollbar-thumb:hover {
                background: rgba(255,255,255,0.28);
            }

            /* Kill inner scrollbar - only outer panel scrolls */
            #rx-split-right .media-page-comments-container,
            #rx-split-right #video-comments,
            #rx-split-right .comments-1 {
                overflow: visible !important;
                max-height: none !important;
                height: auto !important;
            }

            /* Compact comments in split */
            #rx-split-right .comment-item {
                padding: 8px 12px !important;
                border-bottom: 1px solid rgba(255,255,255,0.06) !important;
            }
            #rx-split-right .comments-meta-author {
                font-size: 12px !important;
            }
            #rx-split-right .comment-text {
                font-size: 13px !important;
                line-height: 1.4 !important;
            }

            /* Close button */
            #rx-split-close {
                position: absolute;
                bottom: 16px; right: 16px;
                z-index: 25;
                width: 34px; height: 34px;
                border-radius: 50%;
                background: rgba(0,0,0,0.55);
                color: rgba(255,255,255,0.6);
                border: 1px solid rgba(255,255,255,0.1);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.2s, background 0.15s;
                font-size: 0;
            }
            #rx-split-left:hover #rx-split-close { opacity: 1; }
            #rx-split-close:hover {
                background: rgba(243,139,168,0.75);
                color: #fff;
            }

            /* Scroll hint arrow */
            #rx-scroll-hint {
                position: absolute;
                bottom: 18px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 20;
                color: rgba(255,255,255,0.35);
                animation: rx-bounce 2s ease-in-out infinite;
                pointer-events: none;
                transition: opacity 0.3s;
            }
            html.rx-theater.rx-split #rx-scroll-hint { opacity: 0; }

            @keyframes rx-bounce {
                0%, 100% { transform: translateX(-50%) translateY(0); }
                50% { transform: translateX(-50%) translateY(8px); }
            }

            /* Video info header in right panel */
            #rx-split-right .rx-panel-header {
                padding: 12px 12px 10px 16px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
                flex-shrink: 0;
                display: flex;
                align-items: flex-start;
                gap: 10px;
            }
            #rx-split-right .rx-panel-header .rx-header-info {
                flex: 1;
                min-width: 0;
            }
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
            #rx-split-right .rx-panel-header .rx-hdr-btn svg {
                width: 16px; height: 16px;
            }
            #rx-split-right .rx-panel-header #rx-hdr-home:hover {
                border-color: rgba(133,213,81,0.5);
            }
            #rx-split-right .rx-panel-header #rx-hdr-settings.rx-open svg {
                transform: rotate(60deg);
            }
            #rx-split-right .rx-panel-header #rx-hdr-settings svg {
                transition: transform 0.3s cubic-bezier(.4,0,.2,1);
            }

            /* ═══ Tab Switcher (Live Chat / Comments) ═══ */
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

            /* Live chat content in right panel */
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
            #rx-tab-chat .media-page-chat-container-toggle-btn {
                display: none !important;
            }
            #rx-tab-chat .chat--header {
                flex-shrink: 0;
            }
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
            #rx-tab-chat .chat-form-overflow-wrapper {
                flex-shrink: 0;
            }

            /* Tab content panels */
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

            /* Hide original chat sidebar when theater active */
            html.rx-theater .media-page-chat-aside-chat {
                display: none !important;
            }
            /* But show when reparented inside our panel */
            #rx-tab-chat .media-page-chat-aside-chat {
                display: flex !important;
            }

            /* Collapse-to-top strip */
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

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.id = 'rx-split-close';
            closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            closeBtn.title = 'Exit Theater';
            closeBtn.addEventListener('click', () => this._unmount());
            left.appendChild(closeBtn);

            // Scroll hint
            const hint = document.createElement('div');
            hint.id = 'rx-scroll-hint';
            hint.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>';
            left.appendChild(hint);

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

                // Drag shield prevents iframes from eating events
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

            // Populate right panel with video info + comments
            this._populateRight(right);

            // Attach right-panel scroll handlers for collapse
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
            homeBtn.href = 'https://rumble.com/';
            homeBtn.title = 'Rumble Home';
            homeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 3C4.015 3 2 5.015 2 7.5v9C2 18.985 4.015 21 6.5 21h11c2.485 0 4.5-2.015 4.5-4.5v-9C22 5.015 19.985 3 17.5 3h-11zm3.25 4.5c.69 0 1.25.56 1.25 1.25v1.5l2.5-2.25c.33-.3.76-.5 1.22-.5h.78c.97 0 1.45 1.17.77 1.85L13.5 12l2.72 2.65c.68.68.2 1.85-.77 1.85h-.78c-.46 0-.89-.18-1.22-.5L11 13.75v1.5c0 .69-.56 1.25-1.25 1.25S8.5 15.94 8.5 15.25v-7.5c0-.69.56-1.25 1.25-1.25z" fill="#85d551"/></svg>';

            const gearBtn = document.createElement('button');
            gearBtn.id = 'rx-hdr-settings';
            gearBtn.className = 'rx-hdr-btn';
            gearBtn.title = 'RumbleX Settings';
            gearBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

            gearBtn.addEventListener('click', () => {
                const panel = qs('#rx-settings-panel');
                if (panel) {
                    const isOpen = panel.classList.toggle('rx-visible');
                    gearBtn.classList.toggle('rx-open', isOpen);
                }
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
            // Avoid re-populating
            if (right.querySelector('.rx-panel-header')) return;

            right.innerHTML = '';
            this._isLive = this._detectLive();

            // Collapse strip at top
            const strip = document.createElement('div');
            strip.id = 'rx-collapse-strip';
            strip.title = 'Scroll up to collapse';
            strip.addEventListener('click', () => this._collapseSplit());
            right.appendChild(strip);

            // Video info header with nav buttons
            right.appendChild(this._buildHeader());

            // ── Always use tabbed layout ──
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

            // Chat tab content (live only) - reparent the actual live chat
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

            // Comments tab content
            const commentsPanel = document.createElement('div');
            commentsPanel.id = 'rx-tab-comments';
            commentsPanel.className = 'rx-tab-content' + (this._isLive ? '' : ' rx-tab-visible');

            const commentsSource = qs('.media-page-comments-container') || qs('#video-comments');
            if (commentsSource) {
                const commentsClone = commentsSource.cloneNode(true);
                commentsClone.style.display = 'block';
                commentsClone.style.padding = '0 8px';
                commentsPanel.appendChild(commentsClone);
            } else {
                commentsPanel.innerHTML = '<div style="padding:20px;color:rgba(255,255,255,0.4);text-align:center;font-size:13px;">No comments yet</div>';
            }
            right.appendChild(commentsPanel);

            // Download tab content
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

            // Save original position
            this._origPlayerParent = player.parentElement;
            this._origPlayerNext = player.nextSibling;

            // Build overlay
            const { wrapper, left, divider, right } = this._buildOverlay();
            this._splitWrapper = wrapper;

            // Preserve playback state
            const video = player.querySelector('video');
            const wasPlaying = video && !video.paused;

            // Reparent player into left panel
            left.insertBefore(player, left.firstChild);

            document.body.appendChild(wrapper);

            // Resume playback if needed
            if (wasPlaying && video) {
                requestAnimationFrame(() => video.play().catch(() => {}));
            }

            // Init divider drag
            this._initDividerDrag(divider, left, right);

            // Scroll handlers on left panel (capture phase)
            this._wheelHandler = (e) => {
                if (!this._isSplit && e.deltaY > 0) {
                    this._expandSplit();
                    return;
                }
                // When split, forward scroll or collapse
                if (this._isSplit) {
                    // On live chat tab, forward scroll to chat history or collapse
                    if (this._isLive && this._activeTab === 'chat') {
                        const chatList = qs('#chat-history-list');
                        if (chatList && chatList.scrollTop <= 0 && e.deltaY < 0) {
                            this._collapseSplit();
                        } else if (chatList) {
                            chatList.scrollBy({ top: e.deltaY, behavior: 'auto' });
                        }
                        return;
                    }
                    // On comments tab (or regular video), forward to right panel
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

            // Window resize handler
            this._windowResizeHandler = () => {
                if (this._isSplit) {
                    const leftPct = Settings.get('splitRatio') || 75;
                    const rightPct = 100 - leftPct;
                    right.style.flexBasis = rightPct + '%';
                }
            };
            window.addEventListener('resize', this._windowResizeHandler);

            // ResizeObserver for player
            this._playerResizeObs = new ResizeObserver(() => {
                const v = left.querySelector('video');
                if (v) {
                    v.style.width = '100%';
                    v.style.height = '100%';
                }
            });
            this._playerResizeObs.observe(left);
        },

        _unmount() {
            if (!this._isActive) return;

            const player = qs('#videoPlayer');
            const video = player?.querySelector('video');
            const wasPlaying = video && !video.paused;

            // Restore player to original position
            if (player && this._origPlayerParent) {
                if (this._origPlayerNext) {
                    this._origPlayerParent.insertBefore(player, this._origPlayerNext);
                } else {
                    this._origPlayerParent.appendChild(player);
                }
            }

            // Restore live chat to original position
            const chatEl = qs('.media-page-chat-aside-chat');
            if (chatEl && this._origChatParent) {
                if (this._origChatNext) {
                    this._origChatParent.insertBefore(chatEl, this._origChatNext);
                } else {
                    this._origChatParent.appendChild(chatEl);
                }
            }

            // Resume playback
            if (wasPlaying && video) {
                requestAnimationFrame(() => video.play().catch(() => {}));
            }

            // Cleanup overlay
            this._splitWrapper?.remove();
            this._splitWrapper = null;
            this._isActive = false;
            this._isSplit = false;
            this._isLive = false;

            document.documentElement.classList.remove('rx-theater', 'rx-split');

            // Cleanup handlers
            this._playerResizeObs?.disconnect();
            if (this._windowResizeHandler) window.removeEventListener('resize', this._windowResizeHandler);
            this._detachRightScrollHandlers();

            this._origPlayerParent = null;
            this._origPlayerNext = null;
            this._origChatParent = null;
            this._origChatNext = null;
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
        _modalEl: null,

        _css: `
            /* Download button in toolbar */
            #rx-download-btn:hover {
                border-color: rgba(166,227,161,0.6) !important;
            }

            /* Download button in theater header */
            #rx-hdr-download:hover {
                border-color: rgba(166,227,161,0.6) !important;
            }

            /* Download tab panel */
            #rx-tab-download {
                flex-direction: column;
                padding: 16px;
                overflow-y: auto;
            }
            #rx-tab-download .rx-dl-body { padding: 0; }

            /* Quality list */
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

            /* Progress */
            .rx-dl-progress-wrap {
                margin-top: 12px;
            }
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

            /* Format picker row */
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
            const text = await gmFetch(url);
            return JSON.parse(text);
        },

        _parseQualities(data) {
            const qualities = [];
            const tar = data.ua?.tar || data.u?.tar;
            if (!tar) return qualities;

            const tarObj = typeof tar === 'object' && !tar.url ? tar : null;
            if (tarObj) {
                for (const [key, val] of Object.entries(tarObj)) {
                    if (!val.meta) continue;
                    qualities.push({
                        key,
                        label: `${val.meta.h}p`,
                        height: val.meta.h,
                        width: val.meta.w,
                        bitrate: val.meta.bitrate,
                        size: val.meta.size,
                    });
                }
            }
            qualities.sort((a, b) => b.height - a.height);
            // Deduplicate same height (keep higher bitrate)
            const seen = new Map();
            for (const q of qualities) {
                const existing = seen.get(q.height);
                if (!existing || q.bitrate > existing.bitrate) seen.set(q.height, q);
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

        async _loadMuxJS() {
            if (typeof muxjs !== 'undefined') return;
            if (unsafeWindow.muxjs) return;
            // Use GM_loadScript if available (ScriptVault) - masks module/define for UMD compat
            if (typeof GM_loadScript === 'function') {
                await GM_loadScript('https://cdn.jsdelivr.net/npm/mux.js@7.0.3/dist/mux.min.js');
            } else {
                // Fallback: fetch + eval with module masking
                const src = await gmFetch('https://cdn.jsdelivr.net/npm/mux.js@7.0.3/dist/mux.min.js');
                const _m = unsafeWindow.module, _e = unsafeWindow.exports, _d = unsafeWindow.define;
                try {
                    unsafeWindow.module = undefined;
                    unsafeWindow.exports = undefined;
                    unsafeWindow.define = undefined;
                    (new unsafeWindow.Function(src))();
                } finally {
                    unsafeWindow.module = _m;
                    unsafeWindow.exports = _e;
                    unsafeWindow.define = _d;
                }
            }
            if (!unsafeWindow.muxjs && typeof muxjs === 'undefined') throw new Error('mux.js not loaded');
        },

        _createTransmuxer() {
            const muxjsLib = (typeof muxjs !== 'undefined' ? muxjs : null) || unsafeWindow.muxjs;
            if (!muxjsLib) throw new Error('mux.js not loaded');
            const transmuxer = new muxjsLib.mp4.Transmuxer({ keepOriginalTimestamps: true });
            const mp4Parts = [];
            let initSegment = null;

            transmuxer.on('data', (segment) => {
                if (!initSegment) {
                    initSegment = new Uint8Array(segment.initSegment);
                    mp4Parts.push(initSegment);
                }
                mp4Parts.push(new Uint8Array(segment.data));
            });

            return {
                push(tsData) {
                    transmuxer.push(new Uint8Array(tsData));
                    // Flush after each segment so mux.js emits complete MP4 fragments
                    // with proper moof/mdat boundaries and timestamps
                    transmuxer.flush();
                },
                finish() {
                    transmuxer.dispose();
                    if (!initSegment) throw new Error('Transmux produced no output');
                    const blob = new Blob(mp4Parts, { type: 'video/mp4' });
                    mp4Parts.length = 0;
                    return blob;
                },
            };
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
            // Switch to the download tab (TheaterSplit handles tabs)
            TheaterSplit._switchTab('download');

            // Only load qualities once
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
                this._hlsUrl = data.u?.hls?.auto?.url || `https://rumble.com/hls-vod/${embedId.replace('v','')}/playlist.m3u8`;
                const qualities = this._parseQualities(data);

                if (!qualities.length) { this._setBody('<div class="rx-dl-error">No downloadable qualities found</div>'); return; }

                const body = this._setBody('');
                const title = this._getTitle();

                for (const q of qualities) {
                    const row = document.createElement('div');
                    row.className = 'rx-dl-quality';
                    row.innerHTML = `
                        <div>
                            <div class="rx-dl-quality-label">${q.label} ${q.height >= 720 ? '(HD)' : ''}</div>
                            <div class="rx-dl-quality-meta">${q.width}x${q.height} - ${q.bitrate} kbps - ~${this._formatSize(q.size)}</div>
                        </div>`;

                    row.addEventListener('click', () => this._showFormatPicker(q, title));
                    body.appendChild(row);
                }
            } catch (e) {
                this._setBody(`<div class="rx-dl-error">Failed to load video data: ${e.message}</div>`);
            }
        },

        _showFormatPicker(quality, title) {
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
                const masterText = await gmFetch(this._hlsUrl);
                const variants = this._parseMasterPlaylist(masterText, this._hlsUrl);

                // Find matching quality variant
                let variant = variants.find(v => v.height === quality.height);
                if (!variant) variant = variants.reduce((a, b) =>
                    Math.abs(b.height - quality.height) < Math.abs(a.height - quality.height) ? b : a, variants[0]);
                if (!variant) throw new Error('No matching stream variant found');

                setProgress(2, 'Fetching segment list...');

                // Fetch variant playlist
                const variantText = await gmFetch(variant.url);
                const segmentUrls = this._parseSegmentPlaylist(variantText, variant.url);

                if (!segmentUrls.length) throw new Error('No segments found in playlist');

                const total = segmentUrls.length;
                const CONCURRENT = 6;
                let completed = 0;

                if (format === 'mp4') {
                    // ── MP4: stream-transmux as we download (low memory) ──
                    setProgress(5, 'Loading MP4 converter...');
                    await this._loadMuxJS();
                    const tx = this._createTransmuxer();

                    setProgress(7, `Downloading & converting 0/${total} segments...`);

                    for (let i = 0; i < total; i += CONCURRENT) {
                        const batch = segmentUrls.slice(i, i + CONCURRENT);
                        const results = await Promise.all(batch.map(url =>
                            gmFetch(url, 'arraybuffer')
                        ));
                        // Push each segment through transmuxer immediately, then discard
                        for (const buf of results) {
                            tx.push(buf);
                        }
                        results.length = 0;
                        completed += batch.length;
                        const pct = 7 + (completed / total) * 88;
                        setProgress(pct, `Downloading & converting ${completed}/${total} segments...`);
                    }

                    setProgress(96, 'Finalizing MP4...');
                    const mp4Blob = tx.finish();
                    setProgress(100, 'Starting download...');
                    this._triggerSave(mp4Blob, `${title} - ${quality.label}.mp4`, 'video/mp4');
                    this._setBody('<div class="rx-dl-done">Download complete!</div>');
                } else {
                    // ── TS: download in chunks, build Blob from parts ──
                    setProgress(5, `Downloading 0/${total} segments...`);
                    const tsParts = [];

                    for (let i = 0; i < total; i += CONCURRENT) {
                        const batch = segmentUrls.slice(i, i + CONCURRENT);
                        const results = await Promise.all(batch.map(url =>
                            gmFetch(url, 'arraybuffer')
                        ));
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
            this._modalEl?.remove();
        }
    };

    // ═══════════════════════════════════════════
    //  FEATURE: Settings Panel
    // ═══════════════════════════════════════════
    const SettingsPanel = {
        _styleEl: null,
        _panelEl: null,
        _btnEl: null,

        _css: `
            /* ═══ Fixed Toolbar ═══ */
            /* Hide floating toolbar in theater mode (buttons are in panel header) */
            html.rx-theater #rx-toolbar { display: none !important; }

            #rx-toolbar {
                position: fixed;
                bottom: 20px; right: 20px;
                z-index: 10010;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }

            #rx-toolbar .rx-tb-btn {
                width: 42px; height: 42px;
                border-radius: 50%;
                background: rgba(30,30,46,0.9);
                border: 1px solid rgba(137,180,250,0.25);
                color: rgba(255,255,255,0.7);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s, transform 0.2s, border-color 0.2s;
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                box-shadow: 0 4px 16px rgba(0,0,0,0.4);
                text-decoration: none;
            }
            #rx-toolbar .rx-tb-btn:hover {
                background: rgba(49,50,68,0.95);
                border-color: rgba(137,180,250,0.5);
                transform: scale(1.08);
            }

            /* Rumble logo button */
            #rx-home-btn svg {
                width: 20px; height: 20px;
            }
            #rx-home-btn:hover {
                border-color: rgba(133,213,81,0.6) !important;
            }

            /* Settings gear */
            #rx-settings-btn.rx-open svg {
                transform: rotate(60deg);
            }
            #rx-settings-btn svg {
                transition: transform 0.3s cubic-bezier(.4,0,.2,1);
            }

            /* Panel - floating toolbar mode */
            #rx-settings-panel {
                position: fixed;
                bottom: 120px; right: 20px;
                z-index: 10011;
                width: 280px;
                max-height: 520px;
                background: rgba(24,24,37,0.95);
                border: 1px solid rgba(137,180,250,0.15);
                border-radius: 14px;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                overflow: hidden;
                transform: translateY(10px) scale(0.95);
                opacity: 0;
                pointer-events: none;
                transition: transform 0.25s cubic-bezier(.4,0,.2,1),
                            opacity 0.2s ease;
            }
            /* Panel - theater mode: anchor to top-right of split panel */
            html.rx-theater #rx-settings-panel {
                bottom: auto;
                top: 60px;
                right: 12px;
            }
            #rx-settings-panel.rx-visible {
                transform: translateY(0) scale(1);
                opacity: 1;
                pointer-events: auto;
            }

            .rx-panel-title {
                padding: 16px 18px 12px;
                font-size: 14px;
                font-weight: 700;
                color: var(--rx-text, #cdd6f4);
                letter-spacing: 0.3px;
                border-bottom: 1px solid rgba(255,255,255,0.06);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .rx-panel-title span {
                font-size: 10px;
                color: var(--rx-subtext, #a6adc8);
                font-weight: 400;
                margin-left: auto;
            }

            .rx-feature-list {
                padding: 8px 0;
                overflow-y: auto;
                max-height: 440px;
            }

            .rx-feature-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 18px;
                transition: background 0.15s;
            }
            .rx-feature-row:hover {
                background: rgba(255,255,255,0.03);
            }

            .rx-feature-label {
                font-size: 13px;
                color: var(--rx-text, #cdd6f4);
                user-select: none;
            }
            .rx-feature-desc {
                font-size: 10px;
                color: var(--rx-subtext, #a6adc8);
                margin-top: 2px;
            }

            /* Toggle switch */
            .rx-toggle {
                position: relative;
                width: 38px; height: 20px;
                flex-shrink: 0;
                cursor: pointer;
            }
            .rx-toggle input {
                opacity: 0;
                width: 0; height: 0;
                position: absolute;
            }
            .rx-toggle-track {
                position: absolute;
                inset: 0;
                background: var(--rx-surface0, #313244);
                border-radius: 10px;
                transition: background 0.2s;
            }
            .rx-toggle input:checked + .rx-toggle-track {
                background: var(--rx-accent, #89b4fa);
            }
            .rx-toggle-thumb {
                position: absolute;
                top: 2px; left: 2px;
                width: 16px; height: 16px;
                border-radius: 50%;
                background: #fff;
                transition: transform 0.2s cubic-bezier(.4,0,.2,1);
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            }
            .rx-toggle input:checked ~ .rx-toggle-thumb {
                transform: translateX(18px);
            }

            /* Category filter section */
            .rx-cat-section-title {
                padding: 12px 18px 6px;
                font-size: 11px;
                font-weight: 600;
                color: var(--rx-subtext, #a6adc8);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-top: 1px solid rgba(255,255,255,0.04);
                margin-top: 4px;
            }
            .rx-cat-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                padding: 8px 18px 12px;
            }
            .rx-cat-chip {
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 12px;
                border: 1px solid rgba(137,180,250,0.15);
                background: rgba(49,50,68,0.5);
                color: var(--rx-text, #cdd6f4);
                cursor: pointer;
                user-select: none;
                transition: background 0.15s, border-color 0.15s, opacity 0.15s;
            }
            .rx-cat-chip:hover {
                background: rgba(49,50,68,0.8);
                border-color: rgba(137,180,250,0.3);
            }
            .rx-cat-chip.rx-hidden {
                opacity: 0.4;
                text-decoration: line-through;
                background: rgba(30,30,46,0.5);
                border-color: rgba(255,255,255,0.05);
            }
        `,

        _features: [
            { id: 'adNuker', label: 'Ad Nuker', desc: 'Block ads, pause overlays, premium nags' },
            { id: 'theaterSplit', label: 'Theater Split', desc: 'Fullscreen video with scroll-to-reveal comments' },
            { id: 'feedCleanup', label: 'Feed Cleanup', desc: 'Remove premium promos from feeds' },
            { id: 'hideReposts', label: 'Hide Reposts', desc: 'Hide reposted videos from feeds' },
            { id: 'wideLayout', label: 'Wide Layout', desc: 'Full-width grid with tighter fit on home & subs' },
            { id: 'videoDownload', label: 'Video Download', desc: 'Download videos as MP4 or TS' },
            { id: 'darkEnhance', label: 'Dark Theme', desc: 'Catppuccin Mocha dark enhancements' },
        ],

        _createToggle(feature) {
            const row = document.createElement('div');
            row.className = 'rx-feature-row';

            const info = document.createElement('div');
            info.innerHTML = `<div class="rx-feature-label">${feature.label}</div>
                <div class="rx-feature-desc">${feature.desc}</div>`;

            const toggle = document.createElement('label');
            toggle.className = 'rx-toggle';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = Settings.get(feature.id);
            input.addEventListener('change', () => {
                Settings.set(feature.id, input.checked);
                // Notify that reload is needed for some features
                const note = row.querySelector('.rx-reload-note');
                if (note) note.style.display = input.checked !== Settings._defaults[feature.id] ? '' : 'none';
            });

            const track = document.createElement('div');
            track.className = 'rx-toggle-track';
            const thumb = document.createElement('div');
            thumb.className = 'rx-toggle-thumb';

            toggle.appendChild(input);
            toggle.appendChild(track);
            toggle.appendChild(thumb);

            row.appendChild(info);
            row.appendChild(toggle);

            return row;
        },

        _build() {
            // Toolbar container
            const toolbar = document.createElement('div');
            toolbar.id = 'rx-toolbar';

            // Rumble logo / home button
            const homeBtn = document.createElement('a');
            homeBtn.id = 'rx-home-btn';
            homeBtn.className = 'rx-tb-btn';
            homeBtn.href = 'https://rumble.com/';
            homeBtn.title = 'Rumble Home';
            homeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 3C4.015 3 2 5.015 2 7.5v9C2 18.985 4.015 21 6.5 21h11c2.485 0 4.5-2.015 4.5-4.5v-9C22 5.015 19.985 3 17.5 3h-11zm3.25 4.5c.69 0 1.25.56 1.25 1.25v1.5l2.5-2.25c.33-.3.76-.5 1.22-.5h.78c.97 0 1.45 1.17.77 1.85L13.5 12l2.72 2.65c.68.68.2 1.85-.77 1.85h-.78c-.46 0-.89-.18-1.22-.5L11 13.75v1.5c0 .69-.56 1.25-1.25 1.25S8.5 15.94 8.5 15.25v-7.5c0-.69.56-1.25 1.25-1.25z" fill="#85d551"/></svg>';

            // Gear button
            const btn = document.createElement('button');
            btn.id = 'rx-settings-btn';
            btn.className = 'rx-tb-btn';
            btn.title = 'RumbleX Settings';
            btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

            toolbar.appendChild(homeBtn);

            // Download button (only on watch pages when feature enabled)
            if (Page.isWatch() && Settings.get('videoDownload')) {
                const dlBtn = document.createElement('button');
                dlBtn.id = 'rx-download-btn';
                dlBtn.className = 'rx-tb-btn';
                dlBtn.title = 'Download Video';
                dlBtn.innerHTML = VideoDownloader._downloadSVG;
                dlBtn.addEventListener('click', () => VideoDownloader._showDownloadTab());
                toolbar.appendChild(dlBtn);
            }

            toolbar.appendChild(btn);

            // Panel
            const panel = document.createElement('div');
            panel.id = 'rx-settings-panel';

            const title = document.createElement('div');
            title.className = 'rx-panel-title';
            title.innerHTML = `RumbleX <span>v${VERSION}</span>`;
            panel.appendChild(title);

            const list = document.createElement('div');
            list.className = 'rx-feature-list';

            for (const feat of this._features) {
                list.appendChild(this._createToggle(feat));
            }

            // Category filter section
            const catTitle = document.createElement('div');
            catTitle.className = 'rx-cat-section-title';
            catTitle.textContent = 'Homepage Categories';
            list.appendChild(catTitle);

            const catGrid = document.createElement('div');
            catGrid.className = 'rx-cat-grid';

            const hiddenCats = Settings.get('hiddenCategories') || [];

            for (const cat of CategoryFilter._allCategories) {
                const chip = document.createElement('div');
                chip.className = 'rx-cat-chip';
                chip.textContent = cat.label;
                chip.dataset.catId = cat.id;
                if (hiddenCats.includes(cat.id)) chip.classList.add('rx-hidden');

                chip.addEventListener('click', () => {
                    const current = Settings.get('hiddenCategories') || [];
                    const idx = current.indexOf(cat.id);
                    if (idx >= 0) {
                        current.splice(idx, 1);
                        chip.classList.remove('rx-hidden');
                    } else {
                        current.push(cat.id);
                        chip.classList.add('rx-hidden');
                    }
                    Settings.set('hiddenCategories', current);
                    // Live-update if on homepage
                    if (Page.isHome()) CategoryFilter._apply();
                });

                catGrid.appendChild(chip);
            }
            list.appendChild(catGrid);

            // Reload note
            const reloadNote = document.createElement('div');
            reloadNote.style.cssText = 'padding:10px 18px;font-size:10px;color:rgba(166,173,200,0.6);text-align:center;border-top:1px solid rgba(255,255,255,0.04);';
            reloadNote.textContent = 'Reload page for toggle changes to take effect';
            list.appendChild(reloadNote);

            panel.appendChild(list);

            // Toggle panel
            btn.addEventListener('click', () => {
                const isOpen = panel.classList.toggle('rx-visible');
                btn.classList.toggle('rx-open', isOpen);
            });

            // Close panel on outside click
            document.addEventListener('click', (e) => {
                const hdrGear = qs('#rx-hdr-settings');
                if (!toolbar.contains(e.target) && !panel.contains(e.target) &&
                    !(hdrGear && hdrGear.contains(e.target))) {
                    panel.classList.remove('rx-visible');
                    btn.classList.remove('rx-open');
                    if (hdrGear) hdrGear.classList.remove('rx-open');
                }
            });

            this._toolbarEl = toolbar;
            this._btnEl = btn;
            this._panelEl = panel;
        },

        init() {
            this._styleEl = injectStyle(this._css, 'rx-settings-css');
            this._build();
            document.body.appendChild(this._panelEl);
            document.body.appendChild(this._toolbarEl);
        },

        destroy() {
            this._styleEl?.remove();
            this._panelEl?.remove();
            this._toolbarEl?.remove();
        }
    };

    // ═══════════════════════════════════════════
    //  FEATURE REGISTRY & INIT
    // ═══════════════════════════════════════════
    const features = [AdNuker, FeedCleanup, CategoryFilter, DarkEnhance, TheaterSplit, VideoDownloader];

    onReady(() => {
        // Init all features
        for (const feat of features) {
            try { feat.init(); } catch (e) { console.error(`[RumbleX] ${feat.id || feat.name} init failed:`, e); }
        }

        // Settings panel always inits
        try { SettingsPanel.init(); } catch (e) { console.error('[RumbleX] Settings panel init failed:', e); }

        console.log(`[RumbleX] v${VERSION} loaded - ${features.filter(f => Settings.get(f.id)).map(f => f.name).join(', ')}`);
    });
})();
