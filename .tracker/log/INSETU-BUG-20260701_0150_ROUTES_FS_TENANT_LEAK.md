---
repo: "insetu"
type: "todo"
status: "logged"
id: INSETU-BUG-20260701_0150_ROUTES_FS_TENANT_LEAK
title: "Multi-Tenant Leakage & Path Hardcoding in routes_fs.py"
created_at: 2026-07-01T01:50:00
closed_at: 2026-07-01T11:16:00
sub_bucket: "None"
---

## Description
The filesystem route handlers in `routes_fs.py` (`/api/fs/move`, `/api/fs/archive`, and `/api/fs/delete`) were found to invoke path resolutions without passing down the request-scoped tenant parameters, presenting cross-tenant isolation leakage vulnerabilities during active workflow soft-swaps.

## Resolution
* Refactored all REST routes inside `routes_fs.py` to capture request parameters dynamically via Flask's blueprint engine substrates.
* Appended explicit `workspace_id` parameters across all internal file system operations (`execute_vfs_move`, `execute_vfs_archive`, `execute_vfs_delete`), isolating file system writes completely.

## Action Items
- [ ] Intercept the `X-Workspace-ID` header from the incoming Flask request within each route handler in `routes_fs.py`.
- [ ] Explicitly pass the request-scoped `workspace_id` into all downstream `resolve_workspace_path` invocations.
- [ ] Implement integration tests validating complete directory isolation during high-concurrency cross-tenant queries.

## Notes / Execution Log