#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'rules', 'ad-block.json'), 'utf8'));
const ids = rules.map((rule) => rule.id);
assert.equal(new Set(ids).size, ids.length, 'DNR rule IDs must be unique');
assert.ok(rules.length >= 7, 'expected the verified Rumble ad surface to be covered');
for (const rule of rules) {
    assert.equal(rule.action?.type, 'block', `rule ${rule.id} must block`);
    assert.ok(rule.condition?.initiatorDomains?.includes('rumble.com'), `rule ${rule.id} must be scoped to Rumble`);
}

let registration = null;
const sandbox = {
    chrome: {
        webRequest: {
            onBeforeRequest: {
                addListener(listener, filter, extraInfoSpec) {
                    registration = { listener, filter, extraInfoSpec };
                },
            },
        },
    },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'extension', 'ad-blocker.js'), 'utf8'), sandbox, {
    filename: 'ad-blocker.js',
});

assert.ok(registration, 'Firefox webRequest listener was not registered');
assert.deepEqual(Array.from(registration.extraInfoSpec), ['blocking']);
const shouldBlock = sandbox.RumbleXAdBlock.rxShouldBlockAdRequest;
const rumble = 'https://rumble.com/watch';
for (const url of [
    'https://a.ads.rmbl.ws/video?a=15',
    'https://imasdk.googleapis.com/js/sdkloader/ima3.js',
    'https://s0.2mdn.net/instream/video/client.js',
    'https://pagead2.googlesyndication.com/omsdk/releases/live/omweb-v1.js',
    'https://securepubads.g.doubleclick.net/gampad/ads',
    'https://www.googleadservices.com/pagead/conversion.js',
    'https://rumble.com/l/ae.test?p=2&af=https%3A%2F%2Fa.ads.rmbl.ws%2Fvideo',
]) {
    assert.equal(shouldBlock({ url, originUrl: rumble }), true, `expected block: ${url}`);
    assert.equal(registration.listener({ url, originUrl: rumble }).cancel, true, `listener did not cancel: ${url}`);
}
assert.equal(shouldBlock({ url: 'https://a.ads.rmbl.ws/video?a=15', originUrl: 'https://example.com/' }), false);
assert.equal(shouldBlock({ url: 'https://1a-1791.com/video/segment.ts', originUrl: rumble }), false);
assert.equal(shouldBlock({ url: 'https://rumble.com/l/view.abc?p=1', originUrl: rumble }), false);

const chromeManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'manifest.json'), 'utf8'));
const chromeRuleset = chromeManifest.declarative_net_request?.rule_resources?.find((entry) => entry.id === 'rumblex_ad_shield');
assert.deepEqual(chromeRuleset, { id: 'rumblex_ad_shield', enabled: true, path: 'rules/ad-block.json' });
assert.ok(chromeManifest.permissions.includes('declarativeNetRequest'));
const enMessages = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', '_locales', 'en', 'messages.json'), 'utf8'));
assert.equal(Number.parseInt(enMessages.networkShieldVerified.message, 10), rules.length);

const firefoxManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'manifest-firefox.json'), 'utf8'));
assert.ok(firefoxManifest.permissions.includes('webRequest'));
assert.ok(firefoxManifest.permissions.includes('webRequestBlocking'));
assert.ok(firefoxManifest.background.scripts.includes('ad-blocker.js'));
assert.ok(
    firefoxManifest.background.scripts.indexOf('ad-blocker.js')
        < firefoxManifest.background.scripts.indexOf('background.js'),
    'Firefox request blocker must load before the main background runtime',
);

console.log(`Ad-block contract OK: ${rules.length} Chromium rules and scoped Firefox blocking listener.`);
