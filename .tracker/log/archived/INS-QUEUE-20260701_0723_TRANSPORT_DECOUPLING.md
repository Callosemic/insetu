---
repo: "insetu"
type: "todo"
status: "archived"
id: INS-QUEUE-20260701_0723_TRANSPORT_DECOUPLING
title: "Ecosystem Blueprint: Complete Separation of Transport and Logic Layers"
created_at: 2026-07-01T07:23:00
closed_at: 2026-07-02T23:23:49
sub_bucket: "None"
---

## Description
Following the successful isolation of the Virtual File System write-path (`execute_vfs_save`) in `routes_fs.py`  and its clean invocation inside `engine_tracker.py` , this ticket outlines the comprehensive blueprint to scale this decoupling pattern across the remaining platform architecture. 

The core objective is to ensure all web-routing controllers function purely as shallow HTTP transport shells, mapping request variables and tenant keys extracted via `sniff_tenant_id()`  to framework-agnostic internal engine functions. This layout prevents framework boundary escapes , eliminates the need for test request-context spoofing, and unblocks asynchronous multi-tenant task execution across background metronome threads.

## Action Items
* **Refactor File System Substrates (`routes_fs.py`):**
    * Extract the remaining file manipulation endpoints (`/api/fs/move`, `/api/fs/archive`, `/api/fs/delete`) into standalone Python operations (`execute_vfs_move`, `execute_vfs_archive`, `execute_vfs_delete`).
    * Ensure all worker functions accept explicit data payloads alongside a validated `workspace_id`.
* **Refactor the Yomama Sync Loop (`routes_bridge.py`):**
    * Relocate the transaction processing loop, path-healers, and validation sequences out of the route handler into a centralized `execute_bridge_sync` method inside `engine_bridge.py`.
    * Reduce `/api/bridge/sync` to a transport shell that returns the string payload output of the transactional execution.

    ## Notes / Execution Log
    * **Resolution (2026-07-02):** The comprehensive architectural blueprint for isolating HTTP transport structures from execution engines is functionally complete across the core file system and bridge layers. Route decorators no longer trap business logic.

    * **Decouple System Engine Routines (`routes_system.py`):**
    * Separate configuration disk writes and tenant lookups out of Flask request wrappers to allow internal extensions to read and alter configurations natively.
* **Standardize Extension Interfaces (`engine_git.py`, `engine_research.py`, `engine_citations.py`):**
    * Clean up cross-extension logic boundaries. For example, have `engine_research.py` trigger library imports by passing payloads natively to `engine_citations.py` functions instead of programmatically simulating endpoint posts.