---
repo: "insetu"
type: "queue"
status: "open"
id: "INS-QUEUE-20260722_1357_PURE_EVENT_SOURCING"
title: "Refactor Manifest Compilation to Pure Event Sourcing with Snapshotting"
created_at: "2026-07-22T13:57:37"
closed_at: null
sub_bucket: "Architecture"
tags: ["Architecture", "CQRS", "Event-Sourcing", "VFS"]
---

## Description
Evaluate and potentially migrate the Virtual File System (VFS) and Gather engines to a pure Event Sourcing architecture. Currently, the system uses a "continuous consumption" model where events are popped from the ledger and surgically patched into the live manifest.

Under this proposed vision:
* At boot, and at every full recompile, a master manifest is generated and saved as a persistent snapshot (`cached_manifest.json`).
* The `vfs_event_log` is *only* cleared at boot and immediately following a successful full recompile. It is never cleared incrementally.
* The live, active manifest is always generated Just-In-Time (JIT) by loading the cached snapshot and mathematically replaying the append-only ledger of file events over it.

### Advantages
* **Absolute State Resilience (Zero Limbo):** Writers blindly append to the SQLite ledger, and readers independently project the state. No events are deleted mid-flight.
* **Time-Travel & Rollbacks:** Preserves a perfect sequential audit trail between full recompiles, laying the groundwork for atomic "undos" of Yomama sync transactions.
* **Simplified Concurrency:** Removes the need for complex database deletion locks and baton-passing between the VFS event logger and the immediate jobs queue.

### Implementation Considerations
* **Event Coalescing:** The replay engine must efficiently squash rapid redundant saves (e.g., an operator hitting save on `app.py` 50 times in an hour) to prevent O(N) CPU drain during the JIT projection.
* **Snapshot Staleness:** If a full recompile isn't triggered for weeks, the ledger will grow massive. We may need to enforce an automated background snapshot schedule (e.g., auto-snapshot every 1000 events) to maintain projection speed.

## Notes / Execution Log
