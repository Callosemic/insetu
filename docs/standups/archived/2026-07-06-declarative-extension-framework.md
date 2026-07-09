# Standup Architecture Blueprint: Declarative Extension & Layout Slot Framework

**Date:** 2026-07-06  
**Status:** Stubbed / Planned  
**Mission:** To eliminate imperative initialization scripts, secure cross-tenant boundary isolation, and centralize tab/sub-tab presentation mapping under core runtime enforcement.

---

## 1. The Core Paradigm Shift
To eliminate technical debt and data/visual leaks during hot-swaps, we are transitioning from an imperative registration architecture to a declarative container configuration model. 

* **[span_0](start_span)The Imperative Debt:** Extensions historically execute dynamic DOM injections and register event listeners immediately upon script load [cite: 690-691, 1715-1716]. This makes teardown brittle and forces the core to rely on fragile visibility checks or manual element sweeps [cite: 1904-1906].
* **The Declarative Solution:** Extensions are stripped of self-executing init logic. They must expose a static configuration payload containing their metadata, hook subscribers, and layout mappings. The core micro-kernel becomes the absolute authority on processing, mounting, and evicting these profiles[span_0](end_span).

---

## 2. Tab & Sub-Tab Layout Slot Framework
To standardize presentation boundaries and guarantee clean UI hydration, we establish a **Layout Slot Matrix** within the global registration space.

### The Layout Schema
Instead of calling imperative UI builders directly, extensions declare their structural footprint using a unified layout schema mapping to core-defined view containers.

```javascript
window.ExtensionRegistry.registerExtension('research', {
    name: "Research Triage Inbox",
    version: "1.0.0",
    
    // Declarative Layout Slots Map
    layoutSlots: [
        {
            slot: "slots:primary-navigation",
            id: "research",
            label: "Research",
            order: 4
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "edit", // Maps directly to a primary tab anchor node
            id: "research-triage",
            label: "Research Inbox",
            order: 3
        }
    ],

    // Scoped Request Interceptors
    uiHooks: {
        'zone:modal-edit-toolbar': (executionContext) => { ... }
    }
});

```
### Core Execution Lifecycle
 1. **The Core Skeleton Initialization:** index.html renders the baseline framework layout with fixed slots (#main-tabs-container, etc.) [cite: 819-820].
 2. **The Soft-Swap Eviction Loop:** When a workspace hotswap triggers, performSoftRefresh() purges *only* the contents of slots containing items whose extension ownership token is missing from the incoming tenant configuration [cite: 1043-1046, 1891-1893].
 3. **The Hydration Pass:** The core reads the current active extension manifests, evaluates the layout properties, performs a numerical sort by order, and programmatically compiles the DOM tokens in a single batch render pass.
## 3. Backend: Scoped Event Bus Interception
The backend Event Bus (hooks.py) is upgraded to automatically screen callback execution blocks before invocation.
 * **Boundary Filtering:** The hooks.emit process inspects the target workspace's config.json to verify extension clearance [cite: 611-613, 1030-1032].
 * **Automatic Eviction:** If an extension tries to intercept an OS lifecycle event (e.g., compile_contexts) but is disabled in the request-scoped workspace_id parameters, the Event Bus silently drops the callback execution track [cite: 613, 671-675].