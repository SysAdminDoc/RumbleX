// @ts-check
// The audio control saves the audio-only rendition Rumble publishes in its own
// embed payload (`ua.audio`), or says plainly that the video publishes none. It
// used to fetch the smallest video variant and transmux it, which put a video
// file behind an audio label, so every case here also checks what did NOT
// happen: no playlist fetched, no worker started, no file saved.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'platform', 'offline-watch.html'), 'utf8');
const AUDIO_URL = 'https://1a-1791.com/video/fx/audioonly00.mp4';
const VIDEO_URL = 'https://1a-1791.com/video/fx/videoonly720.mp4';
// The old path read this master, picked its smallest variant and transmuxed
// the segments. It is here so that path would have something to fetch.
const HLS_URL = 'https://1a-1791.com/video/fx/master000.m3u8';
const isMedia = (url) => /\.(?:m3u8|ts|mp4|m4a|aac)(?:[?#]|$)/i.test(url);

const embedPayload = (withAudio) => ({
    u: { hls: { url: HLS_URL } },
    ua: {
        mp4: { 720: { url: VIDEO_URL, meta: { h: 720, w: 1280, bitrate: 2500, size: 300 * 1024 * 1024 } } },
        ...(withAudio ? { audio: { 192: { url: AUDIO_URL, meta: { bitrate: 192, size: 21 * 1024 * 1024 } } } } : {}),
        timeline: { 0: { url: 'https://1a-1791.com/video/fx/timeline000.mp4' } },
    },
});

// Everything the background would send to the network or the browser's
// download manager is recorded instead, so the tests stay on this machine and
// can assert exactly what was asked for.
async function stubWorker(serviceWorker, settings, probeHits = []) {
    await serviceWorker.evaluate(async ({ seed, hits }) => {
        if (seed) await chrome.storage.local.set({ rx_settings: seed });
        globalThis.__rxAudioTest = { downloads: [], fetches: [] };
        globalThis.fetch = async (input) => {
            __rxAudioTest.fetches.push(String(input));
            if (hits.includes(String(input))) {
                return new Response(null, { status: 200, headers: { 'content-length': String(21 * 1024 * 1024) } });
            }
            return new Response(null, { status: 404 });
        };
        chrome.downloads.download = (options, callback) => {
            __rxAudioTest.downloads.push(options);
            callback?.(4242);
            return Promise.resolve(4242);
        };
    }, { seed: settings || null, hits: probeHits });
}

async function openPanel(context, serviceWorker, { withAudio, settings, probeHits, embedFor }) {
    await stubWorker(serviceWorker, settings, probeHits);
    const page = await context.newPage();
    const pageRequests = [];
    await page.route('**/*', (route) => {
        const request = route.request();
        if (request.isNavigationRequest() && request.url().startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        pageRequests.push(request.url());
        if (request.url().includes('/embedJS/')) {
            const embedId = new URL(request.url()).searchParams.get('v');
            const payload = embedFor ? embedFor(embedId) : embedPayload(withAudio);
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
        }
        return route.abort();
    });
    await page.goto(`https://rumble.com/vaudio-${withAudio ? 'present' : 'absent'}.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rx-download-btn', { state: 'attached', timeout: 15_000 });
    const tabId = await serviceWorker.evaluate(async (url) => {
        const tab = (await chrome.tabs.query({})).find((entry) => entry.url === url);
        if (!tab?.id) throw new Error('fixture tab not found');
        return tab.id;
    }, page.url());
    await page.evaluate(() => document.querySelector('#rx-download-btn')?.click());
    // Positive control: the panel really did load this video's own qualities,
    // so an absent audio control below cannot be a panel that never opened.
    await expect(page.locator('.rx-dl-quality').first()).toBeVisible({ timeout: 15_000 });
    return { page, pageRequests, tabId };
}

test('a video that publishes an audio rendition saves that file as .m4a with no conversion', async ({ context, serviceWorker }) => {
    const { page, pageRequests, tabId } = await openPanel(context, serviceWorker, { withAudio: true });
    const control = page.locator('.rx-dl-audio');
    await expect(control).toBeVisible();
    const button = control.locator('.rx-dl-audio-btn');
    await expect(button).toHaveText('Save audio only (.m4a)');
    await expect(control).toContainText('saved without conversion');

    // Capture the sidecars the page would write rather than saving them.
    await serviceWorker.evaluate(async (target) => {
        await chrome.scripting.executeScript({
            target: { tabId: target },
            world: 'ISOLATED',
            func: () => {
                globalThis.__rxSaved = [];
                VideoDownloader._triggerSave = (data, filename) => {
                    data.text().then((text) => globalThis.__rxSaved.push({ filename, text }));
                };
            },
        });
    }, tabId);

    await button.click();
    await expect.poll(() => serviceWorker.evaluate(() => __rxAudioTest.downloads.length)).toBe(1);
    const [download] = await serviceWorker.evaluate(() => __rxAudioTest.downloads);
    // Rumble's own audio file, byte for byte, under an audio extension.
    expect(download.url).toBe(AUDIO_URL);
    expect(download.filename).toMatch(/ - Audio only\.m4a$/);

    const state = await serviceWorker.evaluate(async (target) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: target },
            world: 'ISOLATED',
            func: async () => {
                for (let i = 0; i < 50 && globalThis.__rxSaved.length < 2; i += 1) {
                    await new Promise((resolve) => setTimeout(resolve, 50));
                }
                return {
                    saved: globalThis.__rxSaved,
                    worker: !!VideoDownloader._worker,
                    mediabunny: !!VideoDownloader._mediabunnyWorker,
                };
            },
        });
        return execution.result;
    }, tabId);

    // Nothing was converted: neither muxer worker ever started, and the page
    // asked for nothing beyond the embed payload. No master playlist, no
    // segments, which is exactly what the old smallest-variant path fetched.
    expect(state.worker).toBe(false);
    expect(state.mediabunny).toBe(false);
    expect(pageRequests.filter(isMedia)).toEqual([]);

    // The sidecar says what the file is, in yt-dlp's own field names.
    const info = state.saved.find((entry) => entry.filename.endsWith(' - Audio only.info.json'));
    expect(info, `sidecars written: ${state.saved.map((entry) => entry.filename).join(', ')}`).toBeTruthy();
    const meta = JSON.parse(info.text);
    expect(meta).toMatchObject({ format_id: 'audio', ext: 'm4a', vcodec: 'none', abr: 192 });
    expect(state.saved.some((entry) => entry.filename.endsWith(' - Audio only.nfo'))).toBe(true);
});

test('a video that publishes no audio rendition says so and saves nothing', async ({ context, serviceWorker }) => {
    const { page, pageRequests } = await openPanel(context, serviceWorker, { withAudio: false });
    const control = page.locator('.rx-dl-audio');
    await expect(control).toBeVisible();
    await expect(control).toHaveText(
        'This video publishes no audio-only stream, so there is no audio file to save. The video rows above include the sound.',
    );
    // No control to press, so there is no way to end up with a video file
    // labelled as audio.
    await expect(control.locator('button')).toHaveCount(0);
    expect(await serviceWorker.evaluate(() => __rxAudioTest.downloads.length)).toBe(0);
    expect(pageRequests.filter(isMedia)).toEqual([]);
});

test('audioExtractionMode off leaves the control out, and external copies the link instead of saving', async ({ context, serviceWorker }) => {
    const off = await openPanel(context, serviceWorker, { withAudio: true, settings: { audioExtractionMode: 'off' } });
    // Let the deep scan finish, so the observer has had every mutation it will
    // get to mount the control in and has declined each one.
    await expect(off.page.locator('.rx-dl-scan-bar.done')).toBeAttached({ timeout: 15_000 });
    await expect(off.page.locator('.rx-dl-audio')).toHaveCount(0);
    await off.page.close();

    const external = await openPanel(context, serviceWorker, { withAudio: true, settings: { audioExtractionMode: 'external' } });
    const control = external.page.locator('.rx-dl-audio');
    const button = control.locator('.rx-dl-audio-btn');
    await expect(button).toHaveText('Copy audio-only stream link');
    // A refused clipboard write is reported as a failure. The helper used to
    // return before the write settled, so this said "copied" either way.
    const setClipboard = (allow) => serviceWorker.evaluate(async ({ target, allowed }) => {
        await chrome.scripting.executeScript({
            target: { tabId: target },
            world: 'ISOLATED',
            func: (ok) => {
                globalThis.__rxCopied = globalThis.__rxCopied || [];
                navigator.clipboard.writeText = (text) => {
                    if (!ok) return Promise.reject(new DOMException('Document is not focused.', 'NotAllowedError'));
                    globalThis.__rxCopied.push(text);
                    return Promise.resolve();
                };
                document.execCommand = () => false;
            },
            args: [allowed],
        });
    }, { target: external.tabId, allowed: allow });
    await setClipboard(false);
    await button.click();
    await expect(control.locator('.rx-dl-audio-note')).toHaveText('Could not copy the link. Your browser blocked clipboard access.');
    await setClipboard(true);
    await button.click();
    await expect(control.locator('.rx-dl-audio-note')).toHaveText('Audio stream link copied.');
    const copied = await serviceWorker.evaluate(async (target) => {
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: target },
            world: 'ISOLATED',
            func: () => globalThis.__rxCopied,
        });
        return execution.result;
    }, external.tabId);
    expect(copied).toEqual([AUDIO_URL]);
    expect(await serviceWorker.evaluate(() => __rxAudioTest.downloads.length)).toBe(0);
});

test('the deep-scan audio row saves as .m4a too', async ({ context, serviceWorker }) => {
    // The worker answers the audio URL's probe, so the scan adds its row.
    const { page } = await openPanel(context, serviceWorker, { withAudio: true, probeHits: [AUDIO_URL] });
    const row = page.locator('.rx-dl-quality[data-key="audio only|mp4"]');
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.locator('.rx-dl-type-badge')).toHaveText('M4A');
    await row.locator('.rx-dl-quality-row-inner').click();
    await expect.poll(() => serviceWorker.evaluate(() => __rxAudioTest.downloads.length)).toBe(1);
    const [download] = await serviceWorker.evaluate(() => __rxAudioTest.downloads);
    expect(download.url).toBe(AUDIO_URL);
    expect(download.filename).toMatch(/ - Audio only\.m4a$/);
});

test('a control left over from the previous video resolves the video on screen before saving', async ({ context, serviceWorker }) => {
    // The first video publishes audio; the one navigated to does not.
    const { page, tabId } = await openPanel(context, serviceWorker, {
        withAudio: true,
        embedFor: (embedId) => embedPayload(embedId !== 'vnoaudio1'),
    });
    const control = page.locator('.rx-dl-audio');
    await expect(control.locator('.rx-dl-audio-btn')).toHaveText('Save audio only (.m4a)');

    // An in-app navigation that leaves the panel standing: the player now
    // belongs to a different video.
    await serviceWorker.evaluate(async (target) => {
        await chrome.scripting.executeScript({
            target: { tabId: target },
            world: 'ISOLATED',
            func: () => { document.querySelector('[id^="vid_v"]').id = 'vid_vnoaudio1'; },
        });
    }, tabId);
    await control.locator('.rx-dl-audio-btn').click();

    // It looked the new video up, found no audio rendition, and said so
    // instead of saving the old video's track under the new title.
    await expect(control).toHaveText(
        'This video publishes no audio-only stream, so there is no audio file to save. The video rows above include the sound.',
    );
    await page.waitForTimeout(300);
    expect(await serviceWorker.evaluate(() => __rxAudioTest.downloads.length)).toBe(0);
});
