"""
Routine check: reports every routine whose prompts do not resolve, so a routine pointing at a moved or deleted prompt
shows up in Routine Studio instead of running with an empty prompt.

It resolves prompts through the same functions a run uses (`read_prompt_with_cascade`, `resolve_prompt_text`), so a
routine the check passes resolves the same way at run time.
"""
import re
from typing import Any, Dict, List, Optional

from insetu.core.agent.orchestrator import load_routine_definition
from insetu.core.prompts.engine_prompts import read_prompt_with_cascade, resolve_prompt_text
from insetu.core.utils_core import InSetuURI, get_sister_repos

_MISSING_INCLUDE = re.compile(r"\[!\] MACRO TARGET NOT FOUND: (\S+)")
_DASHES_ONLY = re.compile(r"[-\s]+")


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
    return findings


def attach_routine_problems(ctx, routines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Adds a `problems` list to each routine summary (as listed for Routine Studio). A routine that cannot be loaded gets one error saying why."""
    for summary in routines:
        ref = summary.get("filepath") if str(summary.get("filepath") or "").startswith(("ctx://", "ws://", "vfs://")) else summary.get("id")
        try:
            summary["problems"] = check_routine(ctx, load_routine_definition(ctx, ref))
        except Exception as exc:
            summary["problems"] = [_finding("error", "routine_unreadable", None, summary.get("filepath"), f"The routine could not be loaded: {exc}")]
    return routines
