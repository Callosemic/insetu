---
repo: "insetu"
type: "bug"
status: "open"
id: INS-BUG-20260709_1007_SKILLS_FORMDATA_UDF_BLEED
title: "Skills Extension Bypasses UDF via FormData"
created_at: "2026-07-09T10:03:14"
closed_at: null
sub_bucket: "None"
delivery_date: null
tags: ["Frontend", "Compliance", "UDF"]
---

## Description
* **Violation:** `ext_skills.js` utilizes `new FormData(e.currentTarget)` inside the `_handleCreateSkill` method to read values directly from the DOM upon submission.
* **Impact:** This bypasses the continuous, reactive state tracking required by LitElement properties, breaking the strict Unidirectional Data Flow (UDF) mandate.
* **Resolution Path:** Form inputs in the "New Skill Item" modal must be securely bound to reactive properties in the Lit class via `@input` event listeners. The submit handler should then draw its payload directly from the component's state rather than scraping the DOM.

## Notes / Execution Log
