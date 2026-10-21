# ADR 0075: Workflow Automation & Management Extension Suite Membrane Decoupling, Declarative Flow Volumes, JIT Flow Compilation, and Tracker Settings Hub Embedding

## Status
Accepted (2026-10-21)

## Context
Following the core pipeline encapsulation (ADR 0070, ADR 0072), DevOps suite stabilization (ADR 0073), and Knowledge suite extraction (ADR 0074), the remaining Workflow Automation and Task Management extensions (`cronic`, `favorites`, `flow`, `hooks`, `tracker`) retained several architectural seams:
1. **Akasa Membrane Bleed in Management Extensions**: `engine_cronic.py`, `engine_favorites.py`, `engine_flow.py`, `engine_hooks.py`, and `engine_tracker.py` directly imported kernel modules (`akasa.hooks`, `akasa.utils`, `akasa.vfs`), bypassing the 4-File Membrane (`app.py`, `cli.py`, `sdk/__init__.py`, `utils_core.py`).
2. **Imperative Flow Volume Lifecycle**: `engine_flow.py` imperatively bound `ctx://workflows` volume drivers, requested directory path keys, and executed filesystem migrations via `@hooks.on('request_paths')` and `@hooks.on('workspace_boot')`.
3. **Sequential Flow Compilation & Cold-Cache Desynchronization**: Workflow context compilation iterated sequentially over active batches without thread pool parallelization, and cold or wiped workflow context caches lacked JIT self-healing hooks.
4. **Flow Batch Duplication & Target URI Brittleness**: Operators lacked the ability to duplicate workflow batches in the UI, and invalid or renamed file references in batch configurations generated hard missing-file errors without candidate suggestions.
5. **Legacy `.tracker/` Path Heuristics**: Following ADR 0065's migration of ticket storage to `.insetu-data/tracker/`, `engine_tracker.py` and `ext_tracker.js` retained legacy `.tracker/` path checks and directory migration fallbacks, blurring the containment boundary.
6. **Tracker Settings Modal Traps & Direct Slot Mutations**: `InSetuExtTrackerSettings` operated as a standalone global modal (`slots:global`) rather than embedding into the unified Settings Hub. Furthermore, modifying views mutated `manifest.layoutSlots` directly, and sub-navigation actions relied on the deprecated `slots:sub-navigation-actions` slot.
7. **Redundant VFS Mutation Event Emissions**: Ticket mutations in `engine_tracker.py` manually emitted `ctx.emit('vfs_mutated')` alongside atomic VFS writes, generating duplicate event echo pulses.

## Decision
1. **Akasa Kernel Membrane Decoupling**:
   - Refactored `engine_cronic.py`, `engine_favorites.py`, `engine_flow.py`, `engine_hooks.py`, and `engine_tracker.py` to import framework primitives strictly from `insetu.core.sdk` and `insetu.core.utils_core`.
   - Converted all raw `@hooks.on(...)` subscriptions across these engines to blueprint-scoped decorators (`@cronic_bp.on`, `@flow_bp.on`, `@hooks_bp.on`, `@tracker_bp.on`).
   - Centralized hook security approvals in `engine_hooks.py` around `get_system_index_path()`.
2. **Declarative Flow Volume Schemas & Anchored Step Ordering**:
   - Declared `volumes={"workflows": {"scheme": "ctx", "tier": "cache", "path_key": "workflows_dir", "legacy_dirs": [...]}}` on `flow_bp`, delegating volume mounting and legacy directory migrations to `InSetuExtension`.
   - Standardized `flow_workflows` compilation step registration with `anchor="body"` and `order=40`.
3. **Flow Parallel JIT Compilation & Incremental Optimization**:
   - Parallelized batch compilation using `ctx.jobs.map_parallel(process_batch, context_batches)`.
   - Integrated two-phase incremental fast paths evaluating `ctx.is_context_on_disk(base_uri, existing_entry)` against touched dependencies to skip untouched batches without disk I/O.
   - Added JIT auto-healing triggers for missing workflow artifacts and subscribed to `insetu:ensure-fresh-artifact` for `ctx://workflows/`.
   - Replaced manual event query accumulation loops with `ctx.emit_merge_list('request_available_diffs')` and `ctx.emit_merge_list('request_available_prompts')`.
4. **Flow Batch Duplication & Target URI Heuristic Healing**:
   - Added `duplicateBatch` (`flow-duplicate` polymorphic action) for duplicating workflow configurations with slug collision prevention.
   - Exported `classifyFlowTargetUri(rawInc)` and `resolveFlowPromptUri(rawPrompt)` with semantic classification badges (`Clean`, `Undefined`) and dynamic `Fix → Candidate` auto-repair buttons in the editor.
   - Redesigned `InSetuFlowViewProjection` and `InSetuFlowEditProjection` using yenVUI house style with `.flow-section` and `<sutram-tag>` primitives.
   - Migrated flow sub-navigation menu actions to declarative `menuActions` on `slots:sub-navigation`, purging `slots:sub-navigation-actions` and `InSetuExtFlowActions`.
5. **Tracker Pure Repository Containment (`.insetu-data/tracker/`)**:
   - Purged all legacy `.tracker/` path heuristics and directory sweep fallbacks from `engine_tracker.py` and `ext_tracker.js`. Ticket persistence is strictly contained under `<repo>/.insetu-data/tracker/`.
   - Standardized SQLite URI healing across boot hooks using `ctx.db.heal_uri_column("tracker_tickets", "filepath", "vfs://")`.
   - Removed redundant manual `ctx.emit('vfs_mutated', ...)` broadcasts across ticket creation, transitions, vocabulary harmonization, and stale ticket archiving, delegating to the kernel VFS event ledger.
6. **Tracker Settings Hub Embedding & Dynamic Layout Slot Governance**:
   - Re-architected `InSetuExtTrackerSettings` to accept `?embedded=${true}` and registered `render: () => html'<insetu-ext-tracker-settings id="hub-custom-action-panel" ?embedded=${true}></insetu-ext-tracker-settings>'` within `settingsActions`, eliminating standalone global modal overlays.
   - Replaced direct `manifest.layoutSlots` mutations with `ExtensionRegistry.setDynamicLayoutSlots('tracker', dynamicSlots)`.
   - Replaced `<insetu-ext-tracker-actions>` and `slots:sub-navigation-actions` with declarative `menuActions: _buildTrackerMenuActions` on `slots:sub-navigation`.
   - Replaced `@insetu:request-frontmatter` pubsub event flow with in-place `syncFrontmatter` push in `InSetuTrackerEditProjection`.
7. **Favorites & Cronic Canonical URI Normalization and Folder Integrity**:
   - Preserved trailing slashes on folder URIs in `add_favorite` and during hydration, and provided `folderpath` in card `.entityData`.
   - Standardized URI resolution across Cronic and Favorites on `InSetuURI`.
   - Purged redundant `onWorkspaceLoad` and `onForceRefresh` boilerplate in `ext_cronic.js`, relying on `this.bindStore` auto-fetch.

## Consequences
* **Positive**: Complete membrane boundary isolation with zero direct `akasa.*` imports across the management extension suite.
* **Positive**: Declarative flow volume management without imperative driver mounting boilerplate.
* **Positive**: High-performance parallel workflow context compilation with JIT cold-cache self-healing.
* **Positive**: Seamless workflow batch duplication and interactive URI candidate auto-repair.
* **Positive**: Pure repository containment in `.insetu-data/tracker/` with zero legacy path heuristic drift.
* **Positive**: Deep architectural integration of Tracker configuration inside the OS Settings Hub with dynamic slot governance.
* **Positive**: Complete elimination of redundant VFS mutation event broadcasts.