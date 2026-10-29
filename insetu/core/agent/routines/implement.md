---
id: implement
title: Plan-to-Code Executor
domain: Core Agent
description: Executes an architectural plan or ticket into concrete Yomama code patches and runs the Debt Ratchet audit.
slash_command: /implement
output: "{{ nodes.generate_implementation }}"
nodes:
  - id: verify_plan
    type: exec
    capability: topology.verify_plan_targets
    parents: []
    order: 10
    payload:
      plan_text: "{{ inputs.context_block }} {{ inputs.user_message }}"
  - id: generate_implementation
    type: llm
    tier: high
    parents:
      - verify_plan
    order: 20
    output_schema: conversational_with_patches
    max_retries: 2
    system_prompt: "{{ inputs.system_prompt }}"
  - id: apply_implementation
    type: exec
    capability: bridge.sync
    parents:
      - generate_implementation
    order: 30
    condition: "{{ nodes.generate_implementation.parsed.has_patches }}"
    payload:
      text: "{{ nodes.generate_implementation.text }}"
---

## generate_implementation
Execute the architectural plan and user instructions below into complete, production-ready Yomama patch blocks.
Verified Workspace Targets: {{ nodes.verify_plan.verified_targets }}
New/Missing Targets: {{ nodes.verify_plan.missing_or_new_targets }}

Implementation Instructions:
{{ inputs.user_message }}