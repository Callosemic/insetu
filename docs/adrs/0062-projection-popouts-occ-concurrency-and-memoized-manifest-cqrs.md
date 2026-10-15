# ADR 0062: Dedicated Viewport Projection Pop-Outs, Optimistic Concurrency Control, and Memoized Manifest CQRS Slices

## Status
Accepted (2026-10-14)

## Context
As the inSetu Workbench expanded multi-column spatial viewports (ADR 0054, ADR 0059), several architectural constraints emerged across viewport management and high-frequency state updates:
1. **Single-Window Viewport Ceiling**: Operators working across multi-monitor hardware were unable to detach active editor projections or long-form diff viewers into separate browser windows.
2. **Multi-Window Telemetry Duplication**: Spawning additional browser tabs or pop-out windows duplicate Server-Sent Events (SSE) connections, increasing server memory pressure and triggering redundant manifest polling cycles.
3. **Write-Path Concurrency Risks**: When multiple editor windows or external processes modified the same physical file concurrently, inSetu's write path executed blind overwrites without verifying whether the on-disk state had drifted from the editor's initial load baseline.
4. **Keystroke Eviction Data Loss**: Relying solely on manual `Ctrl+S` commands risked data loss during abrupt tab closures, whereas synchronous auto-saves overwhelmed the VFS write queue.
5. **Render Thrashing on Monolithic Manifest Subscriptions**: Core explorer views (`InSetuVFSExplorer`, `InSetuFileTree`, `InSetuExtGather`) subscribed to the monolithic `AppStore.manifest` object. Every minor file save or git status update triggered exhaustive tree traversals and array recalculations across all mounted components.

## Decision
1. **Dedicated Viewport Projection Pop-Out Windows (`fs.js`, `ui_editor.js`, `system.js`)**:
   - Implemented `popoutProjection(filepath)` to open active projections in detached popup windows (`/?popout=true&token=...#/workspace/center/filepath`).
   - Pop-outs mount `<sutram-app-shell>` in `variant="popout"` mode, suppressing top navigation bars, status footers, and panic overlays.
   - Cross-window authentication tokens are passed via URL query parameters and cleanly scrubbed from browser history immediately upon hydration.
   - Pop-out instances communicate with the main application window via a shared `BroadcastChannel('insetu_telemetry')` relay, receiving `vfs_mutated`, `topology_resolved`, and `job_progress` events without opening duplicate SSE streams.
2. **Optimistic Concurrency Control (OCC) with Baseline Hashes (`fs.js`, `engine_fs.py`)**:
   - `viewSourceFile` and buffer initialization routines calculate an initial SHA-256 hash (`baseHash`) from fetched file content.
   - `saveBufferFile` transmits `base_hash` to `POST /api/<workspace_id>/fs/save`.
   - The backend VFS gateway verifies `base_hash` against live physical disk state. If an external edit is detected, it preserves the incoming buffer as `<stem>.conflict_<timestamp><ext>` and returns HTTP 409 Conflict.
3. **Debounced Auto-Save & Keepalive Emergency Flush (`fs.js`)**:
   - Integrated a 2000ms debounced auto-saver on CodeMirror `@content-changed` events.
   - Added a `beforeunload` emergency flush handler using `fetch(..., { keepalive: true })` to guarantee uncommitted buffer modifications are transmitted to disk even during rapid window teardowns.
   - Added focus-aware idle hot-swapping: clean buffers (`!isDirty`) without active CodeMirror focus automatically re-hydrate when `vfs_mutated` signals disk changes.
4. **Memoized CQRS Manifest Derivation & Selector Slices (`store.js`)**:
   - Added `derivedVfsFiles`, `derivedGitModifiedSet`, and `derivedCtxKeys` directly to `AppStore`.
   - A centralized memoized derivation subscription monitors `manifest.vfs`, `manifest.ctx`, and `targetConfigs`, updating derived state only when structural contents change (verified via `shallowEqual`).
   - Standardized core component subscriptions to consume selector-scoped slices rather than coarse root store objects.
5. **Centralized Process Spawning (`utils_core.py`, `engine_llm.py`)**:
   - Extended `execute_binary()` with `popen=True` support to ensure CLI subprocess invocations (e.g. Claude CLI) resolve PATH and virtual environment binaries safely without violating the `EXECUTE_BINARY_MANDATE`.

## Consequences
* **Positive**: Fluid multi-monitor workflow via detached projection pop-out windows.
* **Positive**: Zero-latency cross-window telemetry via lightweight `BroadcastChannel` relays.
* **Positive**: Elimination of silent overwrite data loss through OCC baseline hash checks and conflict file generation.
* **Positive**: Significant reduction in UI render thrashing by shifting manifest derivation from components to memoized store slices.
* **Negative**: Pop-out windows require browser permission to launch popup windows if triggered outside direct user pointer gestures.