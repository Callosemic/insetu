---
tier: "architecture"
title: "Plan (Speculative): JIT Virtual Context Recipes, Dual-Tier LRU/TTL Artifact Cache & Gesture-Safe Client Share"
description: "Replaces pre-compiled background ctx://contexts/*.txt disk sweeps with lightweight manifest recipes, on-demand JIT assembly, a bounded 1-hour LRU/TTL cache on both server and client, and synchronous retry recovery for WebKit navigator.share."
repo: insetu
domain: "Gather & VFS Architecture"
status: speculative
created_at: 2026-11-11T09:15:00
tags: [gather, vfs, jit, caching, webkit-share, offline, architecture, speculative]
models:
  - docs/models/agent_orchestrator_and_rag.md
---

# Plan (Speculative): JIT Virtual Context Recipes, Client-Native Compilation & Gesture-Safe Share Caching

> **Status:** `speculative` — Captured for post-dogfooding evaluation before committing to a migration wave.

---

## 1. Problem Statement & Architectural Motivation

Currently, `gather` (`engine_gather.py` and `gather.js`) treats `ctx://contexts/*.txt` payloads as **eagerly pre-compiled physical files** regenerated on background worker chains (`topology_resolved` $\rightarrow$ 2.5s slew limiter $\rightarrow$ `compile_contexts` $\rightarrow$ `vacuum_unaccounted_cache_on_complete`) whenever any tracked `vfs://` file changes.

This eager-file paradigm creates six compounding sources of complexity, bandwidth waste, and fragility:

1. **Duplicate Wire Transfer (Sending Both Source Files and Compiled Contexts):** Whenever a developer edits 1 file in a 50-file bucket, shipping the entire re-compiled `600 KB` `_context.txt` file to the browser re-transfers 49 unchanged files the client already has (or can cache by content hash in `SutramDB`).
2. **Unnecessary Disk Write Amplification:** Saving a single file triggers background re-bundling of multi-megabyte `_context.txt` files on disk even when no context export or agent turn is requested.
3. **Topological Bucket vs. Quickpack Split-Brain:** Repository buckets (`insetu_core_context.txt`), ad-hoc selections (`quickpack_<ts>_context.txt`), agent handoff packs, and diagnostic snapshots (`ai_telemetry_context.txt`) use different compilation lifecycles, staleness watermarks (`dirtyBuckets` / `dirtyRepos`), and cache-healing paths.
4. **Cold/Evicted Artifact 404s:** If `.insetu/cache/gather/contexts/` is wiped, unbuilt after reboot, or vacuumed while a UI card still holds a pointer to `ctx://contexts/quickpack_*_context.txt`, `/fs/fetch` must guess how to reconstruct the missing file.
5. **WebKit `navigator.share()` User-Gesture Expiration:** Mobile Safari / WebKit requires `navigator.share({ files })` to be invoked synchronously within the transient user-activation window (~1s, and invalidated across long `await` chains). Waiting for a background compilation job (`pollJob`) or a slow multi-hundred-KB download causes `navigator.share` to fail with `NotAllowedError`.
6. **Online vs. Offline Split-Brain on the Client:** Because context compilation only existed on the server (`pack_selection_task`), offline mode required a separate code path or failed outright.

---

## 2. Core Paradigm Shift: Gather Compiles *Recipes*, and the Client Compiles *Files*

### 2.1 One Universal Recipe Structure in `manifest_ledger`
Every item in `manifest_ledger` (whether a Repository Bucket, a Quickpack, or an Agent Working-Set Pack) is stored as a lightweight **Recipe** containing the ordered list of constituent files and their content hashes from `topology_ledger`:

```json
{
  "filepath": "ctx://contexts/insetu_core_context.txt",
  "files": [
    "vfs://insetu/insetu/app.py",
    "vfs://insetu/insetu/core/utils_core.py"
  ],
  "file_hashes": {
    "vfs://insetu/insetu/app.py": "e3b0c44298fc...",
    "vfs://insetu/insetu/core/utils_core.py": "8f434346648f..."
  },
  "recipe_hash": "a94f8c12e03b...",
  "chunks": [
    "ctx://contexts/insetu_core_context_part1.txt",
    "ctx://contexts/insetu_core_context_part2.txt"
  ],
  "meta": {
    "type": "gather",
    "title": "inSetu Core",
    "domain": "Workspaces",
    "repo": "insetu",
    "bucket_id": "core",
    "file_count": 42,
    "size_bytes": 584120,
    "estimated_tokens": 146030,
    "max_kb": 400
  }
}
```

* **Fast Size-Only Bin Simulation (`< 0.5ms`, Zero Disk Reads):**
  When `topology_ledger` settles, `gather` computes `size_bytes`, `estimated_tokens`, `recipe_hash` (`SHA-256` of `(filepath, max_kb, [(f, sha256) for f in files])`), and runs a fast size-only bin-packing simulation (accounting for the ASCII tree header and `>>>NEW FILE ::` banners) so `chunks` is accurate for all standard files (`< max_kb`) without reading file contents.
* **Zero Dirty Bucket Watermarks:**
  Because `manifest_ledger` updates immediately in $< 1\text{ms}$ on `topology_resolved` and the text payload is assembled JIT when requested, Gather cards are **never stale** (`dirtyBuckets` / `dirtyRepos` watermarks on Gather cards disappear).

---

## 3. Clean Separation of Compilation Duties: Frontend vs. Backend

Instead of both compiling on the backend and sending large `.txt` blobs over the wire to the browser, each side compiles strictly for its own consumers using the shared parity-locked algorithm (`_pack_blocks_into_bins` in Python $\leftrightarrow$ `packContextBins` in JS):

### 3.1 Frontend: Single-Paradigm Client-Native Compilation (Online & Offline)
Whenever the human user clicks **Copy**, **Download**, or **Share** in the browser (on a Gather card, Quickpack selection, or Web-Chat Handoff card):
1. **Check `ClientArtifactCache` First (0ms Fast Path):**
   - Look up `(baseUri, recipe_hash)` in `ClientArtifactCache` (bounded 16-recipe / 32 MB LRU, 1-hour TTL).
   - If warm, return the cached `File[]` blobs or text chunks **synchronously on line 1 of the click handler** (100% WebKit `navigator.share` gesture-safe!).
2. **Resolve Constituent Files Locally (`FsStore.activeBuffers` $\rightarrow$ `SutramDB`):**
   - For each `uri` in `recipe.files`, check:
     1. `FsStore.activeBuffers[uri]` (if the user has live/dirty edits in the browser).
     2. `SutramDB` content-addressed file cache (if the cached entry's `sha256` matches `recipe.file_hashes[uri]`).
3. **Fetch Only the Delta (`POST /api/<ws>/fs/fetch_batch`):**
   - If the browser is **online** and $K$ out of $N$ files in the recipe are missing or have a newer `sha256` than `SutramDB`, fetch **only those $K$ changed/missing files** in a single batched request (`POST fs/fetch_batch`, returning `{ files: { uri: { content, sha256 } } }`) and store them in `SutramDB`.
   - *(Low-Memory Safeguard — Standard 01 §4):* If a recipe's total `size_bytes` exceeds `4 MB`, bypass client JS concatenation and stream directly from `/api/<ws>/fs/fetch?file=ctx://contexts/...`.
   - If the browser is **offline** (`isOffline === true`), assemble using the files available in `FsStore.activeBuffers` + `SutramDB`, inserting an explicit `[Offline Cache Miss: <uri> — file was not cached prior to going offline]` notice for any uncached file and surfacing a toast (`"Packed 8/10 files (2 uncached offline)"`).
4. **Compile Natively in JS & Populate `ClientArtifactCache`:**
   - Run `packContextBins(header, blocks, maxBytes)` in JS (`< 3ms` for a 500 KB pack).
   - Construct the `File` objects (`new File([chunkText], chunkFilename, { type: 'text/plain' })`) and store `{ recipeHash, fetchedAt, chunks, fileBlobs }` in `ClientArtifactCache`.

### 3.2 WebKit `navigator.share()` Two-Tap Recovery & Handoff Pre-Warming
* **Targeted Pre-Warming on Agent Handoff Mount Only:**
  - When an Agent Handoff card mounts (`status === 'paused_for_user'`), the frontend immediately pre-warms `ClientArtifactCache` for the handoff's Full and Delta recipes in the background (fetching only the delta files not yet in `SutramDB`). By the time the user clicks **Share** or **Copy**, `ClientArtifactCache` is already warm and `navigator.share()` fires synchronously with 0ms latency.
  - General Gather cards do **not** pre-warm on dropdown open (avoiding speculative bandwidth on mobile).
* **Two-Tap Share Retry When Cold ("⚡ Cached — Tap Again to Share"):**
  - If the user taps **Share** on a cold Gather card and the `fs/fetch_batch` round-trip takes long enough that WebKit expires the user gesture (`NotAllowedError`):
    1. Because step 4 already saved the compiled `File[]` blobs into `ClientArtifactCache`, the payload is now cached locally in RAM!
    2. The UI catches `NotAllowedError` and shows a toast/button state: **"⚡ Context assembled & cached locally — Tap Share again to open sheet"**.
    3. The second tap hits Step 1 (`ClientArtifactCache` synchronous hit) and opens the iOS/macOS share sheet immediately without touching the network!

### 3.3 Backend: In-Memory / Disk-LRU JIT Materializer for Headless Consumers
The backend compiler (`_pack_blocks_into_bins` in `engine_gather.py`) remains the authority for:
1. **In-Process Agent & RAG Turns (`orchestrator.py` / `context_assemble.py`):** Assembles context strings directly in memory from `akasa.vfs` (`_VFS_READ_CACHE`) when calling `llm.complete`.
2. **MCP Server (`engine_mcp.py`) & Direct `/fs/fetch?file=ctx://contexts/...` Calls (including `> 4 MB` packs):**
   - Backed by a lightweight disk-indexed LRU cache (`JITContextCache`, max 32 recipes / 64 MB on disk in `.insetu/cache/gather/contexts/`, 1-hour TTL, keeping at most 1 recipe `< 4 MB` in Python RAM to respect `MALLOC_ARENA_MAX=2`).
3. **Non-Gather Extensions (`git` Diffs, `notes`, `citations`, `bridge.compile_telemetry`):**
   - Extensions either register recipe callbacks via `gather_declare_topology` or publish lightweight entries on `topology_resolved`, ensuring retiring the heavy `compile_contexts` worker step never orphans extension contexts.

---

## 4. Phased Implementation Plan (When Promoted from Speculative)

### Sprint 1: Parallel-Logic Packer (`pack_bins.js`) & `fs/fetch_batch` Endpoint
- [ ] [S1.T1] Extract `generateAsciiTree` and `packContextBins` into `insetu/core/gather/pack_bins.js` and register `tests/parity/pack_context_bins.json` against `generate_ascii_tree` / `_pack_blocks_into_bins` (`engine_gather.py`) with seeded differential tests in `test_parallel_logic_parity.py` <!-- targets: vfs://insetu/insetu/core/gather/engine_gather.py, test_contract: vfs://insetu/tests/unit/test_parallel_logic_parity.py -->
- [ ] [S1.T2] Add `POST /api/<workspace_id>/fs/fetch_batch` in `insetu/core/fs/engine_fs.py` accepting `{ "files": ["vfs://..."] }` (bounded to 100 files / 4 MB) and returning `{ "files": { "<uri>": { "content": "...", "sha256": "..." } } }` backed by `akasa.vfs` RAM cache <!-- targets: vfs://insetu/insetu/core/fs/engine_fs.py, test_contract: vfs://insetu/tests/unit/test_sdk_improvements.py -->

### Sprint 2: Client-Native Delta Compiler, `ClientArtifactCache` & WebKit Two-Tap Share
- [ ] [S2.T1] Implement `ClientArtifactCache` (16-recipe / 32 MB LRU, 1-hour TTL, keyed by `(baseUri, recipeHash)`) and `compileRecipeOnClient(baseUri)` (resolving `FsStore.activeBuffers` $\rightarrow$ `SutramDB` by `sha256` $\rightarrow$ `fs/fetch_batch` delta $\rightarrow$ `packContextBins`) in `insetu/core/fs/fs_store.js` <!-- targets: vfs://insetu/insetu/core/fs/fs_store.js, test_contract: vfs://insetu/tests/unit/test_sutram_compliance.py -->
- [ ] [S2.T2] Wire `shareFiles`, `fetchAndCopy`, and `fetchAndDownloadState` in `insetu/core/fs/fs.js` to check `ClientArtifactCache` synchronously before any `await`, pre-warm on Agent Handoff card mount (`paused_for_user`), and catch WebKit `NotAllowedError` with a synchronous retry prompt <!-- targets: vfs://insetu/insetu/core/fs/fs.js, test_contract: vfs://insetu/tests/unit/test_sutram_compliance.py -->

### Sprint 3: Recipe-First `manifest_ledger` & Backend `JITContextCache`
- [ ] [S3.T1] Update `engine_gather.py` so `manifest_ledger` stores `file_hashes` and `recipe_hash` from `topology_ledger` in $< 2\text{ms}$ without writing eager `.txt` files during background sweeps, and route backend `/fs/fetch?file=ctx://contexts/...` reads through `JITContextCache` (max 32 recipes on disk, 1-hour TTL) <!-- targets: vfs://insetu/insetu/core/gather/engine_gather.py, test_contract: vfs://insetu/tests/unit/test_sdk_improvements.py -->

---

## 5. Ecosystem Alignment, Security Scrubbing & Cross-Plan Sequencing

To ensure this transition integrates cleanly across all active blueprints in `docs/plans/` and `docs/models/` without breaking Tier 0 security guardrails or extension contracts, implementation must honor five cross-cutting invariants:

1. **Outbound Secret Scrubbing on `fs/fetch_batch` (`01_engineering_standards.md` §9.5):**
   - Because the browser never holds plaintext values from `.insetu/secrets.json` in memory, `POST /api/<workspace_id>/fs/fetch_batch` MUST pass all returned file contents through `scrub_outbound_secrets(ctx, text)` on the server before transmitting them to the client (with a defensive client-side regex pass in `pack_bins.js` stripping any `v1:gAAAA...` Fernet tokens). This guarantees client-compiled packs remain 100% compliant with S5/S9 secret scrubbing.

2. **Representational Lenses (`full`, `slice`, `diff`, `outline`), Same-Window Delta Packs & Computed Blocks (`Six-Bucket Orchestrator` & `Bonsai/Git`):**
   - Standard Gather buckets and Quickpacks consist of `full`-lens `vfs://` and `ctx://` files that the client resolves directly from `FsStore.activeBuffers` $\rightarrow$ `SutramDB` $\rightarrow$ `fs/fetch_batch`.
   - For recipes containing computed or AST-projected blocks—such as Agent Turn Packs (`turn_<hash>_context.txt`), Same-Window Incremental Delta Packs (`quickpack_<ts>_delta_context.txt`) mounting only changed/promoted artifacts (`changed_uris` + `unchanged_uris` header), Git Diff packs (`ctx://diffs/*_diffs.txt`), formatted `citations` bibliographies, or `ai_telemetry_context.txt`—the recipe records `lenses: { "<uri>": "slice" | "diff" | "outline" }` and `virtual_blocks` metadata in `manifest_ledger` without writing eager `.txt` files to disk. When `fs/fetch_batch` is called with lens-qualified entries (or when a computed `ctx://` recipe is requested), the server projects any non-`full` AST slices or computed blocks via `project_resource_lens` / `JITContextCache` so the browser never needs a client-side Tree-Sitter runtime to assemble multi-lens or delta Agent packs.

3. **Unification with `SutramCacheWarmer` & `this.vfs.preCacheFiles` (`Post-Diff Audit` Wave 3.1 & `SDK Abstractions` #5):**
   - `compileRecipeOnClient` reads and writes individual `vfs://` file bodies in the exact same `SutramDB` store warmed by `SutramCacheWarmer` (`this.vfs.preCacheFiles`). Pre-caching a repository in Offline Settings automatically makes every Gather bucket and Quickpack in that repository 100% available for offline client-native compilation.

4. **Simplification of `AppStore` (`Multi-Tenant Scope Isolation` Phase 3) & `mddb` Sidecar Contexts (`P20`):**
   - Retiring pre-compiled background `_context.txt` disk sweeps in Sprint 3 allows `dirtyBuckets`, `dirtyRepos`, and watermark comparison reducers to be removed from `AppStore` (`store.js`), and eliminates the post-save Stage-2 compilation I/O spike flagged in P20's per-save performance budget (`tests/performance/`).
   - Extensions backed by `ctx.mddb` (`tracker`, `notes`, `skills`, `research`) simply yield their tracked `files` list in `@bp.on('gather_declare_topology')` rather than concatenating strings in background hooks.

5. **Standards, SDK Contract Updates & Roadmap Sequencing:**
   - **Sequencing:** Sprints 1 and 2 (`pack_bins.js`, `fs/fetch_batch`, `ClientArtifactCache`, and WebKit Two-Tap Share recovery) are 100% additive and can land immediately after the `2.1–2.4` hardening pass without altering existing backend tests. Sprint 3 (retiring background `.txt` disk writes in `engine_gather.py` and `dirtyBuckets` in `store.js`) lands alongside Six-Bucket Sprint 2 / Multi-Tenant Phase 3.
   - **Contract Updates in Sprint 3:** Update `01_engineering_standards.md` (§1 `Terminal Mark-and-Sweep Garbage Collection`, §3 `Self-Healing JIT Artifact Resolution`, and §5.1 `Relational Watermark Derivation`) and `07_sdk_v2_contracts.md` (§1.2 `ctx.is_context_on_disk` / `ctx.has_missing_domain_artifacts`) in the same commit that retires background `.txt` file emission.
