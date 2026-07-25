# V3 Context Compiler: Event Sourced VFS Ledger
**Date:** 2026-07-14
**Status:** Blueprint / Proposed Architecture

## 1. Context & Motivation
Currently, `engine_gather` relies on a "Polling State" model—triggering `git status --porcelain` to discover file changes during differential compiles. This incurs a heavy cross-boundary I/O penalty (the "Git Tax") and conflates context compilation with version control. 

This blueprint transitions the OS to an **Event Sourced / State Machine** model. The Virtual File System (VFS) and native OS watchdogs will track their own deltas in a localized ledger, dropping differential discovery times to $O(1)$ and fully decoupling Gather from Git.

---

## 2. Core Architectural Pillars

### A. The VFS Ledger
Instead of querying Git, every successful VFS write (and every valid `watchdog` emission) will append a record to an internal ledger (e.g., `workers.db` or an in-memory queue). 
*   **Data Stored:** `filepath`, `mutation_type` (added/modified/deleted), and `timestamp`.
*   **Result:** The context compiler instantly knows exactly which files changed without spawning external subprocesses.

### B. The Macro Slew Limiter (5-Second Debounce)
To protect the OS from rapid burst-edits (e.g., executing a multi-file patch or running a heavy script):
*   A rolling 5-second timer is established.
*   Every new ledger entry resets the timer. 
*   Recompilation is explicitly blocked until the 5-second silence window is reached, ensuring the compiler only spins up when the dust has completely settled.

### C. The Bucket Ratio Circuit Breaker
Instead of a naive "file count" threshold to promote a differential sweep to a Full Sweep:
1.  Read the ledger of modified files.
2.  Map each file to its configured destination bucket.
3.  Count the unique touched buckets.
4.  If `touched_buckets / total_known_buckets > 0.5` (50%), the overhead of surgical routing is mathematically heavier than a bulk read. **Action: Wipe the ledger and promote to Full Sweep.**

### D. Offline Mutation Guard (Boot-Time Heuristic)
To prevent the ledger from having "blind spots" while the inSetu daemon is shut down:
1.  When a Full Sweep completes, the OS records `last_full_compile_time` to a persistent `manifest_cache.json`.
2.  On OS startup, the kernel records `system_boot_time`.
3.  **The Guardrail:** Upon loading a workspace, if `system_boot_time > last_full_compile_time`, the system assumes files may have been edited externally (e.g., in VSCode while the daemon was offline). **Action: Force a Full Sweep on boot to heal the state.**

---

## 3. Implementation Blueprint

### Phase 1: Ledger & Cache Infrastructure
1.  **`engine_gather.py`**: Update `ctx.save_manifest()` to dual-write the manifest to `manifest_cache.json` alongside a `last_full_compile_time` Unix timestamp.
2.  **`workers.py`**: Introduce a `vfs_mutations` table in `workers.db` to track `(filepath, timestamp)`. 

### Phase 2: The Slew Limiter & Watchdog Hooks
1.  **`routes_fs.py` & `workers.py`**: Modify the `vfs_transaction_committed` hook to inject touched files directly into the new `vfs_mutations` ledger.
2.  **`engine_gather.py`**: Instead of instantly compiling on `vfs_transaction_committed`, dispatch a debounced immediate job (`gather_slew_limiter_task`). If the job is already pending, reset its `next_run_at` to `time.time() + 5.0`.

### Phase 3: The Circuit Breaker & Compiler Routing
1.  **`app.py` / `engine_gather.py`**: Refactor `_surgically_update_manifest`. 
    *   Query the `vfs_mutations` ledger for all pending files.
    *   Map them to their sub-buckets.
    *   Calculate `len(touched_buckets) / len(total_buckets)`.
    *   If `> 0.5`, discard surgical updates and call `generate_context_file()`.
    *   Upon completion, clear the processed files from the `vfs_mutations` ledger.

### Phase 4: Git Decoupling
1.  **`engine_git.py`**: Retains full control over `git status` and `git diff` generation. It continues tracking its own diff artifacts and pushing to the remote. 
2.  **`app.py`**: Strip all `subprocess.run(['git', 'status'...])` calls out of the differential gathering loops.

---

## 4. Anti-Patterns & Guardrails
*   **DO NOT** let `watchdog` listen to ignored directories (e.g., `node_modules`). This will overflow the ledger instantly. The current `NonGitDirectoryWatcher` architecture already safely respects `ignore_dirs`.
*   **DO NOT** mix Git state with VFS state. The ledger is the sole source of truth for Gather. Git is the sole source of truth for version control.

## 5. Second-Order Effects & Mitigations

### A. UX Perception Gap (The Debounce Wait)
**Risk:** A 5-second slew limit means the UI compiler won't instantly react, leading the user to believe the system is unresponsive.
**Mitigation:** The moment the first file is modified, the backend spawns the `immediate_job` with a `debouncing` status and message `"Waiting for edits to settle..."`. The frontend job tracker natively displays this to the user.

### B. The Cartographer Stampede
**Risk:** Cartographer currently fires an immediate job per file save/delete. A bulk Git pull or mass edit would spawn dozens of overlapping mapping tasks.
**Mitigation:** Strip the direct `post_file_save`/`delete` event hooks from Cartographer. Instead, execute Cartographer at the tail-end of the 5-second slew limiter. It will map *only* the specific repositories that were touched, immediately before Gather recompiles them.

### C. Manual Override vs. Passive Watcher
**Risk:** If a user explicitly clicks "Compile Contexts" or "Execute Push" in the UI, they shouldn't be forced to wait 5 seconds.
**Mitigation:** The explicit `/submit` routes explicitly bypass the slew limiter, clear the pending ledger, and instantly flush the pipeline.
### D. Unified Core OS Event Ledger (`vfs_event_log` replacing `nongit_fixtures`)
**Decision:** Implement a Unified OS Event Ledger. The core OS (`routes_fs` and `engine_gather`) natively owns a central `vfs_event_log` table tracking all disk state. `engine_git` (acting as an application/extension) will query this core ledger to identify changes in media-vault repositories, completely replacing the redundant `nongit_fixtures` table. This enforces the paradigm that `gather` and the VFS represent the OS, while `git` is a downstream consumer of OS state.

### E. Ghost Deletions
**Risk:** Attempting to recompile a bucket containing deleted files will cause an I/O crash.
**Mitigation:** The ledger tracks the mutation state. The compiler uses the deleted file's path solely to flag its parent bucket as "dirty". During the actual compilation, the VFS naturally excludes the file from the read payload because it is no longer present on the disk.