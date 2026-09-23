// @ts-check
// What RumbleX costs before any module mounts: parsing and evaluating its
// content scripts at document_start, on every rumble.com page, measured from a
// Chromium trace of the page's own frame.
//
// The budget is deliberately several times the measured cost. It is there to
// catch a multiplicative regression (a table built eagerly at the top level,
// a synchronous scan at load, a duplicated bundle), not to fail on a busy
// machine. The measured numbers are printed with every run and recorded in
// CHANGELOG.md, so a later change in them is attributable.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'platform');
const CONTENT_SCRIPTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'manifest.json'), 'utf8'))
    .content_scripts.find((entry) => entry.run_at === 'document_start').js;
const PAGES = {
    home: { file: 'desktop-home.html', route: '/' },
    watch: { file: 'offline-watch.html', route: '/vcoldstart-watch.html' },
    search: { file: 'desktop-search.html', route: '/search/video?q=cold' },
    channel: { file: 'desktop-channel.html', route: '/c/cold-start' },
};
const BUDGET = Object.freeze({
    // Script evaluation for every content script, one page load.
    evaluateMs: 45,
    // The longest main-thread task that runs any of them.
    longestTaskMs: 60,
});

async function measure(context, extensionId, { file, route }) {
    const html = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8');
    const page = await context.newPage();
    await page.route('**/*', (r) => (r.request().isNavigationRequest() && r.request().url().startsWith('https://rumble.com/')
        ? r.fulfill({ status: 200, contentType: 'text/html', body: html })
        : r.abort()));
    const cdp = await context.newCDPSession(page);
    const events = [];
    cdp.on('Tracing.dataCollected', (chunk) => events.push(...chunk.value));
    const complete = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.start', {
        traceConfig: { includedCategories: ['devtools.timeline', 'v8', 'disabled-by-default-devtools.timeline'] },
        transferMode: 'ReportEvents',
    });
    await page.goto(`https://rumble.com${route}`, { waitUntil: 'load' });
    await page.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });
    await cdp.send('Tracing.end');
    await complete;
    const { frameTree } = await cdp.send('Page.getFrameTree');
    const frameId = frameTree.frame.id;
    await page.close();

    const prefix = `chrome-extension://${extensionId}/`;
    // Only this page's frame: a fresh profile also has the extension's own
    // welcome page open, whose scripts show up in the same trace.
    const evaluations = events.filter((event) => event.name === 'EvaluateScript'
        && event.args?.data?.frame === frameId
        && String(event.args?.data?.url || '').startsWith(prefix));
    const byFile = {};
    for (const event of evaluations) {
        const name = event.args.data.url.slice(prefix.length);
        byFile[name] = Math.round(((byFile[name] || 0) + (event.dur || 0) / 1000) * 100) / 100;
    }
    const thread = evaluations[0]?.tid;
    const tasks = events.filter((event) => event.name === 'RunTask' && event.ph === 'X' && event.tid === thread
        && evaluations.some((evaluation) => evaluation.ts >= event.ts && evaluation.ts <= event.ts + event.dur));
    return {
        byFile,
        evaluateMs: Math.round(Object.values(byFile).reduce((sum, ms) => sum + ms, 0) * 10) / 10,
        longestTaskMs: Math.round(Math.max(0, ...tasks.map((task) => task.dur / 1000)) * 10) / 10,
    };
}

test('content scripts stay inside their document_start budget on home, watch, search and channel pages', async ({ context, extensionId }) => {
    test.setTimeout(120_000);
    const results = {};
    for (const [kind, spec] of Object.entries(PAGES)) results[kind] = await measure(context, extensionId, spec);
    // Printed on every run: the numbers CHANGELOG.md records and a regression
    // report would quote.
    console.log(`[cold-start] ${JSON.stringify(Object.fromEntries(Object.entries(results)
        .map(([kind, result]) => [kind, { evaluateMs: result.evaluateMs, longestTaskMs: result.longestTaskMs }])))}`);

    for (const [kind, result] of Object.entries(results)) {
        // Positive control: every injected file was traced, on this page.
        expect(Object.keys(result.byFile).sort(), `${kind}: traced files`).toEqual([...CONTENT_SCRIPTS].sort());
        expect(result.evaluateMs, `${kind}: evaluation ${JSON.stringify(result.byFile)}`).toBeLessThanOrEqual(BUDGET.evaluateMs);
        expect(result.longestTaskMs, `${kind}: longest task`).toBeLessThanOrEqual(BUDGET.longestTaskMs);
        expect(result.longestTaskMs, `${kind}: the task has to contain the evaluation`).toBeGreaterThanOrEqual(result.byFile['content.js']);
    }
});
