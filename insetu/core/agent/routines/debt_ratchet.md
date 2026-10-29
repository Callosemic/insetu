---
id: debt_ratchet
title: Technical Debt Ratchet
domain: Core Agent
description: Audits newly committed turn diffs for duplicate helpers, dead code, or boundary leaks and applies a surgical cleanup patch if needed.
slash_command: /ratchet
output: "{{ nodes.audit_turn_diff.text | {{ nodes.triage_turn_diff.text }} }}"
nodes:
  - id: collect_turn_diff
    type: exec
    capability: bridge.turn_diff
    parents: []
    order: 10
    payload:
      transaction_ids: "{{ inputs.transaction_ids }}"
  - id: triage_turn_diff
    type: llm
    tier: decision
    parents:
      - collect_turn_diff
    order: 15
    output_schema: debt_ratchet_verdict
    max_retries: 1
    decision_questions:
      CLEAN: "The turn diff is clean and does not introduce duplicate helpers, unused imports, dead code, or architectural boundary violations."
      REFACTOR: "The turn diff introduces concrete technical debt (duplicate helpers, unused imports, dead code, or boundary leaks) that requires a surgical cleanup patch."
  - id: audit_turn_diff
    type: llm
    tier: thinking
    parents:
      - triage_turn_diff
    order: 20
    condition: "{{ nodes.triage_turn_diff.parsed.verdict }} == 'REFACTOR'"
    output_schema: debt_ratchet_verdict
    max_retries: 1
    system_prompt: "{{ inputs.system_prompt }}"
  - id: apply_cleanup
    type: exec
    capability: bridge.sync
    parents:
      - audit_turn_diff
    order: 30
    condition: "{{ nodes.audit_turn_diff.parsed.has_patches }}"
    payload:
      text: "{{ nodes.audit_turn_diff.text }}"
---

## triage_turn_diff
Evaluate whether the turn diff below is clean (`CLEAN`) or introduces duplicate helpers, unused imports, dead code, or boundary violations (`REFACTOR`).
Respond ONLY with JSON: `{"verdict": "CLEAN" | "REFACTOR", "summary": "..."}`.

Turn Diff & Modified Files:
{{ nodes.collect_turn_diff.diff_text }}

## audit_turn_diff
Review the turn diff and current file contents below for newly introduced technical debt:
1. Duplicate helpers or logic that already exists in `CODE_INDEX.md` or shared utilities.
2. Unused imports, dead code, or left-over scaffolding left behind by the patch.
3. Architectural boundary violations.

If the changes are clean, respond with `{"verdict": "CLEAN", "summary": "No technical debt detected."}`.
If you spot concrete debt that can be tightened without altering behavior, emit Yomama `<<<<<<< FILE:` + `<<<<<<< SEARCH` / `>>>>>>> REPLACE` cleanup blocks.

Turn Diff & Modified Files:
{{ nodes.collect_turn_diff.diff_text }}