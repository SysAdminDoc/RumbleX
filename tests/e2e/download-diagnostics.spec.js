// @ts-check
// Downloader diagnostic persistence, redaction, and options-page affordances.
const { test, expect } = require('./_fixtures');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');

const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'platform', 'offline-watch.html'), 'utf8');

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

    await page.evaluate(() => {
        globalThis.__rxCopiedDiagnosticText = '';
        Object.defineProperty(navigator.clipboard, 'writeText', {
            configurable: true,
            value: async (text) => { globalThis.__rxCopiedDiagnosticText = String(text); },
        });
    });
    await page.locator('#download-diagnostics-copy-btn').click();
    await expect(page.locator('#status')).toContainText('Sanitized diagnostics copied');
    const copied = await page.evaluate(() => globalThis.__rxCopiedDiagnosticText);
    const copiedBundle = JSON.parse(copied);
    expect(copiedBundle.count).toBe(1);
    expect(copiedBundle.attempts[0]).toMatchObject({
        operation: 'clip-export',
        stage: 'segment-download',
    });
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
        expect(copied).not.toContain(secret);
    }

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

test('probes survive a content-script CORS refusal by going through the service worker', async ({ context, serviceWorker }) => {
    // Chrome treats a content-script fetch as cross-origin even where the
    // extension holds the host permission, so every probe used to live or die
    // by the CDN's own CORS headers. Make the page-origin path fail the way a
    // CORS refusal does; the worker path must still answer.
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const request = route.request();
        if (request.isNavigationRequest() && request.url().startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.goto('https://rumble.com/vprobe-transport.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-download-btn', { state: 'attached', timeout: 15_000 });

    const tabId = await serviceWorker.evaluate(async (url) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, page.url());

    const result = await serviceWorker.evaluate(async (target) => {
        // Stub the worker's own fetch so the probe never leaves the machine. A
        // real CDN request would make this test depend on the network and on
        // Rumble's edge, which is the thing the whole item is about.
        const workerFetch = globalThis.fetch;
        const seen = [];
        globalThis.fetch = async (input, init) => {
            seen.push({ url: String(input), method: init?.method || 'GET' });
            return new Response(null, { status: 200, headers: { 'content-length': '4194304' } });
        };
        try {
            const executions = await chrome.scripting.executeScript({
                target: { tabId: target },
                world: 'ISOLATED',
                func: async () => {
                    const probeUrl = 'https://1a-1791.com/video/fx/probe-transport.mp4';
                    const originalFetch = globalThis.fetch;
                    // Exactly what a CORS refusal looks like from a content
                    // script: the request goes out, the response is unreadable.
                    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
                    try {
                        // The path a userscript takes: page origin, no worker.
                        // RXPlatform is frozen, so exercise it directly rather
                        // than trying to flip the capability flag.
                        VideoDownloader._scanId = null;
                        VideoDownloader._probeStats = null;
                        const direct = await VideoDownloader._probeUrlDirect(probeUrl, undefined);

                        // The path this build takes, with the page origin still
                        // refusing. capabilities.proxiedMediaProbe is genuinely
                        // true here; nothing is stubbed to make it so.
                        VideoDownloader._scanId = null;
                        VideoDownloader._probeStats = null;
                        // _probeUrl is the entry point the scan actually calls,
                        // so this exercises the cache and the tally as well.
                        const proxied = await VideoDownloader._probeUrl(probeUrl);
                        return {
                            direct,
                            proxied,
                            proxyCapability: RXPlatform.capabilities.proxiedMediaProbe,
                            stats: VideoDownloader.probeDiagnostics(),
                        };
                    } finally {
                        globalThis.fetch = originalFetch;
                        VideoDownloader._scanId = null;
                        VideoDownloader._probeStats = null;
                    }
                },
            });
            return { ...executions[0]?.result, seen };
        } finally {
            globalThis.fetch = workerFetch;
        }
    }, tabId);

    // The userscript path names the refusal instead of reporting the file
    // missing, which is the difference between "no such quality" and "this CDN
    // stopped letting the page read it".
    expect(result.direct).toMatchObject({ ok: false, reason: 'cors', via: 'direct' });

    // The extension path reaches the CDN through the worker, which does hold
    // the host permission, and comes back with a real size.
    expect(result.proxied).toMatchObject({ ok: true, via: 'background', size: 4194304 });
    expect(result.seen.map((entry) => entry.method)).toEqual(['HEAD']);
    expect(result.seen[0].url).toBe('https://1a-1791.com/video/fx/probe-transport.mp4');

    // And the tally says which transport answered, without carrying any URL.
    expect(result.proxyCapability).toBe(true);
    expect(result.stats).toMatchObject({ total: 1, ok: 1, proxied: true });
    expect(result.stats.via).toEqual({ background: 1 });
});

test('the service-worker probe refuses off-allowlist hosts and caps a runaway scan', async ({ serviceWorker }) => {
    const result = await serviceWorker.evaluate(async () => {
        const workerFetch = globalThis.fetch;
        let networkCalls = 0;
        globalThis.fetch = async () => { networkCalls += 1; return new Response(null, { status: 404 }); };
        try {
            // Refused before any budget is spent, so a hostile page cannot
            // exhaust a scan's allowance with URLs that were never eligible.
            const offsite = await rxProbeMedia({ url: 'https://evil.example.com/a.mp4', scanId: 'allow-test' });
            const insecure = await rxProbeMedia({ url: 'http://1a-1791.com/a.mp4', scanId: 'allow-test' });
            const credentialed = await rxProbeMedia({ url: 'https://user:pass@1a-1791.com/a.mp4', scanId: 'allow-test' });
            const spentOnBlocked = networkCalls;

            // Spend the budget without touching the network, then prove the
            // next allowed URL is refused before it can make a request.
            for (let i = 0; i < RX_PROBE_SCAN_CAP; i += 1) rxCountProbe('cap-run');
            const callsBeforeCap = networkCalls;
            const capped = await rxProbeMedia({ url: 'https://1a-1791.com/video/fx/capped.mp4', scanId: 'cap-run' });
            const callsAfterCap = networkCalls;

            // A different scan starts with a fresh budget.
            const freshScan = await rxProbeMedia({ url: 'https://1a-1791.com/video/fx/fresh.mp4', scanId: 'cap-run-2' });
            return {
                offsite,
                insecure,
                credentialed,
                capped,
                freshScan,
                spentOnBlocked,
                cappedMadeNoRequest: callsAfterCap === callsBeforeCap,
                cap: RX_PROBE_SCAN_CAP,
            };
        } finally {
            globalThis.fetch = workerFetch;
        }
    });

    for (const refused of [result.offsite, result.insecure, result.credentialed]) {
        expect(refused).toMatchObject({ ok: false, reason: 'blocked' });
    }
    expect(result.spentOnBlocked).toBe(0);
    expect(result.capped).toMatchObject({ ok: false, reason: 'scan-cap' });
    expect(result.cappedMadeNoRequest).toBe(true);
    expect(result.freshScan.reason).toBe('http');
    expect(result.cap).toBe(250);
});

test('abandoning a scan cancels the probes already running in the service worker', async ({ context, serviceWorker }) => {
    // Two page loads plus a deliberate wait for the worker to start fetching;
    // the 30s default is not enough on a loaded machine.
    test.setTimeout(120_000);
    // Moving the fetch into the worker put it in a context the page's abort
    // controller cannot reach. Closing the download panel would stop this side
    // using the results while the worker kept fetching until each probe timed
    // out, which is exactly what the panel's abort existed to prevent.
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const request = route.request();
        if (request.isNavigationRequest() && request.url().startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.goto('https://rumble.com/vprobe-abort.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-download-btn', { state: 'attached', timeout: 15_000 });

    const tabId = await serviceWorker.evaluate(async (url) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, page.url());

    const result = await serviceWorker.evaluate(async (target) => {
        const workerFetch = globalThis.fetch;
        let aborted = false;
        let started = 0;
        // A probe that never settles on its own, so the only way it can finish
        // is the scan's abort reaching this context.
        globalThis.fetch = (input, init) => {
            started += 1;
            return new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    aborted = true;
                    const error = new Error('aborted');
                    error.name = 'AbortError';
                    reject(error);
                });
            });
        };
        try {
            const executions = await chrome.scripting.executeScript({
                target: { tabId: target },
                world: 'ISOLATED',
                func: async () => {
                    const probeUrl = 'https://1a-1791.com/video/fx/never-settles.mp4';
                    VideoDownloader._scanId = null;
                    VideoDownloader._probeStats = null;
                    VideoDownloader._scanController = new AbortController();
                    const scanId = VideoDownloader._probeScanId();
                    const inFlight = VideoDownloader._probeUrlNetwork(probeUrl);
                    // Give the message time to reach the worker and start the
                    // fetch, then abandon the scan the way closing the panel does.
                    await new Promise((resolve) => setTimeout(resolve, 250));
                    VideoDownloader._abortScan();
                    const settled = await Promise.race([
                        inFlight.then((value) => ({ settled: true, value })),
                        new Promise((resolve) => setTimeout(() => resolve({ settled: false }), 3000)),
                    ]);
                    return { scanId, settled };
                },
            });
            return { ...executions[0]?.result, aborted, started };
        } finally {
            globalThis.fetch = workerFetch;
        }
    }, tabId);

    // Positive control: the worker really did start a fetch, so the abort below
    // has something to cancel.
    expect(result.started).toBeGreaterThan(0);
    expect(result.scanId).toBeTruthy();

    // The worker's own fetch saw the abort, and the probe resolved rather than
    // hanging until its timeout.
    expect(result.aborted).toBe(true);
    expect(result.settled.settled).toBe(true);

    // The scan's budget and controller are gone from the worker, so a stale id
    // cannot keep consuming either.
    const cleared = await serviceWorker.evaluate((scanId) => ({
        counts: rxProbeScanCounts.has(scanId),
        aborts: rxProbeScanAborts.has(scanId),
        secondCancelIsNoop: rxCancelProbeScan(scanId),
    }), result.scanId);
    expect(cleared.counts).toBe(false);
    expect(cleared.aborts).toBe(false);
    expect(cleared.secondCancelIsNoop).toBe(false);
});

// Rumble names its own formats in the embed payload's `ua` map. Harvesting
// every group and then sorting the results out by byte count meant taking the
// seekbar preview strip only to reject it, and rejecting a genuine audio-only
// rendition for being small next to the video it belongs to.
const EMBED_PAYLOAD = {
    u: { tar: { url: 'https://1a-1791.com/video/fx/aaaaaaaaaa.tar' } },
    ua: {
        mp4: {
            360: { url: 'https://1a-1791.com/video/fx/bbbbbbbbbb.mp4', meta: { h: 360 } },
            1080: { url: 'https://1a-1791.com/video/fx/cccccccccc.mp4', meta: { h: 1080 } },
        },
        // Present on some videos and absent on others; roughly 21 MB for a
        // quarter-hour at 192 kbps, which is about one per cent of a 2 GB
        // 1080p rendition and therefore under the ladder ratio.
        audio: { 192: { url: 'https://1a-1791.com/video/fx/dddddddddd.mp4', meta: { h: 192 } } },
        // The seekbar preview strip. A real MP4 at a real /video/ path.
        timeline: { 0: { url: 'https://1a-1791.com/video/fx/eeeeeeeeee.mp4' } },
    },
};

test('the embed payload names each format, and the harvester keeps that name', async ({ context, serviceWorker }) => {
    test.setTimeout(120_000);
    const page = await context.newPage();
    await page.route('**/*', (route) => {
        const request = route.request();
        if (request.isNavigationRequest() && request.url().startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await page.goto('https://rumble.com/vua-kinds.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-download-btn', { state: 'attached', timeout: 15_000 });
    const tabId = await serviceWorker.evaluate(async (url) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, page.url());

    const result = await serviceWorker.evaluate(async ({ target, embed }) => {
        const executions = await chrome.scripting.executeScript({
            target: { tabId: target },
            world: 'ISOLATED',
            func: (embed) => {
                const harvested = VideoDownloader._collectMediaUrlsFromEmbed(embed);
                const byKind = Object.fromEntries(harvested.map((entry) => [entry.uaKind, entry.url]));

                // A 2 GB video sets the bar; the audio track is one per cent of
                // it and the preview strip is a few hundred KB.
                const twoGb = 2 * 1024 * 1024 * 1024;
                const verdict = (size, uaKind) => VideoDownloader._renditionVerdict(size, {
                    largestKnownBytes: twoGb,
                    durationSeconds: 900,
                    uaKind,
                });
                return {
                    kinds: harvested.map((entry) => entry.uaKind).sort(),
                    urls: harvested.map((entry) => entry.url),
                    byKind,
                    audioKept: verdict(21 * 1024 * 1024, 'audio'),
                    audioWithoutName: verdict(21 * 1024 * 1024, null),
                    videoKept: verdict(twoGb, 'mp4'),
                    smallVideoRejected: verdict(21 * 1024 * 1024, 'mp4'),
                    placeholderRejected: verdict(300 * 1024, null),
                    // Even named audio has to clear the absolute floor, so a
                    // placeholder cannot ride in by claiming to be audio.
                    tinyAudioRejected: verdict(1024, 'audio'),
                };
            },
            args: [embed],
        });
        return executions[0]?.result;
    }, { target: tabId, embed: EMBED_PAYLOAD });

    // Positive control: the payload really did carry several named formats.
    expect(result.urls.length).toBeGreaterThan(2);

    // The preview strip is skipped by name, never probed, never size-judged.
    expect(result.kinds).not.toContain('timeline');
    expect(result.urls).not.toContain('https://1a-1791.com/video/fx/eeeeeeeeee.mp4');

    // Everything else keeps the name Rumble gave it.
    expect(result.kinds).toEqual(['audio', 'mp4', 'mp4', 'tar']);
    expect(result.byKind.audio).toBe('https://1a-1791.com/video/fx/dddddddddd.mp4');
    expect(result.byKind.tar).toBe('https://1a-1791.com/video/fx/aaaaaaaaaa.tar');

    // A 21 MB audio rendition survives next to a 2 GB video because it is named
    // audio, and would not survive on size alone.
    expect(result.audioKept).toBe('ok');
    expect(result.audioWithoutName).toBe('reject');
    expect(result.videoKept).toBe('ok');
    expect(result.smallVideoRejected).toBe('reject');

    // The size floors still do their job where no name exists, and the
    // absolute floor still applies to named audio.
    expect(result.placeholderRejected).toBe('reject');
    expect(result.tinyAudioRejected).toBe('reject');
});
