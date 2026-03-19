# RumbleX - CLAUDE.md

## Overview
Rumble enhancement suite - Chrome MV3 extension + Tampermonkey userscript. 35 feature modules across 7 categories: ad/bloat removal, theater split view, video downloads, multi-theme engine (Catppuccin Mocha, YouTubify, Midnight AMOLED, Rumble Green) with player bar coloring, feed controls, playback enhancements, watch progress, keyboard navigation, live chat enhancement, clickable timestamps, screenshot, watch history, autoplay block, search history, mini player, video stats, loop control, bookmarks, comment navigator, rant highlight, related filter, exact counts, share timestamp, shorts filter, chat auto-scroll, auto-expand, notification enhance, quick save. Full settings modal with sidebar navigation, search, enable-all toggles, import/export.

## Tech Stack
- Chrome Extension (Manifest V3)
- Vanilla JS, no frameworks
- `chrome.storage.local` for settings (`rx_settings` key)
- `localStorage` for watch progress + volume memory (page-local persistence)
- mux.js (bundled) for HLS-to-MP4 transmuxing in Web Worker
- Anti-FOUC pattern: CSS injected at `document_start`

## Version
v1.7.0 (all version strings: manifest.json, manifest-firefox.json, content.js `VERSION` const, background.js comment, popup.js comment)

## Key Files
- `extension/content.js` - Main content script (~6240 lines). All features as object modules with `init()`/`destroy()` pattern
- `extension/background.js` - Service worker. Settings relay + `chrome.downloads` API proxy
- `extension/pages/popup.html` + `popup.js` - Extension popup with toggle switches
- `extension/worker.js` - Web Worker for HLS segment transmuxing (uses mux.js)
- `extension/manifest.json` - Chrome MV3 manifest
- `extension/manifest-firefox.json` - Firefox variant (MV2)
- `extension/build.sh` - Build script
- `RumbleX.user.js` - Tampermonkey userscript version (separate, lags behind extension)
- `*.mhtml` - Reference page snapshots (Homepage, My Feed, Video Page, Live Video, For You, Reposts)

## Architecture
Settings managed by `Settings` object with `_defaults`, `_cache`, and `chrome.storage.local` persistence. Features register in a `features` array and are initialized in `boot()`. Each feature module:
```
const FeatureName = {
    id: 'settingKey',
    name: 'Display Name',
    init() { /* runs on page load if enabled */ },
    destroy() { /* cleanup */ }
};
```

## Features / Settings
| Setting Key | Feature | Default | Description |
|---|---|---|---|
| `adNuker` | AdNuker | true | CSS + DOM removal of ads, pause overlays, premium nags, IMA SDK, LRT |
| `feedCleanup` | FeedCleanup | true | Remove premium promos from feeds |
| `hideReposts` | FeedCleanup | true | Hide reposted videos (sub-toggle) |
| `wideLayout` | FeedCleanup | true | Full-width responsive grid on home/feed |
| `hidePremium` | HidePremium | true | Hide premium/PPV videos via CSS `:has()` |
| `darkEnhance` | DarkEnhance | true | Multi-theme engine (Catppuccin Mocha, YouTubify, Midnight AMOLED, Rumble Green) with player bar coloring |
| `theaterSplit` | TheaterSplit | true | Fullscreen video with scroll-to-reveal side panel (chat/comments/download) |
| `videoDownload` | VideoDownloader | true | Download as direct MP4 or HLS-to-MP4/TS |
| `logoToFeed` | LogoToFeed | true | Logo clicks go to /subscriptions (watch pages) |
| `speedController` | SpeedController | true | Persistent playback speed (0.25-3x) with live detection |
| `scrollVolume` | ScrollVolume | true | Mouse wheel volume + middle-click mute + overlay |
| `autoMaxQuality` | AutoMaxQuality | true | Auto-select highest resolution on load |
| `watchProgress` | WatchProgress | true | Save/resume position + red progress bars on thumbnails |
| `channelBlocker` | ChannelBlocker | true | Block/hide channels from feeds |
| `keyboardNav` | KeyboardNav | true | YouTube-style hotkeys (J/K/L, F, M, arrows, 0-9, <>, ,.) |
| `autoTheater` | AutoTheater | **false** | Auto-enter native theater mode (disabled if TheaterSplit active) |
| `liveChatEnhance` | LiveChatEnhance | true | Chat timestamps, @mention highlighting, filter bar |
| `videoTimestamps` | VideoTimestamps | true | Clickable timestamps in comments/description |
| `screenshotBtn` | ScreenshotBtn | true | Capture current video frame as PNG |
| `watchHistory` | WatchHistoryFeature | true | Local browsable watch history (localStorage) |
| `autoplayBlock` | AutoplayBlock | true | Block autoplay/up-next overlays |
| `searchHistory` | SearchHistory | true | Recent search history dropdown on search input |
| `miniPlayer` | MiniPlayer | true | Floating draggable mini player when scrolling past video |
| `videoStats` | VideoStats | true | Stats for nerds overlay (resolution, buffer, frames, codec) |
| `loopControl` | LoopControl | true | Full video loop + A-B segment loop (right-click) |
| `quickBookmark` | QuickBookmark | true | Save/browse videos locally (localStorage, 200 max) |
| `commentNav` | CommentNav | true | Prev/next comment, expand/collapse all, OP-only filter |
| `rantHighlight` | RantHighlight | true | Glow rants by tier (data-level), running $ total tracker |
| `relatedFilter` | RelatedFilter | true | Search/filter related sidebar videos, hide watched |
| `exactCounts` | ExactCounts | true | Show full numbers instead of 1.2K/3.5M abbreviations |
| `shareTimestamp` | ShareTimestamp | true | Copy video URL with ?start= at current playback time |
| `shortsFilter` | ShortsFilter | true | Hide Shorts cards from feeds (detects `#shorts__label` SVG) |
| `chatAutoScroll` | ChatAutoScroll | true | Smart chat auto-scroll with scroll-up pause + jump button |
| `autoExpand` | AutoExpand | true | Auto-expand descriptions and comments |
| `notifEnhance` | NotifEnhance | true | Catppuccin Mocha notification dropdown + bell pulse |
| `quickSave` | PlaylistQuickSave | true | One-click Watch Later on thumbnail hover |

### Non-toggle Settings
| Key | Default | Description |
|---|---|---|
| `splitRatio` | 75 | Theater split panel width % |
| `hiddenCategories` | [] | Hidden homepage section IDs |
| `theme` | 'catppuccin' | Selected theme: catppuccin, youtube, midnight, rumbleGreen |
| `playbackSpeed` | 1.0 | Saved playback rate |
| `blockedChannels` | [] | Blocked channel names (lowercase) |
| `bookmarks` | [] | Saved video bookmarks (unused in storage.local, localStorage only) |

## Settings Panels (must stay in sync)
1. **Popup** (`popup.js`): `FEATURES` array + `DEFAULTS` object + theme chips
2. **Content script** (`content.js`): `RX_CATEGORIES` array + `Settings._defaults` object
3. **Theme palettes** (`content.js`): `THEMES` object (4 themes with 17 color properties each)

## Settings Modal (content.js)
- Full-screen modal with overlay, sidebar navigation, categorized feature cards
- 7 categories: Ad Blocking, Video Player, Theme & Layout, Downloads & Capture, History & Bookmarks, Comments & Chat, Feed Controls
- Each category has: color accent, SVG icon, enable-all toggle, feature cards with switches
- Special sections: Theme picker chips (Theme & Layout), Speed slider (Video Player), Blocked channels (Feed Controls), Homepage categories (Ad Blocking)
- Search: real-time filtering across all categories with 150ms debounce
- Import/Export: JSON settings backup and restore
- Keyboard: Ctrl+Shift+X to toggle, Escape to close
- Responsive: sidebar collapses to icons at <700px

## Page Detection
```js
Page.isWatch()   // /v[id]-slug or /video/
Page.isFeed()    // / or /subscriptions or /for-you
Page.isHome()    // /
Page.isEmbed()   // /embed/
Page.isSearch()  // /search/*
Page.isChannel() // /c/* or /user/*
Page.isLive()    // has chat or stream-time element
```

## Key DOM Selectors (from MHTML snapshots)
- Video player: `#videoPlayer`, `.videoPlayer-Rumble-cls`, `video`
- Title: `.video-header-container__title`
- Channel: `.media-heading-name`, `.media-by--a`
- Comments: `.media-page-comments-container`, `#video-comments`, `.comment-item`, `.comment-text`
- Feed cards: `.videostream`, `.thumbnail__title`, `.videostream__footer`
- Related sidebar: `.mediaList-item`, `.mediaList-heading`, `.mediaList-by-heading`
- Chat: `.chat--header`, `#chat-history-list`, `.chat--input`
- Rating: `.rumbles-vote-pill`, `.rating-bar__fill`
- Homepage sections: `#section-{id}`, `.homepage-heading__title`
- Ads: `#pause-ads__*`, `.host-read-ad-entry`, `.js-rac-*`, `.ima-sdk-frame`, `.lrt-container`

## Gotchas & Traps
- **Video player SVGs share `.RumbleElm` class** - Filter by `viewBox` to target logo only
- **Theater Split comments MOVED not cloned** - Store original parent/sibling refs for unmount
- **Settings require page reload** - Toggles don't hot-swap; panel shows note
- **`1a-1791.com`** is Rumble's CDN domain (host_permissions needed)
- **ScrollVolume vs TheaterSplit wheel conflict** - ScrollVolume only captures over player area
- **AutoMaxQuality uses DOM clicking** - Multiple retry timers (1.5-8s) since player loads async
- **WatchProgress uses localStorage** - Pruned to 500 entries max
- **ChannelBlocker normalizes lowercase** - Case-insensitive matching
- **KeyboardNav skips when typing** - Checks for INPUT/TEXTAREA/contenteditable/chat
- **AutoTheater defers to TheaterSplit** - Won't activate if theaterSplit is enabled
- **VideoTimestamps uses TreeWalker** - Replaces text nodes to preserve surrounding HTML
- **MHTML files use `=3D` encoding** - Must sed when grep'ing for class/id attributes
- **WatchHistory uses localStorage** - Pruned to 500 entries max, same as WatchProgress
- **SearchHistory uses localStorage** - Pruned to 100 entries max
- **PiP/Screenshot buttons position:absolute** - Require player container to have position:relative
- **Screenshot uses canvas.toBlob** - Cross-origin video frames may fail (same-origin CDN is fine)
- **MiniPlayer clones video element** - Syncs currentTime via rAF loop; pauses original while mini is active
- **MiniPlayer uses IntersectionObserver** - threshold 0.3 triggers when 70%+ of player scrolls out of view
- **LoopControl A-B uses setInterval** - 100ms polling to enforce loop boundaries
- **CinemaMode z-index stacking** - Overlay at 9998, player elevated to 9999
- **QuickBookmark uses localStorage** - Pruned to 200 entries max
- **CommentNav uses `li.comment-item[data-comment-id]`** - Matches real Rumble DOM structure
- **RantHighlight targets `.chat-history--rant[data-level]`** - Levels 1-10 map to rant tiers
- **ExactCounts uses `data-views` attribute** - Raw integer on `.videostream__views` elements
- **ShareTimestamp uses `?start=` param** - Matches Rumble's native timestamp format
- **RelatedFilter targets `.mediaList-item`** - Desktop sidebar only (`.media-page-related-media-desktop-sidebar`)
- **ShortsFilter detects `use[href="#shorts__label"]`** - SVG badge inside `.videostream__badge`, also hides `#section-shorts`
- **ChatAutoScroll uses scroll threshold** - 80px from bottom = "near bottom", pauses on user scroll-up
- **AutoExpand uses CSS override** - Forces `max-height: none` on `.media-description` + clicks show-more buttons
- **PlaylistQuickSave tries native `[data-playlist-option="watch-later-add"]` first** - Falls back to local bookmarks

## Version History
- v1.7.0 - Multi-theme engine (4 themes: Catppuccin Mocha, YouTubify, Midnight AMOLED, Rumble Green) with player progress bar coloring via --brand-500 override. Full categorized settings modal (7 categories, sidebar nav, search, enable-all, import/export, Ctrl+Shift+X shortcut). Removed PiP Button and Cinema Mode. Fixed HidePremium hiding live videos (.videostream__views-ppv is live viewer count, not premium). 35 feature modules total.
- v1.6.0 - Added Shorts Filter (hide from feeds via `#shorts__label` SVG detection), Chat Auto-Scroll (smart pause on scroll-up + jump button), Auto Expand (force descriptions/comments visible), Notification Enhance (Catppuccin dropdown + bell pulse), Playlist Quick Save (Watch Later on thumbnail hover, native API + local fallback). 37 feature modules total.
- v1.5.0 - Added Comment Navigator (prev/next/expand/collapse/OP-only), Rant Highlight (tier glow + $ tracker), Related Filter (search/hide-watched sidebar), Exact Counts (full numbers from data-views), Share Timestamp (copy URL at time). 32 feature modules total. All selectors verified against MHTML snapshots.
- v1.4.0 - Added Mini Player (draggable floating video on scroll), Video Stats (resolution/buffer/frames/codec overlay), Loop Control (full + A-B segment loop), Cinema Mode (dim background), Quick Bookmark (local save/browse). 27 feature modules total.
- v1.3.0 - Added PiP button, Screenshot capture, Watch History (local browsable history with search/overlay), Autoplay Block (suppresses up-next overlays), Search History (recent searches dropdown). 22 feature modules total.
- v1.2.0 - Added KeyboardNav, AutoTheater, LiveChatEnhance, VideoTimestamps. Massively expanded DarkEnhance (header, nav, search, cards, video page, votes, comments, sidebar, buttons, chat, popouts, notifications, footer, selection). Expanded AdNuker (IMA SDK, LRT, premium banners, host-read text). Added Page.isSearch/isChannel/isLive detection.
- v1.1.0 - Added SpeedController, ScrollVolume, AutoMaxQuality, WatchProgress, ChannelBlocker
- v1.0.0 - Initial release with AdNuker, FeedCleanup, HidePremium, CategoryFilter, DarkEnhance, TheaterSplit, VideoDownloader, LogoToFeed
