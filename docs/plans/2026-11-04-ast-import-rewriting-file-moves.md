---
title: "Plan: Moves That Keep Imports Working (Bridge Issue #15, RELOCATE Targets, AST Import Rewriting)"
status: "planned"
created: "2026-11-04"
revised: "2026-11-04"
models:
  - "vfs://insetu/docs/models/yomama_bridge.md"
depends_on:
  - "2026-11-02-decomposing-god-objects-across-the-triad.md"
---

# Plan: Moves That Keep Imports Working

## Order (revised 2026-11-04)

1. **Sprint 1 first, before God-objects Wave 1:** fix bridge issue #15 and let `RELOCATE` create a missing destination file, with property tests. Wave 1 moves symbols, not whole files, so this is the part that helps it: one transaction can relocate symbols into a new module and edit the callers' imports.
2. **God-objects Wave 1** (`gemini_wave1_brief.md`), using `RELOCATE` where it fits.
3. **Sprint 2:** AST import rewriting on `MOVE_FILE` for Python and JavaScript, with atomic undo and cartographer re-keying.
4. **Sprint 3:** the live acceptance test, moving three bare modules out of `insetu/core/`.
5. **Later, after S5:** a language-server tier (see "Deferred").

During Wave 1, `insetu/core/directives.py`, `insetu/core/attestations.py`, `insetu/core/protected_changes.py` and `insetu/core/bridge/` (beyond import lines) stay hands-off, so Sprints 1 and 2 must not overlap Wave 1's commits on those files.

## Context

1. **Issue #15: a move and an edit in one patch.** The live bridge moved `insetu/core/agent/directives.py` to `insetu/core/directives.py` and dropped the edits to the new path that followed in the same patch, while the dry run applied them. Three mechanics in `bridge_vfs.py` cause it:
    - **Iteration order.** `_process_sync_transaction` iterates `for raw_target_file, blocks in parsed_structure.items():`, grouped by file header, instead of the canonical block order (`flatten_parsed_blocks`) when cross-file directives (`MOVE_FILE`, `RELOCATE`) are present. Blocks for the destination can run before the move creates it, and blocks for the source run against the emptied source buffer instead of following the move.
    - **Concurrency guard.** Writing `memory_buffers[dst_uri]` without seeding `disk_hashes[dst_uri]` and `original_buffers[dst_uri]` makes Phase 4's hash check or snapshot detection misfire when the destination is flushed.
    - **Undo.** A file created by `MOVE_FILE` or `RELOCATE` needs a ledger snapshot marking it new (`is_snapshot = 1`, no prior state) so `bridge.revert` to the initial state deletes it and restores the source.
2. **`MOVE_FILE` does not update imports.** It copies the bytes and empties the source, and every caller still imports the old path.
3. **Bare modules.** `insetu/core/` holds four modules outside any subpackage: `attestations.py`, `protected_changes.py`, `directives.py` and `utils_core.py`. The first three belong in `insetu/core/system/`; `utils_core.py` shrinks through the God-objects waves and stays. `insetu/` holds `app.py`, `cli.py`, `fallback_bridge.py` and `recovery_check.py`, which stay (see Sprint 3).

## Sprint 1: Issue #15, `FileTimeline` / `BridgeWorkingTree` (`Optional[str]` Buffer Algebra), and `RELOCATE` Targets (before Wave 1)

### The `Optional[str]` Buffer Law (`FileTimeline` & `BridgeWorkingTree`)
Instead of tracking file state across eight parallel dictionaries/sets (`memory_buffers`, `original_buffers`, `disk_hashes`, `deleted_targets`, `pre_existing_files`, `checked_disk_files`, `moved_pointers`, `file_transitions`) and magic `"__DELETED_FILE__"` sentinel strings, the Bridge represents every file state $B_k$ ($k \in [0 \dots m]$) as `Optional[str]`:
- **`None`**: The file **does not exist** at step $k$ (absent before creation, or deleted by `DELETE_FILE` / `MOVE_FILE`).
- **`""` (empty `str`)**: A **0-byte file exists** on disk at step $k$ (for example, an empty `__init__.py` or `.gitkeep`).
- **`"..."` (non-empty `str`)**: A file with content exists at step $k$.

`FileTimeline` encapsulates one file's `(uri, baseline: Optional[str], baseline_hash: Optional[str], current: Optional[str], transitions: List[Dict[str, Any]])`, and `BridgeWorkingTree(vfs)` owns the transaction's timelines and transitive move pointer redirects (`redirects: Dict[str, str]`). In `bridge_ledger`, a snapshot row (`is_snapshot = 1`) with `compressed_state = NULL` (`None`) represents $B_0 = \text{None}$ (file did not exist prior to the snapshot), whereas `compressed_state = zlib.compress(b"")` represents $B_0 = \text{""}$ (a 0-byte file existed). `_replay_ledger_chunks_in_memory` operates on `Optional[str] -> Optional[str]` with zero magic strings.

- [x] [S1.T1] **`FileTimeline`, `BridgeWorkingTree` & canonical order with move pointers** (`bridge_vfs.py`). Replace the 8 parallel state dicts/sets and the duplicate AST syntax gate loop in `_process_sync_transaction` with `FileTimeline` and `BridgeWorkingTree`. Evaluate cross-file transactions in canonical `0..n` order and resolve transitive move redirects (`src -> dst`).
- [x] [S1.T2] **`RELOCATE` creates a missing destination file** instead of failing, with the same new-file ledger snapshot as T3. The relocated symbol keeps its decorators and docstring, and the new file gets a module docstring from the block's `COMMENT` (the cartographer derives `CODE_INDEX.md` from it).
- [x] [S1.T3] **`Optional[str]` forward-replay & undo for created/deleted/0-byte files** (`engine_bridge.py`, `bridge_vfs.py`, `rules_python.py`). Eliminate `"__DELETED_FILE__"` in `engine_bridge.py` (enforced by `MAGIC_DELETED_FILE_SENTINEL_BAN` in `rules_python.py`). Ensure `_replay_ledger_chunks_in_memory` and `bridge.revert` distinguish `None` (absent) from `""` (0-byte file) so reverting a created file deletes it and reverting a deleted 0-byte file restores the 0-byte file.
- [x] [S1.T4] **Dry run and live commit take the same path.** The dry run applied the edits that the live commit dropped. Add a test that runs one transaction both ways and requires identical buffers.
- [x] [S1.T5] **Property tests** (roadmap V7, the parts this sprint touches). For random transactions mixing `MOVE_FILE`, `RELOCATE`, 0-byte files, and `SEARCH/REPLACE` on the moved files: dry run equals live commit; revert restores every file byte for byte; block order within the patch is honored.

## Sprint 2: AST import rewriting on MOVE_FILE (after Wave 1)

Each language provider in `insetu/core/languages/` gets two optional methods; the default returns content unchanged, so Rust and other languages are safe no-ops until they are implemented.

```python
class BaseLanguageProvider:
    def rewrite_moved_file_self(self, old_rel_path: str, new_rel_path: str, content: str) -> str:
        """Rewrites the moved file's own relative imports and __file__ parent chains when its depth changes."""
        return content

    def rewrite_imports_for_move(self, caller_rel_path: str, caller_content: str, old_rel_path: str, new_rel_path: str) -> str:
        """Rewrites imports and module references in a caller so they point at the moved file."""
        return caller_content
```

- [ ] [S2.T1] **Python** (`languages/python.py`), parsing with `ast` and editing exact line spans so untouched lines stay byte for byte:
    - `import A.B [as x]` to `import A.C.B [as x]`, and `A.B.attr` chains in the body when there is no alias.
    - `from A.B import x, y` to `from A.C.B import x, y`.
    - `from A import B [as x]`: rewrite in place for a single name; for several names, keep the others and add `from A.C import B` on the next line with the same indentation.
    - Relative imports in callers, resolved against the caller's package.
    - Exact string references: `mock.patch("A.B...")`, `"-m", "A.B"`, and repository-relative path strings.
    - In the moved file: relative imports and `Path(__file__)` parent chains adjusted by the change in depth.
- [ ] [S2.T2] **JavaScript** (`languages/javascript.py`): relative ESM specifiers (`import`, `export ... from`, `import()`) and `/static/extensions/<ext>/...` specifiers, in callers and in the moved file.
- [ ] [S2.T3] **Bridge integration** (`bridge_ast.py`, `bridge_vfs.py`). `apply_ast_move_rewrites_in_memory` rewrites the moved file and every tracked caller in the repository (including `tests/`) in memory during the canonical test loop. Each changed caller gets a transition record, joins `touched_in_group` and passes the end-of-file syntax gate, so `/undo` reverts the move and every rewritten caller together. `REWRITE_IMPORTS: false` in the block opts out. The patch result says "rewrote imports in N file(s)".
- [ ] [S2.T4] **Cartographer keeps descriptions across moves.** On a live commit the bridge emits `bridge_files_moved` with `{src_uri: dst_uri}`; the cartographer re-keys `file_descriptions` and `symbol_ledger` so hand-written `CODE_INDEX.md` text and `[stale?]` hashes survive.
- [ ] [S2.T5] **Report what it cannot rewrite.** A caller that builds a path from another module's location (for example `Path(other_module.__file__).resolve().parent.parent`) cannot be rewritten safely. The rewriter finds `__file__` uses on any imported module whose file is moving and lists them in the patch result as needing a person, instead of passing silently.
- [ ] [S2.T6] **Tests** (`tests/unit/test_cartographer_and_bridge_ast.py`): Python and JavaScript moves with caller rewriting, multi-name splitting, relative imports, `mock.patch` and `-m` strings, `__file__` depth changes, the cross-module `__file__` report from T5, description preservation, and one-step undo of the move and all callers.

## Sprint 3: Live acceptance test (three moves)

- [ ] [S3.T1] Move with `MOVE_FILE`, one block each:
    - `insetu/core/attestations.py` to `insetu/core/system/attestations.py`
    - `insetu/core/protected_changes.py` to `insetu/core/system/protected_changes.py`
    - `insetu/core/directives.py` to `insetu/core/system/directives.py` (in `system` because `engine_topology.py` reads `get_directives` early in boot, and `system` mounts before `topology`, which mounts before `agent`)
- [ ] [S3.T2] Confirm callers and fitness tables updated: `insetu/app.py`, `insetu/core/utils_core.py`, `insetu/core/fs/engine_fs.py`, `insetu/core/bridge/bridge_vfs.py`, `insetu/core/system/engine_system.py`, `insetu/core/topology/engine_topology.py`, `insetu/extensions/hooks/engine_hooks.py`, `insetu/extensions/preview/engine_preview.py`; `SETTINGS_ACCESS_RATCHET` and `PROTECTED_WRITE_HOMES` in `tests/fitness/rules_python.py`; and the suites `test_attestations.py`, `test_protected_changes.py`, `test_recovery_path.py`, `test_preview_exposure.py`, `test_directives.py`.
- [ ] [S3.T3] Remove the single-file `match_prefixes` entries for the three moved modules from `.insetu/config.json`, update module paths in `docs/01_engineering_standards.md` and `docs/models/yomama_bridge.md`, and run the cartographer, the unit suites and the fitness checks.

**`insetu/recovery_check.py` does not move.** It is part of the recovery path. It sits beside `cli.py` and `fallback_bridge.py`, outside `insetu/core/`, so the smoke test still runs when core is broken. `protected_changes.py` also builds the subprocess import path from its location (`Path(_recovery_check.__file__).resolve().parent.parent` with `-m insetu.recovery_check`); moving it would change that depth, the smoke test would fail, and every protected write would be refused.

## Deferred: a language-server tier (after S5)

Language servers can do renames and moves more completely than the AST tier, and they can report diagnostics after every patch, which may be worth more than renames. They also run code from the repository: rust-analyzer runs build scripts and procedural macros by default, and the TypeScript server loads plugins named in the project's own config. So the tier waits for S5's risk classes and is treated as an approved command:

- A server command runs only after a person approves it for that repository, recorded in the attestation store like test commands, through a human-only route.
- Servers start with `child_env("tool")`, the repository as the working directory, and no network beyond what the server needs.
- **Warm, not per call.** Start a server the first time a repository needs it and keep it running for the session, with files opened lazily and kept open, and shut it down after an idle period or when the workspace closes. Starting a server per move would cost seconds each time and lose its index.
- Offer diagnostics after each bridge commit (the files the patch touched) before offering renames.
- The AST tier from Sprint 2 always runs afterwards, for inSetu-specific references (`/static/extensions/...`, `mock.patch` strings) that servers do not know.

## Done when

1. A transaction can move a file or relocate a symbol into a new file and edit the result in the same patch, and the dry run and the live commit give the same files (Sprint 1).
2. `MOVE_FILE` rewrites Python and JavaScript imports and module references in memory, reports what it cannot rewrite, passes every changed file through the syntax gate, and undoes the whole move in one step (Sprint 2).
3. The only modules directly in `insetu/core/` are `utils_core.py` and the package marker; `insetu/` keeps `app.py`, `cli.py`, `fallback_bridge.py` and `recovery_check.py` (Sprint 3).
4. The unit suites and fitness checks pass with no new failures.
