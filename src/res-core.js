// This is the content for res-core.js
/* globals $, GM_setValue, GM_getValue, GM_addStyle, Hls */

const RES_CORE = {
    // ——————————————————————————————————————————————————————————————————————————
    // 1. SETTINGS & STATE MANAGER
    // ——————————————————————————————————————————————————————————————————————————
    settingsManager: {
        defaults: {
            panelTheme: 'dark', siteTheme: 'system', autoHideHeader: true, autoHideNavSidebar: true,
            logoLinksToSubscriptions: true, widenSearchBar: true, hideUploadIcon: false, hideHeaderAd: false,
            hideProfileBacksplash: false, hidePremiumVideos: true, hideFeaturedBanner: false, hideEditorPicks: false,
            hideTopLiveCategories: false, hidePremiumRow: false, hideHomepageAd: false, hideForYouRow: false,
            hideGamingRow: false, hideFinanceRow: false, hideLiveRow: false, hideFeaturedPlaylistsRow: false,
            hideSportsRow: false, hideViralRow: false, hidePodcastsRow: false, hideLeaderboardRow: false,
            hideVlogsRow: false, hideNewsRow: false, hideScienceRow: false, hideMusicRow: false,
            hideEntertainmentRow: false, hideCookingRow: false, hideFooter: false, adaptiveLiveLayout: true,
            hideRelatedOnLive: true, fullWidthPlayer: false, hideRelatedSidebar: true, widenContent: true,
            hideVideoDescription: false, hidePausedVideoAds: false, autoBestQuality: true, autoLike: false,
            hideRewindButton: false, hideFastForwardButton: false, hideCCButton: false, hideAutoplayButton: false,
            hideTheaterButton: false, hidePipButton: false, hideFullscreenButton: false, hidePlayerRumbleLogo: false,
            hidePlayerGradient: false, hideLikeDislikeButton: false, hideShareButton: false, hideRepostButton: false,
            hideEmbedButton: false, hideSaveButton: false, hideCommentButton: false, hideReportButton: false,
            hidePremiumJoinButtons: false, commentBlocking: true, autoLoadComments: false, moveReplyButton: true,
            hideCommentReportLink: false, liveChatBlocking: true, cleanLiveChat: false,
        },
        async load() {
            let savedSettings = await GM_getValue('rumbleSuiteSettings_v9', {});
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
    },

    appState: {
        videoData: null, commentBlockedUsers: [], liveChatBlockedUsers: [], hlsInstance: null, settings: {},
    },

    // ——————————————————————————————————————————————————————————————————————————
    // 2. DYNAMIC STYLE & UTILITY ENGINE
    // ——————————————————————————————————————————————————————————————————————————
    styleManager: {
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
    },

    applyAllCssFeatures(features) {
        let cssRules = [];
        const pageType = location.pathname === '/' ? 'home' : (location.pathname.startsWith('/v') ? 'video' : (location.pathname.startsWith('/c/') ? 'profile' : 'other'));

        features.forEach(feature => {
            if (feature.css && this.appState.settings[feature.id]) {
                const appliesToPage = !feature.page || feature.page === 'all' || feature.page === pageType;
                if (appliesToPage) {
                    cssRules.push(feature.css);
                }
            }
        });
        this.styleManager.inject('master-css-rules', cssRules.join('\n'));
    },

    waitForElement(selector, callback, timeout = 10000) {
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
    },

    ICONS: {
        cog: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2"/><path d="M12 22v-2"/><path d="m17 20.66-1-1.73"/><path d="M11 10.27 7 3.34"/><path d="m20.66 17-1.73-1"/><path d="m3.34 7 1.73 1"/><path d="M14 12h8"/><path d="M2 12h2"/><path d="m20.66 7-1.73 1"/><path d="m3.34 17 1.73-1"/><path d="m17 3.34-1 1.73"/><path d="M11 13.73 7 20.66"/></svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        system: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
        dark: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
        light: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
        block: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
    },

    createToast(message, type = 'success', duration = 3000) {
        $('.res-toast').remove();
        const toast = $(`<div class="res-toast ${type}"></div>`).text(message);
        $('body').append(toast);
        setTimeout(() => toast.addClass('show'), 10);
        setTimeout(() => { toast.removeClass('show'); setTimeout(() => toast.remove(), 500); }, duration);
    },

    async populateBlockedUsersList(type) {
        const users = await this.settingsManager.getBlockedUsers(type);
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
    },

    // ——————————————————————————————————————————————————————————————————————————
    // 3. CORE DATA ENGINE
    // ——————————————————————————————————————————————————————————————————————————
    dataEngine: {
        init() {
            if (!location.pathname.startsWith('/v')) return;
            this.findAndParseVideoData();
            this.findHlsInstance();
        },
        findAndParseVideoData() {
            if (RES_CORE.appState.videoData) return;
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
                            RES_CORE.appState.videoData = JSON.parse(jsonString);
                            console.log('[RumbleX] Video data successfully parsed:', RES_CORE.appState.videoData);
                            $(document).trigger('res:videoDataLoaded');
                            return;
                        } catch (e) { console.error("[RumbleX] Failed to parse video data JSON.", e); }
                    }
                }
            }
        },
        findHlsInstance() {
            if (RES_CORE.appState.hlsInstance) return;
            const videoElement = document.querySelector('#videoPlayer video');
            if (videoElement && videoElement.hls) {
                RES_CORE.appState.hlsInstance = videoElement.hls;
                console.log('[RumbleX] HLS.js instance found:', RES_CORE.appState.hlsInstance);
                $(document).trigger('res:hlsInstanceFound');
                return;
            }
            const observer = new MutationObserver(() => {
                if (videoElement && videoElement.hls) {
                    RES_CORE.appState.hlsInstance = videoElement.hls;
                    console.log('[RumbleX] HLS.js instance found via observer:', RES_CORE.appState.hlsInstance);
                    $(document).trigger('res:hlsInstanceFound');
                    observer.disconnect();
                }
            });
            RES_CORE.waitForElement('.media-player-container', ($container) => {
                observer.observe($container[0], { childList: true, subtree: true });
            });
        }
    },

    // ——————————————————————————————————————————————————————————————————————————
    // 7. RUD DOWNLOADER INTEGRATION LOGIC
    // ——————————————————————————————————————————————————————————————————————————
    integrateRUD() {
        // ... (The integrateRUD function remains exactly the same as the last version)
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
                    if (node.nodeType === 1 && node.matches('#rud-portal')) {
                        const list = node.querySelector('.rud-list');
                        if (list) {
                           rudListObserver.observe(list, { childList: true, subtree: true });
                        }
                        rudPanelObserver.disconnect();
                    }
                }
            }
        });
        rudPanelObserver.observe(document.body, { childList: true });
    }
};