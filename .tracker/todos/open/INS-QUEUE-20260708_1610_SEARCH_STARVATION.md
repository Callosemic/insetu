---
repo: "insetu"
type: "todo"
status: "open"
id: INS-QUEUE-20260708_1610_SEARCH_STARVATION
title: "Resolve External Network and Deep Search Starvation"
created_at: 2026-07-08T16:10:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-08-23"
tags: ["Backend", "Performance", "Search"]
---

## Description
1. `search_global_citations()` in `engine_citations.py` executes synchronous `urllib.request.urlopen` HTTP calls to external APIs, risking thread lockup on bad connections. This must be offloaded to an immediate job.
2. `search_workspace_files()` in `utils_core.py` performs synchronous, sequential disk reads of all workspace Markdown files for deep link searching. This must be deferred to a background indexing task using an SQLite Full-Text Search (FTS) table.

## Notes / Execution Log
