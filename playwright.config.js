// @ts-check
// RumbleX Playwright E2E config — v3.5.0
// Loads the MV3 extension via --disable-extensions-except + --load-extension
// using the `chromium` channel. Chrome-branded builds dropped those switches,
// so the bundled Chromium is required. Modern Chromium headless loads
// extensions normally; `headless: 'new'` is no longer a valid Playwright value
// and is rejected outright. Set RUMBLEX_HEADED=1 for a visible run.
const { defineConfig, devices } = require('@playwright/test');
const path = require('path');

const EXTENSION_PATH = path.join(__dirname, 'extension');

module.exports = defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,            // extension state is shared per profile
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,                      // one Chromium per run; extensions don't multi-context cleanly
    reporter: process.env.CI ? [['github'], ['list']] : 'list',
    use: {
        // Persistent context is created per-test in the helper because
        // launchPersistentContext signature differs from .use defaults.
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium-mv3',
            use: {
                ...devices['Desktop Chrome'],
                // The default Chrome channel supports MV3 extensions.
                channel: 'chromium',
                launchOptions: {
                    headless: process.env.RUMBLEX_HEADED !== '1',
                    args: [
                        `--disable-extensions-except=${EXTENSION_PATH}`,
                        `--load-extension=${EXTENSION_PATH}`,
                        // Match the Selectors registry's assumptions about htmx events
                        // firing; disable any web-app-isolation that might trip a fresh
                        // service-worker spawn.
                        '--no-first-run',
                        '--disable-features=DisableLoadExtensionCommandLineSwitch',
                    ],
                },
            },
        },
    ],
});
