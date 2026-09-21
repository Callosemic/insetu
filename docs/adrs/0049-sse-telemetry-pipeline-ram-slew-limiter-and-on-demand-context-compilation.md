# ADR 0049: Real-Time SSE Telemetry Pipeline, Stage 1 RAM Queue Slew Limiting, and On-Demand Context Compilation

## Status
Accepted

## Context
As active repository workspaces scale, polling `/api/system/deltas` at high frequencies created unnecessary HTTP REST overhead. Furthermore, high-velocity disk modifications (such as rapid multi-file saves or Git checkouts) directly writing to `topology_event_buffer` in SQLite caused database lock contention and I/O thrashing. Additionally, displaying static "Context Stale" warning banners forced users to manually trigger context recompilations even when viewing un-mutated files.

## Decision
1. **Real-Time Server-Sent Events (SSE) Telemetry Pipeline (`api.js`, `system.js`)**:
   - Introduced `SSEPipeline` listening to `/api/system/stream` for real-time `vfs_mutated`, `topology_resolved`, and `job_progress` broadcasts.
   - When SSE is connected, client-side manifest polling backs off adaptively from 3s to 30s intervals.
2. **Stage 1 RAM Queue Slew Limiting (`engine_topology.py`)**:
   - High-velocity VFS mutation events are enqueued into an in-memory `_TOPOLOGY_RAM_QUEUE`.
   - A dedicated `_topology_slew_limiter_loop` worker thread absorbs I/O storms (500ms micro-slew) before committing folded mutations in bulk to the SQLite `topology_event_buffer`.
3. **On-Demand Context Freshness Barrier (`fs.js`, `gather.js`)**:
   - `topology_resolved` SSE events push dirty repository and bucket identifiers into `AppStore` reactive state (`dirtyRepos`, `dirtyBuckets`).
   - Context viewing and copying operations (`viewAndCopy`, `fetchAndCopy`) invoke `ensureFreshContext()`, which detects dirty targets and automatically triggers background compilations JIT before serving content.
   - Removed manual "Contexts Stale" warning banners from the Gather UI in favor of dynamic `intentColor` card highlighting.
4. **Thread-Safe Cache Invalidation (`engine_topology.py`, `engine_gather.py`)**:
   - Replaced process-global/thread-local dictionary manifest caches with `@thread_safe_cache(ttl=2.0)` decorators, triggering event-driven cache invalidation on `manifest_mutated` and `vfs_manifest_mutated`.

## Consequences
* **Positive:** Eliminates REST polling overhead and database I/O thrashing during burst file modifications.
* **Positive:** Ensures users always view fresh context payloads without manual recompilation steps.
* **Positive:** Thread-safe cache invalidation across worker pools and request threads.
* **Negative:** Requires active network sockets for SSE streams (with graceful fallback to 3s polling when disconnected).