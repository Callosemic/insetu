# ADR 0090: Decoupled LLM Target Resolution, Reentrant Routine Handoff Propagation, and Raw Transcript History Preservation

## Status
Accepted (2026-10-29)

## Context
As the inSetu Developer OS deepened multi-tiered cognitive profiles and autonomous agent execution loops, several architectural boundaries required structural consolidation:
1. **Cross-Module Private Import Bleed**: `orchestrator.py` previously imported `_resolve_tier_execution_target as _resolve_llm_target` directly from `insetu.core.llm.engine_llm`. This violated the `CROSS_MODULE_PRIVATE_IMPORT_BAN` standard and coupled routine orchestration to internal LLM gateway helper implementations.
2. **Sub-Routine Web-Chat Handoff Interruption**: When a root routine (e.g., `workspace_turn`) delegated execution to a modular sub-routine via `type: routine`, and that sub-routine paused for manual Web-Chat input (`status: "paused_for_user"`), the parent routine dropped the handoff envelope and failed to bubble the pause state up to the session supervisor.
3. **Conversational vs. Model Context Desynchronization**: While ADR 0089 introduced conversational prose splitting to strip raw Yomama patch envelopes from human chat transcripts, storing only the stripped prose in `chat_messages` caused subsequent conversational turns to lose model context regarding what patches or code structures were previously proposed.
4. **Intermediate Sub-Routine Output Mangling**: Applying prose/patch splitting inside nested sub-routines caused intermediate nodes to return truncated text to parent aggregators rather than raw model outputs.

## Decision
1. **Decoupled LLM Target Resolution Capability (`engine_llm.py`)**:
   - Implemented `@llm_bp.route('resolve_target', methods=['GET', 'POST'])` accepting `LlmResolveTargetPayload` (`tier`, `profile_id`).
   - Returns normalized target execution metadata (`endpoint_id`, `provider`, `model`, `is_web_chat`, `is_decision_model`, `has_api_key`) without exposing plaintext API keys.
   - Refactored `orchestrator.py` to invoke `ctx.call("llm.resolve_target", tier=..., profile_id=...)`, completely purging cross-module private imports.
2. **Reentrant Routine Handoff Propagation (`orchestrator.py`)**:
   - Enhanced `type: routine` node execution to capture `sub_res.get("status") == "paused_for_user"` and store it in `chain_context[nid]`.
   - The wavefront evaluator propagates the nested handoff payload immediately to the session orchestrator, allowing multi-tier nested routines to pause for external Web-Chat interaction seamlessly.
3. **Dual-Representation Chat Transcript Persistence (`engine_agent.py`)**:
   - Extended `AGENT_SCHEMA["chat_messages"]` with a `raw_content TEXT` column.
   - Stored the unstripped model output (`raw_response`) in `raw_content` and stripped conversational text in `content`.
   - Updated `_execute_agent_turn` to rehydrate message history preferring `raw_content`, ensuring downstream turns retain complete context while the UI renders clean prose and commit receipts.
4. **Root-Boundary Reply Splitting (`orchestrator.py`)**:
   - Guarded `strip_yomama_blocks_keep_prose()` with `if _depth == 0:`, ensuring intermediate sub-routine outputs remain raw and un-truncated for parent DAG aggregators.

## Consequences
* **Positive**: Absolute adherence to `CROSS_MODULE_PRIVATE_IMPORT_BAN` via public capability dispatch.
* **Positive**: Fluid reentrant Web-Chat handoffs across arbitrarily nested declarative routine DAGs.
* **Positive**: Perfect conversational UI presentation without sacrificing model context across multi-turn sessions.
* **Positive**: Mathematical integrity for intermediate sub-routine DAG data exchanges.
