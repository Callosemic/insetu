# ADR 0095: Child Environment Confinement, Repository Landmarks Routine Integration, and MCP Optional Prompt Include Resolution

## Status
Accepted (2026-10-30)

## Context
As the inSetu Developer OS deepened its Tier 0 security guardrails and multi-repository declarative agent loops, several process isolation and context orchestration seams required definitive hardening:
1. **Child Process Environment Leaks (S3)**: Claude CLI inference streaming (`_stream_claude_cli`) instantiated child processes using `dict(os.environ)`, leaking `AKASA_BOOT_TOKEN` and internal panic tracebacks to the tool environment. Similarly, the bridge test diagnostic runner (`run_repo_test_diagnostics`) executed test commands without restricting environment variables, exposing host API keys and tokens to repository test code.
2. **Hardcoded Standards Walking in Agent Sessions**: When seeding constitution files into conversation context, `get_messages` in `engine_agent.py` performed manual `vfs.walk` traversals across `docs/standards` subdirectories. This ignored repository-tier configuration overrides, missed contract files, and failed to account for multi-repo workspace topologies.
3. **Routine Landmark Blindness**: Declarative agent routines lacked direct access to authoritative repository landmarks (such as standards files, contract definitions, ADR directories, and test suites) within `chain_context["sys"]`, forcing prompt authors to guess path structures or run manual file discovery nodes.
4. **MCP Prompt Optional Macro Inclusion Parity**: When rendering prompts over the Model Context Protocol (`_render_mcp_prompt`), the macro regex did not recognize optional include syntax (`{{include_prompt?: ...}}`), and `resolve_macro_includes` was called without `workspace_id`, causing prompts referencing optional extension templates to fail resolution when an extension was disabled.

## Decision
1. **S3 Child Environment Confinement (`engine_llm.py`, `bridge_test.py`)**:
   - In `_stream_claude_cli`, replaced `dict(os.environ)` with `child_env("tool")`. Strips daemon session tokens and internal panic tracebacks while preserving user developer credentials.
   - In `run_repo_test_diagnostics`, passed `env=child_env("repo_code", ctx.workspace_id, repo)` to `ctx.exec.run()`. Strips credential-like variables (`*_KEY`, `*_TOKEN`, `*_SECRET`) before spawning repository test runners.
2. **Dynamic Constitution Discovery & Routine Landmarks Integration (`engine_agent.py`, `orchestrator.py`)**:
   - In `engine_agent.py`, replaced ad-hoc directory walking with `discover_constitution_files(ctx)`, dynamically discovering engineering standards and contract files via `resolve_repo_landmarks()`.
   - In `orchestrator.py`, added `"topology.landmarks"` to `READ_ONLY_MODE_ALLOWED_CAPABILITIES`.
   - Resolved `primary_repo_name` and called `resolve_repo_landmarks(ctx, repo=...)` during routine execution, injecting landmark paths into `chain_context["sys"]` (`standards_files`, `contract_files`, `adr_dir`, `tracker_dir`, `test_dirs`, `fitness_dirs`, `repo_name`, `repo_title`, `repo_description`, and `directives`).
3. **MCP Server Optional Macro Include Resolution (`engine_mcp.py`)**:
   - Updated prompt macro regex in `_render_mcp_prompt` to `r'\{\{\s*include_prompt\??\s*:\s*([^\s{}]+)\s*(?:\{([\s\S]*?)\})?\s*\}\}'`.
   - Passed `workspace_id=ctx.workspace_id` to `resolve_macro_includes()`, ensuring optional prompt includes (`{{include_prompt?: ...}}`) evaluate extension enablement and collapse cleanly into empty strings when an extension is disabled.
4. **P5 Command Approval Route Documentation (`engine_bridge.py`)**:
   - Added explicit docstrings to `BridgeTestApprovePayload` and `bridge_approve_test_command` documenting human-only approval requirements.

## Consequences
* **Positive**: Absolute process environment isolation preventing token leakage to CLI tools and repository test runners.
* **Positive**: Dynamic, configuration-governed constitution and landmark discovery across all mounted repositories.
* **Positive**: Full prompt macro parity between internal runtime engines and external MCP clients.
* **Positive**: Clean failure-free expansion of optional prompt macros across varying extension configurations.
