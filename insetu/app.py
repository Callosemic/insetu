from pathlib import Path
import os
import sys
import io
import re
import random
import datetime
import json
import importlib
import operator
import queue
import threading
import time
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

    # Scan local workspace .insetu/extensions/ for user-space extensions
    _, ws_root = get_workspace_physics()
    local_ext_dir = Path(ws_root).joinpath(".insetu", "extensions")
    if local_ext_dir.exists() and local_ext_dir.is_dir():
        if local_ext_dir.as_posix() not in sys.path:
            sys.path.insert(0, local_ext_dir.as_posix())
        for item in os.listdir(local_ext_dir):
            if os.path.isdir(local_ext_dir.joinpath(item)) and not item.startswith("__"):
                raw_extensions.add(item)

    # Inject Tier 2 Core Modules into the DAG automatically
    core_dir = Path(__file__).parent.joinpath("core")
    if core_dir.exists() and core_dir.is_dir():
        for item in sorted(os.listdir(core_dir)):
            if os.path.isdir(core_dir.joinpath(item)) and not item.startswith("__") and item not in ("sdk", "languages"):
                raw_extensions.add(item)

    # Resolve Backend Python Dependencies via vendor.json
    resolve_python_vendors(sorted(raw_extensions))

    # DAG Node Resolution (load foundational Tier 2 core modules first)
    priority_order = ("system", "fs", "topology", "cartographer", "prompts", "gather", "llm", "bridge", "agent", "mcp", "offline", "remote")
    ordered_discovery = [e for e in priority_order if e in raw_extensions] + sorted(raw_extensions - set(priority_order))
    modules = {}
    for ext in ordered_discovery:
        if ext == "config": continue # Pure frontend UI extension
        try:
            # Try the extensions folder first, fallback to core chassis
            def safe_import(target):
                try:
                    return importlib.import_module(target), None
                except ModuleNotFoundError as e:
                    if e.name == target.split('.')[-1] or e.name == target or (e.name and target.startswith(f"{e.name}.")):
                        return None, None
                    return None, e
                except Exception as e:
                    return None, e

            for target in [
                f"insetu.core.{ext}.engine_{ext}",
                f"insetu.core.{ext}.{ext}",
                f"insetu.extensions.{ext}.engine_{ext}",
                f"insetu.extensions.engine_{ext}",
                f"insetu.engine_{ext}"
            ]:
                mod, err = safe_import(target)
                if err:
                    raise err
                if mod:
                    modules[ext] = mod
                    break
        except Exception as e:
            print(f"⚠️  Extension Load Failed [{ext}]: {type(e).__name__} - {str(e)}")
    # Topological Sort
    sorted_exts = []
    visited = set()
    visiting = set()
    bypassed_extensions = []

    def visit(ext):
        if ext in visited: return
        if ext in visiting:
            print(f"⚠️ Circular dependency detected involving [{ext}]. Bypassing.")
            return
        visiting.add(ext)
        mod = modules.get(ext)
        missing_dep = False
        if mod and hasattr(mod, "__depends__"):
            for dep in mod.__depends__:
                if dep in modules:
                    visit(dep)
                else:
                    msg = f"Extension [{ext}] requires missing dependency [{dep}]."
                    print(f"⚠️ {msg} Bypassing.")
                    bypassed_extensions.append({
                        "extension": ext,
                        "missing_dependency": dep,
                        "reason": msg
                    })
                    missing_dep = True

        visiting.remove(ext)
        if not missing_dep:
            visited.add(ext)
            sorted_exts.append(ext)

    for ext in list(modules.keys()):
        if ext not in visited:
            visit(ext)

    app._bypassed_extensions = bypassed_extensions
    # Mount Blueprints in safe DAG order
    for ext in sorted_exts:
        try:
            mod = modules[ext]
            bp_attr = f"{ext}_bp"

            if hasattr(mod, bp_attr):
                ext_module = getattr(mod, bp_attr)
                # SDK Check: Unwrap the Blueprint if it utilizes the InSetuExtension SDK class
                blueprint = ext_module.bp if hasattr(ext_module, 'bp') else ext_module

                if blueprint.name not in app.blueprints:
                    app.register_blueprint(blueprint)
            # Wire up native WebSockets natively via flask-sock if the module provides it
            if getattr(mod, 'sock', None) is not None:
                mod.sock.init_app(app)

            print(f"🔌 Module Mounted Successfully: [{ext}]")
        except Exception as e:
            print(f"⚠️  Unexpected Mount Failure [{ext}]: {type(e).__name__} - {str(e)}")
    # Purge the config cache via decoupled event so the fully-mounted Extension DAG gets a chance to inject
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

    # 2. Sweep Active Extensions
    ext_base = Path(app.root_path).joinpath("extensions")
    for ext in active_exts:
        vendor_file = ext_base.joinpath(ext, "vendor.json")
        if vendor_file.exists() and vendor_file.is_file():
            try:
                with open(vendor_file, "r", encoding="utf-8") as f:
                    ext_imports = json.load(f).get("imports", {})
                for specifier, meta in ext_imports.items():
                    if specifier not in packages or parse_semver(meta.get("version", "0.0.0")) > parse_semver(packages[specifier]["version"]):
                        packages[specifier] = {
                            "version": meta.get("version", "0.0.0"),
                            "resolvedPath": f"/static/extensions/{ext}/{meta.get('path', '')}"
                        }
            except Exception: pass

    return {specifier: meta["resolvedPath"] for specifier, meta in packages.items()}
@app.route('/static/extensions/<ext_name>/<path:filename>')
def serve_extension_static(ext_name, filename):
    """Serves static assets and vendored dependencies directly from an extension directory."""
    if is_core_module(ext_name):
        ext_dir = Path(app.root_path).joinpath("core", ext_name).resolve()
    else:
        ext_dir = Path(app.root_path).joinpath("extensions", ext_name).resolve()

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
    """ADR 0012: Dynamically serve frontend JS from the bundled extension subdirectory."""

    # 1. Try bundled topology
    bundled_path = Path(app.root_path).joinpath("extensions", ext_name, f"ext_{ext_name}.js").as_posix()
    if os.path.exists(bundled_path):
        return send_file(bundled_path, mimetype='application/javascript')

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