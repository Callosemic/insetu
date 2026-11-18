"""Physical admission control semaphores and streaming/decision protocol drivers extracted from engine_llm.py (God-Objects Wave 3.5)."""

import json
import re
import subprocess
import threading
import urllib.request
from typing import Any, Dict, Generator, Optional, Tuple, Union

from insetu.core.system.security_io import child_env, fetch_url
from insetu.core.utils_core import execute_binary

_PROVIDER_SEMAPHORES: Dict[Tuple[str, int], threading.BoundedSemaphore] = {}
_SEMAPHORE_LOCK = threading.Lock()
_ANSI_ESCAPE_RE = re.compile(r'\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07')


def get_provider_semaphore(provider: str, max_parallel: int = 4, endpoint_id: str = "") -> threading.BoundedSemaphore:
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


def _validate_http_url(url: str) -> bool:
    """Returns True if `url` uses an explicit http:// or https:// scheme."""
    return str(url or "").strip().lower().startswith(("http://", "https://"))


def _iter_sse_json_events(
    url: str,
    headers: Dict[str, str],
    payload_bytes: bytes,
    timeout: int = 30,
) -> Generator[Dict[str, Any], None, None]:
    """
    Single Source of Truth SSE HTTP streaming transport for LLM drivers:
    Validates the URL scheme, opens the streaming request, and yields parsed JSON `data:` objects until `[DONE]` or EOF.
    """
    if not _validate_http_url(url):
        raise ValueError(f"Invalid endpoint URL scheme: {url}")
    req = urllib.request.Request(url, headers=headers, data=payload_bytes)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        for raw_line in response:
            decoded_line = raw_line.decode("utf-8", errors="replace").strip()
            if not decoded_line or not decoded_line.startswith("data:"):
                continue
            data_str = decoded_line[5:].strip()
            if data_str == "[DONE]":
                break
            try:
                chunk = json.loads(data_str)
                if isinstance(chunk, dict):
                    yield chunk
            except json.JSONDecodeError:
                continue


def _normalize_direct_model_id(model: str, provider_prefix: str) -> str:
    """Strips catalog prefixes (e.g. 'google/', 'anthropic/', 'models/') for direct first-party REST APIs."""
    clean = str(model or "").strip()
    if "::" in clean:
        clean = clean.split("::", 1)[1].strip()
    for pfx in (f"{provider_prefix}/", "models/"):
        if clean.lower().startswith(pfx.lower()):
            clean = clean[len(pfx):].strip()
    return clean


def stream_anthropic(api_key: str, model: str, messages: list, system_prompt: str) -> Generator[str, None, None]:
    clean_model = _normalize_direct_model_id(model, "anthropic")
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
        "content-type": "application/json",
        "accept": "text/event-stream"
    }

    payload = {
        "model": clean_model,
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

    try:
        for chunk in _iter_sse_json_events(url, headers, json.dumps(payload).encode("utf-8"), timeout=30):
            if chunk.get("type") == "content_block_delta":
                text = chunk.get("delta", {}).get("text", "")
                if text:
                    yield f"data: {json.dumps({'text': text})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"


def _gemini_headers(api_key: str) -> Dict[str, str]:
    """Single source of truth for Google Gemini REST headers."""
    return {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }


def run_audio_transcription(
    provider: str,
    api_key: str,
    model: str,
    audio_base64: str,
    mime_type: str = "audio/webm",
    prompt_hint: str = "Transcribe the spoken developer instruction accurately.",
) -> Tuple[Optional[str], Optional[str], int]:
    """Executes multimodal audio transcription via the configured provider driver. Returns (transcript, error, status_code)."""
    if provider != "gemini" or not api_key:
        return None, f"Push-to-talk transcription requires a multimodal provider (e.g. 'gemini'); active provider is '{provider}'.", 400
    clean_model = _normalize_direct_model_id(model, "google")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent"
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": prompt_hint},
                {"inline_data": {"mime_type": mime_type, "data": audio_base64}},
            ],
        }]
    }
    try:
        resp = fetch_url(
            url,
            method="POST",
            headers=_gemini_headers(api_key),
            data=json.dumps(payload).encode("utf-8"),
            timeout=30.0,
        )
        resp_data = resp.json()
        parts = resp_data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        transcript = "".join(p.get("text", "") for p in parts).strip()
        return transcript, None, 200
    except Exception as e:
        return None, f"Audio transcription failed: {str(e)}", 500


def stream_gemini(api_key: str, model: str, messages: list, system_prompt: str) -> Generator[str, None, None]:
    clean_model = _normalize_direct_model_id(model, "google")
    headers = _gemini_headers(api_key)

    # Gemini requires mapping standard roles to 'user' and 'model'
    gemini_messages = []
    for m in messages:
        role = "model" if m["role"] == "assistant" else "user"
        gemini_messages.append({"role": role, "parts": [{"text": m["content"]}]})

    payload = {"contents": gemini_messages}
    if system_prompt:
        payload["system_instruction"] = {"parts": [{"text": system_prompt}]}
    encoded_payload = json.dumps(payload).encode('utf-8')

    candidate_models = [clean_model]
    if clean_model.endswith("-preview"):
        candidate_models.append(clean_model[:-len("-preview")])
    else:
        candidate_models.append(f"{clean_model}-preview")

    last_http_err = None
    for idx, cand_mod in enumerate(candidate_models):
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{cand_mod}:streamGenerateContent?alt=sse"
        try:
            for chunk in _iter_sse_json_events(url, headers, encoded_payload, timeout=30):
                if "candidates" in chunk and chunk["candidates"]:
                    parts = chunk["candidates"][0].get("content", {}).get("parts", [])
                    for part in parts:
                        text = part.get("text", "")
                        if text:
                            yield f"data: {json.dumps({'text': text})}\n\n"
            return
        except urllib.error.HTTPError as he:
            last_http_err = (cand_mod, he)
            if he.code == 404 and idx + 1 < len(candidate_models):
                continue
            break
        except Exception as e:
            gemini_error = f'Gemini API error for model "{cand_mod}": {e}'
            yield f"data: {json.dumps({'error': gemini_error})}\n\n"
            return

    if last_http_err is not None:
        failed_mod, he = last_http_err
        err_body = ""
        try:
            err_body = he.read().decode("utf-8", errors="replace")[:300]
        except Exception:
            pass
        detail = f" ({err_body})" if err_body else ""
        gemini_http_error = f'Gemini API HTTP {he.code} for model "{failed_mod}": {he.reason}{detail}'
        yield f"data: {json.dumps({'error': gemini_http_error})}\n\n"


def stream_openai_compatible(base_url: str, api_key: str, model: str, messages: list, system_prompt: str) -> Generator[str, None, None]:
    """Streams inference from any OpenAI-compatible /v1/chat/completions endpoint (Ollama, LM Studio, vLLM, llama.cpp, OpenAI)."""
    clean_base = (base_url or "http://127.0.0.1:11434/v1").strip().rstrip("/")
    if not _validate_http_url(clean_base):
        yield f"data: {json.dumps({'error': f'Invalid endpoint URL scheme: {clean_base}'})}\n\n"
        return
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

    try:
        for chunk in _iter_sse_json_events(url, headers, json.dumps(payload).encode("utf-8"), timeout=120):
            choices = chunk.get("choices") or []
            if choices:
                delta = choices[0].get("delta") or {}
                text = delta.get("content") or ""
                if text:
                    yield f"data: {json.dumps({'text': text})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': f'OpenAI-compatible endpoint error ({url}): {str(e)}'})}\n\n"


def stream_claude_cli(model: str, messages: list, system_prompt: str) -> Generator[str, None, None]:
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


def run_decisions_inference(
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
    try:
        resp = fetch_url(
            url,
            method="POST",
            headers=headers,
            data=json.dumps(payload).encode("utf-8"),
            timeout=20.0,
            allow_private=True,
        )
        resp_data = resp.json()
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


def run_single_inference(
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
    sem = get_provider_semaphore(provider, max_parallel=max_parallel, endpoint_id=endpoint_id)
    with sem:
        if is_decision_model:
            return run_decisions_inference(
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
            stream_gen = stream_anthropic(api_key, model, messages, system_prompt)
        elif provider == "gemini":
            stream_gen = stream_gemini(api_key, model, messages, system_prompt)
        elif provider in ("openai_compatible", "openrouter"):
            stream_gen = stream_openai_compatible(base_url, api_key, model, messages, system_prompt)
        elif provider == "claude_cli":
            stream_gen = stream_claude_cli(model, messages, system_prompt)
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
