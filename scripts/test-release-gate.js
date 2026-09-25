#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { RELEASE_TREE_STEP, runLocalRelease } = require('./release-local');
const { releaseTreeStatus } = require('./check-release-tree');
const { runVerification, SOURCE_STEPS } = require('./verify');
const { createFirefoxArchive } = require('./build-firefox-amo');
const { readArchiveBuffer } = require('./zip-utils');

const verificationCalls = [];
const failedGuardStatus = runVerification({
    execute(step) {
        verificationCalls.push(step.id);
        return false;
    },
});

assert.equal(failedGuardStatus, 1, 'A failing source guard must return the shared failure code');
assert.deepEqual(verificationCalls, [SOURCE_STEPS[0].id], 'Verification must stop at the first failed guard');
assert.ok(!verificationCalls.includes('build-packages'), 'A failed source guard must prevent packaging');

const releaseCalls = [];
let cleanCalls = 0;
const failedReleaseStatus = runLocalRelease({
    clean() { cleanCalls += 1; },
    execute(step) {
        releaseCalls.push(step.id);
        return step.id !== 'verify';
    },
});

assert.equal(failedReleaseStatus, 1, 'A failed mandatory verification must fail the local release');
assert.equal(cleanCalls, 1, 'The release must clean stale packages before verification');
assert.deepEqual(releaseCalls, [RELEASE_TREE_STEP.id, 'verify'],
    'the clean-tree guard must run before cleanup, and a failed verification must prevent packaging');

const fakeGit = (stdout, status = 0) => () => ({ status, stdout, stderr: '', error: null });
assert.equal(releaseTreeStatus({ spawn: fakeGit('') }).ok, true, 'a clean tree must pass the release guard');
const dirtyTree = releaseTreeStatus({ spawn: fakeGit(' M extension/content.js\n?? extension/private.txt\n') });
assert.equal(dirtyTree.ok, false, 'tracked or untracked source changes must block a release');
assert.deepEqual(dirtyTree.paths, [' M extension/content.js', '?? extension/private.txt']);

const packageProbe = path.join(__dirname, '..', 'extension', 'pages', '.untracked-package-probe');
assert.ok(!fs.existsSync(packageProbe), 'package probe path already exists');
try {
    fs.writeFileSync(packageProbe, 'must not ship\n');
    const entries = readArchiveBuffer(createFirefoxArchive(), 'untracked-package-probe.zip');
    assert.equal(entries.has('pages/.untracked-package-probe'), false,
        'an untracked file inside a declared runtime directory leaked into the Firefox package');
} finally {
    fs.rmSync(packageProbe, { force: true });
}

const buildScript = fs.readFileSync(path.join(__dirname, '..', 'extension', 'build.sh'), 'utf8');
assert.match(buildScript, /git -C \.\. ls-files -- "extension\/\$item"/,
    'browser package staging must enumerate tracked directory files');
assert.doesNotMatch(buildScript, /cp -R \. "\$stage\/extension\//,
    'the source archive must not copy the whole local extension directory');


// The selector harness exits 2 when the private Sample Pages/ captures are
// absent unless it is told they are optional, which is every machine except
// the maintainer's. Without the flag the mandatory gate cannot pass on a clone,
// while the README says it can.
const { pythonStep, RELEASE_ARTIFACTS } = require('./local-workflow');
const selectorStep = pythonStep();
assert.ok(selectorStep.args.includes('--allow-missing-fixtures'),
    'the selector-contracts step must tolerate a missing Sample Pages/, or npm run verify cannot pass on a clean clone');
assert.ok(RELEASE_ARTIFACTS.includes('RumbleX-chrome.crx'),
    'release cleanup must remove the current CRX before rebuilding it');
assert.ok(RELEASE_ARTIFACTS.includes('RumbleX-v1.9.3.crx'),
    'release cleanup must remove the obsolete legacy CRX');

console.log('Release gate OK: a deliberately failing guard prevents verification and release packaging.');
