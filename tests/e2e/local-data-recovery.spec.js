// @ts-check
// Regression coverage for no-open-Rumble-tab import/reset localStorage recovery.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

test('staged per-site data restores and clears on the next Rumble tab', async ({ context, extensionId, serviceWorker }) => {
    const payload = {
        rx_watch_progress: '{"video-a":{"time":42}}',
        rx_rants_video_a: '{"items":[{"amount":5}]}',
    };

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);

    const staged = await options.evaluate((data) => new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'setLocalData', data }, resolve);
    }), payload);
    expect(staged).toMatchObject({ ok: true, tabs: 0, written: 0, pending: true, pendingKeys: 2 });

    await context.route('https://rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html><head><title>Rumble fixture</title></head><body><main><video></video></main></body></html>',
    }));

    const rumble = await context.newPage();
    await rumble.goto('https://rumble.com/vtest-local-data');
    await expect.poll(() => rumble.evaluate(() => localStorage.getItem('rx_watch_progress'))).toBe(payload.rx_watch_progress);
    await expect.poll(() => serviceWorker.evaluate(() => new Promise((resolve) => {
        chrome.storage.local.get('rx_pending_local_data_op', (got) => resolve(Boolean(got.rx_pending_local_data_op)));
    }))).toBe(false);

    await rumble.close();

    const clear = await options.evaluate(() => new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'clearLocalData' }, resolve);
    }));
    expect(clear).toMatchObject({ ok: true, tabs: 0, cleared: 0, pendingClear: true });

    const reopened = await context.newPage();
    await reopened.goto('https://rumble.com/vtest-local-data-clear');
    await expect.poll(() => reopened.evaluate(() => localStorage.getItem('rx_watch_progress'))).toBe(null);
    await expect.poll(() => serviceWorker.evaluate(() => new Promise((resolve) => {
        chrome.storage.local.get('rx_pending_local_data_op', (got) => resolve(Boolean(got.rx_pending_local_data_op)));
    }))).toBe(false);
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
    await rumble.evaluate((data) => {
        for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
    }, seeded);
    // Guard against a vacuous pass: the wipe has to have something to remove.
    expect(await rumble.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('rx_')).sort()))
        .toEqual(Object.keys(seeded).sort());

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
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

test('reset aborts and preserves settings when the pre-reset snapshot fails', async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);

    const marker = { adNuker: false, schemaVersion: 2 };
    await options.evaluate((seed) => new Promise((resolve) => {
        chrome.storage.local.set({ rx_settings: seed }, resolve);
    }), marker);

    // The reset button has no confirmation dialog by design: the pre-reset
    // snapshot is the undo. Make capturing it fail and the wipe must not run.
    await options.evaluate(() => {
        const realSet = chrome.storage.local.set.bind(chrome.storage.local);
        chrome.storage.local.set = (items, cb) => {
            if (items && Object.prototype.hasOwnProperty.call(items, 'rx_settings_snapshots')) {
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
    await rumble.evaluate((data) => {
        for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
    }, perSite);

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
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
    await expect.poll(() => rumble.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('rx_'))))
        .toEqual([]);
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
            () => rumble.evaluate((k) => localStorage.getItem(k), key),
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

    await expect.poll(() => rumble.evaluate(() => localStorage.getItem('rx_bookmarks')))
        .toBe(legacy.localData.rx_bookmarks);
    expect(await options.evaluate(async () => {
        const got = await chrome.storage.local.get('rx_settings');
        return got.rx_settings?.theaterSplit;
    })).toBe(false);

    fs.rmSync(legacyPath, { force: true });
});
