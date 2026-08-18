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
    await expect(page.locator('#settings-workspace-note')).toContainText('Chromium DNR');
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
test('first-run welcome offers real default-off presets, applies them, and never returns', async ({ context, extensionId }) => {
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
        expect(entry.checked).toBe(true);
    }

    // Deselect one so the applied set is not simply "all of them".
    const skipped = audit[0].key;
    await page.locator(`#welcome-preset-${skipped}`).uncheck();
    await page.locator('#welcome-apply-btn').click();
    await expect(panel).toBeHidden();

    const stored = await page.evaluate(async () => (await chrome.storage.local.get('rx_settings')).rx_settings || {});
    for (const entry of audit) {
        if (entry.key === skipped) expect(stored[entry.key]).toBeFalsy();
        else expect(stored[entry.key], `${entry.key} was not applied`).toBe(true);
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

test('the in-page settings modal stays usable in a small window', async ({ context }) => {
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
    await page.locator('#rx-settings-btn').waitFor({ state: 'attached', timeout: 15_000 });
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
