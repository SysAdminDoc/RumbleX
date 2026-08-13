// @ts-check
// Generated-distribution smoke: no extension APIs or userscript manager are
// present beyond the explicit GM contract below.
const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const USERSCRIPT = fs.readFileSync(path.join(ROOT, 'RumbleX.user.js'), 'utf8');
const FIXTURE = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'platform', 'modern-watch.html'), 'utf8');
const GM_BOOTSTRAP = `
(() => {
    const values = new Map([['rx_settings', {
        schemaVersion: 2,
        theaterSplit: false,
        videoDownload: true,
        channelArchiveButton: true,
    }]]);
    let nextListener = 1;
    globalThis.GM_getValue = (key, fallback) => values.has(key) ? values.get(key) : fallback;
    globalThis.GM_setValue = (key, value) => { values.set(key, value); };
    globalThis.GM_deleteValue = (key) => { values.delete(key); };
    globalThis.GM_addValueChangeListener = () => nextListener++;
    globalThis.GM_removeValueChangeListener = () => {};
    globalThis.GM_xmlhttpRequest = (options) => {
        queueMicrotask(() => options.onerror?.({ status: 0, statusText: 'fixture blocked request' }));
        return { abort() {} };
    };
    globalThis.GM_download = (options) => {
        queueMicrotask(() => options.onload?.());
        return { abort() {} };
    };
})();
`;

test('generated userscript boots without extension APIs and keeps standalone downloads usable', async () => {
    const x = Number.parseInt(process.env.RUMBLEX_TEST_WINDOW_X || '0', 10);
    const y = Number.parseInt(process.env.RUMBLEX_TEST_WINDOW_Y || '0', 10);
    const browser = await chromium.launch({
        headless: false,
        args: [`--window-position=${x},${y}`, '--window-size=1280,900', '--no-first-run'],
    });
    try {
        const context = await browser.newContext();
        await context.addInitScript({ content: GM_BOOTSTRAP + '\n' + USERSCRIPT });
        await context.route('https://rumble.com/**', (route) => {
            const pathname = new URL(route.request().url()).pathname;
            if (pathname === '/vmodern123-userscript-fixture.html') {
                return route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE });
            }
            return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
        });

        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
        await page.goto('https://rumble.com/vmodern123-userscript-fixture.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);
        await expect(page.locator('#rx-settings-btn')).toBeVisible({ timeout: 15_000 });
        await page.locator('#rx-settings-btn').click();
        await expect(page.locator('.rx-m-shield-status')).toHaveClass(/is-limited/);
        await expect(page.locator('.rx-m-shield-title')).toHaveText('Network shield depends on your userscript manager');
        await page.keyboard.press('Escape');
        await expect(page.locator('#rx-split-wrapper')).toHaveCount(0);
        await expect(page.locator('#rx-download-btn')).toBeVisible();
        await page.locator('#rx-download-btn').click();
        await expect(page.locator('#rx-download-overlay.open')).toBeVisible();

        const platform = await page.evaluate(() => ({
            kind: globalThis.RumbleXPlatform?.kind,
            version: globalThis.RumbleXPlatform?.version,
            persistentBackground: globalThis.RumbleXPlatform?.capabilities?.persistentBackground,
            mediabunny: globalThis.RumbleXPlatform?.capabilities?.mediabunny,
            requestBlocking: globalThis.RumbleXPlatform?.capabilities?.requestBlocking,
            chromeRuntimeType: typeof globalThis.chrome?.runtime,
        }));
        expect(platform).toEqual({
            kind: 'userscript',
            version: VERSION,
            persistentBackground: false,
            mediabunny: true,
            requestBlocking: false,
            chromeRuntimeType: 'undefined',
        });
        expect(pageErrors).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});
