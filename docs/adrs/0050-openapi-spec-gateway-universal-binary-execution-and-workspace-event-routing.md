# ADR 0050: Real-Time OpenAPI 3.0 Spec Gateway, Universal Binary Execution Wrapper, and Multi-Tenant Lifecycle Event Router

## Status
Accepted (2026-09-23)

## Context
As the inSetu Developer OS expands its REST interface layer and AI tool-calling capabilities, collaborating LLMs require a deterministic, machine-readable route and parameter specification. Relying on static documentation or manual schema declarations risks silent drift between code implementation and tool execution.

Furthermore, executing system binaries (e.g. `node`, `git`) via raw `subprocess.run` calls caused path resolution failures across varied virtual environments, desktop GUI shells (`pywebview`), and systemd user daemons. Additionally, routing VFS mutation events across stateless multi-tenant workspaces required a centralized spatial event router.

## Decision
1. **Real-Time OpenAPI 3.0 Specification Gateway (`/api/system/openapi.json`)**:
   - Implemented an automated spec compiler that inspects registered Akasa SDK blueprints (`route_schemas`).
   - Converts Python `TypedDict` request and response contracts into standard OpenAPI 3.0 JSON Schemas.
   - Distinguishes synchronous (`[sync]`) routes from asynchronous background mutations returning `202 Accepted` job polling schemas.
2. **Universal Binary Execution Wrapper (`execute_binary`)**:
   - Housed `execute_binary()` in `insetu/core/utils_core.py` to resolve system `PATH`, active Python virtual environment directories (`sys.executable`), and module CLI fallbacks.
   - Banned direct `subprocess.run` calls in Tier 2 core engines.
3. **Multi-Tenant Lifecycle Event Router (`resolve_owning_workspaces`)**:
   - Standardized `resolve_owning_workspaces(event_name, **kwargs)` in `engine_topology.py` to map physical VFS target paths across all registered tenant workspace roots.
   - Registered the router with the micro-kernel via `hooks.set_workspace_router()`.

## Consequences
* **Positive**: Provides LLMs with a real-time, zero-drift OpenAPI spec for tool calling.
* **Positive**: Guarantees cross-environment CLI binary resolution across Linux, macOS, desktop GUI shells, and venvs.
* **Positive**: Ensures precise, multi-tenant VFS mutation event isolation without cross-tenant data bleed.
* **Negative**: Requires route handlers to define `TypedDict` schemas and docstrings to participate in OpenAPI spec generation.