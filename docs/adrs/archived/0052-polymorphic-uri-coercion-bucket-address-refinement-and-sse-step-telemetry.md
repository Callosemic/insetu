# ADR 0052: Polymorphic InSetuURI Coercion, BucketAddress SSOT Refinement, and Un-blocked SSE Step Telemetry

## Status
Accepted (2026-09-24)

## Context
As the Virtual File System (VFS) and Gather engines process diverse input payloads (strings, dicts with `filepath` or `folderpath` keys, `AkasaURI` instances, or pre-instantiated `InSetuURI` objects), code paths previously used manual conditional checks or rigid string splitting. This created property drift and edge-case exceptions during path resolution.

Furthermore, `BucketAddress.from_uri()` fell back to `"orphan"` when encountering root repository paths (`repo=""`), misclassifying root workspace files. Additionally, the client `SSEPipeline` filtered step completion telemetry (`insetu:compile-step-complete`) behind `job_category === "ui_blocking"`, preventing background worker steps (`system_background`) from updating UI card states incrementally.

## Decision
1. **Polymorphic `InSetuURI.from_any(raw)` Constructor (`utils_core.py`)**:
   - Implemented `InSetuURI.from_any(raw)` as a classmethod that accepts `InSetuURI`, `AkasaURI`, dictionaries (extracting `filepath` or `folderpath`), or string/path objects.
   - Automatically normalizes scheme prefixes (`vfs://` and `ctx://`) and resolves physical disk existence (`.exists()`, `.is_dir_physical()`, `.is_file_physical()`, `.mtime()`, `.read()`).
2. **BucketAddress Value Object SSOT Refinement (`utils_core.py`, `fs.js`)**:
   - Refactored `BucketAddress.from_uri()` to distinguish explicit `repo=None` from root repositories (`repo=""`), preventing false `"orphan"` classification.
   - Updated `ensureFreshContext()` in `fs.js` to evaluate bucket freshness using `BucketAddress.fromFilepath()`.
3. **Un-blocked SSE Step Telemetry (`api.js`)**:
   - Updated `SSEPipeline` `job_progress` listener to ALWAYS emit `insetu:compile-step-complete` when worker steps finish with an artifact payload, regardless of job execution category.
4. **Service Worker Eviction & Target Config Normalization (`system.js`, `fs.js`)**:
   - Enhanced `fullRefresh()` in `system.js` to unregister active Service Workers (`navigator.serviceWorker.getRegistrations()`) and clear `CacheStorage` before triggering hard reloads.
   - Deprecated `d.targets` getter keys in favor of canonical `d.target_repos`.

## Consequences
* **Positive**: Absolute polymorphic URI handling across all core substrate engines and REST route handlers.
* **Positive**: Guarantees real-time manifest rehydration for background compilation chains without blocking the UI.
* **Positive**: Complete elimination of deprecated `d.targets` key usage across frontend scripts.