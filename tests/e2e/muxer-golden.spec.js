// @ts-check
// Golden MPEG-TS parity coverage for mux.js, Mediabunny, and WebCodecs fallback.
// Fixture source: ffmpeg testsrc2 160x90@10fps + 440Hz mono AAC, one second.
const { test, expect } = require('./_fixtures');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const GOLDEN_PATH = path.join(__dirname, '..', 'fixtures', 'mux-golden.ts');
const GOLDEN_BYTES = fs.readFileSync(GOLDEN_PATH);
const GOLDEN_SHA256 = 'fa71748692f843d52a9f21c3336b57983c8015f0b375a5fbb11009c598ef6bd2';
const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'platform', 'offline-watch.html'), 'utf8');

test.setTimeout(120_000);

async function openRumbleFixture(context) {
    await context.route('https://rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: OFFLINE_RUMBLE_FIXTURE,
    }));
    const page = await context.newPage();
    await page.goto('https://rumble.com/vmux-golden.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });
    return page;
}

async function findTabId(serviceWorker, url) {
    return serviceWorker.evaluate(async (targetUrl) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find((entry) => entry.url === targetUrl);
        if (!tab?.id) throw new Error('Rumble fixture tab not found');
        return tab.id;
    }, url);
}

async function runProductionMux(serviceWorker, tabId, mode, forceNoWebCodecs = false) {
    const fixture = Array.from(GOLDEN_BYTES);
    return serviceWorker.evaluate(async ({ targetTabId, bytes, requestedMode, disableWebCodecs }) => {
        const executions = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            world: 'ISOLATED',
            func: async (fixtureBytes, muxerMode, forceUnsupported) => {
                if (typeof VideoDownloader === 'undefined' || typeof Settings === 'undefined') {
                    throw new Error('RumbleX muxer globals unavailable in the content world');
                }
                const originalGet = Settings.get;
                const originalSupports = VideoDownloader._supportsMediabunnyWorker;
                const originalVideoDecoder = Object.getOwnPropertyDescriptor(globalThis, 'VideoDecoder');
                let videoDecoderOverridden = false;
                Settings.get = function (key) {
                    if (key === 'downloadMuxerEngine') return muxerMode;
                    return originalGet.call(this, key);
                };
                if (forceUnsupported) {
                    try {
                        Object.defineProperty(globalThis, 'VideoDecoder', {
                            configurable: true,
                            writable: true,
                            value: undefined,
                        });
                        videoDecoderOverridden = true;
                    } catch {
                        VideoDownloader._supportsMediabunnyWorker = () => false;
                    }
                }
                try {
                    const input = Uint8Array.from(fixtureBytes).buffer;
                    const blob = await VideoDownloader._transmuxWithWorker([input]);
                    const objectUrl = URL.createObjectURL(blob);
                    let playback;
                    try {
                        playback = await new Promise((resolve, reject) => {
                            const video = document.createElement('video');
                            const timer = setTimeout(() => reject(new Error('MP4 metadata timeout')), 15_000);
                            video.preload = 'metadata';
                            video.muted = true;
                            video.onloadedmetadata = () => {
                                clearTimeout(timer);
                                resolve({
                                    duration: video.duration,
                                    width: video.videoWidth,
                                    height: video.videoHeight,
                                });
                            };
                            video.onerror = () => {
                                clearTimeout(timer);
                                reject(new Error('MP4 playback metadata error ' + (video.error?.code || 'unknown')));
                            };
                            video.src = objectUrl;
                            video.load();
                        });
                    } finally {
                        URL.revokeObjectURL(objectUrl);
                    }
                    const outputBytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
                    return {
                        bytes: outputBytes,
                        type: blob.type,
                        size: blob.size,
                        playback,
                        webCodecs: typeof VideoDecoder === 'function',
                        muxerContext: { ...VideoDownloader._lastMuxerContext },
                    };
                } finally {
                    Settings.get = originalGet;
                    VideoDownloader._supportsMediabunnyWorker = originalSupports;
                    if (videoDecoderOverridden) {
                        if (originalVideoDecoder) Object.defineProperty(globalThis, 'VideoDecoder', originalVideoDecoder);
                        else delete globalThis.VideoDecoder;
                    }
                }
            },
            args: [bytes, requestedMode, disableWebCodecs],
        });
        if (!executions[0]?.result) throw new Error('Muxer execution returned no result');
        return executions[0].result;
    }, { targetTabId: tabId, bytes: fixture, requestedMode: mode, disableWebCodecs: forceNoWebCodecs });
}

async function runStreamingMux(serviceWorker, tabId, abortAfterFirstSegment = false, multiRendition = false) {
    const fixture = Array.from(GOLDEN_BYTES);
    return serviceWorker.evaluate(async ({ targetTabId, bytes, shouldAbort, multiVariant }) => {
        const executions = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            world: 'ISOLATED',
            func: async (fixtureBytes, abortAfterFirst, useMultiVariant) => {
                if (typeof VideoDownloader === 'undefined') {
                    throw new Error('RumbleX muxer globals unavailable in the content world');
                }
                const originalFetch = globalThis.fetch;
                const originalHls = VideoDownloader._hlsUrl;
                const originalChunkBytes = VideoDownloader._MP4_STREAM_CHUNK_BYTES;
                const controller = new AbortController();
                const source = Uint8Array.from(fixtureBytes);
                const cutA = Math.floor(source.byteLength / (188 * 3)) * 188;
                const cutB = Math.floor((source.byteLength * 2) / (188 * 3)) * 188;
                const segmentBytes = [
                    source.slice(0, cutA),
                    source.slice(cutA, cutB),
                    source.slice(cutB),
                ];
                // A single-variant master never exercises rendition choice.
                // The multi-variant form puts the requested 160x90 rendition
                // between a lower and a higher one, and points the other two at
                // playlists whose segments do not exist, so picking the wrong
                // variant produces a 404 rather than a quietly different file.
                const streamPlaylist = '#EXTM3U\n#EXTINF:0.34,\nhttps://cdn.1a-1791.com/a.ts'
                    + '\n#EXTINF:0.33,\nhttps://cdn.1a-1791.com/b.ts'
                    + '\n#EXTINF:0.33,\nhttps://cdn.1a-1791.com/c.ts';
                const master = useMultiVariant
                    ? '#EXTM3U'
                        + '\n#EXT-X-STREAM-INF:BANDWIDTH=120000,RESOLUTION=80x45\nhttps://rumble.com/low.m3u8'
                        + '\n#EXT-X-STREAM-INF:BANDWIDTH=250000,RESOLUTION=160x90\nhttps://rumble.com/stream.m3u8'
                        + '\n#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360\nhttps://rumble.com/high.m3u8'
                    : '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=250000,RESOLUTION=160x90\nhttps://rumble.com/stream.m3u8';
                const payloads = new Map([
                    ['https://rumble.com/master.m3u8', master],
                    ['https://rumble.com/stream.m3u8', streamPlaylist],
                    ['https://rumble.com/low.m3u8', '#EXTM3U\n#EXTINF:0.34,\nhttps://cdn.1a-1791.com/low-a.ts'],
                    ['https://rumble.com/high.m3u8', '#EXTM3U\n#EXTINF:0.34,\nhttps://cdn.1a-1791.com/high-a.ts'],
                ]);
                const fetchedUrls = [];
                const bytesByUrl = new Map([
                    ['https://cdn.1a-1791.com/a.ts', segmentBytes[0]],
                    ['https://cdn.1a-1791.com/b.ts', segmentBytes[1]],
                    ['https://cdn.1a-1791.com/c.ts', segmentBytes[2]],
                ]);
                const writes = [];
                const writable = {
                    async write(chunk) {
                        const data = new Uint8Array(chunk?.data || chunk || []);
                        writes.push({
                            position: Number(chunk?.position || 0),
                            bytes: Array.from(data),
                        });
                    },
                };
                globalThis.fetch = async (input) => {
                    const url = String(input instanceof Request ? input.url : input);
                    fetchedUrls.push(url);
                    if (payloads.has(url)) return new Response(payloads.get(url), { status: 200 });
                    if (bytesByUrl.has(url)) return new Response(bytesByUrl.get(url), { status: 200 });
                    // The extension loads its own packaged worker through fetch.
                    // Answering that with a 404 fails the conversion for a
                    // reason that has nothing to do with the playlist, which is
                    // only invisible when an earlier test already warmed the
                    // worker on the same page.
                    if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
                        return originalFetch(input);
                    }
                    return new Response('', { status: 404 });
                };
                try {
                    VideoDownloader._hlsUrl = 'https://rumble.com/master.m3u8';
                    VideoDownloader._MP4_STREAM_CHUNK_BYTES = 1024;
                    let summary = null;
                    let errorName = null;
                    let errorMessage = null;
                    try {
                        summary = await VideoDownloader._streamMediabunnyHlsToWritable(
                            { height: 90, label: '90p' },
                            writable,
                            {
                                signal: controller.signal,
                                onProgress: ({ completed }) => {
                                    if (abortAfterFirst && completed === 1) controller.abort();
                                },
                            },
                        );
                    } catch (error) {
                        errorName = error?.name || String(error);
                        errorMessage = String(error?.message || error);
                    }

                    const maxEnd = writes.reduce(
                        (max, entry) => Math.max(max, entry.position + entry.bytes.length),
                        0,
                    );
                    const output = new Uint8Array(maxEnd);
                    for (const entry of writes) output.set(entry.bytes, entry.position);
                    return {
                        bytes: Array.from(output),
                        summary,
                        errorName,
                        errorMessage,
                        positions: writes.map((entry) => entry.position),
                        writeCount: writes.length,
                        maxWriteSize: writes.reduce((max, entry) => Math.max(max, entry.bytes.length), 0),
                        workerCleared: VideoDownloader._mediabunnyWorker === null,
                        fetchedUrls,
                    };
                } finally {
                    globalThis.fetch = originalFetch;
                    VideoDownloader._hlsUrl = originalHls;
                    VideoDownloader._MP4_STREAM_CHUNK_BYTES = originalChunkBytes;
                }
            },
            args: [bytes, shouldAbort, multiVariant],
        });
        if (!executions[0]?.result) throw new Error('Streaming muxer execution returned no result');
        return executions[0].result;
    }, { targetTabId: tabId, bytes: fixture, shouldAbort: abortAfterFirstSegment, multiVariant: multiRendition });
}

async function inspectInOffscreen(context, extensionId, bytes) {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const started = await options.evaluate(() => chrome.runtime.sendMessage({
        action: 'parseHtmlOffscreen',
        html: '<title>Mux golden inspector</title>',
    }));
    expect(started).toMatchObject({ ok: true });
    const inspected = await options.evaluate((outputBytes) => chrome.runtime.sendMessage({
        target: 'offscreen',
        action: 'inspectMedia',
        bytes: outputBytes,
    }), bytes);
    await options.close();
    return inspected;
}

function expectPlayable(result) {
    expect(result.type).toBe('video/mp4');
    expect(result.size).toBeGreaterThan(1_000);
    expect(result.playback.width).toBe(160);
    expect(result.playback.height).toBe(90);
    expect(Number.isFinite(result.playback.duration)).toBe(true);
    expect(result.playback.duration).toBeGreaterThan(0.8);
    expect(result.playback.duration).toBeLessThan(1.3);
}

function expectGoldenMetadata(result) {
    expect(result.ok).toBe(true);
    expect(result.mimeType).toMatch(/^video\/mp4/);
    expect(result.duration).toBeGreaterThan(0.8);
    expect(result.duration).toBeLessThan(1.3);
    expect(result.video).toMatchObject({ codec: 'avc', width: 160, height: 90 });
    expect(result.audio).toMatchObject({ codec: 'aac', sampleRate: 48_000, channels: 1 });
}

test('mux.js and Mediabunny produce playable metadata parity from one golden TS sample', async ({ context, extensionId, serviceWorker }) => {
    expect(crypto.createHash('sha256').update(GOLDEN_BYTES).digest('hex')).toBe(GOLDEN_SHA256);
    const rumble = await openRumbleFixture(context);
    const tabId = await findTabId(serviceWorker, rumble.url());

    const muxjs = await runProductionMux(serviceWorker, tabId, 'muxjs');
    const mediabunny = await runProductionMux(serviceWorker, tabId, 'mediabunnyWebCodecs');
    expect(mediabunny.webCodecs).toBe(true);
    expect(muxjs.muxerContext).toMatchObject({ requested: 'muxjs', used: 'muxjs', fallback: false });
    expect(mediabunny.muxerContext).toMatchObject({
        requested: 'mediabunnyWebCodecs',
        used: 'mediabunnyWebCodecs',
        fallback: false,
    });
    expectPlayable(muxjs);
    expectPlayable(mediabunny);

    const muxjsMetadata = await inspectInOffscreen(context, extensionId, muxjs.bytes);
    const mediabunnyMetadata = await inspectInOffscreen(context, extensionId, mediabunny.bytes);
    expectGoldenMetadata(muxjsMetadata);
    expectGoldenMetadata(mediabunnyMetadata);
    expect(Math.abs(muxjsMetadata.duration - mediabunnyMetadata.duration)).toBeLessThan(0.08);
});

test('streaming Mediabunny preserves golden metadata, positioned writes, and cancellation', async ({ context, extensionId, serviceWorker }) => {
    const rumble = await openRumbleFixture(context);
    const tabId = await findTabId(serviceWorker, rumble.url());

    const buffered = await runProductionMux(serviceWorker, tabId, 'mediabunnyWebCodecs');
    const streamed = await runStreamingMux(serviceWorker, tabId);
    expect(streamed.errorName).toBeNull();
    expect(streamed.errorName).toBeNull();
    expect(streamed.summary).toMatchObject({
        segments: 3,
        engine: 'mediabunnyWebCodecs',
    });
    expect(streamed.writeCount).toBeGreaterThan(1);
    expect(streamed.maxWriteSize).toBeLessThanOrEqual(1024);
    expect(streamed.positions.every((position) => Number.isInteger(position) && position >= 0)).toBe(true);

    const bufferedMetadata = await inspectInOffscreen(context, extensionId, buffered.bytes);
    const streamedMetadata = await inspectInOffscreen(context, extensionId, streamed.bytes);
    expectGoldenMetadata(streamedMetadata);
    expect(Math.abs(bufferedMetadata.duration - streamedMetadata.duration)).toBeLessThan(0.08);
    expect(streamedMetadata.video).toEqual(bufferedMetadata.video);
    expect(streamedMetadata.audio).toEqual(bufferedMetadata.audio);

    const cancelled = await runStreamingMux(serviceWorker, tabId, true);
    expect(cancelled.errorName).toBe('AbortError');
    expect(cancelled.summary).toBeNull();
    expect(cancelled.workerCleared).toBe(true);
});

test('a stalled mux.js worker is terminated instead of hanging the download', async ({ context, serviceWorker }) => {
    const rumble = await openRumbleFixture(context);
    const tabId = await findTabId(serviceWorker, rumble.url());

    const outcome = await serviceWorker.evaluate(async (targetTabId) => {
        const executions = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            world: 'ISOLATED',
            func: async () => {
                if (typeof VideoDownloader === 'undefined') {
                    throw new Error('RumbleX muxer globals unavailable in the content world');
                }
                const originalGetWorker = VideoDownloader._getMuxWorker;
                const originalBound = VideoDownloader._workerTimeoutMs;
                const originalWorker = VideoDownloader._worker;
                let terminated = false;
                // A worker that acknowledges the post and then never answers is
                // exactly the mux.js infinite-loop shape (videojs/mux.js#447).
                const stalled = {
                    addEventListener() {},
                    removeEventListener() {},
                    postMessage() {},
                    terminate() { terminated = true; },
                };
                VideoDownloader._getMuxWorker = async () => stalled;
                VideoDownloader._workerTimeoutMs = () => 50;
                VideoDownloader._worker = stalled;
                try {
                    let message = null;
                    let diagnostic = null;
                    try {
                        await VideoDownloader._transmuxWithMuxWorker([new Uint8Array(8).buffer], null);
                    } catch (error) {
                        message = String(error?.message || error);
                        diagnostic = error?.rxWorkerDiagnostic || null;
                    }
                    return { message, diagnostic, terminated, clearedHandle: VideoDownloader._worker === null };
                } finally {
                    VideoDownloader._getMuxWorker = originalGetWorker;
                    VideoDownloader._workerTimeoutMs = originalBound;
                    VideoDownloader._worker = originalWorker;
                }
            },
        });
        return executions[0].result;
    }, tabId);

    expect(outcome.message).toContain('timed out');
    expect(outcome.diagnostic).toMatchObject({ engine: 'muxjs', stage: 'worker-timeout' });
    expect(outcome.terminated).toBe(true);
    expect(outcome.clearedHandle).toBe(true);
});

test('Mediabunny selection falls back to mux.js when WebCodecs is unavailable', async ({ context, extensionId, serviceWorker }) => {
    const rumble = await openRumbleFixture(context);
    const tabId = await findTabId(serviceWorker, rumble.url());
    const fallback = await runProductionMux(serviceWorker, tabId, 'mediabunnyWebCodecs', true);

    expect(fallback.webCodecs).toBe(false);
    expect(fallback.muxerContext).toMatchObject({
        requested: 'mediabunnyWebCodecs',
        used: 'muxjs',
        fallback: true,
    });
    expect(fallback.muxerContext.fallbackReason).toContain('WebCodecs');
    expectPlayable(fallback);
    expectGoldenMetadata(await inspectInOffscreen(context, extensionId, fallback.bytes));
});

test('a multi-rendition master resolves to the requested variant and still converts', async ({ context, extensionId, serviceWorker }) => {
    // Every master playlist in the suite had exactly one variant, so nothing
    // proved the extension picks a rendition rather than taking whatever came
    // first. Here the requested 160x90 sits between a lower and a higher
    // variant whose segments do not exist, so a wrong pick 404s instead of
    // quietly producing a different file.
    const rumble = await openRumbleFixture(context);
    const tabId = await findTabId(serviceWorker, rumble.url());

    const streamed = await runStreamingMux(serviceWorker, tabId, false, true);
    expect(streamed.errorMessage).toBeNull();
    expect(streamed.errorName).toBeNull();
    expect(streamed.summary).toBeTruthy();

    // Positive control: the master really did offer three variants.
    expect(streamed.fetchedUrls).toContain('https://rumble.com/master.m3u8');
    // The chosen variant's media playlist and every one of its segments.
    expect(streamed.fetchedUrls).toContain('https://rumble.com/stream.m3u8');
    for (const segment of ['a.ts', 'b.ts', 'c.ts']) {
        expect(streamed.fetchedUrls).toContain(`https://cdn.1a-1791.com/${segment}`);
    }
    // The other two were never followed.
    expect(streamed.fetchedUrls).not.toContain('https://rumble.com/low.m3u8');
    expect(streamed.fetchedUrls).not.toContain('https://rumble.com/high.m3u8');
    expect(streamed.fetchedUrls.filter((url) => url.includes('low-a.ts') || url.includes('high-a.ts'))).toEqual([]);

    // And the conversion of that variant still produces the golden output.
    const metadata = await inspectInOffscreen(context, extensionId, streamed.bytes);
    expectGoldenMetadata(metadata);
});
