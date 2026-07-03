---
repo: "insetu"
type: "todo"
status: "open"
id: INS-TODO-20260701_1300_NAMESPACE_GLOBAL_STORES
title: "Refactor Global Stores to window.inSetu Namespace"
created_at: 2026-07-01T13:00:00
closed_at: null
sub_bucket: "None"
tags: [frontend, architecture, refactor, namespace]
---

## Description
Currently, core and extension state stores (`BridgeStore`, `KanbanStore`, `CitationStore`, etc.) are either bound directly to the global `window` object or kept entirely within isolated module scopes. This approach pollutes the global namespace, introduces collision risks with third-party scripts, and fragments cache eviction logic during workspace soft-swaps.

We need to establish a unified `window.inSetu` object namespace to cleanly house all reactive state trees, extensions, and core UI factories.

## Action Items
- [ ] Scaffold the root object `window.inSetu = { stores: {}, extensions: {}, ui: {} };` early in the `app.js` initialization sequence.
- [ ] Bind core modules to the new namespace (e.g., `window.inSetu.stores.Bridge = BridgeStore;`).
- [ ] Refactor all dynamic extensions (`ext_tracker.js`, `ext_citations.js`, `ext_research.js`) to mount their Zustand stores under `window.inSetu.stores` rather than `window.KanbanStore`, etc.
- [ ] Update `app.js` to migrate `UIFactory` and `ExtensionRegistry` into the `window.inSetu` namespace.
- [ ] Refactor the workspace teardown loop inside `performSoftRefresh()` to blindly iterate over `Object.values(window.inSetu.stores)` and dynamically trigger cache eviction/resets, replacing the hardcoded and brittle `if (window.KanbanStore)` manual checks.

## Notes / Execution Log
* **Audit (2026-07-02):** Designated as primary architectural debt. Consolidating state management into the `window.inSetu` namespace is required to finalize Unidirectional Data Flow (UDF) compliance and prevent cross-tenant cache bleeding.
