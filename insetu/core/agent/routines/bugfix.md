---
id: bugfix
title: Root-Cause Bugfix Pipeline
domain: Core Agent
description: Performs root-cause analysis on a bug report or stack trace and applies a minimal, non-regressive Yomama fix.
slash_command: /bugfix
output: "{{ nodes.synthesize_fix }}"
nodes:
  - id: load_overview
    type: exec
    capability: topology.overview
    parents: []
    order: 10
  - id: diagnose_root_cause
    type: llm
    tier: medium
    parents:
      - load_overview
    order: 20
  - id: synthesize_fix
    type: llm
    tier: high
    parents:
      - diagnose_root_cause
    order: 30
    output_schema: conversational_with_patches
    max_retries: 2
    system_prompt: "{{ inputs.system_prompt }}"
  - id: commit_fix
    type: exec
    capability: bridge.sync
    parents:
      - synthesize_fix
    order: 40
    condition: "{{ nodes.synthesize_fix.parsed.has_patches }}"
    payload:
      text: "{{ nodes.synthesize_fix.text }}"
---

## diagnose_root_cause
Analyze the bug report, stack trace, and workspace topology below. Identify:
1. Exact root cause and affected symbol(s)/file(s).
2. Why the failure occurs and edge cases to preserve.

Workspace Topology Overview:
{{ nodes.load_overview.overview_text }}

Bug Report:
{{ inputs.user_message }}

## synthesize_fix
Based on the root-cause diagnosis below, emit a brief explanation followed by surgical Yomama `<<<<<<< FILE:` + `<<<<<<< SEARCH` / `>>>>>>> REPLACE` patch blocks to fix the bug cleanly.

Root-Cause Diagnosis:
{{ nodes.diagnose_root_cause.text }}

Original Bug Report:
{{ inputs.user_message }}