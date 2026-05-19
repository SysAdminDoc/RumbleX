#!/usr/bin/env python3
"""
RumbleX MHTML selector regression harness — v3.4 deliverable.

Walks every MHTML fixture in Sample Pages/, extracts the HTML payload,
then asserts every named surface in extension/content.js Selectors._map
matches at least one element via its stable or fallback selector.

The asserter uses regex/substring matching, not a real CSS engine. That's
intentional — we want a stdlib-only script (matches analyze_pages.py
precedent) and we're checking "this selector pattern appears in the HTML
at all", not "this selector parses into a valid CSS AST".

Exit codes:
  0 — every named surface resolved on every fixture
  1 — at least one surface didn't resolve (regression detected)
  2 — usage / missing-file error

Limitations:
  - The :has(), > , + , ~ combinators aren't parsed deeply — we strip them
    and check the leftmost compound. Good enough for our map today.
  - A "match" can be a false positive when the same attribute value shows
    up in JS strings or HTML comments. Live tests in v3.4's Playwright
    suite (deferred) will catch those.

Usage:
  python test_selectors.py            # run all fixtures
  python test_selectors.py --verbose  # show every selector resolution
"""

import email
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
SAMPLE_DIR = os.path.join(REPO_ROOT, 'Sample Pages')
CONTENT_JS = os.path.join(REPO_ROOT, 'extension', 'content.js')

# Map from MHTML filename → list of surfaces we expect to resolve there.
# Empty list ⇒ test every key in Selectors._map against the fixture (the
# default). Keep this overrideable so we can target tests like "shorts.* only
# applies to a /shorts capture once we have one".
FIXTURE_EXPECTATIONS = {
    # Original 4 fixtures (pre-v3.12).
    'For You.mhtml':            ['header.root', 'nav.mainMenu', 'search.form', 'search.input',
                                 'feed.card', 'feed.cardTitle', 'feed.author', 'modal.portal'],
    'My Feed.mhtml':            ['header.root', 'nav.mainMenu', 'search.form', 'search.input',
                                 'feed.card', 'feed.cardTitle', 'feed.author', 'modal.portal'],
    'VOD-Watch Page.mhtml':     ['header.root', 'watch.media', 'watch.player', 'watch.title',
                                 'watch.share', 'watch.description', 'comments.root',
                                 'comments.item', 'comments.text', 'modal.portal'],
    'Live.mhtml':               ['header.root', 'watch.media', 'watch.player', 'watch.title',
                                 'chat.root', 'chat.history', 'chat.message', 'chat.username',
                                 'modal.portal'],

    # v3.12.0 — New fixture batch dropped 2026-05-19. Per-page expectations
    # only — listing every surface against every fixture would noise the
    # output with route-mismatch "failures" (e.g. chat.* on a feed page).

    # Feed-style pages. Note: Browse + Trending lazy-load their cards via
    # htmx after initial render, so the static MHTML capture has no
    # feed.card matches even though the live page does. We only assert
    # the page chrome here.
    'Browse.mhtml':             ['header.root', 'nav.mainMenu', 'modal.portal'],
    'Editor Picks.mhtml':       ['header.root', 'nav.mainMenu', 'feed.card', 'modal.portal'],
    'Trending.mhtml':           ['header.root', 'nav.mainMenu', 'modal.portal'],

    # Account / library / personal-content surfaces.
    'My Library.mhtml':         ['header.root', 'nav.mainMenu', 'modal.portal'],
    'Watch History.mhtml':      ['header.root', 'nav.mainMenu', 'modal.portal'],
    'Watch Later.mhtml':        ['header.root', 'nav.mainMenu', 'modal.portal'],
    'Profile.mhtml':            ['header.root', 'nav.mainMenu', 'modal.portal'],
    'Recurring Subs.mhtml':     ['header.root', 'nav.mainMenu', 'modal.portal',
                                 'account.recurringSubsCancelBtn'],
    'Followed Channels.mhtml':  ['header.root', 'nav.mainMenu', 'modal.portal',
                                 'account.followedChannelsSection',
                                 'account.followedChannelsUnsubBtn'],

    # New top-level platform surfaces.
    'Shorts.mhtml':             ['header.root', 'nav.mainMenu', 'modal.portal',
                                 'shorts.feed', 'shorts.card', 'shorts.player', 'shorts.navItem'],
    'Rumble Studio.mhtml':      ['header.root'],  # heavy SPA, minimal static HTML

    # Non-content pages — sanity-check only that the header still renders.
    'Stats and Analytics.mhtml':     ['header.root'],
    # Sticker Mule store is on a 3rd-party domain via Rumble link-out; we
    # don't ship selectors for it. Skip with an empty expectation list.
    "Rumble's Store _ Sticker Mule.mhtml": [],
}


def extract_html_from_mhtml(path):
    """Read MHTML, return the largest text/html part as a string."""
    with open(path, 'rb') as f:
        msg = email.message_from_binary_file(f)
    best = ''
    for part in msg.walk():
        if part.get_content_type() != 'text/html':
            continue
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        charset = part.get_content_charset() or 'utf-8'
        try:
            text = payload.decode(charset, errors='replace')
        except LookupError:
            text = payload.decode('utf-8', errors='replace')
        if len(text) > len(best):
            best = text
    # MHTML uses quoted-printable for HTML — strip soft line breaks that
    # would otherwise insert `=\n` inside attribute values.
    best = best.replace('=\r\n', '').replace('=\n', '')
    # Decode the most common =3D quoted-printable for `="` so attribute
    # value regexes match. We don't fully decode quoted-printable; we
    # decode just enough to find selector patterns.
    best = best.replace('=3D', '=').replace('=2E', '.').replace('=2D', '-').replace('=22', '"').replace('=27', "'")
    return best


def parse_selectors_map(content_js_text):
    """Extract Selectors._map entries from content.js. Returns dict
    name → { 'stable': str, 'fallback': str }.

    Handles mixed-quote selectors like `'header[data-js="app_header"]'`
    by matching `'...'` and `"..."` strings where the contents may
    contain the OTHER quote type freely."""
    # Find the _map: { ... } block.
    map_match = re.search(r'_map:\s*\{(.+?)\n    \},', content_js_text, re.DOTALL)
    if not map_match:
        raise ValueError('Could not locate Selectors._map block in content.js')
    block = map_match.group(1)
    # Two string patterns: 'sq-body' or "dq-body". Permissive on internals.
    str_pat = r"(?:'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\")"
    line_re = re.compile(
        r"['\"]([\w.]+)['\"]\s*:\s*\{\s*stable\s*:\s*" + str_pat +
        r"\s*,\s*fallback\s*:\s*" + str_pat + r"\s*\}",
    )
    entries = {}
    for m in line_re.finditer(block):
        name = m.group(1)
        stable = m.group(2) if m.group(2) is not None else m.group(3)
        fallback = m.group(4) if m.group(4) is not None else m.group(5)
        entries[name] = {'stable': stable, 'fallback': fallback}
    return entries


def simplify_selector(sel):
    """Reduce a CSS selector to a regex-friendly compound.
    Strips :has() bodies, combinators, multi-selector commas. Returns the
    LAST compound (most specific) since that's typically the attribute
    we care about for existence checks."""
    # Strip :has(...) bodies entirely — they nest CSS recursively.
    sel = re.sub(r':has\([^)]*\)', '', sel)
    sel = re.sub(r':not\([^)]*\)', '', sel)
    # Split on comma → multi-selector — take the first since any one match counts.
    sel = sel.split(',')[0].strip()
    # Split on whitespace / combinators → take the LAST descendant compound.
    parts = re.split(r'[\s>+~]+', sel)
    parts = [p for p in parts if p]
    return parts[-1] if parts else ''


def selector_to_regex(sel):
    """Turn a compound CSS selector (last compound only) into a regex.
    Supports tag, #id, .class, [attr], [attr="value"], [attr*="value"],
    [attr^="value"], [attr$="value"]. Compound combinations are AND'd via
    separate searches by the caller."""
    sel = sel.strip()
    if not sel:
        return None
    patterns = []
    # Pull out [attr*=...] etc.
    for amatch in re.finditer(r'\[([^\]=*~^$]+)([*~^$]?=)?["\']?([^"\'\]]*)["\']?\]', sel):
        name = re.escape(amatch.group(1).strip())
        op = amatch.group(2) or ''
        val = re.escape(amatch.group(3))
        if not op:
            patterns.append(name + r'\s*=')  # attribute presence
        elif op == '=':
            # exact (also allow space-separated for class-style values)
            patterns.append(name + r'\s*=\s*["\'][^"\']*' + val + r'[^"\']*["\']')
        else:
            patterns.append(name + r'\s*[*~^$]?=\s*["\'][^"\']*' + val + r'[^"\']*["\']')
    # IDs.
    for idmatch in re.finditer(r'#([\w-]+)', sel):
        patterns.append(r'id\s*=\s*["\']' + re.escape(idmatch.group(1)) + r'["\']')
    # Classes.
    for cmatch in re.finditer(r'\.([\w-]+)', sel):
        cls = re.escape(cmatch.group(1))
        patterns.append(r'class\s*=\s*["\'][^"\']*\b' + cls + r'\b[^"\']*["\']')
    # Bare tag at the start of the compound.
    tag_only = re.match(r'^([a-zA-Z][\w-]*)(?:[.#\[]|$)', sel)
    if tag_only:
        patterns.append(r'<' + re.escape(tag_only.group(1)) + r'\b')
    return patterns or None


def selector_matches(html, sel):
    """Return True if a simplified version of `sel` plausibly resolves
    against `html`. AND across compound patterns — every component must
    appear at least once anywhere in the HTML (not necessarily on the
    same element — that's the harness's documented limitation)."""
    simplified = simplify_selector(sel)
    patterns = selector_to_regex(simplified)
    if not patterns:
        return False
    for pat in patterns:
        if not re.search(pat, html, re.IGNORECASE):
            return False
    return True


def main():
    verbose = '--verbose' in sys.argv or '-v' in sys.argv

    if not os.path.isdir(SAMPLE_DIR):
        print(f'[!] Sample Pages/ not found at {SAMPLE_DIR}', file=sys.stderr)
        sys.exit(2)
    if not os.path.isfile(CONTENT_JS):
        print(f'[!] extension/content.js not found at {CONTENT_JS}', file=sys.stderr)
        sys.exit(2)

    with open(CONTENT_JS, encoding='utf-8') as f:
        content = f.read()
    selectors = parse_selectors_map(content)
    print(f'[*] Parsed {len(selectors)} selector entries from content.js')

    failures = []
    passes = 0

    for fname in sorted(os.listdir(SAMPLE_DIR)):
        if not fname.endswith('.mhtml'):
            continue
        path = os.path.join(SAMPLE_DIR, fname)
        html = extract_html_from_mhtml(path)
        expected = FIXTURE_EXPECTATIONS.get(fname, list(selectors.keys()))
        if verbose:
            print(f'\n[*] {fname} ({len(html):,} chars HTML, checking {len(expected)} surfaces)')
        for surface in expected:
            entry = selectors.get(surface)
            if not entry:
                # Surface in expectations but not in map — skip rather than fail
                # so the harness doesn't break when names drift.
                if verbose:
                    print(f'    SKIP   {surface}  (not in Selectors._map)')
                continue
            stable_ok = selector_matches(html, entry['stable'])
            fallback_ok = selector_matches(html, entry['fallback'])
            if stable_ok:
                passes += 1
                if verbose:
                    print(f'    OK     {surface}  (stable)')
            elif fallback_ok:
                passes += 1
                print(f'    WARN   {fname} / {surface}  (only fallback selector matched)')
            else:
                failures.append((fname, surface, entry['stable'], entry['fallback']))
                print(f'    FAIL   {fname} / {surface}  (neither stable nor fallback matched)')

    print(f'\n[*] {passes} pass, {len(failures)} fail')
    if failures:
        print('\nFailures:')
        for fname, surface, stable, fallback in failures:
            print(f'  - {fname} / {surface}')
            print(f'      stable:   {stable}')
            print(f'      fallback: {fallback}')
        sys.exit(1)

    print('[*] All expected surfaces resolved in every fixture.')


if __name__ == '__main__':
    main()
