// RumbleX shared selector registry and health monitor.
'use strict';

// ── Selector Registry (v2.0.0) ──
// Named surface selectors with stable/fallback pairs from the MHTML map.
// Prefer Selectors.find(key) over raw qs() in new feature code so Rumble's
// DOM churn lands in ONE place instead of scattered selectors. Each entry
// tries `stable` first, then falls back to `fallback`. `validate(el)` lets
// callers reject false-positive matches structurally.
const Selectors = {
    _map: {
        'header.root':        { stable: 'header[data-js="app_header"], header.header', fallback: '.header' },
        'nav.mainMenu':       { stable: '#main-menu', fallback: '.hover-menu.main-menu-nav' },
        'search.form':        { stable: 'form[data-js="search_form"]', fallback: '.header-search' },
        'search.input':       { stable: '[data-js="search_input"]', fallback: '.header-search-field' },
        'search.autocomplete':{ stable: '[data-js="autocomplete_results_container"]', fallback: '[hx-post="/search/htmx/get-autocomplete-results"]' },
        'feed.card':          { stable: 'rum-video-thumbnail[role="listitem"], [role="listitem"][data-video-id], article.video-item', fallback: '.videostream.thumbnail__grid--item' },
        'feed.cardTitle':     { stable: '[video-title], rum-text[role="heading"], .thumbnail__title, .video-item--title', fallback: '.thumbnail__title.line-clamp-2' },
        'feed.author':        { stable: 'rum-video-thumbnail[name], a[rel="author"].channel__link, article.video-item a[rel="author"]', fallback: '.channel__link' },
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
        'chat.composer':      { stable: 'form.chat-message-form textarea', fallback: '.chat--input textarea, .chat--input' },
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

        // /playlists/<id>. Evidenced by the Watch Later / Watch History
        // captures, which are the same page component.
        'playlist.root':                    { stable: '.playlist-details__container', fallback: '[class*="playlist-details"]' },
        'playlist.controlPanel':            { stable: '.playlist-control-panel__container', fallback: '[data-js="playlist-control-panel-handler"]' },
        'playlist.name':                    { stable: '.playlist-control-panel__playlist-name', fallback: '[class*="playlist-control-panel__playlist-name"]' },
        'playlist.item':                    { stable: '.playlist-menu[data-video-id]', fallback: '[data-js="playlist_menu"]' },
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
        // Structured data is reported separately from the CSS-selector checks.
        // It is a different layer with a different failure mode: selectors break
        // when Rumble restyles, JSON-LD breaks when Rumble changes what it tells
        // search engines. Neither state affects `status`, which stays a
        // statement about the selectors features actually depend on.
        let structuredData = 'not-applicable';
        if (page === 'watch' || page === 'live') {
            structuredData = PageData.available() ? 'present' : 'absent';
        }
        return {
            checkedAt: new Date().toISOString(),
            page,
            status: missing.length ? 'broken' : fallback.length ? 'degraded' : 'healthy',
            checked: checks.length,
            missing,
            fallback,
            structuredData,
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
            try {
                RxToast.show(rxT('toastSelectorHealth', '{message}. Open Privacy Report for details.', { message }));
            } catch {}
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


