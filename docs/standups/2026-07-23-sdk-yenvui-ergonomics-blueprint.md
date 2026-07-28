# SDK Ergonomics & yenVUI Harmonization Blueprint
**Date:** 2026-07-23
**Context:** Standup & Architectural Blueprint

This document outlines the evolutionary roadmap for the `inSetu` Frontend SDK. As we enforce the `yenVUI` presentation boundary—stripping developers of the ability to write imperative HTML and custom CSS—we must supply an ergonomic "pit of success"[cite: 1]. The SDK must absorb the friction of strict Unidirectional Data Flow (UDF) by providing high-level declarative orchestrators.

---

## 1. The yenVUI Intersection

How does the inclusion of `yenVUI` change the trajectory of our SDK upgrades? 

It fundamentally shifts the SDK's role from *generating raw DOM elements* to *orchestrating custom web components*[cite: 1]. 
*   **Property Projection over String Interpolation:** The SDK wrappers will no longer output `<div class="file-card">`[cite: 1]. Instead, they will map data directly into the `.titleText` and `.intentColor` properties of `<yenvui-card>`[cite: 1].
*   **Custom Event Interception:** Native DOM events (`click`, `input`) are replaced by `yenVUI` normalized emissions[cite: 1]. The SDK must natively listen for `@yv-click`, `@yenvui-modal-closed`, and `@yenvui-search-changed`[cite: 1].
*   **The CSS Vacuum Completion:** To fully realize the "Universal CSS Vacuum" mandate[cite: 1], the SDK cannot fall back to rendering raw `<input>` or `<select>` tags[cite: 2].

### Identified Gap: Missing yenVUI Primitives
To support the Native UDF Input Binding suggestion, we must expand the `yenVUI` arsenal before we write the SDK wrappers. We currently lack presentation primitives for forms[cite: 1]. We must construct:
1.  **`<yenvui-input>`:** Encapsulating `type="text|number|date"`, handling its own focus rings, hover states, and theme colors[cite: 1].
2.  **`<yenvui-select>`:** A styled dropdown primitive[cite: 1].
3.  **`<yenvui-textarea>`:** A multi-line text input primitive[cite: 1].

Once these primitives exist, the SDK can safely orchestrate forms without violating the CSS vacuum[cite: 1].

---

## 2. The 6 SDK Ergonomic Upgrades

### I. Automated Job-to-Button Orchestration
*   **Concept:** Eliminate the boilerplate of tracking `activeJobId`, `loadingMessage`, and `try/catch` polling loops for backend worker jobs[cite: 6, 7].
*   **The yenVUI Integration:** The SDK will expose `this.api.bindJobAction(endpoint, payload)`. This method will return a directive that plugs directly into a `<yenvui-async-btn>`[cite: 1]. The SDK will capture the `@yv-click` event[cite: 1], execute the REST call, handle the polling metronome, and reactively pipe the state (`loading`, `success`, `error`) back into the `<yenvui-async-btn>` `.status` property[cite: 1].

### II. Data-Driven View & Catalog Generators
*   **Concept:** Abstract away the repetitive `.map()` loops used to render lists of items[cite: 5, 6, 7].
*   **The yenVUI Integration:** Developers will call `this.ui.renderCatalog(items, schema)`. The SDK will iterate over the Zustand store array and declaratively project the data into `<yenvui-card>` elements[cite: 1]. The schema will allow developers to map specific data keys to the `<yenvui-card>` properties (e.g., `schema: { title: 'name', description: 'desc', icon: () => '📦' }`), while automatically utilizing the `<slot name="actions">`[cite: 1] for extension-specific buttons.

### III. Unified Fuzzy Search & Filter Mixins
*   **Concept:** Standardize local search and repository filtering, which is currently duplicated across `tracker`, `research`, `git`, and `flow`[cite: 5, 6, 7].
*   **The yenVUI Integration:** We will introduce a `withSearch(dataKey, searchKeys)` mixin for `createExtensionStore`[cite: 2]. This automatically binds to `<yenvui-search-bar>` via the `@yenvui-search-changed` event[cite: 1]. The mixin manages the `searchQuery` state and exposes a computed `filteredData` array, completely decoupling the filtering math from the Lit template renders.

### IV. Standardized Modal Lifecycle Management
*   **Concept:** Centralize the state tracking required to open/close modals, manage working drafts, and prevent accidental data loss[cite: 5, 7].
*   **The yenVUI Integration:** The SDK will provide a `ModalController`. Because `yenVUI` relies on the HTML5 `<dialog>` element and emits `@yenvui-modal-closing`[cite: 1], the SDK controller will natively intercept this event. If the developer configures `dirtyCheck: true`, the SDK will automatically diff the working state against the original snapshot, halting the `<yenvui-modal>` teardown[cite: 1] to prompt the user if unsaved changes exist.

### V. Native UDF Input Binding
*   **Concept:** Replace raw `@input=${e => Store.setState(...)}` callbacks[cite: 6, 7] with a native declarative binder.
*   **The yenVUI Integration:** We will upgrade the existing `bindStoreInput`[cite: 2] into a core `InSetuElement` method: `this.bindInput('storeKey')`. This method will map strictly to the upcoming `<yenvui-input>`, `<yenvui-select>`, and `<yenvui-textarea>` primitives. It will establish a two-way synchronization layer: projecting the Zustand store value downward as a property, and listening for `@yv-input-changed` to automatically mutate the store upward.
### VI. CLI Scaffolding
*   **Concept:** Lower the barrier to entry by generating boilerplate code instantly[cite: 5, 6].
*   **The yenVUI Integration:** The `insetu create-extension <name>` command will scaffold `ext_<name>.js` files that are "yenVUI-native" from day one. The generated Lit templates will completely omit raw HTML tags, utilizing `<yenvui-tabs>`, `<yenvui-card>`, and the new SDK orchestrators by default, ensuring all new extensions fall directly into the architectural pit of success.

### VII. Standalone Entity Action Renderer
*   **Concept:** Eradicate duplicate button layouts and click handlers inside detail modals[cite: 5, 6]. 
*   **The yenVUI Integration:** Developers can call `this.ui.renderEntityActions(entityType, entityData)` anywhere in their Lit templates. The SDK will query the central `ExtensionRegistry` and dynamically generate the mapped `<yenvui-async-btn>` primitives for that entity, injecting them into the modal or detail view perfectly styled and functionally bound.
### VIII. Universal Date & Time Formatters
*   **Concept:** Eliminate the scattered, manual `new Date(...).toLocaleString()` implementations found across multiple extensions[cite: 5, 6].
*   **The yenVUI Integration:** The `InSetuElement` base class will expose `this.utils.formatDate()` and `this.utils.timeAgo()`. This ensures that any temporal data projected into `yenVUI` cards or modals maintains strict visual consistency across the entire ecosystem.
### IX. Automated Concurrency Guards & Event Debouncing
*   **Concept:** Extension makers should never have to manually manage race conditions, write `if (jobRunning) return;` guard clauses, or debounce UI lifecycle hooks.
*   **The yenVUI Integration:** The SDK will automatically debounce overlapping `ExtensionRegistry` UI hooks to prevent concurrent hydration thrashing. Furthermore, the new `bindJobAction()` orchestrator will act as an automatic mutex—silently dropping duplicate triggers from `<yenvui-async-btn>` primitives while a job is actively processing in the background.
### X. Declarative VFS Mutation Filtering (`this.onVFSMutate`)
*   **Concept:** Eliminate repetitive `.some(m => m.filepath.includes(...))` evaluation boilerplate inside `zone:vfs-mutated` UI hook listeners across extensions.
*   **The yenVUI Integration:** The `InSetuElement` base class will expose a managed helper `this.onVFSMutate(pathPattern, callback)`. The SDK will subscribe to the `zone:vfs-mutated` event, evaluate the target path string or regex pattern against incoming mutation arrays, and trigger the callback only when relevant filesystem mutations occur, automatically managing listener teardown upon component disconnection.

### XI. Declarative Event Action Schema & SDK Event Bus (`emitEvent` / `window.inSetu.events`)
*   **Concept:** `entityActions` configurations live outside Lit element instances during registration, forcing authors to write repetitive `onClick: (data) => window.dispatchEvent(new CustomEvent('insetu:ext:action', { detail: { id: data.id } }))` boilerplate for decoupled event dispatching.
*   **The yenVUI Integration:** 
    1. **Global SDK Helper:** Expose `window.inSetu.events.emit(eventName, detailData)` to simplify manual custom event broadcasts anywhere in the client environment.
    2. **Declarative Schema Support:** Update `ExtensionRegistry` action resolution so `entityActions` can declare an `emitEvent` resolver property instead of a manual `onClick` / `asyncAction` callback:
        ```javascript
        {
            targetEntity: 'freshdesk_ticket',
            id: 'fd-take',
            label: 'Take',
            icon: '🙋',
            intent: 'success',
            emitEvent: (data) => ({ name: 'insetu:freshdesk:take', detail: { id: data.id } })
        }
        ```
    The framework will natively handle constructing and broadcasting the CustomEvent over `window`, reducing action registration boilerplate to a pure data mapping.

### XII. Universal Selection Resolution (`ctx.expand_selection`)
*   **Concept:** Extension developers should never manually parse frontend `items` payloads (e.g., checking if it's a file, expanding a folder, or unpacking virtual `system://` chunks).
*   **The yenVUI Integration:** The `ExtensionContext` base class will expose `ctx.expand_selection(items)`. The SDK must natively handle all polymorphic expansion (directories, virtual URIs, manifest chunks) and stable deduplication. Workers simply receive a flat array of valid physical/logical paths, fully decoupling the backend from UI payload structures.

### XIII. Cross-Extension Configuration Bridging
*   **Concept:** Extensions frequently need to read topologies or configurations owned by sibling extensions (e.g., Hooks needing Gather's target repos), leading to local state queries that fail or return empty.
*   **The yenVUI Integration:** Introduce a standard inter-extension configuration bridge, such as `ctx.get_peer_config('gather')`. This establishes a safe, read-only bridge between extension domains without tightly coupling their underlying databases or forcing developers to manually instantiate foreign SDK contexts.

### XIV. Self-Healing Stateful Wrappers
*   **Concept:** When `yenVUI` tabs or lists utilize `cacheViews` or DOM recycling to save memory, traditional `connectedCallback` initializations drop their state hooks, causing components to render stale data.
*   **The yenVUI Integration:** Establish the "Self-Healing Orchestrator" pattern for all stateful `insetu-*` wrappers. The SDK guidelines must mandate that consuming components use the Lit `updated(changedProperties)` lifecycle hook to instantly catch DOM property changes from the parent and re-verify their internal state against the `AppStore` or `SelectionStore`, guaranteeing they gracefully survive highly optimized rendering loops.

---
**Status:** Approved for execution. Pending `yenVUI` form primitive construction.