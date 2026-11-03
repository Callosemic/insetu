#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CM_BUILD_DIR="$SCRIPT_DIR/codemirror"
TARGET_DIR="$SCRIPT_DIR/../insetu/static/vendor/codemirror"

echo "🚀 Building CodeMirror core & code-split language packs..."
cd "$CM_BUILD_DIR"

# Bring package-lock.json in line with package.json (creating it on first run). When they already
# agree this changes nothing; after a pin changes it re-resolves, so npm ci below never sees a mismatch.
echo "📌 Syncing package-lock.json with package.json..."
npm install --package-lock-only --ignore-scripts --no-audit --no-fund

echo "📦 Running npm ci in scripts/codemirror/..."
npm ci --ignore-scripts --no-audit --no-fund

# Every file in the vendor folder is build output, so start empty: nothing stale can survive into the lock.
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

echo "🔨 Running scripts/codemirror/build.mjs..."
node "$CM_BUILD_DIR/build.mjs"

python3 "$SCRIPT_DIR/vendor_lock.py" sync codemirror "$CM_BUILD_DIR/package-lock.json" "$TARGET_DIR"

echo "✅ CodeMirror core, language packs, licenses, and lockfile written to: $TARGET_DIR"