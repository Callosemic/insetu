# ADR 0022: High-Performance Differential Context Compilation and Unmanaged Fixture Ledgers

## Status
Accepted (2026-07-13)

## Context
As active repository workspaces scale to contain hundreds of tracking scripts, source trees, and prose layouts, executing full-sweep RAG context collections (`generate_context_file`) on every file save introduces unacceptable I/O overhead and event loop bottlenecks. Furthermore, supporting multi-tenant workspaces where some targets are local, unmanaged non-Git directories requires a reliable mechanism to identify filesystem modifications without performing resource-intensive directory traversals.

## Decision
We implement a multi-track High-Performance Differential Context Compilation architecture in the core Gather engine:
1. **Git Porcelain Delta Interception:** For standard repositories, the background compilation worker issues low-overhead `git status --porcelain -uall` subprocess commands to instantaneously capture mutated or untracked paths.
2. **SQLite Unmanaged Fixture Ledger:** For unmanaged or non-Git file structures, we deploy a declarative `workers` database schema initializing a `nongit_fixtures` ledger. Core file save operations (`execute_vfs_save_physical`) intercept mutations and record them to this cache JIT.
3. **Surgical Re-Compilation:** The Gather engine processes these delta sets via `_surgically_update_manifest()`, compiling only the specific affected sub-buckets or dynamic modules rather than rewriting the entire workspace index.

## Consequences
* **Positive:** Massive performance boost, cutting context stabilization latency from O(N) to O(1) for standard file modifications.
* **Positive:** Perfect multi-tenant platform parity across standard Git tracking setups and local unmanaged media vaults.
* **Negative:** Introduces a dependency on thread-local cache integrity, which is safeguarded by strict Write-Ahead Logging (WAL) and queue-coalescing locks.