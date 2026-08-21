#!/usr/bin/env node
'use strict';

// Every canonical setting must either be read by runtime code or be declared
// unimplemented.
//
// The failure this prevents: a key gets added to settings-schema.js and to the
// options page, renders a live control, saves cleanly — and no runtime code ever
// reads it. The user flips a switch, watches it persist, and nothing happens.
// 41 of 210 keys were in exactly that state before v3.42, including the
// `encryptedGistSync` master switch guarding a feature that uploads every
// setting to a third-party host.
//
// The check runs both ways. A key that is neither read nor declared fails, and
// a key declared unimplemented that IS read also fails — so wiring a key up
// forces the declaration to be removed in the same change, and the list cannot
// rot into a pile of stale exemptions.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const schemaContext = vm.createContext({ URL });
vm.runInContext(read('extension/settings-schema.js'), schemaContext, { filename: 'settings-schema.js' });
const { DEFAULTS, UNIMPLEMENTED } = schemaContext.RumbleXSettingsSchema;

// Runtime consumers only. The options and popup pages are the settings *editor*:
// they read every key by definition, so counting them would make this guard
// vacuous.
const RUNTIME_FILES = [
    'extension/core-routing.js',
    'extension/core-selectors.js',
    'extension/core-video-cards.js',
    'extension/core-media.js',
    'extension/content.js',
    'extension/background.js',
    'extension/offscreen.js',
    'extension/ad-blocker.js',
    'extension/mediabunny-worker.js',
    'userscript/platform.js',
].filter((relative) => fs.existsSync(path.join(ROOT, relative)));

const runtimeSource = RUNTIME_FILES.map(read).join('\n');
const core = read('extension/content.js');

// Two registries read their key dynamically rather than by literal name:
// handwritten feature modules gate on `Settings.get(this.id)`, and the CSS
// toggle factory gates on `Settings.get(entry.id)`. Both count as real reads.
const dynamicallyReadIds = new Set();

const registryBody = core.match(/const features = \[([\s\S]*?)\n\];/)?.[1] || '';
assert.ok(registryBody, 'feature registry is missing');
const symbols = [...new Set(
    [...registryBody.replace(/\/\/.*$/gm, '').matchAll(/\b[A-Z][A-Za-z0-9]+\b/g)]
        .map((match) => match[0])
        .filter((symbol) => symbol !== 'RX_CSS_FEATURES'),
)];
for (const symbol of symbols) {
    const block = core.match(new RegExp(`^const ${symbol} = \\{([\\s\\S]*?)^\\};`, 'm'))?.[0] || '';
    const id = block.match(/^\s*id:\s*'([^']+)'/m)?.[1];
    if (id && /Settings\.get\(this\.id\)/.test(block)) dynamicallyReadIds.add(id);
}

const cssBody = core.match(/const RX_CSS_TOGGLES = \[([\s\S]*?)\n\];/)?.[1] || '';
assert.ok(cssBody, 'CSS feature registry is missing');
for (const match of cssBody.matchAll(/\bid:\s*'([^']+)'/g)) dynamicallyReadIds.add(match[1]);

// Literal access shapes actually used across the runtime. Settings arrive both
// through the Settings facade in content.js and as plain normalized objects in
// background.js, where they are destructured or reached through the storage
// bucket (`data.rx_settings.someKey`, `got?.rx_settings?.someKey`).
function isReadByRuntime(key) {
    if (dynamicallyReadIds.has(key)) return true;
    const patterns = [
        `Settings\\.get\\(\\s*['"\`]${key}['"\`]`,
        `Settings\\.set\\(\\s*['"\`]${key}['"\`]`,
        `\\.${key}\\b`,
        `\\[\\s*['"\`]${key}['"\`]\\s*\\]`,
        `\\b${key}\\s*[,:}]`,
    ];
    return patterns.some((pattern) => new RegExp(pattern).test(runtimeSource));
}

const keys = Object.keys(DEFAULTS);
const declaredUnimplemented = Object.keys(UNIMPLEMENTED);

const unreadAndUndeclared = keys.filter((key) => !isReadByRuntime(key) && !Object.hasOwn(UNIMPLEMENTED, key));
assert.deepEqual(unreadAndUndeclared, [],
    'settings with no runtime consumer that are not declared in UNIMPLEMENTED: '
    + `${unreadAndUndeclared.join(', ')}\n`
    + 'Either wire the key to real behavior or declare it in settings-schema.js '
    + 'so the options page stops presenting it as a working control.');

const declaredButRead = declaredUnimplemented.filter((key) => isReadByRuntime(key));
assert.deepEqual(declaredButRead, [],
    `keys declared UNIMPLEMENTED that runtime code now reads: ${declaredButRead.join(', ')}\n`
    + 'Remove them from UNIMPLEMENTED — they work now, and the options page is '
    + 'still telling users they do not.');

const declaredButMissing = declaredUnimplemented.filter((key) => !Object.hasOwn(DEFAULTS, key));
assert.deepEqual(declaredButMissing, [],
    `keys declared UNIMPLEMENTED that no longer exist in the schema: ${declaredButMissing.join(', ')}`);

for (const [key, reason] of Object.entries(UNIMPLEMENTED)) {
    assert.equal(typeof reason, 'string', `UNIMPLEMENTED.${key} must carry a reason string`);
    assert.ok(reason.trim().length >= 8, `UNIMPLEMENTED.${key} needs a real reason, got: ${JSON.stringify(reason)}`);
}

// The options page must actually consume the registry, otherwise the disclosure
// silently stops rendering and this guard would still pass.
const optionsSource = read('extension/pages/options.js');
for (const snippet of ['RXSettingsSchema.UNIMPLEMENTED', 'Not implemented yet']) {
    assert.ok(optionsSource.includes(snippet),
        `options.js no longer renders the unimplemented disclosure (missing: ${snippet})`);
}

const wired = keys.length - declaredUnimplemented.length;
console.log(
    `Settings consumer guard OK: ${wired}/${keys.length} keys have a runtime consumer, `
    + `${declaredUnimplemented.length} declared unimplemented.`,
);
