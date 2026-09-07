#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/../insetu/static/vendor/js-yaml"

mkdir -p "$TARGET_DIR"
BUILD_DIR=$(mktemp -d)
cd "$BUILD_DIR"

npm init -y > /dev/null
npm install js-yaml@4.1.0 esbuild --silent

npx esbuild node_modules/js-yaml/dist/js-yaml.mjs \
  --bundle \
  --format=esm \
  --minify \
  --outfile="$TARGET_DIR/js-yaml.min.js"

cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"