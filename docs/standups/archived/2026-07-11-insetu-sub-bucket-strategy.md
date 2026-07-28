Here is the comprehensive execution plan for splitting the inSetu repository workspace context into high-performance sub-buckets and anchoring your core framework requirements inside a lightweight contract sheet.

By isolating the documentation layer from your raw source file vectors, you eliminate token bloat during layout design sessions while ensuring your AI context window remains structurally grounded.

---

## The Core Sub-Bucket Separation Blueprint

To achieve perfect architectural isolation, the workspace will partition its contents into six discrete buckets:

* `docs`: Captured cleanly within its own context file, hosting the contracts ledger.


* `chassis`: The core operational HTTP server routing frameworks and initialization files.


* `engines`: Advanced asynchronous processing pipelines, repository cartography, and background lifecycles.


* `sdk`: Abstract multi-tenant base definitions, transaction wrappers, and state schemas.


* `frontend`: Centralized reactive Zustand state containers, global event metronomes, and LitElement substrates.


* `catch_all`: A dynamic residual backstop to prevent untracked configuration scripts or structural components from escaping the context boundaries.



---

## Phase 1: Context Isolation Configuration

This patch maps out the structural partition boundaries for the `insetu` codebase within your workspace target configuration file.

```text
<<<<<<< FILE: insetu/.insetu/config.json
<<<<<<< SEARCH
=======
{
  "instance_title": "inSetu Developer OS",
  "instance_emoji": "⚙️",
  "port": 5005,
  "extensions": ["config", "bridge", "gather", "files"],
  "category_order": ["Core Subsystems", "Platform Architecture", "Frontend Interface", "Quality Assurance"],
  "target_repos": [
    {
      "repo_dir": "insetu",
      "title": "inSetu Developer OS Chassis",
      "domain": "Core OS Subsystems",
      "exts": [".py", ".js", ".json", ".md", ".css"],
      "sub_buckets": [
        {
          "id": "docs",
          "title": "Platform Engineering Contracts",
          "domain": "Platform Architecture",
          "description": "High-signal Markdown contract sheets defining API signatures and operational primitives.",
          "match_prefixes": ["docs/"]
        },
        {
          "id": "chassis",
          "title": "OS Chassis & Routing Subsystem",
          "domain": "Core Subsystems",
          "description": "Flask app bootloaders, HTTP core network routing topologies, and root utility single-sources-of-truth.",
          "match_prefixes": ["insetu/app.py", "insetu/utils_core.py", "insetu/routes_"]
        },
        {
          "id": "engines",
          "title": "Background Worker Execution Engines",
          "domain": "Core Subsystems",
          "description": "The background computational layers governing AST compilation, repo mapping, and thread tasks.",
          "match_prefixes": ["insetu/engine_bridge.py", "insetu/engine_gather.py", "insetu/cartographer.py", "insetu/workers.py"]
        },
        {
          "id": "sdk",
          "title": "Multi-Tenant Extension Architecture SDK",
          "domain": "Platform Architecture",
          "description": "Abstract parent models, tenant DB migration interfaces, and VFS atomic transaction buffers.",
          "match_prefixes": ["insetu/sdk/", "insetu/context.py", "insetu/db.py"]
        },
        {
          "id": "frontend",
          "title": "Centralized UI Web Application",
          "domain": "Frontend Interface",
          "description": "Zustand global application state containers, event metronomes, and LitElement dashboard views.",
          "match_prefixes": ["insetu/static/js/"]
        },
        {
          "id": "residual_catch_all",
          "title": "Chassis Residual Backstop",
          "domain": "Core Subsystems",
          "is_catch_all": true
        }
      ]
    }
  ]
}
>>>>>>> REPLACE

```

---

## Phase 2: Interface Contract Generation

This patch creates the high-signal, zero-noise contract ledger inside `docs/standups/`. It serves as an absolute reference index for your extension engineering sessions, stripping out low-signal code implementations.

```text
<<<<<<< FILE: insetu/docs/standups/sdk_v2_contracts.md
<<<<<<< SEARCH
=======
# inSetu OS SDK Interface Contracts (V2 Specification)

This contract sheet serves as the absolute single source of truth for the interfaces between the Core OS Substrate and Custom Functional Extensions. Refer strictly to these signatures during feature development to maintain system-wide multi-tenant compliance.

---

## 1. Frontend State Architecture
All extension states must be declared using the centralized object store factory to ensure complete isolation and prevent multi-tenant data leaks during profile shifts.

### `createExtensionStore(name, initialState, persistKeys)`
- **Parameters:**
  - `name` (String): Unique module namespace (e.g., 'Bridge', 'Tracker')[cite: 2].
  - `initialState` (Object): Baseline key-value property map[cite: 2].
  - `persistKeys` (Array): String keys that should automatically persist across browser reloads, isolated cleanly per-tenant namespace[cite: 2].
- **Automatic Standard Injection:**
  - `store.getState().resetState()`: Framework-invoked callback that clears runtime memory back to baseline parameters during workspace swaps[cite: 2].

---

## 2. Web Component Substrate
UI elements must inherit from the framework container model rather than native browser elements to capture lifecycle state tracking automatically.

### `InSetuElement` (Extends `LitElement`)
- **Contextual Properties:**
  - `this.workspaceId` (String): Active workspace tenant context binding[cite: 2].
  - `this.extName` (String): Explicit structural module string used for routing calculations[cite: 2].
- **Brokered Resource Accessors:**
  - `this.subscribe(store, selector, listener)`: Unified Zustand observer that cleanly unmounts itself on element disconnection to eliminate memory bleed[cite: 2].
  - `this.registerInterval(callback, delayMs)`: Tracked scheduling mechanism dismantled automatically on component destruction.
  - `this.registerGlobalListener(type, target, callback)`: Base-managed event routing wrapper preventing global namespace contamination.

---

## 3. Client Network Gateway
Extensions are strictly forbidden from invoking raw browser `fetch()` commands. Network synchronization must route through the client API abstraction to inherit multi-tenant isolation cookies and auth headers natively.

- `this.api.get(path, options)` -> Executes an isolated HTTP GET request[cite: 2].
- `this.api.post(path, payload, options)` -> Executes an isolated HTTP POST request[cite: 2].
- `this.api.delete(path, options)` -> Executes an isolated HTTP DELETE request[cite: 2].
- `this.api.pollJob(jobId, { interval, onProgress, onComplete, onError })` -> Brokered background tracking thread controller[cite: 2].

---

## 4. Backend Extension Substrate
Python feature scripts must leverage the unified execution wrapper to intercept routing contexts safely.

### `ExtensionContext`
- **Instance Attributes:**
  - `ctx.workspace_id` (String): Checked multi-tenant tenant key tracking.
  - `ctx.config` (Dict): Lazy configuration access to the active workspace configuration map.
  - `ctx.paths` (Dict): Platform paths directory mappings.
  - `ctx.db` (Connection): Automated SQLite connector keyed securely to the active tenant workspace schema.
  - `ctx.vfs` (VFSTransaction): Atomic file system context enabling safe multi-file read/write staging.
  - `ctx.jobs` (JobManager): Off-thread background execution dispatcher.
>>>>>>> REPLACE

```

---

## Phase 3: Operational Checklist for Extension Authors

When you begin writing a custom extension or refactoring a UI view under this new split model, use the following execution routine to maximize context window efficiency:

1. **Pin Your Anchors:** Open your context clipboard utility and explicitly select the `insetu_docs_context.txt` payload. This immediately injects the interface contracts into the AI's short-term memory.


2. **Target Your Domain:** Pin *only* the specific functional sub-bucket you are editing (e.g., `insetu_frontend_context.txt` or your standalone extension folder context).


3. **Execute:** Execute your prompts. The AI will cross-reference your raw layout files directly against the strict specifications outlined in your contract sheets, allowing it to design perfectly integrated code without needing to ingest a single line of raw backend Python files.



How should we structure the companion test checking suite to verify that incoming extensions adhere exactly to the naming patterns defined in this new `docs/standups/` spec sheet?