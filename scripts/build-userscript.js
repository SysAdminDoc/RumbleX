'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'RumbleX.user.js');
const VERSION = require(path.join(ROOT, 'package.json')).version;

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/^\uFEFF/, '');
}

function sha256(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

function metadata(coreHash) {
    return `// ==UserScript==\n// @name         RumbleX\n// @namespace    https://github.com/SysAdminDoc/RumbleX\n// @version      ${VERSION}\n// @description  Rumble enhancement suite — the same shared feature core as the browser extension.\n// @author       SysAdminDoc\n// @match        https://rumble.com/*\n// @match        https://*.rumble.com/*\n// @noframes\n// @run-at       document-start\n// @webRequest   [{"selector":"https://a.ads.rmbl.ws/*","action":"cancel"},{"selector":"https://imasdk.googleapis.com/*","action":"cancel"},{"selector":"https://s0.2mdn.net/instream/video/*","action":"cancel"},{"selector":"https://pagead2.googlesyndication.com/omsdk/*","action":"cancel"},{"selector":"https://*.doubleclick.net/*","action":"cancel"},{"selector":"https://*.googleadservices.com/pagead/*","action":"cancel"}]\n// @grant        GM_getValue\n// @grant        GM_setValue\n// @grant        GM_deleteValue\n// @grant        GM_addValueChangeListener\n// @grant        GM_removeValueChangeListener\n// @grant        GM_xmlhttpRequest\n// @grant        GM_download\n// @connect      rumble.com\n// @connect      1a-1791.com\n// @connect      rumble.cloud\n// @downloadURL  https://raw.githubusercontent.com/SysAdminDoc/RumbleX/main/RumbleX.user.js\n// @updateURL    https://raw.githubusercontent.com/SysAdminDoc/RumbleX/main/RumbleX.user.js\n// ==/UserScript==\n\n// Generated from extension/content.js. Core SHA-256: ${coreHash}\n`;
}

function build() {
    const core = read('extension/content.js');
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
    const adapter = adapterTemplate
        .replace('__RUMBLEX_VERSION__', JSON.stringify(VERSION))
        .replace('__RUMBLEX_ASSETS__', JSON.stringify(assets))
        .replace('__RUMBLEX_MESSAGES__', JSON.stringify(messages));
    return metadata(sha256(core)) + adapter + '\n\n' + core;
}

const generated = build();
if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
    if (current !== generated) {
        console.error('RumbleX.user.js is stale. Run: npm run build:userscript');
        process.exit(1);
    }
    console.log(`Userscript parity check passed (${VERSION}, ${generated.length} bytes).`);
} else {
    fs.writeFileSync(OUTPUT, generated, 'utf8');
    console.log(`Generated RumbleX.user.js ${VERSION} (${generated.length} bytes).`);
}
