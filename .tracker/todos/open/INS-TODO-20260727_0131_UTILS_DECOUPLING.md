---
repo: "insetu"
type: "todo"
status: "open"
id: "INS-TODO-20260727_0131_UTILS_DECOUPLING"
title: "Decouple utils_core.py into Tier 1 (utils.py) and Tier 2 (core/utils_core.py)"
created_at: "2026-07-27T01:31:29"
closed_at: null
sub_bucket: "Architecture"
tags: ["Tech Debt", "Refactor", "Architecture"]
delivery_date: null
---

## Description
Currently, `utils_core.py` acts as a central Single Source of Truth (SSOT) handling both domain-agnostic framework routing (like resolving physical paths[cite: 2]) and OS-specific physics (like cartography tree building[cite: 2] and repository templating[cite: 2]). 

To eliminate the final architectural bleed between the Tier 1 framework chassis and the Tier 2 Developer OS, this monolithic utility file must be split along strict domain boundaries.

### Action Items
- [ ] **Tier 1 (Kernel) Extraction:** Rename `insetu/utils_core.py` to `insetu/utils.py`. Retain only pure, domain-agnostic operations (e.g., resolving physical paths, JSON loading, dictionary merging).
- [ ] **Tier 2 (OS) Extraction:** Create `insetu/core/utils_core.py`. Move all Developer OS-specific physics (e.g., cartography tree generators, workspace configuration sanitization, and repo templating) into this new module.
- [ ] **Import Rewrite:** Execute a global codebase sweep to update import references.
  - Core OS and Extensions should target `from insetu.core.utils_core` for Gather/OS physics.
  - Kernel files should target `from insetu.utils` for generic operations.

## Notes / Execution Log