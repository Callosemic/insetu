---
repo: "insetu"
type: "bug"
status: "closed"
id: INS-BUG-20260703_0028_GIT_SWEEP_BLOCKING
title: "I/O Block Ban Violation: Async Git Sweep Operations"
created_at: 2026-07-03T00:28:00
closed_at: 2026-07-05T01:49:15
sub_bucket: "None"
---
## Description
The endpoints `/api/git/sweep/status` and `/api/git/sweep/push` in `engine_git.py` leverage inline `subprocess.run` calls on the main execution thread. Given network latency on pushes and dense un-indexed tree traversals on status queries, these executions violate the I/O Block Ban and risk dropping HTTP connections.
## Resolution
Git operations (Push, Sweep Push, and Diff Generation) have been fully refactored to utilize the `submit_immediate_job` infrastructure. Synchronous `subprocess.run` blocks have been extracted from `api_git_push`, `api_git_sweep_push`, and `api_generate_diffs`. The frontend UI natively polls these job IDs via `ext_git.js` to provide non-blocking visual feedback.