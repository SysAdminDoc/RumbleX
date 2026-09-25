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
    6,
    'only the six reviewed storage-queue writers may persist normalized settings',
);
assert.equal(
    (content.match(/RXPlatform\.storage\.set\(\{ rx_settings:/g) || []).length,
    1,
    'only the userscript fallback may write settings without the background queue',
);
assert.match(
    content,
    /if \(!RXPlatform\.capabilities\.persistentBackground\) \{[\s\S]*?RXPlatform\.storage\.set\(\{ rx_settings: settings \}\);/,
    'the direct settings write is not isolated to the userscript fallback',
);
assert.doesNotMatch(options, /chrome\.storage\.local\.set\(\{ (?:\[STORAGE_KEY\]|rx_settings):/,
    'Options settings writes bypass the background writer');
assert.doesNotMatch(options, /chrome\.storage\.local\.remove\(STORAGE_KEY\)/,
    'Options settings reset bypasses the serialized background writer');
assert.doesNotMatch(popup, /chrome\.storage\.local\.set\(\{ rx_settings:/,
    'popup settings writes bypass the background writer');
assert.match(background, /(?:patchSettings|saveSettings):[\s\S]*?maxBytes: 5 \* 1024 \* 1024/,
    'background save limits are lower than the Options 4.5 MiB contract');
assert.match(background, /importSettings:[\s\S]*?maxBytes: 5 \* 1024 \* 1024/,
    'background import limit is lower than the Options 4.5 MiB contract');
assert.match(background, /rxValidateProfilePayload[\s\S]*?5 \* 1024 \* 1024/,
    'profile validation is lower than the import contract');
assert.match(content, /action: 'writeActivity'/,
    'content activity writes bypass the shared background queue');
assert.match(options, /restoreSettingsSnapshot\(s\.at\)/,
    'snapshot history restores by a stale array index instead of its stable timestamp');

const writerBlock = background.match(
    /let rxSettingsWriteChain = Promise\.resolve\(\);[\s\S]*?(?=\nasync function rxSyncChannelNotifier)/,
);
assert.ok(writerBlock, 'serialized settings writer block is missing');

const clone = (value) => value === undefined ? undefined : structuredClone(value);
const stored = {};
let failNextWrite = false;

function selectStored(keys) {
    if (keys === null || keys === undefined) return clone(stored);
    const list = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(list
        .filter((key) => Object.hasOwn(stored, key))
        .map((key) => [key, clone(stored[key])]));
}

const context = vm.createContext({
    console,
    TextEncoder,
    structuredClone,
    RXSettingsSchema: {
        DEFAULTS: Object.freeze({ backupHistory: true, backupHistoryLimit: 10 }),
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
                async get(keys) {
                    await Promise.resolve();
                    return selectStored(keys);
                },
                async set(values) {
                    await Promise.resolve();
                    if (failNextWrite) {
                        failNextWrite = false;
                        throw new Error('deliberate write failure');
                    }
                    for (const [key, value] of Object.entries(values)) stored[key] = clone(value);
                },
                async remove(keys) {
                    await Promise.resolve();
                    for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key];
                },
            },
        },
    },
    rxNormalizeSettings(value) {
        return clone(value);
    },
    rxArchiveNetworkGeneration: 0,
    rxDownloadRecoveryGeneration: 0,
    async rxCallOpenOffscreen() {
        return { ok: false, reason: 'test-no-offscreen' };
    },
});
vm.runInContext(read('extension/activity-store.js'), context, { filename: 'activity-store.js' });
vm.runInContext(`const RXActivityStore = globalThis.RumbleXActivityStore;
const RX_CANONICAL_RUMBLE_ORIGINS = Object.freeze(['https://rumble.com', 'https://www.rumble.com']);
const PENDING_LOCAL_DATA_OP_KEY = 'rx_pending_local_data_op';
const rxTrustedRumbleOrigin = (value) => typeof value === 'string' ? value : null;
const rxReadPendingLocalDataOperation = async () => null;
const rxReplayPendingResetExtensionState = async () => ({ cleared: 0, generation: 0 });
const rxPreparePageCleanupOperation = (stored, options = {}) => {
    const existing = options.existingOverride && typeof options.existingOverride === 'object'
        ? options.existingOverride
        : null;
    return {
        id: options.preserveExistingIdentity && existing?.id ? existing.id : 'test-cleanup',
        source: existing?.source || options.source,
        clear: options.clear === true || existing?.clear === true,
        data: null,
        cleanupKeys: [],
        keyCount: 0,
        targetOrigins: RX_CANONICAL_RUMBLE_ORIGINS,
        remainingOrigins: RX_CANONICAL_RUMBLE_ORIGINS,
        allTrustedOrigins: true,
        completedOrigins: [],
        extensionApplied: true,
        archiveHandleApplied: true,
        activityGeneration: options.activityGeneration,
    };
};
const rxBroadcastPendingLocalDataOperation = async (operation) => ({
    tabs: 0,
    cleared: 0,
    pending: !!operation,
    pendingClear: operation?.clear === true,
    pendingId: operation?.id || null,
    pendingKeys: operation?.keyCount || 0,
    pendingOrigins: operation?.remainingOrigins?.length || 0,
});
${writerBlock[0]}
this.queueWrite = rxQueueSettingsWrite;
this.queueReset = rxQueueSettingsReset;
this.queueSnapshot = rxQueueSettingsSnapshot;
this.queueRestore = rxQueueSettingsRestore;
this.queueActivityWrite = rxQueueActivityWrite;
this.queueProfileSave = rxQueueProfileSave;
this.queueProfileDelete = rxQueueProfileDelete;
this.queueProfileRestore = rxQueueProfileRestore;
this.queueProfileSwitch = rxQueueProfileSwitch;`, context, {
    filename: 'background-settings-writer.js',
});

function replaceStored(values) {
    for (const key of Object.keys(stored)) delete stored[key];
    Object.assign(stored, clone(values));
}

async function main() {
    replaceStored({ rx_settings: { wideLayout: false }, rx_settings_snapshots: [] });
    const defaultedSnapshot = await context.queueSnapshot('partial-settings-defaults');
    assert.equal(defaultedSnapshot.ok, true,
        'a partial stored profile ignored the default-enabled backup history setting');

    replaceStored({ rx_settings: { backupHistory: true, backupHistoryLimit: 10, alpha: 0, beta: 0 } });
    await Promise.all([
        context.queueWrite({ alpha: 1 }),
        context.queueWrite({ beta: 2 }),
    ]);
    assert.equal(stored.rx_settings.alpha, 1, 'concurrent patch lost alpha');
    assert.equal(stored.rx_settings.beta, 2, 'concurrent patch lost beta');

    failNextWrite = true;
    await assert.rejects(context.queueWrite({ alpha: 3 }), /deliberate write failure/);
    await context.queueWrite({ beta: 4 });
    assert.equal(stored.rx_settings.alpha, 1, 'failed write changed storage');
    assert.equal(stored.rx_settings.beta, 4, 'failed write poisoned the queue');

    replaceStored({
        rx_settings: {
            backupHistory: true,
            backupHistoryLimit: 10,
            portable: 'old',
            encryptedGistSyncToken: 'old-local-token',
            discordWebhookUrl: 'https://discord.com/api/webhooks/1/newest-local-secret',
        },
    });
    await Promise.all([
        context.queueWrite({ encryptedGistSyncToken: 'newest-local-token' }),
        context.queueWrite({ portable: 'imported' }, {
            replace: true,
            preserveOmittedSecrets: true,
        }),
    ]);
    assert.equal(stored.rx_settings.portable, 'imported');
    assert.equal(stored.rx_settings.encryptedGistSyncToken, 'newest-local-token');
    assert.equal(stored.rx_settings.discordWebhookUrl, 'https://discord.com/api/webhooks/1/newest-local-secret');

    replaceStored({
        rx_settings: { backupHistory: true, backupHistoryLimit: 10, portable: 'before-pull' },
        rx_settings_snapshots: [],
    });
    await Promise.all([
        context.queueWrite({ portable: 'latest-before-pull' }),
        context.queueWrite({ portable: 'remote' }, {
            replace: true,
            preserveOmittedSecrets: true,
            snapshotReason: 'pre-gist-pull',
        }),
        context.queueSnapshot('manual-during-pull'),
    ]);
    assert.equal(stored.rx_settings_snapshots[0].settings.portable, 'latest-before-pull',
        'replacement snapshot missed the write ahead of it');
    assert.equal(stored.rx_settings_snapshots[1].settings.portable, 'remote',
        'concurrent snapshots overwrote each other');
    assert.ok(Number.isInteger(stored.rx_settings_snapshots[0].at), 'snapshot timestamp is not numeric');
    assert.ok(stored.rx_settings_snapshots[1].at > stored.rx_settings_snapshots[0].at,
        'snapshot timestamps are not unique and monotonic');

    const beforeFailedImport = clone(stored);
    failNextWrite = true;
    await assert.rejects(context.queueWrite({ portable: 'must-not-land' }, {
        replace: true,
        snapshotReason: 'pre-import-settings',
    }), /deliberate write failure/);
    assert.deepEqual(stored, beforeFailedImport,
        'failed atomic snapshot plus replacement changed durable storage');

    replaceStored({
        rx_settings: { backupHistory: true, backupHistoryLimit: 10, portable: 'before-reset' },
        rx_settings_snapshots: [],
        'rx_act:rx_watch_history': '[{"id":"kept"}]',
        'rx_act:rx_bookmarks': '[{"id":"saved"}]',
        rx_rant_stats_mirror: { videos: { v1: { title: 'Kept' } } },
        rx_pending_local_data_op: { id: 'old-op', operation: 'set', data: {} },
        rx_activity_meta: { version: 1, origins: ['https://rumble.com'] },
        rx_activity_premigration: { dataByOrigin: { 'https://rumble.com': { rx_watch_history: '[]' } } },
        rx_settings_profiles: [{ id: 'work', name: 'Work', createdAt: 1, settings: { portable: 'profile' } }],
        rx_archive_queue: { jobs: [{ id: 'archive-1' }] },
        rx_download_diagnostics: [{ id: 'diag-1' }],
        rx_download_recovery: { downloads: [{ id: 'download-1' }] },
        rx_welcome_seen: true,
        rx_probe_cache: { disposable: true },
        rx_popup_ui: { section: 'privacy' },
    });
    const [, resetResult] = await Promise.all([
        context.queueActivityWrite({ set: { 'rx_act:rx_search_history': '["queued"]' }, remove: [] }),
        context.queueReset(),
    ]);
    assert.equal(stored.rx_settings, undefined, 'reset left settings behind');
    assert.equal(stored['rx_act:rx_watch_history'], undefined, 'reset left activity behind');
    assert.equal(stored.rx_rant_stats_mirror, undefined, 'reset left rant history behind');
    assert.equal(stored.rx_pending_local_data_op.source, 'reset', 'reset left an older pending operation behind');
    assert.equal(stored.rx_pending_local_data_op.clear, true, 'reset did not stage the page-origin clear');
    assert.equal(stored.rx_pending_local_data_op.allTrustedOrigins, true,
        'reset page cleanup does not cover closed Rumble subdomains');
    assert.equal(stored.rx_settings_profiles, undefined, 'reset left profiles behind');
    assert.equal(stored.rx_probe_cache, undefined, 'reset left disposable caches behind');
    assert.equal(stored.rx_activity_meta.version, 1, 'reset discarded the migration marker');
    assert.deepEqual(stored.rx_activity_meta.origins, ['https://rumble.com'],
        'reset discarded the list of already migrated origins');
    assert.deepEqual(stored.rx_activity_meta.pageBaselines, {},
        'reset retained private page-origin activity inside migration baselines');
    assert.equal(resetResult.activityCleared, 3, 'reset did not report every dynamic activity key');
    assert.equal(Object.hasOwn(resetResult.snapshot, 'snapshot'), false,
        'reset returned the complete snapshot over extension messaging');
    assert.equal(Object.hasOwn(resetResult.snapshot, 'snapshots'), false,
        'reset returned the complete retained history over extension messaging');
    const resetSnapshot = stored.rx_settings_snapshots.find((entry) => entry.at === resetResult.snapshot.at);
    assert.equal(resetSnapshot.activity['rx_act:rx_search_history'], '["queued"]',
        'reset snapshot missed an activity write queued before it');
    assert.deepEqual(resetSnapshot.profiles[0].settings, { portable: 'profile' },
        'reset snapshot did not capture profiles');
    assert.deepEqual(resetSnapshot.resetData.rx_archive_queue, { jobs: [{ id: 'archive-1' }] },
        'reset snapshot did not capture recovery data');

    stored['rx_act:rx_imported_only'] = 'true';
    stored.rx_pending_local_data_op = { id: 'new-op', operation: 'clear' };
    const restored = await context.queueRestore(resetResult.snapshot.at);
    assert.equal(restored.ok, true, 'reset snapshot did not restore');
    assert.equal(stored.rx_settings.portable, 'before-reset');
    assert.equal(stored['rx_act:rx_watch_history'], '[{"id":"kept"}]');
    assert.equal(stored['rx_act:rx_imported_only'], undefined,
        'restore did not remove activity absent from the snapshot');
    assert.equal(stored.rx_pending_local_data_op.id, 'old-op',
        'restore did not replace a pending operation exactly');
    assert.equal(stored.rx_settings_profiles[0].id, 'work');
    assert.equal(stored.rx_archive_queue.jobs[0].id, 'archive-1');

    replaceStored({
        rx_settings: { backupHistory: true, backupHistoryLimit: 10, portable: 'profile-race' },
        rx_settings_snapshots: [],
        rx_settings_profiles: [],
    });
    const [savedProfile, profileReset] = await Promise.all([
        context.queueProfileSave('Queued before reset'),
        context.queueReset(),
    ]);
    assert.equal(savedProfile.ok, true);
    const profileResetSnapshot = stored.rx_settings_snapshots
        .find((entry) => entry.at === profileReset.snapshot.at);
    assert.equal(profileResetSnapshot.profiles[0].id, savedProfile.id,
        'reset raced a profile save and snapshotted an older profile list');
    await context.queueRestore(profileReset.snapshot.at);
    assert.equal(stored.rx_settings_profiles[0].id, savedProfile.id,
        'restoring the reset snapshot did not recover the queued profile');

    console.log('Settings write contract OK: settings, activity, snapshots, reset, and restore share one recoverable queue.');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
