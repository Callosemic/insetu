---
title: "Plan: Yomama PatchCell Identity, Stripped-Line/AST Window Locator, Inline FileTimeline Healing & Bridge Hot-Path Cleanup"
description: "Eliminate text round-trip identity loss, unstripped SequenceMatcher blind spots on large files, multi-pass outer healing loops, the dead bridge/merge_blocks route, and redundant parser/AST allocations in the Yomama Bridge."
status: completed
created: "2026-11-05"
models:
  - "vfs://insetu/docs/models/yomama_bridge.md"
depends_on:
  - "2026-11-04-ast-import-rewriting-file-moves.md"
---

## 2. Target Architecture

### Pillar 1: End-to-End `cell_id` Identity & Canonical Serialization (`parser.py` & `bridge.js`)
Every patch chunk has a stable `cell_id` from ingress to commit, and `parser.py` owns both parsing and serialization:
- **Backend (`parser.py`):**
  - `parse_blocks(text)` assigns a deterministic fallback `id: f"cell_{order}"` whenever a block does not declare an explicit `<<<<<<< ID: <id>` header.
  - `serialize_block_chunk(block, include_file_header=False, filepath="") -> str` and `serialize_blocks_to_yomama(file_to_blocks) -> str` live in `parser.py` as the single source of truth for Yomama serialization.
- **Frontend (`bridge.js`):**
  - `BridgeStore.parseAndAppendCells(text)` parses and preserves `<<<<<<< ID: <id>` headers when present instead of discarding them.
  - `BridgeStore.applyHealedCells(healedCellsMap)` updates repaired cells in `BridgeStore.cells` **in-place by `cell.id`** (updating `file` and `content` while preserving `id`, `active`, array ordering, and `resolutions`), regardless of whether `tel.can_commit` is `true` or `false`.

### Pillar 2: Unified Stripped-Line + AST/Declaration Window Locator (`locate_closest_window` in `bridge_window.py`)
`bridge_window.py` (re-exported by `bridge_fuzzy.py`) exposes a single source of truth for locating the closest window in `file_lines` for a failed `SEARCH` block:
```python
def locate_closest_window(
    file_lines: List[str],
    search_lines: List[str],
    replace_lines: Optional[List[str]] = None,
    symbol_hint: Optional[str] = None,
) -> Dict[str, Any]:
```

- **Stripped-Line Contiguous Match:** Runs `difflib.SequenceMatcher` over `[l.strip() for l in file_lines]` and `[l.strip() for l in search_lines]` (plus contiguous head/tail probes of `search_lines`) so indentation differences (e.g., 8 spaces vs. 4 spaces) never blind the locator.
- **Declaration & Distinctive-Line Fallback:** Scans `search_lines` and `replace_lines` for `def`/`async def`/`class`/`function` declarations, `symbol_hint`, and distinctive lines ($\ge 16$ non-whitespace chars) to anchor the window when multi-line edits break contiguous runs.
- **Shared Consumer Contract:** Used by both `bridge_vfs.py` (to compute `actual_anchor` and the `ndiff` diagnostic for **Snap Anchor to Disk**) and `bridge_window.py` (`extract_windowed_buffer_context` for AI Auto-Repair). Enforced by the `SINGLE_WINDOW_LOCATOR_MANDATE` fitness rule.

### Pillar 3: Bounded Per-`cell_id` Healing with Immediate In-Memory Verification (`bridge_vfs.py` & `engine_bridge.py`)
1. **Bounded Single-Attempt Per `cell_id`:**
   - Each failed `cell_id` is tracked in `attempted_cell_ids` and sent to the fast healer at most once per sync against its exact $B_{k-1}$ (`pre_buffer`) state.
   - **Immediate Verification Gate:** The candidate block returned by the fast LLM is immediately tested against $B_{k-1}$ via `apply_block_in_memory(B_{k-1}, candidate_block, silent=True)` (and `_validate_buffer_syntax` when repairing a syntax error).
   - If the candidate block anchors, it replaces `cell_id` in-place and `telemetry["healed_cells"][cell_id]` records `{id, file, content}`.
   - If the candidate block still fails to anchor, it is rejected immediately and never retried, making runaway multi-call loops impossible.

### Pillar 4: Bridge Hot-Path & Dead-Code Cleanup (`engine_bridge.py` & `bridge_vfs.py`)
1. **Delete `BridgeMergeBlocksPayload` & `bridge_merge_blocks`** from `engine_bridge.py`.
2. **Thread-Local Tree-Sitter Parser Cache (`_TS_PARSER_LOCAL`)** in `bridge_vfs.py` so `_validate_buffer_syntax` reuses initialized Python/JS parsers without re-allocating on every file.
3. **Single `flatten_parsed_blocks` Pass** at the top of `_process_sync_transaction` in `bridge_vfs.py`.
4. **Fast Anchor Probe (`has_distinctive_anchor_line`)** before running full `apply_block_in_memory` in `resolve_fuzzy_path`.

---

## 3. Sprint Tasks

- [x] [S1.T1] Implement `locate_closest_window` and `extract_windowed_buffer_context` in `insetu/core/bridge/bridge_window.py` (re-exported by `bridge_fuzzy.py`) and wire both `bridge_vfs.py` (`actual_anchor` diagnostic) and `engine_bridge.py` to it. <!-- targets: vfs://insetu/insetu/core/bridge/bridge_window.py, vfs://insetu/insetu/core/bridge/bridge_fuzzy.py, vfs://insetu/insetu/core/bridge/bridge_vfs.py, vfs://insetu/insetu/core/bridge/engine_bridge.py, test_contract: vfs://insetu/tests/unit/test_bridge_anchor_invariants.py -->
- [x] [S1.T2] Ensure `parse_blocks` in `insetu/core/bridge/parser.py` assigns a deterministic `id` (`current_id or f"cell_{order}"`) to every block, move `serialize_block_chunk` / `serialize_blocks_to_yomama` into `parser.py`, and teach `BridgeStore.parseAndAppendCells` in `insetu/core/bridge/bridge.js` to preserve `<<<<<<< ID:` headers. <!-- targets: vfs://insetu/insetu/core/bridge/parser.py, vfs://insetu/insetu/core/bridge/bridge.js, test_contract: vfs://insetu/tests/unit/test_js_behavioral_units.py -->
- [x] [S1.T3] Enforce bounded per-`cell_id` healing verified in-memory against $B_{k-1}$ in `engine_bridge.py`, emit `telemetry["healed_cells"]`, add `BridgeStore.applyHealedCells` in `bridge.js`, and delete the dead `bridge/merge_blocks` route + optimize Tree-sitter/flatten hot paths in `bridge_vfs.py`. <!-- targets: vfs://insetu/insetu/core/bridge/engine_bridge.py, vfs://insetu/insetu/core/bridge/bridge_vfs.py, vfs://insetu/insetu/core/bridge/bridge.js, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py -->
- [x] [S1.T4] Add `SINGLE_WINDOW_LOCATOR_MANDATE` to `tests/fitness/rules_python.py` forbidding raw `difflib.SequenceMatcher` in `insetu/core/bridge/` outside `bridge_window.py` / `bridge_fuzzy.py`. <!-- targets: vfs://insetu/tests/fitness/rules_python.py, test_contract: vfs://insetu/tests/unit/test_wave1_ratchets.py -->