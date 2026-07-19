---
title: "Blueprint: SDK Tightening & Anti-Pattern Eradication"
date: 2026-07-18
author: Architect
status: approved
tags: ["Architecture", "SDK", "Technical Debt", "UDF"]
---

# Blueprint: SDK Tightening & Anti-Pattern Eradication

## 1. Context & Motivation
The inSetu Extension SDK (V2) was built organically alongside the features it was meant to support. While this rapid prototyping successfully encapsulated massive amounts of boilerplate, it also introduced several "magic" behaviors, race conditions, and architectural anti-patterns. 

To ensure long-term stability and a predictable Developer Experience (DX), we must tighten the SDK contracts. Explicit declarations must replace implicit sniffing, and synchronous lifecycle hooks must replace arbitrary timeouts.

---

## 2. Core Refactoring Targets

### A. Frontend: Race-Condition Hydration (`sdk.js`)
**The Problem:** Currently, `createExtensionStore` relies on arbitrary `setTimeout` delays (e.g., 0ms, 100ms) to guess when the core `AppStore` has initialized the active workspace before attempting to hydrate from `localStorage`. This creates a race condition leading to flashes of unhydrated content.
**The Blueprint:**
* Strip all `setTimeout` logic from `createExtensionStore`.
* Introduce a standardized `hydrate()` method on the generated stores.
* Shift the responsibility to the core OS Bootloader (`app.js`). Once `executeSecurityHandshake()` and `loadWorkspaces()` settle, the bootloader will explicitly call a centralized `window.inSetu.extensions.Registry.hydrateAllStores(workspaceId)` method.

### B. Frontend: Component Identity Crisis (`sdk.js`)
**The Problem:** `InSetuElement` attempts to dynamically guess its own `extName` by sniffing the DOM (`this.closest('[data-ext]')`) or manipulating its own tag name (`this.tagName.replace('insetu-ext-', '')`). This breaks encapsulation and causes API routing to fail if an extension author uses unexpected nesting or naming conventions.
**The Blueprint:**
* Deprecate the DOM-sniffing fallback.
* Enforce explicit declaration: any class extending `InSetuElement` MUST define a `static get extensionName()` property. 
* If the property is missing, throw a hard developer error rather than silently guessing.

### C. Backend: The Magic Generator Hijack (`extension.py`)
**The Problem:** The `@worker` decorator inside `InSetuExtension` uses `inspect.isgenerator` to hijack standard Python `yield` statements, transforming them on-the-fly into network progress updates via `update_immediate_job_status`. This violates the Principle of Least Surprise and prevents developers from using generators for standard data iteration.
**The Blueprint:**
* Remove the `yield` interception from the `@worker` wrapper.
* Expand the `ctx` object payload to include a discrete `JobController`.
* Extension authors will explicitly call `ctx.jobs.update_progress("Scanning files...")` instead of `yield "Scanning files..."`.

### D. Backend: The Global Cache Nuke (`extension.py`)
**The Problem:** The `SettingsManager` forcefully clears the global `_MUTATED_CONFIG_CACHE` every time a local extension setting is updated. Changing a simple API key in an extension forces the core OS to recalculate the entire Cartographer topology on the next request.
**The Blueprint:**
* Isolate `SettingsManager` caching. It should maintain its own thread-safe memory dictionary for `ext_name.settings.json`.
* Global cache invalidation in `utils_core.py` should be strictly reserved for mutations to the core workspace `config.json` matrix.

### E. Frontend: DOM-Sniffing Card Actions (UDF Violation)
**The Problem:** The polymorphic `entityActions` registry requires extensions to trigger callbacks by targeting elements imperatively via the DOM (e.g., `document.querySelector('insetu-ext-tracker')._transitionTask(...)`). This directly violates our Unidirectional Data Flow rules and introduces runtime brittleness if an layout tab or slot structure transitions.
**The Blueprint:**
* Completely decouple business logic out of Lit presentation views.
* Require extensions to export functional state action managers (e.g., `TrackerActions.transitionTask(data)`) that fire network API mutations and handle store state changes independently. 
* Registry configurations will invoke these standalone modules directly, completely removing element sniffing hacks.

### F. Backend: Parallel Job Ledger Fragmentation
**The Problem:** The core `immediate_jobs` database schema is too rigid, forcing extensions (such as the Research tool) to spin up parallel SQLite database tables (e.g., `research_jobs`) simply to track custom runtime metrics like `processed_links` and `total_links`.
**The Blueprint:**
* Expand the central `immediate_jobs` ledger schema to include a generic, optional `meta_json` column.
* Expose a structured `ctx.jobs.update_meta(dict)` method inside the background worker substrate, allowing extensions to track progress indicators seamlessly without local database sprawl.

### G. Backend: Lightweight ORM Database Wrapper Gaps
**The Problem:** The `DatabaseWrapper` (`ctx.db`) only provides `get_all`, `insert_or_replace`, and `delete`. This forces extensions to fall back to writing raw, unverified SQL text statements across their route handlers for trivial key updates (e.g., executing raw `UPDATE` strings).
**The Blueprint:**
* Ingest higher-level, type-safe CRUD utilities directly into the core SDK `DatabaseWrapper` object.
* Implement structured `.update(table, data, where_col, where_val)` and `.get_by_id(table, id_val)` primitives natively.

### H. Frontend: Fragile Duplicate Frontmatter Parsers
**The Problem:** The backend handles Markdown metadata cleanly via core Python processing singletons. However, frontend views duplicate this processing using complex, inline regex code blocks inside their component logic (e.g., `ext_tracker.js`), running the risk of formatting and syntax desynchronization.
**The Blueprint:**
* Standardize a centralized, high-performance `window.inSetu.utils.parseFrontmatter` primitive inside the frontend SDK.
* All dashboard markdown and file manipulation views must consume this unified utility to preserve absolute layout metadata parity.

---

## 3. Execution Plan
- [ ] **Phase 1: Backend SDK Tightening**
  - Refactor the `@worker` decorator in `insetu/sdk/extension.py`.
  - Update all active backend extensions (`engine_gather`, `engine_freshdesk`, `engine_git`, etc.) to replace `yield` with `ctx.jobs.update_progress()`.
  - Sandbox the `SettingsManager` cache logic.
  - Expand `immediate_jobs` schema with the `meta_json` column and append `.update()` / `.get_by_id()` CRUD models to `DatabaseWrapper`.

- [ ] **Phase 2: Frontend SDK Tightening**
  - Implement `static get extensionName()` across all UI components (`ext_tracker.js`, `ext_freshdesk.js`, etc.).
  - Strip `setTimeout` from `sdk.js` store creation.
  - Wire up the explicit `hydrateAllStores` trigger in `app.js`'s DOMContentLoaded loop.
  - Extract imperative `document.querySelector` lookups from `entityActions` into standalone business logic managers.
  - Implement centralized `window.inSetu.utils.parseFrontmatter` template primitives.

- [ ] **Phase 3: Documentation Sync**
  - Update `05_extension_developer_guide.md` to reflect the new explicit `ctx.jobs.update_progress()` contract and the `extensionName` getter requirement.