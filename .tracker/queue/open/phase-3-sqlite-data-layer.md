---
title: "Phase 3: The Data Layer Swap (SQLite)"
status: "Todo"
type: "Architecture"
created: "2026-06-26"
---
# The Data Layer Swap

Replace the expensive, blocking markdown-parsing backend logic with a fast SQL index.

### Action Items
- [ ] Rip out the backend Python regex logic that physically opens `.tracker` markdown files on every UI render.
- [ ] Implement an embedded SQLite/DuckDB indexing layer.
- [ ] Update `/api/tracker/files` endpoints to query the fast SQL database instead of disk.
- [ ] Set up a background CQRS worker to sync database mutations back to the physical Markdown files asynchronously.