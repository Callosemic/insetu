---
title: "Blueprint: Absolute Kernel Encapsulation & The Utility Split"
date: 2026-07-28
author: Architect
status: approved
tags: ["Architecture", "Kernel", "Decoupling", "Framework"]
---

# Blueprint: Absolute Kernel Encapsulation & The Utility Split

## 1. Context & The "Acid Test"
Following the adoption of the Three-Tier Architecture (ADR 0029), the topological separation of the `core/` and `extensions/` directories clarified our operational boundaries. However, a structural audit revealed that the Kernel is still tightly coupled to the Developer OS domain. 

The primary offender is `insetu/utils_core.py`, which currently houses both generic framework utilities (e.g., loading JSON, tenant sniffing) and highly specific Developer OS logic (e.g., Cartographer tree generation, Git repository mappings, and RAG context filtering).

**The Acid Test:** If we were to delete the `insetu/core/`, `insetu/extensions/`, and `insetu/static/js/core/` directories, the `insetu-kernel` should boot perfectly, ready to accept an entirely new suite of "Core" domain engines. Currently, it would crash due to entangled imports and polluted routing.

## 2. The Execution Plan

To achieve true Kernel encapsulation, we must execute the following multi-phase separation:

### Phase 1: The Utility Split
We will bisect the current `utils_core.py` file to respect the Tier 1 / Tier 2 boundaries.

*   **`insetu/utils.py` (Tier 1 Kernel):**
    *   Rename `utils_core.py` to `utils.py`.
    *   Retain strictly agnostic framework methods: `_cwd`, `sniff_tenant_id`, `get_workspace_physics`, `get_tenant_control_dir`, `is_extension_enabled`, `extension_auth`, `load_json_file`, `save_json_file`, `load_config`, `get_all_workspace_ids`, `generate_idempotency_hash`, and `slugify`.
*   **`insetu/core/utils_core.py` (Tier 2 Developer OS):**
    *   Extract all domain-specific Developer OS logic into this new file.
    *   Migrate: `get_gather_paths`, `load_workflows`, `get_valid_workspace_files`, `get_omniscient_workspace_files`, `parse_frontmatter`, `update_frontmatter`, `generate_text_chunks`, `evaluate_circuit_breaker`, `build_tree_dict`, `generate_ascii_tree`, `get_available_contexts`, `get_safe_repo_id`, `get_sister_repos`, `resolve_macro_includes`, `search_workspace_files`, `get_default_repo_template`, and `sanitize_workspace_config`.
    *   Update all references in `engine_gather.py`, `engine_bridge.py`, and `cartographer.py` to import from this new Tier 2 utility module.

### Phase 2: Resolving Complex Physics Pollution
Several Tier 1 utilities currently harbor hardcoded Tier 2 domain logic.
*   **Violation 1:** `load_config` currently hardcodes the injection of the `.insetu` repository into the configuration payload for OS tracking.
    *   *Fix:* Strip this from `load_config`. The `config` extension or `gather` core engine must use the `@hooks.on('mutate_workspace_config')` event to dynamically inject this repository.
*   **Violation 2:** `resolve_workspace_path` sits in the Tier 1 VFS critical path, but it actively parses `target_repos` to resolve `physical_path` mount overrides and `::` cross-repo boundary syntax.
    *   *Fix:* Split this. Create an ultra-safe `resolve_sandbox_path(filepath, workspace_id)` in Tier 1 that solely prevents directory traversal breakouts (e.g., `../../`) and anchors to `workspace_root`. Move the complex `repo::path` syntax and mount overriding to Tier 2 as `resolve_logical_path()`. Core engines must resolve logical paths via Tier 2 before passing absolute paths to the Tier 1 VFS.
### Phase 3: Kernel API & Backend Pollution Audit
The Kernel's routing, VFS, and bootloading files are actively polluted with Developer OS concepts. The Kernel framework should not possess any awareness of repositories, cartography, LLM workflows, or context mapping.

*   **Violation 3 (Routing):** `app.py` contains `@app.route('/api/<workspace_id>/repos')` and `/api/<workspace_id>/manifest`. It manually parses `sub_buckets`, `meta_map`, and serves RAG contexts.
    *   *Fix:* Relocate these routes to `insetu/core/gather/engine_gather.py` (Tier 2).
*   **Violation 4 (Routing):** `routes_system.py` contains `@system_bp.route('/api/system/repos/template')`. 
    *   *Fix:* Move this to the `config` extension.
*   **Violation 5 (File Fetching): [RESOLVED]** Both `/download/<path:filename>` (`app.py`) and `api_fs_fetch` (`routes_fs.py`) import `get_gather_paths` and manually search `contexts_dir`, `prompts_dir`, and `diffs_dir`.
    *   *Fix:* The Kernel file router `routes_fs.py` was scrubbed of all domain knowledge and now broadcasts a `vfs_resolve_file` hook. The Tier 2 utility `utils_core.py` securely intercepts this to map `system://` URIs and fallback artifact resolutions.
*   **Violation 6 (VFS Domain Logic):** `execute_vfs_save_physical` (`routes_fs.py`) contains hardcoded string-matching for `archive_path`, `{date}` replacements (for the `flow` extension), and `is_new_repo` template injection.
    *   *Fix:* Strip this logic from the VFS. The `flow` and `config` extensions must intercept the payload via a `@hooks.on('pre_file_save')` event to mutate the paths or configurations *before* the VFS executes the write.
*   **Violation 7 (Worker Ledger):** `_init_worker_schema` (`workers.py`) executes an explicit `INSERT` to queue the `sys_vfs_ledger_daemon` job owned by the `gather` extension.
    *   *Fix:* Remove this insert. The `gather` engine must register its own persistent metronome jobs upon `@hooks.on('system_boot')`.

### Phase 4: Frontend UDF & Shell Pollution Audit
To pass the Acid Test, the frontend App Shell (`app.js`, `store.js`) must remain completely stable and error-free even if the entire Tier 2 `core/` directory is missing.
*   **Violation 8 (State Bloat): [REJECTED/RESOLVED]** `store.js` defines state keys for `allRepos`, `targetConfigs`, `pinnedRepos`. 
    *   *Fix:* Rejected. Upon review, workspace physics (repositories and configs) are fundamental to the OS shell, not just the `Gather` extension. Pushing them down would create a reverse-dependency where all extensions must rely on `Gather`. Extension-specific data (like Git state) was moved to local stores, but workspace topologies rightly remain in `AppStore` to serve the broader ecosystem.
*   **Violation 9 (Bootloader Logic):** `app.js` exports `getFlattenedBuckets(repoDir)`, parsing `sub_buckets` directly.
    *   *Fix:* Relocate to `static/js/core/gather.js`.
*   **Violation 10 (Shortcuts & Batch Actions):** `app.js` hardcodes `registerShortcut` for `tracker` modals, and defines the entire `batch-actions` extension and `packSelectionPayload` (Quickpacks) directly in the bootloader.
    *   *Fix:* Move task shortcuts to `ext_tracker.js`. Extract the Quickpack and Batch Actions registration entirely into `gather.js`.

## 3. Desired Outcome
Upon completion, `inSetu` will effectively become a dual-purpose repository. The base Kernel can be cloned, stripped of its `core/` and `extensions/` directories, and utilized as a highly robust, local-first, offline-capable Python/LitElement application framework with built-in VFS, CQRS SQLite sync, and Tailscale authentication.