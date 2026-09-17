# ADR 0048: Akasa Kernel Framework Extraction and InSetuURI Domain Wrapper

## Status
Accepted

## Context
Following the Three-Tier Architecture model (ADR 0029) and Kernel Package Encapsulation (ADR 0033), Tier 1 framework modules (`db`, `vfs`, `workers`, `hooks`, `auth`, `extension`, `uri`, `utils`) were extracted into the standalone `akasa` framework package. 

However, Tier 2 core substrate modules in `insetu/core/` still contained legacy imports targeting `insetu.kernel.*`. Additionally, logical URI scheme parsing (`vfs://` vs `ctx://`), repository volume extraction, and sub-bucket resolution were duplicated across `engine_bridge.py`, `engine_topology.py`, and `engine_gather.py` using fragile string splitting.

## Decision
1. **Akasa Framework Package Adoption**: Refactor all Tier 2 core substrate modules (`bridge`, `cartographer`, `editor`, `fs`, `gather`, `sdk`, `system`, `topology`, `utils_core`) to import Tier 1 framework primitives directly from `akasa.*`.
2. **`InSetuURI` Domain Wrapper (`utils_core.py`)**: Introduce `InSetuURI` subclassing `AkasaURI`. InSetuURI injects domain-specific aliases (`.repo`, `.is_diff`, `.bucket()`) and standardizes logical URI parsing across all backend engines.
3. **Core Utility Centralization**: Relocate Yomama block parsing (`parse_blocks`, `_get_base_step_and_diffs`) and macro expansion (`resolve_macro_includes`) into `insetu/core/utils_core.py`.

## Consequences
* **Positive**: Complete physical decoupling of the agnostic Tier 1 `akasa` framework from the Tier 2 `insetu` Developer OS.
* **Positive**: Unified, object-oriented URI scheme evaluation across all VFS and Gather compilation engines.
* **Negative**: Requires all Tier 3 domain extensions to update import targets from `insetu.kernel.*` to `akasa.*`.