# ADR 0028: Zero-Bundler Native Hash Router & Fail-Safe Event Bus Substrate

## Status
Accepted (2026-07-25)

## Context
Prior to this release, navigation state persistence across the inSetu Developer OS was fragmented across multiple locations: primary tabs and sub-tabs were written imperatively to `localStorage` keys (`insetu_tab_{ws}`, `insetu_subtab_*`), while deep view paths (such as VFS folder drill-downs) existed solely in volatile component memory and vanished on page refreshes.

Furthermore, broadcasting UI hooks and custom DOM events across decoupled extensions required verbose, defensive object validation chains (`if (window.inSetu && window.inSetu.extensions && window.inSetu.extensions.Registry...)`), creating boilerplate bloat and risking silent event drops.

## Decision
1. **Zero-Bundler SPA Router (`window.location.hash`):**
   - We establish `window.location.hash` as the absolute Single Source of Truth (SSOT) for client navigation state, formatted as `#/{workspace_id}/{tab}/{sub-tab}/{deep_path}`.
   - Primary navigation (`activeTab`) and sub-navigation (`activeSubTabs`) are centralized inside the Zustand `AppStore`.
   - Client interactions fire `setActiveRoute()` or update `window.location.hash`, and `window.onhashchange` reactively hydrates `AppStore`.
   - Direct `localStorage` reads/writes for tab routing are permanently deprecated.

2. **Unified Fail-Safe Event Bus (`window.inSetu.events`):**
   - We establish `window.inSetu.events` offering `emit(eventName, detail)` for CustomEvent broadcasts and `emitHook(zoneName, payload)` for defensive UI hook invocation.
   - `ExtensionRegistry.registerExtension` natively converts declarative `emitEvent` action definitions into custom event callbacks, eliminating imperative event dispatch boilerplate.

3. **Folder Entity Selection & Recursive Quickpack Expansion:**
   - `<insetu-file-tree>` marks directory nodes with `entityType = 'folder'` and `entityData = { folderpath }`, enabling folder participation in the global selection tray (`SelectionStore`).
   - The Gather worker `@gather_bp.worker("pack_selection_task")` handles `folderpath` items by recursively collecting all child files via VFS walk.

## Consequences
* **Positive:** URL links are now bookmarkable and survival across browser reloads is deterministic.
* **Positive:** Complete elimination of repetitive, deeply chained defensive hook checks.
* **Positive:** Unified UDF flow where browser location, Zustand state, and Lit component views remain in absolute synchronization.
* **Negative:** Requires hash parsing logic on boot to handle malformed or legacy URLs gracefully.