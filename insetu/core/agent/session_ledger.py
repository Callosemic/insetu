"""
insetu.core.agent.session_ledger
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Dual-Track Session Transcript Ledger (`chat_messages` & `chat_sessions.compacted_view_json`):
- Monotonic sequence counter (`next_session_seq`) and deterministic 1-line turn receipts (`build_message_receipt`).
- Point-in-time working-set content hash capture (`capture_turn_context_hashes`).
- Watermarked Hot/Warm/Cold history compaction (`compact_session_history`).
- Paused and completed turn state persistence (`persist_paused_turn_state`, `finalize_completed_turn_state`).
"""

import json
import time
from typing import Any, Dict, List, Optional, Tuple
import uuid

from insetu.core.utils_core import InSetuURI, compute_vfs_sha256
from insetu.core.gather.context_assemble import record_affinity_interaction
from .envelope import reconcile_working_set_ttl


def build_message_receipt(
    role: str,
    content: str,
    transaction_id: Optional[str] = None,
    committed_files: Optional[List[str]] = None,
) -> str:
    """Synthesizes a deterministic 1-line micro-receipt for a canonical chat_messages row."""
    first_line = next((ln.strip() for ln in (content or "").splitlines() if ln.strip()), "")[:180]
    tx_part = f" [tx: {transaction_id}]" if transaction_id else ""
    files_part = f" [files: {', '.join(InSetuURI(f).basename for f in committed_files[:4])}]" if committed_files else ""
    return f"{first_line}{tx_part}{files_part}".strip()


def next_session_seq(ctx, session_id: str) -> int:
    """Returns the next message sequence number (1..N) for a chat session, never reusing one."""
    row = ctx.db.execute(
        "SELECT COALESCE(MAX(seq), COUNT(*)) as max_seq FROM chat_messages WHERE session_id=?",
        (session_id,),
    ).fetchone()
    max_seen = int((row["max_seq"] if row and row["max_seq"] is not None else 0) or 0)
    s_row = ctx.db.execute("SELECT seq_counter FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()
    counter = int((s_row["seq_counter"] if s_row and s_row["seq_counter"] is not None else 0) or 0)
    next_seq = max(max_seen, counter) + 1
    ctx.db.execute("UPDATE chat_sessions SET seq_counter=? WHERE session_id=?", (next_seq, session_id))
    return next_seq


def capture_turn_context_hashes(ctx, uris: List[str], limit: int = 64) -> Dict[str, Optional[str]]:
    """Records the content hash of each file a turn worked with, as it stood when the turn ended."""
    hashes: Dict[str, Optional[str]] = {}
    for raw in uris or []:
        if len(hashes) >= limit:
            break
        if not raw:
            continue
        try:
            uri = str(InSetuURI(raw))
        except Exception:
            continue
        if uri in hashes or not uri.startswith(("vfs://", "ctx://")):
            continue
        try:
            content = ctx.vfs.read(uri)
        except Exception:
            content = None
        hashes[uri] = compute_vfs_sha256(content) if content is not None else None
    return hashes


def compact_session_history(
    ctx,
    session_id: str,
    rows: List[Dict[str, Any]],
    existing_summary: str = "",
    compacted_view: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, str]], str, Dict[str, Any]]:
    """Watermarked Dual-Track History Compaction preserving canonical message_id and monotonic seq coordinates."""
    c_view: Dict[str, Any] = dict(compacted_view or {})
    blocks: List[Dict[str, Any]] = list(c_view.get("blocks") or [])
    watermark_seq = int(c_view.get("compacted_up_to_seq") or 0)
    if not rows:
        return [], existing_summary, {"compacted_up_to_seq": watermark_seq, "blocks": blocks}

    norm_msgs: List[Dict[str, Any]] = []
    for idx, r in enumerate(rows):
        content_clean = (r.get("content") or "").strip()
        if not content_clean:
            continue
        seq_val = int(r.get("seq") or (idx + 1))
        mid = str(r.get("message_id") or f"msg_{seq_val}")
        role = str(r.get("role") or "user")
        tx_id = str(r.get("transaction_id") or "")
        rcpt = str(r.get("receipt") or "").strip() or build_message_receipt(role, content_clean, tx_id)
        norm_msgs.append({"message_id": mid, "seq": seq_val, "role": role, "content": content_clean, "receipt": rcpt, "transaction_id": tx_id})

    total_len = len(norm_msgs)
    if total_len <= 4:
        return [{"role": m["role"], "content": m["content"]} for m in norm_msgs], existing_summary, {"compacted_up_to_seq": watermark_seq, "blocks": blocks}

    hot_slice = norm_msgs[-4:]
    warm_slice = norm_msgs[max(0, total_len - 12):-4]
    cold_slice = norm_msgs[:max(0, total_len - 12)]
    uncompacted_cold = [m for m in cold_slice if m["seq"] > watermark_seq]
    if uncompacted_cold:
        helper_mode = str(ctx.settings.get("helper_mode", "ai_assisted") or "ai_assisted").strip().lower()
        compaction_mode = "deterministic" if helper_mode == "deterministic" else "llm_compactor"
        cold_digest = "\n".join(f"[Turn #{m['seq']} · {m['message_id']} · {m['role']}]: {m['receipt']}" for m in uncompacted_cold)
        block_summary_text = cold_digest
        if compaction_mode == "llm_compactor":
            try:
                sum_res = ctx.call(
                    "llm.complete",
                    messages=[{"role": "user", "content": "Condense these conversation turn receipts into a concise architectural summary while preserving key file names, decisions, and [msg_...] reference IDs:\n\n" + cold_digest}],
                    tier="fast",
                    caller_tag=f"agent:compact_history:{session_id}",
                    wait=True,
                )
                if isinstance(sum_res, dict) and sum_res.get("text"):
                    block_summary_text = sum_res["text"].strip()
            except Exception:
                block_summary_text = cold_digest
        sum_id = f"sum_{uuid.uuid4().hex[:8]}"
        seq_start, seq_end = uncompacted_cold[0]["seq"], uncompacted_cold[-1]["seq"]
        msg_ids = [m["message_id"] for m in uncompacted_cold]
        blocks.append({"summary_id": sum_id, "seq_range": [seq_start, seq_end], "message_ids": msg_ids, "mode": compaction_mode, "summary_text": block_summary_text})
        watermark_seq = seq_end
        try:
            ph = ",".join(["?"] * len(msg_ids))
            ctx.db.execute(f"UPDATE chat_messages SET compacted_into_id=? WHERE session_id=? AND message_id IN ({ph})", (sum_id, session_id, *msg_ids))
            ctx.db.commit()
        except Exception:
            pass

    updated_summary = "\n".join(
        f"[Turns {b.get('seq_range', [0, 0])[0]}..{b.get('seq_range', [0, 0])[1]} · {', '.join((b.get('message_ids') or [])[:4])}]: {b.get('summary_text', '')}"
        for b in blocks if b.get("summary_text")
    ).strip()[-6000:] or existing_summary
    warm_receipts = [f"[Turn #{m['seq']} · {m['message_id']} ({m['role']})]: {m['receipt']}" for m in warm_slice]
    compacted_history: List[Dict[str, str]] = []
    prefix_parts = []
    if updated_summary:
        prefix_parts.append(f"<session_summary>\n{updated_summary}\n</session_summary>\n(Note: Any earlier message can be recalled in full via `<<<<<<< QUERY_CONTEXT` with `msg://<message_id>`.)")
    if warm_receipts:
        prefix_parts.append("Recent Turn Micro-Receipts (Recallable via `msg://<message_id>`):\n" + "\n".join(warm_receipts))
    if prefix_parts:
        compacted_history.append({"role": "user", "content": "\n\n".join(prefix_parts)})
        compacted_history.append({"role": "assistant", "content": "Acknowledged session summary and recallable turn receipts."})
    for hm in hot_slice:
        compacted_history.append({"role": hm["role"], "content": f"[Turn #{hm['seq']} · {hm['message_id']}]\n{hm['content']}"})
    return compacted_history, updated_summary, {"compacted_up_to_seq": watermark_seq, "blocks": blocks}


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
    now = time.time()
    global_state = (routine_result.get("chain_context") or {}).get("global") or {}
    paused_ws = reconcile_working_set_ttl(
        existing_ws_list,
        pinned_this_turn=list(global_state.get("attached_files") or attached_files or []),
        referenced_this_turn=list(global_state.get("read_only_files") or read_only_files or []),
        advance_turn_age=False,
    )
    next_wc_state = {
        "window_mode": global_state.get("web_chat_window_mode") or existing_web_chat_state.get("window_mode") or "same_window",
        "sent_hashes": global_state.get("web_chat_sent_hashes") or existing_web_chat_state.get("sent_hashes") or {},
    }
    paused_cp = json.dumps({
        "status": "paused_for_user",
        "routine_id": routine_result.get("routine_id", routine_id),
        "routine_title": routine_result.get("routine_title"),
        "pending_handoff": routine_result.get("pending_handoff"),
        "wavefronts": routine_result.get("wavefronts", []),
        "chain_context": routine_result.get("chain_context", {}),
    })
    ctx.db.execute(
        "UPDATE chat_sessions SET active_job_id=NULL, updated_at=?, working_set_json=?, summary=?, compacted_view_json=?, web_chat_state_json=?, checkpoint_json=? WHERE session_id=?",
        (now, json.dumps(paused_ws), updated_summary, json.dumps(updated_compacted_view), json.dumps(next_wc_state), paused_cp, session_id),
    )
    ctx.db.commit()
    return {
        "message": "Routine paused for Web-Chat handoff.",
        "artifact": {
            "session_id": session_id,
            "routine_id": routine_result.get("routine_id", routine_id),
            "status": "paused_for_user",
            "pending_handoff": routine_result.get("pending_handoff"),
            "wavefronts": routine_result.get("wavefronts", []),
            "execution_trace": global_state.get("execution_trace") or [],
            "file_token_map": global_state.get("file_token_map") or {},
            "chain_context": routine_result.get("chain_context", {}),
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
    full_response = routine_result.get("response") or ""
    raw_full_response = routine_result.get("raw_response") or full_response
    all_tx_ids = routine_result.get("transaction_ids") or ([routine_result["transaction_id"]] if routine_result.get("transaction_id") else [])
    tx_id = ",".join(all_tx_ids) if all_tx_ids else None
    asst_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = time.time()
    global_final = (routine_result.get("chain_context") or {}).get("global") or {}
    committed_list = list(routine_result.get("committed_files") or [])

    if full_response.strip() or raw_full_response.strip() or committed_list:
        asst_seq = next_session_seq(ctx, session_id or "default")
        asst_receipt = build_message_receipt("assistant", full_response, tx_id, committed_list)
        turn_context_uris = (
            list(global_final.get("attached_files") or attached_files or [])
            + list(global_final.get("read_only_files") or read_only_files or [])
            + committed_list
        )
        ctx.db.insert_or_replace("chat_messages", {
            "message_id": asst_msg_id, "session_id": session_id, "seq": asst_seq, "role": "assistant",
            "content": full_response, "raw_content": raw_full_response, "receipt": asst_receipt,
            "transaction_id": tx_id or "", "timestamp": now, "turn_index": asst_seq,
            "context_hashes_json": json.dumps(capture_turn_context_hashes(ctx, turn_context_uris)),
        })

    surviving_ws = reconcile_working_set_ttl(
        existing_ws_list,
        pinned_this_turn=list(global_final.get("attached_files") or attached_files or []),
        referenced_this_turn=list(global_final.get("read_only_files") or read_only_files or []),
        committed_this_turn=committed_list,
        advance_turn_age=True,
    )
    turn_tok_map = dict(global_final.get("file_token_map") or {})
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
    fetch_ctx_state = (routine_result.get("chain_context") or {}).get("fetch_context") or {}
    ctx_est_tok = int(fetch_ctx_state.get("total_tokens_estimated") or 0)
    token_ledger["prompt_tokens"] = int(token_ledger.get("prompt_tokens", 0)) + max(1, (len(user_prompt or "") // 4) + ctx_est_tok)
    token_ledger["completion_tokens"] = int(token_ledger.get("completion_tokens", 0)) + max(1, len(raw_full_response or "") // 4)
    token_ledger["saved_by_slicing"] = int(token_ledger.get("saved_by_slicing", 0)) + int(fetch_ctx_state.get("saved_by_slicing_tokens") or 0)
    if turn_tok_map:
        token_ledger["file_token_map"] = {**(token_ledger.get("file_token_map") or {}), **turn_tok_map}

    ratified_hashes = (
        global_final.get("web_chat_staged_hashes")
        or global_final.get("web_chat_sent_hashes")
        or existing_web_chat_state.get("sent_hashes")
        or {}
    )
    final_wc_state = json.dumps({
        "window_mode": global_final.get("web_chat_window_mode") or existing_web_chat_state.get("window_mode") or "same_window",
        "sent_hashes": ratified_hashes,
    })
    common_args = (now, json.dumps(surviving_ws), updated_summary, json.dumps(updated_compacted_view), final_wc_state, json.dumps(token_ledger), session_id)
    if tx_id:
        ctx.db.execute(
            "UPDATE chat_sessions SET last_transaction_id=?, active_job_id=NULL, updated_at=?, working_set_json=?, summary=?, compacted_view_json=?, web_chat_state_json=?, checkpoint_json='null', token_ledger_json=? WHERE session_id=?",
            (tx_id, *common_args),
        )
    else:
        ctx.db.execute(
            "UPDATE chat_sessions SET active_job_id=NULL, updated_at=?, working_set_json=?, summary=?, compacted_view_json=?, web_chat_state_json=?, checkpoint_json='null', token_ledger_json=? WHERE session_id=?",
            common_args,
        )
    ctx.db.commit()
    return {
        "message": "Turn complete.",
        "artifact": {
            "message_id": asst_msg_id, "response": full_response,
            "unapplied_patches": routine_result.get("unapplied_patches", ""),
            "mode": routine_result.get("mode", mode), "effective_intent": routine_result.get("effective_intent"),
            "transaction_id": routine_result.get("transaction_id"), "transaction_ids": all_tx_ids,
            "committed_files": committed_list, "execution_trace": global_final.get("execution_trace") or [],
            "file_token_map": turn_tok_map,
        },
    }
