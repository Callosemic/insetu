---
repo: "insetu"
type: "bug"
status: "logged"
id: INS-BUG-20260705_0203_VFS_BYPASS_FLOW
title: "VFS Pipeline Bypass in Flow Batch Deletion"
created_at: 2026-07-05T02:03:00
closed_at: 2026-07-05T03:53:36
sub_bucket: "None"
---
## Description
An unguarded synchronous file deletion remains in the workflow engine. The `api_flow_batches_delete` controller within `engine_flow.py` actively bypasses the asynchronous `_VFS_WRITE_QUEUE` by executing an inline `os.remove(out_path)` call. 

While this specific operation targets a standalone `.txt` artifact rather than a user workspace file (minimizing immediate data loss risks), it violates the centralized VFS pipeline mandate and creates an inconsistent disk I/O architecture.

## Action Items
* Refactor the `api_flow_batches_delete` route to dispatch the deletion payload through the `execute_vfs_delete` wrapper (or directly into the `_VFS_WRITE_QUEUE` with a delete flag).
* Ensure the REST controller releases the HTTP thread immediately upon queuing the deletion to preserve event loop stability.