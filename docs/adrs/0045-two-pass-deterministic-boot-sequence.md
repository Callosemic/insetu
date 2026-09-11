# ADR 0045: Two-Pass Deterministic Boot Sequence

## Status
Accepted (2026-09-10)

## Context and Problem Statement
The transition to an asynchronous Virtual File System (VFS) and native Filesystem Watchdog permanently fractured the linear boot sequence. Previously, operations executed sequentially. Today, the OS boots highly reactive event listeners before the physical disk map is finalized.

Currently, when the system emits `workspace_boot`, two conflicting operations occur simultaneously:
 * **The Map:** The Topology engine dispatches `boot_scan_task` to survey the physical disk and build the SQLite ledger.
 * **The Mutation:** Extensions instantly execute housekeeping logic. For example, the Tracker extension schedules `archive_stale_task`, which immediately writes modified YAML files to the disk via the VFS.

This creates a catastrophic race condition. The VFS physically saves the archived Tracker file. The Watchdog observer catches this write and triggers a new `resolve_topology_task`. Meanwhile, the Gather compiler evaluates its strict Topology Barrier and sits idle for up to 10 seconds waiting for the newly triggered topology events to settle. The boot sequence thrashes, starving the event loop.
## Decision
We bisect the boot lifecycle into two distinct execution phases, restoring Topology as the absolute arbiter of the start-up waterfall. Extensions will be permitted to register memory schemas and UI views immediately, but must defer any physical disk mutations until the OS grants clearance.

*Note: This architecture formalizes and expands upon the boot-time heuristics established in [ADR 0018](0018-event-sourced-vfs-ledger.md), [ADR 0038](0038-decoupled-topology-engine-partitioned-manifest-two-stage-slew-limiting.md), and [ADR 0039](0039-decentralized-manifest-signature-sync-and-topology-boot.md).*

### Phase 1: Spatial Discovery (Read-Only)
**Trigger:** `@hooks.on('workspace_boot')`
* **Objective:** Map the existing physical reality into memory and establish the Database / UI boundaries.
* **Allowed Operations:**
  * Registering SQLite schemas and executing `ALTER TABLE` migrations.
  * Registering `layoutSlots`, `entityActions`, and `settings_schemas` in the frontend registry.
  * Hydrating Zustand state stores from local SQLite caches.
  * The Topology Engine running `force_topology_scan` to rebuild the `topology_ledger`.
* **Strict Ban:** Extensions are entirely prohibited from executing `ctx.vfs.save()`, `ctx.vfs.delete()`, submitting background execution jobs, or emitting filesystem modifications during this phase.

### Phase 2: Deferred Housekeeping & Compilation (Mutation Phase)
**Trigger:** `@hooks.on('topology_boot_complete')`
* **Objective:** Execute data mutations, garbage collection, and context payload compilations against the now-settled physical map.
* **Allowed Operations:**
  * Tracker: Execute `archive_stale_task` to migrate old tickets into the log/archived directories.
  * Cronic: Execute log rotation and crontab drift healing.
  * Gather: Execute `compile_contexts` to generate the RAG text payloads.

## Consequences
* **Positive:** Complete elimination of boot-time Watchdog I/O storms and deadlocks.
* **Positive:** Predictable, deterministic state hydration. The RAG compiler is guaranteed to read an accurate `topology_ledger`.
* **Negative:** Extension developers must adopt a slightly higher cognitive burden, splitting their initialization logic across two separate event hooks depending on whether they are touching memory or touching the SSD. (Mitigated by structural AST linter enforcement in `tests/fitness/rules_python.py`).