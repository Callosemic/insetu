# ADR 0099: DevOps Extension Suite Zero-CSS Modernization, Batched Git Cat-File Pre-Fetching, Topology Sieve Diff Parity, and Landmark-Driven Closeout Protocols

## Status
Accepted (2026-11-03)

## Context
Following the core pipeline Zero-CSS modernization and interleaved AST diff projection integration (ADR 0098), several architectural and presentation seams across the DevOps extension suite (`dev`, `git`, `preview`, `term`, `update`) required consolidation:
1. **DevOps Custom CSS Drift & Manual Renders**: While core modules were standardized to Zero-CSS in ADR 0098, `ext_dev.js`, `ext_git.js`, `ext_preview.js`, `ext_term.js`, and `ext_update.js` retained custom `css` template blocks (with `ext_preview.js` containing over 150 lines of custom CSS). Furthermore, components frequently triggered manual `this.requestUpdate()` calls rather than relying on reactive Lit bindings.
2. **Sequential Subprocess Diff Generation Bottlenecks**: `generate_diff_context` in `engine_git.py` executed individual `git show HEAD:<path>` subprocess calls for every modified file. In repositories with dozens of modified files, this spawned N sequential subprocesses, stalling diff compilation.
3. **Diff Sieve Desynchronization**: While `topology_ledger` evaluated files through the two-stage Topology Sieve (`is_file_tracked_by_sieve`), `engine_git.py` implemented ad-hoc ignore matching that did not honor `.gitignore` anchor semantics, `force_include`, or `ignore_exceptions`. As a result, files ignored by the repository were sometimes bundled into `ctx://diffs/` context payloads instead of being routed to the Sweepable State tray.
4. **Hardcoded Landmarks in Closeout Protocols**: `close_session_protocol.md` hardcoded inSetu-specific file paths and titles rather than consuming dynamic repository landmarks (`sys.repo_title`, `sys.contract_stack`, `sys.adr_dir`, `sys.standards_doc`, `sys.guardrail_rules`, `sys.hardening_target`), violating the Self-Hosting & Target-Repository Agnosticism Mandate.

## Decision
1. **DevOps Extension Suite Zero-CSS Modernization (`ext_dev.js`, `ext_git.js`, `ext_preview.js`, `ext_term.js`, `ext_update.js`)**:
   - Eradicated all custom CSS blocks (`css` imports and template literals) across `ext_dev.js`, `ext_git.js`, `ext_preview.js`, `ext_term.js`, and `ext_update.js`, standardizing on `static styles = [sharedStyles];`.
   - Converted views, dashboards, toolbars, cards, and modal dialogs to Sutram Lego primitives (`<sutram-view>`, `<sutram-stack>`, `<sutram-surface>`, `<sutram-card>`, `<sutram-tag>`, `<sutram-label>`, `<sutram-action-bar>`).
   - Cleaned up redundant manual `this.requestUpdate()` calls, letting reactive Lit property bindings manage updates.
   - Replaced card opacity hacks with the semantic `?stale=${isLocked}` property in `ext_git.js`.
2. **Batched `HEAD` Blob Pre-Fetching via `git cat-file --batch` (`engine_git.py`)**:
   - Implemented `_batch_read_git_head_blobs(git_root: Path, lookup_paths: List[str]) -> Dict[str, str]`, streaming paths into `git cat-file --batch` over stdin and parsing output lengths to retrieve all `HEAD` contents in a single subprocess call.
   - Handled git renames (`->`) by tracking `rename_head_map`, ensuring renamed files resolve their predecessor's blob in `HEAD`.
3. **Topology Sieve Diff Parity (`engine_git.py`)**:
   - Implemented `diffable_changes(changed_files, config, live_cfg)` filtering porcelain changes through `is_file_tracked_by_sieve`. Files excluded by `.gitignore`, `repo_ignore_patterns`, or sieve rules stay out of `ctx://diffs/` and route cleanly to the Sweepable State tray.
   - Integrated single-stream interleaved AST diffs via `format_interleaved_file_diff(canon_vfs_uri, base_content, content)`.
   - Flushed in-flight filesystem mutation events in `_background_sweep_status` via `resolve_topology_buffer(ctx.workspace_id)`.
4. **Landmark-Driven Closeout Protocols (`close_session_protocol.md`)**:
   - Refactored `close_session_protocol.md` to consume dynamic repository landmarks (`sys.*`), ensuring protocol instructions adapt dynamically to any mounted repository's architecture, contracts, standards, and test suites.

## Consequences
* **Positive**: 100% repository-wide adherence to `CUSTOM_COMPONENT_CSS_BAN` and Zero-CSS presentation standards across all DevOps extensions.
* **Positive**: Significant latency reduction in Git diff compilation through single-subprocess batched `HEAD` blob pre-fetching.
* **Positive**: Perfect mathematical parity between `topology_ledger` and `git_diffs` compilation.
* **Positive**: Dynamic landmark-driven session closeout prompts supporting arbitrary polyglot target repositories.
