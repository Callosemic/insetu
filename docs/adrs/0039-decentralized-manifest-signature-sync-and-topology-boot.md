# ADR 0039: Decentralized Manifest Signature Sync and Topology Boot Sequence

## Status
Accepted

## Context
Previously, the frontend UI polled `/manifest/deltas` on the `gather` engine every 3 seconds to synchronize manifest state. This violated Inversion of Control principles (ADR 0037/0038), as `gather` was acting as the OS heartbeat despite `topology` leading the data waterfall. Transmitting monolithic manifest trees over the wire created network bloat and forced heavy UI reconciliation passes even for single-file changes.

Furthermore, running disk scans during Gather boot initialization triggered redundant filesystem walks alongside Topology boot routines.

## Decision
1. **Decentralized Signature Sync (`register_manifest_signatures`)**:
   - The kernel heartbeat aggregates lightweight signatures (hashes/timestamps) via `@hooks.on('register_manifest_signatures')` across active domain providers.
   - `engine_topology.py` yields `vfs` signatures formatted as `repo -> "<count>-<max_ts>"`.
   - `engine_gather.py` yields `ctx` signatures formatted as `path -> timestamp`.
2. **System Deltas REST Gateway**:
   - Exposed `/api/system/deltas` in `routes_system.py` returning the kernel's aggregated signature delta payload.
   - Exposed surgical fetch endpoints `/api/topology/vfs` and `/api/gather/manifest/entry` (returning HTTP 200 with `status: "deleted"` for tombstoned entries) to allow the client to rehydrate changed sub-trees/entries on demand.
3. **Topology-Owned Boot Sequence**:
   - `engine_topology.py` subscribes to `@hooks.on('workspace_boot')` to execute `boot_scan_task` and emit `topology_boot_complete`.
   - `engine_gather.py` listens to `@hooks.on('topology_boot_complete')` to trigger context compilation with `force_full="compile_only"`, eliminating double disk walks.
4. **Internal Artifact VFS Gatekeeper**:
   - `buffer_topology_events` explicitly filters out internal artifact paths (`ctx://`, `/data/contexts/`, `/data/diffs/`, `/data/workflows/`, `.insetu/data/`) to prevent recursive topology event loops.

## Consequences
* **Positive**: Drastically reduces polling payload size from megabytes to kilobytes.
* **Positive**: Perfect data waterfall ordering where Topology settles before Gather context compilation begins.
* **Positive**: Complete Inversion of Control; future extensions can participate in state sync by registering a signature provider hook.