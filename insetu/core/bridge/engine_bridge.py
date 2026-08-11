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
        "ttl_expires_at": "REAL",
        "patch_count": "INTEGER DEFAULT 1",
        "chunks_json": "TEXT"
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
@bridge_bp.route('history', methods=['GET'])
def bridge_history(ctx):
    """Phase C: Returns the ephemeral ledger history for the UI."""
    from flask import jsonify
    # Explicitly exclude the 'compressed_state' BLOB to prevent JSON serialization crashes
    records = ctx.db.execute("SELECT patch_id, transaction_id, repo, filepath, search_block, replace_block, post_patch_hash, is_snapshot, timestamp, ttl_expires_at, patch_count, chunks_json FROM bridge_ledger ORDER BY timestamp DESC LIMIT 100").fetchall()
    return jsonify({"history": [dict(r) for r in records]})
@bridge_bp.route('revert', methods=['POST'])
def bridge_revert(ctx):
    """Phase 5: Forward-replay reversion. Handles both single-file and multi-file atomic transactions."""
    from flask import jsonify
    data = ctx.req.json or {}
    patch_id = data.get("patch_id")
    transaction_id = data.get("transaction_id")
    if not patch_id and not transaction_id: 
        return jsonify({"error": "patch_id or transaction_id required"}), 400

    targets = []
    if patch_id:
        record = ctx.db.execute("SELECT * FROM bridge_ledger WHERE patch_id=?", (patch_id,)).fetchone()
        if not record: return jsonify({"error": "Patch not found"}), 404
        targets.append(record)
    else:
        records = ctx.db.execute("SELECT * FROM bridge_ledger WHERE transaction_id=?", (transaction_id,)).fetchall()
        if not records: return jsonify({"error": "Transaction not found"}), 404
        seen = set()
        for r in records:
            if r['filepath'] not in seen:
                targets.append(r)
                seen.add(r['filepath'])
    import uuid, time, hashlib, zlib, json
    from insetu.kernel.vfs import VFSTransaction
    from insetu.core.bridge.bridge_fuzzy import apply_block_in_memory

    new_tx_id = f"tx_rev_{uuid.uuid4().hex[:8]}"
    reverted_count = 0
    with VFSTransaction(ctx.workspace_id) as vfs:
        target_state = data.get("target_state", "final")
        is_initial = target_state == "initial"

        for target in targets:
            filepath = target['filepath']
            target_ts = target['timestamp']

            # 1. Find nearest preceding snapshot
            snap_op = "<" if is_initial else "<="
            snap = ctx.db.execute(f"SELECT timestamp, compressed_state FROM bridge_ledger WHERE filepath=? AND is_snapshot=1 AND timestamp {snap_op} ? ORDER BY timestamp DESC LIMIT 1", (filepath, target_ts)).fetchone()

            if snap and snap['compressed_state']:
                content = zlib.decompress(snap['compressed_state']).decode('utf-8')
                start_ts = snap['timestamp']
            else:
                content = ""
                start_ts = 0
            # 2. Replay patches forward in memory
            patch_op = "<" if is_initial else "<="
            patches = ctx.db.execute(f"SELECT search_block, replace_block, chunks_json FROM bridge_ledger WHERE filepath=? AND timestamp >= ? AND timestamp {patch_op} ? ORDER BY timestamp ASC", (filepath, start_ts, target_ts)).fetchall()

            for p in patches:
                chunks = []
                if p["chunks_json"]:
                    try:
                        chunks = json.loads(p["chunks_json"])
                    except Exception:
                        pass
                if not chunks:
                    chunks = [{"search": p["search_block"], "replace": p["replace_block"]}]

                for block in chunks:
                    ok, new_content, _ = apply_block_in_memory(content, block, silent=True)
                    if ok: content = new_content

            # 3. Snapshot current state and save reconstructed state as a new transaction
            current_on_disk = vfs.read(filepath) or ""
            if current_on_disk == content: continue

            compressed_state = zlib.compress(current_on_disk.encode('utf-8'))
            post_patch_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()

            new_patch_id = f"ptc_{uuid.uuid4().hex[:12]}"
            repo = filepath.split('/')[0] if '/' in filepath else ""
            ctx.db.execute('''
                INSERT INTO bridge_ledger (patch_id, transaction_id, repo, filepath, search_block, replace_block, post_patch_hash, is_snapshot, compressed_state, timestamp, ttl_expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (new_patch_id, new_tx_id, repo, filepath, f"<<<<<<< REVERT TO {target['transaction_id']}", content, post_patch_hash, 1, compressed_state, time.time(), time.time() + 172800.0))

            vfs.save(filepath, content)
            reverted_count += 1

        ctx.db.commit()

    return jsonify({"status": "success", "message": f"Atomic revert complete. Reverted {reverted_count} file(s)."})

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
        sync_output_json = execute_bridge_sync(workspace_id, kwargs)
        # VFS BARRIER: Block the completion signal until physical disk writes settle
        from insetu.kernel.vfs import _VFS_WRITE_QUEUE, _VFS_SHUTDOWN_SIGNAL
        import time

        # Replace blocking .join() with an abortable polling lock
        while _VFS_WRITE_QUEUE.unfinished_tasks > 0:
            if _VFS_SHUTDOWN_SIGNAL.is_set():
                update_immediate_job_status(job_id, 'failed', "Transaction aborted mid-flight due to system shutdown or workspace context swap.", workspace_id=workspace_id)
                return
            time.sleep(0.1)

        import json
        try:
            sync_data = json.loads(sync_output_json)
            update_immediate_job_status(job_id, 'completed', "Transaction evaluated.", artifact=sync_data, workspace_id=workspace_id)
        except Exception:
            # Fallback if execution violently aborted outside the JSON envelope
            update_immediate_job_status(job_id, 'completed', sync_output_json, workspace_id=workspace_id)
    except Exception as e:
        import traceback
        err = traceback.format_exc()
        update_immediate_job_status(job_id, 'failed', f"Bridge Fatal Error: {str(e)}\n\n{err}", workspace_id=workspace_id)
register_callback("bridge", "sync_task", _background_bridge_sync)

@bridge_bp.worker("sweep_ledger")
def _sweep_ledger_worker(ctx, job_id=None, **kwargs):
    """Metronome TTL Housekeeping: Purges historical rows older than 48 hours."""
    import time
    now = time.time()
    try:
        ctx.db.execute("DELETE FROM bridge_ledger WHERE ttl_expires_at IS NOT NULL AND ttl_expires_at < ?", (now,))
        ctx.db.commit()
        ctx.jobs.update_progress("Ledger swept successfully.")
    except Exception as e:
        ctx.jobs.update_progress(f"Ledger sweep failed: {e}")