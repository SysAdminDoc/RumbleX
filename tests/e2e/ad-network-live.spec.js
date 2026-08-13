// @ts-check
// Opt-in cold-load audit for Rumble's current ad/request surface. The default
// suite remains deterministic; release audits enable this explicitly.
const { test, expect } = require('./_fixtures');
const fs = require('node:fs');
const path = require('node:path');

const LIVE = process.env.RUMBLEX_AD_NETWORK_AUDIT === '1';
const EXPECT_BLOCKING = process.env.RUMBLEX_EXPECT_REQUEST_BLOCKING === '1';
const TARGETS = [
    { name: 'home', url: 'https://rumble.com/' },
    { name: 'watch', url: process.env.RUMBLEX_LIVE_URL || 'https://rumble.com/v7e46xm-the-democrat-death-cult-rages-on-scrolling-w-hayley-ep.-360-08132026.html' },
];

const AD_REQUEST_RE = /(^https:\/\/a\.ads\.rmbl\.ws(?:[/:?#]|$)|imasdk\.googleapis\.com|s0\.2mdn\.net\/instream\/video\/|pagead2\.googlesyndication\.com\/omsdk\/|(?:[^/]+\.)?doubleclick\.net|(?:[^/]+\.)?googleadservices\.com\/pagead\/|^https:\/\/(?:[^/]+\.)?rumble\.com\/l\/[^?]*\?.*(?:[?&])af=)/i;

test.describe('live request-level ad audit', () => {
    test.skip(!LIVE, 'opt-in: set RUMBLEX_AD_NETWORK_AUDIT=1');

    test('cold loads have no visible ad DOM or completed ad requests', async ({ context }) => {
        test.setTimeout(120_000);
        const outputDir = path.join(__dirname, '..', '..', 'work', 'ad-audit');
        fs.mkdirSync(outputDir, { recursive: true });
        const suffix = EXPECT_BLOCKING ? 'after-request-blocking' : 'before-request-blocking';
        const results = [];

        for (const target of TARGETS) {
            const page = await context.newPage();
            await page.setViewportSize({ width: 1440, height: 900 });
            const requests = [];
            const completedAdRequests = [];
            const failed = [];
            page.on('request', (request) => {
                const url = request.url();
                if (/^https?:/i.test(url)) requests.push({ url, method: request.method(), type: request.resourceType() });
            });
            page.on('response', (response) => {
                const url = response.url();
                if (AD_REQUEST_RE.test(url)) completedAdRequests.push({ url, status: response.status(), type: response.request().resourceType() });
            });
            page.on('requestfailed', (request) => {
                failed.push({ url: request.url(), type: request.resourceType(), error: request.failure()?.errorText || '' });
            });

            await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
            await page.waitForTimeout(12_000);
            const dom = await page.evaluate(() => {
                const nodes = [...document.querySelectorAll([
                    '#pause-ads__container',
                    '.host-read-ad-entry',
                    '.js-host-read-container',
                    '.js-rac-desktop-container',
                    '.js-rac-tablet-container',
                    '.js-rac-mobile-container',
                    'iframe[src*="googlead"]',
                    'iframe[src*="doubleclick"]',
                    'iframe[src*="pagead"]',
                    '.ima-sdk-frame',
                    '[data-ad]',
                ].join(','))];
                return {
                    title: document.title,
                    url: location.href,
                    rxBooted: !!document.querySelector('#rx-settings-panel-css, style[data-rx], #rx-settings-btn'),
                    adNodes: nodes.map((node) => ({
                        tag: node.tagName,
                        id: node.id,
                        className: String(node.className || '').slice(0, 180),
                        src: node.getAttribute('src') || '',
                        visible: !!(node.getClientRects().length && getComputedStyle(node).display !== 'none'),
                    })),
                };
            });
            await page.screenshot({ path: path.join(outputDir, `${target.name}-${suffix}.png`), fullPage: false });
            results.push({ target, dom, requests, completedAdRequests, failed });
            await page.close();
        }

        fs.writeFileSync(path.join(outputDir, `network-${suffix}.json`), `${JSON.stringify(results, null, 2)}\n`);
        if (EXPECT_BLOCKING) {
            for (const result of results) {
                expect(result.dom.rxBooted).toBeTruthy();
                expect(result.dom.adNodes.filter((node) => node.visible)).toEqual([]);
                expect(result.completedAdRequests).toEqual([]);
            }
        }
    });
});
