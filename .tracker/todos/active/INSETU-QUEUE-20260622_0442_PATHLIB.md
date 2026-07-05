---
repo: "insetu"
type: "todo"
status: "active"
id: INSETU-QUEUE-20260622_0442_PATHLIB
title: "Backend Maintainability: Migrate to Pathlib"
created_at: 2026-06-22T04:42:00
closed_at: null
sub_bucket: "None"
tags: [backend, maintainability, refactor]
---

## Description
Refactor the Python backend (specifically `utils_core.py` and file operations in `app.py`) to use Python's modern `pathlib` library instead of `os.path.join` and manual string `.replace('\\', '/')` hacks for cross-platform compatibility.

## Notes / Execution Log
