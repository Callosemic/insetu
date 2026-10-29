---
id: ask
title: Read-Only Architectural Q&A
domain: Core Agent
description: Answers architectural and codebase questions using a 2-stage context expansion funnel without mutating files.
slash_command: /ask
output: "{{ nodes.final_answer.text | {{ nodes.initial_answer.text }} }}"
nodes:
  - id: load_topology_overview
    type: exec
    capability: topology.overview
    parents: []
    order: 10
  - id: initial_answer
    type: llm
    tier: medium
    parents:
      - load_topology_overview
    order: 20
    output_schema: ask_response_or_need_files
    max_retries: 1
  - id: fetch_requested_files
    type: exec
    capability: fs.fetch
    parents:
      - initial_answer
    order: 30
    condition: "{{ nodes.initial_answer.parsed.status }} == 'NEED_MORE_FILES'"
    map_over: "{{ nodes.initial_answer.parsed.requested_files }}"
    payload:
      file: "{{ item }}"
  - id: final_answer
    type: llm
    tier: high
    parents:
      - fetch_requested_files
    order: 40
    condition: "{{ nodes.initial_answer.parsed.status }} == 'NEED_MORE_FILES'"
---

## initial_answer
You are answering a read-only architectural question about the workspace. Do NOT emit Yomama patch blocks.
If the attached context and topology overview are sufficient, provide a clear, thorough answer directly.
If you need to inspect specific source files first, respond ONLY with JSON:
{"status": "NEED_MORE_FILES", "requested_files": ["vfs://repo/path/to/file.py"]}

Workspace Topology Overview:
{{ nodes.load_topology_overview.overview_text }}

Question:
{{ inputs.user_message }}

## final_answer
Using the workspace topology and the fetched file contents below, provide a complete, accurate answer to the user's question. Do NOT emit Yomama patch blocks.

Fetched Files:
{{ nodes.fetch_requested_files.items }}

Question:
{{ inputs.user_message }}