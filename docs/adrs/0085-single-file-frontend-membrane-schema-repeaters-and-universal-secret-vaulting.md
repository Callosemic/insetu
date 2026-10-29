# ADR 0085: Single-File Frontend Membrane Isolation, Declarative Schema Repeaters, and Universal Repeater Secret Vaulting

## Status
Accepted (2026-10-28)

## Context
As the inSetu Developer OS finalized its multi-ring presentation architecture and unified configuration hub, several structural boundaries required formalization:
1. **Frontend Presentation Membrane Bleed**: Core UI modules (`config.js`, `fs.js`, `offline_ui.js`, `api.js`, `ui_editor.js`, `ui_file_tree.js`, `ui_filter_pills.js`, `ui_primitives.js`, `ui_system_settings.js`, `store.js`, `system.js`) directly imported from `/static/vendor/sutram/*`, `../../vendor/sutram/*`, and `/static/vendor/yenvui/*`. This bypassed the single-file frontend membrane (`insetu_sdk.js`), duplicating import specifiers and complicating offline vendorization.
2. **Bespoke Repeater Form Rendering**: Array-of-objects configuration settings (such as sub-buckets in `config.js`, virtual mounts in `ui_system_settings.js`, and LLM compute endpoint pools in `engine_llm.py`) relied on custom collapsible rendering loops, duplicating item addition, reordering, validation, and deletion logic across files.
3. **Repeater Credential Plaintext Exposure**: When array settings contained sensitive credentials (such as API keys in `compute_endpoints`), the settings manager lacked automated secret extraction, risking credentials persisting in plaintext inside `host.json` or `workspace.settings.json`.
4. **Backend Membrane Lazy Resolution**: In `insetu/core/sdk/__init__.py`, importing `InSetuURI` and YAML utilities directly from `utils_core.py` created circular import hazards when `utils_core.py` was evaluated first during fresh interpreter startups.

## Decision
1. **Single-File Frontend Membrane Isolation (`SUTRAM_MEMBRANE_ISOLATION`)**:
   - Enforced that only `insetu/core/system/insetu_sdk.js` may import from `'sutram'`, `'sutram-chassis'`, or `/static/vendor/sutram/*`.
   - Re-exported all required Tier 0 presentation primitives, stores, and utilities from `insetu_sdk.js`.
   - Refactored all core and extension UI modules to import presentation primitives and styles exclusively through `/static/extensions/system/insetu_sdk.js`.
2. **Declarative Schema Repeater (`<insetu-schema-repeater>`)**:
   - Built `<insetu-schema-repeater>` (`InSetuSchemaRepeater` in `ui_system_settings.js`) supporting `type: "repeater"` settings schemas with bounds validation (`min_items`, `max_items`), reordering controls (`chevron-up`, `chevron-down`), add/remove operations, conditional field visibility (`show_if`), nested `record` schemas, and datalist suggestions.
   - Refactored sub-bucket configuration in `config.js` (`renderSubBuckets`) and virtual mounts in `ui_system_settings.js` (`_renderMountsDrillDown`) to consume `<insetu-schema-repeater>`.
3. **Universal Repeater Secret Vaulting**:
   - Implemented `vault_repeater_secrets_for_schema()` in `engine_system.py`, automatically scanning repeater schemas for subfields declaring `secure: True`.
   - Plaintext secrets are extracted into `.insetu/secrets.json` under `secrets[ext_name][f"{repeater_id}__{item_id}__{subfield_id}"]` and masked with `'********'` in configuration files.
4. **Template Overlay VFS Driver & Backend Membrane Consolidation**:
   - Implemented `TemplateOverlayVFSDriver` in `insetu/core/sdk/__init__.py` for the 3-Tier Same-Name Override Cascade, and added `module_subdir` support to `InSetuExtension(volumes={...})`.
   - Added PEP 562 lazy `__getattr__` in `sdk/__init__.py` for `_UTILS_CORE_REEXPORTS`, eliminating circular import hazards.
   - Refactored `utils_core.py` to import exclusively from `insetu.core.sdk`, strictly fulfilling `AKASA_MEMBRANE_ISOLATION`.

## Consequences
* **Positive**: Absolute membrane boundary isolation across both backend Python (`insetu.core.sdk`) and frontend JavaScript (`insetu_sdk.js`).
* **Positive**: Declarative, unified repeater form rendering eliminating bespoke array management boilerplate.
* **Positive**: Zero plaintext credential persistence for array-based configuration schemas.
* **Positive**: 100% adherence to static architectural fitness linters across Python backend and JavaScript frontend.
