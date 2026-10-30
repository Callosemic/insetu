"""
insetu.core.agent.schemas
~~~~~~~~~~~~~~~~~~~~~~~~
Central Zero-Dependency Formal Response Schema Registry.
Provides prompt directive generators and strict runtime validators for all
inSetu structured LLM outputs and YAML DAG node argument contracts.
"""

import json
import re
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

from insetu.core.utils_core import parse_blocks
from .plan import (
    PlanDocument,
    PlanSprint,
    PlanTask,
    get_plan_schema_directive,
    parse_plan_markdown,
    serialize_plan_markdown,
    validate_plan_response,
)
from .rag import (
    ContextSliceReference,
    ContextSliceSchema,
    MacroScoutSchema,
    get_context_slice_directive,
    get_macro_scout_directive,
    strip_markdown_fences as _strip_markdown_fences,
    validate_context_slice_response,
    validate_macro_scout_response,
)
from .diagnostics import (
    TestDiagnosticSchema,
    TestFailureItem,
    get_test_diagnostic_directive,
    parse_junit_xml,
    parse_test_tail_output,
    validate_test_diagnostic_response,
)

VALID_INTENTS = (
    "EDIT_CODE",
    "SURGICAL_CODE",
    "IMPLEMENT_PLAN",
    "EDIT_PLAN",
    "CHAT_ONLY",
    "BUGFIX",
    "REFACTOR",
    "RUN_TESTS",
    "AUDIT_DIFFS",
    "CLOSE_SESSION",
    "APPLY_PATCH",
)

_SCHEMA_REGISTRY: Dict[str, Tuple[Callable[[], str], Callable[[str], Tuple[bool, Any, str]]]] = {}


def register_schema(
    name: str,
    directive_fn: Callable[[], str],
    validator_fn: Callable[[str], Tuple[bool, Any, str]],
) -> None:
    """Registers a formal response schema contract."""
    clean_name = str(name).strip().lower()
    _SCHEMA_REGISTRY[clean_name] = (directive_fn, validator_fn)


def list_registered_schemas() -> List[str]:
    """Returns a sorted list of registered schema contract identifiers."""
    return sorted(_SCHEMA_REGISTRY.keys())


def get_schema_directive(schema_name: str) -> str:
    """Returns the prompt instruction directive for the requested schema."""
    clean = str(schema_name or "").strip().lower()
    entry = _SCHEMA_REGISTRY.get(clean)
    if entry:
        return entry[0]()
    return ""


def validate_schema_response(
    schema_spec: Union[str, Dict[str, Any]],
    raw_text: str,
) -> Tuple[bool, Any, str]:
    """
    Validates LLM output against a named registered contract or a JSON Schema dictionary.
    Returns (is_valid, parsed_value, error_message).
    """
    if not schema_spec:
        return True, raw_text, ""

    if isinstance(schema_spec, dict):
        return _validate_adhoc_json_schema(raw_text, schema_spec)

    clean_name = str(schema_spec).strip().lower()
    entry = _SCHEMA_REGISTRY.get(clean_name)
    if entry:
        return entry[1](raw_text)

    # Fallback to general JSON parse
    if clean_name == "json":
        return _validate_generic_json(raw_text)

    return True, raw_text, ""


def _validate_generic_json(raw_text: str) -> Tuple[bool, Any, str]:
    cleaned = _strip_markdown_fences(raw_text)
    try:
        return True, json.loads(cleaned), ""
    except json.JSONDecodeError as e:
        return False, None, f"Invalid JSON output: {e}"


def _validate_adhoc_json_schema(raw_text: str, schema_dict: Dict[str, Any]) -> Tuple[bool, Any, str]:
    ok, parsed, err = _validate_generic_json(raw_text)
    if not ok:
        return False, None, err
    if isinstance(parsed, dict):
        req_keys = schema_dict.get("required") or []
        missing = [k for k in req_keys if k not in parsed]
        if missing:
            return False, None, f"JSON object missing required keys: {', '.join(missing)}"
    return True, parsed, ""


# --- Built-in Contract: intent_classification ---

def _directive_intent_classification() -> str:
    valid_str = " | ".join(f'"{i}"' for i in VALID_INTENTS[:5])
    return f'Respond ONLY with valid JSON: {{"intent": {valid_str}}}'


def _validate_intent_classification(raw_text: str) -> Tuple[bool, Any, str]:
    cleaned = _strip_markdown_fences(raw_text)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and parsed.get("intent") in VALID_INTENTS:
            return True, parsed, ""
    except Exception:
        pass
    upper = (raw_text or "").upper()
    for token in VALID_INTENTS:
        if token in upper:
            return True, {"intent": token}, ""
    return False, None, f"Response must specify a valid intent ({', '.join(VALID_INTENTS[:5])})."


# --- Built-in Contract: yomama_patch ---

def _directive_yomama_patch() -> str:
    return (
        "Provide all file modifications strictly as Yomama patch blocks inside a text code block:\n"
        "```text\n"
        "<<<<<<< FILE: vfs://repo/path/to/file.ext\n"
        "<<<<<<< SEARCH\n"
        "[exact lines to match, with 1-2 lines of top/bottom context]\n"
        "=======\n"
        "[replacement lines]\n"
        ">>>>>>> REPLACE\n"
        "```"
    )


def _validate_yomama_patch(raw_text: str) -> Tuple[bool, Any, str]:
    blocks = parse_blocks(raw_text or "")
    if not blocks:
        return False, None, "Response did not contain any valid Yomama patch blocks."
    return True, blocks, ""


# --- Built-in Contract: conversational_with_patches ---

def _directive_conversational_with_patches() -> str:
    return (
        "Provide your conversational explanation first. If modifying files, append structured "
        "Yomama patch blocks (<<<<<<< FILE: ... >>>>>>> REPLACE) at the end."
    )


_QUERY_CONTEXT_RE = re.compile(
    r'<<<<<<< QUERY_CONTEXT[ \t]*\r?\n([\s\S]*?)>>>>>>> (?:EXECUTE|REPLACE)',
    re.MULTILINE,
)


def extract_query_context_directives(raw_text: str) -> List[str]:
    """Extracts bounded <<<<<<< QUERY_CONTEXT read directives from an LLM response."""
    if not raw_text or "<<<<<<< QUERY_CONTEXT" not in raw_text:
        return []
    return [m.group(1).strip() for m in _QUERY_CONTEXT_RE.finditer(raw_text) if m.group(1).strip()]


def _validate_conversational_with_patches(raw_text: str) -> Tuple[bool, Any, str]:
    text_val = raw_text or ""
    query_directives = extract_query_context_directives(text_val)
    has_marker = any(
        m in text_val
        for m in (
            "<<<<<<< FILE:",
            "<<<<<<< SEARCH",
            "<<<<<<< TEXTEDIT",
            "<<<<<<< JSON_PATCH",
            "<<<<<<< RELOCATE",
            "<<<<<<< RENAME",
            "<<<<<<< MOVE_FILE",
            "<<<<<<< ARCHIVE_FILE",
            "<<<<<<< DELETE_FILE",
        )
    )
    if not has_marker:
        return True, {
            "has_patches": False,
            "blocks": {},
            "has_query_context": bool(query_directives),
            "query_directives": query_directives,
        }, ""
    blocks = parse_blocks(text_val)
    if not blocks:
        return False, None, "Found '<<<<<<<' patch markers, but failed to parse valid Yomama blocks."
    return True, {
        "has_patches": True,
        "blocks": blocks,
        "has_query_context": bool(query_directives),
        "query_directives": query_directives,
    }, ""


# --- Built-in Contract: debt_ratchet_verdict ---

def _directive_debt_ratchet() -> str:
    return 'Respond ONLY with JSON: {"verdict": "CLEAN" | "REFACTOR", "summary": "brief rationale"}'


def _validate_debt_ratchet(raw_text: str) -> Tuple[bool, Any, str]:
    cleaned = _strip_markdown_fences(raw_text)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and parsed.get("verdict") in ("CLEAN", "REFACTOR"):
            return True, parsed, ""
    except Exception:
        pass
    blocks = parse_blocks(raw_text or "")
    if blocks:
        return True, {"verdict": "REFACTOR", "patch": raw_text, "has_patches": True}, ""
    return True, {"verdict": "CLEAN", "summary": (raw_text or "").strip()}, ""


def _directive_ask_response_or_need_files() -> str:
    return 'Respond with your answer, or JSON {"status": "NEED_MORE_FILES", "requested_files": ["vfs://..."]} if additional files are needed.'


def _validate_ask_response_or_need_files(raw_text: str) -> Tuple[bool, Any, str]:
    cleaned = _strip_markdown_fences(raw_text)
    if cleaned.startswith("{") and "NEED_MORE_FILES" in cleaned:
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict) and parsed.get("status") == "NEED_MORE_FILES":
                req_files = parsed.get("requested_files") or []
                return True, {"status": "NEED_MORE_FILES", "requested_files": list(req_files)}, ""
        except Exception:
            pass
    return True, {"status": "ANSWER_READY", "requested_files": []}, ""


# Register foundational schema contracts
register_schema("ask_response_or_need_files", _directive_ask_response_or_need_files, _validate_ask_response_or_need_files)
register_schema("intent_classification", _directive_intent_classification, _validate_intent_classification)
register_schema("yomama_patch", _directive_yomama_patch, _validate_yomama_patch)
register_schema("conversational_with_patches", _directive_conversational_with_patches, _validate_conversational_with_patches)
register_schema("debt_ratchet_verdict", _directive_debt_ratchet, _validate_debt_ratchet)
register_schema("macro_scout", get_macro_scout_directive, validate_macro_scout_response)
register_schema("context_slice", get_context_slice_directive, validate_context_slice_response)
register_schema("insetu_plan", get_plan_schema_directive, validate_plan_response)
register_schema("plan", get_plan_schema_directive, validate_plan_response)
register_schema("test_diagnostic", get_test_diagnostic_directive, validate_test_diagnostic_response)
register_schema("json", lambda: 'Respond ONLY with valid JSON.', _validate_generic_json)

__all__ = [
    "register_schema",
    "list_registered_schemas",
    "get_schema_directive",
    "validate_schema_response",
    "PlanDocument",
    "PlanSprint",
    "PlanTask",
    "parse_plan_markdown",
    "serialize_plan_markdown",
    "MacroScoutSchema",
    "ContextSliceSchema",
    "ContextSliceReference",
    "TestDiagnosticSchema",
    "TestFailureItem",
    "parse_junit_xml",
    "parse_test_tail_output",
]
