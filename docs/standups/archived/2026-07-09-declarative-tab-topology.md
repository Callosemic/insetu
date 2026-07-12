# Architectural Blueprint: Declarative Multi-Page Tab Topology

## 1. Executive Summary & Design Philosophy

This document establishes the architecture for a fully data-driven, declarative navigation system for the inSetu Developer OS. It replaces distributed, imperative UI slot management with a strict separation of concerns:

* **Extension/Core Capabilities**: Modules declare *what content pages* they can compute and supply a *sane fallback structure*.
* **Workspace Topology**: The workspace environment (`config.json`) dictates *where* those pages are physically rendered on screen.
* **Implicit Hiding Rule**: The configuration file is the single source of truth (SSOT). Any capability page omitted from the active layout configuration is implicitly hidden from the user interface.

---

## 2. Extension Registration Interface

Extensions discard imperative DOM injection routines. They must declare their exposed feature routes alongside a preferred visual fallback matrix within `window.ExtensionRegistry`.

### Example: Multi-Page Plugin (`ext_tracker.js`)

```javascript
window.ExtensionRegistry.registerExtension('tracker', {
    name: "Issue Tracker",
    version: "2.0.0",
    component: "insetu-ext-tracker", // Backing Lit component
    pages: ["todos", "bugs", "queue", "log"], // Declared functional capabilities
    
    // Automatic fallback structure if config.json does not override layout
    defaultLayout: [
        {
            tab_id: "tasks",
            label: "Tasks Matrix",
            icon: "📋",
            subtabs: [
                { id: "todos", label: "To-Dos", page_key: "tracker:todos" },
                { id: "bugs", label: "Bugs Log", page_key: "tracker:bugs" },
                { id: "queue", label: "Research", page_key: "tracker:queue" },
                { id: "log", label: "Archive", page_key: "tracker:log" }
            ]
        }
    ]
});

```

### Example: Single-Page Plugin (`ext_flow.js`)

```javascript
window.ExtensionRegistry.registerExtension('flow', {
    name: "Workflows",
    version: "2.0.0",
    component: "insetu-ext-flow", // Backing Lit component
    pages: ["flow"],
    defaultLayout: [
        {
            tab_id: "context", // Requests insertion into the main "Context" tab
            label: "Context Hub",
            subtabs: [
                { id: "flow", label: "Flow Engine", page_key: "flow:flow" }
            ]
        }
    ]
});

```

---

## 3. Configuration Contract (`config.json`)

Workspace configurations can redefine application routing entirely using a declarative `"Tabs"` block. **Omission equals strict exclusion.**

### Example Blueprint: Streamlined Override Configuration

```json
{
  "instance_title": "Minimal Code Studio",
  "extensions": ["tracker", "flow"],
  "Tabs": [
    {
      "tab_id": "context",
      "label": "Context",
      "icon": "🧠",
      "subtabs": [
        { "id": "gather", "label": "Context Gatherer", "page_key": "core:gather" },
        { "id": "flow", "label": "Workflows", "page_key": "flow:flow" }
      ]
    },
    {
      "tab_id": "issues",
      "label": "Engineering Backlog",
      "icon": "🐛",
      "subtabs": [
        { "id": "todos", "label": "Tasks", "page_key": "tracker:todos" },
        { "id": "bugs", "label": "Active Bugs", "page_key": "tracker:bugs" }
      ]
    }
  ]
}

```

* *Result*: `tracker:queue` and `tracker:log` are absent from the array, meaning they are completely pruned from the DOM during layout generation.

---

## 4. Frontend Cascading Resolution Engine (`static/js/app.js`)

The `AppStore` centralizes layout tree computations. On workspace context switches, it validates active components and merges default layouts with configuration overrides.

```javascript
export function compileActiveLayout() {
    const { targetConfigs } = AppStore.getState(); // Pulled from backend payload
    const activeExtensions = window.ACTIVE_EXTENSIONS || []; // Active tenant extensions

    // 1. Strict Configuration Precedence (Omission equals implicit hiding)
    if (targetConfigs.tabs_override) {
        return targetConfigs.tabs_override;
    }

    // 2. Fallback: Structural resolution via extension default manifests
    const registry = window.ExtensionRegistry._manifests; // Internal manifest mapping
    const tabMap = new Map();

    // Inject native core chassis layouts that always exist
    tabMap.set("context", { id: "context", label: "Context", icon: "🧠", subtabs: [] });
    tabMap.set("edit", { id: "edit", label: "Edit", icon: "📝", subtabs: [] });

    registry.forEach((ext, extName) => {
        // Enforce boundary filter: check if the extension is active in this workspace
        if (extName !== 'config' && !activeExtensions.includes(extName)) return;
        if (!ext.defaultLayout) return;

        ext.defaultLayout.forEach(tabDef => {
            if (!tabMap.has(tabDef.tab_id)) {
                tabMap.set(tabDef.tab_id, {
                    id: tabDef.tab_id,
                    label: tabDef.label,
                    icon: tabDef.icon || "",
                    subtabs: []
                });
            }
            const targetTab = tabMap.get(tabDef.tab_id);
            targetTab.subtabs.push(...tabDef.subtabs);
        });
    });

    return Array.from(tabMap.values());
}

```

---

## 5. Runtime Structural Page Router

When a navigation element is activated, the view engine avoids DOM scraping or structural toggles. It instantiates the backed component and forwards view arguments via standardized datasets.

```javascript
export function renderSubtabContent(pageKey) {
    if (!pageKey) return document.createTextNode("No page context assigned.");

    // Core static view exceptions
    if (pageKey === "core:files") return document.createElement("insetu-vfs-explorer");
    if (pageKey === "core:gather") return document.createElement("insetu-ext-gather");

    // Deconstruct string instruction matrix: "tracker:bugs"
    const [extName, pageArg] = pageKey.split(':');
    
    const extMeta = window.ExtensionRegistry._manifests.get(extName);
    if (!extMeta || !extMeta.component) {
        console.error(`[Router Guard] Unresolvable module mapping: ${pageKey}`);
        return document.createTextNode("");
    }

    // CIRCUIT BREAKER: Block execution if configuration requests an unexposed view argument
    if (extMeta.pages && !extMeta.pages.includes(pageArg)) {
        console.warn(`[Security Guard] Blocked execution of hidden page trajectory: ${pageKey}`);
        return document.createTextNode("");
    }

    // Instantiate template element
    const pageViewNode = document.createElement(extMeta.component);
    
    // Inject action argument context into component datasets
    pageViewNode.setAttribute('data-sub-id', pageArg);
    pageViewNode.dataset.subId = pageArg;

    return pageViewNode;
}

```
