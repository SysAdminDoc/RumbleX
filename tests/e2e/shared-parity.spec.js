// @ts-check
// Shared-core regression coverage against Rumble's current custom elements.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const FIXTURE = fs.readFileSync(
    path.join(__dirname, '..', 'fixtures', 'platform', 'modern-watch.html'),
    'utf8',
);

async function openWatch(context, slug = 'vmodern123-modern-fixture-video.html') {
    const url = `https://rumble.com/${slug}`;
    await context.route(url, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE }));
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return page;
}

async function tabId(serviceWorker, url) {
    return serviceWorker.evaluate(async (target) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === target);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, url);
}

async function inContent(serviceWorker, targetTabId, action, args = []) {
    return serviceWorker.evaluate(async ({ id, operation, callArgs }) => {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: (name, values) => {
                if (name === 'videoCardsReady') return typeof VideoCards !== 'undefined';
                if (name === 'settingsReady') return typeof Settings !== 'undefined' && Settings._ready && !!Settings._cache;
                if (name === 'privacyReport') return rxBuildPrivacyReport();
                if (name === 'cards') {
                    return VideoCards.related().map((card) => ({
                        title: VideoCards.title(card),
                        channel: VideoCards.channel(card),
                        id: VideoCards.videoId(card),
                    }));
                }
                if (name === 'relatedFilter') {
                    RelatedFilter._filter(values[0], false);
                    return VideoCards.related().map((card) => card.classList.contains('rx-related-hidden'));
                }
                if (name === 'watchedFilter') {
                    localStorage.setItem('rx_watch_progress', JSON.stringify({ valpha123: { t: 30, d: 100, ts: Date.now() } }));
                    RelatedFilter._filter('', true);
                    WatchProgress._addProgressBars();
                    return VideoCards.related().map((card) => ({
                        hidden: card.classList.contains('rx-related-hidden'),
                        progress: !!card.querySelector('.rx-progress-bar'),
                    }));
                }
                if (name === 'keywordFilter') {
                    Settings._cache.blockedKeywords = ['alpha'];
                    KeywordFilter._matcherSig = '';
                    KeywordFilter._matchers = null;
                    KeywordFilter._process();
                    return VideoCards.related().map((card) => card.classList.contains('rx-kw-hidden'));
                }
                if (name === 'theaterGeometry') {
                    TheaterSplit._expandSplit();
                    const right = document.querySelector('#rx-split-right');
                    const divider = document.querySelector('#rx-split-divider');
                    return {
                        rightWidth: right.getBoundingClientRect().width,
                        dividerWidth: divider.getBoundingClientRect().width,
                        separatorRole: divider.getAttribute('role'),
                        closeLabel: document.querySelector('#rx-theater-close')?.getAttribute('aria-label'),
                        commentsCount: document.querySelectorAll('#video-comments').length,
                    };
                }
                if (name === 'trustBoundaries') {
                    try {
                        const clean = Settings._sanitize({
                        autoplayQueue: [
                            'javascript://rumble.com/alert(1)',
                            'https://evil.example/video',
                            'https://rumble.com/valpha123-safe.html',
                        ],
                        hiddenCategories: ['shorts', 'x-body-display-none'],
                        splitRatio: 999,
                        playbackSpeed: -20,
                        theme: 'attacker-theme',
                        sponsorSegments: {
                            valpha123: [
                                { start: 5, end: 9, category: 'sponsor' },
                                { start: 10, end: 2, category: 'bad' },
                            ],
                        },
                    });
                        const hlsShapes = [
                        { u: { hls: { auto: { url: 'https://rumble.com/a.m3u8' } } } },
                        { ua: { hls: { auto: { url: 'https://cdn.rumble.cloud/b.m3u8' } } } },
                        { u: { hls: { url: 'https://rumble.com/c.m3u8' } } },
                        { ua: { hls: { url: 'https://cdn.1a-1791.com/d.m3u8' } } },
                        ].map((data) => VideoDownloader._extractHlsUrl(data));
                        const rejectedHls = VideoDownloader._extractHlsUrl({ u: { hls: { url: 'javascript://rumble.com/x' } } });
                        Settings._cache.legacyKeyboardNav = true;
                        KeyboardNav.init();
                        const modified = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
                        document.dispatchEvent(modified);
                        const plain = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true });
                        document.dispatchEvent(plain);
                        KeyboardNav.destroy();
                        return { clean, hlsShapes, rejectedHls, modifiedPrevented: modified.defaultPrevented, plainPrevented: plain.defaultPrevented };
                    } catch (error) {
                        return { __error: String(error?.stack || error) };
                    }
                }
                if (name === 'streamToDisk') {
                    return (async () => {
                        const originalFetch = globalThis.fetch;
                        const originalHls = VideoDownloader._hlsUrl;
                        const payloads = new Map([
                            ['https://rumble.com/master.m3u8', '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=1280x720\nhttps://rumble.com/variant-720.m3u8\n'],
                            ['https://rumble.com/variant-720.m3u8', '#EXTM3U\n#EXTINF:2,\nhttps://cdn.1a-1791.com/a.ts\n#EXTINF:2,\nhttps://cdn.1a-1791.com/b.ts\n'],
                            ['https://rumble.com/direct.m3u8', '#EXTM3U\n#EXTINF:2,\nhttps://cdn.1a-1791.com/direct.ts\n'],
                        ]);
                        const bytesByUrl = new Map([
                            ['https://cdn.1a-1791.com/a.ts', new Uint8Array([1, 2, 3])],
                            ['https://cdn.1a-1791.com/b.ts', new Uint8Array([4, 5])],
                            ['https://cdn.1a-1791.com/direct.ts', new Uint8Array([9, 8])],
                        ]);
                        globalThis.fetch = async (input) => {
                            const url = String(input instanceof Request ? input.url : input);
                            if (payloads.has(url)) return new Response(payloads.get(url), { status: 200 });
                            if (bytesByUrl.has(url)) return new Response(bytesByUrl.get(url), { status: 200 });
                            return new Response('', { status: 404 });
                        };
                        const makeWritable = () => {
                            const state = { bytes: [], closed: false, aborted: false };
                            return {
                                state,
                                async write(chunk) { state.bytes.push(...new Uint8Array(chunk)); },
                                async close() { state.closed = true; },
                                async abort() { state.aborted = true; },
                            };
                        };
                        try {
                            VideoDownloader._hlsUrl = 'https://rumble.com/master.m3u8';
                            const writable = makeWritable();
                            const progress = [];
                            const normal = await VideoDownloader._streamHlsToWritable(
                                { height: 720, label: '720p' }, writable, {
                                    onProgress: (entry) => progress.push(entry),
                                },
                            );
                            await writable.close();

                            const abortedWritable = makeWritable();
                            const controller = new AbortController();
                            let abortName = null;
                            try {
                                await VideoDownloader._streamHlsToWritable(
                                    { height: 720, label: '720p' }, abortedWritable, {
                                        signal: controller.signal,
                                        onProgress: ({ completed }) => {
                                            if (completed === 1) controller.abort();
                                        },
                                    },
                                );
                            } catch (error) {
                                abortName = error?.name || String(error);
                                await abortedWritable.abort();
                            }

                            VideoDownloader._hlsUrl = 'https://rumble.com/direct.m3u8';
                            const directWritable = makeWritable();
                            const direct = await VideoDownloader._streamHlsToWritable(
                                { height: 720, label: '720p' }, directWritable,
                            );
                            return {
                                normal,
                                normalBytes: writable.state.bytes,
                                normalClosed: writable.state.closed,
                                progress,
                                abortName,
                                abortedBytes: abortedWritable.state.bytes,
                                abortCalled: abortedWritable.state.aborted,
                                direct,
                                directBytes: directWritable.state.bytes,
                            };
                        } finally {
                            globalThis.fetch = originalFetch;
                            VideoDownloader._hlsUrl = originalHls;
                        }
                    })();
                }
                throw new Error(`Unknown shared-parity operation: ${name}`);
            },
            args: [operation, callArgs],
        });
        if (result?.error) throw new Error(String(result.error.message || result.error));
        return result?.result;
    }, { id: targetTabId, operation: action, callArgs: args });
}

test('modern card adapter drives related, keyword, progress, and channel features', async ({ context, serviceWorker }) => {
    const page = await openWatch(context);
    const id = await tabId(serviceWorker, page.url());
    await expect.poll(() => inContent(serviceWorker, id, 'videoCardsReady')).toBe(true);
    await expect.poll(() => inContent(serviceWorker, id, 'settingsReady')).toBe(true);

    const cards = await inContent(serviceWorker, id, 'cards');
    expect(cards).toEqual([
        { title: 'Alpha Report', channel: 'Creator Alpha', id: 'valpha123' },
        { title: 'Beta Briefing', channel: 'Creator Beta', id: 'vbeta456' },
    ]);

    const filtered = await inContent(serviceWorker, id, 'relatedFilter', ['beta']);
    expect(filtered).toEqual([true, false]);

    const watched = await inContent(serviceWorker, id, 'watchedFilter');
    expect(watched).toEqual([{ hidden: true, progress: true }, { hidden: false, progress: false }]);

    const keyword = await inContent(serviceWorker, id, 'keywordFilter');
    expect(keyword).toEqual([true, false]);
});

test('Theater has usable geometry, keyboard semantics, exit, and route remounting', async ({ context, serviceWorker }) => {
    const page = await openWatch(context);
    const id = await tabId(serviceWorker, page.url());
    await expect(page.locator('#rx-split-wrapper')).toBeVisible({ timeout: 15_000 });

    await expect.poll(async () => (await inContent(serviceWorker, id, 'theaterGeometry')).rightWidth, {
        timeout: 2_000,
    }).toBeGreaterThan(200);
    const geometry = await inContent(serviceWorker, id, 'theaterGeometry');
    expect(geometry.rightWidth).toBeGreaterThan(200);
    // Chromium can report a nominal 6px CSS track a few hundredths below
    // six after fractional layout/device scaling. Keep the assertion focused
    // on a usable divider rather than exact floating-point rasterization.
    expect(geometry.dividerWidth).toBeGreaterThanOrEqual(5.5);
    expect(geometry.separatorRole).toBe('separator');
    expect(geometry.closeLabel).toBe('Exit theater mode');
    expect(geometry.commentsCount).toBe(1);

    await page.locator('#rx-theater-close').click();
    await expect(page.locator('#rx-split-wrapper')).toHaveCount(0);
    await expect(page.locator('#comments-host > #video-comments[data-fixture-identity="original"]')).toHaveCount(1);

    await page.evaluate(() => {
        history.pushState({}, '', '/');
        document.body.innerHTML = '<main id="home-fixture">Home</main>';
        document.dispatchEvent(new CustomEvent('htmx:afterSettle', { bubbles: true }));
    });
    await expect(page.locator('#rx-split-wrapper')).toHaveCount(0);

    await page.evaluate((markup) => {
        history.pushState({}, '', '/vroute456-route-remount.html');
        const parsed = new DOMParser().parseFromString(markup, 'text/html');
        document.body.replaceChildren(...parsed.body.childNodes);
        document.dispatchEvent(new CustomEvent('htmx:afterSettle', { bubbles: true }));
    }, FIXTURE);
    await expect(page.locator('#rx-split-wrapper')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#rx-split-left #videoPlayer')).toHaveCount(1);
});

test('shared trust boundaries reject malicious settings, media URLs, and modified shortcuts', async ({ context, serviceWorker }) => {
    const page = await openWatch(context);
    const id = await tabId(serviceWorker, page.url());
    await expect.poll(() => inContent(serviceWorker, id, 'settingsReady')).toBe(true);

    const result = await inContent(serviceWorker, id, 'trustBoundaries');
    expect(result.__error).toBeUndefined();

    expect(result.clean.autoplayQueue).toEqual(['https://rumble.com/valpha123-safe.html']);
    expect(result.clean.hiddenCategories).toEqual(['shorts']);
    expect(result.clean.splitRatio).toBe(95);
    expect(result.clean.playbackSpeed).toBe(0.1);
    expect(result.clean.theme).toBeUndefined();
    expect(result.clean.sponsorSegments.valpha123).toEqual([{ start: 5, end: 9, category: 'sponsor' }]);
    expect(result.hlsShapes).toHaveLength(4);
    expect(result.hlsShapes.every((url) => url?.startsWith('https://'))).toBe(true);
    expect(result.rejectedHls).toBeNull();
    expect(result.modifiedPrevented).toBe(false);
    expect(result.plainPrevented).toBe(true);
});

test('privacy report exposes the request-shield mode and critical selector health', async ({ context, serviceWorker }) => {
    const page = await openWatch(context, 'vmodern-health-report.html');
    const id = await tabId(serviceWorker, page.url());
    await expect.poll(() => inContent(serviceWorker, id, 'settingsReady')).toBe(true);

    const report = await inContent(serviceWorker, id, 'privacyReport');
    expect(report.requestShield).toEqual({
        active: true,
        enforcement: 'chromium-dnr',
        declaredRules: 7,
        assurance: 'runtime-enforced',
    });
    expect(report.selectorHealth.status).toBe('healthy');
    expect(report.selectorHealth.page).toBe('watch');
    expect(report.selectorHealth.missing).toEqual([]);
    expect(report.selectorHealth.checks).toEqual(expect.arrayContaining([
        { key: 'watch.player', state: 'stable' },
        { key: 'watch.relatedCard', state: 'stable' },
    ]));
});

test('HLS TS streams to a selected file in bounded chunks and aborts partial work', async ({ context, serviceWorker }) => {
    const page = await openWatch(context, 'vmodern-stream-to-disk.html');
    const id = await tabId(serviceWorker, page.url());
    await expect.poll(() => inContent(serviceWorker, id, 'settingsReady')).toBe(true);

    const result = await inContent(serviceWorker, id, 'streamToDisk');
    expect(result.normal).toEqual({ bytes: 5, segments: 2 });
    expect(result.normalBytes).toEqual([1, 2, 3, 4, 5]);
    expect(result.normalClosed).toBe(true);
    expect(result.progress).toEqual([
        { completed: 1, total: 2, bytes: 3 },
        { completed: 2, total: 2, bytes: 5 },
    ]);
    expect(result.abortName).toBe('AbortError');
    expect(result.abortedBytes).toEqual([1, 2, 3]);
    expect(result.abortCalled).toBe(true);
    expect(result.direct).toEqual({ bytes: 2, segments: 1 });
    expect(result.directBytes).toEqual([9, 8]);
});

test('in-page settings reports extension request blocking separately from Ad Nuker', async ({ context }) => {
    const page = await openWatch(context, 'vmodern-shield-settings.html');
    await page.locator('#rx-settings-btn').waitFor({ state: 'attached', timeout: 15_000 });
    await page.evaluate(() => document.querySelector('#rx-settings-btn')?.click());
    await expect(page.locator('.rx-m-shield-status')).not.toHaveClass(/is-limited/);
    await expect(page.locator('.rx-m-shield-title')).toHaveText('Network shield active');
    await expect(page.locator('.rx-m-shield-note')).toHaveText('7 verified request rules · Chromium DNR');
    await expect(page.locator('div.rx-m-card[data-feature-id="adNuker"]')).toContainText('after the network shield runs');
});

test('a feature whose init throws reverts its switch instead of reporting success', async ({ context, serviceWorker }) => {
    const page = await openWatch(context, 'vhot-toggle-failure.html');
    const id = await tabId(serviceWorker, page.url());

    const outcome = await serviceWorker.evaluate(async (targetTabId) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            world: 'ISOLATED',
            func: async () => {
                const feature = features.find((f) => f.id && f.init && f.destroy);
                if (!feature) throw new Error('no lifecycle feature available');
                const originalInit = feature.init;
                const originalValue = Settings.get(feature.id);
                Settings.set(feature.id, false);
                feature.init = () => { throw new Error('synthetic init failure'); };
                try {
                    const wrap = SettingsPanel._makeSwitch(feature.id, '#ffffff', feature.id);
                    document.body.appendChild(wrap);
                    const input = wrap.querySelector('input[type="checkbox"]');
                    input.checked = true;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    const result = {
                        switchReverted: input.checked === false,
                        settingReverted: Settings.get(feature.id) === false,
                        recorded: RxErrorLog._buf.some((entry) => entry.context === 'hot-toggle init'),
                    };
                    wrap.remove();
                    return result;
                } finally {
                    feature.init = originalInit;
                    Settings.set(feature.id, originalValue);
                }
            },
        });
        return execution.result;
    }, id);

    expect(outcome.switchReverted).toBe(true);
    expect(outcome.settingReverted).toBe(true);
    // Capture is unconditional now, so the failure is recorded even with the
    // debug surfacing setting off.
    expect(outcome.recorded).toBe(true);
});
