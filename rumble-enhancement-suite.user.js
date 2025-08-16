// ==UserScript==
// @name         Rumble Enhancement Suite
// @namespace    https://github.com/SysAdminDoc/RumbleEnhancementSuite
// @version      11.6-modular
// @description  A premium suite of tools to enhance Rumble.com, featuring a downloader, privacy controls, live chat enhancements, a professional UI, and layout controls.
// @author       Matthew Parker
// @match        https://rumble.com/*
// @exclude      https://rumble.com/user/*
// @icon         https://rumble.com/i/favicon-v4.png
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @connect      *
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-core.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-styles.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-features.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-ui.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-downloader.js
// @updateURL    https://github.com/SysAdminDoc/RumbleEnhancementSuite/raw/refs/heads/main/rumble-enhancement-suite.user.js
// @downloadURL  https://github.com/SysAdminDoc/RumbleEnhancementSuite/raw/refs/heads/main/rumble-enhancement-suite.user.js
// @run-at       document-start
// ==/UserScript==

/* globals $, RES_CORE, defineStyles, defineFeatures, defineUI */

(function() {
    'use strict';

    // ——————————————————————————————————————————————————————————————————————————
    // INITIALIZATION
    // ——————————————————————————————————————————————————————————————————————————
    async function init() {
        // --- Phase 1: Pre-DOM Ready ---
        // Load settings into the core state object
        RES_CORE.appState.settings = await RES_CORE.settingsManager.load();
        $('html').attr('data-res-theme', RES_CORE.appState.settings.panelTheme);
        if (!localStorage.getItem('rud-theme')) {
             localStorage.setItem('rud-theme', 'rud-dark');
        }

        // Define modules by passing core dependencies
        const styles = defineStyles(RES_CORE);
        const features = defineFeatures(RES_CORE);

        // IMPORTANT: Attach features to the core object so other modules can access it
        RES_CORE.features = features;

        const ui = defineUI(RES_CORE);

        // Bind 'this' context for all feature methods
        features.forEach(f => Object.keys(f).forEach(key => { if(typeof f[key] === 'function') f[key] = f[key].bind(f); }));

        RES_CORE.applyAllCssFeatures(features);

        // --- Phase 2: DOM Ready ---
        $(() => {
            RES_CORE.dataEngine.init();

            // Initialize all features
            const pageType = location.pathname === '/' ? 'home' : (location.pathname.startsWith('/v') ? 'video' : (location.pathname.startsWith('/c/') ? 'profile' : 'other'));
            features.forEach(feature => {
                const appliesToPage = !feature.page || feature.page === 'all' || feature.page === pageType;
                if (appliesToPage && RES_CORE.appState.settings[feature.id] && feature.init) {
                    try {
                        feature.init();
                    } catch (error) { console.error(`[Rumble Suite] Error initializing feature "${feature.name}":`, error); }
                }
            });

            RES_CORE.integrateRUD();

            // Sync theme and inject UI controls
            const siteThemeFeature = features.find(f => f.id === 'siteTheme');
            siteThemeFeature.sync();

            styles.injectPanelStyles();
            ui.buildSettingsPanel();
            ui.attachUIEventListeners();
            ui.injectControls();
        });
    }

    init();

})();