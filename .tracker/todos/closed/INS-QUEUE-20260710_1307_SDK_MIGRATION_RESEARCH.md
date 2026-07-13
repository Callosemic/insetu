---
repo: "insetu"
type: "todo"
status: "closed"
id: INS-QUEUE-20260710_1307_SDK_MIGRATION_RESEARCH
title: "SDK V2 Migration: Research Inbox Extension"
created_at: 2026-07-10T13:07:00
closed_at: 2026-07-13T01:22:12
sub_bucket: "None"
tags: ["Architecture", "SDK", "Refactor"]
---

## Description
Migrate the Research Triage Inbox module to the SDK V2 architecture to ensure strict UDF compliance and tenant isolation.

### Action Items
- [x] **Backend (`engine_research.py`)**: Replace the raw Flask Blueprint with `InSetuExtension`. Update route decorators to use the `ctx` context object. Replace raw database calls with `ctx.db`.
- [x] **Frontend (`ext_research.js`)**: Refactor the component to extend `InSetuElement`. Replace manual Zustand store listeners with `this.subscribe()`.
- [x] **API Client**: Ensure all network calls utilize the encapsulated `this.api.post()` and `this.api.get()` methods.

## Resolution
Migrated successfully. Centralized the API keys via `settings_schema` (Serper.dev), safely resolving `INS-TODO-20260703_1300_TIER2_CONFIG_EDITOR`.