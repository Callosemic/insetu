# 0006: Tenant-Isolated Compilation Locks

## Status
Accepted (2026-07-03)

## Context
As inSetu scales to support stateless multi-tenant workspace routing, employing a single global `threading.Lock()` during RAG context compilation created a systemic bottleneck. If one tenant was actively compiling their codebase, any other tenant requesting syncs or generation sequences was instantly locked out or served cached data, degrading the multi-tenant isolation guarantee.

## Decision
We have implemented a dynamic, dictionary-backed locking mechanism (`_COMPILER_LOCKS = {}`) guarded by a rapid, lightweight global lock during its initialization. This allows each discrete `workspace_id` to acquire an independent, state-bound compilation lock.

## Consequences
* **Positive:** Concurrent compilation requests across independent workspace tenants can now process perfectly in parallel without collision.
* **Positive:** Retains the core architectural mandate to prevent double-compilations *within* a single workspace, stopping redundant disk I/O.
* **Negative:** A marginal increase in the application's base memory footprint to track the dynamic lock matrix.