#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(ROOT, 'extension', 'content.js'), 'utf8');
const schemaSource = fs.readFileSync(path.join(ROOT, 'extension', 'settings-schema.js'), 'utf8');

const schemaContext = vm.createContext({ URL });
vm.runInContext(schemaSource, schemaContext, { filename: 'settings-schema.js' });
const defaults = schemaContext.RumbleXSettingsSchema.DEFAULTS;

function objectBlock(symbol) {
    const match = core.match(new RegExp(`^const ${symbol} = \\{([\\s\\S]*?)^\\};`, 'm'));
    assert.ok(match, `feature object is missing: ${symbol}`);
    return match[0];
}

function property(block, key) {
    return block.match(new RegExp(`^\\s*${key}:\\s*'([^']+)'`, 'm'))?.[1] || '';
}

const registryBody = core.match(/const features = \[([\s\S]*?)\n\];/)?.[1] || '';
assert.ok(registryBody, 'feature registry is missing');
const registryWithoutComments = registryBody.replace(/\/\/.*$/gm, '');
const symbols = [...registryWithoutComments.matchAll(/\b[A-Z][A-Za-z0-9]+\b/g)]
    .map((match) => match[0])
    .filter((symbol) => symbol !== 'RX_CSS_FEATURES');
const uniqueSymbols = [...new Set(symbols)];
assert.deepEqual(symbols, uniqueSymbols, 'handwritten registry contains duplicate symbols');

const handwritten = uniqueSymbols.map((symbol) => {
    const block = objectBlock(symbol);
    const id = property(block, 'id');
    assert.ok(id, `${symbol} has no stable feature id`);
    assert.match(block, /^\s*init\s*\(/m, `${symbol} has no init lifecycle`);
    assert.match(block, /^\s*destroy\s*\(/m, `${symbol} has no destroy lifecycle`);
    return { symbol, id };
});

const cssBody = core.match(/const RX_CSS_TOGGLES = \[([\s\S]*?)\n\];/)?.[1] || '';
assert.ok(cssBody, 'CSS feature registry is missing');
const cssIds = [...cssBody.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);

assert.equal(handwritten.length, 75, 'handwritten feature count changed; update behavior coverage intentionally');
assert.equal(cssIds.length, 51, 'CSS feature count changed; update behavior coverage intentionally');
assert.equal(handwritten.length + cssIds.length, 126, 'total feature catalog changed unexpectedly');

const allIds = [...handwritten.map(({ id }) => id), ...cssIds];
assert.equal(new Set(allIds).size, allIds.length, 'feature ids must be unique across both registries');

for (const id of cssIds) {
    assert.ok(Object.hasOwn(defaults, id), `CSS feature has no canonical setting: ${id}`);
    assert.equal(typeof defaults[id], 'boolean', `CSS feature setting is not boolean: ${id}`);
}

// CategoryFilter is driven by the hiddenCategories array rather than its own
// switch. Every other handwritten module must have a canonical setting key.
for (const { symbol, id } of handwritten) {
    if (symbol === 'CategoryFilter') {
        assert.equal(id, 'categoryFilter');
        assert.ok(Object.hasOwn(defaults, 'hiddenCategories'));
        continue;
    }
    assert.ok(Object.hasOwn(defaults, id), `${symbol} has no canonical setting: ${id}`);
}

// ── In-page settings modal catalog parity ───────────────────────────────────
// RX_CATEGORIES is a second, hand-maintained label/description table driving the
// injected settings modal. It covered 127 of 210 canonical keys with nothing
// asserting the relationship, so a key could be added to the schema and the
// options page and silently never appear in the in-page modal.
//
// Every canonical key must therefore be either present in RX_CATEGORIES or
// listed below with a reason. The check runs both ways: a stale exclusion (a
// key that no longer exists, or that has since been added to the modal) also
// fails, so this list cannot rot.
const MODAL_EXCLUSIONS = {
    // Internal bookkeeping — never user-facing controls.
    schemaVersion: 'internal', activeProfileId: 'internal',

    // Rendered by dedicated modal controls rather than catalog switches
    // (theme picker, speed slider, category and block-list editors).
    theme: 'dedicated-control', siteTheme: 'dedicated-control',
    playbackSpeed: 'dedicated-control', splitRatio: 'dedicated-control',
    hiddenCategories: 'dedicated-control', blockedChannels: 'dedicated-control',
    blockedKeywords: 'dedicated-control', blockedChatters: 'dedicated-control',
    blockedCommenters: 'dedicated-control',

    // Stored user data, not settings: collections and per-video state.
    sponsorSegments: 'stored-data',
    autoplayQueue: 'stored-data', watchedChannels: 'stored-data',
    blockedChannelsMeta: 'stored-data',

    // Free-text or numeric values. The modal renders switches; these belong to
    // the full options editor.
    externalPlayerTemplate: 'value-input', batchDownloadFolderName: 'value-input',
    channelArchiveSubfolder: 'value-input', discordWebhookUrl: 'value-input',
    encryptedGistSyncToken: 'value-input', encryptedGistSyncId: 'value-input',
    backupHistoryLimit: 'value-input', channelNotifierIntervalMin: 'value-input',
    downloadConcurrency: 'value-input', downloadProbeCacheTtlHours: 'value-input',
    channelArchiveMaxItems: 'value-input', channelArchiveMaxHeight: 'value-input',
    chatMuteDurations: 'value-input', commentMuteDurations: 'value-input',
    glassIntensity: 'value-input', accentColor: 'value-input',

    // Enum choices — same reasoning as value inputs.
    autoplayBlockMode: 'enum', blockedKeywordsMode: 'enum', clipExportFormat: 'enum',
    segmentSkipMode: 'enum', downloadQualityPreference: 'enum', audioExtractionMode: 'enum',
    downloadMuxerEngine: 'enum', homeCleanupPreset: 'enum', pageDensity: 'enum',
    qualityMode: 'enum', shortsFilterScope: 'enum', rantExportFormat: 'enum',
    rantTierFilter: 'enum', commentThreadView: 'enum', politicsFilterPreset: 'enum',
    remoteCosmeticRulesChannel: 'enum',

    // Extension-only privileged surfaces. The in-page modal is shared with the
    // userscript runtime, where these capabilities do not exist.
    contextMenusEnabled: 'extension-only', sidePanelEnabled: 'extension-only',
    channelNotifierEnabled: 'extension-only', channelArchiveEnabled: 'extension-only',
    channelArchiveFilterClips: 'extension-only', channelArchiveButton: 'extension-only',
    archiveQueuePauseOnOffline: 'extension-only', downloadManagerEnabled: 'extension-only',
    downloadIncludeMetadata: 'extension-only', downloadIncludeThumbnail: 'extension-only',
    downloadLiveStreams: 'extension-only', downloadShorts: 'extension-only',
    bulkUnsubscribeEnabled: 'extension-only', bulkUnsubscribeDryRun: 'extension-only',
    backupHistory: 'extension-only', privacyReport: 'extension-only',
    encryptedGistSync: 'extension-only',
    remoteCosmeticRules: 'extension-only',

    // Diagnostics, surfaced through the options page Privacy & Data section.
    debugSelectorTelemetry: 'diagnostics', debugErrorLog: 'diagnostics',

    // Parked keys shipped ahead of their features; see Roadmap_Blocked.md.
    // These must not appear as live switches anywhere until implemented.
    multiStreamViewer: 'parked', studioSceneTools: 'parked', uploaderMetadataFill: 'parked',
    creatorMode: 'parked', obsAlertExport: 'parked', rssExportEnabled: 'parked',
    commentSearch: 'parked', chatMentionHighlight: 'parked', chatClickToMention: 'parked',
    chatParticipantsList: 'parked', chatTimedMutes: 'parked', chatUsernameColors: 'parked',
    rantStatsPanel: 'parked', rantStickyHighValue: 'parked', filterPreviewBadges: 'parked',
    perChannelVolumeMemory: 'parked',
};

const categoriesStart = core.indexOf('const RX_CATEGORIES');
assert.ok(categoriesStart > 0, 'RX_CATEGORIES table is missing');
const categoriesBlock = core.slice(categoriesStart, core.indexOf('\n];', categoriesStart));
const modalIds = new Set(
    [...categoriesBlock.matchAll(/\bid:\s*'([A-Za-z0-9_]+)'/g)].map((match) => match[1]),
);

const uncovered = Object.keys(defaults)
    .filter((key) => !modalIds.has(key) && !Object.hasOwn(MODAL_EXCLUSIONS, key));
assert.deepEqual(uncovered, [],
    `settings missing from the in-page modal and from MODAL_EXCLUSIONS: ${uncovered.join(', ')}`);

const staleExclusions = Object.keys(MODAL_EXCLUSIONS)
    .filter((key) => !Object.hasOwn(defaults, key) || modalIds.has(key));
assert.deepEqual(staleExclusions, [],
    `MODAL_EXCLUSIONS entries are stale (removed or now in the modal): ${staleExclusions.join(', ')}`);

const cssFactory = core.match(/function makeCssToggleFeature\(entry\) \{([\s\S]*?)\n\}/)?.[0] || '';
assert.match(cssFactory, /id:\s*entry\.id/);
assert.match(cssFactory, /injectStyle\(entry\.css, 'rx-css-' \+ entry\.id\)/);
assert.match(cssFactory, /this\._styleEl\?\.remove\(\)/);

console.log(`Feature catalog OK: ${handwritten.length} handwritten + ${cssIds.length} CSS modules = ${allIds.length} unique lifecycle contracts.`);
