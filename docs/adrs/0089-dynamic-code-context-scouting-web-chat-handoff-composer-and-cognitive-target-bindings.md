# ADR 0089: Dynamic /code Context Scouting, Interactive Web-Chat Handoff Composer, Yomama Patch Splitting, and Cognitive Profile Target Bindings

## Status
Accepted (2026-10-29)

## Context
As the inSetu Developer OS broadened autonomous agent execution and multi-provider cognitive routing, several user experience and backend orchestration seams required consolidation:
1. **Manual File Attachment Friction in `/code`**: Prior to this update, `/code` required developers to attach target files manually. If invoked with no attachments, the routine lacked automated topology scouting, forcing developers to look up file paths or manually drag cards into the composer.
2. **Web-Chat Handoff UI Fragmentation**: When using external web chatbots (`transport: manual` or `driver: web_chat`), handoff prompts were rendered as passive assistant bubbles within the chat scroll, while the input composer remained in standard chat mode. Resuming the handoff required pasting responses and triggered redundant synthetic user messages in conversation history.
3. **Conversational Prose vs. Raw Patch Pollution**: When routines generated code alongside conversational explanations, the entire raw patch envelope was stored and rendered in chat history. This created visual noise in conversational threads, and unapplied patches (e.g. during validation failures or dry-runs) were not forwarded to the Yomama Bridge staging surface.
4. **Cognitive Tier Binding Schema Rigidity**: In `LLM_SETTINGS_SCHEMA`, profile tier bindings were represented as flat strings (`<endpoint_id>::<model_name>`), lacking structured endpoint-to-model target dropdowns and missing automated cognitive tier recommendations for models harvested from public pricing feeds.

## Decision
1. **Dynamic `/code` Routine Context Scouting (`routines/code.md`, `orchestrator.py`)**:
   - Upgraded `code.md` with conditional scouting nodes when `{{ global.has_attached_files }} == False`:
     - `load_overview`: Executes `topology.overview` to compile repository structures and `CODE_INDEX.md` symbols.
     - `scout_targets`: Fast-tier LLM node that analyzes the overview and outputs up to 8 candidate target files as structured JSON (`{"requested_files": ["vfs://..."]}`).
     - `fetch_context`: Ingests scouted files, clamps paths against the topology ledger via `clamp_rag_files_to_topology()`, and packs them into context via `gather.pack_selection`.
2. **In-Composer Interactive Web-Chat Handoff (`agent.js`, `engine_agent.py`, `orchestrator.py`)**:
   - Re-architected the Web-Chat handoff interface. When a routine pauses for manual input, the bottom chat composer dynamically transitions into `.input-panel.handoff-mode`.
   - The handoff panel renders a multi-branch stepper, unified "Copy Context" (with file count badges), "Share Context", "Copy Prompt + Directives", and an integrated response textarea.
   - Submitting the reply ingests the response directly into the pending branch. Resuming turns skips creating synthetic user messages in `chat_messages`, preserving transcript purity.
3. **Conversational Prose & Yomama Patch Splitting (`orchestrator.py`, `agent.js`, `engine_agent.py`)**:
   - Implemented `strip_yomama_blocks_keep_prose()` in `orchestrator.py` to decouple conversational text from raw patch blocks.
   - When patches commit successfully, chat displays clean prose alongside an in-place receipt summary (`✅ Applied patches to N file(s)`).
   - When patches cannot be committed or are generated for staging, raw blocks are passed via `unapplied_patches` and forwarded directly to `window.inSetu.stores.Bridge.getState().parseAndAppendCells()`.
4. **Cognitive Profile Target Bindings & Catalog Model Tier Inference (`engine_llm.py`)**:
   - Added `web_chat` driver support to compute endpoint configurations and populated `DRIVER_TIER_DEFAULTS` across all drivers.
   - Built `_infer_model_cognitive_tier()` to categorize models harvested from OpenRouter, Models.dev, LiteLLM, and local Ollama instances into semantic tiers (`decision`, `fast`, `standard`, `thinking`, `frontier`).
   - Converted profile `tiers` into structured `target_binding` records (`{endpoint, model}`) and upgraded `active_profile_id` to a dynamic `select` dropdown.

## Consequences
* **Positive**: Fluid zero-attachment `/code` execution with automated symbol and topology scouting.
* **Positive**: Streamlined external LLM workflow through an in-composer handoff panel and direct response ingestion.
* **Positive**: Clean conversational chat history with automated patch forwarding to the Yomama Bridge.
* **Positive**: Structured, error-free cognitive profile configuration with automated model tier recommendations.
* **Negative**: Dynamic scouting adds one fast-tier LLM round-trip when no files are manually attached.
