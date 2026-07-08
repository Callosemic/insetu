---
repo: "insetu"
type: "todo"
status: "open"
id: INS-QUEUE-20260704_1700_OFFLINE_TYPEWRITER
title: "The Offline Typewriter: IndexedDB Mutation Queue for Citations & VFS"
created_at: 2026-07-04T17:00:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-07-26"
tags: ["Architecture", "Offline", "Service-Worker", "Epic"]
---

## Description
To support true "off-the-grid" academic writing and development (per ADR 0008), the OS must gracefully support localized Markdown editing and Citation management without an active network socket to the backend daemon.

### The Boundaries
* **Supported Offline:** Browsing the local citation library, manually adding/editing CSL-JSON metadata, opening existing Markdown files, writing text, inserting `[@cite]` tags, and "saving" files to a local queue.
* **Disabled Offline:** Global catalog searches (OpenAlex/Crossref), Jina URL scraping, Yomama Sync Bridge patching, AST syntax validation (Python/JS), and Pandoc document compilation.

### Execution Blueprint
1. **The IndexedDB Cache (`store.js`):** - Implement a lightweight, asynchronous `IndexedDB` wrapper. 
   - Every time the app successfully fetches the `manifest` or the `localLibrary`, it mirrors a copy into this local database to bypass the 5MB `localStorage` limit.
2. **Service Worker Interception (`sw.js`):** - `GET` requests (e.g., `/api/citations`, `/api/system/config`) use a *Network First, falling back to IndexedDB* strategy.
   - `POST` requests (e.g., `/api/fs/save`, `/api/citations/import`, `/api/tracker/transition`) intercept network failures. If offline, the payload is written to an `offline_mutations` table in IndexedDB, and the UI receives a mocked `202 Accepted` response.
3. **The Reconciliation Flush:** - Upon network reconnection (`window.addEventListener('online')`), a background sync manager sequentially drains the `offline_mutations` queue to the actual backend REST routes, guaranteeing atomic persistence to the host disk.
4. **UX Telemetry:** - The global status bar must visually indicate `[⚡ OFFLINE MODE - X Pending Saves]` to ensure the operator doesn't close the browser tab before the flush completes upon reconnection.

## Notes / Execution Log