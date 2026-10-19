import time
import uuid
import json
from typing import TypedDict, List, Dict, Any
from flask import jsonify
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import parse_blocks

AGENT_SCHEMA = {
    "chat_sessions": {
        "session_id": "TEXT PRIMARY KEY",
        "title": "TEXT",
        "updated_at": "REAL"
    },
    "chat_messages": {
        "message_id": "TEXT PRIMARY KEY",
        "session_id": "TEXT",
        "role": "TEXT",
        "content": "TEXT",
        "timestamp": "REAL"
    }
}

agent_bp = InSetuExtension(
    'agent',
    __name__,
    title="Agent Harness",
    description="Autonomous LLM agent and chat orchestrator.",
    core=True,
    schema=AGENT_SCHEMA
)
__depends__ = ['llm', 'gather', 'bridge']
class ChatSessionPayload(TypedDict):
    title: str

class ChatPromptPayload(TypedDict):
    session_id: str
    prompt: str
    attached_files: List[str]

@agent_bp.route('sessions', methods=['GET'], docstring="[sync] Retrieves all chat sessions for the active workspace.")
def get_sessions(ctx):
    rows = ctx.db.get_all("chat_sessions", order_by="updated_at DESC")
    return jsonify({"sessions": rows})

@agent_bp.route('sessions', methods=['POST'], request_schema=ChatSessionPayload, docstring="[sync] Creates a new chat session.")
def create_session(ctx):
    data = ctx.req.json or {}
    session_id = f"ses_{uuid.uuid4().hex[:12]}"
    title = data.get("title", "New Conversation")

    ctx.db.insert_or_replace("chat_sessions", {
        "session_id": session_id,
        "title": title,
        "updated_at": time.time()
    })
    return jsonify({"status": "success", "session_id": session_id})

@agent_bp.route('messages/<session_id>', methods=['GET'], docstring="[sync] Retrieves message history for a specific chat session.")
def get_messages(ctx, session_id):
    cursor = ctx.db.execute("SELECT * FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC", (session_id,))
    messages = [dict(r) for r in cursor.fetchall()]
    return jsonify({"messages": messages})

@agent_bp.route('prompt', methods=['POST'], request_schema=ChatPromptPayload, docstring="Dispatches a new user prompt into the background ReAct agent worker chain.")
def submit_prompt(ctx):
    data = ctx.req.json or {}
    session_id = data.get("session_id")
    prompt = data.get("prompt", "").strip()
    attached_files = data.get("attached_files", [])

    if not session_id or not prompt:
        return jsonify({"error": "session_id and prompt are required"}), 400

    now = time.time()
    user_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    ctx.db.insert_or_replace("chat_messages", {
        "message_id": user_msg_id,
        "session_id": session_id,
        "role": "user",
        "content": prompt,
        "timestamp": now
    })
    ctx.db.execute("UPDATE chat_sessions SET updated_at=? WHERE session_id=?", (now, session_id))
    ctx.db.commit()
    job_id = ctx.jobs.submit(
        "agent_turn_task",
        job_category="ui_blocking",
        session_id=session_id,
        user_prompt=prompt,
        attached_files=attached_files,
        retry_count=0
    )

    return jsonify({"status": "accepted", "job_id": job_id, "message_id": user_msg_id}), 202
@agent_bp.worker("agent_turn_task")
def _execute_agent_turn(ctx, job_id=None, session_id=None, user_prompt="", attached_files=None, retry_count=0, **kwargs):
    from insetu.core.llm.engine_llm import (
        llm_bp as _llm_bp,
        _stream_anthropic as __stream_anthropic,
        _stream_gemini as __stream_gemini,
        _stream_claude_cli as __stream_claude_cli
    )
    from insetu.core.bridge.bridge_vfs import execute_bridge_sync as _execute_bridge_sync

    workspace_id = ctx.workspace_id
    attached_files = attached_files or []

    # --- Phase 1: Context Assembly (Gather) ---
    ctx.jobs.update_progress("Phase 1/4: Assembling workspace context...")
    context_text = ""
    if attached_files:
        from insetu.core.gather.engine_gather import _pack_selection_worker as __pack_selection_worker
        pack_res = __pack_selection_worker(ctx, items=[{"filepath": f} for f in attached_files], gather_only=True)
        base_filename = pack_res.get("artifact", {}).get("base_filename")
        if base_filename:
            context_text = ctx.vfs.read(base_filename) or ""

    # --- Phase 2: Inference Stream (LLM Gateway) ---
    ctx.jobs.update_progress("Phase 2/4: Generating solution with LLM...")

    # Retrieve past messages for session memory
    cursor = ctx.db.execute("SELECT role, content FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC", (session_id,))
    history_messages = [{"role": r["role"], "content": r["content"]} for r in cursor.fetchall()]

    system_prompt = (
        "You are the inSetu AI Developer OS Agent. You assist with codebase modifications.\n"
        "To modify code, provide structured Yomama patch blocks strictly formatted as:\n\n"
        "<<<<<<< FILE: relative/path/to/file.ext\n"
        "<<<<<<< SEARCH\n"
        "[exact lines to match]\n"
        "=======\n"
        "[replacement lines]\n"
        ">>>>>>> REPLACE\n\n"
        "Leave SEARCH blank for new files."
    )
    if context_text:
        system_prompt += f"\n\n--- WORKSPACE CONTEXT ---\n{context_text}"
    llm_ctx = _llm_bp.get_context(ctx.workspace_id)
    provider = llm_ctx.settings.get("provider", "anthropic")
    model = llm_ctx.settings.get("model", "claude-3-5-sonnet-latest")
    api_key = llm_ctx.settings.get("api_key", "")

    full_response = ""
    try:
        stream_gen = None
        if provider == "anthropic":
            stream_gen = __stream_anthropic(api_key, model, history_messages, system_prompt)
        elif provider == "gemini":
            stream_gen = __stream_gemini(api_key, model, history_messages, system_prompt)
        elif provider == "claude_cli":
            stream_gen = __stream_claude_cli(model, history_messages, system_prompt)

        if stream_gen:
            for sse_line in stream_gen:
                if sse_line.startswith("data: "):
                    data_str = sse_line[6:].strip()
                    if data_str == "[DONE]": break
                    try:
                        chunk_obj = json.loads(data_str)
                        if "text" in chunk_obj:
                            full_response += chunk_obj["text"]
                            ctx.jobs.update_progress(full_response)
                        elif "error" in chunk_obj:
                            raise RuntimeError(chunk_obj["error"])
                    except json.JSONDecodeError:
                        continue
    except Exception as e:
        raise RuntimeError(f"LLM Generation Error: {str(e)}")

    # --- Phase 3: Patch Application & Verification (Yomama Bridge) ---
    if "<<<<<<< FILE:" in full_response:
        ctx.jobs.update_progress("Phase 3/4: Applying patches and validating syntax...")
        # Parse targets for Bridge
        parsed = parse_blocks(full_response)
        target_files = list(parsed.keys())

        sync_payload = {
            "text": full_response,
            "active_files": target_files,
            "dry_run": False
        }

        bridge_raw = _execute_bridge_sync(workspace_id, sync_payload)
        bridge_res = json.loads(bridge_raw)

        if not bridge_res.get("can_commit"):
            # Self-Healing Retry Loop (Up to 3 retries)
            if retry_count < 3:
                err_details = "\n".join([p.get("error_message", "") for p in bridge_res.get("patches", []) if p.get("error_message")])
                ctx.jobs.update_progress(f"Phase 4/4: Patch verification failed. Retrying self-correction ({retry_count + 1}/3)...")

                # Append error feedback into conversation history
                ctx.db.insert_or_replace("chat_messages", {
                    "message_id": f"msg_{uuid.uuid4().hex[:12]}",
                    "session_id": session_id,
                    "role": "assistant",
                    "content": full_response,
                    "timestamp": time.time()
                })
                ctx.db.insert_or_replace("chat_messages", {
                    "message_id": f"msg_{uuid.uuid4().hex[:12]}",
                    "session_id": session_id,
                    "role": "user",
                    "content": f"[SYSTEM ERROR FEEDBACK]: Your previous patch failed with:\n{err_details}\nPlease fix the SEARCH block and re-generate.",
                    "timestamp": time.time()
                })
                ctx.db.commit()
                # Re-queue turn with incremented retry count
                return _execute_agent_turn(ctx, job_id=job_id, session_id=session_id, user_prompt=user_prompt, attached_files=attached_files, retry_count=retry_count+1)
            else:
                full_response += f"\n\n⚠️ **Patch Verification Failed After 3 Retries:**\n```\n{bridge_raw}\n```"

    # Save Assistant Response to Session
    asst_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    ctx.db.insert_or_replace("chat_messages", {
        "message_id": asst_msg_id,
        "session_id": session_id,
        "role": "assistant",
        "content": full_response,
        "timestamp": time.time()
    })
    ctx.db.commit()

    return {"message": "Turn complete.", "artifact": {"message_id": asst_msg_id, "response": full_response}}