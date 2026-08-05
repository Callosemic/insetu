---
repo: "insetu"
type: "queue"
status: "archived"
id: INS-QUEUE-20260703_1828_MENU_BAR_REFACTOR
title: "Refactor File Modal Toolbar to Dropdown Menu Bar"
created_at: 2026-07-06T15:46:16
closed_at: 2026-07-06T15:46:50
sub_bucket: "None"
tags: ["ui", "refactor", "tech-debt"]
---



## Description
The current file modal toolbar relied on `flex-wrap`, which created a cluttered layout and broke vertical height constraints on smaller screens when multiple extensions injected their own buttons.
We refactored this into a classic 3-category Menu Bar to infinitely scale extension actions without expanding the horizontal or vertical footprint.

**Implementation Steps:**
1. **HTML Skeleton:** Updated `index.html` to replace the flex-wrap action buttons with simple dropdown toggles.
2. **Dropdown Logic:** Leveraged `UIFactory.createDropdown` to render the menus on click.
3. **Extension Hooks:** Modified the extension scripts (`ext_citations.js`, `ext_format.js`, `ext_prompts.js`) to utilize the new `zone:modal-ext-menu` hook. Extensions now declaratively push config objects (`{label, icon, onClick}`) into a global menu array rather than directly mutating the DOM via `appendChild`.
4. **Cleanup:** Removed the `ResizeObserver` overflow hack from `index.html`.

## Notes / Execution Log
* **Resolution (2026-07-06):** Successfully migrated extension toolbars to the declarative `zone:modal-ext-menu` hook. Direct DOM manipulations were removed, completing the transition to a scalable and resilient menu bar paradigm.