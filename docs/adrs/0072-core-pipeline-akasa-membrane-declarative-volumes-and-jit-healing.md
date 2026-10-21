# ADR 0072: Core Pipeline Akasa Membrane Decoupling, Declarative Volume Schemas, JIT Context Self-Healing, and Sub-Navigation Menu Consolidation

## Status
Accepted (2026-10-21)

## Context
As the inSetu Developer OS stabilized its Three-Tier Architecture, several architectural seams in the core pipeline required structural alignment:
1. **Akasa Membrane Bleed in Core Engines**: While Tier 3 extensions were restricted from importing directly from `akasa.*`, Tier 2 core engines (`cartographer.py`, `engine_gather.py`, `engine_prompts.py`, `engine_topology.py`) directly imported kernel primitives (`akasa.utils`, `akasa.vfs`, `akasa.db`, `akasa.hooks`, `akasa.workers`). This bypassed the 4-File Membrane (`app.py`, `cli.py`, `sdk/__init__.py`, `utils_core.py`), creating drift in utility resolution and preventing static verification of kernel membrane boundaries.
2. **Imperative Volume Mounting**: Core engines managing virtual schemes (`ctx://contexts`, `ctx://prompts`) imperatively registered drivers, requested path keys, and executed directory migrations via `@hooks.on('workspace_boot')` and `@hooks.on('request_paths')`.
3. **Cold-Cache Context 404s**: When physical context caches were wiped or cold, requesting logical base URIs (`ctx://contexts/<name>_context.txt`) returned HTTP 404 unless a manual compilation had run. Furthermore, multi-part chunking left base URIs without physical disk representations.
4. **Metadata Overwrite on Idempotent Compilations**: When context payloads had identical content hashes, compilation was skipped to avoid redundant I/O, but updated metadata (such as modified repository domains or titles) was dropped.
5. **Prompt Sub-Navigation Action Component Drift**: The Prompts extension registered a bespoke Web Component (`<insetu-ext-prompts-actions>`) in `slots:sub-navigation-actions` and referenced deprecated `globalBrowsePath`.

## Decision
1. **Core Substrate Akasa Membrane Decoupling**:
   - Refactored `cartographer.py`, `engine_gather.py`, `engine_prompts.py`, and `engine_topology.py` to import framework primitives strictly from `insetu.core.sdk` and `insetu.core.utils_core`.
   - Converted all raw `@hooks.on(...)` subscriptions across core engines to blueprint-scoped decorators (`@gather_bp.on`, `@cartographer_bp.on`, `@prompts_bp.on`, `@topology_bp.on`).
2. **Declarative Volume Topologies for Core Engines**:
   - Declared `volumes` schemas on `gather_bp` and `prompts_bp` (`tier: "cache"` / `"data"`, `scheme: "ctx"`), letting `InSetuExtension` automate path provisioning, driver binding, and legacy migrations.
3. **Self-Healing JIT Artifact Resolution (`vfs_resolve_file`)**:
   - Implemented `_resolve_or_heal_compiled_ctx_artifact` under `@gather_bp.on('vfs_resolve_file')`. The resolver maps multi-part base URIs to their first chunk and dynamically invokes targeted compilers (`generate_context_file` or `_compile_wf`) when physical files are missing or cold on disk, protected against reentrancy loops via `_LOCAL_HEAL_GUARD`.
4. **Metadata Preservation on Idempotent Skips & Domain Healing**:
   - Refactored `compile_context_payload` to update existing manifest metadata in place when content hashes match and physical chunk writes are bypassed.
   - Added `_heal_entry_domain` to ensure manifest entries inherit parent repository domains.
5. **Declarative Sub-Navigation Menu Actions & Tab-Scoped Browse Paths**:
   - Eradicated `<insetu-ext-prompts-actions>` and `slots:sub-navigation-actions` in favor of declarative `menuStores: ["App"]` and `menuActions: _buildPromptsMenuActions` on `slots:sub-navigation`.
   - Migrated `InSetuExtPrompts` from `globalBrowsePath` to tab-scoped `browsePath` via `AppStore.getState().getBrowsePath()`.

## Consequences
* **Positive**: Absolute membrane boundary isolation with zero direct `akasa.*` imports across core engines.
* **Positive**: Declarative volume lifecycle management without imperative driver mounting boilerplate.
* **Positive**: Zero read-time 404 errors for cold or multi-part compiled context payloads.
* **Positive**: Manifest entries remain synchronized with configuration changes even during idempotent compilation skips.
* **Positive**: Unified sub-navigation header menus adhering to zero-CSS presentation standards.