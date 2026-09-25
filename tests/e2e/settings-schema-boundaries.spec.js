// @ts-check
// Full settings writes must cross the same schema boundary regardless of
// whether they originate in a content message, profile restore, or Gist pull.
const { test, expect } = require('./_fixtures');

const MALICIOUS_SETTINGS = {
    schemaVersion: 2,
    adNuker: 'not-a-boolean',
    theme: 'invented',
    splitRatio: 999,
    blockedKeywords: [{ bad: true }, 'safe phrase'],
    hiddenCategories: ['news', 'x} body { display:none } /*'],
    autoplayQueue: [
        'javascript://rumble.com/%0Aalert(1)',
        'https://example.com/off-site',
        'https://rumble.com/vsafe-profile.html',
    ],
    watchedChannels: [
        { url: 'javascript://rumble.com/bad', name: 'Bad' },
        { url: 'https://rumble.com/c/safe', name: 'Safe' },
    ],
    unknownSetting: true,
};

function expectSanitized(settings, safeVideoUrl) {
    expect(settings.schemaVersion).toBe(4);
    expect(settings.adNuker).toBeUndefined();
    expect(settings.theme).toBeUndefined();
    expect(settings.splitRatio).toBe(95);
    expect(settings.blockedKeywords).toEqual(['safe phrase']);
    expect(settings.hiddenCategories).toEqual(['news']);
    expect(settings.autoplayQueue).toEqual([safeVideoUrl]);
    expect(settings.watchedChannels).toEqual([expect.objectContaining({
        url: 'https://rumble.com/c/safe',
        name: 'Safe',
    })]);
    expect(settings.unknownSetting).toBeUndefined();
}

test('background save and profile restore use the canonical settings schema', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);

    const saveResponse = await page.evaluate((settings) => chrome.runtime.sendMessage({
        action: 'saveSettings',
        data: settings,
    }), MALICIOUS_SETTINGS);
    expect(saveResponse).toEqual({ success: true });
    let stored = await page.evaluate(async () => (await chrome.storage.local.get('rx_settings')).rx_settings);
    expectSanitized(stored, 'https://rumble.com/vsafe-profile.html');

    await page.evaluate((settings) => chrome.storage.local.set({
        rx_settings: { backupHistory: true, backupHistoryLimit: 10 },
        rx_settings_profiles: [{
            id: 'p_untrusted',
            name: 'Untrusted legacy profile',
            createdAt: Date.now(),
            settings,
        }],
    }), MALICIOUS_SETTINGS);
    const profileResponse = await page.evaluate(() => chrome.runtime.sendMessage({
        action: 'switchProfile',
        id: 'p_untrusted',
    }));
    expect(profileResponse).toEqual({ ok: true, name: 'Untrusted legacy profile' });
    stored = await page.evaluate(async () => (await chrome.storage.local.get('rx_settings')).rx_settings);
    expectSanitized(stored, 'https://rumble.com/vsafe-profile.html');
    expect(stored.activeProfileId).toBe('p_untrusted');
});

test('portable settings import accepts a valid payload above the old 2 MiB boundary', async ({ context, extensionId }) => {
    test.setTimeout(60_000);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);

    const result = await page.evaluate(async () => {
        const sponsorSegments = {};
        for (let video = 0; video < 750; video++) {
            sponsorSegments[`v${video}`] = Array.from({ length: 80 }, (_, segment) => ({
                start: segment * 10,
                end: segment * 10 + 5,
                category: 'selfpromo',
            }));
        }
        const data = { sponsorSegments };
        const bytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
        const response = await chrome.runtime.sendMessage({ action: 'importSettings', data });
        const stored = await chrome.storage.local.get('rx_settings');
        return {
            bytes,
            response,
            videos: Object.keys(stored.rx_settings?.sponsorSegments || {}).length,
        };
    });

    expect(result.bytes).toBeGreaterThan(2 * 1024 * 1024);
    expect(result.bytes).toBeLessThan(4.5 * 1024 * 1024);
    expect(result.response.success).toBe(true);
    expect(result.videos).toBe(750);
});

test('partial stored settings still use the default-enabled snapshot history', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.evaluate(() => chrome.storage.local.set({
        rx_settings: { schemaVersion: 4, wideLayout: false },
        rx_settings_snapshots: [],
    }));

    const response = await page.evaluate(() => chrome.runtime.sendMessage({
        action: 'createSettingsSnapshot',
        reason: 'partial-settings-defaults',
    }));
    expect(response.ok).toBe(true);
    const stored = await page.evaluate(async () => (
        (await chrome.storage.local.get('rx_settings_snapshots')).rx_settings_snapshots || []
    ));
    expect(stored).toHaveLength(1);
});

test('large settings can be saved, restored as a profile, and encrypted for Gist sync', async ({ context, serviceWorker, extensionId }) => {
    test.setTimeout(120_000);
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const passphrase = 'large payload fixture passphrase';

    const seeded = await page.evaluate(async () => {
        const sponsorSegments = {};
        for (let video = 0; video < 750; video += 1) {
            sponsorSegments[`v${video}`] = Array.from({ length: 80 }, (_, segment) => ({
                start: segment * 10,
                end: segment * 10 + 5,
                category: 'selfpromo',
            }));
        }
        const data = {
            sponsorSegments,
            encryptedGistSync: true,
            encryptedGistSyncToken: 'github_pat_large_fixture',
            encryptedGistSyncId: 'large-fixture-id',
            backupHistory: true,
            backupHistoryLimit: 10,
        };
        const bytes = new TextEncoder().encode(JSON.stringify(data)).byteLength;
        const save = await chrome.runtime.sendMessage({ action: 'saveSettings', data });
        const snapshot = await chrome.runtime.sendMessage({
            action: 'createSettingsSnapshot',
            reason: 'large-message-receipt',
        });
        const restore = await chrome.runtime.sendMessage({
            action: 'restoreProfile',
            profile: { id: 'p_large', name: 'Large', createdAt: Date.now(), settings: data },
        });
        return { bytes, save, snapshot, snapshotBytes: JSON.stringify(snapshot).length, restore };
    });
    expect(seeded.bytes).toBeGreaterThan(2 * 1024 * 1024);
    expect(seeded.bytes).toBeLessThan(4.5 * 1024 * 1024);
    expect(seeded.save.success).toBe(true);
    expect(seeded.snapshot.ok).toBe(true);
    expect(seeded.snapshotBytes).toBeLessThan(512);
    expect(seeded.restore.ok).toBe(true);

    await serviceWorker.evaluate(() => {
        const originalFetch = globalThis.fetch;
        globalThis.__rxLargeGistOriginalFetch = originalFetch;
        globalThis.fetch = async (url, init) => {
            if (String(url).startsWith('https://api.github.com/gists/')) {
                globalThis.__rxLargeGistBody = String(init?.body || '');
                return new Response(JSON.stringify({ id: 'large-fixture-id' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return originalFetch(url, init);
        };
    });

    const pushed = await page.evaluate((secret) => chrome.runtime.sendMessage({
        action: 'gistSyncPush',
        passphrase: secret,
    }), passphrase);
    expect(pushed.ok).toBe(true);

    const verified = await serviceWorker.evaluate(async (secret) => {
        try {
            const request = JSON.parse(globalThis.__rxLargeGistBody);
            const payload = JSON.parse(request.files['rumblex-settings.enc.json'].content).rumblex;
            const fromB64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
            const baseKey = await crypto.subtle.importKey(
                'raw', new TextEncoder().encode(secret), { name: 'PBKDF2' }, false, ['deriveKey'],
            );
            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: fromB64(payload.salt),
                    iterations: 200000,
                    hash: 'SHA-256',
                },
                baseKey,
                { name: 'AES-GCM', length: 256 },
                false,
                ['decrypt'],
            );
            const plaintext = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: fromB64(payload.iv) },
                key,
                fromB64(payload.ciphertext),
            );
            const settings = JSON.parse(new TextDecoder().decode(plaintext));
            return {
                requestBytes: new TextEncoder().encode(globalThis.__rxLargeGistBody).byteLength,
                videos: Object.keys(settings.sponsorSegments || {}).length,
                hasToken: Object.hasOwn(settings, 'encryptedGistSyncToken'),
            };
        } finally {
            globalThis.fetch = globalThis.__rxLargeGistOriginalFetch;
            delete globalThis.__rxLargeGistOriginalFetch;
            delete globalThis.__rxLargeGistBody;
        }
    }, passphrase);
    expect(verified.requestBytes).toBeGreaterThan(2 * 1024 * 1024);
    expect(verified.videos).toBe(750);
    expect(verified.hasToken).toBe(false);
});

test('encrypted Gist pull preserves local credentials but rejects unsafe settings', async ({ context, serviceWorker, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const passphrase = 'correct horse battery staple';
    const localToken = 'github_pat_local_fixture';
    const gistId = 'gist-fixture-id';
    const webhook = 'https://discord.com/api/webhooks/123456789/local-secret';
    const liveApiUrl = 'https://rumble.com/-livestream-api/account?key=local-api-secret';
    const pulled = {
        ...MALICIOUS_SETTINGS,
        autoplayQueue: [
            'javascript://rumble.com/%0Aalert(1)',
            'https://example.com/off-site',
            'https://rumble.com/vsafe-gist.html',
        ],
        encryptedGistSyncToken: 'remote-token-must-not-win',
        encryptedGistSyncId: 'remote-id-must-not-win',
        discordWebhookUrl: 'https://discord.com/api/webhooks/123456789/remote-must-not-win',
        liveStreamApiUrl: 'https://rumble.com/-livestream-api/account?key=remote-must-not-win',
    };

    await page.evaluate(({ localToken, gistId, webhook, liveApiUrl }) => chrome.storage.local.set({
        rx_settings: {
            schemaVersion: 2,
            backupHistory: true,
            backupHistoryLimit: 10,
            encryptedGistSync: true,
            encryptedGistSyncToken: localToken,
            encryptedGistSyncId: gistId,
            discordWebhookUrl: webhook,
            liveStreamApiUrl: liveApiUrl,
        },
    }), { localToken, gistId, webhook, liveApiUrl });

    await serviceWorker.evaluate(async ({ passphrase, pulled }) => {
        const enc = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            'raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey'],
        );
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const aesKey = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt'],
        );
        const cipher = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv }, aesKey, enc.encode(JSON.stringify(pulled)),
        );
        const b64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const payload = {
            rumblex: {
                schemaVersion: 3,
                cipher: 'AES-GCM-256',
                kdf: 'PBKDF2-SHA256-200000',
                salt: b64(salt),
                iv: b64(iv),
                ciphertext: b64(cipher),
                encryptedAt: '2026-08-13T00:00:00.000Z',
            },
        };
        globalThis.__rxSchemaTestOriginalFetch = globalThis.fetch;
        globalThis.fetch = async (url, init) => {
            if (String(url).startsWith('https://api.github.com/gists/')) {
                return new Response(JSON.stringify({
                    files: {
                        'rumblex-settings.enc.json': { content: JSON.stringify(payload) },
                    },
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return globalThis.__rxSchemaTestOriginalFetch(url, init);
        };
    }, { passphrase, pulled });

    const response = await page.evaluate((passphrase) => chrome.runtime.sendMessage({
        action: 'gistSyncPull',
        passphrase,
    }), passphrase);
    expect(response.ok).toBe(true);
    expect(response.encryptedAt).toBe('2026-08-13T00:00:00.000Z');

    const stored = await page.evaluate(async () => (await chrome.storage.local.get('rx_settings')).rx_settings);
    expectSanitized(stored, 'https://rumble.com/vsafe-gist.html');
    expect(stored.encryptedGistSyncToken).toBe(localToken);
    expect(stored.encryptedGistSyncId).toBe(gistId);
    expect(stored.discordWebhookUrl).toBe(webhook);
    expect(stored.liveStreamApiUrl).toBe(liveApiUrl);

    const snapshots = await page.evaluate(async () => (
        (await chrome.storage.local.get('rx_settings_snapshots')).rx_settings_snapshots || []
    ));
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].reason).toBe('pre-gist-pull');
    expect(snapshots[0].settings.encryptedGistSyncToken).toBe(localToken);
});

// The `encryptedGistSync` master switch was decorative until v3.42: it rendered
// a live toggle in Options while the background handler never read it, so a user
// who deliberately turned Gist sync off still had a working path that shipped
// every setting to a third-party host.
test('encrypted Gist sync refuses to run while the master switch is off', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);

    await page.evaluate(() => chrome.storage.local.set({
        rx_settings: {
            schemaVersion: 2,
            encryptedGistSync: false,
            encryptedGistSyncToken: 'github_pat_local_fixture',
            encryptedGistSyncId: 'gist-fixture-id',
        },
    }));

    for (const action of ['gistSyncPush', 'gistSyncPull']) {
        const response = await page.evaluate((act) => chrome.runtime.sendMessage({
            action: act,
            passphrase: 'correct horse battery staple',
        }), action);
        expect(response.ok).toBe(false);
        expect(response.reason).toBe('sync-disabled');
    }

    // Flipping the switch on must restore the normal credential-driven flow,
    // proving the gate is the only thing that refused above.
    await page.evaluate(() => chrome.storage.local.set({
        rx_settings: {
            schemaVersion: 2,
            encryptedGistSync: true,
            encryptedGistSyncToken: '',
            encryptedGistSyncId: '',
        },
    }));
    const enabled = await page.evaluate(() => chrome.runtime.sendMessage({
        action: 'gistSyncPull',
        passphrase: 'correct horse battery staple',
    }));
    expect(enabled.ok).toBe(false);
    expect(enabled.reason).toBe('missing-token');
});

// Every destructive action snapshots first except profile deletion, which used
// to drop a saved profile permanently with no snapshot and no undo. The project
// bans confirmation dialogs on the premise that snapshot-plus-undo replaces
// them, so that action had neither.
test('deleting a profile is reversible and snapshots the profile first', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);

    await page.evaluate(() => chrome.storage.local.set({
        rx_settings: { schemaVersion: 3, backupHistory: true, backupHistoryLimit: 10 },
        rx_settings_snapshots: [],
    }));

    const created = await page.evaluate(() => chrome.runtime.sendMessage({
        action: 'saveProfile', name: 'Deletable',
    }));
    expect(created.ok).toBe(true);

    const before = await page.evaluate(() => chrome.runtime.sendMessage({ action: 'listProfiles' }));
    const target = before.profiles.find((p) => p.name === 'Deletable');
    expect(target).toBeTruthy();

    const deleted = await page.evaluate((id) => chrome.runtime.sendMessage({
        action: 'deleteProfile', id,
    }), target.id);
    expect(deleted.ok).toBe(true);
    expect(deleted.name).toBe('Deletable');
    expect(deleted.undo?.id).toBe(target.id);
    expect(deleted.snapshotted).toBe(true);

    // Gone from the live list...
    const during = await page.evaluate(() => chrome.runtime.sendMessage({ action: 'listProfiles' }));
    expect(during.profiles.some((p) => p.id === target.id)).toBe(false);

    // ...recoverable from the undo payload...
    const restored = await page.evaluate((profile) => chrome.runtime.sendMessage({
        action: 'restoreProfile', profile,
    }), deleted.undo);
    expect(restored.ok).toBe(true);

    const after = await page.evaluate(() => chrome.runtime.sendMessage({ action: 'listProfiles' }));
    expect(after.profiles.some((p) => p.id === target.id && p.name === 'Deletable')).toBe(true);

    // ...and independently recoverable from the pre-delete snapshot.
    const snapshots = await page.evaluate(async () => (
        (await chrome.storage.local.get('rx_settings_snapshots')).rx_settings_snapshots || []
    ));
    expect(snapshots.some((s) => String(s.reason).startsWith('pre-profile-delete'))).toBe(true);

    // Restoring the same profile twice must not duplicate it.
    const again = await page.evaluate((profile) => chrome.runtime.sendMessage({
        action: 'restoreProfile', profile,
    }), deleted.undo);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('already-exists');
});

// switchProfile asked the service worker to message itself for its documented
// pre-switch snapshot. That call never lands — chrome.runtime.sendMessage does
// not reach content scripts, and a SW does not receive its own messages — and
// it sat inside an empty catch, so the snapshot silently never happened.
test('switching a profile actually writes its pre-switch snapshot', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);

    await page.evaluate(() => chrome.storage.local.set({
        rx_settings: { schemaVersion: 3, backupHistory: true, backupHistoryLimit: 10, wideLayout: true },
        rx_settings_snapshots: [],
    }));

    const created = await page.evaluate(() => chrome.runtime.sendMessage({
        action: 'saveProfile', name: 'Switchable',
    }));
    expect(created.ok).toBe(true);

    const switched = await page.evaluate((id) => chrome.runtime.sendMessage({
        action: 'switchProfile', id,
    }), created.id);
    expect(switched.ok).toBe(true);

    const snapshots = await page.evaluate(async () => (
        (await chrome.storage.local.get('rx_settings_snapshots')).rx_settings_snapshots || []
    ));
    expect(snapshots.some((s) => s.reason === 'pre-profile-switch')).toBe(true);
});

test('a failed pre-switch snapshot leaves the current profile untouched', async ({ context, serviceWorker, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.evaluate(() => chrome.storage.local.set({
        rx_settings: { schemaVersion: 4, backupHistory: true, backupHistoryLimit: 10, wideLayout: false },
        rx_settings_snapshots: [],
        rx_settings_profiles: [{
            id: 'p_atomic',
            name: 'Atomic',
            createdAt: Date.now(),
            settings: { schemaVersion: 4, backupHistory: true, backupHistoryLimit: 10, wideLayout: true },
        }],
    }));
    await serviceWorker.evaluate(() => {
        const realSet = chrome.storage.local.set.bind(chrome.storage.local);
        let failOnce = true;
        chrome.storage.local.set = async (items, callback) => {
            if (failOnce && items.rx_settings && items.rx_settings_snapshots) {
                failOnce = false;
                chrome.storage.local.set = realSet;
                throw new Error('snapshot storage unavailable');
            }
            return realSet(items, callback);
        };
    });

    const response = await page.evaluate(() => chrome.runtime.sendMessage({
        action: 'switchProfile',
        id: 'p_atomic',
    }));
    expect(response.ok).toBe(false);
    expect(response.reason).toContain('snapshot storage unavailable');
    const after = await page.evaluate(async () => chrome.storage.local.get([
        'rx_settings',
        'rx_settings_snapshots',
    ]));
    expect(after.rx_settings.wideLayout).toBe(false);
    expect(after.rx_settings.activeProfileId).toBeUndefined();
    expect(after.rx_settings_snapshots).toEqual([]);
});
