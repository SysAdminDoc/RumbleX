#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
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
    const upperEntries = new Map([...entries].map(([name, data]) => [name.toUpperCase(), data]));
    const packageManifest = upperEntries.get('MANIFEST.JSON');
    assert.ok(packageManifest?.length, `${path.basename(file)} has no packaged manifest.json`);
    assert.equal(JSON.parse(packageManifest.toString('utf8')).manifest_version, 2,
        `${path.basename(file)} does not contain the Firefox MV2 manifest`);

    const digest = (data) => crypto.createHash('sha256').update(data).digest('base64');
    const hasManifestEntryDigest = (signedManifest) => {
        if (!signedManifest?.length) return false;
        const text = signedManifest.toString('utf8');
        const section = text.split(/\r?\n\r?\n/).find((part) => /^Name: manifest\.json\r?$/mi.test(part));
        const declared = section?.match(/^SHA256-Digest:\s*(\S+)\s*$/mi)?.[1];
        return !!declared && declared === digest(packageManifest);
    };

    const jarManifest = upperEntries.get('META-INF/MANIFEST.MF');
    let jarSigned = false;
    if (jarManifest?.length && hasManifestEntryDigest(jarManifest)) {
        const statements = [...upperEntries.entries()]
            .filter(([name]) => /^META-INF\/[^/]+\.SF$/.test(name));
        jarSigned = statements.some(([statementName, statement]) => {
            const stem = statementName.slice(0, -3);
            const block = ['.RSA', '.DSA', '.EC']
                .map((suffix) => upperEntries.get(stem + suffix))
                .find(Boolean);
            if (!statement?.length || !block || block.length < 512) return false;
            const text = statement.toString('utf8');
            const declared = text.match(/^SHA256-Digest-Manifest:\s*(\S+)\s*$/mi)?.[1];
            return /^Signature-Version:\s*1\.0\s*$/mi.test(text)
                && !!declared
                && declared === digest(jarManifest);
        });
    }

    const coseManifest = upperEntries.get('META-INF/COSE.MANIFEST');
    const coseSignature = upperEntries.get('META-INF/COSE.SIG');
    const coseSigned = !!coseSignature
        && coseSignature.length >= 512
        && hasManifestEntryDigest(coseManifest);

    assert.ok(jarSigned || coseSigned,
        `${path.basename(file)} has no internally consistent Mozilla JAR or COSE signature entry set`);
}

function assertSignatureGuardRejectsPlaceholders() {
    const packageManifest = Buffer.from('{"manifest_version":2}', 'utf8');
    const digest = (data) => crypto.createHash('sha256').update(data).digest('base64');
    const signedManifest = Buffer.from([
        'Manifest-Version: 1.0',
        '',
        'Name: manifest.json',
        `SHA256-Digest: ${digest(packageManifest)}`,
        '',
    ].join('\r\n'), 'utf8');
    const statement = Buffer.from([
        'Signature-Version: 1.0',
        `SHA256-Digest-Manifest: ${digest(signedManifest)}`,
        '',
    ].join('\r\n'), 'utf8');

    assert.throws(() => signatureEntriesPass(new Map([
        ['manifest.json', packageManifest],
        ['META-INF/MANIFEST.MF', Buffer.alloc(0)],
        ['META-INF/EMPTY.SF', Buffer.alloc(0)],
        ['META-INF/EMPTY.RSA', Buffer.alloc(0)],
    ]), 'empty-signature-fixture.xpi'), /no internally consistent Mozilla JAR or COSE signature/,
    'empty signature placeholders must not pass the installable-XPI gate');

    assert.throws(() => signatureEntriesPass(new Map([
        ['manifest.json', packageManifest],
        ['META-INF/MANIFEST.MF', signedManifest],
        ['META-INF/A.SF', statement],
        ['META-INF/B.RSA', Buffer.alloc(1024, 1)],
    ]), 'mismatched-signature-fixture.xpi'), /no internally consistent Mozilla JAR or COSE signature/,
    'unrelated statement and signature-block stems must not pass the installable-XPI gate');
}

assertSignatureGuardRejectsPlaceholders();

function assertSourceArchiveReproducesSubmission(sourceEntries, expectedArchive) {
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'rumblex-source-repro-'));
    try {
        for (const [name, data] of sourceEntries) {
            const target = path.resolve(stage, ...name.split('/'));
            assert.ok(target.startsWith(`${stage}${path.sep}`),
                `${path.basename(SOURCE_ARCHIVE)} contains an unsafe path: ${name}`);
            if (name.endsWith('/')) {
                fs.mkdirSync(target, { recursive: true });
                continue;
            }
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, data);
        }
        const build = spawnSync(process.execPath, ['scripts/build-firefox-amo.js'], {
            cwd: stage,
            encoding: 'utf8',
            timeout: 30000,
            windowsHide: true,
        });
        assert.equal(build.status, 0,
            `source archive could not run its Firefox builder:\n${build.stdout || ''}${build.stderr || ''}`);
        const reproduced = fs.readFileSync(path.join(stage, path.basename(OUTPUT)));
        assert.equal(Buffer.compare(reproduced, expectedArchive), 0,
            `${path.basename(SOURCE_ARCHIVE)} did not reproduce ${path.basename(OUTPUT)} byte-for-byte`);
    } finally {
        fs.rmSync(stage, { recursive: true, force: true, maxRetries: 2 });
    }
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
for (const required of [
    'extension/manifest-firefox.json',
    'extension/build.sh',
    'scripts/build-userscript.js',
    'scripts/build-firefox-amo.js',
    'scripts/zip-utils.js',
    'package.json',
    'LICENSE',
    'README.md',
]) {
    assert.ok(sourceEntries.has(required), `${path.basename(SOURCE_ARCHIVE)} is missing ${required}`);
}
assertSourceArchiveReproducesSubmission(sourceEntries, actual);

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
