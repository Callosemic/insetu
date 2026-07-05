# ADR 0008: Offline-First Synchronization & The "Offline Typewriter"

**Date:** 2026-07-04
**Status:** Accepted

## Context
As a local-first Developer OS, inSetu requires an active network socket to the backend Python daemon to perform physical I/O. However, in "off-the-grid" scenarios (e.g., working from a beach with no Tailscale connection), the browser instantly drops all capabilities. 

We require an "Offline Typewriter" mode: the ability to open Markdown files, write prose, browse the existing Reference Library to drop in `[@cite]` tags, and organize Kanban backlogs without a live backend. Relying on standard `localStorage` to queue these mutations is structurally unsafe due to its ~5MB synchronous limit, which would instantly crash the UI thread if tasked with holding large CSL-JSON libraries or extensive document payloads.

## Decision
We will upgrade the inSetu frontend to support a safe, asynchronous offline mode utilizing **IndexedDB** and a heavily expanded Service Worker (`sw.js`). 

We will enforce strict architectural boundaries to prevent catastrophic merge conflicts:

### 1. The "Read-Only" Cache (Stale-While-Revalidate)
The Service Worker will intercept `GET` requests and mirror responses into IndexedDB. If the network drops, the OS degrades gracefully, serving the cached state for:
* **The Kanban Tracker:** Read the backlog and architectural notes.
* **The Reference Library:** Browse metadata and copy citation keys for offline writing.
* **The Workspace Manifest:** Browse the known file tree.

### 2. The IndexedDB Mutation Queue (Safe Writes)
For safe offline mutations (Markdown edits, Kanban transitions, manual Citation edits), `sw.js` will intercept failing `POST` requests and reroute the payloads into an `offline_mutations` table in IndexedDB, returning a mocked `202 Accepted` to the UI.
Upon network reconnection (`window.addEventListener('online')`), a background Sync Manager will sequentially drain this queue to the actual backend REST routes, guaranteeing atomic persistence.

### 3. The "Strictly Online" Boundaries (Hard Disabled)
Any system that requires live algorithmic validation or external network access is strictly banned from offline queuing. 
* **The Yomama Sync Bridge:** Relies on evaluating exact structural diffs against the live physical file. Queuing this offline guarantees patch collisions.
* **Context Compilation (RAG):** Requires sweeping the live Git tree.
* **Research & Scraping:** Requires live internet (Jina API/BeautifulSoup) to resolve URLs.
* **Git Operations:** Sweeps and pushes require the live daemon shell.

## Consequences
* **Positive:** Drastically improves the Developer Experience (DX) for off-the-grid academic writing and localized drafting.
* **Positive:** Bypassing `localStorage` for `IndexedDB` preserves the strict Unidirectional Data Flow (UDF) without blocking the main UI thread.
* **Negative:** Introduces significant frontend complexity regarding the "Reconciliation Flush." We must implement robust UX telemetry (`[⚡ OFFLINE MODE - X Pending Saves]`) in the global status bar so the user knows not to close their browser tab until the queue successfully flushes upon reconnection.