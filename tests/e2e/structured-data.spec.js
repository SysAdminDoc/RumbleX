// @ts-check
// PageData reads Rumble's schema.org VideoObject, which is the most stable
// description of a video on a watch page. These tests pin the extraction, the
// behaviour when the block is absent or malformed, and the fact that it never
// replaces the DOM card layer.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const fixture = (name) => fs.readFileSync(
    path.join(__dirname, '..', 'fixtures', 'platform', name),
    'utf8',
);

const STRUCTURED = fixture('structured-watch.html');
const PLAIN = fixture('modern-watch.html');

async function openFixture(context, slug, body) {
    const url = `https://rumble.com/${slug}`;
    await context.route(url, (route) => route.fulfill({ status: 200, contentType: 'text/html', body }));
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return page;
}

// content.js lives in the ISOLATED world, so PageData is unreachable from
// page.evaluate. Everything has to go through the service worker.
async function readPageData(serviceWorker, url) {
    return serviceWorker.evaluate(async (target) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === target);
        if (!tab?.id) throw new Error('fixture tab not found');
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'ISOLATED',
            func: () => ({
                available: PageData.available(),
                title: PageData.title(),
                description: PageData.description(),
                duration: PageData.durationSeconds(),
                uploadDate: PageData.uploadDate(),
                views: PageData.viewCount(),
                embedId: PageData.embedId(),
                thumbnail: PageData.thumbnailUrl(),
                structuredData: Selectors.healthCheck().structuredData,
                cardsStillWork: typeof VideoCards !== 'undefined' && typeof VideoCards.all === 'function',
            }),
        });
        return result.result;
    }, url);
}

test('watch-page structured data is read from the schema.org VideoObject', async ({ context, serviceWorker }) => {
    const url = 'https://rumble.com/vstruct01-structured-fixture-episode-12.html';
    await openFixture(context, 'vstruct01-structured-fixture-episode-12.html', STRUCTURED);
    const data = await readPageData(serviceWorker, url);

    expect(data.available).toBe(true);
    expect(data.title).toBe('Structured Fixture Episode 12');
    expect(data.description).toContain('synthetic watch page');
    // PT01H36M12S
    expect(data.duration).toBe(5772);
    expect(data.uploadDate).toBe('2026-08-18T12:26:21+00:00');
    expect(data.views).toBe(535349);
    // The embed id is not the id in the page URL, which is the whole reason
    // this is worth reading rather than parsing the address bar.
    expect(data.embedId).toBe('vembed99');
    expect(data.thumbnail).toBe('https://sp.rmbl.ws/s8/6/fixture-thumb.jpg');
});

test('a malformed JSON-LD block does not hide a valid one', async ({ context, serviceWorker }) => {
    // The fixture puts an unparseable block before the VideoObject on purpose.
    const url = 'https://rumble.com/vstruct02-structured-fixture-episode-12.html';
    await openFixture(context, 'vstruct02-structured-fixture-episode-12.html', STRUCTURED);
    const data = await readPageData(serviceWorker, url);
    expect(data.available).toBe(true);
    expect(data.title).toBe('Structured Fixture Episode 12');
});

test('a watch page without structured data degrades to null rather than throwing', async ({ context, serviceWorker }) => {
    const url = 'https://rumble.com/vplain01-modern-fixture-video.html';
    await openFixture(context, 'vplain01-modern-fixture-video.html', PLAIN);
    const data = await readPageData(serviceWorker, url);

    expect(data.available).toBe(false);
    expect(data.title).toBe('');
    expect(data.duration).toBeNull();
    expect(data.uploadDate).toBeNull();
    expect(data.views).toBeNull();
    expect(data.embedId).toBeNull();
    // The card layer is what features actually depend on, and it must be
    // untouched by any of this.
    expect(data.cardsStillWork).toBe(true);
});

test('selector health reports the structured-data layer separately', async ({ context, serviceWorker }) => {
    const withData = 'https://rumble.com/vstruct03-structured-fixture-episode-12.html';
    await openFixture(context, 'vstruct03-structured-fixture-episode-12.html', STRUCTURED);
    expect((await readPageData(serviceWorker, withData)).structuredData).toBe('present');

    const withoutData = 'https://rumble.com/vplain02-modern-fixture-video.html';
    await openFixture(context, 'vplain02-modern-fixture-video.html', PLAIN);
    expect((await readPageData(serviceWorker, withoutData)).structuredData).toBe('absent');
});
