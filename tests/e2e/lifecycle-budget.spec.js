// @ts-check
// Lifecycle and performance budgets for the shared content core.
//
// A suite this size fails slowly: an observer that survives teardown, a
// listener added on every route change, a rescan that runs twice as often after
// each navigation. None of those break a feature, so feature tests do not see
// them; the page just gets heavier the longer someone browses. These tests run
// the shipped defaults through repeated in-app navigations and fail on any live
// handle or scan count that does not come back down.
const { test, expect, chromium } = require('@playwright/test');
const { BODY, createHarnessPage } = require('./_harness');

// Installed before any feature runs. Counts what is still alive, not what was
// ever created: an observer until it disconnects, an interval until cleared,
// a timeout until it fires or is cleared, a frame until it runs, a listener
// until it is removed. Listeners on detached nodes are not counted, because
// the node going away takes the listener with it.
const TRACKER = () => {
    const live = {
        observers: new Set(),
        intervals: new Set(),
        timeouts: new Set(),
        frames: new Set(),
        listeners: [],
    };
    const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
    const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
    const nativeSetInterval = globalThis.setInterval.bind(globalThis);
    const nativeClearInterval = globalThis.clearInterval.bind(globalThis);
    const nativeRaf = globalThis.requestAnimationFrame.bind(globalThis);
    const nativeCaf = globalThis.cancelAnimationFrame.bind(globalThis);
    const nativeAdd = EventTarget.prototype.addEventListener;
    const nativeRemove = EventTarget.prototype.removeEventListener;
    const captureOf = (options) => (typeof options === 'boolean' ? options : !!options?.capture);

    EventTarget.prototype.addEventListener = function (type, listener, options) {
        const capture = captureOf(options);
        const once = typeof options === 'object' && !!options?.once;
        if (listener && !once && !live.listeners.some((entry) => entry.target === this && entry.type === type
            && entry.listener === listener && entry.capture === capture)) {
            live.listeners.push({ target: this, type, listener, capture });
        }
        return nativeAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
        const capture = captureOf(options);
        live.listeners = live.listeners.filter((entry) => !(entry.target === this && entry.type === type
            && entry.listener === listener && entry.capture === capture));
        return nativeRemove.call(this, type, listener, options);
    };
    globalThis.setTimeout = (fn, delay, ...args) => {
        const id = nativeSetTimeout(() => {
            live.timeouts.delete(id);
            if (typeof fn === 'function') fn(...args);
        }, delay);
        live.timeouts.add(id);
        return id;
    };
    globalThis.clearTimeout = (id) => {
        live.timeouts.delete(id);
        return nativeClearTimeout(id);
    };
    globalThis.setInterval = (fn, delay, ...args) => {
        const id = nativeSetInterval(fn, delay, ...args);
        live.intervals.add(id);
        return id;
    };
    globalThis.clearInterval = (id) => {
        live.intervals.delete(id);
        return nativeClearInterval(id);
    };
    globalThis.requestAnimationFrame = (fn) => {
        const id = nativeRaf((time) => {
            live.frames.delete(id);
            fn(time);
        });
        live.frames.add(id);
        return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
        live.frames.delete(id);
        return nativeCaf(id);
    };
    const track = (Base) => Base && class extends Base {
        observe(...args) {
            live.observers.add(this);
            return super.observe(...args);
        }
        disconnect() {
            live.observers.delete(this);
            return super.disconnect();
        }
    };
    globalThis.MutationObserver = track(globalThis.MutationObserver);
    if (globalThis.IntersectionObserver) globalThis.IntersectionObserver = track(globalThis.IntersectionObserver);
    if (globalThis.ResizeObserver) globalThis.ResizeObserver = track(globalThis.ResizeObserver);

    globalThis.__rxLive = () => ({
        observers: live.observers.size,
        intervals: live.intervals.size,
        timeouts: live.timeouts.size,
        frames: live.frames.size,
        listeners: live.listeners.filter((entry) => entry.target === document
            || entry.target === window
            || !(entry.target instanceof Node)
            || entry.target.isConnected).length,
    });
    globalThis.__rxSleep = (ms) => new Promise((resolve) => nativeSetTimeout(resolve, ms));
    globalThis.__rxPaint = () => new Promise((resolve) => nativeRaf(() => nativeRaf(() => resolve())));
};

async function withTrackedHarness(fn, arg) {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const errors = [];
        page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
        await page.evaluate(TRACKER);
        const result = await page.evaluate(fn, { body: BODY, ...(arg || {}) });
        await context.close();
        return { result, errors };
    } finally {
        await browser.close();
    }
}

const ROUTES = ['/', '/vroute001-watch.html', '/search/video?q=fixture', '/c/fixture', '/subscriptions'];

// Twenty in-app navigations, the way Rumble does them: htmx swaps the page
// body, pushes history, and fires its swap and settle events. Each sample is
// taken once the frame-scheduled work of that navigation has run.
const NAVIGATE = async ({ body, routes, enabled }) => {
    const harness = globalThis.__RumbleXFeatureHarness;
    if (enabled) {
        Settings._cache = { ...Settings._defaults, schemaVersion: SCHEMA_VERSION };
        Settings._ready = true;
        Settings._pendingKeys = new Set();
    } else {
        harness.resetSettings();
    }
    document.body.innerHTML = body;
    history.replaceState({}, '', '/vroute000-start.html');
    Router.init();
    await globalThis.__rxPaint();
    const baseline = globalThis.__rxLive();
    const initErrors = [];
    for (const feature of harness.features) {
        try { feature.init(); } catch (error) { initErrors.push(`${feature.id}: ${error?.message || error}`); }
    }
    await globalThis.__rxSleep(400);
    RxPerfBudget.clear();
    const samples = [];
    let previous = {};
    for (let i = 0; i < 20; i += 1) {
        const route = routes[i % routes.length];
        document.body.innerHTML = body;
        history.pushState({}, '', route);
        document.dispatchEvent(new CustomEvent('htmx:afterSwap', { bubbles: true }));
        document.dispatchEvent(new CustomEvent('htmx:afterSettle', { bubbles: true }));
        await globalThis.__rxPaint();
        await globalThis.__rxSleep(150);
        const scans = RxPerfBudget.scans();
        const delta = {};
        for (const [module, count] of Object.entries(scans)) {
            if (count - (previous[module] || 0)) delta[module] = count - (previous[module] || 0);
        }
        previous = scans;
        samples.push({ i, route, ...globalThis.__rxLive(), scans: delta });
    }
    for (const feature of harness.features) {
        try { feature.destroy(); } catch {}
    }
    await globalThis.__rxSleep(50);
    return {
        baseline,
        samples,
        destroyed: globalThis.__rxLive(),
        initErrors,
        moduleIds: harness.features.map((feature) => feature.id),
        attributed: Object.keys(RxPerfBudget.scans()),
    };
};

const HANDLES = ['observers', 'intervals', 'timeouts', 'frames', 'listeners'];
const handlesOf = (sample) => Object.fromEntries(HANDLES.map((field) => [field, sample[field]]));
const sum = (samples, field) => samples.reduce((total, sample) => total + sample[field], 0);
const scanTotals = (samples) => {
    const totals = {};
    for (const sample of samples) {
        for (const [module, count] of Object.entries(sample.scans)) totals[module] = (totals[module] || 0) + count;
    }
    return totals;
};

test('twenty route transitions return live handles to baseline and never multiply scan work', async () => {
    test.setTimeout(120_000);
    const { result, errors } = await withTrackedHarness(NAVIGATE, { routes: ROUTES, enabled: true });
    expect(errors).toEqual([]);
    expect(result.initErrors).toEqual([]);
    expect(result.samples).toHaveLength(20);

    // Positive control: the defaults really do mount work, and it really does
    // run on navigation, so the flat lines below are not an idle page.
    expect(result.samples[0].observers).toBeGreaterThan(10);
    expect(result.samples[0].listeners).toBeGreaterThan(result.baseline.listeners);
    expect(Object.keys(scanTotals(result.samples)).length).toBeGreaterThan(3);

    // Each route's fourth visit holds no more than its first did. A handle that
    // survives a navigation shows up here as a count that climbs every lap.
    const firstLap = result.samples.slice(0, ROUTES.length);
    const lastLap = result.samples.slice(-ROUTES.length);
    for (let index = 0; index < ROUTES.length; index += 1) {
        const first = firstLap[index];
        const last = lastLap[index];
        for (const field of ['observers', 'intervals', 'listeners']) {
            expect(last[field], `${field} on ${last.route}: first visit ${first[field]}, fourth ${last[field]}`)
                .toBeLessThanOrEqual(first[field]);
        }
    }
    // Frames never queue up across navigations, and pending timers drain
    // rather than accumulate.
    expect(result.samples.every((sample) => sample.frames === 0)).toBe(true);
    expect(sum(lastLap, 'timeouts')).toBeLessThanOrEqual(sum(firstLap, 'timeouts'));

    // Scan work per lap stays flat per module. Work that doubled on every
    // navigation would be many times the first lap by the fourth.
    const firstScans = scanTotals(firstLap);
    const lastScans = scanTotals(lastLap);
    for (const [module, count] of Object.entries(lastScans)) {
        expect(count, `${module} ran ${firstScans[module] || 0} scans in the first lap and ${count} in the fourth`)
            .toBeLessThanOrEqual(firstScans[module] || 0);
    }

    // Every scan is attributed to a module that exists.
    expect(result.attributed.filter((id) => !result.moduleIds.includes(id))).toEqual([]);

    // Teardown returns the page to what the router alone left behind.
    expect(result.destroyed).toEqual(result.baseline);
});

test('with every module switched off, navigation adds no handles and no scans at all', async () => {
    test.setTimeout(120_000);
    const { result, errors } = await withTrackedHarness(NAVIGATE, { routes: ROUTES, enabled: false });
    expect(errors).toEqual([]);
    expect(result.initErrors).toEqual([]);
    // A disabled module costs nothing: no observer, timer, frame or listener
    // beyond the router's own, on any route, and no scan.
    for (const sample of result.samples) {
        expect({ route: sample.route, ...handlesOf(sample) }).toEqual({ route: sample.route, ...result.baseline });
    }
    expect(scanTotals(result.samples)).toEqual({});
    expect(result.destroyed).toEqual(result.baseline);
});

test('frame-scheduled scans are attributed to their module, and only an opted-in report keeps slow ones', async () => {
    const { result, errors } = await withTrackedHarness(async ({ body }) => {
        const harness = globalThis.__RumbleXFeatureHarness;
        const busy = (ms) => {
            const until = performance.now() + ms;
            while (performance.now() < until) { /* hold the frame */ }
        };
        const run = async (optIn) => {
            document.body.innerHTML = body;
            history.replaceState({}, '', '/');
            harness.enable('exactCounts');
            Settings._cache.debugPerfBudget = optIn;
            RxPerfBudget.clear();
            const feature = harness.features.find((candidate) => candidate.id === 'exactCounts');
            const original = feature._processCards;
            feature._processCards = function (...args) {
                busy(25);
                return original.apply(this, args);
            };
            feature.destroy();
            feature.init();
            await globalThis.__rxPaint();
            document.body.appendChild(document.createElement('span'));
            await globalThis.__rxPaint();
            await globalThis.__rxPaint();
            feature.destroy();
            feature._processCards = original;
            return RxPerfBudget.report();
        };
        return { off: await run(false), on: await run(true) };
    });
    expect(errors).toEqual([]);

    // Attribution is always on: the module and its time are in the tally
    // whether or not the report is enabled.
    for (const report of [result.off, result.on]) {
        const entry = report.modules.find((row) => row.module === 'exactCounts');
        expect(entry, JSON.stringify(report.modules)).toBeTruthy();
        expect(entry.scans).toBeGreaterThan(0);
        expect(entry.maxMs).toBeGreaterThanOrEqual(20);
        expect(report.budgetMs).toBe(16);
    }
    // Only the opted-in run kept the individual slow scans.
    expect(result.off.slow).toEqual([]);
    expect(result.on.slow.length).toBeGreaterThan(0);
    expect(result.on.slow[0]).toMatchObject({ module: 'exactCounts', route: 'home' });
    expect(result.on.slow[0].ms).toBeGreaterThanOrEqual(20);
    expect(typeof result.on.slow[0].key).toBe('string');
});
