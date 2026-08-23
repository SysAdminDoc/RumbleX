#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'extension', 'pages', 'github-permission.js'), 'utf8');
const ORIGIN = 'https://api.github.com/*';

function loadContext(globals) {
    const context = vm.createContext({ console, Promise, ...globals });
    vm.runInContext(source, context, { filename: 'github-permission.js' });
    return context;
}

(async () => {
    let callbackRequests = 0;
    let callbackPayload = null;
    const chrome = {
        runtime: { lastError: null },
        permissions: {
            request(payload, callback) {
                callbackRequests += 1;
                callbackPayload = payload;
                callback(true);
            },
            contains(_payload, callback) { callback(true); },
        },
    };
    const callbackContext = loadContext({ chrome });
    const callbackPromise = callbackContext.RumbleXGithubPermission.requestGithubApi();
    assert.equal(callbackRequests, 1, 'Chrome permission request must start synchronously in the click stack');
    assert.deepEqual(JSON.parse(JSON.stringify(callbackPayload)), { origins: [ORIGIN] });
    assert.deepEqual(JSON.parse(JSON.stringify(await callbackPromise)), { granted: true, reason: null });
    assert.equal(await callbackContext.RumbleXGithubPermission.containsGithubApi(), true);

    let denialRequests = 0;
    const deniedChrome = {
        runtime: { lastError: null },
        permissions: {
            request(_payload, callback) { denialRequests += 1; callback(false); },
            contains(_payload, callback) { callback(false); },
        },
    };
    const deniedContext = loadContext({ chrome: deniedChrome });
    assert.deepEqual(
        JSON.parse(JSON.stringify(await deniedContext.RumbleXGithubPermission.requestGithubApi())),
        { granted: false, reason: 'permission-denied' },
    );
    assert.equal(denialRequests, 1);

    let firefoxRequests = 0;
    const browser = {
        permissions: {
            async request(payload) {
                firefoxRequests += 1;
                assert.deepEqual(JSON.parse(JSON.stringify(payload)), { origins: [ORIGIN] });
                return true;
            },
            async contains() { return true; },
        },
    };
    const firefoxContext = loadContext({ browser, chrome: browser });
    const firefoxResult = await firefoxContext.RumbleXGithubPermission.requestGithubApi();
    assert.deepEqual(JSON.parse(JSON.stringify(firefoxResult)), { granted: true, reason: null });
    assert.equal(firefoxRequests, 1, 'Firefox Promise API must receive one request without a callback argument');
    assert.equal(await firefoxContext.RumbleXGithubPermission.containsGithubApi(), true);

    const missingContext = loadContext({ chrome: {} });
    assert.deepEqual(
        JSON.parse(JSON.stringify(await missingContext.RumbleXGithubPermission.requestGithubApi())),
        { granted: false, reason: 'permission-denied' },
    );

    console.log('GitHub permission gate OK: Chrome callback, Firefox Promise, grant, denial, and synchronous request paths.');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
