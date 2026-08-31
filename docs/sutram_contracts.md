# Sutram Platform API & Interface Contracts

This document defines the strict, complete API surface of the Sutram IoC Micro-Kernel and presentation chassis. Host applications and extension developers must interact exclusively with this `sutram-*` API boundary. Direct manipulation of the underlying `yenVUI` DOM layer is prohibited.

## I. Base Class & Component Memory Safety

All UI components extending the platform must inherit from `SutramElement`. This base class provides automated memory safety and teardown for global listeners and state subscriptions.

*   **`this.subscribe(storeOrName: Object|String, selector: Function, listener: Function)`**: Subscribes to a Zustand store. Automatically unsubscribes on `disconnectedCallback`. Accepts the store object or a string key for lazy hydration.
*   **`this.registerGlobalListener(eventType: String, targetNode: Element|Window, callback: Function)`**: Safely binds DOM events. Automatically removes the listener on unmount.
*   **`this.registerInterval(callback: Function, delayMs: Number)`**: Registers a safe metronome loop executing every `delayMs` (milliseconds). Automatically cleared on unmount.
*   **`this.dispatch(eventName: String, detail: Object)`**: Ergonomic wrapper for dispatching composed, bubbling `CustomEvent` payloads.

## II. The Extension Registry Configuration

Extensions must register their UI topology via `window.ExtensionRegistry.registerExtension(name: String, config: Object)`. The `config` object accepts the following declarative arrays:

*   **`layoutSlots`**: Projects components into the `<sutram-app-shell>`.
    *   Schema: `{ slot: "slots:sub-navigation", targetParent: "tab_id", id: "sub_id", label: "Label", order: 1, component: "custom-tag" }`
*   **`entityActions`**: Defines buttons for the `<sutram-entity-actions>` broker.
    *   Schema: `{ targetEntity: "type", id: "str", label: "str" | (data) => "str", icon: "str" | (data) => "str", intent: "primary", order: 1, match: (data) => bool, emitEvent: (data) => ({name, detail}), asyncAction: async (data, e) => {...}, onClick: (data, e) => {...} }`
*   **`settingsActions`**: Injects buttons into the host's settings UI.
    *   Schema: `{ id: "str", label: "str", icon: "str", onClick: async () => {...} }`
*   **`shortcuts`**: Registers global keybindings.
    *   Schema: `{ context: "global", key: "ctrl+s", label: "str", action: () => {...} }`
*   **`customEditors`**: Intercepts file/resource clicks to launch custom modals.
    *   Schema: `{ match: (filepath) => bool, onOpen: (filepath) => {...} }`
*   **`repoConfigOptions` / `bucketConfigOptions`**: Injects form toggles directly into the host's configuration matrix.
    *   Schema: `{ id: "str", order: 1, component: ({repo/bucket, updateCallback}) => html\`...\` }`

### Registry Lifecycle & Event Methods
*   **`ExtensionRegistry.registerTick(extName: String, intervalMs: Number, callback: Function)`**: Hooks a callback into the unified frontend metronome loop, executing every `intervalMs` (milliseconds).
*   **`ExtensionRegistry.registerUnloadHook(extName: String, callback: Function)`**: Registers teardown logic executed when the extension is dynamically unmounted.
*   **`ExtensionRegistry.registerUIHook(zone: String, callback: Function)`**: Registers a callback to a synchronous UI event bus zone.
*   **`ExtensionRegistry.executeUIHook(zone: String, data: Any)`**: Dispatches data to a synchronous UI event bus zone.

## III. State Management & Utilities

*   **`createSutramStore(name: String, initialState: Object, persistKeys: Array, getScopeId: Function, prefix: String)`**: Generates a Zustand vanilla store wrapped with devtools and `subscribeWithSelector`. Optionally synchronizes specified keys to `localStorage`.
*   **`bindStoreInput(store: Object, statePath: String, currentValue: Any, options: Object)`**: Utility to automate 2-way binding between Sutram form inputs and Zustand stores. `options` accepts `{ type, label, placeholder, style, selectOptions, onUpdate, inline, flush }`.
*   **`createJobPoller(apiClient: Object)`**: Factory returning a standalone async poller (`pollJob(jobId: String, options: Object)`). `options` accepts `{ onProgress(msg), onComplete(statusData), onError(err) }`.
*   **Pure Utilities (`window.inSetu.utils` / `window.Sutram.utils`)**:
    *   `fuzzyFilterObjects(items: Array, query: String, searchStringAccessor: Function)`
    *   `debounce(callback: Function, delayMs: Number)`
    *   `slugify(str: String)`
    *   `copyRawText(text: String)`
    *   `timeAgo(timestamp: Number|String)`: Accepts epoch milliseconds or an ISO date string.

## IV. Inversion of Control (IoC) Brokers

### `<sutram-entity-actions>`
The core dynamic action broker. It queries the `ExtensionRegistry` to resolve and render buttons for a specific entity.
*   **Properties:** 
    *   `entityType="string"`: The compound type to query against the registry (e.g., `'file'`, `'virtual_keyboard'`).
    *   `.entityData=${Object}`: The payload passed to the action callbacks. **Must contain an identity property (like `filepath` or `id`)**. Transient boolean states should be tunneled into this object.
    *   `?scrollable=${Boolean}`: Enables horizontal scrolling for overflow actions.

### `<sutram-generic-settings>`
Dynamically generates form controls from backend JSON schemas.
*   **Methods:** `this.shadowRoot.querySelector('sutram-generic-settings').openModal(extName: String, schema: Array, formData: Object)`

## V. Layout & Container Primitives

*   **`<sutram-app-shell>`**: Top-level declarative tab layout shell.
*   **`<sutram-card>`**: Polymorphic catalog item. Automatically binds to `SelectionStore` if `selectionStoreKey` is provided. Properties: `.titleText`, `.descriptionText`, `.detailText`, `.detailPrefix`, `.detailSuffix`, `.icon`, `.intentColor`, `?selected`, `?disableSelection`, `selectionStoreKey="Selection"`, `?compact`, `?flush`. Emits `@sutram-card-select-toggled`.
*   **`<sutram-card-group>`**: Wraps cards with horizontal gesture locking and accordion physics. Properties: `?enableEdgeSelection`, `?stacked`, `?accordion`.
*   **`<sutram-modal>`**: Native `#top-layer` dialog overlay. Properties: `?open`, `.titleText`, `?fullscreen`, `?flush`, `.maxWidth`. Emits `@sutram-modal-closed`.
*   **`<sutram-board>` & `<sutram-column>`**: Multi-column flex grid layout. Column properties: `.titleText`, `.intentColor`.
*   **`<sutram-collapsible>`**: Expandable accordion container. Properties: `.titleText`, `?open`, `.intent`, `?flush`. Emits `@sutram-collapsible-toggled`.
*   **`<sutram-category-section>`**: Categorized list section wrapper. Properties: `.titleText`.
*   **`<sutram-categorized-list>`**: Grouping renderer. Properties: `.items` (Array), `.categoryKey` (String), `.categoryOrder` (Array), `.renderItem` (Function), `.renderCategoryHeader` (Function).
*   **`<sutram-selector-modal>`**: Fuzzy-searchable item picker modal. Properties: `?open`, `.titleText`, `.items`. Emits `@item-selected`.
*   **`<sutram-folder-browser>`**: Interactive directory tree browser with breadcrumbs. Properties: `.files` (Array of paths), `.currentPath` (Array of strings). Emits `@path-changed`.

## VI. Interactive Primitives

*   **`<sutram-async-btn>`**: Action button with an integrated state machine (`idle` -> `loading` -> `success` | `error`). Properties: `.label`, `.loadingLabel`, `.successLabel`, `.errorLabel`, `.intent` (e.g., `'primary'`, `'danger'`), `?disabled`, `?active`. You MUST bind a functional object to `.onClick=${async (e) => {...}}`.
*   **`<sutram-editor>`**: State-aware wrapper for CodeMirror 6. Properties: `.value`, `?readOnly`, `.language`, `?writingMode`, `.customExtensions`, `?enableWordcount`. Methods: `insertAtCursor(text: String)`. Emits `@editor-changed`.
*   **`<sutram-dropdown>`**: Context menu. Properties: `.items` (Array of `{label, icon, onClick}`), `?open`, `.align`.
*   **`<sutram-tag>`**: Badge label. Properties: `.text`, `.intent`.
*   **`<sutram-label>`**: Standardized label primitive. Properties: `.text`.
*   **`<sutram-spinner>`**: Loading indicator. Properties: `.text`.
*   **`<sutram-empty-state>`**: Empty list placeholder. Properties: `.icon`, `.text`.

## VII. Form Controls

All Sutram inputs emit the standardized `@sutram-input-changed` event, where `e.detail.value` contains the new state.

*   **`<sutram-input>`:** Single-line text/number input. Properties: `type`, `.label`, `.value`, `.placeholder`, `?disabled`, `?inline`.
*   **`<sutram-textarea>`:** Auto-resizing multi-line text block. Properties: `.label`, `.value`, `.placeholder`, `.rows`, `?monospace`, `?disabled`, `?readOnly`, `?inline`, `?autoSize`, `?borderless`.
*   **`<sutram-select>`:** Dropdown menu. Properties: `.label`, `.value`, `.options` (Array of `{value, label}`), `?disabled`, `?inline`.
*   **`<sutram-toggle>`:** Boolean switch. Properties: `.label`, `.checked`, `?disabled`.

## VIII. Toolbars & Filtering

*   **`<sutram-toolbar>`:** Sticky header integrating search and filters. Properties: `.searchQuery`, `.searchPlaceholder`, `?enableFilterDropdown`, `.filterText`, `.activeFilters`, `?hasFiltersOverride`, `?bottomBorder`.
*   **`<sutram-search-bar>`:** Standalone text filter. Properties: `.placeholder`, `.value`. Emits `@search-changed`.
*   **`<sutram-filter-group>`:** Interactive toggle pill array. Properties: `.label`, `.items`, `.activeItems`, `?allowAll`. Emits `@sutram-filter-changed`.
*   **`<sutram-pill>`**: Toggle tag badge. Properties: `.pillId`, `.labelText`, `?active`, `?small`, `.variant` (`'standard'` | `'text'`). Emits `@sutram-pill-toggled`.

## IX. System State UI Brokers

Sutram provides built-in UI brokers that automatically read from their corresponding global Zustand stores. Host apps only need to interact with the stores.

*   **`ToastStore` & `<sutram-toast-container>`**: Triggers non-blocking alerts. `ToastStore.getState().addToast(message: String, intent: String, durationMs: Number)`.
*   **`SelectionStore` & `<sutram-selection-tray>`**: Manages multi-item selections and batch actions. `SelectionStore.getState().toggleSelection(id: String, entityType: String, data: Object)`.
*   **`StatusStore` & `<sutram-status-bar>`**: Triggers the global bottom status bar. `StatusStore.getState().setStatus(msg: String, timeoutMs: Number, isError: Boolean)`.

## X. The Base HTML CSS Vacuum

The `theme-tokens.css` file automatically intercepts and standardizes bare HTML elements to maintain layout parity. Developers do not always need Web Components for simple interactions:
*   Standard `<button>` tags will automatically inherit the `--intent-primary` background.
*   Applying `class="btn-sm"` provides standardized compact padding and font sizing.
*   Standard `<textarea>`, `<input type="text">`, and `<pre>` blocks automatically bind to theme borders and backgrounds.
*   Applying `class="spinner"` provides a lightweight, pure CSS animated loading ring.