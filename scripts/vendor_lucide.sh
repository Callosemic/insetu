#!/usr/bin/env bash
set -e

# Resolve absolute paths dynamically based on script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_FILE="$SCRIPT_DIR/../insetu/static/icons.svg"

echo "🚀 Starting Lucide SVG sprite sheet vendorization..."

# Create temporary build workspace
BUILD_DIR=$(mktemp -d)
echo "📁 Created temporary build environment in $BUILD_DIR"
cd "$BUILD_DIR"

echo "📦 Installing lucide-static..."
npm init -y > /dev/null
npm install lucide-static --silent

echo "✍️  Stitching SVG symbols..."
cat << 'EOF' > build_sprite.js
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'node_modules', 'lucide-static', 'icons');
const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.svg'));
let symbols = [];
for (const file of files) {
    const name = path.basename(file, '.svg');
    const content = fs.readFileSync(path.join(iconsDir, file), 'utf8');

    const innerMatch = content.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
    if (innerMatch) {
        // Minify the SVG inner path string
        const cleanPath = innerMatch[1].replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim();
        symbols.push(`  "${name}": \`${cleanPath}\``);
    }
}
// Wrap all collected symbols in a global JS dictionary and expose agnostically
const finalJs = `window.INSETU_ICONS = {\n${symbols.join(',\n')}\n};\nwindow.SutramIcons = window.INSETU_ICONS;`;
fs.writeFileSync('icons.js', finalJs);
EOF

node build_sprite.js
# Move the generated JS dictionary to the strict vendor directory
TARGET_JS="$SCRIPT_DIR/../insetu/static/vendor/lucide/icons.js"
mkdir -p "$(dirname "$TARGET_JS")"
mv icons.js "$TARGET_JS"

# Clean up
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

echo "✅ Success! Dictionary generated at: $TARGET_JS"