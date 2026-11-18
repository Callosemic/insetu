"""Colon-scoped slash command tokenizer and mode resolver extracted from envelope.py (Sprint A2.0)."""
from typing import Any, Dict, Optional, Tuple

from insetu.core.agent.routine_loader import resolve_routine_mode


def parse_colon_command_tokens(raw_prompt: str) -> Dict[str, str]:
    """Parses universal colon-scoped slash commands (/code, /upkeep:docs, /upkeep:docs:apply, /user:upkeep:docs)."""
    text = (raw_prompt or "").strip()
    if not text.startswith("/"):
        return {"namespace": "", "target": "", "scope": "", "stage": "", "rest": text}
    first_token, _, rest = text.partition(" ")
    parts = [p.strip().lower() for p in first_token[1:].split(":") if p.strip()]
    if not parts:
        return {"namespace": "", "target": "", "scope": "", "stage": "", "rest": rest.strip()}
    namespace = "user" if parts[0] == "user" else ""
    if namespace:
        parts = parts[1:]
    target = parts[0] if parts else ""
    stage, scope = "", ""
    for seg in parts[1:]:
        if seg in ("apply", "execute", "commit"):
            stage = "apply"
        elif seg in ("audit", "plan", "propose"):
            stage = "audit"
        elif not scope:
            scope = seg
    return {"namespace": namespace, "target": target, "scope": scope, "stage": stage, "rest": rest.strip()}


def parse_slash_command(
    raw_prompt: str,
    explicit_mode: Optional[str] = None,
    routine: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """Parses leading colon-scoped slash commands (/code, /plan, /ask, /yomama, /upkeep:docs, /user:<id>:<scope>, /undo)."""
    text = (raw_prompt or "").strip()
    fallback_mode = (explicit_mode or "auto").strip().lower().lstrip("/")
    if text.startswith("/"):
        parsed_tok = parse_colon_command_tokens(text)
        target, rest = parsed_tok["target"], parsed_tok["rest"]
        if target == "undo":
            return "undo", rest
        if parsed_tok["namespace"] == "user":
            return (target or "auto"), (rest or target or text)
        if routine and (
            target in (routine.get("modes") or {})
            or target == str(routine.get("id") or "").lower()
            or f"/{target}" == str(routine.get("slash_command") or "").lower()
        ):
            return target, (rest or target or text)
        if target in ("code", "plan", "ask", "yomama", "auto"):
            return target, (rest or text)
    if routine:
        canon_mode, _, _ = resolve_routine_mode(routine, fallback_mode)
        return canon_mode, text
    return (fallback_mode if fallback_mode in ("code", "plan", "ask", "yomama", "auto") else "auto"), text
