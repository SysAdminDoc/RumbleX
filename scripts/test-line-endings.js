#!/usr/bin/env node
'use strict';

// Every guard that compares bytes has to judge content, not how the checkout
// spelled its line endings.
//
// The failure this prevents: `.gitattributes` was `* text=auto` alone, so a
// Windows clone wrote every text file with CRLF while the repository stores
// LF. Three guards compared raw bytes and failed on a tree where nothing was
// wrong: the generated userscripts read as stale, the offline fixture missed
// its recorded hash (which had itself been taken from a CRLF copy, so every
// LF checkout failed it instead), and the vendored libraries missed the
// SHA-256 pins taken from the npm tarballs. `npm run verify` could not pass on
// a fresh clone on either platform.
//
// This copies each guard's inputs to a scratch root, rewrites the text files
// the way a CRLF checkout would, runs the real guard scripts there, and checks
// that a genuinely stale or hand-edited file still fails.

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const COPY = [
    'package.json',
    'RumbleX.user.js',
    'RumbleX.lite.user.js',
    'extension',
    'userscript',
    'scripts',
    path.join('tests', 'fixtures', 'platform'),
];
const TEXT = /\.(?:js|mjs|json|html|css|txt|sha256)$/i;

function copyTree(from, to) {
    const stat = fs.statSync(from);
    if (stat.isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        for (const entry of fs.readdirSync(from)) {
            if (entry === '_metadata') continue;
            copyTree(path.join(from, entry), path.join(to, entry));
        }
    } else {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
    }
}

// What a Windows checkout under the old attributes did to every text file.
function toCrlf(root, relative) {
    const full = path.join(root, relative);
    if (fs.statSync(full).isDirectory()) {
        return fs.readdirSync(full).reduce((sum, entry) => sum + toCrlf(root, path.join(relative, entry)), 0);
    }
    if (!TEXT.test(full)) return 0;
    // Vendored libraries are marked -text, so git never converts them. The
    // attribute check below proves that; converting them here would only prove
    // that a pin fails when its file changes.
    if (relative.split(path.sep).join('/').startsWith('extension/lib/')) return 0;
    const text = fs.readFileSync(full, 'utf8');
    const converted = text.replace(/\r?\n/g, '\r\n');
    if (converted === text) return 0;
    fs.writeFileSync(full, converted);
    return 1;
}

function run(root, script, args = []) {
    const result = spawnSync(process.execPath, [path.join(root, 'scripts', script), ...args], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
    });
    return { status: result.status, output: `${result.stdout || ''}${result.stderr || ''}`.trim() };
}

const GUARDS = [
    ['build-userscript.js', ['--check']],
    ['build-offline-fixture.js', ['--check']],
    ['check-vendor-manifest.js', []],
];

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rumblex-eol-'));
try {
    for (const entry of COPY) copyTree(path.join(ROOT, entry), path.join(scratch, entry));

    // Control: the untouched copy passes every guard, so a failure below is
    // the line endings and not a broken copy.
    for (const [script, args] of GUARDS) {
        const result = run(scratch, script, args);
        assert.equal(result.status, 0, `${script} fails on an unmodified copy:\n${result.output}`);
    }

    let converted = 0;
    for (const entry of COPY) converted += toCrlf(scratch, entry);
    assert.ok(converted > 50, `expected a CRLF copy of every text file, converted only ${converted}`);
    const userscript = fs.readFileSync(path.join(scratch, 'RumbleX.user.js'), 'utf8');
    assert.ok(userscript.includes('\r\n'), 'the generated userscript was not converted, so this test proves nothing');

    for (const [script, args] of GUARDS) {
        const result = run(scratch, script, args);
        assert.equal(result.status, 0, `${script} rejects a CRLF checkout of an unchanged tree:\n${result.output}`);
    }

    // Tolerating CRLF must not mean tolerating change.
    fs.writeFileSync(path.join(scratch, 'RumbleX.user.js'), userscript.replace('// @version', '// @version  '));
    assert.notEqual(run(scratch, 'build-userscript.js', ['--check']).status, 0,
        'a genuinely stale userscript passed the check');
    const fixture = path.join(scratch, 'tests', 'fixtures', 'platform', 'offline-watch.html');
    fs.writeFileSync(fixture, `${fs.readFileSync(fixture, 'utf8')}<!-- hand edit -->\r\n`);
    assert.notEqual(run(scratch, 'build-offline-fixture.js', ['--check']).status, 0,
        'a hand-edited offline fixture passed the check');
} finally {
    fs.rmSync(scratch, { recursive: true, force: true });
}

// The vendored libraries are pinned to the exact bytes of their npm tarballs,
// so no checkout may rewrite them, and every other text file must check out
// with the LF the repository stores.
const attributes = spawnSync('git', ['check-attr', 'text', 'eol', '--',
    'extension/lib/mux.min.js', 'extension/lib/mediabunny.min.mjs', 'RumbleX.user.js',
    'tests/fixtures/platform/offline-watch.html'], { cwd: ROOT, encoding: 'utf8', windowsHide: true });
if (attributes.status === 0) {
    const lines = attributes.stdout.trim().split(/\r?\n/);
    const value = (file, attribute) => lines
        .find((line) => line.startsWith(`${file}: ${attribute}: `))
        ?.slice(`${file}: ${attribute}: `.length);
    for (const lib of ['extension/lib/mux.min.js', 'extension/lib/mediabunny.min.mjs']) {
        assert.equal(value(lib, 'text'), 'unset', `${lib} must be -text in .gitattributes`);
    }
    for (const file of ['RumbleX.user.js', 'tests/fixtures/platform/offline-watch.html']) {
        assert.equal(value(file, 'eol'), 'lf', `${file} must check out with eol=lf`);
    }
} else {
    console.log('Line-ending guard: git is unavailable here, skipping the attribute half.');
}

console.log('Line-ending guard OK: userscript, offline fixture and vendor pins judge content, not CRLF; attributes pin LF and leave vendored bytes alone.');
