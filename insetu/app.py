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
                # ADR 0012: Bundled Subdirectory Extraction
                modules[ext] = importlib.import_module(f"insetu.extensions.{ext}.engine_{ext}")
            except ImportError:
                try:
                    # Legacy flat topology
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

            # Wire up native WebSockets natively via flask-sock if the extension provides it
            if hasattr(ext_module, 'sock'):
                ext_module.sock.init_app(app)

            print(f"🔌 Extension Mounted Successfully: [engine_{ext}]")
        except AttributeError as e:
            print(f"⚠️  Blueprint Mount Failed [{ext}]: {str(e)}")

    # Purge the config cache. Because the bootloader called load_config() 
    # to discover extensions, the mutate_workspace_config hook fired into a void.
    # Clearing the cache ensures the fully-mounted Extension DAG gets a chance to inject.
    from insetu.utils_core import _MUTATED_CONFIG_CACHE, _MUTATED_CONFIG_MTIME
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
import json
from flask import Response
from insetu.workers import submit_immediate_job, update_immediate_job_status, register_callback
import threading
_COMPILER_LOCKS = {}
_COMPILER_GLOBAL_LOCK = threading.Lock()

def get_compiler_lock(wid):
    with _COMPILER_GLOBAL_LOCK:
        if wid not in _COMPILER_LOCKS:
            _COMPILER_LOCKS[wid] = threading.RLock()
        return _COMPILER_LOCKS[wid]
def _background_compile(job_id, workspace_id, force_full=False, **kwargs):
    ws_lock = get_compiler_lock(workspace_id)
    try:
        ws_lock.acquire()
        import insetu.engine_gather as engine_gather
        from insetu.utils_core import get_gather_paths, load_json_file, get_workspace_physics, load_config
        from pathlib import Path
        import os
        import subprocess

        paths = get_gather_paths(workspace_id)
        manifest_path = Path(paths["contexts_dir"]).joinpath("manifest.json").as_posix()
        manifest_data = load_json_file(manifest_path, {})

        forced_repos = []
        if isinstance(force_full, list):
            forced_repos = force_full
            needs_full_compile = False
        else:
            needs_full_compile = force_full or not manifest_data

        update_immediate_job_status(job_id, 'processing', "Running pre-compile hooks...", workspace_id=workspace_id)
        try:
            from insetu.hooks import hooks
            hooks.emit('pre_compile', workspace_id=workspace_id, is_full_sweep=needs_full_compile, forced_repos=forced_repos)
            from insetu.routes_fs import _VFS_WRITE_QUEUE
            _VFS_WRITE_QUEUE.join()
        except Exception as e:
            print(f"Warning: Pre-compile hooks failed: {str(e)}")

        if not needs_full_compile and not forced_repos:
            try:
                live_cfg = load_config(workspace_id)
                ledger_events = kwargs.get('ledger_events')

                # Proactive Ledger Flush: If manual UI refresh, grab any pending VFS mutations instantly
                if ledger_events is None:
                    from insetu.db import get_connection
                    db_conn = get_connection("workers", workspace_id=workspace_id)
                    try:
                        events = db_conn.execute("SELECT filepath, mutation_type FROM vfs_event_log").fetchall()
                    except Exception:
                        events = []

                    if events:
                        ledger_events = [{"filepath": e["filepath"], "mutation_type": e["mutation_type"]} for e in events]
                        db_conn.execute("DELETE FROM vfs_event_log")
                        db_conn.commit()

                        # Trigger cartographer instantly before compiling
                        touched_repos = list(set(e["filepath"].split('/')[0] for e in ledger_events if '/' in e["filepath"]))
                        if touched_repos:
                            from insetu.cartographer import map_repositories
                            try: map_repositories(workspace_id=workspace_id, target_repos=touched_repos)
                            except Exception: pass
                if ledger_events:
                    # Phase 3: Pure Event Sourced Differential Routing
                    changed_files = [e["filepath"] for e in ledger_events]
                    from insetu.engine_gather import resolve_file_bucket

                    touched_buckets = set()

                    for repo_cfg in live_cfg.get("target_repos", []):
                        if repo_cfg.get("exclude_from_context"): continue
                        repo_dir = repo_cfg.get("repo_dir")
                        subs = repo_cfg.get("sub_buckets", [])

                        repo_files = [f for f in changed_files if f.startswith(f"{repo_dir}/")]
                        for f in repo_files:
                            rel_path = f[len(repo_dir)+1:]
                            if subs:
                                b, module = resolve_file_bucket(rel_path, subs)
                                if b and module: touched_buckets.add(f"{repo_dir}__{module}")
                                elif b: touched_buckets.add(f"{repo_dir}__{b.get('id')}")
                                else: touched_buckets.add(f"{repo_dir}__catch_all")
                            else:
                                touched_buckets.add(f"{repo_dir}__main")

                    update_immediate_job_status(job_id, 'processing', f"Surgically compiling {len(touched_buckets)} touched bucket(s)...", workspace_id=workspace_id)
                    engine_gather._surgically_update_manifest(workspace_id=workspace_id, files=changed_files)
                else:
                    update_immediate_job_status(job_id, 'processing', "No pending changes. Syncing extensions...", workspace_id=workspace_id)
                    all_repo_dirs = [r.get("repo_dir") for r in live_cfg.get("target_repos", []) if not r.get("exclude_from_context")]
                    from insetu.hooks import hooks
                    hooks.emit('compile_contexts', manifest=manifest_data, workspace_id=workspace_id, target_repos=all_repo_dirs, touched_buckets=[], is_full_sweep=False)
                    from insetu.utils_core import save_json_file
                    save_json_file(manifest_path, manifest_data, workspace_id)
            except Exception as e:
                import traceback
                print(f"Warning: Differential compile failed, falling back to full sweep: {e}\n{traceback.format_exc()}")
                needs_full_compile = True
        if needs_full_compile or forced_repos:
            update_immediate_job_status(job_id, 'processing', "Mapping repositories (Cartographer)...", workspace_id=workspace_id)
            try:
                from insetu.cartographer import map_repositories
                map_repositories(workspace_id, target_repos=None if needs_full_compile else forced_repos)
            except Exception: pass

            sweep_label = "Full Sweep" if needs_full_compile else f"Targeted Sweep: {forced_repos}"
            update_immediate_job_status(job_id, 'processing', f"Compiling context payloads ({sweep_label})...", workspace_id=workspace_id)
            engine_gather.generate_context_file(workspace_id, target_repos=None if needs_full_compile else forced_repos)

        manifest_data = load_json_file(manifest_path, {})
        manifest_keys = list(manifest_data.keys())
        if not manifest_keys and os.path.exists(paths["contexts_dir"]):
            manifest_keys = [f for f in os.listdir(paths["contexts_dir"]) if f.endswith('.txt')]

        update_immediate_job_status(job_id, 'completed', "Context successfully synchronized!", artifact={"files": sorted(manifest_keys)}, workspace_id=workspace_id)
    except Exception as e:
        import traceback
        print(f"CRITICAL COMPILER ERROR:\n{traceback.format_exc()}")
        update_immediate_job_status(job_id, 'failed', f"Compilation Error: {str(e)}", workspace_id=workspace_id)
    finally:
        ws_lock.release()

register_callback("gather", "compile_contexts", _background_compile)
@app.route('/submit', methods=['POST'])
def submit():
    from insetu.utils_core import sniff_tenant_id
    workspace_id = sniff_tenant_id()
    from insetu.utils_core import get_gather_paths
    paths = get_gather_paths(workspace_id)
    data = request.json or {}
    force_full = data.get("force_full", False)

    from insetu.db import get_connection
    conn = get_connection("workers", workspace_id=workspace_id)
    existing_job = conn.execute(
        "SELECT id FROM immediate_jobs WHERE ext_name='gather' AND callback_name='compile_contexts' AND status IN ('pending', 'processing')"
    ).fetchone()

    if existing_job:
        return jsonify({"status": "accepted", "job_id": existing_job['id'], "message": "Reattached to existing compilation."}), 202

    import uuid
    import json
    job_id = f"cmp_{uuid.uuid4().hex[:8]}"
    args_json = json.dumps({"force_full": force_full})
    submit_immediate_job(job_id, "gather", "compile_contexts", args_json, workspace_id=workspace_id)

    return jsonify({"status": "accepted", "job_id": job_id}), 202
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