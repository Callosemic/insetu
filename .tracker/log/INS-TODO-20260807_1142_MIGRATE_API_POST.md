---
repo: "insetu"
type: "todo"
status: "logged"
id: "INS-TODO-20260807_1142_MIGRATE_API_POST"
title: "Migrate extension API calls to consume window.inSetu.api.post shorthand"
created_at: "2026-08-07T11:42:00"
closed_at: "2026-08-18T09:55:00"
sub_bucket: "None"
delivery_date: "2026-08-23"
tags: "['SDK', 'Refactor', 'API', 'Extensions']"
---

## Description
Refactored all client API invocations across core components (`api.js`, `sdk.js`, `bridge.js`, `fs.js`, `gather.js`, `config.js`, `ui_editor.js`, `ui_system_settings.js`) to consume semantic HTTP shorthand methods (`.get()`, `.post()`, `.delete()`).

### Action Items
- [x] Audit active extension modules and core chassis files for raw `api.workspace` and `api.system` invocations.
- [x] Replace explicit `JSON.stringify()` payload serialization and `method: 'POST'` options with `this.api.post()` / `window.inSetu.api.workspace.post()` / `window.inSetu.api.system.post()`.
- [x] Verify that job polling receipts, `requires_refresh` soft-reloads, and client-side active extension enablement checks function properly under the unified gateway helper.