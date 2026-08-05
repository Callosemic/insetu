# R&D Standup: Topology & Gather Decoupling (ADR 0037 Blueprint)

**Date:** 2026-08-05
**Status:** Blueprint / Draft

## 1. The Architectural Flaw
Currently, the `gather` extension operates as the ultimate arbiter of both RAG context compilation *and* Virtual File System (VFS) visibility. Because Gather owns the `manifest_ledger` in `vfs_index.db`, any file that Gather ignores or filters out (e.g., via `"exclude_from_context"`) vanishes completely from the frontend VFS explorer UI. 

This is a leaky abstraction. The "Universe of What Exists" is entangled with the "Universe of What Is Compiled."

## 2. The Target Architecture (The Unified Manifest)
We must decouple the physical file index from the artifact compiler, unifying them into a single `AppStore.manifest` structured with strict root keys: `{"vfs": {...}, "ctx": {...}}`.

### Phase 1: The Topology Ledger (`vfs://`)
*   **Responsibility:** Maps the physical bounds of the workspace as defined by `config.json`, extensions, and `.gitignore`.
*   **Mechanism:** `engine_topology.py` maintains a real-time `topology_ledger` SQLite table mapping every valid file to its structural sub-bucket.
*   **Routing:** Standard physical files reside strictly in the `"vfs"` root key of the manifest.

### Phase 2: The Artifact Engine (`ctx://`)
*   **Responsibility:** Gather acts solely as a downstream consumer. It compiles RAG contexts based *only* on the buckets defined in the Topology Ledger.
*   **Routing:** Compiled artifacts, generated diffs, and virtual records (like Citations) are published under the `"ctx"` root key in the manifest, accessed via `ctx://` URIs.
## 3. The Deterministic Event Pipeline (Zero Race Conditions)
To eliminate async racing, execution follows a strict chronological waterfall. We must ensure absolute settlement before advancing stages:
1.  **Disk Mutation:** User saves a file -> Core OS emits `vfs_mutated`.
2.  **Topology Mapping:** Topology engine catches `vfs_mutated`, evaluates rules, assigns the bucket, and UPSERTs SQLite. 
3.  **Absolute Settlement:** Topology explicitly awaits the SQLite WAL flush and a verified idle state before it emits `topology_resolved` (passing the dirty bucket IDs).
4.  **Context Compilation:** Gather listens *only* to `topology_resolved`. It queries SQLite for the dirty buckets, builds the `ctx://` artifacts, and dispatches the final unified manifest to the frontend.

## 4. Execution Plan & Optimizations
1.  **Extract Routing:** Move `get_valid_workspace_files()` and `resolve_file_bucket()` into `engine_topology.py`.
2.  **Bridge Optimization:** Refactor Yomama Sync Bridge to drop synchronous `os.walk` calls, replacing them with sub-millisecond `SELECT` queries against `topology_ledger`.
3.  **Refactor Gather:** Strip disk-walking out of `engine_gather.py`. Gather now strictly reads the Topology Ledger.
4.  **Frontend Hard Break:** Refactor `<insetu-file-tree>` and `extractManifestFiles` to strictly require `manifest.vfs` and `manifest.ctx`. Legacy flat-manifest iterations will intentionally fail-fast to ensure complete migration visibility.
## 5. Two-Stage Macro Slew Limiting & Watchdog Integration
Currently, multiple extensions (like Gather and Hooks) implement their own debounce timers to survive event-loop starvation during rapid disk I/O bursts. This is particularly problematic with the `watchdog` observer, which fires hundreds of chaotic OS-level events during external actions like a `git pull` or branch checkout.

To properly model both machine-speed I/O bursts and human-speed typing workflows, we will implement a **Two-Stage Slew Limiter**:

*   **Stage 1: Topology Resolution (Fast, 1-3 seconds)**
    *   **The Funnel:** Both internal VFS writes and external `watchdog` file events are piped directly into Topology's buffer.
    *   **The Buffer:** Topology holds the events in a dirty Set until the disk I/O storm settles (e.g., a 1 to 3-second debounce window).
    *   **The Resolution:** Topology processes the deduplicated delta in a single atomic SQLite transaction against the `topology_ledger`, instantly updating the VFS UI. It then emits a `topology_resolved` event.
*   **Stage 2: Context Compilation (Slow, 10-15 seconds)**
    *   **The Delay:** Gather catches `topology_resolved` but applies a longer, 10 to 15-second debounce before actually compiling.
    *   **The Benefit:** This prevents the heavy RAG compiler from spinning up repeatedly while a user is actively typing and saving multiple files over a minute. It reserves CPU and disk I/O until the user is definitively finished modifying the context boundary.
## 6. Extension Edge Cases & Impact Analysis
*   **Automation Hooks:** Rewired to listen to `topology_resolved` instead of `vfs_mutated`. Topology hands Hooks the exact array of dirty buckets, making rule evaluation instant and perfectly aligned with the OS.
*   **Git Operations:** Sweep logic is simplified. It queries `topology_ledger` to immediately know which files are tracked, cross-referencing against the Git tree without duplicating ignore logic.
*   **Favorites Bar:** No migration logic needed; existing testing entries will be wiped. Future pins must explicitly route through `vfs://` or `ctx://`.
*   **Notes & Research Inbox:** Remain directly hooked into `vfs_mutated`. Since they manage isolated, domain-specific folders rather than project-wide RAG buckets, they can safely bypass the Topology waterfall and react to raw physical writes.