"""Multi-source model and token pricing catalog harvester and cognitive tier classifier extracted from engine_llm.py (God-Objects Wave 3.5)."""

import json
import time
from pathlib import Path
from typing import Any, Dict

from insetu.core.sdk import atomic_write_text
from insetu.core.system.security_io import fetch_url
from insetu.core.utils_core import get_domain_cache_path, save_json_config

PUBLIC_CATALOG_SOURCES = {
    "openrouter": "https://openrouter.ai/api/v1/models",
    "models_dev": "https://models.dev/api.json",
    "litellm": "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json",
}

DRIVER_TIER_DEFAULTS: Dict[str, Dict[str, str]] = {
    "anthropic": {
        "decision": "claude-3-5-haiku-latest",
        "fast": "claude-3-5-haiku-latest",
        "standard": "claude-3-5-sonnet-latest",
        "thinking": "claude-3-7-sonnet-latest",
        "frontier": "claude-3-7-sonnet-latest",
    },
    "gemini": {
        "decision": "gemini-3.1-flash-lite",
        "fast": "gemini-3.1-flash-lite",
        "standard": "gemini-2.5-flash",
        "thinking": "gemini-2.5-pro",
        "frontier": "gemini-2.5-pro",
    },
    "openrouter": {
        "decision": "typesafe/jev-binary-v1",
        "fast": "google/gemini-2.5-flash-lite",
        "standard": "anthropic/claude-3.5-sonnet",
        "thinking": "anthropic/claude-3.7-sonnet",
        "frontier": "anthropic/claude-3.7-sonnet:thinking",
    },
    "decisions": {
        "decision": "typesafe/jev-binary-v1",
        "fast": "typesafe/jev-binary-v1",
        "standard": "nace-ai/drex-1",
        "thinking": "nace-ai/drex-1",
        "frontier": "nace-ai/drex-1",
    },
    "claude_cli": {
        "decision": "claude-3-5-haiku-latest",
        "fast": "claude-3-5-haiku-latest",
        "standard": "claude-3-5-sonnet-latest",
        "thinking": "claude-3-7-sonnet-latest",
        "frontier": "claude-3-7-sonnet-latest",
    },
    "openai_compatible": {
        "decision": "",
        "fast": "",
        "standard": "",
        "thinking": "",
        "frontier": "",
    },
    "web_chat": {
        "decision": "web-chat-fast",
        "fast": "web-chat-fast",
        "standard": "web-chat-standard",
        "thinking": "web-chat-thinking",
        "frontier": "web-chat-frontier",
    },
}


def infer_model_cognitive_tier(model_id: str, input_cost_per_1m: float = 0.0, category: str = "generative") -> str:
    """Heuristically classifies a catalog model ID into a semantic cognitive tier (decision, fast, standard, thinking, frontier)."""
    if category == "decision":
        return "decision"
    mid = str(model_id or "").lower()
    if any(tok in mid for tok in ("jev", "drex", "liquid/d1", "Guard", "moderation")):
        return "decision"
    if any(tok in mid for tok in ("haiku", "flash-lite", "mini", "nano", "8b", "7b", "3b", "1b", "small", "instant")):
        return "fast"
    if any(tok in mid for tok in ("opus", "gpt-4.5", "o1-pro", "o3-pro", "ultra", "frontier", "405b")):
        return "frontier"
    if any(tok in mid for tok in ("thinking", "3-7-sonnet", "3.7-sonnet", "2.5-pro", "r1", "qwq", "o1", "o3", "reasoner", "70b", "72b")):
        return "thinking"
    if input_cost_per_1m > 0:
        if input_cost_per_1m <= 0.4:
            return "fast"
        if input_cost_per_1m >= 10.0:
            return "frontier"
    return "standard"


def _model_provider_prefix(model_id: str, default: str) -> str:
    """Returns the provider prefix of a catalog model id ('anthropic/claude-x' -> 'anthropic'), or default when unprefixed."""
    provider, sep, _ = str(model_id or "").partition("/")
    return provider if sep and provider else default


def harvest_external_model_catalog(ctx, endpoints=None) -> Dict[str, Any]:
    """
    Harvests and normalizes model availability, context limits, and per-1M token pricing from:
    1. OpenRouter Public API (https://openrouter.ai/api/v1/models)
    2. Models.dev Open Database (https://models.dev/api.json)
    3. Local registered Ollama / OpenAI-compatible endpoints (/api/tags or /v1/models)
    Caches the normalized catalog in .insetu/cache/llm/model_catalog.json.
    """
    catalog_by_id: Dict[str, Dict[str, Any]] = {}

    # 1. Harvest OpenRouter Public Model Feed (Zero auth required)
    try:
        resp = fetch_url(
            PUBLIC_CATALOG_SOURCES["openrouter"],
            headers={"Accept": "application/json", "User-Agent": "inSetu-Developer-OS/2.0"},
            timeout=10.0,
        )
        or_data = resp.json()
        for item in (or_data.get("data") or []):
            if not isinstance(item, dict) or not item.get("id"):
                continue
            mid = str(item["id"])
            pricing = item.get("pricing") or {}
            prompt_per_tok = float(pricing.get("prompt") or 0.0)
            comp_per_tok = float(pricing.get("completion") or 0.0)
            lower_id = mid.lower()
            is_dec = lower_id.startswith(("typesafe/jev", "nace-ai/drex", "liquid/d1"))
            in_cost_1m = round(prompt_per_tok * 1_000_000, 4)
            cat_str = "decision" if is_dec else "generative"
            catalog_by_id[mid] = {
                "id": mid,
                "name": item.get("name") or mid,
                "provider": _model_provider_prefix(mid, "openrouter"),
                "context_length": int(item.get("context_length") or 0),
                "input_cost_per_1m": in_cost_1m,
                "output_cost_per_1m": round(comp_per_tok * 1_000_000, 4),
                "category": cat_str,
                "recommended_tier": infer_model_cognitive_tier(mid, in_cost_1m, cat_str),
                "source": "openrouter",
            }
    except Exception:
        pass
    # 1b. Harvest Models.dev Open Catalog (Covers direct Anthropic, Gemini, OpenAI, and TypeSafe Jev models)
    try:
        resp = fetch_url(
            PUBLIC_CATALOG_SOURCES["models_dev"],
            headers={"Accept": "application/json", "User-Agent": "inSetu-Developer-OS/2.0"},
            timeout=8.0,
        )
        mdev_data = resp.json()
        if isinstance(mdev_data, dict):
            for prov_key, prov_obj in mdev_data.items():
                if not isinstance(prov_obj, dict):
                    continue
                models_dict = prov_obj.get("models") if isinstance(prov_obj.get("models"), dict) else {}
                for m_key, m_info in models_dict.items():
                    if not isinstance(m_info, dict):
                        continue
                    full_id = f"{prov_key}/{m_key}" if "/" not in m_key else m_key
                    if full_id in catalog_by_id:
                        continue
                    cost_obj = m_info.get("cost") or {}
                    in_cost = float(cost_obj.get("input") or 0.0)
                    out_cost = float(cost_obj.get("output") or 0.0)
                    limit_obj = m_info.get("limit") or {}
                    ctx_len = int(limit_obj.get("context") or 0)
                    lower_id = full_id.lower()
                    is_dec = lower_id.startswith(("typesafe/jev", "nace-ai/drex", "liquid/d1"))
                    in_cost_round = round(in_cost, 4)
                    cat_str = "decision" if is_dec else "generative"
                    catalog_by_id[full_id] = {
                        "id": full_id,
                        "name": m_info.get("name") or full_id,
                        "provider": prov_key,
                        "context_length": ctx_len,
                        "input_cost_per_1m": in_cost_round,
                        "output_cost_per_1m": round(out_cost, 4),
                        "category": cat_str,
                        "recommended_tier": infer_model_cognitive_tier(full_id, in_cost_round, cat_str),
                        "source": "models.dev",
                    }
    except Exception:
        pass

    # 1c. Harvest LiteLLM Pricing & Context Map Fallback
    try:
        resp = fetch_url(
            PUBLIC_CATALOG_SOURCES["litellm"],
            headers={"Accept": "application/json", "User-Agent": "inSetu-Developer-OS/2.0"},
            timeout=8.0,
        )
        lite_data = resp.json()
        if isinstance(lite_data, dict):
            for m_key, m_info in lite_data.items():
                if m_key == "sample_spec" or not isinstance(m_info, dict) or m_key in catalog_by_id:
                    continue
                in_tok = float(m_info.get("input_cost_per_token") or 0.0)
                out_tok = float(m_info.get("output_cost_per_token") or 0.0)
                prov_name = str(m_info.get("litellm_provider") or _model_provider_prefix(m_key, "cloud"))
                in_cost_1m = round(in_tok * 1_000_000, 4)
                catalog_by_id[m_key] = {
                    "id": m_key,
                    "name": m_key,
                    "provider": prov_name,
                    "context_length": int(m_info.get("max_input_tokens") or m_info.get("max_tokens") or 0),
                    "input_cost_per_1m": in_cost_1m,
                    "output_cost_per_1m": round(out_tok * 1_000_000, 4),
                    "category": "generative",
                    "recommended_tier": infer_model_cognitive_tier(m_key, in_cost_1m, "generative"),
                    "source": "litellm",
                }
    except Exception:
        pass

    # 2. Probe Local Registered Ollama / OpenAI-Compatible Endpoints
    if endpoints is None:
        from .engine_llm import get_compute_pool_and_profiles as _get_pool
        endpoints = (_get_pool(ctx) or {}).get("endpoints") or []
    for ep in (endpoints or []):
        if not isinstance(ep, dict) or ep.get("driver") != "openai_compatible":
            continue
        base_url = str(ep.get("base_url") or "").strip().rstrip("/")
        if not base_url or "openrouter.ai" in base_url or "api.openai.com" in base_url:
            continue
        try:
            models_url = f"{base_url}/models" if base_url.endswith("/v1") else f"{base_url}/v1/models"
            resp = fetch_url(
                models_url,
                headers={"Accept": "application/json"},
                timeout=2.5,
                allow_private=True,
            )
            m_data = resp.json()
            discovered = []
            for m_item in (m_data.get("data") or []):
                m_id = m_item.get("id") if isinstance(m_item, dict) else str(m_item)
                if m_id:
                    discovered.append(m_id)
                    full_key = f"{ep['id']}::{m_id}"
                    catalog_by_id[full_key] = {
                        "id": m_id,
                        "name": f"{m_id} ({ep.get('label') or ep['id']})",
                        "provider": ep["id"],
                        "context_length": 0,
                        "input_cost_per_1m": 0.0,
                        "output_cost_per_1m": 0.0,
                        "category": "local",
                        "recommended_tier": infer_model_cognitive_tier(m_id, 0.0, "local"),
                        "source": ep["id"],
                    }
        except Exception:
            continue

    cache_dir = Path(get_domain_cache_path(ctx.workspace_id, "llm"))
    cache_file = cache_dir / "model_catalog.json"
    result_payload = {
        "updated_at": time.time(),
        "count": len(catalog_by_id),
        "driver_tier_defaults": DRIVER_TIER_DEFAULTS,
        "models": sorted(catalog_by_id.values(), key=lambda x: (x.get("provider", ""), x.get("id", ""))),
    }
    save_json_config(cache_file.as_posix(), result_payload, workspace_id=ctx.workspace_id)
    return result_payload


def export_public_llm_catalog_file(out_path: str, workspace_id: str = "default") -> Dict[str, Any]:
    """
    Headless static exporter for CI / GitHub Actions / Cloudflare Pages:
    Harvests the live multi-provider model & token pricing catalog and writes it as a standalone JSON file.
    """
    from .engine_llm import llm_bp as _llm_bp
    ctx = _llm_bp.get_context(workspace_id)
    data = harvest_external_model_catalog(ctx)
    dest = Path(out_path).expanduser().resolve()
    dest.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(dest.as_posix(), json.dumps(data, indent=2))
    return {"status": "success", "path": dest.as_posix(), "count": data.get("count", 0)}
