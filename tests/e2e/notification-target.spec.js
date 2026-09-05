// @ts-check
// A notification is only useful if clicking it still works later.
//
// Chrome evicts an MV3 service worker after roughly 30 seconds idle, and the
// channel notifier fires from a chrome.alarms period, so the worker is
// normally gone by the time anyone opens the notification centre. When the
// target URL lived only in a module-scope Map, the click resolved to
// `undefined` and the handler returned without opening anything, raising an
// error, or leaving a trace. These tests pin the fix: the target survives the
// loss of worker memory, is readable from a context that never had the Map,
// and is re-validated as a Rumble URL every time it is read back.
const { test, expect } = require('./_fixtures');

const TARGETS_KEY = 'rx_notification_targets';
const LIVE_URL = 'https://rumble.com/v0000012-live.html';

// Drive the real notifier path with chrome.notifications.create stubbed, so
// the test never depends on the host OS notification centre.
async function fireNotification(serviceWorker, { url, id }) {
    return serviceWorker.evaluate(async ({ url, id }) => {
        const original = chrome.notifications.create;
        chrome.notifications.create = (_id, _options, callback) => { callback(id); };
        try {
            return await rxFireNotification({
                title: 'LIVE — Test channel',
                message: 'This channel just went live.',
                url,
            });
        } finally {
            chrome.notifications.create = original;
        }
    }, { url, id });
}

// Force the real thing rather than emptying the Map by hand: CDP stops the
// worker, the next evaluate wakes a fresh instance, and the planted marker is
// the positive control proving the restart actually happened. Without that
// check a CDP behaviour change would leave this test passing against a worker
// that never died.
async function restartServiceWorker(context, serviceWorker) {
    await serviceWorker.evaluate(() => { globalThis.__rxWorkerGeneration = 'before-restart'; });
    const page = await context.newPage();
    await page.goto('about:blank');
    const cdp = await context.newCDPSession(page);
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.stopAllWorkers');
    await cdp.detach();
    await page.close();
    await expect.poll(
        () => serviceWorker.evaluate(() => globalThis.__rxWorkerGeneration ?? null),
        { message: 'service worker did not restart with fresh memory', timeout: 15000 },
    ).toBeNull();
}

// Run the click handler the listener runs, with chrome.tabs.create captured.
//
// Extension-page tabs are filtered out: a fresh profile fires onInstalled,
// which opens pages/options.html#welcome after an async storage read, and that
// can land inside the stub window in any test. The click handler only ever
// opens an https rumble.com URL, so dropping chrome-extension:// tabs removes
// the race without weakening what is asserted.
async function clickNotification(serviceWorker, id) {
    return serviceWorker.evaluate(async (id) => {
        const opened = [];
        const originalCreate = chrome.tabs.create;
        const originalClear = chrome.notifications.clear;
        chrome.tabs.create = async (options) => {
            if (!String(options?.url || '').startsWith('chrome-extension://')) opened.push(options.url);
            return { id: 1 };
        };
        chrome.notifications.clear = async () => true;
        try {
            const resolved = await rxHandleNotificationClick(id);
            return { resolved, opened };
        } finally {
            chrome.tabs.create = originalCreate;
            chrome.notifications.clear = originalClear;
        }
    }, id);
}

test('a notification click opens its target after the service worker restarts', async ({ context, serviceWorker, extensionId }) => {
    const created = await fireNotification(serviceWorker, { url: LIVE_URL, id: 'rx-live-1' });
    expect(created).toBe('rx-live-1');

    // Read the stored target from an extension page. This context never held
    // the Map, so finding the URL here proves it is not worker memory.
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const fromPage = await page.evaluate(async (key) => {
        const got = await chrome.storage.session.get(key);
        return got[key] || null;
    }, TARGETS_KEY);
    expect(fromPage).toBeTruthy();
    expect(fromPage['rx-live-1']).toBeTruthy();
    expect(fromPage['rx-live-1'].url).toBe(LIVE_URL);
    await page.close();

    await restartServiceWorker(context, serviceWorker);

    // The Map is empty in the new instance; only the session store can answer.
    expect(await serviceWorker.evaluate(() => rxNotificationUrlMap.size)).toBe(0);

    const clicked = await clickNotification(serviceWorker, 'rx-live-1');
    expect(clicked.resolved).toBe(LIVE_URL);
    expect(clicked.opened).toEqual([LIVE_URL]);

    // A consumed target is gone: a second click on the same notification must
    // not reopen the tab.
    const again = await clickNotification(serviceWorker, 'rx-live-1');
    expect(again.resolved).toBeNull();
    expect(again.opened).toEqual([]);
});

test('an off-site notification target is never stored and never opened', async ({ serviceWorker }) => {
    const created = await fireNotification(serviceWorker, {
        url: 'https://evil.example.com/v1-not-rumble.html',
        id: 'rx-offsite-1',
    });
    // The notification itself is still created; only the click target is refused.
    expect(created).toBe('rx-offsite-1');

    const stored = await serviceWorker.evaluate(async (key) => {
        const got = await chrome.storage.session.get(key);
        return got[key] || {};
    }, TARGETS_KEY);
    expect(stored['rx-offsite-1']).toBeUndefined();

    const clicked = await clickNotification(serviceWorker, 'rx-offsite-1');
    expect(clicked.resolved).toBeNull();
    expect(clicked.opened).toEqual([]);
});

test('a stored target that is expired, malformed, or off-site is refused on read', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async ({ key, ttl }) => {
        const now = Date.now();
        // Storage outlives the code that wrote it, so plant entries this build
        // would never have written and prove the read path still refuses them.
        await chrome.storage.session.set({
            [key]: {
                fresh: { url: 'https://rumble.com/v1-fresh.html', at: now },
                expired: { url: 'https://rumble.com/v2-expired.html', at: now - ttl - 1000 },
                offsite: { url: 'https://evil.example.com/v3.html', at: now },
                insecure: { url: 'http://rumble.com/v4-insecure.html', at: now },
                lookalike: { url: 'https://rumble.com.evil.example/v5.html', at: now },
                malformed: { url: 'not a url at all', at: now },
                noStamp: { url: 'https://rumble.com/v6-no-stamp.html' },
                notAnObject: 'https://rumble.com/v7-bare-string.html',
            },
        });
        const out = {};
        for (const id of ['fresh', 'expired', 'offsite', 'insecure', 'lookalike', 'malformed', 'noStamp', 'notAnObject']) {
            out[id] = await rxTakeNotificationTarget(id);
        }
        return out;
    }, { key: TARGETS_KEY, ttl: 7 * 24 * 60 * 60 * 1000 });

    expect(result.fresh).toBe('https://rumble.com/v1-fresh.html');
    expect(result.expired).toBeNull();
    expect(result.offsite).toBeNull();
    expect(result.insecure).toBeNull();
    expect(result.lookalike).toBeNull();
    expect(result.malformed).toBeNull();
    expect(result.noStamp).toBeNull();
    expect(result.notAnObject).toBeNull();
});

test('a failed session read leaves the other stored targets alone', async ({ serviceWorker }) => {
    // A read that rejects says nothing about what is stored. Treating it as an
    // empty map and writing that back destroyed every other pending target,
    // which is the same silent loss this whole path exists to prevent.
    const result = await serviceWorker.evaluate(async (key) => {
        await chrome.storage.session.remove(key);
        for (const id of ['keep-1', 'keep-2', 'keep-3']) {
            await rxRememberNotificationTarget(id, `https://rumble.com/v-${id}.html`);
        }
        rxNotificationUrlMap.clear();

        const realGet = chrome.storage.session.get;
        chrome.storage.session.get = async () => { throw new Error('simulated read failure'); };
        let resolved;
        try {
            resolved = await rxTakeNotificationTarget('keep-2');
        } finally {
            chrome.storage.session.get = realGet;
        }

        const got = await chrome.storage.session.get(key);
        return { resolved, survivors: Object.keys(got[key] || {}).sort() };
    }, TARGETS_KEY);

    expect(result.resolved).toBeNull();
    expect(result.survivors).toEqual(['keep-1', 'keep-2', 'keep-3']);
});

test('worker memory cannot serve a target the store has aged out or capped', async ({ serviceWorker }) => {
    // The Map is a same-wakeup fast path. If it answered whenever the store
    // said no, the TTL and the cap would only bind half the lookup.
    const result = await serviceWorker.evaluate(async ({ key, ttl }) => {
        await chrome.storage.session.remove(key);

        // Expired in both places: the Map must not resurrect it.
        rxNotificationUrlMap.set('stale-1', { url: 'https://rumble.com/v-stale.html', at: Date.now() - ttl - 1000 });
        const stale = await rxTakeNotificationTarget('stale-1');

        // Over the cap: the store drops the oldest, and the Map must agree.
        await chrome.storage.session.remove(key);
        rxNotificationUrlMap.clear();
        for (let i = 0; i < 120; i += 1) {
            await rxRememberNotificationTarget(`over-${i}`, `https://rumble.com/v${i}-over.html`);
        }
        const dropped = await rxTakeNotificationTarget('over-0');
        const kept = await rxTakeNotificationTarget('over-119');
        return { stale, dropped, kept, mapSize: rxNotificationUrlMap.size };
    }, { key: TARGETS_KEY, ttl: 7 * 24 * 60 * 60 * 1000 });

    expect(result.stale).toBeNull();
    expect(result.dropped).toBeNull();
    expect(result.kept).toBe('https://rumble.com/v119-over.html');
    expect(result.mapSize).toBeLessThanOrEqual(100);
});

test('the click listener is registered and is the code the handler runs', async ({ serviceWorker }) => {
    // chrome.notifications.onClicked has no dispatch() outside the browser's
    // own plumbing, so the closest a test can get is invoking the exact
    // registered listener and confirming it is still attached to the event.
    const result = await serviceWorker.evaluate(async (url) => {
        await rxRememberNotificationTarget('rx-listener-1', url);
        rxNotificationUrlMap.clear();
        const registered = chrome.notifications.onClicked.hasListener(rxNotificationClickListener);

        const opened = [];
        const originalCreate = chrome.tabs.create;
        const originalClear = chrome.notifications.clear;
        chrome.tabs.create = async (options) => {
            if (!String(options?.url || '').startsWith('chrome-extension://')) opened.push(options.url);
            return { id: 1 };
        };
        chrome.notifications.clear = async () => true;
        try {
            rxNotificationClickListener('rx-listener-1');
            // The listener is fire-and-forget, so wait for the tab to land.
            for (let i = 0; i < 50 && opened.length === 0; i += 1) {
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            return { registered, opened };
        } finally {
            chrome.tabs.create = originalCreate;
            chrome.notifications.clear = originalClear;
        }
    }, LIVE_URL);

    expect(result.registered).toBe(true);
    expect(result.opened).toEqual([LIVE_URL]);
});

test('the stored target map is bounded and keeps the newest entries', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async (key) => {
        await chrome.storage.session.remove(key);
        // One more than the cap, oldest first, so the drop is deterministic.
        for (let i = 0; i < 120; i += 1) {
            await rxRememberNotificationTarget(`rx-bulk-${i}`, `https://rumble.com/v${i}-bulk.html`);
        }
        const got = await chrome.storage.session.get(key);
        const stored = got[key] || {};
        return {
            count: Object.keys(stored).length,
            hasOldest: Object.hasOwn(stored, 'rx-bulk-0'),
            hasNewest: Object.hasOwn(stored, 'rx-bulk-119'),
        };
    }, TARGETS_KEY);

    expect(result.count).toBe(100);
    expect(result.hasOldest).toBe(false);
    expect(result.hasNewest).toBe(true);
});
