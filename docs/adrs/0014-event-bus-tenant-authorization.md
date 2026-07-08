# 0014: Event Bus Tenant Authorization

## Status
Accepted (2026-07-07)

## Context
In a stateless multi-tenant environment, the global Event Bus (`HookRegistry`) was blindly executing callbacks for all registered extensions, regardless of whether the extension was authorized in the active workspace's configuration payload. This created data leakage and authorized unwanted background sweeps when multiple configurations shared a daemon.

## Decision
We implemented a strict `_is_authorized` boundary filter inside `hooks.py`. Before invoking any callback, the Event Bus evaluates the target `workspace_id`, parses the active configuration physics via `utils_core.load_json_file`, and verifies the extension is listed in the `extensions` array. Core modules (`bridge`, `gather`) are structurally whitelisted.

## Consequences
* **Positive:** Complete isolation of background lifecycle events per tenant.
* **Positive:** Prevents disabled extensions from hijacking the VFS pipeline or mutating SQLite databases.
* **Negative:** Introduces an I/O path dependency reading the configuration JSON per event, which is mitigated by our existing `mtime` memory cache.