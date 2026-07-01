# V2 Architecture & Extension Migration Sequence

> ⚠️ **SUPERSEDED:** This blueprint sequence was successfully completed on 2026-07-01 with the implementation of request-scoped stateless multi-tenancy and the complete transition to the Unified Zustand Store. It is retained solely for historical lineage audits.

**Date:** 2026-06-28

To prevent rewriting logic and destroying tight state couplings during the transition to our Extension API and V2 Blueprint, we must execute the architectural migrations in this exact deterministic order:

### Step 1: The API Substrate (The Sockets)
Before extracting anything, the core OS needs the sockets to accept extensions natively.
* **Backend:** Build `insetu/hooks.py` (the Event Bus) and implement the `@hooks.on('mutate_workspace_config')` trigger inside `engine_gather.py` and `cartographer.py`.
* **Frontend:** Upgrade `window.ExtensionRegistry` in `app.js` to support context-aware `registerUIHook(zoneId)` injections.

### Step 2: The Great Decoupling (The Micro-Kernel)
Physically sever the Kanban Tracker and Git Operations from the core OS.
* Extract into `engine_tracker.py` and `engine_git.py`.
* Inject their `.tracker/` context requirements via the config mutation hook, stripping all hardcoded references out of the core RAG compiler.
* *Crucial constraint:* Do not optimize them yet. Just move their existing, legacy code into the extension boundaries.

### Step 3: Phase 2 — Frontend State Hardening (UDF)
With the core OS acting as a pure, isolated Micro-Kernel, implement `store.js` (Vanilla PubSub / Zustand).
* The core UI stops reading from the DOM.
* The newly isolated `ext_tracker.js` and `ext_git.js` are upgraded to dispatch actions to the central store, achieving UDF compliance without polluting the core OS state.

### Step 4: Phase 3 — The Data Layer Swap (SQLite)
With the frontend acting as a pure, reactive function, gut the backend of `engine_tracker.py`. Replace its expensive, blocking Markdown-regex reads with a fast SQLite index.

### Step 5: Phases 4 through 6
Proceed with Asynchronous I/O streaming, the VFS Semantic Strategy pattern, and the final infrastructure polish on a rock-solid, decoupled foundation.