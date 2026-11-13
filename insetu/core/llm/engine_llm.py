import json
import time
import uuid
from pathlib import Path
from typing import TypedDict, List, Dict, Any, Optional, Union, Tuple
from flask import Response, stream_with_context
from insetu.core.sdk import InSetuExtension, SettingsManager, slugify
from insetu.core.system.security_io import fetch_url
from insetu.core.utils_core import (
    get_domain_cache_path,
    get_repeater_secret,
    load_json_config,
    set_repeater_secret,
)
from .llm_catalog import (
    DRIVER_TIER_DEFAULTS,
    PUBLIC_CATALOG_SOURCES,
    export_public_llm_catalog_file,
    harvest_external_model_catalog,
    infer_model_cognitive_tier as _infer_model_cognitive_tier,
)
from .llm_drivers import (
    get_provider_semaphore as _get_provider_semaphore,
    run_decisions_inference as _run_decisions_inference,
    run_single_inference as _run_single_inference,
    stream_anthropic as _stream_anthropic,
    stream_claude_cli as _stream_claude_cli,
    stream_gemini as _stream_gemini,
    stream_openai_compatible as _stream_openai_compatible,
)
from .llm_telemetry import LLM_TELEMETRY_TABLE_SCHEMA, record_llm_call_telemetry

COGNITIVE_TIERS = ("decision", "fast", "standard", "thinking", "frontier")

BUILTIN_WEB_CHAT_ENDPOINT: Dict[str, Any] = {
    "id": "web_chat",
    "label": "External Web Chatbot (Copy Context + Prompt Handoff)",
    "driver": "web_chat",
    "base_url": "",
    "api_key": "",
    "custom_models": ["chatbot"],
    "models": ["chatbot"],
    "max_parallel": 1,
    "enabled": True,
    "is_system": True,
}

DEFAULT_COMPUTE_ENDPOINTS: List[Dict[str, Any]] = [
    {
        "id": "anthropic_main",
        "label": "Anthropic Claude API",
        "driver": "anthropic",
        "base_url": "",
        "api_key": "",
        "custom_models": [],
        "max_parallel": 4,
    },
    dict(BUILTIN_WEB_CHAT_ENDPOINT),
]

DEFAULT_LLM_PROFILES: List[Dict[str, Any]] = [
    {
        "id": "default",
        "title": "Default Configuration",
        "description": "Balanced configuration across cognitive tiers.",
        "tiers": {
            "decision": {"endpoint": "", "model": ""},
            "fast": {"endpoint": "anthropic_main", "model": "claude-3-5-haiku-latest"},
            "standard": {"endpoint": "anthropic_main", "model": "claude-3-5-sonnet-latest"},
            "thinking": {"endpoint": "anthropic_main", "model": "claude-3-5-sonnet-latest"},
            "frontier": {"endpoint": "anthropic_main", "model": "claude-3-5-sonnet-latest"},
        },
    }
]

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
        "pinned_items": [dict(BUILTIN_WEB_CHAT_ENDPOINT)],
        "default": [
            {
                "id": "anthropic_main",
                "label": "Anthropic Claude API",
                "driver": "anthropic",
                "base_url": "",
                "api_key": "",
                "custom_models": [],
                "max_parallel": 4
            },
            dict(BUILTIN_WEB_CHAT_ENDPOINT),
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
    }
]
LLM_SCHEMA = {"llm_telemetry": LLM_TELEMETRY_TABLE_SCHEMA}

llm_bp = InSetuExtension(
    'llm',
    __name__,
    title="LLM Gateway",
    description="Universal inference orchestrator supporting multi-endpoint compute pools, cognitive profiles, decision models, and live model catalogs.",
    core=True,
    schema=LLM_SCHEMA,
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
        if not any(isinstance(ep, dict) and (ep.get("driver") == "web_chat" or ep.get("id") in ("web_chat", "chatbot")) for ep in raw_eps):
            raw_eps.append(dict(BUILTIN_WEB_CHAT_ENDPOINT))
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
    caller_tag: Optional[str]

class LlmDecidePayload(TypedDict, total=False):
    context: str
    questions: Dict[str, str]
    mode: Optional[str]
    profile_id: Optional[str]
    caller_tag: Optional[str]

def get_compute_pool_and_profiles(ctx) -> Dict[str, Any]:
    """Returns the normalized compute endpoint pool, configuration profiles, and active_profile_id."""
    raw_endpoints = ctx.settings.get("compute_endpoints", [])
    raw_profiles = ctx.settings.get("llm_profiles", [])

    endpoints = (
        [dict(ep) for ep in raw_endpoints if isinstance(ep, dict)]
        if isinstance(raw_endpoints, list) and len(raw_endpoints) > 0
        else [dict(ep) for ep in DEFAULT_COMPUTE_ENDPOINTS]
    )
    if not any(ep.get("driver") == "web_chat" or ep.get("id") in ("web_chat", "chatbot") for ep in endpoints):
        endpoints.append({
            "id": "web_chat",
            "label": "External Web Chatbot (Copy Context + Prompt Handoff)",
            "driver": "web_chat",
            "base_url": "",
            "api_key": "",
            "custom_models": ["chatbot"],
            "models": ["chatbot"],
            "max_parallel": 1,
            "enabled": True,
        })
    for ep in endpoints:
        if ep.get("id"):
            ep["has_api_key"] = bool(
                get_repeater_secret("llm", ctx.workspace_id, "compute_endpoints", ep["id"], "api_key", scope="daemon")
                or (isinstance(ep.get("api_key"), str) and ep["api_key"].strip() and not ep["api_key"].startswith("****"))
            )

    profiles = (
        [dict(p) for p in raw_profiles if isinstance(p, dict)]
        if isinstance(raw_profiles, list) and len(raw_profiles) > 0
        else [dict(p) for p in DEFAULT_LLM_PROFILES]
    )
    active_id = str(ctx.settings.get("active_profile_id") or "default").strip()
    if not any(isinstance(p, dict) and p.get("id") == active_id for p in profiles):
        active_id = profiles[0]["id"] if profiles else "default"

    return {
        "endpoints": endpoints,
        "profiles": profiles,
        "active_profile_id": active_id,
        "driver_tier_defaults": DRIVER_TIER_DEFAULTS,
    }

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

    ep = endpoints_by_id.get(ep_id) or next(iter(endpoints_by_id.values()), None) or DEFAULT_COMPUTE_ENDPOINTS[0]
    ep_id = str(ep.get("id") or "anthropic_main")
    prov = str(ep.get("driver") or "anthropic").strip().lower()
    ep_models = ep.get("custom_models") or ep.get("models") or []
    default_tier_model = DRIVER_TIER_DEFAULTS.get(prov, {}).get(norm_tier) or "claude-3-5-sonnet-latest"
    model_resolved = model_name or (ep_models[0] if ep_models else default_tier_model)
    raw_ep_key = ep.get("api_key") if isinstance(ep.get("api_key"), str) and not ep.get("api_key", "").startswith("****") else ""
    api_key = get_repeater_secret("llm", ctx.workspace_id, "compute_endpoints", ep_id, "api_key", scope="daemon") or raw_ep_key
    base_url = str(ep.get("base_url") or ("https://openrouter.ai/api/v1" if prov == "openrouter" else "http://127.0.0.1:11434/v1"))
    max_p = int(ep.get("max_parallel", 4) or 4)

    lower_m = (model_resolved or "").strip().lower()
    is_web_chat_model = lower_m in ("chatbot", "web_chat", "web-chat", "manual") or lower_m.startswith("web-chat-")
    effective_prov = "web_chat" if (prov == "web_chat" or is_web_chat_model) else prov
    is_decision_model = (
        effective_prov == "decisions"
        or lower_m.startswith(("typesafe/jev", "jev-", "nace-ai/drex", "liquid/d1"))
    )

    return {
        "endpoint_id": ep_id,
        "provider": "openai_compatible" if effective_prov == "openrouter" and not is_decision_model else effective_prov,
        "raw_driver": effective_prov,
        "model": model_resolved,
        "api_key": api_key,
        "base_url": base_url,
        "max_parallel": max_p,
        "tier": norm_tier,
        "profile_id": profile.get("id") or req_profile_id,
        "is_decision_model": is_decision_model,
        "is_web_chat": (effective_prov == "web_chat"),
    }

class LlmResolveTargetPayload(TypedDict, total=False):
    tier: Optional[str]
    profile_id: Optional[str]

@llm_bp.route('resolve_target', methods=['GET', 'POST'], request_schema=LlmResolveTargetPayload, docstring="[sync] Resolves the execution target metadata for a cognitive tier and profile without exposing plaintext API keys.")
def api_llm_resolve_target(ctx):
    data = ctx.payload or {}
    target = _resolve_tier_execution_target(ctx, tier=data.get("tier"), profile_id=data.get("profile_id"))
    raw_driver = target["raw_driver"]
    has_key = bool(target.get("api_key"))
    has_model = bool((target.get("model") or "").strip())
    requires_key = raw_driver in ("anthropic", "gemini", "openrouter", "decisions")

    if target["is_web_chat"]:
        can_auto_heal = False
        auto_heal_reason = "Fast tier is set to External Web Chat — use 'Copy Repair Prompt' instead, or assign an API/local model to the Fast tier."
    elif not has_model:
        can_auto_heal = False
        auto_heal_reason = f"No model is configured for the '{target['tier']}' tier in profile '{target['profile_id']}'."
    elif requires_key and not has_key:
        can_auto_heal = False
        auto_heal_reason = f"No API key configured for endpoint '{target['endpoint_id']}' ({raw_driver}). Configure it in Settings -> LLM."
    else:
        can_auto_heal = True
        auto_heal_reason = f"AI Auto-Repair ready ({target['model']} via {target['endpoint_id']})."

    return {
        "endpoint_id": target["endpoint_id"],
        "provider": target["provider"],
        "raw_driver": raw_driver,
        "model": target["model"],
        "base_url": target["base_url"],
        "max_parallel": target["max_parallel"],
        "tier": target["tier"],
        "profile_id": target["profile_id"],
        "is_decision_model": target["is_decision_model"],
        "is_web_chat": target["is_web_chat"],
        "has_api_key": has_key,
        "can_auto_heal": can_auto_heal,
        "auto_heal_reason": auto_heal_reason,
    }

def validate_output_schema(raw_text: str, output_schema: Union[str, Dict[str, Any]]) -> Tuple[bool, Any, str]:
    """
    Universal Output Schema Bouncer:
    Delegates validation to the formal schema registry in insetu.core.agent.schemas.
    Returns (is_valid, parsed_or_normalized_value, error_message).
    """
    if not output_schema:
        return True, raw_text, ""
    from insetu.core.agent.schemas import validate_schema_response as _registry_validate_schema
    return _registry_validate_schema(output_schema, raw_text or "")

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

    if target.get("is_web_chat"):
        return {
            "error": (
                f"Endpoint '{endpoint_id}' is set to External Web Chat and cannot run unattended background inference. "
                "Use 'Copy Repair Prompt' or assign an API/local model to the Fast tier."
            )
        }, 400
    if (provider in ("anthropic", "gemini", "decisions") or target.get("raw_driver") == "openrouter") and not api_key:
        return {"error": f"API key is missing for endpoint '{endpoint_id}' ({target.get('raw_driver') or provider}). Please configure your Compute Pool in OS Settings."}, 400

    caller_tag = str(data.get("caller_tag") or (f"schema:{output_schema}" if isinstance(output_schema, str) and output_schema else f"tier:{target['tier']}")).strip()
    prompt_joined = "\n".join(str(m.get("content") or "") for m in messages if isinstance(m, dict))
    t_start = time.time()

    def _record_llm_telemetry(status_str: str, attempts_used: int, resp_str: str, err_str: str = "") -> None:
        record_llm_call_telemetry(
            ctx, t_start=t_start, caller_tag=caller_tag, tier=target["tier"], endpoint_id=endpoint_id,
            provider=provider, model=model, output_schema=output_schema, prompt_joined=prompt_joined,
            system_prompt=system_prompt, status_str=status_str, attempts_used=attempts_used,
            resp_str=resp_str, err_str=err_str,
        )

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
            _record_llm_telemetry("http_error", attempt + 1, full_response, str(err))
            return {"error": err}, 500
        full_response = resp_text or ""
        if not output_schema:
            _record_llm_telemetry("ok", attempt + 1, full_response, "")
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
            _record_llm_telemetry("ok" if attempt == 0 else "ok_after_retry", attempt + 1, full_response, last_error)
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

    _record_llm_telemetry("schema_failed", max_retries, full_response, last_error)
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
        clean_model = model.split("/", 1)[1] if "/" in model and model.lower().startswith(("google/", "models/")) else model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={api_key}"
        payload = {
            "contents": [{
                "role": "user",
                "parts": [
                    {"text": prompt_hint},
                    {"inline_data": {"mime_type": mime_type, "data": audio_b64}},
                ],
            }]
        }
        try:
            resp = fetch_url(
                url,
                method="POST",
                headers={"Content-Type": "application/json"},
                data=json.dumps(payload).encode("utf-8"),
                timeout=30.0,
            )
            resp_data = resp.json()
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
                set_repeater_secret("llm", ctx.workspace_id, "compute_endpoints", slugify(ep_id), "api_key", raw_key, scope="daemon")

    if isinstance(data.get("endpoints"), list):
        clean_eps = []
        for ep in data["endpoints"]:
            if not isinstance(ep, dict):
                continue
            eid = slugify(ep.get("id") or ep.get("label") or "endpoint")
            if not eid:
                continue
            if isinstance(ep.get("api_key"), str) and ep["api_key"].strip() and not ep["api_key"].startswith("****"):
                set_repeater_secret("llm", ctx.workspace_id, "compute_endpoints", eid, "api_key", ep["api_key"], scope="daemon")
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
        caller_tag=str(data.get("caller_tag") or "llm:decide"),
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

@llm_bp.route('catalog', methods=['GET', 'POST'], docstring="[sync] Returns the cached multi-provider LLM model & token pricing catalog (GET) or refreshes it live from OpenRouter, Models.dev, and local Ollama instances (POST).")
def api_llm_catalog(ctx):
    cache_dir = Path(get_domain_cache_path(ctx.workspace_id, "llm"))
    cache_file = cache_dir / "model_catalog.json"
    force_refresh = ctx.method == 'POST' or bool((ctx.payload or {}).get("refresh"))

    if not force_refresh and cache_file.exists():
        cached = load_json_config(cache_file.as_posix(), {})
        if cached.get("models"):
            return cached
    return harvest_external_model_catalog(ctx, endpoints=get_compute_pool_and_profiles(ctx).get("endpoints"))


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
            data = harvest_external_model_catalog(ctx, endpoints=get_compute_pool_and_profiles(ctx).get("endpoints"))
    else:
        data = harvest_external_model_catalog(ctx, endpoints=get_compute_pool_and_profiles(ctx).get("endpoints"))
    resp = Response(json.dumps(data, indent=2), mimetype="application/json")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp
