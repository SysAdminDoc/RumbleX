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
