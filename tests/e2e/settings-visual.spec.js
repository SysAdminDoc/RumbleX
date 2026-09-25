// @ts-check
// Opt-in visual capture for the desktop settings surfaces. Product-design
// audits use `reference`; implementation QA writes a separate `implementation`
// set so the source images are never overwritten.
const { test, expect } = require('./_fixtures');
const fs = require('node:fs');
const path = require('node:path');

const MODE = process.env.RUMBLEX_VISUAL_CAPTURE || '';
const ENABLED = MODE === 'reference' || MODE === 'implementation';
const WIDE = process.env.RUMBLEX_VISUAL_WIDE === '1';
const DESKTOP_VIEWPORT = WIDE ? { width: 1920, height: 1080 } : { width: 1440, height: 900 };
const DESKTOP_SUFFIX = WIDE ? '1920x1080' : '1440x900';
const MODERN_WATCH_FIXTURE = fs.readFileSync(
    path.join(__dirname, '..', 'fixtures', 'platform', 'modern-watch.html'),
    'utf8',
);

test.describe('desktop settings visual capture', () => {
    test.skip(!ENABLED, 'opt-in: set RUMBLEX_VISUAL_CAPTURE=reference|implementation');

    test('capture all distinct settings surfaces', async ({ context, extensionId }) => {
        test.setTimeout(120_000);
        const outputDir = path.join(
            __dirname,
            '..',
            '..',
            'design',
            'mockups',
            MODE === 'reference' ? 'references' : (WIDE ? 'implementation-wide' : 'implementation'),
        );
        fs.mkdirSync(outputDir, { recursive: true });

        const options = await context.newPage();
        await options.setViewportSize(DESKTOP_VIEWPORT);
        await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
        await options.waitForTimeout(700);
        await expect(options.locator('body')).not.toHaveCSS('overflow-x', 'scroll');
        await options.screenshot({ path: path.join(outputDir, `options-home-${DESKTOP_SUFFIX}.png`), fullPage: false });

        await options.locator('#welcome-dismiss-btn').click();
        await expect(options.locator('#welcome-panel')).toBeHidden();
        await options.screenshot({ path: path.join(outputDir, `options-dashboard-${DESKTOP_SUFFIX}.png`), fullPage: false });

        await options.locator('#open-settings-modal-btn').click();
        await expect(options.locator('#settings-modal-shell')).toBeVisible();
        await options.locator('#settings-groups button[data-group="ad-blocking"]').click();
        await options.waitForTimeout(350);
        await options.screenshot({ path: path.join(outputDir, `options-editor-ad-blocking-${DESKTOP_SUFFIX}.png`), fullPage: false });

        const firstToggle = options.locator('#settings-list input[type="checkbox"]:enabled').first();
        await firstToggle.click();
        await expect(options.locator('#settings-dirty-count')).not.toHaveText('0');
        await options.screenshot({ path: path.join(outputDir, `options-editor-dirty-${DESKTOP_SUFFIX}.png`), fullPage: false });
        await options.locator('#settings-discard-btn').click();

        await options.locator('#settings-search').fill('no setting matches this visual audit');
        await expect(options.locator('#settings-empty')).toBeVisible();
        await options.screenshot({ path: path.join(outputDir, `options-editor-empty-${DESKTOP_SUFFIX}.png`), fullPage: false });
        await options.locator('#settings-clear-search-btn').click();

        if (!WIDE) {
            await options.setViewportSize({ width: 760, height: 560 });
            await options.waitForTimeout(200);
            await expect(options.locator('#settings-list')).toBeVisible();
            await options.screenshot({ path: path.join(outputDir, 'options-editor-narrow-760x560.png'), fullPage: false });
            await options.setViewportSize(DESKTOP_VIEWPORT);
        }

        const popup = await context.newPage();
        await popup.setViewportSize({ width: 440, height: 600 });
        await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
        await popup.waitForTimeout(350);
        await expect(popup.locator('.footer')).toBeVisible();
        const popupLayout = await popup.evaluate(() => {
            const featureList = document.querySelector('.features').getBoundingClientRect();
            const footer = document.querySelector('.footer').getBoundingClientRect();
            return {
                viewportHeight: innerHeight,
                featureListHeight: featureList.height,
                featureListScrolls: document.querySelector('.features').scrollHeight > document.querySelector('.features').clientHeight,
                footerTop: footer.top,
                footerBottom: footer.bottom,
            };
        });
        expect(popupLayout.featureListHeight).toBeGreaterThan(100);
        expect(popupLayout.featureListScrolls).toBe(true);
        expect(popupLayout.footerTop).toBeGreaterThan(0);
        expect(popupLayout.footerBottom).toBeLessThanOrEqual(popupLayout.viewportHeight);
        await popup.screenshot({ path: path.join(outputDir, 'popup-440x600.png'), fullPage: false });

        const injected = await context.newPage();
        await injected.setViewportSize(DESKTOP_VIEWPORT);
        await injected.route('https://rumble.com/vmodern-settings.html', (route) => route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: MODERN_WATCH_FIXTURE,
        }));
        await injected.goto('https://rumble.com/vmodern-settings.html', { waitUntil: 'domcontentloaded' });
        await injected.locator('#rx-settings-btn').waitFor({ state: 'attached', timeout: 15_000 });
        await injected.evaluate(() => document.querySelector('#rx-settings-btn')?.click());
        await injected.waitForFunction(() => document.body.classList.contains('rx-panel-open'));
        await injected.waitForTimeout(250);
        await injected.screenshot({ path: path.join(outputDir, `in-page-settings-${DESKTOP_SUFFIX}.png`), fullPage: false });

        if (!WIDE) {
            await injected.setViewportSize({ width: 640, height: 400 });
            await injected.waitForTimeout(200);
            await expect(injected.locator('.rx-m-content')).toBeVisible();
            await injected.screenshot({ path: path.join(outputDir, 'in-page-settings-narrow-640x400.png'), fullPage: false });
        }

        await Promise.all([options.close(), popup.close(), injected.close()]);
    });
});
