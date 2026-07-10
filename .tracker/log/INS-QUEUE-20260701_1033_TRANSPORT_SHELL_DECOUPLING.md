---
repo: "insetu"
type: "todo"
status: "logged"
id: INS-QUEUE-20260701_1033_TRANSPORT_SHELL_DECOUPLING
title: "Decouple REST Routes into Shallow HTTP Transport Shells"
created_at: 2026-07-01T10:33:00
closed_at: 2026-07-02T23:23:49
sub_bucket: "None"
---

## Description
The REST API controllers are heavily entangled with logical parsing passes and file-system manipulation algorithms. Route files like `routes_fs.py` and `routes_bridge.py` are acting as fat controllers instead of clean, shallow transport shells. This increases framework lock-in, hardens test context mocking, and blocks fluid multi-tenant execution over asynchronous background metronome layers.

## Action Items
- [ ] Refactor `routes_fs.py` to extract the underlying file behaviors (`/api/fs/move`, `/api/fs/archive`, `/api/fs/delete`) into framework-agnostic internal operations inside core file managers.
- [ ] Relocate the Yomama sync loop sequence, context path-healers, and AST syntax validation checks entirely out of `routes_bridge.py` into a dedicated `execute_bridge_sync` method within `engine_bridge.py`.
- [x] Ensure that route controllers only manage request extraction, payload mapping, and direct tenant scoping passes before handing execution off to domain engines.

## Notes / Execution Log
* **Resolution (2026-07-02):** Successfully isolated operational logic from HTTP controllers. File behaviors have been extracted to framework-agnostic `execute_vfs_*` internals. Bridge transactions are now centralized seamlessly into `execute_bridge_sync`. Controllers function strictly as shallow I/O transport layers mapping tenant identities.