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
const fs = require('fs');
const path = require('path');

const FAIL_IMPACTS = new Set(['critical', 'serious']);
const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(__dirname, '..', '..', 'rumble_decoded.html'), 'utf8');

test.setTimeout(90_000);

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

test('injected settings modal passes axe-core WCAG 2.2 AA on offline Rumble fixture', async ({ context }) => {
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.goto('https://rumble.com/vfixture-local.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });
    await page.evaluate(() => document.querySelector('#rx-settings-btn')?.click());
    await page.waitForFunction(() => document.body.classList.contains('rx-panel-open'), null, { timeout: 5_000 });
    await expect(page.locator('#rx-modal')).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#rx-modal')).toHaveAttribute('aria-modal', 'true');
    await page.waitForFunction(() => document.activeElement?.classList.contains('rx-m-search'), null, { timeout: 5_000 });

    const results = await new AxeBuilder({ page })
        .include('#rx-modal')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .disableRules(['region'])
        .analyze();
    const fails = results.violations.filter((v) => FAIL_IMPACTS.has(v.impact));
    if (fails.length) {
        console.error('injected modal axe critical/serious violations:', JSON.stringify(summarizeViolations(fails), null, 2));
    }
    expect(fails).toEqual([]);

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.body.classList.contains('rx-panel-open'), null, { timeout: 5_000 });
    await expect(page.locator('#rx-modal')).toHaveAttribute('aria-hidden', 'true');
    expect(await page.locator('#rx-modal').evaluate((modal) => modal.inert)).toBe(true);
});

// ── Injected feature surfaces ───────────────────────────────────────────────
// The four surfaces above are extension-owned pages. The panels below are
// injected into rumble.com itself and carried zero aria attributes: 12 modules
// with four or more createElement calls had no role, no label, and in two cases
// controls that were plain <div>/<span> click targets, unreachable by keyboard.
const INJECTED_SURFACES = [
    { id: 'watchHistory', selector: '.rx-history-overlay', label: 'Watch history' },
    { id: 'quickBookmark', selector: '.rx-bookmarks-overlay', label: 'Bookmarks' },
    { id: 'sponsorBlock', selector: '.rx-sb-panel', label: 'SponsorBlock segments' },
    { id: 'autoplayScheduler', selector: '.rx-queue-panel', label: 'Autoplay queue' },
    { id: 'transcripts', selector: '.rx-trans-panel', label: 'Transcript' },
    { id: 'liveDVR', selector: '.rx-dvr-panel', label: 'Live DVR controls' },
];

test('injected feature panels carry a role and an accessible name', async ({ context, serviceWorker }) => {
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.goto('https://rumble.com/vfixture-a11y.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });

    const targetTabId = await serviceWorker.evaluate(async (url) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, page.url());

    // `features` lives in the content script's ISOLATED world; page.evaluate
    // runs in the main world and cannot see it.
    const audit = await serviceWorker.evaluate(async ({ tabId, surfaces }) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'ISOLATED',
            args: [surfaces],
            func: (surfaceList) => {
                const out = [];
                for (const surface of surfaceList) {
            const feature = features.find((f) => f.id === surface.id);
            if (!feature) { out.push({ ...surface, missing: true }); continue; }
            Settings.set(surface.id, true);
            try { feature.destroy(); } catch { /* not mounted yet */ }
            try { feature.init(); } catch (e) { out.push({ ...surface, initError: String(e && e.message) }); continue; }
            // Overlays are built lazily by their open handler; call it if present.
            for (const opener of ['_showOverlay', '_show', '_open', '_renderPanel', '_build']) {
                if (typeof feature[opener] === 'function') {
                    try { feature[opener](); } catch { /* needs args we do not have */ }
                }
            }
            const el = document.querySelector(surface.selector);
            out.push({
                ...surface,
                found: !!el,
                role: el?.getAttribute('role') || null,
                name: el?.getAttribute('aria-label') || null,
            });
            try { feature.destroy(); } catch { /* ignore */ }
        }
                return out;
            },
        });
        return execution.result;
    }, { tabId: targetTabId, surfaces: INJECTED_SURFACES });

    for (const entry of audit) {
        expect(entry.missing, `${entry.id} is not in the registry`).toBeUndefined();
        expect(entry.initError, `${entry.id} threw on init: ${entry.initError}`).toBeUndefined();
        if (!entry.found) continue; // surface needs page state the fixture lacks
        expect(entry.role, `${entry.id} panel has no role`).toBeTruthy();
        expect(entry.name, `${entry.id} panel has no accessible name`).toBe(entry.label);
    }
    // The audit must actually have exercised something, or it proves nothing.
    expect(audit.filter((entry) => entry.found).length).toBeGreaterThan(0);
});

test('chapter rows and search-history controls are real buttons, not click-only divs', async ({ context, serviceWorker }) => {
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.goto('https://rumble.com/vfixture-keyboard.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });

    const targetTabId = await serviceWorker.evaluate(async (url) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, page.url());

    const result = await serviceWorker.evaluate(async (tabId) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'ISOLATED',
            func: async () => {
        // Chapters: seek rows were <div> + click, so no keyboard user could
        // reach any chapter.
        const chapters = features.find((f) => f.id === 'chapters');
        Settings.set('chapters', true);
        // The fixture's own description sits in a hidden subtree, and a button
        // inside display:none cannot take focus — which would make the
        // focusability assertion meaningless. Use a visible container so the
        // check tests the button rather than the surrounding page.
        // _renderPanel resolves '.media-description, [data-js="media_description"]'
        // and takes the first match in document order, so both must be cleared.
        document.querySelectorAll('.media-description').forEach((el) => el.classList.remove('media-description'));
        document.querySelectorAll('[data-js="media_description"]').forEach((el) => el.removeAttribute('data-js'));
        const desc = document.createElement('div');
        desc.className = 'media-description';
        desc.style.cssText = 'display:block; visibility:visible; position:static;';
        document.body.appendChild(desc);
        desc.innerText = '0:00 Intro\n1:30 Middle\n';
        try { chapters.destroy(); } catch {}
        chapters._chapters = chapters._parseDescription();
        chapters._renderPanel();
        const chapterRows = [...document.querySelectorAll('.rx-chapters-item')];
        const chapterInfo = {
            count: chapterRows.length,
            tags: [...new Set(chapterRows.map((el) => el.tagName))],
            allNamed: chapterRows.every((el) => (el.getAttribute('aria-label') || '').length > 0),
            // Structural focusability rather than a live focus() check: the
            // fixture tab is not the focused tab, so focus() does not move
            // document.activeElement regardless of the element. An enabled
            // <button> with a non-negative tabIndex, not inside an inert or
            // hidden subtree, is keyboard-focusable by specification.
            focusable: chapterRows.every((el) => el.tagName === 'BUTTON'
                && !el.disabled
                && el.tabIndex >= 0
                && !el.closest('[inert]')
                && !el.hidden),
            panelRole: document.querySelector('.rx-chapters-panel')?.getAttribute('role') || null,
        };
        try { chapters.destroy(); } catch {}

        // Search history: the per-entry delete control was a <span> with
        // &times; and no role, tabindex or accessible name.
        const search = features.find((f) => f.id === 'searchHistory');
        Settings.set('searchHistory', true);
        try { search.destroy(); } catch {}
        // init() attaches the dropdown asynchronously through waitForFeature,
        // and it needs an input it recognises.
        if (!document.querySelector('input[name="q"], input[type="search"], .search-input input, #search-input')) {
            const form = document.createElement('form');
            const input = document.createElement('input');
            input.name = 'q';
            form.appendChild(input);
            document.body.appendChild(form);
        }
        search.init();
        await new Promise((resolve) => setTimeout(resolve, 400));
        search._saveHistory(['alpha query', 'beta query']);
        search._showDropdown('');
        const items = [...document.querySelectorAll('.rx-search-dropdown-item')];
        const removes = [...document.querySelectorAll('.rx-search-dropdown-item .remove')];
        const searchInfo = {
            itemCount: items.length,
            itemTags: [...new Set(items.map((el) => el.tagName))],
            removeTags: [...new Set(removes.map((el) => el.tagName))],
            removesNamed: removes.length > 0 && removes.every((el) => (el.getAttribute('aria-label') || '').length > 0),
            removeFocusable: removes.length > 0 && removes.every((el) => el.tagName === 'BUTTON'
                && !el.disabled
                && el.tabIndex >= 0
                && !el.closest('[inert]')
                && !el.hidden),
        };
        try { search.destroy(); } catch {}

                return { chapterInfo, searchInfo };
            },
        });
        return execution.result;
    }, targetTabId);

    expect(result.chapterInfo.count).toBeGreaterThan(0);
    expect(result.chapterInfo.tags).toEqual(['BUTTON']);
    expect(result.chapterInfo.allNamed).toBe(true);
    expect(result.chapterInfo.focusable).toBe(true);
    expect(result.chapterInfo.panelRole).toBe('navigation');

    expect(result.searchInfo.itemCount).toBeGreaterThan(0);
    expect(result.searchInfo.itemTags).toEqual(['BUTTON']);
    expect(result.searchInfo.removeTags).toEqual(['BUTTON']);
    expect(result.searchInfo.removesNamed).toBe(true);
    expect(result.searchInfo.removeFocusable).toBe(true);
});
