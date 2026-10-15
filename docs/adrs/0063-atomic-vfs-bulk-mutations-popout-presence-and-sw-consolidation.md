# ADR 0063: Atomic VFS Bulk Mutations, Pop-out Presence Negotiation, and Sutram Service Worker Lifecycle Consolidation

## Status
Accepted (2026-10-15)

## Context
As the inSetu Workbench scaled to support multi-selection file operations (ADR 0061) and dedicated projection pop-outs (ADR 0062), several architectural constraints emerged:
1. **Sequential N+1 Write Bottlenecks**: Bulk operations (`executeBulkMove`, `executeBulkArchive`, `executeBulkDelete`) executed sequential client-side `for` loops across individual file mutation endpoints. An interruption or network stall mid-loop left the filesystem in a partially mutated, unrecoverable state, while triggering excessive SQLite transaction churn.
2. **Pop-Out Telemetry Redundancy vs. Isolation**: Pop-out browser windows communicated with the parent application shell via `BroadcastChannel('insetu_telemetry')`. However, if the user launched a pop-out directly or closed the parent window, the pop-out had no deterministic mechanism to detect its standalone state and establish a direct Server-Sent Events (SSE) telemetry connection.
3. **Service Worker Boilerplate Duplication**: Service Worker registration, cache warming, and reload coordination were implemented via custom boilerplate in `system.js` rather than delegating to the Tier 0 vendorized Sutram micro-kernel (`sutram/js/offline.js`).
4. **Declarative Settings Schema Purity**: Extension settings definitions in `engine_gather.py` contained raw HTML strings (`html_desc`) inside the schema definition, violating declarative UI standards.
5. **Iconographic Divergence on Dirty Context Cards**: Gather context cards in a dirty or uncompiled state displayed the generic `alert-triangle` icon instead of the platform-standard `construction` token.

## Decision
1. **Atomic Bulk VFS Mutation Gateway (`POST /api/<workspace_id>/fs/bulk`)**:
   - Implemented `api_fs_bulk` in `engine_fs.py`, accepting a typed `FileBulkPayload` (`operations: [{ action, filepath, dest_path, is_dir }]`).
   - Normalizes path boundaries and delegates execution directly to `akasa.vfs.execute_vfs_bulk()`.
   - Refactored `executeBulkMove`, `executeBulkArchive`, and `executeBulkDelete` in `fs.js` to dispatch single atomic payloads, completely eliminating sequential client-side loops and satisfying the `BULK_VFS_LOOP_BAN` static analysis rule.
2. **Pop-Out Presence Negotiation & Fallback Telemetry**:
   - Implemented bidirectional `presence_ping` / `presence_pong` negotiation over `BroadcastChannel('insetu_telemetry')`.
   - Primary application windows respond to presence pings with pongs.
   - If a pop-out window fails to receive a presence pong within 1500ms, it detects standalone mode and lazily connects directly to `/api/system/stream`.
3. **Sutram Service Worker & Cache Purge Consolidation**:
   - Delegated client Service Worker registration and lifecycle coordination in `system.js` to `bootSutramServiceWorker()` in `/static/vendor/sutram/js/offline.js`.
   - Replaced manual cache deletion loops in `fullRefresh()` with `purgeSutramCaches()`.
4. **Declarative Settings Schema Purity**:
   - Purged inline HTML from `GATHER_SETTINGS_SCHEMA` in `engine_gather.py`, replacing `html_desc` with the declarative `intent_legend` array.
5. **Iconographic Alignment**:
   - Replaced `alert-triangle` with `construction` for dirty Gather context cards, satisfying the `DIRTY_CARD_CONSTRUCTION_ICON_MANDATE`.

## Consequences
* **Positive**: Absolute all-or-nothing transactional consistency for multi-item bulk moves, archives, and deletes.
* **Positive**: Fluid adaptation of pop-out windows between parent-linked relay mode and standalone direct-streaming mode.
* **Positive**: Complete consolidation of client offline lifecycle under Tier 0 Sutram vendorization.
* **Positive**: Pure declarative presentation schemas free of raw HTML strings.