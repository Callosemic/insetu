---
title: "Phase 2: Frontend State Hardening (UDF)"
status: "Todo"
type: "Architecture"
created: "2026-06-26"
---
# Frontend State Hardening

**[Step 3 of the V2 Migration Sequence - Executes AFTER Micro-Kernel Decoupling]**
Implement a strict Unidirectional Data Flow (UDF) to replace the `app.js` DOM-reading monolith.

### Action Items
- [ ] Implement a reactive state manager (e.g., Zustand or Vanilla PubSub) inside `store.js`.
- [ ] Refactor UI modules (`kanban.js`, `bridge.js`) to completely stop reading from the DOM (e.g., no more `document.getElementById`).
- [ ] Wire modules to dispatch actions to the central store.
- [ ] Bind DOM components to subscribe and react strictly to store updates.