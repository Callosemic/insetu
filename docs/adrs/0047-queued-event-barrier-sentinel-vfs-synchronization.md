# ADR 0047: Queued Event-Driven Barrier Sentinel for VFS Synchronization

## Status
Accepted (2026-09-13)

## Context
Previously, `sync_vfs_barrier()` in `ExtensionContext` relied on an abortable polling loop (`while _VFS_WRITE_QUEUE.unfinished_tasks > 0`) to wait for pending Virtual File System writes to settle on disk. While functional, polling `unfinished_tasks` introduced CPU spin overhead, forced waiting for the entire queue to drain completely to zero tasks (even tasks enqueued *after* the barrier was called), and could time out under heavy concurrent write loads.

## Decision
We upgrade `sync_vfs_barrier()` and `_vfs_commit_worker()` to use a **Queued Event-Driven Barrier Sentinel**:
1. **Barrier Sentinel Payload:** `sync_vfs_barrier()` enqueues an explicit task `(workspace_id, "", "", {"action": "barrier", "barrier_event": barrier_event})` onto `_VFS_WRITE_QUEUE`.
2. **Deterministic Event Signal:** `_vfs_commit_worker()` processes tasks sequentially off-thread. When it encounters `action == "barrier"`, it sets `data["barrier_event"].set()`.
3. **Exact Watermark Waiting:** The calling thread waits specifically on `barrier_event.wait(timeout=timeout)`. This guarantees that all VFS write transactions queued *prior* to the barrier call are physically committed, without waiting for unrelated tasks enqueued afterwards.

## Consequences
* **Positive:** Replaces CPU polling loops with thread event waiting (`threading.Event.wait`).
* **Positive:** Guarantees precise watermark synchronization for read-after-write consistency.
* **Positive:** Reduces barrier settlement latency and eliminates queue starvation race conditions.