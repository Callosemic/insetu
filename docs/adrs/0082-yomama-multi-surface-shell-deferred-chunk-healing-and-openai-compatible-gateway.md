# ADR 0082: Yomama Multi-Surface Shell Architecture, Deferred Post-Valid Chunk Auto-Healing, OpenAI-Compatible Local Inference Gateway, and Commit Message Synthesis

## Status
Accepted (2026-10-27)

## Context
As the inSetu Developer OS deepened its local-first AI and code editing capabilities, several user experience and backend orchestration seams required consolidation:
1. **Fragmented Yomama Tool Surfaces**: Patch staging, chat interaction, and patch receipts were isolated into disjoint sub-navigation tabs, preventing developers from fluidly referencing past receipts or switching between conversation and raw patch validation.
2. **Anchor Collision on Multi-Chunk Edits**: When an LLM emitted multiple patch chunks for the same file where earlier chunks shifted line offsets or touched adjacent code, subsequent valid chunks failed search anchoring against the stale on-disk baseline.
3. **Local Inference Gateway Limitation**: The LLM gateway supported Anthropic, Gemini, and Claude CLI, but lacked a standardized HTTP streaming client for local, self-hosted OpenAI-compatible inference engines (such as Ollama, LM Studio, vLLM, or llama.cpp).
4. **Manual Commit Message Assembly**: Developers committing changes applied via the Yomama Sync Bridge had to re-read diffs manually to write commit messages, despite architectural intent comments (`<<<<<<< COMMENT`) already existing in the VFS ledger.

## Decision
1. **Yomama Multi-Surface Shell Architecture (`bridge.js`, `agent.js`)**:
   - Consolidated patch staging (`bridge`), conversation stream (`chat`), routines catalog (`routines`), and transaction receipts (`receipts`) into an integrated multi-surface shell (`.yomama-shell`).
   - Implemented responsive drawer navigation (`.yomama-drawer`) discovering `slots:yomama-surface` and `slots:yomama-drawer` widgets.
   - Synchronized active surface metadata dynamically with sub-navigation headers via `ExtensionRegistry.setDynamicLayoutSlots('bridge', ...)`.
2. **Deferred Chunk Post-Valid Buffer Re-Evaluation & Fast-Tier Auto-Healing (`bridge_vfs.py`, `engine_bridge.py`)**:
   - In `_process_sync_transaction`, when a multi-chunk patch encounters an anchor failure, the engine defers the failing chunk to the end of the patch list, applies preceding valid non-overlapping chunks to the in-memory buffer, and re-evaluates the deferred chunk against the post-valid buffer.
   - Built the auto-heal background retry loop (`_background_bridge_sync`): when `auto_heal=True` and patches fail, captures post-valid in-memory buffers and submits only failed chunks to the fast LLM tier (`tier="fast"`, `output_schema="yomama_patch"`) to re-anchor cleanly.
3. **OpenAI-Compatible Local Inference Gateway (`engine_llm.py`)**:
   - Added the `openai_compatible` provider supporting streaming inference from any endpoint exposing `/v1/chat/completions` (Ollama, LM Studio, vLLM, llama.cpp, OpenAI) via configurable `base_url`.
   - Added semantic cognitive tiers (`tier_fast_model`, `tier_thinking_model`, `tier_frontier_model`).
   - Implemented the Universal Output Schema Bouncer (`validate_output_schema`) supporting `yomama_patch`, `intent_classification`, `json`, and custom schemas with automated self-healing retry loops.
   - Added `POST llm/complete` and push-to-talk `POST llm/transcribe`.
4. **AST Refactoring Directives & Commit Message Synthesis (`bridge_ast.py`, `engine_bridge.py`)**:
   - Extended `parse_blocks` with `<<<<<<< RELOCATE` and `<<<<<<< RENAME` directives terminated by `>>>>>>> EXECUTE`.
   - Built `apply_ast_relocate_in_memory` (byte-exact symbol relocation) and `apply_ast_rename_to_content` (token-aware identifier renaming).
   - Added `GET bridge/commit_message` synthesizing Conventional Commit messages and `Transaction-ID:` trailers directly from `chunks_json` ledger comments.
   - Purged legacy stub `bridge_parser.py`.

## Consequences
* **Positive**: Fluid, unified developer experience across patch staging, conversational agent turns, and ledger receipts.
* **Positive**: Significant reduction in multi-chunk patch anchor failures through deferred post-valid buffer re-evaluation.
* **Positive**: Native, zero-config support for local and private LLM inference via Ollama, LM Studio, and vLLM.
* **Positive**: Zero-friction Git commit message generation capturing exact patch intent from the VFS ledger.
* **Negative**: AST token-level renaming requires tokenize generation passes over scoped codebases.