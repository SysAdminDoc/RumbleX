// RumbleX shared video-card adapter.
'use strict';

// ── Video Card + Active Media Adapters (v3.36.0) ──
// Rumble currently mixes legacy `.videostream` nodes with the newer
// `<rum-video-thumbnail>` and `<rum-card-video>` custom elements. Consumers
// use this adapter so a future card migration is repaired in one place instead
// of per feature.
const VideoCards = {
    selector: [
        'rum-video-thumbnail[role="listitem"]',
        'rum-card-video[role="listitem"]',
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
            '.media-page-related-media-desktop-sidebar rum-card-video[role="listitem"], ' +
            '.media-page-related-media-desktop-sidebar .mediaList-item, ' +
            '.media-page-related-media-desktop-floating rum-video-thumbnail[role="listitem"], ' +
            '.media-page-related-media-desktop-floating rum-card-video[role="listitem"], ' +
            '.media-page-related-media-desktop-floating .mediaList-item',
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
    // Sortable facts, where the card carries them, and null where it does not
    // (never zero, which would sort a card that says nothing as the oldest,
    // shortest or least watched). The custom element carries them as
    // attributes: `time` (ISO), `duration` (seconds) and `views`. Older
    // markup uses <time datetime> and data values on the duration and views.
    published(card) {
        const raw = card.getAttribute('time')
            || card.querySelector('time[datetime]')?.getAttribute('datetime')
            || '';
        const ms = Date.parse(raw);
        return Number.isFinite(ms) ? ms : null;
    },
    duration(card) {
        const attr = card.getAttribute('duration');
        if (attr && /^\d+(?:\.\d+)?$/.test(attr)) return Number(attr);
        const node = card.querySelector('.video-item--duration, .videostream__status--duration, .videostream__badge--duration');
        const text = String(node?.getAttribute('data-value') || node?.textContent || '').trim();
        if (!/^\d{1,3}(?::\d{1,2}){1,2}$/.test(text)) return null;
        return text.split(':').map(Number).reduce((total, part) => total * 60 + part, 0);
    },
    views(card) {
        const raw = card.getAttribute('views')
            ?? card.querySelector('[data-views]')?.getAttribute('data-views')
            ?? card.querySelector('.video-item--views')?.getAttribute('data-value');
        const digits = String(raw ?? '').replace(/[,\s]/g, '');
        return /^\d+$/.test(digits) ? Number(digits) : null;
    },
    thumbnail(card) {
        return card.querySelector('.rum-video-thumbnail__image, .videostream__image, .thumbnail__image, .videostream__thumbnail, .video-item--img-wrapper, [class*="thumbnail"]');
    },
};
