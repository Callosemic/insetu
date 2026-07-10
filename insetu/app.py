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
from insetu.utils_core import resolve_workspace_path, get_sister_repos
from insetu.engine_bridge import parse_blocks, apply_block_in_memory
import insetu.engine_gather as engine_gather
import insetu.workers # Initializes the metronome listeners
import insetu.cartographer # Registers Event Bus hooks
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
from insetu.routes_bridge import bridge_bp
from insetu.routes_system import system_bp
from insetu.engine_gather import gather_bp
app.register_blueprint(fs_bp)
app.register_blueprint(bridge_bp.bp if hasattr(bridge_bp, 'bp') else bridge_bp)
app.register_blueprint(system_bp)
app.register_blueprint(gather_bp.bp if hasattr(gather_bp, 'bp') else gather_bp)
# --- INSETU EXTENSION ARCHITECTURE ROUTINE ---
def load_workspace_extensions():
    from insetu.utils_core import load_config, _cwd
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
    # DAG Node Resolution
    modules = {}
    for ext in list(raw_extensions):
        if ext == "config": continue # Pure frontend UI extension
        try:
            # Try the extensions folder first, fallback to core chassis
            try:
                modules[ext] = importlib.import_module(f"insetu.extensions.engine_{ext}")
            except ImportError:
                modules[ext] = importlib.import_module(f"insetu.engine_{ext}")
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
            print(f"🔌 Extension Mounted Successfully: [engine_{ext}]")
        except AttributeError as e:
            print(f"⚠️  Blueprint Mount Failed [{ext}]: {str(e)}")

# Ignite active workspace feature components JIT at application startup
load_workspace_extensions()

@app.route('/sw.js')
def sw():
    return send_file(Path(app.static_folder).joinpath('sw.js').as_posix(), mimetype='application/javascript')
@app.route('/manifest.json')
def manifest():
    import json
    import os
    from insetu.utils_core import load_config

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
    manifest_data["short_name"] = instance_title.split()[0] if instance_title else "Axoneme"

    # Establish complete PWA isolation using local instance scopes
    pwa_scope = cfg.get("instance_pwa_scope", "default")
    manifest_data["id"] = f"/pwa-{pwa_scope}"
    manifest_data["start_url"] = f"/?node={pwa_scope}"
    from insetu.utils_core import get_workspace_physics
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
    from insetu.utils_core import get_workspace_physics

    path = request.path
    if path in ['/static/icon-192.png', '/static/icon-512.png']:
        filename = os.path.basename(path)
        # Anchor to the absolute instance directory to survive os.chdir() hijacking
        cfg_path, _, _ = get_workspace_physics()
        instance_dir = os.path.dirname(cfg_path)
        local_path = Path(instance_dir).joinpath("static", filename).as_posix()
        if os.path.exists(local_path):
            return send_file(local_path, mimetype='image/png')
@app.route('/favicon.ico')
def favicon():
    from insetu.utils_core import load_config, get_workspace_physics
    import os
    cfg = load_config()
    custom_icon_name = cfg.get("instance_favicon", "favicon.ico")

    # Anchor to the absolute instance directory to survive os.chdir() hijacking
    cfg_path, _, _ = get_workspace_physics()
    instance_dir = os.path.dirname(cfg_path)
    local_icon_path = Path(instance_dir).joinpath("static", custom_icon_name).as_posix()

    if os.path.exists(local_icon_path):
        mimetype = 'image/png' if local_icon_path.lower().endswith('.png') else 'image/vnd.microsoft.icon'
        return send_file(local_icon_path, mimetype=mimetype)
    return send_file(Path(app.static_folder).joinpath('favicon.ico').as_posix(), mimetype='image/vnd.microsoft.icon')
@app.route('/api/<workspace_id>/repos', methods=['GET'])
def api_repos(workspace_id):
    from insetu.utils_core import get_sister_repos, load_config, get_workspace_physics
    import os
    cfg = load_config(workspace_id)
    targets = cfg.get("target_repos", [])
    cfg_path, ws_root, _ = get_workspace_physics()

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
        "repos": get_sister_repos(),
        "term_port": cfg.get("term_port", 8181),
        "targets": targets,
        "virtual_contexts": cfg.get("virtual_contexts", []),
        "category_order": cfg.get("category_order", []),
        "tab_order": cfg.get("tab_order", ["context", "edit", "tasks", "research", "term"]),
        "hidden_outputs": cfg.get("hidden_outputs", ["context_prompt.md", "context_prompt_diffs.txt"]),
        "config_missing": not os.path.exists(cfg_path)
    })
@app.route('/')
def index():
    from insetu.utils_core import load_config
    cfg = load_config()
    instance_title = cfg.get("instance_title", "inSetu Developer OS")
    instance_emoji = cfg.get("instance_emoji", "⚙️")
    extensions = cfg.get("extensions", [])
    return render_template('index.html', title=instance_title, emoji=instance_emoji, extensions=extensions)
import threading
import queue
import json
from flask import Response
_COMPILER_LOCKS = {}
_COMPILER_GLOBAL_LOCK = threading.Lock()

def get_compiler_lock(wid):
    with _COMPILER_GLOBAL_LOCK:
        if wid not in _COMPILER_LOCKS:
            _COMPILER_LOCKS[wid] = threading.Lock()
        return _COMPILER_LOCKS[wid]
@app.route('/submit', methods=['POST'])
def submit():
    from insetu.utils_core import sniff_tenant_id
    workspace_id = sniff_tenant_id()
    from insetu.utils_core import get_gather_paths
    paths = get_gather_paths(workspace_id)

    ws_lock = get_compiler_lock(workspace_id)
    if not ws_lock.acquire(blocking=False):
        existing_files = [f for f in os.listdir(paths["contexts_dir"]) if f.endswith('.txt')] if os.path.exists(paths["contexts_dir"]) else []
        return jsonify({"status": "success", "message": "Compilation locked. Serving cached context.", "files": sorted(existing_files)})
    def generate():
        q = queue.Queue()

        def compile_worker(wid):
            try:
                q.put({"status": "progress", "message": "Running pre-compile hooks..."})
                try:
                    from insetu.hooks import hooks
                    hooks.emit('pre_compile', workspace_id=wid)
                except Exception as e:
                    print(f"Warning: Pre-compile hooks failed: {str(e)}")

                q.put({"status": "progress", "message": "Mapping repositories (Cartographer)..."})

                try:
                    from insetu.cartographer import map_repositories
                    map_repositories(wid)
                except Exception as e:
                    print(f"Warning: Cartographer failed: {str(e)}")
                q.put({"status": "progress", "message": "Compiling context payloads..."})
                engine_gather.generate_context_file(wid)
                manifest_path = Path(paths["contexts_dir"]).joinpath("manifest.json").as_posix()

                from insetu.utils_core import load_json_file
                manifest_data = load_json_file(manifest_path, {})
                manifest_keys = list(manifest_data.keys())

                if not manifest_keys and os.path.exists(paths["contexts_dir"]):
                    manifest_keys = [f for f in os.listdir(paths["contexts_dir"]) if f.endswith('.txt')]

                q.put({"status": "success", "message": "Context successfully compiled!", "files": sorted(manifest_keys)})
            except Exception as e:
                import traceback
                print(f"CRITICAL COMPILER ERROR:\n{traceback.format_exc()}")
                q.put({"status": "error", "message": f"Compilation Error: {str(e)}", "files": []})
            finally:
                q.put(None) # End of stream
                ws_lock.release()
        threading.Thread(target=compile_worker, args=(workspace_id,), daemon=True).start()

        while True:
            msg = q.get()
            if msg is None:
                break
            yield json.dumps(msg) + "\n"

    return Response(generate(), mimetype='application/x-ndjson')
@app.route('/api/<workspace_id>/manifest', methods=['GET'])
def api_manifest(workspace_id):
    from insetu.utils_core import get_gather_paths
    paths = get_gather_paths(workspace_id)
    manifest_path = Path(paths["contexts_dir"]).joinpath("manifest.json").as_posix()
    headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
    if os.path.exists(manifest_path):
        with open(manifest_path, 'r', encoding='utf-8') as f: 
            return f.read(), 200, headers
    return jsonify({}), 200, headers
@app.route('/download/<path:filename>')
def download_file(filename):
    from insetu.utils_core import sniff_tenant_id
    workspace_id = sniff_tenant_id()
    from insetu.utils_core import get_gather_paths
    paths = get_gather_paths(workspace_id)

    # Strip the arbitrary prefix to prevent double-nesting (e.g. prompts/prompts/file.md)
    safe_basename = os.path.basename(filename)
    search_paths = [Path(d).joinpath(safe_basename).as_posix() for d in [paths["contexts_dir"], paths["prompts_dir"], paths["diffs_dir"], paths["gather_dir"]]]
    file_path = next((p for p in search_paths if os.path.exists(p)), None)
    # Fallback to resolving against the workspace root for media-vault files
    if not file_path:
        from insetu.utils_core import resolve_workspace_path
        resolved = resolve_workspace_path(filename, workspace_id)
        if os.path.exists(resolved): file_path = resolved

    if not file_path: return jsonify({"error": "File not found"}), 404
    base, ext = os.path.splitext(filename)
    dl_name = f"{base}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}{ext}"

    # If explicitly requested as inline view, let the browser handle the mime type natively
    if request.args.get('inline') == '1':
        return send_file(file_path, as_attachment=False)

    return send_file(file_path, as_attachment=True, download_name=dl_name, mimetype='application/octet-stream')

def run_app():
    from insetu.utils_core import load_config
    from insetu.hooks import hooks
    import os
    
    # Ignite OS Substrates
    hooks.emit('system_boot')
    
    cfg = load_config()
    # Lock the port on initial boot so it survives os.execv workspace swaps
    if "INSETU_PORT" not in os.environ:
        os.environ["INSETU_PORT"] = str(cfg.get("port", 5005))

    port = int(os.environ["INSETU_PORT"])

    print(f"🚀 Starting inSetu Developer OS (Port {port})...")
    print(f"👉 Open http://127.0.0.1:{port} in your browser")
    app.run(debug=True, port=port)

if __name__ == "__main__":
    run_app()