"""
insetu.core.bridge.bridge_telemetry
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Turn-partitioned session & routine telemetry compiler (`00_session_overview.txt` + `turn_<NNN>_dossier.txt`),
`.zip` diagnostic bundle builder, and Bridge AI Auto-Heal audit logger (`bridge_heal_audit`).
Backed directly by the `msg://` Lens Contract (`project_resource_lens`).
"""

import io
import time
from typing import Any, Dict, List, Optional
import uuid
import zipfile

from insetu.core.gather.context_assemble import (
    collect_workspace_secrets as _collect_secrets,
    project_resource_lens,
    scrub_outbound_secrets as _scrub_secrets,
)
from insetu.core.llm.llm_telemetry import get_active_telemetry_turn_msg_id


def log_bridge_heal_audit(
    ctx,
    *,
    t_heal_start: float,
    transaction_id: str,
    filepath: str,
    cell_id: str,
    pass_number: int,
    failure_type: str,
    original_error: str,
    original_block: str,
    windowed_context_sent: str,
    instructions_sent: str,
    healer_raw_output: str,
    healed_block: str,
    verification_status: str,
    verification_error: str,
    model: str,
) -> None:
    """Records a structured Yomama Patch Auto-Heal attempt in `bridge_heal_audit`."""
    try:
        elapsed_ms = int(round((time.time() - t_heal_start) * 1000))
        secrets_set = _collect_secrets(ctx)
        bridge_db = ctx.get_db("bridge")
        bridge_db.insert_or_replace("bridge_heal_audit", {
            "heal_id": f"heal_{uuid.uuid4().hex[:12]}",
            "timestamp": time.time(),
            "transaction_id": transaction_id or get_active_telemetry_turn_msg_id(ctx.workspace_id) or "",
            "filepath": filepath,
            "cell_id": str(cell_id or ""),
            "pass_number": pass_number,
            "failure_type": str(failure_type),
            "original_error": _scrub_secrets(str(original_error or ""), secrets_set),
            "original_block": _scrub_secrets(str(original_block or ""), secrets_set),
            "windowed_context_sent": _scrub_secrets(str(windowed_context_sent or ""), secrets_set),
            "instructions_sent": _scrub_secrets(str(instructions_sent or ""), secrets_set),
            "healer_raw_output": _scrub_secrets(str(healer_raw_output or ""), secrets_set),
            "healed_block": _scrub_secrets(str(healed_block or ""), secrets_set),
            "verification_status": verification_status,
            "verification_error": _scrub_secrets(str(verification_error or ""), secrets_set),
            "model": model,
            "latency_ms": elapsed_ms,
        })
        bridge_db.commit()
    except Exception:
        pass


def _resolve_target_session_id(ctx, session_id: Optional[str] = None) -> Optional[str]:
    clean_sid = str(session_id or "").strip()
    try:
        agent_db = ctx.get_db("agent")
        if clean_sid:
            row = agent_db.execute("SELECT session_id FROM chat_sessions WHERE session_id=?", (clean_sid,)).fetchone()
            if row:
                return row["session_id"]
        row = agent_db.execute("SELECT session_id FROM chat_sessions ORDER BY updated_at DESC LIMIT 1").fetchone()
        return row["session_id"] if row else None
    except Exception:
        return None


def build_session_telemetry_files_map(
    ctx,
    session_id: Optional[str] = None,
    limit: int = 40,
    since_ts: Optional[float] = None,
) -> Dict[str, str]:
    """
    Projects a session's telemetry through the `msg://` Lens Contract into a map of
    `{"00_session_overview.txt": ..., "turn_001_<msg_id>_dossier.txt": ..., "99_bridge_heal_case_studies.txt": ...}`.
    """
    files_map: Dict[str, str] = {}
    target_sid = _resolve_target_session_id(ctx, session_id)
    secrets_set = _collect_secrets(ctx)
    if target_sid:
        overview_proj = project_resource_lens(ctx, f"msg://{target_sid}", lens="slice")
        if overview_proj.get("content"):
            files_map["00_session_overview.txt"] = _scrub_secrets(overview_proj["content"], secrets_set)
        try:
            agent_db = ctx.get_db("agent")
            user_turns = agent_db.execute(
                "SELECT message_id, seq FROM chat_messages WHERE session_id=? AND role='user' ORDER BY seq ASC, timestamp ASC",
                (target_sid,),
            ).fetchall()
            if not user_turns:
                user_turns = agent_db.execute(
                    "SELECT message_id, seq FROM chat_messages WHERE session_id=? ORDER BY seq ASC, timestamp ASC",
                    (target_sid,),
                ).fetchall()
            for idx_t, ut in enumerate(user_turns, 1):
                mid = ut["message_id"]
                seq_num = int(ut["seq"] or idx_t)
                turn_proj = project_resource_lens(ctx, f"msg://{mid}#telemetry", lens="full", include_telemetry=True)
                if turn_proj.get("content"):
                    files_map[f"turn_{seq_num:03d}_{mid}_dossier.txt"] = _scrub_secrets(turn_proj["content"], secrets_set)
        except Exception:
            pass

    safe_limit = max(1, min(int(limit or 40), 200))
    try:
        if since_ts is not None and since_ts > 0:
            heal_rows = ctx.get_db("bridge").execute(
                "SELECT * FROM bridge_heal_audit WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?",
                (float(since_ts), safe_limit),
            ).fetchall()
        else:
            heal_rows = ctx.get_db("bridge").execute(
                "SELECT * FROM bridge_heal_audit ORDER BY timestamp DESC LIMIT ?",
                (safe_limit,),
            ).fetchall()
    except Exception:
        heal_rows = []
    if heal_rows:
        heal_blocks: List[str] = ["=== YOMAMA PATCH AUTO-HEAL CASE STUDIES (bridge_heal_audit) ===\n"]
        for idx, hr in enumerate(heal_rows, 1):
            hd = dict(hr)
            case_block = (
                f"============================================================\n"
                f"CASE STUDY #{idx}: [{hd.get('verification_status', '').upper()}] {hd.get('filepath')}\n"
                f"Transaction: {hd.get('transaction_id') or 'uncommitted'} | Pass: {hd.get('pass_number')} | "
                f"Failure Type: {hd.get('failure_type')} | Model: {hd.get('model')} ({hd.get('latency_ms')}ms)\n"
                f"============================================================\n\n"
                f"--- 1. INITIAL FAILURE DIAGNOSTIC ---\n{hd.get('original_error')}\n\n"
                f"--- 2. ORIGINAL BROKEN PATCH BLOCK ---\n{hd.get('original_block')}\n\n"
                f"--- 3. EXACT INSTRUCTIONS SENT TO HEALER LLM ---\n{hd.get('instructions_sent')}\n\n"
                f"--- 4. EXACT WINDOWED BUFFER CONTEXT SENT TO HEALER LLM ---\n{hd.get('windowed_context_sent')}\n\n"
                f"--- 5. HEALER LLM RAW OUTPUT ---\n{hd.get('healer_raw_output')}\n\n"
                f"--- 6. VERIFICATION OUTCOME AGAINST B_(k-1) ---\nStatus: {hd.get('verification_status')}\n"
                + (f"Verification Error: {hd.get('verification_error')}\n" if hd.get("verification_error") else "")
            )
            heal_blocks.append(_scrub_secrets(case_block, secrets_set))
        files_map["99_bridge_heal_case_studies.txt"] = "\n\n".join(heal_blocks)
    return files_map


def build_session_telemetry_zip_bytes(
    ctx,
    session_id: Optional[str] = None,
    limit: int = 40,
) -> bytes:
    """Packages `00_session_overview.txt` and all `turn_<NNN>_dossier.txt` files into an in-memory `.zip` archive."""
    files_map = build_session_telemetry_files_map(ctx, session_id=session_id, limit=limit)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for fname, content in sorted(files_map.items()):
            zf.writestr(fname, (content or "").encode("utf-8"))
    return buf.getvalue()


def compile_ai_telemetry_context(
    ctx,
    limit: int = 40,
    session_id: Optional[str] = None,
    turn_msg_id: Optional[str] = None,
    latest_turn_only: bool = False,
) -> Dict[str, Any]:
    """
    Compiles `ctx://contexts/ai_telemetry_context.txt` (or `ctx://contexts/ai_latest_turn_telemetry.txt`
    when `latest_turn_only=True`) using the `msg://` Lens Contract:
    Includes `00_session_overview.txt`, the latest (or requested `turn_msg_id`) turn dossier,
    and (when `latest_turn_only=False`) recent tagged `llm_telemetry` calls and `bridge_heal_audit` cases.
    """
    safe_limit = max(1, min(int(limit or 40), 200))
    secrets_set = _collect_secrets(ctx)
    latest_turn_ts = 0.0
    if latest_turn_only:
        try:
            target_sid = _resolve_target_session_id(ctx, session_id)
            if target_sid:
                t_row = ctx.get_db("agent").execute(
                    "SELECT timestamp FROM chat_messages WHERE session_id=? AND role='user' ORDER BY seq DESC, timestamp DESC LIMIT 1",
                    (target_sid,),
                ).fetchone()
                if t_row and t_row["timestamp"]:
                    latest_turn_ts = float(t_row["timestamp"])
        except Exception:
            latest_turn_ts = 0.0
    files_map = build_session_telemetry_files_map(
        ctx,
        session_id=session_id,
        limit=3 if latest_turn_only else safe_limit,
        since_ts=latest_turn_ts if latest_turn_only else None,
    )
    try:
        if latest_turn_only:
            heal_rows = ctx.get_db("bridge").execute(
                "SELECT heal_id FROM bridge_heal_audit WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT 3",
                (latest_turn_ts,),
            ).fetchall()
        else:
            heal_rows = ctx.get_db("bridge").execute(
                "SELECT heal_id FROM bridge_heal_audit ORDER BY timestamp DESC LIMIT ?",
                (safe_limit,),
            ).fetchall()
    except Exception:
        heal_rows = []
    llm_rows = []
    if not latest_turn_only:
        try:
            llm_conn = ctx.get_db("llm")
            llm_rows = llm_conn.execute("SELECT * FROM llm_telemetry ORDER BY timestamp DESC LIMIT ?", (safe_limit,)).fetchall()
        except Exception:
            pass

    header_lines = [
        "============================================================",
        "INSETU LATEST TURN TELEMETRY DOSSIER" if latest_turn_only else "INSETU AI TELEMETRY, SESSION FLOW & YOMAMA HEALER AUDIT PAYLOAD",
        "============================================================",
        "Purpose: Inspect the session conversation flow, routine DAG step trace, per-hop LLM",
        "prompts/responses, and Yomama Patch Auto-Healer case studies.",
        "",
    ]
    text_blocks: List[str] = []
    if "00_session_overview.txt" in files_map:
        text_blocks.append(files_map["00_session_overview.txt"] + "\n\n")

    turn_keys = sorted(k for k in files_map.keys() if k.startswith("turn_"))
    if turn_msg_id:
        matched_turn_keys = [k for k in turn_keys if turn_msg_id in k]
        selected_turn_keys = matched_turn_keys or (turn_keys[-1:] if latest_turn_only else turn_keys[-2:])
    elif latest_turn_only:
        selected_turn_keys = turn_keys[-1:]
    else:
        selected_turn_keys = turn_keys[-2:]
    for tk in selected_turn_keys:
        text_blocks.append(files_map[tk] + "\n\n")

    if not latest_turn_only:
        if llm_rows:
            summary_lines = [
                "=== RECENT TAGGED LLM CALLS (llm_telemetry) ===",
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
                if rk.get("prompt_excerpt") or rk.get("response_excerpt"):
                    summary_lines.append(
                        f"  [Call Detail ({rk.get('call_id')} · {rk.get('caller_tag')})]\n"
                        f"  Prompt Excerpt:\n{(rk.get('prompt_excerpt') or '')[:2000]}\n"
                        f"  Response Excerpt:\n{(rk.get('response_excerpt') or '')[:2000]}\n"
                    )
            text_blocks.append(_scrub_secrets("\n".join(summary_lines) + "\n\n", secrets_set))

        if "99_bridge_heal_case_studies.txt" in files_map:
            text_blocks.append(files_map["99_bridge_heal_case_studies.txt"] + "\n")
        else:
            text_blocks.append("=== YOMAMA PATCH AUTO-HEAL CASE STUDIES ===\nNo AI patch heal events recorded yet.\n")
    elif "99_bridge_heal_case_studies.txt" in files_map:
        text_blocks.append(files_map["99_bridge_heal_case_studies.txt"] + "\n")

    base_uri = "ctx://contexts/ai_latest_turn_telemetry.txt" if latest_turn_only else "ctx://contexts/ai_telemetry_context.txt"
    compiled_entry = ctx.compile_context(
        base_uri=base_uri,
        header_block="\n".join(header_lines),
        text_blocks=text_blocks,
        files=[base_uri],
        meta={
            "type": "telemetry",
            "domain": "Diagnostics",
            "category": "Diagnostics",
            "title": "Latest Turn Telemetry Dossier" if latest_turn_only else "AI Telemetry & Session Flow Audit",
            "desc": f"{len(selected_turn_keys)} turn dossier(s)" if latest_turn_only else f"{len(turn_keys)} turn dossier(s), {len(heal_rows)} heal case(s), {len(llm_rows)} LLM call(s).",
            "timestamp": time.time(),
        },
    )
    ctx.save_manifest({base_uri: compiled_entry}, is_full_compile=False)
    return {
        "status": "success",
        "context_uri": base_uri,
        "latest_turn_only": latest_turn_only,
        "turn_dossiers": len(selected_turn_keys) if latest_turn_only else len(turn_keys),
        "heal_cases": len(heal_rows),
        "llm_calls": len(llm_rows),
        "chunks": compiled_entry.get("chunks", [base_uri]),
    }
