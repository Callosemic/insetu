# 0003: Stateless Request-Scoped Multi-Tenant REST Routing

## Status
Accepted (2026-07-01)

## Context
Historically, switching project workspace contexts required forcing a hard process replacement via `os.execv` to re-read configurations. This process halted background metronome threads, blocked incoming client requests, and relied heavily on aggressive browser refreshes to wipe contaminated memory frames.

## Decision
We switch completely to request-scoped stateless routing across the entire REST API layer. The backend server process remains up indefinitely. The client interface captures the targeted tenant identity and dynamically appends it to all outbound transactions via the `X-Workspace-ID` HTTP header. 

## Consequences
* **DX Improvements:** Wipes out high-latency reboot loops, providing fluid, sub-second workspace transitions.
* **Security & Isolation Constraints:** Downstream VFS operations must remain vigilant in sniffing this token, ensuring paths are explicitly bounded to the active workspace folder to prevent cross-tenant directory traversal leaks.