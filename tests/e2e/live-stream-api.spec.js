// @ts-check
// Rumble's Live Stream API in the Creator Program panel: the URL is checked,
// kept secret and only ever used by the background; polling happens only
// while the panel is on screen; overlapping 50-item windows are merged; the
// counts say they are locally observed; gifted subs join the archive as their
// own kind; raids are said to be unsupported.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'platform');
const CHANNEL = fs.readFileSync(path.join(FIXTURES, 'desktop-channel.html'), 'utf8');
const WATCH = fs.readFileSync(path.join(FIXTURES, 'offline-watch.html'), 'utf8');
const KEY = 'live-secret-key-value';
const API_URL = `https://rumble.com/-livestream-api/get-data?key=${KEY}`;
const STREAM_KEY = 'SECRET-STREAM-KEY-VALUE';
// The watch capture's own numeric id, which Rumble's API uses for gifts.
const WATCH_NUMERIC_ID = 778373919;

// Two consecutive responses in the shape Rumble documents, overlapping the
// way the latest-50 windows do: the second repeats some of the first.
const stream = (overrides) => ({
    id: 'fixture-stream', title: 'Fixture stream', created_on: '2026-09-23T10:00:00+00:00', is_live: true,
    categories: { primary: { slug: 'gaming', title: 'Gaming' } }, stream_key: STREAM_KEY, likes: 3, dislikes: 0,
    ...overrides,
});
const API_A = {
    now: 1790000000, type: 'user', user_id: '282031328', channel_id: '7843778', max_num_results: 50,
    followers: {
        num_followers: 3, num_followers_total: 1234,
        recent_followers: [
            { username: 'f1', followed_on: '2026-09-23T10:01:00+00:00' },
            { username: 'f2', followed_on: '2026-09-23T10:02:00+00:00' },
            { username: 'f3', followed_on: '2026-09-23T10:03:00+00:00' },
        ],
    },
    subscribers: {
        num_subscribers: 7, num_subscribers_total: 7,
        recent_subscribers: [{ user: 's1', username: 's1', amount_cents: 500, amount_dollars: 5, subscribed_on: '2026-09-23T10:04:00+00:00' }],
    },
    gifted_subs: {
        num_gifted_subs: 5,
        recent_gifted_subs: [{ purchased_by: 'g1', total_gifts: 5, gift_type: 'subs', remaining_gifts: 0, video_id: WATCH_NUMERIC_ID }],
    },
    livestreams: [stream({
        watching_now: 42,
        chat: {
            recent_messages: [
                { username: 'c1', badges: [], text: 'hello', created_on: '2026-09-23T10:05:00+00:00' },
                { username: 'C1', badges: [], text: 'again', created_on: '2026-09-23T10:06:00+00:00' },
                { username: 'c2', badges: [], text: 'hey', created_on: '2026-09-23T10:07:00+00:00' },
            ],
            recent_rants: [{ username: 'r1', badges: [], text: 'rant one', created_on: '2026-09-23T10:08:00+00:00', expires_on: '2026-09-23T10:10:00+00:00', amount_cents: 500, amount_dollars: 5 }],
        },
    })],
};
const API_B = {
    ...API_A,
    followers: {
        num_followers: 4, num_followers_total: 1235,
        recent_followers: [
            API_A.followers.recent_followers[1],
            API_A.followers.recent_followers[2],
            { username: 'f4', followed_on: '2026-09-23T10:09:00+00:00' },
        ],
    },
    gifted_subs: {
        num_gifted_subs: 8,
        recent_gifted_subs: [
            API_A.gifted_subs.recent_gifted_subs[0],
            { purchased_by: 'g2', total_gifts: 3, gift_type: 'subs', remaining_gifts: 3, video_id: WATCH_NUMERIC_ID },
        ],
    },
    livestreams: [stream({
        watching_now: 55,
        chat: {
            recent_messages: [
                API_A.livestreams[0].chat.recent_messages[2],
                { username: 'c3', badges: [], text: 'new', created_on: '2026-09-23T10:11:00+00:00' },
            ],
            recent_rants: [
                API_A.livestreams[0].chat.recent_rants[0],
                { username: 'r2', badges: [], text: 'rant two', created_on: '2026-09-23T10:12:00+00:00', expires_on: '2026-09-23T10:14:00+00:00', amount_cents: 1000, amount_dollars: 10 },
            ],
        },
    })],
};

async function stubApi(serviceWorker, responses) {
    await serviceWorker.evaluate((bodies) => {
        globalThis.__rxLiveApi = { calls: [], bodies };
        const realFetch = globalThis.__rxLiveRealFetch || globalThis.fetch;
        globalThis.__rxLiveRealFetch = realFetch;
        globalThis.fetch = async (input, init) => {
            const url = String(input);
            if (url.startsWith('https://rumble.com/-livestream-api/')) {
                __rxLiveApi.calls.push({ url, credentials: init?.credentials || null });
                const body = __rxLiveApi.bodies[Math.min(__rxLiveApi.calls.length - 1, __rxLiveApi.bodies.length - 1)];
                return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
            }
            return new Response(null, { status: 404 });
        };
        rxLiveApiLast = { at: 0, url: '', result: null };
    }, responses);
}

async function seedSettings(serviceWorker, settings) {
    await serviceWorker.evaluate((values) => chrome.storage.local.set({ rx_settings: values }), settings);
}

async function openPage(context, html, url) {
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const request = route.request();
        if (request.isNavigationRequest() && request.url().startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: html });
        }
        return route.abort();
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });
    return page;
}

const tabIdOf = (serviceWorker, page) => serviceWorker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
    if (!tab?.id) throw new Error('fixture tab not found');
    return tab.id;
}, page.url());

test('the panel reads the API through the background, never sees the key, and merges overlapping windows', async ({ context, serviceWorker }) => {
    await seedSettings(serviceWorker, { creatorMode: true, liveStreamApiMetrics: true, liveStreamApiUrl: API_URL });
    await stubApi(serviceWorker, [API_A, API_B]);
    const page = await openPage(context, CHANNEL, 'https://rumble.com/c/fixture-channel');

    const live = page.locator('.rx-cp-live');
    await expect(live).toBeVisible({ timeout: 15_000 });
    await expect(live).toContainText('Followers');
    await expect(live).toContainText('1,234');
    await expect(live).toContainText('Watching now');
    await expect(live).toContainText('Locally observed since');
    await expect(live).toContainText('Raids are not counted');

    // One request, made by the background, with the key and without cookies.
    const calls = await serviceWorker.evaluate(() => __rxLiveApi.calls);
    expect(calls).toEqual([{ url: API_URL, credentials: 'omit' }]);

    // Nothing the page holds carries the key or the stream key, including
    // what the background hands back.
    const response = await serviceWorker.evaluate(async (id) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: async () => JSON.stringify(await RXPlatform.sendMessage({ action: 'pollLiveStreamApi' })),
        });
        return execution.result;
    }, await tabIdOf(serviceWorker, page));
    expect(response).toContain('"ok":true');
    expect(response).not.toContain(KEY);
    expect(response).not.toContain(STREAM_KEY);
    expect(response).not.toContain('stream_key');
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    expect(html).not.toContain(KEY);
    expect(html).not.toContain(STREAM_KEY);
    // That second request was answered from the background's 15-second
    // cache, so a busy page cannot turn into a request loop.
    expect(await serviceWorker.evaluate(() => __rxLiveApi.calls.length)).toBe(1);

    // The next window overlaps the first. Merged, not added.
    await serviceWorker.evaluate(() => { rxLiveApiLast = { at: 0, url: '', result: null }; });
    const summary = await serviceWorker.evaluate(async (id) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: async () => {
                await CreatorProgram._pollLive();
                return RxLiveObserved.summary();
            },
        });
        return execution.result;
    }, await tabIdOf(serviceWorker, page));
    expect(summary).toMatchObject({
        chatters: 3, // c1 (and C1), c2, c3
        followers: 4, // f1..f4
        subscribers: 1,
        giftPurchases: 2,
        gifts: 8, // 5 + 3
        rants: 2,
        peakWatching: 55,
        lastWatching: 55,
    });
    await expect(live).toContainText('55');
});

test('gifted subs the API reported join that video\'s archive as their own kind', async ({ context, serviceWorker }) => {
    await seedSettings(serviceWorker, { creatorMode: true, liveStreamApiMetrics: true, liveStreamApiUrl: API_URL });
    await stubApi(serviceWorker, [API_B]);
    const channel = await openPage(context, CHANNEL, 'https://rumble.com/c/fixture-channel');
    await expect(channel.locator('.rx-cp-live')).toBeVisible({ timeout: 15_000 });
    await channel.close();

    // The watch page for the gifted video files them under its own archive.
    const watch = await openPage(context, WATCH, 'https://rumble.com/vgiftfixture-stream.html');
    await expect.poll(async () => {
        const stored = await serviceWorker.evaluate(async () => (await chrome.storage.local.get('rx_act:rx_rants_vgiftfixture'))['rx_act:rx_rants_vgiftfixture'] || '[]');
        return JSON.parse(stored).filter((entry) => entry.kind === 'gift').map((entry) => [entry.user, entry.gifts]);
    }).toEqual([['g1', 5], ['g2', 3]]);

    const archive = await serviceWorker.evaluate(async (id) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: () => {
                const entries = RantPersist._cached;
                return { totals: RantArchive.totals(entries), csv: RantArchive.toCsv(entries).split('\n') };
            },
        });
        return execution.result;
    }, await tabIdOf(serviceWorker, watch));
    // Gifts are counted on their own and never pad the rant count or total.
    expect(archive.totals.gifts).toBe(8);
    expect(archive.csv[0]).toBe('user,price,amount,level,text,timestamp,kind,gifts');
    const giftRows = archive.csv.filter((line) => line.endsWith(',gift,5') || line.endsWith(',gift,3'));
    expect(giftRows).toHaveLength(2);
    const rantRows = archive.csv.slice(1).filter((line) => line.includes(',rant,'));
    expect(archive.totals.count).toBe(rantRows.length);

    // Loading the page again does not file the same gifts twice.
    await watch.reload({ waitUntil: 'domcontentloaded' });
    await watch.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });
    const again = await serviceWorker.evaluate(async () => JSON.parse((await chrome.storage.local.get('rx_act:rx_rants_vgiftfixture'))['rx_act:rx_rants_vgiftfixture'])
        .filter((entry) => entry.kind === 'gift').length);
    expect(again).toBe(2);
});

test('no poll happens without a valid Rumble URL, or away from the Creator panel', async ({ context, serviceWorker }) => {
    // A URL on another host is dropped when settings are read.
    await seedSettings(serviceWorker, {
        creatorMode: true,
        liveStreamApiMetrics: true,
        liveStreamApiUrl: `https://rumble.com.evil.example/-livestream-api/get-data?key=${KEY}`,
    });
    await stubApi(serviceWorker, [API_A]);
    const channel = await openPage(context, CHANNEL, 'https://rumble.com/c/fixture-channel');
    const live = channel.locator('.rx-cp-live');
    await expect(live).toContainText('Add your Live Stream API URL in Options', { timeout: 15_000 });
    expect(await serviceWorker.evaluate(() => __rxLiveApi.calls.length)).toBe(0);
    await channel.close();

    // With a valid URL, a watch page is not a creator surface.
    await seedSettings(serviceWorker, { creatorMode: true, liveStreamApiMetrics: true, liveStreamApiUrl: API_URL });
    const watch = await openPage(context, WATCH, 'https://rumble.com/vnotcreator-stream.html');
    await watch.waitForTimeout(1500);
    expect(await serviceWorker.evaluate(() => __rxLiveApi.calls.length)).toBe(0);

    // And with the metrics switched off, the panel does not poll at all.
    await seedSettings(serviceWorker, { creatorMode: true, liveStreamApiMetrics: false, liveStreamApiUrl: API_URL });
    const quiet = await openPage(context, CHANNEL, 'https://rumble.com/c/fixture-channel');
    await expect(quiet.locator('.rx-cp-panel')).toBeVisible({ timeout: 15_000 });
    await quiet.waitForTimeout(1000);
    await expect(quiet.locator('.rx-cp-live')).toHaveCount(0);
    expect(await serviceWorker.evaluate(() => __rxLiveApi.calls.length)).toBe(0);
});
