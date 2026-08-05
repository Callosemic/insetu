# 🌉 inSetu Architecture: Gather IoC Refactor
**Date:** 2026-08-04
**Context:** Centralizing Context Compilation & Garbage Collection

## The Problem: Domain Leaks & Ghost Artifacts
Currently, RAG payload generation is decentralized. Extensions (like `Flow` and `Git`) handle their own compilation loops, chunking math, and garbage collection. This causes three critical failures:
1. **Ghost Files:** Renaming workflows or shifting diffs leaves orphaned `.txt` files on disk because bespoke GC loops miss edge cases.
2. **Domain Leakage:** Tier-1/Tier-2 modules like `utils_core.py` contain hardcoded logic (`get_available_contexts`) trying to guess what files *should* exist by manually parsing workspace configs.
3. **Event Loop Thrashing:** Multiple extensions attempt to compile simultaneously or trigger overlapping VFS writes.

## The Solution: Inversion of Control (IoC)
`Gather` will become the strict, definitive orchestrator for the entire RAG payload universe. Extensions no longer write to disk; they simply declare their intended topology. 

### 1. The Declaration Contract
`Gather` will emit the `gather_declare_topology` hook. Extensions will yield a list of schemas:
\`\`\`python
{
    "filename": "workflow_api_audit_context.txt",
    "meta": {"type": "flow", "title": "API Audit", "domain": "Workflows"},
    "generator_callback": callable,  # Returns {"header": str, "blocks": list[str], "files": list[str]} or None
    "recall_callback": callable      # Optional: Returns dict or None for differential JIT sweeps
}
\`\`\`

### 2. The Master Loop (generate_context_file)
1. **Poll:** Emit `gather_declare_topology` to collect the absolute universe of expected files across the OS.
2. **Compile:** Execute the `generator_callback`s in parallel. Feed the raw text blocks into `compile_context_payload` (so `Gather` owns chunk math).
3. **The Vacuum:** Cross-reference the yielded `filename` keys against the physical `.txt` files in `contexts/`, `diffs/`, and `workflows/`. Instantly delete any file that wasn't declared (excluding active ephemerals).

### 3. The Differential Loop (_surgically_update_manifest)
When `vfs_mutated` fires, `Gather` passes the ledger events to the declared `recall_callback`s. Extensions evaluate if their specific scope is dirty. If yes, they return text blocks to recompile; if no, `Gather` skips disk I/O entirely.

### 4. Eradicating Domain Leaks
`get_available_contexts()` in `utils_core.py` will be lobotomized. It will now simply emit `gather_declare_topology` and pluck the `filename` keys, guaranteeing 100% UI dropdown accuracy statelessly.