#!/usr/bin/env node
/**
 * check-store-listing.js — keeps design/store/listing.json honest.
 *
 * Chrome Web Store requires a justification for every permission requested,
 * and rejects a listing whose short description runs past 132 characters or
 * whose promotional images are not exactly the required size. All three are
 * checkable here rather than at submission time, which is the only other
 * moment anyone would find out.
 *
 * The image dimension checks read the PNGs on disk, so a stale or hand-edited
 * asset fails the same way a mis-captured one does.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LISTING = path.join(ROOT, 'design', 'store', 'listing.json');
const STORE_DIR = path.join(ROOT, 'design', 'store');
const MANIFEST = path.join(ROOT, 'extension', 'manifest.json');

const SHORT_DESCRIPTION_MAX = 132;
const REQUIRED_LOCALES = ['en', 'de', 'es', 'pt_BR'];
const EXACT_SIZES = {
    'promo-tile-440x280.png': [440, 280],
    'promo-marquee-1400x560.png': [1400, 560],
};

/** PNG IHDR: 8-byte signature, 4-byte length, 4-byte type, then w/h as BE uint32. */
function pngSize(file) {
    const buf = fs.readFileSync(file);
    if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${file} is not a PNG`);
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

function main() {
    const errors = [];
    const listing = JSON.parse(fs.readFileSync(LISTING, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

    // 1. Every requested permission is justified, and nothing is justified
    //    that is no longer requested (a stale entry reads as a live claim).
    const pairs = [
        ['API permission', manifest.permissions || [], Object.keys(listing.permission_justifications.api)],
        ['host permission', manifest.host_permissions || [], Object.keys(listing.permission_justifications.host)],
    ];
    for (const [label, requested, justified] of pairs) {
        for (const p of requested) {
            if (!justified.includes(p)) errors.push(`${label} "${p}" is requested but has no justification`);
        }
        for (const p of justified) {
            if (p.startsWith('_')) continue;
            if (!requested.includes(p)) errors.push(`${label} "${p}" is justified but no longer requested`);
        }
    }

    // 2. Store copy exists in every shipped locale and fits the CWS cap.
    for (const locale of REQUIRED_LOCALES) {
        const copy = listing.copy[locale];
        if (!copy) { errors.push(`store copy missing for locale ${locale}`); continue; }
        for (const field of ['name', 'short_description', 'detailed_description']) {
            if (!copy[field] || !copy[field].trim()) errors.push(`${locale}.${field} is empty`);
        }
        if (copy.short_description && copy.short_description.length > SHORT_DESCRIPTION_MAX) {
            errors.push(
                `${locale}.short_description is ${copy.short_description.length} characters, `
                + `over the ${SHORT_DESCRIPTION_MAX} the Chrome Web Store allows`,
            );
        }
    }

    // 3. Every declared asset exists, and the promo images are exactly right.
    const declared = [
        ...listing.assets.screenshots_1280x800,
        ...listing.assets.screenshots_640x400,
        listing.assets.promo_tile_440x280,
        listing.assets.promo_marquee_1400x560,
    ];
    for (const name of declared) {
        const file = path.join(STORE_DIR, name);
        if (!fs.existsSync(file)) { errors.push(`declared asset is missing: ${name}`); continue; }
        // The screenshot filenames carry their own size, so check them too.
        const fromName = name.match(/(\d+)x(\d+)\.png$/);
        const expected = EXACT_SIZES[name] || (fromName ? [Number(fromName[1]), Number(fromName[2])] : null);
        if (!expected) continue;
        const [w, h] = pngSize(file);
        if (w !== expected[0] || h !== expected[1]) {
            errors.push(`${name} is ${w}x${h}, expected ${expected[0]}x${expected[1]}`);
        }
    }

    if (errors.length) {
        console.error('check-store-listing failed.\n');
        for (const error of errors) console.error('  - ' + error);
        console.error('\nRe-capture assets with: RUMBLEX_STORE_CAPTURE=1 npx playwright test tests/e2e/store-assets.spec.js');
        process.exit(1);
    }

    const perms = (manifest.permissions || []).length + (manifest.host_permissions || []).length;
    console.log(
        `check-store-listing OK: ${perms} permissions justified, `
        + `${REQUIRED_LOCALES.length} locales of copy within the ${SHORT_DESCRIPTION_MAX}-character cap, `
        + `${declared.length} assets at their exact required sizes.`,
    );
}

main();
