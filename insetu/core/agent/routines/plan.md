---
id: plan
title: Living Architectural Plan Builder
domain: Core Agent
description: Drafts or refines a persistent Markdown architectural plan using Yomama patches and verifies all referenced file targets via Cartographer.
slash_command: /plan
output: "{{ nodes.draft_plan }}"
nodes:
  - id: ensure_plan
    type: exec
    capability: agent.ensure_plan_file
    parents: []
    order: 10
    payload:
      plan_uri: "{{ inputs.plan_uri }}"
      title: "{{ inputs.user_message }}"
  - id: load_overview
    type: exec
    capability: topology.overview
    parents: []
    order: 10
  - id: draft_plan
    type: llm
    tier: high
    parents:
      - ensure_plan
      - load_overview
    order: 20
    output_schema: conversational_with_patches
    max_retries: 2
    system_prompt: "{{ inputs.system_prompt }}"
  - id: apply_plan_patch
    type: exec
    capability: bridge.sync
    parents:
      - draft_plan
    order: 30
    condition: "{{ nodes.draft_plan.parsed.has_patches }}"
    payload:
      text: "{{ nodes.draft_plan.text }}"
  - id: verify_targets
    type: exec
    capability: topology.verify_plan_targets
    parents:
      - apply_plan_patch
    order: 40
    payload:
      plan_file: "{{ nodes.ensure_plan.plan_uri }}"
      plan_text: "{{ nodes.draft_plan.text }}"
---

## draft_plan
Update the living architectural plan file at `{{ nodes.ensure_plan.plan_uri }}` using Yomama `<<<<<<< FILE: {{ nodes.ensure_plan.plan_uri }}` patch blocks (or `<<<<<<< TEXTEDIT` / `<<<<<<< SEARCH` blocks). Do NOT modify source code files during `/plan`.

Current Plan File Content (`{{ nodes.ensure_plan.plan_uri }}`):
{{ nodes.ensure_plan.existing_content }}

Workspace Topology Overview:
{{ nodes.load_overview.overview_text }}

Planning Request:
{{ inputs.user_message }}