---
repo: "insetu"
type: "queue"
status: "open"
id: INS-QUEUE-20260708_1605_THREAD_STARVATION
title: "Offload URL Ingestion and Quick-Packs to Immediate Jobs"
created_at: 2026-07-08T16:05:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-08-23"
tags: ["Backend", "Performance", "Async"]
---

## Description
The `/api/ingest/url` and `/api/<workspace_id>/gather/quick-pack` endpoints currently execute blocking I/O and synchronous network requests on the main ASGI event loop. 
These must be refactored to utilize `submit_immediate_job`. The frontend UI for both extensions must be updated to poll for job completion and read the resulting strings out of the job's `artifact_json` payload.

## Notes / Execution Log
