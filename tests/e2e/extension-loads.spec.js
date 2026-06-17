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
