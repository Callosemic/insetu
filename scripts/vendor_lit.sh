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
# 4. Install Lit, Virtualizer, and esbuild
echo "📦 Installing Lit, Virtualizer, and esbuild..."
npm init -y > /dev/null
npm install lit@3.1.0 @lit-labs/virtualizer esbuild --silent

# 5. Bundle core into a single deduplicated ESM file (including decorators & directives)
echo "🔨 Bundling lit-core.min.js..."
cat << 'EOF' > lit-entry.js
export * from 'lit';
export * from 'lit/decorators.js';
export * from 'lit/directives/repeat.js';
export * from 'lit/directives/style-map.js';
export * from 'lit/directives/class-map.js';
export * from 'lit/directives/unsafe-html.js';
export * from 'lit/directives/ref.js';
export * from 'lit/directives/live.js';
EOF

npx esbuild lit-entry.js \
  --bundle \
  --format=esm \
  --minify \
  --outfile="$TARGET_DIR/lit-core.min.js"
echo "🔨 Bundling lit-virtualizer.min.js..."
cat << 'EOF' > build-virtualizer.mjs
import * as esbuild from 'esbuild';

const litSingletonPlugin = {
  name: 'lit-singleton',
  setup(build) {
    const externalPackages = new Set([
      'lit',
      'lit-html',
      'lit-element',
      '@lit/reactive-element',
      'lit/decorators.js',
      'lit/decorators/property.js',
      'lit/decorators/state.js',
      'lit/decorators/custom-element.js',
      'lit/decorators/query.js',
      'lit/directives/repeat.js',
      'lit/directives/style-map.js',
      'lit/directives/class-map.js',
      'lit/directives/unsafe-html.js',
      'lit/directives/ref.js',
      'lit/directives/live.js'
    ]);
    build.onResolve({ filter: /^(@lit\/reactive-element|lit)/ }, (args) => {
      if (externalPackages.has(args.path)) {
        return { path: 'lit', external: true };
      }
      return null;
    });
  }
};

await esbuild.build({
  stdin: {
    contents: `
      export * from '@lit-labs/virtualizer';
      export * from '@lit-labs/virtualizer/virtualize.js';
    `,
    resolveDir: process.cwd(),
    loader: 'js'
  },
  bundle: true,
  format: 'esm',
  minify: true,
  plugins: [litSingletonPlugin],
  outfile: process.argv[2]
});
EOF

node build-virtualizer.mjs "$TARGET_DIR/lit-virtualizer.min.js"

# 6. Clean up
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

echo "✅ Success! Lit bundle localized to: $TARGET_DIR"
