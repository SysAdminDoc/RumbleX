#!/usr/bin/env bash
# RumbleX Extension Build Script
# Fetches dependencies and packages for Chrome and Firefox

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== RumbleX Extension Build ==="

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
MEDIABUNNY_VERSION="1.46.0"
MEDIABUNNY_JS_SHA256="e7514bbc13b132f954e31a3fad423ddaa6926a6ae95749190d7c1caa31225b8e"
MEDIABUNNY_LICENSE_SHA256="3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04"

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

pack_extension() {
    local dest="$1"
    if command -v zip >/dev/null 2>&1; then
        zip -r "$dest" \
            manifest.json background.js content.js worker.js offscreen.html offscreen.js \
            lib/ icons/ pages/ _locales/ \
            -x "manifest-firefox.json" -x "manifest-chrome-backup.json" -x "build.sh" -x "*.DS_Store"
    elif command -v powershell.exe >/dev/null 2>&1; then
        powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "\
\$ErrorActionPreference = 'Stop'; \
\$paths = @('manifest.json','background.js','content.js','worker.js','offscreen.html','offscreen.js','lib','icons','pages','_locales'); \
Compress-Archive -Path \$paths -DestinationPath '$dest' -Force"
    else
        echo "[!] Need zip or powershell.exe Compress-Archive to build packages."
        return 1
    fi
}

# Generate icons from favicon if no icons exist
if [ ! -f "icons/icon-128x128.png" ]; then
    echo "[*] No icons found. Place icon-16x16.png, icon-32x32.png, icon-48x48.png, icon-128x128.png in icons/"
    echo "    You can use https://rumble.com/favicon.ico as a base."
fi

# Build Chrome ZIP
echo "[*] Building Chrome package..."
rm -f "../RumbleX-chrome.zip"
pack_extension "../RumbleX-chrome.zip"
echo "    Created RumbleX-chrome.zip"

# Build Firefox ZIP (swap manifest)
echo "[*] Building Firefox package..."
rm -f "../RumbleX-firefox.zip"
cp manifest.json manifest-chrome-backup.json
cp manifest-firefox.json manifest.json
pack_extension "../RumbleX-firefox.zip"
mv manifest-chrome-backup.json manifest.json
echo "    Created RumbleX-firefox.zip"

echo ""
echo "=== Build Complete ==="
echo "Chrome: RumbleX-chrome.zip (load unpacked from extension/ or install zip)"
echo "Firefox: RumbleX-firefox.zip (load as temporary add-on)"
