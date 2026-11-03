import uuid
import json
import time
import hashlib
import zlib
import difflib
import traceback
from typing import TypedDict, Literal, List, Dict, Optional, Any, Union, Tuple
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import approve_test_command, InSetuURI, get_sister_repos, get_workspace_physics
# Import the extracted math & validation logic
from .parser import parse_blocks
from .bridge_fuzzy import apply_block_in_memory, apply_textedit_in_memory, apply_json_patch_in_memory
from .bridge_vfs import execute_bridge_sync, _process_sync_transaction
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
def _replay_ledger_chunks_in_memory(filepath: str, base_content: str, patch_rows: List[Any]) -> str:
    """
    Single Source of Truth forward-replay engine for bridge_ledger records.
    Replays exact, regex, textedit, json_patch, and delete_file chunks deterministically.
    """
    content = base_content or ""
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
            if b_type == "delete_file":
                content = "__DELETED_FILE__"
            elif b_type == "textedit":
                ok, new_content, _ = apply_textedit_in_memory(content, block, silent=True)
                if ok:
                    content = new_content
            elif b_type == "json_patch":
                if block.get("patch_body"):
                    ok, new_content, _ = apply_json_patch_in_memory(filepath, content, block, silent=True)
                    if ok:
                        content = new_content
                elif block.get("replace") is not None:
                    content = block["replace"]
            else:
                ok, new_content, _ = apply_block_in_memory(content, block, silent=True)
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
            # Bugfix: Always use '<=' because the target transaction itself may contain the pre-patch snapshot.
            snap = ctx.db.execute("SELECT timestamp, compressed_state FROM bridge_ledger WHERE filepath=? AND is_snapshot=1 AND timestamp <= ? ORDER BY timestamp DESC LIMIT 1", (filepath, target_ts)).fetchone()

            if snap and snap['compressed_state']:
                content = zlib.decompress(snap['compressed_state']).decode('utf-8')
                start_ts = snap['timestamp']
            else:
                content = ""
                start_ts = 0
            # 2. Replay patches forward in memory via unified SSOT helper
            patch_op = "<" if is_initial else "<="
            patches = ctx.db.execute(f"SELECT search_block, replace_block, chunks_json FROM bridge_ledger WHERE filepath=? AND timestamp >= ? AND timestamp {patch_op} ? ORDER BY timestamp ASC", (filepath, start_ts, target_ts)).fetchall()
            content = _replay_ledger_chunks_in_memory(filepath, content, patches)

            # 3. Snapshot current state and save reconstructed state as a new transaction
            raw_on_disk = vfs.read(filepath)
            current_on_disk = raw_on_disk or ""
            if content == "__DELETED_FILE__" or (not snap and is_initial and raw_on_disk is not None):
                if raw_on_disk is None:
                    continue
                compressed_state = zlib.compress(current_on_disk.encode('utf-8'))
                new_patch_id = f"ptc_{uuid.uuid4().hex[:12]}"
                uri = InSetuURI(filepath)
                repo = uri.repo if uri.repo else (uri.path.partition('/')[0] if '/' in uri.path else "")
                ctx.db.execute('''
                    INSERT INTO bridge_ledger (patch_id, transaction_id, repo, filepath, search_block, replace_block, post_patch_hash, is_snapshot, compressed_state, timestamp, ttl_expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (new_patch_id, new_tx_id, repo, filepath, f"<<<<<<< REVERT DELETE {target['transaction_id']}", "", "", 1, compressed_state, time.time(), time.time() + 172800.0))
                vfs.delete(filepath)
                reverted_count += 1
                continue

            if raw_on_disk is not None and current_on_disk == content:
                continue
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
    return {"status": "approved", "repo": repo, "command": command, "signature": approve_test_command(ctx.workspace_id, repo, command)}


@bridge_bp.route('commit_message', methods=['GET'], request_schema=BridgeCommitMessageQuery, docstring="[sync] Generates a Conventional Commit message and Transaction-ID trailers from bridge_ledger intent comments.")
def bridge_commit_message(ctx):
    data = ctx.payload or {}
    repo = str(data.get("repo") or "").strip() or None
    tx_id = str(data.get("transaction_id") or "").strip() or None
    limit = int(data.get("limit") or 10)
    return generate_commit_message_from_ledger(ctx, repo=repo, transaction_id=tx_id, limit=limit)


class BridgeMergeBlocksPayload(TypedDict, total=False):
    original_text: str
    healed_blocks: Union[str, List[str]]
    failed_cell_ids: Optional[List[str]]


@bridge_bp.route('merge_blocks', methods=['POST'], request_schema=BridgeMergeBlocksPayload, docstring="[sync] Merges healed Yomama patch blocks in-place at their canonical positions for iterative self-healing.")
def bridge_merge_blocks(ctx):
    data = ctx.payload or {}
    original_text = str(data.get("original_text") or "")
    raw_healed = data.get("healed_blocks") or ""
    if isinstance(raw_healed, list):
        healed_text = "\n\n".join(str(x) for x in raw_healed if x)
    else:
        healed_text = str(raw_healed)
    failed_ids = set(data.get("failed_cell_ids") or [])

    parsed_orig = parse_blocks(original_text)
    parsed_healed = parse_blocks(healed_text)
    healed_queues_by_file: Dict[str, List[Dict[str, Any]]] = {}
    for raw_h_fp, h_blks in parsed_healed.items():
        canon_h_fp = str(InSetuURI(raw_h_fp))
        healed_queues_by_file.setdefault(canon_h_fp, []).extend(h_blks)

    merged_by_file: Dict[str, List[Dict[str, Any]]] = {}
    for raw_fp, blks in parsed_orig.items():
        canon_fp = str(InSetuURI(raw_fp))
        h_queue = healed_queues_by_file.get(canon_fp, [])
        for b in blks:
            if b.get("id") and b.get("id") in failed_ids:
                if h_queue:
                    rep_b = dict(h_queue.pop(0))
                    if not rep_b.get("id"):
                        rep_b["id"] = b["id"]
                    if not rep_b.get("comment") and b.get("comment"):
                        rep_b["comment"] = b["comment"]
                    merged_by_file.setdefault(canon_fp, []).append(rep_b)
                continue
            merged_by_file.setdefault(canon_fp, []).append(b)

    for canon_h_fp, rem_blks in healed_queues_by_file.items():
        if rem_blks:
            merged_by_file.setdefault(canon_h_fp, []).extend(rem_blks)

    merged_text = _serialize_blocks_to_yomama(merged_by_file)
    return {
        "status": "success",
        "text": merged_text,
        "active_files": list(merged_by_file.keys()),
    }


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
        if snap and snap["compressed_state"]:
            base_content = zlib.decompress(snap["compressed_state"]).decode("utf-8")
            prior_patches = ctx.db.execute(
                "SELECT search_block, replace_block, chunks_json FROM bridge_ledger WHERE filepath=? AND timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC",
                (fp, snap["timestamp"], first_ts),
            ).fetchall()
            base_content = _replay_ledger_chunks_in_memory(fp, base_content, prior_patches)
            if base_content == "__DELETED_FILE__":
                base_content = ""
        else:
            base_content = ""

        current_content = ctx.vfs.read(fp) or ""
        udiff = "\n".join(
            difflib.unified_diff(
                base_content.splitlines(),
                current_content.splitlines(),
                fromfile=f"a/{fp}",
                tofile=f"b/{fp}",
                lineterm="",
            )
        )
        diff_blocks.append(f"=== FILE: {fp} ===\n{udiff}\n\n--- CURRENT FILE CONTENT: {fp} ---\n{current_content}")

    return {
        "transaction_ids": tx_ids,
        "files": touched_files,
        "diff_text": "\n\n".join(diff_blocks),
    }
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
            b_type = b.get("type", "exact")
            if b_type in ("relocate", "rename", "move_file", "archive_file", "delete_file"):
                header_map = {
                    "relocate": "<<<<<<< RELOCATE",
                    "rename": "<<<<<<< RENAME",
                    "move_file": "<<<<<<< MOVE_FILE",
                    "archive_file": "<<<<<<< ARCHIVE_FILE",
                    "delete_file": "<<<<<<< DELETE_FILE",
                }
                raw_dir = b.get("raw_directive", "")
                if not raw_dir:
                    if b_type == "move_file":
                        raw_dir = f"FROM: {b.get('source_uri') or fp}\nTO: {b.get('target_uri') or ''}"
                    elif b_type in ("archive_file", "delete_file"):
                        raw_dir = f"FILE: {b.get('source_uri') or fp}"
                file_lines.append(f"{header_map[b_type]}\n{raw_dir}\n>>>>>>> EXECUTE")
            elif b_type == "json_patch":
                body_str = b.get("patch_body") or b.get("raw_directive") or b.get("replace", "")
                file_lines.append(f"<<<<<<< JSON_PATCH\n{body_str}\n>>>>>>> REPLACE")
            elif b_type == "textedit" and b.get("raw_textedit"):
                file_lines.append(f"<<<<<<< TEXTEDIT\n{b['raw_textedit']}\n>>>>>>> REPLACE")
            else:
                search_header = "<<<<<<< SEARCH REGEX" if b_type == "regex" else "<<<<<<< SEARCH"
                file_lines.append(f"{search_header}\n{b.get('search', '')}\n=======\n{b.get('replace', '')}\n>>>>>>> REPLACE")
        chunks.append("\n".join(file_lines))
    return "\n\n".join(chunks)


def _extract_windowed_buffer_context(
    filepath: str,
    buffer_text: str,
    failed_blocks: List[Dict[str, Any]],
    window_radius: int = 80,
    full_file_threshold_lines: int = 400,
) -> str:
    """
    Extracts a compact +/- window_radius line slice around each failed block's closest
    SequenceMatcher anchor when a file exceeds full_file_threshold_lines, reducing healer
    prompt token size by 70-90% on large files.
    """
    file_lines = buffer_text.splitlines()
    total_lines = len(file_lines)
    if total_lines <= full_file_threshold_lines:
        return f"=== FILE STATE AFTER APPLYING VALID PATCHES: {filepath} (Lines 1-{total_lines}) ===\n{buffer_text}"

    spans: List[Tuple[int, int]] = []
    for fb in failed_blocks:
        s_lines = (fb.get("search") or "").splitlines()
        if not s_lines:
            spans.append((0, min(total_lines, window_radius * 2)))
            continue
        matcher = difflib.SequenceMatcher(None, file_lines, s_lines)
        match = matcher.find_longest_match(0, total_lines, 0, len(s_lines))
        approx_start = max(0, match.a - match.b)
        w_start = max(0, approx_start - window_radius)
        w_end = min(total_lines, approx_start + len(s_lines) + window_radius)
        spans.append((w_start, w_end))

    spans.sort(key=lambda x: x[0])
    merged_spans: List[Tuple[int, int]] = []
    for s_start, s_end in spans:
        if merged_spans and s_start <= merged_spans[-1][1] + 10:
            merged_spans[-1] = (merged_spans[-1][0], max(merged_spans[-1][1], s_end))
        else:
            merged_spans.append((s_start, s_end))

    window_strs = [f"=== FILE STATE AFTER APPLYING VALID PATCHES: {filepath} (Windowed Excerpts of {total_lines} lines) ==="]
    for w_start, w_end in merged_spans:
        excerpt = "\n".join(file_lines[w_start:w_end])
        window_strs.append(f"--- Lines {w_start + 1}..{w_end} of {filepath} ---\n{excerpt}")
    return "\n\n".join(window_strs)


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
    }
    sister_repos = get_sister_repos(ctx.workspace_id)
    _, ws_root = get_workspace_physics(ctx.workspace_id)

    try:
        with ctx.vfs as vfs:
            sync_data, post_valid_buffers, deferred_failures = _process_sync_transaction(
                vfs, ctx.workspace_id, sync_payload, sister_repos, ws_root, return_buffers=True, ctx=ctx
            )

        effective_max_passes = max(1, int(max_heal_passes or 2)) if auto_heal else 0
        heal_attempt = 0

        while heal_attempt < effective_max_passes and not sync_data.get("can_commit") and deferred_failures:
            scoped_failures = (
                [df for df in deferred_failures if df["block"].get("id") == target_cell_id]
                if target_cell_id
                else list(deferred_failures)
            )
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

            # Group failures by file and select the FIRST failed patch n per file so it is healed
            # strictly against its n-1 buffer state (pre_buffer) and substituted in-place at index n.
            first_failure_by_file: Dict[str, Dict[str, Any]] = {}
            for df in scoped_failures:
                fp_canon = str(InSetuURI(df["filepath"]))
                if fp_canon not in first_failure_by_file:
                    first_failure_by_file[fp_canon] = df

            def _heal_single_file(item: Tuple[str, Dict[str, Any]]) -> Tuple[str, Optional[Dict[str, Any]], Optional[str]]:
                fp_key, df_entry = item
                f_blk = df_entry["block"]
                n_minus_1_text = df_entry.get("pre_buffer")
                if n_minus_1_text is None:
                    n_minus_1_text = post_valid_buffers.get(fp_key)
                if n_minus_1_text is None:
                    n_minus_1_text = ctx.vfs.read(fp_key)
                if n_minus_1_text is None:
                    return fp_key, None, f"Target file '{fp_key}' not found for healing."

                windowed_snippet = _extract_windowed_buffer_context(fp_key, n_minus_1_text, [f_blk])
                failed_yomama = _serialize_blocks_to_yomama({fp_key: [f_blk]})
                err_msg = df_entry["patch_tel"].get("error_message") or df_entry["patch_tel"].get("status") or "Anchor mismatch"
                file_heal_prompt = (
                    "All preceding patches (0 .. n-1) for this file have been applied in memory.\n"
                    "The following Yomama patch block (patch n) failed to anchor (or had a syntax error) against the n-1 buffer state:\n"
                    f"- {fp_key}: {err_msg}"
                    + f"\n\n--- FAILED PATCH BLOCK TO REPAIR ---\n{failed_yomama}\n\n"
                    + windowed_snippet
                    + "\n\nRewrite ONLY the failed Yomama patch block above so its SEARCH block matches the exact lines in the 'FILE STATE AFTER APPLYING VALID PATCHES' (n-1) buffer while preserving its intended changes."
                )
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
                        wait=True,
                    )
                    h_text = h_res.get("text", "") if isinstance(h_res, dict) else str(h_res)
                    h_parsed = parse_blocks(h_text)
                    repaired_list: List[Dict[str, Any]] = []
                    for _, r_blks in h_parsed.items():
                        repaired_list.extend(r_blks)
                    if not repaired_list:
                        return fp_key, None, "LLM healer returned no valid Yomama blocks."
                    rep_b = dict(repaired_list[0])
                    if not rep_b.get("id") and f_blk.get("id"):
                        rep_b["id"] = f_blk["id"]
                    if not rep_b.get("comment") and f_blk.get("comment"):
                        rep_b["comment"] = f_blk["comment"]
                    return fp_key, rep_b, None
                except Exception as exc:
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
            for fp_key, repaired_blk, err_str in healed_results:
                if err_str or repaired_blk is None:
                    if err_str:
                        heal_errors.append(err_str)
                    continue
                any_repaired = True
                df_entry = first_failure_by_file[fp_key]
                orig_blk = df_entry["block"]
                orig_idx = df_entry.get("block_index")
                file_blks = merged_by_file.get(fp_key, [])
                replaced_in_place = False
                if orig_blk.get("id"):
                    for i_b, cand_b in enumerate(file_blks):
                        if cand_b.get("id") == orig_blk.get("id"):
                            file_blks[i_b] = repaired_blk
                            replaced_in_place = True
                            break
                if not replaced_in_place and isinstance(orig_idx, int) and 0 <= orig_idx < len(file_blks):
                    file_blks[orig_idx] = repaired_blk
                    replaced_in_place = True
                if not replaced_in_place:
                    for i_b, cand_b in enumerate(file_blks):
                        if cand_b.get("search") == orig_blk.get("search") and cand_b.get("replace") == orig_blk.get("replace"):
                            file_blks[i_b] = repaired_blk
                            break

            if heal_errors and not any_repaired:
                sync_data["heal_error"] = "; ".join(heal_errors)
                break

            current_text = _serialize_blocks_to_yomama(merged_by_file)
            sync_payload["text"] = current_text
            sync_payload["active_files"] = list(merged_by_file.keys())

            with ctx.vfs as vfs:
                sync_data, post_valid_buffers, deferred_failures = _process_sync_transaction(
                    vfs, ctx.workspace_id, sync_payload, sister_repos, ws_root, return_buffers=True, ctx=ctx
                )
            sync_data["healed_attempts"] = heal_attempt
            sync_data["healed_payload"] = current_text
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
    """Metronome TTL Housekeeping: Purges historical rows older than 48 hours."""
    now = time.time()
    try:
        ctx.db.execute("DELETE FROM bridge_ledger WHERE ttl_expires_at IS NOT NULL AND ttl_expires_at < ?", (now,))
        ctx.db.commit()
        ctx.jobs.update_progress("Ledger swept successfully.")
    except Exception as e:
        ctx.jobs.update_progress(f"Ledger sweep failed: {e}")