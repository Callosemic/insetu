# ADR 0081: Reactive Relational Watermark Derivation, MCP Stdio CLI Bridge, AST Refactoring Directives, and Reboot Resilience

## Status
Accepted (2026-10-27)

## Context
As the inSetu Developer OS stabilized its Three-Tier Architecture and multi-tenant workspace state synchronization, several operational and protocol boundaries required structural refinement:
1. **Imperative Dirty Set Desynchronization**: Previously, context staleness was managed imperatively by having event bus listeners (`topology_resolved`, `compile-step-complete`) push and delete target identifiers into `dirtyBuckets` and `dirtyRepos`. If an SSE event dropped or a compilation chain aborted mid-flight, UI context cards remained permanently marked dirty or falsely cleared, causing UI state divergence.
2. **External MCP Transport Ceiling**: While ADR 0080 implemented the MCP 2025-03-26 JSON-RPC HTTP server, external agent harnesses (such as Claude Desktop or Cursor CLI) standardly communicate via stdio subprocess streams rather than raw HTTP network calls.
3. **AST Refactoring Protocol Integration**: Structural refactoring primitives (`bridge.ast_relocate`, `bridge.ast_rename`) were callable via in-process RPC (`ctx.call`), but Yomama patch text streams lacked native block syntax for declaring symbol relocations and renames in composite patch payloads.
4. **Daemon Reboot Token Desynchronization**: Triggering an in-place daemon reboot or extension installation restart caused immediate client-side polling failures. When client loops polled `/` or `/auth/bootstrap`, transient 5xx or connection drops caused spurious 401 redirect loops.
5. **In-Memory Buffer Projection Redundant Network Fetches**: Projections rendering ephemeral virtual buffers (`yomama://`, `virtual://`) issued redundant HTTP GET requests to `/fs/fetch` during initialization, generating console network errors.

## Decision
1. **Reactive Relational Watermark Derivation (`store.js`, `fs.js`, `api.js`, `system.js`)**:
   - Replaced imperative dirty-set mutations with pure reactive watermark derivation in `AppStore.subscribe`. The store derives `dirtyBuckets` and `dirtyRepos` by comparing physical `vfs` bucket timestamps (`source_ts`) against compiled `ctx` artifact timestamps (`meta.timestamp`).
   - Enhanced `updateManifestState` in `fs.js` to stamp `source_ts = Date.now() / 1000` on affected VFS buckets upon both save and delete mutations.
   - Purged the imperative `insetu:compile-step-complete` listener from `store.js`.
   - Streamlined the `topology_resolved` SSE listener to dispatch `refreshManifest()` when dirty targets exist, letting reactive store derivations settle state deterministically.
2. **Model Context Protocol (MCP 2025-03-26) Stdio Bridge & Core Classification (`cli_commands.py`, `utils_core.py`, `api.js`, `insetu_sdk.js`)**:
   - Added `handle_mcp_stdio()` to `cli_commands.py` providing bidirectional JSON-RPC 2.0 stdio streaming for `insetu mcp`.
   - Implemented `_acquire_local_boot_token()` to authenticate localhost handshakes with `/auth/bootstrap`, proxying stdio requests to the running daemon (`POST /api/<ws>/mcp`) with `X-InSetu-Token` and `X-Workspace-ID` headers, with fallback to headless in-process execution via `handle_mcp_jsonrpc` when the daemon is offline.
   - Classified `'mcp'` as an authoritative core engine across `CORE_MODULES_TUPLE` (`utils_core.py`), `CORE_MODULES` (`insetu_sdk.js`), and the API client core whitelist (`api.js`).
3. **Yomama Block Parser AST Refactoring Directives (`utils_core.py`)**:
   - Enhanced `parse_blocks()` to recognize and parse `<<<<<<< RELOCATE` and `<<<<<<< RENAME` directive blocks terminated by `>>>>>>> EXECUTE`.
   - Implemented `_parse_kv_directive_lines()` extracting directive parameters (`SYMBOL`, `FROM`, `TO`, `SCOPE`, `TARGET`, `REPLACE_WITH`).
   - Normalized target filepaths using `InSetuURI.from_external_input()` and injected backward-compatible `search: ""` and `replace: ""` envelope keys.
4. **Resilient Daemon Reboot Polling & Auth Handshake Retries (`system.js`, `config.js`, `ui_system_settings.js`)**:
   - Hardened `executeSecurityHandshake()` in `system.js` with a 6-attempt retry loop (600ms pauses, 2500ms timeout) for `/auth/bootstrap?t=...` with `cache: 'no-store'`, preventing false failures during in-place `os.execv` daemon reboots.
   - Added automated redirect handling for recovery mode (`data.status === 'recovery'`) and synchronized tokens to `sessionStorage` and `localStorage`.
   - Upgraded `_pollUntilDaemonReady` in `config.js` to hit `/auth/bootstrap?t=...` via POST with timeout handling, and exposed it as `window.inSetu.sys.waitForDaemonReboot`.
   - Replaced fixed `setTimeout(..., 2000)` reloads in `ui_system_settings.js` and `insetu_sdk.js` with `window.inSetu.sys.waitForDaemonReboot()`.
5. **In-Memory Virtual Buffer Projection Fast-Path (`fs.js`)**:
   - Added fast-path hydration in `_ensureBufferLoaded()` for in-memory virtual schemes (`yomama://`, `virtual://`), reading directly from `activeBuffers` without issuing extraneous network fetches.
   - Enforced `flex: 1; min-height: 0;` on `InSetuEditorProjection` `:host` styles to ensure full container growth across multi-column spatial grid viewports.
6. **SDK Membrane Cleanups & Legacy Style Purge (`sdk/__init__.py`, `insetu_sdk.js`, `shared_styles.js`)**:
   - Re-exported `set_tenant_resolver` and `resolve_active_tenant` through the `insetu.core.sdk` membrane.
   - Exported `get manifest()` accessor on `InSetuElement`.
   - Added `load_yaml_string(raw_yaml)` helper in `utils_core.py`.
   - Deleted obsolete file `insetu/core/system/shared_styles.js`.

## Consequences
* **Positive**: Absolute mathematical determinism for context staleness via reactive CQRS watermark derivation.
* **Positive**: Native stdio integration for external MCP clients (Claude Desktop, Cursor) with automatic token management.
* **Positive**: Reversible AST relocation and renaming declarations directly in Yomama patch blocks.
* **Positive**: Zero authentication drops or reload failures during in-place daemon reboots.
* **Positive**: Streamlined virtual buffer projection rendering and full container viewport sizing.