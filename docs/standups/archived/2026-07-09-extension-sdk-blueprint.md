---
repo: "insetu"
type: "todo"
status: "open"
id: INS-TODO-20260709_2219_EXTENSION_SDK
title: "Phase 7: The Extension SDK & 'Pit of Success' Architecture"
created_at: 2026-07-09T22:19:00
closed_at: null
sub_bucket: "None"
tags: ["Architecture", "DX", "SDK"]
---

# Architecture Blueprint: The Extension SDK & "Pit of Success"

**Date:** 2026-07-09
**Mission:** To radically simplify extension development by providing an SDK that natively abstracts multi-tenant routing, state teardowns, and VFS boundaries. The easiest way to write an extension must inherently be the most compliant way.

## The Problem
Currently, extension authors must memorize our 6 architectural standard documents. They have to manually prepend `<workspace_id>` to Flask routes, manually invoke `sniff_tenant_id()`, manually track and tear down Zustand `AppStore` subscriptions to prevent memory leaks, and manually write `CREATE TABLE` loops for SQLite. This boilerplate is brittle and invites technical debt.

## The Blueprint

### 1. Frontend: The `InSetuElement` Base Class
We will ship a base class that wraps `LitElement` to handle OS-level lifecycle management invisibly.
* **Auto-Teardown:** Automatically tracks all Zustand store subscriptions and destroys them on `disconnectedCallback`, preventing cross-tenant ghosting.
* **Injected Context:** Exposes `this.workspaceId` as a reactive property, updating automatically on tenant hot-swaps.
* **Intent-Driven API Client:** Exposes `this.api.get(path)` and `this.api.post(path, payload)`, which internally route to `window.inSetu.api.workspace`, natively prepending `/api/<workspace_id>/<ext_name>/`.

### 2. Backend: The `InSetuExtension` Blueprint Wrapper
We will wrap Flask's `Blueprint` in a custom `Extension` class that strictly enforces the `02_extension_api_contract.md`.
* **Auto-Routing:** When an extension registers `@ext.route('/data')`, the wrapper compiles the true route to `/api/<workspace_id>/ext_name/data`.
* **The Context Object (`ctx`):** Route handlers will receive a pre-scoped `ctx` object instead of raw Flask request parameters. 
    * `ctx.db` provides a connection already keyed to the active workspace.
    * `ctx.vfs.save()` routes payloads to the asynchronous background queue without requiring manual imports of `execute_vfs_save`.
* **VFS Transaction Manager:** Introduce `with ctx.vfs.transaction():` to batch multiple file saves into a single atomic commit payload.

### 3. Declarative SQLite Schemas
Extensions will no longer hook into `system_boot` to write raw SQL generation strings.
* **Schema Dictionaries:** Extensions will export a `SCHEMA` dictionary (e.g., `{"tracker_tickets": {"id": "TEXT PRIMARY KEY", "status": "TEXT"}}`).
* **Auto-Migrations:** The core OS `db.py` layer will read these schemas on boot, generating `CREATE TABLE` and executing `ALTER TABLE ADD COLUMN` migrations natively via diffing.

### 4. Zustand Store Factories
Writing a UDF-compliant Zustand store currently requires importing middleware and handling local storage.
* **`createExtensionStore(name, initialState)`:** A frontend SDK helper that automatically wraps the store in `devtools` and `subscribeWithSelector`, scopes `localStorage` persistence keys by `workspace_id` to prevent cross-tenant bleeding, and injects a default `resetState` action.

### 5. CLI Scaffold (`insetu generate extension`)
We will expand `cli.py` to include a generation command: `insetu generate extension "Feature Name"`.
* Instantly stamps out `insetu/extensions/engine_feature_name.py` and `insetu/static/js/extensions/ext_feature_name.js`.
* Auto-registers the declarative UI layout payload.
* Appends the extension to the active `config.json` matrix.

### 6. Typed Event Bus
* Implement Python `TypedDict` and JSDoc typedefs for Event Bus payloads (e.g., `post_file_save`, `compile_contexts`). This provides IDE auto-completion for extension authors, ensuring they know exactly what keys (like `filepath`, `workspace_id`) are available in the hook callbacks.

### 7. Advanced Core Abstractions
Based on our architectural review of `engine_prompts.py`, the SDK must also absorb the following boilerplate:
* **Spatial Physics (`ctx.paths` & `ctx.resolve_path`):** The `ExtensionContext` will natively expose `get_gather_paths` and `resolve_workspace_path` so extensions don't need to manually import or pass `workspace_id`.
* **Configuration Cache (`ctx.config`):** A property that safely fetches the active tenant's `config.json` via `load_config(self.workspace_id)`.
* **VFS Directory Sweeping (`ctx.vfs.walk`):** A protected generator that yields valid files matching an extension array, bounding the traversal to the tenant workspace.
* **Declarative Virtual Contexts:** Extensions should be able to pass a `virtual_contexts` array to `InSetuExtension` on boot, allowing the OS to auto-inject their virtual `.txt` files into the context manifest without bespoke `mutate_workspace_config` loops.

## 8. The Component Graduation Checklist (Compliance Guardrails)
Before an extension is considered fully migrated to the V2 SDK, it must pass the following structural checks.
### Frontend (The `InSetuElement` Contract)
1. **Inheritance**: The primary UI class must `extend InSetuElement` (not `LitElement`).
2. **State Management**: Banned raw Zustand `createStore` imports. Must use `createExtensionStore('Name', initialState)`.
3. **Network Routing**: Raw `fetch()` calls and manual URL concatenations (`/api/${workspace}/...`) are strictly banned. Use `this.api.get()`, `this.api.post()`, etc.
4. **Store Subscriptions**: Manual un-subscription variables (`this._unsub`) inside `disconnectedCallback` are banned. Use `this.subscribe(Store, selector, callback)`.
5. **Tenant Lifecycle**: Do not manually subscribe to `activeWorkspace` changes in the AppStore. Implement the `onWorkspaceChanged(ws)` method instead.
6. **State Sniffing**: Banned `localStorage.getItem()` for checking UI states (e.g., active tabs). Use `AppStore.getState().activeSubTabs` for strict UDF compliance.
7. **Async Button State**: Manual UI tracking for loading spinners, `origText` variables, and `setTimeout` reverting on buttons is banned. Use `<insetu-async-btn>` with an `asyncAction` callback.
8. **Fuzzy Search**: Manual filter loops on file arrays are banned if using `<insetu-file-tree>`. Pass `.enableSearch=${true}` and `.searchPlaceholder="..."` instead.

### Backend (The `InSetuExtension` Contract)
1. **Inheritance**: The Flask blueprint must be instantiated via `InSetuExtension('name', __name__)`.
2. **Declarative Schemas**: Banned `@hooks.on('system_boot')` loops that run `CREATE TABLE`. Must pass a declarative schema dictionary to the `InSetuExtension` constructor.
3. **Auto-Routing**: Banned explicit route prefixes (`@bp.route('/api/<workspace_id>/name/list')`). Routes must be strictly relative (`@bp.route('list')`).
4. **The Context Object**: Route handlers must accept the `ctx` object instead of raw `workspace_id` strings.
5. **Path Physics**: Banned `get_gather_paths()` and `resolve_workspace_path` imports. Use `ctx.paths` and `ctx.resolve_path()`.
6. **VFS Walk & Read**: Banned raw `os.walk` and `open(f, 'r')`. Use `ctx.vfs.walk()` and `ctx.vfs.read()`.
7. **Config Cache**: Banned `load_config()` imports. Use `ctx.config`.

## 9. Migration Tracker (ADR 0016 & V2 SDK)

### Core OS UI Domains (Frontend API Client)
| Module | Domain Role | Fetch Status | Notes |
| :--- | :--- | :--- | :--- |
| `app` | Global Gateway | **Migrated** | Exposes `window.inSetu.api`. Legacy interceptor deprecated. |
| `fs` | Virtual File System | **Migrated** | |
| `config` | Workspace Settings | **Migrated** | |
| `gather` | Context Gatherer | **Migrated** | |

### Extensions (Frontend & Backend SDK)
| Extension ID | Frontend API Client | Backend SDK (`InSetuExtension`) |
| :--- | :--- | :--- |
| `tracker` | **Migrated** | Pending |
| `citations` | **Migrated** | Pending |
| `git` | **Migrated** | Pending |
| `flow` | **Migrated** | Pending |
| `format` | **Migrated** | Pending |
| `research` | **Migrated** | Pending |
| `skills` | **Migrated** | Pending |
| `prompts` | **Gold Standard (SDK V2)** | **Gold Standard (SDK V2)** |
| `favorites` | **Gold Standard (SDK V2)** | **Gold Standard (SDK V2)** |
| `ingest` | **Gold Standard (SDK V2)** | **Gold Standard (SDK V2)** |
| `term` | **Migrated** | N/A |

## 9.5. Learnings from Phase 1 V2 SDK Migrations (July 10, 2026)
In graduating the `prompts`, `favorites`, and `ingest` extensions to full SDK compliance, we established the following critical guardrails to prevent regressions:
1. **Eliminate Synchronous I/O in the Ingestion Engine**: Network fetches (`urllib.request`) on the main Flask request thread freeze the event loop. Always offload to the `immediate_jobs` ledger and return a `202 Accepted` to allow the frontend to poll status via the metronome.
2. **Eradicate State Over-Fetching in Bookmarks**: Deleting or mutating a small record should not trigger a global network refetch. The frontend store MUST eagerly splice the deleted element out of the active array in memory to achieve instant O(1) rendering updates.
3. **Abstract Virtual Configurations into the Backend SDK**: Extensions must not manually subscribe to the event bus (`@hooks.on('mutate_workspace_config')`) just to announce their directories. Use the declarative `virtual_contexts` and `target_repos` arrays inside the `InSetuExtension` backend constructor to automatically register paths.

## Next Steps
1. Build out `ctx.paths`, `ctx.config`, and `ctx.vfs.walk` in `sdk/extension.py`.
2. Build the `InSetuElement` Lit wrapper and `createExtensionStore` factory in `app.js`.

## 10. Pushing Primitives Down (Micro-Kernel Alignment)
The tools built for the SDK (`VFSTransaction`, `paths`, and `config` resolution) are fundamentally OS-level primitives. They must be pushed down into the core substrate so the OS can rely on its own guarded logic without wrapping itself in a plugin interface.
### Action Items for Tomorrow
- [x] **Extract Core Primitives:** Move `VFSTransaction`, path resolution, and config fetching out of `insetu/sdk/extension.py` and into a new core substrate file (e.g., `insetu/context.py` or `insetu/utils_core.py`).
- [x] **Refactor SDK:** Update the `InSetuExtension` wrapper to simply consume these extracted core primitives and package them into the `ctx` object for extensions.
- [x] **Core Integration - Sync Bridge (`engine_bridge.py`):** - Instantiate `with VFSTransaction(workspace_id) as vfs:` directly inside the `execute_bridge_sync` transaction loop.
    - Use this to achieve atomic, rollback-protected multi-file patch commits. If a syntax validation step fails on file #3 of a patch, the context manager will exit with an exception, and the transaction buffer will flush without writing a single corrupted file to the asynchronous VFS queue.
- [x] **Core Integration - RAG Compiler (`engine_gather.py`):**
    - Replace all manual `os.walk` loops and `os.path` concatenations with `vfs.walk()` and `resolve_path()`.
    - This forces the compiler to rely on the strictly guarded spatial boundaries built into the SDK, making context compilation inherently safer and eradicating raw boilerplate.