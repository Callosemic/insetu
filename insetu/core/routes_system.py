from pathlib import Path
import os
import sys
import json
import threading
import time
from flask import Blueprint, request, jsonify
from insetu.kernel.utils import load_config, save_json_file, load_json_file, get_workspace_physics, sniff_tenant_id
import insetu.kernel.utils as utils
from insetu.kernel.hooks import hooks
from insetu.kernel.sync import get_system_deltas
from insetu.kernel.extension import _REGISTERED_SETTINGS_SCHEMAS

_REGISTERED_SETTINGS_SCHEMAS['core_system'] = [
    {
        "id": "port",
        "label": "Daemon Port",
        "type": "number",
        "scope": "daemon",
        "default": 5005,
        "description": "The port the inSetu daemon binds to. Requires reboot to take effect."
    },
    {
        "id": "enable_watchdog",
        "label": "Enable Native Filesystem Watchdog",
        "type": "boolean",
        "scope": "daemon",
        "default": True,
        "description": "Uses the Python watchdog library to detect external out-of-band edits and instantly sync the VFS."
    },
    {
        "id": "preload_all_extensions",
        "label": "Preload All Extensions on Boot",
        "type": "boolean",
        "scope": "daemon",
        "default": False,
        "description": "Aggressively loads all available extensions into RAM during boot, eliminating daemon reboots when activating new extensions later."
    },
    {
        "id": "instance_title",
        "label": "Workspace Title",
        "type": "text",
        "scope": "workspace",
        "default": "inSetu Developer OS",
        "description": "The display title for this workspace."
    },
    {
        "id": "instance_emoji",
        "label": "Menu Emoji",
        "type": "text",
        "scope": "workspace",
        "default": "⚙️",
        "description": "The emoji used in the top-right application menu."
    },
    {
        "id": "offline_cache_limit_mb",
        "label": "Offline Cache Limit (MB)",
        "type": "number",
        "scope": "daemon",
        "default": 250,
        "description": "Maximum IndexedDB storage quota for VFS cache warming."
    }
]
from insetu.kernel.extension import InSetuExtension
@hooks.on('core_system_settings_updated')
def core_system_settings_updated(workspace_id=None, **kwargs):
    # Core OS settings (ports, titles, watchdogs) mandate an environment refresh
    return {"requires_refresh": True}

core_system_ext = InSetuExtension(
    'core_system', __name__,
    title="Core OS",
    description="Core OS daemon and workspace environment configurations.",
    core=True,
    settings_schema=_REGISTERED_SETTINGS_SCHEMAS['core_system']
)

system_bp = Blueprint('system', __name__)

@system_bp.route('/api/system/deltas', methods=['GET'])
@system_bp.route('/api/<workspace_id>/system/deltas', methods=['GET'])
def api_system_deltas(workspace_id=None):
    if not workspace_id:
        workspace_id = sniff_tenant_id()
    since = float(request.args.get('since', 0.0))
    return jsonify(get_system_deltas(workspace_id, since_ts=since))

@hooks.on('pre_file_save')
def handle_config_pre_save(workspace_id=None, filepath=None, content=None, data=None, **kwargs):
    if data and data.get("is_new_repo") and data.get("repo_dir"):
        repo_dir = data.get("repo_dir")
        from insetu.kernel.utils import load_json_file, get_workspace_physics, save_json_file
        from insetu.core.utils_core import sanitize_workspace_config, get_default_repo_template
        cfg_path, _, _ = get_workspace_physics(workspace_id)
        cfg = load_json_file(cfg_path, {})
        cfg = sanitize_workspace_config(cfg)

        targets = cfg.get("target_repos", [])
        if not any(r.get("repo_dir") == repo_dir for r in targets):
            ext_str = data.get("repo_exts", "")
            exts = [e.strip() for e in ext_str.split(",") if e.strip()] if ext_str else None

            new_repo = get_default_repo_template(
                repo_dir=repo_dir,
                title=data.get("repo_title"),
                domain=data.get("repo_domain"),
                description=data.get("repo_desc"),
                exts=exts
            )
            targets.append(new_repo)
            cfg["target_repos"] = targets
            save_json_file(cfg_path, cfg, workspace_id)
def get_system_config(workspace_id):
    data = load_config(workspace_id)
    script_dir = Path(__file__).resolve().parent.as_posix()
    from insetu.kernel.utils import CORE_MODULES
    available_ids = set()
    available = []
    extensions_dir = Path(script_dir).parent.joinpath("extensions").as_posix()
    if os.path.exists(extensions_dir):
            for item in os.listdir(extensions_dir):
                    item_path = Path(extensions_dir).joinpath(item).as_posix()

                    ext_name = None
                    if os.path.isdir(item_path):
                            # Bundled topology (ADR 0012)
                            if os.path.exists(Path(item_path).joinpath(f"engine_{item}.py").as_posix()):
                                    ext_name = item
                    elif item.startswith("engine_") and item.endswith(".py"):
                            # Legacy flat topology
                            ext_name = item.replace("engine_", "").replace(".py", "")
                    if ext_name and ext_name not in CORE_MODULES and ext_name not in available_ids:
                            available_ids.add(ext_name)
                            title = ext_name.replace('_', ' ').title()
                            desc = ""
                            # Extract metadata from the mounted extension
                            import sys
                            err = None
                            mod = sys.modules.get(f"insetu.extensions.{ext_name}.engine_{ext_name}") or \
                                        sys.modules.get(f"insetu.extensions.engine_{ext_name}") or \
                                        sys.modules.get(f"insetu.engine_{ext_name}")

                            if not mod:
                                    import importlib
                                    def safe_import(target):
                                            try:
                                                    return importlib.import_module(target), None
                                            except ModuleNotFoundError as e:
                                                    if e.name == target.split('.')[-1] or e.name == target or (e.name and target.startswith(f"{e.name}.")):
                                                            return None, None
                                                    return None, f"Missing dependency: {e.name}"
                                            except Exception as e:
                                                    return None, str(e)

                                    for target in [
                                            f"insetu.extensions.{ext_name}.engine_{ext_name}",
                                            f"insetu.extensions.engine_{ext_name}",
                                            f"insetu.engine_{ext_name}"
                                    ]:
                                            mod, err = safe_import(target)
                                            if mod or err: break
                            missing_exts = []
                            if err:
                                    title = f"⚠️ {title} (Broken)"
                                    desc = f"Failed to load: {err}"
                            elif mod:
                                    bp_obj = getattr(mod, f"{ext_name}_bp", None)
                                    if bp_obj:
                                            title = getattr(bp_obj, 'title', title)
                                            desc = getattr(bp_obj, 'description', desc)
                                    for dep in getattr(mod, '__external_depends__', []):
                                            import importlib.util
                                            if importlib.util.find_spec(dep) is None:
                                                    missing_exts.append(dep)

                                    missing_bins = []
                                    for binary in getattr(mod, '__external_binaries__', []):
                                            import shutil
                                            if not shutil.which(binary):
                                                    missing_bins.append(binary)
                            available.append({"id": ext_name, "title": title, "description": desc, "missing_externals": missing_exts, "missing_binaries": missing_bins})
    from insetu.kernel.extension import _REGISTERED_SETTINGS_SCHEMAS

    evaluated_schemas = {}
    for ext_id, schema_spec in _REGISTERED_SETTINGS_SCHEMAS.items():
        if callable(schema_spec):
            try: evaluated_schemas[ext_id] = schema_spec(workspace_id)
            except Exception: evaluated_schemas[ext_id] = []
        else:
            evaluated_schemas[ext_id] = schema_spec

    return {
            "config": data,
            "meta": {
                    "available_extensions": sorted(available, key=lambda x: x.get('title') or ""),
                    "settings_schemas": evaluated_schemas
            }
    }
def save_system_config(workspace_id, payload):
    cfg_path, _, _ = get_workspace_physics(workspace_id)
    existing_cfg = load_json_file(cfg_path, {})
    merged_cfg = {**existing_cfg, **payload}

    # Security Guardrail: Enforce the core config UI is never locked out
    if "extensions" in merged_cfg and "config" not in merged_cfg["extensions"]:
        merged_cfg["extensions"].insert(0, "config")
    from insetu.core.utils_core import sanitize_workspace_config

    merged_cfg = sanitize_workspace_config(merged_cfg)
    save_json_file(cfg_path, merged_cfg, workspace_id)

    # Invalidate the mutated config cache so backend physics immediately see changes
    from insetu.kernel.utils import _MUTATED_CONFIG_CACHE, _MUTATED_CONFIG_MTIME
    _MUTATED_CONFIG_CACHE.clear()
    _MUTATED_CONFIG_MTIME.clear()
@system_bp.route('/api/system/reboot', methods=['POST'])
@system_bp.route('/api/<workspace_id>/system/reboot', methods=['POST'])
def api_system_reboot(workspace_id=None):
    """Clean in-place process replacement to restart the OS daemon."""
    import os, sys, threading, time
    def restart():
        from insetu.kernel.hooks import hooks
        try: hooks.emit('system_shutdown')
        except Exception: pass
        time.sleep(0.5)
        python_exe = sys.executable
        os.execv(python_exe, [python_exe] + sys.argv)

    threading.Thread(target=restart, daemon=True).start()
    return jsonify({"status": "success", "message": "Rebooting inSetu OS..."})
@system_bp.route('/api/system/config', methods=['GET', 'POST'])
@system_bp.route('/api/<workspace_id>/system/config', methods=['GET', 'POST'])
def api_system_config(workspace_id=None):
    try:
        if not workspace_id: workspace_id = sniff_tenant_id()
        if request.method == 'GET':
            data = get_system_config(workspace_id)
            return jsonify(data)
        else:
            payload = request.get_json(silent=True) or {}

            from flask import current_app
            requires_reboot = False
            for ext in payload.get("extensions", []):
                if ext != "config" and ext not in current_app.blueprints:
                    requires_reboot = True

            save_system_config(workspace_id, payload)
            return jsonify({
                "status": "success", 
                "message": "Configuration saved successfully.", 
                "requires_reboot": requires_reboot
            })
    except Exception as e:
        import traceback
        print(f"Config Route Error: {traceback.format_exc()}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500
@system_bp.route('/api/system/topology', methods=['GET'])
@system_bp.route('/api/<workspace_id>/system/topology', methods=['GET'])
def api_system_topology(workspace_id=None):
    try:
        if not workspace_id:
            workspace_id = sniff_tenant_id()
        from insetu.core.utils_core import get_sister_repos
        import os
        from pathlib import Path
        cfg = load_config(workspace_id)
        targets = cfg.get("target_repos", []) or []
        cfg_path, ws_root, _ = get_workspace_physics(workspace_id)

        for c in targets:
            if not c: continue
            r_dir = c.get("repo_dir", "")
            for b in (c.get("sub_buckets") or []):
                if b and b.get("dynamic_split_prefix"):
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
            "port": int(os.environ.get("INSETU_PORT", cfg.get("port", 5005))),
            "term_port": cfg.get("term_port", 8181),
            "targets": targets,
            "virtual_contexts": cfg.get("virtual_contexts", []),
            "category_order": cfg.get("category_order", []),
            "tab_order": cfg.get("tab_order", ["context", "edit", "tasks", "ctrl", "library"]),
            "hidden_outputs": cfg.get("hidden_outputs", ["context_prompt.md", "context_prompt_diffs.txt"]),
            "config_missing": not os.path.exists(cfg_path)
        })
    except Exception as e:
        import traceback
        print(f"Topology Route Error: {traceback.format_exc()}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500
@system_bp.route('/api/system/manifest', methods=['GET'])
@system_bp.route('/api/<workspace_id>/system/manifest', methods=['GET'])
def api_system_manifest(workspace_id=None):
    if not workspace_id:
        workspace_id = sniff_tenant_id()
    headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
    }
    ctx_manifest = next((m for m in hooks.emit('request_manifest', workspace_id=workspace_id) if m), {})
    vfs_manifest = next((m for m in hooks.emit('request_vfs_manifest', workspace_id=workspace_id) if m), {})

    return jsonify({"vfs": vfs_manifest, "ctx": ctx_manifest}), 200, headers
@system_bp.route('/api/system/workspaces/create', methods=['POST'])
def api_create_workspace():
    try:
        data = request.json or {}
        ws_id = data.get('id', '').strip().lower()
        if not ws_id or ws_id in ['default', 'none']:
            return jsonify({"error": "A unique, valid alphanumeric workspace ID is required"}), 400
        index_path = Path(utils._cwd).joinpath(".insetu", "system.json").as_posix()
        from insetu.kernel.utils import load_json_file, save_json_file

        w_data = load_json_file(index_path, {"workspaces": {"default": {"config_path": "config.json"}}})
        if "workspaces" not in w_data:
            w_data["workspaces"] = {"default": {"config_path": "config.json"}}

        if ws_id in w_data.get("workspaces", {}):
            return jsonify({"error": f"Workspace '{ws_id}' already exists"}), 400
        custom_root = data.get('workspace_root', '').strip()
        if not custom_root:
            return jsonify({"error": "Workspace Root Directory Path is strictly required to ensure absolute codebase isolation."}), 400
        resolved_root = os.path.abspath(os.path.expanduser(custom_root))

        ws_insetu_dir = Path(resolved_root).joinpath(".insetu")
        os.makedirs(ws_insetu_dir.joinpath("data").as_posix(), exist_ok=True)
        config_abs_path = ws_insetu_dir.joinpath("config.json").as_posix()
        config_rel_path = config_abs_path
        starter_config = {
            "workspace_root": resolved_root,
            "extensions": ["config"],
            "ignore_dirs": ["node_modules", "__pycache__", "venv", ".git", ".insetu"]
        }
        os.makedirs(starter_config["workspace_root"], exist_ok=True)

        # 1. Register workspace in system.json FIRST to satisfy get_workspace_physics bounds checking
        if "workspaces" not in w_data:
            w_data["workspaces"] = {}
        w_data["workspaces"][ws_id] = {"title": ws_id.title(), "config_path": config_rel_path}

        # Use save_json_file to ensure _JSON_CACHE is updated synchronously for immediate reads
        save_json_file(index_path, w_data, workspace_id="default")

        # 2. Save the pure topology mapping
        save_json_file(config_abs_path, starter_config, workspace_id=ws_id)

        # 3. Seed the Tier 2 Workspace Settings safely
        from insetu.kernel.extension import SettingsManager
        settings = SettingsManager('core_system', ws_id)
        settings.set("instance_title", f"inSetu Workspace: {ws_id}")

        return jsonify({"status": "success", "workspaces": w_data["workspaces"]})
    except Exception as e:
        import traceback
        print(f"Workspace Create Error: {traceback.format_exc()}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500
@system_bp.route('/api/system/workspaces/delete', methods=['POST'])
def api_delete_workspace():
    try:
        data = request.json or {}
        ws_id = data.get('id', '').strip().lower()
        if ws_id == 'default':
            return jsonify({"error": "The root system default workspace framework cannot be deleted."}), 400
        index_path = Path(utils._cwd).joinpath(".insetu", "system.json").as_posix()
        from insetu.kernel.utils import load_json_file, save_json_file

        w_data = load_json_file(index_path, {"workspaces": {"default": {"config_path": "config.json"}}})
        if "workspaces" not in w_data:
            w_data["workspaces"] = {"default": {"config_path": "config.json"}}

        if ws_id not in w_data.get("workspaces", {}):
            return jsonify({"error": "Target workspace not found."}), 404
        del w_data["workspaces"][ws_id]
        hooks.emit('workspace_shutdown', workspace_id=ws_id)
        local_insetu_dir = Path(utils._cwd).joinpath(".insetu").as_posix()
        ws_dir = Path(local_insetu_dir).joinpath("workspaces", ws_id)
        if os.path.exists(ws_dir.as_posix()):
            from insetu.kernel.vfs import execute_vfs_delete
            execute_vfs_delete("default", ws_dir.as_posix())

        save_json_file(index_path, w_data, workspace_id="default")

        return jsonify({"status": "success", "workspaces": w_data["workspaces"]})
    except Exception as e:
        import traceback
        print(f"Workspace Delete Error: {traceback.format_exc()}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500

@system_bp.route('/api/system/jobs/<job_id>', methods=['GET'])
def api_job_status(job_id):
    workspace_id = sniff_tenant_id()
    from insetu.kernel.db import get_connection
    try:
        conn = get_connection("workers", workspace_id=workspace_id)
        job = conn.execute("SELECT status, status_message, artifact_json, created_at, updated_at FROM immediate_jobs WHERE id=?", (job_id,)).fetchone()
        if not job:
            return jsonify({"error": "Job not found in active workspace context."}), 404

        return jsonify({
            "id": job_id,
            "status": job['status'],
            "message": job['status_message'],
            "artifact": json.loads(job['artifact_json']) if job['artifact_json'] else {},
            "created_at": job['created_at'],
            "updated_at": job['updated_at']
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@system_bp.route('/api/system/workspaces', methods=['GET', 'POST'])
def api_workspaces():
    index_path = Path(utils._cwd).joinpath(".insetu", "system.json").as_posix()

    if request.method == 'GET':
        data = utils.load_json_file(index_path, {})
        if "workspaces" not in data:
            data["workspaces"] = {"default": {"config_path": "config.json"}}
        return jsonify(data)
    if request.method == 'POST':
        data = request.json or {}
        new_active = data.get("active_workspace") or data.get("workspace_id")
        old_active = sniff_tenant_id()
        if not os.path.exists(index_path):
            return jsonify({"error": "system.json not found."}), 404
        w_data = utils.load_json_file(index_path, {})
        if new_active not in w_data.get("workspaces", {}) and new_active != "default":
            return jsonify({"error": "Workspace ID not found."}), 400

        if old_active and old_active != new_active:
            hooks.emit('workspace_shutdown', workspace_id=old_active)

        # Stateless UDF: Session state managed by client
    return jsonify({"status": "success", "message": f"Validated workspace {new_active}"})
@system_bp.route('/api/system/config/test_bucketing', methods=['POST'])
@system_bp.route('/api/<workspace_id>/system/config/test_bucketing', methods=['POST'])
def api_system_config_test_bucketing(workspace_id=None):
    try:
        if not workspace_id: workspace_id = sniff_tenant_id()
        data = request.get_json(silent=True) or {}
        repo_cfg = data.get("repo_cfg", {})

        from insetu.kernel.utils import get_workspace_physics
        cfg_path, ws_root, _ = get_workspace_physics(workspace_id)
        repo_dir = repo_cfg.get("repo_dir")
        if not repo_dir:
            return jsonify({"error": "repo_dir missing"}), 400

        physical_path = repo_cfg.get("physical_path")
        repo_path = Path(physical_path).expanduser().resolve() if physical_path else Path(ws_root).joinpath(repo_dir).resolve()

        if not repo_path.exists():
            return jsonify({"error": f"Path not found: {repo_path}"}), 404

        from insetu.core.topology.engine_topology import get_valid_workspace_files, resolve_file_bucket
        valid_files = get_valid_workspace_files(repo_path.as_posix(), repo_cfg, workspace_id)

        sub_buckets = repo_cfg.get("sub_buckets", [])
        buckets_map = {}

        for f in valid_files:
            b, module = resolve_file_bucket(f, sub_buckets, repo_dir=repo_dir)
            bucket_id = module if (b and module) else (b.get("id") if b else "main")

            if bucket_id not in buckets_map:
                buckets_map[bucket_id] = []
            buckets_map[bucket_id].append(f)

        return jsonify({"status": "success", "buckets": buckets_map})
    except Exception as e:
        import traceback
        print(f"Bucketing Test Error: {traceback.format_exc()}")
        return jsonify({"error": f"Server Error: {str(e)}"}), 500

@system_bp.route('/api/system/fs/list_local', methods=['GET'])
def api_list_local_host_dirs():
    """Stateless directory explorer that reads absolute host paths for workspace mounts."""
    target = request.args.get('path', '').strip()
    if not target:
        target = os.path.expanduser('~')
    else:
        target = os.path.abspath(os.path.expanduser(target))

    if not os.path.exists(target) or not os.path.isdir(target):
        target = os.path.expanduser('~')

    try:
        dirs = []
        for item in sorted(os.listdir(target)):
            if item.startswith('.') and item != '.insetu':
                continue
            if os.path.isdir(Path(target).joinpath(item).as_posix()):
                dirs.append(item)
        return jsonify({"current": target, "dirs": dirs})
    except Exception as e:
        return jsonify({"current": target, "dirs": [], "error": str(e)}), 500