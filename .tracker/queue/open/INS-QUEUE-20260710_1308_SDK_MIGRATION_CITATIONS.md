---
repo: "insetu"
type: "queue"
status: "open"
id: INS-QUEUE-20260710_1308_SDK_MIGRATION_CITATIONS
title: "SDK V2 Migration: Citations Extension"
created_at: 2026-07-10T13:08:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-07-26"
tags: ["Architecture", "SDK", "Refactor"]
---

## Description
Migrate the Citations and Reference Manager module to the SDK V2 architecture to ensure strict UDF compliance and tenant isolation.

### Action Items
- [ ] **Backend (`engine_citations.py`)**: Replace the raw Flask Blueprint with `InSetuExtension`. Register its SQLite schemas directly via the class constructor. Update route decorators to use the `ctx` context object.
- [ ] **Frontend (`ext_citations.js`)**: Refactor the component to extend `InSetuElement`. Replace manual Zustand store listeners with `this.subscribe()`.
- [ ] **API Client**: Ensure all network calls utilize the encapsulated `this.api.post()` and `this.api.get()` methods.

## Notes / Execution Log