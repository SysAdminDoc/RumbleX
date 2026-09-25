#!/usr/bin/env node
'use strict';

const {
    buildStep,
    cleanReleaseArtifacts,
    nodeStep,
    runStep,
} = require('./local-workflow');

const VERIFY_STEP = nodeStep('verify', 'Mandatory local verification', 'scripts/verify.js');
const RELEASE_TREE_STEP = nodeStep('release-tree', 'Clean release tree', 'scripts/check-release-tree.js');
const FINAL_ARTIFACT_STEPS = Object.freeze([
    nodeStep('final-package-contents', 'Final packaged runtime contents', 'scripts/check-package-contents.js'),
    nodeStep('final-firefox-artifacts', 'Final Firefox archive bytes and signatures', 'scripts/check-firefox-artifacts.js'),
]);

function runLocalRelease({ clean = cleanReleaseArtifacts, execute = runStep } = {}) {
    if (!execute(RELEASE_TREE_STEP)) return 1;
    clean();
    if (!execute(VERIFY_STEP)) return 1;

    clean();
    if (!execute(buildStep())) return 1;

    for (const step of FINAL_ARTIFACT_STEPS) {
        if (!execute(step)) return 1;
    }

    console.log('\n[release] Clean local release artifacts are verified and ready.');
    return 0;
}

if (require.main === module) {
    process.exitCode = runLocalRelease();
}

module.exports = {
    FINAL_ARTIFACT_STEPS,
    RELEASE_TREE_STEP,
    VERIFY_STEP,
    runLocalRelease,
};
