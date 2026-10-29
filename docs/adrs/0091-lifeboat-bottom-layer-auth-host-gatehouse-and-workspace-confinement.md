# ADR 0091: Lifeboat Bottom-Layer Authentication, Host Gatehouse Verification, Panic Token Gating, and Workspace Confinement

## Status
Accepted (2026-10-29)

## Context
When the inSetu Developer OS encounters early boot errors or kernel panics, the system falls back to the zero-dependency Lifeboat Recovery OS (`fallback_bridge.py`). Because Tailscale Serve and local port forwarding expose the configured daemon port to remote devices, previous lifeboat iterations exhibited critical security vulnerabilities:
1. **Unauthenticated Public Recovery Surface**: The lifeboat historically listened on the bound port without enforcing authentication tokens, allowing anyone reaching the port over Tailnet or local networks to browse files, download source code, and apply arbitrary patches.
2. **Panic Route Exposure & Denial of Service**: The primary application shell exposed `/api/system/panic` as an unauthenticated public route, allowing unauthorized network callers to terminate the primary daemon and force the host into recovery mode.
3. **Public Suffix Gatehouse Bypass**: In `app.py`, allowing `.map` as a public suffix (`public_suffixes=(".map",)`) enabled callers to bypass the gatehouse on any parameterized endpoint where trailing segments were caller-controlled.
4. **Symlink Directory Traversal & Credential Leakage**: The lifeboat did not evaluate realpaths on file queries or patch targets, allowing symlinks within the workspace to read or overwrite files outside the project root, including the credential store (`.insetu/auth/session_token`).
5. **Traceback Exposure**: Kernel panic details containing system paths, environment strings, and stack traces were rendered directly into the unauthenticated `/recovery` HTML body.

## Decision
1. **Application Gatehouse Hardening (`app.py`, `test_route_auth_inventory.py`)**:
   - Gated `/api/system/panic` behind `X-InSetu-Token` authentication.
   - Purged `/sm/` and all `public_suffixes`, restricting public prefixes strictly to `/static/`.
   - Verified that every public route is cataloged and asserted in `test_route_auth_inventory.py`.
2. **Lifeboat Bottom-Layer Authentication (V4, S8) (`fallback_bridge.py`)**:
   - Integrated credential resolution loading `akasa/auth/credentials.py` by file path or reading `.insetu/auth/session_token`, ensuring the lifeboat shares the durable session token with the primary app.
   - Fallback token generation mints an isolated token (`.insetu/lifeboat_token`) with `0o600` permissions if no saved credential exists.
   - Enforced `@app.before_request def _lifeboat_gate()` verifying `X-InSetu-Token`, `X-Akasa-Token`, or `?token=` on `/download/`.
   - Implemented DNS rebinding protection via `_host_allowed()` validating requests against loopback, `*.ts.net`, and `allowed_hosts` from `host.json`, rejecting foreign hosts with HTTP 421 Misdirected Request.
3. **Symlink-Aware Workspace Confinement & Credential Isolation (`fallback_bridge.py`)**:
   - Built `_confine()` and updated `_resolve_patch_target()` using `os.path.realpath`, ensuring symlinks inside the workspace cannot escape into host file systems.
   - Strictly confined file reads (`/download`, `/api/fs/list`) and patch writes to authorized workspace roots and declared repository physical paths.
   - Enforced absolute write and read denial for the credential store (`.insetu/auth`), returning HTTP 403 Forbidden.
4. **Lifeboat UI Telemetry & Handshake Resilience (`fallback_bridge.py`)**:
   - Decoupled panic traceback strings from server-rendered HTML into an authenticated endpoint (`/api/system/panic_details`), preventing information leakage to unauthenticated observers.
   - Added interactive `#token-box` UI prompt allowing operators to supply tokens when accessing recovery consoles from fresh browser contexts.
   - Standardized client-side fetch calls on an authenticated `api()` helper.
   - Preserved tokens across `rebootOS()` cycles to prevent authentication dropouts during daemon handoffs.

## Consequences
* **Positive**: Complete bottom-layer security parity between the primary Developer OS and the Lifeboat Recovery OS.
* **Positive**: Eradication of unauthenticated panic denial-of-service vulnerabilities and public suffix gatehouse bypasses.
* **Positive**: Strict mathematical containment of all file reading and patch application within authorized workspace boundaries.
* **Positive**: Total protection of authentication session tokens and credential store files.
* **Negative**: Accessing the recovery console from an unrecognized browser or cleared cache requires pasting the session token from the host terminal.
