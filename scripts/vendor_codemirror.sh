#!/usr/bin/env bash
set -e

# 1. Resolve absolute paths dynamically based on script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$SCRIPT_DIR/../insetu/static/vendor/codemirror"

echo "🚀 Starting CodeMirror core & language packs vendorization..."

# 2. Ensure target directory exists
mkdir -p "$TARGET_DIR"

# 3. Create temporary build workspace
BUILD_DIR=$(mktemp -d)
echo "📁 Created temporary build environment in $BUILD_DIR"
cd "$BUILD_DIR"

# 4. Install CodeMirror core, utilities, language packages, and esbuild
echo "📦 Installing CodeMirror dependencies and esbuild..."
npm init -y > /dev/null
npm install \
  codemirror \
  @codemirror/state \
  @codemirror/view \
  @codemirror/theme-one-dark \
  @codemirror/language \
  @codemirror/autocomplete \
  @codemirror/commands \
  @codemirror/lint \
  @codemirror/lang-markdown \
  @codemirror/lang-python \
  @codemirror/lang-javascript \
  @codemirror/lang-json \
  @codemirror/lang-yaml \
  @codemirror/lang-html \
  @codemirror/lang-css \
  esbuild --silent

# 5. Create entry point re-exporting the full core API & utilities
echo "✍️  Generating ESM entry bridge for core..."
cat << 'EOF' > entry.js
export * from "@codemirror/state";
export * from "@codemirror/view";
export * from "@codemirror/language";
export * from "@codemirror/autocomplete";
export * from "@codemirror/commands";
export * from "@codemirror/lint";
export { basicSetup } from "codemirror";
export { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
EOF

# 6. Bundle core into a single deduplicated ESM file
echo "🔨 Bundling codemirror-core.js..."
npx esbuild entry.js --bundle --format=esm --outfile="$TARGET_DIR/codemirror-core.js"

# 7. Bundle each language pack into a standalone ESM module
LANGUAGES=("markdown" "python" "javascript" "json" "yaml" "html" "css")

for LANG in "${LANGUAGES[@]}"; do
    echo "🔨 Bundling lang-${LANG}.js..."
    npx esbuild "node_modules/@codemirror/lang-${LANG}/dist/index.js" \
        --bundle \
        --format=esm \
        --external:@codemirror/* \
        --external:codemirror \
        --outfile="$TARGET_DIR/lang-${LANG}.js"
done

# 8. Clean up
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

echo "✅ Success! CodeMirror core and all language packs vendorized to: $TARGET_DIR"