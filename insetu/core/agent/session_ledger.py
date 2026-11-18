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
from insetu.core.gather.context_assemble import discover_constitution_files
from insetu.core.gather.rag_proximity import build_context_file_metrics
from insetu.core.llm.llm_telemetry import resolve_session_budget_state


def reconcile_working_set_ttl(
    existing_ws: List[Dict[str, Any]],
    *,
    pinned_this_turn: Optional[List[str]] = None,
    user_pinned_uris: Optional[List[str]] = None,
    referenced_this_turn: Optional[List[str]] = None,
    committed_this_turn: Optional[List[str]] = None,
    active_plan_targets: Optional[List[str]] = None,
    advance_turn_age: bool = True,
) -> List[Dict[str, Any]]:
    """
    Single Source of Truth for Session Working-Set Lifecycle (5-Turn TTL Decay & Eviction):
    - When `advance_turn_age=False` (e.g., mid-turn `paused_for_user`), records active pinned/reference files without aging.
    - When `advance_turn_age=True` (end of turn), increments `idle_turns` on non-user-pinned items,
      demotes `pinned` -> `reference` (`full` -> `slice`) at `idle_turns >= 6`, and evicts at `idle_turns >= 9`.
    """
    ws_map: Dict[str, Dict[str, Any]] = {}
    for ws_entry in (existing_ws or []):
        if not isinstance(ws_entry, dict):
            continue
        raw_fp = ws_entry.get("filepath") or ws_entry.get("uri") or ""
        if not raw_fp:
            continue
        try:
            norm_fp = str(InSetuURI(raw_fp))
        except Exception:
            continue
        ws_map[norm_fp] = {
            "filepath": norm_fp, "tier": ws_entry.get("tier") or "pinned",
            "idle_turns": int(ws_entry.get("idle_turns") or 0), "user_pinned": bool(ws_entry.get("user_pinned", False)),
        }

    if active_plan_targets:
        target_set = {str(InSetuURI(u)) for u in active_plan_targets if u}
        for fp_k, ws_entry in ws_map.items():
            if fp_k not in target_set:
                ws_entry["tier"] = "reference"
                ws_entry["user_pinned"] = False
        pinned_this_turn = list(dict.fromkeys(list(pinned_this_turn or []) + list(target_set)))

    if advance_turn_age:
        for ws_entry in ws_map.values():
            if not ws_entry.get("user_pinned"):
                ws_entry["idle_turns"] = ws_entry.get("idle_turns", 0) + 1
                if ws_entry["idle_turns"] >= 6 and ws_entry.get("tier") == "pinned":
                    ws_entry["tier"] = "reference"

    for rf in (referenced_this_turn or []):
        if not rf:
            continue
        try:
            norm_rf = str(InSetuURI(rf))
        except Exception:
            continue
        if norm_rf not in ws_map:
            ws_map[norm_rf] = {"filepath": norm_rf, "tier": "reference", "idle_turns": 0, "user_pinned": False}

    explicit_user_pins = {str(InSetuURI(u)) for u in (user_pinned_uris or []) if u}
    for af in (pinned_this_turn or []):
        if not af:
            continue
        try:
            norm_af = str(InSetuURI(af))
        except Exception:
            continue
        was_pinned = bool(
            (norm_af in explicit_user_pins)
            or ws_map.get(norm_af, {}).get("user_pinned", False)
        )
        ws_map[norm_af] = {"filepath": norm_af, "tier": "pinned", "idle_turns": 0, "user_pinned": was_pinned}

    for cf in (committed_this_turn or []):
        if not cf:
            continue
        try:
            norm_cf = str(InSetuURI(cf))
        except Exception:
            continue
        was_user_pinned = bool(ws_map.get(norm_cf, {}).get("user_pinned", False))
        ws_map[norm_cf] = {"filepath": norm_cf, "tier": "pinned", "idle_turns": 0, "user_pinned": was_user_pinned}

    return [
        ws_entry for ws_entry in ws_map.values()
        if ws_entry.get("user_pinned") or ws_entry.get("idle_turns", 0) < 9
    ]


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


def append_session_message(
    ctx,
    session_id: str,
    role: str,
    content: str,
    *,
    raw_content: Optional[str] = None,
    transaction_id: Optional[str] = None,
    committed_files: Optional[List[str]] = None,
    context_uris: Optional[List[str]] = None,
    envelope_snapshot: Optional[Dict[str, Any]] = None,
    now: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    """
    Single Source of Truth append-only writer for `chat_messages`.
    - Never overwrites an existing message (uses plain INSERT, never INSERT OR REPLACE).
    - Refuses blank messages unless committed_files is non-empty (synthesizing a concise receipt).
    - Allocates a monotonic `seq` via `next_session_seq` and captures `context_hashes_json`.
    """
    clean_sid = str(session_id or "").strip()
    if not clean_sid:
        return None
    clean_content = (content or "").strip()
    if not clean_content and committed_files:
        clean_content = f"✅ Applied changes across {len(committed_files)} file(s)."
    if not clean_content:
        return None
    raw_val = raw_content if raw_content is not None else clean_content
    ts = float(now if now is not None else time.time())
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    seq_no = next_session_seq(ctx, clean_sid)
    rcpt = build_message_receipt(role, clean_content, transaction_id, committed_files)
    ctx_hashes: Dict[str, Any] = (
        capture_turn_context_hashes(ctx, list(context_uris or committed_files or []))
        if (context_uris or committed_files)
        else {}
    )
    if isinstance(envelope_snapshot, dict) and envelope_snapshot:
        ctx_hashes["__envelope__"] = envelope_snapshot
    ctx.db.execute(
        "INSERT INTO chat_messages (message_id, session_id, seq, role, content, raw_content, receipt, transaction_id, timestamp, turn_index, context_hashes_json) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (msg_id, clean_sid, seq_no, role, clean_content, raw_val, rcpt, transaction_id or "", ts, seq_no, json.dumps(ctx_hashes)),
    )
    return {
        "message_id": msg_id, "session_id": clean_sid, "seq": seq_no, "role": role,
        "content": clean_content, "receipt": rcpt, "transaction_id": transaction_id or "", "timestamp": ts,
        "envelope_snapshot": envelope_snapshot or {},
    }


def delete_session_message_and_invalidate(ctx, message_id: str) -> Dict[str, Any]:
    """Deletes a message from `chat_messages` and invalidates any cold compaction blocks at or after that message."""
    m_row = ctx.db.execute("SELECT session_id, seq FROM chat_messages WHERE message_id=?", (message_id,)).fetchone()
    session_id = m_row["session_id"] if m_row else None
    max_row = ctx.db.execute("SELECT MAX(seq) as max_seq FROM chat_messages WHERE session_id=?", (session_id,)).fetchone() if session_id else None
    was_latest = bool(m_row and max_row and int(m_row["seq"] or 0) >= int(max_row["max_seq"] or 0))
    if was_latest:
        return rewind_session_to_message(ctx, message_id=message_id, session_id=session_id)
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


def rewind_session_to_message(ctx, message_id: Optional[str] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Rewinds a chat session's conversation state back to the exact point immediately before `message_id` was sent
    (or the latest user message in `session_id` when `message_id` is omitted):
    - Does NOT touch or revert physical files on disk (file state belongs to VFS / Bridge / Git).
    - Restores `working_set_json`, `active_plan_json`, `web_chat_state_json` (`sent_hashes`), `mode`, `routine_id`,
      and `scope` from the pre-turn snapshot recorded on `message_id` (or the last surviving message before it).
    - Deletes `message_id` and all subsequent messages in `chat_messages` and invalidates overlapping cold compaction blocks.
    - Clears any paused `checkpoint_json` or `active_job_id` on `chat_sessions`.
    """
    target = None
    if message_id:
        target = ctx.db.execute(
            "SELECT message_id, session_id, seq, role, content, context_hashes_json, timestamp FROM chat_messages WHERE message_id=?",
            (message_id,),
        ).fetchone()
    if not target and session_id:
        target = ctx.db.execute(
            "SELECT message_id, session_id, seq, role, content, context_hashes_json, timestamp FROM chat_messages WHERE session_id=? AND role='user' ORDER BY seq DESC, timestamp DESC LIMIT 1",
            (session_id,),
        ).fetchone()
    if not target:
        return {"error": f"Message '{message_id or ''}' not found."}, 404
    message_id = target["message_id"]

    session_id = target["session_id"]
    target_seq = int(target["seq"] or 0)
    target_ts = float(target["timestamp"] or 0.0)
    raw_content_str = str(target["content"] or "")
    target_snap: Dict[str, Any] = {}
    try:
        parsed_ch = json.loads(target["context_hashes_json"] or "{}")
        if isinstance(parsed_ch, dict) and isinstance(parsed_ch.get("__envelope__"), dict):
            target_snap = parsed_ch["__envelope__"]
    except Exception:
        target_snap = {}

    if target_seq > 0:
        tail_rows = ctx.db.execute(
            "SELECT message_id, seq FROM chat_messages WHERE session_id=? AND seq >= ? ORDER BY seq ASC",
            (session_id, target_seq),
        ).fetchall()
    else:
        tail_rows = ctx.db.execute(
            "SELECT message_id, seq FROM chat_messages WHERE session_id=? AND timestamp >= ? ORDER BY timestamp ASC",
            (session_id, target_ts),
        ).fetchall()

    removed_ids = [r["message_id"] for r in tail_rows if r.get("message_id")]
    if message_id not in removed_ids:
        removed_ids.append(message_id)

    if removed_ids:
        ph = ",".join(["?"] * len(removed_ids))
        ctx.db.execute(f"DELETE FROM chat_messages WHERE session_id=? AND message_id IN ({ph})", (session_id, *removed_ids))

    s_row = ctx.db.execute(
        "SELECT compacted_view_json, summary, working_set_json, active_plan_json, web_chat_state_json FROM chat_sessions WHERE session_id=?",
        (session_id,),
    ).fetchone()
    new_summary = (s_row.get("summary") if s_row else "") or ""
    c_view: Dict[str, Any] = {"compacted_up_to_seq": 0, "blocks": []}
    if s_row and s_row.get("compacted_view_json"):
        try:
            loaded_cv = json.loads(s_row["compacted_view_json"] or "{}")
            if isinstance(loaded_cv, dict):
                c_view = loaded_cv
        except Exception:
            pass

    removed_set = set(removed_ids)
    blocks = list(c_view.get("blocks") or [])
    hit_indexes = [
        i for i, b in enumerate(blocks)
        if any(mid in removed_set for mid in (b.get("message_ids") or []))
        or (target_seq > 0 and int((b.get("seq_range") or [0, 0])[1]) >= target_seq)
    ]
    if hit_indexes:
        first_hit = hit_indexes[0]
        kept_blocks = blocks[:first_hit]
        released_ids = [
            mid for b in blocks[first_hit:] for mid in (b.get("message_ids") or []) if mid not in removed_set
        ]
        new_watermark = max((int((b.get("seq_range") or [0, 0])[1]) for b in kept_blocks), default=0)
        new_summary = "\n".join(b.get("summary_text", "") for b in kept_blocks if b.get("summary_text")).strip()
        c_view["blocks"] = kept_blocks
        c_view["compacted_up_to_seq"] = new_watermark
        if released_ids:
            ph_rel = ",".join(["?"] * len(released_ids))
            ctx.db.execute(
                f"UPDATE chat_messages SET compacted_into_id='' WHERE session_id=? AND message_id IN ({ph_rel})",
                (session_id, *released_ids),
            )

    # Reconstruct pre-turn conversation envelope state from target_snap or the latest surviving message
    prior_row = ctx.db.execute(
        "SELECT context_hashes_json, transaction_id FROM chat_messages WHERE session_id=? ORDER BY seq DESC LIMIT 1",
        (session_id,),
    ).fetchone()
    prior_snap: Dict[str, Any] = {}
    if prior_row and prior_row.get("context_hashes_json"):
        try:
            p_ch = json.loads(prior_row["context_hashes_json"] or "{}")
            if isinstance(p_ch, dict) and isinstance(p_ch.get("__envelope__"), dict):
                prior_snap = p_ch["__envelope__"]
        except Exception:
            prior_snap = {}

    restored_ws = (
        target_snap.get("working_set")
        if isinstance(target_snap.get("working_set"), list)
        else (
            prior_snap.get("working_set")
            if isinstance(prior_snap.get("working_set"), list)
            else []
        )
    )
    restored_plan = (
        target_snap.get("active_plan")
        if "active_plan" in target_snap
        else prior_snap.get("active_plan")
    )
    restored_wc_hashes = (
        target_snap.get("sent_hashes")
        if isinstance(target_snap.get("sent_hashes"), dict)
        else (
            prior_snap.get("sent_hashes")
            if isinstance(prior_snap.get("sent_hashes"), dict)
            else {}
        )
    )
    existing_wc_mode = "same_window"
    if s_row and s_row.get("web_chat_state_json"):
        try:
            existing_wc_mode = json.loads(s_row["web_chat_state_json"] or "{}").get("window_mode") or "same_window"
        except Exception:
            pass
    restored_wc_state = {"window_mode": existing_wc_mode, "sent_hashes": restored_wc_hashes}

    surviving_tx_row = ctx.db.execute(
        "SELECT transaction_id FROM chat_messages WHERE session_id=? AND COALESCE(transaction_id, '') != '' ORDER BY seq DESC LIMIT 1",
        (session_id,),
    ).fetchone()
    last_surviving_tx = surviving_tx_row["transaction_id"] if surviving_tx_row else None
    plan_json_out = json.dumps(restored_plan) if (isinstance(restored_plan, dict) and restored_plan.get("tasks")) else "{}"

    ctx.db.execute(
        "UPDATE chat_sessions SET active_job_id=NULL, checkpoint_json='null', last_transaction_id=?, summary=?, compacted_view_json=?, working_set_json=?, active_plan_json=?, web_chat_state_json=?, updated_at=? WHERE session_id=?",
        (
            last_surviving_tx,
            new_summary,
            json.dumps(c_view),
            json.dumps(restored_ws),
            plan_json_out,
            json.dumps(restored_wc_state),
            time.time(),
            session_id,
        ),
    )
    ctx.db.commit()

    restored_mode = str(target_snap.get("mode") or "auto")
    restored_routine_id = str(target_snap.get("routine_id") or "workspace_turn")
    restored_scope = str(target_snap.get("scope") or "")
    clean_prompt_text = str(target_snap.get("prompt_clean") or raw_content_str)

    return {
        "status": "success",
        "session_id": session_id,
        "rewound_to_message_id": message_id,
        "prompt_text": clean_prompt_text,
        "mode": restored_mode,
        "routine_id": restored_routine_id,
        "scope": restored_scope,
        "working_set": restored_ws,
        "active_plan": restored_plan if (isinstance(restored_plan, dict) and restored_plan.get("tasks")) else None,
        "removed_count": len(removed_ids),
    }


def load_session_messages_state(ctx, session_id: str) -> Dict[str, Any]:
    """Hydrates canonical messages, compaction tiers, working set, token metrics, and budget ledger for a session."""
    cursor = ctx.db.execute(
        "SELECT message_id, session_id, seq, role, content, receipt, transaction_id, compacted_into_id, timestamp, turn_index, context_hashes_json "
        "FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC",
        (session_id,),
    )
    messages = []
    for r in cursor.fetchall():
        m_dict = dict(r)
        raw_ch = m_dict.pop("context_hashes_json", None)
        if raw_ch:
            try:
                parsed_ch = json.loads(raw_ch)
                if isinstance(parsed_ch, dict) and isinstance(parsed_ch.get("__envelope__"), dict):
                    env_snap = parsed_ch["__envelope__"]
                    if env_snap.get("mode"):
                        m_dict["mode"] = env_snap["mode"]
                    if env_snap.get("routine_id"):
                        m_dict["routine_id"] = env_snap["routine_id"]
                    if env_snap.get("scope"):
                        m_dict["scope"] = env_snap["scope"]
                    if env_snap.get("command_pill"):
                        m_dict["command_pill"] = env_snap["command_pill"]
            except Exception:
                pass
        messages.append(m_dict)
    total_msgs = len(messages)
    for idx_m, m in enumerate(messages):
        if not m.get("seq"):
            m["seq"] = idx_m + 1
        if not m.get("receipt"):
            m["receipt"] = build_message_receipt(m.get("role") or "user", m.get("content") or "", m.get("transaction_id"))
        m["compaction_tier"] = "hot" if idx_m >= max(0, total_msgs - 4) else ("warm" if idx_m >= max(0, total_msgs - 12) else "cold")

    s_row = ctx.db.execute("SELECT * FROM chat_sessions WHERE session_id=?", (session_id,)).fetchone()
    working_set: List[Dict[str, Any]] = []
    token_ledger: Dict[str, Any] = {"prompt_tokens": 0, "completion_tokens": 0, "saved_by_slicing": 0}
    compacted_view: Dict[str, Any] = {"compacted_up_to_seq": 0, "blocks": []}
    checkpoint = None
    active_plan = None
    plan_path, summary = "", ""

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
        checkpoint = raw_cp if (isinstance(raw_cp, dict) and (raw_cp.get("status") or raw_cp.get("pending_handoff"))) else None
        if checkpoint and isinstance(checkpoint.get("pending_handoff"), dict):
            ph = checkpoint["pending_handoff"]
            branches = ph.get("branches") if isinstance(ph.get("branches"), list) else [ph]
            for b in [ph, *branches]:
                if not isinstance(b, dict):
                    continue
                for uri_key, chunks_key in (("full_context_uri", "full_context_chunks"), ("workflow_context_uri", "full_context_chunks"), ("delta_context_uri", "delta_context_chunks")):
                    c_uri = b.get(uri_key)
                    if c_uri and isinstance(c_uri, str) and c_uri.startswith("ctx://"):
                        manifest_chunks = ctx.get_manifest_files(c_uri)
                        if manifest_chunks and not ctx.is_context_on_disk(c_uri):
                            ctx.resolve_path(c_uri, must_exist=True, allow_heal=True)
                            manifest_chunks = ctx.get_manifest_files(c_uri)
                        b[chunks_key] = manifest_chunks or [c_uri]
        raw_plan = _safe_json(s_row.get("active_plan_json"), None)
        active_plan = raw_plan if (isinstance(raw_plan, dict) and raw_plan.get("tasks")) else None
        raw_pp = str(s_row.get("active_plan_path") or "").strip()
        plan_path = raw_pp if (raw_pp and ctx.vfs.read(raw_pp) is not None) else ""
        if active_plan and active_plan.get("plan_filepath") and not plan_path and ctx.vfs.read(str(active_plan["plan_filepath"])) is None:
            active_plan["plan_filepath"] = ""
        summary = s_row.get("summary") or ""

    ws_repos = {
        InSetuURI(x.get("filepath", "")).repo
        for x in working_set
        if isinstance(x, dict) and x.get("filepath") and InSetuURI(x["filepath"]).repo
    }
    if plan_path and InSetuURI(plan_path).repo:
        ws_repos.add(InSetuURI(plan_path).repo)
    all_constitution = discover_constitution_files(ctx)
    constitution = ([f for f in all_constitution if InSetuURI(f).repo in ws_repos] if ws_repos else all_constitution) or all_constitution

    pinned_uris = [x.get("filepath") for x in working_set if isinstance(x, dict) and x.get("tier") == "pinned" and x.get("filepath")]
    ref_uris = [x.get("filepath") for x in working_set if isinstance(x, dict) and x.get("tier") == "reference" and x.get("filepath")]
    persisted_tok_map = token_ledger.get("file_token_map") if isinstance(token_ledger.get("file_token_map"), dict) else {}
    existing_tok_map = {
        **{k: int(v) for k, v in persisted_tok_map.items() if int(v or 0) > 0},
        **{x["filepath"]: int(x["tokens"]) for x in working_set if isinstance(x, dict) and x.get("filepath") and int(x.get("tokens") or 0) > 0},
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
    token_ledger = resolve_session_budget_state(ctx, session_id, token_ledger, since_ts=first_msg_ts, ratchet=False)
    return {
        "messages": messages, "compacted_view": compacted_view, "working_set": working_set,
        "file_token_map": file_token_map, "token_ledger": token_ledger, "checkpoint": checkpoint,
        "active_plan_path": plan_path, "active_plan": active_plan, "summary": summary,
        "constitution_files": constitution,
    }


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



