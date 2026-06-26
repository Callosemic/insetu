---
id: INSETU-QUEUE-20260622_0442_DOM
title: "Optimize Frontend Speed: DOM Batching"
created_at: 2026-06-22T04:42:00
closed_at: null
tags: [frontend, performance, tech-debt]
---

## Description
Refactor UI rendering functions (like `renderGlobalFSLevel`, `renderBrowseLevel`, and `renderTrackerBoard`) in `app.js` to utilize `DocumentFragment`. This batches DOM insertions and prevents layout thrashing/reflows during large list renders.

## Notes / Execution Log
