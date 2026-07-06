import os
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TARGET_DIRS = [PROJECT_ROOT / "insetu"]

def bulk_strip_slash_hacks():
    print("🧹 Sweeping Python codebase to eradicate legacy slash replacements...")
    files_modified = 0
    total_replacements = 0

    slash_pattern = re.compile(r'\.replace\([\'"]\\\\[\'"]\s*,\s*[\'"]/[\'"]\)')

    for target_dir in TARGET_DIRS:
        if not target_dir.exists():
            continue
            
        for root, _, files in os.walk(target_dir):
            for file in files:
                if file.endswith(".py") and file != "bulk_pathlib_fixer.py":
                    filepath = Path(root) / file
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    content, count = slash_pattern.subn('', content)

                    if count > 0:
                        if 'from pathlib import Path' not in content:
                            content = "from pathlib import Path\n" + content
                            
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"  [+] {file}: Stripped {count} manual slash replacements.")
                        files_modified += 1
                        total_replacements += count

    print(f"\\n✅ Completed. Stripped {total_replacements} hacks across {files_modified} files.")

if __name__ == "__main__":
    bulk_strip_slash_hacks()