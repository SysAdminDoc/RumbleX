# Changelog

All notable changes to RumbleX will be documented in this file.

## [3.51.0] - 2026-08-20

### Changed
- Rebuilt the site theme layer around shared palette tokens. Rumble's header, search, navigation, feed tabs, video cards, related rail, watch-page actions, chat, comments, menus, forms, and focus states now read as one interface across all five themes.
- Reworked Theater Split with a visible Open panel control, a focused Hide side panel action, themed chat and comments, keyboard resize behavior, a 860px stacked breakpoint, and safer focus restoration.
- Consolidated Screenshot, Stats, Loop, Bookmark, and Share at time into one Player tools menu. The dock follows Rumble's active player when premium wrappers or route swaps leave an earlier player node hidden.
- Replaced the three floating circular site buttons with one compact control rail.

### Fixed
- Prevented Escape from closing Theater Split when it is meant to close the Player tools menu or the RumbleX modal.
- Restored the player tools after leaving Theater Split instead of removing them with the theater wrapper.
- Removed light related-video surfaces and dark card titles that leaked through on current Rumble pages.

### Verified
- Added live 1440x900 visual capture for the home page, watch page, collapsed theater, split theater, and open Player tools menu.
- Added browser coverage for panel disclosure, focus return, divider geometry, menu arrow keys, Escape behavior, and all five player actions.

## [3.50.0] - 2026-08-19

### Added
- **Captions load themselves now.** The Subtitles panel used to need a file from your disk before it could do anything, which meant the transcript stayed empty on videos that already had captions. Rumble publishes creator-uploaded caption tracks in the same embed payload the downloader has always read, so RumbleX picks them up: the first track loads on its own, any other languages appear as buttons, and the transcript fills in without you touching a file picker. It only reads Rumble's own media hosts, and switching it off means the endpoint is never called.
- **Downloads can drop the segments you marked.** Mark a sponsor read or an intro with SponsorBlock and the download can leave it out of the file. It works on whole stream segments, the smallest unit that can go without re-encoding anything, so a mark only removes the segments it covers end to end and a second or two can survive at each edge. That is deliberate: trimming a partly covered segment would take real video with it. The panel says how many segments and how much time it will drop before you start, the toggle only appears on videos that actually have marks, and it is off until you turn it on because it changes the bytes you get. Marks are also written into the sidecar as chapters in yt-dlp's format, which Jellyfin and Kodi already read, so even an untrimmed download records where the sponsor was. TS-to-disk saves now write sidecars too, though they land in your download folder rather than beside the file the picker chose.

- **A Creator Program panel on channel pages.** Rumble's program counts shorts against a monthly quota, and nothing tells you where you stand. This does. Shorts this month are shown against the 20 the program asks for, with other videos and streams alongside, read from Rumble's own listing data rather than from anything RumbleX guesses at. That listing does not survive in the page after load, so the panel re-reads the same URL you are already on, once per visit, with no cookies attached. the privacy report says so too. Raids are not counted and the panel says why: they exist only as a chat notice while one is happening, and a counter built on a guessed selector would sit at zero forever. `creatorMode` had been marked "not implemented yet" since it shipped; the list is down to 27.
- **Live alerts that open the stream.** The channel notifier already fired when a watched channel went live, but the notification opened the channel page and you still had to find the stream. It now names the stream, says how many people are watching, and takes you straight there. Live alerts and new-video alerts are separate switches, so you can have one without the other.

### Fixed
- **The channel notifier was reading markup Rumble no longer ships.** It scanned for `data-video-id` attributes and a live badge class, and on current channel pages one of those appears twice on an entire page and the other not at all, so new uploads went unnoticed and live streams never registered. Channel listings now come from the embedded JSON the page actually renders from, which carries the video id, title, upload date, live flag and viewer count. The old scan is kept as a fallback, and another channel's stream showing in the sidebar rail is no longer mistaken for yours going live.
- The accessibility suite ran its colour-contrast pass while the settings modal was still fading in, so it measured the Rumble page showing through a half-transparent panel. That put text a hundredth of a point under the contrast floor and failed at random depending on how much else was on screen.
- RumbleX has always run in the isolated world, never in Rumble's own page realm, but nothing stopped that from changing by accident. A guard now fails the build if either manifest declares a content script outside the isolated world, or if the shared core asks for it.
- The guard that keeps extension APIs out of the shared page-feature core only looked for `chrome.*`. Chrome 148 exposes the same APIs under `browser.*`, so a call written that way would have passed and then broken the userscript, where neither namespace exists. Both are caught now. RumbleX still detects whichever namespace the browser offers rather than requiring Chrome 148, and the README says so.
- The locale extractor only ever matched single-quoted feature labels, so a label written with double quotes would have shipped untranslated with every guard still passing. It now fails and says which entry to fix.

## [3.49.0] - 2026-08-19

### Added
- **Rant archive.** RumbleX already kept paid rants past the point Rumble expires them, but what it kept was only readable as chat scrollback. There is now a panel showing how many rants a stream has had, the running total, how many distinct people sent them and the top five, plus an export that honours `rantExportFormat` and writes CSV, JSON, or both. Amounts are parsed from whatever display string Rumble used, so a price it cannot read contributes nothing rather than poisoning the total, and the CSV escapes commas, quotes and newlines in message text. `rantStatsPanel` and `rantExportFormat` were both marked "not implemented yet"; the list is down to 28.
- **Chat user cards.** Clicking a name in chat opens a card with what that person has said this session, plus buttons to mention or block them and a box to give them a local nickname that sticks across visits. Renaming is fully reversible: the real name is kept, and turning the feature off restores every username. If you would rather have the lighter behaviour, clicking a name can simply drop an `@mention` into the box instead; that mode stands down automatically when cards are on, so the two never fight over the same click. `chatParticipantsList` and `chatClickToMention` were the last two chat settings sitting in the "not implemented yet" list. Session search was already covered by the existing chat filter bar, so nothing new was built for it.
- **Chat gets the three things every other chat platform already has.** *Mention autocomplete*: type `@` in the chat box and RumbleX offers the people who have actually spoken this session, ranked so prefix matches come first, with arrow keys and Escape doing what you expect. An email address typed mid-sentence is not treated as a mention. *Keyword highlight*: name the terms you care about and matching messages stand out, matching on the sender's name as well as the text, with an optional short tone that is synthesized rather than shipped as an audio file. *Readability*: alternating row shading, a chat text size between 70% and 160%, and an option to keep deleted messages visible struck through instead of having them vanish and shift everything beneath them. All three are separate toggles, and `chatMentionHighlight` was another setting that had been sitting in the "not implemented yet" list.

## [3.48.0] - 2026-08-19

### Added
- **Channel RSS, built in your browser.** Rumble publishes no per-channel RSS: the official MRSS feeds sit behind the creator dashboard, and the third-party generators that fill the gap get rate-blocked because they scrape from a server. A "Copy RSS" button on a channel page assembles a standard RSS 2.0 document from the cards already on screen, so no request is made at all and nothing can be rate-limited. Falls back to saving a file if the browser refuses clipboard access. `rssExportEnabled` was another "not implemented yet" setting; the list is down to 33.
- **Playback settings are remembered per channel.** One global speed stops being right the moment you watch two kinds of thing: a podcast wants 1.75x and a music channel wants 1x, and re-setting it every video was the tax for having a single setting. Volume, speed and an optional quality ceiling are now kept per channel and restored when the next video from that channel loads. `perChannelVolumeMemory` was another of the settings marked "not implemented yet"; it does something now. Channels you have never adjusted keep using the global values, and a per-channel ceiling can only lower the global one, never raise it past a bound you set deliberately.
- **SponsorBlock segments got the controls the upstream project's users keep asking for.** Each category can now auto-skip, skip only the first time it comes round, or just say the segment is there without moving playback. Every automatic skip offers an Undo for five seconds, which seeks back and hands the time credit back rather than quietly keeping it. The panel shows a running total of how much has been skipped, and three categories were added: spoiler, loud noise, and flashing lights, the last being an accessibility need rather than a preference. Segments are still marked locally by the person watching, so nothing leaves the browser.
- **Downloads can bring their metadata with them.** `downloadIncludeMetadata` and `downloadIncludeThumbnail` were two of the settings labelled "not implemented yet"; both are real now. A completed download can be accompanied by an `.info.json` following yt-dlp's field conventions, a Kodi/Jellyfin `.nfo`, and the thumbnail, all sharing the media file's base name so a media server pairs them automatically. Everything except the thumbnail comes from the page itself with no network request, and the thumbnail is served from a host the extension already had permission for, so this adds no new network surface.
- **Title Normalizer**, off by default. Calms the house style of engagement-bait: ALL CAPS, emoji spray and repeated `!!!`. It is deliberately conservative and only touches a title showing one of those traits, so an ordinary headline is left exactly as its author wrote it. Choose sentence case or Title Case, hover to see the original, and turning the feature off puts every title back. Acronyms survive: a short run of capitals inside an otherwise mixed-case title is treated as meaning rather than volume, so "CPU vs GPU" stays as it is instead of becoming "Cpu vs gpu".

## [3.47.0] - 2026-08-19

### Added
- **A project page at <https://sysadmindoc.github.io/RumbleX/>.** Install steps for every browser, the checksum and signature commands, an honest account of what the ad shield can and cannot do per runtime, and a plain statement of what RumbleX does with your data. It exists mostly as an anchor: fake repositories serving malicious release assets were one of 2026's most common attacks on people installing software from GitHub, so there is now one page that says which two sources are real.
- **The release build produces the Firefox signing artifacts.** `RumbleX-firefox.xpi` is the AMO submission input and `RumbleX-source.zip` is the source bundle AMO review requires, because the package ships two minified libraries. `docs/updates.json` is the update feed a self-distributed signed build checks; `scripts/build-update-manifest.js` generates it and refuses to write or pass anything with a non-HTTPS `update_link`, a missing `update_hash`, or a version that disagrees with the manifest.
- **Time Remaining**, off by default. Shows how much of a video is actually left at the speed you are watching it, and the clock time you will finish, because working that out in your head stops being easy the moment the rate is not 1x. Live streams and videos with no known duration show nothing rather than a made-up number, and the readout falls back to the structured-data duration while the player is still reporting none.
- **RumbleX reads the schema.org data Rumble publishes for search engines.** A watch page carries a `VideoObject` describing the video: exact view count, real duration, upload date, description, thumbnail, and the embed id, which is not always the id in the address bar. That is a steadier source than markup Rumble is free to restyle, so a new `PageData` reader parses it, and the watch-page view counter now shows the exact figure instead of Rumble's abbreviation. It supplements the card layer rather than replacing it: every reader returns nothing when the block is absent, one malformed block cannot hide a valid one later in the page, and results are cached per URL so a single-page navigation can't leave the previous video's numbers on screen. The local selector-health report names this as its own layer, because structured data and CSS selectors break for different reasons.
  - Worth recording why the card layer was left alone: reporting on yt-dlp's June 2026 breakage suggested Rumble had moved channel listings into embedded JSON. A live channel page says otherwise, with all 26 cards resolving from the DOM exactly as before and no listing JSON present. Rumble appears to serve different markup to non-browser clients, which is the same reason external downloaders keep breaking while an in-page extension doesn't.
- **`extension/lib/VENDOR.json` records where every vendored file came from**. package, version, npm tarball URL, SHA-256, byte count, and the one-line command that reproduces it. `npm run test:vendor-manifest` checks that record against the files on disk *and* against the hashes pinned in `build.sh`, so provenance, package and gate cannot drift apart, and a new file in `lib/` with no entry fails. Both libraries were confirmed to reproduce byte-for-byte from npm.

### Changed
- **Userscript update URLs moved off `raw.githubusercontent.com`** to the equivalent `github.com/.../raw/...` address. Same file, but the raw domain is now widely blocklisted by corporate filters and security tools because it is one of the most common places malware is staged from, and an update URL that quietly fails is worse than one that works.
- **Mediabunny is the default HLS-to-MP4 muxer; mux.js is now the fallback.** mux.js has had no commit since 2024-10-11 and no maintained fork exists, while Mediabunny shipped three fixes to the MPEG-TS demux path RumbleX actually uses between June and August 2026. Both engines already passed golden-file parity, so this promotes the better-maintained one rather than changing what a converted file looks like. Nothing is lost where WebCodecs is missing (Firefox below 130, the transmuxer-free lite userscript): the engine dispatch falls back to mux.js automatically and records why in the download diagnostics.
- **Schema v4 migrates existing installs onto the new default.** Every settings save persists the whole cache, so an install that predates this release carries `downloadMuxerEngine: "muxjs"` explicitly and a default change alone would have reached only brand-new installs. The migration rewrites the old default once; choosing mux.js after upgrading is respected and not rewritten again.

### Added
- **Release checksums can now be signed, and a bad signature stops the build.** `SHA256SUMS.txt` has always proved a download arrived intact; it never proved who produced it, which is the half that matters when 2026's live threat to extension users is lookalike repositories serving their own ZIPs. Setting `RUMBLEX_SIGNING_KEY` makes `extension/build.sh` write `SHA256SUMS.txt.sig` and then verify it against the public key published in `allowed_signers`. if the signing key and the published identity disagree, the build refuses to finish rather than shipping an unverifiable release. Builds without the variable are unsigned and say so. README documents the one-command `ssh-keygen -Y verify` check for users. The signing key itself is a trust-root decision left to the maintainer; until it exists the path is inert by design.
- Private Vulnerability Reporting is enabled on the repository, and a `refs/tags/v*` ruleset blocks tag deletion and non-fast-forward updates so a published release tag cannot be quietly repointed.

## [3.46.0] - 2026-08-18

### Added
- **French and Italian, at full parity. six locales now.** All 433 keys, including every toast, the download panel and the whole settings catalog, not just the extension's own pages. `tests/e2e/i18n-injected.spec.js` launches a Chromium per locale with `--lang` and asserts each probe resolves translated *and* differs from its English text, so a silent fallback cannot pass.

### Changed
- **The locale-expansion blocker demanded evidence this project can never produce.** It required install heat maps from a codebase that deliberately ships no telemetry and has no store analytics. a criterion guaranteed to block itself forever. Replaced with one that needs no analytics: a language qualifies if it is official in a country where Rumble Inc. operates (`fr`. Canada), or is among the largest Chrome Web Store locales RumbleX does not yet serve (`it`), and in both cases has a single standard written form so one catalog serves the market. Native-speaker review remains genuinely blocked and stays on the pre-publish checklist.
- **`check-store-listing.js` derives its required-locale list from `extension/_locales/`** instead of hardcoding four. Adding a locale to the extension without adding store copy now fails the guard, rather than shipping a listing in fewer languages than the extension itself. The "available in" line in all six descriptions is current.

### Fixed
- **Every error raised before `Settings.init()` resolved was silently discarded.** `RxErrorLog.record()` carried a `if (!Settings._ready) return;` guard left over from when capture itself consulted `debugErrorLog`. `record()` reads no setting at all. only `drain()` does. so the guard did nothing but throw away the boot window, which is exactly where a broken feature fails and the one window a user cannot retry. The diagnostics export the issue template asks reporters for was therefore empty for the failures most worth reporting. Removed, with a regression that raises an error with `_ready` false and asserts it lands in the ring; proven to fail with the guard restored.
- **Two intermittent test failures, both root-caused rather than re-run until green.** The hot-toggle revert test (`shared-parity.spec.js`) failed roughly once per several full-suite runs and never in isolation: it raced `Settings.init()`, and when it won, `RxErrorLog` dropped the entry, so exactly one of its three assertions failed. A probe pinning `Settings._ready` to `false` reproduces it deterministically. `recorded: false` while both reverts still pass, precisely the observed signature. The catalog-parity test used a bare `locator.count()`, which takes one snapshot and does not retry, against a modal that renders 200+ cards asynchronously; under load the snapshot landed mid-render. It now polls. Three consecutive full-suite runs are clean.

## [3.45.0] - 2026-08-18

### Added
- **Document Picture-in-Picture for the mini player.** `MiniPlayer` was an in-page floating `<div>` that died on navigation and could not leave the tab. Where `documentPictureInPicture` exists, a "Pop out" control moves the video into a real always-on-top OS window. It is a control rather than an automatic upgrade because `requestWindow()` requires transient user activation and the overlay opens from an IntersectionObserver, which has none. an automatic call would simply be rejected. Unsupported browsers render no button and keep the existing overlay untouched. The `<video>` is *moved* into the PiP document rather than cloned again, since a second clone decodes the same stream twice; closing the window, hiding the overlay, or disabling the feature each bring it home and remove the `pagehide` listener.

### Added
- **`/playlists/<id>` is a route RumbleX understands.** `content.js` had no playlist handling whatsoever. the only two matches for "playlists" were a CSS hide toggle and a library-section selector. so Batch Download and Channel Archive could not target one, and playlist extraction is simultaneously among the most-reported yt-dlp failures on Rumble. `Page.isPlaylist()` and `Page.playlistId()` classify the route, four selector-registry entries cover the page, Batch Download mounts and multi-selects there, and the archive button anchors to the playlist control panel (a playlist has no Follow button) with its own label. A sanitized `playlist-route.html` fixture is committed and covered by both the selector-health run and a drift test proven to fail when the route gate is removed.

### Fixed
- **The archive parser only matched relative card hrefs.** Playlist pages emit absolute `https://rumble.com/v…?playlist_id=…` URLs where channel grids emit `/v…`, so the enqueue regex would have found nothing on a playlist and, worse, the same video reached through both routes would have enqueued twice because the dedupe set compared unnormalised strings. Both patterns now accept either form and normalise to a path with the tracking query stripped.

### Added
- **Playback resilience: a quality ceiling, a floor, and stall recovery.** `AutoMaxQuality` always pinned the highest rendition, which is the worst possible response to the buffering that dominates Rumble complaints. It now applies a real policy: `qualityMode` picks the top (`best`), the bottom (`lowest`/`bandwidthSaver`) or nothing at all (`manual`, where the user drives quality and only stall recovery is installed); `qualityCeiling` and `qualityFloor` bound the choice. Bounds that exclude every available rendition fall back to the nearest one rather than leaving the player wherever it landed. The hls.js path and the DOM-menu fallback share one policy function, so the two cannot disagree.
- **Stall recovery.** Three `waiting`/`stalled` events inside 30 seconds means the current rendition is not sustainable on this connection, so RumbleX drops one step and raises a toast saying why. It never steps below an explicit floor, and turning `stallRecovery` off detaches the listeners rather than merely ignoring them.

### Changed
- **`qualityMode` is no longer dead.** It shipped with four documented values and no runtime consumer at all. one of the settings the v3.42 audit labelled "Not implemented yet". It is now wired, and removed from the `UNIMPLEMENTED` registry.

### Fixed
- **The in-page settings modal was unusable in a small browser window.** Its narrow/short-viewport rules sat *above* the desktop rules they override, and a media query adds no specificity. so for every property both declared, the later base rule won. The category sidebar stayed a 240px vertical column inside a column-direction body, which pushed the category list and the entire content pane out of the modal: at 640x400 the user saw a header, a search box and empty space. Only `.rx-m-body` had ever worked, and only because no base rule sets `flex-direction`, which is exactly why this looked correct. The block now sits last, with a comment saying why it must stay there, and a regression at 640x400 asserts the sidebar collapses to a horizontal strip and the content pane keeps its height. Found by capturing the 640x400 store screenshot.

### Added
- **Store listing assets.** Twelve images under `design/store/`: five screenshots at each of the Chrome Web Store's two accepted sizes (1280x800 and 640x400), a 440x280 promotional tile and a 1400x560 marquee, both rendered from one `promo.html` so the wordmark and palette cannot drift between them. `RUMBLEX_STORE_CAPTURE=1 npx playwright test tests/e2e/store-assets.spec.js` regenerates the set and re-reads every PNG from disk to assert its exact pixel size. a store rejects an off-by-one image at submission, which is far too late to find out.
- **`design/store/listing.json`**. the listing's source of truth: a justification for each of the 11 API permissions and 4 host permissions (plus an explicit list of the permissions RumbleX does *not* request, since `<all_urls>` and blocking `webRequest` are what a reviewer looks for), and name/short/detailed store copy in all four shipped locales.
- **`npm run test:store-listing`**, which fails if a permission is added to the manifest without a justification, if a justification outlives the permission it describes, if any locale's short description passes the 132-character cap, or if a declared asset is missing or the wrong size.

### Changed
- The German locale's "marked for human review before store publish" flag from v3.28 is **carried forward, not cleared**, and now covers Spanish, Brazilian Portuguese and the 260 settings-catalog entries added in v3.44. Every non-English string in the repo is machine-translated; that flag cannot be cleared by the same process that produced the translations. It is recorded in `listing.json`'s pre-publish checklist so it cannot be lost.

## [3.44.0] - 2026-08-18

### Added
- **The settings modal is fully translated, all 261 entries.** The 12 category headings, 137 feature labels and 124 descriptions live in `RX_CATEGORIES`, which stays the English source of truth: `sync-content-locale.js` reads the array directly and derives the catalog keys from the entry ids, so there is no parallel list to hand-maintain and a newly added feature gets a key automatically. and then fails the i18n guard until de, es and pt_BR carry it. Feature search now indexes the translated text rather than the English source, so searching in German actually finds German. 313 keys are wired in total and all four catalogs hold 424.
- **The in-page UI can now be translated at all.** `extension/content.js` had zero i18n calls, so four locales x 111 keys localized the extension's own pages while every string a user actually sees on rumble.com stayed English. A new `rxT(key, 'English text', vars)` helper resolves through `RXPlatform.t`. chrome.i18n in the extension, the embedded catalog in the userscript. and the English text stays inline as the fallback, so a missing or misspelled key degrades to correct English rather than to a blank control. Every toast, the download panel, and the settings-modal chrome are wired: 52 keys, translated into de, es and pt_BR. `i18n-injected.spec.js` launches a Chromium per locale with `--lang` and asserts the strings actually resolve translated, because `RXPlatform` is frozen and a stub would prove nothing; it also asserts each probe differs from its English text so a fallback cannot pass silently. The 261 feature labels and descriptions in `RX_CATEGORIES` are still English and remain on the roadmap.
- **`npm run test:content-literals`**, a ratchet on untranslated UI text. `check-i18n.js` verifies that every key the UI references exists in all four catalogs; it structurally cannot see the opposite failure, which is text that was never given a key. The ratchet counts the hardcoded literals left in the shared core and fails if the number rises, so each localized surface lowers the baseline and nothing new slips in.
- **`npm run test:content-locale`** (and `npm run locale:sync`), which keeps `en/messages.json` generated from the `rxT` fallbacks rather than hand-maintained in two places, and rejects a template-literal fallback since that cannot be extracted into a catalog.
- `check-i18n.js` now scans `content.js` and `background.js`, and recognises `rxT()` alongside `i18n()`.

### Fixed
- **A hyphen in a catalog key would have broken every install, the same way.** chrome.i18n accepts only `[A-Za-z0-9_@]` in a key and the category ids are kebab-case, so `cat_ad-blocking_label` was rejected along with the rest of the catalog. Both failures present identically. the extension simply never loads, and the page shows nothing at all. which is why the suite is what caught them rather than a console error.
- **The generated userscript embedded its catalog as one 22,501-character line**, which reads as minified code and is a Greasy Fork rejection ground. It is pretty-printed now; the parity guard's 20,000-character line cap is what caught it.
- **A `$name$` placeholder in a message would have broken every install.** `$name$` is chrome.i18n's own placeholder syntax and requires a matching `placeholders` block; an undeclared one makes Chrome reject the catalog and refuse to load the extension entirely, with nothing surfaced to the page. `rxT` substitutes client-side and never wants chrome.i18n to touch the text, so it uses `{name}`, which chrome.i18n ignores.
- **Five injected controls were unreachable without a mouse.** Description and comment timestamp seek links, the blocked-keyword/chatter/commenter chips in the settings modal, the chapter markers on the progress bar, transcript cue rows, and the per-card batch-download selection toggle were all click-only `<div>`/`<span>` elements. Each is now a real `<button>` with an accessible name, its native chrome reset so it renders exactly as before, and a visible `:focus-visible` outline. The batch-download toggle also exposes `role="checkbox"` with a live `aria-checked`, and the batch checkbox now stays visible while focused instead of only on hover.
- **Controls that axe rates as critical had no accessible name at all**: the playback-speed range slider (which also announced a meaningless 0-9 index rather than the multiplier), the chat filter, watch-history search and blocked-list text inputs, the SponsorBlock category select, and two glyph-only `×` delete buttons in the autoplay queue and SponsorBlock segment list.
- **Six features could not be re-enabled without reloading the page.** `VideoStats`, `LoopControl`, `Chapters`, `VideoClips`, `SubtitleSidecar`, `Transcripts` and `LiveDVR` detached their cached panel in `destroy()` but never cleared the reference, and their mount guards read `if (... || this._panel) return;`. Turning any of them off and back on left the panel permanently missing. Found by the new per-surface scan, which could not mount three of them for exactly this reason.
- **Secondary text across every injected panel failed WCAG AA contrast.** Sixteen rules used Catppuccin Overlay0 (`#6c7086`), measured by axe at 3.35:1 against the panel background where 4.5:1 is required; they now use Subtext0 (`#a6adc8`, 7.4:1). The bulk-unsubscribe DRY-RUN badge measured 4.10:1 and moved to Catppuccin Yellow. Four icon-only buttons were below the 24x24 CSS pixel minimum of WCAG 2.2 Target Size (the watch-history close button measured 22x28) and now carry an explicit minimum.

### Added
- **Every injected surface is axe-scanned.** `a11y.spec.js` previously covered only the four extension-owned pages. It now mounts all 22 in-page feature surfaces inside the content script's isolated world and runs a WCAG 2.2 AA scan scoped to each one, failing on any serious or critical violation. Surfaces that refuse to mount off their own route get that route: bulk unsubscribe is scanned on an account page. A surface that fails to render is reported as a failure rather than skipped, because an axe scan of an absent surface passes vacuously. A companion test asserts every control inside each surface is a native element that is still in the tab order.
- **`npm run test:a11y-controls`**, a static guard that fails on any non-interactive element which takes a click handler. axe cannot see that defect class. a click-only `div` reads as inert text and passes every rule. so the static guard and the runtime scans cover different halves of the problem. Dialog backdrops are allowlisted individually, keyed to their own source line.

## [3.43.0] - 2026-08-18

### Fixed
- **Two injected controls were unreachable by keyboard.** Chapter rows in the video description were clickable `<div>`s and the per-entry delete control in the search-history dropdown was a `<span>` containing `&times;` with no role, tabindex, or accessible name. so a keyboard user could not jump to a chapter or remove a saved search at all. Both are now real `<button>`s with accessible names and visible focus rings, styled to render exactly as before. The search-history row itself became a button too, and its delete control stays visible while focused rather than only on hover.
- **Injected feature panels had no semantics.** Twelve modules with four or more `createElement` calls carried zero `aria` attributes. The watch-history and bookmarks overlays are now `role="dialog"` with `aria-modal` and a name; the SponsorBlock, autoplay-queue, transcript, and Live DVR panels are named regions; the chapters panel is a named navigation landmark. Two new axe-backed regressions assert the roles and names exist and that the two converted controls are focusable buttons. both verified to fail when the attributes are removed.

### Added
- **Behavioral tests for modules that were only proven to mount.** `feature-lifecycle.spec.js` shows all 126 modules init and destroy cleanly, but mounting is not behavior. a module could produce entirely wrong output and still pass. The new `feature-behavior.spec.js` asserts actual products: which query parameters `StripTrackingParams` removes and which canonical ones it must keep, the sorted deduped chapter list `Chapters` parses (including that a mid-sentence timestamp is *not* matched), `SearchHistory` dedupe/ordering/cap, the `WatchHistory` URL trust boundary, the `ExternalPlayer` handoff target for each template shape, per-video `SponsorBlock` segment storage and the actual skip seek, `LoopControl` A/B normalisation and boundary seeks, `CommentExport` CSV escaping of embedded quotes and newlines, and `ChatExport` collection that excludes blocked messages. The shared harness moved to `tests/e2e/_harness.js` so both specs use one instrumented core. All 21 previously mount-only modules are now covered across 18 tests: `RantPersist` per-video cache scoping, `PopoutChat` preferring the native control over spawning a window, `AutoplayScheduler` rejecting off-site and `javascript:` queue entries, `SubtitleSidecar` WEBVTT parsing, `CommentSort` vote parsing with thousands separators and negatives, `MiniPlayer` tearing out its cloned `<video>` on hide so it cannot keep decoding audio, and stylesheet injection/removal for the four modules whose surfaces the fixture does not reproduce.

### Fixed
- **Settings written during startup were silently discarded.** `Settings.init()` assigned `this._cache = { ...defaults, ...stored }` wholesale and reset `_pendingKeys`, so any `Settings.set()` that landed while `init()` was still awaiting storage vanished. the write reported success and did nothing. Pending changes are now layered back on top, exactly as `_applyExternal` already did for writes racing an external change. This was the root cause of the intermittent `feature init throws` hot-toggle test failure: whether the revert survived depended purely on storage latency, which is also why it reproduced roughly one run in three rather than never or always.

## [3.42.0] - 2026-08-18

### Added
- **Settings with no runtime consumer are now disclosed instead of faked.** 41 of 210 keys rendered fully live controls in Options while no runtime code read them. a user could flip a switch, watch it save, and get no behavior change at all. The remaining 38 unwired keys are declared in a shared `UNIMPLEMENTED` registry, and Options renders them with a "Not implemented yet" badge, a stated reason, and disabled inputs. The values still persist and still appear in exports and backups; they just stop advertising themselves as something the user can act on.
- **`npm run test:settings-consumers` enforces it in both directions.** A key that is neither read by runtime code nor declared unimplemented fails the guard, and a declared key that runtime code *does* read also fails. so wiring a setting up forces its declaration to be removed in the same change, and the list cannot rot into stale exemptions. The guard understands the two dynamic read paths (feature modules gating on `Settings.get(this.id)` and the CSS toggle factory gating on `entry.id`) and deliberately ignores the options and popup pages, which read every key by definition.

### Added
- **First-run welcome.** `onInstalled` previously only synced context menus, the side panel, the notifier, and alarms, so a new user landed on 126 modules and 208 settings with no orientation and there was no `setUninstallURL` either. A fresh install now opens a welcome view naming eight high-value extras with one-click application. Every preset is deliberately a setting that is **off** by default and has a real runtime consumer. a starter list that mostly toggles things already enabled would do nothing and teach the user the button is fake. It is dismissible, shown once, writes nothing on dismissal, applies through the same trust boundary as any other settings write, and adds no keyboard shortcut, confirmation dialog, or light-theme surface.

### Added
- **A Greasy Fork-compliant `RumbleX.lite.user.js` is now built alongside the full userscript.** Greasy Fork caps scripts at 2 MB and forbids minified code; the full build embeds two minified transmuxers as a single ~807,000-character line. Shipping them unminified instead would be 1,790,521 bytes of library alone, so the lite variant omits both: ~699 KB, longest line ~5,250 characters, byte-identical shared runtime, every feature except MP4 remux. Raw HLS/TS save still works and the download path now says so plainly instead of failing inside asset resolution. `npm run test:parity` asserts the variant stays under the cap, carries no minified blob, bundles no assets, and does not drift from the shared core.

### Changed
- **Mediabunny upgraded 1.46.0 -> 1.55.1** (published 2026-08-17), with the SHA-256 pin updated and verified against a fresh download. The MPL-2.0 license file is byte-identical, so its pin is unchanged. `muxer-golden.spec.js` passes metadata parity on both engines and the WebCodecs-unavailable fallback still resolves to mux.js. The new bundle exports `StreamTarget`, which the streaming-MP4 work depends on.
- **mux.js stays the default transmuxer for now; Mediabunny stays opt-in.** mux.js is effectively unmaintained. npm's `latest` tag still points at 6.3.0 from 2023-02-22 and nothing has shipped on the 7.x line since 7.1.0 (2024-10-11). so this is not a comfortable position, and the fallback machinery to reverse it already exists and is tested. It is not flipped yet because the only automated evidence is metadata parity on a single synthetic golden TS sample, which is not grounds for changing the default engine for every user. **Criterion for making Mediabunny the default:** a real Rumble HLS capture (not the golden fixture) transmuxed by both engines must produce spec-equivalent MP4 that plays in current Chrome, Firefox, and Edge, and the Mediabunny path must handle the >512 MiB streaming case. Until then mux.js remains the default and Mediabunny remains the opt-in engine with automatic fallback.

### Changed
- **All in-page feedback now goes through one announcer.** `_showToast` existed as three separate implementations and only the `SettingsPanel` copy set `role="status"` and `aria-live`, so most of the extension's feedback was never announced to assistive tech. Worse, about 25 call sites reached it through `SettingsPanel._showToast?.()`. optional-chained, so if `SettingsPanel` failed to initialize the call silently became a no-op and a user could take an action, get no feedback at all, and have no way to tell whether it worked. A single `RxToast` module now owns its own live region, does not depend on any feature module having mounted, and re-announces two identical consecutive messages instead of staying silent on the second. The four byte-identical private `_esc()` copies (three of which were never called) collapse into one shared `rxEscapeHtml` helper.

### Changed
- **The release build no longer mutates the working tree.** Firefox packaging copied `manifest-firefox.json` over `manifest.json` and relied on an `EXIT` trap to put it back, so a kill or a power loss between those two copies left the MV2 manifest sitting at `extension/manifest.json`. and the next Chrome build would package MV2 as Chrome. Both packages are now staged in a temp directory and archived from there, so an interrupted build cannot poison the next one. A build that finds a stale `manifest-chrome-backup.json` refuses to run rather than guessing.
- **The packed file list is declared once.** It was repeated verbatim in all three archiver branches (`zip`, Windows `tar.exe`, `bsdtar`) with only one substring of it guarded, so a new runtime file could silently ship in one package and be missing from another. `npm run test:package-contents` now reads the ZIP central directories directly and asserts that every declared file and directory is present in both packages, that the two packages have identical file sets, that no build scaffolding leaked in, and that every runtime file on disk is actually declared.

### Fixed
- **The userscript's Privacy Report under-reported the shield.** `requestBlockingRules` was hardcoded to 6 while the `@webRequest` block declared 7 selectors, and the Privacy Report renders that number directly. It now matches, and the guard asserts it against the real selector count rather than a copied constant.

### Fixed
- **`a-delivery.rmbl.ws` was never blocked by any runtime.** It is a CNAME alias of the already-blocked `a.ads.rmbl.ws` and resolves to the same six servers, but request matching happens on the request hostname and never follows the CNAME, so ads served through the alias passed straight through all three runtimes. It is now covered by the DNR ruleset, the Firefox listener, and the userscript metadata block. The live cold-load audit could not have caught this on its own. it only watches hosts it already knows about.
- **The three hand-synced blocked-host lists are now machine-checked against each other.** The Chromium DNR ruleset, the Firefox MV2 listener, and the userscript `@webRequest` block cannot share code, and nothing asserted that they covered the same hosts. `npm run test:ad-blocking` now fails if a host appears in one and not the others. The previously-unexplained 7-vs-6 split is documented as structural: `@webRequest` selectors are globs, so the first-party affiliate regex cannot be expressed there. every blocked *host* is present in all three.

### Fixed
- **Deleting a settings profile is now reversible.** Every other destructive action snapshots before it runs; profile deletion dropped a saved profile permanently with no snapshot and no undo. Since the project bans confirmation dialogs on the premise that snapshot-plus-undo replaces them, that action had neither. Deletion now returns the removed profile so Options can offer an inline Undo, and it writes a `pre-profile-delete` snapshot as a second, independent recovery route. Restored profiles cross the same trust boundary as any other settings write.
- **Switching a profile actually writes its pre-switch snapshot now.** `switchProfile` asked the service worker to message itself to trigger the backup. That call can never land. `chrome.runtime.sendMessage` does not reach content scripts, where the handler lives, and a service worker does not receive its own runtime messages. and it sat inside an empty `catch`, so the documented snapshot silently never happened. Snapshots are now written directly from the worker through one shared helper that honors the same `backupHistory` opt-out and `backupHistoryLimit` as the content-script path.
- **The `privacyReport` switch is now honored.** It rendered a live control while nothing read it, so turning the Privacy Report off left it fully visible. The report is gated at its only producer, and Options distinguishes "turned off" from "unavailable".

### Removed
- **Two settings keys that nothing ever read are gone (schema v2 -> v3).** `bookmarks` and `settingsProfiles` were declared in the canonical schema and rendered controls in Options, but the real collections live in their own storage buckets (`rx_bookmarks`, `rx_settings_profiles`) and no runtime code ever consulted either key. The migration deletes them explicitly so an upgraded profile is cleaned deterministically. The canonical catalog is now 208 keys.

### Fixed
- **The `encryptedGistSync` master switch is now honored.** The toggle shipped with the feature in v3.17.0 and rendered as a live control in Options, but the background handler never read it. a user who deliberately turned Encrypted Gist Sync off still had a fully working push/pull path that shipped every setting to a third-party host. Both entry points now refuse with `sync-disabled` while the switch is off, and push and pull share one reason map so an identical backend refusal is explained identically (push previously printed the raw reason slug).

## [3.41.0] - 2026-08-18

### Changed
- **The in-page settings modal catalog is now gated against the canonical schema.** `RX_CATEGORIES` is a second hand-maintained table and it covered 127 of the 210 canonical keys with nothing asserting the relationship, so a setting could be added to the schema and the options page and silently never appear in the modal. Every key must now be present in the modal or listed in a documented exclusion map, and the check runs both ways so an exclusion for a key that was removed. or that has since been added to the modal. also fails.
- **The E2E suite runs headless.** Extensions load normally in modern headless Chromium, so the suite no longer needs a visible desktop or the display-isolation wrapper: 53 tests pass with no display attached. The config's `headless: 'new'` guidance was also stale. Playwright now rejects that value outright and requires a boolean. Pass `RUMBLEX_HEADED=1` for a visible run when debugging or capturing visuals.

### Fixed
- **The update check no longer offers a downgrade.** `hasUpdate` compared release tags as strings, so any tag that merely *differed* from the installed version counted as an update. and with the newest published release older than the shipped build, the popup advertised "Update available: v3.26.0" to a v3.40.0 user. Versions are now compared numerically. An exhausted GitHub API quota (403/429 with a zeroed rate-limit header) is also reported as its own state instead of being flattened into a generic "Check failed".
- **Three failures that looked like successes now tell the truth.** A popup toggle whose write failed still rendered as saved, because `chrome.storage.local.set` reports failure through `chrome.runtime.lastError` rather than by throwing. the synchronous `try/catch` around it could never have fired. Persist failures now surface an alert banner in the popup. A feature whose `init()` threw during a hot toggle left the switch on while the feature did nothing; the switch and the stored value now revert and the toast says the feature could not be enabled. And the local error ring recorded nothing in the shipped configuration because capture was gated behind a default-off debug setting, so the export the bug-report template asks for was always empty; capture is now unconditional while the setting continues to gate whether the ring is revealed, with the Privacy Report and the setting description updated to match.
- **Reset All Data now fails closed instead of wiping without an undo.** Reset has no confirmation dialog by design. the pre-reset snapshot *is* the undo. but a snapshot failure was caught and discarded, so the wipe proceeded anyway and the only signal was a missing sentence in the status line. A throwing snapshot now aborts the reset with nothing changed. Deliberately disabling backup history is treated as the informed opt-out it is: the reset still runs, and the status says plainly that it cannot be undone.
- **A stalled mux.js conversion can no longer hang the download panel.** The opt-in Mediabunny worker has had an input-scaled watchdog since v3.35, but the *default* mux.js worker had none. it handled abort, `error`, and `messageerror` and nothing else. mux.js has not published since 2024-10-11 and carries an open, unpatchable unchecked-loop-condition defect (videojs/mux.js#447), so a malformed segment could wedge it with the promise never settling: no error, no diagnostics entry, and a live worker until the user cancelled. Both engines now share one `_workerTimeoutMs()` bound and terminate a worker that exceeds it, rejecting with a `worker-timeout` stage diagnostic.

### Security
- **Notifier webhook is now a validated trust boundary.** `discordWebhookUrl` was the one settings key that reached an outbound `fetch()` without passing any URL check, so a crafted backup, snapshot, or encrypted-Gist pull could silently install an arbitrary destination for followed-channel activity. `http://`, any host, even `javascript:` were accepted verbatim. `settings-schema.js` now rejects anything that is not an HTTPS Discord webhook endpoint (no embedded credentials, exact `/api/webhooks/<id>/<token>` path, query and fragment dropped), `background.js` re-validates before every POST so stored values cannot outlive the boundary that wrote them, and the local Privacy Report now lists the configured webhook under external network surfaces instead of leaving a runtime-configured destination undisclosed.

## [3.40.0] - 2026-08-13

### SPA mutation and player lifecycle hardening

- Added a lifecycle-aware animation-frame scheduler for high-frequency DOM features. Logo routing, speed/volume discovery, watch-progress bars, channel controls, live-chat processing, timestamps, autoplay cleanup, rant totals, exact counts, Shorts filtering, and quick-save now coalesce bursty htmx/infinite-feed mutations instead of rescanning repeatedly between paints.
- Feature teardown now cancels queued animation-frame work alongside pending DOM waits and timers, preventing a disabled module from performing one last full-page pass.
- Speed Control and Scroll Volume now release listeners and dataset markers from detached videos during player replacement, then bind only the current video. Scroll Volume also detaches a removed volume-popup observer and rebinds the replacement popup.
- Exact Counts now records Rumble's original abbreviated text and marker state, restores it on hot disable, and releases records for detached cards.
- Added regressions covering 64-mutation bursts across twelve scanners, queued-frame cancellation, video/player-popup replacement, reversible exact counts, and animation-frame leak tracking across the full handwritten feature catalog.

## [3.38.0] - 2026-08-13

### Canonical settings schema

- Extracted the 210-key defaults catalog, schema-v2 migration, numeric/enum bounds, safe Rumble URL checks, nested notifier/SponsorBlock validation, and prototype-safe cloning into `extension/settings-schema.js`.
- Loaded that platform-independent schema before content, options, popup, Chrome MV3 background, Firefox MV2 background, and the generated userscript; removed more than 1,000 lines of duplicated catalogs and validation logic from the three UI runtimes.
- Routed background `saveSettings`, notifier merges, profile saves/switches, Gist-created ID updates, and encrypted Gist pulls through the same normalizer used by options imports and content settings.
- Encrypted Gist pulls now reject non-object decoded payloads and preserve the local token/Gist ID after normalization rather than trusting credential-shaped fields from the remote backup.
- Added a standalone schema contract plus loaded-extension hostile profile/Gist regressions covering unknown keys, invalid primitive types/enums, numeric clamping, CSS-shaped categories, JavaScript/off-site autoplay URLs, malformed watched channels, SponsorBlock structures, and legacy `keyboardNav` migration.
- Updated the userscript parity hash to cover both the byte-identical canonical schema and content core, and packaged the schema in both browser archives.

## [3.37.0] - 2026-08-13

### Bounded large-media delivery

- Added a capability-gated **TS to disk** path that asks for the destination while the click still has transient user activation, then writes HLS response chunks sequentially to the selected file instead of retaining the full video in tab memory.
- Centralized master/media playlist resolution so the disk and in-memory paths accept both multivariant and direct media playlists, retain HTTPS/host validation, and share abort-aware diagnostics.
- Kept HLS-to-MP4 conversion behind the 512 MiB in-memory ceiling; browsers without the File System Access picker continue to show the bounded direct/TS/TAR fallbacks instead of an unsafe large-file action.
- Added cancellation cleanup that aborts the active response reader and writable stream so staged partial changes are discarded, plus loaded-extension coverage for byte ordering, direct media playlists, progress, and abort behavior.

### Visible platform and selector health

- Added an explicit request-shield mode to the shared platform contract: Chromium DNR, Firefox blocking `webRequest`, or userscript-manager-dependent. Settings and privacy surfaces now report the active mode and declared rule count without requesting debug-history permissions.
- Added a real Firefox 137 temporary-addon smoke test that verifies MV2 content injection, Promise-normalized storage set/get/remove, response-bearing runtime messaging, and packaged asset access.
- Added a privacy-safe critical-selector health check for each current route. It distinguishes stable, fallback, and missing anchors, surfaces a one-time in-page warning for a broken critical contract, and includes the sanitized result in the local Privacy Report.
- Debounced selector-health warnings across two matching samples so Rumble's custom-element skeleton phase cannot produce a false alarm, while persistent breaks remain visible and are periodically rechecked for recovery.
- Hardened opt-in live tests to target the exact Rumble tab and classify Cloudflare's interactive verification page as an external gate instead of treating it as selector or ad-blocking evidence.
- Deliberately did not add per-request/per-rule history counters: Chromium exposes that data only through feedback/debug or active-tab pathways that would expand permissions or produce an inconsistent userscript contract.

### Settings recovery trust boundary

- Routed options-page snapshot capture and restore through the same per-key normalizer as file import, including URL allowlists, enum checks, numeric bounds, safe string arrays, category allowlists, and watched-channel validation.
- Added a regression proving an old or crafted snapshot cannot restore JavaScript/off-site autoplay URLs, CSS-shaped categories, object-valued keywords, or invalid channel URLs.
- Bounded local SponsorBlock JSON and subtitle sidecar reads before allocation; SponsorBlock imports now pass through the canonical segment schema before becoming active in the current tab.

### Request-level ad shield

- Added seven Rumble-scoped Chrome MV3 Declarative Net Request rules for the live ad-delivery and measurement surface: Rumble Ads, Google IMA, 2mdn in-stream video, Google OM SDK, DoubleClick, Google Ad Services, and first-party `/l/` ad-measurement pings.
- Added the Firefox MV2 equivalent with a least-scope blocking `webRequest` listener and explicit ad-host permissions.
- Added an experimental userscript `@webRequest` contract for managers that expose early cancellation; the UI labels the shield as manager-dependent because current Chromium MV3 Tampermonkey cannot provide this capability.
- Kept Ad Nuker as the second DOM layer for sponsored records, pause overlays, premium nags, reserved shells, and SPA reinsertion, with request blocking and DOM cleanup described separately throughout the UI.
- Added a deterministic rule/manifest/disclosure test and an opt-in cold-load live audit that records completed and failed ad requests plus visible ad nodes.

### ImageGen-led desktop settings redesign

- Redesigned the options control center, full settings editor, popup, and in-page modal around one OLED-black/Rumble-green desktop design system, using captured references and four saved ImageGen target mockups.
- Added persistent network-shield state to every relevant settings surface and clarified local autosave, full-editor discovery, reset/export actions, and the difference between request blocking and DOM cleanup.
- Increased the in-page editor's usable desktop canvas and information density, widened the popup to a complete 440px command surface, reduced decorative glow, and preserved keyboard, focus-trap, reduced-motion, forced-colors, save/discard, and recovery behavior.
- Added repeatable visual capture at 1440x900 and 1920x1080 plus targeted settings, parity, runtime, and accessibility checks.

### Platform validation

- Added a standalone extension-platform contract test for callback-style Firefox MV2 and promise-style browser APIs.
- Extended userscript privacy-report metadata to disclose every GM capability, including the optional request-cancellation contract.

## [3.36.0] - 2026-08-13

### Shared extension/userscript runtime

- Made `extension/content.js` the canonical page-feature core for Chrome, Firefox, Tampermonkey, and Violentmonkey instead of maintaining the obsolete v1.8 userscript fork.
- Added explicit extension and userscript platform adapters for storage, downloads, requests, packaged assets, messages, localization, manifest data, and capability detection.
- Added deterministic userscript generation with the package/manifest version, canonical-core SHA-256, update URLs, HTTPS-only host grants, `@noframes`, and no `unsafeWindow` or dynamic remote-code execution.
- Embedded the repository-pinned mux.js and Mediabunny libraries and workers in the userscript, preserving both muxer paths without a runtime CDN dependency.
- Migrated old per-key userscript values into schema-v2 settings, including `keyboardNav`, `speedControl`, and `shareTools` aliases.
- Capability-gated persistent-background surfaces so the userscript never shows a broken channel-archive action; archive recovery, alarms, notifications, context menus, side panel, and tab grouping remain extension-only.
- Added a Firefox MV2 browser-namespace compatibility layer and normalized callback/Promise extension APIs for storage, messaging, and bundled-resource access.

### Live Rumble compatibility and lifecycle fixes

- Added a shared adapter for Rumble's current `<rum-video-thumbnail role="listitem">` cards and active media selection; related filtering, titles, keyword hiding, progress bars, channel blocking, thumbnails, and dense mode now use it.
- Updated watch/share selectors to prefer a visible action anchor when Rumble keeps a hidden share control in the DOM.
- Fixed the duplicate `section-shorts` shape by distinguishing Shorts from personal-recommendation rows structurally.
- Fixed Theater Split's zero-width panel by applying the complete flex geometry, and kept the exit button above player controls without covering Screenshot.
- Made Theater Split subscribe to SPA route changes, remount after htmx swaps, cancel in-progress drags/listeners, and restore the original player, video, chat, comments, inline styles, and DOM identity on exit.
- Fixed a shared `NodeList`/array mismatch that broke modern card mapping and active-video filtering in real browsers.
- Made Watch Progress cancel delayed mounts and remove its interval, progress bars, and video listeners when disabled.
- Made Channel Blocker reveal the final unblocked channel immediately and remove timers, buttons, classes, and observers on disable.
- Coalesced ad cleanup around added mutation nodes instead of repeatedly rescanning the complete document.

### Downloader safety and current API support

- Centralized embed HLS extraction across `u.hls.auto.url`, `ua.hls.auto.url`, `u.hls.url`, and `ua.hls.url`, matching current public Rumble responses.
- Enforced HTTPS plus the Rumble/CDN hostname allowlist before requests, downloads, queue navigation, or generated fallback anchors.
- Added abort propagation through master playlists, variants, segments, workers, clips, live DVR, and audio extraction.
- Added a 512 MiB in-tab media ceiling with progressive byte accounting so multi-gigabyte streams fail safely instead of exhausting the tab.
- Preserved the standalone download overlay when Theater Split is disabled and normalized userscript downloads through completion-aware `GM_download` handling.
- Kept diagnostics and download state local while redacting URL credentials, query values, fragments, cookies, and token-like values.

### Settings, import, and UI hardening

- Replaced structural-only import cleanup with per-setting schemas: known keys, prototype-key rejection, category allowlists, bounded numbers, enums, safe string arrays, watched-channel records, mute durations, autoplay URLs, and SponsorBlock segments.
- Persist sanitized settings back to storage and serialized overlapping writes so delayed/rejected storage calls cannot silently discard a newer change.
- Added pre-read and post-normalization limits to in-page JSON imports and bounded streaming decompression for options-page gzip backups.
- Validated imported/snapshot autoplay queue entries as HTTPS Rumble URLs before navigation and applied the same semantic normalizer before background consumers read imported data.
- Removed the in-page settings shortcut, retaining visible gear controls and Escape/focus-trap dialog behavior; legacy video navigation remains opt-in and ignores Ctrl/Cmd/Alt-modified keys.
- Improved the in-page settings dialog with button semantics, tabs/ARIA state, focus restoration, mobile horizontal navigation, reduced-motion behavior, and the OLED Green theme.
- Strengthened autoplay blocking with an early capture listener and repaired cleanup for shared feature hot-disable paths.

### Regression and release guardrails

- Added a generated-userscript parity guard covering exact core hash/tail identity, synchronized versions, platform ordering, capability gates, metadata grants, forbidden remote-eval tokens, and generator freshness.
- Added a VM userscript-platform contract suite for sync/Promise GM storage, value-change cleanup, XHR response adaptation, timeouts, abort, HTTPS rejection, completion-aware downloads, asset URLs, manifest disclosure, and legacy migration.
- Added a committed modern-watch fixture and loaded-extension tests for current custom cards, Theater geometry/exit/route restoration, malicious settings, every HLS response shape, and modified-key safety.
- Extended DOM-sink checks to the userscript adapter and generated output, and added the generated userscript to build/release checksums alongside both browser ZIPs.

## [3.35.0] - 2026-08-12

### Offline download recovery

- Added a persisted, URL-free recovery ledger for RumbleX-owned browser download IDs. Worker `offline` events pause active managed transfers without claiming files the user paused manually; `online` events resume only the queued IDs.
- Network-interrupted archive downloads now resume partial browser transfers when supported or restart from the stable video ID when Chrome cannot resume the partial file, instead of being marked failed immediately.
- Selected-folder archive streams now accept abort signals through the offscreen document, return to `pending` while offline, and continue on the online event or the minute alarm fallback if a dormant service worker missed the event.
- The archive summary exposes offline/resume counts, and loaded-extension tests cover worker events, rapid reconnect de-duplication, the manager-off gate, resumable and restart-only interruptions, offscreen folder pause/resume, and the visible queued state.

### Contributor architecture guide

- Added a README architecture flow showing the content-script, feature, service-worker, storage, worker, offscreen, and settings-page boundaries.
- Added a route-safe feature-module template and the catalog/selector/cleanup rules required when extending the monolithic content script.

### Platform drift guardrails

- Added committed, privacy-safe HTML contracts for the dedicated Shorts route, Rumble Wallet tip button, and Premium/Perplexity promo so release checks no longer depend on ignored logged-in captures.
- Promoted missing expected selector-map entries from silent skips to explicit failures and added a named Premium promo selector alongside the existing Shorts and Wallet surfaces.
- Added loaded-extension Chromium coverage for Shorts route classification, every dedicated Shorts selector, Wallet opt-in hiding, and default Premium promo cleanup.

### Downloader failure diagnostics

- Added a local-only, sanitized 50-attempt diagnostics ring for quality discovery, direct/HLS/archive downloads, clip exports, and muxer failures.
- Failed download surfaces now offer copy/export actions; Options → Privacy & Data can copy, export, or clear the same bundle without an open Rumble tab.
- Diagnostics include failure stage, selected quality, mux.js/Mediabunny fallback context, and worker/offscreen capability probes while redacting URL credentials, query values, fragments, cookies, and token-like values before storage.
- Added Playwright coverage for persistence, secret redaction, real clipboard/JSON export actions, clear behavior, injected failure controls, and accessibility.

### Archive queue preflight and recovery

- Added a queue preflight that pauses new work, probes the selected quality, records known media sizes, and surfaces per-job probe failures before a long archive starts.
- Added an opt-in persisted archive folder with visible permission state, explicit choose/grant/reset controls, serialized offscreen streaming, and automatic fallback to browser-managed Downloads.
- Added bulk retry, pause/resume, strict local JSON export/import, retry-attempt metadata, and serialized queue mutations so concurrent jobs cannot overwrite one another's state.
- Added Playwright coverage for import normalization, safe text rendering, retry cleanup, real JSON download, size preflight, folder-handle persistence and writes, accessibility, and the complete queue UI.

### Muxer golden-sample parity

- Added a checked-in one-second H.264/AAC MPEG-TS golden sample that runs through the production mux.js and Mediabunny paths; both outputs must load as playable 160×90 MP4s and expose matching duration, video, and audio metadata.
- Extracted the Mediabunny module worker into an extension-owned file shared by production and tests, and fixed its startup ordering so requests cannot arrive before the asynchronous bundle import has a registered listener.
- Added an input-scaled conversion watchdog that terminates a stuck experimental worker and preserves stage diagnostics before falling back to mux.js.
- Added coverage that removes the real `VideoDecoder` capability and proves the explicit Mediabunny selection falls back cleanly to a playable mux.js result.

## [3.34.0] - 2026-06-18

### v3.34.0 - Localized settings surfaces

- Popup and options-page labels, buttons, status text, empty states, tooltips, search placeholders, and settings group names now resolve through `chrome.i18n.getMessage` with English fallbacks.
- Expanded `en`, `es`, `pt_BR`, and `de` locale catalogs from manifest/bootstrap coverage to the main visible settings and popup surfaces.
- Added `scripts/check-i18n.js`, `npm run test:i18n`, and CI coverage that validates locale key parity and scans manifest/UI i18n references before release.
- Added Playwright coverage proving the popup and options modal consume localized messages in a loaded extension context.
- Fixed injected in-page settings modal accessibility issues: the close button now has an accessible name, inactive navigation labels/counts and helper text meet contrast, and axe coverage now runs against the injected modal on an offline Rumble fixture.

## [3.33.0] - 2026-06-17

### v3.33.0 - Manifest-derived privacy disclosures

- Privacy report output now derives permissions, host permissions, and web-accessible resources from the active extension manifest.
- Added explicit disclosure rows for manifest permissions, external host surfaces, and exposed extension resources.
- Added `scripts/check-manifest-privacy.js`, `npm run test:manifest-privacy`, and CI coverage so manifest privacy surfaces cannot drift silently.

## [3.32.0] - 2026-06-17

### v3.32.0 - DOM-sink security guardrail

- Added `scripts/check-dom-sinks.js` and a CI step that fails new unapproved `innerHTML`, HTML parser, contextual fragment, and download-panel HTML helper paths.
- Refactored page title, watch history, bookmark, progress bar, and mini-player rendering away from template HTML when values come from page text or local storage.
- Exposed `npm run test:dom-sinks` for local review before packaging.

## [3.31.0] - 2026-06-17

### v3.31.0. No-tab backup/import recovery

- Importing a backup with per-site data now stages that localStorage payload in extension storage when no Rumble tab is open, then restores it automatically on the next Rumble tab load.
- Reset now stages a per-site clear operation when no Rumble tab can receive the broadcast, so stale watch/bookmark/rant data is cleared on the next Rumble tab load instead of being silently skipped.
- Options-page snapshot history now reads, writes, and restores settings snapshots directly from extension storage, so import/reset recovery no longer depends on an open content script.
- Added Playwright regression coverage for staged per-site restore and staged clear.

## [3.30.0] - 2026-06-17

### v3.30.0. Release build portability + checksum provenance

- Normalized `extension/build.sh` for LF-only Bash execution and added `.gitattributes` plus a CI guard that fails on CRLF shell scripts before packaging.
- Switched the GitHub Actions release build to call `extension/build.sh` directly so local, E2E, live-smoke, artifact, and tagged-release packaging all use the same path.
- `extension/build.sh` now writes and immediately verifies `SHA256SUMS.txt` for `RumbleX-chrome.zip` and `RumbleX-firefox.zip`.
- Removed the unsafe `Compress-Archive` ZIP fallback in favor of `zip` or bsdtar so browser package entries keep forward-slash paths.

## [3.29.0] - 2026-06-16

### v3.29.0. Premium settings and popup polish

- Refined the extension-owned options page with a darker command-center visual system, stricter 6-12px radii, stronger surface hierarchy, improved stats/data-section rhythm, and centralized input/select styling.
- Reworked the popup into a compact companion control surface with a local-status strip, consistent green/blue accents, repaired tooltip targeting, keyboard-visible focus rings, accessible icon labels, and a fixed popup favicon path.
- Removed blocking confirmation/browser prompts from the options workflow. Reset now acts immediately with status feedback and requests a pre-reset snapshot when an open Rumble tab can provide one; closing a dirty draft discards it with non-blocking status feedback.
- Improved accessibility states across options + popup: `role="status"` for feedback, focus-visible styling for buttons/selects/toggles, forced-colors coverage, and reduced-motion-safe transitions.

## [3.28.0] - 2026-06-16

### v3.28.0. German locale + roadmap triage

- Added `extension/_locales/de/messages.json`. 32/32 key parity with English source. Initial translations marked for human review before store publish.
- Locale count: en + es + pt_BR + de (4 locales shipped).
- Moved all blocked/externally-gated roadmap items to `Roadmap_Blocked.md` so `ROADMAP.md` contains only actionable work.

## [3.27.0] - 2026-06-16

### v3.27.0. Opt-in Mediabunny muxer path

- Added bundled Mediabunny 1.46.0 browser ESM bundle plus MPL-2.0 license notice under `extension/lib/`.
- Added `downloadMuxerEngine` (`muxjs` default, `mediabunnyWebCodecs` experimental) across the content/options/popup settings catalogs.
- HLS-to-MP4 paths now try the Mediabunny module-worker conversion only when explicitly selected, then fall back to the existing mux.js worker on any unsupported-browser, import, or conversion failure.
- Build script now SHA-256 verifies both the Mediabunny bundle and its license in addition to the existing mux.js pin.
- Manifest web-accessible resources include the Mediabunny files so the blob module worker can import the extension-owned bundle without runtime remote code.

## [3.26.0] - 2026-05-21

### v3.26.0. FS-Access folder picker + offline-aware archive queue + wallet QR selector

### Batch download. pick a folder once, save N files into it (Chrome / Edge)

- New `RxFsAccess` helper persists a `FileSystemDirectoryHandle` across SW restarts (IndexedDB `rx-fs-access` / `handles`). Spec: <https://wicg.github.io/file-system-access/>.
- `BatchDownload` bar gains a **Pick folder** button. Picked folder name appears as a green `→ <name>` chip; **Clear folder** reverts to the default Downloads path. The picker is hidden on Firefox MV2 and on Chromium older than 86.
- Download flow tries the FS-Access path first: `fetch(directMp4)` → `Response.body.pipeTo(writableFile)`. Any failure (permission revoked between sessions, partial-write, network error, unsupported browser) falls back transparently to the existing `chrome.runtime.sendMessage({action:'download'})` path. Worst case = identical to v3.25 behavior.
- Permission is re-requested at the top of every batch via a user-gesture pre-flight so the prompt fires deterministically before parallel workers start, instead of racing inside `Promise.all`.
- New setting key `batchDownloadFolderName` records the picked folder's display name (the handle itself can't be JSON-serialized). Catalog parity 207 → 209.

### Channel archive queue. auto-pause while offline

- New setting key `archiveQueuePauseOnOffline` (default **ON**). The `chrome.alarms` archive tick short-circuits when `navigator.onLine === false`, so jobs aren't burned on guaranteed-fail network ops while a laptop is on a flight, tethered to a flaky hotspot, or temporarily firewalled.
- No state changes while skipped. jobs stay `pending` and the next online tick picks up where this one left off. Flip the setting OFF to restore the prior always-tick behavior.

### Selector registry

- New `wallet.paymentModal` entry. Anchored against `/-htmx/wallet/payment/qr-modal` (the endpoint documented in ROADMAP Appendix B). Conservative stable+fallback. no functional code uses it yet; the entry lands now so the v3.27+ tip-jar hide work is a one-selector tweak away once a logged-in MHTML capture lands.
- Registry size 51 → 52. Selector regression harness still **85 pass / 0 fail** across 4 fixtures (warn-only fallback hit on `Rumble Studio.mhtml`'s `header.root`, unchanged from v3.25).

### Repo hygiene

- `package.json` version bumped from a stale `3.22.0` (left behind by the v3.22 / v3.23 / v3.24 / v3.25 churn) back into sync with the shipping extension version. Future automation that reads `package.json` for the canonical version (release workflows, badge generators) no longer reports a phantom downgrade.

## [3.25.0] - 2026-05-19

### v3.25.0. Status filter for the Channel Archive queue panel

Polish release. At-scale (50+ jobs) the archive panel got hard to scan when looking for a specific category (e.g., "what failed and needs my attention?"). This release adds a status filter dropdown to the panel.

**New status filter dropdown**
- Placed below the totals row, above the job list.
- Values: `All jobs` (default), `Pending only`, `Active (discovering + downloading)`, `Completed only`, `Failed only`.
- UI-only state. not persisted; resets to "All jobs" on page reload. Keeps the catalog parity stable.
- Empty-filter feedback: when the filter excludes every job but the queue isn't empty, shows "No jobs match the current filter." instead of a blank list.

**No new permissions, no new settings keys, no new selectors.** Catalog parity 207/207/207/207 unchanged. Selector harness 85 pass / 17 fixtures unchanged. `node --check` clean.

### Session summary (v3.15 → v3.25)

Eleven releases shipped in this session continuation:
- **v3.15** Watch History export (SW-fetch + regex parse)
- **v3.16** RantStats panel (chrome.storage.local mirror + options UI + CSV/JSON export)
- **v3.17** Encrypted Gist Sync (AES-GCM-256 + PBKDF2-SHA256, zero RumbleX infra)
- **v3.18** Channel Archive Queue Phase 1 (persistent SW queue + embedJS drain)
- **v3.19** Channel Archive Phase 2 (in-page "Archive channel" button)
- **v3.20** RxErrorLog ring buffer (Observability workstream Now-tier closed)
- **v3.21** Channel Archive max-height quality cap
- **v3.22** Live-site smoke harness (workflow_dispatch, opt-in)
- **v3.23** RxErrorLog Phase 2 instrumentation
- **v3.24** Customizable Channel Archive download subfolder
- **v3.25** Status filter for archive queue panel

Catalog grew from 201 → 207 keys. Released roadmap items closed: v3.3 RantStats panel, v3.4 Live-site smoke, Encrypted gist sync, Channel archive queue (Phases 1+2+3a), Observability error ring buffer + Phase 2 instrumentation.

**Genuinely blocked and unchanged**: mux.js → Mediabunny migration (multi-day), declarativeNetRequest autoplay rules (need network trace), userscript regeneration (multi-day), Firefox MV3 conversion (multi-day), Chrome Web Store / AMO / Edge listings (need dev accounts), locale `de` (need human-reviewed translation drop).

## [3.24.0] - 2026-05-19

### v3.24.0. Customizable Channel Archive download subfolder

Users were dumping every channel-archive download into a hardcoded `RumbleX/` folder under Downloads. This release lets each user pick their own subfolder name (and a shallow tree if they want. e.g., `RumbleArchive/2026/Bongino`).

**New `channelArchiveSubfolder` setting** (default `'RumbleX'`)
- Read by the SW at job-process time (not enqueue time), same pattern as v3.21's `channelArchiveMaxHeight`. change it mid-queue and the next job lands in the new folder.
- Sanitized SW-side via new `rxArchiveSanitizeSubfolder()` helper. Strips backslashes, drive letters, parent-segments (`..`), reserved chars (`<>:"|?*`), control chars, and excess depth (>4 segments truncated). Empty input falls back to `'RumbleX'`. **Defense-in-depth**. a malformed value can't escape the user's Downloads root because chrome.downloads also rejects absolute paths.

**Options-page UI**. new text input below the max-height dropdown in the "Channel archive queue" section. Persists immediately on `change`; shows a confirmation toast acknowledging that the value will be sanitized server-side.

**Catalog parity** 207/207/207/207 (was 206). added `channelArchiveSubfolder` (string, default `'RumbleX'`). No new permissions. Selector harness 85 pass / 17 fixtures unchanged.

### Deferred to v3.25+

- **HLS fallback for Channel Archive**. still the largest remaining roadmap item.
- **File System Access folder picker**. would let users pick a folder anywhere, not just under Downloads. Doesn't compose with chrome.downloads.download (which expects a relative path under Downloads); would require switching the download path to a fetch-then-stream-to-FileSystemDirectoryHandle implementation. Multi-day work.

## [3.23.0] - 2026-05-19

### v3.23.0. RxErrorLog Phase 2 instrumentation

Expands the v3.20 error-log ring buffer's instrumentation coverage. Phase 2 wires `RxErrorLog.record` into three more high-value catch sites that previously swallowed exceptions silently.

**New instrumentation sites**
- `Router._fire` route-handler iteration. each subscriber that throws now records `(handlerName || 'routeHandler', error, 'route:<reason>')`. Previously a buggy feature could fail on every htmx swap and only show up as a `console.warn` users would never see.
- `boot()`. `Settings.init()` failure now records `('Settings', error, 'init')` in addition to console error. Same treatment for `Router.init()`.
- `VideoDownloader._loadQualities` catch. records `('VideoDownloader', error, '_loadQualities')` so embedJS-fetch failures land in the export-able log instead of just the in-modal red-text message.

All three sites use the `RxErrorLog?.record` optional-chaining pattern + inner `try/catch`, so an error in the error logger itself can't break the host code path. Failures stay silent when `debugErrorLog` is OFF (the default).

**No new permissions, no new settings keys, no new selectors.** Catalog parity 206/206/206/206 unchanged. Selector harness 85 pass / 17 fixtures unchanged. `node --check` clean.

### Deferred to v3.24+

- **Finer-grained instrumentation**. chrome.runtime.onMessage handler catches, VideoDownloader deep-scan inner catch, RantPersist localStorage failures. Each is a small wiring point; aggregate them when the next concrete bug report names one.

## [3.22.0] - 2026-05-19

### v3.22.0. Live-site smoke harness (closes v3.4 testing workstream's deferred item)

Materializes the "Live-site smoke tests (manually scheduled, not CI)" bullet that the v3.4 testing section deferred. Catches Rumble-server-side changes that don't show up in cached MHTML fixtures.

**New `tests/e2e/live-smoke.spec.js`** (3 tests)
- `content script boots on live rumble.com`. navigates to `RUMBLEX_LIVE_URL` (default `https://rumble.com/`), waits up to 30s for one of: an `rx-*` class on `documentElement` / `body`, a `#rx-settings-panel-css` style tag, or any `style[data-rx]` element. If none appear, the content script didn't boot.
- `header surface resolves against live DOM`. waits for the v2.0 selector-registry `header.root` surface (stable `header` or fallback `header.main-menu`). Catches Rumble shipping a new header class that breaks the registry.
- `service worker responds to getPrivacyReport`. opens a `*://*.rumble.com/*` tab from inside the SW context and verifies the content-script message round-trip works against the live origin.

**Opt-in gating**
- Spec self-skips when `RUMBLEX_LIVE_SMOKE !== '1'` via inline `test.skip(!LIVE, …)`. Default `npm run test:e2e` keeps showing them as skipped. no live network from regular CI.
- Routes block `googletagmanager` / `google-analytics` / `doubleclick` / `facebook.net` so noisy third-party loaders don't hang DOMContentLoaded.
- Per-test timeout 90 s (live network is slow).

**New npm script**. `test:e2e:live` invokes the spec directly. User sets `RUMBLEX_LIVE_SMOKE=1` in their shell (cross-env not introduced as a dep). `RUMBLEX_LIVE_URL` overrides the target.

**New `.github/workflows/live-smoke.yml`**. workflow_dispatch only, takes a `url` input (default rumble.com homepage), sets `RUMBLEX_LIVE_SMOKE=1` + `RUMBLEX_LIVE_URL` in env. Uploads `playwright-report-live` artifact with 14-day retention.

**package.json** bumped to 3.22.0.

### Deferred to v3.23+

- **HLS fallback for Channel Archive**. videos without `ua.mp4.*` direct URLs still error out. Largest remaining roadmap item.
- **File System Access folder picker**. Chrome-only opt-in for batchDownload + channelArchive target folders.
- **Userscript regeneration** (v4.0 acceptance criterion, multi-day).
- **Firefox MV3 conversion** (parallel path, MV2 stays supported indefinitely).

## [3.21.0] - 2026-05-19

### v3.21.0. Channel Archive max-height quality cap (Phase 3a)

Closes the v3.18 deferred-item "Per-job quality preference". users can now cap channel-archive downloads at a chosen resolution instead of always grabbing the highest available.

**New `channelArchiveMaxHeight` setting**
- Default `'best'` (current behavior preserved. highest direct-MP4).
- Other values: `'2160'`, `'1440'`, `'1080'`, `'720'`, `'480'`, `'360'`. Parsed as a numeric cap; the SW discoverer picks the highest direct-MP4 at-or-below this height.
- Group: Downloads. Exposed in the settings catalog META.

**SW discoverer update**. `rxDiscoverVideoQuality(videoSlug, maxHeight)` gained an optional `maxHeight` parameter. `rxProcessArchiveJob` reads `channelArchiveMaxHeight` from settings at job-process time (not enqueue time) so a user can change the cap mid-queue and the next pick honors it. Falls back to "best" if the value is missing or malformed.
- New specific error reason when a cap is in effect but no quality fits: `no-direct-mp4-under-NNNNp`. Shows in the failed-job row with the v3.18 retry button so users can either drop the cap or remove the job.

**Options-page UI**
- New select dropdown next to the channel-URL + maxItems inputs: "Best available / ≤ 2160p / ≤ 1440p / ≤ 1080p / ≤ 720p / ≤ 480p / ≤ 360p".
- Change handler persists immediately to `rx_settings` and shows a confirmation toast. Auto-syncs from storage on each panel refresh.

**Catalog parity** 206/206/206/206 (was 205). added `channelArchiveMaxHeight` (string, default `'best'`). No new permissions. Selector harness 85 pass / 17 fixtures unchanged.

### Deferred to v3.22+

- **HLS fallback for Channel Archive**. videos without `ua.mp4.*` direct URLs still fail with `no-direct-mp4`. Needs offscreen-doc transmux adaptation of the v2.2 mux.js path.
- **File System Access folder picker for batchDownload**. let users pick a sub-folder under Downloads instead of writing everywhere; persist handle in IndexedDB.

## [3.20.0] - 2026-05-19

### v3.20.0. Per-feature error log ring buffer (Observability workstream)

Closes the Observability cross-cutting workstream's Now-tier item: "Add a per-feature error-event ring buffer with the same shape: rolling-window-of-200, gated by a debug toggle, exposed via message API, no network." Mirrors the v3.0 selector-telemetry pattern exactly so the disclosure is consistent.

**New `RxErrorLog` content-script module**
- Rolling 200-entry in-memory ring buffer at `RxErrorLog._buf`. `record(featureId, error, context)` is a no-op unless `debugErrorLog` is on. same gating as `debugSelectorTelemetry`.
- Per-entry shape: `{ at, featureId, message, stack (top 8 frames), context, page }`. Bounded field sizes (featureId 80, message 500, context 200) so a flood from one bad feature can't blow out the buffer.
- `drain()` returns a snapshot. `clear()` empties.

**Instrumentation**
- Feature init loop in `boot()` now records to `RxErrorLog` on every `feat.init()` throw (in addition to the existing `console.error`). `SettingsPanel.init()` ditto.
- Other try/catch sites unchanged. Phase 1 just covers the highest-value class (feature initialization failures, which currently surface only in DevTools console and are easy to miss).

**Message API**
- `getErrorLog` → `{ ok, entries }` for export.
- `clearErrorLog` → `{ ok }` for manual reset.

**Options-page UI**
- Two new buttons in the v3.1 Privacy report section's button row: "Export error log" and "Clear error log". Same placement style as the existing "Export selector telemetry" button.
- Export goes through `sendToContent` so it pulls from the active rumble.com tab. Empty buffer shows a hint to enable `debugErrorLog` first.

**Privacy report update**. `rxBuildPrivacyReport.notes` now includes a line stating whether the error-log ring buffer is collecting. Honest disclosure: any debug instrumentation that *could* collect data is enumerated, even when off.

**Catalog parity** 205/205/205/205 (was 204). added `debugErrorLog` (boolean, default OFF, group: Privacy). No new permissions, no new selectors. Selector harness 85 pass / 17 fixtures unchanged.

### Deferred to v3.21+

- **Finer-grained instrumentation**. Phase 2 will wire `RxErrorLog.record` into Selectors lookup failures, message-handler catch blocks, and high-traffic features (LiveChatEnhance, RantPersist, VideoDownloader). Phase 1 catches the highest-frequency class (boot-time init failures) with one wiring point.
- **HLS fallback for Channel Archive**. still pending; needs offscreen-doc transmux adaptation.

## [3.19.0] - 2026-05-19

### v3.19.0. Channel Archive Phase 2 (in-page "Archive channel" button)

Drops the v3.18 enqueue UI from the options page directly into the channel header. One click instead of three.

**New `ChannelArchiveButton` content-script feature module**
- Activates only on `Page.classify() === 'channel'` pages (`/c/<slug>` or `/user/<slug>`). Setting key `channelArchiveButton` (default ON, group: Integrations).
- Anchors to the existing Follow/Following toggle via `Selectors.find('profile.followingBtn')` (the selector registered in v3.14 as `button[data-js="button__following"]`).
- Renders an "Archive channel" pill-free button (border-radius 6, per house style) styled to match the Rumble-accent palette. SVG archive-box icon + label.
- One click sends `archiveEnqueueChannel` with the current channel URL, default 50 items, no clip filter. same SW handler the v3.18 options-page form uses. Disables itself during the round-trip; re-enables on response.
- Result surfaces as an in-page toast via the v3.14 `rxShowToast` infrastructure: `Queued N videos. Check RumbleX options → Channel archive queue.` Failure surfaces the same SW reason codes (`bad-channel-url`, `no-videos-found`, …) the options page sees.
- MutationObserver re-attaches if the Follow button re-renders (Rumble's channel SPA swaps it on follow-state changes).

**Catalog parity** 204/204/204/204 (was 203). added `channelArchiveButton` boolean. Selector harness 85 pass / 17 fixtures unchanged.

### Deferred to v3.20+

- **HLS fallback for direct-MP4-less videos**. v3.18 only handles `ua.mp4.*` direct URLs. Some uploads only ship HLS segments. Requires adapting the v2.2 mux.js transmux path for SW or offscreen-document context.
- **Per-job quality preference**. currently picks the absolute highest quality. A future "max height" setting would cap at 720p/1080p for storage reasons.

## [3.18.0] - 2026-05-19

### v3.18.0. Channel Archive Queue Phase 1 (closes the marquee Later-tier item)

Materializes the v2.0 `channelArchive*` setting keys into the headline feature people install a Rumble extension for: paste a channel URL, walk away, come back to a folder of MP4s. **Browser-side, no Flask backend**. beats the [nullEFFORT/rumble-downloader](https://github.com/nullEFFORT/rumble-downloader) reference implementation by not requiring a Python server.

**Persistent queue (chrome.storage.local)**
- `rx_archive_queue` = `{ jobs: [...], paused: boolean, version: 1 }`. Survives SW restarts and full browser restarts (re-syncs the drain alarm on `chrome.runtime.onStartup`).
- Job shape: `{ id, channelUrl, channelName, videoId, videoUrl, videoTitle, status, qualityFound?, filename?, downloadId?, error?, addedAt, completedAt }`.
- Status states: `pending` → `discovering` → `downloading` → (`completed` | `failed`).
- Queue cap: 500 jobs. Completed jobs older than 7 days auto-prune on each tick.

**Drain mechanism**
- `chrome.alarms` `rx-archive-tick` fires every minute. Drains up to `downloadConcurrency` (v2.0 setting, default 2, range 1 to 8) pending jobs concurrently.
- Each drained job hits `https://rumble.com/embedJS/u3/?request=video&ver=2&v=<id>`. same endpoint VideoDownloader uses in [extension/content.js:2239](extension/content.js#L2239). Picks the highest-resolution `ua.mp4.*` direct URL.
- `chrome.downloads.download()` with `conflictAction: 'uniquify'`, target subfolder `RumbleX/<sanitized-title>_<quality>.mp4`. URL is verified against the existing `isAllowedDownloadUrl` allowlist (rumble.com / 1a-1791.com / rumble.cloud).
- `chrome.downloads.onChanged` listener watches the tracked `downloadId`. flips jobs to `completed` on `complete`, `failed` on `interrupted`.

**Background message API**
- `archiveEnqueueChannel({ channelUrl, maxItems, filterClips })`. SW-fetches the channel page (`credentials: 'include'`), regex-extracts up to N video rows, dedups against current queue, returns `{ ok, enqueued, skipped, channelName }`. Two-pass parser: primary uses `<a class="videostream__link" href="/v..."` + `<h3 class="thumbnail__title">`, fallback to bare anchor scan. `filterClips` skips entries titled `Clip:` or under `/clips/`.
- `archiveGetQueue`. returns the full queue object.
- `archivePauseQueue` / `archiveResumeQueue`. toggles `paused`.
- `archiveClearCompleted` / `archiveClearQueue`. bulk-remove.
- `archiveRemoveJob({ id })` / `archiveRetryJob({ id })` / `archiveRunNow`. per-job ops.

**Options-page UI** ("Channel archive queue" section, placed above v3.17 Encrypted Gist Sync)
- Form: channel URL input + max-items number (default 50, 1 to 500) + "Skip clips" checkbox + Enqueue button.
- Status row with five state counts. Pause/Resume toggle. Run-now / Clear-completed / Clear-all buttons.
- Per-job rows: title (or video id) + status + quality + channel + error, with Open (deep link), Retry (failed-only), Remove actions.
- Live refresh via `chrome.storage.onChanged`. the panel updates in real time as jobs progress.

**No new permissions, no new settings keys**. `channelArchiveEnabled`, `channelArchiveFilterClips`, `channelArchiveMaxItems`, `downloadConcurrency`, `batchDownload` all exist since v2.0. Catalog parity 203/203/203/203 unchanged. Selector harness 85 pass / 17 fixtures unchanged.

### Deferred to v3.19+

- **Phase 2: content-script "Archive this channel" button**. currently the user pastes the channel URL on the options page. The next pass adds a one-click button on `/c/<slug>` pages.
- **HLS fallback for videos without a direct MP4**. current phase only handles videos that expose `ua.mp4.*` direct URLs. Some recent uploads only ship as HLS (`.tar` segments); those will need the v2.2 mux.js transmux path adapted for SW or offscreen-document context.
- **Per-job quality preference**. currently picks the absolute highest direct MP4. A future "max height" setting would let users cap at 720p/1080p for storage reasons.

## [3.17.0] - 2026-05-19

### v3.17.0. Encrypted Gist Sync (closes the v2.0 `encryptedGistSync` key)

Materializes the v2.0 placeholder boolean into actual cross-device settings sync. Zero RumbleX-side infrastructure. the user brings their own GitHub gist and their own passphrase. **AES-GCM-256 + PBKDF2-SHA256 with 200,000 iterations**. same KDF tier as 1Password / Bitwarden defaults.

**Background-side crypto handlers**
- New `gistSyncPush` action: derives a 256-bit AES-GCM key via WebCrypto PBKDF2-SHA256 (200k iters, random 16-byte salt per push) from the user-provided passphrase, encrypts the full `rx_settings` JSON with a random 12-byte IV, wraps it in a `{ rumblex: { schemaVersion, cipher, kdf, salt, iv, ciphertext, encryptedAt } }` envelope, and PUTs to a private GitHub gist (POST + auto-save id on first push, PATCH thereafter). All base64-encoded.
- New `gistSyncPull` action: GETs the gist, derives the key from the SAME passphrase + the stored salt, decrypts, validates the schema, snapshots current settings as `pre-gist-pull` via the v3.0 backup system, then writes the decrypted settings back to `chrome.storage.local`. Preserves the LOCAL token + gist-id post-pull so the user doesn't get logged out of their own sync target.
- Failure-mode taxonomy: `missing-token` | `missing-gist-id` | `weak-passphrase` | `bad-passphrase` | `no-payload` | `malformed-payload` | `bad-json` | `bad-decoded-json` | `http-NNN`. Each surfaces a specific user-facing message in the options page.

**Options-page side**
- New "Encrypted gist sync" section above the v3.16 RantStats section. Three password-type inputs (PAT, gist id, passphrase) plus Push / Pull buttons.
- Token + gist id are persisted to `rx_settings` so they auto-fill on page reload. Passphrase is **never stored**. entered on every push/pull.
- Setup instructions link directly to <https://github.com/settings/tokens?type=beta>. First push creates a private gist named `rumblex-settings.enc.json` and auto-saves its ID for subsequent pushes.
- Pull auto-reloads the options page after success so every section re-reads from storage.

**Privacy report update**. `rxBuildPrivacyReport` now states whether Encrypted Gist Sync is configured and how the payloads are protected. The honest `externalNetworkSurfaces` line for `api.github.com` is upgraded from "release version check, manual" to "release version check + opt-in Encrypted Gist Sync".

**Catalog parity** 203/203/203/203 (was 201). added `encryptedGistSyncToken` (string, default `''`) and `encryptedGistSyncId` (string, default `''`). The original boolean `encryptedGistSync` stays the user-facing master toggle, surfaced in the existing settings catalog.

**No new permissions.** `api.github.com` was already in `host_permissions` since v3.0 for release version checks. Selector harness: 85 pass / 17 fixtures unchanged. `node --check` clean across all four JS files.

### Deferred to v3.18+

- **Mediabunny / WebCodecs migration**. still pending; multi-day work.
- **declarativeNetRequest autoplay rules**. still pending; needs live network trace.
- **Channel archive queue**. chrome.alarms + chrome.offscreen + persistent queue. Infra all present; next reasonable v3.x slot.

## [3.16.0] - 2026-05-19

### v3.16.0. RantStats panel (closes the v3.3 Now-tier acceptance criterion)

Materializes the `rantStatsPanel` setting key shipped in v2.0 into an actual feature. Beats the single Chrome competitor ([RantStats v1.5.3](https://chromewebstore.google.com/detail/rantstats-extension-for-r/liahjgfmodjgeakahommamnmbjgicpmh)) on local-only-by-default + integration with the rest of RumbleX (uses the existing RantPersist cache instead of standing up a parallel scrape pipeline).

**Content-script side (RantPersist mirror)**
- `RantPersist._cache()` now debounce-mirrors each cached rant to `chrome.storage.local` under a single `rx_rant_stats_mirror` key. Per-video cap of 200 rants × 30 videos (vs. localStorage's 500 × 100 source-of-truth cap). keeps the mirror well under Chrome's default 10 MB local-storage quota.
- Mirror shape: `{ videos: { "<videoId>": { title, url, lastTs, read, rants:[...] } } }`. `title` resolved from `<meta property="og:title">` first, then falls back to `<title>` with Rumble's trailing title suffix removed.
- Existing localStorage `rx_rants_<videoId>` cache is unchanged. preserves v2.4 `RX_LOCAL_STORAGE_KEYS` backup-import allowlist behavior.

**Options-page side (RantStats panel)**
- New "Rant stats" section above the v3.10 multi-profile section. Reads the mirror directly via `chrome.storage.local.get`. no new background message handlers needed.
- Per-video cards: title + rant count + aggregate USD + last-seen timestamp + read indicator. Sorted newest-first by `lastTs`.
- Per-video actions: "Open" (deep-links to the watch page in a new tab), "Mark read" / "Mark unread", "Remove" (deletes the video from the mirror).
- Footer totals row: total rants across all videos, aggregate USD (price-string parsed via `[\d.]+` regex. handles `$5`, `$25.00`, `5 USD`, `€5`), unique chatter count.
- Top-row buttons: "Refresh", "Export JSON", "Export CSV", "Clear all".
- JSON export: structured payload with `exportedAt`, per-video drill-down. Same `downloadJsonBlob` path as v3.10 OPML / v3.11 comment / v3.15 watch-history exports.
- CSV export: nine columns (`videoId`, `videoTitle`, `videoUrl`, `ts`, `tier`, `price`, `priceUsd`, `user`, `text`). Standard CSV quoting (double-up internal quotes, wrap fields containing `, " \n \r`).
- Live refresh: `chrome.storage.onChanged` listener auto-refreshes the panel when the content-script mirror updates, so an open options tab sees fresh data without manual reload.

**No new permissions, no new settings keys.** Catalog parity 201/201/201/201 unchanged. Selector harness: 85 pass / 17 fixtures unchanged. `node --check` clean across all four JS files.

### Deferred to v3.17+

- **Side-panel target swap**. currently the RantStats panel lives in the options page (which is also the side-panel default-path). A future `pages/rantstats.html` could be a dedicated lightweight side-panel target via `chrome.sidePanel.setOptions({ path })`. The options-page section already covers the v3.3 acceptance criterion.
- **BulkRemoveFromHistory**. still pending. The v3.14 `history.itemMenuTrigger` selectors stay reserved.

## [3.15.0] - 2026-05-19

### v3.15.0. Watch History export (account-data round-trip)

Completes the v3.13 "import" / v3.14 "block" pair with the missing read-side: structured export of the user's own watch-history feed. Local-only, no third-party network, no telemetry.

**New "Export Watch History" button** (new "Account data export" section on the options page, placed above the v3.10 multi-profile section)
- Background SW fetches `https://rumble.com/account/playlists/watch-history` with `credentials: 'include'`. same SW-fetch pattern as v3.13's `importFollowedChannels`.
- Regex-parses every `<li class="videostream__details" data-video-id="…">` row in the response into a structured row: `videoId`, `title`, `url` (canonical, query-stripped), `duration`, `watchedPercentage`, `thumbnail`, `channelUrl`, `channelName`.
- Downloads the result as `rumblex-watch-history-<ISO>.json` via the existing `downloadJsonBlob()` helper. same delivery path as the v3.10 OPML export and v3.11 comment export.
- Detects logged-out responses by absence of the `videostream_details` / `data-playlist="watch-history"` markers. Toast suggests sign-in.

**New message API**: `exportWatchHistory` → `{ ok, count, exportedAt, items: [...] }` or `{ ok: false, reason: 'not-logged-in' | 'http-XXX' | <error string> }`.

**No new permissions, no new settings keys, no new selectors**. the `history.*` selectors registered in v3.14 are reserved for the future in-tab BulkRemoveFromHistory module; this release uses the v3.13 SW-fetch + regex-parse strategy because it does not require an open tab.

**Catalog parity:** 201/201/201/201 unchanged. Selector harness: 85 passes across 17 fixtures unchanged. `node --check` clean across all three JS files.

### Deferred to v3.16+

- **BulkRemoveFromHistory**. still pending. Tab-side menu automation through `history.itemMenuTrigger` + `history.itemMenuOption`. The SW-fetch export shipped here covers the read use case; bulk-delete is the orthogonal write use case.
- **Profile follow-toggle automation**, **Studio scene tools**, **chat-username submenu context-menu entry**, **chrome.declarativeNetRequest autoplay rules**. all still blocked on missing live captures or multi-day rewrites; see ROADMAP.

## [3.14.0] - 2026-05-19

### v3.14.0. "Block this channel" context-menu entry + 11 new Selectors from MHTML batch

**New context-menu entry: "Block this channel from feeds"**
- Extends the v3.5 contextMenus integration. Appears on right-click of any `/c/<slug>` or `/user/<slug>` link, or on a channel page itself. Scoped via `targetUrlPatterns` so it doesn't appear on non-channel links.
- Extracts the channel slug from the URL (lowercase, matching the existing `ChannelBlocker` storage shape). Appends to the `blockedChannels` array. No-ops with toast when already blocked.
- Confirmation surfaces as an in-page toast via the new `rxShowToast` message. keeps the result on the same page the user just acted on instead of opening a popup or browser notification.

**11 new Selectors registry entries** (now 51 total, up from 37)
- `library.watchHistorySection` / `library.watchLaterSection` / `library.userPlaylistsSection` / `library.videoGrid`. `/library` page surfaces.
- `history.clearAllBtn` / `history.pauseToggleBtn`. bulk-action buttons on `/account/playlists/watch-history`.
- `history.videoList` / `history.videoDetails` / `history.itemMenuTrigger` / `history.itemMenuOption`. per-item watch-history surfaces (foundation for the future BulkRemoveFromHistory feature).
- `profile.followingBtn`. follow/unfollow toggle on `/c/<channel>` profile pages.
- All sourced from the 2026-05-19 MHTML batch (Watch History / Watch Later / My Library / Profile fixtures).

**Regression harness:** 85 passes across 17 fixtures (was 75). All 11 new selectors verified against their target captures.

**Catalog parity:** 201/201/201/201. New `rxShowToast` message handler in content.js. No new manifest permissions (uses existing `contextMenus` + `scripting`).

### Deferred to v3.15+

- **BulkRemoveFromHistory** module. `history.itemMenuTrigger` selectors registered but no consumer yet. The watch-history rows open a menu (popout) on click that contains the "Remove" option. the bulk pattern is more involved than BulkUnsubscribe (which has a direct row-button). Worth ~half a release on its own.
- **Profile follow-toggle automation**. `profile.followingBtn` registered. Could feed a "channel auto-follow on first visit" feature. Niche; defer.

## [3.13.0] - 2026-05-19

### v3.13.0. Import followed channels into the notifier

Closes the obvious next-step that fell out of v3.9 + v3.12: now that the watchedChannels notifier exists *and* the Followed Channels page structure is known from the 2026-05-19 MHTML batch, users shouldn't have to manually paste every channel URL.

**New "Import from Followed" button on the Channel Notifier section**
- Background SW fetches `https://rumble.com/account/following` with `credentials: 'include'` so the user's session cookies authenticate the request (host permission for rumble.com is already declared).
- Parses every `<li class="followed-channel" data-type="channel">` row. channel URL from the `/c/` or `/user/` link, name from `<span class="line-clamp-2">`. Query params stripped so imported URLs are canonical.
- Detects logged-out responses by absence of the `followed-channels__section` marker. Toast suggests "sign in on rumble.com first, then retry."
- Deduplicates against existing watchedChannels. Toast reports `Scanned N · added X · skipped Y duplicate(s) · total now Z`.
- Re-syncs the notifier alarm after import so the new channels start being polled on the next tick (no extension reload needed).

**Three new Selectors registry entries**
- `account.followedChannelsItem`. `li.followed-channel[data-type="channel"]`
- `account.followedChannelsItemLink`. channel URL inside the row
- `account.followedChannelsItemName`. `.line-clamp-2` channel name

**New message API**: `importFollowedChannels` → `{ ok, scanned, added, duplicates, total }` or `{ ok: false, reason: 'not-logged-in' | 'http-XXX' | <error string> }`.

**Catalog parity:** 201/201/201/201. Selector harness: 78 passes / 17 fixtures (3 new account selectors verified against Followed Channels.mhtml).

## [3.12.0] - 2026-05-19

### v3.12.0. BulkUnsubscribe + Selectors tightening from new MHTML batch

User dropped **13 new MHTML captures** into `Sample Pages/` (Shorts, Recurring Subs, Followed Channels, Rumble Studio, Watch History, Watch Later, My Library, Profile, Editor Picks, Trending, Browse, Stats & Analytics, Sticker Mule). This release unblocks the highest-value items they enable.

**Selectors registry tightened (12 → 37 entries; 32 → 37 from this batch)**
- **`shorts.feed` / `shorts.card` / `shorts.player`**. replaced the v3.1 conservative `data-js="shorts_*"` placeholders with the real semantic class names verified against `Sample Pages/Shorts.mhtml`: `rum-shorts-feed__screen-container`, `rum-shorts-screen__aspect-box`, `rum-shorts-player-overlay`. Hashed-prefix utility tokens (`rum-4oaq3e`) stay untouched per house style.
- **`shorts.navItem`**. new entry. `[class*="rum-shorts-navigation__item"]`.
- **`account.recurringSubsCancelBtn`**. `button[data-js="cancel_recurring_subscriptions"]`. The per-row Cancel button on `/account/subscriptions/recurring` (paid Locals).
- **`account.recurringSubsRow`**. `tr:has(...)` wrapper around the row.
- **`account.followedChannelsSection`**. `[data-js="followed-channels__section"]`. Container.
- **`account.followedChannelsUnsubBtn`**. `button[data-action="unsubscribe"][hx-post*="legacy-video-collection"]`. Per-row Unsubscribe button on `/account/following`.

**Regression harness extended**
- `FIXTURE_EXPECTATIONS` now covers all 17 fixtures with per-page surface lists. Trending + Browse list `header.root` only (their feed cards lazy-load via htmx after initial render). Sticker Mule store has an empty expectation list (3rd-party domain). Stats and Studio assert only the header. Studio is a heavy SPA with sparse static HTML; the harness emits a `WARN` when only the fallback selector matches there.
- **75 surface resolutions across 17 fixtures, 0 failures.** Up from 35/4.

**New `BulkUnsubscribe` module** (closes v2.5 "Bulk unsubscribe with preview, stop, undo toast" ROADMAP item)
- Mounts a sticky-top toolbar on `/account/following` and `/account/subscriptions*` pages when `bulkUnsubscribeEnabled` is on. Inserts a checkbox at the start of each row containing a native Unsubscribe/Cancel button.
- Three actions: **Select all** / **Clear** / **Run** / **Stop**.
- **Honors `bulkUnsubscribeDryRun`** (default ON from v2.0). With dry-run on, "Run" counts what would happen and shows a toast. no native button is clicked. The toolbar displays a visible "DRY-RUN" tag so this is unambiguous. User must explicitly flip `bulkUnsubscribeDryRun` OFF to actually unsubscribe.
- **350 ms inter-click pacing** so htmx requests don't pile up and trip Rumble's rate limit.
- **Stop button** aborts the in-flight loop cleanly. Each clicked row's checkbox unchecks itself so a re-run doesn't double-process.
- Honest UX: the toast at end reports `Done: unsubscribed from N` or `Stopped after N`.
- Re-evaluates on every `Router.onChange` so navigating between `/account/*` subsections re-mounts the bar correctly.

**Catalog parity:** 201/201/201/201 unchanged (BulkUnsubscribe consumes the existing `bulkUnsubscribeEnabled` + `bulkUnsubscribeDryRun` keys from v2.0).

### Deferred to v3.13+

- **Studio scene tools**. Studio.mhtml has minimal static HTML (heavy SPA, content renders after JS). Will need a second capture WHILE inside the Studio editor (mid-stream) to extract scene-mover selectors.
- **`account.profile.*`** / **`account.library.*`** selectors. Watch History / Watch Later / My Library / Profile fixtures need expectations refined once specific features target them.

## [3.11.0] - 2026-05-19

### v3.11.0. Comment Export module

Closes the v2.0 `commentExport` setting key that has shipped with no consumer module for nine releases.

**New `CommentExport` feature module**
- Mounts an "Export comments" button at the top of `Selectors.find('comments.root')` on watch pages when `commentExport` is on. Anchors via the v2.0 Selectors registry; re-anchors on htmx route changes via `Router.onChange`.
- **Click → JSON download.** Payload: `{ exportedAt, pageUrl, pageTitle, count, comments: [{ id, author, text, votes, ts }] }`. Pretty-printed with `JSON.stringify(_, null, 2)`.
- **Shift-click → CSV download.** Same fields, RFC 4180-style escaping (quote-wrap when the value contains `"`, `,`, `\n`, or `\r`; doubled quotes inside).
- Extraction iterates `Selectors.findAll('comments.item')` so the data model tracks the v2.0 selector registry. when Rumble's DOM shifts, only `Selectors._map` needs an update.
- Filename pattern: `YYYY-MM-DD_<sanitized-title>_comments.{json,csv}`.
- Honest UX: only exports comments Rumble has actually loaded. Toast tells the user the count so they know whether to scroll-to-load-more before re-exporting.

**Catalog parity:** 201/201/201/201 (commentExport key was already in catalog since v2.0).

## [3.10.0] - 2026-05-19

### v3.10.0. Watched-channels OPML export + multi-profile settings UI

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

### v3.9.0. Channel Notifier (chrome.alarms + chrome.notifications + Discord webhook)

Closes the v3.x ROADMAP "Channel monitor with optional Discord webhook" item. was deferred at v2.5 + v3.x because it needed `chrome.alarms` + `chrome.notifications` plumbing the extension didn't have. Now wired end-to-end.

**Backend (`background.js`)**
- New permissions: `alarms`, `notifications`. Chrome MV3 + Firefox MV2.
- `rxSyncChannelNotifier()` registers a single `rx-channel-notifier` alarm with `periodInMinutes: channelNotifierIntervalMin` (default 30, MV3 floor 1). Re-syncs live on every settings flush via `chrome.storage.onChanged`.
- `rxRunNotifierPass()` runs on each alarm tick: fetches every watched channel URL, parses HTML for the most recent `data-video-id` + a `videostream__status--live` / `channel__live-on-air` / `aria-label*="Live"` indicator, fires `chrome.notifications.create()` when state changes (new video ID or live started). Notification clicks open the channel URL in a new tab via `chrome.notifications.onClicked`.
- `rxPostDiscordWebhook()` optionally POSTs a JSON `{ content }` payload to the user-provided `discordWebhookUrl` after every notification. Failure is swallowed; the OS notification still fires.
- All fetches scoped to the existing rumble.com host permissions. no new origins.

**New settings keys**
- `watchedChannels: []`. array of `{ url, name, lastSeenVideoId, isLive, lastChecked, lastError }` objects. Managed via UI (see below).
- `channelNotifierIntervalMin: 30`. poll interval. Editable from the Settings editor; live alarm resync on change.

**Options-page UI (new section between Snapshot history and Privacy report)**
- Add-channel form: URL input + optional display name + "Add channel" button. Backend validates that the URL is `rumble.com` and not a duplicate.
- Watched-channels list: name + URL + last-checked timestamp + LIVE tag when applicable + error tag when fetch failed. Per-row **Remove** button.
- **Run check now** button. fires `rxRunNotifierPass()` immediately without waiting for the next alarm tick.
- **Send test notification** button. fires a sample `chrome.notifications.create()` so users can verify OS-level permissions are granted.
- Section gated by `channelNotifierEnabled`. summary line shows "disabled" tag when off.

**Message API** (extension-origin only, not exposed to content scripts)
- `addWatchedChannel({ url, name })` → `{ ok, count, reason? }` with validation reasons `bad-url`/`not-rumble`/`duplicate`/`parse-failed`.
- `removeWatchedChannel({ url })` → `{ ok, count }`.
- `runNotifierNow()` → `{ ok, reason? }`.
- `testNotification()` → `{ ok, id }`.

**Catalog parity:** 201/201/201/201.

**Deferred to v3.10+:** RSS/OPML export of watched channels (uses the same list, `rssExportEnabled` key from v2.0). Multi-stream auto-open when several watched channels go live simultaneously.

## [3.8.0] - 2026-05-19

### v3.8.0. axe-core accessibility regression spec

Closes the v4.0 ROADMAP cross-cutting **Accessibility** workstream "Next" item: "Color-contrast pass with axe DevTools."

**axe-core Playwright spec (`tests/e2e/a11y.spec.js`)**
- Three test cases scan the static extension pages with the standard `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice` ruleset:
  1. **Options page**. landed-state with v3.1 snapshot + privacy sections rendered.
  2. **Options settings modal**. dirty-draft workspace with every settings card rendered.
  3. **Popup**. feature groups + toggles.
- **Fail policy**: any `critical` or `serious` impact violation fails the build. `moderate`/`minor` are logged as a warning summary for hand-triage each release.
- Targeted rule changes: `region` rule disabled (popup is intentionally a single 320 px landmark).

**Dependencies**
- `@axe-core/playwright@^4.10` + `axe-core@^4.10` added to `package.json` devDependencies.
- New `npm run test:e2e:a11y` script for local-only a11y runs.

**CI**
- The opt-in `.github/workflows/e2e.yml` workflow gains an `Accessibility audit (axe-core)` step after the main E2E suite. Same opt-in `workflow_dispatch` trigger. doesn't burn CI minutes on every push.

**Catalog parity:** 199/199/199/199 unchanged (a11y is a test-only addition).

## [3.7.0] - 2026-05-19

### v3.7.0. chrome.sidePanel integration

Closes the v3.3 ROADMAP "chrome.sidePanel" item. Adds a third entry-point to RumbleX settings: a persistent side panel that survives every htmx navigation (unlike the popup, which closes the moment the user clicks anywhere outside it).

**Side panel registration**
- New `sidePanel` permission + `side_panel.default_path: "pages/options.html"` in `manifest.json`. Chrome/Edge only. Firefox MV2 doesn't have the API; manifest stays unchanged there.
- New setting `sidePanelEnabled` (default OFF. opt-in so we don't surprise existing users). When ON, `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` makes the toolbar icon open the side panel directly instead of the popup. When OFF, the popup is restored.
- Live toggle: `chrome.storage.onChanged` re-runs `rxSyncSidePanel()` whenever `rx_settings` changes. no extension reload needed to flip behavior.
- New group placement: lives under **Integrations** in the options page (alongside `contextMenusEnabled` and `discordWebhookUrl`).

**Hosts the existing options UI**
- The side panel points at `pages/options.html`. same page the options tab uses. This means the full v3.0 settings editor + v3.1 backup snapshot history + v3.1 privacy report + v3.5 contextMenus toggle all work inside the panel with zero extra code.
- Future v3.x work (RantStats panel from v3.3, bulk unsubscribe UI from v3.4, multi-stream viewer scaffolding) can mount as sub-views inside the same side-panel host without touching the manifest again.

**Catalog parity:** 199/199/199/199.

## [3.6.0] - 2026-05-19

### v3.6.0. CompressionStream gzip exports + chrome.tabGroups + import-side decompression

Three more "Later"-tier atomic wins from the v4.0 ROADMAP.

**CompressionStream gzip exports**
- Settings + per-origin localStorage backup is now gzipped via `CompressionStream('gzip')` before download. Typical export drops from 1 to 10 MB to ~200KB to 2MB (~80% reduction). Filename gains `.gz` extension; toast shows the compressed size.
- Falls back to plain JSON if `CompressionStream` is unavailable (very old Chromium). no user-visible failure path.
- Universal browser support confirmed via [web.dev's Compression Streams API article](https://web.dev/blog/compressionstreams).

**Import-side gzip auto-detection**
- Import accepts `.json` and `.json.gz`. Magic-byte sniffing (`0x1f 0x8b`) detects gzip regardless of file extension; `DecompressionStream` does the work. Plain-JSON exports from earlier versions still import unchanged.
- `<input type="file">` `accept` attribute extended to `.json,.gz,application/json,application/gzip`.

**chrome.tabGroups: "Group all Rumble tabs"**
- New popup-footer button (left-most icon, before settings gear). One click groups every open `rumble.com` tab into a single colored tab group titled "Rumble" with green accent.
- New permissions: `tabs`, `tabGroups` (Chrome only. Firefox MV2 doesn't have the API; popup button still appears and reports `no-tabgroups-api` with a visible error tint).
- Background message: `groupRumbleTabs` → returns `{ ok, count, groupId }` on success or `{ ok: false, reason }` on failure (`no-rumble-tabs`, `no-tabgroups-api`, error message).
- Tooltip cycling shows live status: "Grouped 5 tabs" on success, "No Rumble tabs open" / "Tab groups not supported in this browser" on failure.

**Catalog parity:** 198/198/198/198 unchanged (tabGroups feature isn't a per-setting toggle. it's a one-shot action).

## [3.5.0] - 2026-05-19

### v3.5.0. chrome.contextMenus + opt-in Playwright E2E + ES/PT-BR locale drafts

Three v3.3 to v3.5 ROADMAP items closed in one focused release.

**chrome.contextMenus integration**
- New permission `contextMenus` + `scripting` (latter for clipboard fallback). Three menu entries, all scoped to `*://*.rumble.com/*` via `documentUrlPatterns` so they never appear on other sites:
  - **Copy clean URL (strip tracking)**. works on link + page contexts. Strips the same v2.4 allowlist (`e9s`, `utm_*`, `ref`, `campaign`, `fbclid`, `gclid`, etc.) on the service-worker side so right-clicked links (whose URL the content script never saw) get the same treatment.
  - **Copy URL at current time**. works on page + video contexts. Sends a `getVideoStateAtTime` message to the active tab, reads `video.currentTime` and the cleaned URL, builds a `?start=` link matching Rumble's native timestamp format and v1.x `shareTimestamp` module. Falls back to plain clean URL when no video element is on the page.
  - **Open RumbleX settings**. page + action contexts. Calls `chrome.runtime.openOptionsPage()`.
- New setting `contextMenusEnabled` (default ON). Toggling it off live re-syncs via `chrome.storage.onChanged`. the SW removes the menu entries without a reload.
- Copy helper uses `chrome.scripting.executeScript` to run a tiny in-tab clipboard write (Service Workers can't access `navigator.clipboard` directly). Includes legacy `execCommand('copy')` fallback for older Chromium builds.
- Menu entries registered on `chrome.runtime.onInstalled`. `removeAll()` first to avoid duplicate-id errors on extension update.

**Opt-in Playwright E2E suite**
- New `package.json` + `playwright.config.js` + `tests/e2e/` directory. Run locally with `npm install && npm run test:e2e`.
- `tests/e2e/_fixtures.js` extends Playwright's test base with a persistent Chromium context that pre-loads the MV3 extension via `--load-extension`. Each test gets its own temp profile so `rx_settings` doesn't leak between cases.
- First-pass coverage: extension service worker boots within 15 s (`extension-loads.spec.js`), options page renders the v3.1 snapshot + privacy sections, popup renders feature groups with `aria-pressed` toggles, settings modal dirty-draft search filters correctly, catalog parity sanity ≥ 180 boolean cards (`settings-modal.spec.js`).
- New `.github/workflows/e2e.yml` runs on `workflow_dispatch` only. avoids the ~200 MB Chromium download on every push. Uploads `playwright-report/` as an artifact with 7-day retention.
- Test artifacts (`node_modules/`, `playwright-report/`, `test-results/`, `.playwright/`) added to `.gitignore`.

**Spanish + Brazilian Portuguese locale drafts**
- `extension/_locales/es/messages.json` and `extension/_locales/pt_BR/messages.json`. 32/32/32 key parity with the English source. Marked as initial translations needing human review before store publish (description fields call this out explicitly).
- Both locale folders use underscore (`pt_BR`, not `pt-BR`) per Chrome i18n folder-naming convention.

**Catalog parity:** 198/198/198/198.

## [3.4.0] - 2026-05-19

### v3.4.0. Regression harness + CI

Closes the v3.4 ROADMAP item "MHTML fixture replay harness" and tightens the existing build workflow into a true gate.

**Selector regression harness**
- New `test_selectors.py` at the repo root. stdlib-only Python script (matches `analyze_pages.py` precedent, no `pip install` required). Walks every `Sample Pages/*.mhtml` fixture, extracts the HTML payload, then asserts every named surface in `Selectors._map` resolves to at least one element via its stable or fallback selector. Mixed-quote selectors (single-quoted outer with double-quoted attribute values, and vice versa) are handled via a permissive string-pattern matcher.
- Uses regex / substring matching rather than a real CSS engine. sufficient because we're checking "this selector pattern appears in the HTML at all", not "this selector parses into a valid CSS AST".
- Fixture expectations are per-file via `FIXTURE_EXPECTATIONS` so we don't fail when a surface only exists on one route kind (e.g. `chat.*` is checked on `Live.mhtml`, not `For You.mhtml`).
- 35 surface resolutions across the 4 shipped fixtures pass on first run. Warns (does not fail) when only the fallback matched. useful selector-drift signal.

**CI tightening**
- `.github/workflows/build.yml` gains a `test` job that runs on every push to `main` and every PR (not just on release tags). The job runs the selector harness, `node --check` on every shipped JS file, and a catalog-parity assertion (197/197/197). The existing `build` job now `needs: test`, so a regression PR can't ship.
- `pull_request` trigger added. every external contribution is now validated automatically.

## [3.2.0] - 2026-05-19

### v3.2.0. Target-size 24px + chrome.offscreen scaffolding

Two Now/Next-tier closes from the v4.0 ROADMAP.

**Accessibility (WCAG 2.2 SC 2.5.8 Target Size)**
- Popup toggle bumped 34×18 → 40×24 (track) + 14×14 → 20×20 (thumb). Translate offset re-computed to stay correct.
- In-page settings-modal switch bumped 40×22 → 40×24 (track) + 16×16 → 18×18 (thumb). Translate offset re-computed.
- Options-page toggle already at 44×26. no change needed, recorded as compliant.
- Toggle-switch full-rounded shape preserved per the no-pill-backdrops rule's explicit exception for toggle thumbs and tracks.

**MV3 offscreen-document scaffolding** (preparing the v3.3 sidePanel + RantStats panel work)
- New `extension/offscreen.html` + `extension/offscreen.js` host two read-only operations: `parseHtml` (DOMParser via DOM_PARSER reason) and `hashBlob` (fetch + SHA-256 via BLOBS reason).
- New `background.js` helpers: `ensureOffscreenDocument()` honors Chrome's "one offscreen doc per extension per profile" contract via `chrome.offscreen.hasDocument()`. `callOffscreen(action, payload)` is the single async call site. Reasons declared at creation: `DOM_PARSER` + `BLOBS` + `WORKERS`.
- New message-API surfaces: `parseHtmlOffscreen` and `hashBlobOffscreen`. Content scripts cannot call `chrome.offscreen.*` directly. they go through the service worker. Falls back to a structured `{ ok: false, reason: 'no-offscreen' }` response if offscreen is unsupported (Firefox MV2 or older Chrome) so callers can degrade gracefully.
- `offscreen` permission + web-accessible-resource entry added to `manifest.json` (Chrome MV3 only). Firefox MV2 doesn't have the API; manifest stays unchanged there.
- Build script + GH Actions workflow include `offscreen.html` + `offscreen.js` in the release ZIP.

**Deferred to v3.3+:** Migration of HLS/download work from `worker.js` to the offscreen document. Today only the two atomic read-only paths use it; full migration happens with the Mediabunny work in v3.3.

## [3.1.0] - 2026-05-19

### v3.1.0. Platform follow-through, accessibility, supply-chain hardening, i18n bootstrap

First release executing against the v4.0 research-driven ROADMAP. Closes 11 of the Now-tier items.

**Platform follow-through (Rumble Shorts + Wallet)**
- `Page.isShorts()` classifier + `'shorts'` page kind in `Page.classify()`. Detects `/shorts`, `/shorts/*`, `/shorts.*` paths. Rumble Shorts launched on web 2026-02-04.
- `ShortsRedirect` module. when `disableShortsFeed` is on, navigating to `/shorts` triggers `location.replace('/subscriptions')`. Re-evaluates on every htmx route change via `Router.onChange` so it fires on in-app nav too.
- `hideWalletTipButton` toggle added to the `RX_CSS_TOGGLES` hide-X registry. Off by default. Tip jar launched 2026-01-07 with Tether.
- `Selectors._map` extended with `shorts.feed`, `shorts.card`, `shorts.player`, `wallet.tipButton`. conservative selectors today, will tighten once we have MHTML captures.

**Accessibility (WCAG 2.2)**
- SC 4.1.3 Status Messages. settings-modal toast region now has `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. Options-page status divs already had this; left intact.
- SC 4.1.2 Name, Role, Value. `aria-pressed` added to every Switch component across the in-page settings modal, popup, and options-page toggle controls. State is kept in sync on every `change` event.
- Popup category groups already had `aria-expanded`. verified, no change needed.

**`autoplayBlockMode` enum wired**
- AutoplayBlock module now honors `Settings.get('autoplayBlockMode')`: `off` (matches `!autoplayBlock`), `playerOnly` (DOM-overlay removal only, v1.x behavior), `relatedEndpointAndPlayer` (default. also installs an `ended` event guard on the player to pause the next-video auto-load). v3.2 will pair this with `chrome.declarativeNetRequest` rules at the service-worker layer.

**Backend → UI wiring (consumes v3.0 helpers)**
- Options page Backup Snapshot history section. calls `listSnapshots` / `backupSnapshot` / `restoreSnapshot` via the existing message API. Shows timestamp + reason for each, per-row Restore button (each restore snapshots-before-overwrite so it's itself undoable).
- Options page Privacy Report section. calls `getPrivacyReport`, renders structured JSON output. Honest disclosure beats no disclosure.
- Options page Selector Telemetry export. calls `getSelectorTelemetry`, downloads as JSON (only populated when `debugSelectorTelemetry` is on).

**Supply chain**
- `extension/build.sh` now SHA-256 verifies the bundled `mux.min.js` against a pinned hash. Refuses to ship unverified bytes. Constants documented for safe upgrades. Supports `shasum`, `sha256sum`, and `certutil` (Git-Bash on Windows fallback).
- `content_security_policy` added to both manifests: `script-src 'self'; object-src 'self'; base-uri 'self'`. Locks down the extension origin from inline-script / object / base-tag attacks.

**i18n bootstrap (Now-tier preparation for v3.5 distribution)**
- `extension/_locales/en/messages.json` created with the core ~30 user-visible strings (manifest name/description, action title, options page CTAs, group labels, snapshot/privacy section labels).
- Both manifests updated to `default_locale: "en"` with `__MSG_*__` references for `name`, `description`, and `default_title`.
- Build script + GH Actions workflow include `_locales/` in the release ZIP.

**Community files**
- `CONTRIBUTING.md`. what we accept, what we don't, code style, setup, release process.
- `CODE_OF_CONDUCT.md`. Contributor Covenant v2.1.
- `.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, `selector_regression.md`. three structured templates.

**Catalog parity:** 197/197/197/197 across content.js `_defaults`, popup.js `DEFAULTS`, options.js `DEFAULTS`, options.js `META`.

## [3.0.0] - 2026-05-19

### v3.0.0. Distribution, store readiness, v2.6 backend, README refresh

Closes the v2 roadmap arc with v2.6 atomic backend helpers and the v3.0 distribution-readiness work. Bumps to v3.0.0.

**v2.6.0. Data, Profiles, Accessibility, Privacy (backend atoms)**
- **`rxBuildPrivacyReport()`**. Returns a pure-read snapshot of RumbleX's local privacy footprint: schema version, total feature count, enabled features, manifest permissions, host permissions, every external network surface RumbleX can touch (rumble.com / 1a-1791.com / rumble.cloud / api.github.com. honestly enumerated), telemetry status ("none. no analytics, no remote logging, no usage beacons"), localStorage byte/key counts, and live status notes for tracking-strip / selector telemetry / remote cosmetic rules. Exposed via `chrome.runtime` message `getPrivacyReport`. No network, no side effects.
- **`rxBackupSnapshot(reason)`** / **`rxListSnapshots()`** / **`rxRestoreSnapshot(indexOrAt)`**. Rolling stack of pre-destructive-op settings snapshots stored at `rx_settings_snapshots`. Honors `backupHistoryLimit` (default 10). `restoreSnapshot` itself snapshots before overwriting so an unwanted restore is undoable. Exposed via message actions `backupSnapshot`, `listSnapshots`, `restoreSnapshot`. Options-page UI to consume these lands in a follow-up.
- **`getSelectorTelemetry`**. Drains and returns the `Selectors._telemetry` ring buffer (only populated when `debugSelectorTelemetry` is on). No upload. caller is expected to write the events to a user-initiated download.

**v3.0.0. README refresh**
- README intro rewritten to describe the v2.x feature superset honestly (130+ modules, 14 categories, OLED Green theme, thumbnail hider, dense mode, reduced motion, tracking-strip, external player, keyword regex/wildcard, rant tier filter, chat username colors).
- "What's new in v2.x" digest added: per-milestone summary of what shipped at v2.0/v2.1/v2.2/v2.3+v2.4/v2.6.
- All version badges (codex-branding block + `shields.io`) synced to v3.0.0.

### What's intentionally NOT in v3.0.0

The original v3.0 acceptance criteria included a single-file userscript regenerated from a shared core. That's a multi-day rewrite that would compete with the rest of the v2 roadmap arc and risks regressing the v1.x userscript users still rely on. `RumbleX.user.js` remains at the v1.8.0 baseline. The extension is the primary distribution surface; userscript regeneration is tracked as a deferred v3.1+ deliverable in ROADMAP.md.

Other deferred items (Rumble Studio scene tools, uploader metadata fill, bulk unsubscribe UI, channel notifier alarms, OBS alert export, multi-stream viewer) all require live captures of logged-in-only Rumble surfaces I don't have, so they remain in the roadmap as ROADMAP.md-tracked deferrals rather than half-shipped stubs.

## [2.4.0] - 2026-05-19

### v2.3.0 + v2.4.0. Live chat hardening + feed/discovery moderation

Bundles the implementable atomic features from the v2.3 (Live Chat & Rants) and v2.4 (Feed/Discovery/Moderation) milestones into a single shipped release. Two waves below; jumps to v2.4 because that's the highest milestone with shipped features (skipping a tagged v2.3 release; the v2.3 acceptance items show as checked in ROADMAP.md).

**v2.3.0. Live Chat, Rants**
- **RantTierFilter**. When `rantTierFilter > 0`, hides chat rants below the configured tier (1-10 → matches `.chat-history--rant[data-level]`). CSS-only. raising/lowering the threshold reveals previously hidden rants without needing the stream to redeliver them.
- **ChatUsernameColors**. Three modes via `chatUsernameColors`: `off` | `deterministic` (hash username → HSL hue, fixed sat/lightness) | `tiered` (color by rant tier when present, else hash). MutationObserver scoped to `#chat-history-list` so the colorizer doesn't scan the whole document. Rolls back inline style on `destroy()`.

**v2.4.0. Feed, Discovery, Moderation**
- **KeywordFilter mode upgrade**. Honors `blockedKeywordsMode`: `literal` (default, v1 behavior), `regex` (raw RegExp source, compiled with `i` flag, sandboxed. a bad regex falls back to literal substring for that one entry so a typo doesn't disable the whole filter), `wildcard` (`*` → `.*`, `?` → `.`, anchored). Matchers compiled once per (keywords, mode) signature.
- **StripTrackingParams**. Removes Rumble's tracking/referral query params via allowlisted-strip model. Scrubs known trackers (`e9s`, `ref`, `referrer`, `src`, `utm_*`, `mtm_*`, `campaign`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`, `igshid`, `_ga`, `yclid`) while preserving canonical params (`v`, `q`, `page`, `start`, `t`). On boot, scrubs `location.href` via `history.replaceState`. On click of any `<a href>`, rewrites to canonical before the browser follows (capture-phase so it beats Rumble's own handlers). Re-scrubs on each htmx route change via `Router.onChange`. Scoped to rumble.com origin only.

**Catalog parity**
- Still 195/195/195 across content.js `_defaults`, popup.js `DEFAULTS`, options.js `DEFAULTS` + `META`. Two new module IDs added to `RX_CATEGORIES` (`stripTrackingParams` under Feed Controls; rant/chat enum settings remain options-page-only since they're not booleans).

### Deferred to v2.3+ / v2.5+
- Full RantStats-parity sidebar (`rantStatsPanel`). needs significant UI work; cached rants from the existing `rantPersist` already cover the bulk of the value.
- Chat participants list (`chatParticipantsList`). needs a derived-state observer over chat history; deferred to v2.5.
- Multi-stream viewer (`multiStreamViewer`). experimental; needs iframe sandboxing and chat panel orchestration. Deferred.
- Politics filter preset (`politicsFilterPreset`). needs an editable rules JSON; subjective category definitions out of scope for v2.4.
- Remote cosmetic rules. needs signed rule format + signature verification; deferred to v2.6.

## [2.2.0] - 2026-05-19

### v2.2.0. Download Manager 2.0 (Phase 1)

First implementable slice of the v2.2 download superset. Lands the visible "external player handoff" surface plus a reusable media probe cache other download modules can adopt.

**New feature modules**
- **ExternalPlayer**. Adds an "Open in player" button on watch pages next to the share row when `externalPlayerEnabled` is on. Substitutes the current page URL into `externalPlayerTemplate` (default `mpv://{url}`) and launches it. HTTPS templates use `window.open(..., '_blank')`; custom-protocol templates (`mpv://`, `potplayer://`, `vlc://`) launch via a hidden iframe so the parent page never navigates if the browser rejects the URL. Routes through `Selectors.find('watch.share')` from the v2.0 registry; re-anchors on htmx route changes via `Router.onChange`. Visible by default in the **Downloads & Capture** category.

**New shared module**
- **MediaProbeCache**. Persistent TTL-keyed cache for media probe results (embedJS responses, HLS manifest variants, CDN HEAD probes). `get(key)` / `set(key, val)` / `clear()` API backed by `chrome.storage.local` with debounced flushes (250ms). Lazy GC on read. expired entries are dropped + flushed. Honors `downloadProbeCacheTtlHours` (0 disables cache entirely); falls back to in-memory only on storage errors so the cache never blocks downloads. Available globally to feature modules; `VideoDownloader` will adopt it in a follow-up pass.

### Deferred to v2.3+
- DASH/fMP4 detection in `VideoDownloader`. non-trivial parser + mux pipeline. The existing HLS-to-MP4 transmux path already covers the majority of Rumble's modern CDN responses.
- Real audio extraction via `ffmpeg.wasm`. adds ~25MB to the extension bundle. Will ship as an opt-in companion package rather than bundled. `audioExtractionMode: 'browserIfSupported'` semantics formalized in v2.0; the actual `ffmpeg.wasm` integration is v2.4 scope.
- Batch and channel archive queue with concurrency/resume/manifest. depends on a v2.3 service-worker queue with persisted state. Settings keys (`channelArchive*`, `downloadConcurrency`, `batchDownload`) shipped in v2.0; the queue UI lands in v2.3.
- Live stream recording prototype. `liveDVR` already covers the last-N-seconds case from v1.8. Indefinite-duration live recording requires a robust service-worker handoff and lands with the v2.3 archive queue.

## [2.1.0] - 2026-05-19

### v2.1.0. Premium UI and Layout Superset

Builds on v2.0.0's core engine. Lands the visible v2.x UI superset behind the schema-v2 settings keys shipped in v2.0.

**New feature modules**
- **ThumbnailHider**. Three composable toggles: `hideThumbnails` (master), `hideThumbnailsFeeds` (feeds only), `hideThumbnailsRelated` (related sidebar only). Hides via `visibility: hidden + opacity: 0` so grid heights stay intact (no ugly stacking reflow). Also blanks `background-image` on poster wrappers (live cards, hero banners use CSS backgrounds, not `<img>`).
- **DenseMode**. Tightens spacing across feed grids, watch page, comments, related media when `denseMode` is on. Pairs cleanly with `wideLayout` for power users. Scoped under `body.rx-dense` so disable fully restores layout.
- **AccountPaginationCompact**. Implements the community Reddit userscript via the new setting registry. `.pagination.autoPg` on `/account/content*` now clamps to 720px and tightens vertical rhythm. Scoped to account pages only via the new `Page.isAccount()` classifier.
- **ReducedMotion**. Honors the explicit `reducedMotion` setting *and* the OS `prefers-reduced-motion` media query. Kills RumbleX shimmer/stagger/spring; degrades animation durations to `0.001ms` so transitions don't read as broken.
- **HomeCleanupPreset**. Three presets driven by the new `homeCleanupPreset` enum: `focused` hides editor picks, recommendations, premium row, featured banner; `minimal` adds every category row except subscribed/live; `custom` falls back to the existing hide-X toggles. Layers on top of `CategoryFilter` without conflict.

**OLED-grade native-token theme mapping**
- `DarkEnhance` now writes Rumble's *native* CSS custom properties (`--color-bg-*`, `--brand-*`, `--link-color`, `--input-*`, `--channel-border*`, `--menu-border-color`, etc.) in addition to RumbleX's `--rx-*` tokens. Themed surfaces now inherit the active palette without per-selector overrides. drops the number of `!important` rules needed to keep `darkEnhance` ahead of Rumble's stylesheet churn.
- Applies to all four existing themes (Catppuccin, YouTubify, Midnight AMOLED, Rumble Green) plus the new `oledGreen` theme added in v2.0.

**Catalog parity**
- 195/195/195 keys across content.js `_defaults`, popup.js `DEFAULTS`, options.js `DEFAULTS` + `META`. Six new module IDs added to `RX_CATEGORIES` (in-page modal) under the **Theme & Layout** category.

### Deferred to v2.2+
- Full hide-X registry migration to `Selectors`. v2.1 modules use both inline selectors (for hot paths) and the registry (for new code). v2.2 will mechanically swap the rest.
- Full-browser theater refresh. TheaterSplit + Rumble Resize merger. Existing `theaterSplit` + `fullWidthPlayer` modules already cover the use cases; v2.2 unifies the UI.

## [2.0.0] - 2026-05-19

### v2.0.0. Core Engine, Schema v2, and Settings Superset (Phase 1 of v2)

First implementation pass against the ROADMAP. Lays foundation for the v2.x feature waves (premium UI, download manager 2.0, RantStats-parity chat, feed/moderation, creator tools, privacy/profiles) without breaking any v1.9 surface.

**Schema v2 migration**
- Storage gains a `schemaVersion: 2` marker. `Settings.init()` now runs a one-shot migration on load: any pre-v2 `keyboardNav` value is preserved into the new `legacyKeyboardNav` key so users whose hotkeys were on don't silently lose them. The migrated payload is written back immediately so the migration only runs once per profile.
- Adds 70+ new settings keys covering: core/theming (`denseMode`, `reducedMotion`, `glassIntensity`, `accentColor`, `debugSelectorTelemetry`), layout (`hideThumbnails*`, `compactAccountPagination`, `homeCleanupPreset`, `pageDensity`), player (`qualityMode`, `perChannelVolumeMemory`, `autoplayBlockMode`, `clipExportFormat`, `segmentSkipMode`), downloads + archives (`downloadManager*`, `download{Include,Live,Shorts,Concurrency,Probe}*`, `audioExtractionMode`, `externalPlayer*`, `channelArchive*`), feed/filter (`shortsFilterScope`, `blockedChannelsMeta`, `blockedKeywordsMode`, `filterPreviewBadges`, `politicsFilterPreset`, `remoteCosmeticRules*`), chat/rants (`chatMentionHighlight`, `chatClickToMention`, `chatParticipantsList`, `chatUsernameColors`, `chatTimedMutes`, `chatMuteDurations`, `rantStatsPanel`, `rantExportFormat`, `rantTierFilter`, `rantStickyHighValue`, `multiStreamViewer`), comments (`commentThreadView`, `commentSearch`, `commentMuteDurations`, `commentExport`), automation/creator/integrations (`bulkUnsubscribe*`, `channelNotifierEnabled`, `discordWebhookUrl`, `rssExportEnabled`, `creatorMode`, `uploaderMetadataFill`, `studioSceneTools`, `obsAlertExport`), and privacy/data (`stripTrackingParams`, `privacyReport`, `settingsProfiles`, `activeProfileId`, `backupHistory`, `backupHistoryLimit`, `encryptedGistSync`).
- All three catalogs (content.js `_defaults`, popup.js `DEFAULTS`, options.js `DEFAULTS` + `META`) extended in lockstep. Five new options-page groups added: **Core**, **Automation**, **Creator & Studio**, **Integrations**, **Privacy & Data**.

**Selector Registry (`Selectors`)**
- New top-level module loaded before features. Provides `find(key, root)`, `findAll(key, root)`, and `wait(key, { timeout, root })` against a 27-entry named-surface map built from the MHTML ground-truth selector table in `ROADMAP.md`. Each entry has a stable selector (preferring `data-js`, `aria-*`, IDs, structure) and a fallback for Rumble's CSS-utility-heavy DOM.
- Selector fallbacks and timeouts are logged into an in-memory ring buffer when `debugSelectorTelemetry` is enabled. No network, no auto-upload. drainable via `Selectors.drainTelemetry()` for local export later.
- Existing features keep their inline selectors for now; new v2.x feature work routes through the registry so Rumble's DOM churn lands in one place.

**Route Lifecycle (`Router`)**
- New module patches `history.pushState`/`replaceState` once, subscribes to `popstate`, and listens for `htmx:afterSwap`/`htmx:afterSettle`/`htmx:historyRestore`. Emits a single normalized `{ url, prevUrl, page, prevPage, reason, changed }` event to subscribers via `Router.onChange(fn)`. `Page.classify()` now returns one of `home | feed | watch | live | embed | search | channel | account | studio | unknown`.
- Initialized at the top of `boot()` so feature `init()` calls run with route hooks already wired. v2.1+ features will subscribe instead of installing one MutationObserver per module.

**OLED Green theme**
- Adds `oledGreen` to `THEMES`. pure-black surfaces tuned for AMOLED, Rumble-green accent (`#85c742`), denser borders, alpha-only glass (no `backdrop-filter`, per house style). Existing `catppuccin` default preserved on upgrade; v2.1 will flip new installs to `oledGreen`.

**KeyboardNav → legacy**
- `KeyboardNav.id` renamed `keyboardNav` → `legacyKeyboardNav`. Default flipped to **off**, matching the house rule "Never add keyboard shortcuts." Moved out of the **Video Player** options group into **Core** under a "legacy" label.
- Migration preserves user intent: anyone who explicitly had `keyboardNav: true` in storage gets `legacyKeyboardNav: true` after upgrade. no silent feature loss.

**Catalog parity**
- 126 (v1.9) → ~197 settings keys across content.js, popup.js, options.js. All three editors continue to match on every key.

### Deferred to v2.1+
- Full extraction of `core/`, `platform/`, `features/` source layout. v2.0 keeps the current single-file `content.js` for stability; the registry + router are the seams the v2.1 split will pull through.
- Userscript parity with the new v2 settings. `RumbleX.user.js` stays at its v1.8 baseline until v2.x feature work stabilises (per roadmap acceptance criteria for v3.0.0 distribution).
- New-feature implementations behind the new toggles (download manager 2.0, RantStats-parity, multi-stream, bulk unsubscribe, creator mode, etc.). keys + defaults shipped now so the settings UI is ready; feature modules land in v2.2. v2.6.

## [1.9.3] - 2026-04-22

### Settings parity with Astra Deck. full round-trip backup
Export Backup and Import Backup now round-trip ALL user data, matching the multi-key backup behaviour of the Astra Deck options page. Previously `Export Backup` only saved `rx_settings` (from `chrome.storage.local`) and left every per-site localStorage key on rumble.com behind: watch progress, watch/search history, bookmarks, volume memory, and rant archives (`rx_rants_<videoId>`). A user who exported → reset → imported would silently lose everything but their settings toggles. Now:

- **`Export Backup`** queries an open Rumble tab for its localStorage payload and includes it in the export file as `localData`. The toast confirms *"Included N per-site keys from your open Rumble tab"* when it worked, or suggests *"Tip: open a Rumble tab first to include watch history, bookmarks, etc."* when no tab was found.
- **`Import Backup`** restores `rx_settings` to `chrome.storage.local` AND broadcasts `localData` to every open Rumble tab. The toast confirms *"Restored N per-site keys to M open tabs"* or prompts the user to open a Rumble tab and re-import if none were reachable.
- **Export format bumped to `exportVersion: 2`** with `localData` field. **v1 imports still work** (they just restore settings, no localData payload exists). Raw top-level settings objects (ancient format) also still import.

### Implementation
- `content.js`. new `rxReadLocalStorage()` and `rxWriteLocalStorage(data)` helpers, both constrained to the same `RX_LOCAL_STORAGE_KEYS` + `RX_LOCAL_STORAGE_PREFIXES` allowlist used by `rxClearLocalStorage`. The writer additionally rejects non-string values and keys outside the allowlist so an imported file cannot smuggle arbitrary keys onto rumble.com's origin. Both are reachable via `chrome.runtime.onMessage` actions `getLocalData` / `setLocalData`.
- `background.js`. new `getLocalData` proxy queries the first available Rumble tab (localStorage is per-origin so multiple tabs would return identical data); new `setLocalData` proxy broadcasts to every Rumble tab. Both silently no-op when no tab is open, letting the options page provide graceful UI copy.
- `options.js`. `exportSettings` + `importSettings` use the new round-trip pattern with explicit user-facing toasts describing what was or wasn't included/restored.

### Security note
The `setLocalData` write-path allowlists keys by name (or prefix `rx_rants_`). A crafted import cannot write to arbitrary localStorage keys on rumble.com. only to the specific keys RumbleX already owns.

## [1.9.2] - 2026-04-22

### Fixed. deep hardening pass

**Correctness / data safety**
- **`Reset All Data` now actually resets all data.** Previously it only cleared `chrome.storage.local.rx_settings` and left every per-site localStorage key untouched: watch progress, watch history, search history, bookmarks, volume memory, and the growing-forever `rx_rants_<videoId>` archive all survived a reset. The extension origin cannot touch rumble.com's localStorage directly, so `background.js` now broadcasts a new `clearLocalData` message to every open Rumble tab; each tab self-clears its own known keys + prefixes and reports the count. The options page surfaces an honest "Cleared N per-site keys across M tabs" confirmation.
- **VideoDownloader no longer dead-ends when `theaterSplit: false`.** The download button called `TheaterSplit._switchTab('download')` which silently no-ops when the Theater Split panel isn't mounted. Now the feature falls back to a standalone modal overlay with its own close button, click-outside + Escape handlers, and proper scan-cancellation on dismiss. Download works stand-alone.
- **`VideoDownloader._fetchAllEmbeds` no longer duplicates the initial embed request.** The caller already has the authoritative `u3` JSON; we thread it through as `primedJson` so the deep scan starts with it instead of hitting Rumble's rate-sensitive endpoint twice. Also parallelised with `Promise.allSettled`. five sequential awaits became one concurrent batch.
- **Empty-state message no longer lingers during deep scan.** When the initial embedJS returned no qualities, the "scanning the CDN…" placeholder would sit next to actual results as they landed. It now clears on the first result; if the scan completes truly empty, the text flips to an honest dead-end message rather than staying ambiguous.

**Security / XSS surface**
- **`_setBody` / `_makeRow` / `_showFormatPicker` / `_startDirectDownload` no longer pipe `e.message`, `lastError.message`, `q.label`, `q.width/height`, or any external/response text through `innerHTML`.** New `_setBodyText(className, text)` helper constructs nodes via DOM APIs; the row builder does the same. A new `rx-dl-tar-note` and the scan bar are built via `textContent` + element composition. No network-influenced text can reach the HTML parser.
- **`LiveChatEnhance` no longer round-trips chat DOM through `innerHTML`.** Previously `el.innerHTML = el.innerHTML.replace(/@(\w+)/g, '<span ...>@$1</span>')` re-parsed the entire subtree on every chat message, which could retrigger markup side-effects in any HTML Rumble's chat renderer emits (e.g. `<img onerror>`). Replaced with a `TreeWalker` that mutates only `Text` nodes in place via `DocumentFragment` replacement. Rumble's existing markup is never re-parsed.
- **`background.js download` already host-allowlists.** Extended the allowlist to `rumble.cloud` so RUD-discovered CDN URLs continue to work without loosening the guard elsewhere.

**Memory & listener leaks**
- **`MiniPlayer` drag handlers** (`mousemove` / `mouseup` bound to `document`) were anonymous and never removed. Disabling the feature left them attached to the document, holding references to the `_mini` element across hot-reload cycles. Handlers are now stored on the instance and removed in `destroy()`.
- **`SearchHistory` outside-click and submit handlers** leaked the same way. Both are now stored + cleaned up.
- **`AutoMaxQuality`** now tracks every `hls.js` instance it attaches a `hlsManifestParsed` listener to and calls `hls.off()` in `destroy()`. no more stranded listeners on the player across disable/re-enable.

**Performance**
- **Popup writes debounced (120 ms).** Rapid toggles in the popup previously triggered an independent `storage.set` + onChanged broadcast per click; coalesces bursts, with a `pagehide` flush of the latest state so no toggle is lost when the popup closes.
- **Deep-scan embed fetch parallelised** (see above).

**UX polish**
- **`siteTheme` is now a real dropdown in the options editor.** It's a string with only three valid values (`system` / `dark` / `light`); rendering it as a free-text input invited typos that silently fell back to the default. New `ENUM_CHOICES` registry + `renderEnumControl`; the `theme` setting also gets a proper dropdown with human-readable labels.

### Files changed
- [extension/content.js](RumbleX/extension/content.js). `rxClearLocalStorage`, centralized key list, enhanced message handler, `_setBodyText`, DOM-built `_makeRow` / `_showFormatPicker` / `_startDirectDownload`, TreeWalker `_highlightMentions`, `_hlsInstances` tracking in `AutoMaxQuality`, `_dragMousemove/_dragMouseup/_dragMousedown` tracking in `MiniPlayer`, `_outsideClickHandler/_formSubmitHandler/_boundForm` tracking in `SearchHistory`, standalone `_showDownloadOverlay` / `_closeDownloadOverlay`, `_fetchAllEmbeds` parallel + primed-json.
- [extension/background.js](RumbleX/extension/background.js). new `clearLocalData` broadcast.
- [extension/pages/options.js](RumbleX/extension/pages/options.js). `resetSettings` broadcasts to tabs, `ENUM_CHOICES` + `renderEnumControl`, `inferControlKind(key)`-aware dispatch.
- [extension/pages/popup.js](RumbleX/extension/pages/popup.js). debounced `saveSettings` with `pagehide` flush.
- Both manifests. v1.9.2.

### Also in v1.9.2 (deeper audit follow-up)
- **`Settings._applyExternal` preserves in-flight local writes.** A new `_pendingKeys` set tracks keys the user has changed but hasn't flushed; when a cross-tab/options change arrives inside the 120 ms debounce window, the external value is merged UNDER the pending keys so the user's in-flight toggle isn't silently discarded. On reset, pending keys are cleared (explicit user intent wins).
- **`AutoLike` / `AutoExpand` cancel delayed actions on destroy.** Both used `waitFor(...).then(() => setTimeout(...))` patterns that would fire AFTER the feature was disabled if the user toggled inside the waitFor window. resulting in AutoLike auto-liking against a page where it was explicitly turned off. Added generation-counter invalidation (`AutoLike`) and tracked timer cancellation (`AutoExpand`). Pattern documented as a maintenance item for other `waitFor` callers.

## [1.9.1] - 2026-04-22

### Added. RUD (Rumble Universal Downloader) integration
Integrated into the existing `VideoDownloader` as a progressive deep scan that runs automatically after the fast embed-API rows render. No new feature toggle, no parallel UI. the existing download panel gains the capability.

**What it does**
- Fetches every known `embedJS` endpoint (`u0`…`u4`, plus the authoritative `u3/?ver=2` form) and harvests media URLs from each.
- Scans the live DOM (script tags, `[src]`/`[href]` attrs, `<video>`/`<source>`) for any direct media URLs the API didn't include.
- Derives `{pathPart, baseId, token, isLive}` from any direct URL found.
- Generates candidate URLs at `hugh.cdn.rumble.cloud` for every quality token × (mp4, tar) × (live, vod) × (lowercase, capitalized) variant. typically 40 to 60 candidates per video.
- Probes each with `HEAD` (Range GET fallback) under 6-way concurrency with a 12 s timeout composed against a scan-wide `AbortController`.
- Surfaces verified results as new rows grouped by type badge (MP4 / TAR) with accurate sizes parsed from `content-range` or `content-length`.
- Live replay? A contextual "extract with 7-Zip, drop the `.m3u8` into VLC" note appears whenever TAR rows land.

**UX polish**
- Inline progress bar at the top of the download panel: `Deep scan · 12 / 47` with a slim progress strip. Fades to a green confirmation once complete, then auto-dismisses.
- Copy-link button on every row (visible on hover). confirms with a green check for 1.5 s.
- `_scanController` + `_scanSeq` ensure late-resolving probes can't bleed into a newer scan's DOM.
- Every existing row flow (format picker for HLS, direct-MP4 download, per-quality file extension) is preserved. TAR results inherit `.tar` filenames automatically.
- `destroy()` aborts in-flight scans. no CDN pings after the feature is disabled or the page unloads.

**Permissions**
- `manifest.json` and `manifest-firefox.json` gained `*://*.rumble.cloud/*` host permission (the CDN the userscript probes).
- `background.js` `ALLOWED_DOWNLOAD_HOSTS` gained `rumble.cloud` so the chrome.downloads flow accepts probe-discovered URLs.

**Deliberately *not* ported** from the userscript's RUD:
- **`fetch`/`XHR` interception in the page realm.** Content scripts live in an isolated world; faithful interception needs a secondary `world: "MAIN"` content script + `postMessage` bridge. The combined DOM scan + multi-embedJS harvest + candidate generation covers the same URLs in practice without that plumbing.
- **Size-based filtering (< 50 MB).** HEAD probes already reject non-2xx responses; short videos are legitimately small and shouldn't be hidden.
- **Visual theme toggle inside the panel.** We use the extension's existing theme engine instead.

### Files changed
- [extension/content.js](RumbleX/extension/content.js). VideoDownloader gained ~320 LOC of RUD helpers + progressive `_loadQualities` + copy-link + TAR handling. `destroy()` now aborts scans.
- [extension/background.js](RumbleX/extension/background.js). allowlist extended.
- [extension/manifest.json](RumbleX/extension/manifest.json), [manifest-firefox.json](RumbleX/extension/manifest-firefox.json). host permission + v1.9.1.

## [1.9.0] - 2026-04-22

### Added. Rumble Enhancement Suite port (58 features)
Ported features from *Rumble Enhancement Suite* v11.0 (by Matthew Parker). The downloader component is **deferred** to a future release.

**Interactive modules (8)**
- **Auto-hide Header**. fades the header out, reveals on top-edge cursor.
- **Auto-hide Nav Sidebar**. hides nav, reveals on left-edge hover (30-px trigger strip).
- **Auto Like**. one-shot auto-click of the like button on watch pages.
- **Auto Load Comments**. scroll-triggered "Show more comments" clicks.
- **Full-Width Player**. maximizes player width; on live streams, switches to a side-by-side chat layout with responsive stacking ≤1100 px.
- **Adaptive Live Layout**. expands main content whenever chat is visible on live streams.
- **Comment Blocking**. parallel to existing chat user-block; adds a Block button to each comment and persists a `blockedCommenters` list.
- **Site Theme Sync**. mirrors Rumble's native system/dark/light setting.

**CSS hide-X toggles (50)**. each shipped opt-in so the upgrade doesn't silently change users' feeds. Driven by a new `RX_CSS_TOGGLES` registry + `makeCssToggleFeature()` factory so each toggle is still a proper feature module with its own setting key, hot-reload support, and panel card.

| Group | Count | Toggles |
|---|---|---|
| Main Page Layout | 25 | widenSearchBar, hideUploadIcon, hideHeaderAd, hideProfileBacksplash, hideFeaturedBanner, hideEditorPicks, hideTopLiveCategories, hidePremiumRow, hideHomepageAd, hideForYouRow, hideGamingRow, hideFinanceRow, hideLiveRow, hideFeaturedPlaylistsRow, hideSportsRow, hideViralRow, hidePodcastsRow, hideLeaderboardRow, hideVlogsRow, hideNewsRow, hideScienceRow, hideMusicRow, hideEntertainmentRow, hideCookingRow, hideFooter |
| Video Page Layout | 5 | hideRelatedOnLive, hideRelatedSidebar, widenContent, hideVideoDescription, hidePausedVideoAds |
| Player Controls | 9 | hideRewindButton, hideFastForwardButton, hideCCButton, hideAutoplayButton, hideTheaterButton, hidePipButton, hideFullscreenButton, hidePlayerRumbleLogo, hidePlayerGradient |
| Video Buttons | 8 | hideLikeDislikeButton, hideShareButton, hideRepostButton, hideEmbedButton, hideSaveButton, hideCommentButton, hideReportButton, hidePremiumJoinButtons |
| Comments | 2 | moveReplyButton, hideCommentReportLink |
| Chat | 1 | cleanLiveChat |

**Enhancements**
- `autoMaxQuality` now tries **hls.js direct manipulation** (`hls.nextLevel = levels.length - 1` on the player's `<video>` element) before falling back to the overlay-clicking approach. significantly more reliable than DOM poking alone.

**Settings / UX**
- 60 new setting keys (`126` total, up from `66`). Catalog parity enforced across `content.js _defaults`, `options.js DEFAULTS`, `options.js META`, and `popup.js DEFAULTS`. 126 = 126 = 126 = 126.
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
- **RUD (Rumble Universal Downloader) integration**. the userscript's downloader (~700 LOC) probes CDN token variants, intercepts fetch/XHR, tries multiple `embedJS` URLs, and generates candidate CDN URLs. Porting it would replace the existing `VideoDownloader` UI and require adding `*://*.rumble.cloud/*` to `host_permissions`. Tracked for a future release.

## [1.8.0] - 2026-04-22

### Added. Full options page (Astra-Deck style)
- **New standalone options page** at [pages/options.html](extension/pages/options.html). matches the Astra-Deck settings pattern: app bar with version chip, workspace command hero, 5-card stats overview (Enabled / Storage / Channels / Keywords / Chatters), storage summary line, and Export / Import / Reset actions.
- **Settings editor modal** launched from the workspace CTA: compact header with live chips (total / unsaved / needs-attention), search + Restore Defaults / Discard / Save toolbar, sidebar group nav (All + 8 groups), workspace banner that tracks dirty state, and an empty state for filtered views.
- **Dirty-draft workflow**. changes land in an in-memory draft, Save button is gated on no-invalid + at-least-one-dirty, Discard reverts, confirm dialog on close-with-unsaved.
- **Per-control editors**. toggle, number, text, textarea, list, and JSON inputs inferred from the stored value's type. Each card has a per-field Reset button and a hint line showing stored vs default vs draft values.
- **Focus trap + ESC handling + `beforeunload` guard** in the modal; `prefers-reduced-motion` and `forced-colors` supported.
- **Live re-sync**. observes `chrome.storage.onChanged`, re-renders stats on any external write, and warns if the stored value changed under a dirty draft.
- **Popup gear button** now opens the options page via `chrome.runtime.openOptionsPage()`. Shift-click still opens the in-page Ctrl+Shift+X modal on the active tab (retained for quick toggles while watching).
- **Both manifests** (`manifest.json` MV3 and `manifest-firefox.json` MV2) gained an `options_ui` entry with `open_in_tab: true`.
- Settings catalog parity enforced: 66 keys match across `content.js Settings._defaults`, `options.js DEFAULTS`, and `options.js META`. zero drift.

### Added (19 new feature modules)
Competitive parity pass. implemented every feature found in every other Rumble userscript/extension, plus five that don't exist anywhere else.

**Headline (Rumble-firsts):**
- **Chapters**. parses timestamp lists in the description, renders tick marks on the seek bar with hover tooltips, and a clickable chapter list above the description
- **SponsorBlock**. per-video local segments with auto-skip, marker overlay on the progress bar, 5 categories (sponsor / intro / outro / selfpromo / interaction), JSON import + export
- **Video Clips**. mark In/Out on the player, slice HLS segments, and export a standalone MP4 (reuses the mux.js Web Worker)
- **Live DVR**. save the last 30 s / 1 m / 5 m / 10 m of a live stream as MP4 (nearest competitor: none)
- **Transcripts**. clickable, searchable transcript panel synced to the player (backed by the Subtitle Sidecar)

**Chat & Comments parity:**
- **Unique Chatters**. live counter of distinct usernames + total messages above chat
- **User Block**. per-user hide-in-chat with inline "block" button on every message
- **Spam Dedup**. suppresses recently-repeated identical messages (30-message rolling window)
- **Chat Export**. TXT (click) or JSON (shift-click) export, including rant amounts
- **Rant Persist**. keeps rants visible past their expiry animation, auto-caches per video in localStorage, export to JSON
- **Popout Chat**. opens chat in a separate 420×720 window
- **Comment Sort**. reorder comments by Top / New / Oldest / Controversial

**Downloads:**
- **Audio Only**. extract audio-only `.m4a` from HLS
- **Batch Download**. multi-select thumbnails across feed / channel / search pages, bulk MP4 download
- **Subtitle Sidecar**. load local SRT/VTT and overlay captions on the player

**Feed & Layout:**
- **Keyword Filter**. hide videos whose titles contain any blocked keyword (settings chip list, Enter to add)
- **Full Titles**. removes `-webkit-line-clamp` truncation on every thumbnail
- **Title Font**. unbolds + normalizes title typography
- **Autoplay Queue**. FAB-pinned queue of Rumble URLs, auto-advances on `ended` event

### Settings
- Settings modal now has **8 categorized sections** (up from 7)
- New chip-list editors for **Blocked Keywords** (in Feed Controls) and **Blocked Chatters** (in Comments & Chat)
- `Settings._defaults` grew by 19 toggles + 4 list/object keys (`blockedChatters`, `blockedKeywords`, `sponsorSegments`, `autoplayQueue`)
- Popup exposes 19 new toggles in the quick-toggle list

### Architecture notes
- All 19 new modules follow the existing `init()`/`destroy()` hot-reload pattern
- `VideoClips`, `LiveDVR`, `AudioOnly` reuse `VideoDownloader._parseMasterPlaylist` / `_parseSegmentPlaylist` / `_transmuxWithWorker` (no new dependencies)
- `Transcripts` bridges to `SubtitleSidecar` via `_loadExternalCues()`. upload a VTT/SRT once, get both captions and transcript
- `BatchDownload` scrapes per-video MP4 URLs by fetching the watch HTML and regex-extracting the direct `mp4` URL from embed JSON
- Feature count: **54 modules** (35 → 54)

## [0.6.0] - 2026-04-23

### Added
- **SPA Router**. detects client-side navigation via pushState/popState; features can subscribe with `Router.on()`
- **getActiveVideo()**. shared helper to locate the active `<video>` element
- **Exact Counts**. replaces abbreviated view counts (1.2K, 3.5M) with full numbers on feed cards
- **Autoplay Block**. hides the upcoming-video overlay and prevents auto-play of the next video
- **Share Tools**. injects a clock button next to the share button to copy a timestamped link; strips tracking params from the URL on load
- **Keyboard Nav**. J/K/L seek ±10s, arrow keys seek ±5s / adjust volume, F fullscreen, M mute, 0 to 9 seek to percentage, with OSD feedback
- **Speed Control**. floating pill on the player to cycle playback speed (0.5× to 3×); speed persisted across sessions

### Fixed
- **Channel Blocker**. rewrote selector logic to use `a[rel="author"].channel__link` href slug extraction instead of text matching; correctly targets `.videostream` containers

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

## Roadmap archive. 2026-08-10. ROADMAP.md

<details>
<summary>Original roadmap snapshot</summary>

```markdown
# RumbleX Roadmap

Version: 4.27 - v3.34 localized settings surfaces
Date: 2026-06-18
Current shipped: v3.34.0 (extension), v1.8.0 (userscript)

> Blocked items live in [Roadmap_Blocked.md](Roadmap_Blocked.md). Move items back here when their blocker resolves.

This roadmap supersedes the v2026-05-19 v3.0 plan. It is the result of a fresh repo audit plus a 60+ source external research sweep (see [Appendix C. Sources](#appendix-c--sources)). It tracks shipped work in the [Recently shipped](#recently-shipped) summary, then prioritises the next ~12 months of work into **Now / Next / Later / Under Consideration / Rejected** tiers with every claim traceable to a source.

House style (carried forward, non-negotiable): dark-only RumbleX-owned UI, OLED black with Rumble-green accent, no `backdrop-filter`, no keyboard shortcuts, no confirmation dialogs, immediate-apply + toast feedback, local-first, no telemetry, every feature exposes `init(ctx)` / `destroy(ctx)`, selectors prefer `data-*`/`aria-*`/IDs/structure over hashed classes, settings grouped by category and persisted.

---

## State of the repo

- **Stack:** Chrome MV3 + Firefox MV2 (parallel manifests). Vanilla JS, no build step beyond `extension/build.sh`. Single `content.js` (~11600 lines, 195 settings keys, ~135 feature modules). `background.js` MV3 service worker. `worker.js` Web Worker bundling mux.js for HLS-to-MP4 transmux. `pages/popup.{html,js}` + `pages/options.{html,js}` for UI. Tampermonkey userscript at `RumbleX.user.js` lags at v1.8 baseline.
- **MHTML ground truth:** 4 captures in `Sample Pages/`. For You, My Feed, VOD Watch, Live. No capture exists for `/shorts`, `/account/*`, `studio.rumble.com`, uploader, notifications, or logged-in modals.
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

1. **Platform follow-through**. Rumble Shorts, Wallet, and the Perplexity-Pro/Premium changes shifted the surface area mid-year. Existing modules need to catch up before we add anything new.
2. **Download pipeline 2.0 (de-risked)**. `mux.js` is in maintenance mode (last release ~3 years ago, ["this module is in maintenance mode and will not have further major development"](https://www.npmjs.com/package/mux.js/v/5.2.0-2)). Plan an exit ramp to **Mediabunny** ([deprecated mp4-muxer successor with WebCodecs API integration](https://github.com/Vanilagy/mp4-muxer)) or **mp4-wasm** before a CVE forces it.
3. **MV3 capability uptake**. `chrome.offscreen` solves the service-worker DOM gap that has limited us so far; `chrome.sidePanel` enables a persistent RantStats-parity panel; `chrome.contextMenus` adds the right-click affordances users keep asking for; `chrome.declarativeNetRequest` lets us declaratively block embedJS-related autoplay endpoints. Adopt one per minor release.
4. **Resilience**. Selector registry exists (v2.0); now we need a regression harness, an end-to-end Playwright suite, and a self-test that runs Selectors.find() against every MHTML fixture in CI. ["Fixtures + Selectors module already shipped"](https://github.com/SysAdminDoc/RumbleX/) but the harness is still missing.
5. **Accessibility & i18n**. Zero `_locales/` strings shipped. Zero formal WCAG audit. WCAG 2.2 (legal standard, [referenced in 4,605 ADA lawsuits in 2024](https://www.allaccessible.org/blog/implementing-aria-labels-for-web-accessibility)) introduced **2.5.8 Target Size 24px** and **4.1.3 Status Messages** (aria-live) that we likely fail.
6. **Distribution & discoverability**. Repo has 0 stars/forks/watchers. Not on Chrome Web Store, AMO, or Edge Add-ons. Not listed on Greasy Fork or OpenUserJS. The AFFiNE [60k-star playbook](https://dev.to/iris1031/how-to-get-more-github-stars-the-definitive-guide-33k-stars-case-study-2kjo) compresses Show HN + Reddit + Product Hunt + Twitter into one 48-hour launch window; we need to be ready.

---

## Now / Next - fully shipped through v3.29

All v3.1-v3.29 milestones shipped. Detail per release in `CHANGELOG.md` and `Recently shipped` below. Remaining items moved to [Roadmap_Blocked.md](Roadmap_Blocked.md).

---

## Under consideration / Blocked

All items formerly in the "Later", "Under consideration", and remaining "Next" sections are now in [Roadmap_Blocked.md](Roadmap_Blocked.md) with per-item blocker descriptions. Move items back here when their blocker resolves.

---

## Rejected

Explicit rejects with one-line reasoning. Don't re-propose these without an explicit case.

- **Sentry / OpenTelemetry crash reporting.** Violates the no-telemetry rule. The privacy report explicitly reads "no analytics, no remote logging, no usage beacons". adding Sentry would invalidate the disclosure. Local-only error log surfaced via debug panel is acceptable; remote shipping is not. Source: existing house style.
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
- **Permission minimization:** Current host permissions are tight and well-justified. `rumble.com`, `1a-1791.com`, `rumble.cloud`, `api.github.com`. No expansion accepted without a feature gate.
- **Backup-import allowlist** already enforced in `rxWriteLocalStorage` (`RX_LOCAL_STORAGE_KEYS` + `rx_rants_` prefix). No regression accepted.
- **Download URL host allowlist** already enforced in `background.js isAllowedDownloadUrl()`. No regression accepted.
- **CVE tracking:** Watch [hls.js advisories](https://github.com/video-dev/hls.js/security/advisories) (we don't use hls.js directly but it's adjacent). Watch [Chrome stable channel updates](https://www.cvedetails.com/vulnerability-list/vendor_id-1224/product_id-15031/Google-Chrome.html). CVE-2026-7937 (extension navigation bypass) and CVE-2026-1861 (libvpx) are recent examples of extension-stack risk.

### Accessibility (WCAG 2.2)

- **Now:** aria-live toast region, target-size audit, aria-pressed/expanded sweep, focus return on modal close.
- **Next:** Screen-reader pass with NVDA on Windows + VoiceOver on macOS (per [TestParty modal accessibility guidance](https://testparty.ai/blog/modal-dialog-accessibility)). ~~Color-contrast pass with axe DevTools.~~ *(v3.8.0. `tests/e2e/a11y.spec.js` runs axe-core against options page + settings modal + popup with the `wcag2a/2aa/21a/21aa/22aa/best-practice` ruleset; fails build on any critical or serious violation.)*
- **Later:** WCAG 3.0 readiness once a stable draft ships.

### Internationalization (i18n) / Localization

- **Shipped:** `_locales/en/messages.json` bootstrap + `default_locale: "en"` (v3.1). `es`, `pt-BR` (v3.5). `de` (v3.28). All 32/32 key parity; marked for human review before store publish. Localise Chrome Web Store listing copy. ["You can significantly increase your extension's ranking in the locales that you support by localizing the name, description, and detailed description"](https://developer.chrome.com/docs/webstore/i18n/?csw=1).
- **Later:** Add `fr`, `ja`, `tr`, `ru` based on actual install heat-maps.

### Observability (local-only)

- Selector telemetry ring buffer exists (v3.0). ~~Add a per-feature error-event ring buffer with the same shape: rolling-window-of-200, gated by a debug toggle, exposed via message API, no network.~~ *(v3.20.0. `RxErrorLog` module ships exactly that shape: 200-entry in-memory ring, gated by `debugErrorLog` setting, `getErrorLog` / `clearErrorLog` message API, bounded field sizes per entry. Phase 1 instrumentation covers feature-init failures in the boot loop. Options-page Export/Clear buttons in the Privacy report section. Privacy report enumerates the buffer in its disclosure.)* **No remote shipping ever** (see Rejected).

### Testing

- **Now (v3.1):** Static JS syntax check in CI (`node --check`). Three-way catalog parity check (`content.js _defaults` vs `popup.js DEFAULTS` vs `options.js DEFAULTS+META`) as a CI job. Already passing at 195/195/195.
- **Next (v3.4):** MHTML fixture replay harness + Playwright E2E suite. See v3.4 above.

### Documentation

- README refreshed in v3.0. Maintain `CHANGELOG.md` discipline (one entry per release, per existing format). Add `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` (Now). Add architecture diagram and feature-module template (Next).

### Distribution / packaging

- **Now:** Chrome ZIP + Firefox ZIP + CRX already shipped per release. Tightening: GH Releases description should pin install caveats (CRX rejected by Chromium 75+; ZIP via "Load unpacked" is the primary path).
- **Next (v3.5):** Chrome Web Store, Firefox AMO, Edge Add-ons listings prep + submission.
- **Later (v4.0):** Greasy Fork userscript listing once v4.0 userscript-from-shared-core regeneration ships.

### Plugin ecosystem (deferred. under consideration)

- Signed remote cosmetic rules + AdGuard-style declarative scriptlet bundle (Later/v4.0+).
- User-importable selector packs (manual JSON drop into settings; Later).

### Mobile

- **Browser support:** Firefox for Android. supported now (Tampermonkey installable via AMO; extension format not). Quetta + Lemur Android browsers. supported (Chrome MV3 path). [Kiwi Browser discontinued Jan 2025](https://www.makeuseof.com/found-android-browser-that-runs-chrome-extensions-why-its-not-popular/); legacy APK still works.
- **Mobile-specific tasks:** Audit popup + options for touch-target ≥ 44 px (Apple HIG) and 48 dp (Material) when running in mobile-Firefox/Quetta context. Confirm no hover-only UX is critical-path. **Next** for the touch-target audit; mobile-specific UI variants are **Later** if at all.

### Offline / resilience

- `navigator.onLine` + `online`/`offline` events should pause active downloads and queue resume jobs. Setting key `downloadManagerEnabled` is the gate. **Next** in v3.2 alongside the offscreen-document download work.

### Multi-user / collab

- Not in scope. Settings backup/restore is the only cross-device path. Multi-profile settings (v4.0) is per-user-local, not multi-user.

### Migration / upgrade strategy

- `schemaVersion` is the contract. `Settings._migrate()` is idempotent and bumps on every schema change. Any new key addition that changes default behaviour for existing users requires a corresponding migration block.

---

## Self-audit notes (Phase 5)

- Every Now/Next item maps to at least one source in [Appendix C](#appendix-c--sources). The two exceptions are pure-internal tasks (snapshot restore UI, privacy report panel) which trace to the v3.0 commit `3fa500b` in this repo's history.
- Every category called out by the prompt is covered: security, accessibility, i18n/l10n, observability, testing, docs, distribution/packaging, plugin ecosystem, mobile, offline/resilience, multi-user/collab, migration. Multi-user/collab is explicitly out of scope with reasoning, not absent.
- The "Rejected" tier has reasons traceable either to repo house style (rejected for philosophy fit) or to recent prior decisions (e.g. ffmpeg.wasm). No silent resurrections of rejected ideas.
- The v2.5 Creator/Studio cluster remains Later. three independent items in Greasy Fork's [rumble.com user-scripts directory](https://greasyfork.org/en/scripts/by-site/rumble.com) confirm the demand (Studio Scene Mover, Auto Theater, etc) but none of them can be implemented well without a fresh MHTML capture of `studio.rumble.com`, the uploader, and `/account/subscriptions`. all logged-in-only surfaces.
- Adversarial review: a hostile reviewer would point at (a) 0 stars/forks/watchers as evidence the distribution problem is the real bottleneck (true; v3.5 tier is the response), (b) `mux.js` in maintenance mode as a ticking clock (true; v3.2 Mediabunny migration is the response), (c) no formal accessibility audit despite shipping 195 settings keys (true; v3.1 WCAG 2.2 + aria-live items are the response), (d) `_locales` not used at all despite a global audience (true; v3.1 + v3.5 i18n items are the response). Nothing surfaces a category I've missed.

---

## Recently shipped

Compressed history. Detail per release lives in `CHANGELOG.md`.

### v3.29.0 - Premium settings and popup polish (2026-06-16)

- Options page and popup now share a darker command-center visual system with stricter 6-12px geometry, stronger hierarchy, centralized input/select styling, and repaired popup favicon/tooltips.
- Confirmation/browser prompts were removed from the options workflow; reset now acts immediately with status feedback and requests a pre-reset snapshot when an open Rumble tab can provide one.
- Status, focus, forced-colors, and reduced-motion states were tightened across extension-owned settings surfaces.

### v3.28.0. German locale + roadmap triage (2026-06-16)

- `extension/_locales/de/messages.json`. 32/32 key parity with English. Locale count: en + es + pt_BR + de.
- Moved all blocked/externally-gated roadmap items to `Roadmap_Blocked.md`.

### v3.27.0. Opt-in Mediabunny muxer path (2026-06-16)

- Bundled Mediabunny 1.46.0 browser ESM + MPL-2.0 license under `extension/lib/`.
- `downloadMuxerEngine` setting (`muxjs` default, `mediabunnyWebCodecs` experimental).
- Build script SHA-256 verifies both Mediabunny bundle and license.

### v3.26.0. FS-Access folder picker + offline-aware archive queue (2026-05-21)

- `RxFsAccess` + BatchDownload pick-folder. `archiveQueuePauseOnOffline`. `wallet.paymentModal` selector entry.

### v3.25.0. Archive queue status filter (2026-05-19)

- Polish: new status dropdown above the archive job list. Values: All / Pending / Active / Completed / Failed. UI-only state.
- Empty-filter feedback when the filter hides every job but the queue isn't empty.

### v3.24.0. Customizable Channel Archive subfolder (2026-05-19)

- New `channelArchiveSubfolder` setting (default `'RumbleX'`). Read by the SW at job-process time so mid-queue changes apply to next job.
- `rxArchiveSanitizeSubfolder()` helper strips drive letters, backslashes, parent-segments, reserved chars, excess depth (>4 segments). Empty falls back to default. Defense-in-depth. chrome.downloads also rejects absolute paths.
- New text input in the options-page archive section, below the max-height dropdown. Catalog parity 206 → 207.

### v3.23.0. RxErrorLog Phase 2 instrumentation (2026-05-19)

- Wires `RxErrorLog.record` into three more silent-catch sites: `Router._fire` route-handler iteration, `boot()` Settings + Router init blocks, `VideoDownloader._loadQualities` catch.
- All sites use `RxErrorLog?.record` + inner `try/catch` so logger failures can't break host code paths. Disabled by default via `debugErrorLog` setting.

### v3.22.0. Live-site smoke harness (2026-05-19)

- New `tests/e2e/live-smoke.spec.js`. 3 tests against live rumble.com: content-script boot, `header.root` selector resolves against live DOM, SW round-trip via `getPrivacyReport`.
- Opt-in via `RUMBLEX_LIVE_SMOKE=1` env var + inline `test.skip(!LIVE, …)`. Regular `test:e2e` shows tests as skipped.
- Playwright routes block GTM/GA/DoubleClick/FB before navigation so live network noise doesn't hang DOMContentLoaded.
- New `.github/workflows/live-smoke.yml`. workflow_dispatch only, takes a `url` input. 14-day artifact retention.
- New `npm run test:e2e:live` script. package.json bumped to 3.22.0.

### v3.21.0. Channel Archive max-height cap (2026-05-19)

- New `channelArchiveMaxHeight` setting (default `'best'`, values: best/2160/1440/1080/720/480/360). Caps archive-queue downloads at a chosen resolution.
- SW `rxDiscoverVideoQuality(videoSlug, maxHeight)` gained the cap param; `rxProcessArchiveJob` reads the setting at job-process time so mid-queue changes take effect on the next pick.
- Specific failure reason `no-direct-mp4-under-NNNNp` when a cap is in effect but no direct MP4 fits.
- New options-page dropdown next to the channel-URL + maxItems inputs. Persists immediately to `rx_settings` with confirmation toast. Catalog 205 → 206.

### v3.20.0. RxErrorLog ring buffer (2026-05-19)

- New `RxErrorLog` content-script module: 200-entry rolling in-memory ring buffer of `{ at, featureId, message, stack, context, page }` entries. Bounded field sizes so one bad feature can't drown the buffer.
- Gated by new setting `debugErrorLog` (default OFF, group: Privacy). Same disclosure pattern as `debugSelectorTelemetry`.
- Phase 1 instrumentation: every `feat.init()` + `SettingsPanel.init()` failure recorded. Future phases wire finer-grained sites (Selectors lookups, message handlers, high-traffic features).
- Message API: `getErrorLog` / `clearErrorLog`. Options-page Export/Clear buttons in the Privacy report section.
- Privacy report enumerates the buffer in its `notes` array. Catalog parity 204 → 205.

### v3.19.0. Channel Archive Phase 2. in-page button (2026-05-19)

- New `ChannelArchiveButton` content-script feature: on `/c/<slug>` and `/user/<slug>` pages, injects an "Archive channel" button next to the existing Follow toggle (anchored via the v3.14 `profile.followingBtn` selector).
- One click → enqueues the channel via v3.18's `archiveEnqueueChannel` (default 50 items, no clip filter). Result surfaces as a `rxShowToast`.
- Setting `channelArchiveButton` (default ON, group: Integrations). Catalog 203 → 204.

### v3.18.0. Channel Archive Queue Phase 1 (2026-05-19)

- Persistent chrome.storage.local job queue (`rx_archive_queue`) drained by `chrome.alarms` `rx-archive-tick` every minute honoring `downloadConcurrency`.
- Each job hits Rumble's embedJS endpoint to discover the highest-resolution direct MP4, then chrome.downloads.download into `RumbleX/<title>_<quality>.mp4` (allowlist-guarded).
- chrome.downloads.onChanged listener flips status to completed/failed.
- Background API: archiveEnqueueChannel / archiveGetQueue / archivePauseQueue / archiveResumeQueue / archiveClearCompleted / archiveClearQueue / archiveRemoveJob / archiveRetryJob / archiveRunNow.
- Options-page "Channel archive queue" section with enqueue form, status counts, pause/resume/clear/run-now controls, per-job retry/remove. Live refresh via storage.onChanged.
- 500-job cap. Completed jobs auto-prune after 7 days. Catalog parity 203/203/203/203 unchanged.

### v3.17.0. Encrypted Gist Sync (2026-05-19)

- WebCrypto AES-GCM-256 + PBKDF2-SHA256 (200k iters, 16-byte random salt per push). User brings own GitHub PAT (gist scope) + gist id (auto-created on first push). Passphrase NEVER stored.
- Background handlers `gistSyncPush` / `gistSyncPull`. Pre-pull snapshot via v3.0 backup system. Post-pull preserves local token + gist id so user doesn't lose their sync target.
- New options-page "Encrypted gist sync" section. Token + gist id persisted to `rx_settings`; passphrase entered fresh each push/pull.
- Catalog parity 201→203 (added `encryptedGistSyncToken`, `encryptedGistSyncId`). No new permissions. `api.github.com` already in `host_permissions` since v3.0.

### v3.16.0. RantStats panel (2026-05-19)

- `RantPersist._cache()` mirrors each cached rant to `chrome.storage.local` under `rx_rant_stats_mirror` (debounced, 30-video × 200-rant cap). Source-of-truth localStorage cache unchanged.
- New "Rant stats" options-page section: per-video cards (title, rant count, aggregate USD, last-seen, read state), Open / Mark read / Remove per-row, JSON + CSV export, footer totals (rants + USD + unique chatters).
- Live refresh via `chrome.storage.onChanged`. open options tabs auto-update when new rants stream in on rumble.com.
- Closes the v3.3 Now-tier `rantStatsPanel` acceptance criterion. Catalog parity 201/201/201/201 unchanged.

### v3.15.0. Watch History export (2026-05-19)

- `exportWatchHistory` message handler: background SW fetches `/account/playlists/watch-history` with `credentials: 'include'`, regex-parses every `<li class="videostream__details" data-video-id="…">` row into structured JSON (videoId/title/url/duration/watchedPercentage/thumbnail/channel).
- "Export Watch History" button in a new "Account data export" options section, above the v3.10 multi-profile section. Downloads as `rumblex-watch-history-<ISO>.json` via the v3.10 `downloadJsonBlob` path.
- No new permissions, no new settings keys, no new selectors. uses the v3.13 SW-fetch + regex-parse strategy. Catalog parity 201/201/201/201. Selector harness 85/17 unchanged.

### v3.10 to v3.14. Account-data round-trips (2026-05-19)

Five rapid-fire releases against the 2026-05-19 MHTML capture batch:
- **v3.10**. OPML export of watched channels + multi-profile settings UI.
- **v3.11**. `CommentExport` module (closes the v2.0 `commentExport` setting key).
- **v3.12**. `BulkUnsubscribe` over `/account/following` + selectors hardened from new MHTML.
- **v3.13**. `importFollowedChannels` SW-fetch + parse → notifier auto-population.
- **v3.14**. `rxBlockChannel` context-menu entry on `/c/<slug>` / `/user/<slug>` links + 11 new selectors (library.*/history.*/profile.*).

### v3.0.0. Privacy report + backup snapshots + selector telemetry + README refresh (2026-05-19)

- `rxBuildPrivacyReport()` + `getPrivacyReport` message. schema version, feature counts, manifest permissions, every external network surface enumerated, telemetry status "none. no analytics, no remote logging, no usage beacons", localStorage byte/key counts.
- `rxBackupSnapshot(reason)` / `rxListSnapshots()` / `rxRestoreSnapshot(indexOrAt)`. rolling stack at `rx_settings_snapshots`, `backupHistoryLimit` (default 10), restore-itself-snapshots-before-overwrite.
- `getSelectorTelemetry`. drains the `Selectors._telemetry` ring buffer for local export. Populated only when `debugSelectorTelemetry` is on.
- README rewritten to describe the v2.x feature superset.

### v2.4.0. Live chat hardening (v2.3 atoms) + feed moderation (v2.4 atoms) (2026-05-19)

- `RantTierFilter`. CSS-only hide of chat rants below `rantTierFilter`.
- `ChatUsernameColors`. `off` | `deterministic` (hash→HSL) | `tiered`.
- `KeywordFilter` mode upgrade. `literal` (default) | `regex` (sandboxed; bad regex falls back to literal per-entry) | `wildcard`.
- `StripTrackingParams`. allowlist-strips `e9s`/`ref`/`utm_*`/`mtm_*`/`campaign`/`fbclid`/`gclid` from rumble.com URLs.

### v2.2.0. Download Manager 2.0 phase 1 (2026-05-19)

- `ExternalPlayer`. "Open in player" button next to share row when `externalPlayerEnabled` is on. `externalPlayerTemplate` default `mpv://{url}`. Anchors via `Selectors.find('watch.share')`; re-anchors on htmx route changes via `Router.onChange`.
- `MediaProbeCache`. TTL-keyed `get/set/clear` over `chrome.storage.local`, debounced flushes, lazy GC, in-memory fallback on storage errors. Honors `downloadProbeCacheTtlHours`.

### v2.1.0. Premium UI and layout superset (2026-05-19)

- `ThumbnailHider` (master/feeds/related scopes).
- `DenseMode` (body.rx-dense class).
- `AccountPaginationCompact`.
- `ReducedMotion` (honors setting + OS `prefers-reduced-motion`).
- `HomeCleanupPreset` (`none` / `focused` / `minimal` / `custom`).
- `DarkEnhance` writes Rumble's native CSS tokens (`--color-bg-*`, `--brand-*`, etc.) in addition to `--rx-*`.

### v2.0.0. Core engine phase 1 (2026-05-19)

- `schemaVersion: 2` migration. `keyboardNav` → `legacyKeyboardNav` (preserves user's old toggle state).
- `Selectors` registry. 27 named surfaces × stable+fallback selectors from MHTML map. `find()`, `findAll()`, `wait()` + telemetry ring buffer.
- `Router`. patches `history.pushState`/`replaceState` once, hooks `popstate` + `htmx:afterSwap`/`afterSettle`/`historyRestore`. `Router.onChange()` emits normalized route-change events. `Page.classify()` returns one of `home | feed | watch | live | embed | search | channel | account | studio | unknown`.
- `oledGreen` theme added to `THEMES`.
- ~70 new settings keys covering core, layout, player, downloads, feed, chat, comments, automation, creator, integrations, privacy. Catalog parity 195/195/195.

### v1.9.x. Pre-v2 baseline (Apr 2026)

- v1.9.3. Full-parity backup round-trip (settings + per-origin localStorage). XSS hardening (textContent / DOM-builder injection only). Memory-leak fixes (MiniPlayer / SearchHistory / AutoMaxQuality `hls.off()`).
- v1.9.1. RUD (Rumble Universal Downloader) integrated into VideoDownloader. Progressive deep scan across `hugh.cdn.rumble.cloud` with 6-way concurrency, HEAD + Range fallback, TAR archive support with "extract + VLC" hint.
- v1.9.0. Rumble Enhancement Suite port: 58 new modules across hide-X registry, full-width player, auto-hide chrome.
- v1.8.0. Astra-Deck-style options page + 19 new modules (Chapters, SponsorBlock, Clips, Live DVR, Transcripts, Subtitle Sidecar, Audio Only, Batch Download, Rant Persist, Comment Sort, Popout Chat, Keyword Filter, Title Font, Autoplay Queue, Unique Chatters, Chat User Block, Chat Spam Dedup, Chat Export, Full Titles).

---

## Appendix A. Selector reference

Carried forward from the prior research roadmap. **Source of truth: `Sample Pages/*.mhtml` plus the v2.0 `Selectors` registry in `extension/content.js`.** Update both together; ship the registry update first, then refresh the MHTML capture.

| Key | Stable selector | Fragile fallback | Notes |
|---|---|---|---|
| `header.root` | `header[data-js="app_header"]` | `.header` | Attach early theme/layout classes here only after `document.body` exists. |
| `nav.mainMenu` | `#main-menu`, `[data-js="highlightable_navigation_item"]` | `.hover-menu.main-menu-nav` | High churn. permanent/sidebar nav modes alter structure. |
| `search.form` | `form[data-js="search_form"]`, `[data-js="search_input"]` | `.header-search` | Autocomplete uses htmx POST. |
| `search.autocomplete` | `[hx-post="/search/htmx/get-autocomplete-results"]`, `[data-js="autocomplete_results_container"]` | `.autocomplete-results` | Needs route-change + htmx swap handling. |
| `feed.card` | `[role="listitem"][data-video-id]`, `.playlist-menu[data-video-id]` | `.videostream.thumbnail__grid--item` | Process added cards only. |
| `feed.author` | `a[rel="author"].channel__link` | `.channel__link.link.*` | Do not use hashed suffixes. |
| `feed.sections` | `section[id^="section-"]`, heading text under `.homepage-heading__title` | `#section-editor-picks`, etc | Self-healing registry needed; captures don't list every section. |
| `watch.player` | `video`, `#videoPlayer`, `.videoPlayer-Rumble-cls` | `#videoPlayer.video-player` | Rumble player SVG buttons share classes. identify by `title`/`aria`/structure. |
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
| `studio.*` | TBD | TBD | **No local MHTML capture yet. must be live-checked before implementation.** |
| `shorts.feed` | TBD | TBD | **No local MHTML capture yet. v3.1 priority.** |
| `wallet.tipButton` | TBD | TBD | **No local MHTML capture yet. v3.1 priority.** |

---

## Appendix B. API and endpoint reference

| API / Endpoint | Use | Auth | Rate-limit | Notes |
|---|---|---|---|---|
| `embedJS/u3/?request=video&ver=2&v={embedId}` | Video metadata + media URLs | Public for accessible videos | High concurrency cost | Cache by embed ID + endpoint variant via `MediaProbeCache`. |
| `embedJS/u0` to `u4` probes | Fallback embed metadata | Public for accessible videos | High | Probe sparingly; stop on first success. |
| `hugh.cdn.rumble.cloud/...` media URLs | HEAD / Range / download | Public or signed-URL dependent | Medium | Respect CORS and failure modes; do not hammer. URL pattern is *not* officially documented. [yt-dlp's Rumble extractor](https://github.com/yt-dlp/yt-dlp/pull/5280) is the reverse-engineered reference. |
| `1a-1791.com/...` media URLs | Same as above | Same | Same | Alternate shard. |
| `https://rumble.com/shorts` | New Shorts feed route | Public | Low | **Added 2026-02-04.** Vertical feed, ≤ 90 s, 9:16 recommended. [Source](https://corp.rumble.com/blog/rumble-unveils-the-web-version-of-rumble-shorts/). |
| `/search/htmx/get-autocomplete-results` | Search suggestions | Likely session-aware | Medium | User input only. |
| `/-htmx/account/legacy-video-collection` | Playlist / save | Logged-in | High | User action only. |
| `/-htmx/channel/update-action-buttons` | Channel subscribe/follow UI | Logged-in | High | Read-only observation preferred. |
| `/-htmx/web-services/repost-vote` | Repost vote UI | Logged-in | High | Do not automate by default. |
| `/-htmx/web-services/report-content` | Content report | Logged-in | N/A. user action only | Do not automate. |
| `/-htmx/wallet/payment/qr-modal` | Wallet QR / tip flow | Logged-in (creator) | N/A | Tip jar surface. added 2026-01-07 ([source](https://corp.rumble.com/blog/rumble-and-tether-launch-crypto-wallet-for-creator-economy/)). |
| GitHub Releases API | RumbleX update check | Public | Low | Daily alarm or user action. |

---

## Appendix C. Sources

Compiled during Phase 1. Use as the citation pool when adding new roadmap items.

### Rumble platform

1. [Rumble Unveils the Web Version of Rumble Shorts (corp.rumble.com)](https://corp.rumble.com/blog/rumble-unveils-the-web-version-of-rumble-shorts/). Feb 4 2026
2. [Rumble Unveils Web Version of Rumble Shorts (Nasdaq)](https://www.nasdaq.com/press-release/rumble-unveils-web-version-rumble-shorts-2026-02-04)
3. [Swipeable Short Videos: Rumble Rolls Out Shorts on the Web (StockTitan)](https://www.stocktitan.net/news/RUM/rumble-unveils-the-web-version-of-rumble-hykdp7faip30.html)
4. [What Is Rumble Shorts. official help](https://rumble.support/help/shorts)
5. [How to Upload Shorts to Rumble (rumble.support)](https://rumble.support/help/upload-shorts)
6. [Tether and Rumble Launch Rumble Wallet (Tether.io)](https://tether.io/news/tether-and-rumble-launch-rumble-wallet-bringing-self-custodial-crypto-payments-to-millions-of-creators-and-users/). Jan 7 2026
7. [Rumble Wallet support docs](https://wallet.rumble.com/support/docs/welcome/)
8. [Rumble Shares Jump 5% After Launching Crypto Wallet With Tether (CoinDesk)](https://www.coindesk.com/markets/2026/01/07/rumble-shares-jump-5-after-launching-crypto-wallet-with-tether)
9. [Tether and Rumble Launch Crypto Wallet for Digital Creators (Yahoo Finance)](https://finance.yahoo.com/news/rumble-tether-launches-crypto-wallet-151530405.html)
10. [Rumble Wallet App Store listing](https://apps.apple.com/us/app/rumble-wallet-tip-with-crypto/id6748149951)
11. [Rumble and Tether Launch Crypto Wallet for Creator Economy](https://corp.rumble.com/blog/rumble-and-tether-launch-crypto-wallet-for-creator-economy/)
12. [Rumble Studio Canvas updates (rumble.support)](https://rumble.support/help/studio-canvas-updates). Mar 18 2026
13. [Rumble Studio main entry](https://studio.rumble.com/)
14. [Rumble 2026 Creator Program](https://rumble.support/help/rumble-2025-creator-program)
15. [Rumble Stock Prediction 2026 (MEXC, multi-business breakdown)](https://www.mexc.com/news/1070109)
16. [How do I disable autoplay?. Rumble FAQ](https://rumble.support/help/how-do-i-disable-autoplay)
17. [SemRush. rumble.com traffic overview](https://www.semrush.com/website/rumble.com/overview/)
18. [Mastering The Rumble: Stop Autoplay with uBlock Origin](https://rumble.com/v3tkf3a-mastering-the-rumble-stop-autoplay-with-ublock-origin.html)
19. [GetApp. Rumble Studio pricing/features (no public API)](https://www.getapp.com/all-software/a/rumble-studio/)
20. [Enhanced Games / Rumble partnership announcement](https://www.stocktitan.net/news/RUM/enhanced-names-rumble-premier-partner-and-official-distribution-i0sa6wvpgqvm.html)

### Competitor extensions / userscripts

21. [RantStats Extension Chrome Web Store](https://chromewebstore.google.com/detail/rantstats-extension-for-r/liahjgfmodjgeakahommamnmbjgicpmh). v1.5.3 May 1 2026
22. [RantStats source](https://github.com/rantstats/rantstats-extension)
23. [RantStats Edge listing](https://microsoftedge.microsoft.com/addons/detail/rantstats-extension-for-r/dfhpfnfhllhmfmkcambimnafeklpgkdm)
24. [Rant Stats Legacy Bookmarklet](https://rantstats.com/bookmarklet/)
25. [Rumble Video Accelerator. Chrome Web Store](https://chromewebstore.google.com/detail/rumble-video-accelerator/afedcnlnaijfabfnibpldpdkilbghgng?hl=en)
26. [Greasy Fork. userscripts for rumble.com](https://greasyfork.org/en/scripts/by-site/rumble.com)
27. [Rumble Auto Best Video Quality (Greasy Fork, Martin___X)](https://greasyfork.org/en/scripts/494906-rumble-auto-best-video-quality)
28. [Rumble Live Chat Blocker (Greasy Fork, CynicalPhantom)](https://greasyfork.org/en/scripts/532873-rumble-live-chat-blocker)
29. [Rumble Download Button (Greasy Fork, Zeek B.)](https://greasyfork.org/en/scripts/487122-rumble-download-button)
30. [Rumble Volume Control + Overlay (Greasy Fork, Dave121, Dec 22 2025)](https://greasyfork.org/en/scripts/by-site/rumble.com). Dec 22 2025
31. [Rumble All-in-One Tools (Greasy Fork, MrM0RG4N, Mar 19 2026)](https://greasyfork.org/en/scripts/by-site/rumble.com)
32. [Rumble Force Lowest Quality (ToTheFuture2021, Nov 20 2025)](https://greasyfork.org/en/scripts/by-site/rumble.com)
33. [Rumble Studio Scene Mover (J J W)](https://greasyfork.org/en/scripts/by-site/rumble.com)
34. [Rumble Auto Theater Mode (Dave121, Jul 4 2025)](https://greasyfork.org/en/scripts/by-site/rumble.com)
35. [nullEFFORT/rumble-downloader](https://github.com/nullEFFORT/rumble-downloader)
36. [3IMAD69/Rumble-Downloader](https://github.com/3IMAD69/Rumble-Downloader)
37. [a3r0id/RumblePy](https://github.com/a3r0id/RumblePy)
38. [HamzaJarane/rumble-notifier](https://github.com/HamzaJarane/rumble-notifier)
39. [zackees/ytclip. multi-platform clip downloader](https://github.com/zackees/ytclip)
40. [jakecreps/ruby. Rumble/BitChute/YouTube scraper](https://github.com/jakecreps/ruby)
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
56. [MDN. WebExtensions background scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Background_scripts)
57. [Codestudy. MV3 service worker vs Firefox background script conflicts](https://www.codestudy.net/blog/manifest-v3-background-scripts-service-worker-on-firefox/)
58. [W3C WebExtensions Community Group](https://www.w3.org/community/webextensions/)
59. [W3C WebExtensions charter](https://github.com/w3c/webextensions/blob/main/charter.md)
60. [Manifest V3 and webRequest. Vivaldi perspective](https://vivaldi.com/blog/manifest-v3-webrequest-and-ad-blockers/)
61. [NordVPN. MV3 ad blocker reality](https://nordvpn.com/blog/manifest-v3-ad-blockers/)
62. [Ad Blocking in Chrome 134. What Actually Works After MV3 (dev.to)](https://dev.to/alphashark/ad-blocking-in-chrome-134-what-actually-works-after-manifest-v3-4c62)
63. [Chrome i18n API reference](https://developer.chrome.com/docs/extensions/reference/api/i18n)
64. [Chrome i18n message format guide](https://developer.chrome.com/docs/extensions/mv3/i18n-messages/)
65. [MDN WebExtensions Internationalization](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization)
66. [Internationalize your extension. Chrome Webstore](https://developer.chrome.com/docs/webstore/i18n/?csw=1)
67. [Chrome Web Store developer docs](https://developer.chrome.com/docs/webstore)
68. [Chrome Enterprise extension publishing](https://cloud.google.com/blog/products/chrome-enterprise/publishing-extensions-for-the-enterprise)
69. [uBlock Origin Lite (uBlockOrigin/uBOL-home)](https://github.com/uBlockOrigin/uBOL-home/releases). `2026.516.1652` mid-May 2026 release
70. [AdGuard Scriptlets library](https://github.com/AdguardTeam/Scriptlets)
71. [AdGuard User Scripts API (knowledge base)](https://adguard.com/kb/adguard-browser-extension/user-scripts-api/)
72. [AdGuard Browser Extension releases](https://github.com/AdguardTeam/AdguardBrowserExtension/releases)
73. [GitHub Refined GitHub (extension exemplar)](https://github.com/refined-github/refined-github)

### Web APIs

74. [File System Access API. Chrome docs](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)
75. [Compression Streams API. MDN](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API)
76. [CompressionStream. web.dev all-browser support](https://web.dev/blog/compressionstreams)
77. [Compression Streams API. Chrome blog](https://developer.chrome.com/blog/compression-streams-api)
78. [The Secret Life of JavaScript: The Compressor (April 2026)](https://www.tech-reader.blog/2026/04/the-secret-life-of-javascript-compressor.html)
79. [Mediabunny. successor to mp4-muxer (TypeScript MP4 muxer with WebCodecs)](https://github.com/Vanilagy/mp4-muxer)
80. [mp4-wasm. minimp4 WASM bindings](https://www.npmjs.com/package/mp4-wasm)
81. [jMuxer. JS MP4 muxer](https://github.com/samirkumardas/jmuxer)
82. [mux.js npm (maintenance mode notice)](https://www.npmjs.com/package/mux.js/v/5.2.0-2)
83. [videojs/mux.js GitHub](https://github.com/videojs/mux.js/)

### Accessibility / WCAG

84. [WCAG 2.2 + ARIA integration. Accesify](https://www.accesify.io/blog/aria-wcag-integration/)
85. [WCAG 2.2 chrome extension testing. BrowserStack](https://www.browserstack.com/guide/wcag-chrome-extension)
86. [Modal dialog accessibility. TestParty](https://testparty.ai/blog/modal-dialog-accessibility)
87. [ARIA labels 2025 implementation guide. AllAccessible](https://www.allaccessible.org/blog/implementing-aria-labels-for-web-accessibility)

### Security / CVE

88. [CVE-2026-7937. Chrome DevTools navigation bypass via extension](https://www.cve.news/cve-2026-7937/)
89. [CVE-2026-5281. Chrome WebGPU UAF, actively exploited](https://www.esecurityplanet.com/threats/chrome-vulnerability-cve-2026-5281-exploited-in-the-wild/)
90. [Google Chrome multiple vulnerabilities. HKCERT](https://www.hkcert.org/security-bulletin/google-chrome-multiple-vulnerabilities_20260507)
91. [Google Chrome XSS vulnerabilities](https://www.cvedetails.com/vulnerability-list/vendor_id-1224/product_id-15031/opxss-1/Google-Chrome.html)
92. [hls.js security advisories. GitHub](https://github.com/video-dev/hls.js/security/advisories)

### SponsorBlock / community DBs

93. [SponsorBlock API docs](https://wiki.sponsor.ajay.app/w/API_Docs)
94. [SponsorBlock community tools](https://wiki.sponsor.ajay.app/w/Community)
95. [Expand integration beyond YouTube. SponsorBlock issue #515](https://github.com/ajayyy/SponsorBlock/issues/515)
96. [sponsorblock.py docs (service parameter)](https://sponsorblockpy.readthedocs.io/en/latest/api_reference.html)

### Userscript managers

97. [Violentmonkey privileged APIs](https://violentmonkey.github.io/api/gm/)
98. [Violentmonkey GitHub (DeepWiki)](https://deepwiki.com/violentmonkey/violentmonkey)
99. [Tampermonkey on Firefox Android (AMO)](https://addons.mozilla.org/en-US/android/addon/tampermonkey/)
100. [W3C webextensions issue 176. webRequest use case (GM_xmlhttpRequest)](https://github.com/w3c/webextensions/issues/176)

### Mobile

101. [Quetta / Lemur / Edge. Android browsers running extensions (MakeUseOf)](https://www.makeuseof.com/android-browsers-that-run-extensions-chrome-keeps-leaving-out/)
102. [Kiwi Browser discontinued (MakeUseOf)](https://www.makeuseof.com/found-android-browser-that-runs-chrome-extensions-why-its-not-popular/)

### Testing

103. [Playwright vs Puppeteer 2026 (BrowserStack)](https://www.browserstack.com/guide/playwright-vs-puppeteer)
104. [Microsoft Playwright GitHub](https://github.com/microsoft/playwright)
105. [Headless Chrome explained (browserless.io)](https://www.browserless.io/blog/headless-chrome)

### Distribution / discoverability

106. [Open Source Marketing for OSS. daily.dev](https://business.daily.dev/resources/open-source-marketing-grow-developer-community-without-budget/)
107. [AFFiNE 60k stars case study (dev.to)](https://dev.to/iris1031/how-to-get-more-github-stars-the-definitive-guide-33k-stars-case-study-2kjo)

### Observability

108. [Sentry + OpenTelemetry overview](https://blog.sentry.io/structured-logging-opentelemetry/)
109. [Sentry OpenTelemetry developer docs](https://develop.sentry.dev/sdk/telemetry/traces/opentelemetry/)
110. [How to Track Browser JavaScript Errors with OpenTelemetry (OneUptime, Feb 2026)](https://oneuptime.com/blog/post/2026-02-06-track-browser-javascript-errors-opentelemetry/view)

### Alternative video frontends

111. [Best Multi-Platform YouTube Frontends roundup (Factually)](https://factually.co/product-reviews/electronics-tech/best-multi-platform-youtube-frontends-forks-2026-roundup-77d4b8)
112. [NewPipe RFE. alternative platform polling (issue #6645)](https://github.com/TeamNewPipe/NewPipe/issues/6645)

---

## Definition of Done (carried forward + tightened)

A RumbleX milestone is "done" when:

- Every shipped setting key has a feature module behind it OR is documented in CHANGELOG as deferred with a target release.
- Catalog parity between `content.js _defaults`, `popup.js DEFAULTS`, `options.js DEFAULTS + META` is enforced at build time, not by manual review.
- No keyboard shortcuts are introduced; settings use visible controls and `legacyKeyboardNav` remains explicit opt-in compatibility behavior.
- No `backdrop-filter`, no pill/oval/fully-rounded backdrops on non-icon non-true-circle elements.
- No telemetry, no remote logging. The privacy report's "telemetry: none" disclosure stays accurate.
- Every feature toggle hot-applies and destroys cleanly via `init(ctx)` / `destroy(ctx)`. no `location.reload()` workarounds for migrated modules.
- New external network surfaces are listed in the privacy report and gated by an enabled feature.
- Every feature row in this roadmap has at least one Appendix C source unless it's a pure-internal task traceable to a repo commit.

---

## Research-Driven Additions

### P0

### P1

- [ ] P1. Add downloader failure diagnostics export
  Why: Rumble extractor failures recur across yt-dlp and Grayjay, so users need actionable local diagnostics when quality, 403, playlist, livestream, or muxing paths fail.
  Evidence: yt-dlp Rumble issues `#16904`, `#15089`, and Rumble issue search; Grayjay Rumble issue search; `RxErrorLog` in `extension/content.js`; downloader modules in `extension/content.js`.
  Touches: `extension/content.js`, `extension/background.js`, `extension/pages/options.js`, `worker.js`, `offscreen.js`.
  Acceptance: Failed download/clip attempts expose a copy/export diagnostic bundle with attempted source URLs redacted as needed, status/failure stage, selected quality, muxer path, worker/offscreen availability, and no cookies or private tokens.
  Complexity: M

### P2

- [ ] P2. Add archive queue preflight and retry UX
  Why: Comparable Rumble download tools expose queue progress, disk awareness, and retryable failures; RumbleX should make long archive jobs predictable before work starts.
  Evidence: nullEFFORT/rumble-downloader queue, disk-space, and import/export features; `BatchDownload` and archive queue code in `extension/content.js`; MDN File System Access compatibility.
  Touches: `extension/content.js`, `extension/background.js`, `extension/pages/options.js`, IndexedDB folder-handle helpers.
  Acceptance: Archive jobs show queued/running/failed counts, folder permission state, estimated size when known, retry/resume affordances, and queue JSON export/import without remote services.
  Complexity: M

- [ ] P2. Build muxer and WebCodecs golden-sample coverage
  Why: Mediabunny is now bundled experimentally, while mux.js remains fallback; the project needs output parity evidence before any full migration.
  Evidence: `extension/lib/mediabunny.min.mjs`; `worker.js`; `offscreen.js`; mux.js releases; Mediabunny guide; `Roadmap_Blocked.md` WebCodecs migration item.
  Touches: `worker.js`, `offscreen.js`, `extension/content.js`, `tests/e2e`, small checked-in media fixture or generated sample.
  Acceptance: Tests exercise mux.js and Mediabunny on the same small HLS/media sample, verify playable MP4 output metadata, and prove graceful fallback when WebCodecs is unavailable.
  Complexity: L

- [ ] P2. Add platform-drift fixture coverage for Shorts, Wallet, and Premium surfaces
  Why: Rumble added Shorts, Wallet tipping, and Premium/Perplexity surfaces, while the current fixture set lacks several logged-in and route-specific pages.
  Evidence: `Sample Pages/`; `Roadmap_Blocked.md`; Rumble Shorts announcement; Rumble Wallet announcement; Rumble Premium Plus support docs.
  Touches: `Sample Pages/`, selector fixture tests, `extension/content.js` route classifiers, `test_selectors.py`.
  Acceptance: Fixture tests cover at least one Shorts route, Wallet/tip button surface, and Premium promo surface; selector failures produce a clear test failure before release.
  Complexity: M
```

</details>
