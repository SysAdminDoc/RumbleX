// @ts-check
// Privileged runtime actions must reject the wrong extension context before
// they read secrets, change storage, fetch, notify, or start a download.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('./_fixtures');

const WATCH_FIXTURE = fs.readFileSync(
    path.join(__dirname, '..', 'fixtures', 'platform', 'desktop-watch.html'),
    'utf8',
);

async function openRumbleTab(context) {
    const page = await context.newPage();
    await page.route('https://rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: WATCH_FIXTURE,
    }));
    await page.goto('https://rumble.com/vmessage-boundary.html');
    return page;
}

async function contentMessage(extensionPage, tabId, message) {
    return extensionPage.evaluate(async ({ targetTabId, payload }) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            world: 'ISOLATED',
            func: (value) => chrome.runtime.sendMessage(value),
            args: [payload],
        });
        return execution.result;
    }, { targetTabId: tabId, payload: message });
}

test('registry rejects unknown fields and unsafe extension-page URLs', async ({ context, extensionId, serviceWorker }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);

    const registry = await serviceWorker.evaluate(() => Object.entries(RX_MESSAGE_ACTIONS).map(([action, rule]) => ({
        action,
        senders: rule.senders,
        fields: Object.keys(rule.fields),
    })));
    expect(registry.length).toBeGreaterThan(40);
    expect(registry.every((entry) => entry.senders.length > 0 && Array.isArray(entry.fields))).toBe(true);

    expect(await options.evaluate(() => chrome.runtime.sendMessage({ action: 'listProfiles' })))
        .toMatchObject({ ok: true });
    expect(await options.evaluate(() => chrome.runtime.sendMessage({ action: 'listProfiles', surprise: true })))
        .toEqual({ ok: false, reason: 'invalid-payload', field: 'surprise' });
    expect(await options.evaluate(() => chrome.runtime.sendMessage({
        action: 'addWatchedChannel',
        url: 'https://example.invalid/c/not-rumble',
        name: 'Unsafe',
    }))).toEqual({ ok: false, reason: 'invalid-payload', field: 'url' });
    expect(await options.evaluate(() => chrome.runtime.sendMessage({
        action: 'archiveImportQueue',
        payload: {
            schemaVersion: 1,
            jobs: [{
                videoId: 'vunsafe',
                videoUrl: 'javascript://rumble.com/bad',
                unexpected: true,
            }],
        },
    }))).toEqual({ ok: false, reason: 'invalid-payload', field: 'payload' });
});

test('Rumble content scripts cannot invoke extension-only or secret-bearing actions', async ({ context, extensionId, serviceWorker }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const rumble = await openRumbleTab(context);
    const tabId = await options.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        return tabs.find((tab) => tab.url === url)?.id || null;
    }, rumble.url());
    expect(tabId).toEqual(expect.any(Number));

    await options.evaluate(() => chrome.storage.local.set({
        rx_settings: {
            encryptedGistSync: true,
            encryptedGistSyncToken: 'github_pat_boundary_fixture',
            encryptedGistSyncId: 'boundary-gist-id',
        },
    }));
    await serviceWorker.evaluate(() => {
        globalThis.__rxBoundaryFetchCount = 0;
        globalThis.__rxBoundaryRealFetch = globalThis.fetch;
        globalThis.fetch = async (...args) => {
            globalThis.__rxBoundaryFetchCount += 1;
            return globalThis.__rxBoundaryRealFetch(...args);
        };
    });

    try {
        const settings = await contentMessage(options, tabId, { action: 'getSettings' });
        expect(settings).toEqual(expect.any(Object));

        expect(await contentMessage(options, tabId, {
            action: 'gistSyncPush',
            passphrase: 'correct horse battery staple',
        })).toEqual({ ok: false, reason: 'sender-not-allowed', field: null });
        expect(await contentMessage(options, tabId, {
            action: 'setLocalData',
            data: { rx_history: 'must-not-write' },
        })).toEqual({ ok: false, reason: 'sender-not-allowed', field: null });
        expect(await contentMessage(options, tabId, {
            action: 'download',
            data: { url: 'javascript://rumble.com/bad', filename: 'bad.mp4', extra: true },
        })).toEqual({ ok: false, reason: 'invalid-payload', field: 'data' });
        expect(await contentMessage(options, tabId, {
            action: 'archiveEnqueueChannel',
            channelUrl: 'https://example.invalid/c/nope',
            maxItems: 5,
            filterClips: false,
        })).toEqual({ ok: false, reason: 'invalid-payload', field: 'channelUrl' });

        expect(await serviceWorker.evaluate(() => globalThis.__rxBoundaryFetchCount)).toBe(0);
        const pending = await options.evaluate(async () => (
            await chrome.storage.local.get('rx_pending_local_data_op')
        ).rx_pending_local_data_op || null);
        expect(pending).toBeNull();

        expect(await options.evaluate(() => chrome.runtime.sendMessage({
            action: 'parseHtmlOffscreen',
            html: '<title>Message boundary</title>',
        }))).toMatchObject({ ok: true });
        expect(await contentMessage(options, tabId, {
            target: 'offscreen',
            action: 'pauseArchiveWrites',
        })).toEqual({ ok: false, reason: 'sender-not-allowed' });
    } finally {
        await serviceWorker.evaluate(() => {
            if (globalThis.__rxBoundaryRealFetch) globalThis.fetch = globalThis.__rxBoundaryRealFetch;
            delete globalThis.__rxBoundaryRealFetch;
            delete globalThis.__rxBoundaryFetchCount;
        });
    }
});
