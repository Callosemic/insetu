# ADR 0044: Ruamel YAML Frontmatter Engine, SDK parse_uri Helper, and VFS Event Canonicalization

## Status
Accepted (2026-09-04)

## Context
Previously, Markdown frontmatter parsing and serialization in `insetu/core/utils_core.py` relied on a naive line-by-line colon splitter (`line.split(':', 1)`). This naive parser stripped quotes, mangled nested YAML structures, lost field order, and forced string coercion on numeric and boolean values.

Additionally, disk mutation events flowing through `topology_event_buffer`, `vfs_mutated`, and `recall_callbacks` occasionally passed raw relative paths without explicit `vfs://` scheme prefixes. This caused string prefix matching errors in recall callbacks (e.g. `e['filepath'].startswith(repo_prefix)` failing when comparing `vfs://repo/file.md` against `repo/file.md`).

## Decision
1. **`ruamel.yaml` Frontmatter Engine (`utils_core.py`)**:
   - Upgraded `parse_frontmatter` and `update_frontmatter` to use `ruamel.yaml` (`YAML(typ='rt')`) for round-trip YAML parsing.
   - Preserves quotes, mappings, sequence indentation, and field ordering without line-wrapping distortion.
   - Retains graceful fallback to line-by-line parsing if `ruamel.yaml` is not installed in the host environment.
2. **SDK `parse_uri` Helper (`utils_core.py`)**:
   - Introduced `parse_uri(path_str)` to decompose scheme-prefixed paths (`vfs://repo/path`, `ctx://contexts/file.txt`, `repo/path`) into normalized `(repo_dir, relative_path)` tuples.
3. **Canonical Event Payload Normalization (`engine_gather.py`, `engine_topology.py`)**:
   - Enforced `vfs://` and `ctx://` scheme normalization on all incoming mutation events via `_to_canonical_event()` and `_get_fp()` helpers before set deduplication and recall callback evaluation.
   - Updated recall callbacks in `engine_gather.py` to match `vfs_prefix = f"vfs://{current_repo_dir.lower()}/"`.

## Consequences
* **Positive**: Absolute preservation of frontmatter structure, types, quotes, and comments during editing operations.
* **Positive**: Eradicates prefix matching bugs between raw file paths and `vfs://` URI event streams.
* **Negative**: Introduces an optional PyPI dependency on `ruamel.yaml` (gracefully handled via fallback).