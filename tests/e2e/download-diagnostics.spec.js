// @ts-check
// Downloader diagnostic persistence, redaction, and options-page affordances.
const { test, expect } = require('./_fixtures');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');

const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(__dirname, '..', '..', 'rumble_decoded.html'), 'utf8');

test('download diagnostics redact secrets and expose local copy/export controls', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);

    const result = await page.evaluate(async () => {
        await chrome.runtime.sendMessage({ action: 'clearDownloadDiagnostics' });
        const recorded = await chrome.runtime.sendMessage({
            action: 'recordDownloadDiagnostic',
            diagnostic: {
                source: 'content',
                operation: 'clip-export',
                operationId: 'clip-test-operation',
                stage: 'segment-download',
                error: {
                    message: 'HTTP 403 at https://hugh.cdn.rumble.cloud/signed-supersecretsegment123456789/video.mp4?token=query-secret-value&quality=1080#private-fragment',
                    authorization: 'Bearer bearer-secret-value',
                },
                quality: { label: '1080p', height: 1080, format: 'mp4' },
                muxer: { requested: 'mediabunnyWebCodecs', used: 'muxjs', fallback: true },
                urls: [{
                    role: 'segment',
                    url: 'https://hugh.cdn.rumble.cloud/signed-supersecretsegment123456789/video.mp4?signature=signature-secret-value&quality=1080#private-fragment',
                }],
                cookie: 'cookie-secret-value',
                accessToken: 'access-token-secret-value',
                note: 'opaque eyJhbGciOiJIUzI1NiJ9.cHJpdmF0ZS1wYXlsb2Fk.c2lnbmF0dXJlLXZhbHVl token',
                capabilities: { contentWorker: true, webCodecs: false },
            },
        });
        const fetched = await chrome.runtime.sendMessage({ action: 'getDownloadDiagnostics' });
        return { recorded, fetched };
    });

    expect(result.recorded.ok).toBe(true);
    expect(result.fetched.ok).toBe(true);
    expect(result.fetched.bundle.count).toBe(1);
    const [attempt] = result.fetched.bundle.attempts;
    expect(attempt.operation).toBe('clip-export');
    expect(attempt.stage).toBe('segment-download');
    expect(attempt.quality).toMatchObject({ label: '1080p', height: 1080, format: 'mp4' });
    expect(attempt.muxer).toMatchObject({ requested: 'mediabunnyWebCodecs', used: 'muxjs', fallback: true });
    expect(attempt.capabilities).toMatchObject({
        contentWorker: true,
        webCodecs: false,
        downloadsApi: true,
        offscreenApi: true,
    });
    expect(result.fetched.bundle.capabilities.offscreenRuntime).toMatchObject({ ok: true, worker: true });

    const serialized = JSON.stringify(result.fetched.bundle);
    for (const secret of [
        'supersecretsegment',
        'query-secret-value',
        'signature-secret-value',
        'private-fragment',
        'bearer-secret-value',
        'cookie-secret-value',
        'access-token-secret-value',
        'cHJpdmF0ZS1wYXlsb2Fk',
    ]) {
        expect(serialized).not.toContain(secret);
    }

    await page.locator('#privacy-section summary').click();
    await expect(page.locator('#download-diagnostics-copy-btn')).toBeVisible();
    await expect(page.locator('#download-diagnostics-export-btn')).toBeVisible();
    await expect(page.locator('#download-diagnostics-clear-btn')).toBeVisible();

    await page.locator('#download-diagnostics-copy-btn').click();
    await expect(page.locator('#status')).toContainText('Sanitized diagnostics copied');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#download-diagnostics-export-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^rumblex-download-diagnostics-.+\.json$/);
    await expect(page.locator('#status')).toContainText('Sanitized diagnostics exported');

    await page.locator('#download-diagnostics-clear-btn').click();
    await expect(page.locator('#status')).toContainText('Download diagnostics cleared');
    const cleared = await page.evaluate(() => chrome.runtime.sendMessage({ action: 'getDownloadDiagnostics' }));
    expect(cleared.bundle.count).toBe(0);
});

test('failed watch-page discovery exposes copy and export diagnostics beside the error', async ({ context }) => {
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const request = route.request();
        if (request.isNavigationRequest() && request.url().startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        if (request.url().includes('/embedJS/')) {
            return route.fulfill({ status: 403, contentType: 'application/json', body: '{}' });
        }
        return route.abort();
    });

    await page.goto('https://rumble.com/vdiagnostic-fixture.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-download-btn', { state: 'attached', timeout: 15_000 });
    await page.evaluate(() => document.querySelector('#rx-download-btn')?.click());

    const actions = page.locator('.rx-diagnostic-actions');
    await expect(actions).toBeVisible({ timeout: 10_000 });
    await expect(actions.locator('button')).toHaveText([
        'Copy download diagnostics',
        'Export download diagnostics',
    ]);
    await expect(actions.locator('[role="status"]')).toBeAttached();

    const accessibility = await new AxeBuilder({ page })
        .include('.rx-diagnostic-actions')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
    expect(accessibility.violations).toEqual([]);
});
