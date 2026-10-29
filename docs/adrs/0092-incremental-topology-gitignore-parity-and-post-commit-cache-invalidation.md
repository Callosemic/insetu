# ADR 0092: Incremental Topology Gitignore Parity via Batched Check-Ignore and Post-Commit Manifest Cache Re-Invalidation

## Status
Accepted (2026-10-29)

## Context
As the inSetu Developer OS stabilized its reactive relational watermark architecture (ADR 0081) and decoupled topology ledger (ADR 0038), two subtle data synchronization anomalies surfaced in high-velocity development environments:
1. **Incremental vs. Full Scan Gitignore Asymmetry**: Full physical disk walks (`force_topology_scan`) query `git ls-files --cached --others --exclude-standard`, strictly excluding all paths matching `.gitignore`, `.git/info/exclude`, and system exclusion files. However, when background processes or build tools (such as `pip install -e .` or frontend compilers) created ephemeral artifacts (e.g., `*.egg-info/`, `build/`, `dist/`) while the daemon was running, the filesystem observer passed raw file save events to `topology_event_buffer`. Because `resolve_topology_buffer` only evaluated static repository extension and prefix rules, ignored files were inserted into `topology_ledger`, corrupting VFS file trees and triggering unintended RAG context compilation steps until a manual full scan pruned them.
2. **Pre-Commit Manifest Cache Race Windows**: Both `hook_save_manifest` (`engine_gather.py`) and `resolve_topology_buffer` (`engine_topology.py`) emitted cache invalidation events (`manifest_mutated` and `vfs_manifest_mutated`) *before* executing their respective SQLite write transactions (`conn.commit()`). If a concurrent reader (such as an adjacent DAG step, an SSE-triggered client fetch, or a background worker) queried `hook_request_manifest` or `hook_request_vfs_manifest` during the database write window, the reader fetched pre-commit database rows and cached them under the 2.0-second `@thread_safe_cache` TTL. This pinned stale watermarks in memory, causing client Gather cards and Git diff projections to indicate dirty status for up to 2 seconds following successful compilations.

## Decision
1. **Incremental Gitignore Parity via Batched `git check-ignore` (`engine_topology.py`)**:
   - Implemented `_git_ignored_paths(repo_path, rel_paths, repo_cfg, live_cfg)` executing `git -c core.quotepath=false check-ignore --stdin -z` in a single batched subprocess call per repository, preserving exemptions for `force_include` and managed directories (`.insetu-data`).
   - Integrated candidate checking into `resolve_topology_buffer`: filters out ignored paths during incremental event folding, preventing build artifacts from entering `topology_ledger`.
   - Added active eviction: if an incremental mutation event targets an ignored path that was previously recorded in `topology_ledger`, the engine deletes the row from SQLite, marks the repository dirty, and registers the affected bucket in `dirty_buckets` to trigger downstream reconciliation.
2. **Post-Commit Manifest Cache Re-Invalidation (`engine_gather.py`, `engine_topology.py`)**:
   - In `engine_gather.py` (`hook_save_manifest`), wrapped manifest persistence in a `try...finally` block that calls `hook_request_manifest.invalidate(workspace_id=workspace_id)` after `conn.commit()`.
   - In `engine_topology.py` (`force_topology_scan` and `resolve_topology_buffer`), invoked `hook_request_vfs_manifest.invalidate(workspace_id=workspace_id)` immediately after `conn.commit()`.
   - Guaranteed that readers arriving mid-write or immediately following transaction completion are served freshly committed state.

## Consequences
* **Positive**: Absolute parity between full disk scans and incremental Watchdog event processing.
* **Positive**: Automatic eviction of build artifacts (`*.egg-info`, `dist/`) from the topology ledger without requiring full scans.
* **Positive**: Total elimination of stale 2-second cache pinning across Gather cards and VFS manifest projections.
* **Negative**: Adds a single batched `git check-ignore` subprocess invocation per touched repository during `resolve_topology_buffer`.
