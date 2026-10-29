## Declarative Agent Routine Authoring Guide (`ctx://routines/*.md`)

Routines in inSetu are stored as **Markdown-as-Code (`.md`)** files inside `ctx://routines/` (workspace scope) or `ctx://routines/.templates/user/` (global user templates).
### 1. YAML Frontmatter Schema
```markdown
---
id: my_custom_routine
title: My Custom Routine
domain: Routines
description: Short summary of what this routine automates.
slash_command: /my_routine
scopes:
  - all
  - docs
  - tests
transport: auto
includes:
  - ctx://diffs/my_repo_diffs.txt
show_if_exists:
  - ctx://diffs/my_repo_diffs.txt
response_path: vfs://my_repo/notes/report_{date}.md
archive_path: vfs://my_repo/notes/archive/
output: "{{ nodes.step_two.text }}"
nodes:
  - id: step_one
    type: llm
    tier: fast
    parents: []
  - id: step_two
    type: llm
    tier: thinking
    parents:
      - step_one
    output_schema: conversational_with_patches
  - id: apply_changes
    type: exec
    capability: bridge.sync
    parents:
      - step_two
    condition: "{{ nodes.step_two.parsed.has_patches }}"
    payload:
      text: "{{ nodes.step_two.text }}"
---

## step_one
Analyze the request (Scope: `{{ inputs.scope | all }}`): {{ user_goal | general cleanup }}

## step_two
Synthesize the final response and Yomama patches based on `{{ nodes.step_one.text }}`.
```

### 2. Colon-Scoped Slash Commands (`/routine:scope` & `/user:routine:scope`)
* **Declared Scopes (`scopes:`):** Routines can declare a `scopes:` list in frontmatter (e.g., `[all, docs, modularize, tests, apply]`).
* **Automatic Input Binding:** Invoking `/my_routine:docs` or `/user:my_routine:docs` in Chat automatically binds `{{ inputs.scope }}` to `"docs"` and `{{ inputs.stage }}` to `"apply"` when `:apply` is appended.
* **External Web-Chat Handoff (`transport: manual`):** Setting `transport: manual` (or running without an API key) pauses at each LLM step and renders **Copy Context** and **Copy Prompt** buttons in Chat so you can paste the compiled payload into an external chatbot and submit its reply in the bottom input box.

### 3. Execution Primitives & Capabilities
* **Parallel Execution:** Nodes whose `parents` lists are satisfied in the same stage execute concurrently.
* **Fan-Out (`map_over` & `repeat`):** Add `map_over: "{{ nodes.prev.items }}"` to map a node across a list concurrently, or `repeat: 3` to run a parallel K-way ensemble.
* **Bounded Loops (`type: loop`):** Use `type: loop` with `max_iterations: 3`, `until: "{{ ... }}"`, and a nested `body:` node list for iterative convergence (e.g. running `agent.run_test` until `exit_code == 0`).
* **Common `exec` Capabilities:**
  * `topology.overview`, `topology.verify_plan_targets`, `topology.audit_upkeep`
  * `gather.pack_selection`
  * `cartographer.extract`, `cartographer.verify_symbols`, `cartographer.enrich`
  * `bridge.sync`, `bridge.turn_diff`, `bridge.commit_message`
  * `agent.resolve_test_command`, `agent.run_test`, `agent.ensure_plan_file`
