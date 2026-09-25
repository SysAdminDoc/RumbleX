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
assert.doesNotMatch(options, /chrome\.storage\.local\.remove\(STORAGE_KEY\)/,
    'Options settings reset bypasses the serialized background writer');
assert.doesNotMatch(popup, /chrome\.storage\.local\.set\(\{ rx_settings:/,
    'popup settings writes bypass the background writer');
assert.match(background, /importSettings:[\s\S]*?maxBytes: 5 \* 1024 \* 1024/,
    'background import limit is lower than the Options 4.5 MiB contract');

const writerBlock = background.match(
    /let rxSettingsWriteChain = Promise\.resolve\(\);[\s\S]*?(?=\nasync function rxSyncChannelNotifier)/,
);
assert.ok(writerBlock, 'serialized settings writer block is missing');

const stored = { rx_settings: { alpha: 0, beta: 0 }, rx_settings_snapshots: [] };
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
                    return {
                        rx_settings: stored.rx_settings ? { ...stored.rx_settings } : undefined,
                        rx_settings_snapshots: Array.isArray(stored.rx_settings_snapshots)
                            ? JSON.parse(JSON.stringify(stored.rx_settings_snapshots))
                            : undefined,
                    };
                },
                async set(value) {
                    await Promise.resolve();
                    if (failNextWrite) {
                        failNextWrite = false;
                        throw new Error('deliberate write failure');
                    }
                    Object.assign(stored, value);
                    if (value.rx_settings) stored.rx_settings = { ...value.rx_settings };
                },
                async remove(key) {
                    await Promise.resolve();
                    if (key === 'rx_settings') delete stored.rx_settings;
                },
            },
        },
    },
    rxNormalizeSettings(value) { return { ...value }; },
});
vm.runInContext(`${writerBlock[0]}\nthis.queueWrite = rxQueueSettingsWrite; this.queueReset = rxQueueSettingsReset;`, context, {
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

    stored.rx_settings = { portable: 'before-pull', encryptedGistSyncToken: 'local-token' };
    stored.rx_settings_snapshots = [];
    await Promise.all([
        context.queueWrite({ portable: 'latest-before-pull' }),
        context.queueWrite({ portable: 'remote' }, {
            replace: true,
            preserveOmittedSecrets: true,
            snapshotReason: 'pre-gist-pull',
        }),
    ]);
    assert.equal(stored.rx_settings_snapshots[0].settings.portable, 'latest-before-pull',
        'replacement snapshot missed a settings write that committed before it');
    assert.equal(stored.rx_settings.portable, 'remote');
    assert.equal(stored.rx_settings.encryptedGistSyncToken, 'local-token');

    stored.rx_settings = { portable: 'before-reset' };
    stored.rx_settings_snapshots = [{
        at: 12345,
        reason: 'pre-reset-all-data',
        settings: { portable: 'stale-snapshot' },
        activity: { rx_history: ['kept'] },
    }];
    await Promise.all([
        context.queueWrite({ portable: 'latest-before-reset' }),
        context.queueReset(12345),
    ]);
    assert.equal(stored.rx_settings, undefined,
        'queued settings write recreated the profile after reset');
    assert.equal(stored.rx_settings_snapshots[0].settings.portable, 'latest-before-reset',
        'reset undo snapshot missed the final queued settings write');
    assert.deepEqual(stored.rx_settings_snapshots[0].activity, { rx_history: ['kept'] },
        'reset snapshot refresh discarded its activity payload');

    console.log('Settings write contract OK: writes serialize, failures recover, snapshots stay current, and reset is a queue barrier.');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
