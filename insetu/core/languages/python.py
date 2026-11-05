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

    @staticmethod
    def collect_top_level_bound_names(stmt: ast.stmt) -> Dict[str, int]:
        """Collects names bound at module import time by a top-level statement without descending into deferred def, class, or lambda bodies."""
        bound: Dict[str, int] = {}
        if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            bound[stmt.name] = stmt.lineno
            return bound
        if isinstance(stmt, (ast.Import, ast.ImportFrom)):
            for alias in stmt.names:
                bound[alias.asname or alias.name.split(".")[0]] = stmt.lineno
            return bound

        def _walk_bindings(node: ast.AST) -> None:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                bound.setdefault(node.name, getattr(node, "lineno", stmt.lineno))
                return
            if isinstance(node, ast.Lambda):
                return
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    bound.setdefault(alias.asname or alias.name.split(".")[0], getattr(node, "lineno", stmt.lineno))
                return
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
                bound.setdefault(node.id, getattr(node, "lineno", stmt.lineno))
            elif isinstance(node, ast.ExceptHandler) and node.name:
                bound.setdefault(node.name, getattr(node, "lineno", stmt.lineno))
            for child in ast.iter_child_nodes(node):
                _walk_bindings(child)

        _walk_bindings(stmt)
        return bound

    @classmethod
    def iter_import_time_load_names(cls, stmt: ast.stmt) -> List[Tuple[str, int]]:
        """
        Returns (name, lineno) pairs for ast.Name nodes in Load context that execute at module import time.
        Skips deferred function, method, and lambda bodies (including functions/classes nested inside if/try/with blocks)
        while still inspecting their import-time decorators, default argument values, and class bases/keywords.
        """
        loads: List[Tuple[str, int]] = []

        def _walk_import_time(node: ast.AST, local_using_scope: Set[str]) -> None:
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                return
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for dec in node.decorator_list:
                    _walk_import_time(dec, local_using_scope)
                for default_val in node.args.defaults:
                    _walk_import_time(default_val, local_using_scope)
                for kw_default in node.args.kw_defaults:
                    if kw_default is not None:
                        _walk_import_time(kw_default, local_using_scope)
                return
            if isinstance(node, ast.ClassDef):
                for dec in node.decorator_list:
                    _walk_import_time(dec, local_using_scope)
                for base in node.bases:
                    _walk_import_time(base, local_using_scope)
                for kw in node.keywords:
                    _walk_import_time(kw.value, local_using_scope)
                return
            if isinstance(node, ast.Lambda):
                for default_val in node.args.defaults:
                    _walk_import_time(default_val, local_using_scope)
                for kw_default in node.args.kw_defaults:
                    if kw_default is not None:
                        _walk_import_time(kw_default, local_using_scope)
                return
            if isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
                comp_locals = set(local_using_scope)
                for gen in node.generators:
                    _walk_import_time(gen.iter, comp_locals)
                    for sub_t in ast.walk(gen.target):
                        if isinstance(sub_t, ast.Name) and isinstance(sub_t.ctx, ast.Store):
                            comp_locals.add(sub_t.id)
                    for if_clause in gen.ifs:
                        _walk_import_time(if_clause, comp_locals)
                if isinstance(node, ast.DictComp):
                    _walk_import_time(node.key, comp_locals)
                    _walk_import_time(node.value, comp_locals)
                else:
                    _walk_import_time(node.elt, comp_locals)
                return
            if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
                if node.id not in local_using_scope:
                    loads.append((node.id, getattr(node, "lineno", getattr(stmt, "lineno", 1))))
                return
            for child in ast.iter_child_nodes(node):
                _walk_import_time(child, local_using_scope)

        _walk_import_time(stmt, set())
        return loads

    @classmethod
    def check_module_forward_refs(cls, tree: ast.Module) -> Optional[str]:
        """
        Detects top-level module execution statements that reference a symbol at import time
        before `def fn` / `class fn` / assignment binds it later in the module.
        """
        later_defined: Dict[str, int] = {}
        for stmt in tree.body:
            for name, lineno in cls.collect_top_level_bound_names(stmt).items():
                later_defined.setdefault(name, lineno)

        defined_so_far: Set[str] = set()
        for stmt in tree.body:
            for name, use_line in cls.iter_import_time_load_names(stmt):
                if name not in defined_so_far and name in later_defined and later_defined[name] > use_line:
                    return (
                        f"Line {use_line}: Module-level forward reference to '{name}' before its definition at line {later_defined[name]} "
                        f"(will raise NameError at import time)."
                    )
            defined_so_far.update(cls.collect_top_level_bound_names(stmt).keys())
        return None

    @classmethod
    def find_first_import_time_reference_line(cls, content: str, symbol: str) -> Optional[int]:
        """Finds the 1-based line number of the first top-level statement that references `symbol` at import time."""
        if not content or not symbol:
            return None
        try:
            tree = ast.parse(content)
        except SyntaxError:
            return None
        for stmt in tree.body:
            if any(name == symbol for name, _ in cls.iter_import_time_load_names(stmt)):
                return getattr(stmt, "lineno", None)
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
