# ADR 0094: Formal Response Schema Registry, Post-Commit Test Diagnostics Gate, Adaptive Working-Set Compaction, and Context Budget HUD

## Status
Accepted (2026-10-30)

## Context
Following the stabilization of app server exposure leases and command approvals (ADR 0093), several autonomous agent execution and multi-turn collaborative seams required structural consolidation:
1. **Unstructured LLM Output Drift & Parsing Hallucinations**: While ADR 0082 and ADR 0083 introduced output schema bouncers, schema validators and prompt directives were implemented via ad-hoc regex routines scattered across `engine_llm.py` and `orchestrator.py`. Collaborating models lacked formal zero-dependency contracts for hierarchical plans (`insetu_plan`), macro file scouting (`macro_scout`), AST interface slicing (`context_slice`), and test diagnostics (`test_diagnostic`).
2. **Post-Commit Test Gate Noise & Command Self-Approval Vulnerability**: When agent turns generated code modifications, verifying changes required either manual terminal test runs or passing raw stdout/stderr dumps into LLM context. Passing thousands of lines of verbose test logs overwhelmed token limits. Furthermore, test execution commands lacked cryptographic human-only authorization, risking agents approving their own custom shell invocations (violating P5).
3. **Session Token Ledger & Working-Set Clutter**: Across extended multi-turn chat sessions, active working sets accumulated files without decay. Files edited early in a session remained pinned as full source texts in RAG contexts, consuming thousands of unnecessary tokens on subsequent unrelated turns. Additionally, conversation histories grew monotonically, causing context overflows without systematic rolling compaction.
4. **Unbounded Agent Loops & Execution Budget Starvation**: Declarative agent routines lacked deterministic token and step execution ceilings. A rogue iterative convergence loop (`type: loop`) or fan-out wavefront could consume unbounded API tokens or thread capacity without saving a resumable checkpoint.
5. **Context Budget Blindness**: Operators lacked real-time visibility into working-set token costs, constitution file overhead, and AST slicing savings before dispatching prompts.

## Decision
1. **Formal Response Schema Registry Substrate (`insetu/core/agent/schemas/`)**:
   - Implemented `insetu.core.agent.schemas` providing zero-dependency formal contracts, prompt directive generators, and strict output validators.
   - Centralized contracts: `intent_classification`, `yomama_patch`, `conversational_with_patches` (with bounded `extract_query_context_directives`), `debt_ratchet_verdict`, `ask_response_or_need_files`, `macro_scout`, `context_slice`, `insetu_plan`, and `test_diagnostic`.
   - Built the zero-dependency Hierarchical Plan Protocol (`schemas/plan.py`) supporting Epic -> Sprint -> Task checklists with mandatory target candidate files and test contracts (`test_contract:`, `targets:`).
   - Built Stage 1 & 2 RAG response contracts (`schemas/rag.py`) for candidate file scouting (`MacroScoutSchema`) and AST interface slicing (`ContextSliceSchema`).
   - Built unified test diagnostics contracts (`schemas/diagnostics.py`) with `TestDiagnosticSchema`, `TestFailureItem`, `parse_junit_xml` (noise-free failure extraction), and `parse_test_tail_output`.
   - Refactored `validate_output_schema` in `engine_llm.py` to delegate validation and repair directly to `insetu.core.agent.schemas.validate_schema_response`.
2. **Post-Syntax Test Diagnostic Runner & Human Approval Gate (P5) (`engine_bridge.py`, `bridge_test.py`)**:
   - Extracted `run_repo_test_diagnostics` into `bridge_test.py`, running repo tests off-thread, generating ephemeral JUnit XML reports (`--junitxml` / `--junit-path`), and falling back to exit-code tail parsing.
   - Exposed `@bridge_bp.route('test')` returning unified `TestDiagnosticSchema` payloads.
   - Enforced Human-Only Approvals (P5) via `is_test_command_approved` and exposed `@bridge_bp.route('test/approve', mcp_expose=False)` for human authorization.
   - Removed self-approval flags (`approve`) from `AgentRunTestPayload` and `BridgeTestPayload`.
   - Refactored `api_agent_run_test` in `engine_agent.py` to route through the centralized diagnostic runner.
3. **MCP 2025-03-26 Tool Exposure Boundary Isolation (`engine_mcp.py`)**:
   - Updated `_build_mcp_tools_list` to omit capabilities where `mcp_expose` is `False`.
   - Hardened `handle_mcp_jsonrpc` to reject `tools/call` invocations on hidden capabilities with JSON-RPC error code `-32601` (Method not found).
4. **Two-Stage Rolling History Compaction & Adaptive Working-Set Decay (`engine_agent.py`, `orchestrator.py`)**:
   - Added `AGENT_SETTINGS_SCHEMA` managing `rag_strategy`, `compaction_strategy`, `run_tests_on_code`, and `strict_test_enforcement`.
   - Expanded `chat_sessions` schema with `summary`, `working_set_json`, `token_ledger_json`, `active_plan_path`, and `checkpoint_json`. Added `turn_index` to `chat_messages`.
   - Implemented `_compact_session_history`: maintains a 4-message hot verbatim window (prose only), turns N-2 through N-5 as warm micro-receipts, and turns older than N-5 folded into `<session_summary>`.
   - Implemented 5-turn working set TTL decay: inactive pinned targets transition to reference slices after 5 idle turns and evict after 8 idle turns, while user-pinned files are protected.
   - Reinforced global Hebbian affinity graphs on multi-file turns via `record_affinity_interaction`.
   - Integrated session token ledger tracking (`prompt_tokens`, `completion_tokens`, `saved_by_slicing`).
5. **Routine Execution Budget Checkpoints & Symbolic Query Context (`orchestrator.py`)**:
   - Enforced `DEFAULT_STEP_BUDGET = 25` and `DEFAULT_TOKEN_BUDGET = 120000`, pausing routines with `status: "paused_for_budget"` and saving resumable checkpoints.
   - Added single-hop symbolic read directives (`<<<<<<< QUERY_CONTEXT ... >>>>>>> EXECUTE`), expanding bounded symbol slices via `resolve_query_context`.
   - Enforced post-commit test gates in `bridge.sync` when `run_tests_on_code` or `strict_test_enforcement` is enabled, self-healing up to 2 passes or executing atomic rollback via `bridge.revert`.
   - Hardened `validate_routine_definition` with `_response_path_error` to enforce document-only response paths.
   - Added comparison operators (`>`, `>=`, `<`, `<=`, `contains`) to AST evaluator `evaluate_when_condition`.
6. **S8 Guarded Write Hardening (`bridge_vfs.py`)**:
   - Hardened `_is_banned_bridge_target` to inspect both relative normalized paths and raw URI strings for `cli.py` and `fallback_bridge.py`, blocking agent-originated writes against recovery and CLI files regardless of ingress format.
7. **Chat Composer Architecture & Real-Time Context Budget HUD (`agent.js`)**:
   - Added top-right Context Budget HUD (`.hud-floating-trigger`, `.hud-top-drawer`) visualizing estimated token consumption (~XXk / 12,000 tok ceiling) and file count badges with promotion, demotion, and dismissal gestures.
   - Redesigned bottom input panel with embedded `/<command>` pill, auto-sizing borderless textarea, upward searchable command popover, and responsive 2-column action bar.
   - Added active plan banner with direct navigation to the plan note.
   - Added checkpoint resume card for budget pauses (`paused_for_budget`).

## Consequences
* **Positive**: Absolute output structure reliability across agent routines via centralized schema bouncers.
* **Positive**: Zero test log noise in LLM context via structured JUnit XML failure extraction.
* **Positive**: Mathematical security for test and preview execution via P5 human-only cryptographic approval gating.
* **Positive**: Flat token consumption curves across extended chat sessions via 5-turn working-set decay and rolling compaction.
* **Positive**: Complete protection against unbounded execution costs through deterministic budget checkpoints.
* **Positive**: Intuitive, high-density developer experience via the Context Budget HUD and redesigned composer shell.
