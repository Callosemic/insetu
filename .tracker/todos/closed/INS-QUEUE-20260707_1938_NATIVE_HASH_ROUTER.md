---
repo: "insetu"
type: "todo"
status: "closed"
id: INS-QUEUE-20260707_1938_NATIVE_HASH_ROUTER
title: "Zero-Bundler SPA Router (Native Hash Routing) for Virtual Pathing"
created_at: 2026-07-07T19:38:26
closed_at: 2026-07-25T02:17:51
sub_bucket: "None"
---

## Description
To support "Virtual Pathing" (preserving deep state when tabbing away and back) and true stateless multi-tenant routing, we must implement a Zero-Bundler SPA Router. 
Currently, state persistence is highly fragmented. We save the primary tab and sub-tab to \`localStorage\` (e.g., \`insetu_tab\`), but deep state (like \`globalBrowsePath\` or \`selectedJobId\`) only lives in memory and vanishes upon refresh or unmount.

### Execution Blueprint
1. **The Route Schema:** Establish \`window.location.hash\` as the absolute Single Source of Truth (SSOT) for UI state. Structure the hash to mirror OS topology: \`#/{workspace_id}/{tab}/{sub-tab}/{deep_path}\`.
2. **Two-Way State Binding (The UDF Router):**
    * **URL -> State:** When \`window.onhashchange\` fires, parse the string and dispatch the exact path array to the \`AppStore\` and specific extension stores. LitElements subscribe to this path and drill down automatically.
    * **State -> URL:** When a user drills down into a UI component (e.g., clicking a folder in \`<insetu-vfs-explorer>\`), the store subscriber must silently fire \`history.replaceState(null, '', newHash)\` to update the URL without triggering a reload.
3. **Eradicate Fragmented Storage:** Delete the messy \`localStorage.setItem('insetu_tab', ...)\` tracking from \`app.js\`. The URL becomes the sole master of the view.

## Notes / Execution Log
* **Resolution (2026-07-25):** Fully implemented the Zero-Bundler SPA Router. `AppStore` tracks `activeTab`, `activeSubTabs`, and `globalBrowsePath` via `setActiveRoute()`. Two-way binding updates `window.location.hash` on store state changes and reacts to `window.onhashchange` events. Fragmented `localStorage` tab tracking was completely eradicated across `app.js` and `ui_app_shell.js`.