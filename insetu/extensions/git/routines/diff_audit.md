---
id: diff_audit
title: Pre-Commit Diff Audit
domain: Version Control
description: Compiles fresh Git diffs, audits each dirty diff bucket in parallel, and synthesizes a unified pre-commit review and Conventional Commit message.
slash_command: /audit
show_if_exists:
  - ctx://diffs/
output: "{{ nodes.synthesize_audit_report }}"
nodes:
  - id: refresh_diffs
    type: exec
    capability: git.compile_diffs
    parents: []
    order: 10
  - id: list_buckets
    type: exec
    capability: git.list_dirty_diff_buckets
    parents:
      - refresh_diffs
    order: 20
  - id: audit_bucket
    type: llm
    tier: fast
    parents:
      - list_buckets
    order: 30
    map_over: "{{ nodes.list_buckets.buckets }}"
  - id: synthesize_audit_report
    type: llm
    tier: thinking
    parents:
      - audit_bucket
    order: 40
---

## audit_bucket
Audit the uncommitted changes in diff bucket `{{ item.diff_file }}` (`{{ item.repo }}`):
1. Check for regressions, leftover debug statements, or security/secret leaks.
2. Summarize the key architectural changes in this bucket.

Diff Payload:
{{ item.content }}

## synthesize_audit_report
Combine the per-bucket diff audit findings below into:
1. **Executive Pre-Commit Audit Summary** (any blockers, warnings, or clean sign-off).
2. **Recommended Conventional Commit Message** (ready to paste or hand off to `InSetuGitPushProjection`).

Per-Bucket Audit Findings:
{{ nodes.audit_bucket.text }}