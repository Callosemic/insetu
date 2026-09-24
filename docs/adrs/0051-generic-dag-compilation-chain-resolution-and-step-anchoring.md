# ADR 0051: Generic Akasa DAG Compilation Chain Resolution, Positional Step Anchoring, and Watchdog Manifest Exclusion

## Status
Accepted (2026-09-23)

## Context
Previously, `engine_gather.py` executed custom topological sorting loops (`visit(step_id)`) over `@hooks.on('register_compilation_steps')` declarations. As additional background compilation steps were introduced (such as Cartographer repository mapping), relying on string-based `depends_on` arrays without explicit positional anchors caused step ordering ambiguity. Furthermore, Cartographer executed as a separate un-chained immediate job triggered by the `compilation_sequence_complete` event, creating event bus fragmentation.

Additionally, native Filesystem Watchdog observers occasionally captured physical modifications to `manifest.json` or case-variant `CODE_INDEX.md` files, triggering redundant `vfs_mutated` events during active context compilation sequences.

## Decision
1. **Generic Akasa DAG Orchestrator (`resolve_dag_chain`)**:
   - Delegated compilation step collection, dependency graph resolution, and topological sorting to Akasa's generic `resolve_dag_chain(ctx, hook_name)` orchestrator.
   - Re-exported `ChainStepSchema`, `ChainStepArtifact`, and `resolve_dag_chain` from `insetu.core.sdk`.
2. **Positional Compilation Step Anchoring**:
   - Standardized step declarations using positional anchors (`source`, `body`, `sink`) and integer order weights:
     - `topology`: `anchor = "source"`, `order = 10`
     - `gather`: `anchor = "body"`, `order = 20`
     - `cartographer`: `anchor = "sink"`, `order = 90`
   - Replaced ad-hoc `compilation_sequence_complete` event hooks with integrated sink step execution inside the DAG chain.
3. **Step-Complete Telemetry & Watchdog Exclusions**:
   - Subscribed `gather.js` to `insetu:compile-step-complete` to rehydrate manifest state incrementally as each step in a chain finishes.
   - Enhanced Watchdog observer logic in `utils_core.py` to perform case-insensitive checks for `CODE_INDEX.md` and exclude `manifest.json`.

## Consequences
* **Positive**: Eradicates custom topological sorting loops in domain extensions and provides deterministic multi-step pipeline execution.
* **Positive**: Integrates post-compilation cartography directly into the DAG chain rather than relying on secondary event hooks.
* **Positive**: Prevents Watchdog event loops during cartography mapping and manifest saves.
* **Negative**: Requires extension step registrations to declare explicit `anchor` and `order` attributes in `register_compilation_steps` payloads.