"""Declarative routine condition evaluator, 256KB scratch vaulter, and Yomama block prose stripper."""
import ast
import re
from typing import Any, Dict, Optional, Tuple

from insetu.core.utils_core import resolve_context_var_path as _resolve_var_path

SCRATCH_VAULT_THRESHOLD_BYTES = 256 * 1024

_MUSTACHE_COND_RE = re.compile(r'\{\{\s*([a-zA-Z0-9_.\[\]-]+)(?:\s*\|\s*([^{}]*?))?\s*\}\}')

_YOMAMA_BLOCK_STRIP_RE = re.compile(
    r'(?:```(?:text|python|javascript|js|json|yaml|markdown|md)?[ \t]*\n)?'
    r'(?:[ \t]*(?:<[ \t]*){3,}FILE:[^\n]*\n)?'
    r'(?:[ \t]*(?:<[ \t]*){3,}ID:[^\n]*\n)?'
    r'(?:[ \t]*(?:<[ \t]*){3,}COMMENT\n[\s\S]*?\n)?'
    r'^[ \t]*(?:<[ \t]*){3,}(?:SEARCH(?:\s+REGEX)?|TEXTEDIT|JSON_PATCH|RELOCATE|RENAME|MOVE_FILE|ARCHIVE_FILE|DELETE_FILE|QUERY_CONTEXT|CALL_CAPABILITY)\b[\s\S]*?'
    r'^[ \t]*(?:>[ \t]*){1,}(?:REPLACE|EXECUTE)[ \t]*(?:\n[ \t]*(?:>[ \t]*)+$)*'
    r'(?:\n```)?',
    re.MULTILINE,
)


def normalize_condition_expr(
    raw_expr: str,
    chain_context: Optional[Dict[str, Any]] = None,
) -> Tuple[str, Dict[str, Any]]:
    """
    Token-safe normalizer for routine 'when' / 'condition' / 'until' expressions:
    1. Binds {{ path.to.var | fallback }} to synthetic __var_N__ identifiers.
    2. Rewrites 'LHS contains RHS' -> '(RHS in LHS)' outside string literals.
    """
    var_bindings: Dict[str, Any] = {}
    counter = 0

    def _sub_mustache(m):
        nonlocal counter
        expr = m.group(1).strip()
        fallback = m.group(2).strip() if m.group(2) is not None else None
        key = f"__var_{counter}__"
        counter += 1
        if chain_context is not None:
            val = _resolve_var_path(expr, chain_context)
            if (val is None or val == "") and fallback is not None:
                val = fallback.strip('\'"')
            var_bindings[key] = val
        else:
            var_bindings[key] = None
        return key

    sanitized = _MUSTACHE_COND_RE.sub(_sub_mustache, str(raw_expr or "").strip())
    if " contains " in sanitized:
        sanitized = re.sub(
            r'(\b__var_\d+__|\b[A-Za-z_][A-Za-z0-9_]*)\s+contains\s+("[^"]*"|\'[^\']*\'|\b__var_\d+__|\b[A-Za-z0-9_.-]+)',
            r'(\2 in \1)',
            sanitized,
        )
    return sanitized, var_bindings


def evaluate_when_condition(when_expr: Optional[str], chain_context: Dict[str, Any]) -> bool:
    """
    AST-restricted, zero-eval conditional evaluator for 'when' / 'condition' / 'until' expressions.
    Supports ==, !=, <, <=, >, >=, in, not in, contains, and, or, not over {{ var | default }} references and literals.
    """
    if not when_expr or not str(when_expr).strip():
        return True

    sanitized_expr, var_bindings = normalize_condition_expr(str(when_expr).strip(), chain_context)
    try:
        tree = ast.parse(sanitized_expr, mode="eval")
    except SyntaxError:
        return False

    def _eval_node(node: ast.AST) -> Any:
        if isinstance(node, ast.Expression):
            return _eval_node(node.body)
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.Name):
            if node.id in var_bindings:
                return var_bindings[node.id]
            if node.id == "true":
                return True
            if node.id == "false":
                return False
            if node.id == "null":
                return None
            return node.id
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            return not bool(_eval_node(node.operand))
        if isinstance(node, ast.BoolOp):
            if isinstance(node.op, ast.And):
                return all(bool(_eval_node(v)) for v in node.values)
            if isinstance(node.op, ast.Or):
                return any(bool(_eval_node(v)) for v in node.values)
        if isinstance(node, ast.List):
            return [_eval_node(elt) for elt in node.elts]
        if isinstance(node, ast.Tuple):
            return tuple(_eval_node(elt) for elt in node.elts)
        if isinstance(node, ast.Compare):
            left = _eval_node(node.left)
            for op, comp in zip(node.ops, node.comparators):
                right = _eval_node(comp)
                if isinstance(op, ast.Eq) and not (left == right):
                    return False
                elif isinstance(op, ast.NotEq) and not (left != right):
                    return False
                elif isinstance(op, ast.Gt):
                    try:
                        if not (float(left) > float(right)):
                            return False
                    except (TypeError, ValueError):
                        return False
                elif isinstance(op, ast.GtE):
                    try:
                        if not (float(left) >= float(right)):
                            return False
                    except (TypeError, ValueError):
                        return False
                elif isinstance(op, ast.Lt):
                    try:
                        if not (float(left) < float(right)):
                            return False
                    except (TypeError, ValueError):
                        return False
                elif isinstance(op, ast.LtE):
                    try:
                        if not (float(left) <= float(right)):
                            return False
                    except (TypeError, ValueError):
                        return False
                elif isinstance(op, ast.In) and not (right is not None and left in right):
                    return False
                elif isinstance(op, ast.NotIn) and not (right is None or left not in right):
                    return False
                left = right
            return True
        return False

    return bool(_eval_node(tree))


def vault_if_oversized(ctx, node_id: str, output_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    256KB Hybrid Memory Vaulting:
    Payloads < 256KB stay in-memory; strings >= 256KB are written to ephemeral scratch storage
    via ctx.jobs.write_scratch and referenced via _uri.
    """
    content_str = output_dict.get("content") or output_dict.get("text") or ""
    if not isinstance(content_str, str):
        return output_dict
    byte_len = len(content_str.encode("utf-8"))
    if byte_len < SCRATCH_VAULT_THRESHOLD_BYTES:
        return output_dict
    scratch_file = ctx.jobs.write_scratch(f"scratch_{node_id}.txt", content_str, ttl_seconds=3600, owner="agent_scratch")
    vaulted = dict(output_dict)
    vaulted["_uri"] = scratch_file
    vaulted["_vaulted_bytes"] = byte_len
    return vaulted


def strip_yomama_blocks_keep_prose(raw_text: str) -> str:
    """Strips raw Yomama patch/probe blocks and empty code fences while preserving surrounding conversational prose."""
    if not raw_text or "<<<<<<<" not in raw_text:
        return (raw_text or "").strip()
    cleaned = _YOMAMA_BLOCK_STRIP_RE.sub("\n", raw_text)
    cleaned = re.sub(r'^[ \t]*<<<<<<< FILE:[^\n]*$', '', cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r'```(?:text|python|javascript|js|json|yaml|markdown|md)?\s*```', '', cleaned)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip()
