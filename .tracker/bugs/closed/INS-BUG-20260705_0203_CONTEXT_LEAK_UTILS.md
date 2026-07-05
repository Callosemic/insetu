---
repo: "insetu"
type: "bug"
status: "closed"
id: INS-BUG-20260705_0203_CONTEXT_LEAK_UTILS
title: "Flask Context Leakage in save_json_file Tenant Resolution"
created_at: 2026-07-05T02:03:00
closed_at: 2026-07-05T03:53:36
sub_bucket: "None"
---
## Description
A structural vulnerability exists in the configuration persistence layer that risks misrouting VFS commits during background operations. 

In `utils_core.py`, the `save_json_file` function checks if the target file is a configuration file. If so, it invokes `sniff_tenant_id()` to drop the payload into the `_VFS_WRITE_QUEUE`. However, `sniff_tenant_id()` relies entirely on extracting the `X-Workspace-ID` from the active Flask HTTP request headers. If `save_json_file` is invoked by a background ThreadPool worker (where no active Flask HTTP context exists), it will silently default to the `"default"` tenant, potentially committing configuration changes to the wrong workspace profile.

## Action Items
* Decouple `save_json_file` from implicit HTTP header sniffing. Update the function signature to accept an explicit `workspace_id` parameter, cascading this requirement to all callers.
* If `workspace_id` is absolutely unavailable, implement a safe failure or warning log rather than blindly defaulting to `"default"`, protecting cross-tenant isolation boundaries.