import os
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
TARGET_DIRS = [PROJECT_ROOT / "insetu"]
def fix_missing_imports():
    print("🩹 Repairing missing global pathlib imports...")
    for target_dir in TARGET_DIRS:
        if not target_dir.exists(): continue
        for root, _, files in os.walk(target_dir):
            for file in files:
                if file.endswith(".py") and file != "bulk_pathlib_fixer.py":
                    filepath = Path(root) / file
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # If Path( is used, ensure it has a top-level import (checking first 15 lines)
                    lines = content.split('\n')
                    has_global_import = any(l.startswith('from pathlib import Path') for l in lines[:15])

                    if 'Path(' in content and not has_global_import:
                        # Strip out local scope imports to avoid messy duplication
                        clean_content = content.replace("    from pathlib import Path\n", "").replace("        from pathlib import Path\n", "")
                        # Also strip it if it got stuck mid-file somehow
                        clean_content = clean_content.replace("from pathlib import Path\n", "")

                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write("from pathlib import Path\n" + clean_content)
                        print(f"  [+] {file}: Injected missing global pathlib import.")

def bulk_strip_slash_hacks():
    fix_missing_imports()
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

                    # Programmatic regex to catch basic os.path.join patterns (2 and 3 arguments)
                    join_2_pattern = re.compile(r'os\.path\.join\(([^,()]+?)\s*,\s*([^()]+?)\)')
                    content, join_2_count = join_2_pattern.subn(r'Path(\1).joinpath(\2).as_posix()', content)

                    join_3_pattern = re.compile(r'os\.path\.join\(([^,()]+?)\s*,\s*([^,()]+?)\s*,\s*([^()]+?)\)')
                    content, join_3_count = join_3_pattern.subn(r'Path(\1).joinpath(\2, \3).as_posix()', content)

                    total_file_replacements = count + join_2_count + join_3_count

                    if total_file_replacements > 0:
                        if 'from pathlib import Path' not in content:
                            content = "from pathlib import Path\n" + content

                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        print(f"  [+] {file}: Fixed {total_file_replacements} pathlib/slash violations.")
                        files_modified += 1
                        total_replacements += total_file_replacements

    print(f"\\n✅ Completed. Stripped {total_replacements} hacks across {files_modified} files.")

if __name__ == "__main__":
    bulk_strip_slash_hacks()