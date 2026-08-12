---
repo: "insetu"
type: "todo"
status: "archived"
id: INS-QUEUE-20260710_1305_SDK_MIGRATION_GIT
title: "SDK V2 Migration: Git Extension"
created_at: 2026-07-10T13:05:00
closed_at: 2026-07-13T01:22:12
sub_bucket: "None"
tags: ["Architecture", "SDK", "Refactor"]
---

## Description
Migrate the Git operations module to the SDK V2 architecture to ensure strict UDF compliance and tenant isolation.

### Action Items
- [x] **Backend (`engine_git.py`)**: Replace the raw Flask Blueprint with `InSetuExtension`. Update route decorators to use the `ctx` context object. Replace raw file operations and database calls with `ctx.vfs` and `ctx.db`.
- [x] **Frontend (`ext_git.js`)**: Refactor the component to extend `InSetuElement`. Replace manual Zustand store listeners with `this.subscribe()` to guarantee proper teardown on unmount.
- [x] **API Client**: Ensure all network calls utilize the encapsulated `this.api.post()` and `this.api.get()` methods instead of raw global fetches.

## Resolution
Successfully migrated. Sweeper modal was consolidated directly into the main diff screen UI, eliminating redundant elements. Implemented SDK components end-to-end to manage subscriptions and tenant routing securely.