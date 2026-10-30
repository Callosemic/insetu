"""Rust language provider for use imports, pub exports, type/fn definitions, and interface slicing."""

import re
from typing import Any, Dict, List, Optional, Set, Tuple

from .base import (
    BaseLanguageProvider,
    compute_normalized_text_body_hash,
    find_brace_balanced_end,
    first_sentence,
)

_RUST_USE_RE = re.compile(r'^(?:pub\s+)?use\s+(?P<path>[^;]+);', re.MULTILINE)
_RUST_FN_RE = re.compile(
    r'^(?P<indent>[ \t]*)'
    r'(?:pub(?:\([^)]+\))?\s+)?'
    r'(?:async\s+)?'
    r'fn\s+(?P<name>[A-Za-z0-9_]+)\s*(?:<[^>]+>)?\s*\((?P<args>[^)]*)\)'
    r'(?:\s*->\s*(?P<ret>[^{]+))?\s*\{',
    re.MULTILINE,
)
_RUST_TYPE_RE = re.compile(
    r'^(?:pub(?:\([^)]+\))?\s+)?(?P<kind>struct|enum|trait|type)\s+(?P<name>[A-Za-z0-9_]+)',
    re.MULTILINE,
)
_CALL_SITE_RE = re.compile(r'\b(?P<ident>[A-Za-z0-9_]+)\s*\(', re.MULTILINE)


class RustLanguageProvider(BaseLanguageProvider):
    """Rust language provider for AST inspection and interface extraction."""

    def describe_file(self, filepath: str, content: str) -> str:
        doc_lines = []
        for line in (content or "").splitlines():
            s = line.strip()
            if s.startswith("//!"):
                doc_lines.append(s[3:].strip())
            elif not s:
                if doc_lines:
                    break
            else:
                break
        return first_sentence("\n".join(doc_lines))

    def imports(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        results = []
        for m in _RUST_USE_RE.finditer(content or ""):
            path_str = m.group("path").strip()
            line_no = content.count("\n", 0, m.start()) + 1
            results.append({
                "module": path_str,
                "names": [path_str.split("::")[-1].strip("{} ")],
                "is_from": "::" in path_str,
                "line": line_no,
            })
        return results

    def exports(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        results = []
        for m in re.finditer(r'^pub(?:\([^)]+\))?\s+(?P<kind>fn|struct|enum|trait|type|const)\s+(?P<name>[A-Za-z0-9_]+)', content or "", re.MULTILINE):
            line_no = content.count("\n", 0, m.start()) + 1
            results.append({
                "name": m.group("name"),
                "kind": m.group("kind"),
                "line": line_no,
            })
        return results

    def definitions(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        lines = (content or "").splitlines()
        results = []
        for m in _RUST_TYPE_RE.finditer(content or ""):
            line_idx = content.count("\n", 0, m.start())
            end_line = find_brace_balanced_end(lines, line_idx)
            name = m.group("name")
            kind = m.group("kind")
            full_slice = "\n".join(lines[max(0, line_idx):min(len(lines), end_line)])
            results.append({
                "name": name,
                "kind": kind,
                "signature": f"{kind} {name}",
                "docstring": "",
                "start_line": line_idx + 1,
                "end_line": end_line,
                "snippet": "\n".join(lines[max(0, line_idx):min(len(lines), line_idx + 30)]),
                "body_hash": compute_normalized_text_body_hash(full_slice),
                "top_level": True,
            })
        for m in _RUST_FN_RE.finditer(content or ""):
            line_idx = content.count("\n", 0, m.start())
            end_line = find_brace_balanced_end(lines, line_idx)
            name = m.group("name")
            ret_str = f" -> {m.group('ret').strip()}" if m.group("ret") else ""
            full_slice = "\n".join(lines[max(0, line_idx):min(len(lines), end_line)])
            results.append({
                "name": name,
                "kind": "function",
                "signature": f"fn {name}(...){ret_str}",
                "docstring": "",
                "start_line": line_idx + 1,
                "end_line": end_line,
                "snippet": "\n".join(lines[max(0, line_idx):min(len(lines), line_idx + 30)]),
                "body_hash": compute_normalized_text_body_hash(full_slice),
                "top_level": not bool(m.group("indent")),
            })
        return results

    def extract_symbol_slice(self, filepath: str, content: str, symbol_query: str) -> Optional[Dict[str, Any]]:
        clean_query = symbol_query.strip().split("(")[0].split()[-1].strip()
        lines = (content or "").splitlines()
        for sym in self.definitions(filepath, content):
            if sym["name"] == clean_query:
                s_line = sym["start_line"]
                e_line = sym["end_line"]
                return {
                    "symbol": sym["name"],
                    "signature": sym["signature"],
                    "start_line": s_line,
                    "end_line": e_line,
                    "source": "\n".join(lines[s_line - 1:e_line]),
                }
        return None

    def call_sites(self, filepath: str, content: str) -> Set[str]:
        calls = set()
        for m in _CALL_SITE_RE.finditer(content or ""):
            ident = m.group("ident")
            if ident and ident not in ("if", "for", "while", "match", "loop", "fn"):
                calls.add(ident)
        return calls

    def scope_boundaries(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        lines = (content or "").splitlines()
        scopes = []
        for m in _RUST_FN_RE.finditer(content or ""):
            name = m.group("name")
            line_idx = content.count("\n", 0, m.start())
            end_line = find_brace_balanced_end(lines, line_idx)
            scopes.append({
                "name": name,
                "start_line": line_idx + 1,
                "end_line": end_line,
                "body_start_line": line_idx + 1,
                "body_end_line": end_line,
            })
        return scopes

    def slice_interface(self, filepath: str, content: str, requested_symbols: Optional[List[str]] = None) -> str:
        lines = (content or "").splitlines()
        cuts: List[Tuple[int, int, str]] = []
        clean_requested = set(requested_symbols or [])

        for m in _RUST_FN_RE.finditer(content or ""):
            name = m.group("name")
            if not name or name in clean_requested:
                continue
            open_bracket_idx = content.find("{", m.start())
            if open_bracket_idx == -1:
                continue
            start_line_idx = content.count("\n", 0, open_bracket_idx)
            end_line = find_brace_balanced_end(lines, start_line_idx)
            if end_line > start_line_idx + 1:
                cuts.append((start_line_idx + 1, end_line - 1, "    /* ... body omitted ... */"))

        cuts.sort(key=lambda c: c[0], reverse=True)
        res_lines = list(lines)
        for s_idx, e_idx, rep in cuts:
            if s_idx < e_idx:
                res_lines[s_idx:e_idx] = [rep]
        return "\n".join(res_lines)
