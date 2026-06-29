# ADR 0002: Spatial Physics & Extension Architecture

## Status
Accepted

## Context
The transition to a V2 Micro-Kernel necessitated a clean separation between the OS orchestrator and domain-specific capabilities. Furthermore, the legacy `.insetu/profiles/` subdirectory pattern created unnecessary depth and spatial complexity when hot-swapping workspaces. 

## Decision
1. **Flatter Workspace Physics:** We have refactored `utils_core.py` to anchor execution to `[CWD]/.insetu/config.json` via a global switchboard (`workspaces.json`). This ensures the OS can be dropped into any repository and map its surroundings reliably.
2. **The Extension API Contract:** All non-core domains (Citations, Research, Git, Tracker) are now officially classified as Extensions. They must load dynamically via `load_workspace_extensions()`, bind to UI zones via `ExtensionRegistry`, and maintain isolated SQLite instances for data containment.

## Consequences
* **Positive:** The core orchestrator (`app.py`, `engine_bridge.py`, `engine_gather.py`) remains pristine and isolated from domain edge cases.
* **Negative:** Extensions now require stricter lifecycle management (Event Bus hooks) to ensure they respect ASGI event loops and SQLite WAL constraints without relying on the core daemon.