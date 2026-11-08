---
title: Post-Diff Audit Remediation, Greenfield Hygiene & Multi-Actor MVCC Plan
doctype: plan
status: proposed
created_at: 2026-11-07
models:
  - "vfs://insetu/docs/models/vfs_occ_and_offline_outbox.md"
  - "vfs://insetu/docs/models/yomama_bridge.md"
coordinates_with:
  - "2026-11-02-decomposing-god-objects-across-the-triad.md"
  - "2026-11-02-multitenant-scope-sutram.md"
  - "2026-11-03-routine-expression-compiler-and-parser-unification.md"
  - "2026-11-03-six-bucket-orchestrator-and-composable-rag.md"
  - "2026-11-03-subsystem-mental-models-and-worker-fault-transparency.md"
  - "2026-11-04-ast-import-rewriting-file-moves.md"
  - "2026-11-04-system-notices.md"
  - "2026-11-05-core-extension-sdk-abstractions.md"
---

# Post-Diff Audit Remediation, Greenfield Hygiene & Multi-Actor MVCC Plan

## Roadmap placement (2026-11-07)

From Claude's review of this plan. Where each part lands: review-ready (the showcase cut), 1.0, or after 1.0.

- **Review-ready:**
    - 2.1, the hooks panel. A refused Run Now already shows its error (`bindJobAction` sends refused requests to `onError` since 2026-11-07); 2.1 adds the approval pre-check and replaces the `alert()` calls.
    - 3.3, which is God-objects Wave 3.1. Do it once.
    - 4.4 item 2 on its own: keep `*.conflict_*` files out of packs and add the cleanup action. It is small and stops junk reaching models now.
- **1.0:**
    - 1.1, together with God-objects Wave 2.2, before akasa 1.0.
    - 1.3: the shared layout slots now. The shared block splitter waits for V7's anchoring properties and is tested against the E1 conformance vectors that `parser.py` also runs, so the two splitters cannot drift apart.
    - 3.1, together with warming the boot modules after a successful boot (the 2026-11-07 network-drop finding in Gemini's brief).
    - 3.2, with the multi-tenant plan's Phase 3, after N1 Sprint 1.
    - 4.4 in full. It is what 1.0's multi-window safety requires: conflicts are shown, never resolved silently, and never written into the repository as files. Store staged conflicts in the existing `bridge_ledger` or a small table of their own rather than waiting for 4.1. Background conflicts become an N1 `waiting` source.
    - 4.3 only if a test shows keystrokes lost while a save is in flight; otherwise after 1.0.
    - **First, the merge itself (issue #18).** The server's `three_way_merge_text` and the browser's `threeWayMergeText` disagree on about a quarter of seeded random inputs, and the server can report a clean merge that drops one side's edit. 4.3 and 4.4 both rest on the merge, so it is fixed and both sides agree (`tests/parity/three_way_merge.json` marked `covered`) before either is built.
- **After 1.0:**
    - 1.2. It shapes `RoutineEnvelope` and `compile_node_request`, which are still under discussion.
    - 2.2 and 2.3. The extension SDK is labelled experimental at 1.0 (decided 2026-11-07).
    - 4.1 and 4.2.
- **Change before building:**
    - **4.0's actor class 1.** 1.0 needs one person on two or three devices at once. Keep the groundwork for a second person joining ad hoc on the same insetu ("work on this with me on my other laptop"): `ActorMeta` names both the device and the person, and both come from the S6 paired-device token, so a collaborator is a paired device with its own scoped token, never an unauthenticated window. If a multi-tenant framework comes, it is still one insetu per tenant, so this plan does not need cross-instance merging.
    - **2.2's hydration must be explicit.** Hydrating on first access to `ctx.db` hides when it runs. Declare the hydrator on the blueprint and have the SDK call it before route dispatch. Hooks hydration must never approve anything (the 2026-11-07 regression); keep the test that proves it.
    - **`vfs_occ_and_offline_outbox.md`,** listed in this plan's `models`, does not exist yet. It is dictated by the person (mental-models Task 1.2), not written from the code; see that plan's model catalogue. 4.3 and 4.4 wait for it.


## Context, Objective & Cross-Plan Alignment

Following the 2026-11-07 multi-domain diff audit across `sutram`, `yenvui`, `insetu/core`, and `insetu/extensions`, the immediate functional regressions (`api_notes_new` -> `ctx.create_entity_file(body_content=...)`, `ext_ingest.js` -> `this.vfs.openNewFileModal({ filename, content })`, and the infinite `.conflict_<ts>.md` auto-save loop in `fs.js`) were patched directly. In addition, **Sprint 1 (`S1.T1` & `S1.T2`) of `2026-11-03-six-bucket-orchestrator-and-composable-rag.md`** (retiring `ctx://workflows` pre-compilation) and the `fs_modals.js` / `bridge_*.js` extractions from **`2026-11-02-decomposing-god-objects-across-the-triad.md` (Wave 3)** are now live on disk.

This plan sequences the remaining diff-audit remediations and the **Multi-Actor MVCC Concurrency Architecture** so they interlock cleanly with the active blueprints in `docs/plans/` without duplicate refactors or naming collisions:
* **God-Objects Wave 3.1 (`2026-11-02-decomposing-god-objects-across-the-triad.md`):** Uses the exact target filenames **`fs/fs_store.js`** and **`fs/fs_editor_projection.js`** when decomposing `fs.js` prior to introducing the 3-stage MVCC buffer state machine.
* **Parser & Routine Compiler Unification (`2026-11-03-routine-expression-compiler-and-parser-unification.md`):** Wave 1.2 and Wave 1.3 directly fulfill `S1.T2` (client-side cell splitter alignment in `bridge_store.js`) and feed into `S1.T3` (`compile_node_request`).
* **Multi-Tenant Scope Isolation (`2026-11-02-multitenant-scope-sutram.md`):** Wave 3.1 and Wave 3.2 remove `warmingQueue` from `AppStore` and centralize `shouldDropTenantEvent` in `KernelEventBus`, simplifying the `DaemonStore` (`scope: 'global'`) vs. `AppStore` (`scope: 'tenant'`) split in Phase 3.
* **Six-Bucket Orchestrator (`2026-11-03-six-bucket-orchestrator-and-composable-rag.md`):** Wave 4 unifies `S6.T1` (mid-turn out-of-band edit collision detection) and `S2.T2` (the `diff:live..virtual` lens) with VFS OCC conflict staging.
* **Subsystem Mental Models (`2026-11-03-subsystem-mental-models-and-worker-fault-transparency.md`) & System Notices (`2026-11-04-system-notices.md`):** Wave 4 codifies `docs/models/vfs_occ_and_offline_outbox.md` (Task 1.2) and surfaces background staged conflicts through the unified `notices.py` (`waiting` tier) mechanism.
* **Core Extension SDK Abstractions (`2026-11-05-core-extension-sdk-abstractions.md`):** Abstraction 3 (`openNewFileModal({ fileName, content })`) and Abstraction 5 (`this.vfs.preCacheFiles`) are now live on disk. Abstractions 1 (`this.watchVfsMutations`), 2 (`<insetu-dependency-banner>`), 4 (`<insetu-frontmatter-editor .titleKey .metadataSchema>`), and 6 (`ctx.iter_domain_markdown_entities`) are integrated into Waves 2 and 3 below (with `S2.T1` updated to target `@bp.on('gather_declare_topology')` rather than the retired/banned `compile_contexts` hook).

---

## Wave 1: Ring 1 / Ring 2 Encapsulation & DRY Cleanup (Low Risk, Immediate Hygiene)

### 1.1 Move SQLite Connection Teardown into `akasa.reset_state()`
* **Problem:** `reset_kernel_state()` in `vfs://insetu/insetu/core/sdk/__init__.py` (lines 169–184) uses reflective `dir(_akasa_db)` scanning to locate and close cached SQLite connections before calling `_akasa.reset_state()`.
* **Target Files:** `vfs://akasa/akasa/db.py`, `vfs://insetu/insetu/core/sdk/__init__.py`
* **Remediation:**
  1. Add a first-class `close_all_connections()` function in `akasa.db` and invoke it directly inside `akasa.reset_state()`.
  2. Remove the reflective `for attr in dir(_akasa_db):` loop from `insetu/core/sdk/__init__.py`.

### 1.2 Unify `routine_includes` Context Materialization in `orchestrator.py` (Aligns with Six-Bucket `S2.T1` & Compiler `S1.T3`)
* **Problem:** After retiring `ctx://workflows` (`Six-Bucket S1.T1`, now complete), `vfs://insetu/insetu/core/agent/orchestrator.py` materializes `routine_includes` in two places with slightly different formatting (`_prepare_llm_prompt_and_system` inline blocks vs. `gather.pack_selection` in Web-Chat handoff).
* **Target Files:** `vfs://insetu/insetu/core/agent/orchestrator.py`
* **Remediation:**
  1. Extract a single helper `_ensure_routine_includes_packed(ctx, routine_includes, chain_context, context_lock, need_file_uri=False)` in `orchestrator.py` so both automated LLM nodes and manual Web-Chat handoff nodes share one deterministic packing path, designed to slot directly into `RoutineEnvelope` (`Six-Bucket S2.T1` / `S2.T3`) and `compile_node_request` (`Routine Compiler S1.T3`).

### 1.3 Deduplicate `BridgeStore` Layout Slot Definitions & Align Client Block Splitter (Fulfills Parser Unification `S1.T2`)
* **Problem:**
  1. `BridgeStore.setActiveSurface` in `bridge_store.js` duplicates the 3 `layoutSlots` objects declared in `bridge.js`.
  2. `parseAndAppendCells`, `swapCell`, `snapAllDeterministicAnchors`, and `_extractCurrentBlocks` each use separate ad-hoc regexes to split `<<<<<<< SEARCH` / `=======` / `>>>>>>> REPLACE` blocks rather than sharing lookahead separator disambiguation with `parser.py` (`2026-11-03-routine-expression-compiler-and-parser-unification.md` Vector B / `S1.T2`).
* **Target Files:** `vfs://insetu/insetu/core/bridge/bridge_store.js`, `vfs://insetu/insetu/core/bridge/bridge_projections.js`, `vfs://insetu/insetu/core/bridge/bridge.js`
* **Remediation:**
  1. Export `BRIDGE_BASE_LAYOUT_SLOTS` and a single lookahead-aware `splitYomamaSearchReplace(text)` helper from `bridge_store.js` (matching `parser.py`'s fence-balanced `=======` selection) and reuse them across all three Bridge frontend modules.

---

## Wave 2: Extension UI Hygiene & Declarative SQLite Hydration (Tier 2 & Tier 3)

### 2.1 Guard `@sutram-modal-closed`, Replace Blocking `alert()` Calls & Pre-Check Hook Approvals in `ext_hooks.js`
* **Problem:** `vfs://insetu/insetu/extensions/hooks/ext_hooks.js` still has an unguarded `@sutram-modal-closed` handler, raw `alert()` calls in `saveRule`/`toggleRule`/`deleteRule`, and allows clicking Execute on an unapproved rule (causing a raw `403 Forbidden` console error).
* **Target Files:** `vfs://insetu/insetu/extensions/hooks/ext_hooks.js`
* **Remediation:**
  1. Guard `@sutram-modal-closed` with `if (e.target === e.currentTarget)`.
  2. Replace blocking `alert(...)` calls with `this.setStatus(..., 3500, true)`.
  3. If `rule.approved === false`, prompt the user to approve/save the rule first rather than firing an unapproved `POST hooks/execute`.

### 2.2 Declarative Extension SQLite Hydration (`@ext_bp.db_hydrator`) & `ctx.iter_domain_markdown_entities` (Unifies SDK Abstractions `S2.T1`–`S2.T2`)
* **Problem:**
  1. `citations`, `hooks`, `notes`, and `skills` each repeat manual `_ensure_<ext>_hydrated(ctx)` calls at the top of every route and hook handler to sync `.insetu/data/` files with `.insetu/cache/db/` SQLite tables.
  2. `notes`, `skills`, and `research` each hand-roll directory + `ws://` shared-mount walking and frontmatter parsing (`2026-11-05-core-extension-sdk-abstractions.md` Abstraction 6).
* **Target Files:**
  * `vfs://insetu/insetu/core/sdk/__init__.py`
  * `vfs://insetu/insetu/extensions/citations/engine_citations.py`
  * `vfs://insetu/insetu/extensions/hooks/engine_hooks.py`
  * `vfs://insetu/insetu/extensions/notes/engine_notes.py`
  * `vfs://insetu/insetu/extensions/skills/engine_skills.py`
  * `vfs://insetu/insetu/extensions/research/engine_research.py`
* **Remediation:**
  1. Add a declarative `hydrate_db` hook on `InSetuExtension` in `sdk/__init__.py` that runs automatically (with per-workspace re-entrancy guard) when `ctx.db` is accessed on an unhydrated workspace, and remove repetitive per-route `_ensure_*_hydrated(ctx)` calls across `citations`, `hooks`, `notes`, and `skills`.
  2. Implement `ctx.iter_domain_markdown_entities(domain, exts=['.md'])` on `InSetuContext` in `sdk/__init__.py` (walking `ctx://<domain>`, `vfs://<repo>/.insetu-data/<domain>`, and `ws://` shared mounts). Note: any static context helper must target `@bp.on('gather_declare_topology')` rather than the banned `@bp.on('compile_contexts')` hook.

### 2.3 Declarative `<insetu-dependency-banner>` & `this.watchVfsMutations` (Fulfills SDK Abstractions `S1.T1`–`S1.T2`)
* **Target Files:** `vfs://insetu/insetu/core/system/insetu_element.js`, `vfs://insetu/insetu/core/system/components/ui_primitives.js`, `ext_notes.js`, `ext_skills.js`, `ext_research.js`, `ext_ingest.js`, `ext_publish.js`, `prompts.js`, `ui_system_settings.js`
* **Remediation:**
  1. Add `this.watchVfsMutations(pathPredicateFn, onMutatedCallback, debounceMs = 300)` to `InSetuElement` in `insetu_element.js` (wrapping both `insetu:vfs-mutated` and `sutram-sync-complete` with `this.registerTimeout` auto-cleanup) and adopt it in `ext_notes.js`, `ext_skills.js`, `ext_research.js`, and `prompts.js`.
  2. Add `<insetu-dependency-banner>` to `ui_primitives.js` and replace duplicated missing-package/binary warning blocks in `ext_ingest.js`, `ext_publish.js`, `ext_research.js`, and `ui_system_settings.js`.

---

## Wave 3: Frontend Substrate Consolidation (Event Bus, Cache Warmer & `fs.js` Decomposition)

### 3.1 Persist `pendingMutations` / `deletedMutations` in `SutramDB` & Unify `SutramCacheWarmer`
* **Problem:**
  1. `SutramDB.enqueueMutation` does not persist `options.pendingMutations` or `options.deletedMutations` on the outbox record, forcing `syncOutboxMutationMarkers` in `api.js` to guess paths by parsing `bodyString`.
  2. Cache warming is split across `AppStore.warmingQueue` (`store.js`), `manifest_sync.js`, `preCacheFiles` (`fs.js`), and `SutramCacheWarmer` (`offline.js`).
* **Target Files:** `vfs://sutram/sutram/js/offline.js`, `vfs://insetu/insetu/core/system/api.js`, `vfs://insetu/insetu/core/system/manifest_sync.js`, `vfs://insetu/insetu/core/system/store.js`, `vfs://insetu/insetu/core/fs/fs.js`
* **Remediation:**
  1. Persist `pendingMutations` and `deletedMutations` directly on `sutram_outbox` records in `SutramDB.enqueueMutation` and read them in `syncOutboxMutationMarkers`.
  2. Consolidate all background and on-demand file warming into `SutramCacheWarmer` in `sutram/js/offline.js` (supporting `priority: 'high' | 'low'`), removing `AppStore.warmingQueue` from `store.js`.

### 3.2 Unify `SSEPipeline` + `BroadcastChannel` Relay into One Typed `KernelEventBus` (Aligns with Multi-Tenant Scope & System Notices)
* **Problem:** Both `api.js` and `system.js` instantiate separate `BroadcastChannel('insetu_telemetry')` listeners and emit duplicate `sutram-*` / `insetu-*` window events.
* **Target Files:** `vfs://insetu/insetu/core/system/api.js`, `vfs://insetu/insetu/core/system/system.js`
* **Remediation:**
  1. Consolidate SSE ingestion, `BroadcastChannel` cross-window relay, and `StoreRegistry.isTransitioning()` / `StoreRegistry.getActiveScope()` tenant filtering (`2026-11-02-multitenant-scope-sutram.md`) into a single `KernelEventBus` in `api.js` (including routing for the unified `notices` SSE event from `2026-11-04-system-notices.md`), removing the duplicate `BroadcastChannel` handler from `system.js`.

### 3.3 Decompose `fs.js` into Focused Modules (`fs_store.js`, `fs_editor_projection.js`, `fs.js` — Fulfills God-Objects Wave 3.1 & SDK Abstractions `S1.T3`–`S1.T4`)
* **Problem:** `vfs://insetu/insetu/core/fs/fs.js` is ~2,700 lines combining state management, editor projections, diff projections, file explorer UI, and export helpers, and binds duplicate methods on both `window.inSetu.ui` and `window.inSetu.vfs`.
* **Target Files (matching `2026-11-02-decomposing-god-objects-across-the-triad.md` Section 4.1 & Wave 3.1):**
  * `vfs://insetu/insetu/core/fs/fs_store.js` (New: `FsStore`, MVCC buffer state machine, auto-save, `hydrateVfsBuffer`, frontmatter & export/share helpers)
  * `vfs://insetu/insetu/core/fs/fs_editor_projection.js` (New: `InSetuEditorProjection`, `InSetuFrontmatterEditor` upgraded with declarative `.titleKey` and `.metadataSchema` props per `2026-11-05-core-extension-sdk-abstractions.md` `S1.T4`, and `InSetuFileDiffProjection`)
  * `vfs://insetu/insetu/core/fs/fs.js` (Retains `InSetuVFSExplorer`, entity actions, and VFS RPC facade, with `openNewFileModal` on both `window.inSetu.ui` and `window.inSetu.vfs`; no `populateNewFileModal` alias)
  * `vfs://insetu/insetu/core/system/system.js` & `vfs://insetu/insetu/static/sw.js` (Add `fs_store.js` and `fs_editor_projection.js` to `CORE_COMPONENT_SCRIPTS` / `HOST_ASSETS`)

---

## Wave 4: Multi-Actor MVCC & Conflict-Free VFS Architecture (Multi-User + Multi-Process)

### 4.0 Architectural Threat Model: Concurrent Actors in inSetu
In a multi-user, multi-window, multi-agent Developer OS, **five distinct classes of actors** can read and mutate the same VFS URI concurrently:
1. **Multiple Human Operators & Windows:** User A on a laptop, User B on a tablet PWA, or multiple pop-out editor windows open on the same file.
2. **Offline Outbox Reconcilers:** A device reconnecting after offline work and draining queued `fs/save` mutations against a workspace modified by others in the interim.
3. **Yomama Sync Bridge (`bridge/sync`):** Interactive or automated batch transactions applying `SEARCH`/`REPLACE`, `TEXTEDIT`, `JSON_PATCH`, `RELOCATE`, or `RENAME` operations.
4. **Autonomous Agent Routines (`orchestrator.py` / MCP Clients):** Background DAG wavefronts or external MCP clients invoking `fs.save` or `bridge.sync` in parallel.
5. **External Host OS Processes (`watchdog.py`):** `git checkout`, `git pull`, code formatters, hook scripts (`engine_hooks.py`), or an external IDE modifying files on disk.

### 4.1 Pillar 1: Unified Ring 0 Revision Ledger `(rev, sha256, actor)` (`akasa.vfs` + `bridge_ledger`)
* **Design:**
  1. Unify `_VFS_ANCESTOR_RING` (`akasa.vfs`) and `bridge_ledger` (`engine_bridge.py`) into a single canonical revision tracking model where every tracked file has a monotonic integer `rev` and `sha256`, plus `ActorMeta` (`{ actor_type: 'human' | 'bridge' | 'agent' | 'mcp' | 'os_watchdog', client_id, client_seq, user_id }`).
  2. Every write (`execute_vfs_save`, `BridgeWorkingTree` commit, or `watchdog.py` external change detection) atomically increments `rev` and records the ancestor snapshot in a bounded ring/table so 3-way merges always resolve the exact common ancestor `base_rev` across daemon restarts and multi-hour offline sessions.
  3. `vfs_mutated` broadcasts `{ filepath, rev, base_hash: sha256, actor: ActorMeta }`. Clients identify their own echoed saves in $O(1)$ via `actor.client_id === myClientId && actor.client_seq <= myLastSentSeq` without WebCrypto SHA-256 hashing or 50-item `ancestorHashes` arrays.

### 4.2 Pillar 2: Inline Delta / Content Push on `vfs_mutated` (Zero Fetch-Back Race)
* **Design:**
  1. For text files under `64 KB` (or as a compact diff `(from_rev, to_rev, patch)` up to `512 KB`), `vfs_mutated` SSE events and `POST fs/save` responses include the post-write text/delta inline alongside `{ rev, base_hash }`.
  2. `reconcileBufferWithDisk` is replaced by a synchronous, 0ms in-memory reducer `reconcileBufferFromMutation(filepath, mutationEvent)` in `fs_store.js`, eliminating the HTTP `GET fs/fetch` round-trip window during which user keystrokes raced with in-flight fetches.

### 4.3 Pillar 3: Three-Stage Editor Buffer State Machine (`Confirmed` + `InFlight` + `Pending`)
* **Design (Codified in `docs/models/vfs_occ_and_offline_outbox.md` per Mental Models Sprint 1 Task 1.2):**
  1. In `fs_store.js`, each open file buffer tracks three explicit states:
     * `confirmedText` & `confirmedRev` / `confirmedHash`: Last state acknowledged by the server.
     * `inFlightText` & `inFlightRev`: Snapshot currently in flight in the single active `POST fs/save` request (serialized via a per-file async mutex queue so `blur`, `visibilitychange`, and `autoSave` never race).
     * `pendingText`: Edits typed by the user *after* `inFlightText` was dispatched.
  2. When the server responds to `inFlight` (or when an inline `vfs_mutated` event arrives from Yomama, another user, or Git), `FsStore` rebases `pendingText` onto the new `confirmedText` via `threeWayMergeText(inFlightText, pendingText, serverConfirmedText)`.

### 4.4 Pillar 4: Retire Physical `.conflict_<ts>.md` Files in Favor of `VIRTUAL` Ledger Staging & System Notices (Unifies Six-Bucket `S2.T2` / `S6.T1` & System Notices)
* **Design:**
  1. **Never write `.conflict_<timestamp>.ext` files into the user's repository working tree.**
  2. Exclude `*.conflict_*` from `engine_topology.py` / `engine_gather.py` default RAG context compilation immediately so legacy conflict files never pollute LLM context windows, and add a 1-click cleanup action in `topology.audit_upkeep`.
  3. Unify human editor conflicts (`api_fs_save`) and mid-turn Agent/Bridge out-of-band edit collisions (`Six-Bucket S6.T1` & `S2.T2` `diff:live..virtual`) into a single **Ledger-Staged Conflict (`VIRTUAL`)** mechanism:
     * When a true un-mergeable conflict occurs (whether from two humans, an offline outbox drain vs. `git pull`, or an Agent turn vs. mid-turn CodeMirror edits), the unmerged candidate is stored in the revision ledger (`status: "conflict_staged"`, accessible via the `diff:live..virtual` lens) and returns `{ disk_rev, disk_hash, disk_content, conflict_id }`.
     * `InSetuEditorProjection` updates `confirmedText = disk_content` and `confirmedHash = disk_hash` immediately (preventing any auto-save loop) and renders a non-blocking conflict resolution bar at the top of the editor:
       `⚠️ Concurrent edit by [Actor] modified overlapping lines` — **[Compare & Merge in Diff Viewer]** · **[Keep My Version]** · **[Accept Disk Version]**
     * Background conflicts (e.g., from an offline outbox drain or background routine on a file not currently focused in the editor) surface through `insetu/core/system/notices.py` (`2026-11-04-system-notices.md`) as a `waiting` tier notice that opens `InSetuFileDiffProjection` (`vfs:pairdiff`).

---

## Verification & Fitness Gate

After each wave:
1. Run `bash scripts/vendor_sutram.sh` (if any `sutram/` or `yenvui/` file was touched).
2. Run `python3 tests/run_unit_tests.py --lf` and verify 100% pass rate (including multi-actor concurrent save + Yomama patch + watchdog edit unit tests).
3. Run `python3 tests/fitness_functions.py` and verify zero Python, JS, or `MODULE_SIZE_RATCHET` violations.
