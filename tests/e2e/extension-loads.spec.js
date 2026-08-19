// @ts-check
// Smoke test: extension loads and registers a service worker.
const { test, expect } = require('./_fixtures');

test('extension service worker boots within 15s', async ({ serviceWorker, extensionId }) => {
    expect(serviceWorker).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/);
});

test('options page renders with snapshot + privacy sections', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    // App-bar version chip rendered from manifest
    await expect(page.locator('#version')).toHaveText(/^v\d+\.\d+\.\d+$/);
    // Stats overview present
    await expect(page.locator('#stat-features')).toBeVisible();
    // v3.1.0 backup snapshot section + v3.1.0 privacy report section present
    await expect(page.locator('#snapshot-section')).toBeVisible();
    await expect(page.locator('#privacy-section')).toBeVisible();
    // "Open Settings Editor" CTA exists
    await expect(page.locator('#open-settings-modal-btn')).toBeVisible();
    await expect(page.locator('.network-shield-title')).toHaveText('Network shield active');
});

test('popup renders feature groups with toggles', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await expect(page.locator('#version')).toHaveText(/^v\d+\.\d+\.\d+$/);
    // At least one toggle should be present and tab-reachable.
    const firstToggle = page.locator('input[type="checkbox"]').first();
    await expect(firstToggle).toBeVisible();
    await expect(firstToggle).toHaveAttribute('aria-label', /.+/);
    await expect(firstToggle).not.toHaveAttribute('aria-pressed');
    await expect(page.locator('.popup-shield')).toHaveText('Network shield active');
});

test('options and popup consume localized UI messages', async ({ context, extensionId }) => {
    await context.addInitScript(() => {
        window.__RUMBLEX_TEST_I18N = {
            openSettingsEditor: 'Localized Settings Editor',
            privacyReport: 'Localized Privacy Report',
            groupAdBlocking: 'Localized Ad Controls',
            themeLabel: 'Localized Theme',
            searchSettings: 'Localized search',
        };
    });

    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await expect(options.locator('#open-settings-modal-btn')).toHaveText('Localized Settings Editor');
    await expect(options.locator('#privacy-heading')).toHaveText('Localized Privacy Report');
    await options.locator('#open-settings-modal-btn').click();
    await expect(options.locator('#settings-search')).toHaveAttribute('placeholder', 'Localized search');
    await expect(options.locator('#settings-groups button[data-group="ad-blocking"]')).toHaveText(/Localized Ad Controls/);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/pages/popup.html`);
    await expect(popup.locator('#open-options')).toContainText('Localized Settings Editor');
    await expect(popup.locator('.feat-group-header').first()).toContainText('Localized Ad Controls');
    await expect(popup.locator('.theme-label')).toHaveText('Localized Theme');
});

test('update check compares versions numerically and reports rate limiting distinctly', async ({ context, extensionId, serviceWorker }) => {
    // The handler runs in the service worker, so fetch is stubbed there; the
    // message has to originate elsewhere because a worker does not receive its
    // own runtime messages.
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
    const ask = () => page.evaluate(() => new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkUpdate' }, resolve);
    }));
    const stubRelease = (tag) => serviceWorker.evaluate((releaseTag) => {
        globalThis.__rxRealFetch ||= globalThis.fetch;
        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ tag_name: releaseTag, html_url: 'https://example.invalid/release' }),
        });
    }, tag);
    const stubFailure = (status, headers) => serviceWorker.evaluate(({ code, head }) => {
        globalThis.__rxRealFetch ||= globalThis.fetch;
        globalThis.fetch = async () => ({ ok: false, status: code, headers: new Headers(head) });
    }, { code: status, head: headers });

    try {
        const current = await page.evaluate(() => chrome.runtime.getManifest().version);

        // A published release older than the installed build is the exact state
        // that previously produced a downgrade prompt.
        await stubRelease('v3.26.0');
        expect((await ask()).hasUpdate).toBe(false);

        await stubRelease('v' + current);
        expect((await ask()).hasUpdate).toBe(false);

        await stubRelease('v999.0.0');
        expect((await ask()).hasUpdate).toBe(true);

        await stubFailure(403, { 'X-RateLimit-Remaining': '0' });
        expect(await ask()).toMatchObject({ rateLimited: true });

        await stubFailure(500, {});
        const broken = await ask();
        expect(broken.rateLimited).toBe(false);
        expect(broken.error).toContain('500');
    } finally {
        await serviceWorker.evaluate(() => {
            if (globalThis.__rxRealFetch) globalThis.fetch = globalThis.__rxRealFetch;
        });
    }
});

test('channel notifier reads the embedded listing JSON and points at the stream', async ({ serviceWorker }) => {
    // Shape taken from live channel pages on 2026-08-19: one or more <script>
    // blocks of {"items":[...]}, each entry carrying id, title, relative_url,
    // upload_date, a boolean live, and a `by` block naming the owning channel.
    const item = (over) => JSON.stringify(Object.assign({
        object_type: 'video',
        id: 1,
        title: 'An ordinary upload',
        relative_url: '/v0000001-ordinary.html',
        upload_date: '2026-08-01T00:00:00+00:00',
        live: false,
        livestream_status: 0,
        watching_now: null,
        by: { type: 'channel', relative_url: '/c/bongino' },
    }, over));

    const page = (items) => `<html><head>
        <script type="application/json">{"items":[${items.join(',')}],"analytics":{}}</script>
        </head><body></body></html>`;

    const result = await serviceWorker.evaluate(({ pages }) => {
        const out = {};
        for (const [name, [html, url]] of Object.entries(pages)) {
            out[name] = rxParseChannelHtml(html, url);
        }
        return out;
    }, {
        pages: {
            // Newest-first is the observed order, but upload_date decides.
            ordered: [page([
                item({ id: 11, title: 'Newest', relative_url: '/v0000011-newest.html', upload_date: '2026-08-19T12:00:00+00:00' }),
                item({ id: 10, title: 'Older', relative_url: '/v0000010-older.html', upload_date: '2026-08-18T12:00:00+00:00' }),
            ]), 'https://rumble.com/c/Bongino'],
            // Order reversed: the newest stamp still wins.
            outOfOrder: [page([
                item({ id: 10, title: 'Older', relative_url: '/v0000010-older.html', upload_date: '2026-08-18T12:00:00+00:00' }),
                item({ id: 11, title: 'Newest', relative_url: '/v0000011-newest.html', upload_date: '2026-08-19T12:00:00+00:00' }),
            ]), 'https://rumble.com/c/Bongino'],
            // A live entry gives the notification something to open.
            live: [page([
                item({ id: 12, title: 'LIVE & BREAKING', relative_url: '/v0000012-live.html', live: true, livestream_status: 2, watching_now: 2519, upload_date: '2026-08-19T11:20:00+00:00' }),
                item({ id: 11, title: 'Newest VOD', relative_url: '/v0000011-newest.html', upload_date: '2026-08-19T10:00:00+00:00' }),
            ]), 'https://rumble.com/c/Bongino'],
            // The sidebar "live now" rail belongs to other channels and must
            // not be mistaken for this channel going live.
            foreignRail: [page([
                item({ id: 11, title: 'Own upload', relative_url: '/v0000011-newest.html', upload_date: '2026-08-19T10:00:00+00:00' }),
                item({ id: 99, title: 'Someone else is live', relative_url: '/v0000099-other.html', live: true, by: { type: 'channel', relative_url: '/c/StevenCrowder' } }),
            ]), 'https://rumble.com/c/Bongino'],
            // A /user/ page is the same shape with a different path.
            userPage: [page([
                item({ id: 21, title: 'User page live', relative_url: '/v0000021-live.html', live: true, by: { type: 'channel', relative_url: '/user/BonginoReport' } }),
            ]), 'https://rumble.com/user/BonginoReport'],
            // Nothing owned by this channel: fall back rather than go blank.
            noneOwned: [page([
                item({ id: 99, title: 'Only foreign items', relative_url: '/v0000099-other.html', by: { type: 'channel', relative_url: '/c/Someone' } }),
            ]), 'https://rumble.com/c/Bongino'],
            // A malformed block must not take the valid one down with it.
            malformed: [`<html><head>
                <script type="application/json">{"items":[ NOT JSON </script>
                <script type="application/json">{"items":[${item({ id: 11, relative_url: '/v0000011-newest.html' })}]}</script>
                </head></html>`, 'https://rumble.com/c/Bongino'],
            // No JSON at all: the old class-name scan still answers.
            legacy: ['<html><body><div data-video-id="443754624" class="videostream__status--live"></div></body></html>',
                'https://rumble.com/c/Bongino'],
            legacyQuiet: ['<html><body><div data-video-id="443754624"></div></body></html>',
                'https://rumble.com/c/Bongino'],
            // An off-site relative_url is refused, not rewritten.
            offsite: [page([item({ id: 11, relative_url: '//evil.example.com/x.html' })]), 'https://rumble.com/c/Bongino'],
            empty: ['<html><body>nothing here</body></html>', 'https://rumble.com/c/Bongino'],
        },
    });

    expect(result.ordered.latestVideoId).toBe('11');
    expect(result.ordered.latest.url).toBe('https://rumble.com/v0000011-newest.html');
    expect(result.ordered.latest.title).toBe('Newest');
    expect(result.ordered.isLive).toBe(false);
    expect(result.ordered.live).toBeNull();

    // Array order does not decide which video is newest.
    expect(result.outOfOrder.latestVideoId).toBe('11');
    expect(result.outOfOrder.latest.title).toBe('Newest');

    expect(result.live.isLive).toBe(true);
    expect(result.live.live.url).toBe('https://rumble.com/v0000012-live.html');
    expect(result.live.live.title).toBe('LIVE & BREAKING');
    expect(result.live.live.viewers).toBe(2519);
    // The live stream is not necessarily the newest upload.
    expect(result.live.latest.title).toBe('LIVE & BREAKING');

    // Another channel's live entry on the same page is ignored.
    expect(result.foreignRail.isLive).toBe(false);
    expect(result.foreignRail.latestVideoId).toBe('11');

    expect(result.userPage.isLive).toBe(true);
    expect(result.userPage.live.url).toBe('https://rumble.com/v0000021-live.html');

    // Nothing matched the channel filter, so every item is considered.
    expect(result.noneOwned.latestVideoId).toBe('99');

    expect(result.malformed.latestVideoId).toBe('11');
    expect(result.malformed.latest.url).toBe('https://rumble.com/v0000011-newest.html');

    // Legacy path: an id and a live flag, but no watch URL to open.
    expect(result.legacy).toEqual({ latestVideoId: '443754624', isLive: true, latest: null, live: null });
    expect(result.legacyQuiet.isLive).toBe(false);

    // A relative_url pointing off Rumble yields no event rather than a link.
    expect(result.offsite.latest).toBeNull();
    expect(result.offsite.latestVideoId).toBeNull();

    expect(result.empty).toEqual({ latestVideoId: null, isLive: false, latest: null, live: null });
});
