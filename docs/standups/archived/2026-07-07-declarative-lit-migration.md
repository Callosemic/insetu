# Architecture Blueprint: Declarative Extensions & The LitElement Strangler Fig Migration

**Date:** 2026-07-07
**Status:** Accepted
**Mission:** To eradicate imperative UI mounting, eliminate cross-tenant DOM leaks, and transition our extension ecosystem to native Web Components (LitElement) via a zero-bundler import map architecture.

---

## 1. The Core Problem: Imperative Extension Debt
Historically, inSetu extensions executed dynamic DOM injections and registered event listeners immediately upon script load. They actively pushed themselves into the `ExtensionRegistry`. 
This imperative architecture created severe technical debt:
* **Brittle Teardown:** The core OS did not own the extension footprints, forcing reliance on fragile visibility checks and manual element sweeps during hot-swaps.
* **Cross-Tenant Ghosting:** If an extension developer forgot to clear an interval or remove a DOM node inside their `unloadHook`, that state violently bled into the next tenant's workspace.
* **Component Duplication:** UI paradigms like the "File Tree" and "File Card" were redundantly hardcoded via nested string literals across multiple extensions, violating DRY principles and our UI factory mandates.

## 2. Phase 1: The Import Map (Zero-Bundler Global Lit)
To transition to LitElement without violating our strict zero-bundler requirement, we will leverage native ES Module Import Maps.
* **Execution:** We will inject a `<script type="importmap">` into the `<head>` of `index.html`. This creates a global registry mapping the bare specifier `'lit'` to a locked CDN URL.
* **Result:** Inside any extension (e.g., `ext_prompts.js`), developers can simply write `import { LitElement, html, css } from 'lit';`. The browser's native module resolver guarantees that the exact same singleton instance of Lit is shared across all extensions, keeping the memory footprint incredibly low.

## 3. Phase 2: Global Web Components (`ui_file_tree.js`)
We will extract recurring UI patterns out of the extension silos and into foundational, global Web Components.
* **`<insetu-file-card>`**: A pristine presentation component. It accepts properties (`filename`, `icon`, `domain`) and dispatches standard DOM events (e.g., `@card-clicked`).
* **`<insetu-file-tree>`**: A smart layout component. It ingests a flat array of file paths, imports our pure `buildFileTree` utility, and recursively renders itself and `<insetu-file-card>` children.
* **The Strangler Fig Integration:** Once stable, we will surgically drop the `<insetu-file-tree>` tag into the legacy Vanilla JS `fs.js` engine, completely eradicating its imperative DOM-looping functions .

## 4. Phase 3: The Declarative OS Schema
Extensions will be stripped of all self-executing initialization logic. They must instead expose a static configuration payload containing their metadata, hook subscribers, and layout mappings.

The new `ExtensionRegistry.registerExtension(name, configPayload)` API defines three pillars:
1. **Metadata:** Standard identity tracking (`name`, `version`, `description`).
2. **Layout Slots:** Extensions declare their structural footprint (e.g., `slot: "slots:sub-navigation"`, `targetParent: "context"`). The OS reads this schema, performs a numerical sort, and programmatically mounts the DOM in a single batch render pass. The extension merely provides a `<insetu-ext-...>` tag.
3. **Scoped Interceptors:** The OS registers UI hooks directly from the payload. If the extension is disabled in the active workspace's configuration, the Event Bus automatically filters and drops the callback, preventing unauthorized interception.

## 5. Phase 4: The Prompts Pioneer (Execution Plan)
We will use the Prompts extension (`ext_prompts.js`) as our pioneer to test the declarative boundaries.
* **The Rewrite:** We will wipe the imperative `ext_prompts.js` script and replace it with an `<insetu-ext-prompts>` LitElement class and the declarative configuration payload.
* **The Hybrid Bridge:** To ensure the OS remains stable during the transition, `app.js` will temporarily feature a backward-compatibility layer. When it parses the declarative `layoutSlots` from `ext_prompts.js`, it will translate them back into the legacy `registerSubTab()` engine under the hood.
* **The Final Cleanup:** Once all extensions (Tracker, Research, Citations, Git) are fully migrated to Lit Web Components and Declarative Schemas, the legacy imperative registry functions will be permanently deleted from the OS.
## 6. Learnings from Pioneer Migrations (Prompts, Gather, Flow)
As we executed the first wave of migrations, several critical guardrails were established to prevent regression into legacy imperative habits:
* **The Shadow DOM Styling Strategy:** Early migrations used Light DOM (`createRenderRoot() { return this; }`) to inherit `style.css`. Moving forward, we will extract global styles (buttons, inputs) into a `shared_styles.js` module exporting a Lit `css` literal. Components will declare `static styles = [sharedStyles, css\`...\`]` to achieve true Shadow DOM encapsulation without a bundler.
* **The Imperative Reflex Trap (DOM Reading):** We caught early components (e.g., `ext_flow.js`) still attempting to read `document.getElementById('...').value`. In LitElement, input fields must strictly bind to reactive class properties via `@input=${(e) => this.myProp = e.target.value}`.
* **Store Subscription Leaks:** Components subscribing to the Zustand `AppStore` during `connectedCallback()` must explicitly capture the unsubscribe function and execute it inside `disconnectedCallback()`.
Failure to do so creates severe memory leaks and ghost updates during tenant hot-swaps.
* **Fat Controllers & UDF Bleed:** Web Components must remain pure presentation layers. They should never forcefully bind their internal methods (e.g., `window.compileContexts = this.compileContexts.bind(this)`) to the global scope. Global fetching and state-mutating utility functions must live in the core `app.js` module so the OS can trigger them regardless of which component is currently mounted.
* **The Imperative Modal Trap:** Dynamically generating `<insetu-modal>` elements via `document.createElement()` and injecting raw template strings via `innerHTML` is strictly a transitional bridge. It bypasses Lit's secure and efficient HTML tagged template pipeline. Graduated components must render their `<insetu-modal>` nodes entirely within their declarative `render()` functions, controlling visibility by binding the `open` attribute to reactive properties.
* **Swallowed Exceptions in Components:** When tearing down fat controllers, ensure you verify `.bind(this)` calls in `connectedCallback()`.
* **Swallowed Exceptions in Components:** When tearing down fat controllers, ensure you verify `.bind(this)` calls in `connectedCallback()`. A generic `try/catch` block handling a network request will eagerly swallow a `TypeError` (e.g., from calling a removed method), masking it as a network failure. Always `console.error` the raw exception.
* **DOM-Driven Routing vs Stateless Routing:** Hardcoded `class="active"` attributes in the `index.html` skeleton will actively fight stateless `localStorage` routing during the boot sequence. `switchTab` must ignore the DOM on initial load to prevent violently overwriting the user's saved state.
* **The Imperative Modal Trap (`ext_config.js`):** While `ext_config.js` maps its settings trigger declaratively, it falls back to using `UIFactory.createModal` inside the `onClick` handler. Graduated components must render `<insetu-modal>` natively within their own declarative `render()` functions.
* **State Hydration Resilience (`ext_config.js`):** Components must subscribe to the `AppStore`'s `activeWorkspace`. Fetching configuration once during `connectedCallback()` fails to refresh the UI when a user hot-swaps tenants. 
* **Stateless Routing Mandate (`index.html`):** Hardcoded DOM classes like `<div class="tab active" onclick="switchTab(event, 'edit')">` and `<div id="tab-edit" class="tab-content active">` physically fight against `localStorage` when the bootloader tries to hydrate the user's previously saved tab state. These must be stripped. 
* **Contextual Action Slot Unification (`slots:sub-navigation-actions`):** Forcing components to scrape global stores or query class loops from the DOM to determine their active coordinates is a core anti-pattern . By introducing a dedicated sub-navigation actions container managed natively by the core layout engine, components remain isolated, context-aware presentation primitives reflecting state directly from their instance dataset attributes (`this.dataset.subId`) .
## 7. The Component Graduation Checklist (Compliance Guardrails)
Before a component is considered fully compliant and "Graduated", the Architect must interrogate it against the following strict constraints:
1. **Zero DOM Reading:** Are there *any* `document.getElementById` or `querySelector` calls attempting to read state from the UI?
*(If yes, fail. Bind to Lit properties).*
2. **Shadow DOM Encapsulation:** Does the component utilize native Shadow DOM with `sharedStyles` injected, completely isolating its structural footprint?
3. **Teardown Hygiene:** Does the component clean up all Zustand store subscriptions (`this._unsub()`) and global `window` event listeners during `disconnectedCallback`?
4. **Declarative Purity:** Is the extension completely stripped of self-executing imperative initialization code?
Does it strictly use `ExtensionRegistry.registerExtension` with static `layoutSlots`?
5. **DOM Annihilation Prevention:** Does the `render()` method utilize `lit-html` templates to surgically diff the UI, rather than falling back to `innerHTML` or `replaceChildren()`?
6. **Subscription Memory Hygiene:** Are store unsubscriptions explicitly tracked, captured, and cleared during the component teardown cycle to prevent memory leaks and multi-tenant data contamination?
7. **Zero Host Contamination:** Is the component styling completely self-contained within its Shadow DOM, ensuring it never pollutes or alters layout elements outside its boundaries?
## 8. Migration Tracker

### Global OS Components (Primitives)
| Component | Role | Migration Status | Notes |
| :--- | :--- | :--- | :--- |
| `<insetu-card>` | File/Item Presentation | **Migrated** | |
| `<insetu-modal>` | Transient Dialogs | **Migrated** | |
| `<insetu-filter-group>` | Universal Arrays | **Migrated** | Replaces imperative `UIFactory.createNestedRepoFilters`. |
### Core OS UI Domains
| Module | Domain Role | Migration Status | Target Component Architecture |
| :--- | :--- | :--- | :--- |
| `fs` | Virtual File System | **Gold Standard** | `<insetu-vfs-explorer>`, `<insetu-vfs-modals>` |
| `config` | Workspace Settings | **Migrated (Native LitElement)** | `<insetu-ext-config>` |

### Extensions
| Extension ID | Domain Role | Migration Status | Target Component Architecture |
| :--- | :--- | :--- | :--- |
| `bridge` | Yomama Sync Bridge | **Migrated (Native LitElement)** | `<insetu-ext-bridge>` |
| `prompts` | Prompt Library | **Gold Standard (SDK V2)** | `<insetu-ext-prompts>` |
| `gather` | Context Gatherer | **Gold Standard** | `<insetu-ext-gather>` | 
| `flow` | Workflows | **Migrated (Native LitElement)** | `<insetu-ext-flow>` | 
| `git` | Version Control | **Gold Standard** | `<insetu-ext-git-diffs>` | 
| `tracker` | Kanban Board | **Migrated (Native LitElement)** | `<insetu-ext-tracker>` |
| `research` | Triage Inbox | **Migrated (Native LitElement)** | `<insetu-ext-research>` |
| `favorites` | Favorites Bar | **Gold Standard (SDK V2)** | `<insetu-ext-favorites>` |
| `skills` | Skills Tracker | **Debt (Minor)** | `<insetu-ext-skills>` |
| `citations` | Reference Manager | **Gold Standard** | `<insetu-ext-citations>` |
| `format` | Document Compilation | **Debt (Host Contamination)** | `<insetu-ext-format>` |
| `ingest` | URL Ingestion | **Debt (Host Contamination)** | `<insetu-ext-ingest>` |
| `term` | Terminal Canvas | **Migrated (Native LitElement)** | `<insetu-ext-term>` |

## 9. Architectural Audit (2026-07-08)

A retroactive audit against the Component Graduation Checklist revealed that several components marked as "Migrated" still harbor legacy imperative technical debt.

### 🏆 The Gold Standard (100% Compliant)
* **`ext_prompts.js`** (`<insetu-ext-prompts>`): Spotless. Pure Lit templates, clean teardown, pure Zustand state.
* **`ext_gather.js`** (`<insetu-ext-gather>`): Passes all checks. Search inputs are safely bound to reactive class properties.
* **`ext_favorites.js`** (`<insetu-ext-favorites>`): Flawless execution. No host contamination, proper memory sweeping.

### ⚠️ The Minor Offenders (Mostly Compliant, Some Debt)
* **`config.js`** (`<insetu-workspace-editor>`):
    * **Violation (DOM Reading):** Imperatively reads the DOM (`this.shadowRoot.querySelector('#new-ws-id')`) instead of using data-binding (`@input`).
* **`ext_research.js`** (`<insetu-ext-research>`):
    * **Violation (Host Contamination):** Reaches outside its Shadow DOM to forcefully inject a back button into the OS skeleton (`document.querySelector('#tab-edit .sub-tabs-bar > div:last-child')`).
    * **Violation (DOM Reading):** Manually scrapes the JSON textarea (`this.shadowRoot.getElementById('rs-ai-json-input')`).
* **`fs.js`** (`<insetu-vfs-explorer>`):
    * **Violation (Host Contamination):** Reaches out to the global document to toggle a button (`document.getElementById('btn-fs-more')`).
### 🚨 The Major Offenders (Failing the Audit)
* **`ext_git.js`** (`<insetu-ext-git-diffs>`):
    * **Violation (Shadow DOM Bypass):** Explicitly breaks encapsulation (`createRenderRoot() { return this; }`). This bypasses encapsulated Unidirectional Data Flow specifically to allow the legacy `generateDiffs` method to continue imperatively scraping `document.getElementById('diff-loading')`.
    * **Violation (DOM Annihilation):** Imperatively wipes the container (`results.replaceChildren()`).
    * **Violation (DOM Reading):** Relies entirely on `document.getElementById('diff-results')` to manipulate the DOM.
    * **Verdict:** This is a legacy imperative script wearing a LitElement trench coat.

* **`engine_skills.py`** (Backend Extension):
    * **Violation (VFS Bypass):** Despite importing `execute_vfs_save`, the engine executes unguarded, synchronous native Python file writes (`with open(abs_path, 'w', encoding='utf-8') as f: f.write(...)`). This completely bypasses the asynchronous background commit queue, violating both ADR 0004 and ADR 0010.

## 10. Architectural Audit (2026-07-09)

A follow-up audit confirms that all major and minor offenders flagged on 2026-07-08 have been successfully remediated and fully brought into compliance with the V2 architecture.

### 🏆 The Gold Standard (100% Compliant)
* **`ext_prompts.js`**, **`ext_gather.js`**, **`ext_favorites.js`**: Continue to serve as pristine references.
* **`ext_git.js`** (`<insetu-ext-git-diffs>`): **Remediated**. Legacy imperative scraping replaced with reactive Zustand subscriptions and true Shadow DOM encapsulation.
* **`fs.js`** (`<insetu-vfs-explorer>`): **Remediated**. Host contamination eradicated.
* **`config.js`** (`<insetu-workspace-editor>`): **Remediated**. Imperative DOM reads replaced with native Lit `@input` data bindings.
* **`ext_research.js`** (`<insetu-ext-research>`): **Remediated**. Host contamination removed; back button migrated to declarative `<insetu-ext-research-actions>` slot. JSON input state mapped reactively.
* **`ext_term.js`** (`<insetu-ext-term>`): **Migrated**. Successfully transitioned from legacy script to a fully compliant declarative Web Component.
* **`engine_skills.py`** (Backend): **Remediated**. Banned synchronous file writes successfully routed through the asynchronous `execute_vfs_save` pipeline.
## 11. Deep Architectural Audit (2026-07-09 - Final LitElement Review)

A final sweep confirms the successful graduation of the remaining Phase 1 targets into compliant declarative architectures. 

### 🏆 The Gold Standard (100% Compliant)
* **`ext_citations.js`**: **Remediated.** Replaced imperative DOM traversal and modal appending with a strict Zustand UDF model and internal `<insetu-modal>` rendering. 
* **`ext_git.js`**: **Remediated.** The `_executeSweep()` method correctly utilizes bound Lit properties (`this.selectedSweepFiles`) rather than scraping the Shadow DOM for `.sweep-cb:checked` elements.
* **`ext_format.js` & `ext_ingest.js`**: **Remediated.** Host contamination eradicated. Modals render securely inside the declarative template, and metronome intervals are correctly registered.
* **`ext_term.js`**: **Migrated.** Now utilizing a native, shadow-encapsulated iframe construct.
### 🚨 Remaining Technical Debt (The Hitlist)
* *(Update 2026-07-10: All remaining technical debt has been eradicated. The codebase is 100% compliant with the Phase 1 Declarative Web Component architecture.)*

*(Update 2026-07-09: `fs.js` imperative modals have been successfully dismantled and migrated to the declarative `FsStore.modals` architecture, securing full compliance for the VFS Explorer.)*
*(Update 2026-07-10: `ext_skills.js` FormData dependencies dismantled. Inputs securely bound to reactive properties.)*
*(Update 2026-07-10: `ext_flow.js` N+1 Fetch Penalty eradicated. Local Zustand state now surgically splices mutations.)*