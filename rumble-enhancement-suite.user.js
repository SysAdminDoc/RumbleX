// ==UserScript==
// @name         Rumble Enhancement Suite
// @namespace    https://github.com/SysAdminDoc/RumbleEnhancementSuite
// @version      11.4-modular
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
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-styles.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-features.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-ui.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-downloader.js
// @run-at       document-start
// ==/UserScript==

/* globals $, GM_setValue, GM_getValue, GM_addStyle, GM_xmlHttpRequest, unsafeWindow, Hls, GM_setClipboard, injectPanelStyles, features, buildSettingsPanel, attachUIEventListeners, injectControls */

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
    // 7. RUD DOWNLOADER INTEGRATION LOGIC
    // ——————————————————————————————————————————————————————————————————————————
    function integrateRUD() {
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

        const rudListObserver = new MutationObserver((mutations) => {
            const list = document.querySelector('.rud-panel .rud-list');
            if (!list || mutations.length === 0 || list.hasAttribute('data-res-processed')) return;

            const items = Array.from(list.querySelectorAll('.rud-item'));
            if (items.length === 0) return;

            list.setAttribute('data-res-processed', 'true');

            items.forEach(item => {
                const sizeEl = item.querySelector('.rud-item-size');
                const sizeText = sizeEl ? sizeEl.textContent : '';
                const sizeInMB = parseSizeToMB(sizeText);
                if (sizeInMB !== null && sizeInMB < 50) {
                    item.classList.add('rud-hide');
                }
            });

            const mp4Items = items.filter(item => item.dataset.type === 'mp4' && !item.classList.contains('rud-hide'));
            const tarItems = items.filter(item => item.dataset.type === 'tar' && !item.classList.contains('rud-hide'));

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

            setTimeout(() => list.removeAttribute('data-res-processed'), 500);
        });

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

        const portal = document.getElementById('rud-portal');
        if (portal) {
            rudPanelObserver.observe(portal, { childList: true });
        }
    }

    // ——————————————————————————————————————————————————————————————————————————
    // 9. INITIALIZATION
    // ——————————————————————————————————————————————————————————————————————————
    async function init() {
        appState.settings = await settingsManager.load();
        $('html').attr('data-res-theme', appState.settings.panelTheme);
        if (!localStorage.getItem('rud-theme')) {
             localStorage.setItem('rud-theme', 'rud-dark');
        }
        features.forEach(f => Object.keys(f).forEach(key => { if(typeof f[key] === 'function') f[key] = f[key].bind(f); }));
        applyAllCssFeatures();

        $(() => {
            dataEngine.init();

            const pageType = location.pathname === '/' ? 'home' : (location.pathname.startsWith('/v') ? 'video' : (location.pathname.startsWith('/c/') ? 'profile' : 'other'));
            features.forEach(feature => {
                const appliesToPage = !feature.page || feature.page === 'all' || feature.page === pageType;
                if (appliesToPage && appState.settings[feature.id] && feature.init) {
                    try {
                        feature.init();
                    } catch (error) { console.error(`[Rumble Suite] Error initializing feature "${feature.name}":`, error); }
                }
            });

            integrateRUD();

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