---
repo: "insetu"
type: "bug"
status: "open"
id: INS-BUG-20260709_1005_SKILLS_HARDCODED_PATH
title: "Skills Engine Hardcodes Global Profile Path"
created_at: "2026-07-09T10:03:14"
closed_at: null
sub_bucket: "None"
delivery_date: null
tags: ["Backend", "Compliance", "SSOT"]
---

## Description
* **Violation:** In `engine_skills.py`, the `_get_user_skills_dir()` function defines `os.path.expanduser('~/.insetu/skills')`. 
* **Impact:** While global profiling is sometimes necessary for skills tracking across environments, hardcoding this absolute path skirts the dynamic workspace bounding principles and violates the Configuration SSOT standard. 
* **Resolution Path:** This path logic must be moved to the configuration layer (`workspaces.json` or `config.json`) so it can be dynamically resolved via `utils_core.py`.

## Notes / Execution Log
