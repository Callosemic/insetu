---
title: "Standup: Yomama Bridge Evolution - 3-Pass Compiler Architecture & Ephemeral Snapshot Ledger"
date: 2026-07-14
author: Architect
status: archived (superseded by v3)
---

> **⚠️ ARCHIVED:** This blueprint has been officially superseded by the consolidated Yomama v3 specification[cite: 8].

## 🌎 Vision & Context
The **Yomama Sync Bridge** is the single entry point for all LLM mutations code-dropped onto local storage[cite: 4, 5]. As the codebase matures, editing complex files across multiple tenancy boundaries exposes a structural race condition: the bridge currently maps and commits file mutations sequentially inside a single execution track[cite: 4]. If file 3 requires interactive path resolution, files 1 and 2 have already been pushed to the Virtual File System, forcing noisy idempotency loops and uncoordinated state drift during client retries[cite: 4, 6].

This document details the complete engineering specification to refactor `engine_bridge.py` and `bridge.js` into a defensive, deterministic **3-Pass Compiler Pipeline** integrated with an event-sourced **Ephemeral Snapshot Ledger**[cite: 4, 6, 7].

---

## 🛠️ The 3-Pass Architecture Blueprint

We are deprecating sequential processing in favor of a strictly segmented, all-or-nothing transactional lifecycle[cite: 4].

```text
 [LLM Payload]
       │
       ▼
 ┌───────────┐      [Path Collision / Meltdown]
 │  Pass 1   ├───────────────────────────────────► Abort & Return UI Telemetry
 └─────┬─────┘
       │ (100% Clean Path Mapping)
       ▼
 ┌───────────┐      [Syntax Error / AST Fail]
 │  Pass 2   ├───────────────────────────────────► Abort & Discard Memory Buffers
 └─────┬─────┘
       │ (100% Valid Syntax)
       ▼
 ┌───────────┐
 │  Pass 3   ├──► Step 3.1: SHA-256 Hash Comparison -> Optional zlib Snapshot
 └─────┬─────┘
       │
       ▼
 [VFS Commit] ──► Call vfs.save() -> Flush Atomic Changes to Disk

```

### 📋 Pass 1: Structural Pre-Flight Check (Discovery & Pathing)

* **The Mission:** Establish absolute path alignment and clean malformed model artifacts before generating state variables.


* **Chevron Healing Loop:** The string stream parser intercepts active token decay (the **Gemini Chevron Meltdown** where a model prints `> > > > >` lines instead of a clean terminator). It catches the first row of chevrons, forces a clean block finalization, and safely discards trailing conversational garbage.


* **Stateless Path Resolution Heuristics:** The engine queries `get_omniscient_workspace_files()` to score ambiguous locations. It calculates exact matches, sub-path tail alignments, and performs non-destructive speculative anchor matching (`SEARCH` block confirmation) to break directory ties.


* **The Intercept Gate:** If any target path is missing or ambiguous, **the transaction hits a hard circuit breaker.** No syntax is checked, and zero text is staged. An explicit data frame (`[ACTION_REQUIRED: UPDATE_PATH]`) is streamed back to the client interface. The frontend `bridge.js` performs a stateless string modification on the raw payload text and automatically triggers a re-submission.
### 🔬 Pass 2: Semantic Integrity (The AST Gate)

* **The Mission:** Prevent the introduction of broken syntax or hallucinated code blocks. To resolve the "God module" technical debt in `engine_bridge.py`, this pass will be refactored into isolated, testable strategies:
   * `IndentationStrategy`: Calculates heuristic step-size math to guess grid alignments.
   * `RegexFallbackHealer`: Rescues edge-case grid desyncs using `{{UNTIL}}` boundaries.
   * `ASTValidator`: Executes pre-flight syntax validation via Node.js and Python `ast.parse`.


* **In-Memory Compilation:** The bridge iterates across the 100% confirmed file layout map compiled by Pass 1, passing the user-space text buffers through the `IndentationStrategy` and `RegexFallbackHealer` to apply mutations safely.


* **The Multi-Language Gate:** The output buffers are sent directly through native validation engines (`ast.parse()` for Python, `node -c` for JavaScript, and `json.loads()` for JSON configuration keys).


* **The Boundary Check:** If a syntax error is identified, the transaction is destroyed. No mutations advance, and your existing files on disk remain completely pristine.



### ⚡ Pass 3: Snapshot Staging & Atomic VFS Flush

* **The Mission:** Securely capture manual code history and execute the atomic VFS dump.


* **Pre-Patch Hash Validation:** Pass 3 reads the verified file target and computes a SHA-256 hash, comparing it against the ledger's `last_known_hash`.
* **The Human Intercept Rule:** If `current_disk_hash != last_known_hash` (the user made un-indexed manual adjustments in the file modal between prompts), the engine instantly compresses the current disk state using `zlib` and writes an emergency baseline snapshot row into `workers.db`.


* **The Routine Snapshot Rule:** If the tree is synchronized but `turns_since_last_snapshot >= 5`, a standard recovery checkpoint row is recorded.


* **The Flush:** The completely verified, syntax-clean text buffers are passed directly to `vfs.save()`, utilizing the asynchronous commit worker thread to update storage hardware. The ledger updates `last_known_hash` to prep for the next loop.



---

## 🗃️ The Ephemeral Patch Ledger (`INS-QUEUE-20260703_0920`)

To provide absolute safety against logic drift and destructive AI writes, we are establishing an embedded SQLite tracking framework.
### 1. Database Schema (`workers.db`)

Instead of creating a siloed database, we will register this schema directly into the centralized `workers.db` ledger using the SDK's `register_schema` hook to inherit automatic multi-tenant isolation.

```sql
CREATE TABLE IF NOT EXISTS bridge_ledger (
    patch_id TEXT PRIMARY KEY,
    transaction_id TEXT,
    repo TEXT,
    filepath TEXT,
    search_block TEXT,
    replace_block TEXT,
    post_patch_hash TEXT,
    is_snapshot BOOLEAN,
    compressed_state BLOB,
    timestamp REAL,
    ttl_expires_at REAL
);

```

### 2. Multi-File Transaction Alignment

When a single Yomama payload modifies multiple files, they are grouped under a unique `transaction_id`. A rollback request targets the entire block, preserving inter-file architectural dependencies and preventing broken multi-file imports.

### 3. Forward-Replay Reversion Mechanics

We abandon fragile, error-prone reverse delta calculations. When a user triggers an undo action to "Revert to Turn X":

1. The engine queries the database to locate the nearest preceding record where `is_snapshot == true`.


2. It inflates the raw snapshot data using `zlib` decompression back into an in-memory text string.


3. It chronologically applies the cached `search_block` / `replace_block` pairs forward up to the requested coordinate.


4. The final constructed string bypasses standard Pass 2 compilation checks (having already passed validation during its initial run) and is passed straight to the VFS queue for deterministic rendering.



### 4. Metronome Housekeeping Sweeps

The bridge registers a routine hourly task with the `insetu.workers` metronome daemon. Upon a successful `api_git_push` operation, a `post_git_push` lifecycle event updates active repository rows with a 48-hour expiration timestamp (`ttl_expires_at`). The worker sweeps and drops expired rows, keeping the SQLite database compact and fast.

---

## 🎨 Frontend UI Implementation

A new **History** sub-tab is mounted via the core extension registry layout engine.

* **Transaction Turns View:** Displays a chronological vertical timeline of patch records. Multi-file patches are grouped under single transaction cards displaying file counts, timestamps, and commit message suggestions inferred from the tickets.


* **Visual Diff Modal:** Clicking an active turn card launches a full-viewport `<insetu-modal>` containing a side-by-side or inline code comparison canvas. It decodes the transaction telemetry to cleanly display added lines in success tokens and deleted blocks in danger colors before an operator confirms a forward-replay rollback.



---

## 🔬 Risks & Mitigation Matrix

| Identified Threat | Architectural Safeguard |
| --- | --- |
| **Circular Bootstrap Lockout:** A broken patch loop bricks `engine_bridge.py`, rendering the platform incapable of applying code changes to fix itself.

 | **The Lifeboat FS:** The micro-kernel boot sequence catches any `SyntaxError` and forces an emergency boot into `fallback_bridge.py`. The lifeboat provides an isolated, zero-dependency environment to safely receive raw replacement strings and restore application access.

 |
| **Database Bloat:** Continuous text tracking across high-velocity editing loops fills local storage with bloated blob streams.

 | **TTL Garbage Collection:** The background worker automatically purges historical rows 48 hours after a remote Git push sync is completed.

 |
| **Race Conditions via Save Events:** Rapid manual edits and concurrent LLM patch streams cross-contaminate code hashes.

 | **Barrier Synchronization:** Pass 3 enforces immediate `_VFS_WRITE_QUEUE.join()` locks before reading or calculating disk hashes, forcing the worker pipeline to flush entirely before evaluating states.

 |
