---
repo: "insetu"
type: "todo"
status: "open"
id: INS-TODO-20260709_2219_EXTENSION_SDK
title: "Phase 7: The Extension SDK & 'Pit of Success' Architecture"
created_at: 2026-07-09T22:19:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-07-26"
tags: ["Architecture", "DX", "SDK"]
---

## Description
To radically simplify extension development by providing an SDK that natively abstracts multi-tenant routing, state teardowns, and VFS boundaries. The easiest way to write an extension must inherently be the most compliant way.

### Action Items
- [ ] Scaffold the `insetu/sdk/` directory to house these abstractions.
- [ ] Build the `InSetuElement` Lit wrapper and `createExtensionStore` factory in `app.js`.
- [ ] Build the `Extension` Flask wrapper and migrate one plugin (e.g., `favorites`) to test the new DX.

## Notes / Execution Log