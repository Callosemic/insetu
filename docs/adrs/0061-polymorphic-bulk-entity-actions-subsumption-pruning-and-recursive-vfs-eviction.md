# ADR 0061: Polymorphic Bulk Entity Actions, Target Subsumption Pruning, and Recursive VFS Eviction

## Status
Accepted (2026-10-14)

## Context
Previously, contextual card actions and multi-item batch actions were registered through two disjoint mechanisms: `entityActions` for single-item card buttons and `batchActions` (introduced in ADR 0027) for the global selection tray. This separation forced duplicate action declarations, complicated group aggregation across heterogeneous entity types, and created maintenance divergence between single and bulk operations.

Additionally, performing bulk operations (such as move, archive, or delete) on multi-item selections where both parent directories and child files were selected caused race conditions, redundant API invocations, and filesystem errors. Deleting directories also left orphaned editor buffers in `FsStore.activeBuffers` and open projections in `LayoutStore.columns`, while the CQRS file tree continued to display descendant items pending full backend re-indexing.

## Decision
1. **Unification of Bulk Actions into `entityActions`**:
   - Deprecate the standalone `batchActions` registry array from ADR 0027.
   - Expand `entityActions` to natively support multi-entity mapping (`targetEntities: ['file', 'folder']` or `targetEntities: ['*']`), multi-select enablement (`bulkable: true`), bulk-only visibility (`bulkOnly: true`), bulk aggregation keys (`bulkGroupKey`), and bulk handlers (`bulkAction` / `bulkOnClick`).
2. **Hierarchical Target Subsumption Pruning (`pruneSubsumedTargets`)**:
   - Introduce `pruneSubsumedTargets(items)` to evaluate selection arrays. Any child file or subfolder whose ancestor directory is also selected is pruned prior to executing bulk transactions, ensuring deterministic tree mutations.
3. **Recursive VFS State Eviction**:
   - Implement `_evictDeletedNodeFromState` in `fs.js`. Deleting a directory recursively closes all matching buffer entries in `FsStore.activeBuffers` and unpins/evicts all associated spatial projections from `LayoutStore.columns`.
   - Update `InSetuFileTree` (`_getTree` and active search filtering) to recursively suppress descendant paths (`f.startsWith(d + '/')`) when an ancestor folder is present in `_deletedMutations`.
4. **Recursive Buffer Tracking for Directory Renames**:
   - Update `renameFileTracking` to recursively migrate open buffer state for child paths when parent directories are renamed or moved (`k.startsWith(normOld + '/')`).

## Consequences
* **Positive**: Single Source of Truth for all item and bulk actions within `entityActions`.
* **Positive**: Absolute elimination of redundant child operations and race conditions during bulk tree mutations.
* **Positive**: Immediate, zero-latency UI eviction of deleted directory subtrees across buffers, spatial projections, and CQRS trees.
* **Negative**: Existing extensions declaring `batchActions` must migrate their definitions to `entityActions`.