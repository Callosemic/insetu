# ADR 0086: Git Diff Capabilities, Autonomous Routines, Tailscale Extension Retirement, and Single-File Membrane Compliance

## Status
Accepted (2026-10-28)

## Context
As the inSetu Developer OS broadened autonomous agent workflows and consolidated network security primitives, several integration seams required architectural alignment:
1. **Agent-Driven Diff Auditing & Session Closeout Gap**: Autonomous agent routines required programmatic endpoints to trigger targeted Git diff recompilations and inspect dirty diff bucket payloads without scraping UI state or executing raw shell commands.
2. **Push Projection Commit Message Pre-Seeding**: While the Agent Harness could synthesize high-quality Conventional Commit messages from diffs and Bridge ledger receipts, `InSetuGitPushProjection` required manual copy-pasting of commit messages.
3. **Tailscale Extension Redundancy**: Following the introduction of the Tier 2 Core Substrate `engine_remote.py` (ADR 0081 / ADR 0084), the standalone `tailscale` extension (`engine_tailscale.py`, `ext_tailscale.js`) was entirely redundant. Furthermore, `engine_preview.py` still invoked direct `execute_binary(["tailscale", ...])` subprocess calls rather than delegating to `engine_remote.py`.
4. **Frontend Membrane Import Drift in Update**: `ext_update.js` directly imported from `/static/vendor/sutram/js/shared_styles.js` and `/static/vendor/sutram/js/utils.js`, violating the Single-File Frontend Membrane Mandate (`SUTRAM_MEMBRANE_ISOLATION`, ADR 0085).

## Decision
1. **Programmatic Git Diff Capabilities (`engine_git.py`)**:
   - Added `@git_bp.route('compile_diffs')` with `GitCompileDiffsPayload` schema to trigger on-demand compilation of `ctx://diffs/*_diffs.txt` artifacts.
   - Added `@git_bp.route('list_dirty_diff_buckets')` inspecting `ctx.manifest['ctx']` for active `ctx://diffs/` URIs and returning structured bucket descriptors (`diff_file`, `repo`, `bucket_id`, `title`, `content`).
2. **Markdown-as-Code Git Routines & Protocols (`git/routines/*.md`, `git/prompts/*.md`)**:
   - Implemented `diff_audit.md` (`/audit`): compiles fresh diffs, audits dirty buckets in parallel (`audit_bucket` via fast tier `map_over`), and synthesizes an executive review and Conventional Commit message (`synthesize_audit_report` via thinking tier).
   - Implemented `close_session.md` (`/closeout`): compiles diffs, inspects dirty buckets, aggregates Bridge ledger comments, and prepares a session summary and commit message.
3. **Push Projection Commit Message Pre-Seeding (`ext_git.js`)**:
   - Updated `_handleOpenPush(e)` to accept `commitMessage` in event details, pre-populating `gitPushMessage` in `GitStore` and preserving it across changelog queries.
4. **Tailscale Extension Decommissioning & Preview HTTPS Serve Delegation (`engine_preview.py`)**:
   - Formally deleted `insetu/extensions/tailscale/engine_tailscale.py` and `ext_tailscale.js`.
   - Updated `_bind_tailscale_https` in `engine_preview.py` to delegate directly to `set_tailscale_https_serve(port, enable)` from `insetu.core.remote.engine_remote`.
5. **Single-File Frontend Membrane Alignment (`ext_update.js`)**:
   - Refactored `ext_update.js` to import `sharedStyles` and `debounce` exclusively from `/static/extensions/system/insetu_sdk.js`.

## Consequences
* **Positive**: Complete programmatic capability for agent routines to audit uncommitted changes and draft Conventional Commit messages.
* **Positive**: Seamless handoff between agent-synthesized commit messages and the human-reviewed push projection.
* **Positive**: Eradication of redundant extension codebase in favor of Tier 2 `engine_remote.py`.
* **Positive**: 100% adherence to `SUTRAM_MEMBRANE_ISOLATION` in `ext_update.js`.
