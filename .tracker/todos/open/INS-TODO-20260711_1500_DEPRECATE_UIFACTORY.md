---
repo: "insetu"
type: "todo"
status: "open"
id: INS-TODO-20260711_1500_DEPRECATE_UIFACTORY
title: "Deprecate UIFactory and Finalize Declarative Dropdown Web Component"
created_at: 2026-07-11T15:00:00
closed_at: null
sub_bucket: "None"
tags: ["Frontend", "UI", "LitElement", "Refactor"]
---

## Description
While we successfully migrated all legacy modals to the declarative `<insetu-modal>` component, `UIFactory` (housed in `ui.js`) is still clinging to life by handling one major UI primitive: **Dropdown Menus**.

To completely eradicate `ui.js` from the codebase and achieve 100% declarative UI adherence, we must extract the dropdown logic into a native LitElement primitive and update all extension action menus.

### Action Items
1. **Build the `<insetu-dropdown>` Web Component:**
   * It needs to accept an array of action objects (e.g., `[{ label: 'Move', icon: '🚚', onClick: ... }]`).
   * It must handle its own "click-outside-to-close" teardown logic using `connectedCallback` and `disconnectedCallback`.

2. **Refactor Extension Action Menus:**
   * Refactor the `_openMenu` methods to toggle a reactive state property (e.g., `this._isMenuOpen = true`) and render `<insetu-dropdown>` declaratively.
   * Target Components: `InSetuExtGitActions` (`ext_git.js`), `InSetuExtFlowActions` (`ext_flow.js`), `InSetuExtPromptsActions` (`ext_prompts.js`), and `InSetuVFSExplorerActions` (`fs.js`).

3. **Refactor the VFS File Modal Toolbars (`fs.js`):**
   * The `viewSourceFile()` function imperatively attaches `onclick` handlers to toolbar buttons (`btn-menu-file`, `btn-menu-edit`, `btn-menu-ext`), calling `UIFactory.createDropdown(...)`.
   * Extract the file viewer's toolbar into its own Lit component (e.g., `<insetu-file-toolbar>`) so it can manage dropdown states reactively.

4. **Remove the Global Escape Hatch (`app.js`):**
   * Delete the global `keydown` listener for the `Escape` key that explicitly calls `window.inSetu.ui.Factory.closeModal(topModal.id)`. Transient modals are now closed reactively via state properties (`?open=${this.isOpen}`).

5. **Delete `ui.js`:**
   * Remove `import './ui.js';` from `app.js`.
   * Delete `insetu/static/js/ui.js` from the filesystem entirely.

## Notes / Execution Log
