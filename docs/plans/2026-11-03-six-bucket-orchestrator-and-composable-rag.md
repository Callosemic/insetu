---
title: "Plan: 6-Bucket Routine Orchestrator, Representational Lenses & Federated RAG"
description: "Refactor orchestrator.py, engine_agent.py, and context_assemble.py to implement the 6-bucket envelope, 4 resource lenses, composable RAG units (including rag.scout_tests), 3-tier patch-ratified Hebbian decay, and cross-repo federation."
status: "active"
created: "2026-11-03"
models:
  - "vfs://insetu/docs/models/agent_orchestrator_and_rag.md"
  - "vfs://insetu/docs/models/yomama_bridge.md"
---

# Plan: 6-Bucket Routine Orchestrator, Representational Lenses & Federated RAG

> **Related direction (2026-11-04):** prompts as the LLM compute units of routines, deterministic units beside them, and alternate deterministic and LLM routes for one node (`2026-11-04-prompts-tree.md`). Sprints 2 and 3 should express nodes and RAG units in those terms.

## Roadmap placement (2026-11-07)

- **Sprint 1 is done** (reviewed 2026-11-07).
- **After 1.0:** Sprints 2 to 6, in the experimental lane beside the agent loop.
- **Order constraints:**
    - S6.T2 (`git.commit` and `git.push` as routine capabilities, `/yolo`) only after S5's risk classes, with commit and push classed `exec`.
    - S6.T3 after S7 (terminal hardening).
    - S6.T4 after S5, built on `fetch_url`.
    - S6.T1 joins the post-diff plan's 4.4 conflict staging rather than adding a second mechanism.
- **Test paths:** the `test_contract` comments name `tests/test_*.py`; the suites live in `tests/unit/`.


## Context & Problem Statement
This plan implements the mental model codified in `vfs://insetu/docs/models/agent_orchestrator_and_rag.md`. It resolves the original `/wrap` context explosion (where wrapping a sub-bucket diff pulled all 42 test files in `tests/` across 6 handoff chunks), retires ghost `ctx://workflows/` background pre-compilation left over from the decommissioned `flow` extension, removes the 80-line truncation of `CODE_INDEX.md`, and unifies single- and cross-repo (`insetu`, `sutram`, `akasa`) retrieval around 6 volatility-ordered buckets and 4 representational lenses.

---

## Sprint 1: Retire Ghost Workflow Pre-Compilation & Verify Full `hierarchy` Index
Eliminate background `ctx://workflows/workflow_*_context.txt` compilation on file saves and ensure fast scouts see untruncated repository symbol maps.

- [x] [S1.T1] Remove `_register_agent_workflow_compilation_step`, `_background_compile_routine_workflows`, and the `ctx://workflows` cache volume from `engine_agent.py` and `engine_gather.py`, plus the `ctx://workflows/...` path resolution in `utils_core.py` (and clean up the legacy cache folder); treat routine frontmatter `includes:` strictly as initial context resolved when the routine runs. <!-- targets: vfs://insetu/insetu/core/agent/engine_agent.py, vfs://insetu/insetu/core/gather/engine_gather.py, vfs://insetu/insetu/core/utils_core.py, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py -->
- [x] [S1.T2] Verify that the `[:80]` line truncation of `CODE_INDEX.md` in `api_topology_overview` (`engine_topology.py`) is already removed in 0.34.0 (`idx_full`); defer federated cross-repo symbol maps to Sprint 4 (`S4.T2`). <!-- targets: vfs://insetu/insetu/core/topology/engine_topology.py, test_contract: vfs://insetu/tests/unit/test_repo_landmarks.py -->

---

## Sprint 2: The 6-Bucket `RoutineEnvelope`, Working-Set Deltas, Blast-Radius `CODE_INDEX` Subsets & Observability HUD
> **Coordinated with `2026-11-10-agent-loop-and-sandbox.md` (Sprint 1) & `2026-11-07-post-diff-audit-and-mvcc-concurrency.md` (Wave 1.2):** `RoutineEnvelope` (`insetu/core/agent/envelope.py`), server-authoritative `Run` checkpoints, single-seam context compilation (`gather.context.assemble` replacing `gather.pack_selection` in `orchestrator.py`), and the Two-Part Context Budget HUD / Execution Trace (`agent_staged_stacks.js`) share one implementation across Agent Loop Sprint 1 and Six-Bucket Sprint 2.

Refactor `orchestrator.py`, `context_assemble.py`, and `agent.js` around the 6 volatility-ordered buckets (`governance`, `hierarchy`, `meta`, `data`, `telemetry`, `prompt`), dynamic per-node working sets, and full DAG/cost observability.

- [ ] [S2.T1] Implement `RoutineEnvelope` and `ContextArtifact(uri, bucket, lens, source, idle_turns, tokens)` in `insetu/core/agent/envelope.py` with `apply_working_set_delta` (`add`, `slice`, `outline`, `diff`, `drop`) so:
  - All context inputs across the 6 buckets (`vfs://`, `ctx://`, `msg://`, `mddb://`, `tel://`) are tracked as `ContextArtifact` entries with uniform lens promotion/demotion and real token weights,
  - Hop 1 (`scout_targets`) scouts candidate files and plan/brief docs from `CODE_INDEX.md`,
  - Hop 2 (`scout_targets:hop2`) reads newly discovered docs, adds target implementation/test files, and explicitly **drops** tentative Hop-1 guesses (`source: "scout_hop1"`) and irrelevant repositories while protecting `source: "user_pinned"`,
  - Fork-join wavefronts (`1->N`, `map_over`) include branch-added artifacts during the wavefront and evict non-promoted artifacts once the wavefront settles. <!-- targets: vfs://insetu/insetu/core/agent/envelope.py, vfs://insetu/insetu/core/agent/orchestrator.py, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py -->
- [ ] [S2.T2] Implement the multi-scheme `project_resource_lens(ctx, uri, lens, **params)` dispatcher, **Genesis Target Projection (`lens: "genesis"`)**, and **Blast-Radius `CODE_INDEX.md` Subtree Slicing (`outline` lens)** in `context_assemble.py`:
  - **`vfs://` & `ctx://`:** `full` (raw content), `diff` (`format_interleaved_file_diff` across `head..live`, `live..virtual`, `head..virtual`), `slice` (`provider.slice_interface`), `outline` (`slice_code_index_for_blast_radius` neighborhood subtree—never dumping a full 200 KB `CODE_INDEX.md` into thinking-tier packs), and **`genesis`** (for net-new `vfs://<repo>/<path>` targets declared in a plan, prompt, or scout when the file or repository does not exist on disk yet—emitting an explicit `[NEW FILE TO CREATE — GENESIS TARGET: <uri>]` header plus any existing parent-directory sibling interfaces so routines handle empty/Day-0 repos and new-module creation without dropping uncreated targets during `clamp_rag_files_to_topology`).
  - **Empty-Repo / Day-0 Routine Hardening (`orchestrator.py` & `code.md`):** When `topology.overview` reports zero indexed code files in the target repository, skip the `scout_targets` LLM hop automatically and inject the repository's canonical `vfs://<repo>/` root coordinate and Genesis Patch (`<<<<<<< COMMENT` -> `CODE_INDEX.md`) instructions directly into `data`.
  - **`msg://`:** `full` (verbatim message `content` or `raw_content`), `diff` (`bridge.turn_diff` for the turn's `transaction_id`), `slice` (1-line `receipt` with `[msg_<id>]`), and `outline` (watermarked cold summary block from `compacted_view_json`).
  - **`mddb://` & `tel://`:** `full`, `slice`, and `outline` projections for database records and test/bridge diagnostics, with uniform `<<<<<<< QUERY_CONTEXT` lens promotion across all schemes. <!-- targets: vfs://insetu/insetu/core/gather/context_assemble.py, vfs://insetu/insetu/core/bridge/engine_bridge.py, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py -->
- [ ] [S2.T3] Ensure JIT compute materialization serializes Buckets 1–5 in strict volatility order into the ephemeral Context artifact (`turn_*_context.txt`) and Bucket 6 into the Prompt artifact with 100% parity between API drivers and `web_chat` handoff. <!-- targets: vfs://insetu/insetu/core/agent/orchestrator.py, vfs://insetu/insetu/core/agent/engine_agent.py, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py -->
- [ ] [S2.T4] Upgrade the **Context Budget HUD** and **Collapsible Node Execution Trace ("Thinking")** in `agent.js` & `engine_agent.py`:
  - **HUD Section 1 (Live Working Context):** Exact live representation of the files and lenses entering the active/next node with real file/slice token counts (derived from actual byte/slice sizes rather than a static 1,500-token fallback), updating dynamically as nodes and wavefronts add or drop files.
  - **HUD Section 2 (Session Token & Cost Ledger):** Per-tier (`decision`, `fast`, `standard`, `thinking`, `frontier`) token in/out counts across the conversation and estimated USD cost joined from `llm_telemetry` and `model_catalog.json`.
  - **Collapsible "Thinking" Execution Trace:** Per-turn collapsible drawer in Chat showing each node in the DAG, what has run, what is currently running, working-set delta summaries (`+N added, -M dropped`), and nested child rows for parallel wavefronts or `map_over` fan-outs. <!-- targets: vfs://insetu/insetu/core/agent/agent.js, vfs://insetu/insetu/core/agent/engine_agent.py, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py -->

---

## Sprint 3: Composable RAG Execution Units (`rag.seed_diffs`, `rag.scout_tests`, `rag.blast_radius`) & Universal `/wrap`
Build the deterministic (and optional hybrid fast-LLM) RAG capabilities and collapse hardcoded wrap routines into a universal diff-driven routine.

- [ ] [S3.T1] Implement `rag.seed_diffs` and declarative `requires:` fallback resolution so routines automatically mount user-attached diffs/files at `lens: "diff"` or default to modified files (`git_status != ''`) in the target repo/sub-bucket (or across federated workspace repos). <!-- targets: vfs://insetu/insetu/core/agent/context_assemble.py, vfs://insetu/insetu/core/agent/engine_agent.py, test_contract: vfs://insetu/tests/test_context_assemble.py -->
- [ ] [S3.T2] Implement `rag.scout_tests` to inspect modified files and AST symbols in `data`, score `sys.test_dirs` by AST imports, symbol references, stem match, and Hebbian affinity, and mount the top 2–4 matching unit tests at `lens: "full"`, `sys.fitness_dirs` at `lens: "slice"`, and remaining tests at `lens: "outline"`. <!-- targets: vfs://insetu/insetu/core/agent/context_assemble.py, vfs://insetu/insetu/core/topology/engine_topology.py, test_contract: vfs://insetu/tests/test_context_assemble.py -->
- [ ] [S3.T3] Upgrade `close_session.md` (`/wrap` / `/closeout`) and `test.md` (`/test`) to use `rag.seed_diffs` and `rag.scout_tests`, eliminating the 42-test-file context bloat. <!-- targets: vfs://insetu/insetu/core/agent/routines/close_session.md, vfs://insetu/insetu/core/agent/routines/test.md, test_contract: vfs://insetu/tests/test_agent_orchestrator.py -->

---

## Sprint 4: 3-Tier Patch-Ratified Hebbian Coupling, Static Citations & Cross-Repo Bridges
Replace noisy UI pin/chat Hebbian weights and the 19-hour decay rate with 7–14 day patch-ratified co-occurrence, asymmetric `Read -> Write` conditioning, and cross-repo bridge linkers.

- [ ] [S4.T1] Refactor `affinity_edges` in `context_assemble.py` and `bridge_vfs.py` to record 3-tier patch coupling from `bridge_ledger` (`same_tx` weight 3.0 / 14d half-life, `adjacent_tx` weight 2.0 / 10d half-life, `same_session` weight 1.0 / 7d half-life) and directed `context_to_patch` (`Read(A) -> Patched(B)`) conditioning edges upon `bridge.sync` commit, including zero-config bootstrap from existing `bridge_ledger` rows. <!-- targets: vfs://insetu/insetu/core/agent/context_assemble.py, vfs://insetu/insetu/core/bridge/bridge_vfs.py, test_contract: vfs://insetu/tests/test_context_assemble.py -->
- [ ] [S4.T2] Add zero-decay `citation_edges` extraction for `docs/models/*.md`, ADRs, and contracts, plus cross-repo symbol linkers connecting `sutram` custom elements (`<sutram-*>`), `akasa` exports, and `insetu` `@route` capability calls across `vfs://<repo>/` boundaries. <!-- targets: vfs://insetu/insetu/core/topology/engine_topology.py, vfs://insetu/insetu/core/agent/context_assemble.py, test_contract: vfs://insetu/tests/test_context_assemble.py -->

---

## Sprint 5: In-Node `CALL_CAPABILITY` / `QUERY_CONTEXT` Probes, Session Ledger & Loop Circuit Breakers
Finalize in-node scoped capability execution (`max_probes: 2`), sticky vs. one-shot session receipts, and Markovian loop guardrails.

- [ ] [S5.T1] Upgrade `orchestrator.py` in-node probe handling (`QUERY_CONTEXT` and `CALL_CAPABILITY` with `max_probes: 2`) to validate against per-node `capabilities:` whitelists and `ROUTINE_BANNED_CAPABILITIES`, project OpenAPI schemas via `typeddict_to_openapi`, and promote/mount outputs directly into `data`, `hierarchy`, or `telemetry` in-place (with full `web_chat` handoff parity). <!-- targets: vfs://insetu/insetu/core/agent/orchestrator.py, vfs://insetu/insetu/core/agent/parser_directives.py, test_contract: vfs://insetu/tests/test_agent_orchestrator.py -->
- [ ] [S5.T2] Implement the Dual-Track Session Transcript (`chat_messages` with `seq`, `receipt`, `transaction_id`, `compacted_into_id` + watermarked `chat_sessions.compacted_view_json` + `msg://<message_id>` recall via `QUERY_CONTEXT`), `use_history` / `sticky` routine contracts (so one-shot routines like `/test` and `/wrap` ignore chat chatter but write structured `files_patched` receipts back to `chat_sessions`), and `meta.loop_ledger` + stagnation/oscillation circuit breakers on `type: loop` nodes. <!-- targets: vfs://insetu/insetu/core/agent/orchestrator.py, vfs://insetu/insetu/core/agent/engine_agent.py, vfs://insetu/insetu/core/gather/context_assemble.py, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py -->

---

## Sprint 6: Collision Guards, No-Intervention Git Sinks, Terminal Telemetry & Web-Fetch Security Spike
Close the remaining operational gaps identified against Aider and OpenCode while preserving `inSetu`'s security invariants.

- [ ] [S6.T1] Implement out-of-band edit collision detection (`snapshot_sha256`) between `data` bucket assembly and `bridge.sync` commit so mid-turn manual edits in CodeMirror/IDE are 3-way rebased or held in `VIRTUAL` (`diff:live..virtual`) rather than overwritten. <!-- targets: vfs://insetu/insetu/core/bridge/bridge_vfs.py, vfs://insetu/insetu/core/agent/orchestrator.py, test_contract: vfs://insetu/tests/test_bridge.py -->
- [ ] [S6.T2] Preserve first-class `/yolo` mode (sticky autonomous loop and `:yolo` routine modifier), expose `git.commit` and `git.push` as DAG `exec` capabilities for milestone routines, and add declarative `intervention: yolo | none | on_failure | review` routine policies for zero-touch execution when all `telemetry` gates pass. <!-- targets: vfs://insetu/insetu/extensions/git/engine_git.py, vfs://insetu/insetu/core/agent/orchestrator.py, vfs://insetu/insetu/core/agent/engine_agent.py, test_contract: vfs://insetu/tests/test_agent_orchestrator.py -->
- [ ] [S6.T3] Add `stdout`/`stderr` buffer export from the `terminal` extension (and human-triggered command execution) into `ctx://telemetry/terminal_last.txt` so active routines and chat turns can mount terminal output in the `telemetry` bucket without exposing `dev.exec` to autonomous LLM invocation. <!-- targets: vfs://insetu/insetu/extensions/terminal/engine_terminal.py, vfs://insetu/insetu/core/agent/context_assemble.py, test_contract: vfs://insetu/tests/test_context_assemble.py -->
- [ ] [S6.T4] Draft security architecture and threat model for an optional `web.fetch` capability (SSRF private-network blocking, domain allowlisting, HTML-to-Markdown sanitization, and prompt-injection quarantine in `data`). <!-- targets: vfs://insetu/docs/models/agent_orchestrator_and_rag.md, test_contract: vfs://insetu/tests/test_fitness.py -->
