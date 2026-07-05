import os
import re
from pathlib import Path

# Target the static JS directory
JS_DIR = Path(__file__).resolve().parent.parent / "insetu" / "static" / "js"

# Dictionary mapping specific hex codes to our new CSS Intent Variables
# The regex will target these regardless of whether they are uppercase or lowercase
HEX_MAP = {
    r'#(3b82f6|0ea5e9|0284c7|38bdf8|4daafc)': 'var(--intent-primary)',
    r'#10b981': 'var(--intent-success)',
    r'#(ef4444|dc2626)': 'var(--intent-danger)',
    r'#(f59e0b|eab308|facc15)': 'var(--intent-warning)',
    r'#(8b5cf6|a855f7)': 'var(--intent-highlight)',
    r'#64748b': 'var(--intent-neutral)',
    r'#888(888)?': 'var(--text-muted)'
}

def bulk_replace_hex():
    print(f"🧹 Sweeping JS directory for hardcoded HEX tokens: {JS_DIR}")
    files_modified = 0
    total_replacements = 0

    if not JS_DIR.exists():
        print(f"❌ Could not find JS directory at {JS_DIR}")
        return

    for root, _, files in os.walk(JS_DIR):
        for file in files:
            if file.endswith(".js"):
                filepath = Path(root) / file
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                original_content = content
                file_replacements = 0

                for hex_regex, css_var in HEX_MAP.items():
                    # Case-insensitive replacement
                    content, count = re.subn(hex_regex, css_var, content, flags=re.IGNORECASE)
                    file_replacements += count

                if file_replacements > 0:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"  [+] {file}: Replaced {file_replacements} hex tokens.")
                    files_modified += 1
                    total_replacements += file_replacements

    print(f"\n✅ Completed. Replaced {total_replacements} tokens across {files_modified} files.")

if __name__ == "__main__":
    bulk_replace_hex()