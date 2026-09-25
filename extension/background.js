// RumbleX v3.2.0 - Background Service Worker
'use strict';

// MV3 service workers load shared extension-origin helpers here. Firefox MV2
// loads them before background.js through manifest-firefox.json.
if (typeof importScripts === 'function') {
    if (!globalThis.RumbleXSettingsSchema) importScripts('settings-schema.js');
    if (!globalThis.RumbleXActivityStore) importScripts('activity-store.js');
    try { importScripts('archive-fs.js'); } catch (error) {
        console.warn('[RumbleX] archive folder helper unavailable:', error);
    }
}

const RXSettingsSchema = globalThis.RumbleXSettingsSchema;
if (!RXSettingsSchema) throw new Error('RumbleX settings schema is missing');
const RXActivityStore = globalThis.RumbleXActivityStore;
if (!RXActivityStore) throw new Error('RumbleX activity store helpers are missing');

function rxNormalizeSettings(value) {
    return RXSettingsSchema.normalizeStored(value, RXSettingsSchema.DEFAULTS);
}

// Guard rails for download URLs accepted from the content script. We trust
// the content script because it can only be injected on rumble.com, but we
// still refuse downloads targeting unrelated hosts so a compromised page
// can't turn the extension into a general file grabber.
const ALLOWED_DOWNLOAD_HOSTS = [
    'rumble.com',
    '1a-1791.com',
    'rumble.cloud',
];
const PENDING_LOCAL_DATA_OP_KEY = 'rx_pending_local_data_op';
const RX_CANONICAL_RUMBLE_ORIGINS = Object.freeze([
    'https://rumble.com',
    'https://www.rumble.com',
]);

function rxTrustedRumbleOrigin(value) {
    try {
        const parsed = new URL(String(value || ''));
        if (!['http:', 'https:'].includes(parsed.protocol)) return null;
        if (parsed.hostname !== 'rumble.com' && !parsed.hostname.endsWith('.rumble.com')) return null;
        return parsed.origin;
    } catch {
        return null;
    }
}

function rxSenderRumbleOrigin(sender) {
    return rxTrustedRumbleOrigin(sender?.url || sender?.tab?.url || '');
}

function rxPendingOperationOrigins(op) {
    const source = Array.isArray(op?.remainingOrigins)
        ? op.remainingOrigins
        : Array.isArray(op?.targetOrigins)
            ? op.targetOrigins
            : null;
    if (!source) return null;
    return [...new Set(source.map(rxTrustedRumbleOrigin).filter(Boolean))];
}

function rxPendingOperationTargetsOrigin(op, origin) {
    if (op?.allTrustedOrigins === true) {
        if (!origin) return true;
        const trusted = rxTrustedRumbleOrigin(origin);
        if (!trusted) return false;
        const completed = Array.isArray(op.completedOrigins)
            ? op.completedOrigins.map(rxTrustedRumbleOrigin).filter(Boolean)
            : [];
        return !completed.includes(trusted);
    }
    const targets = rxPendingOperationOrigins(op);
    return !targets || !origin || targets.includes(origin);
}

async function rxReadPendingLocalDataOperation() {
    const got = await chrome.storage.local.get(PENDING_LOCAL_DATA_OP_KEY);
    const op = got[PENDING_LOCAL_DATA_OP_KEY];
    return op && typeof op === 'object' ? op : null;
}

async function rxGetPendingLocalDataOperation(origin = null) {
    await rxSettingsWriteChain.catch(() => {});
    const op = await rxReadPendingLocalDataOperation();
    return op && rxPendingOperationTargetsOrigin(op, origin) ? op : null;
}

function rxCompletePendingLocalDataOperation(id, { cleared = 0, written = 0, origin = null } = {}) {
    return rxQueueStorageMutation(async () => {
        const current = await rxReadPendingLocalDataOperation();
        if (!current || current.id !== id) return { ok: true, cleared: false };
        if (!rxPendingOperationTargetsOrigin(current, origin)) {
            return { ok: true, cleared: false, reason: 'origin-not-targeted' };
        }
        if (current.extensionApplied !== true && current.keyCount > 0 && written < current.keyCount) {
            await chrome.storage.local.set({
                [PENDING_LOCAL_DATA_OP_KEY]: {
                    ...current,
                    lastAttemptAt: Date.now(),
                    lastWritten: Math.max(0, Number(written) || 0),
                    lastCleared: Math.max(0, Number(cleared) || 0),
                },
            });
            return {
                ok: false,
                cleared: false,
                reason: 'partial-write',
                expected: current.keyCount,
                written: Math.max(0, Number(written) || 0),
            };
        }
        if (current.allTrustedOrigins === true && origin) {
            const trusted = rxTrustedRumbleOrigin(origin);
            const completedOrigins = [...new Set([
                ...(Array.isArray(current.completedOrigins) ? current.completedOrigins : []),
                trusted,
            ].map(rxTrustedRumbleOrigin).filter(Boolean))];
            const remainingOrigins = (rxPendingOperationOrigins(current) || [])
                .filter((item) => !completedOrigins.includes(item));
            await chrome.storage.local.set({
                [PENDING_LOCAL_DATA_OP_KEY]: {
                    ...current,
                    completedOrigins,
                    remainingOrigins,
                    lastAttemptAt: Date.now(),
                    lastWritten: Math.max(0, Number(written) || 0),
                    lastCleared: Math.max(0, Number(cleared) || 0),
                },
            });
            return { ok: true, cleared: true, remainingOrigins, allTrustedOrigins: true };
        }
        const remaining = rxPendingOperationOrigins(current);
        if (remaining && origin) {
            const next = remaining.filter((item) => item !== origin);
            if (next.length) {
                await chrome.storage.local.set({
                    [PENDING_LOCAL_DATA_OP_KEY]: {
                        ...current,
                        remainingOrigins: next,
                        lastAttemptAt: Date.now(),
                    },
                });
                return { ok: true, cleared: true, remainingOrigins: next };
            }
        }
        await chrome.storage.local.remove(PENDING_LOCAL_DATA_OP_KEY);
        return { ok: true, cleared: true, remainingOrigins: [] };
    });
}

async function rxReplayPendingResetExtensionState(current, stored = null) {
    const snapshot = stored || await chrome.storage.local.get(null);
    const activityKeys = current.extensionApplied !== true
        ? Object.keys(snapshot).filter((key) => key.startsWith(RXActivityStore.PREFIX))
        : [];
    if (current.extensionApplied !== true) {
        const removeKeys = [...new Set([...RX_RESET_REMOVE_KEYS, ...activityKeys])]
            .filter((key) => key !== PENDING_LOCAL_DATA_OP_KEY);
        if (removeKeys.length) await chrome.storage.local.remove(removeKeys);
    }
    if (current.archiveHandleApplied !== true) {
        if (!globalThis.RxArchiveFsAccess?.deleteHandle) {
            throw new Error('Archive folder cleanup is unavailable');
        }
        await globalThis.RxArchiveFsAccess.deleteHandle();
    }
    return {
        stored: snapshot,
        cleared: activityKeys.length,
        generation: Number.isInteger(current.activityGeneration)
            ? current.activityGeneration
            : Math.max(0, Number(snapshot[RXActivityStore.GENERATION_KEY]) || 0),
    };
}

function rxApplyPendingLocalDataOperation(id, origin) {
    return rxQueueStorageMutation(async () => {
        const current = await rxReadPendingLocalDataOperation();
        if (!current || current.id !== id) return { ok: true, applied: false, reason: 'superseded' };
        if (!origin || !rxPendingOperationTargetsOrigin(current, origin)) {
            return { ok: true, applied: false, reason: 'origin-not-targeted' };
        }

        const data = RXActivityStore.sanitizeLocalActivity(current.data);
        const replaysReset = current.clear === true && current.extensionApplied !== true;
        const replaysArchiveHandle = current.clear === true && current.archiveHandleApplied !== true;
        const mutatesExtension = current.extensionApplied !== true && Object.keys(data).length > 0;
        let cleared = 0;
        let resetReplay = null;
        let storedForMutation = null;
        if (replaysReset || replaysArchiveHandle || mutatesExtension) {
            storedForMutation = await chrome.storage.local.get(null);
        }
        if (replaysReset || replaysArchiveHandle) {
            resetReplay = await rxReplayPendingResetExtensionState(current, storedForMutation);
            cleared = resetReplay.cleared;
        }
        const values = Object.fromEntries(Object.entries(mutatesExtension ? data : {})
            .map(([key, value]) => [RXActivityStore.PREFIX + key, value]));
        let generation = null;
        if (replaysReset || replaysArchiveHandle) {
            generation = resetReplay.generation;
        } else if (mutatesExtension) {
            generation = Math.max(0, Number(storedForMutation[RXActivityStore.GENERATION_KEY]) || 0) + 1;
        } else if (current.clear === true && Number.isInteger(current.activityGeneration)) {
            generation = current.activityGeneration;
        }

        const remaining = rxPendingOperationOrigins(current);
        const nextOrigins = remaining ? remaining.filter((item) => item !== origin) : [];
        const completedOrigins = current.allTrustedOrigins === true
            ? [...new Set([
                ...(Array.isArray(current.completedOrigins) ? current.completedOrigins : []),
                origin,
            ].map(rxTrustedRumbleOrigin).filter(Boolean))]
            : [];
        const nextOperation = current.allTrustedOrigins === true || nextOrigins.length
            ? {
                ...current,
                remainingOrigins: nextOrigins,
                ...(current.allTrustedOrigins === true ? { completedOrigins } : {}),
                extensionApplied: current.extensionApplied === true || mutatesExtension || replaysReset,
                ...(current.clear === true ? { archiveHandleApplied: true } : {}),
                lastAttemptAt: Date.now(),
                lastWritten: mutatesExtension ? Object.keys(data).length : 0,
            }
            : null;
        // The durable data and the replay marker land in one storage.set. If
        // the worker dies immediately afterward, a later origin sees either
        // the old operation and old data or the new data and an applied/null
        // marker. It can never replay a successful import as if it were new.
        await chrome.storage.local.set({
            ...values,
            ...(generation === null ? {} : { [RXActivityStore.GENERATION_KEY]: generation }),
            [PENDING_LOCAL_DATA_OP_KEY]: nextOperation,
        });
        if (!nextOperation) {
            // Null is already the crash-safe tombstone. Removing it only keeps
            // the storage inspector tidy and is deliberately best effort.
            try { await chrome.storage.local.remove(PENDING_LOCAL_DATA_OP_KEY); } catch {}
        }
        return {
            ok: true,
            applied: true,
            clear: current.clear === true,
            cleared,
            data: mutatesExtension ? data : {},
            written: mutatesExtension ? Object.keys(data).length : 0,
            extensionMutated: mutatesExtension || replaysReset,
            generation,
            remainingOrigins: nextOrigins,
        };
    });
}

function rxQueryRumbleTabs() {
    return new Promise((resolve) => {
        try {
            chrome.tabs.query({ url: ['*://rumble.com/*', '*://*.rumble.com/*'] }, (tabs) => {
                void chrome.runtime.lastError;
                resolve(Array.isArray(tabs) ? tabs : []);
            });
        } catch {
            resolve([]);
        }
    });
}

function rxSendTabMessage(tabId, message, timeoutMs = 3_000) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => finish(null), timeoutMs);
        try {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                void chrome.runtime.lastError;
                finish(response || null);
            });
        } catch {
            finish(null);
        }
    });
}

async function rxBroadcastPendingLocalDataOperation(operation, message) {
    const tabs = await rxQueryRumbleTabs();
    const responses = await Promise.all(tabs.map(async (tab) => {
        if (typeof tab?.id !== 'number') return { origin: null, response: null };
        return {
            origin: rxTrustedRumbleOrigin(tab.url),
            response: await rxSendTabMessage(tab.id, message),
        };
    }));
    const successfulOrigins = [...new Set(responses
        .filter((item) => item.response?.ok && item.origin)
        .map((item) => item.origin))];
    const cleared = responses.reduce((total, item) => (
        total + (item.response?.ok ? Math.max(0, Number(item.response.cleared) || 0) : 0)
    ), 0);

    let pending = operation || null;
    if (operation?.id && successfulOrigins.length) {
        const completedOrigins = [...new Set([
            ...(Array.isArray(operation.completedOrigins) ? operation.completedOrigins : []),
            ...successfulOrigins,
        ].map(rxTrustedRumbleOrigin).filter(Boolean))];
        const remainingOrigins = (rxPendingOperationOrigins(operation) || [])
            .filter((origin) => !completedOrigins.includes(origin));
        pending = operation.allTrustedOrigins === true || remainingOrigins.length
            ? {
                ...operation,
                completedOrigins,
                remainingOrigins,
                lastAttemptAt: Date.now(),
            }
            : null;
        try {
            await chrome.storage.local.set({ [PENDING_LOCAL_DATA_OP_KEY]: pending });
            if (!pending) await chrome.storage.local.remove(PENDING_LOCAL_DATA_OP_KEY);
        } catch {
            // The original marker remains durable and safely retries later.
            pending = operation;
        }
    }

    return {
        tabs: tabs.length,
        cleared,
        successfulOrigins: successfulOrigins.length,
        pending: !!pending,
        pendingClear: pending?.clear === true,
        pendingId: pending?.id || null,
        pendingKeys: Math.max(0, Number(pending?.keyCount) || 0),
        pendingOrigins: rxPendingOperationOrigins(pending)?.length || 0,
    };
}

function rxPrepareImportedActivity(stored, data, mirrorProvided = false, mirror = null, requestedOrigins = RX_CANONICAL_RUMBLE_ORIGINS) {
    const payload = RXActivityStore.sanitizeLocalActivity(data);
    const generation = Math.max(0, Number(stored[RXActivityStore.GENERATION_KEY]) || 0) + 1;
    const existing = stored[PENDING_LOCAL_DATA_OP_KEY];
    const existingOrigins = rxPendingOperationOrigins(existing) || [];
    const targetOrigins = [...new Set([
        ...existingOrigins,
        ...(Array.isArray(requestedOrigins) ? requestedOrigins : RX_CANONICAL_RUMBLE_ORIGINS),
    ].map(rxTrustedRumbleOrigin).filter(Boolean))];
    const existingCleanupKeys = Array.isArray(existing?.cleanupKeys)
        ? existing.cleanupKeys.filter((key) => RXActivityStore.isLocalActivityKey(key))
        : Object.keys(RXActivityStore.sanitizeLocalActivity(existing?.data));
    const cleanupKeys = [...new Set([...existingCleanupKeys, ...Object.keys(payload)])];
    const needsPageCleanup = cleanupKeys.length > 0 || existing?.clear === true;
    const pending = needsPageCleanup
        ? {
            id: String(Date.now()) + '-' + Math.random().toString(16).slice(2),
            source: 'import',
            createdAt: Date.now(),
            clear: existing?.clear === true,
            data: null,
            cleanupKeys,
            keyCount: cleanupKeys.length,
            targetOrigins,
            remainingOrigins: targetOrigins,
            allTrustedOrigins: true,
            completedOrigins: [],
            extensionApplied: true,
        }
        : null;
    const values = Object.fromEntries(Object.entries(payload)
        .map(([key, value]) => [RXActivityStore.PREFIX + key, value]));
    if (mirrorProvided) values.rx_rant_stats_mirror = rxNormalizeRantMirror(mirror);
    const priorMeta = stored[RXActivityStore.META_KEY];
    const existingActivityKeys = Object.keys(stored)
        .filter((key) => key.startsWith(RXActivityStore.PREFIX));
    values[RXActivityStore.META_KEY] = {
        ...(priorMeta && typeof priorMeta === 'object' && !Array.isArray(priorMeta) ? priorMeta : {}),
        version: RXActivityStore.VERSION,
        migratedAt: Number.isFinite(priorMeta?.migratedAt) ? priorMeta.migratedAt : Date.now(),
        updatedAt: Date.now(),
        importedAt: Date.now(),
        keys: new Set([...existingActivityKeys, ...Object.keys(values)
            .filter((key) => key.startsWith(RXActivityStore.PREFIX))]).size,
        origins: Array.isArray(priorMeta?.origins) ? priorMeta.origins : [],
    };
    return { payload, generation, pending, values, mirrorProvided };
}

function rxPreparePageCleanupOperation(stored, {
    source,
    clear = false,
    cleanupKeys = [],
    activityGeneration,
    existingOverride,
    preserveExistingIdentity = false,
} = {}) {
    const existing = existingOverride === undefined
        ? stored?.[PENDING_LOCAL_DATA_OP_KEY]
        : existingOverride;
    const existingOrigins = rxPendingOperationOrigins(existing) || [];
    const targetOrigins = [...new Set([
        ...existingOrigins,
        ...RX_CANONICAL_RUMBLE_ORIGINS,
    ].map(rxTrustedRumbleOrigin).filter(Boolean))];
    const existingCleanup = Array.isArray(existing?.cleanupKeys)
        ? existing.cleanupKeys.filter((key) => RXActivityStore.isLocalActivityKey(key))
        : Object.keys(RXActivityStore.sanitizeLocalActivity(existing?.data));
    const safeCleanup = [...new Set([...existingCleanup, ...cleanupKeys]
        .filter((key) => RXActivityStore.isLocalActivityKey(key)))];
    const preserveIdentity = preserveExistingIdentity && existing?.id;
    return {
        id: preserveIdentity
            ? existing.id
            : String(Date.now()) + '-' + Math.random().toString(16).slice(2),
        source: preserveIdentity ? (existing.source || source) : source,
        createdAt: preserveIdentity && Number.isFinite(existing.createdAt)
            ? existing.createdAt
            : Date.now(),
        clear: clear === true || existing?.clear === true,
        data: null,
        cleanupKeys: safeCleanup,
        keyCount: safeCleanup.length,
        targetOrigins,
        remainingOrigins: targetOrigins,
        allTrustedOrigins: true,
        completedOrigins: [],
        extensionApplied: true,
        archiveHandleApplied: true,
        activityGeneration,
    };
}

function rxQueueImportedActivity(data, mirrorProvided = false, mirror = null, requestedOrigins = RX_CANONICAL_RUMBLE_ORIGINS) {
    return rxQueueStorageMutation(async () => {
        let stored = await chrome.storage.local.get(null);
        stored = await rxRecoverActivityMigration(stored);
        const prepared = rxPrepareImportedActivity(stored, data, mirrorProvided, mirror, requestedOrigins);
        await chrome.storage.local.set({
            ...prepared.values,
            [RXActivityStore.GENERATION_KEY]: prepared.generation,
            [PENDING_LOCAL_DATA_OP_KEY]: prepared.pending,
        });
        if (!prepared.pending) {
            try { await chrome.storage.local.remove(PENDING_LOCAL_DATA_OP_KEY); } catch {}
        }
        const broadcast = await rxBroadcastPendingLocalDataOperation(prepared.pending, {
            action: 'setLocalData',
            data: prepared.payload,
            clear: prepared.pending?.clear === true,
            generation: prepared.generation,
            resetRantCache: prepared.mirrorProvided,
        });
        return {
            ok: true,
            generation: prepared.generation,
            written: Object.keys(prepared.payload).length,
            mirrorWritten: prepared.mirrorProvided,
            pending: broadcast.pending,
            pendingId: broadcast.pendingId,
            pendingKeys: broadcast.pendingKeys,
            pendingOrigins: broadcast.pendingOrigins,
            tabs: broadcast.tabs,
        };
    });
}

// v3.2.0 — Offscreen document lifecycle.
// MV3 service workers can't touch the DOM (no DOMParser, no Blob URL creation
// in many shapes, no WebRTC). We spin a single offscreen document with
// reasons DOM_PARSER + BLOBS + WORKERS and reuse it across requests. Chrome
// API enforces one offscreen doc per extension per profile so we don't fight
// the runtime. Detection spans Chrome 111 through the current API contract.
const OFFSCREEN_URL = chrome.runtime.getURL('offscreen.html');
let rxOffscreenEnsurePromise = null;

async function rxHasOffscreenDocument() {
    if (!chrome.offscreen) return false;
    if (typeof chrome.offscreen.hasDocument === 'function') {
        return chrome.offscreen.hasDocument();
    }
    if (typeof chrome.runtime.getContexts === 'function') {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [OFFSCREEN_URL],
        });
        return contexts.length > 0;
    }
    if (typeof globalThis.clients?.matchAll === 'function') {
        const matchedClients = await globalThis.clients.matchAll();
        return matchedClients.some((client) => client.url === OFFSCREEN_URL);
    }
    return false;
}

async function ensureOffscreenDocument() {
    if (!chrome.offscreen) return false; // older Chrome / Firefox MV2 — caller falls back
    if (!rxOffscreenEnsurePromise) {
        rxOffscreenEnsurePromise = (async () => {
            const has = await rxHasOffscreenDocument();
            if (has) return true;
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['DOM_PARSER', 'BLOBS', 'WORKERS'],
                justification: 'Parse HTML probe results, hash media blobs, and host long-running download work that the service worker cannot do alone.',
            });
            return true;
        })();
    }
    const ensurePromise = rxOffscreenEnsurePromise;
    try {
        return await ensurePromise;
    } catch (e) {
        // Swallow — caller falls back to in-content-script processing.
        console.warn('[RumbleX] ensureOffscreenDocument failed:', e);
        return false;
    } finally {
        if (rxOffscreenEnsurePromise === ensurePromise) rxOffscreenEnsurePromise = null;
    }
}

async function callOffscreen(action, payload) {
    const ok = await ensureOffscreenDocument();
    if (!ok) return { ok: false, reason: 'no-offscreen' };
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ target: 'offscreen', action, ...payload }, (resp) => {
                void chrome.runtime.lastError;
                resolve(resp || { ok: false, reason: 'no-response' });
            });
        } catch (e) {
            resolve({ ok: false, reason: String(e?.message || e) });
        }
    });
}

// v3.35.0 — Local-only downloader diagnostics. Failures are persisted in a
// small extension-storage ring so the options page can export them even when
// the originating Rumble tab is gone. Every value is defensively sanitized at
// this boundary; cookies, credentials, query values, URL fragments, signed CDN
// path segments, and other token-like data never enter the stored bundle.
const RX_DOWNLOAD_DIAGNOSTICS_KEY = 'rx_download_diagnostics';
const RX_DOWNLOAD_DIAGNOSTICS_MAX = 50;
const rxRedactDiagnosticUrl = RXSettingsSchema.redactUrl;
const rxSanitizeDiagnosticString = RXSettingsSchema.sanitizeDiagnosticText;
const rxSanitizeDiagnostic = RXSettingsSchema.sanitizeDiagnosticValue;

async function rxGetDownloadDiagnosticCapabilities(probeOffscreen = false) {
    const capabilities = {
        downloadsApi: typeof chrome.downloads?.download === 'function',
        offscreenApi: !!chrome.offscreen,
        offscreenDocument: false,
        offscreenRuntime: null,
    };
    if (chrome.offscreen) {
        try { capabilities.offscreenDocument = await rxHasOffscreenDocument(); } catch {}
    }
    if (probeOffscreen && chrome.offscreen) {
        const response = await callOffscreen('getCapabilities', {});
        capabilities.offscreenRuntime = rxSanitizeDiagnostic(response);
        if (response?.ok) capabilities.offscreenDocument = true;
    }
    return capabilities;
}

async function rxLoadDownloadDiagnostics() {
    try {
        const stored = await chrome.storage.local.get(RX_DOWNLOAD_DIAGNOSTICS_KEY);
        const entries = stored[RX_DOWNLOAD_DIAGNOSTICS_KEY];
        return Array.isArray(entries) ? entries.slice(-RX_DOWNLOAD_DIAGNOSTICS_MAX) : [];
    } catch {
        return [];
    }
}

async function rxPersistDownloadDiagnostic(input, expectedGeneration = null) {
    if (expectedGeneration !== null && expectedGeneration !== rxDownloadRecoveryGeneration) {
        return { superseded: true };
    }
    const sanitized = rxSanitizeDiagnostic(input && typeof input === 'object' ? input : {});
    const capabilities = await rxGetDownloadDiagnosticCapabilities(false);
    if (expectedGeneration !== null && expectedGeneration !== rxDownloadRecoveryGeneration) {
        return { superseded: true };
    }
    const entry = {
        ...sanitized,
        id: 'rxd-' + Date.now() + '-' + Math.random().toString(16).slice(2, 10),
        at: new Date().toISOString(),
        extensionVersion: chrome.runtime.getManifest().version,
        status: 'failed',
        source: sanitized.source || 'unknown',
        operation: sanitized.operation || 'download',
        stage: sanitized.stage || 'unknown',
        capabilities: {
            ...(sanitized.capabilities && typeof sanitized.capabilities === 'object' ? sanitized.capabilities : {}),
            ...capabilities,
        },
    };
    const entries = await rxLoadDownloadDiagnostics();
    if (expectedGeneration !== null && expectedGeneration !== rxDownloadRecoveryGeneration) {
        return { superseded: true };
    }
    entries.push(entry);
    if (entries.length > RX_DOWNLOAD_DIAGNOSTICS_MAX) {
        entries.splice(0, entries.length - RX_DOWNLOAD_DIAGNOSTICS_MAX);
    }
    await chrome.storage.local.set({ [RX_DOWNLOAD_DIAGNOSTICS_KEY]: entries });
    return entry;
}

function rxRecordDownloadDiagnostic(input, expectedGeneration = null) {
    return rxQueueStorageMutation(() => rxPersistDownloadDiagnostic(input, expectedGeneration));
}

function rxClearDownloadDiagnostics() {
    return rxQueueStorageMutation(() => chrome.storage.local.remove(RX_DOWNLOAD_DIAGNOSTICS_KEY));
}

async function rxBuildDownloadDiagnosticsBundle() {
    const attempts = await rxLoadDownloadDiagnostics();
    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        extensionVersion: chrome.runtime.getManifest().version,
        count: attempts.length,
        privacy: 'Local-only diagnostic data. URL query values, fragments, credentials, cookies, and token-like path segments are redacted before storage.',
        capabilities: await rxGetDownloadDiagnosticCapabilities(true),
        attempts,
    };
}

// v3.58.0 — Media probes run here, not in the content script.
//
// Chrome's own wording: "Cross-origin requests are always treated as such in
// content scripts, even if the extension has host permissions." The deep scan
// HEAD-probes 1a-1791.com and rumble.cloud, and doing that from content.js
// meant the three CDN entries in host_permissions bought it nothing: every
// probe succeeded only for as long as those CDNs returned permissive CORS
// headers. Rumble hardened its edge around 2026-08-17, and the failure mode
// there is an empty quality list with nothing to explain it. The service
// worker does hold the host grant, so the same request works here and the
// answer carries a reason the panel can report.
const RX_PROBE_SCAN_CAP = 250;
const RX_PROBE_SCAN_TTL_MS = 10 * 60 * 1000;
const RX_PROBE_DEFAULT_TIMEOUT_MS = 12_000;
const rxProbeScanCounts = new Map();

// One controller per scan, so closing the download panel actually cancels the
// requests already in flight here. Before this the content script composed the
// scan's abort signal into every fetch itself; moving the fetch to the worker
// would otherwise have left it running until each probe timed out, which is a
// regression the panel's own abort was written to prevent.
const rxProbeScanAborts = new Map();

function rxProbeScanSignal(scanId) {
    if (!rxProbeScanAborts.has(scanId)) rxProbeScanAborts.set(scanId, new AbortController());
    return rxProbeScanAborts.get(scanId).signal;
}

function rxCancelProbeScan(scanId) {
    const controller = rxProbeScanAborts.get(scanId);
    if (!controller) return false;
    controller.abort();
    rxProbeScanAborts.delete(scanId);
    rxProbeScanCounts.delete(scanId);
    return true;
}

// AbortSignal.any shipped in Firefox 124, while RumbleX supports Firefox 121.
// Falling back to the timeout alone on Firefox 121 through 123
// meant closing the panel cancelled nothing and every probe ran to its full
// budget, which is the exact behaviour the scan controller exists to stop.
// The abort reason is passed along so the caller can still tell a timeout
// (TimeoutError) apart from a cancellation (AbortError).
//
// Returns a disposer alongside the signal, and the caller has to run it. On the
// fallback path the relay listener sits on the scan's own signal, which lives
// for the whole scan: a probe that simply succeeds aborts nothing, so without
// the disposer each of the 250 probes a scan is allowed leaves a listener and a
// live timeout signal behind, and they all fire together if the panel is closed
// later. Native AbortSignal.any leaves no such tail, so its disposer is empty.
function rxAnySignal(signals) {
    if (typeof AbortSignal.any === 'function') {
        return { signal: AbortSignal.any(signals), dispose() {} };
    }
    const controller = new AbortController();
    const listeners = [];
    const dispose = () => {
        for (const off of listeners.splice(0)) off();
    };
    for (const signal of signals) {
        if (signal.aborted) {
            dispose();
            controller.abort(signal.reason);
            return { signal: controller.signal, dispose };
        }
        const onAbort = () => {
            dispose();
            controller.abort(signal.reason);
        };
        signal.addEventListener('abort', onAbort, { once: true });
        listeners.push(() => signal.removeEventListener('abort', onAbort));
    }
    return { signal: controller.signal, dispose };
}

function rxCountProbe(scanId, now = Date.now()) {
    for (const [id, entry] of rxProbeScanCounts) {
        if (now - entry.at >= RX_PROBE_SCAN_TTL_MS) {
            rxProbeScanCounts.delete(id);
            rxProbeScanAborts.delete(id);
        }
    }
    const entry = rxProbeScanCounts.get(scanId) || { count: 0, at: now };
    entry.count += 1;
    entry.at = now;
    rxProbeScanCounts.set(scanId, entry);
    // Bound the map itself, not just each scan: a page that keeps minting scan
    // ids would otherwise grow it without limit.
    while (rxProbeScanCounts.size > 64) {
        const oldest = rxProbeScanCounts.keys().next().value;
        rxProbeScanCounts.delete(oldest);
        rxProbeScanAborts.delete(oldest);
    }
    return entry.count;
}

// One probe. HEAD first because it is cheapest and most accurate, then a
// 1-byte ranged GET for hosts that refuse HEAD. The reason is the point: an
// empty quality list should be able to say whether the CDN refused, timed out,
// or simply does not have that file.
async function rxProbeMedia({ url, scanId, timeoutMs }) {
    if (!isAllowedDownloadUrl(url)) return { ok: false, reason: 'blocked' };
    const used = rxCountProbe(String(scanId));
    if (used > RX_PROBE_SCAN_CAP) {
        return { ok: false, reason: 'scan-cap', detail: `probe cap ${RX_PROBE_SCAN_CAP} reached for this scan` };
    }
    const budget = Number.isInteger(timeoutMs) ? timeoutMs : RX_PROBE_DEFAULT_TIMEOUT_MS;

    const scanSignal = rxProbeScanSignal(String(scanId));
    if (scanSignal.aborted) return { ok: false, reason: 'aborted' };

    const attempt = async (init) => {
        // The scan's own signal has to be in here, not just the timeout, or
        // closing the panel leaves these running to completion. Built outside
        // the try so the disposer below always runs: the relay it installs sits
        // on the scan signal, which outlives this one probe by up to 250 more.
        const composite = rxAnySignal([scanSignal, AbortSignal.timeout(budget)]);
        try {
            const response = await fetch(url, { ...init, credentials: 'omit', signal: composite.signal });
            response.body?.cancel?.();
            if (response.ok || response.status === 206) {
                const length = Number.parseInt(
                    response.headers.get('content-range')?.split('/')?.[1]
                    || response.headers.get('content-length')
                    || '',
                    10,
                );
                return { ok: true, size: Number.isFinite(length) && length > 0 ? length : undefined, status: response.status };
            }
            return { ok: false, reason: 'http', status: response.status };
        } catch (error) {
            const name = error?.name || '';
            if (name === 'TimeoutError') return { ok: false, reason: 'timeout' };
            if (name === 'AbortError') return { ok: false, reason: 'aborted' };
            // A TypeError from fetch in a worker that already holds the host
            // permission is a transport failure, not a CORS refusal. Content
            // scripts are where CORS bites, and that path reports it itself.
            return { ok: false, reason: 'network', detail: rxSanitizeDiagnosticString(error?.message || String(error)) };
        } finally {
            composite.dispose();
        }
    };

    const head = await attempt({ method: 'HEAD' });
    if (head.ok || head.reason === 'timeout' || head.reason === 'aborted') return head;
    const ranged = await attempt({ method: 'GET', headers: { Range: 'bytes=0-0' } });
    // Prefer whichever answer is more specific about why it failed.
    return ranged.ok ? ranged : (ranged.reason === 'http' ? ranged : head);
}

function isAllowedDownloadUrl(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:' || u.username || u.password) return false;
        const host = u.hostname.toLowerCase();
        return ALLOWED_DOWNLOAD_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    } catch {
        return false;
    }
}

chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        await rxEnsurePendingResetStartupRecovery();
    } catch (error) {
        console.warn('[RumbleX] install recovery gate failed:', error);
        return;
    }
    console.log('[RumbleX] Extension installed');
    // A fresh install lands the user on 126 modules and 208 settings with no
    // orientation at all. Open the welcome view once, on first install only —
    // never on an update, never again after it is dismissed.
    if (details?.reason === 'install') {
        chrome.storage.local.get(['rx_welcome_seen'], (stored) => {
            if (stored?.rx_welcome_seen) return;
            const url = chrome.runtime.getURL('pages/options.html#welcome');
            chrome.tabs?.create?.({ url }, () => void chrome.runtime.lastError);
        });
    }
    // Point uninstall feedback at the issue tracker rather than nothing.
    if (chrome.runtime.setUninstallURL) {
        try {
            chrome.runtime.setUninstallURL('https://github.com/SysAdminDoc/RumbleX/issues');
        } catch { /* not fatal — feedback routing is not a runtime dependency */ }
    }
    // v3.5.0 — Register context-menu items on install/update.
    rxSyncContextMenus().catch((e) => console.warn('[RumbleX] context menu sync failed:', e));
    // v3.7.0 — Sync side-panel behavior with the user's preference.
    rxSyncSidePanel().catch((e) => console.warn('[RumbleX] side panel sync failed:', e));
    // v3.9.0 — Sync channel-notifier alarm with the user's preference.
    rxSyncChannelNotifier().catch((e) => console.warn('[RumbleX] notifier sync failed:', e));
    // v3.18.0 — ensure the archive-queue drain alarm exists across SW restarts.
    rxSyncArchiveAlarm().catch((e) => console.warn('[RumbleX] archive alarm sync failed:', e));
    // v3.35.0 — reconcile any persisted offline resume jobs after updates.
    rxHandleCurrentNetworkState({ runArchive: false }).catch((e) => console.warn('[RumbleX] download recovery sync failed:', e));
});

// chrome.runtime.onStartup re-registers the alarm if the browser restarted
// (chrome.alarms survive across SW restarts, but only across SW activations,
// not full browser restarts on some platforms — sync is cheap and idempotent).
if (chrome.runtime?.onStartup) {
    chrome.runtime.onStartup.addListener(async () => {
        try {
            await rxEnsurePendingResetStartupRecovery();
        } catch {
            return;
        }
        rxSyncArchiveAlarm().catch(() => {});
        rxSyncChannelNotifier().catch(() => {});
        rxHandleCurrentNetworkState({ runArchive: false }).catch(() => {});
    });
}

// v3.7.0 — chrome.sidePanel integration.
// When `sidePanelEnabled` is on, clicking the toolbar icon opens the side
// panel instead of the popup. The side panel hosts pages/options.html which
// already has the full settings + snapshot + privacy UI; this gives users a
// persistent panel that survives htmx navigation (popup closes on every
// out-of-popup click). Chrome / Edge only — Firefox MV2 doesn't have the
// API; rxSyncSidePanel becomes a no-op there.
async function rxIsSidePanelEnabled() {
    try {
        const data = await chrome.storage.local.get('rx_settings');
        const s = data.rx_settings || {};
        return s.sidePanelEnabled === true;
    } catch { return false; }
}

async function rxSyncSidePanel() {
    if (!chrome.sidePanel) return;
    const enabled = await rxIsSidePanelEnabled();
    try {
        // setPanelBehavior controls what happens when the toolbar icon is
        // clicked. `openPanelOnActionClick: true` makes the icon open the
        // side panel directly (suppressing the popup). When OFF, Chrome
        // falls back to default_popup from the manifest.
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: enabled });
    } catch (e) {
        console.warn('[RumbleX] sidePanel.setPanelBehavior failed:', e);
    }
}

// v3.5.0 — Context menus.
// Three unambiguous wins:
//   - Copy clean URL  (strips e9s, utm_*, fbclid, etc.)
//   - Copy URL at video timestamp  (only useful on watch pages)
//   - Open RumbleX settings  (page-level entry, always available on Rumble)
// All entries scoped to *://*.rumble.com/* via documentUrlPatterns so they
// never appear on other sites.
const RX_CM_IDS = {
    copyClean: 'rx-copy-clean-url',
    copyAtTime: 'rx-copy-url-at-time',
    blockChannel: 'rx-block-channel',
    openSettings: 'rx-open-settings',
};

async function rxIsContextMenusEnabled() {
    try {
        const data = await chrome.storage.local.get('rx_settings');
        const s = data.rx_settings || {};
        // Default ON when key missing — matches Settings._defaults.
        return s.contextMenusEnabled !== false;
    } catch { return true; }
}

async function rxSyncContextMenus() {
    if (!chrome.contextMenus) return;
    await new Promise((res) => chrome.contextMenus.removeAll(() => res()));
    if (!(await rxIsContextMenusEnabled())) return;
    const docPatterns = ['*://rumble.com/*', '*://*.rumble.com/*'];
    chrome.contextMenus.create({
        id: RX_CM_IDS.copyClean,
        title: 'Copy clean URL (strip tracking)',
        contexts: ['link', 'page'],
        documentUrlPatterns: docPatterns,
        // Link context already filters by target; page context lets the
        // user copy the current page URL when right-clicking blank space.
    });
    chrome.contextMenus.create({
        id: RX_CM_IDS.copyAtTime,
        title: 'Copy URL at current time',
        contexts: ['page', 'video'],
        documentUrlPatterns: docPatterns,
    });
    // v3.14.0 — Block-channel entry. Shows up on right-click of any
    // /c/<slug> or /user/<slug> link, or on the watch page itself when
    // right-clicked on the channel link. The slug-extraction logic in the
    // click handler accepts both link context (info.linkUrl) and page
    // context (tab.url for a watch page) and falls through gracefully
    // when neither has a usable /c/ or /user/ path.
    chrome.contextMenus.create({
        id: RX_CM_IDS.blockChannel,
        title: 'Block this channel from feeds',
        contexts: ['link', 'page'],
        documentUrlPatterns: docPatterns,
        targetUrlPatterns: ['*://rumble.com/c/*', '*://rumble.com/user/*', '*://*.rumble.com/c/*', '*://*.rumble.com/user/*'],
    });
    chrome.contextMenus.create({
        id: RX_CM_IDS.openSettings,
        title: 'Open RumbleX settings',
        contexts: ['page', 'action'],
        documentUrlPatterns: docPatterns,
    });
}

// v3.14.0 — Extract the channel slug (`/c/<slug>` or `/user/<slug>`) from
// a URL. Returns the lowercase slug or null. Used by the block-channel
// context-menu entry — ChannelBlocker normalizes lowercase already so we
// match its storage shape exactly.
function rxExtractChannelSlug(href) {
    try {
        const u = new URL(href);
        if (!/(^|\.)rumble\.com$/i.test(u.hostname)) return null;
        const m = u.pathname.match(/^\/(?:c|user)\/([^/?#]+)/);
        return m ? decodeURIComponent(m[1]).toLowerCase() : null;
    } catch { return null; }
}

// React to the user toggling `contextMenusEnabled`, `sidePanelEnabled`, or
// `channelNotifierEnabled` in settings without requiring a reload.
// storage.onChanged fires for every settings flush.
if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.rx_settings) return;
        rxSyncContextMenus().catch(() => {});
        rxSyncSidePanel().catch(() => {});
        rxSyncChannelNotifier().catch(() => {});
        const oldEnabled = changes.rx_settings.oldValue?.downloadManagerEnabled !== false;
        const newEnabled = changes.rx_settings.newValue?.downloadManagerEnabled !== false;
        if (oldEnabled !== newEnabled) {
            // Turning the manager off must not strand files it paused earlier;
            // online handling releases only RumbleX-owned resume jobs.
            if (!newEnabled) rxHandleNetworkOnline({ runArchive: false }).catch(() => {});
            else rxHandleCurrentNetworkState({ runArchive: false }).catch(() => {});
        }
    });
}

// v3.9.0 — Channel Notifier.
// chrome.alarms-driven background poll that fetches each watched channel's
// page, scans for the latest video ID and any live indicator, and fires a
// chrome.notifications toast (+ optional Discord webhook POST) when state
// changes. Honors:
//   - channelNotifierEnabled (master toggle, default OFF from v2.0 schema)
//   - watchedChannels (array of { url, name, lastSeenVideoId, isLive })
//   - channelNotifierIntervalMin (poll interval, MV3 floor 1 min)
//   - discordWebhookUrl (optional POST destination)
// All fetches scoped to the rumble.com host permissions we already declare.
const RX_NOTIFIER_ALARM = 'rx-channel-notifier';

async function rxGetSettings() {
    try {
        const data = await chrome.storage.local.get('rx_settings');
        return rxNormalizeSettings(data.rx_settings || {});
    } catch { return {}; }
}

// Every extension surface writes through this queue. A popup toggle, content
// feature, notifier update, and Options save can otherwise all read the same
// old object and let the last full-object write erase the others.
let rxSettingsWriteChain = Promise.resolve();
let rxSettingsMutationGeneration = 0;
const RX_SETTINGS_GENERATION_KEY = 'rx_settings_generation';
function rxQueueStorageMutation(commit) {
    rxSettingsWriteChain = rxSettingsWriteChain.then(commit, commit);
    return rxSettingsWriteChain;
}
const RX_SETTINGS_SNAPSHOT_BYTE_BUDGET = 64 * 1024 * 1024;
const RX_RESET_SNAPSHOT_KEYS = Object.freeze([
    'rx_archive_queue',
    'rx_download_diagnostics',
    'rx_download_recovery',
    'rx_welcome_seen',
]);
const RX_RESET_REMOVE_KEYS = Object.freeze([
    'rx_settings',
    'rx_popup_ui',
    'rx_rant_stats_mirror',
    'rx_probe_cache',
    'rx_settings_profiles',
    'rx_archive_queue',
    'rx_download_diagnostics',
    'rx_download_recovery',
    'rx_welcome_seen',
    'rx_activity_premigration',
    'rx_activity_migration_journal',
    'rx_pending_local_data_op',
]);

// A reset is a two-phase operation because page-local data lives on every
// Rumble origin. Finish the extension-owned half as soon as a service worker
// wakes, even when no Rumble tab is open. Background alarms and messages wait
// on this promise so stale settings or archive jobs cannot run in the gap.
let rxPendingResetStartupRecovery = null;
function rxEnsurePendingResetStartupRecovery() {
    if (rxPendingResetStartupRecovery) return rxPendingResetStartupRecovery;
    const recovery = rxQueueStorageMutation(async () => {
        const current = await rxReadPendingLocalDataOperation();
        const needsResetReplay = current?.source === 'reset'
            && current.clear === true
            && (current.extensionApplied !== true || current.archiveHandleApplied !== true);
        if (!needsResetReplay) return { ok: true, replayed: false };
        const result = await rxReplayPendingResetExtensionState(current);
        const next = {
            ...current,
            extensionApplied: true,
            archiveHandleApplied: true,
            lastAttemptAt: Date.now(),
            lastCleared: result.cleared,
        };
        await chrome.storage.local.set({ [PENDING_LOCAL_DATA_OP_KEY]: next });
        return {
            ok: true,
            replayed: true,
            cleared: result.cleared,
            generation: result.generation,
        };
    });
    const tracked = recovery.catch((error) => {
        if (rxPendingResetStartupRecovery === tracked) rxPendingResetStartupRecovery = null;
        throw error;
    });
    rxPendingResetStartupRecovery = tracked;
    return tracked;
}

rxEnsurePendingResetStartupRecovery().catch((error) => {
    console.warn('[RumbleX] interrupted reset recovery failed:', error);
});

function rxNextActivityGeneration(stored) {
    return Math.max(0, Number(stored?.[RXActivityStore.GENERATION_KEY]) || 0) + 1;
}

function rxNextSettingsGeneration(stored) {
    return Math.max(0, Number(stored?.[RX_SETTINGS_GENERATION_KEY]) || 0) + 1;
}

function rxAppendSettingsSnapshot(stored, reason, {
    settingsOverride,
    captureActivity = false,
    captureProfiles = false,
    captureResetData = false,
} = {}) {
    const current = rxNormalizeSettings(stored.rx_settings || {});
    const effective = { ...RXSettingsSchema.DEFAULTS, ...current };
    if (!effective.backupHistory) return { ok: false, reason: 'disabled' };
    const limit = Math.max(1, Number(effective.backupHistoryLimit) || 10);
    const snapshots = Array.isArray(stored.rx_settings_snapshots)
        ? stored.rx_settings_snapshots.slice()
        : [];
    const previousAt = snapshots.length
        ? Number.isFinite(snapshots.at(-1)?.at)
            ? snapshots.at(-1).at
            : Date.parse(snapshots.at(-1)?.at || '')
        : 0;
    const snapshot = {
        at: Math.max(Date.now(), Number.isFinite(previousAt) ? previousAt + 1 : 0),
        reason: typeof reason === 'string' ? reason.slice(0, 80) : 'manual',
        settings: rxNormalizeSettings(settingsOverride === undefined ? current : settingsOverride),
    };
    if (captureActivity) {
        snapshot.activity = RXActivityStore.collectStoredActivity(stored);
        snapshot.activityComplete = true;
    }
    if (captureProfiles) {
        snapshot.profiles = Array.isArray(stored.rx_settings_profiles)
            ? stored.rx_settings_profiles.slice()
            : [];
    }
    if (captureResetData) {
        snapshot.resetData = Object.fromEntries(RX_RESET_SNAPSHOT_KEYS
            .filter((key) => stored[key] !== undefined)
            .map((key) => [key, stored[key]]));
    }
    const snapshotBytes = new TextEncoder().encode(JSON.stringify(snapshot)).byteLength;
    if (snapshotBytes > RX_SETTINGS_SNAPSHOT_BYTE_BUDGET) {
        throw new Error('Snapshot exceeds the 64 MiB history budget');
    }
    snapshots.push(snapshot);
    while (snapshots.length > limit) snapshots.shift();
    let totalBytes = 0;
    const withinBudget = [];
    for (let index = snapshots.length - 1; index >= 0; index -= 1) {
        const entry = snapshots[index];
        const bytes = new TextEncoder().encode(JSON.stringify(entry)).byteLength;
        if (withinBudget.length > 0 && totalBytes + bytes > RX_SETTINGS_SNAPSHOT_BYTE_BUDGET) break;
        totalBytes += bytes;
        withinBudget.unshift(entry);
    }
    snapshots.splice(0, snapshots.length, ...withinBudget);
    return { ok: true, count: snapshots.length, at: snapshot.at, snapshot, snapshots };
}

function rxSnapshotReceipt(result) {
    if (!result || typeof result !== 'object') return null;
    if (!result.ok) return { ok: false, reason: result.reason || 'unavailable' };
    return {
        ok: true,
        count: Math.max(0, Number(result.count) || 0),
        at: result.at,
    };
}

function rxQueueSettingsWrite(data, {
    replace = false,
    preserveOmittedSecrets = false,
    snapshotReason = null,
    captureSnapshotActivity = false,
    returnSnapshot = false,
    extraValues = null,
    expectedGeneration = null,
    requireGeneration = false,
} = {}) {
    rxSettingsMutationGeneration += 1;
    const commit = async () => {
        let stored = await chrome.storage.local.get(snapshotReason
            ? null
            : ['rx_settings', RX_SETTINGS_GENERATION_KEY]);
        if (snapshotReason && captureSnapshotActivity) stored = await rxRecoverActivityMigration(stored);
        const currentGeneration = Math.max(0, Number(stored[RX_SETTINGS_GENERATION_KEY]) || 0);
        const hasExpectedGeneration = Number.isInteger(expectedGeneration) && expectedGeneration >= 0;
        if (requireGeneration
            && ((!hasExpectedGeneration && currentGeneration !== 0)
                || (hasExpectedGeneration && expectedGeneration !== currentGeneration))) {
            const error = new Error('Settings update was superseded by a replacement');
            error.code = 'superseded';
            error.generation = currentGeneration;
            throw error;
        }
        const current = stored.rx_settings || {};
        const candidate = replace ? { ...data } : { ...current, ...data };
        if (replace && preserveOmittedSecrets) {
            for (const key of RXSettingsSchema.SECRET_SETTING_KEYS) {
                if (!Object.hasOwn(data, key) && Object.hasOwn(current, key)) {
                    candidate[key] = current[key];
                }
            }
        }
        const next = rxNormalizeSettings(candidate);
        const values = { ...(extraValues || {}), rx_settings: next };
        if (replace) values[RX_SETTINGS_GENERATION_KEY] = rxNextSettingsGeneration(stored);
        let snapshot = null;
        if (snapshotReason) {
            snapshot = rxAppendSettingsSnapshot(stored, snapshotReason, {
                captureActivity: captureSnapshotActivity,
            });
            if (snapshot.ok) values.rx_settings_snapshots = snapshot.snapshots;
        }
        await chrome.storage.local.set(values);
        return returnSnapshot ? { settings: next, snapshot: rxSnapshotReceipt(snapshot) } : next;
    };
    rxSettingsWriteChain = rxSettingsWriteChain.then(commit, commit);
    return rxSettingsWriteChain;
}

function rxQueueSettingsBundleImport(data, {
    localData = null,
    mirrorProvided = false,
    mirror = null,
} = {}) {
    rxSettingsMutationGeneration += 1;
    return rxQueueStorageMutation(async () => {
        let stored = await chrome.storage.local.get(null);
        stored = await rxRecoverActivityMigration(stored);
        const current = stored.rx_settings || {};
        const candidate = { ...data };
        for (const key of RXSettingsSchema.SECRET_SETTING_KEYS) {
            if (!Object.hasOwn(data, key) && Object.hasOwn(current, key)) candidate[key] = current[key];
        }
        const settings = rxNormalizeSettings(candidate);
        const snapshot = rxAppendSettingsSnapshot(stored, 'pre-import-settings', {
            captureActivity: true,
        });
        const activityPayload = RXActivityStore.sanitizeLocalActivity(localData);
        const hasActivityBundle = Object.keys(activityPayload).length > 0 || mirrorProvided;
        const prepared = hasActivityBundle
            ? rxPrepareImportedActivity(stored, activityPayload, mirrorProvided, mirror)
            : null;
        const values = {
            rx_settings: settings,
            [RX_SETTINGS_GENERATION_KEY]: rxNextSettingsGeneration(stored),
            ...(snapshot.ok ? { rx_settings_snapshots: snapshot.snapshots } : {}),
            ...(prepared ? prepared.values : {}),
            ...(prepared ? {
                [RXActivityStore.GENERATION_KEY]: prepared.generation,
                [PENDING_LOCAL_DATA_OP_KEY]: prepared.pending,
            } : {}),
        };
        await chrome.storage.local.set(values);
        if (prepared && !prepared.pending) {
            try { await chrome.storage.local.remove(PENDING_LOCAL_DATA_OP_KEY); } catch {}
        }
        const broadcast = prepared
            ? await rxBroadcastPendingLocalDataOperation(prepared.pending, {
                action: 'setLocalData',
                data: prepared.payload,
                clear: prepared.pending?.clear === true,
                generation: prepared.generation,
                resetRantCache: prepared.mirrorProvided,
            })
            : { tabs: 0, pending: false, pendingId: null, pendingKeys: 0, pendingOrigins: 0 };
        return {
            settings,
            snapshot: rxSnapshotReceipt(snapshot),
            activity: {
                written: prepared ? Object.keys(prepared.payload).length : 0,
                mirrorWritten: prepared?.mirrorProvided === true,
                generation: prepared?.generation ?? null,
                tabs: broadcast.tabs,
                pending: broadcast.pending,
                pendingId: broadcast.pendingId,
                pendingKeys: broadcast.pendingKeys,
                pendingOrigins: broadcast.pendingOrigins,
            },
        };
    });
}

function rxQueueSettingsSnapshot(reason, options = {}) {
    const commit = async () => {
        let stored = await chrome.storage.local.get(null);
        if (options.captureActivity) stored = await rxRecoverActivityMigration(stored);
        const result = rxAppendSettingsSnapshot(stored, reason, options);
        if (result.ok) await chrome.storage.local.set({ rx_settings_snapshots: result.snapshots });
        return rxSnapshotReceipt(result);
    };
    rxSettingsWriteChain = rxSettingsWriteChain.then(commit, commit);
    return rxSettingsWriteChain;
}

function rxNormalizeArchiveQueueForSnapshot(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.jobs)) return value;
    const root = structuredClone(value);
    for (const job of root.jobs) {
        if (job?.status !== 'discovering'
            && !(job?.status === 'downloading' && !Number.isInteger(job.downloadId))) continue;
        job.status = 'pending';
        job.startedAt = null;
        job.downloadId = null;
        job.error = null;
        job.completedAt = null;
        job.recoveredFromStatus = null;
        job.recoveryReason = 'reset-interrupted';
    }
    return root;
}

async function rxReconcileRestoredArchiveState() {
    const stored = await chrome.storage.local.get(['rx_archive_queue', 'rx_download_recovery']);
    const queue = stored.rx_archive_queue && typeof stored.rx_archive_queue === 'object'
        && Array.isArray(stored.rx_archive_queue.jobs)
        ? structuredClone(stored.rx_archive_queue)
        : null;
    if (!queue) return;
    const recovery = stored.rx_download_recovery && typeof stored.rx_download_recovery === 'object'
        && Array.isArray(stored.rx_download_recovery.jobs)
        ? structuredClone(stored.rx_download_recovery)
        : null;
    const terminalIds = new Set();
    for (const job of queue.jobs) {
        if (job?.status !== 'downloading' || !Number.isInteger(job.downloadId)) continue;
        const item = await rxGetDownloadItem(job.downloadId);
        if (item?.state === 'complete') {
            const size = Number(item.fileSize || item.totalBytes || item.bytesReceived);
            terminalIds.add(job.downloadId);
            job.status = 'completed';
            job.completedAt = Date.now();
            job.downloadedBytes = Number.isFinite(size) && size > 0 ? size : null;
            job.downloadId = null;
            job.error = null;
            job.networkState = null;
            job.networkResumePending = false;
        } else if (!item || (item.state === 'interrupted' && !item.canResume)) {
            terminalIds.add(job.downloadId);
            job.status = 'pending';
            job.startedAt = null;
            job.downloadId = null;
            job.error = null;
            job.completedAt = null;
            job.networkState = null;
            job.networkResumePending = false;
            job.recoveryReason = 'restore-reconciled';
        }
    }
    if (recovery && terminalIds.size) {
        recovery.jobs = recovery.jobs.filter((job) => !terminalIds.has(job.downloadId));
    }
    await chrome.storage.local.set({
        rx_archive_queue: queue,
        ...(recovery ? { rx_download_recovery: recovery } : {}),
    });
}

function rxQueueSettingsReset() {
    rxSettingsMutationGeneration += 1;
    const commit = async () => {
        let stored = await chrome.storage.local.get(null);
        stored = await rxRecoverActivityMigration(stored);
        const archiveFolderHandle = globalThis.RxArchiveFsAccess?.getHandle
            ? await globalThis.RxArchiveFsAccess.getHandle()
            : null;
        const snapshotInput = {
            ...stored,
            rx_archive_queue: rxNormalizeArchiveQueueForSnapshot(stored.rx_archive_queue),
        };
        const snapshot = rxAppendSettingsSnapshot(snapshotInput, 'pre-reset-all-data', {
            captureActivity: true,
            captureProfiles: true,
            captureResetData: true,
        });
        // Snapshot construction and persistence happen before active work is
        // invalidated. If either fails, the reset changes nothing operational.
        if (snapshot.ok) await chrome.storage.local.set({ rx_settings_snapshots: snapshot.snapshots });

        rxArchiveNetworkGeneration++;
        rxDownloadRecoveryGeneration++;
        const pauseResult = await rxCallOpenOffscreen('pauseArchiveWrites').catch(() => ({ ok: false }));
        const activityKeys = Object.keys(stored)
            .filter((key) => key.startsWith(RXActivityStore.PREFIX));
        const activityGeneration = rxNextActivityGeneration(stored);
        const settingsGeneration = rxNextSettingsGeneration(stored);
        const pendingClear = {
            id: String(Date.now()) + '-' + Math.random().toString(16).slice(2),
            source: 'reset',
            createdAt: Date.now(),
            clear: true,
            data: null,
            keyCount: 0,
            targetOrigins: [...RX_CANONICAL_RUMBLE_ORIGINS],
            remainingOrigins: [...RX_CANONICAL_RUMBLE_ORIGINS],
            allTrustedOrigins: true,
            completedOrigins: [],
            extensionApplied: false,
            archiveHandleApplied: !archiveFolderHandle,
            activityGeneration,
            settingsGeneration,
        };
        const previousActivityMeta = stored[RXActivityStore.META_KEY];
        const cleanActivityMeta = {
            version: RXActivityStore.VERSION,
            migratedAt: Number.isFinite(previousActivityMeta?.migratedAt)
                ? previousActivityMeta.migratedAt
                : Date.now(),
            updatedAt: Date.now(),
            resetAt: Date.now(),
            keys: 0,
            origins: Array.isArray(previousActivityMeta?.origins)
                ? previousActivityMeta.origins.map(rxTrustedRumbleOrigin).filter(Boolean)
                : [],
            pageFingerprints: {},
            pageBaselines: {},
        };
        const removedKeys = [...new Set([...RX_RESET_REMOVE_KEYS, ...activityKeys])]
            .filter((key) => key !== PENDING_LOCAL_DATA_OP_KEY);
        try {
            // Commit the durable barriers before deleting data. Every queued
            // tab write behind this reset is rejected even if deletion fails.
            await chrome.storage.local.set({
                [RXActivityStore.GENERATION_KEY]: activityGeneration,
                [RX_SETTINGS_GENERATION_KEY]: settingsGeneration,
                [RXActivityStore.META_KEY]: cleanActivityMeta,
                [PENDING_LOCAL_DATA_OP_KEY]: pendingClear,
            });
            await chrome.storage.local.remove(removedKeys);
            // Mark extension storage committed before deleting the IndexedDB
            // folder handle. If this write fails, rollback can still restore
            // everything. The handle flag stays false until a best-effort
            // marker update, so a worker crash after deletion only causes an
            // idempotent retry instead of an unreported partial rollback.
            const committedPendingClear = {
                ...pendingClear,
                extensionApplied: true,
            };
            await chrome.storage.local.set({ [PENDING_LOCAL_DATA_OP_KEY]: committedPendingClear });
            if (archiveFolderHandle && globalThis.RxArchiveFsAccess?.deleteHandle) {
                await globalThis.RxArchiveFsAccess.deleteHandle();
            }
            const broadcastPendingClear = {
                ...pendingClear,
                extensionApplied: true,
                archiveHandleApplied: true,
            };
            const broadcast = await rxBroadcastPendingLocalDataOperation(broadcastPendingClear, {
                action: 'clearLocalData',
                generation: activityGeneration,
            });
            return {
                snapshot: rxSnapshotReceipt(snapshot),
                activityCleared: activityKeys.length,
                activityGeneration,
                settingsGeneration,
                archiveFolderCleared: !!archiveFolderHandle,
                pendingClearId: pendingClear.id,
                tabs: broadcast.tabs,
                cleared: broadcast.cleared,
                pendingClear: broadcast.pendingClear,
                pendingOrigins: broadcast.pendingOrigins,
            };
        } catch (error) {
            const rollbackKeys = [...new Set([
                ...removedKeys,
                RXActivityStore.META_KEY,
                RXActivityStore.GENERATION_KEY,
                RX_SETTINGS_GENERATION_KEY,
                'rx_settings_snapshots',
                PENDING_LOCAL_DATA_OP_KEY,
            ])];
            const restore = {};
            const remove = [];
            for (const key of rollbackKeys) {
                if (Object.hasOwn(stored, key)) restore[key] = stored[key];
                else remove.push(key);
            }
            if (stored.rx_archive_queue !== undefined) {
                restore.rx_archive_queue = rxNormalizeArchiveQueueForSnapshot(stored.rx_archive_queue);
            }
            let rollbackFailed = false;
            try {
                if (Object.keys(restore).length) await chrome.storage.local.set(restore);
                if (remove.length) await chrome.storage.local.remove(remove);
                if (stored.rx_archive_queue !== undefined) {
                    await rxReconcileRestoredArchiveState();
                }
            } catch (rollbackError) {
                rollbackFailed = true;
                console.error('[RumbleX] reset rollback failed:', rollbackError);
            }
            if (rollbackFailed) {
                error.partial = true;
                error.message = 'Reset failed and automatic recovery was incomplete: ' + (error?.message || error);
            }
            throw error;
        } finally {
            if (pauseResult?.wasPaused !== true) {
                await rxCallOpenOffscreen('resumeArchiveWrites').catch(() => ({ ok: false }));
            }
        }
    };
    return rxQueueStorageMutation(commit);
}

function rxQueueActivityWrite(data) {
    const commit = async () => {
        const setInput = data?.set;
        const removeInput = data?.remove;
        const requestedGeneration = Number.isInteger(data?.generation) && data.generation >= 0
            ? data.generation
            : null;
        let generationStored = await chrome.storage.local.get(null);
        generationStored = await rxRecoverActivityMigration(generationStored);
        const currentGeneration = Math.max(0, Number(generationStored[RXActivityStore.GENERATION_KEY]) || 0);
        if ((requestedGeneration === null && currentGeneration !== 0)
            || (requestedGeneration !== null && requestedGeneration !== currentGeneration)) {
            return { ok: false, reason: 'superseded', generation: currentGeneration };
        }
        const set = {};
        const remove = [];
        if (setInput !== undefined) {
            if (!setInput || typeof setInput !== 'object' || Array.isArray(setInput)) {
                throw new Error('Invalid activity write');
            }
            for (const [key, value] of Object.entries(setInput)) {
                if (!key.startsWith(RXActivityStore.PREFIX) || key.length > 300 || typeof value !== 'string') {
                    throw new Error('Invalid activity write');
                }
                set[key] = value;
            }
        }
        if (removeInput !== undefined) {
            if (!Array.isArray(removeInput) || removeInput.length > 10_000) {
                throw new Error('Invalid activity removal');
            }
            for (const key of removeInput) {
                if (typeof key !== 'string' || !key.startsWith(RXActivityStore.PREFIX) || key.length > 300) {
                    throw new Error('Invalid activity removal');
                }
                remove.push(key);
            }
        }
        const setKeys = Object.keys(set);
        const removeKeys = [...new Set(remove.filter((key) => !Object.hasOwn(set, key)))];
        if (setKeys.length) await chrome.storage.local.set(set);
        if (removeKeys.length) await chrome.storage.local.remove(removeKeys);
        return { ok: true, written: setKeys.length, removed: removeKeys.length, generation: currentGeneration };
    };
    rxSettingsWriteChain = rxSettingsWriteChain.then(commit, commit);
    return rxSettingsWriteChain;
}

function rxQueueActivityRollback() {
    const commit = async () => {
        const stored = await chrome.storage.local.get(null);
        const activityKeys = Object.keys(stored)
            .filter((key) => key.startsWith(RXActivityStore.PREFIX));
        await chrome.storage.local.set({
            [RXActivityStore.META_KEY]: {
                version: 0,
                hold: true,
                rolledBackAt: Date.now(),
            },
        });
        if (activityKeys.length) await chrome.storage.local.remove(activityKeys);
        const generation = rxNextActivityGeneration(stored);
        await chrome.storage.local.set({ [RXActivityStore.GENERATION_KEY]: generation });
        return { ok: true, removed: activityKeys.length, generation };
    };
    return rxQueueStorageMutation(commit);
}

function rxQueueRantMirrorUpdate(videoId, entry, maxVideos, expectedGeneration = null) {
    const commit = async () => {
        const stored = await chrome.storage.local.get([
            'rx_rant_stats_mirror',
            RXActivityStore.GENERATION_KEY,
        ]);
        const currentGeneration = Math.max(0, Number(stored[RXActivityStore.GENERATION_KEY]) || 0);
        const hasExpectedGeneration = Number.isInteger(expectedGeneration) && expectedGeneration >= 0;
        if ((!hasExpectedGeneration && currentGeneration !== 0)
            || (hasExpectedGeneration && expectedGeneration !== currentGeneration)) {
            return { ok: false, reason: 'superseded', generation: currentGeneration };
        }
        const current = stored.rx_rant_stats_mirror;
        const root = current && typeof current === 'object' && !Array.isArray(current)
            ? structuredClone(current)
            : { videos: {} };
        if (!root.videos || typeof root.videos !== 'object' || Array.isArray(root.videos)) root.videos = {};
        const previous = root.videos[videoId] && typeof root.videos[videoId] === 'object'
            ? root.videos[videoId]
            : {};
        root.videos[videoId] = {
            title: String(entry.title || previous.title || videoId).slice(0, 500),
            url: String(entry.url || previous.url || '').slice(0, 2048),
            lastTs: Number.isFinite(Number(entry.lastTs)) ? Number(entry.lastTs) : Date.now(),
            read: previous.read === true,
            rants: Array.isArray(entry.rants) ? entry.rants.slice(-200) : [],
        };
        const ids = Object.keys(root.videos);
        if (ids.length > maxVideos) {
            ids.map((id) => ({ id, ts: Number(root.videos[id]?.lastTs) || 0 }))
                .sort((a, b) => a.ts - b.ts)
                .slice(0, ids.length - maxVideos)
                .forEach(({ id }) => { delete root.videos[id]; });
        }
        await chrome.storage.local.set({ rx_rant_stats_mirror: root });
        return { ok: true, generation: currentGeneration };
    };
    rxSettingsWriteChain = rxSettingsWriteChain.then(commit, commit);
    return rxSettingsWriteChain;
}

function rxNormalizeRantMirror(value) {
    const source = value?.videos && typeof value.videos === 'object' && !Array.isArray(value.videos)
        ? value.videos
        : {};
    const videos = Object.entries(source)
        .filter(([id, entry]) => typeof id === 'string' && id.length <= 160
            && entry && typeof entry === 'object' && !Array.isArray(entry))
        .map(([id, entry]) => {
            const normalized = {
                title: String(entry.title || id).slice(0, 500),
                lastTs: Number.isFinite(Number(entry.lastTs)) ? Number(entry.lastTs) : 0,
            };
            if (Object.hasOwn(entry, 'url')) normalized.url = String(entry.url || '').slice(0, 2048);
            if (Object.hasOwn(entry, 'read')) normalized.read = entry.read === true;
            if (Array.isArray(entry.rants)) {
                normalized.rants = entry.rants
                    .filter((rant) => rant && typeof rant === 'object' && !Array.isArray(rant))
                    .slice(-200)
                    .map((rant) => ({
                    user: String(rant.user || '').slice(0, 200),
                    price: String(rant.price || '').slice(0, 80),
                    level: String(rant.level || '').slice(0, 40),
                    text: String(rant.text || '').slice(0, 4_000),
                    ts: Number.isFinite(Number(rant.ts)) ? Number(rant.ts) : 0,
                    ...(rant.kind === 'gift' ? {
                        kind: 'gift',
                        gifts: Math.max(1, Math.min(100_000, Number(rant.gifts) || 1)),
                    } : {}),
                    }));
            }
            return [id, normalized];
        })
        .sort(([, left], [, right]) => right.lastTs - left.lastTs)
        .slice(0, 30);
    return { videos: Object.fromEntries(videos) };
}

function rxQueueRantMirrorMutation(operation, videoId, read) {
    const commit = async () => {
        let stored = await chrome.storage.local.get(null);
        stored = await rxRecoverActivityMigration(stored);
        const current = stored.rx_rant_stats_mirror;
        const root = current && typeof current === 'object' && !Array.isArray(current)
            ? structuredClone(current)
            : { videos: {} };
        if (!root.videos || typeof root.videos !== 'object' || Array.isArray(root.videos)) root.videos = {};
        if (operation === 'clear') root.videos = {};
        else if (operation === 'remove') delete root.videos[videoId];
        else if (operation === 'read' && root.videos[videoId]) root.videos[videoId].read = read === true;
        else if (!['clear', 'remove', 'read'].includes(operation)) throw new Error('Invalid rant history operation');
        const bumpsGeneration = operation === 'clear' || operation === 'remove';
        const generation = Math.max(0, Number(stored[RXActivityStore.GENERATION_KEY]) || 0)
            + (bumpsGeneration ? 1 : 0);
        const clearedActivityKeys = operation === 'clear'
            ? Object.keys(stored).filter((key) => key.startsWith(RXActivityStore.PREFIX + 'rx_rants_'))
            : operation === 'remove' && videoId
                ? [RXActivityStore.PREFIX + 'rx_rants_' + videoId]
                : [];
        const cleanupKeys = operation === 'remove' && videoId ? ['rx_rants_' + videoId] : [];
        const pending = bumpsGeneration
            ? rxPreparePageCleanupOperation(stored, {
                source: 'rant-' + operation,
                clear: operation === 'clear',
                cleanupKeys,
                activityGeneration: generation,
            })
            : null;
        await chrome.storage.local.set({
            rx_rant_stats_mirror: root,
            ...Object.fromEntries(clearedActivityKeys.map((key) => [key, '[]'])),
            ...(bumpsGeneration ? { [RXActivityStore.GENERATION_KEY]: generation } : {}),
            ...(pending ? { [PENDING_LOCAL_DATA_OP_KEY]: pending } : {}),
        });
        if (bumpsGeneration) {
            await rxBroadcastPendingLocalDataOperation(pending, {
                action: 'setLocalData',
                data: Object.fromEntries(cleanupKeys.map((key) => [key, ''])),
                clear: operation === 'clear',
                generation,
                resetRantCache: true,
            });
        }
        if (clearedActivityKeys.length) {
            try { await chrome.storage.local.remove(clearedActivityKeys); } catch {}
        }
        return {
            ok: true,
            generation,
            activityCleared: clearedActivityKeys.length,
            pendingId: pending?.id || null,
        };
    };
    rxSettingsWriteChain = rxSettingsWriteChain.then(commit, commit);
    return rxSettingsWriteChain;
}

function rxQueueSettingsRestore(indexOrAt) {
    rxSettingsMutationGeneration += 1;
    const commit = async () => {
        let stored = await chrome.storage.local.get(null);
        stored = await rxRecoverActivityMigration(stored);
        const snapshots = Array.isArray(stored.rx_settings_snapshots)
            ? stored.rx_settings_snapshots.slice()
            : [];
        const byIndex = Number.isInteger(indexOrAt) && indexOrAt >= 0 && indexOrAt < snapshots.length;
        const target = byIndex
            ? snapshots[indexOrAt]
            : snapshots.find((item) => item?.at === indexOrAt);
        if (!target) return { ok: false, reason: 'not-found' };

        const restoresActivity = target.activity && typeof target.activity === 'object';
        const restoresActivityExactly = restoresActivity && target.activityComplete === true;
        const restoresResetData = target.resetData && typeof target.resetData === 'object';
        const preRestore = rxAppendSettingsSnapshot(stored, 'pre-restore', {
            captureActivity: restoresActivity,
            captureProfiles: Array.isArray(target.profiles),
            captureResetData: restoresResetData,
        });
        const values = {
            rx_settings: rxNormalizeSettings(target.settings || {}),
            [RX_SETTINGS_GENERATION_KEY]: rxNextSettingsGeneration(stored),
        };
        if (preRestore.ok) values.rx_settings_snapshots = preRestore.snapshots;
        if (Array.isArray(target.profiles)) {
            values.rx_settings_profiles = target.profiles.slice(0, 25)
                .filter((profile) => profile && typeof profile === 'object')
                .map((profile) => ({
                    id: String(profile.id || '').slice(0, 160),
                    name: String(profile.name || '').slice(0, 60),
                    createdAt: Number(profile.createdAt) || Date.now(),
                    settings: rxNormalizeSettings(profile.settings || {}),
                }))
                .filter((profile) => profile.id && profile.name);
        }

        let removeActivity = [];
        if (restoresActivity) {
            const currentActivity = RXActivityStore.collectStoredActivity(stored);
            const restoredActivity = RXActivityStore.collectStoredActivity(target.activity);
            Object.assign(values, restoredActivity);
            if (restoresActivityExactly) {
                removeActivity = Object.keys(currentActivity)
                    .filter((key) => !Object.hasOwn(restoredActivity, key));
            }
        }

        let removeResetData = [];
        if (restoresResetData) {
            const restoredResetData = Object.fromEntries(RX_RESET_SNAPSHOT_KEYS
                .filter((key) => target.resetData[key] !== undefined)
                .map((key) => [key, target.resetData[key]]));
            Object.assign(values, restoredResetData);
            removeResetData = RX_RESET_SNAPSHOT_KEYS
                .filter((key) => stored[key] !== undefined && !Object.hasOwn(restoredResetData, key));
        }

        const activityGeneration = restoresActivity ? rxNextActivityGeneration(stored) : null;
        let pendingActivityCleanup = null;
        if (activityGeneration !== null) {
            values[RXActivityStore.GENERATION_KEY] = activityGeneration;
            const restoredPending = values[PENDING_LOCAL_DATA_OP_KEY];
            pendingActivityCleanup = rxPreparePageCleanupOperation(stored, {
                source: 'snapshot-restore',
                clear: true,
                activityGeneration,
                existingOverride: restoredPending && typeof restoredPending === 'object'
                    ? restoredPending
                    : null,
                preserveExistingIdentity: !!restoredPending?.id,
            });
            values[PENDING_LOCAL_DATA_OP_KEY] = pendingActivityCleanup;
        }
        const remove = [...new Set([...removeActivity, ...removeResetData])]
            .filter((key) => !Object.hasOwn(values, key));
        const touched = [...new Set([...Object.keys(values), ...remove])];
        let pauseResult = null;
        if (restoresResetData) {
            rxArchiveNetworkGeneration++;
            rxDownloadRecoveryGeneration++;
            pauseResult = await rxCallOpenOffscreen('pauseArchiveWrites').catch(() => ({ ok: false }));
        }
        try {
            await chrome.storage.local.set(values);
            if (remove.length) await chrome.storage.local.remove(remove);
            if (restoresResetData && values.rx_archive_queue) {
                await rxReconcileRestoredArchiveState();
            }
            let broadcast = null;
            if (pendingActivityCleanup) {
                broadcast = await rxBroadcastPendingLocalDataOperation(pendingActivityCleanup, {
                    action: 'setLocalData',
                    data: {},
                    clear: true,
                    generation: activityGeneration,
                    resetRantCache: true,
                });
            }
            return {
                ok: true,
                restored: { at: target.at, reason: target.reason },
                snapshot: rxSnapshotReceipt(preRestore),
                activityGeneration,
                pendingOrigins: broadcast?.pendingOrigins || 0,
            };
        } catch (error) {
            const rollback = {};
            const rollbackRemove = [];
            for (const key of touched) {
                if (Object.hasOwn(stored, key)) rollback[key] = stored[key];
                else rollbackRemove.push(key);
            }
            if (stored.rx_archive_queue !== undefined) {
                rollback.rx_archive_queue = rxNormalizeArchiveQueueForSnapshot(stored.rx_archive_queue);
            }
            let rollbackFailed = false;
            try {
                if (Object.keys(rollback).length) await chrome.storage.local.set(rollback);
                if (rollbackRemove.length) await chrome.storage.local.remove(rollbackRemove);
                if (stored.rx_archive_queue !== undefined) {
                    await rxReconcileRestoredArchiveState();
                }
            } catch (rollbackError) {
                rollbackFailed = true;
                console.error('[RumbleX] snapshot restore rollback failed:', rollbackError);
            }
            if (rollbackFailed) {
                error.partial = true;
                error.message = 'Snapshot restore failed and automatic recovery was incomplete: ' + (error?.message || error);
            }
            throw error;
        } finally {
            if (pauseResult && pauseResult.wasPaused !== true) {
                await rxCallOpenOffscreen('resumeArchiveWrites').catch(() => ({ ok: false }));
            }
        }
    };
    rxSettingsWriteChain = rxSettingsWriteChain.then(commit, commit);
    return rxSettingsWriteChain;
}

function rxListProfiles() {
    return rxSettingsWriteChain.catch(() => {}).then(async () => {
        const data = await chrome.storage.local.get(['rx_settings_profiles', 'rx_settings']);
        const profiles = Array.isArray(data.rx_settings_profiles) ? data.rx_settings_profiles : [];
        return {
            ok: true,
            profiles: profiles.map((profile) => ({
                id: profile.id,
                name: profile.name,
                createdAt: profile.createdAt,
            })),
            activeId: (data.rx_settings || {}).activeProfileId || 'default',
        };
    });
}

function rxQueueProfileSave(name) {
    return rxQueueStorageMutation(async () => {
        const data = await chrome.storage.local.get(['rx_settings_profiles', 'rx_settings']);
        const profiles = Array.isArray(data.rx_settings_profiles) ? data.rx_settings_profiles.slice() : [];
        if (profiles.some((profile) => profile.name === name)) return { ok: false, reason: 'duplicate-name' };
        if (profiles.length >= 25) return { ok: false, reason: 'cap-reached' };
        const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        profiles.push({
            id,
            name,
            createdAt: Date.now(),
            settings: rxNormalizeSettings(data.rx_settings || {}),
        });
        await chrome.storage.local.set({ rx_settings_profiles: profiles });
        return { ok: true, id, count: profiles.length };
    });
}

function rxQueueProfileSwitch(id) {
    rxSettingsMutationGeneration += 1;
    return rxQueueStorageMutation(async () => {
        const stored = await chrome.storage.local.get(null);
        const profiles = Array.isArray(stored.rx_settings_profiles) ? stored.rx_settings_profiles : [];
        const target = profiles.find((profile) => profile.id === id);
        if (!target) return { ok: false, reason: 'not-found' };
        const next = rxNormalizeSettings({ ...target.settings, activeProfileId: target.id });
        const snapshot = rxAppendSettingsSnapshot(stored, 'pre-profile-switch');
        const values = {
            rx_settings: next,
            [RX_SETTINGS_GENERATION_KEY]: rxNextSettingsGeneration(stored),
        };
        if (snapshot.ok) values.rx_settings_snapshots = snapshot.snapshots;
        await chrome.storage.local.set(values);
        return { ok: true, name: target.name };
    });
}

function rxQueueProfileDelete(id) {
    return rxQueueStorageMutation(async () => {
        const stored = await chrome.storage.local.get(null);
        const all = Array.isArray(stored.rx_settings_profiles) ? stored.rx_settings_profiles : [];
        const removed = all.find((profile) => profile.id === id);
        if (!removed) return { ok: false, reason: 'not-found' };
        let snapshot;
        try {
            snapshot = rxAppendSettingsSnapshot(stored,
                'pre-profile-delete: ' + String(removed.name || id),
                { captureProfiles: true });
        } catch (error) {
            if (!String(error?.message || error).includes('64 MiB history budget')) throw error;
            snapshot = { ok: false, reason: 'too-large' };
        }
        const profiles = all.filter((profile) => profile.id !== id);
        const values = { rx_settings_profiles: profiles };
        if (snapshot.ok) values.rx_settings_snapshots = snapshot.snapshots;
        await chrome.storage.local.set(values);
        return {
            ok: true,
            count: profiles.length,
            name: removed.name || '',
            undo: {
                id: removed.id,
                name: removed.name,
                createdAt: removed.createdAt,
                settings: removed.settings,
            },
            snapshotted: snapshot.ok,
        };
    });
}

function rxQueueProfileRestore(profile) {
    return rxQueueStorageMutation(async () => {
        const data = await chrome.storage.local.get('rx_settings_profiles');
        const profiles = Array.isArray(data.rx_settings_profiles) ? data.rx_settings_profiles.slice() : [];
        if (profiles.some((item) => item.id === profile.id)) return { ok: false, reason: 'already-exists' };
        if (profiles.length >= 25) return { ok: false, reason: 'cap-reached' };
        profiles.push({
            id: String(profile.id).slice(0, 160),
            name: String(profile.name || 'Restored profile').slice(0, 60),
            createdAt: Number(profile.createdAt) || Date.now(),
            settings: rxNormalizeSettings(profile.settings || {}),
        });
        await chrome.storage.local.set({ rx_settings_profiles: profiles });
        return { ok: true, count: profiles.length };
    });
}

function rxActivityValueFingerprint(value) {
    const text = String(value);
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        first = Math.imul(first ^ code, 0x01000193) >>> 0;
        second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
    }
    return `${text.length}:${first.toString(16)}:${second.toString(16)}`;
}

async function rxRecoverActivityMigration(stored) {
    const journal = stored?.[RXActivityStore.MIGRATION_JOURNAL_KEY];
    if (!journal || typeof journal !== 'object' || !journal.id) return stored;
    const meta = stored[RXActivityStore.META_KEY];
    if (meta?.lastTransactionId === journal.id) {
        await chrome.storage.local.remove(RXActivityStore.MIGRATION_JOURNAL_KEY);
        return chrome.storage.local.get(null);
    }
    const before = journal.beforeActivity && typeof journal.beforeActivity === 'object'
        ? journal.beforeActivity
        : {};
    const currentKeys = Object.keys(stored)
        .filter((key) => key.startsWith(RXActivityStore.PREFIX));
    const restore = Object.fromEntries(Object.entries(before)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => [RXActivityStore.PREFIX + key, value]));
    const remove = currentKeys.filter((storageKey) => (
        !Object.hasOwn(before, storageKey.slice(RXActivityStore.PREFIX.length))
    ));
    if (Object.keys(restore).length) await chrome.storage.local.set(restore);
    if (remove.length) await chrome.storage.local.remove(remove);
    if (journal.hadMeta) await chrome.storage.local.set({ [RXActivityStore.META_KEY]: journal.beforeMeta });
    else await chrome.storage.local.remove(RXActivityStore.META_KEY);
    await chrome.storage.local.remove(RXActivityStore.MIGRATION_JOURNAL_KEY);
    return chrome.storage.local.get(null);
}

function rxQueueActivityMigration(data, origin, expectedGeneration = null, removed = [], expectedBarrierId = '') {
    const commit = async () => {
        const pageData = Object.fromEntries(Object.entries(data || {}).filter(([key, value]) => (
            typeof key === 'string'
            && key.length <= 240
            && key.startsWith('rx_')
            && typeof value === 'string'
        )));
        const removedKeys = [...new Set((Array.isArray(removed) ? removed : [])
            .filter((key) => RXActivityStore.isLocalActivityKey(key) && !Object.hasOwn(pageData, key)))];
        let stored = await chrome.storage.local.get(null);
        stored = await rxRecoverActivityMigration(stored);
        const currentGeneration = Math.max(0, Number(stored[RXActivityStore.GENERATION_KEY]) || 0);
        const currentBarrierId = typeof stored[PENDING_LOCAL_DATA_OP_KEY]?.id === 'string'
            ? stored[PENDING_LOCAL_DATA_OP_KEY].id
            : '';
        const hasExpectedGeneration = Number.isInteger(expectedGeneration) && expectedGeneration >= 0;
        if (String(expectedBarrierId || '') !== currentBarrierId
            || (!hasExpectedGeneration && currentGeneration !== 0)
            || (hasExpectedGeneration && expectedGeneration !== currentGeneration)) {
            return { ok: false, reason: 'superseded', generation: currentGeneration };
        }
        const meta = stored[RXActivityStore.META_KEY];
        if (meta?.hold) return { ok: false, reason: 'held' };

        const current = Object.fromEntries(Object.entries(stored)
            .filter(([key, value]) => key.startsWith(RXActivityStore.PREFIX) && typeof value === 'string')
            .map(([key, value]) => [key.slice(RXActivityStore.PREFIX.length), value]));
        const committed = meta?.version === RXActivityStore.VERSION;
        const knownOrigins = committed && Array.isArray(meta.origins) ? meta.origins : [];
        const originAlreadyMigrated = knownOrigins.includes(origin);
        const merged = committed ? { ...current } : {};
        const previousSnapshot = stored[RXActivityStore.PREMIGRATION_KEY];
        const hasPerOriginSnapshot = previousSnapshot?.dataByOrigin
            && typeof previousSnapshot.dataByOrigin === 'object';
        const originSnapshot = previousSnapshot?.dataByOrigin?.[origin]
            || (!hasPerOriginSnapshot && knownOrigins.length <= 1 ? previousSnapshot?.data : null)
            || {};
        const storedFingerprints = meta?.pageFingerprints && typeof meta.pageFingerprints === 'object'
            ? meta.pageFingerprints
            : {};
        const storedBaselines = meta?.pageBaselines && typeof meta.pageBaselines === 'object'
            ? meta.pageBaselines
            : {};
        const originFingerprints = storedFingerprints[origin]
            && typeof storedFingerprints[origin] === 'object'
            ? storedFingerprints[origin]
            : {};
        const originBaseline = storedBaselines[origin]
            && typeof storedBaselines[origin] === 'object'
            ? storedBaselines[origin]
            : originSnapshot;
        const nextOriginFingerprints = { ...originFingerprints };
        const nextOriginBaseline = { ...originBaseline };

        for (const [key, value] of Object.entries(pageData)) {
            const fingerprint = rxActivityValueFingerprint(value);
            const baseline = originFingerprints[key]
                || (typeof originBaseline[key] === 'string'
                    ? rxActivityValueFingerprint(originBaseline[key])
                    : null);
            const hasBaselineRecord = Object.hasOwn(originFingerprints, key)
                || Object.hasOwn(originBaseline, key);
            const unchangedPageCopy = originAlreadyMigrated
                && Object.hasOwn(current, key)
                // Old metadata may not have a baseline at all. Preserve its
                // duplicate-avoidance behavior, but an explicit null means
                // this origin deleted the key and has now recreated it.
                && (!hasBaselineRecord || (baseline !== null && baseline === fingerprint));
            const reconciled = !committed
                ? value
                : unchangedPageCopy
                    ? current[key]
                    : RXActivityStore.reconcileValue(
                        current[key],
                        value,
                        typeof originBaseline[key] === 'string' ? originBaseline[key] : undefined,
                    );
            if (reconciled === undefined) delete merged[key];
            else merged[key] = reconciled;
            nextOriginFingerprints[key] = fingerprint;
            nextOriginBaseline[key] = value;
        }
        for (const key of removedKeys) {
            if (!committed || !originAlreadyMigrated || typeof originBaseline[key] !== 'string') continue;
            const reconciled = RXActivityStore.reconcileValue(current[key], undefined, originBaseline[key]);
            if (reconciled === undefined) delete merged[key];
            else merged[key] = reconciled;
            delete nextOriginFingerprints[key];
            nextOriginBaseline[key] = null;
        }

        const dataByOrigin = previousSnapshot?.dataByOrigin && typeof previousSnapshot.dataByOrigin === 'object'
            ? { ...previousSnapshot.dataByOrigin }
            : {};
        const shouldCaptureOrigin = Object.keys(pageData).length > 0
            && (!originAlreadyMigrated || !Object.hasOwn(dataByOrigin, origin));
        if (shouldCaptureOrigin) dataByOrigin[origin] = pageData;
        const legacyData = previousSnapshot?.data && typeof previousSnapshot.data === 'object'
            ? (shouldCaptureOrigin ? { ...previousSnapshot.data, ...pageData } : previousSnapshot.data)
            : { ...pageData };
        const origins = [...new Set([...knownOrigins, origin])];
        const transactionId = String(Date.now()) + '-' + Math.random().toString(16).slice(2);
        const nextMeta = {
            version: RXActivityStore.VERSION,
            migratedAt: committed && Number.isFinite(meta.migratedAt) ? meta.migratedAt : Date.now(),
            updatedAt: Date.now(),
            keys: Object.keys(merged).length,
            origins,
            lastTransactionId: transactionId,
            pageFingerprints: {
                ...storedFingerprints,
                [origin]: nextOriginFingerprints,
            },
            pageBaselines: {
                ...storedBaselines,
                [origin]: nextOriginBaseline,
            },
        };
        if (shouldCaptureOrigin || (!previousSnapshot && Object.keys(pageData).length > 0)) {
            await chrome.storage.local.set({
                [RXActivityStore.PREMIGRATION_KEY]: {
                    at: Number.isFinite(previousSnapshot?.at) ? previousSnapshot.at : Date.now(),
                    updatedAt: Date.now(),
                    version: RXActivityStore.VERSION,
                    data: legacyData,
                    dataByOrigin,
                },
            });
        }

        const copies = Object.fromEntries(Object.entries(merged)
            .map(([key, value]) => [RXActivityStore.PREFIX + key, value]));
        const stale = Object.keys(current)
            .filter((key) => !Object.hasOwn(merged, key))
            .map((key) => RXActivityStore.PREFIX + key);
        await chrome.storage.local.set({
            [RXActivityStore.MIGRATION_JOURNAL_KEY]: {
                id: transactionId,
                at: Date.now(),
                origin,
                beforeActivity: current,
                hadMeta: meta !== undefined,
                beforeMeta: meta === undefined ? null : meta,
            },
        });
        if (Object.keys(copies).length) await chrome.storage.local.set(copies);
        if (stale.length) await chrome.storage.local.remove(stale);

        const verifyKeys = Object.keys(merged).map((key) => RXActivityStore.PREFIX + key);
        const verified = await chrome.storage.local.get([...verifyKeys, ...stale]);
        const mismatched = Object.entries(merged).filter(([key, value]) => (
            verified[RXActivityStore.PREFIX + key] !== value
        ));
        const staleRemaining = stale.filter((key) => verified[key] !== undefined);
        const rollbackCopies = async () => {
            const restore = Object.fromEntries(Object.entries(current)
                .map(([key, value]) => [RXActivityStore.PREFIX + key, value]));
            const remove = Object.keys(merged)
                .filter((key) => !Object.hasOwn(current, key))
                .map((key) => RXActivityStore.PREFIX + key);
            if (Object.keys(restore).length) await chrome.storage.local.set(restore);
            if (remove.length) await chrome.storage.local.remove(remove);
            if (meta === undefined) await chrome.storage.local.remove(RXActivityStore.META_KEY);
            else await chrome.storage.local.set({ [RXActivityStore.META_KEY]: meta });
            await chrome.storage.local.remove(RXActivityStore.MIGRATION_JOURNAL_KEY);
        };
        if (mismatched.length || staleRemaining.length) {
            await rollbackCopies();
            if (!committed) {
                await chrome.storage.local.set({
                    [RXActivityStore.META_KEY]: {
                        version: 0,
                        failedAt: Date.now(),
                        reason: 'verify',
                        mismatched: mismatched.length + staleRemaining.length,
                    },
                });
            }
            return {
                ok: false,
                reason: 'verify',
                mismatched: [
                    ...mismatched.map(([key]) => key),
                    ...staleRemaining.map((key) => key.slice(RXActivityStore.PREFIX.length)),
                ],
            };
        }

        await chrome.storage.local.set({ [RXActivityStore.META_KEY]: nextMeta });
        const verifiedMeta = (await chrome.storage.local.get(RXActivityStore.META_KEY))[RXActivityStore.META_KEY];
        if (verifiedMeta?.version !== RXActivityStore.VERSION
            || !Array.isArray(verifiedMeta.origins)
            || !verifiedMeta.origins.includes(origin)
            || verifiedMeta.lastTransactionId !== transactionId) {
            await rollbackCopies();
            return { ok: false, reason: 'verify-meta', mismatched: [] };
        }

        await chrome.storage.local.remove(RXActivityStore.MIGRATION_JOURNAL_KEY);

        return {
            ok: true,
            already: committed && originAlreadyMigrated,
            keys: Object.keys(merged).length,
            meta: nextMeta,
        };
    };
    rxSettingsWriteChain = rxSettingsWriteChain.then(commit, commit);
    return rxSettingsWriteChain;
}

async function rxSetSettings(patch) {
    return rxQueueSettingsWrite(patch);
}

async function rxSyncChannelNotifier() {
    if (!chrome.alarms) return;
    const s = await rxGetSettings();
    const enabled = s.channelNotifierEnabled === true;
    const intervalMin = Math.max(1, Number(s.channelNotifierIntervalMin) || 30);
    try {
        await chrome.alarms.clear(RX_NOTIFIER_ALARM);
        if (enabled && Array.isArray(s.watchedChannels) && s.watchedChannels.length > 0) {
            await chrome.alarms.create(RX_NOTIFIER_ALARM, { periodInMinutes: intervalMin });
        }
    } catch (e) {
        console.warn('[RumbleX] alarms sync failed:', e);
    }
}

// Parse a channel page HTML and return { latestVideoId, isLive, title }.
// Conservative: matches `data-video-id="..."` for the first video in the
// channel grid + scans for the "LIVE" badge SVG / class hooks. Won't grab
// titles when Rumble changes its markup — that's intentional, we just
// detect "something new" and let the notification say so.
// Channel pages carry their listing in one or more `<script>` blocks shaped
// `{"items":[...],"analytics":{...}}`, one entry per video with `id`, `title`,
// `relative_url`, `upload_date` and a boolean `live`. This is the same data the
// grid renders from, and it survives markup changes that break class-name
// matching. Shape verified against live channel pages on 2026-08-19; the same
// migration broke yt-dlp's channel extractor (yt-dlp #16904).
function rxParseChannelItems(html, channelPath) {
    const items = [];
    for (const match of String(html || '').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
        const body = match[1];
        if (!body.includes('"items"')) continue;
        try {
            const parsed = JSON.parse(body.trim());
            if (Array.isArray(parsed?.items)) items.push(...parsed.items);
        } catch { /* not every script carrying the word is JSON */ }
    }
    const videos = items.filter((item) => item?.object_type === 'video' && item?.relative_url);
    if (!videos.length) return null;

    // A channel page also embeds unrelated rails (the "live now" sidebar), so
    // keep only entries this channel actually published. If the filter empties
    // the list the page shape is one we have not seen, and a blanked notifier
    // is worse than a slightly loose match.
    const path = String(channelPath || '').toLowerCase();
    const owned = path
        ? videos.filter((item) => String(item?.by?.relative_url || '').toLowerCase() === path)
        : videos;
    const scoped = owned.length ? owned : videos;

    const stamp = (item) => {
        const value = Date.parse(item?.upload_date || '');
        return Number.isFinite(value) ? value : -1;
    };
    // Newest-first is the observed order, but upload_date is authoritative and
    // costs nothing to honour.
    const latest = scoped.reduce((best, item) => (stamp(item) > stamp(best) ? item : best), scoped[0]);
    const live = scoped.find((item) => item?.live === true) || null;
    return { videos: scoped, latest, live };
}

function rxItemToEvent(item) {
    if (!item) return null;
    const url = rxSafeRumbleUrl(new URL(item.relative_url, 'https://rumble.com/').href);
    if (!url) return null;
    return {
        id: item.id != null ? String(item.id) : null,
        url,
        title: typeof item.title === 'string' ? item.title.slice(0, 300) : '',
        viewers: Number.isFinite(item.watching_now) ? item.watching_now : null,
    };
}

// Returns { latestVideoId, isLive, latest, live }. The `latest`/`live` entries
// carry the watch URL so a notification can open the stream itself rather than
// the channel page. Falls back to the old class-name scan when the JSON block
// is absent, because some page shapes still only offer that.
function rxParseChannelHtml(html, channelUrl) {
    try {
        let channelPath = '';
        try { channelPath = new URL(channelUrl).pathname; } catch { channelPath = ''; }
        const parsed = rxParseChannelItems(html, channelPath);
        if (parsed) {
            const latest = rxItemToEvent(parsed.latest);
            const live = rxItemToEvent(parsed.live);
            return {
                latestVideoId: latest?.id || null,
                isLive: !!live,
                latest,
                live,
            };
        }
        // The very first data-video-id on the page is the latest video on
        // a channel page (Rumble orders newest-first by default).
        const idMatch = html.match(/data-video-id="([^"]+)"/);
        const isLive = /class="[^"]*\bvideostream__status--live\b/.test(html)
            || /class="[^"]*\bchannel__live-on-air\b/.test(html)
            || /aria-label="[^"]*Live[^"]*"/.test(html);
        return {
            latestVideoId: idMatch ? idMatch[1] : null,
            isLive,
            latest: null,
            live: null,
        };
    } catch { return { latestVideoId: null, isLive: false, latest: null, live: null }; }
}

// Numeric dotted-version comparison. Returns >0 when `a` is newer than `b`,
// <0 when older, 0 when equal. Missing or non-numeric segments count as 0, so
// "3.40" and "3.40.0" compare equal and a malformed tag never reads as newer.
function rxCompareVersions(a, b) {
    const parse = (value) => String(value || '')
        .trim()
        .replace(/^v/i, '')
        .split('.')
        .map((part) => Number.parseInt(part, 10));
    const left = parse(a);
    const right = parse(b);
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i += 1) {
        const l = Number.isFinite(left[i]) ? left[i] : 0;
        const r = Number.isFinite(right[i]) ? right[i] : 0;
        if (l !== r) return l - r;
    }
    return 0;
}

async function rxPostDiscordWebhook(url, payload) {
    // Defense in depth: settings-schema.js already rejects non-Discord webhook
    // destinations, but storage can outlive the code that wrote it, so never
    // POST followed-channel activity to an endpoint this boundary hasn't cleared.
    const safeUrl = RumbleXSettingsSchema.safeWebhookUrl(url);
    if (!safeUrl) {
        console.warn('[RumbleX] discord webhook POST blocked: destination failed validation');
        return false;
    }
    try {
        const resp = await fetch(safeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return resp.ok;
    } catch (e) {
        console.warn('[RumbleX] discord webhook POST failed:', e);
        return false;
    }
}

function rxSafeRumbleUrl(value) {
    if (typeof value !== 'string') return null;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' && /(^|\.)rumble\.com$/i.test(parsed.hostname)
            ? parsed.href
            : null;
    } catch { return null; }
}

// v3.58.0 — Notification targets have to outlive the service worker.
//
// Chrome evicts an MV3 service worker after roughly 30 seconds idle, and the
// notifier fires from a chrome.alarms period, so the worker is almost always
// gone by the time someone opens the notification centre and clicks. Holding
// the target URL only in a module-scope Map meant onClicked read `undefined`
// and returned without a tab, an error, or any other sign — the whole
// notify-click-open path silently did nothing on Chrome. Firefox MV2 has a
// persistent background page and never showed the bug, which is why testing
// there hid it.
//
// chrome.storage.session is the right home: it is cleared when the browser
// session ends, which is exactly as long as a notification can still be
// clicked, and it is not exposed to content scripts at the default access
// level. The Map stays as a same-wakeup fast path, never as the source of
// truth. Where session storage is unavailable (Firefox before 115, whose
// background page is persistent anyway) the Map alone still answers.
const RX_NOTIFICATION_TARGETS_KEY = 'rx_notification_targets';
const RX_NOTIFICATION_TARGETS_MAX = 100;
const RX_NOTIFICATION_TARGET_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const rxNotificationUrlMap = new Map();
let rxNotificationTargetQueue = Promise.resolve();

function rxSessionStorageArea() {
    return chrome.storage?.session || null;
}

// Drop expired, malformed and off-site entries, then keep only the newest
// RX_NOTIFICATION_TARGETS_MAX. Runs on write and on read, so a stored map that
// outlived the code that wrote it cannot smuggle a non-Rumble destination into
// chrome.tabs.create.
function rxPruneNotificationTargets(stored, now) {
    const kept = Object.entries(stored && typeof stored === 'object' ? stored : {})
        .map(([id, entry]) => {
            if (!id || !entry || typeof entry !== 'object') return null;
            const at = Number(entry.at);
            if (!Number.isFinite(at) || now - at >= RX_NOTIFICATION_TARGET_TTL_MS) return null;
            const url = rxSafeRumbleUrl(entry.url);
            return url ? [id, { url, at }] : null;
        })
        .filter(Boolean)
        .sort((a, b) => a[1].at - b[1].at)
        .slice(-RX_NOTIFICATION_TARGETS_MAX);
    return Object.fromEntries(kept);
}

// The Map is subject to the same TTL and cap as the store. Without this a
// notifier pass that fires more than the cap, or an entry older than the TTL,
// would be refused by the store and then served out of worker memory anyway,
// so "bounded in count and age" would only be true of half the lookup.
function rxPruneNotificationMap(now = Date.now()) {
    for (const [id, entry] of rxNotificationUrlMap) {
        if (!entry || !Number.isFinite(entry.at) || now - entry.at >= RX_NOTIFICATION_TARGET_TTL_MS) {
            rxNotificationUrlMap.delete(id);
        }
    }
    // Map iteration is insertion order and ids are only ever inserted once, so
    // the first key is the oldest.
    while (rxNotificationUrlMap.size > RX_NOTIFICATION_TARGETS_MAX) {
        rxNotificationUrlMap.delete(rxNotificationUrlMap.keys().next().value);
    }
}

// Distinguishes "there is no store to consult" from "the store answered and
// the answer was nothing". Only the former may fall back to worker memory.
const RX_NO_SESSION_STORE = Symbol('rx-no-session-store');

async function rxMutateNotificationTargets(mutate) {
    const area = rxSessionStorageArea();
    if (!area) return RX_NO_SESSION_STORE;
    const mutation = rxNotificationTargetQueue.then(async () => {
        const now = Date.now();
        let stored = null;
        try {
            const got = await area.get(RX_NOTIFICATION_TARGETS_KEY);
            stored = got?.[RX_NOTIFICATION_TARGETS_KEY] || null;
        } catch (error) {
            // A failed read says nothing about what is stored. Treating it as
            // an empty map and writing the result back would destroy every
            // other pending target, which is the exact failure this whole path
            // exists to prevent. Leave the store untouched.
            console.warn('[RumbleX] notification target read failed:', error);
            return RX_NO_SESSION_STORE;
        }
        const entries = rxPruneNotificationTargets(stored, now);
        const result = mutate(entries, now);
        const next = rxPruneNotificationTargets(entries, now);
        try {
            await area.set({ [RX_NOTIFICATION_TARGETS_KEY]: next });
        } catch (error) {
            // A write that never lands leaves a consumed target clickable a
            // second time, so try once more before giving up.
            try {
                await area.set({ [RX_NOTIFICATION_TARGETS_KEY]: next });
            } catch {
                console.warn('[RumbleX] notification target write failed:', error);
            }
        }
        return result;
    });
    rxNotificationTargetQueue = mutation.catch(() => {});
    try {
        return await mutation;
    } catch (e) {
        console.warn('[RumbleX] notification target store failed:', e);
        return RX_NO_SESSION_STORE;
    }
}

async function rxRememberNotificationTarget(id, url) {
    const safeUrl = rxSafeRumbleUrl(url);
    if (!id || !safeUrl) return;
    const now = Date.now();
    rxNotificationUrlMap.set(id, { url: safeUrl, at: now });
    rxPruneNotificationMap(now);
    await rxMutateNotificationTargets((entries, at) => {
        entries[id] = { url: safeUrl, at };
        return null;
    });
}

async function rxTakeNotificationTarget(id) {
    if (!id) return null;
    rxPruneNotificationMap();
    const cached = rxSafeRumbleUrl(rxNotificationUrlMap.get(id)?.url);
    rxNotificationUrlMap.delete(id);
    const stored = await rxMutateNotificationTargets((entries) => {
        const entry = entries[id];
        delete entries[id];
        return entry ? rxSafeRumbleUrl(entry.url) : null;
    });
    // Worker memory is the fallback whenever the store had no answer, including
    // when a write never landed. It cannot smuggle an aged-out or over-cap
    // entry back in, because rxPruneNotificationMap applies the same TTL and
    // cap to the Map before the lookup. Refusing to open a tab we still hold a
    // valid target for would be the same silent nothing this item exists to fix.
    return (stored === RX_NO_SESSION_STORE ? null : stored) || cached;
}

async function rxFireNotification({ title, message, url }) {
    if (!chrome.notifications) return null;
    const id = await new Promise((resolve) => {
        try {
            chrome.notifications.create('', {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/128.png'),
                title: title || 'RumbleX',
                message: message || '',
                contextMessage: url || '',
                priority: 0,
            }, (created) => {
                void chrome.runtime.lastError;
                resolve(created || null);
            });
        } catch (e) {
            console.warn('[RumbleX] notification create failed:', e);
            resolve(null);
        }
    });
    // Persist before returning, so a worker evicted immediately after the
    // notifier pass still leaves a click target behind.
    if (id) await rxRememberNotificationTarget(id, url);
    return id;
}

// Named rather than inlined into the listener so the click path itself is
// reachable from a test; the listener is then only event plumbing.
async function rxHandleNotificationClick(id) {
    const url = await rxTakeNotificationTarget(id);
    if (!url) return null;
    try { await chrome.tabs.create({ url }); } catch (e) {
        console.warn('[RumbleX] notification click could not open a tab:', e);
        return null;
    }
    try { await chrome.notifications.clear(id); } catch {}
    return url;
}

// Named and kept on the module so a test can invoke exactly what Chrome
// invokes, and assert the registration itself is still in place. The event
// object has no dispatch() outside the browser's own plumbing, so registration
// plus the listener body is as close to a real click as a test can get.
const rxNotificationClickListener = (id) => {
    void rxHandleNotificationClick(id);
};

if (chrome.notifications?.onClicked) {
    chrome.notifications.onClicked.addListener(rxNotificationClickListener);
}

let rxNotifierPassPromise = null;

function rxQueueNotifierChannelUpdates(updates, expectedGeneration) {
    if (rxSettingsMutationGeneration !== expectedGeneration) return Promise.resolve(false);
    rxSettingsMutationGeneration += 1;
    return rxQueueStorageMutation(async () => {
        const stored = await chrome.storage.local.get('rx_settings');
        const current = rxNormalizeSettings(stored.rx_settings || {});
        const byUrl = new Map((Array.isArray(updates) ? updates : [])
            .map((entry) => [rxSafeRumbleUrl(entry?.url), entry])
            .filter(([url]) => !!url));
        const watchedChannels = (Array.isArray(current.watchedChannels) ? current.watchedChannels : [])
            .map((channel) => {
                const update = byUrl.get(rxSafeRumbleUrl(channel?.url));
                if (!update) return channel;
                return {
                    ...channel,
                    lastSeenVideoId: update.lastSeenVideoId,
                    isLive: update.isLive === true,
                    lastChecked: update.lastChecked,
                    lastError: update.lastError || null,
                };
            });
        const next = rxNormalizeSettings({ ...current, watchedChannels });
        await chrome.storage.local.set({ rx_settings: next });
        return true;
    });
}

function rxQueueWatchedChannelAdd(url, name) {
    rxSettingsMutationGeneration += 1;
    return rxQueueStorageMutation(async () => {
        const stored = await chrome.storage.local.get('rx_settings');
        const current = rxNormalizeSettings(stored.rx_settings || {});
        const list = Array.isArray(current.watchedChannels) ? current.watchedChannels.slice() : [];
        if (list.some((channel) => rxSafeRumbleUrl(channel?.url) === url)) {
            return { ok: false, reason: 'duplicate' };
        }
        list.push({
            url,
            name: String(name || '').slice(0, 300) || url,
            lastSeenVideoId: null,
            isLive: false,
            lastChecked: null,
        });
        const next = rxNormalizeSettings({ ...current, watchedChannels: list });
        await chrome.storage.local.set({ rx_settings: next });
        return { ok: true, count: list.length };
    });
}

function rxQueueWatchedChannelRemove(url) {
    rxSettingsMutationGeneration += 1;
    return rxQueueStorageMutation(async () => {
        const stored = await chrome.storage.local.get('rx_settings');
        const current = rxNormalizeSettings(stored.rx_settings || {});
        const list = (Array.isArray(current.watchedChannels) ? current.watchedChannels : [])
            .filter((channel) => rxSafeRumbleUrl(channel?.url) !== url);
        const next = rxNormalizeSettings({ ...current, watchedChannels: list });
        await chrome.storage.local.set({ rx_settings: next });
        return { ok: true, count: list.length };
    });
}

function rxQueueWatchedChannelBulkAdd(rows, expectedGeneration) {
    if (rxSettingsMutationGeneration !== expectedGeneration) {
        return Promise.resolve({ ok: false, reason: 'superseded' });
    }
    rxSettingsMutationGeneration += 1;
    return rxQueueStorageMutation(async () => {
        const stored = await chrome.storage.local.get('rx_settings');
        const current = rxNormalizeSettings(stored.rx_settings || {});
        const watchedChannels = Array.isArray(current.watchedChannels)
            ? current.watchedChannels.slice()
            : [];
        const known = new Set(watchedChannels.map((channel) => rxSafeRumbleUrl(channel?.url)).filter(Boolean));
        let added = 0;
        let duplicates = 0;
        for (const row of rows) {
            const url = rxSafeRumbleUrl(row?.url);
            if (!url) continue;
            if (known.has(url)) { duplicates++; continue; }
            watchedChannels.push({
                url,
                name: String(row?.name || '').slice(0, 300) || url,
                lastSeenVideoId: null,
                isLive: false,
                lastChecked: null,
            });
            known.add(url);
            added++;
        }
        const next = rxNormalizeSettings({ ...current, watchedChannels });
        await chrome.storage.local.set({ rx_settings: next });
        return { ok: true, added, duplicates, total: watchedChannels.length };
    });
}

async function rxRunNotifierPassOnce() {
    await rxEnsurePendingResetStartupRecovery();
    await rxSettingsWriteChain.catch(() => {});
    const passGeneration = rxSettingsMutationGeneration;
    const s = await rxGetSettings();
    if (rxSettingsMutationGeneration !== passGeneration) return;
    if (!s.channelNotifierEnabled) return;
    const channels = Array.isArray(s.watchedChannels) ? s.watchedChannels : [];
    if (channels.length === 0) return;
    let dirty = false;
    const updated = [];
    for (const ch of channels) {
        const channelUrl = rxSafeRumbleUrl(ch?.url);
        if (!channelUrl) { dirty = true; continue; }
        const safeChannel = {
            url: channelUrl,
            name: typeof ch.name === 'string' ? ch.name.slice(0, 300) : channelUrl,
            lastSeenVideoId: typeof ch.lastSeenVideoId === 'string' ? ch.lastSeenVideoId.slice(0, 120) : null,
            isLive: !!ch.isLive,
            lastChecked: Number.isFinite(ch.lastChecked) ? ch.lastChecked : null,
        };
        try {
            const resp = await fetch(channelUrl, {
                method: 'GET',
                credentials: 'omit',
                signal: AbortSignal.timeout(15_000),
            });
            if (!resp.ok) {
                updated.push({ ...safeChannel, lastChecked: Date.now(), lastError: 'http-' + resp.status });
                dirty = true;
                continue;
            }
            const text = await resp.text();
            if (rxSettingsMutationGeneration !== passGeneration) return;
            const { latestVideoId, isLive, latest, live } = rxParseChannelHtml(text, channelUrl);
            const newVideo = latestVideoId && safeChannel.lastSeenVideoId && latestVideoId !== safeChannel.lastSeenVideoId;
            const liveStarted = isLive && !safeChannel.isLive;
            // Clicking a notification should land on the thing it is about.
            // The channel page is only the fallback for a page shape that did
            // not give us a watch URL.
            const videoUrl = latest?.url || channelUrl;
            const liveUrl = live?.url || channelUrl;
            if (newVideo && s.channelNotifierUploads !== false) {
                await rxFireNotification({
                    title: 'New video — ' + safeChannel.name,
                    message: latest?.title || 'A new video is up on this channel.',
                    url: videoUrl,
                });
                if (s.discordWebhookUrl) {
                    void rxPostDiscordWebhook(s.discordWebhookUrl, {
                        content: 'New RumbleX video on ' + safeChannel.name + ': ' + videoUrl,
                    });
                }
            }
            if (liveStarted && s.channelNotifierLive !== false) {
                const viewers = Number.isFinite(live?.viewers) && live.viewers > 0
                    ? ` · ${live.viewers} watching`
                    : '';
                await rxFireNotification({
                    title: 'LIVE — ' + safeChannel.name,
                    message: (live?.title || 'This channel just went live.') + viewers,
                    url: liveUrl,
                });
                if (s.discordWebhookUrl) {
                    void rxPostDiscordWebhook(s.discordWebhookUrl, {
                        content: 'LIVE on ' + safeChannel.name + ' → ' + liveUrl,
                    });
                }
            }
            updated.push({
                ...safeChannel,
                lastSeenVideoId: latestVideoId || safeChannel.lastSeenVideoId,
                isLive,
                lastChecked: Date.now(),
                lastError: null,
            });
            dirty = true;
        } catch (e) {
            if (rxSettingsMutationGeneration !== passGeneration) return;
            updated.push({ ...safeChannel, lastChecked: Date.now(), lastError: String(e?.message || e).slice(0, 500) });
            dirty = true;
        }
    }
    if (dirty) await rxQueueNotifierChannelUpdates(updated, passGeneration);
}

function rxRunNotifierPass() {
    if (rxNotifierPassPromise) return rxNotifierPassPromise;
    rxNotifierPassPromise = rxRunNotifierPassOnce().finally(() => {
        rxNotifierPassPromise = null;
    });
    return rxNotifierPassPromise;
}

if (chrome.alarms?.onAlarm) {
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === RX_NOTIFIER_ALARM) {
            rxRunNotifierPass().catch((e) => console.warn('[RumbleX] notifier pass failed:', e));
        }
        if (alarm.name === RX_ARCHIVE_ALARM) {
            rxHandleCurrentNetworkState({ runArchive: false })
                .then(() => rxRunArchiveTick())
                .catch((e) => console.warn('[RumbleX] archive/recovery tick failed:', e));
        }
    });
}

// v3.18.0 — Channel Archive Queue. A persistent chrome.storage.local-backed
// job queue that lives across SW restarts. A chrome.alarms tick drains up to
// `downloadConcurrency` pending jobs per minute. Each job:
//   1. SW-fetches https://rumble.com/embedJS/u3/?request=video&v=<embedId>
//      (the same endpoint VideoDownloader uses in content.js).
//   2. Picks the highest-resolution `ua.mp4.*` direct URL.
//   3. Calls chrome.downloads.download() — same path as the manual download.
//   4. Tracks the downloadId; chrome.downloads.onChanged marks the job
//      completed/failed when the download finishes.
// Queue cap: 500 jobs. Completed jobs older than 7 days are auto-pruned on
// each tick.
const RX_ARCHIVE_ALARM = 'rx-archive-tick';
const RX_ARCHIVE_KEY = 'rx_archive_queue';
const RX_ARCHIVE_MAX_JOBS = 500;
const RX_ARCHIVE_COMPLETED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RX_ARCHIVE_EXPORT_SCHEMA = 1;
const RX_ARCHIVE_WORKER_EPOCH = Date.now();

async function rxSyncArchiveAlarm() {
    try {
        const existing = await chrome.alarms.get(RX_ARCHIVE_ALARM);
        if (!existing) {
            await chrome.alarms.create(RX_ARCHIVE_ALARM, { periodInMinutes: 1 });
        }
    } catch (e) {
        console.warn('[RumbleX] archive alarm sync failed:', e);
    }
}

async function rxLoadArchiveQueue() {
    try {
        const got = await chrome.storage.local.get([RX_ARCHIVE_KEY]);
        const root = got[RX_ARCHIVE_KEY];
        if (root && typeof root === 'object' && Array.isArray(root.jobs)) return root;
    } catch {}
    return { jobs: [], paused: false, version: 1 };
}

async function rxSaveArchiveQueue(root) {
    await chrome.storage.local.set({ [RX_ARCHIVE_KEY]: root });
}

function rxMutateArchiveQueue(mutator, expectedGeneration = null) {
    return rxQueueStorageMutation(async () => {
        if (expectedGeneration !== null && expectedGeneration !== rxArchiveNetworkGeneration) {
            return { superseded: true };
        }
        const root = await rxLoadArchiveQueue();
        if (expectedGeneration !== null && expectedGeneration !== rxArchiveNetworkGeneration) {
            return { superseded: true };
        }
        const result = await mutator(root);
        if (expectedGeneration !== null && expectedGeneration !== rxArchiveNetworkGeneration) {
            return { superseded: true };
        }
        await rxSaveArchiveQueue(root);
        return result;
    });
}

function rxArchiveSanitizeFilename(s) {
    const cleaned = String(s || 'rumble-video')
        .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    return cleaned || 'rumble-video';
}

// v3.24.0 — Subfolder sanitizer. Strips drive letters, leading slashes,
// path separators, parent-traversal segments, and unsafe filename chars.
// Falls back to 'RumbleX' if the cleaned result is empty.
function rxArchiveSanitizeSubfolder(s) {
    let raw = String(s == null ? 'RumbleX' : s);
    // Collapse backslashes to forward slashes for uniform splitting.
    raw = raw.replace(/\\+/g, '/');
    const parts = raw.split('/')
        .map((p) => p.trim())
        // Drop drive letters, parent-segments, and empty/dot pieces.
        .filter((p) => p && p !== '.' && p !== '..' && !/^[a-z]:$/i.test(p))
        .map((p) => p.replace(/[<>:"|?*\u0000-\u001f]+/g, '').replace(/\s+/g, ' ').trim())
        .filter((p) => p);
    const joined = parts.slice(0, 4).join('/').slice(0, 120);
    return joined || 'RumbleX';
}

async function rxDiscoverVideoQuality(videoSlug, maxHeight) {
    // videoSlug is the "v..." prefix from the path. embedJS expects the slug
    // *minus* the leading "v". Existing content.js code does the same strip:
    // `embedId.replace('v', '')` — see line ~2886.
    // maxHeight: number cap (e.g. 1080) or 0 / null for "best".
    const numericId = String(videoSlug || '').replace(/^v/, '');
    if (!numericId) throw new Error('bad-video-id');
    const url = 'https://rumble.com/embedJS/u3/?request=video&ver=2&v=' + encodeURIComponent(numericId);
    const resp = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!resp.ok) throw new Error('embedJS http-' + resp.status);
    const data = await resp.json();
    const src = data.ua || data.u || {};
    const cap = (typeof maxHeight === 'number' && maxHeight > 0) ? maxHeight : Infinity;
    let bestUrl = null;
    let bestHeight = 0;
    let bestLabel = '';
    let bestSize = null;
    let title = data.title || data.full_title || data.video?.title || null;
    const consider = (u, h, size) => {
        if (!u || !(h > 0)) return;
        if (h > cap) return;
        if (h > bestHeight) {
            bestUrl = u;
            bestHeight = h;
            bestLabel = h + 'p';
            const parsedSize = Number(size);
            bestSize = Number.isFinite(parsedSize) && parsedSize > 0 ? Math.floor(parsedSize) : null;
        }
    };
    for (const fmt of ['mp4', 'webm']) {
        const group = src[fmt];
        if (!group || typeof group !== 'object') continue;
        if (group.url && group.meta?.h > 0) consider(group.url, group.meta.h, group.meta.size);
        for (const [, val] of Object.entries(group)) {
            if (!val?.url || !val?.meta?.h) continue;
            consider(val.url, val.meta.h, val.meta.size);
        }
    }
    if (!bestUrl) {
        // If a cap is in effect but no quality fit, throw a specific reason so
        // the queue UI can show a useful error instead of a generic miss.
        if (cap !== Infinity) throw new Error('no-direct-mp4-under-' + cap + 'p');
        throw new Error('no-direct-mp4');
    }
    return { url: bestUrl, quality: bestLabel, height: bestHeight, title, estimatedBytes: bestSize };
}

async function rxGetArchiveMaxHeight() {
    try {
        const got = await chrome.storage.local.get(['rx_settings']);
        const raw = String(got?.rx_settings?.channelArchiveMaxHeight || 'best').toLowerCase();
        if (raw !== 'best' && raw !== '') {
            const value = parseInt(raw, 10);
            if (Number.isFinite(value) && value > 0) return value;
        }
    } catch {}
    return 0;
}

async function rxGetArchiveFolderState() {
    const fallback = {
        available: !!globalThis.RxArchiveFsAccess,
        offscreen: !!chrome.offscreen,
        selected: false,
        name: null,
        permission: 'missing',
    };
    if (!globalThis.RxArchiveFsAccess) return fallback;
    try {
        return { ...fallback, ...(await globalThis.RxArchiveFsAccess.getState()) };
    } catch (error) {
        return { ...fallback, error: String(error?.message || error).slice(0, 160) };
    }
}

async function rxPreflightArchiveQueue() {
    const archiveGeneration = rxArchiveNetworkGeneration;
    const cap = await rxGetArchiveMaxHeight();
    const ids = await rxMutateArchiveQueue((root) => {
        root.paused = true;
        return root.jobs
            .filter((job) => job.status === 'pending' || job.status === 'failed')
            .map((job) => job.id);
    }, archiveGeneration);
    if (ids?.superseded) {
        return { superseded: true, checked: 0, knownSize: 0, estimatedBytes: 0, failed: 0 };
    }
    let checked = 0;
    let knownSize = 0;
    let estimatedBytes = 0;
    let failed = 0;
    const queue = ids.slice();
    const worker = async () => {
        while (queue.length) {
            if (archiveGeneration !== rxArchiveNetworkGeneration) return;
            const id = queue.shift();
            const snapshot = await rxLoadArchiveQueue();
            if (archiveGeneration !== rxArchiveNetworkGeneration) return;
            const job = snapshot.jobs.find((entry) => entry.id === id);
            if (!job) continue;
            try {
                const discovered = await rxDiscoverVideoQuality(job.videoId, cap);
                const update = await rxUpdateArchiveJob(id, {
                    qualityFound: discovered.quality,
                    estimatedBytes: discovered.estimatedBytes,
                    videoTitle: job.videoTitle || discovered.title || job.videoId,
                    preflightAt: Date.now(),
                    preflightError: null,
                }, archiveGeneration);
                if (update?.superseded) return;
                if (discovered.estimatedBytes) {
                    knownSize++;
                    estimatedBytes += discovered.estimatedBytes;
                }
            } catch (error) {
                if (archiveGeneration !== rxArchiveNetworkGeneration) return;
                failed++;
                const update = await rxUpdateArchiveJob(id, {
                    qualityFound: null,
                    estimatedBytes: null,
                    preflightAt: Date.now(),
                    preflightError: String(error?.message || error).slice(0, 200),
                }, archiveGeneration);
                if (update?.superseded) return;
            }
            checked++;
        }
    };
    await Promise.all(Array.from({ length: Math.min(3, Math.max(1, ids.length)) }, () => worker()));
    if (archiveGeneration !== rxArchiveNetworkGeneration) {
        return { superseded: true, checked, knownSize, estimatedBytes, failed };
    }
    return { checked, knownSize, estimatedBytes, failed, paused: true };
}

function rxArchiveExportJob(job) {
    return {
        channelUrl: job.channelUrl || null,
        channelName: job.channelName || null,
        videoId: job.videoId,
        videoUrl: job.videoUrl,
        videoTitle: job.videoTitle || null,
        status: job.status,
        qualityFound: job.qualityFound || null,
        estimatedBytes: Number.isFinite(job.estimatedBytes) ? job.estimatedBytes : null,
        filename: job.filename || null,
        error: job.error || null,
        preflightError: job.preflightError || null,
        retryCount: Number.isFinite(job.retryCount) ? job.retryCount : 0,
        addedAt: job.addedAt || null,
        completedAt: job.completedAt || null,
    };
}

async function rxBuildArchiveQueueExport() {
    const root = await rxLoadArchiveQueue();
    return {
        schemaVersion: RX_ARCHIVE_EXPORT_SCHEMA,
        exportedAt: new Date().toISOString(),
        extensionVersion: chrome.runtime.getManifest().version,
        paused: !!root.paused,
        jobs: root.jobs.slice(0, RX_ARCHIVE_MAX_JOBS).map(rxArchiveExportJob),
    };
}

function rxNormalizeArchiveImportJob(input) {
    if (!input || typeof input !== 'object') return null;
    const videoId = String(input.videoId || '').trim().toLowerCase();
    if (!/^v[a-z0-9]+$/.test(videoId)) return null;
    const safeRumbleUrl = (raw, pathPattern) => {
        try {
            const url = new URL(String(raw || ''));
            if (url.protocol !== 'https:' || !/(^|\.)rumble\.com$/i.test(url.hostname)) return null;
            return pathPattern.test(url.pathname) ? url.href.slice(0, 1000) : null;
        } catch { return null; }
    };
    const importedStatus = String(input.status || 'pending');
    const status = ['completed', 'failed'].includes(importedStatus) ? importedStatus : 'pending';
    const estimatedBytes = Number(input.estimatedBytes);
    const addedAt = Number(input.addedAt);
    const completedAt = Number(input.completedAt);
    return {
        id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
        channelUrl: safeRumbleUrl(input.channelUrl, /^\/(?:c|user)\//i),
        channelName: String(input.channelName || '').slice(0, 160) || null,
        videoId,
        videoUrl: safeRumbleUrl(input.videoUrl, /^\/v[a-z0-9]/i) || `https://rumble.com/${videoId}.html`,
        videoTitle: String(input.videoTitle || '').slice(0, 240) || null,
        status,
        qualityFound: String(input.qualityFound || '').slice(0, 40) || null,
        estimatedBytes: Number.isFinite(estimatedBytes) && estimatedBytes > 0 ? Math.floor(estimatedBytes) : null,
        filename: String(input.filename || '').slice(0, 500) || null,
        error: status === 'failed' ? String(input.error || 'imported-failure').slice(0, 200) : null,
        preflightError: String(input.preflightError || '').slice(0, 200) || null,
        retryCount: Math.max(0, Math.min(1000, parseInt(input.retryCount, 10) || 0)),
        addedAt: Number.isFinite(addedAt) && addedAt > 0 ? addedAt : Date.now(),
        completedAt: (status === 'completed' || status === 'failed') && Number.isFinite(completedAt) && completedAt > 0 ? completedAt : null,
        importedAt: Date.now(),
        recoveredFromStatus: ['discovering', 'downloading'].includes(importedStatus) ? importedStatus : null,
    };
}

async function rxImportArchiveQueue(payload) {
    if (!payload || payload.schemaVersion !== RX_ARCHIVE_EXPORT_SCHEMA || !Array.isArray(payload.jobs)) {
        throw new Error('invalid-archive-queue-export');
    }
    return rxMutateArchiveQueue((root) => {
        root.paused = true;
        let imported = 0;
        let skipped = 0;
        const existing = new Set(root.jobs.map((job) => job.videoId));
        for (const raw of payload.jobs.slice(0, RX_ARCHIVE_MAX_JOBS)) {
            const job = rxNormalizeArchiveImportJob(raw);
            if (!job || existing.has(job.videoId) || root.jobs.length >= RX_ARCHIVE_MAX_JOBS) {
                skipped++;
                continue;
            }
            root.jobs.push(job);
            existing.add(job.videoId);
            imported++;
        }
        return { imported, skipped, paused: true };
    });
}

async function rxRunArchiveTick() {
    await rxEnsurePendingResetStartupRecovery();
    const snapshot = await rxLoadArchiveQueue();
    if (snapshot.paused) return;

    // v3.26.0 — Skip the tick while the device is offline so jobs aren't
    // burned on guaranteed-fail network ops. The check is gated behind a
    // setting (default ON) so users who explicitly want offline retry-burn
    // behavior can flip it. Pure short-circuit: jobs stay 'pending' and the
    // next online tick picks up where this one left off.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        try {
            const got = await chrome.storage.local.get(['rx_settings']);
            const s = got.rx_settings || {};
            const gated = s.downloadManagerEnabled !== false
                && s.archiveQueuePauseOnOffline !== false; // both default true
            if (gated) return;
        } catch {}
    }

    // Honor downloadConcurrency from settings.
    let concurrency = 2;
    try {
        const got = await chrome.storage.local.get(['rx_settings']);
        const s = got.rx_settings || {};
        const n = Number(s.downloadConcurrency);
        if (Number.isFinite(n) && n >= 1 && n <= 8) concurrency = Math.floor(n);
    } catch {}

    const pendingIds = await rxMutateArchiveQueue((root) => {
        if (root.paused) return [];
        const now = Date.now();
        root.jobs = root.jobs.filter((job) => {
            if (job.status !== 'completed') return true;
            return !(job.completedAt && (now - job.completedAt) > RX_ARCHIVE_COMPLETED_TTL_MS);
        });
        rxRecoverAbandonedArchiveJobs(root);
        const inFlight = root.jobs.filter((job) => job.status === 'discovering' || job.status === 'downloading').length;
        const slots = Math.max(0, concurrency - inFlight);
        const pending = root.jobs.filter((job) => job.status === 'pending').slice(0, slots);
        for (const job of pending) {
            job.status = 'discovering';
            job.startedAt = Date.now();
        }
        return pending.map((job) => job.id);
    });
    await Promise.all(pendingIds.map((id) => rxProcessArchiveJob(id).catch((e) => {
        console.warn('[RumbleX] archive job ' + id + ' failed:', e);
    })));
}

async function rxUpdateArchiveJob(id, patch, expectedGeneration = null) {
    return rxMutateArchiveQueue((root) => {
        const idx = root.jobs.findIndex((job) => job.id === id);
        if (idx < 0) return null;
        root.jobs[idx] = { ...root.jobs[idx], ...patch };
        return root.jobs[idx];
    }, expectedGeneration);
}

function rxResetArchiveJobForRetry(job) {
    job.status = 'pending';
    job.error = null;
    job.preflightError = null;
    job.preflightAt = null;
    job.completedAt = null;
    job.startedAt = null;
    job.downloadId = null;
    job.downloadedBytes = null;
    job.destination = null;
    job.destinationName = null;
    job.folderFallbackReason = null;
    job.recoveredFromStatus = null;
    job.retryCount = (Number(job.retryCount) || 0) + 1;
    job.lastRetryAt = Date.now();
}

function rxRecoverAbandonedArchiveJobs(root) {
    let recovered = 0;
    for (const job of root.jobs || []) {
        const abandoned = (job.status === 'discovering'
            || (job.status === 'downloading' && !Number.isInteger(job.downloadId)))
            && (!Number.isFinite(job.startedAt) || job.startedAt < RX_ARCHIVE_WORKER_EPOCH);
        if (!abandoned) continue;
        const recoveredFromStatus = job.status;
        rxResetArchiveJobForRetry(job);
        job.recoveredFromStatus = recoveredFromStatus;
        job.recoveryReason = 'worker-restart';
        recovered++;
    }
    return recovered;
}

// v3.35.0 — Network-aware download recovery. Only downloads started by
// RumbleX are tracked; raw media URLs are deliberately not persisted. When
// the worker receives an offline event, active managed browser downloads are
// paused and represented as small resume jobs keyed by chrome download ID.
// An online event (or the archive alarm fallback) resumes those IDs and
// releases archive jobs that were still discovering/streaming to a selected
// folder. `downloadManagerEnabled` is the master gate.
const RX_DOWNLOAD_RECOVERY_KEY = 'rx_download_recovery';
const RX_DOWNLOAD_RECOVERY_MAX = 200;
let rxNetworkTransitionQueue = Promise.resolve();
let rxArchiveNetworkGeneration = 0;
let rxDownloadRecoveryGeneration = 0;

const rxDownloadsApi = {
    download(options) {
        return new Promise((resolve, reject) => {
            chrome.downloads.download(options, (downloadId) => {
                const error = chrome.runtime.lastError;
                if (error) reject(new Error(error.message));
                else if (!Number.isInteger(downloadId)) reject(new Error('download-id-missing'));
                else resolve(downloadId);
            });
        });
    },
    search(query) {
        return new Promise((resolve, reject) => {
            chrome.downloads.search(query, (items) => {
                const error = chrome.runtime.lastError;
                if (error) reject(new Error(error.message));
                else resolve(Array.isArray(items) ? items : []);
            });
        });
    },
    pause(downloadId) {
        return new Promise((resolve, reject) => {
            chrome.downloads.pause(downloadId, () => {
                const error = chrome.runtime.lastError;
                if (error) reject(new Error(error.message));
                else resolve();
            });
        });
    },
    resume(downloadId) {
        return new Promise((resolve, reject) => {
            chrome.downloads.resume(downloadId, () => {
                const error = chrome.runtime.lastError;
                if (error) reject(new Error(error.message));
                else resolve();
            });
        });
    },
    cancel(downloadId) {
        return new Promise((resolve, reject) => {
            chrome.downloads.cancel(downloadId, () => {
                const error = chrome.runtime.lastError;
                if (error) reject(new Error(error.message));
                else resolve();
            });
        });
    },
};

function rxNormalizeDownloadRecovery(root) {
    const jobs = Array.isArray(root?.jobs) ? root.jobs : [];
    return {
        version: 1,
        networkStatus: root?.networkStatus === 'offline' ? 'offline' : 'online',
        lastTransitionAt: Number(root?.lastTransitionAt) || null,
        jobs: jobs
            .filter((job) => Number.isInteger(job?.downloadId) && job.downloadId >= 0)
            .slice(-RX_DOWNLOAD_RECOVERY_MAX)
            .map((job) => ({
                downloadId: job.downloadId,
                operation: String(job.operation || 'download').replace(/[^a-z0-9_.-]/gi, '').slice(0, 60) || 'download',
                archiveJobId: String(job.archiveJobId || '').slice(0, 80) || null,
                // The tab that asked for a panel download, so a failure the
                // browser reports later can be shown where it was started.
                tabId: Number.isInteger(job.tabId) && job.tabId >= 0 ? job.tabId : null,
                trackedAt: Number(job.trackedAt) || Date.now(),
                updatedAt: Number(job.updatedAt) || Date.now(),
                resumePending: job.resumePending === true,
                status: ['active', 'paused-offline', 'interrupted-offline'].includes(job.status) ? job.status : 'active',
                bytesReceived: job.bytesReceived == null
                    ? null
                    : (Number.isFinite(Number(job.bytesReceived)) ? Math.max(0, Number(job.bytesReceived)) : null),
                resumeAttempts: Math.max(0, Math.min(100, Number(job.resumeAttempts) || 0)),
                lastError: String(job.lastError || '').slice(0, 200) || null,
            })),
    };
}

async function rxLoadDownloadRecovery() {
    try {
        const stored = await chrome.storage.local.get(RX_DOWNLOAD_RECOVERY_KEY);
        return rxNormalizeDownloadRecovery(stored[RX_DOWNLOAD_RECOVERY_KEY]);
    } catch {
        return rxNormalizeDownloadRecovery(null);
    }
}

async function rxSaveDownloadRecovery(root) {
    await chrome.storage.local.set({ [RX_DOWNLOAD_RECOVERY_KEY]: rxNormalizeDownloadRecovery(root) });
}

function rxMutateDownloadRecovery(mutator, expectedGeneration = null) {
    return rxQueueStorageMutation(async () => {
        if (expectedGeneration !== null && expectedGeneration !== rxDownloadRecoveryGeneration) {
            return { superseded: true };
        }
        const root = await rxLoadDownloadRecovery();
        if (expectedGeneration !== null && expectedGeneration !== rxDownloadRecoveryGeneration) {
            return { superseded: true };
        }
        const result = await mutator(root);
        if (expectedGeneration !== null && expectedGeneration !== rxDownloadRecoveryGeneration) {
            return { superseded: true };
        }
        await rxSaveDownloadRecovery(root);
        return result;
    }, expectedGeneration);
}

function rxQueueNetworkTransition(task) {
    const transition = rxNetworkTransitionQueue.then(task);
    rxNetworkTransitionQueue = transition.catch(() => {});
    return transition;
}

async function rxIsDownloadManagerEnabled() {
    const settings = await rxGetSettings();
    return settings.downloadManagerEnabled !== false;
}

async function rxIsArchiveOfflinePauseEnabled() {
    const settings = await rxGetSettings();
    return settings.downloadManagerEnabled !== false
        && settings.archiveQueuePauseOnOffline !== false;
}

async function rxShouldPauseArchiveQueueOffline() {
    return typeof navigator !== 'undefined'
        && navigator.onLine === false
        && await rxIsArchiveOfflinePauseEnabled();
}

async function rxTrackManagedDownload(downloadId, metadata = {}, expectedGeneration = null) {
    if (!Number.isInteger(downloadId) || !(await rxIsDownloadManagerEnabled())) return false;
    return rxMutateDownloadRecovery((root) => {
        root.jobs = root.jobs.filter((job) => job.downloadId !== downloadId);
        root.jobs.push({
            downloadId,
            operation: metadata.operation || 'download',
            archiveJobId: metadata.archiveJobId || null,
            tabId: Number.isInteger(metadata.tabId) ? metadata.tabId : null,
            trackedAt: Date.now(),
            updatedAt: Date.now(),
            resumePending: false,
            status: 'active',
            bytesReceived: null,
            resumeAttempts: 0,
            lastError: null,
        });
        root.jobs = root.jobs.slice(-RX_DOWNLOAD_RECOVERY_MAX);
        return true;
    }, expectedGeneration);
}

async function rxUpdateManagedDownload(downloadId, patch, expectedGeneration = null) {
    return rxMutateDownloadRecovery((root) => {
        const job = root.jobs.find((entry) => entry.downloadId === downloadId);
        if (!job) return null;
        Object.assign(job, patch, { updatedAt: Date.now() });
        return { ...job };
    }, expectedGeneration);
}

async function rxUntrackManagedDownload(downloadId, expectedGeneration = null) {
    return rxMutateDownloadRecovery((root) => {
        const before = root.jobs.length;
        root.jobs = root.jobs.filter((job) => job.downloadId !== downloadId);
        return before !== root.jobs.length;
    }, expectedGeneration);
}

async function rxGetManagedDownload(downloadId) {
    const root = await rxLoadDownloadRecovery();
    return root.jobs.find((job) => job.downloadId === downloadId) || null;
}

// ── Rumble Live Stream API (v3.58.0) ─────────────────────────────────────
// The API URL a creator makes at rumble.com/account/livestream-api carries
// their API key, and the response carries their stream key. Both stay here.
// The content script asks for a poll while the creator surface is on screen
// and gets back a trimmed copy: counts, usernames, timestamps and amounts,
// with no key, no stream key and no message text beyond rants.
const RX_LIVE_API_MIN_INTERVAL_MS = 15_000;
const RX_LIVE_API_TIMEOUT_MS = 10_000;
const RX_LIVE_API_MAX_ITEMS = 50;
let rxLiveApiLast = { at: 0, url: '', result: null };
let rxLiveApiInFlight = null;

function rxLiveApiString(value, max = 120) {
    return typeof value === 'string' ? value.slice(0, max) : (typeof value === 'number' ? String(value) : '');
}

function rxLiveApiNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function rxLiveApiList(value) {
    return Array.isArray(value) ? value.slice(0, RX_LIVE_API_MAX_ITEMS) : [];
}

// Everything the panel shows and nothing else. Field names follow Rumble's
// documentation of the response; anything missing comes back null or empty.
function rxSanitizeLiveApi(json) {
    const source = json && typeof json === 'object' ? json : {};
    const followers = source.followers || {};
    const subscribers = source.subscribers || {};
    const gifts = source.gifted_subs || {};
    return {
        now: rxLiveApiNumber(source.now),
        userId: rxLiveApiString(source.user_id, 40),
        channelId: rxLiveApiString(source.channel_id, 40),
        followers: {
            count: rxLiveApiNumber(followers.num_followers),
            total: rxLiveApiNumber(followers.num_followers_total),
            recent: rxLiveApiList(followers.recent_followers).map((entry) => ({
                username: rxLiveApiString(entry?.username, 80),
                at: rxLiveApiString(entry?.followed_on, 40),
            })).filter((entry) => entry.username),
        },
        subscribers: {
            count: rxLiveApiNumber(subscribers.num_subscribers),
            total: rxLiveApiNumber(subscribers.num_subscribers_total),
            recent: rxLiveApiList(subscribers.recent_subscribers).map((entry) => ({
                username: rxLiveApiString(entry?.username || entry?.user, 80),
                amountCents: rxLiveApiNumber(entry?.amount_cents),
                at: rxLiveApiString(entry?.subscribed_on, 40),
            })).filter((entry) => entry.username),
        },
        gifts: {
            count: rxLiveApiNumber(gifts.num_gifted_subs),
            recent: rxLiveApiList(gifts.recent_gifted_subs).map((entry) => ({
                purchasedBy: rxLiveApiString(entry?.purchased_by, 80),
                totalGifts: rxLiveApiNumber(entry?.total_gifts),
                giftType: rxLiveApiString(entry?.gift_type, 40),
                videoId: rxLiveApiString(entry?.video_id, 40),
            })).filter((entry) => entry.purchasedBy),
        },
        livestreams: rxLiveApiList(source.livestreams).map((stream) => ({
            id: rxLiveApiString(stream?.id, 40),
            title: rxLiveApiString(stream?.title, 200),
            isLive: stream?.is_live === true,
            watchingNow: rxLiveApiNumber(stream?.watching_now),
            chat: {
                messages: rxLiveApiList(stream?.chat?.recent_messages).map((entry) => ({
                    username: rxLiveApiString(entry?.username, 80),
                    at: rxLiveApiString(entry?.created_on, 40),
                })).filter((entry) => entry.username),
                rants: rxLiveApiList(stream?.chat?.recent_rants).map((entry) => ({
                    username: rxLiveApiString(entry?.username, 80),
                    text: rxLiveApiString(entry?.text, 500),
                    at: rxLiveApiString(entry?.created_on, 40),
                    amountCents: rxLiveApiNumber(entry?.amount_cents),
                })).filter((entry) => entry.username),
            },
        })),
    };
}

async function rxPollLiveApi() {
    const stored = (await chrome.storage.local.get('rx_settings'))?.rx_settings || {};
    if (!stored.liveStreamApiMetrics) return { ok: false, reason: 'disabled' };
    const url = RumbleXSettingsSchema.safeLiveStreamApiUrl(stored.liveStreamApiUrl);
    if (!url) return { ok: false, reason: 'not-configured' };
    const now = Date.now();
    // Several tabs, or one tab re-rendering, must not turn into a request
    // loop against the creator's key.
    if (rxLiveApiLast.url === url && rxLiveApiLast.result && now - rxLiveApiLast.at < RX_LIVE_API_MIN_INTERVAL_MS) {
        return { ...rxLiveApiLast.result, cached: true };
    }
    if (rxLiveApiInFlight) return rxLiveApiInFlight;
    rxLiveApiInFlight = (async () => {
        try {
            const response = await fetch(url, {
                credentials: 'omit',
                cache: 'no-store',
                signal: AbortSignal.timeout(RX_LIVE_API_TIMEOUT_MS),
            });
            if (!response.ok) return { ok: false, reason: 'http', status: response.status };
            const result = { ok: true, data: rxSanitizeLiveApi(await response.json()), fetchedAt: Date.now() };
            rxLiveApiLast = { at: Date.now(), url, result };
            return result;
        } catch (error) {
            return { ok: false, reason: error?.name === 'TimeoutError' ? 'timeout' : 'network' };
        } finally {
            rxLiveApiInFlight = null;
        }
    })();
    return rxLiveApiInFlight;
}

async function rxStartManagedDownload(options, metadata = {}, expectedGeneration = null) {
    const downloadId = await rxDownloadsApi.download(options);
    try {
        await rxTrackManagedDownload(downloadId, metadata, expectedGeneration);
    } catch (error) {
        // The browser transfer already exists. Recovery metadata is secondary,
        // so never report the started download as rejected and invite a duplicate.
        console.warn('[RumbleX] download started without recovery tracking:', error);
    }
    return downloadId;
}

async function rxGetDownloadItem(downloadId) {
    return (await rxDownloadsApi.search({ id: downloadId }))[0] || null;
}

async function rxCallOpenOffscreen(action) {
    if (!chrome.offscreen) return { ok: false, reason: 'no-offscreen' };
    try {
        if (!(await rxHasOffscreenDocument())) return { ok: false, reason: 'no-offscreen-document' };
    } catch {
        return { ok: false, reason: 'offscreen-state-unavailable' };
    }
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ target: 'offscreen', action }, (response) => {
            void chrome.runtime.lastError;
            resolve(response || { ok: false, reason: 'no-response' });
        });
    });
}

async function rxMarkArchiveJobsOffline(pausedDownloadIds, expectedGeneration = null) {
    const paused = new Set(pausedDownloadIds);
    return rxMutateArchiveQueue((root) => {
        let queued = 0;
        for (const job of root.jobs) {
            const browserPaused = Number.isInteger(job.downloadId) && paused.has(job.downloadId);
            const restartableStage = job.status === 'discovering'
                || (job.status === 'downloading' && !Number.isInteger(job.downloadId));
            if (!browserPaused && !restartableStage) continue;
            if (restartableStage) {
                job.status = 'pending';
                job.startedAt = null;
                job.downloadId = null;
            }
            job.networkState = 'waiting-online';
            job.networkResumePending = true;
            job.networkPausedAt = Date.now();
            job.error = null;
            job.completedAt = null;
            queued++;
        }
        return queued;
    }, expectedGeneration);
}

async function rxReleaseArchiveNetworkWait(resumedDownloadIds, expectedGeneration = null) {
    const resumed = new Set(resumedDownloadIds);
    return rxMutateArchiveQueue((root) => {
        let released = 0;
        for (const job of root.jobs) {
            if (!job.networkResumePending) continue;
            if (Number.isInteger(job.downloadId) && !resumed.has(job.downloadId)) continue;
            job.networkState = null;
            job.networkResumePending = false;
            job.networkResumedAt = Date.now();
            released++;
        }
        return released;
    }, expectedGeneration);
}

async function rxHandleNetworkOfflineNow() {
    const recoveryGeneration = rxDownloadRecoveryGeneration;
    const superseded = () => recoveryGeneration !== rxDownloadRecoveryGeneration;
    if (!(await rxIsDownloadManagerEnabled())) return { enabled: false, paused: 0, queued: 0 };
    if (superseded()) return { superseded: true };
    // Invalidates archive discovery/write work that began before this
    // transition. A rapid offline -> online flip must not let the stale pass
    // race the newly released queue and dispatch the same job twice.
    rxArchiveNetworkGeneration++;
    const archiveGeneration = rxArchiveNetworkGeneration;
    await rxMutateDownloadRecovery((root) => {
        if (root.networkStatus !== 'offline') {
            root.networkStatus = 'offline';
            root.lastTransitionAt = Date.now();
        }
    }, recoveryGeneration);
    if (superseded()) return { superseded: true };

    const snapshot = await rxLoadDownloadRecovery();
    if (superseded()) return { superseded: true };
    const pausedIds = [];
    let queued = 0;
    for (const job of snapshot.jobs) {
        const item = await rxGetDownloadItem(job.downloadId);
        if (superseded()) return { superseded: true };
        if (!item || item.state === 'complete') {
            await rxUntrackManagedDownload(job.downloadId, recoveryGeneration);
            continue;
        }
        if (item.state === 'interrupted' && item.canResume) {
            await rxUpdateManagedDownload(job.downloadId, {
                resumePending: true,
                status: 'interrupted-offline',
                bytesReceived: item.bytesReceived,
                lastError: item.error || 'network-interrupted',
            }, recoveryGeneration);
            if (superseded()) return { superseded: true };
            pausedIds.push(job.downloadId);
            queued++;
            continue;
        }
        if (item.state === 'interrupted' && !item.canResume) {
            await rxUntrackManagedDownload(job.downloadId, recoveryGeneration);
            if (superseded()) return { superseded: true };
            if (job.archiveJobId) {
                await rxUpdateArchiveJob(job.archiveJobId, {
                    status: 'pending',
                    startedAt: null,
                    downloadId: null,
                    error: null,
                    completedAt: null,
                    networkState: 'waiting-online',
                    networkResumePending: true,
                    networkPausedAt: Date.now(),
                }, archiveGeneration);
                queued++;
            }
            continue;
        }
        if (item.state !== 'in_progress') continue;
        if (item.paused && !job.resumePending) continue; // user-paused; never auto-resume
        if (!item.paused) {
            // Persist intent before asking Chrome to pause so a service-worker
            // suspension cannot strand an unrecorded paused download.
            await rxUpdateManagedDownload(job.downloadId, {
                resumePending: true,
                status: 'paused-offline',
                bytesReceived: item.bytesReceived,
                lastError: null,
            }, recoveryGeneration);
            if (superseded()) return { superseded: true };
            try {
                await rxDownloadsApi.pause(job.downloadId);
                if (superseded()) {
                    try { await rxDownloadsApi.resume(job.downloadId); } catch {}
                    return { superseded: true };
                }
            } catch (error) {
                if (superseded()) return { superseded: true };
                const refreshed = await rxGetDownloadItem(job.downloadId);
                if (superseded()) return { superseded: true };
                if (!refreshed || refreshed.state === 'complete') {
                    await rxUntrackManagedDownload(job.downloadId, recoveryGeneration);
                    continue;
                }
                if (!(refreshed.paused || (refreshed.state === 'interrupted' && refreshed.canResume))) {
                    await rxUpdateManagedDownload(job.downloadId, {
                        resumePending: false,
                        status: 'active',
                        lastError: String(error?.message || error).slice(0, 200),
                    }, recoveryGeneration);
                    continue;
                }
            }
        }
        pausedIds.push(job.downloadId);
        queued++;
    }

    let archiveQueued = 0;
    if (await rxIsArchiveOfflinePauseEnabled()) {
        if (superseded() || archiveGeneration !== rxArchiveNetworkGeneration) return { superseded: true };
        await rxCallOpenOffscreen('pauseArchiveWrites');
        if (superseded() || archiveGeneration !== rxArchiveNetworkGeneration) return { superseded: true };
        archiveQueued = await rxMarkArchiveJobsOffline(pausedIds, archiveGeneration);
    }
    return { enabled: true, paused: pausedIds.length, queued, archiveQueued };
}

async function rxHandleNetworkOnlineNow({ runArchive = true } = {}) {
    const recoveryGeneration = rxDownloadRecoveryGeneration;
    const archiveGeneration = rxArchiveNetworkGeneration;
    const superseded = () => recoveryGeneration !== rxDownloadRecoveryGeneration
        || archiveGeneration !== rxArchiveNetworkGeneration;
    const snapshot = await rxLoadDownloadRecovery();
    if (superseded()) return { superseded: true };
    const resumedIds = [];
    for (const job of snapshot.jobs.filter((entry) => entry.resumePending)) {
        const item = await rxGetDownloadItem(job.downloadId);
        if (superseded()) return { superseded: true };
        if (!item || item.state === 'complete') {
            await rxUntrackManagedDownload(job.downloadId, recoveryGeneration);
            continue;
        }
        if (item.state === 'interrupted' && !item.canResume) {
            await rxUntrackManagedDownload(job.downloadId, recoveryGeneration);
            if (superseded()) return { superseded: true };
            if (job.archiveJobId) {
                await rxUpdateArchiveJob(job.archiveJobId, {
                    status: 'pending',
                    startedAt: null,
                    downloadId: null,
                    error: null,
                    completedAt: null,
                    networkState: 'waiting-online',
                    networkResumePending: true,
                }, archiveGeneration);
            } else {
                try {
                    await rxRecordDownloadDiagnostic({
                        source: 'background',
                        operation: job.operation || 'direct-download',
                        stage: 'browser-download',
                        error: {
                            message: 'Browser download can no longer resume',
                            code: item.error || 'download-not-resumable',
                        },
                        browserDownloadId: job.downloadId,
                    }, recoveryGeneration);
                } catch {}
            }
            continue;
        }
        if (item.state === 'in_progress' && !item.paused) {
            await rxUpdateManagedDownload(job.downloadId, {
                resumePending: false,
                status: 'active',
                lastError: null,
            }, recoveryGeneration);
            resumedIds.push(job.downloadId);
            continue;
        }
        if (!(item.paused || item.canResume)) continue;
        try {
            await rxDownloadsApi.resume(job.downloadId);
            if (superseded()) return { superseded: true };
            await rxUpdateManagedDownload(job.downloadId, {
                resumePending: false,
                status: 'active',
                resumeAttempts: (job.resumeAttempts || 0) + 1,
                lastError: null,
            }, recoveryGeneration);
            resumedIds.push(job.downloadId);
        } catch (error) {
            await rxUpdateManagedDownload(job.downloadId, {
                resumeAttempts: (job.resumeAttempts || 0) + 1,
                lastError: String(error?.message || error).slice(0, 200),
            }, recoveryGeneration);
        }
    }

    await rxMutateDownloadRecovery((root) => {
        if (root.networkStatus !== 'online') {
            root.networkStatus = 'online';
            root.lastTransitionAt = Date.now();
        }
    }, recoveryGeneration);
    if (superseded()) return { superseded: true };
    await rxCallOpenOffscreen('resumeArchiveWrites');
    if (superseded()) return { superseded: true };
    const archiveReleased = await rxReleaseArchiveNetworkWait(resumedIds, archiveGeneration);
    if (runArchive) rxRunArchiveTick().catch((error) => console.warn('[RumbleX] online archive resume failed:', error));
    return { resumed: resumedIds.length, archiveReleased };
}

function rxHandleNetworkOffline() {
    return rxQueueNetworkTransition(() => rxHandleNetworkOfflineNow());
}

function rxHandleNetworkOnline(options) {
    return rxQueueNetworkTransition(() => rxHandleNetworkOnlineNow(options));
}

async function rxHandleCurrentNetworkState(options) {
    await rxEnsurePendingResetStartupRecovery();
    return typeof navigator !== 'undefined' && navigator.onLine === false
        ? rxHandleNetworkOffline()
        : rxHandleNetworkOnline(options);
}

async function rxGetDownloadRecoverySummary() {
    const [root, enabled] = await Promise.all([rxLoadDownloadRecovery(), rxIsDownloadManagerEnabled()]);
    return {
        enabled,
        networkStatus: root.networkStatus,
        tracked: root.jobs.length,
        resumePending: root.jobs.filter((job) => job.resumePending).length,
        lastTransitionAt: root.lastTransitionAt,
    };
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
    self.addEventListener('offline', () => {
        rxHandleNetworkOffline().catch((error) => console.warn('[RumbleX] offline download pause failed:', error));
    });
    self.addEventListener('online', () => {
        rxHandleNetworkOnline().catch((error) => console.warn('[RumbleX] online download resume failed:', error));
    });
}

// Every service-worker activation reconciles persisted jobs. This complements
// online/offline events on browsers that do not wake a dormant worker for the
// standard WorkerGlobalScope connectivity events.
Promise.resolve()
    .then(() => rxHandleCurrentNetworkState({ runArchive: false }))
    .catch((error) => console.warn('[RumbleX] initial download recovery failed:', error));

async function rxProcessArchiveJob(id) {
    const networkGeneration = rxArchiveNetworkGeneration;
    const recoveryGeneration = rxDownloadRecoveryGeneration;
    const wasSuperseded = () => networkGeneration !== rxArchiveNetworkGeneration
        || recoveryGeneration !== rxDownloadRecoveryGeneration;
    const root = await rxLoadArchiveQueue();
    if (wasSuperseded()) return;
    const job = root.jobs.find((j) => j.id === id);
    if (!job) return;
    const updateJob = (patch) => rxUpdateArchiveJob(id, patch, networkGeneration);
    let cap = 0;
    let discovered = null;
    try {
        // Honor channelArchiveMaxHeight from settings — 'best' / '' / numeric.
        cap = await rxGetArchiveMaxHeight();
        discovered = await rxDiscoverVideoQuality(job.videoId, cap);
        if (wasSuperseded()) return;
        const title = job.videoTitle || discovered.title || job.videoId;
        if (await rxShouldPauseArchiveQueueOffline()) {
            await updateJob({
                status: 'pending',
                startedAt: null,
                error: null,
                completedAt: null,
                networkState: 'waiting-online',
                networkResumePending: true,
                networkPausedAt: Date.now(),
            });
            return;
        }
        // Subfolder sourced from settings (default 'RumbleX'); sanitized so a
        // malformed user value can't escape the Downloads root.
        let subfolder = 'RumbleX';
        try {
            const got = await chrome.storage.local.get(['rx_settings']);
            subfolder = rxArchiveSanitizeSubfolder(got?.rx_settings?.channelArchiveSubfolder);
        } catch {}
        const filename = subfolder + '/' + rxArchiveSanitizeFilename(title) + '_' + discovered.quality + '.mp4';
        if (!isAllowedDownloadUrl(discovered.url)) {
            await updateJob({ status: 'failed', error: 'url-not-allowlisted', completedAt: Date.now() });
            await rxRecordDownloadDiagnostic({
                source: 'background',
                operation: 'archive-download',
                operationId: id,
                stage: 'url-validation',
                error: { message: 'Discovered download URL is not allowlisted', code: 'url-not-allowlisted' },
                quality: { label: discovered.quality, height: discovered.height, requestedMaxHeight: cap || 'best' },
                urls: [{ role: 'download', url: discovered.url }],
            }, recoveryGeneration);
            return;
        }

        // Chrome/Edge opt-in: stream into the extension-origin persisted folder
        // from the offscreen document. Revoked/missing permissions or any write
        // failure fall back to the browser-managed Downloads path below.
        let folderFallbackReason = null;
        const folderState = await rxGetArchiveFolderState();
        if (wasSuperseded()) return;
        if (folderState.selected && folderState.permission === 'granted' && chrome.offscreen) {
            await updateJob({
                status: 'downloading',
                qualityFound: discovered.quality,
                estimatedBytes: discovered.estimatedBytes,
                videoTitle: title,
                filename,
                destination: 'selected-folder',
                destinationName: folderState.name,
                downloadId: null,
            });
            const folderResult = await callOffscreen('writeArchiveFile', { url: discovered.url, filename, operationId: id });
            if (wasSuperseded()) return;
            if (folderResult?.ok) {
                await updateJob({
                    status: 'completed',
                    completedAt: Date.now(),
                    filename: folderResult.filename || filename,
                    downloadedBytes: Number(folderResult.bytesWritten) || discovered.estimatedBytes || null,
                    estimatedBytes: discovered.estimatedBytes || Number(folderResult.expectedBytes) || null,
                    folderFallbackReason: null,
                });
                return;
            }
            if (wasSuperseded()) return;
            if (folderResult?.reason === 'offline-paused' || await rxShouldPauseArchiveQueueOffline()) {
                await updateJob({
                    status: 'pending',
                    startedAt: null,
                    downloadId: null,
                    error: null,
                    completedAt: null,
                    networkState: 'waiting-online',
                    networkResumePending: true,
                    networkPausedAt: Date.now(),
                });
                return;
            }
            folderFallbackReason = String(folderResult?.reason || 'folder-write-failed').slice(0, 120);
        } else if (folderState.selected) {
            folderFallbackReason = folderState.permission !== 'granted'
                ? 'folder-permission-' + folderState.permission
                : 'offscreen-unavailable';
        }

        if (await rxShouldPauseArchiveQueueOffline()) {
            await updateJob({
                status: 'pending',
                startedAt: null,
                error: null,
                completedAt: null,
                networkState: 'waiting-online',
                networkResumePending: true,
                networkPausedAt: Date.now(),
            });
            return;
        }
        if (wasSuperseded()) return;
        const downloadId = await rxStartManagedDownload(
            { url: discovered.url, filename, saveAs: false, conflictAction: 'uniquify' },
            { operation: 'archive-download', archiveJobId: id },
            recoveryGeneration,
        );
        if (wasSuperseded()) {
            // The transfer crossed an offline boundary before the queue could
            // adopt its ID. Remove only this stale RumbleX-owned dispatch so
            // the current queue generation remains the single source of truth.
            await rxUntrackManagedDownload(downloadId, recoveryGeneration);
            try { await rxDownloadsApi.cancel(downloadId); } catch {}
            return;
        }
        await updateJob({
            status: 'downloading',
            qualityFound: discovered.quality,
            videoTitle: title,
            filename,
            downloadId,
            estimatedBytes: discovered.estimatedBytes,
            destination: 'browser-downloads',
            destinationName: subfolder,
            folderFallbackReason,
            networkState: null,
            networkResumePending: false,
        });
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            rxHandleNetworkOffline().catch(() => {});
        }
    } catch (e) {
        if (wasSuperseded()) return;
        if (await rxShouldPauseArchiveQueueOffline()) {
            await updateJob({
                status: 'pending',
                startedAt: null,
                downloadId: null,
                error: null,
                completedAt: null,
                networkState: 'waiting-online',
                networkResumePending: true,
                networkPausedAt: Date.now(),
            });
            return;
        }
        await updateJob({
            status: 'failed',
            error: String(e?.message || e).slice(0, 200),
            completedAt: Date.now(),
        });
        try {
            await rxRecordDownloadDiagnostic({
                source: 'background',
                operation: 'archive-download',
                operationId: id,
                stage: discovered ? 'download-dispatch' : 'quality-discovery',
                error: { name: e?.name || 'Error', message: e?.message || e },
                quality: {
                    label: discovered?.quality || null,
                    height: discovered?.height || null,
                    requestedMaxHeight: cap || 'best',
                },
                extra: {
                    estimatedBytes: discovered?.estimatedBytes || null,
                },
                urls: [
                    { role: 'embed-api', url: 'https://rumble.com/embedJS/u3/?request=video&ver=2&v=' + encodeURIComponent(String(job.videoId || '')) },
                    ...(discovered?.url ? [{ role: 'download', url: discovered.url }] : []),
                ],
            }, recoveryGeneration);
        } catch {}
    }
}

async function rxHandleManagedDownloadChanged(delta) {
    await rxEnsurePendingResetStartupRecovery();
    if (!delta?.state) return { handled: false };
    const newState = delta.state.current;
    if (newState !== 'complete' && newState !== 'interrupted') return { handled: false };
    const archiveGeneration = rxArchiveNetworkGeneration;
    const recoveryGeneration = rxDownloadRecoveryGeneration;
    const superseded = () => archiveGeneration !== rxArchiveNetworkGeneration
        || recoveryGeneration !== rxDownloadRecoveryGeneration;

    const [root, managed] = await Promise.all([
        rxLoadArchiveQueue(),
        rxGetManagedDownload(delta.id),
    ]);
    if (superseded()) return { handled: false, superseded: true };
    const archiveJob = root.jobs.find((job) => job.downloadId === delta.id) || null;
    if (!archiveJob && !managed) return { handled: false };

    const item = await rxGetDownloadItem(delta.id);
    if (superseded()) return { handled: false, superseded: true };
    if (newState === 'complete') {
        await rxUntrackManagedDownload(delta.id, recoveryGeneration);
        if (superseded()) return { handled: false, superseded: true };
        if (archiveJob) {
            const size = Number(item?.fileSize || item?.totalBytes || item?.bytesReceived);
            await rxUpdateArchiveJob(archiveJob.id, {
                status: 'completed',
                completedAt: Date.now(),
                downloadedBytes: Number.isFinite(size) && size > 0 ? size : null,
                networkState: null,
                networkResumePending: false,
            }, archiveGeneration);
        }
        return { handled: true, completed: true };
    }

    const reason = String(delta.error?.current || item?.error || 'download-interrupted');
    const networkIssue = (typeof navigator !== 'undefined' && navigator.onLine === false)
        || /^NETWORK_/i.test(reason);
    const recoveryEnabled = await rxIsDownloadManagerEnabled();
    if (superseded()) return { handled: false, superseded: true };
    if (networkIssue && recoveryEnabled && item?.canResume) {
        if (!managed) {
            await rxTrackManagedDownload(delta.id, {
                operation: 'archive-download',
                archiveJobId: archiveJob?.id || null,
            }, recoveryGeneration);
            if (superseded()) return { handled: false, superseded: true };
        }
        await rxUpdateManagedDownload(delta.id, {
            resumePending: true,
            status: 'interrupted-offline',
            bytesReceived: item.bytesReceived,
            lastError: reason,
        }, recoveryGeneration);
        if (superseded()) return { handled: false, superseded: true };
        if (archiveJob) {
            await rxUpdateArchiveJob(archiveJob.id, {
                status: 'downloading',
                error: null,
                completedAt: null,
                networkState: 'waiting-online',
                networkResumePending: true,
                networkPausedAt: Date.now(),
            }, archiveGeneration);
        }
        return { handled: true, queued: true, resumable: true };
    }

    // Archive entries can always restart from their stable video ID even when
    // Chrome says the partial transfer itself cannot resume. Manual downloads
    // intentionally do not persist their signed raw URLs, so only archive jobs
    // receive this full-restart fallback.
    if (networkIssue && recoveryEnabled && archiveJob) {
        await rxUntrackManagedDownload(delta.id, recoveryGeneration);
        if (superseded()) return { handled: false, superseded: true };
        await rxUpdateArchiveJob(archiveJob.id, {
            status: 'pending',
            startedAt: null,
            downloadId: null,
            error: null,
            completedAt: null,
            networkState: 'waiting-online',
            networkResumePending: true,
            networkPausedAt: Date.now(),
        }, archiveGeneration);
        return { handled: true, queued: true, resumable: false };
    }

    await rxUntrackManagedDownload(delta.id, recoveryGeneration);
    if (superseded()) return { handled: false, superseded: true };
    if (archiveJob) {
        await rxUpdateArchiveJob(archiveJob.id, {
            status: 'failed',
            error: reason,
            completedAt: Date.now(),
            networkState: null,
            networkResumePending: false,
        }, archiveGeneration);
    }
    if (superseded()) return { handled: false, superseded: true };
    try {
        await rxRecordDownloadDiagnostic({
            source: 'background',
            operation: archiveJob ? 'archive-download' : (managed?.operation || 'direct-download'),
            operationId: archiveJob?.id || null,
            stage: 'browser-download',
            error: { message: 'Browser download was interrupted', code: reason },
            quality: { label: archiveJob?.qualityFound || null },
            browserDownloadId: delta.id,
        }, recoveryGeneration);
    } catch {}
    // The panel said "Download started!" long before this. Tell the tab that
    // asked, so it can say what went wrong instead of leaving that standing.
    if (!archiveJob && Number.isInteger(managed?.tabId)) {
        try {
            chrome.tabs.sendMessage(managed.tabId, { action: 'directDownloadInterrupted', downloadId: delta.id, reason }, () => {
                void chrome.runtime.lastError;
            });
        } catch {}
    }
    return { handled: true, failed: true };
}

if (chrome.downloads?.onChanged) {
    chrome.downloads.onChanged.addListener((delta) => {
        rxHandleManagedDownloadChanged(delta).catch((error) => {
            console.warn('[RumbleX] managed download change failed:', error);
        });
    });
}

if (chrome.downloads?.onErased) {
    chrome.downloads.onErased.addListener((downloadId) => {
        rxUntrackManagedDownload(downloadId).catch(() => {});
    });
}

// The context-menu worker handles links the content script never sees, but it
// consumes the same canonical privacy allowlist as every other runtime.
const RX_CM_TRACKING_PARAMS = new Set(RXSettingsSchema.TRACKING_QUERY_KEYS);

function rxStripTrackingFromUrl(href) {
    try {
        const u = new URL(href);
        if (!/(^|\.)rumble\.com$/i.test(u.hostname)) return href;
        for (const k of [...u.searchParams.keys()]) {
            if (RX_CM_TRACKING_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
        }
        return u.toString();
    } catch { return href; }
}

async function rxCopyToActiveTab(tabId, text) {
    // Service workers can't access navigator.clipboard reliably; the only
    // safe path is to inject a tiny copy script into the content tab.
    if (!chrome.scripting || typeof tabId !== 'number') return false;
    try {
        const [res] = await chrome.scripting.executeScript({
            target: { tabId },
            func: (t) => {
                try { navigator.clipboard.writeText(t); return true; }
                catch {
                    // Fallback: legacy execCommand via a temporary textarea.
                    const ta = document.createElement('textarea');
                    ta.value = t;
                    ta.style.position = 'fixed';
                    ta.style.top = '-10000px';
                    document.body.appendChild(ta);
                    ta.select();
                    try { return document.execCommand('copy'); }
                    finally { ta.remove(); }
                }
            },
            args: [text],
        });
        return !!(res && res.result);
    } catch (e) {
        console.warn('[RumbleX] copy script injection failed:', e);
        return false;
    }
}

if (chrome.contextMenus) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        await rxEnsurePendingResetStartupRecovery();
        if (!tab || typeof tab.id !== 'number') return;
        const tabId = tab.id;
        switch (info.menuItemId) {
            case RX_CM_IDS.copyClean: {
                const target = info.linkUrl || info.pageUrl || tab.url || '';
                const cleaned = rxStripTrackingFromUrl(target);
                await rxCopyToActiveTab(tabId, cleaned);
                return;
            }
            case RX_CM_IDS.copyAtTime: {
                // Ask the content script for the current video time + clean URL.
                chrome.tabs.sendMessage(tabId, { action: 'getVideoStateAtTime' }, async (resp) => {
                    void chrome.runtime.lastError;
                    if (!resp?.ok) {
                        // Fall back to the plain clean URL if there's no
                        // video on the page (e.g. user right-clicked on
                        // a feed/home/channel page).
                        await rxCopyToActiveTab(tabId, rxStripTrackingFromUrl(tab.url || ''));
                        return;
                    }
                    let out = resp.cleanUrl || tab.url || '';
                    if (resp.isWatch && Number.isFinite(resp.currentTime) && resp.currentTime > 0) {
                        try {
                            const u = new URL(out);
                            // Rumble's native timestamp param is `start`,
                            // per their share modal and existing v1.x
                            // shareTimestamp module. Stay consistent.
                            u.searchParams.set('start', String(resp.currentTime));
                            out = u.toString();
                        } catch {}
                    }
                    await rxCopyToActiveTab(tabId, out);
                });
                return;
            }
            case RX_CM_IDS.blockChannel: {
                // Prefer the link target — that's the channel the user
                // right-clicked on. Fall back to the page URL when they
                // right-clicked on a channel page itself.
                const candidate = info.linkUrl || info.pageUrl || tab.url || '';
                const slug = rxExtractChannelSlug(candidate);
                if (!slug) {
                    // The targetUrlPatterns filter on the entry should
                    // prevent this, but guard anyway: a creator's display
                    // name (Killstream) is NOT the channel slug
                    // (KillstreamLive) — extracting from the URL is the
                    // only reliable path.
                    return;
                }
                const s = await rxGetSettings();
                const list = Array.isArray(s.blockedChannels) ? s.blockedChannels.slice() : [];
                if (list.includes(slug)) {
                    // No-op when already blocked. Try to surface via a
                    // page-level toast through the existing in-content
                    // settings panel — only if the user is on a Rumble tab.
                    try {
                        chrome.tabs.sendMessage(tabId, {
                            action: 'rxShowToast',
                            text: `Channel "${slug}" already blocked`,
                        }, () => { void chrome.runtime.lastError; });
                    } catch {}
                    return;
                }
                list.push(slug);
                await rxSetSettings({ blockedChannels: list });
                try {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'rxShowToast',
                        text: `Blocked channel "${slug}" (${list.length} total). Reload feed to apply.`,
                    }, () => { void chrome.runtime.lastError; });
                } catch {}
                return;
            }
            case RX_CM_IDS.openSettings: {
                try {
                    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
                } catch (e) { console.warn('[RumbleX] openOptionsPage failed:', e); }
                return;
            }
        }
    });
}

const RX_MESSAGE_SENDER = Object.freeze({
    EXTENSION_PAGE: 'extension-page',
    CONTENT_SCRIPT: 'content-script',
});

function rxMessageRule(senders, fields = {}) {
    return Object.freeze({
        senders: Object.freeze(senders.slice()),
        fields: Object.freeze({ ...fields }),
    });
}

function rxMessageField(type, options = {}) {
    return Object.freeze({ type, ...options });
}

const RX_EXTENSION_ONLY = Object.freeze([RX_MESSAGE_SENDER.EXTENSION_PAGE]);
const RX_CONTENT_ONLY = Object.freeze([RX_MESSAGE_SENDER.CONTENT_SCRIPT]);
const RX_EXTENSION_OR_CONTENT = Object.freeze([
    RX_MESSAGE_SENDER.EXTENSION_PAGE,
    RX_MESSAGE_SENDER.CONTENT_SCRIPT,
]);

// The registry is the complete runtime-message contract. Every action handled
// below declares who may call it and which top-level fields it accepts. Custom
// field kinds validate nested records that can carry URLs or privileged data.
const RX_MESSAGE_ACTIONS = Object.freeze({
    getSettings: rxMessageRule(RX_EXTENSION_OR_CONTENT),
    patchSettings: rxMessageRule(RX_EXTENSION_OR_CONTENT, {
        data: rxMessageField('json-object', { required: true, maxBytes: 5 * 1024 * 1024 }),
        generation: rxMessageField('integer', { min: 0, max: Number.MAX_SAFE_INTEGER }),
    }),
    applyWelcomeSettings: rxMessageRule(RX_EXTENSION_ONLY, {
        data: rxMessageField('json-object', { required: true, maxBytes: 5 * 1024 * 1024 }),
    }),
    saveSettings: rxMessageRule(RX_EXTENSION_ONLY, {
        data: rxMessageField('json-object', { required: true, maxBytes: 5 * 1024 * 1024 }),
    }),
    importSettings: rxMessageRule(RX_EXTENSION_OR_CONTENT, {
        data: rxMessageField('json-object', { required: true, maxBytes: 5 * 1024 * 1024 }),
        localData: rxMessageField('json-object', { maxBytes: 5 * 1024 * 1024 }),
        mirror: rxMessageField('json-object', { maxBytes: 10 * 1024 * 1024 }),
    }),
    resetSettings: rxMessageRule(RX_EXTENSION_ONLY),
    createSettingsSnapshot: rxMessageRule(RX_EXTENSION_OR_CONTENT, {
        reason: rxMessageField('string', { maxLength: 80 }),
        captureActivity: rxMessageField('boolean'),
    }),
    listSettingsSnapshots: rxMessageRule(RX_EXTENSION_OR_CONTENT),
    restoreSettingsSnapshot: rxMessageRule(RX_EXTENSION_OR_CONTENT, {
        indexOrAt: rxMessageField('snapshot-ref', { required: true }),
    }),
    migrateActivity: rxMessageRule(RX_CONTENT_ONLY, {
        data: rxMessageField('json-object', { required: true, maxBytes: 10 * 1024 * 1024 }),
        removed: rxMessageField('string-array', { maxItems: 10_000, maxLength: 240 }),
        generation: rxMessageField('integer', { min: 0, max: Number.MAX_SAFE_INTEGER }),
        barrierId: rxMessageField('string', { maxLength: 200 }),
    }),
    writeActivity: rxMessageRule(RX_CONTENT_ONLY, {
        data: rxMessageField('json-object', { required: true, maxBytes: 10 * 1024 * 1024 }),
    }),
    rollbackActivity: rxMessageRule(RX_CONTENT_ONLY),
    updateRantMirror: rxMessageRule(RX_CONTENT_ONLY, {
        videoId: rxMessageField('id', { required: true }),
        entry: rxMessageField('json-object', { required: true, maxBytes: 2 * 1024 * 1024 }),
        maxVideos: rxMessageField('integer', { required: true, min: 1, max: 500 }),
        generation: rxMessageField('integer', { min: 0, max: Number.MAX_SAFE_INTEGER }),
    }),
    setRantRead: rxMessageRule(RX_EXTENSION_ONLY, {
        videoId: rxMessageField('id', { required: true }),
        read: rxMessageField('boolean', { required: true }),
    }),
    removeRantVideo: rxMessageRule(RX_EXTENSION_ONLY, {
        videoId: rxMessageField('id', { required: true }),
    }),
    clearRantMirror: rxMessageRule(RX_EXTENSION_ONLY),
    probeMedia: rxMessageRule(RX_EXTENSION_OR_CONTENT, {
        url: rxMessageField('download-url', { required: true }),
        scanId: rxMessageField('id', { required: true }),
        timeoutMs: rxMessageField('integer', { min: 1000, max: 60_000 }),
    }),
    cancelProbeScan: rxMessageRule(RX_EXTENSION_OR_CONTENT, {
        scanId: rxMessageField('id', { required: true }),
    }),
    recordDownloadDiagnostic: rxMessageRule(RX_EXTENSION_OR_CONTENT, {
        diagnostic: rxMessageField('json-object', { required: true, maxBytes: 256 * 1024 }),
    }),
    getDownloadDiagnostics: rxMessageRule(RX_EXTENSION_OR_CONTENT),
    clearDownloadDiagnostics: rxMessageRule(RX_EXTENSION_ONLY),
    checkUpdate: rxMessageRule(RX_EXTENSION_ONLY),
    openSettings: rxMessageRule(RX_EXTENSION_ONLY),
    getLocalData: rxMessageRule(RX_EXTENSION_ONLY),
    setLocalData: rxMessageRule(RX_EXTENSION_ONLY, {
        data: rxMessageField('json-object', { required: true, maxBytes: 5 * 1024 * 1024 }),
        mirror: rxMessageField('json-object', { maxBytes: 10 * 1024 * 1024 }),
    }),
    getPendingLocalDataOperation: rxMessageRule(RX_CONTENT_ONLY),
    applyPendingLocalDataOperation: rxMessageRule(RX_CONTENT_ONLY, {
        id: rxMessageField('id', { required: true }),
    }),
    pollLiveStreamApi: rxMessageRule(RX_CONTENT_ONLY),
    completePendingLocalDataOperation: rxMessageRule(RX_CONTENT_ONLY, {
        id: rxMessageField('id', { required: true }),
        cleared: rxMessageField('integer', { min: 0, max: 1_000_000 }),
        written: rxMessageField('integer', { min: 0, max: 1_000_000 }),
    }),
    addWatchedChannel: rxMessageRule(RX_EXTENSION_ONLY, {
        url: rxMessageField('rumble-url', { required: true, collection: true }),
        name: rxMessageField('string', { maxLength: 300 }),
    }),
    removeWatchedChannel: rxMessageRule(RX_EXTENSION_ONLY, {
        url: rxMessageField('rumble-url', { required: true, collection: true }),
    }),
    exportWatchedChannelsOpml: rxMessageRule(RX_EXTENSION_ONLY),
    listProfiles: rxMessageRule(RX_EXTENSION_ONLY),
    saveProfile: rxMessageRule(RX_EXTENSION_ONLY, {
        name: rxMessageField('string', { required: true, maxLength: 60 }),
    }),
    switchProfile: rxMessageRule(RX_EXTENSION_ONLY, {
        id: rxMessageField('id', { required: true }),
    }),
    deleteProfile: rxMessageRule(RX_EXTENSION_ONLY, {
        id: rxMessageField('id', { required: true }),
    }),
    restoreProfile: rxMessageRule(RX_EXTENSION_ONLY, {
        profile: rxMessageField('profile', { required: true }),
    }),
    runNotifierNow: rxMessageRule(RX_EXTENSION_ONLY),
    exportWatchHistory: rxMessageRule(RX_EXTENSION_ONLY),
    gistSyncPush: rxMessageRule(RX_EXTENSION_ONLY, {
        passphrase: rxMessageField('string', { required: true, maxLength: 1024 }),
    }),
    gistSyncPull: rxMessageRule(RX_EXTENSION_ONLY, {
        passphrase: rxMessageField('string', { required: true, maxLength: 1024 }),
    }),
    importFollowedChannels: rxMessageRule(RX_EXTENSION_ONLY),
    testNotification: rxMessageRule(RX_EXTENSION_ONLY),
    groupRumbleTabs: rxMessageRule(RX_EXTENSION_ONLY),
    parseHtmlOffscreen: rxMessageRule(RX_EXTENSION_ONLY, {
        html: rxMessageField('string', { required: true, maxLength: 2 * 1024 * 1024 }),
    }),
    hashBlobOffscreen: rxMessageRule(RX_EXTENSION_ONLY, {
        url: rxMessageField('download-url', { required: true }),
    }),
    download: rxMessageRule(RX_CONTENT_ONLY, {
        data: rxMessageField('download', { required: true }),
        diagnostic: rxMessageField('json-object', { maxBytes: 256 * 1024 }),
    }),
    downloadRecoveryGetState: rxMessageRule(RX_EXTENSION_ONLY),
    downloadRecoveryRunNow: rxMessageRule(RX_EXTENSION_ONLY),
    archiveEnqueueChannel: rxMessageRule(RX_EXTENSION_OR_CONTENT, {
        channelUrl: rxMessageField('rumble-url', { required: true, collection: true, allowPlaylist: true }),
        maxItems: rxMessageField('integer', { min: 1, max: 500 }),
        filterClips: rxMessageField('boolean'),
    }),
    archiveGetQueue: rxMessageRule(RX_EXTENSION_ONLY),
    archivePauseQueue: rxMessageRule(RX_EXTENSION_ONLY),
    archiveResumeQueue: rxMessageRule(RX_EXTENSION_ONLY),
    archiveClearCompleted: rxMessageRule(RX_EXTENSION_ONLY),
    archiveClearQueue: rxMessageRule(RX_EXTENSION_ONLY),
    archiveRemoveJob: rxMessageRule(RX_EXTENSION_ONLY, {
        id: rxMessageField('id', { required: true }),
    }),
    archiveRetryJob: rxMessageRule(RX_EXTENSION_ONLY, {
        id: rxMessageField('id', { required: true }),
    }),
    archiveRetryFailed: rxMessageRule(RX_EXTENSION_ONLY),
    archivePreflightQueue: rxMessageRule(RX_EXTENSION_ONLY),
    archiveExportQueue: rxMessageRule(RX_EXTENSION_ONLY),
    archiveImportQueue: rxMessageRule(RX_EXTENSION_ONLY, {
        payload: rxMessageField('archive-import', { required: true }),
    }),
    archiveRunNow: rxMessageRule(RX_EXTENSION_ONLY),
});

function rxIsPlainMessageObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function rxMessageHasOnlyKeys(value, allowed) {
    return rxIsPlainMessageObject(value)
        && Object.keys(value).every((key) => allowed.has(key));
}

function rxMessageJsonWithin(value, maxBytes) {
    try {
        return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxBytes;
    } catch {
        return false;
    }
}

function rxIsSafeMessageRumbleUrl(value, { collection = false, allowPlaylist = false } = {}) {
    if (typeof value !== 'string') return false;
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password) return false;
        if (!/(^|\.)rumble\.com$/i.test(url.hostname)) return false;
        if (!collection) return true;
        const routes = allowPlaylist ? '(?:c|user|playlists)' : '(?:c|user)';
        return new RegExp(`^/${routes}/[^/]+`, 'i').test(url.pathname);
    } catch {
        return false;
    }
}

function rxValidateDownloadPayload(value) {
    if (!rxMessageHasOnlyKeys(value, new Set(['url', 'filename']))) return false;
    if (!isAllowedDownloadUrl(value.url)) return false;
    return value.filename === undefined
        || (typeof value.filename === 'string' && value.filename.length <= 500);
}

function rxValidateProfilePayload(value) {
    const allowed = new Set(['id', 'name', 'createdAt', 'settings']);
    if (!rxMessageHasOnlyKeys(value, allowed)) return false;
    if (!rxValidateMessageField(value.id, rxMessageField('id', { required: true }))) return false;
    if (value.name !== undefined && (typeof value.name !== 'string' || value.name.length > 60)) return false;
    if (value.createdAt !== undefined && (!Number.isFinite(Number(value.createdAt)) || Number(value.createdAt) <= 0)) return false;
    return rxIsPlainMessageObject(value.settings) && rxMessageJsonWithin(value.settings, 5 * 1024 * 1024);
}

function rxValidateArchiveImportPayload(value) {
    const rootKeys = new Set(['schemaVersion', 'exportedAt', 'extensionVersion', 'paused', 'jobs']);
    if (!rxMessageHasOnlyKeys(value, rootKeys) || value.schemaVersion !== RX_ARCHIVE_EXPORT_SCHEMA) return false;
    if (!Array.isArray(value.jobs) || value.jobs.length > RX_ARCHIVE_MAX_JOBS) return false;
    if (value.exportedAt !== undefined && typeof value.exportedAt !== 'string') return false;
    if (value.extensionVersion !== undefined && typeof value.extensionVersion !== 'string') return false;
    if (value.paused !== undefined && typeof value.paused !== 'boolean') return false;
    for (const job of value.jobs) {
        // Queue imports are deliberately forward-compatible. The normalizer
        // below skips malformed jobs and drops fields it does not recognize;
        // this boundary only blocks unsafe URLs and pathological structures.
        if (!rxIsPlainMessageObject(job)) return false;
        if (job.channelUrl != null && !rxIsSafeMessageRumbleUrl(job.channelUrl, { collection: true, allowPlaylist: true })) return false;
        if (job.videoUrl != null && !rxIsSafeMessageRumbleUrl(job.videoUrl)) return false;
    }
    return rxMessageJsonWithin(value, 5 * 1024 * 1024);
}

function rxValidateMessageField(value, field) {
    if (value === undefined) return field.required !== true;
    switch (field.type) {
        case 'string':
            return typeof value === 'string'
                && value.length <= (field.maxLength || 4096);
        case 'id':
            return typeof value === 'string'
                && value.length > 0
                && value.length <= 160
                && /^[A-Za-z0-9_.:-]+$/.test(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'integer':
            return Number.isInteger(value)
                && value >= (field.min ?? Number.MIN_SAFE_INTEGER)
                && value <= (field.max ?? Number.MAX_SAFE_INTEGER);
        case 'string-array':
            return Array.isArray(value)
                && value.length <= (field.maxItems || 10_000)
                && value.every((item) => typeof item === 'string'
                    && item.length <= (field.maxLength || 4096));
        case 'snapshot-ref':
            return (Number.isInteger(value) && value >= 0)
                || (typeof value === 'string'
                    && value.length <= 64
                    && Number.isFinite(Date.parse(value)));
        case 'json-object':
            return rxIsPlainMessageObject(value)
                && rxMessageJsonWithin(value, field.maxBytes || 1024 * 1024);
        case 'rumble-url':
            return rxIsSafeMessageRumbleUrl(value, field);
        case 'download-url':
            return typeof value === 'string' && isAllowedDownloadUrl(value);
        case 'download':
            return rxValidateDownloadPayload(value);
        case 'profile':
            return rxValidateProfilePayload(value);
        case 'archive-import':
            return rxValidateArchiveImportPayload(value);
        default:
            return false;
    }
}

function rxClassifyMessageSender(sender) {
    if (!sender || sender.id !== chrome.runtime.id) return null;
    const ownOrigin = new URL(chrome.runtime.getURL('/')).origin;
    const rawUrl = sender.url || sender.origin || sender.tab?.url || '';
    try {
        const url = new URL(rawUrl);
        if (url.origin === ownOrigin) return RX_MESSAGE_SENDER.EXTENSION_PAGE;
        if (sender.tab && url.protocol === 'https:' && /(^|\.)rumble\.com$/i.test(url.hostname)) {
            return RX_MESSAGE_SENDER.CONTENT_SCRIPT;
        }
    } catch {}
    return null;
}

function rxAuthorizeRuntimeMessage(message, sender) {
    if (!rxIsPlainMessageObject(message) || typeof message.action !== 'string') {
        return { handled: false, ok: false };
    }
    if (!Object.hasOwn(RX_MESSAGE_ACTIONS, message.action)) {
        return { handled: true, ok: false, reason: 'unknown-action' };
    }
    const rule = RX_MESSAGE_ACTIONS[message.action];
    const senderClass = rxClassifyMessageSender(sender);
    if (!senderClass || !rule.senders.includes(senderClass)) {
        return { handled: true, ok: false, reason: 'sender-not-allowed' };
    }
    const allowedKeys = new Set(['action', ...Object.keys(rule.fields)]);
    const unknownField = Object.keys(message).find((key) => !allowedKeys.has(key));
    if (unknownField) {
        return { handled: true, ok: false, reason: 'invalid-payload', field: unknownField };
    }
    for (const [name, field] of Object.entries(rule.fields)) {
        if (!rxValidateMessageField(message[name], field)) {
            return { handled: true, ok: false, reason: 'invalid-payload', field: name };
        }
    }
    return { handled: true, ok: true, senderClass };
}

function rxHandleAuthorizedRuntimeMessage(message, sender, sendResponse, authorization) {
    // Pass-through reads — kept for parity with earlier versions in case any
    // consumer (popup, options, userscript) still asks the worker for state.
    if (message.action === 'getSettings') {
        chrome.storage.local.get('rx_settings', (data) => {
            const normalized = rxNormalizeSettings(data.rx_settings || {});
            const response = authorization.senderClass === RX_MESSAGE_SENDER.CONTENT_SCRIPT
                ? RXSettingsSchema.sanitizeSettingsForTransport(normalized)
                : normalized;
            sendResponse(response);
        });
        return true;
    }

    if (message.action === 'saveSettings') {
        rxQueueSettingsWrite(message.data, { replace: true })
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error?.message || String(error) }));
        return true;
    }

    if (message.action === 'createSettingsSnapshot') {
        rxQueueSettingsSnapshot(message.reason || 'manual', {
            captureActivity: message.captureActivity === true,
        })
            .then((snapshot) => sendResponse(snapshot))
            .catch((error) => sendResponse({ ok: false, reason: 'storage', error: error?.message || String(error) }));
        return true;
    }

    if (message.action === 'listSettingsSnapshots') {
        rxSettingsWriteChain.catch(() => {})
            .then(() => chrome.storage.local.get('rx_settings_snapshots'))
            .then((stored) => {
                const snapshots = Array.isArray(stored.rx_settings_snapshots)
                    ? stored.rx_settings_snapshots
                    : [];
                sendResponse({
                    ok: true,
                    snapshots: snapshots.map((snapshot, index) => ({
                        index,
                        at: snapshot?.at,
                        reason: snapshot?.reason,
                    })),
                });
            })
            .catch((error) => sendResponse({ ok: false, reason: 'storage', error: error?.message || String(error) }));
        return true;
    }

    if (message.action === 'restoreSettingsSnapshot') {
        rxQueueSettingsRestore(message.indexOrAt)
            .then(sendResponse)
            .catch((error) => sendResponse({
                ok: false,
                reason: error?.partial ? 'partial-restore' : 'storage',
                partial: error?.partial === true,
                error: error?.message || String(error),
            }));
        return true;
    }

    if (message.action === 'migrateActivity') {
        let origin = null;
        try {
            const sourceUrl = sender?.url || sender?.tab?.url || '';
            const parsed = new URL(sourceUrl);
            if (parsed.protocol === 'https:'
                && (parsed.hostname === 'rumble.com' || parsed.hostname.endsWith('.rumble.com'))) {
                origin = parsed.origin;
            }
        } catch {}
        if (!origin) {
            sendResponse({ ok: false, reason: 'invalid-origin' });
            return false;
        }
        rxQueueActivityMigration(message.data, origin, message.generation, message.removed, message.barrierId)
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: 'storage', error: error?.message || String(error) }));
        return true;
    }

    if (message.action === 'writeActivity') {
        rxQueueActivityWrite(message.data)
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: 'storage', error: error?.message || String(error) }));
        return true;
    }

    if (message.action === 'rollbackActivity') {
        rxQueueActivityRollback()
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: 'storage', error: error?.message || String(error) }));
        return true;
    }

    if (message.action === 'updateRantMirror') {
        rxQueueRantMirrorUpdate(message.videoId, message.entry, message.maxVideos, message.generation)
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: 'storage', error: error?.message || String(error) }));
        return true;
    }

    if (message.action === 'setRantRead' || message.action === 'removeRantVideo'
        || message.action === 'clearRantMirror') {
        const operation = message.action === 'setRantRead'
            ? 'read'
            : message.action === 'removeRantVideo'
                ? 'remove'
                : 'clear';
        rxQueueRantMirrorMutation(operation, message.videoId, message.read)
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: 'storage', error: error?.message || String(error) }));
        return true;
    }

    if (message.action === 'importSettings') {
        rxQueueSettingsBundleImport(message.data, {
            localData: message.localData,
            mirrorProvided: message.mirror !== undefined,
            mirror: message.mirror,
        })
            .then((result) => sendResponse({
                success: true,
                settings: result.settings,
                snapshot: result.snapshot,
                activity: result.activity,
            }))
            .catch((error) => sendResponse({ success: false, error: error?.message || String(error) }));
        return true;
    }

    if (message.action === 'resetSettings') {
        rxQueueSettingsReset()
            .then((result) => sendResponse({ success: true, ...result }))
            .catch((error) => sendResponse({
                success: false,
                partial: error?.partial === true,
                error: error?.message || String(error),
            }));
        return true;
    }

    if (message.action === 'patchSettings') {
        rxQueueSettingsWrite(message.data, {
            expectedGeneration: message.generation,
            requireGeneration: authorization.senderClass === RX_MESSAGE_SENDER.CONTENT_SCRIPT,
        })
            .then((settings) => sendResponse({ success: true, settings }))
            .catch((error) => sendResponse({
                success: false,
                reason: error?.code || 'storage',
                generation: error?.generation,
                error: error?.message || String(error),
            }));
        return true;
    }

    if (message.action === 'applyWelcomeSettings') {
        rxQueueSettingsWrite(message.data, { extraValues: { rx_welcome_seen: true } })
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error?.message || String(error) }));
        return true;
    }

    if (message.action === 'probeMedia') {
        rxProbeMedia(message)
            .then((result) => sendResponse(result))
            .catch((e) => sendResponse({ ok: false, reason: 'network', detail: rxSanitizeDiagnosticString(e?.message || e) }));
        return true;
    }

    if (message.action === 'cancelProbeScan') {
        sendResponse({ ok: true, cancelled: rxCancelProbeScan(String(message.scanId)) });
        return false;
    }

    if (message.action === 'recordDownloadDiagnostic') {
        const recoveryGeneration = rxDownloadRecoveryGeneration;
        rxRecordDownloadDiagnostic(message.diagnostic, recoveryGeneration)
            .then((entry) => sendResponse(entry?.superseded
                ? { ok: false, reason: 'superseded' }
                : { ok: true, id: entry.id }))
            .catch((e) => sendResponse({ ok: false, reason: rxSanitizeDiagnosticString(e?.message || e) }));
        return true;
    }

    if (message.action === 'getDownloadDiagnostics') {
        rxBuildDownloadDiagnosticsBundle()
            .then((bundle) => sendResponse({ ok: true, bundle }))
            .catch((e) => sendResponse({ ok: false, reason: rxSanitizeDiagnosticString(e?.message || e) }));
        return true;
    }

    if (message.action === 'clearDownloadDiagnostics') {
        rxClearDownloadDiagnostics()
            .then(() => sendResponse({ ok: true }))
            .catch((e) => sendResponse({ ok: false, reason: rxSanitizeDiagnosticString(e?.message || e) }));
        return true;
    }

    if (message.action === 'checkUpdate') {
        const currentVersion = chrome.runtime.getManifest().version;
        fetch('https://api.github.com/repos/SysAdminDoc/RumbleX/releases/latest', {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
        })
            .then((r) => {
                if (r.ok) return r.json();
                // GitHub answers an exhausted unauthenticated quota with 403 (or
                // 429) plus a zeroed remaining header. That is a "try later",
                // not "no release" — the popup must not show it as a plain
                // failure, and must never treat it as being up to date.
                const remaining = r.headers?.get?.('X-RateLimit-Remaining');
                const rateLimited = (r.status === 403 || r.status === 429) && remaining === '0';
                return Promise.reject(rateLimited ? 'rate-limited' : 'http-' + r.status);
            })
            .then((data) => {
                const latest = (data.tag_name || '').replace(/^v/, '');
                sendResponse({
                    current: currentVersion,
                    latest,
                    url: data.html_url || '',
                    // Compare numerically. String inequality reported an update
                    // whenever the tag differed at all, so a published release
                    // older than the installed build — which is exactly the
                    // state this repo was in — prompted a downgrade.
                    hasUpdate: !!latest && rxCompareVersions(latest, currentVersion) > 0,
                });
            })
            .catch((err) => {
                const reason = String(err);
                sendResponse({
                    error: reason,
                    rateLimited: reason === 'rate-limited',
                    current: currentVersion,
                });
            });
        return true;
    }

    if (message.action === 'openSettings') {
        // Shift-click in the popup asks the active tab to open its in-page
        // settings modal. This only works when the active tab is running the
        // RumbleX content script (rumble.com).
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || typeof tab.id !== 'number') {
                sendResponse({ ok: false, reason: 'no active tab' });
                return;
            }
            chrome.tabs.sendMessage(tab.id, { action: 'openSettingsModal' }, () => {
                // chrome.runtime.lastError is set when no receiver (non-Rumble
                // tab). We still need to clear it to avoid console noise.
                const err = chrome.runtime.lastError;
                sendResponse(err
                    ? { ok: false, reason: err.message }
                    : { ok: true }
                );
            });
        });
        return true;
    }

    if (message.action === 'getLocalData') {
        // Ask the first available Rumble tab for its localStorage payload.
        // We query a single tab (not all) because localStorage is identical
        // per-origin, so multiple tabs would return the same data — wasteful
        // and noisy. If no Rumble tab is open, respond with an empty payload
        // and let the caller proceed with a settings-only export.
        chrome.tabs.query({ url: ['*://rumble.com/*', '*://*.rumble.com/*'] }, (tabs) => {
            const tab = tabs && tabs.find((t) => typeof t.id === 'number');
            if (!tab) {
                rxGetPendingLocalDataOperation()
                    .then((op) => {
                        sendResponse({
                            ok: true,
                            data: {},
                            tabs: 0,
                            pending: !!op,
                            keys: 0,
                        });
                    })
                    .catch(() => sendResponse({ ok: true, data: {}, tabs: 0 }));
                return;
            }
            chrome.tabs.sendMessage(tab.id, { action: 'getLocalData' }, (resp) => {
                void chrome.runtime.lastError;
                sendResponse({
                    ok: true,
                    tabs: tabs.length,
                    data: (resp?.ok && resp.data) ? resp.data : {},
                    keys: resp?.keys || 0,
                });
            });
        });
        return true;
    }

    if (message.action === 'setLocalData') {
        // Commit imported activity once in extension storage, advance the
        // generation barrier, then make each open origin clear old page copies
        // and reload that exact generation. Delayed pre-import writes are
        // rejected instead of winning after the restore reports success.
        const payload = RXActivityStore.sanitizeLocalActivity(message.data);
        rxQueueImportedActivity(payload, message.mirror !== undefined, message.mirror)
            .then(sendResponse)
            .catch((e) => sendResponse({ ok: false, reason: String(e?.message || e) }));
        return true;
    }

    if (message.action === 'pollLiveStreamApi') {
        rxPollLiveApi()
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'getPendingLocalDataOperation') {
        Promise.all([
            rxGetPendingLocalDataOperation(rxSenderRumbleOrigin(sender)),
            rxReadPendingLocalDataOperation(),
        ])
            .then(([op, current]) => sendResponse({
                ok: true,
                operation: op,
                barrierId: typeof current?.id === 'string' ? current.id : '',
            }))
            .catch((e) => sendResponse({ ok: false, reason: String(e?.message || e) }));
        return true;
    }

    if (message.action === 'completePendingLocalDataOperation') {
        rxCompletePendingLocalDataOperation(String(message.id || ''), {
            cleared: message.cleared,
            written: message.written,
            origin: rxSenderRumbleOrigin(sender),
        })
            .then((resp) => sendResponse(resp))
            .catch((e) => sendResponse({ ok: false, reason: String(e?.message || e) }));
        return true;
    }

    // v3.2.0 — Offscreen proxies. Content scripts cannot create offscreen
    // documents directly; they go through the service worker. Both calls
    // are async and use the keep-channel-open pattern. Falls back to a
    // structured failure response if offscreen is unsupported (Firefox MV2
    // or older Chrome) so the caller can degrade gracefully.
    // v3.9.0 — Channel Notifier message API.
    // Options page sends these messages; we don't expose them to content
    // scripts so a compromised rumble.com page can't add itself to the
    // watched list. (The sender check is conservative — message.action
    // is recognized only from extension-origin pages because the SW
    // serves both, but worth gating defensively.)
    if (message.action === 'addWatchedChannel') {
        (async () => {
            const url = String(message.url || '').trim();
            const name = String(message.name || '').trim();
            const safeUrl = rxSafeRumbleUrl(url);
            if (!safeUrl) { sendResponse({ ok: false, reason: 'bad-rumble-url' }); return; }
            const result = await rxQueueWatchedChannelAdd(safeUrl, name);
            if (!result.ok) { sendResponse(result); return; }
            await rxSyncChannelNotifier();
            sendResponse(result);
        })();
        return true;
    }
    if (message.action === 'removeWatchedChannel') {
        (async () => {
            const url = rxSafeRumbleUrl(String(message.url || ''));
            if (!url) { sendResponse({ ok: false, reason: 'bad-rumble-url' }); return; }
            const result = await rxQueueWatchedChannelRemove(url);
            await rxSyncChannelNotifier();
            sendResponse(result);
        })();
        return true;
    }
    // v3.10.0 — Watched-channels OPML export. Generates an OPML 2.0 outline
    // that any RSS reader can import. Each rumble.com channel gets a
    // synthesised feed URL using Rumble's official `_rss` suffix pattern
    // documented in the Rumble support docs.
    if (message.action === 'exportWatchedChannelsOpml') {
        (async () => {
            const s = await rxGetSettings();
            const channels = Array.isArray(s.watchedChannels) ? s.watchedChannels : [];
            const esc = (x) => String(x || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
            const lines = [];
            lines.push('<?xml version="1.0" encoding="UTF-8"?>');
            lines.push('<opml version="2.0">');
            lines.push('  <head>');
            lines.push('    <title>RumbleX watched channels</title>');
            lines.push('    <dateCreated>' + new Date().toUTCString() + '</dateCreated>');
            lines.push('  </head>');
            lines.push('  <body>');
            lines.push('    <outline text="Rumble" title="Rumble">');
            for (const c of channels) {
                if (!c?.url) continue;
                // Rumble channel pages have an embedded RSS feed reachable
                // by appending `?rss=1` or via the legacy `_rss` route. We
                // emit both — RSS readers will pick whichever they prefer.
                const xmlUrl = c.url.replace(/\/?$/, '') + '?rss=1';
                lines.push('      <outline type="rss" text="' + esc(c.name || c.url) + '" title="' + esc(c.name || c.url) + '" xmlUrl="' + esc(xmlUrl) + '" htmlUrl="' + esc(c.url) + '" />');
            }
            lines.push('    </outline>');
            lines.push('  </body>');
            lines.push('</opml>');
            sendResponse({ ok: true, opml: lines.join('\n'), count: channels.length });
        })();
        return true;
    }

    // v3.10.0 — Multi-profile settings.
    // Profiles are named full snapshots of rx_settings stored in their own
    // bucket `rx_settings_profiles`. switchProfile swaps the live settings
    // for the profile's frozen copy (snapshotting current state first so
    // the previous profile's drift isn't lost).
    if (message.action === 'listProfiles') {
        rxListProfiles()
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'applyPendingLocalDataOperation') {
        rxApplyPendingLocalDataOperation(
            String(message.id || ''),
            rxSenderRumbleOrigin(sender),
        )
            .then(sendResponse)
            .catch((e) => sendResponse({ ok: false, reason: String(e?.message || e) }));
        return true;
    }
    if (message.action === 'saveProfile') {
        const name = String(message.name || '').trim();
        if (!name) {
            sendResponse({ ok: false, reason: 'empty-name' });
            return false;
        }
        rxQueueProfileSave(name)
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }
    if (message.action === 'switchProfile') {
        rxQueueProfileSwitch(String(message.id || ''))
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }
    if (message.action === 'deleteProfile') {
        rxQueueProfileDelete(String(message.id || ''))
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }
    // Restore a profile blob returned by deleteProfile's `undo` payload.
    if (message.action === 'restoreProfile') {
        const profile = message.profile;
        if (!profile || typeof profile !== 'object' || !profile.id) {
            sendResponse({ ok: false, reason: 'invalid-profile' });
            return false;
        }
        rxQueueProfileRestore(profile)
            .then(sendResponse)
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'runNotifierNow') {
        rxRunNotifierPass()
            .then(() => sendResponse({ ok: true }))
            .catch((e) => sendResponse({ ok: false, reason: String(e?.message || e) }));
        return true;
    }
    // v3.13.0 — Import followed channels into the v3.9 watchedChannels list.
    // One-click bulk-add: fetches /account/following with the user's session
    // cookies, parses each <li class="followed-channel"> for URL + name,
    // merges into watchedChannels skipping duplicates. The user's actual
    // followed list becomes the seed for the notifier without a manual
    // per-channel paste.
    //
    // Failure modes the user can see:
    //   - not logged in → page returns login redirect; we extract 0
    //     channels and the toast suggests opening a Rumble tab + signing in
    //   - 0 entries on a logged-in account → fine, toast says so
    //   - fetch error → toast with HTTP status
    // v3.15.0 — Watch History export.
    // Fetches /account/playlists/watch-history with the user's session,
    // parses each <li class="videostream__details" data-video-id="..."> row,
    // returns a structured JSON dump. Rumble doesn't natively offer this.
    //
    // Failure modes:
    //   - not logged in   → page returns logged-out shell with no items
    //   - empty history   → 0-row response, ok:true
    //   - HTTP error      → returned as { ok:false, reason:'http-NNN' }
    if (message.action === 'exportWatchHistory') {
        (async () => {
            try {
                const resp = await fetch('https://rumble.com/account/playlists/watch-history', {
                    method: 'GET', credentials: 'include',
                });
                if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                const html = await resp.text();
                // Guard: the logged-out shell omits videostream__list/details
                // entirely, so we can detect "not logged in" by absence of
                // the watch-history playlist data marker.
                if (!html.includes('data-playlist="watch-history"') && !html.includes('videostream_details')) {
                    sendResponse({ ok: false, reason: 'not-logged-in' });
                    return;
                }
                // Pull each <li class="videostream__details" data-video-id="...">.
                // Tolerate attribute-order variation by anchoring on the class
                // marker, then a non-greedy capture up to </li>.
                const rows = [];
                const re = /<li[^>]*\bvideostream__details\b[^>]*\bdata-video-id="(\d+)"[\s\S]*?<\/li>/g;
                let m;
                while ((m = re.exec(html))) {
                    const block = m[0];
                    const videoId = m[1];
                    const titleMatch = block.match(/<h3[^>]*\bthumbnail__title\b[^>]*title="([^"]*)"/) || block.match(/<h3[^>]*\bthumbnail__title\b[^>]*>([^<]+)/);
                    const urlMatch = block.match(/<a[^>]*videostream__link[^>]*href="([^"]+)"/) || block.match(/<a[^>]*title__link[^>]*href="([^"]+)"/);
                    const durMatch = block.match(/videostream__status--duration[^>]*>\s*([^<]+?)\s*</);
                    const pctMatch = block.match(/--watched-percentage:\s*([\d.]+)%/);
                    const thumbMatch = block.match(/<img[^>]*\bthumbnail__image\b[^>]*src="([^"]+)"/);
                    const channelMatch = block.match(/<a[^>]*\bchannel__link\b[^>]*href="([^"]+)"[^>]*>([^<]+)</);
                    // Clean URL: strip e9s/playlist_id query so the export is
                    // canonical (consistent with v2.4 StripTrackingParams).
                    let cleanUrl = urlMatch ? urlMatch[1] : null;
                    if (cleanUrl) {
                        try {
                            const u = new URL(cleanUrl, 'https://rumble.com');
                            for (const k of ['e9s', 'playlist_id']) u.searchParams.delete(k);
                            cleanUrl = u.toString();
                        } catch {}
                    }
                    rows.push({
                        videoId,
                        title: titleMatch ? titleMatch[1].trim() : null,
                        url: cleanUrl,
                        duration: durMatch ? durMatch[1].trim() : null,
                        watchedPercentage: pctMatch ? Number(pctMatch[1]) : null,
                        thumbnail: thumbMatch ? thumbMatch[1] : null,
                        channelUrl: channelMatch ? channelMatch[1] : null,
                        channelName: channelMatch ? channelMatch[2].trim() : null,
                    });
                }
                sendResponse({
                    ok: true,
                    count: rows.length,
                    exportedAt: new Date().toISOString(),
                    items: rows,
                });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true;
    }

    // v3.17.0 — Encrypted Gist Sync. Push: encrypt rx_settings with a
    // passphrase-derived AES-GCM key, store the ciphertext as a single file
    // in a GitHub gist. Pull: GET the gist, decrypt with the same passphrase.
    // The passphrase is NEVER stored — caller passes it in on every call.
    // host_permissions for api.github.com is declared in manifest.json.
    if (message.action === 'gistSyncPush' || message.action === 'gistSyncPull') {
        (async () => {
            try {
                const operationGeneration = rxSettingsMutationGeneration;
                const superseded = () => operationGeneration !== rxSettingsMutationGeneration;
                const stored = await new Promise((resolve) => {
                    chrome.storage.local.get(['rx_settings'], resolve);
                });
                if (superseded()) { sendResponse({ ok: false, reason: 'superseded' }); return; }
                const settings = rxNormalizeSettings(
                    stored && stored.rx_settings && typeof stored.rx_settings === 'object'
                        ? stored.rx_settings
                        : {},
                );
                // The `encryptedGistSync` master switch shipped with the feature in
                // v3.17.0 but was never consulted, so a user who turned the feature
                // off still had a working push/pull path — the toggle was decorative
                // on a control that moves every setting to a third-party host.
                // Honor it here, at the only entry point, so the answer is the same
                // whichever surface asks.
                if (!settings.encryptedGistSync) {
                    sendResponse({ ok: false, reason: 'sync-disabled' });
                    return;
                }
                const token = (settings.encryptedGistSyncToken || '').trim();
                const gistId = (settings.encryptedGistSyncId || '').trim();
                const passphrase = (message.passphrase || '').trim();
                if (!token) { sendResponse({ ok: false, reason: 'missing-token' }); return; }
                if (!passphrase || passphrase.length < 8) { sendResponse({ ok: false, reason: 'weak-passphrase' }); return; }

                const enc = new TextEncoder();
                const dec = new TextDecoder();
                const baseKey = await crypto.subtle.importKey(
                    'raw', enc.encode(passphrase), { name: 'PBKDF2' }, false, ['deriveKey']
                );
                if (superseded()) { sendResponse({ ok: false, reason: 'superseded' }); return; }

                const b64 = (buf) => {
                    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
                    const chunks = [];
                    for (let offset = 0; offset < bytes.length; offset += 32 * 1024) {
                        chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32 * 1024)));
                    }
                    return btoa(chunks.join(''));
                };
                const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

                if (message.action === 'gistSyncPush') {
                    const salt = crypto.getRandomValues(new Uint8Array(16));
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const aesKey = await crypto.subtle.deriveKey(
                        { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
                        baseKey,
                        { name: 'AES-GCM', length: 256 },
                        false,
                        ['encrypt']
                    );
                    const transportSettings = RXSettingsSchema.sanitizeSettingsForTransport(settings);
                    const plaintext = enc.encode(JSON.stringify(transportSettings));
                    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
                    if (superseded()) { sendResponse({ ok: false, reason: 'superseded' }); return; }
                    const payload = {
                        rumblex: {
                            schemaVersion: 3,
                            cipher: 'AES-GCM-256',
                            kdf: 'PBKDF2-SHA256-200000',
                            salt: b64(salt),
                            iv: b64(iv),
                            ciphertext: b64(cipherBuf),
                            encryptedAt: new Date().toISOString(),
                        },
                    };

                    const body = JSON.stringify({
                        description: 'RumbleX encrypted settings backup',
                        public: false,
                        files: { 'rumblex-settings.enc.json': { content: JSON.stringify(payload, null, 2) } },
                    });
                    const url = gistId ? ('https://api.github.com/gists/' + gistId) : 'https://api.github.com/gists';
                    const resp = await fetch(url, {
                        method: gistId ? 'PATCH' : 'POST',
                        headers: {
                            'Accept': 'application/vnd.github+json',
                            'Authorization': 'Bearer ' + token,
                            'Content-Type': 'application/json',
                            'X-GitHub-Api-Version': '2022-11-28',
                        },
                        body,
                    });
                    if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                    const data = await resp.json();
                    const newId = data && data.id ? data.id : gistId;
                    // Persist the gist id if this was a CREATE.
                    if (!gistId && newId) {
                        if (superseded()) {
                            sendResponse({ ok: false, reason: 'superseded', gistId: newId });
                            return;
                        }
                        await rxQueueSettingsWrite({ encryptedGistSyncId: newId });
                    }
                    sendResponse({ ok: true, gistId: newId, bytes: JSON.stringify(payload).length });
                    return;
                }

                // Pull
                if (!gistId) { sendResponse({ ok: false, reason: 'missing-gist-id' }); return; }
                const resp = await fetch('https://api.github.com/gists/' + gistId, {
                    headers: {
                        'Accept': 'application/vnd.github+json',
                        'Authorization': 'Bearer ' + token,
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                });
                if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                const data = await resp.json();
                const files = data && data.files ? data.files : {};
                const file = files['rumblex-settings.enc.json'] || Object.values(files)[0];
                if (!file || !file.content) { sendResponse({ ok: false, reason: 'no-payload' }); return; }
                let parsed;
                try { parsed = JSON.parse(file.content); } catch { sendResponse({ ok: false, reason: 'bad-json' }); return; }
                const env = parsed && parsed.rumblex;
                if (!env || !env.ciphertext || !env.iv || !env.salt) { sendResponse({ ok: false, reason: 'malformed-payload' }); return; }
                const aesKey = await crypto.subtle.deriveKey(
                    { name: 'PBKDF2', salt: fromB64(env.salt), iterations: 200000, hash: 'SHA-256' },
                    baseKey,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['decrypt']
                );
                let plainBuf;
                try {
                    plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(env.iv) }, aesKey, fromB64(env.ciphertext));
                } catch {
                    sendResponse({ ok: false, reason: 'bad-passphrase' });
                    return;
                }
                let pulled;
                try { pulled = JSON.parse(dec.decode(plainBuf)); } catch { sendResponse({ ok: false, reason: 'bad-decoded-json' }); return; }
                if (!pulled || typeof pulled !== 'object' || Array.isArray(pulled)) {
                    sendResponse({ ok: false, reason: 'invalid-settings' });
                    return;
                }
                // Remote payloads never own local credentials. Preserve the
                // values that are current when this queued replacement commits,
                // not the snapshot read before the network request started.
                // The same commit snapshots the complete current profile first.
                const portable = RXSettingsSchema.sanitizeSettingsForTransport(pulled);
                if (superseded()) { sendResponse({ ok: false, reason: 'superseded' }); return; }
                const next = await rxQueueSettingsWrite(portable, {
                    replace: true,
                    preserveOmittedSecrets: true,
                    snapshotReason: 'pre-gist-pull',
                });
                sendResponse({ ok: true, encryptedAt: env.encryptedAt || null, keyCount: Object.keys(next).length });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true;
    }

    if (message.action === 'importFollowedChannels') {
        (async () => {
            try {
                const operationGeneration = rxSettingsMutationGeneration;
                const resp = await fetch('https://rumble.com/account/following', {
                    method: 'GET',
                    credentials: 'include',
                });
                if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                const html = await resp.text();
                // Verify the response is actually the followed-channels page,
                // not a login redirect. The page is identified by its
                // `data-js="followed-channels__section"` attribute on the
                // wrapping section.
                if (!html.includes('followed-channels__section')) {
                    sendResponse({ ok: false, reason: 'not-logged-in' });
                    return;
                }
                if (operationGeneration !== rxSettingsMutationGeneration) {
                    sendResponse({ ok: false, reason: 'superseded' });
                    return;
                }
                // Parse each <li class="followed-channel"> block. We scan the
                // whole document body — the row count varies with sort/paging.
                const rows = [];
                const re = /<li[^>]*class="[^"]*\bfollowed-channel\b[^"]*"[^>]*data-type="channel"[\s\S]*?<\/li>/g;
                let m;
                while ((m = re.exec(html))) {
                    const block = m[0];
                    // Channel URL: prefer /c/ links; fall back to /user/.
                    const linkMatch = block.match(/href="([^"]*\/(?:c|user)\/[^"]+?)"/);
                    if (!linkMatch) continue;
                    // Strip query params so the import URL stays canonical.
                    let url = linkMatch[1];
                    try { const u = new URL(url, 'https://rumble.com'); u.search = ''; url = u.toString(); } catch {}
                    // Channel name from <span class="line-clamp-2">.
                    const nameMatch = block.match(/<span class="line-clamp-2"[^>]*>([^<]+)<\/span>/);
                    const name = nameMatch ? nameMatch[1].trim() : url;
                    rows.push({ url, name });
                }
                if (rows.length === 0) { sendResponse({ ok: true, scanned: 0, added: 0, duplicates: 0 }); return; }
                const merged = await rxQueueWatchedChannelBulkAdd(rows, operationGeneration);
                if (!merged.ok) { sendResponse(merged); return; }
                await rxSyncChannelNotifier();
                sendResponse({
                    ok: true,
                    scanned: rows.length,
                    added: merged.added,
                    duplicates: merged.duplicates,
                    total: merged.total,
                });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true;
    }

    if (message.action === 'testNotification') {
        rxFireNotification({
            title: 'RumbleX — Test',
            message: 'Notifications are working. The channel notifier will use this same path when a watched channel posts a new video or goes live.',
            url: 'https://rumble.com/',
        }).then((id) => sendResponse({ ok: !!id, id }));
        return true;
    }

    // v3.6.0 — Group all open Rumble tabs into a single colored tab group.
    // Chrome-only (tabGroups API not in Firefox/MV2). Returns { ok, count,
    // groupId } on success or { ok: false, reason } on failure. Popup
    // invokes via `groupRumbleTabs` message.
    if (message.action === 'groupRumbleTabs') {
        (async () => {
            if (!chrome.tabs?.group || !chrome.tabGroups) {
                sendResponse({ ok: false, reason: 'no-tabgroups-api' });
                return;
            }
            try {
                const tabs = await chrome.tabs.query({ url: ['*://rumble.com/*', '*://*.rumble.com/*'] });
                const tabIds = (tabs || []).filter((t) => typeof t.id === 'number').map((t) => t.id);
                if (tabIds.length === 0) {
                    sendResponse({ ok: false, reason: 'no-rumble-tabs' });
                    return;
                }
                const groupId = await chrome.tabs.group({ tabIds });
                await chrome.tabGroups.update(groupId, {
                    title: 'Rumble',
                    color: 'green',
                    collapsed: false,
                });
                sendResponse({ ok: true, count: tabIds.length, groupId });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true;
    }

    if (message.action === 'parseHtmlOffscreen') {
        callOffscreen('parseHtml', { html: message.html || '' }).then(sendResponse);
        return true;
    }
    if (message.action === 'hashBlobOffscreen') {
        callOffscreen('hashBlob', { url: message.url || '' }).then(sendResponse);
        return true;
    }

    if (message.action === 'download') {
        const recoveryGeneration = rxDownloadRecoveryGeneration;
        const url = message?.data?.url;
        const filename = message?.data?.filename;
        const baseDiagnostic = {
            ...(message?.diagnostic && typeof message.diagnostic === 'object' ? message.diagnostic : {}),
            source: 'background',
            operation: message?.diagnostic?.operation || 'direct-download',
            urls: [
                ...(Array.isArray(message?.diagnostic?.urls) ? message.diagnostic.urls : []),
                { role: 'download', url },
            ],
        };
        if (!isAllowedDownloadUrl(url)) {
            rxRecordDownloadDiagnostic({
                ...baseDiagnostic,
                stage: 'url-validation',
                error: { message: 'Download URL is not allowed', code: 'url-not-allowlisted' },
            }, recoveryGeneration)
                .then((entry) => sendResponse({
                    error: 'Download URL is not allowed',
                    stage: 'url-validation',
                    ...(entry?.superseded ? { reason: 'superseded' } : { diagnosticId: entry.id }),
                }))
                .catch(() => sendResponse({ error: 'Download URL is not allowed', stage: 'url-validation' }));
            return true;
        }
        rxStartManagedDownload(
            { url, filename, saveAs: true },
            { operation: baseDiagnostic.operation, tabId: sender?.tab?.id },
            recoveryGeneration,
        ).then(async (downloadId) => {
            if (recoveryGeneration !== rxDownloadRecoveryGeneration) {
                try { await rxDownloadsApi.cancel(downloadId); } catch {}
                sendResponse({ error: 'Download cancelled because user data was reset', reason: 'superseded' });
                return;
            }
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                rxHandleNetworkOffline().catch(() => {});
            }
            sendResponse({ downloadId, recoveryManaged: !!(await rxGetManagedDownload(downloadId)) });
        }).catch((error) => {
            rxRecordDownloadDiagnostic({
                ...baseDiagnostic,
                stage: 'browser-download',
                error: { name: 'DownloadApiError', message: error?.message || error, code: 'chrome-downloads-error' },
            }, recoveryGeneration)
                .then((entry) => sendResponse({
                    error: error?.message || String(error),
                    ...(entry?.superseded ? { reason: 'superseded' } : { diagnosticId: entry.id }),
                }))
                .catch(() => sendResponse({ error: error?.message || String(error) }));
        });
        return true;
    }

    // v3.18.0 — Channel Archive Queue message API.
    if (message.action === 'downloadRecoveryGetState') {
        rxGetDownloadRecoverySummary()
            .then((recovery) => sendResponse({ ok: true, recovery }))
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'downloadRecoveryRunNow') {
        rxHandleCurrentNetworkState({ runArchive: true })
            .then((result) => sendResponse({ ok: true, result }))
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

/**
 * Normalise a video-card href to a site-relative path.
 *
 * Channel grids emit `/v...`; playlist grids emit the absolute URL with a
 * `?playlist_id=` query. Both have to end up as the same path, or the same
 * video enqueues twice and the dedupe set never sees the collision.
 */
function rxArchiveHrefPath(href) {
    const path = String(href || '').replace(/^https?:\/\/(?:www\.)?rumble\.com/i, '');
    // The tracking query is Rumble's own (?e9s=, ?playlist_id=) and is not part
    // of the video's identity.
    return path.split('?')[0].split('#')[0];
}

    if (message.action === 'archiveEnqueueChannel') {
        (async () => {
            try {
                const archiveGeneration = rxArchiveNetworkGeneration;
                const channelUrl = (message.channelUrl || '').trim();
                // /c/ and /user/ are channels; /playlists/<id> is a playlist,
                // which renders the same video-card markup and so parses the
                // same way.
                if (!/^https?:\/\/(www\.)?rumble\.com\/(c|user|playlists)\//i.test(channelUrl)) {
                    sendResponse({ ok: false, reason: 'bad-channel-url' });
                    return;
                }
                const maxItems = Math.max(1, Math.min(500, parseInt(message.maxItems, 10) || 50));
                const filterClips = !!message.filterClips;
                const resp = await fetch(channelUrl, { credentials: 'include' });
                if (!resp.ok) { sendResponse({ ok: false, reason: 'http-' + resp.status }); return; }
                const html = await resp.text();
                // Parse the channel page for video entries. The channel grid uses
                // <a class="videostream__link ..." href="/v..."> elements paired
                // with <h3 class="thumbnail__title" title="...">.
                const seen = new Set();
                const found = [];
                // Walk anchor tags; each video card has data-video-id or a /v link.
                // Playlist pages emit ABSOLUTE hrefs
                // (https://rumble.com/v...html?playlist_id=...), channel pages
                // emit relative ones. Accept both, then normalise to a path.
                const re = /<a[^>]*\bvideostream__link\b[^>]*href="((?:https?:\/\/(?:www\.)?rumble\.com)?\/v[^"]+)"[^>]*>[\s\S]*?<h3[^>]*\bthumbnail__title\b[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)<\/h3>/g;
                let m;
                while ((m = re.exec(html)) && found.length < maxItems) {
                    const href = rxArchiveHrefPath(m[1]);
                    const titleAttr = (m[2] || m[3] || '').trim();
                    if (seen.has(href)) continue;
                    seen.add(href);
                    if (filterClips && /^Clip:\s/i.test(titleAttr)) continue;
                    if (filterClips && /\/clips?\//i.test(href)) continue;
                    // Extract the v-slug.
                    const slugMatch = href.match(/^\/(v[a-z0-9]+)/i);
                    if (!slugMatch) continue;
                    found.push({
                        videoId: slugMatch[1],
                        videoUrl: 'https://rumble.com' + href,
                        videoTitle: titleAttr || null,
                    });
                }
                if (found.length === 0) {
                    // Fallback parse for older row markup.
                    const reAlt = /<a[^>]*href="((?:https?:\/\/(?:www\.)?rumble\.com)?\/v[a-z0-9][^"]*)"[^>]*>[\s\S]*?<\/a>/gi;
                    let mm;
                    while ((mm = reAlt.exec(html)) && found.length < maxItems) {
                        const href = rxArchiveHrefPath(mm[1]);
                        if (seen.has(href)) continue;
                        seen.add(href);
                        const slugMatch = href.match(/^\/(v[a-z0-9]+)/i);
                        if (!slugMatch) continue;
                        found.push({
                            videoId: slugMatch[1],
                            videoUrl: 'https://rumble.com' + href,
                            videoTitle: null,
                        });
                    }
                }
                if (found.length === 0) {
                    sendResponse({ ok: false, reason: 'no-videos-found' });
                    return;
                }
                // Channel name: from <h1> or <meta property="og:title">.
                let channelName = null;
                const ogt = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
                if (ogt) channelName = ogt[1].trim();
                const mutation = await rxMutateArchiveQueue((root) => {
                    let enqueuedCount = 0;
                    let skippedCount = 0;
                    for (const v of found) {
                        // Skip duplicates already in queue (by videoId).
                        if (root.jobs.some((job) => job.videoId === v.videoId)) { skippedCount++; continue; }
                        if (root.jobs.length >= RX_ARCHIVE_MAX_JOBS) break;
                        root.jobs.push({
                            id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
                            channelUrl,
                            channelName,
                            videoId: v.videoId,
                            videoUrl: v.videoUrl,
                            videoTitle: v.videoTitle,
                            status: 'pending',
                            retryCount: 0,
                            addedAt: Date.now(),
                        });
                        enqueuedCount++;
                    }
                    return { enqueued: enqueuedCount, skipped: skippedCount };
                }, archiveGeneration);
                if (mutation?.superseded) {
                    sendResponse({ ok: false, reason: 'superseded' });
                    return;
                }
                const { enqueued, skipped } = mutation;
                // Kick a tick now so the user sees progress immediately.
                rxRunArchiveTick().catch(() => {});
                sendResponse({ ok: true, enqueued, skipped, channelName });
            } catch (e) {
                sendResponse({ ok: false, reason: String(e?.message || e) });
            }
        })();
        return true;
    }

    if (message.action === 'archiveGetQueue') {
        Promise.all([rxLoadArchiveQueue(), rxGetArchiveFolderState(), rxGetDownloadRecoverySummary()])
            .then(([root, folder, recovery]) => sendResponse({ ok: true, queue: root, folder, recovery }))
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'archivePauseQueue' || message.action === 'archiveResumeQueue') {
        (async () => {
            const paused = message.action === 'archivePauseQueue';
            await rxMutateArchiveQueue((root) => { root.paused = paused; });
            if (!paused) rxRunArchiveTick().catch(() => {});
            sendResponse({ ok: true, paused });
        })().catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'archiveClearCompleted') {
        (async () => {
            const removed = await rxMutateArchiveQueue((root) => {
                const before = root.jobs.length;
                root.jobs = root.jobs.filter((job) => job.status !== 'completed');
                return before - root.jobs.length;
            });
            sendResponse({ ok: true, removed });
        })().catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'archiveClearQueue') {
        (async () => {
            const removed = await rxMutateArchiveQueue((root) => {
                const before = root.jobs.length;
                root.jobs = [];
                return before;
            });
            sendResponse({ ok: true, removed });
        })().catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'archiveRemoveJob') {
        (async () => {
            const removed = await rxMutateArchiveQueue((root) => {
                const before = root.jobs.length;
                root.jobs = root.jobs.filter((job) => job.id !== message.id);
                return before - root.jobs.length;
            });
            sendResponse({ ok: true, removed });
        })().catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'archiveRetryJob') {
        (async () => {
            const found = await rxMutateArchiveQueue((root) => {
                const job = root.jobs.find((entry) => entry.id === message.id);
                if (!job) return false;
                rxResetArchiveJobForRetry(job);
                return true;
            });
            if (!found) { sendResponse({ ok: false, reason: 'not-found' }); return; }
            rxRunArchiveTick().catch(() => {});
            sendResponse({ ok: true });
        })().catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'archiveRetryFailed') {
        (async () => {
            const retried = await rxMutateArchiveQueue((root) => {
                let count = 0;
                for (const job of root.jobs) {
                    if (job.status !== 'failed') continue;
                    rxResetArchiveJobForRetry(job);
                    count++;
                }
                return count;
            });
            rxRunArchiveTick().catch(() => {});
            sendResponse({ ok: true, retried });
        })().catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'archivePreflightQueue') {
        rxPreflightArchiveQueue()
            .then((result) => sendResponse({ ok: true, ...result }))
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'archiveExportQueue') {
        rxBuildArchiveQueueExport()
            .then((payload) => sendResponse({ ok: true, payload }))
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'archiveImportQueue') {
        rxImportArchiveQueue(message.payload)
            .then((result) => sendResponse({ ok: true, ...result }))
            .catch((error) => sendResponse({ ok: false, reason: String(error?.message || error) }));
        return true;
    }

    if (message.action === 'archiveRunNow') {
        rxHandleCurrentNetworkState({ runArchive: false })
            .then(() => rxRunArchiveTick())
            .then(() => sendResponse({ ok: true }))
            .catch((e) => sendResponse({ ok: false, reason: String(e?.message || e) }));
        return true;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.target === 'offscreen') return false;
    const authorization = rxAuthorizeRuntimeMessage(message, sender);
    if (!authorization.handled) return false;
    if (!authorization.ok) {
        sendResponse({ ok: false, reason: authorization.reason, field: authorization.field || null });
        return false;
    }
    rxEnsurePendingResetStartupRecovery()
        .then(() => rxHandleAuthorizedRuntimeMessage(message, sender, sendResponse, authorization))
        .catch((error) => sendResponse({
            ok: false,
            reason: 'reset-recovery',
            error: error?.message || String(error),
        }));
    return true;
});
