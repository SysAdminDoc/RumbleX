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
    html = html.replace(/(\/(?:user|c)\/)([A-Za-z0-9_-]+)/g, (_, lead, name) => lead + fakeName(name, 'channel'));
    html = html.replace(/(data-username=")([^"]*)(")/g, (_, a, name, b) => a + fakeName(name, 'viewer') + b);
    html = html.replace(/(data-message-user-id=")(\d+)(")/g, (_, a, id, b) => a + fakeDigits(id, 'user', id.length) + b);
    html = html.replace(/(data-message-id=")(\d+)(")/g, (_, a, id, b) => a + fakeDigits(id, 'msg', id.length) + b);
    html = html.replace(/(data-video-fid=")(\d+)(")/g, (_, a, id, b) => a + fakeDigits(id, 'vid', id.length) + b);
    html = html.replace(/(data-video-id=")(\d+)(")/g, (_, a, id, b) => a + fakeDigits(id, 'vid', id.length) + b);

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
        // The private capture is not part of a clone. Nothing to compare
        // against, and the committed fixture is what the suite actually uses.
        assert.ok(fs.existsSync(OUTPUT), `committed fixture is missing: ${OUTPUT}`);
        console.log('Offline fixture check skipped: no local capture to regenerate from; committed fixture present.');
        return;
    }

    assert.ok(fs.existsSync(sourcePath), `capture not found: ${sourcePath}`);
    const generated = sanitize(fs.readFileSync(sourcePath, 'utf8'));

    if (check) {
        const committed = fs.readFileSync(OUTPUT, 'utf8');
        assert.equal(generated, committed,
            'tests/fixtures/platform/offline-watch.html differs from what this script produces. '
            + 'Regenerate it rather than hand-editing: node scripts/build-offline-fixture.js');
        console.log(`Offline fixture check OK: ${OUTPUT.replace(ROOT + path.sep, '')} matches the generator.`);
        return;
    }

    fs.writeFileSync(OUTPUT, generated);
    console.log(`Wrote ${OUTPUT.replace(ROOT + path.sep, '')} (${generated.length} bytes) from ${path.basename(sourcePath)}.`);
}

main();
