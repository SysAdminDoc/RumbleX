#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const fail = (message) => {
    console.error('Userscript parity guard failed: ' + message);
    process.exitCode = 1;
};

const pkg = json('package.json');
const chromeManifest = json('extension/manifest.json');
const firefoxManifest = json('extension/manifest-firefox.json');
const core = read('extension/content.js');
const adapter = read('userscript/platform.js');
const generated = read('RumbleX.user.js');
const hash = crypto.createHash('sha256').update(core).digest('hex');

if (pkg.version !== chromeManifest.version || pkg.version !== firefoxManifest.version) {
    fail(`version drift: package=${pkg.version}, Chrome=${chromeManifest.version}, Firefox=${firefoxManifest.version}`);
}
if (!generated.includes(`// @version      ${pkg.version}\n`)) fail('generated metadata version does not match package.json');
if (!generated.includes(`Core SHA-256: ${hash}`)) fail('generated core hash is stale');
if (!generated.endsWith(core)) fail('generated userscript does not end with the byte-identical canonical content core');

for (const [name, manifest] of [['Chrome', chromeManifest], ['Firefox', firefoxManifest]]) {
    const scripts = manifest.content_scripts?.[0]?.js || [];
    if (scripts.at(-2) !== 'platform.js' || scripts.at(-1) !== 'content.js') {
        fail(`${name} content scripts must load platform.js before content.js`);
    }
}
if (firefoxManifest.content_scripts?.[0]?.js?.[0] !== 'browser-polyfill.js'
    || firefoxManifest.background?.scripts?.[0] !== 'browser-polyfill.js') {
    fail('Firefox MV2 must load browser-polyfill.js before every Promise-based extension surface');
}

function stripCommentsAndStrings(source) {
    let out = '';
    let state = 'code';
    let quote = '';
    for (let i = 0; i < source.length; i++) {
        const c = source[i];
        const next = source[i + 1];
        if (state === 'code') {
            if (c === '/' && next === '/') { state = 'line-comment'; out += '  '; i++; continue; }
            if (c === '/' && next === '*') { state = 'block-comment'; out += '  '; i++; continue; }
            if (c === '"' || c === "'" || c === '`') { state = 'string'; quote = c; out += ' '; continue; }
            out += c;
            continue;
        }
        if (state === 'line-comment') {
            if (c === '\n') { state = 'code'; out += '\n'; } else out += ' ';
            continue;
        }
        if (state === 'block-comment') {
            if (c === '*' && next === '/') { state = 'code'; out += '  '; i++; }
            else out += c === '\n' ? '\n' : ' ';
            continue;
        }
        if (c === '\\') { out += '  '; i++; continue; }
        if (c === quote) { state = 'code'; out += ' '; }
        else out += c === '\n' ? '\n' : ' ';
    }
    return out;
}

const executableCore = stripCommentsAndStrings(core);
if (/\bchrome\s*\./.test(executableCore)) fail('canonical content core still executes chrome.* directly');
if (/\b(?:unsafeWindow|eval)\b|new\s+Function\s*\(/.test(executableCore)) fail('canonical content core contains dynamic-code execution');
if (!core.includes('if (!RXPlatform.capabilities.persistentBackground) return;')) {
    fail('extension-only persistent-background feature is not capability-gated');
}

for (const forbidden of ['unsafeWindow', 'cdn.jsdelivr.net', 'GM_loadScript', 'new Function(', 'eval(']) {
    if (generated.includes(forbidden)) fail(`generated userscript contains forbidden token: ${forbidden}`);
}
for (const required of ['@noframes', 'GM_xmlhttpRequest', 'GM_download', 'RumbleXPlatform', "kind: 'userscript'"]) {
    if (!generated.includes(required)) fail(`generated userscript is missing required contract: ${required}`);
}
for (const requiredMetadata of [
    '// @match        https://rumble.com/*',
    '// @match        https://*.rumble.com/*',
    '// @connect      rumble.com',
    '// @connect      1a-1791.com',
    '// @connect      rumble.cloud',
]) {
    if (!generated.includes(requiredMetadata)) fail(`generated metadata is missing: ${requiredMetadata}`);
}
for (const placeholder of ['__RUMBLEX_VERSION__', '__RUMBLEX_ASSETS__', '__RUMBLEX_MESSAGES__']) {
    if (generated.includes(placeholder)) fail(`unexpanded generator placeholder: ${placeholder}`);
}

const check = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-userscript.js'), '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
});
if (check.status !== 0) fail((check.stderr || check.stdout || 'generator freshness check failed').trim());

if (!process.exitCode) {
    const settingsCount = (core.match(/^\s{8}[A-Za-z][A-Za-z0-9]*:\s/gm) || []).length;
    const registry = core.match(/const features = \[([\s\S]*?)\n\];/)?.[1] || '';
    const registryCount = (registry.match(/\b[A-Z][A-Za-z0-9]+\b/g) || []).length;
    console.log(`Userscript parity guard OK: v${pkg.version}, core ${hash.slice(0, 12)}, ${settingsCount}+ catalog entries, ${registryCount}+ shared registry tokens.`);
}
