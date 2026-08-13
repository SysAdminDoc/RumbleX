#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(ROOT, 'userscript', 'platform.js'), 'utf8');
const source = template
    .replace('__RUMBLEX_VERSION__', JSON.stringify('9.9.9-test'))
    .replace('__RUMBLEX_ASSETS__', JSON.stringify({ 'worker.js': 'worker-source' }))
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
        setTimeout,
        clearTimeout,
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
    vm.runInContext(source, context, { filename: 'userscript/platform.js' });
    const platform = context.RumbleXPlatform;

    assert.equal(platform.kind, 'userscript');
    assert.equal(platform.version, '9.9.9-test');
    assert.equal(await platform.assetText('worker.js'), 'worker-source');
    assert.equal(platform.t('hello'), 'Hello');

    await platform.storage.set({ alpha: 1, beta: { ok: true } });
    assert.equal(JSON.stringify(await platform.storage.get(['alpha', 'beta'])), JSON.stringify({ alpha: 1, beta: { ok: true } }));
    await platform.storage.remove('alpha');
    assert.equal((await platform.storage.get('alpha')).alpha, undefined);
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
    assert.ok(manifest.host_permissions.includes('https://*.rumble.com/*'));
    assert.equal(platform.capabilities.persistentBackground, false);

    console.log('Userscript platform contract OK: storage, migration, xhr, abort, HTTPS allowlist, downloads, manifest.');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
