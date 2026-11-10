---
title: "Plan: Pluggable SutramBackendAdapter Contract & Akasa Transport Unification"
description: "Formalize the symmetric Backend Adapter interface in Sutram (mirroring SutramUIAdapter on the chassis edge), ship AkasaBackendAdapter as the canonical reference adapter, and eliminate unauthenticated raw fetch leaks and bespoke plumbing in host apps."
status: "planned"
repo: insetu
created_at: "2026-11-09"
coordinates_with:
  - "2026-11-02-decomposing-god-objects-across-the-triad.md"
  - "2026-11-05-core-extension-sdk-abstractions.md"
tags: [plan, triad, sutram, akasa, adapter, offline, auth, transport]
---

# Plan: Pluggable `SutramBackendAdapter` Contract & Akasa Transport Unification

## 1. Architectural Vision: The Symmetric 4-Layer Stack

With `SutramUIAdapter` (`sutram/js/primitives.js`) already decoupling presentation primitives (`yenVUI`) on the bottom edge, formalizing `SutramBackendAdapter` (`sutram/js/client.js`) on the top edge completes `sutram` as a true, standalone Layer 2 Micro-Kernel that can pair with any backend or any UI chassis:

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Host Application & Domain Extensions (inSetu, or any new App)    │
│   • Declares domain extensions, stores, and domain-specific cache rules   │
├───────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Sutram Micro-Kernel (State, Spatial Layout, Offline & Job Bus)   │
│   • Consumes Backend via validateBackendAdapter(adapter)                  │
│   • Consumes UI Chassis via validateChassisContract(chassis)              │
├─────────────────────────────────────┬─────────────────────────────────────┤
│ Top Adapter: SutramBackendAdapter   │ Bottom Adapter: SutramUIAdapter     │
│   • AkasaBackendAdapter (Reference) │   • yenVUI Chassis (Reference)      │
│   • RestBackendAdapter / Custom     │   • Custom Web Component Chassis    │
├─────────────────────────────────────┴─────────────────────────────────────┤
│ Layer 1: Physical Substrates (Akasa Python Kernel / Browser DOM & IDB)    │
└───────────────────────────────────────────────────────────────────────────┘
```

### Architectural Combinatorics Enabled
1. **`akasa` + `sutram` + Custom Domain Modules (New Non-`inSetu` Apps):** Mount `AkasaBackendAdapter` in 10 lines of configuration to get token bootstrap, multi-tenant workspace switching, offline IndexedDB caching, outbox reconciliation, SSE live telemetry, `202 Accepted` background job polling, and Service Worker build-cache warming out of the box.
2. **Non-`akasa` Backend + `sutram` (Cloud Run, FastAPI, Supabase, or Local-Only IndexedDB):** Swap `AkasaBackendAdapter` for a custom `SutramBackendAdapter` implementation without changing a single line of `sutram` stores, components, or offline outbox logic.
3. **`akasa` + Non-`sutram` Frontend (CLI, TUI, Native Mobile, or React):** Consume `akasa`'s self-contained HTTP/SSE wire protocol (`POST /auth/bootstrap`, `X-Akasa-Build-ID`, `/api/<scope>/<ext>/<verb>`, and `/api/system/stream`).

### Immediate Bugs & Technical Debt Eliminated
1. **Eliminates Unauthenticated `fetch()` Leaks (`401 Unauthorized` on `/api/system/build_id` & `NetworkHysteresisManager`):** `sutram/js/offline.js` (`OfflineHttpProvider`, `NetworkHysteresisManager`, `ensureSutramAppShellCached`, `SutramCacheWarmer`) never calls bare `window.fetch` against backend URLs; all network I/O routes through the registered `SutramBackendAdapter.fetchRaw()` / `request()` membrane.
2. **Eliminates Extra Boot Round-Trips (`/api/system/build_id`):** `akasa` stamps `X-Akasa-Build-ID` on every response (including `POST /auth/bootstrap`), so `AkasaBackendAdapter` tracks build changes passively from response headers without polling a separate `/api/system/build_id` endpoint.
3. **Collapses ~350 Lines of Boilerplate in `insetu/core/system/api.js` and `system.js`:** `inSetu` configures `AkasaBackendAdapter` with its VFS `shouldCacheGet` policy instead of re-implementing token headers, 401 retry loops, job polling wrappers, and outbox drain loops.

---

## 2. The `SutramBackendAdapter` Interface Contract (`sutram/js/client.js`)

Mirroring `REQUIRED_CHASSIS_PRIMITIVES` and `validateChassisContract(chassisProvider)` in `sutram/js/primitives.js`, `sutram/js/client.js` defines `REQUIRED_BACKEND_ADAPTER_METHODS` and `validateBackendAdapter(adapter)`:

```javascript
export const REQUIRED_BACKEND_ADAPTER_METHODS = [
    'bootstrap',          // () => Promise<{ authenticated: boolean, token?: string, buildId?: string, recovery?: boolean }>
    'fetchRaw',           // (url, options, scopeId) => Promise<Response> (Injects auth/scope headers, handles 401 re-auth)
    'request',            // (url, options, scopeId) => Promise<Response> (Routes through OfflineHttpProvider + cache policy)
    'resolveScopedUrl',   // (path, scopeId) => string (e.g., `/api/${scopeId}/${cleanPath}`)
    'probeHealth',        // () => Promise<boolean> (Used by OfflineHttpProvider & NetworkHysteresisManager)
    'getBuildId',         // () => string | null (Latest build ID observed from bootstrap or response headers)
    'pollJob',            // (jobId, options, scopeId) => Promise<any> (202 Accepted job lifecycle)
    'connectStream',      // (handlers) => { disconnect() } (SSE / WebSocket real-time push stream)
];
```

### Reference Implementation 1: `AkasaBackendAdapter` (`sutram/js/client.js`)
Encapsulates the standard `akasa` kernel wire protocol so any `akasa` + `sutram` application works out of the box:
* **Auth & Header Membrane:** Manages `<namespace>_boot_token`, injects `X-Akasa-Token` (and configurable host alias `X-InSetu-Token`) + `X-Workspace-ID`, and performs single-flight `/auth/bootstrap` re-authentication on `401`.
* **Passive Build-ID Header Sniffing:** Reads `X-Akasa-Build-ID` (or host-configured `buildIdHeader`) from every `fetchRaw` response. When a new build ID is observed on a live response or `426` status, notifies `ensureSutramAppShellCached` / `onBuildMismatch`.
* **Unified Health Probe:** Implements `probeHealth()` using the authenticated transport, shared by both `OfflineHttpProvider` and `NetworkHysteresisManager` (eliminating unauthenticated `HEAD /api/system/openapi.json` probes).
* **Scoped Dispatch & Job Polling:** Maps `<module>/<verb>` to `/api/<scope>/<module>/<verb>`, handles `202 Accepted` `{ job_id }` responses via `createJobPoller`, and deduplicates progress updates when the SSE stream is connected.

### Reference Implementation 2: `RestBackendAdapter` (Template for Non-Akasa Backends)
* Demonstrates how `sutram` mounts against a generic Bearer-token REST API or a pure local IndexedDB backend with zero `akasa` conventions.

---

## 3. Phased Implementation Sprints

### Sprint 1: `akasa` Kernel Build-ID Header & Bootstrap Envelope (`akasa`)
- [ ] [S1.T1] Stamp `X-Akasa-Build-ID` in `akasa` `@app.after_request` & `/auth/bootstrap` (`vfs://akasa/akasa/__init__.py`):
  - Generate a deterministic boot/build identifier on kernel initialization (`os.environ.get("AKASA_BUILD_ID") or os.environ.get("INSETU_BUILD_ID") or str(int(time.time()))`).
  - Attach `X-Akasa-Build-ID` (and `X-InSetu-Build-ID` when configured) to all HTTP responses in `@app.after_request` and include `"build_id"` in the `POST /auth/bootstrap` JSON response.
  - Expose `Access-Control-Expose-Headers: X-Akasa-Build-ID, X-InSetu-Build-ID`.

### Sprint 2: `SutramBackendAdapter` & Offline Transport Unification (`sutram`)
- [ ] [S2.T1] Upgrade `vfs://sutram/sutram/js/client.js` with `SutramBackendAdapter`, `validateBackendAdapter`, and `AkasaBackendAdapter`:
  - Implement `validateBackendAdapter(adapter)` enforcing `REQUIRED_BACKEND_ADAPTER_METHODS`.
  - Implement `AkasaBackendAdapter` with configurable `namespace`, `tokenHeader`, `buildIdHeader`, `shouldCacheGet`, `isOfflineCapable`, and `isTenantAgnosticUrl`.
  - Expose `SutramKernel.registerBackendAdapter(adapter)` on `sutram_sdk.js` / `index.js`.
- [ ] [S2.T2] Route all `sutram/js/offline.js` network calls through the registered adapter (`vfs://sutram/sutram/js/offline.js`):
  - Update `OfflineHttpProvider`, `NetworkHysteresisManager`, `SutramCacheWarmer`, and `ensureSutramAppShellCached` to use the adapter's `fetchRaw` / `probeHealth` / `getBuildId()` instead of bare `window.fetch`.
  - In `ensureSutramAppShellCached`, read `adapter.getBuildId()` (or use `adapter.fetchRaw` when `serverBuildIdUrl` is configured) so it never makes an unauthenticated `fetch('/api/system/build_id')` call.

### Sprint 3: Migrate `inSetu` to `AkasaBackendAdapter` (`insetu`)
- [ ] [S3.T1] Refactor `vfs://insetu/insetu/core/system/api.js` and `system.js` to consume `AkasaBackendAdapter`:
  - Instantiate `AkasaBackendAdapter` in `api.js` with `inSetu`'s per-repository `offline_capable` predicate (`_shouldCacheGet`) and extension `offline_mode` policy.
  - Remove the redundant `/api/system/build_id` route and `serverBuildIdUrl: '/api/system/build_id'` option from `system.js`, relying on the `build_id` returned by `/auth/bootstrap` and the `X-InSetu-Build-ID` response header.

### Sprint 4: Verification & Stack-Wide Enforcement Tests
- [ ] [S4.T1] Static AST Fitness Rule (`RAW_FETCH_OUTSIDE_ADAPTER_BAN`):
  - In `sutram/tests/fitness_functions.py` and `insetu/tests/fitness/rules_javascript.py`, ban raw `fetch(...)` calls outside `sutram/js/client.js`, `sutram/js/sw-core.js`, and explicit recovery/test harnesses.
- [ ] [S4.T2] Contract & Swappability Unit Tests (`sutram/tests/test_backend_adapter.mjs` & `insetu/tests/unit/test_transport_contract.py`):
  1. Verify `validateBackendAdapter` rejects incomplete adapters and accepts both `AkasaBackendAdapter` and a mock non-Akasa `RestBackendAdapter`.
  2. Verify `NetworkHysteresisManager`, `OfflineHttpProvider`, and `ensureSutramAppShellCached` never invoke unauthenticated `window.fetch` and always attach the adapter's auth headers.
  3. Verify `akasa` includes `build_id` on `/auth/bootstrap` and `X-Akasa-Build-ID` on authenticated responses, resulting in zero `401` errors during cold boot, offline warm-up, and reconnection.
