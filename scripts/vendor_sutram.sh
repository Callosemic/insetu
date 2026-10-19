#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSETU_STATIC_VENDOR="$(cd "$SCRIPT_DIR/../insetu/static/vendor" && pwd)"
LOCAL_SUTRAM_REPO="${1:-$SCRIPT_DIR/../../sutram}"

CLEANUP_DIR=""
if [ -d "$LOCAL_SUTRAM_REPO/sutram/js" ] && [ -d "$LOCAL_SUTRAM_REPO/yenvui" ]; then
    SUTRAM_ROOT="$(cd "$LOCAL_SUTRAM_REPO" && pwd)"
else
    echo "🌐 Local sibling '../sutram' not found. Fetching latest from GitHub..."
    CLEANUP_DIR=$(mktemp -d)
    git clone --depth 1 https://github.com/Callosemic/sutram.git "$CLEANUP_DIR/sutram" --quiet
    SUTRAM_ROOT="$CLEANUP_DIR/sutram"
fi

trap 'if [ -n "$CLEANUP_DIR" ]; then rm -rf "$CLEANUP_DIR"; fi' EXIT

python3 - "$SUTRAM_ROOT" "$INSETU_STATIC_VENDOR" << 'EOF'
import os
import sys
import shutil
import filecmp
import subprocess
from pathlib import Path

sutram_root = Path(sys.argv[1]).resolve()
vendor_root = Path(sys.argv[2]).resolve()

esbuild_bin = shutil.which("esbuild")

def minify_code(code_str, loader="js"):
    if not esbuild_bin:
        return code_str, False
    cmd = [esbuild_bin, f"--loader={loader}", "--target=es2022", "--minify"]
    res = subprocess.run(cmd, input=code_str, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"❌ esbuild syntax error ({loader}):\n{res.stderr}")
        sys.exit(1)
    return res.stdout, True

build_map = [
    ("sutram/js", "sutram/js"),
    ("yenvui/js", "yenvui/js"),
    ("yenvui/css", "yenvui/css"),
]

print(f"\n{'-'*50}\n🚀 INSETU VENDORIZER: Building Sutram & yenVUI\n{'-'*50}")
if not esbuild_bin:
    print("  └─ ⚠️  'esbuild' not found in PATH; falling back to unminified copy.")

for src_rel, dest_rel in build_map:
    src_path = sutram_root / src_rel
    dest_path = vendor_root / dest_rel
    print(f"\n📦 Mapping: /{src_rel} -> /{dest_rel}")
    if not src_path.exists():
        print(f"  └─ ⚠️  Source directory not found, skipping: {src_rel}")
        continue

    dest_path.mkdir(parents=True, exist_ok=True)
    for item in sorted(src_path.rglob("*")):
        if not item.is_file():
            continue
        rel_path = item.relative_to(src_path)
        target_item = dest_path / rel_path
        target_item.parent.mkdir(parents=True, exist_ok=True)

        if item.suffix in (".js", ".css"):
            loader = "js" if item.suffix == ".js" else "css"
            raw_text = item.read_text(encoding="utf-8")
            out_text, was_minified = minify_code(raw_text, loader=loader)
            if target_item.exists() and target_item.read_text(encoding="utf-8") == out_text:
                print(f"  └─ ⏭️  Skipped    | {rel_path.as_posix()} (No changes)")
                continue
            target_item.write_text(out_text, encoding="utf-8")
            if was_minified:
                saved = (item.stat().st_size - target_item.stat().st_size) / 1024.0
                print(f"  └─ ✅ Minified   | {rel_path.as_posix()} (Saved {saved:.1f} KB)")
            else:
                print(f"  └─ ✅ Synced     | {rel_path.as_posix()}")
        else:
            if target_item.exists() and filecmp.cmp(item, target_item, shallow=False):
                print(f"  └─ ⏭️  Skipped    | {rel_path.as_posix()} (No changes)")
                continue
            shutil.copy2(item, target_item)
            print(f"  └─ ✅ Copied     | {rel_path.as_posix()}")

print("\n🎉 Sutram & yenVUI vendorization complete!\n")
EOF