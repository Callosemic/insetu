---
status: "completed"
---
# Plan: S8 Confirmed Protected Changes, One Attestation Store, Smoke Test, Last-Good Lifeboat

## Context

S8's first half shipped in insetu 0.29.2: the lifeboat is gated, Host-checked and confined. What is left is changing protected files safely.

- Today `register_protected_vfs_targets` refuses every write to `insetu/cli.py`, `insetu/fallback_bridge.py` and `akasa/auth/credentials.py`. That includes a person's own Files-editor save, so these files can only be changed by hand or through the lifeboat.
- Human approvals live in three places with three shapes: `host.json` holds command approvals and workspace-extension approvals, and preview LAN leases live in memory.
- P13 Sprint 3 (repository directives) needs the same "a person confirms this" step.

Decisions already made (roadmap, Decisions):
- A write to a protected file from any source is held as a pending diff.
- A person confirms it in a separate step, through a human-only route.
- The confirmation names the pending change and the hash of the file it would produce.
- Every confirmation is logged. (The earlier "pending changes expire" was dropped on 2026-11-03: they wait until a person looks at them.)
- Agents, routines and MCP clients can propose but never confirm.
- One attestation store for every human approval.

Known limit, stated in the standards: an approved shell command runs as the user and could call the confirm route itself. This keeps insetu's own surfaces honest; it is not a sandbox.

## Target

1. **Attestation store** (insetu): one record type for every grant a person makes that stays in force, for good or for a time.
   - Location: `.insetu/attestations.json`, one file, in the control directory. It is protected (a bridge control-plane name and a protected VFS target), so only the human-only routes write it.
   - Record: `{id, kind, subject, digest, approved_at, approved_by, expires_at, run_id, detail}`.
     - `digest` ties the grant to exactly what the person saw, so it lapses when that changes: a command's text, an extension's fingerprint, a lease's launch command and port.
     - `expires_at` is `null` for standing grants or a time for timed grants; `run_id` is set to the daemon run id for "until this run ends".
   - Kinds: `command` (test and preview commands), `workspace_extension`, `lan_lease`, and later `repo_directive` (P13).
   - One-shot confirmations (a confirmed protected change) are events, not standing grants, so they go to the audit log, not the store.
   - `approved_by` records how the person was reached: transport, client address, user agent, and the device id once S6 lands. Today there is one shared session token, so this identifies the session, not the person.
   - One-time migration moves `approved_test_commands`, `approved_workspace_extensions` and `approved_hooks` out of `host.json` on the first read of the store, and removes those keys from `host.json` in the same step. It is idempotent, so older installs upgrade whenever they first start.
   - Helpers replace today's pairs: `attest(kind, subject, digest, detail, expires_at=None)`, `is_attested(kind, subject, digest)`, `revoke(kind, subject)`, `list_attestations(kind=None)`.
     - `is_attested` treats an expired record as absent.
     - Boot prunes expired records and run-scoped ones from an earlier run.
   - **LAN leases move in.** The preview extension stops keeping leases in memory and asks the store instead.
     - "For this run" is a lease bound to the daemon run id. It ends when the server stops or restarts, or the daemon exits, and boot prunes it.
     - A timed lease survives a daemon restart for its remaining time, because the person granted that time. The preview timer only schedules the switch back to loopback at `expires_at`.
     - The digest covers the launch mode, entry, served folder and port, so a lease lapses if any of them changes.
2. **Pending protected changes**:
   - akasa gains a host hook: `set_protected_write_handler(fn)`. When a write, move or delete hits a protected target, akasa calls the handler instead of refusing; with no handler it refuses as today. akasa stays host-neutral, and the handler returns the HTTP-style result the VFS passes back.
   - akasa's execution frame gains an explicit `origin`: `ui`, `mcp`, `routine`, `agent` or `worker`.
     - The dispatchers set it: the MCP gateway, the routine runner, agent tool calls and the job workers. A plain HTTP request from the app is `ui`.
     - The handler decides by origin, never by guessing from the transport. The audit log records the same origin.
   - akasa also gains a privileged write, `execute_confirmed_protected_write(workspace_id, path, content | None)`, for the host's confirm path only. It bypasses the protected check and nothing else (confinement and the write queue still apply).
   - insetu's handler stages the change in `.insetu/pending_changes/<id>.json`:
     - the path;
     - the hash of the current file and the hash of the result;
     - the new content, or a delete;
     - who proposed it (origin, and the cell or routine id when there is one);
     - when it was created.
   - It answers `202 {"status": "pending_confirmation", "change_id"}`. The bridge shows the patch as "waiting for your confirmation" instead of failed.
   - Pending changes do not expire. They wait until you confirm or discard them. A confirm still checks that the file has not changed since the proposal.
   - **Your own Files-editor saves (`ui` origin) are not held.**
     - The editor shows a warning banner on protected files.
     - A save writes directly, after the same smoke test, last-good copy and audit entry a confirmed change gets.
     - Any other origin, including MCP calls to the same fs save capability, is held as pending.
3. **Confirm, discard and list routes**: `system/protected/pending` (GET), `system/protected/confirm` (POST) and `system/protected/discard` (POST).
   - Confirm and discard are human-only: `mcp_expose=False` and banned in routines.
   - Confirm takes `{change_id, result_hash}` and refuses when any of these hold:
     - the file's current hash no longer matches the hash when it was proposed;
     - `result_hash` is not the hash the person was shown;
     - the smoke test fails.
   - On success it:
     1. saves the last-good copy (recovery files);
     2. writes through the privileged path;
     3. appends to the audit log.
4. **Review UI**: a banner like the workspace-extension banner ("N protected changes waiting"). It opens a modal with `sutram-diff-viewer` for each change and Confirm and Discard buttons. Confirm sends the `result_hash` the modal rendered.
5. **Smoke test before confirm**: the new content is written to a temporary copy and checked in a subprocess. Nothing is written if the check fails, and the error is shown.
   - `fallback_bridge.py`: import it by path and build its Flask app. A small `insetu/recovery_check.py` ships with the package so CI and pip installs run the same check.
   - `cli.py`: import it by path and run `main()` with `--help`.
   - `credentials.py`: import it by path, then round-trip `load_or_create_token` and `verify_token` in a temporary directory.
6. **Last-good lifeboat**: before a confirmed write to `fallback_bridge.py` or `credentials.py`, the current file is copied to `.insetu/recovery/last_good/`.
   - The panic path in `cli.py` first imports the current lifeboat. If that fails, it loads the last-good copy by path.
   - `cli.py` itself has no fallback (it is the entry point), so its smoke test is the guard.
7. **Audit log**: `.insetu/audit/protected_changes.jsonl`, append-only. One line per proposal, confirmation, direct `ui` save, discard and failed smoke test, with hashes and origin. It is a protected target, and a fitness rule allows only the audit helper to write it.
8. **`insetu auth rotate`**: a CLI command that calls `credentials.rotate_token`, prints the new token once and warns that every device must sign in again. It is the first change to `cli.py` made through the new confirm flow.

## Sprints

| # | Repo | Work | Done when |
|---|------|------|-----------|
| 1 | akasa (0.8.0, `feat`) | `set_protected_write_handler`, `execute_confirmed_protected_write`, execution-frame `origin`; save, move and delete all consult the handler | Tests: no handler still refuses; a handler's result is returned and sees the origin; the privileged write still enforces confinement; standards and contracts docs updated |
| 2 | insetu | Attestation store with expiry, `host.json` migration; command and workspace-extension approvals and LAN leases moved onto it; dispatchers set `origin`; pin `akasa>=0.8.0,<0.9` | Existing approval and preview-lease tests pass; a migration test upgrades a 0.32 `host.json` and keeps every approval; a timed lease survives a restart and lapses on time; a run lease ends with the run; `attestations.json` is refused to the bridge and the VFS |
| 3 | insetu | Pending changes, confirm, discard and list routes, review banner and modal, Files-editor warning banner, bridge integration, audit log | Tests: an agent bridge patch and an MCP fs save to `fallback_bridge.py` both become pending; a `ui` editor save writes directly after the smoke test and is audited; an MCP or routine confirm is refused; a confirm with a stale base hash or a different result hash is refused; every step is in the audit log |
| 4 | insetu | Smoke tests, last-good copy and panic fallback, `insetu auth rotate` | Tests: a change that breaks the lifeboat's import is refused at confirm; emptying the current lifeboat still boots the last-good copy; `auth rotate` invalidates the old token |

P13 Sprint 3 then adds the `repo_directive` kind and registers directive files as protected targets. It needs no new mechanism.

## Decisions (2026-11-03)

1. Pending changes do not expire; they wait until you look at them.
2. Files-editor saves stay open, because that editor is human-only. They get a warning banner, plus the smoke test, last-good copy and audit entry.
3. LAN leases move into the attestation store as timed or run-scoped grants. The store holds every standing or timed grant; one-shot confirmations go to the audit log.
4. Use one `attestations.json` for now, and split it later only if needed.
5. Until Sprint 4, Files-editor saves of protected files stay refused (decided 2026-11-03). Sprint 3 opens protected files read-only in the editor with a warning banner; Sprint 4 turns direct saves on with the smoke test, the last-good copy and the audit entry.

## Progress

- **Sprint 1 (akasa 0.8.0): built, not released.** The protected-write handler, the confirmed write and the execution-frame origin (ADR 0014). Confirmed deletes go through the save path with `action="delete"`, so absolute artifacts resolve the same way as saves.
- **Sprint 2 (insetu): built, not released.** `insetu/core/attestations.py` holds command, workspace-extension and hook approvals and LAN leases; the MCP gateway and the routine runner set their origins; `akasa>=0.8.0,<0.9`.
  - Found while doing it: hook rules could approve themselves. `hooks.save` was reachable over MCP and recorded the approval as it saved, and the hook runner never checked approval when it ran. Now saving and enabling a rule are human-only (hidden from MCP, banned in routines), the approval goes through `attest`, and the runner and the manual execute route check it before every run.
- **Sprint 3 (insetu, plus two akasa 0.8 additions): built, not released.**
  - akasa: `is_protected_vfs_target()` for hosts, and `VFSTransaction` hands a protected mutation to the handler at once instead of buffering it, so the caller sees the answer. It writes nothing, so atomicity holds; a proposal is not withdrawn if the transaction later fails.
  - insetu: `insetu/core/protected_changes.py` (the handler, the pending store, confirm and discard, the audit log); `system/protected/pending`, `confirm`, `discard`; `fs/protected`; the review banner and window; the Files editor's read-only banner; the bridge flags protected patches and reports them as pending; the `PROTECTED_WRITE_CHOKEPOINT` fitness rule.
  - The pending record count is sent over SSE (`protected_changes`) and in the topology payload. The bridge's old name-based ban on `cli.py` and `fallback_bridge.py` is gone: the kernel's protected list is the one source.
- **Sprint 4 (insetu): built, not released.**
  - `insetu/recovery_check.py` smoke-tests a new version of `cli.py`, `fallback_bridge.py` or `credentials.py` in a subprocess before any confirmed change or editor save is written. It compiles the source from stdin as if it were the real file, so nothing is written to run it.
  - Before the lifeboat or the credential store is replaced, the current version goes to `.insetu/recovery/last_good/` if it passes its own smoke test. `cli.py`'s panic path boots the last-good lifeboat when the current one will not import; the lifeboat loads the last-good credential store when the current one will not load.
  - Files-editor saves of protected files are written at once behind the same checks (decision 5's second half). The editor never autosaves or background-flushes them.
  - Recovery files cannot be deleted through the flow. `insetu auth rotate` replaces the session token.
  - The `cli.py` and `fallback_bridge.py` parts of this sprint arrive as pending changes through the bridge: the first changes to the recovery path made through the confirm flow.
- All four sprints are built. Release akasa 0.8.0 first, then insetu, and mark this plan done.
- P13 Sprint 3 is the next consumer: it adds the `repo_directive` acceptance and protects the directive documents (see `2026-10-30-repo-facts-and-directives.md`, 4.5).
