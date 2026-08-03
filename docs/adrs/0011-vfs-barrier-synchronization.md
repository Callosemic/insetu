# 0011: VFS Barrier Synchronization

## Status
Accepted (2026-07-05)

## Context
Routing mutations exclusively through the asynchronous `_VFS_WRITE_QUEUE` ensures our main ASGI loop avoids HTTP starvation. However, this creates a race condition during context compilations and rapid batch processing where the Event Bus triggers downstream listeners (e.g., Cartographer) to map files that have not yet mathematically settled on the disk.
## Decision
We enforce a VFS Barrier Pattern (`sync_vfs_barrier()`) within critical background compiler threads. While main HTTP REST threads remain 100% non-blocking (returning `202 Accepted` instantly), secondary background task processors will execute an abortable polling wait state on the queue—actively evaluating `_VFS_SHUTDOWN_SIGNAL` to prevent thread deadlocks during workspace swaps or system shutdowns—before emitting lifecycle completion hooks like `compile_contexts`.

## Consequences
* **Positive:** Complete prevention of read-after-write disk race conditions during massive system operations.
* **Positive:** Retains main-thread resilience while sacrificing background-thread execution time for guaranteed physical parity.