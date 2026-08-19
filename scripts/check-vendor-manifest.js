#!/usr/bin/env node
'use strict';

// Verifies extension/lib/VENDOR.json against what is actually on disk and
// against the SHA-256 values pinned in extension/build.sh.
//
// Three ways this can rot, all of them caught here:
//   - a vendored file is upgraded and VENDOR.json still describes the old one
//   - build.sh's pin and VENDOR.json's hash drift apart
//   - a file appears in lib/ that nothing has recorded provenance for

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'extension', 'lib');
const MANIFEST = path.join(LIB, 'VENDOR.json');
const BUILD = path.join(ROOT, 'extension', 'build.sh');

const problems = [];

if (!fs.existsSync(MANIFEST)) {
    console.error('[!] extension/lib/VENDOR.json is missing.');
    process.exit(1);
}

let doc;
try {
    doc = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch (err) {
    console.error(`[!] VENDOR.json is not valid JSON: ${err.message}`);
    process.exit(1);
}

if (!Array.isArray(doc.files) || doc.files.length === 0) {
    console.error('[!] VENDOR.json has no "files" array.');
    process.exit(1);
}

const REQUIRED = ['path', 'package', 'version', 'license', 'registry', 'sha256', 'bytes', 'reproduce'];
const buildSrc = fs.readFileSync(BUILD, 'utf8');
const described = new Set();

for (const entry of doc.files) {
    const label = entry.path || '(unnamed entry)';
    for (const field of REQUIRED) {
        if (!entry[field] && entry[field] !== 0) problems.push(`${label}: missing "${field}"`);
    }
    if (!entry.path) continue;
    described.add(entry.path);

    const abs = path.join(LIB, entry.path);
    if (!fs.existsSync(abs)) {
        problems.push(`${label}: described in VENDOR.json but not present in extension/lib/`);
        continue;
    }
    const bytes = fs.readFileSync(abs);
    const actual = crypto.createHash('sha256').update(bytes).digest('hex');
    if (entry.sha256 && actual !== entry.sha256) {
        problems.push(`${label}: sha256 mismatch\n        recorded: ${entry.sha256}\n        on disk:  ${actual}`);
    }
    if (typeof entry.bytes === 'number' && entry.bytes !== bytes.length) {
        problems.push(`${label}: size mismatch (recorded ${entry.bytes}, on disk ${bytes.length})`);
    }
    // build.sh is the gate that actually blocks a bad file from shipping, so the
    // provenance record has to agree with it or one of the two is lying.
    if (entry.sha256 && !buildSrc.includes(entry.sha256)) {
        problems.push(`${label}: sha256 is not pinned anywhere in extension/build.sh`);
    }
    if (entry.registry && !/^https:\/\/registry\.npmjs\.org\//.test(entry.registry)) {
        problems.push(`${label}: registry should be an npm tarball URL (got ${entry.registry})`);
    }
}

for (const name of fs.readdirSync(LIB)) {
    if (name === 'VENDOR.json') continue;
    if (!described.has(name)) {
        problems.push(`${name}: present in extension/lib/ with no VENDOR.json entry`);
    }
}

if (problems.length) {
    console.error('[!] Vendor manifest does not match what ships:');
    problems.forEach((p) => console.error(`    - ${p}`));
    process.exit(1);
}

const summary = doc.files.map((f) => `${f.package}@${f.version}`);
console.log(`Vendor manifest OK: ${doc.files.length} files, ${[...new Set(summary)].join(', ')}, hashes agree with build.sh.`);
