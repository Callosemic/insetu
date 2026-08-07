---
repo: "insetu"
type: "todo"
status: "open"
id: "INS-TODO-20260807_1142_MIGRATE_API_POST"
title: "Migrate extension API calls to consume window.inSetu.api.post shorthand"
created_at: null
closed_at: null
sub_bucket: "None"
delivery_date: "2026-08-23"
tags: ["SDK", "Refactor", "API", "Extensions"]
---

## Description
Following the addition of the `window.inSetu.api.post(path, payload, options)` shorthand method in the Client SDK API Gateway (`api.js`), audit and refactor active frontend extensions to consume this helper instead of constructing manual `this.api.workspace(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })` blocks.

### Action Items
- [ ] Audit active extension modules (`ext_tracker.js`, `ext_citations.js`, `ext_research.js`, `ext_git.js`, `ext_notes.js`, `ext_flow.js`, `ext_skills.js`, `ext_freshdesk.js`, `ext_hooks.js`, `ext_prompts.js`) for manual JSON `POST` requests.
- [ ] Replace explicit `JSON.stringify()` payload serialization and `method: 'POST'` options with `this.api.post()` / `window.inSetu.api.post()`.
- [ ] Verify that job polling receipts, `requires_refresh` soft-reloads, and client-side active extension enablement checks function properly under the unified gateway helper.