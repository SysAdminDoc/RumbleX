// @ts-check
// Shared harness for the catalog-wide feature specs. Instruments the lexical
// feature registry in-memory only; production source and distributable
// artifacts remain unchanged.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const readSource = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
const SCHEMA = readSource(path.join(ROOT, 'extension', 'settings-schema.js'));
const CORE_FILES = [
    'core-routing.js',
    'core-selectors.js',
    'core-video-cards.js',
    'core-media.js',
    'content.js',
];
const CORE = CORE_FILES
    .map((file) => readSource(path.join(ROOT, 'extension', file)))
    .join('\n\n');

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
    commentBlocking: 'rx-commentblock-css', realFramePreviews: 'rx-real-frame-previews-css',
    hideThumbnails: 'rx-thumbnailhider', denseMode: 'rx-densemode',
    compactAccountPagination: 'rx-acct-pagination', reducedMotion: 'rx-reduced-motion',
    homeCleanupPreset: 'rx-home-cleanup-preset', externalPlayerEnabled: 'rx-extplayer-css',
    rantTierFilter: 'rx-rant-tier-filter',
    bulkUnsubscribeEnabled: 'rx-bulk-unsub-css',
});

const HOME_FEATURES = new Set([
    'feedCleanup', 'categoryFilter', 'channelBlocker', 'shortsFilter', 'quickSave',
    'batchDownload', 'homeCleanupPreset', 'realFramePreviews',
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

module.exports = {
    ROOT, VERSION, SCHEMA, CORE, INSTRUMENTED_CORE, PLATFORM, BODY,
    INIT_STYLE_IDS, HOME_FEATURES, ACCOUNT_FEATURES, routeFor, createHarnessPage,
};
