# 02: inSetu Extension Architecture & API Contract

**Identity**: The Architect.
**Mission**: To define the topological physics and exact integration surfaces required for building, mounting, and maintaining inSetu Extensions. The core Micro-Kernel must remain entirely decoupled from domain-specific logic, acting solely as an orchestration router.
---

## 1. The Bootloader Contract (Activation & Topology)
Extensions are strictly opt-in. The OS kernel is blind to an extension unless it is explicitly declared in the active profile's configuration.
* **Activation:** An extension must be listed by its exact string identifier in `.insetu/profiles/*/config.json` under the `"extensions": []` array (e.g., `"extensions": ["research", "tracker"]`).
* **Zero-Ghosting:** If an extension is removed from the array, its Python routes must unmount, and its JavaScript payload must not be requested by the browser.

### Topological Sorting & Dependency Injection (The DAG)
Extensions must be capable of relying on one another (e.g., a `zotero_sync` extension extending the `citations` extension).
* **The Python Metadata:** Every `engine_{ext}.py` module must expose a module-level list named `__depends__ = ['citations', ...]` mapping its upstream requirements.
* **The Bootloader (app.py):** The `load_workspace_extensions()` routine must perform a topological sort (Directed Acyclic Graph) of the requested extensions in `config.json`. 
    * If an extension requires a dependency that is missing or fails to import, the child extension is gracefully aborted and logged as an `ImportError`.
* **The JS Bootloader (app.js):** The frontend mirrors the backend DAG. ES6 imports guarantee that parent modules load and register their API surfaces before child extensions attempt to attach to them.
## 2. The Backend Injection Surface (Python Event Bus)
Extensions cannot hardcode themselves into `engine_gather.py` or the `bridge_sync` transaction loop. They must subscribe to OS lifecycle events.
* **The `HookRegistry`:** The core OS will expose an `insetu.hooks` namespace where extensions register callbacks. Hooks can be triggered synchronously via `hooks.emit` or asynchronously via `hooks.emit_background`.
* `@hooks.on('mutate_workspace_config')`: Allows an extension to intercept the configuration load phase and dynamically inject virtual `sub_buckets`, append to `managed_dirs`, or define isolated extension payloads in `virtual_contexts` (e.g., the Kanban tracker injecting its `.tracker` sub-bucket).
The RAG compiler and Cartographer will then natively process these environments without bespoke logic.
* `@hooks.on('compile_contexts')`: Fires during the RAG context compilation phase. Extensions receive the `manifest` dictionary and should inject their custom `.txt` artifacts natively, bypassing the core Cartographer sweep.
* `@hooks.on('post_file_save')`: Fires after the VFS atomic commit, allowing an extension to update an SQLite cache instantly.
    * `@hooks.on('system_boot')`: Fires immediately after the core OS micro-kernel boots. Extensions must use this hook to execute their SQLite schema initializations (`CREATE TABLE`) and migrations (`ALTER TABLE`), guaranteeing that the runtime API routes remain fast, stateless, and free of inline database generation locks.
    * `@hooks.on('system_shutdown')`: Fires prior to a workspace swap (`os.execv`), signaling all active `threading.Event()` locks to commit SQLite transactions and release RAM before the process terminates.

## 3. The Frontend Injection Surface (JavaScript Zones)
Direct DOM mutation of the core OS elements is strictly forbidden. The UI is partitioned into explicit "Zones" that extensions can hook into.
* **The Primary Hooks:**
    * `ExtensionRegistry.registerTab(id, label)`
    * `ExtensionRegistry.registerSubTab(parentId, id, label)`
* **Context-Aware Zone Injection:** Core UI files will expose specific anchor points. When triggered, the hook passes an `ExecutionContext` payload to the callback.
    * `ExtensionRegistry.registerUIHook(zoneId, callback)`
        * **Defined Zones:** * `zone:file-card-actions`: Callback receives `{ filepath, repo, isFS }`.
            * `zone:modal-edit-toolbar`: Callback receives `{ filepath, content }`.
            * `zone:new-file-modal`: Callback receives `{ basePath }`.
            * `zone:settings-menu`: Callback receives `{ currentConfig, saveConfigFn }`, allowing extensions to mount configuration inputs (e.g., API keys, default behaviors) directly into the OS Settings modal.
            * `zone:file-edit-override`: Callback receives `filepath`. If the callback returns `true`, the OS aborts opening the standard code editor, allowing the extension to mount a custom modal (e.g., the Kanban UI).
            * `zone:post-file-save`: Callback receives `filepath`, firing immediately after the OS confirms an atomic disk write.
* **Extending Extensions:** A parent extension (e.g., `citations`) can register its *own* custom zones via the Registry, allowing child extensions to mount UI natively inside the parent's layout.
### 3.1 The Client State Engine (Zustand Slices)
To preserve strict Unidirectional Data Flow (UDF) constraints, extensions must never mutate or query raw DOM layout strings directly. The client environment manages global state across two core reactive stores:
* **`AppStore` (store.js):** Coordinates system-wide topologies, configuration schemas, manifest states, active repositories, and extension arrays.
* **`KanbanStore` (ext_tracker.js):** Isolates the task tracking arrays, active ticket filters, tag matrices, and column expansion flags for the project management canvas.

### 3.2 The Frontend Metronome & Lifecycle Teardown
In a stateless Single Page Application (SPA), navigating between workspaces does not trigger a hard browser refresh. Extensions must manually clean up their memory footprints to prevent cross-tenant data contamination and zombie polling loops.
* **The `setInterval` Ban:** Extensions are strictly forbidden from utilizing native `setInterval`.
* **`ExtensionRegistry.registerTick(extName, intervalMs, callback)`:** Extensions requiring background polling or UI updates must subscribe to the centralized Frontend Metronome. The metronome guarantees execution pacing and automatically garbage-collects the polling loop when the extension unmounts.
* **`ExtensionRegistry.registerUnloadHook(extName, callback)`:** Extensions must register a teardown hook to sever dynamic DOM listeners, clear transient caches, and reset their Zustand stores when the user navigates away from their workspace.

## 4. The Background Worker Matrix (The Metronome & Ledger)
Extensions must respect the ASGI event loop and the Cloud Run Serverless Lock constraint. Spinning up unmanaged `threading.Thread` loops is a vector for catastrophic failure. Furthermore, background tasks must survive workspace profile swaps (`os.execv` process replacements) without heavy multi-daemon architecture.
* **The Ledger:** Extensions requiring background sweeping must submit their callback and interval to the centralized `insetu.workers` ledger. State remains strictly vaulted in the originating workspace's localized database.
* **The Metronome Dispatcher:** A single, lightweight OS thread ticks continuously. It queries the ledger for any jobs where `next_run_at <= NOW()`. 
* **Overrun & Starvation Protection:** To prevent long-running tasks from blocking the Metronome, ready jobs are flagged as `running` and handed off to a constrained `ThreadPoolExecutor` for execution. If the execution time eclipses the task's interval, the `running` flag prevents it from being double-queued. If the ThreadPool is full, jobs gracefully remain `pending` in the ledger (Backpressure handling).
* **The Switchboard Sweep (Process Relay):** * During a workspace swap (`os.execv`), the `@hooks.on('system_shutdown')` event signals the ThreadPool to gracefully drain and commit active state to the database.
    * Upon initialization, the Metronome sweeps `workspaces.json`, checking local databases across *all* registered workspaces for pending jobs, providing seamless cross-workspace background execution.

## 5. Artifact Containment (SQLite & Storage)
Extensions must be good neighbors on the filesystem.
* **The SQLite Constraint:** Local persistent state must be vaulted in `{ARTIFACTS_BASE}/{ext_name}.db`. 
* **The Connection Mandate:** Extensions are strictly forbidden from importing `sqlite3` natively. They must request connections via the core OS orchestrator (e.g., `from insetu.db import get_connection`). The OS kernel enforces Write-Ahead Logging (`WAL`) mode, busy timeouts, and thread-safe connection pooling to prevent fatal database locks between the background ThreadPool and UI HTTP requests.
* **The VFS Constraint:** If an extension needs to mutate the active codebase (e.g., saving a scraped Markdown file), it must route the payload through the central kernel function `execute_vfs_save` (from `insetu.routes_fs`).
Native `open('file.md', 'w')` inside an extension is strictly banned, as it evades Cartographer topology triggers and bypasses the asynchronous background commit queues.
## 6. Asset Resolution & Namespacing
To prevent namespace pollution in a zero-bundler environment, extensions manage their own CSS and visual footprints.
* **Style Injection:** Extensions inject their styling natively via JavaScript (dynamically appending `<style>` tags). 
    * *Transitional Note:* Once the Phase 2 Unified Frontend Stack (LitElement) migration is fully implemented, this manual injection method will be deprecated. Extensions will be required to strictly encapsulate all CSS within native Web Components (Shadow DOM).
* **Static Asset Routing:** The core `app.py` routing matrix will automatically serve any static assets located in a localized extension directory if requested, bypassing the core OS `/static` folder.

## 7. Configuration & Settings (The Two-Tier Matrix)
Extensions must never write rogue configuration files or `.env` files to the disk. They must strictly utilize the OS-provided configuration layers to maintain data containment:
* **Tier 1 (Workspace-Scoped):** Project-specific settings (e.g., default citation styles, target RAG sub-buckets) are vaulted in the active workspace's `config.json` under an `"extension_config": { "ext_name": {} }` dictionary constraint.
* **Tier 2 (Global/Sensitive):** Universal credentials (e.g., OpenAI API keys, Zotero auth tokens) are vaulted at the core switchboard level (`~/.insetu/global_settings.json`). This ensures sensitive keys securely persist across all workspace swaps without requiring redundant data entry or polluting git-tracked workspace directories.