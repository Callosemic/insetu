# 06: inSetu Extension Compliance Checklist

**Identity**: The Architect.  
**Mission**: To provide a definitive, actionable audit checklist for developers building or migrating inSetu extensions. An extension is only considered "Graduated" when it strictly adheres to these ecosystem laws.

---

## 1. Cross-Domain Isolation & State Architecture
Extensions must remain perfectly decoupled to survive dynamic tenant hot-swaps and feature toggles.

*   **Cross-Extension Data Access (ADR 0002)**
    *   ❌ **Noncompliant:** Directly querying another extension's SQLite database or forcing state into another extension's Zustand store (e.g., `window.inSetu.stores.Gather.setState(...)`).
    *   ✅ **Gold Standard:** Consuming centralized SSOT helpers (e.g., `get_topology_files_for_repo()`) or broadcasting payloads over the Typed Event Bus (`window.inSetu.events.emit`) so the target extension can update its own state independently.

*   **State Typing (UDF Strictness)**
    *   ❌ **Noncompliant:** "Stringly-typed" relational state, such as keeping arrays or tags as comma-separated strings (`"todo, bug"`) in the Zustand store to save serialization effort.
    *   ✅ **Gold Standard:** Using native arrays or `Set` objects in memory for $O(1)$ mutations, only converting them to strings/JSON at the exact moment of physical I/O boundary generation.

*   **Floating Global Listeners (ADR 0025)**
    *   ❌ **Noncompliant:** Placing `window.addEventListener` at the bottom of the module scope. This evades garbage collection and creates exponential memory leaks during workspace swaps.
    *   ✅ **Gold Standard:** Binding listeners strictly inside `connectedCallback()` using `this.registerGlobalListener()`, which the `InSetuElement` SDK automatically destroys on unmount.

---

## 2. Backend OS Substrate & I/O Hygiene
The backend must never block the ASGI event loop or bypass the topology ledgers.

*   **Async Worker Execution (ADR 0005, 0034)**
    *   ❌ **Noncompliant:** Executing heavy SQLite queries or disk sweeps synchronously on the main thread, or spinning up rogue `threading.Thread(target=..., daemon=True)` loops that evade the OS Metronome.
    *   ✅ **Gold Standard:** Returning a `202 Accepted` immediately with a `job_id`, deferring all execution to a formal `@ext_bp.worker` routed through `ctx.jobs.submit()`.

*   **Virtual File System Transactions (ADR 0004, 0018)**
    *   ❌ **Noncompliant:** Using native `open('file.md', 'w')`, `os.remove()`, or passing leaky abstraction flags like `ctx.vfs.save(..., data={"action": "delete"})` to remove files.
    *   ✅ **Gold Standard:** Exclusively using `ctx.vfs.save()` and the formalized `ctx.vfs.delete()` methods, ensuring mutations are correctly staged in the atomic write queue and broadcast to the Event Ledger.

*   **Spatial Pathing (ADR 0013)**
    *   ❌ **Noncompliant:** Using `os.path.join()` or raw string concatenation (`path + '/' + filename`).
    *   ✅ **Gold Standard:** Utilizing Python's native `pathlib.Path` standard (e.g., `Path(dir).joinpath(file).as_posix()`) to guarantee cross-platform resilience.

*   **YAML Frontmatter Generation**
    *   ❌ **Noncompliant:** Manually building Markdown headers via massive `f-string` concatenations, risking silent YAML formatting errors.
    *   ✅ **Gold Standard:** Importing `update_frontmatter(content, new_data)` from `utils_core.py` to guarantee safe serialization of lists, nulls, and strings.

---

## 3. Frontend Presentation & DOM Purity
The frontend chassis must remain a "dumb" visual grid, isolating business logic from the DOM.

*   **Layout Injection & UI Zones (ADR 0041)**
    *   ❌ **Noncompliant:** Utilizing legacy string hooks like `ExtensionRegistry.registerUIHook('zone:vfs-mutated', ...)` or injecting raw HTML fragments into hardcoded DOM zones.
    *   ✅ **Gold Standard:** Routing physical DOM elements through `layoutSlots` and `entityActions`, while routing lifecycle behaviors through `InSetuElement` methods (e.g., `onWorkspaceLoad`) or `window.inSetu.events`.

*   **Form Controls & Buttons (ADR 0025, 0034)**
    *   ❌ **Noncompliant:** Using raw HTML `<input>`, `<select>`, `<textarea>`, or firing network requests from a standard `<button>`.
    *   ✅ **Gold Standard:** Enforcing the `SUTRAM_FORM_CONTROL_MANDATE` by utilizing `<sutram-input>`, `<sutram-select>`, `<sutram-textarea>`, `<sutram-tag>`, and `<sutram-label>`. Wrapping all async network actions in `<sutram-async-btn>` or `this.api.bindJobAction` to handle loading states automatically.

*   **Layout Padding & Geometry Hacks**
    *   ❌ **Noncompliant:** Using negative margins (e.g., `margin: -20px -20px 0 -20px;`) to defeat a parent container's padding, which causes layout blowouts on mobile viewports.
    *   ✅ **Gold Standard:** Using the declarative `?flush=${true}` property on `<sutram-modal>` or `<sutram-collapsible>` to natively remove Shadow DOM padding, allowing child elements to flow cleanly edge-to-edge.

*   **API Network Gateway (ADR 0016)**
    *   ❌ **Noncompliant:** Using raw `fetch()` or manually constructing API paths like `/api/${workspaceId}/...`.
    *   ✅ **Gold Standard:** Routing entirely through `this.api.get()`, `this.api.post()`, or `this.api.postJson()`, which natively handle tenant scope isolation and security token handshakes.

---

## 4. Component Lifecycle & Ergonomics
Components must cleanly mount, unmount, and protect user data during interaction.

*   **Unmanaged Timers & Ghost Polling**
    *   ❌ **Noncompliant:** Using raw `setInterval()` or `setTimeout()` inside components.
    *   ✅ **Gold Standard:** Utilizing `this.registerInterval(callback, delayMs)` so the SDK can garbage-collect the timer during unmount.

*   **Viewport `@media` vs `@container` Queries**
    *   ❌ **Noncompliant:** Using viewport-bound `@media (max-width: ...)` queries to collapse component layouts, which breaks when components are slotted into constrained containers like side-panels.
    *   ✅ **Gold Standard:** Using CSS `@container` queries to ensure the component is 100% layout-agnostic and responds to its parent's width.

*   **Symmetric Zustand Mutation (Reference Caching)**
    *   ❌ **Noncompliant:** Mutating an object/array in memory and passing the exact same reference back to `Store.setState()`, causing silent render failures.
    *   ✅ **Gold Standard:** Using the spread operator to guarantee a pristine clone (e.g., `Store.setState({ obj: { ...obj } })`).

*   **Unprotected Modal Teardowns**
    *   ❌ **Noncompliant:** Allowing data-entry modals to instantly close when the user clicks the backdrop or hits ESC, wiping out un-saved text.
    *   ✅ **Gold Standard:** Intercepting the `@sutram-modal-closing` event to check for dirty state and prompting the user for confirmation before allowing the teardown.

*   **Date/Time Formatting Consolidation**
    *   ❌ **Noncompliant:** Calling `new Date().toLocaleString()` directly in the render function.
    *   ✅ **Gold Standard:** Consuming the SDK's `this.utils.formatDate(ts)` and `this.utils.timeAgo(ts)` helpers to guarantee exact ecosystem parity.

*   **Legacy System URIs**
    *   ❌ **Noncompliant:** Referencing `system://contexts/...` in routing logic or frontend state.
    *   ✅ **Gold Standard:** Strictly utilizing the `ctx://` scheme to represent virtual/ephemeral artifacts across the OS (ADR 0035).