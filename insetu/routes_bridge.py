import os
import json
import uuid
from flask import Blueprint, request, jsonify
from insetu.utils_core import resolve_workspace_path, generate_idempotency_hash
from insetu.db import get_connection
from insetu.workers import submit_immediate_job

bridge_bp = Blueprint('bridge', __name__)

@bridge_bp.route('/api/<workspace_id>/bridge/sync', methods=['POST'])
def bridge_sync(workspace_id):
    data = request.json
    args_json = generate_idempotency_hash(data)

    # Idempotency Guardrail: Prevent duplicate overlapping patches
    conn = get_connection("workers", workspace_id=workspace_id)
    existing_job = conn.execute(
        "SELECT id FROM immediate_jobs WHERE ext_name='bridge' AND status IN ('pending', 'processing') AND args_json=?",
        (args_json,)
    ).fetchone()

    if existing_job:
        return jsonify({"status": "accepted", "job_id": existing_job['id'], "message": "Reattached to existing transaction."}), 202

    job_id = f"brg_{uuid.uuid4().hex[:8]}"
    submit_immediate_job(job_id, "bridge", "sync_task", args_json, workspace_id)

    return jsonify({"status": "accepted", "job_id": job_id}), 202


@bridge_bp.route('/api/<workspace_id>/bridge/fetch', methods=['GET'])
def bridge_fetch(workspace_id):
    resolved_path = resolve_workspace_path(request.args.get('file', ''), workspace_id)
    if resolved_path and os.path.exists(resolved_path):
        with open(resolved_path, 'r', encoding='utf-8') as f: 
            return f.read(), 200, {'Content-Type': 'text/plain; charset=utf-8'}
    return "File not found.", 404