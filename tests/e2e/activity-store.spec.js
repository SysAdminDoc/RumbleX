// @ts-check
// Activity (watch progress, history, bookmarks, rant archives and the rest)
// moves out of rumble.com's localStorage into extension storage, once, safely,
// and stays there when the site's own data is cleared.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'platform', 'offline-watch.html'), 'utf8');
const PAGE = 'https://rumble.com/vactivity-fixture.html';

const PROGRESS = JSON.stringify({ vactivity: { t: 321, d: 900, ts: 1_700_000_000_000 } });
const BOOKMARKS = JSON.stringify([{ url: 'https://rumble.com/vbookmark-one.html', title: 'Bookmarked', ts: 1_700_000_000_000 }]);
const RANTS = JSON.stringify([{ user: 'Supporter', price: '$5', level: 3, text: 'hi', ts: 1_700_000_000_000 }]);
const SEEDED = { rx_watch_progress: PROGRESS, rx_bookmarks: BOOKMARKS, rx_rants_vseeded: RANTS };
// The fixture page carries a rant in its chat, so Rant Persist keeps its own
// archive for the video on screen. That is the store working, not the move,
// and the comparisons leave it out.
const LIVE_ARCHIVE = 'rx_rants_vactivity';

async function openRumble(context, url = PAGE) {
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const request = route.request();
        if (request.isNavigationRequest() && /^https:\/\/(?:www\.)?rumble\.com\//.test(request.url())) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });
    return page;
}

async function reload(page) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });
}

const storage = (serviceWorker, keys = null) => serviceWorker.evaluate((k) => chrome.storage.local.get(k), keys);
const activityKeys = async (serviceWorker) => Object.fromEntries(Object.entries(await storage(serviceWorker))
    .filter(([key]) => key.startsWith('rx_act:') && key !== 'rx_act:' + LIVE_ARCHIVE));

const tabIdOf = (serviceWorker, page) => serviceWorker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
    if (!tab?.id) throw new Error('fixture tab not found');
    return tab.id;
}, page.url());

// The page's own storage: every rx_ key it still holds, and one key of
// Rumble's that the move must never touch.
const pageStorage = (page) => page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).filter((key) => (key.startsWith('rx_') && key !== 'rx_rants_vactivity') || key === 'rumble_own_key')
        .map((key) => [key, localStorage.getItem(key)]),
));

// Holds the store in page storage so a test can plant legacy data before the
// move runs, the way an existing install carries it.
async function plantLegacy(context, serviceWorker, extra = {}) {
    await serviceWorker.evaluate(() => chrome.storage.local.set({ rx_activity_meta: { version: 0, hold: true } }));
    const page = await openRumble(context);
    await page.evaluate((entries) => {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
    }, { ...SEEDED, rumble_own_key: 'belongs to rumble', ...extra });
    return page;
}

test('activity moves into extension storage once and survives clearing the site\'s data', async ({ context, serviceWorker }) => {
    const page = await plantLegacy(context, serviceWorker);
    await serviceWorker.evaluate(() => chrome.storage.local.remove('rx_activity_meta'));
    await reload(page);

    // Every key copied exactly, the version recorded, the snapshot kept.
    const copies = await activityKeys(serviceWorker);
    expect(copies).toEqual({
        'rx_act:rx_watch_progress': PROGRESS,
        'rx_act:rx_bookmarks': BOOKMARKS,
        'rx_act:rx_rants_vseeded': RANTS,
    });
    const stored = await storage(serviceWorker, ['rx_activity_meta', 'rx_activity_premigration']);
    expect(stored.rx_activity_premigration.data).toMatchObject(SEEDED);
    expect(stored.rx_activity_meta).toMatchObject({
        version: 1,
        keys: Object.keys(stored.rx_activity_premigration.data).length,
    });
    // The page copies are gone; Rumble's own key is untouched.
    expect(await pageStorage(page)).toEqual({ rumble_own_key: 'belongs to rumble' });

    // Features read the moved data.
    const read = await serviceWorker.evaluate(async (id) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: () => ({ mode: RxActivity.mode, progress: WatchProgress._getStore() }),
        });
        return execution.result;
    }, await tabIdOf(serviceWorker, page));
    expect(read).toEqual({ mode: 'extension', progress: JSON.parse(PROGRESS) });

    // A write lands in extension storage, not in the page.
    await serviceWorker.evaluate(async (id) => {
        await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: () => {
                const store = WatchProgress._getStore();
                store.vnewer = { t: 10, d: 100, ts: 1_700_000_100_000 };
                WatchProgress._saveStore(store);
            },
        });
    }, await tabIdOf(serviceWorker, page));
    await expect.poll(async () => JSON.parse((await storage(serviceWorker, 'rx_act:rx_watch_progress'))['rx_act:rx_watch_progress']).vnewer)
        .toEqual({ t: 10, d: 100, ts: 1_700_000_100_000 });
    expect(await pageStorage(page)).toEqual({ rumble_own_key: 'belongs to rumble' });

    // Clearing everything Rumble's origin holds takes nothing of RumbleX's.
    await page.evaluate(() => localStorage.clear());
    await context.clearCookies();
    await reload(page);
    const after = await serviceWorker.evaluate(async (id) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: () => Object.keys(WatchProgress._getStore()).sort(),
        });
        return execution.result;
    }, await tabIdOf(serviceWorker, page));
    expect(after).toEqual(['vactivity', 'vnewer']);
    // And the move does not run a second time over the empty page store.
    expect((await storage(serviceWorker, 'rx_activity_meta')).rx_activity_meta).toMatchObject({ version: 1, keys: stored.rx_activity_meta.keys });
});

test('a move interrupted before it committed starts over from the page copies', async ({ context, serviceWorker }) => {
    const page = await plantLegacy(context, serviceWorker);
    // What a tab closing mid-move leaves: a stale partial copy, no version.
    await serviceWorker.evaluate(() => chrome.storage.local.set({
        'rx_act:rx_watch_progress': '{"stale":true}',
        rx_activity_premigration: { at: 1, version: 1, data: {} },
    }));
    await serviceWorker.evaluate(() => chrome.storage.local.remove('rx_activity_meta'));
    await reload(page);
    expect(await activityKeys(serviceWorker)).toEqual({
        'rx_act:rx_watch_progress': PROGRESS,
        'rx_act:rx_bookmarks': BOOKMARKS,
        'rx_act:rx_rants_vseeded': RANTS,
    });
    expect((await storage(serviceWorker, 'rx_activity_premigration')).rx_activity_premigration.data).toMatchObject(SEEDED);
    expect(await pageStorage(page)).toEqual({ rumble_own_key: 'belongs to rumble' });
});

test('a move interrupted after it committed keeps the real copies and adopts what only the page holds', async ({ context, serviceWorker }) => {
    const page = await plantLegacy(context, serviceWorker, { rx_watch_progress: '{"stale":"page copy"}' });
    // Committed: the version is recorded and the extension copies are the
    // real ones, but the tab closed before the page copies were removed.
    await serviceWorker.evaluate((progress) => chrome.storage.local.set({
        rx_activity_meta: { version: 1, migratedAt: 1, keys: 1, origins: ['https://rumble.com'] },
        'rx_act:rx_watch_progress': progress,
    }), PROGRESS);
    await reload(page);
    // The extension copy of the progress wins over the stale page copy, and
    // the keys only the page held are adopted rather than thrown away.
    expect(await activityKeys(serviceWorker)).toEqual({
        'rx_act:rx_watch_progress': PROGRESS,
        'rx_act:rx_bookmarks': BOOKMARKS,
        'rx_act:rx_rants_vseeded': RANTS,
    });
    expect(await pageStorage(page)).toEqual({ rumble_own_key: 'belongs to rumble' });
});

test('a second Rumble origin merges its legacy collections before deleting them', async ({ context, serviceWorker }) => {
    const first = await plantLegacy(context, serviceWorker);
    await serviceWorker.evaluate(() => chrome.storage.local.remove('rx_activity_meta'));
    await reload(first);

    const secondProgress = JSON.stringify({ vsecond: { t: 45, d: 300, ts: 1_700_000_200_000 } });
    const secondBookmarks = JSON.stringify([{
        url: 'https://rumble.com/vbookmark-two.html',
        title: 'Second origin bookmark',
        ts: 1_700_000_200_000,
    }]);
    const second = await openRumble(context, 'https://www.rumble.com/vactivity-second-origin.html');
    await second.evaluate(({ progress, bookmarks }) => {
        localStorage.setItem('rx_watch_progress', progress);
        localStorage.setItem('rx_bookmarks', bookmarks);
    }, { progress: secondProgress, bookmarks: secondBookmarks });
    await reload(second);

    const copies = await activityKeys(serviceWorker);
    expect(JSON.parse(copies['rx_act:rx_watch_progress'])).toMatchObject({
        vactivity: JSON.parse(PROGRESS).vactivity,
        vsecond: JSON.parse(secondProgress).vsecond,
    });
    expect(JSON.parse(copies['rx_act:rx_bookmarks']).map((entry) => entry.url).sort()).toEqual([
        'https://rumble.com/vbookmark-one.html',
        'https://rumble.com/vbookmark-two.html',
    ]);
    expect(await second.evaluate(() => ({
        progress: localStorage.getItem('rx_watch_progress'),
        bookmarks: localStorage.getItem('rx_bookmarks'),
    }))).toEqual({ progress: null, bookmarks: null });
});

test('a transient activity-storage failure keeps the write dirty and retries it', async ({ context, serviceWorker }) => {
    const page = await plantLegacy(context, serviceWorker);
    await serviceWorker.evaluate(() => chrome.storage.local.remove('rx_activity_meta'));
    await reload(page);
    const payload = JSON.stringify([{ url: 'https://rumble.com/vretry.html', title: 'Retry me', ts: Date.now() }]);

    const result = await serviceWorker.evaluate(async ({ id, value }) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: async (nextValue) => {
                const realSet = chrome.storage.local.set.bind(chrome.storage.local);
                let failed = false;
                chrome.storage.local.set = (items, callback) => {
                    if (!failed && Object.hasOwn(items, 'rx_act:rx_bookmarks')) {
                        failed = true;
                        throw new Error('transient storage failure');
                    }
                    return realSet(items, callback);
                };
                try {
                    RxActivity.setItem('rx_bookmarks', nextValue);
                    const first = await RxActivity.flush();
                    const dirtyAfterFailure = RxActivity._dirty.get('rx_bookmarks');
                    chrome.storage.local.set = realSet;
                    const second = await RxActivity.flush();
                    return { first, second, dirtyAfterFailure, dirtyAfterRetry: RxActivity._dirty.has('rx_bookmarks') };
                } finally {
                    chrome.storage.local.set = realSet;
                }
            },
            args: [value],
        });
        return execution.result;
    }, { id: await tabIdOf(serviceWorker, page), value: payload });

    expect(result).toEqual({
        first: false,
        second: true,
        dirtyAfterFailure: payload,
        dirtyAfterRetry: false,
    });
    await expect.poll(async () => (await storage(serviceWorker, 'rx_act:rx_bookmarks'))['rx_act:rx_bookmarks'])
        .toBe(payload);
});

test('a copy that does not read back identically rolls back and leaves the page copies in charge', async ({ context, serviceWorker }) => {
    const page = await plantLegacy(context, serviceWorker);
    await serviceWorker.evaluate(() => chrome.storage.local.remove('rx_activity_meta'));
    // Drive the move directly with a snapshot whose value changes between the
    // write and the read-back, the shape of a copy corrupted in transit.
    const result = await serviceWorker.evaluate(async (id) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: async () => {
                let reads = 0;
                RxActivity._readPageStore = () => ({
                    rx_bookmarks: localStorage.getItem('rx_bookmarks'),
                    // Different on every read. The snapshot is structured-cloned
                    // into storage before the copy, so a value that settles after
                    // two reads would line up again by the comparison.
                    get rx_watch_progress() { reads += 1; return `value-${reads}`; },
                });
                return RxActivity._migrate();
            },
        });
        return execution.result;
    }, await tabIdOf(serviceWorker, page));
    expect(result).toMatchObject({ ok: false, reason: 'verify', mismatched: ['rx_watch_progress'] });
    expect(await activityKeys(serviceWorker)).toEqual({});
    expect((await storage(serviceWorker, 'rx_activity_meta')).rx_activity_meta).toMatchObject({ version: 0, reason: 'verify' });
    // Nothing was removed from the page.
    expect(await pageStorage(page)).toEqual({ ...SEEDED, rumble_own_key: 'belongs to rumble' });
});

test('rollback restores the pre-migration snapshot and holds the store in the page', async ({ context, serviceWorker, extensionId }) => {
    const page = await plantLegacy(context, serviceWorker);
    await serviceWorker.evaluate(() => chrome.storage.local.remove('rx_activity_meta'));
    await reload(page);
    expect(await pageStorage(page)).toEqual({ rumble_own_key: 'belongs to rumble' });

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const response = await options.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ url: ['*://rumble.com/*'] });
        return chrome.tabs.sendMessage(tab.id, { action: 'rollbackActivityMigration' });
    });
    expect(response.ok).toBe(true);
    expect(response.restored).toBeGreaterThanOrEqual(Object.keys(SEEDED).length);
    expect(await pageStorage(page)).toEqual({ ...SEEDED, rumble_own_key: 'belongs to rumble' });
    expect(await activityKeys(serviceWorker)).toEqual({});
    expect((await storage(serviceWorker, 'rx_activity_meta')).rx_activity_meta).toMatchObject({ version: 0, hold: true });

    // The hold keeps the next load in page storage instead of moving it again.
    await reload(page);
    const state = await options.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ url: ['*://rumble.com/*'] });
        return chrome.tabs.sendMessage(tab.id, { action: 'getActivityStore' });
    });
    expect(state).toMatchObject({ ok: true, mode: 'page' });
    expect(await pageStorage(page)).toEqual({ ...SEEDED, rumble_own_key: 'belongs to rumble' });
});

test('Reset All Data clears moved activity even with no Rumble tab open', async ({ context, serviceWorker, extensionId }) => {
    const page = await plantLegacy(context, serviceWorker);
    await serviceWorker.evaluate(() => chrome.storage.local.remove('rx_activity_meta'));
    await reload(page);
    expect(Object.keys(await activityKeys(serviceWorker))).toHaveLength(Object.keys(SEEDED).length);
    await page.close();

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await options.locator('#reset-btn').click();
    await expect(options.locator('#status')).toContainText(/Cleared [0-9]+ saved activity items\./);
    expect(await activityKeys(serviceWorker)).toEqual({});
    const stored = await storage(serviceWorker, ['rx_activity_meta', 'rx_activity_premigration']);
    expect(stored.rx_activity_premigration).toBeUndefined();
    // The version record stays, so the move does not run again after a reset.
    expect(stored.rx_activity_meta).toMatchObject({ version: 1 });
});
