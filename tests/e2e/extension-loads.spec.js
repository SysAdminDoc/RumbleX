// @ts-check
// Smoke test: extension loads and registers a service worker.
const { test, expect } = require('./_fixtures');

test('extension service worker boots within 15s', async ({ serviceWorker, extensionId }) => {
    expect(serviceWorker).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/);
});

test('options page renders with snapshot + privacy sections', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    // App-bar version chip rendered from manifest
    await expect(page.locator('#version')).toHaveText(/^v\d+\.\d+\.\d+$/);
    // Stats overview present
    await expect(page.locator('#stat-features')).toBeVisible();
    // v3.1.0 backup snapshot section + v3.1.0 privacy report section present
    await expect(page.locator('#snapshot-section')).toBeVisible();
    await expect(page.locator('#privacy-section')).toBeVisible();
    // "Open Settings Editor" CTA exists
    await expect(page.locator('#open-settings-modal-btn')).toBeVisible();
});

test('popup renders feature groups with toggles', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await expect(page.locator('#version')).toHaveText(/^v\d+\.\d+\.\d+$/);
    // At least one toggle should be present and tab-reachable.
    const firstToggle = page.locator('input[type="checkbox"]').first();
    await expect(firstToggle).toBeVisible();
    await expect(firstToggle).toHaveAttribute('aria-label', /.+/);
    await expect(firstToggle).not.toHaveAttribute('aria-pressed');
});

test('options and popup consume localized UI messages', async ({ context, extensionId }) => {
    await context.addInitScript(() => {
        window.__RUMBLEX_TEST_I18N = {
            openSettingsEditor: 'Localized Settings Editor',
            privacyReport: 'Localized Privacy Report',
            groupAdBlocking: 'Localized Ad Controls',
            themeLabel: 'Localized Theme',
            searchSettings: 'Localized search',
        };
    });

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await expect(options.locator('#open-settings-modal-btn')).toHaveText('Localized Settings Editor');
    await expect(options.locator('#privacy-heading')).toHaveText('Localized Privacy Report');
    await options.locator('#open-settings-modal-btn').click();
    await expect(options.locator('#settings-search')).toHaveAttribute('placeholder', 'Localized search');
    await expect(options.locator('#settings-groups button[data-group="ad-blocking"]')).toHaveText(/Localized Ad Controls/);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await expect(popup.locator('#open-options')).toContainText('Localized Settings Editor');
    await expect(popup.locator('.feat-group-header').first()).toContainText('Localized Ad Controls');
    await expect(popup.locator('.theme-label')).toHaveText('Localized Theme');
});
