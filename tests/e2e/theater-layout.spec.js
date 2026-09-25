// @ts-check
// Theater Split remembers its layout separately for live streams and recorded
// videos, lets a channel's own layout win when asked to, and comes back through
// Rumble's own theater button after being left. No new control on the player.
const { test, expect, chromium } = require('@playwright/test');
const { BODY, createHarnessPage } = require('./_harness');

// Puts the harness page into a live or recorded watch page and routes to it the
// way Rumble does, so Theater Split's own route handling mounts or skips.
const GOTO = async ({ body, kind, path }) => {
    document.body.innerHTML = body;
    if (kind === 'vod') {
        document.querySelector('.media-page-chat-aside-chat')?.remove();
        document.querySelector('.video-header-live-info')?.remove();
        document.querySelector('.media-description-info-stream-time')?.remove();
    }
    // The uploader link every watch page carries, which is what a channel
    // layout is keyed by. The fixture's other channel links live in the aside
    // a recorded page removes.
    document.querySelector('.media-by-actions')
        ?.insertAdjacentHTML('beforebegin', '<a class="media-by--a" href="/c/layout-channel">Layout Channel</a>');
    const invented = document.querySelector('[data-js="theater-mode-toggle"]');
    if (invented) {
        const real = document.createElement('div');
        real.title = 'Toggle theater mode';
        invented.replaceWith(real);
    }
    history.pushState({}, '', path);
    document.dispatchEvent(new CustomEvent('htmx:afterSwap', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 1700));
};

const START = ({ settings = {} } = {}) => {
    const harness = globalThis.__RumbleXFeatureHarness;
    const base = harness.resetSettings();
    Object.assign(base, { theaterSplit: true, videoDownload: true }, settings);
    Router.init();
    harness.features.find((feature) => feature.id === 'theaterSplit').init();
};

// What the layout looks like right now: whether Theater is open, the divider's
// reported ratio, and the side panel's real share of the width.
const MEASURE = () => {
    const wrapper = document.querySelector('#rx-split-wrapper');
    const right = document.querySelector('#rx-split-right');
    const divider = document.querySelector('#rx-split-divider');
    if (!wrapper || !right || !divider) return { open: false };
    const total = wrapper.getBoundingClientRect().width;
    return {
        open: true,
        ratio: Number(divider.getAttribute('aria-valuenow')),
        sideShare: Math.round((right.getBoundingClientRect().width / total) * 100),
        playerInside: !!wrapper.querySelector('#videoPlayer'),
        live: !!right.querySelector('#rx-tab-chat'),
    };
};

async function withTheater(fn) {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        await page.setViewportSize({ width: 1440, height: 900 });
        const errors = [];
        page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
        const api = {
            page,
            start: (options) => page.evaluate(START, options),
            go: (kind, path) => page.evaluate(GOTO, { body: BODY, kind, path }),
            measure: () => page.evaluate(MEASURE),
            settings: () => page.evaluate(() => ({
                splitRatio: Settings.get('splitRatio'),
                theaterLayout: Settings.get('theaterLayout'),
            })),
            // Move the divider the way a keyboard user does. Two points a press.
            nudge: async (presses) => {
                const divider = page.locator('#rx-split-divider');
                await divider.focus();
                const key = presses < 0 ? 'ArrowLeft' : 'ArrowRight';
                for (let i = 0; i < Math.abs(presses); i += 1) await divider.press(key);
            },
            exit: () => page.locator('.rx-panel-exit').click(),
            nativeTheater: () => page.evaluate(() => document.querySelector('[title="Toggle theater mode"]').click()),
        };
        await fn(api);
        expect(errors).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
}

test('live and recorded videos keep their own divider position, starting from splitRatio', async () => {
    await withTheater(async (t) => {
        // An existing install carries a custom splitRatio and nothing else.
        await t.start({ settings: { splitRatio: 60 } });
        await t.go('vod', '/vlayout001-recorded.html');
        expect(await t.measure()).toMatchObject({ open: true, ratio: 60, live: false });

        await t.nudge(4); // 60 -> 68 for recorded videos
        expect((await t.measure()).ratio).toBe(68);

        await t.go('live', '/vlayout002-live.html');
        // Live has not been touched, so it still starts from the default.
        expect(await t.measure()).toMatchObject({ open: true, ratio: 60, live: true });
        await t.nudge(-5); // 60 -> 50 for live streams

        await t.go('vod', '/vlayout003-recorded.html');
        const vod = await t.measure();
        expect(vod.ratio).toBe(68);
        expect(Math.abs(vod.sideShare - 32)).toBeLessThanOrEqual(1);

        await t.go('live', '/vlayout004-live.html');
        const live = await t.measure();
        expect(live.ratio).toBe(50);
        expect(Math.abs(live.sideShare - 50)).toBeLessThanOrEqual(1);

        // The default itself is untouched, and each kind has its own memory.
        expect(await t.settings()).toEqual({
            splitRatio: 60,
            theaterLayout: { vod: { ratio: 68 }, live: { ratio: 50 } },
        });

        // Clearing the memory is the reset: both kinds return to the default.
        await t.page.evaluate(() => Settings.set('theaterLayout', {}));
        await t.go('vod', '/vlayout005-recorded.html');
        expect((await t.measure()).ratio).toBe(60);
        await t.go('live', '/vlayout006-live.html');
        expect((await t.measure()).ratio).toBe(60);
    });
});

test('leaving Theater is remembered per kind, and Rumble\'s theater button brings it back, four times over', async () => {
    await withTheater(async (t) => {
        await t.start();
        await t.go('vod', '/vcycle001-recorded.html');
        const playerButtons = await t.page.evaluate(() => document.querySelectorAll('#videoPlayer button').length);
        await t.nudge(-3); // 75 -> 69

        for (let cycle = 0; cycle < 4; cycle += 1) {
            await t.exit();
            expect(await t.measure(), `cycle ${cycle}: exit`).toEqual({ open: false });
            // The next recorded video stays out of Theater.
            await t.go('vod', `/vcycle1${cycle}0-recorded.html`);
            expect(await t.measure(), `cycle ${cycle}: next recorded video`).toEqual({ open: false });
            // A live stream is its own kind and still opens.
            await t.go('live', `/vcycle1${cycle}1-live.html`);
            expect((await t.measure()).open, `cycle ${cycle}: live`).toBe(true);
            // Back to a recording, then in again through Rumble's own button.
            await t.go('vod', `/vcycle1${cycle}2-recorded.html`);
            expect(await t.measure()).toEqual({ open: false });
            await t.nativeTheater();
            const reopened = await t.measure();
            expect(reopened, `cycle ${cycle}: reopened`).toMatchObject({ open: true, ratio: 69, playerInside: true });
            expect(Math.abs(reopened.sideShare - 31), `cycle ${cycle}: geometry`).toBeLessThanOrEqual(1);
        }

        expect((await t.settings()).theaterLayout.vod).toEqual({ ratio: 69, open: true });
        // No second button on the player: the way back in is Rumble's own.
        await t.exit();
        expect(await t.page.evaluate(() => document.querySelectorAll('#videoPlayer button').length)).toBe(playerButtons);
    });
});

test('a channel\'s own layout wins when the override is on, and only then', async () => {
    await withTheater(async (t) => {
        const slug = 'layout-channel';
        await t.start({
            settings: {
                theaterChannelLayout: true,
                theaterLayout: { vod: { ratio: 70 }, channels: { [slug]: { vod: { ratio: 40 } } } },
            },
        });
        await t.go('vod', '/vchannel001-recorded.html');
        expect(await t.page.evaluate(() => PerChannelPrefs.currentSlug())).toBe(slug);
        expect((await t.measure()).ratio).toBe(40);

        // A change while the override is on belongs to the channel, not to
        // every recorded video.
        await t.nudge(2); // 40 -> 44
        const stored = await t.page.evaluate(() => Settings.get('theaterLayout'));
        expect(stored).toEqual({ vod: { ratio: 70 }, channels: { [slug]: { vod: { ratio: 44 } } } });

        // Off again: the kind's own memory applies.
        await t.page.evaluate(() => Settings.set('theaterChannelLayout', false));
        await t.go('vod', '/vchannel002-recorded.html');
        expect((await t.measure()).ratio).toBe(70);

        // One reset clears it all, channel layouts included.
        await t.page.evaluate(() => {
            Settings.set('theaterChannelLayout', true);
            Settings.set('theaterLayout', {});
        });
        await t.go('vod', '/vchannel003-recorded.html');
        expect((await t.measure()).ratio).toBe(75);
    });
});

test('a divider drag moves live and is remembered once, when it ends', async () => {
    await withTheater(async (t) => {
        await t.start();
        await t.go('vod', '/vdrag001-recorded.html');
        const box = await t.page.locator('#rx-split-divider').boundingBox();
        const wrapper = await t.page.locator('#rx-split-wrapper').boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await t.page.mouse.move(x, y);
        await t.page.mouse.down();
        // Ten per cent of the width to the left, in steps, like a real drag.
        for (let step = 1; step <= 10; step += 1) await t.page.mouse.move(x - (wrapper.width * 0.01 * step), y);
        const during = await t.page.evaluate(() => ({
            ratio: Number(document.querySelector('#rx-split-divider').getAttribute('aria-valuenow')),
            stored: Settings.get('theaterLayout'),
        }));
        // The divider follows the pointer, but nothing is written yet.
        expect(Math.abs(during.ratio - 65)).toBeLessThanOrEqual(1);
        expect(during.stored).toEqual({});
        await t.page.mouse.up();
        const after = await t.settings();
        expect(Math.abs(after.theaterLayout.vod.ratio - 65)).toBeLessThanOrEqual(1);
        // And the next recorded video opens where the drag left it.
        await t.go('vod', '/vdrag002-recorded.html');
        expect((await t.measure()).ratio).toBe(after.theaterLayout.vod.ratio);
    });
});

test('Escape leaves Theater the way the exit button does, and it is remembered', async () => {
    await withTheater(async (t) => {
        await t.start();
        await t.go('vod', '/vescape001-recorded.html');
        expect((await t.measure()).open).toBe(true);
        await t.page.keyboard.press('Escape');
        expect(await t.measure()).toEqual({ open: false });
        expect((await t.settings()).theaterLayout.vod).toEqual({ open: false });
        await t.go('vod', '/vescape002-recorded.html');
        expect(await t.measure()).toEqual({ open: false });
    });
});

test('keyboard moves in the narrow layout never overwrite the desktop ratio', async () => {
    await withTheater(async (t) => {
        await t.start({ settings: { theaterLayout: { vod: { ratio: 68 } } } });
        await t.page.setViewportSize({ width: 800, height: 900 });
        await t.go('vod', '/vnarrow001-recorded.html');
        const divider = t.page.locator('#rx-split-divider');
        await expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
        await divider.focus();
        await divider.press('Home');
        await expect(divider).toHaveAttribute('aria-valuenow', '32');
        await divider.press('ArrowLeft');
        await expect(divider).toHaveAttribute('aria-valuenow', '32');
        await divider.press('End');
        await expect(divider).toHaveAttribute('aria-valuenow', '54');
        await divider.press('ArrowRight');
        await expect(divider).toHaveAttribute('aria-valuenow', '54');
        // The narrow geometry moved, but what desktop opens with did not.
        expect((await t.settings()).theaterLayout).toEqual({ vod: { ratio: 68 } });
        await t.page.setViewportSize({ width: 1440, height: 900 });
        await t.go('vod', '/vnarrow002-recorded.html');
        expect((await t.measure()).ratio).toBe(68);
    });
});

test('a window resize keeps the size set in the narrow layout this visit', async () => {
    await withTheater(async (t) => {
        await t.start({ settings: { theaterLayout: { vod: { ratio: 68 } } } });
        await t.page.setViewportSize({ width: 800, height: 900 });
        await t.go('vod', '/vnarrow003-recorded.html');
        const divider = t.page.locator('#rx-split-divider');
        await expect(divider).toHaveAttribute('aria-orientation', 'horizontal');
        const sideHeight = () => t.page.evaluate(() => Math.round(
            document.querySelector('#rx-split-right').getBoundingClientRect().height
            / document.querySelector('#rx-split-wrapper').getBoundingClientRect().height * 100));
        // Positive control: the narrow layout opens with a 60% side panel.
        expect(await sideHeight()).toBeGreaterThanOrEqual(59);
        expect(await sideHeight()).toBeLessThanOrEqual(61);
        await divider.focus();
        for (let i = 0; i < 4; i += 1) await divider.press('ArrowUp');
        await expect(divider).toHaveAttribute('aria-valuenow', '32');
        const adjusted = await sideHeight();
        expect(adjusted).toBeGreaterThan(65);

        // The event a phone's address bar or a dragged window edge sends. It
        // used to put the stored desktop ratio back, which is 60% here.
        await t.page.evaluate(() => window.dispatchEvent(new Event('resize')));
        await t.page.setViewportSize({ width: 790, height: 880 });
        await expect(divider).toHaveAttribute('aria-valuenow', '32');
        expect(Math.abs(await sideHeight() - adjusted)).toBeLessThanOrEqual(1);
        // Still never saved.
        expect((await t.settings()).theaterLayout).toEqual({ vod: { ratio: 68 } });
    });
});
