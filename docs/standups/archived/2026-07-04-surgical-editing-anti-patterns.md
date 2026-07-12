# Architecture Blueprint: Surgical Editing vs. Full Re-Rendering (Anti-Patterns)

**Date:** 2026-07-04
**Mission:** To establish a strict engineering mandate against "edits that are too wide for their own good," ensuring that targeted filesystem mutations result in surgical data-layer updates rather than global state purges.

## The Problem: N+1 Disk Thrashing
Currently, certain localized actions trigger disproportionately massive system operations. The primary case study is the Kanban Tracker extension (`engine_tracker.py`). 

When a user transitions a *single* ticket from `open` to `active`, the system:
1. Writes the single markdown file to disk.
2. Triggers the `@hooks.on('post_file_save')` event bus.
3. Invokes `_sync_disk_to_db()`, which executes a `DELETE FROM tracker_tickets`.
4. Runs `os.walk()` to open, regex-parse, and synchronously re-insert *every single ticket in the repository* back into the SQLite cache.

If a repository contains 500 closed tickets, updating 1 active ticket triggers 500 synchronous disk reads, severely bottlenecking the VFS worker thread and wasting I/O cycles.

## The Mandate: Surgical UPSERTs
Global re-indexing (`DELETE FROM table` followed by bulk re-insertion) is strictly banned as a response to singular events. 

### Action Items for Tracker Refactor:
* **Targeted Event Payloads:** Lifecycle hooks (`post_file_save`, `post_file_delete`) must pass the exact `filepath` modified.
* **Surgical Row Updates:** The responder (e.g., `engine_tracker.py`) must isolate that `filepath`. 
    * If `post_file_delete` is fired, execute `DELETE FROM tracker_tickets WHERE filepath = ?`.
    * If `post_file_save` is fired, read *only* that specific file, parse its YAML, and execute a surgical `INSERT OR REPLACE INTO tracker_tickets ...`.
* **Global Sync Containment:** The heavy `_sync_disk_to_db()` walk should *only* execute during `system_boot` if the SQLite table is completely empty (initial seed), or if manually requested by the user via a "Full Refresh" action.
By enforcing surgical editing, the system footprint remains O(1) relative to the action taken, preserving the performance of the event loop regardless of workspace size.

## Further Systemic Violations Discovered (Audit 2026-07-04)

### 1. Cartographer Global Map on Single Save
* **The Debt:** At the end of `execute_vfs_save_physical()` in `routes_fs.py`, the system calls `map_repositories()` if the file is new. However, it still triggers blindly on new repositories or moved files without queuing safely.
* **The Bomb:** Saving structural changes forces the Cartographer to loop over *every single tracked repository*, rebuild their entire file trees, and overwrite their `CODE_INDEX.md` files simultaneously, bottling up the VFS worker.
* **The Fix:** Cartography should be deferred to a background queue, and it should only sweep the *specific* repository that was modified, not the global matrix.

### 2. Context Compilation on Empty File Creation
* **The Debt:** In `fs.js`, when `saveNewFile()` or `saveNewFolder()` complete, they instantly trigger `compileContexts()`. 
* **The Bomb:** Creating an empty folder or a 0-byte file forces the heavy RAG compiler to rebuild the *entire* ecosystem context matrix just to update the frontend's file manifest.
* **The Fix:** The `/api/fs/save` endpoint should return the isolated manifest addition. The frontend `AppStore` should inject this new file into its in-memory `manifest` state surgically, bypassing the heavy RAG `/submit` endpoint entirely.

### 3. Kanban Board DOM Annihilation
* **The Debt:** In `ext_tracker.js`, when `transitionTask()` successfully moves a ticket via the API, it calls `loadTrackerBoard()`.
* **The Bomb:** `loadTrackerBoard()` re-fetches the entire ticket database, clears the `innerHTML` of all 10 Kanban columns, and redraws every single DOM node for the entire board just to move one card. 
* **The Fix:** Update the local Zustand `KanbanStore` array surgically. Find the ticket by ID, update its `status`, and let a granular DOM reconciliation function move the specific card node from Column A to Column B without destroying the rest of the board.
### 4. Citation Library DOM Annihilation
* **The Debt:** In `ext_citations.js`, `saveAttachments()` or importing a new citation triggers `loadMainLibrary()` or artificially dispatches an `input` event on the global search bar.
* **The Bomb:** This wipes the `lib-main-list` container and re-renders hundreds of HTML strings from scratch just because a user added a single folder tag.
* **The Fix:** Update the specific `CitationStore.localLibrary` index and perform a targeted DOM manipulation strictly on the affected `.cit-card-wrapper` node.

### 5. Citation Metadata Cache Re-Indexing
* **The Debt:** In `engine_citations.py`, `_rebuild_metadata_cache()` triggers on every citation import or deletion.
* **The Bomb:** It reads the *entire* SQLite citations table into memory, parsing every JSON blob to rebuild the unique authors and publications lists in an O(N) loop.
* **The Fix:** Execute a targeted SQL `UPSERT` against a separate relational mapping table, or surgically append the metadata of the single incoming/outgoing record to the cache object in memory.
### 6. Workflow & Gather DOM Annihilation
* **The Debt:** In `ext_flow.js` and `gather.js`, saving or deleting a single batch calls `loadGatherBatches()` / `loadFlowBatches()`.
* **The Bomb:** This wipes the entire `.innerHTML` of the workflow container, forcing the browser to recalculate and redraw every single workflow card and layout boundary from scratch.
* **The Fix:** Add or remove the specific batch object inside the Zustand state tree and utilize a surgical DOM reconciliation function to only mount/unmount the specific `file-card` node.

### 7. FIFO Masquerading as LRU Cache (Memory/Connection Leak)
* **The Debt:** In `db.py`, the SQLite connection pool (`get_connection`) claims to implement an "LRU Eviction Policy (Max 5 Workspaces)". However, its eviction logic simply deletes the first index: `list(_local.connections.keys())[0]`.
* **The Bomb:** Because Python dictionaries maintain insertion order, this is a strict FIFO (First-In, First-Out) queue. A frequently used connection (inserted first) will be constantly evicted and re-opened when iterating through multiple profiles, invalidating the connection pool's purpose.
* **The Fix:** Utilize `collections.OrderedDict` or surgically move accessed keys to the end of the dictionary upon retrieval to ensure true Least Recently Used eviction.
### 8. The Synchronous Event Bus Trap
* **The Debt:** `hooks.py` iterates and executes all subscribed callbacks synchronously on the emitter's thread (`for cb in callbacks: results.append(cb(*args, **kwargs))`).
* **The Bomb:** When the VFS Worker finishes writing a file, it calls `hooks.emit('post_file_save')`, which synchronously invokes Cartographer and the Tracker re-index. The VFS queue becomes paralyzed, unable to process pending file saves until the downstream hook pipeline clears.
* **The Fix:** The Event Bus `emit` function must be upgraded to dispatch long-running hooks to the ThreadPool asynchronously, returning control to the caller immediately.

### 9. Config Editor DOM Annihilation
* **The Debt:** In `ext_config.js`, `renderRepos()` and `renderSubBuckets()` obliterate the DOM (`container.innerHTML = '';`) and recreate massive nested input arrays on minor state mutations.
* **The Bomb:** This forces the browser to destroy and recreate hundreds of input event listeners and DOM nodes, causing input focus loss and severe layout thrashing.
* **The Fix:** The Config Editor needs surgical DOM reconciliation or mapping to Web Components to only update the specific repository/bucket node being added or removed.
### 10. DRY Violation: Slug Generation
* **The Debt:** `ext_ingest.js` and `ext_research.js` contain copy-pasted, multi-chained regex algorithms for converting titles to file slugs (`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, '-')`).
* **The Bomb:** If the system standard for safe filenames changes, we have to hunt down isolated regex chains across multiple UI modules, risking broken cross-platform file path resolutions.
* **The Fix:** Centralize this logic into a single `generateSafeSlug(string)` utility alongside `normalizeAccentText` in `app.js` and export it across the OS ecosystem.

### 11. Research Inbox N+1 API Thrashing
* **The Debt:** In `ext_research.js`, `handleDisposition()` calls `fetchState()` after accepting, rejecting, or force-scraping a single inbox item.
* **The Bomb:** `fetchState()` hits the backend to fetch ALL jobs and ALL inbox items simultaneously. If a user is manually triaging a batch of 50 links, hitting "Accept" 50 times triggers 50 redundant network requests that pull the entire database table into memory, blowing out the UI with full-re-renders each time.
* **The Fix:** The UI must surgically splice the item out of `ResearchStore.getState().inbox` via Zustand, avoiding backend fetches entirely unless a manual refresh is requested.
### 12. Context Tab Over-Fetching
* **The Debt:** In `app.js`, `switchTab(..., 'context')` unconditionally fires `loadContext()`.
* **The Bomb:** Navigating away from the Context tab to Edit, and then back, forces the entire RAG pipeline to re-compile the context matrix. This locks the compiler and burns CPU cycles purely for UI navigation.
* **The Fix:** Only compile contexts when explicitly requested (e.g., clicking the refresh button) or when a dirty state flag indicates physical files have changed. Tab navigation must rely on the localized Zustand `manifest` cache.

### 13. Global Repository Sweeps on Localized File Events
* **The Debt:** When a file is saved or deleted, listeners trigger global workspace refreshes (e.g., flipping a global `_isDiffsDirty = true` flag causing the backend to run `git status` on *every* tracked repo).
* **The Bomb:** If a multi-tenant workspace tracks 5 repositories, saving a single Python file in Repo A forces the backend to spin up heavy subprocesses or deep `os.walk()` scans for Repos B, C, D, and E just to verify they haven't changed. This creates massive overhead and starves the event loop.
* **The Fix:** Lifecycle hooks (`post_file_save`, `post_file_delete`) must extract the target repository boundary from the emitted `filepath`. The frontend and backend must use a Set of `target_repos` to surgically run sweeps (e.g., `git diff`) *only* against the affected folders, splicing the updated fragments back into the global RAM cache.