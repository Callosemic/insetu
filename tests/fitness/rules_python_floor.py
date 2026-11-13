"""Checks that every Python file still runs on the oldest Python the project supports.

The developer machine and the newest CI row run a newer Python than the floor in pyproject.toml's
`requires-python`, so syntax or standard-library names that only newer versions accept pass every local run
and then fail on the oldest CI row (an f-string with a backslash inside its braces did exactly that). This
rule reads the floor from pyproject.toml and reports, from any Python version, what the floor would reject.
"""
import ast
import io
import re
import sys
import tokenize
from typing import List, Optional, Tuple

from .core import BACKEND_DIR, PROJECT_ROOT, collect_unique_files, report_violation

DEFAULT_FLOOR = (3, 10)
# Standard-library names newer than Python 3.10: {module: {name: first version}}; "" is the module itself.
NEWER_STDLIB = {
    "tomllib": {"": (3, 11)},
    "typing": {
        "Self": (3, 11), "Never": (3, 11), "LiteralString": (3, 11), "assert_never": (3, 11), "assert_type": (3, 11),
        "reveal_type": (3, 11), "NotRequired": (3, 11), "Required": (3, 11), "TypeVarTuple": (3, 11), "Unpack": (3, 11),
        "dataclass_transform": (3, 11), "override": (3, 12), "TypeAliasType": (3, 12), "ReadOnly": (3, 13),
    },
    "enum": {"StrEnum": (3, 11), "ReprEnum": (3, 11), "verify": (3, 11), "member": (3, 11), "nonmember": (3, 11)},
    "datetime": {"UTC": (3, 11)},
    "itertools": {"batched": (3, 12)},
    "asyncio": {"TaskGroup": (3, 11), "timeout": (3, 11), "Runner": (3, 11)},
    "contextlib": {"chdir": (3, 11)},
    "warnings": {"deprecated": (3, 13)},
}


def read_python_floor(pyproject_text: Optional[str]) -> Tuple[int, int]:
    """Returns the oldest supported Python from a pyproject.toml's `requires-python = ">=3.x"`, or the default."""
    match = re.search(r'^requires-python\s*=\s*["\'][^"\']*>=\s*(\d+)\.(\d+)', pyproject_text or "", re.MULTILINE)
    return (int(match.group(1)), int(match.group(2))) if match else DEFAULT_FLOOR


def _fstring_violations(source: str) -> List[Tuple[int, str]]:
    """Finds f-string forms that only Python 3.12 and newer accept (PEP 701): inside the braces, a backslash,
    a comment, the f-string's own quote, or a line break in a single-line f-string."""
    if sys.version_info < (3, 12):
        return []  # Older interpreters reject these forms themselves, and compile() reports them.
    found: List[Tuple[int, str]] = []
    stack: List[dict] = []  # one entry per open f-string: its quote and how deep in braces we are
    try:
        tokens = list(tokenize.generate_tokens(io.StringIO(source).readline))
    except (tokenize.TokenError, SyntaxError, IndentationError):
        return []
    for tok in tokens:
        if tok.type == tokenize.FSTRING_START:
            if stack and stack[-1]["depth"] > 0:
                _check_field_token(stack[-1], tok, found)
            quote = tok.string.lstrip("rRbBfFuU")
            stack.append({"quote": quote, "depth": 0})
            continue
        if not stack:
            continue
        frame = stack[-1]
        if tok.type == tokenize.FSTRING_END:
            stack.pop()
        elif tok.type == tokenize.FSTRING_MIDDLE:
            continue  # literal text and format specs were always allowed to hold anything
        elif tok.type == tokenize.OP and tok.string in "{[(":
            frame["depth"] += 1
        elif tok.type == tokenize.OP and tok.string in "}])":
            frame["depth"] -= 1
        elif frame["depth"] > 0:
            _check_field_token(frame, tok, found)
    return found


def _check_field_token(frame: dict, tok, found: List[Tuple[int, str]]) -> None:
    line = tok.start[0]
    if tok.type == tokenize.COMMENT:
        found.append((line, "a comment inside an f-string's braces"))
    elif tok.type in (tokenize.NL, tokenize.NEWLINE):
        if len(frame["quote"]) == 1:
            found.append((line, "a line break inside the braces of a single-line f-string"))
    elif "\\" in tok.string:
        found.append((line, "a backslash inside an f-string's braces (build the value on its own line first)"))
    elif frame["quote"] in tok.string:
        found.append((line, f"the f-string's own quote ({frame['quote']}) reused inside its braces"))


def _stdlib_violations(tree: ast.AST, floor: Tuple[int, int]) -> List[Tuple[int, str]]:
    found: List[Tuple[int, str]] = []

    def check(module: str, name: str, line: int) -> None:
        since = NEWER_STDLIB.get(module, {}).get(name)
        if since and since > floor:
            label = module if not name else f"{module}.{name}"
            found.append((line, f"{label} needs Python {since[0]}.{since[1]}"))

    guarded = set()
    for node in ast.walk(tree):
        # A fallback import (try: newer / except ImportError: older) is the supported way to use a newer name.
        if isinstance(node, ast.Try) and any(
            h.type is None or any(name in ast.dump(h.type) for name in ("ImportError", "ModuleNotFoundError"))
            for h in node.handlers
        ):
            guarded.update(id(n) for stmt in node.body for n in ast.walk(stmt))
    for node in ast.walk(tree):
        if id(node) in guarded:
            continue
        if isinstance(node, ast.Import):
            for alias in node.names:
                check(alias.name.split(".")[0], "", node.lineno)
        elif isinstance(node, ast.ImportFrom) and node.module and not node.level:
            root = node.module.split(".")[0]
            check(root, "", node.lineno)
            for alias in node.names:
                check(root, alias.name, node.lineno)
        elif isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name):
            check(node.value.id, node.attr, node.lineno)
    return found


def floor_violations(source: str, floor: Tuple[int, int] = DEFAULT_FLOOR) -> List[Tuple[int, str]]:
    """Returns (line, reason) for everything in `source` that the floor Python version would reject."""
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return [(exc.lineno or 1, f"does not parse on Python {sys.version_info[0]}.{sys.version_info[1]}: {exc.msg}")]
    found: List[Tuple[int, str]] = []
    try:
        ast.parse(source, feature_version=floor)
    except SyntaxError as exc:
        found.append((exc.lineno or 1, exc.msg))
    found.extend(_fstring_violations(source))
    found.extend(_stdlib_violations(tree, floor))
    return sorted(set(found))


def check_python_version_floor() -> None:
    pyproject = PROJECT_ROOT / "pyproject.toml"
    floor = read_python_floor(pyproject.read_text(encoding="utf-8") if pyproject.is_file() else None)
    print(f"🔍 Checking Python files against the supported floor (Python {floor[0]}.{floor[1]})...")
    roots = [BACKEND_DIR, PROJECT_ROOT / "tests", PROJECT_ROOT / "scripts"]
    for filepath in collect_unique_files([r for r in roots if r.exists()], [".py"]):
        if "__pycache__" in filepath.parts or "venv" in str(filepath):
            continue
        try:
            source = filepath.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for line, reason in floor_violations(source, floor):
            report_violation(
                "PYTHON_VERSION_FLOOR", filepath, line,
                f"Python {floor[0]}.{floor[1]} (the floor in pyproject.toml) rejects this: {reason}.",
            )
