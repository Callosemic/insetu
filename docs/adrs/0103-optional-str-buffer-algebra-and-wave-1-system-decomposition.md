# 0103: Optional[str] Buffer Algebra, Bridge Working Tree, and Wave 1 System Decomposition

## Status
Accepted

## Context
1. **Bridge State & Issue #15**: The Yomama Sync Bridge previously tracked file mutations across eight parallel dictionaries/sets (`memory_buffers`, `original_buffers`, `disk_hashes`, `deleted_targets`, `pre_existing_files`, `checked_disk_files`, `moved_pointers`, `file_transitions`) and used a magic sentinel string (`"__DELETED_FILE__"`). This caused concurrency desynchronization when a file was moved and edited within the same transaction (Issue #15), as intermediate buffers for deleted or renamed sources were clobbered.
2. **God-Object Monoliths**: `insetu/core/utils_core.py` (~2,250 LOC) and `insetu/core/system/engine_system.py` (~814 LOC) conflated unrelated domains, including filesystem watching, outbound SSRF prevention, child process environment sanitization, OpenAPI specification generation, PyPI dependency installation, and memory profiling.
3. **Frontend Substrate Cohesion**: `insetu_sdk.js`, `system.js`, and `ui_system_settings.js` combined URI parsing, base elements, manifest delta synchronization, and schema repeaters into oversized modules.

## Decision
1. **`Optional[str]` Buffer Algebra & `BridgeWorkingTree`**:
   * Model file state at any step $k \in [0 \dots m]$ strictly as $B_k \in \text{Optional}[\text{str}]$: `None` signifies that the file does not exist (absent on disk or deleted); `""` signifies an existing 0-byte file; and non-empty strings represent populated content.
   * Represent file progression within `FileTimeline(uri, baseline, baseline_hash, current, transitions)`.
   * Manage transaction-wide timeline state and transitive move pointer redirects (`src -> dst`) within `BridgeWorkingTree(vfs)`.
   * Update `_replay_ledger_chunks_in_memory` and `bridge_revert` to evaluate `Optional[str] -> Optional[str]` transitions with closed-set validation across `LEDGER_CHUNK_TYPES`.
   * Allow `RELOCATE` to create missing destination files, seeding module docstrings from `COMMENT`.
2. **Wave 1 System Decomposition**:
   * Extract `system/watchdog.py`, `system/security_io.py`, and `system/ext_manager.py` from `utils_core.py` with zero legacy re-export shims left behind.
   * Extract `system/blueprint.py`, `system/openapi.py`, `system/ext_manager.py`, and `system/memory_profiler.py` from `engine_system.py`.
   * Extract `system/uri.js`, `system/insetu_element.js`, `system/manifest_sync.js`, and `system/components/ui_schema_repeater.js` on the frontend, cleanly re-exporting public symbols from `insetu_sdk.js`.
3. **Fitness Ratchets**:
   * Enforce `BANNED_WAVE1_LEGACY_IMPORT`, `EXTENSION_MEMBRANE_RATCHET`, `BARREL_CYCLE_BAN`, `MAGIC_DELETED_FILE_SENTINEL_BAN`, and `MODULE_LINE_RATCHET` with an 800-line ceiling on all unlisted modules.

## Consequences
* Bridge transactions mixing `MOVE_FILE`, `RELOCATE`, and `SEARCH/REPLACE` evaluate identically in dry-run and live commit modes with full reversibility.
* Monolithic modules are broken down into single-responsibility units protected by static fitness ratchets.
* Zero-byte files are preserved without confusing deletion states.
