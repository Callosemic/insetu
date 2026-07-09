# Runtime Physics & Stateless Multi-Tenant Architecture

**Identity**: The Architect.


**Mission**: To eradicate load-time path anchoring across the inSetu OS kernel, transitioning from process-level workspace isolation (`os.execv`)  to stateless runtime multiplexing. By porting the Axoneme "Chassis Syscall" pattern to the local environment, the daemon becomes a true multi-tenant orchestrator. This enables instant, zero-latency workspace swapping without dropping the ASGI event loop or leaking cross-silo memory.

---

## The Core Problem: Load-Time Physics

Currently, `inSetu` anchors its spatial reality at the exact millisecond the Python interpreter loads the modules:

* 
`utils_core.py` executes `_resolve_workspace_physics()` globally, permanently stamping `CONFIG_PATH` and `WORKSPACE_ROOT` into the daemon's RAM.


* Because the backend assumes a single global state, swapping workspaces requires a violent `os.execv` process reboot to clear the memory and re-bind paths.


* Furthermore, `app.py` only mounts the Python Blueprints for the extensions explicitly listed in the active configuration during the boot sequence.



To achieve instant hot-swapping, we must sever these static imports and shift to **Stateless REST Routing** (`/api/<workspace_id>/verb`).

---

## Phase 1: Stateless REST Routing (The Chassis Syscall)

The backend kernel must never "remember" what workspace it is in. It must evaluate physical file paths dynamically per-request.

* 
**Dynamic Path Resolution:** Gut the static `CONFIG_PATH` assignment in `utils_core.py`. Replace it with a pure function: `get_physics_for(workspace_id)`. This function reads `.insetu/workspaces.json`, resolves the target repository's localized configuration, and returns the absolute paths for that specific request.


* **Route Prefixing:** Upgrade all core OS routes in `app.py`, `engine_bridge.py`, and `engine_gather.py` to accept the workspace identifier as a path parameter (e.g., `/api/{workspace_id}/fs/save`).
* **Stateless I/O Execution:** Route handlers must extract the `{workspace_id}`, pass it to `get_physics_for()`, compute the target `ARTIFACTS_BASE` or `WORKSPACE_ROOT` on the fly, execute the I/O, and return.
* **Performance Guardrail (The `mtime` Cache Mandate):** Stateless routing must NEVER perform raw `open('config.json')` reads to evaluate physics. All configuration resolution must pass through `utils_core.load_json_file()`. This leverages the existing `_JSON_MTIME` RAM cache, which uses microsecond `os.path.getmtime()` checks to guarantee absolute file-system parity without thrashing the disk or relying on stale LRU caching.



---

## Phase 2: The Universal Extension Bootloader

Flask does not easily allow unregistering Blueprints at runtime. Therefore, we must decouple Blueprint mounting from authorization.

* 
**Global Mounting:** Update `load_workspace_extensions()` in `app.py`. On boot, it must scan `workspaces.json`, parse the `config.json` for *all* registered workspaces, compute the union (Set) of all required extensions, and mount their Python Blueprints globally.


* **The Authorization Guardrail:** Implement an `@extension_auth` decorator for all extension routes. When `/api/{workspace_id}/citations/import` is called, the decorator dynamically checks the `config.json` of `{workspace_id}`. If the `citations` extension is not listed in that specific workspace's array, the kernel immediately rejects the request with a `403 Forbidden`.

---

## Phase 3: Database & Metronome Matrix (WAL Concurrency)

With multiple workspaces running concurrently on a single daemon, the SQLite connection pool and the background task dispatcher must be strictly isolated by tenant ID.

* **Multi-Tenant Connection Pooling:** Update `db.py`. The `_local.connections` dictionary  must no longer key solely by `db_path`. It must key by a tuple of `(workspace_id, db_name)`.


* **Performance Guardrail (Lazy LRU Eviction):** The `db.py` connection pool must implement a lightweight LRU (Least Recently Used) eviction policy. If the dictionary exceeds a safe threshold (e.g., > 5 active workspaces), it must call `.close()` on the oldest connections. This prevents zombie Write-Ahead Logging (WAL) locks from accumulating when a user cycles through dozens of workspaces.
* **The Metronome Sweep:** Upon initialization, the Metronome (`workers.py`) will sweep `workspaces.json` and query local databases across *all* registered workspaces for pending jobs.
* 
**Performance Guardrail (Unified Compute Ceiling):** Regardless of how many workspaces the Metronome is sweeping, all jobs must be funneled into the singular, globally bounded `ThreadPoolExecutor(max_workers=3)`. The OS must respect the host machine's local CPU resources by never exceeding this fixed thread count.



---

## Phase 4: Frontend UI (The True Orchestrator)

With all endpoints universally mounted on the backend, the frontend becomes the true orchestrator of the user experience, enforcing strict Unidirectional Data Flow (UDF).

* **Dynamic UI Bootloader:** When `app.js` boots, it fetches `/api/system/workspaces`. It sets the active `<workspace_id>` within its centralized state store.
* 
**Granular Scoping:** The UI *only* executes `ExtensionRegistry.registerTab()` and `registerSubTab()` hooks  for the extensions explicitly listed in the active workspace's configuration payload.


* **The Zero-Latency Hot-Swap:** * When the user clicks a different workspace in the Settings menu, `app.js` dispatches an action to the store.
* The frontend physically destroys the dynamically mounted extension tabs from the DOM.
* It updates the active `<workspace_id>`, fetches the new configuration, and dynamically re-mounts only the authorized tabs for the new workspace.
* It skips the legacy `setInterval` polling loop and `window.location.reload()` entirely, fetching `/api/{new_workspace_id}/manifest` to instantly re-render the file tree and Kanban boards.