import os
import json
import uuid
from flask import jsonify
from insetu.utils_core import generate_idempotency_hash
from insetu.db import get_connection
from insetu.workers import submit_immediate_job
from insetu.sdk import InSetuExtension

bridge_bp = InSetuExtension('bridge', __name__, core=True)

@bridge_bp.route('sync', methods=['POST'])
def bridge_sync(ctx):
    data = ctx.req.json or {}
    args_json = generate_idempotency_hash(data)

    # Idempotency Guardrail: Prevent duplicate overlapping patches
    # Note: immediate_jobs is housed in the workers.db ledger, so we explicitly request it
    conn = get_connection("workers", workspace_id=ctx.workspace_id)
    existing_job = conn.execute(
        "SELECT id FROM immediate_jobs WHERE ext_name='bridge' AND status IN ('pending', 'processing') AND args_json=?",
        (args_json,)
    ).fetchone()

    if existing_job:
        return jsonify({"status": "accepted", "job_id": existing_job['id'], "message": "Reattached to existing transaction."}), 202
    job_id = f"brg_{uuid.uuid4().hex[:8]}"
    submit_immediate_job(job_id, "bridge", "sync_task", args_json, ctx.workspace_id)

    return jsonify({"status": "accepted", "job_id": job_id}), 202