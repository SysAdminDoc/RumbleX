#!/usr/bin/env bash
# RumbleX Extension Build Script
# Fetches dependencies and packages for Chrome and Firefox

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== RumbleX Extension Build ==="

# A leftover backup means an earlier build died between swapping the manifest and
# putting it back, so manifest.json may be the MV2 one. Refuse rather than
# silently packaging a Firefox manifest as Chrome.
if [ -f "manifest-chrome-backup.json" ]; then
    echo "[!] Stale manifest-chrome-backup.json found in extension/."
    echo "    A previous build was interrupted while the Firefox manifest was swapped in."
    echo "    Verify manifest.json is the Chrome MV3 manifest, then delete the backup file."
    exit 1
fi

# Fetch mux.js if not present.
# v3.1.0 — SHA-256 pin so a compromised CDN can't silently swap the bundle.
# Bump MUX_JS_SHA256 when intentionally upgrading mux.js. Verify on a clean
# machine: `curl -sL https://cdn.jsdelivr.net/npm/mux.js@7.0.3/dist/mux.min.js \
#   | shasum -a 256` against the pinned value before changing.
# Source: mux.js is in maintenance mode (npm "this module is in maintenance
# mode and will not have further major development"). v3.27 adds an opt-in
# Mediabunny path, but mux.js remains the default fallback until proven stable.
MUX_JS_VERSION="7.0.3"
MUX_JS_URL="https://cdn.jsdelivr.net/npm/mux.js@${MUX_JS_VERSION}/dist/mux.min.js"
MUX_JS_SHA256="79da5742f8985d9362b14a3ca4d705eea726cea6d513d0d019c359bf4eec856b"
MEDIABUNNY_VERSION="1.55.1"
MEDIABUNNY_JS_SHA256="953110266df5e5ea4d3c339ffe24a70f795643be07ee8375093897534bad1346"
MEDIABUNNY_LICENSE_SHA256="3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04"
CHROME_ZIP="../RumbleX-chrome.zip"
FIREFOX_ZIP="../RumbleX-firefox.zip"
USERSCRIPT="../RumbleX.user.js"
USERSCRIPT_LITE="../RumbleX.lite.user.js"
CHECKSUMS_FILE="../SHA256SUMS.txt"
SIGNATURE_FILE="../SHA256SUMS.txt.sig"
ALLOWED_SIGNERS_FILE="../allowed_signers"
FIREFOX_XPI="../RumbleX-firefox.xpi"
SOURCE_BUNDLE="../RumbleX-source.zip"

file_sha256() {
    local file="$1"
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | awk '{print $1}' | tr '[:upper:]' '[:lower:]'
    elif command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file" | awk '{print $1}' | tr '[:upper:]' '[:lower:]'
    elif command -v certutil >/dev/null 2>&1; then
        # Git-Bash on Windows often only ships certutil for hashes.
        certutil -hashfile "$file" SHA256 | sed -n '2p' | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]'
    else
        echo "[!] No SHA-256 hasher found (need shasum, sha256sum, or certutil). Refusing to ship unverified media libraries."
        return 1
    fi
}

verify_sha() {
    local file="$1"
    local expected="$2"
    local label="$3"
    local actual
    actual=$(file_sha256 "$file") || return 1
    if [ "$actual" = "$expected" ]; then
        return 0
    fi
    echo "[!] ${label} SHA-256 mismatch — refusing to use."
    echo "    expected: $expected"
    echo "    got:      $actual"
    return 1
}

verify_mux_sha() {
    verify_sha "$1" "$MUX_JS_SHA256" "mux.js"
}

verify_mediabunny_sha() {
    verify_sha "lib/mediabunny.min.mjs" "$MEDIABUNNY_JS_SHA256" "Mediabunny v${MEDIABUNNY_VERSION} bundle" \
        && verify_sha "lib/mediabunny.LICENSE" "$MEDIABUNNY_LICENSE_SHA256" "Mediabunny v${MEDIABUNNY_VERSION} license"
}

if [ ! -f "lib/mux.min.js" ]; then
    echo "[*] Downloading mux.js v${MUX_JS_VERSION}..."
    curl -sL "$MUX_JS_URL" -o "lib/mux.min.js"
    if ! verify_mux_sha "lib/mux.min.js"; then
        rm -f "lib/mux.min.js"
        exit 1
    fi
    echo "    Done. SHA-256 verified."
else
    if verify_mux_sha "lib/mux.min.js"; then
        echo "[*] mux.js already present. SHA-256 verified."
    else
        echo "[!] Existing lib/mux.min.js failed verification. Delete it and re-run to refetch."
        exit 1
    fi
fi

if [ ! -f "lib/mediabunny.min.mjs" ] || [ ! -f "lib/mediabunny.LICENSE" ]; then
    echo "[!] Mediabunny v${MEDIABUNNY_VERSION} bundle/license missing from extension/lib."
    echo "    Restore lib/mediabunny.min.mjs and lib/mediabunny.LICENSE before building."
    exit 1
fi
if verify_mediabunny_sha; then
    echo "[*] Mediabunny v${MEDIABUNNY_VERSION} bundle and license verified."
else
    exit 1
fi

# Files and directories that make up a packaged extension. Declared once so a
# new runtime file cannot ship in one archiver branch and be silently missing
# from another — the previous version repeated the list in all three branches
# and only one substring of it was guarded.
PACK_FILES="browser-polyfill.js settings-schema.js ad-blocker.js archive-fs.js background.js platform.js core-routing.js core-selectors.js core-video-cards.js core-media.js content.js worker.js mediabunny-worker.js offscreen.html offscreen.js"
PACK_DIRS="lib icons pages rules _locales"

# Stage a package in a temp directory, then archive from there.
#
# Firefox packaging used to copy manifest-firefox.json over manifest.json in the
# working tree and rely on an EXIT trap to put it back. A kill or a power loss
# between those two copies left the MV2 manifest sitting at extension/manifest.json
# and the next Chrome build would package MV2 as Chrome. Staging never touches
# the working tree, so an interrupted build cannot poison the next one.
pack_extension() {
    local dest="$1"
    local manifest_src="$2"
    local stage
    local item
    local abs_dest
    local rc=0

    stage="$(mktemp -d)" || return 1
    abs_dest="$(cd "$(dirname "$dest")" && pwd)/$(basename "$dest")"

    {
        cp "$manifest_src" "$stage/manifest.json" || exit 1
        for item in $PACK_FILES; do
            cp "$item" "$stage/$item" || exit 1
        done
        for item in $PACK_DIRS; do
            cp -R "$item" "$stage/$item" || exit 1
        done
    } || rc=1

    if [ "$rc" -eq 0 ]; then
        (
            cd "$stage" || exit 1
            find . -name '.DS_Store' -delete 2>/dev/null || true
            if command -v zip >/dev/null 2>&1; then
                zip -r -q "$abs_dest" manifest.json $PACK_FILES $PACK_DIRS
            elif [ -x "/c/Windows/System32/tar.exe" ]; then
                "/c/Windows/System32/tar.exe" -a -c -f "$abs_dest" manifest.json $PACK_FILES $PACK_DIRS
            elif command -v bsdtar >/dev/null 2>&1; then
                bsdtar -a -c -f "$abs_dest" manifest.json $PACK_FILES $PACK_DIRS
            else
                echo "[!] Need zip, Windows bsdtar, or bsdtar to build packages."
                exit 1
            fi
        ) || rc=1
    fi

    rm -rf "$stage"
    return "$rc"
}

write_release_checksums() {
    local pkg
    rm -f "$CHECKSUMS_FILE"
    for pkg in "$CHROME_ZIP" "$FIREFOX_ZIP" "$FIREFOX_XPI" "$USERSCRIPT" "$USERSCRIPT_LITE"; do
        if [ ! -f "$pkg" ]; then
            echo "[!] Missing package for checksum: $pkg"
            return 1
        fi
        printf '%s  %s\n' "$(file_sha256 "$pkg")" "$(basename "$pkg")" >> "$CHECKSUMS_FILE"
    done
    echo "[*] Wrote SHA256SUMS.txt"
}

verify_release_checksums() {
    local expected
    local name
    local actual
    while read -r expected name; do
        [ -n "$expected" ] || continue
        actual=$(file_sha256 "../$name") || return 1
        if [ "$actual" != "$expected" ]; then
            echo "[!] Release package checksum mismatch for $name"
            echo "    expected: $expected"
            echo "    got:      $actual"
            return 1
        fi
    done < "$CHECKSUMS_FILE"
    echo "[*] Release package checksums verified."
}

# AMO signs an .xpi, which is just the MV2 package under a different extension.
# Producing it here means the submission artifact is built by the same staged
# path as everything else rather than renamed by hand at release time.
build_firefox_xpi() {
    rm -f "$FIREFOX_XPI"
    cp "$FIREFOX_ZIP" "$FIREFOX_XPI" || return 1
    echo "[*] Wrote RumbleX-firefox.xpi (AMO submission / signing input)"
}

# AMO review requires the source for anything minified in the package, plus the
# steps to reproduce it. extension/lib/ ships two vendored minified libraries,
# so a submission without this bundle stalls in human review.
build_source_bundle() {
    local stage
    local abs_dest
    local rc=0

    rm -f "$SOURCE_BUNDLE"
    stage="$(mktemp -d)" || return 1
    abs_dest="$(cd "$(dirname "$SOURCE_BUNDLE")" && pwd)/$(basename "$SOURCE_BUNDLE")"

    {
        mkdir -p "$stage/extension" "$stage/scripts" || exit 1
        cp -R . "$stage/extension/" || exit 1
        rm -rf "$stage/extension/_metadata" || true
        cp ../scripts/build-userscript.js "$stage/scripts/" || exit 1
        cp ../package.json "$stage/" || exit 1
        cp ../LICENSE "$stage/" || exit 1
        cp ../README.md "$stage/" || exit 1
    } || rc=1

    if [ "$rc" -eq 0 ]; then
        (
            cd "$stage" || exit 1
            find . -name '.DS_Store' -delete 2>/dev/null || true
            # Name the roots explicitly. Archiving "." prefixes every entry with
            # "./", which buries the layout a reviewer is meant to read.
            local roots="extension scripts package.json LICENSE README.md"
            if command -v zip >/dev/null 2>&1; then
                zip -r -q "$abs_dest" $roots
            elif [ -x "/c/Windows/System32/tar.exe" ]; then
                "/c/Windows/System32/tar.exe" -a -c -f "$abs_dest" $roots
            elif command -v bsdtar >/dev/null 2>&1; then
                bsdtar -a -c -f "$abs_dest" $roots
            else
                echo "[!] Need zip, Windows bsdtar, or bsdtar to build the source bundle."
                exit 1
            fi
        ) || rc=1
    fi

    rm -rf "$stage"
    [ "$rc" -eq 0 ] && echo "[*] Wrote RumbleX-source.zip (AMO source-code requirement)"
    return "$rc"
}

# SHA256SUMS.txt proves the packages were not altered in transit; it does not
# prove who built them. An SSH signature over that file binds it to a published
# key, which is what defends against a lookalike repo serving its own ZIPs.
#
# Set RUMBLEX_SIGNING_KEY to the path of the release signing key to sign. The
# matching public key must be published in ./allowed_signers so a user can run
#   ssh-keygen -Y verify -f allowed_signers -I <identity> -n file \
#     -s SHA256SUMS.txt.sig < SHA256SUMS.txt
# Unsigned builds are allowed (development, local testing) and say so; a signing
# key that produces an unverifiable signature fails the build.
sign_release_checksums() {
    rm -f "$SIGNATURE_FILE"

    if [ -z "${RUMBLEX_SIGNING_KEY:-}" ]; then
        echo "[*] RUMBLEX_SIGNING_KEY not set — SHA256SUMS.txt is unsigned."
        echo "    Release builds should set it so users can verify provenance."
        return 0
    fi

    if [ ! -f "$RUMBLEX_SIGNING_KEY" ]; then
        echo "[!] RUMBLEX_SIGNING_KEY points at a missing file: $RUMBLEX_SIGNING_KEY"
        return 1
    fi

    if ! command -v ssh-keygen >/dev/null 2>&1; then
        echo "[!] ssh-keygen not found; cannot sign SHA256SUMS.txt."
        return 1
    fi

    if ! ssh-keygen -Y sign -f "$RUMBLEX_SIGNING_KEY" -n file "$CHECKSUMS_FILE" >/dev/null 2>&1; then
        echo "[!] Failed to sign SHA256SUMS.txt with $RUMBLEX_SIGNING_KEY"
        return 1
    fi
    echo "[*] Signed SHA256SUMS.txt -> SHA256SUMS.txt.sig"

    if [ ! -f "$ALLOWED_SIGNERS_FILE" ]; then
        echo "[!] No allowed_signers file — the signature cannot be verified against a"
        echo "    published identity. Publish the release public key before shipping."
        return 1
    fi

    local signer
    signer=$(awk 'NF && $1 !~ /^#/ { print $1; exit }' "$ALLOWED_SIGNERS_FILE")
    if [ -z "$signer" ]; then
        echo "[!] allowed_signers has no usable identity line."
        return 1
    fi

    if ! ssh-keygen -Y verify -f "$ALLOWED_SIGNERS_FILE" -I "$signer" -n file \
        -s "$SIGNATURE_FILE" < "$CHECKSUMS_FILE" >/dev/null 2>&1; then
        echo "[!] Signature over SHA256SUMS.txt does not verify against allowed_signers."
        echo "    The signing key and the published identity disagree — refusing to ship."
        return 1
    fi
    echo "[*] Signature verified against allowed_signers ($signer)."
}

# Generate icons from favicon if no icons exist
if [ ! -f "icons/icon-128x128.png" ]; then
    echo "[*] No icons found. Place icon-16x16.png, icon-32x32.png, icon-48x48.png, icon-128x128.png in icons/"
    echo "    You can use https://rumble.com/favicon.ico as a base."
fi

# Build Chrome ZIP
echo "[*] Generating userscript from the shared content core..."
node ../scripts/build-userscript.js

echo "[*] Building Chrome package..."
rm -f "$CHROME_ZIP"
pack_extension "$CHROME_ZIP" "manifest.json"
echo "    Created RumbleX-chrome.zip"

# Build Firefox ZIP (swap manifest)
echo "[*] Building Firefox package..."
rm -f "$FIREFOX_ZIP"
pack_extension "$FIREFOX_ZIP" "manifest-firefox.json"
echo "    Created RumbleX-firefox.zip"

build_firefox_xpi
build_source_bundle

write_release_checksums
verify_release_checksums
sign_release_checksums

echo "[*] Validating the Firefox update manifest..."
node ../scripts/build-update-manifest.js --check

echo ""
echo "=== Build Complete ==="
echo "Chrome: RumbleX-chrome.zip (load unpacked from extension/ or install zip)"
echo "Firefox: RumbleX-firefox.zip (load as temporary add-on)"
echo "Userscript: RumbleX.user.js (Tampermonkey / Violentmonkey)"
