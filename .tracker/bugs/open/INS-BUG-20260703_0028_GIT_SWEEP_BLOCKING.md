---
repo: "insetu"
type: "bug"
status: "open"
id: INS-BUG-20260703_0028_GIT_SWEEP_BLOCKING
title: "I/O Block Ban Violation: Async Git Sweep Operations"
created_at: 2026-07-03T00:28:00
closed_at: null
sub_bucket: "None"
---
## Description
The endpoints `/api/git/sweep/status` and `/api/git/sweep/push` in `engine_git.py` leverage inline `subprocess.run` calls on the main execution thread. Given network latency on pushes and dense un-indexed tree traversals on status queries, these executions violate the I/O Block Ban and risk dropping HTTP connections.

## Action Items
- [ ] Return an immediate `202 Accepted` confirmation from the REST controllers.
- [ ] Trigger the Git subprocess operations asynchronously via the worker pool.
- [ ] Surface sweep push results back to the client via SSE or toast notifications.