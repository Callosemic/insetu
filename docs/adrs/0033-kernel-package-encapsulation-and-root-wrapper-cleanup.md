# ADR 0033: Kernel Package Encapsulation and Root Wrapper Cleanup

## Status
Accepted

## Context
Following ADR 0029, ADR 0030, and ADR 0031, the Three-Tier Architecture separated Tier 1 Kernel utilities, Tier 2 Core OS engines, and Tier 3 Domain Extensions. However, transitional root wrapper files (`utils.py`, `vfs.py`, `db.py`, `hooks.py`, `workers.py`, `auth.py`, `fallback_bridge.py`, `sdk/`, `api.js`, `config.js`, `fs.js`, `sdk.js`, `store.js`) still remained in top-level directories. This allowed circular or un-tiered imports to bypass the tier isolation linter rules.

## Decision
1. **Kernel Package Encapsulation**: Relocate all Tier 1 framework chassis modules into `insetu/kernel/` (`auth.py`, `db.py`, `extension.py`, `fallback_bridge.py`, `hooks.py`, `utils.py`, `vfs.py`, `workers.py`).
2. **Root Wrapper Deprecation**: Delete all legacy top-level wrapper files and directories (`insetu/sdk/`, `insetu/utils.py`, `insetu/vfs.py`, etc.).
3. **Frontend Substrate Alignment**: Consolidate core frontend JS modules strictly inside `insetu/static/js/core/` and vendorized `sutram` primitives.
4. **Linter Enforcement**: Update static analysis rules (`rules_python.py`) to mandate `insetu.kernel.*` and `insetu.core.*` import targets across all modules.

## Consequences
* **Positive**: Complete physical encapsulation of the Tier 1 Kernel package, preventing circular dependency leaks.
* **Positive**: Enables running `insetu` as a standalone, domain-agnostic web application framework.
* **Negative**: Requires strict developer discipline to prevent re-introducing un-tiered root imports.