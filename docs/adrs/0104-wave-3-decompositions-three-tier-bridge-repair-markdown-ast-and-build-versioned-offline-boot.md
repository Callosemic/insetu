# 0104: Wave 3 Decompositions, Three-Tier Bridge Repair & Sandwich Anchor Healer, Markdown AST Provider, S8 Human-Origin Allowlist, and Build-Versioned Offline Boot

## Status
Accepted (2026-11-10)

## Context
1. **Oversized Core Modules (Wave 3)**: `fs.js` (~3,488 LOC), `agent.js` (~2,054 LOC), and `engine_llm.py` (~1,555 LOC) combined state stores, spatial projections, catalog harvesters, and streaming protocol drivers in single files, exceeding module size ratchets.
2. **Bridge Anchor Drift Between Strict and LLM Healing**: When an LLM emitted a `SEARCH` block whose top and bottom context lines ("sandwich bread") matched verbatim on disk but whose interior lines had minor whitespace or comment drift, strict matching rejected the chunk, forcing either manual intervention or an LLM round-trip. Operators also needed explicit control over whether patch repair was disabled (`off`), purely deterministic (`algorithmic`), or LLM-backed (`ai_assisted`), plus full auditability of what windowed context was sent to the LLM healer.
3. **Markdown Structural Blindness & OCC Conflict Pollution**: Markdown files lacked a `BaseLanguageProvider` implementation for heading-span slicing, link/wikilink/citation extraction, and AST-enclosing diffs. Additionally, `*.conflict_<timestamp>.*` fallback files risked entering `gather_only` context compilations, and `topology_event_buffer` dropped sovereign `ctx://` and `ws://` mutations.
4. **Frameless Attestation Calls & Unbounded ZIP Exports**: `attest()` previously checked a blocklist (`NON_HUMAN_ORIGINS`), which did not reject calls made with no execution frame (`origin=None`) or prevent extensions from forging `execution_frame(origin=...)`. Furthermore, `fs/download_zip` was exposed to machine callers without file-count or byte-size caps.
5. **Transient Boot Network Drops vs. Module Quarantine**: During browser boot, a transient network drop while dynamically importing a JS module could be misclassified as a broken module and placed into Frontend Fault Quarantine.

## Decision
1. **Wave 3 God-Object Decompositions (`fs`, `agent`, `llm`)**:
   - Extracted `fs_store.js` and `fs_editor_projection.js` from `fs.js`.
   - Extracted `agent_store.js` and `agent_routine_studio.js` from `agent.js`.
   - Extracted `llm_catalog.py` and `llm_drivers.py` from `engine_llm.py`, and removed legacy single-provider settings keys.
2. **Three-Tier Bridge Repair Mode, Sandwich Anchor Healer & AI Telemetry Audit**:
   - Implemented `find_sandwich_fuzzy_anchor` in `bridge_fuzzy.py`, healing anchors deterministically when verbatim top/bottom boundary lines bracket an interior with composite similarity $C = 0.45 B + 0.55 I \ge 0.90$ and a $\ge 0.15$ margin over non-overlapping runner-up windows.
   - Standardized `repair_mode: 'off' | 'algorithmic' | 'ai_assisted'` across `bridge_vfs.py`, `engine_bridge.py`, and `bridge_store.js`, incorporating `repair_mode` into `PatchEvalSig` and `FileEvalSig`.
   - Extended `apply_ast_relocate_in_memory` to support comma-separated multi-symbol relocations (`SYMBOL: fn_a, fn_b`).
   - Added `llm_telemetry` and `bridge_heal_audit` SQLite tables and `POST bridge/compile_telemetry` (`ctx://contexts/ai_telemetry_context.txt`, S5 secret-scrubbed).
   - Unified agent `rag_strategy` and `compaction_strategy` under `helper_mode` (`deterministic` vs `ai_assisted`), and updated `/code` to stage patches in-chat via interactive **Staged Patch Stacks** before commit.
3. **Markdown Language Provider & JS Parser Hardening (`languages/markdown.py`, `base.py`, `javascript.py`)**:
   - Implemented `MarkdownLanguageProvider` (`indexes_code_symbols = False`) for hierarchical heading spans, relative links, `[[wikilinks]]`, `[@csl_id]` citations, `{{include_prompt:...}}` macros, and token-bounded interface skeletons.
   - Hardened `find_brace_balanced_end` across paren/bracket/brace depth, regex literals, and `${...}` template expressions, and added thread-local Tree-Sitter AST extraction to `JavaScriptLanguageProvider`.
4. **Topology `ctx_events` & OCC Conflict Cleanup (`engine_topology.py`, `engine_gather.py`)**:
   - Emitted sovereign `ctx://` and `ws://` mutations via `ctx_events` on `topology_resolved` while ignoring `ctx://contexts/` and `ctx://diffs/`.
   - Excluded `*.conflict_<timestamp>.*` files from `gather_only` context packs, reported `conflict_files` in `topology.audit_upkeep`, and added human-only `POST topology/clean_conflicts` (`mcp_expose=False`, routine-banned).
5. **S8 `HUMAN_ORIGINS` Allowlist & ZIP Export Caps (`attestations.py`, `protected_changes.py`, `engine_fs.py`, `rules_python.py`)**:
   - Enforced `HUMAN_ORIGINS = frozenset({"ui", "cli"})` in `attest()` and `_refuse_machine_origin()`, and codified `EXTENSION_EXECUTION_FRAME_ORIGIN_BAN` in `rules_python.py`.
   - Gated `fs.download_zip` as human-only (`mcp_expose=False`, routine-banned) with `MAX_ZIP_FILE_COUNT = 5000` and `MAX_ZIP_TOTAL_BYTES = 500 MB`.
6. **Build-Versioned App-Shell & Boot Import Retry Classification (`app.py`, `sw.js`, `manifest_sync.js`, `system.js`, `api.js`, `utils_core.py`)**:
   - Added `compute_build_id()` (`X-InSetu-Build-ID`, `window.INSETU_BUILD_ID`), `OS_CACHE_VERSION = 'v9'`, `importModuleWithRetry`, `classifyBootModuleFailure`, and S8 offline protected-file cache reversion on `sutram-outbox-item-synced`.
   - Rewrote `interpolate_mustache_chain` with `\x00MUSTACHE<idx>\x00` held-value tokens so resolved values are never re-scanned.

## Consequences
* **Positive**: Reduced module sizes across `fs`, `agent`, and `llm` while preserving clean barrel re-exports.
* **Positive**: Zero-token deterministic anchor healing for minor interior drift, plus full before/after telemetry for AI-assisted patch repairs.
* **Positive**: First-class Markdown section slicing and link/citation graph extraction without polluting `CODE_INDEX.md`.
* **Positive**: Strict allowlist enforcement for human attestations and resilient offline/flaky-network boot behavior.
