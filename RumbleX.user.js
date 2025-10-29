// ==UserScript==
// @name         Rumble Enhancement Suite
// @namespace    https://github.com/SysAdminDoc/RumbleEnhancementSuite
// @version      11.0
// @description  A premium suite of tools to enhance Rumble.com, featuring a data-driven, video downloader, privacy controls, advanced stats, live chat enhancements, a professional UI, and layout controls.
// @author       Matthew Parker
// @match        https://rumble.com/*
// @exclude      https://rumble.com/user/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=rumble.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      *
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @updateURL    https://github.com/SysAdminDoc/RumbleEnhancementSuite/raw/refs/heads/main/RumbleX.user.js
// @downloadURL  https://github.com/SysAdminDoc/RumbleEnhancementSuite/raw/refs/heads/main/RumbleX.user.js
// @run-at       document-start
// ==/UserScript==

/* globals $, GM_setValue, GM_getValue, GM_addStyle, GM_xmlHttpRequest, unsafeWindow, Hls, GM_setClipboard */

(function() {
    'use strict';

    // ——————————————————————————————————————————————————————————————————————————
    // 1. SETTINGS & STATE MANAGER
    // ——————————————————————————————————————————————————————————————————————————
    const settingsManager = {
        defaults: {
            // Theme & Appearance
            panelTheme: 'dark',
            siteTheme: 'system',

            // Navigation
            autoHideHeader: true,
            autoHideNavSidebar: true,
            logoLinksToSubscriptions: true,

            // Main Page Layout
            widenSearchBar: true,
            hideUploadIcon: false,
            hideHeaderAd: false,
            hideProfileBacksplash: false,
            hidePremiumVideos: true,
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
            adaptiveLiveLayout: true,
            hideRelatedOnLive: true,
            fullWidthPlayer: false,
            hideRelatedSidebar: true,
            widenContent: true,
            hideVideoDescription: false,
            hidePausedVideoAds: false,

            // Player Controls
            autoBestQuality: true,
            autoLike: false,
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

            // Video Comments
            commentBlocking: true,
            autoLoadComments: false,
            moveReplyButton: true,
            hideCommentReportLink: false,

            // Live Chat
            liveChatBlocking: true,
            cleanLiveChat: false,
        },
        async load() {
            let savedSettings = await GM_getValue('rumbleSuiteSettings_v9', {}); // Keep v9 key for compatibility
            return { ...this.defaults, ...savedSettings };
        },
        async save(settings) {
            await GM_setValue('rumbleSuiteSettings_v9', settings);
        },
        async getBlockedUsers(type = 'comment') {
            const key = type === 'livechat' ? 'rumbleSuiteLiveChatBlockedUsers' : 'rumbleSuiteBlockedUsers';
            return await GM_getValue(key, []);
        },
        async saveBlockedUsers(users, type = 'comment') {
            const key = type === 'livechat' ? 'rumbleSuiteLiveChatBlockedUsers' : 'rumbleSuiteBlockedUsers';
            const uniqueUsers = [...new Set(users)];
            await GM_setValue(key, uniqueUsers);
            return uniqueUsers;
        },
    };

    const appState = {
        videoData: null,
        commentBlockedUsers: [],
        liveChatBlockedUsers: [],
        hlsInstance: null,
    };

    // ——————————————————————————————————————————————————————————————————————————
    // 2. DYNAMIC STYLE & UTILITY ENGINE
    // ——————————————————————————————————————————————————————————————————————————
    const styleManager = {
        _styles: new Map(),
        inject(id, css) {
            if (this._styles.has(id)) { this.remove(id); }
            const styleElement = GM_addStyle(css);
            this._styles.set(id, styleElement);
        },
        remove(id) {
            const styleElement = this._styles.get(id);
            if (styleElement && styleElement.parentElement) {
                styleElement.parentElement.removeChild(styleElement);
            }
            this._styles.delete(id);
        },
    };

    function applyAllCssFeatures() {
        let cssRules = [];
        const pageType = location.pathname === '/' ? 'home' : (location.pathname.startsWith('/v') ? 'video' : (location.pathname.startsWith('/c/') ? 'profile' : 'other'));

        features.forEach(feature => {
            if (feature.css && appState.settings[feature.id]) {
                const appliesToPage = !feature.page || feature.page === 'all' || feature.page === pageType;
                if (appliesToPage) {
                    cssRules.push(feature.css);
                }
            }
        });
        styleManager.inject('master-css-rules', cssRules.join('\n'));
    }

    function waitForElement(selector, callback, timeout = 10000) {
        const intervalTime = 200;
        let elapsedTime = 0;
        const interval = setInterval(() => {
            const element = $(selector);
            if (element.length > 0) {
                clearInterval(interval);
                callback(element);
            }
            elapsedTime += intervalTime;
            if (elapsedTime >= timeout) { clearInterval(interval); }
        }, intervalTime);
    }

    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    function formatSeconds(seconds) {
        if (isNaN(seconds) || seconds < 0) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const pad = (num) => String(num).padStart(2, '0');
        return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    }

    const ICONS = {
        cog: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2"/><path d="M12 22v-2"/><path d="m17 20.66-1-1.73"/><path d="M11 10.27 7 3.34"/><path d="m20.66 17-1.73-1"/><path d="m3.34 7 1.73 1"/><path d="M14 12h8"/><path d="M2 12h2"/><path d="m20.66 7-1.73 1"/><path d="m3.34 17 1.73-1"/><path d="m17 3.34-1 1.73"/><path d="M11 13.73 7 20.66"/></svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        download: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        spinner: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="res-spinner-svg"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        trash: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
        plus: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        chevronUp: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
        chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
        move: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
        system: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
        dark: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
        light: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
        block: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
        copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
        mic: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
        closedCaptions: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2"/><path d="M6 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h2"/><path d="M12 12h.01"/><path d="M8 12h.01"/><path d="M16 12h.01"/></svg>`,
        image: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
        stream: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`,
    };

    // ——————————————————————————————————————————————————————————————————————————
    // 3. CORE DATA ENGINE
    // ——————————————————————————————————————————————————————————————————————————
    const dataEngine = {
        init() {
            if (!location.pathname.startsWith('/v')) return;
            this.findAndParseVideoData();
            this.findHlsInstance();
        },
        findAndParseVideoData() {
            if (appState.videoData) return;
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                if (script.textContent.includes('player.load({') && script.textContent.includes('viewer_id')) {
                    const match = script.textContent.match(/player\.load\((.*)\)/s);
                    if (match && match[1]) {
                        try {
                            let jsonString = match[1].trim();
                            if (jsonString.endsWith(',')) {
                                jsonString = jsonString.slice(0, -1);
                            }
                            appState.videoData = JSON.parse(jsonString);
                            console.log('[Rumble Suite] Video data successfully parsed from script tag:', appState.videoData);
                            $(document).trigger('res:videoDataLoaded');
                            return;
                        } catch (e) {
                            console.error("[Rumble Suite] Failed to parse video data JSON from script tag.", e);
                        }
                    }
                }
            }
        },
        findHlsInstance() {
            if (appState.hlsInstance) return;
            const videoElement = document.querySelector('#videoPlayer video');
            if (videoElement && videoElement.hls) {
                appState.hlsInstance = videoElement.hls;
                console.log('[Rumble Suite] HLS.js instance found:', appState.hlsInstance);
                $(document).trigger('res:hlsInstanceFound');
                return;
            }
            // Fallback to MutationObserver if HLS is not immediately available
            const observer = new MutationObserver((mutations, obs) => {
                if (videoElement && videoElement.hls) {
                    appState.hlsInstance = videoElement.hls;
                    console.log('[Rumble Suite] HLS.js instance found via MutationObserver:', appState.hlsInstance);
                    $(document).trigger('res:hlsInstanceFound');
                    obs.disconnect();
                }
            });
            waitForElement('.media-player-container', ($container) => {
                observer.observe($container[0], { childList: true, subtree: true });
            });
        }
    };


    // ——————————————————————————————————————————————————————————————————————————
    // 4. FEATURE DEFINITIONS & LOGIC
    // ——————————————————————————————————————————————————————————————————————————
    const features = [
        // --- THEME & APPEARANCE ---
        {
            id: 'siteTheme', name: 'Rumble Site Theme', description: 'Controls the appearance of the Rumble website itself, syncing with its native options.', newCategory: 'Theme & Appearance', isManagement: true,
            sync() {
                const activeTheme = $('a.main-menu-item.theme-option.main-menu-item--active').data('theme-option') || 'system';
                if (appState.settings.siteTheme !== activeTheme) {
                    appState.settings.siteTheme = activeTheme;
                    settingsManager.save(appState.settings);
                }
                $(`.res-theme-button[data-theme-value="${activeTheme}"]`).prop('checked', true);
            },
            init() {
                this.apply(appState.settings.siteTheme);
                const observer = new MutationObserver(() => this.sync());
                waitForElement('.theme-option-group', ($el) => observer.observe($el[0], { attributes: true, subtree: true, attributeFilter: ['class'] }));
            },
            apply(themeValue) {
                const $targetButton = $(`a.main-menu-item.theme-option[data-theme-option="${themeValue}"]`);
                if ($targetButton.length && !$targetButton.hasClass('main-menu-item--active')) {
                    $targetButton[0].click();
                }
            },
        },
        // --- NAVIGATION ---
        {
            id: 'autoHideHeader',
            name: 'Auto-hide Header',
            description: 'Fades the header out. It fades back in when you move your cursor to the top of the page.',
            newCategory: 'Navigation',
            init() {
                this.handler = (e) => {
                    if (e.clientY < 80) { // Top trigger zone
                        document.body.classList.add('res-header-visible');
                    } else if (!e.target.closest('header.header')) {
                        document.body.classList.remove('res-header-visible');
                    }
                };
                const css = `
                    body.res-autohide-header-active header.header {
                        position: fixed; top: 0; left: 0; right: 0; z-index: 1001;
                        opacity: 0;
                        transition: opacity 0.3s ease-in-out;
                        pointer-events: none;
                    }
                    body.res-autohide-header-active.res-header-visible header.header {
                        opacity: 1; pointer-events: auto;
                    }
                    body.res-autohide-header-active { padding-top: 0 !important; }
                `;
                styleManager.inject(this.id, css);
                document.body.classList.add('res-autohide-header-active');
                document.addEventListener('mousemove', this.handler);
            },
            destroy() {
                if (this.handler) {
                    document.removeEventListener('mousemove', this.handler);
                }
                styleManager.remove(this.id);
                document.body.classList.remove('res-autohide-header-active', 'res-header-visible');
            }
        },
        {
            id: 'autoHideNavSidebar',
            name: 'Auto-hide Navigation Sidebar',
            description: 'Hides the main navigation sidebar. It slides into view when you move your cursor to the left edge of the page.',
            newCategory: 'Navigation',
            init() {
                const css = `
                    body.res-autohide-nav-active nav.navs {
                        position: fixed; top: 0; left: 0;
                        transform: translateX(-100%);
                        transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
                        z-index: 1002;
                        height: 100vh;
                        opacity: 0.95;
                        visibility: hidden;
                    }
                    body.res-autohide-nav-active main.nav--transition {
                        margin-left: 0 !important;
                    }
                    #res-nav-sidebar-trigger {
                        position: fixed; top: 80px; left: 0; width: 30px; height: calc(100% - 80px); z-index: 1001;
                    }
                    #res-nav-sidebar-trigger:hover + nav.navs,
                    body.res-autohide-nav-active nav.navs:hover {
                        transform: translateX(0);
                        opacity: 1;
                        visibility: visible;
                    }
                `;
                styleManager.inject(this.id, css);
                $('body').addClass('res-autohide-nav-active');
                if ($('#res-nav-sidebar-trigger').length === 0) {
                    $('body').append('<div id="res-nav-sidebar-trigger"></div>');
                }
            },
            destroy() {
                styleManager.remove(this.id);
                $('body').removeClass('res-autohide-nav-active');
                $('#res-nav-sidebar-trigger').remove();
            }
        },
        {
            id: 'logoLinksToSubscriptions',
            name: 'Logo Links to Subscriptions',
            description: 'Changes the main Rumble logo in the header to link to your subscriptions feed instead of the homepage.',
            newCategory: 'Navigation',
            init() {
                this.observer = new MutationObserver(() => {
                    const $logo = $('a.header-logo');
                    if ($logo.length && $logo.attr('href') !== '/subscriptions') {
                        $logo.attr('href', '/subscriptions');
                    }
                });
                waitForElement('header.header', ($header) => {
                    this.observer.observe($header[0], { childList: true, subtree: true });
                });
            },
            destroy() {
                if (this.observer) this.observer.disconnect();
                $('a.header-logo').attr('href', '/');
            }
        },
        // --- MAIN PAGE ---
        { id: 'widenSearchBar', name: 'Widen Search Bar', description: 'Expands the search bar to fill available header space.', newCategory: 'Main Page Layout', css: `.header .header-div { display: flex; align-items: center; gap: 1rem; padding-right: 1.5rem; box-sizing: border-box; } .header-search { flex-grow: 1; max-width: none !important; } .header-search .header-search-field { width: 100% !important; }` },
        { id: 'hideUploadIcon', name: 'Hide Upload Icon', description: 'Hides the upload/stream live icon in the header.', newCategory: 'Main Page Layout', css: 'button.header-upload { display: none !important; }' },
        { id: 'hideHeaderAd', name: 'Hide "Go Ad-Free" Button', description: 'Hides the "Go Ad-Free" button in the header.', newCategory: 'Main Page Layout', css: `span.hidden.lg\\:flex:has(button[hx-get*="premium-value-prop"]) { display: none !important; }` },
        { id: 'hideProfileBacksplash', name: 'Hide Profile Backsplash', description: 'Hides the large header image on channel profiles.', newCategory: 'Main Page Layout', page: 'profile', css: `div.channel-header--backsplash { display: none; } html.main-menu-mode-permanent { margin-top: 30px !important; }` },
        {
            id: 'hidePremiumVideos', name: 'Hide Premium Videos', description: 'Hides premium-only videos from subscription and channel feeds.', newCategory: 'Main Page Layout',
            init() {
                const hideRule = () => document.querySelectorAll('div.videostream:has(a[href="/premium"])').forEach(el => el.style.display = 'none');
                this.observer = new MutationObserver(hideRule);
                waitForElement('main', ($main) => this.observer.observe($main[0], { childList: true, subtree: true }));
                hideRule();
            },
            destroy() { if (this.observer) this.observer.disconnect(); document.querySelectorAll('div.videostream:has(a[href="/premium"])').forEach(el => el.style.display = ''); }
        },
        { id: 'hideFeaturedBanner', name: 'Hide Featured Banner', description: 'Hides the top category banner on the home page.', newCategory: 'Main Page Layout', css: 'div.homepage-featured { display: none !important; }', page: 'home' },
        { id: 'hideEditorPicks', name: "Hide Editor Picks", description: "Hides the main 'Editor Picks' content row on the home page.", newCategory: 'Main Page Layout', css: '#section-editor-picks { display: none !important; }', page: 'home' },
        { id: 'hideTopLiveCategories', name: "Hide 'Top Live' Row", description: "Hides the 'Top Live Categories' row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-top-live { display: none !important; }', page: 'home' },
        { id: 'hidePremiumRow', name: "Hide Premium Row", description: "Hides the Rumble Premium row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-premium-videos { display: none !important; }', page: 'home' },
        { id: 'hideHomepageAd', name: "Hide Ad Section", description: "Hides the ad container on the home page.", newCategory: 'Main Page Layout', css: 'section.homepage-section:has(.js-rac-desktop-container) { display: none !important; }', page: 'home' },
        { id: 'hideForYouRow', name: "Hide 'For You' Row", description: "Hides 'For You' recommendations on the home page.", newCategory: 'Main Page Layout', css: 'section#section-personal-recommendations { display: none !important; }', page: 'home' },
        { id: 'hideGamingRow', name: "Hide Gaming Row", description: "Hides the Gaming row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-gaming { display: none !important; }', page: 'home' },
        { id: 'hideFinanceRow', name: "Hide Finance & Crypto Row", description: "Hides the Finance & Crypto row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-finance { display: none !important; }', page: 'home' },
        { id: 'hideLiveRow', name: "Hide Live Row", description: "Hides the Live row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-live-videos { display: none !important; }', page: 'home' },
        { id: 'hideFeaturedPlaylistsRow', name: "Hide Featured Playlists", description: "Hides the Featured Playlists row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-featured-playlists { display: none !important; }', page: 'home' },
        { id: 'hideSportsRow', name: "Hide Sports Row", description: "Hides the Sports row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-sports { display: none !important; }', page: 'home' },
        { id: 'hideViralRow', name: "Hide Viral Row", description: "Hides the Viral row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-viral { display: none !important; }', page: 'home' },
        { id: 'hidePodcastsRow', name: "Hide Podcasts Row", description: "Hides the Podcasts row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-podcasts { display: none !important; }', page: 'home' },
        { id: 'hideLeaderboardRow', name: "Hide Leaderboard Row", description: "Hides the Leaderboard row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-leaderboard { display: none !important; }', page: 'home' },
        { id: 'hideVlogsRow', name: "Hide Vlogs Row", description: "Hides the Vlogs row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-vlogs { display: none !important; }', page: 'home' },
        { id: 'hideNewsRow', name: "Hide News Row", description: "Hides the News row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-news { display: none !important; }', page: 'home' },
        { id: 'hideScienceRow', name: "Hide Health & Science Row", description: "Hides the Health & Science row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-science { display: none !important; }', page: 'home' },
        { id: 'hideMusicRow', name: "Hide Music Row", description: "Hides the Music row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-music { display: none !important; }', page: 'home' },
        { id: 'hideEntertainmentRow', name: "Hide Entertainment Row", description: "Hides the Entertainment row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-entertainment { display: none !important; }', page: 'home' },
        { id: 'hideCookingRow', name: "Hide Cooking Row", description: "Hides the Cooking row on the home page.", newCategory: 'Main Page Layout', css: 'section#section-cooking { display: none !important; }', page: 'home' },
        { id: 'hideFooter', name: 'Hide Footer', description: 'Removes the footer at the bottom of the page.', newCategory: 'Main Page Layout', css: 'footer.page__footer.foot.nav--transition { display: none !important; }' },

        // --- VIDEO PAGE LAYOUT ---
        {
            id: 'adaptiveLiveLayout', name: 'Adaptive Live Video Layout', description: 'On live streams, expands the player to fill the space next to the live chat.', newCategory: 'Video Page Layout',
            init() {
                if (!document.querySelector('.video-header-live-info')) return; // Only run on live pages
                const chatSelector = 'aside.media-page-chat-aside-chat';
                const applyStyles = (isChatVisible) => {
                    const css = isChatVisible ? `body:not(.res-full-width-player):not(.res-live-two-col) .main-and-sidebar .main-content { width: calc(100% - 350px) !important; max-width: none !important; }` : '';
                    styleManager.inject('adaptive-live-css', css);
                };
                this.observer = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        if (m.attributeName === 'style') {
                            const chatIsVisible = $(m.target).css('display') !== 'none';
                            applyStyles(chatIsVisible);
                        }
                    }
                });
                waitForElement(chatSelector, ($chat) => {
                    this.observer.observe($chat[0], { attributes: true, attributeFilter: ['style'] });
                    applyStyles($chat.css('display') !== 'none'); // Initial check
                });
            },
            destroy() { if (this.observer) this.observer.disconnect(); styleManager.remove('adaptive-live-css'); }
        },
        { id: 'hideRelatedOnLive', name: 'Hide Related Media on Live', description: 'Hides the "Related Media" section below the player on live streams.', newCategory: 'Video Page Layout', css: '.media-page-related-media-desktop-floating { display: none !important; }', page: 'video' },
        {
            id: 'fullWidthPlayer',
            name: 'Full-Width Player / Live Layout',
            description: "Maximizes player width. Works with 'Auto-hide Header' for a full-screen experience. On live streams, it enables an optimized side-by-side view with chat.",
            newCategory: 'Video Page Layout',
            page: 'video',
            _liveObserver: null,
            _resizeListener: null,
            _standardCss: `body.res-full-width-player nav.navs, body.res-full-width-player aside.media-page-related-media-desktop-sidebar, body.res-full-width-player #player-spacer { display: none !important; } body.res-full-width-player main.nav--transition { margin-left: 0 !important; } body.res-full-width-player .main-and-sidebar { max-width: 100% !important; padding: 0 !important; margin: 0 !important; } body.res-full-width-player .main-content, body.res-full-width-player .media-container { width: 100% !important; max-width: 100% !important; } body.res-full-width-player .video-player, body.res-full-width-player [id^='vid_v'] { width: 100vw !important; height: calc(100vw * 9 / 16) !important; max-height: 100vh; } body.res-full-width-player #videoPlayer video { object-fit: contain !important; }`,
            _liveCss: `
              /* Main grid container for the two-column layout */
              body.res-live-two-col:not(.rumble-player--fullscreen) .main-and-sidebar {
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) var(--res-chat-w, 360px);
                width: 100vw;
                max-width: 100vw;
                margin: 0;
                padding: 0;
                align-items: stretch; /* Make columns equal height */
              }

              /* Make the video column and its children capable of filling the height */
              body.res-live-two-col:not(.rumble-player--fullscreen) .main-and-sidebar .main-content {
                display: flex;
                flex-direction: column;
              }
              body.res-live-two-col:not(.rumble-player--fullscreen) .media-container {
                flex-grow: 1; /* Make this container fill the available vertical space */
              }

              /* Chat column styles */
              body.res-live-two-col:not(.rumble-player--fullscreen) aside.media-page-chat-aside-chat {
                width: var(--res-chat-w, 360px) !important;
                min-width: var(--res-chat-w, 360px) !important;
                max-width: clamp(320px, var(--res-chat-w, 360px), 480px) !important;
                position: relative;
                z-index: 1;
              }

              /* Video player fills its container completely */
              body.res-live-two-col:not(.rumble-player--fullscreen) .video-player {
                 margin-top: -30px;
              }
              body.res-live-two-col:not(.rumble-player--fullscreen) .video-player,
              body.res-live-two-col:not(.rumble-player--fullscreen) #videoPlayer,
              body.res-live-two-col:not(.rumble-player--fullscreen) #videoPlayer > div,
              body.res-live-two-col:not(.rumble-player--fullscreen) [id^='vid_v'] {
                width: 100% !important;
                height: 100% !important;
                max-height: none !important;
                background-color: #000;
              }

              /* The actual <video> element will be letterboxed within its container */
              body.res-live-two-col:not(.rumble-player--fullscreen) #videoPlayer video {
                width: 100% !important;
                height: 100% !important;
                object-fit: contain;
              }

             /* When chat is hidden, break the grid and apply standard full-width styles */
              body.res-live-two-col.res-live-chat-collapsed:not(.rumble-player--fullscreen) .main-and-sidebar {
                display: block !important;
              }
              body.res-live-two-col.res-live-chat-collapsed:not(.rumble-player--fullscreen) .video-player,
              body.res-live-two-col.res-live-chat-collapsed:not(.rumble-player--fullscreen) [id^='vid_v'] {
                width: 100vw !important;
                height: calc(100vw * 9 / 16) !important;
                max-height: 100vh !important;
                margin-top: 0;
              }

              /* Responsive stacking for smaller screens */
              @media (max-width: 1100px) {
                body.res-live-two-col:not(.rumble-player--fullscreen) .main-and-sidebar {
                  grid-template-columns: 1fr;
                  align-items: start;
                  width: auto;
                  max-width: 100%;
                }
                body.res-live-two-col:not(.rumble-player--fullscreen) aside.media-page-chat-aside-chat {
                  width: 100% !important;
                  min-width: 0 !important;
                  max-width: none !important;
                  height: 70vh;
                }
                 body.res-live-two-col:not(.rumble-player--fullscreen) .video-player {
                    margin-top: 0;
                 }
              }

              body.res-live-two-col button.media-page-chat-container-toggle-btn {
                z-index: 2;
              }
            `,
            _activateLiveLayout() {
                const chatSelector = 'aside.media-page-chat-aside-chat';
                const setChatWidthVar = () => {
                    const chat = document.querySelector(chatSelector);
                    const fallback = 360;
                    let w = fallback;
                    if (chat && getComputedStyle(chat).display !== 'none') {
                        const rect = chat.getBoundingClientRect();
                        w = Math.max(320, Math.min(Math.round(rect.width || fallback), 480));
                    }
                    document.documentElement.style.setProperty('--res-chat-w', `${w}px`);
                };
                $('body').addClass('res-live-two-col');
                setChatWidthVar();
                this._resizeListener = setChatWidthVar;
                window.addEventListener('resize', this._resizeListener);
                waitForElement(chatSelector, ($chat) => {
                    this._liveObserver = new MutationObserver(setChatWidthVar);
                    this._liveObserver.observe($chat[0], { attributes: true, attributeFilter: ['style', 'class'] });
                });
                // Watch for chat toggle clicks
                $(document).on('click.resLiveChat', '[data-js="media_page_chat_container_toggle_btn"]', function() {
                    // Timeout to allow Rumble's JS to update the DOM first
                    setTimeout(() => {
                        const isChatHidden = $('aside.media-page-chat-aside-chat').css('display') === 'none';
                        $('body').toggleClass('res-live-chat-collapsed', isChatHidden);
                    }, 50);
                });
            },
            init() {
                setTimeout(() => {
                    const isLive = !!document.querySelector('.video-header-live-info, .media-header-live-badge, .video-badge--live');
                    if (isLive) {
                        styleManager.inject(this.id, this._liveCss);
                        this._activateLiveLayout();
                    } else {
                        styleManager.inject(this.id, this._standardCss);
                        $('body').addClass('res-full-width-player');
                    }
                }, 250);
            },
            destroy() {
                if (this._liveObserver) {
                    this._liveObserver.disconnect();
                    this._liveObserver = null;
                }
                if (this._resizeListener) {
                    window.removeEventListener('resize', this._resizeListener);
                    this._resizeListener = null;
                }
                $(document).off('click.resLiveChat');
                document.documentElement.style.removeProperty('--res-chat-w');
                styleManager.remove(this.id);
                $('body').removeClass('res-full-width-player res-live-two-col res-live-chat-collapsed');
            }
        },
        { id: 'hideRelatedSidebar', name: 'Hide Related Videos Sidebar', description: 'Completely hides the related videos sidebar for a wider, more focused view.', newCategory: 'Video Page Layout', css: `aside.media-page-related-media-desktop-sidebar { display: none !important; }`, page: 'video' },
        { id: 'widenContent', name: 'Widen Content Area', description: 'Expands the main content area. Best used with sidebar hidden.', newCategory: 'Video Page Layout', css: `body:has(aside.media-page-related-media-desktop-sidebar[style*="display: none"]) .main-and-sidebar .main-content { width: 100% !important; max-width: 100% !important; }`, page: 'video' },
        { id: 'hideVideoDescription', name: 'Hide Video Description', description: 'Hides the video description, tags, and views.', newCategory: 'Video Page Layout', css: `.media-description-section { display: none !important; }`, page: 'video' },
        { id: 'hidePausedVideoAds', name: 'Hide Paused Video Ads', description: 'Hides the ad overlay that appears when a video is paused.', newCategory: 'Video Page Layout', css: `canvas#pause-ads__canvas { display: none !important; }`, page: 'video' },

        // PLAYER CONTROLS
        {
            id: 'autoBestQuality', name: 'Auto Best Video Quality', description: 'Automatically selects the highest available video quality.', newCategory: 'Player Controls',
            // [NEW] lightweight state for UI fallback
            _uiInterval: null,
            _lastUrl: '',
            _clickCount: 0,
            _maxUiClicksPerUrl: 3,
            init() {
                if (!location.pathname.startsWith('/v')) return;

                // Primary: HLS best-quality selection
                if (appState.hlsInstance) {
                    this.setBestQuality(appState.hlsInstance);
                } else {
                    $(document).on('res:hlsInstanceFound.autoQuality', () => this.setBestQuality(appState.hlsInstance));
                }

                // [NEW] Secondary: UI-click fallback
                this.startUiFallback();
            },
            destroy() {
                $(document).off('res:hlsInstanceFound.autoQuality');
                if (appState.hlsInstance && this.onManifestParsed) {
                    appState.hlsInstance.off(Hls.Events.MANIFEST_PARSED, this.onManifestParsed);
                }
                // [NEW] stop UI-click fallback
                this.stopUiFallback();
            },
            setBestQuality(hls) {
                if (!hls) return;
                this.onManifestParsed = () => {
                    if (hls.levels && hls.levels.length > 1) {
                        console.log('[Rumble Suite] HLS Manifest Parsed, setting best quality.');
                        hls.nextLevel = hls.levels.length - 1;
                    }
                };
                hls.on(Hls.Events.MANIFEST_PARSED, this.onManifestParsed);
                // If manifest is already parsed, run it once.
                if (hls.levels && hls.levels.length > 1) {
                    this.onManifestParsed();
                }
            },
            // [NEW] UI-click fallback interval starter
            startUiFallback() {
                if (this._uiInterval) return;
                this._lastUrl = location.href;
                this._clickCount = 0;

                this._uiInterval = setInterval(() => {
                    const url = location.href;
                    if (url !== this._lastUrl) {
                        // New video navigation detected
                        this._lastUrl = url;
                        this._clickCount = 0;
                    }
                    // Only attempt a few times per URL
                    if (this._clickCount < this._maxUiClicksPerUrl) {
                        const acted = this.tryOpenSettingsAndChooseBest();
                        if (acted) {
                            this._clickCount++;
                        }
                    }
                }, 500);
            },
            // [NEW] Stop fallback
            stopUiFallback() {
                if (this._uiInterval) {
                    clearInterval(this._uiInterval);
                    this._uiInterval = null;
                }
            },
            // [NEW] DOM clicks derived from the smaller userscript; wrapped safely
            tryOpenSettingsAndChooseBest() {
                try {
                    const overlayItem = document.getElementsByClassName('touched_overlay_item')[0];
                    if (!overlayItem) return false;

                    // Playback settings container
                    const playback = overlayItem.nextElementSibling?.lastChild?.lastChild;
                    if (!playback) return false;

                    // Click the settings button
                    const playback_click = playback.firstChild;
                    if (playback_click) playback_click.click();

                    // Click the "Quality" -> "Best" item
                    const quality = playback.lastChild?.lastChild?.lastChild;
                    if (quality) {
                        quality.click();
                        return true;
                    }
                } catch (e) {
                    // Silently ignore; DOM may shift between player versions
                }
                return false;
            }
        },
        { id: 'autoLike', name: 'Auto Liker', description: 'Automatically likes a video when you open its watch page.', newCategory: 'Player Controls',
            init() { if (!location.pathname.startsWith('/v')) return; waitForElement('button.rumbles-vote-pill-up', ($likeButton) => { if (!$likeButton.hasClass('active')) $likeButton.click(); }); }
        },
        { id: 'hideRewindButton', name: 'Hide Rewind Button', description: 'Hides the rewind button in the player controls.', newCategory: 'Player Controls', css: 'div[title="Rewind"] { display: none !important; }', page: 'video' },
        { id: 'hideFastForwardButton', name: 'Hide Fast Forward Button', description: 'Hides the fast forward button in the player controls.', newCategory: 'Player Controls', css: 'div[title="Fast forward"] { display: none !important; }', page: 'video' },
        { id: 'hideCCButton', name: 'Hide Closed Captions Button', description: 'Hides the (CC) button in the player controls.', newCategory: 'Player Controls', css: 'div[title="Toggle closed captions"] { display: none !important; }', page: 'video' },
        { id: 'hideAutoplayButton', name: 'Hide Autoplay Button', description: 'Hides the autoplay toggle in the player controls.', newCategory: 'Player Controls', css: 'div[title="Autoplay"] { display: none !important; }', page: 'video' },
        { id: 'hideTheaterButton', name: 'Hide Theater Mode Button', description: 'Hides the theater mode button in the player controls.', newCategory: 'Player Controls', css: 'div[title="Toggle theater mode"] { display: none !important; }', page: 'video' },
        { id: 'hidePipButton', name: 'Hide Picture-in-Picture Button', description: 'Hides the PiP button in the player controls.', newCategory: 'Player Controls', css: 'div[title="Toggle picture-in-picture mode"] { display: none !important; }', page: 'video' },
        { id: 'hideFullscreenButton', name: 'Hide Fullscreen Button', description: 'Hides the fullscreen button in the player controls.', newCategory: 'Player Controls', css: 'div[title="Toggle fullscreen"] { display: none !important; }', page: 'video' },
        { id: 'hidePlayerRumbleLogo', name: 'Hide Rumble Logo', description: 'Hides the Rumble logo inside the player.', newCategory: 'Player Controls', css: 'div:has(> div > svg[viewBox="0 0 140 35"]) { display: none !important; }', page: 'video' },
        { id: 'hidePlayerGradient', name: 'Hide Player Control Gradient', description: 'Removes the cloudy gradient overlay from the bottom of the video player for a cleaner look.', newCategory: 'Player Controls', page: 'video', css: `.touched_overlay > div[style*="linear-gradient"] { display: none !important; }` },

        // --- VIDEO BUTTONS ---
        { id: 'hideLikeDislikeButton', name: 'Hide Like/Dislike Buttons', description: 'Hides the like and dislike buttons.', newCategory: 'Video Buttons', css: 'div[data-js="media_action_vote_button"] { display: none !important; }', page: 'video' },
        { id: 'hideShareButton', name: 'Hide Share Button', description: 'Hides the share button.', newCategory: 'Video Buttons', css: 'div[data-js="video_action_button_visible_location"][data-type="share"] { display: none !important; }', page: 'video' },
        { id: 'hideRepostButton', name: 'Hide Repost Button', description: 'Hides the repost button.', newCategory: 'Video Buttons', css: 'div[data-js="video_action_button_visible_location"][data-type="reposts"] { display: none !important; }', page: 'video' },
        { id: 'hideEmbedButton', name: 'Hide Embed Button', description: 'Hides the embed button.', newCategory: 'Video Buttons', css: 'div[data-js="video_action_button_visible_location"][data-type="embed"] { display: none !important; }', page: 'video' },
        { id: 'hideSaveButton', name: 'Hide Save Button', description: 'Hides the save to playlist button.', newCategory: 'Video Buttons', css: 'div[data-js="video_action_button_visible_location"][data-type="playlist"] { display: none !important; }', page: 'video' },
        { id: 'hideCommentButton', name: 'Hide Comment Button', description: 'Hides the main comment button.', newCategory: 'Video Buttons', css: 'div[data-js="video_action_button_visible_location"][data-type="comments"] { display: none !important; }', page: 'video' },
        { id: 'hideReportButton', name: 'Hide 3-dot Menu', description: 'Hides the 3-dot menu containing the report option.', newCategory: 'Video Buttons', css: '.video-action-sub-menu-wrapper { display: none !important; }', page: 'video' },
        { id: 'hidePremiumJoinButtons', name: 'Hide Premium/Join Buttons', description: 'Hides the "Rumble Premium" and "Join" buttons.', newCategory: 'Video Buttons', css: 'button[hx-get*="premium-value-prop"], button[data-js="locals-subscription-button"] { display: none !important; }', page: 'video' },

        // --- VIDEO COMMENTS ---
        {
            id: 'commentBlocking', name: 'Enable Comment Blocking', description: 'Adds a block button to comments and hides comments from blocked users.', newCategory: 'Video Comments', isManagement: true,
            async init() { if (!location.pathname.startsWith('/v')) return; appState.commentBlockedUsers = await settingsManager.getBlockedUsers('comment'); this.applyBlockedUsers(); this.setupObserver(); },
            destroy() { if (this.observer) this.observer.disconnect(); $('.res-block-user-btn').remove(); styleManager.remove(this.id); },
            setupObserver() {
                const handleMutations = (mutations) => {
                    mutations.forEach(mutation => {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType !== 1) continue;
                            const comments = $(node).is('.comment-item') ? $(node) : $(node).find('.comment-item');
                            comments.each((i, comment) => {
                                const $comment = $(comment);
                                const $meta = $comment.find('.comments-meta');
                                if ($meta.length && !$meta.find('.res-block-user-btn').length) {
                                    const username = $comment.data('username');
                                    if (username) $meta.append(`<button class="res-block-user-btn" data-username="${username}" title="Block this user">Block</button>`);
                                }
                            });
                        }
                    });
                    this.applyBlockedUsers();
                };
                this.observer = new MutationObserver(handleMutations);
                waitForElement('.comments-1', ($commentsContainer) => {
                    this.observer.observe($commentsContainer[0], { childList: true, subtree: true });
                    handleMutations([{ addedNodes: $commentsContainer.children(), type: 'childList' }]);
                });
            },
            applyBlockedUsers() { if (appState.commentBlockedUsers.length === 0) { styleManager.remove(this.id); return; } const selector = appState.commentBlockedUsers.map(user => `li.comment-item[data-username="${user}"]`).join(', '); styleManager.inject(this.id, `${selector} { display: none !important; }`); },
            async blockUser(username) { if (!username || appState.commentBlockedUsers.includes(username)) return; appState.commentBlockedUsers.push(username); await settingsManager.saveBlockedUsers(appState.commentBlockedUsers, 'comment'); this.applyBlockedUsers(); createToast(`User "${username}" has been blocked.`); },
            async unblockUser(username) { appState.commentBlockedUsers = appState.commentBlockedUsers.filter(u => u !== username); await settingsManager.saveBlockedUsers(appState.commentBlockedUsers, 'comment'); this.applyBlockedUsers(); $(`li.comment-item[data-username="${username}"]`).show(); createToast(`User "${username}" has been unblocked.`); populateBlockedUsersList('comment'); },
            async unblockAllUsers() { appState.commentBlockedUsers = []; await settingsManager.saveBlockedUsers([], 'comment'); this.applyBlockedUsers(); createToast('All users have been unblocked.', 'success', 2000); populateBlockedUsersList('comment'); }
        },
        { id: 'autoLoadComments', name: 'Auto Load More Comments', description: 'Automatically loads more comments as you scroll down.', newCategory: 'Video Comments',
            init() { if (!location.pathname.startsWith('/v')) return; const isElementInViewport = (el) => { if (!el) return false; const rect = el.getBoundingClientRect(); return rect.top <= (window.innerHeight || document.documentElement.clientHeight); }; const scrollHandler = () => { const $button = $('li.show-more-comments > button'); if ($button.length && isElementInViewport($button[0])) $button.click(); }; $(window).on('scroll.autoLoadComments', scrollHandler); },
            destroy() { $(window).off('scroll.autoLoadComments'); }
        },
        { id: 'moveReplyButton', name: 'Move Reply Button', description: 'Moves the reply button next to the like/dislike buttons.', newCategory: 'Video Comments', css: `.comment-actions-wrapper { display: flex; align-items: center; } .comment-actions-wrapper .comment-actions { margin-left: 12px; }`, page: 'video' },
        { id: 'hideCommentReportLink', name: 'Hide Comment Report Link', description: 'Hides the "report" link on user comments.', newCategory: 'Video Comments', css: '.comments-action-report.comments-action { display: none !important; }', page: 'video' },

        // --- LIVE CHAT ---
        {
            id: 'liveChatBlocking', name: 'Enable Live Chat Blocking', description: 'Adds a block button to live chat messages and hides messages from blocked users.', newCategory: 'Live Chat', isManagement: true,
            async init() {
                if (!document.querySelector('.video-header-live-info')) return;
                appState.liveChatBlockedUsers = await settingsManager.getBlockedUsers('livechat');
                this.applyBlockedUsers();
                this.setupObserver();
            },
            destroy() { if (this.observer) this.observer.disconnect(); $('.res-live-chat-block-btn').remove(); styleManager.remove('live-chat-block-css'); },
            setupObserver() {
                const handleMutations = (mutations) => {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node.nodeType === 1 && $(node).is('.chat-history--row')) {
                                this.addBlockButton($(node));
                            }
                        }
                    }
                    this.applyBlockedUsers();
                };
                this.observer = new MutationObserver(handleMutations);
                waitForElement('.chat-history', ($chatContainer) => {
                    this.observer.observe($chatContainer[0], { childList: true, subtree: true });
                    $chatContainer.find('.chat-history--row').each((i, el) => this.addBlockButton($(el)));
                });
            },
            addBlockButton($message) {
                if ($message.find('.res-live-chat-block-btn').length > 0) return;
                const username = $message.data('username');
                if (!username) return;
                const $btn = $(`<button class="res-live-chat-block-btn" title="Block ${username}">${ICONS.block}</button>`);
                $message.find('.chat-history--message-wrapper').append($btn);
            },
            applyBlockedUsers() {
                if (appState.liveChatBlockedUsers.length === 0) {
                    styleManager.remove('live-chat-block-css');
                    return;
                }
                const selector = appState.liveChatBlockedUsers.map(user => `.chat-history--row[data-username="${user}"]`).join(', ');
                styleManager.inject('live-chat-block-css', `${selector} { display: none !important; }`);
            },
            async blockUser(username) { if (!username || appState.liveChatBlockedUsers.includes(username)) return; appState.liveChatBlockedUsers.push(username); await settingsManager.saveBlockedUsers(appState.liveChatBlockedUsers, 'livechat'); this.applyBlockedUsers(); createToast(`Live chat user "${username}" has been blocked.`); },
            async unblockUser(username) { appState.liveChatBlockedUsers = appState.liveChatBlockedUsers.filter(u => u !== username); await settingsManager.saveBlockedUsers(appState.liveChatBlockedUsers, 'livechat'); this.applyBlockedUsers(); createToast(`Live chat user "${username}" has been unblocked.`); populateBlockedUsersList('livechat'); },
            async unblockAllUsers() { appState.liveChatBlockedUsers = []; await settingsManager.saveBlockedUsers([], 'livechat'); this.applyBlockedUsers(); createToast('All live chat users have been unblocked.', 'success', 2000); populateBlockedUsersList('livechat'); }
        },
        {
            id: 'cleanLiveChat', name: 'Clean Live Chat UI', description: 'Hides pinned messages, the header, and Rant buttons for a cleaner, more focused live chat experience.', newCategory: 'Live Chat', page: 'video',
            css: `
                /* Hide pinned messages and their container */
                div.chat-pinned-ui__pinned-message-container,
                div.chat__pinned-ui-container {
                  display: none !important;
                }

                /* Hide the chat header and adjust the main chat area to fill the space */
                div.chat--header {
                  display: none !important;
                }
                section.chat.relative {
                  margin-top: -71px !important;
                  height: 715px !important;
                }

                /* Reposition the chat toggle button */
                button.media-page-chat-container-toggle-btn {
                  margin-top: 580px !important;
                  margin-left: -48px !important;
                }

                /* Hide the Rants/actions section above the chat input and the user's avatar */
                div.chat-message-form-section.chat-message-form-section-justify-between,
                .chat-message-form-section .user-image {
                  display: none !important;
                }
            `
        },
    ];

    // ——————————————————————————————————————————————————————————————————————————
    // 5. UI & SETTINGS PANEL CONSTRUCTION
    // ——————————————————————————————————————————————————————————————————————————
    function buildSettingsPanel() {
        const categoryOrder = ['Main Page Layout', 'Video Page Layout', 'Player Controls', 'Video Buttons', 'Video Comments', 'Live Chat', 'Navigation', 'Theme & Appearance'];
        const featuresByCategory = categoryOrder.reduce((acc, cat) => ({...acc, [cat]: []}), {});
        features.forEach(f => { if (f.newCategory && featuresByCategory[f.newCategory]) featuresByCategory[f.newCategory].push(f); });

        let tabsHTML = '';
        let panesHTML = '';
        categoryOrder.forEach((cat, index) => {
            const categoryFeatures = featuresByCategory[cat];
            if (categoryFeatures.length === 0) return;

            const activeClass = index === 0 ? 'active' : '';
            const catId = cat.replace(/ /g, '-').replace(/&/g, 'and');
            tabsHTML += `<button class="res-tab-btn ${activeClass}" data-tab="${catId}">${cat}</button>`;
            panesHTML += `<div id="res-pane-${catId}" class="res-settings-pane ${activeClass}">`;

            if (cat === 'Video Comments') panesHTML += buildBlockerPane(categoryFeatures, 'comment');
            else if (cat === 'Live Chat') panesHTML += buildBlockerPane(categoryFeatures, 'livechat');
            else if (cat === 'Theme & Appearance') panesHTML += buildThemePane(categoryFeatures);
            else {
                 panesHTML += `<div class="res-setting-row res-toggle-all-row" data-category-id="${catId}"><div class="res-setting-row-text"><label for="res-toggle-all-${catId}">Toggle All</label><small>Enable or disable all settings in this category.</small></div><label class="res-switch"><input type="checkbox" id="res-toggle-all-${catId}" class="res-toggle-all-cb"><span class="res-slider"></span></label></div>`;
                 categoryFeatures.forEach(f => panesHTML += buildSettingRow(f));
            }
            panesHTML += `</div>`;
        });

        const panelHTML = `
            <div id="res-panel-overlay"></div>
            <div id="res-settings-panel" role="dialog" aria-modal="true" aria-labelledby="res-panel-title">
                <div class="res-settings-header">
                     <div class="res-header-title" id="res-panel-title">${ICONS.cog} <h2>Rumble Enhancement Suite</h2></div>
                     <button id="res-close-settings" class="res-header-button" title="Close (Esc)">${ICONS.close}</button>
                </div>
                <div class="res-settings-body">
                    <div class="res-settings-tabs">${tabsHTML}</div>
                    <div class="res-settings-content">${panesHTML}</div>
                </div>
                <div class="res-settings-footer">
                     <span class="res-version" title="Keyboard Shortcut: Ctrl+Alt+R">v11.0</span>
                     <label class="res-theme-select"><span>Panel Theme:</span><select id="res-panel-theme-selector">
                        <option value="dark" ${appState.settings.panelTheme === 'dark' ? 'selected' : ''}>Professional Dark</option>
                        <option value="light" ${appState.settings.panelTheme === 'light' ? 'selected' : ''}>Professional Light</option>
                    </select></label>
                </div>
            </div>`;
        $('body').append(panelHTML);
        updateAllToggleStates();
    }

    function buildSettingRow(f) {
        const checked = appState.settings[f.id] ? 'checked' : '';
        const rowClass = f.isManagement ? 'res-management-row' : 'res-setting-row';
        return `<div class="${rowClass}" data-feature-id="${f.id}">
            <div class="res-setting-row-text"><label for="res-toggle-${f.id}">${f.name}</label><small>${f.description}</small></div>
            <label class="res-switch"><input type="checkbox" id="res-toggle-${f.id}" ${checked} class="res-feature-cb"><span class="res-slider"></span></label>
        </div>`;
    }

    function buildBlockerPane(features, type) {
        let html = '';
        features.filter(feat => !feat.isManagement).forEach(feat => html += buildSettingRow(feat));
        const managementFeature = features.find(feat => feat.isManagement);
        html += buildSettingRow(managementFeature);
        html += `
         <div class="res-blocked-users-container" data-blocker-type="${type}">
            <div class="res-blocked-users-list-header"><h3>Blocked Users</h3><button class="res-button res-button-danger res-unblock-all-btn">Unblock All</button></div>
            <div class="res-blocked-users-list"></div>
         </div>`;
        return html;
    }

    function buildThemePane(features) {
        let html = '';
        const siteThemeFeature = features.find(f => f.id === 'siteTheme');
        html += `
         <div class="res-setting-row res-management-row" data-feature-id="${siteThemeFeature.id}">
            <div class="res-setting-row-text">
                <label>${siteThemeFeature.name}</label>
                <small>${siteThemeFeature.description}</small>
            </div>
            <div class="res-button-group">
                <label class="res-button res-radio-button" title="Let Rumble decide based on your OS setting.">
                    <input type="radio" name="res-site-theme" class="res-theme-button" data-theme-value="system" ${appState.settings.siteTheme === 'system' ? 'checked' : ''}>
                    ${ICONS.system}<span>System</span>
                </label>
                <label class="res-button res-radio-button" title="Force Rumble into Dark Mode.">
                     <input type="radio" name="res-site-theme" class="res-theme-button" data-theme-value="dark" ${appState.settings.siteTheme === 'dark' ? 'checked' : ''}>
                    ${ICONS.dark}<span>Dark</span>
                </label>
                <label class="res-button res-radio-button" title="Force Rumble into Light Mode.">
                     <input type="radio" name="res-site-theme" class="res-theme-button" data-theme-value="light" ${appState.settings.siteTheme === 'light' ? 'checked' : ''}>
                    ${ICONS.light}<span>Light</span>
                </label>
            </div>
        </div>`;
        return html;
    }

    async function populateBlockedUsersList(type) {
        const users = await settingsManager.getBlockedUsers(type);
        const $container = $(`.res-blocked-users-container[data-blocker-type="${type}"]`);
        const $list = $container.find('.res-blocked-users-list');
        const $unblockAllBtn = $container.find('.res-unblock-all-btn');
        $list.empty();
        if (users.length === 0) {
            $list.append('<div class="res-list-empty">No users blocked.</div>');
            $unblockAllBtn.hide();
        } else {
            users.sort((a,b) => a.toLowerCase().localeCompare(b.toLowerCase())).forEach(user => {
                $list.append(`<div class="res-blocked-user-item"><span>${user}</span><button class="res-button res-unblock-btn" data-username="${user}" title="Unblock ${user}">Unblock</button></div>`);
            });
            $unblockAllBtn.show();
        }
    }

    function injectControls() {
        const gearButtonHTML = `<button id="res-settings-button" title="Rumble Enhancement Suite Settings (Ctrl+Alt+R)">${ICONS.cog}</button>`;

        const addClickListener = () => {
            $('#res-settings-button').off('click').on('click', () => {
                $('body').addClass('res-panel-open');
                populateBlockedUsersList('comment');
                populateBlockedUsersList('livechat');
                features.find(f => f.id === 'siteTheme').sync();
            });
        };

        // Use a single, reliable interval to inject controls into the header
        setInterval(() => {
            if ($('#res-settings-button').length > 0) return;

            const $target = $('.header-user-actions .header-user');
            if ($target.length > 0) {
                $target.before(gearButtonHTML);
                addClickListener();
            }
        }, 500);
    }

    function createToast(message, type = 'success', duration = 3000) {
        $('.res-toast').remove();
        const toast = $(`<div class="res-toast ${type}"></div>`).text(message);
        $('body').append(toast);
        setTimeout(() => toast.addClass('show'), 10);
        setTimeout(() => { toast.removeClass('show'); setTimeout(() => toast.remove(), 500); }, duration);
    }

    function updateAllToggleStates() {
        $('.res-toggle-all-row').each(function() {
            const catId = $(this).data('category-id');
            const $pane = $(`#res-pane-${catId}`);
            const $featureToggles = $pane.find('.res-feature-cb');
            const allChecked = $featureToggles.length > 0 && $featureToggles.filter(':checked').length === $featureToggles.length;
            $(this).find('.res-toggle-all-cb').prop('checked', allChecked);
        });
    }

    function attachUIEventListeners() {
        const $doc = $(document);

        // Panel Controls
        $doc.on('click', '#res-close-settings, #res-panel-overlay', () => $('body').removeClass('res-panel-open'));
        $doc.on('click', '.res-tab-btn', function() { $('.res-tab-btn, .res-settings-pane').removeClass('active'); $(this).addClass('active'); $(`#res-pane-${$(this).data('tab')}`).addClass('active'); });
        $doc.on('keydown', (e) => {
            if (e.key === "Escape") {
                if ($('body').hasClass('res-panel-open')) {
                    $('body').removeClass('res-panel-open');
                }
            }
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r') {
                 e.preventDefault(); e.stopPropagation();
                 $('body').toggleClass('res-panel-open');
                 if ($('body').hasClass('res-panel-open')) { populateBlockedUsersList('comment'); populateBlockedUsersList('livechat'); features.find(f => f.id === 'siteTheme').sync(); }
            }
        });

        // Feature Toggles
        $doc.on('change', '.res-feature-cb', async function() {
            const featureId = $(this).closest('.res-setting-row, .res-management-row').data('feature-id');
            const isEnabled = $(this).is(':checked');
            appState.settings[featureId] = isEnabled;
            await settingsManager.save(appState.settings);
            const feature = features.find(f => f.id === featureId);

            if (feature.css) {
                applyAllCssFeatures();
            } else if (feature.init || feature.destroy) {
                isEnabled ? feature.init?.() : feature.destroy?.();
            }

            if (!feature.isManagement) createToast(`${feature.name} ${isEnabled ? 'Enabled' : 'Disabled'}`);
            updateAllToggleStates();
        });
        $doc.on('change', '.res-toggle-all-cb', function() {
            const isEnabled = $(this).is(':checked');
            const catId = $(this).closest('.res-toggle-all-row').data('category-id');
            $(`#res-pane-${catId}`).find('.res-feature-cb').not(':disabled').each(function() { if ($(this).is(':checked') !== isEnabled) $(this).prop('checked', isEnabled).trigger('change'); });
        });

        // Theme Controls
        $doc.on('change', '#res-panel-theme-selector', async function() {
            appState.settings.panelTheme = $(this).val();
            await settingsManager.save(appState.settings);
            $('html').attr('data-res-theme', appState.settings.panelTheme);
        });
        $doc.on('change', '.res-theme-button', async function() {
            const newTheme = $(this).data('theme-value');
            appState.settings.siteTheme = newTheme;
            await settingsManager.save(appState.settings);
            features.find(f => f.id === 'siteTheme').apply(newTheme);
        });

        // Comment Blocker
        const commentBlocker = features.find(f => f.id === 'commentBlocking');
        $doc.on('click', '.res-block-user-btn', function() { commentBlocker?.blockUser($(this).data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="comment"] .res-unblock-btn', function() { commentBlocker?.unblockUser($(this).data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="comment"] .res-unblock-all-btn', function() { if (confirm('Are you sure you want to unblock all comment users?')) commentBlocker?.unblockAllUsers(); });

        // Live Chat Blocker
        const liveChatBlocker = features.find(f => f.id === 'liveChatBlocking');
        $doc.on('click', '.res-live-chat-block-btn', function(e) { e.stopPropagation(); liveChatBlocker?.blockUser($(this).closest('.chat-history--row').data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="livechat"] .res-unblock-btn', function() { liveChatBlocker?.unblockUser($(this).data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="livechat"] .res-unblock-all-btn', function() { if (confirm('Are you sure you want to unblock all live chat users?')) liveChatBlocker?.unblockAllUsers(); });
    }

    // ——————————————————————————————————————————————————————————————————————————
    // 6. STYLES
    // ——————————————————————————————————————————————————————————————————————————
    function injectPanelStyles() {
        GM_addStyle(`
:root { --res-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"; }
html[data-res-theme='dark'] { --res-bg-primary: #181a1b; --res-bg-secondary: #25282a; --res-bg-tertiary: #34383b; --res-bg-hover: #3d4245; --res-text-primary: #e8e6e3; --res-text-secondary: #b3b0aa; --res-border-color: #454a4d; --res-accent: #5a93ff; --res-accent-hover: #7eb0ff; --res-accent-glow: rgba(90, 147, 255, 0.3); --res-success: #22c55e; --res-error: #ef4444; --res-error-hover: #ff5252; --res-header-icon-color: #e8e6e3; --res-header-icon-hover-bg: #31363f; }
html[data-res-theme='light'] { --res-bg-primary: #ffffff; --res-bg-secondary: #f1f3f5; --res-bg-tertiary: #e9ecef; --res-bg-hover: #e2e6e9; --res-text-primary: #212529; --res-text-secondary: #6c757d; --res-border-color: #ced4da; --res-accent: #0d6efd; --res-accent-hover: #3b82f6; --res-accent-glow: rgba(13, 110, 253, 0.25); --res-success: #198754; --res-error: #dc3545; --res-header-icon-color: #212529; --res-header-icon-hover-bg: #f1f3f5; }

/* === SITE FIXES & ENHANCEMENTS === */
html.main-menu-mode-permanent { margin-top: -70px !important; }
div.border-0.border-b.border-solid.border-background-highlight,
div.hover-menu.main-menu-nav {
  border-style: none !important;
}

/* === Global Controls === */
#res-settings-button { background: transparent; border: none; cursor: pointer; padding: 6px; margin: 0 4px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background-color 0.2s ease, transform 0.2s ease; }
#res-settings-button:hover { background-color: var(--res-header-icon-hover-bg); transform: scale(1.1) rotate(15deg); }
#res-settings-button svg { width: 26px; height: 26px; color: var(--res-header-icon-color); }
.header-user-actions, div[data-js="media_channel_container"] { display: flex; align-items: center; gap: 8px; }

/* === Settings Panel: Overlay & Container === */
#res-panel-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); z-index: 9998; opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
#res-settings-panel { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.95); z-index: 9999; opacity: 0; pointer-events: none; transition: opacity 0.3s ease, transform 0.3s ease; display: flex; flex-direction: column; width: 95%; max-width: 1024px; max-height: 90vh; background: var(--res-bg-primary); color: var(--res-text-primary); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); font-family: var(--res-font); border-radius: 16px; border: 1px solid var(--res-border-color); overflow: hidden; }
body.res-panel-open #res-panel-overlay { opacity: 1; pointer-events: auto; }
body.res-panel-open #res-settings-panel { opacity: 1; pointer-events: auto; transform: translate(-50%, -50%) scale(1); }

/* === Settings Panel: Header, Body, Footer === */
.res-settings-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 12px 24px; border-bottom: 1px solid var(--res-border-color); flex-shrink: 0; }
.res-header-title { display: flex; align-items: center; gap: 14px; }
.res-header-title svg { color: var(--res-accent); }
.res-header-title h2 { font-size: 18px; font-weight: 600; margin: 0; }
.res-header-button { background: none; border: none; cursor: pointer; padding: 8px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background-color 0.2s ease, transform 0.2s ease; }
.res-header-button:hover { background: var(--res-bg-secondary); transform: scale(1.1); }
.res-header-button svg { width: 20px; height: 20px; color: var(--res-text-secondary); }
.res-settings-body { display: flex; flex-grow: 1; overflow: hidden; }
.res-settings-tabs { display: flex; flex-direction: column; gap: 4px; padding: 24px 16px; border-right: 1px solid var(--res-border-color); flex-shrink: 0; overflow-y: auto; }
.res-tab-btn { background: none; border: none; color: var(--res-text-secondary); font-family: var(--res-font); font-size: 15px; text-align: left; padding: 10px 16px; cursor: pointer; transition: all 0.2s; font-weight: 500; border-radius: 8px; border-left: 3px solid transparent; width: 100%; }
.res-tab-btn:hover { background-color: var(--res-bg-secondary); color: var(--res-text-primary); }
.res-tab-btn.active { color: var(--res-accent); border-left-color: var(--res-accent); font-weight: 600; background-color: var(--res-bg-secondary); }
.res-settings-content { flex-grow: 1; overflow-y: auto; padding: 24px; }
.res-settings-pane { display: none; }
.res-settings-pane.active { display: grid; gap: 16px; animation: res-fade-in 0.4s ease-out; }
@keyframes res-fade-in { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
.res-settings-footer { padding: 12px 24px; border-top: 1px solid var(--res-border-color); flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; background: var(--res-bg-secondary); }
.res-theme-select { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.res-theme-select select { background: var(--res-bg-tertiary); color: var(--res-text-primary); border: 1px solid var(--res-border-color); border-radius: 6px; padding: 6px 8px; font-family: var(--res-font); font-size: 14px; }
.res-version { font-size: 12px; color: var(--res-text-secondary); cursor: help; }

/* === Settings Panel: Setting Rows & Toggles === */
.res-setting-row, .res-management-row { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 16px; background: var(--res-bg-secondary); border: 1px solid var(--res-border-color); border-radius: 12px; transition: box-shadow .2s; }
.res-setting-row:hover, .res-management-row:hover { box-shadow: 0 0 15px rgba(0,0,0,0.1); }
.res-toggle-all-row { background: var(--res-bg-primary); border-style: dashed; }
.res-setting-row-text { display: flex; flex-direction: column; gap: 4px; }
.res-setting-row label[for], .res-management-row label { font-size: 16px; font-weight: 500; cursor: pointer; color: var(--res-text-primary); }
.res-setting-row small, .res-management-row small { color: var(--res-text-secondary); font-size: 13px; line-height: 1.4; }
.res-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0;}
.res-switch.disabled { opacity: 0.5; cursor: not-allowed; }
.res-switch input { opacity: 0; width: 0; height: 0; }
.res-slider { position: absolute; cursor: pointer; inset: 0; background-color: var(--res-bg-tertiary); transition: .4s; border-radius: 34px; }
.res-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
.res-switch input:checked + .res-slider { background-color: var(--res-accent); box-shadow: 0 0 10px var(--res-accent-glow); }
.res-switch input:checked + .res-slider:before { transform: translateX(20px); }
.res-switch.small { width: 38px; height: 20px; }
.res-switch.small .res-slider:before { height: 14px; width: 14px; }
.res-switch.small input:checked + .res-slider:before { transform: translateX(18px); }

/* === Buttons & Inputs === */
.res-button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 14px; font-size: 14px; font-weight: 500; border-radius: 8px; border: 1px solid var(--res-border-color); cursor: pointer; transition: all .2s; background-color: var(--res-bg-tertiary); color: var(--res-text-primary); }
.res-button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
.res-button-primary { background-color: var(--res-accent); border-color: var(--res-accent); color: white; }
.res-button-primary:hover:not(:disabled) { background-color: var(--res-accent-hover); border-color: var(--res-accent-hover); }
.res-button-danger { background-color: var(--res-error); border-color: var(--res-error); color: white; }
.res-button-danger:hover:not(:disabled) { background-color: var(--res-error-hover); border-color: var(--res-error-hover); }
.res-icon-button { padding: 6px; }
.res-icon-button svg, .res-button svg { width: 16px; height: 16px; }
.res-button-group { display: flex; gap: 8px; }
.res-button.res-radio-button { padding: 8px 12px; }
.res-button.res-radio-button input { display: none; }
.res-button.res-radio-button:has(input:checked) { background-color: var(--res-accent); color: white; border-color: var(--res-accent); }
.res-input { background: var(--res-bg-primary); color: var(--res-text-primary); border: 1px solid var(--res-border-color); border-radius: 6px; padding: 8px 10px; font-family: var(--res-font); font-size: 14px; width: 100%; transition: border-color .2s, box-shadow .2s; }
.res-input:focus { outline: none; border-color: var(--res-accent); box-shadow: 0 0 0 3px var(--res-accent-glow); }
.res-input:disabled { background-color: var(--res-bg-tertiary); opacity: 0.7; cursor: not-allowed; }
.res-list-empty { color: var(--res-text-secondary); text-align: center; padding: 24px; font-style: italic; }

/* === Management Panes (Comments, Nav) === */
.res-management-row { border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none; }
.res-blocked-users-container { background: var(--res-bg-secondary); border: 1px solid var(--res-border-color); border-radius: 0 0 12px 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; margin-top: -16px; }
.res-blocked-users-list-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid var(--res-border-color); }
.res-blocked-users-list-header h3 { font-size: 16px; font-weight: 600; margin: 0; }
.res-blocked-users-list { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 8px; }
.res-blocked-user-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; border-bottom: 1px solid var(--res-border-color); }
.res-blocked-user-item:last-child { border-bottom: none; }
.res-blocked-user-item span { font-weight: 500; }
.res-unblock-btn { padding: 4px 10px; font-size: 13px; }

/* === Toast & Spinners === */
@keyframes res-spin { to { transform: rotate(360deg); } }
.res-spinner-svg { animation: res-spin 1.2s cubic-bezier(0.5, 0.15, 0.5, 0.85) infinite; }
.res-toast { position: fixed; bottom: -100px; left: 50%; transform: translateX(-50%); color: white; padding: 12px 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: var(--res-font); font-size: 15px; font-weight: 500; z-index: 10002; transition: all 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55); border-radius: 8px; }
.res-toast.show { bottom: 20px; }
.res-toast.success { background-color: var(--res-success); }
.res-toast.error { background-color: var(--res-error); }

/* === Blocker UI === */
.comments-meta { position: relative; }
.res-block-user-btn { position: absolute; right: 0; top: 50%; transform: translateY(-50%); background-color: var(--res-error); color: white; border: none; border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: 600; cursor: pointer; opacity: 0; transition: opacity .2s, background-color .2s; }
.comment-item:hover .res-block-user-btn { opacity: 1; }
.res-block-user-btn:hover { background-color: var(--res-error-hover); }
.res-live-chat-block-btn { background: none; border: none; cursor: pointer; opacity: 0; transition: opacity .2s; padding: 2px 4px; margin-left: auto; }
.chat-history--row:hover .res-live-chat-block-btn { opacity: 0.4; }
.res-live-chat-block-btn:hover { opacity: 1; color: var(--res-error); }
.res-live-chat-block-btn svg { width: 14px; height: 14px; color: var(--res-text-secondary); }
.res-live-chat-block-btn:hover svg { color: var(--res-error); }

/* === RUD Downloader Integration & Overrides === */
#rud-comments-spacer { height: 0 !important; }
#rud-portal .rud-theme-toggle { display: none !important; }
#rud-download-btn {
    height: 36px;
    padding: 0.5rem 0.9rem;
    border-radius: 18px;
    font-size: 13px;
}
.rud-panel {
    border-radius: 16px;
    width: 600px;
}
.rud-body {
    padding: 0;
}
.rud-list {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.rud-group-box {
    background-color: var(--rud-bg-secondary);
    border: 1px solid var(--rud-border-color);
    border-radius: 12px;
    padding: 12px;
}
.rud-group-box-header {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--rud-border-color);
    color: var(--rud-text-primary);
}
.rud-group-box .rud-item {
    padding: 8px;
    margin: 0 !important;
}
.rud-item + .rud-item {
    margin-top: 2px !important;
}
.rud-item.rud-hide {
    display: none !important;
}
.rud-footer {
    padding: 12px 16px;
    background: transparent;
    border-top: none;
}
.rud-tar-note {
    font-size: 13px;
    padding: 10px;
    background-color: var(--rud-bg-secondary);
    border-radius: 8px;
}
`);
    }

    // ——————————————————————————————————————————————————————————————————————————
    // 7. RUD DOWNLOADER INTEGRATION LOGIC
    // ——————————————————————————————————————————————————————————————————————————

    function integrateRUD() {
        // Helper to parse size string from RUD items (e.g., "1.2 GB", "500 MB") into MB
        function parseSizeToMB(sizeStr) {
            if (!sizeStr || typeof sizeStr !== 'string') return null;
            const parts = sizeStr.trim().split(' ');
            if (parts.length < 2) return null;

            const value = parseFloat(parts[0]);
            const unit = parts[1].toUpperCase();

            if (isNaN(value)) return null;

            switch (unit) {
                case 'GB': return value * 1024;
                case 'MB': return value;
                case 'KB': return value / 1024;
                case 'B': return value / (1024 * 1024);
                default: return null;
            }
        }

        // Observer to restructure and filter the RUD download list
        const rudListObserver = new MutationObserver((mutations) => {
            const list = document.querySelector('.rud-panel .rud-list');
            if (!list || mutations.length === 0 || list.hasAttribute('data-res-processed')) return;

            const items = Array.from(list.querySelectorAll('.rud-item'));
            if (items.length === 0) return;

            // Mark as processed to prevent re-triggering
            list.setAttribute('data-res-processed', 'true');

            // 1. Filter items smaller than 50 MB
            items.forEach(item => {
                const sizeEl = item.querySelector('.rud-item-size');
                const sizeText = sizeEl ? sizeEl.textContent : '';
                const sizeInMB = parseSizeToMB(sizeText);
                if (sizeInMB !== null && sizeInMB < 50) {
                    item.classList.add('rud-hide');
                }
            });

            // 2. Group items into MP4 and TAR containers
            const mp4Items = items.filter(item => item.dataset.type === 'mp4' && !item.classList.contains('rud-hide'));
            const tarItems = items.filter(item => item.dataset.type === 'tar' && !item.classList.contains('rud-hide'));

            // Clear the original list content
            list.innerHTML = '';

            if (mp4Items.length > 0) {
                const mp4Group = document.createElement('div');
                mp4Group.className = 'rud-group-box';
                mp4Group.innerHTML = '<div class="rud-group-box-header">MP4 Videos</div>';
                mp4Items.forEach(item => mp4Group.appendChild(item));
                list.appendChild(mp4Group);
            }

            if (tarItems.length > 0) {
                const tarGroup = document.createElement('div');
                tarGroup.className = 'rud-group-box';
                tarGroup.innerHTML = '<div class="rud-group-box-header">TAR Archives (for Live Replays)</div>';
                tarItems.forEach(item => tarGroup.appendChild(item));
                list.appendChild(tarGroup);
            }

            // Disconnect and reset after a short delay to allow for more items to load
            setTimeout(() => list.removeAttribute('data-res-processed'), 500);
        });

        // Observer to detect when the RUD panel is added to the DOM
        const rudPanelObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && node.matches('.rud-panel')) {
                        const list = node.querySelector('.rud-list');
                        if (list) {
                            rudListObserver.observe(list, { childList: true });
                        }
                    }
                }
            }
        });

        // Start observing for the RUD portal itself
        const portal = document.getElementById('rud-portal');
        if (portal) {
            rudPanelObserver.observe(portal, { childList: true });
        }
    }


    // ——————————————————————————————————————————————————————————————————————————
    // 8. EMBEDDED RUMBLE UNIVERSAL DOWNLOADER (RUD)
    // ——————————————————————————————————————————————————————————————————————————
    (function() {
      'use strict';

      // ---------------- Config ----------------
      const CDN_HOST = 'https://hugh.cdn.rumble.cloud';
      const ACTION_BAR_SELECTORS = [
        '.media-by-channel-actions-container',
        '.media-header__actions',
        '.media-by__actions',
        'div[data-js="video_action_button_group"]' // RES Fallback
      ];

      // exclude 'faa' per request
      const TOKEN_LABELS = { haa: '1080p', gaa: '720p', caa: '480p', baa: '360p', oaa: '240p' };
      const TOKENS = ['haa', 'gaa', 'caa', 'baa', 'oaa'];

      const PROBE_CONCURRENCY = 6;
      const COLLECTION_GRACE_MS = 3500;
      const COLLECTION_TICK_MS = 350;

      const EMBED_UNITS = ['u0','u1','u2','u3','u4'];
      const EMBED_VARIANTS = [
        ({v}) => `https://rumble.com/embedJS/u0/?request=video&v=${encodeURIComponent(v)}`,
        ({v, dref='rumble.com'}) => `https://rumble.com/embedJS/u3/?ifr=0&dref=${encodeURIComponent(dref)}&request=video&ver=2&v=${encodeURIComponent(v)}`
      ];

      // ---------------- Small utils ----------------
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      function debounce(fn, d) { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), d); }; }
      function raf(fn){ return new Promise(r=> requestAnimationFrame(()=>{ try{ fn(); }finally{ r(); } })); }
      function $(s, r=document){ return r.querySelector(s); }
      function $all(s, r=document){ return Array.from(r.querySelectorAll(s)); }
      function isVideoPage(p = location.pathname) { return /^\/v[A-Za-z0-9]+(?:[\/\.-]|$)/.test(p); }

      function getVideoIdFromString(str) {
        if (!str) return null;
        const m = str.match(/\/v([A-Za-z0-9]+)(?:[\/\.-]|$)/);
        return m ? m[1] : null;
      }
      function getVideoId() {
        let id = getVideoIdFromString(location.pathname);
        if (id) return id;
        const canonical = $('link[rel="canonical"]')?.href;
        if (canonical) { id = getVideoIdFromString(canonical); if (id) return id; }
        const og = $('meta[property="og:url"]')?.content || $('meta[property="og:video:url"]')?.content;
        if (og) { id = getVideoIdFromString(og); if (id) return id; }
        return null;
      }

      function getVideoTitle() {
        const og = $('meta[property="og:title"]')?.content?.trim();
        if (og) return og;
        const docTitle = document.title?.trim();
        if (docTitle) {
          const cleaned = docTitle.replace(/\s*[-–—]\s*Rumble\s*$/i, '').trim();
          if (cleaned) return cleaned;
        }
        const h1 = $('h1')?.textContent?.trim();
        if (h1) return h1;
        return 'video';
      }
      function sanitizeFilename(name) {
        return String(name)
          .replace(/[\\/:*?"<>|]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 180);
      }
      function filenameWithExt(title, label, url) {
        const extMatch = /\.([a-z0-9]+)(?:$|\?)/i.exec(url);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'mp4';
        const base = sanitizeFilename(title);
        const res = label ? ` - ${label}` : '';
        return `${base}${res}.${ext}`;
      }

      function formatBytes(bytes) {
        if (!Number.isFinite(bytes) || bytes <= 0) return '';
        const u = ['B','KB','MB','GB','TB'];
        let i=0,n=bytes; while (n>=1024 && i<u.length-1){ n/=1024; i++; }
        return `${n.toFixed(n>=10?0:1)} ${u[i]}`;
      }
      function parseTotalSizeFromHeaders(h) {
        let m = h?.match(/content-range:\s*bytes\s+\d+-\d+\/(\d+)/i);
        if (m) { const n = +m[1]; return Number.isFinite(n) ? n : undefined; }
        m = h?.match(/content-length:\s*(\d+)/i);
        if (m) { const n = +m[1]; return Number.isFinite(n) ? n : undefined; }
        return undefined;
      }

      function probeUrl(url, timeout = 12000) {
        return new Promise((resolve) => {
          let done = false;
          const finish = (ok, size) => { if (!done) { done = true; resolve({ ok, size }); } };
          GM_xmlhttpRequest({
            method: 'HEAD', url, timeout,
            onload: (r) => { const ok = r.status>=200 && r.status<400; finish(ok, parseTotalSizeFromHeaders(r.responseHeaders||'')); },
            onerror: () => {
              GM_xmlhttpRequest({
                method: 'GET', url, timeout, headers: { Range: 'bytes=0-0' },
                onload: (r2)=>{ const ok = r2.status>=200 && r2.status<400; finish(ok, parseTotalSizeFromHeaders(r2.responseHeaders||'')); },
                onerror: ()=>finish(false), ontimeout: ()=>finish(false)
              });
            },
            ontimeout: ()=>finish(false)
          });
        });
      }

      function tokenToLabel(t) {
        const low = (t||'').toLowerCase();
        if (!low || low==='faa') return null;
        return TOKEN_LABELS[low] || low;
      }
      function tokenRank(t) {
        switch ((t||'').toLowerCase()) {
          case 'haa': return 50; case 'gaa': return 40; case 'caa': return 30; case 'baa': return 20; case 'oaa': return 10; default: return 0;
        }
      }
      function typeFromUrl(u){ return /\.tar(\?|$)/i.test(u) ? 'tar' : 'mp4'; }
      function extractTokenFromUrl(u){ const m = u.match(/\.([A-Za-z]{3})(?:\.rec)?\.(?:mp4|tar)\b/i); return m ? m[1] : null; }
      function hostScore(u){ try{ const h=new URL(u,location.href).host; return h.includes('hugh.cdn.rumble.cloud')?2:1; }catch{ return 0; } }

      // ---------------- Network & DOM capture ----------------
      const captured = new Set();
      const embedSeen = new Set();

      function maybeCapture(url) {
        try{
          const u = new URL(url, location.href).href;
          if (/\/video\/[^\s"'<>]+\.(?:mp4|tar)\b/i.test(u)) captured.add(u);
          else if (/rumble\.com\/embedJS\//i.test(u)) embedSeen.add(u);
          else if (/\.(?:m3u8|ts)\b/i.test(u)) captured.add(`__HINT__${u}`);
          else if (/[?&]r_file=/.test(u)) {
            try { const qs = new URL(u).searchParams.get('r_file'); if (qs) captured.add(`__HINT__${qs}`); } catch {}
          }
        }catch{}
      }

      const _fetch = window.fetch;
      if (typeof _fetch === 'function') {
        window.fetch = function(input, init) {
          try { const url = typeof input === 'string' ? input : input?.url; if (url) maybeCapture(url); } catch {}
          return _fetch.apply(this, arguments);
        };
      }
      const XO = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        try { if (url) maybeCapture(url); } catch {}
        return XO.apply(this, arguments);
      };

      function collectFromLocationParams(sink) {
        try {
          const usp = new URLSearchParams(location.search);
          const rfile = usp.get('r_file');
          if (rfile) sink.add(`__HINT__${rfile}`);
        } catch {}
      }

      function findMediaInDom() {
        const out = new Set();
        const addAbs = (u)=>{ try{ out.add(new URL(u, location.href).href); }catch{} };
        const add = (u)=>{ if (!u) return; if (/^__HINT__/.test(u)) out.add(u); else addAbs(u); };

        $all('[src],[href]').forEach(el=>{
          const v = el.getAttribute('src') || el.getAttribute('href') || '';
          if (/\/video\/.+\.(?:mp4|tar)(?:\?|$)/i.test(v)) add(v);
          if (/rumble\.com\/embedJS\//i.test(v)) { try{ embedSeen.add(new URL(v,location.href).href); }catch{} }
          if (/\.(?:m3u8|ts)(?:\?|$)/i.test(v)) add(`__HINT__${v}`);
          if (/[?&]r_file=/.test(v)) {
            try { const q = new URL(v, location.href).searchParams.get('r_file'); if (q) add(`__HINT__${q}`); } catch {}
          }
        });

        $all('video,source').forEach(el=>{
          const v = el.src || '';
          if (/\/video\/.+\.(?:mp4|tar)(?:\?|$)/i.test(v)) add(v);
          if (/\.(?:m3u8|ts)(?:\?|$)/i.test(v)) add(`__HINT__${v}`);
        });

        const reDL = /https?:\/\/[^\s"'<>]+\/video\/[^\s"'<>]+\.(?:mp4|tar)\b[^\s"'<>]*/gi;
        const reE  = /https?:\/\/rumble\.com\/embedJS\/[^\s"'<>]+/gi;
        const reH  = /https?:\/\/[^\s"'<>]+\.(?:m3u8|ts)\b[^\s"'<>]*/gi;
        for (const s of $all('script')) {
          const text = (s.textContent||'').slice(0, 300000);
          let m; while ((m=reDL.exec(text))) add(m[0]);
          let e; while ((e=reE.exec(text))) embedSeen.add(e[0]);
          let h; while ((h=reH.exec(text))) add(`__HINT__${h[0]}`);
          const m2 = text.match(/r_file=([^\s"'&]+)/);
          if (m2 && m2[1]) add(`__HINT__${m2[1]}`);
        }

        const html = document.documentElement.outerHTML.slice(0, 1500000);
        let m; const re2=/https?:\/\/[^\s"'<>]+\/video\/[^\s"'<>]+\.(?:mp4|tar)\b[^\s"'<>]*/gi;
        while ((m=re2.exec(html))) add(m[0]);
        let e; const re2E=/https?:\/\/rumble\.com\/embedJS\/[^\s"'<>]+/gi;
        while ((e=re2E.exec(html))) embedSeen.add(e[0]);
        let h; const re2H=/https?:\/\/[^\s"'<>]+\.(?:m3u8|ts)\b[^\s"'<>]*/gi;
        while ((h=re2H.exec(html))) add(`__HINT__${h[0]}`);

        for (const u of captured) add(u);
        collectFromLocationParams(out);

        return Array.from(out);
      }

      // ---------------- EmbedJS fetch & parse ----------------
      function fetchEmbedJsonBy(url) {
        return new Promise((resolve) => {
          GM_xmlhttpRequest({
            method: 'GET', url, timeout: 15000,
            onload: (res) => { try{ if (res.status<200||res.status>=400) return resolve(null); resolve(JSON.parse(res.responseText)); }catch{ resolve(null); } },
            onerror: ()=>resolve(null), ontimeout: ()=>resolve(null)
          });
        });
      }
      async function fetchEmbedCandidatesByVideoId(vid) {
        const urls = new Set();
        for (const build of EMBED_VARIANTS) urls.add(build({ v: vid, dref: 'rumble.com' }));
        for (const unit of EMBED_UNITS) urls.add(`https://rumble.com/embedJS/${unit}/?request=video&v=${encodeURIComponent(vid)}`);
        const outs = [];
        for (const url of urls) {
          const j = await fetchEmbedJsonBy(url);
          if (j) outs.push(j);
        }
        return outs;
      }
      function collectFromEmbedJson(json, sink) {
        const add = (u)=>{ if (u && /\/video\/.+\.(?:mp4|tar)\b/i.test(u)) sink.add(u); };
        try {
          if (json.u) { add(json.u.tar?.url); add(json.u.timeline?.url); }
          if (json.ua) {
            for (const group of Object.values(json.ua)) {
              if (group && typeof group === 'object') {
                for (const k of Object.keys(group)) add(group[k]?.url);
              } else if (typeof group === 'string') add(group);
            }
          }
          if (json.i && /\/video\//.test(json.i)) sink.add(`__IMG__${json.i}`);
        } catch {}
      }
      async function harvestUrlsFromEmbedAll() {
        const out = new Set();
        for (const e of Array.from(embedSeen)) {
          const j = await fetchEmbedJsonBy(e);
          if (j) collectFromEmbedJson(j, out);
        }
        const vid = getVideoId();
        if (vid) {
          for (const j of await fetchEmbedCandidatesByVideoId(vid)) collectFromEmbedJson(j, out);
        }
        return Array.from(out);
      }

      // ---------------- Base derivation ----------------
      function parseFromMp4Url(mp4Url) {
        try {
          const u = new URL(mp4Url, location.href);
          const m = u.pathname.match(/\/video\/(.+?)\/([^\/]+)$/i);
          if (!m) return null;
          const pathPart = m[1], file = m[2];
          const fm = file.match(/^([A-Za-z0-9_-]+)\.([A-Za-z]{3})(?:\.rec)?\.mp4$/);
          if (!fm) return null;
          const baseId = fm[1], token = fm[2], isLive = /\.rec\.mp4$/i.test(file);
          return { pathPart, baseId, token, isLive };
        } catch { return null; }
      }
      function parseFromTarUrl(tarUrl) {
        try {
          const u = new URL(tarUrl, location.href);
          const m = u.pathname.match(/\/video\/(.+?)\/([^\/]+)$/i);
          if (!m) return null;
          const pathPart = m[1], file = m[2];
          const fm = file.match(/^([A-Za-z0-9_-]+)\.([A-Za-z]{3})(?:\.rec)?\.tar$/i);
          if (!fm) return null;
          const baseId = fm[1], token = fm[2], isLive = /\.rec\.tar$/i.test(file);
          return { pathPart, baseId, token, isLive };
        } catch { return null; }
      }
      function parseFromImageUrl(imgUrl) {
        try {
          const u = new URL(imgUrl, location.href);
          if (!/\/video\//.test(u.pathname)) return null;
          const m = u.pathname.match(/\/video\/(.+?)\/([^\/]+)$/i);
          if (!m) return null;
          const pathPart = m[1], file = m[2];
          const fm = file.match(/^([A-Za-z0-9_-]+)\./);
          if (!fm) return null;
          const baseId = fm[1];
          return { pathPart, baseId, token: null, isLive: null };
        } catch { return null; }
      }

      function buildCdnUrl(pathPart, baseId, token, kind, live) {
        if (kind === 'tar') {
          const rec = live ? '.rec' : '';
          return `${CDN_HOST}/video/${pathPart}/${baseId}.${token}${rec}.tar`;
        }
        return `${CDN_HOST}/video/${pathPart}/${baseId}.${token}.mp4`;
      }

      function generateCandidates(parts) {
        const { pathPart, baseId } = parts;
        const triesLive = parts.isLive===null ? [true,false] : [!!parts.isLive];
        const out = [];
        for (const live of triesLive) {
          for (const t of TOKENS) {
            const cap = t[0].toUpperCase()+t.slice(1);
            out.push({ url: buildCdnUrl(pathPart, baseId, t,   'tar', live), type:'tar', labelToken: t, caseVariant:'lower', origin:'generated', pri: (live?1:3) });
            out.push({ url: buildCdnUrl(pathPart, baseId, cap, 'tar', live), type:'tar', labelToken: t, caseVariant:'cap',   origin:'generated', pri: (live?1:3) });
            if (!live) {
              out.push({ url: buildCdnUrl(pathPart, baseId, t,   'mp4', false), type:'mp4', labelToken: t, caseVariant:'lower', origin:'generated', pri: 2 });
              out.push({ url: buildCdnUrl(pathPart, baseId, cap, 'mp4', false), type:'mp4', labelToken: t, caseVariant:'cap',   origin:'generated', pri: 2 });
            }
          }
        }
        out.sort((a,b)=> a.pri-b.pri || tokenRank(b.labelToken)-tokenRank(a.labelToken) || (a.caseVariant==='lower'? -1:1));
        return out;
      }

      // ---------------- UI (Premium Redesign) ----------------
      GM_addStyle(`
        :root {
          --rud-font-sans: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          --rud-font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;
          --rud-ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        #rud-portal.rud-dark {
          --rud-bg-primary: #111827; --rud-bg-secondary: #1f2937; --rud-bg-tertiary: #374151;
          --rud-text-primary: #f9fafb; --rud-text-secondary: #d1d5db; --rud-text-muted: #9ca3af;
          --rud-border-color: #374151;
          --rud-accent: #22c55e; --rud-accent-hover: #16a34a; --rud-accent-text: #ffffff;
          --rud-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
          --rud-backdrop-blur: blur(8px);
        }
        #rud-portal.rud-light {
          --rud-bg-primary: #ffffff; --rud-bg-secondary: #f3f4f6; --rud-bg-tertiary: #e5e7eb;
          --rud-text-primary: #111827; --rud-text-secondary: #374151; --rud-text-muted: #6b7280;
          --rud-border-color: #e5e7eb;
          --rud-accent: #16a34a; --rud-accent-hover: #15803d; --rud-accent-text: #ffffff;
          --rud-shadow: 0 10px 15px -3px rgba(0,0,0,0.07), 0 4px 6px -2px rgba(0,0,0,0.04);
          --rud-backdrop-blur: blur(8px);
        }

        #rud-portal { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; font-family: var(--rud-font-sans); }
        .rud-inline-wrap { position: relative; display: inline-block; }

        #rud-download-btn {
          position: relative; display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;
          font-size: 14px; font-weight: 600; line-height: 1; letter-spacing: 0.02em;
          background-image: linear-gradient(to top, #15803d, #16a34a);
          color: #fff; border: 1px solid #16a34a; border-radius: 8px;
          cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.1);
          transition: all .2s var(--rud-ease-out); overflow: hidden;
        }
        #rud-download-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1); background-image: linear-gradient(to top, #16a34a, #22c55e); }
        #rud-download-btn:active:not(:disabled) { transform: translateY(0px); }
        #rud-download-btn:disabled { opacity: .7; cursor: default; }
        #rud-download-btn .rud-btn-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; background: rgba(255,255,255,0.2); transition: width .2s var(--rud-ease-out); pointer-events:none; }
        #rud-download-btn .rud-btn-text { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 0.5rem; }

        .rud-panel {
          position: fixed; left: 0; top: 0; /* JS positioned */
          width: 640px; max-width: 95vw;
          background: var(--rud-bg-primary); color: var(--rud-text-primary);
          border: 1px solid var(--rud-border-color); border-radius: 12px;
          box-shadow: var(--rud-shadow); overflow: hidden; display: none;
          pointer-events: auto;
          backdrop-filter: var(--rud-backdrop-blur);
          -webkit-backdrop-filter: var(--rud-backdrop-blur);
          opacity: 0; transform: translateY(-10px) scale(0.98);
          transition: opacity 0.2s var(--rud-ease-out), transform 0.2s var(--rud-ease-out);
        }
        .rud-panel.open { display: flex; flex-direction: column; opacity: 1; transform: translateY(0) scale(1); }

        .rud-header { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--rud-border-color); }
        .rud-status { flex-grow: 1; font-size: 14px; color: var(--rud-text-secondary); }
        .rud-status .muted { color: var(--rud-text-muted); }
        .rud-header-controls { display: flex; align-items: center; gap: 8px; }
        .rud-icon-btn { display: flex; padding: 4px; background: none; border: none; border-radius: 6px; cursor: pointer; color: var(--rud-text-muted); transition: background .2s, color .2s; }
        .rud-icon-btn:hover { background: var(--rud-bg-secondary); color: var(--rud-text-primary); }
        .rud-icon-btn svg { width: 18px; height: 18px; }

        .rud-body { max-height: 60vh; overflow-y: auto; }
        .rud-list { display: flex; flex-direction: column; padding: 8px; }
        .rud-item { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; transition: background .2s; }
        .rud-item + .rud-item { margin-top: 4px; }
        .rud-item:hover { background: var(--rud-bg-secondary); }
        .rud-item-res { font-weight: 700; font-size: 15px; color: var(--rud-text-primary); min-width: 60px; }
        .rud-item-badge { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 12px; background: var(--rud-bg-tertiary); color: var(--rud-text-secondary); text-transform: uppercase; }
        .rud-item-size { font-size: 14px; color: var(--rud-text-muted); font-family: var(--rud-font-mono); margin-left: auto; }
        .rud-item-actions { display: flex; gap: 8px; margin-left: 16px; }
        .rud-item-actions a, .rud-item-actions button { display: flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 6px; transition: all .2s; }
        .rud-item-actions .rud-copy-btn { background: var(--rud-bg-tertiary); color: var(--rud-text-secondary); border: 1px solid var(--rud-border-color); cursor: pointer; }
        .rud-item-actions .rud-copy-btn:hover { background: var(--rud-border-color); color: var(--rud-text-primary); }
        .rud-item-actions .rud-dl-link { background: var(--rud-accent); color: var(--rud-accent-text); border: 1px solid var(--rud-accent); }
        .rud-item-actions .rud-dl-link:hover { background: var(--rud-accent-hover); }
        .rud-item-actions svg { width: 14px; height: 14px; }

        .rud-footer { padding: 12px 16px; border-top: 1px solid var(--rud-border-color); background: var(--rud-bg-secondary); }
        .rud-tar-note { font-size: 12px; color: var(--rud-text-muted); line-height: 1.5; }
        .rud-tar-note strong { color: var(--rud-text-secondary); }

        .rud-empty { padding: 48px 24px; text-align: center; color: var(--rud-text-muted); font-size: 14px; line-height: 1.6; }
        .rud-empty svg { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.5; }

        [data-rud-tooltip] { position: relative; }
        [data-rud-tooltip]::after {
          content: attr(data-rud-tooltip); position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
          background: #111827; color: #f9fafb; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 4px;
          white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;
        }
        [data-rud-tooltip]:hover::after { opacity: 1; transform: translateX(-50%) translateY(-2px); }

        #rud-comments-spacer { width: 100%; height: 0px; transition: height 0.2s var(--rud-ease-out); }
      `);

      function ensurePortal() {
        let p = document.getElementById('rud-portal');
        if (!p) {
          p = document.createElement('div');
          p.id = 'rud-portal';
          document.documentElement.appendChild(p);
          p.className = localStorage.getItem('rud-theme') || 'rud-dark';
        }
        return p;
      }

      function createButton() {
        const btn = document.createElement('button');
        btn.id = 'rud-download-btn';
        btn.type = 'button';
        btn.innerHTML = `
          <div class="rud-btn-fill"></div>
          <span class="rud-btn-text">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3v11m0 0l4-4m-4 4L8 10M5 21h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            <span class="rud-btn-label">Download</span>
          </span>`;
        return btn;
      }

      function setButtonProgress(btn, done, total, scanning) {
        const label = btn.querySelector('.rud-btn-label');
        const fill = btn.querySelector('.rud-btn-fill');
        if (scanning) {
          btn.disabled = true;
          const pct = total ? Math.max(1, Math.round((done / total) * 100)) : 1;
          label.textContent = `Scanning ${done}/${total}`;
          fill.style.width = `${pct}%`;
        } else {
          btn.disabled = false;
          label.textContent = 'Download';
          fill.style.width = '0%';
        }
      }

      function getCommentsEl() {
        return document.querySelector('.media-page-comments-container, #video-comments');
      }

      function ensureSpacerBeforeComments() {
        const comments = getCommentsEl();
        if (!comments || !comments.parentElement) return null;
        let spacer = document.getElementById('rud-comments-spacer');
        if (!spacer) {
          spacer = document.createElement('div');
          spacer.id = 'rud-comments-spacer';
          comments.parentElement.insertBefore(spacer, comments);
        }
        return spacer;
      }

      function createMenu(btn) {
        const portal = ensurePortal();
        let menu = portal.querySelector('.rud-panel[data-for="' + btn.id + '"]');
        if (!menu) {
          menu = document.createElement('div');
          menu.className = 'rud-panel';
          menu.setAttribute('data-for', btn.id);
          menu.innerHTML = `
            <div class="rud-header">
              <div class="rud-status"><span class="muted">Ready.</span></div>
              <div class="rud-header-controls">
                <button class="rud-icon-btn rud-theme-toggle" type="button" data-rud-tooltip="Toggle Theme">
                  <svg class="rud-theme-sun" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  <svg class="rud-theme-moon" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="display:none;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                </button>
                <button class="rud-icon-btn rud-close-btn" type="button" data-rud-tooltip="Close">
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
            <div class="rud-body">
                <div class="rud-list"></div>
                <div class="rud-empty" style="display:none;"></div>
            </div>
            <div class="rud-footer" style="display:none;">
                <div class="rud-tar-note">
                    <strong>How to Play TAR files:</strong> 1. Download & Extract the .tar file (e.g., with 7-Zip). 2. Drag the <strong>.m3u8</strong> file into a player like VLC.
                </div>
            </div>`;
          portal.appendChild(menu);

          menu.querySelector('.rud-close-btn').addEventListener('click', () => close());
          menu.querySelector('.rud-theme-toggle').addEventListener('click', () => {
              const newTheme = portal.classList.contains('rud-dark') ? 'rud-light' : 'rud-dark';
              portal.className = newTheme;
              localStorage.setItem('rud-theme', newTheme);
              updateThemeIcons();
          });

          const updateThemeIcons = () => {
              const isDark = portal.classList.contains('rud-dark');
              menu.querySelector('.rud-theme-sun').style.display = isDark ? 'none' : 'block';
              menu.querySelector('.rud-theme-moon').style.display = isDark ? 'block' : 'none';
          };
          updateThemeIcons();
        }

        const refs = () => ({
          statusEl: menu.querySelector('.rud-status'),
          listEl: menu.querySelector('.rud-list'),
          bodyEl: menu.querySelector('.rud-body'),
          emptyEl: menu.querySelector('.rud-empty'),
          footerEl: menu.querySelector('.rud-footer')
        });

        async function positionMenu(){
          await raf(()=>{
            const rect = btn.getBoundingClientRect();
            const w = menu.offsetWidth;
            const gap = 8;
            let left = Math.round(rect.left + (rect.width / 2) - (w / 2));
            left = Math.max(16, Math.min(left, window.innerWidth - 16 - w));
            const top = Math.round(rect.bottom + gap);
            menu.style.left = `${left}px`;
            menu.style.top  = `${top}px`;
          });
        }

        async function adjustSpacer(){
          await raf(()=>{
            const spacer = ensureSpacerBeforeComments();
            if (!spacer) return;
            if (!menu.classList.contains('open')) {
              spacer.style.height = '0px';
              return;
            }
            spacer.style.height = `${menu.offsetHeight + 16}px`;
          });
        }

        function onDocClick(e) {
          if (!menu.classList.contains('open')) return;
          if (!menu.contains(e.target) && !btn.contains(e.target)) close();
        }
        function onEsc(e){ if (e.key === 'Escape') close(); }
        document.addEventListener('click', onDocClick, true);
        document.addEventListener('keydown', onEsc, { passive: true });

        const reposition = debounce(()=>{ if (menu.classList.contains('open')) { positionMenu(); adjustSpacer(); } }, 50);
        window.addEventListener('scroll', reposition, { passive: true });
        window.addEventListener('resize', reposition, { passive: true });

        async function open(){
          if (!menu.classList.contains('open')) {
            menu.classList.add('open');
            await positionMenu();
            await adjustSpacer();
          }
        }
        async function close(){
          if (menu.classList.contains('open')) {
            menu.classList.remove('open');
            await adjustSpacer();
          }
        }
        async function toggle(){
          const isOpen = menu.classList.contains('open');
          if (isOpen) {
            await close();
          } else {
            await open();
          }
        }

        async function setStatus(text) { refs().statusEl.textContent = text; await positionMenu(); await adjustSpacer(); }
        async function setStatusMuted(text) {
          refs().statusEl.innerHTML = `<span class="muted">${String(text).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))}</span>`;
          await positionMenu(); await adjustSpacer();
        }
        async function showEmpty(message) {
          const r = refs();
          r.listEl.innerHTML = '';
          r.listEl.style.display = 'none';
          r.emptyEl.style.display = 'block';
          r.emptyEl.innerHTML = `
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            ${message || 'No verified downloads were found.'}`;
          await positionMenu(); await adjustSpacer();
        }
        async function hideEmpty() { const r = refs(); r.listEl.style.display = 'flex'; r.emptyEl.style.display = 'none'; }
        async function maybeToggleFooter() {
          const r = refs();
          const hasTar = !!r.listEl.querySelector('[data-type="tar"]');
          r.footerEl.style.display = hasTar ? 'block' : 'none';
          await positionMenu(); await adjustSpacer();
        }

        const byKey = new Map();
        function addOrUpdate(label, type, url, size) {
          if (!label) return;
          const r = refs();
          const key = `${label.toLowerCase()}|${type}`;
          const title = getVideoTitle();
          const fname = filenameWithExt(title, label, url);

          if (byKey.has(key)) {
            const existing = byKey.get(key);
            if ((size||0) > (existing.size||0)) {
              existing.size = size;
              existing.url = url;
              const dlLink = existing.node.querySelector('.rud-dl-link');
              dlLink.href = url;
              dlLink.setAttribute('download', fname);
              const copyBtn = existing.node.querySelector('.rud-copy-btn');
              copyBtn.dataset.url = url;
              existing.node.querySelector('.rud-item-size').textContent = formatBytes(size);
            }
            return;
          }
          const item = document.createElement('div');
          item.className = 'rud-item';
          item.dataset.type = type;
          item.innerHTML = `
            <div class="rud-item-res">${label}</div>
            <div class="rud-item-badge">${type}</div>
            <div class="rud-item-size">${formatBytes(size)}</div>
            <div class="rud-item-actions">
              <button type="button" class="rud-copy-btn" data-url="${url}" data-rud-tooltip="Copy Link">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              </button>
              <a href="${url}" target="_blank" rel="noopener" download="${fname}" class="rud-dl-link" data-rud-tooltip="Download File">
                 <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              </a>
            </div>`;

          item.querySelector('.rud-copy-btn').addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const urlToCopy = btn.dataset.url;
            GM_setClipboard(urlToCopy);
            const originalTooltip = btn.dataset.rudTooltip;
            btn.dataset.rudTooltip = 'Copied!';
            setTimeout(() => { btn.dataset.rudTooltip = originalTooltip; }, 2000);
          });

          byKey.set(key, { node: item, url, size });

          const rank = tokenRank(extractTokenFromUrl(url) || '');
          let placed = false;
          for (const child of r.listEl.children) {
            const childAnchor = child.querySelector('.rud-dl-link');
            const childRank = tokenRank(extractTokenFromUrl(childAnchor?.href) || '');
            if (rank > childRank) { r.listEl.insertBefore(item, child); placed = true; break; }
          }
          if (!placed) r.listEl.appendChild(item);
          queueMicrotask(()=>{ maybeToggleFooter(); });
        }

        return {
          open, close, toggle,
          setStatus, setStatusMuted,
          clearLists: async ()=>{ const r=refs(); byKey.clear(); r.listEl.innerHTML=''; await hideEmpty(); await maybeToggleFooter(); },
          addOrUpdate, showEmpty, hideEmpty,
          haveAny: ()=> byKey.size > 0,
          ensureVisible: async ()=> { if (!menu.classList.contains('open')) await open(); },
          positionMenu, adjustSpacer
        };
      }

      // ---------------- Collection ----------------
      async function collectAllLinksVerbose() {
        findMediaInDom();
        const ticks = Math.max(1, Math.floor(COLLECTION_GRACE_MS / COLLECTION_TICK_MS));
        for (let i = 1; i <= ticks; i++) { await sleep(COLLECTION_TICK_MS); findMediaInDom(); }
        const embedLinks = await harvestUrlsFromEmbedAll();
        return Array.from(new Set([...findMediaInDom(), ...embedLinks]));
      }

      function deriveParts(allLinks) {
        const tar = allLinks.find(u=>/\.tar(\?|$)/i.test(u));
        const mp4 = allLinks.find(u=>/\.mp4(\?|$)/i.test(u));
        let parts = null;
        if (tar) parts = parseFromTarUrl(tar);
        if (!parts && mp4) parts = parseFromMp4Url(mp4);
        if (!parts) {
          const img = allLinks.find(u=>/^__IMG__https?:\/\//.test(u));
          if (img) {
            const parsed = parseFromImageUrl(img.replace(/^__IMG__/, ''));
            if (parsed) parts = parsed;
          }
        }
        return parts;
      }

      // ---------------- Probe (fast) ----------------
      async function probeTargetsFast(targets, menuApi, btn) {
        const probedUrls = new Set(), satisfied = new Set();
        let done = 0, okCount = 0;
        const total = targets.length;
        await menuApi.setStatus(`Scanning 0/${total}`);
        setButtonProgress(btn, 0, total, true);

        let lastStatusTick = 0;
        async function updateStatus() {
          const now = Date.now();
          if (now - lastStatusTick > 80) {
            lastStatusTick = now;
            await menuApi.setStatus(`Scanning ${done}/${total} candidates...`);
            setButtonProgress(btn, done, total, true);
          }
        }

        const queue = targets.slice();

        async function worker() {
          while (true) {
            const t = queue.shift();
            if (!t) break;
            const tok = (t.labelToken || extractTokenFromUrl(t.url) || '').toLowerCase();
            const label = tokenToLabel(tok) || 'detected';
            const keyQT = `${tok}|${t.type}`;
            if (satisfied.has(keyQT) || probedUrls.has(t.url)) {
              done++; await updateStatus(); continue;
            }
            probedUrls.add(t.url);
            let pr = await probeUrl(t.url);
            if (!pr.ok && t.origin === 'generated' && t.caseVariant) {
              const swapped = t.caseVariant === 'lower'
                ? t.url.replace(/\.([a-z])([a-z]{2})(\.)/i, (_, a, b, dot)=> `.${a.toUpperCase()}${b}${dot}`)
                : t.url.replace(/\.([A-Z])([a-z]{2})(\.)/, (_, a, b, dot)=> `.${a.toLowerCase()}${b}${dot}`);
              if (swapped !== t.url && !probedUrls.has(swapped)) {
                probedUrls.add(swapped);
                const pr2 = await probeUrl(swapped);
                if (pr2.ok) { t.url = swapped; pr = pr2; }
              }
            }
            done++;
            if (pr.ok) { okCount++; menuApi.addOrUpdate(label, t.type, t.url, pr.size); satisfied.add(keyQT); }
            await updateStatus();
            await sleep(0);
          }
        }

        const workers = Array.from({ length: Math.min(PROBE_CONCURRENCY, total) }, worker);
        await Promise.all(workers);
        return okCount;
      }

      // ---------------- Main click ----------------
      async function onDownloadClick(btn) {
        const menuApi = createMenu(btn);
        await menuApi.hideEmpty();
        await menuApi.ensureVisible();
        await menuApi.setStatusMuted('Preparing to scan...');
        await sleep(0);
        try {
          setButtonProgress(btn, 0, 0, true);
          const all = await collectAllLinksVerbose();
          await menuApi.setStatus(`Collected ${all.length} potential link(s)`);

          const parts = deriveParts(all);
          if (parts) await menuApi.setStatusMuted('Base video identified, generating candidates...');
          else await menuApi.setStatusMuted('No base found, probing collected links...');

          const directRaw = all.filter(u => /\/video\/.+\.(?:mp4|tar)\b/i.test(u));
          const direct = [];
          const seenDirect = new Set();
          for (const u of directRaw) {
            if (seenDirect.has(u)) continue;
            seenDirect.add(u);
            const tok = extractTokenFromUrl(u);
            if ((tok||'').toLowerCase() !== 'faa') direct.push({ url: u, type: typeFromUrl(u), labelToken: (tok||'').toLowerCase(), origin: 'direct', pri: (hostScore(u)===2?0:4) });
          }

          let generated = parts ? generateCandidates(parts).map(c => ({...c, labelToken: (c.labelToken||'').toLowerCase()})) : [];

          const rawTargets = [...direct, ...generated];
          rawTargets.sort((a,b)=> a.pri-b.pri || tokenRank(b.labelToken)-tokenRank(a.labelToken) || (hostScore(b.url)-hostScore(a.url)));
          const targets = [];
          const seen = new Set();
          for (const t of rawTargets) {
            if (t && t.url && !seen.has(t.url)) { seen.add(t.url); targets.push(t); }
          }

          await menuApi.clearLists();

          if (!targets.length) {
            setButtonProgress(btn, 0, 0, false);
            await menuApi.showEmpty('No candidates to probe.<br>Try playing or seeking the video, then click Download again.');
            return;
          }

          const ok = await probeTargetsFast(targets, menuApi, btn);
          if (!ok) {
            await menuApi.showEmpty('No verified downloads were found.');
          } else {
            await menuApi.setStatus(`Found ${ok} unique download option(s)`);
          }

          setButtonProgress(btn, 0, 0, false);
          await menuApi.ensureVisible();
        } catch (e) {
          console.error("Rumble Downloader Error:", e);
          await menuApi.showEmpty(`An unexpected error occurred:<br>${e && (e.message || e)}`);
          setButtonProgress(btn, 0, 0, false);
        }
      }

      // ---------------- Mount button ----------------
      function mountButton() {
        if (!isVideoPage() || document.getElementById('rud-download-btn')) return;
        for (const sel of ACTION_BAR_SELECTORS) {
          const container = $(sel);
          if (container) {
            const btn = createButton();
            btn.addEventListener('click', (ev)=>{
              ev.stopPropagation();
              const menuApi = createMenu(btn);
              if (menuApi.haveAny() && !btn.disabled) {
                menuApi.toggle();
              } else {
                onDownloadClick(btn);
              }
            }, { passive: true });
            const wrap = document.createElement('span');
            wrap.className = 'rud-inline-wrap';
            container.prepend(wrap);
            wrap.appendChild(btn);
            return;
          }
        }
      }

      const routeObs = new MutationObserver(debounce(()=>{ mountButton(); }, 200));
      routeObs.observe(document.documentElement, { childList: true, subtree: true });
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButton, { passive: true });
      else mountButton();

      window.addEventListener('error', (ev)=>{
        const menu = document.querySelector('#rud-portal .rud-panel');
        if (menu) {
          const statusEl = menu.querySelector('.rud-status');
          if (statusEl) statusEl.textContent = `Page Error: ${ev.message || ev.error || 'unknown'}`;
        }
      }, { passive: true });

    })();


    // ——————————————————————————————————————————————————————————————————————————
    // 8b. INJECT SETTINGS GEAR INTO HEADER
    // ——————————————————————————————————————————————————————————————————————————
    function injectControls() {
        const header = document.querySelector('.header-user-actions, div[data-js="media_channel_container"]');
        if (!header || document.getElementById('res-settings-button')) return;

        const btn = document.createElement('button');
        btn.id = 'res-settings-button';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c0 .66.39 1.26 1 1.51a1.65 1.65 0 001.51 0H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
        `;

        btn.addEventListener('click', () => {
            document.body.classList.toggle('res-panel-open');
        });

        header.appendChild(btn);
    }

    // ——————————————————————————————————————————————————————————————————————————
    // 9. INITIALIZATION
    // ——————————————————————————————————————————————————————————————————————————
    async function init() {
        // --- Phase 1: Pre-DOM Ready ---
        // These can run immediately at document-start.
        appState.settings = await settingsManager.load();
        $('html').attr('data-res-theme', appState.settings.panelTheme);
        if (!localStorage.getItem('rud-theme')) {
             localStorage.setItem('rud-theme', 'rud-dark');
        }
        features.forEach(f => Object.keys(f).forEach(key => { if(typeof f[key] === 'function') f[key] = f[key].bind(f); }));
        applyAllCssFeatures();

        // --- Phase 2: DOM Ready ---
        // Wait for the document to be ready before trying to access or modify it.
        $(() => {
            dataEngine.init();

            // Initialize all features now that the DOM is available.
            const pageType = location.pathname === '/' ? 'home' : (location.pathname.startsWith('/v') ? 'video' : (location.pathname.startsWith('/c/') ? 'profile' : 'other'));
            features.forEach(feature => {
                const appliesToPage = !feature.page || feature.page === 'all' || feature.page === pageType;
                if (appliesToPage && appState.settings[feature.id] && feature.init) {
                    try {
                        feature.init();
                    } catch (error) { console.error(`[Rumble Suite] Error initializing feature "${feature.name}":`, error); }
                }
            });

            // Initialize RUD integration logic
            integrateRUD();

            // Sync theme and inject UI controls
            const siteThemeFeature = features.find(f => f.id === 'siteTheme');
            siteThemeFeature.sync();
            injectPanelStyles();
            buildSettingsPanel();
            attachUIEventListeners();
            injectControls();
        });
    }

    init();

})();
