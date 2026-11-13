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
from .envelope import (
    RoutineEnvelope,
    parse_colon_command_tokens as _parse_colon_command_tokens,
    parse_slash_command as _parse_slash_command,
)
from .session_ledger import (
    build_message_receipt as _build_message_receipt,
    compact_session_history as _compact_session_history,
    finalize_completed_turn_state,
    next_session_seq as _next_session_seq,
    persist_paused_turn_state,
)
from insetu.core.llm.llm_telemetry import compute_session_tier_telemetry as _compute_session_tier_telemetry
from .routine_loader import (
    build_context_file_metrics, list_available_routines, load_routine_definition,
    parse_routine_content, resolve_routine_mode, serialize_routine_to_markdown,
    validate_routine_definition,
)
from insetu.core.bridge.bridge_test import run_repo_test_diagnostics
from insetu.core.gather.context_assemble import compile_query_quickpack, discover_constitution_files
from insetu.core.agent.routine_check import attach_routine_problems, forget_routine_problems
from insetu.core.step_timer import StepTimer
from .expressions import strip_yomama_blocks_keep_prose
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
    }
]

AGENT_SCHEMA = {
    "chat_sessions": {
        "session_id": "TEXT PRIMARY KEY", "title": "TEXT", "updated_at": "REAL", "last_transaction_id": "TEXT",
        "active_job_id": "TEXT", "summary": "TEXT DEFAULT ''", "compacted_view_json": "TEXT DEFAULT '{}'",
        "web_chat_state_json": "TEXT DEFAULT '{}'", "working_set_json": "TEXT DEFAULT '[]'",
        "token_ledger_json": "TEXT DEFAULT '{}'", "active_plan_path": "TEXT DEFAULT ''", "checkpoint_json": "TEXT DEFAULT 'null'",
        "seq_counter": "INTEGER DEFAULT 0"
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
    if not data or not filepath:
        return
    archive_path = data.get("archive_path")
    original_response_path = data.get("original_response_path")
    if archive_path and original_response_path and "{date}" in original_response_path:
        ctx = agent_bp.get_context(workspace_id)
        file_uri = InSetuURI(filepath)
        prefix = Path(original_response_path).name.split("{date}")[0]
        logical_target_dir = str(file_uri.parent_uri)
        archive_uri = file_uri.resolve_sibling_uri(archive_path)

        for walk_path in ctx.vfs.walk(logical_target_dir):
            if walk_path == str(file_uri):
                continue
            walk_uri = InSetuURI(walk_path)
            if str(walk_uri.parent_uri) == logical_target_dir and walk_uri.basename.startswith(prefix):
                dest_path = str(archive_uri.join(walk_uri.basename))
                old_content = ctx.vfs.read(walk_path)
                if old_content is not None:
                    ctx.vfs.save(dest_path, old_content)
                    ctx.vfs.delete(walk_path, data={"ignore_ledger": True})


ChatSessionPayload = TypedDict("ChatSessionPayload", {"title": str})
ChatPromptPayload = TypedDict("ChatPromptPayload", {
    "session_id": str, "prompt": str, "mode": str, "profile_id": str, "attached_files": List[str],
    "read_only_files": List[str], "routine_id": str, "transport": str, "web_chat_window_mode": str,
    "handoff_responses": Dict[str, str], "prior_chain_context": Dict[str, Any],
}, total=False)
AgentSessionActionPayload = TypedDict("AgentSessionActionPayload", {"session_id": str, "transaction_id": str}, total=False)


@agent_bp.route('routines', methods=['GET'], docstring="[sync] Lists all available declarative Markdown-as-Code (.md) and YAML (.yaml) routines with wavefront metadata and available contexts/prompts.")
def get_routines(ctx):
    timer = StepTimer()
    routines = timer.mark("check_routines", attach_routine_problems(ctx, timer.mark("list_routines", list_available_routines(ctx))))
    expected_contexts = timer.mark("contexts", get_available_contexts(ctx.workspace_id, exclusion_flags=["exclude_from_context"], exclude_types=["diff"]))
    available_diffs, available_prompts = [], []
    try:
        available_diffs = timer.mark("diffs", ctx.emit_merge_list('request_available_diffs'))
        available_prompts = timer.mark("prompts", ctx.emit_merge_list('request_available_prompts'))
    except Exception:
        pass
    is_base = lambda name: bool(name and isinstance(name, str) and not re.search(r'_part\d+\.txt$', name))
    return {
        "routines": routines,
        "available_contexts": sorted([c for c in expected_contexts if is_base(c)]),
        "available_diffs": sorted([d for d in set(available_diffs) if is_base(d)]),
        "available_prompts": sorted([p for p in available_prompts if isinstance(p, str)]),
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
    data = dict(ctx.payload or {})
    if isinstance(data.get("routine"), dict):
        nested = dict(data.pop("routine"))
        nested.update(data)
        data = nested
    scope = str(data.pop("scope", "workspace") or "workspace").strip().lower()
    raw_content = data.pop("raw_content", None) or data.pop("markdown_text", None)
    original_id = str(data.pop("original_id", "") or "").strip()

    try:
        if raw_content and isinstance(raw_content, str) and raw_content.strip():
            parsed = parse_routine_content(raw_content, fallback_id=data.get("id") or "routine", is_markdown=True)
            rid = slugify(data.get("id") or parsed.get("id") or parsed.get("title") or "routine")
            parsed["id"] = rid
            is_valid, err_msg, wave_ids = validate_routine_definition(parsed)
            if not is_valid:
                return {"error": err_msg}, 422
            parsed["wavefronts"] = wave_ids
            md_content = raw_content if raw_content.lstrip().startswith("---") else serialize_routine_to_markdown(parsed)
        else:
            rid = slugify(data.get("id") or data.get("title") or data.get("name") or "routine")
            if not rid:
                return {"error": "Routine id or title is required."}, 400
            data["id"] = rid
            is_valid, err_msg, wave_ids = validate_routine_definition(data)
            if not is_valid:
                return {"error": err_msg}, 422
            md_content = serialize_routine_to_markdown(data)
            parsed = parse_routine_content(md_content, fallback_id=rid, is_markdown=True)
            parsed["wavefronts"] = wave_ids
    except Exception as val_err:
        return {"error": str(val_err)}, 422

    target_uri = (
        f"ctx://routines/.templates/user/{rid}.md"
        if scope in ("user", "global", "user_template")
        else f"ctx://routines/{rid}.md"
    )
    if original_id and original_id != rid:
        old_uri = (
            f"ctx://routines/.templates/user/{original_id}.md"
            if scope in ("user", "global", "user_template")
            else f"ctx://routines/{original_id}.md"
        )
        if ctx.vfs.read(old_uri) is not None:
            ctx.vfs.delete(old_uri)

    ctx.vfs.save(target_uri, md_content)
    return {
        "status": "success",
        "filepath": target_uri,
        "routine": {**parsed, "filepath": target_uri, "source": "user_template" if "user/" in target_uri else "workspace"},
        "routines": list_available_routines(ctx),
        "job_id": None,
    }


RoutineDeletePayload = TypedDict("RoutineDeletePayload", {"id": str, "filepath": Optional[str], "scope": Optional[str]}, total=False)


@agent_bp.route('routines/delete', methods=['POST'], request_schema=RoutineDeletePayload, docstring="[sync] Deletes a workspace or user-template routine override (reverting to the built-in template if one exists).")
def api_delete_routine(ctx):
    data = ctx.payload or {}
    rid = str(data.get("id") or "").strip().lstrip("/")
    fp = str(data.get("filepath") or "").strip()
    scope = str(data.get("scope") or "workspace").strip().lower()

    candidates = []
    if fp and fp.startswith("ctx://routines/") and not InSetuURI(fp).is_readonly_template:
        candidates.append(fp)
    if rid:
        if scope in ("user", "global", "user_template"):
            candidates.extend([f"ctx://routines/.templates/user/{rid}.md", f"ctx://routines/.templates/user/{rid}.yaml"])
        else:
            candidates.extend([f"ctx://routines/{rid}.md", f"ctx://routines/{rid}.yaml"])

    deleted = []
    for cand in candidates:
        if ctx.vfs.read(cand) is not None:
            ctx.vfs.delete(cand)
            deleted.append(cand)

    return {
        "status": "success",
        "deleted": deleted,
        "routines": list_available_routines(ctx),
        "job_id": None,
    }


EnsurePlanFilePayload = TypedDict("EnsurePlanFilePayload", {"repo": Optional[str], "title": Optional[str], "plan_uri": Optional[str]}, total=False)


@agent_bp.route('ensure_plan_file', methods=['POST'], request_schema=EnsurePlanFilePayload, docstring="[sync] Resolves or creates a canonical Markdown plan file URI for the /plan routine.")
def api_ensure_plan_file(ctx):
    data = ctx.payload or {}
    explicit_uri = str(data.get("plan_uri") or "").strip()
    if explicit_uri and explicit_uri not in ("None", "null"):
        canon = InSetuURI.canonicalize(explicit_uri)
        existing = ctx.vfs.read(canon) or ""
        return {"plan_uri": canon, "existing_content": existing}

    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    repo = str(data.get("repo") or (repos[0] if repos else "global")).strip()
    title = str(data.get("title") or "Architecture Plan").strip()
    safe_title = title.replace('"', "'")
    date_str = datetime.now().strftime("%Y-%m-%d")
    slug = slugify(title)[:40] or "plan"
    folder = f"vfs://{repo}/docs/plans" if (repo != "global" and repo in repos) else "ctx://contexts"
    plan_uri = f"{folder.rstrip('/')}/{date_str}-{slug}.md"
    existing = ctx.vfs.read(plan_uri)
    if existing is None:
        now_iso = datetime.now().isoformat(timespec="seconds")
        init_content = (
            f"---\n"
            f'title: "{safe_title}"\n'
            f"repo: {repo}\n"
            f"created_at: {now_iso}\n"
            f"tags: [plan, rfc]\n"
            f"---\n\n"
            f"# {title}\n\n"
            f"## 1. Architectural Context & Objective\n\n"
            f"## 2. File-Level Execution Plan\n"
        )
        ctx.vfs.save(plan_uri, init_content)
        existing = init_content
    return {"plan_uri": plan_uri, "existing_content": existing}


ResolveTestCommandPayload = TypedDict("ResolveTestCommandPayload", {"repo": Optional[str], "target": Optional[str]}, total=False)
@agent_bp.route('resolve_test_command', methods=['GET', 'POST'], request_schema=ResolveTestCommandPayload, docstring="[sync] Inspects workspace repository configuration files to determine the appropriate test runner command.")
def api_resolve_test_command(ctx):
    data = ctx.payload or {}
    repos = [r.get("repo_dir") for r in ctx.config.get("target_repos", []) if r.get("repo_dir")]
    repo = str(data.get("repo") or (repos[0] if repos else "")).strip()
    target = str(data.get("target") or "").strip()
    if not repo or repo not in repos:
        return {"repo": repo, "command": f"pytest {target}".strip() or "pytest -q", "runner": "pytest"}

    if ctx.vfs.read(f"vfs://{repo}/pyproject.toml") or ctx.resolve_path(f"vfs://{repo}/tests", must_exist=True, allow_heal=False):
        return {"repo": repo, "command": f"pytest {target}".strip() if target else "pytest -q", "runner": "pytest"}
    if ctx.vfs.read(f"vfs://{repo}/package.json"):
        return {"repo": repo, "command": "npm test", "runner": "npm"}
    if ctx.vfs.read(f"vfs://{repo}/Cargo.toml"):
        return {"repo": repo, "command": "cargo test", "runner": "cargo"}
    if ctx.vfs.read(f"vfs://{repo}/go.mod"):
        return {"repo": repo, "command": "go test ./...", "runner": "go"}
    return {"repo": repo, "command": f"pytest {target}".strip() or "pytest -q", "runner": "pytest"}
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

@agent_bp.route('sessions', methods=['GET'], docstring="[sync] Retrieves all chat sessions for the active workspace.")
def get_sessions(ctx):
    rows = ctx.db.get_all("chat_sessions", order_by="updated_at DESC")
    constitution = discover_constitution_files(ctx)
    return {"sessions": rows, "constitution_files": constitution}

@agent_bp.route('sessions', methods=['POST'], request_schema=ChatSessionPayload, docstring="[sync] Creates a new chat session.")
def create_session(ctx):
    data = ctx.payload or {}
    session_id = f"ses_{uuid.uuid4().hex[:12]}"
    raw_title = str(data.get("title") or "").strip()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    title = f"New Conversation ({now_str})" if (not raw_title or raw_title == "New Conversation") else raw_title

    ctx.db.insert_or_replace("chat_sessions", {
        "session_id": session_id,
        "title": title,
        "updated_at": time.time()
    })
    return {"status": "success", "session_id": session_id, "title": title}

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
    clean_prose = strip_yomama_blocks_keep_prose(raw_text)
    if not clean_prose or not session_id:
        return {
            "status": "success" if quickpack_info else "skipped",
            "content": "",
            "quickpack": quickpack_info,
            "reason": "No conversational prose outside patch/query blocks.",
        }
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    seq_no = _next_session_seq(ctx, session_id)
    receipt_str = _build_message_receipt(role, clean_prose)
    now = time.time()
    # A plain INSERT: an existing message is never replaced.
    ctx.db.execute(
        "INSERT INTO chat_messages (message_id, session_id, seq, role, content, raw_content, receipt, timestamp, turn_index) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (msg_id, session_id, seq_no, role, clean_prose, raw_text, receipt_str, now, seq_no),
    )
    ctx.db.execute("UPDATE chat_sessions SET updated_at=? WHERE session_id=?", (now, session_id))
    ctx.db.commit()
    return {
        "status": "success",
        "message_id": msg_id,
        "seq": seq_no,
        "content": clean_prose,
        "receipt": receipt_str,
        "quickpack": quickpack_info,
        "timestamp": now,
    }


@agent_bp.route('messages/<message_id>', methods=['DELETE'], risk="ui_only", docstring="[sync] Removes a specific message bubble from the canonical chat_messages log and invalidates any cold compaction block referencing it.")
def delete_chat_message(ctx, message_id):
    if not message_id:
        return {"error": "message_id is required"}, 400
    m_row = ctx.db.execute("SELECT session_id FROM chat_messages WHERE message_id=?", (message_id,)).fetchone()
    session_id = m_row["session_id"] if m_row else None
    ctx.db.delete("chat_messages", "message_id", message_id)
    if session_id:
        s_row = ctx.db.execute("SELECT compacted_view_json FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()
        c_view = None
        if s_row and s_row.get("compacted_view_json"):
            try:
                c_view = json.loads(s_row["compacted_view_json"] or "{}")
            except (ValueError, TypeError):
                c_view = None
        if isinstance(c_view, dict):
            blocks = list(c_view.get("blocks") or [])
            hit_indexes = [i for i, b in enumerate(blocks) if message_id in (b.get("message_ids") or [])]
            if hit_indexes:
                # Blocks are appended in sequence order. Keep only the blocks before the first one
                # that held the message; that block and every later one are rebuilt on the next turn
                # from chat_messages, so no surviving message drops out of the summary.
                first_hit = hit_indexes[0]
                kept_blocks = blocks[:first_hit]
                released_ids = [
                    mid for b in blocks[first_hit:] for mid in (b.get("message_ids") or []) if mid != message_id
                ]
                new_watermark = max((b.get("seq_range", [0, 0])[1] for b in kept_blocks), default=0)
                new_summary = "\n".join(b.get("summary_text", "") for b in kept_blocks if b.get("summary_text")).strip()
                c_view["blocks"] = kept_blocks
                c_view["compacted_up_to_seq"] = new_watermark
                ctx.db.execute(
                    "UPDATE chat_sessions SET summary=?, compacted_view_json=? WHERE session_id=?",
                    (new_summary, json.dumps(c_view), session_id),
                )
                if released_ids:
                    ph = ",".join(["?"] * len(released_ids))
                    ctx.db.execute(
                        f"UPDATE chat_messages SET compacted_into_id='' WHERE session_id=? AND message_id IN ({ph})",
                        (session_id, *released_ids),
                    )
        ctx.db.commit()
    return {"status": "success", "deleted": message_id}


@agent_bp.route('messages/<session_id>', methods=['GET'], docstring="[sync] Retrieves canonical message history (annotated with active compaction tier), compacted view ledger, working-set state, token ledger, and plan contracts for a specific chat session.")
def get_messages(ctx, session_id):
    cursor = ctx.db.execute("SELECT * FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC", (session_id,))
    messages = [dict(r) for r in cursor.fetchall()]
    total_msgs = len(messages)
    for idx_m, m in enumerate(messages):
        if not m.get("seq"):
            m["seq"] = idx_m + 1
        if not m.get("receipt"):
            m["receipt"] = _build_message_receipt(m.get("role") or "user", m.get("content") or "", m.get("transaction_id"))
        if idx_m >= max(0, total_msgs - 4):
            m["compaction_tier"] = "hot"
        elif idx_m >= max(0, total_msgs - 12):
            m["compaction_tier"] = "warm"
        else:
            m["compaction_tier"] = "cold"

    s_row = ctx.db.execute("SELECT * FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()

    working_set = []
    token_ledger = {"prompt_tokens": 0, "completion_tokens": 0, "saved_by_slicing": 0}
    compacted_view = {"compacted_up_to_seq": 0, "blocks": []}
    checkpoint = None
    plan_path = ""
    summary = ""

    def _safe_json(raw_str: Any, default_val: Any) -> Any:
        try:
            return json.loads(raw_str) if raw_str else default_val
        except Exception:
            return default_val

    if s_row:
        working_set = _safe_json(s_row.get("working_set_json"), [])
        token_ledger = _safe_json(s_row.get("token_ledger_json"), token_ledger)
        compacted_view = _safe_json(s_row.get("compacted_view_json"), compacted_view) or compacted_view
        raw_cp = _safe_json(s_row.get("checkpoint_json"), None)
        checkpoint = raw_cp if (isinstance(raw_cp, dict) and raw_cp.get("chain_context") is not None) else None
        plan_path, summary = (s_row.get("active_plan_path") or ""), (s_row.get("summary") or "")

    # Tier 0 Constitution Files: Auto-pin engineering standards resolved via repository landmarks
    ws_repos = {
        InSetuURI(x.get("filepath", "")).repo
        for x in working_set
        if isinstance(x, dict) and x.get("filepath") and InSetuURI(x["filepath"]).repo
    }
    if plan_path and InSetuURI(plan_path).repo:
        ws_repos.add(InSetuURI(plan_path).repo)
    all_constitution = discover_constitution_files(ctx)
    constitution = (
        [f for f in all_constitution if InSetuURI(f).repo in ws_repos]
        if ws_repos
        else all_constitution
    ) or all_constitution

    pinned_uris = [x.get("filepath") for x in working_set if isinstance(x, dict) and x.get("tier") == "pinned" and x.get("filepath")]
    ref_uris = [x.get("filepath") for x in working_set if isinstance(x, dict) and x.get("tier") == "reference" and x.get("filepath")]
    persisted_tok_map = token_ledger.get("file_token_map") if isinstance(token_ledger.get("file_token_map"), dict) else {}
    existing_tok_map = {
        **{k: int(v) for k, v in persisted_tok_map.items() if int(v or 0) > 0},
        **{
            x["filepath"]: int(x["tokens"])
            for x in working_set
            if isinstance(x, dict) and x.get("filepath") and int(x.get("tokens") or 0) > 0
        },
    }
    missing_const = [u for u in constitution if u not in existing_tok_map]
    missing_pinned = [u for u in pinned_uris if u not in existing_tok_map]
    missing_ref = [u for u in ref_uris if u not in existing_tok_map]
    computed_tok_map = (
        build_context_file_metrics(ctx, missing_const, missing_ref, missing_pinned)
        if (missing_const or missing_ref or missing_pinned)
        else {}
    )
    file_token_map = {**computed_tok_map, **existing_tok_map}
    for ws_item in working_set:
        if isinstance(ws_item, dict) and ws_item.get("filepath") in file_token_map:
            ws_item["tokens"] = file_token_map[ws_item["filepath"]]
    first_msg_ts = float(messages[0].get("timestamp") or 0.0) - 1.0 if messages else -1.0
    tier_telemetry = _compute_session_tier_telemetry(ctx, since_ts=first_msg_ts)
    token_ledger["by_tier"] = tier_telemetry["by_tier"]
    token_ledger["total_cost_usd"] = tier_telemetry["total_cost_usd"]

    return {
        "messages": messages,
        "compacted_view": compacted_view,
        "working_set": working_set,
        "file_token_map": file_token_map,
        "token_ledger": token_ledger,
        "checkpoint": checkpoint,
        "active_plan_path": plan_path,
        "summary": summary,
        "constitution_files": constitution,
    }
@agent_bp.route('cancel', methods=['POST'], request_schema=AgentSessionActionPayload, docstring="[sync] Signals an active agent turn to abort before the next LLM call or VFS mutation.")
def cancel_agent_turn(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    if not session_id:
        return {"error": "session_id is required"}, 400
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
        ctx.db.insert_or_replace("chat_messages", {
            "message_id": f"msg_{uuid.uuid4().hex[:12]}",
            "session_id": session_id,
            "role": "assistant",
            "content": f"⏪ Reverted transaction `{tx_id}`: {rev_res.get('message', 'Files restored.')}",
            "timestamp": now,
        })
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
    routine_id = str(data.get("routine_id") or "workspace_turn").strip()
    if not raw_prompt and routine_id and routine_id != "workspace_turn":
        raw_prompt = f"/{routine_id}"
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
    if not is_handoff_resume:
        u_seq = _next_session_seq(ctx, session_id)
        ctx.db.insert_or_replace("chat_messages", {
            "message_id": user_msg_id,
            "session_id": session_id,
            "seq": u_seq,
            "role": "user",
            "content": raw_prompt,
            "raw_content": raw_prompt,
            "receipt": _build_message_receipt("user", raw_prompt),
            "timestamp": now,
            "turn_index": u_seq,
        })
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
    if isinstance(data.get("prior_chain_context"), dict):
        extra_turn_inputs["prior_chain_context"] = data["prior_chain_context"]

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
        "SELECT summary, compacted_view_json, web_chat_state_json, checkpoint_json, working_set_json, token_ledger_json FROM chat_sessions WHERE session_id=?",
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

    routine_inputs = dict(extra_inputs or {})
    resumed_envelope: Optional[RoutineEnvelope] = None
    is_handoff_resume = bool(extra_inputs and extra_inputs.get("is_handoff_resume"))
    if (is_handoff_resume or (isinstance(saved_checkpoint, dict) and routine_inputs.get("resume_checkpoint"))) and isinstance(saved_checkpoint, dict):
        resumed_envelope = RoutineEnvelope.from_checkpoint(saved_checkpoint)
        if saved_checkpoint.get("chain_context"):
            routine_inputs["prior_chain_context"] = saved_checkpoint["chain_context"]
            cp_global = saved_checkpoint["chain_context"].get("global") or {}
            if cp_global.get("user_prompt") and (not user_prompt or user_prompt in ("Resume Routine Handoff", "Resume from budget checkpoint")):
                user_prompt = str(cp_global["user_prompt"])
            if cp_global.get("mode") and mode == "auto":
                mode = str(cp_global["mode"])
        if saved_checkpoint.get("routine_id"):
            routine_id = str(saved_checkpoint["routine_id"])
    if "web_chat_sent_hashes" not in routine_inputs and isinstance(existing_web_chat_state.get("sent_hashes"), dict):
        routine_inputs["web_chat_sent_hashes"] = existing_web_chat_state["sent_hashes"]
    if "web_chat_window_mode" not in routine_inputs and existing_web_chat_state.get("window_mode"):
        routine_inputs["web_chat_window_mode"] = existing_web_chat_state["window_mode"]

    try:
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