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
    await expect(page.locator('.network-shield-title')).toHaveText('Network shield active');
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
    await expect(page.locator('.popup-shield')).toHaveText('Network shield active');
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

test('update check compares versions numerically and reports rate limiting distinctly', async ({ context, extensionId, serviceWorker }) => {
    // The handler runs in the service worker, so fetch is stubbed there; the
    // message has to originate elsewhere because a worker does not receive its
    // own runtime messages.
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const ask = () => page.evaluate(() => new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkUpdate' }, resolve);
    }));
    const stubRelease = (tag) => serviceWorker.evaluate((releaseTag) => {
        globalThis.__rxRealFetch ||= globalThis.fetch;
        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ tag_name: releaseTag, html_url: 'https://example.invalid/release' }),
        });
    }, tag);
    const stubFailure = (status, headers) => serviceWorker.evaluate(({ code, head }) => {
        globalThis.__rxRealFetch ||= globalThis.fetch;
        globalThis.fetch = async () => ({ ok: false, status: code, headers: new Headers(head) });
    }, { code: status, head: headers });

    try {
        const current = await page.evaluate(() => chrome.runtime.getManifest().version);

        // A published release older than the installed build is the exact state
        // that previously produced a downgrade prompt.
        await stubRelease('v3.26.0');
        expect((await ask()).hasUpdate).toBe(false);

        await stubRelease('v' + current);
        expect((await ask()).hasUpdate).toBe(false);

        await stubRelease('v999.0.0');
        expect((await ask()).hasUpdate).toBe(true);

        await stubFailure(403, { 'X-RateLimit-Remaining': '0' });
        expect(await ask()).toMatchObject({ rateLimited: true });

        await stubFailure(500, {});
        const broken = await ask();
        expect(broken.rateLimited).toBe(false);
        expect(broken.error).toContain('500');
    } finally {
        await serviceWorker.evaluate(() => {
            if (globalThis.__rxRealFetch) globalThis.fetch = globalThis.__rxRealFetch;
        });
    }
});
