import uuid
from flask import jsonify
from insetu.kernel.utils import generate_idempotency_hash
from insetu.kernel.db import get_connection
from insetu.kernel.workers import submit_immediate_job, update_immediate_job_status, register_callback
from insetu.kernel.extension import InSetuExtension

# Import the extracted math & validation logic
from .bridge_vfs import execute_bridge_sync
# 1. Initialize the Single Source of Truth Blueprint
BRIDGE_SCHEMA = {
    "bridge_ledger": {
        "patch_id": "TEXT PRIMARY KEY",
        "transaction_id": "TEXT",
        "repo": "TEXT",
        "filepath": "TEXT",
        "search_block": "TEXT",
        "replace_block": "TEXT",
        "post_patch_hash": "TEXT",
        "is_snapshot": "INTEGER DEFAULT 0",
        "compressed_state": "BLOB",
        "timestamp": "REAL",
        "ttl_expires_at": "REAL"
    }
}

bridge_bp = InSetuExtension(
    'bridge', 
    __name__,
    title="Sync Bridge",
    description="Yomama Patch Protocol and AST Validation Engine.",
    schema=BRIDGE_SCHEMA,
    core=True
)

# 2. REST API Routes (Formerly in routes_bridge.py)
@bridge_bp.route('sync', methods=['POST'])
def bridge_sync(ctx):
    """Receives Yomama payloads from the UI and dispatches the sync."""
    data = ctx.req.json or {}
    args_json = generate_idempotency_hash(data)

    # Idempotency Guardrail: Prevent duplicate overlapping patches
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

# 3. Background Workers
def _background_bridge_sync(job_id, workspace_id, **kwargs):
    """Executes the bridge matrix off-thread and enforces the VFS synchronization barrier."""
    try:
        update_immediate_job_status(job_id, 'processing', "Analyzing patch matrices and running AST validation...", workspace_id=workspace_id)
        # Execute the pure operational logic
        sync_output = execute_bridge_sync(workspace_id, kwargs)
        # VFS BARRIER: Block the completion signal until physical disk writes settle
        from insetu.kernel.vfs import _VFS_WRITE_QUEUE, _VFS_SHUTDOWN_SIGNAL
        import time

        # Replace blocking .join() with an abortable polling lock
        while _VFS_WRITE_QUEUE.unfinished_tasks > 0:
            if _VFS_SHUTDOWN_SIGNAL.is_set():
                update_immediate_job_status(job_id, 'failed', "Transaction aborted mid-flight due to system shutdown or workspace context swap.", workspace_id=workspace_id)
                return
            time.sleep(0.1)

        update_immediate_job_status(job_id, 'completed', sync_output, workspace_id=workspace_id)
    except Exception as e:
        import traceback
        err = traceback.format_exc()
        update_immediate_job_status(job_id, 'failed', f"Bridge Fatal Error: {str(e)}\n\n{err}", workspace_id=workspace_id)

register_callback("bridge", "sync_task", _background_bridge_sync)