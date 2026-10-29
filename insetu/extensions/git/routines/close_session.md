---
id: close_session
title: Session Closeout & Changelog
domain: Version Control
description: Refreshes workspace diffs, drafts a session changelog and Conventional Commit message, and prepares the repository for push.
slash_command: /closeout
show_if_exists:
  - ctx://diffs/
output: "{{ nodes.draft_closeout }}"
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
  - id: ledger_commit_msg
    type: exec
    capability: bridge.commit_message
    parents: []
    order: 10
  - id: draft_closeout
    type: llm
    tier: thinking
    parents:
      - list_buckets
      - ledger_commit_msg
    order: 30
---

## draft_closeout
Prepare an end-of-session closeout package for the uncommitted changes across the workspace:
1. **Session Summary & Changelog Entry:** Bullet-point summary of completed features, fixes, and architectural updates.
2. **Conventional Commit Message:** Refined from the Bridge Ledger (`{{ nodes.ledger_commit_msg.commit_message }}`) and active diffs.

Dirty Diff Buckets:
{{ nodes.list_buckets.buckets }}

User Closeout Notes:
{{ inputs.user_message }}