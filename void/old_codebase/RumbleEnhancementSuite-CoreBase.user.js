// ==UserScript==
// @name         Rumble Enhancement Suite
// @namespace    https://github.com/SysAdminDoc/RumbleEnhancementSuite
// @version      10.2
// @description  A premium suite of tools to enhance Rumble.com, featuring a data-driven, 100% reliable video downloader, privacy controls, advanced stats, live chat enhancements, a professional UI, and layout controls.
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
// @grant        unsafeWindow
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @run-at       document-start
// ==/UserScript==

/* globals $, GM_setValue, GM_getValue, GM_addStyle, GM_xmlHttpRequest, unsafeWindow, Hls */

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

            // Downloader
            enableDownloader: true,
            downloadAudio: true,
            downloadSubtitles: true,
            downloadThumbnail: true,
            addStreamUrlButton: true,

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
        cog: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.46 12.98c.04-.31.04-.63.04-.95s0-.64-.04-.95l2.08-1.63c.18-.14.24-.4.12-.62l-1.83-3.14c-.12-.22-.36-.29-.58-.22l-2.39.92c-.55-.4-1.15-.72-1.79-.94L14.7 2.71c-.02-.26-.23-.46-.49-.46H9.79c-.26 0-.47.2-.49.46l-.34 2.61c-.64.22-1.24.54-1.79.94l-2.39-.92c-.22-.07-.46 0-.58.22L2.37 8.73c-.12.22-.06.48.12.62l2.08 1.63c-.04.31-.04.63-.04.95s0 .64.04.95l-2.08 1.63c-.18-.14-.24-.4-.12-.62l1.83 3.14c.12.22.36.29.58.22l2.39-.92c.55-.4 1.15-.72,1.79-.94l.34 2.61c.02.26.23.46.49.46h4.42c.26 0 .47-.2.49-.46l.34-2.61c.64-.22 1.24-.54-1.79-.94l2.39.92c.22-.07.46 0 .58.22l1.83-3.14c.12-.22-.06-.48-.12-.62l-2.08-1.63z"/><circle cx="12" cy="12" r="3.5"/></svg>`,
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

        // --- DOWNLOADER ---
        {
            id: 'enableDownloader', name: 'Enable Data-Driven Downloader', description: 'Adds a powerful download menu below the video player, with 100% accurate links for all formats.', newCategory: 'Downloader', isManagement: true,
            init() {
                if (!location.pathname.startsWith('/v')) return;
                this.insertDownloadButton();
                if (appState.videoData) {
                    this.populateLinksContainer();
                } else {
                    $(document).on('res:videoDataLoaded.downloader', () => this.populateLinksContainer());
                }
            },
            destroy() {
                $('#res-download-button-wrapper').remove();
                $(document).off('res:videoDataLoaded.downloader');
            },
            insertDownloadButton() {
                const buttonHTML = `
                    <div id="res-download-button-wrapper">
                        <div class="video-action-button-wrapper">
                            <button id="res-download-button" class="round-button media-by-actions-button" title="Show Download Options">
                                ${ICONS.download}<span>Download</span>
                            </button>
                        </div>
                        <div id="res-download-links-container"></div>
                    </div>`;
                waitForElement('div[data-js="video_action_button_visible_location"][data-type="share"]', ($shareBtn) => {
                    if (!$('#res-download-button-wrapper').length) {
                        $shareBtn.after(buttonHTML);
                        $('#res-download-button').on('click', (e) => {
                            e.stopPropagation();
                            $('#res-download-links-container').slideToggle(200);
                            $('#res-download-button').toggleClass('active');
                        });
                    }
                });
            },
            populateLinksContainer() {
                const $container = $('#res-download-links-container');
                if (!appState.videoData) {
                    $container.html(`<div class="res-downloader-message error">Video data not found.</div>`);
                    return;
                }
                $container.empty();
                const { ua, u, cc, i: thumbnailUrl } = appState.videoData;
                let linksHTML = '';

                // Video Links
                if (ua && ua.tar) {
                    const sortedQualities = Object.keys(ua.tar).sort((a, b) => parseInt(b) - parseInt(a));
                    sortedQualities.forEach(quality => {
                        const video = ua.tar[quality];
                        const label = `${quality}p MP4`;
                        const size = video.meta.size ? formatBytes(video.meta.size) : '';
                        const bitrate = video.meta.bitrate ? `(${Math.round(video.meta.bitrate / 1000)} kbps)` : '';
                        linksHTML += this.createButton(video.url, label, 'video', `.mp4`, `${size} ${bitrate}`);
                    });
                }

                // Audio Link
                if (appState.settings.downloadAudio && ua && ua.audio) {
                    const audioKey = Object.keys(ua.audio)[0];
                    const audio = ua.audio[audioKey];
                    const size = audio.meta.size ? formatBytes(audio.meta.size) : '';
                    const bitrate = audio.meta.bitrate ? `(${audio.meta.bitrate} kbps)` : '';
                    linksHTML += this.createButton(audio.url, `Audio Only`, 'audio', `.aac`, `${size} ${bitrate}`);
                }

                // Subtitles Link
                if (appState.settings.downloadSubtitles && cc) {
                    const ccKey = Object.keys(cc)[0];
                    if (ccKey) {
                        const subtitle = cc[ccKey];
                        linksHTML += this.createButton(subtitle.path, subtitle.language, 'subtitles', `.vtt`);
                    }
                }

                // Thumbnail Link
                if (appState.settings.downloadThumbnail && thumbnailUrl) {
                    linksHTML += this.createButton(thumbnailUrl, 'Thumbnail', 'image', '.jpg');
                }

                // HLS Stream Link
                if (appState.settings.addStreamUrlButton && u && u.hls) {
                    linksHTML += this.createCopyButton(u.hls.url, 'Copy Stream URL', 'stream', 'Copy HLS playlist URL for use in external players like VLC.');
                }

                if (linksHTML) {
                    $container.html(`<div class="res-download-links-grid">${linksHTML}</div>`);
                } else {
                    $container.html(`<div class="res-downloader-message error">No downloadable links found in video data.</div>`);
                }
            },
            createButton(url, label, type, ext, details = '') {
                const icons = { video: ICONS.download, audio: ICONS.mic, subtitles: ICONS.closedCaptions, image: ICONS.image };
                return `<button class="res-inline-download-button" data-url="${url}" data-label="${label}" data-ext="${ext}" title="Download ${label} ${details}">
                    ${icons[type] || ICONS.download}
                    <span class="res-dl-label">${label}</span>
                    <span class="res-dl-details">${details}</span>
                </button>`;
            },
            createCopyButton(url, label, type, title) {
                return `<button class="res-inline-download-button" data-copy-url="${url}" title="${title}">
                    ${ICONS.copy}
                    <span class="res-dl-label">${label}</span>
                    <span class="res-dl-details">For VLC/MPV</span>
                </button>`;
            },
            triggerBlobDownload(url, qualityLabel, extension, button) { const $button = $(button); const originalHTML = $button.html(); $button.prop('disabled', true).html(`${ICONS.spinner}<span>Downloading...</span>`); GM.xmlHttpRequest({ method: "GET", url: url, responseType: "blob", headers: { "Referer": "https://rumble.com/" }, onload: (response) => { if (response.status >= 200 && response.status < 400) { const videoTitle = appState.videoData?.title?.replace(/[^a-z0-9_.-]/gi, '_').slice(0, 50) || 'rumble_video'; const filename = `${videoTitle}-${qualityLabel.replace(/\s/g, '_')}${extension}`; const blobUrl = URL.createObjectURL(response.response); const a = document.createElement('a'); a.style.display = 'none'; a.href = blobUrl; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(blobUrl); createToast(`Download started for ${qualityLabel}`); } else { createToast(`Download Failed: Server sent status ${response.status}`, 'error'); } $button.prop('disabled', false).html(originalHTML); }, onerror: () => { createToast(`Download Failed: Network error for ${qualityLabel}`, 'error'); $button.prop('disabled', false).html(originalHTML); }, ontimeout: () => { createToast(`Download Failed: Request timed out`, 'error'); $button.prop('disabled', false).html(originalHTML); } }); },
            copyToClipboard(text, button) {
                const $button = $(button);
                const originalHTML = $button.html();
                navigator.clipboard.writeText(text).then(() => {
                    createToast('Stream URL copied to clipboard!');
                    $button.html(`${ICONS.check}<span>Copied!</span>`);
                    setTimeout(() => $button.html(originalHTML), 2000);
                }).catch(err => {
                    createToast('Failed to copy URL.', 'error');
                    console.error('Clipboard copy failed:', err);
                });
            }
        },
        { id: 'downloadAudio', name: 'Show "Audio Only" Button', description: 'Adds a button to download just the audio track.', newCategory: 'Downloader' },
        { id: 'downloadSubtitles', name: 'Show "Subtitles" Button', description: 'Adds a button to download the closed captions file (.vtt).', newCategory: 'Downloader' },
        { id: 'downloadThumbnail', name: 'Show "Thumbnail" Button', description: 'Adds a button to download the video thumbnail image.', newCategory: 'Downloader' },
        { id: 'addStreamUrlButton', name: 'Show "Copy Stream URL" Button', description: 'Adds a button to copy the HLS stream URL for external players.', newCategory: 'Downloader' },

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
        const categoryOrder = ['Downloader', 'Main Page Layout', 'Video Page Layout', 'Player Controls', 'Video Buttons', 'Video Comments', 'Live Chat', 'Navigation', 'Theme & Appearance'];
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
            else if (cat === 'Downloader') {
                 panesHTML += `<div class="res-setting-row res-toggle-all-row" data-category-id="${catId}"><div class="res-setting-row-text"><label for="res-toggle-all-${catId}">Toggle All Options</label><small>Enable or disable all sub-settings in this category.</small></div><label class="res-switch"><input type="checkbox" id="res-toggle-all-${catId}" class="res-toggle-all-cb"><span class="res-slider"></span></label></div>`;
                 categoryFeatures.forEach(f => panesHTML += buildSettingRow(f));
            }
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
                     <span class="res-version" title="Keyboard Shortcut: Ctrl+Alt+R">v10.2</span>
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
            const $featureToggles = $pane.find('.res-feature-cb').not('#res-toggle-enableDownloader'); // Exclude main toggle
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
                if ($('body').hasClass('res-panel-open')) { $('body').removeClass('res-panel-open'); }
                else if ($('#res-download-links-container').is(':visible')) { $('#res-download-links-container').slideUp(200); $('#res-download-button').removeClass('active'); }
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

            // Special handling for downloader sub-options
            if (feature.newCategory === 'Downloader' && !feature.isManagement) {
                features.find(f => f.id === 'enableDownloader')?.populateLinksContainer();
            }

            if (!feature.isManagement) createToast(`${feature.name} ${isEnabled ? 'Enabled' : 'Disabled'}`);
            updateAllToggleStates();
        });
        $doc.on('change', '.res-toggle-all-cb', function() {
            const isEnabled = $(this).is(':checked');
            const catId = $(this).closest('.res-toggle-all-row').data('category-id');
            $(`#res-pane-${catId}`).find('.res-feature-cb').not(':disabled, #res-toggle-enableDownloader').each(function() { if ($(this).is(':checked') !== isEnabled) $(this).prop('checked', isEnabled).trigger('change'); });
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

        // Downloader
        const downloader = features.find(f => f.id === 'enableDownloader');
        $doc.on('click', '.res-inline-download-button[data-url]', function() { downloader?.triggerBlobDownload($(this).data('url'), $(this).data('label'), $(this).data('ext'), this); });
        $doc.on('click', '.res-inline-download-button[data-copy-url]', function() { downloader?.copyToClipboard($(this).data('copy-url'), this); });

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
#res-settings-button { background: transparent; border: none; cursor: pointer; padding: 6px; margin: 0 8px 0 4px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background-color 0.2s ease, transform 0.2s ease; }
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

/* === Downloader UI === */
#res-download-button-wrapper { grid-column: 1 / -1; }
#res-download-button { gap: 8px; }
#res-download-button svg { width: 18px; height: 18px; transition: all .2s; }
#res-download-button.active { background-color: var(--res-bg-hover); }
#res-download-links-container { display: none; padding: 16px; margin-top: 8px; background-color: var(--res-bg-secondary); border-radius: 12px; border: 1px solid var(--res-border-color); }
.res-download-links-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.res-inline-download-button { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 10px; padding: 10px; font-size: 14px; font-weight: 500; border-radius: 8px; border: 1px solid var(--res-border-color); cursor: pointer; transition: all .2s; background-color: var(--res-bg-tertiary); color: var(--res-text-primary); text-align: left; }
.res-inline-download-button:hover:not(:disabled) { background-color: var(--res-accent); color: white; border-color: var(--res-accent); transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
.res-inline-download-button svg { width: 20px; height: 20px; grid-row: 1 / 3; }
.res-inline-download-button .res-dl-label { font-weight: 600; }
.res-inline-download-button .res-dl-details { font-size: 12px; color: var(--res-text-secondary); }
.res-inline-download-button:hover .res-dl-details { color: rgba(255,255,255,0.8); }
.res-inline-download-button:disabled { cursor: not-allowed; opacity: 0.6; }
.res-inline-download-button:disabled:hover { transform: none; box-shadow: none; }
.res-inline-download-button .res-spinner-svg { width: 14px; height: 14px; }
.res-downloader-message { text-align: center; color: var(--res-text-secondary); padding: 10px; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; }
.res-downloader-message.error { color: var(--res-error); }

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
`);
    }

    // ——————————————————————————————————————————————————————————————————————————
    // 7. INITIALIZATION
    // ——————————————————————————————————————————————————————————————————————————
    async function init() {
        // --- Phase 1: Pre-DOM Ready ---
        // These can run immediately at document-start.
        appState.settings = await settingsManager.load();
        $('html').attr('data-res-theme', appState.settings.panelTheme);
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
