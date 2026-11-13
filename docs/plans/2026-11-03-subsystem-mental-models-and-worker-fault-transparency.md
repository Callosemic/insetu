---
title: "Blueprint: Subsystem Mental Models, Blast-Radius Model Injection & Worker Fault Transparency"
repo: insetu
created_at: 2026-11-02T13:35:00
tags: [plan, rfc, mental-models, landmarks, rag, fitness, workers]
---

# Blueprint: Subsystem Mental Models, Blast-Radius Model Injection & Worker Fault Transparency

## Roadmap placement (2026-11-07)

- **Sprint 1 is yours, any time.** For the review-ready cut, the models a reviewer reads (`yomama_bridge.md` above all) should be ones you dictated. Two tasks come before plans that build on them: Task 1.2 (`vfs_occ_and_offline_outbox.md`) before the post-diff plan's 4.3 and 4.4, and Task 1.4 (`workspace_swap_fsm.md`) before the multi-tenant plan's Phase 2.
- **1.0:** Sprint 3 together with roadmap V3, as one rule in step 2. A worker is the strictest case of V3's swallowed-exception rule, not a second rule.
- **After 1.0:** Sprint 2 (blast-radius model injection), with the agent loop.


## Model catalogue (2026-11-07)

Every model that exists or that a plan needs, so no plan names one that is not there. A plan lists a model under `models:` only when the file exists; until then it names it in its text as "waits for model X".

| Model file | Status | Needed before | Sprint 1 task |
| --- | --- | --- | --- |
| `docs/models/yomama_bridge.md` | Exists. Confirm it is your dictation before the review-ready cut | REVIEWING.md's bridge stop; God-objects 3.4 (`bridge_vfs.py`) | Task 1.0 |
| `docs/models/agent_orchestrator_and_rag.md` | Exists. Confirm it is your dictation | Six-bucket Sprint 2 (after 1.0) | Task 1.3 |
| `docs/models/proximity_filters_and_domain_jumps.md` | Exists (dictated 2026-11-08): Proximity Filters, Multiplex Topologies, Cross-Domain Jumps & Two-Speed RAG Lifecycle | Six-bucket Sprints 3 & 4 (after 1.0) | Task 1.3b |
| `docs/models/mddb_and_tracker.md` | Exists (dictated 2026-11-08): Two-Axis Markdown Database (`md-db`), Sub-Record Spans, Unified Tracker Ontology & 2-Level Folder Law | `2026-11-09-mddb-and-tracker-streamlining.md` & God-Objects Wave 4.1 (after 1.0) | Task 1.3c |
| `docs/models/vfs_occ_and_offline_outbox.md` | Not written | Post-diff 3.1, 4.3 and 4.4 (1.0) | Task 1.2 |
| `docs/models/workspace_swap_fsm.md` | Not written | Multi-tenant Phase 2 (1.0) | Task 1.4 |
| `docs/models/topology_and_gather_pipeline.md` | Not written | Watchdog and gather changes; six-bucket Sprint 3 | Task 1.1 |
| `docs/models/protected_changes_and_attestations.md` | Proposed | The S5 + P13 Phase 2 blueprint; `SECURITY.md` | Task 1.5 (new) |
| `docs/models/layered_settings.md` | Proposed: tiers, `authority`, `merge`, the boot floor | P13 Phase 2 | Task 1.6 (new) |
| `docs/models/boot_and_offline_shell.md` | Proposed: shell cache, warming, quarantine, a dropped connection during boot | Post-diff 3.1; the boot network-drop fix | Task 1.7 (new) |

The three proposed models are suggestions: dictate them, merge them into others, or drop them.

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

### Sprint 3: Worker Fault Transparency, Job Finalizers & Polymorphic Provider Fitness (`rules_python.py`, `akasa`, `sutram`)
* **Task 3.1 (`vfs://insetu/tests/fitness/rules_python.py`):**
  - Add `SILENT_WORKER_EXCEPTION_SWALLOW_BAN` to `BackendFitnessVisitor`: flag any `@*.worker`-decorated function whose top-level `try ... except Exception:` block catches `Exception` without either re-raising, emitting `system_error`, or recording `traceback.format_exc()`.
  - Add `LANGUAGE_PROVIDER_METHOD_AND_ARG_ORDER_CHECK` to `BackendFitnessVisitor`: verify that any method called on a `get_language_provider(...)` variable (`definitions`, `imports`, `exports`, `call_sites`, `scope_boundaries`, `slice_interface`, `extract_symbol_slice`, `validate_syntax`) exists on `BaseLanguageProvider` and does not pass a literal filename string as the `content` first argument.
* **Task 3.2 (`vfs://insetu/insetu/core/`, `vfs://insetu/insetu/extensions/`, `vfs://akasa/akasa/workers/immediate.py`, `vfs://sutram/sutram/js/client.js`):**
  - Audit all `@*.worker` functions across Core and Extensions to ensure unexpected worker exceptions emit structured `system_error` telemetry and surface clear diagnostic messages.
  - Emit a guaranteed `worker_job_settled` hook (`status="completed" | "failed"`, `job_id`, `error`) inside `_execute_immediate_job`'s `finally:` block in `akasa` so extensions tracking `active_job_id` pointers (such as `chat_sessions.active_job_id`) always clean up on crash.
  - Update `createJobPoller` (`sutram`) to tolerate up to 2 consecutive transient network poll errors (surviving mobile/Tailscale handoffs) and surface the backend worker's `status_message` / exception reason in `onError` instead of a generic `"Sync failed"` string.

### Sprint 4: First-Class `.mjs` Behavioral Test Extraction & `js_loader.mjs` Unification (`insetu` & `sutram`)
> **Architectural Rationale:** Embedding multi-hundred-line JavaScript test scripts inside Python `r"""..."""` / `f"""..."""` strings hides JS imports and symbol references from `JavaScriptLanguageProvider` / `symbol_ledger` (blinding RAG `bridge.ast_symbols` and `bridge.cross_lang_refs`), bypasses `bridge_vfs.py` JS syntax validation at patch time, and invites Python string-interpolation/indentation collisions and split-brain `globalThis.window` mocks.
* **Task 4.1 (`vfs://sutram/tests/unit/js/*.mjs` & `vfs://sutram/tests/unit/test_sutram_registry.py`):**
  - Extract the 5 inline JavaScript test scripts in `test_sutram_registry.py` (`store_registry_lifecycle.mjs`, `chassis_contract.mjs`, `ring0_algorithms.mjs`, `orchestrators.mjs`, `inputs_and_settings.mjs`, `editor_language_loader.mjs`) into standalone `.mjs` files under `vfs://sutram/tests/unit/js/` executed directly in-place via `node --import ./js_loader.mjs` without temporary directories or regex source rewriting.
* **Task 4.2 (`vfs://insetu/tests/unit/js/*.mjs`, `test_js_behavioral_units.py`, `test_offline_resilience.py`, `test_workspace_swap_fsm.py`, `test_codemirror_bundle.py`):**
  - Extract embedded Node.js `node -e` / `run_test.mjs` multiline strings from `test_js_behavioral_units.py`, `test_offline_resilience.py`, `test_workspace_swap_fsm.py`, and `test_codemirror_bundle.py` into standalone `.mjs` modules under `vfs://insetu/tests/unit/js/` routed through `vfs://insetu/tests/unit/js_loader.mjs`.
  - Ensure `JavaScriptLanguageProvider` and Cartographer index `.mjs` files in `tests/unit/js/` so `rag.scout_tests` and `domain_jump` (`verification.behavioral`) trace JS symbols directly from source modules to `.mjs` behavioral tests.
* **Task 4.3 (`vfs://insetu/tests/fitness/rules_python.py` & `vfs://sutram/tests/fitness/rules_sutram.py`):**
  - Enforce `DETACHED_WINDOW_MOCK_BAN` (`globalThis.window = {` banned in favor of `js_loader.mjs` `globalThis.window = globalThis`) and `INLINE_NODE_SCRIPT_STRING_BAN` (flagging inline JS test strings `> 15` lines inside Python test files instead of importing standalone `.mjs` test modules).
