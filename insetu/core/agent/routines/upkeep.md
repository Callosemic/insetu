---
id: upkeep
title: Codebase Upkeep & Hygiene
domain: Core Agent
description: Two-stage maintenance routine for documentation/symbol drift, zero-logic God-object modularization, and test suite relevance.
slash_command: /upkeep
scopes:
  - all
  - docs
  - modularize
  - tests
  - apply
output: "{{ nodes.synthesize_upkeep_patches.text | nodes.propose_upkeep_plan.text }}"
nodes:
  - id: audit_workspace
    type: exec
    capability: topology.audit_upkeep
    parents: []
    order: 10
    payload:
      repo: "{{ inputs.repo }}"
      scope: "{{ inputs.scope | all }}"
      stage: "{{ inputs.stage | audit }}"
  - id: pack_flagged_targets
    type: exec
    capability: gather.pack_selection
    parents:
      - audit_workspace
    order: 20
    condition: "{{ nodes.audit_workspace.target_files }} != ''"
    payload:
      items: "{{ nodes.audit_workspace.target_files }}"
  - id: propose_upkeep_plan
    type: llm
    tier: thinking
    parents:
      - pack_flagged_targets
    order: 30
    condition: "{{ inputs.stage | audit }} != 'apply'"
    output_schema: freeform
  - id: synthesize_upkeep_patches
    type: llm
    tier: thinking
    parents:
      - pack_flagged_targets
    order: 40
    condition: "{{ inputs.stage | audit }} == 'apply'"
    output_schema: conversational_with_patches
    max_retries: 2
  - id: apply_upkeep_patches
    type: exec
    capability: bridge.sync
    parents:
      - synthesize_upkeep_patches
    order: 50
    condition: "{{ nodes.synthesize_upkeep_patches.parsed.has_patches }}"
    payload:
      text: "{{ nodes.synthesize_upkeep_patches.text }}"
  - id: verify_updated_symbols
    type: exec
    capability: cartographer.verify_symbols
    parents:
      - apply_upkeep_patches
    order: 60
    condition: "{{ nodes.synthesize_upkeep_patches.parsed.has_patches }}"
    payload:
      repo: "{{ inputs.repo }}"
  - id: verify_test_suite
    type: exec
    capability: agent.run_test
    parents:
      - verify_updated_symbols
    order: 70
    condition: "{{ nodes.synthesize_upkeep_patches.parsed.has_patches }}"
    payload:
      repo: "{{ inputs.repo }}"
---

## propose_upkeep_plan
You are running **Stage 1 (Audit & Proposal)** of the `/upkeep` maintenance routine (Active Scope: `{{ inputs.scope | all }}`).
Do NOT emit patch blocks in Stage 1. Present a concise, actionable **Upkeep Audit Report** based on the deterministic AST telemetry below:

### Deterministic Telemetry (`topology.audit_upkeep`)
- **Summary Counts:** `{{ nodes.audit_workspace.summary }}`
- **Pillar 1 — Documentation & Mutated Symbol Drift (`docs`):**
  `{{ nodes.audit_workspace.docs_drift }}`
- **Pillar 2 — God-Object Decomposition Candidates (`modularize`):**
  `{{ nodes.audit_workspace.god_objects }}`
- **Pillar 3 — Test Suite Relevance (`tests`):**
  `{{ nodes.audit_workspace.test_relevance }}`

### Instructions for Stage 1 Report
1. **If Scope is `all` or `docs`:**
   - List undocumented `# [comment required]` entries and propose exact 1-sentence descriptions.
   - For each `[stale?]` symbol (whose AST `body_hash` changed while its `CODE_INDEX.md` comment stayed the same), compare `current_comment` against `source_slice` and state either:
     - **[Still Accurate — Verify Hash]** if the existing comment still accurately describes the function, OR
     - **[Update Comment]** with the revised 1-sentence summary.
   - List any broken `vfs://` references in Markdown docs.
2. **If Scope is `all` or `modularize`:**
   - For the top God-object candidate, propose a **Zero-Logic Decomposition Plan** grouping cohesive helper functions/classes to extract into a focused submodule via `<<<<<<< RELOCATE` while keeping re-exports in the original file so external callers never break.
3. **If Scope is `all` or `tests`:**
   - List any dead/stale test imports to prune and the highest-value untested capabilities to cover.
4. End by telling the user they can click **Approve & Execute Upkeep** (or run `/upkeep:apply` with any adjustments) to execute Stage 2.

## synthesize_upkeep_patches
You are running **Stage 2 (Execution & Verification)** of the `/upkeep` routine (Active Scope: `{{ inputs.scope | all }}`).
Operator Instructions / Approved Scope:
{{ user_prompt }}

Deterministic Telemetry:
- **Docs & Symbol Drift:** `{{ nodes.audit_workspace.docs_drift }}`
- **God-Object Candidates:** `{{ nodes.audit_workspace.god_objects }}`
- **Test Relevance:** `{{ nodes.audit_workspace.test_relevance }}`

Recent Conversation History (including Stage 1 Proposal):
{{ history_summary }}
Emit surgical Yomama patches to execute the approved upkeep items:
1. **Documentation & `CODE_INDEX.md`:** Prefer `<<<<<<< TEXTEDIT` (`{{-old}}` / `{{+new}}`) or `<<<<<<< SEARCH` / `>>>>>>> REPLACE` on `CODE_INDEX.md` to fill in `[comment required]` entries, update inaccurate `[stale?]` descriptions, or strip `[stale?] ` from verified comments.
2. **God-Object Modularization (Zero Logic Changes):** Use `<<<<<<< RELOCATE` (`SYMBOL`, `FROM`, `TO`, `>>>>>>> EXECUTE`) to move cohesive symbols byte-for-byte without rewriting function bodies, and use `<<<<<<< SEARCH` / `>>>>>>> REPLACE` to wire imports/re-exports cleanly.
3. **Test Suite Alignment:** Prune stale imports/assertions and add focused behavioral unit tests for untested capabilities.
