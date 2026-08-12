// RumbleX v3.2.0 — Offscreen document
// Runs in the extension origin. Carries DOM access the MV3 service worker
// can't have. Spun up by background.js via chrome.offscreen.createDocument
// with reasons ["DOM_PARSER", "BLOBS", "WORKERS"].
//
// Today this scaffold handles five atomic message actions:
//   - parseHtml: take an HTML string, return structured probe data via DOMParser.
//   - hashBlob: take a URL, fetch as Blob, return its SHA-256 digest.
//   - getCapabilities: report the local APIs available to diagnostic exports.
//   - writeArchiveFile: serialize a direct-media stream into a persisted folder.
//   - inspectMedia: read bounded local MP4 metadata for muxer verification.
//
// Probe actions are read-only; archive writes occur only after a user chooses
// a local folder. The full deep-scan probe path will move here once
// Mediabunny replaces mux.js so we can drop the Web Worker + offscreen split
// for one home. For now the live download flows stay in content.js + worker.js.
'use strict';

let rxArchiveWriteQueue = Promise.resolve();
let rxArchiveWritesPaused = false;
let rxArchiveWriteGeneration = 0;
const rxArchiveWriteControllers = new Map();
let rxMediaInspectorModulePromise = null;
const RX_MEDIA_INSPECT_MAX_BYTES = 2 * 1024 * 1024;

function rxIsAllowedArchiveMediaUrl(raw) {
    try {
        const url = new URL(raw);
        const extensionOrigin = new URL(chrome.runtime.getURL('/')).origin;
        // Same-origin packaged resources are safe and keep the stream/write
        // contract deterministically testable without weakening remote hosts.
        if (url.origin === extensionOrigin) return true;
        return url.protocol === 'https:' && ['rumble.com', '1a-1791.com', 'rumble.cloud']
            .some((host) => url.hostname === host || url.hostname.endsWith('.' + host));
    } catch {
        return false;
    }
}

function rxGetMediaInspectorModule() {
    if (!rxMediaInspectorModulePromise) {
        rxMediaInspectorModulePromise = import(chrome.runtime.getURL('lib/mediabunny.min.mjs'));
    }
    return rxMediaInspectorModulePromise;
}

async function rxInspectMedia(rawBytes) {
    if (!Array.isArray(rawBytes) || rawBytes.length === 0) throw new Error('media-bytes-missing');
    if (rawBytes.length > RX_MEDIA_INSPECT_MAX_BYTES) throw new Error('media-inspection-limit');
    const bytes = Uint8Array.from(rawBytes, (value) => {
        const numeric = Number(value);
        if (!Number.isInteger(numeric) || numeric < 0 || numeric > 255) throw new Error('media-byte-invalid');
        return numeric;
    });
    const { Input, ALL_FORMATS, BlobSource } = await rxGetMediaInspectorModule();
    const input = new Input({
        source: new BlobSource(new Blob([bytes], { type: 'video/mp4' })),
        formats: ALL_FORMATS,
    });
    try {
        const [mimeType, duration, videoTrack, audioTrack] = await Promise.all([
            input.getMimeType(),
            input.computeDuration(),
            input.getPrimaryVideoTrack(),
            input.getPrimaryAudioTrack(),
        ]);
        return {
            ok: true,
            mimeType,
            duration,
            video: videoTrack ? {
                codec: await videoTrack.getCodec(),
                width: await videoTrack.getDisplayWidth(),
                height: await videoTrack.getDisplayHeight(),
            } : null,
            audio: audioTrack ? {
                codec: await audioTrack.getCodec(),
                sampleRate: await audioTrack.getSampleRate(),
                channels: await audioTrack.getNumberOfChannels(),
            } : null,
        };
    } finally {
        if (typeof input.dispose === 'function') await input.dispose();
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.target !== 'offscreen') return;

    if (msg.action === 'getCapabilities') {
        sendResponse({
            ok: true,
            domParser: typeof DOMParser === 'function',
            blob: typeof Blob === 'function',
            worker: typeof Worker === 'function',
            webCrypto: !!globalThis.crypto?.subtle,
            webCodecs: typeof VideoDecoder === 'function',
        });
        return false;
    }

    if (msg.action === 'writeArchiveFile') {
        if (!rxIsAllowedArchiveMediaUrl(msg.url)) {
            sendResponse({ ok: false, reason: 'url-not-allowlisted' });
            return false;
        }
        if (!globalThis.RxArchiveFsAccess) {
            sendResponse({ ok: false, reason: 'folder-helper-unavailable' });
            return false;
        }
        const operationId = String(msg.operationId || Date.now() + '-' + Math.random().toString(16).slice(2));
        const writeGeneration = rxArchiveWriteGeneration;
        const write = rxArchiveWriteQueue.then(async () => {
            if (rxArchiveWritesPaused || writeGeneration !== rxArchiveWriteGeneration) {
                return { ok: false, reason: 'offline-paused' };
            }
            const controller = new AbortController();
            rxArchiveWriteControllers.set(operationId, controller);
            try {
                return await globalThis.RxArchiveFsAccess.writeUrl(msg.url, msg.filename, { signal: controller.signal });
            } finally {
                rxArchiveWriteControllers.delete(operationId);
            }
        });
        rxArchiveWriteQueue = write.catch(() => {});
        write
            .then((result) => sendResponse(result))
            .catch((error) => sendResponse({ ok: false, reason: 'folder-write-failed', error: String(error?.message || error).slice(0, 240) }));
        return true;
    }

    if (msg.action === 'pauseArchiveWrites') {
        rxArchiveWritesPaused = true;
        rxArchiveWriteGeneration++;
        const active = rxArchiveWriteControllers.size;
        for (const controller of rxArchiveWriteControllers.values()) controller.abort('network-offline');
        sendResponse({ ok: true, paused: true, active });
        return false;
    }

    if (msg.action === 'resumeArchiveWrites') {
        rxArchiveWritesPaused = false;
        sendResponse({ ok: true, paused: false });
        return false;
    }

    if (msg.action === 'inspectMedia') {
        if (sender.id !== chrome.runtime.id) {
            sendResponse({ ok: false, reason: 'extension-sender-required' });
            return false;
        }
        rxInspectMedia(msg.bytes)
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error).slice(0, 240) }));
        return true;
    }

    if (msg.action === 'parseHtml') {
        try {
            const doc = new DOMParser().parseFromString(String(msg.html || ''), 'text/html');
            const out = {
                title: doc.title || '',
                metaCount: doc.querySelectorAll('meta').length,
                scriptCount: doc.querySelectorAll('script').length,
                // Extract every <a href> and <video src>/<source src> URL.
                // Caller decides what to do with the list.
                hrefs: Array.from(doc.querySelectorAll('a[href]'), (a) => a.getAttribute('href')).slice(0, 500),
                videoSources: Array.from(doc.querySelectorAll('video[src], video > source[src]'), (el) => el.getAttribute('src')).slice(0, 50),
            };
            sendResponse({ ok: true, parsed: out });
        } catch (e) {
            sendResponse({ ok: false, reason: String(e?.message || e) });
        }
        return true;
    }

    if (msg.action === 'hashBlob') {
        const url = String(msg.url || '');
        if (!url) { sendResponse({ ok: false, reason: 'no-url' }); return true; }
        (async () => {
            try {
                const resp = await fetch(url, { method: 'GET', credentials: 'omit' });
                if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                const buf = await resp.arrayBuffer();
                const digest = await crypto.subtle.digest('SHA-256', buf);
                const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
                sendResponse({ ok: true, sha256: hex, bytes: buf.byteLength });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true; // keep channel open for async sendResponse
    }
});

console.log('[RumbleX offscreen] ready');
