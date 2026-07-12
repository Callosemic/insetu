# Architecture Blueprint: Background Job Standardization & Ephemeral Artifacts Ledger

**Date:** 2026-07-04
**Mission:** To unify background task execution, eliminate I/O event loop starvation, and implement a formalized garbage-collection lifecycle for temporary system artifacts.

## The Context
The inSetu kernel currently suffers from three distinct and fragmented mechanisms for background processing:
1. **The SQLite Metronome (`workers.py`):** Excellent for long-running, resilient jobs, but its 1-second tick cycle is too slow for instant UI feedback.
2. **The Python `queue.Queue` (`routes_fs.py`):** Lightning fast and thread-safe for atomic VFS commits, but lacks persistent memory if the ASGI server restarts.
3. **Rogue Threading (`app.py`):** The RAG Compiler spins up raw `threading.Thread` instances dynamically, bypassing managed system tracking entirely.

Furthermore, temporary artifacts (like Quick-Pack contexts) rely on fragile string matching (`f.startswith("quick_pack_")`) for garbage collection and UI rendering. As we offload heavy compilation operations (like Pandoc PDF generation) to background threads, we must formalize where these transient files are housed and how they are destroyed.

## Phase 1: The Ephemeral Artifacts Ledger
Stop guessing what files to delete. Let the OS clean up after itself via strict state tracking.
* **Database Schema:** Initialize a new SQLite table on boot: `ephemeral_artifacts (id TEXT, filepath TEXT, module_owner TEXT, created_at REAL, expires_at REAL)`.
* **The API:** Create a helper `register_ephemeral_artifact(filepath, owner, ttl_seconds)` that logs the file path and its exact expiration timestamp into the ledger.
* **The Garbage Collector:** Register a persistent Metronome job (`sweep_ephemeral_artifacts`) ticking every 5 minutes. It will query the ledger for rows where `NOW() > expires_at`, execute `os.remove(filepath)`, and safely drop the row.
* **UI Manifest Contract (Tech Debt Fix):** Eliminate fragile frontend string-matching. Specifically, remove the hardcoded `if (fileName.startsWith('quick_pack_'))` logic in `fs.js` and the `if f.startswith("quick_pack_"):` purge loop in `engine_gather.py`. The `/api/<workspace_id>/manifest` payload must be upgraded to return explicit metadata objects for ephemeral files so the UI renders them dynamically based on truth, not string guesses.

## Phase 2: Immediate Jobs Registry
Bridge the gap between "Instant execution" and "Trackable persistence" by adding a high-priority track to the existing worker framework.
* **The Dispatcher:** Add `submit_immediate_job()` to `workers.py`. This drops a task directly into the active `ThreadPoolExecutor` but logs its lifecycle (`processing`, `completed`, `failed`) into a new `immediate_jobs` SQLite table. *Note: As a local-first OS, we will rely on the existing global thread pool; the SQLite status queue guarantees no jobs are lost even if the pool is saturated.*
* **State Streaming (Tech Debt Fix):** The `immediate_jobs` table will include a `status_message` string column. Backend workers will update this in real-time, allowing the frontend to poll and emulate streaming UI progress without holding fragile HTTP sockets open.
* **The Universal Status Route:** Expose `GET /api/system/jobs/<job_id>` to poll job progress, returning `status_message`, terminal artifact URLs, or detailed error trace strings.
* **Ledger Garbage Collection:** The `sweep_ephemeral_artifacts` metronome job will also sweep `immediate_jobs`, automatically purging any `completed` or `failed` records older than 24 hours to prevent infinite database bloat.
## Phase 3: Eradicating I/O Block Ban Violations (The Event Loop Killers)
With the Immediate Jobs infrastructure in place, surgically extract the heavily synchronous event-loop blockers. Stabilizing the Sync Bridge is paramount.

* **The Yomama Sync Bridge (`engine_bridge.py`):** * Refactor `/api/<workspace_id>/bridge/sync` to dispatch an Immediate Job and return `202 Accepted`. 
    * Heavy AST syntax validations (`node -c`) and diff logic will run safely off-thread. The UI will poll the job status, releasing the browser socket.
* **URL Ingestion (`engine_ingest.py`):**
    * Moves to Immediate Jobs. *UI Flow Adaptation:* Since we can no longer return parsed markdown synchronously, the frontend will replace the modal's target `textarea` with a `⏳ Fetching & Converting...` state while polling the job. Upon completion, the backend returns the parsed text payload in the job's artifact JSON, which the UI injects into the textarea natively.
* **Document Formatting (`engine_format.py`):** * Dispatches an Immediate Job. The Pandoc subprocess runs off-thread, registers the PDF/DOCX in the Ephemeral Ledger (1-hour TTL).
    * `ext_format.js` polls the job and triggers `downloadFile` upon completion.
* **Git Operations (`engine_git.py`):**
    * Refactor push and sweep actions to Immediate Jobs, updating the UI via polling.
* **The RAG Compiler (`app.py` & `engine_gather.py`):**
    * Dismantle the rogue `threading.Thread` and NDJSON stream. 
    * Route context compilation through `submit_immediate_job()`, updating the `status_message` column so the frontend can poll and emulate live status natively.

## Phase 4: VFS Routing for Internal Artifacts
Eliminate unguarded synchronous file writes for core OS operations.
* **Configuration Manager (`utils_core.py`):** Refactor `save_json_file()` (when dealing with `config.json` mutations) to explicitly queue through the atomic `_VFS_WRITE_QUEUE` to guarantee all disk I/O runs through the asynchronous pipeline.

## Phase 5: Cartography Subprocess Bottleneck
* **The Debt:** `cartographer.py` maps repositories by running `subprocess.run(['git', 'show', ...])` synchronously inside its file loop to extract legacy comments. Because this is triggered by the VFS save queue, every single file save incurs a Git subprocess penalty.
* **The Fix:** Cartography should rebuild `CODE_INDEX.md` via an asynchronous batch queue or rely on cached logic, rather than spawning a raw subprocess on every VFS index trigger.
## Phase 6: Frontend UDF Bleed (Floating Globals)
* **The Debt:** Variables like `globalBrowsePath`, `currentFileTree`, `currentPushRepo`, and `currentPushDiffFile` are floating in ES6 module scope (`fs.js`, `ext_git.js`).
* **The Fix:** These violate the UDF reset contract. Because they sit outside `window.inSetu.stores`, they do not clear during a `performSoftRefresh()` tenant swap, risking cross-tenant data corruption (e.g., pushing to the wrong repo).
They must be migrated directly into the Zustand `AppStore` and `BridgeStore` slices to ensure they are swept cleanly during layout hydrations.
## Phase 7: External Network & Deep Search Starvation (Audit 2026-07-04)
* **The Debt:** `search_global_citations()` in `engine_citations.py` executes synchronous `urllib.request.urlopen` HTTP calls to external APIs. Furthermore, `search_workspace_files()` in `utils_core.py` performs synchronous, sequential disk reads of all workspace Markdown files for deep link searching.
* **The Fix:** Citation catalog queries must be offloaded to the Immediate Jobs registry so external API latency cannot block the local OS. Deep Link searching must be deferred to a background indexing task (e.g., an SQLite full-text search table) rather than relying on brute-force synchronous I/O sweeps.

## Phase 8: Metronome Disk Thrashing (Audit 2026-07-04)
* **The Debt:** `workers.py` runs `_metronome_loop` every 1.0 seconds. Inside this loop, it executes a raw `open(..., 'r')` and `json.load()` on `workspaces.json`.
* **The Fix:** Bypassing `utils_core.load_json_file` avoids the `mtime` cache, causing the daemon to physically thrash the hard drive every second while idle. This must be routed through the memory cache helper.
## Phase 9: Synchronous Quick-Pack Generation (Audit 2026-07-04)
* **The Debt:** The `/api/<workspace_id>/gather/quick-pack` route in `engine_gather.py` opens files, concatenates strings, and writes to disk synchronously.
* **The Fix:** Route the Ad-Hoc Quick Pack execution through the new Immediate Jobs registry to guarantee zero HTTP blocking.

## Phase 10: VFS Queue Inconsistencies (Audit 2026-07-04)
* **The Debt:** `execute_vfs_save` properly queues async disk writes. However, `execute_vfs_move`, `execute_vfs_archive`, and `execute_vfs_delete` in `routes_fs.py` execute `shutil.move` and `os.remove` synchronously on the REST thread.
* **The Fix:** Move, Archive, and Delete operations must be routed through the async `_VFS_WRITE_QUEUE` to ensure 100% of physical disk modifications respect the I/O Block Ban.

## Phase 11: Workflow Compiler VFS Bypass (Audit 2026-07-04)
* **The Debt:** In `engine_flow.py`, `compile_batch()` executes synchronous `with open(..., 'w')` writes. Worse, it does this while blocking the `compile_contexts` event bus hook.
* **The Fix:** `compile_batch` must route its generated batch artifacts through the async VFS pipeline (`execute_vfs_save`) to prevent blocking the event bus and evading the Cartographer topology mapper.
## Phase 12: Remaining UDF Bleed (Audit 2026-07-04)
* **The Debt:** `ext_format.js` contains a floating `let currentFormatTarget = "";` variable outside of the Zustand store.
* **The Fix:** Migrate this variable to the Zustand `AppStore` to ensure it is flushed cleanly during tenant soft-swaps.

## Phase 13: Git Diff Generation Thread Starvation (Audit 2026-07-04)
* **The Debt:** `api_generate_diffs` in `engine_git.py` calls `generate_diff_context()` which runs `git status` and `git diff` for all mapped repos sequentially and synchronously. 
* **The Fix:** Diff compilation blocks the HTTP event loop, locking out other tenants. Move diff generation to the Immediate Jobs registry so the UI can poll for completion.