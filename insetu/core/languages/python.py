"""Python language provider implementing the BaseLanguageProvider contract via stdlib ast."""

import ast
import hashlib
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from .base import BaseLanguageProvider, first_sentence


def format_py_signature(node: ast.AST) -> str:
    """Formats a canonical, coordinate-free Python class or function signature."""
    if isinstance(node, ast.ClassDef):
        bases = []
        for b in node.bases[:2]:
            try:
                bases.append(ast.unparse(b))
            except Exception:
                pass
        base_str = f"({', '.join(bases)})" if bases else ""
        return f"class {node.name}{base_str}"
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
        arg_names = [a.arg for a in node.args.args if a.arg not in ("self", "cls")]
        if len(arg_names) > 4:
            args_str = ", ".join(arg_names[:4]) + ", ..."
        else:
            args_str = ", ".join(arg_names)
        if node.args.kwarg and len(arg_names) <= 4:
            args_str = f"{args_str}, **{node.args.kwarg.arg}" if args_str else f"**{node.args.kwarg.arg}"
        return f"{prefix} {node.name}({args_str})"
    return ""


def compute_normalized_py_body_hash(node: ast.AST, fallback_slice: str) -> str:
    """Computes an 8-char SHA-256 hash of a Python AST node's body (excluding leading docstring)."""
    try:
        body_stmts = list(getattr(node, "body", []) or [])
        if (
            body_stmts
            and isinstance(body_stmts[0], ast.Expr)
            and isinstance(getattr(body_stmts[0], "value", None), ast.Constant)
            and isinstance(body_stmts[0].value.value, str)
        ):
            body_stmts = body_stmts[1:]
        norm_parts = [ast.unparse(stmt).strip() for stmt in body_stmts]
        norm_text = "\n".join(p for p in norm_parts if p)
    except Exception:
        norm_text = re.sub(r'\s+', ' ', fallback_slice).strip()
    return hashlib.sha256(norm_text.encode("utf-8")).hexdigest()[:8]


class PythonLanguageProvider(BaseLanguageProvider):
    """Python AST language provider with zero external package dependencies."""

    def _parse_tree(self, content: str) -> Optional[ast.AST]:
        try:
            return ast.parse(content)
        except SyntaxError:
            return None

    def describe_file(self, filepath: str, content: str) -> str:
        tree = self._parse_tree(content)
        if not tree:
            return ""
        module_doc = first_sentence(ast.get_docstring(tree))
        if module_doc:
            return module_doc
        if Path(filepath).name.startswith("test_"):
            for node in tree.body:
                if isinstance(node, ast.ClassDef):
                    class_doc = first_sentence(ast.get_docstring(node))
                    if class_doc:
                        return class_doc
        return ""

    def imports(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        tree = self._parse_tree(content)
        if not tree:
            return []
        results = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    results.append({
                        "module": alias.name,
                        "names": [alias.asname or alias.name],
                        "is_from": False,
                        "line": getattr(node, "lineno", 1),
                    })
            elif isinstance(node, ast.ImportFrom):
                results.append({
                    "module": node.module or "",
                    "level": node.level,
                    "names": [alias.name for alias in node.names],
                    "is_from": True,
                    "line": getattr(node, "lineno", 1),
                })
        return results

    def exports(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        tree = self._parse_tree(content)
        if not tree:
            return []
        all_var: Optional[List[str]] = None
        for node in tree.body:
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id == "__all__":
                        try:
                            all_var = [ast.literal_eval(elt) for elt in getattr(node.value, "elts", [])]
                        except Exception:
                            pass

        if all_var is not None:
            return [{"name": name, "kind": "export", "line": 1} for name in all_var if isinstance(name, str)]

        public_symbols = []
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                if not node.name.startswith("_"):
                    kind = "class" if isinstance(node, ast.ClassDef) else "function"
                    public_symbols.append({"name": node.name, "kind": kind, "line": node.lineno})
        return public_symbols

    def top_level_symbols(self, filepath: str, content: str) -> Optional[List[Dict[str, Any]]]:
        tree = self._parse_tree(content)
        if tree is None:
            return None
        lines = content.splitlines()
        symbols: List[Dict[str, Any]] = []
        for node in tree.body:
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.name.startswith("_"):
                    continue
                sig = format_py_signature(node)
                if not sig:
                    continue
                doc = first_sentence(ast.get_docstring(node))
                start_line = min(
                    [node.lineno] + [getattr(d, "lineno", node.lineno) for d in getattr(node, "decorator_list", [])]
                )
                end_line = getattr(node, "end_lineno", node.lineno) or node.lineno
                full_slice = "\n".join(lines[max(0, start_line - 1):min(len(lines), end_line)])
                snippet = "\n".join(lines[max(0, start_line - 1):min(len(lines), start_line - 1 + 30)])
                symbols.append({
                    "name": node.name,
                    "kind": "class" if isinstance(node, ast.ClassDef) else "function",
                    "signature": sig,
                    "docstring": doc,
                    "start_line": start_line,
                    "end_line": end_line,
                    "snippet": snippet,
                    "body_hash": compute_normalized_py_body_hash(node, full_slice),
                    "top_level": True,
                })
        return symbols

    def definitions(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        tree = self._parse_tree(content)
        if not tree:
            return []
        lines = content.splitlines()
        defs = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                doc = first_sentence(ast.get_docstring(node))
                sig = format_py_signature(node)
                start_line = min(
                    [node.lineno] + [getattr(d, "lineno", node.lineno) for d in getattr(node, "decorator_list", [])]
                )
                end_line = getattr(node, "end_lineno", node.lineno) or node.lineno
                full_slice = "\n".join(lines[max(0, start_line - 1):min(len(lines), end_line)])
                defs.append({
                    "name": node.name,
                    "kind": "class",
                    "signature": sig,
                    "docstring": doc,
                    "start_line": start_line,
                    "end_line": end_line,
                    "snippet": "\n".join(lines[max(0, start_line - 1):min(len(lines), start_line - 1 + 30)]),
                    "body_hash": compute_normalized_py_body_hash(node, full_slice),
                    "top_level": not node.name.startswith("_"),
                })
                for child in node.body:
                    if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        c_doc = first_sentence(ast.get_docstring(child))
                        c_sig = format_py_signature(child)
                        c_start = min(
                            [child.lineno] + [getattr(d, "lineno", child.lineno) for d in getattr(child, "decorator_list", [])]
                        )
                        c_end = getattr(child, "end_lineno", child.lineno) or child.lineno
                        c_slice = "\n".join(lines[max(0, c_start - 1):min(len(lines), c_end)])
                        defs.append({
                            "name": f"{node.name}.{child.name}",
                            "kind": "method",
                            "signature": c_sig,
                            "docstring": c_doc,
                            "start_line": c_start,
                            "end_line": c_end,
                            "snippet": "\n".join(lines[max(0, c_start - 1):min(len(lines), c_start - 1 + 30)]),
                            "body_hash": compute_normalized_py_body_hash(child, c_slice),
                            "top_level": False,
                        })
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                f_doc = first_sentence(ast.get_docstring(node))
                f_sig = format_py_signature(node)
                start_line = min(
                    [node.lineno] + [getattr(d, "lineno", node.lineno) for d in getattr(node, "decorator_list", [])]
                )
                end_line = getattr(node, "end_lineno", node.lineno) or node.lineno
                full_slice = "\n".join(lines[max(0, start_line - 1):min(len(lines), end_line)])
                defs.append({
                    "name": node.name,
                    "kind": "function",
                    "signature": f_sig,
                    "docstring": f_doc,
                    "start_line": start_line,
                    "end_line": end_line,
                    "snippet": "\n".join(lines[max(0, start_line - 1):min(len(lines), start_line - 1 + 30)]),
                    "body_hash": compute_normalized_py_body_hash(node, full_slice),
                    "top_level": not node.name.startswith("_"),
                })
        return defs

    def extract_symbol_slice(self, filepath: str, content: str, symbol_query: str) -> Optional[Dict[str, Any]]:
        clean_query = symbol_query.strip()
        if clean_query.startswith(("def ", "async def ", "class ", "function ")):
            clean_query = clean_query.split("(")[0].split()[-1].strip()
        elif "(" in clean_query:
            clean_query = clean_query.split("(", 1)[0].strip()

        try:
            tree = ast.parse(content)
        except SyntaxError as e:
            raise ValueError(f"SyntaxError in '{filepath}' at line {e.lineno}: {e.msg}") from e

        lines = content.splitlines()
        target_class, _, target_member = clean_query.partition(".")
        for node in tree.body:
            if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                if not target_member and node.name == target_class:
                    start_line = min(
                        [node.lineno] + [getattr(d, "lineno", node.lineno) for d in getattr(node, "decorator_list", [])]
                    )
                    end_line = getattr(node, "end_lineno", node.lineno) or node.lineno
                    while start_line > 1 and lines[start_line - 2].strip().startswith("#"):
                        start_line -= 1
                    return {
                        "symbol": node.name,
                        "signature": format_py_signature(node),
                        "start_line": start_line,
                        "end_line": end_line,
                        "source": "\n".join(lines[start_line - 1:end_line]),
                    }
                if isinstance(node, ast.ClassDef) and (node.name == target_class or not target_member):
                    method_name = target_member if target_member else target_class
                    for child in node.body:
                        if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and child.name == method_name:
                            if target_member and node.name != target_class:
                                continue
                            start_line = min(
                                [child.lineno] + [getattr(d, "lineno", child.lineno) for d in getattr(child, "decorator_list", [])]
                            )
                            end_line = getattr(child, "end_lineno", child.lineno) or child.lineno
                            return {
                                "symbol": f"{node.name}.{child.name}",
                                "signature": format_py_signature(child),
                                "start_line": start_line,
                                "end_line": end_line,
                                "source": "\n".join(lines[start_line - 1:end_line]),
                            }
        return None

    def call_sites(self, filepath: str, content: str) -> Set[str]:
        tree = self._parse_tree(content)
        if not tree:
            return set()
        calls = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    calls.add(node.func.id)
                elif isinstance(node.func, ast.Attribute):
                    calls.add(node.func.attr)
        return calls

    def scope_boundaries(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        tree = self._parse_tree(content)
        if not tree:
            return []
        scopes = []
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                body_start = node.lineno
                if node.body:
                    body_start = node.body[0].lineno
                scopes.append({
                    "name": getattr(node, "name", "anonymous"),
                    "start_line": node.lineno,
                    "end_line": getattr(node, "end_lineno", node.lineno),
                    "body_start_line": body_start,
                    "body_end_line": getattr(node, "end_lineno", node.lineno),
                })
        return scopes

    def slice_interface(self, filepath: str, content: str, requested_symbols: Optional[List[str]] = None) -> str:
        tree = self._parse_tree(content)
        if not tree:
            return content

        lines = content.splitlines()
        cuts: List[Tuple[int, int, str]] = []
        clean_requested = set(requested_symbols or [])

        def process_body(stmts: List[ast.stmt], indent_str: str = "    ") -> None:
            if not stmts:
                return
            start_idx = 0
            if (
                isinstance(stmts[0], ast.Expr)
                and isinstance(getattr(stmts[0], "value", None), ast.Constant)
                and isinstance(stmts[0].value.value, str)
            ):
                start_idx = 1
            if start_idx < len(stmts):
                s_node = stmts[start_idx]
                e_node = stmts[-1]
                s_line = s_node.lineno - 1
                e_line = getattr(e_node, "end_lineno", e_node.lineno)
                cuts.append((s_line, e_line, f"{indent_str}...  # implementation omitted"))

        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.name in clean_requested:
                    continue
                indent = " " * (node.col_offset + 4)
                process_body(node.body, indent)
            elif isinstance(node, ast.ClassDef):
                for child in node.body:
                    if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        sym_name = f"{node.name}.{child.name}"
                        if child.name in clean_requested or sym_name in clean_requested:
                            continue
                        indent = " " * (child.col_offset + 4)
                        process_body(child.body, indent)

        cuts.sort(key=lambda c: c[0], reverse=True)
        res_lines = list(lines)
        for s_line, e_line, rep in cuts:
            res_lines[s_line:e_line] = [rep]
        return "\n".join(res_lines)
