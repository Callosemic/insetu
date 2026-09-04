#!/usr/bin/env bash
set -e

# 1. Resolve absolute paths dynamically based on script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/../insetu/static/vendor/lit"

echo "🚀 Starting Lit vendorization..."

# 2. Ensure target directory exists
mkdir -p "$TARGET_DIR"

# 3. Create temporary build workspace
BUILD_DIR=$(mktemp -d)
echo "📁 Created temporary build environment in $BUILD_DIR"
cd "$BUILD_DIR"

# 4. Install Lit and esbuild
echo "📦 Installing Lit and esbuild..."
npm init -y > /dev/null
npm install lit@3.1.0 esbuild --silent

# 5. Bundle core into a single deduplicated ESM file
echo "🔨 Bundling lit-core.min.js..."
npx esbuild node_modules/lit/index.js \
  --bundle \
  --format=esm \
  --minify \
  --outfile="$TARGET_DIR/lit-core.min.js"

# 6. Clean up
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

echo "✅ Success! Lit bundle localized to: $TARGET_DIR"
