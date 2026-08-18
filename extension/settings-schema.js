// RumbleX shared settings schema. This file is the canonical source for
// defaults and trust-boundary normalization across content, options, popup,
// background profile/Gist restores, and the generated userscript.
'use strict';

(() => {
    if (globalThis.RumbleXSettingsSchema) return;

    const SCHEMA_VERSION = 2;
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
        bookmarks: [],
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
        settingsProfiles: [],
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
        }),
        configurable: false,
        enumerable: false,
        writable: false,
    });
})();
