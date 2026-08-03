---
repo: "insetu"
type: "todo"
status: "open"
id: "INS-QUEUE-20260704_1700_OFFLINE_TYPEWRITER"
title: "The Offline Typewriter: IndexedDB Mutation Queue for Citations & VFS"
created_at: "2026-07-04T17:00:00"
closed_at: null
sub_bucket: "None"
delivery_date: "2026-08-09"
tags: ["Architecture", "Offline", "Service-Worker", "Epic"]
---

## Description
To support true "off-the-grid" academic writing and development (per ADR 0008), the OS must gracefully support localized Markdown editing and Citation management without an active network socket to the backend daemon.

### The Boundaries
* **Supported Offline:** Browsing the local citation library, manually adding/editing CSL-JSON metadata, opening existing Markdown files, writing text, inserting `[@cite]` tags, and "saving" files to a local queue.
* **Disabled Offline:** Global catalog searches (OpenAlex/Crossref), Jina URL scraping, Yomama Sync Bridge patching, AST syntax validation (Python/JS), and Pandoc document compilation.
### Execution Blueprint
1. **Granular Offline Designation:** Introduce an `"offline_capable": true` flag to repository configurations to mathematically bound the IndexedDB footprint to text-heavy domains (Tracker, Prose, Citations) rather than caching the entire global workspace.
2. **Delta-Driven Sync Loop (CQRS Integration):** 
   - Hook into the `/manifest/deltas` polling metronome established in `INS-QUEUE-20260710_1221_MANIFEST_CQRS`. 
   - When deltas arrive for an `offline_capable` repo, automatically dispatch a background `fetch()` for the modified file content.
   - The Service Worker caches these files in IndexedDB, ensuring the offline read-cache is a perfect 1:1 mirror of the server.
3. **API Client Interception (`api.js` & `sw.js`):** 
   - `sw.js`: Intercepts `GET` requests (e.g., `/api/citations`, `/api/system/config`) using a *Network First, falling back to IndexedDB* strategy.
   - `api.js`: Intercepts `POST` requests (e.g., `/api/fs/save`, `/api/citations/import`, `/api/tracker/transition`) at the application layer when the network fails. The payload is written to an `offline_mutations` IndexedDB queue, and the UI resolves a mocked `202 Accepted` response. This allows for tighter, synchronous UDF optimistic updates to Zustand stores.
4. **Bootstrap Hydration (Hash-Delta Sync):** When a repository is newly designated as `offline_capable`, or when the client detects a cold cache, the frontend requests a lightweight manifest mapping `filepath -> SHA-256 hash` (or VFS ledger timestamp) from the server. The Service Worker diffs this against IndexedDB and dispatches a low-priority background batch-fetch *only* for missing or altered files, drastically reducing bandwidth and UI thread locking.
5. **LRU Cache Storage Caps:** Introduce an `offline_cache_limit_mb` parameter (e.g., 250MB) to the configuration schema. The Service Worker will actively monitor IndexedDB footprint sizes and enforce a Least Recently Used (LRU) eviction policy, silently purging the oldest read-only files to prevent browser quota exhaustion.
6. **The Reconciliation Flush:** Upon network reconnection (`window.addEventListener('online')`), a background sync manager sequentially drains the `offline_mutations` queue to the actual backend REST routes, guaranteeing atomic persistence to the host disk. The subsequent CQRS Delta tick acts as the final idempotent true-up.
7. **Conflict Resolution (Split-Brain Safeguard):** All offline queued mutations must attach a `base_timestamp` or `base_hash`. When the queue drains, the backend verifies this against the live file. If a mismatch occurs (e.g., someone else edited the file), the server throws a `409 Conflict`. The Service Worker pauses the queue and surfaces the collision to the UI, allowing the user to resolve it via the CodeMirror 6 Merge Viewer before resuming.
8. **Desyncs & Self-Healing:** If the IndexedDB cache becomes irrevocably corrupted, the system must provide a "Wipe & Re-Hydrate" escape hatch in the System Settings. Additionally, if the Service Worker detects a mathematically impossible delta state, it auto-purges the local cache and triggers a fresh Bootstrap Hydration.
9. **The CDN/ESM Trap (Resolved via ADR 0032):** Because the OS strictly enforces local vendorization (ADR 0032), there are no external CDN calls to `esm.sh` or `cdn.jsdelivr.net`. The Service Worker only needs to implement `Stale-While-Revalidate` for local `/static/vendor/` and `/static/js/` assets to guarantee UI stability when offline.
10. **The Manifest Illusion (Virtual Tree Injection):** To prevent newly created or moved files from "disappearing" from the file tree while offline, the Service Worker must intercept `GET .../manifest` requests, load the cached manifest, and dynamically overlay/inject the paths from the `offline_mutations` queue before returning the JSON to the UI.
11. **Binary Asset Filtering:** The Service Worker must explicitly ignore `multipart/form-data` requests to `/api/fs/upload`. Binary uploads are strictly online-only to protect IndexedDB quotas. The UI will catch the failed fetch and alert the user.
12. **Generalized REST Action Queue (SQLite/Settings):** The `offline_mutations` queue must intercept all state-mutating `POST`/`DELETE` requests across the API (e.g., `/api/citations/import`, `/api/settings`), not just VFS routes. The UI's Zustand stores must optimistically update local state to reflect these changes instantly.
13. **Data-Layer Conflict Resolution (LWW):** Unlike text files (which use the Merge Viewer), conflicts in SQLite databases or JSON settings files cannot be manually merged by the user. The backend must enforce a Last-Write-Wins (LWW) strategy: if the server's `updated_at` timestamp is newer than the queued offline action's timestamp, the offline action is safely discarded, and the UI will true-up on the next delta tick.
14. **Graceful UI Degradation (Hard Dependencies):** Extensions that require external networks (Bridge LLM routing, Research) or backend Python execution (Gather compilation) cannot be queued. The frontend SDK must expose a reactive `isOffline` state. UI components must bind to this to visually disable themselves (e.g., graying out the chat input) to prevent UX timeouts.
15. **Stale Artifacts (Gather/Diffs):** The Hash-Delta sync will cache both raw workspace files and OS artifacts (compiled contexts, diffs). However, because offline edits cannot trigger a backend Gather compilation, the cached contexts will become temporarily out-of-sync with local edits until reconnection. The Gather UI must indicate that contexts are "Frozen" while offline.
16. **UX Telemetry:** The global status bar must visually indicate `[⚡ OFFLINE MODE - X Pending Saves]` to ensure the operator doesn't close the browser tab before the flush completes upon reconnection.

## Notes / Execution Log
* **Architectural Alignment (2026-07-27):** Merged the offline caching strategy with the Manifest CQRS Delta timeline. Rather than writing a standalone caching engine, the offline read-cache will be surgically hydrated by the same 3-second background metronome tick that pulls manifest deltas, eliminating redundant polling and race conditions.