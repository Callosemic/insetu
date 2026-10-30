"""
insetu.core.agent.schemas.rag
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Zero-dependency response contracts for MacroScout and ContextSlice RAG funnels.
Governs candidate file discovery, AST interface target slicing, and topology clamping.
"""

import json
import re
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class MacroScoutSchema:
    """Output contract for Stage 1 macro file discovery."""
    candidate_files: List[str] = field(default_factory=list)
    reasoning: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ContextSliceReference:
    """A reference-only file slice specifying symbol signatures to retain."""
    filepath: str
    symbols: List[str] = field(default_factory=list)
    reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ContextSliceSchema:
    """Output contract for Stage 2 focused AST context assembly."""
    edit_targets: List[str] = field(default_factory=list)
    reference_targets: List[ContextSliceReference] = field(default_factory=list)
    summary: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def strip_markdown_fences(raw_text: str) -> str:
    """Strips markdown code fences and cleans trailing commas from raw LLM JSON text."""
    text = (raw_text or "").strip()
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?[ \t]*\r?\n?', '', text, count=1)
        text = re.sub(r'\r?\n?```\s*$', '', text, count=1)
    text = text.strip()
    return re.sub(r',\s*(\}|\])', r'\1', text)


# Backward-compatible alias
_strip_markdown_fences = strip_markdown_fences


def get_macro_scout_directive() -> str:
    """Returns the prompt instruction directive for macro file scouting."""
    return (
        "Respond ONLY with valid JSON containing up to 6 candidate files required for the task:\n"
        '{"candidate_files": ["vfs://repo/path/to/file.py"], "reasoning": "brief rationale"}'
    )


def validate_macro_scout_response(raw_text: str) -> Tuple[bool, Any, str]:
    """Validates an LLM output against the MacroScoutSchema contract."""
    cleaned = _strip_markdown_fences(raw_text)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        return False, None, f"Invalid JSON in MacroScout response: {e}"

    if not isinstance(data, dict):
        return False, None, "MacroScout output must be a JSON object."

    raw_candidates = data.get("candidate_files")
    if not isinstance(raw_candidates, list):
        return False, None, "MacroScout output missing 'candidate_files' list."

    cleaned_candidates = [
        str(f).strip() for f in raw_candidates if isinstance(f, (str, Path)) and str(f).strip()
    ]
    if not cleaned_candidates:
        return False, None, "'candidate_files' list cannot be empty."

    if len(cleaned_candidates) > 6:
        cleaned_candidates = cleaned_candidates[:6]

    result = MacroScoutSchema(
        candidate_files=cleaned_candidates,
        reasoning=data.get("reasoning"),
    )
    return True, result.to_dict(), ""


def get_context_slice_directive() -> str:
    """Returns the prompt instruction directive for fine-grained context slicing."""
    return (
        "Respond ONLY with valid JSON defining edit targets and reference interface slices:\n"
        "{\n"
        '  "edit_targets": ["vfs://repo/file_to_modify.py"],\n'
        '  "reference_targets": [\n'
        '    {"filepath": "vfs://repo/sibling_interface.py", "symbols": ["ClassName", "function_name"]}\n'
        "  ],\n"
        '  "summary": "brief slice plan"\n'
        "}"
    )


def validate_context_slice_response(raw_text: str) -> Tuple[bool, Any, str]:
    """Validates an LLM output against the ContextSliceSchema contract."""
    cleaned = _strip_markdown_fences(raw_text)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        return False, None, f"Invalid JSON in ContextSlice response: {e}"

    if not isinstance(data, dict):
        return False, None, "ContextSlice output must be a JSON object."

    raw_edit = data.get("edit_targets", [])
    if not isinstance(raw_edit, list):
        return False, None, "'edit_targets' must be a list of file paths."

    raw_ref = data.get("reference_targets", [])
    if not isinstance(raw_ref, list):
        return False, None, "'reference_targets' must be a list of objects."

    references: List[ContextSliceReference] = []
    for idx, ref in enumerate(raw_ref):
        if not isinstance(ref, dict) or not ref.get("filepath"):
            continue
        symbols = [str(s).strip() for s in ref.get("symbols", []) if str(s).strip()]
        references.append(
            ContextSliceReference(
                filepath=str(ref["filepath"]).strip(),
                symbols=symbols,
                reason=ref.get("reason"),
            )
        )

    result = ContextSliceSchema(
        edit_targets=[str(f).strip() for f in raw_edit if str(f).strip()],
        reference_targets=references,
        summary=data.get("summary"),
    )
    return True, result.to_dict(), ""
