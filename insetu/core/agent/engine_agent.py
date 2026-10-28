import time
import uuid
import json
import threading
from typing import TypedDict, List, Dict, Any, Optional
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import parse_blocks
from .orchestrator import (
    execute_declarative_routine,
    list_available_routines,
    load_routine_definition,
    resolve_routine_mode,
)

AGENT_SCHEMA = {
    "chat_sessions": {
        "session_id": "TEXT PRIMARY KEY",
        "title": "TEXT",
        "updated_at": "REAL",
        "last_transaction_id": "TEXT",
        "active_job_id": "TEXT"
    },
    "chat_messages": {
        "message_id": "TEXT PRIMARY KEY",
        "session_id": "TEXT",
        "role": "TEXT",
        "content": "TEXT",
        "timestamp": "REAL"
    }
}

_CANCELLED_SESSIONS = set()
_CANCEL_LOCK = threading.Lock()

agent_bp = InSetuExtension(
    'agent',
    __name__,
    title="Agent Harness",
    description="Autonomous LLM agent and declarative YAML routine orchestrator.",
    core=True,
    schema=AGENT_SCHEMA
)
__depends__ = ['llm', 'gather', 'bridge']


class ChatSessionPayload(TypedDict):
    title: str


class ChatPromptPayload(TypedDict, total=False):
    session_id: str
    prompt: str
    mode: str
    attached_files: List[str]
    read_only_files: List[str]
    routine_id: str


class AgentSessionActionPayload(TypedDict, total=False):
    session_id: str
    transaction_id: str
def _parse_slash_command(raw_prompt: str, explicit_mode: Optional[str] = None, routine: Optional[Dict[str, Any]] = None):
    """Parses leading slash commands (/code, /plan, /ask, /yomama, /auto, /undo) from the user prompt."""
    text = (raw_prompt or "").strip()
    fallback_mode = (explicit_mode or "auto").strip().lower().lstrip("/")
    if text.startswith("/"):
        first_token, _, rest = text.partition(" ")
        cmd = first_token[1:].lower()
        if cmd == "undo":
            return "undo", rest.strip()
        if routine and cmd in (routine.get("modes") or {}):
            return cmd, rest.strip() or text
        if cmd in ("code", "plan", "ask", "yomama", "auto"):
            return cmd, rest.strip() or text
    if routine:
        canon_mode, _, _ = resolve_routine_mode(routine, fallback_mode)
        return canon_mode, text
    return fallback_mode if fallback_mode in ("code", "plan", "ask", "yomama", "auto") else "auto", text


@agent_bp.route('routines', methods=['GET'], docstring="[sync] Lists all available declarative YAML agent routines and their supported slash modes.")
def get_routines(ctx):
    return {"routines": list_available_routines(ctx)}
@agent_bp.route('sessions', methods=['GET'], docstring="[sync] Retrieves all chat sessions for the active workspace.")
def get_sessions(ctx):
    rows = ctx.db.get_all("chat_sessions", order_by="updated_at DESC")
    return {"sessions": rows}

@agent_bp.route('sessions', methods=['POST'], request_schema=ChatSessionPayload, docstring="[sync] Creates a new chat session.")
def create_session(ctx):
    data = ctx.payload or {}
    session_id = f"ses_{uuid.uuid4().hex[:12]}"
    title = data.get("title", "New Conversation")

    ctx.db.insert_or_replace("chat_sessions", {
        "session_id": session_id,
        "title": title,
        "updated_at": time.time()
    })
    return {"status": "success", "session_id": session_id}

@agent_bp.route('messages/<session_id>', methods=['GET'], docstring="[sync] Retrieves message history for a specific chat session.")
def get_messages(ctx, session_id):
    cursor = ctx.db.execute("SELECT * FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC", (session_id,))
    messages = [dict(r) for r in cursor.fetchall()]
    return {"messages": messages}
@agent_bp.route('cancel', methods=['POST'], request_schema=AgentSessionActionPayload, docstring="[sync] Signals an active agent turn to abort before the next LLM call or VFS mutation.")
def cancel_agent_turn(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    if not session_id:
        return {"error": "session_id is required"}, 400
    with _CANCEL_LOCK:
        _CANCELLED_SESSIONS.add((ctx.workspace_id, session_id))
    row = ctx.db.get_by_id("chat_sessions", session_id, id_col="session_id")
    if row and row.get("active_job_id"):
        from insetu.core.sdk import get_connection as _get_conn
        w_conn = _get_conn("workers", workspace_id=ctx.workspace_id)
        w_conn.execute(
            "UPDATE immediate_jobs SET status='failed', status_message='Cancelled by user.' WHERE id=?",
            (row["active_job_id"],),
        )
        w_conn.commit()
    return {"status": "cancelled", "session_id": session_id}


@agent_bp.route('undo', methods=['POST'], request_schema=AgentSessionActionPayload, docstring="[sync] Reverts the most recent Yomama Bridge transaction for this chat session.")
def undo_last_agent_turn(ctx):
    data = ctx.payload or {}
    session_id = str(data.get("session_id") or "").strip()
    tx_id = str(data.get("transaction_id") or "").strip()
    if not tx_id and session_id:
        row = ctx.db.get_by_id("chat_sessions", session_id, id_col="session_id")
        if row:
            tx_id = row.get("last_transaction_id") or ""
    if not tx_id:
        return {"error": "No recorded transaction found to undo for this session."}, 404

    rev_res = ctx.call("bridge.revert", transaction_id=tx_id, target_state="initial", wait=True)
    if session_id:
        now = time.time()
        ctx.db.insert_or_replace("chat_messages", {
            "message_id": f"msg_{uuid.uuid4().hex[:12]}",
            "session_id": session_id,
            "role": "assistant",
            "content": f"⏪ Reverted transaction `{tx_id}`: {rev_res.get('message', 'Files restored.')}",
            "timestamp": now,
        })
        ctx.db.execute("UPDATE chat_sessions SET last_transaction_id=NULL, updated_at=? WHERE session_id=?", (now, session_id))
        ctx.db.commit()
    return {"status": "success", "transaction_id": tx_id, "revert": rev_res}


@agent_bp.route('prompt', methods=['POST'], request_schema=ChatPromptPayload, docstring="Dispatches a new user prompt into the background declarative agent worker chain.")
def submit_prompt(ctx):
    data = ctx.payload or {}
    session_id = data.get("session_id")
    raw_prompt = str(data.get("prompt") or "").strip()
    attached_files = data.get("attached_files", [])
    read_only_files = data.get("read_only_files", [])
    routine_id = str(data.get("routine_id") or "workspace_turn").strip()

    if not session_id or not raw_prompt:
        return {"error": "session_id and prompt are required"}, 400
    try:
        routine_def = load_routine_definition(ctx, routine_id)
    except Exception:
        routine_def = None
    resolved_mode, clean_prompt = _parse_slash_command(raw_prompt, data.get("mode"), routine=routine_def)
    if resolved_mode == "undo":
        return undo_last_agent_turn(ctx)

    with _CANCEL_LOCK:
        _CANCELLED_SESSIONS.discard((ctx.workspace_id, session_id))

    now = time.time()
    user_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    ctx.db.insert_or_replace("chat_messages", {
        "message_id": user_msg_id,
        "session_id": session_id,
        "role": "user",
        "content": raw_prompt,
        "timestamp": now,
    })
    job_id = ctx.jobs.submit(
        "agent_turn_task",
        job_category="ui_blocking",
        session_id=session_id,
        user_prompt=clean_prompt,
        mode=resolved_mode,
        attached_files=attached_files,
        read_only_files=read_only_files,
        routine_id=routine_id,
        retry_count=0,
    )
    ctx.db.execute(
        "UPDATE chat_sessions SET updated_at=?, active_job_id=? WHERE session_id=?",
        (now, job_id, session_id),
    )
    ctx.db.commit()

    return {"status": "accepted", "job_id": job_id, "message_id": user_msg_id, "mode": resolved_mode}, 202


@agent_bp.worker("agent_turn_task")
def _execute_agent_turn(
    ctx,
    job_id: Optional[str] = None,
    session_id: Optional[str] = None,
    user_prompt: str = "",
    mode: str = "auto",
    attached_files: Optional[List[str]] = None,
    read_only_files: Optional[List[str]] = None,
    routine_id: str = "workspace_turn",
    retry_count: int = 0,
):
    cursor = ctx.db.execute(
        "SELECT role, content FROM chat_messages WHERE session_id=? ORDER BY timestamp ASC",
        (session_id,),
    )
    history_messages = [{"role": r["role"], "content": r["content"]} for r in cursor.fetchall()]
    if not history_messages and user_prompt:
        history_messages = [{"role": "user", "content": user_prompt}]

    def _is_cancelled() -> bool:
        with _CANCEL_LOCK:
            return (ctx.workspace_id, session_id) in _CANCELLED_SESSIONS

    routine_result = execute_declarative_routine(
        ctx,
        session_id=session_id or "default",
        user_prompt=user_prompt,
        mode=mode,
        attached_files=attached_files or [],
        read_only_files=read_only_files or [],
        history_messages=history_messages,
        routine_id=routine_id,
        is_cancelled_fn=_is_cancelled,
    )

    full_response = routine_result.get("response") or ""
    tx_id = routine_result.get("transaction_id")
    asst_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = time.time()
    ctx.db.insert_or_replace("chat_messages", {
        "message_id": asst_msg_id,
        "session_id": session_id,
        "role": "assistant",
        "content": full_response,
        "timestamp": now,
    })
    if tx_id:
        ctx.db.execute(
            "UPDATE chat_sessions SET last_transaction_id=?, active_job_id=NULL, updated_at=? WHERE session_id=?",
            (tx_id, now, session_id),
        )
    else:
        ctx.db.execute(
            "UPDATE chat_sessions SET active_job_id=NULL, updated_at=? WHERE session_id=?",
            (now, session_id),
        )
    ctx.db.commit()

    return {
        "message": "Turn complete.",
        "artifact": {
            "message_id": asst_msg_id,
            "response": full_response,
            "mode": routine_result.get("mode", mode),
            "effective_intent": routine_result.get("effective_intent"),
            "transaction_id": tx_id,
        },
    }