// RumbleX platform adapter - browser extension runtime
'use strict';

(() => {
    const ext = globalThis.browser || globalThis.chrome;
    const manifest = ext.runtime.getManifest();

    function callAsync(target, method, ...args) {
        const fn = target?.[method];
        if (typeof fn !== 'function') return Promise.reject(new Error(`Extension API is unavailable: ${method}`));
        // Firefox/browser and modern Chromium expose promises. Firefox MV2's
        // chrome namespace is callback-only, so normalize both without
        // issuing the operation twice.
        if (globalThis.browser && ext === globalThis.browser) {
            try { return Promise.resolve(fn.apply(target, args)); } catch (error) { return Promise.reject(error); }
        }
        return new Promise((resolve, reject) => {
            const callback = (value) => {
                const error = ext.runtime?.lastError;
                if (error) reject(new Error(error.message || String(error)));
                else resolve(value);
            };
            try {
                const result = fn.apply(target, [...args, callback]);
                if (result && typeof result.then === 'function') result.then(resolve, reject);
            } catch (error) { reject(error); }
        });
    }

    const storage = Object.freeze({
        get(keys) {
            return callAsync(ext.storage.local, 'get', keys);
        },
        set(values) {
            return callAsync(ext.storage.local, 'set', values);
        },
        remove(keys) {
            return callAsync(ext.storage.local, 'remove', keys);
        },
        onChanged(listener) {
            if (typeof listener !== 'function') return () => {};
            const wrapped = (changes, areaName) => {
                if (areaName === 'local') listener(changes);
            };
            ext.storage.onChanged.addListener(wrapped);
            return () => ext.storage.onChanged.removeListener?.(wrapped);
        },
    });

    async function assetText(path) {
        const response = await fetch(ext.runtime.getURL(path));
        if (!response.ok) throw new Error(`Bundled asset failed (${response.status}): ${path}`);
        return response.text();
    }

    async function sendMessage(message) {
        return callAsync(ext.runtime, 'sendMessage', message);
    }

    function onMessage(listener) {
        if (typeof listener !== 'function') return () => {};
        ext.runtime.onMessage.addListener(listener);
        return () => ext.runtime.onMessage.removeListener?.(listener);
    }

    globalThis.RumbleXPlatform = Object.freeze({
        kind: 'extension',
        version: manifest.version,
        capabilities: Object.freeze({
            persistentBackground: true,
            managedDownloads: true,
            packagedAssets: true,
            mediabunny: true,
            externalMessages: true,
            requestBlocking: true,
        }),
        storage,
        fetch: (...args) => fetch(...args),
        assetText,
        assetUrl: (path) => ext.runtime.getURL(path),
        sendMessage,
        onMessage,
        getManifest: () => manifest,
        t: (key) => ext.i18n?.getMessage?.(key) || '',
        migrateLegacySettings: async () => null,
    });
})();
