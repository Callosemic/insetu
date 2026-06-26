---
title: "Phase 5: Virtual File System & Semantic Strategy"
status: "Todo"
type: "Architecture"
created: "2026-06-26"
---
# VFS & Semantic Strategy Pattern

Evolve the Yomama Sync Bridge into an atomic, syntax-aware patching engine.

### Action Items
- [ ] Build an in-memory Virtual File System (VFS) to hold multi-file patches.
- [ ] Enforce atomic rollbacks (if one file's syntax fails, abort the entire transaction).
- [ ] Implement the **Strict Engine** (Python/YAML) for absolute whitespace tracking.
- [ ] Implement the **Structural Engine** (JS/TS/Rust) using native AST formatters (e.g., Prettier).
- [ ] Implement the **Object Engine** (JSON) for recursive dictionary patching.
- [ ] Implement the **Fuzzy Engine** (Markdown/Text) utilizing Levenshtein distance for token-wrapping resilience.
    - *Architectural Note:* Fuzzy matching MUST evaluate the Search block and Sliding Window as joined, multi-line strings (`\n.join()`). Line-by-line fuzzy matching is strictly banned, as LLM line-wrapping hallucinations will cause catastrophic array desynchronization.
    - *Architectural Note:* The Fuzzy Engine must utilize an "Accordion Window" (Variable-Sized Sliding Window). Because LLMs frequently merge or split lines, the window must expand/contract by a variance (e.g., +/- 3 lines) at each index to find the highest `difflib` ratio, returning the dynamic `start` and `end` bounds for accurate deletion.
- [ ] Extract the "Fat Controller" transaction loop (Smart Path Resolution, Genesis Routing, Syntax Validation) out of `app.py` and encapsulate it fully within `engine_bridge.py`.