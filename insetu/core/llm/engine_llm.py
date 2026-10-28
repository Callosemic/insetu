import os
import json
import urllib.request
import subprocess
import re
from typing import TypedDict, List, Dict, Any, Generator, Optional, Union, Tuple
from flask import Response, stream_with_context
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import execute_binary, parse_blocks

LLM_SETTINGS_SCHEMA = [
    {
        "id": "provider",
        "label": "LLM Provider",
        "type": "select",
        "scope": "workspace",
        "default": "anthropic",
        "options": [
            {"value": "anthropic", "label": "Anthropic Claude (REST)"},
            {"value": "gemini", "label": "Google Gemini (REST)"},
            {"value": "openai_compatible", "label": "Local / OpenAI-Compatible (Ollama, LM Studio, vLLM)"},
            {"value": "claude_cli", "label": "⚠️ Claude CLI (Local Subscription Binary)"}
        ],
        "description": "Select the active inference engine. Use 'Local / OpenAI-Compatible' for Ollama, LM Studio, vLLM, llama.cpp, or OpenAI/OpenRouter endpoints."
    },
    {
        "id": "base_url",
        "label": "OpenAI-Compatible Base URL",
        "type": "text",
        "scope": "workspace",
        "default": "http://127.0.0.1:11434/v1",
        "description": "Base URL for the 'openai_compatible' provider (e.g., http://127.0.0.1:11434/v1 for Ollama, http://127.0.0.1:1234/v1 for LM Studio, or https://api.openai.com/v1)."
    },
    {
        "id": "model",
        "label": "Default (Standard) Model Name",
        "type": "text",
        "scope": "workspace",
        "default": "claude-3-5-sonnet-latest",
        "description": "Target model identifier for standard turns (e.g., claude-3-5-sonnet-latest, gemini-2.5-pro)."
    },
    {
        "id": "tier_fast_model",
        "label": "Fast Tier Model (Classification & Enrichment)",
        "type": "text",
        "scope": "workspace",
        "default": "",
        "description": "Optional fast/lightweight model override for 'fast' tier calls (e.g., claude-3-5-haiku-latest, gemini-2.5-flash). Defaults to the standard model when blank."
    },
    {
        "id": "tier_thinking_model",
        "label": "Thinking Tier Model (Code & Patch Generation)",
        "type": "text",
        "scope": "workspace",
        "default": "",
        "description": "Optional reasoning model override for 'thinking' tier calls. Defaults to the standard model when blank."
    },
    {
        "id": "tier_frontier_model",
        "label": "Frontier Tier Model (Deep Architecture)",
        "type": "text",
        "scope": "workspace",
        "default": "",
        "description": "Optional highest-capability model override for 'frontier' tier calls. Defaults to the standard model when blank."
    },
    {
        "id": "api_key",
        "label": "API Key",
        "type": "password",
        "secure": True,
        "scope": "workspace",
        "default": "",
        "description": "Standard API Key. Not required for the Claude CLI provider."
    }
]

llm_bp = InSetuExtension(
    'llm',
    __name__,
    title="LLM Gateway",
    description="Universal inference orchestrator supporting REST APIs and local CLI agents.",
    core=True,
    settings_schema=LLM_SETTINGS_SCHEMA
)
__depends__ = []
class ChatMessage(TypedDict):
    role: str
    content: str


class ChatCompletionPayload(TypedDict, total=False):
    messages: List[ChatMessage]
    system: Optional[str]
    tier: Optional[str]
    output_schema: Optional[Union[str, Dict[str, Any]]]
    max_retries: Optional[int]


def _resolve_tier_model(ctx, tier: Optional[str] = None) -> str:
    """Resolves the target model identifier for a semantic cognitive tier (fast, standard, thinking, frontier)."""
    base_model = ctx.settings.get("model", "claude-3-5-sonnet-latest") or "claude-3-5-sonnet-latest"
    clean_tier = str(tier or "standard").strip().lower()
    if clean_tier == "fast":
        return ctx.settings.get("tier_fast_model", "") or base_model
    if clean_tier == "thinking":
        return ctx.settings.get("tier_thinking_model", "") or base_model
    if clean_tier == "frontier":
        return ctx.settings.get("tier_frontier_model", "") or base_model
    return base_model


def _strip_json_fences(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?[ \t]*\r?\n?', '', text, count=1)
        text = re.sub(r'\r?\n?```\s*$', '', text, count=1)
    return text.strip()


def validate_output_schema(raw_text: str, output_schema: Union[str, Dict[str, Any]]) -> Tuple[bool, Any, str]:
    """
    Universal Output Schema Bouncer:
    Validates LLM text against named built-in contracts ('yomama_patch', 'intent_classification', 'json')
    or a declarative JSON Schema object.
    Returns (is_valid, parsed_or_normalized_value, error_message).
    """
    if not output_schema:
        return True, raw_text, ""

    if isinstance(output_schema, str):
        schema_name = output_schema.strip().lower()
        if schema_name == "yomama_patch":
            blocks = parse_blocks(raw_text or "")
            if not blocks:
                return (
                    False,
                    None,
                    "Response did not contain any valid Yomama patch blocks ('<<<<<<< FILE:' + '<<<<<<< SEARCH' / '>>>>>>> REPLACE' or '<<<<<<< RELOCATE' / '<<<<<<< RENAME').",
                )
            return True, blocks, ""

        if schema_name == "intent_classification":
            cleaned = _strip_json_fences(raw_text)
            try:
                parsed = json.loads(cleaned)
                if isinstance(parsed, dict) and parsed.get("intent") in ("EDIT_CODE", "EDIT_PLAN", "CHAT_ONLY"):
                    return True, parsed, ""
            except Exception:
                pass
            upper = (raw_text or "").upper()
            for token in ("EDIT_CODE", "EDIT_PLAN", "CHAT_ONLY"):
                if token in upper:
                    return True, {"intent": token}, ""
            return (
                False,
                None,
                "Response must specify a valid intent ('EDIT_CODE', 'EDIT_PLAN', or 'CHAT_ONLY') as JSON {'intent': '...'} or token.",
            )

        if schema_name == "json":
            cleaned = _strip_json_fences(raw_text)
            try:
                return True, json.loads(cleaned), ""
            except Exception as e:
                return False, None, f"Invalid JSON output: {e}"

    if isinstance(output_schema, dict):
        cleaned = _strip_json_fences(raw_text)
        try:
            parsed = json.loads(cleaned)
        except Exception as e:
            return False, None, f"Output is not valid JSON: {e}"
        req_keys = output_schema.get("required") or []
        if isinstance(parsed, dict):
            missing = [k for k in req_keys if k not in parsed]
            if missing:
                return False, None, f"JSON object is missing required keys: {', '.join(missing)}"
        return True, parsed, ""

    return True, raw_text, ""
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

    cli_env = dict(os.environ)
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


def _run_single_inference(provider: str, api_key: str, model: str, messages: list, system_prompt: str, base_url: str = "") -> Tuple[Optional[str], Optional[str]]:
    full_response = ""
    if provider == "anthropic":
        stream_gen = _stream_anthropic(api_key, model, messages, system_prompt)
    elif provider == "gemini":
        stream_gen = _stream_gemini(api_key, model, messages, system_prompt)
    elif provider == "openai_compatible":
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


@llm_bp.route('complete', methods=['POST'], request_schema=ChatCompletionPayload, docstring="[sync] Executes a complete LLM inference turn with semantic tier routing and optional output_schema bouncer validation.")
def api_llm_complete(ctx):
    data = ctx.payload or {}
    messages = list(data.get("messages") or [])
    system_prompt = str(data.get("system") or "")
    tier = data.get("tier") or "standard"
    output_schema = data.get("output_schema")
    max_retries = max(1, int(data.get("max_retries") or 3))
    provider = ctx.settings.get("provider", "anthropic")
    model = _resolve_tier_model(ctx, tier)
    api_key = ctx.settings.get("api_key", "")
    base_url = ctx.settings.get("base_url", "http://127.0.0.1:11434/v1")

    if provider in ["anthropic", "gemini"] and not api_key:
        return {"error": f"API key is missing for provider '{provider}'. Please update your Workspace Configuration."}, 400

    working_messages = list(messages)
    last_error = ""
    full_response = ""

    for attempt in range(max_retries):
        resp_text, err = _run_single_inference(provider, api_key, model, working_messages, system_prompt, base_url=base_url)
        if err is not None:
            return {"error": err}, 500
        full_response = resp_text or ""
        if not output_schema:
            return {"text": full_response, "provider": provider, "model": model, "tier": tier}

        is_valid, parsed_val, schema_err = validate_output_schema(full_response, output_schema)
        if is_valid:
            return {
                "text": full_response,
                "parsed": parsed_val,
                "provider": provider,
                "model": model,
                "tier": tier,
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

    provider = ctx.settings.get("provider", "anthropic")
    api_key = ctx.settings.get("api_key", "")
    model = _resolve_tier_model(ctx, "fast")
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


@llm_bp.route('chat/completions', methods=['POST'], request_schema=ChatCompletionPayload, docstring="Streams LLM inference utilizing the configured workspace provider.")
def api_chat_completions(ctx):
    data = ctx.payload or {}
    messages = data.get("messages", [])
    system_prompt = data.get("system", "")
    provider = ctx.settings.get("provider", "anthropic")
    model = _resolve_tier_model(ctx, data.get("tier"))
    api_key = ctx.settings.get("api_key", "")
    base_url = ctx.settings.get("base_url", "http://127.0.0.1:11434/v1")

    if provider in ["anthropic", "gemini"] and not api_key:
        return {"error": f"API key is missing for provider '{provider}'. Please update your Workspace Configuration."}, 400

    def generate():
        if provider == "anthropic":
            yield from _stream_anthropic(api_key, model, messages, system_prompt)
        elif provider == "gemini":
            yield from _stream_gemini(api_key, model, messages, system_prompt)
        elif provider == "openai_compatible":
            yield from _stream_openai_compatible(base_url, api_key, model, messages, system_prompt)
        elif provider == "claude_cli":
            yield from _stream_claude_cli(model, messages, system_prompt)
        else:
            yield f"data: {json.dumps({'error': f'Unknown provider: {provider}'})}\n\n"
            
        yield "data: [DONE]\n\n"

    return Response(stream_with_context(generate()), content_type='text/event-stream')