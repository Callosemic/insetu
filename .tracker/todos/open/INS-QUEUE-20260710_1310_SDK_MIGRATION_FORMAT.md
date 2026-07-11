---
repo: "insetu"
type: "todo"
status: "open"
id: INS-QUEUE-20260710_1310_SDK_MIGRATION_FORMAT
title: "SDK V2 Migration: Format Extension"
created_at: 2026-07-10T13:10:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-07-26"
tags: ["Architecture", "SDK", "Refactor"]
---

## Description
Migrate the Document Formatter (Pandoc) module to the SDK V2 architecture to ensure strict UDF compliance and tenant isolation.

### Action Items
- [ ] **Backend (`engine_format.py`)**: Replace the raw Flask Blueprint with `InSetuExtension`. Update route decorators to use the `ctx` context object.
- [ ] **Frontend (`ext_format.js`)**: Refactor the component to extend `InSetuElement`.
- [ ] **API Client**: Ensure all network calls utilize the encapsulated `this.api.post()` and `this.api.get()` methods.

## Notes / Execution Log