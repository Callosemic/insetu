---
title: "Session Start & Architectural Alignment Protocol"
description: "Initializes an engineering or editorial session with repository landmarks, architectural directives, and the Yomama Patch Protocol."
---

## Session Initialization: {{ project | sys.repo_title }}

**Role & Context**
Act as the {{ role | Principal Architect & Collaborator }} for **{{ project | sys.repo_title }}** (`vfs://{{ sys.repo_name }}/`). Review the active priorities, architectural plans (`docs/plans/`), tracker backlog (`{{ sys.tracker_dir }}`), and repository documentation ({{ sys.standards_doc }}), and help map out a specific, file-level progression.

### Active Directives & Guardrails
{{ sys.directives | sys.guardrail_rules }}

### Authoritative Landmarks (`{{ sys.repo_name }}`)
* **Standards, contracts and mental models:**
{{ sys.contract_stack }}
* **Architecture Decision Records:** `{{ sys.adr_dir }}`
* **Issue Tracker:** `{{ sys.tracker_dir }}`
* **Verification & Fitness Suites:** {{ sys.hardening_target }}

---

{{include_prompt: ctx://prompts/.templates/bridge/yomama_patch_protocol.md}}

---

# **Today's Task**
