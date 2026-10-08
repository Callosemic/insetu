# ADR 0057: Workspace Swap Layout Eviction, yv-icon Component Migration, and Primitive Alias Purge

## Status
Accepted (2026-10-08)

## Context
Previously, when the micro-kernel executed a hot-swap between tenant workspaces (`executeWorkspaceSwap`), the `AppStore.activeWorkspace` identity was mutated before the UI layout projections were fully evicted. If an active editor buffer or tracking view executed a `disconnectedCallback` teardown save during this eviction window, the asynchronous `fs/save` operation inherited the *new* tenant's workspace token, causing the previous workspace's file to be erroneously written to the new workspace's database.

Furthermore, the frontend chassis still relied on temporary compatibility aliases (`insetu-card`, `insetu-modal`) and manual imperative `lucide.createIcons()` DOM queries to render iconography, violating the declarative rendering mandate established during the Sutram micro-kernel vendorization (ADR 0031).

## Decision
1. **Pre-Swap Layout Eviction (`performSoftRefresh`)**:
   - Reordered the `executeWorkspaceSwap` lifecycle. The system now iterates over all active `Layout` projections and dispatches `sutram-evict-projection` events *before* modifying the `activeWorkspace` or `location.hash` state. This guarantees that any transient teardown saves hit the outgoing workspace database.
2. **UI Primitive Alias Purge (`ui_primitives.js`)**:
   - Permanently removed the `insetu-card`, `insetu-modal`, and `insetu-async-btn` inheritance wrappers. All UI views must strictly consume the foundational `<sutram-*>` tags.
3. **Declarative Iconography (`<yv-icon>`)**:
   - Banned the usage of raw `<i data-lucide="name">` tags and imperative `lucide.createIcons()` calls inside component lifecycles. All iconography must be rendered declaratively via the `<yv-icon name="name">` Web Component to ensure shadow DOM isolation and prevent render cycle collisions.

## Consequences
* **Positive**: Absolute mathematical certainty that teardown mutations will not bleed across multi-tenant boundaries during hot-swaps.
* **Positive**: Reduced component lifecycle boilerplate by delegating SVG icon rendering to the `<yv-icon>` primitive.
* **Positive**: Complete consolidation of the Tier 0 presentation layer.