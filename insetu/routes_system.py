from pathlib import Path
import os
import sys
import json
import threading
import time
from flask import Blueprint, request, jsonify
from insetu.utils import load_config, save_json_file, get_workspace_physics, sniff_tenant_id
import insetu.utils as utils
from insetu.hooks import hooks

system_bp = Blueprint('system', __name__)

@hooks.on('pre_file_save')
def handle_config_pre_save(workspace_id=None, filepath=None, content=None, data=None, **kwargs):
    if data and data.get("is_new_repo") and data.get("repo_dir"):
        repo_dir = data.get("repo_dir")
        from insetu.utils import load_json_file, get_workspace_physics, save_json_file
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

@system_bp.route('/api/system/panic', methods=['POST'])
def api_system_panic():
    """Injects a poison pill into the environment and restarts the daemon."""
    def crash_and_restart():
        from insetu.hooks import hooks
        hooks.emit('system_shutdown')
        time.sleep(1.0)
        os.environ["INSETU_SIMULATE_PANIC"] = "1"
        python_exe = sys.executable

        cli_script = os.path.abspath(sys.argv[0])
        os.execv(python_exe, [python_exe, cli_script] + sys.argv[1:])

    threading.Thread(target=crash_and_restart, daemon=True).start()
    return jsonify({"status": "success", "message": "Initiating kernel panic..."})

@system_bp.route('/api/system/reboot', methods=['POST'])
def api_system_reboot():
    """Gracefully shuts down and restarts the daemon to mount new extension blueprints."""
    def restart():
        from insetu.hooks import hooks
        hooks.emit('system_shutdown')
        time.sleep(1.0)
        python_exe = sys.executable
        cli_script = os.path.abspath(sys.argv[0])
        os.execv(python_exe, [python_exe, cli_script] + sys.argv[1:])

    threading.Thread(target=restart, daemon=True).start()
    return jsonify({"status": "success", "message": "Rebooting engine..."})
def get_system_config(workspace_id):
    cfg_path, _, _ = get_workspace_physics(workspace_id)
    try:
        with open(cfg_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        from insetu.core.utils_core import sanitize_workspace_config
        data = sanitize_workspace_config(data)
    except Exception:
        data = load_config(workspace_id)
    script_dir = Path(__file__).resolve().parent.as_posix()
    core_engines = {"bridge", "gather"}
    available_ids = set()
    available = []
    extensions_dir = Path(script_dir).joinpath("extensions").as_posix()
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

                    if ext_name and ext_name not in core_engines and ext_name not in available_ids:
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

                            available.append({"id": ext_name, "title": title, "description": desc, "missing_externals": missing_exts})
    from insetu.sdk.extension import _REGISTERED_SETTINGS_SCHEMAS

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
                    "available_extensions": sorted(available, key=lambda x: x['title']),
                    "settings_schemas": evaluated_schemas
            }
    }
def save_system_config(workspace_id, payload):
    cfg_path, _, _ = get_workspace_physics(workspace_id)

    # Security Guardrail: Enforce the core config UI is never locked out
    if "extensions" in payload and "config" not in payload["extensions"]:
        payload["extensions"].insert(0, "config")
    from insetu.core.utils_core import sanitize_workspace_config

    payload = sanitize_workspace_config(payload)
    save_json_file(cfg_path, payload, workspace_id)

    # Invalidate the mutated config cache so backend physics immediately see changes
    from insetu.utils import _MUTATED_CONFIG_CACHE, _MUTATED_CONFIG_MTIME
    _MUTATED_CONFIG_CACHE.clear()
    _MUTATED_CONFIG_MTIME.clear()

@system_bp.route('/api/system/config', methods=['GET', 'POST'])
@system_bp.route('/api/<workspace_id>/system/config', methods=['GET', 'POST'])
def api_system_config(workspace_id=None):
    if not workspace_id: workspace_id = sniff_tenant_id()
    if request.method == 'GET':
        data = get_system_config(workspace_id)
        return jsonify(data)
    else:
        try:
            payload = request.json

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
            return jsonify({"error": str(e)}), 500
@system_bp.route('/api/system/repos/template', methods=['GET'])
def api_repo_template():
    """Serves the SSOT default repository configuration to the frontend UI."""
    from insetu.core.utils_core import get_default_repo_template
    return jsonify(get_default_repo_template(""))

@system_bp.route('/api/system/workspaces/create', methods=['POST'])
def api_create_workspace():
    data = request.json or {}
    ws_id = data.get('id', '').strip().lower()
    if not ws_id or ws_id in ['default', 'none']:
        return jsonify({"error": "A unique, valid alphanumeric workspace ID is required"}), 400

    index_path = Path(utils._cwd).joinpath(".insetu", "workspaces.json").as_posix()
    if not os.path.exists(index_path):
        w_data = {"active_workspace": "default", "workspaces": {"default": {"config_path": "config.json"}}}
    else:
        with open(index_path, 'r', encoding='utf-8') as f:
            w_data = json.load(f)

    if ws_id in w_data.get("workspaces", {}):
        return jsonify({"error": f"Workspace '{ws_id}' already exists"}), 400
    custom_root = data.get('workspace_root', '').strip()
    if not custom_root:
        return jsonify({"error": "Workspace Root Directory Path is strictly required to ensure absolute codebase isolation."}), 400
    resolved_root = os.path.abspath(os.path.expanduser(custom_root))

    ws_insetu_dir = Path(resolved_root).joinpath(".insetu")
    try:
        os.makedirs(ws_insetu_dir.joinpath("data").as_posix(), exist_ok=True)
    except Exception as e:
        return jsonify({"error": f"Failed to mount physical directory. Check path permissions: {str(e)}"}), 500
    
    config_abs_path = ws_insetu_dir.joinpath("config.json").as_posix()
    config_rel_path = config_abs_path
    starter_config = {
        "instance_title": f"inSetu Workspace: {ws_id}",
        "workspace_root": resolved_root,
        "extensions": ["config"],
        "ignore_dirs": ["node_modules", "__pycache__", "venv", ".git", ".insetu"]
    }

    os.makedirs(starter_config["workspace_root"], exist_ok=True)

    from insetu.routes_fs import execute_vfs_save
    # Track the configuration write explicitly within the context of the newly registered workspace ID
    execute_vfs_save(ws_id, config_abs_path, json.dumps(starter_config, indent=2), data={"is_absolute_artifact": True})

    if "workspaces" not in w_data:
        w_data["workspaces"] = {}
    w_data["workspaces"][ws_id] = {"title": ws_id.title(), "config_path": config_rel_path}

    execute_vfs_save("default", index_path, json.dumps(w_data, indent=2), data={"is_absolute_artifact": True})

    return jsonify({"status": "success", "workspaces": w_data["workspaces"]})

@system_bp.route('/api/system/workspaces/delete', methods=['POST'])
def api_delete_workspace():
    data = request.json or {}
    ws_id = data.get('id', '').strip().lower()
    if ws_id == 'default':
        return jsonify({"error": "The root system default workspace framework cannot be deleted."}), 400

    index_path = Path(utils._cwd).joinpath(".insetu", "workspaces.json").as_posix()
    if not os.path.exists(index_path):
        return jsonify({"error": "workspaces.json not found"}), 404

    with open(index_path, 'r', encoding='utf-8') as f:
        w_data = json.load(f)

    if ws_id not in w_data.get("workspaces", {}):
        return jsonify({"error": "Target workspace not found."}), 404

    del w_data["workspaces"][ws_id]
    if w_data.get("active_workspace") == ws_id:
        w_data["active_workspace"] = "default"

    local_insetu_dir = Path(utils._cwd).joinpath(".insetu").as_posix()
    ws_dir = Path(local_insetu_dir).joinpath("workspaces", ws_id)
    if os.path.exists(ws_dir.as_posix()):
        from insetu.routes_fs import execute_vfs_delete
        execute_vfs_delete("default", ws_dir.as_posix())

    from insetu.routes_fs import execute_vfs_save
    execute_vfs_save("default", index_path, json.dumps(w_data, indent=2), data={"is_absolute_artifact": True})

    return jsonify({"status": "success", "workspaces": w_data["workspaces"]})

@system_bp.route('/api/system/jobs/<job_id>', methods=['GET'])
def api_job_status(job_id):
    workspace_id = sniff_tenant_id()
    from insetu.db import get_connection
    try:
        conn = get_connection("workers", workspace_id=workspace_id)
        job = conn.execute("SELECT status, status_message, artifact_json, created_at, updated_at FROM immediate_jobs WHERE id=?", (job_id,)).fetchone()
        if not job:
            return jsonify({"error": "Job not found"}), 404

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
    index_path = Path(utils._cwd).joinpath(".insetu", "workspaces.json").as_posix()

    if request.method == 'GET':
        return jsonify(utils.load_json_file(index_path, {"active_workspace": "default", "workspaces": {}}))
    if request.method == 'POST':
        data = request.json
        new_active = data.get("active_workspace")
        if not os.path.exists(index_path):
            return jsonify({"error": "workspaces.json not found."}), 404

        w_data = utils.load_json_file(index_path, {})
        if new_active not in w_data.get("workspaces", {}):
            return jsonify({"error": "Workspace ID not found."}), 400

        # UDF & STATELESS ARCHITECTURE: The backend no longer tracks active_workspace globally.
        # The frontend UI orchestrates the context swap dynamically via localStorage.

    return jsonify({"status": "success", "message": f"Switched to {new_active}"})

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