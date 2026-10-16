## Issue Tracker: Markdown-as-Code (MaC) Ticket Authoring Guide

Tickets in the inSetu Issue Tracker are stored as plain Markdown files with YAML frontmatter inside `<repo>/.insetu-data/tracker/<type>s/<status>/<ID>.md`.

### 1. YAML Frontmatter Schema
When creating or modifying a ticket via the Yomama Bridge, use the following YAML frontmatter structure:

```markdown
---
repo: my-repo
type: todo
status: open
id: MYR-TODO-20261015_120000
title: Short, actionable summary of the task
created_at: 2026-10-15T12:00:00
closed_at: null
sub_bucket: None
tier: 3
priority: P2
size: M
parent_id: MYR-SPRINT-20261001_090000
depends_on:
  - MYR-TODO-20261014_153000
tags:
  - Architecture
  - UI
---

## Description
Detailed architectural context, acceptance criteria, and file-level implementation steps.

## Notes / Execution Log
- Chronological notes or outcomes recorded during implementation.
```

### 2. Hierarchy Tiers & Status Rules
* **Tiers:**
  * `tier: 1` — Top-level Epics or Campaigns (`type: epic` or `campaign`)
  * `tier: 2` — Mid-level Sprints or Content Pieces (`type: sprint`, `article`, `video`)
  * `tier: 3` — Atomic Tasks (`type: todo`, `bug`, `queue`, `draft`, `edit`, `publish`)
* **Status Transitions:** Valid statuses are `open`, `active`, `closed`, and `template`. Changing `status` in the YAML frontmatter automatically triggers the background enforcer to move the file into the matching status folder on disk.