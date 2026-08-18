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
    // a-delivery.rmbl.ws is a CNAME alias of a.ads.rmbl.ws serving the same ad
    // hosts. Request matching is by hostname, never by CNAME target, so the
    // alias needs explicit coverage or it is simply not blocked.
    'https://a-delivery.rmbl.ws/video?a=15',
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

// ── Three hand-synced copies of the same ad surface ─────────────────────────
// The blocked hosts live in three places that cannot share code: the Chromium
// DNR ruleset, the Firefox MV2 listener, and the userscript's `@webRequest`
// metadata block. They must cover the same hosts or a user gets a shield that
// silently depends on which runtime they installed.
//
// One difference is structural and intentional: `@webRequest` selectors are
// globs, so the first-party affiliate rule (a regex over `rumble.com/l/…?af=`)
// cannot be expressed there at all. That rule exists in the DNR ruleset and in
// the Firefox listener's own pattern, and the userscript simply cannot carry
// it. Every *host* must still appear in all three.
const userscriptSource = fs.readFileSync(path.join(ROOT, 'scripts', 'build-userscript.js'), 'utf8');
const webRequestBlock = userscriptSource.match(/@webRequest\s+(\[[^\]]*\])/)?.[1];
assert.ok(webRequestBlock, 'build-userscript.js no longer emits a @webRequest metadata block');
const userscriptHosts = new Set(
    [...webRequestBlock.matchAll(/"selector":"https:\/\/([^/"]+)/g)].map((match) => match[1].replace(/^\*\./, '')),
);

const adBlockerSource = fs.readFileSync(path.join(ROOT, 'extension', 'ad-blocker.js'), 'utf8');
const firefoxHosts = new Set(
    // Patterns carry paths too (`*://s0.2mdn.net/instream/video/*`), so stop at
    // the first slash rather than assuming the host is the whole pattern.
    [...adBlockerSource.matchAll(/'\*:\/\/(?:\*\.)?([^/']+)\//g)].map((match) => match[1]),
);

// The affiliate rule is the documented exception in both directions.
const AFFILIATE_ONLY = new Set(['rumble.com']);
const dnrHosts = new Set();
for (const rule of rules) {
    for (const domain of rule.condition.requestDomains || []) dnrHosts.add(domain);
    const filter = rule.condition.urlFilter;
    if (filter) dnrHosts.add(filter.replace(/^\|\|/, '').split('/')[0]);
}

for (const host of dnrHosts) {
    if (AFFILIATE_ONLY.has(host)) continue;
    const covered = [...userscriptHosts].some((entry) => entry === host || host.endsWith('.' + entry) || entry.endsWith('.' + host));
    assert.ok(covered, `host blocked by DNR but absent from the userscript @webRequest block: ${host}`);
}
for (const host of userscriptHosts) {
    const covered = [...dnrHosts].some((entry) => entry === host || host.endsWith('.' + entry) || entry.endsWith('.' + host));
    assert.ok(covered, `host blocked by the userscript but absent from the DNR ruleset: ${host}`);
}
for (const host of userscriptHosts) {
    const covered = [...firefoxHosts].some((entry) => entry === host || host.endsWith('.' + entry) || entry.endsWith('.' + host));
    assert.ok(covered, `host blocked by the userscript but absent from the Firefox listener: ${host}`);
}

console.log(
    `Ad-block contract OK: ${rules.length} Chromium rules, ${userscriptHosts.size} userscript hosts, `
    + 'and a scoped Firefox blocking listener, all covering the same hosts.',
);
