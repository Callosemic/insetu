---
repo: "insetu"
type: "queue"
status: "open"
id: "INS-QUEUE-20260703_1828_MENU_BAR_REFACTOR"
title: "Refactor File Modal Toolbar to Dropdown Menu Bar"
created_at: "2026-07-03T18:28:54"
closed_at: null
sub_bucket: "None"
tags: ["ui", "refactor", "tech-debt"]
---

## Description
The current file modal toolbar relies on \`flex-wrap\`, which creates a cluttered layout and breaks vertical height constraints on smaller screens when multiple extensions inject their own buttons.

Refactor this into a classic 3-category Menu Bar to infinitely scale extension actions without expanding the horizontal or vertical footprint.

**Implementation Steps:**
1. **HTML Skeleton:** Update \`index.html\` to replace the flex-wrap action buttons with three simple dropdown toggles: **📁 File ▾**, **📝 Edit ▾**, and **🧩 Extensions ▾**.
2. **Dropdown Logic:** Use the existing \`UIFactory.createDropdown\` to render the menus on click.
3. **Extension Hooks:** Modify the \`zone:modal-edit-toolbar\` and \`zone:modal-file-toolbar\` hooks so that extensions (Prompts, Citations, Format) push config objects (\`{label, icon, onClick}\`) into a global menu array rather than directly mutating the DOM.
4. **Cleanup:** Remove the \`ResizeObserver\` overflow hack from \`index.html\`.

## Notes / Execution Log
