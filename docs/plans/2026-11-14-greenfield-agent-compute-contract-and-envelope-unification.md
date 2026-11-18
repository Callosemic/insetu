---
tier: "epic"
title: "Plan: Greenfield Agent Compute Contract, Single-State RoutineEnvelope & Egress Unification"
description: "Eliminates organic accretion across orchestrator.py, envelope.py, engine_llm.py, engine_agent.py, rag_proximity.py, and agent.js by collapsing chain_context into RoutineEnvelope, elevating web_chat to a transport driver under a formal Two-Sided LLM Compute Contract, and unifying turn settlement."
status: "active"
repo: insetu
created_at: "2026-11-14"
models:
  - "vfs://insetu/docs/models/agent_orchestrator_and_rag.md"
  - "vfs://insetu/docs/models/yomama_bridge.md"
coordinates_with:
  - "2026-11-02-decomposing-god-objects-across-the-triad.md"
  - "2026-11-03-routine-expression-compiler-and-parser-unification.md"
  - "2026-11-03-six-bucket-orchestrator-and-composable-rag.md"
  - "2026-11-10-agent-loop-and-sandbox.md"
  - "2026-11-11-sarga-cognitive-vm-blueprint.md"
  - "2026-11-12-lens-contract.md"
tags: [plan, agent, orchestrator, envelope, llm, web-chat, greenfield, tech-debt, sarga]
---

# Plan: Greenfield Agent Compute Contract, Single-State `RoutineEnvelope` & Egress Unification

## 1. Architectural Context & Why This Plan Exists

Across Sprints A1–A2.5, dogfooding `/code` and multi-step plan execution exposed the true shape of the Agent Harness:
1. **Routines (`routines/*.md`) must be self-contained, inspectable units:** Node prompts live inline in `## <node_id>` sections, and iterative epistemic scouting is declared directly on the node (`until: "{{ nodes.scout_targets.status | 'ready' }} == 'ready'"`, `max_iterations: 3`) rather than hidden inside Python helpers.
2. **Interleaved `(scout_targets -> plan_tasks)` fast loop (`max_iterations: 3`) locks in file coverage and the initial plan; the thinking loop continuously evaluates and edits the plan via `TASK_MANAGE`:** Inside `scout_and_plan_loop` (`type: loop`, `max_iterations: 3`), `scout_targets` (`tier: fast`) gathers candidate files and unread docs (`inspect_files`, `global_files`, `requested_files`) and `plan_tasks` (`tier: fast`) synthesizes the step-pinned `tasks` list, triggering another `(scout -> plan)` cycle (`status: "need_context"`) whenever a requested item references an unread `.md` plan or lacks target files. Once `plan_tasks` converges (`status: "ready"`), `active_plan` is locked in and Turn 1's `data` bucket is scoped to `global_files` + `T1.targets` (`full` lens) + 1-hop blast-radius neighbors (`slice` lens). `generate_patch` (`tier: thinking`) refines the plan via `<<<<<<< TASK_MANAGE` if necessary and implements `[T1]`.
3. **`web_chat` is strictly a transport driver:** A human copy-pasting between `inSetu` and an external web chat window is acting as the network wire for a single paused `type: llm` node. Everything before that pause (Ingress) and the moment the text returns (Egress) must follow the exact same code path as an HTTP API call.

While our iterative patches made this workflow functional, the implementation across `orchestrator.py`, `envelope.py`, `engine_llm.py`, `engine_agent.py`, `session_ledger.py`, `rag_proximity.py`, and `agent.js` still carries **four geological seams** from how the code evolved:

1. **Dual State Containers (`RoutineEnvelope` vs. `chain_context`):** `orchestrator.py` maintains both `envelope: RoutineEnvelope` and a mutable `chain_context` dictionary (`sys`, `global`, `inputs`, `nodes`), copying file lists (`attached_files`, `read_only_files`, `all_context_files`), hashes (`web_chat_sent_hashes`), budget fields, and `active_plan` back and forth after every step.
2. **Split LLM Compute Boundary (`orchestrator.py` vs. `engine_llm.py`):** Instead of `engine_llm.py` owning `web_chat` as a transport driver behind a formal `LLMCallRequest -> LLMCallResponse` contract, `orchestrator.py` contains a 130-line pre-wavefront `if is_wc_node:` interceptor (`_build_handoff_branch`) and a separate `if pre_supplied_handoff is not None:` execution branch inside `_run_single_dag_node`.
3. **Orchestrator-to-RAG Coupling (`expand_scouted_working_set_targets`):** `orchestrator.py` intercepts `action in ("context.assemble", "gather.pack_selection")` and invokes `expand_scouted_working_set_targets` in `rag_proximity.py`, which reaches directly into `chain_context.get("scout_targets")` by hardcoded node name.
4. **Dual Turn Ingestion & Settlement Paths (`agent/prompt` vs. `agent/ingest_reply`):** Ad-hoc reply pasting (`api_ingest_reply` in `engine_agent.py` and `_ingestPastedPatchesAndProse` in `agent.js`) runs a parallel mini-pipeline beside `finalize_completed_turn_state` (`session_ledger.py`) and `_sendPrompt` (`agent.js`).

This plan refactors those four seams into their clean greenfield architecture—deleting ~450 lines of duplicate state-syncing and branching glue while fulfilling the shared-engine constraints required by `2026-11-10-agent-loop-and-sandbox.md` and `2026-11-11-sarga-cognitive-vm-blueprint.md`.

---

## 2. The Five Greenfield Pillars

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. RoutineEnvelope (Single Authoritative Run State — Zero chain_context)     │
│    • Owns 6 buckets (artifacts), active_plan, budget, sys, inputs, nodes,    │
│      holding, and trace. Exposes to_scope_dict() for Mustache/when/until.    │
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. Composable RAG & Lens Capabilities (rag_proximity.py & envelope.py)       │
│    • gather.ingest_inspect_files (epistemic loop helper)                     │
│    • gather.assemble_envelope (active_plan scoping + 1-hop blast radius +    │
│      Full & Same-Window Delta Quickpack compilation)                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. Two-Sided Formal LLM Compute Contract (insetu/core/llm/contract.py)       │
│    • Ingress: compile_llm_request(ctx, node, envelope) -> LLMCallRequest     │
│    • Transport (llm.complete): API/CLI drivers execute; web_chat driver      │
│      returns status="paused_for_handoff" or ratifies handoff_reply           │
│    • Egress: ingest_llm_response(ctx, node, envelope, raw_text)              │
│      (1. QUERY_CONTEXT probes -> 2. TASK_MANAGE reducer -> 3. Schema/Blocks) │
├──────────────────────────────────────────────────────────────────────────────┤
│ 4. Pure Wavefront Stepper (orchestrator.py — < 650 LOC)                      │
│    • step_wavefront(ctx, routine, envelope) -> RoutineEnvelope               │
│    • Zero `if is_web_chat:` branches, zero hardcoded `"scout_targets"` IDs   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 5. Unified Turn Settlement (session_ledger.py & AgentStore)                  │
│    • One TurnSettlementArtifact returned by all turn/paste completions       │
│    • One AgentStore.applyTurnSettlement(artifact) reducer on the frontend    │
└──────────────────────────────────────────────────────────────────────────────┘

```

### Pillar 1: Pure, Zero-I/O `RoutineEnvelope` Contract (`insetu/core/agent/envelope.py` — < 250 LOC)

Per `2026-11-10-agent-loop-and-sandbox.md` (*"Run state is data... neither `orchestrator.py` nor `envelope.py` imports a lens implementation directly"*), `2026-11-12-lens-contract.md` (P25), and `2026-11-02-decomposing-god-objects-across-the-triad.md` (§1.2 Rule B: *Zero Legacy Shims*), `RoutineEnvelope` is a **pure, zero-I/O state container** with zero imports from `insetu.core.gather.*` and zero `chain_context` shims:

```python
@dataclass
class ContextArtifact:
    uri: str
    bucket: BucketName = "data"
    lens: LensName = "full"
    served_lens: LensName = "full"
    source: str = "auto"
    idle_turns: int = 0
    tokens: int = 0
    sha256: str = ""
    symbols: List[str] = field(default_factory=list)

@dataclass
class RoutineEnvelope:
    # 1. Turn Identity, Polyglot Epistemic Mode & Scope Routing
    session_id: str = "default"
    routine_id: str = "workspace_turn"
    user_prompt: str = ""
    mode: str = "auto"
    epistemic_mode: Literal["explore", "plan", "edit", "verify", "audit", "explain"] = "edit"
    scope_mode: Literal["step", "plan", "turn", "dirty", "backlog"] = "step"
    active_domains: List[str] = field(default_factory=list)
    effective_intent: str = "EDIT_CODE"
    profile_id: str = "default"
    pinned_repos: List[str] = field(default_factory=list)
    context_nonce: str = ""
    has_raw_patches: bool = False

    # 2. 6-Bucket Working Set & Scout Buffers
    artifacts: Dict[str, ContextArtifact] = field(default_factory=dict)
    file_token_map: Dict[str, int] = field(default_factory=dict)
    attached_docs_content: str = ""
    recalled_messages_text: str = ""
    scouted_candidate_files: List[str] = field(default_factory=list)
    scouted_tasks: List[Dict[str, Any]] = field(default_factory=list)

    # 3. Active Plan & Task Directives (Bucket 3: meta)
    active_plan: Optional[Dict[str, Any]] = None
    active_plan_prompt_block: str = ""
    staged_task_actions: List[Dict[str, Any]] = field(default_factory=list)

    # 4. Transport Delta State & Two-Level Budget Watermarks
    web_chat_window_mode: Literal["same_window", "new_window"] = "same_window"
    sent_hashes: Dict[str, str] = field(default_factory=dict)
    staged_sent_hashes: Dict[str, str] = field(default_factory=dict)
    web_chat_delta_meta: Dict[str, Any] = field(default_factory=dict)
    budget_limit_usd: float = 1.0
    budget_step_usd: float = 1.0
    session_cost_usd: float = 0.0
    model_context_length: int = 200000
    context_soft_ceiling: int = 150000
    outline_budget: int = 10000

    # 5. DAG Execution Registers
    sys: Dict[str, Any] = field(default_factory=dict)
    inputs: Dict[str, Any] = field(default_factory=dict)
    nodes: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    loop: Dict[str, Any] = field(default_factory=dict)
    holding: Dict[str, Any] = field(default_factory=dict)
    execution_trace: List[Dict[str, Any]] = field(default_factory=list)
```

* **What Lives on `RoutineEnvelope` (`envelope.py`):**
  - Pure bucket/lens working-set algebra: `apply_working_set_delta`, `refresh_constitution`, `is_repo_allowed`, `snapshot_wavefront_uris`, `settle_wavefront_uris`, `partition_full_vs_delta_blocks`.
  - Pure computed views: `editable_files`, `readonly_files`, `constitution_files`, `all_context_files`, `has_code_targets`.
  - Pure DAG node & trace registers: `set_node`, `get_node`, `record_trace_step`.
  - Pure serialization & sub-routine composition: `to_checkpoint`, `from_checkpoint`, `fork_sub_routine`, `merge_sub_routine_result`, and `to_scope_dict()` (used strictly for in-flight Mustache `{{ ... }}` and `when:`/`until:` expression evaluation).
* **What Moves Out of `envelope.py` into `insetu/core/gather/context_assemble.py`:**
  - `pack_envelope_working_set(ctx, envelope, ordered_nodes, history_messages, target_nid="fetch_context")` (and `_compile_ephemeral_quickpack`).
  - `resolve_envelope_query_directives(ctx, envelope, directives)`.
  - `clamp_rag_files_to_topology(ctx, candidate_uris, allowed_repos=..., allow_genesis=...)` (called directly by `gather/` and `agent/`).
* **Complete Eradication of `"chain_context"` Across Backend & Frontend:**
  - `to_checkpoint()` and `from_checkpoint()` serialize and hydrate `RoutineEnvelope` fields directly at the top level of the checkpoint dict with **zero** nested `"chain_context"` dictionary.
  - `execute_declarative_routine` returns `"envelope": envelope` alongside top-level turn result fields; `session_ledger.py` (`persist_paused_turn_state` & `finalize_completed_turn_state`) reads `envelope: RoutineEnvelope = routine_result["envelope"]` directly.
  - `agent_store.js` and `agent.js` read top-level fields on `artifact` and `checkpoint` (`cp.status`, `cp.execution_trace`, `cp.user_prompt`, `art.attached_files`, `art.read_only_files`, `art.constitution_files`, `art.execution_trace`, `art.file_token_map`) with **zero** `.chain_context` references anywhere in JavaScript or Python.

### Pillar 2: Two-Sided Formal LLM Compute Contract (`insetu/core/llm/contract.py` & `engine_llm.py`)

Every `type: llm` node enters and exits through one formal contract:

1. **Ingress (`compile_llm_request(ctx, node, routine, envelope, history_messages) -> LLMCallRequest`):**
* Resolves the node's raw prompt section (`## <node_id>`) and performs structural `{{include_prompt:...}}` expansion without clobbering outer `{{ var | sys.* }}` fallbacks.
* Evaluates Mustache/pipe expressions against `envelope.to_scope_dict()`.
* Injects the foveated `active_plan` banner (`format_active_plan_meta_projection(envelope.active_plan)`) for non-scout nodes and attaches `output_schema` / Yomama Patch Protocol instructions (plus the 1-request `QUERY_CONTEXT` allowance note when unused).
* Binds the compiled Context Pack (`full_context_uri`, `delta_context_uri`, `delta_meta`, `total_tokens_estimated`) and scrubs outbound secrets (`scrub_outbound_secrets`).


2. **Transport Dispatch (`llm.complete` in `engine_llm.py`):**
* Accepts `handoff_reply: Optional[str] = None` alongside standard `LLMCallRequest` fields.
* When the resolved target driver is `web_chat`:
* If `handoff_reply` is `None`: returns `{"status": "paused_for_handoff", "handoff_branch": ...}` (including `build_web_chat_budget_warning`).
* If `handoff_reply` is provided: records imputed `thinking`-tier telemetry via `record_llm_call_telemetry`, runs `validate_output_schema` (when `output_schema` is set), and returns `{"status": "ok", "text": handoff_reply, "parsed": parsed_val, "provider": "web_chat"}`.


* When the resolved target driver is an API/CLI provider: checks Level 1 (`75%` context window) and Level 2 (`session_cost_usd >= budget_limit_usd`) gates, executes inference with schema-bouncer retries, and returns `{"status": "ok", "text": full_response, "parsed": parsed_val, ...}`.


3. **Egress (`ingest_llm_node_egress(ctx, node, envelope, raw_text, parsed_payload) -> NodeEgressResult`):**
* **Step 1 (`QUERY_CONTEXT` / `inspect_files`):** Checks for `<<<<<<< QUERY_CONTEXT` directives or unsatisfied `node.until` conditions with `inspect_files`. When present (and within hop limits), mutates `envelope` via `resolve_query_directives` / `ingest_scout_inspect_files`, re-packs working-set context, and returns `status="re_evaluate"`.
* **Step 2 (`TASK_MANAGE`):** Calls `extract_task_manage_directives(raw_text)` to strip `<<<<<<< TASK_MANAGE` blocks and store extracted task directives on `envelope.staged_task_actions`.
* **Step 3 (`requested_files` Working-Set Delta):** If `parsed_payload` contains `requested_files` / `drop_files`, clamps them to `topology_ledger` and applies them to `envelope.apply_working_set_delta`.
* **Step 4 (`prose` vs. `raw_patches`):** Separates conversational prose (`strip_yomama_blocks_keep_prose`) from Yomama patch blocks (`parse_blocks`).



### Pillar 3: Decoupled RAG Capabilities (`rag_proximity.py` & `context_assemble.py`)

* `orchestrator.py` no longer contains hardcoded `if action in ("context.assemble", ...): expand_scouted_working_set_targets(...)` hooks or hardcoded `"scout_targets"` node names.
* `gather.pack_selection` and `gather.context.assemble` both route through `envelope.pack_working_set_context(...)`, which:
1. Reads any `requested_files` deposited onto `envelope` by upstream scout nodes (regardless of what the scout node was named in YAML).
2. Resolves or scopes `envelope.active_plan` (scoping `editable_files` strictly to the active `PlanTask.targets` + `test_contract` when a multi-step plan is active).
3. Expands 1-hop `assemble_blast_radius` AST symbol & Hebbian affinity neighbors at `slice` lens (`requested_symbols`).
4. Refreshes Tier 0 `constitution_files` for active repositories and compiles both the `Full Context` and `Same-Window Delta` Quickpacks.



### Pillar 4: Unified Turn Settlement & Reversible Cognitive Snapshots (`session_ledger.py` & `agent_store.js`)

* **Pre-Turn & Post-Turn Cognitive Envelope Snapshots (`chat_messages.context_hashes_json["__envelope__"]`):**
  - On `POST agent/prompt` (`submit_prompt`), the user message row captures the pre-turn entry state (`mode`, `routine_id`, `scope`, `command_pill`, `prompt_clean`, `working_set`, `active_plan`, `sent_hashes`) before `scout_targets` mutates the session working set.
  - In `reconcile_working_set_ttl`, only files explicitly attached by the user (`user_pinned_uris`) are marked `user_pinned: True`; files discovered by `scout_targets` remain `user_pinned: False` so they age out via the 5-turn TTL and never contaminate a rewound turn.
  - On `POST agent/rewind` (`rewind_session_to_message`), truncating back to user message `#k` restores `working_set_json`, `active_plan_json`, `web_chat_state_json`, and the `/mode` composer trigger directly from `#k`'s pre-turn snapshot without touching physical files on disk.
* Both `finalize_completed_turn_state` (at the end of a routine turn) and `api_ingest_reply` (when pasting raw LLM output into Chat) produce the exact same **`TurnSettlementArtifact`** dictionary:
* `message_id`, `seq`, `content` (prose or synthesized receipt), `receipt`, `timestamp`
* `unapplied_patches` (cleaned of `TASK_MANAGE` and `QUERY_CONTEXT` blocks)
* `task_manage_actions` (remaining confirmation ops after auto-applying `add`/`set_active` via `process_turn_task_directives`)
* `active_plan` (updated `PlanDocument` dict)
* `quickpack` (when a standalone `QUERY_CONTEXT` block was compiled)
* `committed_files`, `transaction_id`, `execution_trace`, `file_token_map`


* Moreover, if `api_ingest_reply` is called while the session has a paused `pending_handoff` checkpoint, it delegates directly to resuming that checkpointed turn so pasting into the chat stream or the handoff box is 100% equivalent.
* On the frontend, `AgentStore` exposes a single `applyTurnSettlement(artifact, { clearBridgeFirst })` action called by both `_sendPrompt` and `_ingestPastedPatchesAndProse`.

---

## 3. Cross-Codebase Overlaps & Seam Resolution

1. **Resolution with `2026-11-12-lens-contract.md` (P25) & `2026-11-11-sarga-cognitive-vm-blueprint.md`:**
   - Moving `pack_envelope_working_set` and `resolve_envelope_query_directives` out of `envelope.py` into `insetu/core/gather/context_assemble.py` resolves the conflict where `envelope.py` previously imported `project_resource_lens`, `slice_code_index_for_blast_radius`, and `clamp_rag_files_to_topology` from `gather/`. `envelope.py` now has zero `gather` or VFS/SQLite I/O dependencies (`ENVELOPE_ZERO_GATHER_IO_BAN`).
   - `ContextArtifact` includes `served_lens` and `sha256`, and `RoutineEnvelope` includes `outline_budget`, satisfying `2026-11-12-lens-contract.md` Sprint 1 without a second refactor.
2. **Resolution with `2026-11-02-decomposing-god-objects-across-the-triad.md` (§1.2 Rule B — Pre-1.0 Purity):**
   - Rather than retaining `"chain_context"` shims on checkpoints, routine return dicts, `session_ledger.py`, `agent_store.js`, and `agent.js`, all callers across Python, JavaScript, and unit tests are rewired directly to `RoutineEnvelope` attributes and top-level artifact/checkpoint fields, enforced by `LEGACY_CHAIN_CONTEXT_BAN` in `rules_python.py` and `rules_javascript.py`.

3. **`tests/fitness/rules_python.py` (`MODULE_LINE_RATCHET` & `SCHEMA_MODULE_IO_BAN`):**
* Shrinking `orchestrator.py` (from ~1,355 lines down to ~700 lines by moving `compile_llm_request` / `ingest_llm_node_egress` into `insetu/core/agent/llm_contract.py` or `insetu/core/llm/`) requires lowering `MODULE_LINE_RATCHET["insetu/core/agent/orchestrator.py"]` in the **exact same commit** so the max-headroom ratchet (`ceiling - count > 25`) passes.
* New modules must stay under `MAX_UNLISTED_MODULE_LINES = 800` and have crisp module/function docstrings so Cartographer generates `CODE_INDEX.md` with zero `# [comment required]` placeholders.


4. **Parallel-Logic Parity (`tests/parity/`):**
* `hasYomamaPatchBlocks` in `agent_staged_stacks.js` and `_YOMAMA_BLOCK_STRIP_RE` / `parse_blocks` in `parser.py` must recognize the exact same set of Yomama block headers (`FILE:`, `SEARCH`, `TEXTEDIT`, `JSON_PATCH`, `RELOCATE`, `RENAME`, `MOVE_FILE`, `ARCHIVE_FILE`, `DELETE_FILE`, `TASK_MANAGE`, `QUERY_CONTEXT`, `CALL_CAPABILITY`).


5. **Lane Boundary Check (`gemini_agent_harness_and_rag_lane.md`):**
* All files touched by this plan (`insetu/core/agent/*`, `insetu/core/gather/*`, `insetu/core/llm/*`, `insetu/core/bridge/parser.py`, `tests/fitness/rules_python.py`, `tests/unit/test_agent_orchestrator_and_mcp.py`) are 100% owned by **Lane A**—zero overlap with Lane B (`app.py`, `api.js`, `sw-core.js`, `akasa/__init__.py`, `engine_bridge.py`, `bridge_fuzzy.py`, `mddb`, `tracker`) or Lane C (`notices.py`, `three_way_merge`).



---

## 4. Technical Debt Eradication Checklist ("What Gets Deleted")

Per `01_engineering_standards.md` (*"Migrations Remove What They Replace"*), this plan is only complete when every item below is deleted:

* [x] **Delete `chain_context` parallel working-set & budget keys in `orchestrator.py`:** Remove manual syncing of `chain_context["global"]["all_context_files"]`, `attached_files`, `read_only_files`, `constitution_files`, `file_token_map`, `web_chat_sent_hashes`, `web_chat_staged_hashes`, `web_chat_window_mode`, `web_chat_delta_meta`, `budget_limit_usd`, `budget_step_usd`, and `session_cost_usd` (all computed directly by `envelope.to_scope_dict()`).
* [x] **Delete duplicate Web-Chat handoff assembly in `orchestrator.py`:** Remove inline `_build_handoff_branch`, `_build_paused_for_user_response`, and the pre-wavefront `for n in active_wave_nodes: if is_wc_node:` loop from `orchestrator.py` (moved into `llm_contract.py`).
* [x] **Delete split `if pre_supplied_handoff is not None:` vs. `else:` probe/egress handling in `orchestrator.py`:** Unify into `execute_llm_dag_node(ctx, node, routine, routine_id, envelope, ...)`.
* [x] **Delete hardcoded `"scout_targets"` / `"load_overview"` node-name lookups in `rag_proximity.py`:** `expand_scouted_working_set_targets` reads scouted candidates and overview state from `envelope` rather than hardcoding node IDs.
* [x] **Delete duplicate post-turn store updates in `agent.js`:** Collapse `resumeJob.onComplete`, `runTurn.onComplete`, and `_ingestPastedPatchesAndProse` onto `AgentStore.getState().applyTurnSettlement(art)` and `EMPTY_SESSION_VIEW_STATE`.
* [ ] **Consolidate Remaining Module Boundary Seams (`context_assemble.py`, `routine_loader.py`, `plan_ledger.py`):**
  1. **`context_assemble.py` (`assemble_context_payload` $\rightarrow$ `pack_envelope_working_set`):** Route `assemble_context_payload` through a transient `RoutineEnvelope` and `pack_envelope_working_set` (updating the header assertions in `test_context_assemble`) so `context_assemble.py` maintains only one 6-bucket context compiler (coordinated with `2026-11-12-lens-contract.md` Sprint 1).
  2. ~~**`routine_loader.py`:** Move `ensure_plan_file_payload` into `plan_ledger.py` (unifying it with `promote_ephemeral_plan_to_file`) and move `resolve_test_command_payload` into `insetu/core/bridge/bridge_test.py` so `routine_loader.py` owns strictly routine `.md`/`.yaml` parsing, serialization, and validation.~~ *(Completed)*
  3. **`plan_ledger.py`:** Move `execute_bridge_sync_and_test_gate` out of `plan_ledger.py` into a `verify.stage` capability (decided 2026-11-17, per the agent plan's shared-engine constraint that domain work goes through capabilities), so `plan_ledger.py` owns strictly `active_plan` and `TASK_MANAGE` state transitions.
* [ ] **Retire remaining hanging inline prompt strings in Python (`No Stealth Directives` — coordinated with `2026-11-04-prompts-tree.md`):**
  1. `insetu/core/agent/llm_contract.py` (`DEFAULT_AGENT_SYSTEM_PROMPT`): Fold the fallback system identity into the shipped `ctx://settings/.templates/agent/agent.md` directive stack (`sys.directives`) so `llm_contract.py` carries zero hardcoded persona prose.
  2. `insetu/core/agent/plan_ledger.py` (`execute_bridge_sync_and_test_gate` test-heal prompt & system string, moving to the `verify.stage` capability in item 3 below): Move the `[TEST GATE FAILURE FEEDBACK]` repair prompt into a declarative `type: loop` test-repair routine node (`2026-11-10-agent-loop-and-sandbox.md` Sprint 3).
  3. `insetu/core/agent/session_ledger.py` (`compact_session_history` compactor prompt & `<session_summary>` recall note): Move the cold-history compactor instruction into a canonical prompt/routine unit under `ctx://prompts/.templates/agent/` (`2026-11-12-memory-and-conversation-ledger.md` Sprint 3).
  4. `insetu/core/agent/schemas/__init__.py` & `schemas/plan.py` (`get_schema_directive` & `format_active_plan_meta_projection`): Consolidate output schema directives and plan banners with the `ctx://prompts/` fragment registry.

---

## 5. Phased Execution Sprints

### Sprint 1: Single-State `RoutineEnvelope` & `to_scope_dict()` Projection (`envelope.py` & `rag_proximity.py`)

* [x] [S1.T1] Promote `active_plan`, `staged_task_actions`, `execution_trace`, `file_token_map`, `attached_docs_content`, `context_nonce`, `session_cost_usd`, `model_context_length`, `context_soft_ceiling`, `sys`, and `inputs` onto `RoutineEnvelope` in `insetu/core/agent/envelope.py`, and add `envelope.to_scope_dict()` returning the backwards-compatible `{"sys": ..., "inputs": ..., "nodes": ..., "loop": ..., "global": ...}` view so Mustache and `when:`/`until:` expressions evaluate directly against `envelope`. 
* [x] [S1.T2] Update `expand_scouted_working_set_targets` and `ingest_scout_inspect_files` in `insetu/core/gather/rag_proximity.py` to operate strictly on `envelope` (with zero hardcoded `"scout_targets"` or `"load_overview"` dictionary lookups). 

### Sprint 2: Formal Two-Sided LLM Compute Contract (`insetu/core/agent/llm_contract.py` & `orchestrator.py`)

* [x] [S2.T1] Create `insetu/core/agent/llm_contract.py` encapsulating:
1. `compile_llm_node_request(ctx, node, routine, envelope, history_messages, secret_values)` (4-stage prompt + context compilation, `active_plan` foveated banner injection, and `web_chat` handoff branch construction).
2. `ingest_llm_node_egress(ctx, node, routine, envelope, raw_text, parsed_payload, all_sister_repos)` (unified `until:` + `inspect_files` loop check, `<<<<<<< QUERY_CONTEXT` probe resolution, `<<<<<<< TASK_MANAGE` extraction, and `requested_files` working-set delta application across both API and `web_chat` transports). 


* [x] [S2.T2] Refactor `insetu/core/agent/orchestrator.py` to delegate all `type: llm` node preparation, `web_chat` handoff pausing, `until:` looping, and egress processing to `llm_contract.py`, and lower `MODULE_LINE_RATCHET["insetu/core/agent/orchestrator.py"]` in `tests/fitness/rules_python.py`. 

### Sprint 3: Unified Turn Settlement Across Backend & Frontend (`session_ledger.py`, `engine_agent.py`, `agent_store.js`, `agent.js`)

* [x] [S3.T1] Standardize `TurnSettlementArtifact` in `session_ledger.py` (`finalize_completed_turn_state`) and `engine_agent.py` (`api_ingest_reply`), and move `_applyTurnEgressToStores` into `AgentStore.applyTurnSettlement(artifact, options)` in `agent_store.js` so `agent.js` dispatches a single store action on turn completion or reply paste. 

### Sprint 4: Greenfield Verification & Fitness Gate (`test_agent_orchestrator_and_mcp.py` & `rules_python.py`)

* [x] [S4.T1] Add comprehensive unit and fitness tests proving:
1. **API vs. Web-Chat Transport Isomorphism:** Running `/code` on a multi-item request (`T1..T3`) over an automated API driver and over a manual `web_chat` handoff produces identical `active_plan` state (`T1` active, `T1.targets` pinned), identical `unapplied_patches` in `BridgeStore`, and identical `execution_trace` steps.
2. **Bounded `until:` Epistemic Scout Loop (API & Web-Chat):** When `scout_targets` returns `{"status": "need_context", "inspect_files": ["vfs://..."]}` on Iteration 1 and `{"status": "ready", "requested_files": [...], "drop_files": [...]}` on Iteration 2, inspected prose docs are mounted in `envelope`, dropped files are removed, and Hop-1 targets not in `drop_files` are preserved across both API and `web_chat` transports.
3. **Turn-1 Inline `TASK_MANAGE` + Step-1 Patch Execution & Commit Progression:** Emitting `<<<<<<< TASK_MANAGE` (`ADD: T1..T3`, `ACTIVE: T1`) + `T1` patches in one response initializes `active_plan` immediately, scopes `working_set_json` to `T1.targets`, binds `pending_commit_tx` on `record_transaction`, and advances to `T2` (rotating `working_set_json` to `T2.targets`) on completion.
4. **Static AST Fitness Guards (`rules_python.py`):**
* `SCHEMA_MODULE_IO_BAN`: Forbids `ctx.db.*`, `ctx.vfs.save/delete/move`, and `ctx.call(...)` inside `insetu/core/agent/schemas/*.py`.
* `ORCHESTRATOR_NODE_NAME_COUPLE_BAN`: Forbids hardcoding routine node IDs (`"scout_targets"`, `"load_overview"`) inside `insetu/core/gather/*.py`.

### Sprint 5: Pure Zero-I/O `RoutineEnvelope` & Complete `chain_context` Eradication

* [x] [S5.T1] **Extract Gather/Quickpack I/O Out of `envelope.py` into `context_assemble.py` (`ENVELOPE_ZERO_GATHER_IO_BAN`):**
  - Moved `_compile_ephemeral_quickpack`, `pack_working_set_context` ($\rightarrow$ `pack_envelope_working_set(ctx, envelope, ordered_nodes, history_messages, target_nid="fetch_context")`), and `resolve_query_directives` ($\rightarrow$ `resolve_envelope_query_directives(ctx, envelope, directives)`) from `insetu/core/agent/envelope.py` into `insetu/core/gather/context_assemble.py`.
  - Removed all `insetu.core.gather.*` imports from `envelope.py`, added `served_lens: LensName = "full"` and `sha256: str = ""` to `ContextArtifact` and `outline_budget: int = 10000` to `RoutineEnvelope` (per `2026-11-12-lens-contract.md`), and deleted `hydrate_from_legacy_chain_context` and the 7 `@property` shims from `RoutineEnvelope`.
* [x] [S5.T2] **Eradicate `"chain_context"` Across Backend, Frontend & Unit Tests:**
  - Updated `RoutineEnvelope.to_checkpoint()` and `from_checkpoint()` to serialize/deserialize only `RoutineEnvelope` fields (no `"chain_context"` key).
  - Updated `execute_declarative_routine` (`orchestrator.py`), `build_paused_for_user_response` (`llm_contract.py`), `persist_paused_turn_state` & `finalize_completed_turn_state` (`session_ledger.py`), and `_execute_agent_turn` (`engine_agent.py`) to pass and read `envelope: RoutineEnvelope` (`routine_result["envelope"]`) and top-level artifact fields (`attached_files`, `read_only_files`, `constitution_files`, `file_token_map`, `execution_trace`, `active_plan`, `user_prompt`) with zero `"chain_context"` keys.
  - Updated `agent_store.js` and `agent.js` to read top-level fields on `artifact` and `checkpoint` (`cp.status`, `cp.execution_trace`, `cp.user_prompt`, `art.attached_files`, `art.read_only_files`, `art.constitution_files`, `art.file_token_map`, `art.execution_trace`), removing all `.chain_context` references.
  - Updated `tests/unit/test_agent_orchestrator_and_mcp.py` to assert directly against `res["envelope"]` (`res["envelope"].nodes[...]`, `res["envelope"].execution_trace`, `res["envelope"].editable_files`) and hydrate resumed turns via `RoutineEnvelope.from_checkpoint(paused["checkpoint"])`.
* [x] [S5.T3] **Lock the Contract with Permanent Fitness Rules (`rules_python.py`):**
  - `ENVELOPE_ZERO_GATHER_IO_BAN` (`rules_python.py`): Forbids `insetu/core/agent/envelope.py` from calling `compile_context`, `save_manifest`, `sync_vfs_barrier`, or `call`.
  - `LEGACY_CHAIN_CONTEXT_BAN` (`rules_python.py`): Forbids `"chain_context"` and `"prior_chain_context"` dictionary keys across `insetu/core/agent/` and `insetu/core/gather/`.

### Sprint 6: Polyglot Step-State Reduction (`EpistemicMode` $\times$ `Scope` $\times$ `ActiveDomains`), `<<<<<<< ASK_USER` Decision Probes & Post-Plan Transitions

* [ ] [S6.T1] **Polyglot Step-State Reducer & Artifact-Driven Domain Craft Lenses (`envelope.py`, `schemas/plan.py`, `schemas/intent.py`, `llm_contract.py`, `routines/*.md`):**
  - Expand `PlanTask.kind` and `envelope.epistemic_mode` to the 6 universal domain-neutral modes (`explore | plan | edit | verify | audit | explain`) paired with `envelope.scope_mode` (`step | plan | turn | dirty | backlog`).
  - Add `resolve_active_domains(ctx, envelope)` inspecting the URI schemes and file types mounted in `Bucket 4: data` (`code`, `mddb`, `prose`) so `compile_llm_node_request` projects only the matching **Domain Craft Lens** into `Bucket 6: prompt` while stripping hardcoded code-only assumptions from `routines/code.md` (and aliasing `/do` and `/edit` alongside `/code`).
* [ ] [S6.T2] **Scope-Aware Context & Sensor Assembly (`context_assemble.py`, `rag_proximity.py`, `plan_ledger.py`, `agent_handoff_and_plan.js`):**
  - When `active_plan` has `unchecked_count == 0` (`active_task_id is None`) or when `:plan` scope is requested, automatically widen `envelope.scope_mode` from `"step"` (which only held final step `TN`'s targets) to `"plan"` (or `"backlog"` for *"what's next?"* prompts):
    - **`scope_mode == "plan"` (`audit` / `explain` / `verify`):** Collects all `transaction_id`s recorded across `T1..TN` (`bridge.turn_diff`) and mounts the **Cumulative Plan Diff (`lens: "diff"`)** + modified files across all steps + the governing brief (`global_files`), and runs domain-appropriate deterministic sensors (`bridge.test` / `fitness_functions` for `code`, `ctx.mddb.audit_upkeep` for `mddb`, link/citation checks for `prose`) into `Bucket 5: telemetry`.
    - **`scope_mode == "backlog"` (*"what's next?"*):** Projects a 1-turn `[COMPLETED PLAN RECEIPT]` in `Bucket 3: meta`, inspects remaining unchecked items in `global_files` (`docs/plans/*.md`) and open Tracker/notice items, and presents concrete next-horizon options via `<<<<<<< ASK_USER`.
  - Render 1-click completion pills (`[🔍 Review & Audit Work]`, `[📖 Explain Changes]`, `[🧭 What's Next?]`) in `<insetu-agent-plan-stepper>` when a plan reaches `doneCount === tasks.length`.
* [ ] [S6.T3] **`<<<<<<< ASK_USER` Human Decision Probe & Non-Blocking Fast-Tier Clarifications (`schemas/__init__.py`, `llm_contract.py`, `agent_handoff_and_plan.js`, `agent.js`):**
  - Add `extract_ask_user_directives(raw_text)` in `insetu/core/agent/schemas/__init__.py` parsing `ID`, `TYPE` (`boolean | single_choice | multi_choice | short_text`), `QUESTION`, `OPTIONS`, and `DEFAULT`, plus non-blocking `clarifications` on `plan_tasks` JSON output (rendered as 1-click scope pills in `<insetu-agent-plan-stepper>` without halting `scout_and_plan_loop`).
  - When a thinking-tier node emits `<<<<<<< ASK_USER` (up to 1 hop per node), pause with `status: "paused_for_user"` + `pending_questions`, render `<insetu-agent-decision-card>` in Chat (with clickable option pills, toggles, and automatic `"Other (specify)..."` fallback inputs), and inject `=== USER DECISION RESPONSES ===` into `envelope.recalled_messages_text` (and the Same-Window Delta Quickpack and the clipboard reply snippet for `web_chat`) on resume.




