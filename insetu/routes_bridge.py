import os
from flask import Blueprint, request
from insetu.engine_bridge import execute_bridge_sync
from insetu.utils_core import resolve_workspace_path

bridge_bp = Blueprint('bridge', __name__)

@bridge_bp.route('/api/<workspace_id>/bridge/sync', methods=['POST'])
def bridge_sync(workspace_id):
    data = request.json
    sync_output = execute_bridge_sync(workspace_id, data)
    return sync_output, 200, {'Content-Type': 'text/plain; charset=utf-8'}


@bridge_bp.route('/api/<workspace_id>/bridge/fetch', methods=['GET'])
def bridge_fetch(workspace_id):
    resolved_path = resolve_workspace_path(request.args.get('file', ''), workspace_id)
    if resolved_path and os.path.exists(resolved_path):
        with open(resolved_path, 'r', encoding='utf-8') as f: 
            return f.read(), 200, {'Content-Type': 'text/plain; charset=utf-8'}
    return "File not found.", 404