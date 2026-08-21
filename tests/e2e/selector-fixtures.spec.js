// @ts-check
// Current, privacy-safe desktop captures gate the stable selector path. The
// older private MHTML set remains useful for legacy coverage, but it cannot
// prove that today's custom elements still resolve without a fallback.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'platform');
const CASES = [
    {
        name: 'desktop-home.html',
        path: '/',
        route: 'home',
        surfaces: ['header.root', 'nav.mainMenu', 'search.form', 'search.input',
            'feed.card', 'feed.cardTitle', 'feed.author', 'modal.portal'],
    },
    {
        name: 'desktop-watch.html',
        path: '/vfixture201-watch-video.html',
        route: 'watch',
        surfaces: ['header.root', 'watch.media', 'watch.player', 'watch.title',
            'watch.share', 'watch.description', 'watch.related',
            'watch.relatedCard', 'comments.root', 'modal.portal'],
    },
    {
        name: 'desktop-search.html',
        path: '/search/all?q=fixture',
        route: 'search',
        surfaces: ['header.root', 'nav.mainMenu', 'search.form', 'search.input',
            'feed.card', 'feed.cardTitle', 'feed.author', 'modal.portal'],
    },
    {
        name: 'desktop-channel.html',
        path: '/c/fixture-channel',
        route: 'channel',
        surfaces: ['header.root', 'nav.mainMenu', 'search.form', 'search.input',
            'feed.card', 'feed.cardTitle', 'feed.author', 'modal.portal'],
    },
];

function fixture(name) {
    return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
}

async function findTabId(serviceWorker, url) {
    return serviceWorker.evaluate(async (targetUrl) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === targetUrl);
        if (!tab?.id) throw new Error(`Selector fixture tab not found: ${targetUrl}`);
        return tab.id;
    }, url);
}

async function inspect(serviceWorker, tabId, surfaces) {
    return serviceWorker.evaluate(async ({ id, names }) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: (surfaceNames) => {
                if (typeof Page === 'undefined' || typeof Selectors === 'undefined') {
                    return { ready: false };
                }
                const states = {};
                for (const name of surfaceNames) {
                    const entry = Selectors._map[name];
                    let stable = false;
                    let fallback = false;
                    try { stable = !!entry?.stable && !!document.querySelector(entry.stable); } catch {}
                    try { fallback = !!entry?.fallback && !!document.querySelector(entry.fallback); } catch {}
                    states[name] = { stable, fallback };
                }
                return {
                    ready: true,
                    route: Page.classify(),
                    health: Selectors.healthCheck(),
                    states,
                };
            },
            args: [names],
        });
        return execution?.result || { ready: false };
    }, { id: tabId, names: surfaces });
}

test('sanitized desktop fixtures resolve every current surface through stable selectors', async ({ context, serviceWorker }) => {
    const bodies = new Map(CASES.map((entry) => [new URL(`https://rumble.com${entry.path}`).pathname, fixture(entry.name)]));
    await context.route('https://rumble.com/**', (route) => {
        const body = bodies.get(new URL(route.request().url()).pathname);
        return route.fulfill({
            status: body ? 200 : 404,
            contentType: body ? 'text/html' : 'application/json',
            body: body || '{}',
        });
    });

    for (const entry of CASES) {
        const page = await context.newPage();
        await page.goto(`https://rumble.com${entry.path}`, { waitUntil: 'domcontentloaded' });
        const tabId = await findTabId(serviceWorker, page.url());
        let result;
        await expect.poll(async () => {
            result = await inspect(serviceWorker, tabId, entry.surfaces);
            return result.ready && entry.surfaces.every((name) => result.states[name]?.stable);
        }, {
            message: `${entry.name} did not resolve every stable selector`,
            timeout: 15_000,
        }).toBe(true);

        expect(result.route).toBe(entry.route);
        expect(result.health).toEqual(expect.objectContaining({ status: 'healthy', page: entry.route }));
        expect(result.health.missing).toEqual([]);
        expect(result.health.fallback).toEqual([]);
        await page.close();
    }
});

test('current custom card exposes creator metadata without a legacy author link', async ({ context, serviceWorker }) => {
    const url = 'https://rumble.com/custom-card-fixture';
    await context.route(url, (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: fixture('desktop-custom-card.html'),
    }));
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const tabId = await findTabId(serviceWorker, page.url());

    let result;
    await expect.poll(async () => {
        result = await serviceWorker.evaluate(async (id) => {
            const [execution] = await chrome.scripting.executeScript({
                target: { tabId: id },
                world: 'ISOLATED',
                func: () => {
                    if (typeof VideoCards === 'undefined' || typeof Selectors === 'undefined') {
                        return { ready: false };
                    }
                    const card = VideoCards.all()[0];
                    return {
                        ready: !!card,
                        count: VideoCards.all().length,
                        title: card ? VideoCards.title(card) : '',
                        channel: card ? VideoCards.channel(card) : '',
                        url: card ? VideoCards.url(card) : '',
                        videoId: card ? VideoCards.videoId(card) : null,
                        thumbnail: card ? VideoCards.thumbnail(card)?.tagName : null,
                        authorSurface: Selectors.find('feed.author')?.tagName || null,
                        legacyAuthorLinks: document.querySelectorAll('a[rel="author"], .channel__link').length,
                    };
                },
            });
            return execution?.result || { ready: false };
        }, tabId);
        return result.ready;
    }, { timeout: 15_000 }).toBe(true);

    expect(result).toEqual({
        ready: true,
        count: 1,
        title: 'Fixture Custom Card',
        channel: 'Fixture Creator',
        url: 'https://rumble.com/vfixture501-custom-card.html',
        videoId: 'vfixture501',
        thumbnail: 'IMG',
        authorSurface: 'RUM-VIDEO-THUMBNAIL',
        legacyAuthorLinks: 0,
    });
});

test('post-migration channel fixture keeps the embedded listing contract', async ({ context, serviceWorker }) => {
    const url = 'https://rumble.com/c/fixture-channel';
    await context.route(url, (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: fixture('desktop-channel.html'),
    }));
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const tabId = await findTabId(serviceWorker, page.url());

    let result;
    await expect.poll(async () => {
        result = await serviceWorker.evaluate(async (id) => {
            const [execution] = await chrome.scripting.executeScript({
                target: { tabId: id },
                world: 'ISOLATED',
                func: () => {
                    if (typeof ChannelListing === 'undefined') return { ready: false };
                    const items = ChannelListing.forPath(ChannelListing.parse(), location.pathname);
                    return {
                        ready: true,
                        count: items.length,
                        type: items[0]?.object_type,
                        relativeUrl: items[0]?.relative_url,
                        owner: items[0]?.by?.relative_url,
                        rendition: items[0]?.videos?.[0]?.url,
                    };
                },
            });
            return execution?.result || { ready: false };
        }, tabId);
        return result.ready;
    }, { timeout: 15_000 }).toBe(true);

    expect(result).toEqual({
        ready: true,
        count: 1,
        type: 'video',
        relativeUrl: '/vfixture401-channel-video.html',
        owner: '/c/fixture-channel',
        rendition: 'https://cdn.example.invalid/fixture-240.mp4',
    });
});

test('desktop capture files contain synthetic structure only', () => {
    const names = [...CASES.map((entry) => entry.name), 'desktop-custom-card.html'];
    for (const name of names) {
        const html = fixture(name);
        expect(html, name).not.toMatch(/\b(?:e9s|sci|fbclid|utm_[a-z_]+)=/i);
        expect(html, name).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
        expect(html, name).not.toMatch(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
        for (const match of html.matchAll(/https?:\/\/[^"'\s<]+/g)) {
            expect(new URL(match[0]).hostname, `${name}: ${match[0]}`).toMatch(/\.invalid$/);
        }
    }
});
