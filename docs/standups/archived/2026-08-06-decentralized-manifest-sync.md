# 2026-08-06 - Decentralized Manifest Sync & Kernel Heartbeat

## 1. Motivation & Technical Debt

Historically, the frontend UI polled the `gather` engine for manifest updates (`/manifest/deltas`). This violated the Inversion of Control introduced in ADR 0037/0038, as `gather` was acting as the central OS heartbeat despite `topology` being the actual top of the data waterfall.

Furthermore, sending monolithic VFS and CTX manifest trees over the wire every 3 seconds resulted in severe network bloat, and forced the UI to constantly reconcile massive JSON structures even when only a single file changed. Watchdog edits also suffered from UX desynchronization because the frontend lacked true insight into backend background compilation states.

## 2. The Solution: Kernel-Driven Hash Routing

We are shifting the manifest from a **monolithic data dump** to a **lightweight, decentralized routing table**. The core OS will no longer transmit file trees in its heartbeat; it will only transmit lightweight signatures (hashes/timestamps). The frontend will use these signatures to surgically fetch only the data that has changed.

### Phase 1: The Kernel Substrate (`insetu/kernel/sync.py`)

Synchronization logic is being pushed down into the Micro-Kernel. A new module will handle the OS heartbeat, exposing a single `get_system_deltas(workspace_id, since_ts)` function.

* **Mutations:** Queries `vfs_event_log` for physical file events.
* **Telemetry:** Queries `jobs` and `immediate_jobs` to dynamically calculate an `is_compiling` boolean.
* **Signatures:** Fires a new `@hooks.on('register_manifest_signatures')` hook to collect routing hashes from all active extensions.

### Phase 2: Domain-Specific Hash Providers

Extensions will now yield lightweight state signatures rather than massive payloads.

* **Topology (`vfs` domain):** Partitioned by repository to allow targeted sub-tree hydration.
* *Format:* `{"vfs": {"repoA": "<total>-<max_ts>", "repoB": "<total>-<max_ts>"}}`
* *Tombstone:* `{"repoB": null}` signals a deleted repository branch.


* **Gather (`ctx` domain):** Partitioned by strict relative path. The `timestamp` serves as the hash.


* *Format:* `{"ctx": {"contexts/core.txt": 17150000, "diffs/patch.txt": 17160000}}`
* *Tombstone:* `{"diffs/patch.txt": null}` signals a deleted context artifact.



### Phase 3: The Core OS Gateway

The old `gather` poller is deprecated. A new `/api/system/deltas` endpoint is mounted in `routes_system.py`, acting as a dumb pipe that serves the kernel's `get_system_deltas()` payload to the frontend.

### Phase 4: Frontend Delta Engine (`sdk.js`)

The frontend metronome in `app.js` is refactored and pushed into the SDK.

* **UI Status:** Natively binds to the `is_compiling` boolean to perfectly sync the visual layout with backend Watchdog/Gather delays.
* **Event Bus:** Instantly fires `zone:vfs-mutated` if physical mutations are present in the payload.
* **Surgical Fetching:** Compares incoming hashes against the local `SignatureStore`. If `vfs.repoA` changes, it calls `/api/system/vfs?repo=repoA`. If `ctx["contexts/core.txt"]` changes, it calls `/api/gather/manifest/entry?path=contexts/core.txt`.
## 3. Impact & Guarantees

* **Build Pipeline:** Untouched. Topology still leads Gather.
* **Network Overhead:** Polling payloads drop from megabytes to kilobytes.
* **Extensibility:** Future extensions (e.g., a database viewer) can instantly tie into the OS UI state by simply registering a signature namespace, with zero core code changes required.

## 4. Architectural Risks & Refactoring Guardrails

* **Two-Pass Hydration Race Condition:** Shifting to signature polling creates a micro-gap between receiving a signature change and completing the secondary fetch for actual content. The `is_compiling` state must remain `true` until secondary hydration completes.
* **SQLite Indexing & Concurrency:** High-frequency polling on `vfs_event_log`, `jobs`, and `immediate_jobs` requires indexing on `(workspace_id, timestamp)` and `(workspace_id, status)` to prevent WAL read contention.
* **Tombstone Cleanup Mechanics:** When a domain yields a `null` signature, `SignatureStore` and `sdk.js` must purge the key from the local cache and prune corresponding entities from `AppStore.manifest`.
* **UI Metadata Parity (`fs.js` & `gather.js`):** `updateManifestState` must be tied directly to the signature engine. Context metadata must arrive alongside chunk hashes to prevent empty card flashes in the Gather UI.

## 5. Execution Order

1. **Kernel Substrate (`insetu/kernel/sync.py` & `hooks.py`):** Low-level heartbeat, signature aggregation hook, and query helpers.
2. **Core System Gateway (`insetu/core/routes_system.py`):** Mount `/api/<workspace_id>/system/deltas`.
3. **Domain Providers (`engine_topology.py` & `engine_gather.py`):** Signature generators and surgical fetch endpoints.
4. **Frontend Delta Engine (`sdk.js`, `store.js`, `app.js`):** SignatureStore, surgical fetchers, and UI state synchronization.