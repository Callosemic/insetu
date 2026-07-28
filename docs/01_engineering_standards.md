# 01: inSetu Engineering Standards & Audit Guardrails

**Identity**: The Architect.
**Mission**: To define the strict engineering principles, performance guardrails, and architectural hygiene required to maintain the inSetu Developer OS and its Virtual File System (VFS).

---

## 1. Single Source of Truth (SSOT) & Spatial Physics
Logic, schemas, and configurations must exist in exactly one place. Redundancy breeds silent desynchronization across the local-first ecosystem.
* **The Configuration SSOT**: The `.insetu/profiles/*/config.json` is the absolute authority on workspace topologies, routing targets, and ignore rules. The OS kernel must never assume default namespaces or hardcode repository paths; it must read dynamically from the active profile. Any operations mutating or re-indexing workspace environments must explicitly invalidate centralized configuration caches (`_MUTATED_CONFIG_CACHE`) to prevent stale memory reads.
* **Cache Invalidation Mandate**: Any service, extension manager, or route handler that alters application settings or writes configuration structures to disk must systematically clear internal memory caches to prevent desynchronization between active data stores and spatial realities.
* **The Cartography Contract**: The codebase is not a database. `insetu/cartographer.py` determines file inclusion dynamically via a Single Source of Truth (`get_valid_workspace_files()`). Duplicating `os.walk` exclusion logic (e.g., ignoring `.git` or `node_modules`) inline in secondary scripts is strictly forbidden.
    * *The Omniscient Exception (Yomama):* The Sync Bridge inherently bypasses strict Cartography filters to retain its ability to patch arbitrary filetypes not yet mapped to the configuration (e.g., Genesis patches). However, its sweeping logic must still be centralized in `utils_core.py` (e.g., via a dedicated `get_omniscient_workspace_files()` method) to enforce global system bans (like protecting `.git`) without duplicating raw `os.walk` loops inside route handlers.
* **DRY Utility Centralization**: Any structural framework logic required by multiple engines MUST be centralized in `insetu/utils.py` (Tier 1 Kernel utilities) or `insetu/core/utils_core.py` (Tier 2 Developer OS physics).
"Fat Controllers" copying/pasting prefix logic are architectural failures.
* **The Artifact Parser Anti-Pattern**: Never parse generated output artifacts (e.g., compiled `.txt` diff dumps, RAG context payloads, or rendered UI strings) to determine system state or drive backend execution. Artifacts are strictly one-way projections for human or LLM consumption. Always query the underlying SSOT directly (e.g., executing `git status` via subprocess instead of reading a `_diffs.txt` file).
* **Stateless Multi-Tenancy & Scoped Request Routing**: The inSetu Developer OS handles multiple tenant environments statelessly inside the REST layer via explicit tracking scopes.
Swapping profiles dynamically must occur via frontend headers or parameterized URL paths without backend process restarts.
All backend managers, hooks, and extensions must accept an explicit request-scoped `workspace_id` parameter and completely reject un-parameterized global state storage. All extension API endpoints must map the tenant context directly within the route template layout (`/api/<workspace_id>/ext_name/verb`) to ensure absolute path-level data isolation and eliminate leaky dependencies on header-sniffing.
## 2. The Data Layer & CQRS Mandate
inSetu operates directly on the user's hard drive. However, relying purely on raw filesystem I/O for high-velocity UI queries introduces unacceptable bottlenecks.
* **Markdown as an Artifact**: `.tracker/` markdown files are human-readable, Git-friendly *artifacts*, not the live application database.
* **The SQLite Cache Index**: Upon daemon boot, physical files are indexed into an embedded SQLite/DuckDB cache layer. All UI filtering, Kanban rendering, and API reads (`/api/tracker/files`) MUST query the fast SQL layer.
* **CQRS Write-Path Separation**: When a user drags a Kanban ticket, the API must perform the mutation against the SQL layer (for instant UI feedback) and dispatch a background worker task to asynchronously write the `.md` mutation to the physical disk.
* **Surgical Editing & O(1) Updates**: Global re-indexing (`DELETE FROM table` followed by bulk re-insertion) or complete DOM annihilation is strictly banned as a response to singular events. Event listeners must extract target boundaries and execute granular `INSERT OR REPLACE` or localized DOM reconciliation.

## 3. The Virtual File System (VFS) & Atomic Commits
The Yomama Sync Bridge is a surgical tool. Applying string patches blindly to disk creates half-patched, uncompilable codebases if an LLM hallucinates halfway through a transmission.
* **The VFS Matrix**: All incoming patch payloads must be staged entirely within an in-memory Virtual File System. 
* **The Pre-Flight Syntax Guardrail**: Before any file is flushed to physical disk, the VFS must run native syntax validation (e.g., Python AST, native V8 JS parsing) against the *completed* in-memory matrices. 
* **Atomic Rollbacks**: Transactions are atomic. If a multi-file patch is received and a single file fails syntax validation or diff anchoring, the entire VFS transaction is aborted. 
* **The Semantic Strategy Pattern**: The bridge must route patches dynamically based on syntax reality:
    * **Strict Engine**: `.py` and `.yaml` files use strict statistical ratio math and absolute step delta matching. Whitespace is law.
    * **Structural Engine**: `.js` and `.ts` ignore line breaks and pipe outputs through AST formatters (e.g., Prettier).
    * **Object Engine**: `.json` bypasses text diffs entirely, recursively applying object tree mutations.
    * **Fuzzy Engine**: `.md` and `.txt` utilize flattened Levenshtein distances to survive LLM token-wrapping hallucination.

## 7. Architectural Fitness Functions (Automated Compliance)
Human discipline scales poorly. To guarantee that these engineering standards are never compromised by fatigue or rapid prototyping, this codebase is guarded by automated Static Analysis.

* **The Validator (`tests/fitness_functions.py`)**: A zero-dependency Python script utilizing native `ast` and `re` modules to parse the codebase and mathematically fail if an anti-pattern is detected.
* **Execution**: Run `python tests/fitness_functions.py` from the root directory to audit the workspace.
* **Extending the Rules**: When a new anti-pattern is identified and documented in a standup or ADR, it MUST be codified into the validator.
    * Add Python structural bans to the `BackendFitnessVisitor` (e.g., catching rogue `open()` or `subprocess.run` calls).
    * Add JavaScript frontend bans to `check_javascript_files()` (e.g., catching `setInterval` or `document.getElementById` violations).
* **The Whitelist Bypass**: If a core engine (like the VFS) legitimately requires a banned function, it must be explicitly added to the whitelists at the top of the script. Do not disable the rule globally.

## 4. Frontend: Unidirectional Data Flow (UDF)
The frontend UI must be highly resilient, reactive, and entirely decoupled from HTML DOM states.
* **The DOM Read Ban**: Modules (`kanban.js`, `bridge.js`) are strictly forbidden from reading state out of the DOM (e.g., querying `document.getElementById('...').value` or checking if an element `.classList.contains('active')` to determine business logic).
* **The Centralized Store**: The UI must operate as a pure function of a centralized state manager (Zustand or Vanilla PubSub in `store.js`). API payloads dispatch to the store; the DOM strictly subscribes to the store.
* **The "Full Refresh" Anti-Pattern**: UI state desynchronization (ghost tickets, orphaned modals) indicates a failure of the UDF contract. The system must natively heal its own state tree asynchronously without requiring the user to execute manual browser reloads.
* **Declarative URL Hash Routing SSOT**: Primary navigation, active sub-tabs, and deep workspace drill-down state MUST be driven strictly by `window.location.hash` (`#/{workspace_id}/{tab}/{sub-tab}/{deep_path}`) and mirrored reactively in `AppStore`. Direct reads or writes to `localStorage` for tab routing logic are strictly banned.
* **Event Bubbling Teardown Safeguard**: Nested modal views and transient components MUST check `e.target === e.currentTarget` during close/teardown handlers to prevent event bubbling from child elements from accidentally triggering teardown loops in ancestor shells.
* **The Low Memory Footprint Mandate**: The client layer must remain low-overhead to protect performance on low-spec and mobile platforms. The frontend is strictly banned from executing memory-intensive text chunking, holding massive multi-megabyte string buffers, or iterating over large regex arrays on raw text. All parsing, slicing, and segmentation operations must be offloaded to backend pipeline processes.

### 4.1 Polymorphic Presentation Purity (The Card Action Mandate)
Custom dashboard extensions are strictly prohibited from writing custom contextual button rows or injecting free-form template strings directly into file list elements. All contextual entity interactions must register as structured `entityActions` configurations within the global registry to guarantee unified visual alignment and preserve layout integrity across workspace profiles.
### 4.2 Strict State Immutability & Reference Cloning
When pulling complex objects or arrays from a Zustand slice via `getState()`, the raw object references must be treated as completely read-only. Modifying a nested key on an existing reference and feeding it back to `setState()` preserves identity parity and silences store broadcasts. 

You MUST always enforce pristine cloning before executing mutations:
* **Correct:** `const updatedManifest = { ...manifest };`
* **Incorrect:** `manifest[bucket].files.push(filepath); AppStore.setState({ manifest });`

### 4.3 Multi-Pass UI Layout Assembly (Hoisting Guardrail)
To prevent runtime render omissions inside the zero-bundler Single Page Application layout engine, the layout compilation routine must execute across a segmented multi-pass sequence. The layout assembly layer must first process and guarantee the physical mounting of all top-level Primary Navigation tab shells before attempting to register or mount dependent sub-navigation tracks, slot components, or action dropdown buttons. Extensions must never assume immediate sibling presence during script evaluation.

### 4.5 Component & Communication Isolation
All newly introduced system capabilities must implement the `InSetuExtension` framework on the backend and extend `InSetuElement` on the frontend. Direct manipulation of the HTTP event loop for long-running processes or raw `fetch` interactions outside the `this.api` boundary is strictly prohibited.
* **Stateless Shell Demolition & Namespacing Rule**: Frontend extension views and dashboard components must adhere strictly to the `insetu-ext-` tag prefix convention. The core workspace router executes an agnostic prefix sweep to evict elements during a tenant hot-swap. Hardcoding specific extension element tags or class definitions inside core micro-kernel reload scripts is strictly banned to preserve absolute Inversion of Control.

* **Dynamic Code-Splitting and Lazy-Loading**: Complex third-party asset libraries or language extensions (e.g., CodeMirror language grammars) must be imported dynamically (`await import(...)`) inside component lifecycles rather than bundled statically into top-level layout frameworks, keeping initial presentation pathways lean and responsive.

## 5. Asynchronous I/O & The Event Loop
inSetu runs via a local Python web server (Flask/Uvicorn). You must never paralyze the local event loop.
* **The I/O Block Ban**: Heavy workspace sweeps (e.g., parsing 500 files for Context Generation, executing blocking Git diff aggregations, spinning up cartography maps) MUST NOT block the main HTTP thread. All physical disk modifications, deletions, and massive multi-file collections must be executed through asynchronous off-thread background worker queues or pipelines.
* **Streaming Over Polling**: Offload these heavy generators into asynchronous background task queues. The frontend should connect via WebSockets or Server-Sent Events (SSE) to receive non-blocking, real-time status pulses (`"Compressing payload..."`, `"Mapping context..."`) rather than hanging on a 15-second HTTP request.
* **Full-Duplex Socket Isolation**: Extensions introducing persistent bi-directional streams (e.g., interactive PTY shells or real-time logs) must hook natively into the `flask-sock` interface exposed by the micro-kernel. WebSockets are strictly prohibited from spawning unmanaged long-running loops outside the ASGI thread coordinator, protecting the HTTP event loop from socket starvation.
* **Abortable Synchronization Barriers**: Long-running background workers or thread pools waiting on asynchronous VFS queues must avoid indefinite blocking calls (like raw `queue.join()`). They must execute abortable polling checks that actively evaluate shutdown signals (`_VFS_SHUTDOWN_SIGNAL`) or process termination event loops to ensure quick, safe teardowns during workspace switches.

## 6. The Yomama Patch Protocol (LLM Guardrails)
When collaborating with LLMs on the inSetu codebase, all file modifications MUST use the strict Genesis/Sync Bridge protocol. JSON patches are banned.
* **The Format**:
```text
<<<<<<< FILE: insetu/path/to/file.py
<<<<<<< SEARCH
[exact lines to match, including 1-2 lines of context]
[new lines to insert]
>>>>>>> REPLACE

```
* **The Patch Sandwich**: Always include 1-2 unchanged lines of code at the top AND bottom of the SEARCH block to anchor the spatial match and prevent duplicate patching.
* **No Stealth Directives**: If a feature requires new LLM instructions, do not hardcode the prompt string inside Python. Define it explicitly in `.insetu/profiles/*/prompts/` and map it through the declarative UI workflows.
* **Chassis Agnosticism**: The OS is blind to the user's specific project. Do not hardcode specific repository names inside `engine_gather.py` or `engine_bridge.py`. Assume dynamic workspaces infinitely.

## 8. Extension Coupling & Boundaries (Pragmatic Coupling)
While the inSetu architecture highly values decoupled, stateless operations, enforcing dogmatic decoupling for every interaction creates hard-to-trace architecture and breaks static analysis. Extensions must adhere to the "Pragmatic Coupling" model:
* **Loose Coupling (The Event Bus):** Use this for broadcasts, opportunistic data sharing, or optional enhancements (e.g., "A file was saved, does anyone want to format it?"). This ensures that if the target extension is disabled by the user, the requesting extension gracefully degrades rather than crashing. Use `hooks.emit()` or `hooks.emit_background()`.
* **Tight Coupling (Standard Python \`import\`):** Use this when one extension fundamentally cannot function without another and needs to share complex data structures, type hints, or classes (e.g., the `research` extension inherently relying on the `ingest` extension to parse web pages). This preserves IDE autocomplete, static analysis, and jump-to-definition capabilities.
* **The Anti-Pattern:** Do not build "stringly-typed" dynamic SDK RPC macros (e.g., `ctx.invoke('ext_name', 'function')`) just to avoid an `import` statement. If an extension needs direct, synchronous functional access to another, it should explicitly import it natively and declare it in its `__depends__` array to maintain the topological DAG.
