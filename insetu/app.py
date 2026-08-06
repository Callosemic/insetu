from pathlib import Path
import os

# Fire Drill: Intercept the boot sequence to test the Lifeboat FS
import os
if os.environ.get("INSETU_SIMULATE_PANIC") == "1" or os.path.exists(".panic_lock"):
    if "INSETU_SIMULATE_PANIC" in os.environ: del os.environ["INSETU_SIMULATE_PANIC"]
    if os.path.exists(".panic_lock"): os.remove(".panic_lock")
    raise SyntaxError("Simulated Kernel Panic (Triggered via UI Fire Drill)")

import io
import random
import datetime
from contextlib import redirect_stdout
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.middleware.proxy_fix import ProxyFix
import insetu.kernel.workers # Initializes the metronome listeners
app = Flask(__name__)

class ForceHTTPSProxyFix(object):
    """WSGI Middleware to force HTTPS scheme when accessed via Tailscale tunnels."""
    def __init__(self, app):
        self.app = app
    def __call__(self, environ, start_response):
        if environ.get('HTTP_X_FORWARDED_PROTO') == 'https' or environ.get('HTTP_HOST', '').endswith('.ts.net'):
            environ['wsgi.url_scheme'] = 'https'
        return self.app(environ, start_response)
app.wsgi_app = ForceHTTPSProxyFix(app.wsgi_app)
from insetu.kernel.auth import auth_bp, security_bp, BOOT_TOKEN
app.register_blueprint(auth_bp)
app.register_blueprint(security_bp.bp)

# Explicitly register system core routes first to prevent dynamic loader misfires
try:
    from insetu.core.routes_system import system_bp
    if 'system' not in app.blueprints:
        app.register_blueprint(system_bp)
    from insetu.core.routes_fs import fs_bp
    if 'fs' not in app.blueprints:
        app.register_blueprint(fs_bp)
except Exception as e:
    print(f"⚠️ Failed to mount core system routes explicitly: {e}")
@app.before_request
def enforce_token_gate():
    """Universal interceptor enforcing token verification on all REST paths."""
    # Always allow core landing, public assets, and the auth route to bypass checks
    # Expose the panic endpoint so the recovery OS button works even if JS crashes before the token handshake
    if request.path in ['/', '/manifest.json', '/sw.js', '/favicon.ico', '/auth/bootstrap', '/api/system/panic', '/recovery'] or request.path.startswith('/static/'):
        return None

    # Check header first, fallback to query parameter for WebSockets
    client_token = request.headers.get('X-InSetu-Token') or request.args.get('token')
    if not client_token or client_token != BOOT_TOKEN:
        return jsonify({"error": "401 Unauthorized: Invalid or missing execution credentials."}), 401
# --- INSETU EXTENSION ARCHITECTURE ROUTINE ---
def load_workspace_extensions():
    from insetu.kernel.utils import load_config, _cwd
    import importlib
    import json
    import os

    raw_extensions = set()

    # 1. Sweep workspaces.json for a Union of all required extensions globally
    index_path = Path(_cwd).joinpath(".insetu", "workspaces.json").as_posix()
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

    # Inject Tier 2 Core Modules into the DAG automatically
    core_dir = Path(__file__).parent.joinpath("core")
    if core_dir.exists() and core_dir.is_dir():
        for item in os.listdir(core_dir):
            if os.path.isdir(core_dir.joinpath(item)) and not item.startswith("__") and item != "sdk":
                raw_extensions.add(item)

    # Resolve Backend Python Dependencies via vendor.json
    resolve_python_vendors(list(raw_extensions))

    # DAG Node Resolution
    modules = {}
    for ext in list(raw_extensions):
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

    def visit(ext):
        if ext in visited: return
        if ext in visiting:
            print(f"⚠️ Circular dependency detected involving [{ext}]. Bypassing.")
            return

        visiting.add(ext)
        mod = modules.get(ext)
        if mod and hasattr(mod, "__depends__"):
            for dep in mod.__depends__:
                if dep in modules:
                    visit(dep)
                else:
                    print(f"⚠️ Extension [{ext}] requires missing dependency [{dep}].")

        visiting.remove(ext)
        visited.add(ext)
        sorted_exts.append(ext)

    for ext in list(modules.keys()):
        if ext not in visited:
            visit(ext)
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
            if hasattr(mod, 'sock'):
                mod.sock.init_app(app)

            print(f"🔌 Module Mounted Successfully: [{ext}]")
        except Exception as e:
            print(f"⚠️  Unexpected Mount Failure [{ext}]: {type(e).__name__} - {str(e)}")
    # Purge the config cache. Because the bootloader called load_config() 
    # to discover extensions, the mutate_workspace_config hook fired into a void.
    # Clearing the cache ensures the fully-mounted Extension DAG gets a chance to inject.
    from insetu.kernel.utils import _MUTATED_CONFIG_CACHE, _MUTATED_CONFIG_MTIME
    _MUTATED_CONFIG_CACHE.clear()
    _MUTATED_CONFIG_MTIME.clear()

import operator
import re

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
    import sys
    import json

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

@app.route('/static/extensions/<ext_name>/<path:filename>')
def serve_extension_static(ext_name, filename):
    """Serves static assets and vendored dependencies directly from an extension directory."""
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
    import os
    from flask import send_file, Response

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
@app.route('/' + 'manifest.json')
def manifest():
    import json
    import os
    from insetu.kernel.utils import load_config

    # Load the base blueprint manifest map
    base_manifest_path = Path(app.static_folder).joinpath(*['manifest', 'json']).as_posix()
    try:
        with open(base_manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
    except Exception:
        manifest_data = {}
    cfg = load_config()
    instance_title = cfg.get("instance_title", "inSetu Developer OS")
    # Inject the instance title cleanly into the PWA footprint
    manifest_data["name"] = instance_title
    manifest_data["short_name"] = instance_title.split()[0] if instance_title else "inSetu"
    # Establish complete PWA isolation using local instance scopes
    pwa_scope = cfg.get("instance_pwa_scope", "default")
    manifest_data["id"] = f"/pwa-{pwa_scope}"
    manifest_data["start_url"] = f"/?node={pwa_scope}"
    from insetu.kernel.utils import get_workspace_physics
    cfg_path, _, _ = get_workspace_physics()
    # Append a cache-busting timestamp query parameter so browsers re-evaluate the custom icons
    ts = int(os.path.getmtime(cfg_path)) if os.path.exists(cfg_path) else 1
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
    import os
    from flask import send_file
    from insetu.kernel.utils import get_workspace_physics

    path = request.path
    if path in ['/static/icon-192.png', '/static/icon-512.png']:
        filename = Path(path).name
        # Anchor to the absolute instance directory to survive os.chdir() hijacking
        cfg_path, _, _ = get_workspace_physics()
        instance_dir = Path(cfg_path).parent.as_posix()
        local_path = Path(instance_dir).joinpath("static", filename).as_posix()
        if os.path.exists(local_path):
            return send_file(local_path, mimetype='image/png')
@app.route('/favicon.ico')
def favicon():
    from insetu.kernel.utils import load_config, get_workspace_physics
    import os
    cfg = load_config()
    custom_icon_name = cfg.get("instance_favicon", "favicon.ico")

    # Anchor to the absolute instance directory to survive os.chdir() hijacking
    cfg_path, _, _ = get_workspace_physics()
    instance_dir = Path(cfg_path).parent.as_posix()
    local_icon_path = Path(instance_dir).joinpath("static", custom_icon_name).as_posix()

    if os.path.exists(local_icon_path):
        mimetype = 'image/png' if local_icon_path.lower().endswith('.png') else 'image/vnd.microsoft.icon'
        return send_file(local_icon_path, mimetype=mimetype)
    return send_file(Path(app.static_folder).joinpath('favicon.ico').as_posix(), mimetype='image/vnd.microsoft.icon')
@app.route('/api/system/panic', methods=['POST'])
def api_system_panic():
    """Hard reboot of the OS process, setting the simulated panic flag."""
    import os
    import threading
    import time
    from flask import jsonify
    
    def crash_and_restart():
        from insetu.kernel.hooks import hooks
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
        <form method="POST" action="/api/system/panic">
            <button type="submit" style="background: #ef4444; color: white; border: none; padding: 15px 30px; font-weight: bold; font-size: 1.2rem; cursor: pointer; border-radius: 4px; margin-top: 20px;">
                Boot Immutable Recovery OS
            </button>
        </form>
    </body>
    </html>
    """
    return html
@app.route('/')
def index():
    from insetu.kernel.utils import load_config
    cfg = load_config()
    instance_title = cfg.get("instance_title", "inSetu Developer OS")
    instance_emoji = cfg.get("instance_emoji", "⚙️")
    extensions = cfg.get("extensions", [])
    return render_template('index.html', title=instance_title, emoji=instance_emoji, extensions=extensions)

# Ignite active workspace feature components JIT at application startup
load_workspace_extensions()
import os
from insetu.kernel.hooks import hooks

# Fire the system boot hook to ignite the worker pools and VFS queues globally
# Guardrail: Prevent the Werkzeug master reloader process from executing background threads
if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
    try:
        hooks.emit('system_boot')
    except Exception as e:
        print(f"Warning: system_boot failed: {e}")

def run_app():
    from insetu.kernel.utils import load_config
    import os

    cfg = load_config()
    if "INSETU_PORT" not in os.environ:
        os.environ["INSETU_PORT"] = str(cfg.get("port", 5005))

    port = int(os.environ["INSETU_PORT"])

    print(f"🚀 Starting inSetu Developer OS (Port {port})...")
    print(f"👉 Open http://127.0.0.1:{port} in your browser")
    app.run(debug=True, port=port)

if __name__ == "__main__":
    run_app()