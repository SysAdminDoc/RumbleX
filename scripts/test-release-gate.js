#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const { runLocalRelease } = require('./release-local');
const { runVerification, SOURCE_STEPS } = require('./verify');

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
        return false;
    },
});

assert.equal(failedReleaseStatus, 1, 'A failed mandatory verification must fail the local release');
assert.equal(cleanCalls, 1, 'The release must clean stale packages before verification');
assert.deepEqual(releaseCalls, ['verify'], 'A failed verification must prevent the final build and archive checks');

console.log('Release gate OK: a deliberately failing guard prevents verification and release packaging.');
