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
* **The Python Metadata:** Every `engine_{ext}.py` module must expose a module-level list named `__depends__ = ['citations', ...]` mapping its upstream requirements, and optionally `__external_depends__` (PyPI packages) or `__external_binaries__` (system CLI tools like `git` or `pandoc`) to communicate system dependencies.
* **The Blueprint Wrapper:** Backend extensions must utilize the `InSetuExtension` SDK class instead of raw Flask Blueprints to guarantee strict tenant path isolation and context injection.
* **The Bootloader (app.py):** The `load_workspace_extensions()` routine must perform a topological sort (Directed Acyclic Graph) of the requested extensions in `config.json`. 
    * If an extension requires a dependency that is missing or fails to import, the child extension is gracefully aborted and logged as an `ImportError`.
* **The JS Bootloader (app.js):** The frontend mirrors the backend DAG. ES6 imports guarantee that parent modules load and register their API surfaces before child extensions attempt to attach to them.
## 2. The Backend Injection Surface (Python Event Bus)
Extensions cannot hardcode themselves into `engine_gather.py` or the `bridge_sync` transaction loop. They must subscribe to OS lifecycle events.
* **The `HookRegistry`:** The core OS will expose an `insetu.hooks` namespace where extensions register callbacks via `@hooks.on(event_name, priority=50)`. Hooks execute in ascending priority order and can be triggered synchronously via `hooks.emit` or asynchronously via `hooks.emit_background`.
* `@hooks.on('mutate_workspace_config')`: Allows an extension to intercept the configuration load phase and dynamically inject virtual `sub_buckets`, append to `managed_dirs`, or define isolated extension payloads in `virtual_contexts` (e.g., the Kanban tracker injecting its `.tracker` sub-bucket).
* `@hooks.on('gather_declare_topology')`: The Inversion of Control (IoC) contract for RAG context generation. Extensions must yield topology schemas containing `filename`, `meta`, `generator_callback`, and `recall_callback` to inject custom `.txt` artifacts natively.
* `@hooks.on('vfs_mutated')`: Fires immediately after VFS mutations (saves, deletes, moves), passing a normalized array of mutation objects (`[{ filepath, operation, ignore_ledger }]`).
* `@hooks.on('topology_resolved')`: Fires after the Stage 1 Slew Limiter processes raw VFS events and flushes the `topology_ledger`. Extensions evaluating workspace boundaries (like Automation Hooks) should listen here to avoid I/O storm race conditions.
    * `@hooks.on('workspace_boot')`: Fires for each workspace after system initialization. Extensions must use `@hooks.on('workspace_boot')` for tenant-scoped setup. Note: Domain extensions (`insetu.extensions.*`) are strictly banned from subscribing to `system_boot` (which is reserved exclusively for core micro-kernel boot) to prevent cross-tenant initialization leakage and recursive loop traps.
    * `@hooks.on('system_shutdown')`: Fires prior to a workspace swap (`os.execv`), signaling all active `threading.Event()` locks to commit SQLite transactions and release RAM before the process terminates.
## 3. The Frontend Injection Surface (Declarative Schema)
Direct DOM mutation and imperative initialization (e.g., self-executing `registerTab` calls) of the core OS elements are strictly forbidden.
Extensions must expose a static configuration payload using the Declarative Schema. The OS bootloader reads this payload and orchestrates the DOM injection statelessly.
* **The Declarative Registration:**

```javascript
window.ExtensionRegistry.registerExtension('ext_name', {
    name: "Extension Title",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'file',
            id: 'ext-action-id',
            label: 'Action Label',
            icon: '🔧',
            intent: 'primary',
            order: 20,
            match: (data) => data.filepath && data.filepath.endsWith('.ext'),
            onClick: (data, e) => { ... },
            asyncAction: async (data, e) => { ... },
            emitEvent: (data) => ({ name: 'insetu:ext:action', detail: { id: data.id } })
        }
    ],
    layoutSlots: [
        { slot: "primary-navigation", id: "my_tab", label: "My Tab", order: 5 },
        { slot: "sub-navigation", targetParent: "my_tab", id: "my_subtab", label: "Sub Tab", order: 1, component: "insetu-ext-component" }
    ],
    settingsActions: [
        { id: 'config_id', label: 'Settings Label', icon: '⚙️', onClick: () => { ... } }
    ]
});

```

* **Layout Slots (The Routing Topology):** Extensions declare their UI footprint via the `layoutSlots` array rather than imperatively appending themselves to the DOM.
* **`slot`**: The target zone (e.g., `primary-navigation`, `sub-navigation`, `global`). Note: Do not use the redundant `slots:` prefix.
* **`order`**: An integer dictating the left-to-right visual sequence.
* **`component`**: The custom Web Component tag to mount (e.g., `"insetu-ext-tracker"`). **Omit this** for parent shells (like primary tabs) that only exist to house sub-tabs. **Require this** for actual views or actions that need to paint an interface on the canvas.

* **Context-Aware Zone Injection:** Core UI files expose specific anchor points mapped via the `uiHooks` object in the schema.

When triggered, the hook passes an \`ExecutionContext\` payload to the callback.
        * **Defined Zones:** 
            * `zone:modal-edit-toolbar`: Callback receives `{ filepath, content }`.
            * `zone:new-file-modal`: Callback receives `{ basePath }`.
            * `zone:settings-menu`: Callback receives `{ currentConfig, saveConfigFn }`, allowing extensions to mount configuration inputs (e.g., API keys, default behaviors) directly into the OS Settings modal.
            * `zone:file-edit-override`: Callback receives `filepath`. If the callback returns `true`, the OS aborts opening the standard code editor, allowing the extension to mount a custom modal (e.g., the Kanban UI).
            * `zone:post-file-save`: Callback receives `filepath`, firing immediately after the OS confirms an atomic disk write.
* **Action Ordering (The CSS Order Scale):** To prevent a visual "arms race" for the leftmost position on file cards and toolbars, extensions injecting action buttons (e.g., via `zone:file-card-actions`) MUST adhere to the following inline `style="order: X;"` scale:
    * `< 0`: Quick/Pin actions (e.g., Favorites `order: -1`).
    * `0` to `49`: Primary Domain actions (e.g., Git Push, Format Document).
    * `50` to `99`: Secondary/Contextual actions (e.g., Copy Link, Tag).
    * `>= 100`: Core OS Fallback actions (e.g., Browse, Download).
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
    * Upon initialization, the Metronome sweeps `system.json`, checking local databases across *all* registered workspaces for pending jobs, providing seamless cross-workspace background execution.

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
* **Static Asset Routing & Vendor Manifests:** The core `app.py` routing matrix automatically serves static assets located in extension subdirectories via `/static/extensions/<ext_name>/<path:filename>`. Third-party dependencies must be declared in `<ext_root>/vendor.json` with version and compound SemVer range criteria for JIT importmap assembly (ADR 0032).

## 7. Configuration & Settings (The Two-Tier Matrix)
Extensions must never write rogue configuration files or `.env` files to the disk. They must strictly utilize the OS-provided configuration layers to maintain data containment:
* **Tier 1 (Workspace-Scoped):** Project-specific settings (e.g., default citation styles, target RAG sub-buckets) are vaulted in the active workspace's `config.json` under an `"extension_config": { "ext_name": {} }` dictionary constraint.
* **Tier 2 (Secure/Sensitive):** Sensitive credentials (e.g., OpenAI API keys, Zotero auth tokens) are vaulted in the active workspace's control directory inside `secrets.json`. This strictly scopes access tokens to their respective tenants, ensuring that different projects can safely utilize distinct API keys or billing accounts without cross-contamination, while keeping them safely out of git-tracked directories.