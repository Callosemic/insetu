---
repo: "insetu"
type: "todo"
status: "logged"
id: INS-QUEUE-20260713_0204_SDK_DEBT_SWEEP
title: "Sweep V2 SDK Guardrail Violations & Technical Debt"
created_at: 0000-00-00T00:00:00
closed_at: 2026-08-05T19:46:44
sub_bucket: "None"
tags: ["Tech Debt", "SDK", "Refactor", "Compliance"]
---

## Description
During the end-of-session architectural audit on July 13, 2026, several anti-patterns violating the **Phase 7: The Extension SDK & "Pit of Success" Blueprint (ADR 0017)** Component Graduation Checklist were identified. These must be resolved to maintain strict Unidirectional Data Flow (UDF) and isolated multi-tenant constraints.
### Action Items
- [x] **UI State Sniffing (Frontend Rule 6 Violation):** `ext_tracker.js` and `ext_skills.js` currently rely on `localStorage.getItem('insetu_subtab_...')` to determine active view rendering logic. Decouple these from the browser storage APIs and pipe them through reactive `AppStore` properties.
- [x] **Manual Async Button State (Frontend Rule 7 Violation):** `ext_citations.js` harbors local imperative DOM text mutations (`origText`, `setTimeout` resetting) during fetch actions. Refactor to use `<insetu-async-btn>` or the centralized `app.js` blob/copy utilities.
- [x] **Rogue Database Initialization (Backend Rule 2 Violation):** In `engine_gather.py`, the `generate_context_file()` method imperatively executes `CREATE TABLE IF NOT EXISTS ephemeral_artifacts` directly on the `workers` DB connection on every compile. Extract this into a formal declarative schema on the core OS bootloader or bound to the `workers.py` initialization layer.
- [x] **Documentation Drift:** Update the Migration Tracker table inside `INS-TODO-20260709_2219_EXTENSION_SDK.md`. Change the status of `tracker`, `citations`, `git`, `flow`, `research`, and `skills` from "Pending" to "Migrated" to reflect reality.