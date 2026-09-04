#!/usr/bin/env bash
set -e

# 1. Resolve absolute paths dynamically based on script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/../insetu/static/vendor/zustand"

echo "🚀 Starting Zustand vendorization..."

# 2. Ensure target directory exists
mkdir -p "$TARGET_DIR"

# 3. Create temporary build workspace
BUILD_DIR=$(mktemp -d)
echo "📁 Created temporary build environment in $BUILD_DIR"
cd "$BUILD_DIR"

# 4. Install Zustand and esbuild
echo "📦 Installing Zustand and esbuild..."
npm init -y > /dev/null
npm install zustand@4.5.2 esbuild --silent

# 5. Bundle vanilla and middleware modules into standalone ESM files
echo "🔨 Bundling vanilla.js..."
npx esbuild node_modules/zustand/vanilla.js --bundle --format=esm --outfile="$TARGET_DIR/vanilla.js"

echo "🔨 Bundling middleware.js..."
npx esbuild node_modules/zustand/middleware.js --bundle --format=esm --outfile="$TARGET_DIR/middleware.js"

# 6. Clean up
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

echo "✅ Success! Zustand vanilla and middleware bundles localized to: $TARGET_DIR"
