// RumbleX platform adapter - generated userscript runtime
'use strict';

(() => {
    const VERSION = __RUMBLEX_VERSION__;
    const ASSETS = Object.freeze(__RUMBLEX_ASSETS__);
    const MESSAGES = Object.freeze(__RUMBLEX_MESSAGES__);
    const STORAGE_KEYS_WITH_CHANGE_EVENTS = ['rx_settings'];
    const ALLOWED_REQUEST_HOSTS = ['rumble.com', 'rumble.cloud', '1a-1791.com'];
    const DIAGNOSTICS_KEY = 'rx_download_diagnostics';
    const DIAGNOSTICS_MAX = 50;
    const assetUrls = new Map();
    const hasMediabunnyAssets = 'mediabunny-worker.js' in ASSETS && 'lib/mediabunny.min.mjs' in ASSETS;

    const isAllowedRemoteUrl = (url) => url.protocol === 'https:' && ALLOWED_REQUEST_HOSTS.some((host) =>
        url.hostname === host || url.hostname.endsWith('.' + host)
    );

    const storage = Object.freeze({
        async get(keys) {
            const list = typeof keys === 'string'
                ? [keys]
                : Array.isArray(keys)
                    ? keys
                    : keys && typeof keys === 'object'
                        ? Object.keys(keys)
                        : [];
            const out = {};
            for (const key of list) {
                const fallback = keys && !Array.isArray(keys) && typeof keys === 'object' ? keys[key] : undefined;
                out[key] = await Promise.resolve(GM_getValue(key, fallback));
            }
            return out;
        },
        async set(values) {
            if (!values || typeof values !== 'object') return;
            for (const [key, value] of Object.entries(values)) {
                await Promise.resolve(GM_setValue(key, value));
            }
        },
        async remove(keys) {
            for (const key of (Array.isArray(keys) ? keys : [keys])) {
                if (typeof key === 'string') await Promise.resolve(GM_deleteValue(key));
            }
        },
        onChanged(listener) {
            if (typeof listener !== 'function' || typeof GM_addValueChangeListener !== 'function') return () => {};
            const ids = STORAGE_KEYS_WITH_CHANGE_EVENTS.map((key) =>
                GM_addValueChangeListener(key, (_name, oldValue, newValue, remote) => {
                    listener({ [key]: { oldValue, newValue, remote: !!remote } });
                })
            );
            return () => {
                if (typeof GM_removeValueChangeListener !== 'function') return;
                for (const id of ids) GM_removeValueChangeListener(id);
            };
        },
    });

    function responseHeaders(raw) {
        const headers = new Headers();
        for (const line of String(raw || '').split(/\r?\n/)) {
            const split = line.indexOf(':');
            if (split <= 0) continue;
            const name = line.slice(0, split).trim();
            const value = line.slice(split + 1).trim();
            if (name && value) headers.append(name, value);
        }
        return headers;
    }

    function gmFetch(url, init = {}) {
        const parsed = new URL(String(url), location.href);
        if (!isAllowedRemoteUrl(parsed)) {
            return Promise.reject(new Error(`RumbleX refused an unapproved request URL: ${parsed.href}`));
        }
        return new Promise((resolve, reject) => {
            if (init.signal?.aborted) {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
                return;
            }
            let settled = false;
            let request;
            const cleanup = () => init.signal?.removeEventListener?.('abort', abort);
            const finish = (fn, value) => {
                if (settled) return;
                settled = true;
                cleanup();
                fn(value);
            };
            const abort = () => {
                try { request?.abort?.(); } catch {}
                finish(reject, new DOMException('The operation was aborted.', 'AbortError'));
            };
            init.signal?.addEventListener?.('abort', abort, { once: true });
            const headers = {};
            if (init.headers instanceof Headers) {
                for (const [key, value] of init.headers.entries()) headers[key] = value;
            } else if (init.headers && typeof init.headers === 'object') {
                Object.assign(headers, init.headers);
            }
            request = GM_xmlhttpRequest({
                method: String(init.method || 'GET').toUpperCase(),
                url: parsed.href,
                headers,
                data: init.body,
                responseType: 'arraybuffer',
                timeout: Math.max(1_000, Math.min(120_000, Number(init.rxTimeoutMs) || 30_000)),
                anonymous: init.credentials === 'omit',
                onload(result) {
                    const body = result.response instanceof ArrayBuffer ? result.response : new ArrayBuffer(0);
                    const response = new Response(body, {
                        status: result.status || 200,
                        statusText: result.statusText || '',
                        headers: responseHeaders(result.responseHeaders),
                    });
                    try { Object.defineProperty(response, 'url', { value: result.finalUrl || parsed.href }); } catch {}
                    finish(resolve, response);
                },
                onerror() { finish(reject, new TypeError('Network request failed')); },
                ontimeout() { finish(reject, new DOMException('The operation timed out.', 'TimeoutError')); },
                onabort: abort,
            });
        });
    }

    function platformFetch(input, init = {}) {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
        if (url.protocol === 'blob:' || url.protocol === 'data:' || url.origin === location.origin) {
            return fetch(input, init);
        }
        return gmFetch(url.href, init);
    }

    function saveWithAnchor(url, filename) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename || 'rumblex-download';
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        return { downloadId: `userscript-${Date.now()}` };
    }

    async function download(data) {
        const url = String(data?.url || '');
        const filename = String(data?.filename || 'rumblex-download').replace(/[\\/:*?"<>|]/g, '_').slice(0, 180);
        const parsed = new URL(url, location.href);
        if (parsed.protocol === 'blob:' || parsed.protocol === 'data:') return saveWithAnchor(parsed.href, filename);
        if (!isAllowedRemoteUrl(parsed)) throw new Error(`Download URL is not allowed: ${parsed.href}`);
        if (typeof GM_download !== 'function') return saveWithAnchor(parsed.href, filename);
        return new Promise((resolve, reject) => {
            try {
                GM_download({
                    url: parsed.href,
                    name: filename,
                    saveAs: false,
                    timeout: 120_000,
                    onload() { resolve({ downloadId: `userscript-${Date.now()}` }); },
                    onerror(error) {
                        reject(new Error(error?.error || error?.details || 'Userscript download failed'));
                    },
                    ontimeout() {
                        reject(new Error('Userscript download timed out'));
                    },
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    function sanitizeDiagnostic(value, key = '', depth = 0) {
        if (/authorization|cookie|credential|password|passphrase|secret|token|api[_-]?key|signature/i.test(key)) return '[redacted]';
        if (depth > 5) return '[truncated]';
        if (value == null || typeof value === 'boolean') return value;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (typeof value === 'string') {
            return value.slice(0, 1200).replace(/https?:\/\/[^\s<>"')]+/gi, (raw) => {
                try {
                    const parsed = new URL(raw);
                    return parsed.origin + parsed.pathname.split('/').map((part, index) =>
                        index < 2 || !part ? part : '[redacted]'
                    ).join('/');
                } catch { return '[redacted-url]'; }
            });
        }
        if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeDiagnostic(item, key, depth + 1));
        if (typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).slice(0, 40).map(([childKey, childValue]) => [
                String(childKey).slice(0, 80),
                sanitizeDiagnostic(childValue, childKey, depth + 1),
            ]));
        }
        return String(value).slice(0, 1200);
    }

    async function recordDiagnostic(diagnostic) {
        const stored = await storage.get(DIAGNOSTICS_KEY);
        const entries = Array.isArray(stored[DIAGNOSTICS_KEY]) ? stored[DIAGNOSTICS_KEY] : [];
        const entry = {
            ...sanitizeDiagnostic(diagnostic || {}),
            id: `rxd-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
            at: new Date().toISOString(),
            userscriptVersion: VERSION,
            source: 'userscript',
        };
        entries.push(entry);
        await storage.set({ [DIAGNOSTICS_KEY]: entries.slice(-DIAGNOSTICS_MAX) });
        return entry;
    }

    async function sendMessage(message) {
        switch (message?.action) {
            case 'download':
                return download(message.data);
            case 'recordDownloadDiagnostic': {
                const entry = await recordDiagnostic(message.diagnostic);
                return { ok: true, id: entry.id };
            }
            case 'getDownloadDiagnostics': {
                const stored = await storage.get(DIAGNOSTICS_KEY);
                const attempts = Array.isArray(stored[DIAGNOSTICS_KEY]) ? stored[DIAGNOSTICS_KEY] : [];
                return {
                    ok: true,
                    bundle: {
                        schemaVersion: 1,
                        generatedAt: new Date().toISOString(),
                        userscriptVersion: VERSION,
                        count: attempts.length,
                        privacy: 'Local-only diagnostics with URL and credential-like values redacted before storage.',
                        capabilities: { userscript: true, managedDownloads: typeof GM_download === 'function' },
                        attempts,
                    },
                };
            }
            case 'getPendingLocalDataOperation':
                return { ok: true, operation: null };
            case 'completePendingLocalDataOperation':
                return { ok: true, cleared: false };
            case 'archiveEnqueueChannel':
                return { ok: false, reason: 'persistent-background-unavailable' };
            default:
                return { ok: false, reason: 'unsupported-userscript-message' };
        }
    }

    async function migrateLegacySettings(defaults) {
        const existing = await storage.get('rx_settings');
        if (existing.rx_settings && typeof existing.rx_settings === 'object') return null;
        const migrated = {};
        for (const key of Object.keys(defaults || {})) {
            const value = await Promise.resolve(GM_getValue('rx_' + key, undefined));
            if (value !== undefined) migrated[key] = value;
        }
        const keyboardNav = await Promise.resolve(GM_getValue('rx_keyboardNav', undefined));
        if (keyboardNav !== undefined && migrated.legacyKeyboardNav === undefined) migrated.legacyKeyboardNav = !!keyboardNav;
        const speedControl = await Promise.resolve(GM_getValue('rx_speedControl', undefined));
        if (speedControl !== undefined && migrated.speedController === undefined) migrated.speedController = !!speedControl;
        const shareTools = await Promise.resolve(GM_getValue('rx_shareTools', undefined));
        if (shareTools !== undefined) {
            if (migrated.shareTimestamp === undefined) migrated.shareTimestamp = !!shareTools;
            if (migrated.stripTrackingParams === undefined) migrated.stripTrackingParams = !!shareTools;
        }
        if (!Object.keys(migrated).length) return null;
        migrated.schemaVersion = Number(migrated.schemaVersion) || 2;
        await storage.set({ rx_settings: migrated });
        return migrated;
    }

    const manifest = Object.freeze({
        manifest_version: null,
        version: VERSION,
        permissions: ['GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_addValueChangeListener', 'GM_removeValueChangeListener', 'GM_xmlhttpRequest', 'GM_download', 'userscriptWebRequest'],
        host_permissions: ['https://rumble.com/*', 'https://*.rumble.com/*', 'https://1a-1791.com/*', 'https://*.1a-1791.com/*', 'https://rumble.cloud/*', 'https://*.rumble.cloud/*'],
        web_accessible_resources: [],
    });

    function assetUrl(path) {
        if (!(path in ASSETS)) throw new Error(`Userscript asset is unavailable: ${path}`);
        if (assetUrls.has(path)) return assetUrls.get(path);
        if (typeof URL.createObjectURL !== 'function') throw new Error('Blob asset URLs are unavailable');
        const type = /\.(?:m?js)$/i.test(path) ? 'text/javascript' : 'text/plain';
        const url = URL.createObjectURL(new Blob([ASSETS[path]], { type }));
        assetUrls.set(path, url);
        return url;
    }

    globalThis.addEventListener?.('pagehide', () => {
        for (const url of assetUrls.values()) URL.revokeObjectURL?.(url);
        assetUrls.clear();
    }, { once: true });

    globalThis.RumbleXPlatform = Object.freeze({
        kind: 'userscript',
        version: VERSION,
        capabilities: Object.freeze({
            persistentBackground: false,
            managedDownloads: typeof GM_download === 'function',
            packagedAssets: true,
            mediabunny: hasMediabunnyAssets && typeof URL.createObjectURL === 'function',
            externalMessages: false,
            requestBlocking: false,
            requestBlockingMode: 'userscript-manager-dependent',
            requestBlockingRules: 6,
            streamingFileSave: typeof globalThis.showSaveFilePicker === 'function',
        }),
        storage,
        fetch: platformFetch,
        assetText: async (path) => {
            if (!(path in ASSETS)) throw new Error(`Userscript asset is unavailable: ${path}`);
            return ASSETS[path];
        },
        assetUrl,
        sendMessage,
        onMessage: () => () => {},
        getManifest: () => manifest,
        t: (key) => MESSAGES[key] || '',
        migrateLegacySettings,
    });
})();
