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
    expect(settings.schemaVersion).toBe(2);
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
