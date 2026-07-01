---
id: INS-QUEUE-20260701_1136
title: "Standardize Extension Input Debouncing and Silent File Verification"
created_at: 2026-07-01T11:36:00
closed_at: null
sub_bucket: "None"
tags: [frontend, architecture, extensions, performance, standardization]
---

## Description
Multiple interactive user text inputs across the extension ecosystem (such as patch targets in the Yomama bridge, citation path markers, and deep markdown link lookups) lack an abstract verification layer. This creates duplicate network requests or floods the browser console with uncatchable 404 response errors when typing. 

## Action Items
- [ ] **Expose Shared Frontend Utilities:** Append a centralized utility namespace to `window.ExtensionRegistry` inside `app.js` (e.g., `window.ExtensionRegistry.utils = {}`).
- [ ] **Build the Debounce Wrapper:** Implement a reusable framework method:
  `debounceVerifyFile(workspaceId, filepath, callback, delay = 300)`
  This helper must manage its own internal timer pools to cleanly throttle network invocations during active typing runs.
- [ ] **Integrate the Silent Check Endpoint:** Ensure the core utility routes its request context exclusively through the non-disruptive `/api/<workspace_id>/fs/exists` status envelope.
- [ ] **Refactor Core Extensions:** Sweep `bridge.js`, `ext_citations.js`, and `fs.js` to strip out custom event listeners or manual timeout thresholds, routing all type-ahead lookups through the master registry helper.