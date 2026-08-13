// @ts-check
// Current Rumble search results use article.video-item cards rather than the
// home-feed rum-video-thumbnail custom element. These assertions keep every
// shared card consumer on the same adapter contract.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const FIXTURE = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'platform', 'modern-search.html'), 'utf8');

async function tabId(serviceWorker, url) {
    return serviceWorker.evaluate(async (target) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === target);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, url);
}

async function selectorHealth(serviceWorker, targetTabId) {
    return serviceWorker.evaluate(async (id) => {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            func: () => Selectors.healthCheck(),
        });
        return result.result;
    }, targetTabId);
}

test('modern search cards drive filtering, save, batch, title, thumbnail, and health features', async ({ context, serviceWorker }) => {
    await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            rx_settings: {
                schemaVersion: 2,
                adNuker: false,
                darkEnhance: false,
                quickSave: true,
                batchDownload: true,
                keywordFilter: true,
                blockedKeywords: ['blocked topic'],
                blockedKeywordsMode: 'literal',
                fullTitles: true,
                titleFont: true,
                hideThumbnails: true,
                watchProgress: true,
                stripTrackingParams: true,
            },
        });
    });
    await context.route('https://rumble.com/**', (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/search/video') {
            return route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE });
        }
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });

    const page = await context.newPage();
    await page.addInitScript(() => {
        localStorage.setItem('rx_watch_progress', JSON.stringify({
            vsearch101: { t: 50, d: 100, ts: Date.now() },
        }));
    });
    await page.goto('https://rumble.com/search/video?q=fixture&utm_campaign=test', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#rx-settings-btn')).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('article.video-item')).toHaveCount(2);
    await expect(page.locator('article.video-item .rx-quick-save')).toHaveCount(2, { timeout: 5_000 });
    await expect(page.locator('article.video-item .rx-batch-chk')).toHaveCount(2);
    await expect(page.locator('article.video-item .rx-progress-bar')).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator('article.video-item').nth(1)).toHaveClass(/rx-kw-hidden/);

    const visualContract = await page.locator('article.video-item').first().evaluate((card) => {
        const title = card.querySelector('.video-item--title');
        const image = card.querySelector('.video-item--img');
        return {
            titleWhiteSpace: getComputedStyle(title).whiteSpace,
            titleWeight: getComputedStyle(title).fontWeight,
            imageVisibility: getComputedStyle(image).visibility,
        };
    });
    expect(visualContract.titleWhiteSpace).toBe('normal');
    expect(Number(visualContract.titleWeight)).toBeLessThanOrEqual(500);
    expect(visualContract.imageVisibility).toBe('hidden');

    await page.locator('article.video-item').first().locator('.rx-quick-save').click();
    const bookmarks = await page.evaluate(() => JSON.parse(localStorage.getItem('rx_bookmarks') || '[]'));
    expect(bookmarks).toEqual([expect.objectContaining({
        url: 'https://rumble.com/vsearch101-alpha-report.html',
        title: 'Alpha Report',
        channel: 'Creator Alpha',
    })]);

    await page.locator('article.video-item').first().locator('.rx-batch-chk').click();
    await expect(page.locator('.rx-batch-bar')).toHaveClass(/visible/);
    await expect(page.locator('.rx-batch-count')).toHaveText('1 selected');

    const state = await selectorHealth(serviceWorker, await tabId(serviceWorker, page.url()));
    expect(state).toEqual(expect.objectContaining({ status: 'healthy', page: 'search' }));
    expect(state.missing).not.toContain('feed.card');
    expect(page.url()).not.toContain('utm_campaign');
});

test('batch card cleanup supports disable and re-enable without a reload', async ({ context, serviceWorker }) => {
    await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({ rx_settings: { schemaVersion: 2, batchDownload: true } });
    });
    await context.route('https://rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: FIXTURE,
    }));
    const page = await context.newPage();
    await page.goto('https://rumble.com/search/video?q=fixture', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.rx-batch-chk')).toHaveCount(2, { timeout: 15_000 });

    await page.locator('#rx-settings-btn').click();
    await page.locator('#rx-nav-downloads').click();
    const toggle = page.locator('input[data-feature-id="batchDownload"]');
    await toggle.setChecked(false);
    await expect(page.locator('.rx-batch-chk')).toHaveCount(0);
    await expect(page.locator('.rx-batch-bar')).toHaveCount(0);
    await toggle.setChecked(true);
    await expect(page.locator('.rx-batch-chk')).toHaveCount(2);
    await expect(page.locator('.rx-batch-bar')).toHaveCount(1);
});
