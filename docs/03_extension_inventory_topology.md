# 03: inSetu Extension Inventory & Topology

**Identity**: The Architect.
**Mission**: To maintain a living, deterministic inventory of the inSetu Directed Acyclic Graph (DAG), mapping the core Micro-Kernel boundaries against all active, planned, and decoupled extensions.

---

## 1. The Mother Ship (Core Micro-Kernel)
The core OS is strictly domain-agnostic. It does not know what a "citation" or a "kanban board" is. Its sole responsibility is orchestration, routing, and physical I/O operations.
* **`insetu/static/vendor/sutram/` (Sutram Presentation Kernel):** Tier 0 micro-kernel managing UI app shell layout (`sutram-app-shell`), Zustand store factories (`createSutramStore`), background job polling (`createJobPoller`), hierarchical shortcut routing (`initShortcutRouter`), and shared styles.
* **`insetu/core/topology/engine_topology.py` (The Topology Engine):** Single Source of Truth for physical file existence (`topology_ledger`) and bucket routing, hosting Stage 1 Slew Limiting (`topology_event_buffer`), workspace overview (`topology/overview`), plan target validation (`topology/verify_plan_targets`), and the deterministic 3-pillar upkeep audit engine (`topology/audit_upkeep`).
* **`insetu/core/gather/engine_gather.py` (The RAG Compiler):** Blindly compiles virtual contexts and physical directories based on the configuration matrix, hosting background compilation workers and submission endpoints.
* **`insetu/core/editor/engine_editor.py` (The Editor Engine):** Core extension managing global code and text editor preferences (`EDITOR_SCHEMA`) and per-file preferences (`file_preferences` SQLite schema).
* **`app.py` / `insetu/core/bridge/engine_bridge.py` (The Sync Bridge):** The Yomama translation layer, physical atomic commit engine, and multi-surface shell (`slots:yomama-surface`, `slots:yomama-drawer`). Features AST refactoring directives (`RELOCATE`, `RENAME`), Yomama v4 directives (`TEXTEDIT`, `JSON_PATCH`, `MOVE_FILE`, `ARCHIVE_FILE`, `DELETE_FILE`), Semantic Gatekeeper confirmation, transport macro escaping (`{{ymm:...}}`), deferred chunk post-valid buffer auto-healing, commit message synthesis, post-syntax test diagnostics (`bridge.test`), P5 human-only command approval (`bridge.test.approve`), and the Receipts history tab (`insetu-ext-bridge-history`) backing the Ephemeral Patch Ledger (`bridge_ledger`).
* **`insetu/core/cartographer/cartographer.py` (The Cartographer):** Generates code indices, maps workspace topology, and tracks AST symbol implementation drift via `symbol_ledger` and normalized body hashing (`verify_symbols`, `enrich`, and `[stale?]` sentinels).
* **`insetu/core/offline/engine_offline.py` (The Offline Engine):** Tier 0 core engine managing local caching, IndexedDB state warming, and offline synchronization quotas.
* **`insetu/core/llm/engine_llm.py` (The LLM Gateway):** Universal inference orchestrator managing daemon-level Compute Endpoint Pools (`compute_endpoints`), Cognitive Configuration Profiles (`llm_profiles`), admission control semaphores, TypeSafe Jev decision models (`POST llm/decide`), execution target resolution (`POST llm/resolve_target`), live multi-source model pricing catalog harvesting (`/api/system/llm_catalog.json`), cognitive tier catalog inference (`DRIVER_TIER_DEFAULTS`, `_infer_model_cognitive_tier`), declarative target binding repeater schemas, formal output schema registry bouncer delegation, and push-to-talk audio transcription.
* **`insetu/core/agent/engine_agent.py` & `agent.js` (The Agent Harness):** Autonomous multi-mode agent engine and multi-turn chat UI orchestrating sovereign Markdown-as-Code routine execution DAGs (`orchestrator.py`), formal response schemas (`schemas/`), Ring 0 topological wavefront parallelization, 256KB disk scratch vaulting, colon-scoped slash commands (`/routine:scope:stage`), `/code` topology-aware context scouting, in-composer Web-Chat handoff with direct reply ingestion, reentrant sub-routine handoff bubbling, dual-representation transcript history retention (`raw_content`), root-boundary conversational prose/patch splitting with Bridge staging forwarding, test runner triage (`agent.run_test`, `bridge.test`), two-stage rolling history compaction, 5-turn working-set TTL decay with Hebbian affinity reinforcement, execution budget checkpoints, and transactional rollback (`/undo`).
* **`insetu/core/prompts/engine_prompts.py` & `prompts.js` (The Prompt Engine):** Tier 2 Core engine managing workspace prompts, virtual `.templates/` projection via `TemplateOverlayVFSDriver`, 3-Tier Same-Name Override Cascade resolution, and macro resolution.
* **`insetu/core/system/cli_commands.py` (CLI Command Engine):** Modularized command suite driving onboarding initialization (`insetu init`), service control, and desktop application shortcuts.
* **`insetu/core/mcp/engine_mcp.py` (The Model Context Protocol Gateway):** JSON-RPC 2.0 server (MCP 2025-03-26 specification) exposing tools (`cartographer.extract`, `fs.fetch`, `bridge.sync`), resources, and prompts over HTTP and stdio transport with strict `mcp_expose=False` tool hiding.
* **`insetu/core/remote/engine_remote.py` (The Remote Access Gateway):** Tier 2 Core Substrate engine managing remote network access, Tailscale identity peer verification (`classify_peer`), authenticated WHOIS handshakes, proxy header registration, and preview HTTPS proxy routing.
* **`insetu/kernel/hooks.py` (The Event Bus):** The API substrate allowing extensions to intercept RAG compilation, VFS commits, and OS process lifecycle events.
* **`akasa.workers` (The Stateless Relay):** The centralized background task manager that sweeps switchboards and manages active SQLite worker threads across workspace swaps. It incorporates an integrated native filesystem watcher (`watchdog`) to automatically record unmanaged non-Git directory mutations into an SQLite fixture ledger for differential context compilation.

---
## 2. Active Extensions (V1 Finalized)
These are fully built and compliant extensions currently operating within the system. Note that all domain extensions now reside physically in the `insetu/extensions/` and `insetu/static/js/extensions/` directories to preserve the micro-kernel boundary.
### A. Git Operations (`engine_git.py`)
* **Status:** Active Extension (Decoupled from Core Kernel, Upgraded with Dynamic Settings, Declarative Volumes, and Spatial Projections).
* **Role:** Version control, diff generation, repository reconciliation strategies, and workspace sweeping.
* **Dependencies (`__depends__`):** `['gather']`
* **Data Containment:** Ephemeral (direct `.git/` inspection) with configuration states bound to tenant settings databases and declarative diff caching (`ctx://diffs/`).
* **Injection Surfaces:**
    * Polymorphic Cards: Registers `git-push`, `git-sweep`, `git-ctrl-init`, `git-ctrl-remote`, `git-ctrl-pull`, `git-ctrl-branch`, `git-state-continue`, `git-state-abort`, and `git-resolve-conflicts` actions inside the centralized Entity-Action Registry.
    * Spatial Projections: Projects commit message drafting into `InSetuGitPushProjection` (`git:push`) and pull dry-run inspection into `sutram-report-projection` (`git:preview`) with integrated runtime reconciliation controls.
    * Compilation Pipeline: Registers the `git_diffs` step (`anchor: "body"`, `order: 30`) via `@git_bp.on('register_compilation_steps')` to compile diff payloads off-thread.
    * Configuration: Declares dynamic repo-level pull strategy selectors (`rebase`, `merge`, `ff_only`), as well as declarative `repoConfigOptions` (`git-repo-exclude`) and `bucketConfigOptions` (`git-exclude`).
    * Capabilities & Autonomous Routines: Exposes `git.compile_diffs` and `git.list_dirty_diff_buckets` capabilities, alongside declarative agent routines `/audit` (`diff_audit.md`) and `/closeout` (`close_session.md`) with programmatic commit message pre-seeding in `InSetuGitPushProjection`.
### B. Citations (`engine_citations.py`)
* **Status:** Active Extension (SDK V2 with IoC Topology Compilation, Transport Decoupling & Canonical Routing).
* **Role:** Manages academic reference libraries, bibliography parsing, citation insertion, and global/repo-scoped context generation.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `{ARTIFACTS_BASE}/citations.db` (SQLite ledger synced with `library.json` and `citations_ui.json`).
* **Injection Surfaces:**
    * Core Hooks: Blueprint-scoped `@citations_bp.on('mutate_workspace_config')`, `@citations_bp.on('gather_declare_topology')` (declaring global and scoped citation contexts with dynamic generator and recall callbacks), and `@citations_bp.on('pre_compile_document')`.
    * UI Layout: Primary Navigation Tab (`library` -> `lib-main`, `lib-explore`, `lib-import`).
    * Polymorphic Cards: Registers `cit-notes`, `cit-edit`, `cit-pin`, and `cit-import` entity actions.
### C. Research (`engine_research.py`)
* **Status:** Active Extension (SDK V2 with Managed Timeouts, Ingest Capability Dispatch & In-App Dependency Installation).
* **Role:** Web scraping, search aggregation (Serper, Google, DuckDuckGo), payload extraction via Ingest, and AI-assisted batch triage.
* **Dependencies (`__depends__`):** `['ingest']`
* **Data Containment:** `{ARTIFACTS_BASE}/research.db` (`research_jobs` and `research_inbox` tables).
* **Injection Surfaces:**
    * Worker Matrix: Dispatches non-blocking metronome tasks (`gather_next_page`, `scrape_next_link`, `export_context_task`) with dynamic jitter pacing and active workspace validation.
    * Spatial Projections: Decoupled article inspection into `InSetuResearchPreviewProjection` (`research:preview`).
    * UI Layout: Sub-navigation Tab (`edit` -> `research`).
    * Polymorphic Cards: Registers `rs-pause`, `rs-resume`, `rs-retry`, `rs-cancel`, and `rs-delete` actions on `research_job` entities.
### D. Kanban Tracker (`engine_tracker.py`)
* **Status:** Active Extension (SDK V2 with Pure .insetu-data Containment, Flask Transport Decoupling, Typed Workers & Canonical Route Normalization).
* **Role:** Project management, issue routing, sprint tracking, shadow board template spawning, task hierarchy tree inspection, and active focus isolation.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `~/.insetu/data/tracker.db` (CQRS Cache) backed by asynchronous Markdown ticket commits via the VFS strictly into `<repo>/.insetu-data/tracker/`.
* **Injection Surfaces:**
    * Spatial Projections: Decoupled ticket editing into `InSetuTrackerEditProjection` (`tracker:edit`) pinned to spatial viewport columns with in-place frontmatter synchronization (`syncFrontmatter`).
    * Settings Hub Integration: Embedded `InSetuExtTrackerSettings` (`?embedded=${true}`) inside the unified Settings Hub via declarative `settingsActions`, eliminating standalone global modal overlays.
    * Dynamic Layout Slots: Manages custom sub-navigation and primary navigation tabs via `ExtensionRegistry.setDynamicLayoutSlots()` with declarative `menuActions: _buildTrackerMenuActions`.
    * Config Hooks: Blueprint-scoped `@tracker_bp.on('mutate_workspace_config')` injecting `.insetu-data/tracker/` sub-buckets into the RAG Gatherer based on active schema types.
    * Virtual Module Templates: Projects `.insetu-data/tracker/prompts/ticket_authoring_guide.md` under `ctx://prompts/.templates/tracker/ticket_authoring_guide.md` (ADR 0064).
    * Core Hooks: Blueprint-scoped `@tracker_bp.on('workspace_boot')` (`heal_uri_column`), `@tracker_bp.on('topology_boot_complete')` (archiving scheduler and cache sync), `@tracker_bp.on('vfs_mutated')`, and `@tracker_bp.on('request_changelog_suggestions')`.
    * Polymorphic Cards: Registers `task-start`, `task-close`, `task-convert`, `task-hierarchy`, `task-focus`, `task-new-child`, `task-reopen`, `task-pause`, `task-spawn` entity actions.
### E. Code Formatting (`engine_format.py`)
* **Status:** Active Extension.
* **Role:** Source code beautification and formatting (JS, JSON, CSS, HTML, Python).
* **Dependencies (`__depends__`):** `None`
* **Injection Surfaces:**
    * Polymorphic Cards: Registers `format-code` action.
### P. Document Publishing (`engine_publish.py`)
* **Status:** Active Extension (SDK V2 with Substack Rich-Text Snippet Support, Binary Whitelisting & Canonical Fetch Routing).
* **Role:** Multi-format document compilation via Pandoc (PDF, DOCX, HTML, and Substack/Medium HTML fragments) with wordcount macro stripping.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** Ephemeral artifacts in `{ARTIFACTS_BASE}/` with automatic TTL cleanup via `ctx.jobs.register_ephemeral`.
* **Injection Surfaces:**
    * Core Hooks: Blueprint-scoped `@publish_bp.on('vfs_resolve_file')` resolving compiled outputs for VFS `/download/` routes.
    * Middleware: Dispatches `pre_compile_document` to collect citation bibliographies and editor macro patterns (`strip_macros`), stripping standalone and inline wordcount tags before Pandoc invocation.
    * Polymorphic Cards: Registers `publish-doc` entity action on `.md` files.
    * UI Modals: `<insetu-ext-publish-modals>` featuring Substack rich-text paste (`copyRichHtml`) and raw HTML tags copy.
### F. Workflows [DECOMMISSIONED - ADR 0087]
* **Status:** Decommissioned / Consolidated into Tier 2 Core Substrate (`agent`).
* **Role:** Formerly managed LLM execution pipelines and context batching. Fully superseded by sovereign Markdown-as-Code Agent Routines (`ctx://routines/`, `orchestrator.py`) and topological DAG wavefronts.
* **Dependencies (`__depends__`):** N/A (decommissioned).
* **Data Containment:** N/A (decommissioned).
### G. Favorites (`engine_favorites.py`)
* **Status:** Active Extension (SDK V2 with Flask Transport Decoupling, Canonical URIs & InSetuURI Adoption).
* **Role:** Pinning files and folders for quick access, maintaining a localized SQLite cache mirrored to `bookmarks.json`.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `{ARTIFACTS_BASE}/favorites.db` (`favorites` table) synchronized with `bookmarks.json`.
* **Injection Surfaces:**
    * Core Hooks: State hydration and URI healing via `ctx.db.heal_uri_column("favorites", "path", "vfs://")`.
    * Polymorphic Cards: Registers `fave_toggle_file`, `fave_toggle_repo`, and `fave_toggle_folder` with folder trailing slash preservation and folder entity data contract parity.
    * UI Layout: Sub-navigation Tab (`edit` -> `favorites`).
### H. Skills Tracker (`engine_skills.py`)
* **Status:** Active Extension (SDK V2 with Declarative Volumes, Sutram Presentation Purity & Transport Decoupling).
* **Role:** Spaced-repetition practice tracking and metric analysis using the SM-2 algorithm.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `{ARTIFACTS_BASE}/skills.db` (`skills_ledger` table) backed by sovereign Markdown practice files under declarative volume `ctx://skills/` (`.insetu/data/skills/`).
* **Injection Surfaces:**
    * Core Hooks: Blueprint-scoped `@skills_bp.on('topology_boot_complete')` for ledger hydration and URI normalization (`ctx.db.heal_uri_column`).
    * Spatial Projections: Projects interactive practice runs into `InSetuSkillsSessionProjection` (`skills:session`).
    * Entity Creation: Standardized on `ctx.create_entity_file()` for practice card generation.
### I. Terminal Interface (`engine_term.py`)
* **Status:** Active Extension (Fully Graduated to SDK V2).
* **Role:** Manages native full-duplex PTY WebSocket sessions directly inside the event loop using flask-sock and Xterm.js. Features virtual keyboard action controls, touch gesture navigation (swipes, long-press, double-tap), context menu actions (`tc-copy`, `tc-paste`, `tc-sigint`), and explicit `status` endpoint checks.
* **Dependencies (`__depends__`):** `None` (`external_dependencies`: `["flask-sock"]`)
* **Data Containment:** Ephemeral stream contexts.
* **Injection Surfaces:**
    * UI Hooks: Primary Navigation Tab injection.
### J. Freshdesk Support (`engine_freshdesk.py`)
* **Status:** Active Extension (SDK V2 with Transport Decoupling, Typed Workers & Declarative Dependencies).
* **Role:** Support ticket synchronization, reply management, and agent triaging.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `~/.insetu/data/freshdesk.db`
* **Injection Surfaces:**
    * Polymorphic Cards: Registers actions for taking, resolving, and ignoring tickets.
    * UI Hooks: Primary Edit Sub-navigation Tab injection.
### K. Automation Hooks (`engine_hooks.py`)
* **Status:** Active Extension (SDK V2 with Host Cryptographic Gating, Flask Transport Decoupling, Typed Workers & Sub-Navigation Menu Consolidation).
* **Role:** IFTTT-style local command automation triggered by VFS events.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `{ARTIFACTS_BASE}/hooks.db` (`hooks_rules` table), `workers.db` execution logs, and cryptographic command approval signatures in `.insetu/workspaces.json`.
* **Injection Surfaces:**
    * Core Hooks: Blueprint-scoped `@hooks_bp.on('topology_resolved', priority=100)` with `get_system_index_path()` centralization.
    * UI Hooks: Sub-navigation Tab injection (`ctrl` -> `hooks`).
    * Polymorphic Cards: Registers actions (`hook-toggle`, `hook-execute`, `hook-edit`, `hook-delete`) for `hook_rule` entities.
### L. Developer Dashboard (`engine_dev.py`)
* **Status:** Active Extension (SDK V2).
* **Role:** Telemetry tracking for file thrashing, Yomama Sync Bridge errors, and invocation boot log exports.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `{ARTIFACTS_BASE}/dev.db` (`file_telemetry`, `bridge_errors`, and `system_errors` tables).
* **Injection Surfaces:**
    * Core Hooks: Blueprint-scoped `@dev_bp.on('vfs_mutated')`, `@dev_bp.on('bridge_error')`, and `@dev_bp.on('system_error')`.
    * UI Hooks: Primary Navigation Tab injection (`dev` -> `dash`, `logs`, `sql`, `memory`).
### M. Notes Library (`engine_notes.py` & `ext_notes.js`)
* **Status:** Active Extension (SDK V2 with Declarative Volumes, Pathlib Compliance & Transport Decoupling).
* **Role:** Workspace-level and repository-scoped markdown notes management with frontmatter indexing (`ctx://contexts/notes_context.txt`).
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `{ARTIFACTS_BASE}/notes.db` (`notes_ledger` table) backed by declarative `ctx://notes/` volume (`NotesVFSDriver`) and repository-scoped `vfs://{repo}/.insetu-data/notes/` markdown assets.
* **Injection Surfaces:**
    * Core Hooks: Blueprint-scoped `@notes_bp.on('mutate_workspace_config')`, `@notes_bp.on('topology_boot_complete')`, `@notes_bp.on('vfs_mutated')`, and `@notes_bp.on('gather_declare_topology')`.
    * UI Layout: Sub-navigation Tab (`edit` -> `notes`) with declarative `menuActions` (`New Note`, `Pre-Cache Notes`).
    * Spatial Projections: Multi-projection note editing in `InSetuExtNotesEditor` pinned to spatial viewports with in-place frontmatter synchronization (`syncFrontmatter`).
    * Custom Editors: Declarative matcher for `ctx://notes/` and `.insetu-data/notes/` paths.
### N. Tailscale Network Manager [DECOMMISSIONED - ADR 0086]
* **Status:** Decommissioned / Consolidated into Tier 2 Core Substrate (`engine_remote.py`).
* **Role:** Formerly managed Tailscale Serve HTTPS port bindings. Capabilities absorbed into `engine_remote.py` (`set_tailscale_https_serve`, `classify_peer`).
* **Dependencies (`__depends__`):** N/A
* **Data Containment:** N/A (decommissioned).
### O. Semantic Update (`engine_update.py` & `ext_update.js`)
* **Status:** Active Extension (SDK V2 with Spatial Projections and DAG Chaining).
* **Role:** Automated semantic versioning, dry-run release previews, initial PyPI release building/uploading, PyPI publishing verification, baseline tagging, and package distribution.
* **Dependencies (`__depends__`):** `['git']`
* **Data Containment:** Ephemeral / Workspace settings.
* **Injection Surfaces:**
    * Spatial Projections: Decoupled dry-run release previews, changelog inspections, and execution logs into `sutram-report-projection` (`update:preview`).
    * Background DAG Chains: Submits post-bump compilation chains via `resolve_dag_chain(ctx, 'register_compilation_steps')` to automatically compile release artifacts and code indices.
    * Event Bus: Emits `insetu:git:generate-diffs` on version scaffold/tag creation.
### P. Offline Engine & HTTP Gateway (`offline_ui.js` & `api.js`)
* **Status:** Core Engine / Active Extension (SDK V2).
* **Role:** IndexedDB outbox mutation queueing, Stale-While-Revalidate blob caching, offline telemetry logging, and per-repository pre-caching.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** Browser IndexedDB (`SutramDB`).
* **Injection Surfaces:**
    * Network Interceptor: Wraps `window.inSetu.api` via `OfflineHttpProvider`.
    * UI Slots: Primary Navigation Tab (`offline`) housing `ledger` and `log` sub-tabs, and global storage modal.
### Q. Cronic Job Manager (`engine_cronic.py` & `ext_cronic.js`)
* **Status:** Active Extension (SDK V2 with Flask Transport Decoupling, Typed Workers, Binary Whitelisting & Canonical Route Normalization).
* **Role:** Schedules Python/bash scripts as system cron tasks, manages log rotation, and handles crontab drift healing.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `{ARTIFACTS_BASE}/cronic.db` (`cronic_jobs` table) and `.insetu/data/cronic_*.log` execution logs.
* **Injection Surfaces:**
    * Core Hooks: Blueprint-scoped `@cronic_bp.on('topology_boot_complete')` for crontab drift healing, daily log sweeping, and `ctx.db.heal_uri_column`.
    * UI Slots: Primary Navigation Tab (`cronic` -> `main`) with `InSetuURI` basename resolution.
    * Polymorphic Cards: Registers `cronic-schedule-file` entity action for `.py` and `.sh` files.
### R. Managed App Server & Web Preview (`engine_preview.py` & `ext_preview.js`)
* **Status:** Active Extension (SDK V2 with Repo-Scoped Settings, Pop-Out Parity, S2 Network Exposure Leases, and P5 Custom Command Approvals).
* **Role:** Multi-profile development server supervisor (`static`, `uvicorn`, `flask`, `django`, `streamlit`, `gradio`, `marimo`, `vite`, `storybook`, `mkdocs`, `hugo`, `custom`), sticky port allocator (`5100–5199`), loopback-by-default binding (`127.0.0.1`) with timed LAN leases (`0.0.0.0`), human-only custom command approval (`PreviewApprovalRequired`), marimo token authentication, static server symlink/dotfile confinement, Tailscale HTTPS serve binder, and live `<iframe>` web application previewer.
* **Dependencies (`__depends__`):** `None` (`external_dependencies`: `["uvicorn"]`)
* **Data Containment:** Ephemeral process registry and in-memory log ring buffers (`collections.deque`) with per-repository configurations vaulted in `.insetu/repo.settings.json` and command approval signatures in `.insetu/host.json`.
* **Injection Surfaces:**
    * Core Hooks: `@hooks.on('topology_boot_complete')` for opt-in `auto_start` server spawning, and `@hooks.on('workspace_shutdown')` / `@hooks.on('system_shutdown')` for process group (`os.killpg`) teardown.
    * UI Slots: Sub-navigation Tab (`ctrl` -> `preview`) with `allow_popout: true`.
    * Polymorphic Cards: Registers `preview-html-file` entity action on `.html` files and folders.

---

## 3. Pending Decoupling (The V2 Extractions)
These are domain-specific features currently hardcoded into the Micro-Kernel that are scheduled for extraction in Phase 2 of the migration sequence.
### E. Release Management (`engine_release.py`)
* **Status:** Planned Extension.
* **Role:** Context-aware repository management (e.g., executing `bump-my-version` strictly within a targeted directory).
* **Dependencies (`__depends__`):** `['git']` (Cannot perform a version bump without a clean Git tree and automated commit logic).
* **Data Containment:** Ephemeral.
* **Injection Surfaces:**
    * UI Hooks: `zone:file-card-actions`, relying on the `ExecutionContext` payload (`{ activeRepo, filepath }`) to resolve strict OS execution paths.

---
## 4. The Topographical Dependency Graph

| Extension ID | Relies On (Upstream) | Extended By (Downstream) |
| :--- | :--- | :--- |
| `citations` | `<Micro-Kernel>` | None (Currently) |
| `ingest` | `<Micro-Kernel>` | `research` |
| `research` | `ingest` | None (Currently) |
| `tracker` | `<Micro-Kernel>` | None (Currently) |
| `git` | `gather` | `release` |
| `release` | `git` | None |
| `favorites` | `<Micro-Kernel>` | None (Currently) |
| `skills` | `<Micro-Kernel>` | None (Currently) |
| `term` | `<Micro-Kernel>` | None (Currently) |
| `freshdesk` | `<Micro-Kernel>` | None (Currently) |
| `hooks` | `gather` | None (Currently) |
| `dev` | `<Micro-Kernel>` | None (Currently) |
| `preview` | `<Micro-Kernel>` | None (Currently) |
> **Architectural Note: Hard vs. Soft Horizontal Relationships**
> The table above represents **Hard Dependencies** (where an extension will fail to boot if its upstream requirement is missing). 
> For **Soft Dependencies** (opportunistic cross-talk, such as the `git` extension asking the `tracker` extension for recent tickets to populate a UI), extensions MUST use the Event Bus. This ensures that if the target extension is disabled by the user, the requesting extension gracefully degrades rather than crashing.
### Explicit Soft Dependencies (Event-Driven)
| Dependent Domain (Injector) | Target Domain (Provider) | Mechanism | Purpose |
| :--- | :--- | :--- | :--- |
| `git` | `tracker` | `request_changelog_suggestions` | Auto-populating commit logs with recently closed tasks. |
| `citations` | `<Micro-Kernel>` | `pre_compile_document` | Citations intercepting the OS formatting pipeline to inject bibliography temp files and citeproc CLI flags. |
| `tracker` | `<Micro-Kernel>` | `mutate_workspace_config` | Tracker intercepting the OS Gatherer to dynamically pull `.tracker/` backlogs into the LLM context tree. |
| `research` | `citations` | UI Tab / URL Import | Opportunistically routing fetched web articles directly into the reference library. |

---

## Appendix A: System Hooks Registry

To enforce **ADR 0002 (Domain Decoupling)**, extensions must never query each other's databases or UI states directly. All horizontal communication must pass through the following registered hooks.

### 1. Backend Event Bus (`hooks.py`)
| Hook Name | Emitter | Responder(s) | Payload Purpose |
| :--- | :--- | :--- | :--- |
| `mutate_workspace_config` | `<Micro-Kernel>` | `tracker` | Allows extensions to dynamically inject virtual directories and sub-buckets into the RAG context tree during boot. |
| `request_changelog_suggestions` | `git` | `tracker` | Requests a list of recently closed tasks to populate the Git commit/release suggestion UI. |
| `pre_compile_document` | `<Micro-Kernel>` | `citations` | A generic middleware pipeline hook allowing extensions to inject temp files and CLI flags right before OS compilation. |
| `vfs_resolve_path` | `<Micro-Kernel>` | `utils_core` | Intercepts VFS path resolution to resolve logical repo boundaries (`repo::path`) and `ctx://` URIs before physical I/O operations. |
| `vfs_resolve_file` | `<Micro-Kernel>` | `engine_gather` | Intercepts physical and virtual URI (`ctx://`) file resolution before I/O execution. |
| `vfs_search` | `<Micro-Kernel>` | `engine_gather` | Dispatches workspace deep text search queries to active index handlers. |
| `topology_resolved` | `engine_topology` | `engine_gather` | Emitted after physical disk mutations settle to trigger Stage 2 RAG context compilation. |
| `force_topology_scan` | `<Micro-Kernel>` | `engine_topology` | Forces physical disk walks to rebuild the `topology_ledger` SSOT. |
| `request_vfs_manifest` | `<Micro-Kernel>` | `engine_topology` | Returns the `"vfs"` domain portion of the partitioned manifest. |
| `gather_declare_topology` | `engine_gather` | All Extensions | Emitted during context sweeps to collect declarative topology schemas (`generator_callback`, `recall_callback`). |
| `heal_missing_domain_volume` | `engine_gather` | Domain Extensions | Emitted during JIT artifact resolution when non-contexts cache volumes (e.g. workflows) are missing on disk. |
| `register_compilation_steps` | `engine_gather` | All Extensions | Emitted to build topologically sorted background compilation pipelines. |
| `compilation_sequence_complete` | `engine_gather` | `cartographer` | Emitted when all background compilation steps in a chain have finished. |
| `register_manifest_signatures` | `<Micro-Kernel>` | All Extensions | Yields domain-specific manifest signatures (hashes/timestamps) for decentralized delta sync. |
| `topology_boot_complete` | `engine_topology` | `engine_gather` | Emitted when physical topology disk mapping completes on workspace boot. |
### 2. Frontend UI Zones (`ExtensionRegistry`)
| Zone ID | Context / Trigger | Primary Use Case |
| :--- | :--- | :--- |
| `zone:tab-changed` | Emitted when the user navigates primary UI tabs. | Allows background extensions (like Tracker or Citations) to execute silent data-fetches only when their UI is actually visible. |
| `zone:file-edit-override` | Emitted right before a file is loaded into the VFS modal. | Allows extensions to hijack the rendering flow (e.g., Tracker redirecting `.tracker/` markdown files into its custom Kanban UI modal instead). |
| `zone:post-file-save` | Emitted after the VFS successfully flushes to disk. | Triggers reactive background refreshes for dependent extensions (e.g., reloading the Kanban board if a ticket is saved). |
| `zone:vfs-mutated` | Emitted when VFS disk operations settle. | Triggers reactive cache updates across active extensions. |
| `zone:new-file-options-lit` | Emitted inside the New File modal. | Allows extensions to inject custom toggles (e.g., "Import from URL") into the creation UI. |
| `zone:post-import-url` | Emitted after the Web Scraper successfully downloads markdown. | Allows extensions to react to ingested content (e.g., auto-checking the "Add to Library" toggle based on URL signatures). |

### 3.3 Frontend Event Bus (\`window.inSetu.events\`)
With the deprecation of UI zones (ADR 0041), horizontal communication across the frontend chassis relies entirely on the \`CustomEvent\` substrate. Extensions should namespace events as \`insetu:<ext_name>:<action>\` to prevent collisions.

| Event Name | Emitter / Trigger | Target Listener | Payload (\`detail\`) |
| :--- | :--- | :--- | :--- |
| \`insetu:vfs-mutated\` | \`routes_fs.py\`, \`app.js\`, \`fs.js\`, \`bridge.js\` | \`git\`, \`tracker\`, \`flow\`, \`notes\` | \`{ mutations: [{ filepath, operation, ignore_ledger }] }\` |
| \`sutram-sync-complete\` | \`app.js\` (Offline Reconciler) | \`fs.js\`, \`ext_tracker.js\`, \`ext_git.js\`, \`ext_flow.js\` | None |
| \`sutram-route-changed\` | \`app.js\` (\`AppStore.subscribe\`) | \`<sutram-app-shell>\`, Extensions | \`{ tab, subTabs }\` |
| \`insetu:force-refresh\` | \`<sutram-app-shell>\` (Tab re-click) | \`InSetuElement.onForceRefresh\` | \`{ parentId, subId }\` |
| \`insetu:git:generate-diffs\` | \`ext_git.js\` (Push/Sweep actions) | \`ext_git.js\` (\`generateDiffs()\`) | \`{ force: boolean }\` |
| \`git-diffs-refreshed\` | \`ext_git.js\` (\`generateDiffs()\`) | \`ext_git.js\` (\`_fetchSweepStatusSilent\`) | None |
| \`insetu:tracker:open-edit-task\` | \`tracker\` (Custom Editors) | \`InSetuExtTrackerModals\` | \`{ filepath }\` |
