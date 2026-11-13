"""
insetu.core.llm.llm_telemetry
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
LLM call telemetry schema, secret-scrubbed call logging, and per-session / per-tier
token and USD cost aggregation joined with model_catalog.json (God-Objects Wave 3.5).
"""

from pathlib import Path
import time
from typing import Any, Dict, Optional, Tuple
import uuid

from insetu.core.utils_core import get_domain_cache_path, load_json_config

LLM_TELEMETRY_TABLE_SCHEMA: Dict[str, str] = {
    "call_id": "TEXT PRIMARY KEY",
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

_CATALOG_RATES_CACHE: Dict[str, Tuple[float, Dict[str, Tuple[float, float]]]] = {}


def get_cached_catalog_rates(workspace_id: str) -> Dict[str, Tuple[float, float]]:
    """Reads and caches (input_cost_per_1m, output_cost_per_1m) rates by model ID from model_catalog.json."""
    try:
        cat_file = Path(get_domain_cache_path(workspace_id, "llm")) / "model_catalog.json"
        if not cat_file.exists():
            return {}
        mtime = cat_file.stat().st_mtime
        cached = _CATALOG_RATES_CACHE.get(workspace_id)
        if cached and cached[0] == mtime:
            return cached[1]
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
        _CATALOG_RATES_CACHE[workspace_id] = (mtime, rates)
        return rates
    except Exception:
        return {}


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
) -> None:
    """Scrubs outbound secrets and inserts a bounded row into llm_telemetry."""
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
        ctx.db.insert_or_replace("llm_telemetry", {
            "call_id": f"llm_{uuid.uuid4().hex[:12]}",
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
        ctx.db.execute(
            "DELETE FROM llm_telemetry WHERE call_id NOT IN (SELECT call_id FROM llm_telemetry ORDER BY timestamp DESC LIMIT 500)"
        )
        ctx.db.commit()
    except Exception:
        pass


def compute_session_tier_telemetry(ctx, since_ts: Optional[float] = None) -> Dict[str, Any]:
    """Aggregates per-tier token usage and estimated USD cost from llm_telemetry joined with model_catalog.json."""
    tiers_summary: Dict[str, Dict[str, Any]] = {
        t: {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0, "cost_usd": 0.0}
        for t in ("decision", "fast", "standard", "thinking", "frontier")
    }
    if since_ts is not None and since_ts <= 0:
        return {"by_tier": tiers_summary, "total_cost_usd": 0.0}
    total_cost = 0.0
    catalog_rates = get_cached_catalog_rates(ctx.workspace_id)
    default_tier_rates = {
        "decision": (0.10, 0.40),
        "fast": (0.15, 0.60),
        "standard": (3.00, 15.00),
        "thinking": (3.00, 15.00),
        "frontier": (15.00, 75.00),
    }
    try:
        llm_conn = ctx.get_db("llm")
        if since_ts is not None:
            rows = llm_conn.execute(
                "SELECT tier, model, prompt_chars, system_chars, response_chars FROM llm_telemetry WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT 200",
                (float(since_ts),),
            ).fetchall()
        else:
            rows = llm_conn.execute(
                "SELECT tier, model, prompt_chars, system_chars, response_chars FROM llm_telemetry ORDER BY timestamp DESC LIMIT 200"
            ).fetchall()
        for r in rows:
            t_name = str(r["tier"] or "standard").lower()
            if t_name not in tiers_summary:
                t_name = "standard"
            p_tok = max(1, (int(r["prompt_chars"] or 0) + int(r["system_chars"] or 0)) // 4)
            c_tok = max(1, int(r["response_chars"] or 0) // 4)
            in_rate, out_rate = catalog_rates.get(str(r["model"] or "")) or default_tier_rates.get(t_name, (1.0, 5.0))
            call_cost = (p_tok / 1_000_000.0) * in_rate + (c_tok / 1_000_000.0) * out_rate
            entry = tiers_summary[t_name]
            entry["calls"] += 1
            entry["prompt_tokens"] += p_tok
            entry["completion_tokens"] += c_tok
            entry["cost_usd"] = round(entry["cost_usd"] + call_cost, 6)
            total_cost += call_cost
    except Exception:
        pass
    return {"by_tier": tiers_summary, "total_cost_usd": round(total_cost, 6)}
