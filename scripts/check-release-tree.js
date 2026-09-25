#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function releaseTreeStatus({ spawn = spawnSync } = {}) {
    const result = spawn('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
    });
    if (result.error) return { ok: false, reason: `git status could not start: ${result.error.message}`, paths: [] };
    if (result.status !== 0) {
        const detail = String(result.stderr || result.stdout || '').trim();
        return { ok: false, reason: `git status failed${detail ? `: ${detail}` : ''}`, paths: [] };
    }
    const paths = String(result.stdout || '').split(/\r?\n/).filter(Boolean);
    return paths.length
        ? { ok: false, reason: 'the release tree has tracked or untracked changes', paths }
        : { ok: true, reason: '', paths: [] };
}

function checkReleaseTree(options) {
    const status = releaseTreeStatus(options);
    if (status.ok) {
        console.log('Release tree guard OK: the repository is clean.');
        return true;
    }
    console.error(`[!] Refusing to package: ${status.reason}.`);
    for (const line of status.paths.slice(0, 40)) console.error(`    ${line}`);
    if (status.paths.length > 40) console.error(`    ...and ${status.paths.length - 40} more path(s)`);
    return false;
}

if (require.main === module) process.exitCode = checkReleaseTree() ? 0 : 1;

module.exports = { checkReleaseTree, releaseTreeStatus };
