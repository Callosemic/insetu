# ADR 0043: Client Offline Provider, Service Worker Core, SutramDB Integration, and Core Offline Engine

## Status
Accepted (2026-09-04)

## Context
ADR 0008 established the theoretical framework for offline-first synchronization using an IndexedDB mutation queue and Service Worker[span_6](start_span)[span_6](end_span). However, client-side REST interactions lacked a standardized network gateway capability to seamlessly intercept outbound requests, queue mutations when offline, and cache read-only GET payloads while maintaining Unidirectional Data Flow (UDF)[span_7](start_span)[span_7](end_span). Furthermore, network drops during boot caused unhandled fetch rejections and blocked the UI shell[span_8](start_span)[span_8](end_span).

## Decision
1. **`OfflineHttpProvider` & `SutramDB` Gateway Integration (`api.js`):** Wrapped `window.inSetu.api.request` with `OfflineHttpProvider` and `SutramDB` from the Sutram micro-kernel[span_9](start_span)[span_9](end_span). GET requests employ a Stale-While-Revalidate caching pattern, while POST/PUT/DELETE mutations are written to an IndexedDB outbox queue with optimistic UI updates[span_10](start_span)[span_10](end_span).
2. **Service Worker Core Vendorization (`sw-core.js`, `sw.js`):** Refactored `sw.js` to define static `HOST_ASSETS` and `HOST_BYPASS_PATTERNS`, delegating cache management and fetch interception to vendorized `sw-core.js`[span_11](start_span)[span_11](end_span). Added first-install cache warming for dynamically imported ES modules[span_12](start_span)[span_12](end_span).
3. **Declarative `offline_mode` Contract:** Extensions declare an `offline_mode` attribute in `ExtensionRegistry` (`"full"`, `"read_only"`, or `"none"`)[span_13](start_span)[span_13](end_span). The API gateway evaluates this flag to determine whether offline mutations are enqueued or rejected[span_14](start_span)[span_14](end_span).
4. **Core Offline Engine & Telemetry UI (`offline_ui.js`):** Built a dedicated Tier 2 core extension providing `OfflineStore` and UI components (`InSetuCoreOfflineLedger`, `InSetuCoreOfflineSettings`, `InSetuCoreOfflineLog`) to inspect outbox mutations, manage per-repo offline capability toggles, pre-cache repositories, and view real-time telemetry logs[span_15](start_span)[span_15](end_span). Connected outbox tracking to UI elements (e.g. rendering '🌩️' icons for files with pending outbox mutations)[span_16](start_span)[span_16](end_span).
5. **Offline Boot Hydration & In-DOM Security Gate (`app.js`):** Configured `executeBootSequence()` to hydrate workspace topologies, configurations, and manifests from `localStorage` during offline sessions[span_17](start_span)[span_17](end_span). Replaced native browser `prompt()` dialogs with an in-DOM HTML modal during 401 security challenges and enabled fast-track offline authentication against cached `localStorage` tokens[span_18](start_span)[span_18](end_span).

## Consequences
* **Positive:** Full offline-first resilience for supported extensions without blocking the UI or losing uncommitted edits[span_19](start_span)[span_19](end_span).
* **Positive:** Complete visibility into IndexedDB outbox queues, dead-letter queues, and network telemetry[span_20](start_span)[span_20](end_span).
* **Positive:** Deterministic, zero-data-loss outbox draining upon network reconnection via `OutboxReconciler.drain()`[span_21](start_span)[span_21](end_span).
* **Negative:** Extensions must explicitly declare their `offline_mode` intent to participate in offline queueing[span_22](start_span)[span_22](end_span).