from pathlib import Path
import os
import sys
import json
import threading
import time
from flask import Blueprint, request, jsonify
from insetu.utils_core import load_config, save_json_file, get_workspace_physics, sniff_tenant_id
import insetu.utils_core as utils_core

system_bp = Blueprint('system', __name__)

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
    except Exception:
        data = load_config(workspace_id)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    core_engines = {"bridge", "gather"}
    available = []
    extensions_dir = Path(script_dir).joinpath("extensions").as_posix()
    if os.path.exists(extensions_dir):
        for item in os.listdir(extensions_dir):
            item_path = Path(extensions_dir).joinpath(item).as_posix()

            if os.path.isdir(item_path):
                # Bundled topology (ADR 0012)
                if os.path.exists(Path(item_path).joinpath(f"engine_{item}.py").as_posix()):
                    if item not in core_engines:
                        available.append(item)
            elif item.startswith("engine_") and item.endswith(".py"):
                # Legacy flat topology
                ext_name = item.replace("engine_", "").replace(".py", "")
                if ext_name not in core_engines and ext_name not in available:
                    available.append(ext_name)

    from insetu.sdk.extension import _REGISTERED_SETTINGS_SCHEMAS

    data["_available_extensions"] = sorted(available)
    data["_settings_schemas"] = _REGISTERED_SETTINGS_SCHEMAS
    return data

def save_system_config(workspace_id, payload):
    cfg_path, _, _ = get_workspace_physics(workspace_id)
    if "_available_extensions" in payload:
        del payload["_available_extensions"]
    save_json_file(cfg_path, payload, workspace_id)

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
            save_system_config(workspace_id, payload)
            return jsonify({"status": "success", "message": "Configuration saved successfully."})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@system_bp.route('/api/system/workspaces/create', methods=['POST'])
def api_create_workspace():
    data = request.json or {}
    ws_id = data.get('id', '').strip().lower()

    if not ws_id or ws_id in ['default', 'none']:
        return jsonify({"error": "A unique, valid alphanumeric workspace ID is required"}), 400

    index_path = Path(utils_core._cwd).joinpath(".insetu", "workspaces.json").as_posix()
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

    ws_insetu_dir = Path(resolved_root).joinpath("insetu")
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
    execute_vfs_save("default", config_abs_path, json.dumps(starter_config, indent=2), data={"is_absolute_artifact": True})

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

    index_path = Path(utils_core._cwd).joinpath(".insetu", "workspaces.json").as_posix()
    if not os.path.exists(index_path):
        return jsonify({"error": "workspaces.json not found"}), 404

    with open(index_path, 'r', encoding='utf-8') as f:
        w_data = json.load(f)

    if ws_id not in w_data.get("workspaces", {}):
        return jsonify({"error": "Target workspace not found."}), 404

    del w_data["workspaces"][ws_id]
    
    if w_data.get("active_workspace") == ws_id:
        w_data["active_workspace"] = "default"

    local_insetu_dir = Path(utils_core._cwd).joinpath(".insetu").as_posix()
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
    index_path = Path(utils_core._cwd).joinpath(".insetu", "workspaces.json").as_posix()

    if request.method == 'GET':
        return jsonify(utils_core.load_json_file(index_path, {"active_workspace": "default", "workspaces": {}}))
    if request.method == 'POST':
        data = request.json
        new_active = data.get("active_workspace")
        if not os.path.exists(index_path):
            return jsonify({"error": "workspaces.json not found."}), 404

        w_data = utils_core.load_json_file(index_path, {})
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