# RumbleX Roadmap

126-module Rumble enhancement suite (MV3 + MV2 + userscript). Roadmap continues the hide-X toggle depth, hardens downloads and security posture, and extends beyond Rumble's UI gaps into community tooling.

## Planned Features

### Downloads & Capture
- DASH + fragmented MP4 support for Rumble's newer streams
- Per-video audio-only extraction via `ffmpeg.wasm` (actual m4a, not the low-bitrate MP4 workaround)
- Background download queue with pause/resume + throughput graph
- Subtitle (VTT) sidecar save alongside MP4
- Native browser-integrated "Download in tab" action on hover
- CDN probe cache so repeat scans on same channel are instant

### Live Experience
- Multi-stream viewer (watch 2–4 Rumble live streams in a grid)
- Chat cross-post across streams when user is casting the same msg
- Rant-tier filter ("only show $10+")
- Sticky super-chat style pinning for high-tier rants
- Clip maker with broadcaster-consent toggle (respect channel flag)

### Feed / Discovery
- Custom home feed (user-composed from subscriptions + keyword watchlists)
- Channel velocity graph (uploads/week trend) on hover
- Watch-next recommendation replacement using local history only
- "Hide watched" toggle for feeds

### Comments & Chat
- Inline translation of chat messages (on-device)
- Emote / custom BTTV-style overlay (future-proof for Rumble emotes)
- Per-channel mute list with reason + expiry
- Thread view for replies
- Chat search within current stream

### Settings / Platform
- Account-free cloud sync (user-provided gist URL, encrypted)
- Multi-profile (Work / Casual / Creator)
- Settings snapshot history with restore
- Accessibility audit: keyboard flow, focus rings, contrast
- Localization pass (es, pt-BR, de, fr)

### Security Hardening
- Strict CSP audit + external-resource allowlist expand note
- Signed-release + SRI for bundled mux.js
- Firefox MV3 port plan (MV2 deprecation runway)
- Automated regression tests on CDN probe + download UI

## Competitive Research
- **Astra-Deck** (user's own for YouTube) — same architectural pattern. Lesson: share utilities (settings modal, update checker, download core) across both as a shared package.
- **YouTube-NonStop / Enhancer for YouTube** — feature-rich YT tools. Lesson: port their best ideas (volume scroll, auto-quality, shortcuts) where Rumble has gaps — many are already present.
- **Rumble Redirect / Rumble Ad Skip** — single-purpose scripts. Lesson: keep the opt-in default so we don't bloat the common case.
- **SponsorBlock (YT)** — crowdsourced segment DB. Lesson: RumbleX's local-only SponsorBlock could add optional cloud sync without betraying privacy posture.

## Nice-to-Haves
- Global command palette (Ctrl+K style)
- Per-feature telemetry-free usage counter (local only) for "what do I actually use"
- Compact vs spacious mode toggle
- Screen-reader polish on toggles and modals
- Chrome Web Store + Firefox Add-ons store listing (currently sideload only)
- Revenue-free LTS policy statement in README

## Open-Source Research (Round 2)

### Related OSS Projects
- https://github.com/dlepold/noannoying-rumbleadadbanners — Minimal Rumble banner hider userscript, good baseline reference
- https://github.com/ReVanced/revanced-patches/issues/2721 — Feature request thread for Rumble ad blocking, catalogs current ad surfaces (preroll, midroll, 3x chained, livestream)
- https://github.com/AdguardTeam/AdGuardExtra — Anti-anti-adblock toolkit; useful if Rumble adds bypass detection
- https://chromewebstore.google.com/detail/rumble-video-accelerator/afedcnlnaijfabfnibpldpdkilbghgng — Rumble Video Accelerator (speed-through ads technique, closed-source but documented)
- https://github.com/topics/ad-blocker?l=javascript — Topic hub for filter-list + DOM-removal patterns
- https://github.com/gorhill/uBlock — Cosmetic filter syntax + scriptlet injection reference
- https://greasyfork.org/en/scripts/by-site/rumble.com — GreasyFork directory of existing Rumble scripts (feature-idea mining)

### Features to Borrow
- Video-speed-through-ads fallback — detect ad segment, temporarily 16x speed + mute, restore on ad end (Rumble Video Accelerator technique)
- Filter-list subscription model — pull remote updatable cosmetic rules like uBO so DOM selectors can fix without shipping a new release (uBlock Origin)
- Adguard Extra-style "scriptlet" system — inject small named script snippets per site rather than one big blob (AdGuard Extra)
- Livestream chained-ad special case — detect "ad 1/3", skip forward in player buffer (ReVanced issue #2721 notes)
- Paid Rumble Rants capture export (referenced in Chrome Web Store extensions)
- Chat QoL merges from GreasyFork one-off scripts (mentions, chat translation, emote picker) (greasyfork Rumble directory)

### Patterns & Architectures Worth Studying
- Two-world content-script split (MAIN world for player API intercept, ISOLATED world for chrome.storage) — you already use this, but uBO extends with per-frame dynamic world injection (uBlock Origin)
- Remote filter-list bundle with ETag/If-Modified-Since + signed manifest — fix ad DOM changes without releasing the extension (uBO / AdGuard)
- Scriptlet registry pattern — `rules.json` lists `{ match: "rumble.com/live/*", run: "skip-chained-ads" }` (AdGuard Extra)
- Companion Firefox MV2 build from same source tree with shim layer (ReVanced pattern)
