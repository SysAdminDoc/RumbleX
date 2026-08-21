// RumbleX shared media metadata, HLS parsing, active-media, and probe helpers.
'use strict';

// ═══════════════════════════════════════════
//  Media URL and HLS parsing helpers
// ═══════════════════════════════════════════
const MediaHelpers = {
    safeMediaUrl(raw, base = location.href) {
        if (!raw) return null;
        try {
            const parsed = new URL(String(raw), base);
            const approved = ['rumble.com', 'rumble.cloud', '1a-1791.com'].some((host) =>
                parsed.hostname === host || parsed.hostname.endsWith('.' + host)
            );
            return parsed.protocol === 'https:' && approved ? parsed.href : null;
        } catch { return null; }
    },

    extractHlsUrl(data) {
        const candidates = [
            data?.u?.hls?.auto?.url,
            data?.ua?.hls?.auto?.url,
            data?.u?.hls?.url,
            data?.ua?.hls?.url,
        ];
        for (const candidate of candidates) {
            const safe = this.safeMediaUrl(candidate);
            if (safe) return safe;
        }
        return null;
    },

    parseQualities(data) {
        const qualities = [];
        const sources = [data?.ua, data?.u].filter((source) => source && typeof source === 'object');

        for (const src of sources) {
            for (const fmt of ['mp4', 'webm']) {
                const group = src[fmt];
                if (!group || typeof group !== 'object') continue;
                if (group.url && group.meta?.h > 0) {
                    const directUrl = this.safeMediaUrl(group.url);
                    if (directUrl) qualities.push({
                        key: fmt, label: `${group.meta.h}p`, height: group.meta.h,
                        width: group.meta.w || 0, bitrate: group.meta.bitrate || 0,
                        size: group.meta.size || 0, directUrl, type: fmt,
                    });
                    continue;
                }
                for (const [key, val] of Object.entries(group)) {
                    const directUrl = this.safeMediaUrl(val?.url);
                    if (!directUrl || !val?.meta?.h) continue;
                    qualities.push({
                        key, label: `${val.meta.h}p`, height: val.meta.h,
                        width: val.meta.w || 0, bitrate: val.meta.bitrate || 0,
                        size: val.meta.size || 0, directUrl, type: fmt,
                    });
                }
            }
        }

        for (const src of sources) {
            const tar = src.tar;
            if (!tar || typeof tar !== 'object') continue;
            for (const [key, val] of Object.entries(tar)) {
                if (!val?.meta?.h) continue;
                const height = val.meta.h;
                if (qualities.some((quality) => quality.height === height)) continue;
                qualities.push({
                    key, label: `${height}p`, height,
                    width: val.meta.w || 0, bitrate: val.meta.bitrate || 0,
                    size: val.meta.size || 0, directUrl: null, type: 'hls',
                });
            }
        }

        qualities.sort((a, b) => b.height - a.height);
        const seen = new Map();
        for (const quality of qualities) {
            const existing = seen.get(quality.height);
            if (!existing || (quality.directUrl && !existing.directUrl) || quality.bitrate > existing.bitrate) {
                seen.set(quality.height, quality);
            }
        }
        return [...seen.values()];
    },

    parseMasterPlaylist(text, baseUrl) {
        const variants = [];
        const lines = String(text || '').trim().split('\n');
        for (let index = 0; index < lines.length; index++) {
            if (!lines[index].startsWith('#EXT-X-STREAM-INF:')) continue;
            const info = lines[index];
            const rawUrl = lines[index + 1]?.trim();
            if (!rawUrl || rawUrl.startsWith('#')) continue;
            const url = this.safeMediaUrl(rawUrl, baseUrl);
            if (!url) continue;
            const resolution = info.match(/RESOLUTION=(\d+)x(\d+)/);
            const bandwidth = info.match(/BANDWIDTH=(\d+)/);
            variants.push({
                url,
                width: resolution ? Number.parseInt(resolution[1]) : 0,
                height: resolution ? Number.parseInt(resolution[2]) : 0,
                bandwidth: bandwidth ? Number.parseInt(bandwidth[1]) : 0,
            });
        }
        return variants;
    },

    parseSegmentPlaylist(text, baseUrl) {
        return this.parseSegmentEntries(text, baseUrl).map((entry) => entry.url);
    },

    parseSegmentEntries(text, baseUrl) {
        const entries = [];
        const lines = String(text || '').trim().split('\n');
        let pending = 0;
        let clock = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('#EXTINF:')) {
                const value = Number.parseFloat(trimmed.slice('#EXTINF:'.length));
                pending = Number.isFinite(value) && value > 0 ? value : 0;
                continue;
            }
            if (trimmed.startsWith('#')) continue;
            const url = this.safeMediaUrl(trimmed, baseUrl);
            if (url) {
                entries.push({ url, duration: pending, start: clock, end: clock + pending });
                clock += pending;
            }
            pending = 0;
        }
        return entries;
    },
};

// ═══════════════════════════════════════════
//  Structured page data (schema.org JSON-LD)
// ═══════════════════════════════════════════
// Rumble emits a schema.org VideoObject on watch pages for search engines. That
// makes it the most stable description of a video on the page: it carries the
// exact view count, an ISO 8601 duration, the upload date and the embed id,
// none of which have to be scraped out of presentation markup that Rumble is
// free to restyle.
//
// This is deliberately a *supplement*, not a replacement. Channel and feed
// listings were checked against live Rumble on 2026-08-19 and still render real
// DOM cards, so `VideoCards` stays the card layer and every reader here falls
// back to the DOM when the JSON-LD is absent, malformed, or for a different
// video.
const PageData = {
    _url: null,
    _video: null,

    // ISO 8601 durations, e.g. "PT01H36M12S". Rumble has also been seen to emit
    // bare second counts, so accept a plain number too.
    _isoDuration(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value > 0 ? value : null;
        if (typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (/^\d+(\.\d+)?$/.test(trimmed)) {
            const plain = Number(trimmed);
            return plain > 0 ? plain : null;
        }
        const match = /^P(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?)?$/.exec(trimmed);
        if (!match) return null;
        const [, d, h, m, s] = match;
        if (!d && !h && !m && !s) return null;
        const total = (Number(d || 0) * 86400) + (Number(h || 0) * 3600) + (Number(m || 0) * 60) + Number(s || 0);
        return Number.isFinite(total) && total > 0 ? total : null;
    },

    _parse(root = document) {
        const nodes = qsa('script[type="application/ld+json"]', root);
        for (const node of nodes) {
            let parsed;
            // A single malformed block must not hide a valid one later in the
            // document, so failures are skipped rather than aborting the scan.
            try { parsed = JSON.parse(node.textContent || ''); } catch { continue; }
            const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
            while (queue.length) {
                const item = queue.shift();
                if (!item || typeof item !== 'object') continue;
                if (Array.isArray(item['@graph'])) queue.push(...item['@graph']);
                const type = item['@type'];
                const isVideo = type === 'VideoObject'
                    || (Array.isArray(type) && type.includes('VideoObject'));
                if (isVideo) return item;
            }
        }
        return null;
    },

    // Cached per URL. Rumble is an SPA, so a stale object from the previous
    // watch page would silently describe the wrong video.
    videoObject(root = document) {
        const href = typeof location !== 'undefined' ? location.href : '';
        if (this._url === href && this._video) return this._video;
        let found = null;
        try { found = this._parse(root); } catch { found = null; }
        // Only a hit is cached. On an SPA route change the URL updates before
        // the new markup lands, so caching the miss would pin "no data" for the
        // rest of the visit to a page that does have it.
        this._url = found ? href : null;
        this._video = found;
        return found;
    },

    invalidate() {
        this._url = null;
        this._video = null;
    },

    title() {
        const value = this.videoObject()?.name;
        return typeof value === 'string' ? value.trim() : '';
    },

    description() {
        const value = this.videoObject()?.description;
        return typeof value === 'string' ? value.trim() : '';
    },

    durationSeconds() {
        return this._isoDuration(this.videoObject()?.duration);
    },

    uploadDate() {
        const value = this.videoObject()?.uploadDate;
        if (typeof value !== 'string' || !value.trim()) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : value.trim();
    },

    thumbnailUrl() {
        const raw = this.videoObject()?.thumbnailUrl;
        const value = Array.isArray(raw) ? raw[0] : raw;
        if (typeof value !== 'string') return '';
        try { return new URL(value, location.origin).href; } catch { return ''; }
    },

    // schema.org allows one object or an array of them; only the watch counter
    // is meaningful here.
    viewCount() {
        const raw = this.videoObject()?.interactionStatistic;
        if (!raw) return null;
        const entries = Array.isArray(raw) ? raw : [raw];
        for (const entry of entries) {
            if (!entry || typeof entry !== 'object') continue;
            const type = entry.interactionType;
            const name = typeof type === 'string' ? type : (type && typeof type === 'object' ? type['@type'] || type.name : '');
            if (name && !/WatchAction/i.test(String(name))) continue;
            const count = Number(entry.userInteractionCount);
            if (Number.isFinite(count) && count >= 0) return count;
        }
        return null;
    },

    // The embed id is not always the id in the page URL, and the download path
    // needs the embed one. Taking it from here avoids re-deriving it from
    // markup.
    embedId() {
        const value = this.videoObject()?.embedUrl;
        if (typeof value !== 'string') return null;
        return value.match(/\/embed\/([a-z0-9]+)/i)?.[1] || null;
    },

    // Reported in the privacy/selector-health surface so a reader can tell
    // structured data from scraped markup.
    available() {
        return !!this.videoObject();
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
        clearTimeout(this._flushTimer);
        this._flushTimer = null;
        this._mem = {};
        try { await RXPlatform.storage.remove(this._KEY); } catch {}
    },
    _flushTimer: null,
    _scheduleFlush() {
        clearTimeout(this._flushTimer);
        this._flushTimer = setTimeout(() => {
            this._flushTimer = null;
            try {
                void Promise.resolve(RXPlatform.storage.set({ [this._KEY]: this._mem })).catch(() => {});
            } catch {}
        }, 250);
    },
};

