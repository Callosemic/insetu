---
repo: "insetu"
type: "todo"
status: "logged"
id: INS-QUEUE-20260710_1312_SDK_MIGRATION_TERM
title: "SDK V2 Migration: Terminal Extension"
created_at: 2026-07-10T13:12:00
closed_at: 2026-07-13T13:14:00
sub_bucket: "None"
tags: ["Architecture", "SDK", "Refactor"]
---

## Description
Migrate the Embedded Terminal multiplexer module to the SDK V2 architecture to ensure strict UDF compliance and tenant isolation.

### Action Items
- [x] **Backend (`engine_term.py`)**: Replace the raw Flask Blueprint with `InSetuExtension`. Update route decorators to use the `ctx` context object.
- [x] **Frontend (`ext_term.js`)**: Refactor the component to extend `InSetuElement`. Replace manual Zustand store listeners with `this.subscribe()`.
- [x] **API Client**: Ensure all network calls utilize the encapsulated `this.api.post()` and `this.api.get()` methods.

## Notes / Execution Log
- **2026-07-13**: Fully completed backend orchestration engine with isolated multi-tenant socket probing, process group lifecycle hooks, and frontend InSetuElement store unification. Passed full static analysis.