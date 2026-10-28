# ADR 0080: Model Context Protocol (MCP) Gateway, Declarative Agent Orchestration Routines, AST-Aware Refactoring Primitives, and Recovery Token Resilience

## Status
Accepted (2026-10-27)

## Context
As the inSetu Developer OS broadened its local-first intelligence and multi-agent collaboration capabilities, several architectural limitations emerged across external tool integration, agent execution loops, and structural refactoring:
1. **External Agent Tool Interoperability Ceiling**: External agent clients (such as Claude Desktop, Cursor, or CLI harnesses) interacting with inSetu workspaces lacked a standardized protocol interface. Collaborating tools were forced into executing raw host shell commands or arbitrary filesystem writes, bypassing the Yomama Sync Bridge's pre-flight syntax verification, OCC merge controls, and Cartographer topology updates.
2. **Monolithic Agent Loops & Memory Pressure**: The ReAct agent harness in `engine_agent.py` was hardcoded to a single linear conversation loop without support for declarative sub-routines (such as targeted code editing, implementation planning, or QA auditing). Furthermore, passing large context blocks or multi-file diff dumps in memory risked glibc arena fragmentation and token limit exhaustion without disk-backed scratch vaulting.
3. **Anchor Fragility in Concurrent Multi-Chunk Mutations**: When LLMs emitted multi-block patches modifying overlapping or adjacent lines within the same file, earlier replacements shifted line anchors, causing subsequent valid blocks to fail search anchoring. Additionally, operators lacked semantic, AST-aware primitives to relocate symbols or rename identifiers across repositories without string-matching collateral damage.
4. **Output Schema Hallucination & Transport Drift**: Models tasked with returning structured intent classifications or Yomama patch blocks occasionally leaked conversational text or markdown fences, triggering parsing failures on otherwise valid logic.
5. **Recovery Bootloader Handshake Desynchronization**: When operators initiated an inSetu OS reboot from the Lifeboat Recovery interface (`fallback_bridge.py`), browser storage tokens were purged without synchronously capturing the authenticated token from `/auth/bootstrap`, causing immediate HTTP 401 redirect loops upon primary daemon ignition.

## Decision
1. **Model Context Protocol (MCP 2025-03-26) Standard Server (`engine_mcp.py`, `cli.py`)**:
   - Implemented an MCP specification (protocol version `2025-03-26`) JSON-RPC 2.0 server supporting both HTTP transport (`POST /api/<workspace_id>/mcp`) and stdio transport (`insetu mcp` via `handle_mcp_stdio`).
   - Registered core tools: `cartographer.extract` for targeted symbol AST slicing, `fs.fetch` for raw source file access, and `bridge.sync` for transactional Yomama patch execution.
   - Registered resources: workspace source files, `CODE_INDEX.md`, and compiled RAG contexts.
   - Registered prompts: parameterized prompt templates with automatic `{{ macro_* }}` argument inference, type validation, and recursive macro expansion.
2. **Declarative Agent Orchestration Routines & Scratch Vaulting (`orchestrator.py`, `engine_agent.py`)**:
   - Implemented `execute_declarative_routine` loading declarative YAML execution DAGs (`workspace_turn`, `code`, `plan`, `ask`, `yomama`, `map_reduce_audit`, `symbol_refactor`).
   - Integrated safe expression evaluation (`evaluate_when_condition`) for conditional routing (`$global.mode == 'auto'`, `$global.effective_intent != 'CHAT_ONLY'`) with template parameter interpolation (`interpolate_template`).
   - Enforced automatic scratch vaulting for intermediate outputs $\ge 256\text{ KB}$ (`SCRATCH_VAULT_THRESHOLD_BYTES = 256 * 1024`), writing payloads to temporary files rather than holding large buffers in RAM.
   - Implemented unified slash command parsing (`_parse_slash_command`) mapping `/code`, `/plan`, `/ask`, `/yomama`, and `/undo`.
   - Enabled one-click transaction rollback via `agent.undo` calling `bridge.revert`, restoring disk files atomically to their pre-turn baseline.
3. **AST-Aware Structural Refactoring & Deferred Chunk Healing (`bridge_ast.py`, `cartographer.py`, `bridge_vfs.py`)**:
   - Implemented `bridge.ast_relocate` to slice and move classes, methods, or functions byte-for-byte across files while preserving decorators, comments, and JSDoc, recording transactional ledger snapshots for atomic reversibility.
   - Implemented `bridge.ast_rename` to rename identifiers across Python and JavaScript scopes while strictly ignoring string literals, comments, and substring collisions.
   - Enhanced `parse_blocks` with `<<<<<<< RELOCATE` and `<<<<<<< RENAME` directives with backward-compatible search/replace dict envelopes.
   - Enhanced `bridge.sync` with deferred chunk healing: when a multi-chunk patch contains an anchor failure or overlapping edit, the engine defers the failed chunk, applies valid chunks to the in-memory buffer, and re-evaluates the deferred chunk against the post-valid buffer using `tier='fast'`.
   - Implemented syntax-resilient Cartographer symbol extraction (`extract_file_symbols`), preserving cached symbol trees upon `SyntaxError` and rendering `# [comment required]` sentinels on undocumented public symbols.
4. **Multi-Tier Semantic LLM Gateway & Output Schema Bouncer (`engine_llm.py`)**:
   - Added semantic tier routing (`_resolve_tier_model`) mapping requests to `fast`, `standard`, `thinking`, or `frontier` models.
   - Built structural schema validation (`validate_output_schema`) and an automated self-healing retry loop in `llm.complete` for intent classifications and Yomama patch sandwiches.
5. **Lifeboat Recovery Bootloader Handshake & Reboot Hardening (`fallback_bridge.py`)**:
   - Updated `rebootOS()` in `fallback_bridge.py` to capture `data.token` from `/auth/bootstrap` and persist it into both `sessionStorage` and `localStorage` before redirecting to `/`.
   - Hardened `system_reboot()` by removing `.panic_lock`, clearing panic environment variables, and executing `os.execv` off-thread after a 0.6s grace period.
6. **Agent Architectural Fitness Enforcement (`rules_python.py`)**:
   - Codified `AGENT_LLM_GATEWAY_MANDATE` (banning direct HTTP/LLM client imports in agent modules in favor of `llm.complete`).
   - Codified `YOMAMA_PATCH_GATEWAY_MANDATE` (banning direct `ctx.vfs.save()` writes in agent modules in favor of transactional `bridge.sync`).

## Consequences
* **Positive**: Native, standardized interoperability with external agent environments via the official MCP 2025-03-26 protocol.
* **Positive**: Fluid, multi-mode agent interaction (`/code`, `/plan`, `/ask`, `/yomama`, `/undo`) driven by declarative YAML routine DAGs.
* **Positive**: Absolute memory safety during large context operations via automatic 256KB disk scratch vaulting.
* **Positive**: High-precision refactoring via AST symbol relocation and identifier renaming with 100% reversible ledger snapshots.
* **Positive**: Dramatic reduction in multi-chunk patch anchor failures through deferred post-valid buffer re-evaluation.
* **Positive**: Seamless transition from the Lifeboat Recovery OS back to the primary Developer OS with zero 401 authentication token drops.
* **Negative**: MCP server and AST refactoring utilities introduce runtime AST parsing requirements.