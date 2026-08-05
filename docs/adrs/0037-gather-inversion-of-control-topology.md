# ADR 0037: Gather Inversion of Control Topology and Decoupled Manifest Compilation

## Status
Accepted

## Context
Previously, the Gather RAG context compilation engine owned both the context compilation pipeline and direct file system inspection logic. This caused domain leaks where Gather tried to guess what files should exist by parsing workspace configurations directly, resulting in orphaned artifacts and race conditions during high-velocity file modifications.

## Decision
1. **Inversion of Control (IoC):** Gather becomes the sole orchestrator for context compilation, emitting `gather_declare_topology` hooks for extensions to declare their target payloads statelessly.
2. **Vacuum Garbage Collection:** Gather cross-references declared topology filenames against physical context files, automatically purging undeclared or orphaned context artifacts.
3. **Differential Recalls:** VFS mutation events trigger recall callbacks registered by extensions, enabling surgical re-compilation of dirty buckets without full workspace sweeps.

## Consequences
* **Positive:** Complete elimination of orphaned context files and hardcoded workspace inspection logic.
* **Positive:** Subsecond differential context updates on VFS mutation events.
* **Negative:** Extensions must explicitly implement `gather_declare_topology` hooks to participate in context compilation.