---
title: "Blueprint: Subsystem Mental Models, Blast-Radius Model Injection & Worker Fault Transparency"
repo: insetu
created_at: 2026-11-02T13:35:00
tags: [plan, rfc, mental-models, landmarks, rag, fitness, workers]
---

# Blueprint: Subsystem Mental Models, Blast-Radius Model Injection & Worker Fault Transparency

## 1. Architectural Context & Objective

While ADRs capture historical point-in-time decisions and `01_engineering_standards.md` defines global rules of engagement, complex stateful subsystems rely on strict **state-machine invariants** (ordering guarantees, immutability boundaries, and cache invalidation laws). When those mental models are not explicitly documented and surfaced in context, AI coding turns optimize locally and inadvertently violate subsystem invariants.

**The Human-Origin Principle (`inSetu` Repository Convention):**
For `inSetu` development, a mental model must **never** be invented by an LLM reverse-engineering the current implementation (which merely codifies existing bugs and accidental implementation details as "law"). Mental models in `docs/models/*.md` originate strictly from the human architect; the LLM's role is to transcribe the human's mental model faithfully and then audit/refactor the code to match it. (While `inSetu` as a developer OS leaves the `models` landmark unopinionated for external users, `inSetu`'s own repository standards enforce human authorship.)

Following the establishment of the `models` landmark (`docs/models/*.md` -> `sys.model_files`) and `docs/models/yomama_bridge.md`, this blueprint structures an interactive, human-dictated transcription pass across the core stateful engines, wires automatic blast-radius discovery for mental models, and enforces worker fault transparency across all background `@*.worker` tasks.

---

## 2. File-Level Execution Plan

### Sprint 1: Human-Dictated Core Subsystem Mental Models (`docs/models/*.md`)
> **Execution Protocol:** Do not auto-generate these files from source code. Each task in Sprint 1 is a collaborative session where the human architect articulates the mental model for the subsystem, and the collaborator transcribes it into `docs/models/*.md` and audits the live code for divergences.
* **Task 1.0 (`vfs://insetu/docs/models/yomama_bridge.md`):**
  - Document the core internal algorithmic mechanics of the Yomama Sync Bridge alongside the three-phase transaction model:
    1. **Two-Phase Lookahead Lexer & Parser (`parser.py`):** Web-chat artifact pre-cleaning (`{{ymm:...}}`, blockquote chevron meltdown), optimal `=======` separator disambiguation via code-fence balancing, and error-boundary synchronization (`malformed: True` diagnostics).
    2. **Two-Tier Contiguous Block Anchor Scanner (`find_all_block_anchors` in `bridge_fuzzy.py`):** Tier 0 strict stripped-line scan with soft-wrap adjacent line stitching, leading blank-line pinning (`pinned_idx = max(i, b_f_idx - baseline_s_idx)`), `{{UNTIL}}` span matching, and Tier 1 boundary prefix/suffix fallback (`len >= 6`) with `unmatched_first_prefix` / `unmatched_last_suffix` preservation and ambiguous-anchor rejection.
    3. **The Hybrid Accordion Indentation Engine (`get_base_step_and_diffs` & `apply_block_in_memory`):** Calculating the target file's structural indentation step ($S_{\text{file}}$) vs. the LLM block's step ($S_{\text{llm}}$), discrete grid snapping via `actual_base_indent + round((r_indent - llm_base_indent) / llm_step) * file_step`, the `r_indent == 0` module-root escape hatch, and the 1:1 absolute shift circuit breaker when `file_step > 8`.
    4. **Idempotency, No-Op & Overlap Guards:** Two-pass relative-indentation no-op detection (`is_effectively_identical`), subset-deletion-safe idempotency checks, Atomic S/R trailing-context absorption, and Tier 2 deterministic overlap rebasing (Context-Edge Shrinking + 3-way $O \rightarrow A / O \rightarrow B$ merge).
    5. **Keyframe Snapshots & Forward-Replay Ledger (`bridge_ledger`):** The 5-turn keyframe snapshot rule, human-intercept snapshot triggers, and `_replay_ledger_chunks_in_memory` forward-replay reversion (`/undo`).
* **Task 1.1 (`vfs://insetu/docs/models/topology_and_gather_pipeline.md`):**
  - Document the Two-View VFS Sieve, Watchdog content-addressed echo suppression (`_NATIVE_VFS_HASHES`), Stage 1 RAM queue & batched `git check-ignore` parity, Relational Watermark Derivation (`vfs.source_ts` vs `ctx.meta.timestamp`), post-commit cache re-invalidation, and Terminal Mark-and-Sweep GC.
* **Task 1.2 (`vfs://insetu/docs/models/vfs_occ_and_offline_outbox.md`):**
  - Document the Read-Your-Writes VFS overlay, `base_hash` & monotonic `ancestorHashes` ring buffer, deterministic 3-way line merge (`three_way_merge_text`), Dual-Representation Macro Preview read-only lockouts, and the Two-Stage IndexedDB Outbox Reconciler.
* **Task 1.3 (`vfs://insetu/docs/models/agent_orchestrator_and_rag.md`):**
  - Document the 3-Tier KV-Cache Prefix Funnel (Tier 0 Constitution, Tier 1 AST-Sliced Interfaces, Tier 2 Pinned Full Source), 5-turn working-set TTL decay, Hebbian `affinity_edges`, two-stage rolling history compaction (`raw_content` vs `content`), and root-boundary (`_depth == 0`) reply splitting.
* **Task 1.4 (`vfs://insetu/docs/models/workspace_swap_fsm.md`):**
  - Document the synchronous 6-phase `SessionOrchestrator` state machine (`LOCKED` -> `TEARDOWN` -> `IDENTITY_SWAP` -> `HYDRATE` -> `ROUTING` -> `READY`), `_suspendPersistence` layout eviction, and the `shouldDropTenantEvent` telemetry valve.

### Sprint 2: Blast-Radius Mental Model Auto-Discovery (`context_assemble.py` & `orchestrator.py`)
* **Task 2.1 (`vfs://insetu/insetu/core/gather/context_assemble.py`):**
  - Enhance `assemble_blast_radius(ctx, edit_targets, ...)` to inspect `resolve_repo_landmarks(ctx, repo=...)["landmarks"].get("model_files", [])`.
  - When a repository defines `docs/models/*.md` files, match edit targets against model file stems/tags (or Hebbian `affinity_edges`) and automatically include matching mental model files in Tier 1 Reference Targets without inflating Tier 0 Constitution tokens on unrelated turns.
* **Task 2.2 (`vfs://insetu/tests/unit/test_repo_landmarks.py`):**
  - Add unit test verifying that `assemble_context_payload` automatically includes `docs/models/yomama_bridge.md` when `insetu/core/bridge/bridge_vfs.py` is in `edit_targets`, and omits it when editing an unrelated file.

### Sprint 3: Worker Fault Transparency & Fitness Ratchet (`rules_python.py`)
* **Task 3.1 (`vfs://insetu/tests/fitness/rules_python.py`):**
  - Add `SILENT_WORKER_EXCEPTION_SWALLOW_BAN` to `BackendFitnessVisitor`: flag any `@*.worker`-decorated function whose top-level `try ... except Exception:` block catches `Exception` without either re-raising, emitting `system_error`, or recording `traceback.format_exc()`.
* **Task 3.2 (`vfs://insetu/insetu/core/` & `vfs://insetu/insetu/extensions/`):**
  - Audit all `@*.worker` functions across Core and Extensions to ensure unexpected worker exceptions emit structured `system_error` telemetry and surface clear diagnostic messages.
