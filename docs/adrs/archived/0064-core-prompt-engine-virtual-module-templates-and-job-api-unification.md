# ADR 0064: Core Prompt Engine, Virtual Module Template Projection, and Akasa Job API Unification

## Status
Accepted (2026-10-16)

## Context
As the inSetu Workbench expanded its AI orchestration and local agent harness (ADR 0058), prompt engineering, system instruction templating, and module-specific prompts (such as the Yomama Patch Protocol prompt) were fragmented:
1. **Prompt Domain Fragmentation**: Prompt templates were either marooned as hardcoded string constants in Python engines or isolated in optional extension directories, making it difficult for the core chassis and agent harness to access canonical prompts.
2. **Module Template Bleed vs. Sovereignty**: Bundled modules (like `bridge` or `gather`) needed to distribute canonical prompts and protocols without polluting or mutating the user's sovereign workspace filesystem.
3. **Write-Path Immutability**: Built-in module templates required strict read-only protection on the physical VFS write-path to prevent accidental overwrites, while still allowing operators to inspect, embed, or fork templates into their workspace.
4. **Backend Job API Divergence**: While Akasa provided the formalized `ctx.jobs` SDK, several backend engines (`engine_agent.py`, `engine_bridge.py`, `engine_gather.py`, `engine_topology.py`, `engine_system.py`) still invoked legacy primitives (`submit_immediate_job`, `update_immediate_job_status`, `register_callback`) or queried `workers.db` directly.
5. **Cartographer & Gather Compilation Overhead**: High-frequency compile cycles re-parsed and re-mapped untouched repositories in Cartographer, while Gather context compilation assembled multi-megabyte string buffers in RAM for SHA-256 fingerprinting.

## Decision
1. **Core Prompt Engine & Virtual Module Template Projection (`engine_prompts.py`, `prompts.js`)**:
   - Graduated prompt management into a Tier 2 Core Substrate engine (`prompts`).
   - Implemented `PromptsVFSDriver` subclassing `DefaultVFSDriver`. The driver intercepts `ctx://prompts/.templates/<mod>` paths, routing `.templates/user` to global user templates at `ws://default/prompts/.templates/user` and routing `.templates/<mod>` to the active core or extension module's `prompts/` directory.
   - Enforced write-path immutability in `engine_fs.py` (`_is_readonly_template_path`). Any save, move, archive, or delete operation targeting a built-in template (outside of `/.templates/user/`) is rejected with HTTP 403 Forbidden.
   - Introduced the `prompt-fork-template` polymorphic entity action in `prompts.js`, allowing operators to copy read-only module templates into their workspace `ctx://prompts/` directory for customization.
   - Supported recursive `{{include_prompt: <filename>}}` macro resolution with parameter substitution (`engine_prompts.py`).
2. **Universal Akasa Kernel Job API Unification**:
   - Replaced all legacy `submit_immediate_job`, `update_immediate_job_status`, and `register_callback` calls with `ctx.jobs.submit(..., job_category=...)`, `ctx.jobs.submit_one_shot()`, and `@bp.worker` decorators.
   - Migrated background pipeline lookups to `ctx.jobs.find_active_pipeline_job()` and job telemetry polling to `ctx.jobs.get_status()`.
   - Migrated ephemeral artifact registration to `ctx.jobs.register_ephemeral()`, `ctx.jobs.get_ephemerals()`, and `ctx.jobs.clear_ephemerals()`.
3. **Cartographer Signature Caching & Incremental Payload Hashing**:
   - Implemented thread-safe caching in Cartographer (`_CARTOGRAPHER_SIG_CACHE`, `_CARTOGRAPHER_CACHE_LOCK`) keyed by repository file list tuples, index mtimes, and managed directory configurations. Unchanged repositories bypass AST re-parsing and VFS writes.
   - Refactored `compile_context_payload` in `engine_gather.py` to stream block buffers into `hasher.update()`, eliminating redundant mega-string allocations in RAM, and maintained chunk bins as part lists joined only once at write time.
4. **Universal Selector-Scoped Store Subscription Migration**:
   - Converted all remaining monolithic store subscriptions across `agent.js`, `fs.js`, `offline_ui.js`, `ui_primitives.js`, and `ui_system_settings.js` to selector-scoped subscriptions (`this.subscribe(Store, selector, listener)`), satisfying the `COARSE_STORE_SUBSCRIPTION_MANDATE`.
5. **UI Utility Standardization (`truncateFilename`)**:
   - Added and exported `truncateFilename(filename, maxLen, ellipsis)` across `insetu_sdk.js` and `utils_core.py`, standardizing basename shortening across spatial window projections and diff viewers.

## Consequences
* **Positive**: Absolute separation between built-in read-only module templates and sovereign user workspace prompts.
* **Positive**: Deterministic, single-source-of-truth background job orchestration via the Akasa `ctx.jobs` framework.
* **Positive**: Substantial reduction in RAM allocations and disk I/O churn during Cartographer sweeps and Gather compilations.
* **Positive**: 100% compliance across static analysis and architectural fitness functions.
* **Negative**: Custom module templates must be placed inside standard `prompts/` subdirectories to participate in virtual `.templates` projection.