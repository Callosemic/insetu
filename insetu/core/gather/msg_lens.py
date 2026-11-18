"""
insetu.core.gather.msg_lens
~~~~~~~~~~~~~~~~~~~~~~~~~~~
`msg://` Lens Provider implementation (`msg://<session_id>` and `msg://<message_id>[#telemetry]`):
Projects session-level overviews (`00_session_overview.txt`) and self-contained per-turn forensic
dossiers (`turn_<NNN>_dossier.txt`) joining `chat_messages`, `__envelope__` working-set snapshots,
DAG `execution_trace` trees, and `llm_telemetry` node calls.
"""

import json
import re
from typing import Any, Callable, Dict, List, Tuple

from insetu.core.sdk import InSetuURI


def parse_message_uri(raw_uri: str) -> Tuple[str, str, bool]:
    """Canonicalizes any session or message reference into `(canonical_uri, target_id, want_raw)`."""
    raw = str(raw_uri or "").strip().split("#", 1)[0].strip()
    want_raw = bool(re.search(r'\[raw\]', raw, flags=re.IGNORECASE))
    cleaned = re.sub(r'\[(?:raw|full|slice|outline|diff|dossier)\]', '', raw, flags=re.IGNORECASE).strip()
    msg_id = cleaned[len("msg://"):].strip().strip("/").rsplit("/", 1)[-1].strip() if cleaned.startswith("msg://") else cleaned.strip()
    return (f"msg://{msg_id}", msg_id, want_raw) if msg_id else ("msg://", "", want_raw)


def format_trace_tree_lines(trace_list: List[Dict[str, Any]], indent: str = "  ") -> List[str]:
    """Formats a hierarchical `RoutineEnvelope.execution_trace` list into indented text lines."""
    lines: List[str] = []
    for st in (trace_list or []):
        if not isinstance(st, dict):
            continue
        nid = st.get("id") or "step"
        status = st.get("status") or "completed"
        tier_or_cap = st.get("tier") or st.get("capability") or st.get("type") or ""
        ms = f" ({st.get('elapsed_ms')}ms)" if st.get("elapsed_ms") is not None else ""
        summary = f" — {st.get('summary')}" if st.get("summary") else ""
        deltas = []
        if st.get("added_files"):
            deltas.append(f"+{len(st['added_files'])} added ({', '.join(InSetuURI(u).basename for u in st['added_files'][:4])})")
        if st.get("dropped_files"):
            deltas.append(f"-{len(st['dropped_files'])} dropped")
        delta_str = f" [{'; '.join(deltas)}]" if deltas else ""
        lines.append(f"{indent}• {nid} [{tier_or_cap}] ({status}){ms}{summary}{delta_str}")
        for ch in (st.get("children") or []):
            if isinstance(ch, dict):
                ch_ms = f" ({ch.get('elapsed_ms')}ms)" if ch.get("elapsed_ms") is not None else ""
                lines.append(f"{indent}    ↳ {ch.get('id')} [{ch.get('status', 'completed')}]{ch_ms}: {ch.get('summary', '')}")
    return lines


def project_session_msg_lens(
    ctx,
    session_id: str,
    s_row: Dict[str, Any],
    clean_lens: str,
    *,
    scrub_fn: Callable[[str, List[str]], str],
    collect_secrets_fn: Callable[[Any], List[str]],
    build_proj_fn: Callable[..., Dict[str, Any]],
) -> Dict[str, Any]:
    """Projects a whole session (`msg://<session_id>`) at `outline`, `slice` (`00_session_overview.txt`), or `full`."""
    agent_db = ctx.get_db("agent")
    msg_rows = [
        dict(r) for r in agent_db.execute(
            "SELECT message_id, seq, role, content, raw_content, receipt, transaction_id, timestamp, context_hashes_json "
            "FROM chat_messages WHERE session_id=? ORDER BY seq ASC, timestamp ASC",
            (session_id,),
        ).fetchall()
    ]
    if clean_lens == "outline":
        lines = [f"=== SESSION OUTLINE: {s_row.get('title') or session_id} ({len(msg_rows)} message(s)) ==="]
        for m in msg_rows:
            lines.append(f"  - [Turn #{m.get('seq')} · {m['message_id']} ({m.get('role')})]: {m.get('receipt') or (m.get('content') or '')[:120]}")
        return build_proj_fn(f"msg://{session_id}", "outline", "outline", "\n".join(lines))

    secrets_list = collect_secrets_fn(ctx)
    lines = [
        "============================================================",
        f"00_SESSION_OVERVIEW :: {s_row.get('title') or session_id} (session_id={session_id})",
        "============================================================",
    ]
    try:
        tok_ledger = json.loads(s_row.get("token_ledger_json") or "{}")
    except Exception:
        tok_ledger = {}
    if tok_ledger:
        lines.append(
            f"Session Spend: ${float(tok_ledger.get('total_cost_usd') or 0.0):.4f} / "
            f"${float(tok_ledger.get('budget_limit_usd') or 1.0):.2f} | "
            f"Prompt Tok: {int(tok_ledger.get('prompt_tokens') or 0):,} | "
            f"Completion Tok: {int(tok_ledger.get('completion_tokens') or 0):,}"
        )
    try:
        plan_obj = json.loads(s_row.get("active_plan_json") or "{}")
    except Exception:
        plan_obj = {}
    if isinstance(plan_obj, dict) and plan_obj.get("tasks"):
        lines.append(f"\nACTIVE PLAN: {plan_obj.get('title') or 'Execution Plan'} (active_task_id={plan_obj.get('active_task_id')})")
        for t in plan_obj["tasks"]:
            chk = "x" if t.get("completed") else ("->" if t.get("id") == plan_obj.get("active_task_id") else " ")
            t_files = ", ".join(t.get("targets") or [])
            lines.append(f"  [{chk}] [{t.get('id')}] ({t.get('kind', 'edit')}) {t.get('description')} | targets: {t_files}")

    try:
        cp_obj = json.loads(s_row.get("checkpoint_json") or "null")
    except Exception:
        cp_obj = None

    lines.append("\n=== CHRONOLOGICAL TURN & ROUTINE EXECUTION FLOW ===")
    for idx_m, m in enumerate(msg_rows):
        snap = {}
        try:
            snap = (json.loads(m.get("context_hashes_json") or "{}") or {}).get("__envelope__") or {}
        except Exception:
            snap = {}
        is_latest_paused_user = (
            idx_m == len(msg_rows) - 1
            and m.get("role") == "user"
            and isinstance(cp_obj, dict)
            and bool(cp_obj.get("status"))
        )
        pill = snap.get("command_pill") or (f"/{snap['mode']}" if snap.get("mode") else "")
        lines.append(f"\n[Turn #{m.get('seq')} · {m['message_id']} · {str(m.get('role') or '').upper()}{(' ' + pill) if pill else ''}]")
        lines.append(f"  Receipt: {m.get('receipt') or (m.get('content') or '')[:200]}")
        ws_snap = snap.get("working_set") or []
        if ws_snap:
            pinned_cnt = sum(1 for w in ws_snap if isinstance(w, dict) and w.get("tier") == "pinned")
            ref_cnt = sum(1 for w in ws_snap if isinstance(w, dict) and w.get("tier") == "reference")
            lines.append(f"  Working Set Snapshot: {pinned_cnt} full/pinned, {ref_cnt} slice/reference")
        trace_for_turn = snap.get("execution_trace") or (cp_obj.get("execution_trace") if is_latest_paused_user else None) or []
        tr_lines = format_trace_tree_lines(trace_for_turn, indent="    ")
        if tr_lines:
            lines.append("  Routine Execution Trace:")
            lines.extend(tr_lines)

    if isinstance(cp_obj, dict) and cp_obj.get("status"):
        lines.append(f"\n=== ACTIVE PAUSED CHECKPOINT ({cp_obj.get('status')}) ===")
        lines.extend(format_trace_tree_lines(cp_obj.get("execution_trace") or [], indent="  "))

    try:
        llm_conn = ctx.get_db("llm")
        first_ts = float(msg_rows[0]["timestamp"]) - 5.0 if msg_rows else 0.0
        llm_rows = llm_conn.execute(
            "SELECT call_id, caller_tag, tier, model, status, attempts, latency_ms, prompt_chars, response_chars, error_message "
            "FROM llm_telemetry WHERE session_id=? OR (COALESCE(session_id, '')='' AND timestamp >= ?) ORDER BY timestamp ASC LIMIT 80",
            (session_id, first_ts),
        ).fetchall()
    except Exception:
        llm_rows = []
    if llm_rows:
        lines.append("\n=== SESSION LLM CALL SUMMARY TABLE (llm_telemetry) ===")
        lines.append("call_id | caller_tag | tier | model | status | try | latency_ms | prompt->resp chars")
        lines.append("-" * 92)
        for lr in llm_rows:
            lk = dict(lr)
            err_s = f" | ERR: {str(lk.get('error_message'))[:80]}" if lk.get("error_message") else ""
            lines.append(
                f"{lk.get('call_id')} | {lk.get('caller_tag')} | {lk.get('tier')} | {lk.get('model')} | "
                f"{lk.get('status')} | {lk.get('attempts')} | {lk.get('latency_ms')}ms | "
                f"{lk.get('prompt_chars')}->{lk.get('response_chars')}{err_s}"
            )

    overview_txt = scrub_fn("\n".join(lines) + "\n", secrets_list)
    return build_proj_fn(f"msg://{session_id}", clean_lens, "slice" if clean_lens != "full" else "full", overview_txt)


def project_turn_dossier(
    ctx,
    rk: Dict[str, Any],
    *,
    want_raw: bool = False,
    include_telemetry: bool = False,
    scrub_fn: Callable[[str, List[str]], str],
    collect_secrets_fn: Callable[[Any], List[str]],
) -> str:
    """Renders the complete forensic turn dossier (`turn_<NNN>_dossier.txt`) for `msg://<message_id>`."""
    msg_id = rk["message_id"]
    session_id = rk.get("session_id") or "default"
    seq_no = int(rk.get("seq") or 0)
    body = rk.get("raw_content") if (want_raw and rk.get("raw_content")) else rk.get("content")
    if not include_telemetry:
        return f"=== MESSAGE {msg_id} (Turn #{seq_no} · {rk.get('role')}) ===\n{body or ''}"

    secrets_list = collect_secrets_fn(ctx)
    agent_db = ctx.get_db("agent")
    is_asst_root = (rk.get("role") == "assistant")
    next_row = None if is_asst_root else agent_db.execute(
        "SELECT message_id, seq, role, content, raw_content, transaction_id, timestamp, context_hashes_json "
        "FROM chat_messages WHERE session_id=? AND seq > ? ORDER BY seq ASC LIMIT 1",
        (session_id, seq_no),
    ).fetchone()
    next_rk = rk if is_asst_root else (dict(next_row) if next_row else None)
    t_start = float(rk.get("timestamp") or 0.0) - (60.0 if is_asst_root else 1.0)
    t_end = (float(next_rk["timestamp"]) + 2.0) if (next_rk and next_rk.get("role") == "assistant") else (t_start + 600.0)

    snap: Dict[str, Any] = {}
    if not is_asst_root:
        try:
            snap = (json.loads(rk.get("context_hashes_json") or "{}") or {}).get("__envelope__") or {}
        except Exception:
            snap = {}
    post_snap: Dict[str, Any] = {}
    if next_rk and next_rk.get("role") == "assistant":
        try:
            post_snap = (json.loads(next_rk.get("context_hashes_json") or "{}") or {}).get("__envelope__") or {}
        except Exception:
            post_snap = {}

    cp_trace: List[Dict[str, Any]] = []
    cp_ws_summary: List[str] = []
    if not post_snap.get("execution_trace"):
        s_row = agent_db.execute("SELECT checkpoint_json FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()
        if s_row and s_row.get("checkpoint_json"):
            try:
                cp_obj = json.loads(s_row["checkpoint_json"] or "null")
                if isinstance(cp_obj, dict):
                    if cp_obj.get("execution_trace"):
                        cp_trace = cp_obj["execution_trace"]
                    cp_arts = cp_obj.get("artifacts")
                    if isinstance(cp_arts, dict) and cp_arts:
                        cp_ws_summary = [
                            f"{u} ({spec.get('served_lens') or spec.get('lens') or 'full'}, {int(spec.get('tokens') or 0)} tok)"
                            for u, spec in cp_arts.items()
                            if isinstance(spec, dict)
                        ]
            except Exception:
                cp_trace = []

    mode_str = snap.get("mode") or post_snap.get("mode") or "auto"
    routine_str = snap.get("routine_id") or post_snap.get("routine_id") or "workspace_turn"
    lines = [
        "============================================================",
        f"TURN DOSSIER :: Turn #{seq_no} ({msg_id}) | Mode: /{mode_str} ({routine_str})",
        "============================================================",
        f"--- 1. USER PROMPT ({msg_id}) ---",
        str(rk.get("content") or ""),
    ]
    ws_pre = snap.get("working_set") or []
    ws_post = post_snap.get("working_set") or []
    if ws_pre or ws_post or cp_ws_summary:
        lines.append("\n--- 2. WORKING-SET ENVELOPE SNAPSHOTS ---")
        if ws_pre:
            lines.append("Pre-Turn Working Set: " + ", ".join(f"{w.get('filepath')} ({w.get('tier')})" for w in ws_pre if isinstance(w, dict)))
        if ws_post:
            lines.append("Post-Turn Working Set: " + ", ".join(f"{w.get('filepath')} ({w.get('tier')}, {w.get('tokens', 0)} tok)" for w in ws_post if isinstance(w, dict)))
        elif cp_ws_summary:
            lines.append("Paused-Handoff Working Set: " + ", ".join(cp_ws_summary))

    trace_to_render = post_snap.get("execution_trace") or snap.get("execution_trace") or cp_trace
    if trace_to_render:
        lines.append("\n--- 3. ROUTINE DAG EXECUTION TRACE ---")
        lines.extend(format_trace_tree_lines(trace_to_render, indent="  "))

    try:
        llm_conn = ctx.get_db("llm")
        llm_calls = [
            dict(r) for r in llm_conn.execute(
                "SELECT * FROM llm_telemetry WHERE turn_msg_id=? OR (session_id=? AND timestamp >= ? AND timestamp <= ?) ORDER BY timestamp ASC",
                (msg_id, session_id, t_start, t_end),
            ).fetchall()
        ]
    except Exception:
        llm_calls = []
    if llm_calls:
        lines.append(f"\n--- 4. PER-NODE LLM CALLS ({len(llm_calls)} call(s)) ---")
        for idx_c, lc in enumerate(llm_calls, 1):
            lines.append(
                f"\n[LLM Call #{idx_c}: {lc.get('caller_tag')} | tier={lc.get('tier')} | model={lc.get('model')} | "
                f"status={lc.get('status')} | {lc.get('latency_ms')}ms | {lc.get('prompt_chars')}->{lc.get('response_chars')} chars]"
            )
            if lc.get("error_message"):
                lines.append(f"Error: {lc.get('error_message')}")
            lines.append(f"Prompt Excerpt:\n{lc.get('prompt_excerpt') or ''}\n")
            lines.append(f"Response Excerpt:\n{lc.get('response_excerpt') or ''}")

    if next_rk and next_rk.get("role") == "assistant":
        lines.append(f"\n--- 5. ASSISTANT REPLY ({next_rk['message_id']} · tx={next_rk.get('transaction_id') or 'none'}) ---")
        lines.append(str(next_rk.get("raw_content") or next_rk.get("content") or ""))

    return scrub_fn("\n".join(lines) + "\n", secrets_list)
