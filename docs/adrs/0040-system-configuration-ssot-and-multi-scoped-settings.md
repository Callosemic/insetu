# ADR 0040: System Configuration SSOT and Multi-Scoped Settings

## Status
Accepted

## Context
Previously, system routing indexes and daemon configurations were stored in `.insetu/workspaces.json`. As inSetu expanded to support daemon-wide preferences (e.g. server port, watchdog flags, extension preloading) alongside tenant workspace lists and repository-level overrides, storing all preferences in a single un-scoped configuration file created scope ambiguity and data coupling.

## Decision
1. **System Index Migration (`system.json`)**:
   - Replaced `.insetu/workspaces.json` with `.insetu/system.json` as the Single Source of Truth (SSOT) for daemon-level settings (`port`, `enable_watchdog`, `preload_all_extensions`) and the workspace routing index (`workspaces`).
   - Implemented automatic backward-compatibility migration in `SettingsManager._migrate_workspaces_to_system()`.
2. **Multi-Scoped Settings (`SettingsManager`)**:
   - Enhanced `SettingsManager` to support explicit setting scopes:
     - `daemon`: Vaulted in `.insetu/system.json` for server-wide preferences.
     - `workspace`: Vaulted in tenant `workspace.settings.json`.
     - `repo`: Vaulted in tenant `repo.settings.json` for per-repository configurations.
     - `secure`: Vaulted in tenant `secrets.json` with Fernet encryption.
   - Updated extension settings API endpoints to accept optional `repo` scope parameters.
3. **Stateless Async Job Safety & Navigation Persistence**:
   - Wrapped `pollJob` in frontend `app.js` to statelessly swallow callbacks if the active tenant workspace switches mid-flight.
   - Persisted active primary and sub-tab routes per workspace in `localStorage` to restore layout state deterministically during workspace swaps.

## Consequences
* **Positive**: Clean separation between daemon-level, workspace-level, and repository-level settings.
* **Positive**: Absolute data isolation during cross-tenant workspace swaps.
* **Negative**: Requires extension settings schemas to explicitly declare setting scopes when targeting non-workspace settings.