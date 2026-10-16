import uuid
import json
import time
import hashlib
import zlib
import traceback
from typing import TypedDict, Literal, List, Dict
from flask import jsonify
from akasa.hooks import hooks
from akasa.vfs import VFSTransaction
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import InSetuURI

# Import the extracted math & validation logic
from .bridge_fuzzy import apply_block_in_memory
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

class BridgeLedgerRecord(TypedDict):
    patch_id: str
    transaction_id: str
    repo: str
    filepath: str
    search_block: str
    replace_block: str
    post_patch_hash: str
    is_snapshot: int
    timestamp: float
    ttl_expires_at: float
    patch_count: int
    chunks_json: str

class BridgeHistoryResponse(TypedDict):
    history: List[BridgeLedgerRecord]

# 2. REST API Routes (Formerly in routes_bridge.py)
@bridge_bp.route('history', methods=['GET'], response_schema=BridgeHistoryResponse, docstring="Returns up to 100 historical patch and transaction receipts from the bridge ledger.")
def bridge_history(ctx):
    """Phase C: Returns the ephemeral ledger history for the UI."""
    # Explicitly exclude the 'compressed_state' BLOB to prevent JSON serialization crashes
    records = ctx.db.execute("SELECT patch_id, transaction_id, repo, filepath, search_block, replace_block, post_patch_hash, is_snapshot, timestamp, ttl_expires_at, patch_count, chunks_json FROM bridge_ledger ORDER BY timestamp DESC LIMIT 100").fetchall()
    return jsonify({"history": [dict(r) for r in records]})

class BridgeRevertPayload(TypedDict, total=False):
    patch_id: str
    transaction_id: str
    target_state: Literal['initial', 'final']

@bridge_bp.route('revert', methods=['POST'], request_schema=BridgeRevertPayload, docstring="Reverts a single patch or entire transaction to a specific state ('initial' or 'final').")
def bridge_revert(ctx):
    """Phase 5: Forward-replay reversion. Handles both single-file and multi-file atomic transactions."""
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

    new_tx_id = f"tx_rev_{uuid.uuid4().hex[:8]}"
    reverted_count = 0
    with VFSTransaction(ctx.workspace_id) as vfs:
        target_state = data.get("target_state", "final")
        is_initial = target_state == "initial"

        for target in targets:
            filepath = target['filepath']
            target_ts = target['timestamp']
            # 1. Find nearest preceding snapshot
            # Bugfix: Always use '<=' because the target transaction itself may contain the pre-patch snapshot.
            snap = ctx.db.execute("SELECT timestamp, compressed_state FROM bridge_ledger WHERE filepath=? AND is_snapshot=1 AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1", (filepath, target_ts)).fetchone()

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

            uri = InSetuURI(filepath)
            repo = uri.repo if uri.repo else (uri.path.partition('/')[0] if '/' in uri.path else "")

            ctx.db.execute('''
                INSERT INTO bridge_ledger (patch_id, transaction_id, repo, filepath, search_block, replace_block, post_patch_hash, is_snapshot, compressed_state, timestamp, ttl_expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (new_patch_id, new_tx_id, repo, filepath, f"<<<<<<< REVERT TO {target['transaction_id']}", content, post_patch_hash, 1, compressed_state, time.time(), time.time() + 172800.0))

            vfs.save(filepath, content)
            reverted_count += 1

        ctx.db.commit()
    return jsonify({"status": "success", "message": f"Atomic revert complete. Reverted {reverted_count} file(s)."})

class BridgeSyncPayload(TypedDict, total=False):
    text: str
    active_files: List[str]
    dry_run: bool
    pinned_repos: List[str]
    allow_deep_search: bool
    ignore_syntax: bool
    confirmed_candidates: Dict[str, str]
    force: bool
@bridge_bp.route('sync', methods=['POST'], request_schema=BridgeSyncPayload, docstring=(
    "Applies modifications to the VFS using the 'Yomama' Patch Protocol.\n\n"
    "The 'text' parameter MUST strictly follow this exact format:\n"
    "<<<<<<< FILE: path/to/file.ext\n"
    "<<<<<<< SEARCH\n"
    "[exact lines to match]\n"
    "=======\n"
    "[new lines to insert]\n"
    ">>>>>>> REPLACE\n\n"
    "Leave the SEARCH block blank for a genesis file. You MUST also provide the "
    "'active_files' array containing the filepaths you are modifying."
))
def bridge_sync(ctx):
    """Receives Yomama payloads from the UI and dispatches the sync."""
    data = ctx.req.json or {}
    job_id = ctx.jobs.submit("sync_task", coalesce="args", job_category="ui_blocking", **data)
    return jsonify({"status": "accepted", "job_id": job_id}), 202

# 3. Background Workers
@bridge_bp.worker("sync_task")
def _background_bridge_sync(ctx, job_id=None, **kwargs):
    """Executes the bridge matrix off-thread and enforces the VFS synchronization barrier."""
    ctx.jobs.update_progress("Analyzing patch matrices and running AST validation...")
    sync_output_json = execute_bridge_sync(ctx.workspace_id, kwargs)

    try:
        sync_data = json.loads(sync_output_json)
        if sync_data.get("status") == "committed":
            ctx.jobs.update_progress("Awaiting VFS disk settlement...")
            ctx.sync_vfs_barrier(timeout=5.0)
        return {"message": "Transaction evaluated.", "artifact": sync_data}
    except Exception:
        return {"message": sync_output_json}
@bridge_bp.worker("sweep_ledger")
def _sweep_ledger_worker(ctx, job_id=None, **kwargs):
    """Metronome TTL Housekeeping: Purges historical rows older than 48 hours."""
    now = time.time()
    try:
        ctx.db.execute("DELETE FROM bridge_ledger WHERE ttl_expires_at IS NOT NULL AND ttl_expires_at < ?", (now,))
        ctx.db.commit()
        ctx.jobs.update_progress("Ledger swept successfully.")
    except Exception as e:
        ctx.jobs.update_progress(f"Ledger sweep failed: {e}")