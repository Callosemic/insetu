---
repo: "insetu"
type: "todo"
status: "active"
id: "INS-QUEUE-20260710_1306_SDK_MIGRATION_TRACKER"
title: "SDK V2 Migration: Kanban Tracker Extension"
created_at: "2026-07-10T13:06:00"
closed_at: "2026-07-13T01:22:12"
sub_bucket: "None"
delivery_date: "2026-07-26"
tags: ["Architecture", "SDK", "Refactor"]
---

## Description
Migrate the Project Kanban Tracker module to the SDK V2 architecture to ensure strict UDF compliance and tenant isolation.

### Action Items
- [x] **Backend (`engine_tracker.py`)**: Replace the raw Flask Blueprint with `InSetuExtension`. Pass `schema=...` to automatically handle SQLite migrations. Update route decorators to use the `ctx` context object. Replace raw VFS logic with `ctx.vfs`.
- [x] **Frontend (`ext_tracker.js`)**: Refactor the component to extend `InSetuElement`. Replace manual Zustand store listeners with `this.subscribe()`.
- [x] **API Client**: Ensure all network calls utilize the encapsulated `this.api.post()` and `this.api.get()` methods instead of raw global fetches.

## Resolution
Successfully migrated. Replaced the custom settings modal logic with a declarative `settings_schema` injected into the backend constructor, allowing native OS adoption of tracker configurations.