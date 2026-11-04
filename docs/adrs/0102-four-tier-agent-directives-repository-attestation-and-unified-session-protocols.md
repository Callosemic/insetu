# ADR 0102: Four-Tier Agent Directives, Repository Attestation Acceptance, and Unified Session Protocols

## Status
Accepted (2026-11-04)

## Context
As the inSetu Developer OS transitioned to landmark-driven autonomous routines and multi-repository workflows (P13), several governance and prompt engineering seams required structural consolidation:
1. **Per-Repository Wrapper Drift**: Session initialization and closeout protocols (`session-start-base.md`, `housekeeping-base.md`) were previously wrapped once per repository with hardcoded parameters, leading to path divergence, outdated references, and inconsistent standards discovery.
2. **Untrusted Repository Directives**: Directives committed inside a repository (`agent.md`) represent untrusted repository content. Ingesting them into model prompt context without human consent allowed an untrusted repository or malicious commit to speak to the LLM with the operator's authority or bypass safety rules.
3. **Ambiguous Precedence Order**: Directives lacked a formal hierarchy defining how personal rules, workspace rules, and repository-specific rules combine when instructions conflict.
4. **VFS Modification Vulnerability**: Directive files were vulnerable to unconfirmed modification by autonomous agent loops, routines, or external MCP tools without explicit human confirmation.
5. **Special-Cased Command Approvals**: Test command approvals relied on dedicated helper functions (`approve_test_command`) rather than a unified command attestation mechanism.

## Decision
1. **Four-Tier Agent Directives Architecture (`insetu/core/directives.py`)**:
   - Implemented `get_directives(ctx, repo)` reading the Markdown body of `agent.md` across four tiers ordered from least to most authoritative:
     1. Directives suggested by the `<repo>` repository (`vfs://<repo>/.insetu-data/settings/agent.md`, labeled as repository content)
     2. Your directives (`ctx://settings/.templates/user/agent.md`)
     3. Workspace directives (`ctx://settings/agent.md`)
     4. Local repository directives (`vfs://<repo>/.insetu-data/settings.local/agent.md`, git-ignored)
   - Stated the architectural precedence rule: directive sections run from least to most authoritative, with later sections winning on conflict.
   - Enforced frontmatter refusal on user and workspace tiers, ensuring settings fields remain in JSON until Phase 6 while reading only the Markdown body.
2. **Human Attestation Acceptance Gate for Repository Directives (`engine_system.py`, `attestations.py`)**:
   - Shared repository directives are treated as untrusted configuration and excluded from prompt context (`sys.directives`) until reviewed and accepted by a human.
   - Implemented human-only routes `system/directives/accept` and `system/directives/revoke` (`mcp_expose=False`, routine-banned).
   - `system/directives/accept` records an attestation of kind `repo_directive` bound to the SHA-256 digest of the reviewed text, returning HTTP 409 Conflict if the file on disk diverges from what was reviewed.
   - Modifications on disk (e.g. from `git pull`) invalidate the grant immediately, dropping the shared tier from prompts until re-accepted.
   - Added `system/directives` read endpoint returning tier texts, acceptance states, and accepted body diffs.
3. **Protected VFS Directive Targets (`sdk/__init__.py`)**:
   - Added all four directive documents to `INSETU_PROTECTED_VFS_TARGETS`.
   - Machine-originated mutations (from agent routines, MCP, or the bridge) return HTTP 202 `{"status": "pending_confirmation"}` and stage into `.insetu/pending_changes/`.
   - Human editor saves originating from the UI (`origin: "ui"`, `SOURCE_KEY: EDITOR_SOURCE`) bypass pending holds and commit directly with audit logging.
4. **Settings Hub Directives Panel (`ui_system_settings.js`)**:
   - Integrated collapsible 4-tier Directives section within the Agent settings hub.
   - Surfaces "Not in prompts until you accept" badges for unaccepted shared directives, with instant Accept, Revoke, and Save actions.
   - Integrated side-by-side diff modal using `<sutram-diff-viewer>` embedded in `<sutram-view ?flush ?noScroll>` to inspect changes against previously accepted text.
5. **Unified Landmark-Driven Session Protocols**:
   - Refactored `start_session_protocol.md` and `close_session_protocol.md` to consume dynamic repository landmarks (`sys.repo_name`, `sys.repo_title`, `sys.contract_stack`, `sys.adr_dir`, `sys.standards_doc`, `sys.tracker_dir`, `sys.tracker_closed_dir`, `sys.hardening_target`) and inject `{{ sys.directives }}`.
   - Replaced `close_session_tickets.md` with `housekeeping_tracker_phase.md`.
   - Created `vfs://insetu/.insetu-data/settings/agent.md` containing inSetu's sovereign repository directives.
6. **Substrate & Framework Hardening**:
   - Consolidated test command approvals into `approve_command(workspace_id, "test", repo, command)` and removed legacy `approve_test_command` / `get_approved_test_commands` from `utils_core.py`.
   - Enhanced `InSetuExtension` declarative volume mounting with `domain` specification (`vol_spec.get("domain") or self.name`), migrating `settings` to `.insetu/data/settings/` with automated legacy migration from `data/system/`.
   - Hardened `reset_kernel_state` to clear `_mounted_workspaces` across all registered extension instances.

## Consequences
* **Positive**: Complete elimination of drifted per-repository session wrappers in favor of dynamic landmark-driven templates.
* **Positive**: Cryptographic protection ensuring untrusted repository directives never enter prompt context without verified human attestation.
* **Positive**: S8 protection guarantees machine agents cannot rewrite their own governance or local directives without human confirmation.
* **Positive**: Intuitive 4-tier precedence cascade aligning with developer expectations (local repository rules override workspace, user, and shared rules).
* **Positive**: Generalized command approvals and custom volume domains simplifying substrate code.
