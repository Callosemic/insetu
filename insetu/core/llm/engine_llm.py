import os
import json
import urllib.request
import subprocess
from typing import TypedDict, List, Dict, Any, Generator
from flask import jsonify, Response, stream_with_context
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import execute_binary

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
            {"value": "claude_cli", "label": "⚠️ Claude CLI (Experimental Subscription Hack)"}
        ],
        "description": "Select the active inference engine. The Claude CLI option bypasses the API via local binary execution but may block or drop streams if Anthropic prompts for authentication."
    },
    {
        "id": "model",
        "label": "Model Name",
        "type": "text",
        "scope": "workspace",
        "default": "claude-3-5-sonnet-latest",
        "description": "Target model identifier (e.g., claude-3-5-sonnet-latest, gemini-2.5-pro)."
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

class ChatCompletionPayload(TypedDict):
    messages: List[ChatMessage]
    system: str

def _stream_anthropic(api_key: str, model: str, messages: list, system_prompt: str) -> Generator[str, None, None]:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
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
        payload["system"] = system_prompt

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

def _stream_claude_cli(model: str, messages: list, system_prompt: str) -> Generator[str, None, None]:
    """Experimental pseudo-TTY wrapper for the Claude CLI tool."""
    # Collapse historical context into a single string to feed the CLI
    full_prompt = ""
    if system_prompt:
        full_prompt += f"System: {system_prompt}\n\n"
    for m in messages:
        full_prompt += f"{m['role'].upper()}:\n{m['content']}\n\n"

    try:
        # Utilizing execute_binary ensures cross-platform PATH resolution
        process = subprocess.Popen(
            ["claude", "-p", full_prompt],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        for line in iter(process.stdout.readline, ''):
            if line:
                yield f"data: {json.dumps({'text': line})}\n\n"
        
        process.stdout.close()
        process.wait()
        
        if process.returncode != 0:
            yield f"data: {json.dumps({'error': f'Claude CLI exited with code {process.returncode}'})}\n\n"
            
    except Exception as e:
        yield f"data: {json.dumps({'error': f'Failed to execute Claude CLI: {str(e)}'})}\n\n"

@llm_bp.route('chat/completions', methods=['POST'], request_schema=ChatCompletionPayload, docstring="Streams LLM inference utilizing the configured workspace provider.")
def api_chat_completions(ctx):
    data = ctx.req.json or {}
    messages = data.get("messages", [])
    system_prompt = data.get("system", "")

    provider = ctx.settings.get("provider", "anthropic")
    model = ctx.settings.get("model", "claude-3-5-sonnet-latest")
    api_key = ctx.settings.get("api_key", "")

    if provider in ["anthropic", "gemini"] and not api_key:
        return jsonify({"error": f"API key is missing for provider '{provider}'. Please update your Workspace Configuration."}), 400

    def generate():
        if provider == "anthropic":
            yield from _stream_anthropic(api_key, model, messages, system_prompt)
        elif provider == "gemini":
            yield from _stream_gemini(api_key, model, messages, system_prompt)
        elif provider == "claude_cli":
            yield from _stream_claude_cli(model, messages, system_prompt)
        else:
            yield f"data: {json.dumps({'error': f'Unknown provider: {provider}'})}\n\n"
            
        yield "data: [DONE]\n\n"

    return Response(stream_with_context(generate()), content_type='text/event-stream')