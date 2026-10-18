# ADR 0065: Repository Data Containment, Extension State Hydration, and Security Hardening

## Status
Accepted (2026-10-16)

## Context
As the inSetu Developer OS broadened its extension suite, several architectural patterns required standardization:
1. **Repository Root Clutter & Inconsistent Storage**: Domain extensions operating on repository-scoped assets created ad-hoc dotdirectories at repository roots (e.g., `<repo>/.tracker/`), polluting working directories and complicating `.gitignore` management.
2. **Dual-Scope Knowledge Partitioning**: The Notes Library operated exclusively within global context space (`ctx://notes/`), preventing developers from co-locating project-specific documentation directly inside the repositories where code lives.
3. **Transient State Loss Across Restarts**: Extensions managing SQLite metadata caches (`citations`, `cronic`, `favorites`, `hooks`) lacked unified serialization mechanisms to mirror state to readable JSON files, risking index desynchronization if databases were purged.
4. **Un-gated Host Command Execution**: The Automation Hooks extension executed shell commands defined in workspace rules without validating whether an operator had explicitly reviewed and authorized the command string.
5. **Selector-Scoped Subscription Mandate Compliance**: Several extension components continued to register coarse store subscriptions (`this.subscribe(Store, state => { ... })`), violating the `COARSE_STORE_SUBSCRIPTION_MANDATE` and causing unnecessary re-renders.

## Decision
1. **Repository Data Containment (`.insetu-data/`)**:
   - Standardized `<repo>/.insetu-data/<domain>/` as the canonical storage location for all repository-scoped extension markdown assets (`tracker`, `notes`).
   - Implemented automated Phase 1 boot self-migration (`move_tree_contents`) in `engine_tracker.py` to transparently relocate legacy `<repo>/.tracker/` trees to `<repo>/.insetu-data/tracker/`.
   - Updated Cartographer configuration (`managed_dirs` and `ignore_exceptions`) and sub-bucket injection (`mutate_workspace_config`) to monitor `.insetu-data/` while ensuring ticket and note files remain excluded from Git diffs.
2. **Dual-Scope Notes & Cross-Boundary Relocation (`engine_notes.py`, `ext_notes.js`)**:
   - Expanded the Notes Library to support both global notes (`ctx://notes/{filename}`) and repository-scoped notes (`vfs://{repo}/.insetu-data/notes/{filename}`).
   - Enhanced note frontmatter parsing to evaluate `repo`. If the assigned repository shifts between `'global'` and a specific target repo, the engine automatically moves the physical file across VFS and context boundaries, updating SQLite ledger records atomically.
   - Added automatic sub-bucket injection (`notes_omitted`) on target repositories to exclude repo-scoped notes from Git diffs.
3. **Bi-Directional State Hydration and JSON Synchronization**:
   - Implemented `_ensure_*_hydrated(ctx)` and `_flush_*_to_json(ctx)` patterns across `citations` (`library.json`), `cronic` (`schedules.json`), `favorites` (`bookmarks.json`), and `hooks` (`rules.json`).
   - Ephemeral SQLite ledgers are automatically hydrated from JSON state files on boot if empty, and file mutation endpoints atomically flush updated records back to JSON.
4. **Cryptographic Automation Execution Gating (`engine_hooks.py`)**:
   - Enforced host security gating for automated commands. When a hook rule is created or modified, its command signature (`rule_id:sha256(command)[:16]`) is recorded in `.insetu/system.json` under `approved_hooks`.
   - Rules loaded from disk lacking approval signatures are initialized as disabled (`enabled = 0`).
5. **Universal Selector-Scoped Store Subscription Migration (`ext_*.js`)**:
   - Converted all remaining monolithic store subscriptions across all 11 Tier 3 domain extensions to 3-argument selector-scoped subscriptions (`this.subscribe(Store, selector, listener)`), satisfying static analysis rules and eliminating render thrashing.
6. **Universal Akasa Job API Unification across Extensions**:
   - Standardized background task execution across all extension engines using `@bp.worker` decorators, `ctx.jobs.schedule`, `ctx.jobs.cancel`, and `ctx.jobs.register_ephemeral`.

## Consequences
* **Positive**: Clean, non-intrusive containment of all repository-scoped extension data within `.insetu-data/`.
* **Positive**: Co-location of project notes inside target repositories with zero-friction boundary migration.
* **Positive**: Absolute persistence resilience via bi-directional JSON/SQLite state synchronization.
* **Positive**: Mathematical protection against un-authorized automated command execution.
* **Positive**: 100% adherence to UDF selector subscription standards across the entire frontend ecosystem.
* **Negative**: Existing scripts or tools expecting tickets in `<repo>/.tracker/` must route through `.insetu-data/tracker/` (mitigated by backward-compatible dual-path resolution).