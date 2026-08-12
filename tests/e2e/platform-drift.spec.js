// @ts-check
// Release-gated contracts for Rumble's Shorts, Wallet, and Premium surfaces.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'platform');

async function openFixture(context, fixtureName, routePath) {
    const html = fs.readFileSync(path.join(FIXTURE_DIR, fixtureName), 'utf8');
    const url = `https://rumble.com${routePath}`;
    await context.route(url, (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: html,
    }));
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    return page;
}

async function findTabId(serviceWorker, url) {
    return serviceWorker.evaluate(async (targetUrl) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find((entry) => entry.url === targetUrl);
        if (!tab?.id) throw new Error(`Platform fixture tab not found: ${targetUrl}`);
        return tab.id;
    }, url);
}

async function inspectContentWorld(serviceWorker, tabId, selectorNames) {
    return serviceWorker.evaluate(async ({ targetTabId, names }) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            world: 'ISOLATED',
            func: (surfaceNames) => {
                if (typeof Page === 'undefined' || typeof Selectors === 'undefined') {
                    return { ready: false };
                }
                const surfaces = {};
                for (const name of surfaceNames) {
                    const element = Selectors.find(name);
                    surfaces[name] = {
                        found: !!element,
                        display: element ? getComputedStyle(element).display : null,
                    };
                }
                return { ready: true, route: Page.classify(), surfaces };
            },
            args: [names],
        });
        return execution?.result || { ready: false };
    }, { targetTabId: tabId, names: selectorNames });
}

async function waitForInspection(serviceWorker, tabId, selectorNames) {
    let result;
    await expect.poll(async () => {
        result = await inspectContentWorld(serviceWorker, tabId, selectorNames);
        return result.ready && selectorNames.every((name) => result.surfaces[name]?.found);
    }, {
        message: `RumbleX content world did not resolve: ${selectorNames.join(', ')}`,
        timeout: 15_000,
    }).toBe(true);
    return result;
}

test('Shorts route classification resolves every dedicated Shorts surface', async ({ context, serviceWorker }) => {
    const page = await openFixture(context, 'shorts-route.html', '/shorts/vfixture');
    const names = ['shorts.feed', 'shorts.card', 'shorts.player', 'shorts.navItem'];
    const result = await waitForInspection(serviceWorker, await findTabId(serviceWorker, page.url()), names);

    expect(result.route).toBe('shorts');
    for (const name of names) expect(result.surfaces[name].found).toBe(true);
});

test('Wallet tip contract resolves and the opt-in hide toggle follows the watch route', async ({ context, serviceWorker }) => {
    await serviceWorker.evaluate(() => chrome.storage.local.set({
        rx_settings: { schemaVersion: 2, hideWalletTipButton: true },
    }));
    const page = await openFixture(context, 'wallet-tip.html', '/vfixture-wallet-tip.html');
    const result = await waitForInspection(
        serviceWorker,
        await findTabId(serviceWorker, page.url()),
        ['wallet.tipButton'],
    );

    expect(result.route).toBe('watch');
    await expect.poll(async () => {
        const next = await inspectContentWorld(serviceWorker, await findTabId(serviceWorker, page.url()), ['wallet.tipButton']);
        return next.surfaces?.['wallet.tipButton']?.display;
    }, { timeout: 15_000 }).toBe('none');
});

test('Premium promo contract resolves and the default ad cleanup hides it', async ({ context, serviceWorker }) => {
    const page = await openFixture(context, 'premium-promo.html', '/vfixture-premium-promo.html');
    const result = await waitForInspection(
        serviceWorker,
        await findTabId(serviceWorker, page.url()),
        ['premium.promo'],
    );

    expect(result.route).toBe('watch');
    expect(result.surfaces['premium.promo'].display).toBe('none');
});
