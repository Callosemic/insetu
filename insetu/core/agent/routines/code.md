---
id: code
title: /code (Surgical Code Generation)
domain: Core Agent
description: Assembles attached workspace context, generates Yomama patches in the thinking tier, and commits with AST verification and self-healing.
slash_command: /code
default_mode: code
output: "{{ nodes.generate_patch.text }}"
nodes:
  - id: load_overview
    type: exec
    capability: topology.overview
    parents: []
    order: 5
    when: "{{ global.has_code_targets }} == False and {{ sys.helper_mode }} == 'ai_assisted'"
  - id: scout_and_plan_loop
    type: loop
    parents:
      - load_overview
    order: 8
    when: "{{ global.has_code_targets }} == False and {{ sys.helper_mode }} == 'ai_assisted' and {{ nodes.load_overview.code_file_count | 1 }} > 0"
    until: "{{ nodes.plan_tasks.status | 'ready' }} == 'ready'"
    max_iterations: 3
    body:
      - id: scout_targets
        type: llm
        tier: fast
        parents: []
        order: 1
        output_schema: json
        max_retries: 2
      - id: plan_tasks
        type: llm
        tier: fast
        parents:
          - scout_targets
        order: 2
        output_schema: json
        max_retries: 2
  - id: fetch_context
    type: exec
    capability: gather.pack_selection
    parents:
      - scout_and_plan_loop
    order: 10
  - id: generate_patch
    type: llm
    tier: thinking
    parents:
      - fetch_context
    order: 20
    use_history: true
    output_schema: conversational_with_patches
    max_retries: 3
  - id: apply_and_verify
    type: exec
    capability: bridge.sync
    parents:
      - generate_patch
    order: 30
    payload:
      text: "{{ nodes.generate_patch.text }}"
      dry_run: true
---
## scout_targets
You are the Fast File Scout (Step A of the `(scout_targets -> plan_tasks)` loop, Iteration {{ loop.iteration | 1 }}/{{ loop.max_iterations | 3 }}).
Your ONLY job in this step is to find the exact `vfs://<repo>/<path>` files and any unread `.md` plans needed for the user's request—do NOT write `tasks` in this step.
- **Strict Scope:** Look ONLY at the specific items/sections requested in `User Request` (e.g. if the user asks for `2.1 through 2.4`, look strictly at items `1.`–`4.` under `## 2.` and ignore `## 1.` or `2.6`).
- **If `Prior Plan Feedback` below notes missing files or unread `.md` plans:** resolve those exact paths from `CODE_INDEX.md`.
- **`"inspect_files"`:** List any `.md` plan/spec/contract referenced by the requested items (such as `docs/plans/...md`) that is NOT yet in `Attached Plan / Documentation Context`, or any source file interface you need to inspect.
- **`"global_files"`:** Shared `.md` plan/brief/contract docs (`vfs://<repo>/.../*.md`, NEVER `CODE_INDEX.md`).
- **`"requested_files"`:** All target implementation, asset, and test files (`vfs://<repo>/<path>`, NEVER `CODE_INDEX.md`) needed across the requested items.
- **`"drop_files"`:** Any files from an earlier iteration that are not needed for the requested items.
Respond ONLY with valid JSON:
{"inspect_files": ["vfs://<repo>/<path>"], "global_files": ["vfs://<repo>/<doc.md>"], "requested_files": ["vfs://<repo>/<path>"], "drop_files": [], "reason": "Brief explanation"}

User Request:
{{ inputs.user_message }}

Prior Plan Feedback (from previous iteration, if any):
Missing Context Notes: {{ loop.prev.plan_tasks.missing_context_notes | 'None (First iteration)' }}
Prior Draft Tasks: {{ loop.prev.plan_tasks.tasks | 'None' }}

Attached Plan / Documentation Context:
{{ global.attached_docs_content }}

Workspace Topology & Symbol Map (`CODE_INDEX.md` — Use to Resolve Exact `vfs://<repo>/<path>` URIs):
{{ nodes.load_overview.overview_text }}

## plan_tasks
You are the Fast Plan Synthesizer & Coverage Verifier (Step B of the `(scout_targets -> plan_tasks)` loop, Iteration {{ loop.iteration | 1 }}/{{ loop.max_iterations | 3 }}).
Using `User Request`, `Scouted Candidate Files`, and `Attached Plan / Documentation Context`, build or refine the ordered implementation plan (`"tasks"`) and check whether another `(scout -> plan)` cycle is needed.
1. **Strict 1-to-1 Item Mapping (Honor Scope Limits):** Map each requested item 1-to-1 in order (e.g. if the user asks for `2.1 through 2.4`, `T1` = item `2.1`, `T2` = item `2.2`, `T3` = item `2.3`, `T4` = item `2.4`).
   - If a requested item links to a multi-sprint plan but specifies a scope limit (such as *"Sprint 1 first (`akasa` stamping `X-Akasa-Build-ID`...)"*), scope that task strictly to the specified sprint (`akasa/__init__.py`)—NEVER expand unrequested later sprints in a way that crowds out or replaces the next requested item (`2.4`)!
2. **Self-Consistent `"targets"`:** Every file mentioned in a task's `"description"` (plus any companion file that step reads or edits, resolved from `CODE_INDEX.md`) MUST be listed in that task's `"targets"` array using its canonical `vfs://<repo>/<path>` URI. Set `"test_contract"` ONLY to a unit test file that directly tests that step's target module (otherwise `""`).
3. **Decide `"status"` (`"need_context"` vs. `"ready"`):**
   - If ANY requested item references another `.md` plan/spec/contract (e.g. `docs/plans/...md`) that is NOT yet in `Attached Plan / Documentation Context`, OR if a task is still missing its target implementation file in `Scouted Candidate Files`: set `"status": "need_context"`, put the unread `.md` or file URI in `"inspect_files"`, and explain what is missing in `"missing_context_notes"` so the next `(scout -> plan)` iteration grabs it!
   - Only when EVERY requested item is in `"tasks"` with complete `"targets"` and all referenced `.md` plans have been read: set `"status": "ready"`, `"inspect_files": []`, and `"missing_context_notes": ""`.
Respond ONLY with valid JSON:
{"tasks": [{"id": "T1", "kind": "edit", "description": "Step summary", "targets": ["vfs://<repo>/<path>"], "test_contract": ""}], "inspect_files": [], "missing_context_notes": "", "status": "need_context" | "ready", "reason": "Brief explanation"}

User Request:
{{ inputs.user_message }}

Scouted Candidate Files:
{{ nodes.scout_targets.requested_files }}

Prior Iteration Draft Tasks (if any):
{{ loop.prev.plan_tasks.tasks | 'None' }}

Attached Plan / Documentation Context (Authoritative Source for Plan Tasks):
{{ global.attached_docs_content }}

Workspace Topology & Symbol Map (`CODE_INDEX.md`):
{{ nodes.load_overview.overview_text }}

## generate_patch
Apply the user instruction ({{ inputs.user_message }}) to the workspace codebase using surgical Yomama `<<<<<<< FILE:` blocks (`<<<<<<< SEARCH` / `>>>>>>> REPLACE` for code, `<<<<<<< TEXTEDIT` for inline prose/comments, `<<<<<<< JSON_PATCH` for JSON/YAML frontmatter, or `<<<<<<< RELOCATE` / `<<<<<<< RENAME` for AST refactors).
- **Concise Implementation Summary First:** Start your response with a brief 2–4 sentence summary explaining what you are changing in this step (and any plan refinements), then provide the Yomama patch blocks at the end.
- **Continuous Plan Evaluation & Active-Step Execution:**
  - If an `ACTIVE MULTI-STEP EXECUTION PLAN` banner is present above, review the plan first: if the steps or targets need adjustment, you may refine the plan in-place using a `<<<<<<< FILE: ctx://plan/active_plan.md` / `<<<<<<< TASK_MANAGE` block (`UPDATE: T1 | kind: edit | targets: vfs://... | test: vfs://... | Refined description`, `ADD: T1a | ...` to split a complex step, `DROP: T3`) and **implement ONLY the current active step** in this turn (do NOT emit `COMPLETE:` for a step whose code patch is still being proposed, as step completion is recorded when the patch commits).
  - If no `ACTIVE MULTI-STEP EXECUTION PLAN` banner is present and the request spans multiple distinct items, emit a `<<<<<<< FILE: ctx://plan/active_plan.md` / `<<<<<<< TASK_MANAGE` block (`ADD: T1 | ...`, `ADD: T2 | ...`, `ACTIVE: T1`) and **immediately emit the Yomama code patches for `[T1]` in this same response** (deferring `T2+` code changes to subsequent turns).
  - **Active-Step `QUERY_CONTEXT` Rule:** Only emit `<<<<<<< QUERY_CONTEXT` if a file or symbol required to implement the **currently active step** is missing from the attached Context payload—never pause to pre-fetch files that belong only to deferred future steps (`T2+`).