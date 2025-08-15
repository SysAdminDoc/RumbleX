// This is the content for res-ui.js

function defineUI(core) {
    const { appState, settingsManager, ICONS, createToast, populateBlockedUsersList, applyAllCssFeatures } = core;

    function buildSettingsPanel() {
        const categoryOrder = ['Main Page Layout', 'Video Page Layout', 'Player Controls', 'Video Buttons', 'Video Comments', 'Live Chat', 'Navigation', 'Theme & Appearance'];
        const featuresByCategory = categoryOrder.reduce((acc, cat) => ({...acc, [cat]: []}), {});
        core.features.forEach(f => { if (f.newCategory && featuresByCategory[f.newCategory]) featuresByCategory[f.newCategory].push(f); });

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
                     <span class="res-version" title="Keyboard Shortcut: Ctrl+Alt+R">v11.5</span>
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

    function injectControls() {
        const gearButtonHTML = `<button id="res-settings-button" title="Rumble Enhancement Suite Settings (Ctrl+Alt+R)">${ICONS.cog}</button>`;
        const addClickListener = () => {
            $('#res-settings-button').off('click').on('click', () => {
                $('body').addClass('res-panel-open');
                populateBlockedUsersList('comment');
                populateBlockedUsersList('livechat');
                core.features.find(f => f.id === 'siteTheme').sync();
            });
        };
        setInterval(() => {
            if ($('#res-settings-button').length > 0) return;
            const $target = $('.header-user-actions .header-user');
            if ($target.length > 0) {
                $target.before(gearButtonHTML);
                addClickListener();
            }
        }, 500);
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

        $doc.on('click', '#res-close-settings, #res-panel-overlay', () => $('body').removeClass('res-panel-open'));
        $doc.on('click', '.res-tab-btn', function() { $('.res-tab-btn, .res-settings-pane').removeClass('active'); $(this).addClass('active'); $(`#res-pane-${$(this).data('tab')}`).addClass('active'); });
        $doc.on('keydown', (e) => {
            if (e.key === "Escape" && $('body').hasClass('res-panel-open')) {
                $('body').removeClass('res-panel-open');
            }
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r') {
                 e.preventDefault(); e.stopPropagation();
                 $('body').toggleClass('res-panel-open');
                 if ($('body').hasClass('res-panel-open')) { populateBlockedUsersList('comment'); populateBlockedUsersList('livechat'); core.features.find(f => f.id === 'siteTheme').sync(); }
            }
        });

        $doc.on('change', '.res-feature-cb', async function() {
            const featureId = $(this).closest('.res-setting-row, .res-management-row').data('feature-id');
            const isEnabled = $(this).is(':checked');
            appState.settings[featureId] = isEnabled;
            await settingsManager.save(appState.settings);
            const feature = core.features.find(f => f.id === featureId);

            if (feature.css) {
                applyAllCssFeatures(core.features);
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

        $doc.on('change', '#res-panel-theme-selector', async function() {
            appState.settings.panelTheme = $(this).val();
            await settingsManager.save(appState.settings);
            $('html').attr('data-res-theme', appState.settings.panelTheme);
        });

        $doc.on('change', '.res-theme-button', async function() {
            const newTheme = $(this).data('theme-value');
            appState.settings.siteTheme = newTheme;
            await settingsManager.save(appState.settings);
            core.features.find(f => f.id === 'siteTheme').apply(newTheme);
        });

        const commentBlocker = core.features.find(f => f.id === 'commentBlocking');
        $doc.on('click', '.res-block-user-btn', function() { commentBlocker?.blockUser($(this).data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="comment"] .res-unblock-btn', function() { commentBlocker?.unblockUser($(this).data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="comment"] .res-unblock-all-btn', function() { if (confirm('Are you sure you want to unblock all comment users?')) commentBlocker?.unblockAllUsers(); });

        const liveChatBlocker = core.features.find(f => f.id === 'liveChatBlocking');
        $doc.on('click', '.res-live-chat-block-btn', function(e) { e.stopPropagation(); liveChatBlocker?.blockUser($(this).closest('.chat-history--row').data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="livechat"] .res-unblock-btn', function() { liveChatBlocker?.unblockUser($(this).data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="livechat"] .res-unblock-all-btn', function() { if (confirm('Are you sure you want to unblock all live chat users?')) liveChatBlocker?.unblockAllUsers(); });
    }
    
    return {
        buildSettingsPanel,
        attachUIEventListeners,
        injectControls
    };
}