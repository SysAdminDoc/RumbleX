#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { readArchive } = require('./zip-utils');
const { verifyCrx3 } = require('./crx3-utils');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ZIP = path.join(ROOT, 'RumbleX-chrome.zip');
const OUTPUT = path.join(ROOT, 'RumbleX-chrome.crx');
const KEY = path.resolve(process.env.RUMBLEX_CRX_KEY || path.join(ROOT, 'RumbleX-selfhost.pem'));

function browserCandidates() {
    if (process.env.RUMBLEX_CHROMIUM) return [path.resolve(process.env.RUMBLEX_CHROMIUM)];
    if (process.platform === 'win32') {
        const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
        const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
        const localAppData = process.env.LOCALAPPDATA || '';
        return [
            path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
            path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
            path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
            localAppData && path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
            localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        ].filter(Boolean);
    }
    if (process.platform === 'darwin') {
        return [
            '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
        ];
    }
    return ['/usr/bin/brave-browser', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

function ensureKey() {
    if (fs.existsSync(KEY)) return false;
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    fs.writeFileSync(KEY, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    return true;
}

function extractPackage(destination) {
    for (const [name, data] of readArchive(SOURCE_ZIP)) {
        const target = path.resolve(destination, name);
        if (path.relative(destination, target).startsWith('..')) {
            throw new Error(`Chrome package contains an unsafe path: ${name}`);
        }
        if (name.endsWith('/')) {
            fs.mkdirSync(target, { recursive: true });
            continue;
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
    }
}

function validateCrx(file) {
    return verifyCrx3(fs.readFileSync(file));
}

function main() {
    if (!fs.existsSync(SOURCE_ZIP)) throw new Error('RumbleX-chrome.zip is missing; build the Chrome ZIP first');
    const browser = browserCandidates().find((candidate) => fs.existsSync(candidate));
    if (!browser) {
        throw new Error('Brave, Chrome, Edge or Chromium is required to build the signed CRX3 package');
    }

    const createdKey = ensureKey();
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rumblex-crx-'));
    const stage = path.join(temporary, 'RumbleX');
    fs.mkdirSync(stage);
    try {
        extractPackage(stage);
        const result = spawnSync(browser, [
            '--headless=new',
            '--disable-gpu',
            '--disable-background-networking',
            '--no-first-run',
            '--no-message-box',
            `--pack-extension=${stage}`,
            `--pack-extension-key=${KEY}`,
        ], { encoding: 'utf8', windowsHide: true, timeout: 120_000 });
        if (result.error) throw result.error;
        if (result.status !== 0) {
            throw new Error(`browser pack failed (${result.status}): ${result.stderr || result.stdout || 'no output'}`);
        }
        const packed = `${stage}.crx`;
        if (!fs.existsSync(packed)) {
            throw new Error(`browser pack produced no CRX: ${result.stderr || result.stdout || 'no output'}`);
        }
        validateCrx(packed);
        fs.rmSync(OUTPUT, { force: true });
        fs.copyFileSync(packed, OUTPUT);
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }

    console.log(`Wrote ${path.basename(OUTPUT)} (signed CRX3${createdKey ? ', new local key' : ''}).`);
    console.log('The ZIP remains the primary Chromium install package; policy-managed browsers may reject direct CRX installs.');
}

if (require.main === module) {
    try { main(); }
    catch (error) {
        console.error(`[!] ${error.message || error}`);
        process.exitCode = 1;
    }
}

module.exports = { browserCandidates, ensureKey, extractPackage, validateCrx };
