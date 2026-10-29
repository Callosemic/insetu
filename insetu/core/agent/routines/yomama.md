---
id: yomama
title: /yomama (Apply & Heal Patches)
domain: Core Agent
description: Validates and commits Yomama patch blocks directly to the VFS, automatically healing failed anchors or syntax errors against live disk state.
slash_command: /yomama
default_mode: yomama
nodes:
  - id: apply_and_verify
    type: exec
    capability: bridge.sync
    parents: []
    order: 10
    payload:
      text: "{{ inputs.patch_text | {{ inputs.user_message }} }}"
---