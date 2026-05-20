# Changelog

All notable changes to RumbleX will be documented in this file.

## [3.20.0] - 2026-05-19

### v3.20.0 — Per-feature error log ring buffer (Observability workstream)

Closes the Observability cross-cutting workstream's Now-tier item: "Add a per-feature error-event ring buffer with the same shape: rolling-window-of-200, gated by a debug toggle, exposed via message API, no network." Mirrors the v3.0 selector-telemetry pattern exactly so the disclosure is consistent.

**New `RxErrorLog` content-script module**
- Rolling 200-entry in-memory ring buffer at `RxErrorLog._buf`. `record(featureId, error, context)` is a no-op unless `debugErrorLog` is on — same gating as `debugSelectorTelemetry`.
- Per-entry shape: `{ at, featureId, message, stack (top 8 frames), context, page }`. Bounded field sizes (featureId 80, message 500, context 200) so a flood from one bad feature can't blow out the buffer.
- `drain()` returns a snapshot. `clear()` empties.

**Instrumentation**
- Feature init loop in `boot()` now records to `RxErrorLog` on every `feat.init()` throw (in addition to the existing `console.error`). `SettingsPanel.init()` ditto.
- Other try/catch sites unchanged — Phase 1 just covers the highest-value class (feature initialization failures, which currently surface only in DevTools console and are easy to miss).

**Message API**
- `getErrorLog` → `{ ok, entries }` for export.
- `clearErrorLog` → `{ ok }` for manual reset.

**Options-page UI**
- Two new buttons in the v3.1 Privacy report section's button row: "Export error log" and "Clear error log". Same placement style as the existing "Export selector telemetry" button.
- Export goes through `sendToContent` so it pulls from the active rumble.com tab. Empty buffer shows a hint to enable `debugErrorLog` first.

**Privacy report update** — `rxBuildPrivacyReport.notes` now includes a line stating whether the error-log ring buffer is collecting. Honest disclosure: any debug instrumentation that *could* collect data is enumerated, even when off.

**Catalog parity** 205/205/205/205 (was 204) — added `debugErrorLog` (boolean, default OFF, group: Privacy). No new permissions, no new selectors. Selector harness 85 pass / 17 fixtures unchanged.

### Deferred to v3.21+

- **Finer-grained instrumentation** — Phase 2 will wire `RxErrorLog.record` into Selectors lookup failures, message-handler catch blocks, and high-traffic features (LiveChatEnhance, RantPersist, VideoDownloader). Phase 1 catches the highest-frequency class (boot-time init failures) with one wiring point.
- **HLS fallback for Channel Archive** — still pending; needs offscreen-doc transmux adaptation.

## [3.19.0] - 2026-05-19

### v3.19.0 — Channel Archive Phase 2 (in-page "Archive channel" button)

Drops the v3.18 enqueue UI from the options page directly into the channel header. One click instead of three.

**New `ChannelArchiveButton` content-script feature module**
- Activates only on `Page.classify() === 'channel'` pages (`/c/<slug>` or `/user/<slug>`). Setting key `channelArchiveButton` (default ON, group: Integrations).
- Anchors to the existing Follow/Following toggle via `Selectors.find('profile.followingBtn')` (the selector registered in v3.14 as `button[data-js="button__following"]`).
- Renders an "Archive channel" pill-free button (border-radius 6, per house style) styled to match the Rumble-accent palette. SVG archive-box icon + label.
- One click sends `archiveEnqueueChannel` with the current channel URL, default 50 items, no clip filter — same SW handler the v3.18 options-page form uses. Disables itself during the round-trip; re-enables on response.
- Result surfaces as an in-page toast via the v3.14 `rxShowToast` infrastructure: `Queued N videos. Check RumbleX options → Channel archive queue.` Failure surfaces the same SW reason codes (`bad-channel-url`, `no-videos-found`, …) the options page sees.
- MutationObserver re-attaches if the Follow button re-renders (Rumble's channel SPA swaps it on follow-state changes).

**Catalog parity** 204/204/204/204 (was 203) — added `channelArchiveButton` boolean. Selector harness 85 pass / 17 fixtures unchanged.

### Deferred to v3.20+

- **HLS fallback for direct-MP4-less videos** — v3.18 only handles `ua.mp4.*` direct URLs. Some uploads only ship HLS segments. Requires adapting the v2.2 mux.js transmux path for SW or offscreen-document context.
- **Per-job quality preference** — currently picks the absolute highest quality. A future "max height" setting would cap at 720p/1080p for storage reasons.

## [3.18.0] - 2026-05-19

### v3.18.0 — Channel Archive Queue Phase 1 (closes the marquee Later-tier item)

Materializes the v2.0 `channelArchive*` setting keys into the headline feature people install a Rumble extension for: paste a channel URL, walk away, come back to a folder of MP4s. **Browser-side, no Flask backend** — beats the [nullEFFORT/rumble-downloader](https://github.com/nullEFFORT/rumble-downloader) reference implementation by not requiring a Python server.

**Persistent queue (chrome.storage.local)**
- `rx_archive_queue` = `{ jobs: [...], paused: boolean, version: 1 }`. Survives SW restarts and full browser restarts (re-syncs the drain alarm on `chrome.runtime.onStartup`).
- Job shape: `{ id, channelUrl, channelName, videoId, videoUrl, videoTitle, status, qualityFound?, filename?, downloadId?, error?, addedAt, completedAt }`.
- Status states: `pending` → `discovering` → `downloading` → (`completed` | `failed`).
- Queue cap: 500 jobs. Completed jobs older than 7 days auto-prune on each tick.

**Drain mechanism**
- `chrome.alarms` `rx-archive-tick` fires every minute. Drains up to `downloadConcurrency` (v2.0 setting, default 2, range 1–8) pending jobs concurrently.
- Each drained job hits `https://rumble.com/embedJS/u3/?request=video&ver=2&v=<id>` — same endpoint VideoDownloader uses in [extension/content.js:2239](extension/content.js#L2239). Picks the highest-resolution `ua.mp4.*` direct URL.
- `chrome.downloads.download()` with `conflictAction: 'uniquify'`, target subfolder `RumbleX/<sanitized-title>_<quality>.mp4`. URL is verified against the existing `isAllowedDownloadUrl` allowlist (rumble.com / 1a-1791.com / rumble.cloud).
- `chrome.downloads.onChanged` listener watches the tracked `downloadId` — flips jobs to `completed` on `complete`, `failed` on `interrupted`.

**Background message API**
- `archiveEnqueueChannel({ channelUrl, maxItems, filterClips })` — SW-fetches the channel page (`credentials: 'include'`), regex-extracts up to N video rows, dedups against current queue, returns `{ ok, enqueued, skipped, channelName }`. Two-pass parser: primary uses `<a class="videostream__link" href="/v..."` + `<h3 class="thumbnail__title">`, fallback to bare anchor scan. `filterClips` skips entries titled `Clip:` or under `/clips/`.
- `archiveGetQueue` — returns the full queue object.
- `archivePauseQueue` / `archiveResumeQueue` — toggles `paused`.
- `archiveClearCompleted` / `archiveClearQueue` — bulk-remove.
- `archiveRemoveJob({ id })` / `archiveRetryJob({ id })` / `archiveRunNow` — per-job ops.

**Options-page UI** ("Channel archive queue" section, placed above v3.17 Encrypted Gist Sync)
- Form: channel URL input + max-items number (default 50, 1–500) + "Skip clips" checkbox + Enqueue button.
- Status row with five state counts. Pause/Resume toggle. Run-now / Clear-completed / Clear-all buttons.
- Per-job rows: title (or video id) + status + quality + channel + error, with Open (deep link), Retry (failed-only), Remove actions.
- Live refresh via `chrome.storage.onChanged` — the panel updates in real time as jobs progress.

**No new permissions, no new settings keys** — `channelArchiveEnabled`, `channelArchiveFilterClips`, `channelArchiveMaxItems`, `downloadConcurrency`, `batchDownload` all exist since v2.0. Catalog parity 203/203/203/203 unchanged. Selector harness 85 pass / 17 fixtures unchanged.

### Deferred to v3.19+

- **Phase 2: content-script "Archive this channel" button** — currently the user pastes the channel URL on the options page. The next pass adds a one-click button on `/c/<slug>` pages.
- **HLS fallback for videos without a direct MP4** — current phase only handles videos that expose `ua.mp4.*` direct URLs. Some recent uploads only ship as HLS (`.tar` segments); those will need the v2.2 mux.js transmux path adapted for SW or offscreen-document context.
- **Per-job quality preference** — currently picks the absolute highest direct MP4. A future "max height" setting would let users cap at 720p/1080p for storage reasons.

## [3.17.0] - 2026-05-19

### v3.17.0 — Encrypted Gist Sync (closes the v2.0 `encryptedGistSync` key)

Materializes the v2.0 placeholder boolean into actual cross-device settings sync. Zero RumbleX-side infrastructure — the user brings their own GitHub gist and their own passphrase. **AES-GCM-256 + PBKDF2-SHA256 with 200,000 iterations** — same KDF tier as 1Password / Bitwarden defaults.

**Background-side crypto handlers**
- New `gistSyncPush` action: derives a 256-bit AES-GCM key via WebCrypto PBKDF2-SHA256 (200k iters, random 16-byte salt per push) from the user-provided passphrase, encrypts the full `rx_settings` JSON with a random 12-byte IV, wraps it in a `{ rumblex: { schemaVersion, cipher, kdf, salt, iv, ciphertext, encryptedAt } }` envelope, and PUTs to a private GitHub gist (POST + auto-save id on first push, PATCH thereafter). All base64-encoded.
- New `gistSyncPull` action: GETs the gist, derives the key from the SAME passphrase + the stored salt, decrypts, validates the schema, snapshots current settings as `pre-gist-pull` via the v3.0 backup system, then writes the decrypted settings back to `chrome.storage.local`. Preserves the LOCAL token + gist-id post-pull so the user doesn't get logged out of their own sync target.
- Failure-mode taxonomy: `missing-token` | `missing-gist-id` | `weak-passphrase` | `bad-passphrase` | `no-payload` | `malformed-payload` | `bad-json` | `bad-decoded-json` | `http-NNN`. Each surfaces a specific user-facing message in the options page.

**Options-page side**
- New "Encrypted gist sync" section above the v3.16 RantStats section. Three password-type inputs (PAT, gist id, passphrase) plus Push / Pull buttons.
- Token + gist id are persisted to `rx_settings` so they auto-fill on page reload. Passphrase is **never stored** — entered on every push/pull.
- Setup instructions link directly to <https://github.com/settings/tokens?type=beta>. First push creates a private gist named `rumblex-settings.enc.json` and auto-saves its ID for subsequent pushes.
- Pull auto-reloads the options page after success so every section re-reads from storage.

**Privacy report update** — `rxBuildPrivacyReport` now states whether Encrypted Gist Sync is configured and how the payloads are protected. The honest `externalNetworkSurfaces` line for `api.github.com` is upgraded from "release version check, manual" to "release version check + opt-in Encrypted Gist Sync".

**Catalog parity** 203/203/203/203 (was 201) — added `encryptedGistSyncToken` (string, default `''`) and `encryptedGistSyncId` (string, default `''`). The original boolean `encryptedGistSync` stays the user-facing master toggle, surfaced in the existing settings catalog.

**No new permissions.** `api.github.com` was already in `host_permissions` since v3.0 for release version checks. Selector harness: 85 pass / 17 fixtures unchanged. `node --check` clean across all four JS files.

### Deferred to v3.18+

- **Mediabunny / WebCodecs migration** — still pending; multi-day work.
- **declarativeNetRequest autoplay rules** — still pending; needs live network trace.
- **Channel archive queue** — chrome.alarms + chrome.offscreen + persistent queue. Infra all present; next reasonable v3.x slot.

## [3.16.0] - 2026-05-19

### v3.16.0 — RantStats panel (closes the v3.3 Now-tier acceptance criterion)

Materializes the `rantStatsPanel` setting key shipped in v2.0 into an actual feature. Beats the single Chrome competitor ([RantStats v1.5.3](https://chromewebstore.google.com/detail/rantstats-extension-for-r/liahjgfmodjgeakahommamnmbjgicpmh)) on local-only-by-default + integration with the rest of RumbleX (uses the existing RantPersist cache instead of standing up a parallel scrape pipeline).

**Content-script side (RantPersist mirror)**
- `RantPersist._cache()` now debounce-mirrors each cached rant to `chrome.storage.local` under a single `rx_rant_stats_mirror` key. Per-video cap of 200 rants × 30 videos (vs. localStorage's 500 × 100 source-of-truth cap) — keeps the mirror well under Chrome's default 10 MB local-storage quota.
- Mirror shape: `{ videos: { "<videoId>": { title, url, lastTs, read, rants:[...] } } }`. `title` resolved from `<meta property="og:title">` first, falls back to `<title>` minus the trailing `— Rumble` suffix.
- Existing localStorage `rx_rants_<videoId>` cache is unchanged — preserves v2.4 `RX_LOCAL_STORAGE_KEYS` backup-import allowlist behavior.

**Options-page side (RantStats panel)**
- New "Rant stats" section above the v3.10 multi-profile section. Reads the mirror directly via `chrome.storage.local.get` — no new background message handlers needed.
- Per-video cards: title + rant count + aggregate USD + last-seen timestamp + read indicator. Sorted newest-first by `lastTs`.
- Per-video actions: "Open" (deep-links to the watch page in a new tab), "Mark read" / "Mark unread", "Remove" (deletes the video from the mirror).
- Footer totals row: total rants across all videos, aggregate USD (price-string parsed via `[\d.]+` regex — handles `$5`, `$25.00`, `5 USD`, `€5`), unique chatter count.
- Top-row buttons: "Refresh", "Export JSON", "Export CSV", "Clear all".
- JSON export: structured payload with `exportedAt`, per-video drill-down. Same `downloadJsonBlob` path as v3.10 OPML / v3.11 comment / v3.15 watch-history exports.
- CSV export: nine columns (`videoId`, `videoTitle`, `videoUrl`, `ts`, `tier`, `price`, `priceUsd`, `user`, `text`). Standard CSV quoting (double-up internal quotes, wrap fields containing `, " \n \r`).
- Live refresh: `chrome.storage.onChanged` listener auto-refreshes the panel when the content-script mirror updates, so an open options tab sees fresh data without manual reload.

**No new permissions, no new settings keys.** Catalog parity 201/201/201/201 unchanged. Selector harness: 85 pass / 17 fixtures unchanged. `node --check` clean across all four JS files.

### Deferred to v3.17+

- **Side-panel target swap** — currently the RantStats panel lives in the options page (which is also the side-panel default-path). A future `pages/rantstats.html` could be a dedicated lightweight side-panel target via `chrome.sidePanel.setOptions({ path })`. The options-page section already covers the v3.3 acceptance criterion.
- **BulkRemoveFromHistory** — still pending. The v3.14 `history.itemMenuTrigger` selectors stay reserved.

## [3.15.0] - 2026-05-19

### v3.15.0 — Watch History export (account-data round-trip)

Completes the v3.13 "import" / v3.14 "block" pair with the missing read-side: structured export of the user's own watch-history feed. Local-only, no third-party network, no telemetry.

**New "Export Watch History" button** (new "Account data export" section on the options page, placed above the v3.10 multi-profile section)
- Background SW fetches `https://rumble.com/account/playlists/watch-history` with `credentials: 'include'` — same SW-fetch pattern as v3.13's `importFollowedChannels`.
- Regex-parses every `<li class="videostream__details" data-video-id="…">` row in the response into a structured row: `videoId`, `title`, `url` (canonical, query-stripped), `duration`, `watchedPercentage`, `thumbnail`, `channelUrl`, `channelName`.
- Downloads the result as `rumblex-watch-history-<ISO>.json` via the existing `downloadJsonBlob()` helper — same delivery path as the v3.10 OPML export and v3.11 comment export.
- Detects logged-out responses by absence of the `videostream_details` / `data-playlist="watch-history"` markers. Toast suggests sign-in.

**New message API**: `exportWatchHistory` → `{ ok, count, exportedAt, items: [...] }` or `{ ok: false, reason: 'not-logged-in' | 'http-XXX' | <error string> }`.

**No new permissions, no new settings keys, no new selectors** — the `history.*` selectors registered in v3.14 are reserved for the future in-tab BulkRemoveFromHistory module; this release uses the v3.13 SW-fetch + regex-parse strategy because it does not require an open tab.

**Catalog parity:** 201/201/201/201 unchanged. Selector harness: 85 passes across 17 fixtures unchanged. `node --check` clean across all three JS files.

### Deferred to v3.16+

- **BulkRemoveFromHistory** — still pending. Tab-side menu automation through `history.itemMenuTrigger` + `history.itemMenuOption`. The SW-fetch export shipped here covers the read use case; bulk-delete is the orthogonal write use case.
- **Profile follow-toggle automation**, **Studio scene tools**, **chat-username submenu context-menu entry**, **chrome.declarativeNetRequest autoplay rules** — all still blocked on missing live captures or multi-day rewrites; see ROADMAP.

## [3.14.0] - 2026-05-19

### v3.14.0 — "Block this channel" context-menu entry + 11 new Selectors from MHTML batch

**New context-menu entry: "Block this channel from feeds"**
- Extends the v3.5 contextMenus integration. Appears on right-click of any `/c/<slug>` or `/user/<slug>` link, or on a channel page itself. Scoped via `targetUrlPatterns` so it doesn't appear on non-channel links.
- Extracts the channel slug from the URL (lowercase, matching the existing `ChannelBlocker` storage shape). Appends to the `blockedChannels` array. No-ops with toast when already blocked.
- Confirmation surfaces as an in-page toast via the new `rxShowToast` message — keeps the result on the same page the user just acted on instead of opening a popup or browser notification.

**11 new Selectors registry entries** (now 51 total, up from 37)
- `library.watchHistorySection` / `library.watchLaterSection` / `library.userPlaylistsSection` / `library.videoGrid` — `/library` page surfaces.
- `history.clearAllBtn` / `history.pauseToggleBtn` — bulk-action buttons on `/account/playlists/watch-history`.
- `history.videoList` / `history.videoDetails` / `history.itemMenuTrigger` / `history.itemMenuOption` — per-item watch-history surfaces (foundation for the future BulkRemoveFromHistory feature).
- `profile.followingBtn` — follow/unfollow toggle on `/c/<channel>` profile pages.
- All sourced from the 2026-05-19 MHTML batch (Watch History / Watch Later / My Library / Profile fixtures).

**Regression harness:** 85 passes across 17 fixtures (was 75). All 11 new selectors verified against their target captures.

**Catalog parity:** 201/201/201/201. New `rxShowToast` message handler in content.js. No new manifest permissions (uses existing `contextMenus` + `scripting`).

### Deferred to v3.15+

- **BulkRemoveFromHistory** module — `history.itemMenuTrigger` selectors registered but no consumer yet. The watch-history rows open a menu (popout) on click that contains the "Remove" option — the bulk pattern is more involved than BulkUnsubscribe (which has a direct row-button). Worth ~half a release on its own.
- **Profile follow-toggle automation** — `profile.followingBtn` registered. Could feed a "channel auto-follow on first visit" feature. Niche; defer.

## [3.13.0] - 2026-05-19

### v3.13.0 — Import followed channels into the notifier

Closes the obvious next-step that fell out of v3.9 + v3.12: now that the watchedChannels notifier exists *and* the Followed Channels page structure is known from the 2026-05-19 MHTML batch, users shouldn't have to manually paste every channel URL.

**New "Import from Followed" button on the Channel Notifier section**
- Background SW fetches `https://rumble.com/account/following` with `credentials: 'include'` so the user's session cookies authenticate the request (host permission for rumble.com is already declared).
- Parses every `<li class="followed-channel" data-type="channel">` row — channel URL from the `/c/` or `/user/` link, name from `<span class="line-clamp-2">`. Query params stripped so imported URLs are canonical.
- Detects logged-out responses by absence of the `followed-channels__section` marker. Toast suggests "sign in on rumble.com first, then retry."
- Deduplicates against existing watchedChannels. Toast reports `Scanned N · added X · skipped Y duplicate(s) · total now Z`.
- Re-syncs the notifier alarm after import so the new channels start being polled on the next tick (no extension reload needed).

**Three new Selectors registry entries**
- `account.followedChannelsItem` — `li.followed-channel[data-type="channel"]`
- `account.followedChannelsItemLink` — channel URL inside the row
- `account.followedChannelsItemName` — `.line-clamp-2` channel name

**New message API**: `importFollowedChannels` → `{ ok, scanned, added, duplicates, total }` or `{ ok: false, reason: 'not-logged-in' | 'http-XXX' | <error string> }`.

**Catalog parity:** 201/201/201/201. Selector harness: 78 passes / 17 fixtures (3 new account selectors verified against Followed Channels.mhtml).

## [3.12.0] - 2026-05-19

### v3.12.0 — BulkUnsubscribe + Selectors tightening from new MHTML batch

User dropped **13 new MHTML captures** into `Sample Pages/` (Shorts, Recurring Subs, Followed Channels, Rumble Studio, Watch History, Watch Later, My Library, Profile, Editor Picks, Trending, Browse, Stats & Analytics, Sticker Mule). This release unblocks the highest-value items they enable.

**Selectors registry tightened (12 → 37 entries; 32 → 37 from this batch)**
- **`shorts.feed` / `shorts.card` / `shorts.player`** — replaced the v3.1 conservative `data-js="shorts_*"` placeholders with the real semantic class names verified against `Sample Pages/Shorts.mhtml`: `rum-shorts-feed__screen-container`, `rum-shorts-screen__aspect-box`, `rum-shorts-player-overlay`. Hashed-prefix utility tokens (`rum-4oaq3e`) stay untouched per house style.
- **`shorts.navItem`** — new entry. `[class*="rum-shorts-navigation__item"]`.
- **`account.recurringSubsCancelBtn`** — `button[data-js="cancel_recurring_subscriptions"]`. The per-row Cancel button on `/account/subscriptions/recurring` (paid Locals).
- **`account.recurringSubsRow`** — `tr:has(...)` wrapper around the row.
- **`account.followedChannelsSection`** — `[data-js="followed-channels__section"]`. Container.
- **`account.followedChannelsUnsubBtn`** — `button[data-action="unsubscribe"][hx-post*="legacy-video-collection"]`. Per-row Unsubscribe button on `/account/following`.

**Regression harness extended**
- `FIXTURE_EXPECTATIONS` now covers all 17 fixtures with per-page surface lists. Trending + Browse list `header.root` only (their feed cards lazy-load via htmx after initial render). Sticker Mule store has an empty expectation list (3rd-party domain). Stats and Studio assert only the header — Studio is a heavy SPA with sparse static HTML; the harness emits a `WARN` when only the fallback selector matches there.
- **75 surface resolutions across 17 fixtures, 0 failures.** Up from 35/4.

**New `BulkUnsubscribe` module** (closes v2.5 "Bulk unsubscribe with preview, stop, undo toast" ROADMAP item)
- Mounts a sticky-top toolbar on `/account/following` and `/account/subscriptions*` pages when `bulkUnsubscribeEnabled` is on. Inserts a checkbox at the start of each row containing a native Unsubscribe/Cancel button.
- Three actions: **Select all** / **Clear** / **Run** / **Stop**.
- **Honors `bulkUnsubscribeDryRun`** (default ON from v2.0). With dry-run on, "Run" counts what would happen and shows a toast — no native button is clicked. The toolbar displays a visible "DRY-RUN" tag so this is unambiguous. User must explicitly flip `bulkUnsubscribeDryRun` OFF to actually unsubscribe.
- **350 ms inter-click pacing** so htmx requests don't pile up and trip Rumble's rate limit.
- **Stop button** aborts the in-flight loop cleanly. Each clicked row's checkbox unchecks itself so a re-run doesn't double-process.
- Honest UX: the toast at end reports `Done: unsubscribed from N` or `Stopped after N`.
- Re-evaluates on every `Router.onChange` so navigating between `/account/*` subsections re-mounts the bar correctly.

**Catalog parity:** 201/201/201/201 unchanged (BulkUnsubscribe consumes the existing `bulkUnsubscribeEnabled` + `bulkUnsubscribeDryRun` keys from v2.0).

### Deferred to v3.13+

- **Studio scene tools** — Studio.mhtml has minimal static HTML (heavy SPA, content renders after JS). Will need a second capture WHILE inside the Studio editor (mid-stream) to extract scene-mover selectors.
- **`account.profile.*`** / **`account.library.*`** selectors — Watch History / Watch Later / My Library / Profile fixtures need expectations refined once specific features target them.

## [3.11.0] - 2026-05-19

### v3.11.0 — Comment Export module

Closes the v2.0 `commentExport` setting key that has shipped with no consumer module for nine releases.

**New `CommentExport` feature module**
- Mounts an "Export comments" button at the top of `Selectors.find('comments.root')` on watch pages when `commentExport` is on. Anchors via the v2.0 Selectors registry; re-anchors on htmx route changes via `Router.onChange`.
- **Click → JSON download.** Payload: `{ exportedAt, pageUrl, pageTitle, count, comments: [{ id, author, text, votes, ts }] }`. Pretty-printed with `JSON.stringify(_, null, 2)`.
- **Shift-click → CSV download.** Same fields, RFC 4180-style escaping (quote-wrap when the value contains `"`, `,`, `\n`, or `\r`; doubled quotes inside).
- Extraction iterates `Selectors.findAll('comments.item')` so the data model tracks the v2.0 selector registry — when Rumble's DOM shifts, only `Selectors._map` needs an update.
- Filename pattern: `YYYY-MM-DD_<sanitized-title>_comments.{json,csv}`.
- Honest UX: only exports comments Rumble has actually loaded. Toast tells the user the count so they know whether to scroll-to-load-more before re-exporting.

**Catalog parity:** 201/201/201/201 (commentExport key was already in catalog since v2.0).

## [3.10.0] - 2026-05-19

### v3.10.0 — Watched-channels OPML export + multi-profile settings UI

Closes two more deferred ROADMAP items, both built on data models from earlier releases.

**Watched-channels OPML export** (builds on v3.9 `watchedChannels`)
- New `exportWatchedChannelsOpml` message → returns OPML 2.0 XML with each watched channel as an `<outline type="rss">` entry. `xmlUrl` synthesised from `<channel-url>?rss=1` per Rumble's standard RSS-feed suffix.
- New **Export OPML** button in the Channel Notifier section. Downloads `rumblex-watched-channels-YYYY-MM-DD.opml`. Empty-list case shows an info toast rather than producing an empty file.
- Any RSS reader (Inoreader, Feedly, NetNewsWire, etc.) can import the OPML to follow the same channels outside the extension. Closes the `rssExportEnabled` v2.0 setting.

**Multi-profile settings UI** (closes v2.0 `settingsProfiles` + `activeProfileId` keys)
- New profile system stored separately at `rx_settings_profiles` (not in `rx_settings`, so a profile switch doesn't recursively snapshot itself). Each profile: `{ id, name, createdAt, settings }`. Hard cap 25 profiles.
- New options-page section: **Settings profiles** (collapsed-by-default, sits between Channel notifier and Privacy report). Name input + "Save current settings as profile" button. Per-row Switch + Delete buttons. Active profile labeled `ACTIVE`.
- New message API: `listProfiles` / `saveProfile({ name })` / `switchProfile({ id })` / `deleteProfile({ id })`. Switch auto-creates a `pre-profile-switch` backup snapshot via the existing v3.0 system, so the previous profile's drift is preserved in the backup history.
- Validation: empty-name / duplicate-name / cap-reached error reasons. URL is not validated (profiles are settings blobs, not URLs).

**Catalog parity:** 201/201/201/201 unchanged (both features are message-API additions, not new toggle keys).

## [3.9.0] - 2026-05-19

### v3.9.0 — Channel Notifier (chrome.alarms + chrome.notifications + Discord webhook)

Closes the v3.x ROADMAP "Channel monitor with optional Discord webhook" item — was deferred at v2.5 + v3.x because it needed `chrome.alarms` + `chrome.notifications` plumbing the extension didn't have. Now wired end-to-end.

**Backend (`background.js`)**
- New permissions: `alarms`, `notifications`. Chrome MV3 + Firefox MV2.
- `rxSyncChannelNotifier()` registers a single `rx-channel-notifier` alarm with `periodInMinutes: channelNotifierIntervalMin` (default 30, MV3 floor 1). Re-syncs live on every settings flush via `chrome.storage.onChanged`.
- `rxRunNotifierPass()` runs on each alarm tick: fetches every watched channel URL, parses HTML for the most recent `data-video-id` + a `videostream__status--live` / `channel__live-on-air` / `aria-label*="Live"` indicator, fires `chrome.notifications.create()` when state changes (new video ID or live started). Notification clicks open the channel URL in a new tab via `chrome.notifications.onClicked`.
- `rxPostDiscordWebhook()` optionally POSTs a JSON `{ content }` payload to the user-provided `discordWebhookUrl` after every notification. Failure is swallowed; the OS notification still fires.
- All fetches scoped to the existing rumble.com host permissions — no new origins.

**New settings keys**
- `watchedChannels: []` — array of `{ url, name, lastSeenVideoId, isLive, lastChecked, lastError }` objects. Managed via UI (see below).
- `channelNotifierIntervalMin: 30` — poll interval. Editable from the Settings editor; live alarm resync on change.

**Options-page UI (new section between Snapshot history and Privacy report)**
- Add-channel form: URL input + optional display name + "Add channel" button. Backend validates that the URL is `rumble.com` and not a duplicate.
- Watched-channels list: name + URL + last-checked timestamp + LIVE tag when applicable + error tag when fetch failed. Per-row **Remove** button.
- **Run check now** button — fires `rxRunNotifierPass()` immediately without waiting for the next alarm tick.
- **Send test notification** button — fires a sample `chrome.notifications.create()` so users can verify OS-level permissions are granted.
- Section gated by `channelNotifierEnabled` — summary line shows "disabled" tag when off.

**Message API** (extension-origin only, not exposed to content scripts)
- `addWatchedChannel({ url, name })` → `{ ok, count, reason? }` with validation reasons `bad-url`/`not-rumble`/`duplicate`/`parse-failed`.
- `removeWatchedChannel({ url })` → `{ ok, count }`.
- `runNotifierNow()` → `{ ok, reason? }`.
- `testNotification()` → `{ ok, id }`.

**Catalog parity:** 201/201/201/201.

**Deferred to v3.10+:** RSS/OPML export of watched channels (uses the same list, `rssExportEnabled` key from v2.0). Multi-stream auto-open when several watched channels go live simultaneously.

## [3.8.0] - 2026-05-19

### v3.8.0 — axe-core accessibility regression spec

Closes the v4.0 ROADMAP cross-cutting **Accessibility** workstream "Next" item: "Color-contrast pass with axe DevTools."

**axe-core Playwright spec (`tests/e2e/a11y.spec.js`)**
- Three test cases scan the static extension pages with the standard `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice` ruleset:
  1. **Options page** — landed-state with v3.1 snapshot + privacy sections rendered.
  2. **Options settings modal** — dirty-draft workspace with every settings card rendered.
  3. **Popup** — feature groups + toggles.
- **Fail policy**: any `critical` or `serious` impact violation fails the build. `moderate`/`minor` are logged as a warning summary for hand-triage each release.
- Targeted rule changes: `region` rule disabled (popup is intentionally a single 320 px landmark).

**Dependencies**
- `@axe-core/playwright@^4.10` + `axe-core@^4.10` added to `package.json` devDependencies.
- New `npm run test:e2e:a11y` script for local-only a11y runs.

**CI**
- The opt-in `.github/workflows/e2e.yml` workflow gains an `Accessibility audit (axe-core)` step after the main E2E suite. Same opt-in `workflow_dispatch` trigger — doesn't burn CI minutes on every push.

**Catalog parity:** 199/199/199/199 unchanged (a11y is a test-only addition).

## [3.7.0] - 2026-05-19

### v3.7.0 — chrome.sidePanel integration

Closes the v3.3 ROADMAP "chrome.sidePanel" item. Adds a third entry-point to RumbleX settings: a persistent side panel that survives every htmx navigation (unlike the popup, which closes the moment the user clicks anywhere outside it).

**Side panel registration**
- New `sidePanel` permission + `side_panel.default_path: "pages/options.html"` in `manifest.json`. Chrome/Edge only — Firefox MV2 doesn't have the API; manifest stays unchanged there.
- New setting `sidePanelEnabled` (default OFF — opt-in so we don't surprise existing users). When ON, `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` makes the toolbar icon open the side panel directly instead of the popup. When OFF, the popup is restored.
- Live toggle: `chrome.storage.onChanged` re-runs `rxSyncSidePanel()` whenever `rx_settings` changes — no extension reload needed to flip behavior.
- New group placement: lives under **Integrations** in the options page (alongside `contextMenusEnabled` and `discordWebhookUrl`).

**Hosts the existing options UI**
- The side panel points at `pages/options.html` — same page the options tab uses. This means the full v3.0 settings editor + v3.1 backup snapshot history + v3.1 privacy report + v3.5 contextMenus toggle all work inside the panel with zero extra code.
- Future v3.x work (RantStats panel from v3.3, bulk unsubscribe UI from v3.4, multi-stream viewer scaffolding) can mount as sub-views inside the same side-panel host without touching the manifest again.

**Catalog parity:** 199/199/199/199.

## [3.6.0] - 2026-05-19

### v3.6.0 — CompressionStream gzip exports + chrome.tabGroups + import-side decompression

Three more "Later"-tier atomic wins from the v4.0 ROADMAP.

**CompressionStream gzip exports**
- Settings + per-origin localStorage backup is now gzipped via `CompressionStream('gzip')` before download. Typical export drops from 1–10 MB to ~200KB–2MB (~80% reduction). Filename gains `.gz` extension; toast shows the compressed size.
- Falls back to plain JSON if `CompressionStream` is unavailable (very old Chromium) — no user-visible failure path.
- Universal browser support confirmed via [web.dev's Compression Streams API article](https://web.dev/blog/compressionstreams).

**Import-side gzip auto-detection**
- Import accepts `.json` and `.json.gz`. Magic-byte sniffing (`0x1f 0x8b`) detects gzip regardless of file extension; `DecompressionStream` does the work. Plain-JSON exports from earlier versions still import unchanged.
- `<input type="file">` `accept` attribute extended to `.json,.gz,application/json,application/gzip`.

**chrome.tabGroups: "Group all Rumble tabs"**
- New popup-footer button (left-most icon, before settings gear). One click groups every open `rumble.com` tab into a single colored tab group titled "Rumble" with green accent.
- New permissions: `tabs`, `tabGroups` (Chrome only — Firefox MV2 doesn't have the API; popup button still appears and reports `no-tabgroups-api` with a visible error tint).
- Background message: `groupRumbleTabs` → returns `{ ok, count, groupId }` on success or `{ ok: false, reason }` on failure (`no-rumble-tabs`, `no-tabgroups-api`, error message).
- Tooltip cycling shows live status: "Grouped 5 tabs" on success, "No Rumble tabs open" / "Tab groups not supported in this browser" on failure.

**Catalog parity:** 198/198/198/198 unchanged (tabGroups feature isn't a per-setting toggle — it's a one-shot action).

## [3.5.0] - 2026-05-19

### v3.5.0 — chrome.contextMenus + opt-in Playwright E2E + ES/PT-BR locale drafts

Three v3.3–v3.5 ROADMAP items closed in one focused release.

**chrome.contextMenus integration**
- New permission `contextMenus` + `scripting` (latter for clipboard fallback). Three menu entries, all scoped to `*://*.rumble.com/*` via `documentUrlPatterns` so they never appear on other sites:
  - **Copy clean URL (strip tracking)** — works on link + page contexts. Strips the same v2.4 allowlist (`e9s`, `utm_*`, `ref`, `campaign`, `fbclid`, `gclid`, etc.) on the service-worker side so right-clicked links (whose URL the content script never saw) get the same treatment.
  - **Copy URL at current time** — works on page + video contexts. Sends a `getVideoStateAtTime` message to the active tab, reads `video.currentTime` and the cleaned URL, builds a `?start=` link matching Rumble's native timestamp format and v1.x `shareTimestamp` module. Falls back to plain clean URL when no video element is on the page.
  - **Open RumbleX settings** — page + action contexts. Calls `chrome.runtime.openOptionsPage()`.
- New setting `contextMenusEnabled` (default ON). Toggling it off live re-syncs via `chrome.storage.onChanged` — the SW removes the menu entries without a reload.
- Copy helper uses `chrome.scripting.executeScript` to run a tiny in-tab clipboard write (Service Workers can't access `navigator.clipboard` directly). Includes legacy `execCommand('copy')` fallback for older Chromium builds.
- Menu entries registered on `chrome.runtime.onInstalled`. `removeAll()` first to avoid duplicate-id errors on extension update.

**Opt-in Playwright E2E suite**
- New `package.json` + `playwright.config.js` + `tests/e2e/` directory. Run locally with `npm install && npm run test:e2e`.
- `tests/e2e/_fixtures.js` extends Playwright's test base with a persistent Chromium context that pre-loads the MV3 extension via `--load-extension`. Each test gets its own temp profile so `rx_settings` doesn't leak between cases.
- First-pass coverage: extension service worker boots within 15 s (`extension-loads.spec.js`), options page renders the v3.1 snapshot + privacy sections, popup renders feature groups with `aria-pressed` toggles, settings modal dirty-draft search filters correctly, catalog parity sanity ≥ 180 boolean cards (`settings-modal.spec.js`).
- New `.github/workflows/e2e.yml` runs on `workflow_dispatch` only — avoids the ~200 MB Chromium download on every push. Uploads `playwright-report/` as an artifact with 7-day retention.
- Test artifacts (`node_modules/`, `playwright-report/`, `test-results/`, `.playwright/`) added to `.gitignore`.

**Spanish + Brazilian Portuguese locale drafts**
- `extension/_locales/es/messages.json` and `extension/_locales/pt_BR/messages.json` — 32/32/32 key parity with the English source. Marked as initial translations needing human review before store publish (description fields call this out explicitly).
- Both locale folders use underscore (`pt_BR`, not `pt-BR`) per Chrome i18n folder-naming convention.

**Catalog parity:** 198/198/198/198.

## [3.4.0] - 2026-05-19

### v3.4.0 — Regression harness + CI

Closes the v3.4 ROADMAP item "MHTML fixture replay harness" and tightens the existing build workflow into a true gate.

**Selector regression harness**
- New `test_selectors.py` at the repo root — stdlib-only Python script (matches `analyze_pages.py` precedent, no `pip install` required). Walks every `Sample Pages/*.mhtml` fixture, extracts the HTML payload, then asserts every named surface in `Selectors._map` resolves to at least one element via its stable or fallback selector. Mixed-quote selectors (single-quoted outer with double-quoted attribute values, and vice versa) are handled via a permissive string-pattern matcher.
- Uses regex / substring matching rather than a real CSS engine — sufficient because we're checking "this selector pattern appears in the HTML at all", not "this selector parses into a valid CSS AST".
- Fixture expectations are per-file via `FIXTURE_EXPECTATIONS` so we don't fail when a surface only exists on one route kind (e.g. `chat.*` is checked on `Live.mhtml`, not `For You.mhtml`).
- 35 surface resolutions across the 4 shipped fixtures pass on first run. Warns (does not fail) when only the fallback matched — useful selector-drift signal.

**CI tightening**
- `.github/workflows/build.yml` gains a `test` job that runs on every push to `main` and every PR (not just on release tags). The job runs the selector harness, `node --check` on every shipped JS file, and a catalog-parity assertion (197/197/197). The existing `build` job now `needs: test`, so a regression PR can't ship.
- `pull_request` trigger added — every external contribution is now validated automatically.

## [3.2.0] - 2026-05-19

### v3.2.0 — Target-size 24px + chrome.offscreen scaffolding

Two Now/Next-tier closes from the v4.0 ROADMAP.

**Accessibility (WCAG 2.2 SC 2.5.8 Target Size)**
- Popup toggle bumped 34×18 → 40×24 (track) + 14×14 → 20×20 (thumb). Translate offset re-computed to stay correct.
- In-page settings-modal switch bumped 40×22 → 40×24 (track) + 16×16 → 18×18 (thumb). Translate offset re-computed.
- Options-page toggle already at 44×26 — no change needed, recorded as compliant.
- Toggle-switch full-rounded shape preserved per the no-pill-backdrops rule's explicit exception for toggle thumbs and tracks.

**MV3 offscreen-document scaffolding** (preparing the v3.3 sidePanel + RantStats panel work)
- New `extension/offscreen.html` + `extension/offscreen.js` host two read-only operations: `parseHtml` (DOMParser via DOM_PARSER reason) and `hashBlob` (fetch + SHA-256 via BLOBS reason).
- New `background.js` helpers: `ensureOffscreenDocument()` honors Chrome's "one offscreen doc per extension per profile" contract via `chrome.offscreen.hasDocument()`. `callOffscreen(action, payload)` is the single async call site. Reasons declared at creation: `DOM_PARSER` + `BLOBS` + `WORKERS`.
- New message-API surfaces: `parseHtmlOffscreen` and `hashBlobOffscreen`. Content scripts cannot call `chrome.offscreen.*` directly — they go through the service worker. Falls back to a structured `{ ok: false, reason: 'no-offscreen' }` response if offscreen is unsupported (Firefox MV2 or older Chrome) so callers can degrade gracefully.
- `offscreen` permission + web-accessible-resource entry added to `manifest.json` (Chrome MV3 only). Firefox MV2 doesn't have the API; manifest stays unchanged there.
- Build script + GH Actions workflow include `offscreen.html` + `offscreen.js` in the release ZIP.

**Deferred to v3.3+:** Migration of HLS/download work from `worker.js` to the offscreen document. Today only the two atomic read-only paths use it; full migration happens with the Mediabunny work in v3.3.

## [3.1.0] - 2026-05-19

### v3.1.0 — Platform follow-through, accessibility, supply-chain hardening, i18n bootstrap

First release executing against the v4.0 research-driven ROADMAP. Closes 11 of the Now-tier items.

**Platform follow-through (Rumble Shorts + Wallet)**
- `Page.isShorts()` classifier + `'shorts'` page kind in `Page.classify()`. Detects `/shorts`, `/shorts/*`, `/shorts.*` paths. Rumble Shorts launched on web 2026-02-04.
- `ShortsRedirect` module — when `disableShortsFeed` is on, navigating to `/shorts` triggers `location.replace('/subscriptions')`. Re-evaluates on every htmx route change via `Router.onChange` so it fires on in-app nav too.
- `hideWalletTipButton` toggle added to the `RX_CSS_TOGGLES` hide-X registry. Off by default. Tip jar launched 2026-01-07 with Tether.
- `Selectors._map` extended with `shorts.feed`, `shorts.card`, `shorts.player`, `wallet.tipButton` — conservative selectors today, will tighten once we have MHTML captures.

**Accessibility (WCAG 2.2)**
- SC 4.1.3 Status Messages — settings-modal toast region now has `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. Options-page status divs already had this; left intact.
- SC 4.1.2 Name, Role, Value — `aria-pressed` added to every Switch component across the in-page settings modal, popup, and options-page toggle controls. State is kept in sync on every `change` event.
- Popup category groups already had `aria-expanded` — verified, no change needed.

**`autoplayBlockMode` enum wired**
- AutoplayBlock module now honors `Settings.get('autoplayBlockMode')`: `off` (matches `!autoplayBlock`), `playerOnly` (DOM-overlay removal only, v1.x behavior), `relatedEndpointAndPlayer` (default — also installs an `ended` event guard on the player to pause the next-video auto-load). v3.2 will pair this with `chrome.declarativeNetRequest` rules at the service-worker layer.

**Backend → UI wiring (consumes v3.0 helpers)**
- Options page Backup Snapshot history section — calls `listSnapshots` / `backupSnapshot` / `restoreSnapshot` via the existing message API. Shows timestamp + reason for each, per-row Restore button (each restore snapshots-before-overwrite so it's itself undoable).
- Options page Privacy Report section — calls `getPrivacyReport`, renders structured JSON output. Honest disclosure beats no disclosure.
- Options page Selector Telemetry export — calls `getSelectorTelemetry`, downloads as JSON (only populated when `debugSelectorTelemetry` is on).

**Supply chain**
- `extension/build.sh` now SHA-256 verifies the bundled `mux.min.js` against a pinned hash. Refuses to ship unverified bytes. Constants documented for safe upgrades. Supports `shasum`, `sha256sum`, and `certutil` (Git-Bash on Windows fallback).
- `content_security_policy` added to both manifests: `script-src 'self'; object-src 'self'; base-uri 'self'`. Locks down the extension origin from inline-script / object / base-tag attacks.

**i18n bootstrap (Now-tier preparation for v3.5 distribution)**
- `extension/_locales/en/messages.json` created with the core ~30 user-visible strings (manifest name/description, action title, options page CTAs, group labels, snapshot/privacy section labels).
- Both manifests updated to `default_locale: "en"` with `__MSG_*__` references for `name`, `description`, and `default_title`.
- Build script + GH Actions workflow include `_locales/` in the release ZIP.

**Community files**
- `CONTRIBUTING.md` — what we accept, what we don't, code style, setup, release process.
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1.
- `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, `selector_regression.md` — three structured templates.

**Catalog parity:** 197/197/197/197 across content.js `_defaults`, popup.js `DEFAULTS`, options.js `DEFAULTS`, options.js `META`.

## [3.0.0] - 2026-05-19

### v3.0.0 — Distribution, store readiness, v2.6 backend, README refresh

Closes the v2 roadmap arc with v2.6 atomic backend helpers and the v3.0 distribution-readiness work. Bumps to v3.0.0.

**v2.6.0 — Data, Profiles, Accessibility, Privacy (backend atoms)**
- **`rxBuildPrivacyReport()`** — Returns a pure-read snapshot of RumbleX's local privacy footprint: schema version, total feature count, enabled features, manifest permissions, host permissions, every external network surface RumbleX can touch (rumble.com / 1a-1791.com / rumble.cloud / api.github.com — honestly enumerated), telemetry status ("none — no analytics, no remote logging, no usage beacons"), localStorage byte/key counts, and live status notes for tracking-strip / selector telemetry / remote cosmetic rules. Exposed via `chrome.runtime` message `getPrivacyReport`. No network, no side effects.
- **`rxBackupSnapshot(reason)`** / **`rxListSnapshots()`** / **`rxRestoreSnapshot(indexOrAt)`** — Rolling stack of pre-destructive-op settings snapshots stored at `rx_settings_snapshots`. Honors `backupHistoryLimit` (default 10). `restoreSnapshot` itself snapshots before overwriting so an unwanted restore is undoable. Exposed via message actions `backupSnapshot`, `listSnapshots`, `restoreSnapshot`. Options-page UI to consume these lands in a follow-up.
- **`getSelectorTelemetry`** — Drains and returns the `Selectors._telemetry` ring buffer (only populated when `debugSelectorTelemetry` is on). No upload — caller is expected to write the events to a user-initiated download.

**v3.0.0 — README refresh**
- README intro rewritten to describe the v2.x feature superset honestly (130+ modules, 14 categories, OLED Green theme, thumbnail hider, dense mode, reduced motion, tracking-strip, external player, keyword regex/wildcard, rant tier filter, chat username colors).
- "What's new in v2.x" digest added: per-milestone summary of what shipped at v2.0/v2.1/v2.2/v2.3+v2.4/v2.6.
- All version badges (codex-branding block + `shields.io`) synced to v3.0.0.

### What's intentionally NOT in v3.0.0

The original v3.0 acceptance criteria included a single-file userscript regenerated from a shared core. That's a multi-day rewrite that would compete with the rest of the v2 roadmap arc and risks regressing the v1.x userscript users still rely on. `RumbleX.user.js` remains at the v1.8.0 baseline. The extension is the primary distribution surface; userscript regeneration is tracked as a deferred v3.1+ deliverable in ROADMAP.md.

Other deferred items (Rumble Studio scene tools, uploader metadata fill, bulk unsubscribe UI, channel notifier alarms, OBS alert export, multi-stream viewer) all require live captures of logged-in-only Rumble surfaces I don't have, so they remain in the roadmap as ROADMAP.md-tracked deferrals rather than half-shipped stubs.

## [2.4.0] - 2026-05-19

### v2.3.0 + v2.4.0 — Live chat hardening + feed/discovery moderation

Bundles the implementable atomic features from the v2.3 (Live Chat & Rants) and v2.4 (Feed/Discovery/Moderation) milestones into a single shipped release. Two waves below; jumps to v2.4 because that's the highest milestone with shipped features (skipping a tagged v2.3 release; the v2.3 acceptance items show as checked in ROADMAP.md).

**v2.3.0 — Live Chat, Rants**
- **RantTierFilter** — When `rantTierFilter > 0`, hides chat rants below the configured tier (1-10 → matches `.chat-history--rant[data-level]`). CSS-only — raising/lowering the threshold reveals previously hidden rants without needing the stream to redeliver them.
- **ChatUsernameColors** — Three modes via `chatUsernameColors`: `off` | `deterministic` (hash username → HSL hue, fixed sat/lightness) | `tiered` (color by rant tier when present, else hash). MutationObserver scoped to `#chat-history-list` so the colorizer doesn't scan the whole document. Rolls back inline style on `destroy()`.

**v2.4.0 — Feed, Discovery, Moderation**
- **KeywordFilter mode upgrade** — Honors `blockedKeywordsMode`: `literal` (default, v1 behavior), `regex` (raw RegExp source, compiled with `i` flag, sandboxed — a bad regex falls back to literal substring for that one entry so a typo doesn't disable the whole filter), `wildcard` (`*` → `.*`, `?` → `.`, anchored). Matchers compiled once per (keywords, mode) signature.
- **StripTrackingParams** — Removes Rumble's tracking/referral query params via allowlisted-strip model. Scrubs known trackers (`e9s`, `ref`, `referrer`, `src`, `utm_*`, `mtm_*`, `campaign`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`, `igshid`, `_ga`, `yclid`) while preserving canonical params (`v`, `q`, `page`, `start`, `t`). On boot, scrubs `location.href` via `history.replaceState`. On click of any `<a href>`, rewrites to canonical before the browser follows (capture-phase so it beats Rumble's own handlers). Re-scrubs on each htmx route change via `Router.onChange`. Scoped to rumble.com origin only.

**Catalog parity**
- Still 195/195/195 across content.js `_defaults`, popup.js `DEFAULTS`, options.js `DEFAULTS` + `META`. Two new module IDs added to `RX_CATEGORIES` (`stripTrackingParams` under Feed Controls; rant/chat enum settings remain options-page-only since they're not booleans).

### Deferred to v2.3+ / v2.5+
- Full RantStats-parity sidebar (`rantStatsPanel`) — needs significant UI work; cached rants from the existing `rantPersist` already cover the bulk of the value.
- Chat participants list (`chatParticipantsList`) — needs a derived-state observer over chat history; deferred to v2.5.
- Multi-stream viewer (`multiStreamViewer`) — experimental; needs iframe sandboxing and chat panel orchestration. Deferred.
- Politics filter preset (`politicsFilterPreset`) — needs an editable rules JSON; subjective category definitions out of scope for v2.4.
- Remote cosmetic rules — needs signed rule format + signature verification; deferred to v2.6.

## [2.2.0] - 2026-05-19

### v2.2.0 — Download Manager 2.0 (Phase 1)

First implementable slice of the v2.2 download superset. Lands the visible "external player handoff" surface plus a reusable media probe cache other download modules can adopt.

**New feature modules**
- **ExternalPlayer** — Adds an "Open in player" button on watch pages next to the share row when `externalPlayerEnabled` is on. Substitutes the current page URL into `externalPlayerTemplate` (default `mpv://{url}`) and launches it. HTTPS templates use `window.open(..., '_blank')`; custom-protocol templates (`mpv://`, `potplayer://`, `vlc://`) launch via a hidden iframe so the parent page never navigates if the browser rejects the URL. Routes through `Selectors.find('watch.share')` from the v2.0 registry; re-anchors on htmx route changes via `Router.onChange`. Visible by default in the **Downloads & Capture** category.

**New shared module**
- **MediaProbeCache** — Persistent TTL-keyed cache for media probe results (embedJS responses, HLS manifest variants, CDN HEAD probes). `get(key)` / `set(key, val)` / `clear()` API backed by `chrome.storage.local` with debounced flushes (250ms). Lazy GC on read — expired entries are dropped + flushed. Honors `downloadProbeCacheTtlHours` (0 disables cache entirely); falls back to in-memory only on storage errors so the cache never blocks downloads. Available globally to feature modules; `VideoDownloader` will adopt it in a follow-up pass.

### Deferred to v2.3+
- DASH/fMP4 detection in `VideoDownloader` — non-trivial parser + mux pipeline. The existing HLS-to-MP4 transmux path already covers the majority of Rumble's modern CDN responses.
- Real audio extraction via `ffmpeg.wasm` — adds ~25MB to the extension bundle. Will ship as an opt-in companion package rather than bundled. `audioExtractionMode: 'browserIfSupported'` semantics formalized in v2.0; the actual `ffmpeg.wasm` integration is v2.4 scope.
- Batch and channel archive queue with concurrency/resume/manifest — depends on a v2.3 service-worker queue with persisted state. Settings keys (`channelArchive*`, `downloadConcurrency`, `batchDownload`) shipped in v2.0; the queue UI lands in v2.3.
- Live stream recording prototype — `liveDVR` already covers the last-N-seconds case from v1.8. Indefinite-duration live recording requires a robust service-worker handoff and lands with the v2.3 archive queue.

## [2.1.0] - 2026-05-19

### v2.1.0 — Premium UI and Layout Superset

Builds on v2.0.0's core engine. Lands the visible v2.x UI superset behind the schema-v2 settings keys shipped in v2.0.

**New feature modules**
- **ThumbnailHider** — Three composable toggles: `hideThumbnails` (master), `hideThumbnailsFeeds` (feeds only), `hideThumbnailsRelated` (related sidebar only). Hides via `visibility: hidden + opacity: 0` so grid heights stay intact (no ugly stacking reflow). Also blanks `background-image` on poster wrappers (live cards, hero banners use CSS backgrounds, not `<img>`).
- **DenseMode** — Tightens spacing across feed grids, watch page, comments, related media when `denseMode` is on. Pairs cleanly with `wideLayout` for power users. Scoped under `body.rx-dense` so disable fully restores layout.
- **AccountPaginationCompact** — Implements the community Reddit userscript via the new setting registry. `.pagination.autoPg` on `/account/content*` now clamps to 720px and tightens vertical rhythm. Scoped to account pages only via the new `Page.isAccount()` classifier.
- **ReducedMotion** — Honors the explicit `reducedMotion` setting *and* the OS `prefers-reduced-motion` media query. Kills RumbleX shimmer/stagger/spring; degrades animation durations to `0.001ms` so transitions don't read as broken.
- **HomeCleanupPreset** — Three presets driven by the new `homeCleanupPreset` enum: `focused` hides editor picks, recommendations, premium row, featured banner; `minimal` adds every category row except subscribed/live; `custom` falls back to the existing hide-X toggles. Layers on top of `CategoryFilter` without conflict.

**OLED-grade native-token theme mapping**
- `DarkEnhance` now writes Rumble's *native* CSS custom properties (`--color-bg-*`, `--brand-*`, `--link-color`, `--input-*`, `--channel-border*`, `--menu-border-color`, etc.) in addition to RumbleX's `--rx-*` tokens. Themed surfaces now inherit the active palette without per-selector overrides — drops the number of `!important` rules needed to keep `darkEnhance` ahead of Rumble's stylesheet churn.
- Applies to all four existing themes (Catppuccin, YouTubify, Midnight AMOLED, Rumble Green) plus the new `oledGreen` theme added in v2.0.

**Catalog parity**
- 195/195/195 keys across content.js `_defaults`, popup.js `DEFAULTS`, options.js `DEFAULTS` + `META`. Six new module IDs added to `RX_CATEGORIES` (in-page modal) under the **Theme & Layout** category.

### Deferred to v2.2+
- Full hide-X registry migration to `Selectors` — v2.1 modules use both inline selectors (for hot paths) and the registry (for new code). v2.2 will mechanically swap the rest.
- Full-browser theater refresh — TheaterSplit + Rumble Resize merger. Existing `theaterSplit` + `fullWidthPlayer` modules already cover the use cases; v2.2 unifies the UI.

## [2.0.0] - 2026-05-19

### v2.0.0 — Core Engine, Schema v2, and Settings Superset (Phase 1 of v2)

First implementation pass against the ROADMAP. Lays foundation for the v2.x feature waves (premium UI, download manager 2.0, RantStats-parity chat, feed/moderation, creator tools, privacy/profiles) without breaking any v1.9 surface.

**Schema v2 migration**
- Storage gains a `schemaVersion: 2` marker. `Settings.init()` now runs a one-shot migration on load: any pre-v2 `keyboardNav` value is preserved into the new `legacyKeyboardNav` key so users whose hotkeys were on don't silently lose them. The migrated payload is written back immediately so the migration only runs once per profile.
- Adds 70+ new settings keys covering: core/theming (`denseMode`, `reducedMotion`, `glassIntensity`, `accentColor`, `debugSelectorTelemetry`), layout (`hideThumbnails*`, `compactAccountPagination`, `homeCleanupPreset`, `pageDensity`), player (`qualityMode`, `perChannelVolumeMemory`, `autoplayBlockMode`, `clipExportFormat`, `segmentSkipMode`), downloads + archives (`downloadManager*`, `download{Include,Live,Shorts,Concurrency,Probe}*`, `audioExtractionMode`, `externalPlayer*`, `channelArchive*`), feed/filter (`shortsFilterScope`, `blockedChannelsMeta`, `blockedKeywordsMode`, `filterPreviewBadges`, `politicsFilterPreset`, `remoteCosmeticRules*`), chat/rants (`chatMentionHighlight`, `chatClickToMention`, `chatParticipantsList`, `chatUsernameColors`, `chatTimedMutes`, `chatMuteDurations`, `rantStatsPanel`, `rantExportFormat`, `rantTierFilter`, `rantStickyHighValue`, `multiStreamViewer`), comments (`commentThreadView`, `commentSearch`, `commentMuteDurations`, `commentExport`), automation/creator/integrations (`bulkUnsubscribe*`, `channelNotifierEnabled`, `discordWebhookUrl`, `rssExportEnabled`, `creatorMode`, `uploaderMetadataFill`, `studioSceneTools`, `obsAlertExport`), and privacy/data (`stripTrackingParams`, `privacyReport`, `settingsProfiles`, `activeProfileId`, `backupHistory`, `backupHistoryLimit`, `encryptedGistSync`).
- All three catalogs (content.js `_defaults`, popup.js `DEFAULTS`, options.js `DEFAULTS` + `META`) extended in lockstep. Five new options-page groups added: **Core**, **Automation**, **Creator & Studio**, **Integrations**, **Privacy & Data**.

**Selector Registry (`Selectors`)**
- New top-level module loaded before features. Provides `find(key, root)`, `findAll(key, root)`, and `wait(key, { timeout, root })` against a 27-entry named-surface map built from the MHTML ground-truth selector table in `ROADMAP.md`. Each entry has a stable selector (preferring `data-js`, `aria-*`, IDs, structure) and a fallback for Rumble's CSS-utility-heavy DOM.
- Selector fallbacks and timeouts are logged into an in-memory ring buffer when `debugSelectorTelemetry` is enabled. No network, no auto-upload — drainable via `Selectors.drainTelemetry()` for local export later.
- Existing features keep their inline selectors for now; new v2.x feature work routes through the registry so Rumble's DOM churn lands in one place.

**Route Lifecycle (`Router`)**
- New module patches `history.pushState`/`replaceState` once, subscribes to `popstate`, and listens for `htmx:afterSwap`/`htmx:afterSettle`/`htmx:historyRestore`. Emits a single normalized `{ url, prevUrl, page, prevPage, reason, changed }` event to subscribers via `Router.onChange(fn)`. `Page.classify()` now returns one of `home | feed | watch | live | embed | search | channel | account | studio | unknown`.
- Initialized at the top of `boot()` so feature `init()` calls run with route hooks already wired. v2.1+ features will subscribe instead of installing one MutationObserver per module.

**OLED Green theme**
- Adds `oledGreen` to `THEMES` — pure-black surfaces tuned for AMOLED, Rumble-green accent (`#85c742`), denser borders, alpha-only glass (no `backdrop-filter`, per house style). Existing `catppuccin` default preserved on upgrade; v2.1 will flip new installs to `oledGreen`.

**KeyboardNav → legacy**
- `KeyboardNav.id` renamed `keyboardNav` → `legacyKeyboardNav`. Default flipped to **off**, matching the house rule "Never add keyboard shortcuts." Moved out of the **Video Player** options group into **Core** under a "legacy" label.
- Migration preserves user intent: anyone who explicitly had `keyboardNav: true` in storage gets `legacyKeyboardNav: true` after upgrade — no silent feature loss.

**Catalog parity**
- 126 (v1.9) → ~197 settings keys across content.js, popup.js, options.js. All three editors continue to match on every key.

### Deferred to v2.1+
- Full extraction of `core/`, `platform/`, `features/` source layout — v2.0 keeps the current single-file `content.js` for stability; the registry + router are the seams the v2.1 split will pull through.
- Userscript parity with the new v2 settings — `RumbleX.user.js` stays at its v1.8 baseline until v2.x feature work stabilises (per roadmap acceptance criteria for v3.0.0 distribution).
- New-feature implementations behind the new toggles (download manager 2.0, RantStats-parity, multi-stream, bulk unsubscribe, creator mode, etc.) — keys + defaults shipped now so the settings UI is ready; feature modules land in v2.2 – v2.6.

## [1.9.3] - 2026-04-22

### Settings parity with Astra Deck — full round-trip backup
Export Backup and Import Backup now round-trip ALL user data, matching the multi-key backup behaviour of the Astra Deck options page. Previously `Export Backup` only saved `rx_settings` (from `chrome.storage.local`) and left every per-site localStorage key on rumble.com behind: watch progress, watch/search history, bookmarks, volume memory, and rant archives (`rx_rants_<videoId>`). A user who exported → reset → imported would silently lose everything but their settings toggles. Now:

- **`Export Backup`** queries an open Rumble tab for its localStorage payload and includes it in the export file as `localData`. The toast confirms *"Included N per-site keys from your open Rumble tab"* when it worked, or suggests *"Tip: open a Rumble tab first to include watch history, bookmarks, etc."* when no tab was found.
- **`Import Backup`** restores `rx_settings` to `chrome.storage.local` AND broadcasts `localData` to every open Rumble tab. The toast confirms *"Restored N per-site keys to M open tabs"* or prompts the user to open a Rumble tab and re-import if none were reachable.
- **Export format bumped to `exportVersion: 2`** with `localData` field. **v1 imports still work** (they just restore settings, no localData payload exists). Raw top-level settings objects (ancient format) also still import.

### Implementation
- `content.js` — new `rxReadLocalStorage()` and `rxWriteLocalStorage(data)` helpers, both constrained to the same `RX_LOCAL_STORAGE_KEYS` + `RX_LOCAL_STORAGE_PREFIXES` allowlist used by `rxClearLocalStorage`. The writer additionally rejects non-string values and keys outside the allowlist so an imported file cannot smuggle arbitrary keys onto rumble.com's origin. Both are reachable via `chrome.runtime.onMessage` actions `getLocalData` / `setLocalData`.
- `background.js` — new `getLocalData` proxy queries the first available Rumble tab (localStorage is per-origin so multiple tabs would return identical data); new `setLocalData` proxy broadcasts to every Rumble tab. Both silently no-op when no tab is open, letting the options page provide graceful UI copy.
- `options.js` — `exportSettings` + `importSettings` use the new round-trip pattern with explicit user-facing toasts describing what was or wasn't included/restored.

### Security note
The `setLocalData` write-path allowlists keys by name (or prefix `rx_rants_`). A crafted import cannot write to arbitrary localStorage keys on rumble.com — only to the specific keys RumbleX already owns.

## [1.9.2] - 2026-04-22

### Fixed — deep hardening pass

**Correctness / data safety**
- **`Reset All Data` now actually resets all data.** Previously it only cleared `chrome.storage.local.rx_settings` and left every per-site localStorage key untouched: watch progress, watch history, search history, bookmarks, volume memory, and the growing-forever `rx_rants_<videoId>` archive all survived a reset. The extension origin cannot touch rumble.com's localStorage directly, so `background.js` now broadcasts a new `clearLocalData` message to every open Rumble tab; each tab self-clears its own known keys + prefixes and reports the count. The options page surfaces an honest "Cleared N per-site keys across M tabs" confirmation.
- **VideoDownloader no longer dead-ends when `theaterSplit: false`.** The download button called `TheaterSplit._switchTab('download')` which silently no-ops when the Theater Split panel isn't mounted. Now the feature falls back to a standalone modal overlay with its own close button, click-outside + Escape handlers, and proper scan-cancellation on dismiss. Download works stand-alone.
- **`VideoDownloader._fetchAllEmbeds` no longer duplicates the initial embed request.** The caller already has the authoritative `u3` JSON; we thread it through as `primedJson` so the deep scan starts with it instead of hitting Rumble's rate-sensitive endpoint twice. Also parallelised with `Promise.allSettled` — five sequential awaits became one concurrent batch.
- **Empty-state message no longer lingers during deep scan.** When the initial embedJS returned no qualities, the "scanning the CDN…" placeholder would sit next to actual results as they landed. It now clears on the first result; if the scan completes truly empty, the text flips to an honest dead-end message rather than staying ambiguous.

**Security / XSS surface**
- **`_setBody` / `_makeRow` / `_showFormatPicker` / `_startDirectDownload` no longer pipe `e.message`, `lastError.message`, `q.label`, `q.width/height`, or any external/response text through `innerHTML`.** New `_setBodyText(className, text)` helper constructs nodes via DOM APIs; the row builder does the same. A new `rx-dl-tar-note` and the scan bar are built via `textContent` + element composition. No network-influenced text can reach the HTML parser.
- **`LiveChatEnhance` no longer round-trips chat DOM through `innerHTML`.** Previously `el.innerHTML = el.innerHTML.replace(/@(\w+)/g, '<span ...>@$1</span>')` re-parsed the entire subtree on every chat message, which could retrigger markup side-effects in any HTML Rumble's chat renderer emits (e.g. `<img onerror>`). Replaced with a `TreeWalker` that mutates only `Text` nodes in place via `DocumentFragment` replacement — Rumble's existing markup is never re-parsed.
- **`background.js download` already host-allowlists.** Extended the allowlist to `rumble.cloud` so RUD-discovered CDN URLs continue to work without loosening the guard elsewhere.

**Memory & listener leaks**
- **`MiniPlayer` drag handlers** (`mousemove` / `mouseup` bound to `document`) were anonymous and never removed. Disabling the feature left them attached to the document, holding references to the `_mini` element across hot-reload cycles. Handlers are now stored on the instance and removed in `destroy()`.
- **`SearchHistory` outside-click and submit handlers** leaked the same way. Both are now stored + cleaned up.
- **`AutoMaxQuality`** now tracks every `hls.js` instance it attaches a `hlsManifestParsed` listener to and calls `hls.off()` in `destroy()` — no more stranded listeners on the player across disable/re-enable.

**Performance**
- **Popup writes debounced (120 ms).** Rapid toggles in the popup previously triggered an independent `storage.set` + onChanged broadcast per click; coalesces bursts, with a `pagehide` flush of the latest state so no toggle is lost when the popup closes.
- **Deep-scan embed fetch parallelised** (see above).

**UX polish**
- **`siteTheme` is now a real dropdown in the options editor.** It's a string with only three valid values (`system` / `dark` / `light`); rendering it as a free-text input invited typos that silently fell back to the default. New `ENUM_CHOICES` registry + `renderEnumControl`; the `theme` setting also gets a proper dropdown with human-readable labels.

### Files changed
- [extension/content.js](RumbleX/extension/content.js) — `rxClearLocalStorage`, centralized key list, enhanced message handler, `_setBodyText`, DOM-built `_makeRow` / `_showFormatPicker` / `_startDirectDownload`, TreeWalker `_highlightMentions`, `_hlsInstances` tracking in `AutoMaxQuality`, `_dragMousemove/_dragMouseup/_dragMousedown` tracking in `MiniPlayer`, `_outsideClickHandler/_formSubmitHandler/_boundForm` tracking in `SearchHistory`, standalone `_showDownloadOverlay` / `_closeDownloadOverlay`, `_fetchAllEmbeds` parallel + primed-json.
- [extension/background.js](RumbleX/extension/background.js) — new `clearLocalData` broadcast.
- [extension/pages/options.js](RumbleX/extension/pages/options.js) — `resetSettings` broadcasts to tabs, `ENUM_CHOICES` + `renderEnumControl`, `inferControlKind(key)`-aware dispatch.
- [extension/pages/popup.js](RumbleX/extension/pages/popup.js) — debounced `saveSettings` with `pagehide` flush.
- Both manifests — v1.9.2.

### Also in v1.9.2 (deeper audit follow-up)
- **`Settings._applyExternal` preserves in-flight local writes.** A new `_pendingKeys` set tracks keys the user has changed but hasn't flushed; when a cross-tab/options change arrives inside the 120 ms debounce window, the external value is merged UNDER the pending keys so the user's in-flight toggle isn't silently discarded. On reset, pending keys are cleared (explicit user intent wins).
- **`AutoLike` / `AutoExpand` cancel delayed actions on destroy.** Both used `waitFor(...).then(() => setTimeout(...))` patterns that would fire AFTER the feature was disabled if the user toggled inside the waitFor window — resulting in AutoLike auto-liking against a page where it was explicitly turned off. Added generation-counter invalidation (`AutoLike`) and tracked timer cancellation (`AutoExpand`). Pattern documented as a maintenance item for other `waitFor` callers.

## [1.9.1] - 2026-04-22

### Added — RUD (Rumble Universal Downloader) integration
Integrated into the existing `VideoDownloader` as a progressive deep scan that runs automatically after the fast embed-API rows render. No new feature toggle, no parallel UI — the existing download panel gains the capability.

**What it does**
- Fetches every known `embedJS` endpoint (`u0`…`u4`, plus the authoritative `u3/?ver=2` form) and harvests media URLs from each.
- Scans the live DOM (script tags, `[src]`/`[href]` attrs, `<video>`/`<source>`) for any direct media URLs the API didn't include.
- Derives `{pathPart, baseId, token, isLive}` from any direct URL found.
- Generates candidate URLs at `hugh.cdn.rumble.cloud` for every quality token × (mp4, tar) × (live, vod) × (lowercase, capitalized) variant — typically 40–60 candidates per video.
- Probes each with `HEAD` (Range GET fallback) under 6-way concurrency with a 12 s timeout composed against a scan-wide `AbortController`.
- Surfaces verified results as new rows grouped by type badge (MP4 / TAR) with accurate sizes parsed from `content-range` or `content-length`.
- Live replay? A contextual "extract with 7-Zip, drop the `.m3u8` into VLC" note appears whenever TAR rows land.

**UX polish**
- Inline progress bar at the top of the download panel: `Deep scan · 12 / 47` with a slim progress strip. Fades to a green confirmation once complete, then auto-dismisses.
- Copy-link button on every row (visible on hover) — confirms with a green check for 1.5 s.
- `_scanController` + `_scanSeq` ensure late-resolving probes can't bleed into a newer scan's DOM.
- Every existing row flow (format picker for HLS, direct-MP4 download, per-quality file extension) is preserved. TAR results inherit `.tar` filenames automatically.
- `destroy()` aborts in-flight scans — no CDN pings after the feature is disabled or the page unloads.

**Permissions**
- `manifest.json` and `manifest-firefox.json` gained `*://*.rumble.cloud/*` host permission (the CDN the userscript probes).
- `background.js` `ALLOWED_DOWNLOAD_HOSTS` gained `rumble.cloud` so the chrome.downloads flow accepts probe-discovered URLs.

**Deliberately *not* ported** from the userscript's RUD:
- **`fetch`/`XHR` interception in the page realm.** Content scripts live in an isolated world; faithful interception needs a secondary `world: "MAIN"` content script + `postMessage` bridge. The combined DOM scan + multi-embedJS harvest + candidate generation covers the same URLs in practice without that plumbing.
- **Size-based filtering (< 50 MB).** HEAD probes already reject non-2xx responses; short videos are legitimately small and shouldn't be hidden.
- **Visual theme toggle inside the panel.** We use the extension's existing theme engine instead.

### Files changed
- [extension/content.js](RumbleX/extension/content.js) — VideoDownloader gained ~320 LOC of RUD helpers + progressive `_loadQualities` + copy-link + TAR handling. `destroy()` now aborts scans.
- [extension/background.js](RumbleX/extension/background.js) — allowlist extended.
- [extension/manifest.json](RumbleX/extension/manifest.json), [manifest-firefox.json](RumbleX/extension/manifest-firefox.json) — host permission + v1.9.1.

## [1.9.0] - 2026-04-22

### Added — Rumble Enhancement Suite port (58 features)
Ported features from *Rumble Enhancement Suite* v11.0 (by Matthew Parker). The downloader component is **deferred** to a future release.

**Interactive modules (8)**
- **Auto-hide Header** — fades the header out, reveals on top-edge cursor.
- **Auto-hide Nav Sidebar** — hides nav, reveals on left-edge hover (30-px trigger strip).
- **Auto Like** — one-shot auto-click of the like button on watch pages.
- **Auto Load Comments** — scroll-triggered "Show more comments" clicks.
- **Full-Width Player** — maximizes player width; on live streams, switches to a side-by-side chat layout with responsive stacking ≤1100 px.
- **Adaptive Live Layout** — expands main content whenever chat is visible on live streams.
- **Comment Blocking** — parallel to existing chat user-block; adds a Block button to each comment and persists a `blockedCommenters` list.
- **Site Theme Sync** — mirrors Rumble's native system/dark/light setting.

**CSS hide-X toggles (50)** — each shipped opt-in so the upgrade doesn't silently change users' feeds. Driven by a new `RX_CSS_TOGGLES` registry + `makeCssToggleFeature()` factory so each toggle is still a proper feature module with its own setting key, hot-reload support, and panel card.

| Group | Count | Toggles |
|---|---|---|
| Main Page Layout | 25 | widenSearchBar, hideUploadIcon, hideHeaderAd, hideProfileBacksplash, hideFeaturedBanner, hideEditorPicks, hideTopLiveCategories, hidePremiumRow, hideHomepageAd, hideForYouRow, hideGamingRow, hideFinanceRow, hideLiveRow, hideFeaturedPlaylistsRow, hideSportsRow, hideViralRow, hidePodcastsRow, hideLeaderboardRow, hideVlogsRow, hideNewsRow, hideScienceRow, hideMusicRow, hideEntertainmentRow, hideCookingRow, hideFooter |
| Video Page Layout | 5 | hideRelatedOnLive, hideRelatedSidebar, widenContent, hideVideoDescription, hidePausedVideoAds |
| Player Controls | 9 | hideRewindButton, hideFastForwardButton, hideCCButton, hideAutoplayButton, hideTheaterButton, hidePipButton, hideFullscreenButton, hidePlayerRumbleLogo, hidePlayerGradient |
| Video Buttons | 8 | hideLikeDislikeButton, hideShareButton, hideRepostButton, hideEmbedButton, hideSaveButton, hideCommentButton, hideReportButton, hidePremiumJoinButtons |
| Comments | 2 | moveReplyButton, hideCommentReportLink |
| Chat | 1 | cleanLiveChat |

**Enhancements**
- `autoMaxQuality` now tries **hls.js direct manipulation** (`hls.nextLevel = levels.length - 1` on the player's `<video>` element) before falling back to the overlay-clicking approach — significantly more reliable than DOM poking alone.

**Settings / UX**
- 60 new setting keys (`126` total, up from `66`). Catalog parity enforced across `content.js _defaults`, `options.js DEFAULTS`, `options.js META`, and `popup.js DEFAULTS` — 126 = 126 = 126 = 126.
- 5 new in-page modal categories: **Navigation & Chrome**, **Main Page Rows**, **Video Page Layout**, **Player Controls**, **Video Buttons**.
- 5 new options-page groups matching the above + **Layout**.
- 6 new popup categories to surface the ported toggles in the quick-toggle list (grouped + collapsible).
- New `blockedCommenters` list-editor in the in-page settings modal.

**Skipped (duplicates of existing RumbleX features)**
- `logoLinksToSubscriptions` (→ `logoToFeed`)
- `hidePremiumVideos` (→ `hidePremium`)
- `liveChatBlocking` (→ `chatUserBlock`)
- `autoBestQuality` (→ enhanced `autoMaxQuality`, see above)

### Deferred
- **RUD (Rumble Universal Downloader) integration** — the userscript's downloader (~700 LOC) probes CDN token variants, intercepts fetch/XHR, tries multiple `embedJS` URLs, and generates candidate CDN URLs. Porting it would replace the existing `VideoDownloader` UI and require adding `*://*.rumble.cloud/*` to `host_permissions`. Tracked for a future release.

## [1.8.0] - 2026-04-22

### Added — Full options page (Astra-Deck style)
- **New standalone options page** at [pages/options.html](extension/pages/options.html) — matches the Astra-Deck settings pattern: app bar with version chip, workspace command hero, 5-card stats overview (Enabled / Storage / Channels / Keywords / Chatters), storage summary line, and Export / Import / Reset actions.
- **Settings editor modal** launched from the workspace CTA: compact header with live chips (total / unsaved / needs-attention), search + Restore Defaults / Discard / Save toolbar, sidebar group nav (All + 8 groups), workspace banner that tracks dirty state, and an empty state for filtered views.
- **Dirty-draft workflow** — changes land in an in-memory draft, Save button is gated on no-invalid + at-least-one-dirty, Discard reverts, confirm dialog on close-with-unsaved.
- **Per-control editors** — toggle, number, text, textarea, list, and JSON inputs inferred from the stored value's type. Each card has a per-field Reset button and a hint line showing stored vs default vs draft values.
- **Focus trap + ESC handling + `beforeunload` guard** in the modal; `prefers-reduced-motion` and `forced-colors` supported.
- **Live re-sync** — observes `chrome.storage.onChanged`, re-renders stats on any external write, and warns if the stored value changed under a dirty draft.
- **Popup gear button** now opens the options page via `chrome.runtime.openOptionsPage()`. Shift-click still opens the in-page Ctrl+Shift+X modal on the active tab (retained for quick toggles while watching).
- **Both manifests** (`manifest.json` MV3 and `manifest-firefox.json` MV2) gained an `options_ui` entry with `open_in_tab: true`.
- Settings catalog parity enforced: 66 keys match across `content.js Settings._defaults`, `options.js DEFAULTS`, and `options.js META` — zero drift.

### Added (19 new feature modules)
Competitive parity pass — implemented every feature found in every other Rumble userscript/extension, plus five that don't exist anywhere else.

**Headline (Rumble-firsts):**
- **Chapters** — parses timestamp lists in the description, renders tick marks on the seek bar with hover tooltips, and a clickable chapter list above the description
- **SponsorBlock** — per-video local segments with auto-skip, marker overlay on the progress bar, 5 categories (sponsor / intro / outro / selfpromo / interaction), JSON import + export
- **Video Clips** — mark In/Out on the player, slice HLS segments, and export a standalone MP4 (reuses the mux.js Web Worker)
- **Live DVR** — save the last 30 s / 1 m / 5 m / 10 m of a live stream as MP4 (nearest competitor: none)
- **Transcripts** — clickable, searchable transcript panel synced to the player (backed by the Subtitle Sidecar)

**Chat & Comments parity:**
- **Unique Chatters** — live counter of distinct usernames + total messages above chat
- **User Block** — per-user hide-in-chat with inline "block" button on every message
- **Spam Dedup** — suppresses recently-repeated identical messages (30-message rolling window)
- **Chat Export** — TXT (click) or JSON (shift-click) export, including rant amounts
- **Rant Persist** — keeps rants visible past their expiry animation, auto-caches per video in localStorage, export to JSON
- **Popout Chat** — opens chat in a separate 420×720 window
- **Comment Sort** — reorder comments by Top / New / Oldest / Controversial

**Downloads:**
- **Audio Only** — extract audio-only `.m4a` from HLS
- **Batch Download** — multi-select thumbnails across feed / channel / search pages, bulk MP4 download
- **Subtitle Sidecar** — load local SRT/VTT and overlay captions on the player

**Feed & Layout:**
- **Keyword Filter** — hide videos whose titles contain any blocked keyword (settings chip list, Enter to add)
- **Full Titles** — removes `-webkit-line-clamp` truncation on every thumbnail
- **Title Font** — unbolds + normalizes title typography
- **Autoplay Queue** — FAB-pinned queue of Rumble URLs, auto-advances on `ended` event

### Settings
- Settings modal now has **8 categorized sections** (up from 7)
- New chip-list editors for **Blocked Keywords** (in Feed Controls) and **Blocked Chatters** (in Comments & Chat)
- `Settings._defaults` grew by 19 toggles + 4 list/object keys (`blockedChatters`, `blockedKeywords`, `sponsorSegments`, `autoplayQueue`)
- Popup exposes 19 new toggles in the quick-toggle list

### Architecture notes
- All 19 new modules follow the existing `init()`/`destroy()` hot-reload pattern
- `VideoClips`, `LiveDVR`, `AudioOnly` reuse `VideoDownloader._parseMasterPlaylist` / `_parseSegmentPlaylist` / `_transmuxWithWorker` (no new dependencies)
- `Transcripts` bridges to `SubtitleSidecar` via `_loadExternalCues()` — upload a VTT/SRT once, get both captions and transcript
- `BatchDownload` scrapes per-video MP4 URLs by fetching the watch HTML and regex-extracting the direct `mp4` URL from embed JSON
- Feature count: **54 modules** (35 → 54)

## [0.6.0] - 2026-04-23

### Added
- **SPA Router** — detects client-side navigation via pushState/popState; features can subscribe with `Router.on()`
- **getActiveVideo()** — shared helper to locate the active `<video>` element
- **Exact Counts** — replaces abbreviated view counts (1.2K, 3.5M) with full numbers on feed cards
- **Autoplay Block** — hides the upcoming-video overlay and prevents auto-play of the next video
- **Share Tools** — injects a clock button next to the share button to copy a timestamped link; strips tracking params from the URL on load
- **Keyboard Nav** — J/K/L seek ±10s, arrow keys seek ±5s / adjust volume, F fullscreen, M mute, 0–9 seek to percentage, with OSD feedback
- **Speed Control** — floating pill on the player to cycle playback speed (0.5×–3×); speed persisted across sessions

### Fixed
- **Channel Blocker** — rewrote selector logic to use `a[rel="author"].channel__link` href slug extraction instead of text matching; correctly targets `.videostream` containers

## [0.5.0] - 2026-04-22

### Fixed
- Live page layout: correct `section.chat.relative` dimensions (345px width, 15px margin-left, 900px height)
- Live page layout: globally hide `.media-page-chat-container-toggle-btn`
- Live page headings: set `h1.h1` font-size to 16px
- Video player: apply `margin-top: -35px` globally on live pages

### Added
- Channel Blocking: hide all feed videos from specific channels. Add channels via the Settings panel's new "Blocked Channels" section. Persisted across sessions.

### Fixed
- Internal VERSION constant now matches @version header (was 0.3.0, header was 0.4.0)

## [0.4.0] - 2026-03-01

- Added: Ad Nuker, Theater Split, Feed Cleanup, Category Filter, Dark Theme Enhancement, Video Downloader, Settings Panel
