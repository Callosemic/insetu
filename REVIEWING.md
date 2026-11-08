# Reviewing inSetu

A fifteen-minute tour for someone evaluating the code: what to open, in what order, and the test that backs each part. It covers the parts I would most like reviewed, not the whole system.

inSetu is three repositories:

- **akasa:** the Python kernel. Routes, workers, the virtual file system, settings.
- **sutram:** the browser UI kernel and its components.
- **insetu:** the app built on both.

Paths below are in this repository unless they name akasa. `CODE_INDEX.md` maps every file and symbol if you want to wander.

## Before you start

```bash
pip install -e ".[all]"          # with akasa and sutram checked out beside this repository
python3 tests/run_unit_tests.py  # unit suites
python3 tests/fitness_functions.py  # architecture rules (AST and regex checks)
```

## 1. The bridge: applying a model's patch to real files (about 5 minutes)

The bridge takes the text a chat model writes (search-and-replace blocks, file moves, symbol relocations) and applies it to the workspace in memory first. It reports what would happen, and writes only when every block lands cleanly or a person accepts the problems. It is the part of inSetu used most, and the part a model's mistakes hit first.

- **`insetu/core/bridge/parser.py`: `parse_blocks`.** It parses patch text pasted from a chat window, which arrives damaged in predictable ways: markers broken by rendering, stray indentation from copy-paste, `=======` lines inside code. Malformed blocks become explicit diagnostics instead of disappearing. `get_base_step_and_diffs` works out a block's indent step so a patch written at a different indent still lands correctly.
- **`insetu/core/bridge/bridge_fuzzy.py`: `find_all_block_anchors` and `apply_block_in_memory`.** These find where a block belongs when the model's copy of the file is slightly off. Matching runs in tiers, strict first. Every match is returned, so an ambiguous anchor is reported instead of guessed.
- **`rebase_overlapping_block_in_memory`** in the same file handles two blocks in one patch that touch the same lines. It tries a deterministic three-way merge before giving up, with no model call.
- **`insetu/core/bridge/bridge_vfs.py`: `_process_sync_transaction`.** This runs one transaction. Each file has a `FileTimeline` (its state after every block, where `None` means absent and `""` means an empty file), and a `BridgeWorkingTree` follows moves inside the transaction. Then come the end-of-file syntax gate, which isolates the block that broke a file, the check that the files on disk have not changed since evaluation, and the ledger write that makes every transaction undoable.

Tests: `tests/unit/test_bridge_anchor_invariants.py` and `tests/unit/test_cartographer_and_bridge_ast.py`. The latter includes a seeded property test that random transactions mixing moves, relocations and edits give the same files in a dry run as in a live commit, and that undo restores every file byte for byte.

## 2. Protected changes: what an agent cannot do alone (about 4 minutes)

Some files decide whether you can recover when things go wrong: the CLI, the stand-alone recovery bridge, the credential store, inSetu's own approval records and the four directive files. No model, MCP client or routine writes them directly. Their writes become pending changes that a person reviews as a diff and confirms.

- **`insetu/core/protected_changes.py`.** Read `handle_protected_write`, `propose` and `confirm`. A confirmation names the exact hash the person reviewed, so a file that changed in the meantime is refused. Every step is appended to an audit log.
- **The smoke test.** `smoke_test` in the same file runs a new version of a recovery file in a subprocess, in an empty directory, before anything is written. A version that would break recovery is never written, and the last version that passed is kept as a fallback.
- **`insetu/recovery_check.py`** is the check that subprocess runs. It sits outside `insetu/core/` on purpose, so it still works when core is broken.
- **`insetu/core/attestations.py`.** It holds every standing approval: commands, hooks, workspace extensions, LAN access leases and accepted repository directives. Each is tied by a digest to exactly what the person approved, and approval is refused for calls that come from a model, an MCP client or a routine.

Tests: `tests/unit/test_protected_changes.py` (for example `test_a_machine_save_waits_and_writes_nothing`, `test_a_change_to_a_file_that_moved_on_is_refused`), `tests/unit/test_recovery_path.py` (`test_a_change_that_breaks_the_lifeboat_is_refused_at_confirm`, `test_an_emptied_lifeboat_boots_the_last_good_copy`) and `tests/unit/test_attestations.py`.

## 3. Saving without losing anyone's edits (about 2 minutes)

A file can be edited at once by you in the editor, by the bridge and by an agent. Saves carry the hash of the version they started from, and a save against a changed file is merged instead of overwriting it.

- **akasa `akasa/vfs.py`: `three_way_merge_text`, `record_vfs_ancestor`, `lookup_vfs_ancestor`.** These are the base, disk and incoming merge, and the ring of recent versions it uses to find the base.
- **`insetu/core/fs/engine_fs.py`: `api_fs_save`** uses them. A clean merge is written; a real conflict is reported, not resolved silently.

Tests: `tests/unit/test_vfs_three_way_merge.py` (`test_true_same_line_collision_flags_conflict`, `test_same_line_substring_collision_does_not_false_positive_merge`).

## 4. Rules the code is held to (about 2 minutes)

The architecture is enforced by tests, not by convention.

- **`tests/fitness/rules_python.py` and `tests/fitness/rules_javascript.py`** walk the AST (with regex fallbacks) for rules such as these:
    - child processes get their environment from one function;
    - outbound HTTP goes through one guarded fetch;
    - extensions reach core only through the SDK;
    - UI components hold no custom CSS;
    - modules may not grow past recorded size ceilings, which only go down.
- **`tests/unit/test_route_auth_inventory.py`** lists every route the app registers and requires a token for each one, unless it is on a short, read-only public list. A new route cannot ship open by accident.

## 5. Where to look for weaknesses

Known gaps, so you do not have to find them:

- **Large modules remain.** `utils_core.py`, `fs.js` and the bridge files are being split in planned waves; the size ratchet keeps them from growing meanwhile.
- **Remote access.** It works over Tailscale today and is protected by the tailnet's own identity check. Paired, revocable device tokens and terminal hardening are next on the roadmap.
- **Bridge indentation.** A block whose lines are off the four-space grid could be re-indented as a whole. The docstring case is fixed and tested; odd-indent Markdown nesting still needs tests.
- **Some JavaScript architecture rules run only on the regex path,** which flags a handful of violations the AST path does not check.

## How this was built

I direct the work, and AI models write most of the code. Until the current hardening sprint, that was one model, Gemini, through web chat. Since then the work has been split: Claude handles security and review, and Gemini handles features. Both still work through web chat, and their patches are applied through the bridge described above. When a block does not land, the bridge can ask a model to repair it, either on request or automatically. Every patch is dry-run first, so the repaired code shows up in the dry-run result and is reviewed there before anything is committed. inSetu's own agent features are being tested but have not yet been used to build it.

Every patch is reviewed before it is committed. Changes to security boundaries, the recovery path and the bridge itself are also reviewed by a different model from the one that wrote them, against the plan and the tests.

To see the planning and review in action:

- **`insetu/docs/plans/`** holds the current plans, and **`insetu/docs/plans/archived/`** the finished ones. This is the canonical record of what was planned and why.
- **`.insetu-data/tracker/`** holds a close-out ticket generated alongside every commit. These often give more detail than the commit message.

The roadmap and the log of problems found in review are available on request.
