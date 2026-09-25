#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { resolveObjectURL } = require('buffer');

const ROOT = path.resolve(__dirname, '..');
const schemaSource = fs.readFileSync(path.join(ROOT, 'extension', 'settings-schema.js'), 'utf8');
const template = fs.readFileSync(path.join(ROOT, 'userscript', 'platform.js'), 'utf8');
const source = template
    .replace('__RUMBLEX_VERSION__', JSON.stringify('9.9.9-test'))
    .replace('__RUMBLEX_ASSETS__', JSON.stringify({
        'worker.js': 'worker-source',
        'mediabunny-worker.js': 'mediabunny-worker-source',
        'lib/mediabunny.min.mjs': 'mediabunny-module-source',
    }))
    .replace('__RUMBLEX_MESSAGES__', JSON.stringify({ hello: 'Hello' }));

async function main() {
    const values = new Map();
    const valueListeners = new Map();
    const removedListeners = [];
    let nextListenerId = 1;
    let xhrImpl = () => { throw new Error('unexpected xhr'); };
    let downloadOptions = null;
    let nativeFetchCalls = 0;
    const anchors = [];
    // Captured rather than run, so a pending revoke doesn't hold the process
    // open and the test can fire it on purpose.
    const timers = [];

    const context = vm.createContext({
        URL,
        Headers,
        Response,
        DOMException,
        AbortController,
        AbortSignal,
        ArrayBuffer,
        Blob,
        TextEncoder,
        TextDecoder,
        crypto,
        console,
        setTimeout: (fn, delay) => timers.push({ fn, delay }),
        clearTimeout() {},
        location: { href: 'https://rumble.com/vfixture-test.html', origin: 'https://rumble.com' },
        navigator: { clipboard: { writeText: async () => {} } },
        document: {
            body: { appendChild() {} },
            createElement(tag) {
                assert.equal(tag, 'a');
                const anchor = { click() {}, remove() {}, rel: '', href: '', download: '' };
                anchors.push(anchor);
                return anchor;
            },
        },
        fetch: async () => {
            nativeFetchCalls++;
            return new Response('same-origin', { status: 200 });
        },
        showSaveFilePicker() {},
        GM_getValue: (key, fallback) => values.has(key) ? values.get(key) : fallback,
        GM_setValue: (key, value) => { values.set(key, value); },
        GM_deleteValue: (key) => { values.delete(key); },
        GM_addValueChangeListener: (key, fn) => {
            const id = nextListenerId++;
            valueListeners.set(id, { key, fn });
            return id;
        },
        GM_removeValueChangeListener: (id) => { removedListeners.push(id); valueListeners.delete(id); },
        GM_xmlhttpRequest: (options) => xhrImpl(options),
        GM_download: (options) => { downloadOptions = options; },
    });
    vm.runInContext(schemaSource, context, { filename: 'settings-schema.js' });
    vm.runInContext(source, context, { filename: 'userscript/platform.js' });
    const platform = context.RumbleXPlatform;

    assert.equal(platform.kind, 'userscript');
    assert.equal(platform.version, '9.9.9-test');
    assert.equal(await platform.assetText('worker.js'), 'worker-source');
    const mediabunnyUrl = platform.assetUrl('lib/mediabunny.min.mjs');
    assert.match(mediabunnyUrl, /^blob:/);
    assert.equal(platform.assetUrl('lib/mediabunny.min.mjs'), mediabunnyUrl);
    assert.equal(platform.capabilities.mediabunny, true);
    assert.equal(platform.capabilities.requestBlockingMode, 'userscript-manager-dependent');
    // Must match the @webRequest selector count in build-userscript.js: the
    // Privacy Report renders this number directly, so a stale value misreports
    // the shield to the user. It read 6 while the block declared 7.
    assert.equal(platform.capabilities.requestBlockingRules, 7);
    assert.equal(platform.capabilities.streamingFileSave, true);
    assert.equal(platform.t('hello'), 'Hello');

    await platform.storage.set({ alpha: 1, beta: { ok: true } });
    assert.equal(JSON.stringify(await platform.storage.get(['alpha', 'beta'])), JSON.stringify({ alpha: 1, beta: { ok: true } }));
    await platform.storage.remove('alpha');
    assert.equal((await platform.storage.get('alpha')).alpha, undefined);
    await platform.storage.set({ rx_settings: { darkEnhance: false, pageDensity: 'normal' } });
    const patched = await platform.storage.patchSettings({ darkEnhance: true });
    assert.equal(patched.darkEnhance, true);
    assert.equal(patched.pageDensity, 'normal');
    let change;
    const unsubscribe = platform.storage.onChanged((next) => { change = next; });
    const listener = [...valueListeners.values()][0];
    listener.fn('rx_settings', { old: true }, { next: true }, true);
    assert.equal(JSON.stringify(change.rx_settings), JSON.stringify({ oldValue: { old: true }, newValue: { next: true }, remote: true }));
    unsubscribe();
    assert.equal(removedListeners.length, 1);

    await assert.rejects(platform.fetch('http://rumble.com/video.ts'), /unapproved request URL/);
    await assert.rejects(platform.fetch('ftp://rumble.com/video.ts'), /unapproved request URL/);
    await assert.rejects(platform.fetch('https://evil.example/video.ts'), /unapproved request URL/);
    const sameOrigin = await platform.fetch('/api/test');
    assert.equal(await sameOrigin.text(), 'same-origin');
    assert.equal(nativeFetchCalls, 1);

    let capturedXhr;
    xhrImpl = (options) => {
        capturedXhr = options;
        queueMicrotask(() => options.onload({
            status: 206,
            statusText: 'Partial Content',
            response: new Uint8Array([1, 2, 3]).buffer,
            responseHeaders: 'Content-Type: video/mp2t\r\nContent-Length: 3',
            finalUrl: options.url,
        }));
        return { abort() {} };
    };
    const remote = await platform.fetch('https://cdn.rumble.cloud/video.ts', { method: 'GET', rxTimeoutMs: 4321 });
    assert.equal(remote.status, 206);
    assert.equal(capturedXhr.timeout, 4321);
    assert.equal(capturedXhr.responseType, 'arraybuffer');
    assert.equal((await remote.arrayBuffer()).byteLength, 3);

    let aborted = false;
    xhrImpl = () => ({ abort() { aborted = true; } });
    const controller = new AbortController();
    const pendingFetch = platform.fetch('https://rumble.cloud/pending.ts', { signal: controller.signal });
    controller.abort();
    await assert.rejects(pendingFetch, (error) => error?.name === 'AbortError');
    assert.equal(aborted, true);

    const downloadPromise = platform.sendMessage({
        action: 'download',
        data: { url: 'https://rumble.cloud/video.mp4', filename: 'bad:name.mp4' },
    });
    let downloadSettled = false;
    downloadPromise.finally(() => { downloadSettled = true; });
    await Promise.resolve();
    assert.equal(downloadSettled, false, 'download must not report success before GM_download completes');
    assert.equal(downloadOptions.name, 'bad_name.mp4');
    assert.equal(downloadOptions.timeout, 120000);
    downloadOptions.onload();
    assert.match((await downloadPromise).downloadId, /^userscript-/);
    await assert.rejects(
        platform.sendMessage({ action: 'download', data: { url: 'javascript://rumble.com/alert(1)' } }),
        /not allowed/
    );
    assert.equal(anchors.length, 0);

    // No GM_download. A cross-origin anchor would open the CDN URL in the tab
    // or save it under the CDN's name, so the file has to arrive as a
    // same-origin blob first and the anchor points at that.
    const gmDownload = context.GM_download;
    delete context.GM_download;
    const CDN = 'https://hugh.cdn.1a-1791.com/video/s8/2/clip.mp4';
    const unmanaged = (filename = 'clip.mp4') => platform.sendMessage({ action: 'download', data: { url: CDN, filename } });
    let blobXhr;
    xhrImpl = (options) => {
        blobXhr = options;
        queueMicrotask(() => {
            options.onprogress({ lengthComputable: true, loaded: 3, total: 3 });
            options.onload({ status: 200, response: new Blob([new Uint8Array([7, 8, 9])]), responseHeaders: 'Content-Type: video/mp4\r\n' });
        });
        return { abort() {} };
    };
    assert.match((await unmanaged('Clip: 720p.mp4')).downloadId, /^userscript-/);
    assert.equal(blobXhr.url, CDN);
    assert.equal(blobXhr.responseType, 'blob');
    assert.equal(anchors.length, 1);
    assert.match(anchors[0].href, /^blob:/, 'the anchor must point at a same-origin blob, never the CDN URL');
    assert.equal(anchors[0].download, 'Clip_ 720p.mp4');
    const savedBlob = resolveObjectURL(anchors[0].href);
    assert.deepEqual([...new Uint8Array(await savedBlob.arrayBuffer())], [7, 8, 9]);
    assert.equal(savedBlob.type, 'video/mp4');
    const revoke = timers.find((timer) => timer.delay === 60_000);
    assert.ok(revoke, 'the blob URL is revoked once the browser has the file');
    revoke.fn();
    assert.equal(resolveObjectURL(anchors[0].href), undefined);

    // Over the in-tab cap, from the first progress event that says so, with
    // or without a Content-Length.
    for (const progress of [
        { lengthComputable: true, loaded: 1024, total: 600 * 1024 * 1024 },
        { lengthComputable: false, loaded: 513 * 1024 * 1024, total: 0 },
    ]) {
        let abortedLarge = false;
        xhrImpl = (options) => {
            queueMicrotask(() => {
                options.onprogress(progress);
                // Like a real transfer, it finishes unless someone stops it.
                if (!abortedLarge) options.onload({ status: 200, response: new Blob([new Uint8Array(4)]) });
            });
            return { abort() { abortedLarge = true; } };
        };
        await assert.rejects(unmanaged(), (error) => error.code === 'userscript-too-large'
            && /GM_download/.test(error.message) && /512 MB/.test(error.message));
        assert.equal(abortedLarge, true, 'an oversized transfer is stopped, not left to fill the tab');
    }

    const answer = (result) => (options) => {
        queueMicrotask(() => options.onload(result));
        return { abort() {} };
    };
    xhrImpl = answer({ status: 403, response: new Blob([]) });
    await assert.rejects(unmanaged(), (error) => error.rxStatus === 403);
    xhrImpl = answer({ status: 200, response: 'text instead of bytes' });
    await assert.rejects(unmanaged(), (error) => error.code === 'userscript-cannot-name');
    xhrImpl = (options) => {
        queueMicrotask(() => options.onerror({ status: 0 }));
        return { abort() {} };
    };
    await assert.rejects(unmanaged(), (error) => error.name === 'TypeError' && /network request failed/i.test(error.message));
    const gmXhr = context.GM_xmlhttpRequest;
    delete context.GM_xmlhttpRequest;
    await assert.rejects(unmanaged(), (error) => error.code === 'userscript-cannot-name');
    context.GM_xmlhttpRequest = gmXhr;
    context.GM_download = gmDownload;
    assert.equal(anchors.length, 1, 'a refused download never clicks an anchor');

    values.clear();
    values.set('rx_keyboardNav', true);
    values.set('rx_speedControl', false);
    values.set('rx_shareTools', true);
    const migrated = await platform.migrateLegacySettings({ legacyKeyboardNav: false, speedController: true, shareTimestamp: false, stripTrackingParams: false });
    assert.equal(JSON.stringify(migrated), JSON.stringify({
        legacyKeyboardNav: true,
        speedController: false,
        shareTimestamp: true,
        stripTrackingParams: true,
        schemaVersion: 2,
    }));

    const manifest = platform.getManifest();
    assert.ok(manifest.permissions.includes('GM_removeValueChangeListener'));
    assert.ok(manifest.permissions.includes('userscriptWebRequest'));
    assert.ok(manifest.host_permissions.includes('https://*.rumble.com/*'));
    assert.equal(platform.capabilities.persistentBackground, false);

    console.log('Userscript platform contract OK: storage, migration, xhr, abort, HTTPS allowlist, downloads with and without GM_download, manifest.');
}

// A promise the adapter never settles leaves nothing on the event loop, and
// Node then exits 0 halfway through: a hang would read as a pass.
let finished = false;
process.on('exit', (code) => {
    if (code === 0 && !finished) {
        console.error('Userscript platform contract stopped before its last check: a promise never settled.');
        process.exitCode = 1;
    }
});

main().then(() => { finished = true; }, (error) => {
    console.error(error);
    process.exit(1);
});
