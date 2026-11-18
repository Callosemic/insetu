"""
Routine check: reports every routine whose prompts do not resolve, so a routine pointing at a moved or deleted prompt
shows up in Routine Studio instead of running with an empty prompt.

It resolves prompts through the same functions a run uses (`read_prompt_with_cascade`, `resolve_prompt_text`), so a
routine the check passes resolves the same way at run time.
"""
import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from insetu.core.agent.orchestrator import ROUTINE_BANNED_CAPABILITIES
from insetu.core.agent.routine_loader import load_routine_definition
from insetu.core.prompts.engine_prompts import read_prompt_with_cascade, resolve_prompt_text
from insetu.core.sdk import is_routine_banned_capability
from insetu.core.utils_core import BoundedCache, InSetuURI, get_sister_repos

_MISSING_INCLUDE = re.compile(r"\[!\] MACRO TARGET NOT FOUND: (\S+)")
_DASHES_ONLY = re.compile(r"[-\s]+")
_NODE_FIELD_REF_RE = re.compile(r"\bnodes\.([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_]+)\b")
_GENERIC_EXEC_ENVELOPE_KEYS = frozenset({"result", "status", "error", "message", "artifact"})
# Results of the last check per (workspace, routine), keyed by summary fingerprint and expiring after 30s.
# Dropped when any Markdown or YAML file is saved in the workspace, and purged automatically on akasa.reset_state().
PROBLEMS_CACHE_SECONDS = 600.0
_PROBLEMS_CACHE = BoundedCache("routine_problems", max_entries=256, ttl=PROBLEMS_CACHE_SECONDS)


def _finding(severity: str, code: str, node_id: Optional[str], uri: Optional[str], message: str) -> Dict[str, Any]:
    """One problem with a routine: `error` stops a run, `warning` runs but probably not as intended."""
    return {"severity": severity, "code": code, "node": node_id, "uri": uri, "message": message}


def _repo_case_hint(ctx, uri: str) -> str:
    """When the first folder of a ctx://prompts/ URI differs from a repository's name only by case, says so: the repository lookup is case-sensitive."""
    rel = (InSetuURI(uri).path or "").lstrip("/")
    first = rel.partition("/")[0]
    for repo in get_sister_repos(ctx.workspace_id):
        if first and first != repo and first.lower() == repo.lower():
            return f" The folder '{first}' differs from the repository '{repo}' only by case; repository prompts are matched case-sensitively."
    return ""


def _missing_includes(text: str, node_id: Optional[str]) -> List[Dict[str, Any]]:
    """Every {{include_prompt: ...}} the expanded prompt could not find."""
    return [
        _finding("error", "include_not_found", node_id, target, f"Includes {target}, which was not found.")
        for target in dict.fromkeys(_MISSING_INCLUDE.findall(text or ""))
    ]


def _iter_all_routine_nodes(nodes: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for n in nodes or []:
        if isinstance(n, dict):
            out.append(n)
            if str(n.get("type") or "").lower() == "loop":
                out.extend(_iter_all_routine_nodes(n.get("body") or n.get("nodes") or []))
    return out


def _check_exec_response_field_refs(ctx, routine: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Reports `nodes.<exec_id>.<field>` references where `<field>` is absent from the capability's `response_schema` TypedDict."""
    get_caps = getattr(ctx, "get_registered_capabilities", None)
    if not callable(get_caps):
        return []
    try:
        cap_registry = get_caps() or {}
    except Exception:
        return []
    if not isinstance(cap_registry, dict) or not cap_registry:
        return []

    all_nodes = _iter_all_routine_nodes(routine.get("nodes"))
    findings: List[Dict[str, Any]] = []
    exec_schemas: Dict[str, Tuple[str, frozenset]] = {}
    for n in all_nodes:
        if str(n.get("type") or "").lower() != "exec":
            continue
        nid = str(n.get("id") or "").strip()
        cap_name = str(n.get("capability") or n.get("action") or "").strip()
        if cap_name and is_routine_banned_capability(cap_name, extra_banned=ROUTINE_BANNED_CAPABILITIES, ctx=ctx):
            findings.append(_finding(
                "error",
                "restricted_capability",
                nid,
                None,
                f"Capability '{cap_name}' is restricted (human-only) and cannot be invoked by a declarative routine.",
            ))
        cap_meta = cap_registry.get(cap_name) if cap_name else None
        resp_schema = cap_meta.get("response_schema") if isinstance(cap_meta, dict) else None
        anns = getattr(resp_schema, "__annotations__", None)
        if nid and isinstance(anns, dict) and anns:
            exec_schemas[nid] = (cap_name, frozenset(anns.keys()) | _GENERIC_EXEC_ENVELOPE_KEYS)

    if not exec_schemas:
        return findings
    seen: set = set()
    for n in all_nodes:
        consumer_id = n.get("id")
        texts = [
            str(n.get(k) or "")
            for k in ("when", "condition", "until", "prompt", "user_message")
            if n.get(k)
        ]
        if n.get("payload"):
            texts.append(json.dumps(n["payload"], default=str))
        for blob in texts:
            for ref_nid, ref_field in _NODE_FIELD_REF_RE.findall(blob):
                if ref_nid not in exec_schemas:
                    continue
                cap_name, allowed_fields = exec_schemas[ref_nid]
                if ref_field not in allowed_fields and (consumer_id, ref_nid, ref_field) not in seen:
                    seen.add((consumer_id, ref_nid, ref_field))
                    declared = ", ".join(sorted(allowed_fields - _GENERIC_EXEC_ENVELOPE_KEYS))
                    findings.append(_finding(
                        "warning",
                        "unknown_node_output_field",
                        consumer_id,
                        None,
                        f"References 'nodes.{ref_nid}.{ref_field}', which is not in '{cap_name}' response_schema ({declared}).",
                    ))
    return findings


def check_routine(ctx, routine: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Problems with one loaded routine. Each LLM step is resolved the way a run resolves it: its own prompt text (its
    `## <node>` section) if it has one, otherwise its `prompt_uri`, otherwise the routine's `include_prompt`.
    """
    findings: List[Dict[str, Any]] = []
    for node in routine.get("nodes") or []:
        if not isinstance(node, dict) or str(node.get("type", "llm")).lower() != "llm":
            continue
        node_id = node.get("id")
        raw_prompt = str(node.get("prompt") or node.get("user_message") or "").strip()
        if _DASHES_ONLY.fullmatch(raw_prompt or "-"):
            raw_prompt = ""
        prompt_uri = str(node.get("prompt_uri") or routine.get("include_prompt") or "").strip()
        if prompt_uri:
            prompt_uri = InSetuURI.canonicalize(prompt_uri, default_prefix="ctx://prompts/")

        if raw_prompt:
            base_uri = prompt_uri or str(routine.get("filepath") or "ctx://prompts/routine.md")
            expanded = resolve_prompt_text(ctx, target_uri=base_uri, raw_content=raw_prompt, interpolate_vars=False) or ""
            findings.extend(_missing_includes(expanded, node_id))
            continue
        if not prompt_uri:
            findings.append(_finding(
                "warning", "empty_prompt", node_id, None,
                "This step has no prompt of its own and names none; it runs with only the chat message, and a web-chat handoff copies only your directives.",
            ))
            continue

        report: Dict[str, str] = {}
        if read_prompt_with_cascade(ctx, prompt_uri, report=report) is None:
            findings.append(_finding(
                "error", "prompt_not_found", node_id, prompt_uri,
                f"Needs the prompt {prompt_uri}, which was not found.{_repo_case_hint(ctx, prompt_uri)}",
            ))
            continue
        if report.get("via") == "name_search":
            findings.append(_finding(
                "warning", "found_by_name_search", node_id, prompt_uri,
                f"{prompt_uri} was found only by its file name, at {report.get('source')}. Point the routine at that URI so a second file with the same name cannot replace it.",
            ))
        expanded = resolve_prompt_text(ctx, target_uri=prompt_uri, interpolate_vars=False) or ""
        findings.extend(_missing_includes(expanded, node_id))
    findings.extend(_check_exec_response_field_refs(ctx, routine))
    return findings


def forget_routine_problems(workspace_id: Optional[str] = None, saved_path: Optional[str] = None) -> None:
    """Drops remembered check results: for one workspace when a prompt or routine file may have changed, or all of them."""
    if saved_path is not None and not str(saved_path).lower().endswith((".md", ".yaml", ".yml")):
        return
    if workspace_id is None:
        _PROBLEMS_CACHE.clear()
    else:
        target_ws = workspace_id or "default"
        _PROBLEMS_CACHE.clear_where(lambda k: isinstance(k, tuple) and len(k) > 0 and k[0] == target_ws)


def attach_routine_problems(ctx, routines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Adds a `problems` list to each routine summary (as listed for Routine Studio). A routine that cannot be loaded gets one error saying why."""
    workspace = getattr(ctx, "workspace_id", None) or "default"
    for summary in routines:
        ref = summary.get("filepath") if str(summary.get("filepath") or "").startswith(("ctx://", "ws://", "vfs://")) else summary.get("id")
        described = {k: v for k, v in summary.items() if k != "problems"}
        fingerprint = hashlib.sha256(json.dumps(described, sort_keys=True, default=str).encode("utf-8")).hexdigest()
        key = (workspace, str(ref))
        cached = _PROBLEMS_CACHE.get(key, revision=fingerprint)
        if cached is not None:
            summary["problems"] = cached
            continue
        try:
            problems = check_routine(ctx, load_routine_definition(ctx, ref))
        except Exception as exc:
            summary["problems"] = [_finding("error", "routine_unreadable", None, summary.get("filepath"), f"The routine could not be loaded: {exc}")]
            continue
        _PROBLEMS_CACHE.put(key, problems, revision=fingerprint)
        summary["problems"] = problems
    return routines
