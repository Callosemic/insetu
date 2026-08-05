# Architecture Blueprint: Unified Telemetry & Structured Observability

**Date:** 2026-08-04  
**Status:** Proposed / Draft  
**Subsystems Impacted:** Backend Micro-Kernel, Frontend Chassis (`Sutram` / `inSetu`), Developer HUD (`ext_dev`)

---

## 1. Executive Summary & Problem Statement

As the inSetu OS and Sutram micro-kernel have evolved defensively, widespread `try/except` blocks, silent fallback returns, and component error boundaries have created diagnostic "black holes." While these mechanisms successfully protect the OS shell from fatal crashes, they obscure root causes, swallow async background errors, and complicate multi-tenant debugging.

This blueprint establishes a **Unified Telemetry & Observability Subsystem** designed to convert silent degradation into structured, non-blocking telemetry stream entries across the micro-kernel and frontend chassis.

---

## 2. The Unified Telemetry Envelope Contract

All backend Python engines and frontend JavaScript components publish errors to a shared telemetry schema.

```typescript
type TelemetrySeverity = 'info' | 'warning' | 'error' | 'fatal';

interface TelemetryEnvelope {
    id: string;               // Unique entry identifier (e.g., 'tel_8f3a9a12')
    timestamp: number;        // Epoch timestamp (ms)
    workspace_id: string;     // Active tenant workspace ID
    subsystem: string;        // 'vfs' | 'worker' | 'route' | 'ui_component' | 'bridge'
    module_name: string;      // e.g., 'ext_research' or 'engine_gather'
    severity: TelemetrySeverity;
    message: string;          // Concise human-readable summary
    details: string;          // Full stack trace or error payload
    context_meta: Record<string, unknown>; // Route parameters, active tab, target file paths
}

```

---

## 3. Ingestion Choke Points

```
┌───────────────────────────────────────────────────────────────────────────┐
│                        Unified Telemetry Pipeline                         │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                   ▼
┌───────────────────────────┐                       ┌───────────────────────────┐
│ Backend Kernel Ingestion  │                       │ Frontend Chassis Ingestion│
│ • Route Handlers          │                       │ • Lit Error Boundaries    │
│ • Worker Metronome        │                       │ • Network Gateway Interceptor│
│ • VFS Async Write Queue   │                       │ • Global Window Error Handler│
└───────────┬───────────────┘                       └───────────┬───────────────┘
            │                                                   │
            └─────────────────────────┬─────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       Dual-Sink Telemetry Ledger                          │
│  • SQLite Ring Buffer (WAL Mode, max 500 records or 48h TTL)             │
│  • Dev HUD Realtime Event Stream & One-Click LLM Debug Exporter           │
└───────────────────────────────────────────────────────────────────────────┘

```

### A. Backend Kernel Choke Points (Python)

1. **Extension Route Interceptor (`InSetuExtension.route`):** Wraps custom extension API handlers. Caught exceptions generate a `TelemetryEnvelope` before returning formatted HTTP 500 JSON payloads.
2. **Worker Metronome (`workers.py`):** Whenever an async background job transitions to status `'failed'`, the metronome emits a `telemetry_event` hook containing the Python traceback and arguments.
3. **VFS Commit Pipeline (`vfs.py`):** File write, move, or deletion failures in the async pipeline are trapped and written to the telemetry stream with target file paths and context.

### B. Frontend Chassis Choke Points (JavaScript)

1. **Component Error Boundaries (`SutramElement` / `InSetuElement`):** Uncaught rendering or lifecycle exceptions dispatch a `sutram-telemetry-event` populated with `extName` and `workspaceId`.
2. **Network Gateway (`window.inSetu.api`):** Intercepts non-OK responses (HTTP 4xx/5xx), network dropouts, and permission denials before returning fallback objects.

---

## 4. Storage & Developer HUD (`ext_dev`)

* **SQLite Ring Buffer:** Stored in `.insetu/telemetry.db` in WAL mode. Automatically pruned to a max cap of 500 entries or a 48-hour TTL to prevent disk inflation.
* **Live Diagnostic HUD:** Integrates into `<insetu-ext-dev-dash>`, providing filtering by subsystem and severity level.
* **One-Click LLM Context Exporter:** A dedicated button formats active file content, patch state, and telemetry stack traces into Markdown ready for LLM consumption.

---

## 5. Phased Implementation Roadmap

| Phase | Target Area | Key Deliverables |
| --- | --- | --- |
| **Phase 1** | Schema & Storage | Provision `telemetry.db` SQLite schema and `TelemetryEnvelope` types. |
| **Phase 2** | Kernel Ingestion | Instrument `workers.py`, `vfs.py`, and `InSetuExtension` route wrappers. |
| **Phase 3** | Client Ingestion | Wire `window.inSetu.api` and `SutramElement` error boundaries to the telemetry bus. |
| **Phase 4** | Dev HUD | Build live stream UI in `ext_dev` and the "Copy LLM Context" export feature. |
