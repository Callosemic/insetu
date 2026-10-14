# ADR 0027: Global Multi-Select Entity Tray and Batch Action Registry

## Status
Accepted (2026-07-24)

## Context
As workspace dashboards evolved, performing operations across multiple files, contexts, or cards required repetitive single-item interactions. Imperatively collecting selected items in localized component memory created state fragmentation across tab navigation switches and violated Unidirectional Data Flow (UDF) rules.

## Decision
1. **Centralized Selection Store (`SelectionStore`)**: We establish a global Zustand store (`SelectionStore`) tracking selected entities via a Map of `id -> { entityType, data }`. The store persists statelessly across tab, sub-tab, and workspace navigation.
2. **Card Selection State Protocol**: `<yenvui-card>` and `<insetu-card>` expose reactive `selected` and `disableSelection` properties and emit normalized `@yenvui-card-select-toggled` events, maintaining complete decoupling from business logic.
3. **Polymorphic Batch Action Registry**: `ExtensionRegistry` accepts `batchActions` definitions containing `match(items)` filter functions and `asyncAction(items)` callbacks.
4. **Header Projection Slot**: The `<insetu-selection-tray>` component mounts in the `<insetu-app-shell>` header action slot, displaying the active item counter badge and opening a modal to trigger registered batch actions.

## Consequences
* **Positive**: Unified, non-disruptive UX for multi-entity batch workflows across all extension domains.
* **Positive**: Absolute UDF compliance with zero DOM selection queries.
* **Negative**: Requires card instances to pass unique entity IDs and data payloads to participate in global selection.