# inSetu OS SDK Interface Contracts (V2 Specification)

This contract sheet serves as the absolute single source of truth for the interfaces between the Core OS Substrate and Custom Functional Extensions. Refer strictly to these signatures during feature development to maintain system-wide multi-tenant compliance.

---
hello

## 1. Backend Extension Substrate (`InSetuExtension`)
Python feature scripts must leverage the unified `InSetuExtension` wrapper to intercept routing contexts safely and isolate multi-tenant data.
1.1 Declarative Instantiation
Extensions define their SQLite requirements and UI settings schemas upon initialization.
from insetu.sdk import InSetuExtension

my_ext_bp = InSetuExtension(
    name='my_ext', 
    module_name=__name__, 
    title="My Extension", 
    schema={"my_table": {"id": "TEXT PRIMARY KEY", "val": "TEXT"}},
    settings_schema=[{"id": "api_key", "label": "API Key", "type": "text", "default": ""}]
)

# Retrieve a fully hydrated ExtensionContext bound to a tenant workspace
ctx = my_ext_bp.get_context(workspace_id)

```

### 1.2 The `ExtensionContext` (`ctx`) Object

Route handlers (`@my_ext_bp.route('path')`) and background workers (`@my_ext_bp.worker('task_name')`) receive a `ctx` object to safely interface with the OS.
* **`ctx.workspace_id`** *(String)*: The active multi-tenant tracking scope.
* **`ctx.config`** *(Dict)*: Lazy configuration access to the active workspace configuration map.
* **`ctx.paths`** *(Dict)*: Platform paths directory mappings (e.g., `ctx.paths['workspace_root']`).
* **`ctx.resolve_path(filepath)`** *(Method)*: Safely anchors a relative path to the physical workspace bounds.
* **`ctx.settings.get(key)`** *(Method)*: Retrieves configuration values from the extension's isolated settings UI.
* **`ctx.get_manifest_files(target_key)`** *(Method)*: SSOT helper to extract polymorphic lists of files or chunks from the active manifest.
* **`ctx.expand_selection(items)`** *(Method)*: SSOT helper to expand polymorphic selection payloads (files, folders, virtual URIs) into deduplicated physical/logical paths.
* **`ctx.emit(event_name, **kwargs)`** *(Method)*: Emits a synchronous event, automatically injecting the tenant workspace ID.
* **`ctx.emit_background(event_name, **kwargs)`** *(Method)*: Emits a background event, automatically injecting the tenant workspace ID.

**Database & I/O Interfaces:**

* **`ctx.db`** *(DatabaseWrapper)*: Automated SQLite connector keyed securely to the active tenant workspace schema. Exposes `.get_all(table)`, `.insert_or_replace(table, dict)`, `.update(table, data, where_col, where_val)`, `.get_by_id(table, id_val, id_col)`, and `.delete(table, col, val)`.
* **`ctx.vfs`** *(VFSTransaction)*: Atomic Virtual File System context. Exposes `.save(filepath, content, data)`, `.read(filepath)`, and `.walk(directory)`. Directly utilizing `os.walk` or `open()` is strictly banned.
* **`ctx.jobs`** *(JobManager)*: Off-thread background execution dispatcher. Exposes `.submit(task_name, coalesce=False, **kwargs)`, `.is_in_flight(task_name)`, `.update_progress(message)`, and `.update_meta(meta_dict)` to emit streaming updates and discrete metrics to the UI.

---

## 2. Frontend State Architecture (`createExtensionStore`)

All extension states must be declared using the centralized object store factory to ensure complete isolation and prevent multi-tenant data leaks during profile shifts.

* `createExtensionStore(name, initialState, persistKeys)`: Generates a Zustand store. Keys listed in the `persistKeys` array are automatically persisted to `localStorage` under a strictly namespaced tenant identifier.
* `store.getState().resetState()`: A framework-invoked callback that clears runtime memory back to baseline parameters during workspace swaps.

---

## 3. Web Component Substrate (`InSetuElement`)

UI elements must inherit from `InSetuElement` (which extends LitElement) rather than native browser elements to capture lifecycle state tracking and SDK accessors automatically. Components **must** declare `static get extensionName() { return 'ext_name'; }`.
### 3.1 Domain Accessors (ADR 0024)

Extensions are strictly forbidden from relative-importing OS chassis functions. They must consume domain getters attached to `this`:
* **`this.ecosystem`**: Auto-hydrated workspace topology (`this.ecosystem.allRepos`, `this.ecosystem.pinnedRepos`, `this.ecosystem.targetConfigs`).
* **`.setStatus(msg, timeout, isError)`**: Base helper to emit global status updates via `this.ui.setGlobalStatus`.
* **`.compileSystem()`**: Base helper to trigger background system compilations via `this.sys.executeSystemCompile`.
* **`this.vfs`**: `.viewSourceFile(path)`, `.fetchAndCopy(path)`, `.downloadFile(url)`, `.shareFiles(file, chunks)`
* **`this.ui`**: `.openWorkspaceBrowser(options)`, `.openFolderBrowser(cb)`, `.setGlobalStatus(msg)`
* **`this.sys`**: `.executeWorkspaceMutation(path, payload)`, `.executeSystemCompile()`, `.switchTab(tabId)`, `.refreshManifest()`
* **`this.editor`**: `.getEditorContent()`, `.setEditorContent(text)`, `.insertTextAtCursor(text)`
* **`this.utils`**: `.slugify(str)`, `.fuzzyFilterObjects(arr, query)`, `.copyRawText(text)`
### 3.2 Client Network Gateway (ADR 0016)

Network synchronization must route through the client API abstraction to inherit multi-tenant isolation tokens natively. Raw `fetch()` is banned. All API methods enforce client-side extension enablement checks against `window.ACTIVE_EXTENSIONS` prior to network dispatch, returning a 403 Forbidden response if the target extension is disabled.
* `this.api.get(path, options)`
* `this.api.post(path, payload, options)`
* `this.api.delete(path, options)`
* `this.api.getJson(path, options)` / `postJson` / `deleteJson`
* `this.api.bindJobAction(endpoint, payloadGetter, options)`
* `this.api.pollJob(jobId, { interval, onProgress, onComplete, onError })`

### 3.3 Brokered Lifecycle Managers
* `this.subscribe(store, selector, listener)`: Unified Zustand observer that cleanly unmounts itself on element disconnection to eliminate memory bleed.
* `this.registerInterval(callback, delayMs)`: Tracked scheduling mechanism dismantled automatically on component destruction.
* `this.registerGlobalListener(type, target, callback)`: Base-managed event routing wrapper preventing global namespace contamination.
* `this.onWorkspaceChanged(newWorkspaceId)`: Class lifecycle hook invoked reactively when the active workspace context hot-swaps.
* `this.onForceRefresh()`: Class lifecycle hook invoked reactively when the active tab/sub-tab is re-selected or force-refreshed by the user.

---

## 4. Declarative Layout & Action Registry

Extensions do not imperatively append themselves to the DOM. They expose a layout schema to `window.ExtensionRegistry`.

### 4.1 The Configuration Payload

```javascript
window.ExtensionRegistry.registerExtension('my_ext', {
    name: "My Extension",
    version: "2.0.0",
    
    // Injects contextual buttons onto file/task cards
    entityActions: [{
        targetEntity: 'file', // Matches the entityType property of an <insetu-card>
        id: 'my-action',
        label: 'Action',
        icon: '⚡',
        intent: 'primary', // success, danger, warning, neutral
        order: 50,
        match: (data) => data.filepath.endsWith('.md'),
        emitEvent: (data) => ({ name: 'insetu:ext:action', detail: data })
    }],

    // Mounts Lit components into the App Shell routing framework
    layoutSlots: [{
        slot: "slots:sub-navigation",
        targetParent: "edit",
        id: "my_tab",
        label: "My Feature",
        order: 10,
        component: "insetu-ext-component" // Exclude 'component' if defining a parent container tab
    }],

    // Binds background listeners or menu injections
    uiHooks: {
        'zone:post-file-save': (filepath) => { /* React to VFS saves */ },
        'zone:modal-ext-menu': (data) => { /* Inject into the file editor dropdown */ }
    }
});

```

### 4.2 The Unified Event Bus (ADR 0028)

Decoupled extensions must communicate horizontally using the fail-safe Event Bus.

* **Frontend**: `window.inSetu.events.emit(eventName, detailData)`
* **Backend**: `@hooks.on('event_name')` or `hooks.emit('event_name', **kwargs)`
