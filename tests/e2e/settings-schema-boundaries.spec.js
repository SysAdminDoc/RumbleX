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

test('encrypted Gist pull preserves local credentials but rejects unsafe settings', async ({ context, serviceWorker, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const passphrase = 'correct horse battery staple';
    const localToken = 'github_pat_local_fixture';
    const gistId = 'gist-fixture-id';
    const pulled = {
        ...MALICIOUS_SETTINGS,
        autoplayQueue: [
            'javascript://rumble.com/%0Aalert(1)',
            'https://example.com/off-site',
            'https://rumble.com/vsafe-gist.html',
        ],
        encryptedGistSyncToken: 'remote-token-must-not-win',
        encryptedGistSyncId: 'remote-id-must-not-win',
    };

    await page.evaluate(({ localToken, gistId }) => chrome.storage.local.set({
        rx_settings: {
            schemaVersion: 2,
            backupHistory: true,
            backupHistoryLimit: 10,
            encryptedGistSync: true,
            encryptedGistSyncToken: localToken,
            encryptedGistSyncId: gistId,
        },
    }), { localToken, gistId });

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
