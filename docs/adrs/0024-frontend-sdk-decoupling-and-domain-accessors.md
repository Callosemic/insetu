# ADR 0024: Frontend SDK Decoupling & Domain Accessor Migration

## Status
Accepted (2026-07-21)

## Context
Previously, frontend extensions directly imported core OS functions from relative paths (e.g., `import { fetchAndCopy } from '../app.js'`) or called methods attached directly to the root `window` object. This created tight coupling between optional extension modules and the core chassis file layout, breaking extensions whenever internal core functions were relocated or refactored.

## Decision
1. **Eradicate Relative Chassis Imports**: Extensions are strictly banned from importing directly from core OS files (`app.js`, `fs.js`, `store.js`).
2. **Domain-Specific Accessors**: Core OS capabilities are grouped into logical domain buckets on the `window.inSetu` namespace and exposed directly on `InSetuElement` via getters:
   * `this.vfs`: File operations (`downloadFile`, `fetchAndCopy`, `viewSourceFile`, `shareFiles`).
   * `this.ui`: Interface orchestration (`openFolderBrowser`, `openWorkspaceBrowser`, `setGlobalStatus`).
   * `this.sys`: OS lifecycle and state (`executeWorkspaceMutation`, `executeSystemCompile`, `switchTab`).
   * `this.editor`: CodeMirror integration (`getEditorContent`, `setEditorContent`, `insertTextAtCursor`).
   * `this.utils`: Shared utilities (`slugify`, `fuzzyFilterObjects`).
3. **Event Bus Decoupling**: Cross-extension or window-level triggers must use custom DOM events (e.g., `insetu:git:generate-diffs`) rather than attaching global functions to `window`.

## Consequences
* **Positive**: Absolute Inversion of Control. Core OS file layouts can be refactored without breaking downstream extensions.
* **Positive**: Clean, self-documenting IDE intellisense inside Lit web components via domain getters.
* **Negative**: Requires strict static analysis rules to prevent developers from re-introducing relative imports to core files.