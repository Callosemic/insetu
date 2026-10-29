# ADR 0083: Universal Compute Endpoint Pools, Cognitive Configuration Profiles, Markdown-as-Code Agent Routines, and Yomama Patch Protocol v4 Directives

## Status
Accepted (2026-10-28)

## Context
As the inSetu Developer OS deepened its local-first AI orchestration and multi-agent collaborative workflows, several architectural and protocol seams required structural consolidation:
1. **Single-Provider LLM Coupling & VRAM Inelasticity**: The LLM Gateway was historically constrained to a single provider and model configuration per workspace. Switching between cloud providers (Anthropic, Gemini), private inference endpoints (Ollama, LM Studio, vLLM), and local CLI binaries required manual settings re-configuration. Furthermore, concurrent requests lacked semaphore admission control, allowing parallel agent wavefronts to overwhelm local GPU queues.
2. **Hardcoded Routines & Python Monoliths**: Agent routines were previously coupled to Python dictionaries (`_BUILTIN_ROUTINES`), preventing operators from reading, authoring, or overriding routines as sovereign files on disk. Routines lacked support for topological DAG wavefronts, parallel fan-out (`map_over`, `repeat`), bounded convergence loops (`type: loop`), and colon-scoped command routing (`/routine:scope:stage`).
3. **Web-Chat LLM Handoff Gap**: When operators worked without API keys or preferred interacting via external web-chat models, the system lacked a structured handoff protocol to stage compiled contexts, pause execution, and accept external answers.
4. **Patch Directives & Transport Formatting Fractures**: The Yomama Bridge lacked first-class directives for single-line text edits (`TEXTEDIT`), structured frontmatter/JSON mutations (`JSON_PATCH`), and file lifecycle events (`MOVE_FILE`, `ARCHIVE_FILE`, `DELETE_FILE`). Furthermore, patch blocks containing literal code fences or chevrons broke outer parsing without transport escaping.
5. **Genesis Overwrite & Deletion Safety**: Genesis patches targeting existing files risked accidental overwrites without operator confirmation, and deleting files lacked forward-replay snapshots for `/undo` rollback.

## Decision
1. **Universal Compute Endpoint Pool & Cognitive Configuration Profiles (`engine_llm.py`)**:
   - Redesigned LLM settings into a daemon-level Compute Endpoint Pool (`compute_endpoints`) supporting `anthropic`, `gemini`, `openrouter`, `decisions`, `openai_compatible`, and `claude_cli`.
   - Introduced Cognitive Configuration Profiles (`llm_profiles`), mapping semantic cognitive tiers (`decision`, `fast`, `standard`, `thinking`, `frontier`) to `<endpoint_id>::<model_name>` targets.
   - Built admission control semaphores (`_get_provider_semaphore`) enforcing parallel request caps per endpoint (with `claude_cli` clamped to 1 and local endpoints clamped to 2).
   - Added TypeSafe Jev / Drex / System-One decision model execution (`_run_decisions_inference` and `POST llm/decide`) with automated fallback to the fast tier.
   - Implemented multi-source model catalog harvesting (`_harvest_external_model_catalog`) pulling pricing and context limits from OpenRouter, Models.dev, LiteLLM, and local Ollama instances, cached at `.insetu/cache/llm/model_catalog.json` and exposed via unauthenticated public CORS endpoint `/api/system/llm_catalog.json`.
2. **Markdown-as-Code Agent Routines & Wavefront DAG Orchestration (`engine_agent.py`, `orchestrator.py`, `agent.js`, `routines/*.md`)**:
   - Converted declarative routines from hardcoded/YAML definitions into sovereign Markdown-as-Code (`.md`) files in `ctx://routines/` (workspace scope) and `ctx://routines/.templates/user/` (global user template scope) featuring YAML frontmatter and `## <node_id>` markdown sections.
   - Enforced the 3-Tier Same-Name Override Cascade (Workspace Override > Global User Template > Built-in Module Template) with zero hardcoded routine dicts in Python.
   - Built Ring 0 DAG topological wavefront compilation (`_compile_node_wavefronts`), parallel wavefront execution via `ctx.jobs.map_parallel`, parallel fan-out (`map_over` across arrays and `repeat` K-way ensembles), and bounded iterative convergence loops (`type: loop`).
   - Built colon-scoped slash command grammar (`_parse_colon_command_tokens`): `/routine:scope`, `/routine:scope:stage`, `/user:routine:scope`.
   - Implemented Web-Chat Handoff (`transport: manual` or `web_chat`) compiling pending LLM branches into a multi-branch review card with Copy Context and Copy Prompt buttons, allowing operators to paste chatbot responses directly into the chat composer to resume execution.
   - Added `agent.ensure_plan_file` (managing canonical plan files for `/plan`), `agent.resolve_test_command` (auto-detecting pytest, npm, cargo, go), and `agent.run_test` (executing tests with `shell=False`, failure slicing up to 35 items, and cryptographic approval in `host.json`).
   - Bound routine reports via `_persist_routine_response` strictly to document extensions (`.md`, `.txt`, `.json`, `.yaml`), preventing code modifications from bypassing `bridge.sync`.
   - Added `InSetuAgentRoutineProjection` (`<insetu-agent-routine-projection>`) for interactive visual and raw editing, topology mapping, candidate auto-repair (`Fix → Candidate`), and `<insetu-schema-repeater>` node definition.
3. **Yomama Patch Protocol v4 & Bridge Hardening (`bridge_vfs.py`, `bridge_fuzzy.py`, `engine_bridge.py`, `bridge.js`)**:
   - Introduced `<<<<<<< TEXTEDIT` directive with inline `{{-delete}}` and `{{+insert}}` markers for soft-wrap-resilient prose and comment edits.
   - Introduced `<<<<<<< JSON_PATCH` directive supporting dotted selector key-paths (`nodes[id=foo].tier`) and RFC 6902 JSON patch ops on `.json`, `.yaml`/`.yml`, and YAML frontmatter.
   - Introduced file lifecycle directives: `<<<<<<< MOVE_FILE`, `<<<<<<< ARCHIVE_FILE`, and `<<<<<<< DELETE_FILE` (with automatic snapshot capture in `bridge_ledger` for forward-replay and `/undo` rollback).
   - Introduced transport macro escaping: `{{ymm:<char>x<N>}}` (`````, `<<<<<<<`, `=======`, `>>>>>>>`) for literal code fences and chevrons in patch blocks.
   - Implemented the Semantic Gatekeeper:
     - `DESTRUCTIVE_DELETE`: confirms permanent deletion during unattended/dry-run modes.
     - `OVERWRITE_EXISTING`: confirms genesis patch overwrite when target file already exists on disk (resolving `API-TODO-20260706_1603`).
     - `EXPANSION_RISK`: confirms replacement when target already contains replacement text.
     - `SYNTAX_ERROR`: permits explicit syntax ignore overrides.
   - Implemented deferred chunk fast-tier auto-healing in `_background_bridge_sync`: applies valid non-overlapping chunks in memory first, then sends the post-valid buffer and failed chunks to the fast LLM tier to re-anchor.
   - Added `POST bridge/merge_blocks` and `GET/POST bridge/turn_diff`.
   - Built unified forward-replay engine `_replay_ledger_chunks_in_memory` handling all block types during atomic `bridge.revert`.
4. **MCP Tool Integration (`engine_mcp.py`)**:
   - Exposes routines with `mcp_expose: true` as `routine.<id>` tools in `tools/list` and executes them via `tools/call`.
   - Uses Ring 0 `extract_template_variables` and `interpolate_template_variables`.

## Consequences
* **Positive**: Complete freedom to combine cloud and local compute endpoints with semantic profile switching.
* **Positive**: Absolute memory safety and VRAM protection through admission control semaphores.
* **Positive**: Sovereign, Git-friendly Markdown-as-Code routine authoring with wavefront parallelization.
* **Positive**: Resilient, expressive Yomama v4 patching with inline diffs, JSON selector mutations, and transport escaping.
* **Positive**: 100% reversible file deletions and genesis overwrite gatekeeper protection.
* **Negative**: Routines declaring parallel fan-outs consume concurrent worker threads and LLM admission semaphore tokens.
