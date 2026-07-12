# ADR 0021: Standardized Extension State Isolation & Lifecycle Governance

## Context
As the number of custom workspace extensions grew, features began managing reactive data and background worker polling via independent, ad-hoc Zustand instances. When a user executed a hot-swap between distinct multi-tenant workspaces, these stores frequently retained stale data in memory or kept interval ticks alive. This resulted in ghost layouts, orphaned asynchronous microtasks, and critical cross-tenant data leaks.

## Decision
We standardize all frontend feature state extensions on the custom SDK factory pattern `createExtensionStore`. All standalone Zustand definitions are superseded by this model. 

Furthermore, we mandate a rigorous element eviction and store cleanup phase inside the core application router during workspace transition events.

## Consequences
* **Absolute Multi-Tenant Isolation**: States are strictly namespaced per workspace using automated subscription hooks.
* **Resilience Against Ghost States**: Optional UI components are completely purged from the DOM and state memory is wiped clean before a new workspace hydrates, preventing cross-contamination.
* **Architectural Uniformity**: Simplifies the addition of future dashboard modules by eliminating state management boilerplate for extension authors.