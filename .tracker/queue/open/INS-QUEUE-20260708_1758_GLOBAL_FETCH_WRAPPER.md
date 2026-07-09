---
repo: "insetu"
type: "queue"
status: "open"
id: INS-QUEUE-20260708_1758_GLOBAL_FETCH_WRAPPER
title: "Architectural Upgrade: Global API Fetch Wrapper (window.inSetu.fetch)"
created_at: 2026-07-08T17:58:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-08-09"
tags: ["Architecture", "Frontend", "Refactor", "Security"]
---

## Description
Currently, domain-specific extensions are forced to manually parse the active tenant state and inject `X-Workspace-ID` into every native browser `fetch()` call. This is a leaky abstraction that results in boilerplate fatigue and cross-tenant data bleed when headers are forgotten (e.g., the `ext_skills.js` bug).

To enforce strict boundary isolation, we must implement a centralized Global API Gateway in the core OS (`app.js`).
### Action Items
- [ ] Create `window.inSetu.fetch(url, options)` to wrap the native browser fetch.
- [ ] **The URL Rewriter:** The wrapper must automatically intercept standard API calls (e.g., `/api/skills/list`) and rewrite them to include the active workspace in the path (e.g., `/api/<workspace_id>/skills/list`) by natively reading the `AppStore` state.
- [ ] **Backend Alignment:** Refactor the Python Flask Blueprints (`routes_*.py` and `engine_*.py`) to explicitly accept `<workspace_id>` in their route paths, restoring deterministic REST routing and eliminating the leaky reliance on header-sniffing.
- [ ] Execute a regex sweep across all frontend files to replace `await fetch(...)` with `await window.inSetu.fetch(...)`, ensuring extensions remain tenancy-agnostic.
- [ ] **Future-Proofing:** Leave commented hooks inside the wrapper to eventually intercept and append the `X-InSetu-Token` for the upcoming Tailscale Token Gatehouse, and to catch `TypeError: Failed to fetch` for the Offline Typewriter IndexedDB routing.

## Notes / Execution Log
