#!/usr/bin/env node
'use strict';

// Produce the committed offline Rumble watch fixture from a local capture.
//
// The problem this solves: five Playwright specs mounted the extension against
// `rumble_decoded.html`, a 600 KB capture of a real signed-in session that is
// gitignored and has never been pushed. They read it with fs.readFileSync at
// module scope, so on a fresh clone they throw at collection rather than
// skipping, and `npm run verify` — the project's own mandatory release gate —
// could not pass for anybody but the maintainer.
//
// The fixture has to stay rich. A hand-built structural page leaves 36 of the
// 46 injected surfaces unmounted, and the a11y sweep counts an unmounted
// surface as a failure rather than a skip, exactly so a thin fixture cannot
// turn it green for the wrong reason. So the real capture is reduced instead:
// every tag, class, id and data hook survives, and everything that identifies a
// person, a session, or the capturing browser is replaced with a synthetic
// value of the same shape.
//
// Usage:  node scripts/build-offline-fixture.js [source-capture.html]
//         node scripts/build-offline-fixture.js --check
//
// --check regenerates in memory and fails if the committed fixture differs, so
// the file cannot drift from the script that documents how it was made.

const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE = path.join(ROOT, 'rumble_decoded.html');
const OUTPUT = path.join(ROOT, 'tests', 'fixtures', 'platform', 'offline-watch.html');
// The recorded hash is what makes --check meaningful in a clone, where there
// is no capture to regenerate from and existence alone proves nothing.
const HASH_FILE = path.join(ROOT, 'tests', 'fixtures', 'platform', 'offline-watch.sha256');

function fileHash(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function recordedHash() {
    assert.ok(fs.existsSync(HASH_FILE), `fixture hash record is missing: ${HASH_FILE}`);
    return fs.readFileSync(HASH_FILE, 'utf8').trim().split(/\s+/)[0];
}

// Stable synthetic identities. Hashing the original keeps every reference to
// the same person consistent across the page (chat rows, avatars, links) while
// carrying none of the original value.
const synthetic = new Map();
function fakeName(original, prefix) {
    const key = `${prefix}:${original}`;
    if (!synthetic.has(key)) {
        const digest = crypto.createHash('sha256').update(key).digest('hex');
        synthetic.set(key, `${prefix}${digest.slice(0, 10)}`);
    }
    return synthetic.get(key);
}
function fakeDigits(original, prefix, length) {
    const key = `${prefix}#${original}`;
    if (!synthetic.has(key)) {
        const digest = crypto.createHash('sha256').update(key).digest('hex');
        const digits = BigInt(`0x${digest.slice(0, 16)}`).toString().padStart(length, '0');
        synthetic.set(key, digits.slice(0, length));
    }
    return synthetic.get(key);
}

function sanitize(source) {
    let html = source;

    // 1. Artifacts of the capturing browser, not of Rumble. Dark Reader
    //    rewrites colours inline, which would also fight the theme tests.
    html = html.replace(/\sdata-darkreader-[a-z-]+="[^"]*"/gi, '');
    html = html.replace(/<style[^>]*darkreader[^>]*>[\s\S]*?<\/style>/gi, '');
    html = html.replace(/\sclass="darkreader[^"]*"/gi, '');
    // Dark Reader also rewrites inline styles into --darkreader-* custom
    // properties. Left in place they fight the theme tests, which is the
    // opposite of what a neutral fixture is for.
    html = html.replace(/--darkreader-[a-z0-9-]+\s*:\s*[^;"']*;?/gi, '');
    html = html.replace(/<meta[^>]+name="darkreader"[^>]*>/gi, '');
    html = html.replace(/\sstyle="\s*"/gi, '');

    // CDN media paths carry opaque signed-looking segments. The project's own
    // diagnostic redaction treats those as token-like, so a committed fixture
    // should not ship them either. The host, the /video/ shape and the
    // extension all survive, because the download probe reads exactly those.
    html = html.replace(
        /(https:\/\/(?:[a-z0-9-]+\.)?(?:1a-1791\.com|rumble\.cloud)\/video\/)([^"'\s&)]+?)(\.[a-z0-9]{2,5})(?=["'\s&)]|$)/gi,
        (_, lead, token, ext) => `${lead}${fakeName(token, 'media').replace(/^media/, 'fx/')}${ext}`,
    );

    // 2. MHTML content-id references. They resolve to nothing outside the
    //    original archive and read like addresses.
    html = html.replace(/<link[^>]+href="cid:[^"]*"[^>]*>/gi, '');
    html = html.replace(/cid:[A-Za-z0-9._-]+@mhtml\.blink/gi, 'about:blank');

    // 3. Third-party identities. Values are replaced, attributes are kept, so
    //    every selector the extension relies on still resolves.
    //
    //    An earlier pass rewrote only /user/ and /c/ URL segments and
    //    data-username. That left the uploader's name and the whole related
    //    list in visible element text, the capturing account's follow list in
    //    data-slug/data-title/data-id, and real numeric ids inside hx-vals,
    //    which also made the page internally inconsistent: the same id was
    //    hashed in one attribute and verbatim in another. Collect every
    //    identity first, then replace it everywhere it appears.
    const identities = new Map();
    const remember = (value, prefix) => {
        const trimmed = String(value || '').trim();
        if (trimmed.length < 2) return;
        if (!identities.has(trimmed)) identities.set(trimmed, fakeName(trimmed, prefix));
    };
    for (const [, name] of html.matchAll(/\/(?:user|c)\/([A-Za-z0-9_-]+)/g)) remember(name, 'rxname');
    for (const [, name] of html.matchAll(/data-(?:username|slug|title)="([^"]*)"/g)) remember(name, 'rxname');
    for (const [, name] of html.matchAll(/<h4 class="mediaList-by-heading"[^>]*>([^<]*)</g)) remember(name, 'rxname');
    for (const [, name] of html.matchAll(/class="media-heading-name truncate"[^>]*>([^<]*)</g)) remember(name, 'rxname');
    for (const [, name] of html.matchAll(/class="channel-header--title"[^>]*>([^<]*)</g)) remember(name, 'rxname');

    // Longest first, so a name that contains another name is replaced whole.
    for (const original of [...identities.keys()].sort((a, b) => b.length - a.length)) {
        const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        html = html.replace(new RegExp(`(?<![A-Za-z0-9_-])${escaped}(?![A-Za-z0-9_-])`, 'g'), identities.get(original));
    }

    // Numeric ids, everywhere rather than per-attribute. hx-vals carries them
    // as HTML-escaped JSON, which no attribute-specific rule reaches.
    const numericIds = new Set();
    const collectIds = (pattern, group = 1) => {
        for (const match of html.matchAll(pattern)) numericIds.add(match[group]);
    };
    collectIds(/data-(?:message-user-id|message-id|video-fid|video-id|id|entity-id)="(\d{6,})"/g);
    collectIds(/&quot;(?:creator_id|channel_id|collection_id|video_id|user_id|playlist_id)&quot;\s*:\s*&quot;?(\d{6,})/g);
    collectIds(/\b(?:creator_id|channel_id|collection_id|video_id|user_id)"\s*:\s*"?(\d{6,})/g);
    for (const id of [...numericIds].sort((a, b) => b.length - a.length)) {
        html = html.replace(new RegExp(`(?<!\\d)${id}(?!\\d)`, 'g'), fakeDigits(id, 'id', id.length));
    }

    // 3b. Opaque server-signed values. data-epk and the hx-vals event blobs are
    //     base64url tokens minted for the capturing session, and no keyword
    //     precedes them, so the credential rule below never sees them.
    html = html.replace(/(data-epk=")([A-Za-z0-9_-]{16,})(")/g,
        (_, a, token, b) => a + fakeName(token, 'epk').padEnd(token.length, '0').slice(0, token.length) + b);
    html = html.replace(/(&quot;(?:event_data|encoded|payload|signature|sig)&quot;\s*:\s*&quot;)([A-Za-z0-9_-]{24,})(&quot;)/g,
        (_, a, token, b) => a + fakeName(token, 'blob').padEnd(token.length, '0').slice(0, token.length) + b);

    // 3c. The page's own subject. The title, description, social metadata and
    //     canonical slug name the exact video, which names the channel and
    //     pins the session date.
    html = html.replace(/(https:\/\/rumble\.com\/)(v[a-z0-9]+)-[a-z0-9-]+(\.html)/gi, '$1$2-fixture$3');
    html = html.replace(/(<title>)([^<]*)(<\/title>)/i, '$1Fixture watch page$3');
    html = html.replace(/(<meta[^>]+(?:property|name)="(?:og:title|twitter:title)"[^>]*content=")([^"]*)(")/gi, '$1Fixture watch page$3');
    html = html.replace(/(<meta[^>]+(?:property|name)="(?:og:description|twitter:description|description)"[^>]*content=")([^"]*)(")/gi, '$1Synthetic fixture page for the RumbleX test suite.$3');
    html = html.replace(/(<meta[^>]+(?:property|name)="(?:og:url|twitter:url)"[^>]*content=")([^"]*)(")/gi, '$1https://rumble.com/vfixture-offline-watch.html$3');
    html = html.replace(/(<link[^>]+rel="canonical"[^>]*href=")([^"]*)(")/gi, '$1https://rumble.com/vfixture-offline-watch.html$3');
    // oEmbed discovery links repeat the title in an attribute of their own.
    html = html.replace(/(<link[^>]+type="application\/(?:json|xml)\+oembed"[^>]*)/gi,
        (tag) => tag.replace(/title="[^"]*"/i, 'title="Fixture watch page"'));
    // The visible heading and description are the same strings again.
    html = html.replace(/(<h1 class="[^"]*"[^>]*>)([\s\S]*?)(<\/h1>)/i, '$1Fixture watch page$3');
    html = html.replace(/(<p class="media-description"[^>]*>)([\s\S]*?)(<\/p>)/i,
        '$1Synthetic fixture page for the RumbleX test suite.$3');

    // Embed ids name the video as surely as the slug did. Replace them with a
    // synthetic id of the same shape so the media parsers still resolve one.
    // The id shows up percent-encoded in oEmbed discovery URLs and as the
    // player element's own id, not only as a clean /embed/ path.
    const embedIds = new Set([
        ...[...html.matchAll(/\/embed\/(v[a-z0-9]{4,12})\b/gi)].map((match) => match[1]),
        ...[...html.matchAll(/%2Fembed%2F(v[a-z0-9]{4,12})(?:%2F|\b)/gi)].map((match) => match[1]),
        ...[...html.matchAll(/\bid="vid_(v[a-z0-9]{4,12})"/gi)].map((match) => match[1]),
    ]);
    for (const id of embedIds) {
        const replacement = `v${fakeName(id, 'e').replace(/^e/, '').slice(0, id.length - 1)}`;
        // Percent-encoded first: in %2Fv74uy6i%2F the preceding character is F,
        // so the word-boundary form below refuses to match.
        html = html.replace(new RegExp(`(%2F)${id}(%2F)`, 'gi'), `$1${replacement}$2`);
        html = html.replace(new RegExp(`(?<![A-Za-z0-9])${id}(?![A-Za-z0-9])`, 'g'), replacement);
    }

    // 4. Remote assets. Every spec that uses this fixture aborts non-Rumble
    //    routes, so a live URL is dead weight that also carries CDN path
    //    tokens. Point them at an in-page placeholder instead.
    html = html.replace(/(<img\b[^>]*?\ssrc=")([^"]*)(")/gi, '$1data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==$3');
    html = html.replace(/(\ssrcset=")[^"]*(")/gi, '$1$2');
    html = html.replace(/(<(?:script|iframe)\b[^>]*?\ssrc=")[^"]*(")/gi, '$1about:blank$2');

    // 5. Anything that looks like a credential, wherever it hides. The capture
    //    has none today; this is the belt that keeps a future re-capture safe.
    html = html.replace(
        /\b(authorization|cookie|csrf[_-]?token|session[_-]?id|access[_-]?token|refresh[_-]?token|api[_-]?key|bearer)(\s*[:=]\s*["']?)[A-Za-z0-9._~+/-]{8,}/gi,
        '$1$2[redacted]',
    );
    html = html.replace(/\b[A-Za-z0-9._%+-]+@(?!mhtml\.blink)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 'fixture@example.invalid');

    const banner = '<!-- Sanitized offline Rumble watch capture. Generated by scripts/build-offline-fixture.js.\n'
        + '     Structure is real; every identity, asset URL and browser-extension artifact is synthetic.\n'
        + '     Regenerate with: node scripts/build-offline-fixture.js <capture.html> -->\n';
    return banner + html.trimStart();
}

function main() {
    const args = process.argv.slice(2);
    const check = args.includes('--check');
    const sourcePath = args.find((arg) => !arg.startsWith('--')) || DEFAULT_SOURCE;

    if (check && !fs.existsSync(sourcePath)) {
        // The private capture is not part of a clone, so there is nothing to
        // regenerate from. Comparing against the recorded hash still catches a
        // hand-edited fixture, which is the failure that matters here: without
        // it this branch asserted only that the file exists, and a clone is
        // every machine but the maintainer's.
        assert.ok(fs.existsSync(OUTPUT), `committed fixture is missing: ${OUTPUT}`);
        const actual = fileHash(OUTPUT);
        const expected = recordedHash();
        assert.equal(actual, expected,
            'tests/fixtures/platform/offline-watch.html does not match the hash recorded in '
            + `${path.basename(HASH_FILE)}. It was edited by hand, or regenerated without updating the record. `
            + `Run: node scripts/build-offline-fixture.js\n  recorded: ${expected}\n  on disk:  ${actual}`);
        console.log(`Offline fixture check OK: no local capture to regenerate from; committed fixture matches ${expected.slice(0, 16)}.`);
        return;
    }

    assert.ok(fs.existsSync(sourcePath), `capture not found: ${sourcePath}`);
    const generated = sanitize(fs.readFileSync(sourcePath, 'utf8'));

    if (check) {
        const committed = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, 'utf8') : '';
        assert.equal(generated, committed,
            'tests/fixtures/platform/offline-watch.html differs from what this script produces. '
            + 'Regenerate it rather than hand-editing: node scripts/build-offline-fixture.js');
        assert.equal(fileHash(OUTPUT), recordedHash(),
            'the committed fixture matches the generator but not its recorded hash. Run: node scripts/build-offline-fixture.js');
        console.log(`Offline fixture check OK: ${OUTPUT.replace(ROOT + path.sep, '')} matches the generator and its recorded hash.`);
        return;
    }

    fs.writeFileSync(OUTPUT, generated);
    fs.writeFileSync(HASH_FILE, `${fileHash(OUTPUT)}  offline-watch.html
`);
    console.log(`Wrote ${OUTPUT.replace(ROOT + path.sep, '')} (${generated.length} bytes) from ${path.basename(sourcePath)}.`);
}

main();
