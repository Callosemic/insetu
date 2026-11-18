from pathlib import Path
from datetime import datetime
import os
import re
import time
import uuid
import json
import threading
from typing import TypedDict, List, Dict, Any, Optional, Union, Literal, Tuple
from insetu.core.sdk import InSetuExtension, slugify
from insetu.core.utils_core import InSetuURI, get_available_contexts
from .commands import (
    parse_colon_command_tokens as _parse_colon_command_tokens,
    parse_slash_command as _parse_slash_command,
)
from .envelope import RoutineEnvelope
from .plan_ledger import (
    apply_task_manage_actions as _apply_task_manage_actions,
    complete_and_advance_plan_task as _complete_and_advance_plan_task,
    ensure_plan_file_payload as _ensure_plan_file_payload,
    finalize_completed_turn_state,
    persist_paused_turn_state,
    process_turn_task_directives as _process_turn_task_directives,
    promote_ephemeral_plan_to_file as _promote_ephemeral_plan_to_file,
    record_committed_bridge_transaction as _record_committed_bridge_transaction,
)
from .session_ledger import (
    append_session_message as _append_session_message,
    compact_session_history as _compact_session_history,
    delete_session_message_and_invalidate as _delete_session_message_and_invalidate,
    load_session_messages_state as _load_session_messages_state,
    reconcile_working_set_ttl as _reconcile_ws_ttl,
    rewind_session_to_message as _rewind_session_to_message,
)
from .schemas.plan import (
    format_active_plan_meta_projection as _format_active_plan_meta,
)
from insetu.core.llm.llm_telemetry import (
    resolve_session_budget_state as _resolve_session_budget_state,
    telemetry_session_scope as _telemetry_session_scope,
)
from .routine_loader import (
    delete_routine_override_payload as _delete_routine_override_payload,
    list_available_routines,
    load_routine_definition,
    save_routine_definition_payload as _save_routine_definition_payload,
)
from insetu.core.agent.routine_check import attach_routine_problems, forget_routine_problems
from insetu.core.bridge.bridge_test import (
    resolve_test_command_payload as _resolve_test_command_payload,
    run_repo_test_diagnostics,
)
from insetu.core.bridge.parser import strip_yomama_blocks_keep_prose
from insetu.core.gather.context_assemble import compile_query_quickpack, discover_constitution_files
from insetu.core.step_timer import StepTimer
from .orchestrator import execute_declarative_routine

AGENT_SETTINGS_SCHEMA = [
    {
        "id": "helper_mode", "label": "Substrate Helper Mode (RAG Scout, History Compaction & Patch Healer)",
        "type": "select", "scope": "workspace", "default": "ai_assisted",
        "options": [
            {"value": "deterministic", "label": "Deterministic Only (0-Token AST Blast Radius, Receipts & Sandwich Healer)"},
            {"value": "ai_assisted", "label": "AI-Assisted (Fast-Tier LLM Context Scout, Compactor & Patch Auto-Healer)"}
        ],
        "description": "Single switch governing whether RAG scouting, rolling history compaction, and Yomama patch repair use 0-token deterministic algorithms or Fast-tier LLM assistance."
    },
    {
        "id": "run_tests_on_code", "label": "Run Diagnostic Test Gate After /code Commits",
        "type": "boolean", "scope": "workspace", "default": False,
        "description": "Automatically runs bridge.test (JUnit XML + fallback) after syntax-valid /code commits."
    },
    {
        "id": "strict_test_enforcement", "label": "Strict Test Gate Enforcement (Rollback on Test Failure)",
        "type": "boolean", "scope": "workspace", "default": False,
        "description": "When enabled, failing unit tests trigger up to 2 self-heal retries before rolling back to the zlib snapshot. Prose agent directives live in the Markdown body of agent.md across user, workspace, and repository tiers."
    },
    {
        "id": "budget_limit_usd", "label": "Initial Session Budget Checkpoint ($X_0 in USD)",
        "type": "number", "scope": "workspace", "default": 1.0,
        "description": "Initial cumulative session spend threshold ($X) before pausing an automated API turn for confirmation."
    },
    {
        "id": "budget_step_usd", "label": "Session Budget Increment Step (+$Y in USD)",
        "type": "number", "scope": "workspace", "default": 1.0,
        "description": "Amount (+$Y) added to the session budget ceiling (X_new = X_old + Y) each time you confirm Resume Turn or complete a Web-Chat handoff past the watermark."
    },
    {
        "id": "auto_complete_plan_tasks", "label": "Auto-Complete Plan Step & Advance on Patch Commit",
        "type": "boolean", "scope": "workspace", "default": False,
        "description": "When enabled, clicking Confirm & Commit on a staged patch stack automatically marks the active plan step complete and starts the next step's turn/handoff."
    }
]

AGENT_SCHEMA = {
    "chat_sessions": {
        "session_id": "TEXT PRIMARY KEY", "title": "TEXT", "updated_at": "REAL", "last_transaction_id": "TEXT",
        "active_job_id": "TEXT", "summary": "TEXT DEFAULT ''", "compacted_view_json": "TEXT DEFAULT '{}'",
        "web_chat_state_json": "TEXT DEFAULT '{}'", "working_set_json": "TEXT DEFAULT '[]'",
        "token_ledger_json": "TEXT DEFAULT '{}'", "active_plan_path": "TEXT DEFAULT ''",
        "active_plan_json": "TEXT DEFAULT '{}'", "checkpoint_json": "TEXT DEFAULT 'null'",
        "seq_counter": "INTEGER DEFAULT 0", "archived": "INTEGER DEFAULT 0"
    },
    "chat_messages": {
        "message_id": "TEXT PRIMARY KEY", "session_id": "TEXT", "seq": "INTEGER DEFAULT 0", "role": "TEXT",
        "content": "TEXT", "raw_content": "TEXT", "receipt": "TEXT DEFAULT ''", "transaction_id": "TEXT DEFAULT ''",
        "compacted_into_id": "TEXT DEFAULT ''", "timestamp": "REAL", "turn_index": "INTEGER DEFAULT 0",
        "context_hashes_json": "TEXT DEFAULT '{}'"
    }
}

_CANCELLED_SESSIONS = set()
_CANCEL_LOCK = threading.Lock()
agent_bp = InSetuExtension(
    'agent', __name__, title="Agent Harness",
    description="Autonomous LLM agent and declarative Markdown-as-Code / YAML routine orchestrator.",
    core=True, schema=AGENT_SCHEMA, settings_schema=AGENT_SETTINGS_SCHEMA,
    volumes={"routines": {"scheme": "ctx", "tier": "data", "path_key": "routines_dir", "module_subdir": "routines", "legacy_dirs": ["routines", "data/agent/routines"]}},
)
__depends__ = ['topology', 'llm', 'gather', 'bridge']


@agent_bp.on('pre_file_save')
def _handle_routine_response_pre_save(workspace_id=None, filepath=None, content=None, data=None, **kwargs):
    forget_routine_problems(workspace_id, filepath or "")
    if not data or not filepath or "{date}" not in str(data.get("original_response_path") or "") or not data.get("archive_path"):
        return
    ctx = agent_bp.get_context(workspace_id)
    file_uri = InSetuURI(filepath)
    prefix = Path(data["original_response_path"]).name.split("{date}")[0]
    logical_dir = str(file_uri.parent_uri)
    archive_uri = file_uri.resolve_sibling_uri(data["archive_path"])
    for walk_path in ctx.vfs.walk(logical_dir):
        if walk_path != str(file_uri) and str(InSetuURI(walk_path).parent_uri) == logical_dir and InSetuURI(walk_path).basename.startswith(prefix):
            old_c = ctx.vfs.read(walk_path)
            if old_c is not None:
                ctx.vfs.save(str(archive_uri.join(InSetuURI(walk_path).basename)), old_c)
                ctx.vfs.delete(walk_path, data={"ignore_ledger": True})


ChatSessionPayload = TypedDict("ChatSessionPayload", {"title": str})
ChatSessionManagePayload = TypedDict("ChatSessionManagePayload", {"session_id": str, "title": str, "archived": bool}, total=False)


def _synthesize_session_title_from_prompt(raw_prompt: str) -> str:
    """Derives a concise, human-readable conversation title from the first user prompt."""
    cleaned = re.sub(r'^/(?:user:[a-zA-Z0-9_:-]+|[a-zA-Z0-9_:-]+)\s*', '', (raw_prompt or '').strip())
    if not cleaned or cleaned.startswith("<<<<<<<"):
        return ""
    first_line = next((ln.strip() for ln in cleaned.splitlines() if ln.strip()), "")
    first_line = re.sub(r'vfs://[A-Za-z0-9_./-]+/([A-Za-z0-9_.-]+)', r'\1', first_line)
    if len(first_line) > 54:
        first_line = first_line[:51].rstrip() + "..."
    return first_line
ChatPromptPayload = TypedDict("ChatPromptPayload", {
    "session_id": str, "prompt": str, "mode": str, "profile_id": str, "attached_files": List[str],
    "read_only_files": List[str], "pinned_repos": List[str], "routine_id": str, "transport": str,
    "web_chat_window_mode": str, "handoff_responses": Dict[str, str], "resume_checkpoint": bool,
}, total=False)
AgentSessionActionPayload = TypedDict("AgentSessionActionPayload", {"session_id": str, "transaction_id": str, "committed_files": List[str], "action": str, "task_id": str, "repo": str, "task_actions": List[Dict[str, Any]]}, total=False)


@agent_bp.route('record_transaction', methods=['POST'], request_schema=AgentSessionActionPayload, risk="ui_only", mcp_expose=False, docstring="[sync] Records a committed Yomama Bridge transaction and its modified files on the active chat session so /undo, plan steps, and working-set TTL stay synchronized.")
def api_record_session_transaction(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    tx_id = str(data.get("transaction_id") or "").strip()
    if not session_id or not tx_id:
        return {"error": "session_id and transaction_id are required"}, 400
    return _record_committed_bridge_transaction(ctx, session_id, tx_id, data.get("committed_files") or [])


@agent_bp.route('plan_task', methods=['POST'], request_schema=AgentSessionActionPayload, risk="ui_only", mcp_expose=False, docstring="[sync] Marks an active plan task complete and advances to the next step, applies TASK_MANAGE directives, or promotes an ephemeral session plan into a canonical docs/plans/*.md file.")
def api_agent_plan_task(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    action = str(data.get("action") or "complete_and_advance").strip().lower()
    if not session_id:
        return {"error": "session_id is required"}, 400
    if action == "promote_to_file":
        return _promote_ephemeral_plan_to_file(ctx, session_id, repo=data.get("repo"))
    if action == "apply_task_actions":
        return _apply_task_manage_actions(ctx, session_id, data.get("task_actions") or [], reconcile_ws_fn=_reconcile_ws_ttl)
    return _complete_and_advance_plan_task(
        ctx, session_id, task_id=data.get("task_id"), transaction_id=data.get("transaction_id")
    )


@agent_bp.route('routines', methods=['GET'], docstring="[sync] Lists all available declarative Markdown-as-Code (.md) and YAML (.yaml) routines with wavefront metadata and available contexts/prompts.")
def get_routines(ctx):
    timer = StepTimer()
    routines = timer.mark("check_routines", attach_routine_problems(ctx, timer.mark("list_routines", list_available_routines(ctx))))
    expected_contexts = timer.mark("contexts", get_available_contexts(ctx.workspace_id, exclusion_flags=["exclude_from_context"], exclude_types=["diff"]))
    is_base = lambda n: bool(n and isinstance(n, str) and not re.search(r'_part\d+\.txt$', n))
    return {
        "routines": routines,
        "available_contexts": sorted([c for c in expected_contexts if is_base(c)]),
        "available_diffs": sorted([d for d in set(timer.mark("diffs", ctx.emit_merge_list('request_available_diffs'))) if is_base(d)]),
        "available_prompts": sorted([p for p in timer.mark("prompts", ctx.emit_merge_list('request_available_prompts')) if isinstance(p, str)]),
        "timings_ms": timer.ms,
    }


RoutineSavePayload = TypedDict("RoutineSavePayload", {
    "id": str, "title": str, "name": str, "domain": str, "description": str, "slash_command": str,
    "scope": str, "transport": str, "original_id": Optional[str], "includes": Optional[List[str]],
    "show_if_exists": Optional[List[str]], "show_if_missing": Optional[List[str]], "include_prompt": Optional[str],
    "response_path": Optional[str], "archive_path": Optional[str], "nodes": Optional[List[Dict[str, Any]]],
    "routine": Optional[Dict[str, Any]], "raw_content": Optional[str], "markdown_text": Optional[str],
}, total=False)


@agent_bp.route('routines/save', methods=['POST'], request_schema=RoutineSavePayload, docstring="[sync] Validates and saves or forks a declarative routine in ctx://routines/ or ctx://routines/.templates/user/.")
def api_save_routine(ctx):
    return _save_routine_definition_payload(ctx, ctx.payload or {})


RoutineDeletePayload = TypedDict("RoutineDeletePayload", {"id": str, "filepath": Optional[str], "scope": Optional[str]}, total=False)


@agent_bp.route('routines/delete', methods=['POST'], request_schema=RoutineDeletePayload, docstring="[sync] Deletes a workspace or user-template routine override (reverting to the built-in template if one exists).")
def api_delete_routine(ctx):
    return _delete_routine_override_payload(ctx, ctx.payload or {})


EnsurePlanFilePayload = TypedDict("EnsurePlanFilePayload", {"repo": Optional[str], "title": Optional[str], "plan_uri": Optional[str]}, total=False)


@agent_bp.route('ensure_plan_file', methods=['POST'], request_schema=EnsurePlanFilePayload, docstring="[sync] Resolves or creates a canonical Markdown plan file URI for the /plan routine.")
def api_ensure_plan_file(ctx):
    return _ensure_plan_file_payload(ctx, ctx.payload or {})


ResolveTestCommandPayload = TypedDict("ResolveTestCommandPayload", {"repo": Optional[str], "target": Optional[str]}, total=False)
@agent_bp.route('resolve_test_command', methods=['GET', 'POST'], request_schema=ResolveTestCommandPayload, docstring="[sync] Inspects workspace repository configuration files to determine the appropriate test runner command.")
def api_resolve_test_command(ctx):
    return _resolve_test_command_payload(ctx, ctx.payload or {})
AgentRunTestPayload = TypedDict("AgentRunTestPayload", {"repo": Optional[str], "command": Optional[str], "target": Optional[str], "timeout": Optional[int]}, total=False)


@agent_bp.route('run_test', methods=['POST'], request_schema=AgentRunTestPayload, docstring="[sync] Executes an approved repository test command via the unified bridge test runner and slices failures for triage.")
def api_agent_run_test(ctx):
    data = ctx.payload or {}
    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    repo = str(data.get("repo") or (repos[0] if repos else "")).strip()
    target_str = str(data.get("target") or "").strip()
    target_files = [target_str] if target_str else None
    diag_res = run_repo_test_diagnostics(
        ctx,
        repo=repo,
        command_override=data.get("command"),
        target_files=target_files,
        timeout=max(1, min(int(data.get("timeout") or 120), 120)),
    )
    if diag_res.get("status") == "needs_approval":
        return diag_res, 403
    norm_status = "passed" if diag_res.get("exit_code") == 0 else "failed"
    return {**diag_res, "status": norm_status}

@agent_bp.route('sessions', methods=['GET'], docstring="[sync] Retrieves lightweight metadata for all chat sessions in the active workspace.")
def get_sessions(ctx):
    try:
        rows = [dict(r) for r in ctx.db.execute("SELECT session_id, title, updated_at, COALESCE(archived, 0) AS archived FROM chat_sessions ORDER BY updated_at DESC").fetchall()]
    except Exception:
        rows = [{"session_id": r.get("session_id"), "title": r.get("title"), "updated_at": r.get("updated_at"), "archived": int(r.get("archived") or 0)} for r in ctx.db.get_all("chat_sessions", order_by="updated_at DESC")]
    return {"sessions": rows, "constitution_files": discover_constitution_files(ctx)}

@agent_bp.route('sessions', methods=['POST'], request_schema=ChatSessionPayload, docstring="[sync] Creates a new chat session.")
def create_session(ctx):
    raw_title = str((ctx.payload or {}).get("title") or "").strip()
    session_id = f"ses_{uuid.uuid4().hex[:12]}"
    title = f"New Conversation ({datetime.now().strftime('%Y-%m-%d %H:%M')})" if (not raw_title or raw_title == "New Conversation") else raw_title
    ctx.db.insert_or_replace("chat_sessions", {"session_id": session_id, "title": title, "updated_at": time.time(), "archived": 0})
    return {"status": "success", "session_id": session_id, "title": title}


@agent_bp.route('sessions/rename', methods=['POST'], request_schema=ChatSessionManagePayload, risk="ui_only", docstring="[sync] Renames an existing chat session.")
def api_rename_session(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    new_title = str(data.get("title") or "").strip()
    if not session_id or not new_title:
        return {"error": "session_id and title are required"}, 400
    row = ctx.db.get_by_id("chat_sessions", session_id, id_col="session_id")
    if not row:
        return {"error": f"Session '{session_id}' not found."}, 404
    now = time.time()
    ctx.db.execute("UPDATE chat_sessions SET title=?, updated_at=? WHERE session_id=?", (new_title, now, session_id))
    ctx.db.commit()
    return {"status": "success", "session_id": session_id, "title": new_title, "updated_at": now}


@agent_bp.route('sessions/archive', methods=['POST'], request_schema=ChatSessionManagePayload, risk="ui_only", docstring="[sync] Archives or unarchives a chat session.")
def api_archive_session(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    if not session_id:
        return {"error": "session_id is required"}, 400
    row = ctx.db.get_by_id("chat_sessions", session_id, id_col="session_id")
    if not row:
        return {"error": f"Session '{session_id}' not found."}, 404
    target_archived = 1 if data.get("archived", not bool(row.get("archived"))) else 0
    ctx.db.execute("UPDATE chat_sessions SET archived=? WHERE session_id=?", (target_archived, session_id))
    ctx.db.commit()
    return {"status": "success", "session_id": session_id, "archived": target_archived}


@agent_bp.route('sessions/<session_id>', methods=['DELETE'], risk="ui_only", docstring="[sync] Permanently deletes a chat session and its associated transcript messages.")
def api_delete_session(ctx, session_id):
    clean_sid = str(session_id or "").strip()
    if not clean_sid:
        return {"error": "session_id is required"}, 400
    ctx.db.delete("chat_messages", "session_id", clean_sid)
    ctx.db.delete("chat_sessions", "session_id", clean_sid)
    ctx.db.commit()
    return {"status": "success", "deleted": clean_sid}

AgentIngestReplyPayload = TypedDict("AgentIngestReplyPayload", {"session_id": str, "role": str, "raw_text": str}, total=False)
INGEST_REPLY_ROLES = frozenset({"assistant", "user"})


@agent_bp.route('ingest_reply', methods=['POST'], request_schema=AgentIngestReplyPayload, risk="ui_only", docstring="[sync] Unified reply ingestion pipeline: compiles a standalone Quickpack for any <<<<<<< QUERY_CONTEXT blocks, strips Yomama patch/probe blocks, and records any conversational prose in chat_messages.")
def api_ingest_reply(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    raw_text = str(data.get("raw_text") or data.get("content") or "").strip()
    if not raw_text:
        return {"error": "raw_text is required"}, 400
    if str(data.get("message_id") or "").strip():
        # Message ids are issued here, never by the client, so one msg:// address means one message for good.
        return {"error": "message_id is issued by the server; leave it out."}, 400
    role = str(data.get("role") or "assistant").strip()
    if role not in INGEST_REPLY_ROLES:
        return {"error": f"role must be one of {sorted(INGEST_REPLY_ROLES)}."}, 400
    if session_id and not ctx.db.execute("SELECT 1 FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone():
        return {"error": f"Session '{session_id}' not found."}, 404

    quickpack_info = compile_query_quickpack(ctx, raw_text)
    task_actions, cleaned_patch_text, auto_applied_plan = _process_turn_task_directives(
        ctx, session_id, raw_text, reconcile_ws_fn=_reconcile_ws_ttl
    )

    clean_prose = strip_yomama_blocks_keep_prose(cleaned_patch_text)
    common_egress = {
        "quickpack": quickpack_info,
        "task_actions": task_actions,
        "task_manage_actions": task_actions,
        "cleaned_patch_text": cleaned_patch_text,
        "unapplied_patches": cleaned_patch_text,
        "active_plan": auto_applied_plan,
    }
    if not clean_prose or not session_id:
        return {
            "status": "success" if (quickpack_info or task_actions or auto_applied_plan) else "skipped",
            "content": "",
            **common_egress,
            "reason": "No conversational prose outside patch/query blocks.",
        }
    appended = _append_session_message(ctx, session_id, role, clean_prose, raw_content=raw_text)
    if not appended:
        return {"status": "skipped", "content": "", **common_egress}
    ctx.db.execute(
        "UPDATE chat_sessions SET updated_at=?, checkpoint_json='null' WHERE session_id=?",
        (appended["timestamp"], session_id),
    )
    ctx.db.commit()
    return {
        "status": "success",
        "message_id": appended["message_id"],
        "seq": appended["seq"],
        "content": appended["content"],
        "receipt": appended["receipt"],
        **common_egress,
        "timestamp": appended["timestamp"],
    }


@agent_bp.route('messages/<message_id>', methods=['DELETE'], risk="ui_only", docstring="[sync] Removes a specific message bubble from the canonical chat_messages log and invalidates any cold compaction block referencing it.")
def delete_chat_message(ctx, message_id):
    if not message_id:
        return {"error": "message_id is required"}, 400
    return _delete_session_message_and_invalidate(ctx, message_id)


AgentRewindPayload = TypedDict("AgentRewindPayload", {"message_id": str, "session_id": str}, total=False)


@agent_bp.route('rewind', methods=['POST'], request_schema=AgentRewindPayload, risk="ui_only", mcp_expose=False, docstring="[sync] Rewinds a chat session's conversation state to immediately before message_id (restoring the pre-turn working set, mode/routine trigger, plan state, and delta hashes without reverting files on disk).")
def api_rewind_session(ctx):
    data = ctx.payload or {}
    msg_id = str(data.get("message_id") or "").strip() or None
    ses_id = str(data.get("session_id") or "").strip() or None
    if not msg_id and not ses_id:
        return {"error": "message_id or session_id is required"}, 400
    return _rewind_session_to_message(ctx, message_id=msg_id, session_id=ses_id)


@agent_bp.route('messages/<session_id>', methods=['GET'], docstring="[sync] Retrieves canonical message history (annotated with active compaction tier), compacted view ledger, working-set state, token ledger, and plan contracts for a specific chat session.")
def get_messages(ctx, session_id):
    return _load_session_messages_state(ctx, session_id)
@agent_bp.route('cancel', methods=['POST'], request_schema=AgentSessionActionPayload, docstring="[sync] Signals an active agent turn to abort before the next LLM call or VFS mutation, and clears any paused handoff checkpoint.")
def cancel_agent_turn(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    if not session_id:
        return {"error": "session_id required"}, 400
    with _CANCEL_LOCK:
        _CANCELLED_SESSIONS.add((ctx.workspace_id, session_id))
    row = ctx.db.get_by_id("chat_sessions", session_id, id_col="session_id")
    if row and row.get("active_job_id"):
        w_conn = ctx.get_db("workers")
        w_conn.execute(
            "UPDATE immediate_jobs SET status='failed', status_message='Cancelled by user.' WHERE id=?",
            (row["active_job_id"],),
        )
        w_conn.commit()
    ctx.db.execute("UPDATE chat_sessions SET active_job_id=NULL, checkpoint_json='null' WHERE session_id=?", (session_id,))
    ctx.db.commit()
    return {"status": "cancelled", "session_id": session_id}


@agent_bp.route('undo', methods=['POST'], request_schema=AgentSessionActionPayload, docstring="[sync] Reverts the most recent Yomama Bridge transaction for this chat session.")
def undo_last_agent_turn(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    tx_id = str(data.get("transaction_id") or "").strip()
    if not tx_id and session_id:
        row = ctx.db.get_by_id("chat_sessions", session_id, id_col="session_id")
        if row:
            tx_id = row.get("last_transaction_id") or ""
    if not tx_id:
        return {"error": "No recorded transaction found to undo for this session."}, 404
    tx_list = [t.strip() for t in tx_id.split(",") if t.strip()]
    rev_res = {}
    for single_tx in reversed(tx_list):
        rev_res = ctx.call("bridge.revert", transaction_id=single_tx, target_state="initial", wait=True)
    if session_id:
        now = time.time()
        rev_content = f"⏪ Reverted transaction `{tx_id}`: {rev_res.get('message', 'Files restored.')}"
        _append_session_message(ctx, session_id, "assistant", rev_content, now=now)
        ctx.db.execute("UPDATE chat_sessions SET last_transaction_id=NULL, updated_at=? WHERE session_id=?", (now, session_id))
        ctx.db.commit()
    return {"status": "success", "transaction_id": tx_id, "revert": rev_res}


@agent_bp.route('prompt', methods=['POST'], request_schema=ChatPromptPayload, docstring="Dispatches a new user prompt into the background declarative agent worker chain.")
def submit_prompt(ctx):
    data = ctx.payload or {}
    session_id = data.get("session_id")
    raw_prompt = str(data.get("prompt") or "").strip()
    explicit_mode = str(data.get("mode") or "").strip().lower().lstrip("/")
    if explicit_mode == "undo" or raw_prompt.lower() == "/undo":
        return ctx.call("agent.undo", session_id=session_id, transaction_id=data.get("transaction_id"))
    attached_files = data.get("attached_files", [])
    read_only_files = data.get("read_only_files", [])
    is_checkpoint_resume = bool(data.get("resume_checkpoint"))
    routine_id = str(data.get("routine_id") or "workspace_turn").strip()
    if not raw_prompt and routine_id and routine_id != "workspace_turn":
        raw_prompt = f"/{routine_id}"
    if not raw_prompt and is_checkpoint_resume:
        raw_prompt = "Resume from budget checkpoint"
    if not session_id or not raw_prompt:
        return {"error": "session_id and prompt are required"}, 400
    parsed_colon = _parse_colon_command_tokens(raw_prompt)
    if parsed_colon["target"] and parsed_colon["target"] not in ("auto", "code", "plan", "ask", "yomama", "undo"):
        cand_target = parsed_colon["target"]
        for r_summary in list_available_routines(ctx):
            r_slash = str(r_summary.get("slash_command") or "").lstrip("/").lower()
            if cand_target in (r_summary.get("id", "").lower(), r_slash):
                routine_id = r_summary["id"]
                break
    try:
        routine_def = load_routine_definition(ctx, routine_id)
    except Exception:
        routine_def = None
    resolved_mode, clean_prompt = _parse_slash_command(raw_prompt, data.get("mode"), routine=routine_def)
    if resolved_mode == "undo":
        return ctx.call("agent.undo", session_id=session_id, transaction_id=data.get("transaction_id"))

    with _CANCEL_LOCK:
        _CANCELLED_SESSIONS.discard((ctx.workspace_id, session_id))

    now = time.time()
    is_handoff_resume = isinstance(data.get("handoff_responses"), dict) and len(data["handoff_responses"]) > 0
    user_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    if not is_handoff_resume and not is_checkpoint_resume:
        pre_s_row = ctx.db.execute(
            "SELECT working_set_json, active_plan_json, web_chat_state_json FROM chat_sessions WHERE session_id=?",
            (session_id,),
        ).fetchone()
        pre_ws, pre_plan, pre_hashes = [], None, {}
        if pre_s_row:
            try:
                pre_ws = [
                    w for w in json.loads(pre_s_row.get("working_set_json") or "[]")
                    if isinstance(w, dict) and w.get("filepath")
                ]
            except Exception:
                pre_ws = []
            try:
                p_loaded = json.loads(pre_s_row.get("active_plan_json") or "{}")
                pre_plan = p_loaded if (isinstance(p_loaded, dict) and p_loaded.get("tasks")) else None
            except Exception:
                pre_plan = None
            try:
                pre_hashes = json.loads(pre_s_row.get("web_chat_state_json") or "{}").get("sent_hashes") or {}
            except Exception:
                pre_hashes = {}
        prev_by_fp = {w["filepath"]: w for w in pre_ws if isinstance(w, dict) and w.get("filepath")}
        reconciled_pre_ws: List[Dict[str, Any]] = []
        seen_pre_fp = set()
        for tier_name, default_upin, uri_list in (("pinned", True, attached_files or []), ("reference", False, read_only_files or [])):
            for raw_u in uri_list:
                try:
                    norm_u = str(InSetuURI(raw_u))
                    if norm_u not in seen_pre_fp:
                        prev_e = prev_by_fp.get(norm_u) or {}
                        reconciled_pre_ws.append({"filepath": norm_u, "tier": tier_name, "idle_turns": int(prev_e.get("idle_turns") or 0), "user_pinned": bool(prev_e.get("user_pinned", default_upin))})
                        seen_pre_fp.add(norm_u)
                except Exception:
                    pass
        pre_ws = reconciled_pre_ws
        scope_str = str(parsed_colon.get("scope") or data.get("scope") or "").strip()
        cmd_pill = (
            f"/{routine_id}{':' + scope_str if scope_str else ''}"
            if (resolved_mode == "user" and routine_id and routine_id != "workspace_turn")
            else f"/{resolved_mode or 'auto'}"
        )
        user_env_snap = {
            "mode": resolved_mode or "auto",
            "routine_id": routine_id or "workspace_turn",
            "scope": scope_str,
            "command_pill": cmd_pill,
            "prompt_clean": clean_prompt,
            "working_set": pre_ws,
            "active_plan": pre_plan,
            "sent_hashes": pre_hashes,
        }
        u_msg = _append_session_message(
            ctx, session_id, "user", clean_prompt or raw_prompt,
            raw_content=raw_prompt, envelope_snapshot=user_env_snap, now=now,
        )
        if u_msg:
            user_msg_id = u_msg["message_id"]
        cur_ses = ctx.db.get_by_id("chat_sessions", session_id, id_col="session_id")
        if cur_ses and str(cur_ses.get("title") or "").startswith("New Conversation"):
            auto_title = _synthesize_session_title_from_prompt(clean_prompt or raw_prompt)
            if auto_title:
                ctx.db.execute("UPDATE chat_sessions SET title=? WHERE session_id=?", (auto_title, session_id))
    extra_turn_inputs: Dict[str, Any] = {}
    if parsed_colon["scope"]:
        extra_turn_inputs["scope"] = parsed_colon["scope"]
        extra_turn_inputs["target"] = parsed_colon["scope"]
    if parsed_colon["stage"]:
        extra_turn_inputs["stage"] = parsed_colon["stage"]
    if data.get("scope"):
        extra_turn_inputs["scope"] = str(data["scope"])
    if data.get("stage"):
        extra_turn_inputs["stage"] = str(data["stage"])
    if isinstance(data.get("pinned_repos"), list) and data["pinned_repos"]:
        extra_turn_inputs["pinned_repos"] = [str(r) for r in data["pinned_repos"] if r]
    if data.get("profile_id"):
        extra_turn_inputs["profile_id"] = str(data["profile_id"]).strip()
    if data.get("transport"):
        extra_turn_inputs["transport"] = data["transport"]
    if data.get("web_chat_window_mode"):
        extra_turn_inputs["web_chat_window_mode"] = str(data["web_chat_window_mode"]).strip()
    if is_handoff_resume:
        extra_turn_inputs["is_handoff_resume"] = True
    if isinstance(data.get("handoff_responses"), dict):
        extra_turn_inputs["handoff_responses"] = data["handoff_responses"]
    if data.get("resume_checkpoint"):
        # Resume from the server's own checkpoint (chat_sessions.checkpoint_json); the browser never sends chain state.
        extra_turn_inputs["resume_checkpoint"] = True

    job_id = ctx.jobs.submit(
        "agent_turn_task",
        job_category="ui_blocking",
        session_id=session_id,
        user_prompt=clean_prompt,
        mode=resolved_mode,
        attached_files=attached_files,
        read_only_files=read_only_files,
        routine_id=routine_id,
        extra_inputs=extra_turn_inputs,
        retry_count=0,
    )
    if not is_handoff_resume and not is_checkpoint_resume:
        ctx.db.execute(
            "UPDATE chat_sessions SET updated_at=?, active_job_id=?, checkpoint_json='null' WHERE session_id=?",
            (now, job_id, session_id),
        )
    else:
        ctx.db.execute(
            "UPDATE chat_sessions SET updated_at=?, active_job_id=? WHERE session_id=?",
            (now, job_id, session_id),
        )
    ctx.db.commit()

    return {"status": "accepted", "job_id": job_id, "message_id": user_msg_id, "mode": resolved_mode}, 202
@agent_bp.worker("agent_turn_task")
def _execute_agent_turn(
    ctx,
    job_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_prompt: str = "",
    mode: str = "auto",
    attached_files: Optional[List[str]] = None,
    read_only_files: Optional[List[str]] = None,
    routine_id: str = "workspace_turn",
    extra_inputs: Optional[Dict[str, Any]] = None,
    retry_count: int = 0,
):
    s_row = ctx.db.execute(
        "SELECT summary, compacted_view_json, web_chat_state_json, checkpoint_json, working_set_json, token_ledger_json, active_plan_json FROM chat_sessions WHERE session_id=?",
        (session_id,),
    ).fetchone()
    existing_summary = (s_row.get("summary") if s_row else "") or ""
    existing_compacted_view = {}
    existing_web_chat_state = {}
    saved_checkpoint = None
    if s_row:
        for attr_fn, raw_col in (
            (lambda v: existing_compacted_view.update(v if isinstance(v, dict) else {}), s_row.get("compacted_view_json")),
            (lambda v: existing_web_chat_state.update(v if isinstance(v, dict) else {}), s_row.get("web_chat_state_json")),
        ):
            try:
                attr_fn(json.loads(raw_col or "{}"))
            except Exception:
                pass
        try:
            saved_checkpoint = json.loads(s_row.get("checkpoint_json") or "null")
        except Exception:
            saved_checkpoint = None

    cursor = ctx.db.execute(
        "SELECT message_id, seq, role, content, raw_content, receipt, transaction_id FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC",
        (session_id,),
    )
    raw_rows = [dict(r) for r in cursor.fetchall()]
    history_messages, updated_summary, updated_compacted_view = _compact_session_history(
        ctx, session_id or "default", raw_rows, existing_summary, existing_compacted_view
    )
    if not history_messages and user_prompt:
        history_messages = [{"role": "user", "content": user_prompt}]

    def _is_cancelled() -> bool:
        with _CANCEL_LOCK:
            return (ctx.workspace_id, session_id) in _CANCELLED_SESSIONS

    existing_token_ledger: Dict[str, Any] = {}
    if s_row and s_row.get("token_ledger_json"):
        try:
            existing_token_ledger = json.loads(s_row["token_ledger_json"] or "{}")
        except Exception:
            existing_token_ledger = {}

    first_ts_row = ctx.db.execute(
        "SELECT MIN(timestamp) as min_ts FROM chat_messages WHERE session_id=?",
        (session_id,),
    ).fetchone()
    since_ts = (float(first_ts_row["min_ts"]) - 1.0) if (first_ts_row and first_ts_row.get("min_ts")) else -1.0
    routine_inputs = dict(extra_inputs or {})
    is_handoff_resume = bool(extra_inputs and extra_inputs.get("is_handoff_resume"))
    is_budget_resume = bool(routine_inputs.get("resume_checkpoint"))
    resolved_budget = _resolve_session_budget_state(
        ctx,
        session_id,
        existing_token_ledger,
        since_ts=since_ts,
        ratchet=is_handoff_resume,
        force_ratchet=is_budget_resume,
    )
    if is_budget_resume or is_handoff_resume:
        ctx.db.execute(
            "UPDATE chat_sessions SET token_ledger_json=? WHERE session_id=?",
            (json.dumps(resolved_budget), session_id),
        )
        ctx.db.commit()

    routine_inputs.setdefault("session_cost_usd", resolved_budget["total_cost_usd"])
    routine_inputs.setdefault("budget_limit_usd", resolved_budget["budget_limit_usd"])
    routine_inputs.setdefault("budget_step_usd", resolved_budget["budget_step_usd"])

    resumed_envelope: Optional[RoutineEnvelope] = None
    if (is_handoff_resume or (isinstance(saved_checkpoint, dict) and is_budget_resume)) and isinstance(saved_checkpoint, dict):
        resumed_envelope = RoutineEnvelope.from_checkpoint(saved_checkpoint)
        if resumed_envelope.user_prompt and (not user_prompt or user_prompt in ("Resume Routine Handoff", "Resume from budget checkpoint")):
            user_prompt = resumed_envelope.user_prompt
        if resumed_envelope.mode and mode == "auto":
            mode = resumed_envelope.mode
        if resumed_envelope.routine_id:
            routine_id = resumed_envelope.routine_id
        if not routine_inputs.get("profile_id") and resumed_envelope.profile_id:
            routine_inputs["profile_id"] = resumed_envelope.profile_id
        if not attached_files and resumed_envelope.editable_files:
            attached_files = resumed_envelope.editable_files
        if not read_only_files and resumed_envelope.readonly_files:
            read_only_files = resumed_envelope.readonly_files
    if "web_chat_sent_hashes" not in routine_inputs and isinstance(existing_web_chat_state.get("sent_hashes"), dict):
        routine_inputs["web_chat_sent_hashes"] = existing_web_chat_state["sent_hashes"]
    if "web_chat_window_mode" not in routine_inputs and existing_web_chat_state.get("window_mode"):
        routine_inputs["web_chat_window_mode"] = existing_web_chat_state["window_mode"]
    if s_row and s_row.get("active_plan_json"):
        try:
            saved_plan = json.loads(s_row["active_plan_json"] or "{}")
            if isinstance(saved_plan, dict) and saved_plan.get("tasks") and saved_plan.get("active_task_id"):
                routine_inputs["active_plan"] = saved_plan
                routine_inputs["active_plan_prompt_block"] = _format_active_plan_meta(saved_plan)
        except Exception:
            pass

    try:
        with _telemetry_session_scope(session_id, ctx.workspace_id):
            routine_result = execute_declarative_routine(
                ctx,
                session_id=session_id or "default",
                user_prompt=user_prompt,
                mode=mode,
                attached_files=attached_files or [],
                read_only_files=read_only_files or [],
                history_messages=history_messages,
                routine_id=routine_id,
                inputs=routine_inputs,
                envelope=resumed_envelope,
                is_cancelled_fn=_is_cancelled,
            )
    except Exception:
        ctx.db.execute("UPDATE chat_sessions SET active_job_id=NULL WHERE session_id=?", (session_id,))
        ctx.db.commit()
        raise
    existing_ws_list: List[Dict[str, Any]] = []
    if s_row and s_row.get("working_set_json"):
        try:
            existing_ws_list = json.loads(s_row["working_set_json"] or "[]")
        except Exception:
            existing_ws_list = []

    if routine_result.get("status") == "paused_for_user":
        return persist_paused_turn_state(
            ctx, session_id, routine_id, routine_result, existing_ws_list,
            existing_web_chat_state, attached_files, read_only_files,
            updated_summary, updated_compacted_view,
        )

    # P1 Execution Budget Checkpoint
    if routine_result.get("status") == "paused_for_budget":
        now = time.time()
        checkpoint = routine_result.get("checkpoint") or {}
        ctx.db.execute(
            "UPDATE chat_sessions SET active_job_id=NULL, checkpoint_json=?, updated_at=? WHERE session_id=?",
            (json.dumps(checkpoint), now, session_id),
        )
        ctx.db.commit()
        return {
            "message": routine_result.get("message", "Paused for execution budget checkpoint."),
            "artifact": {
                "session_id": session_id,
                "routine_id": routine_result.get("routine_id", routine_id),
                "status": "paused_for_budget",
                "checkpoint": checkpoint,
                "wavefront_index": routine_result.get("wavefront_index", 0),
            },
        }
    return finalize_completed_turn_state(
        ctx, session_id=session_id, s_row=s_row, user_prompt=user_prompt, mode=mode,
        attached_files=attached_files, read_only_files=read_only_files, existing_ws_list=existing_ws_list,
        existing_web_chat_state=existing_web_chat_state, updated_summary=updated_summary,
        updated_compacted_view=updated_compacted_view, routine_result=routine_result,
    )