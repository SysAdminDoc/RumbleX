#!/usr/bin/env node
'use strict';

// Installs a staged Firefox MV2 build as a temporary add-on, opens an
// isolated localhost page, and reports results from a real content-script
// context. The staging manifest adds only the localhost probe origin; the
// shipped manifests and source tree are never modified.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const EXTENSION = path.join(ROOT, 'extension');
const WEB_EXT_VERSION = '10.6.0';
const TIMEOUT_MS = Number(process.env.RUMBLEX_FIREFOX_SMOKE_TIMEOUT_MS) || 90000;

function findFirefoxBinary() {
    if (process.env.RUMBLEX_FIREFOX_BINARY) return process.env.RUMBLEX_FIREFOX_BINARY;
    if (process.platform !== 'win32') return 'firefox';
    const candidates = [
        path.join(process.env.ProgramFiles || '', 'Mozilla Firefox', 'firefox.exe'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'Mozilla Firefox', 'firefox.exe'),
    ];
    const installed = candidates.find((candidate) => candidate && fs.existsSync(candidate));
    if (installed) return installed;
    // Microsoft Store app-execution aliases are spawnable even though Node's
    // fs.existsSync() reports false for the WindowsApps proxy.
    if (process.env.LOCALAPPDATA) {
        return path.join(process.env.LOCALAPPDATA, 'Microsoft', 'WindowsApps', 'firefox.exe');
    }
    return 'firefox';
}

const FIREFOX_BINARY = findFirefoxBinary();

function stageExtension(baseUrl) {
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'rumblex-firefox-smoke-'));
    fs.cpSync(EXTENSION, stage, {
        recursive: true,
        filter: (source) => !/manifest-chrome-backup\.json$/.test(source) && !/build\.sh$/.test(source),
    });

    const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'manifest-firefox.json'), 'utf8'));
    // WebExtension match patterns do not include ports; this loopback-only
    // host pattern covers the ephemeral HTTP server port used by the probe.
    const originPattern = 'http://127.0.0.1/*';
    if (!manifest.permissions.includes(originPattern)) manifest.permissions.push(originPattern);
    manifest.content_scripts.push({
        matches: [originPattern],
        js: ['browser-polyfill.js', 'platform.js', 'firefox-smoke-probe.js'],
        run_at: 'document_start',
        all_frames: false,
    });
    fs.writeFileSync(path.join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    const reportUrl = `${baseUrl}result`;
    const probe = `
'use strict';
(async () => {
    const result = { injected: true };
    try {
        const platform = globalThis.RumbleXPlatform;
        result.platform = platform?.kind || null;
        result.version = platform?.version || null;
        result.requestBlocking = platform?.capabilities?.requestBlocking === true;
        result.requestBlockingMode = platform?.capabilities?.requestBlockingMode || null;

        const key = 'rx_firefox_smoke_value';
        const value = 'firefox-mv2-' + Date.now();
        await platform.storage.set({ [key]: value });
        const stored = await platform.storage.get(key);
        result.storageRoundTrip = stored?.[key] === value;
        await platform.storage.remove(key);
        const removed = await platform.storage.get(key);
        result.storageRemove = !Object.prototype.hasOwnProperty.call(removed || {}, key);

        const response = await platform.sendMessage({ action: 'getSettings' });
        result.responseMessage = !!response && typeof response === 'object';

        const asset = await platform.assetText('lib/mux.min.js');
        result.packagedAsset = typeof asset === 'string' && asset.length > 1000;
    } catch (error) {
        result.error = String(error?.stack || error);
    }
    fetch(${JSON.stringify(reportUrl)} + '?' + new URLSearchParams(result), {
        method: 'GET',
        cache: 'no-store',
    }).catch(() => {});
})();
`;
    fs.writeFileSync(path.join(stage, 'firefox-smoke-probe.js'), probe);
    return stage;
}

function stopProcessTree(child) {
    if (!child || child.exitCode !== null) return;
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true,
            timeout: 5000,
        });
    } else {
        try { child.kill('SIGTERM'); } catch {}
    }
}

async function main() {
    let resolveResult;
    let rejectResult;
    const resultPromise = new Promise((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
    });

    const token = Math.random().toString(36).slice(2);
    const server = http.createServer((request, response) => {
        const url = new URL(request.url, 'http://127.0.0.1');
        if (url.pathname === '/result') {
            const result = Object.fromEntries(url.searchParams);
            response.writeHead(204);
            response.end();
            resolveResult(result);
            return;
        }
        response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
        });
        response.end(`<!doctype html><html><head><title>RumbleX Firefox smoke ${token}</title></head><body>Firefox smoke</body></html>`);
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}/`;
    const stage = stageExtension(baseUrl);
    const npxCli = process.platform === 'win32'
        ? path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')
        : null;
    const command = npxCli ? process.execPath : 'npx';
    const args = npxCli ? [npxCli] : [];
    const child = spawn(command, [...args,
        '--yes',
        `web-ext@${WEB_EXT_VERSION}`,
        'run',
        '--source-dir', stage,
        '--target', 'firefox-desktop',
        '--firefox', FIREFOX_BINARY,
        '--start-url', baseUrl,
        '--no-reload',
        '--no-input',
        '--arg=-headless',
    ], {
        cwd: ROOT,
        env: { ...process.env, NO_COLOR: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });

    let runnerLog = '';
    const collect = (chunk) => {
        runnerLog = (runnerLog + String(chunk)).slice(-12000);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', rejectResult);
    child.once('exit', (code) => {
        if (code && code !== 0) rejectResult(new Error(`web-ext exited ${code}\n${runnerLog}`));
    });

    const timer = setTimeout(() => {
        rejectResult(new Error(`Firefox smoke timed out after ${TIMEOUT_MS} ms\n${runnerLog}`));
    }, TIMEOUT_MS);

    try {
        const result = await resultPromise;
        clearTimeout(timer);
        const expectedVersion = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'manifest-firefox.json'), 'utf8')).version;
        const failures = [];
        for (const key of ['injected', 'storageRoundTrip', 'storageRemove', 'responseMessage', 'packagedAsset', 'requestBlocking']) {
            if (result[key] !== 'true') failures.push(`${key}=${result[key] || 'missing'}`);
        }
        if (result.platform !== 'extension') failures.push(`platform=${result.platform || 'missing'}`);
        if (result.requestBlockingMode !== 'firefox-webrequest') failures.push(`requestBlockingMode=${result.requestBlockingMode || 'missing'}`);
        if (result.version !== expectedVersion) failures.push(`version=${result.version || 'missing'} (expected ${expectedVersion})`);
        if (result.error) failures.push(`runtime=${result.error}`);
        if (failures.length) throw new Error(`Firefox MV2 smoke failed: ${failures.join(', ')}\n${runnerLog}`);
        console.log(`Firefox MV2 smoke passed (v${expectedVersion}): storage, removal, messaging, packaged asset, content injection.`);
    } finally {
        clearTimeout(timer);
        stopProcessTree(child);
        server.closeAllConnections?.();
        await Promise.race([
            new Promise((resolve) => server.close(resolve)),
            new Promise((resolve) => setTimeout(resolve, 1000)),
        ]);
        try { fs.rmSync(stage, { recursive: true, force: true, maxRetries: 2 }); } catch {}
    }
}

main().then(
    () => process.exit(0),
    (error) => {
        console.error(error?.stack || error);
        process.exit(1);
    },
);
