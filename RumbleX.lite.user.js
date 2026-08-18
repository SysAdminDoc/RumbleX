// ==UserScript==
// @name         RumbleX Lite
// @namespace    https://github.com/SysAdminDoc/RumbleX
// @version      3.43.0
// @description  Rumble enhancement suite (Lite) — the same shared feature core, without the bundled transmuxers. Downloads save the raw stream; MP4 remux needs the full build or the extension.
// @author       SysAdminDoc
// @match        https://rumble.com/*
// @match        https://*.rumble.com/*
// @noframes
// @run-at       document-start
// @webRequest   [{"selector":"https://a.ads.rmbl.ws/*","action":"cancel"},{"selector":"https://a-delivery.rmbl.ws/*","action":"cancel"},{"selector":"https://imasdk.googleapis.com/*","action":"cancel"},{"selector":"https://s0.2mdn.net/instream/video/*","action":"cancel"},{"selector":"https://pagead2.googlesyndication.com/omsdk/*","action":"cancel"},{"selector":"https://*.doubleclick.net/*","action":"cancel"},{"selector":"https://*.googleadservices.com/pagead/*","action":"cancel"}]
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      rumble.com
// @connect      1a-1791.com
// @connect      rumble.cloud
// @downloadURL  https://raw.githubusercontent.com/SysAdminDoc/RumbleX/main/RumbleX.lite.user.js
// @updateURL    https://raw.githubusercontent.com/SysAdminDoc/RumbleX/main/RumbleX.lite.user.js
// ==/UserScript==

// Generated from extension/settings-schema.js + extension/content.js. Shared runtime SHA-256: 2684a8318add44062ba89d31badf63649cb1d1d253b804afbd4aabc1c3836d0b
// RumbleX shared settings schema. This file is the canonical source for
// defaults and trust-boundary normalization across content, options, popup,
// background profile/Gist restores, and the generated userscript.
'use strict';

(() => {
    if (globalThis.RumbleXSettingsSchema) return;

    const SCHEMA_VERSION = 3;
    const DEFAULTS = Object.freeze({
        adNuker: true,
        theaterSplit: true,
        feedCleanup: true,
        darkEnhance: true,
        hideReposts: true,
        wideLayout: true,
        videoDownload: true,
        splitRatio: 75,
        hiddenCategories: [],
        logoToFeed: true,
        hidePremium: true,
        speedController: true,
        scrollVolume: true,
        defaultMaxVolume: false,
        autoMaxQuality: true,
        watchProgress: true,
        channelBlocker: true,
        autoTheater: false,
        liveChatEnhance: true,
        videoTimestamps: true,
        screenshotBtn: true,
        watchHistory: true,
        autoplayBlock: true,
        searchHistory: true,
        miniPlayer: true,
        videoStats: true,
        loopControl: true,
        quickBookmark: true,
        commentNav: true,
        rantHighlight: true,
        relatedFilter: true,
        exactCounts: true,
        shareTimestamp: true,
        shortsFilter: true,
        chatAutoScroll: true,
        autoExpand: true,
        notifEnhance: true,
        quickSave: true,
        theme: 'catppuccin',
        playbackSpeed: 1.0,
        blockedChannels: [],
        // v1.8.0 additions
        fullTitles: true,
        titleFont: false,
        uniqueChatters: true,
        chatUserBlock: true,
        chatSpamDedup: true,
        chatExport: true,
        rantPersist: true,
        commentSort: true,
        popoutChat: true,
        keywordFilter: true,
        autoplayScheduler: false,
        chapters: true,
        sponsorBlock: true,
        videoClips: true,
        liveDVR: false,
        subtitleSidecar: true,
        transcripts: true,
        audioOnly: true,
        batchDownload: false,
        blockedChatters: [],
        blockedKeywords: [],
        sponsorSegments: {},
        autoplayQueue: [],
        // v1.9.0 — Rumble Enhancement Suite port
        // Interactive modules
        autoHideHeader: false,
        autoHideNavSidebar: false,
        autoLike: false,
        autoLoadComments: true,
        fullWidthPlayer: false,
        adaptiveLiveLayout: true,
        commentBlocking: true,
        siteThemeSync: false,
        siteTheme: 'system',
        blockedCommenters: [],
        // Main Page Layout (CSS hide-X toggles — all default OFF)
        widenSearchBar: false,
        hideUploadIcon: false,
        hideHeaderAd: false,
        hideProfileBacksplash: false,
        hideFeaturedBanner: false,
        hideEditorPicks: false,
        hideTopLiveCategories: false,
        hidePremiumRow: false,
        hideHomepageAd: false,
        hideForYouRow: false,
        hideGamingRow: false,
        hideFinanceRow: false,
        hideLiveRow: false,
        hideFeaturedPlaylistsRow: false,
        hideSportsRow: false,
        hideViralRow: false,
        hidePodcastsRow: false,
        hideLeaderboardRow: false,
        hideVlogsRow: false,
        hideNewsRow: false,
        hideScienceRow: false,
        hideMusicRow: false,
        hideEntertainmentRow: false,
        hideCookingRow: false,
        hideFooter: false,
        // Video Page Layout
        hideRelatedOnLive: false,
        hideRelatedSidebar: false,
        widenContent: false,
        hideVideoDescription: false,
        hidePausedVideoAds: false,
        // Player Controls
        hideRewindButton: false,
        hideFastForwardButton: false,
        hideCCButton: false,
        hideAutoplayButton: false,
        hideTheaterButton: false,
        hidePipButton: false,
        hideFullscreenButton: false,
        hidePlayerRumbleLogo: false,
        hidePlayerGradient: false,
        // Video Buttons
        hideLikeDislikeButton: false,
        hideShareButton: false,
        hideRepostButton: false,
        hideEmbedButton: false,
        hideSaveButton: false,
        hideCommentButton: false,
        hideReportButton: false,
        hidePremiumJoinButtons: false,
        // Comments
        moveReplyButton: false,
        hideCommentReportLink: false,
        // Chat
        cleanLiveChat: false,

        // ── v2.0.0 — Schema v2, Core Engine, Settings Superset ──
        schemaVersion: SCHEMA_VERSION,
        // Core & theming
        denseMode: true,
        reducedMotion: false,
        glassIntensity: 'medium',
        accentColor: 'rumbleGreen',
        legacyKeyboardNav: false,
        debugSelectorTelemetry: false,
        // v3.20.0 — Per-feature error log ring buffer (Observability workstream)
        // Default OFF; when ON, feature init failures land in rx_error_log
        // for export via the options page. Local-only — never shipped remotely.
        debugErrorLog: false,
        // Layout & UI cleanup
        hideThumbnails: false,
        hideThumbnailsFeeds: false,
        hideThumbnailsRelated: false,
        compactAccountPagination: false,
        homeCleanupPreset: 'none',
        pageDensity: 'dense',
        // Player
        qualityMode: 'best',
        perChannelVolumeMemory: false,
        autoplayBlockMode: 'relatedEndpointAndPlayer',
        clipExportFormat: 'mp4',
        segmentSkipMode: 'localOnly',
        // Downloads & archives
        downloadManagerEnabled: true,
        downloadQualityPreference: 'best',
        downloadIncludeMetadata: true,
        downloadIncludeThumbnail: false,
        downloadLiveStreams: false,
        downloadShorts: true,
        downloadConcurrency: 2,
        downloadProbeCacheTtlHours: 24,
        downloadMuxerEngine: 'muxjs',
        audioExtractionMode: 'browserIfSupported',
        externalPlayerEnabled: false,
        externalPlayerTemplate: '',
        channelArchiveEnabled: false,
        channelArchiveFilterClips: false,
        channelArchiveMaxItems: 50,
        // v3.21.0 — Max-height cap for channel archive downloads.
        // Allowed: 'best' | '2160' | '1440' | '1080' | '720' | '480' | '360'.
        // The discoverer picks the highest direct-MP4 quality at or below this height.
        channelArchiveMaxHeight: 'best',
        // v3.24.0 — Subfolder name (relative to user's default Downloads folder).
        // Sanitized SW-side: alphanumerics + ` _-.` only; '..' segments stripped.
        channelArchiveSubfolder: 'RumbleX',
        // v3.19.0 — In-page "Archive channel" button on /c/<slug> + /user/<slug>
        channelArchiveButton: true,
        // Feed, filtering & moderation
        shortsFilterScope: 'everywhere',
        blockedChannelsMeta: [],
        blockedKeywordsMode: 'literal',
        filterPreviewBadges: true,
        politicsFilterPreset: 'off',
        remoteCosmeticRules: false,
        remoteCosmeticRulesChannel: 'stable',
        // Live chat & rants
        chatMentionHighlight: true,
        chatClickToMention: true,
        chatParticipantsList: false,
        chatUsernameColors: 'deterministic',
        chatTimedMutes: true,
        chatMuteDurations: [15, 30, 60, 240],
        rantStatsPanel: true,
        rantExportFormat: 'csvJson',
        rantTierFilter: 0,
        rantStickyHighValue: true,
        multiStreamViewer: false,
        // Comments
        commentThreadView: false,
        commentSearch: false,
        commentMuteDurations: [1440, 10080],
        commentExport: false,
        // Automation, creator & integrations
        bulkUnsubscribeEnabled: false,
        bulkUnsubscribeDryRun: true,
        channelNotifierEnabled: false,
        discordWebhookUrl: '',
        rssExportEnabled: false,
        creatorMode: false,
        uploaderMetadataFill: false,
        studioSceneTools: false,
        obsAlertExport: false,
        // Privacy, data & backup
        stripTrackingParams: true,
        privacyReport: true,
        activeProfileId: 'default',
        backupHistory: true,
        backupHistoryLimit: 10,
        encryptedGistSync: false,
        // v3.17.0 — Encrypted Gist Sync credentials. Token is a GitHub PAT
        // with the `gist` scope. Gist ID is set once on first push (or filled
        // manually if syncing from an existing gist). Passphrase is NEVER
        // stored — user enters it on every push/pull.
        encryptedGistSyncToken: '',
        encryptedGistSyncId: '',

        // ── v3.1.0 — Rumble Shorts (Feb 2026) + Wallet (Jan 2026) ──
        disableShortsFeed: false,    // redirects /shorts → /subscriptions when ON
        hideWalletTipButton: false,  // hides per-creator tip jar button

        // ── v3.5.0 — chrome.contextMenus integration ──
        contextMenusEnabled: true,

        // ── v3.7.0 — chrome.sidePanel integration ──
        // Default OFF; users opt in from the popup. Once on, clicking the
        // toolbar icon opens the persistent side panel instead of the popup.
        sidePanelEnabled: false,

        // ── v3.9.0 — Channel Notifier ──
        // Array of channel objects: { url, name, lastSeenVideoId, lastChecked,
        //   isLive, etag }. Populated through the options-page UI.
        watchedChannels: [],
        // Poll interval in minutes. chrome.alarms enforces a 1-minute floor in
        // Chrome MV3 — anything lower is silently clamped.
        channelNotifierIntervalMin: 30,

        // ── v3.26.0 — File System Access folder picker (BatchDownload) ──
        // Display label of the most recently picked folder. Empty string means
        // "no folder picked, use chrome.downloads.download() default path".
        // The actual FileSystemDirectoryHandle is NOT JSON-serializable and is
        // persisted separately in IndexedDB (db: rx-fs-access, store: handles).
        // Chrome / Edge only; Firefox MV2 ignores the setting and uses the
        // chrome.downloads path unconditionally.
        batchDownloadFolderName: '',

        // ── v3.26.0 — Offline resilience for Channel Archive queue ──
        // When ON (default), the archive-queue alarm tick short-circuits while
        // navigator.onLine is false so jobs aren't burned on guaranteed-fail
        // network ops. Resumes automatically on the first online tick.
        archiveQueuePauseOnOffline: true,
    });
    const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
    const STRING_ARRAYS = new Set([
        'blockedChannels', 'blockedChatters', 'blockedKeywords', 'blockedCommenters',
    ]);
    const ENUM_VALUES = Object.freeze({
        theme: ['catppuccin', 'youtube', 'midnight', 'rumbleGreen', 'oledGreen'],
        siteTheme: ['system', 'dark', 'light'],
        glassIntensity: ['low', 'medium', 'high'],
        homeCleanupPreset: ['none', 'focused', 'minimal', 'custom'],
        pageDensity: ['dense', 'normal'],
        qualityMode: ['best', 'lowest', 'manual', 'bandwidthSaver'],
        autoplayBlockMode: ['off', 'relatedEndpointAndPlayer', 'playerOnly'],
        clipExportFormat: ['mp4', 'webm', 'manifestOnly'],
        segmentSkipMode: ['localOnly', 'community'],
        downloadQualityPreference: ['best', '1080p', '720p', '480p', 'lowest', 'askInline'],
        downloadMuxerEngine: ['muxjs', 'mediabunnyWebCodecs'],
        audioExtractionMode: ['off', 'browserIfSupported', 'companion', 'external'],
        channelArchiveMaxHeight: ['best', '2160', '1440', '1080', '720', '480', '360'],
        shortsFilterScope: ['everywhere', 'feedOnly', 'searchOnly', 'off'],
        blockedKeywordsMode: ['literal', 'regex', 'wildcard'],
        politicsFilterPreset: ['off', 'reduce', 'hide'],
        remoteCosmeticRulesChannel: ['stable', 'preview'],
        chatUsernameColors: ['off', 'deterministic', 'tiered'],
        rantExportFormat: ['csvJson', 'csv', 'json'],
    });
    const NUMERIC_BOUNDS = Object.freeze({
        splitRatio: [20, 95], playbackSpeed: [0.1, 4],
        downloadConcurrency: [1, 8], downloadProbeCacheTtlHours: [0, 168],
        channelArchiveMaxItems: [1, 500], rantTierFilter: [0, 1_000_000],
        backupHistoryLimit: [1, 50], channelNotifierIntervalMin: [1, 1440],
    });
    const HIDDEN_CATEGORIES = new Set([
        'editor-picks', 'shorts', 'continue-watching', 'top-live',
        'premium-videos', 'personal-recommendations', 'reposts',
        'gaming', 'finance', 'live-videos', 'featured-playlists',
        'sports', 'viral', 'podcasts', 'leaderboard', 'vlogs',
        'news', 'science', 'music', 'entertainment', 'cooking',
    ]);
    const SPONSOR_CATEGORIES = new Set(['sponsor', 'intro', 'outro', 'selfpromo', 'interaction']);

    function isPlainObject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const proto = Object.getPrototypeOf(value);
        return proto === Object.prototype || proto === null;
    }

    function safeString(value, max = 2_000) {
        return typeof value === 'string'
            ? value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max)
            : null;
    }

    function cloneSafe(value, depth = 0) {
        if (depth > 8) return undefined;
        if (value == null || typeof value === 'boolean') return value;
        if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
        if (typeof value === 'string') return value.slice(0, 20_000);
        if (Array.isArray(value)) {
            if (value.length > 10_000) return undefined;
            const out = [];
            for (const item of value) {
                const safe = cloneSafe(item, depth + 1);
                if (safe !== undefined) out.push(safe);
            }
            return out;
        }
        if (!isPlainObject(value)) return undefined;
        const out = {};
        for (const [key, child] of Object.entries(value)) {
            if (FORBIDDEN_KEYS.has(key) || Object.keys(out).length >= 2_000) continue;
            const safe = cloneSafe(child, depth + 1);
            if (safe !== undefined) out[key] = safe;
        }
        return out;
    }

    function safeRumbleUrl(value) {
        const text = safeString(value, 2_000);
        if (!text) return null;
        try {
            const parsed = new URL(text);
            return parsed.protocol === 'https:' && /(^|\.)rumble\.com$/i.test(parsed.hostname)
                ? parsed.href
                : null;
        } catch { return null; }
    }

    // The channel notifier POSTs a Discord-shaped `{ content }` payload, so any
    // non-Discord destination is already broken at the protocol level. Treating
    // this as a free string let a crafted backup, snapshot, or Gist pull install
    // an arbitrary outbound endpoint for followed-channel activity.
    function safeWebhookUrl(value) {
        const text = safeString(value, 500);
        if (!text) return null;
        try {
            const parsed = new URL(text);
            if (parsed.protocol !== 'https:') return null;
            if (parsed.username || parsed.password) return null;
            if (!/^(?:(?:canary|ptb)\.)?discord(?:app)?\.com$/i.test(parsed.hostname)) return null;
            if (!/^\/api\/webhooks\/[^/]+\/[^/]+$/.test(parsed.pathname)) return null;
            return parsed.origin + parsed.pathname;
        } catch { return null; }
    }

    function normalizeDurations(value) {
        return Array.isArray(value)
            ? [...new Set(value.filter((item) => Number.isFinite(item))
                .map((item) => Math.round(item))
                .filter((item) => item >= 1 && item <= 525_600))].slice(0, 50)
            : null;
    }

    function migrate(input) {
        if (!isPlainObject(input)) return {};
        const current = Number(input.schemaVersion) || 0;
        if (current >= SCHEMA_VERSION) return input;
        const out = { ...input };
        if ('keyboardNav' in out && !('legacyKeyboardNav' in out)) {
            out.legacyKeyboardNav = !!out.keyboardNav;
        }
        delete out.keyboardNav;
        // v3 - `bookmarks` and `settingsProfiles` were schema keys that nothing
        // ever read. The real collections live in their own storage buckets
        // (`rx_bookmarks`, `rx_settings_profiles`), so these two only ever
        // rendered decorative controls in Options. Drop them explicitly so an
        // upgraded profile is cleaned deterministically.
        delete out.bookmarks;
        delete out.settingsProfiles;
        out.schemaVersion = SCHEMA_VERSION;
        return out;
    }

    function normalize(input, defaults = DEFAULTS) {
        if (!isPlainObject(input) || !isPlainObject(defaults)) return {};
        const out = {};
        for (const [key, value] of Object.entries(input)) {
            if (!Object.hasOwn(defaults, key) || FORBIDDEN_KEYS.has(key)) continue;
            const expected = defaults[key];
            if (key === 'hiddenCategories') {
                if (Array.isArray(value)) out[key] = [...new Set(value.filter((item) => HIDDEN_CATEGORIES.has(item)))];
                continue;
            }
            if (STRING_ARRAYS.has(key)) {
                if (Array.isArray(value)) {
                    out[key] = [...new Set(value.map((item) => safeString(item, 500)).filter(Boolean))].slice(0, 2_000);
                }
                continue;
            }
            if (key === 'discordWebhookUrl') {
                const webhook = safeWebhookUrl(value);
                out[key] = webhook || '';
                continue;
            }
            if (key === 'autoplayQueue') {
                if (Array.isArray(value)) out[key] = [...new Set(value.map(safeRumbleUrl).filter(Boolean))].slice(0, 500);
                continue;
            }
            if (key === 'watchedChannels') {
                if (!Array.isArray(value)) continue;
                out[key] = value.slice(0, 500).flatMap((item) => {
                    if (!isPlainObject(item)) return [];
                    const url = safeRumbleUrl(item.url);
                    const name = safeString(item.name, 300);
                    if (!url) return [];
                    return [{
                        url,
                        name: name || url,
                        lastSeenVideoId: safeString(item.lastSeenVideoId, 120),
                        isLive: !!item.isLive,
                        lastChecked: Number.isFinite(item.lastChecked) && item.lastChecked >= 0
                            ? Math.round(item.lastChecked)
                            : null,
                    }];
                });
                continue;
            }
            if (key === 'chatMuteDurations' || key === 'commentMuteDurations') {
                const durations = normalizeDurations(value);
                if (durations) out[key] = durations;
                continue;
            }
            if (key === 'sponsorSegments') {
                if (!isPlainObject(value)) continue;
                const segments = {};
                for (const [videoId, list] of Object.entries(value).slice(0, 1_000)) {
                    if (!/^v[a-z0-9]+$/i.test(videoId) || !Array.isArray(list)) continue;
                    const safeList = list.slice(0, 200).flatMap((segment) => {
                        if (!isPlainObject(segment)) return [];
                        const start = Number(segment.start);
                        const end = Number(segment.end);
                        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > 604_800) return [];
                        return [{
                            start,
                            end,
                            category: SPONSOR_CATEGORIES.has(segment.category) ? segment.category : 'sponsor',
                        }];
                    });
                    if (safeList.length) segments[videoId] = safeList;
                }
                out[key] = segments;
                continue;
            }
            if (key === 'schemaVersion') {
                out[key] = SCHEMA_VERSION;
                continue;
            }
            if (ENUM_VALUES[key]) {
                if (ENUM_VALUES[key].includes(value)) out[key] = value;
                continue;
            }
            if (NUMERIC_BOUNDS[key]) {
                if (typeof value !== 'number' || !Number.isFinite(value)) continue;
                const [min, max] = NUMERIC_BOUNDS[key];
                out[key] = Math.min(max, Math.max(min, value));
                continue;
            }
            const safe = cloneSafe(value);
            if (safe === undefined) continue;
            if (Array.isArray(expected)) {
                if (Array.isArray(safe)) out[key] = safe;
            } else if (expected && typeof expected === 'object') {
                if (isPlainObject(safe)) out[key] = safe;
            } else if (typeof safe === typeof expected) {
                out[key] = safe;
            }
        }
        return out;
    }

    // Keys that are declared and persisted but that no runtime code reads yet.
    //
    // Every one of these once rendered a fully live control in the Options page,
    // so a user could flip it, see it save, and get no behavior change — the
    // toggle silently did nothing. That is a trust defect, not a cosmetic one.
    // Options renders anything listed here as explicitly "not implemented yet"
    // and refuses to pretend otherwise, and `scripts/check-settings-consumers.js`
    // asserts this list matches the real set of unread keys exactly, in both
    // directions. Wiring a key to real behavior means deleting it from here; the
    // guard fails until you do, and it also fails if a key stops being read.
    const UNIMPLEMENTED = Object.freeze({
        // Appearance preferences the theme engine does not consult.
        glassIntensity: 'Theme engine applies a fixed glass treatment.',
        accentColor: 'Theme engine applies the active theme accent.',
        pageDensity: 'Layout density is fixed by the active theme.',

        // Playback preferences with no consumer; see the playback-resilience
        // roadmap item, which wires qualityMode as part of its acceptance.
        qualityMode: 'AutoMaxQuality always targets the highest rendition.',
        perChannelVolumeMemory: 'Volume is remembered globally, not per channel.',

        // Download and export preferences the download pipeline ignores.
        clipExportFormat: 'Clip export always writes MP4.',
        segmentSkipMode: 'SponsorBlock segments are always local-only.',
        downloadQualityPreference: 'Downloader always offers every rendition.',
        downloadIncludeMetadata: 'Metadata sidecar is written per download-panel choice.',
        downloadIncludeThumbnail: 'Thumbnail sidecar is written per download-panel choice.',
        downloadLiveStreams: 'Live-stream downloads are gated by page state, not this key.',
        downloadShorts: 'Shorts downloads are gated by page state, not this key.',
        audioExtractionMode: 'Audio extraction always prefers the browser encoder.',
        rantExportFormat: 'Rant export always writes both CSV and JSON.',

        // Channel archive preferences. The archive queue reads
        // channelArchiveMaxHeight and channelArchiveSubfolder, but not these.
        channelArchiveEnabled: 'Archive availability follows channelArchiveButton.',
        channelArchiveFilterClips: 'Archive queue does not filter clips.',
        channelArchiveMaxItems: 'Archive queue uses its own internal cap.',

        // Feed and filter preferences with no consumer.
        shortsFilterScope: 'Shorts filtering applies everywhere unconditionally.',
        blockedChannelsMeta: 'Channel blocks carry no expiry or reason metadata.',
        filterPreviewBadges: 'Filtered cards are hidden outright, never badged.',
        politicsFilterPreset: 'No preset keyword bundles are shipped.',
        remoteCosmeticRulesChannel: 'Remote cosmetic rules use a single channel.',

        // Chat features that were never built.
        chatMentionHighlight: 'Not built.',
        chatClickToMention: 'Not built.',
        chatParticipantsList: 'Not built.',
        chatTimedMutes: 'Not built.',
        chatMuteDurations: 'Configures the unbuilt timed-mute feature.',

        // Rant features that were never built.
        rantStatsPanel: 'Not built.',
        rantStickyHighValue: 'Not built.',

        // Comment features that were never built.
        commentThreadView: 'Not built.',
        commentSearch: 'Not built.',
        commentMuteDurations: 'Configures the unbuilt comment-mute feature.',

        // Creator and multi-view features that were never built.
        multiStreamViewer: 'Not built.',
        rssExportEnabled: 'Not built.',
        creatorMode: 'Not built.',
        uploaderMetadataFill: 'Not built.',
        studioSceneTools: 'Not built.',
        obsAlertExport: 'Not built.',
    });

    function normalizeStored(input, defaults = DEFAULTS) {
        return normalize(migrate(input), defaults);
    }

    Object.defineProperty(globalThis, 'RumbleXSettingsSchema', {
        value: Object.freeze({
            SCHEMA_VERSION,
            DEFAULTS,
            migrate,
            normalize,
            normalizeStored,
            safeRumbleUrl,
            safeWebhookUrl,
            UNIMPLEMENTED,
        }),
        configurable: false,
        enumerable: false,
        writable: false,
    });
})();


// RumbleX platform adapter - generated userscript runtime
'use strict';

(() => {
    const VERSION = "3.43.0";
    const ASSETS = Object.freeze({});
    const MESSAGES = Object.freeze({"extName":"RumbleX","extDescription":"Rumble enhancement suite — ad/bloat removal, theater split view, video downloads, dark theme polish, and 130+ feature toggles.","actionTitle":"RumbleX","openSettingsEditor":"Open Settings Editor","exportBackup":"Export Backup","importBackup":"Import Backup","resetAllData":"Reset All Data","snapshotHistory":"Backup snapshot history","snapshotTakeNow":"Take snapshot now","snapshotRestore":"Restore","privacyReport":"Privacy report","telemetryNone":"Telemetry: none — no analytics, no remote logging, no usage beacons","settingsTotal":"settings","settingsUnsaved":"unsaved","saveBtn":"Save","discardBtn":"Discard","restoreDefaultsBtn":"Restore Defaults","groupAll":"All Settings","groupCore":"Core","groupAdBlocking":"Ad Blocking","groupVideoPlayer":"Video Player","groupDownloads":"Downloads & Capture","groupHistory":"History & Bookmarks","groupChat":"Comments & Chat","groupFeedControls":"Feed Controls","groupAutomation":"Automation","groupCreator":"Creator & Studio","groupIntegrations":"Integrations","groupPrivacy":"Privacy & Data","groupAdvanced":"Advanced","tipDisableShortsFeed":"Disable Shorts Feed","tipHideWalletTipButton":"Hide Wallet Tip Button","popupLocalAutosave":"Local changes autosave","popupOpenOptionsHint":"Search, groups, import/export, reset","reloadAfterChanges":"Reload after changes","groupRumbleTabs":"Group all Rumble tabs","openOptionsPage":"Open options page","githubRepo":"GitHub repo","checkForUpdates":"Check for updates","themeLabel":"Theme","noRumbleTabsOpen":"No Rumble tabs open","tabGroupsUnsupported":"Tab groups not supported in this browser","groupFailed":"Group failed","checkingUpdates":"Checking...","checkFailed":"Check failed","checkRateLimited":"GitHub rate limit reached — try again later","upToDate":"Up to date!","appStatusLocal":"Local","storageStatus":"Storage status","controlCenter":"Control center","optionsSettingsTitle":"Settings and local data","optionsIntro":"Review every RumbleX toggle, back up your local data, and manage blocked channels, keywords, chatters, and SponsorBlock segments from one control surface.","storageStatistics":"Storage statistics","enabledLabel":"Enabled","storageLabel":"Storage","channelsLabel":"Channels","keywordsLabel":"Keywords","chattersLabel":"Chatters","readingLocalStorage":"Reading local storage...","dataManagement":"Data management","loading":"Loading...","refreshList":"Refresh list","privacyReportCopy":"Every external network surface RumbleX can touch, telemetry status, and current storage footprint. Pure read - no network calls trigger when you open this.","refresh":"Refresh","exportJson":"Export JSON","exportSelectorTelemetry":"Export selector telemetry","exportErrorLog":"Export error log","clearErrorLog":"Clear error log","copyDownloadDiagnostics":"Copy download diagnostics","exportDownloadDiagnostics":"Export download diagnostics","clearDownloadDiagnostics":"Clear download diagnostics","preparingDownloadDiagnostics":"Preparing sanitized diagnostics…","downloadDiagnosticsUnavailable":"Diagnostics unavailable:","downloadDiagnosticsCopied":"Sanitized diagnostics copied.","downloadDiagnosticsExported":"Sanitized diagnostics exported.","downloadDiagnosticsEmpty":"Download diagnostics are empty. A sanitized entry is captured automatically after a failed download or clip export.","downloadDiagnosticsCleared":"Download diagnostics cleared.","copyDownloadDiagnosticsFailed":"Could not copy download diagnostics:","exportDownloadDiagnosticsFailed":"Could not export download diagnostics:","clearDownloadDiagnosticsFailed":"Could not clear download diagnostics:","settingsTitle":"Settings","closeSettings":"Close settings","searchSettings":"Search settings...","clearSearch":"Clear search","settingGroups":"Setting groups","settingsInSync":"Everything is in sync","settingsLocalUntilSave":"Changes stay local until you save them.","clearFilters":"Clear Filters","filteredView":"Filtered View","noSettingsMatch":"No settings match this view","broaderSearchOrGroup":"Try a broader search or switch back to All Settings.","catalogLabel":"Catalog","noSettingsAvailable":"No settings are available","noSettingsFound":"No defaults or stored settings were found.","noSettingsMatchSearchHere":"No settings match this search here","switchGroupsOrAll":"Switch groups or jump back to All Settings.","noSettingsMatchSearch":"No settings match this search","shorterKeywordOrClear":"Try a shorter keyword or clear the filter.","groupThemeLayout":"Theme & Layout","groupNavigation":"Navigation & Chrome","groupMainPage":"Main Page Layout","groupVideoPage":"Video Page Layout","groupPlayerControls":"Player Controls","groupVideoButtons":"Video Buttons","groupCommentsExtra":"Comments & Chat (extras)","networkShieldActive":"Network shield active","networkShieldDescription":"Verified ad delivery and measurement requests are blocked before page code can run.","networkShieldVerified":"7 verified request rules","networkShieldDomNote":"Ad Nuker controls the remaining DOM cleanup.","networkShieldManagerLimited":"Network shield depends on your userscript manager","networkShieldManagerNote":"DOM cleanup stays active; Chromium MV3 managers cannot expose early request blocking."});
    const STORAGE_KEYS_WITH_CHANGE_EVENTS = ['rx_settings'];
    const ALLOWED_REQUEST_HOSTS = ['rumble.com', 'rumble.cloud', '1a-1791.com'];
    const DIAGNOSTICS_KEY = 'rx_download_diagnostics';
    const DIAGNOSTICS_MAX = 50;
    const assetUrls = new Map();
    const hasMediabunnyAssets = 'mediabunny-worker.js' in ASSETS && 'lib/mediabunny.min.mjs' in ASSETS;
    // The Greasy Fork-compliant "lite" build ships without either bundled
    // transmuxer, so MP4 remux is unavailable there and raw TS save is the only
    // download path. Detect it rather than letting the download fail at use.
    const hasMuxjsAssets = 'worker.js' in ASSETS && 'lib/mux.min.js' in ASSETS;

    const isAllowedRemoteUrl = (url) => url.protocol === 'https:' && ALLOWED_REQUEST_HOSTS.some((host) =>
        url.hostname === host || url.hostname.endsWith('.' + host)
    );

    const storage = Object.freeze({
        async get(keys) {
            const list = typeof keys === 'string'
                ? [keys]
                : Array.isArray(keys)
                    ? keys
                    : keys && typeof keys === 'object'
                        ? Object.keys(keys)
                        : [];
            const out = {};
            for (const key of list) {
                const fallback = keys && !Array.isArray(keys) && typeof keys === 'object' ? keys[key] : undefined;
                out[key] = await Promise.resolve(GM_getValue(key, fallback));
            }
            return out;
        },
        async set(values) {
            if (!values || typeof values !== 'object') return;
            for (const [key, value] of Object.entries(values)) {
                await Promise.resolve(GM_setValue(key, value));
            }
        },
        async remove(keys) {
            for (const key of (Array.isArray(keys) ? keys : [keys])) {
                if (typeof key === 'string') await Promise.resolve(GM_deleteValue(key));
            }
        },
        onChanged(listener) {
            if (typeof listener !== 'function' || typeof GM_addValueChangeListener !== 'function') return () => {};
            const ids = STORAGE_KEYS_WITH_CHANGE_EVENTS.map((key) =>
                GM_addValueChangeListener(key, (_name, oldValue, newValue, remote) => {
                    listener({ [key]: { oldValue, newValue, remote: !!remote } });
                })
            );
            return () => {
                if (typeof GM_removeValueChangeListener !== 'function') return;
                for (const id of ids) GM_removeValueChangeListener(id);
            };
        },
    });

    function responseHeaders(raw) {
        const headers = new Headers();
        for (const line of String(raw || '').split(/\r?\n/)) {
            const split = line.indexOf(':');
            if (split <= 0) continue;
            const name = line.slice(0, split).trim();
            const value = line.slice(split + 1).trim();
            if (name && value) headers.append(name, value);
        }
        return headers;
    }

    function gmFetch(url, init = {}) {
        const parsed = new URL(String(url), location.href);
        if (!isAllowedRemoteUrl(parsed)) {
            return Promise.reject(new Error(`RumbleX refused an unapproved request URL: ${parsed.href}`));
        }
        return new Promise((resolve, reject) => {
            if (init.signal?.aborted) {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
                return;
            }
            let settled = false;
            let request;
            const cleanup = () => init.signal?.removeEventListener?.('abort', abort);
            const finish = (fn, value) => {
                if (settled) return;
                settled = true;
                cleanup();
                fn(value);
            };
            const abort = () => {
                try { request?.abort?.(); } catch {}
                finish(reject, new DOMException('The operation was aborted.', 'AbortError'));
            };
            init.signal?.addEventListener?.('abort', abort, { once: true });
            const headers = {};
            if (init.headers instanceof Headers) {
                for (const [key, value] of init.headers.entries()) headers[key] = value;
            } else if (init.headers && typeof init.headers === 'object') {
                Object.assign(headers, init.headers);
            }
            request = GM_xmlhttpRequest({
                method: String(init.method || 'GET').toUpperCase(),
                url: parsed.href,
                headers,
                data: init.body,
                responseType: 'arraybuffer',
                timeout: Math.max(1_000, Math.min(120_000, Number(init.rxTimeoutMs) || 30_000)),
                anonymous: init.credentials === 'omit',
                onload(result) {
                    const body = result.response instanceof ArrayBuffer ? result.response : new ArrayBuffer(0);
                    const response = new Response(body, {
                        status: result.status || 200,
                        statusText: result.statusText || '',
                        headers: responseHeaders(result.responseHeaders),
                    });
                    try { Object.defineProperty(response, 'url', { value: result.finalUrl || parsed.href }); } catch {}
                    finish(resolve, response);
                },
                onerror() { finish(reject, new TypeError('Network request failed')); },
                ontimeout() { finish(reject, new DOMException('The operation timed out.', 'TimeoutError')); },
                onabort: abort,
            });
        });
    }

    function platformFetch(input, init = {}) {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
        if (url.protocol === 'blob:' || url.protocol === 'data:' || url.origin === location.origin) {
            return fetch(input, init);
        }
        return gmFetch(url.href, init);
    }

    function saveWithAnchor(url, filename) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename || 'rumblex-download';
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        return { downloadId: `userscript-${Date.now()}` };
    }

    async function download(data) {
        const url = String(data?.url || '');
        const filename = String(data?.filename || 'rumblex-download').replace(/[\\/:*?"<>|]/g, '_').slice(0, 180);
        const parsed = new URL(url, location.href);
        if (parsed.protocol === 'blob:' || parsed.protocol === 'data:') return saveWithAnchor(parsed.href, filename);
        if (!isAllowedRemoteUrl(parsed)) throw new Error(`Download URL is not allowed: ${parsed.href}`);
        if (typeof GM_download !== 'function') return saveWithAnchor(parsed.href, filename);
        return new Promise((resolve, reject) => {
            try {
                GM_download({
                    url: parsed.href,
                    name: filename,
                    saveAs: false,
                    timeout: 120_000,
                    onload() { resolve({ downloadId: `userscript-${Date.now()}` }); },
                    onerror(error) {
                        reject(new Error(error?.error || error?.details || 'Userscript download failed'));
                    },
                    ontimeout() {
                        reject(new Error('Userscript download timed out'));
                    },
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    function sanitizeDiagnostic(value, key = '', depth = 0) {
        if (/authorization|cookie|credential|password|passphrase|secret|token|api[_-]?key|signature/i.test(key)) return '[redacted]';
        if (depth > 5) return '[truncated]';
        if (value == null || typeof value === 'boolean') return value;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        if (typeof value === 'string') {
            return value.slice(0, 1200).replace(/https?:\/\/[^\s<>"')]+/gi, (raw) => {
                try {
                    const parsed = new URL(raw);
                    return parsed.origin + parsed.pathname.split('/').map((part, index) =>
                        index < 2 || !part ? part : '[redacted]'
                    ).join('/');
                } catch { return '[redacted-url]'; }
            });
        }
        if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeDiagnostic(item, key, depth + 1));
        if (typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).slice(0, 40).map(([childKey, childValue]) => [
                String(childKey).slice(0, 80),
                sanitizeDiagnostic(childValue, childKey, depth + 1),
            ]));
        }
        return String(value).slice(0, 1200);
    }

    async function recordDiagnostic(diagnostic) {
        const stored = await storage.get(DIAGNOSTICS_KEY);
        const entries = Array.isArray(stored[DIAGNOSTICS_KEY]) ? stored[DIAGNOSTICS_KEY] : [];
        const entry = {
            ...sanitizeDiagnostic(diagnostic || {}),
            id: `rxd-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
            at: new Date().toISOString(),
            userscriptVersion: VERSION,
            source: 'userscript',
        };
        entries.push(entry);
        await storage.set({ [DIAGNOSTICS_KEY]: entries.slice(-DIAGNOSTICS_MAX) });
        return entry;
    }

    async function sendMessage(message) {
        switch (message?.action) {
            case 'download':
                return download(message.data);
            case 'recordDownloadDiagnostic': {
                const entry = await recordDiagnostic(message.diagnostic);
                return { ok: true, id: entry.id };
            }
            case 'getDownloadDiagnostics': {
                const stored = await storage.get(DIAGNOSTICS_KEY);
                const attempts = Array.isArray(stored[DIAGNOSTICS_KEY]) ? stored[DIAGNOSTICS_KEY] : [];
                return {
                    ok: true,
                    bundle: {
                        schemaVersion: 1,
                        generatedAt: new Date().toISOString(),
                        userscriptVersion: VERSION,
                        count: attempts.length,
                        privacy: 'Local-only diagnostics with URL and credential-like values redacted before storage.',
                        capabilities: { userscript: true, managedDownloads: typeof GM_download === 'function' },
                        attempts,
                    },
                };
            }
            case 'getPendingLocalDataOperation':
                return { ok: true, operation: null };
            case 'completePendingLocalDataOperation':
                return { ok: true, cleared: false };
            case 'archiveEnqueueChannel':
                return { ok: false, reason: 'persistent-background-unavailable' };
            default:
                return { ok: false, reason: 'unsupported-userscript-message' };
        }
    }

    async function migrateLegacySettings(defaults) {
        const existing = await storage.get('rx_settings');
        if (existing.rx_settings && typeof existing.rx_settings === 'object') return null;
        const migrated = {};
        for (const key of Object.keys(defaults || {})) {
            const value = await Promise.resolve(GM_getValue('rx_' + key, undefined));
            if (value !== undefined) migrated[key] = value;
        }
        const keyboardNav = await Promise.resolve(GM_getValue('rx_keyboardNav', undefined));
        if (keyboardNav !== undefined && migrated.legacyKeyboardNav === undefined) migrated.legacyKeyboardNav = !!keyboardNav;
        const speedControl = await Promise.resolve(GM_getValue('rx_speedControl', undefined));
        if (speedControl !== undefined && migrated.speedController === undefined) migrated.speedController = !!speedControl;
        const shareTools = await Promise.resolve(GM_getValue('rx_shareTools', undefined));
        if (shareTools !== undefined) {
            if (migrated.shareTimestamp === undefined) migrated.shareTimestamp = !!shareTools;
            if (migrated.stripTrackingParams === undefined) migrated.stripTrackingParams = !!shareTools;
        }
        if (!Object.keys(migrated).length) return null;
        migrated.schemaVersion = Number(migrated.schemaVersion) || 2;
        await storage.set({ rx_settings: migrated });
        return migrated;
    }

    const manifest = Object.freeze({
        manifest_version: null,
        version: VERSION,
        permissions: ['GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_addValueChangeListener', 'GM_removeValueChangeListener', 'GM_xmlhttpRequest', 'GM_download', 'userscriptWebRequest'],
        host_permissions: ['https://rumble.com/*', 'https://*.rumble.com/*', 'https://1a-1791.com/*', 'https://*.1a-1791.com/*', 'https://rumble.cloud/*', 'https://*.rumble.cloud/*'],
        web_accessible_resources: [],
    });

    function assetUrl(path) {
        if (!(path in ASSETS)) throw new Error(`Userscript asset is unavailable: ${path}`);
        if (assetUrls.has(path)) return assetUrls.get(path);
        if (typeof URL.createObjectURL !== 'function') throw new Error('Blob asset URLs are unavailable');
        const type = /\.(?:m?js)$/i.test(path) ? 'text/javascript' : 'text/plain';
        const url = URL.createObjectURL(new Blob([ASSETS[path]], { type }));
        assetUrls.set(path, url);
        return url;
    }

    globalThis.addEventListener?.('pagehide', () => {
        for (const url of assetUrls.values()) URL.revokeObjectURL?.(url);
        assetUrls.clear();
    }, { once: true });

    globalThis.RumbleXPlatform = Object.freeze({
        kind: 'userscript',
        version: VERSION,
        capabilities: Object.freeze({
            persistentBackground: false,
            managedDownloads: typeof GM_download === 'function',
            packagedAssets: true,
            mediabunny: hasMediabunnyAssets && typeof URL.createObjectURL === 'function',
            muxjs: hasMuxjsAssets && typeof URL.createObjectURL === 'function',
            externalMessages: false,
            requestBlocking: false,
            requestBlockingMode: 'userscript-manager-dependent',
            requestBlockingRules: 7,
            streamingFileSave: typeof globalThis.showSaveFilePicker === 'function',
        }),
        storage,
        fetch: platformFetch,
        assetText: async (path) => {
            if (!(path in ASSETS)) throw new Error(`Userscript asset is unavailable: ${path}`);
            return ASSETS[path];
        },
        assetUrl,
        sendMessage,
        onMessage: () => () => {},
        getManifest: () => manifest,
        t: (key) => MESSAGES[key] || '',
        migrateLegacySettings,
    });
})();


// RumbleX v3.43.0 - Shared Content Core
// Rumble enhancement suite - Chrome/Firefox extension
'use strict';

// ── Platform + Version ──
// extension/platform.js and the generated userscript adapter expose the same
// small runtime contract. Keeping browser APIs outside this file makes every
// DOM feature ship from one canonical source.
const RXPlatform = globalThis.RumbleXPlatform;
if (!RXPlatform) throw new Error('RumbleX platform adapter is missing');
const VERSION = RXPlatform.version || '3.43.0';
const RXSettingsSchema = globalThis.RumbleXSettingsSchema;
if (!RXSettingsSchema) throw new Error('RumbleX settings schema is missing');
const SCHEMA_VERSION = RXSettingsSchema.SCHEMA_VERSION;

// ── Settings Manager (chrome.storage.local) ──
const Settings = {
    _cache: null,
    _ready: false,
    _defaults: RXSettingsSchema.DEFAULTS,
    _writeTimer: null,
    _pendingWrite: false,
    _writeChain: Promise.resolve(),
    _writeRevision: 0,
    _pendingRevisions: new Map(),
    // Tracks keys the user has changed locally but hasn't yet been flushed to
    // chrome.storage. If an external change arrives inside the debounce
    // window, we merge external values UNDER these pending keys — otherwise
    // the user's in-flight toggle would be silently discarded.
    _pendingKeys: null,
    // Track the last-known value of rx_settings we either read from or wrote
    // to storage. Used by the onChanged listener to tell "this change was me"
    // from "this change was a different tab/window/options page".
    _lastWritten: null,
    _externalHandlers: [],

    async init() {
        const data = await RXPlatform.storage.get('rx_settings');
        const legacy = (!data.rx_settings || typeof data.rx_settings !== 'object')
            ? await RXPlatform.migrateLegacySettings?.(this._defaults)
            : null;
        const stored = data.rx_settings || legacy || {};
        const migrated = this._migrate(stored);
        const sanitized = this._sanitize(migrated);
        // A set() that lands while this await is in flight used to be discarded
        // outright: the cache was replaced wholesale and _pendingKeys was reset,
        // so the write reported success and silently vanished. Layer any pending
        // changes back on top, exactly as _applyExternal already does for writes
        // that race an external change.
        const merged = { ...this._defaults, ...sanitized };
        const pendingDuringBoot = this._pendingKeys;
        if (this._cache && pendingDuringBoot && pendingDuringBoot.size > 0) {
            for (const key of pendingDuringBoot) {
                if (key in this._cache) merged[key] = this._cache[key];
            }
        }
        this._cache = merged;
        this._lastWritten = JSON.stringify(this._cache);
        this._pendingKeys = pendingDuringBoot || new Set();
        this._ready = true;
        if (migrated !== stored || JSON.stringify(sanitized) !== JSON.stringify(migrated)) {
            // Persist migrations and normalization so other extension surfaces
            // never keep reading values the content core has already rejected.
            try { await RXPlatform.storage.set({ rx_settings: this._cache }); } catch {}
            this._lastWritten = JSON.stringify(this._cache);
        }
    },
    // Pre-v2 storage shapes:
    //   - schemaVersion missing or < 2
    //   - keyboardNav: bool (replaced by legacyKeyboardNav: false; off by house style)
    // Migration preserves user intent: if they explicitly had keyboardNav on,
    // their hotkeys still work after upgrade because legacyKeyboardNav inherits
    // that value. Otherwise keyboardNav silently drops to off (the new default).
    _migrate(stored) {
        return RXSettingsSchema.migrate(stored);
    },
    _sanitize(input) {
        return RXSettingsSchema.normalize(input, this._defaults);
    },
    get(key) {
        if (!this._cache) return this._defaults[key];
        return this._cache[key];
    },
    set(key, val) {
        if (!Object.hasOwn(this._defaults, key)) return this.get(key);
        const safe = this._sanitize({ [key]: val });
        if (!Object.hasOwn(safe, key)) return this.get(key);
        if (!this._cache) this._cache = { ...this._defaults };
        this._cache[key] = safe[key];
        if (!this._pendingKeys) this._pendingKeys = new Set();
        this._pendingKeys.add(key);
        this._pendingRevisions.set(key, ++this._writeRevision);
        this._scheduleWrite();
    },
    // Coalesce rapid writes into a single storage.local.set call. Without
    // this, features that update settings on keystroke (search history,
    // volume slider, etc.) could thrash storage. 120ms is short enough to
    // feel instant and long enough to batch bursts.
    _scheduleWrite() {
        this._pendingWrite = true;
        clearTimeout(this._writeTimer);
        this._writeTimer = setTimeout(() => this._flush(), 120);
    },
    _flush() {
        if (!this._pendingWrite || !this._cache) return this._writeChain;
        this._pendingWrite = false;
        const snapshotObject = JSON.parse(JSON.stringify(this._cache));
        const snapshot = JSON.stringify(snapshotObject);
        const captured = new Map(this._pendingRevisions);
        const commit = async () => {
            // Mark before dispatch so the synchronous storage-change event
            // some engines emit for our own write is recognized as local.
            this._lastWritten = snapshot;
            try {
                await RXPlatform.storage.set({ rx_settings: snapshotObject });
                for (const [key, revision] of captured) {
                    if (this._pendingRevisions.get(key) !== revision) continue;
                    this._pendingRevisions.delete(key);
                    this._pendingKeys?.delete(key);
                }
                return true;
            } catch (e) {
                if (this._lastWritten === snapshot) this._lastWritten = null;
                console.warn('[RumbleX] settings flush failed; retrying:', e);
                this._pendingWrite = true;
                clearTimeout(this._writeTimer);
                this._writeTimer = setTimeout(() => this._flush(), 1000);
                return false;
            }
        };
        this._writeChain = this._writeChain.then(commit, commit);
        return this._writeChain;
    },
    toggle(key) {
        const v = !this.get(key);
        this.set(key, v);
        return v;
    },
    onExternalChange(fn) {
        this._externalHandlers.push(fn);
    },
    // Called by chrome.storage.onChanged when rx_settings changed in another
    // tab or from the options page. Refreshes our cache in place and fires
    // subscribers so features can react (show a toast, re-run, etc.).
    //
    // `newValue === undefined` means the key was removed (e.g. options-page
    // reset): reset our cache to defaults instead of silently ignoring so
    // subsequent Settings.get() calls return the right value without needing
    // a page reload.
    _applyExternal(newValue) {
        const isReset = newValue === undefined;
        if (!isReset && (!newValue || typeof newValue !== 'object')) return;
        const incoming = isReset ? '__reset__' : JSON.stringify(newValue);
        if (incoming === this._lastWritten) return; // our own write, ignore

        if (isReset) {
            // Reset is explicit user intent: wipe pending too so we don't
            // resurrect discarded values on the next flush.
            this._pendingKeys?.clear();
            this._pendingRevisions.clear();
            this._cache = { ...this._defaults };
        } else {
            // Build the merged cache from external, then layer our still-
            // pending changes ON TOP so an in-flight toggle isn't lost just
            // because another tab happened to save first.
            const merged = { ...this._defaults, ...this._sanitize(newValue) };
            if (this._cache && this._pendingKeys && this._pendingKeys.size > 0) {
                for (const k of this._pendingKeys) {
                    if (k in this._cache) merged[k] = this._cache[k];
                }
            }
            this._cache = merged;
        }
        this._lastWritten = incoming;
        for (const fn of this._externalHandlers) {
            try { fn(isReset); } catch (e) { console.warn('[RumbleX] external-change handler failed:', e); }
        }
    },
};

if (RXPlatform.storage?.onChanged) {
    RXPlatform.storage.onChanged((changes) => {
        if (!changes.rx_settings) return;
        Settings._applyExternal(changes.rx_settings.newValue);
    });
}
// Ensure pending writes land before the page unloads.
window.addEventListener('pagehide', () => Settings._flush(), { capture: true });

// ── Page Detection ──
const Page = {
    isWatch: () => /^\/v[a-z0-9]+-/.test(location.pathname) || location.pathname.startsWith('/video/'),
    isFeed: () => location.pathname === '/' || location.pathname === '/subscriptions' || location.pathname === '/for-you',
    isHome: () => location.pathname === '/',
    isEmbed: () => location.pathname.startsWith('/embed/'),
    isSearch: () => location.pathname === '/search/video' || location.pathname.startsWith('/search/'),
    isChannel: () => location.pathname.startsWith('/c/') || location.pathname.startsWith('/user/'),
    isLive: () => !!document.querySelector('.media-description-info-stream-time') || !!document.querySelector('#chat-history-list'),
    isAccount: () => location.pathname.startsWith('/account/') || location.pathname === '/followed-channels',
    isStudio: () => location.hostname === 'studio.rumble.com',
    // v3.1.0 — Rumble Shorts launched on web 2026-02-04 at rumble.com/shorts.
    // Vertical swipeable feed, dedicated player, ≤90s, 1:1-or-taller aspect ratio.
    // Distinct from the in-feed Shorts row (`#section-shorts`) the v1.x
    // shortsFilter already handles via `#shorts__label` SVG detection.
    isShorts: () => location.pathname === '/shorts' || location.pathname.startsWith('/shorts/') || location.pathname.startsWith('/shorts.'),
    classify() {
        if (this.isStudio()) return 'studio';
        if (this.isAccount()) return 'account';
        if (this.isShorts()) return 'shorts';
        if (this.isEmbed()) return 'embed';
        if (this.isSearch()) return 'search';
        if (this.isChannel()) return 'channel';
        if (this.isWatch()) return this.isLive() ? 'live' : 'watch';
        if (this.isHome()) return 'home';
        if (this.isFeed()) return 'feed';
        return 'unknown';
    },
};

// ── Selector Registry (v2.0.0) ──
// Named surface selectors with stable/fallback pairs from the MHTML map.
// Prefer Selectors.find(key) over raw qs() in new feature code so Rumble's
// DOM churn lands in ONE place instead of scattered selectors. Each entry
// tries `stable` first, then falls back to `fallback`. `validate(el)` lets
// callers reject false-positive matches structurally.
const Selectors = {
    _map: {
        'header.root':        { stable: 'header[data-js="app_header"]', fallback: '.header' },
        'nav.mainMenu':       { stable: '#main-menu', fallback: '.hover-menu.main-menu-nav' },
        'search.form':        { stable: 'form[data-js="search_form"]', fallback: '.header-search' },
        'search.input':       { stable: '[data-js="search_input"]', fallback: '.header-search-field' },
        'search.autocomplete':{ stable: '[data-js="autocomplete_results_container"]', fallback: '[hx-post="/search/htmx/get-autocomplete-results"]' },
        'feed.card':          { stable: 'rum-video-thumbnail[role="listitem"], [role="listitem"][data-video-id], article.video-item', fallback: '.videostream.thumbnail__grid--item' },
        'feed.cardTitle':     { stable: '[video-title], rum-text[role="heading"], .thumbnail__title, .video-item--title', fallback: '.thumbnail__title.line-clamp-2' },
        'feed.author':        { stable: 'a[rel="author"].channel__link, article.video-item a[rel="author"]', fallback: '.channel__link' },
        'watch.media':        { stable: '[data-js="media_container"]', fallback: '.media-page' },
        'watch.player':       { stable: '#videoPlayer, video', fallback: '.videoPlayer-Rumble-cls' },
        'watch.title':        { stable: '.video-header-container__title', fallback: '[class*="video-header"] [class*="title"]' },
        'watch.share':        { stable: '[data-js="media_engage_share"]', fallback: '[data-js="video_action_sub_menu_button"], .round-button.media-by-actions-button' },
        'watch.description':  { stable: '[data-js="media_description_section"], .media-description-section', fallback: '.container.content.media-description' },
        'watch.related':      { stable: '.media-page-related-media-desktop-sidebar', fallback: '.mediaList-list' },
        'watch.relatedCard':  { stable: '.media-page-related-media-desktop-sidebar rum-video-thumbnail[role="listitem"]', fallback: '.media-page-related-media-desktop-sidebar .mediaList-item' },
        'comments.root':      { stable: '[data-js="media_page_comments_container"], #video-comments', fallback: '.media-page-comments-container' },
        'comments.item':      { stable: 'li.comment-item[data-comment-id]', fallback: '.comment-item' },
        'comments.text':      { stable: '.comment-text', fallback: '[class*="comment"] [class*="text"]' },
        'comments.composer':  { stable: '[data-js*="comment"] textarea', fallback: '.comments-create-textarea' },
        'chat.root':          { stable: 'aside.media-page-chat-aside-chat', fallback: '.chat--header' },
        'chat.history':       { stable: '#chat-history-list', fallback: '.chat-history' },
        'chat.message':       { stable: '#chat-history-list .chat-history--row', fallback: '.chat-history--row' },
        'chat.username':      { stable: '.chat-history--username, .chat-history--rant-username', fallback: '.js-chat-username' },
        'rant.item':          { stable: '.chat-history--rant[data-level]', fallback: '.chat-history--rant' },
        'rant.price':         { stable: '.chat-history--rant-price', fallback: '[class*="rant-price"]' },
        'modal.portal':       { stable: '#portal[data-js="portal"]', fallback: '#portal' },
        'modal.overlay':      { stable: '[data-js="modal__overlay"]', fallback: '[hx-ext="modal"]' },
        'theme.group':        { stable: '.theme-option-group', fallback: '[class*="theme-option"]' },
        'account.pagination': { stable: '.pagination.autoPg', fallback: '.pagination' },
        // v3.1.0 / refined v3.12.0 — Shorts surfaces. Real semantic class
        // names confirmed against Sample Pages/Shorts.mhtml (2026-05-19
        // capture). Rumble uses hashed-prefix utility classes like
        // `rum-4oaq3e rum-shorts__screen__action rum-lxsho7` — the hashed
        // tokens are unstable, the BEM-ish `rum-shorts-*` tokens are not.
        'shorts.feed':        { stable: '[class*="rum-shorts-feed__screen-container"], [class*="rum-shorts-feed__screen-box"]', fallback: '[class*="shorts-feed"], [class*="ShortsFeed"]' },
        'shorts.card':        { stable: '[class*="rum-shorts-screen__aspect-box"]', fallback: '[class*="shorts-card"], [class*="ShortsCard"]' },
        'shorts.player':      { stable: '[class*="rum-shorts-player-overlay"], [class*="rum-shorts-screen-bg"]', fallback: '[class*="shorts-player"], [class*="ShortsPlayer"]' },
        'shorts.navItem':     { stable: '[class*="rum-shorts-navigation__item"]', fallback: '[class*="shorts-nav"]' },
        // v3.1.0 — Rumble Wallet tip button surface (launched 2026-01-07).
        // Appears only for creators who enabled their tip jar — opt-in toggle
        // hides it without breaking creators who want to keep it visible.
        'wallet.tipButton':   { stable: 'button[hx-get*="wallet/payment/qr-modal"], [data-js="wallet_tip_button"], [data-js="tip_button"]', fallback: 'button[hx-get*="wallet"], [class*="tip-button"], [class*="TipButton"]' },
        // v3.35.0 — Premium / Perplexity Pro promotion surface. Keep the
        // endpoint hook first: it is also the contract used by AdNuker and
        // the dedicated hide-Premium/Join CSS toggle.
        'premium.promo':      { stable: '[hx-get*="premium-value-prop"], [data-js="premium_perplexity_promo"]', fallback: '[class*="premium-banner"], [id*="premium__promo"]' },
        // v3.26.0 — Wallet QR / payment modal surface (post-tip-button click).
        // Endpoint per ROADMAP Appendix B: `/-htmx/wallet/payment/qr-modal`.
        // Stable hook: any button or hx-get attribute pointing at that endpoint.
        // The fallback covers the modal body once it has been swapped into the
        // portal — `#portal` is the htmx mount point Rumble uses for all
        // modal-style content. Conservative entry; refine once a logged-in
        // capture of the wallet payment flow lands in Sample Pages/.
        'wallet.paymentModal':{ stable: '[hx-get*="wallet/payment/qr-modal"], [hx-post*="wallet/payment/qr-modal"], [data-js*="wallet_payment"], [data-js*="wallet_qr"]', fallback: '#portal [class*="wallet"], #portal [class*="qr-modal"], [class*="WalletQr"], [class*="PaymentQr"]' },
        // v3.12.0 — Account-content surfaces (from new MHTML batch 2026-05-19).
        // recurringSubsCancelBtn = per-row Cancel button on /account/subscriptions
        // (the Recurring Subs page). Stable via data-js attribute.
        // followedChannelsUnsubBtn = per-channel Unsubscribe button on
        // /followed-channels (formerly /account/following). Identified via
        // data-action="unsubscribe" so it
        // doesn't match the inverse Subscribe button on the same page.
        'account.recurringSubsCancelBtn': { stable: 'button[data-js="cancel_recurring_subscriptions"]', fallback: 'button[class*="cancel-recurring"]' },
        'account.recurringSubsRow':       { stable: 'table tr:has(button[data-js="cancel_recurring_subscriptions"])', fallback: 'tr[class*="subscription"]' },
        'account.followedChannelsSection':{ stable: '[data-js="followed-channels__section"]', fallback: 'section[class*="followed"]' },
        'account.followedChannelsUnsubBtn':{ stable: 'button[data-action="unsubscribe"][hx-post*="legacy-video-collection"]', fallback: 'button.js-media-subscribe[data-action="unsubscribe"]' },
        // v3.13.0 — Per-channel row on /followed-channels (formerly
        // /account/following; Followed Channels.mhtml).
        // Row: <li class="followed-channel" data-id data-type="channel">
        //   Channel URL: <a href="rumble.com/c/..."> with <span class="line-clamp-2">Name</span>
        //   Live tag:    <span class="live__tag">LIVE</span> (when channel is live now)
        'account.followedChannelsItem':     { stable: 'li.followed-channel[data-type="channel"]', fallback: 'li.followed-channel' },
        'account.followedChannelsItemLink': { stable: 'li.followed-channel a[href*="/c/"], li.followed-channel a[href*="/user/"]', fallback: 'a.channel__link[href*="/c/"]' },
        'account.followedChannelsItemName': { stable: 'li.followed-channel a span.line-clamp-2', fallback: 'li.followed-channel .line-clamp-2' },
        // v3.14.0 — Account library / watch history / watch later / profile surfaces.
        // Discovered in 2026-05-19 MHTML batch (Watch History.mhtml, Watch
        // Later.mhtml, My Library.mhtml, Profile.mhtml). Wiring these into
        // features lands in v3.15+; registering now so the harness covers
        // them and the registry is the one source of truth.
        'library.watchHistorySection':      { stable: '[data-js="section_playlist_watch-history"]', fallback: 'section[id*="watch-history"]' },
        'library.watchLaterSection':        { stable: '[data-js="section_playlist_watch-later"]', fallback: 'section[id*="watch-later"]' },
        'library.userPlaylistsSection':     { stable: '[data-js="section_playlist_playlists"]', fallback: 'section[id*="playlists"]' },
        'library.videoGrid':                { stable: '[data-js="section_video_grid"]', fallback: '.video-grid' },
        'history.clearAllBtn':              { stable: 'button[data-js="playlist_control_panel_delete_playlist_button"]', fallback: 'button[class*="clear-history"]' },
        'history.pauseToggleBtn':           { stable: 'button[data-js="playlist_control_panel_toggle_watch_history_button"]', fallback: 'button[class*="toggle-history"]' },
        'history.videoList':                { stable: '[data-js="videostream_list"]', fallback: '.videostream-list' },
        'history.videoDetails':             { stable: '[data-js="videostream_details"]', fallback: '.videostream__details' },
        'history.itemMenuTrigger':          { stable: 'button[data-js="playlist_menu_button"]', fallback: '[data-js="playlist_menu_button"]' },
        'history.itemMenuOption':           { stable: '[data-js="playlist_menu_option"]', fallback: '.playlist-menu__option' },
        'profile.followingBtn':             { stable: 'button[data-js="button__following"]', fallback: 'button[class*="button__following"]' },
    },
    _telemetry: [],
    _healthTimer: null,
    _healthUnsubscribe: null,
    _pendingHealthSignature: '',
    _lastHealthSignature: '',
    find(key, root) {
        const entry = this._map[key];
        if (!entry) return null;
        const scope = root || document;
        try {
            let el = scope.querySelector(entry.stable);
            if (el) return el;
        } catch {}
        try {
            const el = scope.querySelector(entry.fallback);
            if (el) {
                this._note(key, 'fallback');
                return el;
            }
        } catch {}
        return null;
    },
    findAll(key, root) {
        const entry = this._map[key];
        if (!entry) return [];
        const scope = root || document;
        try {
            const nodes = scope.querySelectorAll(entry.stable);
            if (nodes.length) return Array.from(nodes);
        } catch {}
        try {
            const nodes = scope.querySelectorAll(entry.fallback);
            if (nodes.length) {
                this._note(key, 'fallback');
                return Array.from(nodes);
            }
        } catch {}
        return [];
    },
    findVisible(key, root) {
        const entry = this._map[key];
        if (!entry) return null;
        const scope = root || document;
        const candidates = [];
        for (const selector of [entry.stable, entry.fallback]) {
            try { candidates.push(...scope.querySelectorAll(selector)); } catch {}
        }
        const visible = [...new Set(candidates)].filter((el) => {
            if (!el.isConnected) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return false;
            for (let node = el; node instanceof Element; node = node.parentElement) {
                const style = getComputedStyle(node);
                if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
            }
            return true;
        });
        return visible.sort((a, b) => {
            const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
            return (br.width * br.height) - (ar.width * ar.height);
        })[0] || null;
    },
    wait(key, { timeout = 8000, root } = {}) {
        return new Promise((resolve, reject) => {
            const found = this.find(key, root);
            if (found) return resolve(found);
            const obs = new MutationObserver(() => {
                const el = this.find(key, root);
                if (el) { obs.disconnect(); clearTimeout(timer); resolve(el); }
            });
            obs.observe(document.documentElement, { childList: true, subtree: true });
            const timer = setTimeout(() => {
                obs.disconnect();
                this._note(key, 'timeout');
                reject(new Error('Selectors.wait timeout: ' + key));
            }, timeout);
        });
    },
    _note(key, kind) {
        if (!Settings._ready || !Settings.get('debugSelectorTelemetry')) return;
        this._telemetry.push({ key, kind, at: Date.now() });
        if (this._telemetry.length > 200) this._telemetry.shift();
    },
    healthCheck(root) {
        const scope = root || document;
        const page = Page.classify();
        const required = [];
        const add = (...keys) => {
            for (const key of keys) if (!required.includes(key)) required.push(key);
        };

        if (['home', 'feed', 'search', 'channel', 'account', 'watch', 'live'].includes(page)) {
            add('header.root');
        }
        if (['home', 'feed', 'search', 'channel', 'account'].includes(page)) {
            add('search.input');
        }
        if (page === 'watch' || page === 'live') {
            add('watch.media', 'watch.player', 'watch.title');
            // Related cards are required only when the sidebar already shows
            // video-link evidence; an empty/disabled related rail is valid.
            try {
                if (scope.querySelector('.media-page-related-media-desktop-sidebar a[href^="/v"], .media-page-related-media-desktop-sidebar a[href*="rumble.com/v"]')) {
                    add('watch.relatedCard');
                }
            } catch {}
        } else if (page === 'embed') {
            add('watch.player');
        } else if (page === 'shorts') {
            add('shorts.feed');
        } else if (['home', 'feed', 'search', 'channel'].includes(page)) {
            // Do not flag a legitimate empty feed/search result. If video-link
            // evidence exists, however, the card adapter must recognize it.
            try {
                if (scope.querySelector('a[href^="/v"], a[href*="rumble.com/v"]')) add('feed.card');
            } catch {}
        }

        const checks = required.map((key) => {
            const entry = this._map[key];
            let state = 'missing';
            try {
                if (entry?.stable && scope.querySelector(entry.stable)) state = 'stable';
                else if (entry?.fallback && scope.querySelector(entry.fallback)) state = 'fallback';
            } catch {}
            return { key, state };
        });
        const missing = checks.filter((check) => check.state === 'missing').map((check) => check.key);
        const fallback = checks.filter((check) => check.state === 'fallback').map((check) => check.key);
        return {
            checkedAt: new Date().toISOString(),
            page,
            status: missing.length ? 'broken' : fallback.length ? 'degraded' : 'healthy',
            checked: checks.length,
            missing,
            fallback,
            checks,
        };
    },
    startHealthMonitor() {
        if (this._healthUnsubscribe) return;
        const run = () => {
            this._healthTimer = null;
            const report = this.healthCheck();
            if (report.status !== 'broken') {
                this._pendingHealthSignature = '';
                this._lastHealthSignature = '';
                return;
            }
            const signature = `${report.page}:${report.missing.join(',')}`;
            if (signature === this._lastHealthSignature) {
                schedule(10000);
                return;
            }
            // Rumble renders route shells before hydrating their custom video
            // cards. A single sample during that skeleton phase can look like
            // selector drift even though the stable nodes arrive seconds later.
            // Require the same failure twice before surfacing it, while still
            // keeping a persistent break visible in diagnostics and the UI.
            if (signature !== this._pendingHealthSignature) {
                this._pendingHealthSignature = signature;
                schedule(4000);
                return;
            }
            this._pendingHealthSignature = '';
            this._lastHealthSignature = signature;
            const message = `Critical selector check failed (${report.missing.join(', ')})`;
            console.warn('[RumbleX] ' + message);
            try { RxErrorLog.record('SelectorHealth', new Error(message), `route:${report.page}`); } catch {}
            try { RxToast.show(`${message}. Open Privacy Report for details.`); } catch {}
            // Re-sample a reported failure so recovery clears the signature
            // without requiring another route transition.
            schedule(10000);
        };
        const schedule = (delay = 3000) => {
            if (this._healthTimer) clearTimeout(this._healthTimer);
            this._healthTimer = setTimeout(run, delay);
        };
        this._healthUnsubscribe = Router.onChange(() => schedule());
        schedule(4000);
    },
    drainTelemetry() {
        const out = this._telemetry.slice();
        this._telemetry.length = 0;
        return out;
    },
};

// ── Route Lifecycle (v2.0.0) ──
// Single source of route-change signals for features. Patches history once,
// subscribes to popstate, and listens for htmx swap/settle events. Feature
// modules call Router.onChange(cb) and re-init/destroy themselves on route
// transitions instead of relying on hardcoded MutationObservers per feature.
const Router = {
    _handlers: [],
    _lastUrl: location.href,
    _lastPage: null,
    _patched: false,
    init() {
        if (this._patched) return;
        this._patched = true;
        const fire = (reason) => this._fire(reason);
        try {
            const origPush = history.pushState;
            const origReplace = history.replaceState;
            history.pushState = function (...args) {
                const r = origPush.apply(this, args);
                queueMicrotask(() => fire('pushState'));
                return r;
            };
            history.replaceState = function (...args) {
                const r = origReplace.apply(this, args);
                queueMicrotask(() => fire('replaceState'));
                return r;
            };
        } catch (e) { console.warn('[RumbleX] history patch failed:', e); }
        window.addEventListener('popstate', () => fire('popstate'));
        // htmx may load after content.js — listen on document so any later
        // htmx-emitted event still bubbles to us.
        for (const evt of ['htmx:afterSwap', 'htmx:afterSettle', 'htmx:historyRestore']) {
            document.addEventListener(evt, () => fire(evt));
        }
        document.addEventListener('visibilitychange', () => fire('visibilitychange'));
        this._lastPage = Page.classify();
    },
    _fire(reason) {
        const url = location.href;
        const page = Page.classify();
        const changed = url !== this._lastUrl || page !== this._lastPage;
        const detail = { url, prevUrl: this._lastUrl, page, prevPage: this._lastPage, reason, changed };
        this._lastUrl = url;
        this._lastPage = page;
        for (const fn of this._handlers) {
            try {
                fn(detail);
            } catch (e) {
                console.warn('[RumbleX] router handler failed:', e);
                // v3.23.0 — record route-handler failures so a misbehaving
                // subscriber surfaces in the error log instead of silently
                // breaking on every navigation.
                try { RxErrorLog?.record(fn.name || 'routeHandler', e, 'route:' + (detail?.reason || '?')); } catch {}
            }
        }
    },
    onChange(fn) {
        if (typeof fn === 'function') this._handlers.push(fn);
        return () => {
            const i = this._handlers.indexOf(fn);
            if (i >= 0) this._handlers.splice(i, 1);
        };
    },
    page() { return Page.classify(); },
};

// ── Anti-FOUC: Inject immediately at document-start ──
const ANTI_FOUC_CSS = `
    html.rumblex-active #pause-ads__container,
    html.rumblex-active #pause-ads__backdrop,
    html.rumblex-active #pause-ads__backdrop_click,
    html.rumblex-active #pause-ads__play-button-container,
    html.rumblex-active #pause-ads__entity,
    html.rumblex-active .host-read-ad-entry,
    html.rumblex-active .js-host-read-container,
    html.rumblex-active .js-host-read-ad-entry__text,
    html.rumblex-active .js-rac-desktop-container,
    html.rumblex-active .js-rac-tablet-container,
    html.rumblex-active .js-rac-mobile-container,
    html.rumblex-active [hx-get*="premium-value-prop"],
    html.rumblex-active .btn-premium-lg,
    html.rumblex-active .ima-sdk-frame,
    html.rumblex-active .lrt-container,
    html.rumblex-active [class*="premium-banner"] {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        overflow: hidden !important;
    }
`;
const earlyStyle = document.createElement('style');
earlyStyle.id = 'rumblex-antifouc';
earlyStyle.textContent = ANTI_FOUC_CSS;
const osMotionStyle = document.createElement('style');
osMotionStyle.id = 'rumblex-os-reduced-motion';
osMotionStyle.textContent = `
    @media (prefers-reduced-motion: reduce) {
        html.rumblex-active *, html.rumblex-active *::before, html.rumblex-active *::after {
            animation-duration: 0.001ms !important;
            animation-delay: 0ms !important;
            transition-duration: 0.001ms !important;
            transition-delay: 0ms !important;
            scroll-behavior: auto !important;
        }
        html.rumblex-active .rx-shimmer { animation: none !important; }
    }
`;
let antiFoucEnabled = true;
let bootstrapRootObserver = null;
function mountDocumentStartStyles() {
    const root = document.head || document.documentElement;
    if (!root) return false;
    if (antiFoucEnabled && !earlyStyle.isConnected) root.appendChild(earlyStyle);
    if (!osMotionStyle.isConnected) root.appendChild(osMotionStyle);
    document.documentElement?.classList.add('rumblex-active');
    bootstrapRootObserver?.disconnect();
    bootstrapRootObserver = null;
    return true;
}
if (!mountDocumentStartStyles()) {
    bootstrapRootObserver = new MutationObserver(() => mountDocumentStartStyles());
    bootstrapRootObserver.observe(document, { childList: true, subtree: true });
}

function syncAntiFoucStyle() {
    antiFoucEnabled = !!Settings.get('adNuker');
    if (antiFoucEnabled) mountDocumentStartStyles();
    else earlyStyle.remove();
}

// ── Wait for DOM ready ──
function onReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
        fn();
    }
}

// ── CSS Injector ──
function injectStyle(css, id) {
    const existing = document.getElementById(id);
    if (existing) { existing.textContent = css; return existing; }
    const el = document.createElement('style');
    el.id = id;
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
    return el;
}

// ── Toast announcer ──
//
// One announcer for the whole in-page runtime. There used to be three separate
// `_showToast` implementations and only the SettingsPanel copy set `role` and
// `aria-live`, so most of the extension's feedback was invisible to assistive
// tech. Worse, ~25 call sites reached the announcer through
// `RxToast.show()` — optional-chained, so if SettingsPanel failed
// to initialize the call silently became a no-op and a user could take an
// action, receive no feedback at all, and have no way to tell whether it
// worked. This module owns its own element and never depends on a feature
// module having mounted.
const RxToast = {
    _el: null,
    _timer: null,

    _ensure() {
        if (this._el && this._el.isConnected) return this._el;
        injectStyle(`
            .rx-toast {
                position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
                background: #313244; color: #a6e3a1; border: 1px solid #a6e3a1;
                border-radius: 8px; padding: 8px 18px; font: 600 13px/1.4 system-ui, sans-serif;
                z-index: 100001; opacity: 0; transition: opacity 0.3s; pointer-events: none;
            }
            .rx-toast.show { opacity: 1; }
        `, 'rx-toast-css');
        const el = document.createElement('div');
        el.className = 'rx-toast';
        // WCAG 2.2 SC 4.1.3 Status Messages. role="status" (implicit
        // aria-live="polite") announces without stealing focus; aria-atomic
        // re-announces the whole message on update rather than just the diff.
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        (document.body || document.documentElement).appendChild(el);
        this._el = el;
        return el;
    },

    show(message) {
        const text = String(message == null ? '' : message);
        if (!text) return;
        try {
            const el = this._ensure();
            // Screen readers only announce a *change* to a live region. Clearing
            // first means two identical consecutive messages still announce.
            el.textContent = '';
            el.textContent = text;
            el.classList.add('show');
            clearTimeout(this._timer);
            this._timer = setTimeout(() => el.classList.remove('show'), 2000);
        } catch {
            // Never let feedback failure break the action that triggered it.
        }
    },

    destroy() {
        clearTimeout(this._timer);
        this._el?.remove();
        this._el = null;
    },
};

// ── Utility ──
function qs(sel, root) { return (root || document).querySelector(sel); }
// Escape text for interpolation into an HTML template string. This existed as
// four byte-identical private copies across feature modules, three of which
// were never called.
function rxEscapeHtml(value) {
    const holder = document.createElement('div');
    holder.textContent = value == null ? '' : String(value);
    return holder.innerHTML;
}
// Return a real array. Several shared features intentionally use array
// helpers (`filter`, `map`, `some`) and a raw NodeList does not provide them
// consistently across Chromium, Firefox, or userscript managers.
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function waitFor(selector, timeout = 8000) {
    return new Promise((resolve, reject) => {
        const el = qs(selector);
        if (el) return resolve(el);
        const obs = new MutationObserver(() => {
            const found = qs(selector);
            if (found) { obs.disconnect(); clearTimeout(timer); resolve(found); }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
        const timer = setTimeout(() => { obs.disconnect(); reject(new Error('Timeout: ' + selector)); }, timeout);
    });
}

// Feature DOM often arrives after an htmx swap. Pair those waits with the
// feature's lifecycle generation so disabling a toggle while a wait is
// pending cannot resurrect controls, observers, timers, or listeners later.
function waitForFeature(owner, selector, timeout = 8000) {
    const generation = owner?._rxLifecycleGeneration;
    return new Promise((resolve, reject) => {
        const found = document.querySelector(selector);
        if (found && owner && generation === owner._rxLifecycleGeneration) {
            queueMicrotask(() => {
                if (generation === owner._rxLifecycleGeneration) resolve(found);
                else reject(new DOMException('Feature lifecycle ended', 'AbortError'));
            });
            return;
        }
        const pending = owner._rxPendingWaitCancels || (owner._rxPendingWaitCancels = new Set());
        let settled = false;
        let timer = null;
        const cleanup = () => {
            observer.disconnect();
            if (timer) clearTimeout(timer);
            pending.delete(cancel);
        };
        const cancel = () => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new DOMException('Feature lifecycle ended', 'AbortError'));
        };
        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (!element) return;
            if (!owner || generation !== owner._rxLifecycleGeneration) {
                cancel();
                return;
            }
            settled = true;
            cleanup();
            resolve(element);
        });
        pending.add(cancel);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error('Timeout: ' + selector));
        }, timeout);
    });
}

function waitForSelectorFeature(owner, key, options = {}) {
    const entry = Selectors._map[key];
    if (!entry) return Promise.reject(new Error('Unknown selector contract: ' + key));
    const selector = [entry.stable, entry.fallback].filter(Boolean).join(', ');
    return waitForFeature(owner, selector, Number(options?.timeout) || 8000);
}

function cancelFeatureWaits(owner) {
    if (!owner?._rxPendingWaitCancels) return;
    for (const cancel of [...owner._rxPendingWaitCancels]) cancel();
    owner._rxPendingWaitCancels.clear();
}

function setFeatureTimeout(owner, callback, delay) {
    const generation = owner?._rxLifecycleGeneration;
    const pending = owner._rxPendingTimeouts || (owner._rxPendingTimeouts = new Set());
    const timer = setTimeout(() => {
        pending.delete(timer);
        if (generation === owner._rxLifecycleGeneration) callback();
    }, delay);
    pending.add(timer);
    return timer;
}

function cancelFeatureTimeouts(owner) {
    if (!owner?._rxPendingTimeouts) return;
    for (const timer of owner._rxPendingTimeouts) clearTimeout(timer);
    owner._rxPendingTimeouts.clear();
}

// Infinite feeds and live chat can deliver dozens of MutationObserver
// callbacks between paints. Features that rescan a whole surface should run
// at most once per animation frame, and any queued work must disappear when
// the feature is disabled or its route lifecycle ends.
function scheduleFeatureFrame(owner, key, callback) {
    if (!owner || typeof callback !== 'function') return null;
    const generation = owner._rxLifecycleGeneration;
    const pending = owner._rxPendingFrames || (owner._rxPendingFrames = new Map());
    if (pending.has(key)) return pending.get(key);
    const frame = requestAnimationFrame(() => {
        if (pending.get(key) !== frame) return;
        pending.delete(key);
        if (generation === owner._rxLifecycleGeneration) callback();
    });
    pending.set(key, frame);
    return frame;
}

function cancelFeatureFrames(owner) {
    if (!owner?._rxPendingFrames) return;
    for (const frame of owner._rxPendingFrames.values()) cancelAnimationFrame(frame);
    owner._rxPendingFrames.clear();
}

// ═══════════════════════════════════════════
//  FEATURE: Ad Nuker
// ═══════════════════════════════════════════
const AdNuker = {
    id: 'adNuker',
    name: 'Ad Nuker',
    _styleEl: null,

    _css: `
        /* Pause/overlay ads */
        #pause-ads__container,
        #pause-ads__backdrop,
        #pause-ads__backdrop_click,
        #pause-ads__play-button-container,
        #pause-ads__entity { display: none !important; }
        /* Host-read ads */
        .host-read-ad-entry,
        .js-host-read-container,
        .js-host-read-ad-entry__text { display: none !important; }
        /* RAC (Rumble Ad Container) */
        .js-rac-desktop-container,
        .js-rac-tablet-container,
        .js-rac-mobile-container { display: none !important; }
        /* Premium nags */
        [hx-get*="premium-value-prop"],
        .btn-premium-lg,
        a[href*="/premium"][class*="bg-"],
        [class*="premium-value-prop"],
        [class*="premium-banner"],
        [id*="premium__promo"] { display: none !important; }
        /* External ad iframes */
        iframe[src*="googlead"],
        iframe[src*="doubleclick"],
        iframe[src*="pagead"],
        .ima-sdk-frame { display: none !important; }
        /* LRT (Locals/Rumble tracking) container */
        .lrt-container { display: none !important; }
        /* Upcoming video overlay (auto-play next) */
        .js-player-upcoming-button { display: none !important; }
    `,

    _domClean(root = document) {
        const selectors = [
            '#pause-ads__container',
            '.host-read-ad-entry',
            '.js-host-read-container',
            '.js-rac-desktop-container',
            '.js-rac-tablet-container',
            '.js-rac-mobile-container',
        ];
        for (const sel of selectors) {
            if (root instanceof Element && root.matches(sel)) {
                root.remove();
                return;
            }
            for (const el of qsa(sel, root)) el.remove();
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        syncAntiFoucStyle();
        this._styleEl = injectStyle(this._css, 'rx-adnuker');
        this._domClean();
        this._obs = new MutationObserver((records) => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) this._domClean(node);
                }
            }
        });
        this._obs.observe(document.body, { childList: true, subtree: true });
    },
    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._styleEl = null;
        this._obs = null;
        earlyStyle.remove();
    }
};

// ── Video Card + Active Media Adapters (v3.36.0) ──
// Rumble currently mixes legacy `.videostream` nodes with the newer
// `<rum-video-thumbnail>` custom element. Consumers use this adapter so a
// future card migration is repaired in one place instead of per feature.
const VideoCards = {
    selector: [
        'rum-video-thumbnail[role="listitem"]',
        '[role="listitem"][data-video-id]',
        '.videostream',
        'article.video-item',
        '.mediaList-item',
        '.thumbnail__grid-item',
    ].join(', '),
    all(root = document) { return qsa(this.selector, root); },
    related(root = document) {
        return qsa(
            '.media-page-related-media-desktop-sidebar rum-video-thumbnail[role="listitem"], ' +
            '.media-page-related-media-desktop-sidebar .mediaList-item',
            root
        );
    },
    title(card) {
        return (card.getAttribute('video-title')
            || card.querySelector('rum-text[role="heading"], .thumbnail__title, .videostream__title, .mediaList-heading, .media-item__title, .video-item--title')?.textContent
            || '').trim();
    },
    channel(card) {
        return (card.getAttribute('name')
            || card.querySelector('[rel="author"], .videostream__author, .video-listing-entry--by-name, .mediaList-by-heading, [class*="channel-name"], a[href*="/c/"], a[href*="/user/"]')?.textContent
            || '').trim();
    },
    channelAnchor(card) {
        return card.querySelector('[rel="author"], a[href*="/c/"], a[href*="/user/"]');
    },
    url(card) {
        const raw = card.getAttribute('url')
            || card.querySelector('a[href*="/v"]')?.getAttribute('href')
            || '';
        try { return new URL(raw, location.origin).href; } catch { return ''; }
    },
    videoId(card) {
        return this.url(card).match(/\/(v[a-z0-9]+)-/i)?.[1] || null;
    },
    thumbnail(card) {
        return card.querySelector('.rum-video-thumbnail__image, .videostream__image, .thumbnail__image, .videostream__thumbnail, .video-item--img-wrapper, [class*="thumbnail"]');
    },
};

function getActiveMedia(root = document) {
    const candidates = qsa('video', root).filter((video) => video.isConnected);
    if (!candidates.length) return null;
    return candidates.map((video, index) => {
        const rect = video.getBoundingClientRect();
        const visibleArea = Math.max(0, rect.width) * Math.max(0, rect.height);
        const rendered = getComputedStyle(video).visibility !== 'hidden' && getComputedStyle(video).display !== 'none';
        const score = (rendered ? visibleArea : 0)
            + (!video.paused ? 1_000_000_000 : 0)
            + (video.currentSrc ? 1_000_000 : 0)
            + ((video.readyState || 0) * 10_000)
            - index;
        return { video, score };
    }).sort((a, b) => b.score - a.score)[0].video;
}

// ═══════════════════════════════════════════
//  FEATURE: Feed Cleanup
// ═══════════════════════════════════════════
const FeedCleanup = {
    id: 'feedCleanup',
    name: 'Feed Cleanup',
    _styleEl: null,

    _css: `
        .thumbnail__grid a[href*="/premium"],
        .streams__container a[href*="/premium"] { display: none !important; }
        .text-link-green[href*="/premium"] { display: none !important; }
        .js-rac-desktop-container,
        .js-rac-tablet-container,
        .js-rac-mobile-container { display: none !important; }
        footer.page__footer { display: none !important; }
    `,

    _repostCSS: `
        .videostream--repost { display: none !important; }
    `,

    _wideCSS: `
        .constrained {
            max-width: 100% !important;
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
        }
        .homepage-content--inner {
            max-width: none !important;
            width: 100% !important;
            gap: 12px !important;
        }
        .homepage-content--inner rum-video-thumbnail[role="listitem"] {
            min-width: min(320px, 28vw);
        }
        .thumbnail__grid { gap: 12px !important; }
        @supports (display:grid) {
            .thumbnail__grid { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 1600px) {
            @supports (display:grid) { .thumbnail__grid { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; } }
        }
        @media (max-width: 1200px) {
            @supports (display:grid) { .thumbnail__grid { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } }
        }
        @media (max-width: 900px) {
            @supports (display:grid) { .thumbnail__grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
        }
        @media (max-width: 600px) {
            @supports (display:grid) { .thumbnail__grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
            .constrained { padding-left: .75rem !important; padding-right: .75rem !important; }
            .homepage-content--inner rum-video-thumbnail[role="listitem"] { min-width: min(78vw, 300px); }
        }
        .videostream__footer { padding: 6px 4px 8px !important; }
        .homepage-section .constrained { max-width: 100% !important; }
    `,

    _repostStyleEl: null,
    _wideStyleEl: null,

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-feedcleanup');
        if (Settings.get('hideReposts')) {
            this._repostStyleEl = injectStyle(this._repostCSS, 'rx-hidereposts');
        }
        if (Settings.get('wideLayout') && (Page.isHome() || Page.isFeed())) {
            this._wideStyleEl = injectStyle(this._wideCSS, 'rx-widelayout');
        }
    },
    destroy() {
        this._styleEl?.remove();
        this._repostStyleEl?.remove();
        this._wideStyleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Hide Premium
// ═══════════════════════════════════════════
const HidePremium = {
    id: 'hidePremium',
    name: 'Hide Premium',
    _styleEl: null,

    _css: `
        .videostream:has(.videostream__label a[href="/premium"]) {
            display: none !important;
        }
    `,

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-hidepremium');
    },

    destroy() {
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Category Filter (Homepage)
// ═══════════════════════════════════════════
const CategoryFilter = {
    id: 'categoryFilter',
    name: 'Category Filter',
    _styleEl: null,

    _allCategories: [
        { id: 'editor-picks', label: "Editor's Picks" },
        { id: 'shorts', label: 'Shorts' },
        { id: 'continue-watching', label: 'Continue Watching' },
        { id: 'top-live', label: 'Top Live' },
        { id: 'premium-videos', label: 'Premium Videos' },
        { id: 'personal-recommendations', label: 'Recommendations' },
        { id: 'reposts', label: 'Reposts' },
        { id: 'gaming', label: 'Gaming' },
        { id: 'finance', label: 'Finance' },
        { id: 'live-videos', label: 'Live Videos' },
        { id: 'featured-playlists', label: 'Featured Playlists' },
        { id: 'sports', label: 'Sports' },
        { id: 'viral', label: 'Viral' },
        { id: 'podcasts', label: 'Podcasts' },
        { id: 'leaderboard', label: 'Leaderboard' },
        { id: 'vlogs', label: 'Vlogs' },
        { id: 'news', label: 'News' },
        { id: 'science', label: 'Science' },
        { id: 'music', label: 'Music' },
        { id: 'entertainment', label: 'Entertainment' },
        { id: 'cooking', label: 'Cooking' },
    ],

    _buildCSS() {
        const hidden = Settings.get('hiddenCategories') || [];
        if (!hidden.length) return '';
        const selectors = hidden.flatMap((id) => {
            if (id === 'shorts') return [
                'section#section-shorts:has(rum-shorts-row)',
                '.constrained:has(> section#section-shorts > .constrained > rum-shorts-row)',
            ];
            if (id === 'personal-recommendations') return [
                '#section-personal-recommendations',
                'section#section-shorts:has(rum-recommendations-row)',
            ];
            return [`#section-${id}`, `.constrained:has(#section-${id})`];
        });
        return selectors.join(',\n') + ' { display: none !important; }';
    },

    _apply() {
        if (this._styleEl) this._styleEl.remove();
        const css = this._buildCSS();
        if (css) this._styleEl = injectStyle(css, 'rx-catfilter');
    },

    init() {
        if (!Page.isHome()) return;
        this._apply();
    },

    destroy() {
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Dark Theme Enhancement
// ═══════════════════════════════════════════
const THEMES = {
    catppuccin: {
        label: 'Catppuccin Mocha',
        base: '#1e1e2e', mantle: '#181825', crust: '#11111b',
        surface0: '#313244', surface1: '#45475a', surface2: '#585b70',
        text: '#cdd6f4', subtext: '#a6adc8', subtext0: '#6c7086',
        accent: '#89b4fa', green: '#a6e3a1', red: '#f38ba8',
        yellow: '#f9e2af', peach: '#fab387', brand: '#89b4fa',
        selectionBg: 'rgba(137,180,250,0.25)',
        hoverBg: 'rgba(49,50,68,0.3)',
    },
    youtube: {
        label: 'YouTubify',
        base: '#0f0f0f', mantle: '#0f0f0f', crust: '#0f0f0f',
        surface0: '#272727', surface1: '#3f3f3f', surface2: '#535353',
        text: '#f1f1f1', subtext: '#aaaaaa', subtext0: '#717171',
        accent: '#3ea6ff', green: '#2ba640', red: '#ff0000',
        yellow: '#ffb84d', peach: '#ff8c42', brand: '#ff0000',
        selectionBg: 'rgba(62,166,255,0.25)',
        hoverBg: 'rgba(255,255,255,0.1)',
    },
    midnight: {
        label: 'Midnight AMOLED',
        base: '#000000', mantle: '#000000', crust: '#000000',
        surface0: '#111111', surface1: '#1a1a1a', surface2: '#2a2a2a',
        text: '#e4e4e7', subtext: '#a1a1aa', subtext0: '#71717a',
        accent: '#818cf8', green: '#4ade80', red: '#f87171',
        yellow: '#fbbf24', peach: '#fb923c', brand: '#818cf8',
        selectionBg: 'rgba(129,140,248,0.25)',
        hoverBg: 'rgba(255,255,255,0.06)',
    },
    rumbleGreen: {
        label: 'Rumble Green',
        base: '#141c0f', mantle: '#0f1509', crust: '#0a0f06',
        surface0: '#1e2a14', surface1: '#2a3a1e', surface2: '#3a4f2a',
        text: '#d6e8c4', subtext: '#a8c490', subtext0: '#6e8f56',
        accent: '#85c742', green: '#85c742', red: '#e55c5c',
        yellow: '#d4a843', peach: '#c98042', brand: '#85c742',
        selectionBg: 'rgba(133,199,66,0.25)',
        hoverBg: 'rgba(30,42,20,0.5)',
    },
    // v2.0.0 — OLED Green: pure-black surfaces, premium dark RumbleX-owned UI.
    // Tuned for AMOLED, denser borders, no backdrop-filter (per house style).
    oledGreen: {
        label: 'OLED Green',
        base: '#000000', mantle: '#000000', crust: '#000000',
        surface0: '#0a0f06', surface1: '#11170c', surface2: '#1b2412',
        text: '#e7f1dc', subtext: '#a8c490', subtext0: '#6e8f56',
        accent: '#85c742', green: '#85c742', red: '#e55c5c',
        yellow: '#d4a843', peach: '#c98042', brand: '#85c742',
        selectionBg: 'rgba(133,199,66,0.28)',
        hoverBg: 'rgba(133,199,66,0.08)',
    },
};

const DarkEnhance = {
    id: 'darkEnhance',
    name: 'Dark Theme',
    _styleEl: null,
    _playerStyleEl: null,

    _buildCSS(t) {
        return `
        :root {
            --rx-base: ${t.base};
            --rx-mantle: ${t.mantle};
            --rx-crust: ${t.crust};
            --rx-surface0: ${t.surface0};
            --rx-surface1: ${t.surface1};
            --rx-surface2: ${t.surface2};
            --rx-text: ${t.text};
            --rx-subtext: ${t.subtext};
            --rx-subtext0: ${t.subtext0};
            --rx-accent: ${t.accent};
            --rx-green: ${t.green};
            --rx-red: ${t.red};
            --rx-yellow: ${t.yellow};
            --rx-peach: ${t.peach};
            --rx-overlay: rgba(0, 0, 0, 0.85);
        }

        /* ── v2.1.0: native-token mapping ── */
        /* Hook Rumble's own CSS custom properties so themed surfaces inherit
           the active palette without per-selector overrides. Lets unstyled
           Rumble UI track our theme automatically. */
        html.rumblex-active {
            --color-bg-main: ${t.crust} !important;
            --color-bg-default: ${t.base} !important;
            --color-bg-default-0: ${t.base} !important;
            --color-bg-featured: ${t.surface0} !important;
            --color-bg-featured-0: ${t.surface0} !important;
            --color-txt-default: ${t.text} !important;
            --color-separator: ${t.surface0} !important;
            --color-separator-highlight: ${t.surface1} !important;
            --background: ${t.crust} !important;
            --background-color: ${t.crust} !important;
            --background-highlight: ${t.surface0} !important;
            --title-color: ${t.text} !important;
            --heading-color: ${t.text} !important;
            --text-color: ${t.text} !important;
            --border-color: ${t.surface0} !important;
            --link-color: ${t.accent} !important;
            --small-link-color: ${t.accent} !important;
            --link-green: ${t.green} !important;
            --brand-800: ${t.brand} !important;
            --brand-900: ${t.brand} !important;
            --brand-950: ${t.brand} !important;
            --menu-border-color: ${t.surface0} !important;
            --input-font-color: ${t.text} !important;
            --input-border-color: ${t.surface0} !important;
            --input-placeholder-color: ${t.subtext0} !important;
            --channel-border: ${t.surface0} !important;
            --channel-border-light: ${t.surface1} !important;
            --channel-border-dark: ${t.crust} !important;
        }

        /* ── Base ── */
        html.rumblex-active body {
            background-color: var(--rx-crust) !important;
            color: var(--rx-text) !important;
        }

        /* ── Header / Nav ── */
        html.rumblex-active .header {
            background: var(--rx-mantle) !important;
            border-bottom: 1px solid var(--rx-surface0) !important;
        }
        html.rumblex-active nav,
        html.rumblex-active .sidenav,
        html.rumblex-active #main-menu,
        html.rumblex-active .main-menu-item__nav,
        html.rumblex-active .hover-menu {
            background: var(--rx-mantle) !important;
        }
        html.rumblex-active .main-menu-item-label,
        html.rumblex-active .main-menu-heading {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .main-menu-item__nav:hover,
        html.rumblex-active .main-menu-item-channel:hover {
            background: var(--rx-surface0) !important;
        }
        html.rumblex-active .main-menu-divider {
            border-color: var(--rx-surface0) !important;
        }

        /* ── Search ── */
        html.rumblex-active .header-search-field,
        html.rumblex-active .header-search input {
            background: var(--rx-base) !important;
            color: var(--rx-text) !important;
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .header-search-field:focus,
        html.rumblex-active .header-search input:focus {
            border-color: var(--rx-accent) !important;
        }

        /* ── Video Cards / Feed ── */
        html.rumblex-active .videostream {
            background: var(--rx-base) !important;
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .videostream:hover {
            background: var(--rx-surface0) !important;
        }
        html.rumblex-active .videostream__footer {
            color: var(--rx-subtext) !important;
        }
        html.rumblex-active .videostream__date,
        html.rumblex-active .videostream__views,
        html.rumblex-active .mediaList-timestamp,
        html.rumblex-active .mediaList-earnings {
            color: var(--rx-subtext0) !important;
        }
        html.rumblex-active .thumbnail__title,
        html.rumblex-active .videostream__link {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .channel__link {
            color: var(--rx-subtext) !important;
        }

        /* ── Homepage Sections ── */
        html.rumblex-active .homepage-content {
            background: var(--rx-crust) !important;
        }
        html.rumblex-active .homepage-heading__title,
        html.rumblex-active .homepage-heading {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .homepage-featured {
            background: var(--rx-mantle) !important;
            border-color: var(--rx-surface0) !important;
        }

        /* ── Video Page ── */
        html.rumblex-active .media-container,
        html.rumblex-active .main-and-sidebar,
        html.rumblex-active .media-description,
        html.rumblex-active .media-description-section {
            background: var(--rx-crust) !important;
            color: var(--rx-text) !important;
        }
        html.rumblex-active .video-header-container__title {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .media-heading-name {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .media-heading-num-followers {
            color: var(--rx-subtext0) !important;
        }
        html.rumblex-active .media-description-info-views,
        html.rumblex-active .media-description-info-stream-time,
        html.rumblex-active .streamed-on {
            color: var(--rx-subtext) !important;
        }

        /* ── Rating / Votes ── */
        html.rumblex-active .rumbles-vote-pill {
            background: var(--rx-surface0) !important;
            border-color: var(--rx-surface1) !important;
        }
        html.rumblex-active .rumbles-vote-up { color: var(--rx-green) !important; }
        html.rumblex-active .rumbles-vote-down { color: var(--rx-red) !important; }
        html.rumblex-active .rating-bar {
            background: var(--rx-surface0) !important;
        }
        html.rumblex-active .rating-bar__fill {
            background: var(--rx-green) !important;
        }

        /* ── Comments ── */
        html.rumblex-active .comment-item {
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .comment-text {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .comments-meta-author {
            color: var(--rx-accent) !important;
        }
        html.rumblex-active .comments-sort-by {
            background: var(--rx-surface0) !important;
            color: var(--rx-text) !important;
            border-color: var(--rx-surface1) !important;
        }
        html.rumblex-active .comment-actions button {
            color: var(--rx-subtext) !important;
        }

        /* ── Related Videos Sidebar ── */
        html.rumblex-active .mediaList-item {
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .mediaList-item:hover {
            background: ${t.hoverBg} !important;
        }
        html.rumblex-active .mediaList-heading {
            color: var(--rx-text) !important;
        }
        html.rumblex-active .mediaList-by-heading {
            color: var(--rx-subtext) !important;
        }

        /* ── Buttons ── */
        html.rumblex-active .btn-grey {
            background: var(--rx-surface0) !important;
            color: var(--rx-text) !important;
            border-color: var(--rx-surface1) !important;
        }
        html.rumblex-active .btn-grey:hover {
            background: var(--rx-surface1) !important;
        }

        /* ── Chat ── */
        html.rumblex-active .chat--header {
            background: var(--rx-mantle) !important;
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .chat--input {
            background: var(--rx-base) !important;
            color: var(--rx-text) !important;
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .chat--rant-button {
            background: var(--rx-surface0) !important;
        }

        /* ── Popouts / Dropdowns ── */
        html.rumblex-active .popout__menu-container {
            background: var(--rx-base) !important;
            border-color: var(--rx-surface0) !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
        }
        html.rumblex-active .popout__menu-button:hover {
            background: var(--rx-surface0) !important;
        }

        /* ── Notifications ── */
        html.rumblex-active .user-notifications {
            background: var(--rx-base) !important;
            border-color: var(--rx-surface0) !important;
        }
        html.rumblex-active .user-notifications--header {
            border-color: var(--rx-surface0) !important;
        }

        /* ── Footer ── */
        html.rumblex-active .page__footer {
            background: var(--rx-mantle) !important;
            color: var(--rx-subtext0) !important;
        }
        html.rumblex-active .foot__nav-item a,
        html.rumblex-active .foot__legal-item a {
            color: var(--rx-subtext) !important;
        }

        /* ── Scrollbar ── */
        html.rumblex-active ::-webkit-scrollbar { width: 8px; height: 8px; }
        html.rumblex-active ::-webkit-scrollbar-track { background: var(--rx-crust); }
        html.rumblex-active ::-webkit-scrollbar-thumb {
            background: var(--rx-surface1);
            border-radius: 4px;
        }
        html.rumblex-active ::-webkit-scrollbar-thumb:hover {
            background: var(--rx-accent);
        }

        /* ── Selection ── */
        html.rumblex-active ::selection {
            background: ${t.selectionBg};
            color: var(--rx-text);
        }

        /* ── Links ── */
        html.rumblex-active .media-description a,
        html.rumblex-active .media-description-tags-container a {
            color: var(--rx-accent) !important;
        }

        /* ── Verification badge ── */
        html.rumblex-active .verification-badge-icon { opacity: 0.9; }

        /* ── Player Progress Bar & Controls ── */
        html.rumblex-active rum-player-control-progress .rum-progress-thumb {
            border-color: ${t.brand} !important;
        }
        html.rumblex-active rum-player-control-progress .rum-progress-hovered {
            background-color: ${t.brand} !important;
            opacity: 0.5 !important;
        }
        html.rumblex-active {
            --brand-500: ${t.brand} !important;
            --brand-500-rgb: unset !important;
            --rumble-green: ${t.brand} !important;
        }
        html.rumblex-active .bg-green,
        html.rumblex-active rum-button[state="primary"] {
            background-color: ${t.brand} !important;
        }
        html.rumblex-active rum-button[state="ghost"] {
            border-color: ${t.brand} !important;
        }
        `;
    },

    init() {
        if (!Settings.get(this.id)) return;
        const themeId = Settings.get('theme') || 'catppuccin';
        const t = THEMES[themeId] || THEMES.catppuccin;
        this._styleEl = injectStyle(this._buildCSS(t), 'rx-darkenhance');
    },
    destroy() {
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Theater Split
// ═══════════════════════════════════════════
const TheaterSplit = {
    id: 'theaterSplit',
    name: 'Theater Split',

    _isSplit: false,
    _isActive: false,
    _isLive: false,
    _activeTab: 'chat',
    _splitWrapper: null,
    _origPlayerParent: null,
    _origPlayerNext: null,
    _origChatParent: null,
    _origChatNext: null,
    _origCommentsParent: null,
    _origCommentsNext: null,
    _origPlayerStyle: null,
    _origVideoStyle: null,
    _origCommentsStyle: null,
    _positionedEls: [],
    _wheelHandler: null,
    _touchStartY: 0,
    _touchHandler: null,
    _rightWheelHandler: null,
    _rightTouchHandler: null,
    _playerResizeObs: null,
    _styleEl: null,
    _windowResizeHandler: null,
    _routerUnsub: null,
    _mountToken: 0,
    _routeTimer: null,
    _awaitingRouteDom: false,
    _playerEl: null,
    _videoEl: null,
    _chatEl: null,
    _commentsEl: null,
    _leftEl: null,
    _dragCleanup: null,
    _keyHandler: null,
    _focusBeforeOpen: null,

    _css: `
        html.rx-theater,
        html.rx-theater body { overflow: hidden !important; }
        html.rx-theater .header,
        html.rx-theater .page__footer,
        html.rx-theater nav.sidenav,
        html.rx-theater .media-page-related-media-mobile { display: none !important; }
        html.rx-theater main.nonconstrained { visibility: hidden !important; }

        #rx-split-wrapper {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 9999;
            display: flex;
            flex-direction: row;
            background: #000;
            overflow: hidden;
        }
        #rx-split-left {
            flex: 1;
            min-width: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000;
            position: relative;
            overflow: hidden;
        }
        #rx-split-left #videoPlayer,
        #rx-split-left .video-player {
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            max-height: none !important;
        }
        #rx-split-left .videoPlayer-Rumble-cls {
            width: 100% !important;
            height: 100% !important;
            max-height: none !important;
            aspect-ratio: unset !important;
        }
        #rx-split-left .videoPlayer-Rumble-cls > div {
            position: absolute !important;
            inset: 0 !important;
        }
        #rx-split-left video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
        }

        #rx-split-divider {
            flex: 0 0 0px;
            width: 0;
            min-height: 44px;
            cursor: col-resize;
            background: rgba(255,255,255,0.06);
            transition: flex-basis 0.35s cubic-bezier(.4,0,.2,1),
                        width 0.35s cubic-bezier(.4,0,.2,1),
                        background 0.15s;
            position: relative;
            z-index: 10;
        }
        #rx-split-divider:hover,
        #rx-split-divider.rx-dragging,
        #rx-split-divider:focus-visible { background: rgba(137,180,250,0.35); outline: none; }
        #rx-split-divider::after {
            content: '';
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%,-50%);
            width: 4px; height: 32px;
            border-radius: 2px;
            background: rgba(255,255,255,0.25);
            opacity: 0;
            transition: opacity 0.2s;
        }
        #rx-split-divider:hover::after { opacity: 1; }

        #rx-split-right {
            flex: 0 0 0;
            width: 0;
            overflow: hidden;
            opacity: 0;
            background: var(--rx-base, #1e1e2e);
            transition: flex-basis 0.4s cubic-bezier(.4,0,.2,1),
                        opacity 0.35s ease;
            display: flex;
            flex-direction: column;
        }
        #rx-split-right.rx-expanded {
            opacity: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }
        #rx-split-right.rx-tabbed { overflow: hidden !important; }
        #rx-split-right::-webkit-scrollbar { width: 5px; }
        #rx-split-right::-webkit-scrollbar-track { background: transparent; }
        #rx-split-right::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.14);
            border-radius: 3px;
        }
        #rx-split-right::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); }

        #rx-split-right .media-page-comments-container,
        #rx-split-right #video-comments,
        #rx-split-right .comments-1 {
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
        }
        #rx-split-right .comment-item {
            padding: 8px 12px !important;
            border-bottom: 1px solid rgba(255,255,255,0.06) !important;
        }
        #rx-split-right .comments-meta-author { font-size: 12px !important; }
        #rx-split-right .comment-text { font-size: 13px !important; line-height: 1.4 !important; }


        #rx-split-right .rx-panel-header {
            padding: 12px 12px 10px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            flex-shrink: 0;
            display: flex;
            align-items: flex-start;
            gap: 10px;
        }
        #rx-split-right .rx-panel-header .rx-header-info { flex: 1; min-width: 0; }
        #rx-split-right .rx-panel-header h3 {
            margin: 0 0 4px;
            font-size: 15px;
            font-weight: 600;
            color: var(--rx-text, #cdd6f4);
            line-height: 1.3;
            overflow: hidden;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }
        #rx-split-right .rx-panel-header .rx-channel {
            font-size: 12px;
            color: var(--rx-subtext, #a6adc8);
        }
        #rx-split-right .rx-panel-header .rx-header-actions {
            display: flex;
            gap: 6px;
            flex-shrink: 0;
            align-items: center;
        }
        #rx-split-right .rx-panel-header .rx-hdr-btn {
            width: 44px; height: 44px;
            border-radius: 50%;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, border-color 0.15s, transform 0.15s;
            text-decoration: none;
            padding: 0;
        }
        #rx-split-right .rx-panel-header .rx-hdr-btn:hover {
            background: rgba(255,255,255,0.12);
            border-color: rgba(137,180,250,0.4);
            transform: scale(1.1);
        }
        #rx-split-right .rx-panel-header .rx-hdr-btn svg { width: 16px; height: 16px; }
        #rx-split-right .rx-panel-header #rx-hdr-home:hover { border-color: rgba(133,213,81,0.5); }
        #rx-split-right .rx-panel-header #rx-hdr-settings svg {
            transition: transform 0.3s cubic-bezier(.4,0,.2,1);
        }

        #rx-tab-bar {
            display: flex;
            flex-shrink: 0;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            background: rgba(0,0,0,0.15);
        }
        .rx-tab {
            flex: 1;
            min-height: 44px;
            padding: 9px 6px;
            text-align: center;
            font-size: 12px;
            font-weight: 600;
            color: var(--rx-subtext, #a6adc8);
            cursor: pointer;
            border: none;
            background: transparent;
            border-bottom: 2px solid transparent;
            transition: color 0.15s, border-color 0.2s, background 0.15s;
            letter-spacing: 0.3px;
        }
        .rx-tab:hover {
            color: var(--rx-text, #cdd6f4);
            background: rgba(255,255,255,0.03);
        }
        .rx-tab.rx-tab-active {
            color: var(--rx-accent, #89b4fa);
            border-bottom-color: var(--rx-accent, #89b4fa);
        }
        .rx-tab:focus-visible,
        #rx-collapse-strip:focus-visible,
        #rx-theater-close:focus-visible,
        #rx-split-right .rx-hdr-btn:focus-visible {
            outline: 3px solid var(--rx-accent, #89b4fa);
            outline-offset: -3px;
        }

        #rx-tab-chat {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        #rx-tab-chat .media-page-chat-aside-chat,
        #rx-tab-chat .media-page-chat-aside-chat-wrapper-fixed {
            position: static !important;
            width: 100% !important;
            height: 100% !important;
            top: auto !important;
            right: auto !important;
            display: flex !important;
            flex-direction: column !important;
        }
        #rx-tab-chat .media-page-chat-container-toggle-btn { display: none !important; }
        #rx-tab-chat .chat--header { flex-shrink: 0; }
        #rx-tab-chat #chat-history-list {
            flex: 1;
            overflow-y: auto !important;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.15) transparent;
        }
        #rx-tab-chat #chat-history-list::-webkit-scrollbar { width: 5px; }
        #rx-tab-chat #chat-history-list::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.14);
            border-radius: 3px;
        }
        #rx-tab-chat .chat-form-overflow-wrapper { flex-shrink: 0; }

        #rx-tab-comments {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }
        #rx-tab-comments::-webkit-scrollbar { width: 5px; }
        #rx-tab-comments::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.14);
            border-radius: 3px;
        }

        .rx-tab-content { display: none; }
        .rx-tab-content.rx-tab-visible { display: flex; }

        html.rx-theater .media-page-chat-aside-chat { display: none !important; }
        #rx-tab-chat .media-page-chat-aside-chat { display: flex !important; }

        #rx-collapse-strip {
            height: 44px;
            width: 100%;
            border: 0;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            background: rgba(255,255,255,0.025);
            color: var(--rx-subtext, #a6adc8);
            transition: background 0.2s, color 0.2s;
            cursor: default;
            flex-shrink: 0;
            font: 600 12px/1 system-ui, sans-serif;
        }
        #rx-collapse-strip:hover {
            color: var(--rx-text, #cdd6f4);
            background: rgba(137,180,250,0.12);
        }
        #rx-theater-close {
            position: absolute;
            top: 12px;
            left: 12px;
            z-index: 1000;
            width: 44px;
            height: 44px;
            border: 1px solid rgba(255,255,255,0.24);
            border-radius: 50%;
            background: rgba(0,0,0,0.78);
            color: #fff;
            cursor: pointer;
            font: 700 24px/1 system-ui, sans-serif;
        }
        #rx-split-left .rx-screenshot-btn { top: 64px; }
        @media (max-width: 700px), (pointer: coarse) {
            #rx-split-wrapper { flex-direction: column; }
            #rx-split-divider {
                width: 100% !important;
                height: 0;
                min-height: 0;
                cursor: row-resize;
            }
            #rx-split-divider::after {
                width: 32px;
                height: 4px;
            }
            #rx-split-right { width: 100% !important; }
        }
    `,

    _buildOverlay() {
        const wrapper = document.createElement('div');
        wrapper.id = 'rx-split-wrapper';

        const left = document.createElement('div');
        left.id = 'rx-split-left';

        const close = document.createElement('button');
        close.id = 'rx-theater-close';
        close.type = 'button';
        close.setAttribute('aria-label', 'Exit theater mode');
        close.title = 'Exit theater mode';
        close.textContent = '×';
        close.addEventListener('click', () => this._unmount({ restoreFocus: true }));
        left.appendChild(close);

        const divider = document.createElement('div');
        divider.id = 'rx-split-divider';
        divider.tabIndex = 0;
        divider.setAttribute('role', 'separator');
        divider.setAttribute('aria-label', 'Resize theater side panel');
        divider.setAttribute('aria-orientation', 'vertical');
        divider.setAttribute('aria-valuemin', '30');
        divider.setAttribute('aria-valuemax', '80');

        const right = document.createElement('div');
        right.id = 'rx-split-right';

        wrapper.appendChild(left);
        wrapper.appendChild(divider);
        wrapper.appendChild(right);

        return { wrapper, left, divider, right };
    },

    _isNarrow() {
        return matchMedia('(max-width: 700px), (pointer: coarse)').matches;
    },

    _applySplitGeometry(leftPct, persist = false) {
        const left = Math.max(30, Math.min(80, Number(leftPct) || 75));
        const right = qs('#rx-split-right');
        const divider = qs('#rx-split-divider');
        if (!right || !divider) return;
        right.style.flex = `0 0 ${100 - left}%`;
        divider.style.flex = '0 0 6px';
        if (this._isNarrow()) {
            right.style.width = '100%';
            divider.style.width = '100%';
            divider.style.height = '6px';
            divider.setAttribute('aria-orientation', 'horizontal');
        } else {
            right.style.width = '0';
            divider.style.width = '6px';
            divider.style.height = '';
            divider.setAttribute('aria-orientation', 'vertical');
        }
        divider.setAttribute('aria-valuenow', String(Math.round(left)));
        divider.setAttribute('aria-valuetext', `${Math.round(100 - left)} percent side panel`);
        if (persist) Settings.set('splitRatio', Math.round(left));
    },

    _initDividerDrag(divider, left, right) {
        const finishDrag = () => {
            divider.classList.remove('rx-dragging');
            qs('#rx-divider-drag-shield')?.remove();
            this._dragCleanup?.();
            this._dragCleanup = null;
        };
        divider.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            finishDrag();
            divider.classList.add('rx-dragging');
            const wrapper = this._splitWrapper;
            if (!wrapper) return;
            const narrow = this._isNarrow();
            const wrapperRect = wrapper.getBoundingClientRect();
            const total = narrow ? wrapperRect.height : wrapperRect.width;
            const startCoord = narrow ? e.clientY : e.clientX;
            const leftRect = left.getBoundingClientRect();
            const startLeftFrac = (narrow ? leftRect.height : leftRect.width) / total * 100;

            const shield = document.createElement('div');
            shield.id = 'rx-divider-drag-shield';
            shield.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;cursor:col-resize;';
            document.body.appendChild(shield);

            const onMove = (me) => {
                const coord = narrow ? me.clientY : me.clientX;
                const delta = coord - startCoord;
                const newLeft = Math.max(30, Math.min(80, startLeftFrac + (delta / total * 100)));
                this._applySplitGeometry(newLeft, true);
            };

            const onUp = () => finishDrag();
            this._dragCleanup = () => {
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
        divider.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
            e.preventDefault();
            const current = Number(divider.getAttribute('aria-valuenow')) || Settings.get('splitRatio') || 75;
            let next = current;
            if (e.key === 'Home') next = 30;
            else if (e.key === 'End') next = 80;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next -= 2;
            else next += 2;
            this._applySplitGeometry(next, true);
        });
    },

    _expandSplit() {
        if (this._isSplit) return;
        this._isSplit = true;
        document.documentElement.classList.add('rx-split');

        const right = qs('#rx-split-right');
        const divider = qs('#rx-split-divider');
        if (!right || !divider) return;

        const leftPct = Settings.get('splitRatio') || 75;
        const rightPct = 100 - leftPct;

        this._applySplitGeometry(leftPct);
        right.classList.add('rx-expanded');

        this._populateRight(right);
        this._attachRightScrollHandlers(right);
    },

    _collapseSplit() {
        if (!this._isSplit) return;
        this._isSplit = false;
        document.documentElement.classList.remove('rx-split');

        const right = qs('#rx-split-right');
        const divider = qs('#rx-split-divider');
        if (!right || !divider) return;

        right.style.flex = '0 0 0';
        right.style.width = '0';
        right.classList.remove('rx-expanded');
        divider.style.flex = '0 0 0';
        divider.style.width = '0';
        divider.style.height = '0';

        this._detachRightScrollHandlers();
    },

    _detectLive() {
        return !!qs('.media-page-chat-aside-chat') || !!qs('#chat-history-list');
    },

    _switchTab(tabName) {
        this._activeTab = tabName;
        const right = qs('#rx-split-right');
        if (!right) return;
        for (const tab of qsa('.rx-tab', right)) {
            const active = tab.dataset.tab === tabName;
            tab.classList.toggle('rx-tab-active', active);
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
        }
        for (const panel of qsa('.rx-tab-content', right)) {
            const active = panel.id === 'rx-tab-' + tabName;
            panel.classList.toggle('rx-tab-visible', active);
            panel.hidden = !active;
            panel.setAttribute('aria-hidden', String(!active));
        }
        if (tabName === 'download') {
            const panel = qs('#rx-tab-download', right);
            if (panel && !panel.dataset.loaded) {
                panel.dataset.loaded = '1';
                void VideoDownloader._loadQualities();
            }
        }
    },

    _buildHeader() {
        const header = document.createElement('div');
        header.className = 'rx-panel-header';

        const titleEl = qs('.video-header-container__title') || qs('h1');
        const channelEl = qs('.media-heading-name');

        const info = document.createElement('div');
        info.className = 'rx-header-info';
        const title = document.createElement('h3');
        title.textContent = titleEl ? titleEl.textContent.trim() : 'Video';
        const channel = document.createElement('span');
        channel.className = 'rx-channel';
        channel.textContent = channelEl ? channelEl.textContent.trim() : '';
        info.append(title, channel);

        const actions = document.createElement('div');
        actions.className = 'rx-header-actions';

        const homeBtn = document.createElement('a');
        homeBtn.id = 'rx-hdr-home';
        homeBtn.className = 'rx-hdr-btn';
        homeBtn.href = Settings.get('logoToFeed') ? 'https://rumble.com/subscriptions' : 'https://rumble.com/';
        homeBtn.title = Settings.get('logoToFeed') ? 'My Feed' : 'Rumble Home';
        homeBtn.setAttribute('aria-label', homeBtn.title);
        homeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 3C4.015 3 2 5.015 2 7.5v9C2 18.985 4.015 21 6.5 21h11c2.485 0 4.5-2.015 4.5-4.5v-9C22 5.015 19.985 3 17.5 3h-11zm3.25 4.5c.69 0 1.25.56 1.25 1.25v1.5l2.5-2.25c.33-.3.76-.5 1.22-.5h.78c.97 0 1.45 1.17.77 1.85L13.5 12l2.72 2.65c.68.68.2 1.85-.77 1.85h-.78c-.46 0-.89-.18-1.22-.5L11 13.75v1.5c0 .69-.56 1.25-1.25 1.25S8.5 15.94 8.5 15.25v-7.5c0-.69.56-1.25 1.25-1.25z" fill="#85d551"/></svg>';

        const gearBtn = document.createElement('button');
        gearBtn.id = 'rx-hdr-settings';
        gearBtn.className = 'rx-hdr-btn';
        gearBtn.type = 'button';
        gearBtn.title = 'RumbleX Settings';
        gearBtn.setAttribute('aria-label', 'Open RumbleX settings');
        gearBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';

        gearBtn.addEventListener('click', () => {
            document.body.classList.toggle('rx-panel-open');
        });

        actions.appendChild(homeBtn);

        if (Settings.get('videoDownload')) {
            const dlBtn = document.createElement('button');
            dlBtn.id = 'rx-hdr-download';
            dlBtn.className = 'rx-hdr-btn';
            dlBtn.type = 'button';
            dlBtn.title = 'Download Video';
            dlBtn.setAttribute('aria-label', 'Download video');
            dlBtn.innerHTML = VideoDownloader._downloadSVG;
            dlBtn.addEventListener('click', () => VideoDownloader._showDownloadTab());
            actions.appendChild(dlBtn);
        }

        actions.appendChild(gearBtn);

        header.appendChild(info);
        header.appendChild(actions);
        return header;
    },

    _populateRight(right) {
        if (right.querySelector('.rx-panel-header')) return;

        right.innerHTML = '';
        this._isLive = this._detectLive();

        const strip = document.createElement('button');
        strip.id = 'rx-collapse-strip';
        strip.type = 'button';
        strip.textContent = 'Collapse side panel';
        strip.setAttribute('aria-label', 'Collapse theater side panel');
        strip.addEventListener('click', () => this._collapseSplit());
        right.appendChild(strip);

        right.appendChild(this._buildHeader());

        right.classList.add('rx-tabbed');

        const tabBar = document.createElement('div');
        tabBar.id = 'rx-tab-bar';
        tabBar.setAttribute('role', 'tablist');
        tabBar.setAttribute('aria-label', 'Theater side panel');
        const defaultTab = this._isLive ? 'chat' : 'comments';

        const configureTab = (tab, name, label, active) => {
            tab.type = 'button';
            tab.className = 'rx-tab' + (active ? ' rx-tab-active' : '');
            tab.id = `rx-tab-button-${name}`;
            tab.dataset.tab = name;
            tab.textContent = label;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-controls', `rx-tab-${name}`);
            tab.setAttribute('aria-selected', String(active));
            tab.tabIndex = active ? 0 : -1;
            tab.addEventListener('click', () => this._switchTab(name));
        };

        if (this._isLive) {
            const chatTab = document.createElement('button');
            configureTab(chatTab, 'chat', 'Live Chat', true);
            tabBar.appendChild(chatTab);
        }

        const commentsTab = document.createElement('button');
        configureTab(commentsTab, 'comments', 'Comments', !this._isLive);
        tabBar.appendChild(commentsTab);

        if (Settings.get('videoDownload')) {
            const dlTab = document.createElement('button');
            configureTab(dlTab, 'download', 'Download', false);
            tabBar.appendChild(dlTab);
        }
        tabBar.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
            const tabs = qsa('.rx-tab', tabBar);
            const current = tabs.indexOf(document.activeElement);
            if (current < 0) return;
            e.preventDefault();
            let next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1
                : (current + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
            this._switchTab(tabs[next].dataset.tab);
            tabs[next].focus();
        });

        right.appendChild(tabBar);

        if (this._isLive) {
            const chatPanel = document.createElement('div');
            chatPanel.id = 'rx-tab-chat';
            chatPanel.className = 'rx-tab-content rx-tab-visible';
            chatPanel.setAttribute('role', 'tabpanel');
            chatPanel.setAttribute('aria-labelledby', 'rx-tab-button-chat');
            chatPanel.setAttribute('aria-hidden', 'false');
            const chatEl = qs('.media-page-chat-aside-chat');
            if (chatEl) {
                this._chatEl = chatEl;
                this._origChatParent = chatEl.parentElement;
                this._origChatNext = chatEl.nextSibling;
                chatPanel.appendChild(chatEl);
            } else {
                const empty = document.createElement('div');
                empty.className = 'rx-empty-state';
                empty.setAttribute('role', 'status');
                empty.textContent = 'Live chat isn\u2019t available for this video.';
                chatPanel.appendChild(empty);
            }
            right.appendChild(chatPanel);
        }

        const commentsPanel = document.createElement('div');
        commentsPanel.id = 'rx-tab-comments';
        commentsPanel.className = 'rx-tab-content' + (this._isLive ? '' : ' rx-tab-visible');
        commentsPanel.setAttribute('role', 'tabpanel');
        commentsPanel.setAttribute('aria-labelledby', 'rx-tab-button-comments');
        commentsPanel.setAttribute('aria-hidden', String(this._isLive));
        commentsPanel.hidden = this._isLive;
        const commentsSource = qs('.media-page-comments-container') || qs('#video-comments');
        if (commentsSource) {
            this._commentsEl = commentsSource;
            this._origCommentsParent = commentsSource.parentElement;
            this._origCommentsNext = commentsSource.nextSibling;
            this._origCommentsStyle = commentsSource.getAttribute('style');
            commentsSource.style.display = 'block';
            commentsSource.style.padding = '0 8px';
            commentsPanel.appendChild(commentsSource);
        } else {
            const empty = document.createElement('div');
            empty.className = 'rx-empty-state';
            empty.setAttribute('role', 'status');
            empty.textContent = 'Comments haven\u2019t loaded yet.';
            commentsPanel.appendChild(empty);
        }
        right.appendChild(commentsPanel);

        if (Settings.get('videoDownload')) {
            const dlPanel = document.createElement('div');
            dlPanel.id = 'rx-tab-download';
            dlPanel.className = 'rx-tab-content';
            dlPanel.setAttribute('role', 'tabpanel');
            dlPanel.setAttribute('aria-labelledby', 'rx-tab-button-download');
            dlPanel.setAttribute('aria-hidden', 'true');
            dlPanel.hidden = true;
            const body = document.createElement('div');
            body.className = 'rx-dl-body';
            const status = document.createElement('div');
            status.className = 'rx-dl-status';
            status.setAttribute('role', 'status');
            status.textContent = 'Choose Download to load available formats.';
            body.appendChild(status);
            dlPanel.appendChild(body);
            right.appendChild(dlPanel);
        }

        this._activeTab = defaultTab;
    },

    _attachRightScrollHandlers(right) {
        const getScrollTarget = () => {
            if (this._activeTab === 'chat') return qs('#chat-history-list');
            return qs('#rx-tab-' + this._activeTab) || right;
        };

        this._rightWheelHandler = (e) => {
            const scrollTarget = getScrollTarget();
            if (scrollTarget && scrollTarget.scrollTop <= 0 && e.deltaY < 0) {
                this._collapseSplit();
            }
        };
        this._rightTouchHandler = null;
        let touchY = 0;

        const onTouchStart = (e) => { touchY = e.touches[0].clientY; };
        const onTouchMove = (e) => {
            const scrollTarget = getScrollTarget();
            const dy = e.touches[0].clientY - touchY;
            if (scrollTarget && scrollTarget.scrollTop <= 0 && dy > 40) {
                this._collapseSplit();
            }
        };

        right.addEventListener('wheel', this._rightWheelHandler, { passive: true });
        right.addEventListener('touchstart', onTouchStart, { passive: true });
        right.addEventListener('touchmove', onTouchMove, { passive: true });
        this._rightTouchHandler = { start: onTouchStart, move: onTouchMove };
    },

    _detachRightScrollHandlers() {
        const right = qs('#rx-split-right');
        if (!right) return;
        if (this._rightWheelHandler) right.removeEventListener('wheel', this._rightWheelHandler);
        if (this._rightTouchHandler) {
            right.removeEventListener('touchstart', this._rightTouchHandler.start);
            right.removeEventListener('touchmove', this._rightTouchHandler.move);
        }
    },

    _mountOverlay() {
        if (this._isActive) return;

        const player = qs('#videoPlayer');
        if (!player) return;

        this._isActive = true;
        this._playerEl = player;
        this._focusBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.documentElement.classList.add('rx-theater');

        this._origPlayerParent = player.parentElement;
        this._origPlayerNext = player.nextSibling;
        this._origPlayerStyle = player.getAttribute('style');

        const { wrapper, left, divider, right } = this._buildOverlay();
        this._splitWrapper = wrapper;
        this._leftEl = left;

        const video = getActiveMedia(player);
        this._videoEl = video;
        this._origVideoStyle = video?.getAttribute('style') ?? null;
        const wasPlaying = video && !video.paused;

        left.insertBefore(player, left.firstChild);
        document.body.appendChild(wrapper);

        if (wasPlaying && video) {
            requestAnimationFrame(() => video.play().catch(() => {}));
        }

        this._initDividerDrag(divider, left, right);

        this._wheelHandler = (e) => {
            if (!this._isSplit && e.deltaY > 0) {
                this._expandSplit();
                return;
            }
            if (this._isSplit) {
                if (this._isLive && this._activeTab === 'chat') {
                    const chatList = qs('#chat-history-list');
                    if (chatList && chatList.scrollTop <= 0 && e.deltaY < 0) {
                        this._collapseSplit();
                    } else if (chatList) {
                        chatList.scrollBy({ top: e.deltaY, behavior: 'auto' });
                    }
                    return;
                }
                const scrollTarget = this._isLive ? qs('#rx-tab-comments') : right;
                if (scrollTarget && scrollTarget.scrollTop <= 0 && e.deltaY < 0) {
                    this._collapseSplit();
                } else if (scrollTarget) {
                    scrollTarget.scrollBy({ top: e.deltaY, behavior: 'auto' });
                }
            }
        };

        this._touchStartY = 0;
        const onTouchStart = (e) => { this._touchStartY = e.touches[0].clientY; };
        const onTouchMove = (e) => {
            if (!this._isSplit && this._touchStartY - e.touches[0].clientY > 30) {
                this._expandSplit();
            }
        };

        left.addEventListener('wheel', this._wheelHandler, { passive: true, capture: true });
        left.addEventListener('touchstart', onTouchStart, { passive: true });
        left.addEventListener('touchmove', onTouchMove, { passive: true });
        this._touchHandler = { start: onTouchStart, move: onTouchMove };

        this._windowResizeHandler = () => {
            if (this._isSplit) {
                const leftPct = Settings.get('splitRatio') || 75;
                this._applySplitGeometry(leftPct);
            }
        };
        window.addEventListener('resize', this._windowResizeHandler);

        this._keyHandler = (e) => {
            if (e.key === 'Escape' && this._isActive) {
                e.preventDefault();
                this._unmount({ restoreFocus: true });
            }
        };
        document.addEventListener('keydown', this._keyHandler);

        this._playerResizeObs = new ResizeObserver(() => {
            const v = getActiveMedia(left);
            if (v) { v.style.width = '100%'; v.style.height = '100%'; }
        });
        this._playerResizeObs.observe(left);
    },

    _unmount({ restoreFocus = false } = {}) {
        if (!this._isActive) return;

        const player = this._playerEl;
        const video = this._videoEl || (player ? getActiveMedia(player) : null);
        const wasPlaying = video && !video.paused;

        if (player && this._origPlayerParent?.isConnected) {
            if (this._origPlayerNext?.parentNode === this._origPlayerParent) {
                this._origPlayerParent.insertBefore(player, this._origPlayerNext);
            } else {
                this._origPlayerParent.appendChild(player);
            }
        }

        const chatEl = this._chatEl;
        if (chatEl && this._origChatParent?.isConnected) {
            if (this._origChatNext?.parentNode === this._origChatParent) {
                this._origChatParent.insertBefore(chatEl, this._origChatNext);
            } else {
                this._origChatParent.appendChild(chatEl);
            }
        }

        const commentsEl = this._commentsEl;
        if (commentsEl && this._origCommentsParent?.isConnected) {
            if (this._origCommentsStyle == null) commentsEl.removeAttribute('style');
            else commentsEl.setAttribute('style', this._origCommentsStyle);
            if (this._origCommentsNext?.parentNode === this._origCommentsParent) {
                this._origCommentsParent.insertBefore(commentsEl, this._origCommentsNext);
            } else {
                this._origCommentsParent.appendChild(commentsEl);
            }
        }

        if (wasPlaying && video) {
            requestAnimationFrame(() => video.play().catch(() => {}));
        }

        this._detachRightScrollHandlers();
        if (this._leftEl && this._wheelHandler) this._leftEl.removeEventListener('wheel', this._wheelHandler, true);
        if (this._leftEl && this._touchHandler) {
            this._leftEl.removeEventListener('touchstart', this._touchHandler.start);
            this._leftEl.removeEventListener('touchmove', this._touchHandler.move);
        }
        this._dragCleanup?.();
        this._dragCleanup = null;
        qs('#rx-divider-drag-shield')?.remove();
        this._playerResizeObs?.disconnect();
        this._playerResizeObs = null;
        if (this._windowResizeHandler) window.removeEventListener('resize', this._windowResizeHandler);
        this._windowResizeHandler = null;
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        this._keyHandler = null;

        this._splitWrapper?.remove();
        this._splitWrapper = null;
        this._isActive = false;
        this._isSplit = false;
        this._isLive = false;
        document.documentElement.classList.remove('rx-theater', 'rx-split');

        if (video) {
            if (this._origVideoStyle == null) video.removeAttribute('style');
            else video.setAttribute('style', this._origVideoStyle);
        }
        if (player) {
            if (this._origPlayerStyle == null) player.removeAttribute('style');
            else player.setAttribute('style', this._origPlayerStyle);
        }
        if (restoreFocus && this._focusBeforeOpen?.isConnected) this._focusBeforeOpen.focus();

        this._origPlayerParent = null;
        this._origPlayerNext = null;
        this._origChatParent = null;
        this._origChatNext = null;
        this._origCommentsParent = null;
        this._origCommentsNext = null;
        this._origPlayerStyle = null;
        this._origVideoStyle = null;
        this._origCommentsStyle = null;
        this._playerEl = null;
        this._videoEl = null;
        this._chatEl = null;
        this._commentsEl = null;
        this._leftEl = null;
        this._wheelHandler = null;
        this._touchHandler = null;
        this._rightWheelHandler = null;
        this._rightTouchHandler = null;
        this._focusBeforeOpen = null;
        this._positionedEls = [];
    },

    _syncRoute() {
        const token = ++this._mountToken;
        if (!Page.isWatch()) {
            this._unmount();
            return;
        }
        if (this._isActive) this._unmount();
        waitForFeature(this, '#videoPlayer').then(() => {
            if (token === this._mountToken && Page.isWatch()) this._mountOverlay();
        }).catch(() => {});
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-theater-css');
        this._routerUnsub = Router.onChange((detail) => {
            if (detail.changed) {
                this._mountToken++;
                this._unmount();
                this._awaitingRouteDom = Page.isWatch();
                clearTimeout(this._routeTimer);
                this._routeTimer = setTimeout(() => {
                    if (this._awaitingRouteDom) {
                        this._awaitingRouteDom = false;
                        this._syncRoute();
                    }
                }, 1500);
                return;
            }
            if (!detail.reason.startsWith('htmx:')) return;
            const currentPlayer = qs('#videoPlayer');
            if (this._awaitingRouteDom || (Page.isWatch() && (!this._isActive || !this._playerEl?.isConnected || currentPlayer !== this._playerEl))) {
                this._awaitingRouteDom = false;
                clearTimeout(this._routeTimer);
                this._syncRoute();
            }
        });
        this._syncRoute();
    },

    destroy() {
        this._mountToken++;
        clearTimeout(this._routeTimer);
        this._routeTimer = null;
        this._awaitingRouteDom = false;
        this._routerUnsub?.();
        this._routerUnsub = null;
        this._unmount();
        this._styleEl?.remove();
        this._styleEl = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Video Downloader
// ═══════════════════════════════════════════
const VideoDownloader = {
    id: 'videoDownload',
    name: 'Video Download',
    _styleEl: null,
    _worker: null,
    _mediabunnyWorker: null,
    _lastMuxerContext: null,

    _css: `
        #rx-download-btn:hover { border-color: rgba(166,227,161,0.6) !important; }
        #rx-hdr-download:hover { border-color: rgba(166,227,161,0.6) !important; }

        #rx-tab-download {
            flex-direction: column;
            padding: 16px;
            overflow-y: auto;
        }
        #rx-tab-download .rx-dl-body { padding: 0; }

        .rx-dl-quality {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            margin: 4px 0;
            border-radius: 10px;
            background: rgba(49,50,68,0.4);
            border: 1px solid rgba(255,255,255,0.04);
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s;
        }
        .rx-dl-quality:hover {
            background: rgba(49,50,68,0.7);
            border-color: rgba(137,180,250,0.2);
        }
        .rx-dl-quality-label {
            font-size: 14px;
            font-weight: 600;
            color: var(--rx-text, #cdd6f4);
        }
        .rx-dl-quality-meta {
            font-size: 11px;
            color: var(--rx-subtext, #a6adc8);
        }

        .rx-dl-progress-wrap { margin-top: 12px; }
        .rx-dl-status {
            font-size: 12px;
            color: var(--rx-subtext, #a6adc8);
            margin-bottom: 8px;
        }
        .rx-dl-bar-bg {
            width: 100%;
            height: 6px;
            background: rgba(49,50,68,0.6);
            border-radius: 3px;
            overflow: hidden;
        }
        .rx-dl-bar-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, var(--rx-accent, #89b4fa), #a6e3a1);
            border-radius: 3px;
            transition: width 0.15s ease;
        }
        .rx-dl-cancel {
            min-height: 36px; margin-top: 12px; padding: 7px 14px;
            border: 1px solid rgba(243,139,168,0.35); border-radius: 7px;
            background: rgba(243,139,168,0.10); color: #f38ba8;
            cursor: pointer; font: 600 12px/1 system-ui, sans-serif;
        }
        .rx-dl-cancel:hover { background: rgba(243,139,168,0.18); }
        .rx-dl-cancel:focus-visible { outline: 3px solid #f38ba8; outline-offset: 2px; }
        .rx-dl-done {
            text-align: center;
            padding: 20px 0;
            color: #a6e3a1;
            font-weight: 600;
            font-size: 14px;
        }
        .rx-dl-error {
            color: #f38ba8;
            font-size: 12px;
            margin-top: 8px;
            word-break: break-word;
        }

        .rx-dl-format-row {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }
        .rx-dl-format-btn {
            flex: 1;
            padding: 8px;
            border-radius: 8px;
            border: 1px solid rgba(137,180,250,0.15);
            background: rgba(49,50,68,0.4);
            color: var(--rx-text, #cdd6f4);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            text-align: center;
            transition: background 0.15s, border-color 0.15s;
        }
        .rx-dl-format-btn:hover {
            background: rgba(49,50,68,0.7);
            border-color: rgba(137,180,250,0.3);
        }
        .rx-dl-format-btn small {
            display: block;
            font-weight: 400;
            font-size: 10px;
            color: var(--rx-subtext, #a6adc8);
            margin-top: 2px;
        }

        /* ── Deep scan (RUD) additions ── */
        .rx-dl-scan-bar {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 10px; margin-bottom: 8px;
            background: rgba(137,180,250,0.08); border: 1px solid rgba(137,180,250,0.18);
            border-radius: 8px;
            font: 11px system-ui, sans-serif; color: var(--rx-subtext, #a6adc8);
        }
        .rx-dl-scan-bar .rx-dl-scan-label { flex: 1; }
        .rx-dl-scan-bar .rx-dl-scan-counter {
            font-variant-numeric: tabular-nums; color: var(--rx-text, #cdd6f4); font-weight: 600;
        }
        .rx-dl-scan-bar .rx-dl-scan-mini {
            width: 60px; height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;
        }
        .rx-dl-scan-bar .rx-dl-scan-mini > div {
            height: 100%; width: 0%; background: var(--rx-accent, #89b4fa);
            transition: width 0.2s ease;
        }
        .rx-dl-scan-bar.done {
            background: rgba(166,227,161,0.08);
            border-color: rgba(166,227,161,0.18);
            color: #a6e3a1;
        }

        .rx-dl-group-title {
            font: 700 10px/1 system-ui, sans-serif;
            color: var(--rx-subtext, #a6adc8);
            text-transform: uppercase; letter-spacing: 0.08em;
            padding: 8px 4px 4px;
        }
        .rx-dl-group-title:first-child { padding-top: 0; }

        .rx-dl-quality {
            gap: 8px;
        }
        .rx-dl-quality-row-inner {
            display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;
            padding: 0; border: 0; background: transparent; color: inherit;
            text-align: left; cursor: pointer;
        }
        .rx-dl-quality-row-inner:focus-visible,
        .rx-dl-copy-btn:focus-visible { outline: 3px solid var(--rx-accent, #89b4fa); outline-offset: 2px; }
        .rx-dl-quality-main {
            flex: 1; min-width: 0;
        }
        .rx-dl-type-badge {
            display: inline-block; padding: 1px 6px; margin-left: 6px;
            font: 600 9px/1.4 system-ui, sans-serif; letter-spacing: 0.04em; text-transform: uppercase;
            border-radius: 6px;
            background: rgba(255,255,255,0.06); color: var(--rx-subtext, #a6adc8);
        }
        .rx-dl-type-badge.type-tar {
            background: rgba(249,226,175,0.14); color: #f9e2af;
        }
        .rx-dl-copy-btn {
            background: transparent; border: 0; padding: 4px; margin: 0;
            color: var(--rx-subtext, #a6adc8); cursor: pointer; opacity: 0;
            transition: opacity 0.12s, color 0.12s;
            border-radius: 4px; display: flex; align-items: center; justify-content: center;
        }
        .rx-dl-quality:hover .rx-dl-copy-btn,
        .rx-dl-copy-btn:focus-visible { opacity: 0.7; }
        .rx-dl-copy-btn:hover { opacity: 1; color: var(--rx-text, #cdd6f4); background: rgba(255,255,255,0.06); }
        .rx-dl-copy-btn.copied { color: #a6e3a1; opacity: 1; }
        .rx-dl-copy-btn svg { width: 12px; height: 12px; }

        .rx-dl-tar-note {
            margin-top: 6px; padding: 8px 10px;
            background: rgba(249,226,175,0.06); border: 1px solid rgba(249,226,175,0.16);
            border-radius: 6px;
            font: 10px/1.5 system-ui, sans-serif; color: var(--rx-subtext, #a6adc8);
        }
        .rx-dl-tar-note strong { color: #f9e2af; }
    `,

    _downloadSVG: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    _copySVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
    _checkSVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',

    // ── RUD (Rumble Universal Downloader) constants ──
    _CDN_HOST: 'https://hugh.cdn.rumble.cloud',
    _TOKEN_LABELS: { haa: '1080p', gaa: '720p', caa: '480p', baa: '360p', oaa: '240p' },
    _TOKENS: ['haa', 'gaa', 'caa', 'baa', 'oaa'],
    _EMBED_UNITS: ['u0', 'u1', 'u2', 'u3', 'u4'],
    _PROBE_CONCURRENCY: 6,
    _PROBE_TIMEOUT_MS: 12000,
    _MAX_IN_MEMORY_BYTES: 512 * 1024 * 1024,
    _scanController: null,
    _downloadController: null,
    _scanSeq: 0, // guards against late results after the user navigates away

    _getEmbedId() {
        const player = qs('[id^="vid_v"]');
        if (player) return player.id.replace('vid_', '');
        const oembed = qs('link[href*="oembed"]');
        if (oembed) {
            const m = oembed.href.match(/embed%2F(v[a-z0-9]+)/i);
            if (m) return m[1];
        }
        return null;
    },

    _getTitle() {
        const el = qs('.video-header-container__title') || qs('h1');
        return el ? el.textContent.trim().replace(/[<>:"/\\|?*]/g, '_').substring(0, 120) : 'rumble_video';
    },

    _safeMediaUrl(raw, base = location.href) {
        if (!raw) return null;
        try {
            const parsed = new URL(String(raw), base);
            const approved = ['rumble.com', 'rumble.cloud', '1a-1791.com'].some((host) =>
                parsed.hostname === host || parsed.hostname.endsWith('.' + host)
            );
            return parsed.protocol === 'https:' && approved ? parsed.href : null;
        } catch { return null; }
    },

    _extractHlsUrl(data) {
        const candidates = [
            data?.u?.hls?.auto?.url,
            data?.ua?.hls?.auto?.url,
            data?.u?.hls?.url,
            data?.ua?.hls?.url,
        ];
        for (const candidate of candidates) {
            const safe = this._safeMediaUrl(candidate);
            if (safe) return safe;
        }
        return null;
    },

    async _fetchEmbedData(embedId, signal = this._scanController?.signal) {
        const url = `https://rumble.com/embedJS/u3/?request=video&ver=2&v=${embedId}`;
        const resp = await RXPlatform.fetch(url, { signal });
        if (!resp.ok) throw this._httpError(resp, 'embed-api', url);
        return resp.json();
    },

    _parseQualities(data) {
        const qualities = [];
        const sources = [data?.ua, data?.u].filter((source) => source && typeof source === 'object');

        // Check for direct MP4/webm URLs (NOT tar - those are HLS containers)
        for (const src of sources) {
            for (const fmt of ['mp4', 'webm']) {
                const group = src[fmt];
                if (!group || typeof group !== 'object') continue;
                if (group.url && group.meta?.h > 0) {
                    const directUrl = this._safeMediaUrl(group.url);
                    if (directUrl) qualities.push({
                        key: fmt, label: `${group.meta.h}p`, height: group.meta.h,
                        width: group.meta.w || 0, bitrate: group.meta.bitrate || 0,
                        size: group.meta.size || 0, directUrl, type: fmt,
                    });
                    continue;
                }
                for (const [key, val] of Object.entries(group)) {
                    const directUrl = this._safeMediaUrl(val?.url);
                    if (!directUrl || !val?.meta?.h) continue;
                    qualities.push({
                        key, label: `${val.meta.h}p`, height: val.meta.h,
                        width: val.meta.w || 0, bitrate: val.meta.bitrate || 0,
                        size: val.meta.size || 0, directUrl, type: fmt,
                    });
                }
            }
        }

        // Add entries from tar metadata (tar URLs are HLS containers, NOT direct MP4s)
        for (const src of sources) {
            const tar = src.tar;
            if (!tar || typeof tar !== 'object') continue;
            for (const [key, val] of Object.entries(tar)) {
                if (!val?.meta?.h) continue;
                const h = val.meta.h;
                if (qualities.some(q => q.height === h)) continue;
                qualities.push({
                    key, label: `${h}p`, height: h,
                    width: val.meta.w || 0, bitrate: val.meta.bitrate || 0,
                    size: val.meta.size || 0, directUrl: null, type: 'hls',
                });
            }
        }

        qualities.sort((a, b) => b.height - a.height);
        const seen = new Map();
        for (const q of qualities) {
            const existing = seen.get(q.height);
            if (!existing || (q.directUrl && !existing.directUrl) || q.bitrate > existing.bitrate) {
                seen.set(q.height, q);
            }
        }
        return [...seen.values()];
    },

    _parseMasterPlaylist(text, baseUrl) {
        const variants = [];
        const lines = text.trim().split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
                const info = lines[i];
                const url = lines[i + 1]?.trim();
                if (url && !url.startsWith('#')) {
                    const safeUrl = this._safeMediaUrl(url, baseUrl);
                    if (!safeUrl) continue;
                    const resMatch = info.match(/RESOLUTION=(\d+)x(\d+)/);
                    const bwMatch = info.match(/BANDWIDTH=(\d+)/);
                    variants.push({
                        url: safeUrl,
                        width: resMatch ? parseInt(resMatch[1]) : 0,
                        height: resMatch ? parseInt(resMatch[2]) : 0,
                        bandwidth: bwMatch ? parseInt(bwMatch[1]) : 0,
                    });
                }
            }
        }
        return variants;
    },

    _parseSegmentPlaylist(text, baseUrl) {
        const segments = [];
        const lines = text.trim().split('\n');
        for (const line of lines) {
            const t = line.trim();
            if (t && !t.startsWith('#')) {
                const safeUrl = this._safeMediaUrl(t, baseUrl);
                if (safeUrl) segments.push(safeUrl);
            }
        }
        return segments;
    },

    _supportsStreamingFileSave() {
        return !!RXPlatform.capabilities.streamingFileSave
            && typeof globalThis.showSaveFilePicker === 'function';
    },

    async _resolveHlsSegments(quality, { signal, diagnosticUrls = [], onStage } = {}) {
        const masterUrl = this._safeMediaUrl(this._hlsUrl);
        if (!masterUrl) throw new Error('Rumble did not provide a valid HLS playlist.');

        onStage?.('master-playlist', 0, 'Fetching stream playlist…');
        diagnosticUrls.push({ role: 'master-playlist', url: masterUrl });
        const masterResponse = await RXPlatform.fetch(masterUrl, { signal });
        if (!masterResponse.ok) throw this._httpError(masterResponse, 'master-playlist', masterUrl);
        const masterText = await masterResponse.text();
        const variants = this._parseMasterPlaylist(masterText, masterUrl);

        let variantUrl = masterUrl;
        let variantText = masterText;
        if (variants.length) {
            onStage?.('quality-selection', 1, 'Selecting stream quality…');
            let variant = variants.find((entry) => entry.height === quality?.height);
            if (!variant) {
                variant = variants.reduce((closest, entry) => (
                    Math.abs(entry.height - Number(quality?.height || 0))
                        < Math.abs(closest.height - Number(quality?.height || 0)) ? entry : closest
                ), variants[0]);
            }
            if (!variant) throw new Error('No matching stream variant found');
            variantUrl = variant.url;
            diagnosticUrls.push({ role: 'segment-playlist', url: variantUrl });
            onStage?.('segment-playlist', 2, 'Fetching segment list…');
            const variantResponse = await RXPlatform.fetch(variantUrl, { signal });
            if (!variantResponse.ok) throw this._httpError(variantResponse, 'segment-playlist', variantUrl);
            variantText = await variantResponse.text();
        }

        const segmentUrls = this._parseSegmentPlaylist(variantText, variantUrl);
        if (!segmentUrls.length) {
            const error = new Error('No segments found in playlist');
            error.rxStage = 'segment-playlist';
            error.rxUrl = variantUrl;
            throw error;
        }
        return { segmentUrls, variantUrl };
    },

    async _streamHlsToWritable(quality, writable, {
        signal,
        diagnosticUrls = [],
        onProgress,
        onStage,
    } = {}) {
        if (!writable || typeof writable.write !== 'function') {
            throw new Error('The selected file is not writable.');
        }
        const { segmentUrls } = await this._resolveHlsSegments(quality, {
            signal,
            diagnosticUrls,
            onStage,
        });
        let bytes = 0;
        let completed = 0;

        for (const url of segmentUrls) {
            if (signal?.aborted) throw new DOMException('The download was cancelled.', 'AbortError');
            const response = await RXPlatform.fetch(url, { signal });
            if (!response.ok) throw this._httpError(response, 'segment-download', url);
            const reader = response.body?.getReader?.();
            if (reader) {
                let readerDone = false;
                try {
                    while (true) {
                        if (signal?.aborted) throw new DOMException('The download was cancelled.', 'AbortError');
                        const { value, done } = await reader.read();
                        if (done) { readerDone = true; break; }
                        if (!value?.byteLength) continue;
                        await writable.write(value);
                        bytes += value.byteLength;
                    }
                } finally {
                    if (!readerDone) {
                        try { await reader.cancel(); } catch {}
                    }
                    try { reader.releaseLock(); } catch {}
                }
            } else {
                const buffer = await response.arrayBuffer();
                await writable.write(new Uint8Array(buffer));
                bytes += buffer.byteLength;
            }
            completed++;
            onProgress?.({ completed, total: segmentUrls.length, bytes });
        }
        return { bytes, segments: completed };
    },

    async _downloadBuffers(urls, { signal, concurrency = 6, onProgress, stage = 'segment-download' } = {}) {
        const buffers = [];
        let bytes = 0;
        for (let i = 0; i < urls.length; i += concurrency) {
            if (signal?.aborted) throw new DOMException('The download was cancelled.', 'AbortError');
            const batch = urls.slice(i, i + concurrency);
            const results = await Promise.all(batch.map(async (url) => {
                const response = await RXPlatform.fetch(url, { signal });
                if (!response.ok) throw this._httpError(response, stage, url);
                return response.arrayBuffer();
            }));
            bytes += results.reduce((total, buffer) => total + buffer.byteLength, 0);
            if (bytes > this._MAX_IN_MEMORY_BYTES) {
                const error = new Error(`Stream exceeded the ${this._formatSize(this._MAX_IN_MEMORY_BYTES)} safe in-memory conversion limit.`);
                error.code = 'in-memory-limit';
                throw error;
            }
            buffers.push(...results);
            onProgress?.(buffers.length, urls.length, bytes);
        }
        return buffers;
    },

    _supportsMuxjsWorker() {
        return RXPlatform.capabilities.muxjs !== false
            && typeof Worker === 'function'
            && typeof Blob === 'function'
            && typeof URL !== 'undefined'
            && typeof URL.createObjectURL === 'function';
    },

    async _getMuxWorker() {
        if (this._worker) return this._worker;
        // The Greasy Fork-compliant "lite" userscript ships without either
        // bundled transmuxer, so say so plainly instead of failing deep inside
        // asset resolution with "Userscript asset is unavailable".
        if (!this._supportsMuxjsWorker()) {
            throw new Error('This build ships without a bundled transmuxer - save the raw stream instead');
        }
        // Fetch worker + mux.js source and create blob Worker
        // (content script can't construct Workers from chrome-extension:// URLs)
        const [workerSrc, muxSrc] = await Promise.all([
            RXPlatform.assetText('worker.js'),
            RXPlatform.assetText('lib/mux.min.js'),
        ]);
        const blob = new Blob([muxSrc, '\n', workerSrc.replace(/^importScripts\([^)]*\);?\s*/m, '')], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this._worker = new Worker(workerUrl);
        URL.revokeObjectURL(workerUrl);
        return this._worker;
    },

    _supportsMediabunnyWorker() {
        return RXPlatform.capabilities.mediabunny
            && typeof Worker === 'function'
            && typeof Blob === 'function'
            && typeof URL !== 'undefined'
            && typeof URL.createObjectURL === 'function'
            && typeof VideoDecoder === 'function';
    },

    async _getMediabunnyWorker() {
        if (this._mediabunnyWorker) return this._mediabunnyWorker;
        if (!this._supportsMediabunnyWorker()) {
            throw new Error('Mediabunny engine requires module Workers and WebCodecs');
        }
        const [workerSrc, mediabunnyUrl] = await Promise.all([
            RXPlatform.assetText('mediabunny-worker.js'),
            Promise.resolve(RXPlatform.assetUrl('lib/mediabunny.min.mjs')),
        ]);
        const bootstrap = 'const RUMBLEX_MEDIABUNNY_URL = ' + JSON.stringify(mediabunnyUrl) + ';\n';
        const blob = new Blob([bootstrap, workerSrc], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this._mediabunnyWorker = new Worker(workerUrl, { type: 'module' });
        URL.revokeObjectURL(workerUrl);
        return this._mediabunnyWorker;
    },

    // Shared conversion bound for both muxer workers: a 20s floor for tiny
    // inputs, ~5ms per KiB after that, capped at 10 minutes. A worker that
    // exceeds it is terminated rather than left holding an unsettled promise.
    _workerTimeoutMs(inputBytes) {
        return Math.min(
            10 * 60 * 1000,
            Math.max(20 * 1000, 15 * 1000 + Math.ceil((Number(inputBytes) || 0) / 1024) * 5),
        );
    },

    async _transmuxWithMediabunny(tsBuffers, signal) {
        const worker = await this._getMediabunnyWorker();
        return new Promise((resolve, reject) => {
            const id = Date.now() + Math.random();
            const inputBytes = tsBuffers.reduce((total, buffer) => total + (buffer?.byteLength || 0), 0);
            const timeoutMs = this._workerTimeoutMs(inputBytes);
            let workerDiagnostic = { engine: 'mediabunnyWebCodecs', stage: 'worker-dispatch', inputBytes };
            const timeout = setTimeout(() => {
                cleanup();
                if (this._mediabunnyWorker === worker) {
                    try { worker.terminate(); } catch {}
                    this._mediabunnyWorker = null;
                }
                const error = new Error('Mediabunny conversion timed out after ' + Math.ceil(timeoutMs / 1000) + 's');
                error.rxWorkerDiagnostic = { ...workerDiagnostic, timeoutMs };
                reject(error);
            }, timeoutMs);

            const cleanup = () => {
                clearTimeout(timeout);
                worker.removeEventListener('message', handler);
                worker.removeEventListener('error', errorHandler);
                worker.removeEventListener('messageerror', errorHandler);
                signal?.removeEventListener('abort', abortHandler);
            };
            const abortHandler = () => {
                cleanup();
                if (this._mediabunnyWorker === worker) {
                    try { worker.terminate(); } catch {}
                    this._mediabunnyWorker = null;
                }
                reject(new DOMException('The download was cancelled.', 'AbortError'));
            };
            const handler = (e) => {
                if (e.data.id !== id) return;
                if (e.data.debug) {
                    workerDiagnostic = { ...workerDiagnostic, ...e.data.debug };
                    console.log('[RumbleX] Mediabunny stage: ' + (e.data.debug.stage || 'unknown'));
                    return;
                }
                cleanup();
                if (e.data.error) {
                    const error = new Error(e.data.error);
                    error.rxWorkerDiagnostic = e.data.diagnostic || null;
                    reject(error);
                } else {
                    workerDiagnostic = { ...workerDiagnostic, ...(e.data.diagnostic || {}) };
                    resolve(e.data.blob);
                }
            };
            const errorHandler = (e) => {
                cleanup();
                if (this._mediabunnyWorker === worker) {
                    try { worker.terminate(); } catch {}
                    this._mediabunnyWorker = null;
                }
                const error = new Error(e?.message || 'Mediabunny worker failed');
                error.rxWorkerDiagnostic = { ...workerDiagnostic, stage: workerDiagnostic.stage || 'worker-runtime' };
                reject(error);
            };

            worker.addEventListener('message', handler);
            worker.addEventListener('error', errorHandler);
            worker.addEventListener('messageerror', errorHandler);
            if (signal?.aborted) return abortHandler();
            signal?.addEventListener('abort', abortHandler, { once: true });
            // Do not transfer here: if the experimental path fails, the mux.js
            // fallback still needs the original buffers.
            worker.postMessage({ id, action: 'transmux-mediabunny', buffers: tsBuffers });
        });
    },

    async _transmuxWithMuxWorker(tsBuffers, signal) {
        const worker = await this._getMuxWorker();
        return new Promise((resolve, reject) => {
            const id = Date.now();
            // mux.js is unmaintained and parses attacker-influenced MPEG-TS, so a
            // malformed segment can wedge it in a loop the worker never returns
            // from. Without a bound the promise never settles: the panel hangs
            // with no error and no diagnostics entry. Same input-scaled envelope
            // as the Mediabunny path.
            const inputBytes = tsBuffers.reduce((total, buffer) => total + (buffer?.byteLength || 0), 0);
            const timeoutMs = this._workerTimeoutMs(inputBytes);
            const timeout = setTimeout(() => {
                cleanup();
                if (this._worker === worker) {
                    try { worker.terminate(); } catch {}
                    this._worker = null;
                }
                const error = new Error('mux.js conversion timed out after ' + Math.ceil(timeoutMs / 1000) + 's');
                error.rxWorkerDiagnostic = { engine: 'muxjs', stage: 'worker-timeout', inputBytes, timeoutMs };
                reject(error);
            }, timeoutMs);

            const cleanup = () => {
                clearTimeout(timeout);
                worker.removeEventListener('message', handler);
                worker.removeEventListener('error', errorHandler);
                worker.removeEventListener('messageerror', errorHandler);
                signal?.removeEventListener('abort', abortHandler);
            };
            const abortHandler = () => {
                cleanup();
                if (this._worker === worker) {
                    try { worker.terminate(); } catch {}
                    this._worker = null;
                }
                reject(new DOMException('The download was cancelled.', 'AbortError'));
            };
            const handler = (e) => {
                if (e.data.id !== id) return;
                // Debug message (not final result)
                if (e.data.debug) {
                    console.log('[RumbleX] Transmux debug:\n' + e.data.debug);
                    return;
                }
                cleanup();
                if (e.data.error) {
                    const error = new Error(e.data.error);
                    error.rxWorkerDiagnostic = e.data.diagnostic || null;
                    reject(error);
                } else resolve(e.data.blob);
            };
            const errorHandler = (e) => {
                cleanup();
                if (this._worker === worker) {
                    try { worker.terminate(); } catch {}
                    this._worker = null;
                }
                const error = new Error(e?.message || 'mux.js worker failed');
                error.rxWorkerDiagnostic = { engine: 'muxjs', stage: 'worker-runtime' };
                reject(error);
            };

            worker.addEventListener('message', handler);
            worker.addEventListener('error', errorHandler);
            worker.addEventListener('messageerror', errorHandler);
            if (signal?.aborted) return abortHandler();
            signal?.addEventListener('abort', abortHandler, { once: true });
            // Transfer ArrayBuffers to worker (zero-copy)
            const transferable = tsBuffers.map(b => b instanceof ArrayBuffer ? b : b.buffer);
            worker.postMessage({ id, action: 'transmux', buffers: tsBuffers }, transferable);
        });
    },

    async _transmuxWithWorker(tsBuffers, signal) {
        const requested = Settings.get('downloadMuxerEngine') || 'muxjs';
        this._lastMuxerContext = {
            requested,
            used: requested === 'mediabunnyWebCodecs' ? 'mediabunnyWebCodecs' : 'muxjs',
            fallback: false,
            fallbackReason: null,
            workerDiagnostic: null,
        };
        if (requested === 'mediabunnyWebCodecs') {
            try {
                return await this._transmuxWithMediabunny(tsBuffers, signal);
            } catch (err) {
                if (err?.name === 'AbortError') throw err;
                console.warn('[RumbleX] Mediabunny muxer failed; falling back to mux.js:', err);
                this._lastMuxerContext = {
                    requested,
                    used: 'muxjs',
                    fallback: true,
                    fallbackReason: err?.message || 'Mediabunny conversion failed',
                    workerDiagnostic: err?.rxWorkerDiagnostic || null,
                };
            }
        }
        try {
            return await this._transmuxWithMuxWorker(tsBuffers, signal);
        } catch (err) {
            this._lastMuxerContext.workerDiagnostic = err?.rxWorkerDiagnostic || null;
            err.rxMuxerContext = { ...this._lastMuxerContext };
            throw err;
        }
    },

    _triggerSave(data, filename, mimeType) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    },

    _formatSize(bytes) {
        if (bytes > 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
        if (bytes > 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
        return (bytes / 1024).toFixed(0) + ' KB';
    },

    _showDownloadTab() {
        // Preferred path: the TheaterSplit side panel owns a #rx-tab-download.
        // If TheaterSplit is enabled and initialized, route there.
        if (Settings.get('theaterSplit') && qs('#rx-tab-download')) {
            TheaterSplit._switchTab('download');
            const panel = qs('#rx-tab-download');
            if (panel && !panel.dataset.loaded) {
                panel.dataset.loaded = '1';
                this._loadQualities();
            }
            return;
        }
        // Fallback: TheaterSplit is disabled. Mount a standalone overlay so
        // the download feature is still useful on its own.
        this._showDownloadOverlay();
    },

    _showDownloadOverlay() {
        // Idempotent — reopening just re-focuses the existing overlay.
        const existing = qs('#rx-download-overlay');
        if (existing) {
            existing.classList.add('open');
            return;
        }
        injectStyle(`
            #rx-download-overlay {
                position: fixed; inset: 0; z-index: 80010;
                background: rgba(3,5,9,0.78);
                display: none; align-items: center; justify-content: center;
            }
            #rx-download-overlay.open { display: flex; }
            #rx-download-overlay .rx-dl-card {
                width: min(560px, calc(100vw - 32px));
                max-height: calc(100vh - 64px); overflow-y: auto;
                background: #0e1017; color: #cdd6f4;
                border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
                box-shadow: 0 24px 64px rgba(0,0,0,0.55);
                font-family: system-ui, sans-serif;
            }
            #rx-download-overlay .rx-dl-card-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            #rx-download-overlay .rx-dl-card-header h2 {
                margin: 0; font-size: 15px; font-weight: 700; letter-spacing: 0;
            }
            #rx-download-overlay .rx-dl-card-close {
                background: transparent; border: 0; color: #a6adc8; cursor: pointer;
                padding: 6px; border-radius: 6px; display: flex;
            }
            #rx-download-overlay .rx-dl-card-close:hover {
                background: rgba(255,255,255,0.06); color: #fff;
            }
            #rx-download-overlay .rx-dl-body { padding: 14px 16px; }
        `, 'rx-download-overlay-css');

        const overlay = document.createElement('div');
        overlay.id = 'rx-download-overlay';
        overlay.className = 'open';
        const card = document.createElement('div');
        card.className = 'rx-dl-card';

        const header = document.createElement('div');
        header.className = 'rx-dl-card-header';
        const title = document.createElement('h2');
        title.textContent = 'Download Video';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'rx-dl-card-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>';
        closeBtn.addEventListener('click', () => this._closeDownloadOverlay());

        // We need an element with id `rx-tab-download` containing `.rx-dl-body`
        // because the rest of VideoDownloader's code queries those selectors.
        // Re-using the existing selector contract avoids a broader refactor.
        const tab = document.createElement('div');
        tab.id = 'rx-tab-download';
        const body = document.createElement('div');
        body.className = 'rx-dl-body';
        tab.appendChild(body);

        header.append(title, closeBtn);
        card.append(header, tab);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._closeDownloadOverlay();
        });
        this._overlayKeyHandler = (e) => {
            if (e.key === 'Escape') this._closeDownloadOverlay();
        };
        document.addEventListener('keydown', this._overlayKeyHandler);

        this._loadQualities();
    },

    _closeDownloadOverlay() {
        // Aborts in-flight deep scan so probes don't keep firing in the
        // background after the user closes the dialog.
        this._scanController?.abort();
        this._scanController = null;
        this._downloadController?.abort();
        this._downloadController = null;
        this._scanSeq++;
        if (this._overlayKeyHandler) {
            document.removeEventListener('keydown', this._overlayKeyHandler);
            this._overlayKeyHandler = null;
        }
        qs('#rx-download-overlay')?.remove();
    },

    _getBody() {
        return qs('#rx-tab-download .rx-dl-body');
    },

    _setBody(html) {
        const body = this._getBody();
        if (body) body.innerHTML = html;
        return body;
    },

    // Safe-by-default alternative used for any content that includes data
    // we didn't author (error messages, HLS hostnames, API responses). This
    // avoids accidentally rendering a crafted string as HTML.
    _setBodyText(className, text) {
        const body = this._getBody();
        if (!body) return null;
        body.textContent = ''; // clear without innerHTML
        const el = document.createElement('div');
        if (className) el.className = className;
        el.textContent = text == null ? '' : String(text);
        body.appendChild(el);
        return body;
    },

    // ───────────────────────────────────────────────────────────
    //  RUD helpers — direct port from "Rumble Enhancement Suite"
    //  v11 with extension-native fetch instead of GM_xmlhttpRequest.
    //  Used by _loadQualities() for progressive CDN probing once the
    //  fast embedJS path has rendered.
    // ───────────────────────────────────────────────────────────
    _tokenToLabel(t) {
        const low = String(t || '').toLowerCase();
        if (!low || low === 'faa') return null;
        return this._TOKEN_LABELS[low] || low;
    },
    _tokenRank(t) {
        switch (String(t || '').toLowerCase()) {
            case 'haa': return 50;
            case 'gaa': return 40;
            case 'caa': return 30;
            case 'baa': return 20;
            case 'oaa': return 10;
            default: return 0;
        }
    },
    _typeFromUrl(u) { return /\.tar(\?|$)/i.test(u) ? 'tar' : 'mp4'; },
    _extractTokenFromUrl(u) {
        const m = u.match(/\.([A-Za-z]{3})(?:\.rec)?\.(?:mp4|tar)\b/i);
        return m ? m[1] : null;
    },
    _parseSize(headers) {
        const cr = headers.get('content-range');
        if (cr) {
            const m = cr.match(/bytes\s+\d+-\d+\/(\d+)/i);
            if (m) return Number(m[1]);
        }
        const cl = headers.get('content-length');
        if (cl) return Number(cl);
        return undefined;
    },

    async _probeUrl(url) {
        const signal = this._scanController?.signal;
        if (signal?.aborted) return { ok: false };
        const timed = () => {
            // Compose per-probe timeout with the scan-wide abort signal.
            if (typeof AbortSignal?.any === 'function' && signal) {
                return AbortSignal.any([signal, AbortSignal.timeout(this._PROBE_TIMEOUT_MS)]);
            }
            return AbortSignal.timeout(this._PROBE_TIMEOUT_MS);
        };
        // HEAD first — cheapest and most accurate.
        try {
            const r = await RXPlatform.fetch(url, { method: 'HEAD', signal: timed() });
            if (r.ok || r.status === 206) return { ok: true, size: this._parseSize(r.headers) };
        } catch {}
        if (signal?.aborted) return { ok: false };
        // HEAD may be blocked or unsupported — fall back to a 1-byte Range GET.
        try {
            const r = await RXPlatform.fetch(url, {
                method: 'GET',
                headers: { Range: 'bytes=0-0' },
                signal: timed(),
            });
            // Release the body immediately; we only wanted the headers.
            r.body?.cancel?.();
            if (r.ok || r.status === 206) return { ok: true, size: this._parseSize(r.headers) };
        } catch {}
        return { ok: false };
    },

    // Try every known embedJS endpoint. Each returns slightly different
    // metadata; together they cover variants a single URL misses.
    //
    // `primedJson` — the embedJS response the caller already fetched
    // (via _fetchEmbedData). Passing it through lets us skip the duplicate
    // HTTP round-trip for the u3 endpoint _loadQualities already hit.
    async _fetchAllEmbeds(embedId, primedJson) {
        const primedUrl = `https://rumble.com/embedJS/u3/?request=video&ver=2&v=${encodeURIComponent(embedId)}`;
        const urls = new Set();
        for (const unit of this._EMBED_UNITS) {
            if (unit === 'u3') continue; // we already have the base u3 response from _loadQualities
            urls.add(`https://rumble.com/embedJS/${unit}/?request=video&v=${encodeURIComponent(embedId)}`);
        }
        urls.add(`https://rumble.com/embedJS/u3/?ifr=0&dref=rumble.com&request=video&ver=2&v=${encodeURIComponent(embedId)}`);
        const signal = this._scanController?.signal;

        // Fire all requests in parallel. `allSettled` so one 404 doesn't
        // abort the rest, and aborts produce a resolved (failed) entry
        // rather than an unhandled rejection.
        const fetchOne = async (url) => {
            if (signal?.aborted) return null;
            try {
                const r = await RXPlatform.fetch(url, { signal });
                if (!r.ok) return null;
                const j = await r.json();
                return j && typeof j === 'object' ? j : null;
            } catch { return null; }
        };
        const results = (await Promise.allSettled([...urls].map(fetchOne)))
            .map((s) => (s.status === 'fulfilled' ? s.value : null))
            .filter(Boolean);
        if (primedJson && typeof primedJson === 'object') results.unshift(primedJson);
        return results;
    },

    _collectMediaUrlsFromEmbed(json) {
        const out = new Set();
        const add = (u) => { if (u && /\/video\/.+\.(?:mp4|tar)\b/i.test(u)) out.add(u); };
        try {
            if (json.u) { add(json.u.tar?.url); add(json.u.timeline?.url); }
            if (json.ua) {
                for (const group of Object.values(json.ua)) {
                    if (group && typeof group === 'object') {
                        for (const v of Object.values(group)) add(v?.url);
                    } else if (typeof group === 'string') add(group);
                }
            }
        } catch {}
        return [...out];
    },

    _collectMediaUrlsFromDom() {
        const out = new Set();
        const addAbs = (u) => {
            if (!u) return;
            try { out.add(new URL(u, location.href).href); } catch {}
        };
        const isMedia = (u) => /\/video\/.+\.(?:mp4|tar)(?:\?|$)/i.test(u);
        for (const el of qsa('[src], [href]')) {
            const v = el.getAttribute('src') || el.getAttribute('href') || '';
            if (isMedia(v)) addAbs(v);
        }
        for (const el of qsa('video, source')) {
            const v = el.src || '';
            if (isMedia(v)) addAbs(v);
        }
        const scriptRe = /https?:\/\/[^\s"'<>]+\/video\/[^\s"'<>]+\.(?:mp4|tar)\b[^\s"'<>]*/gi;
        for (const s of qsa('script')) {
            const text = (s.textContent || '').slice(0, 300000);
            let m;
            while ((m = scriptRe.exec(text))) addAbs(m[0]);
        }
        return [...out];
    },

    // Derive {pathPart, baseId, token, isLive} from any direct media URL.
    // Once we have these, we can synthesize URLs for every quality token.
    _deriveParts(urls) {
        const parsePathFile = (u) => {
            try {
                const uo = new URL(u, location.href);
                const m = uo.pathname.match(/\/video\/(.+?)\/([^\/]+)$/i);
                return m ? { pathPart: m[1], file: m[2] } : null;
            } catch { return null; }
        };
        const tar = urls.find((u) => /\.tar(\?|$)/i.test(u));
        if (tar) {
            const pp = parsePathFile(tar);
            if (pp) {
                const fm = pp.file.match(/^([A-Za-z0-9_-]+)\.([A-Za-z]{3})(?:\.rec)?\.tar$/i);
                if (fm) return { pathPart: pp.pathPart, baseId: fm[1], token: fm[2], isLive: /\.rec\.tar$/i.test(pp.file) };
            }
        }
        const mp4 = urls.find((u) => /\.mp4(\?|$)/i.test(u));
        if (mp4) {
            const pp = parsePathFile(mp4);
            if (pp) {
                const fm = pp.file.match(/^([A-Za-z0-9_-]+)\.([A-Za-z]{3})(?:\.rec)?\.mp4$/);
                if (fm) return { pathPart: pp.pathPart, baseId: fm[1], token: fm[2], isLive: /\.rec\.mp4$/i.test(pp.file) };
            }
        }
        return null;
    },

    _buildCdnUrl(pathPart, baseId, token, kind, live) {
        if (kind === 'tar') {
            const rec = live ? '.rec' : '';
            return `${this._CDN_HOST}/video/${pathPart}/${baseId}.${token}${rec}.tar`;
        }
        return `${this._CDN_HOST}/video/${pathPart}/${baseId}.${token}.mp4`;
    },

    // Generate candidate URLs for every token × (mp4,tar) × (live,vod) combo,
    // both case variants. Sorted so the highest-quality probes fire first.
    _generateCandidates(parts) {
        const { pathPart, baseId, isLive } = parts;
        const triesLive = isLive == null ? [true, false] : [!!isLive];
        const out = [];
        for (const live of triesLive) {
            for (const t of this._TOKENS) {
                const cap = t[0].toUpperCase() + t.slice(1);
                out.push({ url: this._buildCdnUrl(pathPart, baseId, t, 'tar', live), type: 'tar', token: t, pri: live ? 1 : 3 });
                out.push({ url: this._buildCdnUrl(pathPart, baseId, cap, 'tar', live), type: 'tar', token: t, pri: live ? 1 : 3 });
                if (!live) {
                    out.push({ url: this._buildCdnUrl(pathPart, baseId, t, 'mp4', false), type: 'mp4', token: t, pri: 2 });
                    out.push({ url: this._buildCdnUrl(pathPart, baseId, cap, 'mp4', false), type: 'mp4', token: t, pri: 2 });
                }
            }
        }
        out.sort((a, b) => a.pri - b.pri || this._tokenRank(b.token) - this._tokenRank(a.token));
        return out;
    },

    // Run the full deep scan with the given abort-signal seq. Invokes
    // `onResult({ label, type, url, size, token })` each time a probe succeeds.
    //
    // `primedJson` — the embedJS response the caller already obtained. We pass
    // it through `_fetchAllEmbeds` so the deep scan doesn't duplicate that
    // HTTP request (Rumble's u3 endpoint is rate-sensitive).
    async _deepScan(embedId, seq, onResult, primedJson) {
        const isAlive = () => seq === this._scanSeq && !this._scanController?.signal?.aborted;

        // Step 1: harvest URLs from every embedJS endpoint and the live DOM.
        const jsons = await this._fetchAllEmbeds(embedId, primedJson);
        if (!isAlive()) return { done: 0, total: 0 };
        const embedUrls = jsons.flatMap((j) => this._collectMediaUrlsFromEmbed(j));
        const domUrls = this._collectMediaUrlsFromDom();
        const directUrls = [...new Set([...embedUrls, ...domUrls])]
            .filter((u) => /\/video\/.+\.(?:mp4|tar)\b/i.test(u));

        // Step 2: derive base pattern and generate every candidate.
        const parts = this._deriveParts(directUrls);
        const generated = parts ? this._generateCandidates(parts) : [];

        // Step 3: combine. Direct URLs get priority 0/4 depending on host score.
        const directTargets = directUrls.map((u) => ({
            url: u,
            type: this._typeFromUrl(u),
            token: String(this._extractTokenFromUrl(u) || '').toLowerCase(),
            pri: u.includes('hugh.cdn.rumble.cloud') ? 0 : 4,
        })).filter((t) => t.token !== 'faa');
        const combined = [...directTargets, ...generated];
        const seenUrls = new Set();
        const targets = [];
        for (const t of combined) {
            if (!t.url || seenUrls.has(t.url)) continue;
            seenUrls.add(t.url);
            targets.push(t);
        }
        if (!targets.length) return { done: 0, total: 0 };

        // Step 4: concurrent probe. Skip quality/type pairs we've already verified.
        const satisfied = new Set();
        const queue = [...targets];
        let done = 0;
        const total = targets.length;
        const worker = async () => {
            while (queue.length && isAlive()) {
                const t = queue.shift();
                const key = `${t.token}|${t.type}`;
                if (satisfied.has(key)) { done++; onResult?.(null, done, total); continue; }
                const result = await this._probeUrl(t.url);
                done++;
                if (result.ok && isAlive()) {
                    const label = this._tokenToLabel(t.token) || 'detected';
                    satisfied.add(key);
                    onResult?.({ label, type: t.type, url: t.url, size: result.size, token: t.token }, done, total);
                } else {
                    onResult?.(null, done, total);
                }
            }
        };
        await Promise.all(
            Array.from({ length: Math.min(this._PROBE_CONCURRENCY, total) }, () => worker())
        );
        return { done, total };
    },

    _copyToClipboard(text) {
        try {
            navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Legacy fallback for older contexts.
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                ta.remove();
                return true;
            } catch { return false; }
        }
    },

    // Build a single result row. Works for both the initial embedJS rows and
    // progressive deep-scan additions — the shape is the same. Uses DOM APIs
    // rather than innerHTML so label/dims are rendered as text regardless of
    // what the upstream API hands us.
    _makeRow(q, title) {
        const row = document.createElement('div');
        row.className = 'rx-dl-quality';
        row.dataset.key = `${String(q.label || '').toLowerCase()}|${q.type || 'mp4'}`;
        row.dataset.token = String(q.token || '').toLowerCase();

        const inner = document.createElement('button');
        inner.type = 'button';
        inner.className = 'rx-dl-quality-row-inner';
        inner.setAttribute('aria-label', `${q.directUrl ? 'Download' : 'Choose format for'} ${q.label || 'detected quality'}`);

        const main = document.createElement('div');
        main.className = 'rx-dl-quality-main';

        const label = document.createElement('div');
        label.className = 'rx-dl-quality-label';
        label.textContent = q.label || 'detected';
        if (Number.isFinite(q.height) && q.height >= 720) {
            label.appendChild(document.createTextNode(' (HD)'));
        }
        const badge = document.createElement('span');
        badge.className = 'rx-dl-type-badge' + (q.type === 'tar' ? ' type-tar' : '');
        badge.textContent = q.type === 'tar' ? 'TAR' : (q.directUrl ? 'MP4' : 'HLS');
        label.appendChild(badge);
        main.appendChild(label);

        const metaParts = [];
        if (q.width && q.height) metaParts.push(`${q.width}×${q.height}`);
        else if (q.label) metaParts.push(q.label);
        if (q.bitrate) metaParts.push(`${q.bitrate} kbps`);
        if (q.size) metaParts.push(`~${this._formatSize(q.size)}`);
        const meta = document.createElement('div');
        meta.className = 'rx-dl-quality-meta';
        meta.textContent = metaParts.join(' · ');
        main.appendChild(meta);

        inner.appendChild(main);
        row.appendChild(inner);

        // Copy-link button (works for anything with a directUrl)
        if (q.directUrl) {
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'rx-dl-copy-btn';
            copyBtn.title = 'Copy link';
            copyBtn.setAttribute('aria-label', `Copy ${q.label || 'quality'} download link`);
            copyBtn.innerHTML = this._copySVG;
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this._copyToClipboard(q.directUrl)) {
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = this._checkSVG;
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = this._copySVG;
                    }, 1500);
                }
            });
            row.appendChild(copyBtn);
        }

        inner.addEventListener('click', () => this._showFormatPicker(q, title));
        return row;
    },

    async _loadQualities() {
        const embedId = this._getEmbedId();
        const operationId = this._newOperationId('quality-discovery');
        if (!embedId) {
            const body = this._setBodyText('rx-dl-error', 'Could not find video embed ID');
            const error = new Error('Could not find video embed ID');
            error.code = 'missing-embed-id';
            void this._reportFailure({ operation: 'quality-discovery', operationId, stage: 'page-detection', error }, body);
            return;
        }

        // Cancel any previous scan before starting a new one.
        this._scanController?.abort();
        this._scanController = new AbortController();
        const seq = ++this._scanSeq;

        try {
            const data = await this._fetchEmbedData(embedId);
            if (seq !== this._scanSeq) return; // user already kicked off another scan
            this._embedData = data;
            this._hlsUrl = this._extractHlsUrl(data);
            const qualities = this._parseQualities(data);

            const body = this._setBody('');
            const title = this._getTitle();

            // Track rows by "{label}|{type}" so deep-scan can upgrade them in place
            // rather than duplicating when it re-discovers the same quality.
            const rowByKey = new Map();
            const upsert = (q) => {
                const key = `${(q.label || '').toLowerCase()}|${q.type || 'mp4'}`;
                const existing = rowByKey.get(key);
                if (existing) {
                    // Already have this quality. Prefer the entry with a real
                    // size — the probe result is more accurate than the API's
                    // claimed number.
                    const prev = existing.q;
                    const better = (q.size || 0) > (prev.size || 0) || (!prev.directUrl && q.directUrl);
                    if (better) {
                        const replacement = this._makeRow(q, title);
                        existing.row.replaceWith(replacement);
                        rowByKey.set(key, { row: replacement, q });
                    }
                    return;
                }
                const row = this._makeRow(q, title);
                // Insert in quality-descending order so new rows slot in correctly.
                const rank = this._tokenRank(q.token || '');
                let placed = false;
                for (const child of body.children) {
                    if (!child.classList || !child.classList.contains('rx-dl-quality')) continue;
                    const childRank = this._tokenRank(child.dataset.token || '');
                    if (rank > childRank) { body.insertBefore(row, child); placed = true; break; }
                }
                if (!placed) body.appendChild(row);
                rowByKey.set(key, { row, q });
            };

            // ── Initial rows from the embed API ──
            for (const q of qualities) {
                // Normalize token (the API-provided entries don't always carry one).
                if (q.directUrl && !q.token) q.token = String(this._extractTokenFromUrl(q.directUrl) || '').toLowerCase();
                if (!q.type) q.type = q.directUrl ? this._typeFromUrl(q.directUrl) : 'mp4';
                upsert(q);
            }

            // Empty-state placeholder: dismissed automatically as soon as the
            // first row (from embed API OR deep scan) lands, so users never
            // see "scanning the CDN…" next to actual results.
            let emptyEl = null;
            if (rowByKey.size === 0) {
                emptyEl = document.createElement('div');
                emptyEl.className = 'rx-dl-status';
                emptyEl.textContent = 'No qualities from the embed API yet — scanning the CDN…';
                body.appendChild(emptyEl);
            }
            const dismissEmpty = () => {
                if (emptyEl) { emptyEl.remove(); emptyEl = null; }
            };

            // ── Deep-scan progress bar ──
            // Built via DOM APIs rather than innerHTML so nothing user- or
            // network-influenced ever reaches the HTML parser here.
            const scanBar = document.createElement('div');
            scanBar.className = 'rx-dl-scan-bar';
            const scanLabel = document.createElement('span');
            scanLabel.className = 'rx-dl-scan-label';
            scanLabel.textContent = 'Deep scan for more qualities';
            const scanCounter = document.createElement('span');
            scanCounter.className = 'rx-dl-scan-counter';
            scanCounter.textContent = '0 / 0';
            const scanMini = document.createElement('div');
            scanMini.className = 'rx-dl-scan-mini';
            const scanFill = document.createElement('div');
            scanMini.appendChild(scanFill);
            scanBar.append(scanLabel, scanCounter, scanMini);
            body.prepend(scanBar);

            // ── Run deep scan (fire-and-forget; updates live) ──
            this._deepScan(embedId, seq, (hit, done, total) => {
                if (seq !== this._scanSeq) return;
                scanCounter.textContent = `${done} / ${total}`;
                scanFill.style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
                if (hit) {
                    dismissEmpty();
                    // Fake a `directUrl` + `height` from the token label for display.
                    const heightFromLabel = parseInt(String(hit.label).match(/(\d+)/)?.[1] || '0', 10) || undefined;
                    upsert({
                        label: hit.label,
                        type: hit.type,
                        directUrl: hit.url,
                        size: hit.size,
                        height: heightFromLabel,
                        token: hit.token,
                    });
                }
            }, data).then(({ done, total }) => {
                if (seq !== this._scanSeq) return;
                scanBar.classList.add('done');
                scanLabel.textContent = total
                    ? `Deep scan complete · probed ${total} candidate${total === 1 ? '' : 's'}`
                    : 'Deep scan found nothing extra to probe';
                setTimeout(() => { if (seq === this._scanSeq) scanBar.remove(); }, 2800);

                // If nothing showed up anywhere, replace the "scanning…" text
                // with an honest dead-end message so the panel isn't empty.
                if (rowByKey.size === 0 && emptyEl) {
                    emptyEl.textContent = 'No downloads found. Try playing the video first, then reopen this panel.';
                }

                // Any TAR rows present? Append a "how to play" note at the bottom.
                const hasTar = body.querySelector('.rx-dl-quality[data-key*="|tar"]');
                if (hasTar && !body.querySelector('.rx-dl-tar-note')) {
                    const note = document.createElement('div');
                    note.className = 'rx-dl-tar-note';
                    // Build with textContent + span hierarchy rather than innerHTML.
                    const strong1 = document.createElement('strong');
                    strong1.textContent = 'TAR archives';
                    const strong2 = document.createElement('strong');
                    strong2.textContent = '.m3u8';
                    note.append(
                        strong1,
                        document.createTextNode(' are live-replay bundles. Extract with 7-Zip, then drag the '),
                        strong2,
                        document.createTextNode(' file into VLC.'),
                    );
                    body.appendChild(note);
                }
            }).catch((e) => {
                if (seq !== this._scanSeq) return;
                scanLabel.textContent = 'Deep scan failed — using embed-API results only';
                console.warn('[RumbleX] deep scan failed:', e);
            });
        } catch (e) {
            const body = this._setBodyText('rx-dl-error', 'Failed to load video data: ' + (e?.message || e));
            try { RxErrorLog?.record('VideoDownloader', e, '_loadQualities'); } catch {}
            void this._reportFailure({
                operation: 'quality-discovery',
                operationId,
                stage: 'embed-api',
                error: e,
                urls: [{ role: 'embed-api', url: e?.rxUrl || `https://rumble.com/embedJS/u3/?request=video&ver=2&v=${embedId}` }],
            }, body);
        }
    },

    _showFormatPicker(quality, title) {
        // Direct CDN URL (MP4 or TAR) — straight to browser download.
        if (quality.directUrl) {
            this._startDirectDownload(quality, title);
            return;
        }

        if (!this._hlsUrl) {
            this._setBodyText('rx-dl-error', 'Rumble did not provide a valid HLS playlist for this quality.');
            return;
        }

        const exceedsMemoryLimit = Number(quality.size) > this._MAX_IN_MEMORY_BYTES;
        const canStreamToDisk = this._supportsStreamingFileSave();
        if (exceedsMemoryLimit && !canStreamToDisk) {
            this._setBodyText(
                'rx-dl-error',
                `This stream is about ${this._formatSize(quality.size)}. In-browser HLS conversion is limited to ${this._formatSize(this._MAX_IN_MEMORY_BYTES)} to protect this tab, and this browser cannot stream directly to a selected file. Choose a direct MP4 or TAR row instead.`
            );
            return;
        }

        const dimsLabel = quality.width && quality.height
            ? `${quality.label} (${quality.width}x${quality.height})`
            : (quality.label || 'Selected');
        const body = this._getBody();
        if (!body) return;
        body.textContent = '';
        const status = document.createElement('div');
        status.className = 'rx-dl-status';
        status.textContent = exceedsMemoryLimit
            ? `Selected: ${dimsLabel} · large stream, disk mode required`
            : 'Selected: ' + dimsLabel;
        body.appendChild(status);
        const row = document.createElement('div');
        row.className = 'rx-dl-format-row';
        body.appendChild(row);

        const makeBtn = (main, note, onClick) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rx-dl-format-btn';
            btn.appendChild(document.createTextNode(main));
            if (note) {
                const small = document.createElement('small');
                small.textContent = note;
                btn.appendChild(small);
            }
            btn.addEventListener('click', onClick);
            return btn;
        };
        if (!exceedsMemoryLimit) {
            row.appendChild(makeBtn('MP4', 'Converted in browser', () => this._startDownload(quality, title, 'mp4')));
        }
        if (canStreamToDisk) {
            row.appendChild(makeBtn('TS to disk', 'Streams without buffering the full video', () => this._startStreamingTs(quality, title)));
        } else if (!exceedsMemoryLimit) {
            row.appendChild(makeBtn('TS', 'Raw stream (in memory)', () => this._startDownload(quality, title, 'ts')));
        }
        if (exceedsMemoryLimit) {
            const note = document.createElement('div');
            note.className = 'rx-dl-tar-note';
            note.textContent = `MP4 conversion stays disabled above ${this._formatSize(this._MAX_IN_MEMORY_BYTES)}. TS-to-disk writes each network chunk directly to your selected file and discards partial output if cancelled.`;
            body.appendChild(note);
        }
    },

    _newOperationId(prefix) {
        try { return `${prefix}-${crypto.randomUUID()}`; } catch {}
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    },

    _qualityDiagnostic(quality, format) {
        return {
            label: quality?.label || null,
            height: Number.isFinite(quality?.height) ? quality.height : null,
            width: Number.isFinite(quality?.width) ? quality.width : null,
            type: quality?.type || (quality?.directUrl ? 'direct' : 'hls'),
            format: format || null,
        };
    },

    _httpError(response, stage, url) {
        const error = new Error(`${stage} returned HTTP ${response?.status || 'unknown'}`);
        error.rxStage = stage;
        error.rxUrl = url;
        error.rxStatus = response?.status || null;
        return error;
    },

    _diagnosticDetails({ operation, operationId, stage, error, quality, format, urls, extra }) {
        return {
            source: 'content',
            operation,
            operationId,
            stage: error?.rxStage || stage || 'unknown',
            error: {
                name: error?.name || 'Error',
                message: error?.message || String(error || 'Unknown download failure'),
                code: error?.code || (error?.rxStatus ? `http-${error.rxStatus}` : null),
                worker: error?.rxWorkerDiagnostic || null,
            },
            quality: this._qualityDiagnostic(quality, format),
            muxer: error?.rxMuxerContext || this._lastMuxerContext || {
                requested: Settings.get('downloadMuxerEngine') || 'muxjs',
                used: null,
                fallback: false,
            },
            urls: (urls || []).filter((entry) => entry?.url).slice(0, 12),
            extra: extra || null,
        };
    },

    _reportFailure(details, host) {
        const payload = this._diagnosticDetails(details);
        return RxDownloadDiagnostics.record(payload)
            .catch(() => ({ ok: false }))
            .finally(() => RxDownloadDiagnostics.mountActions(host || this._getBody()));
    },

    async _startDirectDownload(quality, title) {
        // Honour a per-quality extension — RUD results may be .tar archives.
        const ext = quality.type === 'tar' ? 'tar' : (quality.ext || 'mp4');
        const filename = `${title} - ${quality.label}.${ext}`;
        const operationId = this._newOperationId('direct-download');

        // Build progress block with DOM APIs so no response text or error
        // message can ever reach the HTML parser.
        const body = this._getBody();
        if (!body) return;
        body.textContent = '';
        const wrap = document.createElement('div');
        wrap.className = 'rx-dl-progress-wrap';
        const status = document.createElement('div');
        status.className = 'rx-dl-status';
        status.textContent = 'Starting download via browser…';
        wrap.appendChild(status);
        body.appendChild(wrap);

        try {
            const resp = await RXPlatform.sendMessage({
                action: 'download',
                data: { url: quality.directUrl, filename },
                diagnostic: this._diagnosticDetails({
                    operation: 'direct-download',
                    operationId,
                    stage: 'browser-download',
                    quality,
                    format: ext,
                    urls: [{ role: 'download', url: quality.directUrl }],
                }),
            });
            if (resp?.error) {
                const errorBody = this._setBodyText('rx-dl-error', 'Download rejected: ' + resp.error);
                // The extension background records allowlist/downloads API failures
                // before replying. Only create a content-side fallback when
                // that persistence step itself did not return an id.
                if (!resp.diagnosticId) {
                    const error = new Error(resp.error);
                    error.code = 'download-rejected';
                    void this._reportFailure({
                        operation: 'direct-download', operationId, stage: 'browser-download', error,
                        quality, format: ext, urls: [{ role: 'download', url: quality.directUrl }],
                    }, errorBody);
                } else {
                    RxDownloadDiagnostics.mountActions(errorBody);
                }
            } else if (resp?.downloadId) {
                this._setBodyText('rx-dl-done', 'Download started! Check your browser downloads.');
            } else {
                const error = new Error('Download failed to start');
                error.code = 'missing-download-id';
                const errorBody = this._setBodyText('rx-dl-error', error.message);
                void this._reportFailure({
                    operation: 'direct-download', operationId, stage: 'browser-download', error,
                    quality, format: ext, urls: [{ role: 'download', url: quality.directUrl }],
                }, errorBody);
            }
        } catch (e) {
            const errorBody = this._setBodyText('rx-dl-error', 'Error: ' + (e?.message || e));
            console.error('[RumbleX] Direct download failed:', e);
            void this._reportFailure({
                operation: 'direct-download', operationId, stage: 'background-message', error: e,
                quality, format: ext, urls: [{ role: 'download', url: quality.directUrl }],
            }, errorBody);
        }
    },

    async _startStreamingTs(quality, title) {
        const operationId = this._newOperationId('hls-stream-to-disk');
        const diagnosticUrls = [];
        let stage = 'file-picker';
        if (!this._supportsStreamingFileSave()) {
            this._setBodyText('rx-dl-error', 'Direct-to-disk streaming is unavailable in this browser.');
            return;
        }

        const filename = RxFsAccess.sanitizeFilename(
            `${title} - ${quality?.label || 'stream'}.ts`,
            'rumble-video.ts',
        );
        let fileHandle;
        try {
            // This must remain the first awaited operation in the click handler
            // so Chromium still recognizes the required transient user action.
            fileHandle = await globalThis.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'MPEG transport stream',
                    accept: { 'video/mp2t': ['.ts'] },
                }],
            });
        } catch (error) {
            if (error?.name === 'AbortError') return;
            const errorBody = this._setBodyText('rx-dl-error', 'Could not select a destination: ' + (error?.message || error));
            void this._reportFailure({
                operation: 'hls-stream-to-disk', operationId, stage, error,
                quality, format: 'ts-stream', urls: diagnosticUrls,
            }, errorBody);
            return;
        }

        this._downloadController?.abort();
        const controller = new AbortController();
        this._downloadController = controller;
        const { signal } = controller;
        const body = this._setBody('');
        if (!body) {
            controller.abort();
            if (this._downloadController === controller) this._downloadController = null;
            return;
        }
        const wrap = document.createElement('div');
        wrap.className = 'rx-dl-progress-wrap';
        const statusEl = document.createElement('div');
        statusEl.className = 'rx-dl-status';
        statusEl.setAttribute('role', 'status');
        statusEl.textContent = 'Opening selected file…';
        const barBg = document.createElement('div');
        barBg.className = 'rx-dl-bar-bg';
        const barEl = document.createElement('div');
        barEl.className = 'rx-dl-bar-fill';
        barEl.setAttribute('role', 'progressbar');
        barEl.setAttribute('aria-label', 'Stream-to-disk progress');
        barEl.setAttribute('aria-valuemin', '0');
        barEl.setAttribute('aria-valuemax', '100');
        barEl.setAttribute('aria-valuenow', '0');
        barBg.appendChild(barEl);
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'rx-dl-cancel';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => controller.abort());
        wrap.append(statusEl, barBg, cancel);
        body.appendChild(wrap);
        const setProgress = (pct, message) => {
            const bounded = Math.max(0, Math.min(100, Number(pct) || 0));
            barEl.style.width = bounded + '%';
            barEl.setAttribute('aria-valuenow', String(Math.round(bounded)));
            if (message) statusEl.textContent = message;
        };

        let writable = null;
        let streamed = null;
        try {
            stage = 'file-open';
            writable = await fileHandle.createWritable();
            streamed = await this._streamHlsToWritable(quality, writable, {
                signal,
                diagnosticUrls,
                onStage: (nextStage, pct, message) => {
                    stage = nextStage;
                    setProgress(pct, message);
                },
                onProgress: ({ completed, total, bytes }) => {
                    stage = 'segment-download';
                    const pct = 5 + (completed / total) * 94;
                    setProgress(pct, `Writing ${completed}/${total} segments · ${this._formatSize(bytes)}`);
                },
            });
            if (signal.aborted) throw new DOMException('The download was cancelled.', 'AbortError');
            stage = 'file-close';
            setProgress(99, 'Finalizing file…');
            await writable.close();
            writable = null;
            setProgress(100, `Saved ${this._formatSize(streamed.bytes)} to disk.`);
            cancel.remove();
            const done = document.createElement('div');
            done.className = 'rx-dl-done';
            done.textContent = 'TS stream saved directly to your selected file.';
            body.appendChild(done);
        } catch (error) {
            if (writable) {
                try { await writable.abort(); } catch {}
                writable = null;
            }
            if (error?.name === 'AbortError') {
                this._setBodyText('rx-dl-status', 'Download cancelled. Partial file changes were discarded.');
                return;
            }
            const errorEl = document.createElement('div');
            errorEl.className = 'rx-dl-error';
            errorEl.textContent = 'Error: ' + (error?.message || error);
            body.appendChild(errorEl);
            void this._reportFailure({
                operation: 'hls-stream-to-disk', operationId, stage, error,
                quality, format: 'ts-stream', urls: diagnosticUrls,
                extra: streamed ? { streamedBytes: streamed.bytes, segmentCount: streamed.segments } : null,
            }, body);
        } finally {
            if (this._downloadController === controller) this._downloadController = null;
        }
    },

    async _startDownload(quality, title, format) {
        const operationId = this._newOperationId('hls-download');
        let stage = 'master-playlist';
        const diagnosticUrls = [];
        if (!this._hlsUrl) {
            this._setBodyText('rx-dl-error', 'Rumble did not provide a valid HLS playlist.');
            return;
        }
        if (Number(quality?.size) > this._MAX_IN_MEMORY_BYTES) {
            this._setBodyText('rx-dl-error', `This stream exceeds the ${this._formatSize(this._MAX_IN_MEMORY_BYTES)} safe in-memory conversion limit.`);
            return;
        }
        this._downloadController?.abort();
        const controller = new AbortController();
        this._downloadController = controller;
        const { signal } = controller;

        const body = this._setBody('');
        const wrap = document.createElement('div');
        wrap.className = 'rx-dl-progress-wrap';
        const statusEl = document.createElement('div');
        statusEl.className = 'rx-dl-status';
        statusEl.setAttribute('role', 'status');
        statusEl.textContent = 'Fetching stream playlist…';
        const barBg = document.createElement('div');
        barBg.className = 'rx-dl-bar-bg';
        const barEl = document.createElement('div');
        barEl.className = 'rx-dl-bar-fill';
        barEl.setAttribute('role', 'progressbar');
        barEl.setAttribute('aria-label', 'Download progress');
        barEl.setAttribute('aria-valuemin', '0');
        barEl.setAttribute('aria-valuemax', '100');
        barEl.setAttribute('aria-valuenow', '0');
        barBg.appendChild(barEl);
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'rx-dl-cancel';
        cancel.textContent = 'Cancel';
        cancel.addEventListener('click', () => controller.abort());
        wrap.append(statusEl, barBg, cancel);
        body.appendChild(wrap);
        const setProgress = (pct, msg) => {
            barEl.style.width = pct + '%';
            barEl.setAttribute('aria-valuenow', String(Math.round(pct)));
            if (msg) statusEl.textContent = msg;
        };

        try {
            const { segmentUrls } = await this._resolveHlsSegments(quality, {
                signal,
                diagnosticUrls,
                onStage: (nextStage, pct, message) => {
                    stage = nextStage;
                    setProgress(pct, message);
                },
            });

            const total = segmentUrls.length;
            const CONCURRENT = 6;
            let completed = 0;
            let bufferedBytes = 0;
            const fetchBatch = async (batch) => {
                const results = await Promise.all(batch.map(async (url) => {
                    const resp = await RXPlatform.fetch(url, { signal });
                    if (!resp.ok) throw this._httpError(resp, stage, url);
                    return resp.arrayBuffer();
                }));
                bufferedBytes += results.reduce((totalBytes, buffer) => totalBytes + buffer.byteLength, 0);
                if (bufferedBytes > this._MAX_IN_MEMORY_BYTES) {
                    controller.abort();
                    const error = new Error(`Stream exceeded the ${this._formatSize(this._MAX_IN_MEMORY_BYTES)} safe in-memory conversion limit.`);
                    error.code = 'in-memory-limit';
                    throw error;
                }
                return results;
            };

            if (format === 'mp4') {
                // MP4: download all segments then transmux in Web Worker
                stage = 'segment-download';
                setProgress(5, `Downloading 0/${total} segments...`);
                const tsBuffers = [];

                for (let i = 0; i < total; i += CONCURRENT) {
                    const batch = segmentUrls.slice(i, i + CONCURRENT);
                    const results = await fetchBatch(batch);
                    tsBuffers.push(...results);
                    completed += batch.length;
                    const pct = 5 + (completed / total) * 70;
                    setProgress(pct, `Downloading ${completed}/${total} segments...`);
                }

                stage = 'mux';
                setProgress(78, 'Converting to MP4 (Web Worker)...');
                const mp4Blob = await this._transmuxWithWorker(tsBuffers, signal);
                if (signal.aborted) throw new DOMException('The download was cancelled.', 'AbortError');
                tsBuffers.length = 0;

                stage = 'save';
                setProgress(100, 'Starting download...');
                this._triggerSave(mp4Blob, `${title} - ${quality.label}.mp4`, 'video/mp4');
                this._setBody('<div class="rx-dl-done">Download complete!</div>');
            } else {
                // TS: download in chunks, build Blob
                stage = 'segment-download';
                setProgress(5, `Downloading 0/${total} segments...`);
                const tsParts = [];

                for (let i = 0; i < total; i += CONCURRENT) {
                    const batch = segmentUrls.slice(i, i + CONCURRENT);
                    const results = await fetchBatch(batch);
                    tsParts.push(...results);
                    completed += results.length;
                    const pct = 5 + (completed / total) * 90;
                    setProgress(pct, `Downloading ${completed}/${total} segments...`);
                }

                stage = 'save';
                setProgress(95, 'Preparing download...');
                const blob = new Blob(tsParts, { type: 'video/mp2t' });
                tsParts.length = 0;
                setProgress(100, 'Starting download...');
                this._triggerSave(blob, `${title} - ${quality.label}.ts`, 'video/mp2t');
                this._setBody('<div class="rx-dl-done">Download complete!</div>');
            }
        } catch (e) {
            if (e?.name === 'AbortError') {
                this._setBodyText('rx-dl-status', 'Download cancelled.');
                return;
            }
            const errorEl = document.createElement('div');
            errorEl.className = 'rx-dl-error';
            errorEl.textContent = 'Error: ' + (e?.message || e);
            body.appendChild(errorEl);
            console.error('[RumbleX] Download failed:', e);
            if (e?.rxUrl) diagnosticUrls.push({ role: e.rxStage || stage, url: e.rxUrl });
            void this._reportFailure({
                operation: 'hls-download',
                operationId,
                stage,
                error: e,
                quality,
                format,
                urls: diagnosticUrls,
            }, body);
        } finally {
            if (this._downloadController === controller) this._downloadController = null;
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-download-css');
    },

    destroy() {
        // Cancel any deep-scan probes in flight so they don't resolve into
        // a now-detached DOM and so we stop pinging the CDN after disable.
        this._scanController?.abort();
        this._scanController = null;
        this._downloadController?.abort();
        this._downloadController = null;
        this._scanSeq++;
        this._closeDownloadOverlay?.();
        this._styleEl?.remove();
        this._worker?.terminate();
        this._worker = null;
        this._mediabunnyWorker?.terminate();
        this._mediabunnyWorker = null;
        this._lastMuxerContext = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Logo to Feed
// ═══════════════════════════════════════════
const LogoToFeed = {
    id: 'logoToFeed',
    name: 'Logo to Feed',
    _obs: null,
    _links: null,
    _svgBindings: null,

    _rewriteLink(link) {
        if (!link || link.getAttribute('href') === '/subscriptions') return;
        if (!this._links.has(link)) this._links.set(link, link.getAttribute('href'));
        link.setAttribute('href', '/subscriptions');
    },

    _redirectLogos() {
        // Primary target: the flex logo link with Rumble SVGs
        for (const a of qsa('a[href="/"].flex')) {
            if (a.querySelector('use[href*="rumble-logo"]')) {
                this._rewriteLink(a);
            }
        }
        // Video player logo: svg.RumbleElm with logo viewBox (not play/pause/other controls)
        for (const svg of qsa('svg.RumbleElm[viewBox="0 0 140 35"], svg.RumbleElm[viewBox="0 0 35 35"]')) {
            if (svg.dataset.rxFeedBound) continue;
            svg.dataset.rxFeedBound = '1';
            const originalCursor = svg.style.cursor;
            const handler = (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                location.href = 'https://rumble.com/subscriptions';
            };
            svg.addEventListener('click', handler, true);
            this._svgBindings.set(svg, { handler, originalCursor });
            svg.style.cursor = 'pointer';
        }
        // Secondary: any header/nav link to "/" containing SVG/img (logo variants)
        for (const a of qsa('a[href="/"]')) {
            if (a.href.endsWith('/') && a.closest('.header, nav, .sidenav') && (a.querySelector('svg, img') || a.classList.toString().toLowerCase().includes('logo'))) {
                this._rewriteLink(a);
            }
        }
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._links = new Map();
        this._svgBindings = new Map();
        this._redirectLogos();
        this._obs = new MutationObserver(() => {
            scheduleFeatureFrame(this, 'logo-scan', () => this._redirectLogos());
        });
        this._obs.observe(document.body, { childList: true, subtree: true });
    },

    destroy() {
        this._obs?.disconnect();
        this._obs = null;
        for (const [link, originalHref] of this._links || []) {
            if (originalHref === null) link.removeAttribute('href');
            else link.setAttribute('href', originalHref);
        }
        for (const [svg, { handler, originalCursor }] of this._svgBindings || []) {
            svg.removeEventListener('click', handler, true);
            delete svg.dataset.rxFeedBound;
            svg.style.cursor = originalCursor;
        }
        this._links?.clear();
        this._svgBindings?.clear();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Speed Controller
// ═══════════════════════════════════════════
const SpeedController = {
    id: 'speedController',
    name: 'Speed Control',
    _styleEl: null,
    _obs: null,
    _overlayEl: null,
    _overlayTimer: null,
    _videoBindings: null,

    _css: `
        #rx-speed-overlay {
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            padding: 6px 16px;
            background: rgba(0,0,0,0.8);
            color: #cdd6f4;
            font-size: 14px;
            font-weight: 600;
            border-radius: 8px;
            z-index: 100000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #rx-speed-overlay.rx-visible { opacity: 1; }
    `,

    _speeds: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0],

    _isLive() {
        return !!qs('.media-description-info-stream-time') || !!qs('#chat-history-list');
    },

    _showOverlay(text) {
        if (!this._overlayEl) {
            this._overlayEl = document.createElement('div');
            this._overlayEl.id = 'rx-speed-overlay';
            document.body.appendChild(this._overlayEl);
        }
        this._overlayEl.textContent = text;
        this._overlayEl.classList.add('rx-visible');
        clearTimeout(this._overlayTimer);
        this._overlayTimer = setTimeout(() => this._overlayEl.classList.remove('rx-visible'), 1200);
    },

    _applySpeed(video) {
        if (this._isLive()) return;
        const speed = Settings.get('playbackSpeed') || 1.0;
        if (video.playbackRate !== speed) {
            video.playbackRate = speed;
        }
    },

    _cycleSpeed(direction) {
        if (this._isLive()) {
            this._showOverlay('Speed: 1.0x (Live)');
            return;
        }
        const current = Settings.get('playbackSpeed') || 1.0;
        const idx = this._speeds.indexOf(current);
        let newIdx;
        if (direction > 0) {
            newIdx = idx < this._speeds.length - 1 ? idx + 1 : idx;
        } else {
            newIdx = idx > 0 ? idx - 1 : 0;
        }
        const newSpeed = this._speeds[newIdx];
        Settings.set('playbackSpeed', newSpeed);
        for (const v of qsa('video')) v.playbackRate = newSpeed;
        this._showOverlay(`Speed: ${newSpeed}x`);
    },

    _bindVideo(video) {
        if (video.dataset.rxSpeedBound) return;
        video.dataset.rxSpeedBound = '1';
        this._applySpeed(video);
        const play = () => this._applySpeed(video);
        const ratechange = () => {
            const target = Settings.get('playbackSpeed') || 1.0;
            if (!this._isLive() && Math.abs(video.playbackRate - target) > 0.01) {
                video.playbackRate = target;
            }
        };
        video.addEventListener('play', play);
        video.addEventListener('ratechange', ratechange);
        this._videoBindings = this._videoBindings || new Map();
        this._videoBindings.set(video, { play, ratechange });
    },

    _unbindVideo(video) {
        const handlers = this._videoBindings?.get(video);
        if (!handlers) return;
        video.removeEventListener('play', handlers.play);
        video.removeEventListener('ratechange', handlers.ratechange);
        delete video.dataset.rxSpeedBound;
        this._videoBindings.delete(video);
    },

    _scanVideos() {
        for (const video of [...(this._videoBindings?.keys() || [])]) {
            if (!video.isConnected) this._unbindVideo(video);
        }
        for (const video of qsa('video')) this._bindVideo(video);
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._videoBindings = new Map();
        this._styleEl = injectStyle(this._css, 'rx-speed-css');
        this._scanVideos();
        this._obs = new MutationObserver(() => {
            scheduleFeatureFrame(this, 'video-scan', () => this._scanVideos());
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._obs = null;
        for (const video of [...(this._videoBindings?.keys() || [])]) this._unbindVideo(video);
        this._videoBindings?.clear();
        this._overlayEl?.remove();
        this._overlayEl = null;
        clearTimeout(this._overlayTimer);
        this._overlayTimer = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Scroll Volume Control
// ═══════════════════════════════════════════
const ScrollVolume = {
    id: 'scrollVolume',
    name: 'Scroll Volume',
    _styleEl: null,
    _obs: null,
    _overlayEl: null,
    _overlayTimer: null,
    _videoBindings: null,
    _popupHandlers: null,

    _css: `
        #rx-volume-overlay {
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            padding: 8px 18px;
            background: rgba(0,0,0,0.85);
            color: #cdd6f4;
            font-size: 13px;
            font-weight: 600;
            border-radius: 8px;
            z-index: 100000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #rx-volume-overlay.rx-visible { opacity: 1; }
        #rx-volume-overlay .rx-vol-bar {
            width: 80px;
            height: 4px;
            background: rgba(255,255,255,0.15);
            border-radius: 2px;
            overflow: hidden;
        }
        #rx-volume-overlay .rx-vol-fill {
            height: 100%;
            background: var(--rx-accent, #89b4fa);
            border-radius: 2px;
            transition: width 0.1s ease;
        }
    `,

    STEP: 0.05,
    STORAGE_KEY: 'rx_volume',

    _showOverlay(text, pct) {
        if (!this._overlayEl) {
            this._overlayEl = document.createElement('div');
            this._overlayEl.id = 'rx-volume-overlay';
            this._overlayEl.innerHTML = '<span></span><div class="rx-vol-bar"><div class="rx-vol-fill"></div></div>';
            document.body.appendChild(this._overlayEl);
        }
        this._overlayEl.querySelector('span').textContent = text;
        this._overlayEl.querySelector('.rx-vol-fill').style.width = pct + '%';
        this._overlayEl.classList.add('rx-visible');
        clearTimeout(this._overlayTimer);
        this._overlayTimer = setTimeout(() => this._overlayEl.classList.remove('rx-visible'), 1500);
    },

    _saveVolume(vol) {
        try { localStorage.setItem(this.STORAGE_KEY, vol.toString()); } catch {}
    },

    _loadVolume() {
        try {
            const v = parseFloat(localStorage.getItem(this.STORAGE_KEY));
            return isNaN(v) ? null : Math.min(1, Math.max(0, v));
        } catch { return null; }
    },

    _onWheel(e) {
        // Only handle if cursor is directly over the video/player area
        const playerArea = e.target.closest('#rx-split-left, .videoPlayer-Rumble-cls, #videoPlayer, video');
        if (!playerArea) return;
        // Don't intercept if over the right panel in theater split
        if (e.target.closest('#rx-split-right, #rx-tab-bar, .rx-panel-header')) return;
        // When TheaterSplit is active, yield all wheel events on the player area —
        // TheaterSplit uses scroll to expand/collapse the split panel.
        // Volume can still be adjusted via keyboard (ArrowUp/Down) or middle-click.
        if (TheaterSplit._isActive && playerArea.closest('#rx-split-left')) return;
        const video = playerArea.tagName === 'VIDEO' ? playerArea : playerArea.querySelector('video');
        if (!video) return;

        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -this.STEP : this.STEP;
        let newVol = Math.min(1, Math.max(0, video.volume + delta));
        newVol = Math.round(newVol * 100) / 100;

        if (newVol > 0 && video.muted) video.muted = false;
        video.volume = newVol;
        this._saveVolume(newVol);
        this._showOverlay(`${Math.round(newVol * 100)}%`, Math.round(newVol * 100));
    },

    _onMiddleClick(e) {
        if (e.button !== 1) return;
        const video = e.target.closest('video') || (e.target.closest('#rx-split-left, .videoPlayer-Rumble-cls, #videoPlayer') || document).querySelector('video');
        if (!video) return;
        e.preventDefault();
        video.muted = !video.muted;
        const pct = Math.round(video.volume * 100);
        this._showOverlay(video.muted ? 'Muted' : `${pct}%`, video.muted ? 0 : pct);
    },

    _restoreVolume(video) {
        const saved = this._loadVolume();
        if (saved !== null) {
            video.volume = saved;
            if (saved > 0) video.muted = false;
        } else if (Settings.get('defaultMaxVolume')) {
            video.volume = 1;
            video.muted = false;
            this._saveVolume(1);
        }
    },

    _bindVideo(video) {
        if (video.dataset.rxVolBound) return;
        video.dataset.rxVolBound = '1';
        this._restoreVolume(video);
        const loadedmetadata = () => this._restoreVolume(video);
        const play = () => this._restoreVolume(video);
        video.addEventListener('loadedmetadata', loadedmetadata);
        video.addEventListener('play', play, { once: true });
        this._videoBindings = this._videoBindings || new Map();
        this._videoBindings.set(video, { loadedmetadata, play });
    },

    _unbindVideo(video) {
        const handlers = this._videoBindings?.get(video);
        if (!handlers) return;
        video.removeEventListener('loadedmetadata', handlers.loadedmetadata);
        video.removeEventListener('play', handlers.play);
        delete video.dataset.rxVolBound;
        this._videoBindings.delete(video);
    },

    _scanVideos() {
        for (const video of [...(this._videoBindings?.keys() || [])]) {
            if (!video.isConnected) this._unbindVideo(video);
        }
        for (const video of qsa('video')) this._bindVideo(video);
    },

    _volPinned: false,
    _volPinTimer: null,
    _volPopup: null,
    _volPopupObs: null,

    _isVolPopup(el) {
        if (!el || el.nodeType !== 1 || el.tagName !== 'DIV') return false;
        const s = el.style;
        return s.position === 'absolute' &&
               s.backdropFilter && s.backdropFilter.includes('blur') &&
               parseInt(s.width) <= 20 &&
               parseInt(s.height) >= 60 &&
               s.bottom;
    },

    _pinPopup(popup) {
        if (popup._rxVolBound) return;
        popup._rxVolBound = true;
        this._volPopup = popup;

        // Direct hover on popup: pin indefinitely until mouseleave
        const mouseenter = () => {
            clearTimeout(this._volPinTimer);
            this._volPinned = true;
        };
        const mouseleave = () => {
            this._volPinTimer = setTimeout(() => {
                this._volPinned = false;
            }, 300);
        };
        popup.addEventListener('mouseenter', mouseenter);
        popup.addEventListener('mouseleave', mouseleave);
        this._popupHandlers = { popup, mouseenter, mouseleave };

        // Watch for Rumble showing/hiding the popup via inline style changes
        this._volPopupObs = new MutationObserver(() => {
            const s = popup.style;
            const isHidden = s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0;

            if (!isHidden && !this._volPinned) {
                // Popup just became visible — grant a grace period to reach it
                clearTimeout(this._volPinTimer);
                this._volPinned = true;
                this._volPinTimer = setTimeout(() => {
                    if (!popup.matches(':hover')) {
                        this._volPinned = false;
                    }
                }, 800);
            }

            if (isHidden && this._volPinned) {
                // Rumble trying to hide while pinned — revert
                s.display = 'block';
                s.visibility = 'visible';
                s.opacity = '1';
            }
        });
        this._volPopupObs.observe(popup, { attributes: true, attributeFilter: ['style'] });
    },

    _detachVolPopup() {
        this._volPopupObs?.disconnect();
        this._volPopupObs = null;
        clearTimeout(this._volPinTimer);
        this._volPinTimer = null;
        this._volPinned = false;
        if (this._popupHandlers) {
            const { popup, mouseenter, mouseleave } = this._popupHandlers;
            popup.removeEventListener('mouseenter', mouseenter);
            popup.removeEventListener('mouseleave', mouseleave);
            delete popup._rxVolBound;
        }
        this._popupHandlers = null;
        this._volPopup = null;
    },

    _scanForVolPopup() {
        if (this._volPopup?.isConnected) return;
        if (this._volPopup) this._detachVolPopup();
        const player = qs('#videoPlayer, .videoPlayer-Rumble-cls');
        if (!player) return;
        for (const el of player.querySelectorAll('div[style*="backdrop-filter"]')) {
            if (this._isVolPopup(el)) {
                this._pinPopup(el);
                return;
            }
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._videoBindings = new Map();
        this._styleEl = injectStyle(this._css, 'rx-scrollvol-css');

        this._wheelFn = (e) => this._onWheel(e);
        this._midclickFn = (e) => this._onMiddleClick(e);
        document.addEventListener('wheel', this._wheelFn, { passive: false, capture: true });
        document.addEventListener('mousedown', this._midclickFn, { capture: true });

        this._scanVideos();

        this._obs = new MutationObserver(() => {
            scheduleFeatureFrame(this, 'player-scan', () => {
                this._scanVideos();
                this._scanForVolPopup();
            });
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });

        // Also scan after a delay since the player renders async
        setFeatureTimeout(this, () => this._scanForVolPopup(), 2000);
        setFeatureTimeout(this, () => this._scanForVolPopup(), 5000);
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._obs = null;
        this._detachVolPopup();
        this._overlayEl?.remove();
        this._overlayEl = null;
        clearTimeout(this._overlayTimer);
        this._overlayTimer = null;
        for (const video of [...(this._videoBindings?.keys() || [])]) this._unbindVideo(video);
        this._videoBindings?.clear();
        if (this._wheelFn) document.removeEventListener('wheel', this._wheelFn, { capture: true });
        if (this._midclickFn) document.removeEventListener('mousedown', this._midclickFn, { capture: true });
        this._wheelFn = null;
        this._midclickFn = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Auto Max Quality
// ═══════════════════════════════════════════
const AutoMaxQuality = {
    id: 'autoMaxQuality',
    name: 'Auto Max Quality',
    _obs: null,
    _attempted: false,
    _timers: [],

    _clearTimers() {
        for (const t of this._timers) clearTimeout(t);
        this._timers = [];
    },

    _selectBest() {
        if (this._attempted) return;
        // Rumble's quality menu: find the settings gear, open it, pick highest
        // The player uses class .touched_overlay_item for the settings button area
        const settingsBtn = qs('.touched_overlay_item + div button, [class*="quality-menu"], .videoPlayer-Rumble-cls button[aria-label*="Settings"]');
        if (settingsBtn) {
            this._attempted = true;
            this._clearTimers();
            this._obs?.disconnect();
            this._tryQualitySelect();
            return;
        }
        // Alternative: directly manipulate through Rumble's player API if available
        this._tryAPIApproach();
    },

    _tryAPIApproach() {
        // Rumble stores quality options in the player. Try to access via the embed API
        const player = qs('#videoPlayer, .videoPlayer-Rumble-cls');
        if (!player) return;

        // Look for quality selector buttons in the player overlay
        const qualityItems = qsa('.quality-menu-item, [data-quality], .videoPlayer-Rumble-cls [class*="quality"]');
        if (qualityItems.length > 0) {
            this._attempted = true;
            this._clearTimers();
            this._obs?.disconnect();
            let best = qualityItems[0];
            for (const item of qualityItems) {
                const text = item.textContent;
                const match = text.match(/(\d+)p/);
                if (match) {
                    const res = parseInt(match[1]);
                    const bestMatch = best.textContent.match(/(\d+)p/);
                    if (bestMatch && res > parseInt(bestMatch[1])) best = item;
                }
            }
            best.click();
            return;
        }

        // Fallback: use the DOM-clicking approach from the Greasyfork scripts
        this._tryDOMClick();
    },

    _tryDOMClick() {
        // Approach inspired by "Rumble - Auto Best Video Quality" userscript
        // Navigate: settings overlay > last child (quality menu) > click highest option
        try {
            const overlay = qs('.touched_overlay_item');
            if (!overlay) return;
            const settingsPanel = overlay.nextElementSibling;
            if (!settingsPanel) return;
            const qualitySection = settingsPanel.lastChild?.lastChild;
            if (!qualitySection) return;

            // Click the settings button to open
            const settingsClick = settingsPanel.firstChild;
            if (settingsClick) settingsClick.click();

            // Short delay then pick highest quality (last child of quality list)
            setTimeout(() => {
                const qualityList = qualitySection.lastChild;
                if (qualityList) {
                    // Get all quality options, pick the one with highest resolution
                    const options = qualityList.children;
                    let best = null;
                    let bestRes = 0;
                    for (const opt of options) {
                        const text = opt.textContent.trim();
                        if (text.toLowerCase() === 'auto') continue;
                        const m = text.match(/(\d+)/);
                        if (m && parseInt(m[1]) > bestRes) {
                            bestRes = parseInt(m[1]);
                            best = opt;
                        }
                    }
                    if (best) {
                        this._attempted = true;
                        this._clearTimers();
                        this._obs?.disconnect();
                        best.click();
                    }
                }
            }, 300);
        } catch {}
    },

    _tryQualitySelect() {
        // Direct interaction with quality menu items
        setTimeout(() => {
            const items = qsa('[class*="quality"] li, [class*="quality"] div[role="option"], [class*="quality"] button');
            if (!items.length) return;
            let best = null;
            let bestRes = 0;
            for (const item of items) {
                const text = item.textContent.trim();
                if (text.toLowerCase() === 'auto') continue;
                const m = text.match(/(\d+)/);
                if (m && parseInt(m[1]) > bestRes) {
                    bestRes = parseInt(m[1]);
                    best = item;
                }
            }
            if (best) best.click();
        }, 500);
    },

    // Preferred path (ported from Rumble Enhancement Suite v11): directly ask
    // hls.js for the top level once the manifest is parsed. Much more reliable
    // than clicking through the overlay when the player exposes an hls.js
    // instance on the <video> element. We retain a reference to the bound
    // listener so destroy() can unhook it instead of leaving a handler
    // attached to the hls instance for the life of the page.
    _hlsInstances: null, // WeakRef-less Set — hls instances we've bound to
    _hlsApply: null,

    _tryHlsDirect() {
        if (this._attempted) return false;
        const video = qs('#videoPlayer video, video');
        const hls = video?.hls;
        if (!hls) return false;
        const apply = () => {
            if (Array.isArray(hls.levels) && hls.levels.length > 1) {
                try {
                    hls.nextLevel = hls.levels.length - 1;
                    this._attempted = true;
                    this._clearTimers();
                    this._obs?.disconnect();
                    return true;
                } catch {}
            }
            return false;
        };
        if (apply()) return true;
        // If the manifest isn't parsed yet, hook the event. hls.js exposes
        // Hls.Events.MANIFEST_PARSED === 'hlsManifestParsed' — use the string
        // so we don't depend on a global Hls binding.
        try {
            hls.on?.('hlsManifestParsed', apply);
            this._hlsInstances = this._hlsInstances || new Set();
            this._hlsInstances.add({ hls, apply });
        } catch {}
        return false;
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._attempted = false;
        this._hlsInstances = new Set();

        // Try the hls.js direct path immediately, and retry a few times as
        // the player hot-swaps its <video> element during loading.
        this._timers = [];
        const attempts = [500, 1500, 3000, 5000, 8000];
        for (const delay of attempts) {
            this._timers.push(setTimeout(() => {
                if (this._attempted) return;
                if (this._tryHlsDirect()) return;
                this._selectBest();
            }, delay));
        }

        // Also watch for player DOM changes
        this._obs = new MutationObserver(() => {
            if (this._attempted) return;
            if (this._tryHlsDirect()) return;
            this._selectBest();
        });
        waitForFeature(this, '#videoPlayer, .videoPlayer-Rumble-cls').then(el => {
            this._obs.observe(el, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._clearTimers();
        this._obs?.disconnect();
        // Detach each hls.js listener we bound, so we don't leave handlers
        // hanging on the player after the feature is disabled.
        if (this._hlsInstances) {
            for (const entry of this._hlsInstances) {
                try { entry.hls.off?.('hlsManifestParsed', entry.apply); } catch {}
            }
            this._hlsInstances.clear();
        }
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Watch Progress (Resume Playback)
// ═══════════════════════════════════════════
const WatchProgress = {
    id: 'watchProgress',
    name: 'Watch Progress',
    _styleEl: null,
    _saveInterval: null,
    _obs: null,
    _video: null,
    _pauseHandler: null,
    _endedHandler: null,
    _mountGen: 0,
    _feedTimer: null,
    _resumeTimer: null,

    STORAGE_KEY: 'rx_watch_progress',
    MAX_ENTRIES: 500,
    SAVE_INTERVAL: 5000,
    RESUME_THRESHOLD: 5, // don't resume if < 5s in
    COMPLETE_THRESHOLD: 0.95, // consider complete at 95%

    _css: `
        .rx-progress-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: transparent;
            z-index: 5;
            pointer-events: none;
        }
        .rx-progress-fill {
            height: 100%;
            background: #f38ba8;
            border-radius: 0 2px 2px 0;
            transition: width 0.3s ease;
        }
        .rx-resume-toast {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            padding: 10px 20px;
            background: rgba(24,24,37,0.95);
            border: 1px solid rgba(137,180,250,0.2);
            color: #cdd6f4;
            font-size: 13px;
            border-radius: 10px;
            z-index: 100001;
            opacity: 0;
            transition: opacity 0.3s, transform 0.3s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .rx-resume-toast.rx-visible {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
        .rx-resume-toast:hover {
            border-color: rgba(137,180,250,0.4);
        }
        .rx-resume-toast button {
            min-height: 36px; margin-left: 8px; padding: 6px 10px;
            border: 1px solid rgba(137,180,250,0.35); border-radius: 6px;
            background: rgba(137,180,250,0.14); color: inherit; cursor: pointer;
        }
        .rx-resume-toast button:focus-visible { outline: 3px solid #89b4fa; outline-offset: 2px; }
    `,

    _getVideoId() {
        // Extract from URL path: /vXXXXXX-slug.html
        const m = location.pathname.match(/\/(v[a-z0-9]+)-/);
        if (m) return m[1];
        // Fallback: embed ID from player
        const player = qs('[id^="vid_v"]');
        if (player) return player.id.replace('vid_', '');
        return null;
    },

    _getStore() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
        } catch { return {}; }
    },

    _saveStore(store) {
        // Prune old entries
        const entries = Object.entries(store);
        if (entries.length > this.MAX_ENTRIES) {
            entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
            const pruned = Object.fromEntries(entries.slice(entries.length - this.MAX_ENTRIES));
            store = pruned;
        }
        try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(store)); } catch {}
    },

    _savePosition(video) {
        const id = this._getVideoId();
        if (!id || !video.duration || video.duration < 30) return;
        const fraction = video.currentTime / video.duration;
        if (fraction > this.COMPLETE_THRESHOLD) {
            // Video complete, remove entry
            const store = this._getStore();
            delete store[id];
            this._saveStore(store);
            return;
        }
        if (video.currentTime < this.RESUME_THRESHOLD) return;
        const store = this._getStore();
        store[id] = { t: Math.floor(video.currentTime), d: Math.floor(video.duration), ts: Date.now() };
        this._saveStore(store);
    },

    _tryResume(video) {
        const id = this._getVideoId();
        if (!id) return;
        const store = this._getStore();
        const entry = store[id];
        if (!entry || entry.t < this.RESUME_THRESHOLD) return;

        const fmtTime = (s) => {
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m}:${sec.toString().padStart(2, '0')}`;
        };

        const toast = document.createElement('div');
        toast.className = 'rx-resume-toast';
        toast.setAttribute('role', 'status');
        const prompt = document.createElement('span');
        prompt.textContent = `Continue from ${fmtTime(entry.t)}?`;
        const resume = document.createElement('button');
        resume.type = 'button';
        resume.textContent = 'Resume';
        const startOver = document.createElement('button');
        startOver.type = 'button';
        startOver.textContent = 'Start over';
        toast.append(prompt, resume, startOver);
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('rx-visible'));

        let dismissed = false;
        const dismiss = () => {
            if (dismissed) return;
            dismissed = true;
            toast.classList.remove('rx-visible');
            setTimeout(() => toast.remove(), 300);
        };

        resume.addEventListener('click', () => {
            if (video && video.isConnected && isFinite(entry.t)) {
                video.currentTime = entry.t;
            }
            dismiss();
        });
        startOver.addEventListener('click', () => {
            const storeNow = this._getStore();
            delete storeNow[id];
            this._saveStore(storeNow);
            dismiss();
        });

        // Auto-dismiss after 8s
        clearTimeout(this._resumeTimer);
        this._resumeTimer = setTimeout(dismiss, 8000);
    },

    _addProgressBars() {
        const store = this._getStore();
        // Add progress indicators to video thumbnails in feeds
        for (const entry of VideoCards.all()) {
            const id = VideoCards.videoId(entry);
            if (!id) continue;
            const progress = store[id];
            if (!progress || progress.t < this.RESUME_THRESHOLD) continue;

            const thumb = VideoCards.thumbnail(entry);
            if (!thumb || thumb.querySelector('.rx-progress-bar')) continue;

            const pct = Math.min(100, (progress.t / progress.d) * 100);
            const bar = document.createElement('div');
            bar.className = 'rx-progress-bar';
            const fill = document.createElement('div');
            fill.className = 'rx-progress-fill';
            fill.style.width = `${pct}%`;
            bar.appendChild(fill);
            thumb.style.position = 'relative';
            thumb.appendChild(bar);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-watchprogress-css');

        if (Page.isWatch()) {
            const generation = ++this._mountGen;
            waitForFeature(this, 'video').then(() => {
                if (generation !== this._mountGen || !Settings.get(this.id)) return;
                const video = getActiveMedia();
                if (!video) return;
                this._video = video;
                this._tryResume(video);
                this._saveInterval = setInterval(() => this._savePosition(video), this.SAVE_INTERVAL);
                this._pauseHandler = () => this._savePosition(video);
                this._endedHandler = () => this._savePosition(video);
                video.addEventListener('pause', this._pauseHandler);
                video.addEventListener('ended', this._endedHandler);
            }).catch(() => {});
        }

        if (Page.isFeed() || Page.isHome() || Page.isSearch() || Page.isChannel()) {
            // Add progress bars after page loads
            this._feedTimer = setTimeout(() => this._addProgressBars(), 1000);
            this._obs = new MutationObserver(() => {
                scheduleFeatureFrame(this, 'progress-scan', () => this._addProgressBars());
            });
            this._obs.observe(document.body, { childList: true, subtree: true });
        }
    },

    destroy() {
        this._mountGen++;
        this._styleEl?.remove();
        if (this._saveInterval) clearInterval(this._saveInterval);
        this._saveInterval = null;
        clearTimeout(this._feedTimer);
        clearTimeout(this._resumeTimer);
        if (this._video && this._pauseHandler) this._video.removeEventListener('pause', this._pauseHandler);
        if (this._video && this._endedHandler) this._video.removeEventListener('ended', this._endedHandler);
        this._video = null;
        this._pauseHandler = null;
        this._endedHandler = null;
        this._obs?.disconnect();
        this._obs = null;
        for (const bar of qsa('.rx-progress-bar, .rx-resume-toast')) bar.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Channel Blocker
// ═══════════════════════════════════════════
const ChannelBlocker = {
    id: 'channelBlocker',
    name: 'Channel Blocker',
    _styleEl: null,
    _obs: null,
    _timer: null,

    _css: `
        .rx-block-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: transparent;
            border: 1px solid transparent;
            color: rgba(255,255,255,0.3);
            cursor: pointer;
            font-size: 11px;
            line-height: 1;
            transition: all 0.15s;
            margin-left: 4px;
            vertical-align: middle;
            padding: 0;
        }
        .rx-block-btn:hover {
            color: #f38ba8;
            border-color: rgba(243,139,168,0.3);
            background: rgba(243,139,168,0.1);
        }
        .rx-block-btn svg {
            width: 12px;
            height: 12px;
        }
        .rx-blocked-channel {
            display: none !important;
        }
        .rx-unblock-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            padding: 3px 8px 3px 10px;
            border-radius: 12px;
            border: 1px solid rgba(243,139,168,0.2);
            background: rgba(243,139,168,0.08);
            color: #f38ba8;
            cursor: pointer;
            transition: background 0.15s, border-color 0.15s;
        }
        .rx-unblock-chip:hover {
            background: rgba(243,139,168,0.15);
            border-color: rgba(243,139,168,0.4);
        }
        .rx-unblock-chip svg { width: 10px; height: 10px; }
    `,

    _blockSVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',

    _getBlocked() {
        return Settings.get('blockedChannels') || [];
    },

    _blockChannel(name) {
        const blocked = this._getBlocked();
        const normalized = name.trim().toLowerCase();
        if (blocked.includes(normalized)) return;
        blocked.push(normalized);
        Settings.set('blockedChannels', blocked);
        this._filterFeed();
    },

    _unblockChannel(name) {
        let blocked = this._getBlocked();
        blocked = blocked.filter(c => c !== name.trim().toLowerCase());
        Settings.set('blockedChannels', blocked);
        this._filterFeed();
    },

    _filterFeed() {
        const blocked = this._getBlocked();

        for (const entry of VideoCards.all()) {
            const name = VideoCards.channel(entry).toLowerCase();
            if (!name) continue;
            if (blocked.includes(name)) {
                entry.classList.add('rx-blocked-channel');
            } else {
                entry.classList.remove('rx-blocked-channel');
            }
        }
    },

    _addBlockButtons() {
        for (const entry of VideoCards.all()) {
            if (entry.querySelector('.rx-block-btn')) continue;
            const channelName = VideoCards.channel(entry);
            const channelEl = VideoCards.channelAnchor(entry);
            if (!channelName) continue;

            const btn = document.createElement('button');
            btn.className = 'rx-block-btn';
            btn.title = 'Block this channel';
            btn.setAttribute('aria-label', `Block ${channelName}`);
            btn.innerHTML = this._blockSVG;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._blockChannel(channelName);
            });
            (channelEl?.parentElement || entry).appendChild(btn);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isFeed() && !Page.isHome()) return;
        this._styleEl = injectStyle(this._css, 'rx-chanblocker-css');
        this._timer = setTimeout(() => {
            this._addBlockButtons();
            this._filterFeed();
        }, 1000);
        this._obs = new MutationObserver(() => {
            scheduleFeatureFrame(this, 'channel-scan', () => {
                this._addBlockButtons();
                this._filterFeed();
            });
        });
        this._obs.observe(document.body, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        clearTimeout(this._timer);
        this._timer = null;
        for (const button of qsa('.rx-block-btn')) button.remove();
        for (const entry of qsa('.rx-blocked-channel')) entry.classList.remove('rx-blocked-channel');
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Channel Archive Button (v3.19.0)
// ═══════════════════════════════════════════
// Phase 2 of the v3.18 Channel Archive Queue. On any /c/<slug> or /user/<slug>
// page, injects an "Archive this channel" button next to the existing Follow
// toggle. One click enqueues the channel (using the v3.18 background API)
// with sensible defaults — 50 items max, no clip filter. User can fine-tune
// limits in the options-page "Channel archive queue" section.
const ChannelArchiveButton = {
    id: 'channelArchiveButton',
    name: 'Channel Archive Button',
    _styleEl: null,
    _obs: null,
    _btn: null,

    _css: `
        .rx-archive-channel-btn {
            display: inline-flex; align-items: center; gap: 6px;
            background: rgba(137,180,250,0.12);
            color: var(--rx-accent, #89b4fa);
            border: 1px solid rgba(137,180,250,0.35);
            border-radius: 6px;
            padding: 6px 12px;
            font: 600 12px/1 system-ui, sans-serif;
            cursor: pointer; margin-left: 8px;
            transition: background .15s, border-color .15s;
        }
        .rx-archive-channel-btn:hover {
            background: rgba(137,180,250,0.22);
            border-color: rgba(137,180,250,0.55);
        }
        .rx-archive-channel-btn[disabled] {
            opacity: 0.6; cursor: progress;
        }
        .rx-archive-channel-btn svg {
            width: 13px; height: 13px;
        }
    `,

    _SVG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><rect x="1" y="3" width="22" height="5" rx="1"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',

    _attach() {
        const followBtn = Selectors.find('profile.followingBtn');
        if (!followBtn || !followBtn.parentNode) return;
        if (this._btn && this._btn.isConnected) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rx-archive-channel-btn';
        btn.innerHTML = this._SVG + '<span>Archive channel</span>';
        btn.title = 'Queue every video on this page for direct MP4 download via RumbleX';
        btn.addEventListener('click', () => this._onClick(btn));
        followBtn.parentNode.insertBefore(btn, followBtn.nextSibling);
        this._btn = btn;
    },

    async _onClick(btn) {
        if (btn.disabled) return;
        btn.disabled = true;
        const labelEl = btn.querySelector('span');
        const originalLabel = labelEl?.textContent || 'Archive channel';
        if (labelEl) labelEl.textContent = 'Queuing…';
        try {
            const resp = await RXPlatform.sendMessage({
                action: 'archiveEnqueueChannel',
                channelUrl: location.origin + location.pathname,
                maxItems: 50,
                filterClips: false,
            });
            if (!resp?.ok) {
                const reasonMap = {
                    'bad-channel-url': 'Not a channel URL.',
                    'no-videos-found': 'No videos found on this page.',
                };
                RxToast.show('Archive failed: ' + (reasonMap[resp?.reason] || resp?.reason || 'unknown'));
                return;
            }
            const skippedNote = resp.skipped ? (' · ' + resp.skipped + ' already queued') : '';
            RxToast.show('Queued ' + resp.enqueued + ' video' + (resp.enqueued === 1 ? '' : 's') + skippedNote + '. Check RumbleX options → Channel archive queue.');
        } catch (e) {
            RxToast.show('Archive failed: ' + String(e?.message || e));
        } finally {
            btn.disabled = false;
            if (labelEl) labelEl.textContent = originalLabel;
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!RXPlatform.capabilities.persistentBackground) return;
        if (!Page.isChannel()) return;
        this._styleEl = injectStyle(this._css, 'rx-archive-channel-css');
        // Channel pages render the Follow button client-side; observe until it appears.
        waitForSelectorFeature(this, 'profile.followingBtn', { timeout: 5000 }).then(() => this._attach()).catch(() => {});
        this._obs = new MutationObserver(() => this._attach());
        this._obs.observe(document.body, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._btn?.remove();
        this._btn = null;
    },
};

// ═══════════════════════════════════════════
//  FEATURE: Keyboard Navigation
// ═══════════════════════════════════════════
const KeyboardNav = {
    id: 'legacyKeyboardNav',
    name: 'Keyboard Nav (legacy)',
    _handler: null,

    _getVideo() {
        return getActiveMedia(qs('#rx-split-left') || qs('#videoPlayer') || qs('.videoPlayer-Rumble-cls') || document);
    },

    _isTyping(e) {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return false;
        const tag = target.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable ||
               !!target.closest('.chat--input, .comments-create, [contenteditable]');
    },

    _showOverlay(text) {
        SpeedController._showOverlay?.(text) || (() => {
            // Fallback if speed controller is off
            let el = qs('#rx-kbd-overlay');
            if (!el) {
                el = document.createElement('div');
                el.id = 'rx-kbd-overlay';
                el.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);padding:6px 16px;background:rgba(0,0,0,0.8);color:#cdd6f4;font-size:14px;font-weight:600;border-radius:8px;z-index:100000;pointer-events:none;opacity:0;transition:opacity 0.3s;font-family:-apple-system,BlinkMacSystemFont,sans-serif;';
                document.body.appendChild(el);
            }
            el.textContent = text;
            el.style.opacity = '1';
            clearTimeout(el._timer);
            el._timer = setTimeout(() => { el.style.opacity = '0'; }, 1200);
        })();
    },

    _fmtTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;

        this._handler = (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey || this._isTyping(e)) return;
            const video = this._getVideo();
            if (!video) return;

            const key = e.key.toLowerCase();

            switch (key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    video.paused ? video.play() : video.pause();
                    break;

                case 'j':
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - 10);
                    this._showOverlay(this._fmtTime(video.currentTime));
                    break;

                case 'l':
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
                    this._showOverlay(this._fmtTime(video.currentTime));
                    break;

                case 'arrowleft':
                    e.preventDefault();
                    video.currentTime = Math.max(0, video.currentTime - 5);
                    this._showOverlay(this._fmtTime(video.currentTime));
                    break;

                case 'arrowright':
                    e.preventDefault();
                    video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5);
                    this._showOverlay(this._fmtTime(video.currentTime));
                    break;

                case 'arrowup':
                    e.preventDefault();
                    video.volume = Math.min(1, video.volume + 0.05);
                    if (video.muted) video.muted = false;
                    ScrollVolume._saveVolume?.(video.volume);
                    this._showOverlay(`${Math.round(video.volume * 100)}%`);
                    break;

                case 'arrowdown':
                    e.preventDefault();
                    video.volume = Math.max(0, video.volume - 0.05);
                    ScrollVolume._saveVolume?.(video.volume);
                    this._showOverlay(`${Math.round(video.volume * 100)}%`);
                    break;

                case 'f':
                    e.preventDefault();
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    } else {
                        (video.closest('.videoPlayer-Rumble-cls') || video).requestFullscreen().catch(() => {});
                    }
                    break;

                case 'm':
                    e.preventDefault();
                    video.muted = !video.muted;
                    this._showOverlay(video.muted ? 'Muted' : `${Math.round(video.volume * 100)}%`);
                    break;

                case ',':
                    if (video.paused) {
                        e.preventDefault();
                        video.currentTime = Math.max(0, video.currentTime - (1 / 30));
                    }
                    break;

                case '.':
                    if (video.paused) {
                        e.preventDefault();
                        video.currentTime = Math.min(video.duration, video.currentTime + (1 / 30));
                    }
                    break;

                case '<':
                    e.preventDefault();
                    SpeedController._cycleSpeed?.(-1);
                    break;

                case '>':
                    e.preventDefault();
                    SpeedController._cycleSpeed?.(1);
                    break;

                default:
                    // Number keys 0-9: seek to percentage
                    if (/^[0-9]$/.test(key) && video.duration) {
                        e.preventDefault();
                        video.currentTime = (parseInt(key) / 10) * video.duration;
                        this._showOverlay(this._fmtTime(video.currentTime));
                    }
                    break;
            }
        };

        document.addEventListener('keydown', this._handler);
    },

    destroy() {
        if (this._handler) document.removeEventListener('keydown', this._handler);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Auto Theater Mode
// ═══════════════════════════════════════════
const AutoTheater = {
    id: 'autoTheater',
    name: 'Auto Theater',
    _timers: null,

    _clearTimers() {
        for (const timer of this._timers || []) clearTimeout(timer);
        this._timers = [];
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        // Don't fight with TheaterSplit - if that's enabled, it handles theater
        if (Settings.get('theaterSplit')) return;
        this._clearTimers();

        // Click Rumble's native theater button
        const tryClick = () => {
            const theaterBtn = qs('[data-js="theater-mode-toggle"]') ||
                qs('button[title*="heater" i]') ||
                qs('button[aria-label*="heater" i]') ||
                qs('#theaterVideoPlayer');
            if (theaterBtn) {
                const isActive = theaterBtn.classList.contains('active') ||
                    document.body.classList.contains('theater-mode') ||
                    document.documentElement.classList.contains('theater-mode');
                if (!isActive) {
                    theaterBtn.click();
                    return true;
                }
                return true; // already active
            }
            return false;
        };

        // Retry since player loads async
        const attempts = [1500, 3000, 5000, 8000];
        for (const delay of attempts) {
            this._timers.push(setTimeout(() => tryClick(), delay));
        }
    },

    destroy() {
        this._clearTimers();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Live Chat Enhance
// ═══════════════════════════════════════════
const LiveChatEnhance = {
    id: 'liveChatEnhance',
    name: 'Chat Enhance',
    _styleEl: null,
    _obs: null,
    _highlightWords: [],

    _css: `
        .rx-chat-highlight {
            background: rgba(137,180,250,0.15) !important;
            border-left: 2px solid var(--rx-accent, #89b4fa) !important;
        }
        .rx-chat-mention {
            color: var(--rx-accent, #89b4fa);
            font-weight: 600;
        }
        #rx-chat-filter {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            flex-shrink: 0;
        }
        #rx-chat-filter input {
            flex: 1;
            background: rgba(49,50,68,0.5);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 6px;
            padding: 4px 8px;
            font-size: 11px;
            color: var(--rx-text, #cdd6f4);
            outline: none;
        }
        #rx-chat-filter input:focus {
            border-color: rgba(137,180,250,0.3);
        }
        #rx-chat-filter input::placeholder {
            color: rgba(255,255,255,0.25);
        }
        .rx-chat-badge-rant {
            display: inline-block;
            padding: 1px 5px;
            border-radius: 4px;
            background: rgba(243,139,168,0.15);
            color: #f38ba8;
            font-size: 10px;
            font-weight: 600;
            margin-left: 4px;
        }
        .rx-chat-hidden { display: none !important; }
    `,

    _highlightMentions(msgEl) {
        const textEls = msgEl.querySelectorAll('.chat--message-text, .chat--message');
        for (const el of textEls) {
            if (el.dataset.rxMentionDone) continue;
            el.dataset.rxMentionDone = '1';
            // Walk the element's text nodes and replace @mentions *in place*.
            // Previously we did `el.innerHTML = el.innerHTML.replace(...)` which
            // re-parses the whole subtree — accidentally re-triggering any
            // markup side-effects (e.g. <img onerror>) that Rumble's chat
            // renderer happened to have emitted. Text-node walking keeps us
            // strictly inside Text nodes, so any existing HTML is untouched.
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const targets = [];
            while (walker.nextNode()) {
                const node = walker.currentNode;
                if (!node.nodeValue || !/@\w+/.test(node.nodeValue)) continue;
                // Skip text inside nodes we already wrapped or inside elements
                // that shouldn't carry mention styling (links, our own span).
                const parent = node.parentElement;
                if (!parent || parent.classList?.contains('rx-chat-mention')) continue;
                targets.push(node);
            }
            for (const node of targets) {
                const frag = document.createDocumentFragment();
                const text = node.nodeValue;
                let lastIdx = 0;
                const re = /@(\w+)/g;
                let m;
                while ((m = re.exec(text)) !== null) {
                    if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
                    const span = document.createElement('span');
                    span.className = 'rx-chat-mention';
                    span.textContent = '@' + m[1];
                    frag.appendChild(span);
                    lastIdx = m.index + m[0].length;
                }
                if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
                node.parentNode?.replaceChild(frag, node);
            }
        }
    },

    _processMessages() {
        const messages = qsa('#chat-history-list li, .chat--message-container');
        for (const msg of messages) {
            if (msg.dataset.rxProcessed) continue;
            msg.dataset.rxProcessed = '1';
            this._highlightMentions(msg);
        }

        // Apply filter if active
        this._applyFilter();
    },

    _applyFilter() {
        const filterInput = qs('#rx-chat-filter-input');
        if (!filterInput || !filterInput.value.trim()) return;

        const term = filterInput.value.trim().toLowerCase();
        const messages = qsa('#chat-history-list li, .chat--message-container');
        for (const msg of messages) {
            const text = msg.textContent.toLowerCase();
            msg.classList.toggle('rx-chat-hidden', !text.includes(term));
        }
    },

    _clearFilter() {
        for (const msg of qsa('.rx-chat-hidden')) {
            msg.classList.remove('rx-chat-hidden');
        }
    },

    _addFilterBar() {
        const chatHeader = qs('.chat--header') || qs('#rx-tab-chat .chat--header');
        if (!chatHeader || qs('#rx-chat-filter')) return;

        const filterBar = document.createElement('div');
        filterBar.id = 'rx-chat-filter';
        const input = document.createElement('input');
        input.id = 'rx-chat-filter-input';
        input.type = 'text';
        input.placeholder = 'Filter chat...';
        input.addEventListener('input', () => {
            if (input.value.trim()) {
                this._applyFilter();
            } else {
                this._clearFilter();
            }
        });
        filterBar.appendChild(input);
        chatHeader.after(filterBar);
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-livechat-css');

        // Wait for chat to appear
        const startObs = () => {
            this._addFilterBar();
            this._processMessages();
            this._obs = new MutationObserver(() => {
                scheduleFeatureFrame(this, 'message-scan', () => {
                    this._processMessages();
                    if (!qs('#rx-chat-filter')) this._addFilterBar();
                });
            });
            const chatList = qs('#chat-history-list') || qs('.chat--height');
            if (chatList) {
                this._obs.observe(chatList, { childList: true, subtree: true });
            }
        };

        waitForFeature(this, '#chat-history-list, .chat--height').then(() => {
            setFeatureTimeout(this, startObs, 500);
        }).catch(() => {
            // Not a live stream, that's fine
        });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Video Timestamps
// ═══════════════════════════════════════════
const VideoTimestamps = {
    id: 'videoTimestamps',
    name: 'Timestamps',
    _styleEl: null,
    _obs: null,
    _timer: null,

    _css: `
        .rx-timestamp-link {
            color: var(--rx-accent, #89b4fa);
            cursor: pointer;
            font-weight: 600;
            font-variant-numeric: tabular-nums;
            text-decoration: none;
            border-bottom: 1px dotted rgba(137,180,250,0.3);
            transition: color 0.15s, border-color 0.15s;
        }
        .rx-timestamp-link:hover {
            color: #b4d0fb;
            border-bottom-color: rgba(137,180,250,0.6);
        }
    `,

    // Match timestamps like 0:00, 1:23, 01:23, 1:23:45, 01:23:45
    _timestampRegex: /\b(\d{1,2}:(?:[0-5]\d)(?::[0-5]\d)?)\b/g,

    _parseTimestamp(str) {
        const parts = str.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return 0;
    },

    _seekTo(seconds) {
        const video = qs('#rx-split-left video') || qs('#videoPlayer video') || qs('video');
        if (video) {
            video.currentTime = seconds;
            if (video.paused) video.play().catch(() => {});
        }
    },

    _processElement(el) {
        if (el.dataset.rxTimestampDone) return;
        if (el.querySelector('.rx-timestamp-link')) return;

        // Only process text nodes that actually contain timestamps
        const text = el.textContent;
        if (!this._timestampRegex.test(text)) return;
        this._timestampRegex.lastIndex = 0;

        el.dataset.rxTimestampDone = '1';

        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        let node;
        while (node = walker.nextNode()) {
            if (this._timestampRegex.test(node.textContent)) {
                this._timestampRegex.lastIndex = 0;
                textNodes.push(node);
            }
            this._timestampRegex.lastIndex = 0;
        }

        for (const textNode of textNodes) {
            const frag = document.createDocumentFragment();
            let lastIndex = 0;
            const content = textNode.textContent;
            this._timestampRegex.lastIndex = 0;
            let match;

            while (match = this._timestampRegex.exec(content)) {
                // Add text before the match
                if (match.index > lastIndex) {
                    frag.appendChild(document.createTextNode(content.slice(lastIndex, match.index)));
                }
                // Create clickable timestamp
                const link = document.createElement('span');
                link.className = 'rx-timestamp-link';
                link.textContent = match[1];
                link.title = `Seek to ${match[1]}`;
                const seconds = this._parseTimestamp(match[1]);
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._seekTo(seconds);
                });
                frag.appendChild(link);
                lastIndex = match.index + match[0].length;
            }

            if (lastIndex < content.length) {
                frag.appendChild(document.createTextNode(content.slice(lastIndex)));
            }

            if (frag.childNodes.length > 0) {
                textNode.parentNode.replaceChild(frag, textNode);
            }
        }
    },

    _processAll() {
        // Process comments
        for (const el of qsa('.comment-text')) {
            this._processElement(el);
        }
        // Process description
        const desc = qs('.media-description');
        if (desc) this._processElement(desc);
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-timestamps-css');

        clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            this._timer = null;
            this._processAll();
        }, 2000);
        this._obs = new MutationObserver(() => {
            scheduleFeatureFrame(this, 'timestamp-scan', () => this._processAll());
        });
        waitForFeature(this, '.media-page-comments-container, #video-comments').then(el => {
            this._obs.observe(el, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._obs = null;
        clearTimeout(this._timer);
        this._timer = null;
        for (const link of qsa('.rx-timestamp-link')) link.replaceWith(document.createTextNode(link.textContent || ''));
        for (const element of qsa('[data-rx-timestamp-done]')) {
            element.removeAttribute('data-rx-timestamp-done');
            element.normalize();
        }
    }
};

// ═══════════════════════════════════════════
//  FEATURE: PiP Button
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  FEATURE: Screenshot Button
// ═══════════════════════════════════════════
const ScreenshotBtn = {
    id: 'screenshotBtn',
    name: 'Screenshot',
    _btn: null,

    _css: `
        .rx-screenshot-btn {
            position: absolute;
            top: 10px; left: 10px;
            z-index: 100;
            background: rgba(17,17,27,0.75);
            border: 1px solid rgba(205,214,244,0.2);
            color: #cdd6f4;
            border-radius: 6px;
            padding: 6px 10px;
            cursor: pointer;
            font: 700 12px/1 system-ui, sans-serif;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: auto;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .videoPlayer-Rumble-cls:hover .rx-screenshot-btn,
        #videoPlayer:hover .rx-screenshot-btn { opacity: 1; }
        .rx-screenshot-btn:hover { background: rgba(17,17,27,0.9); border-color: #89b4fa; }
        .rx-screenshot-btn svg { width: 14px; height: 14px; fill: currentColor; }
    `,

    _capture() {
        const video = getActiveMedia();
        if (!video || !video.videoWidth) return;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const title = qs('.video-header-container__title, h1')?.textContent?.trim() || 'rumble';
            const safe = title.replace(/[^a-z0-9]+/gi, '_').substring(0, 60);
            const time = Math.floor(video.currentTime);
            const filename = `${safe}_${time}s.png`;

            try {
                await RXPlatform.sendMessage({ action: 'download', data: { url, filename } });
            } catch {
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
            } finally {
                setTimeout(() => URL.revokeObjectURL(url), 5000);
            }
        }, 'image/png');
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch() && !Page.isEmbed()) return;
        this._styleEl = injectStyle(this._css, 'rx-screenshot-css');

        waitForFeature(this, '#videoPlayer, .videoPlayer-Rumble-cls').then(container => {
            const btn = document.createElement('button');
            btn.className = 'rx-screenshot-btn';
            btn.title = 'Screenshot frame';
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>Snap`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._capture(); });
            container.style.position = container.style.position || 'relative';
            container.appendChild(btn);
            this._btn = btn;
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Watch History
// ═══════════════════════════════════════════
const WatchHistoryFeature = {
    id: 'watchHistory',
    name: 'Watch History',
    _MAX: 500,
    _KEY: 'rx_watch_history',
    _recordTimer: null,
    _buttonWrapper: null,

    _getHistory() {
        try { return JSON.parse(localStorage.getItem(this._KEY) || '[]'); }
        catch { return []; }
    },

    _saveHistory(entries) {
        localStorage.setItem(this._KEY, JSON.stringify(entries.slice(0, this._MAX)));
    },

    _recordCurrent() {
        if (!Page.isWatch()) return;
        const title = qs('.video-header-container__title, h1')?.textContent?.trim();
        const channel = qs('.media-heading-name, .media-by--a')?.textContent?.trim();
        const thumb = qs('meta[property="og:image"]')?.content || '';
        if (!title) return;

        const entry = {
            url: location.href,
            title,
            channel: channel || '',
            thumb,
            time: Date.now()
        };

        const history = this._getHistory().filter(e => e.url !== entry.url);
        history.unshift(entry);
        this._saveHistory(history);
    },

    _injectHistoryPage() {
        // Inject a watch history section on /account/history or our custom route
        // We'll add a link in the sidebar and show history on the subscriptions/feed page via a button
        const btn = document.createElement('button');
        btn.className = 'rx-history-btn';
        btn.textContent = 'Watch History';
        btn.title = 'View local watch history';
        btn.addEventListener('click', () => this._showOverlay());

        // Add to nav or toolbar area
        waitForFeature(this, '.main-and-sidebar, .constrained-container, .subscriptions-header, .homepage-container').then(container => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'padding:8px 16px;';
            wrapper.appendChild(btn);
            container.parentNode?.insertBefore(wrapper, container);
            this._buttonWrapper = wrapper;
        }).catch(() => {});
    },

    _css: `
        .rx-history-btn {
            background: #313244; color: #cdd6f4; border: 1px solid #45475a;
            border-radius: 6px; padding: 6px 14px; cursor: pointer;
            font: 600 13px/1.4 system-ui, sans-serif;
            transition: background 0.2s, border-color 0.2s;
        }
        .rx-history-btn:hover { background: #45475a; border-color: #89b4fa; }
        .rx-history-overlay {
            position: fixed; inset: 0; z-index: 100000;
            background: rgba(0,0,0,0.7); display: flex;
            justify-content: center; align-items: flex-start;
            padding: 40px 20px; overflow-y: auto;
        }
        .rx-history-panel {
            background: #1e1e2e; border: 1px solid #45475a;
            border-radius: 12px; max-width: 800px; width: 100%;
            padding: 24px; color: #cdd6f4;
            font-family: system-ui, sans-serif;
            max-height: calc(100vh - 80px); overflow-y: auto;
        }
        .rx-history-panel h2 { margin: 0 0 16px; font-size: 20px; color: #89b4fa; }
        .rx-history-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .rx-history-clear { background: #f38ba8; color: #1e1e2e; border: none; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-weight: 600; font-size: 12px; }
        .rx-history-clear:hover { opacity: 0.85; }
        .rx-history-close { background: none; border: none; color: #6c7086; font-size: 24px; cursor: pointer; padding: 0 4px; }
        .rx-history-close:hover { color: #cdd6f4; }
        .rx-history-item {
            display: flex; gap: 12px; padding: 10px;
            border-radius: 8px; transition: background 0.15s;
            text-decoration: none; color: inherit; border-bottom: 1px solid #313244;
        }
        .rx-history-item:hover { background: #313244; }
        .rx-history-item img { width: 160px; height: 90px; object-fit: cover; border-radius: 6px; background: #313244; flex-shrink: 0; }
        .rx-history-meta { flex: 1; min-width: 0; }
        .rx-history-meta .title { font-weight: 600; font-size: 14px; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rx-history-meta .channel { color: #a6adc8; font-size: 12px; }
        .rx-history-meta .date { color: #6c7086; font-size: 11px; margin-top: 4px; }
        .rx-history-empty { text-align: center; color: #6c7086; padding: 40px 0; }
        .rx-history-search { width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid #45475a; background: #313244; color: #cdd6f4; font-size: 13px; margin-bottom: 12px; outline: none; }
        .rx-history-search:focus { border-color: #89b4fa; }
    `,

    _showOverlay() {
        if (qs('.rx-history-overlay')) return;
        const history = this._getHistory();
        const overlay = document.createElement('div');
        overlay.className = 'rx-history-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Watch history');
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        const panel = document.createElement('div');
        panel.className = 'rx-history-panel';

        const header = document.createElement('div');
        header.className = 'rx-history-header';
        const heading = document.createElement('h2');
        heading.textContent = `Watch History (${history.length})`;
        const btnGroup = document.createElement('div');
        header.append(heading, btnGroup);

        const search = document.createElement('input');
        search.className = 'rx-history-search';
        search.placeholder = 'Search history...';
        search.type = 'text';

        const clearBtn = document.createElement('button');
        clearBtn.className = 'rx-history-clear';
        clearBtn.textContent = 'Clear All';
        clearBtn.addEventListener('click', () => {
            localStorage.removeItem(this._KEY);
            overlay.remove();
        });
        const closeBtn = document.createElement('button');
        closeBtn.className = 'rx-history-close';
        closeBtn.textContent = '\u00d7';
        closeBtn.addEventListener('click', () => overlay.remove());
        btnGroup.appendChild(clearBtn);
        btnGroup.appendChild(closeBtn);

        const list = document.createElement('div');
        const appendEmpty = () => {
            const empty = document.createElement('div');
            empty.className = 'rx-history-empty';
            empty.textContent = 'No watch history yet.';
            list.appendChild(empty);
        };
        const renderList = (filter = '') => {
            list.textContent = '';
            const filtered = filter
                ? history.filter(e => e.title.toLowerCase().includes(filter) || e.channel.toLowerCase().includes(filter))
                : history;
            if (!filtered.length) {
                appendEmpty();
                return;
            }
            for (const e of filtered) {
                const a = document.createElement('a');
                a.className = 'rx-history-item';
                a.href = this._safeRumbleUrl(e.url);
                const date = new Date(e.time);
                const ago = this._timeAgo(date);
                const thumbUrl = this._safeHttpUrl(e.thumb);
                if (thumbUrl) {
                    const img = document.createElement('img');
                    img.src = thumbUrl;
                    img.loading = 'lazy';
                    img.alt = '';
                    a.appendChild(img);
                }
                const meta = document.createElement('div');
                meta.className = 'rx-history-meta';
                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = e.title;
                const channel = document.createElement('div');
                channel.className = 'channel';
                channel.textContent = e.channel;
                const dateEl = document.createElement('div');
                dateEl.className = 'date';
                dateEl.textContent = ago;
                meta.append(title, channel, dateEl);
                a.appendChild(meta);
                list.appendChild(a);
            }
        };
        renderList();
        search.addEventListener('input', () => renderList(search.value.toLowerCase()));

        panel.appendChild(header);
        panel.appendChild(search);
        panel.appendChild(list);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        search.focus();
    },


    _safeHttpUrl(url) {
        try {
            const parsed = new URL(String(url || ''), location.origin);
            return /^https?:$/.test(parsed.protocol) ? parsed.href : '';
        } catch {
            return '';
        }
    },

    _safeRumbleUrl(url) {
        const safe = this._safeHttpUrl(url);
        if (!safe) return '#';
        const host = new URL(safe).hostname;
        return host === 'rumble.com' || host.endsWith('.rumble.com') ? safe : '#';
    },

    _timeAgo(date) {
        const s = Math.floor((Date.now() - date.getTime()) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s/60)}m ago`;
        if (s < 86400) return `${Math.floor(s/3600)}h ago`;
        if (s < 604800) return `${Math.floor(s/86400)}d ago`;
        return date.toLocaleDateString();
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-watch-history-css');
        // Record current video after page loads
        if (Page.isWatch()) {
            clearTimeout(this._recordTimer);
            this._recordTimer = setTimeout(() => {
                this._recordTimer = null;
                this._recordCurrent();
            }, 3000);
        }
        // Show history button on feed pages
        if (Page.isFeed()) {
            this._injectHistoryPage();
        }
    },

    destroy() {
        this._styleEl?.remove();
        clearTimeout(this._recordTimer);
        this._recordTimer = null;
        this._buttonWrapper?.remove();
        this._buttonWrapper = null;
        qs('.rx-history-overlay')?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Autoplay Block
// ═══════════════════════════════════════════
const AutoplayBlock = {
    id: 'autoplayBlock',
    name: 'Autoplay Block',
    _obs: null,
    _docObs: null,
    _autoplayHandler: null,
    _timer: null,

    _css: `
        .js-player-upcoming-button,
        .player-upcoming-overlay,
        [class*="upcoming-overlay"],
        [class*="autoplay-countdown"] { display: none !important; }
    `,

    _blockAutoplay() {
        // Remove upcoming/autoplay overlays
        for (const el of qsa('.js-player-upcoming-button, .player-upcoming-overlay, [class*="upcoming-overlay"], [class*="autoplay-countdown"]')) {
            el.remove();
        }
        // Pause any auto-started next video
        const video = getActiveMedia();
        if (video) {
            video.autoplay = false;
            video.removeAttribute('autoplay');
        }
    },

    // v3.1.0 — Consume autoplayBlockMode enum:
    //   'off'                       — disable the module entirely (matches !autoplayBlock)
    //   'playerOnly'                — DOM-overlay removal only (v1.x behavior)
    //   'relatedEndpointAndPlayer'  — overlay removal AND intercept the player
    //                                 'ended' event so the next video never auto-loads
    //                                 (default in v2.0; v3.2 will pair this with
    //                                 declarativeNetRequest rules at the SW layer).
    _mode() {
        const m = (Settings.get('autoplayBlockMode') || 'relatedEndpointAndPlayer').toLowerCase();
        return ['off', 'playeronly', 'relatedendpointandplayer'].includes(m) ? m : 'relatedendpointandplayer';
    },

    _attachEndedGuard() {
        if (this._autoplayHandler) return;
        this._autoplayHandler = (e) => {
            // Don't fight the user's own autoplay scheduler (different feature).
            if (Settings.get('autoplayScheduler')) return;
            if (!(e.target instanceof HTMLMediaElement)) return;
            // Ended does not bubble, but it traverses the capture phase.
            // A document capture listener runs before player next-video handlers.
            e.stopImmediatePropagation();
            e.preventDefault();
            try { e.target.pause(); } catch {}
        };
        document.addEventListener('ended', this._autoplayHandler, true);
    },

    init() {
        if (!Settings.get(this.id)) return;
        const mode = this._mode();
        if (mode === 'off') return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-autoplay-block-css');

        // Observe for dynamically inserted autoplay elements
        this._obs = new MutationObserver(() => {
            scheduleFeatureFrame(this, 'autoplay-scan', () => this._blockAutoplay());
        });
        waitForFeature(this, '#videoPlayer, .videoPlayer-Rumble-cls').then(el => {
            this._obs.observe(el, { childList: true, subtree: true });
        }).catch(() => {});

        // Also observe document for any autoplay popups
        this._docObs = new MutationObserver(() => {
            scheduleFeatureFrame(this, 'autoplay-scan', () => this._blockAutoplay());
        });
        this._docObs.observe(document.documentElement, { childList: true, subtree: true });

        // Initial pass
        this._timer = setTimeout(() => this._blockAutoplay(), 2000);

        // Player-event interception (v3.1.0) — only when mode says so.
        if (mode === 'relatedendpointandplayer') {
            this._attachEndedGuard();
        }
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._docObs?.disconnect();
        clearTimeout(this._timer);
        // Unbind ended-guard if we installed it.
        if (this._autoplayHandler) {
            document.removeEventListener('ended', this._autoplayHandler, true);
            this._autoplayHandler = null;
        }
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Shorts Redirect (v3.1.0)
// ═══════════════════════════════════════════
// Rumble Shorts launched on web 2026-02-04 (rumble.com/shorts) — a vertical,
// swipeable, loops-until-swipe feed that some users explicitly do not want
// (see r/RumbleForum threads and the uBO custom-filter community).
//
// When `disableShortsFeed` is on, navigating to /shorts redirects to
// /subscriptions immediately. Implementation is location.replace() so the
// /shorts entry doesn't pollute browser history. Routes are hooked via
// Router.onChange so this fires on htmx in-app navigation too, not just
// fresh page loads.
const ShortsRedirect = {
    id: 'disableShortsFeed',
    name: 'Disable Shorts Feed',
    _routerUnsub: null,
    _maybeRedirect() {
        if (!Settings.get(this.id)) return;
        if (!Page.isShorts()) return;
        try {
            // location.replace so the user's back-button isn't trapped in a loop.
            location.replace('/subscriptions');
        } catch (e) {
            console.warn('[RumbleX] ShortsRedirect navigation failed:', e);
        }
    },
    init() {
        if (!Settings.get(this.id)) return;
        // Fresh-load case: redirect immediately if we landed on /shorts.
        this._maybeRedirect();
        // htmx + history nav case: re-evaluate on every route change.
        this._routerUnsub = Router.onChange((d) => {
            if (d.changed) this._maybeRedirect();
        });
    },
    destroy() {
        if (typeof this._routerUnsub === 'function') {
            try { this._routerUnsub(); } catch {}
            this._routerUnsub = null;
        }
    },
};

// ═══════════════════════════════════════════
//  FEATURE: Bulk Unsubscribe (v3.12.0)
// ═══════════════════════════════════════════
// Closes the v2.5 deferred item. Two account pages were unblocked by the
// 2026-05-19 MHTML capture batch:
//   /account/recurring-subs           → per-row <button data-js=
//       "cancel_recurring_subscriptions">Cancel</button>  (paid Locals subs)
//   /followed-channels                → per-row <button data-action=
//       "unsubscribe" hx-post="/-htmx/account/legacy-video-collection">
//       (free channel follows)
//
// Mounts a floating "Bulk-unsubscribe" toolbar on those pages when
// `bulkUnsubscribeEnabled` is on. Provides three actions:
//   - Select all     — checks every action row
//   - Run            — clicks each selected row's native button in order
//                       (paced 350ms apart so htmx doesn't reject the
//                       burst). Respects `bulkUnsubscribeDryRun`: when ON,
//                       counts what WOULD run and shows a toast instead
//                       of clicking anything. Default ON; user must
//                       explicitly turn dry-run OFF to actually unsub.
//   - Stop           — Cancels the in-flight loop.
const BulkUnsubscribe = {
    id: 'bulkUnsubscribeEnabled',
    name: 'Bulk Unsubscribe',
    _bar: null,
    _styleEl: null,
    _routerUnsub: null,
    _aborter: null,

    _css: `
        html.rumblex-active .rx-bulk-unsub-bar {
            position: sticky; top: 70px; z-index: 50;
            display: flex; gap: 8px; align-items: center;
            padding: 10px 14px; margin: 12px 0;
            background: var(--rx-surface0, #1e2a14);
            border: 1px solid var(--rx-surface1, #2a3a1e);
            border-radius: 8px;
            color: var(--rx-text, #d6e8c4);
            font: 600 13px/1.3 system-ui, sans-serif;
        }
        html.rumblex-active .rx-bulk-unsub-bar .rx-bu-label { flex: 1; }
        html.rumblex-active .rx-bulk-unsub-bar .rx-bu-count {
            color: var(--rx-accent, #85c742);
        }
        html.rumblex-active .rx-bulk-unsub-bar button {
            padding: 6px 12px; min-height: 28px;
            background: var(--rx-surface1, #2a3a1e);
            color: inherit;
            border: 1px solid var(--rx-surface2, #3a4f2a);
            border-radius: 6px; cursor: pointer;
            font: 600 12px/1.2 inherit;
        }
        html.rumblex-active .rx-bulk-unsub-bar button:hover {
            background: var(--rx-surface2, #3a4f2a);
        }
        html.rumblex-active .rx-bulk-unsub-bar button[disabled] {
            opacity: 0.5; cursor: not-allowed;
        }
        html.rumblex-active .rx-bu-row-check {
            margin-right: 8px;
            width: 18px; height: 18px;
            accent-color: var(--rx-accent, #85c742);
            vertical-align: middle;
        }
        html.rumblex-active .rx-bu-dry-tag {
            display: inline-block; padding: 2px 6px;
            background: rgba(212, 168, 67, 0.18);
            color: #d4a843;
            border-radius: 4px;
            font: 700 10px/1 inherit;
            text-transform: uppercase; letter-spacing: 0.4px;
        }
    `,

    _onAccountFollowing() {
        return location.pathname === '/followed-channels'
            || location.pathname.startsWith('/account/following');
    },
    _onAccountRecurring() {
        return location.pathname === '/account/recurring-subs'
            || location.pathname.startsWith('/account/subscriptions');
    },
    _shouldMount() {
        return this._onAccountFollowing() || this._onAccountRecurring();
    },

    // Finds every native action button on the current page. We attach a
    // checkbox to each enclosing row so the user can include/exclude per
    // entry before running. Returns array of { btn, check, row, label }.
    _scanRows() {
        const rows = [];
        const onFollowing = this._onAccountFollowing();
        const buttons = onFollowing
            ? Selectors.findAll('account.followedChannelsUnsubBtn')
            : Selectors.findAll('account.recurringSubsCancelBtn');
        for (const btn of buttons) {
            // The "row" we associate is the nearest TR (for recurring subs
            // table) or LI/article (for following grid). Falls back to
            // the button's grandparent.
            const row = btn.closest('tr, li, article, .following-row, [class*="subscription"]') || btn.parentElement?.parentElement || btn.parentElement;
            // Best-effort label — pulls the visible channel/title text from
            // the row so the bar's "Select all (N)" message means something.
            const label = (row?.querySelector('a, .channel__link, .channel-name, h3, td')?.textContent || '').trim().slice(0, 60);
            // Mount a checkbox once per button. Default-unchecked so the
            // user always opts in per row before running.
            let check = row?.querySelector('input.rx-bu-row-check');
            if (!check && row) {
                check = document.createElement('input');
                check.type = 'checkbox';
                check.className = 'rx-bu-row-check';
                check.title = 'Select for bulk unsubscribe';
                row.insertBefore(check, row.firstChild);
            }
            if (check) rows.push({ btn, check, row, label });
        }
        return rows;
    },

    _updateCount() {
        const rows = this._scanRows();
        const checked = rows.filter((r) => r.check?.checked).length;
        const countEl = this._bar?.querySelector('.rx-bu-count');
        if (countEl) countEl.textContent = `${checked} / ${rows.length} selected`;
        return { rows, checked };
    },

    async _run() {
        const { rows } = this._updateCount();
        const selected = rows.filter((r) => r.check?.checked);
        if (selected.length === 0) {
            RxToast.show('Select at least one row first');
            return;
        }
        const dryRun = Settings.get('bulkUnsubscribeDryRun') !== false; // default ON
        if (dryRun) {
            RxToast.show(`Dry-run: would unsubscribe from ${selected.length} channel${selected.length === 1 ? '' : 's'}. Turn bulkUnsubscribeDryRun OFF in Settings to run for real.`);
            return;
        }
        // Disable the Run button + show progress in the count slot.
        const runBtn = this._bar?.querySelector('[data-act="run"]');
        const stopBtn = this._bar?.querySelector('[data-act="stop"]');
        if (runBtn) runBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        this._aborter = { aborted: false };
        let done = 0;
        for (const { btn, check, label } of selected) {
            if (this._aborter.aborted) break;
            try {
                btn.click();
                done++;
                const countEl = this._bar?.querySelector('.rx-bu-count');
                if (countEl) countEl.textContent = `Running: ${done} / ${selected.length}`;
                // Uncheck the row so a re-run doesn't double-process it.
                if (check) check.checked = false;
            } catch (e) {
                console.warn('[RumbleX] BulkUnsubscribe row failed:', label, e);
            }
            // 350ms inter-click pacing so htmx doesn't pile up requests.
            await new Promise((r) => setTimeout(r, 350));
        }
        if (runBtn) runBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        RxToast.show(this._aborter.aborted
            ? `Stopped after ${done} unsub${done === 1 ? '' : 's'}.`
            : `Done: unsubscribed from ${done} channel${done === 1 ? '' : 's'}.`);
        this._updateCount();
    },

    _build() {
        const bar = document.createElement('div');
        bar.className = 'rx-bulk-unsub-bar';
        const label = document.createElement('span');
        label.className = 'rx-bu-label';
        label.innerHTML = '';
        const title = document.createElement('strong');
        title.textContent = 'Bulk unsubscribe — ';
        const count = document.createElement('span');
        count.className = 'rx-bu-count';
        count.textContent = '0 / 0 selected';
        label.appendChild(title);
        label.appendChild(count);
        // Dry-run tag — visible UI hint that nothing will happen on Run
        // until the user flips the setting.
        if (Settings.get('bulkUnsubscribeDryRun') !== false) {
            const tag = document.createElement('span');
            tag.className = 'rx-bu-dry-tag';
            tag.textContent = 'DRY-RUN';
            tag.title = 'bulkUnsubscribeDryRun is ON — Run will count, not click. Disable in Settings → Automation.';
            label.appendChild(document.createTextNode(' '));
            label.appendChild(tag);
        }
        bar.appendChild(label);

        const mkBtn = (text, act, disabled = false) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = text;
            b.dataset.act = act;
            if (disabled) b.disabled = true;
            return b;
        };
        const selectAll = mkBtn('Select all', 'all');
        const clearAll = mkBtn('Clear', 'clear');
        const run = mkBtn('Run', 'run');
        const stop = mkBtn('Stop', 'stop', true);
        selectAll.addEventListener('click', () => {
            for (const { check } of this._scanRows()) check.checked = true;
            this._updateCount();
        });
        clearAll.addEventListener('click', () => {
            for (const { check } of this._scanRows()) check.checked = false;
            this._updateCount();
        });
        run.addEventListener('click', () => void this._run());
        stop.addEventListener('click', () => {
            if (this._aborter) this._aborter.aborted = true;
        });
        bar.appendChild(selectAll);
        bar.appendChild(clearAll);
        bar.appendChild(run);
        bar.appendChild(stop);

        // Watch each checkbox so the count stays live.
        bar.addEventListener('change', (e) => {
            if (e.target?.classList?.contains('rx-bu-row-check')) this._updateCount();
        });
        return bar;
    },

    _mount() {
        if (!this._shouldMount()) return;
        if (this._bar?.isConnected) return;
        // Find a reasonable mount host. Recurring subs has a table; following
        // has a section. We attach the bar at the top of <main> as a safe
        // fallback that's always present after page paint.
        const host = qs('main') || qs('.main-content') || document.body;
        if (!host) return;
        if (!this._bar) this._bar = this._build();
        // Ensure all rows have their checkboxes mounted on first paint.
        this._scanRows();
        host.insertBefore(this._bar, host.firstChild);
        this._updateCount();
    },

    _unmount() {
        this._bar?.remove();
        this._bar = null;
        for (const el of qsa('.rx-bu-row-check')) el.remove();
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isAccount()) return;
        this._styleEl = injectStyle(this._css, 'rx-bulk-unsub-css');
        this._mount();
        // Account pages can change between subsections without a full
        // reload (Rumble uses htmx). Re-evaluate on every route tick.
        this._routerUnsub = Router.onChange(() => {
            if (this._shouldMount()) this._mount();
            else this._unmount();
        });
    },

    destroy() {
        this._aborter && (this._aborter.aborted = true);
        this._unmount();
        this._styleEl?.remove();
        this._styleEl = null;
        if (typeof this._routerUnsub === 'function') {
            try { this._routerUnsub(); } catch {}
            this._routerUnsub = null;
        }
    },
};

// ═══════════════════════════════════════════
//  FEATURE: Search History
// ═══════════════════════════════════════════
const SearchHistory = {
    id: 'searchHistory',
    name: 'Search History',
    _KEY: 'rx_search_history',
    _MAX: 100,
    _dropdown: null,
    _input: null,
    _focusHandler: null,
    _inputHandler: null,

    _css: `
        .rx-search-dropdown {
            position: absolute;
            top: 100%; left: 0; right: 0;
            background: #1e1e2e;
            border: 1px solid #45475a;
            border-top: none;
            border-radius: 0 0 8px 8px;
            z-index: 100001;
            max-height: 320px;
            overflow-y: auto;
            display: none;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .rx-search-dropdown.show { display: block; }
        .rx-search-dropdown-item {
            /* Real <button> for keyboard operability; reset the UA chrome so it
               still renders as the row it always looked like. */
            appearance: none; background: none; border: 0; text-align: left; font: inherit;
            width: 100%;
            padding: 8px 14px;
            cursor: pointer;
            font-size: 13px;
            color: #cdd6f4;
            display: flex;
            align-items: center;
            gap: 8px;
            border-bottom: 1px solid #313244;
        }
        .rx-search-dropdown-item:focus-visible,
        .rx-search-dropdown-item .remove:focus-visible {
            outline: 2px solid #89b4fa; outline-offset: -2px;
        }
        /* The delete control must stay reachable by keyboard even though it is
           only revealed on hover for pointer users. */
        .rx-search-dropdown-item .remove:focus-visible { opacity: 1; }
        .rx-search-dropdown-item:hover { background: #313244; }
        .rx-search-dropdown-item svg { width: 14px; height: 14px; fill: #6c7086; flex-shrink: 0; }
        .rx-search-dropdown-item .text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .rx-search-dropdown-item .remove {
            appearance: none; background: none; border: 0; font: inherit; line-height: 1;
            color: #6c7086; font-size: 16px; cursor: pointer; padding: 0 4px;
            opacity: 0; transition: opacity 0.15s;
        }
        .rx-search-dropdown-item:hover .remove { opacity: 1; }
        .rx-search-dropdown-item .remove:hover { color: #f38ba8; }
        .rx-search-dropdown-header {
            padding: 6px 14px; font-size: 11px; color: #6c7086;
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid #313244;
        }
        .rx-search-dropdown-header button {
            background: none; border: none; color: #f38ba8; cursor: pointer;
            font-size: 11px; padding: 0;
        }
        .rx-search-dropdown-header button:hover { text-decoration: underline; }
    `,

    _getHistory() {
        try { return JSON.parse(localStorage.getItem(this._KEY) || '[]'); }
        catch { return []; }
    },

    _saveHistory(entries) {
        localStorage.setItem(this._KEY, JSON.stringify(entries.slice(0, this._MAX)));
    },

    _recordSearch(query) {
        const q = query.trim();
        if (!q) return;
        const history = this._getHistory().filter(e => e !== q);
        history.unshift(q);
        this._saveHistory(history);
    },

    _showDropdown(filter = '') {
        if (!this._dropdown) return;
        const history = this._getHistory();
        const filtered = filter
            ? history.filter(q => q.toLowerCase().includes(filter.toLowerCase()))
            : history;

        this._dropdown.innerHTML = '';
        if (!filtered.length) {
            this._dropdown.classList.remove('show');
            return;
        }

        const header = document.createElement('div');
        header.className = 'rx-search-dropdown-header';
        header.innerHTML = '<span>Recent searches</span>';
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear all';
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            localStorage.removeItem(this._KEY);
            this._dropdown.classList.remove('show');
        });
        header.appendChild(clearBtn);
        this._dropdown.appendChild(header);

        for (const q of filtered.slice(0, 15)) {
            // Both the row and its delete control are real buttons. They used
            // to be a <div> and a <span> carrying click handlers, so neither was
            // reachable or operable from the keyboard at all.
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'rx-search-dropdown-item';
            item.setAttribute('aria-label', 'Search again for ' + q);
            item.innerHTML = `<svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18z"/></svg>`;
            const text = document.createElement('span');
            text.className = 'text';
            text.textContent = q;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'remove';
            remove.textContent = '×';
            remove.setAttribute('aria-label', 'Remove ' + q + ' from search history');
            remove.addEventListener('click', (e) => {
                e.stopPropagation();
                this._saveHistory(this._getHistory().filter(x => x !== q));
                item.remove();
                if (!this._dropdown.querySelector('.rx-search-dropdown-item')) {
                    this._dropdown.classList.remove('show');
                }
            });
            item.appendChild(text);
            item.appendChild(remove);
            item.addEventListener('click', () => {
                if (this._input) this._input.value = q;
                this._dropdown.classList.remove('show');
                // Submit the search
                const form = this._input?.closest('form');
                if (form) form.submit();
                else location.href = `/search/video?q=${encodeURIComponent(q)}`;
            });
            this._dropdown.appendChild(item);
        }
        this._dropdown.classList.add('show');
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-search-history-css');

        // Record searches from search page
        if (Page.isSearch()) {
            const params = new URLSearchParams(location.search);
            const q = params.get('q');
            if (q) this._recordSearch(q);
        }

        // Attach to search input
        waitForFeature(this, 'input[name="q"], input[type="search"], .search-input input, #search-input').then(input => {
            this._input = input;
            const wrapper = input.closest('form') || input.parentElement;
            if (!wrapper) return;
            wrapper.style.position = wrapper.style.position || 'relative';

            this._dropdown = document.createElement('div');
            this._dropdown.className = 'rx-search-dropdown';
            wrapper.appendChild(this._dropdown);

            this._focusHandler = () => this._showDropdown(input.value);
            this._inputHandler = () => this._showDropdown(input.value);
            input.addEventListener('focus', this._focusHandler);
            input.addEventListener('input', this._inputHandler);
            // Store the bound handler so destroy() can actually remove it.
            // Previously this was anonymous and leaked forever after the
            // feature was disabled, holding references to `wrapper` + `_dropdown`.
            this._outsideClickHandler = (e) => {
                if (this._dropdown && !wrapper.contains(e.target)) {
                    this._dropdown.classList.remove('show');
                }
            };
            document.addEventListener('click', this._outsideClickHandler);

            // Record on form submit
            const form = input.closest('form');
            if (form) {
                this._formSubmitHandler = () => this._recordSearch(input.value);
                form.addEventListener('submit', this._formSubmitHandler);
                this._boundForm = form;
            }
        }).catch(() => {});
    },

    destroy() {
        if (this._input && this._focusHandler) this._input.removeEventListener('focus', this._focusHandler);
        if (this._input && this._inputHandler) this._input.removeEventListener('input', this._inputHandler);
        this._focusHandler = null;
        this._inputHandler = null;
        if (this._outsideClickHandler) {
            document.removeEventListener('click', this._outsideClickHandler);
            this._outsideClickHandler = null;
        }
        if (this._boundForm && this._formSubmitHandler) {
            this._boundForm.removeEventListener('submit', this._formSubmitHandler);
        }
        this._boundForm = null;
        this._formSubmitHandler = null;
        this._styleEl?.remove();
        this._dropdown?.remove();
        this._dropdown = null;
        this._input = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Mini Player
// ═══════════════════════════════════════════
const MiniPlayer = {
    id: 'miniPlayer',
    name: 'Mini Player',
    _mini: null,
    _obs: null,
    _active: false,
    _dragState: null,

    _css: `
        .rx-miniplayer {
            position: fixed;
            bottom: 24px; right: 24px;
            width: 400px; height: 225px;
            z-index: 9998;
            background: #11111b;
            border: 1px solid #45475a;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            display: none;
            cursor: move;
            transition: box-shadow 0.2s;
        }
        .rx-miniplayer:hover { box-shadow: 0 16px 48px rgba(0,0,0,0.8); }
        .rx-miniplayer.active { display: block; }
        .rx-miniplayer video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain;
        }
        .rx-miniplayer-bar {
            position: absolute; top: 0; left: 0; right: 0;
            display: flex; justify-content: space-between; align-items: center;
            padding: 6px 10px;
            background: linear-gradient(to bottom, rgba(17,17,27,0.85), transparent);
            opacity: 0; transition: opacity 0.2s;
            z-index: 2;
        }
        .rx-miniplayer:hover .rx-miniplayer-bar { opacity: 1; }
        .rx-miniplayer-title {
            color: #cdd6f4; font: 600 11px/1.3 system-ui, sans-serif;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            max-width: 300px;
        }
        .rx-miniplayer-close {
            background: rgba(243,139,168,0.2); border: none; color: #f38ba8;
            border-radius: 4px; cursor: pointer; font-size: 14px; padding: 2px 6px;
            line-height: 1;
        }
        .rx-miniplayer-close:hover { background: rgba(243,139,168,0.4); }
    `,

    _show(video) {
        if (this._active || !video) return;
        const clone = video.cloneNode(false);
        clone.muted = false;
        clone.currentTime = video.currentTime;
        clone.playbackRate = video.playbackRate;
        clone.autoplay = true;

        // Sync from original to clone
        this._syncFrom = video;
        this._syncClone = clone;
        const syncTime = () => {
            if (!this._active) return;
            if (Math.abs(video.currentTime - clone.currentTime) > 1) {
                clone.currentTime = video.currentTime;
            }
            requestAnimationFrame(syncTime);
        };

        const title = qs('.video-header-container__title, h1')?.textContent?.trim() || '';
        this._mini.innerHTML = '';
        const bar = document.createElement('div');
        bar.className = 'rx-miniplayer-bar';
        const titleEl = document.createElement('span');
        titleEl.className = 'rx-miniplayer-title';
        titleEl.textContent = title;
        bar.appendChild(titleEl);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'rx-miniplayer-close';
        closeBtn.textContent = '\u00d7';
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this._hide(); });
        bar.appendChild(closeBtn);

        this._mini.appendChild(bar);
        this._mini.appendChild(clone);
        this._mini.classList.add('active');
        this._active = true;

        // Pause original, play clone
        video.pause();
        clone.play().catch(() => {});
        syncTime();
    },

    _hide() {
        if (!this._active) return;
        this._active = false;
        this._mini.classList.remove('active');

        // Resume original video
        const video = qs('video');
        if (video && this._syncClone) {
            video.currentTime = this._syncClone.currentTime;
            video.play().catch(() => {});
        }
        this._mini.innerHTML = '';
        this._syncClone = null;
    },


    _initDrag() {
        // Store bound handlers so destroy() can actually remove them.
        this._dragMousedown = (e) => {
            if (e.target.closest('.rx-miniplayer-close')) return;
            this._dragState = {
                x: e.clientX - this._mini.offsetLeft,
                y: e.clientY - this._mini.offsetTop,
            };
            e.preventDefault();
        };
        this._dragMousemove = (e) => {
            if (!this._dragState || !this._mini) return;
            const x = Math.max(0, Math.min(window.innerWidth - this._mini.offsetWidth, e.clientX - this._dragState.x));
            const y = Math.max(0, Math.min(window.innerHeight - this._mini.offsetHeight, e.clientY - this._dragState.y));
            this._mini.style.left = x + 'px';
            this._mini.style.top = y + 'px';
            this._mini.style.right = 'auto';
            this._mini.style.bottom = 'auto';
        };
        this._dragMouseup = () => { this._dragState = null; };
        this._mini.addEventListener('mousedown', this._dragMousedown);
        document.addEventListener('mousemove', this._dragMousemove);
        document.addEventListener('mouseup', this._dragMouseup);
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-miniplayer-css');

        this._mini = document.createElement('div');
        this._mini.className = 'rx-miniplayer';
        document.body.appendChild(this._mini);
        this._initDrag();

        // Watch for video scrolling out of viewport
        waitForFeature(this, '#videoPlayer, .videoPlayer-Rumble-cls, video').then(playerEl => {
            // Don't observe if TheaterSplit is active — player is always fullscreen
            if (TheaterSplit._isActive) return;
            this._obs = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (TheaterSplit._isActive) return;
                    if (!entry.isIntersecting) {
                        const video = qs('video');
                        if (video && !video.paused && !video.ended) {
                            this._show(video);
                        }
                    } else {
                        this._hide();
                    }
                }
            }, { threshold: 0.3 });
            this._obs.observe(playerEl);
        }).catch(() => {});
    },

    destroy() {
        this._hide();
        if (this._mini && this._dragMousedown) this._mini.removeEventListener('mousedown', this._dragMousedown);
        if (this._dragMousemove) document.removeEventListener('mousemove', this._dragMousemove);
        if (this._dragMouseup) document.removeEventListener('mouseup', this._dragMouseup);
        this._dragMousemove = this._dragMouseup = this._dragMousedown = null;
        this._dragState = null;
        this._styleEl?.remove();
        this._mini?.remove();
        this._mini = null;
        this._obs?.disconnect();
        this._obs = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Video Stats
// ═══════════════════════════════════════════
const VideoStats = {
    id: 'videoStats',
    name: 'Video Stats',
    _overlay: null,
    _interval: null,
    _visible: false,

    _css: `
        .rx-stats-btn {
            position: absolute;
            top: 10px; right: 10px;
            z-index: 100;
            background: rgba(17,17,27,0.75);
            border: 1px solid rgba(205,214,244,0.2);
            color: #cdd6f4;
            border-radius: 6px;
            padding: 6px 10px;
            cursor: pointer;
            font: 700 11px/1 system-ui, sans-serif;
            opacity: 0; transition: opacity 0.2s;
            pointer-events: auto;
        }
        .videoPlayer-Rumble-cls:hover .rx-stats-btn,
        #videoPlayer:hover .rx-stats-btn { opacity: 1; }
        .rx-stats-btn:hover { background: rgba(17,17,27,0.9); border-color: #89b4fa; }
        .rx-stats-overlay {
            position: absolute;
            top: 44px; right: 10px;
            z-index: 100;
            background: rgba(17,17,27,0.88);
            border: 1px solid #45475a;
            border-radius: 8px;
            padding: 12px 16px;
            color: #cdd6f4;
            font: 11px/1.6 'Courier New', monospace;
            pointer-events: none;
            min-width: 260px;
            display: none;
        }
        .rx-stats-overlay.show { display: block; }
        .rx-stats-overlay .label { color: #89b4fa; }
        .rx-stats-overlay .val { color: #a6e3a1; }
        .rx-stats-overlay .warn { color: #f9e2af; }
        .rx-stats-overlay .bad { color: #f38ba8; }
    `,

    _formatBytes(b) {
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1048576).toFixed(2) + ' MB';
    },

    _update() {
        const video = qs('video');
        if (!video || !this._overlay) return;

        const w = video.videoWidth || 0;
        const h = video.videoHeight || 0;
        const res = w && h ? `${w}x${h}` : 'N/A';
        const dur = video.duration ? video.duration.toFixed(1) + 's' : 'N/A';
        const cur = video.currentTime.toFixed(1) + 's';
        const vol = Math.round(video.volume * 100) + '%';
        const rate = video.playbackRate + 'x';
        const paused = video.paused ? 'Yes' : 'No';
        const loop = video.loop ? 'Yes' : 'No';
        const net = ['EMPTY', 'IDLE', 'LOADING', 'LOADED'][video.networkState] || video.networkState;
        const ready = ['NOTHING', 'METADATA', 'CURRENT', 'FUTURE', 'ENOUGH'][video.readyState] || video.readyState;

        // Buffer info
        let buffered = '0s';
        if (video.buffered.length > 0) {
            const end = video.buffered.end(video.buffered.length - 1);
            buffered = (end - video.currentTime).toFixed(1) + 's ahead';
        }

        // Dropped frames (Chrome only)
        const quality = video.getVideoPlaybackQuality?.();
        let frames = 'N/A';
        let frameClass = 'val';
        if (quality) {
            const dropped = quality.droppedVideoFrames;
            const total = quality.totalVideoFrames;
            frames = `${dropped}/${total}`;
            if (dropped > total * 0.05) frameClass = 'bad';
            else if (dropped > 0) frameClass = 'warn';
        }

        // Current src
        const src = video.currentSrc || video.src || 'N/A';
        const srcShort = src.length > 50 ? '...' + src.slice(-47) : src;

        this._overlay.innerHTML = `
            <span class="label">Resolution:</span> <span class="val">${res}</span><br>
            <span class="label">Duration:</span> <span class="val">${dur}</span> | <span class="label">Position:</span> <span class="val">${cur}</span><br>
            <span class="label">Speed:</span> <span class="val">${rate}</span> | <span class="label">Volume:</span> <span class="val">${vol}</span><br>
            <span class="label">Paused:</span> <span class="val">${paused}</span> | <span class="label">Loop:</span> <span class="val">${loop}</span><br>
            <span class="label">Network:</span> <span class="val">${net}</span> | <span class="label">Ready:</span> <span class="val">${ready}</span><br>
            <span class="label">Buffer:</span> <span class="val">${buffered}</span><br>
            <span class="label">Frames (drop/total):</span> <span class="${frameClass}">${frames}</span><br>
            <span class="label">Source:</span> <span class="val" style="font-size:9px">${rxEscapeHtml(srcShort)}</span>
        `;
    },


    _toggle() {
        this._visible = !this._visible;
        if (this._visible) {
            this._overlay.classList.add('show');
            this._interval = setInterval(() => this._update(), 500);
            this._update();
        } else {
            this._overlay.classList.remove('show');
            clearInterval(this._interval);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch() && !Page.isEmbed()) return;
        this._styleEl = injectStyle(this._css, 'rx-stats-css');

        waitForFeature(this, '#videoPlayer, .videoPlayer-Rumble-cls').then(container => {
            container.style.position = container.style.position || 'relative';

            const btn = document.createElement('button');
            btn.className = 'rx-stats-btn';
            btn.textContent = 'Stats';
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._toggle(); });
            container.appendChild(btn);
            this._btn = btn;

            this._overlay = document.createElement('div');
            this._overlay.className = 'rx-stats-overlay';
            container.appendChild(this._overlay);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
        this._overlay?.remove();
        clearInterval(this._interval);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Loop Control
// ═══════════════════════════════════════════
const LoopControl = {
    id: 'loopControl',
    name: 'Loop Control',
    _btn: null,
    _abBar: null,
    _loopA: null,
    _loopB: null,
    _looping: false,
    _fullLoop: false,
    _checkInterval: null,

    _css: `
        .rx-loop-btn {
            position: absolute;
            bottom: 52px; right: 10px;
            z-index: 100;
            background: rgba(17,17,27,0.75);
            border: 1px solid rgba(205,214,244,0.2);
            color: #cdd6f4;
            border-radius: 6px;
            padding: 5px 10px;
            cursor: pointer;
            font: 700 11px/1 system-ui, sans-serif;
            opacity: 0; transition: opacity 0.2s;
            pointer-events: auto;
            display: flex; align-items: center; gap: 6px;
        }
        .videoPlayer-Rumble-cls:hover .rx-loop-btn,
        #videoPlayer:hover .rx-loop-btn { opacity: 1; }
        .rx-loop-btn:hover { background: rgba(17,17,27,0.9); border-color: #89b4fa; }
        .rx-loop-btn.active { border-color: #a6e3a1; color: #a6e3a1; }
        .rx-loop-btn svg { width: 14px; height: 14px; fill: currentColor; }
        .rx-loop-ab-bar {
            position: absolute;
            bottom: 78px; right: 10px;
            z-index: 100;
            background: rgba(17,17,27,0.85);
            border: 1px solid #45475a;
            border-radius: 6px;
            padding: 6px 10px;
            display: none;
            gap: 6px; align-items: center;
            font: 600 11px/1 system-ui, sans-serif;
            color: #cdd6f4;
        }
        .rx-loop-ab-bar.show { display: flex; }
        .rx-loop-ab-bar button {
            background: #313244; border: 1px solid #45475a; color: #cdd6f4;
            border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 11px;
        }
        .rx-loop-ab-bar button:hover { border-color: #89b4fa; }
        .rx-loop-ab-bar button.set { border-color: #a6e3a1; color: #a6e3a1; }
        .rx-loop-ab-bar .info { color: #6c7086; font-size: 10px; }
    `,

    _formatTime(s) {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    },

    _toggleLoop() {
        const video = qs('video');
        if (!video) return;

        if (this._looping) {
            // Clear AB loop
            this._loopA = null;
            this._loopB = null;
            this._looping = false;
            clearInterval(this._checkInterval);
            this._abBar?.classList.remove('show');
            this._btn.classList.remove('active');
            this._btn.classList.add('active');
            // Switch to full loop
            this._fullLoop = !this._fullLoop;
            video.loop = this._fullLoop;
            if (!this._fullLoop) this._btn.classList.remove('active');
            return;
        }

        if (this._fullLoop) {
            // Turn off full loop
            this._fullLoop = false;
            video.loop = false;
            this._btn.classList.remove('active');
            return;
        }

        // Start full loop
        this._fullLoop = true;
        video.loop = true;
        this._btn.classList.add('active');
    },

    _startABMode() {
        this._abBar?.classList.add('show');
    },

    _setA() {
        const video = qs('video');
        if (!video) return;
        this._loopA = video.currentTime;
        this._updateABBar();
        if (this._loopA !== null && this._loopB !== null) this._activateAB();
    },

    _setB() {
        const video = qs('video');
        if (!video) return;
        this._loopB = video.currentTime;
        this._updateABBar();
        if (this._loopA !== null && this._loopB !== null) this._activateAB();
    },

    _activateAB() {
        if (this._loopA >= this._loopB) {
            [this._loopA, this._loopB] = [this._loopB, this._loopA];
        }
        this._looping = true;
        this._fullLoop = false;
        const video = qs('video');
        if (video) video.loop = false;
        this._btn.classList.add('active');

        clearInterval(this._checkInterval);
        this._checkInterval = setInterval(() => {
            const v = qs('video');
            if (!v || !this._looping) return;
            if (v.currentTime >= this._loopB || v.currentTime < this._loopA) {
                v.currentTime = this._loopA;
            }
        }, 100);
        this._updateABBar();
    },

    _clearAB() {
        this._loopA = null;
        this._loopB = null;
        this._looping = false;
        clearInterval(this._checkInterval);
        this._abBar?.classList.remove('show');
        this._btn.classList.remove('active');
    },

    _updateABBar() {
        if (!this._abBar) return;
        const aBtn = this._abBar.querySelector('.rx-ab-a');
        const bBtn = this._abBar.querySelector('.rx-ab-b');
        const info = this._abBar.querySelector('.info');
        if (aBtn) aBtn.classList.toggle('set', this._loopA !== null);
        if (bBtn) bBtn.classList.toggle('set', this._loopB !== null);
        if (info) {
            const a = this._loopA !== null ? this._formatTime(this._loopA) : '--:--';
            const b = this._loopB !== null ? this._formatTime(this._loopB) : '--:--';
            info.textContent = `${a} - ${b}`;
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch() && !Page.isEmbed()) return;
        this._styleEl = injectStyle(this._css, 'rx-loop-css');

        waitForFeature(this, '#videoPlayer, .videoPlayer-Rumble-cls').then(container => {
            container.style.position = container.style.position || 'relative';

            // Main loop button
            const btn = document.createElement('button');
            btn.className = 'rx-loop-btn';
            btn.title = 'Click: toggle loop | Right-click: A-B loop';
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>Loop`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._toggleLoop(); });
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault(); e.stopPropagation();
                this._startABMode();
            });
            container.appendChild(btn);
            this._btn = btn;

            // AB loop bar
            const abBar = document.createElement('div');
            abBar.className = 'rx-loop-ab-bar';
            const aBtn = document.createElement('button');
            aBtn.className = 'rx-ab-a';
            aBtn.textContent = 'Set A';
            aBtn.addEventListener('click', (e) => { e.stopPropagation(); this._setA(); });
            const bBtn = document.createElement('button');
            bBtn.className = 'rx-ab-b';
            bBtn.textContent = 'Set B';
            bBtn.addEventListener('click', (e) => { e.stopPropagation(); this._setB(); });
            const info = document.createElement('span');
            info.className = 'info';
            info.textContent = '--:-- - --:--';
            const clearBtn = document.createElement('button');
            clearBtn.textContent = 'Clear';
            clearBtn.addEventListener('click', (e) => { e.stopPropagation(); this._clearAB(); });

            abBar.appendChild(aBtn);
            abBar.appendChild(bBtn);
            abBar.appendChild(info);
            abBar.appendChild(clearBtn);
            container.appendChild(abBar);
            this._abBar = abBar;
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
        this._abBar?.remove();
        clearInterval(this._checkInterval);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Cinema Mode
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  FEATURE: Quick Bookmark
// ═══════════════════════════════════════════
const QuickBookmark = {
    id: 'quickBookmark',
    name: 'Quick Bookmark',
    _KEY: 'rx_bookmarks',
    _MAX: 200,
    _btn: null,
    _viewWrapper: null,

    _css: `
        .rx-bookmark-btn {
            display: inline-flex; align-items: center; gap: 4px;
            background: #313244; border: 1px solid #45475a;
            color: #cdd6f4; border-radius: 6px;
            padding: 5px 12px; cursor: pointer;
            font: 600 12px/1.4 system-ui, sans-serif;
            transition: all 0.2s;
            margin-left: 8px;
        }
        .rx-bookmark-btn:hover { border-color: #89b4fa; background: #45475a; }
        .rx-bookmark-btn.saved { border-color: #f9e2af; color: #f9e2af; }
        .rx-bookmark-btn svg { width: 14px; height: 14px; fill: currentColor; }
        .rx-bookmarks-overlay {
            position: fixed; inset: 0; z-index: 100000;
            background: rgba(0,0,0,0.7); display: flex;
            justify-content: center; align-items: flex-start;
            padding: 40px 20px; overflow-y: auto;
        }
        .rx-bookmarks-panel {
            background: #1e1e2e; border: 1px solid #45475a;
            border-radius: 12px; max-width: 800px; width: 100%;
            padding: 24px; color: #cdd6f4;
            font-family: system-ui, sans-serif;
            max-height: calc(100vh - 80px); overflow-y: auto;
        }
        .rx-bookmarks-panel h2 { margin: 0 0 16px; font-size: 20px; color: #f9e2af; }
        .rx-bookmarks-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .rx-bookmarks-close { background: none; border: none; color: #6c7086; font-size: 24px; cursor: pointer; }
        .rx-bookmarks-close:hover { color: #cdd6f4; }
        .rx-bookmark-item {
            display: flex; gap: 12px; padding: 10px;
            border-radius: 8px; transition: background 0.15s;
            border-bottom: 1px solid #313244;
            align-items: center;
        }
        .rx-bookmark-item:hover { background: #313244; }
        .rx-bookmark-item img { width: 140px; height: 79px; object-fit: cover; border-radius: 6px; background: #313244; flex-shrink: 0; }
        .rx-bookmark-item .meta { flex: 1; min-width: 0; }
        .rx-bookmark-item .meta a {
            font-weight: 600; font-size: 14px; color: #cdd6f4;
            text-decoration: none; display: block;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .rx-bookmark-item .meta a:hover { color: #89b4fa; }
        .rx-bookmark-item .meta .channel { color: #a6adc8; font-size: 12px; margin-top: 2px; }
        .rx-bookmark-item .meta .date { color: #6c7086; font-size: 11px; margin-top: 2px; }
        .rx-bookmark-item .remove-bm {
            background: none; border: none; color: #6c7086; font-size: 18px;
            cursor: pointer; padding: 4px 8px; flex-shrink: 0;
        }
        .rx-bookmark-item .remove-bm:hover { color: #f38ba8; }
        .rx-bookmarks-empty { text-align: center; color: #6c7086; padding: 40px 0; }
        .rx-bookmarks-viewall {
            background: #313244; color: #cdd6f4; border: 1px solid #45475a;
            border-radius: 6px; padding: 5px 12px; cursor: pointer;
            font: 600 12px/1.4 system-ui, sans-serif;
        }
        .rx-bookmarks-viewall:hover { border-color: #f9e2af; }
    `,

    _getBookmarks() {
        try { return JSON.parse(localStorage.getItem(this._KEY) || '[]'); }
        catch { return []; }
    },

    _saveBookmarks(bm) {
        localStorage.setItem(this._KEY, JSON.stringify(bm.slice(0, this._MAX)));
    },

    _isBookmarked(url) {
        return this._getBookmarks().some(b => b.url === url);
    },

    _toggleBookmark() {
        const url = location.href;
        let bookmarks = this._getBookmarks();
        if (this._isBookmarked(url)) {
            bookmarks = bookmarks.filter(b => b.url !== url);
            this._saveBookmarks(bookmarks);
            this._btn?.classList.remove('saved');
        } else {
            const title = qs('.video-header-container__title, h1')?.textContent?.trim() || document.title;
            const channel = qs('.media-heading-name, .media-by--a')?.textContent?.trim() || '';
            const thumb = qs('meta[property="og:image"]')?.content || '';
            bookmarks.unshift({ url, title, channel, thumb, time: Date.now() });
            this._saveBookmarks(bookmarks);
            this._btn?.classList.add('saved');
        }
    },


    _safeHttpUrl(url) {
        try {
            const parsed = new URL(String(url || ''), location.origin);
            return /^https?:$/.test(parsed.protocol) ? parsed.href : '';
        } catch {
            return '';
        }
    },

    _safeRumbleUrl(url) {
        const safe = this._safeHttpUrl(url);
        if (!safe) return '#';
        const host = new URL(safe).hostname;
        return host === 'rumble.com' || host.endsWith('.rumble.com') ? safe : '#';
    },

    _timeAgo(date) {
        const s = Math.floor((Date.now() - date) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return `${Math.floor(s/60)}m ago`;
        if (s < 86400) return `${Math.floor(s/3600)}h ago`;
        if (s < 604800) return `${Math.floor(s/86400)}d ago`;
        return new Date(date).toLocaleDateString();
    },

    _showOverlay() {
        if (qs('.rx-bookmarks-overlay')) return;
        const bookmarks = this._getBookmarks();
        const overlay = document.createElement('div');
        overlay.className = 'rx-bookmarks-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Bookmarks');
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        const panel = document.createElement('div');
        panel.className = 'rx-bookmarks-panel';

        const header = document.createElement('div');
        header.className = 'rx-bookmarks-header';
        const heading = document.createElement('h2');
        heading.textContent = `Bookmarks (${bookmarks.length})`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'rx-bookmarks-close';
        closeBtn.textContent = '\u00d7';
        closeBtn.addEventListener('click', () => overlay.remove());
        header.appendChild(heading);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        const appendEmpty = (text) => {
            const empty = document.createElement('div');
            empty.className = 'rx-bookmarks-empty';
            empty.textContent = text;
            panel.appendChild(empty);
        };

        if (!bookmarks.length) {
            appendEmpty('No bookmarks yet. Click the bookmark icon on any video to save it.');
        } else {
            for (const bm of bookmarks) {
                const item = document.createElement('div');
                item.className = 'rx-bookmark-item';
                const thumbUrl = this._safeHttpUrl(bm.thumb);
                if (thumbUrl) {
                    const img = document.createElement('img');
                    img.src = thumbUrl;
                    img.loading = 'lazy';
                    img.alt = '';
                    item.appendChild(img);
                }
                const meta = document.createElement('div');
                meta.className = 'meta';
                const link = document.createElement('a');
                link.href = this._safeRumbleUrl(bm.url);
                link.textContent = bm.title || '';
                const channel = document.createElement('div');
                channel.className = 'channel';
                channel.textContent = bm.channel || '';
                const date = document.createElement('div');
                date.className = 'date';
                date.textContent = this._timeAgo(bm.time);
                meta.append(link, channel, date);
                item.appendChild(meta);
                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-bm';
                removeBtn.textContent = '\u00d7';
                removeBtn.addEventListener('click', () => {
                    const updated = this._getBookmarks().filter(b => b.url !== bm.url);
                    this._saveBookmarks(updated);
                    item.remove();
                    if (bm.url === location.href) this._btn?.classList.remove('saved');
                    heading.textContent = `Bookmarks (${updated.length})`;
                    if (!updated.length) {
                        panel.querySelector('.rx-bookmark-item')?.remove();
                        appendEmpty('No bookmarks.');
                    }
                });
                item.appendChild(removeBtn);
                panel.appendChild(item);
            }
        }

        overlay.appendChild(panel);
        document.body.appendChild(overlay);
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-bookmark-css');

        // Add bookmark button on watch pages
        if (Page.isWatch()) {
            waitForFeature(this, '.video-header-container, .media-description, .media-heading').then(container => {
                const btn = document.createElement('button');
                btn.className = 'rx-bookmark-btn';
                if (this._isBookmarked(location.href)) btn.classList.add('saved');
                btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg><span>Bookmark</span>`;
                btn.addEventListener('click', () => this._toggleBookmark());
                container.appendChild(btn);
                this._btn = btn;
            }).catch(() => {});
        }

        // Add "View Bookmarks" button on feed pages
        if (Page.isFeed()) {
            waitForFeature(this, '.main-and-sidebar, .constrained-container, .subscriptions-header, .homepage-container').then(container => {
                const btn = document.createElement('button');
                btn.className = 'rx-bookmarks-viewall';
                btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor;vertical-align:-2px;margin-right:4px"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>Bookmarks`;
                btn.addEventListener('click', () => this._showOverlay());
                const wrapper = document.createElement('div');
                wrapper.style.cssText = 'padding:8px 16px; display: inline-block;';
                wrapper.appendChild(btn);
                container.parentNode?.insertBefore(wrapper, container);
                this._viewWrapper = wrapper;
            }).catch(() => {});
        }
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
        this._btn = null;
        this._viewWrapper?.remove();
        this._viewWrapper = null;
        qs('.rx-bookmarks-overlay')?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Comment Navigator
// ═══════════════════════════════════════════
const CommentNav = {
    id: 'commentNav',
    name: 'Comment Nav',
    _bar: null,
    _idx: -1,
    _items: [],

    _css: `
        .rx-comment-nav {
            position: sticky; top: 0; z-index: 100;
            background: #1e1e2e; border: 1px solid #45475a;
            border-radius: 8px; padding: 6px 10px;
            display: flex; align-items: center; gap: 8px;
            margin-bottom: 12px;
            font: 600 12px/1.4 system-ui, sans-serif;
            color: #cdd6f4;
        }
        .rx-comment-nav button {
            background: #313244; border: 1px solid #45475a; color: #cdd6f4;
            border-radius: 4px; padding: 3px 10px; cursor: pointer; font-size: 11px;
            transition: border-color 0.15s;
        }
        .rx-comment-nav button:hover { border-color: #89b4fa; }
        .rx-comment-nav button.active { border-color: #a6e3a1; color: #a6e3a1; }
        .rx-comment-nav .count { color: #6c7086; font-size: 11px; margin-left: auto; }
        .rx-comment-highlight { outline: 2px solid #89b4fa; outline-offset: 2px; border-radius: 4px; }
    `,

    _refresh() {
        this._items = [...qsa('li.comment-item[data-comment-id]')];
        const countEl = this._bar?.querySelector('.count');
        if (countEl) countEl.textContent = `${this._items.length} comments`;
    },

    _goto(idx) {
        if (!this._items.length) return;
        // Remove previous highlight
        this._items[this._idx]?.classList.remove('rx-comment-highlight');
        // Clamp
        this._idx = Math.max(0, Math.min(idx, this._items.length - 1));
        const el = this._items[this._idx];
        el.classList.add('rx-comment-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    _next() { this._refresh(); this._goto(this._idx + 1); },
    _prev() { this._refresh(); this._goto(this._idx - 1); },

    _collapseAll() {
        for (const btn of qsa('button.comment-toggle-replies')) {
            const action = btn.querySelector('.comment-toggle-replies-action');
            if (action && action.textContent.includes('Hide')) btn.click();
        }
    },

    _expandAll() {
        for (const btn of qsa('button.comment-toggle-replies')) {
            const action = btn.querySelector('.comment-toggle-replies-action');
            if (action && action.textContent.includes('Show')) btn.click();
        }
    },

    _filterOP() {
        const opOnly = this._bar?.querySelector('.rx-op-filter')?.classList.toggle('active');
        for (const item of qsa('li.comment-item[data-comment-id]')) {
            const isOP = !!item.querySelector('.comments-meta-author-video-owner');
            if (opOnly && !isOP) {
                item.style.display = 'none';
            } else {
                item.style.display = '';
            }
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-comment-nav-css');

        waitForFeature(this, '#video-comments, .media-page-comments-container').then(container => {
            const bar = document.createElement('div');
            bar.className = 'rx-comment-nav';

            const prevBtn = document.createElement('button');
            prevBtn.textContent = 'Prev';
            prevBtn.addEventListener('click', () => this._prev());

            const nextBtn = document.createElement('button');
            nextBtn.textContent = 'Next';
            nextBtn.addEventListener('click', () => this._next());

            const expandBtn = document.createElement('button');
            expandBtn.textContent = 'Expand All';
            expandBtn.addEventListener('click', () => this._expandAll());

            const collapseBtn = document.createElement('button');
            collapseBtn.textContent = 'Collapse All';
            collapseBtn.addEventListener('click', () => this._collapseAll());

            const opBtn = document.createElement('button');
            opBtn.textContent = 'OP Only';
            opBtn.className = 'rx-op-filter';
            opBtn.addEventListener('click', () => this._filterOP());

            const count = document.createElement('span');
            count.className = 'count';

            bar.appendChild(prevBtn);
            bar.appendChild(nextBtn);
            bar.appendChild(expandBtn);
            bar.appendChild(collapseBtn);
            bar.appendChild(opBtn);
            bar.appendChild(count);

            container.insertBefore(bar, container.firstChild);
            this._bar = bar;
            setFeatureTimeout(this, () => this._refresh(), 2000);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._bar?.remove();
        for (const el of qsa('.rx-comment-highlight')) el.classList.remove('rx-comment-highlight');
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Rant Highlight
// ═══════════════════════════════════════════
const RantHighlight = {
    id: 'rantHighlight',
    name: 'Rant Highlight',
    _tracker: null,
    _obs: null,
    _total: 0,

    _css: `
        .rx-rant-tracker {
            position: sticky; top: 0; z-index: 101;
            background: linear-gradient(135deg, #1e1e2e 0%, #2a1f3d 100%);
            border: 1px solid #45475a;
            border-radius: 8px; padding: 8px 14px;
            display: flex; align-items: center; gap: 12px;
            font: 600 12px/1.4 system-ui, sans-serif;
            color: #cdd6f4; margin-bottom: 8px;
        }
        .rx-rant-tracker .label { color: #f9e2af; }
        .rx-rant-tracker .total { color: #a6e3a1; font-size: 16px; font-weight: 700; }
        .rx-rant-tracker .rant-count { color: #6c7086; }

        /* Enhance rant visibility by tier */
        .chat-history--rant[data-level="1"] { box-shadow: 0 0 8px rgba(166,227,161,0.2); }
        .chat-history--rant[data-level="2"] { box-shadow: 0 0 12px rgba(137,180,250,0.3); }
        .chat-history--rant[data-level="3"] { box-shadow: 0 0 12px rgba(249,226,175,0.3); }
        .chat-history--rant[data-level="4"] { box-shadow: 0 0 16px rgba(249,226,175,0.4); }
        .chat-history--rant[data-level="5"] { box-shadow: 0 0 20px rgba(243,139,168,0.4); }
        .chat-history--rant[data-level="6"],
        .chat-history--rant[data-level="7"],
        .chat-history--rant[data-level="8"],
        .chat-history--rant[data-level="9"],
        .chat-history--rant[data-level="10"] {
            box-shadow: 0 0 24px rgba(243,139,168,0.5);
            animation: rx-rant-glow 2s ease-in-out infinite alternate;
        }
        @keyframes rx-rant-glow {
            from { box-shadow: 0 0 20px rgba(243,139,168,0.4); }
            to { box-shadow: 0 0 30px rgba(243,139,168,0.7); }
        }
    `,

    _parsePrice(text) {
        const m = text.match(/\$(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
    },

    _scan() {
        let total = 0;
        let count = 0;
        for (const rant of qsa('.chat-history--rant')) {
            const priceEl = rant.querySelector('.chat-history--rant-price');
            if (priceEl) {
                total += this._parsePrice(priceEl.textContent);
                count++;
            }
        }
        this._total = total;
        if (this._tracker) {
            this._tracker.querySelector('.total').textContent = `$${total}`;
            this._tracker.querySelector('.rant-count').textContent = `${count} rants`;
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-rant-highlight-css');

        // Use waitFor instead of Page.isLive() — chat loads async, isLive() may be false at init time
        waitForFeature(this, '#chat-history-list, .chat-history').then(chatEl => {
            // Insert tracker above chat
            const tracker = document.createElement('div');
            tracker.className = 'rx-rant-tracker';
            tracker.innerHTML = `<span class="label">Rant Total:</span><span class="total">$0</span><span class="rant-count">0 rants</span>`;
            chatEl.parentNode?.insertBefore(tracker, chatEl);
            this._tracker = tracker;

            // Observe for new rants
            this._obs = new MutationObserver(() => {
                scheduleFeatureFrame(this, 'rant-scan', () => this._scan());
            });
            this._obs.observe(chatEl, { childList: true, subtree: true });
            this._scan();
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._tracker?.remove();
        this._obs?.disconnect();
        this._tracker = null;
        this._obs = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Related Filter
// ═══════════════════════════════════════════
const RelatedFilter = {
    id: 'relatedFilter',
    name: 'Related Filter',
    _bar: null,

    _css: `
        .rx-related-filter {
            padding: 8px 0;
            display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
        }
        .rx-related-search {
            flex: 1; min-width: 120px;
            padding: 5px 10px; border-radius: 6px;
            border: 1px solid #45475a; background: #313244;
            color: #cdd6f4; font-size: 12px; outline: none;
        }
        .rx-related-search:focus { border-color: #89b4fa; }
        .rx-related-filter button {
            background: #313244; border: 1px solid #45475a; color: #cdd6f4;
            border-radius: 4px; padding: 3px 8px; cursor: pointer;
            font-size: 11px; white-space: nowrap;
            transition: border-color 0.15s;
        }
        .rx-related-filter button:hover { border-color: #89b4fa; }
        .rx-related-filter button.active { border-color: #a6e3a1; color: #a6e3a1; }
        .rx-related-hidden { display: none !important; }
    `,

    _filter(query, hideWatched) {
        const q = query.toLowerCase();
        const progress = WatchProgress._getStore();
        for (const item of VideoCards.related()) {
            const title = VideoCards.title(item).toLowerCase();
            const channel = VideoCards.channel(item).toLowerCase();
            const matchQuery = !q || title.includes(q) || channel.includes(q);

            // Check if watched (has progress bar or in localStorage watch history)
            let isWatched = false;
            if (hideWatched) {
                const videoId = VideoCards.videoId(item);
                isWatched = !!(videoId && progress[videoId]) || !!item.querySelector('.rx-progress-bar');
            }

            if (matchQuery && (!hideWatched || !isWatched)) {
                item.classList.remove('rx-related-hidden');
            } else {
                item.classList.add('rx-related-hidden');
            }
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-related-filter-css');

        waitForFeature(this, '.mediaList-list, .media-page-related-media-desktop-sidebar').then(sidebar => {
            const bar = document.createElement('div');
            bar.className = 'rx-related-filter';

            const search = document.createElement('input');
            search.className = 'rx-related-search';
            search.placeholder = 'Filter related...';
            search.type = 'text';
            search.setAttribute('aria-label', 'Filter related videos by title or channel');

            const hideWatchedBtn = document.createElement('button');
            hideWatchedBtn.textContent = 'Hide Watched';
            hideWatchedBtn.type = 'button';
            hideWatchedBtn.setAttribute('aria-pressed', 'false');
            let hideWatched = false;

            search.addEventListener('input', () => this._filter(search.value, hideWatched));
            hideWatchedBtn.addEventListener('click', () => {
                hideWatched = !hideWatched;
                hideWatchedBtn.classList.toggle('active', hideWatched);
                hideWatchedBtn.setAttribute('aria-pressed', String(hideWatched));
                this._filter(search.value, hideWatched);
            });

            bar.appendChild(search);
            bar.appendChild(hideWatchedBtn);

            // Insert before the list
            const list = sidebar.querySelector('.mediaList-list') || sidebar;
            list.parentNode?.insertBefore(bar, list);
            this._bar = bar;
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._bar?.remove();
        for (const el of qsa('.rx-related-hidden')) el.classList.remove('rx-related-hidden');
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Exact Counts
// ═══════════════════════════════════════════
const ExactCounts = {
    id: 'exactCounts',
    name: 'Exact Counts',
    _obs: null,
    _originals: null,

    _css: `
        .rx-exact-count { font-variant-numeric: tabular-nums; }
    `,

    _formatNumber(n) {
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    _setExactText(target, text, marker = target, addClass = true) {
        if (!target || !marker) return;
        this._originals = this._originals || new Map();
        if (!this._originals.has(target)) {
            this._originals.set(target, {
                text: target.textContent,
                marker,
                markerValue: marker.dataset.rxExact,
                hadClass: target.classList.contains('rx-exact-count'),
            });
        }
        target.textContent = text;
        if (addClass) target.classList.add('rx-exact-count');
        marker.dataset.rxExact = '1';
    },

    _processCards() {
        for (const target of [...(this._originals?.keys() || [])]) {
            if (!target.isConnected) this._originals.delete(target);
        }
        // Feed cards: use data-views attribute for exact count
        for (const viewEl of qsa('.videostream__views[data-views]')) {
            if (viewEl.dataset.rxExact) continue;
            const exact = parseInt(viewEl.dataset.views, 10);
            if (!isNaN(exact)) {
                const countSpan = viewEl.querySelector('.videostream__views--count');
                if (countSpan) {
                    this._setExactText(countSpan, '\u00a0' + this._formatNumber(exact) + '\u00a0', viewEl);
                }
            }
        }

        // Also expand title tooltips that have exact counts
        for (const viewEl of qsa('.videostream__views[title]')) {
            if (viewEl.dataset.rxExact) continue;
            const title = viewEl.getAttribute('title');
            const m = title?.match(/^([\d,]+)$/);
            if (m) {
                const countSpan = viewEl.querySelector('.videostream__views--count');
                if (countSpan) {
                    this._setExactText(countSpan, '\u00a0' + m[1] + '\u00a0', viewEl);
                }
            }
        }

        // Related sidebar: expand titles on mediaList items
        for (const item of qsa('.mediaList-rumbles[title], .mediaList-plays[title]')) {
            if (item.dataset.rxExact) continue;
            const title = item.getAttribute('title');
            if (title && /\d/.test(title)) {
                this._setExactText(item, title);
            }
        }

        // Video page: expand vote counts
        const upVotes = qs('[data-js="rumbles_up_votes"]');
        const downVotes = qs('[data-js="rumbles_down_votes"]');
        if (upVotes?.title && !upVotes.dataset.rxExact) {
            this._setExactText(upVotes, upVotes.title, upVotes, false);
        }
        if (downVotes?.title && !downVotes.dataset.rxExact) {
            this._setExactText(downVotes, downVotes.title, downVotes, false);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._originals = new Map();
        this._styleEl = injectStyle(this._css, 'rx-exact-counts-css');

        // Process on load and watch for dynamic content
        setFeatureTimeout(this, () => this._processCards(), 1500);
        this._obs = new MutationObserver(() => {
            scheduleFeatureFrame(this, 'count-scan', () => this._processCards());
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._obs = null;
        for (const [target, original] of this._originals || []) {
            target.textContent = original.text;
            if (!original.hadClass) target.classList.remove('rx-exact-count');
            if (original.markerValue === undefined) delete original.marker.dataset.rxExact;
            else original.marker.dataset.rxExact = original.markerValue;
        }
        this._originals?.clear();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Share Timestamp
// ═══════════════════════════════════════════
const ShareTimestamp = {
    id: 'shareTimestamp',
    name: 'Share Timestamp',
    _btn: null,
    _toast: null,

    _css: `
        .rx-share-ts-btn {
            position: absolute;
            bottom: 52px; right: 80px;
            z-index: 100;
            background: rgba(17,17,27,0.75);
            border: 1px solid rgba(205,214,244,0.2);
            color: #cdd6f4;
            border-radius: 6px;
            padding: 5px 10px;
            cursor: pointer;
            font: 700 11px/1 system-ui, sans-serif;
            opacity: 0; transition: opacity 0.2s;
            pointer-events: auto;
            display: flex; align-items: center; gap: 5px;
        }
        .videoPlayer-Rumble-cls:hover .rx-share-ts-btn,
        #videoPlayer:hover .rx-share-ts-btn { opacity: 1; }
        .rx-share-ts-btn:hover { background: rgba(17,17,27,0.9); border-color: #89b4fa; }
        .rx-share-ts-btn svg { width: 14px; height: 14px; fill: currentColor; }
    `,

    _formatTime(s) {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        if (h > 0) return `${h}h${m}m${sec}s`;
        if (m > 0) return `${m}m${sec}s`;
        return `${sec}s`;
    },

    _copyURL() {
        const video = qs('video');
        if (!video) return;
        const time = Math.floor(video.currentTime);
        const url = new URL(location.href);
        url.searchParams.set('start', time);
        // Clean hash
        url.hash = '';

        navigator.clipboard.writeText(url.toString()).then(() => {
            RxToast.show(`Copied URL at ${this._formatTime(time)}`);
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = url.toString();
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            RxToast.show(`Copied URL at ${this._formatTime(time)}`);
        });
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch() && !Page.isEmbed()) return;
        this._styleEl = injectStyle(this._css, 'rx-share-ts-css');

        waitForFeature(this, '#videoPlayer, .videoPlayer-Rumble-cls').then(container => {
            container.style.position = container.style.position || 'relative';
            const btn = document.createElement('button');
            btn.className = 'rx-share-ts-btn';
            btn.title = 'Copy URL at current time';
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>Share@Time`;
            btn.addEventListener('click', (e) => { e.stopPropagation(); this._copyURL(); });
            container.appendChild(btn);
            this._btn = btn;
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
        this._toast?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Shorts Filter
// ═══════════════════════════════════════════
const ShortsFilter = {
    id: 'shortsFilter',
    name: 'Shorts Filter',
    _obs: null,

    _css: `
        /* Hide Shorts cards from feeds - detected by #shorts__label SVG badge */
        .rx-shorts-hidden { display: none !important; }
        /* Hide the entire Shorts homepage section */
        #section-shorts.rx-section-hidden { display: none !important; }
    `,

    _isShortsCard(el) {
        // Shorts cards have the #shorts__label SVG badge and hidden duration
        if (el.querySelector('use[href="#shorts__label"]')) return true;
        if (el.querySelector('.videostream__status--hidden')) return true;
        // Shorts URLs contain /shorts/ or /v-shorts
        const link = el.querySelector('a[href*="/shorts/"]') || el.querySelector('a[href*="-short-"]');
        if (link) return true;
        return false;
    },

    _filterAll() {
        // Filter individual shorts cards from feed grids
        for (const card of VideoCards.all()) {
            if (this._isShortsCard(card)) {
                card.classList.add('rx-shorts-hidden');
            }
        }
        // Hide the dedicated Shorts section on homepage
        for (const section of qsa('section#section-shorts')) {
            if (section.querySelector('rum-shorts-row, use[href="#shorts__label"]')) {
                section.classList.add('rx-section-hidden');
            }
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isFeed() && !Page.isHome() && !Page.isChannel()) return;
        this._styleEl = injectStyle(this._css, 'rx-shorts-filter-css');

        setFeatureTimeout(this, () => this._filterAll(), 1000);
        this._obs = new MutationObserver(() => {
            scheduleFeatureFrame(this, 'shorts-scan', () => this._filterAll());
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        for (const el of qsa('.rx-shorts-hidden')) el.classList.remove('rx-shorts-hidden');
        for (const section of qsa('section#section-shorts.rx-section-hidden')) {
            section.classList.remove('rx-section-hidden');
        }
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Chat Auto-Scroll
// ═══════════════════════════════════════════
const ChatAutoScroll = {
    id: 'chatAutoScroll',
    name: 'Chat Auto-Scroll',
    _chatEl: null,
    _paused: false,
    _obs: null,
    _jumpBtn: null,

    _css: `
        .rx-chat-jump {
            position: absolute;
            bottom: 60px; left: 50%;
            transform: translateX(-50%);
            z-index: 200;
            background: rgba(137,180,250,0.9);
            color: #1e1e2e;
            border: none; border-radius: 8px;
            padding: 5px 14px;
            font: 700 11px/1.4 system-ui, sans-serif;
            cursor: pointer;
            display: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            transition: opacity 0.2s;
        }
        .rx-chat-jump.show { display: block; }
        .rx-chat-jump:hover { background: #89b4fa; }
    `,

    _isNearBottom() {
        if (!this._chatEl) return true;
        const threshold = 80;
        return (this._chatEl.scrollHeight - this._chatEl.scrollTop - this._chatEl.clientHeight) < threshold;
    },

    _scrollToBottom() {
        if (!this._chatEl) return;
        this._chatEl.scrollTop = this._chatEl.scrollHeight;
        this._paused = false;
        this._jumpBtn?.classList.remove('show');
    },

    _onScroll() {
        if (this._isNearBottom()) {
            this._paused = false;
            this._jumpBtn?.classList.remove('show');
        } else {
            this._paused = true;
            this._jumpBtn?.classList.add('show');
        }
    },

    _onNewMessages() {
        if (!this._paused) {
            requestAnimationFrame(() => this._scrollToBottom());
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-chat-autoscroll-css');

        waitForFeature(this, '#chat-history-list, .chat-history').then(chatEl => {
            this._chatEl = chatEl;

            // Scroll listener to detect user scroll-up
            this._boundScroll = () => this._onScroll();
            chatEl.addEventListener('scroll', this._boundScroll, { passive: true });

            // Create jump-to-latest button
            const parent = chatEl.parentElement;
            if (parent) {
                parent.style.position = parent.style.position || 'relative';
                this._jumpBtn = document.createElement('button');
                this._jumpBtn.className = 'rx-chat-jump';
                this._jumpBtn.textContent = 'Jump to latest';
                this._jumpBtn.addEventListener('click', () => this._scrollToBottom());
                parent.appendChild(this._jumpBtn);
            }

            // Observe new chat messages
            this._obs = new MutationObserver(() => this._onNewMessages());
            this._obs.observe(chatEl, { childList: true });

            // Initial scroll to bottom
            this._scrollToBottom();
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._jumpBtn?.remove();
        this._obs?.disconnect();
        if (this._chatEl && this._boundScroll) {
            this._chatEl.removeEventListener('scroll', this._boundScroll);
        }
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Auto-Expand Description
// ═══════════════════════════════════════════
const AutoExpand = {
    id: 'autoExpand',
    name: 'Auto Expand',

    _css: `
        /* Force description to be fully visible */
        .media-description {
            max-height: none !important;
            overflow: visible !important;
            -webkit-line-clamp: unset !important;
        }
        .media-description-section [data-js="media_long_description_container"] {
            max-height: none !important;
            overflow: visible !important;
        }
        /* Hide the "Show more"/"Show less" toggle if present */
        .media-description-section .show-more-toggle,
        .media-description-section [data-js="media_description_show_more"],
        .media-description-section [data-js="media_description_show_less"] {
            display: none !important;
        }
        /* Also expand comment text that might be truncated */
        .comment-text {
            max-height: none !important;
            overflow: visible !important;
            -webkit-line-clamp: unset !important;
        }
    `,

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-auto-expand-css');

        // Also click any "Show more" button that exists. Track the timer so
        // destroy() can cancel — otherwise disabling the feature within the
        // 1500 ms window still fires the click against a page where the user
        // has explicitly turned AutoExpand off.
        waitForFeature(this, '.media-description-section').then(() => {
            this._timer = setTimeout(() => {
                this._timer = null;
                const showMore = qs('[data-js="media_description_show_more"]') ||
                    qs('.media-description-section .show-more-toggle') ||
                    qs('.media-description-section button[class*="show-more"]');
                if (showMore && showMore.offsetParent !== null) {
                    showMore.click();
                }
            }, 1500);
        }).catch(() => {});
    },

    destroy() {
        if (this._timer) { clearTimeout(this._timer); this._timer = null; }
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Notification Enhance
// ═══════════════════════════════════════════
const NotifEnhance = {
    id: 'notifEnhance',
    name: 'Notification Enhance',

    _css: `
        /* Restyle notification dropdown with Catppuccin Mocha */
        .user-notifications {
            background: #1e1e2e !important;
            border: 1px solid #45475a !important;
            border-radius: 12px !important;
            box-shadow: 0 12px 40px rgba(0,0,0,0.5) !important;
            max-height: 500px !important;
            overflow-y: auto !important;
        }
        .user-notifications--header {
            background: #181825 !important;
            border-bottom: 1px solid #313244 !important;
            padding: 10px 16px !important;
            font-weight: 700 !important;
            color: #cdd6f4 !important;
        }
        .user-notifications--list-wrapper {
            padding: 4px !important;
        }
        .user-notifications--list-wrapper a,
        .user-notifications--list-wrapper > div {
            border-radius: 8px !important;
            padding: 8px 12px !important;
            margin: 2px 0 !important;
            transition: background 0.15s !important;
        }
        .user-notifications--list-wrapper a:hover,
        .user-notifications--list-wrapper > div:hover {
            background: #313244 !important;
        }
        .user-notifications--show-more {
            background: #313244 !important;
            color: #89b4fa !important;
            border: 1px solid #45475a !important;
            border-radius: 6px !important;
            margin: 8px 12px !important;
            padding: 6px !important;
            font-weight: 600 !important;
            transition: border-color 0.15s !important;
        }
        .user-notifications--show-more:hover {
            border-color: #89b4fa !important;
        }
        .user-notifications--loading-bar {
            color: #6c7086 !important;
        }
        /* Enhanced bell animation for unread */
        .user-notifications--bell-button--unread::after {
            background: #f38ba8 !important;
            animation: rx-bell-pulse 2s ease-in-out infinite !important;
        }
        @keyframes rx-bell-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.7; }
        }
        /* Notification close button */
        .user-notifications--close {
            color: #6c7086 !important;
            transition: color 0.15s !important;
        }
        .user-notifications--close:hover {
            color: #cdd6f4 !important;
        }
        /* Scrollbar inside notifications */
        .user-notifications::-webkit-scrollbar { width: 6px; }
        .user-notifications::-webkit-scrollbar-track { background: transparent; }
        .user-notifications::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }
        .user-notifications::-webkit-scrollbar-thumb:hover { background: #585b70; }
    `,

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-notif-enhance-css');
    },

    destroy() {
        this._styleEl?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Playlist Quick Save
// ═══════════════════════════════════════════
const PlaylistQuickSave = {
    id: 'quickSave',
    name: 'Quick Save',
    _obs: null,
    _timer: null,

    _css: `
        .rx-quick-save {
            position: absolute;
            top: 6px; right: 6px;
            z-index: 50;
            background: rgba(17,17,27,0.8);
            border: 1px solid rgba(205,214,244,0.15);
            color: #cdd6f4;
            border-radius: 6px;
            width: 28px; height: 28px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s, background 0.15s, border-color 0.15s;
            pointer-events: auto;
        }
        .thumbnail__thumb:hover .rx-quick-save,
        .videostream:hover .rx-quick-save,
        .rum-video-thumbnail__image:hover .rx-quick-save,
        .video-item--img-wrapper:hover .rx-quick-save { opacity: 1; }
        .rx-quick-save:hover { background: rgba(17,17,27,0.95); border-color: #89b4fa; }
        .rx-quick-save.saved { border-color: #a6e3a1; color: #a6e3a1; }
        .rx-quick-save svg { width: 16px; height: 16px; fill: currentColor; pointer-events: none; }
    `,

    _clickNativeWatchLater(card) {
        // Find the native playlist-menu and trigger "Save to Watch Later"
        const menu = card.querySelector('.playlist-menu, [data-js="playlist_menu"]');
        if (!menu) return false;

        const menuBtn = menu.querySelector('.playlist-menu__button, [data-js="playlist_menu_button"]');
        if (menuBtn) {
            // Open menu
            menuBtn.click();
            // Wait for menu to render, then click Watch Later option
            setTimeout(() => {
                const watchLaterOpt = menu.querySelector('[data-playlist-option="watch-later-add"]');
                if (watchLaterOpt) {
                    watchLaterOpt.click();
                    RxToast.show('Saved to Watch Later');
                    return;
                }
                // Close menu if option not found
                menuBtn.click();
            }, 100);
            return true;
        }
        return false;
    },

    _addButtons() {
        for (const card of VideoCards.all()) {
            const thumb = VideoCards.thumbnail(card);
            if (!thumb) continue;
            if (thumb.querySelector('.rx-quick-save')) continue;

            // Need relative positioning on thumb
            thumb.style.position = thumb.style.position || 'relative';

            const btn = document.createElement('button');
            btn.className = 'rx-quick-save';
            btn.title = 'Save to Watch Later';
            btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 6v6l4 2-1 1.7L10 13V6h2zm0-4C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z"/></svg>`;
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this._clickNativeWatchLater(card)) {
                    btn.classList.add('saved');
                } else {
                    // Fallback: save to our local bookmarks
                    const url = VideoCards.url(card);
                    const title = VideoCards.title(card);
                    if (url && title) {
                        const key = 'rx_bookmarks';
                        try {
                            const bm = JSON.parse(localStorage.getItem(key) || '[]');
                            if (!bm.some(b => b.url === url)) {
                                const channel = VideoCards.channel(card);
                                const img = thumb.matches('img') ? thumb : thumb.querySelector('img');
                                bm.unshift({ url, title, channel, thumb: img?.src || '', time: Date.now() });
                                localStorage.setItem(key, JSON.stringify(bm.slice(0, 200)));
                                btn.classList.add('saved');
                                RxToast.show('Bookmarked locally');
                            } else {
                                btn.classList.add('saved');
                                RxToast.show('Already saved');
                            }
                        } catch { /* ignore */ }
                    }
                }
            });
            thumb.appendChild(btn);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isFeed() && !Page.isHome() && !Page.isChannel() && !Page.isSearch()) return;
        this._styleEl = injectStyle(this._css, 'rx-quick-save-css');

        clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            this._timer = null;
            this._addButtons();
        }, 1500);
        this._obs = new MutationObserver(() => {
            scheduleFeatureFrame(this, 'save-button-scan', () => this._addButtons());
        });
        this._obs.observe(document.documentElement, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        clearTimeout(this._timer);
        this._timer = null;
        this._toast?.remove();
        this._toast = null;
        for (const el of qsa('.rx-quick-save')) el.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Settings Panel (Categorized Modal)
// ═══════════════════════════════════════════
const RX_CATEGORIES = [
    {
        id: 'ad-blocking', label: 'Ad Blocking', color: '#85d551',
        icon: '<path d="M18.36 6.64a1 1 0 00-1.41 0L12 11.59 7.05 6.64a1 1 0 10-1.41 1.41L10.59 13l-4.95 4.95a1 1 0 101.41 1.41L12 14.41l4.95 4.95a1 1 0 001.41-1.41L13.41 13l4.95-4.95a1 1 0 000-1.41z"/>',
        features: [
            { id: 'adNuker', label: 'Ad Nuker', desc: 'DOM cleanup for ad containers, pause overlays, and premium nags after the network shield runs' },
            { id: 'feedCleanup', label: 'Feed Cleanup', desc: 'Remove premium promos from feeds' },
            { id: 'hideReposts', label: 'Hide Reposts', desc: 'Hide reposted videos from feeds', parent: 'feedCleanup' },
            { id: 'hidePremium', label: 'Hide Premium', desc: 'Hide premium/PPV videos from feeds' },
            { id: 'shortsFilter', label: 'Shorts Filter', desc: 'Hide Shorts from all feeds' },
            { id: 'sponsorBlock', label: 'SponsorBlock', desc: 'Local per-video segments with auto-skip' },
        ],
    },
    {
        id: 'video-player', label: 'Video Player', color: '#a78bfa',
        icon: '<path d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zm5.5 4.5l6 4.5-6 4.5v-9z"/>',
        features: [
            { id: 'theaterSplit', label: 'Theater Split', desc: 'Fullscreen video with scroll-to-reveal side panel' },
            { id: 'autoTheater', label: 'Auto Theater', desc: 'Auto-enter native theater mode on load' },
            { id: 'speedController', label: 'Speed Control', desc: 'Persistent playback speed with live detection' },
            { id: 'scrollVolume', label: 'Scroll Volume', desc: 'Mouse wheel volume + middle-click mute' },
            { id: 'defaultMaxVolume', label: 'Default Max Volume', desc: 'Start videos at 100% volume', parent: 'scrollVolume' },
            { id: 'autoMaxQuality', label: 'Auto Max Quality', desc: 'Auto-select highest resolution on load' },
            { id: 'autoplayBlock', label: 'Autoplay Block', desc: 'Prevent auto-play of next video' },
            { id: 'loopControl', label: 'Loop Control', desc: 'Full video loop + A-B segment loop' },
            { id: 'miniPlayer', label: 'Mini Player', desc: 'Floating draggable video when scrolling away' },
            { id: 'legacyKeyboardNav', label: 'Keyboard Nav (legacy)', desc: 'YouTube-style hotkeys (J/K/L, F, M, 0-9) — off by default in v2' },
            { id: 'videoStats', label: 'Video Stats', desc: 'Resolution, codec, buffer, frames overlay' },
            { id: 'chapters', label: 'Chapters', desc: 'Parse description timestamps + seekbar markers' },
            { id: 'autoplayScheduler', label: 'Autoplay Queue', desc: 'Queue Rumble URLs, auto-advance at end' },
        ],
    },
    {
        id: 'theme-layout', label: 'Theme & Layout', color: '#fab387',
        icon: '<path d="M12 2a1 1 0 011 1v1a1 1 0 01-2 0V3a1 1 0 011-1zm6.36 3.05a1 1 0 010 1.41l-.7.71a1 1 0 01-1.42-1.42l.71-.7a1 1 0 011.41 0zM21 11a1 1 0 010 2h-1a1 1 0 010-2h1zM4 11a1 1 0 010 2H3a1 1 0 010-2h1zm2.05-5.95a1 1 0 011.41 0l.71.7a1 1 0 01-1.42 1.42l-.7-.71a1 1 0 010-1.41zM12 7a5 5 0 100 10 5 5 0 000-10z"/>',
        features: [
            { id: 'darkEnhance', label: 'Dark Theme', desc: 'Theme engine with player bar coloring' },
            { id: 'wideLayout', label: 'Wide Layout', desc: 'Full-width responsive grid on home & subs' },
            { id: 'logoToFeed', label: 'Logo to Feed', desc: 'Rumble logo navigates to Subscriptions' },
            { id: 'autoExpand', label: 'Auto Expand', desc: 'Auto-expand descriptions & comments' },
            { id: 'notifEnhance', label: 'Notif Enhance', desc: 'Themed notification dropdown + bell pulse' },
            { id: 'fullTitles', label: 'Full Titles', desc: 'Remove title truncation on video cards' },
            { id: 'titleFont', label: 'Title Font', desc: 'Unbold + normalize title typography' },
            // v2.1.0 — Premium UI and Layout Superset
            { id: 'denseMode', label: 'Dense Mode', desc: 'Compact spacing across grids and the watch page' },
            { id: 'reducedMotion', label: 'Reduced Motion', desc: 'Disable shimmer/stagger/spring animations' },
            { id: 'hideThumbnails', label: 'Hide Thumbnails', desc: 'Hide all thumbnails (master toggle)' },
            { id: 'hideThumbnailsFeeds', label: 'Hide Thumbs (Feeds)', desc: 'Hide thumbnails on home/subs/for-you only' },
            { id: 'hideThumbnailsRelated', label: 'Hide Thumbs (Related)', desc: 'Hide thumbnails in the related sidebar only' },
            { id: 'compactAccountPagination', label: 'Compact Account Pagination', desc: 'Shrink the autoPg pagination on /account/content' },
        ],
    },
    {
        id: 'downloads', label: 'Downloads & Capture', color: '#f9e2af',
        icon: '<path d="M12 3a1 1 0 011 1v9.59l3.3-3.3a1 1 0 011.4 1.42l-5 5a1 1 0 01-1.4 0l-5-5a1 1 0 011.4-1.42L11 13.59V4a1 1 0 011-1zM5 19a1 1 0 100 2h14a1 1 0 100-2H5z"/>',
        features: [
            { id: 'videoDownload', label: 'Video Download', desc: 'Download direct MP4, bounded HLS-to-MP4, or stream TS directly to disk' },
            { id: 'audioOnly', label: 'Low-Bitrate MP4', desc: 'Download smallest video variant for listening (saved as .mp4)' },
            { id: 'videoClips', label: 'Video Clips', desc: 'Mark In/Out and export clip as MP4' },
            { id: 'liveDVR', label: 'Live DVR', desc: 'Save the last N seconds of a live stream' },
            { id: 'batchDownload', label: 'Batch Download', desc: 'Multi-select thumbnails from feeds to download' },
            { id: 'screenshotBtn', label: 'Screenshot', desc: 'Capture current video frame as PNG' },
            { id: 'shareTimestamp', label: 'Share@Time', desc: 'Copy video URL at current playback time' },
            { id: 'subtitleSidecar', label: 'Subtitle Sidecar', desc: 'Load local SRT/VTT and overlay captions' },
            { id: 'transcripts', label: 'Transcripts', desc: 'Clickable transcript panel synced to player' },
            // v2.2.0 — Download Manager 2.0
            { id: 'externalPlayerEnabled', label: 'External Player', desc: 'Open videos in MPV / PotPlayer / custom URI (template configurable in options)' },
        ],
    },
    {
        id: 'history', label: 'History & Bookmarks', color: '#89b4fa',
        icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>',
        features: [
            { id: 'watchProgress', label: 'Watch Progress', desc: 'Save/resume position + red progress bars' },
            { id: 'watchHistory', label: 'Watch History', desc: 'Local browsable watch history with search' },
            { id: 'searchHistory', label: 'Search History', desc: 'Recent searches dropdown on search input' },
            { id: 'quickBookmark', label: 'Bookmarks', desc: 'Save videos locally for later (200 max)' },
            { id: 'quickSave', label: 'Quick Save', desc: 'Watch Later button on thumbnail hover' },
        ],
    },
    {
        id: 'comments-chat', label: 'Comments & Chat', color: '#a6e3a1',
        icon: '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>',
        features: [
            { id: 'liveChatEnhance', label: 'Chat Enhance', desc: '@mention highlights, message filter bar' },
            { id: 'chatAutoScroll', label: 'Chat Scroll', desc: 'Smart auto-scroll with pause on scroll-up' },
            { id: 'uniqueChatters', label: 'Unique Chatters', desc: 'Live counter of unique chatters + messages' },
            { id: 'chatUserBlock', label: 'User Block', desc: 'Per-user chat hide (click "block" on message)' },
            { id: 'chatSpamDedup', label: 'Spam Dedup', desc: 'Hide recently-repeated identical messages' },
            { id: 'chatExport', label: 'Chat Export', desc: 'Export chat as TXT (click) or JSON (shift-click)' },
            { id: 'popoutChat', label: 'Popout Chat', desc: 'Open chat in separate resizable window' },
            { id: 'videoTimestamps', label: 'Timestamps', desc: 'Clickable timestamps in comments/description' },
            { id: 'commentNav', label: 'Comment Nav', desc: 'Navigate, expand/collapse, OP-only filter' },
            { id: 'commentSort', label: 'Comment Sort', desc: 'Sort comments: Top / New / Oldest / Controversial' },
            { id: 'commentExport', label: 'Comment Export', desc: 'Export visible comments as JSON (click) or CSV (shift-click)' },
            { id: 'rantHighlight', label: 'Rant Highlight', desc: 'Glow rants by tier + running $ total' },
            { id: 'rantPersist', label: 'Rant Persist', desc: 'Keep rants visible past expiry + export JSON' },
            { id: 'commentBlocking', label: 'Comment Blocking', desc: 'Block users from the comment section' },
            { id: 'autoLoadComments', label: 'Auto Load Comments', desc: 'Auto-click "Show more comments" on scroll' },
            { id: 'moveReplyButton', label: 'Move Reply Button', desc: 'Move Reply next to like/dislike on comments' },
            { id: 'hideCommentReportLink', label: 'Hide Comment Report', desc: 'Hide the "report" link on comments' },
            { id: 'cleanLiveChat', label: 'Clean Live Chat UI', desc: 'Hide pinned messages + chat header + rant UI' },
        ],
    },
    {
        id: 'feed-controls', label: 'Feed Controls', color: '#74c7ec',
        icon: '<path d="M3 5a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 5a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm5 5a1 1 0 011-1h4a1 1 0 010 2h-4a1 1 0 01-1-1z"/>',
        features: [
            { id: 'channelBlocker', label: 'Channel Blocker', desc: 'Block/hide channels from all feeds' },
            { id: 'keywordFilter', label: 'Keyword Filter', desc: 'Hide videos whose titles match blocked keywords (literal/regex/wildcard modes in options)' },
            { id: 'relatedFilter', label: 'Related Filter', desc: 'Search & filter related sidebar videos' },
            { id: 'exactCounts', label: 'Exact Counts', desc: 'Show full numbers instead of 1.2K/3.5M' },
            // v2.4.0 — Feed, Discovery, and Moderation
            { id: 'stripTrackingParams', label: 'Strip Tracking Params', desc: 'Remove e9s, utm_*, ref, campaign, fbclid, gclid from rumble.com URLs (allowlisted; canonical params kept)' },
            // v3.1.0 — Platform follow-through
            { id: 'disableShortsFeed', label: 'Disable Shorts Feed', desc: 'Redirect rumble.com/shorts to /subscriptions (Shorts launched on web Feb 2026)' },
            { id: 'hideWalletTipButton', label: 'Hide Wallet Tip Button', desc: 'Hide the per-creator Rumble Wallet tip-jar button (launched Jan 2026)' },
        ],
    },
    // ── v1.9.0 — Rumble Enhancement Suite port ──
    {
        id: 'nav-chrome', label: 'Navigation & Chrome', color: '#94e2d5',
        icon: '<path d="M4 6h16v2H4zM4 11h16v2H4zM4 16h10v2H4z"/>',
        features: [
            { id: 'autoHideHeader', label: 'Auto-hide Header', desc: 'Fade header out; shows on top-edge hover' },
            { id: 'autoHideNavSidebar', label: 'Auto-hide Nav Sidebar', desc: 'Hide sidebar; slides in on left-edge hover' },
            { id: 'widenSearchBar', label: 'Widen Search Bar', desc: 'Expand the header search bar' },
            { id: 'hideUploadIcon', label: 'Hide Upload Icon', desc: 'Hide the upload/stream icon in the header' },
            { id: 'hideHeaderAd', label: 'Hide "Go Ad-Free"', desc: 'Hide the Go-Ad-Free button in the header' },
            { id: 'hideProfileBacksplash', label: 'Hide Profile Backsplash', desc: 'Hide the large channel header image' },
            { id: 'hideFooter', label: 'Hide Footer', desc: 'Hide the site footer entirely' },
            { id: 'siteThemeSync', label: 'Sync Site Theme', desc: "Mirror Rumble's native system/dark/light toggle" },
        ],
    },
    {
        id: 'main-page', label: 'Main Page Rows', color: '#b4befe',
        icon: '<path d="M3 4h18v4H3zM3 10h18v4H3zM3 16h18v4H3z"/>',
        features: [
            { id: 'hideFeaturedBanner', label: 'Featured Banner', desc: 'Top homepage banner' },
            { id: 'hideEditorPicks', label: 'Editor Picks', desc: 'Editor Picks row' },
            { id: 'hideTopLiveCategories', label: 'Top Live', desc: 'Top Live Categories row' },
            { id: 'hidePremiumRow', label: 'Premium Row', desc: 'Rumble Premium row' },
            { id: 'hideHomepageAd', label: 'Homepage Ad', desc: 'Ad container on home page' },
            { id: 'hideForYouRow', label: 'For You', desc: 'For-You recommendations row' },
            { id: 'hideLiveRow', label: 'Live Row', desc: 'Live videos row' },
            { id: 'hideGamingRow', label: 'Gaming', desc: 'Gaming row' },
            { id: 'hideFinanceRow', label: 'Finance', desc: 'Finance & Crypto row' },
            { id: 'hideFeaturedPlaylistsRow', label: 'Featured Playlists', desc: 'Featured Playlists row' },
            { id: 'hideSportsRow', label: 'Sports', desc: 'Sports row' },
            { id: 'hideViralRow', label: 'Viral', desc: 'Viral row' },
            { id: 'hidePodcastsRow', label: 'Podcasts', desc: 'Podcasts row' },
            { id: 'hideLeaderboardRow', label: 'Leaderboard', desc: 'Leaderboard row' },
            { id: 'hideVlogsRow', label: 'Vlogs', desc: 'Vlogs row' },
            { id: 'hideNewsRow', label: 'News', desc: 'News row' },
            { id: 'hideScienceRow', label: 'Science', desc: 'Health & Science row' },
            { id: 'hideMusicRow', label: 'Music', desc: 'Music row' },
            { id: 'hideEntertainmentRow', label: 'Entertainment', desc: 'Entertainment row' },
            { id: 'hideCookingRow', label: 'Cooking', desc: 'Cooking row' },
        ],
    },
    {
        id: 'video-page', label: 'Video Page Layout', color: '#f5c2e7',
        icon: '<path d="M4 5h16v11H4zM4 18h8v2H4zM14 18h6v2h-6z"/>',
        features: [
            { id: 'fullWidthPlayer', label: 'Full-Width Player', desc: 'Maximize player width; live = side-by-side chat' },
            { id: 'adaptiveLiveLayout', label: 'Adaptive Live Layout', desc: 'On live, expand main content when chat is visible' },
            { id: 'hideRelatedSidebar', label: 'Hide Related Sidebar', desc: 'Hide the related-videos sidebar' },
            { id: 'hideRelatedOnLive', label: 'Hide Related on Live', desc: 'Hide related media under the player on live' },
            { id: 'widenContent', label: 'Widen Content', desc: 'Expand main content (pair with hidden sidebar)' },
            { id: 'hideVideoDescription', label: 'Hide Description', desc: 'Hide description, tags, and views block' },
            { id: 'hidePausedVideoAds', label: 'Hide Paused Ads', desc: 'Hide pause-overlay ads on the player' },
        ],
    },
    {
        id: 'player-controls', label: 'Player Controls', color: '#fab387',
        icon: '<path d="M5 4v16l4-4v-8zM15 4v16l4-4v-8z"/>',
        features: [
            { id: 'autoLike', label: 'Auto Like', desc: 'Auto-like a video when its watch page opens' },
            { id: 'hideRewindButton', label: 'Hide Rewind', desc: 'Hide the rewind button' },
            { id: 'hideFastForwardButton', label: 'Hide Fast Forward', desc: 'Hide the fast-forward button' },
            { id: 'hideCCButton', label: 'Hide CC', desc: 'Hide the closed-captions button' },
            { id: 'hideAutoplayButton', label: 'Hide Autoplay Toggle', desc: 'Hide the autoplay toggle switch' },
            { id: 'hideTheaterButton', label: 'Hide Theater Button', desc: 'Hide the theater-mode button' },
            { id: 'hidePipButton', label: 'Hide PiP Button', desc: 'Hide the picture-in-picture button' },
            { id: 'hideFullscreenButton', label: 'Hide Fullscreen Button', desc: 'Hide the fullscreen button' },
            { id: 'hidePlayerRumbleLogo', label: 'Hide Player Logo', desc: 'Hide the Rumble logo in the player' },
            { id: 'hidePlayerGradient', label: 'Hide Player Gradient', desc: 'Remove the cloudy gradient at the bottom' },
        ],
    },
    {
        id: 'video-buttons', label: 'Video Buttons', color: '#f38ba8',
        icon: '<path d="M4 8h16v2H4zM4 14h16v2H4z"/>',
        features: [
            { id: 'hideLikeDislikeButton', label: 'Hide Like/Dislike', desc: 'Hide like and dislike buttons' },
            { id: 'hideShareButton', label: 'Hide Share', desc: 'Hide the share button' },
            { id: 'hideRepostButton', label: 'Hide Repost', desc: 'Hide the repost button' },
            { id: 'hideEmbedButton', label: 'Hide Embed', desc: 'Hide the embed button' },
            { id: 'hideSaveButton', label: 'Hide Save', desc: 'Hide the save-to-playlist button' },
            { id: 'hideCommentButton', label: 'Hide Comment', desc: 'Hide the main comment button' },
            { id: 'hideReportButton', label: 'Hide 3-dot Menu', desc: 'Hide the 3-dot menu (report link lives here)' },
            { id: 'hidePremiumJoinButtons', label: 'Hide Premium/Join', desc: 'Hide Rumble Premium and Join buttons' },
        ],
    },
];

const SettingsPanel = {
    _styleEl: null,
    _panelEl: null,
    _overlayEl: null,
    _toolbarEl: null,
    _lastFocusedEl: null,
    _keyHandler: null,

    _css: `
        /* ── Toolbar (FAB) ── */
        html.rx-theater #rx-toolbar { display: none !important; }
        #rx-toolbar {
            position: fixed; bottom: 20px; right: 20px; z-index: 10010;
            display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        #rx-toolbar .rx-tb-btn {
            width: 44px; height: 44px; border-radius: 50%;
            background: rgba(30,30,46,0.9); border: 1px solid rgba(137,180,250,0.25);
            color: rgba(255,255,255,0.7); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: background 0.2s, transform 0.2s, border-color 0.2s;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4); text-decoration: none;
        }
        #rx-toolbar .rx-tb-btn:hover {
            background: rgba(49,50,68,0.95); border-color: rgba(137,180,250,0.5); transform: scale(1.08);
        }
        #rx-toolbar .rx-tb-btn:focus-visible,
        .rx-m-close:focus-visible,
        .rx-m-nav-btn:focus-visible,
        .rx-m-btn:focus-visible,
        .rx-m-chip:focus-visible,
        .rx-m-switch input:focus-visible + .rx-m-switch-track {
            outline: 2px solid #85d551; outline-offset: 2px;
        }
        #rx-home-btn svg { width: 20px; height: 20px; }
        #rx-home-btn:hover { border-color: rgba(133,213,81,0.6) !important; }
        #rx-settings-btn svg { transition: transform 0.3s cubic-bezier(.4,0,.2,1); }

        /* ── Overlay ── */
        #rx-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 80000;
            opacity: 0; pointer-events: none; transition: opacity 300ms ease;
        }
        body.rx-panel-open #rx-overlay { opacity: 1; pointer-events: auto; }

        /* ── Modal ── */
        #rx-modal {
            position: fixed; top: 50%; left: 50%;
            transform: translate(-50%,-50%) scale(0.96);
            width: 95%; max-width: 1120px; height: 86vh; max-height: 780px;
            background: #0a0a0b; border: 1px solid #2a2a2e; border-radius: 12px;
            box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset;
            z-index: 80001; display: flex; flex-direction: column; overflow: hidden;
            opacity: 0; pointer-events: none;
            transition: all 300ms cubic-bezier(0.32,0.72,0,1);
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            color: #f0f0f0;
        }
        body.rx-panel-open #rx-modal {
            opacity: 1; pointer-events: auto; transform: translate(-50%,-50%) scale(1);
        }
        @media (max-width: 720px), (max-height: 620px) {
            #rx-modal { width: calc(100% - 16px); height: calc(100dvh - 16px); max-height: none; }
            .rx-m-body { flex-direction: column; }
            .rx-m-sidebar {
                width: 100%; max-height: none; flex-direction: row; align-items: center;
                overflow-x: auto; overflow-y: hidden; padding: 6px;
                border-right: 0; border-bottom: 1px solid #2a2a2e;
            }
            .rx-m-search-wrap { flex: 0 0 min(240px, 55vw); margin: 0 4px 0 0; }
            .rx-m-tablist { flex: 0 0 auto; flex-direction: row; gap: 2px; }
            .rx-m-nav-btn { flex: 0 0 auto; width: auto; min-height: 44px; }
            .rx-m-nav-count { display: none; }
            .rx-m-content { padding: 14px; }
        }

        /* ── Header ── */
        .rx-m-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 24px; background: #111113;
            border-bottom: 1px solid #2a2a2e; flex-shrink: 0;
        }
        .rx-m-brand { display: flex; align-items: center; gap: 10px; }
        .rx-m-title {
            font-size: 20px; font-weight: 700; letter-spacing: 0;
        }
        .rx-m-title-rx {
            background: linear-gradient(135deg, #85d551 0%, #4aba0e 50%, #85d551 100%);
            background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            animation: rx-shimmer 3s linear infinite;
        }
        @keyframes rx-shimmer { 0% { background-position: 0% center; } 100% { background-position: 200% center; } }
        .rx-m-badge {
            padding: 3px 10px; font-size: 9px; font-weight: 700; text-transform: uppercase;
            color: #fff; background: linear-gradient(135deg, #85d551, #4aba0e);
            border-radius: 6px; box-shadow: 0 2px 8px rgba(133,213,81,0.35);
        }
        .rx-m-close {
            display: flex; align-items: center; justify-content: center;
            width: 32px; height: 32px; background: #17171a; border: 1px solid #2a2a2e;
            border-radius: 8px; cursor: pointer; color: #c7d0e0;
            transition: all 180ms cubic-bezier(0.4,0,0.2,1);
        }
        .rx-m-close:hover { background: #ef4444; border-color: #ef4444; color: #fff; }
        .rx-m-close svg { width: 14px; height: 14px; }

        /* ── Body ── */
        .rx-m-body { display: flex; flex: 1; overflow: hidden; }

        /* ── Sidebar ── */
        .rx-m-sidebar {
            display: flex; flex-direction: column; width: 240px;
            padding: 8px 6px; background: #111113; border-right: 1px solid #2a2a2e;
            overflow-y: auto; flex-shrink: 0; gap: 2px;
        }
        .rx-m-tablist { display: flex; flex-direction: column; gap: 2px; }
        .rx-m-search-wrap {
            position: relative; padding: 4px 6px 8px;
        }
        .rx-m-search {
            width: 100%; padding: 8px 12px 8px 32px; background: #17171a;
            border: 1px solid #2a2a2e; border-radius: 8px; color: #f0f0f0;
            font-size: 13px; transition: all 180ms; outline: none;
        }
        .rx-m-search:focus { border-color: #85d551; box-shadow: 0 0 0 3px rgba(133,213,81,0.12); }
        .rx-m-search-icon {
            position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
            color: #71717a; pointer-events: none;
        }
        .rx-m-search-icon svg { width: 14px; height: 14px; }
        .rx-m-nav-btn {
            display: flex; align-items: center; gap: 10px; width: 100%;
            padding: 7px 10px; background: transparent; border: none;
            border-radius: 8px; cursor: pointer; text-align: left;
            transition: all 180ms; color: #c7d0e0; font-size: 13px; font-weight: 600;
        }
        .rx-m-nav-btn:hover { background: #1e1e22; }
        .rx-m-nav-btn.active { background: #27272a; color: #f0f0f0; font-weight: 600; }
        .rx-m-nav-icon {
            display: flex; align-items: center; justify-content: center;
            width: 30px; height: 30px; background: #17171a; border-radius: 6px;
            flex-shrink: 0; transition: all 180ms;
        }
        .rx-m-nav-icon svg { width: 16px; height: 16px; fill: currentColor; }
        .rx-m-nav-btn.active .rx-m-nav-icon {
            background: var(--rx-cat-color); color: #fff;
            box-shadow: 0 2px 10px color-mix(in srgb, var(--rx-cat-color) 40%, transparent);
        }
        .rx-m-nav-count {
            margin-left: auto; font-size: 10px; font-weight: 700; color: #d3dbea;
            background: #202632; padding: 2px 7px; border-radius: 6px;
        }
        .rx-m-nav-btn.active .rx-m-nav-count { background: rgba(255,255,255,0.18); color: #fff; }

        /* ── Content ── */
        .rx-m-content { flex: 1; padding: 20px 24px; overflow-y: auto; background: #0a0a0b; }
        .rx-m-pane { display: none; animation: rx-pane-in 250ms ease; }
        .rx-m-pane.active { display: block; }
        @keyframes rx-pane-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .rx-m-pane-header {
            display: flex; align-items: center; justify-content: space-between;
            margin: 0 0 16px; padding: 0 0 14px; border-bottom: 1px solid #2a2a2e;
        }
        .rx-m-pane-title { font-size: 18px; font-weight: 700; letter-spacing: 0; }
        .rx-m-toggle-all {
            display: flex; align-items: center; gap: 8px;
            font-size: 11px; color: #c7d0e0; cursor: pointer; user-select: none;
        }
        .rx-m-features-grid { display: flex; flex-direction: column; gap: 6px; }
        .rx-m-shield-status {
            display: flex; align-items: center; gap: 10px; min-height: 40px;
            margin: -4px 0 14px; padding: 9px 12px; border-radius: 8px;
            border: 1px solid rgba(133,213,81,0.26); background: rgba(133,213,81,0.055);
            color: #a8b3c5; font-size: 11px; line-height: 1.4;
        }
        .rx-m-shield-status::before {
            content: ''; width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto;
            background: #85d551; box-shadow: 0 0 0 4px rgba(133,213,81,0.10);
        }
        .rx-m-shield-status.is-limited { border-color: rgba(249,226,175,0.24); background: rgba(249,226,175,0.05); }
        .rx-m-shield-status.is-limited::before { background: #f9e2af; box-shadow: 0 0 0 4px rgba(249,226,175,0.09); }
        .rx-m-shield-title { color: #85d551; font-weight: 800; white-space: nowrap; }
        .rx-m-shield-status.is-limited .rx-m-shield-title { color: #f9e2af; }
        .rx-m-shield-note { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* ── Feature Card ── */
        .rx-m-card {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 14px; background: #17171a;
            border: 1px solid rgba(255,255,255,0.04); border-left: 3px solid transparent;
            border-radius: 8px; transition: all 180ms;
        }
        .rx-m-card:hover { background: #1e1e22; transform: translateX(2px); }
        .rx-m-card.rx-m-enabled {
            border-left-color: var(--rx-cat-color);
            background: color-mix(in srgb, var(--rx-cat-color) 4%, #17171a);
        }
        .rx-m-card.rx-m-sub { margin-left: 18px; border-left-width: 2px; }
        .rx-m-card-info { flex: 1; min-width: 0; padding-right: 16px; }
        .rx-m-card-name { font-size: 13px; font-weight: 600; color: #f0f0f0; margin: 0 0 2px; }
        .rx-m-card-desc { font-size: 11px; color: #aeb8ca; margin: 0; line-height: 1.4; }

        /* ── Switch ── */
        /* v3.1.0 — WCAG 2.2 SC 2.5.8 Target Size: bumped 40x22 → 40x24. */
        .rx-m-switch { position: relative; width: 40px; height: 24px; flex-shrink: 0; }
        .rx-m-switch input { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; z-index: 1; margin: 0; }
        .rx-m-switch-track {
            position: absolute; inset: 0; background: #27272a; border: 1px solid #2a2a2e;
            border-radius: 12px; transition: all 180ms;
        }
        .rx-m-switch.active .rx-m-switch-track {
            background: var(--rx-switch-color, #85d551); border-color: transparent;
            box-shadow: 0 0 8px color-mix(in srgb, var(--rx-switch-color, #85d551) 24%, transparent);
        }
        .rx-m-switch-thumb {
            /* v3.1.0 — thumb bumped 16 → 18 to match the 24px track height. */
            position: absolute; top: 3px; left: 3px; width: 18px; height: 18px;
            background: #fff; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,0.3);
            transition: all 180ms cubic-bezier(0.4,0,0.2,1);
        }
        .rx-m-switch.active .rx-m-switch-thumb { transform: translateX(16px); }

        /* ── Special Sections ── */
        .rx-m-section-title {
            font-size: 11px; font-weight: 700; color: #c7d0e0; text-transform: uppercase;
            letter-spacing: 0.5px; margin: 20px 0 10px; padding: 0 0 8px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .rx-m-chip-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .rx-m-chip {
            font-size: 11px; padding: 5px 12px; border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.08); background: #17171a;
            color: #f0f0f0; cursor: pointer; user-select: none;
            transition: all 180ms; display: flex; align-items: center; gap: 6px;
        }
        .rx-m-chip:hover { background: #1e1e22; border-color: rgba(255,255,255,0.15); }
        .rx-m-chip.rx-m-chip-active {
            border-color: var(--rx-cat-color, #85d551);
            background: color-mix(in srgb, var(--rx-cat-color, #85d551) 10%, #17171a);
            box-shadow: 0 0 8px color-mix(in srgb, var(--rx-cat-color, #85d551) 20%, transparent);
        }
        .rx-m-chip.rx-m-chip-hidden {
            opacity: 0.4; text-decoration: line-through; background: #0a0a0b;
            border-color: rgba(255,255,255,0.03);
        }
        .rx-m-theme-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .rx-m-unblock-chip svg { width: 10px; height: 10px; margin-left: 4px; flex-shrink: 0; }
        .rx-m-slider-row {
            display: flex; align-items: center; gap: 12px; padding: 4px 0 8px;
        }
        .rx-m-slider-row input[type=range] { flex: 1; accent-color: #85d551; height: 4px; }
        .rx-m-slider-label { font-size: 13px; font-weight: 600; color: #85d551; min-width: 36px; }
        .rx-m-empty { font-size: 11px; color: #aeb8ca; padding: 2px 0; }

        /* ── Footer ── */
        .rx-m-footer {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 24px; background: #111113;
            border-top: 1px solid #2a2a2e; flex-shrink: 0;
        }
        .rx-m-footer-left { display: flex; align-items: center; gap: 12px; }
        .rx-m-footer-right { display: flex; align-items: center; gap: 8px; }
        .rx-m-version { font-size: 11px; color: #aeb8ca; }
        .rx-m-btn {
            display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
            font-size: 12px; font-weight: 600; border: none; border-radius: 8px;
            cursor: pointer; transition: all 180ms; font-family: inherit;
        }
        .rx-m-btn-primary {
            color: #fff; background: linear-gradient(135deg, #85d551, #4aba0e);
            box-shadow: 0 2px 8px rgba(133,213,81,0.3);
        }
        .rx-m-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(133,213,81,0.4); }
        .rx-m-btn-secondary {
            color: #c7d0e0; background: #17171a; border: 1px solid #2a2a2e;
        }
        .rx-m-btn-secondary:hover { background: #1e1e22; color: #f0f0f0; }
        .rx-m-reload-note { font-size: 10px; color: rgba(166,173,200,0.5); text-align: center; padding: 12px 0 4px; }


    `,

    _makeSwitch(featureId, catColor, labelText = featureId) {
        const wrap = document.createElement('label');
        wrap.className = 'rx-m-switch' + (Settings.get(featureId) ? ' active' : '');
        wrap.style.setProperty('--rx-switch-color', catColor);
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Settings.get(featureId);
        input.dataset.featureId = featureId;
        input.setAttribute('aria-label', labelText);
        wrap.setAttribute('aria-label', labelText);
        input.addEventListener('change', () => {
            Settings.set(featureId, input.checked);
            wrap.classList.toggle('active', input.checked);
            const card = wrap.closest('.rx-m-card');
            if (card && !card.classList.contains('rx-m-sub')) card.classList.toggle('rx-m-enabled', input.checked);
            this._updateNavCounts();
            // Hot-reload: try to toggle the feature without a page reload
            const feat = features.find(f => f.id === featureId);
            if (feat && feat.destroy && feat.init) {
                try {
                    feat.destroy();
                } catch (destroyError) {
                    RxErrorLog?.record?.(featureId, destroyError, 'hot-toggle destroy');
                }
                // A throwing init() used to leave the switch on while the feature
                // did nothing. Revert the control and say so instead of claiming
                // the toggle worked.
                if (input.checked) {
                    try {
                        feat.init();
                    } catch (initError) {
                        RxErrorLog?.record?.(featureId, initError, 'hot-toggle init');
                        Settings.set(featureId, false);
                        input.checked = false;
                        wrap.classList.remove('active');
                        if (card && !card.classList.contains('rx-m-sub')) card.classList.remove('rx-m-enabled');
                        this._updateNavCounts();
                        RxToast.show('Could not enable ' + labelText + ' — reload the page to try again');
                        return;
                    }
                }
                RxToast.show(input.checked ? 'Enabled' : 'Disabled');
            } else {
                RxToast.show('Reload page to apply');
            }
        });
        const track = document.createElement('div');
        track.className = 'rx-m-switch-track';
        const thumb = document.createElement('div');
        thumb.className = 'rx-m-switch-thumb';
        wrap.append(input, track, thumb);
        return wrap;
    },

    _makeCard(feat, catColor, isSub) {
        const card = document.createElement('div');
        card.className = 'rx-m-card' + (isSub ? ' rx-m-sub' : '') + (Settings.get(feat.id) ? ' rx-m-enabled' : '');
        card.style.setProperty('--rx-cat-color', catColor);
        card.dataset.featureId = feat.id;
        card.dataset.searchText = (feat.label + ' ' + feat.desc).toLowerCase();
        const info = document.createElement('div');
        info.className = 'rx-m-card-info';
        const nameDiv = document.createElement('div');
        nameDiv.className = 'rx-m-card-name';
        nameDiv.textContent = feat.label;
        const descDiv = document.createElement('div');
        descDiv.className = 'rx-m-card-desc';
        descDiv.textContent = feat.desc;
        info.append(nameDiv, descDiv);
        card.append(info, this._makeSwitch(feat.id, catColor, feat.name || feat.id));
        return card;
    },

    _updateNavCounts() {
        for (const btn of this._navBtns || []) {
            const catId = btn.dataset.tab;
            const cat = RX_CATEGORIES.find(c => c.id === catId);
            if (!cat) continue;
            const total = cat.features.filter(f => !f.parent).length;
            const enabled = cat.features.filter(f => !f.parent && Settings.get(f.id)).length;
            const countEl = btn.querySelector('.rx-m-nav-count');
            if (countEl) countEl.textContent = `${enabled}/${total}`;
        }
    },

    _buildPane(cat) {
        const pane = document.createElement('section');
        pane.className = 'rx-m-pane';
        pane.id = 'rx-pane-' + cat.id;
        pane.setAttribute('role', 'tabpanel');
        pane.setAttribute('aria-labelledby', 'rx-nav-' + cat.id);
        pane.style.setProperty('--rx-cat-color', cat.color);

        // Header with title + enable-all toggle
        const header = document.createElement('div');
        header.className = 'rx-m-pane-header';
        const title = document.createElement('div');
        title.className = 'rx-m-pane-title';
        title.textContent = cat.label;
        header.appendChild(title);

        const toggleAll = document.createElement('label');
        toggleAll.className = 'rx-m-toggle-all';
        toggleAll.innerHTML = '<span>Enable All</span>';
        const allSwitch = this._makeSwitch('_all_' + cat.id, cat.color, `Enable all ${cat.label}`);
        const mainFeats = cat.features.filter(f => !f.parent);
        const allOn = mainFeats.every(f => Settings.get(f.id));
        allSwitch.classList.toggle('active', allOn);
        allSwitch.querySelector('input').checked = allOn;
        allSwitch.querySelector('input').dataset.featureId = '';
        allSwitch.querySelector('input').addEventListener('change', (e) => {
            e.stopImmediatePropagation();
            const isOn = e.target.checked;
            allSwitch.classList.toggle('active', isOn);
            for (const f of mainFeats) {
                Settings.set(f.id, isOn);
                const cb = pane.querySelector(`[data-feature-id="${f.id}"] input`);
                if (cb) { cb.checked = isOn; cb.dispatchEvent(new Event('change', { bubbles: true })); }
            }
        }, true);
        toggleAll.appendChild(allSwitch);
        header.appendChild(toggleAll);
        pane.appendChild(header);

        if (cat.id === 'ad-blocking') {
            const shield = document.createElement('div');
            const requestBlocking = !!RXPlatform.capabilities.requestBlocking;
            const requestMode = RXPlatform.capabilities.requestBlockingMode;
            shield.className = 'rx-m-shield-status' + (requestBlocking ? '' : ' is-limited');
            shield.setAttribute('role', 'status');
            const shieldTitle = document.createElement('strong');
            shieldTitle.className = 'rx-m-shield-title';
            shieldTitle.textContent = requestBlocking
                ? (RXPlatform.t('networkShieldActive') || 'Network shield active')
                : (RXPlatform.t('networkShieldManagerLimited') || 'Network shield depends on your userscript manager');
            const shieldNote = document.createElement('span');
            shieldNote.className = 'rx-m-shield-note';
            shieldNote.textContent = requestBlocking
                ? `${RXPlatform.t('networkShieldVerified') || '7 verified request rules'} · ${requestMode === 'firefox-webrequest' ? 'Firefox webRequest' : 'Chromium DNR'}`
                : (RXPlatform.t('networkShieldManagerNote') || 'DOM cleanup stays active; Chromium MV3 managers cannot expose early request blocking.');
            shield.append(shieldTitle, shieldNote);
            pane.appendChild(shield);
        }

        // Feature cards
        const grid = document.createElement('div');
        grid.className = 'rx-m-features-grid';
        for (const feat of cat.features) {
            grid.appendChild(this._makeCard(feat, cat.color, !!feat.parent));
        }
        pane.appendChild(grid);

        // Special sections per category
        if (cat.id === 'theme-layout') this._buildThemeSection(pane, cat.color);
        if (cat.id === 'video-player') this._buildSpeedSection(pane);
        if (cat.id === 'feed-controls') { this._buildBlockedSection(pane); this._buildKeywordSection(pane); }
        if (cat.id === 'ad-blocking') this._buildCategorySection(pane);
        if (cat.id === 'comments-chat') { this._buildBlockedChattersSection(pane); this._buildBlockedCommentersSection(pane); }

        return pane;
    },

    _buildListSection(pane, titleText, emptyText, placeholder, settingsKey) {
        const title = document.createElement('div');
        title.className = 'rx-m-section-title';
        title.textContent = titleText;
        pane.appendChild(title);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.style.cssText = 'width:100%;background:rgba(49,50,68,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:6px 10px;color:#cdd6f4;font-size:12px;margin-bottom:8px;outline:none;';
        pane.appendChild(input);

        const grid = document.createElement('div');
        grid.className = 'rx-m-chip-grid';
        pane.appendChild(grid);

        const renderEmpty = () => {
            const empty = document.createElement('span');
            empty.className = 'rx-m-empty';
            empty.textContent = emptyText;
            grid.appendChild(empty);
        };

        const render = () => {
            grid.innerHTML = '';
            const list = Settings.get(settingsKey) || [];
            if (!list.length) { renderEmpty(); return; }
            for (const item of list) {
                const chip = document.createElement('div');
                chip.className = 'rx-m-chip';
                const nameSpan = document.createElement('span');
                nameSpan.textContent = item;
                const close = document.createElement('span');
                close.textContent = '×';
                close.style.cssText = 'margin-left:6px;cursor:pointer;color:#f38ba8;font-weight:700;';
                chip.append(nameSpan, close);
                chip.addEventListener('click', () => {
                    const cur = Settings.get(settingsKey) || [];
                    const idx = cur.indexOf(item);
                    if (idx >= 0) cur.splice(idx, 1);
                    Settings.set(settingsKey, cur);
                    render();
                });
                grid.appendChild(chip);
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                const val = input.value.trim().toLowerCase();
                const cur = Settings.get(settingsKey) || [];
                if (!cur.includes(val)) {
                    cur.push(val);
                    Settings.set(settingsKey, cur);
                }
                input.value = '';
                render();
            }
        });

        render();
    },

    _buildKeywordSection(pane) {
        this._buildListSection(pane, 'Blocked Keywords', 'No keywords blocked', 'Add keyword (Enter to save)...', 'blockedKeywords');
    },

    _buildBlockedChattersSection(pane) {
        this._buildListSection(pane, 'Blocked Chatters', 'No chatters blocked', 'Add username (Enter to save)...', 'blockedChatters');
    },

    _buildBlockedCommentersSection(pane) {
        this._buildListSection(pane, 'Blocked Commenters', 'No commenters blocked', 'Add username (Enter to save)...', 'blockedCommenters');
    },

    _buildThemeSection(pane, color) {
        const title = document.createElement('div');
        title.className = 'rx-m-section-title';
        title.textContent = 'Theme';
        pane.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'rx-m-chip-grid';
        const currentTheme = Settings.get('theme') || 'catppuccin';
        for (const [id, theme] of Object.entries(THEMES)) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'rx-m-chip' + (id === currentTheme ? ' rx-m-chip-active' : '');
            chip.setAttribute('aria-pressed', String(id === currentTheme));
            chip.style.setProperty('--rx-cat-color', color);
            const dot = document.createElement('span');
            dot.className = 'rx-m-theme-dot';
            dot.style.background = theme.accent;
            chip.append(dot, theme.label);
            chip.addEventListener('click', () => {
                Settings.set('theme', id);
                for (const c of grid.querySelectorAll('.rx-m-chip')) c.classList.remove('rx-m-chip-active');
                for (const c of grid.querySelectorAll('.rx-m-chip')) c.setAttribute('aria-pressed', 'false');
                chip.classList.add('rx-m-chip-active');
                chip.setAttribute('aria-pressed', 'true');
                RxToast.show('Theme changed — reload page to apply');
            });
            grid.appendChild(chip);
        }
        pane.appendChild(grid);
    },

    _buildSpeedSection(pane) {
        const title = document.createElement('div');
        title.className = 'rx-m-section-title';
        title.textContent = 'Playback Speed';
        pane.appendChild(title);

        const row = document.createElement('div');
        row.className = 'rx-m-slider-row';
        const speeds = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
        const slider = document.createElement('input');
        slider.type = 'range'; slider.min = '0'; slider.max = '9'; slider.step = '1';
        slider.value = speeds.indexOf(Settings.get('playbackSpeed') || 1.0);
        if (slider.value === '-1') slider.value = '3';
        const label = document.createElement('span');
        label.className = 'rx-m-slider-label';
        label.textContent = (Settings.get('playbackSpeed') || 1.0) + 'x';
        slider.addEventListener('input', () => {
            const speed = speeds[parseInt(slider.value)];
            label.textContent = speed + 'x';
            Settings.set('playbackSpeed', speed);
            for (const v of qsa('video')) v.playbackRate = speed;
            RxToast.show(`Speed: ${speed}x`);
        });
        row.append(slider, label);
        pane.appendChild(row);
    },

    _buildBlockedSection(pane) {
        const title = document.createElement('div');
        title.className = 'rx-m-section-title';
        title.textContent = 'Blocked Channels';
        pane.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'rx-m-chip-grid';
        grid.id = 'rx-blocked-list';
        const blocked = Settings.get('blockedChannels') || [];
        if (blocked.length === 0) {
            const empty = document.createElement('span');
            empty.className = 'rx-m-empty';
            empty.textContent = 'No channels blocked';
            grid.appendChild(empty);
        } else {
            for (const ch of blocked) {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'rx-m-chip';
                const nameSpan = document.createElement('span');
                nameSpan.textContent = ch;
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
                svg.setAttribute('stroke-width', '2.5');
                svg.setAttribute('stroke-linecap', 'round');
                const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                l1.setAttribute('x1', '18'); l1.setAttribute('y1', '6'); l1.setAttribute('x2', '6'); l1.setAttribute('y2', '18');
                const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                l2.setAttribute('x1', '6'); l2.setAttribute('y1', '6'); l2.setAttribute('x2', '18'); l2.setAttribute('y2', '18');
                svg.append(l1, l2);
                chip.append(nameSpan, svg);
                chip.title = 'Unblock ' + ch;
                chip.setAttribute('aria-label', 'Unblock ' + ch);
                chip.addEventListener('click', () => {
                    ChannelBlocker._unblockChannel(ch);
                    chip.remove();
                    if (!grid.children.length) {
                        const empty = document.createElement('span');
                        empty.className = 'rx-m-empty';
                        empty.textContent = 'No channels blocked';
                        grid.appendChild(empty);
                    }
                });
                grid.appendChild(chip);
            }
        }
        pane.appendChild(grid);
    },

    _buildCategorySection(pane) {
        const title = document.createElement('div');
        title.className = 'rx-m-section-title';
        title.textContent = 'Homepage Categories';
        pane.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'rx-m-chip-grid';
        const hiddenCats = Settings.get('hiddenCategories') || [];
        for (const cat of CategoryFilter._allCategories) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'rx-m-chip' + (hiddenCats.includes(cat.id) ? ' rx-m-chip-hidden' : '');
            chip.textContent = cat.label;
            chip.setAttribute('aria-pressed', String(hiddenCats.includes(cat.id)));
            chip.addEventListener('click', () => {
                const current = Settings.get('hiddenCategories') || [];
                const idx = current.indexOf(cat.id);
                if (idx >= 0) { current.splice(idx, 1); chip.classList.remove('rx-m-chip-hidden'); chip.setAttribute('aria-pressed', 'false'); }
                else { current.push(cat.id); chip.classList.add('rx-m-chip-hidden'); chip.setAttribute('aria-pressed', 'true'); }
                Settings.set('hiddenCategories', current);
                if (Page.isHome()) CategoryFilter._apply();
            });
            grid.appendChild(chip);
        }
        pane.appendChild(grid);
    },

    _build() {
        this._navBtns = [];

        // Overlay
        const overlay = document.createElement('div');
        overlay.id = 'rx-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.addEventListener('click', () => this._close());
        this._overlayEl = overlay;

        // Modal
        const modal = document.createElement('div');
        modal.id = 'rx-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'rx-m-title');
        modal.setAttribute('aria-hidden', 'true');
        if ('inert' in modal) modal.inert = true;

        // Header
        const header = document.createElement('div');
        header.className = 'rx-m-header';
        header.innerHTML = `
            <div class="rx-m-brand">
                <span class="rx-m-title" id="rx-m-title"><span class="rx-m-title-rx">Rumble</span>X</span>
                <span class="rx-m-badge">v${VERSION}</span>
            </div>`;
        const closeBtn = document.createElement('button');
        closeBtn.className = 'rx-m-close';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close RumbleX settings');
        closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        closeBtn.querySelector('svg')?.setAttribute('aria-hidden', 'true');
        closeBtn.addEventListener('click', () => this._close());
        header.appendChild(closeBtn);
        modal.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'rx-m-body';

        // Sidebar
        const sidebar = document.createElement('div');
        sidebar.className = 'rx-m-sidebar';
        const searchWrap = document.createElement('div');
        searchWrap.className = 'rx-m-search-wrap';
        searchWrap.innerHTML = '<span class="rx-m-search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>';
        const searchInput = document.createElement('input');
        searchInput.className = 'rx-m-search';
        searchInput.placeholder = 'Search features...';
        searchInput.type = 'text';
        searchInput.setAttribute('aria-label', 'Search RumbleX features');
        let searchTimer = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => this._filterSearch(searchInput.value), 150);
        });
        searchWrap.appendChild(searchInput);
        sidebar.appendChild(searchWrap);
        const tablist = document.createElement('nav');
        tablist.className = 'rx-m-tablist';
        tablist.setAttribute('role', 'tablist');
        tablist.setAttribute('aria-label', 'RumbleX settings categories');
        sidebar.appendChild(tablist);

        // Content
        const content = document.createElement('div');
        content.className = 'rx-m-content';
        this._contentEl = content;

        for (let i = 0; i < RX_CATEGORIES.length; i++) {
            const cat = RX_CATEGORIES[i];
            // Nav button
            const navBtn = document.createElement('button');
            navBtn.type = 'button';
            navBtn.className = 'rx-m-nav-btn' + (i === 0 ? ' active' : '');
            navBtn.id = 'rx-nav-' + cat.id;
            navBtn.dataset.tab = cat.id;
            navBtn.setAttribute('role', 'tab');
            navBtn.setAttribute('aria-controls', 'rx-pane-' + cat.id);
            navBtn.setAttribute('aria-selected', String(i === 0));
            navBtn.tabIndex = i === 0 ? 0 : -1;
            navBtn.style.setProperty('--rx-cat-color', cat.color);
            const navIcon = document.createElement('span');
            navIcon.className = 'rx-m-nav-icon';
            navIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor">${cat.icon}</svg>`;
            const navLabel = document.createElement('span');
            navLabel.textContent = cat.label;
            const mainFeats = cat.features.filter(f => !f.parent);
            const enabledCount = mainFeats.filter(f => Settings.get(f.id)).length;
            const navCount = document.createElement('span');
            navCount.className = 'rx-m-nav-count';
            navCount.textContent = `${enabledCount}/${mainFeats.length}`;
            navBtn.append(navIcon, navLabel, navCount);
            navBtn.addEventListener('click', () => this._switchTab(cat.id));
            tablist.appendChild(navBtn);
            this._navBtns.push(navBtn);

            // Pane
            const pane = this._buildPane(cat);
            if (i === 0) pane.classList.add('active');
            else pane.hidden = true;
            content.appendChild(pane);
        }
        tablist.addEventListener('keydown', (e) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
            const current = this._navBtns.indexOf(document.activeElement);
            if (current < 0) return;
            e.preventDefault();
            const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? this._navBtns.length - 1
                : (current + (forward ? 1 : -1) + this._navBtns.length) % this._navBtns.length;
            this._switchTab(this._navBtns[next].dataset.tab);
            this._navBtns[next].focus();
        });

        body.append(sidebar, content);
        modal.appendChild(body);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'rx-m-footer';
        footer.innerHTML = `
            <div class="rx-m-footer-left">
                <span class="rx-m-version">v${VERSION}</span>
            </div>
            <div class="rx-m-footer-right"></div>`;
        const exportBtn = document.createElement('button');
        exportBtn.className = 'rx-m-btn rx-m-btn-primary';
        exportBtn.textContent = 'Export';
        exportBtn.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(Settings._cache, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = 'rumblex-settings.json'; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
        const importBtn = document.createElement('button');
        importBtn.className = 'rx-m-btn rx-m-btn-secondary';
        importBtn.textContent = 'Import';
        importBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.json';
            input.addEventListener('change', () => {
                const file = input.files[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                    RxToast.show('Import failed: file exceeds the 5 MB limit');
                    return;
                }
                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        const parsed = JSON.parse(reader.result);
                        const source = parsed?.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed;
                        const sanitized = Settings._sanitize(source);
                        if (!Object.keys(sanitized).length) throw new Error('No recognized RumbleX settings found');
                        if (new Blob([JSON.stringify(sanitized)]).size > 4.5 * 1024 * 1024) {
                            throw new Error('Sanitized settings exceed the storage-safe size limit');
                        }
                        await rxBackupSnapshot('pre-in-page-import');
                        Settings._cache = { ...Settings._defaults, ...sanitized };
                        await RXPlatform.storage.set({ rx_settings: Settings._cache });
                        location.reload();
                    } catch (e) {
                        console.error('[RumbleX] Import failed:', e);
                        RxToast.show('Import failed: ' + String(e?.message || e));
                    }
                };
                reader.readAsText(file);
            });
            input.click();
        });
        footer.querySelector('.rx-m-footer-right').append(importBtn, exportBtn);
        modal.appendChild(footer);

        this._panelEl = modal;

        // Toolbar (FAB buttons)
        const toolbar = document.createElement('div');
        toolbar.id = 'rx-toolbar';
        const homeBtn = document.createElement('a');
        homeBtn.id = 'rx-home-btn';
        homeBtn.className = 'rx-tb-btn';
        homeBtn.href = Settings.get('logoToFeed') ? 'https://rumble.com/subscriptions' : 'https://rumble.com/';
        homeBtn.title = Settings.get('logoToFeed') ? 'My Feed' : 'Rumble Home';
        homeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M6.5 3C4.015 3 2 5.015 2 7.5v9C2 18.985 4.015 21 6.5 21h11c2.485 0 4.5-2.015 4.5-4.5v-9C22 5.015 19.985 3 17.5 3h-11zm3.25 4.5c.69 0 1.25.56 1.25 1.25v1.5l2.5-2.25c.33-.3.76-.5 1.22-.5h.78c.97 0 1.45 1.17.77 1.85L13.5 12l2.72 2.65c.68.68.2 1.85-.77 1.85h-.78c-.46 0-.89-.18-1.22-.5L11 13.75v1.5c0 .69-.56 1.25-1.25 1.25S8.5 15.94 8.5 15.25v-7.5c0-.69.56-1.25 1.25-1.25z" fill="#85d551"/></svg>';
        toolbar.appendChild(homeBtn);

        if (Page.isWatch() && Settings.get('videoDownload')) {
            const dlBtn = document.createElement('button');
            dlBtn.id = 'rx-download-btn'; dlBtn.className = 'rx-tb-btn'; dlBtn.title = 'Download Video';
            dlBtn.innerHTML = VideoDownloader._downloadSVG;
            dlBtn.addEventListener('click', () => VideoDownloader._showDownloadTab());
            toolbar.appendChild(dlBtn);
        }

        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'rx-settings-btn'; settingsBtn.className = 'rx-tb-btn'; settingsBtn.title = 'RumbleX Settings';
        settingsBtn.type = 'button';
        settingsBtn.setAttribute('aria-label', 'Open RumbleX settings');
        settingsBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/></svg>';
        settingsBtn.querySelector('svg')?.setAttribute('aria-hidden', 'true');
        settingsBtn.addEventListener('click', () => this._toggle());
        toolbar.appendChild(settingsBtn);
        this._toolbarEl = toolbar;

        this._keyHandler = (e) => {
            if (e.key === 'Tab' && document.body.classList.contains('rx-panel-open')) {
                this._trapFocus(e);
            }
            if (e.key === 'Escape' && document.body.classList.contains('rx-panel-open')) {
                this._close();
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    },

    _toggle() {
        if (document.body.classList.contains('rx-panel-open')) this._close();
        else this._open();
    },

    _focusableModalElements() {
        if (!this._panelEl) return [];
        return Array.from(this._panelEl.querySelectorAll([
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(','))).filter((el) => el instanceof HTMLElement && el.offsetParent !== null);
    },

    _open() {
        if (document.body.classList.contains('rx-panel-open')) return;
        this._lastFocusedEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this._overlayEl?.removeAttribute('aria-hidden');
        this._panelEl?.removeAttribute('aria-hidden');
        if (this._panelEl && 'inert' in this._panelEl) this._panelEl.inert = false;
        document.body.classList.add('rx-panel-open');
        requestAnimationFrame(() => {
            const target = this._panelEl?.querySelector('.rx-m-search') || this._panelEl?.querySelector('.rx-m-close');
            if (target instanceof HTMLElement) target.focus({ preventScroll: true });
        });
    },

    _close() {
        if (!document.body.classList.contains('rx-panel-open')) return;
        document.body.classList.remove('rx-panel-open');
        this._overlayEl?.setAttribute('aria-hidden', 'true');
        this._panelEl?.setAttribute('aria-hidden', 'true');
        if (this._panelEl && 'inert' in this._panelEl) this._panelEl.inert = true;
        const returnTarget = this._lastFocusedEl;
        this._lastFocusedEl = null;
        if (returnTarget && document.contains(returnTarget)) {
            requestAnimationFrame(() => returnTarget.focus({ preventScroll: true }));
        }
    },

    _trapFocus(e) {
        const focusable = this._focusableModalElements();
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus({ preventScroll: true });
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus({ preventScroll: true });
        }
    },

    _switchTab(catId) {
        for (const btn of this._navBtns) {
            const active = btn.dataset.tab === catId;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', String(active));
            btn.tabIndex = active ? 0 : -1;
        }
        for (const pane of this._contentEl.querySelectorAll('.rx-m-pane')) {
            const active = pane.id === 'rx-pane-' + catId;
            pane.classList.toggle('active', active);
            pane.hidden = !active;
        }
    },

    _filterSearch(query) {
        query = query.toLowerCase().trim();
        const allPanes = this._contentEl.querySelectorAll('.rx-m-pane');
        const allCards = this._contentEl.querySelectorAll('.rx-m-card');

        if (!query) {
            allCards.forEach(c => c.style.display = '');
            allPanes.forEach(p => p.style.display = '');
            // Restore first active
            const activeBtn = this._navBtns.find(b => b.classList.contains('active'));
            allPanes.forEach(p => p.classList.remove('active'));
            if (activeBtn) {
                const pane = this._contentEl.querySelector('#rx-pane-' + activeBtn.dataset.tab);
                if (pane) pane.classList.add('active');
            }
            return;
        }

        // Show all panes, filter cards
        allPanes.forEach(p => { p.classList.add('active'); p.style.display = ''; });
        let anyMatch = false;
        allCards.forEach(card => {
            const text = card.dataset.searchText || '';
            const match = text.includes(query);
            card.style.display = match ? '' : 'none';
            if (match) anyMatch = true;
        });

        // Hide panes with zero visible cards
        allPanes.forEach(pane => {
            const visible = pane.querySelectorAll('.rx-m-card:not([style*="display: none"])').length;
            if (visible === 0) pane.style.display = 'none';
        });
    },

    init() {
        this._styleEl = injectStyle(this._css, 'rx-settings-css');
        this._build();
        document.body.appendChild(this._overlayEl);
        document.body.appendChild(this._panelEl);
        document.body.appendChild(this._toolbarEl);
    },

    destroy() {
        this._styleEl?.remove();
        this._overlayEl?.remove();
        this._panelEl?.remove();
        this._toolbarEl?.remove();
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
        this._styleEl = null;
        this._overlayEl = null;
        this._panelEl = null;
        this._toolbarEl = null;
        this._keyHandler = null;
        this._navBtns = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Full Titles (no truncation)
// ═══════════════════════════════════════════
const FullTitles = {
    id: 'fullTitles',
    name: 'Full Titles',
    _styleEl: null,
    _css: `
        html.rumblex-active .thumbnail__title,
        html.rumblex-active .videostream__title,
        html.rumblex-active .mediaList-heading,
        html.rumblex-active .media-item__title,
        html.rumblex-active .video-item--title,
        html.rumblex-active rum-video-thumbnail rum-text[role="heading"],
        html.rumblex-active h3.thumbnail__title {
            -webkit-line-clamp: unset !important;
            line-clamp: unset !important;
            display: block !important;
            overflow: visible !important;
            white-space: normal !important;
            text-overflow: clip !important;
            max-height: none !important;
        }
    `,
    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-fulltitles-css');
    },
    destroy() { this._styleEl?.remove(); }
};

// ═══════════════════════════════════════════
//  FEATURE: Title Font Override
// ═══════════════════════════════════════════
const TitleFont = {
    id: 'titleFont',
    name: 'Title Font',
    _styleEl: null,
    _css: `
        html.rumblex-active .thumbnail__title,
        html.rumblex-active .videostream__title,
        html.rumblex-active .mediaList-heading,
        html.rumblex-active .video-item--title,
        html.rumblex-active rum-video-thumbnail rum-text[role="heading"],
        html.rumblex-active .video-header-container__title,
        html.rumblex-active h1.video-header-container__title {
            font-weight: 500 !important;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif !important;
            letter-spacing: 0 !important;
        }
    `,
    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-titlefont-css');
    },
    destroy() { this._styleEl?.remove(); }
};

// ═══════════════════════════════════════════
//  FEATURE: Unique Chatters / Message Count
// ═══════════════════════════════════════════
const UniqueChatters = {
    id: 'uniqueChatters',
    name: 'Unique Chatters',
    _styleEl: null,
    _obs: null,
    _bar: null,
    _users: null,
    _msgCount: 0,

    _css: `
        .rx-chatter-bar {
            display: flex; gap: 14px; padding: 6px 10px;
            background: rgba(30,30,46,0.85);
            border-bottom: 1px solid rgba(255,255,255,0.05);
            font: 600 11px/1 system-ui, sans-serif;
            color: #cdd6f4; flex-shrink: 0;
        }
        .rx-chatter-bar .rx-cb-label { color: #a6adc8; font-weight: 500; }
        .rx-chatter-bar .rx-cb-val { color: var(--rx-accent, #89b4fa); }
    `,

    _msgSel: '#chat-history-list li, .chat--message-container',

    _rescan() {
        this._users = new Set();
        this._msgCount = 0;
        for (const m of qsa(this._msgSel)) {
            const u = rxReadUsername(m);
            if (u) { this._users.add(u); this._msgCount++; }
        }
        this._paint();
    },

    _paint() {
        if (!this._bar) return;
        this._bar.querySelector('.rx-cb-users').textContent = this._users?.size || 0;
        this._bar.querySelector('.rx-cb-msgs').textContent = this._msgCount;
    },

    _mount(chatEl) {
        if (this._bar) return;
        const bar = document.createElement('div');
        bar.className = 'rx-chatter-bar';
        bar.innerHTML = `
            <span><span class="rx-cb-label">Chatters:</span> <span class="rx-cb-val rx-cb-users">0</span></span>
            <span><span class="rx-cb-label">Messages:</span> <span class="rx-cb-val rx-cb-msgs">0</span></span>`;
        chatEl.parentNode?.insertBefore(bar, chatEl);
        this._bar = bar;
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-chatters-css');
        waitForFeature(this, '#chat-history-list').then((chatEl) => {
            this._mount(chatEl);
            this._rescan();
            // Debounce — a full re-scan on every message mutation is O(n) and
            // high-traffic streams can fire many mutations per second.
            this._obs = new MutationObserver(() => {
                clearTimeout(this._t);
                this._t = setTimeout(() => this._rescan(), 250);
            });
            this._obs.observe(chatEl, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        clearTimeout(this._t);
        this._bar?.remove();
        this._bar = null;
    }
};

// ═══════════════════════════════════════════
//  Shared chat helpers (used by ChatUserBlock / UniqueChatters / ChatExport)
// ═══════════════════════════════════════════
// Defensive username reader: honour data-username first, otherwise read the
// element's own text BUT strip any RX-injected children (block button, rant
// badge). Without this, ChatUserBlock's own button text would be appended to
// the username and break exact-match blocking.
function rxReadUsername(msg) {
    const el = msg.querySelector('.chat-history--username, .chat--message-username, [data-username]');
    if (!el) return null;
    if (el.dataset && el.dataset.username) return el.dataset.username.trim().toLowerCase();
    const clone = el.cloneNode(true);
    clone.querySelectorAll('.rx-chat-block-btn, .rx-rant-persist-badge').forEach((n) => n.remove());
    return (clone.textContent || '').trim().toLowerCase();
}

// ═══════════════════════════════════════════
//  FEATURE: Chat User Block (per-user hide)
// ═══════════════════════════════════════════
const ChatUserBlock = {
    id: 'chatUserBlock',
    name: 'Chat User Block',
    _styleEl: null,
    _obs: null,

    _css: `
        .rx-blocked-msg { display: none !important; }
        /* Rendered inline AFTER the username element so username readers don't
           see the button's text. Shown only on hover. */
        .rx-chat-block-btn {
            margin-left: 6px; cursor: pointer; opacity: 0; transition: opacity .15s;
            font: 600 9px/1.4 system-ui, sans-serif; color: #f38ba8;
            background: rgba(243,139,168,0.1); border: 1px solid rgba(243,139,168,0.3);
            border-radius: 4px; padding: 1px 5px; vertical-align: baseline;
        }
        #chat-history-list li:hover .rx-chat-block-btn,
        .chat--message-container:hover .rx-chat-block-btn { opacity: 1; }
        .rx-chat-block-btn:hover { background: rgba(243,139,168,0.25); }
    `,

    _blocked() {
        return new Set((Settings.get('blockedChatters') || []).map((u) => String(u).toLowerCase()));
    },

    _process() {
        const blocked = this._blocked();
        const sel = '#chat-history-list li, .chat--message-container';
        for (const msg of qsa(sel)) {
            const u = rxReadUsername(msg);
            if (!u) continue;
            msg.classList.toggle('rx-blocked-msg', blocked.has(u));
            if (msg.dataset.rxBlockBtn) continue;
            const nameEl = msg.querySelector('.chat-history--username, .chat--message-username');
            if (!nameEl) continue; // retry on next tick — don't mark as processed yet
            msg.dataset.rxBlockBtn = '1';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rx-chat-block-btn';
            btn.textContent = 'block';
            btn.title = `Block ${u} in chat`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const list = Settings.get('blockedChatters') || [];
                if (!list.map((x) => String(x).toLowerCase()).includes(u)) {
                    list.push(u);
                    Settings.set('blockedChatters', list);
                }
                this._process();
            });
            // Insert AFTER the username element, not inside it, so other modules
            // (rxReadUsername / ChatExport) don't read "username block" as the name.
            nameEl.insertAdjacentElement('afterend', btn);
        }
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-chatuserblock-css');
        waitForFeature(this, '#chat-history-list').then((chatEl) => {
            this._process();
            this._obs = new MutationObserver(() => this._process());
            this._obs.observe(chatEl, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Chat Spam Dedup
// ═══════════════════════════════════════════
const ChatSpamDedup = {
    id: 'chatSpamDedup',
    name: 'Chat Spam Dedup',
    _styleEl: null,
    _obs: null,
    _last: [],
    _MAX_WINDOW: 30,

    _css: `.rx-spam-dup { display: none !important; }`,

    _textOf(msg) {
        const el = msg.querySelector('.chat--message-text, .chat--message, .chat-history--message');
        return (el ? el.textContent : msg.textContent || '').trim().toLowerCase();
    },

    _process() {
        for (const msg of qsa('#chat-history-list li, .chat--message-container')) {
            if (msg.dataset.rxDedupSeen) continue;
            msg.dataset.rxDedupSeen = '1';
            const t = this._textOf(msg);
            if (t && t.length >= 3 && this._last.includes(t)) {
                msg.classList.add('rx-spam-dup');
            }
            this._last.push(t);
            if (this._last.length > this._MAX_WINDOW) this._last.shift();
        }
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-spamdedup-css');
        waitForFeature(this, '#chat-history-list').then(chatEl => {
            this._process();
            this._obs = new MutationObserver(() => this._process());
            this._obs.observe(chatEl, { childList: true, subtree: true });
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._last = [];
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Chat Export
// ═══════════════════════════════════════════
const ChatExport = {
    id: 'chatExport',
    name: 'Chat Export',
    _styleEl: null,
    _btn: null,

    _css: `
        .rx-chat-export-btn {
            background: rgba(49,50,68,0.5); border: 1px solid rgba(137,180,250,0.25);
            color: #cdd6f4; border-radius: 6px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif; margin-left: 6px;
            transition: background .15s, border-color .15s;
        }
        .rx-chat-export-btn:hover { background: rgba(49,50,68,0.8); border-color: rgba(137,180,250,0.5); }
    `,

    _collect() {
        const out = [];
        for (const msg of qsa('#chat-history-list li, .chat--message-container')) {
            if (msg.classList.contains('rx-blocked-msg') || msg.classList.contains('rx-spam-dup')) continue;
            const textEl = msg.querySelector('.chat--message-text, .chat-history--message');
            const timeEl = msg.querySelector('.chat-history--timestamp, time');
            const rantEl = msg.querySelector('.chat-history--rant-price');
            // Use the shared reader so RX-injected button/badge text doesn't
            // leak into the exported username.
            const user = rxReadUsername(msg) || '';
            // For readable text, strip known RX classes the same way.
            let text = '';
            if (textEl) text = textEl.textContent.trim();
            else {
                const cl = msg.cloneNode(true);
                cl.querySelectorAll('.rx-chat-block-btn, .rx-rant-persist-badge').forEach((n) => n.remove());
                text = (cl.textContent || '').trim();
            }
            out.push({
                time: timeEl ? timeEl.textContent.trim() : '',
                user,
                text,
                rant: rantEl ? rantEl.textContent.trim() : null,
            });
        }
        return out;
    },

    _download(format) {
        const msgs = this._collect();
        const title = (qs('.video-header-container__title') || qs('h1'))?.textContent?.trim() || 'rumble';
        const safe = title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 80);
        let blob;
        if (format === 'json') {
            blob = new Blob([JSON.stringify(msgs, null, 2)], { type: 'application/json' });
        } else {
            const txt = msgs.map(m => `[${m.time}] ${m.user}${m.rant ? ' (' + m.rant + ')' : ''}: ${m.text}`).join('\n');
            blob = new Blob([txt], { type: 'text/plain' });
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${safe} - chat.${format === 'json' ? 'json' : 'txt'}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    },

    _mount() {
        const header = qs('.chat--header');
        if (!header || qs('.rx-chat-export-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'rx-chat-export-btn';
        btn.textContent = 'Export';
        btn.title = 'Export chat (click: TXT, shift-click: JSON)';
        btn.addEventListener('click', (e) => this._download(e.shiftKey ? 'json' : 'txt'));
        header.appendChild(btn);
        this._btn = btn;
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-chatexport-css');
        waitForFeature(this, '.chat--header').then(() => this._mount()).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Rant Persist (keep rants past expiry + export)
// ═══════════════════════════════════════════
const RantPersist = {
    id: 'rantPersist',
    name: 'Rant Persist',
    _styleEl: null,
    _obs: null,
    _cached: [],

    _css: `
        .chat-history--rant.rx-rant-persist {
            animation: none !important;
            opacity: 1 !important;
            filter: none !important;
            display: flex !important;
            visibility: visible !important;
        }
        .rx-rant-persist-badge {
            display: inline-block; margin-left: 6px; padding: 1px 5px;
            background: rgba(249,226,175,0.15); color: #f9e2af;
            border-radius: 4px; font: 600 9px/1.4 system-ui, sans-serif;
        }
        .rx-rant-export-btn {
            position: absolute; top: 4px; right: 4px;
            background: rgba(30,30,46,0.9); border: 1px solid rgba(249,226,175,0.3);
            color: #f9e2af; border-radius: 5px; padding: 2px 8px; cursor: pointer;
            font: 600 10px/1 system-ui, sans-serif; opacity: 0.8;
        }
        .rx-rant-export-btn:hover { opacity: 1; }
    `,

    _MAX_PER_VIDEO: 500,
    _MAX_KEPT_VIDEOS: 100,
    _MIRROR_KEY: 'rx_rant_stats_mirror',
    _MIRROR_MAX_VIDEOS: 30,
    _MIRROR_MAX_PER_VIDEO: 200,
    _mirrorWriteTimer: null,

    _videoKey() {
        const m = location.pathname.match(/^\/(v[a-z0-9]+)/);
        return m ? 'rx_rants_' + m[1] : null;
    },

    _videoIdRaw() {
        const m = location.pathname.match(/^\/(v[a-z0-9]+)/);
        return m ? m[1] : null;
    },

    _videoTitle() {
        const og = document.querySelector('meta[property="og:title"]');
        const ogContent = og ? (og.getAttribute('content') || '').trim() : '';
        if (ogContent) return ogContent;
        const t = (document.title || '').trim();
        return t.replace(/\s*[-—|]\s*Rumble\s*$/i, '').trim();
    },

    // RantStats panel mirror — chrome.storage.local copy of the per-video rant
    // cache so the options page (which can't reach rumble.com localStorage)
    // can render history across all watched videos. Debounced to avoid hammering
    // storage during high-volume rant streams.
    _scheduleMirrorWrite() {
        if (this._mirrorWriteTimer) return;
        this._mirrorWriteTimer = setFeatureTimeout(this, () => {
            this._mirrorWriteTimer = null;
            void this._flushMirror();
        }, 1500);
    },

    async _flushMirror() {
        const videoId = this._videoIdRaw();
        if (!videoId) return;
        try {
            const got = await RXPlatform.storage.get([this._MIRROR_KEY]);
            const root = (got && got[this._MIRROR_KEY] && typeof got[this._MIRROR_KEY] === 'object') ? got[this._MIRROR_KEY] : { videos: {} };
            if (!root.videos || typeof root.videos !== 'object') root.videos = {};
            const slice = (this._cached || []).slice(-this._MIRROR_MAX_PER_VIDEO);
            const prev = root.videos[videoId] || {};
            const lastTs = slice.length ? slice[slice.length - 1].ts || Date.now() : Date.now();
            root.videos[videoId] = {
                title: prev.title || this._videoTitle() || videoId,
                url: location.origin + location.pathname,
                lastTs,
                read: prev.read === true ? true : false,
                rants: slice,
            };
            const ids = Object.keys(root.videos);
            if (ids.length > this._MIRROR_MAX_VIDEOS) {
                const sorted = ids
                    .map((id) => ({ id, ts: root.videos[id].lastTs || 0 }))
                    .sort((a, b) => a.ts - b.ts);
                const drop = sorted.slice(0, ids.length - this._MIRROR_MAX_VIDEOS);
                for (const { id } of drop) delete root.videos[id];
            }
            await RXPlatform.storage.set({ [this._MIRROR_KEY]: root });
        } catch {}
    },

    // Keep localStorage growth bounded. Same pattern as WatchProgress /
    // WatchHistory: prune the oldest rx_rants_* keys when we exceed the cap.
    _pruneGlobal() {
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('rx_rants_')) keys.push(k);
            }
            if (keys.length <= this._MAX_KEPT_VIDEOS) return;
            // Sort by max ts in each entry (fallback to 0). Oldest first.
            const scored = keys.map((k) => {
                let maxTs = 0;
                try {
                    const arr = JSON.parse(localStorage.getItem(k)) || [];
                    for (const e of arr) if (e && e.ts > maxTs) maxTs = e.ts;
                } catch {}
                return { k, maxTs };
            }).sort((a, b) => a.maxTs - b.maxTs);
            const drop = scored.slice(0, keys.length - this._MAX_KEPT_VIDEOS);
            for (const { k } of drop) localStorage.removeItem(k);
        } catch {}
    },

    _cache(rantEl) {
        const priceEl = rantEl.querySelector('.chat-history--rant-price');
        const userEl = rantEl.querySelector('.chat-history--username');
        const textEl = rantEl.querySelector('.chat--message, .chat-history--message');
        const level = rantEl.getAttribute('data-level') || '1';
        // Strip RX-injected children when reading the username so the cache
        // stores the real chatter name (consistent with rxReadUsername).
        let user = '';
        if (userEl) {
            const clone = userEl.cloneNode(true);
            clone.querySelectorAll('.rx-chat-block-btn, .rx-rant-persist-badge').forEach((n) => n.remove());
            user = (clone.textContent || '').trim();
        }
        const entry = {
            price: priceEl ? priceEl.textContent.trim() : '',
            user,
            text: textEl ? textEl.textContent.trim() : '',
            level, ts: Date.now(),
        };
        if (this._cached.some((c) => c.user === entry.user && c.text === entry.text && c.price === entry.price)) return;
        this._cached.push(entry);
        // Cap per-video so one stream can't hog localStorage on its own.
        if (this._cached.length > this._MAX_PER_VIDEO) {
            this._cached.splice(0, this._cached.length - this._MAX_PER_VIDEO);
        }
        const key = this._videoKey();
        if (!key) return;
        try {
            localStorage.setItem(key, JSON.stringify(this._cached));
        } catch {
            // QuotaExceeded — prune and retry once
            this._pruneGlobal();
            try { localStorage.setItem(key, JSON.stringify(this._cached)); } catch {}
        }
        // Debounced mirror to chrome.storage.local for the options-page RantStats panel.
        this._scheduleMirrorWrite();
    },

    _persist() {
        for (const r of qsa('.chat-history--rant')) {
            if (r.dataset.rxPersisted) {
                if (!r.classList.contains('rx-rant-persist')) r.classList.add('rx-rant-persist');
                continue;
            }
            r.dataset.rxPersisted = '1';
            r.classList.add('rx-rant-persist');
            const userEl = r.querySelector('.chat-history--username');
            if (userEl && !r.querySelector('.rx-rant-persist-badge')) {
                const badge = document.createElement('span');
                badge.className = 'rx-rant-persist-badge';
                badge.textContent = 'RX';
                // Insert as sibling AFTER the username element so username readers
                // in other modules (ChatUserBlock/UniqueChatters/ChatExport) don't
                // pick up the badge text as part of the username.
                userEl.insertAdjacentElement('afterend', badge);
            }
            this._cache(r);
        }
    },

    _export() {
        const blob = new Blob([JSON.stringify(this._cached, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rumble-rants.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-rantpersist-css');
        // Run global prune at most once per page-load to bound growth over time.
        this._pruneGlobal();
        const key = this._videoKey();
        if (key) {
            try {
                const raw = localStorage.getItem(key);
                if (raw) this._cached = JSON.parse(raw) || [];
            } catch {}
        }
        waitForFeature(this, '#chat-history-list, .chat-history').then(chatEl => {
            this._persist();
            this._obs = new MutationObserver(() => this._persist());
            // childList+subtree is enough — we override fade-out via !important CSS,
            // so we don't need to react to attribute/class changes (expensive).
            this._obs.observe(chatEl, { childList: true, subtree: true });
            const tracker = qs('.rx-rant-tracker');
            if (tracker && !tracker.querySelector('.rx-rant-export-btn')) {
                const btn = document.createElement('button');
                btn.className = 'rx-rant-export-btn';
                btn.textContent = 'Export';
                btn.addEventListener('click', () => this._export());
                tracker.style.position = 'relative';
                tracker.appendChild(btn);
            }
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._obs = null;
        clearTimeout(this._mirrorWriteTimer);
        this._mirrorWriteTimer = null;
        for (const rant of qsa('.rx-rant-persist, [data-rx-persisted]')) {
            rant.classList.remove('rx-rant-persist');
            rant.removeAttribute('data-rx-persisted');
        }
        for (const badge of qsa('.rx-rant-persist-badge, .rx-rant-export-btn')) badge.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Comment Sort
// ═══════════════════════════════════════════
const CommentSort = {
    id: 'commentSort',
    name: 'Comment Sort',
    _styleEl: null,
    _bar: null,

    _css: `
        .rx-comment-sort-bar {
            display: flex; gap: 6px; padding: 8px 0; margin-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .rx-comment-sort-btn {
            background: rgba(49,50,68,0.4); border: 1px solid rgba(255,255,255,0.06);
            color: #a6adc8; border-radius: 8px; padding: 4px 12px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif; transition: all .15s;
        }
        .rx-comment-sort-btn:hover { background: rgba(49,50,68,0.8); }
        .rx-comment-sort-btn.active {
            background: rgba(137,180,250,0.15); color: var(--rx-accent, #89b4fa);
            border-color: rgba(137,180,250,0.4);
        }
    `,

    // Looks at the item's direct vote widget only — not nested replies'.
    _parseVotes(item) {
        const widget = item.querySelector(':scope > .comment-actions, :scope > .comments-meta, :scope .comment-actions')
            || item;
        const up = widget.querySelector('.comment-vote-count, .rumbles-vote--value');
        if (!up) return 0;
        const n = parseInt((up.textContent || '0').replace(/[^\d-]/g, ''), 10);
        return Number.isFinite(n) ? n : 0;
    },

    _parseTime(item) {
        const t = item.querySelector('time, .comment-meta--time');
        if (!t) return 0;
        const dt = t.getAttribute('datetime') || t.dataset?.time;
        if (dt) { const n = Date.parse(dt); if (!Number.isNaN(n)) return n; }
        return 0;
    },

    // Sort only TOP-LEVEL comments. Nested replies stay in place under each
    // parent so the thread structure is preserved.
    _sort(mode) {
        const container = qs('#video-comments, .media-page-comments-container');
        if (!container) return;
        // Rumble typically puts comments inside `<ul>` — top-level items are
        // direct children of that list. Fall back to the container itself.
        const listRoot = container.querySelector(':scope > ul') || container;
        const items = Array.from(
            listRoot.querySelectorAll(':scope > li.comment-item[data-comment-id], :scope > li.comment-item')
        );
        if (items.length < 2) return;
        const scored = items.map((el) => ({
            el, votes: this._parseVotes(el), time: this._parseTime(el),
        }));
        if (mode === 'top') scored.sort((a, b) => b.votes - a.votes);
        else if (mode === 'new') scored.sort((a, b) => b.time - a.time);
        else if (mode === 'old') scored.sort((a, b) => a.time - b.time);
        else if (mode === 'controversial') scored.sort((a, b) => Math.abs(a.votes) - Math.abs(b.votes));
        const frag = document.createDocumentFragment();
        for (const s of scored) frag.appendChild(s.el);
        listRoot.appendChild(frag);
    },

    _mount() {
        const container = qs('#video-comments, .media-page-comments-container');
        if (!container || qs('.rx-comment-sort-bar')) return;
        const bar = document.createElement('div');
        bar.className = 'rx-comment-sort-bar';
        const modes = [
            { id: 'top', label: 'Top' },
            { id: 'new', label: 'New' },
            { id: 'old', label: 'Oldest' },
            { id: 'controversial', label: 'Controversial' },
        ];
        for (const m of modes) {
            const btn = document.createElement('button');
            btn.className = 'rx-comment-sort-btn';
            btn.textContent = m.label;
            btn.addEventListener('click', () => {
                for (const b of bar.querySelectorAll('.rx-comment-sort-btn')) b.classList.remove('active');
                btn.classList.add('active');
                this._sort(m.id);
            });
            bar.appendChild(btn);
        }
        container.prepend(bar);
        this._bar = bar;
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-commentsort-css');
        waitForFeature(this, '#video-comments, .media-page-comments-container').then(() => {
            setFeatureTimeout(this, () => this._mount(), 1200);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._bar?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Comment Export (v3.11.0)
// ═══════════════════════════════════════════
// Closes the v2.0 `commentExport` setting key that shipped with no
// consumer. Adds an "Export" button next to the comments root on watch
// pages. Click → JSON download of every currently-loaded comment.
// Shift-click → CSV. Iterates Selectors.findAll('comments.item') so the
// extraction tracks the v2.0 selector registry.
//
// Only exports what Rumble's pagination has actually rendered. The toast
// tells the user exactly how many comments were captured so they know
// whether to scroll/load-more first and re-export.
const CommentExport = {
    id: 'commentExport',
    name: 'Comment Export',
    _btn: null,
    _styleEl: null,
    _routerUnsub: null,
    _css: `
        html.rumblex-active button.rx-comment-export-btn {
            display: inline-flex; align-items: center; gap: 6px;
            margin: 0 0 12px;
            padding: 6px 12px;
            background: var(--rx-surface0, #1e2a14);
            color: var(--rx-text, #d6e8c4);
            border: 1px solid var(--rx-surface1, #2a3a1e);
            border-radius: 6px; cursor: pointer;
            font: 600 12px/1 system-ui, sans-serif;
            transition: background 120ms ease;
        }
        html.rumblex-active button.rx-comment-export-btn:hover {
            background: var(--rx-surface1, #2a3a1e);
        }
    `,
    _extractAll() {
        const items = Selectors.findAll('comments.item');
        const out = [];
        for (const item of items) {
            try {
                // Comment ID lives on the LI's data attribute; falls back
                // to the text-content's hash-prefix when Rumble obscures it.
                const id = item.getAttribute('data-comment-id')
                    || item.id
                    || null;
                const text = (Selectors.find('comments.text', item) || item.querySelector('.comment-text'))?.textContent?.trim() || '';
                const author = item.querySelector('.comment-author, [data-js*="user_name"], .channel__link')?.textContent?.trim() || '';
                // Vote counts — match the CommentSort module's parser style.
                const voteEl = item.querySelector('.comment-actions-up-vote-count, .comment-vote-pill, [data-vote-count]');
                const voteRaw = voteEl?.textContent?.trim() || voteEl?.getAttribute('data-vote-count') || '';
                // Timestamp — Rumble renders relative ("3 days ago") on cards
                // and absolute on hover. We capture the visible text only.
                const ts = item.querySelector('time, .comment-meta time, .comments-meta')?.textContent?.trim() || '';
                out.push({ id, author, text, votes: voteRaw, ts });
            } catch {}
        }
        return out;
    },
    _toCsv(rows) {
        const esc = (v) => {
            const s = String(v ?? '');
            return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        const header = ['id', 'author', 'text', 'votes', 'ts'];
        const lines = [header.join(',')];
        for (const r of rows) {
            lines.push([r.id, r.author, r.text, r.votes, r.ts].map(esc).join(','));
        }
        return lines.join('\n');
    },
    _filenameStub() {
        // Derive from page title with a YYYY-MM-DD prefix. Keeps the
        // download distinct across multiple exports of the same page.
        const title = (qs('.video-header-container__title')?.textContent?.trim() || 'rumblex')
            .replace(/[^\w-]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 80);
        return new Date().toISOString().slice(0, 10) + '_' + (title || 'rumblex') + '_comments';
    },
    _download(content, filename, mime) {
        try {
            const blob = new Blob([content], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (e) {
            console.warn('[RumbleX] comment export download failed:', e);
        }
    },
    _handleClick(e) {
        const rows = this._extractAll();
        if (rows.length === 0) {
            RxToast.show('No comments loaded yet — scroll to load comments first');
            return;
        }
        const stub = this._filenameStub();
        if (e?.shiftKey) {
            this._download(this._toCsv(rows), stub + '.csv', 'text/csv;charset=utf-8');
            RxToast.show(`Exported ${rows.length} comment${rows.length === 1 ? '' : 's'} as CSV`);
        } else {
            const payload = {
                exportedAt: new Date().toISOString(),
                pageUrl: location.href,
                pageTitle: qs('.video-header-container__title')?.textContent?.trim() || '',
                count: rows.length,
                comments: rows,
            };
            this._download(JSON.stringify(payload, null, 2), stub + '.json', 'application/json');
            RxToast.show(`Exported ${rows.length} comment${rows.length === 1 ? '' : 's'} as JSON (shift-click for CSV)`);
        }
    },
    _build() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rx-comment-export-btn';
        btn.title = 'Export visible comments — click = JSON, shift-click = CSV';
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('fill', 'currentColor');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M8 1a1 1 0 011 1v6.59l1.3-1.3a1 1 0 011.4 1.42l-3 3a1 1 0 01-1.4 0l-3-3a1 1 0 011.4-1.42L7 8.59V2a1 1 0 011-1zM3 13a1 1 0 100 2h10a1 1 0 100-2H3z');
        svg.appendChild(path);
        const label = document.createElement('span');
        label.textContent = 'Export comments';
        btn.appendChild(svg);
        btn.appendChild(label);
        btn.addEventListener('click', (e) => this._handleClick(e));
        return btn;
    },
    _tryMount() {
        if (this._btn?.isConnected) return;
        const host = Selectors.find('comments.root');
        if (!host) return;
        if (!this._btn) this._btn = this._build();
        host.insertBefore(this._btn, host.firstChild);
    },
    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-comment-export-css');
        waitForSelectorFeature(this, 'comments.root', { timeout: 15000 })
            .then(() => this._tryMount())
            .catch(() => {});
        this._routerUnsub = Router.onChange((d) => {
            if (d.changed && Page.isWatch()) {
                this._btn?.remove();
                this._btn = null;
                waitForSelectorFeature(this, 'comments.root', { timeout: 10000 }).then(() => this._tryMount()).catch(() => {});
            }
        });
    },
    destroy() {
        this._btn?.remove();
        this._btn = null;
        this._styleEl?.remove();
        this._styleEl = null;
        if (typeof this._routerUnsub === 'function') {
            try { this._routerUnsub(); } catch {}
            this._routerUnsub = null;
        }
    },
};

// ═══════════════════════════════════════════
//  FEATURE: Popout Chat
// ═══════════════════════════════════════════
const PopoutChat = {
    id: 'popoutChat',
    name: 'Popout Chat',
    _styleEl: null,
    _btn: null,

    _css: `
        .rx-popout-chat-btn {
            background: rgba(49,50,68,0.5); border: 1px solid rgba(137,180,250,0.25);
            color: #cdd6f4; border-radius: 6px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif; margin-left: 6px;
            transition: background .15s, border-color .15s;
        }
        .rx-popout-chat-btn:hover { background: rgba(49,50,68,0.8); border-color: rgba(137,180,250,0.5); }
    `,

    _popout() {
        // Prefer Rumble's own chat popup control if the page exposes it —
        // clicking it toggles the native in-page popup chat overlay.
        const native = qs('#chat-toggle-popup');
        if (native instanceof HTMLElement) {
            native.click();
            return;
        }
        // If the page exposes an explicit chat popout link/anchor, open it.
        const link = qs('a[href*="chat/popup" i], a[href*="chat_popout" i]');
        if (link instanceof HTMLAnchorElement && link.href) {
            window.open(link.href, 'rumblex_chat_popout', 'width=420,height=720,resizable=yes,scrollbars=yes');
            return;
        }
        // Last-resort fallback: open the current watch URL in a narrow window.
        // Not a true chat-only window, but at least it doesn't 404 on users.
        window.open(location.href, 'rumblex_chat_popout', 'width=460,height=820,resizable=yes,scrollbars=yes');
    },

    _mount() {
        const header = qs('.chat--header');
        if (!header || qs('.rx-popout-chat-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'rx-popout-chat-btn';
        btn.textContent = 'Popout';
        btn.title = 'Open chat in separate window';
        btn.addEventListener('click', () => this._popout());
        header.appendChild(btn);
        this._btn = btn;
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-popoutchat-css');
        waitForFeature(this, '.chat--header').then(() => this._mount()).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._btn?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Keyword Filter (hide videos by title keyword)
// ═══════════════════════════════════════════
const KeywordFilter = {
    id: 'keywordFilter',
    name: 'Keyword Filter',
    _styleEl: null,
    _obs: null,
    _matchers: null,
    _matcherSig: '',

    _css: `.rx-kw-hidden { display: none !important; }`,

    _keywords() {
        return (Settings.get('blockedKeywords') || []).map(k => k.toLowerCase()).filter(Boolean);
    },

    // v2.4.0: support three modes via Settings.get('blockedKeywordsMode').
    //   literal  — case-insensitive substring (v1 behavior, default).
    //   wildcard — '*' matches any run, '?' matches one char. Anchored.
    //   regex    — raw RegExp source (compiled with 'i' flag, sandboxed).
    // Build matchers once per (keywords, mode) tuple. A bad regex falls back
    // to literal substring match for that one entry so a typo doesn't
    // disable the whole filter.
    _buildMatchers() {
        const kws = this._keywords();
        const mode = (Settings.get('blockedKeywordsMode') || 'literal').toLowerCase();
        const sig = mode + '\u0000' + kws.join('\u0001');
        if (sig === this._matcherSig && this._matchers) return this._matchers;
        const matchers = kws.map((k) => {
            if (mode === 'regex') {
                try { const re = new RegExp(k, 'i'); return (t) => re.test(t); }
                catch { return (t) => t.includes(k); }
            }
            if (mode === 'wildcard') {
                // Escape regex metas, then convert *? to .* and ? to .
                const escaped = k.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
                try { const re = new RegExp('^' + escaped + '$', 'i'); return (t) => re.test(t); }
                catch { return (t) => t.includes(k); }
            }
            return (t) => t.includes(k);
        });
        this._matchers = matchers;
        this._matcherSig = sig;
        return matchers;
    },

    _process() {
        const matchers = this._buildMatchers();
        if (!matchers.length) {
            for (const el of qsa('.rx-kw-hidden')) el.classList.remove('rx-kw-hidden');
            return;
        }
        const cards = VideoCards.all();
        for (const card of cards) {
            const title = VideoCards.title(card);
            if (!title) {
                // No title element — leave the card alone rather than match
                // against the entire card text (which would false-positive on
                // channel names, view counts, timestamps, etc).
                card.classList.remove('rx-kw-hidden');
                continue;
            }
            const t = title.toLowerCase();
            const hit = matchers.some((m) => m(t));
            card.classList.toggle('rx-kw-hidden', hit);
        }
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-keywordfilter-css');
        this._process();
        this._obs = new MutationObserver(() => {
            clearTimeout(this._t);
            this._t = setTimeout(() => this._process(), 150);
        });
        this._obs.observe(document.body, { childList: true, subtree: true });
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        clearTimeout(this._t);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Autoplay Scheduler / Queue
// ═══════════════════════════════════════════
const AutoplayScheduler = {
    id: 'autoplayScheduler',
    name: 'Autoplay Scheduler',
    _styleEl: null,
    _panel: null,
    _fab: null,
    _endHandler: null,

    _css: `
        .rx-queue-fab {
            position: fixed; bottom: 20px; right: 74px; z-index: 10008;
            width: 42px; height: 42px; border-radius: 50%;
            background: rgba(30,30,46,0.9); border: 1px solid rgba(137,180,250,0.25);
            color: rgba(255,255,255,0.7); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .rx-queue-fab:hover { border-color: rgba(137,180,250,0.6); }
        html.rx-theater .rx-queue-fab { display: none; }
        .rx-queue-panel {
            position: fixed; bottom: 76px; right: 20px; z-index: 10009;
            width: 320px; max-height: 420px; overflow-y: auto;
            background: rgba(17,17,27,0.98); border: 1px solid rgba(137,180,250,0.2);
            border-radius: 12px; padding: 12px;
            color: #cdd6f4; font: 12px system-ui, sans-serif;
            box-shadow: 0 12px 40px rgba(0,0,0,0.6);
            display: none;
        }
        .rx-queue-panel.open { display: block; }
        .rx-queue-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .rx-queue-title { font-weight: 700; font-size: 13px; color: #f0f0f0; }
        .rx-queue-add {
            display: flex; gap: 6px; margin-bottom: 8px;
        }
        .rx-queue-add input {
            flex: 1; background: rgba(49,50,68,0.5); border: 1px solid rgba(255,255,255,0.08);
            border-radius: 6px; padding: 5px 8px; color: #cdd6f4; font-size: 11px; outline: none;
        }
        .rx-queue-add button {
            background: rgba(137,180,250,0.15); border: 1px solid rgba(137,180,250,0.3);
            color: var(--rx-accent, #89b4fa); border-radius: 6px; padding: 4px 10px;
            cursor: pointer; font-weight: 600; font-size: 11px;
        }
        .rx-queue-item {
            display: flex; align-items: center; gap: 6px; padding: 6px;
            border-radius: 6px; margin-bottom: 4px; background: rgba(49,50,68,0.3);
        }
        .rx-queue-item .rx-qi-url { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
        .rx-queue-item button {
            background: transparent; border: none; color: #f38ba8; cursor: pointer; font-size: 14px;
        }
        .rx-queue-empty { padding: 16px; text-align: center; color: #6c7086; font-size: 11px; }
    `,

    _queue() {
        return Settings.get('autoplayQueue') || [];
    },

    _saveQueue(q) {
        Settings.set('autoplayQueue', q);
    },

    _addCurrent() {
        const q = this._queue();
        if (!q.includes(location.href)) {
            q.push(location.href);
            this._saveQueue(q);
            this._renderList();
        }
    },

    _addUrl(url) {
        url = (url || '').trim();
        if (!url || !/^https:\/\/(www\.)?rumble\.com\//.test(url)) return;
        const q = this._queue();
        if (!q.includes(url)) {
            q.push(url);
            this._saveQueue(q);
            this._renderList();
        }
    },

    _playNext() {
        const q = this._queue();
        if (!q.length) return;
        const next = q.shift();
        this._saveQueue(q);
        location.href = next;
    },

    _renderList() {
        if (!this._panel) return;
        const list = this._panel.querySelector('.rx-queue-list');
        const q = this._queue();
        list.innerHTML = '';
        if (!q.length) {
            list.innerHTML = '<div class="rx-queue-empty">Queue is empty. Add video URLs above.</div>';
            return;
        }
        q.forEach((url, i) => {
            const row = document.createElement('div');
            row.className = 'rx-queue-item';
            const span = document.createElement('span');
            span.className = 'rx-qi-url';
            span.textContent = url.replace('https://rumble.com/', '');
            const del = document.createElement('button');
            del.textContent = '×';
            del.title = 'Remove';
            del.addEventListener('click', () => {
                const nq = this._queue();
                nq.splice(i, 1);
                this._saveQueue(nq);
                this._renderList();
            });
            row.append(span, del);
            list.appendChild(row);
        });
    },

    _build() {
        const fab = document.createElement('button');
        fab.className = 'rx-queue-fab';
        fab.title = 'Autoplay Queue';
        fab.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="14" y2="18"/><polygon points="18 15 24 18 18 21" fill="currentColor"/></svg>';
        document.body.appendChild(fab);
        this._fab = fab;

        const panel = document.createElement('div');
        panel.className = 'rx-queue-panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Autoplay queue');
        panel.innerHTML = `
            <div class="rx-queue-header">
                <span class="rx-queue-title">Autoplay Queue</span>
                <button class="rx-queue-add-current" title="Add current video">+ current</button>
            </div>
            <div class="rx-queue-add">
                <input type="text" placeholder="Paste Rumble URL..." />
                <button>Add</button>
            </div>
            <div class="rx-queue-list"></div>`;
        document.body.appendChild(panel);
        this._panel = panel;

        fab.addEventListener('click', () => {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) this._renderList();
        });

        panel.querySelector('.rx-queue-add-current').addEventListener('click', () => {
            if (Page.isWatch()) this._addCurrent();
        });
        const input = panel.querySelector('input');
        const addBtn = panel.querySelector('.rx-queue-add button');
        const doAdd = () => { this._addUrl(input.value); input.value = ''; };
        addBtn.addEventListener('click', doAdd);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });

        // Style buttons in header
        const headerBtn = panel.querySelector('.rx-queue-add-current');
        headerBtn.style.cssText = 'background:rgba(137,180,250,0.15);border:1px solid rgba(137,180,250,0.3);color:var(--rx-accent,#89b4fa);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:10px;font-weight:600;';
    },

    _hookVideoEnd() {
        const video = qs('video');
        if (!video || video.dataset.rxQueueBound) return;
        video.dataset.rxQueueBound = '1';
        this._endHandler = () => this._playNext();
        video.addEventListener('ended', this._endHandler);
    },

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-autoplayscheduler-css');
        const generation = this._rxLifecycleGeneration;
        onReady(() => {
            if (generation === this._rxLifecycleGeneration) this._build();
        });
        if (Page.isWatch()) {
            waitForFeature(this, 'video', 12000).then(() => this._hookVideoEnd()).catch(() => {});
        }
    },

    destroy() {
        this._styleEl?.remove();
        this._panel?.remove();
        this._panel = null;
        this._fab?.remove();
        this._fab = null;
        qs('.rx-queue-fab')?.remove();
        const v = qs('video');
        if (v) {
            if (this._endHandler) v.removeEventListener('ended', this._endHandler);
            delete v.dataset.rxQueueBound;
        }
        this._endHandler = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Chapters (parse description timestamps)
// ═══════════════════════════════════════════
const Chapters = {
    id: 'chapters',
    name: 'Chapters',
    _styleEl: null,
    _markers: null,
    _list: null,
    _chapters: [],
    _obs: null,

    _css: `
        .rx-chapter-markers {
            position: absolute; left: 0; right: 0; bottom: 0;
            height: 4px; pointer-events: none; z-index: 5;
        }
        .rx-chapter-mark {
            position: absolute; top: 0; bottom: 0; width: 2px;
            background: rgba(255,255,255,0.75);
            box-shadow: 0 0 4px rgba(0,0,0,0.5);
            pointer-events: auto; cursor: pointer;
        }
        .rx-chapter-mark:hover { background: #fff; width: 3px; }
        .rx-chapter-tooltip {
            position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.92); color: #fff; padding: 4px 8px;
            border-radius: 4px; font: 600 11px/1.2 system-ui, sans-serif;
            white-space: nowrap; opacity: 0; pointer-events: none;
            transition: opacity .15s;
        }
        .rx-chapter-mark:hover .rx-chapter-tooltip { opacity: 1; }
        .rx-chapters-panel {
            margin: 12px 0; padding: 10px 12px;
            background: rgba(30,30,46,0.5); border: 1px solid rgba(137,180,250,0.12);
            border-radius: 8px;
        }
        .rx-chapters-title {
            font: 700 12px/1 system-ui, sans-serif; color: #a6adc8;
            margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .rx-chapters-list { display: flex; flex-direction: column; gap: 2px; }
        .rx-chapters-item {
            /* Real <button> so chapters can be reached and activated by keyboard. */
            appearance: none; background: none; border: 0; text-align: left; font: inherit;
            width: 100%;
            display: flex; gap: 8px; padding: 5px 8px; cursor: pointer;
            border-radius: 5px; font-size: 12px; color: #cdd6f4;
            transition: background .15s;
        }
        .rx-chapters-item:focus-visible { outline: 2px solid #89b4fa; outline-offset: -2px; }
        .rx-chapters-item:hover { background: rgba(137,180,250,0.1); }
        .rx-chapters-item .rx-ci-time {
            color: var(--rx-accent, #89b4fa); font-weight: 600; font-variant-numeric: tabular-nums;
            min-width: 52px;
        }
    `,

    _tsToSec(ts) {
        const p = ts.split(':').map(n => parseInt(n, 10));
        if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
        if (p.length === 2) return p[0] * 60 + p[1];
        return 0;
    },

    _parseDescription() {
        const desc = qs('.media-description, [data-js="media_description"]');
        if (!desc) return [];
        // innerText honours <br> and display-aware line breaks; fall back to
        // textContent which always exists but mushes everything together.
        const text = desc.innerText || desc.textContent || '';
        const chapters = [];
        const seen = new Set();
        for (const raw of text.split(/\r?\n/)) {
            const line = raw.trim();
            if (!line) continue;
            // Anchored to line start so we don't match incidental timestamps
            // that appear mid-sentence in body text.
            const m = line.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—:.]?\s+(.{1,120})$/);
            if (!m) continue;
            const ts = (m[1] ? m[1] + ':' : '') + m[2] + ':' + m[3];
            const label = (m[4] || '').trim();
            if (!label) continue;
            const time = this._tsToSec(ts);
            const key = time + '|' + label;
            if (seen.has(key)) continue;
            seen.add(key);
            chapters.push({ time, label: label.substring(0, 80) });
        }
        return chapters.sort((a, b) => a.time - b.time);
    },

    _seek(t) {
        const v = qs('video');
        if (v) { v.currentTime = t; v.play().catch(() => {}); }
    },

    _findSeekbar() {
        // Prefer specific seekbar/progress selectors. Do NOT fall back to the
        // video container — overlaying markers on the video frame is wrong
        // and confusing.
        return qs(
            '.video-player-seekbar, .progress-bar__container, [class*="progress-bar"], [class*="seekbar"]'
        );
    },

    _renderMarkers(duration) {
        const bar = this._findSeekbar();
        if (!bar || !duration || !Number.isFinite(duration)) return;
        this._markers?.remove();
        const wrap = document.createElement('div');
        wrap.className = 'rx-chapter-markers';
        for (const c of this._chapters) {
            if (c.time > duration) continue;
            const pct = (c.time / duration) * 100;
            const m = document.createElement('div');
            m.className = 'rx-chapter-mark';
            m.style.left = pct + '%';
            m.title = c.label;
            const tip = document.createElement('div');
            tip.className = 'rx-chapter-tooltip';
            tip.textContent = c.label;
            m.appendChild(tip);
            m.addEventListener('click', (e) => { e.stopPropagation(); this._seek(c.time); });
            wrap.appendChild(m);
        }
        if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
        bar.appendChild(wrap);
        this._markers = wrap;
    },

    _renderPanel() {
        const desc = qs('.media-description-section, .media-description');
        if (!desc || this._list) return;
        const panel = document.createElement('div');
        panel.className = 'rx-chapters-panel';
        panel.innerHTML = `<div class="rx-chapters-title">Chapters (${this._chapters.length})</div><div class="rx-chapters-list"></div>`;
        const list = panel.querySelector('.rx-chapters-list');
        for (const c of this._chapters) {
            const row = document.createElement('button');
            row.type = 'button';
            row.className = 'rx-chapters-item';
            const ts = document.createElement('span');
            ts.className = 'rx-ci-time';
            const h = Math.floor(c.time / 3600), mm = Math.floor((c.time % 3600) / 60), ss = c.time % 60;
            ts.textContent = (h ? h + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
            const lbl = document.createElement('span');
            lbl.textContent = c.label;
            row.append(ts, lbl);
            row.setAttribute('aria-label', 'Jump to ' + ts.textContent + ' - ' + c.label);
            row.addEventListener('click', () => this._seek(c.time));
            list.appendChild(row);
        }
        panel.setAttribute('role', 'navigation');
        panel.setAttribute('aria-label', 'Video chapters');
        desc.prepend(panel);
        this._list = panel;
    },

    async _run() {
        const chapters = this._parseDescription();
        if (!chapters.length) return;
        this._chapters = chapters;
        try {
            const v = await waitForFeature(this, 'video', 10000);
            const drawOnce = () => {
                if (!v.duration || isNaN(v.duration)) return;
                this._renderMarkers(v.duration);
                this._renderPanel();
            };
            if (v.duration) drawOnce();
            else v.addEventListener('loadedmetadata', drawOnce, { once: true });
        } catch (e) {}
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-chapters-css');
        waitForFeature(this, '.media-description, .media-description-section', 10000).then(() => {
            setFeatureTimeout(this, () => this._run(), 800);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._markers?.remove();
        this._list?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: SponsorBlock (local segments, skip sponsors)
// ═══════════════════════════════════════════
const SponsorBlockRX = {
    id: 'sponsorBlock',
    name: 'SponsorBlock',
    _styleEl: null,
    _panel: null,
    _segments: [],
    _skipHandler: null,
    _metadataHandler: null,
    _markerEl: null,

    _css: `
        .rx-sb-markers {
            position: absolute; left: 0; right: 0; bottom: 0; height: 4px;
            pointer-events: none; z-index: 4;
        }
        .rx-sb-segment {
            position: absolute; top: 0; height: 100%;
            background: rgba(255,188,42,0.7); border-radius: 1px;
        }
        .rx-sb-segment.category-intro { background: rgba(137,180,250,0.7); }
        .rx-sb-segment.category-outro { background: rgba(249,226,175,0.7); }
        .rx-sb-segment.category-selfpromo { background: rgba(203,166,247,0.7); }
        .rx-sb-segment.category-sponsor { background: rgba(243,139,168,0.75); }
        .rx-sb-notice {
            position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
            padding: 8px 16px; background: rgba(30,30,46,0.95);
            border: 1px solid rgba(243,139,168,0.4); border-radius: 8px;
            color: #f38ba8; font: 600 12px/1 system-ui, sans-serif;
            z-index: 10020; box-shadow: 0 6px 20px rgba(0,0,0,0.5);
            opacity: 0; transition: opacity .3s;
        }
        .rx-sb-notice.visible { opacity: 1; }

        .rx-sb-panel {
            margin: 8px 0; padding: 10px;
            background: rgba(243,139,168,0.08); border: 1px solid rgba(243,139,168,0.2);
            border-radius: 8px;
        }
        .rx-sb-title { font: 700 11px/1 system-ui, sans-serif; color: #f38ba8; margin-bottom: 6px; text-transform: uppercase; }
        .rx-sb-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
        .rx-sb-btn {
            background: rgba(49,50,68,0.4); border: 1px solid rgba(255,255,255,0.06);
            color: #cdd6f4; border-radius: 5px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif;
        }
        .rx-sb-btn:hover { background: rgba(49,50,68,0.7); }
        .rx-sb-list { display: flex; flex-direction: column; gap: 3px; font-size: 11px; }
        .rx-sb-item {
            display: flex; gap: 6px; align-items: center; padding: 3px 6px;
            background: rgba(49,50,68,0.3); border-radius: 4px;
        }
        .rx-sb-item select {
            background: rgba(30,30,46,0.8); color: #cdd6f4;
            border: 1px solid rgba(255,255,255,0.08); border-radius: 4px;
            font-size: 10px; padding: 1px 4px;
        }
        .rx-sb-item button { background: transparent; border: none; color: #f38ba8; cursor: pointer; }
    `,

    _videoKey() {
        const m = location.pathname.match(/^\/(v[a-z0-9]+)/);
        return m ? m[1] : null;
    },

    _loadSegments() {
        const key = this._videoKey();
        if (!key) return;
        const all = Settings.get('sponsorSegments') || {};
        this._segments = all[key] || [];
    },

    _saveSegments() {
        const key = this._videoKey();
        if (!key) return;
        const all = Settings.get('sponsorSegments') || {};
        all[key] = this._segments;
        Settings.set('sponsorSegments', all);
    },

    _fmt(t) {
        t = Math.max(0, Math.floor(t));
        const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
        return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    },

    _notice(msg) {
        let el = qs('.rx-sb-notice');
        if (!el) {
            el = document.createElement('div');
            el.className = 'rx-sb-notice';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('visible');
        clearTimeout(this._noticeT);
        this._noticeT = setTimeout(() => el.classList.remove('visible'), 2200);
    },

    _findSeekbar() {
        return qs(
            '.video-player-seekbar, .progress-bar__container, [class*="progress-bar"], [class*="seekbar"]'
        );
    },

    _renderMarkers(duration) {
        const bar = this._findSeekbar();
        if (!bar || !duration || !Number.isFinite(duration)) return;
        this._markerEl?.remove();
        const wrap = document.createElement('div');
        wrap.className = 'rx-sb-markers';
        for (const s of this._segments) {
            const seg = document.createElement('div');
            seg.className = 'rx-sb-segment category-' + (s.category || 'sponsor');
            seg.style.left = (s.start / duration * 100) + '%';
            seg.style.width = Math.max(0.3, (s.end - s.start) / duration * 100) + '%';
            seg.title = `${s.category}: ${this._fmt(s.start)} → ${this._fmt(s.end)}`;
            wrap.appendChild(seg);
        }
        if (getComputedStyle(bar).position === 'static') bar.style.position = 'relative';
        bar.appendChild(wrap);
        this._markerEl = wrap;
    },

    _attachSkip() {
        const v = qs('video');
        if (!v || v.dataset.rxSbBound) return;
        v.dataset.rxSbBound = '1';
        this._skipHandler = () => {
            const t = v.currentTime;
            for (const s of this._segments) {
                if (t >= s.start && t < s.end - 0.5) {
                    v.currentTime = s.end;
                    this._notice(`Skipped ${s.category}`);
                    return;
                }
            }
        };
        v.addEventListener('timeupdate', this._skipHandler);
        this._metadataHandler = () => this._renderMarkers(v.duration);
        v.addEventListener('loadedmetadata', this._metadataHandler, { once: true });
        if (v.duration) this._renderMarkers(v.duration);
    },

    _addSegment(start, end, category = 'sponsor') {
        if (end <= start) return;
        this._segments.push({ start, end, category });
        this._segments.sort((a, b) => a.start - b.start);
        this._saveSegments();
        this._refreshPanel();
        const v = qs('video');
        if (v?.duration) this._renderMarkers(v.duration);
    },

    _refreshPanel() {
        if (!this._panel) return;
        const list = this._panel.querySelector('.rx-sb-list');
        list.innerHTML = '';
        if (!this._segments.length) {
            list.innerHTML = '<div style="color:#6c7086;font-size:11px;padding:4px;">No segments yet. Use Mark Start / Mark End.</div>';
            return;
        }
        this._segments.forEach((s, i) => {
            const row = document.createElement('div');
            row.className = 'rx-sb-item';
            const range = document.createElement('span');
            range.style.flex = '1';
            range.textContent = `${this._fmt(s.start)} → ${this._fmt(s.end)}`;
            const sel = document.createElement('select');
            for (const c of ['sponsor', 'intro', 'outro', 'selfpromo', 'interaction']) {
                const o = document.createElement('option'); o.value = c; o.textContent = c;
                if (c === (s.category || 'sponsor')) o.selected = true;
                sel.appendChild(o);
            }
            sel.addEventListener('change', () => { s.category = sel.value; this._saveSegments(); });
            const del = document.createElement('button');
            del.textContent = '×';
            del.addEventListener('click', () => {
                this._segments.splice(i, 1);
                this._saveSegments();
                this._refreshPanel();
                const v = qs('video');
                if (v?.duration) this._renderMarkers(v.duration);
            });
            row.append(range, sel, del);
            list.appendChild(row);
        });
    },

    _renderPanel() {
        const host = qs('.media-description-section, .media-description');
        if (!host || this._panel) return;
        const panel = document.createElement('div');
        panel.className = 'rx-sb-panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'SponsorBlock segments');
        panel.innerHTML = `
            <div class="rx-sb-title">SponsorBlock (local)</div>
            <div class="rx-sb-actions">
                <button class="rx-sb-btn rx-sb-start">Mark Start</button>
                <button class="rx-sb-btn rx-sb-end">Mark End</button>
                <button class="rx-sb-btn rx-sb-export">Export</button>
                <button class="rx-sb-btn rx-sb-import">Import</button>
            </div>
            <div class="rx-sb-list"></div>`;
        host.prepend(panel);
        this._panel = panel;

        let pending = null;
        panel.querySelector('.rx-sb-start').addEventListener('click', () => {
            const v = qs('video'); if (!v) return;
            pending = v.currentTime;
            this._notice(`Start: ${this._fmt(pending)}`);
        });
        panel.querySelector('.rx-sb-end').addEventListener('click', () => {
            const v = qs('video'); if (!v || pending == null) { this._notice('Mark start first'); return; }
            this._addSegment(pending, v.currentTime, 'sponsor');
            pending = null;
        });
        panel.querySelector('.rx-sb-export').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(this._segments, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = 'sponsorblock-' + (this._videoKey() || 'rumble') + '.json'; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        });
        panel.querySelector('.rx-sb-import').addEventListener('click', () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
            input.addEventListener('change', () => {
                const f = input.files[0]; if (!f) return;
                if (f.size > 1024 * 1024) {
                    this._notice('Sponsor JSON exceeds the 1 MB limit');
                    return;
                }
                const r = new FileReader();
                r.onload = () => {
                    try {
                        const data = JSON.parse(r.result);
                        if (!Array.isArray(data)) throw new Error('Expected a segment array');
                        const key = this._videoKey();
                        if (!key) throw new Error('No video id is available');
                        const safe = Settings._sanitize({ sponsorSegments: { [key]: data } })
                            .sponsorSegments?.[key] || [];
                        if (data.length && !safe.length) throw new Error('No valid sponsor segments found');
                        this._segments = safe;
                        this._saveSegments();
                        this._refreshPanel();
                        const v = qs('video'); if (v?.duration) this._renderMarkers(v.duration);
                    } catch (e) { this._notice('Invalid JSON'); }
                };
                r.onerror = () => this._notice('Could not read sponsor JSON');
                r.readAsText(f);
            });
            input.click();
        });
        this._refreshPanel();
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-sponsorblock-css');
        this._loadSegments();
        waitForFeature(this, 'video', 12000).then(() => this._attachSkip()).catch(() => {});
        waitForFeature(this, '.media-description, .media-description-section', 12000).then(() => {
            setFeatureTimeout(this, () => this._renderPanel(), 800);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._panel?.remove();
        this._panel = null;
        this._markerEl?.remove();
        this._markerEl = null;
        clearTimeout(this._noticeT);
        this._noticeT = null;
        qs('.rx-sb-notice')?.remove();
        const v = qs('video');
        if (v) {
            if (this._skipHandler) v.removeEventListener('timeupdate', this._skipHandler);
            if (this._metadataHandler) v.removeEventListener('loadedmetadata', this._metadataHandler);
            delete v.dataset.rxSbBound;
        }
        this._skipHandler = null;
        this._metadataHandler = null;
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Video Clips (mark in/out, export segment)
// ═══════════════════════════════════════════
const VideoClips = {
    id: 'videoClips',
    name: 'Video Clips',
    _styleEl: null,
    _panel: null,
    _inT: null, _outT: null,
    _busy: false,
    _controller: null,

    _css: `
        .rx-clip-panel {
            margin: 8px 0; padding: 10px;
            background: rgba(166,227,161,0.06); border: 1px solid rgba(166,227,161,0.2);
            border-radius: 8px;
        }
        .rx-clip-title { font: 700 11px/1 system-ui, sans-serif; color: #a6e3a1; margin-bottom: 6px; text-transform: uppercase; }
        .rx-clip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
        .rx-clip-btn {
            background: rgba(49,50,68,0.4); border: 1px solid rgba(255,255,255,0.06);
            color: #cdd6f4; border-radius: 5px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif;
        }
        .rx-clip-btn:hover { background: rgba(49,50,68,0.7); }
        .rx-clip-btn.primary { background: rgba(166,227,161,0.15); color: #a6e3a1; border-color: rgba(166,227,161,0.3); }
        .rx-clip-info { font: 11px/1.4 system-ui, sans-serif; color: #a6adc8; margin: 4px 0; font-variant-numeric: tabular-nums; }
        .rx-clip-status { font: 11px/1.4 system-ui, sans-serif; color: var(--rx-accent, #89b4fa); margin-top: 4px; }
        .rx-clip-bar-bg { height: 4px; background: rgba(49,50,68,0.5); border-radius: 2px; overflow: hidden; margin-top: 4px; }
        .rx-clip-bar-fill { height: 100%; width: 0%; background: linear-gradient(90deg,#a6e3a1,#89b4fa); transition: width .2s; }
    `,

    _fmt(t) {
        t = Math.max(0, Math.floor(t));
        const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
        return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    },

    _updateInfo() {
        const info = this._panel?.querySelector('.rx-clip-info');
        if (!info) return;
        const inS = this._inT != null ? this._fmt(this._inT) : '—';
        const outS = this._outT != null ? this._fmt(this._outT) : '—';
        const len = (this._inT != null && this._outT != null) ? ` (${this._fmt(this._outT - this._inT)})` : '';
        info.textContent = `In: ${inS}   Out: ${outS}${len}`;
    },

    _setStatus(msg, pct) {
        const s = this._panel?.querySelector('.rx-clip-status');
        if (s) s.textContent = msg || '';
        if (pct != null) {
            const bar = this._panel?.querySelector('.rx-clip-bar-fill');
            if (bar) bar.style.width = pct + '%';
        }
    },

    async _export() {
        if (this._busy) { this._setStatus('Export already running…'); return; }
        if (this._inT == null || this._outT == null || this._outT <= this._inT) {
            this._setStatus('Set In and Out first'); return;
        }
        this._busy = true;
        const operationId = VideoDownloader._newOperationId('clip-export');
        let stage = 'embed-api';
        let selectedVariant = null;
        const diagnosticUrls = [];
        this._panel?.querySelector('.rx-diagnostic-actions')?.remove();
        const exportBtn = this._panel?.querySelector('.rx-clip-export');
        if (exportBtn) exportBtn.disabled = true;
        this._controller?.abort();
        const controller = new AbortController();
        this._controller = controller;
        const { signal } = controller;
        try {
            this._setStatus('Fetching playlist...', 2);
            const embedId = VideoDownloader._getEmbedId();
            if (!embedId) throw new Error('No embed id');
            if (!VideoDownloader._hlsUrl) {
                const data = await VideoDownloader._fetchEmbedData(embedId);
                VideoDownloader._hlsUrl = VideoDownloader._extractHlsUrl(data);
                if (!VideoDownloader._hlsUrl) throw new Error('No valid HLS playlist');
            }
            stage = 'master-playlist';
            diagnosticUrls.push({ role: 'master-playlist', url: VideoDownloader._hlsUrl });
            const masterResp = await RXPlatform.fetch(VideoDownloader._hlsUrl, { signal });
            if (!masterResp.ok) throw VideoDownloader._httpError(masterResp, stage, VideoDownloader._hlsUrl);
            const variants = VideoDownloader._parseMasterPlaylist(await masterResp.text(), VideoDownloader._hlsUrl);
            selectedVariant = variants.sort((a, b) => b.height - a.height)[0];
            if (!selectedVariant) throw new Error('No stream variant');
            stage = 'segment-playlist';
            diagnosticUrls.push({ role: 'segment-playlist', url: selectedVariant.url });
            this._setStatus('Parsing segments...', 5);
            const variantResp = await RXPlatform.fetch(selectedVariant.url, { signal });
            if (!variantResp.ok) throw VideoDownloader._httpError(variantResp, stage, selectedVariant.url);
            const vtxt = await variantResp.text();
            const segUrls = VideoDownloader._parseSegmentPlaylist(vtxt, selectedVariant.url);
            const segDurs = [];
            for (const line of vtxt.split('\n')) {
                const m = line.match(/^#EXTINF:([\d.]+)/);
                if (m) segDurs.push(parseFloat(m[1]));
            }
            let acc = 0, inIdx = 0, outIdx = segUrls.length - 1;
            for (let i = 0; i < segDurs.length; i++) {
                if (acc <= this._inT) inIdx = i;
                if (acc < this._outT) outIdx = i;
                acc += segDurs[i];
            }
            const picked = segUrls.slice(inIdx, outIdx + 1);
            if (!picked.length) throw new Error('No media segments overlap the selected clip range');
            const title = VideoDownloader._getTitle();
            stage = 'segment-download';
            const buffers = await VideoDownloader._downloadBuffers(picked, {
                signal,
                stage,
                onProgress: (done, total) => this._setStatus(`Downloading ${done}/${total}...`, 5 + (done / total) * 70),
            });
            stage = 'mux';
            this._setStatus('Converting to MP4...', 80);
            const blob = await VideoDownloader._transmuxWithWorker(buffers, signal);
            stage = 'save';
            this._setStatus('Saving clip...', 100);
            VideoDownloader._triggerSave(blob, `${title} - clip ${this._fmt(this._inT)}-${this._fmt(this._outT)}.mp4`, 'video/mp4');
            this._setStatus('Clip saved!', 100);
        } catch (e) {
            if (e?.name === 'AbortError') {
                this._setStatus('Clip export cancelled.');
                return;
            }
            this._setStatus('Error: ' + (e?.message || e));
            if (e?.rxUrl) diagnosticUrls.push({ role: e.rxStage || stage, url: e.rxUrl });
            void VideoDownloader._reportFailure({
                operation: 'clip-export',
                operationId,
                stage,
                error: e,
                quality: selectedVariant ? {
                    label: selectedVariant.height ? `${selectedVariant.height}p` : 'best',
                    height: selectedVariant.height,
                    width: selectedVariant.width,
                    type: 'hls',
                } : null,
                format: 'mp4',
                urls: diagnosticUrls,
                extra: {
                    clipStartSeconds: this._inT,
                    clipEndSeconds: this._outT,
                },
            }, this._panel);
        } finally {
            if (this._controller === controller) this._controller = null;
            this._busy = false;
            const btn = this._panel?.querySelector('.rx-clip-export');
            if (btn) btn.disabled = false;
        }
    },

    _mount() {
        const host = qs('.media-description-section, .media-description');
        if (!host || this._panel) return;
        const panel = document.createElement('div');
        panel.className = 'rx-clip-panel';
        panel.innerHTML = `
            <div class="rx-clip-title">Create Clip</div>
            <div class="rx-clip-row">
                <button class="rx-clip-btn rx-clip-in">Mark In</button>
                <button class="rx-clip-btn rx-clip-out">Mark Out</button>
                <button class="rx-clip-btn primary rx-clip-export">Export MP4</button>
                <button class="rx-clip-btn rx-clip-reset">Reset</button>
            </div>
            <div class="rx-clip-info">In: —   Out: —</div>
            <div class="rx-clip-status"></div>
            <div class="rx-clip-bar-bg"><div class="rx-clip-bar-fill"></div></div>`;
        host.prepend(panel);
        this._panel = panel;
        panel.querySelector('.rx-clip-in').addEventListener('click', () => {
            const v = qs('video'); if (v) { this._inT = v.currentTime; this._updateInfo(); }
        });
        panel.querySelector('.rx-clip-out').addEventListener('click', () => {
            const v = qs('video'); if (v) { this._outT = v.currentTime; this._updateInfo(); }
        });
        panel.querySelector('.rx-clip-export').addEventListener('click', () => this._export());
        panel.querySelector('.rx-clip-reset').addEventListener('click', () => {
            this._inT = this._outT = null;
            this._updateInfo();
            this._setStatus('', 0);
            this._panel?.querySelector('.rx-diagnostic-actions')?.remove();
        });
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-clips-css');
        waitForFeature(this, '.media-description, .media-description-section', 12000).then(() => {
            setFeatureTimeout(this, () => this._mount(), 900);
        }).catch(() => {});
    },

    destroy() {
        this._controller?.abort();
        this._controller = null;
        this._styleEl?.remove();
        this._panel?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Live DVR (save last N seconds of live stream)
// ═══════════════════════════════════════════
const LiveDVR = {
    id: 'liveDVR',
    name: 'Live DVR',
    _styleEl: null,
    _panel: null,
    _busy: false,
    _controller: null,

    _css: `
        .rx-dvr-panel {
            margin: 8px 0; padding: 10px;
            background: rgba(249,226,175,0.06); border: 1px solid rgba(249,226,175,0.22);
            border-radius: 8px;
        }
        .rx-dvr-title { font: 700 11px/1 system-ui, sans-serif; color: #f9e2af; margin-bottom: 6px; text-transform: uppercase; }
        .rx-dvr-row { display: flex; flex-wrap: wrap; gap: 6px; }
        .rx-dvr-btn {
            background: rgba(49,50,68,0.4); border: 1px solid rgba(255,255,255,0.06);
            color: #cdd6f4; border-radius: 5px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif;
        }
        .rx-dvr-btn:hover { background: rgba(49,50,68,0.7); }
        .rx-dvr-status { font: 11px/1.4 system-ui, sans-serif; color: var(--rx-accent, #89b4fa); margin-top: 4px; }
    `,

    _setStatus(msg) {
        const s = this._panel?.querySelector('.rx-dvr-status');
        if (s) s.textContent = msg || '';
    },

    async _save(seconds) {
        if (this._busy) { this._setStatus('Save already running…'); return; }
        this._busy = true;
        const buttons = this._panel?.querySelectorAll('.rx-dvr-btn') || [];
        buttons.forEach((b) => { b.disabled = true; });
        this._controller?.abort();
        const controller = new AbortController();
        this._controller = controller;
        const { signal } = controller;
        try {
            this._setStatus(`Fetching live playlist...`);
            const embedId = VideoDownloader._getEmbedId();
            if (!embedId) throw new Error('No embed id');
            const data = await VideoDownloader._fetchEmbedData(embedId, signal);
            const hls = VideoDownloader._extractHlsUrl(data);
            if (!hls) throw new Error('No HLS URL');
            const masterResponse = await RXPlatform.fetch(hls, { signal });
            if (!masterResponse.ok) throw VideoDownloader._httpError(masterResponse, 'master-playlist', hls);
            const master = await masterResponse.text();
            const variants = VideoDownloader._parseMasterPlaylist(master, hls);
            const variant = variants.sort((a, b) => b.height - a.height)[0];
            if (!variant) throw new Error('No variant');
            const variantResponse = await RXPlatform.fetch(variant.url, { signal });
            if (!variantResponse.ok) throw VideoDownloader._httpError(variantResponse, 'segment-playlist', variant.url);
            const vtxt = await variantResponse.text();
            const segUrls = VideoDownloader._parseSegmentPlaylist(vtxt, variant.url);
            const segDurs = [];
            for (const line of vtxt.split('\n')) {
                const m = line.match(/^#EXTINF:([\d.]+)/);
                if (m) segDurs.push(parseFloat(m[1]));
            }
            let acc = 0, startIdx = 0;
            for (let i = segDurs.length - 1; i >= 0; i--) {
                acc += segDurs[i];
                if (acc >= seconds) { startIdx = i; break; }
            }
            const picked = segUrls.slice(startIdx);
            this._setStatus(`Downloading ${picked.length} segments (~${Math.round(acc)}s)...`);
            const buffers = await VideoDownloader._downloadBuffers(picked, {
                signal,
                onProgress: (done, total) => this._setStatus(`Downloading ${done}/${total}...`),
            });
            this._setStatus('Converting to MP4...');
            const blob = await VideoDownloader._transmuxWithWorker(buffers, signal);
            const title = VideoDownloader._getTitle();
            VideoDownloader._triggerSave(blob, `${title} - last ${seconds}s.mp4`, 'video/mp4');
            this._setStatus(`Saved last ${seconds}s!`);
        } catch (e) {
            this._setStatus(e?.name === 'AbortError' ? 'Save cancelled.' : 'Error: ' + e.message);
        } finally {
            if (this._controller === controller) this._controller = null;
            this._busy = false;
            buttons.forEach((b) => { b.disabled = false; });
        }
    },

    _mount() {
        const host = qs('.media-description-section, .media-description');
        if (!host || this._panel || !Page.isLive()) return;
        const panel = document.createElement('div');
        panel.className = 'rx-dvr-panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Live DVR controls');
        panel.innerHTML = `
            <div class="rx-dvr-title">Live DVR</div>
            <div class="rx-dvr-row">
                <button class="rx-dvr-btn" data-sec="30">Save last 30s</button>
                <button class="rx-dvr-btn" data-sec="60">Save last 1m</button>
                <button class="rx-dvr-btn" data-sec="300">Save last 5m</button>
                <button class="rx-dvr-btn" data-sec="600">Save last 10m</button>
            </div>
            <div class="rx-dvr-status"></div>`;
        host.prepend(panel);
        this._panel = panel;
        for (const b of panel.querySelectorAll('.rx-dvr-btn')) {
            b.addEventListener('click', () => this._save(parseInt(b.dataset.sec, 10)));
        }
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-livedvr-css');
        waitForFeature(this, '.media-description, .media-description-section', 12000).then(() => {
            setFeatureTimeout(this, () => this._mount(), 1000);
        }).catch(() => {});
    },

    destroy() {
        this._controller?.abort();
        this._controller = null;
        this._styleEl?.remove();
        this._panel?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Subtitle Sidecar (load SRT/VTT file, overlay captions)
// ═══════════════════════════════════════════
const SubtitleSidecar = {
    id: 'subtitleSidecar',
    name: 'Subtitle Sidecar',
    _styleEl: null,
    _panel: null,
    _cues: [],
    _overlayEl: null,
    _timeHandler: null,

    _css: `
        .rx-sub-panel {
            margin: 8px 0; padding: 10px;
            background: rgba(137,180,250,0.06); border: 1px solid rgba(137,180,250,0.2);
            border-radius: 8px;
        }
        .rx-sub-title { font: 700 11px/1 system-ui, sans-serif; color: var(--rx-accent,#89b4fa); margin-bottom: 6px; text-transform: uppercase; }
        .rx-sub-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .rx-sub-btn {
            background: rgba(49,50,68,0.4); border: 1px solid rgba(255,255,255,0.06);
            color: #cdd6f4; border-radius: 5px; padding: 4px 10px; cursor: pointer;
            font: 600 11px/1 system-ui, sans-serif;
        }
        .rx-sub-btn:hover { background: rgba(49,50,68,0.7); }
        .rx-sub-status { font: 11px system-ui; color: #a6adc8; }
        .rx-sub-overlay {
            position: absolute; left: 50%; bottom: 12%; transform: translateX(-50%);
            max-width: 85%; padding: 6px 14px;
            background: rgba(0,0,0,0.78); color: #fff;
            font: 600 18px/1.3 system-ui, sans-serif; text-align: center;
            border-radius: 4px; pointer-events: none; z-index: 20;
            text-shadow: 0 1px 2px rgba(0,0,0,0.8);
            white-space: pre-line;
        }
    `,

    _tsToSec(ts) {
        const m = ts.match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)/);
        if (!m) return 0;
        return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2]) * 60) + parseInt(m[3]) + (parseInt(m[4]) / 1000);
    },

    _parse(text) {
        text = text.replace(/^WEBVTT.*\n/, '').replace(/\r/g, '');
        const blocks = text.split(/\n\n+/);
        const cues = [];
        for (const b of blocks) {
            const line = b.split('\n').find(l => l.includes('-->'));
            if (!line) continue;
            const [a, c] = line.split('-->').map(s => s.trim());
            const lines = b.split('\n');
            const idx = lines.findIndex(l => l.includes('-->'));
            const content = lines.slice(idx + 1).join('\n').trim();
            if (content) cues.push({ start: this._tsToSec(a), end: this._tsToSec(c), text: content });
        }
        return cues.sort((a, b) => a.start - b.start);
    },

    _attach() {
        const v = qs('video');
        if (!v) return;
        if (!this._overlayEl) {
            const overlay = document.createElement('div');
            overlay.className = 'rx-sub-overlay';
            overlay.style.display = 'none';
            const parent = v.parentElement || v.closest('[id^="vid_v"]') || document.body;
            parent.style.position = parent.style.position || 'relative';
            parent.appendChild(overlay);
            this._overlayEl = overlay;
        }
        if (!this._timeHandler) {
            this._timeHandler = () => {
                const t = v.currentTime;
                const active = this._cues.find(c => t >= c.start && t <= c.end);
                if (active) {
                    this._overlayEl.textContent = active.text;
                    this._overlayEl.style.display = 'block';
                } else {
                    this._overlayEl.style.display = 'none';
                }
            };
            v.addEventListener('timeupdate', this._timeHandler);
        }
    },

    _load(text) {
        this._cues = this._parse(text);
        const s = this._panel?.querySelector('.rx-sub-status');
        if (s) s.textContent = `${this._cues.length} cues loaded`;
        this._attach();
        Transcripts?._loadExternalCues?.(this._cues);
    },

    _mount() {
        const host = qs('.media-description-section, .media-description');
        if (!host || this._panel) return;
        const panel = document.createElement('div');
        panel.className = 'rx-sub-panel';
        panel.innerHTML = `
            <div class="rx-sub-title">Subtitles</div>
            <div class="rx-sub-row">
                <button class="rx-sub-btn rx-sub-upload">Load SRT/VTT...</button>
                <button class="rx-sub-btn rx-sub-clear">Clear</button>
                <span class="rx-sub-status"></span>
            </div>`;
        host.prepend(panel);
        this._panel = panel;
        panel.querySelector('.rx-sub-upload').addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = '.vtt,.srt,.txt';
            input.addEventListener('change', () => {
                const f = input.files[0]; if (!f) return;
                if (f.size > 5 * 1024 * 1024) {
                    const status = panel.querySelector('.rx-sub-status');
                    if (status) status.textContent = 'Subtitle file exceeds the 5 MB limit';
                    return;
                }
                const r = new FileReader();
                r.onload = () => this._load(String(r.result || ''));
                r.onerror = () => {
                    const status = panel.querySelector('.rx-sub-status');
                    if (status) status.textContent = 'Could not read subtitle file';
                };
                r.readAsText(f);
            });
            input.click();
        });
        panel.querySelector('.rx-sub-clear').addEventListener('click', () => {
            this._cues = [];
            if (this._overlayEl) this._overlayEl.style.display = 'none';
            const s = panel.querySelector('.rx-sub-status'); if (s) s.textContent = '';
            Transcripts?._loadExternalCues?.([]);
        });
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-subsidecar-css');
        waitForFeature(this, '.media-description, .media-description-section', 12000).then(() => {
            setFeatureTimeout(this, () => this._mount(), 900);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._panel?.remove();
        this._overlayEl?.remove();
        const v = qs('video');
        if (v && this._timeHandler) v.removeEventListener('timeupdate', this._timeHandler);
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Transcripts (clickable transcript panel)
// ═══════════════════════════════════════════
const Transcripts = {
    id: 'transcripts',
    name: 'Transcripts',
    _styleEl: null,
    _panel: null,
    _cues: [],

    _css: `
        .rx-trans-panel {
            margin: 8px 0; padding: 10px;
            background: rgba(203,166,247,0.06); border: 1px solid rgba(203,166,247,0.22);
            border-radius: 8px;
        }
        .rx-trans-title { font: 700 11px/1 system-ui, sans-serif; color: #cba6f7; margin-bottom: 6px; text-transform: uppercase; }
        .rx-trans-hint { font: 11px system-ui; color: #6c7086; margin-bottom: 6px; }
        .rx-trans-list { max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
        .rx-trans-row {
            display: flex; gap: 8px; padding: 4px 6px; cursor: pointer;
            border-radius: 4px; font: 12px/1.4 system-ui;
        }
        .rx-trans-row:hover { background: rgba(203,166,247,0.1); }
        .rx-trans-row .rx-tr-time {
            color: #cba6f7; font-weight: 600; font-variant-numeric: tabular-nums;
            min-width: 52px; flex-shrink: 0;
        }
        .rx-trans-search {
            width: 100%; background: rgba(49,50,68,0.5);
            border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
            padding: 5px 8px; color: #cdd6f4; font-size: 11px; margin-bottom: 6px; outline: none;
        }
    `,

    _fmt(t) {
        t = Math.max(0, Math.floor(t));
        const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
        return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
    },

    _render() {
        if (!this._panel) return;
        const list = this._panel.querySelector('.rx-trans-list');
        list.innerHTML = '';
        if (!this._cues.length) {
            list.innerHTML = '<div class="rx-trans-hint">No transcript loaded. Load a VTT/SRT via the Subtitles panel.</div>';
            return;
        }
        for (const c of this._cues) {
            const row = document.createElement('div');
            row.className = 'rx-trans-row';
            const ts = document.createElement('span'); ts.className = 'rx-tr-time'; ts.textContent = this._fmt(c.start);
            const tx = document.createElement('span'); tx.textContent = c.text;
            row.append(ts, tx);
            row.addEventListener('click', () => {
                const v = qs('video');
                if (v) { v.currentTime = c.start; v.play().catch(() => {}); }
            });
            list.appendChild(row);
        }
    },

    _filter(q) {
        q = (q || '').toLowerCase();
        const rows = this._panel?.querySelectorAll('.rx-trans-row') || [];
        for (const row of rows) {
            const t = row.textContent.toLowerCase();
            row.style.display = !q || t.includes(q) ? '' : 'none';
        }
    },

    _loadExternalCues(cues) {
        this._cues = cues || [];
        this._render();
    },

    _mount() {
        const host = qs('.media-description-section, .media-description');
        if (!host || this._panel) return;
        const panel = document.createElement('div');
        panel.className = 'rx-trans-panel';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', 'Transcript');
        panel.innerHTML = `
            <div class="rx-trans-title">Transcript</div>
            <input type="text" class="rx-trans-search" placeholder="Search transcript...">
            <div class="rx-trans-list"></div>`;
        host.prepend(panel);
        this._panel = panel;
        panel.querySelector('.rx-trans-search').addEventListener('input', (e) => this._filter(e.target.value));
        this._render();
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-transcripts-css');
        waitForFeature(this, '.media-description, .media-description-section', 12000).then(() => {
            setFeatureTimeout(this, () => this._mount(), 950);
        }).catch(() => {});
    },

    destroy() {
        this._styleEl?.remove();
        this._panel?.remove();
    }
};

// ═══════════════════════════════════════════
//  FEATURE: Low-Bitrate MP4 (for background listening)
// ═══════════════════════════════════════════
// Note: true audio-only extraction from a TS/HLS source requires an audio
// demuxer (e.g. ffmpeg.wasm) we don't ship. Instead we fetch the lowest
// bandwidth variant which is full-video-but-tiny, suitable for listening.
// The setting key stays `audioOnly` for compatibility with saved settings.
const AudioOnly = {
    id: 'audioOnly',
    name: 'Low-Bitrate MP4',
    _styleEl: null,
    _obs: null,
    _busy: false,
    _controller: null,

    _css: `
        .rx-dl-audio-btn {
            display: block; width: 100%; margin-top: 8px;
            background: rgba(249,226,175,0.12); border: 1px solid rgba(249,226,175,0.3);
            color: #f9e2af; border-radius: 8px; padding: 10px; cursor: pointer;
            font: 600 12px/1 system-ui, sans-serif;
            transition: background .15s;
        }
        .rx-dl-audio-btn:hover { background: rgba(249,226,175,0.2); }
        .rx-dl-audio-btn:disabled { opacity: 0.55; cursor: progress; }
        .rx-dl-audio-note {
            font: 10px/1.4 system-ui, sans-serif; color: var(--rx-subtext, #a6adc8);
            margin-top: 4px; padding: 0 4px;
        }
    `,

    async _extractAudio() {
        if (this._busy) return;
        const panel = qs('#rx-tab-download .rx-dl-body');
        if (!panel) return;
        this._busy = true;
        this._controller?.abort();
        const controller = new AbortController();
        this._controller = controller;
        const { signal } = controller;
        const btn = qs('.rx-dl-audio-btn');
        if (btn) btn.disabled = true;

        const status = document.createElement('div');
        status.className = 'rx-dl-status';
        panel.appendChild(status);
        const setStatus = (m) => { status.textContent = m; };
        try {
            setStatus('Fetching embed data...');
            const embedId = VideoDownloader._getEmbedId();
            if (!embedId) throw new Error('No embed id');
            const data = VideoDownloader._embedData || await VideoDownloader._fetchEmbedData(embedId, signal);
            VideoDownloader._embedData = data;
            const hls = VideoDownloader._extractHlsUrl(data);
            if (!hls) throw new Error('No valid HLS playlist');
            const masterResponse = await RXPlatform.fetch(hls, { signal });
            if (!masterResponse.ok) throw VideoDownloader._httpError(masterResponse, 'master-playlist', hls);
            const master = await masterResponse.text();
            const variants = VideoDownloader._parseMasterPlaylist(master, hls);
            const variant = [...variants].sort((a, b) => (a.bandwidth || 0) - (b.bandwidth || 0))[0];
            if (!variant) throw new Error('No stream variant found');
            const variantResponse = await RXPlatform.fetch(variant.url, { signal });
            if (!variantResponse.ok) throw VideoDownloader._httpError(variantResponse, 'segment-playlist', variant.url);
            const vtxt = await variantResponse.text();
            const segUrls = VideoDownloader._parseSegmentPlaylist(vtxt, variant.url);
            if (!segUrls.length) throw new Error('No segments in playlist');

            const buffers = await VideoDownloader._downloadBuffers(segUrls, {
                signal,
                onProgress: (done, total) => setStatus(`Downloading ${done}/${total}...`),
            });
            setStatus('Packaging MP4...');
            const blob = await VideoDownloader._transmuxWithWorker(buffers, signal);
            const title = VideoDownloader._getTitle();
            const tag = variant.height ? `${variant.height}p` : 'lo';
            VideoDownloader._triggerSave(blob, `${title} - ${tag}.mp4`, 'video/mp4');
            setStatus('Saved. Low-bitrate MP4 is full video at the smallest size — good for listening.');
        } catch (e) {
            setStatus(e?.name === 'AbortError' ? 'Download cancelled.' : 'Error: ' + e.message);
        } finally {
            if (this._controller === controller) this._controller = null;
            this._busy = false;
            if (btn) btn.disabled = false;
        }
    },

    _mountBtn() {
        const body = qs('#rx-tab-download .rx-dl-body');
        if (!body || qs('.rx-dl-audio-btn')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rx-dl-audio-btn';
        btn.textContent = 'Low-Bitrate MP4 (for listening)';
        btn.addEventListener('click', () => this._extractAudio());
        body.appendChild(btn);
        const note = document.createElement('div');
        note.className = 'rx-dl-audio-note';
        note.textContent = 'Fetches the smallest video variant. Not audio-only — saves as .mp4 at lowest quality.';
        body.appendChild(note);
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-audioonly-css');
        this._obs = new MutationObserver(() => {
            const body = qs('#rx-tab-download .rx-dl-body');
            if (body && body.children.length && !body.querySelector('.rx-dl-audio-btn')) {
                this._mountBtn();
            }
        });
        this._obs.observe(document.body, { childList: true, subtree: true });
    },

    destroy() {
        this._controller?.abort();
        this._controller = null;
        this._styleEl?.remove();
        this._obs?.disconnect();
    }
};

// ═══════════════════════════════════════════
//  HELPER: File System Access — folder-handle persistence
// ═══════════════════════════════════════════
// Chrome-only opt-in folder picker plumbing. BatchDownload uses it today; any
// future direct-write feature (archive queue alternate sink, transcript dump,
// etc.) can share the same `pick → persist handle in IDB → request permission
// per-session → stream-pipe to a writable file` flow.
//
// Spec: https://wicg.github.io/file-system-access/
// - Stores a FileSystemDirectoryHandle in IndexedDB so it survives SW restarts
//   and full-window reloads. JSON serialization can't carry the handle (it's a
//   live filesystem resource), which is why we DON'T just stuff it into
//   chrome.storage with the rest of the settings.
// - Permission MUST be re-granted from a user-gesture every session per spec;
//   queryPermission() is silent, requestPermission() needs a gesture.
// - Every error path returns `{ ok: false, reason }` so the caller can fall
//   back to chrome.downloads.download() without throwing.
const RxFsAccess = {
    _IDB_NAME: 'rx-fs-access',
    _IDB_STORE: 'handles',
    _IDB_VERSION: 1,
    _db: null,

    isSupported() {
        return typeof window !== 'undefined'
            && typeof window.showDirectoryPicker === 'function'
            && typeof indexedDB !== 'undefined';
    },

    async _openDb() {
        if (this._db) return this._db;
        return new Promise((resolve, reject) => {
            let req;
            try { req = indexedDB.open(this._IDB_NAME, this._IDB_VERSION); }
            catch (err) { reject(err); return; }
            req.onupgradeneeded = () => {
                try {
                    if (!req.result.objectStoreNames.contains(this._IDB_STORE)) {
                        req.result.createObjectStore(this._IDB_STORE);
                    }
                } catch (err) { reject(err); }
            };
            req.onsuccess = () => { this._db = req.result; resolve(this._db); };
            req.onerror = () => reject(req.error || new Error('idb-open-failed'));
            req.onblocked = () => reject(new Error('idb-blocked'));
        });
    },

    async putHandle(key, handle) {
        if (!handle) return false;
        try {
            const db = await this._openDb();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(this._IDB_STORE, 'readwrite');
                tx.objectStore(this._IDB_STORE).put(handle, key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error || new Error('idb-put-failed'));
                tx.onabort = () => reject(tx.error || new Error('idb-put-aborted'));
            });
        } catch (err) {
            console.warn('[RumbleX] RxFsAccess.putHandle failed:', err);
            return false;
        }
    },

    async getHandle(key) {
        try {
            const db = await this._openDb();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(this._IDB_STORE, 'readonly');
                const req = tx.objectStore(this._IDB_STORE).get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error || new Error('idb-get-failed'));
            });
        } catch (err) {
            console.warn('[RumbleX] RxFsAccess.getHandle failed:', err);
            return null;
        }
    },

    async deleteHandle(key) {
        try {
            const db = await this._openDb();
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(this._IDB_STORE, 'readwrite');
                tx.objectStore(this._IDB_STORE).delete(key);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error || new Error('idb-delete-failed'));
            });
        } catch (err) {
            console.warn('[RumbleX] RxFsAccess.deleteHandle failed:', err);
            return false;
        }
    },

    // Returns true only if permission ends up `granted`. queryPermission is
    // safe to call without a user gesture; requestPermission requires one,
    // so callers must invoke this from a click handler the first time per
    // session.
    async ensurePermission(handle, mode = 'readwrite') {
        if (!handle || typeof handle.queryPermission !== 'function') return false;
        try {
            const q = await handle.queryPermission({ mode });
            if (q === 'granted') return true;
            if (typeof handle.requestPermission !== 'function') return false;
            const r = await handle.requestPermission({ mode });
            return r === 'granted';
        } catch (err) {
            // Some user agents throw if the handle was created in a different
            // origin / partition or has been invalidated. Treat as "denied".
            console.warn('[RumbleX] RxFsAccess.ensurePermission failed:', err);
            return false;
        }
    },

    // Pick a folder via showDirectoryPicker. Persists the handle in IDB under
    // `key`. MUST be called from a user gesture (click handler).
    async pickFolder(key, options = {}) {
        if (!this.isSupported()) throw new Error('not-supported');
        const handle = await window.showDirectoryPicker({
            id: options.id || 'rx-batch-downloads',
            startIn: options.startIn || 'downloads',
            mode: 'readwrite',
        });
        await this.putHandle(key, handle);
        return handle;
    },

    // Sanitize a filename — same rules as background.js rxArchiveSanitizeFilename
    // so cross-pipeline filenames are consistent.
    sanitizeFilename(name, fallback = 'rumble_video.mp4') {
        let s = String(name || '').trim();
        s = s.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
        s = s.replace(/\s+/g, ' ');
        if (s.length > 180) s = s.substring(0, 180);
        return s || fallback;
    },

    // Write a Response.body / ReadableStream / Blob to a file in the chosen
    // folder. Returns { ok, path?, reason?, error? } — every failure path
    // returns rather than throws so the caller can fall back gracefully.
    async writeStream(handle, filename, source) {
        if (!handle) return { ok: false, reason: 'no-handle' };
        const granted = await this.ensurePermission(handle, 'readwrite');
        if (!granted) return { ok: false, reason: 'permission-denied' };

        const safe = this.sanitizeFilename(filename);
        let fileHandle;
        let writable;
        try {
            fileHandle = await handle.getFileHandle(safe, { create: true });
            writable = await fileHandle.createWritable();
        } catch (err) {
            return { ok: false, reason: 'open-failed', error: String(err) };
        }

        try {
            if (source instanceof Blob) {
                await writable.write(source);
                await writable.close();
            } else if (source && typeof source.pipeTo === 'function') {
                // Response.body is a ReadableStream and has pipeTo.
                await source.pipeTo(writable);
            } else if (source && typeof source.getReader === 'function') {
                const reader = source.getReader();
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    await writable.write(value);
                }
                await writable.close();
            } else {
                try { await writable.abort('unknown-source-type'); } catch {}
                return { ok: false, reason: 'unknown-source-type' };
            }
            return { ok: true, path: safe };
        } catch (err) {
            try { await writable.abort('write-failed'); } catch {}
            return { ok: false, reason: 'write-failed', error: String(err) };
        }
    },
};

// ═══════════════════════════════════════════
//  FEATURE: Batch Download (multi-select from feed)
// ═══════════════════════════════════════════
const BatchDownload = {
    id: 'batchDownload',
    name: 'Batch Download',
    _styleEl: null,
    _obs: null,
    _queue: null,
    _selected: null,
    _cards: null,
    _busy: false,
    // v3.26.0 — Optional File System Access folder. When set, downloads stream
    // directly to the chosen folder via writeStream(); otherwise we fall back
    // to chrome.downloads via the background SW (same path as v1.8+).
    _folderHandle: null,
    _FOLDER_IDB_KEY: 'batchFolder',

    _css: `
        .rx-batch-chk {
            position: absolute; top: 6px; left: 6px; z-index: 4;
            width: 20px; height: 20px; border-radius: 4px;
            background: rgba(0,0,0,0.7); border: 2px solid rgba(255,255,255,0.5);
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity .15s;
        }
        .videostream:hover .rx-batch-chk,
        article.video-item:hover .rx-batch-chk,
        rum-video-thumbnail[role="listitem"]:hover .rx-batch-chk,
        .rx-batch-mode .rx-batch-chk { opacity: 1; }
        .rx-batch-chk.checked {
            background: var(--rx-accent, #89b4fa); border-color: var(--rx-accent, #89b4fa);
        }
        .rx-batch-chk.checked::after { content: '✓'; color: #0f0f0f; font: 700 12px system-ui; }

        .rx-batch-bar {
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            z-index: 10020; display: flex; gap: 10px; align-items: center;
            background: rgba(30,30,46,0.97); border: 1px solid rgba(137,180,250,0.3);
            border-radius: 12px; padding: 10px 14px;
            font: 600 12px system-ui, sans-serif; color: #cdd6f4;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;
        }
        .rx-batch-bar.visible { opacity: 1; pointer-events: auto; transform: translateX(-50%) translateY(0); }
        .rx-batch-bar button {
            background: rgba(137,180,250,0.15); border: 1px solid rgba(137,180,250,0.3);
            color: var(--rx-accent, #89b4fa); border-radius: 6px; padding: 5px 10px;
            cursor: pointer; font: 600 11px system-ui;
        }
        .rx-batch-bar button:hover { background: rgba(137,180,250,0.25); }
        .rx-batch-bar .rx-batch-clear { color: #f38ba8; border-color: rgba(243,139,168,0.3); background: rgba(243,139,168,0.1); }
    `,

    _attachToCard(card) {
        if (card.dataset.rxBatch) return;
        card.dataset.rxBatch = '1';
        this._cards?.set(card, card.style.position);
        card.style.position = card.style.position || 'relative';
        const chk = document.createElement('div');
        chk.className = 'rx-batch-chk';
        chk.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            chk.classList.toggle('checked');
            const url = VideoCards.url(card);
            if (!url) return;
            if (chk.classList.contains('checked')) this._selected.add(url);
            else this._selected.delete(url);
            this._updateBar();
        });
        card.appendChild(chk);
    },

    _scan() {
        for (const card of VideoCards.all()) this._attachToCard(card);
    },

    _updateBar() {
        if (!this._queue) return;
        const bar = this._queue;
        const count = this._selected.size;
        bar.querySelector('.rx-batch-count').textContent = `${count} selected`;
        bar.classList.toggle('visible', count > 0);
    },

    _extractEmbedId(url) {
        try {
            const u = new URL(url, location.origin);
            const m = u.pathname.match(/^\/(v[a-z0-9]+)/i);
            return m ? m[1] : null;
        } catch { return null; }
    },

    _titleFromUrl(url) {
        try {
            const u = new URL(url, location.origin);
            const slug = u.pathname
                .replace(/^\/v[a-z0-9]+-?/i, '')
                .replace(/\.html?$/i, '');
            const decoded = decodeURIComponent(slug || 'rumble_video');
            return decoded.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').substring(0, 80) || 'rumble_video';
        } catch { return 'rumble_video'; }
    },

    async _downloadOne(url) {
        const embedId = this._extractEmbedId(url);
        if (!embedId) throw new Error('Not a Rumble video URL');
        const data = await VideoDownloader._fetchEmbedData(embedId);
        const qualities = VideoDownloader._parseQualities(data);
        // Prefer a direct MP4 (fastest); HLS-only variants need transmux which
        // is too expensive to run in a batch.
        const pick = qualities.find((q) => q.directUrl);
        if (!pick) throw new Error('No direct MP4 available');
        const title = this._titleFromUrl(url);
        const filename = `${title} - ${pick.label}.mp4`;

        // Path 1 — File System Access: stream directly into the user-picked
        // folder. Only attempted if the user picked a folder AND we still hold
        // read/write permission. Any error falls through to chrome.downloads
        // so partial-write or revoked-permission doesn't strand a download.
        if (this._folderHandle && RxFsAccess.isSupported()) {
            try {
                const resp = await RXPlatform.fetch(pick.directUrl, { credentials: 'omit' });
                if (resp.ok) {
                    const result = await RxFsAccess.writeStream(this._folderHandle, filename, resp.body);
                    if (result.ok) return;
                    console.warn('[RumbleX] BatchDownload: FS-Access write failed, falling back to chrome.downloads', result);
                } else {
                    console.warn('[RumbleX] BatchDownload: direct fetch HTTP ' + resp.status + ', falling back');
                }
            } catch (err) {
                console.warn('[RumbleX] BatchDownload: FS-Access path errored, falling back', err);
            }
        }

        // Path 2 — chrome.downloads via background SW (default + universal
        // fallback). Works on Firefox MV2 too.
        await RXPlatform.sendMessage({
            action: 'download',
            data: { url: pick.directUrl, filename },
        });
    },

    // v3.26.0 — Folder picker plumbing (Chrome/Edge only)

    _status(msg) {
        if (!this._queue) return;
        const status = this._queue.querySelector('.rx-batch-status');
        if (!status) return;
        status.textContent = msg;
        if (msg) setTimeout(() => { if (status.textContent === msg) status.textContent = ''; }, 3500);
    },

    _updateFolderLabel() {
        if (!this._queue) return;
        const label = this._queue.querySelector('.rx-batch-folder');
        const clearBtn = this._queue.querySelector('.rx-batch-clear-folder');
        if (!label) return;
        const name = this._folderHandle?.name || '';
        if (name) {
            label.textContent = `→ ${name}`;
            label.title = `Batch downloads save to folder "${name}"`;
            label.style.display = '';
            if (clearBtn) clearBtn.style.display = '';
        } else {
            label.textContent = '';
            label.style.display = 'none';
            if (clearBtn) clearBtn.style.display = 'none';
        }
    },

    async _restoreFolder() {
        if (!RxFsAccess.isSupported()) return;
        try {
            const h = await RxFsAccess.getHandle(this._FOLDER_IDB_KEY);
            // Don't request permission on init (no user gesture) — only verify
            // the handle survives. ensurePermission() runs lazily in
            // _downloadOne / on the explicit "Pick folder" click. If
            // permission is now revoked, the FS-Access path will fall back
            // automatically and chrome.downloads picks up the slack.
            if (h) {
                this._folderHandle = h;
                this._updateFolderLabel();
            }
        } catch (err) {
            console.warn('[RumbleX] BatchDownload: restoreFolder failed', err);
        }
    },

    async _pickFolder() {
        if (!RxFsAccess.isSupported()) {
            this._status('Folder picker requires Chrome / Edge — falling back to default Downloads.');
            return;
        }
        try {
            const h = await RxFsAccess.pickFolder(this._FOLDER_IDB_KEY);
            this._folderHandle = h;
            Settings.set('batchDownloadFolderName', h.name || '');
            this._updateFolderLabel();
            this._status(`Saving downloads to "${h.name}"`);
        } catch (err) {
            if (err && err.name === 'AbortError') return; // user dismissed
            console.warn('[RumbleX] BatchDownload: pickFolder failed', err);
            this._status('Folder picker failed (see console).');
        }
    },

    async _clearFolder() {
        try { await RxFsAccess.deleteHandle(this._FOLDER_IDB_KEY); } catch {}
        this._folderHandle = null;
        Settings.set('batchDownloadFolderName', '');
        this._updateFolderLabel();
        this._status('Folder cleared — using default Downloads.');
    },

    async _downloadAll() {
        if (this._busy) return;
        const items = [...this._selected];
        if (!items.length) return;
        // v3.26.0 — Pre-flight FS-Access permission inside the user-gesture
        // context (the "Download all" click). requestPermission() per spec
        // requires a user activation; doing it here once ensures the prompt
        // (if any) fires predictably BEFORE the parallel _downloadOne workers
        // start awaiting, instead of racing with Promise.all's microtask
        // scheduling. If the user denies, individual _downloadOne calls fall
        // through to chrome.downloads automatically.
        if (this._folderHandle && RxFsAccess.isSupported()) {
            try { await RxFsAccess.ensurePermission(this._folderHandle, 'readwrite'); }
            catch (err) { console.warn('[RumbleX] BatchDownload: pre-flight permission check failed', err); }
        }
        const status = this._queue.querySelector('.rx-batch-status');
        const CONCURRENT = 3;
        this._busy = true;
        let done = 0;
        let failed = 0;
        const queue = [...items];
        const render = () => { status.textContent = `Downloading ${done + failed}/${items.length}...`; };
        render();

        const worker = async () => {
            while (queue.length) {
                const url = queue.shift();
                try {
                    await this._downloadOne(url);
                    done++;
                } catch (err) {
                    failed++;
                    console.warn('[RumbleX] batch item failed:', url, err);
                }
                render();
            }
        };
        try {
            await Promise.all(
                Array.from({ length: Math.min(CONCURRENT, items.length) }, () => worker())
            );
        } finally {
            this._busy = false;
        }
        status.textContent = failed
            ? `Done: ${done} saved, ${failed} failed (see console for details)`
            : `Done: ${done} saved`;
        setTimeout(() => {
            this._selected.clear();
            for (const c of qsa('.rx-batch-chk.checked')) c.classList.remove('checked');
            this._updateBar();
            status.textContent = '';
        }, 3500);
    },

    _mountBar() {
        if (this._queue) return;
        const bar = document.createElement('div');
        bar.className = 'rx-batch-bar';
        // Build the bar with DOM builders rather than innerHTML — keeps the
        // XSS-hardening discipline from v1.9.3 even though no user data flows
        // through this region today.
        const count = document.createElement('span');
        count.className = 'rx-batch-count';
        count.textContent = '0 selected';
        const goBtn = document.createElement('button');
        goBtn.className = 'rx-batch-go';
        goBtn.textContent = 'Download all';
        const pickBtn = document.createElement('button');
        pickBtn.className = 'rx-batch-pick';
        pickBtn.textContent = 'Pick folder';
        pickBtn.title = 'Pick a folder to save downloads (Chrome / Edge only)';
        const folderLabel = document.createElement('span');
        folderLabel.className = 'rx-batch-folder';
        folderLabel.style.cssText = 'color:#a6e3a1;font-size:11px;display:none;';
        const clearFolderBtn = document.createElement('button');
        clearFolderBtn.className = 'rx-batch-clear-folder';
        clearFolderBtn.textContent = 'Clear folder';
        clearFolderBtn.title = 'Stop using the picked folder — revert to default Downloads';
        clearFolderBtn.style.display = 'none';
        const clearBtn = document.createElement('button');
        clearBtn.className = 'rx-batch-clear';
        clearBtn.textContent = 'Clear';
        const status = document.createElement('span');
        status.className = 'rx-batch-status';
        status.style.cssText = 'color:#a6adc8;font-size:11px;';
        // Order: count, Download all, Pick folder, [folder label], [clear folder], Clear selection, status
        bar.appendChild(count);
        bar.appendChild(goBtn);
        bar.appendChild(pickBtn);
        bar.appendChild(folderLabel);
        bar.appendChild(clearFolderBtn);
        bar.appendChild(clearBtn);
        bar.appendChild(status);
        document.body.appendChild(bar);

        goBtn.addEventListener('click', () => this._downloadAll());
        pickBtn.addEventListener('click', () => this._pickFolder());
        clearFolderBtn.addEventListener('click', () => this._clearFolder());
        clearBtn.addEventListener('click', () => {
            this._selected.clear();
            for (const c of qsa('.rx-batch-chk.checked')) c.classList.remove('checked');
            this._updateBar();
        });
        // Hide the picker entirely on Firefox MV2 / older Chromium — the rest
        // of the bar still works via chrome.downloads.
        if (!RxFsAccess.isSupported()) {
            pickBtn.style.display = 'none';
        }
        this._queue = bar;
    },

    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isFeed() && !Page.isChannel() && !Page.isSearch() && !Page.isHome()) return;
        this._styleEl = injectStyle(this._css, 'rx-batch-css');
        this._selected = new Set();
        this._cards = new Map();
        this._mountBar();
        this._scan();
        this._obs = new MutationObserver(() => {
            clearTimeout(this._t);
            this._t = setTimeout(() => this._scan(), 150);
        });
        this._obs.observe(document.body, { childList: true, subtree: true });
        // Fire-and-forget: restore a previously picked folder handle from IDB
        // so the label + clear button reflect prior state. Permission isn't
        // re-requested here (no user gesture); the FS-Access path in
        // _downloadOne handles re-prompts lazily.
        this._restoreFolder();
    },

    destroy() {
        this._styleEl?.remove();
        this._obs?.disconnect();
        this._queue?.remove();
        for (const c of qsa('.rx-batch-chk')) c.remove();
        for (const [card, originalPosition] of this._cards || []) {
            delete card.dataset.rxBatch;
            card.style.position = originalPosition;
        }
        this._cards?.clear();
        this._cards = null;
        clearTimeout(this._t);
        this._folderHandle = null;
        this._styleEl = null;
        this._obs = null;
        this._queue = null;
        this._selected = null;
        this._busy = false;
    }
};

// ═══════════════════════════════════════════
//  RES PORT — CSS-toggle registry + factory
// ═══════════════════════════════════════════
// Ported from "Rumble Enhancement Suite" userscript (v11.0 by Matthew Parker).
// Every entry here becomes its own RumbleX feature module with identical
// init/destroy semantics as the handwritten modules. Consolidating them
// into a registry keeps the file readable while still giving each feature
// a dedicated setting key, panel card, and hot-reload hook.
//
// Shape: { id, label, desc, css, page?, default? }
//   page: 'watch' | 'feed' | 'home' | 'channel' | 'live' (optional gate)
//   default: defaults to `false` — all hide-X toggles ship opt-in so the
//   port doesn't silently change the user's feed on update.
const RX_CSS_TOGGLES = [
    // ── Main Page Layout ────────────────────────────────────
    { id: 'widenSearchBar', label: 'Widen Search Bar', desc: 'Expand the search bar to fill available header space.',
        css: `.header .header-div { display: flex; align-items: center; gap: 1rem; padding-right: 1.5rem; box-sizing: border-box; } .header-search { flex-grow: 1; max-width: none !important; } .header-search .header-search-field { width: 100% !important; }` },
    { id: 'hideUploadIcon', label: 'Hide Upload Icon', desc: 'Hide the upload/stream-live icon in the header.',
        css: `button.header-upload { display: none !important; }` },
    { id: 'hideHeaderAd', label: 'Hide "Go Ad-Free" Button', desc: 'Hide the "Go Ad-Free" button in the header.',
        css: `span.hidden.lg\\:flex:has(button[hx-get*="premium-value-prop"]) { display: none !important; }` },
    { id: 'hideProfileBacksplash', label: 'Hide Profile Backsplash', desc: 'Hide the large header image on channel profiles.',
        css: `div.channel-header--backsplash { display: none !important; } html.main-menu-mode-permanent { margin-top: 30px !important; }`, page: 'channel' },
    { id: 'hideFeaturedBanner', label: 'Hide Featured Banner', desc: 'Hide the top category banner on the home page.',
        css: `div.homepage-featured { display: none !important; }`, page: 'home' },
    { id: 'hideEditorPicks', label: "Hide Editor Picks", desc: "Hide the main 'Editor Picks' row on the home page.",
        css: `#section-editor-picks { display: none !important; }`, page: 'home' },
    { id: 'hideTopLiveCategories', label: "Hide 'Top Live' Row", desc: "Hide the 'Top Live Categories' row on the home page.",
        css: `section#section-top-live { display: none !important; }`, page: 'home' },
    { id: 'hidePremiumRow', label: "Hide Premium Row", desc: "Hide the Rumble Premium row on the home page.",
        css: `section#section-premium-videos { display: none !important; }`, page: 'home' },
    { id: 'hideHomepageAd', label: "Hide Ad Section (home)", desc: "Hide the ad container on the home page.",
        css: `section.homepage-section:has(.js-rac-desktop-container) { display: none !important; }`, page: 'home' },
    { id: 'hideForYouRow', label: "Hide 'For You' Row", desc: "Hide 'For You' recommendations on the home page.",
        css: `section#section-personal-recommendations { display: none !important; }`, page: 'home' },
    { id: 'hideGamingRow', label: "Hide Gaming Row", desc: "Hide the Gaming row on the home page.",
        css: `section#section-gaming { display: none !important; }`, page: 'home' },
    { id: 'hideFinanceRow', label: "Hide Finance & Crypto Row", desc: "Hide the Finance & Crypto row on the home page.",
        css: `section#section-finance { display: none !important; }`, page: 'home' },
    { id: 'hideLiveRow', label: "Hide Live Row", desc: "Hide the Live row on the home page.",
        css: `section#section-live-videos { display: none !important; }`, page: 'home' },
    { id: 'hideFeaturedPlaylistsRow', label: "Hide Featured Playlists", desc: "Hide the Featured Playlists row on the home page.",
        css: `section#section-featured-playlists { display: none !important; }`, page: 'home' },
    { id: 'hideSportsRow', label: "Hide Sports Row", desc: "Hide the Sports row on the home page.",
        css: `section#section-sports { display: none !important; }`, page: 'home' },
    { id: 'hideViralRow', label: "Hide Viral Row", desc: "Hide the Viral row on the home page.",
        css: `section#section-viral { display: none !important; }`, page: 'home' },
    { id: 'hidePodcastsRow', label: "Hide Podcasts Row", desc: "Hide the Podcasts row on the home page.",
        css: `section#section-podcasts { display: none !important; }`, page: 'home' },
    { id: 'hideLeaderboardRow', label: "Hide Leaderboard Row", desc: "Hide the Leaderboard row on the home page.",
        css: `section#section-leaderboard { display: none !important; }`, page: 'home' },
    { id: 'hideVlogsRow', label: "Hide Vlogs Row", desc: "Hide the Vlogs row on the home page.",
        css: `section#section-vlogs { display: none !important; }`, page: 'home' },
    { id: 'hideNewsRow', label: "Hide News Row", desc: "Hide the News row on the home page.",
        css: `section#section-news { display: none !important; }`, page: 'home' },
    { id: 'hideScienceRow', label: "Hide Health & Science Row", desc: "Hide the Health & Science row on the home page.",
        css: `section#section-science { display: none !important; }`, page: 'home' },
    { id: 'hideMusicRow', label: "Hide Music Row", desc: "Hide the Music row on the home page.",
        css: `section#section-music { display: none !important; }`, page: 'home' },
    { id: 'hideEntertainmentRow', label: "Hide Entertainment Row", desc: "Hide the Entertainment row on the home page.",
        css: `section#section-entertainment { display: none !important; }`, page: 'home' },
    { id: 'hideCookingRow', label: "Hide Cooking Row", desc: "Hide the Cooking row on the home page.",
        css: `section#section-cooking { display: none !important; }`, page: 'home' },
    { id: 'hideFooter', label: 'Hide Footer', desc: 'Remove the site footer entirely.',
        css: `footer.page__footer.foot.nav--transition { display: none !important; }` },

    // ── Video Page Layout ────────────────────────────────────
    { id: 'hideRelatedOnLive', label: 'Hide Related Media on Live', desc: 'Hide the "Related Media" section below the player on live streams.',
        css: `.media-page-related-media-desktop-floating { display: none !important; }`, page: 'watch' },
    { id: 'hideRelatedSidebar', label: 'Hide Related Sidebar', desc: 'Hide the related-videos sidebar for a focused view.',
        css: `aside.media-page-related-media-desktop-sidebar { display: none !important; }`, page: 'watch' },
    { id: 'widenContent', label: 'Widen Content Area', desc: 'Expand the main content area. Best used with the related sidebar hidden.',
        css: `body:has(aside.media-page-related-media-desktop-sidebar[style*="display: none"]) .main-and-sidebar .main-content { width: 100% !important; max-width: 100% !important; }`, page: 'watch' },
    { id: 'hideVideoDescription', label: 'Hide Video Description', desc: 'Hide the description, tags, and views block.',
        css: `.media-description-section { display: none !important; }`, page: 'watch' },
    { id: 'hidePausedVideoAds', label: 'Hide Paused-Video Ads', desc: 'Hide the ad overlay that appears when you pause a video.',
        css: `canvas#pause-ads__canvas { display: none !important; }`, page: 'watch' },

    // ── Player Controls (hide-X) ─────────────────────────────
    { id: 'hideRewindButton', label: 'Hide Rewind Button', desc: 'Hide the rewind button in the player controls.',
        css: `div[title="Rewind"] { display: none !important; }`, page: 'watch' },
    { id: 'hideFastForwardButton', label: 'Hide Fast Forward', desc: 'Hide the fast-forward button in the player controls.',
        css: `div[title="Fast forward"] { display: none !important; }`, page: 'watch' },
    { id: 'hideCCButton', label: 'Hide Closed Captions', desc: 'Hide the (CC) button in the player controls.',
        css: `div[title="Toggle closed captions"] { display: none !important; }`, page: 'watch' },
    { id: 'hideAutoplayButton', label: 'Hide Autoplay Toggle', desc: 'Hide the autoplay-toggle switch in player controls.',
        css: `div[title="Autoplay"] { display: none !important; }`, page: 'watch' },
    { id: 'hideTheaterButton', label: 'Hide Theater Button', desc: 'Hide the theater-mode button in player controls.',
        css: `div[title="Toggle theater mode"] { display: none !important; }`, page: 'watch' },
    { id: 'hidePipButton', label: 'Hide Picture-in-Picture', desc: 'Hide the PiP button in player controls.',
        css: `div[title="Toggle picture-in-picture mode"] { display: none !important; }`, page: 'watch' },
    { id: 'hideFullscreenButton', label: 'Hide Fullscreen Button', desc: 'Hide the fullscreen button in player controls.',
        css: `div[title="Toggle fullscreen"] { display: none !important; }`, page: 'watch' },
    { id: 'hidePlayerRumbleLogo', label: 'Hide Rumble Logo (player)', desc: 'Hide the Rumble logo inside the player.',
        css: `div:has(> div > svg[viewBox="0 0 140 35"]) { display: none !important; }`, page: 'watch' },
    { id: 'hidePlayerGradient', label: 'Hide Player Gradient', desc: 'Remove the cloudy gradient at the bottom of the player.',
        css: `.touched_overlay > div[style*="linear-gradient"] { display: none !important; }`, page: 'watch' },

    // ── Video Buttons (hide-X) ───────────────────────────────
    { id: 'hideLikeDislikeButton', label: 'Hide Like/Dislike', desc: 'Hide the like and dislike buttons below the player.',
        css: `div[data-js="media_action_vote_button"] { display: none !important; }`, page: 'watch' },
    { id: 'hideShareButton', label: 'Hide Share Button', desc: 'Hide the share button below the player.',
        css: `div[data-js="video_action_button_visible_location"][data-type="share"] { display: none !important; }`, page: 'watch' },
    { id: 'hideRepostButton', label: 'Hide Repost Button', desc: 'Hide the repost button below the player.',
        css: `div[data-js="video_action_button_visible_location"][data-type="reposts"] { display: none !important; }`, page: 'watch' },
    { id: 'hideEmbedButton', label: 'Hide Embed Button', desc: 'Hide the embed button below the player.',
        css: `div[data-js="video_action_button_visible_location"][data-type="embed"] { display: none !important; }`, page: 'watch' },
    { id: 'hideSaveButton', label: 'Hide Save Button', desc: 'Hide the save-to-playlist button below the player.',
        css: `div[data-js="video_action_button_visible_location"][data-type="playlist"] { display: none !important; }`, page: 'watch' },
    { id: 'hideCommentButton', label: 'Hide Comment Button', desc: 'Hide the main comment button below the player.',
        css: `div[data-js="video_action_button_visible_location"][data-type="comments"] { display: none !important; }`, page: 'watch' },
    { id: 'hideReportButton', label: 'Hide 3-dot Menu', desc: 'Hide the 3-dot menu containing the report option.',
        css: `.video-action-sub-menu-wrapper { display: none !important; }`, page: 'watch' },
    { id: 'hidePremiumJoinButtons', label: 'Hide Premium/Join', desc: 'Hide the "Rumble Premium" and "Join" buttons.',
        css: `button[hx-get*="premium-value-prop"], button[data-js="locals-subscription-button"] { display: none !important; }`, page: 'watch' },
    // v3.1.0 — Rumble Wallet tip button (launched 2026-01-07).
    // Selector intentionally broad — covers both `data-js` variants and the
    // fallback `hx-get*="wallet"`/class-name patterns documented in Selectors.
    { id: 'hideWalletTipButton', label: 'Hide Wallet Tip Button', desc: 'Hide the per-creator Rumble Wallet tip-jar button (launched January 2026). Off by default — leave on if you want to tip with crypto.',
        css: `button[hx-get*="wallet/payment/qr-modal"], [data-js="wallet_tip_button"], [data-js="tip_button"], [class*="tip-button"], [class*="TipButton"] { display: none !important; }`, page: 'watch' },

    // ── Comments ─────────────────────────────────────────────
    { id: 'moveReplyButton', label: 'Move Reply Button', desc: 'Move the reply button next to the like/dislike buttons.',
        css: `.comment-actions-wrapper { display: flex; align-items: center; } .comment-actions-wrapper .comment-actions { margin-left: 12px; }`, page: 'watch' },
    { id: 'hideCommentReportLink', label: 'Hide Comment Report Link', desc: 'Hide the "report" link on user comments.',
        css: `.comments-action-report.comments-action { display: none !important; }`, page: 'watch' },

    // ── Chat ─────────────────────────────────────────────────
    { id: 'cleanLiveChat', label: 'Clean Live Chat UI', desc: 'Hide pinned messages, chat header, and Rant buttons for a cleaner live-chat look.',
        css: `
            div.chat-pinned-ui__pinned-message-container,
            div.chat__pinned-ui-container { display: none !important; }
            div.chat--header { display: none !important; }
            section.chat.relative { margin-top: -71px !important; height: 715px !important; }
            button.media-page-chat-container-toggle-btn { margin-top: 580px !important; margin-left: -48px !important; }
            div.chat-message-form-section.chat-message-form-section-justify-between,
            .chat-message-form-section .user-image { display: none !important; }
        `, page: 'watch' },
];

// Factory — turns an RX_CSS_TOGGLES entry into a feature module object with
// RumbleX's standard init/destroy interface.
function makeCssToggleFeature(entry) {
    const pagePredicates = {
        watch: () => Page.isWatch(),
        home: () => Page.isHome(),
        feed: () => Page.isFeed(),
        channel: () => Page.isChannel(),
        live: () => Page.isLive(),
    };
    return {
        id: entry.id,
        name: entry.label,
        _styleEl: null,
        init() {
            if (!Settings.get(this.id)) return;
            if (entry.page && pagePredicates[entry.page] && !pagePredicates[entry.page]()) return;
            this._styleEl = injectStyle(entry.css, 'rx-css-' + entry.id);
        },
        destroy() {
            this._styleEl?.remove();
            this._styleEl = null;
        },
    };
}

// Materialize all CSS-toggle modules eagerly — they're cheap and referenced
// by the features[] array below.
const RX_CSS_FEATURES = RX_CSS_TOGGLES.map(makeCssToggleFeature);

// ═══════════════════════════════════════════
//  RES PORT — Auto-hide Header
// ═══════════════════════════════════════════
const AutoHideHeader = {
    id: 'autoHideHeader',
    name: 'Auto-hide Header',
    _styleEl: null,
    _handler: null,

    _css: `
        body.rx-autohide-header-active header.header {
            position: fixed; top: 0; left: 0; right: 0; z-index: 1001;
            opacity: 0; transition: opacity 0.3s ease-in-out; pointer-events: none;
        }
        body.rx-autohide-header-active.rx-header-visible header.header {
            opacity: 1; pointer-events: auto;
        }
        body.rx-autohide-header-active { padding-top: 0 !important; }
    `,

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-autohide-header-css');
        document.body.classList.add('rx-autohide-header-active');
        this._handler = (e) => {
            if (e.clientY < 80) {
                document.body.classList.add('rx-header-visible');
            } else if (!e.target.closest || !e.target.closest('header.header')) {
                document.body.classList.remove('rx-header-visible');
            }
        };
        document.addEventListener('mousemove', this._handler);
    },
    destroy() {
        if (this._handler) document.removeEventListener('mousemove', this._handler);
        this._handler = null;
        this._styleEl?.remove();
        document.body.classList.remove('rx-autohide-header-active', 'rx-header-visible');
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Auto-hide Navigation Sidebar
// ═══════════════════════════════════════════
const AutoHideNavSidebar = {
    id: 'autoHideNavSidebar',
    name: 'Auto-hide Nav Sidebar',
    _styleEl: null,
    _trigger: null,

    _css: `
        body.rx-autohide-nav-active nav.navs {
            position: fixed; top: 0; left: 0;
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
            z-index: 1002; height: 100vh; opacity: 0.95; visibility: hidden;
        }
        body.rx-autohide-nav-active main.nav--transition { margin-left: 0 !important; }
        #rx-nav-sidebar-trigger {
            position: fixed; top: 80px; left: 0; width: 30px; height: calc(100% - 80px); z-index: 1001;
        }
        #rx-nav-sidebar-trigger:hover + nav.navs,
        body.rx-autohide-nav-active nav.navs:hover {
            transform: translateX(0); opacity: 1; visibility: visible;
        }
    `,

    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-autohide-nav-css');
        document.body.classList.add('rx-autohide-nav-active');
        if (!qs('#rx-nav-sidebar-trigger')) {
            const trigger = document.createElement('div');
            trigger.id = 'rx-nav-sidebar-trigger';
            document.body.appendChild(trigger);
            this._trigger = trigger;
        }
    },
    destroy() {
        this._styleEl?.remove();
        document.body.classList.remove('rx-autohide-nav-active');
        qs('#rx-nav-sidebar-trigger')?.remove();
        this._trigger = null;
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Auto-like
// ═══════════════════════════════════════════
const AutoLike = {
    id: 'autoLike',
    name: 'Auto Like',
    _clicked: false,
    // Generation counter guards against a late `waitFor` resolution firing a
    // click after the feature has been destroyed and re-initialised (or just
    // disabled). Each `init()` bumps `_gen`; the promise callback checks that
    // it still matches before acting.
    _gen: 0,

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._clicked = false;
        const myGen = ++this._gen;
        waitForFeature(this, 'button.rumbles-vote-pill-up', 15000).then((btn) => {
            if (myGen !== this._gen || this._clicked) return;
            if (!btn.classList.contains('active')) {
                btn.click();
                this._clicked = true;
            }
        }).catch(() => {});
    },
    destroy() {
        this._gen++; // invalidates any still-pending waitFor promise
        this._clicked = false;
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Auto Load Comments
// ═══════════════════════════════════════════
const AutoLoadComments = {
    id: 'autoLoadComments',
    name: 'Auto Load Comments',
    _handler: null,

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        const isInView = (el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.top <= (window.innerHeight || document.documentElement.clientHeight);
        };
        this._handler = () => {
            const btn = qs('li.show-more-comments > button');
            if (btn && isInView(btn)) btn.click();
        };
        window.addEventListener('scroll', this._handler, { passive: true });
    },
    destroy() {
        if (this._handler) window.removeEventListener('scroll', this._handler);
        this._handler = null;
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Full-Width Player (with live two-column mode)
// ═══════════════════════════════════════════
const FullWidthPlayer = {
    id: 'fullWidthPlayer',
    name: 'Full-Width Player',
    _styleEl: null,
    _liveObs: null,
    _resizeHandler: null,
    _chatToggleHandler: null,
    _timer: null,

    _standardCss: `
        body.rx-full-width-player nav.navs,
        body.rx-full-width-player aside.media-page-related-media-desktop-sidebar,
        body.rx-full-width-player #player-spacer { display: none !important; }
        body.rx-full-width-player main.nav--transition { margin-left: 0 !important; }
        body.rx-full-width-player .main-and-sidebar { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
        body.rx-full-width-player .main-content,
        body.rx-full-width-player .media-container { width: 100% !important; max-width: 100% !important; }
        body.rx-full-width-player .video-player,
        body.rx-full-width-player [id^="vid_v"] {
            width: 100vw !important;
            height: calc(100vw * 9 / 16) !important;
            max-height: 100vh;
        }
        body.rx-full-width-player #videoPlayer video { object-fit: contain !important; }
    `,

    _liveCss: `
        body.rx-live-two-col:not(.rumble-player--fullscreen) .main-and-sidebar {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) var(--rx-chat-w, 360px);
            width: 100vw; max-width: 100vw; margin: 0; padding: 0; align-items: stretch;
        }
        body.rx-live-two-col:not(.rumble-player--fullscreen) .main-and-sidebar .main-content {
            display: flex; flex-direction: column;
        }
        body.rx-live-two-col:not(.rumble-player--fullscreen) .media-container { flex-grow: 1; }
        body.rx-live-two-col:not(.rumble-player--fullscreen) aside.media-page-chat-aside-chat {
            width: var(--rx-chat-w, 360px) !important;
            min-width: var(--rx-chat-w, 360px) !important;
            max-width: clamp(320px, var(--rx-chat-w, 360px), 480px) !important;
            position: relative; z-index: 1;
        }
        body.rx-live-two-col:not(.rumble-player--fullscreen) .video-player { margin-top: -30px; }
        body.rx-live-two-col:not(.rumble-player--fullscreen) .video-player,
        body.rx-live-two-col:not(.rumble-player--fullscreen) #videoPlayer,
        body.rx-live-two-col:not(.rumble-player--fullscreen) #videoPlayer > div,
        body.rx-live-two-col:not(.rumble-player--fullscreen) [id^="vid_v"] {
            width: 100% !important; height: 100% !important; max-height: none !important; background-color: #000;
        }
        body.rx-live-two-col:not(.rumble-player--fullscreen) #videoPlayer video {
            width: 100% !important; height: 100% !important; object-fit: contain;
        }
        body.rx-live-two-col.rx-live-chat-collapsed:not(.rumble-player--fullscreen) .main-and-sidebar {
            display: block !important;
        }
        body.rx-live-two-col.rx-live-chat-collapsed:not(.rumble-player--fullscreen) .video-player,
        body.rx-live-two-col.rx-live-chat-collapsed:not(.rumble-player--fullscreen) [id^="vid_v"] {
            width: 100vw !important; height: calc(100vw * 9 / 16) !important; max-height: 100vh !important; margin-top: 0;
        }
        @media (max-width: 1100px) {
            body.rx-live-two-col:not(.rumble-player--fullscreen) .main-and-sidebar {
                grid-template-columns: 1fr; align-items: start; width: auto; max-width: 100%;
            }
            body.rx-live-two-col:not(.rumble-player--fullscreen) aside.media-page-chat-aside-chat {
                width: 100% !important; min-width: 0 !important; max-width: none !important; height: 70vh;
            }
            body.rx-live-two-col:not(.rumble-player--fullscreen) .video-player { margin-top: 0; }
        }
        body.rx-live-two-col button.media-page-chat-container-toggle-btn { z-index: 2; }
    `,

    _activateLive() {
        document.body.classList.add('rx-live-two-col');
        const setChatWidthVar = () => {
            const chat = qs('aside.media-page-chat-aside-chat');
            let w = 360;
            if (chat && getComputedStyle(chat).display !== 'none') {
                const rect = chat.getBoundingClientRect();
                w = Math.max(320, Math.min(Math.round(rect.width || 360), 480));
            }
            document.documentElement.style.setProperty('--rx-chat-w', `${w}px`);
        };
        setChatWidthVar();
        this._resizeHandler = setChatWidthVar;
        window.addEventListener('resize', this._resizeHandler);
        waitForFeature(this, 'aside.media-page-chat-aside-chat', 15000).then((chat) => {
            this._liveObs = new MutationObserver(setChatWidthVar);
            this._liveObs.observe(chat, { attributes: true, attributeFilter: ['style', 'class'] });
        }).catch(() => {});
        this._chatToggleHandler = (e) => {
            const btn = e.target.closest('[data-js="media_page_chat_container_toggle_btn"]');
            if (!btn) return;
            setTimeout(() => {
                const chat = qs('aside.media-page-chat-aside-chat');
                const hidden = chat && getComputedStyle(chat).display === 'none';
                document.body.classList.toggle('rx-live-chat-collapsed', !!hidden);
            }, 50);
        };
        document.addEventListener('click', this._chatToggleHandler, true);
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        // Defer so the page's live badge renders first.
        clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            this._timer = null;
            const isLive = !!qs('.video-header-live-info, .media-header-live-badge, .video-badge--live') || Page.isLive();
            if (isLive) {
                this._styleEl = injectStyle(this._liveCss, 'rx-fullwidth-css');
                this._activateLive();
            } else {
                this._styleEl = injectStyle(this._standardCss, 'rx-fullwidth-css');
                document.body.classList.add('rx-full-width-player');
            }
        }, 250);
    },
    destroy() {
        clearTimeout(this._timer);
        this._timer = null;
        this._liveObs?.disconnect();
        this._liveObs = null;
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        this._resizeHandler = null;
        if (this._chatToggleHandler) document.removeEventListener('click', this._chatToggleHandler, true);
        this._chatToggleHandler = null;
        document.documentElement.style.removeProperty('--rx-chat-w');
        this._styleEl?.remove();
        document.body.classList.remove('rx-full-width-player', 'rx-live-two-col', 'rx-live-chat-collapsed');
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Adaptive Live Layout
// ═══════════════════════════════════════════
// On live pages, widens the main content whenever chat is visible. Plays
// nicely with FullWidthPlayer's live mode — but either is usable alone.
const AdaptiveLiveLayout = {
    id: 'adaptiveLiveLayout',
    name: 'Adaptive Live Layout',
    _obs: null,
    _styleId: 'rx-adaptive-live-css',

    _applyStyles(isChatVisible) {
        const css = isChatVisible
            ? `body:not(.rx-full-width-player):not(.rx-live-two-col) .main-and-sidebar .main-content { width: calc(100% - 350px) !important; max-width: none !important; }`
            : '';
        injectStyle(css, this._styleId);
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        if (!qs('.video-header-live-info')) return;
        waitForFeature(this, 'aside.media-page-chat-aside-chat', 15000).then((chat) => {
            this._obs = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.attributeName === 'style') {
                        const visible = getComputedStyle(m.target).display !== 'none';
                        this._applyStyles(visible);
                    }
                }
            });
            this._obs.observe(chat, { attributes: true, attributeFilter: ['style'] });
            this._applyStyles(getComputedStyle(chat).display !== 'none');
        }).catch(() => {});
    },
    destroy() {
        this._obs?.disconnect();
        this._obs = null;
        document.getElementById(this._styleId)?.remove();
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Comment Blocking (parallel to ChatUserBlock for comments)
// ═══════════════════════════════════════════
const CommentBlocking = {
    id: 'commentBlocking',
    name: 'Comment Blocking',
    _styleEl: null,
    _obs: null,

    _css: `
        .rx-blocked-comment { display: none !important; }
        .rx-comment-block-btn {
            margin-left: 8px; padding: 2px 8px;
            background: rgba(243,139,168,0.12); border: 1px solid rgba(243,139,168,0.3);
            color: #f38ba8; border-radius: 4px; cursor: pointer; opacity: 0;
            font: 600 10px/1.2 system-ui, sans-serif;
            transition: opacity .15s, background .15s;
        }
        .comment-item:hover .rx-comment-block-btn { opacity: 1; }
        .rx-comment-block-btn:hover { background: rgba(243,139,168,0.25); }
    `,

    _blocked() {
        return new Set((Settings.get('blockedCommenters') || []).map((u) => String(u).toLowerCase()));
    },

    _apply() {
        const blocked = this._blocked();
        for (const c of qsa('li.comment-item[data-username]')) {
            const u = (c.dataset.username || '').toLowerCase();
            c.classList.toggle('rx-blocked-comment', !!u && blocked.has(u));
            if (c.dataset.rxBlockBtn) continue;
            const meta = c.querySelector('.comments-meta');
            if (!meta) continue;
            c.dataset.rxBlockBtn = '1';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rx-comment-block-btn';
            btn.textContent = 'Block';
            btn.title = `Block ${u} from comments`;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const list = Settings.get('blockedCommenters') || [];
                if (!list.map((x) => String(x).toLowerCase()).includes(u) && u) {
                    list.push(u);
                    Settings.set('blockedCommenters', list);
                }
                this._apply();
            });
            meta.appendChild(btn);
        }
    },

    init() {
        if (!Settings.get(this.id) || !Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-commentblock-css');
        waitForFeature(this, '#video-comments, .media-page-comments-container', 15000).then((root) => {
            this._apply();
            this._obs = new MutationObserver(() => this._apply());
            this._obs.observe(root, { childList: true, subtree: true });
        }).catch(() => {});
    },
    destroy() {
        this._obs?.disconnect();
        this._obs = null;
        this._styleEl?.remove();
        for (const c of qsa('li.comment-item[data-rx-block-btn]')) delete c.dataset.rxBlockBtn;
        for (const b of qsa('.rx-comment-block-btn')) b.remove();
    },
};

// ═══════════════════════════════════════════
//  RES PORT — Site Theme sync (mirror Rumble's native light/dark/system)
// ═══════════════════════════════════════════
const SiteTheme = {
    id: 'siteTheme',
    name: 'Site Theme Sync',
    _obs: null,
    _gen: 0,

    // Settings.get('siteTheme') is a string: 'system' | 'dark' | 'light'
    _apply(themeValue) {
        const target = qs(`a.main-menu-item.theme-option[data-theme-option="${themeValue}"]`);
        if (target instanceof HTMLElement && !target.classList.contains('main-menu-item--active')) {
            try { target.click(); } catch {}
        }
    },

    _sync() {
        const activeEl = qs('a.main-menu-item.theme-option.main-menu-item--active');
        const active = activeEl?.dataset?.themeOption || 'system';
        if (Settings.get('siteTheme') !== active) {
            Settings.set('siteTheme', active);
        }
    },

    init() {
        if (!Settings.get('siteThemeSync')) return;
        const generation = ++this._gen;
        this._apply(Settings.get('siteTheme') || 'system');
        waitForFeature(this, '.theme-option-group', 15000).then((el) => {
            if (generation !== this._gen) return;
            this._obs = new MutationObserver(() => this._sync());
            this._obs.observe(el, { attributes: true, subtree: true, attributeFilter: ['class'] });
        }).catch(() => {});
    },
    destroy() {
        this._gen++;
        this._obs?.disconnect();
        this._obs = null;
    },
};

// ═══════════════════════════════════════════
//  FEATURE: Thumbnail Hider (v2.1.0)
// ═══════════════════════════════════════════
// Three independent toggles compose into one feature:
//   hideThumbnails        — master kill-switch (all thumbnails across the site)
//   hideThumbnailsFeeds   — feeds only (home/subs/for-you/search)
//   hideThumbnailsRelated — related sidebar only
//
// Implementation note: Rumble lazy-loads thumbnails as <img loading="lazy">.
// Hiding via CSS (visibility/opacity) keeps grid heights intact so cards
// don't reflow into ugly stacks. We also blank the background-image on
// poster wrappers, since some surfaces (live cards, hero banners) use CSS
// backgrounds instead of <img>.
const ThumbnailHider = {
    id: 'hideThumbnails',
    name: 'Thumbnail Hider',
    _styleEl: null,
    _buildCss() {
        const all = Settings.get('hideThumbnails');
        const feeds = Settings.get('hideThumbnailsFeeds');
        const related = Settings.get('hideThumbnailsRelated');
        const rules = [];
        // Master toggle: everything.
        if (all) {
            rules.push(`
                html.rumblex-active img.thumbnail__image,
                html.rumblex-active .thumbnail__thumb img,
                html.rumblex-active .thumbnail__thumb picture,
                html.rumblex-active .videostream__thumbnail img,
                html.rumblex-active .mediaList-item img,
                html.rumblex-active .video-item--img-wrapper img,
                html.rumblex-active img.video-item--img,
                html.rumblex-active rum-video-thumbnail .rum-video-thumbnail__image,
                html.rumblex-active rum-video-thumbnail img,
                html.rumblex-active .media-item__thumb img,
                html.rumblex-active picture.thumbnail__image-container > img,
                html.rumblex-active .channel-header--backsplash {
                    visibility: hidden !important;
                    opacity: 0 !important;
                    background-image: none !important;
                }
                html.rumblex-active .thumbnail__thumb,
                html.rumblex-active .videostream__thumbnail {
                    background: var(--rx-thumb-blank, #1b1b1b) !important;
                }
            `);
        } else {
            if (feeds) {
                rules.push(`
                    html.rumblex-active .thumbnail__grid .thumbnail__thumb img,
                    html.rumblex-active .streams__container .thumbnail__thumb img,
                    html.rumblex-active .videostream__thumbnail img,
                    html.rumblex-active .homepage-content--inner rum-video-thumbnail img,
                    html.rumblex-active .video-item--img-wrapper img,
                    html.rumblex-active img.video-item--img {
                        visibility: hidden !important;
                        opacity: 0 !important;
                    }
                    html.rumblex-active .thumbnail__grid .thumbnail__thumb,
                    html.rumblex-active .streams__container .thumbnail__thumb,
                    html.rumblex-active .videostream__thumbnail {
                        background: var(--rx-thumb-blank, #1b1b1b) !important;
                    }
                `);
            }
            if (related) {
                rules.push(`
                    html.rumblex-active .media-page-related-media-desktop-sidebar img,
                    html.rumblex-active .mediaList-item img,
                    html.rumblex-active .mediaList-item picture,
                    html.rumblex-active .media-page-related-media-desktop-sidebar rum-video-thumbnail .rum-video-thumbnail__image {
                        visibility: hidden !important;
                        opacity: 0 !important;
                    }
                `);
            }
        }
        return rules.join('\n');
    },
    init() {
        // Module always loads — internal toggles decide whether anything is injected.
        const css = this._buildCss();
        if (css) this._styleEl = injectStyle(css, 'rx-thumbnailhider');
    },
    destroy() { this._styleEl?.remove(); this._styleEl = null; },
};

// ═══════════════════════════════════════════
//  FEATURE: Dense Mode (v2.1.0)
// ═══════════════════════════════════════════
// Tightens spacing across feed grids and the watch page. Affects layout
// padding only — never overlaps content or changes column counts. Designed
// to pair with wideLayout for power users who want maximum signal density.
const DenseMode = {
    id: 'denseMode',
    name: 'Dense Mode',
    _styleEl: null,
    _css: `
        html.rumblex-active body.rx-dense .thumbnail__grid { gap: 8px !important; }
        html.rumblex-active body.rx-dense .thumbnail__title { line-height: 1.25 !important; margin-top: 4px !important; }
        html.rumblex-active body.rx-dense .videostream__footer { padding: 4px 2px 6px !important; }
        html.rumblex-active body.rx-dense .videostream { margin-bottom: 8px !important; }
        html.rumblex-active body.rx-dense .homepage-section { padding-top: 8px !important; padding-bottom: 8px !important; }
        html.rumblex-active body.rx-dense .homepage-heading { margin: 6px 0 6px !important; }
        html.rumblex-active body.rx-dense .container.content { padding-top: 8px !important; }
        html.rumblex-active body.rx-dense .media-page-comments-container { gap: 8px !important; }
        html.rumblex-active body.rx-dense .comment-item { padding: 6px 0 !important; }
        html.rumblex-active body.rx-dense .mediaList-item { margin-bottom: 6px !important; }
        html.rumblex-active body.rx-dense .video-listing-entry { margin-bottom: 6px !important; }
        html.rumblex-active body.rx-dense .video-item--title { line-height: 1.25 !important; margin-top: 4px !important; }
        html.rumblex-active body.rx-dense rum-video-thumbnail[role="listitem"] { margin-bottom: 6px !important; }
        html.rumblex-active body.rx-dense rum-video-thumbnail rum-text[role="heading"] { line-height: 1.25 !important; }
        html.rumblex-active body.rx-dense h1.video-header-container__title { margin: 4px 0 !important; }
    `,
    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-densemode');
        document.body?.classList.add('rx-dense');
    },
    destroy() {
        this._styleEl?.remove();
        document.body?.classList.remove('rx-dense');
    },
};

// ═══════════════════════════════════════════
//  FEATURE: Account Pagination Compaction (v2.1.0)
// ═══════════════════════════════════════════
// /account/content* pages bury the autoPg pagination strip under huge margin.
// Reddit userscript referenced in the roadmap just clamps its width; we go
// further and tighten vertical rhythm too. Scoped to account pages only.
const AccountPaginationCompact = {
    id: 'compactAccountPagination',
    name: 'Account Pagination Compact',
    _styleEl: null,
    _css: `
        html.rumblex-active .pagination.autoPg {
            max-width: 720px !important;
            margin: 8px auto !important;
            padding: 4px !important;
        }
        html.rumblex-active .pagination.autoPg a,
        html.rumblex-active .pagination.autoPg span {
            padding: 4px 8px !important;
            min-width: 28px !important;
            line-height: 1.2 !important;
        }
    `,
    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isAccount()) return;
        this._styleEl = injectStyle(this._css, 'rx-acct-pagination');
    },
    destroy() { this._styleEl?.remove(); },
};

// ═══════════════════════════════════════════
//  FEATURE: Reduced Motion (v2.1.0)
// ═══════════════════════════════════════════
// Honors the user's explicit reducedMotion setting *and* the OS-level
// prefers-reduced-motion media query. RumbleX-owned UI uses shimmer +
// stagger + spring easing by default; this kills it.
const ReducedMotion = {
    id: 'reducedMotion',
    name: 'Reduced Motion',
    _styleEl: null,
    _css: `
        html.rumblex-active body.rx-reduced-motion *,
        html.rumblex-active body.rx-reduced-motion *::before,
        html.rumblex-active body.rx-reduced-motion *::after {
            animation-duration: 0.001ms !important;
            animation-delay: 0.001ms !important;
            transition-duration: 0.001ms !important;
            transition-delay: 0ms !important;
            scroll-behavior: auto !important;
        }
        html.rumblex-active body.rx-reduced-motion .rx-shimmer { animation: none !important; }
        @media (prefers-reduced-motion: reduce) {
            html.rumblex-active *,
            html.rumblex-active *::before,
            html.rumblex-active *::after {
                animation-duration: 0.001ms !important;
                transition-duration: 0.001ms !important;
            }
        }
    `,
    init() {
        if (!Settings.get(this.id)) return;
        this._styleEl = injectStyle(this._css, 'rx-reduced-motion');
        document.body?.classList.add('rx-reduced-motion');
    },
    destroy() {
        this._styleEl?.remove();
        document.body?.classList.remove('rx-reduced-motion');
    },
};

// ═══════════════════════════════════════════
//  FEATURE: Home Cleanup Presets (v2.1.0)
// ═══════════════════════════════════════════
// Settings.get('homeCleanupPreset') is an enum:
//   'none'     — no extra rules
//   'focused'  — hide editor picks, recommendations, premium row, featured banner
//   'minimal'  — focused + hide every category row except subscribed/live (keeps the spine)
//   'custom'   — falls back to user's existing hide-X toggles (no-op here)
// Designed to *layer* on top of the individual hide-X toggles, not replace
// them. The CSS uses the existing `#section-*` ID scheme already proven in
// CategoryFilter, so any new sections Rumble adds are governed by the same
// selector contract.
const HomeCleanupPreset = {
    id: 'homeCleanupPreset',
    name: 'Home Cleanup Preset',
    _styleEl: null,
    _focused: [
        '#section-editor-picks',
        '#section-personal-recommendations',
        '#section-premium-videos',
        '#hero-section',
        '.homepage-hero',
        '#section-featured',
    ],
    _minimal: [
        '#section-editor-picks',
        '#section-personal-recommendations',
        '#section-premium-videos',
        '#hero-section',
        '.homepage-hero',
        '#section-featured',
        '#section-gaming',
        '#section-finance',
        '#section-sports',
        '#section-viral',
        '#section-podcasts',
        '#section-leaderboard',
        '#section-vlogs',
        '#section-news',
        '#section-science',
        '#section-music',
        '#section-entertainment',
        '#section-cooking',
        '#section-shorts',
    ],
    init() {
        const preset = Settings.get('homeCleanupPreset') || 'none';
        if (preset === 'none' || preset === 'custom') return;
        if (!Page.isHome()) return;
        const list = preset === 'minimal' ? this._minimal : this._focused;
        const css = list.join(',\n') + ' { display: none !important; }';
        this._styleEl = injectStyle(css, 'rx-home-cleanup-preset');
    },
    destroy() { this._styleEl?.remove(); },
};

// ═══════════════════════════════════════════
//  MODULE: Media Probe Cache (v2.2.0)
// ═══════════════════════════════════════════
// Persistent TTL-keyed cache for media probe results (embedJS responses,
// HLS manifest variants, CDN HEAD probes). Other download modules can call
// MediaProbeCache.get(key) before hitting the network and MediaProbeCache.set(key, val)
// after a successful probe. Honors Settings.get('downloadProbeCacheTtlHours'):
// 0 disables cache, otherwise entries expire at `at + ttlHours * 3600000`.
//
// Storage: a single chrome.storage.local key holds the full cache; on
// chrome.runtime.lastError or quota errors we fall back to in-memory only
// so the cache never blocks downloads. Cache is GC'd lazily on read.
const MediaProbeCache = {
    _KEY: 'rx_probe_cache',
    _mem: null,       // { [key]: { at: number, val: any } }
    _ready: false,
    async _load() {
        if (this._ready) return;
        try {
            const data = await RXPlatform.storage.get(this._KEY);
            this._mem = (data && data[this._KEY]) || {};
        } catch {
            this._mem = {};
        }
        this._ready = true;
    },
    _ttlMs() {
        const hrs = Number(Settings.get('downloadProbeCacheTtlHours'));
        if (!Number.isFinite(hrs) || hrs <= 0) return 0;
        return hrs * 3600 * 1000;
    },
    async get(key) {
        if (!key) return null;
        await this._load();
        const entry = this._mem[key];
        if (!entry) return null;
        const ttl = this._ttlMs();
        if (ttl === 0) return null; // cache disabled — every read misses
        if (Date.now() - entry.at > ttl) {
            // Expired: GC inline so the cache doesn't grow unbounded.
            delete this._mem[key];
            this._scheduleFlush();
            return null;
        }
        return entry.val;
    },
    async set(key, val) {
        if (!key) return;
        if (this._ttlMs() === 0) return; // don't persist if cache is disabled
        await this._load();
        this._mem[key] = { at: Date.now(), val };
        this._scheduleFlush();
    },
    async clear() {
        this._mem = {};
        try { await RXPlatform.storage.remove(this._KEY); } catch {}
    },
    _flushTimer: null,
    _scheduleFlush() {
        clearTimeout(this._flushTimer);
        this._flushTimer = setTimeout(() => {
            try { RXPlatform.storage.set({ [this._KEY]: this._mem }); } catch {}
        }, 250);
    },
};

// ═══════════════════════════════════════════
//  FEATURE: External Player Handoff (v2.2.0)
// ═══════════════════════════════════════════
// Adds an "Open in external player" button on watch pages when
// externalPlayerEnabled is true. The button substitutes the current page
// URL into externalPlayerTemplate ({url} placeholder) and navigates to
// the resulting URI. Common templates:
//   mpv://{url}                  — MPV with mpv-handler / play-with-mpv
//   potplayer://{url}            — PotPlayer custom protocol
//   vlc://{url}                  — VLC custom protocol
//   https://mpvhandler.com/?u={url} — Play-With-MPV fallback
//
// The button mounts next to the media engage/share row. It is intentionally
// silent on click — no toast spam — but a status message appears if the
// browser blocks the navigation (most browsers prompt the user to allow
// the custom-protocol handler on first use).
const ExternalPlayer = {
    id: 'externalPlayerEnabled',
    name: 'External Player Handoff',
    _btn: null,
    _styleEl: null,
    _css: `
        html.rumblex-active button.rx-extplayer {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 6px 10px; margin-left: 6px;
            background: var(--rx-surface0, #1e2a14);
            color: var(--rx-text, #d6e8c4);
            border: 1px solid var(--rx-surface1, #2a3a1e);
            border-radius: 6px; cursor: pointer;
            font: 600 12px/1 system-ui, sans-serif;
            transition: background 120ms ease;
        }
        html.rumblex-active button.rx-extplayer:hover {
            background: var(--rx-surface1, #2a3a1e);
        }
        html.rumblex-active button.rx-extplayer svg {
            width: 14px; height: 14px; fill: currentColor;
        }
    `,
    _resolveTemplate() {
        const raw = (Settings.get('externalPlayerTemplate') || '').trim();
        // Sensible default if user hasn't configured one: mpv-handler URI.
        // Documented in the settings so users know they can change it.
        return raw || 'mpv://{url}';
    },
    _build() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rx-extplayer';
        btn.title = 'Open in external player (configured in RumbleX settings)';
        // SVG: a small "external" arrow icon
        btn.innerHTML = ''; // we DOM-build to avoid innerHTML for safety
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 16 16');
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M10 1h5v5h-2V4.41L7.41 10 6 8.59 11.59 3H10V1zM3 4h3v2H4v6h6V10h2v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h-1z');
        svg.appendChild(path);
        const label = document.createElement('span');
        label.textContent = 'Open in player';
        btn.appendChild(svg);
        btn.appendChild(label);
        btn.addEventListener('click', (e) => this._handleClick(e));
        return btn;
    },
    _handleClick(e) {
        e?.preventDefault?.();
        const tpl = this._resolveTemplate();
        const url = location.href;
        const target = tpl.includes('{url}') ? tpl.replace('{url}', encodeURIComponent(url)) : tpl + url;
        try {
            // Use an iframe to trigger the protocol handler without navigating
            // the parent page if Chrome rejects the URL. Most browsers will
            // pop the "allow handler?" dialog on first use. If the protocol
            // is HTTPS (web fallback), window.open works better.
            if (/^https?:/i.test(target)) {
                window.open(target, '_blank', 'noopener');
            } else {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = target;
                document.body.appendChild(iframe);
                setTimeout(() => iframe.remove(), 1500);
            }
        } catch (err) {
            console.warn('[RumbleX] external player launch failed:', err);
        }
    },
    _mountTarget() {
        // Prefer the share/engage row so the new button sits with siblings.
        // Selectors.find() routes through the v2.0 registry.
        return Selectors.findVisible('watch.share')
            || qs('.media-by-actions')
            || qs('.media-page-buttons-actions')
            || qs('.media-by');
    },
    _tryMount() {
        if (this._btn?.isConnected) return;
        const host = this._mountTarget();
        if (!host) return;
        if (!this._btn) this._btn = this._build();
        host.parentNode?.insertBefore(this._btn, host.nextSibling);
    },
    init() {
        if (!Settings.get(this.id)) return;
        if (!Page.isWatch()) return;
        this._styleEl = injectStyle(this._css, 'rx-extplayer-css');
        // The watch-page buttons render after the initial HTML parse; poll
        // through Selectors.wait so we don't race htmx swaps. Re-mount on
        // route changes (htmx navigates between watch pages without reload).
        waitForSelectorFeature(this, 'watch.share', { timeout: 15000 }).then(() => this._tryMount()).catch(() => {});
        this._routerUnsub = Router.onChange((d) => {
            if (d.changed && Page.isWatch()) {
                // Detach old button so we re-anchor next to the new share button.
                this._btn?.remove();
                this._btn = null;
                waitForSelectorFeature(this, 'watch.share', { timeout: 10000 }).then(() => this._tryMount()).catch(() => {});
            }
        });
    },
    destroy() {
        this._btn?.remove();
        this._btn = null;
        this._styleEl?.remove();
        this._styleEl = null;
        if (typeof this._routerUnsub === 'function') {
            try { this._routerUnsub(); } catch {}
            this._routerUnsub = null;
        }
    },
};

// ═══════════════════════════════════════════
//  FEATURE: Strip Tracking Params (v2.4.0)
// ═══════════════════════════════════════════
// Removes Rumble's referral/tracking query params from the current URL and
// from outbound links, when stripTrackingParams is on. Whitelisted-strip
// model: only known tracking params are removed; navigation-critical params
// (?start=, ?t=, &p=) are preserved.
//
// Strategy:
//   1. On boot, scrub the current location via history.replaceState so the
//      address bar matches the canonical share URL.
//   2. On click of any <a href>, rewrite to canonical before the browser
//      follows. Capture-phase so we beat Rumble's own handlers.
const StripTrackingParams = {
    id: 'stripTrackingParams',
    name: 'Strip Tracking Params',
    _handler: null,
    _routerUnsub: null,
    // Conservative removal list. Adding to this is one-edit-per-param; keep
    // canonical params (start, t, v, q, page) out of it.
    _strip: new Set([
        'e9s', 'ref', 'referrer', 'src',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'campaign', 'mtm_source', 'mtm_medium', 'mtm_campaign',
        'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid', '_ga', 'yclid',
    ]),
    _clean(href) {
        let url;
        try { url = new URL(href, location.href); } catch { return href; }
        if (!/(^|\.)rumble\.com$/i.test(url.hostname)) return href;
        let changed = false;
        for (const key of [...url.searchParams.keys()]) {
            if (this._strip.has(key.toLowerCase())) { url.searchParams.delete(key); changed = true; }
        }
        return changed ? url.toString() : href;
    },
    _scrubLocation() {
        const cleaned = this._clean(location.href);
        if (cleaned !== location.href) {
            try { history.replaceState(history.state, '', cleaned); } catch {}
        }
    },
    init() {
        if (!Settings.get(this.id)) return;
        this._scrubLocation();
        this._handler = (e) => {
            const a = e.target?.closest?.('a[href]');
            if (!a) return;
            const cleaned = this._clean(a.href);
            if (cleaned !== a.href) {
                // Rewrite href in place; the browser navigates to the cleaned
                // URL when it follows the link. Don't preventDefault so other
                // handlers (e.g. middle-click open) still work.
                a.href = cleaned;
            }
        };
        document.addEventListener('click', this._handler, { capture: true });
        // Re-scrub on each htmx route change in case Rumble appends new
        // tracking params during in-app navigation.
        this._routerUnsub = Router.onChange((d) => {
            if (d.changed) this._scrubLocation();
        });
    },
    destroy() {
        if (this._handler) document.removeEventListener('click', this._handler, { capture: true });
        this._handler = null;
        if (typeof this._routerUnsub === 'function') {
            try { this._routerUnsub(); } catch {}
            this._routerUnsub = null;
        }
    },
};

// ═══════════════════════════════════════════
//  FEATURE: Rant Tier Filter (v2.3.0)
// ═══════════════════════════════════════════
// When rantTierFilter > 0, hides chat rants below the configured tier value.
// Tiers map to .chat-history--rant[data-level="1..10"] per Rumble's chat
// renderer. The filter applies CSS, not DOM removal — so when the user
// raises/lowers the threshold the previously hidden rants reappear without
// needing the stream to redeliver them.
const RantTierFilter = {
    id: 'rantTierFilter',          // value treated as truthy if > 0
    name: 'Rant Tier Filter',
    _styleEl: null,
    _buildCss(threshold) {
        if (!Number.isFinite(threshold) || threshold <= 0) return '';
        const rules = [];
        for (let i = 1; i < Math.min(threshold, 11); i++) {
            rules.push(`html.rumblex-active .chat-history--rant[data-level="${i}"]`);
        }
        if (!rules.length) return '';
        return rules.join(',\n') + ' { display: none !important; }';
    },
    init() {
        const threshold = Number(Settings.get(this.id)) || 0;
        const css = this._buildCss(threshold);
        if (css) this._styleEl = injectStyle(css, 'rx-rant-tier-filter');
    },
    destroy() { this._styleEl?.remove(); this._styleEl = null; },
};

// ═══════════════════════════════════════════
//  FEATURE: Chat Username Colors (v2.3.0)
// ═══════════════════════════════════════════
// Deterministic per-username color tinting in live chat. Helps users scan
// fast-moving chat for specific posters. Honors Settings.get('chatUsernameColors'):
//   off            — no color change (default for users who don't want it)
//   deterministic  — hash username → HSL hue, fixed saturation/lightness
//   tiered         — color by rant tier (data-level) when present, else hash
const ChatUsernameColors = {
    id: 'chatUsernameColors',  // enum, but truthy iff != 'off'
    name: 'Chat Username Colors',
    _obs: null,
    _styleEl: null,
    _mode: 'off',
    _styleId: 'rx-chat-username-colors',
    _hash(name) {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
        return Math.abs(h);
    },
    _hueFor(name) {
        return this._hash(name.toLowerCase()) % 360;
    },
    _applyToNode(usernameEl) {
        if (!usernameEl || usernameEl.dataset.rxColored) return;
        const name = usernameEl.textContent?.trim();
        if (!name) return;
        let color;
        if (this._mode === 'tiered') {
            const rant = usernameEl.closest('.chat-history--rant[data-level]');
            if (rant?.dataset?.level) {
                const t = Math.min(10, Math.max(1, Number(rant.dataset.level)));
                // Tier ramp: cooler at low tiers, warmer at high tiers.
                const hue = 200 - (t - 1) * 20;
                color = `hsl(${hue}, 70%, 65%)`;
            }
        }
        if (!color) {
            const hue = this._hueFor(name);
            color = `hsl(${hue}, 65%, 65%)`;
        }
        usernameEl.style.setProperty('color', color, 'important');
        usernameEl.dataset.rxColored = '1';
    },
    _scan(root) {
        const scope = root || document;
        for (const el of scope.querySelectorAll(
            '.chat-history--username, .chat-history--rant-username, .js-chat-username'
        )) {
            this._applyToNode(el);
        }
    },
    init() {
        const mode = (Settings.get(this.id) || 'off').toLowerCase();
        if (mode === 'off') return;
        this._mode = mode;
        this._scan(document);
        const chatRoot = qs('#chat-history-list') || document.body;
        this._obs = new MutationObserver((records) => {
            for (const r of records) {
                for (const node of r.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    this._scan(node);
                }
            }
        });
        this._obs.observe(chatRoot, { childList: true, subtree: true });
    },
    destroy() {
        this._obs?.disconnect();
        this._obs = null;
        // Roll back inline color overrides — important so themes restore on disable.
        for (const el of qsa('[data-rx-colored="1"]')) {
            el.style.removeProperty('color');
            delete el.dataset.rxColored;
        }
    },
};

// ═══════════════════════════════════════════
//  HELPER: RxErrorLog (v3.20.0)
// ═══════════════════════════════════════════
// Local-only per-feature error ring buffer. Mirrors the v3.0 selector telemetry
// pattern: rolling window of last 200 entries, gated by a debug setting, no
// remote shipping ever. Surfaced via the `getErrorLog` message API on the
// options page for export.
const RxErrorLog = {
    MAX: 200,
    _buf: [],

    record(featureId, error, context) {
        // Record unconditionally. `debugErrorLog` gates *surfacing* the ring
        // (see drain()), not filling it — gating capture meant the shipped
        // default configuration collected nothing, so the selector-telemetry
        // export the issue template asks bug reporters for was always empty
        // unless they had already reproduced the bug once with the flag on.
        // Still local-only, still capped at MAX, still never uploaded.
        if (!Settings._ready) return;
        const entry = {
            at: Date.now(),
            featureId: String(featureId || 'unknown').slice(0, 80),
            message: String(error?.message || error || '').slice(0, 500),
            stack: String(error?.stack || '').split('\n').slice(0, 8).join('\n'),
            context: context ? String(context).slice(0, 200) : null,
            page: location.pathname,
        };
        this._buf.push(entry);
        if (this._buf.length > this.MAX) this._buf.splice(0, this._buf.length - this.MAX);
    },

    drain() {
        // Capture is unconditional; revealing the ring is the part the user
        // opts into, so the privacy disclosure stays accurate either way.
        if (!Settings.get('debugErrorLog')) return [];
        const snapshot = this._buf.slice();
        return snapshot;
    },

    clear() {
        this._buf.length = 0;
    },
};

// Local-only downloader failure bundle client. The service worker owns the
// persisted, sanitized ring; this helper records content/worker context and
// mounts copy/export affordances directly beside failed download and clip UI.
const RxDownloadDiagnostics = {
    _styleEl: null,

    _t(key, fallback) {
        try { return RXPlatform.t(key) || fallback; } catch { return fallback; }
    },

    _message(action, data = {}) {
        return RXPlatform.sendMessage({ action, ...data })
            .then((response) => response || { ok: false, reason: 'no-response' });
    },

    record(diagnostic) {
        const payload = {
            ...(diagnostic || {}),
            pageUrl: location.href,
            capabilities: {
                ...(diagnostic?.capabilities || {}),
                contentWorker: typeof Worker === 'function',
                moduleWorker: typeof Worker === 'function' && typeof Blob === 'function'
                    && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function',
                webCodecs: typeof VideoDecoder === 'function',
                online: navigator.onLine !== false,
            },
        };
        return this._message('recordDownloadDiagnostic', { diagnostic: payload });
    },

    async getBundle() {
        const response = await this._message('getDownloadDiagnostics');
        if (!response?.ok || !response.bundle) {
            throw new Error(response?.reason || 'Download diagnostics are unavailable');
        }
        return response.bundle;
    },

    async _copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {}
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand('copy');
            textarea.remove();
            return copied;
        } catch {
            return false;
        }
    },

    _download(bundle) {
        const blob = new Blob([JSON.stringify(bundle, null, 2) + '\n'], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `rumblex-download-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    _ensureStyle() {
        if (this._styleEl?.isConnected) return;
        this._styleEl = injectStyle(`
            .rx-diagnostic-actions {
                display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
                margin-top: 10px; padding-top: 10px;
                border-top: 1px solid rgba(255,255,255,0.08);
            }
            .rx-diagnostic-action {
                border: 1px solid rgba(137,180,250,0.28); border-radius: 6px;
                background: rgba(49,50,68,0.55); color: #cdd6f4;
                padding: 6px 9px; font: 600 11px/1 system-ui, sans-serif; cursor: pointer;
            }
            .rx-diagnostic-action:hover { background: rgba(49,50,68,0.85); border-color: rgba(137,180,250,0.5); }
            .rx-diagnostic-action:focus-visible { outline: 2px solid #89b4fa; outline-offset: 2px; }
            .rx-diagnostic-action:disabled { opacity: 0.55; cursor: wait; }
            .rx-diagnostic-status { flex-basis: 100%; color: #a6adc8; font: 11px/1.4 system-ui, sans-serif; }
        `, 'rx-download-diagnostics-css');
    },

    mountActions(host) {
        if (!host || !host.isConnected) return;
        this._ensureStyle();
        host.querySelector('.rx-diagnostic-actions')?.remove();

        const row = document.createElement('div');
        row.className = 'rx-diagnostic-actions';
        const status = document.createElement('span');
        status.className = 'rx-diagnostic-status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');

        const makeButton = (label, handler) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'rx-diagnostic-action';
            button.textContent = label;
            button.addEventListener('click', async () => {
                for (const peer of row.querySelectorAll('button')) peer.disabled = true;
                status.textContent = this._t('preparingDownloadDiagnostics', 'Preparing sanitized diagnostics…');
                try {
                    await handler();
                } catch (error) {
                    status.textContent = this._t('downloadDiagnosticsUnavailable', 'Diagnostics unavailable:') + ' ' + (error?.message || error);
                } finally {
                    for (const peer of row.querySelectorAll('button')) peer.disabled = false;
                }
            });
            return button;
        };

        const copyButton = makeButton(this._t('copyDownloadDiagnostics', 'Copy diagnostics'), async () => {
            const bundle = await this.getBundle();
            const copied = await this._copy(JSON.stringify(bundle, null, 2));
            if (!copied) throw new Error('Clipboard write failed');
            status.textContent = this._t('downloadDiagnosticsCopied', 'Sanitized diagnostics copied.');
        });
        const exportButton = makeButton(this._t('exportDownloadDiagnostics', 'Export diagnostics'), async () => {
            const bundle = await this.getBundle();
            this._download(bundle);
            status.textContent = this._t('downloadDiagnosticsExported', 'Sanitized diagnostics exported.');
        });

        row.append(copyButton, exportButton, status);
        host.appendChild(row);
    },
};

// ═══════════════════════════════════════════
//  FEATURE REGISTRY & INIT
// ═══════════════════════════════════════════
const features = [
    AdNuker, FeedCleanup, HidePremium, CategoryFilter, DarkEnhance, TheaterSplit,
    VideoDownloader, LogoToFeed, SpeedController, ScrollVolume, AutoMaxQuality,
    WatchProgress, ChannelBlocker, KeyboardNav, AutoTheater, LiveChatEnhance,
    VideoTimestamps, ScreenshotBtn, WatchHistoryFeature, AutoplayBlock,
    SearchHistory, MiniPlayer, VideoStats, LoopControl, QuickBookmark, CommentNav,
    RantHighlight, RelatedFilter, ExactCounts, ShareTimestamp, ShortsFilter,
    ChatAutoScroll, AutoExpand, NotifEnhance, PlaylistQuickSave,
    // v1.8.0 additions
    FullTitles, TitleFont, UniqueChatters, ChatUserBlock, ChatSpamDedup,
    ChatExport, RantPersist, CommentSort, CommentExport, PopoutChat, KeywordFilter,
    AutoplayScheduler, Chapters, SponsorBlockRX, VideoClips, LiveDVR,
    SubtitleSidecar, Transcripts, AudioOnly, BatchDownload,
    // v1.9.0 — Rumble Enhancement Suite port
    AutoHideHeader, AutoHideNavSidebar, AutoLike, AutoLoadComments,
    FullWidthPlayer, AdaptiveLiveLayout, CommentBlocking, SiteTheme,
    // v2.1.0 — Premium UI and Layout Superset
    ThumbnailHider, DenseMode, AccountPaginationCompact, ReducedMotion, HomeCleanupPreset,
    // v2.2.0 — Download Manager 2.0 (visible surfaces; cache module is global)
    ExternalPlayer,
    // v2.3.0 — Live Chat, Rants, and Multi-Stream
    RantTierFilter, ChatUsernameColors,
    // v2.4.0 — Feed, Discovery, and Moderation
    StripTrackingParams,
    // v3.1.0 — Platform follow-through (Rumble Shorts launched Feb 2026)
    ShortsRedirect,
    // v3.12.0 — v2.5 Creator/account tools unlocked by 2026-05-19 MHTML batch
    BulkUnsubscribe,
    // v3.19.0 — Channel Archive Phase 2 — in-page "Archive channel" button
    ChannelArchiveButton,
    ...RX_CSS_FEATURES,
];

for (const feature of features) {
    if (!feature || feature._rxLifecycleWrapped) continue;
    const init = feature.init;
    const destroy = feature.destroy;
    feature.init = function (...args) {
        cancelFeatureWaits(this);
        cancelFeatureTimeouts(this);
        cancelFeatureFrames(this);
        this._rxLifecycleGeneration = (this._rxLifecycleGeneration || 0) + 1;
        return init.apply(this, args);
    };
    feature.destroy = function (...args) {
        this._rxLifecycleGeneration = (this._rxLifecycleGeneration || 0) + 1;
        cancelFeatureWaits(this);
        cancelFeatureTimeouts(this);
        cancelFeatureFrames(this);
        return destroy.apply(this, args);
    };
    Object.defineProperty(feature, '_rxLifecycleWrapped', { value: true });
}

async function boot() {
    try {
        await Settings.init();
    } catch (e) {
        console.error('[RumbleX] Settings.init failed:', e);
        try { RxErrorLog?.record('Settings', e, 'init'); } catch {}
    }
    syncAntiFoucStyle();
    try {
        await rxApplyPendingLocalDataOperation();
    } catch (e) {
        console.warn('[RumbleX] pending local-data restore failed:', e);
        try { RxErrorLog?.record('LocalDataRestore', e, 'boot'); } catch {}
    }
    // Wire route lifecycle once. Features that subscribe via Router.onChange
    // will receive route-transition events for htmx swaps + history nav.
    try {
        Router.init();
    } catch (e) {
        console.warn('[RumbleX] Router init failed:', e);
        try { RxErrorLog?.record('Router', e, 'init'); } catch {}
    }

    onReady(() => {
        for (const feat of features) {
            try {
                feat.init();
            } catch (e) {
                console.error(`[RumbleX] ${feat.id || feat.name} init failed:`, e);
                RxErrorLog.record(feat.id || feat.name, e, 'init');
            }
        }
        try {
            SettingsPanel.init();
        } catch (e) {
            console.error('[RumbleX] Settings panel init failed:', e);
            RxErrorLog.record('SettingsPanel', e, 'init');
        }
        try {
            Selectors.startHealthMonitor();
        } catch (e) {
            console.warn('[RumbleX] Selector health monitor failed:', e);
            RxErrorLog.record('SelectorHealth', e, 'init');
        }

        // Surface cross-tab / options-page saves. We don't silently hot-reload
        // features here because most of them stash state in their init path;
        // the user-visible toast prompts a reload so the new config actually
        // takes effect. (Hot-reload still works from the in-page modal via
        // the Switch change-handler, which destroys + re-inits per feature.)
        Settings.onExternalChange((isReset) => {
            try {
                RxToast.show(isReset
                    ? 'RumbleX was reset — reload to see defaults'
                    : 'Settings changed elsewhere — reload to apply');
            } catch {}
        });

        console.log(`[RumbleX] v${VERSION} loaded - ${features.filter(f => Settings.get(f.id)).map(f => f.name).join(', ')}`);
    });
}

boot();

// The per-feature localStorage keys we write on Rumble's origin. Kept in one
// place so the options-page "Reset All Data" action can actually wipe them —
// the options page lives in the extension origin and cannot touch Rumble's
// localStorage directly. On reset it messages the active tab to self-clear.
const RX_LOCAL_STORAGE_KEYS = [
    'rx_volume',
    'rx_watch_progress',
    'rx_watch_history',
    'rx_search_history',
    'rx_bookmarks',
];
// Plus any key starting with these prefixes (per-video caches).
const RX_LOCAL_STORAGE_PREFIXES = ['rx_rants_'];

function rxClearLocalStorage() {
    let cleared = 0;
    try {
        for (const k of RX_LOCAL_STORAGE_KEYS) {
            if (localStorage.getItem(k) !== null) { localStorage.removeItem(k); cleared++; }
        }
        // Collect prefix-matched keys first (removing while iterating shifts
        // indices) then delete.
        const toDrop = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && RX_LOCAL_STORAGE_PREFIXES.some((p) => k.startsWith(p))) toDrop.push(k);
        }
        for (const k of toDrop) { localStorage.removeItem(k); cleared++; }
    } catch (e) {
        console.warn('[RumbleX] localStorage clear failed:', e);
    }
    return cleared;
}

// Read every RumbleX-owned localStorage key on this origin into a plain
// object. Used by the options page to include per-site data (bookmarks,
// watch progress, rant archives…) in Export Backup so a reset/restore
// cycle actually round-trips the user's full state.
function rxReadLocalStorage() {
    const out = {};
    try {
        for (const k of RX_LOCAL_STORAGE_KEYS) {
            const v = localStorage.getItem(k);
            if (v !== null) out[k] = v;
        }
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (RX_LOCAL_STORAGE_PREFIXES.some((p) => k.startsWith(p))) {
                out[k] = localStorage.getItem(k);
            }
        }
    } catch (e) {
        console.warn('[RumbleX] localStorage read failed:', e);
    }
    return out;
}

// Restore values written by rxReadLocalStorage. Only accepts string values
// and keys that match our known list or prefixes, so an imported file can't
// smuggle unrelated keys onto rumble.com's origin.
function rxWriteLocalStorage(data) {
    if (!data || typeof data !== 'object') return 0;
    let written = 0;
    const allowed = (k) => RX_LOCAL_STORAGE_KEYS.includes(k)
        || RX_LOCAL_STORAGE_PREFIXES.some((p) => k.startsWith(p));
    try {
        for (const [k, v] of Object.entries(data)) {
            if (typeof k !== 'string' || typeof v !== 'string') continue;
            if (!allowed(k)) continue;
            // chrome.storage.local has no quota on file; localStorage does
            // (5–10 MB). If we blow it, stop writing rather than throw.
            try { localStorage.setItem(k, v); written++; } catch { break; }
        }
    } catch (e) {
        console.warn('[RumbleX] localStorage write failed:', e);
    }
    return written;
}

async function rxApplyPendingLocalDataOperation() {
    const resp = await RXPlatform.sendMessage({ action: 'getPendingLocalDataOperation' });
    const op = resp?.ok && resp.operation && typeof resp.operation === 'object' ? resp.operation : null;
    if (!op?.id) return { ok: true, skipped: true };
    let cleared = 0;
    let written = 0;
    if (op.clear) cleared = rxClearLocalStorage();
    if (op.data && typeof op.data === 'object') written = rxWriteLocalStorage(op.data);
    try {
        await RXPlatform.sendMessage({
            action: 'completePendingLocalDataOperation',
            id: op.id,
            cleared,
            written,
        });
    } catch {}
    return { ok: true, cleared, written };
}

// ═══════════════════════════════════════════
//  HELPER: Privacy Report (v2.6.0)
// ═══════════════════════════════════════════
// Returns a snapshot of RumbleX's local privacy footprint so the options
// page can render the "Privacy Report" panel without recomputing client-side.
// Pure read — no side effects, no network. Every value is either a feature
// counter, a storage size, or a permission boolean from the manifest.
const RX_PRIVACY_PERMISSION_DISCLOSURES = Object.freeze({
    'storage': 'Stores RumbleX settings, backup snapshots, local queue metadata, and opt-in sync configuration in extension storage.',
    'downloads': 'Starts browser-managed downloads for user-requested video, archive, clip, subtitle, settings, and diagnostic exports.',
    'offscreen': 'Uses a Chrome MV3 offscreen extension page for DOM parsing and blob/hash work that service workers cannot perform.',
    'contextMenus': 'Adds local right-click actions for RumbleX-owned workflows.',
    'scripting': 'Contacts already-open Rumble tabs from extension pages so settings import, reset, and diagnostics can reach the content script.',
    'tabs': 'Finds open Rumble tabs for settings recovery, import/reset broadcasts, and local diagnostics.',
    'tabGroups': 'Groups extension-opened tabs for local workflow organization when supported by the browser.',
    'sidePanel': 'Lets Chromium show the RumbleX options surface in the browser side panel.',
    'alarms': 'Schedules local archive queue processing and other delayed extension maintenance work.',
    'notifications': 'Shows local browser notifications for user-triggered completion or failure states.',
    'declarativeNetRequest': 'Blocks the verified Rumble ad-delivery and ad-measurement request surface before it reaches the page in Chromium.',
    'webRequest': 'Lets Firefox inspect only the declared Rumble/ad request hosts so its MV2 background can cancel verified ad traffic.',
    'webRequestBlocking': 'Lets Firefox cancel matched ad requests before they leave the browser.',
    'GM_getValue': 'Reads RumbleX settings and local diagnostics from the userscript manager\'s private value store.',
    'GM_setValue': 'Writes RumbleX settings and local diagnostics to the userscript manager\'s private value store.',
    'GM_deleteValue': 'Deletes RumbleX-owned values when the user resets or clears local data.',
    'GM_addValueChangeListener': 'Keeps open Rumble tabs synchronized when a userscript setting changes.',
    'GM_removeValueChangeListener': 'Removes userscript value listeners during page teardown.',
    'GM_xmlhttpRequest': 'Fetches approved HTTPS Rumble and Rumble-CDN media URLs for user-requested downloads.',
    'GM_download': 'Starts user-requested downloads through the userscript manager when available.',
    'userscriptWebRequest': 'Requests early cancellation of the verified ad-host surface in compatible userscript managers; Chromium MV3 managers may not expose this capability.',
});

const RX_PRIVACY_HOST_DISCLOSURES = Object.freeze({
    '*://*.rumble.com/*': 'Runs the content script on Rumble pages and fetches Rumble watch/embed data needed for user-triggered features.',
    'https://rumble.com/*': 'Runs the userscript on the Rumble apex and accesses same-origin watch/embed data needed for user-triggered features.',
    'https://*.rumble.com/*': 'Runs the userscript on HTTPS Rumble subdomains and accesses Rumble watch/embed data needed for user-triggered features.',
    '*://*.1a-1791.com/*': 'Accesses Rumble CDN media URLs for user-requested downloads.',
    'https://1a-1791.com/*': 'Allows userscript requests to the Rumble media CDN apex for user-requested downloads.',
    'https://*.1a-1791.com/*': 'Allows userscript requests to Rumble media CDN subdomains for user-requested downloads.',
    '*://*.rumble.cloud/*': 'Accesses Rumble CDN media URLs for user-requested downloads.',
    'https://rumble.cloud/*': 'Allows userscript requests to the Rumble Cloud apex for user-requested downloads.',
    'https://*.rumble.cloud/*': 'Allows userscript requests to Rumble Cloud subdomains for user-requested downloads.',
    'https://api.github.com/*': 'Checks GitHub release metadata and supports opt-in encrypted Gist sync when configured.',
    '*://a.ads.rmbl.ws/*': 'Firefox-only access to cancel Rumble\'s dedicated ad-delivery host before requests complete.',
    '*://imasdk.googleapis.com/*': 'Firefox-only access to cancel the Google Interactive Media Ads SDK when initiated by Rumble.',
    '*://s0.2mdn.net/*': 'Firefox-only access to cancel the IMA in-stream video client when initiated by Rumble.',
    '*://pagead2.googlesyndication.com/*': 'Firefox-only access to cancel the ad measurement SDK when initiated by Rumble.',
    '*://*.doubleclick.net/*': 'Firefox-only access to cancel DoubleClick ad delivery when initiated by Rumble.',
    '*://*.googleadservices.com/*': 'Firefox-only access to cancel Google ad delivery when initiated by Rumble.',
});

const RX_PRIVACY_WEB_RESOURCE_DISCLOSURES = Object.freeze({
    'lib/mux.min.js': 'Extension-bundled mux.js worker dependency for HLS-to-MP4 conversion; no remote code fetch.',
    'lib/mediabunny.min.mjs': 'Extension-bundled experimental Mediabunny muxer path; no remote code fetch.',
    'lib/mediabunny.LICENSE': 'Bundled Mediabunny license notice exposed for package compliance.',
    'worker.js': 'Extension-bundled Web Worker used for local video segment processing.',
    'mediabunny-worker.js': 'Extension-bundled module Worker used for local Mediabunny media conversion.',
    'offscreen.html': 'Chrome MV3 offscreen document shell used only in the extension origin.',
});

function rxManifestApiPermissions(manifest) {
    return (manifest.permissions || []).filter((permission) => !String(permission).includes('://'));
}

function rxManifestHostPermissions(manifest) {
    return manifest.host_permissions
        || (manifest.permissions || []).filter((permission) => String(permission).includes('://'))
        || [];
}

function rxManifestWebAccessibleResources(manifest) {
    const resources = manifest.web_accessible_resources || [];
    const out = [];
    for (const entry of resources) {
        if (typeof entry === 'string') {
            out.push(entry);
        } else if (entry && Array.isArray(entry.resources)) {
            out.push(...entry.resources);
        }
    }
    return Array.from(new Set(out));
}

function rxDisclosureRows(values, disclosures) {
    return Array.from(new Set(values)).map((value) => ({
        value,
        disclosure: disclosures[value] || 'Disclosure missing; update RX_PRIVACY_*_DISCLOSURES before release.',
    }));
}

function rxBuildPrivacyReport() {
    const manifest = RXPlatform.getManifest() || {};
    const settings = Settings._cache || {};
    const featureKeys = Object.keys(Settings._defaults).filter((k) =>
        typeof Settings._defaults[k] === 'boolean'
    );
    const enabled = featureKeys.filter((k) => !!settings[k]).length;
    // localStorage size — we own only the rx_* keys; sum them safely.
    let localBytes = 0;
    let localKeys = 0;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (RX_LOCAL_STORAGE_KEYS.includes(k)
                || RX_LOCAL_STORAGE_PREFIXES.some((p) => k.startsWith(p))) {
                localKeys++;
                localBytes += k.length + (localStorage.getItem(k) || '').length;
            }
        }
    } catch {}
    const permissions = rxManifestApiPermissions(manifest);
    const hostPermissions = rxManifestHostPermissions(manifest);
    const webAccessibleResources = rxManifestWebAccessibleResources(manifest);
    const permissionDisclosures = rxDisclosureRows(permissions, RX_PRIVACY_PERMISSION_DISCLOSURES);
    const hostPermissionDisclosures = rxDisclosureRows(hostPermissions, RX_PRIVACY_HOST_DISCLOSURES);
    const webAccessibleResourceDisclosures = rxDisclosureRows(webAccessibleResources, RX_PRIVACY_WEB_RESOURCE_DISCLOSURES);
    const requestShield = {
        active: !!RXPlatform.capabilities.requestBlocking,
        enforcement: RXPlatform.capabilities.requestBlockingMode || 'unknown',
        declaredRules: Number(RXPlatform.capabilities.requestBlockingRules) || 0,
        assurance: RXPlatform.capabilities.requestBlocking
            ? 'runtime-enforced'
            : 'userscript-manager-dependent',
    };
    const selectorHealth = Selectors.healthCheck();
    return {
        version: VERSION,
        manifestVersion: manifest.manifest_version || null,
        schemaVersion: settings.schemaVersion || 0,
        featureCount: featureKeys.length,
        enabledFeatures: enabled,
        permissions,
        hostPermissions,
        webAccessibleResources,
        permissionDisclosures,
        hostPermissionDisclosures,
        webAccessibleResourceDisclosures,
        requestShield,
        selectorHealth,
        externalNetworkSurfaces: [
            ...hostPermissionDisclosures.map((entry) => `${entry.value} (${entry.disclosure})`),
            // Runtime-configured destinations are invisible to the manifest, so
            // the manifest-derived rows above cannot disclose them on their own.
            ...(settings.discordWebhookUrl
                ? [`${settings.discordWebhookUrl} (User-configured Discord webhook; receives followed-channel name and URL when the notifier fires.)`]
                : []),
        ],
        telemetry: 'none — no analytics, no remote logging, no usage beacons',
        localStorage: {
            keys: localKeys,
            bytes: localBytes,
        },
        notes: [
            settings.stripTrackingParams ? 'Tracking-param stripping is ON' : 'Tracking-param stripping is OFF',
            settings.debugSelectorTelemetry ? 'Selector telemetry is being collected locally (ring buffer, no upload)' : 'Selector telemetry is disabled',
            'Error log ring buffer is captured locally on every page (200-entry rolling window, no upload)'
                + (settings.debugErrorLog ? ' and is visible on the options page' : ' and stays hidden until the Error Log Ring Buffer setting is enabled'),
            settings.remoteCosmeticRules ? 'Remote cosmetic rules enabled — signed payloads only' : 'Remote cosmetic rules disabled',
            settings.discordWebhookUrl
                ? 'Channel notifier posts to a user-configured Discord webhook — followed-channel name and URL leave the browser when a watched channel goes live or uploads'
                : 'No outbound notifier webhook is configured',
            (settings.encryptedGistSyncToken && settings.encryptedGistSyncId)
                ? 'Encrypted Gist Sync is configured — payloads are AES-GCM-256 encrypted client-side (PBKDF2-SHA256, 200k iters); passphrase is never stored'
                : 'Encrypted Gist Sync is not configured',
        ],
    };
}

// ═══════════════════════════════════════════
//  HELPER: Backup Snapshot (v2.6.0)
// ═══════════════════════════════════════════
// Pushes a copy of the current rx_settings onto a rolling stack stored at
// rx_settings_snapshots. Honors backupHistoryLimit so the snapshot list
// stays bounded. Called automatically before destructive ops (import,
// reset) by the options page once it adopts the new message action.
async function rxBackupSnapshot(reason) {
    if (!Settings.get('backupHistory')) return { ok: false, reason: 'disabled' };
    const limit = Math.max(1, Number(Settings.get('backupHistoryLimit')) || 10);
    try {
        const cur = await RXPlatform.storage.get(['rx_settings', 'rx_settings_snapshots']);
        const snapshot = {
            at: Date.now(),
            reason: typeof reason === 'string' ? reason.slice(0, 80) : 'manual',
            settings: cur.rx_settings || {},
        };
        const next = Array.isArray(cur.rx_settings_snapshots) ? cur.rx_settings_snapshots.slice() : [];
        next.push(snapshot);
        while (next.length > limit) next.shift();
        await RXPlatform.storage.set({ rx_settings_snapshots: next });
        return { ok: true, count: next.length };
    } catch (e) {
        return { ok: false, reason: 'storage', error: String(e?.message || e) };
    }
}

async function rxListSnapshots() {
    try {
        const cur = await RXPlatform.storage.get('rx_settings_snapshots');
        const list = Array.isArray(cur.rx_settings_snapshots) ? cur.rx_settings_snapshots : [];
        // Strip the actual settings blob so the list endpoint is cheap;
        // a separate restore call fetches the full snapshot by index/at.
        return list.map((s, i) => ({ index: i, at: s.at, reason: s.reason }));
    } catch { return []; }
}

async function rxRestoreSnapshot(indexOrAt) {
    try {
        const cur = await RXPlatform.storage.get('rx_settings_snapshots');
        const list = Array.isArray(cur.rx_settings_snapshots) ? cur.rx_settings_snapshots : [];
        const snap = typeof indexOrAt === 'number' && indexOrAt < list.length
            ? list[indexOrAt]
            : list.find((s) => s.at === indexOrAt);
        if (!snap) return { ok: false, reason: 'not-found' };
        // Snapshot BEFORE we overwrite, so an unwanted restore is itself undoable.
        await rxBackupSnapshot('pre-restore');
        await RXPlatform.storage.set({ rx_settings: { ...Settings._defaults, ...Settings._sanitize(snap.settings) } });
        return { ok: true, restored: { at: snap.at, reason: snap.reason } };
    } catch (e) {
        return { ok: false, reason: 'storage', error: String(e?.message || e) };
    }
}

// Listen for control messages from popup / background / options.
RXPlatform.onMessage((msg, sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.action === 'openSettingsModal') {
        document.body.classList.add('rx-panel-open');
        return;
    }
    if (msg.action === 'clearLocalData') {
        const cleared = rxClearLocalStorage();
        sendResponse({ ok: true, cleared });
        return true; // keep the channel open for async sendResponse
    }
    if (msg.action === 'getLocalData') {
        const data = rxReadLocalStorage();
        sendResponse({ ok: true, data, keys: Object.keys(data).length });
        return true;
    }
    if (msg.action === 'setLocalData') {
        const written = rxWriteLocalStorage(msg.data);
        sendResponse({ ok: true, written });
        return true;
    }
    // v2.6.0 — privacy / backup / telemetry message API
    if (msg.action === 'getPrivacyReport') {
        // The `privacyReport` switch rendered a live control while nothing read
        // it, so turning the report off left it fully visible. Gate it at the
        // only producer so every consumer gets the same answer.
        if (!Settings.get('privacyReport')) {
            sendResponse({ ok: false, reason: 'disabled' });
            return true;
        }
        sendResponse({ ok: true, report: rxBuildPrivacyReport() });
        return true;
    }
    if (msg.action === 'getSelectorTelemetry') {
        sendResponse({ ok: true, events: Selectors.drainTelemetry() });
        return true;
    }
    // v3.20.0 — Per-feature error log ring buffer.
    if (msg.action === 'getErrorLog') {
        sendResponse({ ok: true, entries: RxErrorLog.drain() });
        return true;
    }
    if (msg.action === 'clearErrorLog') {
        RxErrorLog.clear();
        sendResponse({ ok: true });
        return true;
    }
    if (msg.action === 'backupSnapshot') {
        rxBackupSnapshot(msg.reason).then(sendResponse);
        return true;
    }
    if (msg.action === 'listSnapshots') {
        rxListSnapshots().then((list) => sendResponse({ ok: true, snapshots: list }));
        return true;
    }
    if (msg.action === 'restoreSnapshot') {
        rxRestoreSnapshot(msg.indexOrAt).then(sendResponse);
        return true;
    }
    // v3.14.0 — Background-initiated in-page toast. Lets the SW surface
    // result/status text (e.g. "Blocked channel X" after a context-menu
    // click) without opening a popup or browser-notification — keeps the
    // confirmation on the same page the user is interacting with.
    if (msg.action === 'rxShowToast') {
        try {
            RxToast.show(String(msg.text || ''));
            sendResponse({ ok: true });
        } catch (e) { sendResponse({ ok: false, reason: String(e?.message || e) }); }
        return true;
    }
    // v3.5.0 — chrome.contextMenus probe. Background SW asks the active
    // tab for its current video state (URL + playback time + clean URL)
    // so the right-click action "Copy URL at timestamp" can build a
    // shareable link without redoing tracking-param strip on the SW side.
    if (msg.action === 'getVideoStateAtTime') {
        try {
            const video = getActiveMedia(qs('#rx-split-left') || qs('#videoPlayer') || document);
            const t = video && Number.isFinite(video.currentTime) ? Math.floor(video.currentTime) : null;
            // Clean URL: reuse the same allowlist-strip set as StripTrackingParams.
            let cleanUrl = location.href;
            try {
                const u = new URL(location.href);
                if (/(^|\.)rumble\.com$/i.test(u.hostname)) {
                    const strip = new Set([
                        'e9s', 'ref', 'referrer', 'src',
                        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                        'campaign', 'mtm_source', 'mtm_medium', 'mtm_campaign',
                        'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid', '_ga', 'yclid',
                    ]);
                    for (const k of [...u.searchParams.keys()]) {
                        if (strip.has(k.toLowerCase())) u.searchParams.delete(k);
                    }
                    cleanUrl = u.toString();
                }
            } catch {}
            sendResponse({ ok: true, cleanUrl, currentTime: t, isWatch: Page.isWatch() });
        } catch (e) {
            sendResponse({ ok: false, reason: String(e?.message || e) });
        }
        return true;
    }
});
