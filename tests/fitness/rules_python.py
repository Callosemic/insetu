import os
import re
import ast
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from .core import (
    PROJECT_ROOT, BACKEND_DIR, AKASA_DIR, AKASA_MEMBRANE_WHITELIST, VFS_WRITE_WHITELIST,
    SQLITE_WHITELIST, SUBPROCESS_WHITELIST, EXECUTE_BINARY_WHITELIST, report_violation, collect_unique_files
)

# ==============================================================================
# SETTINGS_ACCESS_RATCHET (P13 blueprint, section 3, rule 1)
# ==============================================================================
# Every Python file in `insetu/insetu/` that reads or writes configuration directly (load_config(),
# config.json, host.json, workspace.settings.json, repo.settings.json, target_repos) instead of going
# through ctx.settings or the topology API, with how many such accesses it has and why. The counts are
# a ratchet: a new file, or a higher count, fails; a lower count also fails until the baseline here is
# lowered to match, so a removed access can never quietly come back. Boot-floor entries are permanent.

SETTINGS_ACCESS_RATCHET: Dict[str, Tuple[int, str]] = {
    # Permanent boot floor (stdlib-only or pre-kernel boot and recovery)
    "insetu/app.py": (8, "Boot floor: daemon port pre-seed and extension mounting before and during kernel boot."),
    "insetu/cli.py": (3, "Boot floor: profile scaffolding before the app is imported."),
    "insetu/fallback_bridge.py": (3, "Boot floor: the stdlib-only lifeboat reads workspaces.json, config.json and host.json."),
    # Legacy seams, removed by later P13 phases
    "insetu/core/utils_core.py": (23, "Phase 3/4: helper seam (get_repo_path, get_sister_repos, command approvals in host.json, sanitize_workspace_config)."),
    "insetu/core/system/engine_system.py": (19, "Phase 3/4: the config route and the 3-tier cascade migration bridge."),
    "insetu/core/system/cli_commands.py": (5, "Phase 3/4: CLI init, service and mcp commands that read load_config and write config.json, host.json and workspace.settings.json."),
    "insetu/core/system/legacy.py": (2, "Phase 6: one-shot boot migration of legacy config.json keys."),
    "insetu/core/topology/engine_topology.py": (10, "Phase 3: the topology engine's own target_repos and load_config queries."),
    "insetu/core/gather/engine_gather.py": (4, "Phase 3: gather declarations and the compiler reading target_repos."),
    "insetu/core/cartographer/cartographer.py": (3, "Phase 3: map_repositories reading target_repos."),
    "insetu/core/prompts/engine_prompts.py": (2, "Phase 3: prompt config mutation and repository prompt discovery."),
    "insetu/core/agent/engine_agent.py": (3, "Phase 3: plan and test-command helpers reading target_repos."),
    "insetu/core/agent/orchestrator.py": (1, "Phase 3: the orchestrator's primary repository lookup."),
    "insetu/core/bridge/bridge_test.py": (1, "Phase 3: the test runner resolving its repository config."),
    "insetu/core/bridge/bridge_vfs.py": (1, "Phase 4: the control-plane filename write guard, until protected targets replace it."),
    "insetu/core/mcp/engine_mcp.py": (1, "Phase 3: the MCP resource list iterating target_repos."),
    "insetu/core/remote/engine_remote.py": (1, "Phase 4: the legacy Tailscale settings migration in host.json."),
    # Extensions, removed in Phase 3
    "insetu/extensions/git/engine_git.py": (5, "Phase 3: target_repos and load_config."),
    "insetu/extensions/notes/engine_notes.py": (6, "Phase 3: target_repos."),
    "insetu/extensions/tracker/engine_tracker.py": (8, "Phase 3: target_repos and load_config."),
    "insetu/extensions/preview/engine_preview.py": (1, "Phase 3: target_repos."),
    "insetu/extensions/hooks/engine_hooks.py": (2, "Phase 3: target_repos and host.json."),
    "insetu/extensions/update/engine_update.py": (1, "Phase 3: target_repos."),
}

_DIRECT_SETTINGS_PATTERNS = (
    re.compile(r'\bload_config\s*\('),
    re.compile(r'\bget_daemon_host_config_path\s*\('),
    re.compile(r'["\'](?:config|host|workspace\.settings|repo\.settings)\.json["\']'),
    re.compile(r'["\']target_repos["\']'),
)


def count_direct_settings_access(source: str) -> int:
    """Number of direct configuration accesses in one file's source (the unit SETTINGS_ACCESS_RATCHET counts)."""
    return sum(len(pat.findall(source)) for pat in _DIRECT_SETTINGS_PATTERNS)


def check_settings_access_ratchet(repo_root: Path = PROJECT_ROOT, report: bool = False, ratchet: Optional[Dict[str, Tuple[int, str]]] = None) -> List[str]:
    """
    Compares each file's direct configuration access count with SETTINGS_ACCESS_RATCHET. Fails on a new file,
    a count above its baseline, a count below it (lower the baseline), and an entry whose file no longer has any.
    """
    baseline = SETTINGS_ACCESS_RATCHET if ratchet is None else ratchet
    violations: List[str] = []
    insetu_pkg = Path(repo_root) / "insetu"
    if not insetu_pkg.exists():
        return violations

    def _flag(rel_path: str, line: int, msg: str, path: Path) -> None:
        violations.append(f"❌ [VIOLATION: SETTINGS_ACCESS_RATCHET] {rel_path}:{line} — {msg}")
        if report:
            report_violation("SETTINGS_ACCESS_RATCHET", path, line, msg)

    seen = set()
    for py_file in sorted(insetu_pkg.rglob("*.py")):
        if "__pycache__" in py_file.parts or "venv" in py_file.parts:
            continue
        rel_path = py_file.relative_to(repo_root).as_posix()
        try:
            source = py_file.read_text(encoding="utf-8")
        except OSError:
            continue
        count = count_direct_settings_access(source)
        if not count:
            continue
        seen.add(rel_path)
        first = min((m.start() for pat in _DIRECT_SETTINGS_PATTERNS for m in [pat.search(source)] if m), default=0)
        line = source.count("\n", 0, first) + 1
        if rel_path not in baseline:
            _flag(rel_path, line, f"New direct configuration access ({count}). Use ctx.settings or the topology API instead.", py_file)
        elif count > baseline[rel_path][0]:
            _flag(rel_path, line, f"Direct configuration access grew from {baseline[rel_path][0]} to {count}. Use ctx.settings or the topology API instead.", py_file)
        elif count < baseline[rel_path][0]:
            _flag(rel_path, line, f"Direct configuration access fell from {baseline[rel_path][0]} to {count}: lower its SETTINGS_ACCESS_RATCHET baseline to {count}.", py_file)
    for rel_path in sorted(set(baseline) - seen):
        _flag(rel_path, 1, "No direct configuration access remains: remove this SETTINGS_ACCESS_RATCHET entry.", Path(repo_root) / rel_path)
    return violations


# Client-identity forwarding headers (HTTP and WSGI spellings). inSetu never reads them: akasa's
# classify_peer() is the single source of truth, exposed through the SDK membrane.
FORWARDED_CLIENT_HEADERS = frozenset({
    "x-forwarded-for", "x-real-ip", "forwarded",
    "http_x_forwarded_for", "http_x_real_ip", "http_forwarded",
})


SETTING_SUBSCHEMA_KEYS = ("item_schema", "fields")

# S3: every child process environment comes from utils_core.child_env(purpose).
CHILD_ENV_BUILDER_FILES = frozenset({"insetu/core/utils_core.py"})
# S4: every outbound HTTP request goes through utils_core.fetch_url(). Reviewed exceptions, with the reason.
RAW_URLOPEN_REVIEWED = {
    "insetu/core/llm/engine_llm.py": "Provider calls (streaming SSE) to endpoints a person configured; moves to fetch_url with P4's provider layer.",
    "insetu/core/system/cli_commands.py": "The CLI talking to its own local daemon on loopback.",
}
# S4: insetu never loads code from a CDN at runtime.
REMOTE_CODE_HOSTS = ("esm.sh/", "cdn.jsdelivr.net/", "unpkg.com/", "cdnjs.cloudflare.com/", "cdn.skypack.dev/")

_CROSS_MODULE_PRIVATE_REFS = None


def _cross_module_private_refs() -> set:
    """
    Underscore names that some module imports by name (`from x import _helper`) or reaches as an
    attribute (`mod._helper`) anywhere in the backend or tests. DEAD_PRIVATE_HELPER_BAN only sees one
    file at a time, so without this a helper used from another module looks dead.
    """
    global _CROSS_MODULE_PRIVATE_REFS
    if _CROSS_MODULE_PRIVATE_REFS is None:
        refs = set()
        for root in (BACKEND_DIR, PROJECT_ROOT / "tests"):
            for py_path in collect_unique_files([root], [".py"]):
                try:
                    tree = ast.parse(Path(py_path).read_text(encoding="utf-8"))
                except (OSError, SyntaxError, UnicodeDecodeError):
                    continue
                for n in ast.walk(tree):
                    if isinstance(n, ast.ImportFrom):
                        refs.update(a.name for a in n.names if a.name.startswith("_"))
                    elif isinstance(n, ast.Attribute) and n.attr.startswith("_"):
                        refs.add(n.attr)
        _CROSS_MODULE_PRIVATE_REFS = refs
    return _CROSS_MODULE_PRIVATE_REFS


class BackendFitnessVisitor(ast.NodeVisitor):
    def __init__(self, filepath, filename, is_test=False):
        self.filepath = filepath
        self.filename = filename
        self.is_test = is_test or "tests" in self.filepath.parts or self.filename.startswith("test_")
        try:
            self.rel_posix = Path(filepath).resolve().relative_to(PROJECT_ROOT.resolve()).as_posix()
        except ValueError:
            self.rel_posix = Path(filepath).as_posix()
        self.is_membrane_whitelisted = any(self.rel_posix.endswith(w) for w in AKASA_MEMBRANE_WHITELIST)
        self.has_save_json = False
        self.has_cache_clear = False
        self.top_level_imports = set()
        self.route_function_names = set()
        self.current_function_name = None
        self.selection_item_vars = set()
        # Sub-field definitions nested in a setting (repeater item_schema, record fields) inherit their
        # parent's scope, so SETTINGS_SCOPE_MANDATE only applies to top-level setting fields.
        self.nested_setting_field_ids = set()

    @staticmethod
    def _is_selection_iterable(iter_node) -> bool:
        """True when a loop/comprehension iterable represents a raw UI selection list (items, selection, selected_items)."""
        selection_names = ("items", "selection", "selected_items")
        if isinstance(iter_node, ast.Name):
            return iter_node.id in selection_names
        if isinstance(iter_node, ast.BoolOp):
            return any(BackendFitnessVisitor._is_selection_iterable(v) for v in iter_node.values)
        if isinstance(iter_node, ast.Call) and isinstance(iter_node.func, ast.Attribute):
            if iter_node.func.attr == "get" and iter_node.args and isinstance(iter_node.args[0], ast.Constant):
                return iter_node.args[0].value in selection_names
        if isinstance(iter_node, ast.Subscript) and isinstance(iter_node.slice, ast.Constant):
            return iter_node.slice.value in selection_names
        return False

    def _collect_selection_loop_vars(self, scope_node) -> set:
        """Collects loop target variable names bound to selection iterables within scope_node."""
        vars_found = set()
        for child in ast.walk(scope_node):
            if isinstance(child, (ast.For, ast.AsyncFor)) and isinstance(child.target, ast.Name):
                if self._is_selection_iterable(child.iter):
                    vars_found.add(child.target.id)
            elif isinstance(child, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
                for gen in child.generators:
                    if isinstance(gen.target, ast.Name) and self._is_selection_iterable(gen.iter):
                        vars_found.add(gen.target.id)
        return vars_found

    def _mark_nested_setting_fields(self, list_node):
        if isinstance(list_node, ast.List):
            for elt in list_node.elts:
                if isinstance(elt, ast.Dict):
                    self.nested_setting_field_ids.add(id(elt))

    def visit_Module(self, node):
        # Pre-pass: sub-schemas defined as named module constants and referenced by item_schema/fields.
        subschema_names = set()
        for n in ast.walk(node):
            if isinstance(n, ast.Dict):
                for k, v in zip(n.keys, n.values):
                    if isinstance(k, ast.Constant) and k.value in SETTING_SUBSCHEMA_KEYS and isinstance(v, ast.Name):
                        subschema_names.add(v.id)
        for stmt in node.body:
            if isinstance(stmt, (ast.Assign, ast.AnnAssign)):
                targets = stmt.targets if isinstance(stmt, ast.Assign) else [stmt.target]
                if any(isinstance(t, ast.Name) and t.id in subschema_names for t in targets):
                    self._mark_nested_setting_fields(stmt.value)
        for n in ast.walk(node):
            if isinstance(n, ast.FunctionDef):
                for dec in n.decorator_list:
                    if (
                        isinstance(dec, ast.Call)
                        and isinstance(dec.func, ast.Attribute)
                        and dec.func.attr == "route"
                        and isinstance(dec.func.value, ast.Name)
                        and dec.func.value.id != "app"
                    ):
                        self.route_function_names.add(n.name)
        if not self.is_test:
            referenced_names = {
                n.id for n in ast.walk(node)
                if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Load)
            }
            for stmt in node.body:
                if (
                    isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef))
                    and stmt.name.startswith("_")
                    and not stmt.name.startswith("__")
                    and not stmt.decorator_list
                    and stmt.name not in referenced_names
                    and stmt.name not in _cross_module_private_refs()
                ):
                    report_violation(
                        "DEAD_PRIVATE_HELPER_BAN",
                        self.filepath,
                        stmt.lineno,
                        f"Unused private helper function '{stmt.name}()' is referenced nowhere in the backend or tests. Remove dead code or export it publicly."
                    )
        for stmt in node.body:
            if isinstance(stmt, (ast.Assign, ast.AnnAssign)):
                targets = stmt.targets if isinstance(stmt, ast.Assign) else [stmt.target]
                for t in targets:
                    if isinstance(t, ast.Name) and t.id == "_BUILTIN_ROUTINES":
                        report_violation(
                            "HARDCODED_BUILTIN_ROUTINES_BAN",
                            self.filepath,
                            stmt.lineno,
                            "Hardcoded '_BUILTIN_ROUTINES' dictionary in Python is banned. All built-in routines must live as read-only Markdown-as-Code files in '<module>/routines/*.md'."
                        )
                    # Legacy Pattern Detector: Catch and remove duplicate JS symbol regexes outside insetu/core/languages/
                    if (
                        not self.is_test
                        and "languages" not in self.filepath.parts
                        and isinstance(t, ast.Name)
                        and t.id in ("_JS_SYMBOL_RE", "_RUST_FN_RE", "_RUST_TYPE_RE")
                    ):
                        report_violation(
                            "DUPLICATE_LANGUAGE_AST_HELPER_BAN",
                            self.filepath,
                            stmt.lineno,
                            f"Legacy duplicate language regex '{t.id}' detected outside 'insetu/core/languages/'. Remove it and delegate to 'insetu.core.languages'."
                        )
            if isinstance(stmt, ast.Import):
                for alias in stmt.names:
                    self.top_level_imports.add(alias.asname or alias.name)
            elif isinstance(stmt, ast.ImportFrom):
                module = stmt.module or ""
                for alias in stmt.names:
                    self.top_level_imports.add(f"{module}.{alias.name}" if module else alias.name)
                    self.top_level_imports.add(alias.asname or alias.name)
        self.generic_visit(node)

    def visit_Dict(self, node):
        dict_keys = {}
        for k, v in zip(node.keys, node.values):
            if k and isinstance(k, ast.Constant) and isinstance(k.value, str):
                dict_keys[k.value] = v
        if self.is_test:
            self.generic_visit(node)
            return

        # A setting field's list-valued entries (item_schema, fields, columns...) hold sub-fields, never
        # top-level settings. 'default' and 'options' hold data, not schema, and are left alone.
        if 'id' in dict_keys and 'type' in dict_keys:
            for key_name, value_node in dict_keys.items():
                if key_name not in ('default', 'options'):
                    self._mark_nested_setting_fields(value_node)

        for uri_key in ('out_file',):
            if uri_key in dict_keys and isinstance(dict_keys[uri_key], ast.Constant) and isinstance(dict_keys[uri_key].value, str):
                val = dict_keys[uri_key].value
                if val and "://" not in val:
                    report_violation(
                        "CANONICAL_OUT_FILE_URI_MANDATE",
                        self.filepath,
                        node.lineno,
                        f"Dictionary key '{uri_key}' contains non-canonical path '{val}'. Must include explicit scheme:// prefix (e.g. 'ctx://contexts/...')."
                    )

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
            # Hierarchical Scope Enforcement (includes 'type': 'hidden' settings)
            setting_type_node = dict_keys.get('type')
            is_setting_schema = ('label' in dict_keys and 'type' in dict_keys) or (
                isinstance(setting_type_node, ast.Constant)
                and setting_type_node.value == 'hidden'
                and ('default' in dict_keys or 'scope' in dict_keys)
            )
            if is_setting_schema and id(node) not in self.nested_setting_field_ids:
                if 'scope' not in dict_keys:
                    report_violation(
                        "SETTINGS_SCOPE_MANDATE",
                        self.filepath,
                        node.lineno,
                        f"Setting field '{setting_id}' is missing the mandatory 'scope' parameter ('daemon', 'workspace', or 'repo')."
                    )
                else:
                    scope_node = dict_keys['scope']
                    if not (isinstance(scope_node, ast.Constant) and scope_node.value in ('daemon', 'workspace', 'repo')):
                        report_violation(
                            "INVALID_SETTINGS_SCOPE",
                            self.filepath,
                            node.lineno,
                            f"Setting field '{setting_id}' has an invalid 'scope'. Must be 'daemon', 'workspace', or 'repo'."
                        )

        self.generic_visit(node)
    def visit_Subscript(self, node):
        if self.filename not in ('extension.py', 'engine_hooks.py', 'engine_gather.py', 'utils_core.py', 'engine_fs.py'):
            if isinstance(node.value, ast.Name) and node.value.id in self.selection_item_vars:
                if isinstance(node.slice, ast.Constant) and node.slice.value in ('filepath', 'folderpath'):
                    report_violation("SELECTION_EXPANSION_MANDATE", self.filepath, node.lineno, "Manual selection parsing detected. You must use ctx.expand_selection(items) instead to prevent polymorphic chunking bugs.")
        # AkasaURI Migration Guardrails
        if isinstance(node.value, ast.Call) and isinstance(node.value.func, ast.Attribute) and node.value.func.attr == 'split':
            if len(node.value.args) > 0 and isinstance(node.value.args[0], ast.Constant) and node.value.args[0].value == '/':
                is_neg_one = isinstance(node.slice, ast.UnaryOp) and isinstance(node.slice.op, ast.USub) and isinstance(node.slice.operand, ast.Constant) and node.slice.operand.value == 1
                is_zero = isinstance(node.slice, ast.Constant) and node.slice.value == 0
                if self.filename not in ("fallback_bridge.py", "vfs.py", "uri.py") and not self.is_test:
                    if is_neg_one:
                        report_violation("URI_BASENAME_MANDATE", self.filepath, node.lineno, "Manual path splitting ([-1]) detected. Use InSetuURI(path).basename instead.")
                    elif is_zero:
                        report_violation("URI_VOLUME_MANDATE", self.filepath, node.lineno, "Manual path splitting ([0]) detected. Use InSetuURI(path).volume or .repo instead.")

        self.generic_visit(node)
    def _check_child_env_and_fetch(self, node):
        func = node.func
        environ_ref = lambda n: isinstance(n, ast.Attribute) and n.attr == "environ" and isinstance(n.value, ast.Name) and n.value.id == "os"
        copies_environ = (
            (isinstance(func, ast.Attribute) and func.attr == "copy" and environ_ref(func.value))
            or (isinstance(func, ast.Name) and func.id == "dict" and node.args and environ_ref(node.args[0]))
        )
        if copies_environ and self.rel_posix not in CHILD_ENV_BUILDER_FILES:
            report_violation(
                "CHILD_ENV_MANDATE",
                self.filepath,
                node.lineno,
                "Copy of os.environ for a child process. Use child_env('shell' | 'tool' | 'repo_code', ...) from insetu.core.utils_core, which decides what the child may inherit (S3)."
            )
        is_urlopen = (isinstance(func, ast.Attribute) and func.attr == "urlopen") or (isinstance(func, ast.Name) and func.id == "urlopen")
        if is_urlopen and self.rel_posix not in RAW_URLOPEN_REVIEWED:
            report_violation(
                "OUTBOUND_FETCH_MANDATE",
                self.filepath,
                node.lineno,
                "Raw urlopen(). Use fetch_url() from insetu.core.utils_core, which enforces schemes, timeouts, size caps and the private-address policy (S4)."
            )

    def visit_Call(self, node):
        if not self.is_test:
            self._check_child_env_and_fetch(node)
        for arg in node.args:
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                if any(m in arg.value for m in ('manifest.json', 'manifest_cache.json')):
                    report_violation(
                        "MANIFEST_FILE_IO_BAN",
                        self.filepath,
                        node.lineno,
                        f"Direct file I/O on legacy '{arg.value}' detected. Use vfs_index.db, ctx.save_manifest, or request_manifest instead."
                    )
        if not self.is_test and isinstance(node.func, ast.Name) and node.func.id in self.route_function_names:
            report_violation(
                "DIRECT_ROUTE_FUNCTION_CALL_BAN",
                self.filepath,
                node.lineno,
                f"Direct Python call to @route-decorated function '{node.func.id}()' is banned because @route wraps functions for Flask HTTP transport. Invoke via 'ctx.call(\"<ext>.<action>\", ...)' instead."
            )
        if isinstance(node.func, ast.Name) and node.func.id == 'save_json_config':
            self.has_save_json = True
        if isinstance(node.func, ast.Name) and node.func.id == 'ExtensionContext':
            if ('core' in self.filepath.parts or 'extensions' in self.filepath.parts) and self.filename != 'extension.py':
                report_violation(
                    "EXTENSION_CONTEXT_ACCESSOR_MANDATE",
                    self.filepath,
                    node.lineno,
                    "Direct ExtensionContext(...) instantiation detected in core/extension module. Use bp.get_context(workspace_id) instead."
                )
        if not self.is_test and self.filename in ("engine_agent.py", "orchestrator.py"):
            if (
                isinstance(node.func, ast.Attribute)
                and node.func.attr in ("save", "delete", "move", "bulk")
                and isinstance(node.func.value, ast.Attribute)
                and node.func.value.attr == "vfs"
            ) or (
                isinstance(node.func, ast.Name)
                and node.func.id in ("execute_vfs_save", "execute_vfs_delete", "execute_vfs_move", "execute_vfs_bulk")
            ):
                allowed_agent_crud_fns = {
                    "_handle_routine_response_pre_save",
                    "_persist_turn_plan_artifact",
                    "_persist_routine_response",
                    "api_save_routine",
                    "api_delete_routine",
                    "api_ensure_plan_file",
                }
                if self.current_function_name not in allowed_agent_crud_fns:
                    report_violation(
                        "YOMAMA_PATCH_GATEWAY_MANDATE",
                        self.filepath,
                        node.lineno,
                        "Direct VFS mutation detected in Agent turn/orchestrator loop. All agent code modifications must route through 'bridge.sync' to guarantee AST validation and ledger parity."
                    )
        func_name = None
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr

        # Ban manual next((... for ... in *.emit(...))) query comprehension loops
        if func_name == "next" and len(node.args) >= 1 and isinstance(node.args[0], ast.GeneratorExp):
            gen_exp = node.args[0]
            for gen in gen_exp.generators:
                if isinstance(gen.iter, ast.Call):
                    iter_fn = gen.iter.func.attr if isinstance(gen.iter.func, ast.Attribute) else (gen.iter.func.id if isinstance(gen.iter.func, ast.Name) else "")
                    if iter_fn == "emit":
                        report_violation(
                            "RAW_EMIT_QUERY_ACCUMULATION_BAN",
                            self.filepath,
                            node.lineno,
                            "Manual 'next((... for ... in *.emit(...)))' query loop detected. Use emit_first(), emit_merge_dict(), or emit_merge_list() instead."
                        )
        # Enforce declarative volume mounting for 'ctx' volumes in core/extension engines
        if (
            not self.is_test
            and not self.is_membrane_whitelisted
            and self.filename != "utils_core.py"
            and func_name == "mount_volume"
            and len(node.args) >= 2
            and isinstance(node.args[1], ast.Constant)
            and node.args[1].value == "ctx"
        ):
            report_violation(
                "DECLARATIVE_VOLUME_MOUNT_MANDATE",
                self.filepath,
                node.lineno,
                "Manual mount_volume(..., 'ctx', ...) detected in engine. Declare 'volumes={...}' on InSetuExtension instead."
            )

        if not self.is_test and func_name == "mount_volumes" and not self.rel_posix.endswith("insetu/core/sdk/__init__.py"):
            report_violation(
                "REDUNDANT_VOLUME_MOUNT_BAN",
                self.filepath,
                node.lineno,
                "Manual .mount_volumes() call detected. InSetuExtension mounts declarative volumes automatically via workspace_boot and get_context()."
            )

        if not self.is_test and func_name == "move_tree_contents" and not (
            self.rel_posix.endswith("insetu/core/sdk/__init__.py")
            or self.rel_posix.endswith("insetu/core/system/legacy.py")
        ):
            report_violation(
                "EXTENSION_MANUAL_LEGACY_MIGRATION_BAN",
                self.filepath,
                node.lineno,
                "Manual move_tree_contents() call detected. Declare 'legacy_dirs' on InSetuExtension(..., volumes={...}) instead."
            )
        is_jobs_submit = (
            isinstance(node.func, ast.Attribute)
            and node.func.attr in ("submit", "submit_chain")
            and (
                (isinstance(node.func.value, ast.Attribute) and node.func.value.attr == "jobs")
                or (isinstance(node.func.value, ast.Name) and node.func.value.id == "jobs")
            )
        )

        if func_name == "ThreadPoolExecutor" and self.filename not in ("__init__.py", "hooks.py"):
            report_violation(
                "SHARED_IO_EXECUTOR_MANDATE",
                self.filepath,
                node.lineno,
                "Ad-hoc ThreadPoolExecutor() instantiation detected outside Akasa kernel. Use ctx.jobs.map_parallel() or akasa.workers.run_parallel() to prevent thread sprawl and SQLite connection leaks."
            )
        if func_name == "submit_immediate_job" or is_jobs_submit:
            has_category = any(kw.arg == "job_category" for kw in node.keywords if kw.arg)
            if not has_category:
                report_violation(
                    "EXPLICIT_JOB_CATEGORY_MANDATE",
                    self.filepath,
                    node.lineno,
                    f"Call to '{func_name}()' must explicitly specify a 'job_category' parameter."
                )

        if not self.is_test and func_name == "find_active_pipeline_job":
            if any(kw.arg == "force_full" for kw in node.keywords):
                report_violation(
                    "FIND_ACTIVE_PIPELINE_JOB_PREDICATE_MANDATE",
                    self.filepath,
                    node.lineno,
                    "Deprecated 'force_full=' keyword passed to find_active_pipeline_job(). Pass an IoC 'predicate=' callable instead."
                )

        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        if is_ext:
            if isinstance(node.func, ast.Attribute) and getattr(node.func.value, 'id', '') == 'os' and node.func.attr in ('exists', 'isfile', 'isdir'):
                if len(node.args) > 0 and isinstance(node.args[0], ast.Call) and getattr(node.args[0].func, 'attr', '') == 'resolve_path':
                    report_violation("RESOLVE_PATH_MUST_EXIST_MANDATE", self.filepath, node.lineno, "Manual os.path.exists(ctx.resolve_path(...)) detected. Pass must_exist=True to ctx.resolve_path() instead.")

            if isinstance(node.func, ast.Attribute) and getattr(node.func.value, 'id', '') == 'os' and node.func.attr == 'walk':
                report_violation("SDK_VFS_WALK_MANDATE", self.filepath, node.lineno, "Raw os.walk() detected in extension. Use ctx.vfs.walk() instead.")
            if isinstance(node.func, ast.Name) and node.func.id == 'open':
                report_violation("SDK_VFS_READ_MANDATE", self.filepath, node.lineno, "Native open() detected in extension. Use ctx.vfs.read() instead.")
            if isinstance(node.func, ast.Attribute) and node.func.attr == 'save':
                for kw in node.keywords:
                    if kw.arg == 'data' and isinstance(kw.value, ast.Dict):
                        for k, v in zip(kw.value.keys, kw.value.values):
                            if isinstance(k, ast.Constant) and k.value == 'action' and isinstance(v, ast.Constant) and v.value == 'delete':
                                report_violation("DEPRECATED_VFS_DELETE_ACTION", self.filepath, node.lineno, "Passing data={'action': 'delete'} to ctx.vfs.save() is deprecated. Use ctx.vfs.delete() instead.")
            if isinstance(node.func, ast.Attribute) and node.func.attr == 'route':
                if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value in ('', '/'):
                    report_violation("BANNED_EMPTY_ROUTE", self.filepath, node.lineno, f"Empty or root route selection ('{node.args[0].value}') detected in extension engine. Use an explicit endpoint name instead to prevent reverse proxy redirect traps.")
            if isinstance(node.func, ast.Attribute) and getattr(node.func.value, 'id', '') == 'hooks' and node.func.attr == 'emit':
                report_violation("BACKEND_EXTENSION_EVENT_EMIT_MANDATE", self.filepath, node.lineno, "Global hooks.emit() call detected in extension module. Use ctx.emit() instead.")
        if self.filename not in ('extension.py', 'engine_hooks.py', 'engine_gather.py', 'utils_core.py', 'engine_fs.py'):
            if isinstance(node.func, ast.Attribute) and getattr(node.func.value, 'id', '') in self.selection_item_vars and node.func.attr == 'get':
                if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and node.args[0].value in ('filepath', 'folderpath'):
                    report_violation("SELECTION_EXPANSION_MANDATE", self.filepath, node.lineno, "Manual selection parsing detected. You must use ctx.expand_selection(items) instead to prevent polymorphic chunking bugs.")

        # Markdown Entity Creation Helper Mandate
        if is_ext and isinstance(node.func, ast.Name) and node.func.id == 'update_frontmatter':
            report_violation(
                "MANUAL_ENTITY_CREATION_BAN",
                self.filepath,
                node.lineno,
                "Manual frontmatter formatting detected in extension. Use 'ctx.create_entity_file(folder, title, yaml_data, ...)' instead."
            )
        # AkasaURI Migration Guardrails: Ban stripping vfs://, ctx://, or ws:// schemes via .replace()
        if isinstance(node.func, ast.Attribute) and node.func.attr == 'replace':
            if len(node.args) >= 2 and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                if any( node.args[0].value.startswith(s) for s in ('vfs://', 'ctx://', 'ws://', 'system://') ):
                    if isinstance(node.args[1], ast.Constant) and node.args[1].value == '':
                        report_violation("URI_SCHEME_STRIP_BAN", self.filepath, node.lineno, f"Stripping URI scheme ({node.args[0].value}) via .replace() is banned. Preserve canonical URIs or use InSetuURI(uri).path for internal math.")
        if isinstance(node.func, ast.Attribute) and node.func.attr == 'endswith':
            if len(node.args) > 0 and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                if node.args[0].value in ('_diffs.txt', '_context.txt', '_workflow_context.txt'):
                    if self.filename not in ("utils_core.py", "engine_git.py"):
                        report_violation("URI_EXTENSION_MATCHING_BAN", self.filepath, node.lineno, f"Manual suffix matching ('{node.args[0].value}') detected. Rely on InSetuURI(path) domain resolution instead.")
        if isinstance(node.func, ast.Attribute) and node.func.attr == 'parse_uri':
            report_violation("PARSE_URI_DEPRECATION", self.filepath, node.lineno, "ctx.parse_uri() is deprecated. Instantiate InSetuURI(uri) to access .repo and .path natively.")
        if isinstance(node.func, ast.Attribute) and node.func.attr == 'from_any':
            report_violation("BANNED_URI_FROM_ANY_COERCION", self.filepath, node.lineno, "InSetuURI.from_any() is banned. All internal paths must be canonical scheme:// URIs passed to InSetuURI(uri).")
        if isinstance(node.func, ast.Attribute) and node.func.attr == 'from_external_input':
            if self.filename not in ("utils_core.py", "bridge_vfs.py", "bridge_ast.py", "engine_fs.py", "cartographer.py", "engine_mcp.py") and not self.is_test:
                report_violation("EXTERNAL_URI_COERCION_BOUNDARY_VIOLATION", self.filepath, node.lineno, "InSetuURI.from_external_input() is restricted to external ingress boundaries (bridge_vfs.py, bridge_ast.py, engine_fs.py, cartographer.py, engine_mcp.py, utils_core.py). Use strict InSetuURI(uri) internally.")

        if self.is_test:
            self.generic_visit(node)
            return

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
                        print(f"⚠️ [WARNING: IO_BLOCK_BAN] {self.filename}:{node.lineno}\n   ↳ Subprocess call outside of designated engines (permitted but flagged).")
                    if node.func.attr in ('run', 'Popen', 'call', 'check_output', 'check_call'):
                        if self.filename not in EXECUTE_BINARY_WHITELIST:
                            report_violation("EXECUTE_BINARY_MANDATE", self.filepath, node.lineno, f"Direct 'subprocess.{node.func.attr}()' invocation detected. Route through 'execute_binary()' in utils_core to resolve PATH binaries cleanly.")
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
                        print(f"⚠️ [WARNING: IO_BLOCK_BAN_BYPASS] {self.filename}:{node.lineno}\n   ↳ os.system/popen bypass detected (permitted but flagged).")

                if node.func.value.id == 'os' and node.func.attr in ('remove', 'rmdir'):
                    if self.filename not in VFS_WRITE_WHITELIST:
                        report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Synchronous os.remove/rmdir detected. Route through the async VFS queue.")
                if node.func.value.id == 'shutil' and node.func.attr in ('move', 'rmtree'):
                    if self.filename not in VFS_WRITE_WHITELIST:
                        report_violation("VFS_CONSTRAINT", self.filepath, node.lineno, "Synchronous shutil.move/rmtree detected. Route through the async VFS queue.")
        if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Attribute):
            if getattr(node.func.value.value, 'id', '') == 'os' and node.func.value.attr == 'path':
                if node.func.attr in ('join', 'basename', 'dirname', 'splitext', 'getmtime', 'getsize'):
                    report_violation("PATHLIB_MANDATE", self.filepath, node.lineno, f"os.path.{node.func.attr} detected. Migrate to pathlib.Path.")
                elif is_ext and node.func.attr in ('exists', 'relpath', 'expanduser', 'abspath', 'isdir', 'isfile'):
                    report_violation("PATHLIB_MANDATE", self.filepath, node.lineno, f"os.path.{node.func.attr} detected in extension. Migrate to pathlib.Path.")
        if isinstance(node.func, ast.Attribute) and node.func.attr == 'get':
            if len(node.args) > 0 and isinstance(node.args[0], ast.Constant):
                arg_val = node.args[0].value
                caller_name = getattr(node.func.value, 'id', '') or getattr(node.func.value, 'attr', '')
                if arg_val == "targets" and self.filename != "rules_python.py" and caller_name not in ("data", "req", "json", "payload", "kwargs"):
                    report_violation("TARGET_REPOS_KEY_MANDATE", self.filepath, node.lineno, "Deprecated config key 'targets' accessed. Normalize to 'target_repos' instead.")
                if arg_val == "extension_config" and self.filename != "rules_python.py":
                    report_violation("LEGACY_EXTENSION_CONFIG_BAN", self.filepath, node.lineno, "Legacy 'extension_config' dictionary accessed. Use ctx.settings.get() with a declarative settings_schema instead.")
                # Ensure Tier 3 extensions only query topology keys on ctx.config
                if is_ext and isinstance(node.func.value, ast.Attribute) and node.func.value.attr == 'config':
                    allowed_topology_keys = {
                        "target_repos", "extensions", "managed_dirs", "virtual_contexts",
                        "ignore_dirs", "ignore_files", "ignore_patterns", "include_extensions",
                        "workspace_root", "category_order", "tab_order", "hidden_outputs"
                    }
                    if isinstance(arg_val, str) and arg_val not in allowed_topology_keys:
                        report_violation(
                            "CTX_CONFIG_TOPOLOGY_ONLY_MANDATE",
                            self.filepath,
                            node.lineno,
                            f"Extension queries non-topology key '{arg_val}' via ctx.config.get(). Use ctx.settings.get('{arg_val}') instead."
                        )
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
            if not self.is_test and not self.is_membrane_whitelisted and (alias.name == 'akasa' or alias.name.startswith('akasa.')):
                report_violation(
                    "AKASA_MEMBRANE_ISOLATION",
                    self.filepath,
                    node.lineno,
                    f"Direct import '{alias.name}' outside the Single-File SDK Membrane ('insetu/core/sdk/__init__.py'). Import from 'insetu.core.sdk' or 'insetu.core.utils_core' instead."
                )
            if alias.name in ('insetu.utils', 'insetu.vfs', 'insetu.db', 'insetu.hooks', 'insetu.workers', 'insetu.auth'):
                report_violation("DEPRECATED_ROOT_IMPORT", self.filepath, node.lineno, f"Importing from deprecated top-level '{alias.name}'. Import from 'akasa.{alias.name.split('.')[-1]}' instead.")
            # Legacy Pattern Detector: Find and remove any remaining imports from the retired insetu.core.gather.languages shim
            if alias.name == "insetu.core.gather.languages" or alias.name.startswith("insetu.core.gather.languages."):
                report_violation(
                    "LEGACY_GATHER_LANGUAGES_IMPORT_BAN",
                    self.filepath,
                    node.lineno,
                    f"Legacy import '{alias.name}' detected. Remove the shim reference and import from 'insetu.core.languages' instead."
                )
        is_ext = 'extensions' in self.filepath.parts
        is_tier2 = not is_ext and self.filename not in ('cli.py', 'app.py') and not self.is_test
        if is_tier2 and any(alias.name.startswith('insetu.extensions') or alias.name.startswith('extensions') for alias in node.names):
            report_violation("TIER_ISOLATION_MANDATE", self.filepath, node.lineno, "Tier 2 Core Substrate modules cannot import from Tier 3 Domain Extensions.")
        if is_tier2 and any(alias.name.startswith('insetu.kernel') for alias in node.names):
            report_violation("AKASA_KERNEL_IMPORT_MANDATE", self.filepath, node.lineno, "Legacy import of 'insetu.kernel'. Core substrate modules must import from 'akasa.*'.")
        if not self.is_test and self.filename in ("engine_agent.py", "orchestrator.py"):
            for alias in node.names:
                if alias.name.startswith(("urllib", "anthropic", "openai", "google.generativeai")):
                    report_violation(
                        "AGENT_LLM_GATEWAY_MANDATE",
                        self.filepath,
                        node.lineno,
                        f"Direct LLM/HTTP import '{alias.name}' in '{self.filename}' is banned. Route all inference through 'llm.complete' (engine_llm.py)."
                    )
        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        if is_ext and any(alias.name == 'flask' for alias in node.names):
            report_violation("FLASK_BLUEPRINT_BAN", self.filepath, node.lineno, "Raw flask import detected in extension engine. Use InSetuExtension framework instead.")
        if is_ext and any(alias.name == 'socket' for alias in node.names):
            report_violation("BANNED_SOCKET_MANAGEMENT", self.filepath, node.lineno, "Raw socket management loop detected in extension. Multi-tenant endpoints must utilize brokered WebSocket schemas or standard API routes.")
        self.generic_visit(node)
    def visit_FunctionDef(self, node):
        prev_fn = self.current_function_name
        prev_sel_vars = self.selection_item_vars
        self.current_function_name = node.name
        self.selection_item_vars = self._collect_selection_loop_vars(node)
        if not self.is_test and node.name in ("interpolate_template", "_extract_prompt_arguments"):
            report_violation(
                "DUPLICATE_TEMPLATE_INTERPOLATOR_BAN",
                self.filepath,
                node.lineno,
                f"Legacy/duplicate template helper '{node.name}()' is banned. Use 'extract_template_variables' and 'interpolate_template_variables' from 'insetu.core.sdk' with '{{{{ ... }}}}' syntax."
            )
        if (
            not self.is_test
            and "languages" not in self.filepath.parts
            and node.name in ("find_brace_balanced_end", "_find_brace_balanced_end", "_extract_python_symbols", "_extract_js_symbols")
        ):
            report_violation(
                "DUPLICATE_LANGUAGE_AST_HELPER_BAN",
                self.filepath,
                node.lineno,
                f"Duplicate AST/language helper '{node.name}()' outside 'insetu/core/languages/'. Delegate to 'insetu.core.languages' instead."
            )
        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        hook_events = []
        for dec in node.decorator_list:
            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                dec_obj_id = getattr(dec.func.value, 'id', '')
                if (dec_obj_id == 'hooks' or dec_obj_id.endswith('_bp')) and dec.func.attr == 'on':
                    if len(dec.args) > 0 and isinstance(dec.args[0], ast.Constant):
                        hook_events.append(dec.args[0].value)
        for child in ast.walk(node):
            if isinstance(child, ast.Import):
                for alias in child.names:
                    name = alias.asname or alias.name
                    if name in self.top_level_imports or alias.name in self.top_level_imports:
                        report_violation("REDUNDANT_INLINE_IMPORT", self.filepath, child.lineno, f"Redundant inline import '{alias.name}' inside '{node.name}' (already imported at module level).")
                    elif not (alias.asname and alias.asname.startswith('_')):
                        report_violation("UNALIASED_INLINE_IMPORT", self.filepath, child.lineno, f"Inline import '{alias.name}' inside '{node.name}' must be placed at the module top-level or aliased with a leading underscore (e.g. 'import {alias.name} as _{alias.name}').")
            elif isinstance(child, ast.ImportFrom):
                module = child.module or ""
                for alias in child.names:
                    full_name = f"{module}.{alias.name}" if module else alias.name
                    name = alias.asname or alias.name
                    if full_name in self.top_level_imports or name in self.top_level_imports:
                        report_violation("REDUNDANT_INLINE_IMPORT", self.filepath, child.lineno, f"Redundant inline import 'from {module} import {alias.name}' inside '{node.name}' (already imported at module level).")
                    elif not (alias.asname and alias.asname.startswith('_')):
                        report_violation("UNALIASED_INLINE_IMPORT", self.filepath, child.lineno, f"Inline import 'from {module} import {alias.name}' inside '{node.name}' must be placed at the module top-level or aliased with a leading underscore (e.g. 'from {module} import {alias.name} as _{alias.name}').")
        for legacy_hook in ['vfs_transaction_committed', 'post_file_save', 'post_file_delete', 'coerce_naked_uri']:
            if legacy_hook in hook_events:
                report_violation("LEGACY_HOOK_BAN", self.filepath, node.lineno, f"Function subscribes to deprecated '{legacy_hook}'. Use canonical URIs natively instead.")
        if 'compile_contexts' in hook_events:
            report_violation(
                "DEAD_COMPILE_CONTEXTS_HOOK_BAN",
                self.filepath,
                node.lineno,
                "Function subscribes to dead hook 'compile_contexts'. Use '@*.on(\"gather_declare_topology\")' with generator_callback and recall_callback instead."
            )

        if 'vfs_mutated' in hook_events or 'topology_resolved' in hook_events:
            has_uri_check = False
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    func_name = child.func.id if isinstance(child.func, ast.Name) else (child.func.attr if isinstance(child.func, ast.Attribute) else "")
                    if func_name in ('parse_uri', '_to_canonical_event', '_get_fp', 'startswith', 'InSetuURI', 'from_any'):
                        has_uri_check = True
                        break
                    elif isinstance(getattr(child.func, 'value', None), ast.Name) and getattr(child.func.value, 'id', '') == 'InSetuURI':
                        has_uri_check = True
                        break
                elif isinstance(child, ast.Constant) and isinstance(child.value, str) and 'vfs://' in child.value:
                    has_uri_check = True
                    break
            if not has_uri_check:
                report_violation("CANONICAL_URI_EVENT_MANDATE", self.filepath, node.lineno, "Event handler for 'vfs_mutated' or 'topology_resolved' must process paths through InSetuURI or explicit canonical validation.")
        for sys_event in ('system_boot', 'system_shutdown'):
            if sys_event in hook_events and not node.args.kwarg:
                report_violation("SYSTEM_HOOK_KWARGS_MANDATE", self.filepath, node.lineno, f"System hook handler '{node.name}' subscribing to '{sys_event}' must accept **kwargs.")
        if 'system_boot' in hook_events:
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    func_name = child.func.id if isinstance(child.func, ast.Name) else (child.func.attr if isinstance(child.func, ast.Attribute) else "")
                    if func_name in ('generate_context_file', 'walk'):
                        report_violation("BOOT_HOOK_NONBLOCKING_MANDATE", self.filepath, child.lineno, f"Synchronous execution '{func_name}' detected in system_boot hook. Offload heavy operations to background workers via submit_immediate_job.")

        if 'workspace_boot' in hook_events:
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    func_name = getattr(child.func, 'attr', '') or getattr(child.func, 'id', '')
                    if func_name in ('save', 'delete', 'move', 'archive') and isinstance(getattr(child.func, 'value', None), ast.Attribute) and getattr(child.func.value, 'attr', '') == 'vfs':
                        report_violation("WORKSPACE_BOOT_VFS_BAN", self.filepath, child.lineno, "Phase 1 Boot Violation: VFS mutations are strictly banned during 'workspace_boot'. Defer physical disk I/O to 'topology_boot_complete' (ADR 0045).")
                    elif func_name in ('execute_vfs_save', 'execute_vfs_delete', 'execute_vfs_move', 'execute_vfs_archive'):
                        report_violation("WORKSPACE_BOOT_VFS_BAN", self.filepath, child.lineno, "Phase 1 Boot Violation: Direct VFS execution is strictly banned during 'workspace_boot'. Defer physical disk I/O to 'topology_boot_complete' (ADR 0045).")

        if 'request_paths' in hook_events:
            for child in ast.walk(node):
                if isinstance(child, ast.Call) and getattr(child.func, 'id', '') == 'ExtensionContext':
                    report_violation("STATELESS_EVENT_ISOLATION", self.filepath, child.lineno, "ExtensionContext instantiated inside request_paths hook. This triggers an infinite recursion loop.")
                elif isinstance(child, ast.Attribute) and child.attr == 'paths':
                    report_violation("STATELESS_EVENT_ISOLATION", self.filepath, child.lineno, "Accessing .paths inside request_paths hook triggers an infinite recursion loop.")
        is_worker = any(
            isinstance(dec, ast.Call) and getattr(dec.func, 'attr', '') == 'worker'
            for dec in node.decorator_list
        )
        if is_worker and not self.is_test:
            all_pos_args = list(node.args.posonlyargs) + list(node.args.args)
            if not all_pos_args or all_pos_args[0].arg != "ctx":
                report_violation(
                    "WORKER_CTX_FIRST_PARAM_MANDATE",
                    self.filepath,
                    node.lineno,
                    f"Worker function '{node.name}' decorated with @*.worker must declare 'ctx' as its first parameter."
                )
            if "core" in self.filepath.parts or "extensions" in self.filepath.parts:
                all_declared_args = all_pos_args[1:] + list(node.args.kwonlyargs)
                for arg_node in all_declared_args:
                    if arg_node.arg in ("job_id", "workspace_id"):
                        continue
                    if arg_node.annotation is None:
                        report_violation(
                            "WORKER_TYPED_SIGNATURE_MANDATE",
                            self.filepath,
                            node.lineno,
                            f"Worker '{node.name}' parameter '{arg_node.arg}' is missing an explicit type annotation. Worker signatures are the SSOT for synchronous contract validation."
                        )
            for child in ast.walk(node):
                if isinstance(child, ast.Yield):
                    report_violation("BANNED_MAGIC_GENERATOR", self.filepath, child.lineno, "Yield detected in worker task. Use ctx.jobs.update_progress() to prevent generator hijacking.")
                if (
                    isinstance(child, ast.Call)
                    and isinstance(child.func, ast.Name)
                    and child.func.id == "isinstance"
                    and len(child.args) >= 2
                    and isinstance(child.args[0], ast.Name)
                    and child.args[0].id == "force_full"
                    and isinstance(child.args[1], ast.Name)
                    and child.args[1].id == "list"
                ):
                    report_violation(
                        "WORKER_PARAMETER_OVERLOAD_BAN",
                        self.filepath,
                        child.lineno,
                        "Legacy 'isinstance(force_full, list)' parameter overloading detected. Use explicit 'target_repos: Optional[List[str]] = None' instead."
                    )

        if is_ext:
            if 'system_boot' in hook_events:
                report_violation("SYSTEM_BOOT_EXTENSION_BAN", self.filepath, node.lineno, "Extensions are banned from subscribing to 'system_boot'. Subscribe to tenant-scoped 'workspace_boot' instead.")
            for dec in node.decorator_list:
                if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute) and dec.func.attr == 'route':
                    if not ast.get_docstring(node):
                        report_violation("API_DOCSTRING_MANDATE", self.filepath, node.lineno, f"Route function '{node.name}' is missing a mandatory docstring for OpenAPI spec generation.")
                    methods_arg = next((kw.value for kw in dec.keywords if kw.arg == 'methods'), None)
                    if methods_arg and isinstance(methods_arg, ast.List):
                        methods = [e.value for e in methods_arg.elts if isinstance(e, ast.Constant)]
                        if any(m in ('POST', 'PUT', 'PATCH') for m in methods):
                            has_schema = any(kw.arg == 'request_schema' for kw in dec.keywords)
                            if not has_schema:
                                report_violation("ROUTE_REQUEST_SCHEMA_MANDATE", self.filepath, node.lineno, f"Mutating route '{node.name}' ({', '.join(methods)}) is missing a mandatory 'request_schema' contract.")
        self.generic_visit(node)
        self.current_function_name = prev_fn
        self.selection_item_vars = prev_sel_vars

    def visit_Attribute(self, node):
        if isinstance(node.ctx, ast.Store) and node.attr == "_cwd":
            report_violation(
                "DIRECT_CWD_MUTATION_BAN",
                self.filepath,
                node.lineno,
                "Direct assignment to '._cwd' detected. Use 'akasa.reset_state(cwd=...)' or 'set_daemon_cwd()' instead."
            )
        if (
            not self.is_test
            and ("core" in self.filepath.parts or "extensions" in self.filepath.parts or self.filename == "engine_template_py.txt")
            and isinstance(node.value, ast.Name)
            and node.value.id == "ctx"
            and node.attr == "req"
        ):
            report_violation(
                "FLASK_TRANSPORT_LEAK_BAN",
                self.filepath,
                node.lineno,
                "Direct 'ctx.req' access detected in core/extension module. Read unified parameters from 'ctx.payload' instead."
            )
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        self._check_sqlite_import(node)
        if (
            not self.is_test
            and node.module
            and node.module.startswith("insetu.")
            and node.module != "insetu.core.utils_core"
            and node.level == 0
        ):
            for alias in node.names:
                if alias.name.startswith("_"):
                    report_violation(
                        "CROSS_MODULE_PRIVATE_IMPORT_BAN",
                        self.filepath,
                        node.lineno,
                        f"Cross-module import of private symbol '{alias.name}' from '{node.module}' is banned. Use public APIs or ctx.call() instead."
                    )
        if (
            not self.is_test
            and ("core" in self.filepath.parts or "extensions" in self.filepath.parts or self.filename == "engine_template_py.txt")
            and self.filename != "engine_system.py"  # api_system_openapi uses @system_bp.bp.route directly
            and node.module == "flask"
            and any(alias.name == "jsonify" for alias in node.names)
        ):
            report_violation(
                "FLASK_TRANSPORT_LEAK_BAN",
                self.filepath,
                node.lineno,
                "Direct 'from flask import jsonify' in core and extension modules is banned. Return plain Python dicts and let AkasaExtension.route marshal at the HTTP edge."
            )
        if node.module and (node.module == 'akasa' or node.module.startswith('akasa.')):
            if not self.is_test and not self.is_membrane_whitelisted:
                report_violation(
                    "AKASA_MEMBRANE_ISOLATION",
                    self.filepath,
                    node.lineno,
                    f"Direct import from '{node.module}' outside the Single-File SDK Membrane ('insetu/core/sdk/__init__.py'). Import from 'insetu.core.sdk' or 'insetu.core.utils_core' instead."
                )
            if not self.is_test:
                for alias in node.names:
                    if alias.name.startswith('_'):
                        report_violation(
                            "PRIVATE_KERNEL_ATTR_BAN",
                            self.filepath,
                            node.lineno,
                            f"Importing private underscore symbol '{alias.name}' from '{node.module}' is banned. Use public kernel APIs instead."
                        )
        if node.module and node.module.endswith('utils') and any(alias.name == '_cwd' for alias in node.names):
            report_violation(
                "BANNED_CWD_VALUE_IMPORT",
                self.filepath,
                node.lineno,
                "Importing '_cwd' by value freezes the working directory at import time. Use get_daemon_cwd() / set_daemon_cwd() instead."
            )
        if node.module in ('insetu.utils', 'insetu.vfs', 'insetu.db', 'insetu.hooks', 'insetu.workers', 'insetu.auth'):
            report_violation("DEPRECATED_ROOT_IMPORT", self.filepath, node.lineno, f"Importing from deprecated top-level '{node.module}'. Import from 'akasa.{node.module.split('.')[-1]}' instead.")
        # Legacy Pattern Detector: Find and remove any remaining imports from the retired insetu.core.gather.languages shim
        if (
            node.module == "insetu.core.gather.languages"
            or (node.module and node.module.startswith("insetu.core.gather.languages."))
            or ("gather" in self.filepath.parts and node.level >= 1 and node.module in ("languages", "languages.base", "languages.python", "languages.javascript", "languages.rust"))
        ):
            report_violation(
                "LEGACY_GATHER_LANGUAGES_IMPORT_BAN",
                self.filepath,
                node.lineno,
                f"Legacy import from '{node.module}' detected. Remove the shim reference and import from 'insetu.core.languages' instead."
            )
        if not self.is_test and self.filename in ("engine_agent.py", "orchestrator.py") and node.module:
            if node.module.startswith(("urllib", "anthropic", "openai", "google.generativeai")):
                report_violation(
                    "AGENT_LLM_GATEWAY_MANDATE",
                    self.filepath,
                    node.lineno,
                    f"Direct LLM/HTTP import from '{node.module}' in '{self.filename}' is banned. Route all inference through 'llm.complete' (engine_llm.py)."
                )
        if node.module == 'os.path' and any(alias.name == 'join' for alias in node.names):
            report_violation("PATHLIB_MANDATE_BYPASS", self.filepath, node.lineno, "from os.path import join detected. Migrate to pathlib.Path.")
        is_ext = 'extensions' in self.filepath.parts
        is_tier2 = not is_ext and self.filename not in ('cli.py', 'app.py') and not self.is_test
        if is_tier2 and node.module and (node.module.startswith('insetu.extensions') or node.module.startswith('extensions')):
            report_violation("TIER_ISOLATION_MANDATE", self.filepath, node.lineno, "Tier 2 Core Substrate modules cannot import from Tier 3 Domain Extensions.")
        if is_tier2 and node.module and node.module.startswith('insetu.kernel'):
            report_violation("AKASA_KERNEL_IMPORT_MANDATE", self.filepath, node.lineno, "Legacy import from 'insetu.kernel'. Core substrate modules must import from 'akasa.*'.")
        is_ext = self.filename.startswith("engine_") and 'extensions' in self.filepath.parts
        if is_ext:
            if node.module in ('typing', 'typing_extensions'):
                banned_type_aliases = {'WorkspaceID', 'FilePath', 'TenantPath', 'VFSStorageEngine'}
                imported = {alias.name for alias in node.names}
                overlap = banned_type_aliases.intersection(imported)
                if overlap:
                    report_violation(
                        "TYPE_CONTRACT_IMPORT_MANDATE",
                        self.filepath,
                        node.lineno,
                        f"Redundant type alias imports {overlap} detected. Import canonical type contracts from 'akasa.types' instead."
                    )
            if node.module in ('insetu.sdk', 'insetu.utils', 'insetu.hooks', 'insetu.workers'):
                report_violation("DEPRECATED_TIER_IMPORT", self.filepath, node.lineno, f"Extension imports from un-tiered '{node.module}'. Import from 'insetu.core.sdk' or 'akasa.*' instead.")
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
        if isinstance(node.value, str) and not self.is_test and any(f"://{host}" in node.value for host in REMOTE_CODE_HOSTS):
            report_violation(
                "REMOTE_CODE_URL_BAN",
                self.filepath,
                node.lineno,
                "CDN URL in shipped code. insetu loads no code from the network at runtime; vendor it under static/vendor/ instead (S4)."
            )
        if isinstance(node.value, str):
            if not self.is_test and node.value.strip().lower() in FORWARDED_CLIENT_HEADERS:
                report_violation(
                    "FORWARDED_HEADER_MEMBRANE",
                    self.filepath,
                    node.lineno,
                    f"Forwarding header '{node.value}' read in inSetu. Use classify_peer() from insetu.core.sdk (the request's PeerInfo) instead."
                )
            if 'core' in self.filepath.parts and not self.is_test and self.filename != "legacy.py":
                ext_dir = BACKEND_DIR / "extensions"
                tier3_names = {
                    d.name for d in ext_dir.iterdir()
                    if d.is_dir() and not d.name.startswith("__")
                } if ext_dir.exists() else set()
                if any(
                    f"ctx://{ext_n}/" in node.value or f".insetu-data/{ext_n}/" in node.value
                    for ext_n in tier3_names
                ):
                    report_violation(
                        "TIER2_EXTENSION_NAME_LEAK_BAN",
                        self.filepath,
                        node.lineno,
                        f"Tier 2 core module hardcodes Tier 3 extension URI path '{node.value}'. Use declarative extension attributes or IoC hooks instead."
                    )
            if "system://" in node.value and self.filename not in ("routes_fs.py", "fallback_bridge.py"):
                report_violation(
                    "LEGACY_SYSTEM_URI_BAN",
                    self.filepath,
                    node.lineno,
                    "Legacy 'system://' URI scheme detected. Migrate to 'ctx://' URI scheme."
                )
            if "::" in node.value and any(p in node.value for p in ("repo::", "path::")) and self.filename != "rules_python.py":
                report_violation(
                    "LEGACY_BOUNDARY_SYNTAX_BAN",
                    self.filepath,
                    node.lineno,
                    "Legacy '::' repository boundary syntax detected in string literal. Use canonical 'vfs://' URI scheme."
                )
            if "system.json" in node.value and self.filename not in ("legacy.py", "utils.py") and not self.is_test:
                report_violation(
                    "LEGACY_SYSTEM_JSON_BAN",
                    self.filepath,
                    node.lineno,
                    f"Hardcoded reference to legacy 'system.json' detected in '{node.value}'. "
                    "Use 'host.json' (get_daemon_host_config_path()) or 'workspaces.json' (get_system_index_path()) instead."
                )
            if any(sql in node.value for sql in ("INSERT INTO jobs", "INSERT OR REPLACE INTO jobs", "DELETE FROM jobs")) and self.filename not in ("workers.py", "__init__.py") and not self.is_test:
                report_violation(
                    "DIRECT_JOB_TABLE_MUTATION_BAN",
                    self.filepath,
                    node.lineno,
                    "Direct SQL manipulation of the 'jobs' table detected. Use submit_job() or submit_one_shot_job() from akasa.workers instead."
                )
            if "UPDATE topology_ledger SET git_status" in node.value and "timestamp" in node.value and not self.is_test:
                report_violation(
                    "TOPOLOGY_GIT_STATUS_TIMESTAMP_CLOBBER_BAN",
                    self.filepath,
                    node.lineno,
                    "SQL update to topology_ledger.git_status must not overwrite the 'timestamp' column, as doing so clobbers physical file mutation watermarks."
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
    scan_roots = [BACKEND_DIR]
    for filepath in collect_unique_files(scan_roots, [".py"]):
        for file in [filepath.name]:
            if file.endswith(".py"):
                if "venv" in str(filepath) or "__pycache__" in str(filepath):
                    continue
                with open(filepath, "r", encoding="utf-8") as f:
                    try:
                        tree = ast.parse(f.read(), filename=str(filepath))
                        visitor = BackendFitnessVisitor(filepath, file)
                        visitor.visit(tree)
                        if file == "app.py":
                            has_token_gate = any(
                                (isinstance(n, ast.FunctionDef) and n.name == "enforce_token_gate")
                                or (isinstance(n, ast.Call) and getattr(n.func, 'attr', '') == "init_app")
                                for n in ast.walk(tree)
                            )
                            if not has_token_gate:
                                report_violation("REST_SECURITY_GATE_MANDATE", filepath, 1, "Core app.py is missing the mandatory akasa.init_app() or enforce_token_gate() security gate.")
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
                            declared_ext_deps = set()
                            for n in ast.walk(tree):
                                if isinstance(n, ast.Assign):
                                    for t in n.targets:
                                        if isinstance(t, ast.Name) and t.id in ('__external_depends__', '__external_binaries__'):
                                            report_violation(
                                                "LEGACY_EXTERNAL_DUNDER_BAN",
                                                filepath,
                                                n.lineno,
                                                f"Legacy module-level '{t.id}' global detected. Declare 'external_dependencies' / 'external_binaries' directly on InSetuExtension(...) instead."
                                            )
                                elif isinstance(n, ast.Call) and (getattr(n.func, 'id', '') == 'InSetuExtension' or getattr(n.func, 'attr', '') == 'InSetuExtension'):
                                    for kw in n.keywords:
                                        if kw.arg == 'external_dependencies' and isinstance(kw.value, (ast.List, ast.Tuple)):
                                            for elt in kw.value.elts:
                                                if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                                                    declared_ext_deps.add(elt.value.lower().replace('-', '_'))

                            # Enforce Strategy Subclass Signature Parity within the module
                            class_defs = {n.name: n for n in tree.body if isinstance(n, ast.ClassDef)}
                            for cls_name, cls_node in class_defs.items():
                                for base in cls_node.bases:
                                    base_name = getattr(base, 'id', None)
                                    if base_name and base_name in class_defs:
                                        base_cls = class_defs[base_name]
                                        base_methods = {
                                            m.name: m for m in base_cls.body
                                            if isinstance(m, ast.FunctionDef) and not m.name.startswith('_')
                                        }
                                        for sub_m in cls_node.body:
                                            if isinstance(sub_m, ast.FunctionDef) and sub_m.name in base_methods:
                                                if sub_m.args.kwarg is not None:
                                                    continue
                                                base_m = base_methods[sub_m.name]
                                                base_arg_Count = len(base_m.args.args)
                                                sub_arg_count = len(sub_m.args.args)
                                                if sub_arg_count < base_arg_Count:
                                                    report_violation(
                                                        "SUBCLASS_SIGNATURE_PARITY_MANDATE",
                                                        filepath,
                                                        sub_m.lineno,
                                                        f"Subclass '{cls_name}.{sub_m.name}' accepts fewer parameters ({sub_arg_count}) than base '{base_name}.{sub_m.name}' ({base_arg_Count})."
                                                    )
                            if 'beautifulsoup4' in declared_ext_deps:
                                declared_ext_deps.add('bs4')
                            if 'python_semantic_release' in declared_ext_deps:
                                declared_ext_deps.add('semantic_release')

                            tracked_third_party = {'bs4', 'markdownify', 'playwright', 'mistune', 'jsbeautifier', 'autopep8', 'flask_sock', 'semantic_release'}
                            for n in ast.walk(tree):
                                if isinstance(n, ast.Import):
                                    for alias in n.names:
                                        root_pkg = alias.name.split('.')[0].lower()
                                        if root_pkg in tracked_third_party and root_pkg not in declared_ext_deps:
                                            report_violation("UNDECLARED_EXTERNAL_DEPENDENCY_IMPORT", filepath, n.lineno, f"Extension imports optional package '{root_pkg}' without declaring it in InSetuExtension(..., external_dependencies=[...]) or __external_depends__.")
                                elif isinstance(n, ast.ImportFrom) and n.module:
                                    root_pkg = n.module.split('.')[0].lower()
                                    if root_pkg in tracked_third_party and root_pkg not in declared_ext_deps:
                                        report_violation("UNDECLARED_EXTERNAL_DEPENDENCY_IMPORT", filepath, n.lineno, f"Extension imports from optional package '{root_pkg}' without declaring it in InSetuExtension(..., external_dependencies=[...]) or __external_depends__.")

                            has_insetu_ext = False
                            for n in ast.walk(tree):
                                if isinstance(n, ast.Call) and (getattr(n.func, 'id', '') == 'InSetuExtension' or getattr(n.func, 'attr', '') == 'InSetuExtension'):
                                    has_insetu_ext = True
                                    break
                            if not has_insetu_ext:
                                report_violation("SDK_EXTENSION_MANDATE", filepath, 1, "Extension engine does not utilize InSetuExtension framework.")
                    except SyntaxError:
                        print(f"⚠️  Skipping {file} due to SyntaxError.")
    # Validate defaults/ templates for 3-Tier Configuration Cascade compliance
    defaults_dir = BACKEND_DIR / "defaults"
    engine_tpl_path = defaults_dir / "engine_template_py.txt"
    if engine_tpl_path.exists():
        tpl_source = engine_tpl_path.read_text(encoding="utf-8").replace("{{ext_name}}", "sample").replace("{{cap_name}}", "Sample")
        try:
            tpl_tree = ast.parse(tpl_source, filename=str(engine_tpl_path))
            BackendFitnessVisitor(engine_tpl_path, engine_tpl_path.name).visit(tpl_tree)
        except SyntaxError as e:
            report_violation("TEMPLATE_SYNTAX_ERROR", engine_tpl_path, e.lineno or 1, f"Syntax error in engine_template_py.txt: {e}")
    # Validate unit test files for unittest.TestLoader discovery and import safety compliance
    unit_tests_dir = PROJECT_ROOT / "tests" / "unit"
    if unit_tests_dir.exists():
        for test_fp in sorted(unit_tests_dir.glob("test_*.py")):
            try:
                t_tree = ast.parse(test_fp.read_text(encoding="utf-8"), filename=str(test_fp))
                BackendFitnessVisitor(test_fp, test_fp.name).visit(t_tree)
                has_testcase_class = False
                for stmt in t_tree.body:
                    if isinstance(stmt, ast.FunctionDef) and stmt.name.startswith("test_"):
                        report_violation(
                            "UNITTEST_DISCOVERY_MANDATE",
                            test_fp,
                            stmt.lineno,
                            f"Top-level function '{stmt.name}()' is ignored by unittest.TestLoader().discover(). Place all test methods inside a unittest.TestCase subclass."
                        )
                    elif isinstance(stmt, ast.ClassDef):
                        has_testcase_class = True
                if not has_testcase_class:
                    report_violation(
                        "UNITTEST_DISCOVERY_MANDATE",
                        test_fp,
                        1,
                        f"Test module '{test_fp.name}' contains no unittest.TestCase classes and will not be executed by run_unit_tests.py."
                    )
            except SyntaxError as e:
                report_violation("UNITTEST_SYNTAX_ERROR", test_fp, e.lineno or 1, f"Syntax error in unit test file: {e}")
    # Legacy Directory Detector: Ensure the retired insetu/core/gather/languages/ shim directory does not exist on disk
    legacy_gather_langs_dir = BACKEND_DIR / "core" / "gather" / "languages"
    if legacy_gather_langs_dir.exists():
        leftover_py = list(legacy_gather_langs_dir.glob("*.py"))
        if leftover_py:
            report_violation(
                "LEGACY_GATHER_LANGUAGES_SHIM_DIR_BAN",
                leftover_py[0],
                1,
                "Retired compatibility shim directory 'insetu/core/gather/languages/' still contains Python files. Delete them and use 'insetu/core/languages/' exclusively."
            )
    # Enforce SETTINGS_ACCESS_RATCHET across all Python files in insetu/
    check_settings_access_ratchet(PROJECT_ROOT, report=True)

    # Validate CODE_INDEX.md has no unresolved file/directory Cartographer placeholders
    code_index_path = PROJECT_ROOT / "CODE_INDEX.md"
    if code_index_path.exists():
        for idx, line in enumerate(code_index_path.read_text(encoding="utf-8").splitlines(), start=1):
            if "[comment required]" in line:
                tree_entry = line.split("#", 1)[0].lstrip(" │├└─\t").strip()
                if tree_entry.startswith(("def ", "async def ", "class ", "function ")):
                    continue
                report_violation(
                    "CARTOGRAPHER_PLACEHOLDER_BAN",
                    code_index_path,
                    idx,
                    f"Unresolved file/directory '# [comment required]' placeholder in CODE_INDEX.md: {line.strip()}"
                )
