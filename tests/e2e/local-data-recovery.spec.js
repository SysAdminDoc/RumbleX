// @ts-check
// Regression coverage for no-open-Rumble-tab import/reset localStorage recovery.
const { test, expect } = require('./_fixtures');

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
    await options.evaluate(() => chrome.storage.local.set({
        rx_rant_stats_mirror: { videos: { v1: { title: 'Seeded', lastTs: 1 } } },
    }));
    expect(await options.evaluate(async () => {
        const got = await chrome.storage.local.get('rx_rant_stats_mirror');
        return Boolean(got.rx_rant_stats_mirror);
    })).toBe(true);

    await options.click('#reset-btn');
    await expect(options.locator('#status')).toContainText(/cleared/i, { timeout: 15000 });

    await expect.poll(
        () => rumble.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('rx_'))),
        { message: 'Reset All Data left rx_ keys in Rumble-origin localStorage', timeout: 15000 },
    ).toEqual([]);

    await expect.poll(
        () => options.evaluate(async () => {
            const got = await chrome.storage.local.get('rx_rant_stats_mirror');
            return got.rx_rant_stats_mirror ?? null;
        }),
        { message: 'Reset All Data left the rant mirror in extension storage', timeout: 15000 },
    ).toBeNull();

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
