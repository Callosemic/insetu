# ADR 0097: Two-Phase Lookahead Yomama Parser, Content-Addressed Signature Memoization, In-Place n-1 Auto-Healing, and Deterministic Overlap Rebasing

## Status
Accepted (2026-11-03) (Partially supersedes ADR 0082's deferred append-to-tail chunking in favor of canonical in-place $n-1$ substitution)

## Context
As the inSetu Developer OS deepened autonomous agent routines and multi-chunk code patch transactions, several architectural and performance bottlenecks emerged across patch parsing, state evaluation, and self-healing:
1. **Parser Conflation & Web-Chat Meltdowns**: Yomama block parsing was historically bundled inside general system utilities (`utils_core.py`), coupling pure parsing logic to path resolution. Furthermore, when developers pasted patches from diverse web-chat chatbots or Markdown previewers, conversational artifacts (such as blockquote chevron meltdowns `> > > REPLACE`, zero-width invisible characters, leading whitespace indentation on markers, and multiple literal `=======` lines inside code blocks) caused parsing failures or mangled search anchors.
2. **Sequential Multi-Chunk Anchor Shifting & Fragile Deferred Appending**: In ADR 0082, failed chunks were deferred to the end of the file's patch list. While this allowed earlier non-overlapping chunks to apply, reordering failed chunks to the tail violated the developer's original patch sequence, broke downstream chunks that depended on earlier failed chunks, and sent bloated full-file prompts to the LLM healer.
3. **Re-Evaluation CPU & Syntax Bottlenecks**: During multi-patch transactions or multi-pass auto-healing, every evaluation pass re-executed Tree-sitter and Python AST syntax validation against all files, even when 13 out of 14 files were completely untouched. The engine lacked content-addressed signature memoization.
4. **Sandwich Context Overlap Failures**: When LLMs emitted two adjacent patches modifying lines near one another in the same file, both patches often included the same surrounding context lines. Applying Patch 1 mutated the context lines needed by Patch 2, causing Patch 2 to fail anchor matching even though both edits were non-conflicting.
5. **Presentation & Layout Coupling**: `bridge.js` and `agent.js` retained legacy CSS blocks, ResizeObservers, and bespoke layout wrappers, violating the Zero-CSS presentation standard (`CUSTOM_COMPONENT_CSS_BAN`).

## Decision
1. **Compiler-Grade Two-Phase Lexer & Lookahead Parser (`insetu/core/bridge/parser.py`)**:
   - Extracted block parsing into sovereign module `insetu/core/bridge/parser.py`.
   - Built a two-phase lexer and lookahead separator disambiguator (`_select_optimal_separator_index`) that balances inner markdown code fences and context lines when multiple `=======` lines occur in a patch.
   - Built web-chat artifact pre-cleaning (`_preclean_web_chat_artifacts`): expands anti-meltdown escape macros (`{{ymm:...}}`), strips zero-width invisible characters (`\u200b`–`\u200d`, `\ufeff`), and repairs blockquote chevron meltdowns (`> > > REPLACE` $\rightarrow$ `>>>>>>> REPLACE`).
   - Hardened marker candidate detection to tolerate leading indentation from rich copy-paste and strip leaked citation tags.
   - Synchronized on error boundaries with explicit diagnostic blocks (`malformed: True`) with line numbers for boundary failures.
   - Centralized `compute_block_signature`, `flatten_parsed_blocks`, and `get_base_step_and_diffs`.
2. **Two-Tier Content-Addressed Signature Memoization (`bridge_vfs.py`)**:
   - **Tier 1 (FileEvalSig):** Hashes the resolved file pointer, on-disk SHA-256 hash, ordered block signatures, and user resolutions. Unchanged files hit cache in $O(1)$ time, skipping both AST syntax validation and patch application.
   - **Tier 2 (PatchEvalSig):** Models each block application as a pure state transition $H(B_{k-1}) \rightarrow H(B_k)$. When patch $n$ is repaired, preceding valid patches $1 \dots n-1$ hit cache in $O(1)$ time.
   - Reduced multi-file 70-patch re-evaluation latency to under 50ms with a 98.5% cache hit rate.
3. **Canonical Given Order & In-Place $n-1$ Auto-Healing (`bridge_vfs.py`, `bridge_fuzzy.py`, `engine_bridge.py`)**:
   - Enforced strict canonical given order ($0 \dots n$): blocks preserve their creation `order`, evaluate in sequence, and are never reordered to the tail.
   - Enforced Patch Payload Immutability: eliminated in-place mutation of `block["search"]` and `block["replace"]` inside `apply_block_in_memory`.
   - Exact $n-1$ Pre-Buffer Recording: if patch $n$ fails, its record in `deferred_failures` captures $B_{n-1}$ (the exact virtual buffer produced by patches $1 \dots n-1$).
   - In-Place Healing: parallel per-file healing where the fast-tier LLM receives the windowed context of $B_{n-1}$ (`_extract_windowed_buffer_context` for files > 400 lines) and substitutes the repaired block in-place at index $n$.
   - $O(1)$ End-of-File AST Syntax Gate: validates AST syntax once per modified file at the end of the test loop on clean batches, with fault-isolating rollback.
4. **Tier 2 Deterministic Overlap Rebasing (`bridge_fuzzy.py`)**:
   - **Context-Edge Shrinking:** Automatically trims unchanged sandwich context lines (where `search == replace`) when two patches share boundary context lines.
   - **In-Memory 3-Way Rebase:** Evaluates $O \rightarrow A$ and $O \rightarrow B$, merging disjoint modifications cleanly via `three_way_merge_text(O, A, B)` with zero LLM round-trips.
5. **Yomama Sync Bridge Client UI Modernization (`bridge.js`)**:
   - Replaced custom CSS stylesheets and ResizeObservers with pure `sharedStyles` and Sutram primitives (`<sutram-sidebar-layout>`, `<sutram-view>`, `<sutram-surface>`, `<sutram-card>`, `<sutram-stack>`).
   - Implemented Smart Replace-on-Paste: pasting repaired blocks for files with broken/inactive cells replaces those cells in-place instead of appending duplicates.
   - Implemented optimistic 0ms local cell skips (`skipCellOptimistic`, `skipAllFailedCellsOptimistic`) updating telemetry and `can_commit` without a network round-trip.
   - Added batch triage header bar and per-patch quick action buttons.
6. **External Web-Chat Handoff & Prompt Compiler Hardening (`orchestrator.py`, `agent.js`)**:
   - Decoupled prompt context inclusion for web_chat/manual handoffs (`include_context=False`), preventing raw `<workspace_context_nonce>` dumps from bleeding into copied prompts while tracking `context_uris` separately.
   - Suppressed bare command slug echoes when `user_prompt` matches the routine ID or slash command.
   - Fixed `serialize_routine_to_markdown` to eradicate literal `---\n---\n\n` double-frontmatter leaks across routine files.
   - Preserved unheaded markdown bodies under `execute_prompt`.
   - Implemented `_read_routine_uri_or_path` checking `ctx.vfs.read()` before reading disk for instant uncommitted routine discovery.
   - Upgraded `_normalize_condition_expr` supporting `contains` expressions (`LHS contains RHS` -> `RHS in LHS`) and mustache default bindings (`{{ var | default }}`).
   - Added `system.extensions.workspace.approve` and `system.extensions.workspace.revoke` to `ROUTINE_BANNED_CAPABILITIES` (S8).
   - Routed outbound HTTP requests in `engine_llm.py` through `fetch_url()` to comply with S4 `OUTBOUND_FETCH_MANDATE`.

## Consequences
* **Positive**: Absolute parsing resilience against conversational chatbot copy-paste artifacts and ambiguous code separators.
* **Positive**: Deterministic in-place $n-1$ auto-healing that preserves the author's canonical patch sequence.
* **Positive**: Sub-50ms multi-patch re-evaluations via content-addressed two-tier signature memoization.
* **Positive**: Zero LLM round-trips for adjacent overlapping patches through deterministic context-edge shrinking and 3-way rebasing.
* **Positive**: 100% compliance with Zero-CSS presentation standards and Sutram Lego primitives across Bridge and Agent surfaces.
* **Positive**: Clean external LLM handoffs free of `<workspace_context_nonce>` prompt bleed or bare routine slug echoes.
* **Negative**: Two-tier memoization caches consume up to 256 file bundles and 1024 chunk transitions in memory (bounded by LRU eviction).
