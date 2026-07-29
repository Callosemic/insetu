from pathlib import Path
import os

# Fire Drill: Intercept the boot sequence to test the Lifeboat FS
if os.environ.get("INSETU_SIMULATE_PANIC") == "1":
    del os.environ["INSETU_SIMULATE_PANIC"] # Clear flag to prevent a permanent boot loop
    raise SyntaxError("Simulated Kernel Panic (Triggered via UI Fire Drill)")

import io
import random
import datetime
from contextlib import redirect_stdout
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.middleware.proxy_fix import ProxyFix
from insetu.core.utils_core import get_sister_repos
import insetu.workers # Initializes the metronome listeners
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
from insetu.routes_fs import fs_bp
from insetu.routes_system import system_bp
from insetu.auth import auth_bp, BOOT_TOKEN

app.register_blueprint(fs_bp)
app.register_blueprint(system_bp)
app.register_blueprint(auth_bp)
@app.before_request
def enforce_token_gate():
    """Universal interceptor enforcing token verification on all REST paths."""
    # Always allow core landing, public assets, and the auth route to bypass checks
    # Expose the panic endpoint so the recovery OS button works even if JS crashes before the token handshake
    if request.path in ['/', '/manifest.json', '/sw.js', '/favicon.ico', '/auth/bootstrap', '/api/system/panic'] or request.path.startswith('/static/'):
        return None

    # Check header first, fallback to query parameter for WebSockets
    client_token = request.headers.get('X-InSetu-Token') or request.args.get('token')
    if not client_token or client_token != BOOT_TOKEN:
        return jsonify({"error": "401 Unauthorized: Invalid or missing execution credentials."}), 401
# --- INSETU EXTENSION ARCHITECTURE ROUTINE ---
def load_workspace_extensions():
    from insetu.utils import load_config, _cwd
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

    # Treat Tier 2 OS engines as implicit system extensions
    raw_extensions.update(["bridge", "gather", "cartographer"])

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
            ext_module = getattr(modules[ext], f"{ext}_bp")
            # SDK Check: Unwrap the Blueprint if it utilizes the InSetuExtension SDK class
            blueprint = ext_module.bp if hasattr(ext_module, 'bp') else ext_module

            app.register_blueprint(blueprint)

            # Wire up native WebSockets natively via flask-sock if the extension provides it
            if hasattr(ext_module, 'sock'):
                ext_module.sock.init_app(app)

            print(f"🔌 Extension Mounted Successfully: [engine_{ext}]")
        except AttributeError as e:
            print(f"⚠️  Blueprint Mount Failed [{ext}]: {str(e)}")

    # Purge the config cache. Because the bootloader called load_config() 
    # to discover extensions, the mutate_workspace_config hook fired into a void.
    # Clearing the cache ensures the fully-mounted Extension DAG gets a chance to inject.
    from insetu.utils import _MUTATED_CONFIG_CACHE, _MUTATED_CONFIG_MTIME
    _MUTATED_CONFIG_CACHE.clear()
    _MUTATED_CONFIG_MTIME.clear()

# Ignite active workspace feature components JIT at application startup
load_workspace_extensions()

@app.route('/static/js/extensions/ext_<ext_name>.js')
def serve_extension_js(ext_name):
    """ADR 0012: Dynamically serve frontend JS from the bundled extension subdirectory."""
    import os
    from flask import send_file

    # 1. Try bundled topology
    bundled_path = Path(app.root_path).joinpath("extensions", ext_name, f"ext_{ext_name}.js").as_posix()
    if os.path.exists(bundled_path):
        return send_file(bundled_path, mimetype='application/javascript')

    # 2. Fallback to legacy flat topology
    legacy_path = Path(app.static_folder).joinpath("js", "extensions", f"ext_{ext_name}.js").as_posix()
    if os.path.exists(legacy_path):
        return send_file(legacy_path, mimetype='application/javascript')

    return "Extension UI not found", 404

@app.route('/sw.js')
def sw():
    return send_file(Path(app.static_folder).joinpath('sw.js').as_posix(), mimetype='application/javascript')
@app.route('/manifest.json')
def manifest():
    import json
    import os
    from insetu.utils import load_config

    # Load the base blueprint manifest map
    base_manifest_path = Path(app.static_folder).joinpath('manifest.json').as_posix()
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
    from insetu.utils import get_workspace_physics
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
    from insetu.utils import get_workspace_physics

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
    from insetu.utils import load_config, get_workspace_physics
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
@app.route('/api/<workspace_id>/repos', methods=['GET'])
def api_repos(workspace_id):
    from insetu.core.utils_core import get_sister_repos
    from insetu.utils import load_config, get_workspace_physics
    import os
    cfg = load_config(workspace_id)
    targets = cfg.get("target_repos", [])
    cfg_path, ws_root, _ = get_workspace_physics(workspace_id)

    # Dynamically inject discovered directories into meta_map for the frontend
    for c in targets:
        r_dir = c.get("repo_dir", "")
        for b in c.get("sub_buckets", []):
            if b.get("dynamic_split_prefix"):
                if "meta_map" not in b:
                    b["meta_map"] = {}
                dyn_dir = Path(ws_root).joinpath(r_dir, b["dynamic_split_prefix"]).as_posix()
                if os.path.exists(dyn_dir):
                    for module in os.listdir(dyn_dir):
                        if os.path.isdir(Path(dyn_dir).joinpath(module).as_posix()) and not module.startswith('.'):
                            if module not in b["meta_map"]:
                                b["meta_map"][module] = {"title": module.replace('_', ' ').title()}
    return jsonify({
        "repos": get_sister_repos(workspace_id),
        "term_port": cfg.get("term_port", 8181),
        "targets": targets,
        "virtual_contexts": cfg.get("virtual_contexts", []),
        "category_order": cfg.get("category_order", []),
        "tab_order": cfg.get("tab_order", ["context", "edit", "tasks", "ctrl", "library"]),
        "hidden_outputs": cfg.get("hidden_outputs", ["context_prompt.md", "context_prompt_diffs.txt"]),
        "config_missing": not os.path.exists(cfg_path)
    })

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
    from insetu.utils import load_config
    cfg = load_config()
    instance_title = cfg.get("instance_title", "inSetu Developer OS")
    instance_emoji = cfg.get("instance_emoji", "⚙️")
    extensions = cfg.get("extensions", [])
    return render_template('index.html', title=instance_title, emoji=instance_emoji, extensions=extensions)

def run_app():
    from insetu.utils import load_config
    from insetu.hooks import hooks
    import os

    cfg = load_config()
    # Lock the port on initial boot so it survives os.execv workspace swaps
    if "INSETU_PORT" not in os.environ:
        os.environ["INSETU_PORT"] = str(cfg.get("port", 5005))

    port = int(os.environ["INSETU_PORT"])

    # Guardrail: If Flask debug reloader is active, only emit system_boot inside the active worker child.
    # This prevents background terminals/daemons from binding to the master file-monitor process.
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
        hooks.emit('system_boot')

    print(f"🚀 Starting inSetu Developer OS (Port {port})...")
    print(f"👉 Open http://127.0.0.1:{port} in your browser")
    app.run(debug=True, port=port)

if __name__ == "__main__":
    run_app()