#!/usr/bin/env bash
set -e

# Vendors sutram/yenVUI into insetu/static/vendor and records the build in sutram.lock.json.
# Usage: vendor_sutram.sh [path/to/sutram]   (defaults to the sibling ../sutram, else clones from GitHub)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$SCRIPT_DIR/../insetu/static/vendor"
INSETU_STATIC_VENDOR="$(cd "$SCRIPT_DIR/../insetu/static/vendor" && pwd)"
LOCAL_SUTRAM_REPO="${1:-$SCRIPT_DIR/../../sutram}"

CLEANUP_DIR=""
trap 'if [ -n "$CLEANUP_DIR" ]; then rm -rf "$CLEANUP_DIR"; fi' EXIT

if [ -d "$LOCAL_SUTRAM_REPO/sutram/js" ] && [ -d "$LOCAL_SUTRAM_REPO/yenvui" ]; then
    SUTRAM_ROOT="$(cd "$LOCAL_SUTRAM_REPO" && pwd)"
    SOURCE="sibling"
else
    echo "🌐 Local sibling '../sutram' not found. Fetching latest from GitHub..."
    CLEANUP_DIR=$(mktemp -d)
    git clone --depth 1 https://github.com/Callosemic/sutram.git "$CLEANUP_DIR/sutram" --quiet
    SUTRAM_ROOT="$CLEANUP_DIR/sutram"
    SOURCE="clone"
fi

python3 "$SCRIPT_DIR/vendor_lock.py" sync "$SUTRAM_ROOT" "$INSETU_STATIC_VENDOR" "$SOURCE"
