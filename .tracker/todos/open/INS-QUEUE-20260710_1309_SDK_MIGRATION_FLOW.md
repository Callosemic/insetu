---
repo: "insetu"
type: "todo"
status: "open"
id: INS-QUEUE-20260710_1309_SDK_MIGRATION_FLOW
title: "SDK V2 Migration: Flow / Batch Extension"
created_at: 2026-07-10T13:09:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-07-26"
tags: ["Architecture", "SDK", "Refactor"]
---

## Description
Migrate the Flow/Batch workflow compiler module to the SDK V2 architecture to ensure strict UDF compliance and tenant isolation.

### Action Items
- [ ] **Backend (`engine_flow.py`)**: Replace the raw Flask Blueprint with `InSetuExtension`. Update route decorators to use the `ctx` context object.
- [ ] **Frontend (`ext_flow.js`)**: Refactor the component to extend `InSetuElement`. Replace manual Zustand store listeners with `this.subscribe()`.
- [ ] **API Client**: Ensure all network calls utilize the encapsulated `this.api.post()` and `this.api.get()` methods.

## Notes / Execution Log