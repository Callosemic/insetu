# ADR 0036: VFS Manifest SQLite CQRS Ledger and Delta Payload Synchronization

## Status
Accepted

## Context
Previously, the inSetu Virtual File System (VFS) and RAG Gather engine relied on a flat `manifest.json` file as the central index for all workspace contexts, chunks, and topologies. As workspaces scaled, this monolithic file approach introduced significant bottlenecks:
1. **The Monolithic Write Bottleneck:** Every minor file mutation forced the engine to serialize and rewrite the entire JSON structure to disk.
2. **Synchronous I/O Blocks:** Disk writes for `manifest.json` occasionally bypassed the asynchronous `_VFS_WRITE_QUEUE`, risking HTTP event loop starvation.
3. **Polling Inefficiencies:** Client instances re-fetched the entire manifest payload following commits, wasting bandwidth and triggering heavy reconciliation passes.

## Decision
We fully transition the VFS Manifest to an embedded **SQLite Command Query Responsibility Segregation (CQRS)** ledger:
1. **Schema Isolation (`vfs_index.db`):** Declare `manifest_ledger` (`filepath`, `entry_json`, `timestamp`) and `sync_metadata` (`key`, `value`) tables isolated from standard domain databases.
2. **Database-Driven Manifest Hooks:** `hook_request_manifest` and `hook_request_manifest_chunks` query `manifest_ledger` directly via relational SQL queries. `hook_save_manifest` processes targeted `UPSERT` and `DELETE` (tombstone) queries.
3. **JIT Version & Delta REST Gateway:** Expose `/api/gather/manifest/version` returning `MAX(timestamp)` and `/api/gather/manifest/deltas?since=<timestamp>` returning surgical state deltas.
4. **Offline Mutation Guard:** On system boot, the engine compares `SYSTEM_BOOT_TIME` against `last_full_compile_time` stored in `sync_metadata` to heal offline modifications.

## Consequences
* **Positive:** Completely eradicates monolithic JSON disk serialization bottlenecks and synchronous write blocks.
* **Positive:** Enables stateless multi-instance client synchronization via lightweight timestamp polling and delta splicing.
* **Negative:** Requires strict database connection pooling and transaction locking during high-velocity concurrent compilation sweeps.