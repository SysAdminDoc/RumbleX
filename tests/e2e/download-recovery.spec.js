// @ts-check
// Network-aware pause/resume coverage for RumbleX-owned browser downloads.
const { test, expect } = require('./_fixtures');

test('worker offline/online events pause managed transfers and release archive jobs', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            rx_settings: {
                downloadManagerEnabled: true,
                archiveQueuePauseOnOffline: true,
            },
            rx_download_recovery: { version: 1, networkStatus: 'online', jobs: [] },
            rx_archive_queue: {
                version: 1,
                paused: true,
                jobs: [
                    { id: 'archive-browser', videoId: 'vbrowser', status: 'downloading', downloadId: 101 },
                    { id: 'archive-discovery', videoId: 'vdiscovery', status: 'discovering', downloadId: null },
                ],
            },
        });

        const originals = {
            search: rxDownloadsApi.search,
            pause: rxDownloadsApi.pause,
            resume: rxDownloadsApi.resume,
        };
        const items = new Map([
            [101, { id: 101, state: 'in_progress', paused: false, canResume: true, bytesReceived: 4096 }],
            // Already paused before the offline event: recovery must not claim
            // or auto-resume a user-paused transfer.
            [102, { id: 102, state: 'in_progress', paused: true, canResume: true, bytesReceived: 2048 }],
        ]);
        const calls = { pause: [], resume: [] };
        rxDownloadsApi.search = async ({ id }) => items.has(id) ? [{ ...items.get(id) }] : [];
        rxDownloadsApi.pause = async (id) => {
            calls.pause.push(id);
            items.get(id).paused = true;
            items.get(id).canResume = true;
        };
        rxDownloadsApi.resume = async (id) => {
            calls.resume.push(id);
            items.get(id).paused = false;
            items.get(id).state = 'in_progress';
        };

        try {
            await rxTrackManagedDownload(101, { operation: 'archive-download', archiveJobId: 'archive-browser' });
            await rxTrackManagedDownload(102, { operation: 'direct-download' });

            self.dispatchEvent(new Event('offline'));
            let offlineRecovery;
            let offlineArchive;
            for (let attempt = 0; attempt < 100; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, 10));
                offlineRecovery = await rxLoadDownloadRecovery();
                offlineArchive = await rxLoadArchiveQueue();
                const browserJob = offlineArchive.jobs.find((job) => job.id === 'archive-browser');
                const discoveryJob = offlineArchive.jobs.find((job) => job.id === 'archive-discovery');
                if (calls.pause.length > 0
                    && offlineRecovery.networkStatus === 'offline'
                    && browserJob?.networkState === 'waiting-online'
                    && discoveryJob?.networkState === 'waiting-online') break;
            }

            self.dispatchEvent(new Event('online'));
            let onlineRecovery;
            let onlineArchive;
            for (let attempt = 0; attempt < 100; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, 10));
                onlineRecovery = await rxLoadDownloadRecovery();
                onlineArchive = await rxLoadArchiveQueue();
                if (calls.resume.length > 0
                    && onlineRecovery.networkStatus === 'online'
                    && onlineArchive.jobs.every((job) => job.networkResumePending === false)) break;
            }

            return { calls, offlineRecovery, offlineArchive, onlineRecovery, onlineArchive };
        } finally {
            Object.assign(rxDownloadsApi, originals);
            await chrome.storage.local.remove(['rx_download_recovery', 'rx_archive_queue']);
        }
    });

    expect(result.calls.pause).toEqual([101]);
    expect(result.calls.resume).toEqual([101]);
    expect(result.offlineRecovery.networkStatus).toBe('offline');
    expect(result.offlineRecovery.jobs.find((job) => job.downloadId === 101)).toMatchObject({
        status: 'paused-offline',
        resumePending: true,
        bytesReceived: 4096,
    });
    expect(result.offlineRecovery.jobs.find((job) => job.downloadId === 102)).toMatchObject({
        status: 'active',
        resumePending: false,
    });
    expect(result.offlineArchive.jobs.find((job) => job.id === 'archive-browser')).toMatchObject({
        status: 'downloading',
        networkState: 'waiting-online',
        networkResumePending: true,
    });
    expect(result.offlineArchive.jobs.find((job) => job.id === 'archive-discovery')).toMatchObject({
        status: 'pending',
        networkState: 'waiting-online',
        networkResumePending: true,
    });
    expect(result.onlineRecovery.networkStatus).toBe('online');
    expect(result.onlineRecovery.jobs.find((job) => job.downloadId === 101)).toMatchObject({
        status: 'active',
        resumePending: false,
        resumeAttempts: 1,
    });
    expect(result.onlineArchive.jobs.every((job) => job.networkResumePending === false)).toBe(true);
});

test('rapid reconnection invalidates stale archive discovery before dispatch', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            rx_settings: { downloadManagerEnabled: true, archiveQueuePauseOnOffline: true },
            rx_download_recovery: { version: 1, networkStatus: 'online', jobs: [] },
            rx_archive_queue: {
                version: 1,
                paused: false,
                jobs: [{
                    id: 'rapid-reconnect',
                    videoId: 'vrapid',
                    status: 'discovering',
                    startedAt: Date.now(),
                    downloadId: null,
                }],
            },
        });

        const originalDiscover = rxDiscoverVideoQuality;
        const originalStart = rxStartManagedDownload;
        let releaseDiscovery = null;
        let dispatches = 0;
        rxDiscoverVideoQuality = () => new Promise((resolve) => { releaseDiscovery = resolve; });
        rxStartManagedDownload = async () => {
            dispatches++;
            return 999;
        };

        try {
            const processing = rxProcessArchiveJob('rapid-reconnect');
            for (let attempt = 0; attempt < 100 && !releaseDiscovery; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            if (!releaseDiscovery) throw new Error('discovery did not start');
            await rxHandleNetworkOffline();
            await rxHandleNetworkOnline({ runArchive: false });
            releaseDiscovery({
                url: 'https://rumble.com/video.mp4',
                quality: '720p',
                height: 720,
                title: 'Rapid reconnect',
                estimatedBytes: 1234,
            });
            await processing;
            return {
                dispatches,
                queue: await rxLoadArchiveQueue(),
            };
        } finally {
            rxDiscoverVideoQuality = originalDiscover;
            rxStartManagedDownload = originalStart;
            await chrome.storage.local.remove(['rx_download_recovery', 'rx_archive_queue']);
        }
    });

    expect(result.dispatches).toBe(0);
    expect(result.queue.jobs[0]).toMatchObject({
        status: 'pending',
        downloadId: null,
        networkResumePending: false,
    });
});

test('network interruptions queue resume or full archive restart before marking failure', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            rx_settings: { downloadManagerEnabled: true, archiveQueuePauseOnOffline: true },
            rx_download_recovery: { version: 1, networkStatus: 'online', jobs: [] },
            rx_archive_queue: {
                version: 1,
                paused: true,
                jobs: [
                    { id: 'resumable', videoId: 'vresumable', status: 'downloading', downloadId: 201 },
                    { id: 'restart', videoId: 'vrestart', status: 'downloading', downloadId: 202 },
                ],
            },
        });

        const originals = { search: rxDownloadsApi.search, resume: rxDownloadsApi.resume };
        const items = new Map([
            [201, { id: 201, state: 'interrupted', paused: false, canResume: true, error: 'NETWORK_DISCONNECTED', bytesReceived: 8192 }],
            [202, { id: 202, state: 'interrupted', paused: false, canResume: false, error: 'NETWORK_DISCONNECTED', bytesReceived: 1024 }],
            [203, { id: 203, state: 'interrupted', paused: false, canResume: false, error: 'NETWORK_DISCONNECTED', bytesReceived: 512 }],
        ]);
        const resumed = [];
        rxDownloadsApi.search = async ({ id }) => items.has(id) ? [{ ...items.get(id) }] : [];
        rxDownloadsApi.resume = async (id) => {
            resumed.push(id);
            Object.assign(items.get(id), { state: 'in_progress', paused: false, canResume: true, error: null });
        };

        try {
            await rxTrackManagedDownload(201, { operation: 'archive-download', archiveJobId: 'resumable' });
            await rxTrackManagedDownload(202, { operation: 'archive-download', archiveJobId: 'restart' });
            await rxTrackManagedDownload(203, { operation: 'direct-download' });
            await rxUpdateManagedDownload(203, {
                resumePending: true,
                status: 'interrupted-offline',
                lastError: 'NETWORK_DISCONNECTED',
            });
            const resumable = await rxHandleManagedDownloadChanged({
                id: 201,
                state: { current: 'interrupted' },
                error: { current: 'NETWORK_DISCONNECTED' },
            });
            const restart = await rxHandleManagedDownloadChanged({
                id: 202,
                state: { current: 'interrupted' },
                error: { current: 'NETWORK_DISCONNECTED' },
            });
            const queuedRecovery = await rxLoadDownloadRecovery();
            const queuedArchive = await rxLoadArchiveQueue();

            await rxHandleNetworkOnline({ runArchive: false });
            const resumedRecovery = await rxLoadDownloadRecovery();

            Object.assign(items.get(201), { state: 'complete', fileSize: 12345, totalBytes: 12345 });
            const complete = await rxHandleManagedDownloadChanged({ id: 201, state: { current: 'complete' } });
            const completedArchive = await rxLoadArchiveQueue();
            const finalRecovery = await rxLoadDownloadRecovery();
            return {
                resumable,
                restart,
                complete,
                resumed,
                queuedRecovery,
                queuedArchive,
                resumedRecovery,
                completedArchive,
                finalRecovery,
            };
        } finally {
            Object.assign(rxDownloadsApi, originals);
            await chrome.storage.local.remove(['rx_download_recovery', 'rx_archive_queue', 'rx_download_diagnostics']);
        }
    });

    expect(result.resumable).toMatchObject({ queued: true, resumable: true });
    expect(result.restart).toMatchObject({ queued: true, resumable: false });
    expect(result.queuedRecovery.jobs.map((job) => job.downloadId)).toEqual([201, 203]);
    expect(result.queuedArchive.jobs.find((job) => job.id === 'resumable')).toMatchObject({
        status: 'downloading',
        networkResumePending: true,
    });
    expect(result.queuedArchive.jobs.find((job) => job.id === 'restart')).toMatchObject({
        status: 'pending',
        downloadId: null,
        networkResumePending: true,
    });
    expect(result.resumed).toEqual([201]);
    expect(result.resumedRecovery.jobs).toHaveLength(1);
    expect(result.resumedRecovery.jobs[0]).toMatchObject({ downloadId: 201, resumePending: false });
    expect(result.complete).toMatchObject({ handled: true, completed: true });
    expect(result.completedArchive.jobs.find((job) => job.id === 'resumable')).toMatchObject({
        status: 'completed',
        downloadedBytes: 12345,
    });
    expect(result.finalRecovery.jobs).toEqual([]);
});

test('downloadManagerEnabled disables tracking and offline pause calls', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
        await chrome.storage.local.set({
            rx_settings: { downloadManagerEnabled: false, archiveQueuePauseOnOffline: true },
            rx_download_recovery: { version: 1, networkStatus: 'online', jobs: [] },
        });
        const originals = { download: rxDownloadsApi.download, search: rxDownloadsApi.search, pause: rxDownloadsApi.pause };
        const pauses = [];
        rxDownloadsApi.download = async () => 301;
        rxDownloadsApi.search = async () => [{ id: 301, state: 'in_progress', paused: false, canResume: true }];
        rxDownloadsApi.pause = async (id) => { pauses.push(id); };
        try {
            const downloadId = await rxStartManagedDownload({ url: 'https://rumble.com/video.mp4' }, { operation: 'direct-download' });
            const offline = await rxHandleNetworkOffline();
            return {
                downloadId,
                offline,
                pauses,
                recovery: await rxLoadDownloadRecovery(),
            };
        } finally {
            Object.assign(rxDownloadsApi, originals);
            await chrome.storage.local.remove('rx_download_recovery');
        }
    });

    expect(result.downloadId).toBe(301);
    expect(result.offline).toMatchObject({ enabled: false, paused: 0, queued: 0 });
    expect(result.pauses).toEqual([]);
    expect(result.recovery.jobs).toEqual([]);
});

test('offscreen selected-folder writes wait while recovery is paused', async ({ context, extensionId }) => {
    const mediaUrl = `chrome-extension://${extensionId}/icons/16.png`;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const expectedBytes = await page.evaluate(async (url) => {
        const root = await navigator.storage.getDirectory();
        await RxArchiveFsAccess.putHandle(RxArchiveFsAccess.ARCHIVE_FOLDER_KEY, root);
        const started = await chrome.runtime.sendMessage({ action: 'parseHtmlOffscreen', html: '<title>recovery</title>' });
        if (!started?.ok) throw new Error('offscreen document did not start');
        return (await fetch(url)).arrayBuffer().then((buffer) => buffer.byteLength);
    }, mediaUrl);

    const paused = await page.evaluate(() => chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'pauseArchiveWrites',
    }));
    const waitingWrite = await page.evaluate((url) => chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'writeArchiveFile',
        operationId: 'paused-write',
        url,
        filename: 'RumbleX/recovery-paused.png',
    }), mediaUrl);
    const resumed = await page.evaluate(() => chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'resumeArchiveWrites',
    }));
    const completedWrite = await page.evaluate((url) => chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'writeArchiveFile',
        operationId: 'resumed-write',
        url,
        filename: 'RumbleX/recovery-resumed.png',
    }), mediaUrl);

    expect(paused).toMatchObject({ ok: true, paused: true });
    expect(waitingWrite).toMatchObject({ ok: false, reason: 'offline-paused' });
    expect(resumed).toMatchObject({ ok: true, paused: false });
    expect(completedWrite.ok, JSON.stringify(completedWrite)).toBe(true);
    expect(completedWrite.bytesWritten).toBe(expectedBytes);
});

test('options archive summary exposes queued offline recovery', async ({ context, extensionId, serviceWorker }) => {
    await serviceWorker.evaluate(async () => {
        self.__rxRecoveryUiApis = {
            search: rxDownloadsApi.search,
            pause: rxDownloadsApi.pause,
        };
        rxDownloadsApi.search = async ({ id }) => id === 401
            ? [{ id: 401, state: 'in_progress', paused: false, canResume: true, bytesReceived: 4096 }]
            : [];
        rxDownloadsApi.pause = async () => {};
        await chrome.storage.local.set({
            rx_settings: { downloadManagerEnabled: true, archiveQueuePauseOnOffline: true },
            rx_download_recovery: { version: 1, networkStatus: 'online', jobs: [] },
            rx_archive_queue: { version: 1, paused: false, jobs: [] },
        });
        await rxTrackManagedDownload(401, { operation: 'direct-download' });
        await rxHandleNetworkOffline();
    });
    const page = await context.newPage();
    try {
        await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
        const details = page.locator('#archive-queue-section details');
        if (!(await details.evaluate((element) => element.open))) {
            await page.locator('#archive-queue-section summary').click();
        }

        await expect(page.locator('#archive-queue-summary')).toHaveText(
            'Offline · 1 browser download queued to resume. Queue empty.',
        );
    } finally {
        await serviceWorker.evaluate(async () => {
            if (self.__rxRecoveryUiApis) Object.assign(rxDownloadsApi, self.__rxRecoveryUiApis);
            delete self.__rxRecoveryUiApis;
            await chrome.storage.local.remove(['rx_download_recovery', 'rx_archive_queue']);
        });
    }
});
