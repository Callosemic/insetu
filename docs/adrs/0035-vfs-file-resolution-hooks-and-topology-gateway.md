# ADR 0035: VFS File Resolution Event Bus Hooks, Search Decoupling, and System Topology Gateway

## Status
Accepted

## Context
Previously, file path resolution for system artifacts (`ctx://contexts/...`) and deep workspace Markdown searching were handled via hardcoded methods in `utils_core.py` (`get_gather_paths`, `search_workspace_files`) and explicit conditional branches in `routes_fs.py`. This tightly coupled Tier 2 core utilities to specific Gather artifact folder structures and restricted custom extensions from registering custom virtual URI schemes.

Furthermore, client applications lacked explicit system-level REST endpoints to query target repository topologies and system manifest states directly.

## Decision
1. **Decoupled VFS File Resolution (`vfs_resolve_file`)**:
   - Replaced hardcoded `ctx://` URI checks in `routes_fs.py` with an event broadcast: `hooks.emit('vfs_resolve_file', filename=..., workspace_id=...)`.
   - Registered `@hooks.on('vfs_resolve_file')` handler `resolve_gather_artifacts` in `engine_gather.py` to resolve `contexts` and `workflows` artifact directories dynamically.
2. **Decoupled Search Hook (`vfs_search`)**:
   - Deprecated `search_workspace_files()` in `utils_core.py`.
   - Refactored `api_fs_search` in `routes_fs.py` to dispatch to `@hooks.on('vfs_search')` hook listeners in `engine_gather.py`.
3. **Bridge Ledger Schema Isolation**:
   - Declared `BRIDGE_SCHEMA` (`bridge_ledger` table) in `engine_bridge.py` via `InSetuExtension` declarative schema options.
4. **System Topology & Manifest Endpoints**:
   - Exposed `/api/system/topology` and `/api/system/manifest` endpoints in `routes_system.py`.

## Consequences
* **Positive**: Complete decoupling of Gather artifact directory physics from core utilities and file routes.
* **Positive**: Enables extensions to register custom virtual URI schemas (e.g., `notes://`, `cite://`) natively via the `vfs_resolve_file` event hook.
* **Positive**: Provides explicit REST gateway endpoints for frontend topology and manifest rehydration.