// ==UserScript==
// @name         Rumble Enhancement Suite
// @namespace    https://github.com/SysAdminDoc/RumbleEnhancementSuite
// @version      11.5-modular
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
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-core.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-styles.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-features.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-ui.js
// @require      https://raw.githubusercontent.com/SysAdminDoc/RumbleEnhancementSuite/refs/heads/main/src/res-downloader.js
// @run-at       document-start
// ==/UserScript==

/* globals $, appState, settingsManager, features, styleManager, dataEngine, applyAllCssFeatures, integrateRUD, injectPanelStyles, buildSettingsPanel, attachUIEventListeners, injectControls */

(function() {
    'use strict';

    // ——————————————————————————————————————————————————————————————————————————
    // INITIALIZATION
    // ——————————————————————————————————————————————————————————————————————————
    async function init() {
        // --- Phase 1: Pre-DOM Ready ---
        appState.settings = await settingsManager.load();
        $('html').attr('data-res-theme', appState.settings.panelTheme);
        if (!localStorage.getItem('rud-theme')) {
             localStorage.setItem('rud-theme', 'rud-dark');
        }
        features.forEach(f => Object.keys(f).forEach(key => { if(typeof f[key] === 'function') f[key] = f[key].bind(f); }));
        applyAllCssFeatures();

        // --- Phase 2: DOM Ready ---
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