"""JavaScript and TypeScript language provider for ES/CommonJS imports, exports, JSDoc, and interface slicing."""

import re
from typing import Any, Dict, List, Optional, Set, Tuple

import threading

from .base import (
    BaseLanguageProvider,
    compute_normalized_text_body_hash,
    find_brace_balanced_end,
    first_sentence,
)

try:
    from tree_sitter import Language as _TSLanguage, Parser as _TSParser
    import tree_sitter_javascript as _ts_javascript
except ImportError:
    _TSLanguage = None
    _TSParser = None
    _ts_javascript = None

_JS_TS_LOCAL = threading.local()


def _get_js_ts_parser():
    if not _TSLanguage or not _TSParser or not _ts_javascript:
        return None
    parser = getattr(_JS_TS_LOCAL, "parser", None)
    if parser is None:
        parser = _TSParser(_TSLanguage(_ts_javascript.language()))
        _JS_TS_LOCAL.parser = parser
    return parser


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
    r'(?:(?P<kind>class|function)\s+(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)\s*(?P<params>\([^\n]*\))?'
    r'|(?:const|let|var)\s+(?P<cname>[A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:(?P<cparams>\([^=;]*\)|[A-Za-z0-9_$]+)\s*=>|(?P<ccall>[A-Za-z0-9_$.]+\s*\()))',
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

    def _definitions_via_treesitter(self, content: str, include_private: bool = False) -> Optional[List[Dict[str, Any]]]:
        parser = _get_js_ts_parser()
        if parser is None:
            return None
        source_bytes = (content or "").encode("utf-8")
        tree = parser.parse(source_bytes)
        lines = (content or "").splitlines()
        symbols: List[Dict[str, Any]] = []
        seen_names: Set[str] = set()

        def _node_text(n) -> str:
            return source_bytes[n.start_byte:n.end_byte].decode("utf-8", errors="replace")

        for top_node in tree.root_node.children:
            stmt_node = top_node
            inner = top_node
            if top_node.type == "export_statement":
                decl = top_node.child_by_field_name("declaration")
                if decl is not None:
                    inner = decl
                else:
                    continue

            name = ""
            kind = "function"
            sig = ""

            if inner.type in ("function_declaration", "generator_function_declaration"):
                name_node = inner.child_by_field_name("name")
                name = _node_text(name_node).strip() if name_node else ""
                params_node = inner.child_by_field_name("parameters")
                raw_params = _node_text(params_node).strip() if params_node else "()"
                clean_params = re.sub(r'\s+', ' ', raw_params)
                if len(clean_params) > 36:
                    clean_params = clean_params[:33].rstrip() + "...)"
                sig = f"function {name}{clean_params}"
            elif inner.type == "class_declaration":
                name_node = inner.child_by_field_name("name")
                name = _node_text(name_node).strip() if name_node else ""
                kind = "class"
                sig = f"class {name}"
            elif inner.type in ("lexical_declaration", "variable_declaration"):
                declarators = [c for c in inner.children if c.type == "variable_declarator"]
                if len(declarators) != 1:
                    continue
                decl_node = declarators[0]
                name_node = decl_node.child_by_field_name("name")
                val_node = decl_node.child_by_field_name("value")
                if not name_node or name_node.type != "identifier" or not val_node:
                    continue
                name = _node_text(name_node).strip()
                if val_node.type == "arrow_function":
                    params_node = val_node.child_by_field_name("parameters") or val_node.child_by_field_name("parameter")
                    raw_params = _node_text(params_node).strip() if params_node else "()"
                    if not raw_params.startswith("("):
                        raw_params = f"({raw_params})"
                    clean_params = re.sub(r'\s+', ' ', raw_params)
                    if len(clean_params) > 36:
                        clean_params = clean_params[:33].rstrip() + "...)"
                    sig = f"function {name}{clean_params}"
                elif include_private:
                    kind = "variable"
                    sig = f"const {name}"
                else:
                    continue
            else:
                continue

            if not name or name in seen_names:
                continue
            if not include_private and name.startswith("_"):
                continue
            seen_names.add(name)

            line_idx = stmt_node.start_point[0]
            end_line = stmt_node.end_point[0] + 1
            doc, start_line = extract_preceding_jsdoc(lines, line_idx)
            full_slice = "\n".join(lines[max(0, line_idx):min(len(lines), end_line)])
            snippet = "\n".join(lines[max(0, start_line - 1):min(len(lines), start_line - 1 + 30)])
            symbols.append({
                "name": name,
                "kind": kind,
                "signature": sig,
                "docstring": doc,
                "start_line": start_line,
                "end_line": end_line,
                "snippet": snippet,
                "body_hash": compute_normalized_text_body_hash(full_slice),
                "top_level": not name.startswith("_") and kind in ("class", "function"),
            })
        return symbols

    def definitions(self, filepath: str, content: str, include_private: bool = False) -> List[Dict[str, Any]]:
        ts_defs = self._definitions_via_treesitter(content or "", include_private=include_private)
        if ts_defs is not None:
            return ts_defs
        lines = (content or "").splitlines()
        symbols: List[Dict[str, Any]] = []
        seen_names = set()
        for m in _DEFINITION_RE.finditer(content or ""):
            indent = m.group("indent") or ""
            if len(indent) > 0:
                continue
            name = m.group("name") or m.group("cname") or ""
            if not name or (not include_private and name.startswith("_")) or name in seen_names:
                continue
            if m.group("ccall") and not include_private:
                continue
            seen_names.add(name)
            line_idx = content.count("\n", 0, m.start())
            kind = m.group("kind")
            if kind == "class":
                sig = f"class {name}"
            elif m.group("ccall"):
                sig = f"const {name}"
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
                "top_level": not name.startswith("_"),
            })
        return symbols

    def extract_symbol_slice(self, filepath: str, content: str, symbol_query: str) -> Optional[Dict[str, Any]]:
        clean_query = symbol_query.strip()
        if clean_query.startswith(("def ", "async def ", "class ", "function ", "const ", "let ", "var ")):
            clean_query = clean_query.split("(")[0].split()[-1].strip()
        elif "(" in clean_query:
            clean_query = clean_query.split("(", 1)[0].strip()

        lines = (content or "").splitlines()
        target_class, _, target_member = clean_query.partition(".")
        search_name = target_member or target_class
        if not target_member:
            for sym in self.definitions(filepath, content, include_private=True):
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
            r'^[ \t]*(?:export\s+(?:default\s+)?)?(?:static\s+)?(?:async\s+)?'
            r'(?:(?:function|class|const|let|var)\s+)?'
            + re.escape(search_name)
            + r'\b[ \t]*(?:\(|=|\{ extends\b)',
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
