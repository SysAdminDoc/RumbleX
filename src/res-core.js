// This is the content for res-core.js
/* globals $, GM_setValue, GM_getValue, GM_addStyle, Hls, features */

// ——————————————————————————————————————————————————————————————————————————
// 1. SETTINGS & STATE MANAGER
// ——————————————————————————————————————————————————————————————————————————
const settingsManager = {
    defaults: {
        // Theme & Appearance
        panelTheme: 'dark',
        siteTheme: 'system',
        // ... (all other default settings)
        autoHideHeader: true,
        autoHideNavSidebar: true,
        logoLinksToSubscriptions: true,
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
        adaptiveLiveLayout: true,
        hideRelatedOnLive: true,
        fullWidthPlayer: false,
        hideRelatedSidebar: true,
        widenContent: true,
        hideVideoDescription: false,
        hidePausedVideoAds: false,
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
        hideLikeDislikeButton: false,
        hideShareButton: false,
        hideRepostButton: false,
        hideEmbedButton: false,
        hideSaveButton: false,
        hideCommentButton: false,
        hideReportButton: false,
        hidePremiumJoinButtons: false,
        commentBlocking: true,
        autoLoadComments: false,
        moveReplyButton: true,
        hideCommentReportLink: false,
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
    settings: {}, // Will be populated by init()
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

const ICONS = {
    cog: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M12 2v2"/><path d="M12 22v-2"/><path d="m17 20.66-1-1.73"/><path d="M11 10.27 7 3.34"/><path d="m20.66 17-1.73-1"/><path d="m3.34 7 1.73 1"/><path d="M14 12h8"/><path d="M2 12h2"/><path d="m20.66 7-1.73 1"/><path d="m3.34 17 1.73-1"/><path d="m17 3.34-1 1.73"/><path d="M11 13.73 7 20.66"/></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
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
                // When the RUD portal is added to the page...
                if (node.nodeType === 1 && node.matches('#rud-portal')) {
                    // ...start observing IT for when the .rud-list is added.
                    rudListObserver.observe(node, { childList: true, subtree: true });
                    // We can stop observing the body now.
                    rudPanelObserver.disconnect();
                }
            }
        }
    });

    // Start observing the main document body for the #rud-portal element to be added.
    rudPanelObserver.observe(document.body, { childList: true });
}