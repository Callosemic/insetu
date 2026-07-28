# Blueprint: Adaptive Tab Navigation & 3-Column Spatial Viewport

**Date:** July 28, 2026  
**Status:** Proposed / Blueprint  
**Subsystem:** Frontend Presentation Shell (`yenvui-toolbar`, `AppStore.js`, Spatial Layout Shell)  
**Estimated Build Effort:** 8–10 Hours (1–2 Focused Coding Sessions)

---

## 1. Executive Summary & Core Paradigm

This specification defines the responsive navigation and spatial layout engine for inSetu. Instead of forcing desktop multi-pane grids onto handheld viewports or squishing navigation elements on smaller screens, the system unifies mobile and desktop via two core architectural shifts:

1. **Adaptive Navigation Transformation:** Morphing a two-row mobile navigation stack into a single-line **Breadcrumb Cluster** in landscape/wide viewports.
2. **3-Column Spatial Viewport (Flanking Pin Architecture):** Treating the workspace as a 3-column spatial layout (`[Column 1: Left Context] | [Column 2: Main Focus] | [Column 3: Right Tools/Outputs]`). On mobile, this renders as a 1-viewport CSS Scroll-Snap carousel; on landscape, it expands into a dynamic, multi-column CSS Grid.

---

## 2. Adaptive Header & Navigation System

### 2.1 Viewport Transformation

The navigation bar dynamically shifts based on CSS Container Queries (`@container (min-width: 640px)`) applied to the header shell rather than viewport media queries alone.

#### Mobile / Narrow Layout (Stacked 2-Row Selector)
```text
[Tab1]  [Tab2*] [Tab3] [Tab4]  [sys_icon]
[Sub1]  [Sub2]  [Sub3*]        [setting_icon]

```

* **Row 1 (Macro Selector):** Primary system tabs + system status triggers.
* **Row 2 (Micro Selector):** Active sub-tabs belonging strictly to the selected primary tab + settings trigger.

#### Landscape / Wide Layout (Breadcrumb Cluster)

```text
[Tab2*]: [Sub1] [Sub2] [Sub3*]  |  [Tab1] [Tab3] [Tab4]  [setting_icon] [sys_icon]

```

* **Active Cluster (`[Tab2*]: [Sub1] [Sub2] [Sub3*]`):** The active primary tab morphs into a breadcrumb label leading directly into its active sub-tab pills.
* **Context Separator (`|`):** A subtle vertical divider isolating active task context from global navigation.
* **Global Tray (`[Tab1] [Tab3] [Tab4] [setting_icon] [sys_icon]`):** Unfocused primary tabs and system controls right-align as a low-friction global switcher.

### 2.2 Sub-Tab Pin Badging

Sub-tabs visually reflect their assigned column slot across both mobile and desktop states:

```text
[Tab2*]: [◄ Sub1]  [Sub2*]  [Sub3 ►]  |  [Tab1] [Tab3] [sys_icon]

```

* `[◄ Sub1]`: Pinned to **Column 1** (Left Flank).
* `[Sub2*]`: Active focus in **Column 2** (Center Focus).
* `[Sub3 ►]`: Pinned to **Column 3** (Right Flank).

---

## 3. 3-Column Spatial Viewport Shell

The workspace canvas maintains a fixed spatial mental model regardless of glass size:

* **Column 1 (Left Flank):** Navigators, Outlines, File Trees, Source Material.
* **Column 2 (Center Focus):** Primary Active Canvas (Markdown Editor, Main Kanban, Active Form).
* **Column 3 (Right Flank):** Auxiliaries, Citations, Diffs, AI Bridge, Live Previews.

### 3.1 Mobile Mechanics (1-Viewport Carousel)

* **CSS Scroll-Snap:** The shell container renders three `100vw` pages using `scroll-snap-type: x mandatory`.
* **Center Anchor:** The viewport defaults to Column 2 offset (`100vw`). Tapping header badges (`[◄ Sub1]` or `[Sub3 ►]`) or swiping executes a smooth CSS scroll transition to `0vw` or `200vw`.
* **Auto-Recenter:** Double-tapping the active sub-tab pill or tapping the center header indicator snaps the view back to Column 2.

### 3.2 Landscape Mechanics (Dynamic CSS Grid)

On desktop or wide displays, columns expand horizontally. The layout grid template dynamically recalculates based on active column pins:

```css
/* No pins active (Single Focus) */
.spatial-shell[data-pins="none"] { grid-template-columns: 1fr; }

/* 1 Pin active (Left + Center) */
.spatial-shell[data-pins="left"] { grid-template-columns: 280px 1fr; }

/* 1 Pin active (Center + Right) */
.spatial-shell[data-pins="right"] { grid-template-columns: 1fr 320px; }

/* 2 Pins active (Full Studio) */
.spatial-shell[data-pins="both"] { grid-template-columns: 240px 1fr 300px; }

```

---

## 4. Technical Architecture & State Engine

### 4.1 State Schema (`AppStore.js` / `LayoutStore.js`)

State management tracks column assignments, active mobile viewport anchors, and container dimensions without triggering backend API traffic:

```javascript
// Spatial Layout Zustand Slice
export const createLayoutSlice = (set, get) => ({
  columns: {
    left: { entityId: 'fs:outline', title: 'Outline', pinned: true },
    center: { entityId: 'vfs:chapter_01.md', title: 'Chapter 1', pinned: false },
    right: { entityId: 'citations:references', title: 'References', pinned: true }
  },
  mobileViewportIndex: 1, // 0 = Left, 1 = Center, 2 = Right
  
  // Actions
  pinToColumn: (column, entity) => set((state) => ({
    columns: { ...state.columns, [column]: { ...entity, pinned: true } }
  })),
  
  unpinColumn: (column) => set((state) => ({
    columns: { ...state.columns, [column]: { ...state.columns[column], pinned: false } }
  })),
  
  setMobileViewport: (index) => set({ mobileViewportIndex: index }),
});

```

### 4.2 DOM Preservation & Node Caching Strategy

To prevent Lit Web Components (specifically CodeMirror 6 text editors and xTerm terminal instances) from unmounting and losing cursor position, scroll offsets, or undo buffers during column pinning or window resizing:

1. **Web Component Slots:** `<insetu-spatial-viewport>` utilizes named slots (`<slot name="col-left">`, `<slot name="col-center">`, `<slot name="col-right">`).
2. **Persistent DOM Node Cache:** If an active component moves between slots, the shell performs direct JavaScript DOM node re-parenting (`element.appendChild(cachedNode)`) rather than destroying and re-instantiating Lit render trees.

---

## 5. Execution Breakdown

| Phase | Core Deliverable | Technical Target | Est. Effort |
| --- | --- | --- | --- |
| **Phase 1** | Layout State Slice | Add column pinning and viewport state to Zustand store. | 0.5 Hours |
| **Phase 2** | Adaptive Header Component | Implement `@container` query rules for the Breadcrumb Cluster in `<yenvui-toolbar>`. | 2.0 Hours |
| **Phase 3** | Spatial Viewport Shell | Build `<insetu-spatial-viewport>` supporting CSS Grid & CSS Scroll-Snap. | 3.0 Hours |
| **Phase 4** | DOM Preservation Layer | Implement slotting/node-caching for persistent Lit component state. | 2.5 Hours |
| **Total** |  |  | **~8.0 Hours** |
