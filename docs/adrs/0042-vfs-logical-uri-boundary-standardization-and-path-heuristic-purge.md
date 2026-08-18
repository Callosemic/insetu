# ADR 0042: Standardized vfs:// Logical URI Boundaries and Path Heuristic Purge

## Status
Accepted (2026-08-18)

## Context
Previously, `resolve_logical_path` in `insetu/core/utils_core.py` supported a legacy double-colon boundary syntax (`repo::path`) and contained fallback heuristics that automatically stripped leading `repo_dir` segments when attempting to resolve un-matched file paths. This fallback logic created ghost package boundaries and unpredictable file paths during file creation operations. Furthermore, incoming target file paths with `vfs://` prefixes were handled inconsistently across the Yomama Sync Bridge (`bridge_vfs.py`), file REST routes (`routes_fs.py`), and core path utilities (`utils_core.py`).

## Decision
1. **Canonical `vfs://` URI Scheme**: Standardize `vfs://repo/path` as the canonical logical URI scheme for physical VFS boundary path resolution across `bridge_vfs.py`, `routes_fs.py`, and `utils_core.py`.
2. **Purge Legacy Syntax**: Completely eliminate legacy `repo::path` syntax parsing from `resolve_logical_path`.
3. **Purge Unsafe Path Heuristics**: Remove fallback heuristics in `resolve_logical_path` that stripped leading `repo_dir` segments when creating new files, enforcing exact path evaluation relative to the workspace root.

## Consequences
* **Positive**: Guarantees deterministic, predictable path resolution during file creation and modification operations.
* **Positive**: Complete alignment of `vfs://` logical URI handling across Yomama Sync Bridge transactions and core VFS routes.
* **Negative**: Any external tool relying on legacy `repo::path` syntax must update to standard `vfs://repo/path` URIs.