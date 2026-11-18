---
id: map_reduce_audit
title: Map-Reduce Multi-File Audit
domain: Core Agent
description: Audits each attached file in parallel using the fast tier and synthesizes a unified architectural report in the thinking tier.
slash_command: /map_reduce_audit
default_mode: ask
output: "{{ nodes.reduce_audit_summary.text }}"
nodes:
  - id: map_file_audits
    type: llm
    tier: fast
    parents: []
    order: 10
    map_over: "{{ global.all_context_files }}"
    system: "You are a concise code auditor. Summarize key findings, risks, or anti-patterns for the given file."
  - id: reduce_audit_summary
    type: llm
    tier: thinking
    parents:
      - map_file_audits
    order: 20
    system: "Synthesize individual file audit notes into a single prioritized architectural report."
---

## map_file_audits
Audit target file `{{ item }}` against instruction: {{ inputs.user_message }}

## reduce_audit_summary
User Goal: {{ inputs.user_message }}

Per-File Audit Findings:
{{ nodes.map_file_audits.text }}
