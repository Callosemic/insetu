---
repo: "insetu"
type: "todo"
status: "archived"
id: INS-QUEUE-20260713_0210_BACKEND_WORKERS
title: "Backend DX: Background Task Orchestration Decorators"
created_at: 2026-07-13T02:10:00
closed_at: 2026-07-18T23:15:35
sub_bucket: "None"
tags: ["Backend", "DX", "SDK", "Workers"]
---

## Description
Currently, establishing a non-blocking background task requires a fragmented three-step process: defining a detached global function, manually calling `register_callback` at the root level, and invoking `ctx.jobs.submit()` inside the route. 

To improve Developer Experience (DX) and align with modern framework paradigms (like Celery or FastAPI backgrounds), we need to implement a `@worker('task_name')` decorator natively inside the `InSetuExtension` SDK blueprint wrapper. 

### Execution Plan
* Add a `worker(self, task_name)` decorator method to `InSetuExtension`.
* The decorator should automatically wrap the targeted function and seamlessly invoke `register_callback` under the hood.
* This keeps background task logic topologically anchored to its parent blueprint rather than floating as detached global scripts.

## Notes / Execution Log
* **2026-07-18:** Successfully migrated `engine_git`, `engine_format`, `engine_research`, `engine_tracker`, and the new `engine_freshdesk` to utilize the localized `@worker` decorator. Legacy `register_callback` usage has been removed.