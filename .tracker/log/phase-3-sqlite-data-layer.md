---
repo: "insetu"
type: "todo"
status: "logged"
id: phase-3-sqlite-data-layer
title: "Phase 3: The Data Layer Swap (SQLite)"
created_at: 2026-07-02T09:18:30
closed_at: 2026-07-02T23:51:00
sub_bucket: "None"
tags: ["Architecture"]
---
# The Data Layer Swap

**[Step 4 of the V2 Migration Sequence - Executes AFTER UDF State Hardening]**
Replace the expensive, blocking markdown-parsing backend logic in the newly isolated `engine_tracker.py` extension with a fast SQL index.
### Action Items
- [ ] Rip out the backend Python regex logic that physically opens `.tracker` markdown files on every UI render. [cite: 3148]
- [ ] Remediate the runtime I/O thrashing bug inside `/api/tracker/files` where `_sync_disk_to_db()` executes blocking file walks directly during an active user query.
- [ ] Implement an embedded SQLite/DuckDB indexing layer. [cite: 3149]
- [ ] Centralize and restrict schema generation routines (`CREATE TABLE IF NOT EXISTS`) strictly to the `@hooks.on('system_boot')` lifecycle phase to eliminate high-velocity lock congestion.
- [ ] Update `/api/tracker/files` endpoints to query the fast SQL database instead of disk. [cite: 3149]
- [x] Set up a background CQRS worker to sync database mutations back to the physical Markdown files asynchronously.

## Notes / Execution Log
* **Resolution (2026-07-02):** The SQLite Data Layer swap is structurally complete. `engine_tracker.py` now leverages `_sync_disk_to_db` to index all Markdown tracker files into the local `tracker_tickets` table on boot. The REST endpoints (`/api/tracker/files`) strictly query the indexed SQLite layers rather than traversing disk paths. Schema generation is correctly constrained to the `@hooks.on('system_boot')` lifecycle phase.