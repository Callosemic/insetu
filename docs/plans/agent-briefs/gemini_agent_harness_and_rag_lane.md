# Parallel Lane Brief: Agent Harness, 6-Bucket RAG Funnel & Dogfooding Observability

**Created:** 2026-11-10  
**Companion Brief:** `vfs://insetu/docs/plans/agent-briefs/gemini_offline_bridge_followup.md` (executed via the clean dogfooding session)  
**Governing Models & Plans:**
- `vfs://insetu/docs/models/agent_orchestrator_and_rag.md`
- `vfs://insetu/docs/models/proximity_filters_and_domain_jumps.md`
- `vfs://insetu/docs/plans/2026-11-14-greenfield-agent-compute-contract-and-envelope-unification.md`
- `vfs://insetu/docs/plans/2026-11-10-agent-loop-and-sandbox.md`
- `vfs://insetu/docs/plans/2026-11-12-lens-contract.md`
- `vfs://insetu/docs/plans/2026-11-03-six-bucket-orchestrator-and-composable-rag.md`
- `vfs://insetu/docs/plans/2026-11-02-decomposing-god-objects-across-the-triad.md` (Wave 3.2, 3.3, 3.5)

---

## 1. Purpose & Division of Labor (Zero File Collisions)

To dogfood Yomama Chat (`web_chat` handoffs, 2-hop scouting, `QUERY_CONTEXT` probes, and Staged Patch Stacks) on real production work without the dogfooded agent colliding with edits to its own runtime, work is partitioned into three non-overlapping lanes:

| Lane | Active Session | Owned Subsystems & Files | Strictly Hands-Off |
| :--- | :--- | :--- | :--- |
| **Lane A (This Brief)**<br>*Agent Harness, RAG & Observability* | Dedicated Agent Engineering Session | • `insetu/core/agent/*` (`orchestrator.py`, `llm_contract.py`, `routine_loader.py`, `expressions.py`, `envelope.py`, `plan_ledger.py`, `session_ledger.py`, `commands.py`, `engine_agent.py`, `agent.js`, `agent_store.js`, `agent_staged_stacks.js`, `routines/*.md`, `schemas/*`)<br>• `insetu/core/gather/context_assemble.py` & `rag_proximity.py`, and the new modules A2 item 0 creates in `insetu/core/gather/` and `insetu/core/bridge/` (never `engine_bridge.py` or `bridge_fuzzy.py`)<br>• `insetu/core/llm/engine_llm.py` & `llm_telemetry.py`<br>• `tests/unit/test_agent_orchestrator_and_mcp.py` | • `insetu/app.py`, `api.js`, `sw.js`, `sw-core.js`, `offline.js`, `akasa/__init__.py` (Lane B §2.1–2.4)<br>• `insetu/core/bridge/engine_bridge.py` & `bridge_fuzzy.py` (Lane B §2.6)<br>• `insetu/core/mddb/*`, `extensions/tracker/*`, `notes/*`, `skills/*` (Lane B §4 P20)<br>• `insetu/core/git/*`, `extensions/git/*` (Lane B §5 Sprint 0)<br>• `attestations.py`, `protected_changes.py`, `directives.py`, `notices.py`, `three_way_merge` (Lane C — Claude) |
| **Lane B (`gemini_offline_bridge_followup.md`)**<br>*Dogfooding Stream* | Clean External LLM Session via Yomama Chat Handoff | • **§2.1–2.4:** T9 content-hashed `compute_build_id` (`app.py`), `api.js` 426 cleanup, `akasa` build-ID header/bootstrap, `sw-core.js` real fetch handler Node test<br>• **§2.6 (Bridge half):** `bridge_telemetry.py` (from `engine_bridge.py`) and `bridge_sandwich.py` (from `bridge_fuzzy.py`)<br>• **§4 (P20):** `core/mddb/` and Tracker streamlining Sprints 1–4<br>• **§5 (P18 Sprint 0):** `insetu/core/git/` and Bonsai extension rename | • `insetu/core/agent/*`<br>• `insetu/core/gather/context_assemble.py`<br>• `insetu/core/llm/*` |
| **Lane C**<br>*Security, Notices & Kernel Parity* | Claude | • **N1 System Notices** (`notices.py`, `ui_notices.js`)<br>• **Issue #18** (`three_way_merge` parity)<br>• **In-App Help** (`ctx://help/`) & **Update Sprint 0**<br>• **S5, S6, S7, S9** security & risk classes | — |

---

## 2. Sequenced Sprints in Lane A (Responsive to Live Dogfooding)

At any point, live issues discovered while dogfooding Lane B in Yomama Chat preempt the queue below. Between dogfooding observations, Lane A executes the following self-contained sprints:

**Decided 2026-11-13.** Lane B runs as far as it will go, and its breakages come to Lane A to fix. When a fix lands in a file Lane B owns (the hands-off column above), say so in the summary, so Lane B's next turn starts from that state. Agent plan Sprint 0 (git in core) gates only the `Run` record's base commit and Sprint 2: staged buffers, approval, the run contract and the transcript go ahead without it. Give the `Run` record a nullable `base_commit` until Sprint 0 lands.

### Sprint A1: Greenfield `RoutineEnvelope`, Server-Authoritative Checkpoints & Single-Seam Context Compilation
*(Aligns `2026-11-10-agent-loop-and-sandbox.md` Sprint 1, `2026-11-03-six-bucket-orchestrator-and-composable-rag.md` Sprint 2, and `2026-11-07-post-diff-audit-and-mvcc-concurrency.md` Wave 1.2.)*

**Done 2026-11-13**, all 432 unit tests and fitness checks green. The local `editable_list`, `readonly_list`, and `all_context_files` lists in `orchestrator.py` have been removed (`RoutineEnvelope` is the single working-set owner, scoped to `pinned_repos`), `RoutineEnvelope.pack_working_set_context` compiles both the Full Context and Same-Window Delta Quickpacks from the unified `rendered_blocks` pipeline, all `chat_messages` writes route through `append_session_message` (plain `INSERT`), and all 5 owed ledger/query-context tests are split and passing in `test_agent_orchestrator_and_mcp.py`.

1. **`insetu/core/agent/envelope.py` & `context_assemble.py` (`RoutineEnvelope`, `ContextArtifact`, Multi-Scheme `project_resource_lens` & Day-0 Genesis Handling):**
   - Model every context item across the 6 buckets (`vfs://`, `ctx://`, `msg://`, `mddb://`, `tel://`) as a uniform `ContextArtifact(uri, bucket, lens, source, idle_turns, tokens)` projected through a single `project_resource_lens(ctx, uri, lens, **params)` dispatcher (`full`, `diff`, `slice`, `outline`, `genesis`).
   - **Day-0 / Genesis Target Preservation:** When a prompt, plan (`targets:`), or scout references a valid `vfs://<repo>/<path>` URI that does not exist in `topology_ledger` yet (or when running `/code` on an empty repository with 0 indexed source files), mount the URI with `lens="genesis"` (`[NEW FILE TO CREATE — GENESIS TARGET: vfs://<repo>/<path>]` alongside any existing sibling interfaces) rather than dropping it during `clamp_rag_files_to_topology`, and short-circuit `scout_targets` when `load_overview` has zero code files.
   - Partition `RoutineEnvelope` into collision-free namespaces (`sys`, `inputs`, `nodes[node_id]`, `execution_trace`, `holding[branch_id]`) and ban reserved node IDs (`sys`, `global`, `inputs`, `nodes`, `loop`, `_ctx`) in `validate_routine_definition`.
   - **Single-Object Execution Signature & Sub-Routine Forking (`envelope.fork_sub_routine`):** Pass `envelope: RoutineEnvelope` through `execute_declarative_routine` and delegate mode/sub-routine handoffs (`workspace_turn` $\rightarrow$ `code` and `type: routine` nodes) via `envelope.fork_sub_routine(target_routine_id)` so `inputs`, `handoff_responses`, `sent_hashes`, and callbacks can never be dropped across recursive hops.
   - **Eliminate Split-Brain Working-Set Lists in `orchestrator.py`:** Delete the mutable local `editable_list`, `readonly_list`, and `all_context_files` lists in `orchestrator.py`. Route all working-set mutations exclusively through `envelope.apply_working_set_delta(add=..., drop=..., lens=..., source=...)` and expose `envelope.editable_files`, `envelope.readonly_files`, and `envelope.all_context_files` as read-only computed properties (automatically scoping `constitution_files` to active repositories).
   - Enforce the rule that `source="user_pinned"` artifacts are never silently dropped by automated Hop-2 scouts, whereas `source="scout_hop1"` tentative guesses are replaced/dropped when Hop 2 reads a discovered plan or brief.
   - Evict non-promoted branch-local artifacts when `1 -> N` or `map_over` wavefronts settle.
2. **Server-Authoritative Checkpoint Resumption & Fault-Tolerant Job Lifecycle (`engine_agent.py`, `orchestrator.py`, `agent.js`):**
   - Persist the serialized `RoutineEnvelope` (`envelope.to_checkpoint()`) into `chat_sessions.checkpoint_json` whenever a routine pauses (`paused_for_user` or `paused_for_budget`).
   - On resume (`POST agent/prompt` with `handoff_responses`), hydrate `envelope = RoutineEnvelope.from_checkpoint(saved_checkpoint)` on the server so the browser only sends `{session_id, handoff_responses}`—eliminating `"Resume Routine Handoff"` prompt clobbering and client-echoed state drift.
   - Unify `pre_supplied_handoff` (`web_chat`) and `llm.complete` (API) `<<<<<<< QUERY_CONTEXT` handling into a single post-inference probe method supporting `+ <uri> [lens]` and `- <uri>`, and clear consumed `handoffBranchResponses[node_id]` in `AgentStore` when a probe pauses for a follow-up handoff.
   - Ensure `active_job_id` on `chat_sessions` is always cleared in a `finally:` / `worker_job_settled` barrier, and surface specific worker failure messages (`statusData.status_message`) in the Thinking trace drawer rather than a generic `"Sync failed"` toast.
3. **Single Context-Compilation Seam (`context_assemble.py` & `orchestrator.py`):**
   - Register `ctx://contexts/turn_<hash>_context.txt` in `manifest_ledger` inside `assemble_context_payload` (`context_assemble.py`) so `[Context]` in Web-Chat Handoff can copy/download multi-chunk turn contexts directly from `gather.context.assemble`, retiring duplicate context-packing branches in `orchestrator.py`.
4. **Dual-Track Canonical Message Log & Watermarked Compaction View (`engine_agent.py`, `context_assemble.py`, `orchestrator.py`, `agent.js`):**
   - **Canonical Message Log (`chat_messages`):** Extend `chat_messages` with `seq` (`INTEGER` monotonic sequence `1..N`), `receipt` (`TEXT` 1–2 line deterministic micro-receipt with committed `transaction_id` / files), `transaction_id` (`TEXT`), and `compacted_into_id` (`TEXT` pointer to the cold summary block ID).
   - **Watermarked Compaction Ledger (`chat_sessions.compacted_view_json`):** Store `{compacted_up_to_seq, blocks: [{summary_id, seq_range, message_ids, mode, summary_text}]}` so cold messages (`seq <= N - 12`) are summarized once per watermark advance rather than re-summarized on every turn.
   - **Deletion Invalidation:** Deleting a message (`DELETE agent/messages/<message_id>`) removes the row from `chat_messages` and rebuilds/invalidates any cold block in `compacted_view_json` whose `message_ids` contained the deleted ID.
   - **Addressable Recall (`msg://<message_id>`) & `web_chat` Parity:** Stamp warm receipts and cold blocks with `[msg_<id>]` coordinates, allow `<<<<<<< QUERY_CONTEXT` (`msg://<message_id>` or `msg://<message_id> [raw]`) to recall the original full message or raw patch block, and include the compacted transcript block in packed `[Context]` artifacts for `use_history: true` nodes.
5. **CQRS $O(1)$ Session Hydration, Catalog Separation & UDF Composer State (`agent_store.js`, `agent.js`, `engine_agent.py`):**
   - **Separate Catalog Hydration from Session Switching:** Split `fetchSessions` into `hydrateAgentCatalog()` (fetching `agent/routines`, `llm/profiles`, and `agent/settings` once on workspace load or explicit refresh) and lightweight 1-request `createSession()` / `selectSession(id)` actions.
   - **Pure $O(1)$ SQLite Reads on `GET agent/messages/<session_id>`:** Compute and persist per-file token weights (`working_set_json`) and per-tier session costs (`token_ledger_json`) on write (turn completion or working-set mutation) so `get_messages` performs zero synchronous `ctx.vfs.read()`, AST `slice_interface()`, or `model_catalog.json` disk reads.
   - **UDF Composer & Sticky vs. One-Shot Mode Contract:** Remove `_clearComposerDomValue` shadow-DOM queries in `agent.js`; resolve leading `/command:scope:stage` tokens synchronously inside `AgentStore` on submit, keep sticky conversational modes (`/code`, `/plan`, `/ask`, `/yolo`) active across turns while resetting one-shot routines (`/test`, `/wrap`, `/upkeep`) to the prior mode, and never insert empty `assistant` rows (`content == ""`) into `chat_messages` when a routine skips or produces empty output.
6. **Shared-Engine Alignment (decided 2026-11-12; read before starting A1):**
   - The envelope's lens dispatcher implements the lens contract in `docs/plans/2026-11-12-lens-contract.md`: providers answer `project`, `neighbours`, `outline_root` and `resolve`; a projection records `served_lens`, `tokens` and `sha256`; distance bands are envelope policy. `project_resource_lens` becomes the envelope's call into that registry, not a second mechanism.
   - `outline_root(scope, budget)` follows the contract's "The outline root": it serves only the `outline` lens, as the finest whole level that fits. The envelope fixes the budget when the run starts (5% of the smallest input token limit among the run's models, from configuration) and keeps it in the run state, so a resumed run gets the same outline.
   - `resolve` is still OPEN in the contract (in the contract, or a capability a triage step calls). Keep it behind the registry so either answer is a small change.
   - Follow the shared-engine constraints in agent plan Sprint 1 (`docs/plans/2026-11-10-agent-loop-and-sandbox.md`): run state is data (the checkpoint is the whole state a step needs); the orchestrator's inline patch, test, heal and revert sequence moves out into routine nodes or capabilities; the routine grammar carries no code-specific fields; one set of tier names (`decision`, `fast`, `standard`, `thinking`, `frontier`) mapped to providers in configuration; one validate-then-repair mechanism for structured output.
   - Why: a second consumer of this engine is planned. Built this way now, nothing in A1 has to be undone later.

### Changed by Claude in Sprint A1 item 4 (2026-11-12): read before touching the message log

Item 4 (the dual-track message log) is built and reviewed. Claude fixed four things in `engine_agent.py` and `envelope.py`. The reason is a planned memory system (`docs/plans/2026-11-12-memory-and-conversation-ledger.md`, speculative) that treats `chat_messages` as its ledger, so the log has to hold a few properties from now on.

**What changed:**
- **`ingest_reply` issues every message id itself** and refuses a client-supplied `message_id` with 400. A client-supplied id used to overwrite any message with that id, in any session, so one `msg://` address could come to mean different text. It also refuses a `role` other than `assistant` or `user` (400) and a session that does not exist (404), and writes with a plain `INSERT`.
- **QUERY_CONTEXT reads only topology files** (`_readable_by_query` in `context_assemble.py`). Its text can come from an outside model's reply, so the fuzzy fallback in `compile_query_quickpack` and the direct-URI, `file_slice` and `symbol_def` paths in `resolve_query_context` refuse a `vfs://` file outside the workspace topology.
- **Sequence numbers are never reused.** `next_session_seq` keeps `chat_sessions.seq_counter`, the highest number ever issued. `MAX(seq) + 1` handed a deleted newest message's number to the next message.
- **Deleting a message rebuilds the summary from that point.** The delete route drops the block holding the message and every later block, lowers the watermark to the end of the last block kept, and clears `compacted_into_id` on the messages those blocks held; the next turn re-summarises them. Before, deleting a message in an earlier block left the watermark above that block's other messages, so they dropped out of the summary for good.
- **Each assistant message records what the turn saw.** `chat_messages.context_hashes_json` maps each attached, referenced and committed file to its hash when the turn ended (`capture_turn_context_hashes`, using `compute_vfs_sha256`, so the values compare with `bridge_ledger.post_patch_hash`). The repository commit is added once git moves into core (agent plan Sprint 0).

**Rules for the message log from now on:**
- A `message_id` means one message for its whole life: never reused, never overwritten.
- A `seq` means one message for the life of its session.
- `compacted_view_json` and `summary` are derived. Everything in them must be rebuildable from `chat_messages`; nothing is stored only there except the text of LLM-written summaries.
- Conversation data stays in the workspace control directory (`.insetu/`), never under a repository's `.insetu-data/`.

**Tests you owe (Done 2026-11-13 in `test_agent_orchestrator_and_mcp.py`):**
- `test_ingest_reply_validation_and_monotonic_seq_after_delete`: verifies `ingest_reply` mints `msg_` + 12 hex IDs, returns 400 on client-supplied `message_id`, 400 on `role: "system"`, and 404 on unknown `session_id` without writing a row or bumping `seq_counter`, and never reuses a deleted `seq`.
- `test_message_deletion_invalidates_cold_compaction_blocks_and_rebuilds_from_messages`: verifies deleting from the first cold block drops both blocks, resets `compacted_up_to_seq` to 0, clears `compacted_into_id`, and rebuilds from `chat_messages` alone.
- `test_real_turn_records_context_hashes_matching_bridge_ledger`: runs a real assistant turn (`_execute_agent_turn` in `/yomama` mode) that commits a file and verifies `chat_messages.context_hashes_json` matches `bridge_ledger.post_patch_hash`.
- `test_query_context_refuses_untracked_files_across_all_forms`: verifies `resolve_query_context` and `compile_query_quickpack` refuse untracked files across direct URI, `file_slice`, `symbol_def`, and fuzzy name while serving tracked topology files (fixing a bug where bare filenames in `compile_query_quickpack` previously raised `ValueError` in `clamp_uris_to_topology`).

**One code change with them (Done 2026-11-13):** all user-message and assistant-message writes in `engine_agent.py` and `session_ledger.py` now route through `append_session_message` using a plain `INSERT` (never `INSERT OR REPLACE`), so no path can replace an existing message.

**For lens contract Sprint 1, with item 1's dispatcher:**
- `msg://` is parsed in two places (`project_resource_lens` and `resolve_query_context`) with three accepted spellings (`msg://<id>`, `msg://<session_id>/<id>`, bare `msg_<id>`). Make one parser and one canonical form, `msg://<message_id>`, and keep the others as input aliases only.
- Projections return `{uri, lens, content, tokens}`. The contract's projection is `{uri, lens, served_lens, text, tokens, sha256, truncated}`.

### Sprint A2: God-Objects Wave 3.2 & 3.5 Cleanup + Session-Scoped Tier Telemetry (`llm_telemetry.py`, `expressions.py`)

**0. Re-cut the A1 split along its seams (Done 2026-11-13; refined in A2.6):**
- `envelope.py` (~230 lines after A2.6) keeps only pure zero-I/O run state: `ContextArtifact`, `RoutineEnvelope`, `_hash_projection`, and `record_trace_step` (with `pack_envelope_working_set` and `resolve_envelope_query_directives` moved to `context_assemble.py`).
- `plan_ledger.py` (~420 lines) owns `apply_task_manage_actions`, `process_turn_task_directives`, `complete_and_advance_plan_task`, `promote_ephemeral_plan_to_file`, `record_committed_bridge_transaction`, and `execute_bridge_sync_and_test_gate`.
- `session_ledger.py` (~520 lines) owns all `chat_sessions` and `chat_messages` reads/writes (`append_session_message`, `delete_session_message_and_invalidate`, `load_session_messages_state`, `reconcile_working_set_ttl`, `compact_session_history`, `persist_paused_turn_state`, `finalize_completed_turn_state`), bringing `engine_agent.py` down to ~605 lines.
- `commands.py` (~58 lines) owns `parse_colon_command_tokens` and `parse_slash_command`.
- `routine_loader.py` (~515 lines) keeps only the routine grammar (`parse_routine_content`, `serialize_routine_to_markdown`, `validate_routine_definition`, `list_available_routines`, `load_routine_definition`, `resolve_routine_mode`, `compile_node_wavefronts`, `response_path_error`, `persist_routine_response`).
- Context selection moved to `insetu/core/gather/rag_proximity.py`: `_collect_workspace_file_extensions`, `_slice_numbered_subitems`, `_prioritize_document_sections`, `extract_doc_referenced_files`, `clamp_rag_files_to_topology`, and `build_context_file_metrics`.
- `collect_live_files_for_patch_healing` and `strip_yomama_blocks_keep_prose` moved to `insetu/core/bridge/parser.py`.

1. **Finish `insetu/core/llm/llm_telemetry.py` (§2.6; Done 2026-11-13):**
   - `LLM_SCHEMA["llm_telemetry"]`, `telemetry_session_scope(session_id, workspace_id)`, per-session/per-tier cost aggregation, and the Two-Level Budgeting Paradigm (`75%` mechanical per-call model `context_length` ceiling + ratcheting $X_{\text{new}} = X_{\text{old}} + Y$ session spend watermark with buttonless `web_chat` warning pass-through) now live in `llm_telemetry.py`.
2. **Finish `insetu/core/agent/expressions.py` (split out in A1), Retire Duplicate `.yaml` Routines & Remove Legacy Shims (Done 2026-11-13):**
   - `_MUSTACHE_COND_RE`, `normalize_condition_expr`, `evaluate_when_condition`, and `vault_if_oversized` live in `insetu/core/agent/expressions.py` (~105 lines).
   - `engine_mcp.py` and `test_agent_orchestrator_and_mcp.py` import directly from `insetu.core.agent.routine_loader` and `insetu.core.agent.commands`, and `MODULE_LINE_RATCHET` ceilings in `tests/fitness/rules_python.py` have been lowered (`orchestrator.py`: `1530 -> 1502`, `engine_llm.py`: `871 -> 839`).
   - Deleted the 5 shadow `.yaml` files (`code.yaml`, `ask.yaml`, `plan.yaml`, `workspace_turn.yaml`, `yomama.yaml`) and migrated `symbol_refactor.yaml` -> `symbol_refactor.md` and `map_reduce_audit.yaml` -> `map_reduce_audit.md`.

### Sprint A2.5: Unified Plan Stepper (`meta.active_plan`), Two-Pass Normalizer/Verifier & Commit-Driven Step Progression
*(Implements `docs/models/agent_orchestrator_and_rag.md` §4.2 and `docs/plans/2026-11-10-agent-loop-and-sandbox.md` §2 Step 1 — Done 2026-11-13.)*

1. **One Canonical Plan Schema Across Files & Ephemeral Sessions (`schemas/plan.py` & `session_ledger.py`):**
   - Extend `PlanTask` with `kind: "explore" | "edit" | "verify"` and add `normalize_active_plan_dict`, `format_active_plan_meta_projection`, `tick_task_in_plan_markdown`, and `should_recommend_file_upgrade` in `insetu/core/agent/schemas/plan.py`.
   - Store normalized multi-step plans in `chat_sessions.active_plan_json`. Ephemeral plans (synthesized from narrative briefs like `gemini_offline_bridge_followup.md` or broad prompts) stay in `chat_sessions` without mutating the source brief on disk, surfacing a 1-click **Upgrade to Plan File** action (`POST agent/plan_task` with `action="promote_to_file"`) when complexity crosses $\ge 4$ tasks or $\ge 6$ target files.
2. **Bounded 4-Hop Convergent Scout & Plan Loop (`until:`) + Continuous Thinking-Loop Plan Editing (`code.md`, `orchestrator.py`, `session_ledger.py`):**
   - **Convergent Fast Scout & Initial Plan Loop (`scout_targets` in `code.md`, `max_iterations: 4`):** Loops over `CODE_INDEX.md`, landmarks, and any queried plans/files (`inspect_files`) until it has both file coverage (`global_files` + `requested_files`) and an initial step-pinned plan (`tasks` with `targets`). The first iteration to provide a schematically valid plan locks it in as the initial `active_plan` so Turn 1's `fetch_context` packs only `global_files` + `T1.targets` (`full` lens) + 1-hop blast-radius neighbors (`slice` lens).
   - **Continuous Plan Evaluation in the Thinking Loop (`generate_patch` in `code.md`):** On Turn 1 (and every subsequent turn), the `thinking` tier can edit/refine the locked-in plan via `<<<<<<< TASK_MANAGE` (`UPDATE`, `ADD` upsert, `DROP`, `COMPLETE`, `ACTIVE` — checking off items, updating targets, or splitting complex steps into sub-steps) while implementing the active step.
   - **Unified LLM Egress (`process_turn_task_directives` in `session_ledger.py`):** Shared across `orchestrator.py`, `finalize_completed_turn_state`, and `api_ingest_reply` (`engine_agent.py`), auto-applying `add`/`set_active` plan-creation ops immediately while gating `complete` actions behind user commit confirmation (or `auto_complete_plan_tasks`).
3. **Foveated Plan Projection & Active-Step Working-Set Scoping (`rag_proximity.py`, `envelope.py`, `orchestrator.py`):**
   - Scope each turn's `editable_files` in `RoutineEnvelope` (`Bucket 4: data`) strictly to the active `PlanTask.targets` (`full` lens) + `test_contract` + 1-hop `assemble_blast_radius` AST/affinity neighbors (`slice` lens, with `requested_symbols` preserved).
   - Project `active_plan` into `Bucket 3: meta` (`active_plan_prompt_block`) with the active step at `full` lens and completed/future steps at `outline` lens (`DEFERRED — Do NOT implement in this turn`).
4. **Commit-Driven Step Check-Off & Next-Step Handoff Progression (`session_ledger.py`, `engine_agent.py`, `agent_staged_stacks.js`, `agent.js`):**
   - When **Confirm & Commit** (`agent.record_transaction`) commits a staged stack, bind `transaction_id` (`tx_...`) to the active `PlanTask`.
   - Support both manual 1-click progression via `<insetu-agent-plan-stepper>` (**"✓ Mark [T1] Done (tx_...) & Start [T2]"**, default) and automatic progression (`auto_complete_plan_tasks: true` in `AGENT_SETTINGS_SCHEMA`), ticking `- [x] [ID] (tx_...)` in-place when backed by a plan file, rotating the working set to the next step's targets, and launching the next turn's run/handoff.
   - Verified by `test_multi_step_plan_scoping_commit_advance_and_file_promotion` in `tests/unit/test_agent_orchestrator_and_mcp.py`.

### Sprint A2.6: Greenfield Compute Contract, Pure Zero-I/O `RoutineEnvelope` & Complete `chain_context` Eradication
*(Implements `vfs://insetu/docs/plans/2026-11-14-greenfield-agent-compute-contract-and-envelope-unification.md` Sprints 1–5 — Done 2026-11-14.)*
1. **Pure Zero-I/O `RoutineEnvelope` (`envelope.py` & `context_assemble.py`):** Move `pack_envelope_working_set` and `resolve_envelope_query_directives` out of `envelope.py` into `insetu/core/gather/context_assemble.py` (`ENVELOPE_ZERO_GATHER_IO_BAN`), add `served_lens`/`sha256` to `ContextArtifact` and `outline_budget` to `RoutineEnvelope` (per `2026-11-12-lens-contract.md`), and remove all hardcoded `"scout_targets"` / `"load_overview"` node-name lookups from `rag_proximity.py` (`ORCHESTRATOR_NODE_NAME_COUPLE_BAN`).
2. **Two-Sided LLM Compute Contract (`llm_contract.py` & `orchestrator.py`):** Extract `prepare_llm_prompt_and_system` / `collect_wavefront_handoff_branches` (Ingress) and `execute_llm_dag_node` (Egress) into `insetu/core/agent/llm_contract.py`, shrinking `orchestrator.py` to a pure DAG wavefront scheduler.
3. **End-to-End `chain_context` Eradication & Unified `TurnSettlementArtifact` (`session_ledger.py`, `engine_agent.py`, `agent_store.js`, `agent.js`):** Delete `"chain_context"` from checkpoints, routine return dicts, `session_ledger.py`, `agent_store.js`, `agent.js`, and tests (`LEGACY_CHAIN_CONTEXT_BAN`), routing all completed turns, resumed `web_chat` handoffs, and ad-hoc reply pastes through `RoutineEnvelope` and `AgentStore.applyTurnSettlement(artifact)`.

### Sprint A2.7: 4-Hop Convergent Scout Plan Lock-In, `global_files` vs. Step-Pinned `targets`, and In-Place `TASK_MANAGE` Editing (Done 2026-11-16)
*(Implements the dogfooding findings and updated `docs/models/agent_orchestrator_and_rag.md` §4.1–4.2 mental model — all 434 unit tests and fitness checks green.)*

- [x] **[A2.7.1] Interleaved `(scout_targets -> plan_tasks)` Fast Convergence Loop (`max_iterations: 3`) (`insetu/core/agent/routines/code.md`, `routine_loader.py`, `orchestrator.py`, `llm_contract.py`):**
  - Wrapped `scout_targets` (pure file & linked-document discovery) and `plan_tasks` (initial plan synthesis & missing-context verification) inside `scout_and_plan_loop` (`type: loop`, `max_iterations: 3`, `until: "{{ nodes.plan_tasks.status | 'ready' }} == 'ready'"`) in `code.md`, preserving `loop.prev` across iterations so Cycle 2+ `scout_targets` reads `plan_tasks.missing_context_notes` and `plan_tasks.tasks`.
  - Updated the egress handler in `llm_contract.py` and `rag_proximity.py` to accept `global_files: List[str]` (excluding `CODE_INDEX.md`), enrich each task's `targets` with any workspace files named in its `description`, and merge any newly pinned task `targets` into `envelope.scouted_candidate_files`.
  - Locked in the first schematically valid `tasks` list emitted during the `scout_targets` loop onto `envelope.scouted_tasks` (allowing later hops in the loop to refine task targets if `inspect_files` discovered additional files).
  - Fixed `_accumulate_scout_candidates` in `llm_contract.py` and `ingest_scout_inspect_files` in `rag_proximity.py` so:
    1. Only clamped, valid URIs are accumulated across hops (an unresolved path from Hop 1 is never re-accumulated into Hop 2, and directory URIs like `vfs://akasa/docs/` resolve to `00_index.md` / `README.md` / `index.md`).
    2. `find_path_candidates` (`utils_core.py`) falls back across sibling repositories **only within the already-authorized `allowed_repos` (`pinned_repos`) list** when an LLM prefixes the wrong repo name onto a path.
    3. If a requested path matches a mounted repository that is currently **excluded by the user's `pinned_repos` filter**, it is never silently included; `unpinned_repo_notices` records the excluded repo so the user can choose whether to widen scope.
    4. Execution trace summaries name the actual inspected filenames (or unresolved path hints) instead of the opaque `scout_path_feedback.txt` sentinel.
- [x] **[A2.7.2] `global_files` Preservation & Step-1 Working-Set Scoping (`insetu/core/gather/rag_proximity.py`):**
  - In `expand_scouted_working_set_targets`, `envelope.scouted_global_files` (plus the primary plan/brief doc) stays mounted across all steps of `active_plan`, while `editable_files` (`full` lens) is scoped strictly to the active step's `targets` (`T1.targets`) + 1-hop `assemble_blast_radius` AST/affinity neighbors of `T1.targets` at `slice` lens.
- [x] **[A2.7.3] Full In-Place Plan Editing in `TASK_MANAGE` (`insetu/core/agent/schemas/plan.py` & `plan_ledger.py`):**
  - Added `UPDATE: <id> | kind: ... | targets: ... | test: ... | <Description>` (and `EDIT:`) to `extract_task_manage_directives` and `reduce_plan_actions`, and made `ADD: <id> | ...` upsert in-place when `<id>` already exists in `active_plan["tasks"]` (or insert new sub-steps like `T1a`, `T1b` immediately after the active step).
  - Auto-applied `update` alongside `add` and `set_active` in `process_turn_task_directives`.
  - Clarified in `code.md` (`## generate_patch`) and `yomama_patch_protocol.md` that when an `ACTIVE MULTI-STEP EXECUTION PLAN` is present, `<<<<<<< QUERY_CONTEXT` is used only when a file/symbol needed for the *currently active step* is missing from context, never to pre-fetch files for deferred steps (`T2+`).
- [x] **[A2.7.4] `msg://` Lens Schema & Turn-Partitioned Telemetry Export (`msg_lens.py`, `context_assemble.py`, `bridge_telemetry.py`, `engine_bridge.py`, `llm_telemetry.py`, `plan_ledger.py`):**
  - **Formalize the `msg://` Lens Schema (`msg://<session_id>` & `msg://<message_id>`):**
    1. Stamp `turn_msg_id` on `llm_telemetry` (`llm_telemetry.py`) and `bridge_heal_audit` rows, and persist `execution_trace` inside `chat_messages.context_hashes_json["__envelope__"]` when a turn pauses or completes (`session_ledger.py` / `plan_ledger.py`).
    2. Upgrade `project_resource_lens` (`context_assemble.py`) for `msg://` so:
       - **`project("msg://<session_id>", lens="slice")` $\rightarrow$ `00_session_overview.txt` (~5–15 KB):** Renders the session's `active_plan` progression, cumulative token/cost ledger by tier, and a chronological turn-by-turn index (`Turn #1..#N`) with each turn's user prompt, `/mode` & `routine_id`, full DAG `execution_trace` tree (including nested `scout_targets:hop1..k` children, elapsed ms, and `+added / -dropped` working-set deltas), and a 1-line summary table of every LLM call and Bridge heal pass in that turn.
       - **`project("msg://<message_id>", lens="full")` $\rightarrow$ `turn_<NNN>_<mode>_dossier.txt`:** Renders the complete, self-contained forensic dossier for that turn: user prompt, pre/post `__envelope__` working-set snapshot (`uri`, `lens`, `tokens`, `sha256`), `active_plan` state, DAG `execution_trace`, the full prompt and response excerpts of **all** `llm_telemetry` calls in that turn (including nominal `status == "ok"` fast-scout hops and `web_chat` handoffs, scrubbed via `scrub_outbound_secrets`), the assistant/handoff reply (`content` + `raw_content`), and any `bridge_heal_audit` case studies from that turn.
  - **Extract `bridge_telemetry.py` & Wire Gather + `.zip` Export onto `msg://` Projections:**
    - Extract `compile_ai_telemetry_context` and `api_bridge_compile_telemetry` from `engine_bridge.py` into `insetu/core/bridge/bridge_telemetry.py` (paying back the `engine_bridge.py` line ceiling from `gemini_offline_bridge_followup.md` §2.6).
    - `POST bridge/compile_telemetry` pulls directly from `project_resource_lens("msg://<session_id>", "slice")` + `project_resource_lens("msg://<latest_or_selected_msg_id>", "full")` to compile `ctx://contexts/ai_telemetry_context.txt` for 1-click Copy/Share in Gather, and supports `format="zip"` (or `GET/POST bridge/telemetry_zip`) to stream a `session_<session_id>_telemetry.zip` containing `00_session_overview.txt` alongside one `turn_<NNN>_<mode>_dossier.txt` file per turn in the conversation.

### Sprint A2.8: Polyglot Step-State Reduction (`EpistemicMode` $\times$ `Scope` $\times$ `ActiveDomains`), `<<<<<<< ASK_USER` Decision Probes & Post-Plan Transitions
*(Implements `docs/models/agent_orchestrator_and_rag.md` §4.1–4.3, §7.3, §13.5 and `2026-11-14-greenfield-agent-compute-contract-and-envelope-unification.md` Sprint 6.)*

1. **Polyglot Step-State Reducer & Artifact-Driven Domain Craft Lenses (`envelope.py`, `schemas/plan.py`, `llm_contract.py`, `routines/*.md`):**
   - Model every turn and every `PlanTask` step $T_k$ as reducing to $\text{StepState}(T_k) = (\text{epistemic\_mode}, \text{scope\_mode}, \text{active\_domains})$ where `epistemic_mode` $\in \{\text{explore}, \text{plan}, \text{edit}, \text{verify}, \text{audit}, \text{explain}\}$ and `scope_mode` $\in \{\text{step}, \text{plan}, \text{turn}, \text{dirty}, \text{backlog}\}$.
   - Derive `active_domains` (`code`, `mddb`, `prose`) from the URI schemes and file extensions mounted in `Bucket 4: data` for the current step, projecting only the matching **Domain Craft Lens** into `Bucket 6: prompt` and running only the matching deterministic domain sensors (`bridge.test` / `fitness_functions` for `code`; `ctx.mddb.audit_upkeep` for `mddb`; link/citation checks for `prose`) into `Bucket 5: telemetry`.
2. **Two-Tier Clarification Contract (Non-Blocking Fast Tier + Interactive Thinking-Tier `<<<<<<< ASK_USER`):**
   - **Fast Tier (`plan_tasks` in `scout_and_plan_loop`):** Never blocks mid-loop; attaches optional `clarifications: [{id, question, options, default}]` to `active_plan` when a scope fork is detected so `fetch_context` finishes without interruption and `<insetu-agent-plan-stepper>` renders 1-click scope-flip pills.
   - **Thinking Tier (`generate_patch`, `/plan`, `/ask`):** Supports `<<<<<<< ASK_USER` (`boolean`, `single_choice`, `multi_choice`, `short_text`, max 1 hop per node) for genuine architectural/product forks that cannot be answered via `QUERY_CONTEXT`. Pauses the turn (`pending_questions`), renders `<insetu-agent-decision-card>` in Chat, and injects `=== USER DECISION RESPONSES ===` into `envelope.recalled_messages_text` and the Same-Window Delta pack on resume.
3. **Post-Plan Completion Transitions (`unchecked_count == 0` $\rightarrow$ Automatic `scope_mode` Widening):**
   - **Automatic Widening from `step` $\rightarrow$ `plan` / `backlog`:** When `active_plan` has `unchecked_count == 0` (`active_task_id is None`), post-plan turns no longer stay stranded on the final step `TN`'s targets:
     - **`audit` / `explain` / `verify` (*"review your work"*, *"explain your work"*, *"how's our progress"*):** Widens to `scope_mode = "plan"`, mounting the cumulative `bridge.turn_diff` across all `transaction_id`s recorded in `active_plan` (`T1..TN`) plus modified files across all steps and the governing `global_files` brief, and populates `Bucket 5: telemetry` with deterministic domain sensor results. Any fixes discovered append new `PlanTask` items (`T5+`) via `TASK_MANAGE`.
     - **`backlog` / Horizon Discovery (*"what's next?"*):** Projects a 1-turn `[COMPLETED PLAN RECEIPT]` in `Bucket 3: meta`, inspects remaining unchecked items in the attached `global_files` brief/plan (`docs/plans/*.md`) and open Tracker/notice items, and presents concrete next-horizon choices via `<insetu-agent-decision-card>` (`<<<<<<< ASK_USER`) so selecting an option immediately initializes the next plan.
     - Surfaces 1-click completion pills (`[🔍 Review & Audit Work]`, `[📖 Explain Changes]`, `[🧭 What's Next?]`) in `<insetu-agent-plan-stepper>` when all tasks in `active_plan` reach `[x]`.

### Sprint A3: P19 Helper Modes (`deterministic` | `ai_assisted` | `custom`) & Quota Fallback
*(Fulfills `gemini_offline_bridge_followup.md` §3 inside the `agent` / `llm` modules without touching Lane B files.)*

1. **Single Server-Side Helper Resolver (`resolve_effective_helpers(ctx, profile_id)`):**
   - Replace scattered `helper_mode` checks in `orchestrator.py` and `engine_agent.py` with one server function returning `{mode, context_scout, history_compaction, routine_patch_repair, reason}`.
   - Default to `ai_assisted`; short-circuit automatically to `deterministic` when no API key/provider is configured for the Fast tier (surfacing `"Deterministic: no API key"` in Settings) or when a call hits a 429 quota/rate-limit error (falling back to deterministic for that turn with a notice instead of failing the turn).
   - Keep the Yomama Bridge page's repair mode (`BridgeStore.repairMode`) completely independent of `helper_mode`.
2. **Extract Helper-Mode Settings UI from `agent.js` (`agent_staged_stacks.js`):**
   - Render the `deterministic` | `ai_assisted` | `custom` (3 sub-selectors) control cleanly inside the extracted Agent UI component module, keeping `agent.js` under its ceiling in `tests/fitness/` (it was 1,115 lines after the 2026-11-12 cleanup); split the file rather than raise the ceiling.

### Sprint A4: Composable RAG Units (`rag.seed_diffs`, `rag.scout_tests`, `rag.blast_radius`), Semi-Deterministic Plan Normalization & 3-Tier Hebbian Coupling
*(Implements `2026-11-03-six-bucket-orchestrator-and-composable-rag.md` Sprints 3 & 4, `2026-11-12-lens-contract.md` Sprint 1, and `2026-11-10-agent-loop-and-sandbox.md` Sprint 3 inside `insetu/core/gather/` and `insetu/core/agent/`.)*

1. **[x] Single Context Compiler Unification (`pack_envelope_working_set` in `context_assemble.py` & `llm_contract.py`):**
   - Routed Web-Chat handoff fallback packing (`build_web_chat_handoff_branch`) and `assemble_context_payload` AST slicing through `pack_envelope_working_set` / `project_resource_lens` in `insetu/core/gather/context_assemble.py` while keeping `envelope.py` 100% free of Gather/VFS I/O.
2. **[ ] Semi-Deterministic Normalization of Unstructured Plan Documents (`plan_ledger.py`, `schemas/plan.py`, `agent_handoff_and_plan.js`):**
   - When an attached or scout-inspected document (`plan_source_uri`) is acting as a multi-step plan (`parse_plan_markdown == False` and $\ge 2$ tasks in `active_plan`), or when `recommend_file_upgrade` is `True`, surface two 1-click normalization actions in `<insetu-agent-plan-stepper>` (`POST agent/plan_task` with `action="normalize_in_place"` or `action="promote_to_file"`):
     - **Option A (`normalize_in_place` — Staged Yomama Rewrite):** Uses a fast/standard LLM pass + deterministic `clamp_rag_files_to_topology` target clamping to rewrite the unstructured `.md` document into a canonical `PlanDocument`—retaining all non-task background prose and warnings verbatim under `## Context & Invariants` while converting work items into `## Sprint N` sections and `- [ ] [ID] Description <!-- targets: vfs://..., test_contract: vfs://... -->` checklists—and returns the rewrite as a staged Yomama patch in `BridgeStore` for human review.
     - **Option B (`promote_to_file` — Companion Plan File in `docs/plans/`):** Leaves the original narrative brief untouched on disk and writes the normalized `## Context & Invariants` + `- [ ] [ID]` checklist to `vfs://<repo>/docs/plans/<date>-<slug>.md` (with `source_uri` frontmatter provenance), binding `chat_sessions.active_plan_path` to the new file.
   - Add a paragraph/numbered-item chunking fallback to `prioritize_document_sections` (`rag_proximity.py`) when a large document (`> 20 KB`) contains zero `#`/`##` Markdown headings.
3. **[ ] Composable RAG Capabilities (`context_assemble.py` / `rag_proximity.py`):**
   - `rag.seed_diffs`: Mounts user-attached diffs/files or dirty working-tree files (`git_status != ''`) at `lens: "diff"` (`format_interleaved_file_diff`).
   - `rag.scout_tests`: Scores test files in `sys.test_dirs` against modified files/symbols using `bridge.explicit_contracts`, `bridge.cross_lang_refs`, `bridge.ast_symbols`, `bridge.affinity`, and `bridge.stem_and_tags` via Reciprocal Rank Fusion (RRF), mounting the top 2–4 tests at `full`, fitness rules at `slice`, and remaining tests at `outline`.
4. **[ ] 3-Tier Patch-Ratified Hebbian Coupling (`affinity_edges`):**
   - Upgrade `record_affinity_interaction` to weight `same_tx` (`3.0`, 14d half-life), `adjacent_tx` (`2.0`, 10d half-life), and `same_session` (`1.0`, 7d half-life) from ratified `bridge.sync` commits, plus directed `Read(A) -> Patched(B)` conditioning edges (and `interaction_type="miss"` penalties when Hop 2 or `QUERY_CONTEXT` drops a co-suggested file).
