// @ts-check
// Opt-in capture of the Chrome Web Store / AMO / Edge listing images.
//
// Store review rejects an image that is not EXACTLY the required size, so
// every asset is captured at a fixed viewport with `fullPage: false` and then
// re-read from disk and checked against the dimension the store demands. A
// screenshot that silently came out 1279 wide is worse than a missing one:
// it fails at submission time, long after anyone looks at this.
//
//   RUMBLEX_STORE_CAPTURE=1 npx playwright test tests/e2e/store-assets.spec.js
//
// Kept opt-in and out of the default run for the same reason the design mockup
// capture is: it writes tracked binaries into design/.
const { test, expect } = require('./_fixtures');
const fs = require('node:fs');
const path = require('node:path');

const ENABLED = process.env.RUMBLEX_STORE_CAPTURE === '1';
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'design', 'store');
const PROMO = path.join(OUT, 'promo.html');
const MODERN_WATCH_FIXTURE = fs.readFileSync(
    path.join(ROOT, 'tests', 'fixtures', 'platform', 'modern-watch.html'),
    'utf8',
);

// Chrome Web Store: screenshots must be 1280x800 or 640x400, the small
// promo tile exactly 440x280, the marquee exactly 1400x560.
const SCREENSHOT_SIZES = [
    { width: 1280, height: 800 },
    { width: 640, height: 400 },
];

/**
 * PNG dimensions live in the IHDR chunk: 8-byte signature, 4-byte length,
 * 4-byte type, then width and height as big-endian uint32. Reading them
 * directly avoids adding an image dependency for one assertion.
 */
function pngSize(file) {
    const buf = fs.readFileSync(file);
    const signature = buf.subarray(0, 8).toString('hex');
    if (signature !== '89504e470d0a1a0a') throw new Error(`${file} is not a PNG`);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test.describe('store listing assets', () => {
    test.skip(!ENABLED, 'opt-in: set RUMBLEX_STORE_CAPTURE=1');

    test('capture every required store image at its exact required size', async ({ context, extensionId }) => {
        test.setTimeout(180_000);
        fs.mkdirSync(OUT, { recursive: true });
        const written = [];

        for (const size of SCREENSHOT_SIZES) {
            const suffix = `${size.width}x${size.height}`;

            // 1. Options home — the first thing a reviewer opens.
            const options = await context.newPage();
            await options.setViewportSize(size);
            await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
            await options.waitForTimeout(700);
            const optionsHome = path.join(OUT, `screenshot-1-options-${suffix}.png`);
            await options.screenshot({ path: optionsHome, fullPage: false });
            written.push([optionsHome, size]);

            // 2. The settings editor, which is where the 208-key catalog shows.
            await options.locator('#open-settings-modal-btn').click();
            await expect(options.locator('#settings-modal-shell')).toBeVisible();
            await options.locator('#settings-groups button[data-group="ad-blocking"]').click();
            await options.waitForTimeout(350);
            const editor = path.join(OUT, `screenshot-2-editor-${suffix}.png`);
            await options.screenshot({ path: editor, fullPage: false });
            written.push([editor, size]);

            // 3. The privacy report — the listing leans on it, so it is shown.
            await options.keyboard.press('Escape');
            await options.waitForTimeout(250);
            const privacy = options.locator('#privacy-report, [data-section="privacy"]').first();
            if (await privacy.count()) {
                await privacy.scrollIntoViewIfNeeded();
                await options.waitForTimeout(250);
            }
            const privacyShot = path.join(OUT, `screenshot-3-privacy-${suffix}.png`);
            await options.screenshot({ path: privacyShot, fullPage: false });
            written.push([privacyShot, size]);
            await options.close();

            // 4. The in-page settings modal on a real watch page.
            const injected = await context.newPage();
            await injected.setViewportSize(size);
            await injected.route('https://rumble.com/vstore-capture.html', (route) => route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: MODERN_WATCH_FIXTURE,
            }));
            await injected.goto('https://rumble.com/vstore-capture.html', { waitUntil: 'domcontentloaded' });
            await injected.locator('#rx-settings-btn').waitFor({ state: 'attached', timeout: 15_000 });
            await injected.evaluate(() => document.querySelector('#rx-settings-btn')?.click());
            await injected.waitForFunction(() => document.body.classList.contains('rx-panel-open'));
            await injected.waitForTimeout(300);
            const inPage = path.join(OUT, `screenshot-4-in-page-${suffix}.png`);
            await injected.screenshot({ path: inPage, fullPage: false });
            written.push([inPage, size]);
            await injected.close();

            // 5. The popup, letterboxed onto the store canvas. The popup is
            //    440px wide by design, so it is centred on a matching backdrop
            //    rather than upscaled into a blurry mess.
            const popupShell = await context.newPage();
            await popupShell.setViewportSize(size);
            await popupShell.goto(`chrome-extension://${extensionId}/pages/popup.html`);
            await popupShell.waitForTimeout(400);
            const popupShot = path.join(OUT, `screenshot-5-popup-${suffix}.png`);
            await popupShell.screenshot({ path: popupShot, fullPage: false });
            written.push([popupShot, size]);
            await popupShell.close();
        }

        // Promotional images, both rendered from design/store/promo.html.
        const promos = [
            { variant: 'tile', file: 'promo-tile-440x280.png', size: { width: 440, height: 280 } },
            { variant: 'marquee', file: 'promo-marquee-1400x560.png', size: { width: 1400, height: 560 } },
        ];
        for (const promo of promos) {
            const page = await context.newPage();
            await page.setViewportSize(promo.size);
            await page.goto(`file://${PROMO.split(path.sep).join('/')}`);
            await page.evaluate((variant) => {
                document.documentElement.dataset.variant = variant;
            }, promo.variant);
            // The icon is a real file:// image; make sure it decoded before the
            // shot, or the mark is missing from the asset that ships.
            await page.waitForFunction(() => {
                const img = document.querySelector('img.mark');
                return !!img && img.complete && img.naturalWidth > 0;
            }, null, { timeout: 10_000 });
            await page.waitForTimeout(150);
            const out = path.join(OUT, promo.file);
            await page.screenshot({ path: out, fullPage: false });
            written.push([out, promo.size]);
            await page.close();
        }

        // Every asset is re-read from disk: the store rejects off-by-one sizes,
        // and that failure would otherwise only surface at submission.
        const wrong = [];
        for (const [file, expected] of written) {
            const actual = pngSize(file);
            if (actual.width !== expected.width || actual.height !== expected.height) {
                wrong.push(`${path.basename(file)}: ${actual.width}x${actual.height}, expected ${expected.width}x${expected.height}`);
            }
        }
        expect(wrong, `assets captured at the wrong size:\n  ${wrong.join('\n  ')}`).toEqual([]);
        expect(written.length).toBe(SCREENSHOT_SIZES.length * 5 + 2);
    });
});
