// @ts-check
// Catalog-wide lifecycle coverage for the real shared content core. The test
// instruments the lexical feature registry in-memory only; production source
// and distributable artifacts remain unchanged.
const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const readSource = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
const SCHEMA = readSource(path.join(ROOT, 'extension', 'settings-schema.js'));
const CORE = readSource(path.join(ROOT, 'extension', 'content.js'));

const HARNESS_INJECTION = `
globalThis.__RumbleXFeatureHarness = {
    features,
    cssToggles: RX_CSS_TOGGLES,
    resetSettings() {
        const next = { ...Settings._defaults };
        for (const [key, value] of Object.entries(next)) {
            if (typeof value === 'boolean') next[key] = false;
        }
        Object.assign(next, {
            schemaVersion: SCHEMA_VERSION,
            theme: 'catppuccin',
            siteTheme: 'system',
            homeCleanupPreset: 'none',
            autoplayBlockMode: 'off',
            chatUsernameColors: 'off',
            rantTierFilter: 0,
            hiddenCategories: [],
        });
        Settings._cache = next;
        Settings._ready = true;
        Settings._pendingKeys = new Set();
        return next;
    },
    enable(id) {
        const next = this.resetSettings();
        if (id === 'categoryFilter') next.hiddenCategories = ['news'];
        else if (id === 'siteTheme') Object.assign(next, { siteThemeSync: true, siteTheme: 'dark' });
        else if (id === 'homeCleanupPreset') next.homeCleanupPreset = 'focused';
        else if (id === 'rantTierFilter') next.rantTierFilter = 5;
        else if (id === 'chatUsernameColors') next.chatUsernameColors = 'deterministic';
        else if (id === 'autoplayBlock') Object.assign(next, { autoplayBlock: true, autoplayBlockMode: 'playerOnly' });
        else if (id === 'bulkUnsubscribeEnabled') Object.assign(next, { bulkUnsubscribeEnabled: true, bulkUnsubscribeDryRun: true });
        else if (Object.hasOwn(next, id)) next[id] = true;
        return next;
    },
};
if (!globalThis.__RUMBLEX_SKIP_BOOT__) boot();
`;

const marker = '\nboot();\n';
if (!CORE.includes(marker)) throw new Error('Unable to instrument shared feature registry');
const INSTRUMENTED_CORE = CORE.replace(marker, `\n${HARNESS_INJECTION}\n`);

const PLATFORM = `
(() => {
    const values = new Map();
    globalThis.__RUMBLEX_SKIP_BOOT__ = true;
    globalThis.RumbleXPlatform = Object.freeze({
        kind: 'test',
        version: ${JSON.stringify(VERSION)},
        capabilities: Object.freeze({
            persistentBackground: false,
            managedDownloads: false,
            packagedAssets: false,
            mediabunny: false,
            externalMessages: false,
            requestBlocking: false,
            requestBlockingMode: 'test',
            requestBlockingRules: 0,
            streamingFileSave: false,
        }),
        storage: Object.freeze({
            async get(key) { return key === 'rx_settings' ? { rx_settings: values.get(key) || {} } : {}; },
            async set(entries) { for (const [key, value] of Object.entries(entries)) values.set(key, value); },
            async remove(keys) { for (const key of [].concat(keys)) values.delete(key); },
            onChanged() { return () => {}; },
        }),
        fetch: async () => new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } }),
        assetText: async () => { throw new Error('No packaged assets in lifecycle fixture'); },
        assetUrl: (assetPath) => 'https://rumble.com/__fixture__/' + assetPath,
        sendMessage: async () => ({ ok: false, reason: 'fixture' }),
        onMessage: () => () => {},
        getManifest: () => ({ version: ${JSON.stringify(VERSION)}, manifest_version: 3 }),
        t: () => '',
        migrateLegacySettings: async () => null,
    });
})();
`;

const BODY = `
<header class="header" data-js="app_header">
  <a class="flex logo-link" href="/"><svg><use href="#rumble-logo"></use></svg></a>
  <form class="header-search" data-js="search_form"><input class="header-search-field" data-js="search_input"></form>
  <button class="header-upload">Upload</button><button class="notification-bell">Notifications</button>
</header>
<nav id="main-menu" class="sidenav"><a href="/"><img alt="Rumble"></a></nav>
<div class="theme-option-group"><a class="main-menu-item theme-option main-menu-item--active" data-theme-option="system"></a><a class="main-menu-item theme-option" data-theme-option="dark"></a></div>
<main class="nonconstrained media-page" data-js="media_container">
  <section class="main-and-sidebar"><div class="main-content">
    <h1 class="video-header-container__title">Feature Fixture Video</h1>
    <div class="video-header-live-info">Live</div>
    <div id="videoPlayer" class="videoPlayer-Rumble-cls"><video></video>
      <button data-js="theater-mode-toggle" title="Toggle theater mode">Theater</button>
      <button aria-label="Settings">Settings</button>
      <button class="quality-menu-item" data-quality="720">720p</button>
      <button class="quality-menu-item" data-quality="1080">1080p</button>
      <div title="Rewind"></div><div title="Fast forward"></div><div title="Toggle closed captions"></div>
      <div title="Autoplay"></div><div title="Toggle picture-in-picture mode"></div><div title="Toggle fullscreen"></div>
    </div>
    <div class="media-by-actions">
      <button class="rumbles-vote-pill-up">Like</button>
      <button data-js="media_engage_share">Share</button>
      <button data-js="video_action_sub_menu_button">More</button>
      <div data-js="media_action_vote_button"></div>
      <div data-js="video_action_button_visible_location" data-type="share"></div>
      <div data-js="video_action_button_visible_location" data-type="reposts"></div>
      <div data-js="video_action_button_visible_location" data-type="embed"></div>
      <div data-js="video_action_button_visible_location" data-type="playlist"></div>
      <div data-js="video_action_button_visible_location" data-type="comments"></div>
      <div class="video-action-sub-menu-wrapper"></div>
      <button data-js="wallet_tip_button">Tip</button>
      <button data-js="button__following">Following</button>
    </div>
    <section class="media-description-section" data-js="media_description_section">Opening 00:05 and topic 01:20</section>
    <div class="media-description-info-stream-time">Streaming now</div>
    <section id="comments-host">
      <div id="video-comments" class="media-page-comments-container" data-js="media_page_comments_container">
        <select><option>Sort by likes</option></select>
        <textarea class="comments-create-textarea" data-js="comment_textarea"></textarea>
        <ul>
          <li class="comment-item" data-comment-id="one"><a class="comment-author" href="/user/creator">Creator</a><span class="comment-text">First fixture comment</span><div class="comment-actions-wrapper"><div class="comment-actions"></div><button class="comments-action-report comments-action">Report</button></div></li>
          <li class="show-more-comments"><button>More comments</button></li>
        </ul>
      </div>
    </section>
  </div>
  <aside class="media-page-related-media-desktop-sidebar media-page-chat-aside-chat">
    <rum-video-thumbnail role="listitem" video-title="Alpha Report" name="Creator Alpha" url="/valpha123-alpha.html" video-id="101" views="1234"><a href="/valpha123-alpha.html"><div class="rum-video-thumbnail__image"><img alt=""></div></a><a rel="author" class="channel__link" href="/c/creator-alpha">Creator Alpha</a><rum-text role="heading">Alpha Report</rum-text></rum-video-thumbnail>
    <rum-video-thumbnail role="listitem" video-title="Beta Briefing" name="Creator Beta" url="/vbeta456-beta.html" video-id="202" views="5678"><a href="/vbeta456-beta.html"><div class="rum-video-thumbnail__image"><img alt=""></div></a><a rel="author" class="channel__link" href="/c/creator-beta">Creator Beta</a><rum-text role="heading">Beta Briefing</rum-text></rum-video-thumbnail>
    <div class="chat--header">Live Chat</div>
    <div id="chat-history-list" class="chat-history">
      <div class="chat-history--row"><button class="chat-history--username">Alice</button><span class="chat-history--message">Hello world</span></div>
      <div class="chat-history--row"><button class="chat-history--username">Alice</button><span class="chat-history--message">Hello world</span></div>
      <div class="chat-history--rant" data-level="5"><button class="chat-history--rant-username">Bob</button><span class="chat-history--rant-price">$10</span></div>
    </div>
    <form class="chat-message-form"><textarea></textarea></form>
  </aside>
  </section>
</main>
<section id="section-editor-picks" class="homepage-featured"></section><section id="section-news"></section><section id="section-shorts"><rum-shorts-row></rum-shorts-row></section>
<section data-js="followed-channels__section"><li class="followed-channel" data-type="channel"><a href="/c/fixture"><span class="line-clamp-2">Fixture Channel</span></a><button class="js-media-subscribe" data-action="unsubscribe" hx-post="/legacy-video-collection">Unsubscribe</button></li></section>
<table><tbody><tr><td>Recurring Fixture</td><td><button data-js="cancel_recurring_subscriptions">Cancel</button></td></tr></tbody></table>
<div class="pagination autoPg"></div><footer class="page__footer foot nav--transition"></footer><div id="portal" data-js="portal"></div>
`;

const INIT_STYLE_IDS = Object.freeze({
    adNuker: 'rx-adnuker', feedCleanup: 'rx-feedcleanup', hidePremium: 'rx-hidepremium',
    categoryFilter: 'rx-catfilter', darkEnhance: 'rx-darkenhance', theaterSplit: 'rx-theater-css',
    videoDownload: 'rx-download-css', speedController: 'rx-speed-css', scrollVolume: 'rx-scrollvol-css',
    watchProgress: 'rx-watchprogress-css', channelBlocker: 'rx-chanblocker-css', liveChatEnhance: 'rx-livechat-css',
    videoTimestamps: 'rx-timestamps-css', screenshotBtn: 'rx-screenshot-css', watchHistory: 'rx-watch-history-css',
    autoplayBlock: 'rx-autoplay-block-css', searchHistory: 'rx-search-history-css', miniPlayer: 'rx-miniplayer-css',
    videoStats: 'rx-stats-css', loopControl: 'rx-loop-css', quickBookmark: 'rx-bookmark-css',
    commentNav: 'rx-comment-nav-css', rantHighlight: 'rx-rant-highlight-css', relatedFilter: 'rx-related-filter-css',
    exactCounts: 'rx-exact-counts-css', shareTimestamp: 'rx-share-ts-css', shortsFilter: 'rx-shorts-filter-css',
    chatAutoScroll: 'rx-chat-autoscroll-css', autoExpand: 'rx-auto-expand-css', notifEnhance: 'rx-notif-enhance-css',
    quickSave: 'rx-quick-save-css', fullTitles: 'rx-fulltitles-css', titleFont: 'rx-titlefont-css',
    uniqueChatters: 'rx-chatters-css', chatUserBlock: 'rx-chatuserblock-css', chatSpamDedup: 'rx-spamdedup-css',
    chatExport: 'rx-chatexport-css', rantPersist: 'rx-rantpersist-css', commentSort: 'rx-commentsort-css',
    commentExport: 'rx-comment-export-css', popoutChat: 'rx-popoutchat-css', keywordFilter: 'rx-keywordfilter-css',
    autoplayScheduler: 'rx-autoplayscheduler-css', chapters: 'rx-chapters-css', sponsorBlock: 'rx-sponsorblock-css',
    videoClips: 'rx-clips-css', liveDVR: 'rx-livedvr-css', subtitleSidecar: 'rx-subsidecar-css',
    transcripts: 'rx-transcripts-css', audioOnly: 'rx-audioonly-css', batchDownload: 'rx-batch-css',
    autoHideHeader: 'rx-autohide-header-css', autoHideNavSidebar: 'rx-autohide-nav-css',
    fullWidthPlayer: 'rx-fullwidth-css', adaptiveLiveLayout: 'rx-adaptive-live-css',
    commentBlocking: 'rx-commentblock-css', hideThumbnails: 'rx-thumbnailhider', denseMode: 'rx-densemode',
    compactAccountPagination: 'rx-acct-pagination', reducedMotion: 'rx-reduced-motion',
    homeCleanupPreset: 'rx-home-cleanup-preset', externalPlayerEnabled: 'rx-extplayer-css',
    rantTierFilter: 'rx-rant-tier-filter',
    bulkUnsubscribeEnabled: 'rx-bulk-unsub-css',
});

const HOME_FEATURES = new Set([
    'feedCleanup', 'categoryFilter', 'channelBlocker', 'shortsFilter', 'quickSave',
    'batchDownload', 'homeCleanupPreset',
]);
const ACCOUNT_FEATURES = new Set(['compactAccountPagination', 'bulkUnsubscribeEnabled']);
function routeFor(id) {
    if (HOME_FEATURES.has(id)) return '/';
    if (ACCOUNT_FEATURES.has(id)) return '/followed-channels';
    if (id === 'searchHistory') return '/search/video?q=fixture';
    if (id === 'channelArchiveButton') return '/c/fixture';
    if (id === 'disableShortsFeed') return '/shorts';
    return '/vfeature123-catalog-fixture.html';
}

async function createHarnessPage(browser) {
    const context = await browser.newContext();
    await context.route('https://rumble.com/**', (route) => route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8"><title>Feature catalog fixture</title></head><body>${BODY}</body></html>`,
    }));
    const page = await context.newPage();
    await page.goto('https://rumble.com/vfeature123-catalog-fixture.html', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: SCHEMA });
    await page.addScriptTag({ content: PLATFORM });
    await page.addScriptTag({ content: INSTRUMENTED_CORE });
    return { context, page };
}

test('every feature initializes and destroys through the canonical registry', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));

        const catalog = await page.evaluate(() => globalThis.__RumbleXFeatureHarness.features.map((feature) => ({
            id: feature.id,
            name: feature.name,
            hasInit: typeof feature.init === 'function',
            hasDestroy: typeof feature.destroy === 'function',
        })));
        expect(catalog).toHaveLength(126);
        expect(new Set(catalog.map(({ id }) => id)).size).toBe(126);
        expect(catalog.every(({ id, name, hasInit, hasDestroy }) => id && name && hasInit && hasDestroy)).toBe(true);

        const excluded = new Set(['autoTheater', 'disableShortsFeed']);
        const results = [];
        for (const { id } of catalog) {
            if (excluded.has(id)) continue;
            const result = await page.evaluate(({ featureId, route, body }) => {
                document.body.innerHTML = body;
                history.replaceState({}, '', route);
                const harness = globalThis.__RumbleXFeatureHarness;
                harness.enable(featureId);
                const feature = harness.features.find((candidate) => candidate.id === featureId);
                try {
                    feature.destroy();
                    feature.init();
                    feature.destroy();
                    return { id: featureId, ok: true };
                } catch (error) {
                    return { id: featureId, ok: false, error: String(error?.stack || error) };
                }
            }, { featureId: id, route: routeFor(id), body: BODY });
            results.push(result);
        }
        expect(results.filter(({ ok }) => !ok)).toEqual([]);
        await page.waitForTimeout(50);
        expect(pageErrors).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});

test('all CSS toggles and handwritten style modules mount and clean up on their intended route', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);

        const cssResults = await page.evaluate(async ({ body }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            const routes = { watch: '/vfeature123-css.html', home: '/', feed: '/subscriptions', channel: '/c/fixture', live: '/vfeature123-live.html' };
            const output = [];
            for (const entry of harness.cssToggles) {
                document.body.innerHTML = body;
                history.replaceState({}, '', routes[entry.page] || '/vfeature123-css.html');
                harness.enable(entry.id);
                const feature = harness.features.find((candidate) => candidate.id === entry.id);
                feature.destroy();
                feature.init();
                const styleId = 'rx-css-' + entry.id;
                const mounted = !!document.getElementById(styleId);
                feature.destroy();
                output.push({ id: entry.id, mounted, removed: !document.getElementById(styleId) });
            }
            return output;
        }, { body: BODY });
        expect(cssResults).toHaveLength(51);
        expect(cssResults.filter(({ mounted, removed }) => !mounted || !removed)).toEqual([]);

        const handwrittenResults = [];
        for (const [id, styleId] of Object.entries(INIT_STYLE_IDS)) {
            const result = await page.evaluate(async ({ featureId, expectedStyle, route, body }) => {
                document.body.innerHTML = body;
                history.replaceState({}, '', route);
                const harness = globalThis.__RumbleXFeatureHarness;
                harness.enable(featureId);
                const feature = harness.features.find((candidate) => candidate.id === featureId);
                feature.destroy();
                feature.init();
                await new Promise((resolve) => setTimeout(resolve, featureId === 'fullWidthPlayer' ? 300 : 25));
                const mounted = !!document.getElementById(expectedStyle);
                feature.destroy();
                return { id: featureId, mounted, removed: !document.getElementById(expectedStyle) };
            }, { featureId: id, expectedStyle: styleId, route: routeFor(id), body: BODY });
            handwrittenResults.push(result);
        }
        expect(handwrittenResults.filter(({ mounted, removed }) => !mounted || !removed)).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});

test('non-style features perform their intended isolated behavior', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);

        const result = await page.evaluate(async ({ body }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            const run = (id, route = '/vfeature123-behavior.html') => {
                document.body.innerHTML = body;
                history.replaceState({}, '', route);
                harness.enable(id);
                const feature = harness.features.find((candidate) => candidate.id === id);
                feature.destroy();
                feature.init();
                return feature;
            };

            const logoFeature = run('logoToFeed');
            const logoHref = document.querySelector('a.logo-link')?.getAttribute('href');
            logoFeature.destroy();
            const restoredLogoHref = document.querySelector('a.logo-link')?.getAttribute('href');

            let qualityClicked = '';
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-quality.html');
            document.querySelectorAll('.quality-menu-item').forEach((button) => button.addEventListener('click', () => { qualityClicked = button.textContent.trim(); }));
            harness.enable('autoMaxQuality');
            const qualityFeature = harness.features.find((candidate) => candidate.id === 'autoMaxQuality');
            qualityFeature.destroy();
            qualityFeature.init();
            qualityFeature._tryAPIApproach();
            qualityFeature.destroy();

            let likeClicks = 0;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-like.html');
            document.querySelector('.rumbles-vote-pill-up').addEventListener('click', () => { likeClicks++; });
            harness.enable('autoLike');
            const likeFeature = harness.features.find((candidate) => candidate.id === 'autoLike');
            likeFeature.destroy();
            likeFeature.init();
            // The lifecycle guard resolves an already-present target in one
            // microtask; the waitForFeature consumer runs in the next one.
            await Promise.resolve();
            await Promise.resolve();
            likeFeature.destroy();

            let moreCommentClicks = 0;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-comments.html');
            const more = document.querySelector('li.show-more-comments > button');
            more.getBoundingClientRect = () => ({ top: 1, bottom: 20, left: 0, right: 20, width: 20, height: 19, x: 0, y: 1, toJSON() {} });
            more.addEventListener('click', () => { moreCommentClicks++; });
            harness.enable('autoLoadComments');
            const commentsFeature = harness.features.find((candidate) => candidate.id === 'autoLoadComments');
            commentsFeature.destroy();
            commentsFeature.init();
            window.dispatchEvent(new Event('scroll'));
            commentsFeature.destroy();

            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-track.html?e9s=source&utm_campaign=test&start=42');
            const tracked = document.createElement('a');
            tracked.href = '/vnext123-next.html?ref=feed&start=7';
            document.body.appendChild(tracked);
            harness.enable('stripTrackingParams');
            const stripFeature = harness.features.find((candidate) => candidate.id === 'stripTrackingParams');
            stripFeature.destroy();
            stripFeature.init();
            tracked.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            const cleanedLocation = location.href;
            const cleanedLink = tracked.href;
            stripFeature.destroy();

            let themeClicks = 0;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-theme.html');
            document.querySelector('[data-theme-option="dark"]').addEventListener('click', () => { themeClicks++; });
            harness.enable('siteTheme');
            const themeFeature = harness.features.find((candidate) => candidate.id === 'siteTheme');
            themeFeature.destroy();
            themeFeature.init();
            themeFeature.destroy();

            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-chat-colors.html');
            harness.enable('chatUsernameColors');
            const colorsFeature = harness.features.find((candidate) => candidate.id === 'chatUsernameColors');
            colorsFeature.destroy();
            colorsFeature.init();
            const coloredBeforeDestroy = document.querySelectorAll('[data-rx-colored="1"]').length;
            colorsFeature.destroy();
            const coloredAfterDestroy = document.querySelectorAll('[data-rx-colored="1"]').length;

            let unsubscribeClicks = 0;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/followed-channels');
            document.querySelector('[data-action="unsubscribe"]').addEventListener('click', () => { unsubscribeClicks++; });
            harness.enable('bulkUnsubscribeEnabled');
            const bulkFeature = harness.features.find((candidate) => candidate.id === 'bulkUnsubscribeEnabled');
            bulkFeature.destroy();
            bulkFeature.init();
            const bulkBarMounted = !!document.querySelector('.rx-bulk-unsub-bar');
            document.querySelector('[data-act="all"]')?.click();
            const bulkSelected = document.querySelectorAll('.rx-bu-row-check:checked').length;
            document.querySelector('[data-act="run"]')?.click();
            await Promise.resolve();
            const dryRunProtected = unsubscribeClicks === 0;
            bulkFeature.destroy();
            const bulkCleaned = !document.querySelector('.rx-bulk-unsub-bar, .rx-bu-row-check');

            let recurringCancelClicks = 0;
            history.replaceState({}, '', '/account/recurring-subs');
            document.querySelector('[data-js="cancel_recurring_subscriptions"]').addEventListener('click', () => { recurringCancelClicks++; });
            bulkFeature.init();
            const recurringBarMounted = !!document.querySelector('.rx-bulk-unsub-bar');
            document.querySelector('[data-act="all"]')?.click();
            document.querySelector('[data-act="run"]')?.click();
            await Promise.resolve();
            const recurringDryRunProtected = recurringCancelClicks === 0;
            bulkFeature.destroy();

            return { logoHref, restoredLogoHref, qualityClicked, likeClicks, moreCommentClicks, cleanedLocation, cleanedLink, themeClicks, coloredBeforeDestroy, coloredAfterDestroy, bulkBarMounted, bulkSelected, dryRunProtected, bulkCleaned, recurringBarMounted, recurringDryRunProtected };
        }, { body: BODY });

        expect(result.logoHref).toBe('/subscriptions');
        expect(result.restoredLogoHref).toBe('/');
        expect(result.qualityClicked).toBe('1080p');
        expect(result.likeClicks).toBe(1);
        expect(result.moreCommentClicks).toBe(1);
        expect(result.cleanedLocation).toContain('start=42');
        expect(result.cleanedLocation).not.toMatch(/e9s=|utm_campaign=/);
        expect(result.cleanedLink).toContain('start=7');
        expect(result.cleanedLink).not.toContain('ref=');
        expect(result.themeClicks).toBe(1);
        expect(result.coloredBeforeDestroy).toBeGreaterThan(0);
        expect(result.coloredAfterDestroy).toBe(0);
        expect(result.bulkBarMounted).toBe(true);
        expect(result.bulkSelected).toBe(1);
        expect(result.dryRunProtected).toBe(true);
        expect(result.bulkCleaned).toBe(true);
        expect(result.recurringBarMounted).toBe(true);
        expect(result.recurringDryRunProtected).toBe(true);
        await context.close();
    } finally {
        await browser.close();
    }
});

test('delayed feature work is cancelled when a hot toggle disables it', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const result = await page.evaluate(async ({ body }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            document.body.innerHTML = body;
            history.replaceState({}, '', '/vfeature123-delayed.html');

            harness.enable('fullWidthPlayer');
            const fullWidth = harness.features.find((feature) => feature.id === 'fullWidthPlayer');
            fullWidth.destroy();
            fullWidth.init();
            fullWidth.destroy();
            await new Promise((resolve) => setTimeout(resolve, 350));
            const fullWidthStayedOff = !document.getElementById('rx-fullwidth-css')
                && !document.body.classList.contains('rx-full-width-player')
                && !document.body.classList.contains('rx-live-two-col');

            let theaterClicks = 0;
            const theaterButton = document.querySelector('[data-js="theater-mode-toggle"]');
            theaterButton.addEventListener('click', () => { theaterClicks++; });
            harness.enable('autoTheater');
            const autoTheater = harness.features.find((feature) => feature.id === 'autoTheater');
            autoTheater.destroy();
            autoTheater.init();
            autoTheater.destroy();
            await new Promise((resolve) => setTimeout(resolve, 1600));

            document.querySelector('.theme-option-group')?.remove();
            harness.enable('siteTheme');
            const siteTheme = harness.features.find((feature) => feature.id === 'siteTheme');
            siteTheme.destroy();
            siteTheme.init();
            siteTheme.destroy();
            const group = document.createElement('div');
            group.className = 'theme-option-group';
            document.body.appendChild(group);
            await Promise.resolve();

            return {
                fullWidthStayedOff,
                theaterClicks,
                themeObserverStayedOff: siteTheme._obs === null,
            };
        }, { body: BODY });

        expect(result).toEqual({
            fullWidthStayedOff: true,
            theaterClicks: 0,
            themeObserverStayedOff: true,
        });
        await context.close();
    } finally {
        await browser.close();
    }
});

test('features cannot attach delayed DOM work after being disabled', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const lifecycleFeatureIds = await page.evaluate(() => globalThis.__RumbleXFeatureHarness.features
            .slice(0, 75)
            .map((feature) => feature.id)
            .filter((id) => id !== 'disableShortsFeed'));
        const leaks = await page.evaluate(async ({ body, featureIds, routes }) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            const NativeMutationObserver = globalThis.MutationObserver;
            const NativeIntersectionObserver = globalThis.IntersectionObserver;
            const NativeResizeObserver = globalThis.ResizeObserver;
            const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
            const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);
            const nativeSetInterval = globalThis.setInterval.bind(globalThis);
            const nativeClearInterval = globalThis.clearInterval.bind(globalThis);
            const nativeAdd = EventTarget.prototype.addEventListener;
            const nativeRemove = EventTarget.prototype.removeEventListener;
            const activeObservers = new Set();
            const activeTimeouts = new Set();
            const activeIntervals = new Set();
            const activeListeners = [];

            const captureOf = (options) => typeof options === 'boolean' ? options : !!options?.capture;
            EventTarget.prototype.addEventListener = function (type, listener, options) {
                if (listener && !activeListeners.some((entry) => entry.target === this && entry.type === type && entry.listener === listener && entry.capture === captureOf(options))) {
                    activeListeners.push({ target: this, type, listener, capture: captureOf(options), options });
                }
                return nativeAdd.call(this, type, listener, options);
            };
            EventTarget.prototype.removeEventListener = function (type, listener, options) {
                const capture = captureOf(options);
                for (let i = activeListeners.length - 1; i >= 0; i--) {
                    const entry = activeListeners[i];
                    if (entry.target === this && entry.type === type && entry.listener === listener && entry.capture === capture) activeListeners.splice(i, 1);
                }
                return nativeRemove.call(this, type, listener, options);
            };
            globalThis.setTimeout = (fn, delay, ...args) => {
                let id;
                id = nativeSetTimeout(() => {
                    activeTimeouts.delete(id);
                    fn(...args);
                }, delay);
                activeTimeouts.add(id);
                return id;
            };
            globalThis.clearTimeout = (id) => {
                activeTimeouts.delete(id);
                return nativeClearTimeout(id);
            };
            globalThis.setInterval = (fn, delay, ...args) => {
                const id = nativeSetInterval(fn, delay, ...args);
                activeIntervals.add(id);
                return id;
            };
            globalThis.clearInterval = (id) => {
                activeIntervals.delete(id);
                return nativeClearInterval(id);
            };

            const trackObserver = (Base) => class extends Base {
                observe(...args) {
                    activeObservers.add(this);
                    return super.observe(...args);
                }
                disconnect() {
                    activeObservers.delete(this);
                    return super.disconnect();
                }
                unobserve(...args) {
                    const result = super.unobserve?.(...args);
                    return result;
                }
            };
            globalThis.MutationObserver = trackObserver(NativeMutationObserver);
            if (NativeIntersectionObserver) globalThis.IntersectionObserver = trackObserver(NativeIntersectionObserver);
            if (NativeResizeObserver) globalThis.ResizeObserver = trackObserver(NativeResizeObserver);

            const resetTracking = () => {
                for (const id of activeTimeouts) nativeClearTimeout(id);
                for (const id of activeIntervals) nativeClearInterval(id);
                for (const observer of activeObservers) {
                    try { observer.disconnect(); } catch {}
                }
                for (const entry of activeListeners.splice(0)) {
                    try { nativeRemove.call(entry.target, entry.type, entry.listener, entry.options); } catch {}
                }
                activeTimeouts.clear();
                activeIntervals.clear();
                activeObservers.clear();
            };

            const found = [];
            for (const id of featureIds) {
                resetTracking();
                document.body.innerHTML = '';
                history.replaceState({}, '', routes[id] || '/vfeature123-async.html');
                harness.enable(id);
                const feature = harness.features.find((candidate) => candidate.id === id);
                feature.destroy();
                resetTracking();
                feature.init();
                feature.destroy();
                document.body.innerHTML = body;
                await new Promise((resolve) => nativeSetTimeout(resolve, 80));
                const artifacts = Array.from(document.querySelectorAll('[id^="rx-"], [class*="rx-"], style[data-rx]'))
                    .map((node) => node.id || String(node.className || node.tagName))
                    .slice(0, 8);
                const state = {
                    phase: 'pending-target',
                    id,
                    observers: activeObservers.size,
                    timeouts: activeTimeouts.size,
                    intervals: activeIntervals.size,
                    listeners: activeListeners.filter((entry) => entry.target === document
                        || entry.target === window
                        || !(entry.target instanceof Node)
                        || entry.target.isConnected).length,
                    artifacts,
                };
                if (state.observers || state.timeouts || state.intervals || state.listeners || state.artifacts.length) found.push(state);
                try { feature.destroy(); } catch {}

                resetTracking();
                document.body.innerHTML = body;
                history.replaceState({}, '', routes[id] || '/vfeature123-async.html');
                harness.enable(id);
                feature.destroy();
                resetTracking();
                feature.init();
                feature.destroy();
                await Promise.resolve();
                const immediateArtifacts = Array.from(document.querySelectorAll('[id^="rx-"], [class*="rx-"], style[data-rx]'))
                    .map((node) => node.id || String(node.className || node.tagName))
                    .slice(0, 8);
                const immediateState = {
                    phase: 'immediate-disable',
                    id,
                    observers: activeObservers.size,
                    timeouts: activeTimeouts.size,
                    intervals: activeIntervals.size,
                    listeners: activeListeners.filter((entry) => entry.target === document
                        || entry.target === window
                        || !(entry.target instanceof Node)
                        || entry.target.isConnected).length,
                    artifacts: immediateArtifacts,
                };
                if (immediateState.observers || immediateState.timeouts || immediateState.intervals || immediateState.listeners || immediateState.artifacts.length) found.push(immediateState);
                try { feature.destroy(); } catch {}

                resetTracking();
                document.body.innerHTML = body;
                history.replaceState({}, '', routes[id] || '/vfeature123-async.html');
                harness.enable(id);
                feature.destroy();
                resetTracking();
                feature.init();
                await new Promise((resolve) => nativeSetTimeout(resolve, 30));
                feature.destroy();
                await Promise.resolve();
                const mountedArtifacts = Array.from(document.querySelectorAll('[id^="rx-"], [class*="rx-"], style[data-rx]'))
                    .map((node) => node.id || String(node.className || node.tagName))
                    .slice(0, 8);
                const mountedState = {
                    phase: 'mounted-cleanup',
                    id,
                    observers: activeObservers.size,
                    timeouts: activeTimeouts.size,
                    intervals: activeIntervals.size,
                    listeners: activeListeners.filter((entry) => entry.target === document
                        || entry.target === window
                        || !(entry.target instanceof Node)
                        || entry.target.isConnected).length,
                    artifacts: mountedArtifacts,
                };
                if (mountedState.observers || mountedState.timeouts || mountedState.intervals || mountedState.listeners || mountedState.artifacts.length) found.push(mountedState);
                try { feature.destroy(); } catch {}
            }

            resetTracking();
            EventTarget.prototype.addEventListener = nativeAdd;
            EventTarget.prototype.removeEventListener = nativeRemove;
            globalThis.setTimeout = nativeSetTimeout;
            globalThis.clearTimeout = nativeClearTimeout;
            globalThis.setInterval = nativeSetInterval;
            globalThis.clearInterval = nativeClearInterval;
            globalThis.MutationObserver = NativeMutationObserver;
            if (NativeIntersectionObserver) globalThis.IntersectionObserver = NativeIntersectionObserver;
            if (NativeResizeObserver) globalThis.ResizeObserver = NativeResizeObserver;
            return found;
        }, {
            body: BODY,
            featureIds: lifecycleFeatureIds,
            routes: Object.fromEntries(lifecycleFeatureIds.map((id) => [id, routeFor(id)])),
        });

        expect(leaks).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
});
