# ADR 0030: Kernel Utility Bisect and Domain Helper Relocation

## Status
Accepted (2026-07-28)

## Context
Following the adoption of the Three-Tier Architecture (ADR 0029) and the Kernel Encapsulation Blueprint, `insetu/utils_core.py` served as a monolithic utility file containing both domain-agnostic framework operations (e.g., physical path resolution, JSON serialization, idempotency hashing) and Developer OS domain physics (e.g., cartography tree generation, RAG context filtering, frontmatter parsing).

This coupling caused Tier 1 Kernel components to depend on Tier 2 Developer OS physics, violating the "Acid Test" for true Kernel isolation. Furthermore, domain helpers like `getFlattenedBuckets` were exported directly from the bootloader `app.js` rather than residing within their respective domain modules.

## Decision
1. **Utility Bisect:**
   - Split `utils_core.py` into Tier 1 Kernel utilities (`insetu/utils.py`) and Tier 2 Developer OS utilities (`insetu/core/utils_core.py`).
   - `insetu/utils.py` retains pure framework methods (`get_workspace_physics`, `load_config`, `slugify`, `load_json_file`, `save_json_file`, `generate_idempotency_hash`).
   - `insetu/core/utils_core.py` houses Developer OS physics (`get_valid_workspace_files`, `get_available_contexts`, `build_tree_dict`, `generate_ascii_tree`, `get_omniscient_workspace_files`, `resolve_logical_path`).
2. **Domain Helper Relocation:**
   - Relocated `getFlattenedBuckets` and selection payload packing (`packSelectionPayload`) out of `app.js` and into `insetu/static/js/core/gather.js`.
3. **Automated Kernel Isolation:**
   - Added a static fitness function (`KERNEL_TIER_ISOLATION_MANDATE`) to prevent Tier 1 Kernel files from importing from Tier 2 `insetu.core` modules.

## Consequences
* **Positive:** Achieves clean physical separation between Tier 1 framework and Tier 2 Developer OS logic.
* **Positive:** Tier 1 Kernel can boot and operate completely independently of Developer OS engines.
* **Negative:** Requires strict import path discipline across Tier 2 engines and Tier 3 extensions.