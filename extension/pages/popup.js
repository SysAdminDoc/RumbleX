// RumbleX v1.7.0 - Popup Script
'use strict';

const FEATURES = [
    { id: 'adNuker', label: 'Ad Nuker' },
    { id: 'theaterSplit', label: 'Theater Split' },
    { id: 'feedCleanup', label: 'Feed Cleanup' },
    { id: 'hideReposts', label: 'Hide Reposts' },
    { id: 'wideLayout', label: 'Wide Layout' },
    { id: 'hidePremium', label: 'Hide Premium' },
    { id: 'videoDownload', label: 'Video Download' },
    { id: 'darkEnhance', label: 'Dark Theme' },
    { id: 'logoToFeed', label: 'Logo to Feed' },
    { id: 'speedController', label: 'Speed Control' },
    { id: 'scrollVolume', label: 'Scroll Volume' },
    { id: 'autoMaxQuality', label: 'Auto Max Quality' },
    { id: 'watchProgress', label: 'Watch Progress' },
    { id: 'channelBlocker', label: 'Channel Blocker' },
    { id: 'keyboardNav', label: 'Keyboard Nav' },
    { id: 'autoTheater', label: 'Auto Theater' },
    { id: 'liveChatEnhance', label: 'Chat Enhance' },
    { id: 'videoTimestamps', label: 'Timestamps' },
    { id: 'screenshotBtn', label: 'Screenshot' },
    { id: 'watchHistory', label: 'Watch History' },
    { id: 'autoplayBlock', label: 'Autoplay Block' },
    { id: 'searchHistory', label: 'Search History' },
    { id: 'miniPlayer', label: 'Mini Player' },
    { id: 'videoStats', label: 'Video Stats' },
    { id: 'loopControl', label: 'Loop Control' },
    { id: 'quickBookmark', label: 'Bookmarks' },
    { id: 'commentNav', label: 'Comment Nav' },
    { id: 'rantHighlight', label: 'Rant Highlight' },
    { id: 'relatedFilter', label: 'Related Filter' },
    { id: 'exactCounts', label: 'Exact Counts' },
    { id: 'shareTimestamp', label: 'Share@Time' },
    { id: 'shortsFilter', label: 'Shorts Filter' },
    { id: 'chatAutoScroll', label: 'Chat Scroll' },
    { id: 'autoExpand', label: 'Auto Expand' },
    { id: 'notifEnhance', label: 'Notif Enhance' },
    { id: 'quickSave', label: 'Quick Save' },
];

const DEFAULTS = {
    adNuker: true,
    theaterSplit: true,
    feedCleanup: true,
    darkEnhance: true,
    hideReposts: true,
    wideLayout: true,
    videoDownload: true,
    splitRatio: 75,
    hiddenCategories: [],
    logoToFeed: true,
    hidePremium: true,
    speedController: true,
    scrollVolume: true,
    autoMaxQuality: true,
    watchProgress: true,
    channelBlocker: true,
    keyboardNav: true,
    autoTheater: false,
    liveChatEnhance: true,
    videoTimestamps: true,
    screenshotBtn: true,
    watchHistory: true,
    autoplayBlock: true,
    searchHistory: true,
    miniPlayer: true,
    videoStats: true,
    loopControl: true,
    quickBookmark: true,
    commentNav: true,
    rantHighlight: true,
    relatedFilter: true,
    exactCounts: true,
    shareTimestamp: true,
    shortsFilter: true,
    chatAutoScroll: true,
    autoExpand: true,
    notifEnhance: true,
    quickSave: true,
    theme: 'catppuccin',
    playbackSpeed: 1.0,
    blockedChannels: [],
    bookmarks: [],
};

async function init() {
    const manifest = chrome.runtime.getManifest();
    const ver = `v${manifest.version}`;
    document.getElementById('version').textContent = ver;
    document.getElementById('footer-version').textContent = ver;

    const data = await chrome.storage.local.get('rx_settings');
    const settings = { ...DEFAULTS, ...(data.rx_settings || {}) };

    const container = document.getElementById('features');

    for (const feat of FEATURES) {
        const row = document.createElement('div');
        row.className = 'feat-row';

        const label = document.createElement('span');
        label.className = 'feat-label';
        label.textContent = feat.label;

        const toggle = document.createElement('label');
        toggle.className = 'toggle';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = settings[feat.id] ?? true;
        input.addEventListener('change', () => {
            settings[feat.id] = input.checked;
            chrome.storage.local.set({ rx_settings: settings });
        });

        const track = document.createElement('div');
        track.className = 'toggle-track';
        const thumb = document.createElement('div');
        thumb.className = 'toggle-thumb';

        toggle.appendChild(input);
        toggle.appendChild(track);
        toggle.appendChild(thumb);

        row.appendChild(label);
        row.appendChild(toggle);
        container.appendChild(row);
    }

    // Theme Picker
    const themeSection = document.createElement('div');
    themeSection.className = 'theme-section';
    const themeLabel = document.createElement('div');
    themeLabel.className = 'theme-label';
    themeLabel.textContent = 'Theme';
    themeSection.appendChild(themeLabel);

    const themeGrid = document.createElement('div');
    themeGrid.className = 'theme-grid';
    const themes = [
        { id: 'catppuccin', label: 'Catppuccin Mocha', color: '#89b4fa' },
        { id: 'youtube', label: 'YouTubify', color: '#ff0000' },
        { id: 'midnight', label: 'Midnight AMOLED', color: '#818cf8' },
        { id: 'rumbleGreen', label: 'Rumble Green', color: '#85c742' },
    ];
    for (const t of themes) {
        const chip = document.createElement('button');
        chip.className = 'theme-chip' + (settings.theme === t.id ? ' active' : '');
        chip.innerHTML = `<span class="theme-dot" style="background:${t.color}"></span>${t.label}`;
        chip.addEventListener('click', () => {
            settings.theme = t.id;
            chrome.storage.local.set({ rx_settings: settings });
            for (const c of themeGrid.querySelectorAll('.theme-chip')) c.classList.remove('active');
            chip.classList.add('active');
        });
        themeGrid.appendChild(chip);
    }
    themeSection.appendChild(themeGrid);
    container.appendChild(themeSection);

    // Settings gear - open modal on active Rumble tab
    document.getElementById('btn-settings').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openSettings' }, () => {
            window.close();
        });
    });

    // Update check
    const updateBtn = document.getElementById('btn-update');
    updateBtn.addEventListener('click', () => {
        if (updateBtn.classList.contains('has-update')) {
            // Already found update - open the release page
            const url = updateBtn.dataset.releaseUrl;
            if (url) chrome.tabs.create({ url });
            return;
        }
        updateBtn.classList.add('checking');
        updateBtn.dataset.tooltip = 'Checking...';
        chrome.runtime.sendMessage({ action: 'checkUpdate' }, (res) => {
            updateBtn.classList.remove('checking');
            if (res && res.error) {
                updateBtn.classList.add('error');
                updateBtn.dataset.tooltip = 'Check failed';
                setTimeout(() => {
                    updateBtn.classList.remove('error');
                    updateBtn.dataset.tooltip = 'Check for Updates';
                }, 3000);
                return;
            }
            if (res && res.hasUpdate) {
                updateBtn.classList.add('has-update');
                updateBtn.dataset.tooltip = `Update available: v${res.latest}`;
                updateBtn.dataset.releaseUrl = res.url;
            } else {
                updateBtn.dataset.tooltip = 'Up to date!';
                setTimeout(() => { updateBtn.dataset.tooltip = 'Check for Updates'; }, 3000);
            }
        });
    });
}

init();
