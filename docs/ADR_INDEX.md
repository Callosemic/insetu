# inSetu Architecture Decision Records (ADR) Index

This index serves as the centralized mapping for all active architectural decisions governing the inSetu Developer OS Micro-Kernel and Extension Ecosystem.
## Core Architecture & Multi-Tenancy
* **[ADR 0001: inSetu Genesis and Extension Architecture](adrs/archived/0001-insetu-genesis-and-extension-architecture.md)** - Extracted the Developer OS into the independent `inSetu` package and introduced the dynamic Extension Architecture.
* **[ADR 0002: Spatial Physics & Extension Architecture](adrs/0002-workspace-physics-and-extensions.md)** - Anchored execution to `.insetu/config.json` via a global switchboard, formalizing domain-specific capabilities as extensions.
* **[ADR 0003: Stateless Request-Scoped Multi-Tenant REST Routing](adrs/archived/0003-stateless-multi-tenant-routing.md)** - Replaced heavy `os.execv` reboots with stateless API routing using the `X-Workspace-ID` header[span_3](start_span)[span_3](end_span).
* **[ADR 0014: Event Bus Tenant Authorization](adrs/0014-event-bus-tenant-authorization.md)** - Implemented strict `_is_authorized` boundary filters in the Event Bus to prevent disabled extensions from hijacking tenant lifecycles[span_4](start_span)[span_4](end_span).

## Virtual File System (VFS) & I/O Pipelines
* **[ADR 0004: Asynchronous VFS Commit Pipeline](adrs/0004-asynchronous-vfs-commit-pipeline.md)** - Delegated physical file mutations to an off-thread `_VFS_WRITE_QUEUE` to eliminate HTTP event loop starvation[span_5](start_span)[span_5](end_span).
* **[ADR 0010: VFS Boundary Exemptions](adrs/0010-vfs-boundary-exemptions.md)** - Enforced Event Filtering at the listener level to short-circuit infinite recursive file saves for generated artifacts[span_6](start_span)[span_6](end_span).
* **[ADR 0011: VFS Barrier Synchronization](adrs/0011-vfs-barrier-synchronization.md)** - Enforced `_VFS_WRITE_QUEUE.join()` during background tasks to prevent read-after-write disk race conditions during compilations[span_7](start_span)[span_7](end_span).
* **[ADR 0013: POSIX-Compliant Pathlib Migration](adrs/0013-posix-compliant-pathlib-migration.md)** - Migrated spatial resolution algorithms to Python's native `pathlib.Path` to eliminate string-based OS pathing hacks[span_8](start_span)[span_8](end_span).
* **[ADR 0018: Event-Sourced VFS Ledger and High-Performance Context Compilation](adrs/0018-event-sourced-vfs-ledger.md)** - Transitioned the core gather mechanism to a database-backed state machine, establishing a 5-second macro slew limiter and boot-time heuristics[cite: 1].

## Frontend & State Management
* **[ADR 0007: Stateless UI Factory and Component Decoupling](adrs/0007-stateless-ui-factory-and-component-decoupling.md)** - Centralized generic UI primitives (Modals, Dropdowns) into a `UIFactory` to eradicate imperative DOM generation[span_9](start_span)[span_9](end_span).
* **[ADR 0015: CodeMirror 6 Migration & Native ES Modules](adrs/0015-codemirror6-migration.md)** - Replaced EasyMDE with CodeMirror 6 imported natively via `esm.sh` to advance the zero-bundler architecture[span_10](start_span)[span_10](end_span).
* **[ADR 0021: Standardized Extension State Isolation & Lifecycle Governance](adrs/0021_standardized_state_isolation.md)** - Standardized frontend state into `createExtensionStore` Zustand slices that namespace properly and garbage-collect memory on workspace swaps[span_11](start_span)[span_11](end_span).
## Extension SDK & Network Gateway
* **[ADR 0005: Transport Shell Decoupling & Pure Logic Extraction](adrs/archived/0005-transport-shell-decoupling.md)** - Separated HTTP REST controllers from pure domain logic functions to allow extension invocation without HTTP overhead.
* **[ADR 0012: Extension Subdirectory Extraction](adrs/archived/0012-extension-subdirectory-extraction.md)** - Isolated optional extension modules strictly into `insetu/extensions/` and `insetu/static/js/extensions/` to preserve core Micro-Kernel boundaries.
* **[ADR 0016: Explicit API Client and Fetch Rewriter Deprecation](adrs/0016-explicit-api-client-and-fetch-deprecation.md)** - Deprecated global URL rewriting in favor of explicitly routed `window.inSetu.api.workspace` and `window.inSetu.api.system` clients.
* **[ADR 0017: Extension SDK & The "Pit of Success" Architecture](adrs/0017-extension-sdk-and-pit-of-success.md)** - Established `InSetuExtension` and `InSetuElement` base classes to natively handle multi-tenant routing, SQLite declarative schemas, and frontend teardown hygiene.
* **[ADR 0024: Frontend SDK Decoupling & Domain Accessor Migration](adrs/0024-frontend-sdk-decoupling-and-domain-accessors.md)** - Abstracted OS chassis functions into semantic getters (`this.vfs`, `this.sys`, `this.ui`, `this.editor`) and banned relative chassis imports in extensions.

## Background Processing & Capabilities
* **[ADR 0006: Tenant-Isolated Compilation Locks](adrs/0006-tenant-isolated-compilation-locks.md)** - Replaced global compilation locks with a dynamic dictionary of `_COMPILER_LOCKS` to allow parallel concurrent compilations across separate tenants[span_16](start_span)[span_16](end_span).
* **[ADR 0008: Offline-First Synchronization & The "Offline Typewriter"](adrs/0008-offline-first-synchronization.md)** - Upgraded the frontend with an IndexedDB mutation queue and Service Worker to handle offline Markdown edits safely[span_17](start_span)[span_17](end_span).
* **[ADR 0009: Ephemeral Artifacts and Immediate Jobs Ledger](adrs/0009-ephemeral-artifacts-and-immediate-jobs-ledger.md)** - Standardized background task execution tracking via the `immediate_jobs` ledger and implemented the `ephemeral_artifacts` auto-purger[span_18](start_span)[span_18](end_span).
* **[ADR 0022: High-Performance Differential Context Compilation and Unmanaged Fixture Ledgers](adrs/0022-differential-context-compilation.md)** - Optimized RAG compilation via Git porcelain tracking and a persistent unmanaged file mutation ledger.
* **[ADR 0023: Polymorphic Entity-Action Card Registry](adrs/0023-polymorphic-entity-action-card-registry.md)** - Standardized visual presentation cards into a declarative, type-mapped registry framework to eliminate structural UI layout fragmentation.
* **[ADR 0025: Declarative App Shell, yenVUI Component Integration & Brokered SDK Resources](adrs/0025-declarative-app-shell-and-brokered-resource-management.md)** - Consolidated layout assembly into `<insetu-app-shell>`, integrated `yenVUI` primitives, and introduced brokered resource tracking in `InSetuElement`.