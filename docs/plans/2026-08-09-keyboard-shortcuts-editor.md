---
title: "Blueprint: Native Keyboard Shortcuts Hub & Live HUD (sys:shortcuts)"
repo: insetu
created_at: 2026-08-09T12:00:00
updated_at: 2026-11-09T07:00:00
tags: [plan, shortcuts, sutram, settings-hub, hud, ux]
---

# Blueprint: Native Keyboard Shortcuts Hub & Live HUD (`sys:shortcuts`)

**Status:** Proposed (Post-1.0 Polish — `sutram` Layer 2 + `inSetu` Settings Hub)  
**Objective:** Provide a frictionless **Keyboard Shortcuts** experience across `sutram` and `inSetu`: a live context-aware Cheat-Sheet HUD (`Mod+/` or `?`), a **Press-to-Record** chord remapper in the OS Settings Hub (`sys:shortcuts`), and cross-platform `mod+` normalization.

---

## 1. Architectural & Ergonomic Principles

The shortcut engine in `sutram/js/shortcuts.js` (`initShortcutRouter`) evaluates keybindings across a 4-tier context hierarchy (highest priority first):
1. **Tier 1 (Modals):** Actions scoped to an open `<sutram-modal>` (e.g., `modal:new-task-modal`).
2. **Tier 2 (Elements):** Actions scoped to focused interactive elements.
3. **Tier 3 (Spatial Projections & Sub-Tabs):** Actions scoped to the focused column's active projection (e.g., `subtab:tracker:edit`).
4. **Tier 4 (Global):** OS-level fallback bindings (`global`).

### Four Ergonomic Pillars
1. **Press-to-Record Chord Capture (Never Type Raw Strings):** Users never type `"ctrl+shift+s"` into a text box. Clicking a keybinding badge enters an isolated **Recording Mode** (`Press keys… • Esc to cancel • Backspace to unbind`) that intercepts the next non-modifier `keydown`, prevents default browser/modal actions, and formats the chord into visual `<kbd>` keycaps (`⌘ S` on macOS, `Ctrl + S` on Linux/Windows).
2. **Cross-Platform `mod+` Normalization:** `sutram/js/shortcuts.js` treats `mod+` (and legacy `ctrl+` registrations) as `metaKey` on macOS and `ctrlKey` on Linux/Windows unless an explicit `raw_ctrl+` or `meta+` override is recorded.
3. **Context-Aware Conflict & Shadow Detection:**
   - **Hard Conflict (`HARD_CONFLICT`):** Two actions in the *same* `context` (e.g., both in `global` or both in `subtab:tracker:edit`) bound to the same chord.
   - **Context Shadowing (`SHADOWS_GLOBAL`):** A `subtab:*` or `modal:*` binding that temporarily overrides a `global` binding while that surface is focused.
   - **Disjoint Contexts (`CLEAN`):** Two different subtabs (`subtab:tracker:edit` and `subtab:notes:edit`) sharing `mod+s` is valid and never flagged as a conflict.
4. **In-Situ Discoverability (`Mod+/` Cheat-Sheet HUD):** Pressing `Mod+/` (or `?` outside text inputs) opens a lightweight overlay listing the shortcuts active in the user's *current* focus stack (Active Modal + Focused Projection + Global), with a **Customize in Settings…** button that jumps directly to `sys:shortcuts`.

---

## 2. File-Level Execution Plan

### Sprint 1: Layer 2 Presentation Kernel (`vfs://sutram/sutram/js/shortcuts.js` & `sutram_sdk.js`)
* **Task 1.1 (`vfs://sutram/sutram/js/sutram_sdk.js`):**
  - Extend `ExtensionRegistry._shortcutMeta` (currently keyed by `s.id || "${extName}:${slugify(...)}"`) to store `{ id, canonicalId, context, defaultKey, activeKey, extName, label, allowInInputs, callback }`, where `canonicalId` is `<extName>::<context>::<id>`.
  - Add `ExtensionRegistry.setShortcutOverrides(overridesMap)` accepting `{ "<canonicalId>": "mod+shift+s" | "" }`, where `""` or `null` explicitly unbinds the default chord without removing the catalog entry, and rebuilds `ExtensionRegistry.shortcuts`.
  - Add `ExtensionRegistry.getShortcutsCatalog(options = { activeOnly: true })` returning all registered shortcuts annotated with `activeKey`, `isOverridden`, and conflict/shadow diagnostics (`HARD_CONFLICT`, `SHADOWS_GLOBAL`).
* **Task 1.2 (`vfs://sutram/sutram/js/shortcuts.js`):**
  - Add `normalizeKeyChord(eOrString, platform)` and `formatKeycaps(chord, platform)`:
    - Canonicalize modifier order to `mod+ctrl+alt+shift+<key>`.
    - On macOS, `mod` matches `e.metaKey`; on Linux/Windows, `mod` matches `e.ctrlKey`. Legacy `ctrl+<key>` declarations upgrade transparently to `mod+<key>`.
    - `formatKeycaps(chord)` returns display tokens (`['⌘', '⇧', 'S']` on macOS; `['Ctrl', 'Shift', 'S']` on Linux/Windows).
  - Add **Editable Input Guardrail & Reserved Browser Chord Blocklist**:
    - Suppress single-key shortcuts (`?`) and non-`mod` chords when `getEventPath(e)` intersects `<input>`, `<textarea>`, `<select>`, `[contenteditable="true"]`, or `.cm-editor`, unless the shortcut declares `allowInInputs: true`.
    - Reject non-overridable browser chords (`mod+w`, `mod+t`, `mod+n`, `mod+q`, `mod+r`, `mod+l`) during interactive recording.

### Sprint 2: Tier 2 Core Persistence & Settings Hub (`insetu/core/system/`)
* **Task 2.1 (`vfs://insetu/insetu/core/system/blueprint.py` & `system.js`):**
  - Add `{"id": "shortcut_overrides", "label": "Keyboard Shortcut Overrides", "type": "hidden", "scope": "daemon", "default": {}}` to `SYSTEM_SETTINGS_SCHEMA` in `insetu/core/system/blueprint.py`.
  - Hydrate `shortcut_overrides` during `executeBootSequence()` in `insetu/core/system/system.js` and pass to `ExtensionRegistry.setShortcutOverrides(...)`.
* **Task 2.2 (`vfs://insetu/insetu/core/system/components/ui_system_settings.js` & `vfs://sutram/sutram/js/primitives.js`):**
  - Add the `sys:shortcuts` (`Keyboard Shortcuts`) category in `InSetuSystemSettings` with fuzzy search and an **"Active Workspace Extensions Only"** toggle (default: `ON`).
  - Render each shortcut inside a compact `<sutram-field-card>` with action label, context `<sutram-tag>`, visual keycap pills, a **Click-to-Record** capture button, conflict/shadow badges, and a per-row **Reset** button when customized.
  - Add `<sutram-shortcuts-hud>` bound globally to `mod+/` and `?` (outside text inputs) displaying active shortcuts for `getActiveContexts()` with a `Customize in Settings…` footer action.

### Sprint 3: Behavioral Verification (`vfs://sutram/tests/unit/test_sutram_registry.py`)
* **Task 3.1 (`vfs://sutram/tests/unit/test_sutram_registry.py` via `js_loader.mjs`):**
  - **Cross-Platform `mod+` Routing:** Verify `mod+s` triggers on `metaKey: true` when platform is Darwin and `ctrlKey: true` when platform is Linux/Win32.
  - **Live Override & Unbind:** Verify `ExtensionRegistry.setShortcutOverrides({ 'tracker::subtab:tracker:edit::save_edited_task': 'mod+enter' })` rebinds immediately, and setting `""` suppresses the default `mod+s` handler.
  - **Conflict & Input Guardrail Classification:** Verify two actions with `mod+s` in `subtab:tracker:edit` flag `HARD_CONFLICT`, `mod+s` in `subtab:tracker:edit` + `global` flags `SHADOWS_GLOBAL`, disjoint subtabs report zero conflicts, and single-key `?` is suppressed when `getEventPath(e)` contains an `<input>` or `.cm-editor`.
