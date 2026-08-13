# 03: inSetu Extension Inventory & Topology

**Identity**: The Architect.
**Mission**: To maintain a living, deterministic inventory of the inSetu Directed Acyclic Graph (DAG), mapping the core Micro-Kernel boundaries against all active, planned, and decoupled extensions.

---

## 1. The Mother Ship (Core Micro-Kernel)
The core OS is strictly domain-agnostic. It does not know what a "citation" or a "kanban board" is. Its sole responsibility is orchestration, routing, and physical I/O operations.
* **`insetu/static/vendor/sutram/` (Sutram Presentation Kernel):** Tier 0 micro-kernel managing UI app shell layout (`sutram-app-shell`), Zustand store factories (`createSutramStore`), background job polling (`createJobPoller`), hierarchical shortcut routing (`initShortcutRouter`), and shared styles.
* **`insetu/core/topology/engine_topology.py` (The Topology Engine):** Single Source of Truth for physical file existence (`topology_ledger`) and bucket routing, hosting Stage 1 Slew Limiting (`topology_event_buffer`).
* **`insetu/core/gather/engine_gather.py` (The RAG Compiler):** Blindly compiles virtual contexts and physical directories based on the configuration matrix, hosting background compilation workers and submission endpoints.
* **`insetu/core/editor/engine_editor.py` (The Editor Engine):** Core extension managing global code and text editor preferences (`EDITOR_SCHEMA`).
* **`app.py` / `insetu/core/bridge/engine_bridge.py` (The Sync Bridge):** The Yomama translation layer and physical atomic commit engine. Features Phase C JSON Telemetry rendering, interactive confirmation cards, and the Receipts history tab (`insetu-ext-bridge-history`) backing the Ephemeral Patch Ledger (`bridge_ledger`).
* **`insetu/core/cartographer/cartographer.py` (The Cartographer):** Generates code indices and maps workspace topology.
* **`insetu/kernel/hooks.py` (The Event Bus):** The API substrate allowing extensions to intercept RAG compilation, VFS commits, and OS process lifecycle events.
* **`insetu.kernel.workers` (The Stateless Relay):** The centralized background task manager that sweeps switchboards and manages active SQLite worker threads across workspace swaps. It incorporates an integrated native filesystem watcher (`watchdog`) to automatically record unmanaged non-Git directory mutations into an SQLite fixture ledger for differential context compilation.

---
## 2. Active Extensions (V1 Finalized)
These are fully built and compliant extensions currently operating within the system. Note that all domain extensions now reside physically in the `insetu/extensions/` and `insetu/static/js/extensions/` directories to preserve the micro-kernel boundary.
### A. Git Operations (`engine_git.py`)
* **Status:** Active Extension (Decoupled from Core Kernel, Upgraded with Dynamic Settings).
* **Role:** Version control, diff generation, repository reconciliation strategies, and workspace sweeping.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** Ephemeral (direct `.git/` inspection) with configuration states bound to tenant settings databases.
* **Injection Surfaces:**
    * Polymorphic Cards: Registers `git-push` and `git-resolve-conflicts` actions inside the centralized Entity-Action Registry.
    * Core Hooks: `@hooks.on('compile_contexts')` to trigger JIT background diff asset compilation.
    * Configuration: Declares dynamic repo-level pull strategy selectors (`rebase`, `merge`, `ff_only`), as well as declarative `repoConfigOptions` (`git-repo-exclude`) and `bucketConfigOptions` (`git-exclude`).
### B. Citations (`engine_citations.py`)
* **Status:** Active Extension (Upgraded to SDK V2).
* **Role:** Manages the academic reference library, bibliography parsing, and citation generation.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `~/.insetu/data/citations.db`
* **Injection Surfaces:**
    * UI Hooks: `zone:modal-edit-toolbar` (Injects "📚 Cite" button).
    * Config Hooks: `@hooks.on('mutate_workspace_config')` to inject `.bib` payload streams.
### C. Research (`engine_research.py`)
* **Status:** Active Extension (Upgraded to SDK V2).
* **Role:** Web scraping, payload extraction, and localized inbox triage.
* **Dependencies (`__depends__`):** `['ingest']`
* **Data Containment:** `~/.insetu/data/research.db` (Isolated Inbox).
* **Injection Surfaces:**
    * Worker Matrix: Submits long-running URL scraping routines to the `TaskQueue`.
    * UI Hooks: Primary Navigation Tab injection (The Triage UI).
### D. Kanban Tracker (`engine_tracker.py`)
* **Status:** Active Extension (Upgraded to SDK V2).
* **Role:** Project management, issue routing, and sprint tracking.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `~/.insetu/data/tracker.db` (CQRS Cache) backed by asynchronous `.tracker/` Markdown file commits via the VFS.
* **Injection Surfaces:**
    * Config Hooks: Uses `@hooks.on('mutate_workspace_config')` to natively inject `.tracker/` virtual sub-buckets into the RAG Gatherer.
    * VFS Hooks: Uses `vfs_mutated` to instantly sync the UI SQLite index.
### E. Code Formatting (`engine_format.py`)
* **Status:** Active Extension.
* **Role:** Source code beautification and formatting (JS, JSON, CSS, HTML, Python).
* **Dependencies (`__depends__`):** `None`
* **Injection Surfaces:**
    * Polymorphic Cards: Registers `format-code` action.

### P. Document Publishing (`engine_publish.py`)
* **Status:** Active Extension (Extracted from Format).
* **Role:** Document compilation (Pandoc) to PDF, Word, HTML.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** Ephemeral.
* **Injection Surfaces:**
    * Broadcasts `pre_compile_document` to intercept bibliography mappings.
### F. Prompts & Workflows (`engine_prompts.py` & `engine_flow.py`)
* **Status:** Active Extensions (`prompts` upgraded to SDK V2).
* **Role:** Manage prompt resolution, LLM execution pipelines, and automated context batching.
* **Dependencies (`__depends__`):** `['prompts', 'gather']`
* **Injection Surfaces:**
    * Core Hooks: `@hooks.on('vfs_mutated')`, `@hooks.on('compile_contexts')`, and `@hooks.on('git_evaluation_complete')` triggering coalesced background batch recompilation.

### G. Favorites (`engine_favorites.py`)
* **Status:** Active Extension (Upgraded to SDK V2).
* **Role:** Pinning files and folders for quick access, maintaining a localized SQLite cache.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `~/.insetu/data/favorites.db`

### H. Skills Tracker (`engine_skills.py`)
* **Status:** Active Extension.
* **Role:** Spaced repetition and track logging using the SM-2 algorithm.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** Global SQLite ledger (`~/.insetu/skills.db`) and localized markdown files.
### I. Terminal Interface (`engine_term.py`)
* **Status:** Active Extension (Fully Graduated to SDK V2).
* **Role:** Manages native full-duplex PTY WebSocket sessions directly inside the event loop using flask-sock and Xterm.js.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** Ephemeral stream contexts.
* **Injection Surfaces:**
    * UI Hooks: Primary Navigation Tab injection.
### J. Freshdesk Support (`engine_freshdesk.py`)
* **Status:** Active Extension (SDK V2).
* **Role:** Support ticket synchronization, reply management, and agent triaging.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `~/.insetu/data/freshdesk.db`
* **Injection Surfaces:**
    * Polymorphic Cards: Registers actions for taking, resolving, and ignoring tickets.
    * UI Hooks: Primary Edit Sub-navigation Tab injection.
### K. Automation Hooks (`engine_hooks.py`)
* **Status:** Active Extension (SDK V2).
* **Role:** IFTTT-style local command automation triggered by VFS events.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `{ARTIFACTS_BASE}/hooks.db` (`hooks_rules` table) and `workers.db` execution logs.
* **Injection Surfaces:**
    * VFS Hooks: `@hooks.on('vfs_mutated')`.
    * UI Hooks: Sub-navigation Tab injection (`ctrl` -> `hooks`).
    * Polymorphic Cards: Registers actions (`hook-toggle`, `hook-execute`, `hook-edit`, `hook-delete`) for `hook_rule` entities.
### L. Developer Dashboard (`engine_dev.py`)
* **Status:** Active Extension (SDK V2).
* **Role:** Telemetry tracking for file thrashing and Yomama Sync Bridge errors.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `{ARTIFACTS_BASE}/dev.db` (`file_telemetry` and `bridge_errors` tables).
* **Injection Surfaces:**
    * Core Hooks: `@hooks.on('vfs_mutated')` and `@hooks.on('bridge_error')`.
    * UI Hooks: Primary Navigation Tab injection (`dev` -> `dash`).
### M. Notes Library (`engine_notes.py` & `ext_notes.js`)
* **Status:** Active Extension (SDK V2).
* **Role:** Workspace-level markdown notes management with frontmatter indexing.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `{ARTIFACTS_BASE}/notes.db` (`notes_ledger` table) backed by `.insetu/notes/` markdown assets.
* **Injection Surfaces:**
    * Core Hooks: `@hooks.on('vfs_mutated')` and `@hooks.on('compile_contexts')`.
    * UI Hooks: Sub-navigation Tab injection (`edit` -> `notes`), `zone:file-edit-override` for `.insetu/notes/` pathing.
### N. Tailscale Network Manager (`engine_tailscale.py` & `ext_tailscale.js`)
* **Status:** Active Extension (SDK V2 / Declarative).
* **Role:** Automated HTTPS port binding over Tailscale Serve on workspace boot.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** Ephemeral.
* **Injection Surfaces:**
    * Core Hooks: `@hooks.on('workspace_boot')` triggering non-blocking background worker tasks.
    * Settings Schema: Declarative port mode selector and manual bind action trigger.
### O. Semantic Update (`engine_update.py` & `ext_update.js`)
* **Status:** Active Extension (SDK V2).
* **Role:** Automated semantic versioning, dry-run release previews, initial PyPI release building/uploading, PyPI publishing verification, baseline tagging, and package distribution.
* **Dependencies (`__depends__`):** `['git']`
* **Data Containment:** Ephemeral / Workspace settings.
* **Injection Surfaces:**
    * UI Hooks: Sub-navigation Tab injection (`ctrl` -> `update`), `zone:vfs-mutated` for debounced repo status refresh.
    * Event Bus: Emits `insetu:git:generate-diffs` on version scaffold/tag creation.

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
| `flow` | `prompts`, `gather` | None (Currently) |
| `tailscale` | `<Micro-Kernel>` | None (Currently) |
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
