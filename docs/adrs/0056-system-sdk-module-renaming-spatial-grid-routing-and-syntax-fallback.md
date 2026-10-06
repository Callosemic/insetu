# ADR 0056: System SDK Module Renaming, Spatial Grid Routing, and Tree-Sitter Syntax Fallback

## Status
Accepted (2026-10-05)

## Context
As the frontend chassis integrated deeply with vendorized Sutram presentation primitives, the root system SDK file name (`sdk.js`) created path ambiguity with external and vendor SDK files. Furthermore, text buffer view routing was duplicated inline across multiple file actions in `fs.js`, and Tree-Sitter syntax checks in the Yomama Sync Bridge raised false-positive syntax errors when parsing complex Lit template literals in JS/TS files.

## Decision
1. **System SDK Module Renaming (`insetu_sdk.js`)**:
   - Renamed `/static/extensions/system/sdk.js` to `/static/extensions/system/insetu_sdk.js`.
   - Updated import specifiers across all core substrate modules and documentation files.
2. **Spatial Grid Routing Helper (`routeToSpatialGrid`)**:
   - Extracted `routeToSpatialGrid(filepath, label)` in `fs.js` as the Single Source of Truth (SSOT) for opening, focusing, or pinning text buffer projections into spatial viewport columns (`Sutram.stores.Layout`).
   - Added `tabBrowsePaths` persistence per sub-tab to `AppStore` state (`localSync: ['pinnedRepos', 'tabBrowsePaths']`).
3. **Zen Focus Mode Integration**:
   - Added distraction-free Zen Focus Mode (`_toggleZenMode`, `zen-mode` attribute, HTML Fullscreen API toggle, and floating exit button) to `InSetuEditorProjection` (`fs.js`) and `InSetuFrontmatterEditor` (`ui_editor.js`).
4. **Tree-Sitter Template Literal Syntax Fallback (`bridge_vfs.py`)**:
   - Added `node --input-type=module -c` execution verification when Tree-Sitter flags root node syntax errors on JS/TS/MJS files, preventing false syntax rejections on valid Lit template literals.

## Consequences
* **Positive**: Eradicates module name ambiguity in import maps.
* **Positive**: Centralizes spatial viewport column pinning logic into a single reusable helper.
* **Positive**: Eliminates false-positive syntax rejections during Yomama Sync Bridge patch validation.