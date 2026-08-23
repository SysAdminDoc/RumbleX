#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { createFirefoxArchive, OUTPUT } = require('./build-firefox-amo');
const { readArchive } = require('./zip-utils');

const ROOT = path.resolve(__dirname, '..');
const LEGACY_ZIP = path.join(ROOT, 'RumbleX-firefox.zip');
const DEFAULT_XPI = path.join(ROOT, 'RumbleX-firefox.xpi');
const SOURCE_ARCHIVE = path.join(ROOT, 'RumbleX-source.zip');

function signedXpiArgument() {
    const index = process.argv.indexOf('--signed-xpi');
    if (index < 0) return null;
    assert.ok(process.argv[index + 1], '--signed-xpi requires a file path');
    return path.resolve(process.argv[index + 1]);
}

function signatureEntriesPass(entries, file) {
    const names = [...entries.keys()].map((name) => name.toUpperCase());
    const hasJarManifest = names.includes('META-INF/MANIFEST.MF');
    const hasJarStatement = names.some((name) => /^META-INF\/[^/]+\.SF$/.test(name));
    const hasJarBlock = names.some((name) => /^META-INF\/[^/]+\.(RSA|DSA|EC)$/.test(name));
    const hasCosePair = names.includes('META-INF/COSE.MANIFEST') && names.includes('META-INF/COSE.SIG');
    assert.ok((hasJarManifest && hasJarStatement && hasJarBlock) || hasCosePair,
        `${path.basename(file)} has no complete Mozilla JAR or COSE signature entry set`);
}

assert.ok(fs.existsSync(OUTPUT), `missing ${path.basename(OUTPUT)}; run npm run build-for-amo`);
assert.ok(!fs.existsSync(LEGACY_ZIP),
    `${path.basename(LEGACY_ZIP)} is ambiguous; use ${path.basename(OUTPUT)} for the unsigned submission`);
assert.ok(fs.existsSync(SOURCE_ARCHIVE),
    `missing ${path.basename(SOURCE_ARCHIVE)}; run extension/build.sh before checking release artifacts`);

const expected = createFirefoxArchive();
const actual = fs.readFileSync(OUTPUT);
assert.equal(Buffer.compare(actual, expected), 0,
    `${path.basename(OUTPUT)} is stale or was not produced by npm run build-for-amo`);

const unsignedEntries = readArchive(OUTPUT);
const unsignedNames = [...unsignedEntries.keys()];
assert.ok(!unsignedNames.some((name) => name.toUpperCase().startsWith('META-INF/')),
    `${path.basename(OUTPUT)} unexpectedly contains signing metadata`);
assert.equal(JSON.parse(unsignedEntries.get('manifest.json').toString('utf8')).manifest_version, 2,
    `${path.basename(OUTPUT)} does not contain the Firefox MV2 manifest`);

const sourceEntries = readArchive(SOURCE_ARCHIVE);
for (const required of ['extension/manifest-firefox.json', 'extension/build.sh', 'scripts/build-userscript.js', 'package.json', 'LICENSE', 'README.md']) {
    assert.ok(sourceEntries.has(required), `${path.basename(SOURCE_ARCHIVE)} is missing ${required}`);
}

const landing = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
assert.ok(landing.includes(path.basename(OUTPUT)), 'project page does not name the unsigned AMO submission');
assert.ok(!landing.includes('RumbleX-firefox.zip'), 'project page still names the ambiguous legacy Firefox ZIP');
assert.ok(!/href=["'][^"']+\.xpi(?:[?#][^"']*)?["']/i.test(landing),
    'project page offers an XPI before a signed artifact has passed the package gate');

const explicitXpi = signedXpiArgument();
const xpi = explicitXpi || DEFAULT_XPI;
if (explicitXpi) assert.ok(fs.existsSync(xpi), `signed XPI does not exist: ${xpi}`);

if (fs.existsSync(xpi)) {
    const xpiEntries = readArchive(xpi);
    signatureEntriesPass(xpiEntries, xpi);
    assert.notEqual(Buffer.compare(fs.readFileSync(xpi), actual), 0,
        `${path.basename(xpi)} is byte-identical to the unsigned AMO submission`);
    console.log(`Firefox artifact guard OK: deterministic unsigned submission plus verified signature entries in ${path.basename(xpi)}.`);
} else {
    console.log('Firefox artifact guard OK: deterministic unsigned AMO submission; no installable XPI was emitted.');
}
