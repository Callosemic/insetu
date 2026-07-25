# 03: inSetu Extension Inventory & Topology

**Identity**: The Architect.
**Mission**: To maintain a living, deterministic inventory of the inSetu Directed Acyclic Graph (DAG), mapping the core Micro-Kernel boundaries against all active, planned, and decoupled extensions.

---

## 1. The Mother Ship (Core Micro-Kernel)
The core OS is strictly domain-agnostic. It does not know what a "citation" or a "kanban board" is. Its sole responsibility is orchestration, routing, and physical I/O operations.

* **`engine_gather.py` (The RAG Compiler):** Blindly compiles virtual contexts and physical directories based on the configuration matrix.
* **`app.py` / `engine_bridge.py` (The Sync Bridge):** The Yomama translation layer and physical atomic commit engine.
* **`utils_core.py` (The Cartographer):** The Single Source of Truth for resolving spatial physics, file indexing, and system paths.
* **`insetu/hooks.py` (The Event Bus):** The API substrate allowing extensions to intercept RAG compilation, VFS commits, and OS process lifecycle events.
* **`insetu.workers` (The Stateless Relay):** The centralized background task manager that sweeps switchboards and manages active SQLite worker threads across workspace swaps. It incorporates an integrated native filesystem watcher (`watchdog`) to automatically record unmanaged non-Git directory mutations into an SQLite fixture ledger for differential context compilation.

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
    * Configuration: Declares dynamic repo-level pull strategy selectors (`rebase`, `merge`, `ff_only`).
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

### E. Document Formatting (`engine_format.py`)
* **Status:** Active Extension.
* **Role:** Document compilation (Pandoc) to PDF, Word, HTML, and JS beautification.
* **Dependencies (`__depends__`):** `None`
* **Injection Surfaces:**
    * UI Hooks: Injects `zone:modal-file-toolbar` actions.
    * Broadcasts `pre_compile_document` to intercept bibliography mappings.
### F. Prompts & Workflows (`engine_prompts.py` & `engine_flow.py`)
* **Status:** Active Extensions (`prompts` upgraded to SDK V2).
* **Role:** Manage prompt resolution, LLM execution pipelines, and automated context batching.

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
* **Status:** Active Extension (SDK V2)[cite: 1].
* **Role:** Support ticket synchronization, reply management, and agent triaging[cite: 1].
* **Dependencies (`__depends__`):** `None`[cite: 1]
* **Data Containment:** `~/.insetu/data/freshdesk.db`[cite: 1]
* **Injection Surfaces:**
    * Polymorphic Cards: Registers actions for taking, resolving, and ignoring tickets[cite: 1].
    * UI Hooks: Primary Edit Sub-navigation Tab injection[cite: 1].

### K. Automation Hooks (`engine_hooks.py`)
* **Status:** Active Extension (SDK V2)[cite: 2].
* **Role:** IFTTT-style local command automation triggered by VFS events[cite: 2].
* **Dependencies (`__depends__`):** `None`[cite: 2]
* **Data Containment:** `{ARTIFACTS_BASE}/hooks.db` (`hooks_rules` table) and `workers.db` execution logs[cite: 2].
* **Injection Surfaces:**
    * VFS Hooks: `@hooks.on('vfs_mutated')`[cite: 2].
    * UI Hooks: Sub-navigation Tab injection (`ctrl` -> `hooks`)[cite: 2].
    * Polymorphic Cards: Registers actions (`hook-toggle`, `hook-execute`, `hook-edit`, `hook-delete`) for `hook_rule` entities[cite: 2].

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
| `git` | `<Micro-Kernel>` | `release` |
| `release` | `git` | None |
| `favorites` | `<Micro-Kernel>` | None (Currently) |
| `skills` | `<Micro-Kernel>` | None (Currently) |
| `term` | `<Micro-Kernel>` | None (Currently) |
| `freshdesk` | `<Micro-Kernel>` | None (Currently) |
| `hooks` | `<Micro-Kernel>` | None (Currently) |
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

### 2. Frontend UI Zones (`ExtensionRegistry`)
| Zone ID | Context / Trigger | Primary Use Case |
| :--- | :--- | :--- |
| `zone:tab-changed` | Emitted when the user navigates primary UI tabs. | Allows background extensions (like Tracker or Citations) to execute silent data-fetches only when their UI is actually visible. |
| `zone:modal-ext-menu` | Emitted when the VFS modal opens a file. | Allows extensions to declaratively push action objects (`{label, icon, onClick}`) into the global extension dropdown menu, eliminating horizontal toolbar clutter. |
| `zone:file-edit-override` | Emitted right before a file is loaded into the VFS modal. | Allows extensions to hijack the rendering flow (e.g., Tracker redirecting `.tracker/` markdown files into its custom Kanban UI modal instead). |
| `zone:post-file-save` | Emitted after the VFS successfully flushes to disk. | Triggers reactive background refreshes for dependent extensions (e.g., reloading the Kanban board if a ticket is saved). |
| `zone:file-card-actions` | Emitted when a file card is rendered in the UI. | Allows extensions to inject contextual action buttons next to the default "View" and "DL" buttons. |
| `zone:new-file-options` | Emitted inside the New File modal. | Allows extensions to inject custom toggles (e.g., "Add to Library") into the creation UI. |
| `zone:pre-save-new-file` | Emitted right before a new file is written to disk. | Allows extensions to intercept the payload and inject metadata, frontmatter, or headers into the document. |
| `zone:post-import-url` | Emitted after the Web Scraper successfully downloads markdown. | Allows extensions to react to ingested content (e.g., auto-checking the "Add to Library" toggle based on URL signatures). |
