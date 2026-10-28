# ADR 0053: Git State Resolution, Autostash Pulls, and Multi-Repo Sweep Error Isolation

## Status
Accepted (2026-09-24)

## Context
When performing workspace-wide sweeps or pulling remote changes into tracked repositories, active merge or rebase conflicts previously forced users into an unguided state. Attempting a pull during an active rebase failed abruptly without offering structured `continue` or `abort` actions through the Developer OS interface.

Furthermore, executing global multi-repository sweeps (`_background_sweep_push`) failed entirely if a single repository encountered a non-fast-forward remote rejection or missing upstream tracking branch. Automated pushes also relied on hardcoded `HEAD` ref targets rather than dynamically resolving active local branch names.

## Decision
1. **Rebase & Merge State Resolution Gateway (`api_git_resolve_state`)**:
   - Implemented `pending_operation` inspection (`rebase` or `merge`) inside `api_git_status`.
   - Added worker `_background_resolve_state` (`resolve_state_task`) and REST endpoint `POST git/resolve_state` handling `continue` (injecting `GIT_EDITOR=true` for headless rebase continuation and `commit --no-edit` for merges) and `abort` (`rebase --abort` / `merge --abort`).
   - Registered `git-state-continue` and `git-state-abort` polymorphic actions on `repo` entities.
2. **Autostash Pull Strategy (`_background_git_pull`)**:
   - Appended `--autostash` to `git pull` execution arguments to automatically stash local uncommitted modifications during pull operations.
3. **Multi-Repo Sweep Error Isolation & Dynamic Upstream Pushing**:
   - Refactored `_background_sweep_push` to wrap per-repository operations in isolated try-except blocks, checking for staged files before committing and logging individual repo statuses (`✅`, `⚠️`, `❌`).
   - Replaced hardcoded `origin HEAD` push targets with dynamic branch resolution (`curr_branch = git branch --show-current`) across sweep, push, and remote setup workers.

## Consequences
* **Positive**: Enables full headless rebase and merge conflict resolution directly within the UI.
* **Positive**: Prevents global multi-repo workspace sweeps from crashing when individual repositories require pull reconciliation.
* **Positive**: Autostash pulls protect local working tree changes during remote syncs.
* **Negative**: Rebase continuation requires clean conflict staging prior to executing `continue`.