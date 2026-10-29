# ADR 0059: Extension Modal Annihilation, Spatial Viewport Projection Migration, and Store Eviction Governance

## Status
Accepted (2026-10-13)

## Context
Following ADR 0054 (Multi-Column Viewport Projections) and ADR 0058 (VFS Modal Projection Decoupling), core file editing and Yomama Bridge operations were transitioned from singleton modal dialogs to spatial layout projections. However, the Tier 3 domain extensions (`flow`, `git`, `notes`, `research`, `skills`, `tracker`, `update`) continued to rely on monolithic, blocking `<sutram-modal>` dialogs for their primary editing, inspection, and preview workflows.

These modal overlays caused significant architectural issues:
1. **Viewport Lockout**: Users were constrained to a single active document overlay, preventing side-by-side cross-referencing against code or documentation.
2. **Backdrop Click Interception**: Unmounted or hidden modal backdrops periodically interfered with pointer events across adjacent UI tracks.
3. **Ghost State Bleed**: Closing a modal dialog did not systematically reset the domain store's transient editing state, risking data contamination upon reopening.
4. **Design Token Fragmentation**: Raw emoji characters in buttons and headers fragmented visual consistency across themes.

## Decision
1. **Universal Extension Spatial Viewport Projections**:
   - Permanently eradicated monolithic modal dialogs across all Tier 3 extensions in favor of spatial projections registered via `LayoutStore.openWindow()`:
     - `flow`: `flow:view` (`InSetuFlowViewProjection`) and `flow:edit` (`InSetuFlowEditProjection`)
     - `git`: `git:push` (`InSetuGitPushProjection`) and `git:preview` (`sutram-report-projection`)
     - `notes`: `notes:editor` (`InSetuExtNotesEditor`)
     - `research`: `research:preview` (`InSetuResearchPreviewProjection`)
     - `skills`: `skills:session` (`InSetuSkillsSessionProjection`)
     - `tracker`: `tracker:edit` (`InSetuTrackerEditProjection`)
     - `update`: `update:preview` (`sutram-report-projection`)
2. **Store Eviction Governance (`onEvict` Schema)**:
   - Configured `createExtensionStore` across all domain stores with explicit `onEvict` definitions keyed to window projection IDs. Closing a spatial window via `LayoutStore.closeWindow()` automatically triggers store reset logic for that projection.
3. **Declarative Iconography Standardization**:
   - Banned raw inline emoji in extension action controls and headers in favor of `<yv-icon name="...">` and `<sutram-btn icon="...">` / `<sutram-async-btn icon="...">`.
4. **Update Engine DAG Pipeline Integration**:
   - Integrated semantic release version bumps directly with `resolve_dag_chain(ctx, 'register_compilation_steps')` to automatically compile release artifacts and code indices off-thread post-bump.

## Consequences
* **Positive**: Complete fluid multi-column workflow across all extensions.
* **Positive**: Eradicates modal overlay click-blocking bugs and ghost memory leaks.
* **Positive**: 100% adherence to Sutram presentation standards and Lucide iconography.
* **Negative**: Domain stores managing windowed projection state must declare `onEvict` schemas to handle cleanup.