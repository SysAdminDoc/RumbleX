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
const { createDeterministicZip } = require('./zip-utils');

const ROOT = path.resolve(__dirname, '..');
const EXTENSION = path.join(ROOT, 'extension');
const WEB_EXT_VERSION = '10.6.0';
const TIMEOUT_MS = Number(process.env.RUMBLEX_FIREFOX_SMOKE_TIMEOUT_MS) || 90000;
const WEBDRIVER_ELEMENT_KEY = 'element-6066-11e4-a52e-4f735466cecf';

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
const GECKODRIVER_BINARY = process.env.RUMBLEX_GECKODRIVER_BINARY || 'geckodriver';
const GITHUB_API_ORIGIN = 'https://api.github.com/*';

function stageExtension(baseUrl) {
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'rumblex-firefox-smoke-'));
    fs.cpSync(EXTENSION, stage, {
        recursive: true,
        filter: (source) => !/manifest-chrome-backup\.json$/.test(source) && !/build\.sh$/.test(source),
    });

    const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'manifest-firefox.json'), 'utf8'));
    if (!(manifest.optional_permissions || []).includes(GITHUB_API_ORIGIN)) {
        throw new Error('Firefox manifest does not declare GitHub as an optional permission');
    }
    // WebExtension match patterns do not include ports; this loopback-only
    // host pattern covers the ephemeral HTTP server port used by the probe.
    const originPattern = 'http://127.0.0.1/*';
    if (!manifest.permissions.includes(originPattern)) manifest.permissions.push(originPattern);
    const runtimeEntry = manifest.content_scripts.find((entry) =>
        entry.matches?.some((match) => match.includes('rumble.com')));
    if (!runtimeEntry?.js?.length) throw new Error('Firefox manifest has no Rumble runtime script list');
    manifest.background.scripts.push('pages/github-permission.js', 'firefox-smoke-permission-background.js');
    manifest.content_scripts.push({
        matches: [originPattern],
        js: ['firefox-smoke-bootstrap.js', ...runtimeEntry.js, 'firefox-smoke-probe.js'],
        run_at: 'document_start',
        all_frames: false,
    });
    fs.writeFileSync(path.join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    const reportUrl = `${baseUrl}result`;
    const bootstrap = `
'use strict';
(() => {
    let sent = false;
    const reportUrl = ${JSON.stringify(reportUrl)};
    const send = (result) => {
        if (sent) return;
        sent = true;
        const safe = {};
        for (const [key, value] of Object.entries(result || {})) {
            safe[key] = String(value).slice(0, 2000);
        }
        fetch(reportUrl + '?' + new URLSearchParams(safe), {
            method: 'GET',
            cache: 'no-store',
        }).catch(() => {});
    };
    Object.defineProperty(globalThis, '__rxFirefoxSmokeReport', {
        value: send,
        configurable: true,
    });
    const exposePermissionPage = () => {
        document.documentElement?.setAttribute(
            'data-rx-firefox-permission-page',
            browser.runtime.getURL('firefox-smoke-permission.html'),
        );
    };
    exposePermissionPage();
    addEventListener('DOMContentLoaded', exposePermissionPage, { once: true });
    addEventListener('error', (event) => send({
        injected: true,
        error: 'content error: ' + String(event.error?.stack || event.message || 'unknown'),
    }), { once: true });
    addEventListener('unhandledrejection', (event) => send({
        injected: true,
        error: 'unhandled rejection: ' + String(event.reason?.stack || event.reason || 'unknown'),
    }), { once: true });
    setTimeout(() => send({
        injected: true,
        error: 'production runtime did not reach the Firefox smoke probe within 15 seconds',
    }), 15000);
})();
`;
    fs.writeFileSync(path.join(stage, 'firefox-smoke-bootstrap.js'), bootstrap);
    const permissionBackground = `
'use strict';
browser.runtime.onMessage.addListener((message) => {
    if (message?.action !== 'firefoxSmokeGithubPermission') return undefined;
    return (async () => {
        return {
            api: typeof browser.permissions?.request === 'function'
                && typeof browser.permissions?.contains === 'function',
            granted: await globalThis.RumbleXGithubPermission.containsGithubApi(),
        };
    })();
});
`;
    fs.writeFileSync(path.join(stage, 'firefox-smoke-permission-background.js'), permissionBackground);
    fs.writeFileSync(path.join(stage, 'firefox-smoke-permission.html'), `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>RumbleX optional permission smoke</title></head>
<body>
<button id="request-github" type="button">Grant GitHub API access</button>
<script src="pages/github-permission.js"></script>
<script src="firefox-smoke-permission-page.js"></script>
</body>
</html>\n`);
    fs.writeFileSync(path.join(stage, 'firefox-smoke-permission-page.js'), `
'use strict';
document.querySelector('#request-github').addEventListener('click', async () => {
    document.documentElement.dataset.rxFirefoxPermissionState = 'requesting';
    try {
        const request = globalThis.RumbleXGithubPermission.requestGithubApi();
        const requested = await request;
        const result = {
            requested: requested.granted === true,
            granted: await globalThis.RumbleXGithubPermission.containsGithubApi(),
        };
        document.documentElement.dataset.rxFirefoxPermissionResult = JSON.stringify(result);
    } catch (error) {
        document.documentElement.dataset.rxFirefoxPermissionResult = JSON.stringify({
            requested: false,
            granted: false,
            error: String(error?.stack || error),
        });
    }
}, { once: true });
`);
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
        result.settingsSchema = Object.keys(globalThis.RumbleXSettingsSchema?.DEFAULTS || {}).length >= 208;
        result.coreRuntime = [Page, Router, Selectors, VideoCards, MediaHelpers,
            PageData, MediaProbeCache, VideoDownloader]
            .every((value) => value && typeof value === 'object');
        result.routeBoundary = Page.classify() === 'home' && typeof Router.onChange === 'function';
        result.selectorBoundary = typeof Selectors.healthCheck === 'function';
        result.cardBoundary = typeof VideoCards.all === 'function';
        result.mediaBoundary = MediaHelpers.parseMasterPlaylist([
            '#EXTM3U',
            '#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360',
            'https://hugh.cdn.rumble.cloud/firefox-smoke/360.m3u8',
        ].join('\\n'), location.href).length === 1;
        result.contentRegistry = Array.isArray(features) && features.length >= 86;
        const githubPermission = await platform.sendMessage({ action: 'firefoxSmokeGithubPermission' });
        result.githubPermissionApi = githubPermission?.api === true;
        result.githubPermissionInitiallyAbsent = githubPermission?.granted === false;

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
    globalThis.__rxFirefoxSmokeReport(result);
})();
`;
    fs.writeFileSync(path.join(stage, 'firefox-smoke-probe.js'), probe);
    return stage;
}

function collectArchiveEntries(root) {
    const entries = [];
    const visit = (directory) => {
        for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, item.name);
            if (item.isDirectory()) visit(absolute);
            else if (item.isFile()) {
                entries.push({
                    name: path.relative(root, absolute).split(path.sep).join('/'),
                    data: fs.readFileSync(absolute),
                });
            }
        }
    };
    visit(root);
    return entries;
}

async function reserveLoopbackPort() {
    const server = http.createServer();
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const port = server.address().port;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    return port;
}

async function webdriverRequest(port, method, route, body) {
    let response;
    try {
        response = await fetch(`http://127.0.0.1:${port}${route}`, {
            method,
            headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(30000),
        });
    } catch (error) {
        throw new Error(`WebDriver ${method} ${route} request failed: ${error.message}`);
    }
    const text = await response.text();
    const payload = text ? JSON.parse(text) : { value: null };
    if (!response.ok || payload.value?.error) {
        throw new Error(`WebDriver ${method} ${route} failed (${response.status}): ${text}`);
    }
    return payload.value;
}

async function waitForWebdriver(port, child, log) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`geckodriver exited ${child.exitCode}\n${log()}`);
        try {
            const status = await webdriverRequest(port, 'GET', '/status');
            if (status?.ready) return;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`geckodriver did not become ready\n${log()}`);
}

async function waitForValue(read, description, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    let value;
    while (Date.now() < deadline) {
        value = await read();
        if (value) return value;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`timed out waiting for ${description}`);
}

async function runOptionalPermissionSmoke(stage, baseUrl) {
    const port = await reserveLoopbackPort();
    const xpi = path.join(os.tmpdir(), `rumblex-firefox-permission-${process.pid}-${Date.now()}.xpi`);
    fs.writeFileSync(xpi, createDeterministicZip(collectArchiveEntries(stage)));

    const child = spawn(GECKODRIVER_BINARY, [
        '--port', String(port),
        '--allow-system-access',
        '--log', 'error',
    ], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
    });
    let driverLog = '';
    const collect = (chunk) => {
        driverLog = (driverLog + String(chunk)).slice(-12000);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    let sessionId;
    try {
        await waitForWebdriver(port, child, () => driverLog);
        const session = await webdriverRequest(port, 'POST', '/session', {
            capabilities: {
                alwaysMatch: {
                    browserName: 'firefox',
                    'moz:firefoxOptions': {
                        binary: FIREFOX_BINARY,
                        args: ['-headless'],
                    },
                },
            },
        });
        sessionId = session.sessionId;
        const sessionRoute = `/session/${sessionId}`;
        await webdriverRequest(port, 'POST', `${sessionRoute}/moz/addon/install`, {
            path: xpi,
            temporary: true,
        });

        await webdriverRequest(port, 'POST', `${sessionRoute}/url`, { url: baseUrl });
        const permissionPage = await waitForValue(() => webdriverRequest(
            port,
            'POST',
            `${sessionRoute}/execute/sync`,
            {
                script: "return document.documentElement?.getAttribute('data-rx-firefox-permission-page') || null;",
                args: [],
            },
        ), 'the staged permission page URL');
        await webdriverRequest(port, 'POST', `${sessionRoute}/url`, { url: permissionPage });

        const element = await webdriverRequest(port, 'POST', `${sessionRoute}/element`, {
            using: 'css selector',
            value: '#request-github',
        });
        const elementId = element?.[WEBDRIVER_ELEMENT_KEY];
        if (!elementId) throw new Error('WebDriver did not return the optional-permission button');
        await webdriverRequest(port, 'POST', `${sessionRoute}/element/${encodeURIComponent(elementId)}/click`, {});

        await webdriverRequest(port, 'POST', `${sessionRoute}/moz/context`, { context: 'chrome' });
        const accepted = await waitForValue(() => webdriverRequest(
            port,
            'POST',
            `${sessionRoute}/execute/sync`,
            {
                script: `
const win = Services.wm.getMostRecentWindow('navigator:browser');
const notification = [...(win?.gBrowser?.browsers || [])]
    .map(browser => win.PopupNotifications.getNotification('addon-webext-permissions', browser))
    .find(Boolean);
if (!notification) return false;
notification.mainAction.callback();
notification.remove();
return true;
`,
                args: [],
            },
        ), 'the Firefox optional-permission prompt');
        if (!accepted) throw new Error('Firefox optional-permission prompt was not accepted');

        await webdriverRequest(port, 'POST', `${sessionRoute}/moz/context`, { context: 'content' });
        const serialized = await waitForValue(() => webdriverRequest(
            port,
            'POST',
            `${sessionRoute}/execute/sync`,
            {
                script: 'return document.documentElement?.dataset.rxFirefoxPermissionResult || null;',
                args: [],
            },
        ), 'the optional-permission result');
        const result = JSON.parse(serialized);
        if (!result.requested || !result.granted) {
            throw new Error(`Firefox optional-permission request failed: ${serialized}`);
        }
    } catch (error) {
        throw new Error(`${error.message}\n${driverLog}`);
    } finally {
        if (sessionId) {
            try { await webdriverRequest(port, 'DELETE', `/session/${sessionId}`); } catch {}
        }
        stopProcessTree(child);
        try { fs.rmSync(xpi, { force: true }); } catch {}
    }
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
        for (const key of [
            'injected', 'storageRoundTrip', 'storageRemove', 'responseMessage',
            'packagedAsset', 'requestBlocking', 'settingsSchema', 'coreRuntime',
            'routeBoundary', 'selectorBoundary', 'cardBoundary', 'mediaBoundary',
            'contentRegistry', 'githubPermissionApi', 'githubPermissionInitiallyAbsent',
        ]) {
            if (result[key] !== 'true') failures.push(`${key}=${result[key] || 'missing'}`);
        }
        if (result.platform !== 'extension') failures.push(`platform=${result.platform || 'missing'}`);
        if (result.requestBlockingMode !== 'firefox-webrequest') failures.push(`requestBlockingMode=${result.requestBlockingMode || 'missing'}`);
        if (result.version !== expectedVersion) failures.push(`version=${result.version || 'missing'} (expected ${expectedVersion})`);
        if (result.error) failures.push(`runtime=${result.error}`);
        if (failures.length) throw new Error(`Firefox MV2 smoke failed: ${failures.join(', ')}\n${runnerLog}`);
        stopProcessTree(child);
        await runOptionalPermissionSmoke(stage, baseUrl);
        console.log(`Firefox MV2 smoke passed (v${expectedVersion}): production core order, routing, selectors, cards, media, registry, storage, messaging, optional GitHub permission, and packaged assets.`);
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
