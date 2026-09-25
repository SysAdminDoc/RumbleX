#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const background = read('extension/background.js');
const content = read('extension/content.js');
const options = read('extension/pages/options.js');
const popup = read('extension/pages/popup.js');

assert.equal(
    (background.match(/rx_settings: next/g) || []).length,
    1,
    'background settings writes must all pass through rxQueueSettingsWrite',
);
assert.doesNotMatch(content, /RXPlatform\.storage\.set\(\{ rx_settings:/,
    'content settings writes bypass the serialized patch contract');
assert.doesNotMatch(options, /chrome\.storage\.local\.set\(\{ (?:\[STORAGE_KEY\]|rx_settings):/,
    'Options settings writes bypass the background writer');
assert.doesNotMatch(popup, /chrome\.storage\.local\.set\(\{ rx_settings:/,
    'popup settings writes bypass the background writer');

const writerBlock = background.match(
    /let rxSettingsWriteChain = Promise\.resolve\(\);[\s\S]*?(?=\nasync function rxSyncChannelNotifier)/,
);
assert.ok(writerBlock, 'serialized settings writer block is missing');

const stored = { rx_settings: { alpha: 0, beta: 0 } };
let failNextWrite = false;
const context = vm.createContext({
    console,
    RXSettingsSchema: {
        SECRET_SETTING_KEYS: Object.freeze([
            'discordWebhookUrl',
            'encryptedGistSyncToken',
            'encryptedGistSyncId',
            'liveStreamApiUrl',
        ]),
    },
    chrome: {
        storage: {
            local: {
                async get() {
                    await Promise.resolve();
                    return { rx_settings: { ...stored.rx_settings } };
                },
                async set(value) {
                    await Promise.resolve();
                    if (failNextWrite) {
                        failNextWrite = false;
                        throw new Error('deliberate write failure');
                    }
                    Object.assign(stored, value);
                    stored.rx_settings = { ...value.rx_settings };
                },
            },
        },
    },
    rxNormalizeSettings(value) { return { ...value }; },
});
vm.runInContext(`${writerBlock[0]}\nthis.queueWrite = rxQueueSettingsWrite;`, context, {
    filename: 'background-settings-writer.js',
});

async function main() {
    await Promise.all([
        context.queueWrite({ alpha: 1 }),
        context.queueWrite({ beta: 2 }),
    ]);
    assert.deepEqual(stored.rx_settings, { alpha: 1, beta: 2 },
        'concurrent patches did not preserve both callers');

    failNextWrite = true;
    await assert.rejects(context.queueWrite({ alpha: 3 }), /deliberate write failure/);
    await context.queueWrite({ beta: 4 });
    assert.deepEqual(stored.rx_settings, { alpha: 1, beta: 4 },
        'one failed write poisoned the settings queue');

    await context.queueWrite({ starter: true }, { extraValues: { rx_welcome_seen: true } });
    assert.equal(stored.rx_welcome_seen, true, 'welcome marker was not committed with its settings patch');
    assert.deepEqual(stored.rx_settings, { alpha: 1, beta: 4, starter: true });

    await context.queueWrite({ replacement: true }, { replace: true });
    assert.deepEqual(stored.rx_settings, { replacement: true },
        'explicit restore/import did not replace the stored profile');

    stored.rx_settings = {
        portable: 'old',
        encryptedGistSyncToken: 'old-local-token',
        discordWebhookUrl: 'https://discord.com/api/webhooks/1/newest-local-secret',
    };
    await Promise.all([
        context.queueWrite({ encryptedGistSyncToken: 'newest-local-token' }),
        context.queueWrite({ portable: 'imported' }, {
            replace: true,
            preserveOmittedSecrets: true,
        }),
    ]);
    assert.deepEqual(stored.rx_settings, {
        portable: 'imported',
        encryptedGistSyncToken: 'newest-local-token',
        discordWebhookUrl: 'https://discord.com/api/webhooks/1/newest-local-secret',
    }, 'credential-safe replacement did not preserve omitted secrets at commit time');

    await context.queueWrite({
        portable: 'credential-bearing-import',
        encryptedGistSyncToken: 'explicit-import-token',
    }, {
        replace: true,
        preserveOmittedSecrets: true,
    });
    assert.deepEqual(stored.rx_settings, {
        portable: 'credential-bearing-import',
        encryptedGistSyncToken: 'explicit-import-token',
        discordWebhookUrl: 'https://discord.com/api/webhooks/1/newest-local-secret',
    }, 'credential-safe replacement did not honor an explicitly imported secret');

    console.log('Settings write contract OK: writes serialize, failures recover, restores replace, and omitted secrets stay current.');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
