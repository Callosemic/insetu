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
@system_bp.route('/api/system/config', methods=['GET', 'POST'])
def api_system_config():
    workspace_id = request.headers.get('X-Workspace-ID')
    cfg_path, _, _ = get_workspace_physics(workspace_id)

    if request.method == 'GET':
        try:
            with open(cfg_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            data = load_config(workspace_id)

        # Dynamically discover available extensions
        script_dir = os.path.dirname(os.path.abspath(__file__))
        core_engines = {"bridge", "gather", "format", "ingest"}
        available = []
        for file in os.listdir(script_dir):
            if file.startswith("engine_") and file.endswith(".py"):
                ext_name = file.replace("engine_", "").replace(".py", "")
                if ext_name not in core_engines:
                    available.append(ext_name)

        data["_available_extensions"] = sorted(available)
        return jsonify(data)
    else:
        try:
            payload = request.json
            if "_available_extensions" in payload:
                del payload["_available_extensions"]
            save_json_file(cfg_path, payload)
            return jsonify({"status": "success", "message": "Configuration saved successfully."})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

@system_bp.route('/api/system/workspaces', methods=['GET', 'POST'])
def api_workspaces():
    index_path = os.path.join(utils_core._cwd, ".insetu", "workspaces.json")

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
        w_data["active_workspace"] = new_active
        utils_core.save_json_file(index_path, w_data)

        # STATELESS ARCHITECTURE: The backend no longer restarts! 
        # The frontend UI orchestrates the context swap dynamically.

    return jsonify({"status": "success", "message": f"Switched to {new_active}"})