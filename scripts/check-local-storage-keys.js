#!/usr/bin/env node
'use strict';

// Every `rx_` storage key the content runtime writes must be accounted for by
// Reset All Data.
//
// The failure this prevents: PerChannelPrefs wrote `rx_channel_prefs` to
// Rumble-origin localStorage and the key was never added to
// RX_LOCAL_STORAGE_KEYS, so Reset All Data reported "All settings cleared" and
// left per-channel volume, speed and quality ceilings behind. Export Backup
// reads the same list, so the key was missing from backups too. Nothing failed;
// the wipe simply under-delivered while claiming otherwise.
//
// The check runs both ways. A runtime key that is in no reset list and carries
// no documented exclusion fails, and a listed key that no runtime code writes
// also fails — so removing a feature forces its key out of the list in the same
// change, and the list cannot rot into stale entries that make the reset look
// more thorough than it is.
//
// It also proves the extension-storage half is not decorative: the options page
// has to actually remove those keys, or the list is a comment.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const core = read('extension/content.js');
const optionsSource = read('extension/pages/options.js');

// The content runtime is every file the manifest injects, not just content.js.
// Scanning content.js alone missed `rx_probe_cache` in core-media.js, which is
// written to extension storage and cleared by nothing.
// The privileged files count too. Scanning only the content scripts let five
// service-worker keys survive a wipe the options page reported as complete:
// saved settings profiles, the archive queue, the diagnostics ring,
// interrupted-download resume state, and the first-run flag.
const PRIVILEGED_FILES = ['extension/background.js', 'extension/offscreen.js'];
const manifest = JSON.parse(read('extension/manifest.json'));
const RUNTIME_FILES = [
    ...(manifest.content_scripts || []).flatMap((entry) => entry.js || []).map((file) => `extension/${file}`),
    ...PRIVILEGED_FILES,
].filter((relative) => fs.existsSync(path.join(ROOT, relative)));
for (const relative of PRIVILEGED_FILES) {
    assert.ok(RUNTIME_FILES.includes(relative), `expected ${relative} in the scanned set`);
}
assert.ok(RUNTIME_FILES.includes('extension/content.js'),
    'manifest content_scripts no longer injects content.js — the scan would miss the main runtime');
assert.ok(RUNTIME_FILES.length >= 5,
    `expected the manifest to inject the shared core files, found only: ${RUNTIME_FILES.join(', ')}`);

// Pull an array or object literal out of the runtime by name. Parsed rather
// than executed: content.js is a browser bundle and cannot be run under Node.
function literalBody(source, name, open, close) {
    // Single-line and multi-line declarations both occur in content.js.
    const match = source.match(new RegExp(`const ${name} = \\${open}([\\s\\S]*?)\\${close};`));
    assert.ok(match, `${name} is missing from extension/content.js`);
    return match[1];
}

function arrayLiteral(source, name) {
    return [...literalBody(source, name, '[', ']').matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
}

function objectKeys(source, name) {
    return [...literalBody(source, name, '{', '}').matchAll(/^\s{4}([A-Za-z0-9_]+):\s*'([^']*)'/gm)]
        .map(([, key, reason]) => [key, reason]);
}

const localKeys = arrayLiteral(core, 'RX_LOCAL_STORAGE_KEYS');
const localPrefixes = arrayLiteral(core, 'RX_LOCAL_STORAGE_PREFIXES');
const extensionKeys = arrayLiteral(core, 'RX_EXTENSION_STORAGE_RESET_KEYS');
const exclusions = objectKeys(core, 'RX_RESET_EXCLUSIONS');
const backupExcluded = arrayLiteral(core, 'RX_BACKUP_EXCLUDED_KEYS');
const excludedKeys = new Set(exclusions.map(([key]) => key));

// Every `rx_` string literal in the content runtime is a candidate key. The
// registries themselves are excluded from the scan so a key does not count as
// "written" merely by appearing in the list that is supposed to cover it.
const registryBlocks = [
    /const RX_LOCAL_STORAGE_KEYS = \[[\s\S]*?\];/,
    /const RX_LOCAL_STORAGE_PREFIXES = \[[\s\S]*?\];/,
    /const RX_EXTENSION_STORAGE_RESET_KEYS = \[[\s\S]*?\];/,
    /const RX_RESET_EXCLUSIONS = \{[\s\S]*?\};/,
    // This one is a registry too. Leaving it in the scan let a key count as
    // "written by the runtime" purely because it was named in the list of keys
    // to hold out of backups, which is the reverse-direction hole: delete the
    // feature and its key stays in RX_LOCAL_STORAGE_KEYS looking alive.
    /const RX_BACKUP_EXCLUDED_KEYS = \[[\s\S]*?\];/,
];
const scannedCore = registryBlocks.reduce((text, block) => text.replace(block, ''), core);
const scanned = [scannedCore, ...RUNTIME_FILES.filter((f) => f !== 'extension/content.js').map(read)].join('\n');

// Prose mentions a key without creating one. A line whose first non-space
// characters open a comment is documentation, so a key that appears on no other
// kind of line is not a key. Erring this way is deliberate: a stray comment
// mention would otherwise fail the build, while a trailing comment on a real
// code line still counts as code and fails loudly if it names something new.
const KEY_LITERAL = /['"`](rx_[A-Za-z0-9_]+)['"`]/g;
const isCommentLine = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);
const candidates = new Map();
for (const line of scanned.split('\n')) {
    const comment = isCommentLine(line);
    for (const [, key] of line.matchAll(KEY_LITERAL)) {
        if (!candidates.has(key)) candidates.set(key, false);
        if (!comment) candidates.set(key, true);
    }
}
// Single quotes, double quotes and template literals all occur in this tree,
// and keys are not guaranteed lowercase. Matching only one shape let a key slip
// past the whole check.
const runtimeKeys = [...candidates].filter(([, inCode]) => inCode).map(([key]) => key).sort();
assert.ok(runtimeKeys.length > 0, 'found no rx_ storage keys in the content runtime — the scan is broken');

const exactlyCovered = new Set([...localKeys, ...extensionKeys]);
// A prefix covers everything beneath it. Treating prefixes as whole keys failed
// the guard on keys the reset demonstrably clears.
const isCovered = (key) => exactlyCovered.has(key) || localPrefixes.some((prefix) => key.startsWith(prefix));
const covered = new Set([...localKeys, ...localPrefixes, ...extensionKeys]);
const uncovered = runtimeKeys.filter((key) => !isCovered(key) && !excludedKeys.has(key));
assert.deepEqual(uncovered, [],
    `content-runtime storage keys that Reset All Data does not clear and that carry no documented exclusion: ${uncovered.join(', ')}. `
    + 'Add each to RX_LOCAL_STORAGE_KEYS, RX_LOCAL_STORAGE_PREFIXES or RX_EXTENSION_STORAGE_RESET_KEYS, '
    + 'or record why the reset keeps it in RX_RESET_EXCLUSIONS.');

const runtimeKeySet = new Set(runtimeKeys);
const orphaned = [...localKeys, ...extensionKeys].filter((key) => !runtimeKeySet.has(key));
assert.deepEqual(orphaned, [],
    `reset lists name keys no content-runtime code writes: ${orphaned.join(', ')}. `
    + 'Remove them — a reset list padded with dead keys reports more thoroughness than it delivers.');

const orphanedPrefixes = localPrefixes.filter((prefix) => !runtimeKeys.some((key) => key.startsWith(prefix)) && !scanned.includes(`'${prefix}'`));
assert.deepEqual(orphanedPrefixes, [], `reset prefixes that match nothing in the runtime: ${orphanedPrefixes.join(', ')}`);

const staleExclusions = exclusions.filter(([key]) => !runtimeKeySet.has(key));
assert.deepEqual(staleExclusions.map(([key]) => key), [],
    `RX_RESET_EXCLUSIONS names keys the runtime no longer uses: ${staleExclusions.map(([key]) => key).join(', ')}`);

const bothWays = exclusions.filter(([key]) => covered.has(key));
assert.deepEqual(bothWays.map(([key]) => key), [],
    `keys both cleared and excluded: ${bothWays.map(([key]) => key).join(', ')}. Pick one.`);

for (const [key, reason] of exclusions) {
    assert.ok(reason.trim().length >= 20, `RX_RESET_EXCLUSIONS.${key} needs a real reason, got: ${JSON.stringify(reason)}`);
}

// A key held out of backups must still be a key the reset clears, and both the
// read and the write side have to honour the list. Otherwise it is a comment:
// the reader keeps exporting private drafts and the writer keeps accepting them
// from a crafted file.
for (const key of backupExcluded) {
    assert.ok(localKeys.includes(key),
        `RX_BACKUP_EXCLUDED_KEYS names ${key}, which RX_LOCAL_STORAGE_KEYS does not. `
        + 'Excluding a key the reset does not clear leaves it stranded on the origin.');
}
assert.ok(core.includes('if (RX_BACKUP_EXCLUDED_KEYS.includes(k)) continue;'),
    'rxReadLocalStorage no longer skips RX_BACKUP_EXCLUDED_KEYS, so excluded keys are back in every backup');
assert.ok(core.includes('const allowed = (k) => !RX_BACKUP_EXCLUDED_KEYS.includes(k)'),
    'rxWriteLocalStorage no longer refuses RX_BACKUP_EXCLUDED_KEYS, so an imported file can restore them');

// The extension-storage half is the options page's job. Without this the list
// above could name keys that nothing ever removes and the guard would still be
// green.
const mirror = optionsSource.match(/const EXTENSION_STORAGE_RESET_KEYS = \[([\s\S]*?)\];/);
assert.ok(mirror, 'options.js no longer declares EXTENSION_STORAGE_RESET_KEYS');
const mirrored = [...mirror[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
assert.deepEqual(mirrored.slice().sort(), extensionKeys.slice().sort(),
    `options.js EXTENSION_STORAGE_RESET_KEYS drifted from content.js RX_EXTENSION_STORAGE_RESET_KEYS: `
    + `${mirrored.join(', ')} vs ${extensionKeys.join(', ')}`);
assert.ok(/storage\.local\.remove\(EXTENSION_STORAGE_RESET_KEYS\)/.test(optionsSource),
    'options.js declares EXTENSION_STORAGE_RESET_KEYS but never removes them, so the list clears nothing');

// The localStorage half runs in the content script. Same reasoning.
assert.ok(/for \(const k of RX_LOCAL_STORAGE_KEYS\)/.test(core),
    'rxClearLocalStorage no longer iterates RX_LOCAL_STORAGE_KEYS');
assert.ok(core.includes('RX_LOCAL_STORAGE_PREFIXES.some'),
    'rxClearLocalStorage no longer honours RX_LOCAL_STORAGE_PREFIXES');

console.log(
    `Local storage key guard OK: ${localKeys.length} localStorage keys + ${localPrefixes.length} prefix, `
    + `${extensionKeys.length} extension-storage key(s), ${backupExcluded.length} backup-excluded, ${exclusions.length} documented exclusion(s), `
    + `across ${runtimeKeys.length} runtime rx_ keys.`,
);
