// @ts-check
// RumbleX accessibility regression suite — v3.8.0
//
// Runs axe-core via @axe-core/playwright against every page surface the
// extension owns (popup, options, in-side-panel options). Fails on any
// violation of a rule tagged as a WCAG 2.0/2.1/2.2 A or AA success criterion,
// whatever severity Axe assigns it. Best-practice findings are reported but do
// not fail, because they are advice rather than the standard.
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

// v3.58.0 — Conformance is decided by the rule, not by Axe's impact guess.
//
// This suite described itself as WCAG 2.2 AA while failing only on critical and
// serious findings, so a moderate violation of a rule that IS the standard —
// colour contrast at AA, an accessible name, a form label — passed and was
// logged as "informational". Impact is Deque's severity heuristic; the tag says
// whether the rule is a success criterion. A violation carrying any of the
// selected WCAG tags fails now, whatever its impact. Best-practice rules are
// requested on the surfaces that want them and reported separately, because
// they are advice rather than the standard.
const WCAG_TAGS = Object.freeze(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
const isWcagViolation = (violation) => (violation.tags || []).some((tag) => WCAG_TAGS.includes(tag));
const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'platform', 'offline-watch.html'), 'utf8');

test.setTimeout(90_000);

function summarizeViolations(violations) {
    return violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        helpUrl: v.helpUrl,
        sampleNode: v.nodes[0]?.html?.slice(0, 200) || '',
        // axe reports measured colours/sizes here; without them a contrast or
        // target-size failure gives no clue what to change it to.
        measured: v.nodes[0]?.any?.[0]?.data || null,
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
    const fails = results.violations.filter(isWcagViolation);
    if (fails.length) {
        console.error('axe WCAG A/AA violations:', JSON.stringify(summarizeViolations(fails), null, 2));
    }
    if (results.violations.length) {
        console.warn('axe best-practice findings (not WCAG, informational):', summarizeViolations(
            results.violations.filter((v) => !isWcagViolation(v)),
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
    const fails = results.violations.filter(isWcagViolation);
    if (fails.length) {
        console.error('axe WCAG A/AA violations:', JSON.stringify(summarizeViolations(fails), null, 2));
    }
    expect(fails).toEqual([]);
});

test('popup passes axe-core WCAG 2.2 AA', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await page.waitForTimeout(200);
    const results = await scanPage(page);
    const fails = results.violations.filter(isWcagViolation);
    if (fails.length) {
        console.error('axe WCAG A/AA violations:', JSON.stringify(summarizeViolations(fails), null, 2));
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
    // The modal fades in over 300ms and axe measures whatever opacity it finds.
    // Analysing mid-transition reads the Rumble page showing through the panel
    // instead of the panel's own colours, which lands text a hundredth of a
    // point under the 4.5:1 contrast floor and fails at random.
    await page.waitForFunction(
        () => getComputedStyle(document.querySelector('#rx-modal')).opacity === '1',
        null,
        { timeout: 5_000 },
    );

    const results = await new AxeBuilder({ page })
        .include('#rx-modal')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .disableRules(['region'])
        .analyze();
    const fails = results.violations.filter(isWcagViolation);
    if (fails.length) {
        console.error('injected modal axe WCAG A/AA violations:', JSON.stringify(summarizeViolations(fails), null, 2));
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
    // Accessibility behavior is the assertion here. The dedicated extension
    // boot test owns the strict 15-second startup contract.
    test.setTimeout(60_000);
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.goto('https://rumble.com/vfixture-keyboard.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 30_000 });

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

// ── Per-surface axe scans ───────────────────────────────────────────────────
// The scans above cover the four extension-owned pages. Everything below is
// injected into rumble.com itself, which is where the accessibility debt was:
// panels with no role or name, and controls that were click-only <div>s.
//
// Each entry is mounted in the content script's ISOLATED world, then scanned
// with axe scoped to just that surface. Mounting and scanning are deliberately
// split: axe runs from the page's main world but reads the shared DOM, while
// `features` and `Settings` are only reachable through the service worker.
//
// `needs` lists the page anchors a module waits for before it will mount. The
// offline fixture is a real decoded watch page, but it does not carry every
// anchor, so the harness creates the missing ones rather than letting a surface
// silently not render — an axe scan of an absent surface passes vacuously.
const DEFAULT_SURFACE_PATH = '/vfixture-axe-surfaces.html';

const AXE_SURFACES = [
    { id: 'watchHistory', selector: '.rx-history-overlay', open: '_showOverlay' },
    { id: 'quickBookmark', selector: '.rx-bookmarks-overlay', open: '_showOverlay' },
    { id: 'sponsorBlock', selector: '.rx-sb-panel', open: '_renderPanel', needs: ['media-description'] },
    { id: 'autoplayScheduler', selector: '.rx-queue-panel', open: '_build' },
    { id: 'transcripts', selector: '.rx-trans-panel', open: '_mount', needs: ['media-description'] },
    { id: 'liveDVR', selector: '.rx-dvr-panel', open: '_mount', needs: ['media-description', 'live'] },
    { id: 'subtitleSidecar', selector: '.rx-sub-panel', open: '_mount', needs: ['media-description'] },
    { id: 'commentSort', selector: '.rx-comment-sort-bar', open: '_mount', needs: ['comments'] },
    { id: 'bulkUnsubscribeEnabled', selector: '.rx-bulk-unsub-bar', open: '_mount', path: '/account/subscriptions' },
    { id: 'batchDownload', selector: '.rx-batch-bar', open: '_mountBar' },
    { id: 'videoDownload', selector: '#rx-download-overlay', open: '_showDownloadOverlay' },
    { id: 'chapters', selector: '.rx-chapters-panel', open: 'chapters', needs: ['media-description'] },
    { id: 'searchHistory', selector: '.rx-search-dropdown', open: 'searchHistory', needs: ['search-input'] },
    { id: 'commentNav', selector: '.rx-comment-nav', open: 'init', needs: ['comments'] },
    { id: 'relatedFilter', selector: '.rx-related-filter', open: 'init', needs: ['related'] },
    { id: 'loopControl', selector: '.rx-loop-ab-bar', open: 'init', needs: ['player'] },
    { id: 'videoStats', selector: '.rx-stats-overlay', open: 'init', needs: ['player'] },
    { id: 'externalPlayerEnabled', selector: '.rx-extplayer', open: 'init', needs: ['by-actions'] },
    { id: 'miniPlayer', selector: '.rx-miniplayer', open: 'miniPlayer', needs: ['player'] },
    { id: 'videoTimestamps', selector: '.rx-timestamp-host', open: 'videoTimestamps', needs: ['comments'] },
    { id: 'watchProgress', selector: '.rx-resume-toast', open: 'watchProgress' },
];

/**
 * Navigate to the route a surface needs, if it is not the one already loaded.
 * `Page` classifies by pathname, and several modules refuse to mount off their
 * own route, so the route is part of the surface definition.
 */
async function routeTo(page, path) {
    const target = 'https://rumble.com' + path;
    if (page.url() === target) return;
    await page.goto(target, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });
}

/**
 * Mount one surface inside the content script's world and report whether it
 * actually rendered. Runs entirely in the ISOLATED world: `features`,
 * `Settings` and `Page` do not exist anywhere else.
 */
async function mountSurface(serviceWorker, tabId, surface) {
    const [execution] = await serviceWorker.evaluate(async ({ id, spec }) => {
        return chrome.scripting.executeScript({
            target: { tabId: id },
            world: 'ISOLATED',
            args: [spec],
            func: async (entry) => {
                const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

                // Anchors the modules wait for. Built visibly, because a
                // control inside a display:none subtree is not focusable and
                // axe skips hidden content entirely.
                const anchor = (className, tag = 'div') => {
                    let el = document.querySelector('.' + className);
                    if (!el) {
                        el = document.createElement(tag);
                        el.className = className;
                        document.body.appendChild(el);
                    }
                    el.style.cssText = 'display:block;visibility:visible;position:static;min-height:20px;';
                    return el;
                };

                for (const need of entry.needs || []) {
                    if (need === 'media-description') {
                        // The fixture's own description sits in a hidden
                        // subtree and these modules take the first match in
                        // document order, so clear it first.
                        document.querySelectorAll('.media-description').forEach((el) => {
                            if (!el.dataset.rxA11yHost) el.classList.remove('media-description');
                        });
                        const host = anchor('media-description');
                        host.dataset.rxA11yHost = '1';
                    }
                    if (need === 'comments') {
                        const el = anchor('rx-a11y-comments');
                        el.id = 'video-comments';
                    }
                    if (need === 'player') {
                        const el = anchor('rx-a11y-player');
                        el.id = 'videoPlayer';
                        if (!el.querySelector('video')) el.appendChild(document.createElement('video'));
                    }
                    if (need === 'related') anchor('mediaList-list');
                    if (need === 'by-actions') anchor('media-by-actions');
                    if (need === 'chat') {
                        const el = anchor('rx-a11y-chat');
                        el.id = 'chat-history-list';
                    }
                    if (need === 'live') anchor('media-description-info-stream-time');
                    if (need === 'search-input') {
                        if (!document.querySelector('input[name="q"]')) {
                            const form = document.createElement('form');
                            const input = document.createElement('input');
                            input.name = 'q';
                            input.setAttribute('aria-label', 'Search Rumble');
                            form.appendChild(input);
                            document.body.appendChild(form);
                        }
                    }
                }

                const feature = features.find((f) => f.id === entry.id);
                if (!feature) return { mounted: false, reason: 'not in the feature registry' };
                Settings.set(entry.id, true);
                try { feature.destroy(); } catch { /* was not mounted */ }
                try { feature.init(); } catch (e) { return { mounted: false, reason: 'init threw: ' + e.message }; }
                // Most modules mount through waitForFeature, which resolves on
                // a microtask or a MutationObserver tick.
                await sleep(500);

                try {
                    if (entry.open === 'chapters') {
                        feature._chapters = [{ time: 0, label: 'Intro' }, { time: 90, label: 'Middle' }];
                        feature._renderPanel();
                    } else if (entry.open === 'searchHistory') {
                        feature._saveHistory(['alpha query', 'beta query']);
                        feature._showDropdown('');
                    } else if (entry.open === 'miniPlayer') {
                        feature._show(document.querySelector('video'));
                    } else if (entry.open === 'videoTimestamps') {
                        const host = document.createElement('div');
                        host.className = 'rx-timestamp-host';
                        host.textContent = 'Jump to 1:30 for the good part.';
                        document.body.appendChild(host);
                        feature._processElement(host);
                    } else if (entry.open === 'watchProgress') {
                        const vid = feature._getVideoId();
                        if (!vid) return { mounted: false, reason: 'no video id on the fixture URL' };
                        feature._saveStore({ [vid]: { t: 125, d: 600 } });
                        feature._tryResume(document.querySelector('video'));
                    } else if (entry.open && entry.open !== 'init') {
                        feature[entry.open]();
                    }
                } catch (e) {
                    return { mounted: false, reason: entry.open + ' threw: ' + e.message };
                }
                await sleep(150);

                const el = document.querySelector(entry.selector);
                return {
                    mounted: !!el,
                    reason: el ? '' : 'selector ' + entry.selector + ' never appeared'
                        + ' [host=' + !!document.querySelector('.media-description-section, .media-description')
                        + ' panel=' + !!feature._panel + ' btn=' + !!feature._btn
                        + ' enabled=' + Settings.get(entry.id) + ']',
                    controls: el ? el.querySelectorAll('button, a[href], input, select, textarea, [tabindex]').length : 0,
                };
            },
        });
    }, { id: tabId, spec: surface });
    return execution.result;
}

test('every injected feature surface passes axe-core WCAG 2.2 AA', async ({ context, serviceWorker }) => {
    test.setTimeout(240_000);
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.goto('https://rumble.com' + DEFAULT_SURFACE_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });

    const targetTabId = await serviceWorker.evaluate(async (url) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, page.url());

    const notMounted = [];
    const offenders = [];

    for (const surface of AXE_SURFACES) {
        await routeTo(page, surface.path || DEFAULT_SURFACE_PATH);
        const mount = await mountSurface(serviceWorker, targetTabId, surface);
        if (!mount.mounted) {
            notMounted.push(`${surface.id}: ${mount.reason}`);
            continue;
        }

        const results = await new AxeBuilder({ page })
            .include(surface.selector)
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            // These panels are injected into Rumble's page, not into a document
            // this project controls, so page-level landmark structure is not
            // theirs to satisfy.
            .disableRules(['region'])
            .analyze();

        const fails = results.violations.filter(isWcagViolation);
        if (fails.length) {
            offenders.push({ surface: surface.id, violations: summarizeViolations(fails) });
        }
    }

    if (notMounted.length) {
        console.error('surfaces that never rendered:', notMounted);
    }
    if (offenders.length) {
        console.error('axe WCAG A/AA violations by surface:', JSON.stringify(offenders, null, 2));
    }
    expect(offenders).toEqual([]);

    // A surface that never rendered was never scanned, so a silent skip would
    // turn this whole test green for the wrong reason.
    expect(notMounted, `surfaces that failed to mount:\n  ${notMounted.join('\n  ')}`).toEqual([]);
    expect(AXE_SURFACES.length).toBeGreaterThanOrEqual(21);
});

test('every control inside an injected surface is natively operable by keyboard', async ({ context, serviceWorker }) => {
    test.setTimeout(240_000);
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.goto('https://rumble.com' + DEFAULT_SURFACE_PATH, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });

    const targetTabId = await serviceWorker.evaluate(async (url) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, page.url());

    const problems = [];
    let scanned = 0;

    for (const surface of AXE_SURFACES) {
        await routeTo(page, surface.path || DEFAULT_SURFACE_PATH);
        const mount = await mountSurface(serviceWorker, targetTabId, surface);
        if (!mount.mounted) continue;

        const audit = await page.evaluate(({ selector }) => {
            const root = document.querySelector(selector);
            if (!root) return null;
            const NATIVE = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']);
            const WIDGET_ROLES = new Set([
                'button', 'checkbox', 'link', 'menuitem', 'option', 'radio',
                'switch', 'tab', 'slider', 'spinbutton', 'textbox', 'combobox',
            ]);
            const bad = [];
            for (const el of root.querySelectorAll('*')) {
                const role = el.getAttribute('role');
                const isNative = NATIVE.has(el.tagName);
                const isWidget = role && WIDGET_ROLES.has(role);
                if (!isNative && !isWidget) continue;
                // Native <button>/<a>/<input> fire on Enter (and Space, for
                // buttons and checkboxes) with no script at all, so operability
                // follows from being the right element. What has to be checked
                // is that nothing removed it from the tab order.
                if (el.tabIndex < 0 && !el.disabled) {
                    bad.push(`${el.tagName.toLowerCase()}${role ? '[role=' + role + ']' : ''} is not in the tab order`);
                }
                if (isWidget && !isNative) {
                    bad.push(`<${el.tagName.toLowerCase()}> uses role="${role}" instead of a native control`);
                }
            }
            const focusable = root.querySelectorAll(
                'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
            ).length;
            return { bad, focusable };
        }, { selector: surface.selector });

        if (!audit) continue;
        scanned += 1;
        if (audit.bad.length) problems.push({ surface: surface.id, issues: audit.bad });
        // A panel with controls that exposes none of them to the keyboard is
        // the exact failure this suite exists to catch.
        if (mount.controls > 0 && audit.focusable === 0) {
            problems.push({ surface: surface.id, issues: [`${mount.controls} controls, none keyboard-focusable`] });
        }
    }

    if (problems.length) {
        console.error('keyboard operability problems:', JSON.stringify(problems, null, 2));
    }
    expect(problems).toEqual([]);
    expect(scanned).toBeGreaterThanOrEqual(21);
});

// ── Display-preference contracts ────────────────────────────────────────────
// Neither of these is something axe can see. Axe reads the DOM under whatever
// media features the page happens to have; it will not tell you that a panel
// loses its only boundary under Windows High Contrast, or that a hover lift
// keeps animating for someone who asked the OS to stop.

async function openInjectedFixture(context, colorScheme, reducedMotion, forcedColors) {
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.emulateMedia({ colorScheme, reducedMotion, forcedColors });
    await page.goto('https://rumble.com/vdisplay-prefs.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });
    return page;
}

test('forced colors keeps every RumbleX boundary, focus ring and selection visible', async ({ context }) => {
    const page = await openInjectedFixture(context, 'dark', 'no-preference', 'active');
    await page.evaluate(() => document.querySelector('#rx-settings-btn')?.click());
    await page.waitForFunction(() => document.body.classList.contains('rx-panel-open'), null, { timeout: 5_000 });
    await page.waitForFunction(
        () => getComputedStyle(document.querySelector('#rx-modal')).opacity === '1',
        null,
        { timeout: 5_000 },
    );

    const state = await page.evaluate(() => {
        const read = (selector) => {
            const node = document.querySelector(selector);
            if (!node) return null;
            const style = getComputedStyle(node);
            return {
                borderTopWidth: style.borderTopWidth,
                borderTopStyle: style.borderTopStyle,
                borderTopColor: style.borderTopColor,
                backgroundColor: style.backgroundColor,
                color: style.color,
                forcedColorAdjust: style.forcedColorAdjust,
            };
        };
        return {
            styleMounted: !!document.getElementById('rumblex-forced-colors'),
            modal: read('#rx-modal'),
            settingsButton: read('#rx-settings-btn'),
        };
    });

    // Positive control: the rule set has to actually be on the page, or every
    // assertion below is measuring the default styling.
    expect(state.styleMounted).toBe(true);

    // A panel with no edge is indistinguishable from the page behind it.
    expect(state.modal).toBeTruthy();
    expect(state.modal.borderTopStyle).not.toBe('none');
    expect(Number.parseFloat(state.modal.borderTopWidth)).toBeGreaterThan(0);
    // System colours resolve to real values, so a transparent border would mean
    // the rule did not apply.
    expect(state.modal.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(state.modal.forcedColorAdjust).toBe('none');

    // Background and foreground must differ, or the panel is unreadable.
    expect(state.modal.backgroundColor).not.toBe(state.modal.color);
    expect(state.settingsButton).toBeTruthy();
    expect(state.settingsButton.forcedColorAdjust).toBe('none');

    // getComputedStyle cannot read a pseudo-class, so the focus ring has to be
    // measured on an element that genuinely matches :focus-visible. Tab is what
    // puts a browser into the keyboard-modality state the selector depends on.
    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body) return { focused: false };
        const style = getComputedStyle(active);
        return {
            focused: true,
            matchesFocusVisible: active.matches(':focus-visible'),
            outlineWidth: style.outlineWidth,
            outlineStyle: style.outlineStyle,
            insideModal: !!active.closest('#rx-modal'),
        };
    });
    expect(focus.focused).toBe(true);
    expect(focus.insideModal).toBe(true);
    expect(focus.matchesFocusVisible).toBe(true);
    expect(focus.outlineStyle).not.toBe('none');
    expect(Number.parseFloat(focus.outlineWidth)).toBeGreaterThan(0);
});

test('reduced motion stops RumbleX animation, shimmer and hover lift', async ({ context }) => {
    const page = await openInjectedFixture(context, 'dark', 'reduce', 'none');

    const state = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.id = 'rx-motion-probe';
        probe.className = 'rx-shimmer rx-card';
        probe.style.transition = 'transform 400ms ease';
        probe.style.animation = 'rx-fake 900ms linear infinite';
        document.body.appendChild(probe);
        const style = getComputedStyle(probe);
        const result = {
            styleMounted: !!document.getElementById('rumblex-os-reduced-motion'),
            transitionDuration: style.transitionDuration,
            animationDuration: style.animationDuration,
            animationName: style.animationName,
            scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
            rootHasActiveClass: document.documentElement.classList.contains('rumblex-active'),
        };
        probe.remove();
        return result;
    });

    // Positive control again: the class is what every rule is scoped to.
    expect(state.styleMounted).toBe(true);
    expect(state.rootHasActiveClass).toBe(true);

    // 0.001ms is the project's existing "effectively off" value; anything that
    // still reads as a perceptible duration means a rule stopped applying.
    expect(Number.parseFloat(state.transitionDuration)).toBeLessThan(0.01);
    expect(Number.parseFloat(state.animationDuration)).toBeLessThan(0.01);
    // The shimmer is switched off by name, not merely shortened.
    expect(state.animationName).toBe('none');
    expect(state.scrollBehavior).toBe('auto');
});

test('the motion and forced-colors rules do nothing when neither preference is set', async ({ context }) => {
    // Without this, a rule that applied unconditionally would satisfy both
    // tests above while quietly flattening the default experience.
    const page = await openInjectedFixture(context, 'dark', 'no-preference', 'none');
    const state = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.className = 'rx-card';
        probe.style.transition = 'transform 400ms ease';
        document.body.appendChild(probe);
        const style = getComputedStyle(probe);
        const result = {
            transitionDuration: style.transitionDuration,
            forcedColorAdjust: style.forcedColorAdjust,
        };
        probe.remove();
        return result;
    });

    expect(Number.parseFloat(state.transitionDuration)).toBeCloseTo(0.4, 2);
    expect(state.forcedColorAdjust).toBe('auto');
});
