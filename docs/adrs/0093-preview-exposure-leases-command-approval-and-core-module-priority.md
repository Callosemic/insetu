# ADR 0093: App Server Exposure Leases, Human-Only Custom Command Approval, Protected VFS Target Enforcement, and Core Module Priority Loading

## Status
Accepted (2026-10-30)

## Context
As the inSetu Developer OS deepened security guardrails across Tier 0 and Tier 2 substrates, several exposure and orchestration seams required structural hardening:
1. **Unconstrained Server Network Exposure (S2)**: Managed development servers in `engine_preview.py` previously bound `0.0.0.0` by default, exposing development applications, static file trees, and notebook environments directly to local area networks (LAN) without operator consent.
2. **Unauthenticated Code Execution Tools**: Reactive notebook profiles (such as `marimo`) were launched with `--no-token`, allowing anyone with network access to the port to execute arbitrary Python code.
3. **Static Server Path Traversal & Dotfile Exposure**: The embedded static HTTP server lacked symlink confinement and served hidden dotfiles (such as `.git/config` and `.env`), creating information disclosure risks.
4. **Un-Gated Custom Server Execution (P5)**: Launching servers in `custom` mode or supplying custom Hugo CLI arguments executed caller-supplied commands without verifying whether an operator had explicitly reviewed and approved the command string.
5. **Kernel Protected Target Omission**: While `INSETU_PROTECTED_VFS_TARGETS` was defined in the SDK, `app.py` did not pass it to `configure_kernel()`, leaving recovery path files (`cli.py`, `fallback_bridge.py`, `credentials.py`) vulnerable to accidental VFS overwrites.
6. **Core Module Discovery Non-Determinism**: `load_workspace_extensions()` iterated over `core_dir` in filesystem order without sorting, attempted to treat helper packages (`languages`) as blueprint extensions, and did not guarantee that foundational Tier 2 engines mounted before domain extensions.

## Decision
1. **Network Exposure Security & Timed LAN Leases (S2) (`engine_preview.py`, `ext_preview.js`)**:
   - Switched default `bind_host` to loopback (`127.0.0.1`) across settings schemas and launch handlers.
   - Binding to `0.0.0.0` is now restricted to explicit time-limited LAN leases (`preview.open_lan`) for `"run"`, `"15m"`, `"1h"`, or `"8h"`, backed by a `threading.Timer` (`_expire_lan_lease`) returning the server to loopback upon expiration.
   - Added `static_cors` setting (default `False`), preventing arbitrary web pages from performing cross-origin reads on served files unless explicitly enabled by an operator.
   - Hardened `_STATIC_SERVER_SCRIPT` with `NoCacheHandler`: rejected dotfiles (`.git`, `.env`) and paths outside the served root via symlink traversal with HTTP 404. Restricted default CORS methods to `GET, OPTIONS, HEAD`.
   - Enforced token authentication for notebook tools: launched `marimo` with `--token-password <access_token>` using cryptographically random 18-byte tokens.
2. **Human-Only Custom Command Approval (P5) (`engine_preview.py`, `ext_preview.js`)**:
   - Implemented `PreviewApprovalRequired` (HTTP 403) and command authorization verification (`is_command_approved`) for custom commands and Hugo arguments.
   - Added `preview.approve_command` and `preview.open_lan` endpoints marked with `mcp_expose=False` (human-only, banned from MCP and declarative agent routines).
   - Built UI exposure bar in `<insetu-ext-preview>`: renders approval prompts with "Approve & Start", active LAN lease banners with "Back to Loopback", and duration selectors.
   - Built remote viewer reachability detection (`_isLocalViewer`, `_isUnreachableHere`): displays an informative notification when a server binds loopback on a remote host, providing a one-click action to enable Tailscale HTTPS.
3. **Protected Recovery Targets & Core Module Priority Loading (`insetu/app.py`)**:
   - Passed `protected_vfs_targets=INSETU_PROTECTED_VFS_TARGETS` to `configure_kernel()`, ensuring recovery path files (`cli.py`, `fallback_bridge.py`, `credentials.py`) are protected against VFS mutation or import shadowing.
   - Hardened `load_workspace_extensions()`: sorted directory inspection, filtered non-blueprint packages (`sdk`, `languages`), sorted Python vendor dependencies, and prioritized Tier 2 Core Substrate DAG loading order (`priority_order`).

## Consequences
* **Positive**: Absolute loopback containment by default for all managed application servers.
* **Positive**: Time-bounded, revocable LAN exposure leases with automated background expiration.
* **Positive**: Total prevention of unauthorized custom command execution via cryptographic human approval gating.
* **Positive**: Protection of sensitive credentials and dotfiles against static server directory traversal.
* **Positive**: Guaranteed protection of recovery files against VFS write and import shadowing hazards.
* **Positive**: Deterministic, priority-ordered DAG mounting for Tier 2 core substrate engines.
