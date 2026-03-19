// RumbleX v1.7.0 - Background Service Worker
'use strict';

// Badge update when extension icon clicked
chrome.runtime.onInstalled.addListener(() => {
    console.log('[RumbleX] Extension installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getSettings') {
        chrome.storage.local.get('rx_settings', (data) => {
            sendResponse(data.rx_settings || {});
        });
        return true;
    }

    if (message.action === 'saveSettings') {
        chrome.storage.local.set({ rx_settings: message.data }, () => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (message.action === 'checkUpdate') {
        const currentVersion = chrome.runtime.getManifest().version;
        fetch('https://api.github.com/repos/SysAdminDoc/RumbleX/releases/latest', {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => {
            const latest = (data.tag_name || '').replace(/^v/, '');
            sendResponse({ current: currentVersion, latest, url: data.html_url || '', hasUpdate: latest && latest !== currentVersion });
        })
        .catch(err => {
            sendResponse({ error: String(err), current: currentVersion });
        });
        return true;
    }

    if (message.action === 'openSettings') {
        // Send message to the active Rumble tab to open the settings modal
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'openSettingsModal' }, () => {
                    sendResponse({ success: true });
                });
            }
        });
        return true;
    }

    if (message.action === 'download') {
        // Use chrome.downloads API for clean file saving
        const { url, filename } = message.data;
        chrome.downloads.download({
            url,
            filename,
            saveAs: true,
        }, (downloadId) => {
            sendResponse({ downloadId });
        });
        return true;
    }
});
