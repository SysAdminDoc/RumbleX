// RumbleX shared activity storage helpers.
(function () {
'use strict';

const PREFIX = 'rx_act:';
const META_KEY = 'rx_activity_meta';
const GENERATION_KEY = 'rx_activity_generation';
const PREMIGRATION_KEY = 'rx_activity_premigration';
const MIGRATION_JOURNAL_KEY = 'rx_activity_migration_journal';
const PENDING_OPERATION_KEY = 'rx_pending_local_data_op';
const VERSION = 1;
const LOCAL_KEYS = Object.freeze([
    'rx_volume',
    'rx_watch_progress',
    'rx_watch_history',
    'rx_search_history',
    'rx_bookmarks',
    'rx_channel_prefs',
    'rx_comment_drafts',
    'rx_live_api_observed',
]);
const LOCAL_PREFIXES = Object.freeze(['rx_rants_']);
const BACKUP_KEYS = Object.freeze(['rx_rant_stats_mirror']);
const SNAPSHOT_KEYS = Object.freeze([
    ...BACKUP_KEYS,
    PENDING_OPERATION_KEY,
    META_KEY,
    GENERATION_KEY,
    PREMIGRATION_KEY,
    MIGRATION_JOURNAL_KEY,
]);

function mergeJson(current, legacy, depth = 0) {
    if (depth > 4) return current;
    if (Array.isArray(current) && Array.isArray(legacy)) {
        const identity = (item) => {
            if (item === null || typeof item !== 'object') return `${typeof item}:${String(item)}`;
            for (const key of ['id', 'videoId', 'url', 'query', 'username', 'channelId']) {
                if (item[key] !== undefined && item[key] !== null) return `${key}:${String(item[key])}`;
            }
            try { return `json:${JSON.stringify(item)}`; } catch { return null; }
        };
        const merged = [];
        const positions = new Map();
        for (const item of [...legacy, ...current]) {
            const key = identity(item);
            if (key === null || !positions.has(key)) {
                if (key !== null) positions.set(key, merged.length);
                merged.push(item);
            } else {
                merged[positions.get(key)] = item;
            }
        }
        return merged;
    }
    const currentPlain = current && typeof current === 'object' && !Array.isArray(current);
    const legacyPlain = legacy && typeof legacy === 'object' && !Array.isArray(legacy);
    if (currentPlain && legacyPlain) {
        const merged = Object.create(null);
        for (const [key, value] of Object.entries(legacy)) {
            if (!['__proto__', 'prototype', 'constructor'].includes(key)) merged[key] = value;
        }
        for (const [key, value] of Object.entries(current)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
            merged[key] = Object.hasOwn(merged, key)
                ? mergeJson(value, merged[key], depth + 1)
                : value;
        }
        return merged;
    }
    return current;
}

function mergeValue(current, legacy) {
    if (typeof current !== 'string') return legacy;
    if (typeof legacy !== 'string' || current === legacy) return current;
    try {
        return JSON.stringify(mergeJson(JSON.parse(current), JSON.parse(legacy)));
    } catch {
        return current;
    }
}

function jsonSame(left, right) {
    try { return JSON.stringify(left) === JSON.stringify(right); } catch { return left === right; }
}

function itemIdentity(item) {
    if (item === null || typeof item !== 'object') return `${typeof item}:${String(item)}`;
    for (const key of ['id', 'videoId', 'url', 'query', 'username', 'channelId']) {
        if (item[key] !== undefined && item[key] !== null) return `${key}:${String(item[key])}`;
    }
    try { return `json:${JSON.stringify(item)}`; } catch { return null; }
}

// Apply a page-local change relative to the value originally migrated while
// keeping extension-side additions that happened in another tab. This is the
// migration equivalent of a three-way merge: unchanged page fields defer to
// the extension, explicit page edits/removals win, and unrelated new records
// on either side survive.
function reconcileJson(current, page, baseline, depth = 0) {
    if (jsonSame(page, baseline)) return current;
    if (depth > 6) return page;
    if (page === undefined) {
        if (Array.isArray(current) && Array.isArray(baseline)) {
            return reconcileJson(current, [], baseline, depth + 1);
        }
        const currentPlain = current && typeof current === 'object' && !Array.isArray(current);
        const baselinePlain = baseline && typeof baseline === 'object' && !Array.isArray(baseline);
        if (currentPlain && baselinePlain) return reconcileJson(current, {}, baseline, depth + 1);
        return undefined;
    }
    if (baseline === undefined) {
        if (current === undefined) return page;
        return mergeJson(page, current, depth + 1);
    }
    if (Array.isArray(page) && Array.isArray(baseline)) {
        const currentList = Array.isArray(current) ? current : baseline;
        const toMap = (list) => new Map(list.map((item) => [itemIdentity(item), item]));
        const currentMap = toMap(currentList);
        const baselineMap = toMap(baseline);
        const pageIds = new Set();
        const result = [];
        for (const item of page) {
            const id = itemIdentity(item);
            pageIds.add(id);
            const next = reconcileJson(currentMap.get(id), item, baselineMap.get(id), depth + 1);
            if (next !== undefined) result.push(next);
        }
        for (const item of currentList) {
            const id = itemIdentity(item);
            if (!pageIds.has(id) && !baselineMap.has(id)) result.push(item);
        }
        return result;
    }
    const pagePlain = page && typeof page === 'object' && !Array.isArray(page);
    const baselinePlain = baseline && typeof baseline === 'object' && !Array.isArray(baseline);
    if (pagePlain && baselinePlain) {
        const currentPlain = current && typeof current === 'object' && !Array.isArray(current);
        const result = Object.create(null);
        for (const [key, value] of Object.entries(currentPlain ? current : baseline)) {
            if (!['__proto__', 'prototype', 'constructor'].includes(key)) result[key] = value;
        }
        for (const key of Object.keys(baseline)) {
            if (!Object.hasOwn(page, key)) delete result[key];
        }
        for (const [key, value] of Object.entries(page)) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
            const next = reconcileJson(result[key], value, baseline[key], depth + 1);
            if (next === undefined) delete result[key];
            else result[key] = next;
        }
        return result;
    }
    return page;
}

function reconcileValue(currentExtension, pageValue, baselineValue) {
    if (pageValue === baselineValue) return currentExtension;
    if (baselineValue === undefined) return mergeValue(pageValue, currentExtension);
    try {
        const current = typeof currentExtension === 'string' ? JSON.parse(currentExtension) : undefined;
        const page = typeof pageValue === 'string' ? JSON.parse(pageValue) : undefined;
        const baseline = JSON.parse(baselineValue);
        const reconciled = reconcileJson(current, page, baseline);
        return reconciled === undefined ? undefined : JSON.stringify(reconciled);
    } catch {
        return pageValue;
    }
}

function collectStoredActivity(values) {
    if (!values || typeof values !== 'object') return {};
    return Object.fromEntries(Object.entries(values).filter(([key, value]) => (
        (key.startsWith(PREFIX) && typeof value === 'string')
        || (SNAPSHOT_KEYS.includes(key) && value !== undefined)
    )));
}

function isLocalActivityKey(key) {
    return typeof key === 'string'
        && (LOCAL_KEYS.includes(key) || LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix)));
}

function sanitizeLocalActivity(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(Object.entries(data).filter(([key, value]) => (
        isLocalActivityKey(key) && typeof value === 'string'
    )));
}

globalThis.RumbleXActivityStore = Object.freeze({
    PREFIX,
    META_KEY,
    GENERATION_KEY,
    PREMIGRATION_KEY,
    MIGRATION_JOURNAL_KEY,
    PENDING_OPERATION_KEY,
    VERSION,
    LOCAL_KEYS,
    LOCAL_PREFIXES,
    BACKUP_KEYS,
    SNAPSHOT_KEYS,
    mergeValue,
    reconcileValue,
    collectStoredActivity,
    isLocalActivityKey,
    sanitizeLocalActivity,
});
})();
