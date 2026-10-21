# ADR 0073: DevOps Extension Suite Membrane Decoupling, Declarative Diff Volumes, JIT Diff Compilation, and Terminal Gesture Safety

## Status
Accepted (2026-10-21)

## Context
Following the core pipeline encapsulation and Akasa membrane extraction (ADR 0070, ADR 0072), several architectural seams across the DevOps and system extension suite (`dev`, `git`, `preview`, `tailscale`, `term`, `update`) required consolidation:
1. **Akasa Membrane Bleed in DevOps Engines**: `engine_dev.py`, `engine_git.py`, `engine_preview.py`, `engine_tailscale.py`, and `engine_term.py` directly imported kernel modules (`akasa.hooks`, `akasa.utils`, `akasa.vfs`, `akasa.db`, `akasa.extension`), bypassing the 4-File Membrane (`app.py`, `cli.py`, `sdk/__init__.py`, `utils_core.py`).
2. **Imperative Volume Lifecycle Management**: `engine_git.py` imperatively bound `ctx://diffs` volume drivers, requested directory path mappings, and executed filesystem migrations via `@hooks.on('request_paths')` and `@hooks.on('workspace_boot')`.
3. **Sub-Bucket Diff URI Collisions**: Sub-bucket diff filenames for module-based buckets omitted the target repository prefix (e.g., generating `ctx://diffs/{module}_diffs.txt` rather than `ctx://diffs/{repo}_{module}_diffs.txt`), creating filename collisions when multiple repositories declared identically named sub-buckets.
4. **Diff Compilation Cache Desynchronization**: While `ctx://contexts/` supported on-demand JIT compilation upon cold-cache reads, `ctx://diffs/` lacked integration with `insetu:ensure-fresh-artifact`, risking stale diff inspections.
5. **UI Presentation and Action Group Leaks**: In `ext_git.js`, `git-push` was assigned to `group: 'share'` rather than a dedicated domain group, and diff cards manually declared `chunks` arrays in `.entityData`.
6. **Unmanaged Timers and Cross-Tenant Status Races**: `ext_term.js` utilized raw `clearTimeout` / `setTimeout` for gesture tracking, while `ext_update.js` scheduled debounced status queries that could resolve after a workspace hot-swap.

## Decision
1. **Akasa Kernel Membrane Decoupling**:
   - Refactored `engine_dev.py`, `engine_git.py`, `engine_preview.py`, `engine_tailscale.py`, and `engine_term.py` to import framework primitives strictly from `insetu.core.sdk` and `insetu.core.utils_core`.
   - Converted all raw `@hooks.on(...)` subscriptions across these engines to blueprint-scoped decorators (`@dev_bp.on`, `@git_bp.on`, `@preview_bp.on`, `@tailscale_bp.on`), passing `ctx` as the first argument.
   - Migrated database connection retrieval in `engine_dev.py` to `ctx.get_db("workers")` and `ctx.get_db(clean_db_name)`.
2. **Declarative Diff Volume Schemas & Anchored Compilation Steps**:
   - Declared `volumes={"diffs": {"scheme": "ctx", "tier": "cache", "path_key": "diffs_dir", "legacy_dirs": [...]}}` on `git_bp`, delegating path resolution and legacy migrations to `InSetuExtension`.
   - Standardized `git_diffs` compilation step registration with `anchor="body"` and `order=30`.
   - Unified chunk reading and on-disk verification in `generate_diff_context` via `ctx.read_compiled_context()` and `ctx.is_context_on_disk()`.
   - Standardized sub-bucket diff file addressing to include repository prefixes (`ctx://diffs/{safe_r_dir}_{module}_diffs.txt`).
3. **JIT Diff Compilation & Event Bus Alignment**:
   - Subscribed Git diff resolution to `insetu:ensure-fresh-artifact` to automatically trigger differential recompilations JIT when uncompiled diff URIs are requested.
   - Refactored `api_git_changelogs` to use `ctx.emit_merge_list('request_changelog_suggestions', repo=repo)`.
4. **UI Presentation & Action Group Consolidation**:
   - Reassigned `git-push` to `group: 'vcs'` and consolidated sub-navigation bulk controls on `slots:sub-navigation` using `bulkActionGroup: "vcs"`, `bulkEntityTypes: ["diff"]`, and declarative `menuActions`.
   - Replaced path string splitting with `InSetuURI(path).basename` and purged manual `chunks` properties from card `.entityData`.
5. **Client Lifecycle & Multi-Tenant State Hardening**:
   - Replaced unmanaged touch timers in `ext_term.js` with `this.registerTimeout()` and `this.clearManagedTimeouts()`.
   - Injected `_statusEpoch` tracking into `UpdateStore.fetchRepoStatus` to drop debounced status updates if the active workspace shifts mid-flight.

## Consequences
* **Positive**: Absolute membrane boundary isolation with zero direct `akasa.*` imports across the DevOps extension suite.
* **Positive**: Declarative diff volume lifecycle management without imperative driver mounting boilerplate.
* **Positive**: Collision-free sub-bucket diff addressing across multi-repository workspaces.
* **Positive**: Fluid JIT diff compilation for cold or un-compiled diff views.
* **Positive**: Eradication of unmanaged touch timers and cross-tenant polling races during workspace swaps.