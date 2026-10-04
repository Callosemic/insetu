# ADR 0055: VFS Parity Action Middleware, Singleton File Modal Deprecation, and Inversion-of-Control URI Coercion

## Status
Accepted (2026-10-04)

## Context
Previously, text editing, patch chunk editing, and virtual text blob viewing relied on a singleton fullscreen overlay component (`InSetuFileModal`) backed by `FsStore.fileModal`. This constrained the user to a single open file at a time, prevented side-by-side multi-column comparison, and risked buffer divergence when entity actions (like Git commits or batch scripts) executed against files with unsaved changes in memory.

Furthermore, `InSetuURI.from_any()` contained hardcoded string suffix checks (`_context.txt`, `_diffs.txt`) to coerce naked path strings into `ctx://` URIs, violating Inversion of Control principles by hardcoding domain extension file patterns into core kernel utilities.

## Decision
1. **Deprecation of Singleton `InSetuFileModal`**:
   - Permanently remove `InSetuFileModal` and `FsStore.fileModal` store state.
   - All text file viewing (`viewSourceFile`), editing, text blob inspection (`viewVirtualInWindow`), and Yomama patch editing route through multi-projection text buffers (`FsStore.activeBuffers`) rendered via `<insetu-editor-projection>` pinned to spatial layout columns (`LayoutStore`).

2. **VFS Parity Gatekeeper Action Middleware (`registerActionMiddleware`)**:
   - Introduced global pre-flight action middleware in `window.ExtensionRegistry.registerActionMiddleware`.
   - Entity actions declared with `vfsBound: true` automatically evaluate `FsStore.activeBuffers` before execution. If uncommitted buffer changes exist for target files, the middleware prompts the user to auto-save dirty buffers before proceeding.

3. **Inversion of Control URI Scheme Coercion (`coerce_naked_uri`)**:
   - Replaced hardcoded string suffix checks in `InSetuURI.from_any()` with `@hooks.on('coerce_naked_uri')` event bus listeners. Extensions claim their custom URI namespaces declaratively.

4. **Sutram Presentation Primitive Standardization**:
   - Standardized all core frontend templates to consume Tier 0 vendorized presentation primitives (`<sutram-btn>`, `<sutram-async-btn>`, `<yenvui-spinner>`, `<yenvui-scrub-track>`).

## Consequences
* **Positive**: Guarantees physical disk parity before executing destructive or VFS-dependent actions.
* **Positive**: Fluid side-by-side editing and patch inspection across multi-column spatial viewports.
* **Positive**: Pure Inversion of Control for custom URI scheme coercion.
* **Negative**: Entity actions operating on physical disk files must set `vfsBound: true` in their registry declarations.