"""
insetu.core.agent.plan_ledger
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
SQLite (`chat_sessions.active_plan_json`) and VFS (`docs/plans/*.md`) persistence
for multi-step execution plans, `TASK_MANAGE` directives, and commit-driven step progression.
Delegates all pure state transitions to `insetu.core.agent.schemas.plan`.
"""

from datetime import datetime
import json
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

from insetu.core.agent.envelope import RoutineEnvelope
from insetu.core.agent.schemas.plan import (
    build_promoted_plan_markdown,
    extract_task_manage_directives,
    reduce_plan_actions,
    tick_task_in_plan_markdown,
)
from insetu.core.bridge.parser import (
    collect_live_files_for_patch_healing as _collect_live_files_for_patch_healing,
    parse_blocks,
    serialize_block_chunk,
)
from insetu.core.gather.context_assemble import record_affinity_interaction
from insetu.core.sdk import slugify
from insetu.core.utils_core import (
    InSetuURI,
    get_sister_repos,
    interpolate_mustache_chain as _interpolate_all_syntax,
)

def apply_task_manage_actions(
    ctx,
    session_id: str,
    actions: List[Dict[str, Any]],
    reconcile_ws_fn=None,
) -> Dict[str, Any]:
    """Applies a batch of `TASK_MANAGE` actions (`complete`, `reopen`, `add`, `drop`, `set_active`) atomically via the pure `reduce_plan_actions` reducer."""
    from .session_ledger import reconcile_working_set_ttl as _default_reconcile_ws

    s_row = ctx.db.execute(
        "SELECT active_plan_path, active_plan_json, working_set_json, last_transaction_id FROM chat_sessions WHERE session_id=?",
        (session_id,),
    ).fetchone()
    if not s_row:
        return {"error": f"Session '{session_id}' not found."}
    try:
        plan_obj = json.loads(s_row.get("active_plan_json") or "{}")
    except Exception:
        plan_obj = {}
    if not isinstance(plan_obj, dict) or not (plan_obj.get("tasks") or any(a.get("op") == "add" for a in (actions or []))):
        return {"status": "no_active_plan", "active_plan": None}

    next_plan, completed_task, next_task, files_to_tick = reduce_plan_actions(
        plan_obj,
        actions,
        default_tx_id=str(s_row.get("last_transaction_id") or "").strip() or None,
        fallback_filepath=str(s_row.get("active_plan_path") or ""),
    )
    def _canon_plan_uri(raw_uri: Any) -> str:
        try:
            return InSetuURI.canonicalize(str(raw_uri)) if raw_uri else ""
        except Exception:
            return str(raw_uri or "")

    allowed_plan_files = {
        _canon_plan_uri(p)
        for p in (s_row.get("active_plan_path"), plan_obj.get("plan_filepath") if isinstance(plan_obj, dict) else None)
        if p
    }
    for target_f, tid, tx_val in files_to_tick:
        # A file named in a TASK_MANAGE block is ticked only when it is this session's plan file;
        # any other write goes through the bridge, its topology check and the read-only list.
        if _canon_plan_uri(target_f) not in allowed_plan_files:
            continue
        raw_md = ctx.vfs.read(target_f)
        if isinstance(raw_md, str) and raw_md:
            updated_md = tick_task_in_plan_markdown(raw_md, tid, tx_val)
            if updated_md != raw_md:
                ctx.vfs.save(target_f, updated_md)

    existing_ws: List[Dict[str, Any]] = []
    try:
        existing_ws = json.loads(s_row.get("working_set_json") or "[]")
    except Exception:
        existing_ws = []
    ws_fn = reconcile_ws_fn or _default_reconcile_ws
    if next_task and next_task.get("targets") and callable(ws_fn):
        existing_ws = ws_fn(existing_ws, active_plan_targets=list(next_task["targets"]), advance_turn_age=False)

    ctx.db.execute(
        "UPDATE chat_sessions SET active_plan_json=?, working_set_json=?, updated_at=? WHERE session_id=?",
        (json.dumps(next_plan), json.dumps(existing_ws), time.time(), session_id),
    )
    ctx.db.commit()
    return {"status": "success", "completed_task": completed_task, "next_task": next_task, "active_plan": next_plan}

def process_turn_task_directives(
    ctx,
    session_id: Optional[str],
    raw_text: str,
    *,
    preset_actions: Optional[List[Dict[str, Any]]] = None,
    reconcile_ws_fn=None,
) -> Tuple[List[Dict[str, Any]], str, Optional[Dict[str, Any]]]:
    """
    Canonical LLM Egress Processor for `<<<<<<< TASK_MANAGE` directives:
    1. Extracts `TASK_MANAGE` actions and strips `TASK_MANAGE` blocks from `raw_text` -> `cleaned_patch_text`.
    2. Auto-applies `add` / `set_active` plan-creation ops immediately (or all ops when `auto_complete_plan_tasks` is True)
       via `apply_task_manage_actions` so Turn-1 plans are live immediately across both API and Web-Chat transports.
    3. Returns `(staged_confirmation_actions, cleaned_patch_text, updated_active_plan)`.
    """
    extracted_actions, cleaned_patch_text = extract_task_manage_directives(raw_text or "")
    task_actions = list(extracted_actions or preset_actions or [])
    if not task_actions or not session_id:
        return task_actions, cleaned_patch_text, None
    auto_comp = bool(ctx.settings.get("auto_complete_plan_tasks", False) if hasattr(ctx, "settings") else False)
    has_uncommitted_patches = bool(parse_blocks(cleaned_patch_text or ""))
    has_complete_op = any(a.get("op") == "complete" for a in task_actions)
    # When a turn proposes uncommitted code patches, do not apply 'complete' or a paired 'set_active'
    # before the user commits the patch stack (otherwise active_task_id advances to T2 before T1's commit is recorded).
    if has_uncommitted_patches and has_complete_op:
        immediate_ops = ("add", "update")
    elif auto_comp:
        immediate_ops = ("add", "update", "set_active", "complete", "reopen", "drop")
    else:
        immediate_ops = ("add", "update") if has_complete_op else ("add", "update", "set_active")
    ops_to_apply = [a for a in task_actions if a.get("op") in immediate_ops]
    staged_for_ui = [a for a in task_actions if a.get("op") not in immediate_ops]
    updated_plan = None
    if ops_to_apply:
        applied_res = apply_task_manage_actions(ctx, session_id, ops_to_apply, reconcile_ws_fn=reconcile_ws_fn)
        updated_plan = applied_res.get("active_plan")
    return staged_for_ui, cleaned_patch_text, updated_plan

def complete_and_advance_plan_task(
    ctx,
    session_id: str,
    task_id: Optional[str] = None,
    transaction_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Marks the specified (or currently active) PlanTask complete, ticks any backing plan.md file on disk, and advances active_task_id."""
    return apply_task_manage_actions(
        ctx, session_id, [{"op": "complete", "task_id": task_id, "transaction_id": transaction_id}]
    )

def resolve_canonical_plan_uri(
    ctx,
    title: str,
    repo: Optional[str] = None,
    tasks: Optional[List[Dict[str, Any]]] = None,
    default_slug: str = "plan",
) -> Tuple[str, str]:
    """Single Source of Truth resolver for canonical `vfs://<repo>/docs/plans/<date>-<slug>.md` URIs."""
    repos = list(get_sister_repos(ctx.workspace_id) or [])
    inferred_repo = repo or next(
        (
            InSetuURI(u).repo
            for t in (tasks or [])
            if isinstance(t, dict)
            for u in (t.get("targets") or [])
            if str(u).startswith("vfs://") and InSetuURI(u).repo in repos
        ),
        None,
    )
    target_repo = str(inferred_repo or (repos[0] if repos else "global")).strip()
    folder = f"vfs://{target_repo}/docs/plans" if (target_repo != "global" and target_repo in repos) else "ctx://contexts"
    slug = slugify(title)[:40] or default_slug
    plan_uri = f"{folder.rstrip('/')}/{datetime.now().strftime('%Y-%m-%d')}-{slug}.md"
    return plan_uri, target_repo

def ensure_plan_file_payload(ctx, data: Dict[str, Any]) -> Dict[str, Any]:
    """Resolves or creates a canonical Markdown plan file URI for the `/plan` routine."""
    explicit_uri = str(data.get("plan_uri") or "").strip()
    if explicit_uri and explicit_uri not in ("None", "null"):
        canon = InSetuURI.canonicalize(explicit_uri)
        existing = ctx.vfs.read(canon) or ""
        return {"plan_uri": canon, "existing_content": existing}

    title = str(data.get("title") or "Architecture Plan").strip()
    plan_uri, repo = resolve_canonical_plan_uri(ctx, title, repo=data.get("repo"), default_slug="plan")
    existing = ctx.vfs.read(plan_uri)
    if existing is None:
        safe_title = title.replace('"', "'")
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

def promote_ephemeral_plan_to_file(ctx, session_id: str, repo: Optional[str] = None) -> Dict[str, Any]:
    """Materializes an ephemeral session active_plan into a canonical vfs://<repo>/docs/plans/<date>-<slug>.md file."""
    s_row = ctx.db.execute("SELECT active_plan_json, active_plan_path FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()
    if not s_row:
        return {"error": f"Session '{session_id}' not found."}
    plan_obj = json.loads(s_row.get("active_plan_json") or "{}") if s_row.get("active_plan_json") else {}
    if not isinstance(plan_obj, dict) or not plan_obj.get("tasks"):
        return {"error": "No active session plan to promote."}
    title = str(plan_obj.get("title") or "Execution Plan").strip()
    plan_uri, _ = resolve_canonical_plan_uri(
        ctx, title, repo=repo, tasks=plan_obj.get("tasks"), default_slug="execution-plan"
    )
    ctx.vfs.save(plan_uri, build_promoted_plan_markdown(plan_obj, session_id))
    plan_obj.update({"plan_filepath": plan_uri, "is_ephemeral": False, "recommend_file_upgrade": False})
    ctx.db.execute(
        "UPDATE chat_sessions SET active_plan_path=?, active_plan_json=?, updated_at=? WHERE session_id=?",
        (plan_uri, json.dumps(plan_obj), time.time(), session_id),
    )
    ctx.db.commit()
    return {"status": "success", "plan_filepath": plan_uri, "active_plan": plan_obj}

def record_committed_bridge_transaction(
    ctx,
    session_id: Optional[str],
    transaction_id: Optional[str],
    committed_files: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Updates chat_sessions.last_transaction_id, working_set_json TTL, active_plan task status, and Hebbian affinity edges when a staged stack commits."""
    from .session_ledger import reconcile_working_set_ttl as _reconcile_ws

    clean_sid, clean_tx = str(session_id or "").strip(), str(transaction_id or "").strip()
    if not clean_sid or not clean_tx:
        return {"status": "noop"}
    s_row = ctx.db.execute("SELECT working_set_json, active_plan_json FROM chat_sessions WHERE session_id=?", (clean_sid,)).fetchone()
    if not s_row:
        return {"status": "noop"}
    try:
        existing_ws = json.loads(s_row.get("working_set_json") or "[]")
    except Exception:
        existing_ws = []
    files_list = list(committed_files or [])
    updated_ws = _reconcile_ws(existing_ws, committed_this_turn=files_list, advance_turn_age=False)
    try:
        plan_obj = json.loads(s_row.get("active_plan_json") or "{}") if s_row.get("active_plan_json") else None
    except Exception:
        plan_obj = None

    auto_complete = bool(ctx.settings.get("auto_complete_plan_tasks", False) if hasattr(ctx, "settings") else False)
    advance_res: Dict[str, Any] = {}
    if isinstance(plan_obj, dict) and plan_obj.get("tasks") and plan_obj.get("active_task_id"):
        act_id = plan_obj["active_task_id"]
        plan_obj, _, _, _ = reduce_plan_actions(plan_obj, [{"op": "stage_commit", "task_id": act_id, "transaction_id": clean_tx}])
        ctx.db.execute(
            "UPDATE chat_sessions SET last_transaction_id=?, working_set_json=?, active_plan_json=?, updated_at=? WHERE session_id=?",
            (clean_tx, json.dumps(updated_ws), json.dumps(plan_obj), time.time(), clean_sid),
        )
        ctx.db.commit()
        if auto_complete:
            advance_res = complete_and_advance_plan_task(ctx, clean_sid, task_id=act_id, transaction_id=clean_tx)
            plan_obj = advance_res.get("active_plan") or plan_obj
    else:
        ctx.db.execute(
            "UPDATE chat_sessions SET last_transaction_id=?, working_set_json=?, updated_at=? WHERE session_id=?",
            (clean_tx, json.dumps(updated_ws), time.time(), clean_sid),
        )
        ctx.db.commit()

    if len(files_list) >= 2:
        try:
            record_affinity_interaction(ctx, files_list, interaction_type="commit", weight=3.0)
        except Exception:
            pass
    return {
        "status": "success",
        "session_id": clean_sid,
        "transaction_id": clean_tx,
        "active_plan": plan_obj,
        "auto_advanced": bool(auto_complete and advance_res.get("status") == "success"),
        "next_task": advance_res.get("next_task"),
    }

def persist_paused_turn_state(
    ctx,
    session_id: Optional[str],
    routine_id: str,
    routine_result: Dict[str, Any],
    existing_ws_list: List[Dict[str, Any]],
    existing_web_chat_state: Dict[str, Any],
    attached_files: Optional[List[str]],
    read_only_files: Optional[List[str]],
    updated_summary: str,
    updated_compacted_view: Dict[str, Any],
) -> Dict[str, Any]:
    """Persists working-set TTL state, web-chat hashes, and resumable checkpoint when a routine pauses for user handoff."""
    from .session_ledger import reconcile_working_set_ttl as _reconcile_ws

    now = time.time()
    env = routine_result.get("envelope")
    pinned_turn = list((env.editable_files if env is not None else None) or attached_files or [])
    readonly_turn = list((env.readonly_files if env is not None else None) or read_only_files or [])
    const_turn = list(env.constitution_files if env is not None else [])
    paused_ws = _reconcile_ws(
        existing_ws_list,
        pinned_this_turn=pinned_turn,
        user_pinned_uris=list(attached_files or []),
        referenced_this_turn=readonly_turn,
        advance_turn_age=False,
    )
    next_wc_state = {
        "window_mode": (env.web_chat_window_mode if env is not None else None) or existing_web_chat_state.get("window_mode") or "same_window",
        "sent_hashes": (env.sent_hashes if env is not None else None) or existing_web_chat_state.get("sent_hashes") or {},
    }
    paused_cp_dict = routine_result.get("checkpoint") or {
        "status": "paused_for_user",
        "routine_id": routine_result.get("routine_id", routine_id),
        "routine_title": routine_result.get("routine_title"),
        "pending_handoff": routine_result.get("pending_handoff"),
        "wavefronts": routine_result.get("wavefronts", []),
    }
    paused_cp = json.dumps(paused_cp_dict)
    s_row_p = ctx.db.execute("SELECT token_ledger_json FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()
    p_ledger: Dict[str, Any] = {}
    if s_row_p and s_row_p.get("token_ledger_json"):
        try:
            p_ledger = json.loads(s_row_p["token_ledger_json"] or "{}")
        except Exception:
            p_ledger = {}
    if env is not None and env.budget_limit_usd:
        p_ledger["budget_limit_usd"] = float(env.budget_limit_usd)
    if env is not None and env.budget_step_usd:
        p_ledger["budget_step_usd"] = float(env.budget_step_usd)
    active_plan_obj = env.active_plan if env is not None else None
    if isinstance(active_plan_obj, dict) and active_plan_obj.get("tasks"):
        ctx.db.execute(
            "UPDATE chat_sessions SET active_job_id=NULL, updated_at=?, working_set_json=?, summary=?, compacted_view_json=?, web_chat_state_json=?, checkpoint_json=?, token_ledger_json=?, active_plan_json=? WHERE session_id=?",
            (now, json.dumps(paused_ws), updated_summary, json.dumps(updated_compacted_view), json.dumps(next_wc_state), paused_cp, json.dumps(p_ledger), json.dumps(active_plan_obj), session_id),
        )
    else:
        ctx.db.execute(
            "UPDATE chat_sessions SET active_job_id=NULL, updated_at=?, working_set_json=?, summary=?, compacted_view_json=?, web_chat_state_json=?, checkpoint_json=?, token_ledger_json=? WHERE session_id=?",
            (now, json.dumps(paused_ws), updated_summary, json.dumps(updated_compacted_view), json.dumps(next_wc_state), paused_cp, json.dumps(p_ledger), session_id),
        )
    ctx.db.commit()
    return {
        "message": "Routine paused for Web-Chat handoff.",
        "artifact": {
            "session_id": session_id,
            "routine_id": routine_result.get("routine_id", routine_id),
            "status": "paused_for_user",
            "user_prompt": (env.user_prompt if env is not None else "") or "",
            "pending_handoff": routine_result.get("pending_handoff"),
            "wavefronts": routine_result.get("wavefronts", []),
            "attached_files": pinned_turn,
            "read_only_files": readonly_turn,
            "constitution_files": const_turn,
            "execution_trace": (env.execution_trace if env is not None else []) or [],
            "file_token_map": (env.file_token_map if env is not None else {}) or {},
            "active_plan": active_plan_obj,
        },
    }

def finalize_completed_turn_state(
    ctx,
    *,
    session_id: Optional[str],
    s_row: Any,
    user_prompt: str,
    mode: str,
    attached_files: Optional[List[str]],
    read_only_files: Optional[List[str]],
    existing_ws_list: List[Dict[str, Any]],
    existing_web_chat_state: Dict[str, Any],
    updated_summary: str,
    updated_compacted_view: Dict[str, Any],
    routine_result: Dict[str, Any],
) -> Dict[str, Any]:
    """Persists assistant message, working-set TTL, Hebbian affinity edges, and session token ledger upon turn completion."""
    from .session_ledger import append_session_message as _append_msg, reconcile_working_set_ttl as _reconcile_ws

    full_response = routine_result.get("response") or ""
    raw_full_response = routine_result.get("raw_response") or full_response
    all_tx_ids = routine_result.get("transaction_ids") or ([routine_result["transaction_id"]] if routine_result.get("transaction_id") else [])
    tx_id = ",".join(all_tx_ids) if all_tx_ids else None
    now = time.time()
    env = routine_result.get("envelope")
    pinned_final = list((env.editable_files if env is not None else None) or attached_files or [])
    readonly_final = list((env.readonly_files if env is not None else None) or read_only_files or [])
    committed_list = list(routine_result.get("committed_files") or [])
    turn_context_uris = pinned_final + readonly_final + committed_list
    surviving_ws = _reconcile_ws(
        existing_ws_list,
        pinned_this_turn=pinned_final,
        user_pinned_uris=list(attached_files or []),
        referenced_this_turn=readonly_final,
        committed_this_turn=committed_list,
        advance_turn_age=True,
    )
    turn_tok_map = dict((env.file_token_map if env is not None else {}) or {})
    for ws_item in surviving_ws:
        fp_ws = ws_item.get("filepath")
        if fp_ws and fp_ws in turn_tok_map:
            ws_item["tokens"] = int(turn_tok_map[fp_ws])

    try:
        if len(committed_list) >= 2:
            record_affinity_interaction(ctx, committed_list, interaction_type="commit", weight=3.0)
        if attached_files and len(attached_files) >= 2:
            record_affinity_interaction(ctx, attached_files, interaction_type="pin", weight=2.0)
    except Exception:
        pass

    token_ledger = {"prompt_tokens": 0, "completion_tokens": 0, "saved_by_slicing": 0}
    if s_row and s_row.get("token_ledger_json"):
        try:
            token_ledger.update(json.loads(s_row["token_ledger_json"]))
        except Exception:
            pass
    fetch_ctx_state = (env.get_node("fetch_context") if env is not None else None) or {}
    ctx_est_tok = int(fetch_ctx_state.get("total_tokens_estimated") or 0)
    token_ledger["prompt_tokens"] = int(token_ledger.get("prompt_tokens", 0)) + max(1, (len(user_prompt or "") // 4) + ctx_est_tok)
    token_ledger["completion_tokens"] = int(token_ledger.get("completion_tokens", 0)) + max(1, len(raw_full_response or "") // 4)
    token_ledger["saved_by_slicing"] = int(token_ledger.get("saved_by_slicing", 0)) + int(fetch_ctx_state.get("saved_by_slicing_tokens") or 0)
    if turn_tok_map:
        token_ledger["file_token_map"] = {**(token_ledger.get("file_token_map") or {}), **turn_tok_map}
    if env is not None and env.budget_limit_usd:
        token_ledger["budget_limit_usd"] = float(env.budget_limit_usd)
    if env is not None and env.budget_step_usd:
        token_ledger["budget_step_usd"] = float(env.budget_step_usd)

    ratified_hashes = (
        (env.staged_sent_hashes if env is not None else None)
        or (env.sent_hashes if env is not None else None)
        or existing_web_chat_state.get("sent_hashes")
        or {}
    )
    final_wc_state = json.dumps({
        "window_mode": (env.web_chat_window_mode if env is not None else None) or existing_web_chat_state.get("window_mode") or "same_window",
        "sent_hashes": ratified_hashes,
    })
    raw_env_plan = env.active_plan if env is not None else None
    active_plan_final = raw_env_plan if isinstance(raw_env_plan, dict) and raw_env_plan.get("tasks") else None
    if active_plan_final is None and s_row and s_row.get("active_plan_json"):
        try:
            loaded_p = json.loads(s_row.get("active_plan_json") or "{}")
            active_plan_final = loaded_p if (isinstance(loaded_p, dict) and loaded_p.get("tasks")) else None
        except Exception:
            active_plan_final = None
    staged_tm_for_ui, cleaned_unapplied, applied_tm_plan = process_turn_task_directives(
        ctx,
        session_id,
        routine_result.get("unapplied_patches") or raw_full_response or "",
        preset_actions=(env.staged_task_actions if env is not None else None),
    )
    if applied_tm_plan:
        active_plan_final = applied_tm_plan
        act_t_id = active_plan_final.get("active_task_id")
        act_t_obj = next((t for t in (active_plan_final.get("tasks") or []) if t.get("id") == act_t_id), None)
        if act_t_obj and act_t_obj.get("targets"):
            surviving_ws = _reconcile_ws(
                surviving_ws, active_plan_targets=list(act_t_obj["targets"]), advance_turn_age=False
            )
    asst_snapshot = {
        "mode": routine_result.get("mode", mode),
        "routine_id": routine_result.get("routine_id") or (env.routine_id if env is not None else "workspace_turn"),
        "working_set": surviving_ws,
        "active_plan": active_plan_final,
        "sent_hashes": ratified_hashes,
        "execution_trace": (env.execution_trace if env is not None else []) or [],
    }
    appended = _append_msg(
        ctx,
        session_id or "default",
        "assistant",
        full_response,
        raw_content=raw_full_response,
        transaction_id=tx_id,
        committed_files=committed_list,
        context_uris=turn_context_uris,
        envelope_snapshot=asst_snapshot,
        now=now,
    )
    asst_msg_id = appended["message_id"] if appended else f"msg_{int(now)}"

    plan_json_str = json.dumps(active_plan_final) if (isinstance(active_plan_final, dict) and active_plan_final.get("tasks")) else "{}"
    common_args = (now, json.dumps(surviving_ws), updated_summary, json.dumps(updated_compacted_view), final_wc_state, json.dumps(token_ledger), plan_json_str, session_id)
    if tx_id:
        ctx.db.execute(
            "UPDATE chat_sessions SET last_transaction_id=?, active_job_id=NULL, updated_at=?, working_set_json=?, summary=?, compacted_view_json=?, web_chat_state_json=?, checkpoint_json='null', token_ledger_json=?, active_plan_json=? WHERE session_id=?",
            (tx_id, *common_args),
        )
    else:
        ctx.db.execute(
            "UPDATE chat_sessions SET active_job_id=NULL, updated_at=?, working_set_json=?, summary=?, compacted_view_json=?, web_chat_state_json=?, checkpoint_json='null', token_ledger_json=?, active_plan_json=? WHERE session_id=?",
            common_args,
        )
    ctx.db.commit()
    if tx_id and isinstance(active_plan_final, dict) and active_plan_final.get("tasks"):
        rec_out = record_committed_bridge_transaction(ctx, session_id, tx_id, committed_list)
        active_plan_final = rec_out.get("active_plan") or active_plan_final
    return {
        "message": "Turn complete.",
        "artifact": {
            "message_id": asst_msg_id, "response": full_response,
            "unapplied_patches": cleaned_unapplied if routine_result.get("unapplied_patches") else "",
            "task_manage_actions": staged_tm_for_ui,
            "task_actions": staged_tm_for_ui,
            "mode": routine_result.get("mode", mode), "effective_intent": routine_result.get("effective_intent"),
            "transaction_id": routine_result.get("transaction_id"), "transaction_ids": all_tx_ids,
            "committed_files": committed_list,
            "execution_trace": (env.execution_trace if env is not None else []) or [],
            "file_token_map": turn_tok_map, "active_plan": active_plan_final,
        },
    }


def execute_bridge_sync_and_test_gate(
    ctx,
    node: Dict[str, Any],
    routine: Dict[str, Any],
    routine_id: str,
    envelope: RoutineEnvelope,
    context_lock,
    *,
    cur_step: int,
    total_nodes: int,
    user_prompt: str,
    has_raw_patches: bool,
    is_ai_assisted: bool,
    active_profile_id: Optional[str],
    primary_repo_name: str,
    run_tests_val: bool,
    strict_test_val: bool,
    history_messages: Optional[List[Dict[str, str]]],
    final_response_text: str,
    last_transaction_id: Optional[str],
    turn_transaction_ids: List[str],
    committed_files: List[str],
    is_cancelled_fn: Optional[Callable[[], bool]],
    set_node_state_fn: Callable[[str, Dict[str, Any]], Dict[str, Any]],
) -> Tuple[str, Optional[str]]:
    """
    Executes the `bridge.sync` verification/commit step with bounded `n-1` test-failure self-healing
    and transactional rollback under `strict_test_enforcement`.
    Returns `(updated_final_response_text, updated_last_transaction_id)`.
    """
    nid = node["id"]
    node_payload = node.get("args") or node.get("payload") or {}
    raw_payload_arg = node_payload.get("text")
    arg_patch_text = _interpolate_all_syntax(raw_payload_arg, envelope.to_scope_dict(ctx)) if raw_payload_arg else ""
    gen_out = envelope.get_node("generate_patch") or {}
    raw_sync_text = arg_patch_text or gen_out.get("text") or final_response_text or (user_prompt if has_raw_patches else "")
    tm_acts, patch_text = extract_task_manage_directives(raw_sync_text)
    if tm_acts:
        with context_lock:
            envelope.staged_task_actions = list(tm_acts)
    if "<<<<<<< " not in patch_text:
        with context_lock:
            set_node_state_fn(nid, {"status": "skipped", "can_commit": True, "failed_cells": [], "reason": "No patch blocks in payload"})
        return final_response_text, last_transaction_id

    raw_dry_flag = node_payload.get("validate_only") if "validate_only" in node_payload else node_payload.get("dry_run")
    is_validate_only = (raw_dry_flag.strip().lower() in ("true", "1", "yes")) if isinstance(raw_dry_flag, str) else bool(raw_dry_flag)
    max_self_heal = 1 if not is_ai_assisted else int(node.get("max_retries", 3) or 3)

    for heal_attempt in range(max_self_heal):
        if callable(is_cancelled_fn) and is_cancelled_fn():
            raise RuntimeError("Agent turn cancelled by user.")
        parsed_blocks = parse_blocks(patch_text)
        readonly_set = set(envelope.readonly_files)

        def _is_readonly(raw_uri: Any) -> bool:
            if not raw_uri:
                return False
            try:
                return raw_uri in readonly_set or InSetuURI.canonicalize(str(raw_uri)) in readonly_set
            except Exception:
                return raw_uri in readonly_set

        # A cross-file op makes the bridge accept both of its ends, so neither end may be a read-only file.
        ro_cross_files = sorted({
            str(blk.get(end_key))
            for blks in parsed_blocks.values() for blk in (blks or [])
            if isinstance(blk, dict) and blk.get("type") in ("relocate", "rename", "move_file", "archive_file", "delete_file")
            for end_key in ("source_uri", "target_uri")
            if _is_readonly(blk.get(end_key))
        })
        if ro_cross_files:
            with context_lock:
                set_node_state_fn(nid, {
                    "status": "failed", "can_commit": False, "failed_cells": [],
                    "error": f"The patch moves content into or out of read-only file(s) {', '.join(ro_cross_files)}; nothing was applied.",
                })
            return final_response_text, last_transaction_id
        target_files = [f for f in parsed_blocks.keys() if not _is_readonly(f)]
        if parsed_blocks and not target_files:
            with context_lock:
                set_node_state_fn(nid, {
                    "status": "failed", "can_commit": False, "failed_cells": [],
                    "error": "The patch targets only read-only files; nothing was applied.",
                })
            return final_response_text, last_transaction_id

        bridge_res = ctx.call(
            "bridge.sync", text=patch_text, active_files=target_files, dry_run=is_validate_only,
            repair_mode="ai_assisted" if (is_ai_assisted and max_self_heal > 1) else "algorithmic",
            auto_heal=(is_ai_assisted and max_self_heal > 1), max_heal_passes=max(1, max_self_heal - 1),
            profile_id=active_profile_id, wait=True,
        )
        if isinstance(bridge_res, dict) and bridge_res.get("healed_payload"):
            patch_text = bridge_res["healed_payload"]
            final_response_text = patch_text
            set_node_state_fn("generate_patch", {"status": "completed", "text": patch_text})

        if isinstance(bridge_res, dict) and bridge_res.get("can_commit"):
            committed_tx_id = bridge_res.get("transaction_id") if not is_validate_only else None
            test_diag_res = None
            if not is_validate_only and (run_tests_val or strict_test_val):
                ctx.jobs.update_progress(f"Step {cur_step}/{total_nodes} [{nid}]: Running post-commit test gate...")
                try:
                    test_diag_res = ctx.call("bridge.test", repo=primary_repo_name, target_files=target_files, wait=True)
                except Exception as test_err:
                    test_diag_res = {"status": "ERROR", "exit_code": -1, "raw_tail": str(test_err), "failures": []}
                if isinstance(test_diag_res, dict):
                    with context_lock:
                        envelope.sys["last_exit_code"] = int(test_diag_res.get("exit_code", 0) or 0)
                        envelope.sys["test_failure_count"] = int(test_diag_res.get("failed_count", 0) or 0)
                if isinstance(test_diag_res, dict) and test_diag_res.get("status") not in ("PASSED", "passed"):
                    fail_tail = test_diag_res.get("raw_tail") or json.dumps(test_diag_res.get("failures") or [])
                    if strict_test_val and heal_attempt + 1 < max_self_heal:
                        ctx.jobs.update_progress(f"Step {cur_step}/{total_nodes} [{nid}]: Test gate failed; self-healing ({heal_attempt + 1}/{max_self_heal})...")
                        if committed_tx_id and committed_tx_id not in turn_transaction_ids:
                            turn_transaction_ids.append(committed_tx_id)
                        live_disk_context = _collect_live_files_for_patch_healing(ctx, parsed_blocks, envelope.readonly_files)
                        feedback_body = (
                            f"[TEST GATE FAILURE FEEDBACK]: Your patch applied cleanly, but the test suite failed:\n{fail_tail}\n\n"
                            f"{live_disk_context}\n\nPlease fix the regression and output a Yomama patch block against the current file on disk."
                        )
                        heal_messages = list(history_messages or []) + [
                            {"role": "assistant", "content": patch_text},
                            {"role": "user", "content": feedback_body},
                        ]
                        heal_llm = ctx.call(
                            "llm.complete", messages=heal_messages,
                            system="You are the inSetu Yomama Patch Healer. Repair the test regression against the exact disk content provided.",
                            tier="fast", profile_id=active_profile_id, output_schema="yomama_patch",
                            caller_tag=f"orchestrator:test_heal:{routine.get('id', routine_id)}", wait=True,
                        )
                        patch_text = heal_llm.get("text", "") if isinstance(heal_llm, dict) else str(heal_llm)
                        final_response_text = patch_text
                        set_node_state_fn("generate_patch", {"status": "completed", "text": patch_text})
                        continue
                    elif strict_test_val:
                        txs_to_revert = list(turn_transaction_ids) + ([committed_tx_id] if committed_tx_id and committed_tx_id not in turn_transaction_ids else [])
                        for rev_tx in reversed(txs_to_revert):
                            try:
                                ctx.call("bridge.revert", transaction_id=rev_tx, target_state="initial", wait=True)
                            except Exception:
                                pass
                        turn_transaction_ids.clear()
                        committed_files.clear()
                        last_transaction_id = None
                        final_response_text = (
                            (final_response_text or patch_text)
                            + f"\n\n⏪ **Strict Test Gate Failed — Rolled Back Transaction (`{committed_tx_id}`):**\n```\n{fail_tail[:1500]}\n```"
                        )
                        with context_lock:
                            set_node_state_fn(nid, {
                                "status": "failed", "can_commit": False, "rolled_back": True,
                                "test_diagnostics": test_diag_res, "error": f"Strict test gate failed: {fail_tail[:500]}",
                            })
                        return final_response_text, last_transaction_id

            with context_lock:
                if not is_validate_only:
                    last_transaction_id = committed_tx_id
                    if last_transaction_id and last_transaction_id not in turn_transaction_ids:
                        turn_transaction_ids.append(last_transaction_id)
                    for tf in target_files:
                        if tf not in committed_files:
                            committed_files.append(tf)
                    resolved_count = bridge_res.get("summary", {}).get("resolved", 0)
                    total_heals = heal_attempt + int(bridge_res.get("healed_attempts") or 0)
                    healed_note = f" (after {total_heals} self-heal pass(es))" if total_heals > 0 else ""
                    if not final_response_text:
                        final_response_text = f"✅ Applied {resolved_count} patch(es) cleanly{healed_note} (`{last_transaction_id}`)."
                set_node_state_fn(nid, {
                    "status": "completed", "can_commit": True, "failed_cells": [],
                    "transaction_id": last_transaction_id, "committed_files": list(target_files),
                    "bridge_telemetry": bridge_res, "test_diagnostics": test_diag_res,
                })
            return final_response_text, last_transaction_id

        failed_cells_list = []
        for p in (bridge_res.get("patches", []) if isinstance(bridge_res, dict) else []):
            if p.get("status") not in ("resolved", "auto_skipped"):
                orig_fp = p.get("original_file") or p.get("resolved_file") or ""
                file_blks = parsed_blocks.get(orig_fp) or []
                matched_blk = next((fb for fb in file_blks if p.get("cell_id") and fb.get("id") == p.get("cell_id")), file_blks[0] if file_blks else None)
                raw_blk_str = serialize_block_chunk(matched_blk, filepath=orig_fp, include_file_header=True) if matched_blk else ""
                failed_cells_list.append({
                    "cell_id": p.get("cell_id"), "resolved_file": p.get("resolved_file") or orig_fp,
                    "error_message": p.get("error_message") or p.get("status"), "raw_block": raw_blk_str,
                })
        err_details = "\n".join(
            f"- {p.get('resolved_file') or p.get('original_file')}: {p.get('error_message', '')}"
            for p in (bridge_res.get("patches", []) if isinstance(bridge_res, dict) else [])
            if p.get("error_message")
        ) or (bridge_res.get("message", "Patch failed verification.") if isinstance(bridge_res, dict) else "Patch failed.")
        if not is_validate_only:
            final_response_text = (final_response_text or patch_text) + f"\n\n⚠️ **Patch Verification Failed After {max_self_heal} Attempts:**\n```\n{err_details}\n```"
        with context_lock:
            set_node_state_fn(nid, {
                "status": "completed" if is_validate_only else "failed", "can_commit": False,
                "failed_cells": failed_cells_list, "error": err_details, "bridge_telemetry": bridge_res,
            })
        break
    return final_response_text, last_transaction_id
