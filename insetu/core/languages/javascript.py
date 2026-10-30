"""JavaScript and TypeScript language provider for ES/CommonJS imports, exports, JSDoc, and interface slicing."""

import re
from typing import Any, Dict, List, Optional, Set, Tuple

from .base import (
    BaseLanguageProvider,
    compute_normalized_text_body_hash,
    find_brace_balanced_end,
    first_sentence,
)

_JS_PATH_COMMENT_RE = re.compile(r'^//\s*[\w./@-]+\.(?:js|mjs|ts|tsx)\s*$')

_IMPORT_RE = re.compile(
    r'(?:import\s+(?:(?P<default>[A-Za-z0-9_$]+)\s*,?\s*)?(?:\{\s*(?P<named>[^}]+)\s*\}|\*\s+as\s+(?P<namespace>[A-Za-z0-9_$]+))?\s+from\s+[\'"](?P<module>[^\'"]+)[\'"]'
    r'|const\s+\{\s*(?P<req_named>[^}]+)\s*\}\s*=\s*require\([\'"](?P<req_module>[^\'"]+)[\'"]\))',
    re.MULTILINE,
)

_EXPORT_RE = re.compile(
    r'^export\s+(?:default\s+)?(?:async\s+)?(?:(?P<kind>function|class|const|let|var)\s+(?P<name>[A-Za-z0-9_$]+)|(?P<decl>\{[^}]+\}))',
    re.MULTILINE,
)

_DEFINITION_RE = re.compile(
    r'^(?P<indent>[ \t]*)'
    r'(?:export\s+(?:default\s+)?)?'
    r'(?:(?P<async>async)\s+)?'
    r'(?:(?P<kind>class|function)\s+(?P<name>[A-Za-z][A-Za-z0-9_]*)\s*(?P<params>\([^;{]*\))?'
    r'|const\s+(?P<cname>[A-Za-z][A-Za-z0-9_]*)\s*=\s*(?:async\s*)?(?P<cparams>\([^=;]*\)|[A-Za-z0-9_]+)\s*=>)',
    re.MULTILINE,
)

_CALL_SITE_RE = re.compile(r'\b(?P<ident>[A-Za-z0-9_$]+)\s*\(', re.MULTILINE)


def extract_preceding_jsdoc(lines: List[str], target_line_idx: int) -> Tuple[str, int]:
    """Returns (first_sentence_jsdoc, earliest_start_line_1based) preceding target_line_idx (0-based)."""
    idx = target_line_idx - 1
    while idx >= 0 and not lines[idx].strip():
        idx -= 1
    if idx < 0:
        return "", target_line_idx + 1
    if lines[idx].strip().endswith("*/"):
        end_comment = idx
        while idx >= 0 and "/*" not in lines[idx]:
            idx -= 1
        if idx >= 0:
            block = "\n".join(lines[idx:end_comment + 1])
            block = re.sub(r'^/\*+|\*+/$', '', block.strip())
            return first_sentence(block), idx + 1
    elif lines[idx].strip().startswith("//"):
        comment_lines = []
        while idx >= 0 and lines[idx].strip().startswith("//"):
            comment_lines.insert(0, lines[idx].strip().lstrip("/").strip())
            idx -= 1
        return first_sentence("\n".join(comment_lines)), idx + 2
    return "", target_line_idx + 1


class JavaScriptLanguageProvider(BaseLanguageProvider):
    """Resilient JS/TS language provider with regex-based AST extraction and brace balancing."""

    def describe_file(self, filepath: str, content: str) -> str:
        lines = (content or "").splitlines()
        idx = 0
        if lines and lines[0].startswith("#!"):
            idx = 1
        while idx < len(lines) and (not lines[idx].strip() or _JS_PATH_COMMENT_RE.match(lines[idx].strip())):
            idx += 1
        if idx >= len(lines):
            return ""

        block_text = ""
        end_idx = idx
        first = lines[idx].strip()
        if first.startswith("/**"):
            while end_idx < len(lines) and "*/" not in lines[end_idx]:
                end_idx += 1
            if end_idx >= len(lines):
                return ""
            block = "\n".join(lines[idx:end_idx + 1]).strip()
            block_text = re.sub(r'^/\*+|\*+/$', '', block).strip()
        elif first.startswith("//"):
            comment_lines = []
            while end_idx < len(lines) and lines[end_idx].strip().startswith("//"):
                stripped = lines[end_idx].strip()
                if not _JS_PATH_COMMENT_RE.match(stripped):
                    comment_lines.append(stripped.lstrip("/").strip())
                end_idx += 1
            end_idx -= 1
            block_text = "\n".join(comment_lines)
        else:
            return ""

        next_idx = end_idx + 1
        if next_idx < len(lines):
            next_line = lines[next_idx].strip()
            if next_line and not next_line.startswith(("import ", "import{", "'use strict'", '"use strict"')):
                return ""
        return first_sentence(block_text)

    def imports(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        results = []
        for m in _IMPORT_RE.finditer(content or ""):
            mod = m.group("module") or m.group("req_module") or ""
            named = m.group("named") or m.group("req_named")
            default = m.group("default")
            ns = m.group("namespace")
            names = []
            if default:
                names.append(default)
            if ns:
                names.append(ns)
            if named:
                names.extend([n.strip().split()[0] for n in named.split(",") if n.strip()])
            line_no = content.count("\n", 0, m.start()) + 1
            results.append({
                "module": mod,
                "names": names,
                "is_from": True,
                "line": line_no,
            })
        return results

    def exports(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        results = []
        for m in _EXPORT_RE.finditer(content or ""):
            name = m.group("name")
            kind = m.group("kind") or "export"
            line_no = content.count("\n", 0, m.start()) + 1
            if name:
                results.append({"name": name, "kind": kind, "line": line_no})
            elif m.group("decl"):
                for sym in m.group("decl").strip("{} ").split(","):
                    clean = sym.strip().split()[0]
                    if clean:
                        results.append({"name": clean, "kind": "export", "line": line_no})
        return results

    def definitions(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        lines = (content or "").splitlines()
        symbols: List[Dict[str, Any]] = []
        seen_names = set()
        for m in _DEFINITION_RE.finditer(content or ""):
            indent = m.group("indent") or ""
            if len(indent) > 0:
                continue
            name = m.group("name") or m.group("cname") or ""
            if not name or name.startswith("_") or name in seen_names:
                continue
            seen_names.add(name)
            line_idx = content.count("\n", 0, m.start())
            kind = m.group("kind")
            if kind == "class":
                sig = f"class {name}"
            else:
                raw_params = (m.group("params") or m.group("cparams") or "()").strip()
                if not raw_params.startswith("("):
                    raw_params = f"({raw_params})"
                clean_params = re.sub(r'\s+', ' ', raw_params)
                if len(clean_params) > 36:
                    clean_params = clean_params[:33].rstrip() + "...)"
                sig = f"function {name}{clean_params}"
            doc, start_line = extract_preceding_jsdoc(lines, line_idx)
            end_line = find_brace_balanced_end(lines, line_idx)
            full_slice = "\n".join(lines[max(0, line_idx):min(len(lines), end_line)])
            snippet = "\n".join(lines[max(0, start_line - 1):min(len(lines), start_line - 1 + 30)])
            symbols.append({
                "name": name,
                "kind": "class" if kind == "class" else "function",
                "signature": sig,
                "docstring": doc,
                "start_line": start_line,
                "end_line": end_line,
                "snippet": snippet,
                "body_hash": compute_normalized_text_body_hash(full_slice),
                "top_level": True,
            })
        return symbols

    def extract_symbol_slice(self, filepath: str, content: str, symbol_query: str) -> Optional[Dict[str, Any]]:
        clean_query = symbol_query.strip()
        if clean_query.startswith(("def ", "async def ", "class ", "function ")):
            clean_query = clean_query.split("(")[0].split()[-1].strip()
        elif "(" in clean_query:
            clean_query = clean_query.split("(", 1)[0].strip()

        lines = (content or "").splitlines()
        target_class, _, target_member = clean_query.partition(".")
        search_name = target_member or target_class
        for sym in self.definitions(filepath, content):
            if sym["name"] == search_name:
                s_line = sym["start_line"]
                e_line = sym["end_line"]
                return {
                    "symbol": sym["name"],
                    "signature": sym["signature"],
                    "start_line": s_line,
                    "end_line": e_line,
                    "source": "\n".join(lines[s_line - 1:e_line]),
                }

        method_pat = re.compile(
            r'^[ \t]*(?:export\s+)?(?:static\s+)?(?:async\s+)?(?:function\s+|class\s+)?'
            + re.escape(search_name)
            + r'\s*(?:\([^;{]*\))?\s*\{',
            re.MULTILINE,
        )
        m = method_pat.search(content or "")
        if m:
            line_idx = content.count("\n", 0, m.start())
            _, s_line = extract_preceding_jsdoc(lines, line_idx)
            e_line = find_brace_balanced_end(lines, line_idx)
            return {
                "symbol": clean_query,
                "signature": clean_query,
                "start_line": s_line,
                "end_line": e_line,
                "source": "\n".join(lines[s_line - 1:e_line]),
            }
        return None

    def call_sites(self, filepath: str, content: str) -> Set[str]:
        calls = set()
        for m in _CALL_SITE_RE.finditer(content or ""):
            ident = m.group("ident")
            if ident and ident not in ("if", "for", "while", "switch", "catch", "function"):
                calls.add(ident)
        return calls

    def scope_boundaries(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        lines = (content or "").splitlines()
        scopes = []
        for m in _DEFINITION_RE.finditer(content or ""):
            name = m.group("name") or m.group("cname")
            if not name:
                continue
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

        for m in _DEFINITION_RE.finditer(content or ""):
            name = m.group("name") or m.group("cname")
            kind = m.group("kind")
            if not name or name in clean_requested:
                continue
            if kind == "class":
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
