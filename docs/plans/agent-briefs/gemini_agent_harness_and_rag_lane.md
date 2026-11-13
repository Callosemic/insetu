# Parallel Lane Brief: Agent Harness, 6-Bucket RAG Funnel & Dogfooding Observability

**Created:** 2026-11-10  
**Companion Brief:** `vfs://insetu/docs/plans/agent-briefs/gemini_offline_bridge_followup.md` (executed via the clean dogfooding session)  
**Governing Models & Plans:**
- `vfs://insetu/docs/models/agent_orchestrator_and_rag.md`
- `vfs://insetu/docs/models/proximity_filters_and_domain_jumps.md`
- `vfs://insetu/docs/plans/2026-11-10-agent-loop-and-sandbox.md`
- `vfs://insetu/docs/plans/2026-11-03-six-bucket-orchestrator-and-composable-rag.md`
- `vfs://insetu/docs/plans/2026-11-02-decomposing-god-objects-across-the-triad.md` (Wave 3.2, 3.3, 3.5)

---

## 1. Purpose & Division of Labor (Zero File Collisions)

To dogfood Yomama Chat (`web_chat` handoffs, 2-hop scouting, `QUERY_CONTEXT` probes, and Staged Patch Stacks) on real production work without the dogfooded agent colliding with edits to its own runtime, work is partitioned into three non-overlapping lanes:

| Lane | Active Session | Owned Subsystems & Files | Strictly Hands-Off |
| :--- | :--- | :--- | :--- |
| **Lane A (This Brief)**<br>*Agent Harness, RAG & Observability* | Dedicated Agent Engineering Session | • `insetu/core/agent/*` (`orchestrator.py`, `routine_loader.py`, `expressions.py`, `envelope.py`, `engine_agent.py`, `agent.js`, `agent_store.js`, `agent_staged_stacks.js`, `routines/*.md`, `schemas/*`)<br>• `insetu/core/gather/context_assemble.py` & `rag_proximity.py`<br>• `insetu/core/llm/engine_llm.py` & `llm_telemetry.py`<br>• `tests/unit/test_agent_orchestrator_and_mcp.py` | • `insetu/app.py`, `api.js`, `sw.js`, `sw-core.js`, `offline.js`, `akasa/__init__.py` (Lane B §2.1–2.4)<br>• `insetu/core/bridge/engine_bridge.py` & `bridge_fuzzy.py` (Lane B §2.6)<br>• `insetu/core/mddb/*`, `extensions/tracker/*`, `notes/*`, `skills/*` (Lane B §4 P20)<br>• `insetu/core/git/*`, `extensions/git/*` (Lane B §5 Sprint 0)<br>• `attestations.py`, `protected_changes.py`, `directives.py`, `notices.py`, `three_way_merge` (Lane C — Claude) |
| **Lane B (`gemini_offline_bridge_followup.md`)**<br>*Dogfooding Stream* | Clean External LLM Session via Yomama Chat Handoff | • **§2.1–2.4:** T9 content-hashed `compute_build_id` (`app.py`), `api.js` 426 cleanup, `akasa` build-ID header/bootstrap, `sw-core.js` real fetch handler Node test<br>• **§2.6 (Bridge half):** `bridge_telemetry.py` (from `engine_bridge.py`) and `bridge_sandwich.py` (from `bridge_fuzzy.py`)<br>• **§4 (P20):** `core/mddb/` and Tracker streamlining Sprints 1–4<br>• **§5 (P18 Sprint 0):** `insetu/core/git/` and Bonsai extension rename | • `insetu/core/agent/*`<br>• `insetu/core/gather/context_assemble.py`<br>• `insetu/core/llm/*` |
| **Lane C**<br>*Security, Notices & Kernel Parity* | Claude | • **N1 System Notices** (`notices.py`, `ui_notices.js`)<br>• **Issue #18** (`three_way_merge` parity)<br>• **In-App Help** (`ctx://help/`) & **Update Sprint 0**<br>• **S5, S6, S7, S9** security & risk classes | — |

---

## 2. Sequenced Sprints in Lane A (Responsive to Live Dogfooding)

At any point, live issues discovered while dogfooding Lane B in Yomama Chat preempt the queue below. Between dogfooding observations, Lane A executes the following self-contained sprints:

### Sprint A1: Greenfield `RoutineEnvelope`, Server-Authoritative Checkpoints & Single-Seam Context Compilation
*(Aligns `2026-11-10-agent-loop-and-sandbox.md` Sprint 1, `2026-11-03-six-bucket-orchestrator-and-composable-rag.md` Sprint 2, and `2026-11-07-post-diff-audit-and-mvcc-concurrency.md` Wave 1.2.)*

**Done 2026-11-13**, unit and fitness tests green. The tests still owed are listed under "Tests you owe" below; write them before A2 item 1.

1. **`insetu/core/agent/envelope.py` & `context_assemble.py` (`RoutineEnvelope`, `ContextArtifact`, Multi-Scheme `project_resource_lens` & Day-0 Genesis Handling):**
   - Model every context item across the 6 buckets (`vfs://`, `ctx://`, `msg://`, `mddb://`, `tel://`) as a uniform `ContextArtifact(uri, bucket, lens, source, idle_turns, tokens)` projected through a single `project_resource_lens(ctx, uri, lens, **params)` dispatcher (`full`, `diff`, `slice`, `outline`, `genesis`).
   - **Day-0 / Genesis Target Preservation:** When a prompt, plan (`targets:`), or scout references a valid `vfs://<repo>/<path>` URI that does not exist in `topology_ledger` yet (or when running `/code` on an empty repository with 0 indexed source files), mount the URI with `lens="genesis"` (`[NEW FILE TO CREATE — GENESIS TARGET: vfs://<repo>/<path>]` alongside any existing sibling interfaces) rather than dropping it during `clamp_rag_files_to_topology`, and short-circuit `scout_targets` when `load_overview` has zero code files.
   - Partition `chain_context` into collision-free namespaces (`sys`, `inputs`, `nodes[node_id]`, `trace[node_id]`, `holding[branch_id]`) and ban reserved node IDs (`sys`, `global`, `inputs`, `nodes`, `loop`, `_ctx`) in `validate_routine_definition`.
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

**Tests you owe** (updated 2026-11-13). `test_dual_track_message_ledger_invariants` covers: a `seq` is never reused after a delete; deleting from the first cold block drops both blocks, resets the watermark and clears `compacted_into_id`; blocks rebuild from `chat_messages` alone. Still owed:
- `ingest_reply` with any `message_id` returns exactly 400 and writes nothing (the test accepts 400 or 409; 409 no longer exists); without one, the returned id is server-issued (`msg_` + 12 hex).
- `ingest_reply` with `role: "system"` returns 400; with an unknown `session_id` returns 404; neither writes a row or bumps `seq_counter`.
- A QUERY_CONTEXT directive naming a file outside the topology, by direct URI, `file_slice`, `symbol_def` or a fuzzy name, is refused by `resolve_query_context` and left out of `compile_query_quickpack`'s pack; a topology file is still served.
- Hashes through a real turn: run an assistant turn that commits a file, then read `context_hashes_json` from the stored assistant message and compare it with `bridge_ledger.post_patch_hash`. The test calls `capture_turn_context_hashes` directly, which does not show that a turn records them.
- Split `test_dual_track_message_ledger_invariants` into one test per rule, so one failure does not hide the rest.

**One code change with them:** the user-message write in `engine_agent.py` and the assistant-message write in `session_ledger.py` still use `insert_or_replace("chat_messages", ...)`. Their ids are server-issued, so nothing collides today, but write them with a plain `INSERT` like `ingest_reply`, so no path can replace a message.

**For lens contract Sprint 1, with item 1's dispatcher:**
- `msg://` is parsed in two places (`project_resource_lens` and `resolve_query_context`) with three accepted spellings (`msg://<id>`, `msg://<session_id>/<id>`, bare `msg_<id>`). Make one parser and one canonical form, `msg://<message_id>`, and keep the others as input aliases only.
- Projections return `{uri, lens, content, tokens}`. The contract's projection is `{uri, lens, served_lens, text, tokens, sha256, truncated}`.

### Sprint A2: God-Objects Wave 3.2 & 3.5 Cleanup + Session-Scoped Tier Telemetry (`llm_telemetry.py`, `expressions.py`)

**0. Re-cut the A1 split along its seams (first, before item 1).** A1 cut `envelope.py` (about 775 lines) and `routine_loader.py` (about 763) to fit just under the 800-line ceiling, so each holds several unrelated jobs. Split by what the code is for, never by the ceiling: each module answers one question, and no module ends the cut within about 5% of its ceiling. Pure moves: no behaviour change, tests change only their imports. Proposed homes (from the top-level definitions; check the bodies and import cycles before moving):
- `envelope.py` keeps the envelope: `ContextArtifact`, `RoutineEnvelope`, `_hash_projection`, `record_trace_step`.
- *(Done in A1 as `insetu/core/agent/session_ledger.py`.)* Everything that writes `chat_sessions` and `chat_messages` lives there. Still to move into it: `reconcile_working_set_ttl`, which is still in `envelope.py`.
- *(Done in A1: telemetry is in `llm_telemetry.py`.)*
- New `insetu/core/agent/commands.py`: `parse_colon_command_tokens`, `parse_slash_command`.
- `routine_loader.py` keeps the routine grammar: parse, serialize, validate, list, load, `resolve_routine_mode`, `compile_node_wavefronts`, the response path and `persist_routine_response`.
- Context selection moves to `insetu/core/gather/` (where A4's RAG units land): `_collect_workspace_file_extensions`, `_prioritize_document_sections`, `extract_doc_referenced_files`, `clamp_rag_files_to_topology`, `build_context_file_metrics`. Drop the second `MAX_RAG_FILES_PER_HOP`; `context_assemble.py` already defines it.
- `collect_live_files_for_patch_healing` moves to `insetu/core/bridge/`, beside the heal loop.
- `strip_yomama_blocks_keep_prose` moves from `expressions.py` to `insetu/core/bridge/`, beside the patch parser (one patch parser, pre-existing issue #23).
*(Fulfills the `agent` and `llm` portions of `gemini_offline_bridge_followup.md` §2.6 and `2026-11-02-decomposing-god-objects-across-the-triad.md` §1.2 Rule B.)*

1. **Extract `insetu/core/llm/llm_telemetry.py` from `engine_llm.py` (§2.6):**
   - Move `LLM_SCHEMA["llm_telemetry"]`, telemetry logging, and per-session/per-tier cost aggregation into `llm_telemetry.py` next to `llm_drivers.py` (bringing `engine_llm.py` below its 812-line ceiling).
   - Add `session_id` to `llm_telemetry` and record token estimates for manual `web_chat` handoffs on resume so HUD Section 2 (**Session Token & Cost Ledger**) reflects exact per-session, per-tier (`decision`, `fast`, `standard`, `thinking`, `frontier`) token and USD costs.
2. **Extract `insetu/core/agent/expressions.py`, Retire Duplicate `.yaml` Routines & Remove Legacy Shims (Wave 3.2 & Rule B):**
   - Move `_MUSTACHE_COND_RE`, `_normalize_condition_expr`, `evaluate_when_condition`, and `_vault_if_oversized` into `insetu/core/agent/expressions.py`.
   - Rewire `engine_mcp.py` and `test_agent_orchestrator_and_mcp.py` to import routine loader functions directly from `insetu.core.agent.routine_loader`, removing re-export shims from `orchestrator.py` and lowering `MODULE_LINE_RATCHET` ceilings in `tests/fitness/rules_python.py`.
   - **Retire Legacy `.yaml` Routine Shadow Files:** Delete the 5 duplicate `.yaml` files (`code.yaml`, `ask.yaml`, `plan.yaml`, `workspace_turn.yaml`, `yomama.yaml`) that shadow `.md` routines in `insetu/core/agent/routines/`, migrate `symbol_refactor.yaml` and `map_reduce_audit.yaml` to Markdown-as-Code (`.md`), and enforce `.md` as the single canonical routine format.

### Sprint A3: P19 Helper Modes (`deterministic` | `ai_assisted` | `custom`) & Quota Fallback
*(Fulfills `gemini_offline_bridge_followup.md` §3 inside the `agent` / `llm` modules without touching Lane B files.)*

1. **Single Server-Side Helper Resolver (`resolve_effective_helpers(ctx, profile_id)`):**
   - Replace scattered `helper_mode` checks in `orchestrator.py` and `engine_agent.py` with one server function returning `{mode, context_scout, history_compaction, routine_patch_repair, reason}`.
   - Default to `ai_assisted`; short-circuit automatically to `deterministic` when no API key/provider is configured for the Fast tier (surfacing `"Deterministic: no API key"` in Settings) or when a call hits a 429 quota/rate-limit error (falling back to deterministic for that turn with a notice instead of failing the turn).
   - Keep the Yomama Bridge page's repair mode (`BridgeStore.repairMode`) completely independent of `helper_mode`.
2. **Extract Helper-Mode Settings UI from `agent.js` (`agent_staged_stacks.js`):**
   - Render the `deterministic` | `ai_assisted` | `custom` (3 sub-selectors) control cleanly inside the extracted Agent UI component module, keeping `agent.js` well below its 1,085-line ceiling.

### Sprint A4: Composable RAG Units (`rag.seed_diffs`, `rag.scout_tests`, `rag.blast_radius`) & 3-Tier Hebbian Coupling
*(Implements `2026-11-03-six-bucket-orchestrator-and-composable-rag.md` Sprints 3 & 4 inside `insetu/core/gather/` and `insetu/core/agent/routines/`.)*

1. **Composable RAG Capabilities (`context_assemble.py` / `rag_proximity.py`):**
   - `rag.seed_diffs`: Mounts user-attached diffs/files or dirty working-tree files (`git_status != ''`) at `lens: "diff"` (`format_interleaved_file_diff`).
   - `rag.scout_tests`: Scores test files in `sys.test_dirs` against modified files/symbols using `bridge.explicit_contracts`, `bridge.cross_lang_refs`, `bridge.ast_symbols`, `bridge.affinity`, and `bridge.stem_and_tags` via Reciprocal Rank Fusion (RRF), mounting the top 2–4 tests at `full`, fitness rules at `slice`, and remaining tests at `outline`.
2. **3-Tier Patch-Ratified Hebbian Coupling (`affinity_edges`):**
   - Upgrade `record_affinity_interaction` to weight `same_tx` (`3.0`, 14d half-life), `adjacent_tx` (`2.0`, 10d half-life), and `same_session` (`1.0`, 7d half-life) from ratified `bridge.sync` commits, plus directed `Read(A) -> Patched(B)` conditioning edges.
