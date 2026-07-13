---
repo: "insetu"
type: "todo"
status: "active"
id: "INS-QUEUE-20260710_1311_SDK_MIGRATION_SKILLS"
title: "SDK V2 Migration: Skills Extension"
created_at: "2026-07-10T13:11:00"
closed_at: "2026-07-13T01:22:12"
sub_bucket: "None"
delivery_date: "2026-07-26"
tags: ["Architecture", "SDK", "Refactor"]
---

## Description
Migrate the Spaced Repetition Skills module to the SDK V2 architecture to ensure strict UDF compliance and tenant isolation.

### Action Items
- [x] **Backend (`engine_skills.py`)**: Replace the raw Flask Blueprint with `InSetuExtension`. Update route decorators to use the `ctx` context object. Replace raw database calls with `ctx.db`.
- [x] **Frontend (`ext_skills.js`)**: Refactor the component to extend `InSetuElement`. Replace manual Zustand store listeners with `this.subscribe()`.
- [x] **API Client**: Ensure all network calls utilize the encapsulated `this.api.post()` and `this.api.get()` methods.

## Resolution
Completed migration. Scrapped the proprietary configuration modal UI elements entirely in favor of natively defined `settings_schema` bindings.