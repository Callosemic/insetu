"""Central language analysis substrate mapping file extensions to BaseLanguageProvider implementations."""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .base import (
    BaseLanguageProvider,
    compute_normalized_text_body_hash,
    find_brace_balanced_end,
    first_sentence,
)
from .javascript import JavaScriptLanguageProvider
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
}

SUPPORTED_SYMBOL_EXTENSIONS = frozenset(_PROVIDERS.keys())


def get_language_provider(filepath: str) -> Optional[BaseLanguageProvider]:
    """Resolves the appropriate language provider for a file path based on its extension."""
    if not filepath:
        return None
    ext = Path(filepath).suffix.lower()
    return _PROVIDERS.get(ext)


def extract_file_symbols(filepath: str, content: str) -> Optional[List[Dict[str, Any]]]:
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


def describe_source_file(rel_path: str, content: str) -> str:
    """Derives a one-sentence file description for CODE_INDEX.md from module docstrings or leading file comments."""
    if not content or not content.strip():
        return ""
    provider = get_language_provider(rel_path)
    if not provider:
        return ""
    return provider.describe_file(rel_path, content)


__all__ = [
    "BaseLanguageProvider",
    "PythonLanguageProvider",
    "JavaScriptLanguageProvider",
    "RustLanguageProvider",
    "SUPPORTED_SYMBOL_EXTENSIONS",
    "get_language_provider",
    "extract_file_symbols",
    "extract_symbol_source_slice",
    "describe_source_file",
    "find_brace_balanced_end",
    "first_sentence",
    "compute_normalized_text_body_hash",
]
