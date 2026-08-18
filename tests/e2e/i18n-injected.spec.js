// @ts-check
// Proves the in-page UI actually renders in a non-English locale.
//
// Four locales x 111 keys used to localize only the extension's own pages: the
// settings modal, every feature panel, every toast and every error in
// extension/content.js was a hardcoded English literal, and `check-i18n.js`
// could not see that because it never scanned the shared core.
//
// `chrome.i18n.getMessage` resolves against the browser's UI locale, and
// nothing in-page can override it — RXPlatform is Object.freeze'd, so a stub is
// a silent no-op. So each locale gets its own Chromium launched with `--lang`,
// which is the only thing that actually changes what a user would see.
const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = path.join(__dirname, '..', '..');
const EXTENSION_PATH = path.join(ROOT, 'extension');
const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(ROOT, 'rumble_decoded.html'), 'utf8');

const catalog = (locale) => JSON.parse(
    fs.readFileSync(path.join(EXTENSION_PATH, '_locales', locale, 'messages.json'), 'utf8'),
);

// One key from each surface the roadmap item names, so a regression in any of
// the three fails rather than being masked by the other two.
const PROBES = [
    { key: 'modalTheme', surface: 'settings modal' },
    { key: 'dlTitle', surface: 'download panel' },
    { key: 'toastEnabled', surface: 'toasts' },
    { key: 'toastReloadToApply', surface: 'toasts' },
    { key: 'modalSearchFeatures', surface: 'settings modal' },
    { key: 'dlCancel', surface: 'download panel' },
    // The 137 feature labels and 124 descriptions are the bulk of the modal and
    // are rendered from RX_CATEGORIES through rxFeatLabel/rxFeatDesc.
    { key: 'cat_ad_blocking_label', surface: 'settings modal categories' },
    { key: 'feat_adNuker_label', surface: 'settings modal features' },
    { key: 'feat_adNuker_desc', surface: 'settings modal features' },
    { key: 'feat_hideFooter_desc', surface: 'settings modal features' },
];

for (const locale of ['de', 'es', 'pt_BR']) {
    test(`injected UI renders in ${locale}`, async () => {
        const en = catalog('en');
        const translated = catalog(locale);

        const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), `rumblex-i18n-${locale}-`));
        const context = await chromium.launchPersistentContext(userDataDir, {
            headless: process.env.RUMBLEX_HEADED !== '1',
            channel: 'chromium',
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                '--no-first-run',
                '--disable-features=DisableLoadExtensionCommandLineSwitch',
                // chrome.i18n picks the catalog from the UI locale. Chromium
                // expects the BCP-47 form, so pt_BR is passed as pt-BR.
                `--lang=${locale.replace('_', '-')}`,
            ],
        });

        try {
            const page = await context.newPage();
            await page.route('**/*', (route) => {
                const url = route.request().url();
                if (url.startsWith('https://rumble.com/')) {
                    return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
                }
                return route.abort();
            });
            await page.goto(`https://rumble.com/vfixture-i18n-${locale}.html`, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });

            let sw = context.serviceWorkers()[0];
            if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15_000 });
            const tabId = await sw.evaluate(async (url) => {
                const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
                if (!tab?.id) throw new Error('fixture tab not found');
                return tab.id;
            }, page.url());

            // rxT lives in the isolated world alongside the rest of the core.
            const resolved = await sw.evaluate(async ({ id, keys }) => {
                const [execution] = await chrome.scripting.executeScript({
                    target: { tabId: id },
                    world: 'ISOLATED',
                    args: [keys],
                    func: (probeKeys) => Object.fromEntries(
                        probeKeys.map((key) => [key, rxT(key, '<<fallback>>')]),
                    ),
                });
                return execution.result;
            }, { id: tabId, keys: PROBES.map((probe) => probe.key) });

            for (const probe of PROBES) {
                const expected = translated[probe.key]?.message;
                expect(expected, `${locale} catalog is missing ${probe.key}`).toBeTruthy();
                expect(resolved[probe.key], `${probe.surface}: ${probe.key} did not resolve in ${locale}`)
                    .toBe(expected);
                // If a translation happened to equal the English text the
                // assertion above would pass while proving nothing, so require
                // these particular probes to actually differ.
                expect(resolved[probe.key], `${probe.key} is identical to English in ${locale}`)
                    .not.toBe(en[probe.key].message);
            }
        } finally {
            await context.close();
            try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch { /* temp dir */ }
        }
    });
}
