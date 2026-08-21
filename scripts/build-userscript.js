'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'RumbleX.user.js');
// Greasy Fork caps scripts at 2 MB and forbids minified or obfuscated code.
// The full build embeds mux.min.js (112 KB) and mediabunny.min.mjs (643 KB),
// which violates the minification rule; shipping those two unminified instead
// would be 1.79 MB of libraries alone and blow the size cap. The "lite" variant
// therefore omits both transmuxers, which leaves a fully readable script well
// under the cap. It keeps every feature except MP4 remux, and raw HLS/TS save
// (v3.37) still works. See Roadmap_Blocked.md for the full decision.
const LITE_OUTPUT = path.join(ROOT, 'RumbleX.lite.user.js');
const LITE_OMITTED_ASSETS = ['worker.js', 'lib/mux.min.js', 'mediabunny-worker.js', 'lib/mediabunny.min.mjs'];
const VERSION = require(path.join(ROOT, 'package.json')).version;
const CORE_FILES = [
    'extension/core-routing.js',
    'extension/core-selectors.js',
    'extension/core-video-cards.js',
    'extension/core-media.js',
    'extension/content.js',
];

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n');
}

function sha256(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

function metadata(sharedHash, variant) {
    const lite = variant === 'lite';
    const name = lite ? 'RumbleX Lite' : 'RumbleX';
    const file = lite ? 'RumbleX.lite.user.js' : 'RumbleX.user.js';
    return `// ==UserScript==\n// @name         ${name}\n// @namespace    https://github.com/SysAdminDoc/RumbleX\n// @version      ${VERSION}\n// @description  ${lite ? 'Rumble enhancement suite (Lite). The same shared feature core, without bundled transmuxers. Downloads save the raw stream; MP4 remux needs the full build or the extension.' : 'Rumble enhancement suite. The same shared feature core as the browser extension.'}\n// @author       SysAdminDoc\n// @match        https://rumble.com/*\n// @match        https://*.rumble.com/*\n// @noframes\n// @run-at       document-start\n// @webRequest   [{"selector":"https://a.ads.rmbl.ws/*","action":"cancel"},{"selector":"https://a-delivery.rmbl.ws/*","action":"cancel"},{"selector":"https://imasdk.googleapis.com/*","action":"cancel"},{"selector":"https://s0.2mdn.net/instream/video/*","action":"cancel"},{"selector":"https://pagead2.googlesyndication.com/omsdk/*","action":"cancel"},{"selector":"https://*.doubleclick.net/*","action":"cancel"},{"selector":"https://*.googleadservices.com/pagead/*","action":"cancel"}]\n// @grant        GM_getValue\n// @grant        GM_setValue\n// @grant        GM_deleteValue\n// @grant        GM_addValueChangeListener\n// @grant        GM_removeValueChangeListener\n// @grant        GM_xmlhttpRequest\n// @grant        GM_download\n// @connect      rumble.com\n// @connect      1a-1791.com\n// @connect      rumble.cloud\n// @downloadURL  https://github.com/SysAdminDoc/RumbleX/raw/main/${file}\n// @updateURL    https://github.com/SysAdminDoc/RumbleX/raw/main/${file}\n// ==/UserScript==\n\n// Generated from the shared extension core files. Shared runtime SHA-256: ${sharedHash}\n`;
}

function build(variant) {
    const schema = read('extension/settings-schema.js');
    const coreSources = CORE_FILES.map(read);
    const adapterTemplate = read('userscript/platform.js');
    const worker = read('extension/worker.js');
    const mux = read('extension/lib/mux.min.js');
    const mediabunnyWorker = read('extension/mediabunny-worker.js');
    const mediabunny = read('extension/lib/mediabunny.min.mjs');
    const localeJson = JSON.parse(read('extension/_locales/en/messages.json'));
    const messages = Object.fromEntries(Object.entries(localeJson).map(([key, value]) => [key, value.message || '']));
    const assets = {
        'worker.js': worker,
        'lib/mux.min.js': mux,
        'mediabunny-worker.js': mediabunnyWorker,
        'lib/mediabunny.min.mjs': mediabunny,
    };
    if (variant === 'lite') {
        for (const key of LITE_OMITTED_ASSETS) delete assets[key];
    }
    const adapter = adapterTemplate
        .replace('__RUMBLEX_VERSION__', JSON.stringify(VERSION))
        .replace('__RUMBLEX_ASSETS__', JSON.stringify(assets))
        // Pretty-printed, not compact: the catalog is now 424 keys, and one
        // 22k-character line reads as minified code — which the parity guard
        // rejects and Greasy Fork's code rules forbid outright.
        .replace('__RUMBLEX_MESSAGES__', JSON.stringify(messages, null, 2));
    const sharedRuntime = [schema, ...coreSources].join('\n\n');
    return metadata(sha256(sharedRuntime), variant)
        + schema + '\n\n' + adapter + '\n\n' + coreSources.join('\n\n');
}

const variants = [
    { file: OUTPUT, label: 'RumbleX.user.js', source: build('full') },
    { file: LITE_OUTPUT, label: 'RumbleX.lite.user.js', source: build('lite') },
];

if (process.argv.includes('--check')) {
    for (const variant of variants) {
        const current = fs.existsSync(variant.file) ? fs.readFileSync(variant.file, 'utf8') : '';
        if (current !== variant.source) {
            console.error(`${variant.label} is stale. Run: npm run build:userscript`);
            process.exit(1);
        }
    }
    console.log(`Userscript parity check passed (${VERSION}, ${variants.map((v) => `${v.label} ${v.source.length}B`).join(', ')}).`);
} else {
    for (const variant of variants) fs.writeFileSync(variant.file, variant.source, 'utf8');
    console.log(`Generated ${variants.map((v) => `${v.label} ${VERSION} (${v.source.length} bytes)`).join(', ')}.`);
}
