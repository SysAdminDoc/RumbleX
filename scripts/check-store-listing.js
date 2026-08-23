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
const FIREFOX_MANIFEST = path.join(ROOT, 'extension', 'manifest-firefox.json');
const PACKAGE = path.join(ROOT, 'package.json');
const PACKAGE_LOCK = path.join(ROOT, 'package-lock.json');
const README = path.join(ROOT, 'README.md');
const LANDING = path.join(ROOT, 'docs', 'index.html');
const CONTENT = path.join(ROOT, 'extension', 'content.js');

const SHORT_DESCRIPTION_MAX = 132;
// Derived, not hardcoded: adding a locale to extension/_locales must also add
// store copy, or the listing silently ships in fewer languages than the
// extension does.
const REQUIRED_LOCALES = fs
    .readdirSync(path.join(ROOT, 'extension', '_locales'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
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

function featureCatalogCount() {
    const core = fs.readFileSync(CONTENT, 'utf8');
    const registryBody = core.match(/const features = \[([\s\S]*?)\n\];/)?.[1] || '';
    const cssBody = core.match(/const RX_CSS_TOGGLES = \[([\s\S]*?)\n\];/)?.[1] || '';
    if (!registryBody || !cssBody) throw new Error('feature registries are missing from content.js');
    const handwritten = [...registryBody.replace(/\/\/.*$/gm, '').matchAll(/\b[A-Z][A-Za-z0-9]+\b/g)]
        .map((match) => match[0])
        .filter((symbol) => symbol !== 'RX_CSS_FEATURES');
    const cssIds = [...cssBody.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);
    if (new Set(handwritten).size !== handwritten.length || new Set(cssIds).size !== cssIds.length) {
        throw new Error('feature registries contain duplicate entries');
    }
    return handwritten.length + cssIds.length;
}

function addVersionError(errors, canonical, label, actual) {
    if (actual !== canonical) {
        errors.push(`${label} version is ${actual || 'missing'}, expected ${canonical}`);
    }
}

function main() {
    const errors = [];
    const listing = JSON.parse(fs.readFileSync(LISTING, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const firefoxManifest = JSON.parse(fs.readFileSync(FIREFOX_MANIFEST, 'utf8'));
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE, 'utf8'));
    const packageLock = JSON.parse(fs.readFileSync(PACKAGE_LOCK, 'utf8'));
    const readme = fs.readFileSync(README, 'utf8');
    const landing = fs.readFileSync(LANDING, 'utf8');
    const canonicalVersion = packageJson.version;
    const featureCount = featureCatalogCount();

    // 1. package.json is the canonical version. Everything a user can install
    //    or see before installing must agree with it.
    const readmeVersion = readme.match(/shields\.io\/badge\/version-v([0-9]+\.[0-9]+\.[0-9]+)-/i)?.[1] || null;
    const landingVersion = landing.match(/data-rumblex-version=["']([^"']+)["']/i)?.[1] || null;
    const visibleLandingVersion = landing.match(
        /data-rumblex-version=["'][^"']+["'][^>]*>\s*<strong>v([^<]+)<\/strong>\s*current build/i,
    )?.[1] || null;
    for (const [label, actual] of [
        ['Chrome manifest', manifest.version],
        ['Firefox manifest', firefoxManifest.version],
        ['package-lock root', packageLock.version],
        ['package-lock package entry', packageLock.packages?.['']?.version],
        ['store listing', listing.version],
        ['README badge', readmeVersion],
        ['project page metadata', landingVersion],
        ['project page visible label', visibleLandingVersion],
    ]) {
        addVersionError(errors, canonicalVersion, label, actual);
    }

    const landingFeatureCount = Number(
        landing.match(/data-rumblex-feature-count=["'](\d+)["']/i)?.[1] || NaN,
    );
    const visibleFeatureCount = Number(
        landing.match(
            /data-rumblex-feature-count=["'][^"']+["'][^>]*>\s*<strong>(\d+)<\/strong>\s*feature modules/i,
        )?.[1] || NaN,
    );
    if (landingFeatureCount !== featureCount) {
        errors.push(`project page feature metadata is ${Number.isFinite(landingFeatureCount) ? landingFeatureCount : 'missing'}, expected ${featureCount}`);
    }
    if (visibleFeatureCount !== featureCount) {
        errors.push(`project page visible feature count is ${Number.isFinite(visibleFeatureCount) ? visibleFeatureCount : 'missing'}, expected ${featureCount}`);
    }

    // 2. Every requested permission is justified, and nothing is justified
    //    that is no longer requested (a stale entry reads as a live claim).
    const requestedHosts = [
        ...(manifest.host_permissions || []),
        ...(manifest.optional_host_permissions || []),
    ];
    const pairs = [
        ['API permission', manifest.permissions || [], Object.keys(listing.permission_justifications.api)],
        ['host permission', requestedHosts, Object.keys(listing.permission_justifications.host)],
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

    // 3. Store copy exists in every shipped locale and fits the CWS cap.
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

    // 4. Every declared asset exists, and the promo images are exactly right.
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

    const perms = (manifest.permissions || []).length + requestedHosts.length;
    console.log(
        `check-store-listing OK: v${canonicalVersion}, ${featureCount} public feature modules, `
        + `${perms} permissions justified, `
        + `${REQUIRED_LOCALES.length} locales of copy within the ${SHORT_DESCRIPTION_MAX}-character cap, `
        + `${declared.length} assets at their exact required sizes.`,
    );
}

main();
