---
id: INSETU-BUG-20260701_0150_ROUTES_FS_TENANT_LEAK
title: "Multi-Tenant Leakage & Path Hardcoding in routes_fs.py"
created_at: 2026-07-01T01:50:00
closed_at: null
sub_bucket: "None"
tags: [backend, security, multi-tenancy, bugs]
---

## Description
The filesystem route handlers in `routes_fs.py` (`/api/fs/move`, `/api/fs/archive`, and `/api/fs/delete`) currently invoke `resolve_workspace_path(filepath)` without extracting or forwarding the request's scoped `workspace_id`. This introduces an isolation leak where file mutations triggered during an active cross-tenant profile soft-swap can bleed across environments, potentially altering or deleting source files in the wrong workspace tree.

## Action Items
- [ ] Intercept the `X-Workspace-ID` header from the incoming Flask request within each route handler in `routes_fs.py`.
- [ ] Explicitly pass the request-scoped `workspace_id` into all downstream `resolve_workspace_path` invocations.
- [ ] Implement integration tests validating complete directory isolation during high-concurrency cross-tenant queries.

## Notes / Execution Log