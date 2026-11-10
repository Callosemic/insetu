"""Pure general-purpose Markdown language provider for heading AST spans, links, citations, and interface slicing."""

import posixpath
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from insetu.core.utils_core import InSetuURI, slugify
from .base import (
    BaseLanguageProvider,
    compute_normalized_text_body_hash,
    first_sentence,
)

_HEADING_RE = re.compile(r'^(#{1,6})\s+(.+?)\s*$')
_FENCE_RE = re.compile(r'^[ \t]*(`{3,}|~{3,})(.*)$')
_MD_LINK_RE = re.compile(r'(?<!!)\[([^\[\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)')
_WIKILINK_RE = re.compile(r'\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]')
_CITATION_GROUP_RE = re.compile(r'\[([^\[\]]*@[A-Za-z0-9_:-][^\[\]]*)\]')
_CITATION_KEY_RE = re.compile(r'(?<![A-Za-z0-9_])@([A-Za-z0-9_][A-Za-z0-9_.:-]*)')
_INCLUDE_PROMPT_RE = re.compile(r'\{\{\s*include_prompt\??\s*:\s*([^\s{}|;]+)')
_BOLD_LEAD_IN_RE = re.compile(r'^\s*(?:[-*+]|\d+\.)?\s*\*\*([^*\n]{2,80}?)(?:\s*[:—-]\s*\*\*|\*\*\s*[:—-])')


def _strip_frontmatter_lines(lines: List[str]) -> int:
    """Returns the 0-based line index where YAML frontmatter ends (or 0 if no frontmatter exists)."""
    if not lines or lines[0].strip() != "---":
        return 0
    for idx in range(1, len(lines)):
        if lines[idx].strip() in ("---", "..."):
            return idx + 1
    return 0


def _resolve_relative_markdown_uri(source_filepath: str, raw_target: str) -> Tuple[str, str]:
    """Resolves a Markdown link target ('../other.md#sec' or 'vfs://repo/doc.md#sec') into (resolved_uri, anchor)."""
    target_clean = (raw_target or "").strip()
    anchor = ""
    if "#" in target_clean:
        target_clean, anchor = target_clean.split("#", 1)
        target_clean = target_clean.strip()
        anchor = anchor.strip()

    if not target_clean:
        try:
            return (str(InSetuURI(source_filepath)) if source_filepath else ""), anchor
        except Exception:
            return source_filepath, anchor

    if "://" in target_clean:
        if target_clean.startswith(("http://", "https://", "mailto:")):
            return target_clean, anchor
        try:
            return str(InSetuURI(target_clean)), anchor
        except Exception:
            return target_clean, anchor

    if not source_filepath:
        return target_clean, anchor

    try:
        src_uri = InSetuURI(source_filepath)
        scheme = src_uri.scheme or "vfs"
        repo = src_uri.repo
        src_rel = (src_uri.path or "").strip("/")
        src_dir = posixpath.dirname(src_rel)
        if target_clean.startswith("/"):
            joined = posixpath.normpath(target_clean.lstrip("/"))
        else:
            joined = posixpath.normpath(posixpath.join(src_dir, target_clean)) if src_dir else posixpath.normpath(target_clean)
        if joined == "." or joined.startswith(".."):
            joined = joined.lstrip("./")
        if repo:
            return f"{scheme}://{repo}/{joined}".rstrip("/"), anchor
        return f"{scheme}://{joined}".rstrip("/"), anchor
    except Exception:
        return target_clean, anchor


class MarkdownLanguageProvider(BaseLanguageProvider):
    """
    General-purpose language provider for Markdown (.md, .markdown) files:
    - Extracts hierarchical heading trees (# .. ######) with exact start_line..end_line section spans
      (ignoring '#' comments inside fenced code blocks).
    - Extracts relative/URI links, [[wikilinks]], [@csl_id] citations, {{include_prompt:...}} macros,
      and bold lead-in definitions (**Term:**).
    - Compresses large documents into frontmatter + heading/definition/link skeletons under a token budget.
    """

    indexes_code_symbols = False

    def parse_heading_sections(self, content: str) -> List[Dict[str, Any]]:
        """
        Parses Markdown headings (# through ######) outside fenced code blocks and computes hierarchical
        start_line..end_line spans (1-based, inclusive). A heading of level L closes when a subsequent
        heading of level <= L is encountered (or at EOF).
        """
        lines = (content or "").replace("\r\n", "\n").splitlines()
        total_lines = len(lines)
        if total_lines == 0:
            return []

        body_start_idx = _strip_frontmatter_lines(lines)
        raw_headings: List[Dict[str, Any]] = []
        in_fence = False
        fence_marker = ""

        for idx in range(body_start_idx, total_lines):
            line = lines[idx]
            m_fence = _FENCE_RE.match(line)
            if m_fence:
                marker = m_fence.group(1)
                if not in_fence:
                    in_fence = True
                    fence_marker = marker[0]
                elif marker[0] == fence_marker:
                    in_fence = False
                    fence_marker = ""
                continue
            if in_fence:
                continue

            m_head = _HEADING_RE.match(line)
            if m_head:
                hashes, raw_title = m_head.group(1), m_head.group(2).strip()
                clean_title = re.sub(r'\s*<!--.*?-->\s*$', '', raw_title).strip()
                level = len(hashes)
                slug = slugify(clean_title) or f"section_{idx + 1}"
                raw_headings.append({
                    "name": clean_title,
                    "slug": slug,
                    "level": level,
                    "kind": f"h{level}",
                    "signature": f"{hashes} {clean_title}",
                    "start_line": idx + 1,
                    "end_line": total_lines,
                })

        for i, h in enumerate(raw_headings):
            cur_level = h["level"]
            end_ln = total_lines
            for j in range(i + 1, len(raw_headings)):
                if raw_headings[j]["level"] <= cur_level:
                    end_ln = raw_headings[j]["start_line"] - 1
                    break
            while end_ln > h["start_line"] and not lines[end_ln - 1].strip():
                end_ln -= 1
            h["end_line"] = max(h["start_line"], end_ln)

        return raw_headings

    def definitions(self, filepath_or_content: str, content: Optional[str] = None) -> List[Dict[str, Any]]:
        text = content if content is not None else filepath_or_content
        return self.parse_heading_sections(text or "")

    def scope_boundaries(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        return self.parse_heading_sections(content or "")

    def call_sites(self, filepath: str, content: str) -> Set[str]:
        """Markdown has no calls: its references are links, which imports() returns."""
        return set()

    def top_level_symbols(self, filepath: str, content: str) -> Optional[List[Dict[str, Any]]]:
        lines = (content or "").replace("\r\n", "\n").splitlines()
        sections = self.parse_heading_sections(content or "")
        symbols: List[Dict[str, Any]] = []
        for sec in sections:
            if sec["level"] > 3:
                continue
            s_ln = sec["start_line"]
            e_ln = sec["end_line"]
            body_text = "\n".join(lines[s_ln - 1 : e_ln])
            first_para = ""
            for body_ln in lines[s_ln : min(e_ln, s_ln + 8)]:
                stripped = body_ln.strip()
                if stripped and not stripped.startswith(("#", "```", "---", "|")):
                    first_para = first_sentence(stripped)
                    break
            symbols.append({
                "name": sec["name"],
                "slug": sec["slug"],
                "kind": sec["kind"],
                "signature": sec["signature"],
                "start_line": s_ln,
                "end_line": e_ln,
                "docstring": first_para,
                "body_hash": compute_normalized_text_body_hash(body_text),
            })
        return symbols

    def imports(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        """
        Extracts outbound references from Markdown content:
        - Standard Markdown links `[label](./rel.md#anchor)` or `[label](vfs://repo/path.md#anchor)`
        - Wikilinks `[[target#heading|alias]]`
        - Pandoc/CSL citation keys `[@csl_id]`
        - Prompt macro includes `{{include_prompt: ...}}`
        """
        lines = (content or "").replace("\r\n", "\n").splitlines()
        body_start_idx = _strip_frontmatter_lines(lines)
        sections = self.parse_heading_sections(content or "")
        results: List[Dict[str, Any]] = []
        in_fence = False
        fence_marker = ""

        def _enclosing_heading(line_no: int) -> str:
            enclosing = ""
            for sec in sections:
                if sec["start_line"] <= line_no <= sec["end_line"]:
                    enclosing = sec["name"]
            return enclosing

        for idx in range(body_start_idx, len(lines)):
            line = lines[idx]
            line_no = idx + 1
            m_fence = _FENCE_RE.match(line)
            if m_fence:
                marker = m_fence.group(1)
                if not in_fence:
                    in_fence = True
                    fence_marker = marker[0]
                elif marker[0] == fence_marker:
                    in_fence = False
                    fence_marker = ""
                continue
            if in_fence:
                continue

            heading_ctx = _enclosing_heading(line_no)

            for m_link in _MD_LINK_RE.finditer(line):
                label, raw_target = m_link.group(1).strip(), m_link.group(2).strip()
                if raw_target.startswith(("http://", "https://", "mailto:")):
                    continue
                resolved_uri, anchor = _resolve_relative_markdown_uri(filepath, raw_target)
                results.append({
                    "kind": "markdown_link",
                    "module": resolved_uri,
                    "target_uri": resolved_uri,
                    "raw_target": raw_target,
                    "anchor": anchor,
                    "label": label,
                    "names": [anchor] if anchor else [],
                    "heading": heading_ctx,
                    "line": line_no,
                    "is_from": _has_anchor(anchor),
                })

            for m_wiki in _WIKILINK_RE.finditer(line):
                raw_target = (m_wiki.group(1) or "").strip()
                anchor = (m_wiki.group(2) or "").strip()
                alias = (m_wiki.group(3) or raw_target).strip()
                target_with_ext = raw_target if Path(raw_target).suffix else f"{raw_target}.md"
                resolved_uri, _ = _resolve_relative_markdown_uri(filepath, target_with_ext)
                results.append({
                    "kind": "wikilink",
                    "module": resolved_uri,
                    "target_uri": resolved_uri,
                    "raw_target": raw_target,
                    "anchor": anchor,
                    "label": alias,
                    "names": [anchor] if anchor else [raw_target],
                    "heading": heading_ctx,
                    "line": line_no,
                    "is_from": True,
                })

            for m_cit_grp in _CITATION_GROUP_RE.finditer(line):
                grp_text = m_cit_grp.group(1)
                for m_cit in _CITATION_KEY_RE.finditer(grp_text):
                    csl_key = m_cit.group(1).rstrip(".,;:)")
                    if csl_key:
                        results.append({
                            "kind": "citation",
                            "module": f"cit:{csl_key}",
                            "target_uri": f"cit:{csl_key}",
                            "citation_key": csl_key,
                            "names": [csl_key],
                            "heading": heading_ctx,
                            "line": line_no,
                            "is_from": False,
                        })

            for m_inc in _INCLUDE_PROMPT_RE.finditer(line):
                inc_target = m_inc.group(1).strip().rstrip(";,")
                results.append({
                    "kind": "include_prompt",
                    "module": inc_target,
                    "target_uri": inc_target,
                    "names": [inc_target],
                    "heading": heading_ctx,
                    "line": line_no,
                    "is_from": False,
                })

        return results

    def exports(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        """Returns exported heading anchor slugs and bold lead-in term definitions (**Term:**)."""
        lines = (content or "").replace("\r\n", "\n").splitlines()
        sections = self.parse_heading_sections(content or "")
        exported: List[Dict[str, Any]] = []
        for sec in sections:
            exported.append({
                "name": sec["name"],
                "slug": sec["slug"],
                "kind": sec["kind"],
                "line": sec["start_line"],
            })

        in_fence = False
        fence_marker = ""
        for idx, line in enumerate(lines):
            m_fence = _FENCE_RE.match(line)
            if m_fence:
                marker = m_fence.group(1)
                if not in_fence:
                    in_fence = True
                    fence_marker = marker[0]
                elif marker[0] == fence_marker:
                    in_fence = False
                    fence_marker = ""
                continue
            if in_fence:
                continue
            m_bold = _BOLD_LEAD_IN_RE.match(line)
            if m_bold:
                term = m_bold.group(1).strip().rstrip(":")
                if term:
                    exported.append({
                        "name": term,
                        "slug": slugify(term),
                        "kind": "term",
                        "line": idx + 1,
                    })
        return exported

    def extract_symbol_slice(self, filepath: str, content: str, symbol_query: str) -> Optional[Dict[str, Any]]:
        """Slices a Markdown section by exact heading title, slug, or '[ID]' task prefix."""
        if not content or not symbol_query:
            return None
        lines = content.replace("\r\n", "\n").splitlines()
        clean_q = symbol_query.strip().lstrip("#").strip()
        q_slug = slugify(clean_q)
        sections = self.parse_heading_sections(content)

        for sec in sections:
            if (
                sec["name"].lower() == clean_q.lower()
                or sec["slug"] == q_slug
                or clean_q.lower() in sec["name"].lower()
            ):
                s_ln, e_ln = sec["start_line"], sec["end_line"]
                return {
                    "symbol": sec["name"],
                    "kind": sec["kind"],
                    "signature": sec["signature"],
                    "start_line": s_ln,
                    "end_line": e_ln,
                    "source": "\n".join(lines[s_ln - 1 : e_ln]),
                }
        return None

    def slice_interface(self, filepath: str, content: str, max_tokens: int = 12000) -> str:
        """
        Compresses a Markdown document to its structural skeleton (YAML frontmatter + headings +
        bold lead-in definitions + lines containing links/citations) bounded under `max_tokens`.
        """
        if not content:
            return ""
        max_chars = max(512, int(max_tokens) * 4)
        lines = content.replace("\r\n", "\n").splitlines()
        body_start_idx = _strip_frontmatter_lines(lines)
        skeleton_lines: List[str] = []

        if body_start_idx > 0:
            skeleton_lines.extend(lines[:body_start_idx])
            skeleton_lines.append("")

        in_fence = False
        fence_marker = ""
        for idx in range(body_start_idx, len(lines)):
            line = lines[idx]
            m_fence = _FENCE_RE.match(line)
            if m_fence:
                marker = m_fence.group(1)
                if not in_fence:
                    in_fence = True
                    fence_marker = marker[0]
                elif marker[0] == fence_marker:
                    in_fence = False
                    fence_marker = ""
                continue
            if in_fence:
                continue

            stripped = line.strip()
            if not stripped:
                continue
            if (
                _HEADING_RE.match(line)
                or _BOLD_LEAD_IN_RE.match(line)
                or _MD_LINK_RE.search(line)
                or _WIKILINK_RE.search(line)
                or _CITATION_GROUP_RE.search(line)
                or re.match(r'^\s*-\s+\[[ xX]\]\s+\[[A-Za-z0-9_.-]+\]', line)
            ):
                skeleton_lines.append(line)

        out = "\n".join(skeleton_lines).strip()
        if len(out) > max_chars:
            out = out[:max_chars].rsplit("\n", 1)[0] + "\n... [truncated to token budget]"
        return out

    def describe_file(self, rel_path: str, content: str) -> str:
        text = (content or "").strip()
        if text.startswith("---"):
            parts = text.split("---", 2)
            if len(parts) >= 3:
                fm_block = parts[1]
                for key in ("description", "title"):
                    m = re.search(rf'^{key}\s*:\s*(.+)$', fm_block, re.MULTILINE)
                    if m:
                        val = m.group(1).strip().strip('\'"')
                        if val:
                            return first_sentence(val)
                text = parts[2].strip()
        for raw_line in text.splitlines():
            clean = raw_line.strip()
            if clean.startswith("#"):
                heading = clean.lstrip("#").strip()
                if heading:
                    return first_sentence(heading)
        if "adrs/" in rel_path.replace("\\", "/"):
            stem = re.sub(r'^\d+[-_]', '', Path(rel_path).stem).replace('-', ' ').replace('_', ' ').strip()
            if stem:
                return first_sentence(f"ADR: {stem[:1].upper() + stem[1:]}.")
        return ""


def _has_anchor(anchor: str) -> bool:
    return bool(anchor and anchor.strip())
