# ADR 0101: S8 Confirmed Protected Changes, Unified Attestation Store, Subprocess Recovery Smoke Testing, and Last-Good Lifeboat Fallbacks

## Status
Accepted (2026-11-03)

## Context
Under security milestone S8 ("A change to a protected file is held as a pending change until a person confirms it"), the Developer OS requires safe mutation and recovery guarantees for files on the core boot and recovery path (`insetu/cli.py`, `insetu/fallback_bridge.py`, `akasa/auth/credentials.py`):
1. **Unconditional Write Rejection**: Previously, `register_protected_vfs_targets` unconditionally refused every write, move, or delete targeting recovery files. This prevented developers from editing recovery files in the Files editor or applying patches without dropping into an external terminal or the Lifeboat.
2. **Fragmented Human Approvals**: Human grants were scattered across multiple disparate locations with varying semantics: `host.json` stored command approvals (`approved_test_commands`, `approved_hooks`) and workspace extension fingerprints (`approved_workspace_extensions`), while dev server preview LAN exposure leases were held ephemerally in process memory.
3. **Recovery Smoke Testing Void**: Staging or saving changes to `cli.py` or `fallback_bridge.py` lacked automated pre-commit execution verification. A syntax error, broken import, or indentation fault in `cli.py` or `fallback_bridge.py` could permanently brick daemon startup or disable the recovery fallback.
4. **Machine Self-Approval Hazards**: Prior to origin tracking, requests dispatched by LLM agents, declarative routine DAGs, or external MCP clients could invoke approval endpoints directly, bypassing human authorization gates.

## Decision
1. **Pending Protected Changes Pipeline (`insetu/core/protected_changes.py`)**:
   - Implemented `handle_protected_write(request)` registered via `akasa.vfs.set_protected_write_handler(install)`. Any save or delete targeting protected targets is staged in `.insetu/pending_changes/<id>.json` and answers HTTP 202 `{"status": "pending_confirmation", "change_id"}`.
   - Prohibits file moves, renames, and deletion of recovery files, and denies any mutation targeting inSetu internal control stores (`attestations.json`, `pending_changes/`, `audit/`, `recovery/`).
   - Exposed human-only endpoints (`mcp_expose=False`, routine-banned): `GET system/protected/pending`, `POST system/protected/confirm` (requiring `change_id` and verified `result_hash`), and `POST system/protected/discard`.
   - Maintained append-only audit logging in `.insetu/audit/protected_changes.jsonl`.
2. **Unified Attestation Store (`insetu/core/attestations.py`)**:
   - Consolidated standing and timed approvals into `.insetu/attestations.json` (`command`, `workspace_extension`, `lan_lease`, `repo_directive`).
   - Tied grants to SHA-256 content digests (`digest_of`), automatically invalidating permissions if commands, launch parameters, or files mutate.
   - Bound attestation generation strictly to human origins, rejecting machine origins (`mcp`, `routine`, `agent`) with `AttestationRefused`.
   - Executed an idempotent boot migration transferring legacy approvals from `host.json` into `attestations.json`.
   - Migrated dev server preview LAN exposure leases and automation hook approvals into `attestations.py`.
3. **Pre-Commit Subprocess Smoke Testing (`insetu/recovery_check.py`)**:
   - Built a zero-dependency standard-library smoke test runner checking candidate code from stdin in a temporary directory without modifying physical workspace files:
     - `cli`: verifies module imports and `insetu --help` exits cleanly with code 0.
     - `lifeboat`: verifies module imports, Flask app creation, `/` public route response, and credential token reading.
     - `credentials`: verifies token creation, round-trip reading, validation, and rotation.
4. **Last-Good Lifeboat and Credential Store Fallbacks (`insetu/cli.py`, `fallback_bridge.py`)**:
   - Prior to replacing `fallback_bridge.py` or `credentials.py`, the current version is validated via smoke test and copied to `.insetu/recovery/last_good/`.
   - Updated `cli.py` panic handler (`load_recovery_app`) to import from `.insetu/recovery/last_good/fallback_bridge.py` if the primary lifeboat fails to import.
   - Updated `fallback_bridge.py` to fall back to `.insetu/recovery/last_good/credentials.py` if the active credential store cannot load.
5. **Files Editor Direct Save & Warning Banner (`fs.js`, `engine_fs.py`, `ui_protected_changes.js`)**:
   - Direct saves originating from the Files editor (`origin: "ui"`, `SOURCE_KEY: EDITOR_SOURCE`) execute smoke tests and update last-good copies immediately without pending holds.
   - Editor projections display a warning banner on protected files and suppress autosave/background flush.
   - Built `<insetu-protected-changes-projection>` and `<insetu-config-banner>` notifications for interactive diff review and confirmation.
6. **CLI Session Token Rotation (`cli.py`, `cli_commands.py`)**:
   - Implemented `insetu auth rotate` invoking `akasa.auth.credentials.rotate_token`, generating a fresh session token and invalidating active sessions.
7. **Architectural Fitness Ratchet (`PROTECTED_WRITE_CHOKEPOINT`)**:
   - Codified `PROTECTED_WRITE_CHOKEPOINT` in `rules_python.py`, ensuring only `attestations.py` and `protected_changes.py` can call `execute_confirmed_protected_write`.

## Consequences
* **Positive**: Full recoverability and editability of core recovery files without bricking the operating system.
* **Positive**: Absolute consolidation of all standing human approvals into a single, digest-bound attestation store.
* **Positive**: Subprocess smoke testing guarantees uncompilable code cannot be written to recovery paths.
* **Positive**: Last-good lifeboat copies provide automated panic boot fallbacks if primary modules degrade.
* **Positive**: Deterministic origin tracking guarantees autonomous models and routines cannot self-approve privileged actions.
