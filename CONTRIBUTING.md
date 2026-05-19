# Contributing to RumbleX

Thanks for considering a contribution. This is a single-maintainer project with strong opinions — read this first so your PR doesn't land in friction.

## What we accept

- **Bug fixes** with a clear reproduction step. If the bug isn't in `ROADMAP.md` already, please open an issue first describing what you saw and what you expected.
- **New feature modules** that match an item already tagged Now or Next in [`ROADMAP.md`](ROADMAP.md). Items in Later, Under Consideration, or Rejected need a written rationale in the PR description before code.
- **Selector hardening** — additions to `Selectors._map` in `extension/content.js` paired with a `Sample Pages/` MHTML capture or grep evidence from a live Rumble page.
- **Translations** — drop a `_locales/<locale>/messages.json` into `extension/_locales/`. Use the existing `en/messages.json` as the source of truth for keys and descriptions. Underscore (not hyphen) in locale folder names: `pt_BR`, `zh_CN`.
- **Accessibility fixes** — anything that improves WCAG 2.2 conformance. Cite the SC in the PR description.
- **Documentation polish** to README, CHANGELOG, or ROADMAP — keep tone dense and skimmable.

## What we don't accept (don't waste your time)

- **Keyboard shortcuts.** Hard house-style rule. `legacyKeyboardNav` is preserved off-by-default for users who had it pre-v2.0. No new `chrome.commands` entries.
- **`backdrop-filter`** for glass overlays. Hard rule. Use alpha + border + shadow only.
- **Pill / oval / fully-rounded backdrops** on text-bearing badges, chips, buttons (i.e. `border-radius: 999px`, `rounded-full` on non-icon-only elements, `Capsule()` backgrounds). Allowed backdrop radii: 0, 4, 6, 8, 10, 12. True circles for avatars / status dots / icon-only square buttons are fine.
- **Confirmation dialogs.** Use undo toasts + snapshot history instead.
- **Telemetry, analytics, remote logging, or usage beacons.** The privacy report explicitly reads "telemetry: none — no analytics, no remote logging, no usage beacons" — adding any of those invalidates the disclosure. Local-only error logs surfaced via a debug panel are acceptable.
- **Light theme** for RumbleX-owned UI. `siteThemeSync` is for mirroring Rumble's native theme switch only; RumbleX panels/popup/options/sidePanel stay dark.
- **CSP relaxation** on Rumble's pages.

## Setup

```bash
git clone https://github.com/SysAdminDoc/RumbleX
cd RumbleX/extension
./build.sh   # produces RumbleX-chrome.zip and RumbleX-firefox.zip in the parent dir
```

In Chrome / Edge / Brave: open `chrome://extensions`, enable Developer mode, click **Load unpacked**, select the `extension/` folder.

In Firefox: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, select `extension/manifest.json`.

Note: the build script fetches `mux.js` from jsDelivr and verifies it against a pinned SHA-256. If the verification fails, the script aborts. Bump the `MUX_JS_SHA256` constant only when intentionally upgrading mux.js, and re-derive the hash on a clean machine.

## Code style

- Vanilla JS, no frameworks, no build step beyond `build.sh`.
- Every feature module follows the `{ id, name, init(), destroy() }` contract. Destroying a module must remove every CSS style, body class, DOM control, observer, timer, event listener, and message listener it added.
- Settings keys land in **three places** in lockstep: `Settings._defaults` in `content.js`, `DEFAULTS` in `popup.js`, `DEFAULTS` + `META` in `options.js`. Three-way catalog parity is enforced — CI will fail otherwise.
- New selectors go in `Selectors._map` first, then features call `Selectors.find(key)` / `Selectors.wait(key)`. Don't add new raw `qs()` / `querySelector()` calls for surfaces already in the map.
- New routes hooked via `Router.onChange()`, not by installing new MutationObservers per feature.

## Commit message style

- One commit per logical change. No "WIP" / "fix typo" / "merge main" commits in PRs — squash before opening.
- Conventional-ish: `feat: ...`, `fix: ...`, `refactor: ...`, `docs: ...`, `chore: ...`. Release commits use `vMAJOR.MINOR.PATCH:` prefix matching the version in the manifests.
- No `Co-Authored-By` trailers. No mention of AI coding tools in commit messages, code, or docs.

## Releasing (maintainer only)

Tag-driven via `.github/workflows/build.yml`:
1. Bump version in `extension/manifest.json`, `extension/manifest-firefox.json`, `extension/content.js` (header + `VERSION` constant fallback), `extension/pages/popup.js`, `extension/pages/options.js`, `README.md` (both badge URLs), and `CHANGELOG.md` (new section with date).
2. Update `ROADMAP.md` — check off completed items, move next-tier items down if they slipped.
3. Commit. Push. `git tag vX.Y.Z && git push --tags`. The workflow uploads the ZIP to the GitHub release.

## Questions

Open an issue with the `question` label. If something is unclear in this file, that itself is a documentation bug — please flag it.
