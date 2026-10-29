# ADR 0041: Deprecation of UI Zones & Presentation Decoupling

## Status
Accepted (2026-08-11)

## Context
During early iterations of the extension architecture, UI Zones (`uiHooks`, `zone:*`) allowed custom extensions to inject HTML template strings into hardcoded chassis DOM zones (e.g., `zone:modal-ext-menu`, `zone:file-card-actions`, `zone:file-edit-override`).

With the adoption of ADR 0023 (Polymorphic Entity-Action Cards), ADR 0025 (Declarative App Shell & Brokered SDK Resources), ADR 0028 (Typed Event Bus), and ADR 0037 (Gather IoC Topology), string-based `innerHTML` injection into chassis zones violates Unidirectional Data Flow (UDF). It scatters presentation logic across decoupled modules, causes property drift (e.g., `filepath` vs. `path` vs. `filename`), and prevents responsive adaptation (such as transforming card buttons into desktop menu bar dropdowns).

## Decision
1. **Complete Deprecation of UI Zones (`uiHooks` / `zone:*`):**
   - Permanently deprecate `uiHooks` and all `zone:*` string hook specifiers across the frontend chassis and extension ecosystem.
   - Remove `emitHook()` and `registerUIHook()` execution paths from `ExtensionRegistry.js` and `app.js`.

2. **Declarative Custom Editors (`customEditors` Schema Array):**
   - Introduce the `customEditors` array in `ExtensionRegistry`. Extensions declaratively register file path matchers and custom modal open handlers (replacing `zone:file-edit-override`).

3. **Targeted Modal Layout Slots (`layoutSlots` Expansion):**
   - Expand `layoutSlots` to support modal and drawer action targets (e.g., `slot: "modal:new-file:actions"`), allowing components to mount declaratively into modal footers without freeform string hooks.

4. **Lifecycle & Event Bus Routing:**
   - Route behavioral lifecycle events through native `InSetuElement` methods (`onTabVisible`, `onWorkspaceChanged`, `onForceRefresh`) and the Typed Event Bus (`window.inSetu.events`).

5. **Fitness Function Enforcement:**
   - Add the `BANNED_UI_ZONES` static analysis rule to `tests/fitness/rules_javascript.py` to mathematically fail builds if `uiHooks` or `zone:*` strings appear in frontend code.

## Consequences
* **Positive:** 100% pure declarative schema configurations across all extension presentation footprints.
* **Positive:** Complete elimination of innerHTML security/styling vectors and property drift.
* **Positive:** Full compatibility with groupable entity actions and responsive desktop menu bar synthesis.
* **Negative:** Requires refactoring remaining `uiHooks` usage across existing Tier 3 extensions (`notes`, `tracker`, `ingest`, `prompts`, `git`, `dev`, `hooks`, `citations`).