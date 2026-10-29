# inSetu OS SDK Interface Contracts (V2 Specification)
This contract sheet serves as the absolute single source of truth for the interfaces between the Core OS Substrate and Custom Functional Extensions. Refer strictly to these signatures during feature development to maintain system-wide multi-tenant compliance.

---
## 1. Backend Extension Substrate (`InSetuExtension`)
Python feature scripts must leverage the unified `InSetuExtension` wrapper to intercept routing contexts safely and isolate multi-tenant data.

### 1.1 Declarative Instantiation
Extensions define their SQLite requirements and UI settings schemas upon initialization.

```python
from insetu.sdk import InSetuExtension
my_ext_bp = InSetuExtension(
    name='my_ext', 
    module_name=__name__, 
    title="My Extension", 
    schema={"my_table": {"id": "TEXT PRIMARY KEY", "val": "TEXT"}},
    settings_schema=[{"id": "api_key", "label": "API Key", "type": "text", "scope": "workspace", "default": ""}],
    volumes={
        "my_domain": {
            "tier": "data",  # "data" (.insetu/data/<ext>/) or "cache" (.insetu/cache/<ext>/)
            "scheme": "ctx",
            "module_subdir": "prompts",  # Optional: Mounts TemplateOverlayVFSDriver for 3-tier cascade
            "legacy_dirs": ["ext/my_ext/data"]  # Auto-migrated on Phase 1 boot
        }
    },
    external_dependencies=["beautifulsoup4", "playwright"],  # Whitelisted PyPI packages
    external_binaries=["git", "node"],                       # Required system binaries in PATH
    post_install_commands=[["$PYTHON", "-m", "playwright", "install", "chromium"]],
    requires_reboot_on_install=False
)

# Retrieve a fully hydrated ExtensionContext bound to a tenant workspace
ctx = my_ext_bp.get_context(workspace_id)

```

### 1.2 The `ExtensionContext` (`ctx`) Object

Route handlers (`@my_ext_bp.route('path')`) and background workers (`@my_ext_bp.worker('task_name')`) receive a `ctx` object to safely interface with the OS.
* **`ctx.workspace_id`** *(String)*: The active multi-tenant tracking scope.
* **`ctx.config`** *(Dict)*: Lazy configuration access to the active workspace configuration map.
* **`ctx.paths`** *(Dict)*: Platform paths directory mappings (e.g., `ctx.paths['workspace_root']`).
* **`ctx.manifest`** *(Property)*: Reads the centralized dual-root (`{"vfs": {...}, "ctx": {...}}`) manifest dictionary.
* **`ctx.resolve_path(filepath, is_absolute_artifact=False, must_exist=False, allow_heal=True)`** *(Method)*: Safely resolves a canonical URI (`vfs://`, `ctx://`, `ws://`) to physical disk coordinates; returns `None` if `must_exist=True` and the file does not physically exist.
* **`ctx.create_entity_file(folder, title, yaml_data, body_content="", prefix=None, filename=None)`** *(Method)*: Standardized Markdown entity generator. Creates a Markdown file with structured YAML frontmatter, slugifies the title, and commits the file atomically to the tenant VFS.
* **`ctx.is_context_on_disk(base_uri, entry=None)`** *(Method)*: Verifies that all constituent chunk files for a compiled context entry physically exist on disk before bypassing compilation.
* **`ctx.read_compiled_context(uri, manifest=None)`** *(Method)*: Reads and seamlessly concatenates all chunks of a multi-part `ctx://` artifact or single VFS file.
* **`ctx.has_missing_domain_artifacts(domain_type)`** *(Method)*: Inspects whether any manifest entry for a specified domain type is missing its physical chunk files on disk.
* **`ctx.compile_context(base_uri, header_block, text_blocks, files, meta, max_kb=None, is_ephemeral=False)`** *(Method)*: SDK gateway delegating context chunking and compilation to the core Gather engine.
* **`ctx.reconcile_domain(domain_uri_prefix, manifest_deltas, domain_dir, filename_suffix="_context.txt", target_repos=None)`** *(Method)*: SDK gateway for flushing VFS barrier sentinels and reconciling domain manifest deltas in SQLite.
* **`ctx.settings.get(key)`** *(Method)*: Retrieves configuration values from the extension's isolated settings UI.
* **`ctx.get_shared_mounts(domain=None)`** *(Method)*: Queries active inter-workspace virtual mounts (`ws://`) declared for the specified domain in `shared_mounts`.
* **`ctx.iter_shared_mount_files(domain, exts=None)`** *(Method)*: Traverses virtual mount trees for a specified domain across authorized publisher workspaces, yielding `(target_ws, ws_uri)`.
* **`ctx.get_manifest_files(target_key)`** *(Method)*: SSOT helper to extract polymorphic lists of files or chunks from the active manifest.
* **`ctx.expand_selection(items)`** *(Method)*: SSOT helper to expand polymorphic selection payloads (files, folders, virtual URIs) into deduplicated physical/logical paths.
* **`ctx.call(capability_name, **kwargs)`** *(Method)*: In-process capability dispatcher executing registered `@route` endpoints across blueprints and returning native dictionaries without HTTP transport overhead.
* **`ctx.emit(event_name, **kwargs)`** *(Method)*: Emits a synchronous event, automatically injecting the tenant workspace ID.
* **`ctx.emit_background(event_name, **kwargs)`** *(Method)*: Emits a background event, automatically injecting the tenant workspace ID.

**Database & I/O Interfaces:**

* **`ctx.db`** *(DatabaseWrapper)*: Automated SQLite connector keyed securely to the active tenant workspace schema. Exposes `.get_all(table)`, `.insert_or_replace(table, dict)`, `.update(table, data, where_col, where_val)`, `.get_by_id(table, id_val, id_col)`, and `.delete(table, col, val)`.
* **`ctx.vfs`** *(VFSTransaction)*: Atomic Virtual File System context. Exposes `.save(filepath, content, data)`, `.delete(filepath, data)`, `.read(filepath)`, `.walk(directory)`, and `.bulk(operations)`. Directly utilizing `os.walk` or `open()` is strictly banned.
* **`ctx.sync_vfs_barrier(timeout=5.0)`** *(Method)*: Enqueues an event barrier sentinel onto `_VFS_WRITE_QUEUE` and halts the current thread until all preceding VFS write transactions physically commit.
* **`ctx.jobs`** *(JobManager)*: Off-thread background execution dispatcher. Exposes `.submit(task_name, coalesce=False, **kwargs)` for immediate tasks. For ledger-scheduled execution, use `submit_job()` for recurring metronome tasks (`interval_ms > 0`) or `submit_one_shot_job()` for self-destructing delayed tasks (`delay_ms`).
    * **Step Chaining:** You may pass a reserved `_chain` dictionary (matching `JobChainPayload`) as a kwarg to `.submit()` to automatically sequence multiple background workers or trigger an `on_complete_hook` event upon final settlement.
* **`resolve_dag_chain(ctx, hook_name)`** *(Helper)*: Queries event hook registrations (e.g. `register_compilation_steps`) and resolves a topologically sorted step chain array matching `ChainStepSchema` (`id`, `anchor` [`source`|`body`|`sink`], `order`, `ext_name`, `worker_name`, `depends_on`). Re-exported directly from `insetu.core.sdk`.

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
* **`this.manifest`**: Accessor reading the live partitioned system manifest dictionary (`{"vfs": {...}, "ctx": {...}}`) from `AppStore`.
* **`.setStatus(msg, timeout, isError)`**: Base helper to emit global status updates via `this.ui.setGlobalStatus`.
* **`.compileSystem()`**: Base helper to trigger background system compilations via `this.sys.executeSystemCompile`.
* **`this.vfs`**: `.viewSourceFile(path)`, `.viewFileGitDiff(path)`, `.isFileGitModified(path)`, `.fetchAndCopy(path)`, `.downloadFile(url)`, `.shareFiles(file, chunks)`, `.normalizeVfsURI(path)`, `.executeBulkMove(items)`, `.executeBulkArchive(items)`, `.executeBulkDelete(items)`
* **`this.ui`**: `.openWorkspaceBrowser(options)`, `.openFolderBrowser(cb)`, `.setGlobalStatus(msg)`, `.viewTextBlob(title, content, suggestedFilename)`, `.popoutProjection(filepath)`
* **`this.sys`**: `.executeWorkspaceMutation(path, payload)`, `.executeSystemCompile()`, `.switchTab(tabId)`, `.refreshManifest()`
* **`AppStore.getState().getBrowsePath(subId)`** / **`setBrowsePath(pathArray, subId)`**: Retrieves or updates active browse paths scoped strictly to a designated sub-tab identifier, reflecting navigation into the URL hash without cross-tab interference.
* **`this.editor`**: `.getEditorContent()`, `.setEditorContent(text)`, `.insertTextAtCursor(text)`
* **`this.utils`**: `.slugify(str)`, `.fuzzyFilterObjects(arr, query)`, `.truncateFilename(filename, maxLen, ellipsis)`, `.copyRawText(text)`, `.normalizeEntityData(data)`, `.extractManifestFiles(manifest, targetKey, domain)`, `.debounce(fn, ms)`, `.formatArtifactSize(meta)`, `.getScopedStorage(key, defaultVal, wsId)`, `.setScopedStorage(key, value, wsId)`, `.removeScopedStorage(key, wsId)`, `.nativeShareFiles(files)`, `BucketAddress.fromFilepath(path, meta)`
* **`.getOfflineMode(extName)`**: Retrieves the declarative offline mode capability (`"full"`, `"read_only"`, `"none"`) for a targeted extension.
* **`.getMissingDependencies(extName)`**: Inspects whether the target extension has missing Python packages or system binaries.
* **`.installExtensionDependencies(extName, onInstalled)`**: Dispatches an in-app background job installing declared whitelisted packages and executing post-install commands.
* **`FsStore.getState().toggleBufferPreview(filepath, forcePreview)`**: Toggles live macro-expanded preview mode on the target buffer.
### 3.2 Client Network Gateway (ADR 0016)

Network synchronization must route through the client API abstraction to inherit multi-tenant isolation tokens natively. Raw `fetch()` is banned. All API methods enforce client-side extension enablement checks against `window.ACTIVE_EXTENSIONS` prior to network dispatch, returning a 403 Forbidden response if the target extension is disabled.
* `this.api.request(url, options, scopeId)`
* `this.api.workspace(path, options)` / `this.api.system(path, options)`
* `this.api.get(path, options)`
* `this.api.post(path, payload, options)`
* `this.api.delete(path, options)`
* `this.api.getJson(path, options)` / `postJson` / `deleteJson`
* `this.api.fetchImmutableText(path, options)`
* `this.api.bindJobAction(endpoint, payloadGetter, options)`
* `this.api.pollJob(jobId, { interval, onProgress, onComplete, onError })`
### 3.3 Brokered Lifecycle Managers
* `this.subscribe(store, selector, listener)`: Unified Zustand observer that cleanly unmounts itself on element disconnection to eliminate memory bleed.
* `this.bindStore(store, selector, options)`: Declarative store binding helper on `InSetuElement`. Configures selector-scoped store subscriptions with structural equality checking, custom `equalityFn` overrides, and declarative `autoFetch` callbacks (`autoFetch: () => ...` or `autoFetch: 'fetchData'`) executed automatically on mount and workspace swaps.
* `this.filterItems(items, options)`: Standardized two-tier list filtering utility on `InSetuElement`. Combines active pinned repository filtering (`pinnedRepos`, `repoField`) with fuzzy query matching across item titles, tags, and paths in a single pass.
* `this.registerInterval(callback, delayMs)`: Tracked scheduling mechanism dismantled automatically on component destruction.
* `this.registerGlobalListener(type, target, callback)`: Base-managed event routing wrapper preventing global namespace contamination.
* `this.onWorkspaceLoad(workspaceId)`: Class lifecycle hook invoked reactively when the active workspace context hot-swaps.
* `this.onForceRefresh()`: Class lifecycle hook invoked reactively when the active tab/sub-tab is re-selected or force-refreshed by the user.
* `buildUriFileTree(uris, rootScope)`: Hierarchical virtual file tree constructor. Operates natively on canonical URIs (`vfs://`, `ctx://`, `ws://`), preserving `node.canonicalUri` across directories and files.
* `<insetu-projection-window-controls>`: Reusable projection toolbar control rendering Pop Out and Dock In actions with automated pre-action save hooks.
* `<insetu-schema-repeater>`: Declarative repeater component for dynamic array-of-objects settings. Supports bounds checking (`min_items`, `max_items`), reordering (`chevron-up`, `chevron-down`), item deletion, custom item renders (`custom_render`), nested `record` field layouts, and conditional sub-field evaluation (`show_if`).

---

## 4. Declarative Layout & Action Registry

Extensions do not imperatively append themselves to the DOM. They expose a layout schema to `window.ExtensionRegistry`.

### 4.1 The Configuration Payload

```javascript
window.ExtensionRegistry.registerExtension('my_ext', {
    name: "My Extension",
    version: "2.0.0",
    offline_mode: "full", // Options: "full", "read_only", "none"
    // Injects contextual and bulk buttons onto file/task cards and selection trays
    entityActions: [{
        targetEntity: 'file', // Target entity type or '*'
        targetEntities: ['file', 'folder'], // Optional multi-entity support
        id: 'my-action',
        bulkGroupKey: 'my-group', // Key to aggregate bulk actions across heterogenous items
        label: 'Action',
        bulkLabel: 'Bulk Action', // Optional label override in bulk selection mode
        icon: 'zap',
        intent: 'primary', // success, danger, warning, neutral
        order: 50,
        bulkable: true, // Enables action in multi-select tray
        bulkOnly: false, // Set true to hide from individual card action bars
        match: (data) => data.filepath?.endsWith('.md'),
        onClick: (data, e) => { ... },
        bulkAction: async (items, e) => { ... }, // Bulk handler receiving selected items
        emitEvent: (data) => ({ name: 'insetu:ext:action', detail: data })
    }],
    // Keyboard shortcut bindings
    shortcuts: [
        {
            context: 'global',
            key: 'ctrl+s',
            label: 'Save Active File',
            action: (e) => { ... }
        }
    ],
    // Mounts Lit components into the App Shell routing framework
    layoutSlots: [{
        slot: "slots:sub-navigation",
        targetParent: "edit",
        id: "my_tab",
        label: "My Feature",
        icon: "star",
        intent: "primary",
        order: 10,
        menuStores: ["App"], // Stores to observe for reactive menu item recalculation
        menuActions: (slotCfg) => [{ label: 'New Item', icon: 'plus', onClick: () => { /* ... */ } }],
        component: "insetu-ext-component" // Exclude 'component' if defining a parent container tab
    }],
    // Declarative custom file editor matchers (ADR 0041)
    customEditors: [{ id: 'my-editor', component: 'my-editor-projection', match: (filepath) => filepath.endsWith('.ext'), onOpen: (filepath) => { ... } }],
    // Extends workspace configuration cards with domain-specific controls
    repoConfigOptions: [{ id: 'my-repo-opt', order: 10, component: ({ repo, updateCallback }) => { ... } }],
    bucketConfigOptions: [{ id: 'my-bucket-opt', order: 10, component: ({ bucket, repoDir, updateCallback }) => { ... } }],
    // [DEPRECATED - ADR 0041] Legacy zone hooks (use customEditors, layoutSlots, or window.inSetu.events instead)
    uiHooks: {
        'zone:post-file-save': (filepath) => { /* Deprecated: Use window.inSetu.events */ },
        'zone:modal-ext-menu': (data) => { /* Deprecated: Use layoutSlots */ }
    }
});

```

### 4.2 The Unified Event Bus (ADR 0028)

Decoupled extensions must communicate horizontally using the fail-safe Event Bus.

* **Frontend**: `window.inSetu.events.emit(eventName, detailData)`
* **Backend**: `@hooks.on('event_name')` or `hooks.emit('event_name', **kwargs)`
