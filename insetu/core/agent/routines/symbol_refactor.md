---
id: symbol_refactor
title: Surgical AST Refactor
domain: Core Agent
description: Packs target context, generates a Yomama v4 patch or AST RELOCATE/RENAME directive, and verifies syntax via the Bridge.
slash_command: /symbol_refactor
default_mode: code
output: "{{ nodes.generate_patch.text }}"
nodes:
  - id: fetch_context
    type: exec
    capability: gather.pack_selection
    parents: []
    order: 10
  - id: generate_patch
    type: llm
    tier: thinking
    parents:
      - fetch_context
    order: 20
    use_history: true
    output_schema: yomama_patch
  - id: apply_and_verify
    type: exec
    capability: bridge.sync
    parents:
      - generate_patch
    order: 30
    payload:
      text: "{{ nodes.generate_patch.text }}"
---

## generate_patch
Execute the following surgical refactor using Yomama `<<<<<<< SEARCH` / `>>>>>>> REPLACE`, `<<<<<<< RELOCATE`, or `<<<<<<< RENAME` blocks:
{{ inputs.user_message }}
