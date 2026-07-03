# 0005: Transport Shell Decoupling & Pure Logic Extraction

## Status
Accepted (2026-07-02)

## Context
As the V2 Micro-Kernel expands, placing heavy transactional and file-system manipulation logic directly inside Flask REST route decorators (`routes_fs.py`, `routes_bridge.py`) led to "Fat Controllers". This entangled our execution loops with ASGI frameworks, complicated programmatic invocation by internal extensions, and hindered backend async metronome integration.

## Decision
We establish a strict architectural boundary separating HTTP transport shells from pure domain logic. Route controllers are now restricted to:
1. Extracting request parameters and body payloads.
2. Isolating the `X-Workspace-ID` tenant scope natively.
3. Dispatching directly to agnostic execution methods (e.g., `execute_bridge_sync`, `execute_vfs_save`).

## Consequences
* **Positive:** Extensions (like the Kanban Tracker) can now bypass HTTP REST overhead and invoke `execute_vfs_save` natively to commit physical files while retaining full Cartographer lifecycle protection.
* **Positive:** Framework-agnostic pure functions allow direct invocation via background ThreadPool tasks.
* **Negative:** Requires rigorous structural tracking of `workspace_id` parameters passed downward through the entire execution stack to maintain multi-tenant integrity.