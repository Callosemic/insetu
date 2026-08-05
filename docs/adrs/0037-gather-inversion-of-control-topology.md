# ADR 0037: Gather Inversion of Control (IoC) Context Compilation and Step Chaining

## Status
Accepted

## Context
Previously, RAG payload generation in `engine_gather.py` relied on direct directory traversals (`os.walk`) and monolithic configuration inspections (`_compile_repo_buckets`). Extensions generating custom artifacts (such as Workflows or Git diffs) executed independent compilation passes or hooked directly into synchronous VFS events, leading to three architectural vulnerabilities:
1. **Ghost Artifacts:** Renaming or deleting source assets left orphaned `.txt` context files on disk.
2. **Domain Leakage:** Core utilities (`utils_core.py`) contained hardcoded logic trying to guess context outputs by parsing workspace configuration structures.
3. **Event Loop Starvation:** Concurrent, uncoordinated compilation passes triggered race conditions and HTTP event loop locks.

## Decision
We fully transition RAG Context Compilation to an **Inversion of Control (IoC)** topology with multi-step pipeline chaining:
1. **Declarative Topology Contract (`gather_declare_topology`)**: Extensions yield topology declarations containing output filenames, metadata, a `generator_callback` (for full sweeps), and an optional `recall_callback` (for differential JIT updates).
2. **Master Orchestrator & Global Vacuum**: `generate_context_file()` collects all declared topology schemas, executes generator callbacks in parallel, and vacuums physical `.txt` files in context directories that were not explicitly declared in the active topology pass.
3. **Differential Recall Loop**: `_surgically_update_manifest()` evaluates mutated VFS ledger events against declared `recall_callback` hooks. If a domain is dirty, only its specific payload is recompiled; otherwise, I/O is skipped.
4. **Compilation Step Chaining**: `register_compilation_steps` allows extensions to register sequential worker tasks. The engine topologically sorts these steps, dispatches the chain, and emits `compilation_sequence_complete` upon final step completion.
5. **Cartographer Integration**: Cartographer listens to `compilation_sequence_complete` to trigger non-blocking repository mapping after all contexts settle.

## Consequences
* **Positive:** Complete decoupling of the Gather compiler from domain directory physics and folder conventions.
* **Positive:** Total elimination of orphaned context files via the master vacuum pass.
* **Positive:** Deterministic, non-blocking compilation pipelines with post-compilation cartography mapping.
* **Negative:** Requires extensions that generate context artifacts to implement `gather_declare_topology` and `register_compilation_steps` hook handlers.