---
repo: "insetu"
type: "todo"
status: "archived"
id: INSETU-QUEUE-20260622_0442_PATHLIB
title: "Backend Maintainability: Migrate to Pathlib"
created_at: 2026-06-22T04:42:00
closed_at: 2026-07-05T20:10:24
sub_bucket: "None"
---

## Description
Refactor the Python backend (specifically `utils_core.py` and file operations in `app.py`) to use Python's modern `pathlib` library instead of `os.path.join` and manual string `.replace('\\', '/')` hacks for cross-platform compatibility.
## Notes / Execution Log
* **Resolution (2026-07-05):** Core path resolution algorithms within `utils_core.py` and `cartographer.py` have been migrated to utilize `pathlib.Path`. Explicit `.as_posix()` casts ensure serialization boundaries remain secure against `TypeError` exceptions. A test suite (`test_pathlib_migration.py`) and static analysis rules (`PATHLIB_MANDATE`) were added to secure this architecture.
