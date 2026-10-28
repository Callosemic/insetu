import uuid
import json
import time
import hashlib
import zlib
import traceback
from typing import TypedDict, Literal, List, Dict, Optional, Any
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import InSetuURI
# Import the extracted math & validation logic
from .bridge_fuzzy import apply_block_in_memory
from .bridge_vfs import execute_bridge_sync, _process_sync_transaction
from .bridge_ast import generate_commit_message_from_ledger
from insetu.core.utils_core import get_sister_repos, get_workspace_physics, parse_blocks
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
    return {"history": [dict(r) for r in records]}

class BridgeRevertPayload(TypedDict, total=False):
    patch_id: str
    transaction_id: str
    target_state: Literal['initial', 'final']

@bridge_bp.route('revert', methods=['POST'], request_schema=BridgeRevertPayload, docstring="Reverts a single patch or entire transaction to a specific state ('initial' or 'final').")
def bridge_revert(ctx):
    """Phase 5: Forward-replay reversion. Handles both single-file and multi-file atomic transactions."""
    data = ctx.payload or {}
    patch_id = data.get("patch_id")
    transaction_id = data.get("transaction_id")
    if not patch_id and not transaction_id: 
        return {"error": "patch_id or transaction_id required"}, 400

    targets = []
    if patch_id:
        record = ctx.db.execute("SELECT * FROM bridge_ledger WHERE patch_id=?", (patch_id,)).fetchone()
        if not record: return {"error": "Patch not found"}, 404
        targets.append(record)
    else:
        records = ctx.db.execute("SELECT * FROM bridge_ledger WHERE transaction_id=?", (transaction_id,)).fetchall()
        if not records: return {"error": "Transaction not found"}, 404
        seen = set()
        for r in records:
            if r['filepath'] not in seen:
                targets.append(r)
                seen.add(r['filepath'])
    new_tx_id = f"tx_rev_{uuid.uuid4().hex[:8]}"
    reverted_count = 0
    with ctx.vfs as vfs:
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
    return {"status": "success", "message": f"Atomic revert complete. Reverted {reverted_count} file(s)."}
class BridgeSyncPayload(TypedDict, total=False):
    text: str
    active_files: List[str]
    dry_run: bool
    pinned_repos: List[str]
    allow_deep_search: bool
    ignore_syntax: bool
    confirmed_candidates: Dict[str, str]
    force: bool
    auto_heal: bool
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
    try:
        raw_data = ctx.payload or {}
        safe_kwargs = {
            k: v for k, v in raw_data.items()
            if k not in ("task_name", "coalesce", "job_category", "job_id")
        }
        job_id = ctx.jobs.submit("sync_task", coalesce="args", job_category="ui_blocking", **safe_kwargs)
        return {"status": "accepted", "job_id": job_id}, 202
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Bridge Dispatch Error ({type(e).__name__}): {str(e)}"}, 500


class BridgeAstRelocatePayload(TypedDict, total=False):
    symbol: str
    source_uri: str
    target_uri: str
    dry_run: bool
    comment: str


@bridge_bp.route('ast_relocate', methods=['POST'], request_schema=BridgeAstRelocatePayload, docstring="Byte-exact AST symbol relocation from source_uri to target_uri with syntax validation and ledger snapshot recording.")
def bridge_ast_relocate(ctx):
    data = ctx.payload or {}
    symbol = str(data.get("symbol") or "").strip()
    source_uri = str(data.get("source_uri") or "").strip()
    target_uri = str(data.get("target_uri") or "").strip()
    dry_run = bool(data.get("dry_run", False))
    comment = str(data.get("comment") or f"Relocate {symbol} from {source_uri} to {target_uri}").strip()

    if not symbol or not source_uri or not target_uri:
        return {"error": "symbol, source_uri, and target_uri are required."}, 400

    synth_text = (
        f"<<<<<<< COMMENT\n{comment}\n"
        f"<<<<<<< RELOCATE\nSYMBOL: {symbol}\nFROM: {source_uri}\nTO: {target_uri}\n>>>>>>> EXECUTE"
    )
    job_id = ctx.jobs.submit(
        "sync_task",
        coalesce="args",
        job_category="ui_blocking",
        text=synth_text,
        active_files=[source_uri, target_uri],
        dry_run=dry_run,
    )
    return {"status": "accepted", "job_id": job_id}, 202


class BridgeAstRenamePayload(TypedDict, total=False):
    target_symbol: str
    new_symbol: str
    scope_prefix: str
    dry_run: bool
    comment: str


@bridge_bp.route('ast_rename', methods=['POST'], request_schema=BridgeAstRenamePayload, docstring="Token-aware AST symbol rename across matching VFS files within scope_prefix, ignoring string literals and comments.")
def bridge_ast_rename(ctx):
    data = ctx.payload or {}
    target_symbol = str(data.get("target_symbol") or "").strip()
    new_symbol = str(data.get("new_symbol") or "").strip()
    scope_prefix = str(data.get("scope_prefix") or "vfs://").strip()
    dry_run = bool(data.get("dry_run", False))
    comment = str(data.get("comment") or f"Rename {target_symbol} to {new_symbol}").strip()

    if not target_symbol or not new_symbol:
        return {"error": "target_symbol and new_symbol are required."}, 400

    synth_text = (
        f"<<<<<<< COMMENT\n{comment}\n"
        f"<<<<<<< RENAME\nTARGET: {target_symbol}\nREPLACE_WITH: {new_symbol}\nSCOPE: {scope_prefix}\n>>>>>>> EXECUTE"
    )
    job_id = ctx.jobs.submit(
        "sync_task",
        coalesce="args",
        job_category="ui_blocking",
        text=synth_text,
        active_files=[scope_prefix],
        dry_run=dry_run,
    )
    return {"status": "accepted", "job_id": job_id}, 202


class BridgeCommitMessageQuery(TypedDict, total=False):
    repo: str
    transaction_id: str
    limit: int


@bridge_bp.route('commit_message', methods=['GET'], request_schema=BridgeCommitMessageQuery, docstring="[sync] Generates a Conventional Commit message and Transaction-ID trailers from bridge_ledger intent comments.")
def bridge_commit_message(ctx):
    data = ctx.payload or {}
    repo = str(data.get("repo") or "").strip() or None
    tx_id = str(data.get("transaction_id") or "").strip() or None
    limit = int(data.get("limit") or 10)
    return generate_commit_message_from_ledger(ctx, repo=repo, transaction_id=tx_id, limit=limit)
def _serialize_blocks_to_yomama(file_to_blocks: Dict[str, List[Dict[str, Any]]]) -> str:
    """Serializes a mapping of filepath -> block dicts back into canonical Yomama patch text."""
    chunks: List[str] = []
    for fp, blks in file_to_blocks.items():
        if not blks:
            continue
        file_lines = [f"<<<<<<< FILE: {fp}"]
        for b in blks:
            if b.get("id"):
                file_lines.append(f"<<<<<<< ID: {b['id']}")
            if b.get("comment"):
                file_lines.append(f"<<<<<<< COMMENT\n{b['comment']}")
            file_lines.append(f"<<<<<<< SEARCH\n{b.get('search', '')}\n=======\n{b.get('replace', '')}\n>>>>>>> REPLACE")
        chunks.append("\n".join(file_lines))
    return "\n\n".join(chunks)


# 3. Background Workers
@bridge_bp.worker("sync_task")
def _background_bridge_sync(
    ctx,
    text: str = "",
    active_files: Optional[List[str]] = None,
    dry_run: bool = False,
    pinned_repos: Optional[List[str]] = None,
    confirmed_candidates: Optional[Dict[str, str]] = None,
    allow_deep_search: bool = False,
    force: bool = False,
    ignore_syntax: bool = False,
    ignore_syntax_errors: bool = False,
    auto_heal: bool = False,
    job_id: Optional[str] = None,
):
    """
    Executes the bridge matrix off-thread.
    When auto_heal=True and a patch fails (e.g. due to overlapping chunks), defers the failed
    chunk(s) to the end of the file's patch list, applies all valid chunks in memory first,
    and sends the post-valid in-memory buffer + only the failed chunk(s) to the fast LLM tier.
    """
    ctx.jobs.update_progress("Analyzing patch matrices and running AST validation...")
    current_text = text
    sync_payload = {
        "text": current_text,
        "active_files": active_files or [],
        "dry_run": dry_run,
        "pinned_repos": pinned_repos or ["ALL"],
        "confirmed_candidates": confirmed_candidates or {},
        "allow_deep_search": allow_deep_search,
        "force": force,
        "ignore_syntax": ignore_syntax,
        "ignore_syntax_errors": ignore_syntax_errors,
    }
    sister_repos = get_sister_repos(ctx.workspace_id)
    _, ws_root = get_workspace_physics(ctx.workspace_id)

    try:
        with ctx.vfs as vfs:
            sync_data, post_valid_buffers, deferred_failures = _process_sync_transaction(
                vfs, ctx.workspace_id, sync_payload, sister_repos, ws_root, return_buffers=True
            )

        max_heal_passes = 2 if auto_heal else 0
        heal_attempt = 0

        while heal_attempt < max_heal_passes and not sync_data.get("can_commit") and deferred_failures:
            heal_attempt += 1
            ctx.jobs.update_progress(
                f"✨ Applying valid chunks in memory & fast-healing {len(deferred_failures)} overlapping/failed chunk(s) (pass {heal_attempt}/{max_heal_passes})..."
            )

            # Separate valid resolved blocks from failed deferred blocks
            parsed_all = parse_blocks(current_text)
            failed_cell_ids = {df["block"].get("id") for df in deferred_failures if df["block"].get("id")}
            failed_pairs = {(df["raw_target_file"], df["block"].get("search", ""), df["block"].get("replace", "")) for df in deferred_failures}

            valid_blocks_by_file: Dict[str, List[Dict[str, Any]]] = {}
            failed_blocks_by_file: Dict[str, List[Dict[str, Any]]] = {}
            for raw_fp, blks in parsed_all.items():
                canon_fp = str(InSetuURI(raw_fp))
                for b in blks:
                    is_failed = (b.get("id") and b.get("id") in failed_cell_ids) or (
                        (raw_fp, b.get("search", ""), b.get("replace", "")) in failed_pairs
                    )
                    if is_failed:
                        failed_blocks_by_file.setdefault(canon_fp, []).append(b)
                    else:
                        valid_blocks_by_file.setdefault(canon_fp, []).append(b)

            # Build post-valid buffer context for the files that had failures
            buffer_snippets: List[str] = []
            for df in deferred_failures:
                fp = df["filepath"]
                in_mem_text = post_valid_buffers.get(fp)
                if in_mem_text is None:
                    in_mem_text = ctx.vfs.read(fp)
                if in_mem_text is not None:
                    tag = f"=== FILE STATE AFTER APPLYING VALID PATCHES: {fp} ==="
                    if not any(s.startswith(tag) for s in buffer_snippets):
                        buffer_snippets.append(f"{tag}\n{in_mem_text}")

            if not buffer_snippets:
                break

            failed_only_yomama = _serialize_blocks_to_yomama(failed_blocks_by_file)
            err_lines = [
                f"- {df['filepath']}: {df['patch_tel'].get('error_message') or df['patch_tel'].get('status')}"
                for df in deferred_failures
            ]
            heal_prompt = (
                "All non-overlapping valid patches for this file have already been applied in memory.\n"
                "The following deferred Yomama patch block(s) failed to anchor (or had a syntax error) against the updated buffer:\n"
                + "\n".join(err_lines)
                + f"\n\n--- DEFERRED FAILED PATCH BLOCK(S) TO REPAIR ---\n{failed_only_yomama}\n\n"
                + "\n\n".join(buffer_snippets)
                + "\n\nRewrite ONLY the failed Yomama patch block(s) above so their SEARCH blocks match the exact lines in the 'FILE STATE AFTER APPLYING VALID PATCHES' buffer while preserving their intended changes."
            )

            try:
                heal_res = ctx.call(
                    "llm.complete",
                    messages=[{"role": "user", "content": heal_prompt}],
                    system=(
                        "You are the inSetu Fast-Tier Yomama Patch Healer. "
                        "All valid patches have already been applied to the file buffer provided. "
                        "Output ONLY the repaired Yomama patch block(s) ('<<<<<<< FILE:' / '<<<<<<< SEARCH' / '=======' / '>>>>>>> REPLACE') that apply cleanly on top of the provided buffer."
                    ),
                    tier="fast",
                    output_schema="yomama_patch",
                    wait=True,
                )
            except Exception as heal_err:
                sync_data["heal_error"] = str(heal_err)
                break

            healed_tail_text = heal_res.get("text", "") if isinstance(heal_res, dict) else str(heal_res)
            healed_tail_parsed = parse_blocks(healed_tail_text)
            if not healed_tail_parsed:
                break

            # Reconstruct payload: Valid blocks first, then healed deferred blocks at the end of each file's list
            merged_by_file: Dict[str, List[Dict[str, Any]]] = {
                fp: list(blks) for fp, blks in valid_blocks_by_file.items()
            }
            for raw_h_fp, h_blks in healed_tail_parsed.items():
                canon_h_fp = str(InSetuURI(raw_h_fp))
                merged_by_file.setdefault(canon_h_fp, []).extend(h_blks)

            current_text = _serialize_blocks_to_yomama(merged_by_file)
            sync_payload["text"] = current_text
            sync_payload["active_files"] = list(merged_by_file.keys())

            with ctx.vfs as vfs:
                sync_data, post_valid_buffers, deferred_failures = _process_sync_transaction(
                    vfs, ctx.workspace_id, sync_payload, sister_repos, ws_root, return_buffers=True
                )
            sync_data["healed_attempts"] = heal_attempt
            sync_data["healed_payload"] = current_text

        if sync_data.get("status") == "committed":
            ctx.jobs.update_progress("Awaiting VFS disk settlement...")
            ctx.sync_vfs_barrier(timeout=5.0)
        return {"message": "Transaction evaluated.", "artifact": sync_data}
    except Exception:
        return {"message": execute_bridge_sync(ctx.workspace_id, sync_payload)}


@bridge_bp.worker("sweep_ledger")
def _sweep_ledger_worker(ctx, job_id: Optional[str] = None):
    """Metronome TTL Housekeeping: Purges historical rows older than 48 hours."""
    now = time.time()
    try:
        ctx.db.execute("DELETE FROM bridge_ledger WHERE ttl_expires_at IS NOT NULL AND ttl_expires_at < ?", (now,))
        ctx.db.commit()
        ctx.jobs.update_progress("Ledger swept successfully.")
    except Exception as e:
        ctx.jobs.update_progress(f"Ledger sweep failed: {e}")