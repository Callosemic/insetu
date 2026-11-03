from pathlib import Path
import os
import sys
import io
import re
import random
import datetime
import ast
import json
import importlib
import importlib.util
import operator
import queue
import threading
import time
import traceback
import logging
from contextlib import redirect_stdout
os.environ.setdefault("AKASA_CONTROL_DIR", ".insetu")


def _preseed_daemon_port_env() -> None:
    """Pure-stdlib port pre-seeder: guarantees INSETU_PORT is populated in os.environ before any boot panic can occur."""
    if "INSETU_PORT" in os.environ:
        return
    ctrl_dir = Path(os.getcwd()).joinpath(os.environ.get("AKASA_CONTROL_DIR", ".insetu"))
    for fname in ("host.json",):
        fpath = ctrl_dir.joinpath(fname)
        if fpath.exists():
            try:
                raw = json.loads(fpath.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    port_val = raw.get("port") or (raw.get("system", {}).get("port") if isinstance(raw.get("system"), dict) else None)
                    if isinstance(port_val, int) and port_val > 0:
                        os.environ["INSETU_PORT"] = str(port_val)
                        return
            except Exception:
                continue


_preseed_daemon_port_env()

_sibling_akasa = Path(__file__).resolve().parent.parent.parent.joinpath("akasa")
if _sibling_akasa.exists() and (_sibling_akasa / "akasa").is_dir():
    _akasa_posix = _sibling_akasa.as_posix()
    if _akasa_posix not in sys.path:
        sys.path.insert(0, _akasa_posix)
from insetu.core.sdk import (
    CORE_MODULES_TUPLE,
    INSETU_PROTECTED_VFS_TARGETS,
    SettingsManager,
    boot_kernel,
    configure_kernel,
    get_system_index_path,
    get_workspace_physics,
    hooks,
    init_kernel_app,
    is_core_module,
    load_config,
)
from insetu.core.utils_core import (
    current_workspace_extension_fingerprint,
    get_workspace_extensions_root,
    scan_workspace_extensions,
)

# Phase A: Configure Akasa Kernel Physics & Host Namespaces
configure_kernel(
    control_dir=".insetu",
    trusted_namespaces=["insetu.core."],
    extension_namespaces=["insetu.extensions."],
    core_modules=CORE_MODULES_TUPLE,
    sse_passthrough=["topology_resolved"],
    tune_os_resources=True,
    protected_vfs_targets=INSETU_PROTECTED_VFS_TARGETS,
)

# Fire Drill: Intercept the boot sequence to test the Lifeboat FS
if os.environ.get("INSETU_SIMULATE_PANIC") == "1" or os.path.exists(".panic_lock"):
    if "INSETU_SIMULATE_PANIC" in os.environ:
        del os.environ["INSETU_SIMULATE_PANIC"]
    if os.path.exists(".panic_lock"):
        os.remove(".panic_lock")
    raise SyntaxError("Simulated Kernel Panic (Triggered via UI Fire Drill)")

from flask import Flask, render_template, request, jsonify, send_file, Response

app = Flask(__name__)
# Phase B: Wire Kernel Transport, Token Gate, DB Teardown, and SSE Stream
init_kernel_app(
    app,
    token_header="X-InSetu-Token",
    # Every public route is listed with its reason in tests/unit/test_route_auth_inventory.py (V4).
    # Source maps live under /static/, so no suffix exemption is needed: a public suffix would open
    # every route whose last path segment comes from the caller.
    public_routes={
        "/", "/manifest.json", "/sw.js", "/favicon.ico",
        "/auth/bootstrap",
        "/api/system/openapi.json", "/api/system/llm_catalog.json", "/recovery"
    },
    public_prefixes=("/static/",),
    sse_route="/api/system/stream",
)

# Explicitly register system core routes first to prevent dynamic loader misfires
try:
    from insetu.core.system.engine_system import system_bp
    if 'system' not in app.blueprints:
        app.register_blueprint(system_bp.bp)

    from insetu.core.fs.engine_fs import fs_bp
    if 'fs' not in app.blueprints:
        app.register_blueprint(fs_bp.bp)
except Exception as e:
    print(f"⚠️ Failed to mount core system routes explicitly: {e}")
# --- INSETU EXTENSION ARCHITECTURE ROUTINE ---
def load_workspace_extensions():
    raw_extensions = set()

    # 0. Check global preload preference from Tier 1 Daemon Scope (system.json)
    preload_all = False
    try:
        sys_settings = SettingsManager('system', 'default')
        cfg = load_config()
        preload_all = bool(sys_settings.get("preload_all_extensions", cfg.get("preload_all_extensions", False)))
    except Exception:
        pass
    # 1. Sweep workspaces index for a Union of all required extensions globally
    index_path = get_system_index_path()
    if os.path.exists(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                w_data = json.load(f)
            for ws_id in w_data.get("workspaces", {}).keys():
                cfg = load_config(workspace_id=ws_id)
                for ext in cfg.get("extensions", []):
                    raw_extensions.add(ext)
        except Exception as e:
            print(f"Warning: Failed to parse workspaces for extensions: {e}")
    # Fallback to default active config if switchboard is empty/missing
    if not raw_extensions:
        cfg = load_config()
        for ext in cfg.get("extensions", []):
            raw_extensions.add(ext)
    # If preload is enabled, aggressively scan and add all available extensions
    ext_dir = Path(__file__).parent.joinpath("extensions")
    if preload_all and ext_dir.exists() and ext_dir.is_dir():
        for item in os.listdir(ext_dir):
            if os.path.isdir(ext_dir.joinpath(item)) and not item.startswith("__"):
                raw_extensions.add(item)
    for sim_ext in (os.environ.get("INSETU_SIMULATE_QUARANTINE") or "").split(","):
        clean_sim = sim_ext.strip()
        if clean_sim and ext_dir.joinpath(clean_sim).is_dir():
            raw_extensions.add(clean_sim)

    # Workspace extensions in .insetu/extensions/ (S8): only one whose exact files a person approved is loaded.
    # The approved bytes are read once, here, and those same bytes are what runs.
    workspace_extensions = scan_workspace_extensions(with_contents=True)
    workspace_ext_snapshots = {}
    for ws_name, ws_entry in workspace_extensions.items():
        snap = ws_entry.pop("snapshot", None)
        if ws_entry["status"] == "approved" and snap:
            workspace_ext_snapshots[ws_name] = (Path(ws_entry["dir"]), snap)
            raw_extensions.add(ws_name)
        else:
            print(f"🔒 Workspace extension not loaded [{ws_name}]: {ws_entry.get('reason', ws_entry['status'])}")

    # Inject Tier 2 Core Modules into the DAG automatically
    core_dir = Path(__file__).parent.joinpath("core")
    if core_dir.exists() and core_dir.is_dir():
        for item in sorted(os.listdir(core_dir)):
            if os.path.isdir(core_dir.joinpath(item)) and not item.startswith("__") and item not in ("sdk", "languages"):
                raw_extensions.add(item)

    priority_order = ("system", "topology", "editor", "fs", "prompts", "offline", "remote", "llm", "cartographer", "gather", "bridge", "agent", "mcp")
    core_candidates = [e for e in priority_order if e in raw_extensions] + sorted(
        e for e in raw_extensions if is_core_module(e) and e not in priority_order and e != "config"
    )
    tier3_candidates = sorted(e for e in raw_extensions if not is_core_module(e) and e != "config")

    # Resolve Backend Python Dependencies via vendor.json before importing modules
    resolve_python_vendors(sorted(raw_extensions))

    simulated_faults = {
        m.strip() for m in (os.environ.get("INSETU_SIMULATE_QUARANTINE") or "").split(",") if m.strip()
    }
    quarantined_modules = {}
    bypassed_extensions = []
    modules = {}

    def _safe_import(target):
        try:
            return importlib.import_module(target), None
        except ModuleNotFoundError as e:
            if e.name == target.split('.')[-1] or e.name == target or (e.name and target.startswith(f"{e.name}.")):
                return None, None
            return None, e
        except Exception as e:
            return None, e

    def _verify_and_load_workspace_ext(ext_name: str, ext_dir: Path, snapshot: dict):
        """Runs the approved engine_<ext_name>.py from the bytes that were fingerprinted, after a hygiene AST check.

        The approval is the security boundary; the AST check only catches common SDK mistakes early.
        """
        if is_core_module(ext_name) or ext_name in CORE_MODULES_TUPLE:
            raise PermissionError(f"Workspace extension '{ext_name}' cannot shadow reserved Tier 2 Core module '{ext_name}'.")
        engine_py = ext_dir / f"engine_{ext_name}.py"
        engine_bytes = (snapshot.get("contents") or {}).get(engine_py.name)
        if engine_bytes is None:
            return None
        src = engine_bytes.decode("utf-8")
        tree = ast.parse(src, filename=engine_py.as_posix())
        has_depends = any(
            isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "__depends__" for t in n.targets)
            for n in tree.body
        )
        if not has_depends:
            raise ValueError(f"[EXTENSION_DAG] Missing '__depends__ = []' declaration in {engine_py.name}.")
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name == "akasa" or alias.name.startswith("akasa."):
                        raise PermissionError(f"[AKASA_MEMBRANE_ISOLATION] Direct import of '{alias.name}' is banned in workspace extension '{ext_name}'. Import from 'insetu.core.sdk'.")
            elif isinstance(node, ast.ImportFrom) and node.module:
                if node.module == "akasa" or node.module.startswith("akasa."):
                    raise PermissionError(f"[AKASA_MEMBRANE_ISOLATION] Direct import from '{node.module}' is banned in workspace extension '{ext_name}'. Import from 'insetu.core.sdk'.")
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id == "open":
                    raise PermissionError(f"[SDK_VFS_READ_MANDATE] Raw open() call is banned in workspace extension '{ext_name}'. Use ctx.vfs.")
                if isinstance(node.func, ast.Attribute) and node.func.attr == "urlopen":
                    raise PermissionError(f"[OUTBOUND_FETCH_MANDATE] Raw urlopen() is banned in workspace extension '{ext_name}'. Use fetch_url().")
        spec = importlib.util.spec_from_file_location(f"insetu.extensions.{ext_name}.engine_{ext_name}", engine_py.as_posix())
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not create module spec for {engine_py.as_posix()}")
        mod = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = mod
        exec(compile(tree, engine_py.as_posix(), "exec"), mod.__dict__)
        return mod

    def _import_candidates(candidates, is_core_tier):
        for ext in candidates:
            if ext == "config":
                continue
            tier_label = "core" if is_core_tier else "ext"
            try:
                if ext in simulated_faults:
                    raise RuntimeError(f"Simulated fault quarantine for module '{ext}'.")
                if not is_core_tier and ext in workspace_ext_snapshots:
                    ws_dir, ws_snap = workspace_ext_snapshots[ext]
                    ws_mod = _verify_and_load_workspace_ext(ext, ws_dir, ws_snap)
                    if ws_mod:
                        modules[ext] = ws_mod
                        continue
                targets = (
                    [f"insetu.core.{ext}.engine_{ext}", f"insetu.core.{ext}.{ext}"]
                    if is_core_tier
                    else [f"insetu.extensions.{ext}.engine_{ext}", f"insetu.extensions.engine_{ext}", f"insetu.engine_{ext}"]
                )
                for target in targets:
                    mod, err = _safe_import(target)
                    if err:
                        raise err
                    if mod:
                        modules[ext] = mod
                        break
            except Exception as e:
                tb_str = traceback.format_exc()
                reason_str = f"{type(e).__name__}: {e}"
                print(f"⚠️  Module Quarantined [{ext}] ({tier_label}): {reason_str}")
                quarantined_modules[ext] = {
                    "id": ext,
                    "tier": tier_label,
                    "status": "quarantined",
                    "reason": reason_str,
                    "traceback": tb_str,
                }

    # Stage 1A: Import Tier 2 Core Modules and evaluate Core DAG
    _import_candidates(core_candidates, is_core_tier=True)

    sorted_core = []
    visited_core = set()
    visiting_core = set()

    def _visit_core(ext):
        if ext in visited_core or ext in quarantined_modules:
            return
        if ext in visiting_core:
            quarantined_modules[ext] = {
                "id": ext,
                "tier": "core",
                "status": "quarantined",
                "reason": f"Circular dependency detected involving core module '{ext}'.",
                "traceback": "",
            }
            return
        visiting_core.add(ext)
        mod = modules.get(ext)
        dep_failed = None
        if mod and hasattr(mod, "__depends__"):
            for dep in (mod.__depends__ or []):
                if dep in modules and dep not in quarantined_modules:
                    _visit_core(dep)
                if dep not in visited_core or dep in quarantined_modules:
                    dep_failed = dep
                    break
        visiting_core.remove(ext)
        if dep_failed:
            msg = f"Core module [{ext}] skipped because dependency [{dep_failed}] is quarantined."
            print(f"⚠️  {msg}")
            quarantined_modules[ext] = {
                "id": ext,
                "tier": "core",
                "status": "skipped",
                "missing_dependency": dep_failed,
                "reason": msg,
                "traceback": "",
            }
            bypassed_extensions.append({"extension": ext, "missing_dependency": dep_failed, "reason": msg})
            return
        visited_core.add(ext)
        sorted_core.append(ext)

    for ext in core_candidates:
        if ext in modules and ext not in visited_core:
            _visit_core(ext)

    # Mount healthy Tier 2 Core blueprints in topological order
    mounted_core = set()
    for ext in sorted_core:
        try:
            mod = modules[ext]
            bp_attr = f"{ext}_bp"
            if hasattr(mod, bp_attr):
                ext_module = getattr(mod, bp_attr)
                blueprint = ext_module.bp if hasattr(ext_module, "bp") else ext_module
                if blueprint.name not in app.blueprints:
                    app.register_blueprint(blueprint)
            if getattr(mod, "sock", None) is not None:
                mod.sock.init_app(app)
            mounted_core.add(ext)
            print(f"🔌 Core Module Mounted Successfully: [{ext}]")
        except Exception as e:
            tb_str = traceback.format_exc()
            reason_str = f"Mount failure ({type(e).__name__}): {e}"
            print(f"⚠️  Core Mount Failure [{ext}]: {reason_str}")
            quarantined_modules[ext] = {
                "id": ext,
                "tier": "core",
                "status": "quarantined",
                "reason": reason_str,
                "traceback": tb_str,
            }

    degraded_core = any(v.get("tier") == "core" for v in quarantined_modules.values())

    # Stage 1B: Tier 3 Extensions (Skipped automatically if any Tier 2 Core module failed)
    sorted_tier3 = []
    if degraded_core:
        failed_core_names = ", ".join(sorted(k for k, v in quarantined_modules.items() if v.get("tier") == "core"))
        for ext in tier3_candidates:
            msg = f"Extension [{ext}] paused because Tier 2 Core is in Degraded Mode ({failed_core_names})."
            quarantined_modules[ext] = {
                "id": ext,
                "tier": "ext",
                "status": "skipped",
                "missing_dependency": failed_core_names,
                "reason": msg,
                "traceback": "",
            }
            bypassed_extensions.append({"extension": ext, "missing_dependency": failed_core_names, "reason": msg})
    else:
        _import_candidates(tier3_candidates, is_core_tier=False)
        visited_ext = set(mounted_core)
        visiting_ext = set()

        def _visit_ext(ext):
            if ext in visited_ext or ext in quarantined_modules:
                return
            if ext in visiting_ext:
                print(f"⚠️ Circular dependency detected involving [{ext}]. Bypassing.")
                return
            visiting_ext.add(ext)
            mod = modules.get(ext)
            missing_dep = None
            if mod and hasattr(mod, "__depends__"):
                for dep in (mod.__depends__ or []):
                    if dep in modules and dep not in quarantined_modules:
                        _visit_ext(dep)
                    if dep not in visited_ext or dep in quarantined_modules:
                        missing_dep = dep
                        break
            visiting_ext.remove(ext)
            if missing_dep:
                msg = f"Extension [{ext}] requires missing or quarantined dependency [{missing_dep}]."
                print(f"⚠️ {msg} Bypassing.")
                quarantined_modules[ext] = {
                    "id": ext,
                    "tier": "ext",
                    "status": "skipped",
                    "missing_dependency": missing_dep,
                    "reason": msg,
                    "traceback": "",
                }
                bypassed_extensions.append({"extension": ext, "missing_dependency": missing_dep, "reason": msg})
                return
            visited_ext.add(ext)
            sorted_tier3.append(ext)

        for ext in tier3_candidates:
            if ext in modules and ext not in visited_ext:
                _visit_ext(ext)

        for ext in sorted_tier3:
            try:
                mod = modules[ext]
                bp_attr = f"{ext}_bp"
                if hasattr(mod, bp_attr):
                    ext_module = getattr(mod, bp_attr)
                    blueprint = ext_module.bp if hasattr(ext_module, "bp") else ext_module
                    if blueprint.name not in app.blueprints:
                        app.register_blueprint(blueprint)
                if getattr(mod, "sock", None) is not None:
                    mod.sock.init_app(app)
                print(f"🔌 Extension Mounted Successfully: [{ext}]")
            except Exception as e:
                tb_str = traceback.format_exc()
                reason_str = f"Mount failure ({type(e).__name__}): {e}"
                print(f"⚠️  Unexpected Mount Failure [{ext}]: {reason_str}")
                quarantined_modules[ext] = {
                    "id": ext,
                    "tier": "ext",
                    "status": "quarantined",
                    "reason": reason_str,
                    "traceback": tb_str,
                }

    app._bypassed_extensions = bypassed_extensions
    app._quarantined_modules = quarantined_modules
    # Workspace extensions that are running, with the fingerprint they were loaded from (static serving checks it).
    app._loaded_workspace_extensions = {
        name: snap["fingerprint"] for name, (_, snap) in workspace_ext_snapshots.items()
        if name in modules and name not in quarantined_modules
    }
    for name, entry in workspace_extensions.items():
        entry["loaded"] = name in app._loaded_workspace_extensions
    app._workspace_extensions = workspace_extensions
    app._degraded_core = degraded_core
    hooks.emit('config_mutated')

OPERATORS = {
    '=':  operator.eq,
    '==': operator.eq,
    '>=': operator.ge,
    '<=': operator.le,
    '>':  operator.gt,
    '<':  operator.lt,
}

def parse_semver(v_str):
    """Converts a SemVer string into a comparable integer tuple (major, minor, patch)."""
    clean_v = str(v_str).split('-')[0].split('+')[0]
    parts = [int(p) for p in clean_v.split('.') if p.isdigit()]
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])

def eval_single_clause(v_tuple, clause):
    """Evaluates a single comparison clause against a version tuple."""
    clause = clause.strip()
    match = re.match(r'^(>=|<=|==|=|>|<)\s*(.+)$', clause)
    if not match:
        return v_tuple == parse_semver(clause)
    op_str, target_str = match.groups()
    op_func = OPERATORS[op_str]
    return op_func(v_tuple, parse_semver(target_str))
def satisfies_range(version_str, range_str):
    """Evaluates compound range expressions (e.g., '>=5.0.0 && <6.0.0')."""
    v_tuple = parse_semver(version_str)
    clauses = [c.strip() for c in re.split(r'&&|\s+', range_str) if c.strip()]
    return all(eval_single_clause(v_tuple, clause) for clause in clauses)
def resolve_python_vendors(active_exts):
    """Statelessly scans core and extension vendor.json manifests to resolve and inject Python dependencies."""
    candidates = {}
    resolved_paths = {}

    # 1. Read Core Baseline Manifest
    core_vendor_file = Path(app.static_folder).joinpath("vendor.json")
    if core_vendor_file.exists() and core_vendor_file.is_file():
        try:
            with open(core_vendor_file, "r", encoding="utf-8") as f:
                core_decls = json.load(f).get("python", {})
            for specifier, meta in core_decls.items():
                resolved_paths[specifier] = Path(app.root_path).joinpath("static", meta.get("path", "")).resolve().as_posix()
        except Exception as e:
            print(f"⚠️ Failed to parse core static/vendor.json: {e}")

    # 2. Sweep Active Extensions
    ext_base = Path(app.root_path).joinpath("extensions")
    for ext in active_exts:
        vendor_file = ext_base.joinpath(ext, "vendor.json")
        if vendor_file.exists() and vendor_file.is_file():
            try:
                with open(vendor_file, "r", encoding="utf-8") as f:
                    declarations = json.load(f).get("python", {})
                for specifier, meta in declarations.items():
                    if specifier not in candidates:
                        candidates[specifier] = []
                    candidates[specifier].append({
                        "ext": ext,
                        "path": Path(ext_base).joinpath(ext, meta.get("path", "")).resolve().as_posix(),
                        "version": meta.get("version", "0.0.0"),
                        "range": meta.get("range", ">=0.0.0")
                    })
            except Exception as e:
                print(f"⚠️ Failed to parse vendor.json for extension [{ext}]: {e}")

    # 3. Resolve Extension Candidates
    for specifier, items in candidates.items():
        if specifier in resolved_paths:
            print(f"ℹ️ Python Vendor Protection: [{specifier}] claimed by Core OS. Skipping extension declarations.")
            continue

        items.sort(key=lambda x: parse_semver(x["version"]), reverse=True)
        highest_item = items[0]
        all_satisfied = all(satisfies_range(highest_item["version"], item["range"]) for item in items)

        if not all_satisfied:
            print(f"⚠️ SemVer conflict for Python vendor [{specifier}]. Utilizing highest version {highest_item['version']}.")

        resolved_paths[specifier] = highest_item["path"]
    # 4. Inject into sys.path
    for specifier, abs_path in resolved_paths.items():
        if os.path.exists(abs_path) and abs_path not in sys.path:
            sys.path.insert(0, abs_path)
            print(f"🐍 Python Vendor Injected: [{specifier}] -> {abs_path}")

def resolve_js_vendors(active_exts):
    """Resolves and builds the JS import map for the frontend bootloader statelessly."""
    packages = {}

    # 1. Read Core Baseline Manifest
    core_vendor_file = Path(app.static_folder).joinpath("vendor.json")
    if core_vendor_file.exists() and core_vendor_file.is_file():
        try:
            with open(core_vendor_file, "r", encoding="utf-8") as f:
                core_imports = json.load(f).get("imports", {})
            for specifier, meta in core_imports.items():
                packages[specifier] = {
                    "version": meta.get("version", "0.0.0"),
                    "resolvedPath": f"/static/{meta.get('path', '')}"
                }
        except Exception: pass

    core_protected_specifiers = set(packages.keys())
    quarantined = getattr(app, "_quarantined_modules", {})
    # 2. Sweep Active Non-Quarantined Extensions (Core specifiers are immutable)
    ext_base = Path(app.root_path).joinpath("extensions")
    for ext in active_exts:
        if ext in quarantined:
            continue
        vendor_file = ext_base.joinpath(ext, "vendor.json")
        if vendor_file.exists() and vendor_file.is_file():
            try:
                with open(vendor_file, "r", encoding="utf-8") as f:
                    ext_imports = json.load(f).get("imports", {})
                for specifier, meta in ext_imports.items():
                    if specifier in core_protected_specifiers:
                        continue
                    if specifier not in packages or parse_semver(meta.get("version", "0.0.0")) > parse_semver(packages[specifier]["version"]):
                        packages[specifier] = {
                            "version": meta.get("version", "0.0.0"),
                            "resolvedPath": f"/static/extensions/{ext}/{meta.get('path', '')}"
                        }
            except Exception: pass

    return {specifier: meta["resolvedPath"] for specifier, meta in packages.items()}
def _resolve_workspace_ext_dir(ext_name: str):
    """The folder of a running workspace extension, only while its files still match what was approved and loaded.

    An extension's browser code runs with the person's session, so unapproved or edited files are never served.
    """
    if not ext_name or not re.match(r'^[a-z0-9_]+$', ext_name) or is_core_module(ext_name):
        return None
    if ext_name in getattr(app, "_quarantined_modules", {}):
        return None
    loaded_fingerprint = getattr(app, "_loaded_workspace_extensions", {}).get(ext_name)
    if not loaded_fingerprint:
        return None
    cand = get_workspace_extensions_root().joinpath(ext_name)
    if cand.is_symlink() or not cand.is_dir():
        return None
    if current_workspace_extension_fingerprint(cand) != loaded_fingerprint:
        return None
    return cand.resolve()


@app.route('/static/extensions/<ext_name>/<path:filename>')
def serve_extension_static(ext_name, filename):
    """Serves static assets and vendored dependencies directly from an extension directory."""
    if is_core_module(ext_name):
        ext_dir = Path(app.root_path).joinpath("core", ext_name).resolve()
    else:
        bundled_dir = Path(app.root_path).joinpath("extensions", ext_name).resolve()
        ws_ext_dir = _resolve_workspace_ext_dir(ext_name)
        ext_dir = bundled_dir if bundled_dir.is_dir() else (ws_ext_dir or bundled_dir)

    target_path = ext_dir.joinpath(filename).resolve()

    try:
        target_path.relative_to(ext_dir)
    except ValueError:
        return "403 Forbidden: Invalid asset path.", 403

    if target_path.exists() and target_path.is_file():
        return send_file(target_path.as_posix())

    # Graceful fallback: The frontend bootloader polls all extensions for vendor.json.
    # If an extension doesn't vend external dependencies, return an empty map to prevent 404 console noise.
    if filename == 'vendor.json':
        return jsonify({"imports": {}})

    return "Extension static asset not found", 404
@app.route('/static/js/extensions/ext_<ext_name>.js')
def serve_extension_js(ext_name):
    """ADR 0012: Dynamically serve frontend JS from the bundled or workspace extension subdirectory."""

    # 1. Try bundled topology
    bundled_path = Path(app.root_path).joinpath("extensions", ext_name, f"ext_{ext_name}.js").as_posix()
    if os.path.exists(bundled_path):
        return send_file(bundled_path, mimetype='application/javascript')

    # 1b. Try an approved, running workspace extension in .insetu/extensions/<ext_name>/
    ws_ext_dir = _resolve_workspace_ext_dir(ext_name)
    if ws_ext_dir is not None:
        ws_js = ws_ext_dir / f"ext_{ext_name}.js"
        if ws_js.is_file():
            return send_file(ws_js.as_posix(), mimetype='application/javascript')

    # 2. Fallback to legacy flat topology
    legacy_path = Path(app.static_folder).joinpath("js", "extensions", f"ext_{ext_name}.js").as_posix()
    if os.path.exists(legacy_path):
        return send_file(legacy_path, mimetype='application/javascript')

    # 3. Virtual fallback for Python-only declarative extensions
    return Response("export default {};", mimetype='application/javascript')
@app.route('/sw.js')
def sw():
    return send_file(Path(app.static_folder).joinpath('sw.js').as_posix(), mimetype='application/javascript')

@app.route('/README.md')
def root_readme():
    readme_path = Path(app.root_path).parent.joinpath('README.md').as_posix()
    if os.path.exists(readme_path):
        return send_file(readme_path, mimetype='text/markdown')
    return "Not found", 404
@app.route('/' + 'manifest.json')
def manifest():
    # Load the base blueprint manifest map
    base_manifest_path = Path(app.static_folder).joinpath(*['manifest', 'json']).as_posix()
    try:
        with open(base_manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
    except Exception:
        manifest_data = {}
    cfg = load_config()
    settings = SettingsManager('system', "default")
    instance_title = settings.get("instance_title", "inSetu Developer OS")
    # Inject the instance title cleanly into the PWA footprint
    manifest_data["name"] = instance_title
    manifest_data["short_name"] = instance_title.split()[0] if instance_title else "inSetu"
    # Establish complete PWA isolation using local instance scopes
    pwa_scope = cfg.get("instance_pwa_scope", "default")
    manifest_data["id"] = f"/pwa-{pwa_scope}"
    manifest_data["start_url"] = f"/?node={pwa_scope}"
    cfg_path, _ = get_workspace_physics()
    # Append a cache-busting timestamp query parameter so browsers re-evaluate the custom icons
    ts = int(Path(cfg_path).stat().st_mtime) if Path(cfg_path).exists() else 1
    if "icons" in manifest_data:
        for icon in manifest_data["icons"]:
            if "icon-192" in icon.get("src", ""):
                icon["src"] = f"/static/icon-192.png?v={ts}"
            elif "icon-512" in icon.get("src", ""):
                icon["src"] = f"/static/icon-512.png?v={ts}"

    return jsonify(manifest_data)
@app.before_request
def intercept_local_static_assets():
    """
    Intercepts standard static asset routing routes before Flask's native 
    static file engine serves them, checking the local environment first.
    """
    path = request.path
    if path in ['/static/icon-192.png', '/static/icon-512.png']:
        filename = Path(path).name
        # Anchor to the absolute instance directory to survive os.chdir() hijacking
        cfg_path, _ = get_workspace_physics()
        instance_dir = Path(cfg_path).parent.as_posix()
        local_path = Path(instance_dir).joinpath("static", filename).as_posix()
        if os.path.exists(local_path):
            return send_file(local_path, mimetype='image/png')
@app.route('/favicon.ico')
def favicon():
    cfg = load_config()
    custom_icon_name = cfg.get("instance_favicon", "favicon.ico")

    # Anchor to the absolute instance directory to survive os.chdir() hijacking
    cfg_path, _ = get_workspace_physics()
    instance_dir = Path(cfg_path).parent.as_posix()
    local_icon_path = Path(instance_dir).joinpath("static", custom_icon_name).as_posix()

    if os.path.exists(local_icon_path):
        mimetype = 'image/png' if local_icon_path.lower().endswith('.png') else 'image/vnd.microsoft.icon'
        return send_file(local_icon_path, mimetype=mimetype)
    return send_file(Path(app.static_folder).joinpath('favicon.ico').as_posix(), mimetype='image/vnd.microsoft.icon')
@app.route('/api/system/panic', methods=['POST'])
def api_system_panic():
    """Hard reboot of the OS process, setting the simulated panic flag."""
    def crash_and_restart():
        try: hooks.emit('system_shutdown')
        except Exception: pass
        time.sleep(0.5)
        # Drop breadcrumb for external process supervisors (like Gunicorn) to read on boot
        with open(".panic_lock", "w") as f: f.write("1")
        os._exit(1)

    threading.Thread(target=crash_and_restart, daemon=True).start()
    return jsonify({"status": "success", "message": "Initiating kernel panic..."})

@app.route('/recovery')
def recovery_ui():
    """Zero-JS escape hatch in case the frontend bundle is completely bricked."""
    html = """
    <!DOCTYPE html>
    <html>
    <body style="font-family: monospace; background: #0f172a; color: #f8fafc; text-align: center; padding-top: 100px;">
        <h2 style="color: #ef4444;">🆘 Manual Recovery Console</h2>
        <p>Use this page to manually trigger a kernel panic and boot into the Lifeboat FS.</p>
        <button onclick="var t=''; try{t=localStorage.getItem('insetu_boot_token')||sessionStorage.getItem('insetu_boot_token')||'';}catch(e){} if(!t){alert('No saved token in this browser. Sign in to inSetu first, or run the daemon from a terminal.'); return;} if('caches' in window){caches.keys().then(k=>k.forEach(c=>caches.delete(c)))}; if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister()))}; var b=this; fetch('/api/system/panic', {method: 'POST', headers: {'X-InSetu-Token': t}}).then(function(r){ if(r.status===401){ b.innerText='Token rejected'; return; } b.innerText='Crashing...'; setTimeout(function(){window.location.href='/recovery';}, 3000); });" style="background: #ef4444; color: white; border: none; padding: 15px 30px; font-weight: bold; font-size: 1.2rem; cursor: pointer; border-radius: 4px; margin-top: 20px;">
            Boot Immutable Recovery OS
        </button>
    </body>
    </html>
    """
    return html
@app.route('/')
def index():
    cfg = load_config()
    settings = SettingsManager('system', "default")
    instance_title = settings.get("instance_title", "inSetu Developer OS")
    instance_emoji = settings.get("instance_emoji", "⚙️")
    extensions = cfg.get("extensions", [])
    mounted_extensions = [ext for ext in extensions if ext == "config" or ext in app.blueprints]

    import_map = resolve_js_vendors(mounted_extensions)

    return render_template('index.html', title=instance_title, emoji=instance_emoji, extensions=mounted_extensions, import_map=json.dumps({"imports": import_map}), core_modules=list(CORE_MODULES_TUPLE))
# Ignite active workspace feature components JIT at application startup
load_workspace_extensions()

@hooks.on('mutate_workspace_config')
def inject_bypassed_extensions(cfg, workspace_id=None, **kwargs):
    cfg["bypassed_extensions"] = getattr(app, '_bypassed_extensions', [])
# Phase B Completion: Ignite the worker pools, declarative schemas, and VFS queues globally
use_reloader = os.environ.get("INSETU_RELOADER", "0") == "1"
is_cli_serve = "serve" in sys.argv
boot_kernel(skip_if_reloader_parent=(is_cli_serve and use_reloader))
def run_app():
    class QuietPollingFilter(logging.Filter):
        def filter(self, record):
            if os.environ.get("INSETU_DEBUG") == "1":
                return True
            msg = record.getMessage()
            # Filter standard polling heartbeat paths and manifest lookups
            if any(p in msg for p in ['/system/deltas', '/system/jobs/', '/gather/manifest/entry', '/git/sweep/status']):
                return False
            return True
    wz_logger = logging.getLogger('werkzeug')
    wz_logger.setLevel(logging.INFO)
    wz_logger.addFilter(QuietPollingFilter())
    try:
        cfg = load_config()
        sys_settings = SettingsManager('system', 'default')
        resolved_port = sys_settings.get("port", cfg.get("port", 5005))
        if "INSETU_PORT" not in os.environ or os.environ["INSETU_PORT"] == "5005":
            os.environ["INSETU_PORT"] = str(resolved_port)
        port = int(os.environ.get("INSETU_PORT", 5005))
        print(f"🚀 Starting inSetu Developer OS (Port {port})...")
        print(f"👉 Open http://127.0.0.1:{port} in your browser")
        use_reloader = os.environ.get("INSETU_RELOADER", "0") == "1"
        use_debug = os.environ.get("INSETU_DEBUG", "0") == "1" or use_reloader
        app.run(debug=use_debug, use_reloader=use_reloader, port=port)
    except Exception:
        try:
            hooks.emit("system_shutdown")
        except Exception:
            pass
        raise

if __name__ == "__main__":
    run_app()