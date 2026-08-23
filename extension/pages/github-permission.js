// Shared optional-permission gate for GitHub-backed actions.
'use strict';

(() => {
    if (globalThis.RumbleXGithubPermission) return;

    const GITHUB_API_ORIGIN = 'https://api.github.com/*';

    function usesPromiseNamespace() {
        return !!globalThis.browser && globalThis.chrome === globalThis.browser;
    }

    function callPermission(method, payload) {
        const testApi = globalThis.__RUMBLEX_TEST_PERMISSION_API;
        const api = testApi || globalThis.chrome?.permissions;
        if (!api || typeof api[method] !== 'function') return Promise.resolve(false);

        if (usesPromiseNamespace()) {
            try {
                return Promise.resolve(api[method](payload)).then(Boolean, () => false);
            } catch {
                return Promise.resolve(false);
            }
        }

        return new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                const lastError = testApi ? null : globalThis.chrome?.runtime?.lastError;
                resolve(!lastError && value === true);
            };
            try {
                const result = api[method](payload, finish);
                if (result && typeof result.then === 'function') {
                    result.then(finish, () => finish(false));
                }
            } catch {
                finish(false);
            }
        });
    }

    // The API call happens synchronously before this function returns its
    // Promise. Callers must invoke it directly from a click handler so Chrome
    // and Firefox retain the user gesture required for an optional host grant.
    function requestGithubApi() {
        return callPermission('request', { origins: [GITHUB_API_ORIGIN] }).then((granted) => ({
            granted,
            reason: granted ? null : 'permission-denied',
        }));
    }

    function containsGithubApi() {
        return callPermission('contains', { origins: [GITHUB_API_ORIGIN] });
    }

    Object.defineProperty(globalThis, 'RumbleXGithubPermission', {
        value: Object.freeze({
            GITHUB_API_ORIGIN,
            requestGithubApi,
            containsGithubApi,
        }),
        configurable: false,
        enumerable: false,
        writable: false,
    });
})();
