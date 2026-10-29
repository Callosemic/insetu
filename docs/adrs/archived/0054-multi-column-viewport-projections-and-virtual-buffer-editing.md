# ADR 0054: Multi-Column Viewport Projections and Virtual Buffer Editing

## Status
Accepted (2026-10-02)

## Context
Previously, viewing or editing file contents, Yomama patch chunks, or virtual text blobs (`InSetuBlobViewer`) relied on monolithic fullscreen modal dialogs (`InSetuFileModal`). When working with multi-file diffs, complex code references, or side-by-side patch validation, forced modal overlays constrained the user to a single active document, preventing side-by-side comparison across dynamic viewport columns (`left`, `center`, `right`).

## Decision
1. **Multi-Buffer State Management (`FsStore.activeBuffers`)**:
   - Expanded `FsStore` to track active buffer states (`activeBuffers`, `openBuffer`, `updateBuffer`, `closeBuffer`).
   - Introduced `saveBufferFile(filepath, autoSave)` to handle buffer mutations across file projections.
2. **Spatial Viewport Projection Web Component (`<insetu-editor-projection>`)**:
   - Created `InSetuEditorProjection` (`insetu-editor-projection`) to render individual text buffers as column-pinnable projections.
   - Integrated with `LayoutStore` (`window.Sutram.stores.Layout`) to allow pinning projections into spatial viewport columns (`left`, `center`, `right`).
3. **Deprecation of `InSetuBlobViewer`**:
   - Deprecated `InSetuBlobViewer` and `#insetu-blob-viewer-root`. Re-routed `window.inSetu.ui.viewTextBlob` to generate memory-backed virtual buffers (`virtual://${filename}`) and pin them as projections.
4. **Drag-to-Grid Spatial Controls**:
   - Added drag-to-grid pointer gestures (`_handlePointerDown`, `_handlePointerMove`, `_handlePointerUp`, `.drop-zone-overlay`) in `InSetuFileModal` enabling users to drag open file overlays directly into spatial grid columns.

## Consequences
* **Positive**: Enables fluid, side-by-side code editing, patch inspection, and document reference across multi-column spatial grids.
* **Positive**: Eliminates monolithic modal overlay locking for multi-file workflows.
* **Positive**: Unified buffer state management across VFS files, virtual text blobs, and Yomama patch chunks.