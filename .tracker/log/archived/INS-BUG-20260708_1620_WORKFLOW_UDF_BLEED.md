---
repo: "insetu"
type: "bug"
status: "archived"
id: INS-BUG-20260708_1620_WORKFLOW_UDF_BLEED
title: "Workflow & Gather UDF State Splice Failures"
created_at: 2026-07-08T16:20:00
closed_at: 2026-07-09T11:26:53
sub_bucket: "None"
tags: ["Frontend", "UDF", "Performance"]
---

## Description
In `ext_flow.js`, saving or deleting a batch originally called `this.fetchBatches()`. This bypassed UDF surgical updates, forcing the browser to execute a full API fetch and re-render all workflow cards from scratch, imposing an unnecessary N+1 fetch penalty.

## Notes / Execution Log
* **Resolution (2026-07-09):** The `saveEditBatch` and `deleteEditBatch` routines have been refactored. They now evaluate the response and perform surgical array splices (`this.batches.filter` and `this.batches.map`) directly on the local state properties. This strictly adheres to Unidirectional Data Flow, allowing LitElement to efficiently reconcile the DOM without triggering secondary network fetches.
