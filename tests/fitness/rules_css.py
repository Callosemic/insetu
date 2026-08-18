import os
import re
from pathlib import Path
from .core import BACKEND_DIR, report_violation, collect_unique_files

def check_css_files():
    print("🔍 Sweeping CSS Stylesheets (Regex Analysis)...")
    important_pattern = re.compile(r'!important\b')

    for filepath in collect_unique_files([BACKEND_DIR / "static", BACKEND_DIR / "extensions"], [".css"]):
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()

        for i, line in enumerate(lines):
            line_num = i + 1

            # Skip commented lines
            if line.strip().startswith("/*") or line.strip().startswith("*"):
                continue

            if important_pattern.search(line):
                # Whitelist standard OS-level utility classes and base property resets
                if "display: none" in line or "-webkit-tap-highlight-color" in line or "overflow: hidden" in line:
                    continue

                report_violation(
                    "STRICT_CSS_SPECIFICITY_MANDATE", 
                    filepath, 
                    line_num, 
                    "The '!important' flag is banned outside of explicit OS-level utility classes. Use CSS custom properties and shadow DOM encapsulation instead."
                )