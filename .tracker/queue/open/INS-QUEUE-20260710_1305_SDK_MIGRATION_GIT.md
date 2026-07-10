---
repo: "insetu"
type: "queue"
status: "open"
id: INS-QUEUE-20260710_1305_SDK_MIGRATION_GIT
title: "SDK V2 Migration: Git Extension"
created_at: 2026-07-10T13:05:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-07-26"
tags: ["Architecture", "SDK", "Refactor"]
---

## Description
Migrate the Git operations module to the SDK V2 architecture to ensure strict UDF compliance and tenant isolation.

### Action Items
- [ ] **Backend (`engine_git.py`)**: Replace the raw Flask Blueprint with `InSetuExtension`. Update route decorators to use the `ctx` context object. Replace raw file operations and database calls with `ctx.vfs` and `ctx.db`.
- [ ] **Frontend (`ext_git.js`)**: Refactor the component to extend `InSetuElement`. Replace manual Zustand store listeners with `this.subscribe()` to guarantee proper teardown on unmount.
- [ ] **API Client**: Ensure all network calls utilize the encapsulated `this.api.post()` and `this.api.get()` methods instead of raw global fetches.

## Notes / Execution Log