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

*   **Tenant-Scoped Storage & Topology Isolation**
    *   ❌ **Noncompliant:** Direct un-scoped `localStorage` reads/writes for tenant state (e.g. `localStorage.setItem('insetu_offline_config', ...)`), or mirroring `AppStore` topology properties (`targetConfigs`, `allRepos`) in domain stores.
    *   ✅ **Gold Standard:** Consuming `this.utils.getScopedStorage()` / `setScopedStorage()` for workspace-scoped client persistence and reading workspace topology reactively via `this.ecosystem` or `AppStore`.

*   **Floating Global Listeners (ADR 0025)**
    *   ❌ **Noncompliant:** Placing `window.addEventListener` at the bottom of the module scope. This evades garbage collection and creates exponential memory leaks during workspace swaps.
    *   ✅ **Gold Standard:** Binding listeners strictly inside `connectedCallback()` using `this.registerGlobalListener()`, which the `InSetuElement` SDK automatically destroys on unmount.

---
## 2. Backend OS Substrate & I/O Hygiene
The backend must never block the ASGI event loop or bypass the topology ledgers.
*   **Async Worker Execution & Typed Worker Contracts (ADR 0005, 0034)**
    *   ❌ **Noncompliant:** Executing heavy SQLite queries or disk sweeps synchronously on the main thread, spinning up rogue `threading.Thread(target=..., daemon=True)` loops, `@*.worker` functions missing `ctx` as their first parameter or missing explicit type annotations on parameters, overloading `force_full` with `list`, or `ctx.jobs.submit()` calls missing `job_category`.
    *   ✅ **Gold Standard:** Deferring all heavy execution to a formal `@ext_bp.worker` declaring `ctx` first with explicit parameter type annotations (`WORKER_TYPED_SIGNATURE_MANDATE`), and dispatching via `ctx.jobs.submit(..., job_category=...)`.
*   **Virtual File System Transactions (ADR 0004, 0018)**
    *   ❌ **Noncompliant:** Using native `open('file.md', 'w')`, `os.remove()`, or passing leaky abstraction flags like `ctx.vfs.save(..., data={"action": "delete"})` to remove files.
    *   ✅ **Gold Standard:** Exclusively using `ctx.vfs.save()` and the formalized `ctx.vfs.delete()` methods, ensuring mutations are correctly staged in the atomic write queue and broadcast to the Event Ledger.

*   **Two-Pass Boot Lifecycle (ADR 0045)**
    *   ❌ **Noncompliant:** Executing `ctx.vfs.save()`, submitting heavy background workers, or triggering disk mutations during the `@hooks.on('workspace_boot')` lifecycle phase, which causes I/O starvation.
    *   ✅ **Gold Standard:** Registering schemas and memory states during `workspace_boot` (Phase 1), and deferring all physical disk mutations and background compilation tasks to the `@hooks.on('topology_boot_complete')` hook (Phase 2).

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
    *   ❌ **Noncompliant:** Using negative margins (e.g., `margin: -20px -20px 0 -20px;`) to defeat a parent container's padding, or hardcoding fixed horizontal margins/padding on layout primitives to compensate for container constraints.
    *   ✅ **Gold Standard:** Using the declarative `?flush=${true}` property on `<sutram-modal>` or `<sutram-collapsible>` to natively remove Shadow DOM padding, allowing child elements to flow cleanly edge-to-edge. Rely on the parent container (e.g., `<sutram-scroll-view>`) to establish unified bounding box padding.
*   **API Network Gateway & Canonical Route Prefix (ADR 0016)**
    *   ❌ **Noncompliant:** Using raw `fetch()`, manually constructing `/api/${workspaceId}/...` URLs, or passing un-prefixed relative route strings (`this.api.get('list')`).
    *   ✅ **Gold Standard:** Routing entirely through `this.api.getJson('<module>/<endpoint>')` or `this.api.postJson('<module>/<endpoint>', payload)` with an explicit `<module>/<endpoint>` prefix (`CANONICAL_API_ROUTE_PREFIX_MANDATE`).

*   **Non-Destructive Loading States**
    *   ❌ **Noncompliant:** Completely unmounting DOM lists or replacing the active view with a `<div class="spinner">` during data refreshes, triggering severe Layout Shifts and obliterating spatial memory.
    *   ✅ **Gold Standard:** Maintaining the existing DOM structure, projecting a localized `<sutram-spinner>` banner, and securing the stale content using `opacity` fades and `pointer-events: none`.

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

---
## 5. Security & Exposure
An extension that adds routes, runs commands, writes files or starts servers is reachable from phones over Tailscale and from LLM agents. These are the minimum bar; the full rules are in `01_engineering_standards.md` §9.

*   **Public Routes**
    *   ❌ **Noncompliant:** Adding a path to `public_routes` or `public_prefixes` to get an endpoint working from a phone, adding a public path suffix, or making a public route accept POST, PUT, PATCH or DELETE.
    *   ✅ **Gold Standard:** Leaving the route behind the token gate. If something truly must be public, adding it with a reason to the public list in `tests/unit/test_route_auth_inventory.py` in the same commit, read-only.
*   **Running Commands**
    *   ❌ **Noncompliant:** Accepting `command` plus `approve: true` in a payload, adding a code-running capability to `READ_ONLY_MODE_ALLOWED_CAPABILITIES`, or running a caller-chosen command without a recorded approval.
    *   ✅ **Gold Standard:** Running only the configured default or a command a person approved through a route declared with `mcp_expose=False` and listed in `ROUTINE_BANNED_CAPABILITIES`.
*   **File Access**
    *   ❌ **Noncompliant:** `open(path, "w")` or `os.remove(path)` on a path from a request, or reading files outside mounted volumes.
    *   ✅ **Gold Standard:** `ctx.vfs.save()`, `ctx.vfs.read()` and `ctx.vfs.delete()`, which confine paths to the workspace and refuse protected recovery files.
*   **Network Servers**
    *   ❌ **Noncompliant:** Binding `0.0.0.0` by default or at boot, launching code-running tools with `--no-token`, or sending `Access-Control-Allow-Origin: *` from a server that can read repository files.
    *   ✅ **Gold Standard:** Binding `127.0.0.1`, reaching remote devices through Tailscale HTTPS, and opening to the LAN only through a person's time-limited grant.
*   **Secrets**
    *   ❌ **Noncompliant:** Putting tokens or API keys in URLs, logging them, storing them in error records, or sending unscrubbed context to an LLM provider.
    *   ✅ **Gold Standard:** Headers for credentials, `scrub_outbound_secrets` on outbound context, and settings marked `secure` for secret values.

