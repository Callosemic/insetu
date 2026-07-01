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
* **`insetu.workers` (The Stateless Relay):** The centralized background task manager that sweeps switchboards and manages active SQLite worker threads across workspace swaps.

---
## 2. Active Extensions (V1 Finalized)
These are fully built and compliant extensions currently operating within the system.

### A. Git Operations (`engine_git.py`)
* **Status:** Active Extension (Fully Decoupled from Core Kernel space via lifecycle subscribers).
* **Role:** Version control, diff generation, and repository synchronization.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** Ephemeral (reads direct `.git/` history).
* **Injection Surfaces:**
    * UI Hooks: `zone:file-card-actions` to display diff statuses.
    * Core Hooks: `@hooks.on('pre_compile')` to handle JIT background diff cache assembly.

### B. Citations (`engine_citations.py`)
* **Status:** Active in configuration.
* **Role:** Manages the academic reference library, bibliography parsing, and citation generation.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `~/.insetu/data/citations.db`
* **Injection Surfaces:**
    * UI Hooks: `zone:modal-edit-toolbar` (Injects "📚 Cite" button).
    * Config Hooks: `@hooks.on('mutate_workspace_config')` to inject `.bib` payload streams.

### B. Research (`engine_research.py`)
* **Status:** Active. 
* **Role:** Web scraping, payload extraction, and localized inbox triage.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** `~/.insetu/data/research.db` (Isolated Inbox).
* **Injection Surfaces:**
    * Worker Matrix: Submits long-running URL scraping routines to the `TaskQueue`.
    * UI Hooks: Primary Navigation Tab injection (The Triage UI).

---

## 3. Pending Decoupling (The V2 Extractions)
These are domain-specific features currently hardcoded into the Micro-Kernel that are scheduled for extraction in Phase 2 of the migration sequence.

### C. Kanban Tracker (`engine_tracker.py`)
* **Status:** Hardcoded (Currently tracked as a managed directory `managed_dirs`). Pending Step 2 Extraction.
* **Role:** Project management, issue routing, and sprint tracking.
* **Dependencies (`__depends__`):** `None`
* **Data Containment:** Currently blocking regex/Markdown files. Planned transition to `~/.insetu/data/tracker.db` during Step 4.
* **Injection Surfaces:**
    * Config Hooks: Must use `@hooks.on('mutate_workspace_config')` to inject `.tracker/` virtual sub-buckets into the RAG Gatherer.
### D. Release Management (`engine_release.py`)
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
| `research` | `<Micro-Kernel>` | None (Currently) |
| `tracker` | `<Micro-Kernel>` | None (Currently) |
| `git` | `<Micro-Kernel>` | `release` |
| `release` | `git` | None |
