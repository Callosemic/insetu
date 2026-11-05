---
title: "RFC: Decomposing God Objects & Purifying the System Module Across Akasa, Sutram & inSetu"
status: "Draft Blueprint"
created_at: "2026-11-02"
target_subsystems:
  - "akasa/akasa/workers/*"
  - "akasa/akasa/extension.py"
  - "sutram/sutram/js/*"
  - "insetu/insetu/core/utils_core.py"
  - "insetu/insetu/core/sdk.py"
  - "insetu/insetu/core/system/*"
  - "insetu/insetu/core/fs/*"
  - "insetu/insetu/core/bridge/*"
  - "insetu/insetu/core/agent/*"
  - "insetu/insetu/core/llm/*"
  - "insetu/insetu/core/mcp/engine_mcp.py"
  - "insetu/insetu/extensions/tracker/*"
  - "insetu/insetu/extensions/git/*"
  - "insetu/insetu/extensions/update/*"
tags: [blueprint, rfc, architecture, modularity, god-objects, system-cleanup, pre-1.0-purity, tech-debt]
---

# RFC: Decomposing God Objects & Purifying the System Module Across Akasa, Sutram & inSetu

## 1. Core Architectural Philosophy: Pre-1.0 Purity (Boundary Membranes vs. Legacy Shims)

During the extraction of `akasa` (Ring 1) and `sutram` (Ring 2) and the separation of `insetu/core` from `insetu/extensions`, several foundational modules—most notably `insetu/core/utils_core.py`, `insetu/core/system/*`, `insetu/core/agent/*`, `insetu/core/bridge/*`, and `insetu/core/fs/fs.js`—became kitchen-sink monoliths accumulating unrelated domain responsibilities.

Because the Akasa–Sutram–inSetu triad is **pre-1.0**, we have a critical architectural advantage: **contracts remain a flexible membrane until 1.0 release.** Leaving backward-compatible re-export shims inside internal modules (such as keeping `parse_blocks` or `fetch_url` re-exported inside `utils_core.py`) actively harms the codebase in three ways:
1. **Distorts `CODE_INDEX.md` & Blast-Radius RAG Slicing:** When internal modules import domain logic from a kitchen-sink file like `utils_core.py`, the AST dependency graph artificially couples every consumer to `utils_core.py`.
2. **Teaches LLMs Bad Habits:** In-context learning causes LLM coding turns (`/code`, `/refactor`, `/upkeep`) to copy whatever import patterns exist in the surrounding files. If legacy shims survive, the agent will perpetuate them.
3. **Ossifies Accidental Coupling:** Pre-1.0 is the window to eradicate historical accidents cleanly and lock the door behind them with automated tests.

Therefore, every decomposition in this blueprint strictly separates **True Boundary Membranes** from **Internal Domain Splits**:

### 1.1 Rule A — True Boundary Membranes (Keep Clean SDK Barrels)
A barrel file is architecturally legitimate **only** when it serves as the public encapsulation boundary between rings or between the host OS and its extensions:
* **Ring 1 (`akasa`) Public Entrypoints:** `akasa/__init__.py`, `akasa/workers/__init__.py`, and `akasa/extension.py` re-export their internal submodules (`dag.py`, `validation.py`, `metronome.py`, `settings.py`, `ipc.py`) so Ring 3 (`insetu`) imports from a clean kernel boundary.
* **Ring 2 (`sutram`) Public Entrypoints:** `sutram/js/sutram_sdk.js` and `sutram/js/primitives.js` re-export their internal submodules (`store_kernel.js`, `layout_store.js`, `chassis_adapter.js`, `settings_engine.js`, `action_broker.js`, `composites.js`) so downstream consumers are insulated from internal file layout.
* **Ring 3 (`insetu`) Extension SDK Membrane:** `insetu/core/sdk.py` (Python) and `insetu/core/system/insetu_sdk.js` (JavaScript) serve as the single front door for feature extensions (`insetu/extensions/*`).
* **Browser Extension Script Entrypoints:** Root browser bundles (`fs.js`, `agent.js`, `bridge.js`, `ext_tracker.js`, `ext_git.js`, `ext_update.js`) import their extracted store/projection submodules and execute `window.ExtensionRegistry.registerExtension(...)`.

### 1.2 Rule B — Internal Domain Splits (Zero Legacy Shims; Direct Imports + Test Ratchets)
When extracting domain subsystems out of internal monoliths (`utils_core.py`, `engine_system.py`, `orchestrator.py`, `bridge_vfs.py`, `engine_llm.py`):
* **No Backward-Compatibility Aliases:** Delete the relocated symbols from the source monolith completely. Do not leave `from .new_module import old_symbol` shims behind.
* **Direct Caller Rewiring:** Update every caller across `insetu/core/`, `insetu/extensions/`, and `tests/` in the same atomic transaction to import from the canonical single-responsibility module (or via `insetu.core.sdk` when an extension consumes a kernel/OS capability).
* **Eradication via `fitness_functions.py`:** Every wave pairs its refactor with an AST fitness check that fails the test suite if any file reintroduces the legacy import path or legacy state key.

---

## 2. Purifying `insetu/core/system` & `insetu/core/utils_core.py` ("The Kitchen Sink")

### 2.1 Untangling `insetu/core/utils_core.py` (~2,250 LOC)
*(Note: `insetu/core/bridge/parser.py` was already extracted, and `approve_test_command` / `get_approved_test_commands` were deleted in 0.34.0.)*

We will extract 3 dedicated modules under `insetu/core/system/` and delete their moved symbols from `utils_core.py` (with zero re-export shims):

1. **Extract `insetu/core/system/watchdog.py`:**
    * **Relocate Symbols:** `_is_watchdog_vfs_echo`, `_watchdog_debouncer_loop`, `_track_intent_vfs_writes`, `start_filesystem_observer`, `stop_filesystem_observer`, and their shared observer state/locks.
    * **Rewire Callers Directly to `insetu.core.system.watchdog`.**
2. **Extract `insetu/core/system/security_io.py`:**
    * **Relocate Symbols:**
    * Child environments: `is_secret_env_name`, `get_child_env_passthrough`, `child_env`.
    * Outbound fetch: `FetchRefused`, `FetchHTTPError`, `FetchResult`, `_is_public_address`, `_host_is_allowed_private`, `_goes_through_proxy`, `_check_fetch_target`, `_PeerCheckingMixin`, `_build_fetch_opener`, `_read_capped`, `fetch_url`.
    * Command approvals: `_command_signature`, `_command_subject`, `get_approved_commands`, `approve_command`, `is_command_approved`, `is_test_command_approved`.
    * **Expose Cleanly on `insetu/core/sdk/__init__.py` for Extensions:** Re-export moved symbols lazily on `insetu.core.sdk` so extensions import moved security/IO symbols from `insetu.core.sdk` (leaving their other existing `utils_core` imports untouched and tracked by the A4 extension membrane ratchet).
    * **Update `CHILD_ENV_BUILDER_FILES` in `tests/fitness/rules_python.py`** to `{"insetu/core/system/security_io.py"}`.
3. **Extract Workspace Extension Helpers into `insetu/core/system/ext_manager.py`:**
    * **Relocate Symbols:** `get_workspace_extension_reserved_names`, `get_workspace_extensions_root`, `snapshot_workspace_extension`, `current_workspace_extension_fingerprint`, `get_workspace_extension_approvals`, `approve_workspace_extension`, `revoke_workspace_extension`, `describe_workspace_extension`, `scan_workspace_extensions` (joined in Wave 1.2 by the extension-management code and routes from `engine_system.py`).
4. **What Remains in `insetu/core/utils_core.py` (~800 LOC Cohesion Budget):**
    * `InSetuURI`, `BucketAddress`, YAML/frontmatter/macro/mustache helpers, date and list parsers, manifest/domain/path helpers, repository/config helpers, and `get_repeater_secret` / `set_repeater_secret` (owned by S9).
    * **Why ~800 lines is the right ceiling for `utils_core.py` (rather than an artificial 450-line target):** Once `bridge/parser.py`, `system/watchdog.py`, `system/security_io.py`, and `system/ext_manager.py` are extracted with zero legacy re-export shims, `utils_core.py` drops from ~2,250 LOC to ~800 LOC. Forcing it below 450 lines would require either splitting cohesive URI/frontmatter/template-macro primitives away from `InSetuURI` or introducing barrel re-export shims that violate Rule B. Keeping the 800-line module cohesion budget (`MAX_UNLISTED_MODULE_LINES = 800` + per-module shrinking ceilings in `MODULE_LINE_RATCHET`) prevents God Objects from reforming without encouraging artificial micro-file fragmentation.

### 2.2 Untangling `insetu/core/system/` (Backend & Frontend)

| Current File | Conflated Responsibilities | Target Single-Responsibility Modules |
| :--- | :--- | :--- |
| **`system/engine_system.py`** (~720 LOC) | Mixes `SYSTEM_SETTINGS_SCHEMA`, `ws://` inter-workspace mount authorization, repeater secret vaulting, a **175-line OpenAPI 3.0 spec builder**, DAG pipeline submission, extension AST inspection & `pip install` workers, workspace CRUD, and `/proc` + `tracemalloc` memory profiler. | • `system/openapi.py`: `build_system_openapi_spec(ctx)`<br>• `system/ext_manager.py`: `_inspect_or_resolve_extension_meta`, `_resolve_extension_module_and_bp`, `_get_whitelisted_extension_packages`, `_background_install_extension_deps`<br>• `system/memory_profiler.py`: `collect_process_memory_telemetry(action)`<br>• `system/engine_system.py`: Core settings schema, `ws://` mount checks, workspace CRUD, and route handlers |
| **`system/insetu_sdk.js`** (~720 LOC) | Mixes `InSetuURI` & `BucketAddress` value objects, `InSetuElement` base class, `ExtensionRegistry` slot/action policy overrides, YAML frontmatter/clipboard utilities, and the `'system'` extension registration. | • `system/uri.js`: `InSetuURI`, `BucketAddress`, `parseFrontmatter`, `serializeFrontmatter`, `extractManifestFiles`<br>• `system/insetu_element.js`: `InSetuElement`, `createExtensionStore`, `createIsolatedSlice`<br>• `system/insetu_sdk.js`: Official Extension SDK membrane re-exporting `uri.js` & `insetu_element.js` + `ExtensionRegistry` policy wiring |
| **`system/system.js`** (~850 LOC) | Mixes bootloader/auth gate UI, Service Worker boot, the **230-line `checkManifestVersion` delta sync & background cache warmer**, `SessionOrchestrator` workspace swap FSM, and `executeWorkspaceMutation`. | • `system/manifest_sync.js`: `checkManifestVersion`, `refreshManifest`, delta signature & background cache warming queue<br>• `system/system.js`: Bootloader (`executeBootSequence`), `SessionOrchestrator`, `executeWorkspaceMutation`, and `'system'` extension registration |
| **`system/components/ui_system_settings.js`** (~890 LOC) | Mixes the generic `InSetuSchemaRepeater` widget (~290 LOC) with the `InSetuSystemSettings` modal hub (~600 LOC). | • `system/components/ui_schema_repeater.js`: `InSetuSchemaRepeater`, `_evaluateFieldCondition`, `_buildDefaultItemFromSchema`<br>• `system/components/ui_system_settings.js`: `InSetuSystemSettings` + settings save/action listeners |

---

## 3. Ring 1 (`akasa`) & Ring 2 (`sutram`) Kernel Decomposition

### 3.1 Ring 1: `akasa` Backend Micro-Kernel
1. **`akasa/workers/__init__.py` (~950 LOC) → Split into 4 cohesive modules:**
   * `akasa/workers/dag.py`: `_prepare_anchored_dag_steps`, `resolve_dag_chain`, `start_dag_chain`, `_merge_state_deltas`, `_dag_coordinators`.
   * `akasa/workers/validation.py`: `_check_type_match`, `validate_worker_kwargs`, `validate_dag_chain_kwargs`, `_callback_specs`.
   * `akasa/workers/metronome.py`: `_metronome_loop`, `submit_job`, `submit_one_shot_job`, `pause_job`, `resume_job`, `cancel_job`, `sweep_ephemeral_artifacts`.
   * `akasa/workers/immediate.py`: `submit_immediate_job`, `_execute_immediate_job`, `run_parallel`, `wait_for_jobs`.
   * `akasa/workers/__init__.py`: Clean Ring 1 boundary barrel re-exporting public worker primitives.
2. **`akasa/extension.py` (~780 LOC) → Split into 3 cohesive modules:**
   * `akasa/settings.py`: `SettingsManager`, `StoreManager`, `get_registered_settings_schemas`, `_materialize_schema_node`.
   * `akasa/ipc.py`: `_CAPABILITY_REGISTRY`, `get_registered_capabilities`, `_extract_http_request_payload`, `_marshal_http_return`.
   * `akasa/extension.py`: `AkasaExtension`, `ExtensionContext`, `JobManager`, `DatabaseWrapper` + Ring 1 barrel re-exports.

### 3.2 Ring 2: `sutram` Frontend Micro-Kernel
1. **`sutram/sutram/js/primitives.js` (~1,350 LOC, 20 custom elements) → Split into 4 modules + barrel:**
   * `sutram/js/chassis_adapter.js`: `REQUIRED_CHASSIS_PRIMITIVES`, `validateChassisContract`, `SutramUIAdapter`, and thin `<sutram-*>` passthrough/event bridges (`SutramView`, `SutramAsyncBtn`, `SutramStatusBar`, `SutramToastContainer`, `SutramCard`, `SutramModal`, `SutramWindow`, `SutramEditor`, `SutramDropdown`).
   * `sutram/js/settings_engine.js`: `SutramFieldCard`, `SutramSettingsForm`, `SutramGenericSettingsModal`.
   * `sutram/js/action_broker.js`: `SutramEntityActions`, `SutramSelectionTray`, `SutramSubtabMenu`.
   * `sutram/js/composites.js`: `SutramVirtualList`, `SutramFolderBrowser`, `SutramSelectorModal`, `SutramReportProjection`, `SutramDagTree`, `SutramFloatingHud`.
   * `sutram/js/primitives.js`: Clean Ring 2 barrel (`export * from ...`).
2. **`sutram/sutram/js/sutram_sdk.js` (~980 LOC) → Split into 3 modules + barrel:**
   * `sutram/js/store_kernel.js`: `StoreRegistry`, `createSutramStore`, `bindStoreInput`.
   * `sutram/js/layout_store.js`: `LayoutStore`, `canUseMultiWindowPopout`, `_layoutBus`.
   * `sutram/js/sutram_sdk.js`: `SutramContextMixin`, `SutramElement`, `ExtensionRegistry`, core stores + Ring 2 barrel re-exports.

---

## 4. Ring 3 (`insetu/core` & `insetu/extensions`) Domain Decomposition

### 4.1 Core VFS, Bridge, Agent & LLM Subsystems

| Subsystem | Current Monolith | Target Single-Responsibility Modules (Direct Imports) |
| :--- | :--- | :--- |
| **Core VFS (`insetu/core/fs/`)** | **`fs.js`** (~1,380 LOC): Mixes `FsStore`, VFS network/export helpers, `InSetuEditorProjection` (~420 LOC), `InSetuFileDiffProjection` (~220 LOC), and 5 modal projections. | • `fs/fs_store.js`: `FsStore`, buffer OCC rebase, auto-save, `hydrateVfsBuffer`, export/share helpers<br>• `fs/fs_editor_projection.js`: `InSetuEditorProjection`, `InSetuFrontmatterEditor`, `InSetuFileDiffProjection`<br>• `fs/fs_modals.js`: `InSetuMoveFileProjection`, `InSetuNewFileProjection`, `InSetuNewFolderProjection`, `InSetuLinkInsertProjection`, `InSetuBrowserProjection`<br>• `fs/fs.js`: `InSetuVFSExplorer`, extension registration & `window.inSetu.vfs` / `ui` bindings |
| **Core Agent (`insetu/core/agent/`)** | **`orchestrator.py`** (~1,080 LOC) & **`agent.js`** (~1,150 LOC) | • `agent/routine_loader.py`: `parse_routine_content`, `serialize_routine_to_markdown`, `validate_routine_definition`, `list_available_routines`, `load_routine_definition`, `resolve_routine_mode` (imported directly by `engine_agent.py` & `engine_mcp.py`)<br>• `agent/expressions.py`: `evaluate_when_condition`, `_resolve_var_path`, `_interpolate_all_syntax`, `_vault_if_oversized`<br>• `agent/orchestrator.py`: `execute_declarative_routine` wavefront runtime<br>• `agent/agent_store.js`: `AgentStore`, `classifyRoutineTargetUri`<br>• `agent/agent_routine_studio.js`: `InSetuAgentRoutineProjection`, `InSetuCoreAgentRoutines`<br>• `agent/agent.js`: `InSetuCoreAgent`, `InSetuCoreAgentSessions`, extension registration |
| **Core Bridge (`insetu/core/bridge/`)** | **`bridge_vfs.py`** (~720 LOC) & **`bridge.js`** (~930 LOC) | • `bridge/parser.py`: Extracted from `utils_core.py`<br>• `bridge/bridge_syntax.py`: `_validate_buffer_syntax`, `_is_banned_bridge_target`<br>• `bridge/bridge_resolvers.py`: Chain-of-Responsibility path & anchor resolution pipeline<br>• `bridge/bridge_vfs.py`: Transaction coordinator (`_process_sync_transaction`, `execute_bridge_sync`) & `bridge_ledger` keyframe snapshotting<br>• `bridge/bridge_store.js`, `bridge/bridge_projections.js`, `bridge/bridge_history.js`, `bridge/bridge.js` |
| **Core LLM (`insetu/core/llm/`)** | **`engine_llm.py`** (~840 LOC) | • `llm/llm_drivers.py`: `_get_provider_semaphore`, `_stream_anthropic`, `_stream_gemini`, `_stream_openai_compatible`, `_stream_claude_cli`, `_run_decisions_inference`, `_run_single_inference`<br>• `llm/llm_catalog.py`: `_harvest_external_model_catalog`, `export_public_llm_catalog_file`, `_infer_model_cognitive_tier`<br>• `llm/engine_llm.py`: `LLM_SETTINGS_SCHEMA`, compute pool/profile resolution, and HTTP routes |

### 4.2 Heavy Feature Extensions (`tracker`, `git`, `update`)

| Extension | Current Monoliths | Target Single-Responsibility Modules |
| :--- | :--- | :--- |
| **Issue Tracker (`extensions/tracker/`)** | **`ext_tracker.js`** (~1,390 LOC) & **`engine_tracker.py`** (~920 LOC) | • `tracker/tracker_store.js`: `KanbanStore` & date/repo helpers<br>• `tracker/tracker_modals.js`: `InSetuExtTrackerModals` (New Task, Spawn Template, Convert, Parent/Dep Picker, Hierarchy Tree, Blockers)<br>• `tracker/tracker_settings.js`: `InSetuExtTrackerSettings` & `InSetuTrackerEditProjection`<br>• `tracker/ext_tracker.js`: `InSetuTrackerTicket`, `InSetuExtTracker` board/stacked/log views & registration<br>• `tracker/tracker_enforcer.py`: `enforce_declarative_tickets`, `archive_stale_tickets`, `restore_ticket_metadata_from_git`<br>• `tracker/engine_tracker.py`: Schema, ticket CRUD/transitions, CQRS SQLite index routes |
| **Version Control (`extensions/git/`)** | **`engine_git.py`** (~840 LOC) & **`ext_git.js`** (~860 LOC) | • `git/git_diffs_compiler.py`: `generate_diff_context`, `diffable_changes`, `_DIFF_FILE_CACHE`<br>• `git/engine_git.py`: `execute_git`, sweepable state scanner, push/pull/branch/remote routes<br>• `git/git_ctrl_ui.js`: `InSetuExtGitCtrl`, `InSetuGitPushProjection`<br>• `git/ext_git.js`: `GitStore`, `generateDiffs`, `InSetuExtGitDiffs` & registration |
| **Semantic Update (`extensions/update/`)** | **`engine_update.py`** (~670 LOC) & **`ext_update.js`** (~770 LOC) | • `update/update_builder.py`: `_build_and_validate_distribution`, `_execute_twine_upload`, `_clean_semantic_release_logs`<br>• `update/engine_update.py`: Settings schema, status/bump/publish workers & routes<br>• `update/update_store.js`: `UpdateStore`<br>• `update/ext_update.js`: `InSetuExtUpdate` view & registration |

---

## 5. Pre-1.0 Legacy Pattern Eradication Checklist

Alongside file decomposition, we will eradicate the following legacy compatibility shims and update their unit tests:

1. **Eradicate Kitchen-Sink Imports from `insetu.core.utils_core`:**
   - Replace all `from insetu.core.utils_core import parse_blocks` with `from insetu.core.bridge.parser import parse_blocks`.
   - Replace all extension imports of `fetch_url`, `FetchRefused`, `FetchHTTPError`, `child_env`, `execute_binary`, `approve_command`, and `is_command_approved` from `utils_core` with imports from `insetu.core.sdk` (and core imports from `insetu.core.system.security_io`).
   - Replace all `start_filesystem_observer` / `stop_filesystem_observer` imports from `utils_core` with `insetu.core.system.watchdog`.
2. **Eradicate Duplicate Working-Set Keys in `AgentStore` (`agent.js`):**
   - `AgentStore` currently duplicates `pinnedFiles` as `attachedFiles` and `referenceFiles` as `readOnlyFiles` on every state update. Standardize on `pinnedFiles` (Tier 2 full edit targets) and `referenceFiles` (Tier 1 AST interface slices) across `agent.js` and tests, and delete `attachedFiles` / `readOnlyFiles` state aliases from `AgentStore`.
3. **Eradicate Legacy Single-Provider Hidden Settings in `engine_llm.py`:**
  - Remove the 8 `"type": "hidden"` legacy settings (`provider`, `base_url`, `model`, `tier_fast_model`, `tier_thinking_model`, `tier_frontier_model`, `max_parallel_requests`, `api_key`) and `_synthesize_legacy_pool_and_profile()` once unit tests are updated to configure `compute_endpoints` and `llm_profiles` directly.
4. **Eradicate Inline CSS Leaks Across `insetu` & `sutram` (The CSS Vacuum):**
  - **`insetu/core/offline/offline_ui.js`:** Replace the hand-rolled storage quota progress bar `<div>` and hardcoded `height: 400px` wrapper with a semantic `<sutram-progress-bar>` primitive in `yenVUI`/`sutram` and a `size="normal"` height preset on `<sutram-virtual-list>`.
  - **`insetu/core/fs/fs.js`:** Replace the inline `style="padding: 8px 15px..."` title wrapper in `InSetuEditorProjection` with `<sutram-surface variant="ghost" padding="sm">` and support `mountDynamicSlot(tag, { extName })` natively in `SutramElement` to eliminate `<div style="display: contents;">` wrappers.
  - **`insetu/core/system/system.js`:** Replace the raw `document.body.innerHTML` inline-styled Auth Gate and Access Denied screens with a semantic `<sutram-auth-gate>` component in `sutram`.
  - **`sutram/js/app_shell.js` & `primitives.js`:** Consolidate remaining inline `style="..."` strings on internal kernel templates (`.top-utility-row`, `.mobile-dots-wrapper`, `.global-launcher-menu`, `.windowed-surfaces`, `SutramSelectionTray`, `SutramEntityActions`) into their `static styles` CSS blocks.

---

## 6. Phased Execution Waves & Fitness Verification

Each wave is independently executable and verified by the full test and architectural fitness suite:

### Wave 1 — Purifying `utils_core.py`, `sdk/__init__.py` & `insetu/core/system`
*(Constraints: `directives.py`, `attestations.py`, `protected_changes.py`, `cli.py`, and `fallback_bridge.py` are hands-off in Wave 1. Each sub-wave A1–A3 is its own `refactor(<area>): ...` commit.)*
* [x] **A1 (`utils_core.py` split):** Extract `insetu/core/system/watchdog.py`, `insetu/core/system/security_io.py`, and the workspace-extension helpers into `insetu/core/system/ext_manager.py`; lazily re-export moved extension-facing symbols on `insetu/core/sdk/__init__.py`; rewire callers across `core/`, `extensions/` (moved symbols only -> `insetu.core.sdk`), `tests/`, and `insetu/app.py`.
* [x] **A2 (`engine_system.py` split):** Extract `system/openapi.py` (OpenAPI 3.0 builder), `system/ext_manager.py` (`_StaticExtMeta`, `_inspect_or_resolve_extension_meta`, `_resolve_extension_module_and_bp`, `_get_whitelisted_extension_packages`, `_background_install_extension_deps`, `_workspace_extensions_report`, and the 4 `extensions/*` routes with their payload types and `mcp_expose=False` flags), and `system/memory_profiler.py` (`tracemalloc` and memory helpers). Keep protected-change and directives routes in `engine_system.py`.
* [x] **A3 (`system` frontend split):** Extract `system/uri.js` (`InSetuURI`, `BucketAddress`), `system/insetu_element.js` (`InSetuElement`), `system/manifest_sync.js` (`checkManifestVersion`, delta sync, cache warmer), and `system/components/ui_schema_repeater.js` (`InSetuSchemaRepeater` and field helpers). Keep `insetu_sdk.js` re-exporting public symbols for extensions; rewire core modules to import directly; keep `_renderAgentDirectivesSection` in `ui_system_settings.js`; update `sw.js` / asset lists if needed.
* [x] **A4 (Wave 1 fitness ratchets):** Add to `tests/fitness/`:
  1. **Banned legacy imports:** Fail if any module imports a symbol moved in A1/A2 from `insetu.core.utils_core` or `insetu.core.system.engine_system`.
  2. **Extension membrane ratchet:** Fail if `insetu/extensions/*` imports from `insetu.core.system.*` or `insetu.core.utils_core` outside an explicit shrinking allowlist of the remaining post-A1 `utils_core` imports.
  3. **Module size ratchet (E2):** Record the current line counts of the 15 largest modules across `akasa`, `sutram`, `insetu/core`, and `insetu/extensions` (excluding vendored files) as shrinking ceilings, and fail if any unlisted module exceeds 800 lines.

### Wave 2 — `akasa` & `sutram` Kernel Decomposition
* [ ] **2.1** Split `akasa/workers/__init__.py` into `dag.py`, `validation.py`, `metronome.py`, and `immediate.py` (re-exported via `workers/__init__.py`).
* [ ] **2.2** Split `akasa/extension.py` into `settings.py`, `ipc.py`, and `extension.py`. Run `pytest` in `akasa`.
* [ ] **2.3** Split `sutram/sutram/js/primitives.js` (`chassis_adapter.js`, `settings_engine.js`, `action_broker.js`, `composites.js`) and `sutram/sutram/js/sutram_sdk.js` (`store_kernel.js`, `layout_store.js`).
* [ ] **2.4** Add `<yenvui-progress-bar>` / `<sutram-progress-bar>` and `<sutram-auth-gate>`, move inline `style="..."` attributes in `app_shell.js` and `primitives.js` into `static styles`, and strip the remaining inline `style="..."` leaks from `offline_ui.js`, `fs.js`, and `system.js`. Run `sutram` tests, then run `bash insetu/scripts/vendor_sutram.sh`.

### Wave 3 — Core Domain Decomposition (`fs`, `agent`, `bridge`, `llm`) & Pre-1.0 Shim Removal
* [ ] **3.1** Split `insetu/core/fs/fs.js` into `fs_store.js`, `fs_editor_projection.js`, `fs_modals.js`, and `fs.js`.
* [ ] **3.2** Split `insetu/core/agent/orchestrator.py` into `routine_loader.py`, `expressions.py`, and `orchestrator.py` (rewiring `engine_agent.py` and `engine_mcp.py` to import directly from `routine_loader.py`).
* [ ] **3.3** Split `insetu/core/agent/agent.js` into `agent_store.js`, `agent_routine_studio.js`, and `agent.js`, and remove the duplicate `attachedFiles`/`readOnlyFiles` store aliases.
* [ ] **3.4** Split `insetu/core/bridge/bridge_vfs.py` (`bridge_syntax.py`, `bridge_resolvers.py`, `bridge_vfs.py`) and `bridge.js` (`bridge_store.js`, `bridge_projections.js`, `bridge_history.js`, `bridge.js`).
* [ ] **3.5** Split `insetu/core/llm/engine_llm.py` (`llm_drivers.py`, `llm_catalog.py`, `engine_llm.py`) and remove the 8 legacy hidden single-provider settings.

### Wave 4 — Heavy Extension Decomposition (`tracker`, `git`, `update`) & AST Fitness Ratchets
* [ ] **4.1** Split `extensions/tracker/ext_tracker.js` & `engine_tracker.py`, `extensions/git/ext_git.js` & `engine_git.py`, and `extensions/update/ext_update.js` & `engine_update.py`.
* [ ] **4.2** Add permanent AST fitness ratchets in `insetu/tests/fitness_functions.py`:
  - **Banned Legacy Imports:** Forbid importing `parse_blocks`, `fetch_url`, `FetchRefused`, `FetchHTTPError`, `child_env`, `approve_command`, `is_command_approved`, or `start_filesystem_observer` from `insetu.core.utils_core`.
  - **Extension Membrane Enforcement:** Forbid `insetu/extensions/*` from importing internal `insetu.core.system.*` modules directly (must import through `insetu.core.sdk`).
  - **Module Cohesion Budget (`MAX_MODULE_LINE_BUDGET = 800`):** Ratchet maximum line counts across `akasa`, `sutram`, `insetu/core`, and `insetu/extensions` (excluding vendored third-party bundles) so God Objects can never silently reform.
