---
title: "Phase 2: Frontend State Hardening (UDF)"
status: "closed"
type: "Architecture"
created: "2026-06-26"
closed_at: "2026-07-01T07:25:00"
---
# Frontend State Hardening

**[Step 3 of the V2 Migration Sequence - Executes AFTER Micro-Kernel Decoupling]**
Implement a strict Unidirectional Data Flow (UDF) to replace the `app.js` DOM-reading monolith.
### Action Items
- [ ] Implement a reactive state manager (e.g., Zustand or Vanilla PubSub) inside `store.js`. [cite: 3143]
- [ ] Refactor UI modules (`kanban.js`, `bridge.js`) to completely stop reading from the DOM (e.g., no more `document.getElementById`). [cite: 3144]
- [ ] Eradicate DOM value and visibility sniffing leaks (`beforeunload` style checking in `app.js`, `switchSubTab` layout evaluations, and manual element updates in `bridge.js`).
- [ ] Eliminate presentation string pollution by migrating raw layout strings out of `ext_citations.js`, `ext_research.js`, and `ext_tracker.js` into strictly encapsulated LitElement web components.
- [ ] Wire modules to dispatch actions to the central store. [cite: 3145]
- [ ] Bind DOM components to subscribe and react strictly to store updates. [cite: 3146]