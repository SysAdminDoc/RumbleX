#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PLAYWRIGHT_CLI = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

const RELEASE_ARTIFACTS = Object.freeze([
    'RumbleX-chrome.zip',
    'RumbleX-firefox-amo-unsigned.zip',
    'RumbleX-source.zip',
    'RumbleX-firefox.zip',
    'RumbleX-firefox.xpi',
    'SHA256SUMS.txt.sig',
]);

function nodeStep(id, label, relativeScript, args = []) {
    return Object.freeze({
        id,
        label,
        command: process.execPath,
        args: [path.join(ROOT, relativeScript), ...args],
    });
}

function resolveBash({ env = process.env, platform = process.platform, existsSync = fs.existsSync } = {}) {
    if (env.RUMBLEX_BASH) return env.RUMBLEX_BASH;
    if (platform !== 'win32') return 'bash';

    const candidates = [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    ];
    return candidates.find((candidate) => existsSync(candidate)) || 'bash';
}

function buildStep() {
    return Object.freeze({
        id: 'build-packages',
        label: 'Build browser packages and userscripts',
        command: resolveBash(),
        args: ['extension/build.sh'],
    });
}

function pythonStep() {
    return Object.freeze({
        id: 'selector-contracts',
        label: 'Selector contracts',
        command: process.env.RUMBLEX_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),
        // The private MHTML captures in Sample Pages/ are gitignored, so a
        // clone does not have them and the gate has to run without them.
        // Without this flag the step exits 2 on any machine but the
        // maintainer's, which made `npm run verify` unpassable for everyone
        // else while the README claimed the opposite. The checked-in platform
        // contracts still run either way; only the private replay is skipped,
        // and the harness says so on stdout.
        args: ['test_selectors.py', '--allow-missing-fixtures'],
    });
}

function playwrightStep() {
    return Object.freeze({
        id: 'playwright',
        label: 'Headless Playwright suite',
        command: process.execPath,
        args: [PLAYWRIGHT_CLI, 'test'],
    });
}

function runStep(step, { spawn = spawnSync } = {}) {
    console.log(`\n[verify] ${step.label}`);
    const result = spawn(step.command, step.args, {
        cwd: ROOT,
        env: process.env,
        stdio: 'inherit',
        windowsHide: true,
    });

    if (result.error) {
        console.error(`[verify] ${step.id} could not start: ${result.error.message}`);
        return false;
    }
    if (result.status !== 0) {
        console.error(`[verify] ${step.id} failed with exit code ${result.status ?? 'unknown'}.`);
        return false;
    }
    return true;
}

function cleanReleaseArtifacts({ rmSync = fs.rmSync } = {}) {
    for (const name of RELEASE_ARTIFACTS) {
        const target = path.resolve(ROOT, name);
        if (path.dirname(target) !== ROOT) {
            throw new Error(`Refusing to clean an artifact outside the repository root: ${target}`);
        }
        rmSync(target, { force: true });
    }
    console.log(`[release] Cleaned ${RELEASE_ARTIFACTS.length} known package outputs.`);
}

module.exports = {
    ROOT,
    RELEASE_ARTIFACTS,
    buildStep,
    cleanReleaseArtifacts,
    nodeStep,
    playwrightStep,
    pythonStep,
    runStep,
};
