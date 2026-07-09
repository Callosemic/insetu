---
repo: "insetu"
type: "bug"
status: "open"
id: INS-BUG-20260708_1620_WORKFLOW_UDF_BLEED
title: "Workflow & Gather UDF State Splice Failures"
created_at: 2026-07-08T16:20:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-08-23"
tags: ["Frontend", "UDF", "Performance"]
---

## Description
In `ext_flow.js`, saving or deleting a batch calls `this.fetchBatches()`. This bypasses UDF surgical updates, forcing the browser to execute a full API fetch and re-render all workflow cards from scratch. We must update the Zustand state tree directly and let Lit handle the surgical DOM reconciliation.

## Notes / Execution Log
