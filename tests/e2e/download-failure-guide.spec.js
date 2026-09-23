// @ts-check
// A failed download names the stage that failed, the kind of failure, and one
// next step, and the only automatic fallback is a single refresh of an expired
// stream link on Rumble's own hosts.
const { test, expect } = require('./_fixtures');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');

const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'platform', 'offline-watch.html'), 'utf8');
const OLD_MASTER = 'https://1a-1791.com/video/fx/old/master.m3u8';
const NEW_MASTER = 'https://1a-1791.com/video/fx/new/master.m3u8';
const VARIANT = 'https://1a-1791.com/video/fx/new/720/chunklist.m3u8';
const MASTER_TEXT = [
    '#EXTM3U',
    '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720',
    VARIANT,
    '',
].join('\n');
const VARIANT_TEXT = [
    '#EXTM3U',
    '#EXT-X-TARGETDURATION:4',
    '#EXTINF:4.0,',
    'https://1a-1791.com/video/fx/new/720/seg0.ts',
    '#EXTINF:4.0,',
    'https://1a-1791.com/video/fx/new/720/seg1.ts',
    '#EXT-X-ENDLIST',
    '',
].join('\n');

// The tar entry is what gives the panel its HLS row; the hls link is what
// the download itself reads.
const embedWith = (hls) => ({
    u: { hls: { url: hls } },
    ua: { tar: { 720: { url: 'https://1a-1791.com/video/fx/guide.haa.tar', meta: { h: 720, w: 1280 } } } },
});

// Serves the watch page, an embed payload whose HLS link changes on every
// fetch of the u3 unit the panel uses, and the playlists and segments. Counts
// what was asked for so the tests can hold the fallback to exactly one try.
async function openWatch(context, serviceWorker, { masters, embeds }) {
    await serviceWorker.evaluate(() => {
        // Deep-scan probes stay on this machine.
        globalThis.fetch = async () => new Response(null, { status: 404 });
    });
    const page = await context.newPage();
    const counts = { embed: 0, [OLD_MASTER]: 0, [NEW_MASTER]: 0, variant: 0, segments: 0 };
    await page.route('**/*', (route) => {
        const request = route.request();
        const url = request.url();
        if (request.isNavigationRequest() && url.startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        // Only the panel's own endpoint. The deep scan also reads four other
        // units and a u3 variant, and those must not consume the sequence.
        if (url.includes('/embedJS/u3/?request=video&ver=2')) {
            const payload = embeds[Math.min(counts.embed, embeds.length - 1)];
            counts.embed += 1;
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
        }
        if (url.includes('/embedJS/')) return route.fulfill({ status: 404, body: '' });
        if (url === OLD_MASTER || url === NEW_MASTER) {
            counts[url] += 1;
            const status = masters[url];
            return route.fulfill({ status, contentType: 'application/vnd.apple.mpegurl', body: status === 200 ? MASTER_TEXT : '' });
        }
        if (url === VARIANT) {
            counts.variant += 1;
            return route.fulfill({ status: 200, contentType: 'application/vnd.apple.mpegurl', body: VARIANT_TEXT });
        }
        if (url.endsWith('.ts')) {
            counts.segments += 1;
            return route.fulfill({ status: 200, contentType: 'video/mp2t', body: Buffer.alloc(188 * 4, 0x47) });
        }
        return route.abort();
    });
    await page.goto('https://rumble.com/vguide-fixture.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-download-btn', { state: 'attached', timeout: 15_000 });
    const tabId = await serviceWorker.evaluate(async (url) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, page.url());
    await page.evaluate(() => document.querySelector('#rx-download-btn')?.click());
    await expect(page.locator('.rx-dl-quality').first()).toBeVisible({ timeout: 15_000 });
    return { page, counts, tabId };
}

// Starts a TS download of the 720p HLS row from inside the content script and
// records what would have been saved.
async function startTs(serviceWorker, tabId) {
    return serviceWorker.evaluate(async (target) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: target },
            world: 'ISOLATED',
            func: async () => {
                globalThis.__rxSaved = [];
                VideoDownloader._triggerSave = (data, filename) => { globalThis.__rxSaved.push(filename); };
                const quality = { label: '720p', height: 720, width: 1280, type: 'hls', directUrl: null };
                await VideoDownloader._startDownload(quality, 'Guide Fixture', 'ts');
                return { saved: globalThis.__rxSaved, hls: VideoDownloader._hlsUrl };
            },
        });
        return execution.result;
    }, tabId);
}

test('an expired stream link is refreshed once from the embed payload and the download completes', async ({ context, serviceWorker }) => {
    const { page, counts, tabId } = await openWatch(context, serviceWorker, {
        masters: { [OLD_MASTER]: 403, [NEW_MASTER]: 200 },
        embeds: [embedWith(OLD_MASTER), embedWith(NEW_MASTER)],
    });
    const result = await startTs(serviceWorker, tabId);
    expect(result.saved.some((name) => name.endsWith(' - 720p.ts'))).toBe(true);
    expect(result.hls).toBe(NEW_MASTER);
    // Exactly one refusal, one refresh, one retry.
    expect(counts[OLD_MASTER]).toBe(1);
    expect(counts[NEW_MASTER]).toBe(1);
    expect(counts.segments).toBe(2);
    await expect(page.locator('.rx-dl-failure')).toHaveCount(0);
    await expect(page.locator('.rx-dl-done')).toBeVisible();
});

test('a refusal that survives the refresh names the stage, the failure and the next step', async ({ context, serviceWorker }) => {
    const { page, counts, tabId } = await openWatch(context, serviceWorker, {
        masters: { [OLD_MASTER]: 403, [NEW_MASTER]: 403 },
        embeds: [embedWith(OLD_MASTER), embedWith(NEW_MASTER)],
    });
    const result = await startTs(serviceWorker, tabId);
    expect(result.saved).toEqual([]);
    // Bounded: the old link once, the refreshed link once, nothing else.
    expect(counts[OLD_MASTER]).toBe(1);
    expect(counts[NEW_MASTER]).toBe(1);
    expect(counts.segments).toBe(0);

    const guide = page.locator('.rx-dl-failure');
    await expect(guide).toBeVisible();
    await expect(guide).toHaveAttribute('data-kind', 'forbidden');
    await expect(guide.locator('.rx-dl-failure-stage')).toHaveText('Failed at: HLS master playlist');
    await expect(guide.locator('.rx-dl-failure-what')).toHaveText('Rumble refused this request (HTTP 403).');
    await expect(guide.locator('.rx-dl-failure-next')).toContainText('Reload the quality list');
    // The diagnostics actions still follow the guide.
    await expect(page.locator('.rx-diagnostic-actions')).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
        .include('.rx-dl-failure')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
    expect(accessibility.violations).toEqual([]);

    // The offered step runs once per click: one more embed read, no loop.
    const before = counts.embed;
    await guide.locator('.rx-dl-failure-action').click();
    await expect(page.locator('.rx-dl-quality').first()).toBeVisible();
    await page.waitForTimeout(300);
    expect(counts.embed - before).toBe(1);
});

test('a failed conversion offers TS, and TS saves without converting', async ({ context, serviceWorker }) => {
    const { page, tabId } = await openWatch(context, serviceWorker, {
        masters: { [OLD_MASTER]: 200, [NEW_MASTER]: 200 },
        embeds: [embedWith(OLD_MASTER)],
    });
    await serviceWorker.evaluate(async (target) => {
        await chrome.scripting.executeScript({
            target: { tabId: target },
            world: 'ISOLATED',
            func: () => {
                globalThis.__rxSaved = [];
                VideoDownloader._triggerSave = (data, filename) => { globalThis.__rxSaved.push(filename); };
                VideoDownloader._transmuxWithWorker = async () => {
                    const error = new Error('No decoder for this codec');
                    error.name = 'NotSupportedError';
                    throw error;
                };
                void VideoDownloader._startDownload(
                    { label: '720p', height: 720, width: 1280, type: 'hls', directUrl: null },
                    'Guide Fixture',
                    'mp4',
                );
            },
        });
    }, tabId);
    const guide = page.locator('.rx-dl-failure');
    await expect(guide).toHaveAttribute('data-kind', 'codec', { timeout: 15_000 });
    await expect(guide.locator('.rx-dl-failure-stage')).toHaveText('Failed at: MP4 conversion');
    const action = guide.locator('.rx-dl-failure-action');
    await expect(action).toHaveText('Save as TS instead');
    await action.click();
    await expect(page.locator('.rx-dl-done')).toBeVisible({ timeout: 15_000 });
    const saved = await serviceWorker.evaluate(async (target) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: target }, world: 'ISOLATED', func: () => globalThis.__rxSaved,
        });
        return execution.result;
    }, tabId);
    expect(saved.some((name) => name.endsWith(' - 720p.ts'))).toBe(true);
    expect(saved.some((name) => name.endsWith('.mp4'))).toBe(false);
});

test('every failure kind and stage has its own words', async ({ context, serviceWorker }) => {
    const { tabId } = await openWatch(context, serviceWorker, {
        masters: { [OLD_MASTER]: 200, [NEW_MASTER]: 200 },
        embeds: [embedWith(OLD_MASTER)],
    });
    const table = await serviceWorker.evaluate(async (target) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: target },
            world: 'ISOLATED',
            func: () => {
                const http = (status, stage) => Object.assign(new Error(`${stage} returned HTTP ${status}`), { rxStatus: status, rxStage: stage });
                const named = (name, message = 'x') => Object.assign(new Error(message), { name });
                const cases = {
                    auth: [http(401, 'embed-api'), 'embed-api'],
                    forbidden: [http(403, 'master-playlist'), 'master-playlist'],
                    expired410: [http(410, 'segment-playlist'), 'segment-playlist'],
                    expired404: [http(404, 'segment-download'), 'segment-download'],
                    cors: [new TypeError('Failed to fetch'), 'segment-download'],
                    parse: [named('SyntaxError', 'Unexpected token < in JSON'), 'embed-api'],
                    codec: [named('Error', 'worker crashed'), 'worker-runtime'],
                    quotaName: [named('QuotaExceededError'), 'file-open'],
                    quotaMemory: [Object.assign(new Error('Stream exceeded the limit'), { code: 'in-memory-limit' }), 'segment-download'],
                    cancelled: [named('AbortError'), 'segment-download'],
                    network: [http(503, 'master-playlist'), 'master-playlist'],
                    unknown: [new Error('something else'), 'save'],
                };
                const kinds = Object.fromEntries(Object.entries(cases)
                    .map(([label, [error, stage]]) => [label, VideoDownloader._classifyFailure(error, stage)]));
                const stages = Object.fromEntries(['browser-download', 'embed-api', 'master-playlist',
                    'segment-playlist', 'mux', 'file-close', 'page-detection']
                    .map((stage) => [stage, VideoDownloader._stageLabel(stage)]));
                const texts = ['auth', 'forbidden', 'expired', 'cors', 'parse', 'codec', 'quota', 'network', 'unknown']
                    .map((kind) => VideoDownloader._failureText(kind, 403));
                return { kinds, stages, texts };
            },
        });
        return execution.result;
    }, tabId);

    expect(table.kinds).toEqual({
        auth: 'auth',
        forbidden: 'forbidden',
        expired410: 'expired',
        expired404: 'expired',
        cors: 'cors',
        parse: 'parse',
        codec: 'codec',
        quotaName: 'quota',
        quotaMemory: 'quota',
        cancelled: 'cancelled',
        network: 'network',
        unknown: 'unknown',
    });
    expect(table.stages).toEqual({
        'browser-download': 'Direct MP4 download',
        'embed-api': 'Embed metadata',
        'master-playlist': 'HLS master playlist',
        'segment-playlist': 'Rendition stream',
        mux: 'MP4 conversion',
        'file-close': 'Writing the file',
        'page-detection': 'Finding the video on this page',
    });
    // Nine distinct explanations, each with a next step, and none of them
    // suggests exporting cookies or disguising the browser.
    expect(new Set(table.texts.map((text) => text.what)).size).toBe(9);
    for (const text of table.texts) {
        expect(text.next.length).toBeGreaterThan(20);
        expect(text.next).not.toMatch(/export (your )?cookies|user[- ]agent|impersonat/i);
    }
});
