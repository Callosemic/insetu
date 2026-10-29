---
id: code
title: /code (Surgical Code Generation)
domain: Core Agent
description: Assembles attached workspace context, generates Yomama patches in the thinking tier, and commits with AST verification and self-healing.
slash_command: /code
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
    max_retries: 3
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
Apply the user instruction ({{ inputs.user_message }}) to the workspace codebase using surgical Yomama `<<<<<<< FILE:` blocks (`<<<<<<< SEARCH` / `>>>>>>> REPLACE` for code, `<<<<<<< TEXTEDIT` for inline prose/comments, `<<<<<<< JSON_PATCH` for JSON/YAML frontmatter, or `<<<<<<< RELOCATE` / `<<<<<<< RENAME` for AST refactors).

Context:
{{ nodes.fetch_context.content }}