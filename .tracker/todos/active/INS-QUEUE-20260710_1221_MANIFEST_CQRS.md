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
- [ ] **SQLite VFS Index Migration:** Deprecate the flat `manifest.json` file. Establish a new embedded SQLite ledger (e.g., `vfs_index.db`) initialized during the `@hooks.on('system_boot')` lifecycle phase.
- [ ] **Surgical Atomic Writes:** Refactor the Gather engine's VFS commit listener (`_surgically_update_manifest`) to execute targeted SQL `UPSERT`/`DELETE` queries for the modified files rather than reconstructing the entire index object.
- [ ] **Delta Payload Orchestration:** Update the Immediate Jobs background worker to return explicit manifest *deltas* (the specific files added, changed, or removed) in its completion payload.
- [ ] **Zustand Surgical Rehydration:** Update the frontend Zustand `AppStore` to parse incoming delta payloads and surgically splice the changes into the in-memory manifest tree, eliminating the need for N+1 full-manifest HTTP fetches.

## Notes / Execution Log