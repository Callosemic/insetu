import re
import uuid
import json
import time
import hashlib
import zlib
import traceback
from typing import TypedDict, Literal, List, Dict, Optional, Any, Union, Tuple
from insetu.core.sdk import InSetuExtension
from insetu.core.system.security_io import approve_command
from insetu.core.utils_core import compute_vfs_sha256, InSetuURI, get_sister_repos, get_workspace_physics
# Import the extracted math & validation logic
from insetu.core.languages import format_interleaved_file_diff
from .parser import (
    LEDGER_CHUNK_TYPES,
    parse_blocks,
    serialize_block_chunk,
    serialize_blocks_to_yomama as _serialize_blocks_to_yomama,
)
from .bridge_fuzzy import (
    apply_block_in_memory,
    apply_textedit_in_memory,
    apply_json_patch_in_memory,
)
from .bridge_window import extract_windowed_buffer_context as _extract_windowed_buffer_context
from .bridge_vfs import (
    execute_bridge_sync,
    process_sync_transaction,
    validate_buffer_syntax as _validate_buffer_syntax,
)
from .bridge_ast import generate_commit_message_from_ledger
from .bridge_test import run_repo_test_diagnostics
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
    },
    "bridge_heal_audit": {
        "heal_id": "TEXT PRIMARY KEY",
        "timestamp": "REAL",
        "transaction_id": "TEXT",
        "filepath": "TEXT",
        "cell_id": "TEXT",
        "pass_number": "INTEGER DEFAULT 1",
        "failure_type": "TEXT",
        "original_error": "TEXT",
        "original_block": "TEXT",
        "windowed_context_sent": "TEXT",
        "instructions_sent": "TEXT",
        "healer_raw_output": "TEXT",
        "healed_block": "TEXT",
        "verification_status": "TEXT",
        "verification_error": "TEXT",
        "model": "TEXT",
        "latency_ms": "INTEGER DEFAULT 0"
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
__depends__ = ['topology', 'cartographer']

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
def _replay_ledger_chunks_in_memory(filepath: str, base_content: Optional[str], patch_rows: List[Any]) -> Optional[str]:
    """
    Single Source of Truth forward-replay engine for bridge_ledger records.
    Operates over Optional[str] buffer states (None = file absent on disk, "" = 0-byte file, str = content)
    and replays exact, regex, textedit, json_patch, relocate, rename, and delete_file chunks deterministically.
    """
    content: Optional[str] = base_content
    for p in (patch_rows or []):
        chunks = []
        raw_chunks_json = p["chunks_json"] if isinstance(p, dict) or hasattr(p, "__getitem__") else None
        if raw_chunks_json:
            try:
                chunks = json.loads(raw_chunks_json)
            except Exception:
                pass
        if not chunks:
            chunks = [{"search": p["search_block"], "replace": p["replace_block"]}]
        for block in chunks:
            b_type = block.get("type", "exact")
            if b_type not in LEDGER_CHUNK_TYPES:
                raise ValueError(f"Unknown ledger chunk type '{b_type}'. Expected one of {sorted(LEDGER_CHUNK_TYPES)}.")
            if b_type == "delete_file":
                content = None
            elif b_type in ("relocate", "rename", "move_file", "archive_file", "revert"):
                if block.get("replace") is not None:
                    content = block["replace"]
            elif b_type == "textedit":
                ok, new_content, _ = apply_textedit_in_memory(content or "", block, silent=True)
                if ok:
                    content = new_content
            elif b_type == "json_patch":
                if block.get("patch_body"):
                    ok, new_content, _ = apply_json_patch_in_memory(filepath, content or "", block, silent=True)
                    if ok:
                        content = new_content
                elif block.get("replace") is not None:
                    content = block["replace"]
            else:
                ok, new_content, _ = apply_block_in_memory(content or "", block, silent=True)
                if ok:
                    content = new_content
    return content


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
            # Always use '<=' because the target transaction itself may contain the pre-patch snapshot.
            snap = ctx.db.execute("SELECT timestamp, compressed_state FROM bridge_ledger WHERE filepath=? AND is_snapshot=1 AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1", (filepath, target_ts)).fetchone()

            if snap is not None:
                base_state: Optional[str] = (
                    zlib.decompress(snap['compressed_state']).decode('utf-8')
                    if snap['compressed_state'] is not None else None
                )
                start_ts = snap['timestamp']
            else:
                base_state = None
                start_ts = 0

            # 2. Replay patches forward in memory via unified SSOT helper (None = absent, "" = 0-byte, str = content)
            patch_op = "<" if is_initial else "<="
            patches = ctx.db.execute(f"SELECT search_block, replace_block, chunks_json FROM bridge_ledger WHERE filepath=? AND timestamp >= ? AND timestamp {patch_op} ? ORDER BY timestamp ASC", (filepath, start_ts, target_ts)).fetchall()
            content = _replay_ledger_chunks_in_memory(filepath, base_state, patches)

            # 3. Snapshot current state and save reconstructed state as a new transaction
            raw_on_disk = vfs.read(filepath)
            current_on_disk = raw_on_disk or ""
            if content is None:
                if raw_on_disk is None:
                    continue
                compressed_state = zlib.compress(raw_on_disk.encode('utf-8'))
                new_patch_id = f"ptc_{uuid.uuid4().hex[:12]}"
                uri = InSetuURI(filepath)
                repo = uri.repo if uri.repo else (uri.path.partition('/')[0] if '/' in uri.path else "")
                del_chunks_json = json.dumps([{"type": "delete_file", "search": raw_on_disk, "replace": ""}])
                ctx.db.execute('''
                    INSERT INTO bridge_ledger (patch_id, transaction_id, repo, filepath, search_block, replace_block, post_patch_hash, is_snapshot, compressed_state, timestamp, ttl_expires_at, patch_count, chunks_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (new_patch_id, new_tx_id, repo, filepath, f"<<<<<<< REVERT DELETE {target['transaction_id']}", "", "", 1, compressed_state, time.time(), time.time() + 172800.0, 1, del_chunks_json))
                vfs.delete(filepath)
                reverted_count += 1
                continue

            if raw_on_disk is not None and raw_on_disk == content:
                continue
            compressed_state = zlib.compress(raw_on_disk.encode('utf-8')) if raw_on_disk is not None else None
            post_patch_hash = compute_vfs_sha256(content)
            new_patch_id = f"ptc_{uuid.uuid4().hex[:12]}"

            uri = InSetuURI(filepath)
            repo = uri.repo if uri.repo else (uri.path.partition('/')[0] if '/' in uri.path else "")
            rev_chunks_json = json.dumps([{"type": "revert", "search": current_on_disk, "replace": content}])

            ctx.db.execute('''
                INSERT INTO bridge_ledger (patch_id, transaction_id, repo, filepath, search_block, replace_block, post_patch_hash, is_snapshot, compressed_state, timestamp, ttl_expires_at, patch_count, chunks_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (new_patch_id, new_tx_id, repo, filepath, f"<<<<<<< REVERT TO {target['transaction_id']}", content, post_patch_hash, 1, compressed_state, time.time(), time.time() + 172800.0, 1, rev_chunks_json))

            vfs.save(filepath, content)
            reverted_count += 1
        ctx.db.commit()
    return {"status": "success", "message": f"Atomic revert complete. Reverted {reverted_count} file(s)."}
class PatchResolution(TypedDict, total=False):
    selected_uri: str
    approved_gate: str
    allow_deep_search: bool
class BridgeSyncPayload(TypedDict, total=False):
    text: str
    active_files: List[str]
    dry_run: bool
    pinned_repos: List[str]
    allow_deep_search: bool
    ignore_syntax: bool
    confirmed_candidates: Dict[str, str]
    resolutions: Dict[str, PatchResolution]
    unattended: bool
    force: bool
    repair_mode: Literal['off', 'algorithmic', 'ai_assisted']
    auto_heal: bool
    max_heal_passes: int
    target_cell_id: str
    profile_id: str
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
class BridgeTestPayload(TypedDict, total=False):
    repo: Optional[str]
    command: Optional[str]
    target_files: Optional[List[str]]
    timeout: Optional[int]


class BridgeTestApprovePayload(TypedDict):
    """Request schema for a person approving one custom test command for a repository (P5)."""
    repo: str
    command: str


MAX_TEST_TIMEOUT_SECONDS = 600


@bridge_bp.route('test', methods=['POST'], request_schema=BridgeTestPayload, docstring="[sync] Executes the post-syntax test diagnostic gate (JUnit XML primary + exit-code tail fallback) and returns a unified test_diagnostic schema.")
def bridge_run_test_gate(ctx):
    data = ctx.payload or {}
    repos = get_sister_repos(ctx.workspace_id)
    repo = str(data.get("repo") or (repos[0] if repos else "")).strip()
    res = run_repo_test_diagnostics(
        ctx,
        repo=repo,
        command_override=data.get("command"),
        target_files=data.get("target_files"),
        timeout=max(1, min(int(data.get("timeout") or 120), MAX_TEST_TIMEOUT_SECONDS)),
    )
    if res.get("status") == "needs_approval":
        return res, 403
    return res


@bridge_bp.route('test/approve', methods=['POST'], request_schema=BridgeTestApprovePayload, mcp_expose=False, docstring="[sync] Records a person's approval of a custom repository test command. Not exposed over MCP and banned in routines, so agents cannot approve their own commands (P5).")
def bridge_approve_test_command(ctx):
    """Records a person's approval of a custom repository test command; hidden from MCP and banned in routines (P5)."""
    data = ctx.payload or {}
    repo = str(data.get("repo") or "").strip()
    command = str(data.get("command") or "").strip()
    if not repo or not command:
        return {"status": "error", "error": "Both 'repo' and 'command' are required."}, 400
    if repo not in get_sister_repos(ctx.workspace_id):
        return {"status": "error", "error": f"Unknown repository '{repo}'."}, 400
    return {"status": "approved", "repo": repo, "command": command, "signature": approve_command(ctx.workspace_id, "test", repo, command)}


@bridge_bp.route('commit_message', methods=['GET'], request_schema=BridgeCommitMessageQuery, docstring="[sync] Generates a Conventional Commit message and Transaction-ID trailers from bridge_ledger intent comments.")
def bridge_commit_message(ctx):
    data = ctx.payload or {}
    repo = str(data.get("repo") or "").strip() or None
    tx_id = str(data.get("transaction_id") or "").strip() or None
    limit = int(data.get("limit") or 10)
    return generate_commit_message_from_ledger(ctx, repo=repo, transaction_id=tx_id, limit=limit)


class BridgeTurnDiffPayload(TypedDict, total=False):
    transaction_ids: Union[str, List[str]]


@bridge_bp.route('turn_diff', methods=['GET', 'POST'], request_schema=BridgeTurnDiffPayload, docstring="[sync] Collects unified diffs and current file contents for all files modified across one or more bridge_ledger transaction_ids.")
def bridge_turn_diff(ctx):
    data = ctx.payload or {}
    raw_txs = data.get("transaction_ids") or data.get("transaction_id") or []
    if isinstance(raw_txs, str):
        tx_ids = [t.strip() for t in raw_txs.split(",") if t.strip()]
    elif isinstance(raw_txs, list):
        tx_ids = [str(t).strip() for t in raw_txs if str(t).strip()]
    else:
        tx_ids = []

    if not tx_ids:
        latest = ctx.db.execute("SELECT transaction_id FROM bridge_ledger ORDER BY timestamp DESC LIMIT 1").fetchone()
        if latest and latest["transaction_id"]:
            tx_ids = [latest["transaction_id"]]

    if not tx_ids:
        return {"files": [], "diff_text": "", "transaction_ids": []}

    placeholders = ",".join(["?"] * len(tx_ids))
    rows = ctx.db.execute(
        f"SELECT filepath, timestamp FROM bridge_ledger WHERE transaction_id IN ({placeholders}) ORDER BY timestamp ASC",
        tuple(tx_ids),
    ).fetchall()

    earliest_ts_by_file: Dict[str, float] = {}
    for r in rows:
        fp = r["filepath"]
        ts = float(r["timestamp"] or 0.0)
        if fp and (fp not in earliest_ts_by_file or ts < earliest_ts_by_file[fp]):
            earliest_ts_by_file[fp] = ts

    diff_blocks: List[str] = []
    touched_files: List[str] = []
    for fp, first_ts in earliest_ts_by_file.items():
        touched_files.append(fp)
        snap = ctx.db.execute(
            "SELECT timestamp, compressed_state FROM bridge_ledger WHERE filepath=? AND is_snapshot=1 AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1",
            (fp, first_ts),
        ).fetchone()
        if snap is not None:
            init_base: Optional[str] = (
                zlib.decompress(snap["compressed_state"]).decode("utf-8")
                if snap["compressed_state"] is not None else None
            )
            prior_patches = ctx.db.execute(
                "SELECT search_block, replace_block, chunks_json FROM bridge_ledger WHERE filepath=? AND timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC",
                (fp, snap["timestamp"], first_ts),
            ).fetchall()
            base_content = _replay_ledger_chunks_in_memory(fp, init_base, prior_patches) or ""
        else:
            base_content = ""

        current_content = ctx.vfs.read(fp)
        if current_content is None:
            diff_blocks.append(f"=== DELETED FILE: {fp} ===")
            continue
        if not base_content.strip():
            diff_blocks.append(f"=== NEW FILE: {fp} ===\n{current_content}")
            continue
        interleaved = format_interleaved_file_diff(fp, base_content, current_content)
        diff_blocks.append(f"=== MODIFIED FILE (INTERLEAVED AST DIFF): {fp} ===\n{interleaved}")

    return {
        "transaction_ids": tx_ids,
        "files": touched_files,
        "diff_text": "\n\n".join(diff_blocks),
    }


class BridgeCompileTelemetryPayload(TypedDict, total=False):
    limit: Optional[int]


def compile_ai_telemetry_context(ctx, limit: int = 40) -> Dict[str, Any]:
    """
    Compiles a Gather-chunked diagnostic context payload (ctx://contexts/ai_telemetry_context.txt)
    containing tagged LLM telemetry and full before/context/after Bridge AI Auto-Heal case studies.
    All text is scrubbed through S5 outbound secret scrubbing before writing to ctx://contexts/.
    """
    from insetu.core.gather.context_assemble import (
        collect_workspace_secrets as _collect_secrets,
        scrub_outbound_secrets as _scrub_secrets,
    )
    safe_limit = max(1, min(int(limit or 40), 200))
    secrets_set = _collect_secrets(ctx)
    heal_rows = ctx.db.execute(
        "SELECT * FROM bridge_heal_audit ORDER BY timestamp DESC LIMIT ?",
        (safe_limit,),
    ).fetchall()
    llm_rows = []
    try:
        llm_conn = ctx.get_db("llm")
        llm_rows = llm_conn.execute(
            "SELECT * FROM llm_telemetry ORDER BY timestamp DESC LIMIT ?",
            (safe_limit,),
        ).fetchall()
    except Exception:
        pass

    header_lines = [
        "============================================================",
        "INSETU AI TELEMETRY & YOMAMA PATCH HEALER AUDIT PAYLOAD",
        "============================================================",
        "Purpose: Audit the exact windowed file slices, error diagnostics, and instructions provided",
        "to inSetu's Fast/Decision/Thinking LLM calls and Yomama Patch Auto-Healer.",
        "",
    ]

    text_blocks: List[str] = []
    if llm_rows:
        summary_lines = [
            "=== SECTION 1: RECENT TAGGED LLM CALLS (llm_telemetry) ===",
            "caller_tag | tier | model | status | attempts | latency_ms | prompt_chars -> resp_chars | error",
            "-" * 96,
        ]
        for r in llm_rows:
            rk = dict(r)
            err_short = (rk.get("error_message") or "").replace("\n", " ")[:120]
            summary_lines.append(
                f"{rk.get('caller_tag')} | {rk.get('tier')} | {rk.get('model')} | {rk.get('status')} | "
                f"try={rk.get('attempts')} | {rk.get('latency_ms')}ms | "
                f"{rk.get('prompt_chars')}->{rk.get('response_chars')} chars"
                + (f" | ERR: {err_short}" if err_short else "")
            )
            if rk.get("status") != "ok" or int(rk.get("attempts") or 1) > 1:
                summary_lines.append(
                    f"  [Non-Nominal Call Detail ({rk.get('call_id')})]\n"
                    f"  Prompt Excerpt:\n{rk.get('prompt_excerpt', '')[:1200]}\n"
                    f"  Response Excerpt:\n{rk.get('response_excerpt', '')[:1200]}\n"
                )
        text_blocks.append(_scrub_secrets("\n".join(summary_lines) + "\n\n", secrets_set))

    if heal_rows:
        text_blocks.append("=== SECTION 2: YOMAMA PATCH AUTO-HEAL CASE STUDIES (bridge_heal_audit) ===\n\n")
        for idx, hr in enumerate(heal_rows, 1):
            hd = dict(hr)
            case_block = (
                f"============================================================\n"
                f"CASE STUDY #{idx}: [{hd.get('verification_status', '').upper()}] {hd.get('filepath')}\n"
                f"Transaction: {hd.get('transaction_id') or 'uncommitted'} | Pass: {hd.get('pass_number')} | "
                f"Failure Type: {hd.get('failure_type')} | Model: {hd.get('model')} ({hd.get('latency_ms')}ms)\n"
                f"============================================================\n\n"
                f"--- 1. INITIAL FAILURE DIAGNOSTIC ---\n"
                f"{hd.get('original_error')}\n\n"
                f"--- 2. ORIGINAL BROKEN PATCH BLOCK (FROM PRIMARY MODEL) ---\n"
                f"{hd.get('original_block')}\n\n"
                f"--- 3. EXACT INSTRUCTIONS SENT TO HEALER LLM ---\n"
                f"{hd.get('instructions_sent')}\n\n"
                f"--- 4. EXACT WINDOWED BUFFER CONTEXT SENT TO HEALER LLM ---\n"
                f"{hd.get('windowed_context_sent')}\n\n"
                f"--- 5. HEALER LLM RAW OUTPUT ---\n"
                f"{hd.get('healer_raw_output')}\n\n"
                f"--- 6. VERIFICATION OUTCOME AGAINST B_(k-1) ---\n"
                f"Status: {hd.get('verification_status')}\n"
                + (f"Verification Error: {hd.get('verification_error')}\n" if hd.get("verification_error") else "")
                + "\n"
            )
            text_blocks.append(_scrub_secrets(case_block, secrets_set))
    else:
        text_blocks.append("=== SECTION 2: YOMAMA PATCH AUTO-HEAL CASE STUDIES ===\nNo AI patch heal events recorded yet.\n")

    base_uri = "ctx://contexts/ai_telemetry_context.txt"
    compiled_entry = ctx.compile_context(
        base_uri=base_uri,
        header_block="\n".join(header_lines),
        text_blocks=text_blocks,
        files=[base_uri],
        meta={
            "type": "telemetry",
            "domain": "Diagnostics",
            "category": "Diagnostics",
            "title": "AI Telemetry & Patch Healer Audit",
            "desc": f"{len(heal_rows)} heal case(s), {len(llm_rows)} LLM call(s) — chunked for LLM meta-audit.",
            "timestamp": time.time(),
        },
    )
    ctx.save_manifest({base_uri: compiled_entry}, is_full_compile=False)
    return {
        "status": "success",
        "context_uri": base_uri,
        "heal_cases": len(heal_rows),
        "llm_calls": len(llm_rows),
        "chunks": compiled_entry.get("chunks", [base_uri]),
    }


@bridge_bp.route('compile_telemetry', methods=['GET', 'POST'], request_schema=BridgeCompileTelemetryPayload, docstring="[sync] Compiles recent LLM call telemetry and Yomama Patch Auto-Heal case studies (including windowed context sent to the healer) into ctx://contexts/ai_telemetry_context.txt, chunked by Gather max_kb.")
def api_bridge_compile_telemetry(ctx):
    limit = int((ctx.payload or {}).get("limit") or 40)
    return compile_ai_telemetry_context(ctx, limit=limit)


# 3. Background Workers
@bridge_bp.worker("sync_task")
def _background_bridge_sync(
    ctx,
    text: str = "",
    active_files: Optional[List[str]] = None,
    dry_run: bool = False,
    pinned_repos: Optional[List[str]] = None,
    confirmed_candidates: Optional[Dict[str, str]] = None,
    resolutions: Optional[Dict[str, Dict[str, Any]]] = None,
    unattended: bool = False,
    allow_deep_search: bool = False,
    force: bool = False,
    ignore_syntax: bool = False,
    ignore_syntax_errors: bool = False,
    repair_mode: str = "",
    auto_heal: bool = False,
    max_heal_passes: int = 2,
    target_cell_id: Optional[str] = None,
    profile_id: Optional[str] = None,
    job_id: Optional[str] = None,
):
    """
    Executes the bridge matrix off-thread with Two-Tier Signature Memoization.
    When auto_heal=True and one or more patches fail, applies all valid chunks in memory first
    and heals failed chunks in parallel per-file using windowed context against post_valid_buffers.
    If target_cell_id is specified, scopes AI repair strictly to that single patch cell.
    """
    ctx.jobs.update_progress("Analyzing patch matrices and running AST validation...")
    effective_repair_mode = str(repair_mode or "").strip().lower()
    if effective_repair_mode not in ("off", "algorithmic", "ai_assisted"):
        effective_repair_mode = "ai_assisted" if auto_heal else "algorithmic"
    effective_auto_heal = bool(auto_heal or effective_repair_mode == "ai_assisted")
    current_text = text
    sync_payload = {
        "text": current_text,
        "active_files": active_files or [],
        "dry_run": dry_run,
        "pinned_repos": pinned_repos or ["ALL"],
        "confirmed_candidates": confirmed_candidates or {},
        "resolutions": resolutions or {},
        "unattended": unattended,
        "allow_deep_search": allow_deep_search,
        "force": force,
        "ignore_syntax": ignore_syntax,
        "ignore_syntax_errors": ignore_syntax_errors,
        "repair_mode": effective_repair_mode,
    }
    sister_repos = get_sister_repos(ctx.workspace_id)
    _, ws_root = get_workspace_physics(ctx.workspace_id)

    try:
        with ctx.vfs as vfs:
            sync_data, post_valid_buffers, deferred_failures = process_sync_transaction(
                vfs, ctx.workspace_id, sync_payload, sister_repos, ws_root, return_buffers=True, ctx=ctx
            )

        effective_max_passes = max(1, int(max_heal_passes or 2)) if effective_auto_heal else 0
        heal_attempt = 0
        attempted_cell_ids = set()
        healed_cells_map: Dict[str, Any] = {}

        while heal_attempt < effective_max_passes and not sync_data.get("can_commit") and deferred_failures:
            scoped_failures = [
                df for df in deferred_failures
                if (not target_cell_id or df["block"].get("id") == target_cell_id)
                and df["block"].get("id") not in attempted_cell_ids
            ]
            if not scoped_failures:
                break

            heal_attempt += 1
            ctx.jobs.update_progress(
                f"✨ AI-Repairing {len(scoped_failures)} failed chunk(s) in parallel (pass {heal_attempt}/{effective_max_passes})..."
            )

            parsed_all = parse_blocks(current_text)
            all_blocks_by_file: Dict[str, List[Dict[str, Any]]] = {}
            for raw_fp, blks in parsed_all.items():
                canon_fp = str(InSetuURI(raw_fp))
                all_blocks_by_file.setdefault(canon_fp, []).extend(blks)

            # Select the first unattempted failed patch n per file so it is healed against its exact n-1 buffer state
            first_failure_by_file: Dict[str, Dict[str, Any]] = {}
            for df in scoped_failures:
                fp_canon = str(InSetuURI(df["filepath"]))
                if fp_canon not in first_failure_by_file:
                    first_failure_by_file[fp_canon] = df
                    if df["block"].get("id"):
                        attempted_cell_ids.add(df["block"]["id"])

            def _heal_single_file(item: Tuple[str, Dict[str, Any]]) -> Tuple[str, Optional[List[Tuple[str, Dict[str, Any]]]], Optional[str]]:
                fp_key, df_entry = item
                f_blk = df_entry["block"]
                n_minus_1_text = df_entry.get("pre_buffer")
                if n_minus_1_text is None:
                    n_minus_1_text = post_valid_buffers.get(fp_key)
                if n_minus_1_text is None:
                    n_minus_1_text = ctx.vfs.read(fp_key)
                if n_minus_1_text is None:
                    return fp_key, None, f"Target file '{fp_key}' not found for healing."

                err_msg = df_entry["patch_tel"].get("error_message") or df_entry["patch_tel"].get("status") or "Anchor mismatch"
                p_status = df_entry["patch_tel"].get("status") or ""
                focus_lines: List[int] = list(df_entry["patch_tel"].get("ambiguous_lines") or [])
                for m_ln in re.findall(r'\b[Ll]ine\s+(\d+)\b', str(err_msg)):
                    focus_lines.append(int(m_ln))

                windowed_snippet = _extract_windowed_buffer_context(
                    fp_key, n_minus_1_text, [f_blk], extra_focus_lines=focus_lines
                )
                if p_status == "syntax_error" and isinstance(df_entry.get("post_buffer"), str):
                    post_lines = df_entry["post_buffer"].splitlines()
                    err_ln = focus_lines[0] if focus_lines else 1
                    p_start = max(0, err_ln - 20)
                    p_end = min(len(post_lines), err_ln + 20)
                    post_excerpt = "\n".join(
                        f"{idx_l + 1}: {post_lines[idx_l]}" for idx_l in range(p_start, p_end)
                    )
                    windowed_snippet += (
                        f"\n\n=== BROKEN POST-PATCH EXCERPT AROUND SYNTAX ERROR ({err_msg}) ===\n"
                        f"{post_excerpt}"
                    )
                elif f_blk.get("type") == "relocate" and f_blk.get("target_uri"):
                    dst_uri = str(InSetuURI(f_blk["target_uri"]))
                    dst_text = (post_valid_buffers or {}).get(dst_uri) or ctx.vfs.read(dst_uri) or ""
                    if dst_text:
                        windowed_snippet += (
                            f"\n\n=== DESTINATION FILE BUFFER ({dst_uri}) ===\n"
                            f"{dst_text[:8000]}"
                        )

                failed_yomama = _serialize_blocks_to_yomama({fp_key: [f_blk]})
                extra_instructions = (
                    "Rewrite ONLY the failed Yomama patch block above so its SEARCH block matches the exact lines in the "
                    "'FILE STATE AFTER APPLYING VALID PATCHES' (n-1) buffer while preserving its intended changes."
                )
                if p_status == "syntax_error":
                    extra_instructions = (
                        f"This patch anchored, but introduced an AST syntax error ({err_msg}). "
                        "Inspect the 'BROKEN POST-PATCH EXCERPT' above and rewrite the Yomama patch block so the resulting file is syntactically valid."
                    )
                elif df_entry["patch_tel"].get("resolution_type") == "ambiguous_anchor":
                    extra_instructions = (
                        f"This SEARCH block matched multiple locations ({err_msg}). "
                        "Use the comment/intent and the excerpts above to identify the intended location, and include 2-4 additional unchanged surrounding lines in SEARCH so it matches uniquely."
                    )
                elif f_blk.get("type") == "relocate":
                    extra_instructions = (
                        f"The AST RELOCATE directive failed ({err_msg}) — for example, because the symbol is a const/variable assignment rather than a function/class, or was already moved. "
                        "Rewrite it as standard '<<<<<<< FILE:' + '<<<<<<< SEARCH' / '=======' / '>>>>>>> REPLACE' block(s) against the source (and destination, if needed) buffers above."
                    )
                file_heal_prompt = (
                    "All preceding patches (0 .. n-1) for this file have been applied in memory.\n"
                    "The following Yomama patch block (patch n) failed against the n-1 buffer state:\n"
                    f"- {fp_key}: {err_msg}"
                    + f"\n\n--- FAILED PATCH BLOCK TO REPAIR ---\n{failed_yomama}\n\n"
                    + windowed_snippet
                    + f"\n\n{extra_instructions}"
                )
                t_heal_start = time.time()
                failure_kind = (
                    "syntax_error"
                    if p_status == "syntax_error"
                    else (df_entry["patch_tel"].get("resolution_type") or f_blk.get("type") or "anchor_failed")
                )
                h_text = ""
                h_model = ""

                def _log_heal_audit(ver_status: str, ver_err: str = "", healed_yomama_str: str = "") -> None:
                    try:
                        elapsed_ms = int(round((time.time() - t_heal_start) * 1000))
                        ctx.db.insert_or_replace("bridge_heal_audit", {
                            "heal_id": f"heal_{uuid.uuid4().hex[:12]}",
                            "timestamp": time.time(),
                            "transaction_id": sync_data.get("transaction_id") or "",
                            "filepath": fp_key,
                            "cell_id": str(f_blk.get("id") or ""),
                            "pass_number": heal_attempt,
                            "failure_type": str(failure_kind),
                            "original_error": str(err_msg),
                            "original_block": failed_yomama,
                            "windowed_context_sent": windowed_snippet,
                            "instructions_sent": extra_instructions,
                            "healer_raw_output": h_text,
                            "healed_block": healed_yomama_str,
                            "verification_status": ver_status,
                            "verification_error": ver_err,
                            "model": h_model,
                            "latency_ms": elapsed_ms,
                        })
                        ctx.db.commit()
                    except Exception:
                        pass

                try:
                    h_res = ctx.call(
                        "llm.complete",
                        messages=[{"role": "user", "content": file_heal_prompt}],
                        system=(
                            "You are the inSetu Fast-Tier Yomama Patch Healer. "
                            "Preceding patches (0 .. n-1) have already been applied to the file buffer provided. "
                            "Output ONLY the repaired Yomama patch block ('<<<<<<< FILE:' / '<<<<<<< SEARCH' / '=======' / '>>>>>>> REPLACE') that applies cleanly on top of the provided n-1 buffer."
                        ),
                        tier="fast",
                        profile_id=profile_id,
                        output_schema="yomama_patch",
                        caller_tag=f"bridge:patch_heal:{failure_kind}",
                        wait=True,
                    )
                    h_text = h_res.get("text", "") if isinstance(h_res, dict) else str(h_res)
                    h_model = (h_res.get("model") or "") if isinstance(h_res, dict) else ""
                    h_parsed = parse_blocks(h_text)
                    repaired_pairs: List[Tuple[str, Dict[str, Any]]] = []
                    for r_fp, r_blks in h_parsed.items():
                        canon_r_fp = str(InSetuURI(r_fp)) if r_fp else fp_key
                        for rb in r_blks:
                            repaired_pairs.append((canon_r_fp, dict(rb)))
                    if not repaired_pairs:
                        _log_heal_audit("failed_parse", "LLM healer returned no valid Yomama blocks.")
                        return fp_key, None, "LLM healer returned no valid Yomama blocks."

                    base_cell_id = f_blk.get("id")
                    verified_pairs: List[Tuple[str, Dict[str, Any]]] = []
                    running_buffers: Dict[str, str] = {fp_key: n_minus_1_text}

                    for idx_r, (target_r_fp, rep_b) in enumerate(repaired_pairs):
                        if base_cell_id:
                            rep_b["id"] = base_cell_id if len(repaired_pairs) == 1 else f"{base_cell_id}__part_{idx_r + 1}"
                        if not rep_b.get("comment") and f_blk.get("comment"):
                            rep_b["comment"] = f_blk["comment"]

                        buf_for_target = running_buffers.get(target_r_fp)
                        if buf_for_target is None:
                            buf_for_target = (post_valid_buffers or {}).get(target_r_fp) or ctx.vfs.read(target_r_fp) or ""

                        # Immediate In-Memory Verification Gate against B_{k-1}:
                        # Reject any LLM repair that still fails to anchor, is a no-op, or introduces a syntax error!
                        rep_type = rep_b.get("type", "exact")
                        if rep_type in ("exact", "regex", "textedit", "json_patch"):
                            if rep_type == "json_patch":
                                ok_cand, cand_buf, cand_stat = apply_json_patch_in_memory(target_r_fp, buf_for_target, dict(rep_b), silent=True)
                            elif rep_type == "textedit":
                                ok_cand, cand_buf, cand_stat = apply_textedit_in_memory(buf_for_target, dict(rep_b), silent=True)
                            else:
                                ok_cand, cand_buf, cand_stat = apply_block_in_memory(buf_for_target, dict(rep_b), silent=True)
                            if not ok_cand or cand_stat == "no_op":
                                fail_reason = f"Healer candidate failed verification on {target_r_fp} ({cand_stat})."
                                _log_heal_audit(f"failed_{cand_stat}", fail_reason, h_text)
                                return fp_key, None, fail_reason
                            if p_status == "syntax_error":
                                has_syn, syn_msg = _validate_buffer_syntax(ctx, target_r_fp, cand_buf)
                                if has_syn:
                                    fail_reason = f"Healer candidate still has syntax error ({syn_msg})."
                                    _log_heal_audit("failed_syntax", fail_reason, h_text)
                                    return fp_key, None, fail_reason
                            running_buffers[target_r_fp] = cand_buf
                        verified_pairs.append((target_r_fp, rep_b))

                    _log_heal_audit("verified", "", h_text)
                    return fp_key, verified_pairs, None
                except Exception as exc:
                    _log_heal_audit("exception", str(exc), h_text)
                    return fp_key, None, str(exc)

            file_items = list(first_failure_by_file.items())
            if not file_items:
                break

            healed_results = (
                [_heal_single_file(file_items[0])]
                if len(file_items) == 1
                else ctx.jobs.map_parallel(_heal_single_file, file_items)
            )

            any_repaired = False
            heal_errors: List[str] = []
            merged_by_file: Dict[str, List[Dict[str, Any]]] = {
                fp: [dict(b) for b in blks] for fp, blks in all_blocks_by_file.items()
            }
            for fp_key, verified_pairs, err_str in healed_results:
                if err_str or not verified_pairs:
                    if err_str:
                        heal_errors.append(err_str)
                    continue
                df_entry = first_failure_by_file[fp_key]
                orig_blk = df_entry["block"]
                orig_idx = df_entry.get("block_index")
                cell_id = orig_blk.get("id")
                orig_serialized = serialize_block_chunk(orig_blk, filepath=fp_key, include_file_header=False, include_id=False)
                primary_r_fp, primary_rep_blk = verified_pairs[0]
                base_order = orig_blk.get("order")
                if base_order is not None:
                    for idx_vp, (_, vp_blk) in enumerate(verified_pairs):
                        vp_blk["order"] = base_order + (idx_vp * 0.001)

                raw_fp_key = str(InSetuURI(df_entry.get("raw_target_file") or fp_key))
                if raw_fp_key != fp_key and raw_fp_key in merged_by_file:
                    moved_blks = merged_by_file.pop(raw_fp_key)
                    merged_by_file.setdefault(fp_key, []).extend(moved_blks)
                file_blks = merged_by_file.setdefault(fp_key, [])

                replaced_in_place = False
                if cell_id:
                    for target_list in ([file_blks] + [blks for k, blks in merged_by_file.items() if k != fp_key]):
                        for i_b, cand_b in enumerate(target_list):
                            if cand_b.get("id") == cell_id:
                                new_serialized = serialize_block_chunk(primary_rep_blk, filepath=primary_r_fp, include_file_header=False, include_id=False)
                                if orig_serialized != new_serialized or len(verified_pairs) > 1 or primary_r_fp != fp_key:
                                    any_repaired = True
                                same_file_reps = [rb for r_fp, rb in verified_pairs if r_fp == fp_key]
                                target_list[i_b : i_b + 1] = same_file_reps
                                for extra_fp, extra_rb in verified_pairs:
                                    if extra_fp != fp_key:
                                        merged_by_file.setdefault(extra_fp, []).append(extra_rb)
                                replaced_in_place = True
                                break
                        if replaced_in_place:
                            break
                if not replaced_in_place and isinstance(orig_idx, int) and 0 <= orig_idx < len(file_blks):
                    new_serialized = serialize_block_chunk(primary_rep_blk, filepath=primary_r_fp, include_file_header=False, include_id=False)
                    if orig_serialized != new_serialized or len(verified_pairs) > 1 or primary_r_fp != fp_key:
                        any_repaired = True
                    same_file_reps = [rb for r_fp, rb in verified_pairs if r_fp == fp_key]
                    file_blks[orig_idx : orig_idx + 1] = same_file_reps
                    for extra_fp, extra_rb in verified_pairs:
                        if extra_fp != fp_key:
                            merged_by_file.setdefault(extra_fp, []).append(extra_rb)
                    replaced_in_place = True
                if replaced_in_place and cell_id:
                    serialized_cells = [
                        {
                            "id": rb.get("id") or cell_id,
                            "file": r_fp,
                            "content": serialize_block_chunk(rb, filepath=r_fp, include_file_header=False, include_id=False),
                        }
                        for r_fp, rb in verified_pairs
                    ]
                    healed_cells_map[cell_id] = serialized_cells[0] if len(serialized_cells) == 1 else serialized_cells

            if not any_repaired:
                if heal_errors:
                    sync_data["heal_error"] = "; ".join(heal_errors)
                break

            current_text = _serialize_blocks_to_yomama(merged_by_file)
            sync_payload["text"] = current_text
            sync_payload["active_files"] = list(merged_by_file.keys())

            with ctx.vfs as vfs:
                sync_data, post_valid_buffers, deferred_failures = process_sync_transaction(
                    vfs, ctx.workspace_id, sync_payload, sister_repos, ws_root, return_buffers=True, ctx=ctx
                )
            sync_data["healed_attempts"] = heal_attempt
            sync_data["healed_payload"] = current_text
            if healed_cells_map:
                sync_data["healed_cells"] = dict(healed_cells_map)
            if target_cell_id:
                break

        if not sync_data.get("can_commit") and deferred_failures:
            n_minus_1_buffers: Dict[str, str] = {}
            for df in deferred_failures:
                fp = df.get("filepath")
                pre_buf = df.get("pre_buffer")
                if fp and fp not in n_minus_1_buffers and isinstance(pre_buf, str):
                    n_minus_1_buffers[fp] = pre_buf
            for fp, buf in (post_valid_buffers or {}).items():
                if fp not in n_minus_1_buffers and isinstance(buf, str):
                    n_minus_1_buffers[fp] = buf
            if n_minus_1_buffers:
                sync_data["post_valid_buffers"] = n_minus_1_buffers

        if sync_data.get("status") == "committed":
            ctx.jobs.update_progress("Awaiting VFS disk settlement...")
            ctx.sync_vfs_barrier(timeout=5.0)
        return {"message": "Transaction evaluated.", "artifact": sync_data}
    except Exception as e:
        tb_str = traceback.format_exc()
        try:
            ctx.emit_background(
                "system_error",
                source="Bridge:SyncWorker",
                error_type=type(e).__name__,
                message=str(e),
                traceback=tb_str,
                payload="",
            )
        except Exception:
            pass
        err_tel = json.loads(execute_bridge_sync(ctx.workspace_id, sync_payload, ctx=ctx))
        err_tel["worker_error"] = f"{type(e).__name__}: {e}"
        err_tel["heal_error"] = err_tel.get("heal_error") or f"{type(e).__name__}: {e}"
        return {"message": err_tel.get("message", f"Transaction failed ({type(e).__name__}: {e})."), "artifact": err_tel}


@bridge_bp.worker("sweep_ledger")
def _sweep_ledger_worker(ctx, job_id: Optional[str] = None):
    """Metronome TTL Housekeeping: Purges historical rows older than 48 hours and bounds bridge_heal_audit."""
    now = time.time()
    try:
        ctx.db.execute("DELETE FROM bridge_ledger WHERE ttl_expires_at IS NOT NULL AND ttl_expires_at < ?", (now,))
        ctx.db.execute(
            "DELETE FROM bridge_heal_audit WHERE heal_id NOT IN (SELECT heal_id FROM bridge_heal_audit ORDER BY timestamp DESC LIMIT 250)"
        )
        ctx.db.commit()
        ctx.jobs.update_progress("Ledger swept successfully.")
    except Exception as e:
        ctx.jobs.update_progress(f"Ledger sweep failed: {e}")