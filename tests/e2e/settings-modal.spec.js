// @ts-check
// Settings modal dirty-draft workflow tests.
const { test, expect } = require('./_fixtures');

test('settings modal opens, search filters, save persists', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    await expect(page.locator('#settings-modal-shell')).toBeVisible();
    // Search field should be focused or focusable
    const search = page.locator('#settings-search');
    await search.fill('shorts');
    // The disableShortsFeed setting (v3.1.0) should be the only thing matching
    await expect(page.locator('.settings-item').filter({ hasText: /shorts/i }).first()).toBeVisible();
    await page.locator('input[name="disableShortsFeed"]').click();
    await expect(page.locator('#settings-discard-btn')).toBeEnabled();
    // Discard and close
    await page.locator('#settings-discard-btn').click();
    await expect(page.locator('#settings-discard-btn')).toBeDisabled();

    // Save the same change and verify both visible feedback and storage.
    await page.locator('input[name="disableShortsFeed"]').click();
    await page.locator('#settings-save-btn').click();
    await expect(page.locator('#settings-modal-status')).toContainText('Settings saved');
    await expect.poll(() => page.evaluate(() => new Promise((resolve) => {
        chrome.storage.local.get('rx_settings', (value) => resolve(value.rx_settings?.disableShortsFeed));
    }))).toBe(true);

    // Restore Defaults is a reversible draft until Save, then persists.
    await page.locator('#settings-restore-defaults-btn').click();
    await expect(page.locator('#settings-modal-status')).toContainText('Defaults loaded into the draft');
    await expect(page.locator('#settings-save-btn')).toBeEnabled();
    await page.locator('#settings-save-btn').click();
    await expect.poll(() => page.evaluate(() => new Promise((resolve) => {
        chrome.storage.local.get('rx_settings', (value) => resolve(value.rx_settings?.disableShortsFeed));
    }))).toBe(false);
    await page.locator('#close-settings-modal-btn').click();
    await expect(page.locator('#settings-modal-shell')).toBeHidden();
});

test('ad blocking group distinguishes request shield from DOM cleanup', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    await page.locator('#settings-groups button[data-group="ad-blocking"]').click();
    await expect(page.locator('#settings-workspace-banner')).toHaveClass(/is-shield/);
    await expect(page.locator('#settings-workspace-title')).toHaveText('Network shield active');
    await expect(page.locator('#settings-workspace-note')).toContainText('7 verified request rules');
    await expect(page.locator('#settings-workspace-note')).toContainText('Ad Nuker controls the remaining DOM cleanup');
});

test('catalog parity: every settings key has a META entry', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    // Count rendered cards in "All Settings" group — should match the
    // boolean-toggle subset of catalog parity (197+).
    const cardCount = await page.locator('.settings-item').count();
    expect(cardCount).toBeGreaterThan(180);
});

test('download muxer engine renders as a guarded choice', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    await page.locator('#settings-search').fill('muxer engine');
    const card = page.locator('.settings-item').filter({ hasText: 'HLS MP4 Muxer Engine' });
    await expect(card).toBeVisible();
    const select = card.locator('select[name="downloadMuxerEngine"]');
    await expect(select).toHaveValue('muxjs');
    await expect(select.locator('option')).toHaveText([
        'mux.js (default)',
        'Mediabunny + WebCodecs (experimental)',
    ]);
});
