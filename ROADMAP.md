# RumbleX Roadmap

Research date: 2026-05-19

## Project Overview

Project name: RumbleX.

Versioning convention: `RumbleX vMAJOR.MINOR.PATCH`. The repo is currently at v1.9.3, so the next implementation line should start at v2.0.0 rather than resetting the shipped product to v0.0.1.

One-line pitch: RumbleX is the full-stack Rumble power-user suite: premium dark UI, feed control, live-chat tools, downloads, archives, creator helpers, privacy controls, and reversible per-feature modules for both extension and userscript delivery.

Target site: `https://rumble.com/*`, with related media hosts `https://*.rumble.cloud/*`, `https://1a-1791.com/*`, and current Rumble CDN/embed hosts.

Chosen vehicle: both a Chrome MV3 extension and a single-file userscript.

- MV3 extension is primary because downloads, background queues, declarative request blocking, store distribution, cross-tab storage, Chrome downloads API, update checking, and optional companion integrations need extension privileges.
- Userscript remains first-class because portability matters, many competitors live on GreasyFork, and a single-file script is the fastest path for users on Brave, Firefox-like browsers, and managed systems where extension install is blocked.
- Firefox support should move toward MV3 while preserving the existing MV2 manifest until the compatibility plan is verified.

House style baked into every phase:

- RumbleX-owned UI is always dark: OLED black, deep charcoal, Rumble-green accent, dense mode, glass-style translucency via borders/shadows/alpha layers, shimmer loading states, hover lifts, spring easing, and staggered entrances.
- Do not ship a light theme for RumbleX UI.
- Do not use CSS `backdrop-filter` in content-script overlays; create the glass look with translucent fills, inner borders, shadows, and native Rumble custom properties.
- Settings are grouped by category, persisted, and apply immediately with toast feedback. No confirmation dialogs.
- Every feature exposes `init(ctx)` and `destroy(ctx)` and must fully reverse DOM, CSS, observer, storage listener, timer, and event-handler changes on disable.
- Inactive overlays use `pointer-events: none`; active panels enable pointer events only for their own surface.
- CSS is scoped to `body.rx-enabled` plus per-feature body classes and CSS custom properties.
- HTML injection uses DOM builders. If a TrustedTypes-enforcing host is ever added, all injection routes through `trustedTypes.createPolicy()`.
- Never add keyboard shortcuts. Existing keyboard modules should be disabled by default, moved behind a legacy compatibility toggle, or replaced with visible controls.
- Selectors prefer `data-*`, `aria-*`, `role`, IDs, and structure over raw hashed or obfuscated classes.
- Plan for a GitHub `README.md` refresh as a build deliverable in a later implementation run, not in this research-only run.

## Phase 0: Local Repo Ingest

### Full Repo Tree

```text
RumbleX/
  .github/
    workflows/
      build.yml
  .gitignore
  AGENTS.md
  analyze_pages.py
  CHANGELOG.md
  CLAUDE.md
  dist/
    RumbleX-v1.7.0.crx
    RumbleX-v1.7.0.zip
    RumbleX-v1.9.3.crx
    rumblex.pem
  extension/
    background.js
    build.sh
    content.js
    icons/
      128.png
      16.png
      32.png
      48.png
      icon-128x128.png
      icon-16x16.png
      icon-32x32.png
      icon-48x48.png
    lib/
      mux.min.js
    manifest-firefox.json
    manifest.json
    pages/
      options.html
      options.js
      popup.html
      popup.js
    worker.js
  icon.png
  LICENSE
  README.md
  ROADMAP.md
  Rumble Enhancement Suite.user.js
  RumbleX.user.js
  RumbleX-chrome.zip
  RumbleX-firefox.zip
  RumbleX-v1.9.3.crx
  rumble_decoded.html
  Sample Pages/
    For You.mhtml
    Live.mhtml
    My Feed.mhtml
    VOD-Watch Page.mhtml
```

### Current Repo State

- Git state at ingest: clean `main` tracking `origin/main`.
- Recent head: `26a3313 Sync ROADMAP, branding cleanup, README polish`.
- Current shipped version surfaces: README, manifests, and content script point to v1.9.3.
- Extension architecture already exists and is substantial:
  - `extension/content.js` is the main feature registry and content runtime.
  - `extension/background.js` handles background extension services.
  - `extension/worker.js` and `extension/lib/mux.min.js` support media/download flows.
  - `extension/pages/options.*` and `popup.*` are the current extension UI.
  - `RumbleX.user.js` is present but lags the extension at v1.8.0.
  - Local reference `Rumble Enhancement Suite.user.js` has already been partially ported.
- Current extension settings use `chrome.storage.local` under `rx_settings`; per-site local state uses Rumble origin `localStorage` keys such as `rx_volume`, `rx_watch_progress`, `rx_watch_history`, `rx_search_history`, `rx_bookmarks`, and `rx_rants_*`.
- Existing defaults expose about 126 feature modules across 13 categories. The defaults include core modules like ad removal, feed cleanup, dark enhancement, theater split, downloads, speed/volume/quality controls, progress/history/bookmarks, chat tools, comments tools, rant tools, transcript/subtitle/download helpers, and many opt-in CSS hide-X toggles.
- Current gaps:
  - The userscript is behind the extension and should be generated from a shared core.
  - Feature hot reload is mixed. Some settings prompt for page reload instead of full per-feature destroy/re-init.
  - Legacy keyboard features conflict with the new house rule.
  - Download features need newer DASH/fMP4/live handling and real audio extraction.
  - MHTML captures show htmx-heavy Rumble DOM that needs a formal selector registry, not scattered selectors.
  - Store/distribution docs should stop relying on direct CRX drag-install as the primary install path.
  - Existing roadmap was not exhaustive enough to beat every known competitor.

### Existing Feature Baseline

Already built in some form:

- UI/theme: `darkEnhance`, `theme`, `siteThemeSync`, `siteTheme`, title font, full titles, wide layout, split ratio, full-width player, adaptive live layout.
- Feed and discovery: feed cleanup, hide reposts, hide premium, category filter, shorts filter, related filter, search history, quick save, hide-X homepage rows.
- Media: video download, Rumble URL downloader support, auto max quality, speed controller, scroll volume, screenshot, loop control, chapters, sponsor segments, clips, LiveDVR, subtitle sidecar, transcripts, audio-only placeholder, batch download placeholder.
- Watch state: watch progress, watch history, bookmarks, exact counts, share timestamp.
- Chat/live: live chat enhance, chat auto-scroll, unique chatters, user block, spam dedup, chat export, rant highlight, rant persist, popout chat.
- Comments: comment navigation, comment sort, comment blocking, auto-load comments, move reply button, hide report link.
- Layout/css toggles: hide upload icon, header ad, profile backsplash, featured/banner rows, premium row, ads, specific category rows, footer, related sidebars, description, paused video ads, player controls, video buttons, comment controls, and clean live chat.

Missing or weak:

- Full userscript parity.
- Robust channel archive and scheduled download queue.
- Live stream recording with format detection and safe resume.
- Real audio extraction to `m4a/mp3` rather than low-bitrate MP4 naming.
- Rant analytics comparable to RantStats.
- Creator/Rumble Studio tools beyond local scene mover ideas.
- RSS/webhook/notifier integrations.
- Thumbnail hider mode.
- Bulk subscription cleanup with dry-run/undo.
- User-requested short removal everywhere.
- Pagination compaction on account/content pages.
- Self-healing selector registry and MHTML regression snapshots.
- Remote cosmetic rules with review-safe, signed, opt-in updates.

## MHTML Ground Truth

Parsed captures:

- `Sample Pages/For You.mhtml`, source URL `https://rumble.com/for-you`.
- `Sample Pages/My Feed.mhtml`, source URL `https://rumble.com/subscriptions`.
- `Sample Pages/VOD-Watch Page.mhtml`, source URL `https://rumble.com/v78ty3o-04-21-2026-run-in.html?e9s=src_v1_mfp`.
- `Sample Pages/Live.mhtml`, source URL `https://rumble.com/v78tx1o-tako-tuesday-is-back-.html?e9s=src_v1_live`.

The captures decode to large htmx-oriented HTML plus Rumble core CSS. They are the current DOM ground truth for this roadmap.

### Framework and Runtime Signals

- Rumble pages show htmx attributes (`hx-get`, `hx-post`, `hx-target`, `hx-ext`) rather than React/Vue DOM signatures.
- Stable Rumble hooks include `data-js`, IDs, role-like list structures, `hx-*` endpoint attributes, and semantic links.
- Utility CSS suggests Tailwind/UnoCSS-generated class usage. Avoid coupling to generated utility ordering.
- Captured pages did not expose GraphQL query IDs.
- Captured pages did not include CSP or TrustedTypes meta tags.
- Captured static CSS reference: `https://static.rumble.com/rum-ui/r/ui/css/core.v9-260416_02-10-615.min.css`.
- Inline/embed URLs reference Rumble embed and htmx endpoints. Existing code also uses `embedJS/u3` plus `u0` through `u4` probing.

### Selector Map

Prefer the stable selector in implementation. Use the fragile selector only as fallback telemetry and quick repair evidence.

| Surface | Stable selector | Fragile fallback | Notes |
|---|---|---|---|
| App header | `header[data-js="app_header"]` | `.header` | Attach early theme/layout classes here only after `document.body` exists. |
| Main menu/nav | `#main-menu`, `[data-js="highlightable_navigation_item"]` | `.hover-menu.main-menu-nav`, `.main-menu-item.main-menu-item__nav` | High churn because permanent/sidebar nav modes alter structure. |
| Search form | `form[data-js="search_form"]`, `[data-js="search_input"]` | `.header-search`, `.header-search-field.hidden.md\:block` | Autocomplete uses htmx POST. |
| Search autocomplete | `[hx-post="/search/htmx/get-autocomplete-results"]`, `[data-js="autocomplete_results_container"]` | `.autocomplete-results` if present | Needs route-change and htmx swap handling. |
| Feed cards | `[role="listitem"][data-video-id]`, `.playlist-menu[data-video-id]`, `a[href*="/v"]` inside card | `.videostream.thumbnail__grid--item`, `.thumbnail__title.line-clamp-2` | Process added cards only. |
| Feed author | `a[rel="author"].channel__link` | `.channel__link.link.*` | Do not use hashed suffixes. |
| Feed sections | `section[id^="section-"]`, heading text under `.homepage-heading__title` | `#section-editor-picks`, `#section-live-videos` | Captures did not consistently expose all section IDs; make this registry self-healing. |
| Player | `video`, `#videoPlayer`, `.videoPlayer-Rumble-cls` | `#videoPlayer.video-player`, `.videoPlayer-Rumble-cls` | Rumble player SVG buttons share classes; identify controls by title/aria/structure. |
| Watch media container | `[data-js="media_container"]` | `.media-page`, `.media-page-video` | Root for watch-page feature scoping. |
| Watch title | `.video-header-container__title` | hashed title descendants | Existing selector is still useful but should be wrapped in selector registry. |
| Watch action buttons | `[data-js="media_engage_share"]`, `[data-js="video_action_button_visible_location"]` | `.round-button.media-by-actions-button` | Use action `data-js` and title text, not nth button. |
| Description | `[data-js="media_description_section"]`, `.media-description-section`, `[data-js="media_long_description_container"]` | `.container.content.media-description` | Needed for auto-expand, hide description, transcripts, metadata panels. |
| Related sidebar | `.media-page-related-media-desktop-sidebar` | `.mediaList-item`, `.mediaList-heading` | VOD and live differ; floating related media appears on live. |
| Comments container | `[data-js="media_page_comments_container"]`, `#video-comments` | `.media-page-comments-container` | Observe only this subtree once found. |
| Comment item | `li.comment-item[data-comment-id]`, `.comment-text` | `.comment-item.comment-item-first` | Comment IDs are stable for block/export/sort. |
| Comment composer | `[data-js*="comment"] textarea`, `.comments-create-textarea` | `.comments-create-textarea` | Needs logged-in and logged-out states. |
| Live chat root | `aside.media-page-chat-aside-chat`, `#chat-history-list` | `.chat--header`, `.chat--input` | Observe `#chat-history-list` added nodes only. |
| Chat message | `#chat-history-list [data-*]` when available, fallback `.chat-history--row` | `.chat-history--username`, `.chat-history--message` | Username classes are fragile but still present in scripts. |
| Rants | `.chat-history--rant[data-level]`, `.chat-history--rant-price`, `.chat-history--rant-username` | `.chat-history--rant`, `.js-chat-username.chat-history--rant-username` | Capture rants with read/unread and tier state. |
| Modals/portal | `#portal[data-js="portal"]`, `template[data-js="modal__template"]`, `[data-js="modal__overlay"]`, `[hx-ext="modal"]` | `.group.box-border-inherit.fixed`, `.btn-grey.btn.btn-medium` | Rumble modals are htmx-driven. |
| Theme/settings surface | `.theme-option-group`, `[class*="theme-option"]` | `.space-y-2.theme-option-group` | Used by site theme sync only. |
| Notifications | `[class*="notification"]`, `[title*="Notification" i]` | `.user-notifications--bell-button.js-notification-button` | Needs live logged-in capture. |
| Channel/profile links | `a[rel="author"].channel__link`, `.main-menu-item-channel`, `[href^="https://rumble.com/c/"]`, `[href^="https://rumble.com/user/"]` | `.channel__link.link.*` | Use for channel filters, archive queues, and creator tools. |
| Rumble Studio | URL and form structure under `studio.rumble.com` or uploader pages | GreasyFork scene mover structural selectors | No local MHTML capture yet; must be live-checked before implementation. |
| Account content pagination | `.pagination.autoPg` on `/account/content*` | jQuery-style `.pagination.autoPg` from community userscript | Needs live capture. |

### CSS Custom Properties and Native Tokens

Theme code should hook these tokens before adding raw colors:

- Core surfaces: `--color-bg-main`, `--color-bg-default`, `--color-bg-default-0`, `--color-bg-featured`, `--color-bg-featured-0`, `--background`, `--background-color`, `--background-highlight`.
- Text and borders: `--color-txt-default`, `--color-separator`, `--color-separator-highlight`, `--title-color`, `--heading-color`, `--text-color`, `--inverse-text-1`, `--border-color`.
- Brand/accent: `--primary`, `--primary-variant`, `--secondary`, `--secondary-variant`, `--on-secondary`, `--link-green`, `--link-color`, `--small-link-color`, `--brand-800`, `--brand-900`, `--brand-950`.
- Header/nav: `--header-height`, `--header-logo-width`, `--menu-icon-color`, `--menu-border-color`, `--max-content-width`.
- Inputs: `--input-font-color`, `--input-border-color`, `--input-placeholder-color`.
- Channel surfaces: `--channel-border`, `--channel-border-light`, `--channel-border-dark`.
- Shorts: `--rum-shorts-*`.
- Rants/chat: `--num-unread-messages`, `--send-rant`, `--send`, `--rant-01` through `--rant-07`, `--rant-price`, `--rant-overlay`.
- Utility-generated variables: `--tw-*` and `--un-*` exist and should not be treated as stable semantic API unless no native token exists.

### Site APIs and htmx Endpoints

Observed or already used endpoints:

- `https://rumble.com/embedJS/u3/?request=video&ver=2&v={embedId}` and generated `u0` through `u4` embedJS probes.
- `https://hugh.cdn.rumble.cloud/...` and `https://1a-1791.com/...` media hosts.
- `hx-post="/search/htmx/get-autocomplete-results"`.
- `hx-get="/-htmx/web-services/report-content"`.
- `hx-get="/-premium/htmx/premium-value-prop"`.
- `hx-get="/-register/htmx/header-user-actions"`.
- `hx-get="/-locals/htmx/connect_account"`.
- `hx-get="/-htmx/reposts/add-modal"`.
- `hx-post="/-htmx/web-services/repost-vote"`.
- `hx-get="/-htmx/web-services/repost-share"`.
- `hx-get="/-htmx/channel/update-action-buttons"`.
- `hx-get="/-htmx/wallet/payment/qr-modal"`.
- `hx-post="/-htmx/account/legacy-video-collection"`.

API plan:

- Create a single `RumbleApiClient` with token-bucket rate limiting, request dedupe, timeout, retry with jitter, and persistent response cache keyed by video ID, channel ID, and endpoint version.
- Limit embedJS metadata probes to low concurrency. Use cached metadata for repeated feed/channel scans.
- Treat htmx endpoints as UI-adjacent and authenticated where applicable; do not automate sensitive account actions without a visible toggle, dry-run preview where appropriate, and undo-capable toast flow.
- Never collect analytics. Debug logs remain local and user-exported.

## Competitive Landscape

Rank is based on observed install/user/star count, recency, and feature relevance. Counts are point-in-time and should be rechecked before store copy is written.

| Rank | Tool | Source | Author | Installs/users/stars | Last updated | Feature count | Best feature to beat |
|---:|---|---|---|---:|---|---:|---|
| 1 | RumbleX current | Local repo | SysAdminDoc | local | v1.9.3 | 126 | Broadest existing union: media, feed, chat, layout, downloads, and settings. |
| 2 | Play-With-MPV | [GreasyFork](https://greasyfork.org/en/scripts/by-site/rumble.com?filter_locale=0) | LuckyPuppy514 | 27,207 installs | 2024-05-02 | 2 | External player handoff to mpv, PotPlayer, or custom players. |
| 3 | Rumble Downloader, removed store listing | [Chrome-Stats mirror](https://chrome-stats.com/d/gekicmahphebohlffaoacfmhabofheaa) | rumbledownloader | 2,000 users before removal | 2024-04-01 | 2 | One-click button under videos, simple no-login flow. |
| 4 | Rumble Tools | [Chrome Web Store](https://chromewebstore.google.com/detail/rumble-tools/ijeobnpiandoonpbgmmlcabnopmjbcgj?hl=en-US) | Hickory Projects | 471 to 924 observed via store mirrors | 2023-07-26 | 3 | Autoplay toggle plus MP4 download plus options visibility. |
| 5 | Rumble video accelerator | [Chrome Web Store](https://chromewebstore.google.com/detail/rumble-video-accelerator/afedcnlnaijfabfnibpldpdkilbghgng) | willemallan.com.br | 689 users, 3 ratings | 2024-06-22 | 1 | Persistent speed pattern for all Rumble videos. |
| 6 | Rumble download media | [Firefox AMO](https://addons.mozilla.org/en-GB/firefox/addon/rumble-download-media/) | Vikingus | 526 users, 34 reviews | AMO page observed 2022-05-29; search snippet exposed newer metadata | 2 | Lists available MP4/WEBM qualities in a separate window. |
| 7 | RantStats Extension | [Chrome Web Store](https://chromewebstore.google.com/detail/rantstats-extension-for-r/liahjgfmodjgeakahommamnmbjgicpmh), [GitHub](https://github.com/rantstats/rantstats-extension) | Steven Crader | about 191 to 213 users, 1 GitHub star | 2026-05-08 repo, 2026-04-15 store mirror | 12 | Persistent paid Rant capture, sidebar/popup, cached view, CSV export. |
| 8 | Rumble Video Downloader | [Chrome Web Store](https://chromewebstore.google.com/detail/rumble-video-downloader/ebicjhoognhcjloffhndkbkgfnlikljh) | rumble-video.download | 184 users | 2026-03-22 | 2 | Videos and Shorts download in a modern store package. |
| 9 | Rumble Resize | [AMO](https://addons.mozilla.org/en-US/firefox/addon/rumble-resize/), [Chrome mirror](https://extpose.com/ext/odnhigcapbjnjdgfbckmjbmkcejmkebm) | Michael Riley | 34 AMO users, 181 Chrome mirror installs | 2024-09-10 AMO, 2024-08-23 Chrome mirror | 1 | Theater mode fills the whole browser with or without chat. |
| 10 | ChatPlus for Rumble | [Chrome Web Store](https://chromewebstore.google.com/detail/chatplus-for-rumble/odlcomopigapcpmlpmmmhlhegajembio?hl=en-US) | wsright987 | about 130 users, 2 ratings | 2024-07-10 | 5 | Mentions, user tagging, participant list, color schemes, autoplay option. |
| 11 | Unsubscriby for Rumble | [Chrome Web Store](https://chromewebstore.google.com/detail/unsubscriby-for-rumble/ejhdfhhgoimmjciplfjgfnnopopdekif?hl=en-US) | limbuscode.com | 31 users, 1 rating | 2024-01-06 | 2 | Bulk unsubscribe automation with stop control. |
| 12 | Rumble Chat Muter | [Firefox AMO](https://addons.mozilla.org/en-US/firefox/addon/rumble-chat-muter/) | SweenyTod | no AMO users yet | 2026-05-06 | 5 | Click username to mute for timed or permanent durations; local storage. |
| 13 | Rumbie | [Chrome-Stats mirror](https://chrome-stats.com/d/pagcgjmengbldmbaeiaojngokedfljbd) | botted dot wtf | 73 users | 2025-11-10 | 6 | Clips, analytics, hide categories, remove political content, sidebar/home cleanup. |
| 14 | nullEFFORT/rumble-downloader | [GitHub](https://github.com/nullEFFORT/rumble-downloader) | nullEFFORT | 2 stars | 2026-05-18 | 18 | Scheduled channel downloader, clip filtering, audio mode, queue, Discord notifications. |
| 15 | RumblePy | [GitHub](https://github.com/a3r0id/RumblePy) | a3r0id | 10 stars | 2025-09-06 | 4 | Unofficial Rumble account automation module. Archived, but useful for creator API ideas. |
| 16 | porjo/rumblerss | [GitHub](https://github.com/porjo/rumblerss) | porjo | 8 stars | 2026-04-30 | 3 | Channel URL to RSS service with Docker deployment. |
| 17 | HamzaJarane/rumble-notifier | [GitHub](https://github.com/HamzaJarane/rumble-notifier) | HamzaJarane | 8 stars | 2025-12-01 | 3 | Discord webhook notifications for new videos and live starts. |
| 18 | xerk-dot/rumble-downloader | [GitHub](https://github.com/xerk-dot/rumble-downloader) | xerk-dot | 0 stars | 2026-05-17 | 5 | Audio download plus Whisper transcripts with synced web playback. |
| 19 | 3IMAD69/Rumble-Downloader | [GitHub](https://github.com/3IMAD69/Rumble-Downloader) | 3IMAD69 | 14 stars | 2026-01-27 | 1 | Web tool framing for fast free Rumble downloads. |
| 20 | yt-to-rumble-extension | [GitHub](https://github.com/t1m0thyj/yt-to-rumble-extension) | t1m0thyj | 2 stars | 2026-03-02 | 1 | Context menu fills Rumble uploader fields from a YouTube URL in clipboard. |
| 21 | Rumble Thumbnails Hider | [GitHub](https://github.com/danielh-official/rumble-thumbnails-hider) | danielh-official | 2 stars | 2026-03-28 | 1 | Hide video thumbnails across Rumble. |
| 22 | Rumble Automatic Video Uploader | [GitHub](https://github.com/FelixEdenborgh/Rumble-Automatic-video-uploader) | FelixEdenborgh | 4 stars | 2025-07-07 | 1 | Selenium folder-to-Rumble upload automation. |
| 23 | Rumble Live Chat Blocker | [GreasyFork](https://greasyfork.org/en/scripts/532873-rumble-live-chat-blocker/code) | CynicalPhantom | 39 installs | 2026-02-09 | 3 | Local chat user blocklist, menu, mutation-based hiding. |
| 24 | Rumble All-in-One Tools | [GreasyFork directory](https://greasyfork.org/en/scripts/by-site/rumble.com?filter_locale=0) | MrM0RG4N | 4 installs | 2026-03-19 | 5 | Fonts, live-chat blocklist, quick comment, scramble-readable messages, unified panel. |
| 25 | Rumble Auto Best Video Quality | [GreasyFork directory](https://greasyfork.org/en/scripts/by-site/rumble.com?filter_locale=0) | Martin______X | 122 installs | 2024-05-16 | 1 | Auto best quality selection. |
| 26 | Choose best resolution | [GreasyFork directory](https://greasyfork.org/en/scripts/by-site/rumble.com?filter_locale=0) | dev.qm7or | 260 installs | 2021-12-28 | 1 | Early quality-forcing script. |
| 27 | Rumble Download Button | [GreasyFork directory](https://greasyfork.org/en/scripts/by-site/rumble.com?filter_locale=0) | Zeek B. | 187 installs | 2024-02-11 | 1 | Adds a Rumble download button. |
| 28 | Title/font scripts | [GreasyFork directory](https://greasyfork.org/en/scripts/by-site/rumble.com?filter_locale=0) | Trilla_G, edisondotme | 154 combined installs | 2024-11-28 newest | 2 | Untruncate titles and adjust font weight/style. |
| 29 | Unique Chatters | [GreasyFork directory](https://greasyfork.org/en/scripts/by-site/rumble.com?filter_locale=0) | ojgaojgaojgao | 13 installs | 2024-10-01 | 2 | Unique chatter and message counts. |
| 30 | Studio Scene Mover | [GreasyFork directory](https://greasyfork.org/en/scripts/by-site/rumble.com?filter_locale=0) | J J W | 6 installs | 2024-10-07 | 1 | Reorders Rumble Studio scene and participant share controls. |
| 31 | Speed, volume, theater, lowest-quality scripts | [GreasyFork directory](https://greasyfork.org/en/scripts/by-site/rumble.com?filter_locale=0) | Dave121, ToTheFuture2021 | 54 combined installs | 2025-12-22 newest | 4 | Small, focused video control improvements. |
| 32 | Rumble Enhancement Suite | Local reference script | Matthew Parker | local | v11.0 reference | 58 | Hide-X controls and layout cleanup already partially ported. |
| 33 | OpenUserJS Rumble results | [OpenUserJS search](https://openuserjs.org/) | none found | 0 direct hits | 2026-05-19 search | 0 | Opportunity: publish RumbleX userscript where direct Rumble tools are absent. |
| 34 | Theming/userstyle landscape | GreasyFork CSS and userstyle searches | none dedicated found | minimal | 2026-05-19 search | 0 | Opportunity: own the premium Rumble theme category. |

Community signals:

- Users explicitly ask for Shorts removal and say they would pay for the ability to disable Shorts in [RumbleForum](https://www.reddit.com/r/RumbleForum/comments/1qwd9i2/any_extension_to_remove_the_shorts/).
- Autoplay complaints include uBlock filter workarounds against `embedJS` related endpoints in [RumbleForum](https://www.reddit.com/r/RumbleForum/comments/z5l2qd/rumblecom_stop_autoplay/).
- Download reliability complaints recur in [RumbleForum](https://www.reddit.com/r/RumbleForum/comments/1rbk9il/rumble_video_downloads_not_working_any_solutions/) and a recent Rumble download tool announcement targets videos, Shorts, and livestreams in [RumbleForum](https://www.reddit.com/r/RumbleForum/comments/1sorbgk/download_videos_shorts_even_livestreams_from/).
- Account/content pagination compaction exists as a community userscript in [r/userscripts](https://www.reddit.com/r/userscripts/comments/1psgn3b/rumble_shrink_the_pagination_area/).

## Feature Matrix

Legend: Current means already present in RumbleX extension, Partial means present but needs rebuild/hardening/parity, New means roadmap feature.

| Category | Feature | Current status | Competitors observed | Best implementation note | Roadmap action |
|---|---|---|---|---|---|
| Theming and UI | OLED premium dark theme | Partial | Dedicated Rumble theming not found | Empty competitor space | Build native-token theme engine and never ship light RumbleX UI. |
| Theming and UI | Dense mode | New | Community pagination compaction | Account pages need density controls | Add global dense mode plus per-surface density. |
| Theming and UI | Glass-style panel chrome | Partial | RumbleX local | Existing panels can be elevated | Rebuild panels with scoped alpha fills, borders, shimmer, spring motion. |
| Theming and UI | Full video titles | Current | Trilla_G, edisondotme, GreasyFork title scripts | Small scripts focus only on line clamps/font | Keep and make selector registry backed. |
| Theming and UI | Title font/weight control | Current | Youtube/Rumble Titles Fix | Font control exists but limited | Expand with readable title styles and channel-level overrides. |
| Theming and UI | Hide thumbnails | New | Rumble Thumbnails Hider | Accessibility/privacy users want thumbnail suppression | Add feed/watch/sidebar thumbnail hiding with per-surface toggles. |
| Theming and UI | Hide ads/promos/buttons | Current | NoAnnoying, Rumble Tools, RES reference | RumbleX already broad | Move into signed cosmetic rules and self-healing selectors. |
| Theming and UI | Full-browser theater | Partial | Rumble Resize | Works with/without chat and preserves page scroll | Merge with TheaterSplit and adaptive live layout. |
| Theming and UI | Sidebar/home cleanup | Partial | Rumbie, RES reference | Hide categories/sidebar/home politics/content | Add presets plus fine-grained toggles. |
| Theming and UI | Account pagination compaction | New | Reddit userscript | Simple `.pagination.autoPg` max-width tweak | Add account/content density module after live capture. |
| Content filtering | Shorts removal everywhere | Current partial | Reddit request, Rumbie, existing ShortsFilter | Users actively ask for it | Promote to first-class filter across feed/search/channel/related. |
| Content filtering | Channel blocklist | Current | Rumbie category/content cleanup | RumbleX has blocklist | Add expiry, reasons, import/export, and matched-card audit. |
| Content filtering | Keyword filter | Current | Rumbie, Rumble All-in-One | RumbleX has keywords | Add regex/literal modes, title/channel/comment scope, and preview counts. |
| Content filtering | Comment user block | Current | RumbleX, Rumble Chat Muter analogy | Current comments module exists | Add timed mutes and reason labels. |
| Content filtering | Live chat user mute | Current | Rumble Live Chat Blocker, Rumble Chat Muter | Timed/permanent local mutes are best | Replace prompts/alerts with inline menu and undo toast. |
| Content filtering | Chat spam dedup | Current | RumbleX local | No strong competitor | Add per-stream duplicate-rate dashboard. |
| Content filtering | Category/feed row filters | Current | Rumbie, RES reference | Hide rows by section | Move to selector registry, add custom section rules. |
| Content filtering | Political/content category removal | New | Rumbie | Category cleanup is a differentiator | Implement as opt-in filter presets with editable rules. |
| Content filtering | Remote cosmetic rules | New | uBlock-style community workaround | Needed for Rumble DOM churn | Add signed opt-in rules with visible diff and rollback toast. |
| Media | One-click MP4 download | Current partial | Rumble Tools, Rumble Download Button, Rumble Downloader, AMO downloader | Many tools do this alone | Keep but harden against modern formats and failures. |
| Media | Quality list for download | Partial | AMO Rumble download media | Separate window lists MP4/WEBM qualities | Add in-page quality picker with size/format/CDN provenance. |
| Media | Videos and Shorts download | Partial | Rumble Video Downloader | Explicit Shorts support | Verify Shorts selectors and metadata. |
| Media | Livestream download/record | Partial | Rumble Video Downloader announcement, community requests | Live download demand is recent | Build live HLS/fMP4 recorder with resume, segment index, and safe stop. |
| Media | DASH/fMP4 support | New | nullEFFORT, yt-dlp ecosystems | Backend downloaders handle more formats | Add parser and mux pipeline in worker/offscreen context where possible. |
| Media | Real audio extraction | New | nullEFFORT audio mode, xerk Whisper pipeline | Server tools use ffmpeg | Add optional ffmpeg.wasm or companion mode; label browser-only limits honestly. |
| Media | External player handoff | New | Play-With-MPV | MPV/PotPlayer/custom support is popular | Add custom protocol/export URL action, extension-first. |
| Media | Batch/channel archive | Partial | nullEFFORT scheduler, xerk, 3IMAD69 | Scheduled channel download is strongest gap | Add queue, channel scan, filters, resume, export manifest. |
| Media | Clip maker | Current partial | Rumbie clips, nullEFFORT timestamp clipping | Clip/analytics creator use case | Add local clip ranges with export and no cloud default. |
| Media | Screenshot | Current | Generic video tools | RumbleX already has it | Add filename templates and metadata sidecars. |
| Media | Subtitles and transcripts | Current partial | xerk transcription | Whisper timestamped transcript is stronger | Add optional local transcript import/export and synced transcript panel. |
| Media | Sponsor/segment skip | Current partial | SponsorBlock pattern | Rumble lacks mature segment DB | Keep local-first, optional signed community DB later. |
| Playback | Auto best quality | Current | Auto Best Video Quality, Choose best resolution | Small scripts loop quality menus | Replace loops with player API when available and robust fallbacks. |
| Playback | Force lowest quality | New | Auto Force Lowest Quality | Useful for bandwidth | Add low-bandwidth profile and schedule-aware quality. |
| Playback | Speed control | Current | Rumble video accelerator, speed scripts | Persistent pattern across videos | Keep visible control; no keyboard shortcuts. |
| Playback | Volume scroll with overlay | Current | GreasyFork volume overlay | Overlay is expected | Match premium toast/overlay style and destroy cleanly. |
| Playback | Autoplay block | Current | Rumble Tools, community uBlock filters | Users strongly complain | Harden with embedJS related endpoint blocking and player state hooks. |
| Playback | Auto theater | Current | Auto Theater userscript | Simple but useful | Merge with full-browser theater presets. |
| Playback | Scroll/max volume | Current | RumbleX local | Current feature exists | Add per-channel volume memory. |
| Live and chat | Unique chatter count | Current | GreasyFork Unique Chatters | Current exists | Add live per-minute stats and reset behavior. |
| Live and chat | Chat participants list | New | ChatPlus | Participant list is missing in RumbleX | Add local participant sidebar/filter. |
| Live and chat | Mention highlighting and click-to-tag | Partial | ChatPlus | Useful chat UX | Add visible mention buttons, no shortcuts. |
| Live and chat | Username color schemes | New | ChatPlus | Helps scanning | Add deterministic local color modes. |
| Live and chat | Rant persistence | Current partial | RantStats, bookmarklet | RantStats is best baseline | Add sidebar/popup/cache/export with totals and read state. |
| Live and chat | Rant CSV export | Partial | RantStats | CSV export is core | Add CSV/JSON export with stream metadata. |
| Live and chat | Rant tier filters and pins | New | RantStats foundation | No competitor combines filters/pinning deeply | Add tier filter, high-rant sticky rail, and read/unread state. |
| Live and chat | Popout chat | Current | RantStats popup/sidebar | RumbleX has popout chat | Make it resizable, persistent, and multi-stream aware. |
| Live and chat | Multi-stream viewer | New | No direct Rumble competitor found | Twitch/Kick-style power use | Add opt-in 2 to 4 stream grid with independent chat panels. |
| Live and chat | Chat export | Current | RantStats for rants | RumbleX chat export exists | Add format presets and stream session manifest. |
| Automation | Bulk unsubscribe | New | Unsubscriby | Automates subscriptions page | Add preview, stop, undo window, and local log; no confirm dialogs. |
| Automation | Scheduled channel check | New | nullEFFORT, rumble-notifier | Backend schedulers are stronger | Extension alarm-based monitor with user-visible scope. |
| Automation | Discord/webhook notifications | New | rumble-notifier, nullEFFORT | Strong creator/server use case | Add optional webhook integrations, disabled by default. |
| Automation | RSS feed generation | New | porjo/rumblerss | Channel URL to RSS | Add local OPML/RSS export or companion service handoff. |
| Automation | Creator upload metadata fill | New | yt-to-rumble-extension | Clipboard YouTube URL to Rumble uploader | Add creator mode after uploader capture. |
| Automation | Folder-to-upload workflow | New | FelixEdenborgh uploader | Selenium approach exists | Add only as documented companion idea, not browser automation default. |
| Automation | Rumble Studio scene mover | New | GreasyFork scene mover | Direct creator friction fix | Add Studio tools after live capture. |
| Privacy | Local-only history/bookmarks | Current | RumbleX local | Existing privacy posture is strong | Preserve local-first defaults. |
| Privacy | Strip tracking params | New | Community autoplay URLs expose `e9s` params | Easy privacy win | Add URL cleanup for `e9s`, campaign, and ref params with allowlist. |
| Privacy | No telemetry | Current | Most tools declare no data collection | Must be explicit | Add privacy report in settings and README later. |
| Privacy | Permission minimization | Partial | Store tools vary | RantStats uses tabs/unlimitedStorage; others minimal | Keep host permissions narrow and make optional permissions lazy. |
| Data | Settings backup/import | Current | RumbleX v1.9.3 | Existing full round trip | Add schema migrations, diff preview, undo toast. |
| Data | Local archive manifests | New | nullEFFORT, xerk | Backend tools have manifests/transcripts | Add JSON sidecars for downloads, transcripts, chats, rants. |
| Data | Multi-profile settings | New | No direct Rumble competitor found | Useful for work/casual/creator | Add profiles after storage schema v2. |
| Accessibility | Readability/contrast | Partial | Title scripts, Rumble Resize | Current panel can improve | Add contrast-safe OLED tokens, large text mode, reduced motion. |
| Accessibility | Focus and ARIA | Partial | RantStats/options, local lessons | Extension panels need consistent semantics | Use tablists, `aria-expanded`, `aria-pressed`, and live toasts. |
| Accessibility | No keyboard shortcuts | Needs change | Search Box Shortcut competitor exists | House style rejects shortcuts | Remove new shortcut planning; legacy module off by default. |
| Integrations | GitHub update checker | Current partial | RumbleX local | Existing GitHub API use | Keep local and non-invasive. |
| Integrations | MPV/PotPlayer/custom player | New | Play-With-MPV | Best external player feature | Add extension protocol bridge and userscript copy action fallback. |
| Integrations | OBS/alerts | New | RUM Bot and RantStats adjacent | Creator demand around live alerts | Plan optional export/webhook hooks, no cloud default. |

## Gap Analysis

The final scope is the union of competitor features plus viable gap-fills:

- RumbleX already beats single-purpose scripts by breadth, but it does not yet beat them on implementation sharpness. The roadmap must replace loop-based and selector-fragile behavior with a registry, route lifecycle, and per-feature destroy contract.
- Downloads are the most crowded area. To win, RumbleX needs MP4/WEBM quality listing, Shorts, live, HLS/DASH/fMP4, audio extraction, batch/channel archives, metadata sidecars, and external player handoff.
- RantStats is the strongest single-domain competitor for paid rants. RumbleX must match cached rants, sidebar/popup, read state, totals, CSV export, and then exceed it with tier filters, pinning, multi-stream, and cross-session analytics.
- Rumble theming is under-served. A native-token OLED theme engine with premium panel chrome can become the category-defining feature.
- Creator workflows are under-served. Studio scene rearrangement, uploader metadata fill, upload checklist, and stream alert exports can reach users ignored by viewer-only tools.
- Community requests identify immediate roadmap gold: remove Shorts everywhere, stop autoplay reliably, make downloads reliable again, shrink account pagination, and preserve browser-portable userscript delivery.
- Userscript distribution is an opportunity because OpenUserJS has no direct Rumble baseline and GreasyFork scripts are fragmented.
- Current RumbleX keyboard behavior should be retired or hidden behind a legacy off-by-default switch because the house style forbids keyboard shortcuts.
- Most competitor tools use prompts, alerts, or separate windows. RumbleX should replace those with inline menus, undo toasts, immediate toggles, and durable local logs.

## Technical Reconnaissance

### Selector Strategy

Implement a `selectors` module that provides:

- Named surface selectors with `stable`, `fallback`, `validate(el)`, and `churnRisk` fields.
- `findElement(surface, options)` that tries stable selectors first, validates structure, then falls back.
- `waitForElement(surface, { timeout, backoff, root })` with exponential backoff and a final telemetry toast/log entry in debug mode.
- `processAddedNodes(mutation, feature)` helpers so observers process only added nodes and never rescan the full document per mutation.
- Optional remote signed selector patches for CSS-only/cosmetic fixes, disabled by default.

High-churn areas needing self-healing:

- Home/feed section IDs and generated category rows.
- Rumble player control SVG/button wrappers.
- Live chat username/message wrappers.
- Notification menu.
- Rumble Studio/uploader pages, which need fresh captures.

### SPA and htmx Handling

Rumble appears htmx-heavy rather than React/Vue-heavy. Use both navigation and htmx hooks:

- Patch `history.pushState` and `history.replaceState` once from the core router.
- Listen for `popstate`.
- Listen for `htmx:afterSwap`, `htmx:afterSettle`, `htmx:historyRestore`, and `htmx:beforeSwap` if htmx is present.
- Listen for `visibilitychange` for player/download resume and live-chat throttling.
- Use page classifiers: `home`, `feed`, `watch`, `live`, `channel`, `search`, `account`, `studio`, `settings`, `unknown`.

Feature lifecycle:

- Run core storage, router, CSS manager, toast manager, and selector registry once per page load.
- Run view-bound feature `init()` on route enter and `destroy()` on route exit.
- For feed/search/channel cards, observe the smallest feed root and process added cards only.
- For chat, observe `#chat-history-list` child additions only.
- For comments, observe the comments container and batch added comment nodes with `requestIdleCallback` fallback to `setTimeout`.
- For settings toggles, call `destroy()` then `init()` immediately. Do not require reload for features that can cleanly restart.

### API and Rate-Limit Strategy

- `RumbleApiClient` owns all fetches to embedJS, htmx endpoints, GitHub releases, and media HEAD probes.
- Use a token bucket per host:
  - embedJS: low concurrency, cache by embed ID.
  - CDN HEAD/Range probes: moderate concurrency, cache by URL and ETag/last-modified where available.
  - GitHub releases: very low frequency, user-triggered or daily alarm.
  - htmx endpoints: user-action only unless read-only and cached.
- Add request collapse: multiple features asking for the same video metadata share one promise.
- Add a `downloadProbeCache` with TTL and manual clear.
- Use user-visible failure states: "No downloadable source found", "Live stream still resolving", "CDN refused range probe", "Format requires companion conversion".

### Constraints

- Captures did not show CSP or TrustedTypes meta enforcement, but implementation should use DOM APIs and a central injection path anyway.
- Shadow DOM may be useful for RumbleX-owned settings/panels, but page-integrated controls should use scoped classes to inherit Rumble tokens.
- MV3 service workers are ephemeral. Long downloads need resumable queues, persisted state, alarms, and active tab/content cooperation.
- Store review risk rises with remote code, broad host permissions, download automation, and content blocking. Remote selector/cosmetic rules must be data-only, signed, user-visible, and disabled by default.
- Userscript managers vary. Avoid remote runtime dependencies in `RumbleX.user.js`; bundle libraries or provide graceful feature disable.
- Media extraction may hit CORS and memory limits. Large files should stream/chunk where browser APIs allow; otherwise offer companion or external-player handoff.

### Recommended Architecture

Proposed source layout for the next implementation cycle:

```text
src/
  core/
    app.js
    router.js
    feature-registry.js
    selectors.js
    observer-manager.js
    css-manager.js
    toast-manager.js
    safe-dom.js
    rate-limiter.js
    logger.js
  platform/
    extension-storage.js
    userscript-storage.js
    extension-downloads.js
    userscript-downloads.js
    messaging.js
    alarms.js
  api/
    rumble-api-client.js
    embedjs-client.js
    media-probe-client.js
    github-release-client.js
  features/
    theming/
    feed/
    player/
    downloads/
    live-chat/
    rants/
    comments/
    creator/
    privacy/
    data/
    accessibility/
    integrations/
  ui/
    settings-panel.js
    popup.js
    options.js
    components/
  builds/
    chrome-mv3/
    firefox/
    userscript/
  tests/
    fixtures/mhtml/
    selectors/
    feature-lifecycle/
```

Feature contract:

```js
export const FeatureName = {
  id: 'featureKey',
  title: 'Feature Name',
  category: 'Player',
  defaultEnabled: true,
  surfaces: ['watch', 'live'],
  init(ctx) {},
  destroy(ctx) {}
};
```

Context object:

- `settings`
- `storage`
- `router`
- `selectors`
- `observerManager`
- `cssManager`
- `toast`
- `api`
- `downloadManager`
- `logger`
- `platform`

Every feature must register cleanup handles with the context. Destroying a feature must remove CSS style nodes, body classes, DOM controls, observers, timers, event listeners, message listeners, pending animation frames, and in-flight UI state.

## Settings Schema

Storage root: `rx_settings`.

New schema version key: `schemaVersion`, default `2`.

Existing keys must migrate in place. New keys should use explicit category prefixes only when collisions are likely; existing short keys can remain for compatibility.

### Core and Theme

| Key | Default | Type | Notes |
|---|---:|---|---|
| `schemaVersion` | `2` | number | Storage migration version. |
| `theme` | `oledGreen` | enum | Replace current `catppuccin` default for RumbleX-owned UI. |
| `denseMode` | `true` | boolean | Compact spacing across RumbleX panels and optional page surfaces. |
| `reducedMotion` | `false` | boolean | Disables shimmer/stagger/spring motion. |
| `glassIntensity` | `medium` | enum | Alpha/border/shadow only, no backdrop-filter. |
| `accentColor` | `rumbleGreen` | enum/custom | Maps to CSS custom properties. |
| `siteThemeSync` | `false` | boolean | Existing key; sync only to native dark/system controls where safe. |
| `siteTheme` | `dark` | enum | Do not present RumbleX light UI. |
| `legacyKeyboardNav` | `false` | boolean | Migration home for existing `keyboardNav`; no new shortcuts. |

### Layout and UI Cleanup

Existing keys: `wideLayout`, `theaterSplit`, `splitRatio`, `autoTheater`, `fullWidthPlayer`, `adaptiveLiveLayout`, `fullTitles`, `titleFont`, `autoHideHeader`, `autoHideNavSidebar`, `widenSearchBar`, `hideUploadIcon`, `hideHeaderAd`, `hideProfileBacksplash`, `hideFeaturedBanner`, `hideEditorPicks`, `hideTopLiveCategories`, `hidePremiumRow`, `hideHomepageAd`, `hideForYouRow`, `hideGamingRow`, `hideFinanceRow`, `hideLiveRow`, `hideFeaturedPlaylistsRow`, `hideSportsRow`, `hideViralRow`, `hidePodcastsRow`, `hideLeaderboardRow`, `hideVlogsRow`, `hideNewsRow`, `hideScienceRow`, `hideMusicRow`, `hideEntertainmentRow`, `hideCookingRow`, `hideFooter`, `hideRelatedOnLive`, `hideRelatedSidebar`, `widenContent`, `hideVideoDescription`, `hidePausedVideoAds`.

New keys:

| Key | Default | Type | Notes |
|---|---:|---|---|
| `hideThumbnails` | `false` | boolean | Hide all thumbnails. |
| `hideThumbnailsFeeds` | `false` | boolean | Feed-specific thumbnail hiding. |
| `hideThumbnailsRelated` | `false` | boolean | Related/sidebar thumbnail hiding. |
| `compactAccountPagination` | `false` | boolean | `/account/content*` pagination compaction. |
| `homeCleanupPreset` | `none` | enum | `none`, `focused`, `minimal`, `custom`. |
| `pageDensity` | `dense` | enum | `dense`, `normal`; no spacious-first design. |

### Player

Existing keys: `speedController`, `playbackSpeed`, `scrollVolume`, `defaultMaxVolume`, `autoMaxQuality`, `loopControl`, `miniPlayer`, `videoStats`, `videoTimestamps`, `screenshotBtn`, `chapters`, `sponsorBlock`, `videoClips`, `liveDVR`, `hideRewindButton`, `hideFastForwardButton`, `hideCCButton`, `hideAutoplayButton`, `hideTheaterButton`, `hidePipButton`, `hideFullscreenButton`, `hidePlayerRumbleLogo`, `hidePlayerGradient`.

New keys:

| Key | Default | Type | Notes |
|---|---:|---|---|
| `qualityMode` | `best` | enum | `best`, `lowest`, `manual`, `bandwidthSaver`. |
| `perChannelVolumeMemory` | `false` | boolean | Stores volume by channel. |
| `autoplayBlockMode` | `relatedEndpointAndPlayer` | enum | Uses player hooks plus request blocking where extension permits. |
| `clipExportFormat` | `mp4` | enum | `mp4`, `webm`, `manifestOnly` depending browser capability. |
| `segmentSkipMode` | `localOnly` | enum | Optional community DB later. |

### Downloads and Archives

Existing keys: `videoDownload`, `subtitleSidecar`, `transcripts`, `audioOnly`, `batchDownload`.

New keys:

| Key | Default | Type | Notes |
|---|---:|---|---|
| `downloadManagerEnabled` | `true` | boolean | Owns all download UI. |
| `downloadQualityPreference` | `best` | enum | `best`, `1080p`, `720p`, `480p`, `lowest`, `askInline`. |
| `downloadIncludeMetadata` | `true` | boolean | JSON sidecar. |
| `downloadIncludeThumbnail` | `false` | boolean | User controlled. |
| `downloadLiveStreams` | `false` | boolean | High-risk, opt-in. |
| `downloadShorts` | `true` | boolean | Extends normal downloader. |
| `downloadConcurrency` | `2` | number | Host-safe default. |
| `downloadProbeCacheTtlHours` | `24` | number | Prevents repeated probes. |
| `audioExtractionMode` | `browserIfSupported` | enum | `off`, `browserIfSupported`, `companion`, `external`. |
| `externalPlayerEnabled` | `false` | boolean | MPV/PotPlayer/custom handoff. |
| `externalPlayerTemplate` | `""` | string | Custom protocol/command template. |
| `channelArchiveEnabled` | `false` | boolean | Queue channels. |
| `channelArchiveFilterClips` | `false` | boolean | NullEFFORT-inspired clip filter. |
| `channelArchiveMaxItems` | `50` | number | Safe default. |

### Feed, Filtering, and Moderation

Existing keys: `feedCleanup`, `hideReposts`, `hidePremium`, `hiddenCategories`, `relatedFilter`, `shortsFilter`, `channelBlocker`, `blockedChannels`, `keywordFilter`, `blockedKeywords`, `commentBlocking`, `blockedCommenters`.

New keys:

| Key | Default | Type | Notes |
|---|---:|---|---|
| `shortsFilterScope` | `everywhere` | enum | Feed/search/channel/related. |
| `blockedChannelsMeta` | `[]` | array | Channel, reason, createdAt, expiresAt. |
| `blockedKeywordsMode` | `literal` | enum | `literal`, `regex`, `wildcard`. |
| `filterPreviewBadges` | `true` | boolean | Shows local count in settings/log only. |
| `politicsFilterPreset` | `off` | enum | Rumbie-inspired optional category preset. |
| `remoteCosmeticRules` | `false` | boolean | Signed data-only rules, opt-in. |
| `remoteCosmeticRulesChannel` | `stable` | enum | `stable`, `preview`. |

### Live Chat and Rants

Existing keys: `liveChatEnhance`, `chatAutoScroll`, `uniqueChatters`, `chatUserBlock`, `blockedChatters`, `chatSpamDedup`, `chatExport`, `rantHighlight`, `rantPersist`, `popoutChat`, `cleanLiveChat`.

New keys:

| Key | Default | Type | Notes |
|---|---:|---|---|
| `chatMentionHighlight` | `true` | boolean | ChatPlus parity. |
| `chatClickToMention` | `true` | boolean | Visible click action, no shortcut. |
| `chatParticipantsList` | `false` | boolean | Participant drawer. |
| `chatUsernameColors` | `deterministic` | enum | `off`, `deterministic`, `tiered`. |
| `chatTimedMutes` | `true` | boolean | AMO Chat Muter parity. |
| `chatMuteDurations` | `[15,30,60,240]` | array | Minutes plus permanent/custom. |
| `rantStatsPanel` | `true` | boolean | RantStats parity. |
| `rantExportFormat` | `csvJson` | enum | CSV, JSON, both. |
| `rantTierFilter` | `0` | number | Minimum displayed tier/value. |
| `rantStickyHighValue` | `true` | boolean | Pin high-value rants. |
| `multiStreamViewer` | `false` | boolean | Experimental until verified. |

### Comments

Existing keys: `commentNav`, `commentSort`, `autoLoadComments`, `moveReplyButton`, `hideCommentReportLink`.

New keys:

| Key | Default | Type | Notes |
|---|---:|---|---|
| `commentThreadView` | `false` | boolean | Threaded reply focus. |
| `commentSearch` | `false` | boolean | In-page comment search. |
| `commentMuteDurations` | `[1440,10080]` | array | Day/week/permanent presets. |
| `commentExport` | `false` | boolean | JSON/CSV comment export. |

### Automation, Creator, and Integrations

Existing keys: `quickSave`, `notifEnhance`, `playlistQuickSave`, `autoLike`, `autoplayScheduler`, `autoplayQueue`.

New keys:

| Key | Default | Type | Notes |
|---|---:|---|---|
| `bulkUnsubscribeEnabled` | `false` | boolean | Unsubscriby parity. |
| `bulkUnsubscribeDryRun` | `true` | boolean | Preview first, then one-click run with undo toast. |
| `channelNotifierEnabled` | `false` | boolean | Alarm-based monitor. |
| `discordWebhookUrl` | `""` | string | Optional user-provided integration. |
| `rssExportEnabled` | `false` | boolean | RSS/OPML export. |
| `creatorMode` | `false` | boolean | Unlocks Studio/uploader helpers. |
| `uploaderMetadataFill` | `false` | boolean | YouTube URL clipboard metadata. |
| `studioSceneTools` | `false` | boolean | Scene mover and layout. |
| `obsAlertExport` | `false` | boolean | Rant/sub/follow alert output. |

### Privacy, Data, and Backup

Existing keys: `watchProgress`, `watchHistory`, `searchHistory`, `quickBookmark`, `bookmarks`, `sponsorSegments`.

New keys:

| Key | Default | Type | Notes |
|---|---:|---|---|
| `stripTrackingParams` | `true` | boolean | Remove `e9s`, campaign, and ref params where safe. |
| `privacyReport` | `true` | boolean | Shows local-only storage/permission state. |
| `settingsProfiles` | `[]` | array | Multi-profile support. |
| `activeProfileId` | `"default"` | string | Current profile. |
| `backupHistory` | `true` | boolean | Snapshot before import/reset. |
| `backupHistoryLimit` | `10` | number | Local snapshots. |
| `encryptedGistSync` | `false` | boolean | Future user-provided sync. |
| `debugSelectorTelemetry` | `false` | boolean | Local export only. |

## Settings Panel Spec

Panel behavior:

- Opens as a RumbleX-owned dark overlay with inactive `pointer-events: none`.
- Uses tabs or segmented category buttons, not keyboard shortcuts.
- All toggles save immediately and apply immediately.
- Destructive actions use action buttons plus undo toast and backup snapshot, not confirmation dialogs.
- Search filters settings by label, description, and storage key.
- Every feature row shows state, short description, scope, and "Reset this feature" action where state exists.
- Export/import uses schema validation, diff preview, toast feedback, and rollback snapshot.
- Advanced/debug settings are hidden behind a visible "Advanced" toggle.

Categories:

- Core: enable RumbleX, theme, dense mode, reduced motion, accent, debug logs, legacy keyboard compatibility off by default.
- Layout: theater split, full-browser theater, wide layout, full titles, title font, hide thumbnails, home/feed/sidebar cleanup, account pagination compaction.
- Player: quality mode, speed, volume scroll, loop, autoplay block, mini player, screenshots, chapters, segment skip, controls hide-X.
- Downloads: one-click download, quality picker, Shorts/live support, audio extraction, subtitles, transcripts, batch/channel archive, external player, metadata sidecars.
- Feed filters: reposts, premium, Shorts, categories, channels, keywords, politics/content presets, related filtering, remote cosmetic rules.
- Live chat: chat cleanup, auto-scroll, participants, mentions, user colors, user mutes, spam dedup, export, popout, multi-stream.
- Rants: persistence, stats panel, tier filter, sticky high-value rants, CSV/JSON export, cached rants management.
- Comments: sort, navigation, auto-load, thread view, search, commenter mutes, export, report/reply layout controls.
- Automation: auto-like, quick save, playlist save, notifications, bulk unsubscribe, channel monitor, Discord/webhook, RSS/OPML.
- Creator: uploader metadata fill, Studio scene tools, OBS/alert exports, upload checklist.
- Privacy/data: tracking-param strip, watch/search/history/bookmarks, backup/import, profiles, encrypted gist sync, privacy report.

## Phased Build Plan

### v2.0.0: Core Engine, Settings, and Userscript Parity

Features:

- [ ] Split shared runtime into core/platform/features layout. *(Deferred to v2.1 — kept content.js single-file for v2.0 stability; the new selector registry + router are the seams the split will pull through.)*
- [x] Build selector registry from the MHTML map. *(v2.0.0 — `Selectors` module with 27 named surfaces × stable+fallback selectors + `find`/`findAll`/`wait`/telemetry ring buffer.)*
- [x] Build route lifecycle for htmx and history navigation. *(v2.0.0 — `Router` patches `history.pushState`/`replaceState` once, hooks `popstate` + `htmx:afterSwap`/`afterSettle`/`historyRestore`, emits `{ url, prevUrl, page, prevPage, reason, changed }` via `Router.onChange()`. `Page.classify()` returns one of 10 page kinds.)*
- [ ] Convert current feature registry to `init(ctx)` and `destroy(ctx)`. *(Deferred to v2.1 — existing modules already implement `init()`/`destroy()` per the v1.x contract; v2.1 will thread the `ctx` object through.)*
- [ ] Rebuild settings panel with grouped categories, immediate apply, undo toasts, and no dialogs. *(Partial — v2.0.0 added five new options-page groups (**Core**, **Automation**, **Creator & Studio**, **Integrations**, **Privacy & Data**) and ~70 new keys with META. Toast + undo polish lands in v2.1.)*
- [x] Migrate `keyboardNav` to `legacyKeyboardNav: false`. *(v2.0.0 — `Settings._migrate()` preserves pre-v2 `keyboardNav: true` into `legacyKeyboardNav: true` so users don't silently lose hotkeys. New default is off. Module retitled "Keyboard Nav (legacy)", moved to **Core** options group.)*
- [ ] Generate MV3 extension and single-file userscript from shared core. *(Deferred to v3.0 per roadmap acceptance criteria — userscript still on v1.8.0 baseline until v2.x feature work stabilises.)*
- [ ] Remove remote userscript runtime dependencies. *(N/A until userscript is regenerated in v3.0.)*

v2.0.0 also delivered, beyond the original scope:

- [x] **Schema v2 migration** — Storage gains `schemaVersion: 2` marker, written through on first load via `Settings._migrate()`. Migration is idempotent and runs only once per profile.
- [x] **~70 new settings keys** — Core/theming, layout, player, downloads, feed/moderation, chat/rants, comments, automation, creator, integrations, privacy/data. All three catalogs (content.js `_defaults`, popup.js `DEFAULTS`, options.js `DEFAULTS` + `META`) extended in lockstep.
- [x] **OLED Green theme** — Added `oledGreen` to `THEMES` (pure-black AMOLED, Rumble-green accent, alpha-only glass per house style — no `backdrop-filter`). Existing `catppuccin` default preserved on upgrade; v2.1 flips new installs.

Dependencies:

- Existing v1.9.3 settings defaults.
- MHTML fixtures in `Sample Pages/`.

Acceptance criteria:

- No feature code lives only in extension or only in userscript unless the platform cannot support it.
- Toggling any migrated feature on/off removes all DOM/CSS/listeners without reload.
- Existing backups import into schema v2.
- Userscript can install as one file and load core settings.
- [x] No new keyboard shortcuts exist. *(KeyboardNav demoted to legacy/off; no new shortcuts introduced in v2.0.0.)*

### v2.1.0: Premium UI and Layout Superset

Features:

- [x] OLED theme engine using native Rumble CSS variables. *(v2.1.0 — `oledGreen` theme + `DarkEnhance._buildCSS()` now writes `--color-bg-*`, `--brand-*`, `--link-color`, `--input-*`, `--channel-border*`, `--menu-border-color`, etc. so themed surfaces inherit the active palette without per-selector overrides. Applies to all five themes including the new `oledGreen`.)*
- [x] Dense mode and account pagination compaction. *(v2.1.0 — `DenseMode` (`body.rx-dense` class with tighter padding across grids/watch/comments/related) and `AccountPaginationCompact` (clamps `.pagination.autoPg` to 720px on /account/content* only) shipped as separate modules.)*
- [x] Full titles, title font, thumbnail hider, full-browser theater, TheaterSplit refresh. *(v2.1.0 — `ThumbnailHider` shipped with three composable scopes (`hideThumbnails` master / `hideThumbnailsFeeds` / `hideThumbnailsRelated`) using `visibility: hidden + opacity: 0` to preserve grid heights. `FullTitles`, `TitleFont`, `TheaterSplit`, `FullWidthPlayer` already shipped in v1.x; their settings keys remain. **Deferred:** full-browser theater refresh that merges `theaterSplit` + `fullWidthPlayer` into a single unified UI — both modules already cover their use cases independently, v2.2 unifies the UI.)*
- [x] Home/feed/sidebar cleanup presets. *(v2.1.0 — `HomeCleanupPreset` module driven by the `homeCleanupPreset` enum: `none | focused | minimal | custom`. Layers on top of the existing per-row hide-X toggles and `CategoryFilter`.)*
- [ ] Hide-X registry migrated to selector registry. *(Deferred to v2.2 — current hide-X CSS toggles already work via stable selectors. v2.2 will mechanically swap remaining feature DOM queries to route through `Selectors.find()`/`findAll()`.)*
- [x] Shimmer, hover lift, spring-like motion, reduced-motion path. *(v2.1.0 — `ReducedMotion` module honors both the explicit `reducedMotion` setting and the OS-level `prefers-reduced-motion` media query. Drops animation/transition durations to 0.001ms scoped under `body.rx-reduced-motion`. RumbleX-owned shimmer/hover-lift/spring motion is already in the v1.x panels; the kill-switch is the v2.1 add.)*

Dependencies:

- v2.0 selector/CSS manager.

Acceptance criteria:

- [x] RumbleX UI has no light theme path. *(All five themes are dark; no light variant exists.)*
- [x] Visual overlays use no `backdrop-filter`. *(All overlays use alpha-only glass.)*
- [x] All panel states are scoped under RumbleX body classes. *(`rx-dense`, `rx-reduced-motion` introduced this pass; existing modal/overlay surfaces remain scoped under `rx-panel-open` etc.)*
- [x] Disabling each UI/layout module fully restores page layout. *(Each new v2.1 module's `destroy()` removes its style element and any body class it added.)*

### v2.2.0: Download Manager 2.0

Features:

- Unified download manager and media probe cache.
- MP4/WEBM quality picker with provenance and failure reasons.
- Shorts download parity.
- HLS/DASH/fMP4 detection and safe handling.
- Live stream recording prototype behind opt-in toggle.
- Subtitle sidecars, transcript import/export, metadata sidecars.
- Real audio extraction path: browser if supported, companion/external fallback.
- External player handoff to MPV/PotPlayer/custom URI.
- Batch and channel archive queue with filters, concurrency, resume, and manifest export.

Dependencies:

- Rate-limited `RumbleApiClient`.
- MV3 background/download state persistence.

Acceptance criteria:

- Download UI explains every unavailable format.
- Repeated page scans reuse probe cache.
- Queue survives service worker restart.
- Userscript gracefully disables unsupported background/large-file features and offers copy/open fallbacks.

### v2.3.0: Live Chat, Rants, and Multi-Stream

Features:

- Chat participants list, mention highlight, click-to-mention, username colors.
- Timed and permanent chat mutes with reason and expiry.
- Spam dedup dashboard.
- RantStats parity: cached rants, sidebar/popup, read state, totals, CSV/JSON export.
- Rant tier filter and sticky high-value rant rail.
- Popout chat resize persistence.
- Multi-stream 2 to 4 grid experimental module.

Dependencies:

- Live capture selectors and route lifecycle.

Acceptance criteria:

- Live chat observer processes added nodes only.
- Rant cache is viewable after stream ends.
- Exports include stream metadata.
- Timed mutes expire without reload.

### v2.4.0: Feed, Discovery, and Moderation

Features:

- Shorts removal everywhere.
- Channel blocklist with reason/expiry/import/export.
- Keyword filter literal/regex/wildcard modes with scope.
- Category/home row presets.
- Related/sidebar replacement rules.
- Watch-next replacement using local history only.
- Remote signed cosmetic rules preview channel, opt-in.
- Tracking parameter stripping.

Dependencies:

- Stable feed/card selector registry.
- Privacy report.

Acceptance criteria:

- Feed filters show local match counts.
- No full-document scan per card mutation.
- URL cleanup never breaks canonical watch navigation.
- Remote rules are data-only, signed, user-visible, and rollbackable.

### v2.5.0: Creator, Studio, and Account Power Tools

Features:

- Rumble Studio scene tools after live capture.
- Uploader metadata fill from YouTube URL clipboard/context action.
- Upload checklist and field completeness warnings.
- Bulk unsubscribe with preview, stop, undo toast, and local log.
- RSS/OPML export.
- Channel monitor with optional Discord webhook.
- OBS/alert export hooks for rants/subs/follows where available.

Dependencies:

- Fresh Studio/uploader/account MHTML captures.
- User-action-only automation guardrails.

Acceptance criteria:

- No account automation starts without a visible user action.
- Bulk actions are stoppable and logged locally.
- Creator tools cleanly disable and leave native forms intact.

### v2.6.0: Data, Profiles, Accessibility, and Privacy

Features:

- Multi-profile settings.
- Backup snapshot history and one-click rollback.
- Encrypted user-provided gist sync prototype.
- Privacy report and permission explanation.
- Accessibility pass for focus, ARIA, contrast, reduced motion, and screen-reader naming.
- Local debug export for selectors, route events, and feature lifecycle.

Dependencies:

- Schema v2.
- Settings panel components.

Acceptance criteria:

- Import/reset creates rollback snapshot.
- All settings controls have names, states, and relationships.
- No RumbleX network calls occur unless tied to an enabled feature and disclosed in privacy report.

### v3.0.0: Distribution, Store Readiness, and Regression Harness

Features:

- README refresh and install docs.
- Chrome ZIP and store package.
- Firefox MV3 package if verified; MV2 fallback documented until retired.
- Userscript release with update/download URLs.
- MHTML selector regression harness.
- Manual verification matrix for For You, My Feed, VOD watch, live watch, search, channel, account content, settings, and Studio where accessible.
- Store-review audit for permissions, remote rules, downloads, and privacy.

Dependencies:

- v2.x feature stabilization.

Acceptance criteria:

- Build artifacts are reproducible.
- Store copy accurately states permissions and data use.
- Every competitor feature is implemented, exceeded, or explicitly rejected because it violates the no-shortcut/no-dialog/local-first house style.
- The public README describes the product as a complete Rumble suite rather than a sideload-only experiment.

## Selector and API Reference

Core selectors:

| Key | Stable | Fallback |
|---|---|---|
| `header.root` | `header[data-js="app_header"]` | `.header` |
| `nav.mainMenu` | `#main-menu` | `.hover-menu.main-menu-nav` |
| `search.form` | `form[data-js="search_form"]` | `.header-search` |
| `search.input` | `[data-js="search_input"]` | `.header-search-field` |
| `search.autocomplete` | `[data-js="autocomplete_results_container"]` | `[hx-post="/search/htmx/get-autocomplete-results"]` |
| `feed.card` | `[role="listitem"][data-video-id]` | `.videostream.thumbnail__grid--item` |
| `feed.cardTitle` | `a[href*="/v"] .thumbnail__title, .thumbnail__title` | `.thumbnail__title.line-clamp-2` |
| `feed.author` | `a[rel="author"].channel__link` | `.channel__link` |
| `watch.media` | `[data-js="media_container"]` | `.media-page` |
| `watch.player` | `#videoPlayer, video` | `.videoPlayer-Rumble-cls` |
| `watch.title` | `.video-header-container__title` | `[class*="video-header"] [class*="title"]` |
| `watch.share` | `[data-js="media_engage_share"]` | `.round-button.media-by-actions-button` |
| `watch.description` | `[data-js="media_description_section"], .media-description-section` | `.container.content.media-description` |
| `watch.related` | `.media-page-related-media-desktop-sidebar` | `.mediaList-item` |
| `comments.root` | `[data-js="media_page_comments_container"], #video-comments` | `.media-page-comments-container` |
| `comments.item` | `li.comment-item[data-comment-id]` | `.comment-item` |
| `comments.text` | `.comment-text` | `[class*="comment"] [class*="text"]` |
| `comments.composer` | `[data-js*="comment"] textarea` | `.comments-create-textarea` |
| `chat.root` | `aside.media-page-chat-aside-chat` | `.chat--header` |
| `chat.history` | `#chat-history-list` | `.chat-history` |
| `chat.message` | `#chat-history-list .chat-history--row` | `.chat-history--row` |
| `chat.username` | `.chat-history--username, .chat-history--rant-username` | `.js-chat-username` |
| `rant.item` | `.chat-history--rant[data-level]` | `.chat-history--rant` |
| `rant.price` | `.chat-history--rant-price` | `[class*="rant-price"]` |
| `modal.portal` | `#portal[data-js="portal"]` | `#portal` |
| `modal.overlay` | `[data-js="modal__overlay"]` | `[hx-ext="modal"]` |
| `theme.group` | `.theme-option-group` | `[class*="theme-option"]` |
| `account.pagination` | `.pagination.autoPg` | `.pagination` |

API reference:

| API | Use | Auth | Rate-limit need | Notes |
|---|---|---|---|---|
| `embedJS/u3/?request=video&ver=2&v=` | Video metadata and media URLs | Public for accessible videos | High | Cache by embed ID and endpoint variant. |
| `embedJS/u0-u4` probes | Fallback embed metadata | Public for accessible videos | High | Probe sparingly and stop on success. |
| Rumble CDN media URLs | HEAD/Range/download | Public or signed URL dependent | Medium | Respect CORS/failure; do not hammer. |
| `/search/htmx/get-autocomplete-results` | Search suggestions | likely session aware | Medium | User input only. |
| `/-htmx/account/legacy-video-collection` | Playlist/save action | Logged-in | High | Use only on user action. |
| `/-htmx/channel/update-action-buttons` | Channel subscribe/follow UI state | Logged-in | High | Read-only observation preferred. |
| `/-htmx/web-services/repost-vote` | Repost vote UI | Logged-in | High | Do not automate by default. |
| GitHub Releases API | RumbleX update check | Public | Low | Daily alarm or user action. |

## Risks and Open Questions

- Live-site verification needed for Rumble Studio, uploader, account content, notifications, profile settings, and logged-in-only modals.
- Feed section IDs were not consistently visible in the local For You/My Feed captures; self-healing selectors are required.
- Rumble can change embedJS host variants and CDN URL shapes; media code must expose failure reasons and cache probe results.
- Browser-only fMP4/HLS/live recording can hit memory, CORS, and service-worker lifetime limits.
- Remote cosmetic rules may trigger store-review scrutiny. Keep them data-only, signed, disabled by default, and user-visible.
- MV3 service worker restarts can break long queues unless every queue item is persisted and resumable.
- Userscript managers differ on `@connect`, `GM_download`, `GM_xmlhttpRequest`, CSP interaction, and injection timing.
- Some competitor features use prompts/alerts/confirmations. RumbleX must replace them with inline UI and toast feedback.
- Existing `keyboardNav` conflicts with the no-keyboard-shortcut rule and should migrate off by default.
- AMO metadata for `Rumble download media` appeared inconsistent between search snippet and opened locale page; recheck before public comparison copy.
- Chrome Web Store user counts and mirrors can drift or disagree. Recheck before publishing marketing claims.
- Rumble content download features may have copyright and store-policy implications. Keep user-initiated, transparent, and avoid bypass claims.

## Definition of Done

RumbleX v3.0.0 beats every competitor when:

- Every Rumble-specific feature found in GreasyFork, Chrome Web Store, Firefox AMO, GitHub, RantStats, ChatPlus, Rumble Tools, Rumble Resize, Rumble downloaders, and community scripts is implemented, exceeded, or deliberately replaced with a safer equivalent.
- MV3 extension and single-file userscript share the same core modules and settings schema.
- RumbleX-owned UI is consistently premium dark/OLED, dense, polished, accessible, and scoped.
- No RumbleX feature depends on raw hashed class names without stable fallback strategy.
- All feature toggles hot-apply and destroy cleanly without reload wherever technically possible.
- Downloads cover normal videos, Shorts, live where supported, quality selection, metadata, subtitles, transcripts, batch/channel archives, external player handoff, and honest unsupported states.
- Live/chat/rant tools match RantStats and ChatPlus, then add multi-stream, filters, pinning, and richer exports.
- Feed and moderation tools handle Shorts, channels, keywords, categories, related content, and cosmetic row cleanup.
- Creator tools cover Studio layout and uploader metadata fill after fresh captures.
- Privacy remains local-first with no telemetry and clear optional network integrations.
- Regression verification covers local MHTML fixtures plus live For You, My Feed, VOD watch, live watch, search, channel, account content, settings, and Studio where accessible.
- README, release notes, install docs, and store packages accurately describe features, permissions, privacy, and platform differences.
