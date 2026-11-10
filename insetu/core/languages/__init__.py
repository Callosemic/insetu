"""Central language analysis substrate mapping file extensions to BaseLanguageProvider implementations."""

from bisect import bisect_left, bisect_right
import difflib
import json
from pathlib import Path
import re
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from .base import (
    BaseLanguageProvider,
    compute_normalized_text_body_hash,
    find_brace_balanced_end,
    first_sentence,
)
from .javascript import JavaScriptLanguageProvider
from .markdown import MarkdownLanguageProvider
from .python import PythonLanguageProvider
from .rust import RustLanguageProvider

_PROVIDERS: Dict[str, BaseLanguageProvider] = {
    ".py": PythonLanguageProvider(),
    ".js": JavaScriptLanguageProvider(),
    ".mjs": JavaScriptLanguageProvider(),
    ".cjs": JavaScriptLanguageProvider(),
    ".ts": JavaScriptLanguageProvider(),
    ".tsx": JavaScriptLanguageProvider(),
    ".jsx": JavaScriptLanguageProvider(),
    ".rs": RustLanguageProvider(),
    ".md": MarkdownLanguageProvider(),
    ".markdown": MarkdownLanguageProvider(),
}

SUPPORTED_SYMBOL_EXTENSIONS = frozenset(ext for ext, provider in _PROVIDERS.items() if provider.indexes_code_symbols)


def get_language_provider(filepath: str) -> Optional[BaseLanguageProvider]:
    """Resolves the appropriate language provider for a file path based on its extension."""
    if not filepath:
        return None
    ext = Path(filepath).suffix.lower()
    return _PROVIDERS.get(ext)


def extract_file_symbols(filepath: str, content: str) -> Optional[List[Dict[str, Any]]]:
    if Path(filepath).suffix.lower() not in SUPPORTED_SYMBOL_EXTENSIONS:
        return None
    """
    Extracts public top-level symbols for supported languages (.py, .js/.ts/.mjs/.tsx, .rs).
    Returns None if a syntax error prevented parsing so callers can preserve cached symbols.
    """
    if not content:
        return []
    provider = get_language_provider(filepath)
    if not provider:
        return []
    return provider.top_level_symbols(filepath, content)


def extract_symbol_source_slice(filepath: str, content: str, symbol_query: str) -> Optional[Dict[str, Any]]:
    """Locates a top-level class, method, or function in content and returns its exact source slice."""
    if not content or not symbol_query:
        return None
    provider = get_language_provider(filepath)
    if not provider:
        return None
    return provider.extract_symbol_slice(filepath, content, symbol_query)


_HASH_COMMENT_EXTENSIONS = frozenset({
    ".sh", ".bash", ".zsh", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".properties",
})
_PATH_HEADER_COMMENT_RE = re.compile(r'^[A-Za-z0-9_./-]+\.[A-Za-z0-9_+-]+$')


def _describe_markdown(rel_path: str, content: str) -> str:
    """Extracts a one-sentence summary from Markdown YAML frontmatter, first heading, or ADR filename stem."""
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


def _describe_hash_commented_file(rel_path: str, content: str) -> str:
    """Extracts a leading '#' comment or TOML description from shell scripts, YAML, TOML, or a Dockerfile."""
    lines = (content or "").splitlines()
    idx = 0
    if lines and lines[0].startswith("#!"):
        idx = 1
    while idx < len(lines) and not lines[idx].strip():
        idx += 1
    comment_lines: List[str] = []
    while idx < len(lines) and lines[idx].strip().startswith("#"):
        raw_c = lines[idx].strip().lstrip("#").strip()
        if not raw_c or raw_c.startswith("-*-") or _PATH_HEADER_COMMENT_RE.match(raw_c):
            idx += 1
            continue
        comment_lines.append(raw_c)
        idx += 1
    if comment_lines:
        return first_sentence("\n".join(comment_lines))
    if Path(rel_path).suffix.lower() == ".toml":
        m = re.search(r'^\s*description\s*=\s*"([^"]+)"', content or "", re.MULTILINE)
        if m:
            return first_sentence(m.group(1))
    return ""


def _describe_json_file(rel_path: str, content: str) -> str:
    """Extracts a one-sentence description from JSON metadata or well-known manifest/lock schemas."""
    fname = Path(rel_path).name
    try:
        data = json.loads(content)
    except Exception:
        return ""
    if not isinstance(data, dict):
        return ""
    if isinstance(data.get("description"), str) and data["description"].strip():
        return first_sentence(data["description"])
    # Without a "description" key, only well-known file formats get a generic description.
    if fname == "package-lock.json" or "lockfileVersion" in data:
        return "npm dependency lockfile."
    if fname == "package.json":
        pkg_name = data.get("name") or "npm"
        return first_sentence(f"npm package manifest for {pkg_name}.")
    return ""


def describe_source_file(rel_path: str, content: str) -> str:
    """Derives a one-sentence file description for CODE_INDEX.md from docstrings, frontmatter, headers, or metadata."""
    norm_rel = (rel_path or "").replace("\\", "/").strip("/")
    fname = Path(norm_rel).name
    if fname in (".gitkeep", ".keep"):
        return "Git folder retention."
    if fname == ".gitignore":
        return "Git ignore rules."
    if fname.upper().startswith("LICENSE"):
        if "Apache License" in (content or ""):
            return "Apache-2.0 open-source software license."
        if "MIT License" in (content or ""):
            return "MIT open-source software license."
        return "Open-source software license."
    if fname.upper().startswith("NOTICE"):
        return "Copyright notice and third-party software attributions."

    if not content or not content.strip():
        return ""

    provider = get_language_provider(norm_rel)
    if provider:
        prov_desc = provider.describe_file(norm_rel, content)
        if prov_desc:
            return prov_desc

    ext = Path(norm_rel).suffix.lower()
    if ext in (".md", ".markdown"):
        return _describe_markdown(norm_rel, content)
    if ext == ".json":
        return _describe_json_file(norm_rel, content)
    if ext in _HASH_COMMENT_EXTENSIONS or fname == "Dockerfile":
        return _describe_hash_commented_file(norm_rel, content)
    if ext == ".css":
        m_css = re.match(r'^\s*/\*+\s*([^\n*]+)', content or "")
        if m_css and m_css.group(1).strip():
            return first_sentence(m_css.group(1).strip())
        return first_sentence(f"Stylesheet for {Path(norm_rel).stem}.")
    if "/vendor/" in f"/{norm_rel}" and ext in (".js", ".mjs", ".css"):
        return first_sentence(f"Vendored {Path(norm_rel).stem} runtime asset.")
    return ""


def describe_directory(rel_dir: str, child_files: List[str], read_fn: Callable[[str], Optional[str]]) -> str:
    """Derives a one-sentence directory description from its README.md, __init__.py, package.json, or child script headers."""
    clean_dir = (rel_dir or "").replace("\\", "/").strip("/")
    if not clean_dir:
        return ""
    if Path(clean_dir).name == "vendor":
        return "Vendored third-party runtime assets."
    for candidate in (f"{clean_dir}/README.md", f"{clean_dir}/__init__.py", f"{clean_dir}/package.json"):
        if candidate in child_files:
            raw = read_fn(candidate) or ""
            if candidate.endswith("package.json"):
                try:
                    pkg = json.loads(raw)
                    if isinstance(pkg, dict):
                        if pkg.get("description"):
                            return first_sentence(str(pkg["description"]))
                        if pkg.get("name"):
                            return first_sentence(f"Build and dependency specification for {pkg['name']}.")
                except Exception:
                    pass
            else:
                desc = describe_source_file(candidate, raw)
                if desc and desc != "Module initialization.":
                    return desc
    return ""


def format_interleaved_file_diff(
        filepath: str,
        base_content: str,
        current_content: str,
        fallback_padding: int = 15,
        ast_padding: int = 4,
) -> str:
        """
        Compiles a single-stream, deterministic interleaved diff between `base_content` and `current_content`:
        - Option 2 (AST-Aware Primary): For supported languages (.py, .js/.ts, .rs), expands any modified hunk
            to its full enclosing function/method/class scope, keeps top-of-file imports, and collapses untouched
            functions to their signature + `... # [lines X-Y unchanged]` interface skeleton.
        - Option 1 (Windowed Fallback): For unknown languages or non-code files (.md, .json, .yaml, .css),
            interleaves `-` / `+` changes with `+/- fallback_padding` lines of unchanged context.
        """
        old_lines = (base_content or "").replace("\r\n", "\n").splitlines()
        new_lines = (current_content or "").replace("\r\n", "\n").splitlines()
        total_new = len(new_lines)

        if old_lines == new_lines:
                return ""

        matcher = difflib.SequenceMatcher(None, old_lines, new_lines, autojunk=False)
        opcodes = matcher.get_opcodes()

        # Track 1-based line numbers in `new_lines` that were added or adjacent to deletions,
        # and map `new_line_idx` (0-based) -> list of deleted old lines immediately preceding it.
        changed_new_lines: Set[int] = set()
        scope_touch_lines: Set[int] = set()
        deletions_before_new_idx: Dict[int, List[Tuple[int, str]]] = {}

        for tag, i1, i2, j1, j2 in opcodes:
            if tag == "equal":
                continue
            if tag in ("replace", "delete"):
                del_chunk = [(old_idx + 1, old_lines[old_idx]) for old_idx in range(i1, i2)]
                deletions_before_new_idx.setdefault(j1, []).extend(del_chunk)
                anchor_line = max(1, min(total_new, j1 + 1)) if total_new > 0 else 1
                changed_new_lines.add(anchor_line)
                if j1 > 0:
                    changed_new_lines.add(j1)
            if tag in ("replace", "insert"):
                for new_idx in range(j1, j2):
                    changed_new_lines.add(new_idx + 1)
                    scope_touch_lines.add(new_idx + 1)

        if not changed_new_lines and deletions_before_new_idx:
                out_del_only = [f"@@ -1,{len(old_lines)} +0,0 @@"]
                for _, d_line in deletions_before_new_idx.get(0, []):
                        out_del_only.append(f"- {d_line}")
                return "\n".join(out_del_only)

        def _span_attr(item: Any, key: str, default: int = 1) -> int:
            val = item.get(key, default) if isinstance(item, dict) else getattr(item, key, default)
            return int(val if val is not None else default)

        provider = get_language_provider(filepath) if total_new > 60 else None
        defs: List[Any] = []
        if provider:
            try:
                defs = provider.definitions(current_content) or []
            except TypeError:
                try:
                    defs = provider.definitions(filepath, current_content) or []
                except Exception:
                    defs = []
            except Exception:
                defs = []
        collapsed_ranges: List[Tuple[int, int]] = []

        # --- Tier A: AST-Enclosing Interleaved Diff + Interface Skeleton (Option 2) ---
        if provider and defs:
            visible_new_lines: Set[int] = set()
            first_def_line = min((_span_attr(d, "start_line", 1) for d in defs), default=1)
            for ln in range(1, min(total_new + 1, max(first_def_line, 1), 65)):
                visible_new_lines.add(ln)

            for c_ln in changed_new_lines:
                for ln in range(max(1, c_ln - ast_padding), min(total_new, c_ln + ast_padding) + 1):
                    visible_new_lines.add(ln)

            seen_spans: Set[Tuple[int, int]] = set()
            sorted_spans: List[Tuple[int, int]] = []
            for d in defs:
                s_ln = _span_attr(d, "start_line", 1)
                e_ln = _span_attr(d, "end_line", s_ln)
                if (s_ln, e_ln) not in seen_spans:
                    seen_spans.add((s_ln, e_ln))
                    sorted_spans.append((s_ln, e_ln))
            sorted_spans.sort(key=lambda sp: (sp[0], -(sp[1] - sp[0])))

            sorted_touch = sorted(scope_touch_lines)
            sorted_del_anchors = sorted(del_j1 + 1 for del_j1 in deletions_before_new_idx.keys())
            comment_tok = "//" if Path(filepath).suffix.lower() in (".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".rs") else "#"

            def _has_line_in_range(sorted_arr: List[int], low: int, high: int) -> bool:
                idx = bisect_left(sorted_arr, low)
                return idx < len(sorted_arr) and sorted_arr[idx] <= high

            def _find_signature_end_line(start_ln: int, end_ln: int) -> int:
                """Finds the 1-based line where decorators and multi-line function/class signatures finish."""
                limit_ln = min(total_new, end_ln, start_ln + 12)
                cur_ln = start_ln
                paren_depth = 0
                saw_def_or_header = False
                while cur_ln <= limit_ln:
                    raw_l = new_lines[cur_ln - 1].strip()
                    if not raw_l or raw_l.startswith(("@", "#", "//", "/*")):
                        cur_ln += 1
                        continue
                    saw_def_or_header = True
                    paren_depth += raw_l.count("(") - raw_l.count(")")
                    if paren_depth <= 0 and (raw_l.endswith((":", "{", ";")) or "{" in raw_l):
                        break
                    cur_ln += 1
                if not saw_def_or_header:
                    return min(total_new, end_ln, start_ln + 1)
                if cur_ln + 1 <= end_ln and cur_ln + 1 <= total_new:
                    next_l = new_lines[cur_ln].strip()
                    if next_l.startswith(('"""', "'''")) and next_l.endswith(('"""', "'''")) and len(next_l) > 6:
                        cur_ln += 1
                return min(total_new, end_ln, cur_ln)

            untouched_Collapse_notes: Dict[int, str] = {}
            expanded_ranges: List[Tuple[int, int]] = []
            num_spans = len(sorted_spans)

            for idx, (s_ln, e_ln) in enumerate(sorted_spans):
                if any(c_start <= s_ln and e_ln <= c_end for c_start, c_end in collapsed_ranges):
                    continue
                is_touched = (
                    _has_line_in_range(sorted_touch, s_ln, e_ln)
                    or _has_line_in_range(sorted_del_anchors, s_ln + 1, e_ln)
                )
                if is_touched:
                    # Since sorted_spans is ordered by (start_line, -length), any child span immediately follows idx
                    has_child_spans = (idx + 1 < num_spans) and (sorted_spans[idx + 1][1] <= e_ln)
                    if not has_child_spans or (e_ln - s_ln) <= 80:
                        exp_start, exp_end = max(1, s_ln - 1), min(total_new, e_ln)
                        expanded_ranges.append((exp_start, exp_end))
                        visible_new_lines.update(range(exp_start, exp_end + 1))
                    else:
                        sig_end = _find_signature_end_line(s_ln, e_ln)
                        visible_new_lines.update(range(max(1, s_ln - 1), sig_end + 1))
                else:
                    if any(ex_s <= s_ln and e_ln <= ex_e for ex_s, ex_e in expanded_ranges):
                        continue
                    sig_end = _find_signature_end_line(s_ln, e_ln)
                    visible_new_lines.update(range(s_ln, sig_end + 1))
                    if e_ln > sig_end + 1:
                        collapsed_ranges.append((sig_end + 1, e_ln))
                        visible_new_lines.difference_update(range(sig_end + 1, e_ln + 1))
                        def_line_text = new_lines[sig_end - 1] if sig_end <= total_new else new_lines[s_ln - 1]
                        base_indent = len(def_line_text) - len(def_line_text.lstrip())
                        indent_str = " " * (base_indent + 4)
                        untouched_Collapse_notes[sig_end] = (
                            f"{indent_str}... {comment_tok} [lines {sig_end + 1}-{e_ln} unchanged]"
                        )

        # --- Tier B: Windowed Interleaved Fallback for Unknown Languages / Non-Code Files (Option 1) ---
        else:
                visible_new_lines = set()
                untouched_Collapse_notes = {}
                for c_ln in changed_new_lines:
                        for ln in range(max(1, c_ln - fallback_padding), min(total_new, c_ln + fallback_padding) + 1):
                                visible_new_lines.add(ln)

        # Bridge tiny 1-4 line gaps between visible segments so we don't emit noisy 2-line elisions
        sorted_vis = sorted(visible_new_lines)
        for idx in range(len(sorted_vis) - 1):
                gap_start = sorted_vis[idx]
                gap_end = sorted_vis[idx + 1]
                if 1 < (gap_end - gap_start) <= 5 and gap_start not in untouched_Collapse_notes:
                        for fill_ln in range(gap_start + 1, gap_end):
                                visible_new_lines.add(fill_ln)

        # Render the single interleaved stream
        added_new_lines: Set[int] = {
                new_idx + 1
                for tag, _, _, j1, j2 in opcodes
                if tag in ("replace", "insert")
                for new_idx in range(j1, j2)
        }

        output_lines: List[str] = []
        last_emitted_new_ln = 0

        for new_idx in range(total_new):
                ln_num = new_idx + 1
                del_before = deletions_before_new_idx.get(new_idx, [])
                is_vis = ln_num in visible_new_lines or bool(del_before)

                if not is_vis:
                        continue

                if last_emitted_new_ln > 0 and ln_num > last_emitted_new_ln + 1:
                    covered_until = last_emitted_new_ln
                    for c_start, c_end in collapsed_ranges:
                        if c_start == last_emitted_new_ln + 1:
                            covered_until = max(covered_until, c_end)
                    if ln_num > covered_until + 1:
                        output_lines.append(f"@@ ... lines {covered_until + 1}-{ln_num - 1} unchanged ... @@")

                for _, del_text in del_before:
                        output_lines.append(f"- {del_text}")

                prefix = "+ " if ln_num in added_new_lines else "  "
                output_lines.append(f"{prefix}{new_lines[new_idx]}")

                if ln_num in untouched_Collapse_notes and (ln_num + 1) not in visible_new_lines:
                        output_lines.append(f"  {untouched_Collapse_notes[ln_num]}")

                last_emitted_new_ln = ln_num

        # Trailing deletions at EOF (after the last line of new_lines)
        eof_deletions = deletions_before_new_idx.get(total_new, [])
        for _, del_text in eof_deletions:
                output_lines.append(f"- {del_text}")

        return "\n".join(output_lines)


__all__ = [
        "BaseLanguageProvider",
        "MarkdownLanguageProvider",
        "PythonLanguageProvider",
        "JavaScriptLanguageProvider",
        "RustLanguageProvider",
        "SUPPORTED_SYMBOL_EXTENSIONS",
        "get_language_provider",
        "extract_file_symbols",
        "extract_symbol_source_slice",
        "describe_source_file",
        "describe_directory",
        "find_brace_balanced_end",
        "first_sentence",
        "compute_normalized_text_body_hash",
        "format_interleaved_file_diff",
]
