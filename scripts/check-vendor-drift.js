#!/usr/bin/env node
'use strict';

// Report when a vendored media library has fallen behind the npm registry.
//
// The failure this prevents: `extension/lib/VENDOR.json` pins a hash, which is
// exactly right for supply-chain safety and says nothing at all about age.
// Mediabunny shipped 1.55.2 through 1.55.7 in the fifteen days after the
// vendored 1.55.1, and that window included an fMP4 HLS `emsg` parsing fix, a
// BlobSource memory leak, and AVC SEI and colour-space defects against
// Chromium's decoder. Every one of those sits on the default download path.
// Nothing in the build could notice, because a pinned hash still matched.
//
// Deliberately NOT part of `npm run verify`. That gate has to stay offline and
// deterministic; this one needs the network and its answer changes without the
// repository changing. Run it before a release. A network failure is reported
// and exits 0, because being unable to reach npm is not a reason to block a
// build. Being behind exits 1 so it can be used as a gate where that is wanted.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VENDOR = path.join(ROOT, 'extension', 'lib', 'VENDOR.json');

// Mediabunny's LICENSE ships from the same tarball as the bundle, so checking
// the package once is enough.
function pinnedPackages(manifest) {
    const seen = new Map();
    for (const file of manifest.files || []) {
        if (!file.package || !file.version) continue;
        if (!seen.has(file.package)) seen.set(file.package, { version: file.version, paths: [] });
        seen.get(file.package).paths.push(file.path);
    }
    return seen;
}

function compareVersions(a, b) {
    const parse = (value) => String(value || '').split('.').map((part) => Number.parseInt(part, 10) || 0);
    const left = parse(a);
    const right = parse(b);
    for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
        const l = left[i] || 0;
        const r = right[i] || 0;
        if (l !== r) return l - r;
    }
    return 0;
}

// The vendored line is the pinned major. `latest` on mux.js points at 6.x while
// the project's final release is 7.1.0 under `next`, so following dist-tags
// would report a downgrade. Compare against the newest published version that
// shares the pinned major instead.
function newestInLine(versions, pinned) {
    const major = String(pinned).split('.')[0];
    return versions
        .filter((version) => !/-/.test(version) && version.split('.')[0] === major)
        .sort(compareVersions)
        .pop() || null;
}

// The abbreviated metadata format is small and carries every published
// version, but it omits publish times.
async function registryVersions(name) {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
        headers: { accept: 'application/vnd.npm.install-v1+json' },
    });
    if (!response.ok) throw new Error(`registry responded ${response.status}`);
    return Object.keys((await response.json()).versions || {});
}

// Only fetched when something is actually behind, because the full document is
// large and "how stale am I" is the one case where the date earns its request.
async function publishedAt(name, version) {
    try {
        const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
        if (!response.ok) return null;
        const stamp = (await response.json())?.time?.[version];
        return typeof stamp === 'string' ? stamp.slice(0, 10) : null;
    } catch { return null; }
}

async function main() {
    const manifest = JSON.parse(fs.readFileSync(VENDOR, 'utf8'));
    const packages = pinnedPackages(manifest);
    const behind = [];
    const lines = [];

    for (const [name, { version, paths }] of packages) {
        let latest;
        try {
            latest = newestInLine(await registryVersions(name), version);
        } catch (error) {
            console.log(`[?] ${name}: could not reach the registry (${error.message}). Not treated as a failure.`);
            continue;
        }
        if (!latest) {
            console.log(`[?] ${name}: no published version shares the pinned ${version.split('.')[0]}.x line.`);
            continue;
        }
        if (compareVersions(latest, version) > 0) {
            const stamp = await publishedAt(name, latest);
            behind.push(name);
            lines.push(`[!] ${name} is pinned at ${version}; ${latest} is available${stamp ? ` (published ${stamp})` : ''}. Files: ${paths.join(', ')}`);
        } else {
            lines.push(`[*] ${name} ${version} is current for its ${version.split('.')[0]}.x line.`);
        }
    }

    for (const line of lines) console.log(line);

    if (behind.length) {
        console.log(
            `\nVendor drift: ${behind.join(', ')} behind upstream. Re-vendor from the registry tarball, `
            + 'regenerate the hashes in VENDOR.json and extension/build.sh, then run '
            + '`npm run test:vendor-manifest` and the muxer golden spec.',
        );
        process.exitCode = 1;
        return;
    }
    console.log('\nVendor drift check OK: every pinned media library is current for its line.');
}

main().catch((error) => {
    console.error('[!] vendor drift check failed:', error.message);
    process.exitCode = 1;
});
