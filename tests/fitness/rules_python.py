import os
import ast
from pathlib import Path
from .core import (
    BACKEND_DIR, VFS_WRITE_WHITELIST, SQLITE_WHITELIST, 
    SUBPROCESS_WHITELIST, report_violation
)
class BackendFitnessVisitor(ast.NodeVisitor):
    def __init__(self, filepath, filename):
        self.filepath = filepath
        self.filename = filename
        self.has_save_json = False
        self.has_cache_clear = False

    def visit_Dict(self, node):
        dict_keys = {}
        for k, v in zip(node.keys, node.values):
            if k and isinstance(k, ast.Constant) and isinstance(k.value, str):
                dict_keys[k.value] = v

        if 'id' in dict_keys and isinstance(dict_keys['id'], ast.Constant) and isinstance(dict_keys['id'].value, str):
            setting_id = dict_keys['id'].value.lower()
            sensitive_keywords = ['api_key', 'secret', 'password', 'token']
            if any(kw in setting_id for kw in sensitive_keywords):
                secure_val = dict_keys.get('secure')
                is_secure = isinstance(secure_val, ast.Constant) and secure_val.value is True

                if not is_secure:
                    report_violation(
                        "SENSITIVE_SETTING_SECURE_MANDATE",
                        self.filepath,
                        node.lineno,
                        f"Setting field '{setting_id}' contains sensitive keywords but is missing 'secure': True."
                    )
        self.generic_visit(node)

    def visit_Subscript(self, node):
        if self.filename not in ('extension.py', 'engine_hooks.py'):
            if isinstance(node.value, ast.Name) and node.value.id == 'item':
                if isinstance(node.slice, ast.Constant) and node.slice.value in ('filepath', 'folderpath'):
                    report_violation("SELECTION_EXPANSION_MANDATE", self.filepath, node.lineno, "Manual selection parsing detected. You must use ctx.expand_selection(items) instead to prevent polymorphic chunking bugs.")
        self.generic_visit(node)
    def visit_Call(self, node):
        for arg in node.args:
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                if any(m in arg.value for m in ('manifest.json', 'manifest_cache.json')):
                    report_violation(
                        "MANIFEST_FILE_IO_BAN",
                        self.filepath,
                        node.lineno,
                        f"Direct file I/O on legacy '{arg.value}' detected. Use vfs_index.db, ctx.save_manifest, or request_manifest instead."
                    )

        if isinstance(node.func, ast.Name) and node.func.id == 'save_json_file':
            self.has_save_json = True
        if isinstance(node.func, ast.Attribute) and node.func.attr == 'clear':
            if isinstance(node.func.value, ast.Name) and node.func.value.id == '_MUTATED_CONFIG_CACHE':
                self.has_cache_clear = True

        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        if is_ext:
            if isinstance(node.func, ast.Attribute) and getattr(node.func.value, 'id', '') == 'os' and node.func.attr == 'walk':
                report_violation("SDK_VFS_WALK_MANDATE", self.filepath, node.lineno, "Raw os.walk() detected in extension. Use ctx.vfs.walk() instead.")
            if isinstance(node.func, ast.Name) and node.func.id == 'open':
                report_violation("SDK_VFS_READ_MANDATE", self.filepath, node.lineno, "Native open() detected in extension. Use ctx.vfs.read() instead.")
            if isinstance(node.func, ast.Attribute) and node.func.attr == 'route':
                if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value in ('', '/'):
                    report_violation("BANNED_EMPTY_ROUTE", self.filepath, node.lineno, f"Empty or root route selection ('{node.args[0].value}') detected in extension engine. Use an explicit endpoint name instead to prevent reverse proxy redirect traps.")
            if isinstance(node.func, ast.Attribute) and getattr(node.func.value, 'id', '') == 'hooks' and node.func.attr == 'emit':
                report_violation("BACKEND_EXTENSION_EVENT_EMIT_MANDATE", self.filepath, node.lineno, "Global hooks.emit() call detected in extension module. Use ctx.emit() instead.")
        if self.filename not in ('extension.py', 'engine_hooks.py'):
            if isinstance(node.func, ast.Attribute) and getattr(node.func.value, 'id', '') == 'item' and node.func.attr == 'get':
                if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value in ('filepath', 'folderpath'):
                    report_violation("SELECTION_EXPANSION_MANDATE", self.filepath, node.lineno, "Manual selection parsing detected. You must use ctx.expand_selection(items) instead to prevent polymorphic chunking bugs.")

        if isinstance(node.func, ast.Name):
            if node.func.id == 'open' and self.filename not in VFS_WRITE_WHITELIST:
                if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant) and any(m in node.args[1].value for m in ['w', 'a', 'x', '+']):
                    report_violation("EVENT_LEDGER_SENTINEL", self.filepath, node.lineno, "Native file write detected. Route through execute_vfs_save to maintain Event Ledger parity (ADR 0018).")
                for kw in node.keywords:
                    if kw.arg == 'mode' and isinstance(kw.value, ast.Constant) and any(m in kw.value.value for m in ['w', 'a', 'x', '+']):
                        report_violation("EVENT_LEDGER_SENTINEL", self.filepath, node.lineno, "Native file write detected. Route through execute_vfs_save to maintain Event Ledger parity (ADR 0018).")

            if node.func.id == '__import__' and self.filename not in SQLITE_WHITELIST:
                if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value == 'sqlite3':
                    report_violation("DB_CONNECTION_BAN_BYPASS", self.filepath, node.lineno, "__import__('sqlite3') bypass detected.")

        if isinstance(node.func, ast.Attribute):
            if node.func.attr in ('write_text', 'write_bytes', 'unlink', 'rmdir'):
                if self.filename not in VFS_WRITE_WHITELIST:
                    report_violation("VFS_CONSTRAINT_BYPASS", self.filepath, node.lineno, f"pathlib.{node.func.attr}() bypass detected. Route through the async VFS queue.")

            if node.func.attr == 'import_module' and self.filename not in SQLITE_WHITELIST:
                if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value == 'sqlite3':
                    report_violation("DB_CONNECTION_BAN_BYPASS", self.filepath, node.lineno, "importlib.import_module('sqlite3') bypass detected.")

            if isinstance(node.func.value, ast.Name):
                if node.func.value.id == 'subprocess' and node.func.attr in ('run', 'Popen', 'call', 'check_output', 'check_call'):
                    if self.filename.startswith("routes_"):
                        report_violation("IO_BLOCK_BAN", self.filepath, node.lineno, "Synchronous subprocess execution in a REST route. Offload to background workers.")
                    elif self.filename not in SUBPROCESS_WHITELIST:
                        report_violation("IO_BLOCK_BAN", self.filepath, node.lineno, f"Subprocess call outside of designated engines.")

                    if node.func.attr == 'run':
                        is_pull = False
                        if len(node.args) > 0 and isinstance(node.args[0], ast.List):
                            for elt in node.args[0].elts:
                                if isinstance(elt, ast.Constant) and 'pull' in str(elt.value):
                                    is_pull = True
                        if is_pull:
                            has_timeout = any(kw.arg == 'timeout' for kw in node.keywords)
                            if not has_timeout:
                                report_violation("PULL_TIMEOUT_CIRCUIT_BREAKER", self.filepath, node.lineno, "Subprocess 'git pull' invoked without an explicit timeout circuit breaker.")

                if node.func.value.id == 'os' and node.func.attr in ('system', 'popen'):
                    if self.filename.startswith("routes_"):
                        report_violation("IO_BLOCK_BAN", self.filepath, node.lineno, "Synchronous OS execution in a REST route.")
                    elif self.filename not in SUBPROCESS_WHITELIST:
                        report_violation("IO_BLOCK_BAN_BYPASS", self.filepath, node.lineno, "os.system/popen bypass detected.")

                if node.func.value.id == 'os' and node.func.attr in ('remove', 'rmdir'):
                    if self.filename not in VFS_WRITE_WHITELIST:
                        report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Synchronous os.remove/rmdir detected. Route through the async VFS queue.")
                if node.func.value.id == 'shutil' and node.func.attr in ('move', 'rmtree'):
                    if self.filename not in VFS_WRITE_WHITELIST:
                        report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Synchronous shutil.move/rmtree detected. Route through the async VFS queue.")

        if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Attribute):
            if getattr(node.func.value.value, 'id', '') == 'os' and node.func.value.attr == 'path' and node.func.attr in ('join', 'basename', 'dirname'):
                report_violation("PATHLIB_MANDATE", self.filepath, node.lineno, f"os.path.{node.func.attr} detected. Migrate to pathlib.Path.")

        if isinstance(node.func, ast.Attribute) and node.func.attr == 'get':
            if isinstance(node.func.value, ast.Attribute) and node.func.value.attr == 'headers':
                if getattr(node.func.value.value, 'id', '') == 'request':
                    if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value == 'X-Workspace-ID':
                        report_violation("TENANT_SNIFF_MANDATE", self.filepath, node.lineno, "Raw request.headers.get('X-Workspace-ID') detected. Use sniff_tenant_id() from utils_core.")

        self.generic_visit(node)

    def visit_Compare(self, node):
        if self.filename.startswith("engine_") and self.filename != "utils_core.py":
            if isinstance(node.left, ast.BinOp) and isinstance(node.left.op, ast.Div):
                for op, comparator in zip(node.ops, node.comparators):
                    if isinstance(op, (ast.Gt, ast.GtE)) and isinstance(comparator, ast.Constant):
                        if isinstance(comparator.value, float) and 0.0 < comparator.value < 1.0:
                            report_violation("CIRCUIT_BREAKER_CENTRALIZATION", self.filepath, node.lineno, "Inline ratio threshold math detected. Use utils_core.evaluate_circuit_breaker() instead.")
        self.generic_visit(node)

    def visit_With(self, node):
        for item in node.items:
            if isinstance(item.context_expr, ast.Call):
                func = item.context_expr.func
                if isinstance(func, ast.Name) and func.id == 'open':
                    args = item.context_expr.args
                    if len(args) > 1 and isinstance(args[1], ast.Constant) and any(m in args[1].value for m in ['w', 'a', 'x', '+']):
                        if self.filename not in VFS_WRITE_WHITELIST:
                            report_violation("EVENT_LEDGER_SENTINEL", self.filepath, node.lineno, "Native 'open' in write mode detected. Route through execute_vfs_save to maintain Event Ledger parity (ADR 0018).")
        self.generic_visit(node)
    def visit_Import(self, node):
        self._check_sqlite_import(node)
        for alias in node.names:
            if alias.name in ('insetu.utils', 'insetu.vfs', 'insetu.db', 'insetu.hooks', 'insetu.workers', 'insetu.auth', 'insetu.fallback_bridge'):
                report_violation("DEPRECATED_ROOT_IMPORT", self.filepath, node.lineno, f"Importing from deprecated top-level '{alias.name}'. Import from 'insetu.kernel.{alias.name.split('.')[-1]}' instead.")
        is_ext = 'extensions' in self.filepath.parts
        is_tier2 = not is_ext and self.filename not in ('cli.py', 'app.py')

        if is_tier2 and any(alias.name.startswith('insetu.extensions') or alias.name.startswith('extensions') for alias in node.names):
            report_violation("TIER_ISOLATION_MANDATE", self.filepath, node.lineno, "Tier 2 Core Substrate modules cannot import from Tier 3 Domain Extensions.")

        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        if is_ext and any(alias.name == 'flask' for alias in node.names):
            report_violation("FLASK_BLUEPRINT_BAN", self.filepath, node.lineno, "Raw flask import detected in extension engine. Use InSetuExtension framework instead.")
        if is_ext and any(alias.name == 'socket' for alias in node.names):
            report_violation("BANNED_SOCKET_MANAGEMENT", self.filepath, node.lineno, "Raw socket management loop detected in extension. Multi-tenant endpoints must utilize brokered WebSocket schemas or standard API routes.")
        self.generic_visit(node)

    def visit_FunctionDef(self, node):
        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        hook_events = []
        for dec in node.decorator_list:
            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                if getattr(dec.func.value, 'id', '') == 'hooks' and dec.func.attr == 'on':
                    if len(dec.args) > 0 and isinstance(dec.args[0], ast.Constant):
                        hook_events.append(dec.args[0].value)
        for legacy_hook in ['vfs_transaction_committed', 'post_file_save', 'post_file_delete']:
            if legacy_hook in hook_events:
                report_violation("LEGACY_HOOK_BAN", self.filepath, node.lineno, f"Function subscribes to deprecated '{legacy_hook}'. Use unified 'vfs_mutated' instead.")
        if 'system_boot' in hook_events:
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    func_name = child.func.id if isinstance(child.func, ast.Name) else (child.func.attr if isinstance(child.func, ast.Attribute) else "")
                    if func_name in ('generate_context_file', 'walk'):
                        report_violation("BOOT_HOOK_NONBLOCKING_MANDATE", self.filepath, child.lineno, f"Synchronous execution '{func_name}' detected in system_boot hook. Offload heavy operations to background workers via submit_immediate_job.")

        if 'request_paths' in hook_events:
            for child in ast.walk(node):
                if isinstance(child, ast.Call) and getattr(child.func, 'id', '') == 'ExtensionContext':
                    report_violation("STATELESS_EVENT_ISOLATION", self.filepath, child.lineno, "ExtensionContext instantiated inside request_paths hook. This triggers an infinite recursion loop.")
                elif isinstance(child, ast.Attribute) and child.attr == 'paths':
                    report_violation("STATELESS_EVENT_ISOLATION", self.filepath, child.lineno, "Accessing .paths inside request_paths hook triggers an infinite recursion loop.")

        if is_ext:
            if 'system_boot' in hook_events:
                report_violation("SYSTEM_BOOT_EXTENSION_BAN", self.filepath, node.lineno, "Extensions are banned from subscribing to 'system_boot'. Subscribe to tenant-scoped 'workspace_boot' instead.")

            is_worker = any(
                isinstance(dec, ast.Call) and getattr(dec.func, 'attr', '') == 'worker'
                for dec in node.decorator_list
            )
            if is_worker:
                for child in ast.walk(node):
                    if isinstance(child, ast.Yield):
                        report_violation("BANNED_MAGIC_GENERATOR", self.filepath, child.lineno, "Yield detected in worker task. Use ctx.jobs.update_progress() to prevent generator hijacking.")
        self.generic_visit(node)
    def visit_ImportFrom(self, node):
        self._check_sqlite_import(node)
        if node.module in ('insetu.utils', 'insetu.vfs', 'insetu.db', 'insetu.hooks', 'insetu.workers', 'insetu.auth', 'insetu.fallback_bridge'):
            report_violation("DEPRECATED_ROOT_IMPORT", self.filepath, node.lineno, f"Importing from deprecated top-level '{node.module}'. Import from 'insetu.kernel.{node.module.split('.')[-1]}' instead.")
        if node.module == 'os.path' and any(alias.name == 'join' for alias in node.names):
            report_violation("PATHLIB_MANDATE_BYPASS", self.filepath, node.lineno, "from os.path import join detected. Migrate to pathlib.Path.")
        is_ext = 'extensions' in self.filepath.parts
        is_tier2 = not is_ext and self.filename not in ('cli.py', 'app.py')

        if is_tier2 and node.module and (node.module.startswith('insetu.extensions') or node.module.startswith('extensions')):
            report_violation("TIER_ISOLATION_MANDATE", self.filepath, node.lineno, "Tier 2 Core Substrate modules cannot import from Tier 3 Domain Extensions.")
        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        if is_ext:
            if node.module in ('insetu.sdk', 'insetu.utils', 'insetu.hooks', 'insetu.workers'):
                report_violation("DEPRECATED_TIER_IMPORT", self.filepath, node.lineno, f"Extension imports from un-tiered '{node.module}'. Import from 'insetu.core.sdk' or 'insetu.kernel.*' instead.")
            if node.module == 'flask' and any(alias.name == 'Blueprint' for alias in node.names):
                report_violation("FLASK_BLUEPRINT_BAN", self.filepath, node.lineno, "Flask Blueprint detected in extension engine. Use InSetuExtension instead.")
            if node.module == 'socket':
                report_violation("BANNED_SOCKET_MANAGEMENT", self.filepath, node.lineno, "Raw socket management loop detected in extension.")
            banned_imports = {
                'load_config', 'resolve_workspace_path', 'get_gather_paths', 'get_connection',
                'VFSTransaction', 'execute_vfs_save', 'execute_vfs_delete',
                'submit_immediate_job', 'update_immediate_job_status',
                'engine_gather', 'engine_bridge', 'cartographer'
            }
            imported_names = {alias.name for alias in node.names}
            violations = banned_imports.intersection(imported_names)
            if violations:
                report_violation("SDK_CONTEXT_MANDATE", self.filepath, node.lineno, f"Banned SDK imports detected: {violations}. Use ctx.config, ctx.resolve_path(), ctx.paths, ctx.db, ctx.vfs, or ctx.jobs instead.")

        self.generic_visit(node)
    def visit_Constant(self, node):
        if isinstance(node.value, str) and "system://" in node.value:
            if self.filename not in ("routes_fs.py", "fallback_bridge.py"):
                report_violation(
                    "LEGACY_SYSTEM_URI_BAN",
                    self.filepath,
                    node.lineno,
                    "Legacy 'system://' URI scheme detected. Migrate to 'ctx://' URI scheme."
                )
        self.generic_visit(node)

    def _check_sqlite_import(self, node):
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
                if "venv" in str(filepath) or "__pycache__" in str(filepath):
                    continue
                with open(filepath, "r", encoding="utf-8") as f:
                    try:
                        tree = ast.parse(f.read(), filename=str(filepath))
                        visitor = BackendFitnessVisitor(filepath, file)
                        visitor.visit(tree)

                        if visitor.has_save_json and not visitor.has_cache_clear and file in ["routes_system.py", "extension.py", "app.py"]:
                            report_violation("CACHE_INVALIDATION_MANDATE", filepath, 1, "File invokes save_json_file for configuration but fails to clear _MUTATED_CONFIG_CACHE to invalidate the configuration cache.")
                        if file == "app.py":
                            has_token_gate = any(
                                isinstance(n, ast.FunctionDef) and n.name == "enforce_token_gate"
                                for n in ast.walk(tree)
                            )
                            if not has_token_gate:
                                report_violation("REST_SECURITY_GATE_MANDATE", filepath, 1, "Core app.py is missing the mandatory enforce_token_gate() before_request hook.")
                        if file == "utils.py" and "kernel" in filepath.parts:
                            has_core_modules = any(
                                isinstance(n, ast.Assign) and 
                                any(isinstance(t, ast.Name) and t.id == 'CORE_MODULES' for t in n.targets) 
                                for n in tree.body
                            )
                            if not has_core_modules:
                                report_violation("CORE_MODULES_SSOT_MANDATE", filepath, 1, "Tier 1 kernel/utils.py is missing the CORE_MODULES SSOT definition.")
                        if file == "utils_core.py" and "core" in filepath.parts:
                            has_vfs_hook = any(
                                isinstance(n, ast.FunctionDef) and any(
                                    isinstance(dec, ast.Call) and getattr(dec.func, 'attr', '') == 'on'
                                    and len(dec.args) > 0 and getattr(dec.args[0], 'value', '') == 'vfs_resolve_path'
                                    for dec in n.decorator_list
                                )
                                for n in ast.walk(tree)
                            )
                            if not has_vfs_hook:
                                report_violation("VFS_HOOK_MANDATE", filepath, 1, "Tier 2 core/utils_core.py is missing the mandatory @hooks.on('vfs_resolve_path') hook.")
                            banned_utils = {"get_gather_paths", "search_workspace_files", "get_valid_workspace_files", "get_omniscient_workspace_files", "resolve_file_bucket"}
                            found_banned = [
                                n.name for n in ast.walk(tree)
                                if isinstance(n, ast.FunctionDef) and n.name in banned_utils
                            ]
                            for banned_func in found_banned:
                                report_violation(
                                    "DECOUPLED_UTIL_BAN",
                                    filepath,
                                    1,
                                    f"Banned decoupled domain function '{banned_func}' found in core/utils_core.py. Route through event bus hooks instead."
                                )

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
