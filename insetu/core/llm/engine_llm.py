import os
import json
import threading
import urllib.request
import subprocess
import re
import time
from pathlib import Path
from typing import TypedDict, List, Dict, Any, Generator, Optional, Union, Tuple
from flask import Response, stream_with_context
from insetu.core.sdk import InSetuExtension, SettingsManager, slugify, atomic_write_text
from insetu.core.agent.schemas import validate_schema_response as _registry_validate_schema
from insetu.core.utils_core import (
    child_env,
    execute_binary,
    parse_blocks,
    encrypt_secret,
    decrypt_secret,
    get_tenant_control_dir,
    get_domain_cache_path,
    load_json_config,
    save_json_config,
)

_PROVIDER_SEMAPHORES: Dict[Tuple[str, int], threading.BoundedSemaphore] = {}
_SEMAPHORE_LOCK = threading.Lock()

COGNITIVE_TIERS = ("decision", "fast", "standard", "thinking", "frontier")

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
        "decision": "gemini-2.5-flash-lite",
        "fast": "gemini-2.5-flash-lite",
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


def _infer_model_cognitive_tier(model_id: str, input_cost_per_1m: float = 0.0, category: str = "generative") -> str:
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


def _get_provider_semaphore(provider: str, max_parallel: int = 4, endpoint_id: str = "") -> threading.BoundedSemaphore:
    """
    Physical Admission Control Semaphore per Compute Endpoint (or fallback provider):
    - claude_cli: hard-clamped to 1 (local pseudo-TTY binary).
    - openai_compatible: bounded to min(max_parallel, 2) to protect local GPU/VRAM queues.
    - anthropic / gemini / openrouter / decisions: bounded to max_parallel (default 4).
    """
    clean_prov = str(provider or "anthropic").strip().lower()
    req_limit = max(1, int(max_parallel or 4))
    if clean_prov == "claude_cli":
        effective_limit = 1
    elif clean_prov == "openai_compatible":
        effective_limit = min(req_limit, 2)
    else:
        effective_limit = req_limit

    sem_scope = str(endpoint_id or clean_prov).strip().lower()
    key = (sem_scope, effective_limit)
    with _SEMAPHORE_LOCK:
        sem = _PROVIDER_SEMAPHORES.get(key)
        if sem is None:
            sem = threading.BoundedSemaphore(effective_limit)
            _PROVIDER_SEMAPHORES[key] = sem
        return sem


LLM_SETTINGS_SCHEMA = [
    {
        "id": "active_profile_id",
        "label": "Active Configuration Profile",
        "type": "select",
        "scope": "workspace",
        "default": "default",
        "options_from": {
            "field": "llm_profiles",
            "value_key": "id",
            "label_key": "title"
        },
        "description": "Select the active LLM Configuration Profile for this workspace (can also be switched live from the Chat Composer)."
    },
    {
        "id": "compute_endpoints",
        "label": "1. Compute Endpoint Pool",
        "type": "repeater",
        "scope": "daemon",
        "id_key": "id",
        "slug_source": "label",
        "min_items": 1,
        "max_items": 24,
        "item_label": "Endpoint",
        "item_title_key": "label",
        "item_subtitle_key": "driver",
        "add_label": "Add Compute Endpoint",
        "description": "Register your pool of cloud API keys, OpenRouter, independent local Ollama instances, and CLI tools.",
        "default": [
            {
                "id": "anthropic_main",
                "label": "Anthropic Claude API",
                "driver": "anthropic",
                "base_url": "",
                "api_key": "",
                "custom_models": [],
                "max_parallel": 4
            }
        ],
        "item_schema": [
            {"id": "label", "label": "Endpoint Label", "type": "text", "default": "New Compute Endpoint"},
            {
                "id": "driver",
                "label": "Protocol Driver",
                "type": "select",
                "default": "openai_compatible",
                "options": [
                    {"value": "anthropic", "label": "Anthropic Claude (REST)"},
                    {"value": "gemini", "label": "Google Gemini (REST)"},
                    {"value": "openrouter", "label": "OpenRouter (REST + Decisions)"},
                    {"value": "decisions", "label": "TypeSafe / Native Decisions API (/alpha/decisions)"},
                    {"value": "openai_compatible", "label": "Local / OpenAI-Compatible (Ollama, LM Studio, vLLM)"},
                    {"value": "claude_cli", "label": "Claude CLI (Local Subscription Binary)"},
                    {"value": "web_chat", "label": "External Web Chatbot (Copy Context + Prompt Handoff)"}
                ]
            },
            {
                "id": "base_url",
                "label": "Endpoint Base URL",
                "type": "text",
                "default": "http://127.0.0.1:11434/v1",
                "placeholder": "http://127.0.0.1:11434/v1 or https://openrouter.ai/api/v1",
                "show_if": {"field": "driver", "in": ["openai_compatible", "openrouter", "decisions"]}
            },
            {
                "id": "api_key",
                "label": "API Key (Encrypted in Vault)",
                "type": "password",
                "secure": True,
                "default": "",
                "placeholder": "Leave blank for local Ollama, or enter key...",
                "show_if": {"field": "driver", "not_in": ["claude_cli", "web_chat"]}
            },
            {
                "id": "custom_models",
                "label": "Custom Model Overrides (Optional, Comma-Separated)",
                "type": "comma_list",
                "default": [],
                "placeholder": "Optional unlisted fine-tunes or custom model IDs..."
            },
            {
                "id": "max_parallel",
                "label": "Max Concurrent Requests",
                "type": "number",
                "default": 4
            }
        ]
    },
    {
        "id": "llm_profiles",
        "label": "2. Cognitive Configuration Profiles",
        "type": "repeater",
        "scope": "daemon",
        "id_key": "id",
        "slug_source": "title",
        "min_items": 1,
        "max_items": 16,
        "item_label": "Profile",
        "item_title_key": "title",
        "item_subtitle_key": "",
        "add_label": "Add Configuration Profile",
        "description": "Bind each semantic cognitive tier to an endpoint and model from your Compute Endpoint Pool.",
        "default": [
            {
                "id": "default",
                "title": "Default Configuration",
                "description": "Balanced configuration across cognitive tiers.",
                "tiers": {
                    "decision": {"endpoint": "", "model": ""},
                    "fast": {"endpoint": "anthropic_main", "model": "claude-3-5-haiku-latest"},
                    "standard": {"endpoint": "anthropic_main", "model": "claude-3-5-sonnet-latest"},
                    "thinking": {"endpoint": "anthropic_main", "model": "claude-3-5-sonnet-latest"},
                    "frontier": {"endpoint": "anthropic_main", "model": "claude-3-5-sonnet-latest"}
                }
            }
        ],
        "item_schema": [
            {"id": "title", "label": "Profile Title", "type": "text", "default": "New Profile"},
            {"id": "description", "label": "Description", "type": "text", "default": ""},
            {
                "id": "tiers",
                "label": "Cognitive Tier Bindings",
                "type": "record",
                "fields": [
                    {
                        "id": "decision",
                        "label": "Decision Tier (Jev / Fast Router)",
                        "type": "target_binding",
                        "endpoint_source": "compute_endpoints",
                        "allow_empty": True,
                        "endpoint_placeholder": "Fallback to Fast Tier",
                        "placeholder": "Optional decision model..."
                    },
                    {
                        "id": "fast",
                        "label": "Fast Tier (Context Scout & Patch Healer)",
                        "type": "target_binding",
                        "endpoint_source": "compute_endpoints",
                        "placeholder": "Select or type fast model..."
                    },
                    {
                        "id": "standard",
                        "label": "Standard Tier (Chat & Q&A)",
                        "type": "target_binding",
                        "endpoint_source": "compute_endpoints",
                        "placeholder": "Select or type standard model..."
                    },
                    {
                        "id": "thinking",
                        "label": "Thinking Tier (/code & /upkeep)",
                        "type": "target_binding",
                        "endpoint_source": "compute_endpoints",
                        "placeholder": "Select or type thinking model..."
                    },
                    {
                        "id": "frontier",
                        "label": "Frontier Tier (/plan & Deep Architecture)",
                        "type": "target_binding",
                        "endpoint_source": "compute_endpoints",
                        "placeholder": "Select or type frontier model..."
                    }
                ]
            }
        ]
    },
    {
        "id": "sync_catalog_action",
        "label": "Harvest Public & Local Model Pricing Catalog",
        "type": "action",
        "action_label": "Sync Model & Pricing Catalog Now",
        "endpoint": "llm/catalog",
        "scope": "daemon",
        "description": "Fetches live model lists and token pricing from OpenRouter, Models.dev, and your registered local Ollama instances into .insetu/cache/llm/model_catalog.json."
    },
    {
        "id": "provider",
        "label": "Legacy Fallback Provider",
        "type": "hidden",
        "scope": "workspace",
        "default": "anthropic"
    },
    {
        "id": "base_url",
        "label": "Legacy Base URL",
        "type": "hidden",
        "scope": "workspace",
        "default": "http://127.0.0.1:11434/v1"
    },
    {
        "id": "model",
        "label": "Legacy Default Model",
        "type": "hidden",
        "scope": "workspace",
        "default": "claude-3-5-sonnet-latest"
    },
    {
        "id": "tier_fast_model",
        "label": "Legacy Fast Model",
        "type": "hidden",
        "scope": "workspace",
        "default": ""
    },
    {
        "id": "tier_thinking_model",
        "label": "Legacy Thinking Model",
        "type": "hidden",
        "scope": "workspace",
        "default": ""
    },
    {
        "id": "tier_frontier_model",
        "label": "Legacy Frontier Model",
        "type": "hidden",
        "scope": "workspace",
        "default": ""
    },
    {
        "id": "max_parallel_requests",
        "label": "Legacy Max Parallel Requests",
        "type": "hidden",
        "scope": "workspace",
        "default": 4
    },
    {
        "id": "api_key",
        "label": "Legacy API Key",
        "type": "hidden",
        "secure": True,
        "scope": "workspace",
        "default": ""
    }
]
llm_bp = InSetuExtension(
    'llm',
    __name__,
    title="LLM Gateway",
    description="Universal inference orchestrator supporting multi-endpoint compute pools, cognitive profiles, decision models, and live model catalogs.",
    core=True,
    settings_schema=LLM_SETTINGS_SCHEMA
)
__depends__ = []
@llm_bp.on('llm_settings_updated')
def _vault_repeater_endpoint_secrets(workspace_id=None, updated_keys=None, **kwargs):
    """Delegates repeater secret encryption and masking to the universal schema vaulting SSOT."""
    from insetu.core.system.engine_system import vault_repeater_secrets_for_schema as _vault_repeater_secrets
    wid = workspace_id or "default"
    _vault_repeater_secrets('llm', wid)
    settings = SettingsManager('llm', wid)
    raw_eps = settings.get("compute_endpoints", [])
    if isinstance(raw_eps, list) and raw_eps:
        mutated = False
        for ep in raw_eps:
            if not isinstance(ep, dict):
                continue
            for list_key in ("custom_models", "models"):
                if isinstance(ep.get(list_key), str):
                    ep[list_key] = [m.strip() for m in ep[list_key].split(",") if m.strip()]
                    mutated = True
        if mutated:
            settings.update({"compute_endpoints": raw_eps})


class ChatMessage(TypedDict):
    role: str
    content: str
class ChatCompletionPayload(TypedDict, total=False):
    messages: List[ChatMessage]
    system: Optional[str]
    tier: Optional[str]
    profile_id: Optional[str]
    output_schema: Optional[Union[str, Dict[str, Any]]]
    decision_questions: Optional[Dict[str, str]]
    max_retries: Optional[int]


class LlmDecidePayload(TypedDict, total=False):
    context: str
    questions: Dict[str, str]
    mode: Optional[str]
    profile_id: Optional[str]


def _get_endpoint_secret_key(workspace_id: str, endpoint_id: str) -> str:
    """Reads and decrypts an endpoint-specific API key from the tenant or default secrets.json vault."""
    if not endpoint_id:
        return ""
    sec_field = f"endpoint_key__{endpoint_id}"
    for wid in (workspace_id, "default"):
        try:
            sec_path = Path(get_tenant_control_dir(wid)) / "secrets.json"
            if sec_path.exists():
                raw = load_json_config(sec_path.as_posix(), {})
                enc_val = (raw.get("llm") or {}).get(sec_field, "")
                if enc_val:
                    dec = decrypt_secret(enc_val)
                    if dec:
                        return dec
        except Exception:
            continue
    return ""


def _set_endpoint_secret_key(workspace_id: str, endpoint_id: str, plain_api_key: str) -> None:
    """Encrypts and stores an endpoint-specific API key inside the default daemon secrets.json vault."""
    if not endpoint_id:
        return
    sec_field = f"endpoint_key__{endpoint_id}"
    sec_path = Path(get_tenant_control_dir("default")) / "secrets.json"
    raw = load_json_config(sec_path.as_posix(), {})
    llm_sec = raw.setdefault("llm", {})
    if plain_api_key and plain_api_key.strip():
        llm_sec[sec_field] = encrypt_secret(plain_api_key.strip())
    else:
        llm_sec.pop(sec_field, None)
    save_json_config(sec_path.as_posix(), raw, workspace_id="default")


def _synthesize_legacy_pool_and_profile(ctx) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Synthesizes a default compute endpoint and profile from legacy single-provider settings when no pool is saved yet."""
    prov = ctx.settings.get("provider", "anthropic") or "anthropic"
    base_url = ctx.settings.get("base_url", "http://127.0.0.1:11434/v1") or "http://127.0.0.1:11434/v1"
    max_p = int(ctx.settings.get("max_parallel_requests", 4) or 4)
    std_model = ctx.settings.get("model", "claude-3-5-sonnet-latest") or "claude-3-5-sonnet-latest"
    fast_model = ctx.settings.get("tier_fast_model", "") or std_model
    think_model = ctx.settings.get("tier_thinking_model", "") or std_model
    front_model = ctx.settings.get("tier_frontier_model", "") or think_model
    has_key = bool(ctx.settings.get("api_key", ""))

    ep_id = f"default_{prov}"
    unique_models = list(dict.fromkeys([m for m in (fast_model, std_model, think_model, front_model) if m]))
    endpoints = [{
        "id": ep_id,
        "label": f"Default ({prov.replace('_', ' ').title()})",
        "driver": prov,
        "base_url": base_url,
        "max_parallel": max_p,
        "has_api_key": has_key,
        "custom_models": unique_models,
        "models": unique_models,
        "enabled": True,
        "is_legacy_bridge": True,
    }]
    profiles = [{
        "id": "default",
        "title": "Default Configuration",
        "description": "Synthesized from workspace LLM settings.",
        "tiers": {
            "decision": {"endpoint": ep_id, "model": fast_model},
            "fast": {"endpoint": ep_id, "model": fast_model},
            "standard": {"endpoint": ep_id, "model": std_model},
            "thinking": {"endpoint": ep_id, "model": think_model},
            "frontier": {"endpoint": ep_id, "model": front_model},
        },
    }]
    return endpoints, profiles


LEGACY_ROUTING_SETTING_KEYS = ("provider", "base_url", "model", "tier_fast_model", "tier_thinking_model", "tier_frontier_model")


def _has_saved_pool_configuration(ctx) -> bool:
    """True once the user has saved a compute endpoint pool or configuration profiles (not just schema defaults)."""
    return ctx.settings.is_set("compute_endpoints") or ctx.settings.is_set("llm_profiles")


def _has_explicit_legacy_routing(ctx) -> bool:
    """True when any legacy single-provider routing setting (provider, base URL, or a tier model) was saved explicitly."""
    return any(ctx.settings.is_set(key) for key in LEGACY_ROUTING_SETTING_KEYS)


def get_compute_pool_and_profiles(ctx) -> Dict[str, Any]:
    """
    Returns the normalized compute endpoint pool, configuration profiles, and active_profile_id.
    Precedence: a saved pool/profile configuration, then explicitly saved legacy single-provider
    settings (synthesized into a pool), then the schema's default pool.
    """
    raw_endpoints = ctx.settings.get("compute_endpoints", [])
    raw_profiles = ctx.settings.get("llm_profiles", [])
    legacy_eps, legacy_profs = _synthesize_legacy_pool_and_profile(ctx)
    if not _has_saved_pool_configuration(ctx) and _has_explicit_legacy_routing(ctx):
        raw_endpoints, raw_profiles = legacy_eps, legacy_profs

    endpoints = list(raw_endpoints) if isinstance(raw_endpoints, list) and len(raw_endpoints) > 0 else legacy_eps
    for ep in endpoints:
        if isinstance(ep, dict) and ep.get("id") and not ep.get("is_legacy_bridge"):
            ep["has_api_key"] = bool(_get_endpoint_secret_key(ctx.workspace_id, ep["id"]))

    profiles = list(raw_profiles) if isinstance(raw_profiles, list) and len(raw_profiles) > 0 else legacy_profs
    active_id = str(ctx.settings.get("active_profile_id") or "default").strip()
    if not any(isinstance(p, dict) and p.get("id") == active_id for p in profiles):
        active_id = profiles[0]["id"] if profiles else "default"

    return {
        "endpoints": endpoints,
        "profiles": profiles,
        "active_profile_id": active_id,
    }


def _model_provider_prefix(model_id: str, default: str) -> str:
    """Returns the provider prefix of a catalog model id ('anthropic/claude-x' -> 'anthropic'), or default when unprefixed."""
    provider, sep, _ = str(model_id or "").partition("/")
    return provider if sep and provider else default


def _normalize_tier_name(tier: Optional[str]) -> str:
    clean = str(tier or "standard").strip().lower()
    if clean in ("decision", "decide", "router", "jev"):
        return "decision"
    if clean in ("fast", "low", "lite"):
        return "fast"
    if clean in ("thinking", "high", "reasoning"):
        return "thinking"
    if clean in ("frontier", "max", "ultra"):
        return "frontier"
    return "standard"


def _resolve_tier_execution_target(ctx, tier: Optional[str] = None, profile_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Resolves a semantic cognitive tier + optional profile_id into a concrete execution target dict:
    {
        "endpoint_id": str,
        "provider": str,
        "model": str,
        "api_key": str,
        "base_url": str,
        "max_parallel": int,
        "tier": str,
        "profile_id": str,
        "is_decision_model": bool
    }
    """
    pool_state = get_compute_pool_and_profiles(ctx)
    endpoints_by_id = {ep["id"]: ep for ep in pool_state["endpoints"] if isinstance(ep, dict) and ep.get("id")}
    profiles_by_id = {p["id"]: p for p in pool_state["profiles"] if isinstance(p, dict) and p.get("id")}

    req_profile_id = str(profile_id or pool_state["active_profile_id"] or "default").strip()
    profile = profiles_by_id.get(req_profile_id) or next(iter(profiles_by_id.values()), None) or {}
    tiers_map = profile.get("tiers") if isinstance(profile.get("tiers"), dict) else {}

    norm_tier = _normalize_tier_name(tier)
    fallback_order = {
        "decision": ("decision", "fast", "standard"),
        "fast": ("fast", "standard"),
        "standard": ("standard", "fast", "thinking"),
        "thinking": ("thinking", "standard", "frontier"),
        "frontier": ("frontier", "thinking", "standard"),
    }.get(norm_tier, ("standard",))

    ep_id = ""
    model_name = ""
    for cand_t in fallback_order:
        raw_val = tiers_map.get(cand_t)
        if isinstance(raw_val, dict):
            cand_ep = str(raw_val.get("endpoint") or raw_val.get("endpoint_id") or "").strip()
            cand_mod = str(raw_val.get("model") or "").strip()
            if cand_ep or cand_mod:
                ep_id = cand_ep or next(iter(endpoints_by_id.keys()), "")
                model_name = cand_mod
                break
        elif isinstance(raw_val, str) and raw_val.strip():
            target_spec = raw_val.strip()
            if "::" in target_spec:
                ep_id, model_name = target_spec.split("::", 1)
                ep_id = ep_id.strip()
                model_name = model_name.strip()
            else:
                ep_id = next(iter(endpoints_by_id.keys()), "")
                model_name = target_spec
            break

    ep = endpoints_by_id.get(ep_id)
    if not ep:
        # Fallback to legacy settings resolution
        prov = ctx.settings.get("provider", "anthropic") or "anthropic"
        model_resolved = _resolve_tier_model(ctx, norm_tier)
        api_key = ctx.settings.get("api_key", "")
        base_url = ctx.settings.get("base_url", "http://127.0.0.1:11434/v1")
        max_p = int(ctx.settings.get("max_parallel_requests", 4) or 4)
        ep_id = f"default_{prov}"
    else:
        prov = str(ep.get("driver") or "anthropic").strip().lower()
        ep_models = ep.get("custom_models") or ep.get("models") or []
        model_resolved = model_name or (ep_models[0] if ep_models else _resolve_tier_model(ctx, norm_tier))
        if ep.get("is_legacy_bridge"):
            api_key = ctx.settings.get("api_key", "")
        else:
            api_key = _get_endpoint_secret_key(ctx.workspace_id, ep_id) or ctx.settings.get("api_key", "")
        base_url = str(ep.get("base_url") or ("https://openrouter.ai/api/v1" if prov == "openrouter" else "http://127.0.0.1:11434/v1"))
        max_p = int(ep.get("max_parallel", 4) or 4)

    lower_m = (model_resolved or "").lower()
    is_decision_model = (
        prov == "decisions"
        or lower_m.startswith(("typesafe/jev", "jev-", "nace-ai/drex", "liquid/d1"))
    )

    return {
        "endpoint_id": ep_id,
        "provider": "openai_compatible" if prov == "openrouter" and not is_decision_model else prov,
        "raw_driver": prov,
        "model": model_resolved,
        "api_key": api_key,
        "base_url": base_url,
        "max_parallel": max_p,
        "tier": norm_tier,
        "profile_id": profile.get("id") or req_profile_id,
        "is_decision_model": is_decision_model,
        "is_web_chat": (prov == "web_chat"),
    }


class LlmResolveTargetPayload(TypedDict, total=False):
    tier: Optional[str]
    profile_id: Optional[str]


@llm_bp.route('resolve_target', methods=['GET', 'POST'], request_schema=LlmResolveTargetPayload, docstring="[sync] Resolves the execution target metadata for a cognitive tier and profile without exposing plaintext API keys.")
def api_llm_resolve_target(ctx):
    data = ctx.payload or {}
    target = _resolve_tier_execution_target(ctx, tier=data.get("tier"), profile_id=data.get("profile_id"))
    return {
        "endpoint_id": target["endpoint_id"],
        "provider": target["provider"],
        "raw_driver": target["raw_driver"],
        "model": target["model"],
        "base_url": target["base_url"],
        "max_parallel": target["max_parallel"],
        "tier": target["tier"],
        "profile_id": target["profile_id"],
        "is_decision_model": target["is_decision_model"],
        "is_web_chat": target["is_web_chat"],
        "has_api_key": bool(target.get("api_key")),
    }


def _resolve_tier_model(ctx, tier: Optional[str] = None) -> str:
    """Resolves the target model identifier for a semantic cognitive tier (decision, fast/low, standard/medium, thinking/high, frontier/max)."""
    base_model = ctx.settings.get("model", "claude-3-5-sonnet-latest") or "claude-3-5-sonnet-latest"
    clean_tier = _normalize_tier_name(tier)
    if clean_tier in ("decision", "fast"):
        return ctx.settings.get("tier_fast_model", "") or base_model
    if clean_tier == "thinking":
        return ctx.settings.get("tier_thinking_model", "") or base_model
    if clean_tier == "frontier":
        return ctx.settings.get("tier_frontier_model", "") or ctx.settings.get("tier_thinking_model", "") or base_model
    return base_model


def validate_output_schema(raw_text: str, output_schema: Union[str, Dict[str, Any]]) -> Tuple[bool, Any, str]:
    """
    Universal Output Schema Bouncer:
    Delegates validation to the formal schema registry in insetu.core.agent.schemas.
    Returns (is_valid, parsed_or_normalized_value, error_message).
    """
    if not output_schema:
        return True, raw_text, ""
    return _registry_validate_schema(output_schema, raw_text or "")
def _stream_anthropic(api_key: str, model: str, messages: list, system_prompt: str) -> Generator[str, None, None]:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
        "content-type": "application/json",
        "accept": "text/event-stream"
    }

    payload = {
        "model": model,
        "max_tokens": 8192,
        "messages": messages,
        "stream": True
    }
    if system_prompt:
        payload["system"] = [
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"}
            }
        ]

    req = urllib.request.Request(url, headers=headers, data=json.dumps(payload).encode('utf-8'))
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            for line in response:
                decoded_line = line.decode('utf-8').strip()
                if decoded_line.startswith('data: '):
                    data_str = decoded_line[6:]
                    if data_str == '[DONE]':
                        break
                    try:
                        chunk = json.loads(data_str)
                        if chunk.get("type") == "content_block_delta":
                            text = chunk.get("delta", {}).get("text", "")
                            if text:
                                yield f"data: {json.dumps({'text': text})}\n\n"
                    except json.JSONDecodeError:
                        continue
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"

def _stream_gemini(api_key: str, model: str, messages: list, system_prompt: str) -> Generator[str, None, None]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    # Gemini requires mapping standard roles to 'user' and 'model'
    gemini_messages = []
    for m in messages:
        role = "model" if m["role"] == "assistant" else "user"
        gemini_messages.append({"role": role, "parts": [{"text": m["content"]}]})

    payload = {"contents": gemini_messages}
    if system_prompt:
        payload["system_instruction"] = {"parts": [{"text": system_prompt}]}

    req = urllib.request.Request(url, headers=headers, data=json.dumps(payload).encode('utf-8'))
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            for line in response:
                decoded_line = line.decode('utf-8').strip()
                if decoded_line.startswith('data: '):
                    data_str = decoded_line[6:]
                    try:
                        chunk = json.loads(data_str)
                        if "candidates" in chunk and chunk["candidates"]:
                            parts = chunk["candidates"][0].get("content", {}).get("parts", [])
                            for part in parts:
                                text = part.get("text", "")
                                if text:
                                    yield f"data: {json.dumps({'text': text})}\n\n"
                    except json.JSONDecodeError:
                        continue
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
_ANSI_ESCAPE_RE = re.compile(r'\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07')


def _stream_openai_compatible(base_url: str, api_key: str, model: str, messages: list, system_prompt: str) -> Generator[str, None, None]:
    """Streams inference from any OpenAI-compatible /v1/chat/completions endpoint (Ollama, LM Studio, vLLM, llama.cpp, OpenAI)."""
    clean_base = (base_url or "http://127.0.0.1:11434/v1").strip().rstrip("/")
    url = clean_base if clean_base.endswith("/chat/completions") else f"{clean_base}/chat/completions"

    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Authorization": f"Bearer {api_key.strip() if api_key and api_key.strip() else 'local'}",
    }

    oai_messages = []
    if system_prompt:
        oai_messages.append({"role": "system", "content": system_prompt})
    for m in messages:
        oai_messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})

    payload = {
        "model": model,
        "messages": oai_messages,
        "stream": True,
    }

    req = urllib.request.Request(url, headers=headers, data=json.dumps(payload).encode("utf-8"))
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            for raw_line in response:
                decoded_line = raw_line.decode("utf-8", errors="replace").strip()
                if not decoded_line or not decoded_line.startswith("data:"):
                    continue
                data_str = decoded_line[5:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                    choices = chunk.get("choices") or []
                    if choices:
                        delta = choices[0].get("delta") or {}
                        text = delta.get("content") or ""
                        if text:
                            yield f"data: {json.dumps({'text': text})}\n\n"
                except json.JSONDecodeError:
                    continue
    except Exception as e:
        yield f"data: {json.dumps({'error': f'OpenAI-compatible endpoint error ({url}): {str(e)}'})}\n\n"


def _stream_claude_cli(model: str, messages: list, system_prompt: str) -> Generator[str, None, None]:
    """
    Hardened subprocess adapter for the Claude CLI binary:
    - Pipes prompt payload over stdin to avoid OS ARG_MAX limits on large Gather context packs.
    - Isolates stderr from stdout so CLI warnings never corrupt JSON or Yomama patches.
    - Strips ANSI escape sequences and disables color output.
    """
    full_prompt = ""
    if system_prompt:
        full_prompt += f"System Instructions:\n{system_prompt}\n\n"
    for m in messages:
        full_prompt += f"{m.get('role', 'user').upper()}:\n{m.get('content', '')}\n\n"

    cmd = ["claude", "-p", "--output-format", "text"]
    if model and model.strip():
        cmd.extend(["--model", model.strip()])

    cli_env = child_env("tool")
    cli_env["NO_COLOR"] = "1"
    cli_env["TERM"] = "dumb"

    try:
        process = execute_binary(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env=cli_env,
            popen=True,
        )

        if process.stdin:
            try:
                process.stdin.write(full_prompt)
                process.stdin.close()
            except BrokenPipeError:
                pass

        if process.stdout:
            for line in iter(process.stdout.readline, ''):
                if line:
                    clean_line = _ANSI_ESCAPE_RE.sub('', line)
                    if clean_line:
                        yield f"data: {json.dumps({'text': clean_line})}\n\n"
            process.stdout.close()

        stderr_text = ""
        if process.stderr:
            stderr_text = _ANSI_ESCAPE_RE.sub('', process.stderr.read() or "").strip()
            process.stderr.close()

        process.wait()

        if process.returncode != 0:
            err_detail = f": {stderr_text}" if stderr_text else ""
            yield f"data: {json.dumps({'error': f'Claude CLI exited with code {process.returncode}{err_detail}'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'error': f'Failed to execute Claude CLI: {str(e)}'})}\n\n"
def _run_decisions_inference(
    base_url: str,
    api_key: str,
    model: str,
    messages: list,
    system_prompt: str,
    output_schema: Optional[Union[str, Dict[str, Any]]] = None,
    decision_questions: Optional[Dict[str, str]] = None,
) -> Tuple[Optional[str], Optional[str]]:
    """
    Executes a TypeSafe Jev / System-One decision call against POST /api/alpha/decisions
    (supported natively by OpenRouter and TypeSafe endpoints) and synthesizes a deterministic
    JSON response compatible with inSetu output_schema validators.
    """
    clean_base = (base_url or "https://openrouter.ai/api").strip().rstrip("/")
    if clean_base.endswith("/v1"):
        clean_base = clean_base[:-3]
    url = clean_base if clean_base.endswith("/decisions") else f"{clean_base}/alpha/decisions"

    combined_context = ""
    if system_prompt:
        combined_context += f"{system_prompt}\n\n"
    for m in messages:
        combined_context += f"{m.get('content', '')}\n"

    schema_name = str(output_schema or "").strip().lower() if isinstance(output_schema, str) else ""
    if isinstance(decision_questions, dict) and decision_questions:
        questions = {str(k): str(v) for k, v in decision_questions.items() if k and v}
    elif schema_name == "intent_classification":
        candidate_intents = ["EDIT_CODE", "EDIT_PLAN", "CHAT_ONLY"]
        questions = {
            intent: f"Does the user request require {intent}?"
            for intent in candidate_intents
        }
    elif schema_name == "debt_ratchet_verdict":
        questions = {
            "CLEAN": "Is the code diff clean and free of duplicate helpers, dead code, or boundary violations?",
            "REFACTOR": "Does the code diff introduce technical debt (duplicate helpers, unused imports, or dead code) that requires a surgical cleanup patch?",
        }
    else:
        questions = {
            "relevant": "Is this item relevant or affirmative for the stated request?"
        }

    payload = {
        "model": model,
        "context": combined_context.strip(),
        "questions": questions,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key.strip()}",
    }
    req = urllib.request.Request(url, headers=headers, data=json.dumps(payload).encode("utf-8"))
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            resp_data = json.loads(resp.read().decode("utf-8"))
            answers = resp_data.get("answers") or {}
            scores = {
                k: (float(v.get("noul", 0.0)) if isinstance(v, dict) else float(v or 0.0))
                for k, v in answers.items()
            }
            best_key = max(scores, key=scores.get) if scores else next(iter(questions.keys()), "CLEAN")
            best_score = scores.get(best_key, 0.5)

            if schema_name == "intent_classification":
                return json.dumps({"intent": best_key, "confidence": best_score, "scores": scores}), None
            if schema_name == "debt_ratchet_verdict":
                verdict = "REFACTOR" if best_key == "REFACTOR" and best_score >= 0.5 else "CLEAN"
                return json.dumps({
                    "verdict": verdict,
                    "confidence": best_score,
                    "summary": "Flagged for surgical cleanup." if verdict == "REFACTOR" else "No technical debt detected.",
                    "scores": scores,
                }), None
            if "relevant" in questions and len(questions) == 1:
                noul_val = scores.get("relevant", 0.5)
                return json.dumps({"relevant": noul_val >= 0.5, "score": noul_val, "answers": answers}), None
            return json.dumps({
                "selected": best_key,
                "verdict": best_key,
                "confidence": best_score,
                "scores": scores,
                "answers": answers,
            }), None
    except Exception as e:
        return None, f"Decisions API error ({url}): {str(e)}"
def _run_single_inference(
    provider: str,
    api_key: str,
    model: str,
    messages: list,
    system_prompt: str,
    base_url: str = "",
    max_parallel: int = 4,
    endpoint_id: str = "",
    is_decision_model: bool = False,
    output_schema: Optional[Union[str, Dict[str, Any]]] = None,
    decision_questions: Optional[Dict[str, str]] = None,
) -> Tuple[Optional[str], Optional[str]]:
    sem = _get_provider_semaphore(provider, max_parallel=max_parallel, endpoint_id=endpoint_id)
    with sem:
        if is_decision_model:
            return _run_decisions_inference(
                base_url=base_url,
                api_key=api_key,
                model=model,
                messages=messages,
                system_prompt=system_prompt,
                output_schema=output_schema,
                decision_questions=decision_questions,
            )
        full_response = ""
        if provider == "anthropic":
            stream_gen = _stream_anthropic(api_key, model, messages, system_prompt)
        elif provider == "gemini":
            stream_gen = _stream_gemini(api_key, model, messages, system_prompt)
        elif provider in ("openai_compatible", "openrouter"):
            stream_gen = _stream_openai_compatible(base_url, api_key, model, messages, system_prompt)
        elif provider == "claude_cli":
            stream_gen = _stream_claude_cli(model, messages, system_prompt)
        else:
            return None, f"Unknown provider: {provider}"

        for sse_line in stream_gen:
            if sse_line.startswith("data: "):
                data_str = sse_line[6:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    chunk_obj = json.loads(data_str)
                    if "text" in chunk_obj:
                        full_response += chunk_obj["text"]
                    elif "error" in chunk_obj:
                        return None, str(chunk_obj["error"])
                except json.JSONDecodeError:
                    continue
        return full_response, None
@llm_bp.route('complete', methods=['POST'], request_schema=ChatCompletionPayload, docstring="[sync] Executes a complete LLM inference turn with semantic tier routing, configuration profile resolution, and optional output_schema bouncer validation.")
def api_llm_complete(ctx):
    data = ctx.payload or {}
    messages = list(data.get("messages") or [])
    system_prompt = str(data.get("system") or "")
    tier = data.get("tier") or "standard"
    profile_id = data.get("profile_id")
    output_schema = data.get("output_schema")
    decision_questions = data.get("decision_questions") if isinstance(data.get("decision_questions"), dict) else None
    max_retries = max(1, int(data.get("max_retries") or 3))

    target = _resolve_tier_execution_target(ctx, tier=tier, profile_id=profile_id)
    provider = target["provider"]
    model = target["model"]
    api_key = target["api_key"]
    base_url = target["base_url"]
    max_parallel = target["max_parallel"]
    endpoint_id = target["endpoint_id"]
    is_decision_model = target["is_decision_model"]

    if provider in ("anthropic", "gemini", "decisions") and not api_key:
        return {"error": f"API key is missing for endpoint '{endpoint_id}' ({provider}). Please configure your Compute Pool in OS Settings."}, 400

    working_messages = list(messages)
    last_error = ""
    full_response = ""

    for attempt in range(max_retries):
        resp_text, err = _run_single_inference(
            provider,
            api_key,
            model,
            working_messages,
            system_prompt,
            base_url=base_url,
            max_parallel=max_parallel,
            endpoint_id=endpoint_id,
            is_decision_model=is_decision_model,
            output_schema=output_schema,
            decision_questions=decision_questions,
        )
        # Automatic Decision-to-Fast Fallback: If a dedicated decision model fails or is unreachable, fall back to the profile's 'fast' tier!
        if err is not None and is_decision_model:
            fallback_target = _resolve_tier_execution_target(ctx, tier="fast", profile_id=profile_id)
            if not fallback_target["is_decision_model"]:
                provider = fallback_target["provider"]
                model = fallback_target["model"]
                api_key = fallback_target["api_key"]
                base_url = fallback_target["base_url"]
                endpoint_id = fallback_target["endpoint_id"]
                is_decision_model = False
                resp_text, err = _run_single_inference(
                    provider,
                    api_key,
                    model,
                    working_messages,
                    system_prompt,
                    base_url=base_url,
                    max_parallel=fallback_target["max_parallel"],
                    endpoint_id=endpoint_id,
                    is_decision_model=False,
                )
        if err is not None:
            return {"error": err}, 500
        full_response = resp_text or ""
        if not output_schema:
            return {
                "text": full_response,
                "provider": provider,
                "endpoint_id": endpoint_id,
                "model": model,
                "tier": target["tier"],
                "profile_id": target["profile_id"],
            }

        is_valid, parsed_val, schema_err = validate_output_schema(full_response, output_schema)
        if is_valid:
            return {
                "text": full_response,
                "parsed": parsed_val,
                "provider": provider,
                "endpoint_id": endpoint_id,
                "model": model,
                "tier": target["tier"],
                "profile_id": target["profile_id"],
                "attempts": attempt + 1,
            }
        last_error = schema_err
        working_messages.append({"role": "assistant", "content": full_response})
        working_messages.append({
            "role": "user",
            "content": f"[SCHEMA VALIDATION ERROR]: {schema_err}\nPlease correct your output format and respond again.",
        })

    return {
        "error": f"Output schema validation failed after {max_retries} attempts: {last_error}",
        "text": full_response,
    }, 422


class AudioTranscribePayload(TypedDict, total=False):
    audio_base64: str
    mime_type: str
    prompt: str
@llm_bp.route('transcribe', methods=['POST'], request_schema=AudioTranscribePayload, docstring="[sync] Push-to-talk audio transcription gateway.")
def api_llm_transcribe(ctx):
    data = ctx.payload or {}
    audio_b64 = str(data.get("audio_base64") or "").strip()
    mime_type = str(data.get("mime_type") or "audio/webm").strip()
    prompt_hint = str(data.get("prompt") or "Transcribe the spoken developer instruction accurately.").strip()
    if not audio_b64:
        return {"error": "audio_base64 is required."}, 400

    target = _resolve_tier_execution_target(ctx, tier="fast", profile_id=data.get("profile_id"))
    provider = target["provider"]
    api_key = target["api_key"]
    model = target["model"]
    if provider == "gemini" and api_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {
            "contents": [{
                "role": "user",
                "parts": [
                    {"text": prompt_hint},
                    {"inline_data": {"mime_type": mime_type, "data": audio_b64}},
                ],
            }]
        }
        req = urllib.request.Request(url, headers={"Content-Type": "application/json"}, data=json.dumps(payload).encode("utf-8"))
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_data = json.loads(resp.read().decode("utf-8"))
                parts = resp_data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                transcript = "".join(p.get("text", "") for p in parts).strip()
                return {"status": "success", "text": transcript, "provider": provider}
        except Exception as e:
            return {"error": f"Audio transcription failed: {str(e)}"}, 500

    return {"error": f"Push-to-talk transcription requires a multimodal provider (e.g. 'gemini'); active provider is '{provider}'."}, 400
@llm_bp.route('chat/completions', methods=['POST'], request_schema=ChatCompletionPayload, docstring="Streams LLM inference utilizing the active cognitive profile and compute pool.")
def api_chat_completions(ctx):
    data = ctx.payload or {}
    messages = data.get("messages", [])
    system_prompt = data.get("system", "")
    target = _resolve_tier_execution_target(ctx, tier=data.get("tier"), profile_id=data.get("profile_id"))
    provider = target["provider"]
    model = target["model"]
    api_key = target["api_key"]
    base_url = target["base_url"]
    endpoint_id = target["endpoint_id"]

    if provider in ("anthropic", "gemini", "decisions") and not api_key:
        return {"error": f"API key is missing for endpoint '{endpoint_id}' ({provider}). Please configure your Compute Pool in OS Settings."}, 400

    def generate():
        if target["is_decision_model"]:
            text_out, err = _run_decisions_inference(base_url, api_key, model, messages, system_prompt, data.get("output_schema"))
            if err:
                yield f"data: {json.dumps({'error': err})}\n\n"
            elif text_out:
                yield f"data: {json.dumps({'text': text_out})}\n\n"
        elif provider == "anthropic":
            yield from _stream_anthropic(api_key, model, messages, system_prompt)
        elif provider == "gemini":
            yield from _stream_gemini(api_key, model, messages, system_prompt)
        elif provider in ("openai_compatible", "openrouter"):
            yield from _stream_openai_compatible(base_url, api_key, model, messages, system_prompt)
        elif provider == "claude_cli":
            yield from _stream_claude_cli(model, messages, system_prompt)
        else:
            yield f"data: {json.dumps({'error': f'Unknown provider: {provider}'})}\n\n"

        yield "data: [DONE]\n\n"

    return Response(stream_with_context(generate()), content_type='text/event-stream')


class LlmProfilesSavePayload(TypedDict, total=False):
    active_profile_id: Optional[str]
    endpoints: Optional[List[Dict[str, Any]]]
    profiles: Optional[List[Dict[str, Any]]]
    endpoint_keys: Optional[Dict[str, str]]


@llm_bp.route('profiles', methods=['GET', 'POST'], request_schema={"POST": LlmProfilesSavePayload}, docstring="[sync] Lists or updates the Compute Endpoint Pool, Cognitive Configuration Profiles, and the workspace's active_profile_id.")
def api_llm_profiles(ctx):
    if ctx.method == 'GET' and not ctx.payload:
        return get_compute_pool_and_profiles(ctx)

    data = ctx.payload or {}
    updates: Dict[str, Any] = {}

    if isinstance(data.get("endpoint_keys"), dict):
        for ep_id, raw_key in data["endpoint_keys"].items():
            if isinstance(raw_key, str) and not raw_key.startswith("****"):
                _set_endpoint_secret_key(ctx.workspace_id, slugify(ep_id), raw_key)

    if isinstance(data.get("endpoints"), list):
        clean_eps = []
        for ep in data["endpoints"]:
            if not isinstance(ep, dict):
                continue
            eid = slugify(ep.get("id") or ep.get("label") or "endpoint")
            if not eid:
                continue
            if isinstance(ep.get("api_key"), str) and ep["api_key"].strip() and not ep["api_key"].startswith("****"):
                _set_endpoint_secret_key(ctx.workspace_id, eid, ep["api_key"])
            raw_custom = ep.get("custom_models") if ep.get("custom_models") is not None else (ep.get("models") or [])
            if isinstance(raw_custom, str):
                raw_custom = [m.strip() for m in raw_custom.split(",") if m.strip()]
            clean_models = [str(m).strip() for m in raw_custom if str(m).strip()]
            clean_eps.append({
                "id": eid,
                "label": str(ep.get("label") or eid),
                "driver": str(ep.get("driver") or "openai_compatible"),
                "base_url": str(ep.get("base_url") or "").strip(),
                "max_parallel": max(1, int(ep.get("max_parallel") or 4)),
                "custom_models": clean_models,
                "models": clean_models,
                "enabled": bool(ep.get("enabled", True)),
            })
        updates["compute_endpoints"] = clean_eps

    if isinstance(data.get("profiles"), list):
        clean_profs = []
        for p in data["profiles"]:
            if not isinstance(p, dict):
                continue
            pid = slugify(p.get("id") or p.get("title") or "profile")
            if not pid:
                continue
            raw_tiers = p.get("tiers") if isinstance(p.get("tiers"), dict) else {}
            norm_tiers: Dict[str, Dict[str, str]] = {}
            for t in COGNITIVE_TIERS:
                t_val = raw_tiers.get(t)
                if isinstance(t_val, dict):
                    norm_tiers[t] = {
                        "endpoint": str(t_val.get("endpoint") or t_val.get("endpoint_id") or "").strip(),
                        "model": str(t_val.get("model") or "").strip(),
                    }
                elif isinstance(t_val, str) and t_val.strip():
                    if "::" in t_val:
                        ep_part, mod_part = t_val.split("::", 1)
                        norm_tiers[t] = {"endpoint": ep_part.strip(), "model": mod_part.strip()}
                    else:
                        norm_tiers[t] = {"endpoint": "", "model": t_val.strip()}
                else:
                    norm_tiers[t] = {"endpoint": "", "model": ""}
            clean_profs.append({
                "id": pid,
                "title": str(p.get("title") or pid),
                "description": str(p.get("description") or ""),
                "tiers": norm_tiers,
            })
        updates["llm_profiles"] = clean_profs

    if data.get("active_profile_id"):
        updates["active_profile_id"] = str(data["active_profile_id"]).strip()

    if updates:
        ctx.settings.update(updates)

    return {"status": "success", **get_compute_pool_and_profiles(ctx)}


def _harvest_external_model_catalog(ctx) -> Dict[str, Any]:
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
        req = urllib.request.Request(
            PUBLIC_CATALOG_SOURCES["openrouter"],
            headers={"Accept": "application/json", "User-Agent": "inSetu-Developer-OS/2.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            or_data = json.loads(resp.read().decode("utf-8"))
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
                    "recommended_tier": _infer_model_cognitive_tier(mid, in_cost_1m, cat_str),
                    "source": "openrouter",
                }
    except Exception:
        pass
    # 1b. Harvest Models.dev Open Catalog (Covers direct Anthropic, Gemini, OpenAI, and TypeSafe Jev models)
    try:
        req = urllib.request.Request(
            PUBLIC_CATALOG_SOURCES["models_dev"],
            headers={"Accept": "application/json", "User-Agent": "inSetu-Developer-OS/2.0"},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            mdev_data = json.loads(resp.read().decode("utf-8"))
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
                            "recommended_tier": _infer_model_cognitive_tier(full_id, in_cost_round, cat_str),
                            "source": "models.dev",
                        }
    except Exception:
        pass

    # 1c. Harvest LiteLLM Pricing & Context Map Fallback
    try:
        req = urllib.request.Request(
            PUBLIC_CATALOG_SOURCES["litellm"],
            headers={"Accept": "application/json", "User-Agent": "inSetu-Developer-OS/2.0"},
        )
        with urllib.request.urlopen(req, timeout=8) as resp:
            lite_data = json.loads(resp.read().decode("utf-8"))
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
                        "recommended_tier": _infer_model_cognitive_tier(m_key, in_cost_1m, "generative"),
                        "source": "litellm",
                    }
    except Exception:
        pass

    # 2. Probe Local Registered Ollama / OpenAI-Compatible Endpoints
    pool = get_compute_pool_and_profiles(ctx)
    for ep in (pool.get("endpoints") or []):
        if not isinstance(ep, dict) or ep.get("driver") != "openai_compatible":
            continue
        base_url = str(ep.get("base_url") or "").strip().rstrip("/")
        if not base_url or "openrouter.ai" in base_url or "api.openai.com" in base_url:
            continue
        try:
            models_url = f"{base_url}/models" if base_url.endswith("/v1") else f"{base_url}/v1/models"
            req = urllib.request.Request(models_url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                m_data = json.loads(resp.read().decode("utf-8"))
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
                            "recommended_tier": _infer_model_cognitive_tier(m_id, 0.0, "local"),
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
@llm_bp.route('decide', methods=['POST'], request_schema=LlmDecidePayload, docstring="[sync] Executes a fast binary or multi-class decision evaluation using the active profile's 'decision' tier (TypeSafe Jev / Drex) with automatic fallback to the 'fast' tier.")
def api_llm_decide(ctx):
    data = ctx.payload or {}
    context_text = str(data.get("context") or "").strip()
    questions = data.get("questions") if isinstance(data.get("questions"), dict) else {}
    profile_id = data.get("profile_id")
    if not questions:
        return {"error": "A non-empty 'questions' dictionary is required."}, 400

    prompt_lines = [
        "Evaluate the following context against the decision options below and respond ONLY with valid JSON:",
        '{"selected": "<winning_key>", "verdict": "<winning_key>", "confidence": 0.0_to_1.0, "scores": {"<key>": 0.0_to_1.0}}',
        "\nDecision Options:",
    ]
    for k, q_desc in questions.items():
        prompt_lines.append(f"- {k}: {q_desc}")
    prompt_lines.append(f"\nContext:\n{context_text}")

    res = ctx.call(
        "llm.complete",
        messages=[{"role": "user", "content": "\n".join(prompt_lines)}],
        tier="decision",
        profile_id=profile_id,
        output_schema="json",
        decision_questions=questions,
        max_retries=2,
        wait=True,
    )
    if isinstance(res, dict) and isinstance(res.get("parsed"), dict):
        parsed = res["parsed"]
        scores = parsed.get("scores") if isinstance(parsed.get("scores"), dict) else {}
        selected = parsed.get("selected") or parsed.get("verdict") or (max(scores, key=scores.get) if scores else next(iter(questions.keys())))
        return {
            "status": "success",
            "selected": selected,
            "verdict": selected,
            "confidence": float(parsed.get("confidence", scores.get(selected, 1.0)) or 1.0),
            "scores": scores,
            "model": res.get("model"),
            "provider": res.get("provider"),
            "profile_id": res.get("profile_id"),
        }
    return res


def export_public_llm_catalog_file(out_path: str, workspace_id: str = "default") -> Dict[str, Any]:
    """
    Headless static exporter for CI / GitHub Actions / Cloudflare Pages:
    Harvests the live multi-provider model & token pricing catalog and writes it as a standalone JSON file.
    """
    ctx = llm_bp.get_context(workspace_id)
    data = _harvest_external_model_catalog(ctx)
    dest = Path(out_path).expanduser().resolve()
    dest.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_text(dest.as_posix(), json.dumps(data, indent=2))
    return {"status": "success", "path": dest.as_posix(), "count": data.get("count", 0)}


@llm_bp.route('catalog', methods=['GET', 'POST'], docstring="[sync] Returns the cached multi-provider LLM model & token pricing catalog (GET) or refreshes it live from OpenRouter, Models.dev, and local Ollama instances (POST).")
def api_llm_catalog(ctx):
    cache_dir = Path(get_domain_cache_path(ctx.workspace_id, "llm"))
    cache_file = cache_dir / "model_catalog.json"
    force_refresh = ctx.method == 'POST' or bool((ctx.payload or {}).get("refresh"))

    if not force_refresh and cache_file.exists():
        cached = load_json_config(cache_file.as_posix(), {})
        if cached.get("models"):
            return cached
    return _harvest_external_model_catalog(ctx)


@llm_bp.bp.route('/api/system/llm_catalog.json', methods=['GET'])
def api_public_llm_catalog():
    """
    Free, unauthenticated, CORS-enabled public JSON API endpoint serving the normalized
    multi-provider model & token pricing catalog (merging OpenRouter, Models.dev, LiteLLM, and local endpoints).
    """
    ctx = llm_bp.get_context("default")
    cache_dir = Path(get_domain_cache_path("default", "llm"))
    cache_file = cache_dir / "model_catalog.json"
    if cache_file.exists():
        data = load_json_config(cache_file.as_posix(), {})
        if not data.get("models"):
            data = _harvest_external_model_catalog(ctx)
    else:
        data = _harvest_external_model_catalog(ctx)
    resp = Response(json.dumps(data, indent=2), mimetype="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp