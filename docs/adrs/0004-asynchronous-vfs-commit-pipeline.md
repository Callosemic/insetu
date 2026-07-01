# 0004: Asynchronous Virtual File System (VFS) Commit Pipeline

## Status
Accepted

## Context
In intensive multi-tenant workspace environments, heavy text concatenation passes, RAG payload generation loops, and rapid issue-tracker status updates caused significant processing bottlenecks on the main HTTP event thread. When multiple file mutations were processed sequentially, the Flask transaction handler experienced thread starvation, resulting in UI response latency and cross-tenant lock congestion.

## Decision
We will isolate the physical write-path entirely from the HTTP request-response lifecycle by implementing an asynchronous background commit queue pipeline.
* **Off-Thread Processing:** All physical saving, creation, deletion, and file archival routines are delegated to a thread-safe queue (`_VFS_WRITE_QUEUE`) running sequentially on a background worker loop.
* **Non-Blocking Execution:** REST controllers must accept payload modifications synchronously, perform validation passes (e.g., JSON schema evaluation), and immediately return a `202 Accepted` confirmation status to the client, pushing the heavy disk operational block off-thread.
* **Lifecycle Synchronization:** The processing worker thread lifecycle is managed cleanly via core system boot and shutdown hooks to prevent memory leaks and ensure data consistency during runtime execution.

## Consequences
* **Positive:** Drastically improves UI responsiveness and eliminates main event loop thread starvation.
* **Positive:** Prevents resource contention and race conditions when writing metadata files across multiple sandboxed repository environments.
* **Negative:** Introduces brief read-after-write data latency. Read engines must rely on synchronous cache ledger updates (CQRS pattern) to ensure rapid data visibility while the physical file settles asynchronously on disk.