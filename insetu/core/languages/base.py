"""Abstract base class defining the Language Provider Contract and shared AST/text normalization utilities."""

from abc import ABC, abstractmethod
import hashlib
import re
from typing import Any, Dict, List, Optional, Set

_REST_UNDERLINE_RE = re.compile(r'^[~=_-]{3,}$')
_BARE_MODULE_HEADER_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)+$')


def first_sentence(text: Optional[str]) -> str:
    """Normalizes the first sentence of a docstring or JSDoc comment for single-line index display, stripping reST/module headers."""
    if not text:
        return ""
    raw_lines = [re.sub(r'^\s*\*+\s?', '', l).strip() for l in text.strip().splitlines()]
    cleaned_lines = []
    for line in raw_lines:
        if not line or _REST_UNDERLINE_RE.match(line):
            if cleaned_lines:
                break
            continue
        if not cleaned_lines and _BARE_MODULE_HEADER_RE.match(line):
            continue
        if line.startswith('@'):
            if cleaned_lines:
                break
            continue
        cleaned_lines.append(line)
        if line.endswith('.'):
            break
    joined = " ".join(cleaned_lines).strip()
    if not joined:
        return ""
    sentence_match = re.match(r'^(.+?\.)(?:\s|$)', joined)
    summary = sentence_match.group(1) if sentence_match else joined
    return summary[:140].rstrip() + ("..." if len(summary) > 140 else "")


def compute_normalized_text_body_hash(source_slice: str) -> str:
    """Computes an 8-char SHA-256 hash of a brace-delimited symbol body with comments and whitespace normalized."""
    no_block = re.sub(r'/\*[\s\S]*?\*/', '', source_slice)
    no_line = re.sub(r'//[^\n]*', '', no_block)
    norm = re.sub(r'\s+', ' ', no_line).strip()
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()[:8]


_REGEX_PRECEDING_KEYWORDS = frozenset({
    "return", "typeof", "void", "delete", "case", "in", "of", "instanceof", "throw", "yield", "await", "new",
})
_REGEX_PRECEDING_CHARS = frozenset("({[=,;:!&|?~^%+*-<>")


def find_brace_balanced_end(lines: List[str], start_idx: int) -> int:
    """
    Scans forward from start_idx (0-based) to find the closing line (1-based) of a declaration or brace-delimited block.
    Tracks paren/bracket/brace depth, regex literals (with [...] character classes), and nested `${...}` template stacks.
    """
    brace_depth = 0
    paren_depth = 0
    bracket_depth = 0
    opened_body = False
    saw_progress = False
    in_str: Optional[str] = None
    in_block_comment = False
    in_regex = False
    in_regex_class = False
    template_expr_stack: List[int] = []
    prev_sig_char = ""
    prev_word = ""

    for idx in range(start_idx, len(lines)):
        line = lines[idx]
        i = 0
        n = len(line)
        while i < n:
            ch = line[i]
            nxt = line[i + 1] if i + 1 < n else ""
            if in_block_comment:
                if ch == "*" and nxt == "/":
                    in_block_comment = False
                    i += 2
                    continue
                i += 1
                continue
            if in_regex:
                if ch == "\\":
                    i += 2
                    continue
                if ch == "[":
                    in_regex_class = True
                elif ch == "]" and in_regex_class:
                    in_regex_class = False
                elif ch == "/" and not in_regex_class:
                    in_regex = False
                    prev_sig_char = "/"
                    prev_word = ""
                i += 1
                continue
            if in_str is not None:
                if ch == "\\":
                    i += 2
                    continue
                if in_str == "`" and ch == "$" and nxt == "{":
                    template_expr_stack.append(1)
                    in_str = None
                    prev_sig_char = "{"
                    prev_word = ""
                    i += 2
                    continue
                if ch == in_str:
                    in_str = None
                    prev_sig_char = ch
                    prev_word = ""
                i += 1
                continue

            if ch == "/" and nxt == "/":
                break
            if ch == "/" and nxt == "*":
                in_block_comment = True
                i += 2
                continue
            if ch == "/":
                can_start_regex = (
                    not prev_sig_char
                    or prev_sig_char in _REGEX_PRECEDING_CHARS
                    or prev_word in _REGEX_PRECEDING_KEYWORDS
                )
                if can_start_regex:
                    in_regex = True
                    in_regex_class = False
                    i += 1
                    continue
            if ch in ('"', "'", "`"):
                in_str = ch
                i += 1
                continue

            if template_expr_stack:
                if ch == "{":
                    template_expr_stack[-1] += 1
                elif ch == "}":
                    template_expr_stack[-1] -= 1
                    if template_expr_stack[-1] <= 0:
                        template_expr_stack.pop()
                        in_str = "`"
                        i += 1
                        continue

            if ch.isalpha() or ch in ("_", "$"):
                prev_word += ch
            else:
                if not ch.isspace():
                    prev_sig_char = ch
                    if not ch.isalnum():
                        prev_word = ""

            if not template_expr_stack:
                if ch == "(":
                    paren_depth += 1
                    saw_progress = True
                elif ch == ")":
                    paren_depth = max(0, paren_depth - 1)
                elif ch == "[":
                    bracket_depth += 1
                    saw_progress = True
                elif ch == "]":
                    bracket_depth = max(0, bracket_depth - 1)
                elif ch == "=" and nxt == ">":
                    saw_progress = True
                elif ch == "{":
                    if paren_depth == 0:
                        brace_depth += 1
                        opened_body = True
                        saw_progress = True
                elif ch == "}":
                    if paren_depth == 0 and opened_body:
                        brace_depth -= 1
                        if brace_depth <= 0 and bracket_depth == 0:
                            return idx + 1
            i += 1
        in_regex = False
        in_regex_class = False
        if (
            in_str is None
            and not in_block_comment
            and not template_expr_stack
            and paren_depth == 0
            and bracket_depth == 0
            and brace_depth <= 0
            and (opened_body or saw_progress or "=" in line)
            and line.rstrip().endswith(";")
        ):
            return idx + 1
    return min(len(lines), start_idx + 1)


class BaseLanguageProvider(ABC):
    """Abstract interface contract for language-specific AST inspection, symbol indexing, and interface slicing."""

    # False for document languages: parsed for retrieval and links, never mapped into CODE_INDEX.md.
    indexes_code_symbols: bool = True

    @abstractmethod
    def imports(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        """Extracts imported modules and symbol bindings from content."""
        raise NotImplementedError

    @abstractmethod
    def exports(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        """Extracts publicly exposed symbols, classes, functions, or re-exports."""
        raise NotImplementedError

    @abstractmethod
    def definitions(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        """Extracts top-level and member signatures plus docstrings, line bounds, snippets, and body hashes."""
        raise NotImplementedError

    def top_level_symbols(self, filepath: str, content: str) -> Optional[List[Dict[str, Any]]]:
        """Returns public top-level symbols formatted for CODE_INDEX.md and symbol_ledger."""
        defs = self.definitions(filepath, content)
        return [d for d in defs if d.get("top_level", True)]

    def describe_file(self, filepath: str, content: str) -> str:
        """Extracts a one-sentence file summary from module docstrings or leading file comments."""
        return ""

    def extract_symbol_slice(self, filepath: str, content: str, symbol_query: str) -> Optional[Dict[str, Any]]:
        """Extracts the exact source block for a target symbol or Class.method."""
        return None

    @abstractmethod
    def call_sites(self, filepath: str, content: str) -> Set[str]:
        """Extracts outbound symbol invocations / identifiers called in content."""
        raise NotImplementedError

    @abstractmethod
    def scope_boundaries(self, filepath: str, content: str) -> List[Dict[str, Any]]:
        """Returns line ranges for function/method/class scopes."""
        raise NotImplementedError

    @abstractmethod
    def slice_interface(self, filepath: str, content: str, requested_symbols: Optional[List[str]] = None) -> str:
        """Slices implementation bodies while retaining imports, exports, definitions, and docstrings."""
        raise NotImplementedError
