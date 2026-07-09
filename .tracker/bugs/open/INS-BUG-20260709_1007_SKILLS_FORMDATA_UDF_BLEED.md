---
repo: "insetu"
type: "bug"
status: "closed"
id: INS-BUG-20260709_1007_SKILLS_FORMDATA_UDF_BLEED
title: "Skills Extension Bypasses UDF via FormData"
created_at: "2026-07-09T10:03:14"
closed_at: 2026-07-09T11:23:39
sub_bucket: "None"
delivery_date: null
tags: ["Frontend", "Compliance", "UDF"]
---

## Description
* **Violation:** `ext_skills.js` utilized `new FormData(e.currentTarget)` inside the `_handleCreateSkill` method to read values directly from the DOM upon submission.
* **Impact:** This bypassed the continuous, reactive state tracking required by LitElement properties, breaking the strict Unidirectional Data Flow (UDF) mandate.

## Notes / Execution Log
* **Resolution (2026-07-09):** The `_handleCreateSkill` form was thoroughly refactored to align with UDF. The `name="..."` attributes were stripped from the markup. Form inputs are now securely bound to internal state trackers (`this._newSkillForm` and `this._newSkillMetrics`) using native `@input` events. The submit handler synthesizes its payload directly from this reactive state, fully removing the `FormData` DOM-reading trap.
