// @ts-check
// Archive queue preflight, recovery, JSON round-trip, and folder persistence.
const { test, expect } = require('./_fixtures');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');

const MB = 1024 * 1024;

async function openArchivePanel(page) {
    const details = page.locator('#archive-queue-section details');
    if (!(await details.evaluate((element) => element.open))) {
        await page.locator('#archive-queue-section summary').click();
    }
    await expect(details).toHaveAttribute('open', '');
}

test('archive queue import/export normalizes active jobs and retries failures', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.evaluate(() => chrome.runtime.sendMessage({ action: 'archiveClearQueue' }));
    await openArchivePanel(page);

    const payload = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        paused: false,
        jobs: [
            {
                videoId: 'vactive123',
                videoUrl: 'https://rumble.com/vactive123-example.html',
                videoTitle: '<img src=x onerror=alert(1)> Active job',
                channelUrl: 'https://rumble.com/c/example',
                channelName: 'Example',
                status: 'downloading',
                qualityFound: '1080p',
                estimatedBytes: 10 * MB,
                secretField: 'must-not-round-trip',
            },
            {
                videoId: 'vfailed456',
                videoUrl: 'https://rumble.com/vfailed456-example.html',
                videoTitle: 'Failed job',
                status: 'failed',
                error: 'http-403',
                estimatedBytes: 20 * MB,
            },
            { videoId: 'not-valid', status: 'pending' },
            { videoId: 'vactive123', status: 'pending' },
        ],
    };
    await page.locator('#archive-import-file').setInputFiles({
        name: 'archive-queue.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(payload)),
    });

    await expect(page.locator('#status')).toContainText('Imported 2 archive jobs; skipped 2');
    await expect(page.locator('#archive-totals')).toContainText('Pending 1');
    await expect(page.locator('#archive-totals')).toContainText('Failed 1');
    await expect(page.locator('#archive-estimate-status')).toContainText('30.00 MB across 2/2');
    await expect(page.locator('#archive-list')).toContainText('<img src=x onerror=alert(1)> Active job');
    expect(await page.locator('#archive-list img').count()).toBe(0);

    let queue = await page.evaluate(() => chrome.runtime.sendMessage({ action: 'archiveGetQueue' }));
    expect(queue.queue.paused).toBe(true);
    expect(queue.queue.jobs).toHaveLength(2);
    const recovered = queue.queue.jobs.find((job) => job.videoId === 'vactive123');
    expect(recovered).toMatchObject({ status: 'pending', recoveredFromStatus: 'downloading' });
    expect(recovered.secretField).toBeUndefined();

    await page.evaluate(async () => {
        const stored = await chrome.storage.local.get('rx_archive_queue');
        const failed = stored.rx_archive_queue.jobs.find((job) => job.videoId === 'vfailed456');
        Object.assign(failed, {
            startedAt: Date.now(),
            downloadId: 42,
            downloadedBytes: 1234,
            destination: 'selected-folder',
            destinationName: 'Old folder',
            folderFallbackReason: 'folder-write-failed',
        });
        await chrome.storage.local.set(stored);
    });

    await page.locator('#archive-retry-failed-btn').click();
    await expect(page.locator('#status')).toContainText('Queued 1 failed job for retry');
    queue = await page.evaluate(() => chrome.runtime.sendMessage({ action: 'archiveGetQueue' }));
    expect(queue.queue.jobs.every((job) => job.status === 'pending')).toBe(true);
    expect(queue.queue.jobs.find((job) => job.videoId === 'vfailed456')).toMatchObject({
        retryCount: 1,
        startedAt: null,
        downloadId: null,
        downloadedBytes: null,
        destination: null,
        destinationName: null,
        folderFallbackReason: null,
    });

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#archive-export-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^rumblex-archive-queue-.+\.json$/);
    const exportedPath = await download.path();
    const exported = JSON.parse(fs.readFileSync(exportedPath, 'utf8'));
    expect(exported.schemaVersion).toBe(1);
    expect(exported.jobs).toHaveLength(2);
    expect(JSON.stringify(exported)).not.toContain('must-not-round-trip');

    const accessibility = await new AxeBuilder({ page })
        .include('#archive-queue-section')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
    expect(accessibility.violations).toEqual([]);
});

test('archive preflight pauses the queue and records quality and known sizes', async ({ context, extensionId, serviceWorker }) => {
    await serviceWorker.evaluate(() => {
        globalThis.fetch = async (input) => {
            const url = new URL(String(input));
            if (!url.pathname.includes('/embedJS/')) throw new Error('unexpected fetch: ' + url.href);
            const id = url.searchParams.get('v') || 'unknown';
            const size = id.includes('large') ? 24 * 1024 * 1024 : 8 * 1024 * 1024;
            return new Response(JSON.stringify({
                title: 'Preflight ' + id,
                ua: {
                    mp4: {
                        high: {
                            url: `https://hugh.cdn.rumble.cloud/video/redacted/${id}.mp4`,
                            meta: { h: 1080, w: 1920, size },
                        },
                    },
                },
            }), { status: 200, headers: { 'content-type': 'application/json' } });
        };
    });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await page.evaluate(async () => {
        await chrome.runtime.sendMessage({ action: 'archiveClearQueue' });
        return chrome.runtime.sendMessage({
            action: 'archiveImportQueue',
            payload: {
                schemaVersion: 1,
                jobs: [
                    { videoId: 'vsmall001', videoUrl: 'https://rumble.com/vsmall001.html', status: 'pending' },
                    { videoId: 'vlarge002', videoUrl: 'https://rumble.com/vlarge002.html', status: 'pending' },
                ],
            },
        });
    });
    await openArchivePanel(page);
    await page.locator('#archive-preflight-btn').click();

    await expect(page.locator('#status')).toContainText('Preflight checked 2 jobs with 0 probe failures');
    await expect(page.locator('#archive-estimate-status')).toContainText('32.00 MB across 2/2');
    await expect(page.locator('#archive-pause-btn')).toHaveText('Resume queue');
    const response = await page.evaluate(() => chrome.runtime.sendMessage({ action: 'archiveGetQueue' }));
    expect(response.queue.paused).toBe(true);
    expect(response.queue.jobs.map((job) => job.qualityFound)).toEqual(['1080p', '1080p']);
    expect(response.queue.jobs.reduce((sum, job) => sum + job.estimatedBytes, 0)).toBe(32 * MB);
});

test('archive folder handle persists and writes through the shared helper', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const result = await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        await RxArchiveFsAccess.putHandle(RxArchiveFsAccess.ARCHIVE_FOLDER_KEY, root);
        const written = await RxArchiveFsAccess.writeSource(root, 'RumbleX/preflight-sample.txt', new Blob(['archive-ok']));
        const folder = await root.getDirectoryHandle('RumbleX');
        const fileHandle = await folder.getFileHandle(written.filename.split('/').pop());
        const text = await (await fileHandle.getFile()).text();
        return { written, text, state: await RxArchiveFsAccess.getState() };
    });

    expect(result.written).toMatchObject({ ok: true, bytesWritten: 10 });
    expect(result.text).toBe('archive-ok');
    expect(result.state).toMatchObject({ selected: true, permission: 'granted' });

    await page.reload();
    await openArchivePanel(page);
    await expect(page.locator('#archive-folder-status')).toContainText('write access granted');
    await expect(page.locator('#archive-folder-clear-btn')).toBeVisible();
});
