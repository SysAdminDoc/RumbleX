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
const WATCH_URL = 'https://rumble.com/vmodern123-userscript-fixture.html';
const CDN_MP4 = 'https://hugh.cdn.1a-1791.com/video/s8/2/userscript720.mp4';
// An MP4's first box header, so the saved bytes are recognisably the served ones.
const MP4_BYTES = [0, 0, 0, 24, 102, 116, 121, 112];
// The published size is a real video's: the panel drops a rendition too small
// to be the video before it offers a row.
const EMBED = JSON.stringify({
    ua: { mp4: { 720: { url: CDN_MP4, meta: { h: 720, w: 1280, bitrate: 2500, size: 300 * 1024 * 1024 } } } },
});
const GM_STORAGE = `
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
`;
const GM_BOOTSTRAP = `
(() => {
    ${GM_STORAGE}
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
// A manager with GM_xmlhttpRequest and no GM_download. The MP4 is served only
// to a blob request, and held until the test releases it so the in-progress
// status can be read.
const UNMANAGED_BOOTSTRAP = `
(() => {
    ${GM_STORAGE}
    const gm = globalThis.__rxGm = {
        mode: 'serve',
        requests: [],
        aborted: false,
        held: null,
        release() { const send = gm.held; gm.held = null; send?.(); },
    };
    globalThis.GM_xmlhttpRequest = (options) => {
        gm.requests.push({ url: options.url, responseType: options.responseType || '' });
        let aborted = false;
        const request = { abort() { aborted = true; gm.aborted = true; } };
        if (options.url !== ${JSON.stringify(CDN_MP4)} || options.responseType !== 'blob') {
            queueMicrotask(() => options.onerror?.({ status: 0, statusText: 'fixture blocked request' }));
            return request;
        }
        if (gm.mode === 'large') {
            queueMicrotask(() => {
                options.onprogress?.({ lengthComputable: true, loaded: 65536, total: 900 * 1024 * 1024 });
                if (!aborted) options.onload?.({ status: 200, response: new Blob([new Uint8Array(8)]) });
            });
            return request;
        }
        gm.held = () => options.onload?.({
            status: 200,
            response: new Blob([new Uint8Array(${JSON.stringify(MP4_BYTES)})]),
            responseHeaders: 'Content-Type: video/mp4',
        });
        return request;
    };
})();
`;

// Headless like every other spec. This one alone was pinned headed, which put
// a real browser window on the desktop of whoever ran the suite. A visible run
// is still available on purpose with RUMBLEX_HEADED=1.
function launchBrowser() {
    const headed = process.env.RUMBLEX_HEADED === '1';
    const x = Number.parseInt(process.env.RUMBLEX_TEST_WINDOW_X || '0', 10);
    const y = Number.parseInt(process.env.RUMBLEX_TEST_WINDOW_Y || '0', 10);
    return chromium.launch({
        headless: !headed,
        args: headed
            ? [`--window-position=${x},${y}`, '--window-size=1280,900', '--no-first-run']
            : ['--window-size=1280,900', '--no-first-run'],
    });
}

// Everything stays on this machine: the watch page and its embed payload are
// served here, anything else on rumble.com is a 404 and every other host is
// refused.
async function openWatch(browser, bootstrap) {
    const context = await browser.newContext();
    await context.addInitScript({ content: bootstrap + '\n' + USERSCRIPT });
    await context.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'rumble.com') return route.abort();
        if (url.pathname === '/vmodern123-userscript-fixture.html') {
            return route.fulfill({ status: 200, contentType: 'text/html', body: FIXTURE });
        }
        if (url.pathname.startsWith('/embedJS/')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: EMBED });
        }
        return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
    await page.goto(WATCH_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    return { context, page, pageErrors };
}

async function openDownloadPanel(page) {
    await page.locator('#rx-download-btn').waitFor({ state: 'attached', timeout: 15_000 });
    await page.evaluate(() => document.querySelector('#rx-download-btn')?.click());
    await expect(page.locator('#rx-download-overlay.open')).toBeVisible();
}

test('generated userscript boots without extension APIs and keeps standalone downloads usable', async () => {
    const browser = await launchBrowser();
    try {
        const { context, page, pageErrors } = await openWatch(browser, GM_BOOTSTRAP);
        await page.locator('#rx-settings-btn').waitFor({ state: 'attached', timeout: 15_000 });
        await page.evaluate(() => document.querySelector('#rx-settings-btn')?.click());
        await expect(page.locator('.rx-m-shield-status')).toHaveClass(/is-limited/);
        await expect(page.locator('.rx-m-shield-title')).toHaveText('Network shield depends on your userscript manager');
        await page.keyboard.press('Escape');
        await expect(page.locator('#rx-split-wrapper')).toHaveCount(0);
        await openDownloadPanel(page);

        const platform = await page.evaluate(() => ({
            kind: globalThis.RumbleXPlatform?.kind,
            version: globalThis.RumbleXPlatform?.version,
            persistentBackground: globalThis.RumbleXPlatform?.capabilities?.persistentBackground,
            mediabunny: globalThis.RumbleXPlatform?.capabilities?.mediabunny,
            requestBlocking: globalThis.RumbleXPlatform?.capabilities?.requestBlocking,
            requestBlockingMode: globalThis.RumbleXPlatform?.capabilities?.requestBlockingMode,
            chromeRuntimeType: typeof globalThis.chrome?.runtime,
        }));
        expect(platform).toEqual({
            kind: 'userscript',
            version: VERSION,
            persistentBackground: false,
            mediabunny: true,
            requestBlocking: false,
            requestBlockingMode: 'userscript-manager-dependent',
            chromeRuntimeType: 'undefined',
        });
        expect(pageErrors).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});

test('without GM_download a direct MP4 comes through the manager and saves under its own name, and the tab stays put', async () => {
    const browser = await launchBrowser();
    try {
        const { context, page, pageErrors } = await openWatch(browser, UNMANAGED_BOOTSTRAP);
        await openDownloadPanel(page);
        const row = page.locator('.rx-dl-quality[data-key^="720"]');
        await expect(row).toBeVisible({ timeout: 15_000 });

        const downloadPromise = page.waitForEvent('download');
        await row.locator('.rx-dl-quality-row-inner').click();
        // The whole file arrives before the browser sees it, and the panel
        // says so rather than "starting" for minutes.
        await expect(page.locator('.rx-dl-status')).toHaveText(/through your userscript manager/);
        await page.evaluate(() => globalThis.__rxGm.release());
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/ - 720p\.mp4$/);
        expect([...fs.readFileSync(await download.path())]).toEqual(MP4_BYTES);
        await expect(page.locator('.rx-dl-done')).toBeVisible();

        // The CDN link was never handed to an anchor: the tab is where it was
        // and the only transfer of the file was the manager's blob request.
        expect(page.url()).toBe(WATCH_URL);
        const blobRequests = await page.evaluate(() => globalThis.__rxGm.requests
            .filter((request) => request.responseType === 'blob').map((request) => request.url));
        expect(blobRequests).toEqual([CDN_MP4]);
        expect(pageErrors).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});

test('without GM_download a file over the in-tab cap is refused in plain words and its transfer stopped', async () => {
    const browser = await launchBrowser();
    try {
        const { context, page, pageErrors } = await openWatch(browser, UNMANAGED_BOOTSTRAP);
        const downloads = [];
        page.on('download', (download) => downloads.push(download.suggestedFilename()));
        await page.evaluate(() => { globalThis.__rxGm.mode = 'large'; });
        await openDownloadPanel(page);
        const row = page.locator('.rx-dl-quality[data-key^="720"]');
        await expect(row).toBeVisible({ timeout: 15_000 });
        await row.locator('.rx-dl-quality-row-inner').click();

        const error = page.locator('.rx-dl-error');
        await expect(error).toContainText('This file is 900 MB');
        await expect(error).toContainText('up to 512 MB');
        const guide = page.locator('#rx-download-overlay .rx-dl-failure');
        await expect(guide).toHaveAttribute('data-kind', 'manager');
        await expect(guide.locator('.rx-dl-failure-next')).toContainText('Tampermonkey and Violentmonkey');
        expect(await page.evaluate(() => globalThis.__rxGm.aborted)).toBe(true);
        expect(downloads).toEqual([]);
        expect(page.url()).toBe(WATCH_URL);
        expect(pageErrors).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});
