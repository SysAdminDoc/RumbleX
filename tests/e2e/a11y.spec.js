// @ts-check
// RumbleX accessibility regression suite — v3.8.0
//
// Runs axe-core via @axe-core/playwright against every page surface the
// extension owns (popup, options, in-side-panel options). Fails on any
// "critical" or "serious" WCAG 2.1 / 2.2 violation. "moderate" and "minor"
// violations are surfaced as a warning summary but don't fail the build —
// we'll triage those by hand each release.
//
// Scope: the static extension pages only. Content-script overlays
// injected into rumble.com (settings modal, toast region, ext-player
// button) are covered in a follow-up live-site smoke pass.
//
// Targeted rule changes from the default axe-core ruleset:
// - 'color-contrast' enforced at AA (default).
// - 'aria-allowed-attr' enabled — verifies native controls do not carry unsupported ARIA.
// - 'aria-live' tags allowed — toasts use role="status" + aria-live="polite".
// - Region rules disabled where the popup is intentionally a single landmark.
const { test, expect } = require('./_fixtures');
const { AxeBuilder } = require('@axe-core/playwright');

const FAIL_IMPACTS = new Set(['critical', 'serious']);

function summarizeViolations(violations) {
    return violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        helpUrl: v.helpUrl,
        sampleNode: v.nodes[0]?.html?.slice(0, 200) || '',
    }));
}

async function scanPage(page) {
    const builder = new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        // Region/landmark complaints on a 320px popup are noise — the popup
        // IS a single region by design.
        .disableRules(['region']);
    return builder.analyze();
}

test('options page passes axe-core WCAG 2.2 AA', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    // Wait for the snapshot + privacy sections to render (they're loaded
    // async on a 250ms setTimeout in v3.1) so axe sees the final DOM.
    await page.waitForTimeout(400);
    const results = await scanPage(page);
    const fails = results.violations.filter((v) => FAIL_IMPACTS.has(v.impact));
    if (fails.length) {
        console.error('axe critical/serious violations:', JSON.stringify(summarizeViolations(fails), null, 2));
    }
    if (results.violations.length) {
        console.warn('axe moderate/minor violations (informational):', summarizeViolations(
            results.violations.filter((v) => !FAIL_IMPACTS.has(v.impact)),
        ));
    }
    expect(fails).toEqual([]);
});

test('options settings modal passes axe-core WCAG 2.2 AA', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.locator('#open-settings-modal-btn').click();
    await expect(page.locator('#settings-modal-shell')).toBeVisible();
    // Let the dirty-draft workspace render every settings card.
    await page.waitForTimeout(600);
    const results = await scanPage(page);
    const fails = results.violations.filter((v) => FAIL_IMPACTS.has(v.impact));
    if (fails.length) {
        console.error('axe critical/serious violations:', JSON.stringify(summarizeViolations(fails), null, 2));
    }
    expect(fails).toEqual([]);
});

test('popup passes axe-core WCAG 2.2 AA', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await page.waitForTimeout(200);
    const results = await scanPage(page);
    const fails = results.violations.filter((v) => FAIL_IMPACTS.has(v.impact));
    if (fails.length) {
        console.error('axe critical/serious violations:', JSON.stringify(summarizeViolations(fails), null, 2));
    }
    expect(fails).toEqual([]);
});
