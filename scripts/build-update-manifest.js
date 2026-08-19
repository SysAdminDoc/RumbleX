#!/usr/bin/env node
'use strict';

// Generates docs/updates.json, the Firefox update manifest for the
// self-distributed (AMO unlisted) build.
//
// Firefox checks the URL in manifest-firefox.json's
// browser_specific_settings.gecko.update_url and installs any higher version it
// finds. That only works for a *signed* XPI, so this script refuses to invent
// an entry: pass --xpi with the signed file and it emits a real one, or pass
// nothing and it writes an empty (valid) manifest meaning "no update".
//
// Usage:
//   node scripts/build-update-manifest.js                       # empty manifest
//   node scripts/build-update-manifest.js --xpi path/to.xpi     # real entry
//   node scripts/build-update-manifest.js --check               # verify only

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'extension', 'manifest-firefox.json');
const OUT = path.join(ROOT, 'docs', 'updates.json');
const RELEASE_BASE = 'https://github.com/SysAdminDoc/RumbleX/releases/download';

function fail(message) {
    console.error(`[!] ${message}`);
    process.exit(1);
}

function readManifest() {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const gecko = manifest.browser_specific_settings && manifest.browser_specific_settings.gecko;
    if (!gecko || !gecko.id) fail('manifest-firefox.json has no browser_specific_settings.gecko.id');
    if (!manifest.version) fail('manifest-firefox.json has no version');
    return { id: gecko.id, version: manifest.version, minVersion: gecko.strict_min_version || null };
}

function buildManifest({ id, version, minVersion }, xpiPath) {
    const updates = [];
    if (xpiPath) {
        if (!fs.existsSync(xpiPath)) fail(`signed XPI not found: ${xpiPath}`);
        const hash = crypto.createHash('sha256').update(fs.readFileSync(xpiPath)).digest('hex');
        const entry = {
            version,
            update_link: `${RELEASE_BASE}/v${version}/${path.basename(xpiPath)}`,
            update_hash: `sha256:${hash}`,
        };
        if (minVersion) entry.applications = { gecko: { strict_min_version: minVersion } };
        updates.push(entry);
    }
    return { addons: { [id]: { updates } } };
}

// Mozilla requires update_link over HTTPS, and an update_hash is what stops a
// swapped release asset from being installed as an update. Both are checked
// here so a hand-edited manifest cannot ship without them.
function validate(doc, { id }) {
    const problems = [];
    if (!doc || typeof doc !== 'object' || !doc.addons) problems.push('missing top-level "addons" object');
    const entry = doc && doc.addons && doc.addons[id];
    if (!entry) {
        problems.push(`no entry for add-on id "${id}"`);
    } else if (!Array.isArray(entry.updates)) {
        problems.push(`"updates" for ${id} is not an array`);
    } else {
        entry.updates.forEach((update, i) => {
            const at = `updates[${i}]`;
            if (!update.version) problems.push(`${at} has no version`);
            if (!update.update_link) {
                problems.push(`${at} has no update_link`);
            } else if (!update.update_link.startsWith('https://')) {
                problems.push(`${at} update_link must be https (got ${update.update_link})`);
            }
            if (!/^sha(256|512):[0-9a-f]+$/i.test(update.update_hash || '')) {
                problems.push(`${at} needs an update_hash like "sha256:<hex>"`);
            }
        });
    }
    const extra = Object.keys((doc && doc.addons) || {}).filter((key) => key !== id);
    if (extra.length) problems.push(`unknown add-on ids in manifest: ${extra.join(', ')}`);
    return problems;
}

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const xpiIndex = args.indexOf('--xpi');
const xpiPath = xpiIndex >= 0 ? args[xpiIndex + 1] : null;
if (xpiIndex >= 0 && !xpiPath) fail('--xpi needs a path');

const info = readManifest();

if (checkOnly) {
    if (!fs.existsSync(OUT)) fail(`docs/updates.json is missing (run ${path.basename(__filename)} to create it)`);
    let doc;
    try {
        doc = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    } catch (err) {
        fail(`docs/updates.json is not valid JSON: ${err.message}`);
    }
    const problems = validate(doc, info);
    // A published entry must describe the version this repository actually
    // builds, or Firefox would be told to "update" to something that is not the
    // current release.
    const updates = (doc.addons[info.id] && doc.addons[info.id].updates) || [];
    if (updates.length && !updates.some((u) => u.version === info.version)) {
        problems.push(`no update entry for the current version ${info.version}`);
    }
    if (problems.length) {
        console.error('[!] docs/updates.json is not shippable:');
        problems.forEach((p) => console.error(`    - ${p}`));
        process.exit(1);
    }
    console.log(updates.length
        ? `Update manifest OK: ${info.id} -> ${updates.length} entry(s), current ${info.version}.`
        : `Update manifest OK: ${info.id}, no published update yet (unsigned release line).`);
    process.exit(0);
}

const doc = buildManifest(info, xpiPath);
const problems = validate(doc, info);
if (problems.length) {
    console.error('[!] refusing to write an invalid update manifest:');
    problems.forEach((p) => console.error(`    - ${p}`));
    process.exit(1);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
console.log(xpiPath
    ? `[*] Wrote docs/updates.json for ${info.id} ${info.version}`
    : `[*] Wrote docs/updates.json with no update entry (pass --xpi <signed.xpi> once a signed build exists)`);
