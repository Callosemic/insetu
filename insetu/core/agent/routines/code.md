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
  - id: scout_targets
    type: llm
    tier: fast
    parents:
      - load_overview
    order: 8
    when: "{{ global.has_code_targets }} == False and {{ sys.helper_mode }} == 'ai_assisted' and {{ nodes.load_overview.code_file_count | 1 }} > 0"
    output_schema: json
    max_retries: 2
  - id: fetch_context
    type: exec
    capability: gather.pack_selection
    parents:
      - scout_targets
    order: 10
  - id: generate_patch
    type: llm
    tier: thinking
    parents:
      - fetch_context
    order: 20
    use_history: true
    output_schema: yomama_patch
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
You are the Context Scout for the `/code` routine. The user did not manually attach target files.
Inspect the Workspace Topology & `CODE_INDEX.md` symbol map below and identify the specific workspace files (1 to 8 files max) required to implement the user's request.
- If the user's request references a plan, brief, or specification document that is not yet in Attached Plan / Documentation Context, include that document URI in `requested_files` alongside any known target files so Hop 2 can read it and expand its targets.
Respond ONLY with valid JSON in this exact format:
{"requested_files": ["vfs://<repo>/<path/to/file>"]}

Workspace Topology & Symbol Map (`CODE_INDEX.md`):
{{ nodes.load_overview.overview_text }}

Attached Plan / Documentation Context:
{{ global.attached_docs_content }}

User Request:
{{ inputs.user_message }}

## generate_patch
Apply the user instruction ({{ inputs.user_message }}) to the workspace codebase using surgical Yomama `<<<<<<< FILE:` blocks (`<<<<<<< SEARCH` / `>>>>>>> REPLACE` for code, `<<<<<<< TEXTEDIT` for inline prose/comments, `<<<<<<< JSON_PATCH` for JSON/YAML frontmatter, or `<<<<<<< RELOCATE` / `<<<<<<< RENAME` for AST refactors).