# RumbleX

**The ultimate Rumble enhancement suite.** 35 feature modules across 7 categories — ad blocking, theater mode, video downloads, multi-theme engine, playback controls, chat enhancements, and more. Chrome MV3 extension + Firefox support.

## Features

### Ad Blocking
- **Ad Nuker** — CSS + DOM removal of ads, pause overlays, premium nags, IMA SDK, LRT
- **Feed Cleanup** — Remove premium promos from feeds
- **Hide Reposts** — Hide reposted videos from feeds
- **Hide Premium** — Hide premium/PPV videos via CSS `:has()`
- **Shorts Filter** — Hide Shorts cards from all feeds

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

### Downloads & Capture
- **Video Download** — Download as direct MP4 or HLS-to-MP4/TS via Web Worker transmuxing
- **Screenshot** — Capture current video frame as PNG
- **Share@Time** — Copy video URL at current playback timestamp

### History & Bookmarks
- **Watch Progress** — Save/resume position + red progress bars on thumbnails
- **Watch History** — Local browsable watch history with search
- **Search History** — Recent searches dropdown on search input
- **Bookmarks** — Save videos locally for later (200 max)
- **Quick Save** — Watch Later button on thumbnail hover

### Comments & Chat
- **Chat Enhance** — @mention highlights, message filter bar
- **Chat Scroll** — Smart auto-scroll with pause on scroll-up
- **Timestamps** — Clickable timestamps in comments and description
- **Comment Nav** — Navigate, expand/collapse, OP-only filter
- **Rant Highlight** — Glow rants by tier + running $ total

### Feed Controls
- **Channel Blocker** — Block/hide channels from all feeds
- **Related Filter** — Search and filter related sidebar videos
- **Exact Counts** — Show full numbers instead of 1.2K/3.5M abbreviations

## Settings

### Full Settings Modal
Press **Ctrl+Shift+X** on any Rumble page or click the gear icon in the floating toolbar to open the full settings modal with:
- 7 categorized sidebar tabs with color-coded icons
- Real-time search across all features
- Enable All toggle per category
- Theme picker with live preview dots
- Playback speed slider
- Homepage category visibility toggles
- Blocked channels management
- Import/Export settings as JSON

### Popup
Click the extension icon for quick toggles, theme selection, and:
- **Settings gear** — Opens the full on-page settings modal
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
