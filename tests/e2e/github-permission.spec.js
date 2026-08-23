// @ts-check
const { test, expect } = require('./_fixtures');

const GITHUB_ORIGIN = 'https://api.github.com/*';

async function mockPermissionRequest(page, granted) {
    await page.evaluate((allow) => {
        globalThis.__rxGithubPermissionRequests = 0;
        globalThis.__rxGithubPermissionPayload = null;
        globalThis.__RUMBLEX_TEST_PERMISSION_API = {
            request: (payload, callback) => {
                globalThis.__rxGithubPermissionRequests += 1;
                globalThis.__rxGithubPermissionPayload = payload;
                if (typeof callback === 'function') callback(allow);
                return Promise.resolve(allow);
            },
        };
    }, granted);
}

test('loaded Chrome requests GitHub only from the update click and does not fetch after denial', async ({ context, serviceWorker, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    const manifest = await popup.evaluate(() => chrome.runtime.getManifest());
    expect(manifest.host_permissions || []).not.toContain(GITHUB_ORIGIN);
    expect(manifest.optional_host_permissions || []).toContain(GITHUB_ORIGIN);

    await mockPermissionRequest(popup, false);
    await serviceWorker.evaluate(() => {
        globalThis.__rxGithubPermissionFetches = 0;
        globalThis.__rxGithubPermissionFetch = globalThis.fetch;
        globalThis.fetch = async (url, init) => {
            if (String(url).startsWith('https://api.github.com/')) {
                globalThis.__rxGithubPermissionFetches += 1;
            }
            return globalThis.__rxGithubPermissionFetch(url, init);
        };
    });

    expect(await popup.evaluate(() => globalThis.__rxGithubPermissionRequests)).toBe(0);
    await popup.locator('#btn-update').click();
    await expect(popup.locator('#btn-update')).toHaveClass(/error/);
    await expect(popup.locator('#btn-update')).toHaveAttribute(
        'data-tooltip',
        'GitHub access was not granted. No request was sent.',
    );
    expect(await popup.evaluate(() => globalThis.__rxGithubPermissionRequests)).toBe(1);
    expect(await popup.evaluate(() => globalThis.__rxGithubPermissionPayload)).toEqual({ origins: [GITHUB_ORIGIN] });
    expect(await serviceWorker.evaluate(() => globalThis.__rxGithubPermissionFetches)).toBe(0);
});

test('loaded Chrome grant path sends one update request after the click', async ({ context, serviceWorker, extensionId }) => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await mockPermissionRequest(popup, true);
    await serviceWorker.evaluate(() => {
        globalThis.__rxGithubGrantFetches = 0;
        globalThis.__rxGithubGrantFetch = globalThis.fetch;
        globalThis.fetch = async (url, init) => {
            if (String(url).includes('/repos/SysAdminDoc/RumbleX/releases/latest')) {
                globalThis.__rxGithubGrantFetches += 1;
                return new Response(JSON.stringify({
                    tag_name: 'v99.0.0',
                    html_url: 'https://github.com/SysAdminDoc/RumbleX/releases/tag/v99.0.0',
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return globalThis.__rxGithubGrantFetch(url, init);
        };
    });

    expect(await popup.evaluate(() => globalThis.__rxGithubPermissionRequests)).toBe(0);
    await popup.locator('#btn-update').click();
    await expect(popup.locator('#btn-update')).toHaveClass(/has-update/);
    await expect(popup.locator('#btn-update')).toHaveAttribute('data-tooltip', 'Update available: v99.0.0');
    expect(await popup.evaluate(() => globalThis.__rxGithubPermissionRequests)).toBe(1);
    expect(await serviceWorker.evaluate(() => globalThis.__rxGithubGrantFetches)).toBe(1);
});

test('Gist denial is localized and sends no background request', async ({ context, serviceWorker, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await options.evaluate(() => chrome.storage.local.set({
        rx_settings: {
            schemaVersion: 4,
            encryptedGistSync: true,
            encryptedGistSyncToken: 'github_pat_permission_fixture',
            encryptedGistSyncId: 'gist-permission-fixture',
        },
    }));
    await options.reload();
    await expect(options.locator('#gist-sync-token-input')).toHaveValue('github_pat_permission_fixture');
    await expect(options.locator('#gist-sync-id-input')).toHaveValue('gist-permission-fixture');
    await options.locator('#gist-sync-section summary').click();
    await options.locator('#gist-sync-passphrase-input').fill('correct horse battery staple');
    await mockPermissionRequest(options, false);

    await serviceWorker.evaluate(() => {
        globalThis.__rxGistPermissionFetches = 0;
        globalThis.__rxGistPermissionFetch = globalThis.fetch;
        globalThis.fetch = async (url, init) => {
            if (String(url).startsWith('https://api.github.com/gists')) {
                globalThis.__rxGistPermissionFetches += 1;
            }
            return globalThis.__rxGistPermissionFetch(url, init);
        };
    });

    expect(await options.evaluate(() => globalThis.__rxGithubPermissionRequests)).toBe(0);
    await options.locator('#gist-sync-push-btn').click();
    await expect(options.locator('#status')).toContainText('GitHub access was not granted. No request was sent.');
    expect(await options.evaluate(() => globalThis.__rxGithubPermissionRequests)).toBe(1);
    expect(await serviceWorker.evaluate(() => globalThis.__rxGistPermissionFetches)).toBe(0);
});
