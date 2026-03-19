#!/usr/bin/env bash
# RumbleX Extension Build Script
# Fetches dependencies and packages for Chrome and Firefox

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== RumbleX Extension Build ==="

# Fetch mux.js if not present
if [ ! -f "lib/mux.min.js" ]; then
    echo "[*] Downloading mux.js v7.0.3..."
    curl -sL "https://cdn.jsdelivr.net/npm/mux.js@7.0.3/dist/mux.min.js" -o "lib/mux.min.js"
    echo "    Done."
else
    echo "[*] mux.js already present."
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
    lib/ icons/ pages/ \
    -x "manifest-firefox.json" -x "build.sh" -x "*.DS_Store"
echo "    Created RumbleX-chrome.zip"

# Build Firefox ZIP (swap manifest)
echo "[*] Building Firefox package..."
rm -f "../RumbleX-firefox.zip"
cp manifest.json manifest-chrome-backup.json
cp manifest-firefox.json manifest.json
zip -r "../RumbleX-firefox.zip" \
    manifest.json background.js content.js worker.js \
    lib/ icons/ pages/ \
    -x "manifest-firefox.json" -x "manifest-chrome-backup.json" -x "build.sh" -x "*.DS_Store"
mv manifest-chrome-backup.json manifest.json
echo "    Created RumbleX-firefox.zip"

echo ""
echo "=== Build Complete ==="
echo "Chrome: RumbleX-chrome.zip (load unpacked from extension/ or install zip)"
echo "Firefox: RumbleX-firefox.zip (load as temporary add-on)"
