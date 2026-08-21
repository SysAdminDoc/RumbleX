// RumbleX shared page classification and route lifecycle.
'use strict';

// ── Page Detection ──
const Page = {
    isWatch: () => /^\/v[a-z0-9]+-/.test(location.pathname) || location.pathname.startsWith('/video/'),
    isFeed: () => location.pathname === '/' || location.pathname === '/subscriptions' || location.pathname === '/for-you',
    isHome: () => location.pathname === '/',
    isEmbed: () => location.pathname.startsWith('/embed/'),
    isSearch: () => location.pathname === '/search/video' || location.pathname.startsWith('/search/'),
    isChannel: () => location.pathname.startsWith('/c/') || location.pathname.startsWith('/user/'),
    // /playlists/<id>. Rumble's own Watch Later and Watch History live at
    // /playlists/watch-later and /playlists/watch-history and use the same
    // page component as a user playlist, which is where these selectors and
    // this route shape are evidenced from.
    isPlaylist: () => /^\/playlists\/[^/]+/.test(location.pathname),
    playlistId: () => (location.pathname.match(/^\/playlists\/([^/?#]+)/) || [])[1] || null,
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
        if (this.isPlaylist()) return 'playlist';
        if (this.isFeed()) return 'feed';
        return 'unknown';
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


