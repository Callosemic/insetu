---
repo: "insetu"
type: "todo"
status: "active"
id: "INS-QUEUE-20260710_1221_MANIFEST_CQRS"
title: "Migrate VFS Manifest to SQLite CQRS and Delta Payloads"
created_at: "2026-07-10T12:21:34"
closed_at: null
sub_bucket: "None"
delivery_date: "2026-08-23"
tags: ["Architecture", "Backend", "Performance", "CQRS"]
---
## Description
The ecosystem currently relies on a flat `manifest.json` file as the central index for all workspace contexts and topologies. As workspaces scale, this monolithic JSON approach violates several core engineering principles:

1. **The Monolithic Write Bottleneck:** Any single file mutation (e.g., via the Yomama Sync Bridge or a VFS commit) forces the engine to serialize and rewrite the entire JSON ecosystem to disk.
2. **Synchronous I/O Block:** The `save_json_file` utility explicitly bypasses the asynchronous `_VFS_WRITE_QUEUE` for `manifest.json`, meaning these massive rewrites execute synchronously on the main HTTP event loop, risking thread starvation.
3. **Frontend Polling Inefficiency:** Following a VFS commit, the frontend blindly re-fetches the entire manifest via `/api/<workspace_id>/manifest` to rehydrate its Zustand state, wasting bandwidth and triggering heavy reconciliation cycles.
### Action Items
- [ ] **Schema Isolation (`vfs_index.db`):** Explicitly call `register_schema('vfs_index', {...})` to isolate the `manifest_ledger` and `sync_metadata` tables from the standard `gather.db`.
- [ ] **Initial Load Hooks:** Rewrite `request_manifest` and `request_manifest_chunks` to query `vfs_index.db` using `SELECT * FROM manifest_ledger` instead of reading the physical JSON file.
- [ ] **Full Sweep Overhaul:** Refactor `generate_context_file` to execute a bulk `DELETE FROM manifest_ledger` followed by mass `INSERT` transactions, replacing the `manifest.json` physical dump.
- [ ] **Offline Mutation Guard:** Update the `system_boot` heuristic to read `last_full_compile_time` from the `sync_metadata` SQLite table instead of relying on `manifest_cache.json`.
- [ ] **Surgical Atomic Writes:** Refactor `hook_save_manifest` and `_surgically_update_manifest` to execute targeted SQL `UPSERT`/`DELETE` queries for modified files.
- [ ] **Version Hash & Delta Endpoints:** Expose `/api/<workspace_id>/manifest/version` (returning `MAX(timestamp)` from `vfs_event_log` in `workers.db`) and `/api/<workspace_id>/manifest/deltas?since=<timestamp>` for stateless multi-instance polling.
- [ ] **Frontend Metronome Synchronization:** Wire a 3-second background metronome tick (`registerTick`) in the frontend SDK to query the version endpoint and pull deltas for passive observer instances.
- [ ] **Optimistic Zustand Splicing:** Maintain zero-latency snappiness for active actor instances via optimistic `AppStore` manifest splicing, using the background metronome delta fetch as an idempotent true-up.

## Notes / Execution Log
### Architectural Decisions & Multi-Instance Synchronization Blueprint (2026-07-25)

1. **Fully Database-Driven Backend (CQRS):**
    - The flat `manifest.json` file on disk is strictly deprecated on the backend to destroy the monolithic write bottleneck.
    - All mutations execute targeted SQL `UPSERT`/`DELETE` statements against `vfs_index.db`.
    - The frontend Zustand `AppStore` retains an in-memory `manifest` object tree for presentation components.

2. **Multi-Instance State Drift Resolution (The "inSetu Way"):**
    - *Problem:* Returning deltas solely inside worker job completion artifacts (`api.pollJob()`) only notifies the initiating client (Instance A). Idle client tabs (Instance B) suffer silent state drift.
    - *Decision:* Rejected stateful WebSocket buses to preserve inSetu's stateless multi-tenant architecture (`X-Workspace-ID` headers across workspace swaps).
    - *Solution (The Polling Ledger):* Leverages the existing `vfs_event_log` SQLite table in `workers.db` and the frontend SDK metronome tick (`registerTick` every ~3 seconds).

3. **Actor vs. Observer Dynamics:**
    - **Instance A (Actor):** Fires VFS mutations and *optimistically* updates its local `AppStore.manifest` in memory immediately for zero-latency UI responsiveness. The 3-second metronome tick acts as a silent, idempotent "true-up."
    - **Instance B (Observer):** Sits idle until its 3-second metronome tick detects a newer backend `vfs_event_log` timestamp. It fetches `/manifest/deltas?since=<timestamp>` and surgically splices changes into its local `AppStore.manifest` without requiring full re-fetches or page reloads.