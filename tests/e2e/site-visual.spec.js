// @ts-check
// Opt-in live visual capture for the Rumble surfaces changed by RumbleX.
const { test, expect } = require('./_fixtures');
const fs = require('node:fs');
const path = require('node:path');

const ENABLED = process.env.RUMBLEX_SITE_VISUAL_CAPTURE === '1';
const VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_WATCH_URL = 'https://rumble.com/v7dtm3y-live-president-trump-participates-in-an-american-mining-roundtable-080726.html';

async function setSettings(context, extensionId, patch) {
    const settingsPage = await context.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await settingsPage.evaluate(async (next) => {
        const stored = await chrome.storage.local.get('rx_settings');
        await chrome.storage.local.set({
            rx_settings: { ...(stored.rx_settings || {}), ...next },
        });
    }, patch);
    await settingsPage.close();
}

test.describe('live site visual capture', () => {
    test.skip(!ENABLED, 'opt-in: set RUMBLEX_SITE_VISUAL_CAPTURE=1');

    test('capture themed site, theater split, and player tools', async ({ context, extensionId }) => {
        test.setTimeout(180_000);
        const outputDir = path.join(__dirname, '..', '..', 'design', 'mockups', 'site-implementation');
        fs.mkdirSync(outputDir, { recursive: true });

        await setSettings(context, extensionId, {
            darkEnhance: true,
            theme: 'catppuccin',
            theaterSplit: false,
            screenshotBtn: true,
            videoStats: true,
            loopControl: true,
            shareTimestamp: true,
        });

        const page = await context.newPage();
        await page.setViewportSize(VIEWPORT);
        await page.goto('https://rumble.com/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.locator('body').waitFor({ state: 'visible' });
        await page.waitForTimeout(3_000);
        const acceptCookies = page.getByRole('button', { name: 'Accept All', exact: true });
        if (await acceptCookies.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await acceptCookies.click();
            await page.waitForTimeout(500);
        }
        await page.screenshot({ path: path.join(outputDir, 'site-home-1440x900.png'), fullPage: false });

        const watchUrl = process.env.RUMBLEX_SITE_VISUAL_URL || DEFAULT_WATCH_URL;
        expect(watchUrl).toMatch(/^https:\/\/rumble\.com\/v/i);

        await page.goto(watchUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.locator('#videoPlayer, .videoPlayer-Rumble-cls').first().waitFor({ state: 'visible', timeout: 30_000 });
        await page.waitForTimeout(2_000);
        await page.screenshot({ path: path.join(outputDir, 'site-watch-1440x900.png'), fullPage: false });

        await setSettings(context, extensionId, { theaterSplit: true });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
        await expect(page.locator('#rx-split-wrapper')).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(1_000);
        await page.screenshot({ path: path.join(outputDir, 'theater-collapsed-1440x900.png'), fullPage: false });

        await page.locator('#rx-split-reveal').click();
        await expect(page.locator('#rx-split-right')).toHaveClass(/rx-expanded/);
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(outputDir, 'theater-split-1440x900.png'), fullPage: false });

        const tools = page.locator('.rx-player-tools-trigger:visible').first();
        await expect(tools).toBeVisible({ timeout: 10_000 });
        await tools.click();
        await expect(page.locator('.rx-player-tools-menu')).toBeVisible();
        await expect(page.locator('.rx-player-tools')).toHaveCSS('opacity', '1');
        await expect(page.locator('.rx-player-tools-menu')).toHaveCSS('background-color', 'rgb(9, 12, 17)');
        await page.screenshot({ path: path.join(outputDir, 'theater-player-tools-1440x900.png'), fullPage: false });

        await page.close();
    });
});
