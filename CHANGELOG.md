# Changelog

All notable changes to RumbleX will be documented in this file.

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
