#!/usr/bin/env node
'use strict';

// Every browser the test suite starts is headless unless someone asks for a
// visible run with RUMBLEX_HEADED=1.
//
// The failure this prevents: userscript-runtime.spec.js launched Chromium with
// `headless: false` and a window position of 0,0, so every `npm run verify`
// put a real browser window on the desktop of whoever ran it, in the middle of
// whatever they were doing. Nothing failed; the window just appeared.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.join(ROOT, 'tests', 'e2e');
const files = [
    path.join(ROOT, 'playwright.config.js'),
    ...fs.readdirSync(TEST_DIR).filter((name) => name.endsWith('.js')).map((name) => path.join(TEST_DIR, name)),
];

const offenders = [];
let launches = 0;
for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    source.split(/\r?\n/).forEach((line, index) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/\bheadless\s*:\s*false\b/.test(line)) offenders.push(`${relative}:${index + 1}: ${line.trim()}`);
        if (/\bheadless\s*:/.test(line)) launches += 1;
    });
}

assert.ok(launches > 0, 'found no headless settings at all; the scan is looking in the wrong place');
assert.deepEqual(offenders, [],
    'browsers pinned headed, which opens real windows on the desktop of whoever runs the suite. '
    + 'Use `headless: process.env.RUMBLEX_HEADED !== \'1\'` instead:\n' + offenders.join('\n'));

console.log(`Headless guard OK: ${launches} browser launch settings across ${files.length} files, none pinned headed.`);
