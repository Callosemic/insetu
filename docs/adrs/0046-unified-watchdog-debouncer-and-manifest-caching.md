# ADR 0046: Unified Watchdog Debouncer, Pre-I/O Intent Capture, and Thread-Local Manifest Caching

## Status
Accepted (2026-09-10)

## Context
Operating filesystem observers (`watchdog`) alongside an asynchronous Virtual File System (VFS) created two critical performance bottlenecks:
1. **Watchdog Timer Thrashing & Double-Fires:** Spawning an independent `threading.Timer` per mutated file path generated heavy thread allocation during burst I/O (e.g., `git checkout` or batch sweeps). Furthermore, if a file save completed on disk while the Watchdog timer was ticking, Watchdog fired a duplicate `vfs_mutated` event after the quiet period elapsed.
2. **SQL Read Bottlenecks on Manifest Queries:** High-frequency event bus listeners continuously invoked `request_manifest` and `request_vfs_manifest`, issuing repeated SQL queries against `vfs_index.db` and `topology_ledger` within millisecond intervals.
3. **Indefinite Barrier Wait Starvation:** Barrier wait loops awaiting VFS queue or Topology settlement lacked timeout circuit breakers, risking thread starvation if an upstream job stalled.

## Decision
1. **Unified Watchdog Debouncer Thread (`_watchdog_debouncer_loop`):** Replaced per-file `threading.Timer` objects with a single background debouncer thread monitoring a thread-safe `_WATCHDOG_PENDING` dictionary.
2. **Pre-I/O Intent Capture (`_track_intent_vfs_writes`):** Subscribed `_track_intent_vfs_writes` to `@hooks.on('pre_file_save')`. Intent is recorded *before* physical disk I/O occurs, allowing the debouncer thread to cancel pending Watchdog events before the observer even detects the disk change.
3. **Thread-Local Short-TTL Manifest Caching:** Introduced `_manifest_thread_cache` and `_vfs_manifest_thread_cache` (`threading.local`) with a 2.0-second TTL in `engine_gather.py` and `engine_topology.py`. Caches are invalidated immediately upon `save_manifest`, `force_topology_scan`, or `resolve_topology_buffer`.
4. **Barrier Loop Circuit Breakers:** Added loop iteration bounds (`timeout_loops < 50` in `engine_bridge.py`, `timeout_loops < 20` in `engine_gather.py`) to prevent indefinite thread blocking during barrier wait states.
5. **Owning Workspace Hook:** Registered `@hooks.on('resolve_owning_workspaces')` in `engine_topology.py` to map physical file paths to owning tenant workspace IDs.

## Consequences
* **Positive:** Eliminates Watchdog thread allocation overhead and double-fire events during VFS writes.
* **Positive:** Drastically reduces SQL query load during burst manifest reads.
* **Positive:** Prevents background worker deadlocks during barrier wait states.
* **Negative:** Introduces a 2.0-second max stale window for un-invalidated thread-local manifest reads (mitigated by explicit cache eviction on write paths).