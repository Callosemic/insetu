import os
import re
import ast
import sys
from pathlib import Path

# --- CONFIGURATION ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = PROJECT_ROOT / "insetu"
FRONTEND_DIR = BACKEND_DIR / "static" / "js"
# Whitelists for legitimate use-cases to prevent false positives
VFS_WRITE_WHITELIST = ["routes_fs.py", "fallback_bridge.py", "utils_core.py", "engine_format.py", "engine_git.py", "engine_gather.py", "cli.py", "workers.py", "engine_tracker.py", "engine_research.py"]
SQLITE_WHITELIST = ["db.py", "workers.py"] # Workers needs it for direct ledger management
SUBPROCESS_WHITELIST = ["engine_git.py", "engine_format.py", "cartographer.py", "cli.py", "engine_bridge.py", "utils_core.py"]
HEX_COLOR_WHITELIST = ["style.css"] # Only CSS should define hex codes

violations_found = 0

def report_violation(rule_name, filepath, line_num, message):
    global violations_found
    violations_found += 1
    print(f"❌ [VIOLATION: {rule_name}] {filepath}:{line_num}")
    print(f"   ↳ {message}\n")

# --- PYTHON AST LINTER ---
class BackendFitnessVisitor(ast.NodeVisitor):
    def __init__(self, filepath, filename):
        self.filepath = filepath
        self.filename = filename

    def visit_Call(self, node):
        # 1. VFS Write-Path Ban: Prevent native open(..., 'w') outside of the VFS pipeline
        if isinstance(node.func, ast.Name) and node.func.id == 'open':
            if self.filename not in VFS_WRITE_WHITELIST:
                # Check positional args for write modes
                if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant) and 'w' in node.args[1].value:
                    report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Native file write detected. Route through execute_vfs_save instead.")
                # Check keyword args
                for kw in node.keywords:
                    if kw.arg == 'mode' and isinstance(kw.value, ast.Constant) and 'w' in kw.value.value:
                        report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Native file write detected. Route through execute_vfs_save instead.")
        # 2. I/O Block Ban: Prevent subprocess.run inside routes
        if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
            if node.func.value.id == 'subprocess' and node.func.attr in ('run', 'Popen', 'call'):
                if self.filename.startswith("routes_"):
                    report_violation("IO_BLOCK_BAN", self.filepath, node.lineno, "Synchronous subprocess execution in a REST route. Offload to background workers.")
                elif self.filename not in SUBPROCESS_WHITELIST:
                    report_violation("IO_BLOCK_BAN", self.filepath, node.lineno, f"Subprocess call outside of designated engines.")

            # VFS Async Deletion/Move Guardrail
            if node.func.value.id == 'os' and node.func.attr in ('remove', 'rmdir'):
                if self.filename not in VFS_WRITE_WHITELIST:
                    report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Synchronous os.remove/rmdir detected. Route through the async VFS queue.")
            if node.func.value.id == 'shutil' and node.func.attr in ('move', 'rmtree'):
                if self.filename not in VFS_WRITE_WHITELIST:
                    report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Synchronous shutil.move/rmtree detected. Route through the async VFS queue.")

        # Pathlib Migration Mandate (os.path.join)
        if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Attribute):
            if getattr(node.func.value.value, 'id', '') == 'os' and node.func.value.attr == 'path' and node.func.attr == 'join':
                report_violation("PATHLIB_MANDATE", self.filepath, node.lineno, "os.path.join detected. Migrate to pathlib.Path.")

        self.generic_visit(node)

    def visit_Import(self, node):
        self._check_sqlite_import(node)
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        self._check_sqlite_import(node)
        self.generic_visit(node)

    def _check_sqlite_import(self, node):
        # 3. Connection Mandate: Prevent rogue sqlite3 imports
        if self.filename not in SQLITE_WHITELIST:
            module_name = getattr(node, 'module', None)
            names = [alias.name for alias in node.names]
            if module_name == 'sqlite3' or 'sqlite3' in names:
                report_violation("DB_CONNECTION_BAN", self.filepath, node.lineno, "Direct sqlite3 import detected. Use 'from insetu.db import get_connection'.")

def check_python_files():
    print("🔍 Sweeping Python Backend (AST Analysis)...")
    for root, _, files in os.walk(BACKEND_DIR):
        for file in files:
            if file.endswith(".py"):
                filepath = Path(root) / file
                
                # Skip virtual environments or cache
                if "venv" in str(filepath) or "__pycache__" in str(filepath):
                    continue

                with open(filepath, "r", encoding="utf-8") as f:
                    try:
                        tree = ast.parse(f.read(), filename=str(filepath))
                        visitor = BackendFitnessVisitor(filepath, file)
                        visitor.visit(tree)
                        
                        # 4. Extension DAG Compliance
                        if file.startswith("engine_"):
                            has_depends = any(
                                isinstance(n, ast.Assign) and 
                                any(isinstance(t, ast.Name) and t.id == '__depends__' for t in n.targets) 
                                for n in tree.body
                            )
                            if not has_depends:
                                report_violation("EXTENSION_DAG", filepath, 1, f"Missing '__depends__ = []' declaration in extension engine.")
                    except SyntaxError:
                        print(f"⚠️  Skipping {file} due to SyntaxError.")

# --- JAVASCRIPT REGEX LINTER ---
def check_javascript_files():
    print("🔍 Sweeping JavaScript Frontend (Regex Analysis)...")
    
    # Pre-compile Regex Patterns
    dom_read_pattern = re.compile(r'document\.getElementById\([^\)]+\)\.(value|checked|classList)')
    interval_pattern = re.compile(r'\bsetInterval\s*\(')
    hardcoded_modal_pattern = re.compile(r'class=["\'][^"\']*fullscreen-modal[^"\']*["\']|class=["\'][^"\']*modal-panel[^"\']*["\']')
    hex_color_pattern = re.compile(r'#[0-9a-fA-F]{3,6}\b')
    clear_timeout_pattern = re.compile(r'\bclearTimeout\s*\(')

    # New Rules
    dom_annihilation_pattern = re.compile(r'\.innerHTML\s*=\s*[\'"][\'"]')
    floating_global_pattern = re.compile(r'^let\s+[a-zA-Z0-9_]+\s*=')
    naive_xss_pattern = re.compile(r'\.replace\(/<script')

    for root, _, files in os.walk(FRONTEND_DIR):
        for file in files:
            if file.endswith(".js"):
                filepath = Path(root) / file
                is_extension = file.startswith("ext_")

                with open(filepath, "r", encoding="utf-8") as f:
                    lines = f.readlines()

                for i, line in enumerate(lines):
                    line_num = i + 1
                    
                    # Ignore comments
                    if line.strip().startswith("//"):
                        continue

                    # 1. DOM Read Ban (UDF Enforcement)
                    if is_extension or file in ["kanban.js", "bridge.js"]:
                        if dom_read_pattern.search(line):
                            report_violation("DOM_READ_BAN", filepath, line_num, "Direct DOM reading detected. Read from the Zustand Store instead.")

                    # 2. Metronome Mandate
                    if is_extension:
                        if interval_pattern.search(line):
                            report_violation("METRONOME_MANDATE", filepath, line_num, "setInterval detected. Use ExtensionRegistry.registerTick() to prevent ghost polling.")

                    # 3. UIFactory Mandate
                    if hardcoded_modal_pattern.search(line):
                        report_violation("UI_FACTORY_MANDATE", filepath, line_num, "Hardcoded modal structural classes detected. Use UIFactory.createModal().")
                    # 4. Theme Variables
                    if is_extension and hex_color_pattern.search(line):
                        # Simple heuristic: warn if hex colors are used in UI injection strings
                        if "style=" in line or "cssText" in line:
                            report_violation("THEME_TOKENS", filepath, line_num, f"Hardcoded HEX color found: {line.strip()}. Use CSS intent variables (e.g., var(--btn)).")
                    # 5. Debounce Mandate
                    if clear_timeout_pattern.search(line):
                        # Whitelist the core utility declaration itself and the legacy panic fallback
                        if "utils.debounce" not in line and "panicTimeout" not in line:
                            report_violation("DEBOUNCE_MANDATE", filepath, line_num, "Raw clearTimeout detected. Use window.inSetu.extensions.Registry.utils.debounce() for input throttling.")

                    # 6. Surgical DOM Annihilation Ban
                    if dom_annihilation_pattern.search(line):
                        report_violation("SURGICAL_DOM_MANDATE", filepath, line_num, "DOM annihilation detected. Use surgical reconciliation instead of clearing .innerHTML.")

                    # 7. Floating Globals / UDF Bleed
                    if is_extension and floating_global_pattern.match(line.strip()):
                        report_violation("UDF_STATE_BLEED", filepath, line_num, "Floating global state detected. Migrate variable into the centralized Zustand AppStore.")

                    # 8. Naive XSS Regex Ban
                    if naive_xss_pattern.search(line):
                        report_violation("XSS_VULNERABILITY", filepath, line_num, "Naive regex script stripping detected. Use DOMPurify.sanitize().")

if __name__ == "__main__":
    print("============================================================")
    print("      inSetu Architectural Fitness Functions Validator      ")
    print("============================================================\n")
    
    check_python_files()
    check_javascript_files()
    
    print("============================================================")
    if violations_found == 0:
        print("✅ SUCCESS: Codebase complies with all engineering standards.")
        sys.exit(0)
    else:
        print(f"❌ FAILED: Found {violations_found} architectural violations.")
        sys.exit(1)