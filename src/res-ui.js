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

            if (cat === 'Theme & Appearance') {
                panesHTML += buildThemePane(categoryFeatures);
            } else {
                panesHTML += `<div class="res-setting-row res-toggle-all-row" data-category-id="${catId}"><div class="res-setting-row-text"><label for="res-toggle-all-${catId}">Toggle All</label><small>Enable or disable all settings in this category.</small></div><label class="res-switch"><input type="checkbox" id="res-toggle-all-${catId}" class="res-toggle-all-cb"><span class="res-slider"></span></label></div>`;
                
                if (cat === 'Main Page Layout') {
                    const subCategories = ['Main Page (Global/All Pages)', 'User Profile Page', 'Home Page'];
                    subCategories.forEach(subCat => {
                        panesHTML += `<h3 class="res-pane-subheader">${subCat}</h3>`;
                        categoryFeatures.filter(f => f.subCategory === subCat).forEach(f => panesHTML += buildSettingRow(f));
                    });
                } else if (cat === 'Video Comments' || cat === 'Live Chat') {
                    const blockerType = cat === 'Video Comments' ? 'comment' : 'livechat';
                    const managementFeature = categoryFeatures.find(f => f.isManagement);
                    const otherFeatures = categoryFeatures.filter(f => !f.isManagement);

                    if (blockerType === 'livechat') {
                         otherFeatures.sort((a,b) => a.id === 'cleanLiveChat' ? -1 : 1).forEach(f => panesHTML += buildSettingRow(f));
                    } else {
                         otherFeatures.forEach(f => panesHTML += buildSettingRow(f));
                    }
                   
                    if(managementFeature) panesHTML += buildSettingRow(managementFeature);
                    panesHTML += buildBlockerManagementUI(blockerType);

                } else {
                    categoryFeatures.forEach(f => panesHTML += buildSettingRow(f));
                }
            }
            panesHTML += `</div>`;
        });

        const panelHTML = `
            <div id="res-panel-overlay"></div>
            <div id="res-settings-panel" role="dialog" aria-modal="true" aria-labelledby="res-panel-title">
                <div class="res-settings-header">
                     <div class="res-header-title" id="res-panel-title">
                        <img src="https://rumble.com/i/favicon-v4.png" alt="RumbleX Logo">
                        <h2><span class="res-header-brand">RumbleX</span></h2>
                     </div>
                     <button id="res-close-settings" class="res-header-button" title="Close (Esc)">${ICONS.close}</button>
                </div>
                <div class="res-settings-body">
                    <div class="res-settings-tabs">${tabsHTML}</div>
                    <div class="res-settings-content">${panesHTML}</div>
                </div>
                <div class="res-settings-footer">
                    <div class="res-footer-left">
                        <a href="https://github.com/SysAdminDoc/RumbleX" target="_blank" class="res-github-link" title="View on GitHub">${ICONS.github}</a>
                        <span class="res-version" title="Keyboard Shortcut: Ctrl+Alt+R">v12.0</span>
                    </div>
                    <div class="res-footer-right">
                        <div class="res-button-group">
                            <button id="res-import-all-settings" class="res-button" title="Import all RumbleX settings from a file">${ICONS.upload} Import</button>
                            <button id="res-export-all-settings" class="res-button" title="Export all RumbleX settings to a file">${ICONS.download} Export</button>
                        </div>
                    </div>
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

    function buildBlockerManagementUI(type) {
        const title = type === 'comment' ? 'Comment Block List' : 'Live Chat Block List';
        return `
         <div class="res-blocked-users-container" data-blocker-type="${type}">
            <div class="res-blocked-users-list-header">
                <h3>${title}</h3>
                <input type="search" class="res-input res-blocked-list-search" placeholder="Search users...">
                <div class="res-button-group">
                    <button class="res-button res-import-list-btn" title="Import list from file">${ICONS.upload}</button>
                    <button class="res-button res-export-list-btn" title="Export list to file">${ICONS.download}</button>
                    <button class="res-button res-button-danger res-unblock-all-btn">Unblock All</button>
                </div>
            </div>
            <div class="res-blocked-users-list"></div>
         </div>`;
    }

    function buildThemePane(features) {
        const siteThemeFeature = features.find(f => f.id === 'siteTheme');
        return `
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
    }

    function injectControls() {
        const gearButtonHTML = `<button id="res-settings-button" title="RumbleX Settings (Ctrl+Alt+R)">${ICONS.cog}</button>`;
        const addClickListener = () => {
            $('#res-settings-button').off('click').on('click', () => {
                $('body').addClass('res-panel-open');
                core.populateBlockedUsersList('comment');
                core.populateBlockedUsersList('livechat');
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

    function handleFileImport(callback) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = readerEvent => {
                const content = readerEvent.target.result;
                callback(content);
            };
            reader.readAsText(file);
        };
        fileInput.click();
    }

    function handleFileExport(filename, content) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function attachUIEventListeners() {
        const $doc = $(document);
        let isHandlingMutex = false;

        $doc.on('click', '#res-close-settings, #res-panel-overlay', () => $('body').removeClass('res-panel-open'));
        $doc.on('click', '.res-tab-btn', function() { $('.res-tab-btn, .res-settings-pane').removeClass('active'); $(this).addClass('active'); $(`#res-pane-${$(this).data('tab')}`).addClass('active'); });
        $doc.on('keydown', (e) => {
            if (e.key === "Escape" && $('body').hasClass('res-panel-open')) {
                $('body').removeClass('res-panel-open');
            }
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'r') {
                 e.preventDefault(); e.stopPropagation();
                 $('body').toggleClass('res-panel-open');
                 if ($('body').hasClass('res-panel-open')) { core.populateBlockedUsersList('comment'); core.populateBlockedUsersList('livechat'); core.features.find(f => f.id === 'siteTheme').sync(); }
            }
        });

        $doc.on('change', '.res-feature-cb', async function() {
            if (isHandlingMutex) return;

            const $this = $(this);
            const featureId = $this.closest('[data-feature-id]').data('feature-id');
            const isEnabled = $this.is(':checked');
            
            const navSidebarMutex = ['collapseNavSidebar', 'hideNavSidebarCompletely'];
            if (isEnabled && navSidebarMutex.includes(featureId)) {
                isHandlingMutex = true;
                const otherFeatureId = navSidebarMutex.find(id => id !== featureId);
                const $otherCheckbox = $(`#res-toggle-${otherFeatureId}`);
                if ($otherCheckbox.is(':checked')) {
                    $otherCheckbox.prop('checked', false).triggerHandler('change');
                }
                isHandlingMutex = false;
            }

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

        $doc.on('change', '.res-toggle-all-cb', async function() {
            const $this = $(this);
            const isEnabled = $this.is(':checked');
            const catId = $this.closest('.res-toggle-all-row').data('category-id');
            const $pane = $(`#res-pane-${catId}`);

            isHandlingMutex = true;
            if (catId === 'Navigation') {
                if (isEnabled) {
                    $('#res-toggle-collapseNavSidebar').prop('checked', true).triggerHandler('change');
                    $('#res-toggle-hideNavSidebarCompletely').prop('checked', false).triggerHandler('change');
                    $pane.find('.res-feature-cb').not('#res-toggle-collapseNavSidebar, #res-toggle-hideNavSidebarCompletely').prop('checked', true).triggerHandler('change');
                } else {
                    $pane.find('.res-feature-cb').not(':disabled').prop('checked', false).triggerHandler('change');
                }
            } else {
                $pane.find('.res-feature-cb').not(':disabled').each(function() {
                    if ($(this).is(':checked') !== isEnabled) {
                        $(this).prop('checked', isEnabled).triggerHandler('change');
                    }
                });
            }
            isHandlingMutex = false;
            await settingsManager.save(appState.settings);
        });

        $doc.on('change', '.res-theme-button', async function() {
            const newTheme = $(this).data('theme-value');
            appState.settings.siteTheme = newTheme;
            await settingsManager.save(appState.settings);
            core.features.find(f => f.id === 'siteTheme').apply(newTheme);
        });

        // --- Blocker Management ---
        const commentBlocker = core.features.find(f => f.id === 'commentBlocking');
        $doc.on('click', '.res-block-user-btn', function() { commentBlocker?.blockUser($(this).data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="comment"] .res-unblock-btn', function() { commentBlocker?.unblockUser($(this).data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="comment"] .res-unblock-all-btn', function() { if (confirm('Are you sure you want to unblock all comment users?')) commentBlocker?.unblockAllUsers(); });

        const liveChatBlocker = core.features.find(f => f.id === 'liveChatBlocking');
        $doc.on('click', '.res-live-chat-block-btn', function(e) { e.stopPropagation(); liveChatBlocker?.blockUser($(this).closest('.chat-history--row').data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="livechat"] .res-unblock-btn', function() { liveChatBlocker?.unblockUser($(this).data('username')); });
        $doc.on('click', '.res-blocked-users-container[data-blocker-type="livechat"] .res-unblock-all-btn', function() { if (confirm('Are you sure you want to unblock all live chat users?')) liveChatBlocker?.unblockAllUsers(); });

        $doc.on('input', '.res-blocked-list-search', function() {
            const searchTerm = $(this).val().toLowerCase();
            const $container = $(this).closest('.res-blocked-users-container');
            $container.find('.res-blocked-user-item').each(function() {
                const username = $(this).data('username');
                $(this).toggle(username.includes(searchTerm));
            });
        });

        $doc.on('click', '.res-export-list-btn', async function() {
            const type = $(this).closest('.res-blocked-users-container').data('blocker-type');
            const users = await settingsManager.getBlockedUsers(type);
            handleFileExport(`rumblex_${type}_blocklist.json`, JSON.stringify(users, null, 2));
        });

        $doc.on('click', '.res-import-list-btn', function() {
            const type = $(this).closest('.res-blocked-users-container').data('blocker-type');
            handleFileImport(async (content) => {
                try {
                    const importedUsers = JSON.parse(content);
                    if (!Array.isArray(importedUsers)) throw new Error("Invalid format.");
                    const currentUsers = await settingsManager.getBlockedUsers(type);
                    const mergedUsers = [...new Set([...currentUsers, ...importedUsers])];
                    await settingsManager.saveBlockedUsers(mergedUsers, type);
                    if (type === 'comment') appState.commentBlockedUsers = mergedUsers;
                    if (type === 'livechat') appState.liveChatBlockedUsers = mergedUsers;
                    core.populateBlockedUsersList(type);
                    core.features.find(f => f.id === `${type}Blocking`).applyBlockedUsers();
                    createToast(`Imported ${importedUsers.length} users into ${type} block list.`, 'success');
                } catch (e) {
                    createToast(`Import failed: ${e.message}`, 'error');
                }
            });
        });

        // --- Global Settings Import/Export ---
        $doc.on('click', '#res-export-all-settings', async function() {
            const configString = await settingsManager.exportAllSettings();
            handleFileExport('rumblex_settings_backup.json', configString);
        });

        $doc.on('click', '#res-import-all-settings', function() {
            handleFileImport(async (content) => {
                const success = await settingsManager.importAllSettings(content);
                if (success) {
                    if (confirm("Settings imported successfully. The page will now reload to apply all changes. OK?")) {
                        location.reload();
                    }
                } else {
                    createToast('Import failed. The file may be corrupt or in an invalid format.', 'error');
                }
            });
        });
    }
    
    return {
        buildSettingsPanel,
        attachUIEventListeners,
        injectControls
    };
}
