# Sutram Platform API & Interface Contracts

This document defines the strict, complete API surface of the Sutram IoC Micro-Kernel and presentation chassis. Host applications and extension developers must interact exclusively with this `sutram-*` API boundary. Direct manipulation of the underlying `yenVUI` DOM layer is prohibited.

## I. Base Class & Component Memory Safety

All UI components extending the platform must inherit from `SutramElement`. This base class provides automated memory safety and teardown for global listeners and state subscriptions.

*   **`this.subscribe(storeOrName: Object|String, selector: Function, listener: Function)`**: Subscribes to a Zustand store. Automatically unsubscribes on `disconnectedCallback`. Accepts the store object or a string key for lazy hydration. With a selector and listener it reports changes after subscribing, not the current value (so tick- or event-style slices do not fire on mount); read the current state yourself, or use `bindStore`, when the component must reflect state that already exists.
*   **`this.bindStore(store: Object, stateMapper: Function, options: Object)`**: Maps a store slice onto the component's properties: applies the current slice immediately, then every change. `options` accepts `{ autoFetch, equalityFn }`; `autoFetch` (default `'fetchData'`) names a store action, or is a function, called once for the active scope.
*   **`this.registerGlobalListener(eventType: String, targetNode: Element|Window, callback: Function)`**: Safely binds DOM events. Automatically removes the listener on unmount.
*   **`this.registerInterval(callback: Function, delayMs: Number)`**: Registers a safe metronome loop executing every `delayMs` (milliseconds). Automatically cleared on unmount.
*   **`this.dispatch(eventName: String, detail: Object)`**: Ergonomic wrapper for dispatching composed, bubbling `CustomEvent` payloads.

## II. The Extension Registry Configuration

Extensions must register their UI topology via `window.ExtensionRegistry.registerExtension(name: String, config: Object)`. The `config` object accepts the following declarative arrays:
*   **`layoutSlots`**: Projects components into the `<sutram-app-shell>`.
    *   Schema: `{ slot: "slots:sub-navigation", targetParent: "tab_id", id: "sub_id", label: "Label", icon: "icon-name", intent: "primary", order: 1, component: "custom-tag" }`
*   **`variantSets`**: Registers named variant-set split buttons (one level of navigation; cannot be nested inside another set or group).
    *   Schema: `{ id: "send", label: "Send", icon: "send", intent: "primary", group: "share", surfaced: 1, order: 10, sections: ["Raw", "Expanded"], families: { files: ["file", "file:note", "file:prompt"] }, defaults: { files: ["file-copy", "file-share", "file-download"] } }`
*   **`entityActions`**: Defines contextual and bulk buttons for the `<sutram-entity-actions>` and selection tray brokers.
    *   Schema: `{ targetEntity: "type", targetEntities: ["type1", "type2"], id: "str", bulkGroupKey: "str", label: "str" | (data) => "str", bulkLabel: "str" | (items) => "str", successLabel: "Copied", set: "send", section: "Raw", group: "file|edit|share|vcs|tools", surfaced: 1, order: 10, icon: "str" | (data) => "str", intent: "primary", variant: "tinted", emphasis: bool, bulkable: bool, bulkOnly: bool, vfsBound: bool, keepDrawerOpen: bool, keepSelection: bool, isActive: bool | (data) => bool, match: (data) => bool, emitEvent: (data) => ({name, detail}), asyncAction: async (data, e) => {...}, onClick: (data, e) => {...}, bulkAction: async (items, e) => {...}, bulkOnClick: (items, e) => {...} }`
*   **Who clears the selection:** the selection tray and the view menu clear it when a bulk action settles. An action never clears it itself, except one that hands off to a dialog (move, archive, delete, push): that action declares `keepSelection: true`, so a cancelled dialog keeps the selection, and the dialog clears it on success.
*   **`settingsActions`**: Injects buttons into the host's settings UI.
    *   Schema: `{ id: "str", label: "str", icon: "str", onClick: async () => {...} }`
*   **`shortcuts`**: Registers global keybindings.
    *   Schema: `{ context: "global", key: "ctrl+s", label: "str", action: () => {...} }`
*   **`customEditors`**: Intercepts file/resource clicks to launch custom modals or spatial projections.
    *   Schema: `{ id?: "str", component?: "custom-tag", match: (filepath) => bool, onOpen: (filepath) => {...} }`
*   **`repoConfigOptions` / `bucketConfigOptions`**: Injects form toggles directly into the host's configuration matrix.
    *   Schema: `{ id: "str", order: 1, component: ({repo/bucket, updateCallback}) => html\`...\` }`
*   **`uiHooks`**: Host callback hooks invoked by Sutram primitives (`sutram:is-projection-dirty`, `sutram:rekey-projection-id`, `sutram:resolve-item-size`, `sutram:resolve-item-kind`, etc.).

### Registry Lifecycle & Event Methods
*   **`ExtensionRegistry.getManifestEntries(field: String, { activeOnly = true })`**: Returns `[{ extName, value }]` in registration order for a manifest key, applying `setFilterPredicate` when `activeOnly` is true.
*   **`ExtensionRegistry.collectManifestField(field: String, options: Object)`**: Flattens array/scalar values across `getManifestEntries(field, options)`.
*   **`ExtensionRegistry.getExtensionNames({ activeOnly = false })`**: Returns registered extension identifiers (filtered to active extensions when `activeOnly` is true).
*   **`ExtensionRegistry.setActionFilter(predicateFn: Function)`**: Installs a pre-collapse host filter `(action, itemData, entityType) => boolean` evaluated before variant sets collapse across both single-entity and every-item bulk paths.
*   **`ExtensionRegistry.registerVariantSet(setDef: Object)`**: Registers or merges a variant set definition (`id`, `label`, `icon`, `group`, `surfaced`, `sections`, `families`, `defaults`). Refuses nested sets/groups.
*   **`ExtensionRegistry.registerEntityFamilies(familyMapping: Object)` / `resolveEntityFamily(entityType: String)`**: Maps entity types to family keys for first-use variant preference resolution.
*   **`ExtensionRegistry.getLastUsedVariant(entityType: String, setId: String)` / `setLastUsedVariant(entityType: String, setId: String, variantId: String)`**: Reads or persists the device-local last-used variant in `VariantDefaultStore`.
*   **`ExtensionRegistry.registerTick(extName: String, intervalMs: Number, callback: Function)`**: Hooks a callback into the unified frontend metronome loop, executing every `intervalMs` (milliseconds).
*   **`ExtensionRegistry.registerUnloadHook(extName: String, callback: Function)`**: Registers teardown logic executed when the extension is dynamically unmounted.
*   **`ExtensionRegistry.registerUIHook(zone: String, callback: Function)`**: Registers a callback to a synchronous UI event bus zone.
*   **`ExtensionRegistry.executeUIHook(zone: String, data: Any)`**: Dispatches data to a synchronous UI event bus zone.

## III. State Management & Utilities
*   **`createSutramStore(name: String, initialState: Object, persistenceSchema: Object, getScopeId: Function, prefix: String)`**: Generates a Zustand vanilla store wrapped with devtools and `subscribeWithSelector`. `persistenceSchema` supports `{ localSync: [...], sessionSync: [...], onEvict: { windowId: resetStateOrFn } }`.
*   **`bindStoreInput(store: Object, statePath: String, currentValue: Any, options: Object)`**: Utility to automate 2-way binding between Sutram form inputs and Zustand stores. `options` accepts `{ type, label, placeholder, selectOptions, onUpdate, inline, flush, grow }`.
*   **`createJobPoller(apiClient: Object)`**: Factory returning a standalone async poller (`pollJob(jobId: String, options: Object)`). `options` accepts `{ onProgress(msg), onComplete(statusData), onError(err) }`.
*   **Pure Utilities (`window.inSetu.utils` / `window.Sutram.utils`)**:
    *   `fuzzyFilterObjects(items: Array, query: String, searchStringAccessor: Function)`
    *   `debounce(callback: Function, delayMs: Number)`
    *   `slugify(str: String)`
    *   `copyRawText(text: String)`
    *   `timeAgo(timestamp: Number|String)`: Accepts epoch milliseconds or an ISO date string.
*   **Column bands (ES exports of `sutram_sdk.js`, from yenVUI's `physics.js`; `docs/models/column_bands.md`)**: the only place layout widths live (`RAW_BAND_WIDTH_BAN`).
    *   `BAND_QUERY`: container-query conditions for CSS (`compact`, `narrow`, `mediumUp`, `belowWide`, `wide`), measured on the nearest `yv-band` container.
    *   `columnBandOf(width: Number)`: returns `{ band, capability, compact }` (`narrow` below 720 px, `medium` 720 to 1080 px, `wide` 1080 px and up; `compact` below 384 px).
    *   `observeColumnBand(el: Element, callback: Function)`: calls back with the band of the element's column container when it changes; returns a stop function.
    *   `columnCountFor(width: Number, maxColumns?: Number)`: how many shell columns a width holds (unit 360 px, switching at 540 and 900 px).

## IV. Inversion of Control (IoC) Brokers

### `<sutram-entity-actions>`
The core dynamic action broker implementing the **fit-then-overflow** action row rule (`computeFitActionCount`). It queries `ExtensionRegistry.getEntityActions` (or accepts a pre-resolved `.actionsList`), renders as many surfaced buttons and `<sutram-variant-btn>` split buttons as fit in the measured container width, and places remaining and destructive (`intent="danger"`) actions under section headings inside a trailing 3-dot `<sutram-dropdown>`.
*   **Properties:** 
    *   `entityType="string"`: The compound type to query against the registry (e.g., `'file'`, `'virtual_keyboard'`).
    *   `.entityData=${Object}`: The payload passed to the action callbacks. **Must contain an identity property (like `filepath` or `id`)**. Transient boolean states should be tunneled into this object.
    *   `.actionsList=${Array}`: Optional pre-resolved action array (used by `<sutram-selection-tray>` for bulk actions).
    *   `variant="row|footer|menu-bar"`: Display mode (`'row'` default fit-then-overflow, `'footer'` full-width bar, `'menu-bar'` grouped top dropdowns).

### `<sutram-variant-btn>`
Split button primitive for collapsed `kind: 'variant-set'` entries. The main button runs the active default variant (device-local last-used via `VariantDefaultStore`, falling back to the entity family's ordered preference list) and reserves `--variant-min-width` for the longest available variant label; the arrow trigger opens a sectioned `<sutram-dropdown>` with a 900ms on-item confirmation hold (`ACTION_CONFIRM_HOLD_MS`).
*   **Properties:** `.setEntry` (Object), `.entityType` (String), `.entityData` (Object), `?compact` (Boolean), `.executeAction` (Async Function).

### `<sutram-generic-settings>`
Dynamically generates form controls from backend JSON schemas.
*   **Methods:** `this.shadowRoot.querySelector('sutram-generic-settings').openModal(extName: String, schema: Array, formData: Object)`

## V. Layout & Container Primitives

*   **`<sutram-app-shell>`**: Top-level declarative tab layout shell.
*   **`<sutram-view>`**: Primary viewport container. Properties: `.titleText`, `.descriptionText`, `?compact`, `?flush`, `?noScroll`, `?zen`, `size` (`'compact'` | `'normal'` | `'wide'` | `'full'`). Slots: `header`, `header-actions`, `toolbar`, `overlay`, default, `footer` (direct buttons in `slot="footer"` automatically form a full-width action bar).
*   **`<sutram-stack>`**: Flex and auto-fit CSS Grid layout stack. Properties: `direction` (`'col'` | `'row'` | `'grid'`), `?compact`, `columns` (`'compact'` | `'normal'` | `'wide'`), `gap` (`'none'` | `'compact'` | `'normal'` | `'wide'`), `align`, `justify`, `padding` (`'none'` | `'compact'` | `'normal'` | `'wide'`), `?grow`, `?wrap`, `?flex`, `?scrollable`, `?spanFull`.
*   **`<sutram-surface>`**: Semantic container surface. Properties: `variant` (`'panel'` | `'inset'` | `'tinted'` | `'floating'` | `'ghost'`), `intent`, `?compact`, `?flush`, `padding` (`'none'` | `'compact'` | `'normal'` | `'wide'`), `border` (`'all'` | `'top'` | `'bottom'` | `'left'` | `'none'`), `gap` (`'none'` | `'compact'` | `'normal'` | `'wide'`), `align`, `justify`, `?flex`, `?interactive`.
*   **`<sutram-card>`**: Polymorphic catalog item. Automatically binds to `SelectionStore` if `selectionStoreKey` is provided. Properties: `.titleText`, `.descriptionText`, `.detailText`, `.detailPrefix`, `.detailSuffix`, `.icon`, `.intent` (`'primary'` | `'success'` | `'warning'` | `'danger'` | `'neutral'` | `'highlight'`), `?selected`, `?disableSelection`, `selectionStoreKey="Selection"`, `?compact`, `?flush`, `?stale`. Emits `@sutram-card-select-toggled`.
*   **`<sutram-card-group>`**: Wraps cards with horizontal gesture locking and accordion physics. Properties: `?enableEdgeSelection`, `?stacked`, `?accordion`.
*   **`<sutram-modal>`**: Native `#top-layer` dialog overlay. Properties: `?open`, `.titleText`, `?compact`, `size` (`'compact'` | `'normal'` | `'wide'` | `'full'`), `?fullscreen`, `?flush`. Emits `@sutram-modal-closed`.
*   **`<sutram-board>` & `<sutram-column>`**: Multi-column flex grid layout. Column properties: `.titleText`, `.intent` (`'primary'` | `'success'` | `'warning'` | `'danger'` | `'highlight'` | `'neutral'`).
*   **`<sutram-collapsible>`**: Expandable accordion container. Properties: `.titleText`, `?open`, `.intent`, `?flush`. Emits `@sutram-collapsible-toggled`.
*   **`<sutram-category-section>`**: Categorized list section wrapper. Properties: `.titleText`.
*   **`<sutram-categorized-list>`**: Grouping renderer. Properties: `.items` (Array), `.categoryKey` (String), `.categoryOrder` (Array), `.renderItem` (Function), `.renderCategoryHeader` (Function).
*   **`<sutram-selector-modal>`**: Fuzzy-searchable item picker modal. Properties: `?open`, `.titleText`, `.items`. Emits `@item-selected`.
*   **`<sutram-folder-browser>`**: Interactive directory tree browser with breadcrumbs. Properties: `.files` (Array of paths), `.currentPath` (Array of strings). Emits `@path-changed`.

## VI. Interactive Primitives
*   **`<sutram-btn>` & `<sutram-async-btn>`**: Action buttons (`<sutram-async-btn>` includes an integrated state machine `idle` -> `loading` -> `success` | `error`). Properties: `.label`, `.icon`, `.intent`, `.variant`, `?compact`, `?emphasis`, `?grow`, `?fullWidth`, `?disabled`, `?active`. For `<sutram-async-btn>`, bind a functional object to `.onClick=${async (e) => {...}}`.
*   **`<sutram-report-projection>`**: Generalized spatial viewport projection for multi-tab or single-block reports, logs, and dry-run outputs. Properties: `.caption` (String), `.content` (String), `.tabs` (Array of `{ id, label, icon, content }`), `.activeTab` (String), `.actions` (Array of `{ label, icon, intent, primary, asyncAction, onClick, disabled }`), `.extraContent` (TemplateResult), `.suggestedFilename` (String).
*   **`<sutram-diff-viewer>`**: Side-by-side structural comparison primitive backed by CodeMirror 6 `@codemirror/merge`. Properties: `.diffText` (String), `.searchStr` (String), `.replaceStr` (String), `.leftTitle` (String), `.rightTitle` (String).
*   **`<sutram-editor>`**: State-aware wrapper for CodeMirror 6. Properties: `.value`, `?readOnly`, `.language`, `?writingMode`, `.customExtensions`, `?enableWordcount`. Methods: `insertAtCursor(text: String)`. Emits `@editor-changed`.
*   **`<sutram-dropdown>`**: Context menu. Properties: `.items` (Array of `{label, icon, onClick}`), `?open`, `?searchable`, `?chipRows`, `.align`, `.direction`.
*   **`<sutram-tag>`**: Badge label. Properties: `.text`, `.intent`.
*   **`<sutram-label>`**: Standardized typography label primitive. Properties: `.text`, `intent` (`'primary'` | `'success'` | `'warning'` | `'danger'` | `'highlight'` | `'neutral'`), `?monospace`, `?truncate`.
*   **`<sutram-spinner>`**: Loading indicator. Properties: `.text`.
*   **`<sutram-empty-state>`**: Empty list placeholder. Properties: `.icon`, `.text`.

## VII. Form Controls

All Sutram inputs emit the standardized `@sutram-input-changed` event, where `e.detail.value` contains the new state.

*   **`<sutram-input>`:** Single-line text/number input. Properties: `type`, `.label`, `.value`, `.placeholder`, `?disabled`, `?inline`, `?flush`, `?grow`.
*   **`<sutram-textarea>`:** Auto-resizing multi-line text block. Properties: `.label`, `.value`, `.placeholder`, `.rows`, `?monospace`, `?disabled`, `?readOnly`, `?inline`, `?flush`, `?autoSize`, `?borderless`.
*   **`<sutram-select>`:** Dropdown menu. Properties: `.label`, `.value`, `.options` (Array of `{value, label}`), `?disabled`, `?inline`, `?flush`, `?grow`.
*   **`<sutram-toggle>`:** Boolean switch. Properties: `.label`, `.checked`, `?disabled`.
*   **`<sutram-combobox>`:** Searchable text input with filterable dropdown menu. Properties: `.label`, `.value`, `.placeholder`, `.options` (Array of strings or `{value, label, badge}`), `?disabled`, `?inline`, `?flush`.
*   **`<sutram-target-binding>`:** Composite endpoint and model selector pairing an endpoint `<sutram-select>` with a model `<sutram-combobox>`. Properties: `.label`, `.value` (`{endpoint, model}`), `.endpoints` (Array of `{value, label}`), `.models` (Array or resolver Function `(endpointId) => options`), `.endpointPlaceholder`, `.modelPlaceholder`, `?allowEmptyEndpoint`, `?disabled`, `?flush`.

## VIII. Toolbars & Filtering

*   **`<sutram-toolbar>`:** Sticky header integrating search and filters. Properties: `.searchQuery`, `.searchPlaceholder`, `?enableFilterDropdown`, `.filterText`, `.activeFilters`, `?hasFiltersOverride`, `?flush`.
*   **`<sutram-scrub-track>`:** Horizontal touch-scrubbing track. Properties: `?grow`, `?monospace`.
*   **`<sutram-search-bar>`:** Standalone text filter. Properties: `.placeholder`, `.value`. Emits `@search-changed`.
*   **`<sutram-filter-group>`:** Interactive toggle pill array. Properties: `.label`, `.items`, `.activeItems`, `?allowAll`. Emits `@sutram-filter-changed`.
*   **`<sutram-pill>`**: Toggle tag badge. Properties: `.pillId`, `.labelText`, `?active`, `?compact`, `.variant` (`'standard'` | `'text'`). Emits `@sutram-pill-toggled`.

## IX. System State UI Brokers

Sutram provides built-in UI brokers that automatically read from their corresponding global Zustand stores. Host apps only need to interact with the stores.

*   **`ToastStore` & `<sutram-toast-container>`**: Triggers non-blocking alerts. `ToastStore.getState().addToast(message: String, intent: String, durationMs: Number)`.
*   **`SelectionStore` & `<sutram-selection-tray>`**: Manages multi-item selections and batch actions. Properties: `.trayTitle` (e.g., `'Quickpack'`), `.itemBadge` (e.g., `'Context'`), `.chipLabel` (e.g., `'Deck'`). Dispatches through `SelectionStore.getState().toggleSelection(id: String, entityType: String, data: Object)`.
*   **`StatusStore` & `<sutram-status-bar>`**: Triggers the global bottom status bar. `StatusStore.getState().setStatus(msg: String, timeoutMs: Number, isError: Boolean)`.

## X. The Base HTML CSS Vacuum

The `theme-tokens.css` file automatically intercepts and standardizes bare HTML elements to maintain layout parity. Developers do not always need Web Components for simple interactions:
*   Standard `<button>` tags will automatically inherit the `--intent-primary` background.
*   Applying `class="btn-sm"` provides standardized compact padding and font sizing.
*   Standard `<textarea>`, `<input type="text">`, and `<pre>` blocks automatically bind to theme borders and backgrounds.
*   Standard `<table>`, `<th>`, and `<td>` elements inside `sharedStyles` automatically inherit `width: 100%; border-collapse: collapse; font-family: var(--font-mono);` and themed `var(--border)` row dividers so tabular readouts (such as SQL consoles and heap profilers) require zero custom CSS or inline `style` attributes.
*   Applying `class="spinner"` provides a lightweight, pure CSS animated loading ring.