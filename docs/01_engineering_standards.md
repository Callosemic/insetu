# 01: inSetu Engineering Standards & Audit Guardrails

**Identity**: The Architect.
**Mission**: To define the strict engineering principles, performance guardrails, and architectural hygiene required to maintain the inSetu Developer OS and its Virtual File System (VFS).

---

## 1. Single Source of Truth (SSOT) & Spatial Physics
Logic, schemas, and configurations must exist in exactly one place. Redundancy breeds silent desynchronization across the local-first ecosystem.
* **The Configuration SSOT**: The `.insetu/profiles/*/config.json` is the absolute authority on workspace topologies, routing targets, and ignore rules. The OS kernel must never assume default namespaces or hardcode repository paths; it must read dynamically from the active profile.
* **The Cartography Contract**: The codebase is not a database. `insetu/cartographer.py` determines file inclusion dynamically via a Single Source of Truth (`get_valid_workspace_files()`). Duplicating `os.walk` exclusion logic (e.g., ignoring `.git` or `node_modules`) inline in secondary scripts is strictly forbidden.
    * *The Omniscient Exception (Yomama):* The Sync Bridge inherently bypasses strict Cartography filters to retain its ability to patch arbitrary filetypes not yet mapped to the configuration (e.g., Genesis patches). However, its sweeping logic must still be centralized in `utils_core.py` (e.g., via a dedicated `get_omniscient_workspace_files()` method) to enforce global system bans (like protecting `.git`) without duplicating raw `os.walk` loops inside route handlers.
* **DRY Utility Centralization**: Any structural logic required by multiple engines (e.g., resolving absolute workspace paths, sanitizing directory names into `dot_` prefixes, parsing JSON safely) MUST be centralized in `insetu/utils_core.py`.
"Fat Controllers" copying/pasting prefix logic are architectural failures.
* **The Artifact Parser Anti-Pattern**: Never parse generated output artifacts (e.g., compiled `.txt` diff dumps, RAG context payloads, or rendered UI strings) to determine system state or drive backend execution. Artifacts are strictly one-way projections for human or LLM consumption. Always query the underlying SSOT directly (e.g., executing `git status` via subprocess instead of reading a `_diffs.txt` file).

## 2. The Data Layer & CQRS Mandate
inSetu operates directly on the user's hard drive. However, relying purely on raw filesystem I/O for high-velocity UI queries introduces unacceptable bottlenecks.
* **Markdown as an Artifact**: `.tracker/` markdown files are human-readable, Git-friendly *artifacts*, not the live application database.
* **The SQLite Cache Index**: Upon daemon boot, physical files are indexed into an embedded SQLite/DuckDB cache layer. All UI filtering, Kanban rendering, and API reads (`/api/tracker/files`) MUST query the fast SQL layer.
* **CQRS Write-Path Separation**: When a user drags a Kanban ticket, the API must perform the mutation against the SQL layer (for instant UI feedback) and dispatch a background worker task to asynchronously write the `.md` mutation to the physical disk.

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

## 4. Frontend: Unidirectional Data Flow (UDF)
The frontend UI must be highly resilient, reactive, and entirely decoupled from HTML DOM states.
* **The DOM Read Ban**: Modules (`kanban.js`, `bridge.js`) are strictly forbidden from reading state out of the DOM (e.g., querying `document.getElementById('...').value` or checking if an element `.classList.contains('active')` to determine business logic).
* **The Centralized Store**: The UI must operate as a pure function of a centralized state manager (Zustand or Vanilla PubSub in `store.js`). API payloads dispatch to the store; the DOM strictly subscribes to the store.
* **The "Full Refresh" Anti-Pattern**: UI state desynchronization (ghost tickets, orphaned modals) indicates a failure of the UDF contract. The system must natively heal its own state tree asynchronously without requiring the user to execute manual browser reloads.

## 5. Asynchronous I/O & The Event Loop
inSetu runs via a local Python web server (Flask/Uvicorn). You must never paralyze the local event loop.
* **The I/O Block Ban**: Heavy workspace sweeps (e.g., parsing 500 files for Context Generation, executing blocking Git diff aggregations, spinning up cartography maps) MUST NOT block the main HTTP thread. 
* **Streaming Over Polling**: Offload these heavy generators into asynchronous background task queues. The frontend should connect via WebSockets or Server-Sent Events (SSE) to receive non-blocking, real-time status pulses (`"Compressing payload..."`, `"Mapping context..."`) rather than hanging on a 15-second HTTP request.

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
