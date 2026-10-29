---
id: scout_context
title: Fast-Tier Context Scout
domain: Core Agent
description: Scores candidate workspace files in parallel using the fast model tier to prune irrelevant context before synthesis.
slash_command: /scout
output: "{{ nodes.score_candidates }}"
nodes:
  - id: score_candidates
    type: llm
    tier: decision
    parents: []
    order: 10
    map_over: "{{ inputs.candidate_files }}"
    output_schema: json
    max_retries: 1
---

---
---

## score_candidates
Evaluate whether the candidate file `{{ item }}` is needed to answer or implement the following request:
"{{ inputs.user_message }}"

Respond ONLY with JSON: `{"file": "{{ item }}", "relevant": true | false, "reason": "..."}`.