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
  @codemirror/merge \
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
export * from "@codemirror/merge";
export { basicSetup } from "codemirror";
export { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";
export { markdown } from "@codemirror/lang-markdown";
export { python } from "@codemirror/lang-python";
export { javascript } from "@codemirror/lang-javascript";
export { json } from "@codemirror/lang-json";
export { yaml } from "@codemirror/lang-yaml";
export { html as htmlLang } from "@codemirror/lang-html";
export { css as cssLang } from "@codemirror/lang-css";
EOF
# 6. Bundle core into a single deduplicated ESM file
echo "🔨 Bundling codemirror-core.js..."
npx esbuild entry.js --bundle --minify --format=esm --outfile="$TARGET_DIR/codemirror-core.js"

# 7. Clean up
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

echo "✅ Success! CodeMirror core and all language packs vendorized to: $TARGET_DIR"