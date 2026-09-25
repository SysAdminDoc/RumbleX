// @ts-check
// Regression coverage for no-open-Rumble-tab import/reset of per-site activity,
// which the extension keeps in extension storage (rx_act:) rather than in
// rumble.com's localStorage.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

// Where the extension keeps per-site activity since it moved out of
// rumble.com's localStorage: one extension-storage key per item.
const ACTIVITY = 'rx_act:';
const readActivity = (page, key) => page.evaluate(async (storageKey) => {
    const got = await chrome.storage.local.get(storageKey);
    return got[storageKey] ?? null;
}, ACTIVITY + key);
const activityLeft = (page) => page.evaluate(async (prefix) => Object.keys(await chrome.storage.local.get(null))
    .filter((key) => key.startsWith(prefix)), ACTIVITY);
const seedActivity = (page, data) => page.evaluate(({ prefix, entries }) => chrome.storage.local.set(
    Object.fromEntries(Object.entries(entries).map(([key, value]) => [prefix + key, value])),
), { prefix: ACTIVITY, entries: data });
// The content script loads the store once and then follows it through
// storage.onChanged; wait until an open tab can see what was seeded.
const tabSees = (options, count) => expect.poll(() => options.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: ['*://rumble.com/*'] });
    const state = await chrome.tabs.sendMessage(tab.id, { action: 'getActivityStore' });
    return state?.keys || 0;
})).toBeGreaterThanOrEqual(count);

test('central activity restore cleans each Rumble origin on first open and reset reuses the durable barrier', async ({ context, extensionId, serviceWorker }) => {
    const payload = {
        rx_watch_progress: '{"video-a":{"time":42}}',
        rx_rants_video_a: '{"items":[{"amount":5}]}',
    };

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);

    const staged = await options.evaluate((data) => new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'setLocalData', data }, resolve);
    }), payload);
    expect(staged).toMatchObject({ ok: true, tabs: 0, written: 2, pending: true, pendingKeys: 2 });

    await context.route('https://rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>Rumble fixture</title></head><body><main><video></video></main></body></html>',
    }));

    const rumble = await context.newPage();
    await rumble.goto('https://rumble.com/vtest-local-data');
    await expect.poll(() => readActivity(options, 'rx_watch_progress')).toBe(payload.rx_watch_progress);
    expect(await rumble.evaluate(() => localStorage.getItem('rx_watch_progress'))).toBe(null);
    await expect.poll(() => serviceWorker.evaluate(() => new Promise((resolve) => {
        chrome.storage.local.get('rx_pending_local_data_op', (got) => resolve(
            got.rx_pending_local_data_op?.completedOrigins || [],
        ));
    }))).toContain('https://rumble.com');

    await rumble.close();

    const clear = await options.evaluate(() => new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'resetSettings' }, resolve);
    }));
    expect(clear).toMatchObject({ success: true, tabs: 0, cleared: 0, pendingClear: true });

    const reopened = await context.newPage();
    await reopened.goto('https://rumble.com/vtest-local-data-clear');
    await expect.poll(() => activityLeft(options)).toEqual([]);
    await expect.poll(() => serviceWorker.evaluate(() => new Promise((resolve) => {
        chrome.storage.local.get('rx_pending_local_data_op', (got) => resolve(
            got.rx_pending_local_data_op?.completedOrigins || [],
        ));
    }))).toContain('https://rumble.com');

    await context.addInitScript(() => {
        if (location.hostname === 'studio.rumble.com') {
            localStorage.setItem('rx_watch_history', '[{"id":"stale-studio-copy"}]');
        }
    });
    await context.route('https://studio.rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>Studio fixture</title></head><body><main></main></body></html>',
    }));
    const studio = await context.newPage();
    await studio.goto('https://studio.rumble.com/dashboard');
    await expect.poll(() => studio.evaluate(() => localStorage.getItem('rx_watch_history'))).toBe(null);
    await expect.poll(() => serviceWorker.evaluate(() => new Promise((resolve) => {
        chrome.storage.local.get('rx_pending_local_data_op', (got) => resolve(
            got.rx_pending_local_data_op?.completedOrigins || [],
        ));
    }))).toContain('https://studio.rumble.com');
});

test('service-worker startup finishes interrupted reset storage without an open Rumble tab', async ({ context, extensionId, serviceWorker }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const result = await serviceWorker.evaluate(async () => {
        await rxSettingsWriteChain.catch(() => {});
        await chrome.storage.local.set({
            rx_settings: { backupHistory: true, wideLayout: false },
            rx_popup_ui: { tab: 'quick' },
            rx_probe_cache: { stale: true },
            rx_settings_profiles: [{ id: 'stale-profile' }],
            rx_archive_queue: { jobs: [{ id: 'stale-job', status: 'pending' }] },
            rx_download_diagnostics: [{ id: 'stale-diagnostic' }],
            rx_download_recovery: { jobs: [{ downloadId: 91 }] },
            rx_welcome_seen: true,
            'rx_act:rx_watch_history': '[{"id":"stale-history"}]',
            rx_activity_generation: 7,
            rx_settings_generation: 5,
            rx_pending_local_data_op: {
                id: 'interrupted-reset',
                source: 'reset',
                createdAt: Date.now(),
                clear: true,
                data: null,
                keyCount: 0,
                targetOrigins: ['https://rumble.com', 'https://www.rumble.com'],
                remainingOrigins: ['https://rumble.com', 'https://www.rumble.com'],
                allTrustedOrigins: true,
                completedOrigins: [],
                extensionApplied: false,
                archiveHandleApplied: true,
                activityGeneration: 7,
                settingsGeneration: 5,
            },
        });
        rxPendingResetStartupRecovery = null;
        const replay = await rxEnsurePendingResetStartupRecovery();
        return { replay, stored: await chrome.storage.local.get(null) };
    });

    expect(result.replay).toMatchObject({ ok: true, replayed: true, generation: 7 });
    for (const key of [
        'rx_settings',
        'rx_popup_ui',
        'rx_probe_cache',
        'rx_settings_profiles',
        'rx_archive_queue',
        'rx_download_diagnostics',
        'rx_download_recovery',
        'rx_welcome_seen',
        'rx_act:rx_watch_history',
    ]) {
        expect(result.stored[key], key).toBeUndefined();
    }
    expect(result.stored.rx_activity_generation).toBe(7);
    expect(result.stored.rx_settings_generation).toBe(5);
    expect(result.stored.rx_pending_local_data_op).toMatchObject({
        id: 'interrupted-reset',
        extensionApplied: true,
        archiveHandleApplied: true,
        allTrustedOrigins: true,
    });
});

test('a delayed rant mirror write cannot recreate history after clear', async ({ context, extensionId, serviceWorker }) => {
    await context.route('https://rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>Rant reset fixture</title></head><body><main><video></video><div id="chat-history-list"></div></main></body></html>',
    }));
    const rumble = await context.newPage();
    await rumble.goto('https://rumble.com/vrant-reset');
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);

    await serviceWorker.evaluate(() => {
        globalThis.__rxOriginalSendTabMessage = rxSendTabMessage;
        rxSendTabMessage = async (...args) => {
            await new Promise((resolve) => setTimeout(resolve, 1_800));
            return globalThis.__rxOriginalSendTabMessage(...args);
        };
    });
    try {
        await rumble.evaluate(() => {
            const row = document.createElement('div');
            row.className = 'chat-history--rant';
            row.dataset.level = '5';
            row.innerHTML = '<span class="chat-history--username">Late</span>'
                + '<span class="chat-history--rant-price">$5</span>'
                + '<span class="chat-history--message">stale</span>';
            document.querySelector('#chat-history-list').appendChild(row);
        });
        await expect.poll(() => readActivity(options, 'rx_rants_vrant')).not.toBe(null);
        const clear = await options.evaluate(() => new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'clearRantMirror' }, resolve);
        }));
        expect(clear).toMatchObject({ ok: true });
        await rumble.waitForTimeout(1_900);
        const mirror = await options.evaluate(async () => {
            const got = await chrome.storage.local.get('rx_rant_stats_mirror');
            return got.rx_rant_stats_mirror || { videos: {} };
        });
        expect(mirror.videos?.vrant).toBeUndefined();
    } finally {
        await serviceWorker.evaluate(() => {
            if (globalThis.__rxOriginalSendTabMessage) {
                rxSendTabMessage = globalThis.__rxOriginalSendTabMessage;
                delete globalThis.__rxOriginalSendTabMessage;
            }
        });
    }
});

test('Reset All Data clears every rx_ key the runtime writes', async ({ context, extensionId }) => {
    // One value per storage location the content runtime owns: the six named
    // localStorage keys, one per-video rant archive matching the prefix, and
    // the extension-storage rant mirror the options page has to drop itself.
    // rx_channel_prefs and rx_rant_stats_mirror both used to survive a reset
    // that reported "All settings cleared".
    const seeded = {
        rx_volume: '0.55',
        rx_watch_progress: '{"v1":{"time":42}}',
        rx_watch_history: '[{"id":"v1"}]',
        rx_search_history: '["cats"]',
        rx_bookmarks: '[{"id":"v1","t":12}]',
        rx_channel_prefs: '{"bongino":{"volume":0.4,"speed":1.5}}',
        rx_rants_v1: '{"items":[{"amount":5}]}',
    };

    await context.route('https://rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>Rumble fixture</title></head><body><main><video></video></main></body></html>',
    }));

    const rumble = await context.newPage();
    await rumble.goto('https://rumble.com/vtest-reset-all');

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await seedActivity(options, seeded);
    // A stray copy in the page itself, the kind a tab running older code can
    // leave after the move. The reset has to take it too.
    await rumble.evaluate(() => localStorage.setItem('rx_search_history', '["stray page copy"]'));
    // Guard against a vacuous pass: the wipe has to have something to remove.
    expect((await activityLeft(options)).sort()).toEqual(Object.keys(seeded).map((key) => ACTIVITY + key).sort());
    await tabSees(options, Object.keys(seeded).length);
    // Extension-storage records, including the five the service worker owns.
    // The registry and its guard only ever scanned the content scripts, so
    // those five survived a wipe the options page called complete.
    const extensionSeeded = {
        rx_rant_stats_mirror: { videos: { v1: { title: 'Seeded', lastTs: 1 } } },
        rx_probe_cache: { 'probe:https://example.invalid/a.mp4': { ok: true } },
        rx_settings_profiles: [{ id: 'p1', name: 'Seeded profile', settings: {} }],
        rx_archive_queue: [{ id: 'job-1', url: 'https://rumble.com/v1-a.html' }],
        rx_download_diagnostics: [{ id: 'd1', stage: 'probe' }],
        rx_download_recovery: { 'job-1': { resumeAt: 5 } },
        rx_welcome_seen: true,
    };
    await options.evaluate((seed) => chrome.storage.local.set(seed), extensionSeeded);
    expect(await options.evaluate(async (keys) => {
        const got = await chrome.storage.local.get(keys);
        return keys.filter((key) => got[key] === undefined);
    }, Object.keys(extensionSeeded))).toEqual([]);

    await options.click('#reset-btn');
    await expect(options.locator('#status')).toContainText(/cleared/i, { timeout: 15000 });

    await expect.poll(
        () => activityLeft(options),
        { message: 'Reset All Data left activity in extension storage', timeout: 15000 },
    ).toEqual([]);
    await expect.poll(
        () => rumble.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('rx_'))),
        { message: 'Reset All Data left rx_ keys in Rumble-origin localStorage', timeout: 15000 },
    ).toEqual([]);

    await expect.poll(
        () => options.evaluate(async (keys) => {
            const got = await chrome.storage.local.get(keys);
            return keys.filter((key) => got[key] !== undefined);
        }, Object.keys(extensionSeeded)),
        { message: 'Reset All Data left extension-storage records behind', timeout: 15000 },
    ).toEqual([]);

    // The pre-reset snapshot is the undo and must survive its own reset.
    expect(await options.evaluate(async () => {
        const got = await chrome.storage.local.get('rx_settings_snapshots');
        return Array.isArray(got.rx_settings_snapshots) && got.rx_settings_snapshots.length > 0;
    })).toBe(true);
});

test('reset aborts and preserves settings when the pre-reset snapshot fails', async ({ context, extensionId, serviceWorker }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);

    const marker = { adNuker: false, schemaVersion: 4, backupHistory: true, backupHistoryLimit: 10 };
    await options.evaluate((seed) => new Promise((resolve) => {
        chrome.storage.local.set({ rx_settings: seed }, resolve);
    }), marker);

    // The reset button has no confirmation dialog by design: the pre-reset
    // snapshot is the undo. Make capturing it fail and the wipe must not run.
    await serviceWorker.evaluate(() => {
        const realSet = chrome.storage.local.set.bind(chrome.storage.local);
        chrome.storage.local.set = async (items, cb) => {
            if (items && Object.prototype.hasOwnProperty.call(items, 'rx_settings_snapshots')) {
                chrome.storage.local.set = realSet;
                throw new Error('snapshot storage unavailable');
            }
            return realSet(items, cb);
        };
    });

    await options.locator('#reset-btn').click();
    await expect(options.locator('#status')).toContainText('Reset cancelled', { timeout: 10_000 });

    const after = await options.evaluate(() => new Promise((resolve) => {
        chrome.storage.local.get('rx_settings', (got) => resolve(got.rx_settings));
    }));
    expect(after).toMatchObject({ adNuker: false });
});

test('Undo reset restores settings, dynamic activity, profiles, recovery data, and the prior pending operation', async ({ context, extensionId, serviceWorker }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const seed = {
        rx_settings: { schemaVersion: 4, backupHistory: true, backupHistoryLimit: 10, wideLayout: false },
        'rx_act:rx_watch_history': '[{"id":"before-reset"}]',
        'rx_act:rx_bookmarks': '[{"id":"saved"}]',
        rx_rant_stats_mirror: { videos: { vundo: { title: 'Undo me', lastTs: 1 } } },
        rx_pending_local_data_op: { id: 'prior-op', source: 'import', data: { rx_search_history: '["old"]' }, keyCount: 1 },
        rx_settings_profiles: [{ id: 'p_undo', name: 'Undo', createdAt: 1, settings: { wideLayout: true } }],
        rx_archive_queue: { jobs: [{ id: 'archive-undo' }] },
        rx_download_diagnostics: [{ id: 'diagnostic-undo' }],
        rx_download_recovery: {
            version: 1,
            networkStatus: 'online',
            lastTransitionAt: null,
            jobs: [],
        },
        rx_welcome_seen: true,
    };
    await serviceWorker.evaluate(async () => {
        await rxNetworkTransitionQueue.catch(() => {});
        await rxSettingsWriteChain.catch(() => {});
    });
    await options.evaluate((values) => chrome.storage.local.set(values), seed);

    await options.locator('#reset-btn').click();
    await expect(options.locator('#status .status-action')).toHaveText('Undo reset', { timeout: 15_000 });
    await options.evaluate(() => chrome.storage.local.set({
        'rx_act:rx_imported_only': 'true',
        rx_pending_local_data_op: { id: 'new-clear', source: 'reset', clear: true, keyCount: 0 },
    }));
    await options.locator('#status .status-action').click();
    await expect(options.locator('#status')).toContainText('Reset undone.', { timeout: 15_000 });

    const restored = await options.evaluate(() => chrome.storage.local.get(null));
    expect(restored.rx_settings.wideLayout).toBe(false);
    expect(restored['rx_act:rx_watch_history']).toBe(seed['rx_act:rx_watch_history']);
    expect(restored['rx_act:rx_bookmarks']).toBe(seed['rx_act:rx_bookmarks']);
    expect(restored['rx_act:rx_imported_only']).toBeUndefined();
    expect(restored.rx_rant_stats_mirror).toEqual(seed.rx_rant_stats_mirror);
    expect(restored.rx_pending_local_data_op.id).toBe('prior-op');
    expect(restored.rx_settings_profiles).toEqual([
        expect.objectContaining({
            id: 'p_undo',
            name: 'Undo',
            createdAt: 1,
            settings: expect.objectContaining({ wideLayout: true }),
        }),
    ]);
    expect(restored.rx_archive_queue).toEqual(seed.rx_archive_queue);
    expect(restored.rx_download_diagnostics).toEqual(seed.rx_download_diagnostics);
    expect(restored.rx_download_recovery).toEqual(seed.rx_download_recovery);
    expect(restored.rx_welcome_seen).toBe(true);
});

test('Undo import works without a Rumble tab and removes imported-only activity', async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const before = {
        rx_settings: { schemaVersion: 4, backupHistory: true, backupHistoryLimit: 10, wideLayout: false },
        'rx_act:rx_watch_history': '[{"id":"before-import"}]',
        rx_rant_stats_mirror: { videos: { vbefore: { title: 'Before', lastTs: 1 } } },
    };
    await options.evaluate((values) => chrome.storage.local.set(values), before);
    const importPath = path.join(os.tmpdir(), `rumblex-undo-import-${Date.now()}.json`);
    fs.writeFileSync(importPath, JSON.stringify({
        exportVersion: 3,
        settings: { wideLayout: true },
        localData: { rx_bookmarks: '[{"id":"imported"}]' },
        extensionData: { rx_rant_stats_mirror: { videos: { vimported: { title: 'Imported', lastTs: 2 } } } },
    }));
    try {
        await options.setInputFiles('#import-file', importPath);
        await expect(options.locator('#status .status-action')).toHaveText('Undo import', { timeout: 30_000 });
        expect((await options.evaluate(() => chrome.storage.local.get('rx_pending_local_data_op'))).rx_pending_local_data_op)
            .toBeTruthy();
        await options.locator('#status .status-action').click();
        await expect(options.locator('#status')).toContainText('Import undone.', { timeout: 15_000 });
        const restored = await options.evaluate(() => chrome.storage.local.get(null));
        expect(restored.rx_settings.wideLayout).toBe(false);
        expect(restored['rx_act:rx_watch_history']).toBe(before['rx_act:rx_watch_history']);
        expect(restored['rx_act:rx_bookmarks']).toBeUndefined();
        expect(restored.rx_rant_stats_mirror).toEqual(before.rx_rant_stats_mirror);
        expect(restored.rx_pending_local_data_op).toMatchObject({
            source: 'snapshot-restore',
            clear: true,
            allTrustedOrigins: true,
            extensionApplied: true,
            activityGeneration: expect.any(Number),
        });
    } finally {
        fs.rmSync(importPath, { force: true });
    }
});

test('a backup round-trips every kind of user activity, not just settings', async ({ context, extensionId }) => {
    // Export had been documented as settings-only. It is not: per-site data has
    // gone through getLocalData since v2. What it missed was extension-storage
    // activity, so the rant mirror never survived a wipe. This drives the real
    // Export and Import controls end to end and compares field by field.
    const perSite = {
        rx_volume: '0.42',
        rx_watch_progress: '{"v1":{"time":1234}}',
        rx_watch_history: '[{"id":"v1","title":"Seeded history"}]',
        rx_search_history: '["round trip"]',
        rx_bookmarks: '[{"id":"v1","t":99}]',
        rx_channel_prefs: '{"seeded":{"volume":0.31,"speed":1.75}}',
        rx_rants_v1: '{"items":[{"amount":42}]}',
    };
    const rantMirror = { videos: { v1: { title: 'Seeded rant video', lastTs: 1700000000000, read: false } } };

    await context.route('https://rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>Rumble fixture</title></head><body><main><video></video></main></body></html>',
    }));

    const rumble = await context.newPage();
    await rumble.goto('https://rumble.com/vtest-round-trip');

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await seedActivity(options, perSite);
    await tabSees(options, Object.keys(perSite).length);
    await options.evaluate((mirror) => chrome.storage.local.set({ rx_rant_stats_mirror: mirror }), rantMirror);

    // Export with a Rumble tab open, so per-site data is reachable.
    const [download] = await Promise.all([
        options.waitForEvent('download', { timeout: 30000 }),
        options.click('#export-btn'),
    ]);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const raw = fs.readFileSync(filePath);
    const text = download.suggestedFilename().endsWith('.gz')
        ? zlib.gunzipSync(raw).toString('utf8')
        : raw.toString('utf8');
    const payload = JSON.parse(text);

    expect(payload.exportVersion).toBeGreaterThanOrEqual(3);
    expect(payload.localData).toMatchObject(perSite);
    expect(payload.extensionData?.rx_rant_stats_mirror).toEqual(rantMirror);
    // Credentials stay out unless explicitly opted in.
    expect(payload.settings).not.toHaveProperty('discordWebhookUrl');
    expect(payload.settings).not.toHaveProperty('encryptedGistSyncToken');

    // Wipe everything the backup is supposed to be able to restore.
    await options.click('#reset-btn');
    await expect(options.locator('#status')).toContainText(/cleared/i, { timeout: 15000 });
    await expect.poll(() => activityLeft(options)).toEqual([]);
    await expect.poll(() => options.evaluate(async () => {
        const got = await chrome.storage.local.get('rx_rant_stats_mirror');
        return got.rx_rant_stats_mirror ?? null;
    })).toBeNull();

    // Restore from the exported file through the real import control.
    const restorePath = path.join(os.tmpdir(), `rumblex-roundtrip-${Date.now()}.json`);
    fs.writeFileSync(restorePath, text);
    await options.setInputFiles('#import-file', restorePath);
    await expect(options.locator('#status')).toContainText(/imported/i, { timeout: 30000 });

    for (const [key, value] of Object.entries(perSite)) {
        await expect.poll(
            () => readActivity(options, key),
            { message: `per-site key ${key} did not survive the round trip`, timeout: 15000 },
        ).toBe(value);
    }
    await expect.poll(
        () => options.evaluate(async () => {
            const got = await chrome.storage.local.get('rx_rant_stats_mirror');
            return got.rx_rant_stats_mirror ?? null;
        }),
        { message: 'the rant mirror did not survive the round trip', timeout: 15000 },
    ).toEqual(rantMirror);

    fs.rmSync(restorePath, { force: true });
});

test('a version 2 backup written before extensionData existed still restores', async ({ context, extensionId }) => {
    const legacy = {
        settings: { darkEnhance: true, theaterSplit: false },
        localData: { rx_bookmarks: '[{"id":"legacy","t":7}]' },
        exportVersion: 2,
        exportDate: '2026-08-01T00:00:00.000Z',
        rumblexVersion: '3.52.0',
    };

    await context.route('https://rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>Rumble fixture</title></head><body><main><video></video></main></body></html>',
    }));
    const rumble = await context.newPage();
    await rumble.goto('https://rumble.com/vtest-legacy-import');

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);

    const legacyPath = path.join(os.tmpdir(), `rumblex-legacy-${Date.now()}.json`);
    fs.writeFileSync(legacyPath, JSON.stringify(legacy));
    await options.setInputFiles('#import-file', legacyPath);
    await expect(options.locator('#status')).toContainText(/imported/i, { timeout: 30000 });

    await expect.poll(() => readActivity(options, 'rx_bookmarks'))
        .toBe(legacy.localData.rx_bookmarks);
    expect(await options.evaluate(async () => {
        const got = await chrome.storage.local.get('rx_settings');
        return got.rx_settings?.theaterSplit;
    })).toBe(false);

    fs.rmSync(legacyPath, { force: true });
});
