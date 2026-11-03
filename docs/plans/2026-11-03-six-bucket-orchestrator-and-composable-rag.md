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

## Context & Problem Statement
This plan implements the mental model codified in `vfs://insetu/docs/models/agent_orchestrator_and_rag.md`. It resolves the original `/wrap` context explosion (where wrapping a sub-bucket diff pulled all 42 test files in `tests/` across 6 handoff chunks), retires ghost `ctx://workflows/` background pre-compilation left over from the decommissioned `flow` extension, removes the 80-line truncation of `CODE_INDEX.md`, and unifies single- and cross-repo (`insetu`, `sutram`, `akasa`) retrieval around 6 volatility-ordered buckets and 4 representational lenses.

---

## Sprint 1: Retire Ghost Workflow Pre-Compilation & Fix `hierarchy` Truncation
Eliminate background `ctx://workflows/workflow_*_context.txt` compilation on file saves and ensure fast scouts see untruncated repository symbol maps.

- [ ] [S1.T1] Remove `_register_agent_workflow_compilation_step`, `_background_compile_routine_workflows`, and the `ctx://workflows` cache volume from `engine_agent.py` and `engine_gather.py`; treat routine frontmatter `includes:` strictly as initial envelope seeds on invocation. <!-- targets: vfs://insetu/insetu/core/agent/engine_agent.py, vfs://insetu/insetu/core/gather/engine_gather.py, test_contract: vfs://insetu/tests/test_agent_orchestrator.py -->
- [ ] [S1.T2] Remove the `[:80]` line truncation of `CODE_INDEX.md` in `api_topology_overview` (`engine_topology.py`) and include federated public symbol maps across co-mounted workspace repositories (`insetu`, `sutram`, `akasa`). <!-- targets: vfs://insetu/insetu/core/topology/engine_topology.py, test_contract: vfs://insetu/tests/test_topology.py -->

---

## Sprint 2: The 6-Bucket `RoutineEnvelope` & 4 Representational Lenses (`full`, `diff`, `slice`, `outline`)
Refactor `orchestrator.py` and `context_assemble.py` around the 6 volatility-ordered buckets (`governance`, `hierarchy`, `meta`, `data`, `telemetry`, `prompt`) and polymorphic `vfs://` resource projection.

- [ ] [S2.T1] Implement `RoutineEnvelope` in `orchestrator.py` with the 6 canonical buckets (`governance`, `hierarchy`, `meta`, `data`, `telemetry`, `prompt`), fork-join `holding` buffer isolation for `1->N` and `map_over` wavefronts, and declarative node `reads`/`writes` bucket projection. <!-- targets: vfs://insetu/insetu/core/agent/orchestrator.py, test_contract: vfs://insetu/tests/test_agent_orchestrator.py -->
- [ ] [S2.T2] Implement unified resource lens projection (`project_resource_lens(uri, lens, params)`) in `context_assemble.py` supporting `full`, `slice`, `outline`, and the 3-state `diff` triangle (`head..live`, `live..virtual`, `head..virtual`), plus in-place lens promotion (`outline -> slice -> diff -> full`). <!-- targets: vfs://insetu/insetu/core/agent/context_assemble.py, vfs://insetu/insetu/core/bridge/engine_bridge.py, test_contract: vfs://insetu/tests/test_context_assemble.py -->
- [ ] [S2.T3] Ensure JIT compute materialization serializes Buckets 1–5 in strict volatility order into the ephemeral Context artifact (`turn_*_context.txt`) and Bucket 6 into the Prompt artifact with 100% parity between API drivers and `web_chat` handoff. <!-- targets: vfs://insetu/insetu/core/agent/orchestrator.py, vfs://insetu/insetu/core/agent/engine_agent.py, test_contract: vfs://insetu/tests/test_agent_orchestrator.py -->

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
- [ ] [S5.T2] Implement `use_history` / `sticky` routine contracts (so one-shot routines like `/test` and `/wrap` ignore chat chatter but write structured `files_patched` receipts back to `chat_sessions`) and add `meta.loop_ledger` + stagnation/oscillation circuit breakers to `type: loop` nodes. <!-- targets: vfs://insetu/insetu/core/agent/orchestrator.py, vfs://insetu/insetu/core/agent/engine_agent.py, test_contract: vfs://insetu/tests/test_agent_orchestrator.py -->

---

## Sprint 6: Collision Guards, No-Intervention Git Sinks, Terminal Telemetry & Web-Fetch Security Spike
Close the remaining operational gaps identified against Aider and OpenCode while preserving `inSetu`'s security invariants.

- [ ] [S6.T1] Implement out-of-band edit collision detection (`snapshot_sha256`) between `data` bucket assembly and `bridge.sync` commit so mid-turn manual edits in CodeMirror/IDE are 3-way rebased or held in `VIRTUAL` (`diff:live..virtual`) rather than overwritten. <!-- targets: vfs://insetu/insetu/core/bridge/bridge_vfs.py, vfs://insetu/insetu/core/agent/orchestrator.py, test_contract: vfs://insetu/tests/test_bridge.py -->
- [ ] [S6.T2] Preserve first-class `/yolo` mode (sticky autonomous loop and `:yolo` routine modifier), expose `git.commit` and `git.push` as DAG `exec` capabilities for milestone routines, and add declarative `intervention: yolo | none | on_failure | review` routine policies for zero-touch execution when all `telemetry` gates pass. <!-- targets: vfs://insetu/insetu/extensions/git/engine_git.py, vfs://insetu/insetu/core/agent/orchestrator.py, vfs://insetu/insetu/core/agent/engine_agent.py, test_contract: vfs://insetu/tests/test_agent_orchestrator.py -->
- [ ] [S6.T3] Add `stdout`/`stderr` buffer export from the `terminal` extension (and human-triggered command execution) into `ctx://telemetry/terminal_last.txt` so active routines and chat turns can mount terminal output in the `telemetry` bucket without exposing `dev.exec` to autonomous LLM invocation. <!-- targets: vfs://insetu/insetu/extensions/terminal/engine_terminal.py, vfs://insetu/insetu/core/agent/context_assemble.py, test_contract: vfs://insetu/tests/test_context_assemble.py -->
- [ ] [S6.T4] Draft security architecture and threat model for an optional `web.fetch` capability (SSRF private-network blocking, domain allowlisting, HTML-to-Markdown sanitization, and prompt-injection quarantine in `data`). <!-- targets: vfs://insetu/docs/models/agent_orchestrator_and_rag.md, test_contract: vfs://insetu/tests/test_fitness.py -->
