---
title: "Mental Model: Yomama Sync Bridge"
description: "Three-phase state machine, canonical ordering, n-1 healing, and content-addressed signature invariants for the Yomama Sync Bridge."
domain: "Core Architecture"
tags: [mental-model, bridge, yomama, invariants, vfs]
---

# Mental Model: Yomama Sync Bridge

Code shows what the Bridge does today; this document states the invariants that must remain true across every future refactor.

---

## 1. Core Abstractions: Pointers & Signatures

The Yomama Sync Bridge models patch evaluation as a pure, stateless functional pipeline over three primitives:
1. **Path Pointers ($P_{\text{path}}$):** The target URI (`vfs://<repo>/<path>` or `ctx://<volume>/<path>`) associating a patch cell with a physical file.
2. **File Content Signatures ($S_{\text{file}}$):** The SHA-256 hash of a file buffer at a given step in the sequence ($H(B_0)$ on disk, $H(B_k)$ in memory after patch $k$).
3. **Patch Content Signatures ($S_{\text{patch}}$):** The SHA-256 hash of a parsed patch block's normalized payload and its operator resolution state (`compute_block_signature`).

**The Pointer Invalidation Law:** Whenever a pointer $P_{\text{path}}$ changes (whether via automatic fuzzy path resolution, manual typing/remapping in the UI, or confirming a candidate), all downstream file and patch evaluation signatures ($S_{\text{file}}, S_{\text{patch}}$) **must** be recomputed against the new pointer's target buffer.

---

## 2. The Three-Phase Execution Model

Every Bridge transaction (`bridge.sync`) executes strictly across three sequential phases:

### Phase 1: Pure Path (Pointer) Resolution
* **Purpose:** Resolve each patch cell's raw target header into a canonical VFS pointer $P_{\text{path}}$.
* **Invariants:**
  - Path resolution **never mutates the patch payload** (beyond standard line-ending normalization and `{{ymm:...}}` transport macro expansion).
  - Whether resolved automatically (exact match, single pinned repository, or unique fuzzy match), via manual path editing, or via candidate confirmation, the sole output of Phase 1 is an updated pointer $P_{\text{path}}$ (or an `action_required` candidate prompt if ambiguous).

### Phase 2: The Canonical In-Memory Test Loop ($0 \dots n$)
* **Purpose:** Evaluate all active patches in memory to produce the final virtual file buffers and per-patch telemetry. In a dry run (`dry_run=True`), Phase 2 is the entire execution; in a live commit (`dry_run=False`), Phase 2 is the atomic pre-flight gate before any disk write occurs.
* **Invariants:**
  - **Zero Disk Touch:** The test loop never writes to disk. All sequential patch applications, 3-way overlap rebases, and end-of-file AST syntax validations (`_validate_buffer_syntax`) execute strictly against virtual in-memory buffers ($B_0 \rightarrow B_1 \rightarrow \dots \rightarrow B_m$).
  - **Unified Operator Transition Model:** All nine Yomama directive types (`SEARCH/REPLACE`, `SEARCH REGEX`, `TEXTEDIT`, `JSON_PATCH`, `RELOCATE`, `RENAME`, `MOVE_FILE`, `ARCHIVE_FILE`, `DELETE_FILE`) are modeled uniformly as pure state transition operators $B_{k-1} \rightarrow B_k$. Whenever an operator at canonical index $k$ modifies a target file buffer, it appends an immutable transition record (`pre_buffer`, `post_buffer`, `ledger_chunk`) to that file's transition log (`file_transitions[filepath]`). Cross-file operators (`RELOCATE`, `MOVE_FILE`, `ARCHIVE_FILE`, `RENAME`) emit transition records on each affected file buffer at step $k$.
  - **Patch Payload Immutability:** Evaluating a patch in the test loop **must never mutate the input block's `search` or `replace` strings**. It only produces a new output buffer $B_k$, appends a transition record to `file_transitions[filepath]`, and updates the patch's telemetry status (`resolved`, `auto_skipped`, `needs_confirmation`, `syntax_error`, `failed`).
  - **Canonical Given Order ($0 \dots n$):** Patch order matters. Every parsed block is stamped with its canonical creation index (`order` $\in [0 \dots n]$), and the internal test loop and ledger serializer evaluate transitions strictly in that order. Failed patches are **never** silently deferred or reordered to the end of a file's patch list.
  - **Exact $n-1$ Failure State Recording:** If patch $n$ fails to anchor (or introduces an isolated AST syntax error), its failure record (`deferred_failures`) captures `pre_buffer` $= B_{n-1}$—the exact virtual file state produced by patches $1 \dots n-1$.

### Phase 3: In-Place $n-1$ Healing & Signature Memoization
* **Purpose:** Repair failed patches (via deterministic anchor snapping or the Fast-Tier LLM healer) and re-verify the batch.
* **Invariants:**
  - **Each Heal Starts a New Test Loop:** Healing a patch is modeled as substituting the repaired patch $P_n'$ **in-place at canonical index $n$** (never appending $P_n'$ to the tail of the file's patch list) and running a fresh Phase 2 test loop.
  - **Healing Against the $n-1$ State:** When patch $n$ is healed, the healer receives the windowed context of $B_{n-1}$ (the virtual file state after patches $1 \dots n-1$), *never* a buffer that includes mutations from downstream patches $n+1 \dots m$.
  - **$O(1)$ Signature Alignment Skip:** Because file buffers and patch blocks are content-addressed via `FileEvalSig` (Tier 1 per-file bundle cache) and `PatchEvalSig` (Tier 2 intra-file sequential transition cache), starting a new test loop after healing patch $n$ is instantaneous:
    - Untouched files hit `_FILE_EVAL_CACHE` in $O(1)$ time.
    - Inside the healed file, patches $1 \dots n-1$ have identical $(P_{\text{path}}, H(B_{k-1}), S_{\text{patch}})$ signatures and hit `_PATCH_EVAL_CACHE` in $O(1)$ time without re-running `apply_block_in_memory`, advancing directly to $B_{n-1}$ where $P_n'$ is evaluated.

---

## 3. Two-Phase Lookahead Lexer & Parser (`parser.py`)

Parsing untrusted patch streams from diverse LLMs and external web chatbots operates under strict compiler guarantees:
* **Web-Chat Artifact Pre-Cleaning:** Prior to tokenization, input text is sanitized (`_preclean_web_chat_artifacts`):
  - Transports escape macros (`{{ymm:...}}`, `` ``` ``, `<<<<<<<`, `=======`, `>>>>>>>`) expand deterministically.
  - Zero-width invisible characters (`\u200b`–`\u200d`, `\ufeff`) and CRLF non-breaking spaces are stripped from candidate marker lines.
  - Multi-line blockquote chevron meltdowns (`> > > REPLACE\n>\n>`) are normalized back to `>>>>>>> REPLACE`.
* **Marker Indentation Tolerance:** Markdown lists, blockquotes, and HTML copy-pasting frequently indent markers. `_clean_marker_candidate` matches markers regardless of leading whitespace or trailing web-chat citation references (`` or ``).
* **Lookahead Separator Disambiguation:** When multiple `=======` lines occur between `<<<<<<< SEARCH` and `>>>>>>> REPLACE`, `_select_optimal_separator_index` evaluates lookahead spans to balance code fence blocks (`` ``` ``) and surrounding context lines rather than blindly splitting on the first separator.
* **Error-Boundary Synchronization:** Unclosed blocks do not silently swallow remaining patches. When a new `<<<<<<< FILE:` or `EOF` boundary is encountered unexpectedly, the parser emits an explicit `malformed: True` diagnostic block with 1-based line numbers for operator visibility.

---

## 4. Two-Tier Anchor Scanner & Overlap Rebaser (`bridge_fuzzy.py`)

Applying search blocks to real files balances structural precision with soft-wrap resilience:
* **Tier 0 (Strict Full-Line Scan):** Requires every non-empty line in the search block to match file lines via exact stripped equality (with soft-wrap adjacent line stitching).
* **Tier 1 (Boundary Fallback):** Only if Tier 0 yields zero matches and `allow_boundary_partial=True`, permits the first line to match a line suffix ($\text{len} \ge 6$) or the last line to match a line prefix ($\text{len} \ge 6$), strictly preserving unmatched boundary prefixes and suffixes (`unmatched_first_prefix`, `unmatched_last_suffix`).
* **Ambiguous Anchor Rejection:** If a search block matches two or more locations in the target file, the patch is rejected with `ambiguous:<lines>` rather than guessing or mutating the first hit.
* **The Hybrid Accordion Indentation Engine:**
  - Evaluates file structural step ($S_{\text{file}}$) against LLM step ($S_{\text{llm}}$).
  - Translates nesting levels via discrete grid snapping: $\text{target\_indent} = \text{base\_indent} + \text{round}((\text{llm\_indent} - \text{base\_llm}) / S_{\text{llm}}) \times S_{\text{file}}$.
  - Root escape hatch: if an LLM provides 0 spaces on an indented line, forces it to column 0.
  - Circuit breaker: if $S_{\text{file}} > 8$ or $S_{\text{llm}} \le 0$, falls back to safe 1:1 absolute shift.
* **Tier 2 Deterministic Overlap Rebasing (`rebase_overlapping_block_in_memory`):**
  - **Context-Edge Shrinking:** When sibling patches share overlapping sandwich context lines (where `search == replace`), automatically trims unchanged boundary lines if the core hunk still anchors uniquely.
  - **In-Memory 3-Way Rebase:** When both Patch 1 and Patch 2 were generated against disk baseline $O$, evaluates $O \rightarrow A$ and $O \rightarrow B$, merging disjoint modifications cleanly via `three_way_merge_text(O, A, B)` without LLM round-trips.

---

## 5. Keyframe Snapshots & Forward-Replay Ledger (`bridge_ledger`)

The Ephemeral Patch Ledger (`bridge_ledger`) provides complete forward-replay and atomic `/undo` reversibility:
* **The Human Intercept Rule:** When a file on disk has modified since the last recorded patch (`disk_hash != last_known_hash`), the bridge automatically marks `is_snapshot = 1` and compresses the pre-patch file state ($B_0$) via `zlib.compress`.
* **The 5-Turn Keyframe Routine:** To bound forward-replay decompression chains, every 5th consecutive turn on a file automatically captures a full compressed snapshot.
* **Deletion & Genesis Snapshot Guarantee:** Any patch performing a file deletion (`delete_file`) or overwriting an existing file via genesis always captures a full compressed snapshot of the pre-mutation file.
* **Forward-Replay Reconstruction (`_replay_ledger_chunks_in_memory`):** To revert a transaction (`/undo`), the engine locates the nearest preceding snapshot, decompresses it into memory, and sequentially replays all intermediate chunk types (`exact`, `regex`, `textedit`, `json_patch`, `delete_file`) forward up to the target transaction boundary before committing the reconstructed state.
