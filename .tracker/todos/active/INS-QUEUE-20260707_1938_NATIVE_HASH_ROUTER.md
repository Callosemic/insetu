---
repo: "insetu"
type: "todo"
status: "active"
id: "INS-QUEUE-20260707_1938_NATIVE_HASH_ROUTER"
title: "Zero-Bundler SPA Router (Native Hash Routing) for Virtual Pathing"
created_at: "2026-07-07T19:38:26"
closed_at: null
sub_bucket: "None"
delivery_date: "2026-07-26"
tags: [Architecture, Frontend, Routing, UX]
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