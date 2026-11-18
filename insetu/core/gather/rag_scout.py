"""
insetu.core.gather.rag_scout
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Format-agnostic document budget guard, deterministic fallback URI extractor,
and working-set token metric estimator for `RoutineEnvelope`.
"""

from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from insetu.core.languages import get_language_provider
from insetu.core.sdk import BoundedCache, InSetuURI
from insetu.core.topology.engine_topology import get_topology_files_for_repo
from insetu.core.utils_core import get_sister_repos

MAX_RAG_FILES_PER_HOP = 32

_FILE_TOKEN_METRIC_CACHE = BoundedCache("rag_file_token_metrics", max_entries=2048, copy_mode="none")


def collect_workspace_file_extensions(ctx, allowed_repos: Optional[List[str]] = None) -> Tuple[Set[str], Set[str]]:
    """Returns (known_extensions_lower, known_basenames_lower) from the workspace's live topology_ledger."""
    exts: Set[str] = {".md", ".txt", ".json", ".yaml", ".yml", ".toml"}
    basenames: Set[str] = set()
    if ctx is None:
        return exts, basenames
    for repo in (allowed_repos or get_sister_repos(ctx.workspace_id)):
        for uri_str in get_topology_files_for_repo(ctx.workspace_id, repo):
            bname = InSetuURI(uri_str).basename.lower()
            if bname:
                basenames.add(bname)
                suf = Path(bname).suffix.lower()
                if suf:
                    exts.add(suf)
    return exts, basenames


def prioritize_document_sections(user_prompt: str, docs_text: str, full_threshold_chars: int = 24000) -> str:
    """
    Format-agnostic document budget guard: returns `docs_text` untouched when <= `full_threshold_chars`,
    and delegates strictly to `BaseLanguageProvider.slice_interface` when a document exceeds the threshold.
    """
    if not docs_text or len(docs_text) <= full_threshold_chars:
        return docs_text or ""
    provider = get_language_provider("doc.md")
    if provider:
        sliced = provider.slice_interface("ctx://contexts/doc.md", docs_text)
        if sliced:
            return sliced
    return docs_text[:full_threshold_chars]


def build_context_file_metrics(ctx, constitution_files: List[str], reference_files: List[str], pinned_files: List[str]) -> Dict[str, int]:
    """Computes real estimated token counts per file URI in the active working set with tenant-scoped memoization."""
    token_map: Dict[str, int] = {}
    wid = getattr(ctx, "workspace_id", None) or "default"
    all_uris = list(dict.fromkeys((constitution_files or []) + (reference_files or []) + (pinned_files or [])))
    ref_set = set(reference_files or [])
    for uri in all_uris:
        if not uri:
            continue
        try:
            content = ctx.vfs.read(uri)
        except Exception:
            content = None
        if not isinstance(content, str):
            continue
        is_ref = (uri in ref_set and len(content) > 4000)
        cache_key = (wid, uri, is_ref)
        rev_sig = (len(content), hash(content))
        cached_tok = _FILE_TOKEN_METRIC_CACHE.get(cache_key, revision=rev_sig)
        if cached_tok is not None:
            token_map[uri] = cached_tok
            continue
        if is_ref:
            prov = get_language_provider(uri)
            if prov:
                try:
                    content = prov.slice_interface(uri, content)
                except Exception:
                    pass
        tok_est = max(1, len(content) // 4)
        token_map[uri] = _FILE_TOKEN_METRIC_CACHE.put(cache_key, tok_est, revision=rev_sig)
    return token_map


def extract_doc_referenced_files(
    ctx,
    user_prompt: str,
    docs_text: str,
    allowed_repos: Optional[List[str]] = None,
    max_files: int = MAX_RAG_FILES_PER_HOP,
    clamp_fn=None,
) -> List[str]:
    """Format- and repository-agnostic file reference extractor for attached plans, tickets, and notes."""
    if not docs_text or ctx is None:
        return []
    try:
        if clamp_fn is None:
            from insetu.core.gather.rag_proximity import clamp_rag_files_to_topology as _clamp_fn
            clamp_fn = _clamp_fn
        known_exts, known_basenames = collect_workspace_file_extensions(ctx, allowed_repos=allowed_repos)
        prioritized_text = prioritize_document_sections(user_prompt, docs_text)
        provider = get_language_provider("doc.md")
        raw_candidates: List[str] = list(re.findall(r'(?:vfs|ctx)://[A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,10}', prioritized_text))
        if provider:
            for imp in provider.imports("ctx://contexts/doc.md", prioritized_text):
                link_target = str(imp.get("target") or imp.get("module") or "").strip().split("#", 1)[0].strip()
                if link_target and not link_target.startswith(("http://", "https://", "mailto:")):
                    raw_candidates.append(link_target)
        for m in re.finditer(r'(?<![A-Za-z0-9_./:-])([A-Za-z0-9_][A-Za-z0-9_./-]*\.[A-Za-z][A-Za-z0-9]{0,9})(?![A-Za-z0-9_./-])', prioritized_text):
            tok = m.group(1).strip().lstrip("./")
            if not tok or ".." in tok:
                continue
            suf, bname = Path(tok).suffix.lower(), Path(tok).name.lower()
            if suf not in known_exts or ("/" not in tok and (tok.count(".") > 1 or bname not in known_basenames)):
                continue
            raw_candidates.append(tok)
        deduped = list(dict.fromkeys(c.strip().strip("`'\"") for c in raw_candidates if c and c.strip()))
        return clamp_fn(ctx, deduped, allowed_repos=allowed_repos, max_files=max_files)
    except Exception:
        return []



