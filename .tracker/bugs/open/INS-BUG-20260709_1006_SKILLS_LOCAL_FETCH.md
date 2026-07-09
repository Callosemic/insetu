---
repo: "insetu"
type: "bug"
status: "open"
id: INS-BUG-20260709_1006_SKILLS_LOCAL_FETCH
title: "Skills Extension Uses Localized API Fetch Wrapper"
created_at: "2026-07-09T10:03:14"
closed_at: null
sub_bucket: "None"
delivery_date: null
tags: ["Frontend", "Compliance", "DRY"]
---

## Description
* **Violation:** `ext_skills.js` introduces a localized `apiFetch` constant to wrap `window.fetch` and append `X-Workspace-ID` tokens dynamically based on the `AppStore`.
* **Impact:** This duplicates the exact behavior flagged for extraction in ticket `INS-QUEUE-20260708_1758_GLOBAL_FETCH_WRAPPER.md`, violating the DRY Utility Centralization mandate.
* **Resolution Path:** Implement the centralized `window.inSetu.fetch` utility in `app.js` and refactor `ext_skills.js` to rely on the global gateway rather than a local polyfill.

## Notes / Execution Log
