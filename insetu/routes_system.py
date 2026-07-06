from pathlib import Path
import os
import sys
import json
import threading
import time
from flask import Blueprint, request, jsonify
from insetu.utils_core import load_config, save_json_file, get_workspace_physics
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
        for file in os.listdir(extensions_dir):
            if file.startswith("engine_") and file.endswith(".py"):
                ext_name = file.replace("engine_", "").replace(".py", "")
                if ext_name not in core_engines:
                    available.append(ext_name)

    data["_available_extensions"] = sorted(available)
    return data
def save_system_config(workspace_id, payload):
    cfg_path, _, _ = get_workspace_physics(workspace_id)
    if "_available_extensions" in payload:
        del payload["_available_extensions"]
    save_json_file(cfg_path, payload, workspace_id)


@system_bp.route('/api/system/config', methods=['GET', 'POST'])
def api_system_config():
    workspace_id = request.headers.get('X-Workspace-ID')
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
@system_bp.route('/api/system/jobs/<job_id>', methods=['GET'])
def api_job_status(job_id):
    workspace_id = request.headers.get('X-Workspace-ID', 'default')
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