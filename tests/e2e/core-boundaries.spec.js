// @ts-check
// The feature harness used to read content.js alone, so moving a dependency
// into another file could leave the production manifest or userscript stale
// while the in-memory tests kept passing. These checks exercise the real load
// order and the adapter methods that remain on VideoDownloader.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const EXT = path.join(ROOT, 'extension');
const CORE_FILES = [
    'core-routing.js',
    'core-selectors.js',
    'core-video-cards.js',
    'core-media.js',
    'content.js',
];
const EXPECTED_CHROME_ORDER = ['settings-schema.js', 'platform.js', ...CORE_FILES];

function read(relative) {
    return fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/\r\n?/g, '\n');
}

async function tabId(serviceWorker, url) {
    return serviceWorker.evaluate(async (target) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === target);
        if (!tab?.id) throw new Error('Core-boundary fixture tab not found');
        return tab.id;
    }, url);
}

test('manifests and generated userscripts carry every shared core file in canonical order', () => {
    const chromeManifest = JSON.parse(read('extension/manifest.json'));
    const firefoxManifest = JSON.parse(read('extension/manifest-firefox.json'));
    expect(chromeManifest.content_scripts[0].js).toEqual(EXPECTED_CHROME_ORDER);
    expect(firefoxManifest.content_scripts[0].js).toEqual(['browser-polyfill.js', ...EXPECTED_CHROME_ORDER]);

    const declarations = new Map([
        ['core-routing.js', ['Page', 'Router']],
        ['core-selectors.js', ['Selectors']],
        ['core-video-cards.js', ['VideoCards']],
        ['core-media.js', ['MediaHelpers', 'PageData', 'MediaProbeCache']],
    ]);
    const content = read('extension/content.js');
    for (const [file, names] of declarations) {
        const source = read(`extension/${file}`);
        for (const name of names) {
            expect(source, `${name} is missing from ${file}`).toMatch(new RegExp(`^const ${name} =`, 'm'));
            expect(content, `${name} is still declared in content.js`).not.toMatch(new RegExp(`^const ${name} =`, 'm'));
        }
    }
    expect(read('extension/core-media.js')).toMatch(/^function getActiveMedia\(/m);
    expect(content).not.toMatch(/^function getActiveMedia\(/m);

    for (const userscriptName of ['RumbleX.user.js', 'RumbleX.lite.user.js']) {
        const userscript = read(userscriptName);
        let previous = -1;
        for (const file of CORE_FILES) {
            const marker = read(`extension/${file}`).split('\n')[0];
            const index = userscript.indexOf(marker);
            expect(index, `${userscriptName} is missing ${file}`).toBeGreaterThan(previous);
            previous = index;
        }
        expect(userscript.endsWith(read('extension/content.js'))).toBe(true);
    }
});

test('loaded extension shares routing, selectors, cards, and media helpers across script boundaries', async ({ context, serviceWorker }) => {
    const html = read('tests/fixtures/platform/modern-watch.html');
    const url = 'https://rumble.com/vcore123-boundary-fixture.html';
    await context.route(url, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const id = await tabId(serviceWorker, page.url());

    let result;
    await expect.poll(async () => {
        result = await serviceWorker.evaluate(async (targetTabId) => {
            const [execution] = await chrome.scripting.executeScript({
                target: { tabId: targetTabId },
                world: 'ISOLATED',
                func: async () => {
                    const ready = [Page, Router, Selectors, VideoCards, MediaHelpers,
                        PageData, MediaProbeCache, VideoDownloader]
                        .every((value) => value && typeof value === 'object');
                    if (!ready || !Settings._ready || !Router._patched) return { ready: false };

                    const playlist = [
                        '#EXTM3U',
                        '#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360',
                        'https://hugh.cdn.rumble.cloud/fixture/360.m3u8',
                    ].join('\n');
                    const segments = [
                        '#EXTM3U',
                        '#EXTINF:2.5,',
                        'https://hugh.cdn.rumble.cloud/fixture/one.ts',
                        '#EXTINF:3,',
                        'https://hugh.cdn.rumble.cloud/fixture/two.ts',
                    ].join('\n');
                    const directMaster = MediaHelpers.parseMasterPlaylist(playlist, location.href);
                    const delegatedMaster = VideoDownloader._parseMasterPlaylist(playlist, location.href);
                    const directSegments = MediaHelpers.parseSegmentEntries(segments, location.href);
                    const delegatedSegments = VideoDownloader._parseSegmentEntries(segments, location.href);
                    const healthBeforeRoute = Selectors.healthCheck();

                    const originalProbeTtl = Settings._cache.downloadProbeCacheTtlHours;
                    let probeCache;
                    try {
                        Settings._cache.downloadProbeCacheTtlHours = 1;
                        await MediaProbeCache.clear();
                        await MediaProbeCache.set('core-fresh', { status: 'fresh' });
                        await new Promise((resolve) => setTimeout(resolve, 350));
                        const fresh = await MediaProbeCache.get('core-fresh');
                        const persistedAfterSet = await RXPlatform.storage.get(MediaProbeCache._KEY);

                        MediaProbeCache._mem['core-fresh'].at = Date.now() - (2 * 3600 * 1000);
                        const expired = await MediaProbeCache.get('core-fresh');
                        await new Promise((resolve) => setTimeout(resolve, 350));
                        const persistedAfterExpiry = await RXPlatform.storage.get(MediaProbeCache._KEY);

                        await MediaProbeCache.set('core-clear', { status: 'clear-me' });
                        await MediaProbeCache.clear();
                        await new Promise((resolve) => setTimeout(resolve, 350));
                        const cleared = await MediaProbeCache.get('core-clear');
                        const persistedAfterClear = await RXPlatform.storage.get(MediaProbeCache._KEY);

                        Settings._cache.downloadProbeCacheTtlHours = 0;
                        await MediaProbeCache.set('core-disabled', { status: 'must-not-store' });
                        const disabled = await MediaProbeCache.get('core-disabled');
                        probeCache = {
                            fresh,
                            persisted: persistedAfterSet[MediaProbeCache._KEY]?.['core-fresh']?.val?.status === 'fresh',
                            expired,
                            expiredGc: !persistedAfterExpiry[MediaProbeCache._KEY]?.['core-fresh'],
                            cleared,
                            clearRemovedStorage: !Object.hasOwn(persistedAfterClear, MediaProbeCache._KEY),
                            disabled,
                            disabledNotStored: !MediaProbeCache._mem['core-disabled'],
                        };
                    } finally {
                        Settings._cache.downloadProbeCacheTtlHours = originalProbeTtl;
                        await MediaProbeCache.clear();
                    }

                    const routeEvents = [];
                    const unsubscribe = Router.onChange((detail) => routeEvents.push(detail));
                    History.prototype.pushState.call(history, {}, '', '/search/all?q=core-boundary');
                    Router._fire('core-boundary-test');
                    unsubscribe();

                    const card = VideoCards.related()[0];
                    return {
                        ready: true,
                        route: Page.classify(),
                        routeEvent: routeEvents.at(-1),
                        healthBeforeRoute,
                        selectorHealth: Selectors.healthCheck(),
                        card: {
                            title: VideoCards.title(card),
                            channel: VideoCards.channel(card),
                            id: VideoCards.videoId(card),
                        },
                        media: {
                            master: directMaster,
                            masterParity: JSON.stringify(directMaster) === JSON.stringify(delegatedMaster),
                            segments: directSegments,
                            segmentParity: JSON.stringify(directSegments) === JSON.stringify(delegatedSegments),
                            activeTag: getActiveMedia()?.tagName || null,
                            structuredAvailable: PageData.available(),
                            probeMethods: ['get', 'set', 'clear'].every((name) => typeof MediaProbeCache[name] === 'function'),
                            probeCache,
                        },
                    };
                },
            });
            return execution?.result || { ready: false };
        }, id);
        return result.ready;
    }, { timeout: 15_000 }).toBe(true);

    expect(result.route).toBe('search');
    expect(result.routeEvent).toEqual(expect.objectContaining({
        page: 'search',
        prevPage: 'watch',
        reason: 'core-boundary-test',
        changed: true,
    }));
    expect(result.healthBeforeRoute).toEqual(expect.objectContaining({ status: 'healthy', page: 'watch' }));
    expect(result.selectorHealth).toEqual(expect.objectContaining({
        status: 'broken',
        page: 'search',
        missing: ['search.input'],
    }));
    expect(result.card).toEqual({ title: 'Alpha Report', channel: 'Creator Alpha', id: 'valpha123' });
    expect(result.media.master).toEqual([expect.objectContaining({ width: 640, height: 360, bandwidth: 900000 })]);
    expect(result.media.masterParity).toBe(true);
    expect(result.media.segments).toEqual([
        expect.objectContaining({ duration: 2.5, start: 0, end: 2.5 }),
        expect.objectContaining({ duration: 3, start: 2.5, end: 5.5 }),
    ]);
    expect(result.media.segmentParity).toBe(true);
    expect(result.media.activeTag).toBe('VIDEO');
    expect(result.media.structuredAvailable).toBe(false);
    expect(result.media.probeMethods).toBe(true);
    expect(result.media.probeCache).toEqual({
        fresh: { status: 'fresh' },
        persisted: true,
        expired: null,
        expiredGc: true,
        cleared: null,
        clearRemovedStorage: true,
        disabled: null,
        disabledNotStored: true,
    });
});
