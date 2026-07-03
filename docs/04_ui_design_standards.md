# 04: inSetu UI Design Standards & UX Guardrails

**Identity**: The Architect.
**Mission**: To define the visual, spatial, and user experience (UX) constraints required to maintain a clean, high-performance, and distraction-free interface across the inSetu Developer OS.

---

## 1. Spatial Layout & The "Single Scroll" Rule
The interface must feel like a native application, not a nested web document.
* **No Nested Scrollbars**: There should only ever be ONE scrollable area on the screen at a time. Scrollable areas inside of scrollable areas are strictly forbidden.
* **Edge-to-Edge Canvases**: Primary workspaces (like the File Editor, Board, or Terminal) must consume the exact usable screen area. Use `100dvh` (accounting for mobile safe areas) and a `flex: 1` growing container to stretch the canvas.
## 2. The Fullscreen View Paradigm & Factory Construction
Avoid the "box within a box" feeling.
* **Centralized Modal Construction (`UIFactory`)**: Eradicate hardcoded HTML `<div class="fullscreen-modal">` blocks from templates. All interface expansions must route through `window.UIFactory.createModal`. This guarantees standardized padding, border-radiuses, backdrop z-indexing, and action alignments across all extensions and future-proofs global CSS changes.
* **Flattening the "Box-in-Box" Anti-Pattern**: Avoid wrapping sections in unnecessary background-colored blocks (`background: var(--input-bg); border: 1px solid var(--border)`) inside of modals or views. Let the content flow edge-to-edge. Use bold typography and logical spacing (`gap: 15px`, `margin-bottom: 10px`) to establish visual hierarchy instead of enclosing everything in nested borders.
* **Modals are for Transience**: Traditional constrained pop-ups (modals with backdrops) should only be used for quick, transient interactions (e.g., confirming a deletion, naming a new folder, or picking an option).
* **Parallel Views for Work**: When a user opens a file or engages in a long-form workflow, it must act as a parallel fullscreen view.
Use `ui-fixed-to-top` equivalent headers/toolbars, a `flex-1` wrapper for the main content (which manages its own overflow), and `ui-fixed-to-bottom` equivalent containers for primary actions.

## 3. Toolbars & Responsive Action Arrays
Horizontal space is premium, especially on split-screen setups or tablets.
* **Fluid Wrapping**: Action buttons must use `flex-wrap: wrap`.
* **Smart Overflow**: If a toolbar wraps to a second line and consumes vertical space, implement a `ResizeObserver` to truncate the height and reveal a "..." (More) toggle. Never let a wrapping toolbar permanently push main content off-screen.
* **Text Truncation**: Deep file paths or long titles must truncate intelligently. Use `direction: rtl; text-align: left;` alongside `text-overflow: ellipsis;` to ensure the actual filename remains visible while hiding the deep ancestor directories.

## 4. Theme Variables & Contrast
inSetu supports Dark, Light, and E-Ink modes natively. 
* **No Hardcoded Hex Colors**: Do not hardcode colors like `#fff` or `#000` for backgrounds or text. 
* **Use System Tokens**: Always bind structural elements to the CSS variables: `--bg`, `--pane-bg`, `--input-bg`, `--text`, `--border`, `--btn`, and `--console-bg`.
* **Semantic Action Colors**: It is acceptable to use solid semantic colors for action buttons (e.g., `#ef4444` for Delete, `#10b981` for Save/Accept, `#0284c7` for Download) provided they contrast appropriately with white text.
## 5. State-Driven DOM (UDF)
As mandated by Engineering Standard 01, the UI is a pure presentation layer.
* **Zero DOM Reading**: Modules (`kanban.js`, `bridge.js`) are strictly forbidden from reading state out of the DOM (e.g., querying `document.getElementById('...').value` or checking if an element `.classList.contains('active')` to determine business logic).
* **Zustand Supremacy**: Read and write all state exclusively through the centralized state managers (like `AppStore` or `KanbanStore`) which utilize Zustand.

## 6. The DOM Generation Matrix: HTML vs. JavaScript
To prevent DOM bloat and spaghetti code, the creation of UI elements must strictly adhere to the following boundary rules:

* **Rule 1: The OS Skeleton (HTML-Bound):** The absolute foundational structure—top navigation bars, the global status bar, main tab container shells, and heavy singletons (specifically the `#file-modal` and its `<textarea>` editor)—must be hardcoded in `index.html`. This guarantees instant First Contentful Paint (FCP) and provides stable, immutable anchor nodes for extensions to hook into upon boot.
* **Rule 2: Extension Canvases (JS Template Strings):** Extensions (e.g., Research, Tracker) must inject their primary fullscreen layouts into the OS Skeleton using static `innerHTML` template strings during their registration phase (`ExtensionRegistry.registerTab`). This keeps `index.html` strictly agnostic to domain-specific tools.
* **Rule 3: Transient & Data-Driven Elements (JS Node Creation):** Anything that appears temporarily, layers over the screen, or iterates based on dynamic data (Modals, Dropdowns, Toast notifications, File/Task Cards) MUST be built programmatically via `document.createElement()` or `UIFactory`. Hardcoding hidden `<div style="display: none">` modals or menus in `index.html` is an architectural violation.