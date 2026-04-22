# Changelog

All notable changes to RumbleX will be documented in this file.

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
