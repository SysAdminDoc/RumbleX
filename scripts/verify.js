#!/usr/bin/env node
'use strict';

const {
    buildStep,
    nodeStep,
    playwrightStep,
    pythonStep,
    runStep,
} = require('./local-workflow');

const SOURCE_STEPS = Object.freeze([
    nodeStep('userscript-source', 'Generated userscript source', 'scripts/build-userscript.js', ['--check']),
    nodeStep('dom-sinks', 'DOM sink policy', 'scripts/check-dom-sinks.js'),
    nodeStep('manifest-privacy', 'Manifest privacy policy', 'scripts/check-manifest-privacy.js'),
    nodeStep('i18n', 'Locale catalog integrity', 'scripts/check-i18n.js'),
    nodeStep('userscript-parity', 'Userscript runtime parity', 'scripts/check-userscript-parity.js'),
    nodeStep('userscript-platform', 'Userscript platform contract', 'scripts/test-userscript-platform.js'),
    nodeStep('extension-platform', 'Extension platform contract', 'scripts/test-extension-platform.js'),
    nodeStep('github-permission', 'GitHub optional permission contract', 'scripts/test-github-permission.js'),
    nodeStep('message-boundary', 'Runtime message boundary', 'scripts/check-message-boundary.js'),
    nodeStep('settings-schema', 'Settings schema contract', 'scripts/test-settings-schema.js'),
    nodeStep('settings-consumers', 'Settings consumer registry', 'scripts/check-settings-consumers.js'),
    nodeStep('feature-catalog', 'Feature catalog integrity', 'scripts/test-feature-catalog.js'),
    nodeStep('ad-blocking', 'Ad-blocking contract', 'scripts/test-ad-blocking.js'),
    nodeStep('a11y-controls', 'Injected control accessibility', 'scripts/check-a11y-controls.js'),
    nodeStep('content-literals', 'Content literal policy', 'scripts/check-content-literals.js'),
    nodeStep('content-locale', 'Content locale synchronization', 'scripts/sync-content-locale.js'),
    nodeStep('store-listing', 'Store and public metadata', 'scripts/check-store-listing.js'),
    nodeStep('update-manifest', 'Firefox update manifest', 'scripts/build-update-manifest.js', ['--check']),
    nodeStep('vendor-manifest', 'Vendored library provenance', 'scripts/check-vendor-manifest.js'),
    nodeStep('release-gate', 'Release gate regression', 'scripts/test-release-gate.js'),
    pythonStep(),
    nodeStep('firefox-smoke', 'Headless Firefox extension smoke', 'scripts/test-firefox-extension.js'),
    playwrightStep(),
]);

const ARTIFACT_STEPS = Object.freeze([
    nodeStep('package-contents', 'Packaged runtime contents', 'scripts/check-package-contents.js'),
    nodeStep('firefox-artifacts', 'Firefox archive bytes and signatures', 'scripts/check-firefox-artifacts.js'),
]);

function runVerification({ execute = runStep, sourceSteps = SOURCE_STEPS, packageBuild = buildStep(), artifactSteps = ARTIFACT_STEPS } = {}) {
    for (const step of sourceSteps) {
        if (!execute(step)) return 1;
    }

    if (!execute(packageBuild)) return 1;

    for (const step of artifactSteps) {
        if (!execute(step)) return 1;
    }

    console.log('\n[verify] All mandatory local checks passed.');
    return 0;
}

if (require.main === module) {
    process.exitCode = runVerification();
}

module.exports = {
    ARTIFACT_STEPS,
    SOURCE_STEPS,
    runVerification,
};
