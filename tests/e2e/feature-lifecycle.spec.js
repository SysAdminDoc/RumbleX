// @ts-check
// Catalog-wide lifecycle coverage for the real shared content core.
const { test, expect, chromium } = require('@playwright/test');
const { INSTRUMENTED_CORE, PLATFORM, SCHEMA, BODY, INIT_STYLE_IDS, routeFor, createHarnessPage } = require('./_harness');

test('every feature initializes and destroys through the canonical registry', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));

        const catalog = await page.evaluate(() => globalThis.__RumbleXFeatureHarness.features.map((feature) => ({
            id: feature.id,
            name: feature.name,
            hasInit: typeof feature.init === 'function',
            hasDestroy: typeof feature.destroy === 'function',
        })));
        expect(catalog).toHaveLength(135);
        expect(new Set(catalog.map(({ id }) => id)).size).toBe(135);
        expect(catalog.every(({ id, name, hasInit, hasDestroy }) => id && name && hasInit && hasDestroy)).toBe(true);

        const excluded = new Set(['autoTheater', 'disableShortsFeed']);
        const results = [];
        for (const { id } of catalog) {
            if (excluded.has(id)) continue;
            const result = await page.evaluate(({ featureId, route, body }) => {
                document.body.innerHTML = body;
                history.replaceState({}, '', route);
                const harness = globalThis.__RumbleXFeatureHarness;
                harness.enable(featureId);
                const feature = harness.features.find((candidate) => candidate.id === featureId);
                try {
                    feature.destroy();
                    feature.init();
                    feature.destroy();
                    return { id: featureId, ok: true };
                } catch (error) {
                    return { id: featureId, ok: false, error: String(error?.stack || error) };
                }
            }, { featureId: id, route: routeFor(id), body: BODY });
            results.push(result);
        }
        expect(results.filter(({ ok }) => !ok)).toEqual([]);
        await page.waitForTimeout(50);
        expect(pageErrors).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});

test('all CSS toggles and handwritten style modules mount and clean up on their intended route', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);

        const cssResults = await page.evaluate(async ({ body }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            const routes = { watch: '/vfeature123-css.html', home: '/', feed: '/subscriptions', channel: '/c/fixture', live: '/vfeature123-live.html' };
            const output = [];
            for (const entry of harness.cssToggles) {
                document.body.innerHTML = body;
                history.replaceState({}, '', routes[entry.page] || '/vfeature123-css.html');
                harness.enable(entry.id);
                const feature = harness.features.find((candidate) => candidate.id === entry.id);
                feature.destroy();
                feature.init();
                const styleId = 'rx-css-' + entry.id;
                const mounted = !!document.getElementById(styleId);
                feature.destroy();
                output.push({ id: entry.id, mounted, removed: !document.getElementById(styleId) });
            }
            return output;
        }, { body: BODY });
        expect(cssResults).toHaveLength(51);
        expect(cssResults.filter(({ mounted, removed }) => !mounted || !removed)).toEqual([]);

        const handwrittenResults = [];
        for (const [id, styleId] of Object.entries(INIT_STYLE_IDS)) {
            const result = await page.evaluate(async ({ featureId, expectedStyle, route, body }) => {
                document.body.innerHTML = body;
                history.replaceState({}, '', route);
                const harness = globalThis.__RumbleXFeatureHarness;
                harness.enable(featureId);
                const feature = harness.features.find((candidate) => candidate.id === featureId);
                feature.destroy();
                feature.init();
                await new Promise((resolve) => setTimeout(resolve, featureId === 'fullWidthPlayer' ? 300 : 25));
                const mounted = !!document.getElementById(expectedStyle);
                feature.destroy();
                return { id: featureId, mounted, removed: !document.getElementById(expectedStyle) };
            }, { featureId: id, expectedStyle: styleId, route: routeFor(id), body: BODY });
            handwrittenResults.push(result);
        }
        expect(handwrittenResults.filter(({ mounted, removed }) => !mounted || !removed)).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});

test('non-style features perform their intended isolated behavior', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);

        const result = await page.evaluate(async ({ body }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            const run = (id, route = '/vfeature123-behavior.html') => {
                document.body.innerHTML = body;
                history.replaceState({}, '', route);
                harness.enable(id);
                const feature = harness.features.find((candidate) => candidate.id === id);
                feature.destroy();
                feature.init();
                return feature;
            };

            const logoFeature = run('logoToFeed');
            const logoHref = document.querySelector('a.logo-link')?.getAttribute('href');
            logoFeature.destroy();
            const restoredLogoHref = document.querySelector('a.logo-link')?.getAttribute('href');

            let qualityClicked = '';
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-quality.html');
            document.querySelectorAll('.quality-menu-item').forEach((button) => button.addEventListener('click', () => { qualityClicked = button.textContent.trim(); }));
            harness.enable('autoMaxQuality');
            const qualityFeature = harness.features.find((candidate) => candidate.id === 'autoMaxQuality');
            qualityFeature.destroy();
            qualityFeature.init();
            qualityFeature._tryAPIApproach();
            qualityFeature.destroy();

            let likeClicks = 0;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-like.html');
            document.querySelector('.rumbles-vote-pill-up').addEventListener('click', () => { likeClicks++; });
            harness.enable('autoLike');
            const likeFeature = harness.features.find((candidate) => candidate.id === 'autoLike');
            likeFeature.destroy();
            likeFeature.init();
            // The lifecycle guard resolves an already-present target in one
            // microtask; the waitForFeature consumer runs in the next one.
            await Promise.resolve();
            await Promise.resolve();
            likeFeature.destroy();

            let moreCommentClicks = 0;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-comments.html');
            const more = document.querySelector('li.show-more-comments > button');
            more.getBoundingClientRect = () => ({ top: 1, bottom: 20, left: 0, right: 20, width: 20, height: 19, x: 0, y: 1, toJSON() {} });
            more.addEventListener('click', () => { moreCommentClicks++; });
            harness.enable('autoLoadComments');
            const commentsFeature = harness.features.find((candidate) => candidate.id === 'autoLoadComments');
            commentsFeature.destroy();
            commentsFeature.init();
            window.dispatchEvent(new Event('scroll'));
            commentsFeature.destroy();

            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-track.html?e9s=source&utm_campaign=test&start=42');
            const tracked = document.createElement('a');
            tracked.href = '/vnext123-next.html?ref=feed&start=7';
            document.body.appendChild(tracked);
            harness.enable('stripTrackingParams');
            const stripFeature = harness.features.find((candidate) => candidate.id === 'stripTrackingParams');
            stripFeature.destroy();
            stripFeature.init();
            tracked.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            const cleanedLocation = location.href;
            const cleanedLink = tracked.href;
            stripFeature.destroy();

            let themeClicks = 0;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-theme.html');
            document.querySelector('[data-theme-option="dark"]').addEventListener('click', () => { themeClicks++; });
            harness.enable('siteTheme');
            const themeFeature = harness.features.find((candidate) => candidate.id === 'siteTheme');
            themeFeature.destroy();
            themeFeature.init();
            themeFeature.destroy();

            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-chat-colors.html');
            harness.enable('chatUsernameColors');
            const colorsFeature = harness.features.find((candidate) => candidate.id === 'chatUsernameColors');
            colorsFeature.destroy();
            colorsFeature.init();
            const coloredBeforeDestroy = document.querySelectorAll('[data-rx-colored="1"]').length;
            colorsFeature.destroy();
            const coloredAfterDestroy = document.querySelectorAll('[data-rx-colored="1"]').length;

            let unsubscribeClicks = 0;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/followed-channels');
            document.querySelector('[data-action="unsubscribe"]').addEventListener('click', () => { unsubscribeClicks++; });
            harness.enable('bulkUnsubscribeEnabled');
            const bulkFeature = harness.features.find((candidate) => candidate.id === 'bulkUnsubscribeEnabled');
            bulkFeature.destroy();
            bulkFeature.init();
            const bulkBarMounted = !!document.querySelector('.rx-bulk-unsub-bar');
            document.querySelector('[data-act="all"]')?.click();
            const bulkSelected = document.querySelectorAll('.rx-bu-row-check:checked').length;
            document.querySelector('[data-act="run"]')?.click();
            await Promise.resolve();
            const dryRunProtected = unsubscribeClicks === 0;
            bulkFeature.destroy();
            const bulkCleaned = !document.querySelector('.rx-bulk-unsub-bar, .rx-bu-row-check');

            let recurringCancelClicks = 0;
            history.replaceState({}, '', '/account/recurring-subs');
            document.querySelector('[data-js="cancel_recurring_subscriptions"]').addEventListener('click', () => { recurringCancelClicks++; });
            bulkFeature.init();
            const recurringBarMounted = !!document.querySelector('.rx-bulk-unsub-bar');
            document.querySelector('[data-act="all"]')?.click();
            document.querySelector('[data-act="run"]')?.click();
            await Promise.resolve();
            const recurringDryRunProtected = recurringCancelClicks === 0;
            bulkFeature.destroy();

            return { logoHref, restoredLogoHref, qualityClicked, likeClicks, moreCommentClicks, cleanedLocation, cleanedLink, themeClicks, coloredBeforeDestroy, coloredAfterDestroy, bulkBarMounted, bulkSelected, dryRunProtected, bulkCleaned, recurringBarMounted, recurringDryRunProtected };
        }, { body: BODY });

        expect(result.logoHref).toBe('/subscriptions');
        expect(result.restoredLogoHref).toBe('/');
        expect(result.qualityClicked).toBe('1080p');
        expect(result.likeClicks).toBe(1);
        expect(result.moreCommentClicks).toBe(1);
        expect(result.cleanedLocation).toContain('start=42');
        expect(result.cleanedLocation).not.toMatch(/e9s=|utm_campaign=/);
        expect(result.cleanedLink).toContain('start=7');
        expect(result.cleanedLink).not.toContain('ref=');
        expect(result.themeClicks).toBe(1);
        expect(result.coloredBeforeDestroy).toBeGreaterThan(0);
        expect(result.coloredAfterDestroy).toBe(0);
        expect(result.bulkBarMounted).toBe(true);
        expect(result.bulkSelected).toBe(1);
        expect(result.dryRunProtected).toBe(true);
        expect(result.bulkCleaned).toBe(true);
        expect(result.recurringBarMounted).toBe(true);
        expect(result.recurringDryRunProtected).toBe(true);
        await context.close();
    } finally {
        await browser.close();
    }
});

test('delayed feature work is cancelled when a hot toggle disables it', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const result = await page.evaluate(async ({ body }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-delayed.html');

            harness.enable('fullWidthPlayer');
            const fullWidth = harness.features.find((feature) => feature.id === 'fullWidthPlayer');
            fullWidth.destroy();
            fullWidth.init();
            fullWidth.destroy();
            await new Promise((resolve) => setTimeout(resolve, 350));
            const fullWidthStayedOff = !document.getElementById('rx-fullwidth-css')
                && !document.body.classList.contains('rx-full-width-player')
                && !document.body.classList.contains('rx-live-two-col');

            let theaterClicks = 0;
            const theaterButton = document.querySelector('[data-js="theater-mode-toggle"]');
            theaterButton.addEventListener('click', () => { theaterClicks++; });
            harness.enable('autoTheater');
            const autoTheater = harness.features.find((feature) => feature.id === 'autoTheater');
            autoTheater.destroy();
            autoTheater.init();
            autoTheater.destroy();
            await new Promise((resolve) => setTimeout(resolve, 1600));

            document.querySelector('.theme-option-group')?.remove();
            harness.enable('siteTheme');
            const siteTheme = harness.features.find((feature) => feature.id === 'siteTheme');
            siteTheme.destroy();
            siteTheme.init();
            siteTheme.destroy();
            const group = document.createElement('div');
            group.className = 'theme-option-group';
            document.body.appendChild(group);
            await Promise.resolve();

            return {
                fullWidthStayedOff,
                theaterClicks,
                themeObserverStayedOff: siteTheme._obs === null,
            };
        }, { body: BODY });

        expect(result).toEqual({
            fullWidthStayedOff: true,
            theaterClicks: 0,
            themeObserverStayedOff: true,
        });
        await context.close();
    } finally {
        await browser.close();
    }
});

test('full-surface observers coalesce SPA mutation bursts and cancel queued frames', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const results = await page.evaluate(async ({ body, cases }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
            const output = [];

            for (const entry of cases) {
                document.body.innerHTML = body;
                history.replaceState({}, '', entry.route);
                harness.enable(entry.id);
                const feature = harness.features.find((candidate) => candidate.id === entry.id);
                feature.destroy();

                const original = feature[entry.method];
                let calls = 0;
                feature[entry.method] = () => { calls++; };
                feature.init();
                if (entry.settleMs) await new Promise((resolve) => setTimeout(resolve, entry.settleMs));
                await nextPaint();
                await nextPaint();
                calls = 0;

                const target = document.querySelector(entry.target || 'body');
                for (let i = 0; i < 64; i++) {
                    const node = document.createElement('span');
                    node.textContent = String(i);
                    target.appendChild(node);
                    // Force a MutationObserver checkpoint without yielding a
                    // paint. All callbacks should share one scheduled frame.
                    await Promise.resolve();
                }
                await nextPaint();
                await nextPaint();
                const burstCalls = calls;

                calls = 0;
                target.appendChild(document.createElement('span'));
                await Promise.resolve();
                const queuedBeforeDestroy = feature._rxPendingFrames?.size || 0;
                feature.destroy();
                const queuedAfterDestroy = feature._rxPendingFrames?.size || 0;
                await nextPaint();
                await nextPaint();
                output.push({
                    id: entry.id,
                    burstCalls,
                    maxBurstCalls: entry.maxBurstCalls || 1,
                    queuedBeforeDestroy,
                    queuedAfterDestroy,
                    callsAfterDestroy: calls,
                });
                feature[entry.method] = original;
            }
            return output;
        }, {
            body: BODY,
            cases: [
                { id: 'logoToFeed', method: '_redirectLogos', route: '/vfeature123-logo.html' },
                { id: 'speedController', method: '_bindVideo', route: '/vfeature123-speed.html' },
                { id: 'scrollVolume', method: '_bindVideo', route: '/vfeature123-volume.html' },
                { id: 'watchProgress', method: '_addProgressBars', route: '/' },
                // The first pass mounts block buttons, which deliberately
                // produces one convergence pass in the following frame.
                { id: 'channelBlocker', method: '_filterFeed', route: '/', maxBurstCalls: 2 },
                { id: 'liveChatEnhance', method: '_processMessages', route: '/vfeature123-live-chat.html', target: '#chat-history-list', settleMs: 550 },
                { id: 'videoTimestamps', method: '_processAll', route: '/vfeature123-time.html', target: '#video-comments' },
                { id: 'autoplayBlock', method: '_blockAutoplay', route: '/vfeature123-autoplay.html' },
                { id: 'rantHighlight', method: '_scan', route: '/vfeature123-rants.html', target: '#chat-history-list' },
                { id: 'exactCounts', method: '_processCards', route: '/' },
                { id: 'shortsFilter', method: '_filterAll', route: '/' },
                { id: 'quickSave', method: '_addButtons', route: '/' },
            ],
        });

        expect(results.map(({ id }) => id)).toHaveLength(12);
        expect(results.filter(({ burstCalls, maxBurstCalls }) => burstCalls < 1 || burstCalls > maxBurstCalls)).toEqual([]);
        expect(results.filter(({ queuedBeforeDestroy }) => queuedBeforeDestroy !== 1)).toEqual([]);
        expect(results.filter(({ queuedAfterDestroy, callsAfterDestroy }) => queuedAfterDestroy !== 0 || callsAfterDestroy !== 0)).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});

test('player replacements release detached speed and volume bindings', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const result = await page.evaluate(async ({ body }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-player-swap.html');

            harness.enable('speedController');
            const speed = harness.features.find((feature) => feature.id === 'speedController');
            speed.destroy();
            speed.init();
            const oldSpeedVideo = document.querySelector('video');
            const newSpeedVideo = document.createElement('video');
            oldSpeedVideo.replaceWith(newSpeedVideo);
            await nextPaint();
            await nextPaint();
            const speedState = {
                bindings: speed._videoBindings.size,
                oldReleased: !oldSpeedVideo.dataset.rxSpeedBound,
                newBound: newSpeedVideo.dataset.rxSpeedBound === '1',
            };
            speed.destroy();
            speedState.cleaned = !newSpeedVideo.dataset.rxSpeedBound;

            document.body.innerHTML = body;
            harness.enable('scrollVolume');
            const volume = harness.features.find((feature) => feature.id === 'scrollVolume');
            volume.destroy();
            volume.init();
            const player = document.querySelector('#videoPlayer');
            const oldVolumeVideo = player.querySelector('video');
            const oldPopup = document.createElement('div');
            oldPopup.style.cssText = 'position:absolute;backdrop-filter:blur(4px);width:12px;height:72px;bottom:4px';
            player.appendChild(oldPopup);
            await nextPaint();
            await nextPaint();
            const initialPopupBound = volume._volPopup === oldPopup && oldPopup._rxVolBound === true;

            const newVolumeVideo = document.createElement('video');
            const newPopup = document.createElement('div');
            newPopup.style.cssText = oldPopup.style.cssText;
            oldVolumeVideo.replaceWith(newVolumeVideo);
            oldPopup.replaceWith(newPopup);
            await nextPaint();
            await nextPaint();
            const volumeState = {
                bindings: volume._videoBindings.size,
                oldVideoReleased: !oldVolumeVideo.dataset.rxVolBound,
                newVideoBound: newVolumeVideo.dataset.rxVolBound === '1',
                initialPopupBound,
                oldPopupReleased: oldPopup._rxVolBound !== true,
                newPopupBound: volume._volPopup === newPopup && newPopup._rxVolBound === true,
            };
            volume.destroy();
            volumeState.cleaned = !newVolumeVideo.dataset.rxVolBound && newPopup._rxVolBound !== true;
            return { speedState, volumeState };
        }, { body: BODY });

        expect(result).toEqual({
            speedState: { bindings: 1, oldReleased: true, newBound: true, cleaned: true },
            volumeState: {
                bindings: 1,
                oldVideoReleased: true,
                newVideoBound: true,
                initialPopupBound: true,
                oldPopupReleased: true,
                newPopupBound: true,
                cleaned: true,
            },
        });
        await context.close();
    } finally {
        await browser.close();
    }
});

test('Exact Counts restores host text and markers when disabled', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const result = await page.evaluate(({ body }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/');

            const feed = document.createElement('span');
            feed.className = 'videostream__views';
            feed.dataset.views = '12345';
            feed.innerHTML = '<span class="videostream__views--count">12.3K</span>';
            const related = document.createElement('span');
            related.className = 'mediaList-rumbles';
            related.title = '9,876';
            related.textContent = '9.8K';
            const vote = document.createElement('button');
            vote.dataset.js = 'rumbles_up_votes';
            vote.title = '1,234';
            vote.textContent = '1.2K';
            document.body.append(feed, related, vote);

            harness.enable('exactCounts');
            const feature = harness.features.find((candidate) => candidate.id === 'exactCounts');
            feature.destroy();
            feature.init();
            feature._processCards();
            const expanded = {
                feed: feed.textContent.trim(),
                related: related.textContent,
                vote: vote.textContent,
                marked: [feed.dataset.rxExact, related.dataset.rxExact, vote.dataset.rxExact],
            };
            feature.destroy();
            const restored = {
                feed: feed.textContent,
                related: related.textContent,
                vote: vote.textContent,
                markers: [feed.dataset.rxExact, related.dataset.rxExact, vote.dataset.rxExact],
                styled: document.querySelectorAll('.rx-exact-count').length,
            };
            return { expanded, restored };
        }, { body: BODY });

        expect(result.expanded).toEqual({
            feed: '12,345',
            related: '9,876',
            vote: '1,234',
            marked: ['1', '1', '1'],
        });
        expect(result.restored).toEqual({
            feed: '12.3K',
            related: '9.8K',
            vote: '1.2K',
            markers: [undefined, undefined, undefined],
            styled: 0,
        });
        await context.close();
    } finally {
        await browser.close();
    }
});

test('features cannot attach delayed DOM work after being disabled', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const lifecycleFeatureIds = await page.evaluate(() => globalThis.__RumbleXFeatureHarness.features
            .slice(0, 75)
            .map((feature) => feature.id)
            .filter((id) => id !== 'disableShortsFeed'));
        const leaks = await page.evaluate(async ({ body, featureIds, routes }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            const NativeMutationObserver = globalThis.MutationObserver;
            const NativeIntersectionObserver = globalThis.IntersectionObserver;
            const NativeResizeObserver = globalThis.ResizeObserver;
            const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
            const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
            const nativeSetInterval = globalThis.setInterval.bind(globalThis);
            const nativeClearInterval = globalThis.clearInterval.bind(globalThis);
            const nativeRequestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis);
            const nativeCancelAnimationFrame = globalThis.cancelAnimationFrame.bind(globalThis);
            const nativeAdd = EventTarget.prototype.addEventListener;
            const nativeRemove = EventTarget.prototype.removeEventListener;
            const activeObservers = new Set();
            const activeTimeouts = new Set();
            const activeIntervals = new Set();
            const activeFrames = new Set();
            const activeListeners = [];

            const captureOf = (options) => typeof options === 'boolean' ? options : !!options?.capture;
            EventTarget.prototype.addEventListener = function (type, listener, options) {
                if (listener && !activeListeners.some((entry) => entry.target === this && entry.type === type && entry.listener === listener && entry.capture === captureOf(options))) {
                    activeListeners.push({ target: this, type, listener, capture: captureOf(options), options });
                }
                return nativeAdd.call(this, type, listener, options);
            };
            EventTarget.prototype.removeEventListener = function (type, listener, options) {
                const capture = captureOf(options);
                for (let i = activeListeners.length - 1; i >= 0; i--) {
                    const entry = activeListeners[i];
                    if (entry.target === this && entry.type === type && entry.listener === listener && entry.capture === capture) activeListeners.splice(i, 1);
                }
                return nativeRemove.call(this, type, listener, options);
            };
            globalThis.setTimeout = (fn, delay, ...args) => {
                let id;
                id = nativeSetTimeout(() => {
                    activeTimeouts.delete(id);
                    fn(...args);
                }, delay);
                activeTimeouts.add(id);
                return id;
            };
            globalThis.clearTimeout = (id) => {
                activeTimeouts.delete(id);
                return nativeClearTimeout(id);
            };
            globalThis.setInterval = (fn, delay, ...args) => {
                const id = nativeSetInterval(fn, delay, ...args);
                activeIntervals.add(id);
                return id;
            };
            globalThis.clearInterval = (id) => {
                activeIntervals.delete(id);
                return nativeClearInterval(id);
            };
            globalThis.requestAnimationFrame = (fn) => {
                let id;
                id = nativeRequestAnimationFrame((time) => {
                    activeFrames.delete(id);
                    fn(time);
                });
                activeFrames.add(id);
                return id;
            };
            globalThis.cancelAnimationFrame = (id) => {
                activeFrames.delete(id);
                return nativeCancelAnimationFrame(id);
            };

            const trackObserver = (Base) => class extends Base {
                observe(...args) {
                    activeObservers.add(this);
                    return super.observe(...args);
                }
                disconnect() {
                    activeObservers.delete(this);
                    return super.disconnect();
                }
                unobserve(...args) {
                    const result = super.unobserve?.(...args);
                    return result;
                }
            };
            globalThis.MutationObserver = trackObserver(NativeMutationObserver);
            if (NativeIntersectionObserver) globalThis.IntersectionObserver = trackObserver(NativeIntersectionObserver);
            if (NativeResizeObserver) globalThis.ResizeObserver = trackObserver(NativeResizeObserver);

            const resetTracking = () => {
                for (const id of activeTimeouts) nativeClearTimeout(id);
                for (const id of activeIntervals) nativeClearInterval(id);
                for (const id of activeFrames) nativeCancelAnimationFrame(id);
                for (const observer of activeObservers) {
                    try { observer.disconnect(); } catch {}
                }
                for (const entry of activeListeners.splice(0)) {
                    try { nativeRemove.call(entry.target, entry.type, entry.listener, entry.options); } catch {}
                }
                activeTimeouts.clear();
                activeIntervals.clear();
                activeFrames.clear();
                activeObservers.clear();
            };

            const found = [];
            for (const id of featureIds) {
                resetTracking();
                document.body.innerHTML = '';
                history.replaceState({}, '', routes[id] || '/vfeature123-async.html');
                harness.enable(id);
                const feature = harness.features.find((candidate) => candidate.id === id);
                feature.destroy();
                resetTracking();
                feature.init();
                feature.destroy();
                document.body.innerHTML = body;
                await new Promise((resolve) => nativeSetTimeout(resolve, 80));
                const artifacts = Array.from(document.querySelectorAll('[id^="rx-"], [class*="rx-"], style[data-rx]'))
                    .map((node) => node.id || String(node.className || node.tagName))
                    .slice(0, 8);
                const state = {
                    phase: 'pending-target',
                    id,
                    observers: activeObservers.size,
                    timeouts: activeTimeouts.size,
                    intervals: activeIntervals.size,
                    frames: activeFrames.size,
                    listeners: activeListeners.filter((entry) => entry.target === document
                        || entry.target === window
                        || !(entry.target instanceof Node)
                        || entry.target.isConnected).length,
                    artifacts,
                };
                if (state.observers || state.timeouts || state.intervals || state.frames || state.listeners || state.artifacts.length) found.push(state);
                try { feature.destroy(); } catch {}

                resetTracking();
                document.body.innerHTML = body;
                history.replaceState({}, '', routes[id] || '/vfeature123-async.html');
                harness.enable(id);
                feature.destroy();
                resetTracking();
                feature.init();
                feature.destroy();
                await Promise.resolve();
                const immediateArtifacts = Array.from(document.querySelectorAll('[id^="rx-"], [class*="rx-"], style[data-rx]'))
                    .map((node) => node.id || String(node.className || node.tagName))
                    .slice(0, 8);
                const immediateState = {
                    phase: 'immediate-disable',
                    id,
                    observers: activeObservers.size,
                    timeouts: activeTimeouts.size,
                    intervals: activeIntervals.size,
                    frames: activeFrames.size,
                    listeners: activeListeners.filter((entry) => entry.target === document
                        || entry.target === window
                        || !(entry.target instanceof Node)
                        || entry.target.isConnected).length,
                    artifacts: immediateArtifacts,
                };
                if (immediateState.observers || immediateState.timeouts || immediateState.intervals || immediateState.frames || immediateState.listeners || immediateState.artifacts.length) found.push(immediateState);
                try { feature.destroy(); } catch {}

                resetTracking();
                document.body.innerHTML = body;
                history.replaceState({}, '', routes[id] || '/vfeature123-async.html');
                harness.enable(id);
                feature.destroy();
                resetTracking();
                feature.init();
                await new Promise((resolve) => nativeSetTimeout(resolve, 30));
                feature.destroy();
                await Promise.resolve();
                const mountedArtifacts = Array.from(document.querySelectorAll('[id^="rx-"], [class*="rx-"], style[data-rx]'))
                    .map((node) => node.id || String(node.className || node.tagName))
                    .slice(0, 8);
                const mountedState = {
                    phase: 'mounted-cleanup',
                    id,
                    observers: activeObservers.size,
                    timeouts: activeTimeouts.size,
                    intervals: activeIntervals.size,
                    frames: activeFrames.size,
                    listeners: activeListeners.filter((entry) => entry.target === document
                        || entry.target === window
                        || !(entry.target instanceof Node)
                        || entry.target.isConnected).length,
                    artifacts: mountedArtifacts,
                };
                if (mountedState.observers || mountedState.timeouts || mountedState.intervals || mountedState.frames || mountedState.listeners || mountedState.artifacts.length) found.push(mountedState);
                try { feature.destroy(); } catch {}
            }

            resetTracking();
            EventTarget.prototype.addEventListener = nativeAdd;
            EventTarget.prototype.removeEventListener = nativeRemove;
            globalThis.setTimeout = nativeSetTimeout;
            globalThis.clearTimeout = nativeClearTimeout;
            globalThis.setInterval = nativeSetInterval;
            globalThis.clearInterval = nativeClearInterval;
            globalThis.requestAnimationFrame = nativeRequestAnimationFrame;
            globalThis.cancelAnimationFrame = nativeCancelAnimationFrame;
            globalThis.MutationObserver = NativeMutationObserver;
            if (NativeIntersectionObserver) globalThis.IntersectionObserver = NativeIntersectionObserver;
            if (NativeResizeObserver) globalThis.ResizeObserver = NativeResizeObserver;
            return found;
        }, {
            body: BODY,
            featureIds: lifecycleFeatureIds,
            routes: Object.fromEntries(lifecycleFeatureIds.map((id) => [id, routeFor(id)])),
        });

        expect(leaks).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});
