---
repo: "insetu"
type: "todo"
status: "archived"
id: INS-TODO-20260709_2219_EXTENSION_SDK
title: "Phase 7: The Extension SDK & 'Pit of Success' Architecture"
created_at: 2026-07-09T22:19:00
closed_at: 2026-07-10T01:00:45
sub_bucket: "None"
tags: ["Architecture", "DX", "SDK"]
---

## Description
**Resolution (2026-07-10):** The Extension SDK V2 has been successfully scaffolded and integrated across the frontend and backend architectures.
* **Backend (`insetu/sdk/`):** Shipped `InSetuExtension`, `ExtensionContext`, and `VFSTransaction` to natively enforce ADR 0002 and ADR 0016. Routed `ctx.vfs`, `ctx.db`, and `ctx.resolve_path()` to abstract tenant mechanics and prevent unguarded physical I/O.
* **Frontend (`InSetuElement`):** Shipped the LitElement wrapper inside `app.js` featuring automated Zustand store teardowns (`this._storeUnsubs`) and pre-scoped API clients (`this.api.post()`).
* **Data Layer:** Shipped declarative SQLite auto-migrations via `apply_declarative_schema()` running securely on the `system_boot` hook.

## Notes / Execution Log

**2026-08-05 Update:**
The final V2 SDK Guardrail violations and technical debt have been cleared. The following extensions are officially verified and fully migrated to the V2 architecture:
* `tracker`: Migrated
* `citations`: Migrated
* `git`: Migrated
* `flow`: Migrated
* `research`: Migrated
* `skills`: Migrated