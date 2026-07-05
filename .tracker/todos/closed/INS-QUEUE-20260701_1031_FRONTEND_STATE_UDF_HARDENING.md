---
repo: "insetu"
type: "todo"
status: "closed"
id: INS-QUEUE-20260701_1031_FRONTEND_STATE_UDF_HARDENING
title: "Enforce DOM Read Ban and Migrate Extensions to Zustand Store"
created_at: 2026-07-01T10:31:00
closed_at: 2026-07-04T17:30:00
sub_bucket: "None"
---

## Description
Multiple frontend extension layers are violating the "DOM Read Ban" and the "Centralized Store" mandates outlined in the engineering standards. Modules like `ext_tracker.js` (`KanbanStore`), `ext_citations.js`, and `ext_research.js` continue to look up tenant attributes independently via `localStorage` parsing strings or evaluating raw DOM node visibility flags (e.g., checking element class lists Contextually).

## Action Items
- [ ] Terminate the isolated `_getActiveWs` helper inside `ext_tracker.js` and bind the state directly to the unified reactive `AppStore` state machine slice.
- [ ] Eliminate DOM visibility sniffing loops across `switchSubTab` and `beforeunload` layout evaluators in `app.js`.
- [ ] Migrate raw presentation strings out of the canvas scripts into structurally encapsulated components to decouple business logic flows completely from DOM rendering lifecycles.
## Notes / Execution Log
* **Resolution (2026-07-04):** Eradicated remaining segments of DOM-reading code. Shifted state lookups across the OS to evaluate central Zustand states natively via functional selectors, successfully bypassing layout sniffing vulnerabilities and resolving automated fitness function flags.