"""
insetu.core.llm.llm_telemetry
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
LLM call telemetry schema, secret-scrubbed call logging, and per-session / per-tier
token and USD cost aggregation joined with model_catalog.json (God-Objects Wave 3.5).
"""

from contextlib import contextmanager
import logging
from pathlib import Path
import time
from typing import Any, Dict, Optional, Tuple
import uuid

from insetu.core.sdk import execution_frame, get_connection, get_current_baggage
from insetu.core.utils_core import BoundedCache, get_domain_cache_path, load_json_config


@contextmanager
def telemetry_session_scope(session_id: Optional[str], workspace_id: Optional[str] = None, turn_msg_id: Optional[str] = None):
    """Binds session_id and turn_msg_id into the active ExecutionFrame baggage (inherited across threads and workers)."""
    clean_sid = str(session_id or "").strip()
    clean_tmid = str(turn_msg_id or "").strip()
    wid = str(workspace_id or "default")
    if not clean_sid:
        yield
        return
    if not clean_tmid and not get_current_baggage().get("turn_msg_id"):
        try:
            ag_conn = get_connection("agent", wid)
            u_row = ag_conn.execute(
                "SELECT message_id FROM chat_messages WHERE session_id=? AND role='user' ORDER BY seq DESC, timestamp DESC LIMIT 1",
                (clean_sid,),
            ).fetchone()
            if u_row and u_row["message_id"]:
                clean_tmid = str(u_row["message_id"])
        except Exception:
            clean_tmid = ""
    with execution_frame(workspace_id=wid, baggage={"session_id": clean_sid, "turn_msg_id": clean_tmid}):
        yield


def get_active_telemetry_session_id(workspace_id: Optional[str] = None) -> str:
    """Returns the session_id bound in the active ExecutionFrame baggage."""
    return str(get_current_baggage().get("session_id") or "")


def get_active_telemetry_turn_msg_id(workspace_id: Optional[str] = None) -> str:
    """Returns the turn_msg_id bound in the active ExecutionFrame baggage."""
    return str(get_current_baggage().get("turn_msg_id") or "")

DEFAULT_STEP_BUDGET = 25
DEFAULT_TOKEN_BUDGET = 120000
DEFAULT_SESSION_BUDGET_USD = 1.00
DEFAULT_SESSION_BUDGET_STEP_USD = 1.00
PER_CALL_CONTEXT_RATIO_LIMIT = 0.75

LLM_TELEMETRY_TABLE_SCHEMA: Dict[str, str] = {
    "call_id": "TEXT PRIMARY KEY",
    "session_id": "TEXT DEFAULT ''",
    "turn_msg_id": "TEXT DEFAULT ''",
    "timestamp": "REAL",
    "caller_tag": "TEXT",
    "tier": "TEXT",
    "endpoint_id": "TEXT",
    "provider": "TEXT",
    "model": "TEXT",
    "output_schema": "TEXT",
    "prompt_chars": "INTEGER DEFAULT 0",
    "system_chars": "INTEGER DEFAULT 0",
    "response_chars": "INTEGER DEFAULT 0",
    "attempts": "INTEGER DEFAULT 1",
    "latency_ms": "INTEGER DEFAULT 0",
    "status": "TEXT",
    "error_message": "TEXT",
    "prompt_excerpt": "TEXT",
    "response_excerpt": "TEXT",
}

_CATALOG_RATES_CACHE = BoundedCache("llm_catalog_rates", max_entries=32)
_CATALOG_CTX_LEN_CACHE = BoundedCache("llm_catalog_ctx_len", max_entries=32)

DEFAULT_TIER_RATES_PER_1M: Dict[str, Tuple[float, float]] = {
    "decision": (0.10, 0.40),
    "fast": (0.15, 0.60),
    "standard": (3.00, 15.00),
    "thinking": (3.00, 15.00),
    "frontier": (15.00, 75.00),
}
DEFAULT_MODEL_CONTEXT_LENGTH = 200000


def get_cached_catalog_rates(workspace_id: str) -> Dict[str, Tuple[float, float]]:
    """Reads and caches (input_cost_per_1m, output_cost_per_1m) rates by model ID from model_catalog.json."""
    try:
        cat_file = Path(get_domain_cache_path(workspace_id, "llm")) / "model_catalog.json"
        if not cat_file.exists():
            return {}
        mtime = cat_file.stat().st_mtime
        cached = _CATALOG_RATES_CACHE.get(workspace_id, revision=mtime)
        if cached is not None:
            return cached
        rates: Dict[str, Tuple[float, float]] = {}
        cat_data = load_json_config(cat_file.as_posix(), {})
        for m in (cat_data.get("models") or []):
            if isinstance(m, dict) and m.get("id"):
                in_c = float(m.get("input_cost_per_1m") or 0.0)
                out_c = float(m.get("output_cost_per_1m") or 0.0)
                mid = str(m["id"])
                rates[mid] = (in_c, out_c)
                if "/" in mid:
                    rates[mid.split("/", 1)[1]] = (in_c, out_c)
        return _CATALOG_RATES_CACHE.put(workspace_id, rates, revision=mtime)
    except Exception:
        return {}


def get_model_context_length(workspace_id: str, model_id: str = "") -> int:
    """Returns the context_length in tokens for model_id from model_catalog.json, defaulting to 200,000."""
    clean_model = str(model_id or "").strip()
    if "::" in clean_model:
        clean_model = clean_model.split("::", 1)[1].strip()
    try:
        cat_file = Path(get_domain_cache_path(workspace_id, "llm")) / "model_catalog.json"
        if cat_file.exists():
            mtime = cat_file.stat().st_mtime
            ctx_map = _CATALOG_CTX_LEN_CACHE.get(workspace_id, revision=mtime)
            if ctx_map is None:
                ctx_map = {}
                cat_data = load_json_config(cat_file.as_posix(), {})
                for m in (cat_data.get("models") or []):
                    if isinstance(m, dict) and m.get("id") and int(m.get("context_length") or 0) > 0:
                        mid = str(m["id"])
                        c_len = int(m["context_length"])
                        ctx_map[mid] = c_len
                        if "/" in mid:
                            ctx_map[mid.split("/", 1)[1]] = c_len
                _CATALOG_CTX_LEN_CACHE.put(workspace_id, ctx_map, revision=mtime)
            if clean_model in ctx_map:
                return ctx_map[clean_model]
    except Exception:
        pass
    return DEFAULT_MODEL_CONTEXT_LENGTH


def estimate_call_cost_usd(
    workspace_id: str,
    tier: str,
    model_id: str,
    prompt_tokens: int,
    completion_tokens: int,
    is_web_chat: bool = False,
) -> float:
    """Computes the USD cost (or imputed thinking-tier cost for web_chat) for a single inference call."""
    norm_tier = str(tier or "standard").strip().lower()
    if norm_tier not in DEFAULT_TIER_RATES_PER_1M:
        norm_tier = "thinking" if is_web_chat else "standard"
    rates = get_cached_catalog_rates(workspace_id)
    if is_web_chat:
        in_rate, out_rate = DEFAULT_TIER_RATES_PER_1M.get("thinking", (3.00, 15.00))
    else:
        in_rate, out_rate = rates.get(str(model_id or "")) or DEFAULT_TIER_RATES_PER_1M.get(norm_tier, (3.00, 15.00))
    cost = (max(0, prompt_tokens) / 1_000_000.0) * in_rate + (max(0, completion_tokens) / 1_000_000.0) * out_rate
    return round(cost, 6)


def record_llm_call_telemetry(
    ctx,
    *,
    t_start: float,
    caller_tag: str,
    tier: str,
    endpoint_id: str,
    provider: str,
    model: str,
    output_schema: Any,
    prompt_joined: str,
    system_prompt: str,
    status_str: str,
    attempts_used: int,
    resp_str: str,
    err_str: str = "",
    session_id: str = "",
) -> None:
    """Scrubs outbound secrets and inserts a bounded row into llm.db's llm_telemetry table."""
    try:
        from insetu.core.gather.context_assemble import (
            collect_workspace_secrets as _collect_secrets,
            scrub_outbound_secrets as _scrub_secrets,
        )
        elapsed_ms = int(round((time.time() - t_start) * 1000))
        secrets_set = _collect_secrets(ctx)
        safe_prompt = _scrub_secrets((prompt_joined or "")[:4000], secrets_set)
        safe_resp = _scrub_secrets((resp_str or "")[:4000], secrets_set)
        safe_err = _scrub_secrets((err_str or "")[:1000], secrets_set)
        effective_sid = str(session_id or get_active_telemetry_session_id(ctx.workspace_id) or "").strip()
        effective_tmid = get_active_telemetry_turn_msg_id(ctx.workspace_id)
        llm_conn = ctx.get_db("llm")
        llm_conn.insert_or_replace("llm_telemetry", {
            "call_id": f"llm_{uuid.uuid4().hex[:12]}",
            "session_id": effective_sid,
            "turn_msg_id": effective_tmid,
            "timestamp": time.time(),
            "caller_tag": caller_tag,
            "tier": tier,
            "endpoint_id": endpoint_id,
            "provider": provider,
            "model": model,
            "output_schema": str(output_schema or ""),
            "prompt_chars": len(prompt_joined or ""),
            "system_chars": len(system_prompt or ""),
            "response_chars": len(resp_str or ""),
            "attempts": attempts_used,
            "latency_ms": elapsed_ms,
            "status": status_str,
            "error_message": safe_err,
            "prompt_excerpt": safe_prompt,
            "response_excerpt": safe_resp,
        })
        llm_conn.execute(
            "DELETE FROM llm_telemetry WHERE call_id NOT IN (SELECT call_id FROM llm_telemetry ORDER BY timestamp DESC LIMIT 2000)"
        )
        llm_conn.commit()
    except Exception as exc:
        logging.getLogger(__name__).debug("Failed to record LLM telemetry for %s: %s", caller_tag, exc)


def compute_session_tier_telemetry(
    ctx,
    since_ts: Optional[float] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Aggregates per-tier token usage and estimated USD cost from llm_telemetry joined with model_catalog.json."""
    tiers_summary: Dict[str, Dict[str, Any]] = {
        t: {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0, "cost_usd": 0.0}
        for t in ("decision", "fast", "standard", "thinking", "frontier")
    }
    if not session_id and since_ts is not None and since_ts <= 0:
        return {"by_tier": tiers_summary, "total_cost_usd": 0.0}
    total_cost = 0.0
    agg_cols = (
        "SELECT tier, provider, model, COUNT(*) as call_cnt, "
        "SUM(COALESCE(prompt_chars, 0) + COALESCE(system_chars, 0)) as in_chars, "
        "SUM(COALESCE(response_chars, 0)) as out_chars FROM llm_telemetry "
    )
    try:
        llm_conn = ctx.get_db("llm")
        rows = []
        if session_id:
            rows = llm_conn.execute(
                agg_cols + "WHERE session_id = ? GROUP BY tier, provider, model",
                (str(session_id),),
            ).fetchall()
        if not rows and since_ts is not None and since_ts > 0:
            rows = llm_conn.execute(
                agg_cols + "WHERE COALESCE(session_id, '') = '' AND timestamp >= ? GROUP BY tier, provider, model",
                (float(since_ts),),
            ).fetchall()
        elif not session_id and since_ts is None:
            rows = llm_conn.execute(agg_cols + "GROUP BY tier, provider, model").fetchall()
        for r in rows:
            cnt = int(r["call_cnt"] or 0)
            if cnt <= 0:
                continue
            t_name = str(r["tier"] or "standard").lower()
            if t_name not in tiers_summary:
                t_name = "standard"
            p_tok = max(cnt, int(r["in_chars"] or 0) // 4)
            c_tok = max(cnt, int(r["out_chars"] or 0) // 4)
            is_wc = str(r.get("provider") or "") == "web_chat" if isinstance(r, dict) else (str(r["provider"] or "") == "web_chat")
            call_cost = estimate_call_cost_usd(
                ctx.workspace_id, t_name, str(r["model"] or ""), p_tok, c_tok, is_web_chat=is_wc
            )
            entry = tiers_summary[t_name]
            entry["calls"] += cnt
            entry["prompt_tokens"] += p_tok
            entry["completion_tokens"] += c_tok
            entry["cost_usd"] = round(entry["cost_usd"] + call_cost, 6)
            total_cost += call_cost
    except Exception as exc:
        logging.getLogger(__name__).debug("Failed to aggregate session tier telemetry: %s", exc)
    return {"by_tier": tiers_summary, "total_cost_usd": round(total_cost, 6)}


def resolve_session_budget_state(
    ctx,
    session_id: Optional[str],
    token_ledger: Optional[Dict[str, Any]] = None,
    *,
    since_ts: Optional[float] = None,
    ratchet: bool = False,
    force_ratchet: bool = False,
    thinking_model_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Single Source of Truth for Two-Level Session Budget State:
    - Level 1: Resolves `model_context_length` and `context_soft_ceiling` (75% of model window).
    - Level 2: Computes `by_tier` and `total_cost_usd`, resolves `budget_limit_usd` (X) and `budget_step_usd` (Y),
      and applies the `X_new = X_old + Y` watermark ratchet when `force_ratchet=True` (explicit Resume Turn click)
      or when `ratchet=True` and `total_cost >= limit_x` (Web-Chat handoff continuation past watermark).
    """
    ledger = dict(token_ledger or {})
    tier_tel = compute_session_tier_telemetry(ctx, since_ts=since_ts, session_id=session_id)
    total_cost = float(tier_tel.get("total_cost_usd") or 0.0)
    default_x = float(
        (ctx.settings.get("budget_limit_usd", DEFAULT_SESSION_BUDGET_USD) if hasattr(ctx, "settings") else DEFAULT_SESSION_BUDGET_USD)
        or DEFAULT_SESSION_BUDGET_USD
    )
    default_y = float(
        (ctx.settings.get("budget_step_usd", DEFAULT_SESSION_BUDGET_STEP_USD) if hasattr(ctx, "settings") else DEFAULT_SESSION_BUDGET_STEP_USD)
        or DEFAULT_SESSION_BUDGET_STEP_USD
    )
    limit_x = float(ledger.get("budget_limit_usd") or default_x)
    step_y = max(float(ledger.get("budget_step_usd") or default_y), 0.01)
    if force_ratchet:
        limit_x = round(max(limit_x, total_cost) + step_y, 4)
    elif ratchet and total_cost >= limit_x:
        limit_x = round(limit_x + (int((total_cost - limit_x) // step_y) + 1) * step_y, 4)
        if total_cost >= limit_x:
            limit_x = round(limit_x + step_y, 4)

    model_name = thinking_model_hint or ""
    if not model_name:
        try:
            t_res = ctx.call("llm.resolve_target", tier="thinking")
            if isinstance(t_res, dict):
                model_name = str(t_res.get("model") or "")
        except Exception:
            model_name = ""
    model_ctx_len = get_model_context_length(ctx.workspace_id, model_name)
    ledger.update({
        "by_tier": tier_tel["by_tier"],
        "total_cost_usd": total_cost,
        "budget_limit_usd": limit_x,
        "budget_step_usd": step_y,
        "model_context_length": model_ctx_len,
        "context_soft_ceiling": int(model_ctx_len * PER_CALL_CONTEXT_RATIO_LIMIT),
    })
    return ledger


def build_web_chat_budget_warning(
    workspace_id: str,
    tier: str,
    packed_est_tok: int,
    prompt_chars: int,
    model_ctx_len: int,
    ctx_75_ceiling: int,
    session_cost_usd: float,
    budget_limit_usd: float,
    budget_step_usd: float,
) -> Optional[str]:
    """Formats the inline buttonless warning for Web-Chat handoff cards when Level 1 (75% window) or Level 2 ($X spend) is reached."""
    warnings = []
    if packed_est_tok > ctx_75_ceiling:
        warnings.append(
            f"Per-call context (~{packed_est_tok:,} tok) exceeds 75% of the {model_ctx_len:,} tok window ({ctx_75_ceiling:,} tok)."
        )
    proj_cost = session_cost_usd + estimate_call_cost_usd(
        workspace_id, tier, "web-chat-thinking", packed_est_tok + (prompt_chars // 4), 1000, is_web_chat=True
    )
    if session_cost_usd >= budget_limit_usd or proj_cost >= budget_limit_usd:
        next_limit = round(budget_limit_usd + budget_step_usd, 2)
        warnings.append(
            f"Session equivalent spend (~${proj_cost:.2f}) reached the ${budget_limit_usd:.2f} checkpoint. "
            f"Submitting your Web-Chat reply will automatically advance the session budget to ${next_limit:.2f} "
            f"until an API-based LLM call occurs."
        )
    return " • ".join(warnings) if warnings else None
