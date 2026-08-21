// RumbleX shared video-card adapter.
'use strict';

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


