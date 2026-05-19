// @ts-check
// Shared Playwright fixtures for the RumbleX E2E suite.
// Spawns a persistent Chromium context with the MV3 extension pre-loaded.
const { test: base, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const EXTENSION_PATH = path.join(__dirname, '..', '..', 'extension');

// Each test gets its own temp profile so we don't accidentally share rx_settings.
exports.test = base.extend({
    context: async ({}, use) => {
        const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rumblex-pw-'));
        const context = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                '--no-first-run',
                '--disable-features=DisableLoadExtensionCommandLineSwitch',
            ],
        });
        await use(context);
        await context.close();
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
    },

    // Service worker handle — the MV3 background script. Useful for messaging
    // tests that exercise message-API surfaces (snapshot, privacy, telemetry).
    serviceWorker: async ({ context }, use) => {
        let sw = context.serviceWorkers()[0];
        if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
        await use(sw);
    },

    // Extension ID is generated per-load. Grab it from the service-worker URL
    // (chrome-extension://<id>/background.js).
    extensionId: async ({ serviceWorker }, use) => {
        const url = serviceWorker.url();
        const m = url.match(/^chrome-extension:\/\/([^/]+)\//);
        await use(m ? m[1] : null);
    },
});

exports.expect = base.expect;
