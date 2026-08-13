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
                if (name === 'settingsReady') return typeof Settings !== 'undefined';
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
    expect(geometry.dividerWidth).toBeGreaterThanOrEqual(6);
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
