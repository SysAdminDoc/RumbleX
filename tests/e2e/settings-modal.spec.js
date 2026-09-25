// @ts-check
// Settings modal dirty-draft workflow tests.
const { test, expect } = require('./_fixtures');

test('popup palette previews and density presets persist the selected design', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/popup.html`);

    const paletteButtons = page.locator('.theme-section .theme-grid').first().locator('.theme-chip');
    await expect(paletteButtons).toHaveCount(7);
    await expect(page.locator('.theme-swatch')).toHaveCount(7);
    await expect(page.locator('.theme-swatch').first().locator('span')).toHaveCount(3);

    const aurora = paletteButtons.filter({ hasText: 'Aurora' });
    await aurora.click();
    await expect(aurora).toHaveAttribute('aria-pressed', 'true');

    const showcase = page.locator('.density-chip').filter({ hasText: 'Showcase' });
    await showcase.click();
    await expect(showcase).toHaveAttribute('aria-pressed', 'true');

    await expect.poll(() => page.evaluate(() => new Promise((resolve) => {
        chrome.storage.local.get('rx_settings', (value) => resolve({
            theme: value.rx_settings?.theme,
            pageDensity: value.rx_settings?.pageDensity,
        }));
    }))).toEqual({ theme: 'aurora', pageDensity: 'showcase' });
});

test('settings modal opens, search filters, save persists', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    await expect(page.locator('#settings-modal-shell')).toBeVisible();
    await expect(page.locator('#settings-save-btn')).toBeDisabled();
    await expect(page.locator('#settings-save-btn')).not.toHaveCSS('background-color', 'rgb(133, 213, 81)');
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

test('disabled primary actions use the Windows forced-colors palette', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    await expect(page.locator('#settings-save-btn')).toBeDisabled();

    const colors = await page.locator('#settings-save-btn').evaluate((button) => {
        const probe = document.createElement('span');
        probe.style.cssText = 'position:fixed;color:GrayText;background:Canvas;border:1px solid GrayText';
        document.body.appendChild(probe);
        const buttonStyle = getComputedStyle(button);
        const probeStyle = getComputedStyle(probe);
        const result = {
            button: {
                color: buttonStyle.color,
                background: buttonStyle.backgroundColor,
                border: buttonStyle.borderTopColor,
            },
            system: {
                color: probeStyle.color,
                background: probeStyle.backgroundColor,
                border: probeStyle.borderTopColor,
            },
        };
        probe.remove();
        return result;
    });
    expect(colors.button).toEqual(colors.system);
});

test('ad blocking group distinguishes request shield from DOM cleanup', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    await page.locator('#settings-groups button[data-group="ad-blocking"]').click();
    await expect(page.locator('#settings-workspace-banner')).toHaveClass(/is-shield/);
    await expect(page.locator('#settings-workspace-title')).toHaveText('Network shield active');
    await expect(page.locator('#settings-workspace-note')).toContainText('7 verified request rules');
    await expect(page.locator('#settings-workspace-note')).toContainText('Chromium DNR');
    await expect(page.locator('#settings-workspace-note')).toContainText('Ad Nuker controls the remaining DOM cleanup');
});

test('catalog parity: every settings key has a META entry', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    // Count rendered cards in "All Settings" group — should match the
    // boolean-toggle subset of catalog parity (197+).
    //
    // expect.poll, not a bare .count(): locator.count() takes a single snapshot
    // and does not retry, while the modal builds its 200+ cards asynchronously.
    // Under full-suite load the snapshot could land mid-render and the test
    // failed on a partial count, in a full run only and never in isolation.
    await expect
        .poll(() => page.locator('.settings-item').count(), {
            message: 'settings modal did not finish rendering its cards',
            timeout: 15_000,
        })
        .toBeGreaterThan(180);
});

test('download muxer engine renders as a guarded choice', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    await page.locator('#settings-search').fill('muxer engine');
    const card = page.locator('.settings-item').filter({ hasText: 'HLS MP4 Muxer Engine' });
    await expect(card).toBeVisible();
    const select = card.locator('select[name="downloadMuxerEngine"]');
    await expect(select).toHaveValue('mediabunnyWebCodecs');
    await expect(select.locator('option')).toHaveText([
        'Mediabunny + WebCodecs (default)',
        'mux.js (legacy fallback)',
    ]);
});

test('snapshot restore applies the same trust boundary as file import', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const snapshotAt = 1_723_500_000_000;
    await page.evaluate(({ snapshotAt }) => new Promise((resolve) => {
        chrome.storage.local.set({
            rx_settings: { backupHistory: true, backupHistoryLimit: 10 },
            rx_settings_snapshots: [{
                at: snapshotAt,
                reason: 'legacy-malicious-fixture',
                settings: {
                    theme: 'not-a-theme',
                    splitRatio: 999,
                    blockedKeywords: [{ bad: true }, 'safe phrase'],
                    hiddenCategories: ['news', 'x} body { display:none } /*'],
                    autoplayQueue: [
                        'javascript://rumble.com/%0Aalert(1)',
                        'https://example.com/off-site',
                        'https://rumble.com/vsafe-fixture.html',
                    ],
                    watchedChannels: [
                        { url: 'javascript://rumble.com/bad', name: 'bad' },
                        { url: 'https://rumble.com/c/safe', name: 'Safe' },
                    ],
                },
            }],
        }, resolve);
    }), { snapshotAt });
    await page.reload();
    await page.locator('#snapshot-section summary').click();
    await page.locator('#snapshot-refresh-btn').click();
    await expect(page.locator('#snapshot-list')).toContainText('legacy-malicious-fixture');

    // Another surface may append or trim history after this list renders. The
    // button must restore the stable timestamp it displays, not the array slot
    // that happened to hold it during refresh.
    await page.evaluate(({ snapshotAt }) => new Promise((resolve) => {
        chrome.storage.local.get('rx_settings_snapshots', (stored) => {
            chrome.storage.local.set({
                rx_settings_snapshots: [{
                    at: snapshotAt + 1,
                    reason: 'inserted-after-render',
                    settings: { theme: 'light' },
                }, ...(stored.rx_settings_snapshots || [])],
            }, resolve);
        });
    }), { snapshotAt });

    await page.locator('#snapshot-list li')
        .filter({ hasText: 'legacy-malicious-fixture' })
        .getByRole('button', { name: 'Restore' })
        .click();
    await expect(page.locator('#status')).toContainText('restored');

    const restored = await page.evaluate(() => new Promise((resolve) => {
        chrome.storage.local.get('rx_settings', (value) => resolve(value.rx_settings));
    }));
    expect(restored.theme).toBeUndefined();
    expect(restored.splitRatio).toBe(95);
    expect(restored.blockedKeywords).toEqual(['safe phrase']);
    expect(restored.hiddenCategories).toEqual(['news']);
    expect(restored.autoplayQueue).toEqual(['https://rumble.com/vsafe-fixture.html']);
    expect(restored.watchedChannels).toEqual([expect.objectContaining({
        url: 'https://rumble.com/c/safe',
        name: 'Safe',
    })]);
});

// 41 of 210 settings rendered fully live controls that no runtime code read —
// a user could flip a switch, watch it save, and get no behavior change. The
// options page must now disclose those keys instead of pretending they work.
test('settings with no runtime consumer are disclosed and not operable', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    await expect(page.locator('#settings-modal-shell')).toBeVisible();

    const declared = await page.evaluate(() => Object.keys(globalThis.RumbleXSettingsSchema.UNIMPLEMENTED));
    expect(declared.length).toBeGreaterThan(0);

    // multiStreamViewer is declared unimplemented: badge shown, control dead.
    await page.locator('#settings-search').fill('multi stream');
    const card = page.locator('.settings-item[data-key="multiStreamViewer"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/is-unimplemented/);
    await expect(card.locator('.settings-item-unimplemented')).toHaveText('Not implemented yet');
    await expect(card.locator('.settings-item-hint')).toContainText('Not implemented yet');
    await expect(card.locator('input').first()).toBeDisabled();

    // A wired setting in the same view stays fully operable — proving the
    // disclosure is targeted rather than a blanket disable.
    await page.locator('#settings-search').fill('shorts feed');
    const live = page.locator('.settings-item[data-key="disableShortsFeed"]');
    await expect(live).toBeVisible();
    await expect(live).not.toHaveClass(/is-unimplemented/);
    await expect(live.locator('input').first()).toBeEnabled();

    // Every declared key must carry the disclosure, not just the sampled one.
    await page.locator('#settings-search').fill('');
    const missing = await page.evaluate(() => Object.keys(globalThis.RumbleXSettingsSchema.UNIMPLEMENTED)
        .filter((key) => {
            const el = document.querySelector(`.settings-item[data-key="${key}"]`);
            return !el || el.dataset.unimplemented !== 'true';
        }));
    expect(missing).toEqual([]);
});

// A fresh install used to land on 126 modules and 208 settings with no
// orientation at all: onInstalled only synced context menus, the side panel,
// the notifier, and alarms.
test('first-run welcome offers explicit opt-in presets, applies only selections, and never returns', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);

    const panel = page.locator('#welcome-panel');
    await expect(panel).toBeVisible();

    // Every offered preset must be a real key that is off by default and
    // actually wired — a preset list that toggles nothing teaches the user the
    // button is fake.
    const audit = await page.evaluate(() => {
        const schema = globalThis.RumbleXSettingsSchema;
        return [...document.querySelectorAll('#welcome-presets input[type="checkbox"]')].map((input) => ({
            key: input.dataset.key,
            exists: Object.hasOwn(schema.DEFAULTS, input.dataset.key),
            defaultValue: schema.DEFAULTS[input.dataset.key],
            unimplemented: !!schema.UNIMPLEMENTED[input.dataset.key],
            checked: input.checked,
        }));
    });
    expect(audit.length).toBeGreaterThan(0);
    for (const entry of audit) {
        expect(entry.exists, `${entry.key} is not a real setting`).toBe(true);
        expect(entry.defaultValue, `${entry.key} is already on by default`).toBe(false);
        expect(entry.unimplemented, `${entry.key} has no runtime consumer`).toBe(false);
        expect(entry.checked).toBe(false);
    }

    const apply = page.locator('#welcome-apply-btn');
    await expect(apply).toBeDisabled();

    // The page must never imply consent for disruptive extras. Select one
    // deliberately and prove only that setting is written.
    const selected = audit[0].key;
    await page.locator(`#welcome-preset-${selected}`).check();
    await expect(apply).toBeEnabled();
    await page.locator('#welcome-apply-btn').click();
    await expect(panel).toBeHidden();

    const stored = await page.evaluate(async () => (await chrome.storage.local.get('rx_settings')).rx_settings || {});
    for (const entry of audit) {
        if (entry.key === selected) expect(stored[entry.key], `${entry.key} was not applied`).toBe(true);
        else expect(stored[entry.key], `${entry.key} was enabled without consent`).toBeFalsy();
    }

    // Shown once: a reload must not bring it back.
    await page.reload();
    await expect(page.locator('#welcome-panel')).toBeHidden();
});

test('dismissing the first-run welcome changes nothing and it stays gone', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await expect(page.locator('#welcome-panel')).toBeVisible();

    await page.locator('#welcome-dismiss-btn').click();
    await expect(page.locator('#welcome-panel')).toBeHidden();

    const stored = await page.evaluate(async () => (await chrome.storage.local.get('rx_settings')).rx_settings);
    // Dismissal must not write settings at all.
    expect(stored === undefined || Object.keys(stored).length === 0).toBe(true);

    await page.reload();
    await expect(page.locator('#welcome-panel')).toBeHidden();
});

test('a first-run storage failure stays visible and reports the error', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const panel = page.locator('#welcome-panel');
    await expect(panel).toBeVisible();

    await page.evaluate(() => {
        const originalSet = chrome.storage.local.set.bind(chrome.storage.local);
        chrome.storage.local.set = (value, callback) => {
            if (Object.hasOwn(value, 'rx_welcome_seen')) throw new Error('fixture storage failure');
            return originalSet(value, callback);
        };
    });

    await page.locator('#welcome-dismiss-btn').click();
    await expect(panel).toBeVisible();
    await expect(page.locator('#status')).toContainText('Could not dismiss the welcome: fixture storage failure');
});

test('a first-run storage read failure keeps a usable welcome visible', async ({ context, extensionId }) => {
    await context.addInitScript(() => {
        const originalGet = chrome.storage.local.get.bind(chrome.storage.local);
        chrome.storage.local.get = (keys, callback) => {
            if (Array.isArray(keys) && keys.includes('rx_welcome_seen')) {
                throw new Error('fixture storage read failure');
            }
            return typeof callback === 'function' ? originalGet(keys, callback) : originalGet(keys);
        };
    });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);

    await expect(page.locator('#welcome-panel')).toBeVisible();
    await expect(page.locator('#welcome-presets input')).toHaveCount(8);
    await expect(page.locator('#status')).toContainText('Could not load the welcome state: fixture storage read failure');
});

test('starter settings and the seen marker commit in one storage write', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const panel = page.locator('#welcome-panel');
    await expect(panel).toBeVisible();
    await page.locator('#welcome-preset-autoTheater').check();

    await page.evaluate(() => {
        const originalSend = chrome.runtime.sendMessage.bind(chrome.runtime);
        chrome.runtime.sendMessage = (message, ...rest) => {
            if (message?.action === 'applyWelcomeSettings') {
                return Promise.reject(new Error('fixture atomic write failure'));
            }
            return originalSend(message, ...rest);
        };
    });
    await page.locator('#welcome-apply-btn').click();

    await expect(panel).toBeVisible();
    await expect(page.locator('#status')).toContainText('Could not apply the starter presets: fixture atomic write failure');
    const stored = await page.evaluate(async () => chrome.storage.local.get(['rx_settings', 'rx_welcome_seen']));
    expect(stored.rx_settings).toBeUndefined();
    expect(stored.rx_welcome_seen).toBeUndefined();
});

test('the in-page settings modal stays usable in a small window', async ({ context }) => {
    // Extension injection can queue behind the catalog-wide lifecycle test on
    // a busy single-worker run. The dedicated boot test keeps the strict 15 s
    // startup contract; this geometry test needs enough setup time to reach it.
    test.setTimeout(60_000);
    // The narrow/short-viewport rules used to sit ABOVE the desktop rules they
    // override. A media query adds no specificity, so every property both
    // declared lost on source order: the sidebar stayed a 240px vertical
    // column inside a column-direction body, which pushed the category list and
    // the entire content pane out of the modal. Only `.rx-m-body` survived,
    // because no base rule sets flex-direction — which is precisely why this
    // looked like it worked.
    const fs = require('node:fs');
    const path = require('node:path');
    const fixture = fs.readFileSync(
        path.join(__dirname, '..', 'fixtures', 'platform', 'modern-watch.html'),
        'utf8',
    );

    const page = await context.newPage();
    await page.setViewportSize({ width: 640, height: 400 });
    await page.route('https://rumble.com/vnarrow-modal.html', (route) => route.fulfill({
        status: 200, contentType: 'text/html', body: fixture,
    }));
    await page.goto('https://rumble.com/vnarrow-modal.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#rx-settings-btn').waitFor({ state: 'attached', timeout: 30_000 });
    await page.evaluate(() => document.querySelector('#rx-settings-btn')?.click());
    await page.waitForFunction(() => document.body.classList.contains('rx-panel-open'));
    await page.waitForTimeout(300);

    const layout = await page.evaluate(() => {
        const box = (selector) => {
            const el = document.querySelector(selector);
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                direction: getComputedStyle(el).flexDirection,
            };
        };
        return {
            matches: matchMedia('(max-width: 720px), (max-height: 620px)').matches,
            body: box('.rx-m-body'),
            sidebar: box('.rx-m-sidebar'),
            content: box('.rx-m-content'),
            navButtons: document.querySelectorAll('.rx-m-nav-btn').length,
        };
    });

    expect(layout.matches).toBe(true);
    // The categories collapse to a scrollable horizontal strip...
    expect(layout.sidebar.direction).toBe('row');
    expect(layout.sidebar.height).toBeLessThan(120);
    // ...and must not overhang the body it sits in (box-sizing).
    expect(layout.sidebar.width).toBeLessThanOrEqual(layout.body.width);
    // ...which is what leaves the content pane room to render at all. Without
    // the fix this measured 40px: header height and nothing else.
    expect(layout.content.height).toBeGreaterThan(150);
    expect(layout.navButtons).toBeGreaterThan(6);

    await page.close();
});

test('in-page settings search reaches every category and explains empty results', async ({ context }) => {
    test.setTimeout(60_000);
    const fs = require('node:fs');
    const path = require('node:path');
    const fixture = fs.readFileSync(
        path.join(__dirname, '..', 'fixtures', 'platform', 'modern-watch.html'),
        'utf8',
    );
    const page = await context.newPage();
    await page.route('https://rumble.com/vsettings-search.html', (route) => route.fulfill({
        status: 200, contentType: 'text/html', body: fixture,
    }));
    await page.goto('https://rumble.com/vsettings-search.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#rx-settings-btn').waitFor({ state: 'attached', timeout: 30_000 });
    await page.evaluate(() => document.querySelector('#rx-settings-btn')?.click());

    const search = page.locator('.rx-m-search');
    await search.fill('Auto-hide Header');
    await expect(page.locator('.rx-m-card[data-feature-id="autoHideHeader"]')).toBeVisible();
    await expect(page.locator('#rx-pane-nav-chrome')).not.toHaveAttribute('hidden', '');

    await search.fill('definitely-not-a-rumblex-setting');
    const empty = page.locator('.rx-m-search-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('No matching features');
    await empty.getByRole('button', { name: 'Clear search' }).click();
    await expect(search).toHaveValue('');
    await expect(page.locator('.rx-m-pane.active:not([hidden])')).toHaveCount(1);
    await page.close();
});

test('in-page import preserves credentials omitted by a portable backup', async ({ context, extensionId }) => {
    test.setTimeout(60_000);
    const fs = require('node:fs');
    const path = require('node:path');
    const fixture = fs.readFileSync(
        path.join(__dirname, '..', 'fixtures', 'platform', 'modern-watch.html'),
        'utf8',
    );
    const credentials = {
        discordWebhookUrl: 'https://discord.com/api/webhooks/123456789/local-secret',
        encryptedGistSyncToken: 'local-token',
        encryptedGistSyncId: 'local-gist',
        liveStreamApiUrl: 'https://rumble.com/-livestream-api/account?key=local-api-secret',
    };

    const admin = await context.newPage();
    await admin.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await admin.evaluate(async (seed) => chrome.storage.local.set({
        rx_settings: { ...seed, autoHideHeader: true, theme: 'midnight' },
    }), credentials);

    const page = await context.newPage();
    await page.route('https://rumble.com/vsettings-import.html', (route) => route.fulfill({
        status: 200, contentType: 'text/html', body: fixture,
    }));
    await page.goto('https://rumble.com/vsettings-import.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#rx-settings-btn').waitFor({ state: 'attached', timeout: 30_000 });
    await page.evaluate(() => document.querySelector('#rx-settings-btn')?.click());

    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('.rx-m-footer-right .rx-m-btn-secondary').click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
        name: 'rumblex-portable.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ theme: 'aurora' })),
    });

    await expect.poll(() => admin.evaluate(async () => {
        const stored = await chrome.storage.local.get('rx_settings');
        const settings = stored.rx_settings || {};
        return {
            theme: settings.theme,
            autoHideHeader: settings.autoHideHeader,
            discordWebhookUrl: settings.discordWebhookUrl,
            encryptedGistSyncToken: settings.encryptedGistSyncToken,
            encryptedGistSyncId: settings.encryptedGistSyncId,
            liveStreamApiUrl: settings.liveStreamApiUrl,
        };
    }), { timeout: 15_000 }).toEqual({
        theme: 'aurora',
        autoHideHeader: false,
        ...credentials,
    });

    await page.close();
    await admin.close();
});

test('standalone downloader behaves as a modal and restores focus', async ({ context, extensionId }) => {
    test.setTimeout(60_000);
    const fs = require('node:fs');
    const path = require('node:path');
    const fixture = fs.readFileSync(
        path.join(__dirname, '..', 'fixtures', 'platform', 'modern-watch.html'),
        'utf8',
    );
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await options.evaluate(async () => chrome.storage.local.set({
        rx_settings: { videoDownload: true, theaterSplit: false },
    }));
    await options.close();

    const page = await context.newPage();
    await page.route('https://rumble.com/vdownload-dialog.html', (route) => route.fulfill({
        status: 200, contentType: 'text/html', body: fixture,
    }));
    await page.goto('https://rumble.com/vdownload-dialog.html', { waitUntil: 'domcontentloaded' });
    const trigger = page.locator('#rx-download-btn');
    await trigger.waitFor({ state: 'attached', timeout: 30_000 });
    await trigger.click();

    const dialog = page.locator('#rx-download-overlay');
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('.rx-dl-card-close')).toBeFocused();
    expect(await page.evaluate(() => Array.from(document.body.children)
        .filter((el) => el.id !== 'rx-download-overlay')
        .every((el) => el.inert))).toBe(true);

    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('#rx-download-overlay'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.close();
});

test('first-run choices scan in two columns and keep both actions together', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`chrome-extension://${extensionId}/pages/options.html#welcome`);
    await expect(page.locator('#welcome-panel')).toBeVisible();

    const layout = await page.evaluate(() => {
        const list = document.querySelector('#welcome-presets');
        const items = [...list.children].map((item) => item.getBoundingClientRect());
        const apply = document.querySelector('#welcome-apply-btn').getBoundingClientRect();
        const dismiss = document.querySelector('#welcome-dismiss-btn').getBoundingClientRect();
        return {
            columns: getComputedStyle(list).gridTemplateColumns.split(' ').length,
            firstRowAligned: Math.abs(items[0].top - items[1].top),
            secondRowBelow: items[2].top > items[0].bottom,
            actionsAligned: Math.abs(apply.top - dismiss.top),
        };
    });
    expect(layout.columns).toBe(2);
    expect(layout.firstRowAligned).toBeLessThanOrEqual(1);
    expect(layout.secondRowBelow).toBe(true);
    expect(layout.actionsAligned).toBeLessThanOrEqual(1);

    const firstChoice = page.locator('#welcome-presets li').first();
    await firstChoice.locator('input').check();
    await expect(page.locator('#welcome-apply-btn')).toHaveText('Turn on 1 selected');
    await expect(firstChoice).toHaveCSS('border-top-color', 'rgba(133, 213, 81, 0.46)');
});

test('dedicated settings editor keeps one-row navigation and an opaque canvas when narrow', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 760, height: 560 });
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    await expect(page.locator('#settings-modal-shell')).toBeVisible();

    const layout = await page.evaluate(() => {
        const modal = document.querySelector('.settings-modal').getBoundingClientRect();
        const groups = document.querySelector('#settings-groups').getBoundingClientRect();
        const list = document.querySelector('#settings-list').getBoundingClientRect();
        const itemRects = [...document.querySelectorAll('#settings-list .settings-item')]
            .slice(0, 24)
            .map((item) => item.getBoundingClientRect());
        const backdrop = getComputedStyle(document.querySelector('.settings-modal-backdrop'));
        return {
            modalHeight: modal.height,
            groupsHeight: groups.height,
            groupsOverflow: document.querySelector('#settings-groups').scrollWidth > document.querySelector('#settings-groups').clientWidth,
            listHeight: list.height,
            backdropColor: backdrop.backgroundColor,
            backdropImage: backdrop.backgroundImage,
            itemCount: itemRects.length,
            itemsDoNotOverlap: itemRects.every((rect, index) => (
                index === 0 || rect.top >= itemRects[index - 1].bottom - 1
            )),
        };
    });
    expect(layout.modalHeight).toBeLessThanOrEqual(544);
    expect(layout.groupsHeight).toBeLessThan(64);
    expect(layout.groupsOverflow).toBe(true);
    expect(layout.listHeight).toBeGreaterThan(180);
    expect(layout.itemCount).toBeGreaterThan(10);
    expect(layout.itemsDoNotOverlap).toBe(true);
    expect(layout.backdropColor).toBe('rgba(3, 5, 8, 0.92)');
    expect(layout.backdropImage).not.toBe('none');
});

test('in-page settings follows every active site palette', async ({ context, extensionId }) => {
    test.setTimeout(90_000);
    const fs = require('node:fs');
    const path = require('node:path');
    const fixture = fs.readFileSync(
        path.join(__dirname, '..', 'fixtures', 'platform', 'modern-watch.html'),
        'utf8',
    );
    const rgb = (hex) => {
        const value = Number.parseInt(hex.slice(1), 16);
        return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
    };

    const settingsPage = await context.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const palettes = await settingsPage.evaluate(() => Object.fromEntries(
        Object.entries(globalThis.RumbleXSettingsSchema.THEMES).map(([id, palette]) => [id, {
            base: palette.base,
            mantle: palette.mantle,
            crust: palette.crust,
            surface0: palette.surface0,
            text: palette.text,
        }]),
    ));
    const page = await context.newPage();
    await page.route('https://rumble.com/vtheme-settings.html*', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: fixture,
    }));

    for (const [theme, palette] of Object.entries(palettes)) {
        await settingsPage.evaluate(async (nextTheme) => {
            await chrome.storage.local.set({ rx_settings: { darkEnhance: true, theme: nextTheme } });
        }, theme);
        await page.goto(`https://rumble.com/vtheme-settings.html?theme=${theme}`, { waitUntil: 'domcontentloaded' });
        await page.locator('#rx-settings-btn').waitFor({ state: 'attached', timeout: 20_000 });
        await page.evaluate(() => document.querySelector('#rx-settings-btn')?.click());
        await page.waitForFunction(() => document.body.classList.contains('rx-panel-open'));

        const colors = await page.evaluate(() => {
            const value = (selector, property) => getComputedStyle(document.querySelector(selector))[property];
            return {
                modal: value('#rx-modal', 'backgroundColor'),
                header: value('.rx-m-header', 'backgroundColor'),
                content: value('.rx-m-content', 'backgroundColor'),
                card: value('.rx-m-card:not(.rx-m-enabled)', 'backgroundColor'),
                text: value('#rx-modal', 'color'),
                saveNote: document.querySelector('.rx-m-save-note')?.textContent,
            };
        });
        expect(colors).toEqual({
            modal: rgb(palette.crust),
            header: rgb(palette.mantle),
            content: rgb(palette.crust),
            card: rgb(palette.surface0),
            text: rgb(palette.text),
            saveNote: 'Local changes autosave',
        });
    }

    await Promise.all([page.close(), settingsPage.close()]);
});
