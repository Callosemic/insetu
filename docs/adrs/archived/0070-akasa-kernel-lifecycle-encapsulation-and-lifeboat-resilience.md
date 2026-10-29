# ADR 0070: Akasa Kernel Two-Phase Lifecycle Encapsulation, Lifeboat Port Rebind Resilience, and Extension Template Modernization

## Status
Accepted (2026-10-21)

## Context
Following the formal extraction of the `akasa` kernel substrate (ADR 0048), several orchestration and operational seams in the inSetu Developer OS required structural consolidation:
1. **Application Chassis Boilerplate Duplication**: `insetu/app.py` contained verbose, imperative configurations for OS resource tuning (file descriptor `RLIMIT_NOFILE`), glibc malloc arena bounds (`MALLOC_ARENA_MAX=2`), thread stack sizing, WSGI HTTPS proxy fixes, token gate interceptors, thread-local SQLite teardown hooks, and Server-Sent Events (SSE) telemetry routing. This duplicated kernel capabilities and created drift between CLI and server boot paths.
2. **Development Reloader Duplication**: In development mode (`INSETU_RELOADER=1`), evaluating background thread initialization during Werkzeug supervisor reloads risked double-firing boot hooks or spawning orphaned worker threads.
3. **Lifeboat Recovery Bootloader Polling Desynchronization**: When booting the recovery console (`fallback_bridge.py`), client-side reboot polling loops checked `/auth/bootstrap`. Because `fallback_bridge.py` lacked an `/auth/bootstrap` route, client polling encountered HTTP 404 errors, causing the interface to misidentify the server state. Furthermore, restarting the recovery daemon frequently encountered `OSError: [Errno 98] Address already in use` before TCP sockets cleared the `TIME_WAIT` state.
4. **Emergency Context Dump Bloat**: The emergency context compiler in `fallback_bridge.py` generated monolithic text files exceeding 900KB, largely driven by inline base64 source maps embedded in vendor JavaScript bundles, exceeding LLM prompt context limits.
5. **Extension Scaffolding Template Drift**: The extension generator template (`ext_template_js.txt`) continued to reference the deprecated `/static/extensions/system/sdk.js` path and utilized two-argument coarse store subscriptions, violating the `COARSE_STORE_SUBSCRIPTION_MANDATE`.

## Decision
1. **Akasa Kernel Two-Phase Lifecycle Encapsulation (`insetu/app.py`)**:
   - Replaced imperative setup logic with declarative two-phase kernel configuration:
     - **Phase A (`akasa.configure`)**: Configures control directory (`.insetu`), trusted namespaces (`insetu.core.`), extension namespaces (`insetu.extensions.`), core modules (`CORE_MODULES_TUPLE`), telemetry passthrough events (`topology_resolved`), trusted host suffixes (`.ts.net`), and automated OS resource tuning (`tune_os_resources=True`).
     - **Phase B (`akasa.init_app`)**: Attaches WSGI middleware, token security gating (`token_header="X-InSetu-Token"`), public route bypasses, database teardown hooks, and the push telemetry route (`sse_route="/api/system/stream"`).
   - Standardized worker and schema ignition on `akasa.boot(skip_if_reloader_parent=...)`, ensuring single-process `insetu serve`, production WSGI, and Werkzeug reloader processes coordinate cleanly without duplicate threads.
   - Hoisted runtime imports to module top level and resolved working directory dynamically via `_akasa_utils.get_daemon_cwd()`.
2. **CLI Sibling Repository Discovery (`insetu/cli.py`)**:
   - Added automated sibling `akasa` directory detection to `sys.path` in `cli.py` to streamline local development across sibling checkouts.
   - Updated `scaffold_profiles` to provision `host.json` and `workspaces.json`.
3. **Lifeboat FS Resilience & Recovery Handshake (`insetu/fallback_bridge.py`)**:
   - Added `@app.route('/auth/bootstrap')` in `fallback_bridge.py` returning `{"status": "recovery", "mode": "lifeboat"}`, allowing client-side polling loops to detect recovery state.
   - Updated client-side reboot polling with dynamic timestamp parameters (`?t=Date.now()`) to bust intermediate HTTP caches.
   - Added a 10-attempt retry loop with 0.5-second pauses in `run_recovery_app()` to gracefully handle `EADDRINUSE` socket conflicts during rapid daemon reboots.
   - Capped emergency context dump bucket files at 256KB (`max_chunk_bytes = 256 * 1024`) with multi-part partitioning (`{stem}_part{idx}{ext}`) without splitting individual files, and stripped inline base64 source maps (`//# sourceMappingURL=data:...`) from vendor scripts.
4. **Extension Scaffolding Modernization (`insetu/defaults/ext_template_js.txt`)**:
   - Updated import specifier to `/static/extensions/system/insetu_sdk.js`.
   - Upgraded store subscription to a three-argument selector-scoped subscription (`this.subscribe(Store, selector, listener)`), ensuring scaffolded extensions satisfy architectural fitness linters out of the box.

## Consequences
* **Positive**: Clean, declarative application chassis adhering strictly to the Three-Tier Architecture.
* **Positive**: Elimination of double-boot worker race conditions under development reloader processes.
* **Positive**: Absolute reliability when transitioning between the primary OS and the Lifeboat Recovery Console, with zero `EADDRINUSE` crashes or polling deadlocks.
* **Positive**: Emergency recovery context files remain bounded under 256KB and free of extraneous source-map bloat.
* **Positive**: Newly scaffolded extensions comply with SDK import and store subscription standards automatically.