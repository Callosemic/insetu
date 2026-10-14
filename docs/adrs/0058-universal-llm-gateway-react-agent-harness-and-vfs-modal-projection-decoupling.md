# ADR 0058: Universal LLM Gateway, Autonomous ReAct Agent Harness, and VFS Modal Projection Decoupling

## Status
Accepted (2026-10-13)

## Context
As the inSetu Workbench expanded its AI capabilities, relying on external, unmanaged scripts to drive LLM interactions introduced latency, lacked tenant credential scoping, and bypassed the Yomama Sync Bridge's strict syntax verification safeguards. Furthermore, static bundlers or monolithic vendor trees for syntax highlighters (CodeMirror 6) created memory bloat, whereas external CDN imports violated offline isolation (ADR 0032).

Concurrently, frontend file management operations (moving, renaming, creating files/folders, inserting links, and browsing parts) and patch editing were implemented via monolithic modal overlays (`<insetu-vfs-modals>`). These overlays constrained the user to a single blocking interaction, prevented parallel multi-column workflows, and conflicted with container query responsiveness.

## Decision
1. **Universal LLM Gateway (`engine_llm.py`)**:
   - Implemented an agnostic inference orchestrator supporting Anthropic Claude REST streaming, Google Gemini REST streaming, and local Claude CLI execution.
   - Enforced workspace-scoped credential isolation (`secrets.json` / `SettingsManager`) and standard Server-Sent Events (SSE) streaming contracts (`/api/<workspace_id>/llm/chat/completions`).
2. **Autonomous ReAct Agent Harness (`engine_agent.py`, `agent.js`)**:
   - Introduced the `agent` core extension backed by an SQLite conversation schema (`chat_sessions`, `chat_messages`).
   - Integrated a 4-phase background worker chain (`_execute_agent_turn`): context assembly (via Gather selection packing), inference streaming, atomic Yomama Bridge patch execution, and an automated self-healing retry loop (bounded at 3 retries) feeding syntax errors back to the model.
3. **JIT CodeMirror Language Vendorization (`engine_editor.py`)**:
   - Established `/api/<workspace_id>/editor/vendorize` to fetch and locally cache missing language grammars into `.insetu/vendor/codemirror/lang-{mode}.js` on demand, verifying path traversal safety and maintaining zero-CDN offline compliance.
4. **VFS & Bridge Modal Annihilation / Spatial Projections (`fs.js`, `bridge.js`)**:
   - Permanently eradicated `<insetu-vfs-modals>` and Bridge modal overlays.
   - Re-routed all file management and patch editing workflows into first-class spatial projections (`InSetuMoveFileProjection`, `InSetuNewFileProjection`, `InSetuNewFolderProjection`, `InSetuLinkInsertProjection`, `InSetuBrowserProjection`, `InSetuBridgeEditProjection`, `InSetuBridgeDiffProjection`) pinned directly into the multi-column `LayoutStore`.

## Consequences
* **Positive**: Fully autonomous, self-healing code generation and patch verification within the Workbench.
* **Positive**: Fluid, non-blocking multi-column workflow across file operations, editor projections, and patch inspections.
* **Positive**: Zero-CDN compliance preserved without upfront vendor bundle bloat.
* **Negative**: Agent worker chains require active worker thread capacity and intermediate SQLite ledger storage during multi-turn retries.