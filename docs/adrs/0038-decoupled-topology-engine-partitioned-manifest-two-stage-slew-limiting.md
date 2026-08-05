# ADR 0038: Decoupled Topology Engine, Dual-Root Partitioned Manifest, and Two-Stage Slew Limiting

## Status
Accepted

## Context
Previously, the `gather` RAG engine operated as the ultimate arbiter of both context compilation and Virtual File System (VFS) visibility. Because `gather` owned the `manifest_ledger` in `vfs_index.db`, any file excluded or ignored from context compilation was completely hidden from the VFS file tree UI. This entangled physical file existence with context compilation.

Furthermore, processing high-velocity file mutations via a single un-segmented metronome timer caused event loop thrashing during burst I/O events (e.g. `git checkout` or multi-file edits).

## Decision
1. **Decoupled Topology Engine (`engine_topology.py`)**:
   - Introduce `topology` as a core engine (`InSetuExtension`) backed by an SQLite `topology_ledger` (`filepath`, `repo`, `bucket_id`, `is_tracked`, `timestamp`).
   - The `topology_ledger` serves as the Single Source of Truth (SSOT) for physical file existence and sub-bucket classification, decoupled from RAG context compilation.
2. **Two-Stage Slew Limiter**:
   - **Stage 1 (Fast Debounce, 2.0s)**: `vfs_mutated` events buffer mutations into `topology_event_buffer`. The `resolve_topology_task` worker processes the buffer after disk I/O settles, updates `topology_ledger`, and emits `topology_resolved` carrying `dirty_repos`, `dirty_buckets`, and `events`.
   - **Stage 2 (Slow Debounce, 15.0s)**: `@hooks.on('topology_resolved')` handler in `engine_gather.py` schedules a delayed RAG compilation job (`cmp_del_{workspace_id}`). This prevents CPU-heavy context recompilations from thrashing while the operator is actively typing and saving files.
3. **Dual-Root Partitioned Manifest**:
   - Re-structure the root system manifest into a partitioned JSON payload: `{"vfs": {...}, "ctx": {...}}`.
   - The `"vfs"` domain represents physical file structure derived from `topology_ledger` via `request_vfs_manifest`.
   - The `"ctx"` domain represents compiled RAG contexts and virtual artifacts derived from `manifest_ledger` via `request_manifest`.
4. **Yomama Sync Bridge Anchor Failure Diffing**:
   - In `bridge_vfs.py`, when a search anchor fails to match an existing file, generate a unified diff using `difflib.ndiff`, base64-encode it as `syntax_error`, and return status `needs_confirmation` with `resolution_type = "anchor_failed"`.

## Consequences
* **Positive**: Complete separation between physical VFS file visibility and RAG context compilation.
* **Positive**: Eradicates event loop starvation during rapid disk I/O bursts via two-stage slew limiting.
* **Positive**: Fast SQL lookup for Yomama Sync Bridge file candidates (`get_omniscient_workspace_files`) without `os.walk` traversals.
* **Negative**: Requires frontend UI components (`AppStore.manifest`, `<insetu-file-tree>`) to iterate partitioned `manifest.vfs` and `manifest.ctx` structures.