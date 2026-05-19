// @ts-check
// RumbleX Playwright E2E config — v3.5.0
// Loads the MV3 extension via --disable-extensions-except + --load-extension
// using the `chromium` channel. headless: 'new' is required because the legacy
// headless mode does not support extensions.
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
                    // headless: 'new' is needed for extensions in headless mode.
                    headless: false,    // forced to headed via --headed override or for local debug
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
