# ADR 0026: Unified Security Token Gatehouse & Tailscale Authentication

## Status
Accepted (2026-07-24)

## Context
When running inSetu as a local-first Developer OS across workstations and Tailscale mesh networks, the backend Python server listens on a local TCP port (`5005`). Unauthenticated REST paths leave the system vulnerable to Localhost Drive-By CSRF attacks from browser tabs and unauthorized network discovery when exposed via Tailscale Serve or local network addresses.

## Decision
We deploy a unified Security Token Gatehouse substrate:
1. **Unauthenticated Bootstrap Gate (`insetu/auth.py`)**: Expose `/auth/bootstrap` as the sole unauthenticated REST route.
2. **Dynamic Session Tokens**: Generate a cryptographically random session token (`BOOT_TOKEN`) anchored to `os.environ["INSETU_BOOT_TOKEN"]` at kernel startup to survive `os.execv` reloads.
3. **Multi-Stage Identity Handshake**:
   - **Localhost Bypass**: Automated authorization for direct `127.0.0.1` client requests.
   - **Tailscale Socket WHOIS**: Query `/var/run/tailscale/tailscaled.sock` Unix socket using the client IP to resolve Tailnet email identities, supporting Trust-On-First-Use (TOFU) email whitelisting.
   - **Static Config Token**: Fallback token verification matching `auth_token` in `config.json`.
4. **Global REST & WebSocket Interceptor (`app.py`)**: Intercept all incoming requests via `app.before_request`, validating `X-InSetu-Token` headers or `?token=` query parameters against `BOOT_TOKEN`.

## Consequences
* **Positive**: Immunizes local-first REST endpoints from CSRF attacks and unauthorized network access.
* **Positive**: Zero-config developer experience when connecting over Tailscale mesh networks or running locally.
* **Negative**: Requires browser clients to complete an explicit security handshake on startup before accessing REST endpoints.