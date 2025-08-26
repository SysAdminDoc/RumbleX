// This is the content for res-features.js

function defineFeatures(core) {
    // Destructure core components for easier use within this module
    const { styleManager, appState, settingsManager, waitForElement, ICONS, createToast, populateBlockedUsersList } = core;
    /* globals Hls */ // Hls is still a global from the page context

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
            page: 'video', // Only applies to video pages
            init() {
                if (!location.pathname.startsWith('/v')) return; // Ensure it only runs on video pages
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
            id: 'collapseNavSidebar',
            name: 'Collapse Navigation Sidebar',
            description: 'Collapses the sidebar. It slides into view when you move your cursor to the left edge of the page.',
            newCategory: 'Navigation',
            init() {
                const css = `
                    /* Hide original nav before it's wrapped to prevent flash on load */
                    body.res-collapse-nav-active nav.navs:not(#res-nav-container nav.navs) {
                        visibility: hidden !important;
                    }
                    body.res-collapse-nav-active .main-menu-toggle {
                        display: none !important;
                    }
                    body.res-collapse-nav-active main.nav--transition {
                        margin-left: 0 !important;
                    }
                    #res-nav-container {
                        position: fixed;
                        top: 0;
                        left: 0;
                        height: 100vh;
                        width: 276px; /* Nav width (256px) + Trigger area (20px) */
                        z-index: 10000;
                        transform: translateX(-256px); /* Hide the nav part, leaving trigger area */
                        transition: transform 0.3s ease-in-out;
                    }
                    #res-nav-container:hover {
                        transform: translateX(0);
                    }
                    body.res-collapse-nav-active nav.navs {
                        position: absolute !important; /* Positioned inside the container */
                        top: 0 !important;
                        left: 0 !important;
                        width: 256px !important;
                        height: 100vh !important;
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        transform: none !important; /* No separate transform needed */
                        box-shadow: none !important; /* Removed dropshadow */
                    }
                `;
                styleManager.inject(this.id, css);
                $('body').addClass('res-collapse-nav-active');

                // Use waitForElement to ensure nav exists before wrapping it, making it work on video pages.
                waitForElement('nav.navs', ($nav) => {
                    // Double-check if it's already wrapped to avoid issues with multiple triggers
                    if ($nav.parent().is('#res-nav-container')) {
                        return;
                    }
                    $nav.wrap('<div id="res-nav-container"></div>');

                    // Force Rumble's menu state to be "closed" so it doesn't block page content
                    if (window.mainMenu && typeof window.mainMenu.close === 'function') {
                        window.mainMenu.close();
                    }
                    $('body').removeClass('main-menu-visible');
                });
            },
            destroy() {
                styleManager.remove(this.id);
                $('body').removeClass('res-collapse-nav-active');
                const $nav = $('nav.navs');
                if ($nav.length && $nav.parent().is('#res-nav-container')) {
                    $nav.unwrap(); // Remove the container
                }
            }
        },
        {
            id: 'themeCollapsedSidebar',
            name: 'Theme Collapsed Sidebar',
            description: 'Applies a custom, compact, icon-centric theme to the collapsed navigation sidebar. Requires "Collapse Navigation Sidebar" to be enabled.',
            newCategory: 'Theme & Appearance',
            init() {
                // Read the CSS content from the resource defined in the header
                const css = GM_getResourceText('compactSidebarTheme');
                
                // Inject the CSS if it was loaded successfully
                if (css) {
                    styleManager.inject(this.id, css);
                }
            },
            destroy() {
                styleManager.remove(this.id);
            }
        },
        {
            id: 'hideNavSidebarCompletely',
            name: 'Hide Navigation Sidebar Completely',
            description: 'Completely hides the left navigation sidebar and its toggle icon in the header.',
            newCategory: 'Navigation',
            css: '.main-menu-toggle, nav.navs, #res-nav-container { display: none !important; } main.nav--transition { margin-left: 0 !important; }'
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
        // --- MAIN PAGE LAYOUT ---
        { id: 'widenSearchBar', name: 'Widen Search Bar', description: 'Expands the search bar to fill available header space.', newCategory: 'Main Page Layout', subCategory: 'Main Page (Global/All Pages)', css: `.header .header-div { display: flex; align-items: center; gap: 1rem; padding-right: 1.5rem; box-sizing: border-box; } .header-search { flex-grow: 1; max-width: none !important; } .header-search .header-search-field { width: 100% !important; }` },
        { id: 'hideUploadIcon', name: 'Hide Upload Icon', description: 'Hides the upload/stream live icon in the header.', newCategory: 'Main Page Layout', subCategory: 'Main Page (Global/All Pages)', css: 'button.header-upload { display: none !important; }' },
        { id: 'hideHeaderAd', name: 'Hide "Go Ad-Free" Button', description: 'Hides the "Go Ad-Free" button in the header.', newCategory: 'Main Page Layout', subCategory: 'Main Page (Global/All Pages)', css: `span.hidden.lg\\:flex:has(button[hx-get*="premium-value-prop"]) { display: none !important; }` },
        { id: 'hideFooter', name: 'Hide Footer', description: 'Removes the footer at the bottom of the page.', newCategory: 'Main Page Layout', subCategory: 'Main Page (Global/All Pages)', css: 'footer.page__footer.foot.nav--transition { display: none !important; }' },
        {
            id: 'hidePremiumVideos', name: 'Hide Premium Videos', description: 'Hides premium-only videos from subscription and channel feeds.', newCategory: 'Main Page Layout', subCategory: 'Main Page (Global/All Pages)',
            init() {
                const hideRule = () => document.querySelectorAll('div.videostream:has(a[href="/premium"])').forEach(el => el.style.display = 'none');
                this.observer = new MutationObserver(hideRule);
                waitForElement('main', ($main) => this.observer.observe($main[0], { childList: true, subtree: true }));
                hideRule();
            },
            destroy() { if (this.observer) this.observer.disconnect(); document.querySelectorAll('div.videostream:has(a[href="/premium"])').forEach(el => el.style.display = ''); }
        },
        { id: 'hideProfileBacksplash', name: 'Hide Profile Backsplash', description: 'Hides the large header image on channel profiles.', newCategory: 'Main Page Layout', subCategory: 'User Profile Page', page: 'profile', css: `div.channel-header--backsplash { display: none !important; } html.main-menu-mode-permanent { margin-top: 30px !important; }` },
        { id: 'hideFeaturedBanner', name: 'Hide Featured Banner', description: 'Hides the top category banner on the home page.', newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'div.homepage-featured { display: none !important; }', page: 'home' },
        { id: 'hideEditorPicks', name: "Hide Editor Picks", description: "Hides the main 'Editor Picks' content row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: '#section-editor-picks { display: none !important; }', page: 'home' },
        { id: 'hideTopLiveCategories', name: "Hide 'Top Live' Row", description: "Hides the 'Top Live Categories' row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-top-live { display: none !important; }', page: 'home' },
        { id: 'hidePremiumRow', name: "Hide Premium Row", description: "Hides the Rumble Premium row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-premium-videos { display: none !important; }', page: 'home' },
        { id: 'hideHomepageAd', name: "Hide Ad Section", description: "Hides the ad container on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section.homepage-section:has(.js-rac-desktop-container) { display: none !important; }', page: 'home' },
        { id: 'hideForYouRow', name: "Hide 'For You' Row", description: "Hides 'For You' recommendations on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-personal-recommendations { display: none !important; }', page: 'home' },
        { id: 'hideGamingRow', name: "Hide Gaming Row", description: "Hides the Gaming row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-gaming { display: none !important; }', page: 'home' },
        { id: 'hideFinanceRow', name: "Hide Finance & Crypto Row", description: "Hides the Finance & Crypto row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-finance { display: none !important; }', page: 'home' },
        { id: 'hideLiveRow', name: "Hide Live Row", description: "Hides the Live row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-live-videos { display: none !important; }', page: 'home' },
        { id: 'hideFeaturedPlaylistsRow', name: "Hide Featured Playlists", description: "Hides the Featured Playlists row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-featured-playlists { display: none !important; }', page: 'home' },
        { id: 'hideSportsRow', name: "Hide Sports Row", description: "Hides the Sports row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-sports { display: none !important; }', page: 'home' },
        { id: 'hideViralRow', name: "Hide Viral Row", description: "Hides the Viral row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-viral { display: none !important; }', page: 'home' },
        { id: 'hidePodcastsRow', name: "Hide Podcasts Row", description: "Hides the Podcasts row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-podcasts { display: none !important; }', page: 'home' },
        { id: 'hideLeaderboardRow', name: "Hide Leaderboard Row", description: "Hides the Leaderboard row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-leaderboard { display: none !important; }', page: 'home' },
        { id: 'hideVlogsRow', name: "Hide Vlogs Row", description: "Hides the Vlogs row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-vlogs { display: none !important; }', page: 'home' },
        { id: 'hideNewsRow', name: "Hide News Row", description: "Hides the News row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-news { display: none !important; }', page: 'home' },
        { id: 'hideScienceRow', name: "Hide Health & Science Row", description: "Hides the Health & Science row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-science { display: none !important; }', page: 'home' },
        { id: 'hideMusicRow', name: "Hide Music Row", description: "Hides the Music row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-music { display: none !important; }', page: 'home' },
        { id: 'hideEntertainmentRow', name: "Hide Entertainment Row", description: "Hides the Entertainment row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-entertainment { display: none !important; }', page: 'home' },
        { id: 'hideCookingRow', name: "Hide Cooking Row", description: "Hides the Cooking row on the home page.", newCategory: 'Main Page Layout', subCategory: 'Home Page', css: 'section#section-cooking { display: none !important; }', page: 'home' },
        
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
            _standardCss: `body.res-full-width-player aside.media-page-related-media-desktop-sidebar, body.res-full-width-player #player-spacer { display: none !important; } body.res-full-width-player main.nav--transition { margin-left: 0 !important; } body.res-full-width-player .main-and-sidebar { max-width: 100% !important; padding: 0 !important; margin: 0 !important; } body.res-full-width-player .main-content, body.res-full-width-player .media-container { width: 100% !important; max-width: 100% !important; } body.res-full-width-player .video-player, body.res-full-width-player [id^='vid_v'] { width: 100vw !important; height: calc(100vw * 9 / 16) !important; max-height: 100vh; } body.res-full-width-player #videoPlayer video { object-fit: contain !important; }`,
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
              
              /* --- ADDED USER CSS --- */
              section.chat.relative {
                width: 347px;
                margin-left: 11px;
                height: 847px;
              }

              button.media-page-chat-container-toggle-btn {
                display: none;
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
                    this._liveObserver = new MutationObserver(setChatWidthTVar);
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
            _uiInterval: null,
            _lastUrl: '',
            _clickCount: 0,
            _maxUiClicksPerUrl: 3,
            init() {
                if (!location.pathname.startsWith('/v')) return;
                if (appState.hlsInstance) {
                    this.setBestQuality(appState.hlsInstance);
                } else {
                    $(document).on('res:hlsInstanceFound.autoQuality', () => this.setBestQuality(appState.hlsInstance));
                }
                this.startUiFallback();
            },
            destroy() {
                $(document).off('res:hlsInstanceFound.autoQuality');
                if (appState.hlsInstance && this.onManifestParsed) {
                    appState.hlsInstance.off(Hls.Events.MANIFEST_PARSED, this.onManifestParsed);
                }
                this.stopUiFallback();
            },
            setBestQuality(hls) {
                if (!hls) return;
                this.onManifestParsed = () => {
                    if (hls.levels && hls.levels.length > 1) {
                        console.log('[RumbleX] HLS Manifest Parsed, setting best quality.');
                        hls.nextLevel = hls.levels.length - 1;
                    }
                };
                hls.on(Hls.Events.MANIFEST_PARSED, this.onManifestParsed);
                if (hls.levels && hls.levels.length > 1) {
                    this.onManifestParsed();
                }
            },
            startUiFallback() {
                if (this._uiInterval) return;
                this._lastUrl = location.href;
                this._clickCount = 0;

                this._uiInterval = setInterval(() => {
                    const url = location.href;
                    if (url !== this._lastUrl) {
                        this._lastUrl = url;
                        this._clickCount = 0;
                    }
                    if (this._clickCount < this._maxUiClicksPerUrl) {
                        const acted = this.tryOpenSettingsAndChooseBest();
                        if (acted) {
                            this._clickCount++;
                        }
                    }
                }, 500);
            },
            stopUiFallback() {
                if (this._uiInterval) {
                    clearInterval(this._uiInterval);
                    this._uiInterval = null;
                }
            },
            tryOpenSettingsAndChooseBest() {
                try {
                    const overlayItem = document.getElementsByClassName('touched_overlay_item')[0];
                    if (!overlayItem) return false;
                    const playback = overlayItem.nextElementSibling?.lastChild?.lastChild;
                    if (!playback) return false;
                    const playback_click = playback.firstChild;
                    if (playback_click) playback_click.click();
                    const quality = playback.lastChild?.lastChild?.lastChild;
                    if (quality) {
                        quality.click();
                        return true;
                    }
                } catch (e) { /* Silently ignore */ }
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
        { id: 'autoLoadComments', name: 'Auto Load More Comments', description: 'Automatically loads more comments as you scroll down.', newCategory: 'Video Comments',
            init() { if (!location.pathname.startsWith('/v')) return; const isElementInViewport = (el) => { if (!el) return false; const rect = el.getBoundingClientRect(); return rect.top <= (window.innerHeight || document.documentElement.clientHeight); }; const scrollHandler = () => { const $button = $('li.show-more-comments > button'); if ($button.length && isElementInViewport($button[0])) $button.click(); }; $(window).on('scroll.autoLoadComments', scrollHandler); },
            destroy() { $(window).off('scroll.autoLoadComments'); }
        },
        { id: 'moveReplyButton', name: 'Move Reply Button', description: 'Moves the reply button next to the like/dislike buttons.', newCategory: 'Video Comments', css: `.comment-actions-wrapper { display: flex; align-items: center; } .comment-actions-wrapper .comment-actions { margin-left: 12px; }`, page: 'video' },
        { id: 'hideCommentReportLink', name: 'Hide Comment Report Link', description: 'Hides the "report" link on user comments.', newCategory: 'Video Comments', css: '.comments-action-report.comments-action { display: none !important; }', page: 'video' },
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
            async unblockUser(username) {
                appState.commentBlockedUsers = appState.commentBlockedUsers.filter(u => u !== username);
                await settingsManager.saveBlockedUsers(appState.commentBlockedUsers, 'comment');
                this.applyBlockedUsers();
                $(`li.comment-item[data-username="${username}"]`).show();
                createToast(`User "${username}" has been unblocked.`);
                
                // Immediately remove from settings panel UI
                const $blockedItem = $(`.res-blocked-users-container[data-blocker-type="comment"] .res-blocked-user-item[data-username="${username.toLowerCase()}"]`);
                if ($blockedItem.length > 0) {
                    $blockedItem.remove();
                    const $list = $('.res-blocked-users-container[data-blocker-type="comment"] .res-blocked-users-list');
                    if ($list.children().length === 0) {
                        $list.append('<div class="res-list-empty">No users blocked.</div>');
                        $('.res-blocked-users-container[data-blocker-type="comment"] .res-unblock-all-btn').hide();
                    }
                }
            },
            async unblockAllUsers() { appState.commentBlockedUsers = []; await settingsManager.saveBlockedUsers([], 'comment'); this.applyBlockedUsers(); createToast('All users have been unblocked.', 'success', 2000); populateBlockedUsersList('comment'); }
        },

        // --- LIVE CHAT ---
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
            async unblockUser(username) {
                appState.liveChatBlockedUsers = appState.liveChatBlockedUsers.filter(u => u !== username);
                await settingsManager.saveBlockedUsers(appState.liveChatBlockedUsers, 'livechat');
                this.applyBlockedUsers();
                createToast(`Live chat user "${username}" has been unblocked.`);

                // Immediately remove from settings panel UI
                const $blockedItem = $(`.res-blocked-users-container[data-blocker-type="livechat"] .res-blocked-user-item[data-username="${username.toLowerCase()}"]`);
                if ($blockedItem.length > 0) {
                    $blockedItem.remove();
                    const $list = $('.res-blocked-users-container[data-blocker-type="livechat"] .res-blocked-users-list');
                    if ($list.children().length === 0) {
                        $list.append('<div class="res-list-empty">No users blocked.</div>');
                        $('.res-blocked-users-container[data-blocker-type="livechat"] .res-unblock-all-btn').hide();
                    }
                }
            },
            async unblockAllUsers() { appState.liveChatBlockedUsers = []; await settingsManager.saveBlockedUsers([], 'livechat'); this.applyBlockedUsers(); createToast('All live chat users have been unblocked.', 'success', 2000); populateBlockedUsersList('livechat'); }
        },
    ];

    // The function must return the features array
    return features;
}
