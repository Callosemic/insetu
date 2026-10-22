---
id: note-f30vr4oo
title: insetu workplan
repo: insetu
sub_bucket: None
tags: []
created_at: '2026-10-15T19:18:45'
updated_at: '2026-10-18T16:16:59'
---

## insetu workplan

I applied all batches, but some questions:
1) why are there separate meta.repo and meta.repos?
2) 









The four systemic architectural improvements described in the previous retrospective that have not yet been patched are:

---

### 1. Bootloader Importmap Cache-Busting Unification (Frontend Module Deduplication)

* **The Problem:** `ExtensionRegistry.loadBatches()` in `sutram/sutram/js/sutram_sdk.js` dynamically loads scripts with a `?v=${bootTs}` query string, whereas static `import` statements inside ES modules (like `ui_editor.js`, `store.js`, `insetu_sdk.js`, `sutram_sdk.js`, and `utils.js`) use bare path URLs without `?v=`. Because browser ES module registries key modules by their exact URL string, any file imported both ways is evaluated twice.


* **The Systemic Solution:**
* **Option A (Zero-Friction):** Remove `?v=${bootTs}` from `loadBatches()` in `sutram/sutram/js/sutram_sdk.js`. Because `insetu/insetu/app.py` already enforces `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` on every HTTP response and `fullRefresh()` explicitly purges the Service Worker cache before reloading, the `?v=${bootTs}` query string on dynamic `import()` calls is redundant and is the sole cause of URL-key splitting between static and dynamic imports.


* **Option B (Importmap Prefix Mapping):** Have `resolve_js_vendors()` in `insetu/insetu/app.py` inject path-prefix mappings (e.g., `"/static/extensions/": "/static/extensions/"` or explicit core module entries) alongside a unified boot version strategy.




* **Target Files:**
* `sutram/sutram/js/sutram_sdk.js` (`ExtensionRegistry.loadBatches`)


* `insetu/insetu/app.py` (`resolve_js_vendors`)




* **Scope:** Small (~10 lines of code).

---

### 2. Centralized Canonical URI Normalizers & Declarative SQLite URI Migrations (SSOT Boundary Enforcement)

* **The Problem:** Multiple extensions maintain their own ad-hoc URI normalization functions and manual boot-time SQLite `UPDATE ... WHERE filepath NOT LIKE '%://%'` queries:
* **Backend:** `_ensure_editor_prefs_hydrated` (`engine_editor.py`), `_ensure_cronic_hydrated` (`engine_cronic.py`), `_ensure_favorites_hydrated` (`engine_favorites.py`), `_ensure_skills_hydrated` (`engine_skills.py`), `initialize_tracker_schemas` (`engine_tracker.py`), `init_topology_on_boot` (`engine_topology.py`), and `_canonicalize_uri_str` (`engine_gather.py`).


* **Frontend:** `normalizeVfsURI` (`fs.js`) and `canonicalizeFlowUri` (`ext_flow.js`).




* **The Systemic Solution:**
1. **Python SSOT (`InSetuURI.canonicalize`):** Add a single `@classmethod def canonicalize(cls, raw: Any, default_scheme: str = "vfs") -> str` on `InSetuURI` in `insetu/insetu/core/utils_core.py` that handles domain-aware prefixing (`_diffs.txt` $\rightarrow$ `ctx://diffs/`, `_context.txt` $\rightarrow$ `ctx://contexts/`, `prompts/` $\rightarrow$ `ctx://prompts/`, default $\rightarrow$ `vfs://`), and delegate `_canonicalize_uri_str` in `engine_gather.py` and `extract_manifest_files` in `utils_core.py` to it.


2. **Declarative SQLite Schema URI Healing (`akasa/akasa/db.py`):** Allow `apply_declarative_schema()` in `akasa/akasa/db.py` (or a kernel hook) to automatically heal scheme-less URI primary/foreign keys without crashing on `UNIQUE` constraint collisions (using the delete-colliding-then-update pattern).


3. **Frontend SSOT (`window.inSetu.utils.canonicalizeURI`):** Define `canonicalizeURI(raw, defaultScheme = 'vfs')` once in `insetu/insetu/core/system/insetu_sdk.js`, alias `window.inSetu.vfs.normalizeVfsURI` to it in `fs.js`, and delegate `canonicalizeFlowUri` in `ext_flow.js` to it.




* **Target Files:**
* `insetu/insetu/core/utils_core.py`

* `insetu/insetu/core/system/insetu_sdk.js`

* `insetu/insetu/core/fs/fs.js`

* `insetu/insetu/extensions/flow/ext_flow.js`



* **Scope:** Small-to-Medium (~45 lines of code across 4 files).

---

### 3. Unified Kernel I/O Executor (`ctx.jobs.map_parallel`) to Eliminate Ephemeral Thread Pools

* **The Problem:** During compilation pipelines, three different modules spin up their own nested `with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:` blocks inside tasks that are *already* running inside the Akasa worker pool (`_executor`):
* `insetu/insetu/core/cartographer/cartographer.py` (`map_repositories`, line 161)


* `insetu/insetu/core/gather/engine_gather.py` (`_surgically_update_manifest`, line 321 & `generate_context_file`, line 376)


* `insetu/insetu/extensions/git/engine_git.py` (`generate_diff_context`, line 273)
Every time a compilation chain runs, those `with ThreadPoolExecutor(...)` blocks spawn 15–20 brand-new OS threads, open new thread-local SQLite connections on those temporary threads (which are **never closed** via `close_thread_connections()` when the `with` block exits!), and reserve new `glibc` memory arenas.




* **The Systemic Solution:**
1. Add a shared, bounded `_io_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="Akasa-IO")` in `akasa/akasa/workers/__init__.py` (or a helper `run_parallel(fn, items)` that wraps each worker call in `try ... finally: close_thread_connections()`) and expose it on `ctx.jobs.map_parallel(fn, items)` in `akasa/akasa/extension.py`.


2. Replace the four `with concurrent.futures.ThreadPoolExecutor(max_workers=5)` blocks in `cartographer.py`, `engine_gather.py`, and `engine_git.py` with `ctx.jobs.map_parallel(...)`.




* **Impact:** Eliminates ephemeral thread creation during compiles AND fixes a hidden thread-local SQLite connection leak where temporary `ThreadPoolExecutor` threads left open SQLite handles behind on death!


* **Target Files:**
* `akasa/akasa/workers/__init__.py`

* `akasa/akasa/extension.py`

* `insetu/insetu/core/cartographer/cartographer.py`

* `insetu/insetu/core/gather/engine_gather.py`

* `insetu/insetu/extensions/git/engine_git.py`



* **Scope:** Small-to-Medium (~40 lines of code across 5 files).

---

### 4. Watchdog Path Deduplication (`start_filesystem_observer`)

* **The Problem:** In `insetu/insetu/core/utils_core.py` (`start_filesystem_observer`, lines 495–534), the loop iterates over every workspace and every repo in `target_repos` and calls `observer.schedule(handler, target_path, recursive=True)` without checking if `(ws_id, target_path)` has already been scheduled or if `start_filesystem_observer` was invoked more than once.


* **The Systemic Solution:**
* Track scheduled `(ws_id, target_path)` pairs in a deduplicated set before calling `observer.schedule(...)`, and stop any existing `_WATCHDOG_OBSERVER` cleanly if `start_filesystem_observer` is ever re-invoked.




* **Target Files:**
* `insetu/insetu/core/utils_core.py`



* **Scope:** Small (~10 lines of code).

---

Which of these four (or all four together) would you like me to generate the Yomama Bridge patches for now?