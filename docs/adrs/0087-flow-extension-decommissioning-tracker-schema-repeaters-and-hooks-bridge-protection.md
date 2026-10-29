# ADR 0087: Flow Extension Decommissioning, Tracker Settings Repeater Migration, and Hooks Bridge Path Protection

## Status
Accepted (2026-10-28)

## Context
As the inSetu Developer OS finalized its sovereign routine architecture and declarative configuration hub, several architectural elements required consolidation:
1. **Flow Extension Redundancy**: With the introduction of Markdown-as-Code Agent Routines (`ctx://routines/`, `orchestrator.py`, ADR 0083), topological DAG wavefront compilation, and agent-driven turn execution, the legacy `flow` extension (`engine_flow.py`, `ext_flow.js`) became entirely redundant. Routine workflows in `ctx://routines/` provide Git-friendly, sovereign DAG authoring with parallel wavefront fan-out and colon-scoped command dispatch, superseding the bespoke JSON-based batch configurations in `flow`.
2. **Bespoke Tracker Settings Forms**: While ADR 0085 introduced `<insetu-schema-repeater>` for dynamic array settings, `InSetuExtTrackerSettings` in `ext_tracker.js` still implemented bespoke, imperative management for custom Kanban schemas (`kanban_profiles`), parent navigation tabs (`parent_tabs`), and sub-tab view filters (`global_views`). In `engine_tracker.py`, these three settings fields were flagged as `"type": "hidden"`, bypassing Settings Hub schema inspection and forcing custom modal forms.
3. **Automation Hook Control-Plane Vulnerability**: Automation hooks (`engine_hooks.py`) execute local shell commands based on rules in `.insetu/hooks/`, `.insetu-data/hooks/`, or `rules.json`. While runtime execution requires cryptographic approval signatures in `host.json`, incoming LLM patch payloads from the Yomama Sync Bridge could theoretically mutate rule files without warning. Hooks required registration with the Bridge's protected control-plane paths.

## Decision
1. **Flow Extension Decommissioning (`engine_flow.py`, `ext_flow.js`)**:
   - Formally deleted `insetu/extensions/flow/engine_flow.py` and `ext_flow.js`.
   - All workflow batch compilation, prompt staging, and multi-file context bundling are now completely consolidated under Tier 2 Core Substrate `insetu/core/agent/orchestrator.py` via sovereign Markdown routines in `ctx://routines/`.
2. **Tracker Settings Schema Repeater Migration (`engine_tracker.py`, `ext_tracker.js`)**:
   - Upgraded `parent_tabs`, `global_views`, and `kanban_profiles` in `TRACKER_SETTINGS_SCHEMA` from `"type": "hidden"` to first-class `"type": "repeater"` settings schemas with `min_items`, `max_items`, `item_label`, and explicit `item_schema` definitions.
   - Refactored `InSetuExtTrackerSettings` to consume `<insetu-schema-repeater>` for custom Kanban profiles, parent navigation tabs, and global views.
   - Integrated custom repeater field renderers (`custom_render`) for explicit repository toggles and interactive type/status filter toggles.
   - Standardized `saveSettings()` to sanitize view tier representations and strip ephemeral client IDs (`_uuid`).
3. **Protected Bridge Control-Plane Paths (`engine_hooks.py`)**:
   - Registered `@hooks_bp.on('register_protected_bridge_paths')` returning `[".insetu/hooks/", ".insetu-data/hooks/", "rules.json"]`, ensuring the Yomama Sync Bridge protects automation rule configurations from unauthorized patch overwrites.

## Consequences
* **Positive**: Eradication of legacy flow extension codebase in favor of sovereign agent routine DAGs.
* **Positive**: Declarative UI consistency across Tracker settings with zero bespoke array management boilerplate.
* **Positive**: Cryptographic and control-plane protection for Automation Hook rule files against unauthorized bridge modifications.
* **Positive**: 100% compliance with static architectural fitness linters and UDF presentation standards.