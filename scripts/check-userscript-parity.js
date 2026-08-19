#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n?/g, '\n');
const json = (file) => JSON.parse(read(file));
const fail = (message) => {
    console.error('Userscript parity guard failed: ' + message);
    process.exitCode = 1;
};

const pkg = json('package.json');
const chromeManifest = json('extension/manifest.json');
const firefoxManifest = json('extension/manifest-firefox.json');
const schema = read('extension/settings-schema.js');
const core = read('extension/content.js');
const background = read('extension/background.js');
const options = read('extension/pages/options.js');
const optionsHtml = read('extension/pages/options.html');
const popup = read('extension/pages/popup.js');
const popupHtml = read('extension/pages/popup.html');
const buildScript = read('extension/build.sh');
const adapter = read('userscript/platform.js');
const generated = read('RumbleX.user.js');
const sharedRuntime = schema + '\n\n' + core;
const hash = crypto.createHash('sha256').update(sharedRuntime).digest('hex');

if (pkg.version !== chromeManifest.version || pkg.version !== firefoxManifest.version) {
    fail(`version drift: package=${pkg.version}, Chrome=${chromeManifest.version}, Firefox=${firefoxManifest.version}`);
}
if (!generated.includes(`// @version      ${pkg.version}\n`)) fail('generated metadata version does not match package.json');
if (!generated.includes(`Shared runtime SHA-256: ${hash}`)) fail('generated shared-runtime hash is stale');
if (!generated.endsWith(core)) fail('generated userscript does not end with the byte-identical canonical content core');
if (!generated.includes(schema + '\n\n// RumbleX platform adapter')) {
    fail('generated userscript does not embed the byte-identical canonical settings schema before its platform adapter');
}

for (const [name, manifest] of [['Chrome', chromeManifest], ['Firefox', firefoxManifest]]) {
    const scripts = manifest.content_scripts?.[0]?.js || [];
    if (scripts.at(-3) !== 'settings-schema.js' || scripts.at(-2) !== 'platform.js' || scripts.at(-1) !== 'content.js') {
        fail(`${name} content scripts must load settings-schema.js and platform.js before content.js`);
    }
}
if (firefoxManifest.content_scripts?.[0]?.js?.[0] !== 'browser-polyfill.js'
    || firefoxManifest.background?.scripts?.[0] !== 'browser-polyfill.js'
    || !firefoxManifest.background?.scripts?.includes('settings-schema.js')) {
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
const executableSchema = stripCommentsAndStrings(schema);
// Both namespaces, not just `chrome`. Chrome 148 exposes every extension API
// under `browser` as well, so a call written that way now runs fine in a
// developer's browser and still breaks the userscript build, where neither
// namespace exists. The core goes through RXPlatform or it does not go.
if (/\b(?:chrome|browser)\s*\./.test(executableCore)) fail('canonical content core still executes chrome.*/browser.* directly');
if (/\b(?:unsafeWindow|eval)\b|new\s+Function\s*\(/.test(executableCore)) fail('canonical content core contains dynamic-code execution');
if (/\b(?:chrome|browser)\s*\./.test(executableSchema)) fail('canonical settings schema must remain platform-independent');
if (/\b(?:unsafeWindow|eval)\b|new\s+Function\s*\(/.test(executableSchema)) fail('canonical settings schema contains dynamic-code execution');
if (!core.startsWith(`// RumbleX v${pkg.version} - Shared Content Core`)
    || !core.includes(`const VERSION = RXPlatform.version || '${pkg.version}';`)) {
    fail('canonical core header/fallback version does not match package.json');
}
if (!core.includes('if (!RXPlatform.capabilities.persistentBackground) return;')) {
    fail('extension-only persistent-background feature is not capability-gated');
}
for (const [surface, source, snippet] of [
    ['content', core, '_defaults: RXSettingsSchema.DEFAULTS'],
    ['background', background, "importScripts('settings-schema.js')"],
    ['options', options, 'const DEFAULTS = RXSettingsSchema.DEFAULTS;'],
    ['options HTML', optionsHtml, '<script src="../settings-schema.js"></script>'],
    ['popup', popup, 'const DEFAULTS = RXSettingsSchema.DEFAULTS;'],
    ['popup HTML', popupHtml, '<script src="../settings-schema.js"></script>'],
    ['release build', buildScript, 'settings-schema.js ad-blocker.js'],
]) {
    if (!source.includes(snippet)) fail(`${surface} no longer consumes/packages the canonical settings schema`);
}

for (const forbidden of ['unsafeWindow', 'cdn.jsdelivr.net', 'GM_loadScript', 'new Function(', 'eval(']) {
    if (generated.includes(forbidden)) fail(`generated userscript contains forbidden token: ${forbidden}`);
}
for (const required of [
    '@noframes', 'GM_xmlhttpRequest', 'GM_download', 'RumbleXPlatform', 'RumbleXSettingsSchema',
    "kind: 'userscript'", 'mediabunny-worker.js', 'lib/mediabunny.min.mjs',
    'mediabunny: hasMediabunnyAssets', 'streamingFileSave', 'requestBlockingMode', 'assetUrl',
]) {
    if (!generated.includes(required)) fail(`generated userscript is missing required contract: ${required}`);
}
const metadata = generated.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/)?.[1] || '';
const grants = [...metadata.matchAll(/^\/\/ @grant\s+(\S+)/gm)].map((match) => match[1]);
const expectedGrants = [
    'GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_addValueChangeListener',
    'GM_removeValueChangeListener', 'GM_xmlhttpRequest', 'GM_download',
];
if (JSON.stringify(grants) !== JSON.stringify(expectedGrants)) {
    fail(`userscript grants drift: ${grants.join(', ')}`);
}
for (const requiredMetadata of [
    '// @match        https://rumble.com/*',
    '// @match        https://*.rumble.com/*',
    '// @connect      rumble.com',
    '// @connect      1a-1791.com',
    '// @connect      rumble.cloud',
    '// @webRequest   [{"selector":"https://a.ads.rmbl.ws/*"',
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

// ── Greasy Fork-compliant "lite" variant ────────────────────────────────────
// Greasy Fork caps scripts at 2 MB and forbids minified or obfuscated code. The
// full build embeds two minified transmuxers, and shipping them unminified
// instead would be 1.79 MB of libraries alone. The lite variant omits both, so
// it must stay under the cap, carry no minified blob, and — critically — still
// be the same shared runtime rather than a fork that can drift.
const lite = read('RumbleX.lite.user.js');

const GREASY_FORK_SIZE_CAP = 2 * 1024 * 1024;
const liteBytes = Buffer.byteLength(lite, 'utf8');
if (liteBytes > GREASY_FORK_SIZE_CAP) {
    fail(`lite userscript is ${liteBytes} bytes, over the Greasy Fork 2 MB cap`);
}

// A minified bundle shows up as one enormous line. Readable source does not.
const MAX_READABLE_LINE = 20000;
const longestLiteLine = lite.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
if (longestLiteLine > MAX_READABLE_LINE) {
    fail(`lite userscript has a ${longestLiteLine}-character line, which reads as minified code`);
}

// Same runtime, not a fork.
if (!lite.endsWith(core)) fail('lite userscript does not end with the byte-identical canonical content core');
if (!lite.includes(schema + '\n\n// RumbleX platform adapter')) {
    fail('lite userscript does not embed the byte-identical canonical settings schema');
}
if (!lite.includes(`// @version      ${pkg.version}\n`)) fail('lite userscript version does not match package.json');
if (!lite.includes(`Shared runtime SHA-256: ${hash}`)) fail('lite userscript shared-runtime hash is stale');
if (!lite.includes('// @name         RumbleX Lite')) fail('lite userscript is not named distinctly');
if (!lite.includes('RumbleX.lite.user.js')) fail('lite userscript does not point its update URL at itself');

for (const forbidden of ['unsafeWindow', 'cdn.jsdelivr.net', 'GM_loadScript', 'new Function(', 'eval(']) {
    if (lite.includes(forbidden)) fail(`lite userscript contains forbidden token: ${forbidden}`);
}

// The whole point of the variant: neither transmuxer may be bundled.
const liteAssetsStart = lite.indexOf('const ASSETS = Object.freeze(');
if (liteAssetsStart < 0) {
    fail('lite userscript has no ASSETS table');
} else {
    const bodyStart = liteAssetsStart + 'const ASSETS = Object.freeze('.length;
    let depth = 0;
    let end = bodyStart;
    for (; end < lite.length; end += 1) {
        if (lite[end] === '{') depth += 1;
        else if (lite[end] === '}') { depth -= 1; if (depth === 0) { end += 1; break; } }
    }
    let liteAssets;
    try {
        liteAssets = JSON.parse(lite.slice(bodyStart, end));
    } catch {
        liteAssets = null;
    }
    if (!liteAssets) fail('lite userscript ASSETS table is not parseable');
    else if (Object.keys(liteAssets).length > 0) {
        fail(`lite userscript still bundles assets: ${Object.keys(liteAssets).join(', ')}`);
    }
}

if (!process.exitCode) {
    const defaultsBody = schema.match(/const DEFAULTS = Object\.freeze\(\{([\s\S]*?)\n    \}\);/)?.[1] || '';
    const settingsCount = (defaultsBody.match(/^\s{8}[A-Za-z][A-Za-z0-9]*:\s/gm) || []).length;
    const registry = core.match(/const features = \[([\s\S]*?)\n\];/)?.[1] || '';
    const registryCount = (registry.match(/\b[A-Z][A-Za-z0-9]+\b/g) || []).length;
    console.log(
        `Userscript parity guard OK: v${pkg.version}, shared ${hash.slice(0, 12)}, ${settingsCount} settings, `
        + `${registryCount}+ shared registry tokens, lite variant ${Math.round(liteBytes / 1024)}KB `
        + `(cap ${GREASY_FORK_SIZE_CAP / 1024 / 1024}MB, longest line ${longestLiteLine}).`,
    );
}
