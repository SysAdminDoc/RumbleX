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
# mode and will not have further major development") — pin protects us until
# the v3.2 Mediabunny migration lands.
MUX_JS_VERSION="7.0.3"
MUX_JS_URL="https://cdn.jsdelivr.net/npm/mux.js@${MUX_JS_VERSION}/dist/mux.min.js"
MUX_JS_SHA256="79da5742f8985d9362b14a3ca4d705eea726cea6d513d0d019c359bf4eec856b"

verify_mux_sha() {
    local file="$1"
    local actual
    if command -v shasum >/dev/null 2>&1; then
        actual=$(shasum -a 256 "$file" | awk '{print $1}')
    elif command -v sha256sum >/dev/null 2>&1; then
        actual=$(sha256sum "$file" | awk '{print $1}')
    elif command -v certutil >/dev/null 2>&1; then
        # Git-Bash on Windows often only ships certutil for hashes.
        actual=$(certutil -hashfile "$file" SHA256 | sed -n '2p' | tr -d '[:space:]')
    else
        echo "[!] No SHA-256 hasher found (need shasum, sha256sum, or certutil). Refusing to ship unverified mux.js."
        return 1
    fi
    if [ "$actual" = "$MUX_JS_SHA256" ]; then
        return 0
    fi
    echo "[!] mux.js SHA-256 mismatch — refusing to use."
    echo "    expected: $MUX_JS_SHA256"
    echo "    got:      $actual"
    return 1
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

# Generate icons from favicon if no icons exist
if [ ! -f "icons/icon-128x128.png" ]; then
    echo "[*] No icons found. Place icon-16x16.png, icon-32x32.png, icon-48x48.png, icon-128x128.png in icons/"
    echo "    You can use https://rumble.com/favicon.ico as a base."
fi

# Build Chrome ZIP
echo "[*] Building Chrome package..."
rm -f "../RumbleX-chrome.zip"
zip -r "../RumbleX-chrome.zip" \
    manifest.json background.js content.js worker.js \
    lib/ icons/ pages/ _locales/ \
    -x "manifest-firefox.json" -x "build.sh" -x "*.DS_Store"
echo "    Created RumbleX-chrome.zip"

# Build Firefox ZIP (swap manifest)
echo "[*] Building Firefox package..."
rm -f "../RumbleX-firefox.zip"
cp manifest.json manifest-chrome-backup.json
cp manifest-firefox.json manifest.json
zip -r "../RumbleX-firefox.zip" \
    manifest.json background.js content.js worker.js \
    lib/ icons/ pages/ _locales/ \
    -x "manifest-firefox.json" -x "manifest-chrome-backup.json" -x "build.sh" -x "*.DS_Store"
mv manifest-chrome-backup.json manifest.json
echo "    Created RumbleX-firefox.zip"

echo ""
echo "=== Build Complete ==="
echo "Chrome: RumbleX-chrome.zip (load unpacked from extension/ or install zip)"
echo "Firefox: RumbleX-firefox.zip (load as temporary add-on)"
