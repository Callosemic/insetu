# ADR 0066: Canonical URI Standardization, Inter-Workspace Virtual Mounts, and Configuration Cascade Hardening

## Status
Accepted (2026-10-18)

## Context
As the inSetu Workbench expanded its multi-tenant capabilities, several architectural seams required definitive stabilization:
1. **URI Ambiguity & Path Guessing**: Modules historically allowed naked or scheme-less path strings (e.g., `alpha/main.py` vs `vfs://alpha/main.py`), relying on `InSetuURI.from_any()` and dynamic hook coercion (`coerce_naked_uri`). This created implicit path heuristics, fragile prefix stripping, and string matching bugs across database ledgers and VFS routers.
2. **Inter-Workspace Asset Sharing**: While each tenant workspace maintains sovereign isolation, operators required the ability to reference or mount knowledge domains (prompts, notes, workflows) from peer workspaces without duplicating files or violating sandbox containment.
3. **Configuration Cascade Drift**: Although ADR 0040 established the 3-tier settings scoping model, `config.json` continued to store behavioral settings (`extensions`, `port`, `instance_title`, `instance_emoji`). Modifying behavioral settings risked mutating physical disk topology maps.
4. **Cache Eviction Race Conditions**: Running cache vacuuming mid-compilation or during targeted sweeps caused premature deletion of active artifacts before dependent compilation DAG steps had finished executing.

## Decision
1. **Canonical URI Mandate (`InSetuURI`)**:
   - `InSetuURI` strictly mandates canonical `scheme://` prefixes (`vfs://`, `ctx://`, `ws://`) on initialization. Passing a naked or un-prefixed string raises a `ValueError`.
   - Introduced `InSetuURI.from_external_input(raw, default_scheme="vfs")` as the sole authorized normalizer for untrusted external inputs (LLM patch sandwiches, operator search inputs, route parameters).
   - Upgraded all database ledgers (`topology_ledger`, `manifest_ledger`, `file_preferences`) via boot migrations to store canonical URIs.
   - Purged deprecated `from_any` coercion heuristics and naked URI hooks (`coerce_naked_uri`, `coerce_gather_uris`, `coerce_prompts_uris`).
2. **Inter-Workspace Virtual Mounts (`ws://`)**:
   - Implemented `InterWorkspaceVFSDriver` and registered `_authorize_inter_workspace_mount` with the Akasa kernel, routing `ws://<workspace_id>/<domain>/...` paths.
   - Enforced mutual authorization: subscribers declare `shared_mounts` in `workspace.settings.json`, and publishers declare `export_shared_domains` with tenant whitelists or wildcard `'*'`.
   - Enforced strict read-only VFS write barriers: all mutations (saves, moves, archives, deletes, bulk) targeting `ws://` URIs are rejected with HTTP 403 Forbidden. Frontend entity action bars automatically suppress mutative actions on `ws://` assets.
   - Configured cross-workspace event bus broadcasting (`broadcast_cross_workspace_mutations`): mutations on exported `ctx://` domains broadcast synthetic `ws://` mutations to subscribed workspaces, protected against recursive reentrancy loops.
3. **3-Tier Configuration Cascade Hardening (Pure Topology `config.json`)**:
   - Sanitized `config.json` to contain strictly physical disk topology (`target_repos`, `sub_buckets`, `ignore_dirs`, `ignore_files`, `ignore_patterns`, `include_extensions`, `managed_dirs`, `workspace_root`), resolving ticket `INS-QUEUE-20260812_1018`.
   - Behavioral settings reside in `system.json` (`daemon` scope: `port`, `enable_watchdog`, `preload_all_extensions`) and `workspace.settings.json` (`workspace` scope: `instance_title`, `instance_emoji`, `extensions`).
   - Implemented `hydrate_and_migrate_cascade_settings` hook to transparently migrate legacy configurations on boot and hydrate in-memory configs for runtime consumers.
4. **Terminal Mark-and-Sweep Garbage Collection**:
   - Registered `vacuum_unaccounted_cache_on_complete` under `@hooks.on('compilation_sequence_complete')`. Cache sweeping across `ctx://contexts`, `ctx://diffs`, and `ctx://workflows` is deferred until all compilation DAG steps settle and flush chunks to disk.
5. **Extension SDK Advancements**:
   - Added `ctx.create_entity_file()` helper to `ExtensionContext` for standardized Markdown entity generation with YAML frontmatter.
   - Added `this.bindStore()` with `autoFetch` support and `this.filterItems()` to `InSetuElement`.
   - Standardized tree hierarchy construction on `buildUriFileTree()` in `ui_file_tree.js`.

## Consequences
* **Positive**: Absolute mathematical certainty across URI boundaries with zero implicit path guessing.
* **Positive**: Secure, read-only inter-workspace asset sharing with bilateral authorization and reactive cache invalidation.
* **Positive**: Complete decoupling of physical disk topology from behavioral application settings.
* **Positive**: Elimination of premature cache deletion race conditions during complex compilation pipelines.
* **Negative**: Any external tool or extension passing un-prefixed paths internally must update to canonical `scheme://` URIs.