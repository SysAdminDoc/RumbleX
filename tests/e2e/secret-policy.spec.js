// @ts-check
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { webcrypto } = require('crypto');

const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(__dirname, '..', '..', 'rumble_decoded.html'), 'utf8');
const SECRETS = Object.freeze({
    webhook: 'https://discord.com/api/webhooks/123456789/discord-secret-token',
    token: 'github_pat_gist-secret-token-value',
    gistId: 'gist-secret-id-value',
});

function expectSecretsAbsent(serialized) {
    for (const secret of [
        ...Object.values(SECRETS),
        '123456789',
        'discord-secret-token',
        'gist-secret-token-value',
    ]) {
        expect(serialized).not.toContain(secret);
    }
}

async function readDownload(download) {
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const bytes = fs.readFileSync(filePath);
    return download.suggestedFilename().endsWith('.gz')
        ? zlib.gunzipSync(bytes).toString('utf8')
        : bytes.toString('utf8');
}

test('file backups exclude credentials by default and require an explicit warned opt-in', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.evaluate((secrets) => chrome.storage.local.set({
        rx_settings: {
            schemaVersion: 4,
            darkEnhance: true,
            discordWebhookUrl: secrets.webhook,
            encryptedGistSync: true,
            encryptedGistSyncToken: secrets.token,
            encryptedGistSyncId: secrets.gistId,
        },
    }), SECRETS);

    const includeCredentials = page.locator('#export-include-credentials');
    await expect(includeCredentials).not.toBeChecked();
    await expect(page.locator('#export-credentials-warning')).toContainText('usable Discord webhook, GitHub token, and Gist ID');

    const ordinaryDownload = page.waitForEvent('download');
    await page.locator('#export-btn').click();
    const ordinary = await ordinaryDownload;
    expect(ordinary.suggestedFilename()).toMatch(/\.json\.gz$/);
    const ordinaryText = await readDownload(ordinary);
    const ordinaryJson = JSON.parse(ordinaryText);
    expect(ordinaryJson.credentialsIncluded).toBe(false);
    expect(ordinaryJson.settings.darkEnhance).toBe(true);
    for (const key of ['discordWebhookUrl', 'encryptedGistSyncToken', 'encryptedGistSyncId']) {
        expect(ordinaryJson.settings).not.toHaveProperty(key);
    }
    expectSecretsAbsent(ordinaryText);

    await includeCredentials.check();
    const credentialDownload = page.waitForEvent('download');
    await page.locator('#export-btn').click();
    const credentialText = await readDownload(await credentialDownload);
    const credentialJson = JSON.parse(credentialText);
    expect(credentialJson.credentialsIncluded).toBe(true);
    expect(credentialJson.settings).toMatchObject({
        discordWebhookUrl: SECRETS.webhook,
        encryptedGistSyncToken: SECRETS.token,
        encryptedGistSyncId: SECRETS.gistId,
    });
    await expect(page.locator('#status')).toContainText('contains usable credentials');
});

test('in-page settings export uses the ordinary secret-free transport policy', async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await options.evaluate((secrets) => chrome.storage.local.set({
        rx_settings: {
            schemaVersion: 4,
            darkEnhance: true,
            discordWebhookUrl: secrets.webhook,
            encryptedGistSync: true,
            encryptedGistSyncToken: secrets.token,
            encryptedGistSyncId: secrets.gistId,
        },
    }), SECRETS);

    const rumble = await context.newPage();
    await rumble.route('**/*', (route) => {
        if (route.request().isNavigationRequest() && route.request().url().startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await rumble.goto('https://rumble.com/vsecret-export-fixture.html', { waitUntil: 'domcontentloaded' });
    await rumble.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });
    await rumble.evaluate(() => document.querySelector('#rx-settings-btn')?.click());
    await expect(rumble.locator('body')).toHaveClass(/rx-panel-open/);
    await expect(rumble.locator('#rx-modal')).not.toHaveAttribute('aria-hidden', 'true');

    const downloadEvent = rumble.waitForEvent('download');
    await rumble.locator('.rx-m-footer .rx-m-btn-primary').click();
    const text = await readDownload(await downloadEvent);
    const settings = JSON.parse(text);
    expect(settings.darkEnhance).toBe(true);
    for (const key of ['discordWebhookUrl', 'encryptedGistSyncToken', 'encryptedGistSyncId']) {
        expect(settings).not.toHaveProperty(key);
    }
    expectSecretsAbsent(text);
});

test('privacy and error JSON exports redact token-bearing URL paths', async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await options.evaluate((secrets) => chrome.storage.local.set({
        rx_settings: {
            schemaVersion: 4,
            privacyReport: true,
            debugErrorLog: true,
            discordWebhookUrl: secrets.webhook,
            encryptedGistSync: true,
            encryptedGistSyncToken: secrets.token,
            encryptedGistSyncId: secrets.gistId,
        },
    }), SECRETS);

    const rumble = await context.newPage();
    await rumble.route('**/*', (route) => {
        if (route.request().isNavigationRequest() && route.request().url().startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await rumble.goto('https://rumble.com/vsecret-policy-fixture.html', { waitUntil: 'domcontentloaded' });
    await rumble.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });

    const injected = await options.evaluate(async (secrets) => {
        const tabs = await chrome.tabs.query({ url: ['*://rumble.com/*', '*://*.rumble.com/*'] });
        const tab = tabs.find((item) => typeof item.id === 'number');
        if (!tab?.id) return false;
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'ISOLATED',
            func: (values) => {
                RxErrorLog.record('secret-policy-test', new Error(
                    `Request failed at ${values.webhook}?token=query-secret-value#private-fragment Authorization: Bearer bearer-secret-value`,
                ), `Sync token ${values.token}`);
                return true;
            },
            args: [secrets],
        });
        return result[0]?.result === true;
    }, SECRETS);
    expect(injected).toBe(true);

    await options.locator('#privacy-section summary').click();
    await options.locator('#privacy-refresh-btn').click();
    await expect(options.locator('#privacy-report-pre')).toContainText('[redacted]');
    const renderedReport = await options.locator('#privacy-report-pre').textContent();
    expectSecretsAbsent(renderedReport || '');

    const privacyDownload = options.waitForEvent('download');
    await options.locator('#privacy-export-btn').click();
    const privacyText = await readDownload(await privacyDownload);
    expectSecretsAbsent(privacyText);

    const errorDownload = options.waitForEvent('download');
    await options.locator('#errorlog-export-btn').click();
    const errorText = await readDownload(await errorDownload);
    expect(errorText).toContain('[redacted]');
    expectSecretsAbsent(errorText);
    for (const secret of ['query-secret-value', 'private-fragment', 'bearer-secret-value']) {
        expect(errorText).not.toContain(secret);
    }
});

test('encrypted Gist payloads omit local credentials before encryption', async ({ context, serviceWorker, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.evaluate((secrets) => chrome.storage.local.set({
        rx_settings: {
            schemaVersion: 4,
            darkEnhance: true,
            encryptedGistSync: true,
            discordWebhookUrl: secrets.webhook,
            encryptedGistSyncToken: secrets.token,
            encryptedGistSyncId: secrets.gistId,
        },
    }), SECRETS);

    await serviceWorker.evaluate(() => {
        globalThis.__rxSecretPolicyFetch = globalThis.fetch;
        globalThis.__rxCapturedGistPush = null;
        globalThis.fetch = async (url, init = {}) => {
            if (String(url).startsWith('https://api.github.com/gists/')) {
                globalThis.__rxCapturedGistPush = {
                    url: String(url),
                    body: String(init.body || ''),
                };
                return new Response(JSON.stringify({ id: 'gist-secret-id-value' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return globalThis.__rxSecretPolicyFetch(url, init);
        };
    });

    const passphrase = 'correct horse battery staple';
    const response = await page.evaluate((value) => chrome.runtime.sendMessage({
        action: 'gistSyncPush',
        passphrase: value,
    }), passphrase);
    expect(response.ok).toBe(true);

    const captured = await serviceWorker.evaluate(() => globalThis.__rxCapturedGistPush);
    expect(captured).toBeTruthy();
    const requestBody = JSON.parse(captured.body);
    const envelope = JSON.parse(requestBody.files['rumblex-settings.enc.json'].content).rumblex;
    const baseKey = await webcrypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey'],
    );
    const aesKey = await webcrypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: Buffer.from(envelope.salt, 'base64'),
            iterations: 200000,
            hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt'],
    );
    const plaintext = await webcrypto.subtle.decrypt(
        { name: 'AES-GCM', iv: Buffer.from(envelope.iv, 'base64') },
        aesKey,
        Buffer.from(envelope.ciphertext, 'base64'),
    );
    const decryptedText = new TextDecoder().decode(plaintext);
    const decrypted = JSON.parse(decryptedText);
    expect(decrypted.darkEnhance).toBe(true);
    for (const key of ['discordWebhookUrl', 'encryptedGistSyncToken', 'encryptedGistSyncId']) {
        expect(decrypted).not.toHaveProperty(key);
    }
    expectSecretsAbsent(decryptedText);
});
