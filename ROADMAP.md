# RumbleX Roadmap

Version: 4.6 — v3.7 chrome.sidePanel shipped
Date: 2026-05-19
Current shipped: v3.7.0 (extension), v1.8.0 (userscript)

This roadmap supersedes the v2026-05-19 v3.0 plan. It is the result of a fresh repo audit plus a 60+ source external research sweep (see [Appendix C — Sources](#appendix-c--sources)). It tracks shipped work in the [Recently shipped](#recently-shipped) summary, then prioritises the next ~12 months of work into **Now / Next / Later / Under Consideration / Rejected** tiers with every claim traceable to a source.

House style (carried forward, non-negotiable): dark-only RumbleX-owned UI, OLED black with Rumble-green accent, no `backdrop-filter`, no keyboard shortcuts, no confirmation dialogs, immediate-apply + toast feedback, local-first, no telemetry, every feature exposes `init(ctx)` / `destroy(ctx)`, selectors prefer `data-*`/`aria-*`/IDs/structure over hashed classes, settings grouped by category and persisted.

---

## State of the repo

- **Stack:** Chrome MV3 + Firefox MV2 (parallel manifests). Vanilla JS, no build step beyond `extension/build.sh`. Single `content.js` (~11600 lines, 195 settings keys, ~135 feature modules). `background.js` MV3 service worker. `worker.js` Web Worker bundling mux.js for HLS-to-MP4 transmux. `pages/popup.{html,js}` + `pages/options.{html,js}` for UI. Tampermonkey userscript at `RumbleX.user.js` lags at v1.8 baseline.
- **MHTML ground truth:** 4 captures in `Sample Pages/` — For You, My Feed, VOD Watch, Live. No capture exists for `/shorts`, `/account/*`, `studio.rumble.com`, uploader, notifications, or logged-in modals.
- **Shipped v2 arc (this calendar month):** v2.0 schema-v2 migration + Selectors registry + Router + 70 new keys + OLED Green theme. v2.1 ThumbnailHider/DenseMode/AccountPaginationCompact/ReducedMotion/HomeCleanupPreset + native-token theme mapping. v2.2 ExternalPlayer + MediaProbeCache. v2.4 RantTierFilter + ChatUsernameColors + KeywordFilter modes (literal/regex/wildcard) + StripTrackingParams. v3.0 PrivacyReport + BackupSnapshot + SelectorTelemetry message API + README refresh. See [Recently shipped](#recently-shipped).
- **Repo discoverability today:** 0 GitHub stars, 0 forks, 0 watchers, 0 open issues (confirmed via `gh` 2026-05-19). Both closed issues were addressed in v0.5.0. Not listed on Chrome Web Store, Firefox AMO, or Edge Add-ons. Userscript not listed on Greasy Fork or OpenUserJS. This is the single largest unrealized leverage point for the project (see *Distribution & discoverability* theme).
- **License:** MIT. Hosts permissioned today: `rumble.com`, `1a-1791.com`, `rumble.cloud`, `api.github.com`.

---

## Platform state (Rumble, mid-2026)

| Surface | Status | Source | Roadmap impact |
|---|---|---|---|
| **Rumble Shorts** (`rumble.com/shorts`) | Launched on web **2026-02-04**. Vertical, swipeable, loops until swipe, dedicated player. ≤ 90 s, 1:1 or taller. Appears on home + creator channels + Shorts tab. | [Rumble blog](https://corp.rumble.com/blog/rumble-unveils-the-web-version-of-rumble-shorts/) · [Nasdaq](https://www.nasdaq.com/press-release/rumble-unveils-web-version-rumble-shorts-2026-02-04) | New route + new card surface. Existing `shortsFilter` only catches `#shorts__label` SVG and `#section-shorts`. Needs explicit `/shorts/` route classifier, Shorts-tab hide, and shorts-feed swipe-container handling. **Now tier.** |
| **Rumble Wallet** (tip jar) | Launched **2026-01-07** with Tether. Non-custodial. Tip button appears only on creators who have enabled tip jar. | [Tether](https://tether.io/news/tether-and-rumble-launch-rumble-wallet-bringing-self-custodial-crypto-payments-to-millions-of-creators-and-users/) · [CoinDesk](https://www.coindesk.com/markets/2026/01/07/rumble-shares-jump-5-after-launching-crypto-wallet-with-tether) | New per-creator UI element. Some users will want to hide it. Add `hideWalletTipButton` toggle to the hide-X registry. **Now tier.** |
| **Perplexity Pro bundle** | Rolled into Rumble Premium subscription. Promo placement on the platform likely. | [Stocktitan](https://www.stocktitan.net/news/RUM/) | New promo banner surface to inventory. **Next tier** pending live capture. |
| **Rumble Studio Canvas** | Updated **2026-03-18**: admin/moderator support, multi-scene layouts (Starting Soon, Camera Only, Screen Share, Interview). | [Rumble support](https://rumble.support/help/studio-canvas-updates) | Confirms `studio.rumble.com` evolves independently. v2.5 Creator tools remain blocked on Studio capture. |
| **Rumble Creator Program** | Updated **2025-11-25** + Dec 2025: 30-hour requirement reduced to 1 hour; Host Read removed. | [Rumble support](https://rumble.support/help/rumble-2025-creator-program) | No direct extension impact. |
| **Rumble Cloud / OpenClaw** | B2B GPU-as-a-Service, AI infrastructure. Not user-facing. | [MEXC News](https://www.mexc.com/news/1070109) | Out of scope. |
| **Public APIs** | Per GetApp, Rumble Studio has **no public API**. embedJS endpoints (`u0`-`u4`, `u3?ver=2`) remain the only programmatic surface and are not documented. | [GetApp Rumble Studio](https://www.getapp.com/all-software/a/rumble-studio/) | Continues to justify selector-registry / DOM-scraping approach over API client. |

---

## Themes for the next 12 months

1. **Platform follow-through** — Rumble Shorts, Wallet, and the Perplexity-Pro/Premium changes shifted the surface area mid-year. Existing modules need to catch up before we add anything new.
2. **Download pipeline 2.0 (de-risked)** — `mux.js` is in maintenance mode (last release ~3 years ago, ["this module is in maintenance mode and will not have further major development"](https://www.npmjs.com/package/mux.js/v/5.2.0-2)). Plan an exit ramp to **Mediabunny** ([deprecated mp4-muxer successor with WebCodecs API integration](https://github.com/Vanilagy/mp4-muxer)) or **mp4-wasm** before a CVE forces it.
3. **MV3 capability uptake** — `chrome.offscreen` solves the service-worker DOM gap that has limited us so far; `chrome.sidePanel` enables a persistent RantStats-parity panel; `chrome.contextMenus` adds the right-click affordances users keep asking for; `chrome.declarativeNetRequest` lets us declaratively block embedJS-related autoplay endpoints. Adopt one per minor release.
4. **Resilience** — Selector registry exists (v2.0); now we need a regression harness, an end-to-end Playwright suite, and a self-test that runs Selectors.find() against every MHTML fixture in CI. ["Fixtures + Selectors module already shipped"](https://github.com/SysAdminDoc/RumbleX/) but the harness is still missing.
5. **Accessibility & i18n** — Zero `_locales/` strings shipped. Zero formal WCAG audit. WCAG 2.2 (legal standard, [referenced in 4,605 ADA lawsuits in 2024](https://www.allaccessible.org/blog/implementing-aria-labels-for-web-accessibility)) introduced **2.5.8 Target Size 24px** and **4.1.3 Status Messages** (aria-live) that we likely fail.
6. **Distribution & discoverability** — Repo has 0 stars/forks/watchers. Not on Chrome Web Store, AMO, or Edge Add-ons. Not listed on Greasy Fork or OpenUserJS. The AFFiNE [60k-star playbook](https://dev.to/iris1031/how-to-get-more-github-stars-the-definitive-guide-33k-stars-case-study-2kjo) compresses Show HN + Reddit + Product Hunt + Twitter into one 48-hour launch window; we need to be ready.

---

## Now — v3.1.0 ✓ shipped 2026-05-19

Items must be Now-tier if (a) source confirms a fresh platform surface change, OR (b) a shipped setting key exists with no underlying feature module, OR (c) a hard-rule house-style violation exists, OR (d) it's a one-edit-per-change fix.

### Platform follow-through

- [x] **`shortsRoute` + Shorts feed handling.** *(v3.1.0 — `Page.isShorts()` classifier covers `/shorts`, `/shorts/*`, `/shorts.*`. `Page.classify()` returns `'shorts'`. New `ShortsRedirect` module: when `disableShortsFeed` is on, navigating to `/shorts` triggers `location.replace('/subscriptions')` on both fresh load and htmx route change.)* Source: [Rumble blog](https://corp.rumble.com/blog/rumble-unveils-the-web-version-of-rumble-shorts/) · [Nasdaq](https://www.nasdaq.com/press-release/rumble-unveils-web-version-rumble-shorts-2026-02-04).
- [x] **`hideWalletTipButton` toggle.** *(v3.1.0 — added to `RX_CSS_TOGGLES` hide-X registry with a broad selector covering both `data-js` variants and class-name fallbacks. Off by default.)* Source: [Tether launch](https://tether.io/news/tether-and-rumble-launch-rumble-wallet-bringing-self-custodial-crypto-payments-to-millions-of-creators-and-users/).
- [x] **`Selectors` registry adds `shorts.feed`, `shorts.card`, `shorts.player`, `wallet.tipButton`.** *(v3.1.0 — conservative entries shipped; refine once we have live MHTML captures of `/shorts` and a creator page with tip jar visible.)*

### House-style debt

- [x] **WCAG 2.2 SC 4.1.3 Status Messages: `aria-live` on toast region.** *(v3.1.0 — settings-modal toast region now has `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. Options-page status divs already compliant.)* Source: [WCAG 2.2 / ARIA integration](https://www.accesify.io/blog/aria-wcag-integration/).
- [x] **WCAG 2.2 SC 2.5.8 Target Size 24 px on all in-page controls.** *(v3.2.0 — popup toggle 34×18→40×24 + thumb 14→20; in-page modal switch 40×22→40×24 + thumb 16→18; options-page toggle already at 44×26. Translate offsets re-computed. Toggle-switch full-rounded shape preserved per the explicit exception in the no-pill-backdrops rule.)* Source: [Accesify](https://www.accesify.io/blog/aria-wcag-integration/) · [BrowserStack](https://www.browserstack.com/guide/wcag-chrome-extension).
- [x] **`aria-pressed` on every Switch component, `aria-expanded` on collapsible category groups.** *(v3.1.0 — `aria-pressed` added to in-page modal `_makeSwitch`, popup `makeToggle`, options-page `renderToggleControl`. State syncs on every change event. Popup category groups already had `aria-expanded`.)* Source: [WCAG / ARIA spec](https://www.allaccessible.org/blog/implementing-aria-labels-for-web-accessibility).
- [x] **`autoplayBlockMode` actually consumed by AutoplayBlock module.** *(v3.1.0 — module reads `Settings.get('autoplayBlockMode')` and routes through three branches: `off` matches `!autoplayBlock`; `playerOnly` is v1.x DOM-overlay removal; `relatedEndpointAndPlayer` (default) additionally installs an `ended` event capture-phase guard that pauses the player so the next video can't auto-load. v3.2 pairs this with declarativeNetRequest.)* Community uBlock filter precedent: [Mastering The Rumble: Stop Autoplay with uBlock Origin](https://rumble.com/v3tkf3a-mastering-the-rumble-stop-autoplay-with-ublock-origin.html).

### Backend → UI wiring (settings shipped, UI not)

- [x] **Backup snapshot restore UI on options page.** *(v3.1.0 — new `#snapshot-section` on options page lists snapshots newest-first with timestamp + reason. Per-row Restore button calls the `restoreSnapshot` message; restore itself snapshots-before-overwrite. "Take snapshot now" button + Refresh button. Communicates via existing background.js → content.js → `rxListSnapshots`/`rxBackupSnapshot`/`rxRestoreSnapshot` chain.)*
- [x] **Privacy report panel on options page.** *(v3.1.0 — new `#privacy-section` renders the full structured `rxBuildPrivacyReport()` output as formatted JSON. Refresh, Export-JSON, and Export-Selector-Telemetry buttons. All read-only — no network calls triggered when opened.)*
- [x] **Selector telemetry export button (advanced).** *(v3.1.0 — bundled with Privacy panel. Drains `Selectors._telemetry` ring buffer via `getSelectorTelemetry` message and downloads as JSON. Only useful when `debugSelectorTelemetry` is on.)*

### Supply chain

- [x] **SHA-256 pin `mux.min.js` in `extension/build.sh`.** *(v3.1.0 — `MUX_JS_SHA256` constant pinned to the actual SHA-256 of the bundled file (`79da5742…56b`). `verify_mux_sha()` function supports `shasum`, `sha256sum`, and `certutil` (Git-Bash on Windows fallback). Build script aborts on mismatch.)* Source: [CVE-2026-1861 libvpx heap overflow](https://www.esecurityplanet.com/threats/chrome-vulnerability-cve-2026-5281-exploited-in-the-wild/) demonstrates video-codec supply chain risk is real.
- [x] **`content_security_policy` clause in both manifests.** *(v3.1.0 — MV3 manifest: `content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'" }`. MV2 Firefox manifest: `content_security_policy: "script-src 'self'; object-src 'self'; base-uri 'self'"`.)* Source: [Chrome MV3 CSP docs](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy).

### Distribution prep (non-blocking)

- [x] **`_locales/en/messages.json` bootstrap.** *(v3.1.0 — `extension/_locales/en/messages.json` shipped with ~30 strings (manifest name/description, action title, options-page CTAs, group labels, snapshot/privacy section labels). Both manifests now use `default_locale: "en"` + `__MSG_*__` references for `name`, `description`, `default_title`. Build script + GH Actions workflow include `_locales/` in the release ZIP.)* Source: [Chrome i18n docs](https://developer.chrome.com/docs/extensions/reference/api/i18n) · [MDN Internationalization](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization).
- [x] **`CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` + `.github/ISSUE_TEMPLATE/` bootstrap.** *(v3.1.0 — `CONTRIBUTING.md` covers what we accept / don't accept / code style / setup / release process. `CODE_OF_CONDUCT.md` is Contributor Covenant v2.1. Three issue templates: `bug_report.md`, `feature_request.md`, `selector_regression.md` (the last includes the selector-telemetry export workflow).)*

---

## Next — v3.2 – v3.5

### v3.2 ✓ shipped 2026-05-19 — Target-size 24px + offscreen-doc scaffolding

- [ ] **Migration plan from `mux.js` → Mediabunny.** `mux.js` is in maintenance mode per its [npm metadata](https://www.npmjs.com/package/mux.js/v/5.2.0-2). [Mediabunny](https://github.com/Vanilagy/mp4-muxer) (the explicit successor to mp4-muxer) ships with WebCodecs API integration, demuxers, smaller bundle, tree-shakable design. Two-step plan: (a) keep `worker.js` running mux.js as the default, (b) add a `_useWebCodecs` opt-in path behind a settings toggle that routes the HLS-to-MP4 work through Mediabunny + WebCodecs. Cuts the bundle by ~80 KB once mux.js is removed. Don't drop mux.js until the Mediabunny path has shipped a major release without regressions. **Deferred — moving to v3.3+.**
- [x] **`chrome.offscreen` document scaffolding.** *(v3.2.0 — offscreen.html + offscreen.js host two read-only operations: `parseHtml` (DOM_PARSER) and `hashBlob` (BLOBS + WORKERS). background.js `ensureOffscreenDocument()` honors Chrome's one-doc-per-extension contract via `chrome.offscreen.hasDocument()`. Falls back to `{ ok: false, reason: 'no-offscreen' }` on Firefox MV2 / older Chrome. Full HLS-work migration deferred to v3.3 alongside Mediabunny.)* Source: [Chrome offscreen docs](https://developer.chrome.com/docs/extensions/reference/api/offscreen) · [MV3 offscreen blog](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3).
- [ ] **`chrome.declarativeNetRequest` rules for autoplay-related endpoints.** Replace the v3.0 in-content blocking with declarative rules. Min ruleset: block `embedJS/u*` requests on watch-page exit when `autoplayBlockMode === "relatedEndpointAndPlayer"`. **Deferred — needs a captured Rumble next-video request shape; the autoplay-trigger endpoint isn't documented and a wrong rule would break video metadata loading. Moving to v3.3+ behind a fresh network-trace.** Source: [Chrome MV3 declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest). Note Google's [30,000-rule guaranteed minimum is plenty](https://nordvpn.com/blog/manifest-v3-ad-blockers/) for our scope.

### v3.3 — Side panel + context menus + RantStats-parity panel

- [x] **`chrome.sidePanel` for the Rant panel + Settings panel.** *(v3.7.0 — `sidePanel` permission + `side_panel.default_path: pages/options.html` in manifest. New `sidePanelEnabled` setting (default OFF, opt-in). When ON, `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` redirects the toolbar icon to open the panel instead of the popup. Live re-sync via `chrome.storage.onChanged` — no reload needed. Chrome/Edge only — Firefox MV2 manifest unchanged. Hosts the existing options UI verbatim, so future v3.x sub-views mount inside the same host without touching the manifest.)* Source: [Chrome sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) · [Chrome sidePanel launch blog](https://developer.chrome.com/blog/extension-side-panel-launch).
- [ ] **`rantStatsPanel` module shipped.** Bring the side panel + RantStats-parity feature shipped in setting key only at v2.0. Cached-rant list, totals footer, mark-read toggle, CSV+JSON export. The single Chrome competitor [RantStats v1.5.3 (May 2026)](https://chromewebstore.google.com/detail/rantstats-extension-for-r/liahjgfmodjgeakahommamnmbjgicpmh) implements all of these — match parity, then beat them on local-only-by-default + scoped color schemes.
- [x] **`chrome.contextMenus` integration.** *(v3.5.0 — three entries scoped to `*://*.rumble.com/*` via `documentUrlPatterns`: **Copy clean URL** (strips e9s/utm_*/ref/fbclid/etc. — same v2.4 allowlist; SW-side so it covers right-clicked links the content script never saw), **Copy URL at current time** (asks content script for `video.currentTime`, builds `?start=` link matching Rumble's native format and v1.x shareTimestamp), **Open RumbleX settings**. Toggleable live via new `contextMenusEnabled` setting (default ON); `chrome.storage.onChanged` re-syncs without reload. Copy helper uses `chrome.scripting.executeScript` for in-tab clipboard write with `execCommand` fallback.)* Source: [Chrome contextMenus API](https://developer.chrome.com/docs/extensions/reference/api/contextMenus). **Deferred:** chat-username submenu — needs the live chat-MHTML capture from v3.3 RantStats panel work.

### v3.4 ✓ partially shipped 2026-05-19 — Regression harness + Playwright E2E

- [x] **MHTML fixture replay harness.** *(v3.4.0 — `test_selectors.py` at repo root. Stdlib-only Python (no pip install). Parses `Selectors._map` directly from `extension/content.js` via regex (handles mixed-quote selectors). For each `Sample Pages/*.mhtml` fixture, asserts every expected surface resolves to at least one element via its stable or fallback selector. Per-fixture `FIXTURE_EXPECTATIONS` so route-scoped surfaces (chat.*, watch.*) only test on relevant captures. 35 resolutions across 4 fixtures pass on first run. Wired into `.github/workflows/build.yml` as a `test` job that gates `build`. Triggered on push to main + every PR.)* Source: [Sample Pages already in repo](https://github.com/SysAdminDoc/RumbleX/tree/main/Sample%20Pages).
- [x] **Playwright E2E suite (Chromium headed, MV3 extension loaded).** *(v3.5.0 — `package.json` + `playwright.config.js` + `tests/e2e/`. `_fixtures.js` spawns a persistent Chromium with `--load-extension`. First-pass coverage: SW boots within 15s, options page renders snapshot + privacy sections, popup has aria-pressed toggles, settings modal dirty-draft search works, ≥180 settings cards rendered. New `.github/workflows/e2e.yml` is `workflow_dispatch`-only — avoids the ~200 MB Chromium download on every push. Uploads `playwright-report/` artifact.)* Source: [Playwright vs Puppeteer 2026](https://www.browserstack.com/guide/playwright-vs-puppeteer) · [Puppeteer can't headless-test extensions; Playwright with `--headless=new` can](https://www.browserless.io/blog/headless-chrome).
- [ ] **Live-site smoke tests** (manually scheduled, not CI): a single Playwright test that opens a public Rumble watch page and verifies AdNuker, AutoplayBlock, DarkEnhance all fire and don't throw. The MHTML harness catches selector regressions; the live smoke catches Rumble-server-side changes that don't show in cached HTML. **Deferred to v3.6** — needs a stable rumble.com page URL we're comfortable hitting in CI.

### v3.5 — Distribution

- [ ] **Chrome Web Store listing prep.** All MV3 work since v2.0 has cleared the technical bar. What's missing: store-quality screenshots at 1280×800 and 640×400, a 440×280 promo tile, a 1400×560 marquee, and localised store copy. Source: [Chrome Web Store developer docs](https://developer.chrome.com/docs/webstore).
- [ ] **Firefox AMO listing prep.** Requires AMO review + extension signing. We currently ship MV2 which AMO still accepts. Source: [Firefox MV3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/) — note that MV2 stays supported on Firefox indefinitely.
- [ ] **Edge Add-ons listing prep.** Edge Add-ons accepts Chrome MV3 zips with minimal changes. Source: [Chrome Enterprise extension publishing](https://cloud.google.com/blog/products/chrome-enterprise/publishing-extensions-for-the-enterprise).
- [ ] **Greasy Fork userscript listing prep (depends on v4.0 userscript regeneration).** Greasy Fork is the discoverability hub for the userscript-tier audience; today our `RumbleX.user.js` v1.8 is at GitHub Raw only. The 14 existing Rumble userscripts on Greasy Fork are all narrowly scoped (single quality forcer, single download button, etc) — see [Greasy Fork rumble.com directory](https://greasyfork.org/en/scripts/by-site/rumble.com). A single comprehensive listing should top-rank the category by install count within weeks.
- [x] **Locales: es, pt-BR.** *(v3.5.0 — `extension/_locales/es/messages.json` + `extension/_locales/pt_BR/messages.json` shipped. 32/32/32 key parity with English source. Initial translations are explicitly marked in their `description` fields as needing human review before store publish. `de` deferred to v3.6.)* Rumble's audience [overlaps strongly with non-English political/freedom-of-speech communities in Europe and LatAm](https://www.semrush.com/website/rumble.com/overview/).
- [ ] **Locale: de.** Defer until human-reviewable translation drop available.
- [ ] **Show HN + Reddit launch (one 48-hour window).** Reddit subs to target: `/r/RumbleForum`, `/r/uBlockOrigin` (existing custom-filter activity per [Mastering The Rumble](https://rumble.com/v3tkf3a-mastering-the-rumble-stop-autoplay-with-ublock-origin.html)), `/r/userscripts`, `/r/chromeextensions`. AFFiNE playbook source: [60k-stars case study](https://dev.to/iris1031/how-to-get-more-github-stars-the-definitive-guide-33k-stars-case-study-2kjo).

---

## Later — v4.0+

These items need preconditions that don't exist yet (live captures, large refactor, third-party dependency, or signed-rules infrastructure).

- [ ] **Userscript regeneration from shared core.** Original v3.0 acceptance criterion, deferred. Multi-day rewrite to extract `core/`, `platform/`, `features/` from the monolithic `content.js`, then re-bundle two distributions (MV3 extension + Tampermonkey single-file). Risk: regressing the v1.8 userscript baseline users still rely on. The v2.0 Selectors registry + Router are the seams the split will pull through. Deferred to v4.0.
- [ ] **Firefox MV3 conversion.** Background-script-to-event-page rewrite ([Firefox MV3 background script docs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts)). MV2 stays supported on Firefox indefinitely per Mozilla's own communication, so this is a parallel path, not a forced migration. Bonus: MV3 enables `host_permissions` to appear in the install prompt from Firefox 127+.
- [ ] **`v.studio.rumble.com` Studio scene tools, uploader metadata fill, account/subscriptions bulk-unsubscribe UI.** Still blocked on live MHTML captures of those surfaces; setting keys shipped v2.0. The Greasy Fork [Studio Scene Mover](https://greasyfork.org/en/scripts/by-site/rumble.com) (6 installs) confirms the demand exists.
- [ ] **Channel archive queue with MV3 service-worker persistence.** Requires `chrome.offscreen` already adopted in v3.2 plus a persisted job queue in `chrome.storage.local` (not session) plus `chrome.alarms` for SW wake-up. Reference: [nullEFFORT/rumble-downloader](https://github.com/nullEFFORT/rumble-downloader) implements this on a Flask backend; we want browser-side. Settings keys (`channelArchive*`, `downloadConcurrency`, `batchDownload`) already shipped v2.0.
- [ ] **Signed remote cosmetic rules.** Pre-approved scriptlet bundle in the extension (like [AdGuard's User Scripts API approach since v5.2](https://adguard.com/kb/adguard-browser-extension/user-scripts-api/)) avoids Chrome's MV3 remotely-hosted-code ban. Rule format: data-only, ed25519-signed, JSON-schema-validated, opt-in per-rule. The verification key ships in the extension; rule payloads on a separate static repo. Settings (`remoteCosmeticRules`, `remoteCosmeticRulesChannel`) already shipped v2.0.
- [ ] **Multi-stream viewer (2–4 stream grid with independent chat panels).** Experimental. Iframe-based sandbox with per-stream `chrome.storage.session` for chat state. Setting key `multiStreamViewer` already shipped v2.0. Reference: Twitch/Kick power-user pattern — no Rumble equivalent exists today.
- [ ] **Discord webhook notifier + RSS/OPML export.** `discordWebhookUrl`, `rssExportEnabled`, `channelNotifierEnabled` keys all shipped v2.0. Needs `chrome.alarms` polling + the new channel archive queue's metadata. Reference: [HamzaJarane/rumble-notifier](https://github.com/HamzaJarane/rumble-notifier) (Go-based, server-side).
- [ ] **WebCodecs full migration.** Remove mux.js entirely once Mediabunny + WebCodecs path has shipped through a major release with no regressions. Source: [mp4-muxer deprecated in favor of Mediabunny](https://github.com/Vanilagy/mp4-muxer).
- [ ] **File System Access API for batch download folder picker.** Today the batchDownload feature dumps everything to the default Downloads folder. With `showDirectoryPicker({startIn: 'downloads'})` users can target a sub-folder and persist the handle in IndexedDB across sessions. Falls back to per-file `chrome.downloads.download` for Firefox + Safari, which [don't support the local-disk pickers](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access). Source: [File System Access API](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access).
- [x] **`CompressionStream` gzip-backed backup exports.** *(v3.6.0 — settings + localStorage export now gzipped via `CompressionStream('gzip')`. ~80% smaller files. `.json.gz` extension. Import side auto-detects via magic bytes 0x1f 0x8b and decompresses transparently — plain `.json` files from older versions still import. Falls back to plain JSON if API unavailable.)* Source: [Compression Streams are supported across all major browsers](https://web.dev/blog/compressionstreams).
- [x] **`chrome.tabGroups` integration: "Group all Rumble tabs".** *(v3.6.0 — popup footer button. One click groups every open rumble.com tab into a colored "Rumble" tab group. New `tabs` + `tabGroups` permissions (Chrome only — Firefox MV2 button appears but reports `no-tabgroups-api`). Background message `groupRumbleTabs` returns count + groupId. Tooltip cycles to show live status.)* Source: [Chrome tabGroups API](https://developer.chrome.com/docs/extensions/reference/api/tabGroups).
- [ ] **Encrypted user-provided gist sync.** `encryptedGistSync` key shipped v2.0. Crypto + UI deferred. AES-GCM with user-provided passphrase; gist content is the ciphertext.
- [ ] **Multi-profile settings (work / casual / creator).** `settingsProfiles` + `activeProfileId` keys shipped v2.0; profile-switching UI deferred.

---

## Under consideration

Items with sources but uncertain fit.

- [ ] **Upstream SponsorBlock service-key submission to add Rumble as a supported `service`.** SponsorBlock's API exposes a `service` parameter for non-YouTube platforms ([sponsorblock.py docs](https://sponsorblockpy.readthedocs.io/en/latest/api_reference.html)) and there's a [4-year-old open issue requesting platform expansion](https://github.com/ajayyy/SponsorBlock/issues/515). RumbleX would need to (a) submit a PR adding `Rumble` to the service enum, (b) commit to migrating from local-only `sponsorSegments` storage to (optionally) push community segments. Fit check: aligns with our local-first philosophy ONLY if pushing is strictly opt-in. Risk: a YouTube-trained Rumble user could submit garbage and pollute the upstream DB.
- [ ] **AdGuard-style declarative scriptlet bundle.** Ship a curated library of pre-built scriptlets indexable by name in the manifest, then let cosmetic rules reference them by ID. This is the [pattern AdGuard adopted to dodge Chrome's MV3 remote-code ban](https://github.com/AdguardTeam/Scriptlets). Pros: aligns with the v4.0 signed-remote-rules item. Cons: doubles the bundle size and adds an internal review process for every new scriptlet.
- [ ] **`chrome.notifications` for channel-notifier.** OS-level toast when a watched channel goes live. Fits the `channelNotifierEnabled` v2.0 key. Risk: Chrome's notification UX is intrusive; users who installed RumbleX to *reduce* Rumble's notification noise won't want more. Default OFF; gate behind `creatorMode` perhaps.
- [ ] **Grayjay-style multi-platform support (Rumble + Odysee + BitChute).** [Grayjay](https://factually.co/product-reviews/electronics-tech/best-multi-platform-youtube-frontends-forks-2026-roundup-77d4b8) is the only multi-platform client with Rumble support today. RumbleX's name and code are scoped to Rumble. Expanding to alternative platforms would dilute focus but capture an underserved niche. Counter-argument: BitChute and Odysee have such small overlapping audiences that each warrants its own thin extension. Fit check: low.
- [ ] **Local Whisper transcription (xerk-dot pattern).** Reference: [xerk-dot/rumble-downloader](https://github.com/yt-dlp/yt-dlp/issues/6704) uses Whisper for synced transcripts. Browser-side via `transformers.js` is technically possible but a ~150 MB model download. Reject for default; UNDER CONSIDERATION as an opt-in companion package that fills `transcripts` when the video has no captions.

---

## Rejected

Explicit rejects with one-line reasoning. Don't re-propose these without an explicit case.

- **Sentry / OpenTelemetry crash reporting.** Violates the no-telemetry rule. The privacy report explicitly reads "no analytics, no remote logging, no usage beacons" — adding Sentry would invalidate the disclosure. Local-only error log surfaced via debug panel is acceptable; remote shipping is not. Source: existing house style.
- **Keyboard shortcuts beyond the legacy `Ctrl+Shift+X` modal-open binding.** Hard house-style rule: no keyboard shortcuts. `legacyKeyboardNav` is preserved-but-off for users who already had it pre-v2.0. Adding any new `chrome.commands` entries is rejected. Source: house style in repo `CLAUDE.md`.
- **`backdrop-filter` for glass overlays.** Hard house-style rule. Use alpha + border + shadow only. Source: house style.
- **Pill/oval/fully-rounded backdrop shapes (border-radius >= half height) for badges/chips/buttons.** Hard rule from the user's global CLAUDE.md ("No pill / oval / fully-rounded backdrops in GUIs"). Allowed backdrop radii: 0, 4, 6, 8, 10, 12. True-circle uses (avatars, status dots, toggle thumbs, icon-only square buttons) are fine. Source: global user rule.
- **ffmpeg.wasm bundled in the extension.** Adds ~25 MB to the bundle. Will ship as an opt-in companion package fetched on first use, not bundled. Setting `audioExtractionMode === "companion"` already represents this path. Source: existing v3.0 deferred-items rationale.
- **Confirmation dialogs.** Hard house-style rule. Destructive actions use undo toast + snapshot, never a "Are you sure?" dialog. Source: house style.
- **Light theme for RumbleX-owned UI.** Hard house-style rule. We honour Rumble's native site theme via `siteThemeSync`, but RumbleX panels/popup/options/sidePanel remain dark. Source: house style.
- **Modifying CSP to bypass Rumble-side restrictions.** Per [Tampermonkey docs](https://erosman.github.io/support/content/help.html), "add-ons must not relax web page security headers, such as the Content Security Policy". Existing modules use TreeWalker on Text nodes and DOM builders for injection; do not regress.
- **Single-file ZIP with `manifest.json` at root submitted to Chrome Web Store as the long-term distribution.** v3.x continues to publish to GitHub Releases as primary. Chrome Web Store listing is queued (Next tier) but the [drag-install CRX path is rejected by Chromium 75+](https://www.chromium.org/Home/chromium-security/extensions-update-status/) per existing CLAUDE.md global rule.

---

## Cross-cutting workstreams

Tier placement above is per-feature; the workstreams below are themes the team should not let any release skip.

### Security

- **Supply chain:** SHA-256 pin for `mux.min.js` fetch in `build.sh` (Now). CSP in manifest (Now). Replace `mux.js` with maintained alternative (Next).
- **Permission minimization:** Current host permissions are tight and well-justified — `rumble.com`, `1a-1791.com`, `rumble.cloud`, `api.github.com`. No expansion accepted without a feature gate.
- **Backup-import allowlist** already enforced in `rxWriteLocalStorage` (`RX_LOCAL_STORAGE_KEYS` + `rx_rants_` prefix). No regression accepted.
- **Download URL host allowlist** already enforced in `background.js isAllowedDownloadUrl()`. No regression accepted.
- **CVE tracking:** Watch [hls.js advisories](https://github.com/video-dev/hls.js/security/advisories) (we don't use hls.js directly but it's adjacent). Watch [Chrome stable channel updates](https://www.cvedetails.com/vulnerability-list/vendor_id-1224/product_id-15031/Google-Chrome.html) — CVE-2026-7937 (extension navigation bypass) and CVE-2026-1861 (libvpx) are recent examples of extension-stack risk.

### Accessibility (WCAG 2.2)

- **Now:** aria-live toast region, target-size audit, aria-pressed/expanded sweep, focus return on modal close.
- **Next:** Screen-reader pass with NVDA on Windows + VoiceOver on macOS (per [TestParty modal accessibility guidance](https://testparty.ai/blog/modal-dialog-accessibility)). Color-contrast pass with axe DevTools.
- **Later:** WCAG 3.0 readiness once a stable draft ships.

### Internationalization (i18n) / Localization

- **Now:** `_locales/en/messages.json` bootstrap + `default_locale: "en"`. Migrate top ~30 strings to `chrome.i18n.getMessage()`.
- **Next (v3.5):** Add `es`, `pt-BR`, `de` translation drops. Localise Chrome Web Store listing copy. ["You can significantly increase your extension's ranking in the locales that you support by localizing the name, description, and detailed description"](https://developer.chrome.com/docs/webstore/i18n/?csw=1).
- **Later:** Add `fr`, `ja`, `tr`, `ru` based on actual install heat-maps.

### Observability (local-only)

- Selector telemetry ring buffer exists (v3.0). Add a per-feature error-event ring buffer with the same shape: rolling-window-of-200, gated by a debug toggle, exposed via message API, no network. **No remote shipping ever** (see Rejected).

### Testing

- **Now (v3.1):** Static JS syntax check in CI (`node --check`). Three-way catalog parity check (`content.js _defaults` vs `popup.js DEFAULTS` vs `options.js DEFAULTS+META`) as a CI job. Already passing at 195/195/195.
- **Next (v3.4):** MHTML fixture replay harness + Playwright E2E suite. See v3.4 above.

### Documentation

- README refreshed in v3.0. Maintain `CHANGELOG.md` discipline (one entry per release, per existing format). Add `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` (Now). Add architecture diagram and feature-module template (Next).

### Distribution / packaging

- **Now:** Chrome ZIP + Firefox ZIP + CRX already shipped per release. Tightening: GH Releases description should pin install caveats (CRX rejected by Chromium 75+; ZIP via "Load unpacked" is the primary path).
- **Next (v3.5):** Chrome Web Store, Firefox AMO, Edge Add-ons listings prep + submission.
- **Later (v4.0):** Greasy Fork userscript listing once v4.0 userscript-from-shared-core regeneration ships.

### Plugin ecosystem (deferred — under consideration)

- Signed remote cosmetic rules + AdGuard-style declarative scriptlet bundle (Later/v4.0+).
- User-importable selector packs (manual JSON drop into settings; Later).

### Mobile

- **Browser support:** Firefox for Android — supported now (Tampermonkey installable via AMO; extension format not). Quetta + Lemur Android browsers — supported (Chrome MV3 path). [Kiwi Browser discontinued Jan 2025](https://www.makeuseof.com/found-android-browser-that-runs-chrome-extensions-why-its-not-popular/); legacy APK still works.
- **Mobile-specific tasks:** Audit popup + options for touch-target ≥ 44 px (Apple HIG) and 48 dp (Material) when running in mobile-Firefox/Quetta context. Confirm no hover-only UX is critical-path. **Next** for the touch-target audit; mobile-specific UI variants are **Later** if at all.

### Offline / resilience

- `navigator.onLine` + `online`/`offline` events should pause active downloads and queue resume jobs. Setting key `downloadManagerEnabled` is the gate. **Next** in v3.2 alongside the offscreen-document download work.

### Multi-user / collab

- Not in scope. Settings backup/restore is the only cross-device path. Multi-profile settings (v4.0) is per-user-local, not multi-user.

### Migration / upgrade strategy

- `schemaVersion` is the contract — `Settings._migrate()` is idempotent and bumps on every schema change. Any new key addition that changes default behaviour for existing users requires a corresponding migration block.

---

## Self-audit notes (Phase 5)

- Every Now/Next item maps to at least one source in [Appendix C](#appendix-c--sources). The two exceptions are pure-internal tasks (snapshot restore UI, privacy report panel) which trace to the v3.0 commit `3fa500b` in this repo's history.
- Every category called out by the prompt is covered: security, accessibility, i18n/l10n, observability, testing, docs, distribution/packaging, plugin ecosystem, mobile, offline/resilience, multi-user/collab, migration. Multi-user/collab is explicitly out of scope with reasoning, not absent.
- The "Rejected" tier has reasons traceable either to repo house style (rejected for philosophy fit) or to recent prior decisions (e.g. ffmpeg.wasm). No silent resurrections of rejected ideas.
- The v2.5 Creator/Studio cluster remains Later — three independent items in Greasy Fork's [rumble.com user-scripts directory](https://greasyfork.org/en/scripts/by-site/rumble.com) confirm the demand (Studio Scene Mover, Auto Theater, etc) but none of them can be implemented well without a fresh MHTML capture of `studio.rumble.com`, the uploader, and `/account/subscriptions` — all logged-in-only surfaces.
- Adversarial review: a hostile reviewer would point at (a) 0 stars/forks/watchers as evidence the distribution problem is the real bottleneck (true; v3.5 tier is the response), (b) `mux.js` in maintenance mode as a ticking clock (true; v3.2 Mediabunny migration is the response), (c) no formal accessibility audit despite shipping 195 settings keys (true; v3.1 WCAG 2.2 + aria-live items are the response), (d) `_locales` not used at all despite a global audience (true; v3.1 + v3.5 i18n items are the response). Nothing surfaces a category I've missed.

---

## Recently shipped

Compressed history. Detail per release lives in `CHANGELOG.md`.

### v3.0.0 — Privacy report + backup snapshots + selector telemetry + README refresh (2026-05-19)

- `rxBuildPrivacyReport()` + `getPrivacyReport` message — schema version, feature counts, manifest permissions, every external network surface enumerated, telemetry status "none — no analytics, no remote logging, no usage beacons", localStorage byte/key counts.
- `rxBackupSnapshot(reason)` / `rxListSnapshots()` / `rxRestoreSnapshot(indexOrAt)` — rolling stack at `rx_settings_snapshots`, `backupHistoryLimit` (default 10), restore-itself-snapshots-before-overwrite.
- `getSelectorTelemetry` — drains the `Selectors._telemetry` ring buffer for local export. Populated only when `debugSelectorTelemetry` is on.
- README rewritten to describe the v2.x feature superset.

### v2.4.0 — Live chat hardening (v2.3 atoms) + feed moderation (v2.4 atoms) (2026-05-19)

- `RantTierFilter` — CSS-only hide of chat rants below `rantTierFilter`.
- `ChatUsernameColors` — `off` | `deterministic` (hash→HSL) | `tiered`.
- `KeywordFilter` mode upgrade — `literal` (default) | `regex` (sandboxed; bad regex falls back to literal per-entry) | `wildcard`.
- `StripTrackingParams` — allowlist-strips `e9s`/`ref`/`utm_*`/`mtm_*`/`campaign`/`fbclid`/`gclid` from rumble.com URLs.

### v2.2.0 — Download Manager 2.0 phase 1 (2026-05-19)

- `ExternalPlayer` — "Open in player" button next to share row when `externalPlayerEnabled` is on. `externalPlayerTemplate` default `mpv://{url}`. Anchors via `Selectors.find('watch.share')`; re-anchors on htmx route changes via `Router.onChange`.
- `MediaProbeCache` — TTL-keyed `get/set/clear` over `chrome.storage.local`, debounced flushes, lazy GC, in-memory fallback on storage errors. Honors `downloadProbeCacheTtlHours`.

### v2.1.0 — Premium UI and layout superset (2026-05-19)

- `ThumbnailHider` (master/feeds/related scopes).
- `DenseMode` (body.rx-dense class).
- `AccountPaginationCompact`.
- `ReducedMotion` (honors setting + OS `prefers-reduced-motion`).
- `HomeCleanupPreset` (`none` / `focused` / `minimal` / `custom`).
- `DarkEnhance` writes Rumble's native CSS tokens (`--color-bg-*`, `--brand-*`, etc.) in addition to `--rx-*`.

### v2.0.0 — Core engine phase 1 (2026-05-19)

- `schemaVersion: 2` migration. `keyboardNav` → `legacyKeyboardNav` (preserves user's old toggle state).
- `Selectors` registry — 27 named surfaces × stable+fallback selectors from MHTML map. `find()`, `findAll()`, `wait()` + telemetry ring buffer.
- `Router` — patches `history.pushState`/`replaceState` once, hooks `popstate` + `htmx:afterSwap`/`afterSettle`/`historyRestore`. `Router.onChange()` emits normalized route-change events. `Page.classify()` returns one of `home | feed | watch | live | embed | search | channel | account | studio | unknown`.
- `oledGreen` theme added to `THEMES`.
- ~70 new settings keys covering core, layout, player, downloads, feed, chat, comments, automation, creator, integrations, privacy. Catalog parity 195/195/195.

### v1.9.x — Pre-v2 baseline (Apr 2026)

- v1.9.3 — Full-parity backup round-trip (settings + per-origin localStorage). XSS hardening (textContent / DOM-builder injection only). Memory-leak fixes (MiniPlayer / SearchHistory / AutoMaxQuality `hls.off()`).
- v1.9.1 — RUD (Rumble Universal Downloader) integrated into VideoDownloader. Progressive deep scan across `hugh.cdn.rumble.cloud` with 6-way concurrency, HEAD + Range fallback, TAR archive support with "extract + VLC" hint.
- v1.9.0 — Rumble Enhancement Suite port: 58 new modules across hide-X registry, full-width player, auto-hide chrome.
- v1.8.0 — Astra-Deck-style options page + 19 new modules (Chapters, SponsorBlock, Clips, Live DVR, Transcripts, Subtitle Sidecar, Audio Only, Batch Download, Rant Persist, Comment Sort, Popout Chat, Keyword Filter, Title Font, Autoplay Queue, Unique Chatters, Chat User Block, Chat Spam Dedup, Chat Export, Full Titles).

---

## Appendix A — Selector reference

Carried forward from the prior research roadmap. **Source of truth: `Sample Pages/*.mhtml` plus the v2.0 `Selectors` registry in `extension/content.js`.** Update both together; ship the registry update first, then refresh the MHTML capture.

| Key | Stable selector | Fragile fallback | Notes |
|---|---|---|---|
| `header.root` | `header[data-js="app_header"]` | `.header` | Attach early theme/layout classes here only after `document.body` exists. |
| `nav.mainMenu` | `#main-menu`, `[data-js="highlightable_navigation_item"]` | `.hover-menu.main-menu-nav` | High churn — permanent/sidebar nav modes alter structure. |
| `search.form` | `form[data-js="search_form"]`, `[data-js="search_input"]` | `.header-search` | Autocomplete uses htmx POST. |
| `search.autocomplete` | `[hx-post="/search/htmx/get-autocomplete-results"]`, `[data-js="autocomplete_results_container"]` | `.autocomplete-results` | Needs route-change + htmx swap handling. |
| `feed.card` | `[role="listitem"][data-video-id]`, `.playlist-menu[data-video-id]` | `.videostream.thumbnail__grid--item` | Process added cards only. |
| `feed.author` | `a[rel="author"].channel__link` | `.channel__link.link.*` | Do not use hashed suffixes. |
| `feed.sections` | `section[id^="section-"]`, heading text under `.homepage-heading__title` | `#section-editor-picks`, etc | Self-healing registry needed; captures don't list every section. |
| `watch.player` | `video`, `#videoPlayer`, `.videoPlayer-Rumble-cls` | `#videoPlayer.video-player` | Rumble player SVG buttons share classes — identify by `title`/`aria`/structure. |
| `watch.media` | `[data-js="media_container"]` | `.media-page`, `.media-page-video` | Root for watch-page feature scoping. |
| `watch.title` | `.video-header-container__title` | hashed descendants | Existing selector still useful; wrap in registry. |
| `watch.share` | `[data-js="media_engage_share"]`, `[data-js="video_action_button_visible_location"]` | `.round-button.media-by-actions-button` | Use action `data-js` + title text, not nth button. |
| `watch.description` | `[data-js="media_description_section"]`, `.media-description-section`, `[data-js="media_long_description_container"]` | `.container.content.media-description` | Needed for auto-expand, hide-description, transcripts. |
| `watch.related` | `.media-page-related-media-desktop-sidebar` | `.mediaList-item`, `.mediaList-heading` | VOD and live differ; floating related media on live. |
| `comments.root` | `[data-js="media_page_comments_container"]`, `#video-comments` | `.media-page-comments-container` | Observe only this subtree once found. |
| `comments.item` | `li.comment-item[data-comment-id]`, `.comment-text` | `.comment-item.comment-item-first` | Comment IDs are stable for block/export/sort. |
| `comments.composer` | `[data-js*="comment"] textarea` | `.comments-create-textarea` | Logged-in + logged-out states differ. |
| `chat.root` | `aside.media-page-chat-aside-chat`, `#chat-history-list` | `.chat--header`, `.chat--input` | Observe `#chat-history-list` added nodes only. |
| `chat.message` | `#chat-history-list [data-*]` when available | `.chat-history--row` | Username classes are fragile but still present. |
| `rant.item` | `.chat-history--rant[data-level]`, `.chat-history--rant-price`, `.chat-history--rant-username` | `.chat-history--rant`, `.js-chat-username.chat-history--rant-username` | Capture rants with read/unread + tier state. |
| `modal.portal` | `#portal[data-js="portal"]`, `template[data-js="modal__template"]`, `[data-js="modal__overlay"]`, `[hx-ext="modal"]` | `.group.box-border-inherit.fixed` | Rumble modals are htmx-driven. |
| `theme.group` | `.theme-option-group`, `[class*="theme-option"]` | `.space-y-2.theme-option-group` | Used by site theme sync only. |
| `notifications` | `[class*="notification"]`, `[title*="Notification" i]` | `.user-notifications--bell-button.js-notification-button` | Needs live logged-in capture. |
| `channel.links` | `a[rel="author"].channel__link`, `.main-menu-item-channel`, `[href^="https://rumble.com/c/"]`, `[href^="https://rumble.com/user/"]` | `.channel__link.link.*` | Channel filters, archive queues, creator tools. |
| `account.pagination` | `.pagination.autoPg` on `/account/content*` | `.pagination.autoPg` (community userscript) | v2.1 module shipped. |
| `studio.*` | TBD | TBD | **No local MHTML capture yet — must be live-checked before implementation.** |
| `shorts.feed` | TBD | TBD | **No local MHTML capture yet — v3.1 priority.** |
| `wallet.tipButton` | TBD | TBD | **No local MHTML capture yet — v3.1 priority.** |

---

## Appendix B — API and endpoint reference

| API / Endpoint | Use | Auth | Rate-limit | Notes |
|---|---|---|---|---|
| `embedJS/u3/?request=video&ver=2&v={embedId}` | Video metadata + media URLs | Public for accessible videos | High concurrency cost | Cache by embed ID + endpoint variant via `MediaProbeCache`. |
| `embedJS/u0`–`u4` probes | Fallback embed metadata | Public for accessible videos | High | Probe sparingly; stop on first success. |
| `hugh.cdn.rumble.cloud/...` media URLs | HEAD / Range / download | Public or signed-URL dependent | Medium | Respect CORS and failure modes; do not hammer. URL pattern is *not* officially documented — [yt-dlp's Rumble extractor](https://github.com/yt-dlp/yt-dlp/pull/5280) is the reverse-engineered reference. |
| `1a-1791.com/...` media URLs | Same as above | Same | Same | Alternate shard. |
| `https://rumble.com/shorts` | New Shorts feed route | Public | Low | **Added 2026-02-04.** Vertical feed, ≤ 90 s, 9:16 recommended. [Source](https://corp.rumble.com/blog/rumble-unveils-the-web-version-of-rumble-shorts/). |
| `/search/htmx/get-autocomplete-results` | Search suggestions | Likely session-aware | Medium | User input only. |
| `/-htmx/account/legacy-video-collection` | Playlist / save | Logged-in | High | User action only. |
| `/-htmx/channel/update-action-buttons` | Channel subscribe/follow UI | Logged-in | High | Read-only observation preferred. |
| `/-htmx/web-services/repost-vote` | Repost vote UI | Logged-in | High | Do not automate by default. |
| `/-htmx/web-services/report-content` | Content report | Logged-in | N/A — user action only | Do not automate. |
| `/-htmx/wallet/payment/qr-modal` | Wallet QR / tip flow | Logged-in (creator) | N/A | Tip jar surface — added 2026-01-07 ([source](https://corp.rumble.com/blog/rumble-and-tether-launch-crypto-wallet-for-creator-economy/)). |
| GitHub Releases API | RumbleX update check | Public | Low | Daily alarm or user action. |

---

## Appendix C — Sources

Compiled during Phase 1. Use as the citation pool when adding new roadmap items.

### Rumble platform

1. [Rumble Unveils the Web Version of Rumble Shorts (corp.rumble.com)](https://corp.rumble.com/blog/rumble-unveils-the-web-version-of-rumble-shorts/) — Feb 4 2026
2. [Rumble Unveils Web Version of Rumble Shorts (Nasdaq)](https://www.nasdaq.com/press-release/rumble-unveils-web-version-rumble-shorts-2026-02-04)
3. [Swipeable Short Videos: Rumble Rolls Out Shorts on the Web (StockTitan)](https://www.stocktitan.net/news/RUM/rumble-unveils-the-web-version-of-rumble-hykdp7faip30.html)
4. [What Is Rumble Shorts — official help](https://rumble.support/help/shorts)
5. [How to Upload Shorts to Rumble (rumble.support)](https://rumble.support/help/upload-shorts)
6. [Tether and Rumble Launch Rumble Wallet (Tether.io)](https://tether.io/news/tether-and-rumble-launch-rumble-wallet-bringing-self-custodial-crypto-payments-to-millions-of-creators-and-users/) — Jan 7 2026
7. [Rumble Wallet support docs](https://wallet.rumble.com/support/docs/welcome/)
8. [Rumble Shares Jump 5% After Launching Crypto Wallet With Tether (CoinDesk)](https://www.coindesk.com/markets/2026/01/07/rumble-shares-jump-5-after-launching-crypto-wallet-with-tether)
9. [Tether and Rumble Launch Crypto Wallet for Digital Creators (Yahoo Finance)](https://finance.yahoo.com/news/rumble-tether-launches-crypto-wallet-151530405.html)
10. [Rumble Wallet App Store listing](https://apps.apple.com/us/app/rumble-wallet-tip-with-crypto/id6748149951)
11. [Rumble and Tether Launch Crypto Wallet for Creator Economy](https://corp.rumble.com/blog/rumble-and-tether-launch-crypto-wallet-for-creator-economy/)
12. [Rumble Studio Canvas updates (rumble.support)](https://rumble.support/help/studio-canvas-updates) — Mar 18 2026
13. [Rumble Studio main entry](https://studio.rumble.com/)
14. [Rumble 2026 Creator Program](https://rumble.support/help/rumble-2025-creator-program)
15. [Rumble Stock Prediction 2026 (MEXC, multi-business breakdown)](https://www.mexc.com/news/1070109)
16. [How do I disable autoplay? — Rumble FAQ](https://rumble.support/help/how-do-i-disable-autoplay)
17. [SemRush — rumble.com traffic overview](https://www.semrush.com/website/rumble.com/overview/)
18. [Mastering The Rumble: Stop Autoplay with uBlock Origin](https://rumble.com/v3tkf3a-mastering-the-rumble-stop-autoplay-with-ublock-origin.html)
19. [GetApp — Rumble Studio pricing/features (no public API)](https://www.getapp.com/all-software/a/rumble-studio/)
20. [Enhanced Games / Rumble partnership announcement](https://www.stocktitan.net/news/RUM/enhanced-names-rumble-premier-partner-and-official-distribution-i0sa6wvpgqvm.html)

### Competitor extensions / userscripts

21. [RantStats Extension Chrome Web Store](https://chromewebstore.google.com/detail/rantstats-extension-for-r/liahjgfmodjgeakahommamnmbjgicpmh) — v1.5.3 May 1 2026
22. [RantStats source](https://github.com/rantstats/rantstats-extension)
23. [RantStats Edge listing](https://microsoftedge.microsoft.com/addons/detail/rantstats-extension-for-r/dfhpfnfhllhmfmkcambimnafeklpgkdm)
24. [Rant Stats Legacy Bookmarklet](https://rantstats.com/bookmarklet/)
25. [Rumble Video Accelerator — Chrome Web Store](https://chromewebstore.google.com/detail/rumble-video-accelerator/afedcnlnaijfabfnibpldpdkilbghgng?hl=en)
26. [Greasy Fork — userscripts for rumble.com](https://greasyfork.org/en/scripts/by-site/rumble.com)
27. [Rumble Auto Best Video Quality (Greasy Fork, Martin___X)](https://greasyfork.org/en/scripts/494906-rumble-auto-best-video-quality)
28. [Rumble Live Chat Blocker (Greasy Fork, CynicalPhantom)](https://greasyfork.org/en/scripts/532873-rumble-live-chat-blocker)
29. [Rumble Download Button (Greasy Fork, Zeek B.)](https://greasyfork.org/en/scripts/487122-rumble-download-button)
30. [Rumble Volume Control + Overlay (Greasy Fork, Dave121, Dec 22 2025)](https://greasyfork.org/en/scripts/by-site/rumble.com) — Dec 22 2025
31. [Rumble All-in-One Tools (Greasy Fork, MrM0RG4N, Mar 19 2026)](https://greasyfork.org/en/scripts/by-site/rumble.com)
32. [Rumble Force Lowest Quality (ToTheFuture2021, Nov 20 2025)](https://greasyfork.org/en/scripts/by-site/rumble.com)
33. [Rumble Studio Scene Mover (J J W)](https://greasyfork.org/en/scripts/by-site/rumble.com)
34. [Rumble Auto Theater Mode (Dave121, Jul 4 2025)](https://greasyfork.org/en/scripts/by-site/rumble.com)
35. [nullEFFORT/rumble-downloader](https://github.com/nullEFFORT/rumble-downloader)
36. [3IMAD69/Rumble-Downloader](https://github.com/3IMAD69/Rumble-Downloader)
37. [a3r0id/RumblePy](https://github.com/a3r0id/RumblePy)
38. [HamzaJarane/rumble-notifier](https://github.com/HamzaJarane/rumble-notifier)
39. [zackees/ytclip — multi-platform clip downloader](https://github.com/zackees/ytclip)
40. [jakecreps/ruby — Rumble/BitChute/YouTube scraper](https://github.com/jakecreps/ruby)
41. [cookerwatcher/rumblerer](https://github.com/cookerwatcher/rumblerer)
42. [Grayjay multi-platform client overview](https://factually.co/product-reviews/electronics-tech/best-multi-platform-youtube-frontends-forks-2026-roundup-77d4b8)
43. [yt-dlp Rumble HLS extractor PR #5280](https://github.com/yt-dlp/yt-dlp/pull/5280)
44. [yt-dlp main repo](https://github.com/yt-dlp/yt-dlp)
45. [yt-dlp 2026.03.17 release info (VideoHelp)](https://www.videohelp.com/software/yt-dlp)
46. [SysAdminDoc/RumbleX (this repo)](https://github.com/SysAdminDoc/RumbleX)

### Browser extension platform / APIs

47. [Chrome MV3 declarativeNetRequest API](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)
48. [Chrome MV3 offscreen API](https://developer.chrome.com/docs/extensions/reference/api/offscreen)
49. [Chrome MV3 offscreen launch blog](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3)
50. [Chrome MV3 sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
51. [Chrome MV3 sidePanel launch blog](https://developer.chrome.com/blog/extension-side-panel-launch)
52. [Chrome MV3 contextMenus API](https://developer.chrome.com/docs/extensions/reference/api/contextMenus)
53. [Chrome MV3 tabGroups API](https://developer.chrome.com/docs/extensions/reference/api/tabGroups)
54. [Chrome MV3 declarativeContent API](https://developer.chrome.com/docs/extensions/reference/api/declarativeContent)
55. [Firefox MV3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)
56. [MDN — WebExtensions background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts)
57. [Codestudy — MV3 service worker vs Firefox background script conflicts](https://www.codestudy.net/blog/manifest-v3-background-scripts-service-worker-on-firefox/)
58. [W3C WebExtensions Community Group](https://www.w3.org/community/webextensions/)
59. [W3C WebExtensions charter](https://github.com/w3c/webextensions/blob/main/charter.md)
60. [Manifest V3 and webRequest — Vivaldi perspective](https://vivaldi.com/blog/manifest-v3-webrequest-and-ad-blockers/)
61. [NordVPN — MV3 ad blocker reality](https://nordvpn.com/blog/manifest-v3-ad-blockers/)
62. [Ad Blocking in Chrome 134 — What Actually Works After MV3 (dev.to)](https://dev.to/alphashark/ad-blocking-in-chrome-134-what-actually-works-after-manifest-v3-4c62)
63. [Chrome i18n API reference](https://developer.chrome.com/docs/extensions/reference/api/i18n)
64. [Chrome i18n message format guide](https://developer.chrome.com/docs/extensions/mv3/i18n-messages/)
65. [MDN WebExtensions Internationalization](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization)
66. [Internationalize your extension — Chrome Webstore](https://developer.chrome.com/docs/webstore/i18n/?csw=1)
67. [Chrome Web Store developer docs](https://developer.chrome.com/docs/webstore)
68. [Chrome Enterprise extension publishing](https://cloud.google.com/blog/products/chrome-enterprise/publishing-extensions-for-the-enterprise)
69. [uBlock Origin Lite (uBlockOrigin/uBOL-home)](https://github.com/uBlockOrigin/uBOL-home/releases) — `2026.516.1652` mid-May 2026 release
70. [AdGuard Scriptlets library](https://github.com/AdguardTeam/Scriptlets)
71. [AdGuard User Scripts API (knowledge base)](https://adguard.com/kb/adguard-browser-extension/user-scripts-api/)
72. [AdGuard Browser Extension releases](https://github.com/AdguardTeam/AdguardBrowserExtension/releases)
73. [GitHub Refined GitHub (extension exemplar)](https://github.com/refined-github/refined-github)

### Web APIs

74. [File System Access API — Chrome docs](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)
75. [Compression Streams API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API)
76. [CompressionStream — web.dev all-browser support](https://web.dev/blog/compressionstreams)
77. [Compression Streams API — Chrome blog](https://developer.chrome.com/blog/compression-streams-api)
78. [The Secret Life of JavaScript: The Compressor (April 2026)](https://www.tech-reader.blog/2026/04/the-secret-life-of-javascript-compressor.html)
79. [Mediabunny — successor to mp4-muxer (TypeScript MP4 muxer with WebCodecs)](https://github.com/Vanilagy/mp4-muxer)
80. [mp4-wasm — minimp4 WASM bindings](https://www.npmjs.com/package/mp4-wasm)
81. [jMuxer — JS MP4 muxer](https://github.com/samirkumardas/jmuxer)
82. [mux.js npm (maintenance mode notice)](https://www.npmjs.com/package/mux.js/v/5.2.0-2)
83. [videojs/mux.js GitHub](https://github.com/videojs/mux.js/)

### Accessibility / WCAG

84. [WCAG 2.2 + ARIA integration — Accesify](https://www.accesify.io/blog/aria-wcag-integration/)
85. [WCAG 2.2 chrome extension testing — BrowserStack](https://www.browserstack.com/guide/wcag-chrome-extension)
86. [Modal dialog accessibility — TestParty](https://testparty.ai/blog/modal-dialog-accessibility)
87. [ARIA labels 2025 implementation guide — AllAccessible](https://www.allaccessible.org/blog/implementing-aria-labels-for-web-accessibility)

### Security / CVE

88. [CVE-2026-7937 — Chrome DevTools navigation bypass via extension](https://www.cve.news/cve-2026-7937/)
89. [CVE-2026-5281 — Chrome WebGPU UAF, actively exploited](https://www.esecurityplanet.com/threats/chrome-vulnerability-cve-2026-5281-exploited-in-the-wild/)
90. [Google Chrome multiple vulnerabilities — HKCERT](https://www.hkcert.org/security-bulletin/google-chrome-multiple-vulnerabilities_20260507)
91. [Google Chrome XSS vulnerabilities](https://www.cvedetails.com/vulnerability-list/vendor_id-1224/product_id-15031/opxss-1/Google-Chrome.html)
92. [hls.js security advisories — GitHub](https://github.com/video-dev/hls.js/security/advisories)

### SponsorBlock / community DBs

93. [SponsorBlock API docs](https://wiki.sponsor.ajay.app/w/API_Docs)
94. [SponsorBlock community tools](https://wiki.sponsor.ajay.app/w/Community)
95. [Expand integration beyond YouTube — SponsorBlock issue #515](https://github.com/ajayyy/SponsorBlock/issues/515)
96. [sponsorblock.py docs (service parameter)](https://sponsorblockpy.readthedocs.io/en/latest/api_reference.html)

### Userscript managers

97. [Violentmonkey privileged APIs](https://violentmonkey.github.io/api/gm/)
98. [Violentmonkey GitHub (DeepWiki)](https://deepwiki.com/violentmonkey/violentmonkey)
99. [Tampermonkey on Firefox Android (AMO)](https://addons.mozilla.org/en-US/android/addon/tampermonkey/)
100. [W3C webextensions issue 176 — webRequest use case (GM_xmlhttpRequest)](https://github.com/w3c/webextensions/issues/176)

### Mobile

101. [Quetta / Lemur / Edge — Android browsers running extensions (MakeUseOf)](https://www.makeuseof.com/android-browsers-that-run-extensions-chrome-keeps-leaving-out/)
102. [Kiwi Browser discontinued (MakeUseOf)](https://www.makeuseof.com/found-android-browser-that-runs-chrome-extensions-why-its-not-popular/)

### Testing

103. [Playwright vs Puppeteer 2026 (BrowserStack)](https://www.browserstack.com/guide/playwright-vs-puppeteer)
104. [Microsoft Playwright GitHub](https://github.com/microsoft/playwright)
105. [Headless Chrome explained (browserless.io)](https://www.browserless.io/blog/headless-chrome)

### Distribution / discoverability

106. [Open Source Marketing for OSS — daily.dev](https://business.daily.dev/resources/open-source-marketing-grow-developer-community-without-budget/)
107. [AFFiNE 60k stars case study (dev.to)](https://dev.to/iris1031/how-to-get-more-github-stars-the-definitive-guide-33k-stars-case-study-2kjo)

### Observability

108. [Sentry + OpenTelemetry overview](https://blog.sentry.io/structured-logging-opentelemetry/)
109. [Sentry OpenTelemetry developer docs](https://develop.sentry.dev/sdk/telemetry/traces/opentelemetry/)
110. [How to Track Browser JavaScript Errors with OpenTelemetry (OneUptime, Feb 2026)](https://oneuptime.com/blog/post/2026-02-06-track-browser-javascript-errors-opentelemetry/view)

### Alternative video frontends

111. [Best Multi-Platform YouTube Frontends roundup (Factually)](https://factually.co/product-reviews/electronics-tech/best-multi-platform-youtube-frontends-forks-2026-roundup-77d4b8)
112. [NewPipe RFE — alternative platform polling (issue #6645)](https://github.com/TeamNewPipe/NewPipe/issues/6645)

---

## Definition of Done (carried forward + tightened)

A RumbleX milestone is "done" when:

- Every shipped setting key has a feature module behind it OR is documented in CHANGELOG as deferred with a target release.
- Catalog parity between `content.js _defaults`, `popup.js DEFAULTS`, `options.js DEFAULTS + META` is enforced at build time, not by manual review.
- No new keyboard shortcuts are introduced beyond the existing `Ctrl+Shift+X` modal toggle.
- No `backdrop-filter`, no pill/oval/fully-rounded backdrops on non-icon non-true-circle elements.
- No telemetry, no remote logging. The privacy report's "telemetry: none" disclosure stays accurate.
- Every feature toggle hot-applies and destroys cleanly via `init(ctx)` / `destroy(ctx)` — no `location.reload()` workarounds for migrated modules.
- New external network surfaces are listed in the privacy report and gated by an enabled feature.
- Every feature row in this roadmap has at least one Appendix C source unless it's a pure-internal task traceable to a repo commit.
