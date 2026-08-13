#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const POLYFILL = fs.readFileSync(path.join(ROOT, 'extension', 'browser-polyfill.js'), 'utf8');
const ADAPTER = fs.readFileSync(path.join(ROOT, 'extension', 'platform.js'), 'utf8');

function event() {
    const listeners = new Set();
    return {
        listeners,
        addListener(listener) { listeners.add(listener); },
        removeListener(listener) { listeners.delete(listener); },
    };
}

function baseContext(api, extras = {}) {
    return vm.createContext({
        console,
        Response,
        fetch: async (url) => new Response(`asset:${url}`, { status: 200 }),
        ...extras,
        ...api,
    });
}

async function testFirefoxBrowserNamespace() {
    const changed = event();
    const messages = event();
    const browser = {
        runtime: {
            getManifest: () => ({ version: '3.36.0' }),
            getURL: (name) => `moz-extension://fixture/${name}`,
            sendMessage: async (message) => ({ ok: true, echo: message.action }),
            onMessage: messages,
        },
        storage: {
            local: {
                get: async () => ({ rx_settings: { adNuker: true } }),
                set: async () => undefined,
                remove: async () => undefined,
            },
            onChanged: changed,
        },
        i18n: { getMessage: (key) => `t:${key}` },
    };
    const context = baseContext({ browser, chrome: { callbackOnly: true } });
    vm.runInContext(POLYFILL, context, { filename: 'browser-polyfill.js' });
    assert.equal(context.chrome, browser, 'Firefox bootstrap must route chrome calls through browser promises');
    vm.runInContext(ADAPTER, context, { filename: 'platform.js' });

    const platform = context.RumbleXPlatform;
    assert.equal(platform.kind, 'extension');
    assert.equal(platform.version, '3.36.0');
    assert.equal((await platform.storage.get('rx_settings')).rx_settings.adNuker, true);
    assert.equal((await platform.sendMessage({ action: 'ping' })).echo, 'ping');
    assert.equal(await platform.assetText('worker.js'), 'asset:moz-extension://fixture/worker.js');
    assert.equal(platform.t('hello'), 't:hello');
}

async function testChromiumCallbackNamespace() {
    const changed = event();
    const messages = event();
    const chrome = {
        runtime: {
            lastError: null,
            getManifest: () => ({ version: '3.36.0' }),
            getURL: (name) => `chrome-extension://fixture/${name}`,
            sendMessage(message, callback) { callback({ ok: true, echo: message.action }); },
            onMessage: messages,
        },
        storage: {
            local: {
                get(_keys, callback) { callback({ alpha: 1 }); },
                set(_values, callback) { callback(); },
                remove(_keys, callback) { callback(); },
            },
            onChanged: changed,
        },
        i18n: { getMessage: () => '' },
    };
    const context = baseContext({ chrome });
    vm.runInContext(ADAPTER, context, { filename: 'platform.js' });
    const platform = context.RumbleXPlatform;
    assert.equal((await platform.storage.get('alpha')).alpha, 1);
    await platform.storage.set({ alpha: 2 });
    await platform.storage.remove('alpha');
    assert.equal((await platform.sendMessage({ action: 'pong' })).echo, 'pong');
}

Promise.all([testFirefoxBrowserNamespace(), testChromiumCallbackNamespace()]).then(() => {
    console.log('Extension platform contract OK: Firefox MV2 browser promises and Chromium callbacks.');
}).catch((error) => {
    console.error(error);
    process.exit(1);
});
