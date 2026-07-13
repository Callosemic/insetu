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
        # SDK V2 Enforcement (Backend Extensions)
        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        if is_ext:
            if isinstance(node.func, ast.Attribute) and getattr(node.func.value, 'id', '') == 'os' and node.func.attr == 'walk':
                report_violation("SDK_VFS_WALK_MANDATE", self.filepath, node.lineno, "Raw os.walk() detected in extension. Use ctx.vfs.walk() instead.")
            if isinstance(node.func, ast.Name) and node.func.id == 'open':
                report_violation("SDK_VFS_READ_MANDATE", self.filepath, node.lineno, "Native open() detected in extension. Use ctx.vfs.read() instead.")
            if isinstance(node.func, ast.Attribute) and node.func.attr == 'route':
                if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value in ('', '/'):
                    report_violation("BANNED_EMPTY_ROUTE", self.filepath, node.lineno, f"Empty or root route selection ('{node.args[0].value}') detected in extension engine. Use an explicit endpoint name instead to prevent reverse proxy redirect traps.")

        # 1. VFS Write-Path Ban: Prevent native open(..., 'w') outside of the VFS pipeline
        if isinstance(node.func, ast.Name):
            if node.func.id == 'open' and self.filename not in VFS_WRITE_WHITELIST:
                # Check positional args for write modes
                if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant) and 'w' in node.args[1].value:
                    report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Native file write detected. Route through execute_vfs_save instead.")
                # Check keyword args
                for kw in node.keywords:
                    if kw.arg == 'mode' and isinstance(kw.value, ast.Constant) and 'w' in kw.value.value:
                        report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Native file write detected. Route through execute_vfs_save instead.")

            # Catch __import__('sqlite3') bypass
            if node.func.id == '__import__' and self.filename not in SQLITE_WHITELIST:
                if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value == 'sqlite3':
                    report_violation("DB_CONNECTION_BAN_BYPASS", self.filepath, node.lineno, "__import__('sqlite3') bypass detected.")

        # 2. I/O Block Ban & Attribute-based Bypasses
        if isinstance(node.func, ast.Attribute):
            # Catch pathlib write/delete bypasses
            if node.func.attr in ('write_text', 'write_bytes', 'unlink', 'rmdir'):
                if self.filename not in VFS_WRITE_WHITELIST:
                    report_violation("VFS_CONSTRAINT_BYPASS", self.filepath, node.lineno, f"pathlib.{node.func.attr}() bypass detected. Route through the async VFS queue.")

            # Catch importlib.import_module('sqlite3') bypass
            if node.func.attr == 'import_module' and self.filename not in SQLITE_WHITELIST:
                if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value == 'sqlite3':
                    report_violation("DB_CONNECTION_BAN_BYPASS", self.filepath, node.lineno, "importlib.import_module('sqlite3') bypass detected.")

            if isinstance(node.func.value, ast.Name):
                if node.func.value.id == 'subprocess' and node.func.attr in ('run', 'Popen', 'call', 'check_output', 'check_call'):
                    if self.filename.startswith("routes_"):
                        report_violation("IO_BLOCK_BAN", self.filepath, node.lineno, "Synchronous subprocess execution in a REST route. Offload to background workers.")
                    elif self.filename not in SUBPROCESS_WHITELIST:
                        report_violation("IO_BLOCK_BAN", self.filepath, node.lineno, f"Subprocess call outside of designated engines.")

                # Catch os.system / os.popen bypasses
                if node.func.value.id == 'os' and node.func.attr in ('system', 'popen'):
                    if self.filename.startswith("routes_"):
                        report_violation("IO_BLOCK_BAN", self.filepath, node.lineno, "Synchronous OS execution in a REST route.")
                    elif self.filename not in SUBPROCESS_WHITELIST:
                        report_violation("IO_BLOCK_BAN_BYPASS", self.filepath, node.lineno, "os.system/popen bypass detected.")

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

        # Enforce sniff_tenant_id over raw header extraction
        if isinstance(node.func, ast.Attribute) and node.func.attr == 'get':
            if isinstance(node.func.value, ast.Attribute) and node.func.value.attr == 'headers':
                if getattr(node.func.value.value, 'id', '') == 'request':
                    if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value == 'X-Workspace-ID':
                        report_violation("TENANT_SNIFF_MANDATE", self.filepath, node.lineno, "Raw request.headers.get('X-Workspace-ID') detected. Use sniff_tenant_id() from utils_core.")

        self.generic_visit(node)

    def visit_With(self, node):
        for item in node.items:
            if isinstance(item.context_expr, ast.Call):
                func = item.context_expr.func
                if isinstance(func, ast.Name) and func.id == 'open':
                    args = item.context_expr.args
                    if len(args) > 1 and isinstance(args[1], ast.Constant) and args[1].value in ['w', 'a', 'wb', 'ab']:
                        if self.filename not in VFS_WRITE_WHITELIST:
                            report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Native 'open' in write mode detected. Route through execute_vfs_save.")
        self.generic_visit(node)
    def visit_Import(self, node):
        self._check_sqlite_import(node)
        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        if is_ext and any(alias.name == 'flask' for alias in node.names):
            report_violation("FLASK_BLUEPRINT_BAN", self.filepath, node.lineno, "Raw flask import detected in extension engine. Use InSetuExtension framework instead.")
        self.generic_visit(node)
    def visit_FunctionDef(self, node):
        # CQRS Hook Parity Check
        hook_events = []
        for dec in node.decorator_list:
            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                if getattr(dec.func.value, 'id', '') == 'hooks' and dec.func.attr == 'on':
                    if len(dec.args) > 0 and isinstance(dec.args[0], ast.Constant):
                        hook_events.append(dec.args[0].value)

        if 'vfs_transaction_committed' in hook_events:
            if 'post_file_save' not in hook_events or 'post_file_delete' not in hook_events:
                report_violation("CQRS_EVENT_PARITY", self.filepath, node.lineno, "Function subscribes to 'vfs_transaction_committed' but is missing 'post_file_save' and/or 'post_file_delete'.")

        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        self._check_sqlite_import(node)
        # Catch from os.path import join bypass
        if node.module == 'os.path' and any(alias.name == 'join' for alias in node.names):
            report_violation("PATHLIB_MANDATE_BYPASS", self.filepath, node.lineno, "from os.path import join detected. Migrate to pathlib.Path.")

        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        if is_ext:
            if node.module == 'flask' and any(alias.name == 'Blueprint' for alias in node.names):
                report_violation("FLASK_BLUEPRINT_BAN", self.filepath, node.lineno, "Flask Blueprint detected in extension engine. Use InSetuExtension instead.")

            banned_imports = {'load_config', 'resolve_workspace_path', 'get_gather_paths'}
            imported_names = {alias.name for alias in node.names}
            violations = banned_imports.intersection(imported_names)
            if violations:
                report_violation("SDK_CONTEXT_MANDATE", self.filepath, node.lineno, f"Banned SDK imports detected: {violations}. Use ctx.config, ctx.resolve_path(), or ctx.paths instead.")

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
                        is_ext = file.startswith("engine_") and 'extensions' in filepath.parts
                        if is_ext:
                            has_depends = any(
                                isinstance(n, ast.Assign) and 
                                any(isinstance(t, ast.Name) and t.id == '__depends__' for t in n.targets) 
                                for n in tree.body
                            )
                            if not has_depends:
                                report_violation("EXTENSION_DAG", filepath, 1, f"Missing '__depends__ = []' declaration in extension engine.")

                            has_insetu_ext = False
                            for n in ast.walk(tree):
                                if isinstance(n, ast.Call) and (getattr(n.func, 'id', '') == 'InSetuExtension' or getattr(n.func, 'attr', '') == 'InSetuExtension'):
                                    has_insetu_ext = True
                                    break
                            if not has_insetu_ext:
                                report_violation("SDK_EXTENSION_MANDATE", filepath, 1, "Extension engine does not utilize InSetuExtension framework.")
                    except SyntaxError:
                        print(f"⚠️  Skipping {file} due to SyntaxError.")
# --- JAVASCRIPT REGEX LINTER ---
def check_javascript_files():
    print("🔍 Sweeping JavaScript Frontend (Regex Analysis)...")
    # Pre-compile Regex Patterns
    dom_read_pattern = re.compile(r'document\.(?:getElementById|querySelector)\([^\)]+\)(?:\.(value|checked|classList)|\[[\'"](value|checked|classList)[\'"]\]|\.getAttribute\([\'"](value|checked|class)[\'"]\))')
    interval_pattern = re.compile(r'\bsetInterval\s*\(')
    hardcoded_modal_pattern = re.compile(r'class=["\'][^"\']*fullscreen-modal[^"\']*["\']|class=["\'][^"\']*modal-panel[^"\']*["\']')
    hex_color_pattern = re.compile(r'#[0-9a-fA-F]{3,6}\b')
    clear_timeout_pattern = re.compile(r'\bclearTimeout\s*\(')

    # New Rules
    dom_annihilation_pattern = re.compile(r'(?:\.innerHTML|\[[\'"]innerHTML[\'"]\])\s*=\s*([\'"`][\'"`])')
    bracket_bypass_pattern = re.compile(r'\[[\'"](value|checked|classList)[\'"]\]')
    floating_global_pattern = re.compile(r'^\s*let\s+[a-zA-Z0-9_,\s]+')
    naive_xss_pattern = re.compile(r'\.replace\(/<script')
    create_modal_pattern = re.compile(r'\.createModal\s*\(')
    slug_dry_pattern = re.compile(r'\.normalize\([\'"]NFD[\'"]\)')
    context_scraping_pattern = re.compile(r'\.active\b.*\.sub-tab|\.sub-tab.*\.active\b')
    form_data_pattern = re.compile(r'new\s+FormData\b')
    local_fetch_wrapper_pattern = re.compile(r'(const|let|var)\s+apiFetch\s*=')
    imperative_dom_create_pattern = re.compile(r'document\.createElement\(')
    raw_fetch_pattern = re.compile(r'\bfetch\s*\(')
    legacy_insetu_fetch_pattern = re.compile(r'window\.inSetu\.fetch\s*\(')
    manual_unsub_pattern = re.compile(r'this\._unsub[a-zA-Z0-9_]*\s*=')
    zustand_create_store_pattern = re.compile(r'\bcreateStore\s*\(')
    zustand_direct_import_pattern = re.compile(r'from\s+[\'"]https://esm\.sh/zustand(?:/[^\'"]*)?[\'"]')
    lit_element_class_pattern = re.compile(r'class\s+\w+\s+extends\s+LitElement\b')
    raw_register_tick_pattern = re.compile(r'\.registerTick\s*\(')
    zustand_reference_mutation_pattern = re.compile(r'\.setState\(\{\s*([a-zA-Z0-9_]+)\s*:\s*\1\s*\}\)')

    for root, _, files in os.walk(FRONTEND_DIR):
        for file in files:
            if file.endswith(".js"):
                filepath = Path(root) / file
                is_extension = file.startswith("ext_")
                with open(filepath, "r", encoding="utf-8") as f:
                    lines = f.readlines()

                is_lit_component = any(re.search(r'from\s+[\'"]lit[\'"]', l) for l in lines)

                # Enforce Declarative Purity and DOM Read Ban within graduated components
                full_content = "".join(lines)
                if file in ["ext_tracker.js", "ext_research.js", "ext_config.js"] and "document.getElementById" in full_content:
                    report_violation("GRADUATED_COMP_DOM_READ", filepath, 1, "Graduated components are forbidden from using document.getElementById (DOM Read Ban). Bind to reactive Lit properties instead.")
                if "innerHTML =" in full_content and file != "ext_citations.js" and is_extension:
                    report_violation("LIT_TEMPLATE_VIOLATION", filepath, 1, "Insetu extensions must utilize Lit templates rather than raw innerHTML string overwrites.")

                for i, line in enumerate(lines):
                    line_num = i + 1

                    # Ignore comments
                    if line.strip().startswith("//"):
                        continue
                    # 1. DOM Read Ban (UDF Enforcement)
                    if is_extension or file in ["kanban.js", "bridge.js"]:
                        if dom_read_pattern.search(line):
                            report_violation("DOM_READ_BAN", filepath, line_num, "Direct DOM reading detected. Read from the Zustand Store instead.")
                        if bracket_bypass_pattern.search(line):
                            report_violation("DOM_READ_BAN_BYPASS", filepath, line_num, "Bracket notation bypass detected. Use pure UDF instead.")

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
                    # 9. LitElement Imperative Modal Ban
                    if is_lit_component and create_modal_pattern.search(line):
                        report_violation("LIT_IMPERATIVE_MODAL_BAN", filepath, line_num, "Legacy UIFactory.createModal detected in a LitElement. Render <insetu-modal> declaratively instead.")

                    # 12. Lit Element Native Template Enforcement
                    if is_lit_component and "insertAdjacentHTML" in line:
                        report_violation("LIT_TEMPLATE_VIOLATION", filepath, line_num, "Imperative HTML insertion detected. Utilize LitElement render() templates to surgically diff components safely.")

                    # 10. Slug Normalization DRY Violation
                    if is_extension and slug_dry_pattern.search(line):
                        report_violation("SLUG_DRY_VIOLATION", filepath, line_num, "Duplicate slug generation regex detected. Use the centralized generateSafeSlug() utility instead.")
                    # 11. Context Scraping Ban
                    if is_extension and context_scraping_pattern.search(line):
                        report_violation("CONTEXT_SCRAPING_BAN", filepath, line_num, "DOM class context scraping detected. Actions must rely on localized dataset properties instead.")

                    # 13. UDF FormData Bypass
                    if is_lit_component and form_data_pattern.search(line):
                        report_violation("UDF_FORM_DATA_BAN", filepath, line_num, "new FormData() detected in LitElement. Bind inputs to reactive properties via @input instead.")
                    # 14. Global Fetch Interceptor Bypass
                    if is_extension and local_fetch_wrapper_pattern.search(line):
                        report_violation("GLOBAL_UTILITY_BYPASS", filepath, line_num, "Localized API fetch wrapper detected. Utilize the centralized window.inSetu.fetch utility to ensure global interceptor compliance.")
                    # 15. Explicit API Client Mandate in Extensions (ADR 0016)
                    if is_extension and raw_fetch_pattern.search(line):
                        report_violation("EXPLICIT_API_MANDATE", filepath, line_num, "Raw fetch() detected. Route through the explicit window.inSetu.api SDK (ADR 0016).")

                    # 22. Core File Utility Centralization Mandate (DRY Enforcement)
                    if is_extension and ("navigator.clipboard.writeText" in line or "window.URL.createObjectURL" in line):
                        report_violation("DRY_UTILITY_VIOLATION", filepath, line_num, "Manual clipboard or blob download stream manipulation detected. Utilize centralized core utilities (fetchAndCopy or fetchAndDownloadState) instead.")
                    if is_extension and legacy_insetu_fetch_pattern.search(line):
                        report_violation("EXPLICIT_API_MANDATE", filepath, line_num, "Legacy window.inSetu.fetch() detected. Route through the explicit window.inSetu.api SDK (ADR 0016).")

                    # 23. Framework Component Inheritance Mandate
                    if is_extension and re.search(r'class\s+\w+\s+extends\s+LitElement\b', line):
                        report_violation("SDK_ELEMENT_MANDATE", filepath, line_num, "Extension component extends raw LitElement. Inherit from InSetuElement to protect multi-tenant lifecycles.")
                    # 16. Imperative DOM Creation Ban in Extensions
                    if is_extension and is_lit_component and imperative_dom_create_pattern.search(line):
                        report_violation("IMPERATIVE_DOM_CREATION", filepath, line_num, "document.createElement detected in a LitElement extension. Construct templates declaratively using lit-html.")
                    # 17. Manual Store Un-subscription Ban in LitElement Extensions
                    if is_extension and is_lit_component and manual_unsub_pattern.search(line):
                        report_violation("SDK_SUBSCRIPTION_MANDATE", filepath, line_num, "Manual store un-subscription detected. Use this.subscribe() from the InSetuElement SDK.")
                    # 18. Zustand createStore Ban in Extensions
                    if is_extension and zustand_create_store_pattern.search(line):
                        report_violation("SDK_STORE_MANDATE", filepath, line_num, "Standard Zustand createStore detected. Use createExtensionStore() from the OS SDK instead.")
                    if is_extension and zustand_direct_import_pattern.search(line):
                        report_violation("BANNED_ZUSTAND_IMPORT", filepath, line_num, "Direct import from external Zustand distributions found. Extensions must use createExtensionStore() from the local SDK to preserve multi-tenant tracking.")

                    # 19. LitElement Extension Ban
                    if is_extension and lit_element_class_pattern.search(line):
                        report_violation("SDK_ELEMENT_MANDATE", filepath, line_num, "Extension component extends native LitElement. Use InSetuElement instead to enable managed lifecycles.")
                    # 20. Raw Polling Tick Ban
                    if is_extension and raw_register_tick_pattern.search(line):
                        report_violation("POLLING_MANDATE", filepath, line_num, "Raw registerTick detected. Use this.api.pollJob or central SDK polling mechanisms to coordinate worker jobs.")

                    # 21. Zustand Reference Mutation Ban
                    if zustand_reference_mutation_pattern.search(line):
                        report_violation("ZUSTAND_REFERENCE_MUTATION", filepath, line_num, "Symmetric state assignment detected (e.g. {manifest: manifest}). Ensure complex objects are explicitly cloned using the spread operator before passing to setState.")

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