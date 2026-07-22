---
repo: "insetu"
type: "todo"
status: "open"
id: "TKT-MULTI-SELECT-TRAY"
title: "Global Multi-Select Selection Tray ('Shopping Cart')"
created_at: 2026-07-20T17:55:00
closed_at: null
sub_bucket: "None"
tags: ["UI", "yenVUI", "UX"]
---

## Description
Implement a "Shopping Cart" style global selection tray to allow users to multi-select heterogeneous entities (Contexts, Tickets, Files) across different tabs and execute batch actions.

### 1. The State Layer (`SelectionStore`)
* Establish a new Zustand slice (or append to `AppStore`) to hold an array of selected entity objects.
* Must persist statelessly as the user navigates between Gather, Git, and Tracker tabs.

### 2. The Gesture & Card Update
* Hijack the **Right Swipe** (`diffX < -40`) on `<yenvui-card>` / `<insetu-card>` to toggle the selected state of the card.
* Add a `?selected` boolean property to the card primitive to render a visual active state (e.g., a glowing border).

### 3. The Atomic UI (`<yenvui-selection-tray>`)
* Create a floating action bar that only mounts when `SelectionStore.items.length > 0`.
* Expose a `<slot name="batch-actions">` for the OS to project contextual buttons into.

### 4. Polymorphic Batch Actions
* Expand the `ExtensionRegistry` to accept `batchActions`.
* Example: The Files extension registers "Download as Zip" (valid if all selected items are `isFS: true`).
* Example: The Gather extension registers "Download as Quick-Pack" (valid for any heterogeneous mix).