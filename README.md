<!-- codex-branding:start -->
<p align="center"><img src="icon.png" width="128" alt="Rumble X"></p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-1.9.1-58A6FF?style=for-the-badge">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-4ade80?style=for-the-badge">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Userscript-58A6FF?style=for-the-badge">
</p>
<!-- codex-branding:end -->

# RumbleX

![Version](https://img.shields.io/badge/version-v1.9.1-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-lightgrey)

**The ultimate Rumble enhancement suite.** 110+ feature modules across 12 categories — ad blocking, theater mode, video downloads, multi-theme engine, playback controls, chat enhancements, chapters, SponsorBlock, clips, live DVR, transcripts, auto-hide chrome, 50+ granular hide-X toggles for every Rumble row/button/player-control, and more. Chrome MV3 extension + Firefox support.

## Features

### Ad Blocking
- **Ad Nuker** — CSS + DOM removal of ads, pause overlays, premium nags, IMA SDK, LRT
- **Feed Cleanup** — Remove premium promos from feeds
- **Hide Reposts** — Hide reposted videos from feeds
- **Hide Premium** — Hide premium/PPV videos via CSS `:has()`
- **Shorts Filter** — Hide Shorts cards from all feeds
- **SponsorBlock** — Per-video local segments with auto-skip (sponsor / intro / outro / selfpromo / interaction), progress-bar markers, JSON import + export

### Video Player
- **Theater Split** — Fullscreen video with scroll-to-reveal side panel (chat/comments/download)
- **Auto Theater** — Auto-enter native theater mode on load
- **Speed Control** — Persistent playback speed (0.25x-3x) with live stream detection
- **Scroll Volume** — Mouse wheel volume + middle-click mute + overlay
- **Auto Max Quality** — Auto-select highest resolution on load
- **Autoplay Block** — Prevent auto-play of next video
- **Loop Control** — Full video loop + A-B segment loop
- **Mini Player** — Floating draggable video when scrolling away
- **Keyboard Nav** — YouTube-style hotkeys (J/K/L, F, M, 0-9, arrows)
- **Video Stats** — Resolution, codec, buffer, frames overlay
- **Chapters** — Parses description timestamps, renders tick marks on the seek bar + clickable chapter list
- **Autoplay Queue** — FAB-pinned queue of Rumble URLs, auto-advances when current video ends

### Theme & Layout
- **Dark Theme** — Multi-theme engine with 4 built-in themes and player bar coloring
  - Catppuccin Mocha (default) — Purple/blue accents
  - YouTubify — YouTube dark mode look with red accent and progress bar
  - Midnight AMOLED — Pure black with indigo accents
  - Rumble Green — Dark with Rumble's native green identity
- **Wide Layout** — Full-width responsive grid on home and subscriptions
- **Logo to Feed** — Rumble logo navigates to Subscriptions feed
- **Auto Expand** — Auto-expand descriptions and comments
- **Notif Enhance** — Themed notification dropdown + bell pulse
- **Full Titles** — Remove title truncation on video cards
- **Title Font** — Unbold + normalize title typography

### Downloads & Capture
- **Video Download** — Download as direct MP4 or HLS-to-MP4/TS via Web Worker transmuxing. Includes an automatic **Deep Scan** that probes Rumble's CDN for every quality variant the embed API didn't surface (1080p/720p/480p/360p/240p × mp4/tar), with live progress, copy-link buttons, and support for TAR live-replay archives
- **Audio Only** — Extract audio-only `.m4a` from HLS
- **Video Clips** — Mark In/Out on the player and export a clip as MP4 (segment slicing + transmux)
- **Live DVR** — Save the last 30 s / 1 m / 5 m / 10 m of a live stream as MP4
- **Batch Download** — Multi-select thumbnails across feeds to bulk-download direct MP4s
- **Screenshot** — Capture current video frame as PNG
- **Share@Time** — Copy video URL at current playback timestamp
- **Subtitle Sidecar** — Load local SRT/VTT and overlay captions on the player
- **Transcripts** — Clickable, searchable transcript panel synced to the player

### History & Bookmarks
- **Watch Progress** — Save/resume position + red progress bars on thumbnails
- **Watch History** — Local browsable watch history with search
- **Search History** — Recent searches dropdown on search input
- **Bookmarks** — Save videos locally for later (200 max)
- **Quick Save** — Watch Later button on thumbnail hover

### Comments & Chat
- **Chat Enhance** — @mention highlights, message filter bar
- **Chat Scroll** — Smart auto-scroll with pause on scroll-up
- **Unique Chatters** — Live counter of unique chatters + total messages above chat
- **User Block** — Per-user chat hide with inline "block" button on every message
- **Spam Dedup** — Hide recently-repeated identical messages (30-message rolling window)
- **Chat Export** — TXT (click) or JSON (shift-click) export including rant amounts
- **Popout Chat** — Open chat in a separate resizable window
- **Timestamps** — Clickable timestamps in comments and description
- **Comment Nav** — Navigate, expand/collapse, OP-only filter
- **Comment Sort** — Reorder comments: Top / New / Oldest / Controversial
- **Rant Highlight** — Glow rants by tier + running $ total
- **Rant Persist** — Keep rants visible past their expiry + per-video cache + JSON export

### Feed Controls
- **Channel Blocker** — Block/hide channels from all feeds
- **Keyword Filter** — Hide videos whose titles contain blocked keywords
- **Related Filter** — Search and filter related sidebar videos
- **Exact Counts** — Show full numbers instead of 1.2K/3.5M abbreviations

## Settings

### Options Page (full editor)
Click the extension icon → **gear button** to open the dedicated options page. Modelled on Astra-Deck's settings workspace:
- App bar with version + live storage status
- Workspace hero + **Open Settings Editor** CTA
- 5-card stats overview (Enabled features, Storage size, Channels, Keywords, Chatters)
- Export / Import / Reset actions with confirmation dialog
- **Settings editor modal** with dirty-draft workflow: search, sidebar group nav (9 groups), chips for unsaved / needs-attention, Restore Defaults / Discard / Save toolbar, per-field Reset buttons
- Per-control editors infer from value type: toggle / number / text / textarea / list / JSON
- Focus trap, `beforeunload` guard on unsaved draft, live re-sync via `chrome.storage.onChanged`

### In-page Quick Modal (on-tab)
Press **Ctrl+Shift+X** on any Rumble page (or **shift-click** the popup gear) to open the original in-page settings modal with:
- 7 categorized sidebar tabs with color-coded icons
- Theme picker with live preview dots
- Playback speed slider
- Homepage category visibility toggles
- Blocked channels / keywords / chatters chip lists
- Hot-reload: most features re-init without a page reload

### Popup
Click the extension icon for quick toggles, theme selection, and:
- **Settings gear** — Opens the options page (shift-click for in-page modal)
- **GitHub link** — Direct link to this repository
- **Update checker** — Checks GitHub Releases for new versions

## Install

### Chrome / Edge / Brave (MV3)
1. Download the latest `RumbleX.zip` from [Releases](https://github.com/SysAdminDoc/RumbleX/releases)
2. Extract the zip
3. Go to `chrome://extensions` and enable **Developer mode**
4. Click **Load unpacked** and select the extracted `extension` folder

### Firefox
1. Download `RumbleX.zip` from [Releases](https://github.com/SysAdminDoc/RumbleX/releases)
2. Extract and rename `manifest-firefox.json` to `manifest.json`
3. Go to `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on** and select the `manifest.json`

### Tampermonkey (Userscript)
Install `RumbleX.user.js` directly — note: the userscript version may lag behind the extension.

## Tech Stack
- Vanilla JavaScript — no frameworks, no build step
- Chrome Extension Manifest V3
- `chrome.storage.local` for settings persistence
- `localStorage` for watch progress, volume memory, history
- mux.js (bundled) for HLS segment transmuxing in Web Worker
- Anti-FOUC: CSS injected at `document_start`
- GitHub Releases API for update checking

## License
MIT
