# ADR 0034: Declarative Async Job Action Binding and Gather Loop Decoupling

## Status
Accepted

## Context
As the frontend extension ecosystem matured, individual Lit components (`ext_git.js`, `ext_freshdesk.js`, `ext_research.js`, `ext_hooks.js`, `ext_ingest.js`) frequently implemented imperative `this.api.post()` handlers followed by explicit `this.api.pollJob()` loops to manage background worker progress and completion callbacks. This created redundant boilerplate, inconsistent UI loading states, and exception handling drift.

On the backend, synchronous execution of extension compilations (such as `engine_flow` recompiling workflow batches) inside the primary Gather context sweep loop created thread locks and event loop starvation, blocking fast system response times during boot and full context sweeps.

## Decision
1. **Declarative Job Action Binding (`this.api.bindJobAction`)**: Standardized the frontend SDK API client with `this.api.bindJobAction(endpoint, payloadGetter, options)`. Components bind button clicks directly to job-submitting actions, delegating payload extraction, progress telemetry, job polling, and error handling to the SDK.
2. **Gather Loop Decoupling via Background Workers**: Decoupled extension context compilation (e.g. `engine_flow` workflow batch compilation) from the synchronous Gather sweep loop (`on_compile_contexts`). Extensions submit background worker jobs (`ctx.jobs.submit`) to process compilations off-thread, releasing the compiler lock immediately.
3. **Workspace Boot Scope Isolation**: Mandated `@hooks.on('workspace_boot')` over `@hooks.on('system_boot')` for extension initialization, ensuring background worker registrations and disk-to-DB syncs execute strictly within request-scoped tenant boundaries.

## Consequences
* **Positive**: Eradicates repetitive imperative job polling boilerplate across frontend extension views.
* **Positive**: Prevents event loop thread starvation during RAG context sweeps by offloading extension compilations to background workers.
* **Positive**: Enforces clean multi-tenant isolation during extension startup.