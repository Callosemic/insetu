---
title: "Sutram Autonomous Offline Kernel & Host Policy Inversion Plan"
status: completed
created_at: 2026-11-05
owners: ["sutram", "insetu.core.offline", "insetu.core.system"]
---

## 2. Target Greenfield Architecture: The Four Pillars

Our North Star design embeds offline resilience so deeply into `Sutram` (`vfs://sutram/sutram/js/sw-core.js` and `vfs://sutram/sutram/js/offline.js`) that **host application boot, routing, and VFS code (`system.js`, `fs.js`) require zero `if (isOffline)` branches**.

### Pillar 1: Self-Describing HTML Shell & Indestructible App-Shell Lockbox (`sw-core.js`)
Instead of relying on the host application to manually list every transitive ES module or scrape `performance.getEntriesByType('resource')`:
* **HTML-Driven Graph Discovery:** Whenever `sw-core.js` fetches a `200 OK` response for `/` (during `install` or navigation), it clones the response text in the background and extracts:
  1. All `<script type="importmap">` JSON specifier targets (`"imports": { ... }`).
  2. All same-origin `<link rel="stylesheet">`, `<link rel="modulepreload">`, and `<script src="...">` URLs.
  3. Any host-supplied `WARM_URLS` (such as core and active extension entrypoints).
* **Dedicated Lockbox Cache (`sutram-shell-v*`):** The root `/` document (stored under both `/` and `/__sutram_app_shell__`) and its module graph are stored in the Service Worker cache.
* **Strict Network-First with Fast Gateway Fallback:**
  * Every same-origin `GET` request (navigation and static modules) attempts `fetch()` first (`cache: 'no-cache'` on navigation) so code edits on `localhost` and `*.ts.net` pull through immediately on the first reload.
  * If `fetch()` throws a network error **or** returns `502`, `503`, or `504` (daemon stopped behind Tailscale Serve / reverse proxy), `sw-core.js` immediately returns the cached shell or module.
  * Cross-origin requests (`url.origin !== self.location.origin`) are ignored by the Service Worker so external assets (like Google Fonts) degrade natively in the browser without faulting the SW.

### Pillar 2: Unified `OfflineHttpProvider` Transport & Bootstrap Virtualization (`offline.js`)
The host application (`system.js`) executes **one single boot sequence** whether online or offline:
1. `POST /auth/bootstrap`
2. `GET system/workspaces`
3. `GET system/config`
4. `GET system/topology`
5. `GET system/manifest`

`OfflineHttpProvider` (configured via IoC callbacks in `api.js`) makes this work transparently:
* **Configurable Policy Predicates (Zero Host Leaks in `Sutram`):**
  * `probeUrl`: Host-configured liveness endpoint (e.g., `'/auth/bootstrap'`), replacing hardcoded URLs in `Sutram`.
  * `shouldCacheGet(url, scopeId)`: Host predicate deciding which `GET` responses are persisted to `SutramDB` (e.g., excluding `/deltas` and `/jobs/`, and checking repository `offline_capable` policies).
  * `canQueueMutation(url, method, bodyString, options)`: Host predicate deciding which `POST`/`DELETE` routes can enqueue into `sutram_outbox` when offline.
* **Network-First `GET` with `cache: 'no-store'`:**
  * Whenever `navigator.onLine !== false` and `!options.onlyIfMissing`, `OfflineHttpProvider.get()` dispatches `fetch(url, { cache: 'no-store', ...options })` so the browser's native HTTP disk cache never serves stale VFS files or manifests.
  * On `200 OK` (if `shouldCacheGet(cacheKeyUrl, scopeId)` is true), the response blob is written to `SutramDB` under `${scopeId}::${cacheKeyUrl}` (and mirrored to `default::${cacheKeyUrl}` for global endpoints).
  * On network failure or `502`/`503`/`504`, `OfflineHttpProvider.get()` flips offline state to `true` and serves the cached blob from `SutramDB` (`${scopeId}::${cacheKeyUrl}`, with automatic fallback to `default::${cacheKeyUrl}`).

### Pillar 3: Atomic Read-Your-Writes Overlay in `SutramDB` (`offline.js`)
When a user saves, moves, or deletes a file while offline, `SutramDB` maintains 100% read-after-write consistency inside IndexedDB itself:
* **Atomic Outbox + Cache Transaction:** `SutramDB.enqueueMutation()` opens a single atomic `readwrite` transaction across `['sutram_outbox', 'vfs_cache']`:
  1. Compacts any existing outbox record matching `collapseKey` while preserving the original `base_hash` and `base_content` (so 3-way OCC merge works against the true server ancestor when reconnecting).
  2. If `options.cacheBlobUrl` and `options.cacheBlobContent !== undefined` are provided, writes the updated `Blob` directly into `vfs_cache` in the same transaction.
  3. If `options.deletedCacheUrls` are provided (e.g., on `fs/delete` or `fs/move` source), deletes those keys from `vfs_cache` in the same transaction.
* **Result:** Any subsequent `GET` or `fetchImmutableText()` while offline reads the exact mutated file from `SutramDB.getVFSBlob()`—even across browser restarts—without `fs.js` needing to parse `OfflineStore.outboxItems`.

### Pillar 4: Reactive Telemetry Bus & Per-Repository Policy Inversion
`Sutram` provides a structured, observable state and telemetry stream so the host's Diagnostics/Offline UI (`offline_ui.js`) and per-repository settings (`config.js` / `manifest_sync.js`) plug in with zero coupling:
* **`SutramDB.subscribeTelemetry(listener)` / ` sutram:offline-telemetry` Event:** Every cache hit, cache write, cache eviction, outbox enqueue, poison-pill DLQ isolation, and reconciliation step in `Sutram` emits a structured telemetry event (`{ type, category, message, details, timestamp, scopeId }`).
* **Per-Repository Offline Participation (`offline_capable`):** Managed via IoC predicates injected by the host (`shouldCacheGet` and `SutramCacheWarmer`), ensuring repositories with `offline_capable: false` never bloat IndexedDB during background warming while keeping core OS metadata (`system/*`, `prompts/*`) always available offline.

---

## 3. Implementation Phases & Verification Matrix

### Phase 1: Pure Agnostic `Sutram` Offline Kernel (`vfs://sutram`)
* **`vfs://sutram/sutram/js/sw-core.js`**:
  * Remove hardcoded inSetu paths; parse `<script type="importmap">`, `<link>`, and `<script src>` from `/` HTML responses to auto-populate the App-Shell cache.
  * Enforce Network-First with `502/503/504` gateway fallback for all same-origin `GET` requests.
* **`vfs://sutram/sutram/js/offline.js`**:
  * Remove all hardcoded `/deltas`, `/jobs/`, `/search`, `/auth/bootstrap` strings; accept `shouldCacheGet`, `isOfflineCapable`, and `probeUrl` in `OfflineHttpProvider`.
  * Upgrade `SutramDB.enqueueMutation` to atomically update/delete `vfs_cache` entries (Read-Your-Writes overlay).
  * Emit structured telemetry events (`sutram:offline-telemetry` and `sutram:offline-state-changed`) so host observability tabs stay 100% reactive.
  * Add `SutramCacheWarmer` to manage background low-priority warming with quota circuit-breaking inside `Sutram`.

### Phase 2: Host Policy Wiring & Single-Path Boot (`vfs://insetu`)
* **`vfs://insetu/insetu/core/system/api.js`**:
  * Wire `shouldCacheGet` (honoring per-repo `offline_capable` settings while always caching `system/*`, `prompts/*`, `editor/*`, and explicitly opened files) and `probeUrl: '/auth/bootstrap'`.
* **`vfs://insetu/insetu/core/system/system.js`**:
  * Unify `executeBootSequence()` and `_hydrateWorkspaceEnvironment()` so `OfflineHttpProvider` (`SutramDB`) is the single source of truth for boot endpoints.
  * Remove `purgeServiceWorkerCaches()` from `SessionOrchestrator.transitionToWorkspace()`.
* **`vfs://insetu/insetu/core/offline/offline_ui.js`**:
  * Subscribe `OfflineStore` directly to `sutram:offline-telemetry` and `sutram:offline-state-changed`, and display per-repository cache breakdown in `<insetu-core-offline-ledger>`.
* **`vfs://insetu/docs/01_engineering_standards.md`**:
  * Update §1 (`SessionOrchestrator` `TEARDOWN` step) to codify that Service Worker static caches are never purged during workspace transitions.

### Phase 3: Vendor Lock & Automated Contract Tests
* Sync `vfs://sutram` into `vfs://insetu/insetu/static/vendor/sutram/` and update `sutram.lock.json`.
* Add unit/contract assertions verifying:
  1. Zero host-domain strings in `sutram/js/offline.js` and `sutram/js/sw-core.js`.
  2. `SessionOrchestrator.transitionToWorkspace` never invokes `purgeServiceWorkerCaches` or `caches.delete`.
  3. `SutramDB` atomic Read-Your-Writes overlay returns updated content immediately after `enqueueMutation`.