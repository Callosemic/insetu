# Proposed Sanic Migration

**STATUS: REJECTED**
Async doesn't actually provide that much benefit. FastAPI might have been interesting for the OpenAPI and Pydantic opportunities, but not necessarily for async.

## 🛠️ Step 1: Upgrade Connection Pooling to Async-Safe Contexts (`insetu/db.py`)

Because Flask allocates an individual request directly to a single synchronous OS thread, your current database caching relies on thread-local memory boundaries (`_local = threading.local()`). In Sanic's asynchronous event loop, tasks yield cooperatively on the same thread, meaning thread-locals will cause cross-tenant context leakage.

* **Action Items:**
    * Delete `_local = threading.local()` from the module scope.
    * Import `ContextVar` from Python’s native `contextvars` module to track tenant database states safely across asynchronous tasks.
    * Modify `get_connection(db_name, workspace_id)` to get and set connections within an async-safe `ContextVar` context registry instead of `_local.connections`.
    * Ensure the SQLite configurations (`PRAGMA journal_mode=WAL;`, `busy_timeout=5000`) remain intact to guarantee multi-tenant write safety under asynchronous execution.

---

## 🔌 Step 2: Reconstruct the Extension SDK Routing Chassis (`insetu/sdk/extension.py`)

Your extension layer depends on the `InSetuExtension` blueprint decorator class to automatically catch tenant workspace parameters and map endpoints safely. This must be adapted to conform to Sanic's asynchronous routing loop.

* **Action Items:**
    * Replace `from flask import Blueprint` with `from sanic import Blueprint`.
    * Update the `InSetuExtension.__init__` constructor to instantiate a Sanic `Blueprint` instead of a Flask blueprint.
    * Refactor the `InSetuExtension.route` decorator function. Sanic requires all route handlers to be explicitly declared as `async def` coroutines, and they must accept the incoming `request` object as their first positional argument.
    * Adjust the route matching strings. Convert Flask’s variable syntax (`/api/<workspace_id>/...`) to Sanic’s path parameter validation format (`/api/<workspace_id:str>/...`).
    * Update the `ExtensionContext` wrapper initialization to gracefully extract request data from Sanic's async request lifecycle properties.

---

## 🌐 Step 3: Refactor the Micro-Kernel Core and Middlewares (`insetu/app.py`, `insetu/routes_*.py`)

With the SDK prepared, the application bootloader and transport shell blueprints must be transitioned to the new ASGI server engine.

* **Action Items:**
    * Open `insetu/app.py` and replace `app = Flask(__name__)` with `from sanic import Sanic; app = Sanic("InSetu_Developer_OS")`.
    * Convert the custom `ForceHTTPSProxyFix` WSGI middleware class into a native Sanic request middleware function via the `@app.on_request` or `@app.middleware('request')` hook.
    * Convert the `intercept_local_static_assets` pre-request interceptor into an asynchronous Sanic request middleware handler.
    * Rewrite the `serve_extension_js` and asset `download_file` routes to use Sanic's async file-streaming capabilities (`from sanic.responses import file`) to prevent synchronous disk I/O blocks on the main loop.
    * Update the core transport blueprints (`fs_bp`, `bridge_bp`, `system_bp`, `gather_bp`) to register as async Sanic blueprints and convert all individual route definitions to `async def`.

---

## ⚡ Step 4: Port the Terminal WebSocket Pipeline to Native Async (`insetu/extensions/engine_term.py`)

The terminal currently manages full-duplex shell multiplexing by running blocking threads (`threading.Thread`) and synchronous polling loops (`select.select`) over `flask-sock`. Sanic eliminates this manual thread starvation entirely via first-class asynchronous WebSockets.

* **Action Items:**
    * Completely remove `from flask_sock import Sock` and its associated application initialization bindings.
    * Change the streaming route decorator to utilize Sanic's native async socket router: `@term_bp.websocket('/term/stream')`.
    * Discard the synchronous `read_from_pty` loop and its companion `threading.Thread` initialization engine.
    * Leverage `asyncio.get_event_loop().connect_read_pipe` or attach a non-blocking asynchronous stream reader directly to the master PTY file descriptor (`master_fd`).
    * Refactor the write execution loop to use an `async for msg in ws:` loop, enabling incoming JSON canvas configuration packets and shell entries to pipe natively down to the kernel without blocking.

---

## 🧹 Step 5: Convert the Asynchronous VFS Commit Queue (`insetu/routes_fs.py`)

The filesystem substrate currently handles asynchronous mutations by feeding updates into a thread-bound `queue.Queue()` that blocks a separate background OS worker thread (`_vfs_commit_worker`).

* **Action Items:**
    * Keep the synchronous multi-file background pipeline intact to shield your main event loop from blocking file-system interaction loops (`with open(..., 'w')`).
    * However, refactor `execute_vfs_save`, `execute_vfs_move`, and `execute_vfs_delete` to launch non-blocking async tasks or use `asyncio.Queue` to synchronize transactions instantly across route scopes without locking up the event loop.
    * Ensure that after async disk mutations finish, the central database log notifications (`vfs_event_log`) are written asynchronously.

---

## 🔍 Step 6: Update the Architectural Fitness Linter (`insetu/tests/fitness_functions.py`)

To lock down the "Pit of Success" and prevent regressions, your custom AST static analysis checks must be updated to reject Flask remnants and enforce async best practices.

* **Action Items:**
    * Open `insetu/tests/fitness_functions.py`.
    * Delete the `FLASK_BLUEPRINT_BAN` validation logic.
    * Injected a fresh rule (`SANIC_ASYNC_MANDATE`) inside the AST Visitor structure. This must throw an architectural violation error if an extension engine registers a route handler using a standard synchronous function definition (`def`) instead of an asynchronous coroutine definition (`async def`).
    * Update the import whitelist checks to block any residual imports of Flask components across extension subdirectories.
    * Run the updated validator script to ensure your entire code topography satisfies the newly deployed async architectural guidelines.