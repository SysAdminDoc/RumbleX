// @ts-check
// The frame budget report end to end: a real slow scan on a real Rumble tab,
// exported from Options, and nothing at all while the setting is off.
const { test, expect } = require('./_fixtures');
const fs = require('fs');
const path = require('path');

const OFFLINE_RUMBLE_FIXTURE = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'platform', 'offline-watch.html'), 'utf8');

async function readDownload(download) {
    const file = await download.path();
    return fs.readFileSync(file, 'utf8');
}

test('the frame budget report exports slow scans by module only once it is turned on', async ({ context, extensionId }) => {
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await options.evaluate(() => chrome.storage.local.set({ rx_settings: { debugPerfBudget: false } }));

    const rumble = await context.newPage();
    await rumble.route('**/*', (route) => {
        if (route.request().isNavigationRequest() && route.request().url().startsWith('https://rumble.com/')) {
            return route.fulfill({ status: 200, contentType: 'text/html', body: OFFLINE_RUMBLE_FIXTURE });
        }
        return route.abort();
    });
    await rumble.goto('https://rumble.com/vframe-budget-fixture.html', { waitUntil: 'domcontentloaded' });
    await rumble.waitForSelector('#rx-settings-btn', { state: 'attached', timeout: 15_000 });

    // One genuinely slow scan, scheduled the way every module schedules its
    // own, so it is timed and attributed by the production path.
    const slowScan = () => options.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ url: ['*://rumble.com/*'] });
        const [execution] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            world: 'ISOLATED',
            func: () => new Promise((resolve) => {
                scheduleFeatureFrame(ExactCounts, 'budget-probe', () => {
                    const until = performance.now() + 25;
                    while (performance.now() < until) { /* hold the frame */ }
                });
                requestAnimationFrame(() => requestAnimationFrame(() => resolve(RxPerfBudget.scans().exactCounts || 0)));
            }),
        });
        return execution.result;
    });

    await options.locator('#privacy-section summary').click();

    // Off: the scan is still counted in memory, but nothing leaves the page.
    expect(await slowScan()).toBeGreaterThan(0);
    let downloaded = false;
    options.on('download', () => { downloaded = true; });
    await options.locator('#perfreport-export-btn').click();
    await expect(options.locator('#status')).toContainText('Turn on Frame Budget Report first');
    expect(downloaded).toBe(false);

    // On: the next slow scan is kept and exported, with its module and route.
    await options.evaluate(() => chrome.storage.local.set({ rx_settings: { debugPerfBudget: true } }));
    await expect.poll(slowScan).toBeGreaterThan(1);
    const download = options.waitForEvent('download');
    await options.locator('#perfreport-export-btn').click();
    const exported = await download;
    expect(exported.suggestedFilename()).toMatch(/^rumblex-frame-budget-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
    const report = JSON.parse(await readDownload(exported));
    expect(report.budgetMs).toBe(16);
    expect(report.modules.some((row) => row.module === 'exactCounts' && row.maxMs >= 20)).toBe(true);
    const slow = report.slow.filter((entry) => entry.key === 'budget-probe');
    expect(slow.length).toBeGreaterThan(0);
    // The offline capture carries a chat list, which is what makes a watch
    // page classify as live.
    expect(slow[0]).toMatchObject({ module: 'exactCounts', route: 'live' });
    expect(slow[0].ms).toBeGreaterThanOrEqual(20);
    await expect(options.locator('#status')).toContainText('Frame budget report exported');
});
