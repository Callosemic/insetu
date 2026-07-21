# 2026-07-21: SDK Decoupling & The Frontend API Surface

## 🚨 The Problem
Currently, extensions are tightly coupled to the core OS via fragile ES6 relative imports (e.g., `import { fetchAndCopy } from '../app.js'`). When we refactored file-system operations from `app.js` to `fs.js`, it instantly broke extensions that relied on the old paths. Furthermore, the core OS dumps dozens of internal methods directly onto the global `window` object. 

This violates Inversion of Control. Extensions should interact with a stable SDK abstraction, completely blind to the physical file topology of the OS kernel.

---

## 📦 Inventory of Core OS Functions to Expose
These are the methods currently scattered across `window.*` or imported directly by extensions that need to be centralized into the SDK:

### 1. Virtual File System (VFS) Operations
- `fetchAndCopy(filepath, explicitUrl)`
- `fetchAndDownloadState(filepath, explicitUrl)`
- `downloadFile(fetchUrl, fallbackFilename, fetchOptions)`
- `shareFiles(baseFile, chunks, isFS)`
- `uploadFileToWorkspace(targetDir)`
- `viewSourceFile(filepath, isFS)`
- `viewAndCopy(filename)`
- `openVirtualFile(filename, content)`
- `deleteEmptyFolder(dirPath)`
- `executeQuickPack(targetDir, recursive, specificFiles)`
- `clearQuickPacks()`
- `buildFileTree(files)`
- `getGlobalManifest()`

### 2. UI & Modal Orchestration
- **File Modals:** `openNewFileModal(path)`, `openNewFolderModal(path)`, `openMoveModal()`, `closeFileModal()`
- **Browsers:** `openWorkspaceBrowser(options)`, `openFolderBrowser(callback)`, `openBrowseModal(contextFilename)`, `closeBrowseModal()`
- **Helpers:** `openLinkModal(query, tab)`, `openQuickPackModal(targetDir)`
- **Components:** `createFileCard(fileInfo, container)`
- **Feedback:** `setGlobalStatus(msg, timeout, isError)`, `updateDefaultStatus()` (plus the hijacked `alert()` toast)

### 3. System & Lifecycle Operations
- `executeSystemCompile(onProgress, forceFull)`
- `executeWorkspaceMutation(path, payload, options)`
- `performSoftRefresh()`
- `fullRefresh()`
- `getFlattenedBuckets(repoDir)`
- `switchTab(tabId)`
- `switchSubTab(subId)`
- `loadWorkspaces()`
- `executeWorkspaceSwap(key, title)`
- `simulatePanic()`

### 4. Editor Integrations
- `insertTextAtCursor(text)`
- `getEditorContent()`
- `setEditorContent(text)`
- `resolveEditorMode(filename)`
- `insertLinkToEditor(path, name)`

---

## 🏗️ Architectural Options for the SDK

Currently, `InSetuElement` provides `this.api` and `this.utils`. How should we expose the rest?

### Option A: The Monolithic `this.os` Getter
Group everything that interacts with the parent system under one umbrella.
*   **Usage:** `this.os.viewSourceFile()`, `this.os.openWorkspaceBrowser()`, `this.os.executeSystemCompile()`.
*   **Pros:** Very simple mental model. One place to look for all OS-level capabilities.
*   **Cons:** It becomes a junk drawer. UI commands sit right next to VFS mutations.

### Option B: Domain-Specific Namespaces (Recommended)
Divide the capabilities into logical domain buckets that mirror our backend blueprints (`routes_fs`, `routes_system`).
*   **`this.vfs`:** `this.vfs.download()`, `this.vfs.copy()`, `this.vfs.upload()`.
*   **`this.ui`:** `this.ui.openBrowser()`, `this.ui.toast()`, `this.ui.switchTab()`.
*   **`this.sys`:** `this.sys.compile()`, `this.sys.refresh()`, `this.sys.mutateWorkspace()`.
*   **`this.editor`:** `this.editor.insert()`, `this.editor.getContent()`.
*   **Pros:** Highly semantic, scalable, and self-documenting. Matches the architectural domain logic of the rest of the application.
*   **Cons:** Developers have to remember which bucket a function lives in.

### Option C: The Event-Driven Command Bus
Instead of direct function calls, extensions emit strict command events, decoupling them entirely from the implementation.
*   **Usage:** `this.dispatchCommand('vfs:copy', { filepath: '...' })` or `this.dispatchCommand('ui:open-browser', { mode: 'folder' })`.
*   **Pros:** Absolute decoupling. The OS listens for intents and executes them.
*   **Cons:** No IDE intellisense/autocomplete. Harder to track return values or await async operations like downloads or compiles without complex Promise bridging.

### Option D: Unified `window.inSetu` Global Registry
Instead of binding getters specifically to `InSetuElement`, map everything to the `window.inSetu` object.
*   **Usage:** `window.inSetu.vfs.viewSourceFile()`, `window.inSetu.ui.toast()`.
*   **Pros:** Accessible *everywhere*, including plain JavaScript files, event listeners, or legacy extensions not using `InSetuElement`.
*   **Cons:** Heavy global state, though it's already scoped under one namespace.

---
## 🎯 Decision: Hybrid Option B & D
We will group the methods semantically into `window.inSetu.vfs`, `window.inSetu.ui`, and `window.inSetu.sys` centrally inside the bootloader/FS modules. We will then alias these directly onto `InSetuElement` as getters (e.g., `get vfs() { return window.inSetu.vfs; }`). 

This provides strict, self-documenting IDE domains inside our web components while ensuring plain scripts can still access them without relying on the messy `window.*` root namespace.

## 🚀 Execution Steps
0. Physically relocate misplaced functions to their correct domain files (`gather.js`, `ui_editor.js`) to resolve the "Junk Drawer" effect.
1. Register the namespaced registries (`vfs`, `ui`, `sys`, `editor`) centrally inside `app.js`, `fs.js`, and the newly refactored files.
2. Add the `vfs`, `ui`, `sys`, and `editor` getters to the `InSetuElement` base class in `sdk.js`.
3. Strip all raw `window.functionName` bindings from the core chassis.
4. Refactor all extension UI components to drop ES6 imports and exclusively consume `this.vfs`, `this.sys`, `this.editor`, etc.

---

## ⚠️ Architectural Problems to Watch Out For

1. **The ES6 Import Snare:** As we execute this blueprint, we must completely eradicate `import { ... } from '../app.js'` inside the `extensions/` directory. Extensions should solely import `InSetuElement`, `createExtensionStore`, and Lit dependencies. If they ES6-import from the chassis, we will never achieve true Inversion of Control.
2. **`setContextManifest`:** This is currently exported from `app.js` and imported by extensions. However, it's just a wrapper for `AppStore.setState({ manifest: m })`. We don't need to bloat the SDK with this; extensions can just use the UDF `AppStore` directly if they need to optimistically update the manifest.
3. **DOM Leaks:** Functions like `createFileCard` use `document.createElement`. As we migrate this to `window.inSetu.ui`, we must ensure it doesn't accidentally bind tightly to global document contexts if we plan on using Shadow DOM extensively in the future.
4. **Physical File Misalignments (Junk Drawer Effect):** Due to rapid coding velocity, several methods are physically located in the wrong files, violating strict domain boundaries. These must be relocated before or during the SDK namespace mapping:
   - `executeQuickPack`, `openQuickPackModal`, `clearQuickPacks`: Currently in `fs.js`, but belong in `gather.js` (Context Compilation Domain).
   - `getEditorContent`, `setEditorContent`, `insertTextAtCursor`, `insertLinkToEditor`: Currently in `fs.js`, but belong in `components/ui_editor.js` (Editor UI Domain).
   - `resolveEditorMode`: Currently in `app.js`, but belongs in `components/ui_editor.js` (Editor UI Domain).
5. **Extension-to-Extension Window Leaks:** Extensions are actively circumventing the OS to communicate with each other via the global window (e.g., `window.generateDiffs` in Git, `window.loadTrackerBoard` in Tracker, and Tracker calling an unmapped `window.addFileToLibrary` to talk to Citations). These must be stripped and routed through standard SDK Event Bus commands or unified `AppStore` triggers.