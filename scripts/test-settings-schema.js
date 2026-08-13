#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'extension', 'settings-schema.js'), 'utf8');
const context = vm.createContext({ URL, console });
vm.runInContext(source, context, { filename: 'settings-schema.js' });

const evaluate = (expression) => vm.runInContext(expression, context);
const plain = (value) => JSON.parse(JSON.stringify(value));
const schema = context.RumbleXSettingsSchema;

assert.ok(schema, 'schema global was not installed');
assert.equal(schema.SCHEMA_VERSION, 2);
assert.ok(Object.keys(schema.DEFAULTS).length >= 210, 'canonical defaults catalog unexpectedly shrank');

const migrated = plain(evaluate(`RumbleXSettingsSchema.normalizeStored({
    keyboardNav: true,
    theme: 'oledGreen',
})`));
assert.equal(migrated.schemaVersion, 2);
assert.equal(migrated.legacyKeyboardNav, true);
assert.equal(migrated.theme, 'oledGreen');
assert.ok(!Object.hasOwn(migrated, 'keyboardNav'));

const sanitized = plain(evaluate(`RumbleXSettingsSchema.normalizeStored(JSON.parse(${JSON.stringify(JSON.stringify({
    schemaVersion: 99,
    adNuker: 'yes',
    theme: 'invented',
    splitRatio: 999,
    blockedKeywords: [{ bad: true }, 'safe phrase', 'safe phrase', 'bad\u0000word'],
    hiddenCategories: ['news', 'x} body { display:none } /*'],
    autoplayQueue: [
        'javascript://rumble.com/%0Aalert(1)',
        'http://rumble.com/insecure',
        'https://example.com/off-site',
        'https://rumble.com/vsafe.html',
        'https://sub.rumble.com/vsafe-two.html',
    ],
    watchedChannels: [
        { url: 'javascript://rumble.com/bad', name: 'bad' },
        { url: 'https://rumble.com/c/safe', name: 'Safe\u0000 Channel', lastChecked: 12.7 },
    ],
    sponsorSegments: {
        vgood: [
            { start: 2, end: 5, category: 'intro' },
            { start: -1, end: 4, category: 'sponsor' },
        ],
        '../bad': [{ start: 1, end: 2 }],
    },
    unknownSetting: true,
    __proto__: { polluted: true },
}))}))`));

assert.equal(sanitized.schemaVersion, 2);
assert.equal(sanitized.splitRatio, 95);
assert.ok(!Object.hasOwn(sanitized, 'adNuker'));
assert.ok(!Object.hasOwn(sanitized, 'theme'));
assert.ok(!Object.hasOwn(sanitized, 'unknownSetting'));
assert.deepEqual(sanitized.blockedKeywords, ['safe phrase', 'badword']);
assert.deepEqual(sanitized.hiddenCategories, ['news']);
assert.deepEqual(sanitized.autoplayQueue, [
    'https://rumble.com/vsafe.html',
    'https://sub.rumble.com/vsafe-two.html',
]);
assert.deepEqual(sanitized.watchedChannels, [{
    url: 'https://rumble.com/c/safe',
    name: 'Safe Channel',
    lastSeenVideoId: null,
    isLive: false,
    lastChecked: 13,
}]);
assert.deepEqual(sanitized.sponsorSegments, {
    vgood: [{ start: 2, end: 5, category: 'intro' }],
});
assert.equal({}.polluted, undefined);

const partial = plain(evaluate(`RumbleXSettingsSchema.normalize({
    channelNotifierEnabled: true,
    channelNotifierIntervalMin: -5,
})`));
assert.deepEqual(partial, {
    channelNotifierEnabled: true,
    channelNotifierIntervalMin: 1,
});

assert.equal(schema.safeRumbleUrl('https://rumble.com.evil.example/v1'), null);
assert.equal(schema.safeRumbleUrl('https://evilrumble.com/v1'), null);
assert.equal(schema.safeRumbleUrl('https://rumbleXcom/v1'), null);
assert.equal(schema.safeRumbleUrl('ftp://rumble.com/v1'), null);
assert.equal(schema.safeRumbleUrl('https://rumble.com/v1'), 'https://rumble.com/v1');

console.log(`Shared settings schema OK: ${Object.keys(schema.DEFAULTS).length} defaults, migration, bounds, URL and nested-data guards.`);
