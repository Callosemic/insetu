---
id: refactor
title: AST-First Structural Refactor
domain: Core Agent
description: Executes behavior-preserving structural refactorings using Yomama RELOCATE, RENAME, and SEARCH/REPLACE blocks.
slash_command: /refactor
output: "{{ nodes.synthesize_refactor }}"
nodes:
  - id: load_overview
    type: exec
    capability: topology.overview
    parents: []
    order: 10
  - id: synthesize_refactor
    type: llm
    tier: high
    parents:
      - load_overview
    order: 20
    output_schema: conversational_with_patches
    max_retries: 2
    system_prompt: "{{ inputs.system_prompt }}"
  - id: apply_refactor
    type: exec
    capability: bridge.sync
    parents:
      - synthesize_refactor
    order: 30
    condition: "{{ nodes.synthesize_refactor.parsed.has_patches }}"
    payload:
      text: "{{ nodes.synthesize_refactor.text }}"
---

## synthesize_refactor
Perform the requested structural refactoring while strictly preserving external behavior and public contracts.
Prefer `<<<<<<< RELOCATE` and `<<<<<<< RENAME` AST directives when moving or renaming top-level symbols, and `<<<<<<< SEARCH` / `>>>>>>> REPLACE` for internal cleanups.

Workspace Topology Overview:
{{ nodes.load_overview.overview_text }}

Refactoring Objective:
{{ inputs.user_message }}