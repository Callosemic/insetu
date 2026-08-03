# SDK Ergonomics & yenVUI Harmonization Blueprint
**Date:** 2026-07-23 (Updated: 2026-08-03)
**Context:** Standup & Architectural Blueprint

> **August 2026 Status Update:**
> *   **Architectural Shift:** `sutram` primitives have officially superseded `yenVUI` primitives within the host application. inSetu interacts *directly and only* with Sutram wrappers (e.g., `<sutram-input>`, `<sutram-modal>`), negating the need to build naked yenVUI form primitives.
> *   **Completed Ergonomics:** Items V, VII, XI, XII, and XIV have been successfully integrated into the V2 SDK.
> *   **Pending Extraction:** Items I, II, III, IV, VI, VIII, IX, X, and XIII remain un-implemented and represent the active backlog for completing the SDK "Pit of Success."

This document outlines the evolutionary roadmap for the `inSetu` Frontend SDK. The SDK must absorb the friction of strict Unidirectional Data Flow (UDF) by providing high-level declarative orchestrators.

---

## 1. The Sutram Intersection (Formerly yenVUI)

How does the inclusion of our vendorized presentation shell change the trajectory of our SDK upgrades? 

It fundamentally shifts the SDK's role from *generating raw DOM elements* to *orchestrating custom web components*. 
*   **Property Projection over String Interpolation:** The SDK wrappers will no longer output `<div class="file-card">`. Instead, they will map data directly into the `.titleText` and `.intentColor` properties of `<sutram-card>`.
*   **Custom Event Interception:** Native DOM events (`click`, `input`) are replaced by normalized emissions. The SDK must natively listen for `@sutram-modal-closed`, and `@search-changed`.

*(Note: The previously identified gap regarding missing form primitives has been resolved via the `sutram/js/inputs.js` deployment.)*

---

## 2. The 6 SDK Ergonomic Upgrades
### I. Automated Job-to-Button Orchestration [COMPLETED]
*   **Concept:** Eliminate the boilerplate of tracking `activeJobId`, `loadingMessage`, and `try/catch` polling loops for backend worker jobs.
*   **Status:** Deployed via `this.api.bindJobAction` in the `InSetuElement` SDK. It wraps `this.api.pollJob` in a Promise, allowing `<sutram-async-btn>` primitives to natively intercept job IDs, block duplicate clicks, and manage internal loading/success state machines without polluting extension stores.

### II. Data-Driven View & Catalog Generators [STRUCK / ABANDONED]
*   **Concept:** Abstract away the repetitive `.map()` loops used to render lists of items via a `this.ui.renderCatalog(items, schema)` generator.
*   **Verdict:** Abandoned. Analysis revealed that forcing complex, multi-column, or highly customized views (like Tracker, Dev Dashboard, and Git) into a rigid JS schema object introduces severe topological fragmentation and prevents rich Lit template injections into card body slots. The native Lit `html` template literal syntax is already the optimal, declarative, and type-safe view generator.

### III. Unified Fuzzy Search & Filter Mixins [STRUCK / ABANDONED]
*   **Concept:** Standardize local search and repository filtering, which is currently duplicated across `tracker`, `research`, `git`, and `flow`.
*   **Verdict:** Abandoned. A generic Zustand `withSearch` mixin complicates the architecture. The current pattern—where the store holds pure state, and the Lit `render()` function derives the filtered view natively using `this.utils.fuzzyFilterObjects`—is highly reactive, perfectly declarative, and easily accommodates multi-dimensional filtering.
### IV. Standardized Modal Lifecycle Management [STRUCK / ABANDONED]
*   **Concept:** Centralize state tracking to open/close modals and prevent accidental data loss via an SDK `ModalController`.
*   **Verdict:** Abandoned. Abstracting native Lit `@sutram-modal-closing` and `@sutram-modal-closed` handlers into an SDK controller obscures UI physics, complicates state nesting (e.g., mutating Zustand stores dynamically), and fails to cleanly handle custom cleanup logic (like nullifying snapshots). The native Lit implementation is highly readable and already represents the "Pit of Success."
### V. Native UDF Input Binding [COMPLETED]
*   **Concept:** Replace raw `@input=${e => Store.setState(...)}` callbacks with a native declarative binder.
*   **Status:** `bindStoreInput` is fully operational in `sdk.js` and wired to `<sutram-input>`, `<sutram-select>`, and `<sutram-textarea>`.
### VI. CLI Scaffolding [COMPLETED]
*   **Concept:** Lower the barrier to entry by generating boilerplate code instantly.
*   **Status:** Deployed. `insetu create-extension <name>` is natively available in the CLI, scaffolding pristine `InSetuExtension` backend and `InSetuElement` frontend structures automatically to enforce architectural standards.
### VII. Standalone Entity Action Renderer [COMPLETED]
*   **Concept:** Eradicate duplicate button layouts and click handlers inside detail modals. 
*   **Status:** Successfully encapsulated into the `<sutram-entity-actions>` web component primitive.
### VIII. Universal Date & Time Formatters [COMPLETED]
*   **Concept:** Eliminate the scattered, manual `new Date(...).toLocaleString()` implementations found across multiple extensions.
*   **Status:** Deployed. `formatDate` and `timeAgo` utilities have been centralized in `sutram/js/utils.js`, exposed via the `InSetuElement.utils` getter, and refactored into the Tracker, Dev Dashboard, Notes, Research, and App Shell components for OS-wide consistency.
### IX. Automated Concurrency Guards & Event Debouncing [STRUCK / ABANDONED]
*   **Concept:** Automatically debounce UI hooks and provide automatic mutex guards for backend jobs.
*   **Verdict:** Abandoned/Redundant. The mutex requirement was fully satisfied by `bindJobAction` + `<sutram-async-btn>`, which natively blocks duplicate clicks. Blanket UI hook debouncing is a dangerous anti-pattern, as synchronous UI hooks (like `zone:file-edit-override` or `zone:modal-ext-menu`) require instantaneous execution to function correctly.
### X. Declarative VFS Mutation Filtering [STRUCK / ABANDONED]
*   **Concept:** Abstract `.some(m => m.filepath.includes(...))` inside `zone:vfs-mutated` hooks into a component-level lifecycle method (`this.onVFSMutate`).
*   **Verdict:** Abandoned. Moving VFS mutation filtering from the static registry to a component lifecycle hook breaks background hydration (extensions would only update when their UI tab is actively mounted). The static `uiHooks` pattern is the mathematically correct layer for global VFS reactivity.
### XI. Declarative Event Action Schema & SDK Event Bus [COMPLETED]
*   **Status:** `window.inSetu.events.emit` and the declarative `emitEvent` schema interceptor are live in `ExtensionRegistry`.

### XII. Universal Selection Resolution [COMPLETED]
*   **Status:** `ctx.expand_selection(items)` is active in the Python `ExtensionContext` substrate.
### XIII. Cross-Extension Configuration Bridging [STRUCK / ABANDONED]
*   **Concept:** Introduce a standard inter-extension configuration bridge, such as `ctx.get_peer_config('gather')`, to prevent manual foreign SDK context instantiation.
*   **Verdict:** Abandoned. The unified `config.json` payload (accessible via `ctx.config`) already serves as the OS-level Single Source of Truth for shared configurations like target topologies. Furthermore, for extension-specific private state, instantiating a peer `ExtensionContext('peer', ws_id)` is syntactically cheap and thread-safe within Python, rendering a dedicated wrapper redundant.
### XIV. Self-Healing Stateful Wrappers [COMPLETED]
*   **Status:** Formalized in SDK development standard; `updated()` lifecycle hydration active in Sutram components.

---
**Status:** Active Backlog. Sutram UI primitives successfully established.