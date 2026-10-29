---
id: test
title: Autonomous Test Runner & Triage
domain: Core Agent
description: Resolves and runs the repository test suite in a bounded loop, triaging and patching failures automatically.
slash_command: /test
output: "{{ nodes.triage_loop }}"
nodes:
  - id: resolve_cmd
    type: exec
    capability: agent.resolve_test_command
    parents: []
    order: 10
    payload:
      repo: "{{ inputs.repo }}"
      target: "{{ inputs.target }}"
  - id: triage_loop
    type: loop
    parents:
      - resolve_cmd
    order: 20
    max_iterations: 3
    until: "{{ nodes.run_suite.exit_code }} == 0"
    body:
      - id: run_suite
        type: exec
        capability: agent.run_test
        parents: []
        order: 10
        payload:
          repo: "{{ nodes.resolve_cmd.repo }}"
          command: "{{ nodes.resolve_cmd.command }}"
      - id: triage_and_fix
        type: llm
        tier: thinking
        parents:
          - run_suite
        order: 20
        condition: "{{ nodes.run_suite.exit_code }} != 0"
        output_schema: conversational_with_patches
        max_retries: 2
      - id: apply_test_fix
        type: exec
        capability: bridge.sync
        parents:
          - triage_and_fix
        order: 30
        condition: "{{ nodes.triage_and_fix.parsed.has_patches }}"
        payload:
          text: "{{ nodes.triage_and_fix.text }}"
---

## triage_and_fix
The test suite failed with exit code {{ nodes.run_suite.exit_code }}.
Command: `{{ nodes.run_suite.command }}`

Failure Summary:
{{ nodes.run_suite.failure_batch }}

Recent Output:
{{ nodes.run_suite.combined_output }}

Diagnose the root cause and emit surgical Yomama `<<<<<<< FILE:` + `<<<<<<< SEARCH` / `>>>>>>> REPLACE` blocks to fix the failing implementation or stale test expectation.
