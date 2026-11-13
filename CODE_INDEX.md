# inSetu Developer OS Code Index

This index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.

```text
insetu/
├── .github/                        # GitHub configuration and CI/CD automation workflows.
│   └── workflows/                  # GitHub Actions workflow definitions.
│       ├── battery.yml             # Callosemic stack battery: akasa -> sutram -> insetu, stopping at the first red suite.
│       └── ci.yml                  # Runs the shared Callosemic stack battery (akasa -> sutram -> insetu) on every push to main.
├── .gitignore                      # Git ignore rules.
├── .gitkeep                        # Git folder retention.
├── CHANGELOG.md                    # Auto-generated semantic release changelog.
├── CODE_INDEX.md                   # Topological map of the inSetu repository (this file).
├── LICENSE                         # Apache-2.0 open-source software license.
├── NOTICE                          # Copyright notice and third-party software attributions.
├── README.md                       # Primary project overview, architecture, and installation guide.
├── REVIEWING.md                    # Reviewing inSetu
├── docs/                           # Internal Documentation and Architecture.
│   ├── 00_index.md                 # Master Index for inSetu.
│   ├── 01_engineering_standards.md # Engineering standards and audit guardrails.
│   ├── 02_extension_api_contract.md # Extension architecture and API contracts.
│   ├── 03_extension_inventory_topology.md # Living inventory of active/planned extensions.
│   ├── 04_ui_design_standards.md   # UI/UX design standards and guardrails.
│   ├── 05_extension_developer_guide.md # Extension developer guide ("Pit of Success").
│   ├── 06_extension_compliance_checklist.md # Extension compliance checklist and audit guardrails.
│   ├── 07_sdk_v2_contracts.md      # Interface contracts for the V2 extension SDK.
│   ├── 08_sutram_contracts.md      # Sutram Platform API & Interface Contracts.
│   ├── ADR_INDEX.md                # Ledger of Logic for inSetu ADRs.
│   ├── adrs/                       # Architectural Decision Records.
│   │   ├── 0071-synchronous-workspace-swap-fsm-three-way-occ-and-declarative-volumes.md # Synchronous workspace swap FSM, 3-way OCC text merging, and declarative volume mounts.
│   │   ├── 0072-core-pipeline-akasa-membrane-declarative-volumes-and-jit-healing.md # Core pipeline Akasa membrane decoupling, declarative volumes, and JIT artifact healing.
│   │   ├── 0073-devops-extension-suite-membrane-decoupling-and-declarative-diff-volumes.md # DevOps extension suite membrane decoupling and declarative diff volume mounts.
│   │   ├── 0074-knowledge-suite-membrane-decoupling-declarative-volumes-and-substack-publishing.md # Knowledge suite membrane decoupling, declarative volumes, and Substack HTML snippet publishing.
│   │   ├── 0075-workflow-management-suite-membrane-decoupling-declarative-flow-volumes-and-tracker-hub-embedding.md # Workflow management suite membrane decoupling, declarative flow volumes, and tracker settings hub embedding.
│   │   ├── 0076-dual-representation-macro-preview-dependency-whitelisting-and-tier2-membrane-decoupling.md # Dual-representation macro preview, dependency whitelisting, and Tier 2 membrane decoupling.
│   │   ├── 0077-devops-suite-flask-decoupling-typed-workers-and-canonical-routing.md # DevOps extension suite Flask transport decoupling, typed workers, and canonical routing.
│   │   ├── 0078-knowledge-suite-flask-decoupling-typed-workers-and-canonical-routing.md # Knowledge extension suite Flask transport decoupling, typed workers, and canonical routing.
│   │   ├── 0079-workflow-management-suite-flask-decoupling-typed-workers-and-canonical-routing.md # Workflow management suite Flask transport decoupling, typed workers, and canonical routing.
│   │   ├── 0080-mcp-server-declarative-agent-routines-and-ast-refactoring.md # ADR 0080: Model Context Protocol (MCP) Gateway, Declarative Agent Orchestration Routines, AST-Aware Refactoring Primitives, and Recovery Tok...
│   │   ├── 0081-relational-watermark-derivation-mcp-stdio-bridge-and-reboot-polling-resilience.md # ADR 0081: Reactive Relational Watermark Derivation, MCP Stdio CLI Bridge, AST Refactoring Directives, and Reboot Resilience
│   │   ├── 0082-yomama-multi-surface-shell-deferred-chunk-healing-and-openai-compatible-gateway.md # ADR 0082: Yomama Multi-Surface Shell Architecture, Deferred Post-Valid Chunk Auto-Healing, OpenAI-Compatible Local Inference Gateway, and Co...
│   │   ├── 0083-compute-endpoint-pools-cognitive-profiles-markdown-routines-and-yomama-v4-directives.md # ADR 0083: Universal Compute Endpoint Pools, Cognitive Configuration Profiles, Markdown-as-Code Agent Routines, and Yomama Patch Protocol v4...
│   │   ├── 0084-ast-symbol-drift-watermarks-template-overlay-driver-and-topology-upkeep-audit.md # ADR 0084: AST Symbol Drift Watermarks, Template Overlay VFS Driver Delegation, and Topology Upkeep Audit Substrate
│   │   ├── 0085-single-file-frontend-membrane-schema-repeaters-and-universal-secret-vaulting.md # ADR 0085: Single-File Frontend Membrane Isolation, Declarative Schema Repeaters, and Universal Repeater Secret Vaulting
│   │   ├── 0086-git-diff-capabilities-autonomous-routines-and-tailscale-extension-retirement.md # ADR 0086: Git Diff Capabilities, Autonomous Routines, Tailscale Extension Retirement, and Single-File Membrane Compliance
│   │   ├── 0087-flow-extension-decommissioning-tracker-schema-repeaters-and-hooks-bridge-protection.md # ADR 0087: Flow Extension Decommissioning, Tracker Settings Repeater Migration, and Hooks Bridge Path Protection
│   │   ├── 0088-stack-ci-battery-single-file-sdk-membrane-vendor-locking-and-whois-remote-identity.md # ADR 0088: Callosemic Stack CI Battery, Single-File SDK Membrane, Vendored Substrate Provenance Locking, and Whois Remote Identity Verificati...
│   │   ├── 0089-dynamic-code-context-scouting-web-chat-handoff-composer-and-cognitive-target-bindings.md # ADR 0089: Dynamic /code Context Scouting, Interactive Web-Chat Handoff Composer, Yomama Patch Splitting, and Cognitive Profile Target Bindin...
│   │   ├── 0090-decoupled-llm-target-resolution-reentrant-routine-handoff-and-raw-transcript-preservation.md # ADR 0090: Decoupled LLM Target Resolution, Reentrant Routine Handoff Propagation, and Raw Transcript History Preservation
│   │   ├── 0091-lifeboat-bottom-layer-auth-host-gatehouse-and-workspace-confinement.md # ADR 0091: Lifeboat Bottom-Layer Authentication, Host Gatehouse Verification, Panic Token Gating, and Workspace Confinement
│   │   ├── 0092-incremental-topology-gitignore-parity-and-post-commit-cache-invalidation.md # ADR 0092: Incremental Topology Gitignore Parity via Batched Check-Ignore and Post-Commit Manifest Cache Re-Invalidation
│   │   ├── 0093-preview-exposure-leases-command-approval-and-core-module-priority.md # ADR 0093: App Server Exposure Leases, Human-Only Custom Command Approval, Protected VFS Target Enforcement, and Core Module Priority Loading
│   │   ├── 0094-formal-response-schemas-post-commit-test-diagnostics-and-adaptive-working-set-compaction.md # ADR 0094: Formal Response Schema Registry, Post-Commit Test Diagnostics Gate, Adaptive Working-Set Compaction, and Context Budget HUD
│   │   ├── 0095-child-environment-confinement-repo-landmarks-routine-integration-and-mcp-optional-includes.md # ADR 0095: Child Environment Confinement, Repository Landmarks Routine Integration, and MCP Optional Prompt Include Resolution
│   │   ├── 0096-code-split-codemirror-language-packs-manifest-ssot-and-vendor-lock.md # ADR 0096: Code-Split CodeMirror Language Packs, Manifest-Driven Mode Resolution, Layer-3 Local Packs, and Vendor Lock Verification
│   │   ├── 0097-two-phase-yomama-parser-signature-memoization-in-place-healing-and-overlap-rebasing.md # ADR 0097: Two-Phase Lookahead Yomama Parser, Content-Addressed Signature Memoization, In-Place n-1 Auto-Healing, and Deterministic Overlap R...
│   │   ├── 0098-interleaved-ast-diffs-persistent-cartographer-descriptions-topology-sieve-reconciler-and-workspace-extension-approvals.md # ADR 0098: Interleaved AST Diffs, Persistent Cartographer Working Memory, Topology Sieve Reconciler, S8 Workspace Extension Approvals, and Un...
│   │   ├── 0099-devops-extension-suite-zero-css-modernization-batched-git-cat-file-and-sieve-diff-parity.md # ADR 0099: DevOps Extension Suite Zero-CSS Modernization, Batched Git Cat-File Pre-Fetching, Topology Sieve Diff Parity, and Landmark-Driven...
│   │   ├── 0100-knowledge-and-work-extension-suites-convergence-sieve-parity-and-metronome-polling.md # ADR 0100: Knowledge & Content and Work & Automation Suites Convergence, Sieve Parity, and Metronome Polling Unification
│   │   ├── 0101-s8-confirmed-protected-changes-attestation-store-smoke-testing-and-lifeboat-fallback.md # ADR 0101: S8 Confirmed Protected Changes, Unified Attestation Store, Subprocess Recovery Smoke Testing, and Last-Good Lifeboat Fallbacks
│   │   ├── 0102-four-tier-agent-directives-repository-attestation-and-unified-session-protocols.md # ADR 0102: Four-Tier Agent Directives, Repository Attestation Acceptance, and Unified Session Protocols
│   │   ├── 0103-optional-str-buffer-algebra-and-wave-1-system-decomposition.md # 0103: Optional[str] Buffer Algebra, Bridge Working Tree, and Wave 1 System Decomposition
│   │   ├── 0104-wave-3-decompositions-three-tier-bridge-repair-markdown-ast-and-build-versioned-offline-boot.md # 0104: Wave 3 Decompositions, Three-Tier Bridge Repair & Sandwich Anchor Healer, Markdown AST Provider, S8 Human-Origin Allowlist, and Build-...
│   │   ├── 0105-six-bucket-routine-envelope-lens-projector-dual-track-session-ledger-and-index-claims.md # ADR 0105: Six-Bucket RoutineEnvelope, Multi-Scheme Lens Projector, Dual-Track Session Ledger, Shared-Clone Index Claims, and Python Floor Ga...
│   │   ├── archived/               # Superseded and historical ADR documents.
│   │   │   ├── 0001-insetu-genesis-and-extension-architecture.md # Original inSetu extraction and extension architecture genesis.
│   │   │   ├── 0002-workspace-physics-and-extensions.md # Defines the tenant workspace boundaries and extension loading.
│   │   │   ├── 0003-stateless-multi-tenant-routing.md # Initial stateless request-scoped multi-tenant REST routing setup.
│   │   │   ├── 0004-asynchronous-vfs-commit-pipeline.md # Defines the non-blocking VFS write queue and thread safety.
│   │   │   ├── 0005-transport-shell-decoupling.md # Decoupling of HTTP transport shell from pure domain logic.
│   │   │   ├── 0006-tenant-isolated-compilation-locks.md # Defines thread-local locks for RAG payload compilations.
│   │   │   ├── 0007-stateless-ui-factory-and-component-decoupling.md # UI decoupling from business logic via Zustand UDF.
│   │   │   ├── 0008-offline-first-synchronization.md # Offline capabilities and Service Worker caching.
│   │   │   ├── 0009-ephemeral-artifacts-and-immediate-jobs-ledger.md # Management of short-lived job artifacts and garbage collection.
│   │   │   ├── 0010-vfs-boundary-exemptions.md # Rules for paths exempt from strict VFS isolation.
│   │   │   ├── 0011-vfs-barrier-synchronization.md # Synchronization barriers for asynchronous VFS flushes.
│   │   │   ├── 0012-extension-subdirectory-extraction.md # Extraction of domain extensions into isolated subdirectories.
│   │   │   ├── 0013-posix-compliant-pathlib-migration.md # Standardization on POSIX paths for cross-platform parity.
│   │   │   ├── 0014-event-bus-tenant-authorization.md # Authorization rules for cross-tenant event bus emissions.
│   │   │   ├── 0015-codemirror6-migration.md # Transition from legacy editors to CodeMirror 6.
│   │   │   ├── 0016-explicit-api-client-and-fetch-deprecation.md # Mandates the use of the centralized inSetu API client.
│   │   │   ├── 0017-extension-sdk-and-pit-of-success.md # Defines the InSetuExtension and InSetuElement base classes.
│   │   │   ├── 0018-event-sourced-vfs-ledger.md # SQLite event sourcing for VFS mutations and Watchdog events.
│   │   │   ├── 0021_standardized_state_isolation.md # Unidirectional Data Flow and tenant state isolation.
│   │   │   ├── 0022-differential-context-compilation.md # Surgical updates to RAG contexts avoiding full recompilation.
│   │   │   ├── 0023-polymorphic-entity-action-card-registry.md # Dynamic context-aware actions for UI entity cards.
│   │   │   ├── 0024-frontend-sdk-decoupling-and-domain-accessors.md # Front-end SDK abstraction (this.vfs, this.sys, this.editor).
│   │   │   ├── 0025-declarative-app-shell-and-brokered-resource-management.md # Declarative UI layout definitions and slot brokering.
│   │   │   ├── 0026-unified-token-gatehouse-and-tailscale-auth.md # Centralized REST/WebSocket authentication and Tailscale WHOIS.
│   │   │   ├── 0027-global-multi-select-and-batch-action-registry.md # Global UI selection tray and batch action execution.
│   │   │   ├── 0028-native-hash-routing-and-event-bus.md # Zero-bundler SPA routing using URL hashes.
│   │   │   ├── 0029-core-kernel-extraction-and-three-tier-architecture.md # Separation of Kernel, Core OS, and Domain Extensions.
│   │   │   ├── 0030-kernel-utility-bisect-and-domain-relocation.md # Decoupling kernel utilities from core OS domains.
│   │   │   ├── 0031-sutram-micro-kernel-vendorization-and-vfs-ledger-unification.md # Vendorizing Sutram and merging VFS tracking ledgers.
│   │   │   ├── 0032-dynamic-polyglot-vendorization-and-importmap-resolution.md # Import map strategies for offline-first vendor libraries.
│   │   │   ├── 0034-async-job-action-binding-and-gather-decoupling.md # Binding UI actions directly to background polling jobs.
│   │   │   ├── 0035-vfs-file-resolution-hooks-and-topology-gateway.md # Centralized resolution of logical vfs:// and ctx:// paths.
│   │   │   ├── 0036-vfs-manifest-sqlite-cqrs-and-delta-sync.md # Moving manifest indexing from JSON to SQLite CQRS.
│   │   │   ├── 0037-gather-inversion-of-control-topology.md # Inverting context assembly dependencies to Cartographer.
│   │   │   ├── 0038-decoupled-topology-engine-partitioned-manifest-two-stage-slew-limiting.md # Stage 1 (VFS) and Stage 2 (CTX) slew limiters.
│   │   │   ├── 0039-decentralized-manifest-signature-sync-and-topology-boot.md # Syncing manifest signatures statelessly on UI boot.
│   │   │   ├── 0041-deprecation-of-ui-zones-and-presentation-decoupling.md # Deprecation of UI zones and presentation decoupling.
│   │   │   ├── 0042-vfs-logical-uri-boundary-standardization-and-path-heuristic-purge.md # Standardized vfs:// logical URI boundaries and purged legacy path heuristics.
│   │   │   ├── 0043-client-offline-provider-and-offline-engine.md # Client offline provider, SW core vendorization, and outbox reconciliation.
│   │   │   ├── 0044-ruamel-yaml-frontmatter-parsing-and-uri-event-canonicalization.md # Round-trip YAML frontmatter parsing and canonical vfs:// event normalization.
│   │   │   ├── 0045-two-pass-deterministic-boot-sequence.md # Two-pass deterministic boot sequence bisecting spatial discovery and deferred mutation.
│   │   │   ├── 0046-unified-watchdog-debouncer-and-manifest-caching.md # Unified Watchdog debouncer, pre-I/O intent capture, and thread-local manifest caching.
│   │   │   ├── 0047-queued-event-barrier-sentinel-vfs-synchronization.md # Queued event-driven barrier sentinel for exact VFS write watermark synchronization.
│   │   │   ├── 0048-akasa-kernel-package-extraction-and-insetu-uri-wrapper.md # Extraction of Tier 1 Kernel into standalone 'akasa' package and InSetuURI domain wrapper.
│   │   │   ├── 0049-sse-telemetry-pipeline-ram-slew-limiter-and-on-demand-context-compilation.md # Real-time SSE telemetry pipeline, Stage 1 RAM queue slew limiting, and on-demand context compilation.
│   │   │   ├── 0050-openapi-spec-gateway-universal-binary-execution-and-workspace-event-routing.md # Real-time OpenAPI 3.0 spec gateway, universal binary execution wrapper, and multi-tenant workspace event routing.
│   │   │   ├── 0051-generic-dag-compilation-chain-resolution-and-step-anchoring.md # Generic Akasa DAG compilation chain resolution, positional step anchoring, and Watchdog manifest exclusion.
│   │   │   ├── 0052-polymorphic-uri-coercion-bucket-address-refinement-and-sse-step-telemetry.md # Polymorphic InSetuURI coercion, BucketAddress SSOT refinement, and un-blocked SSE step telemetry.
│   │   │   ├── 0053-git-state-resolution-autostash-pulls-and-non-fast-forward-resilience.md # Git rebase/merge state resolution, autostash pulls, and multi-repo sweep isolation.
│   │   │   ├── 0054-multi-column-viewport-projections-and-virtual-buffer-editing.md # Multi-column viewport projections and virtual buffer editing.
│   │   │   ├── 0055-vfs-parity-action-middleware-and-singleton-modal-deprecation.md # VFS parity gatekeeper action middleware, singleton file modal deprecation, and InSetuURI coercion hooks.
│   │   │   ├── 0056-system-sdk-module-renaming-spatial-grid-routing-and-syntax-fallback.md # System SDK module renaming, spatial grid routing, and Tree-Sitter syntax fallback.
│   │   │   ├── 0057-workspace-swap-layout-eviction-and-yv-icon-migration.md # Pre-swap layout eviction, yv-icon migration, and primitive alias purge.
│   │   │   ├── 0058-universal-llm-gateway-react-agent-harness-and-vfs-modal-projection-decoupling.md # Universal LLM gateway, autonomous ReAct agent harness, and spatial VFS projections.
│   │   │   ├── 0059-extension-modal-annihilation-spatial-projection-migration-and-store-eviction.md # Extension modal annihilation, spatial viewport projections, and store eviction governance.
│   │   │   ├── 0060-git-aware-topology-manifest-sync-and-spatial-diff-projections.md # Git-aware topology CQRS ledger, real-time manifest delta sync, and spatial diff projections.
│   │   │   ├── 0061-polymorphic-bulk-entity-actions-subsumption-pruning-and-recursive-vfs-eviction.md # Polymorphic bulk entity actions, subsumption pruning, and recursive VFS eviction.
│   │   │   ├── 0062-projection-popouts-occ-concurrency-and-memoized-manifest-cqrs.md # Ephemeral pop-out windows, SHA-256 OCC conflict detection, and memoized manifest derivations.
│   │   │   ├── 0063-atomic-vfs-bulk-mutations-popout-presence-and-sw-consolidation.md # Atomic VFS bulk mutations, popout presence heartbeat, and Service Worker consolidation.
│   │   │   ├── 0064-core-prompt-engine-virtual-module-templates-and-job-api-unification.md # Core prompt engine graduation, virtual module template projection, and Akasa job API unification.
│   │   │   ├── 0065-repository-data-containment-extension-state-hydration-and-security-hardening.md # Repository data containment (.insetu-data/), dual-scope notes migration, and cryptographic hook gating.
│   │   │   ├── 0066-canonical-uris-inter-workspace-mounts-and-config-cascade-hardening.md # Canonical scheme:// URIs, inter-workspace ws:// mounts, and 3-tier configuration cascade hardening.
│   │   │   ├── 0067-universal-extension-suite-modernization-and-domain-mounts.md # Universal extension suite modernization, declarative domain mounts, and SDK standardization.
│   │   │   ├── 0068-hierarchical-vfs-sieve-sub-bucket-filtering-and-settings-hub.md # Hierarchical VFS sieve, .gitignore sub-bucket filtering, and unified OS Settings Hub.
│   │   │   ├── 0069-managed-app-server-preview-bulk-vcs-and-memory-telemetry.md # Managed dev server preview supervisor, bulk Git VCS actions, and kernel memory telemetry.
│   │   │   └── 0070-akasa-kernel-lifecycle-encapsulation-and-lifeboat-resilience.md # Akasa kernel lifecycle encapsulation, 4-file membrane isolation, and Lifeboat FS resilience.
│   │   └── superseded/             # Archived and superseded architectural decision records.
│   │       ├── .gitkeep            # Git folder retention.
│   │       ├── 0033-kernel-package-encapsulation-and-root-wrapper-cleanup.md # Moving kernel dependencies to isolated packages (akasa).
│   │       └── 0040-system-configuration-ssot-and-multi-scoped-settings.md # Centralized settings schema definition and hierarchical scope isolation (daemon, workspace, repo).
│   ├── brainstorm/                 # Exploratory architecture notes and design scratchpad.
│   │   └── 2026-11-09-sota-agentic-frontiers-on-unified-primitives.md # High-leverage designs for dynamic stack-trace proximity filters, deterministic Best-of-N patch tournaments, sub-turn streaming probe interce...
│   ├── models/                     # Human-authored subsystem mental models and state-machine invariant specifications.
│   │   ├── agent_orchestrator_and_rag.md # Black-box DAG execution contracts, the 6 volatility-ordered context buckets, fork-join holding confinement, and self-contained healing loops...
│   │   ├── mddb_and_tracker.md     # Recursive Markdown-as-a-Database records, heading-scoped sub-record spans, Containment vs. Ur-Record intersection graphs, and zero-hack structural lenses.
│   │   ├── proximity_filters_and_domain_jumps.md # Composable RAG retrieval algebra unifying AST call graphs, Hebbian affinity, string fuzziness, vector embeddings, custom multiplex schemas,...
│   │   └── yomama_bridge.md        # Three-phase state machine, canonical ordering, n-1 healing, and content-addressed signature invariants for the Yomama Sync Bridge.
│   └── plans/                      # Architectural blueprints and multi-sprint implementation plans.
│       ├── 2026-08-09-keyboard-shortcuts-editor.md # Blueprint: Native Keyboard Shortcuts Hub & Live HUD (sys:shortcuts)
│       ├── 2026-10-30-repo-facts-and-directives.md # Architectural Blueprint: Layered Settings, Repository Facts, and Directives
│       ├── 2026-11-02-decomposing-god-objects-across-the-triad.md # RFC: Decomposing God Objects & Purifying the System Module Across Akasa, Sutram & inSetu
│       ├── 2026-11-02-multitenant-scope-sutram.md # RFC: Multi-Tenant Scope Isolation, Ordered Quiescence & Fault-Barrier Architecture
│       ├── 2026-11-03-routine-expression-compiler-and-parser-unification.md # Create blueprint stub for compiler-grade routine condition parsing and Yomama parser unification, explicitly marked for human-architect disc...
│       ├── 2026-11-03-six-bucket-orchestrator-and-composable-rag.md # Refactor orchestrator.py, engine_agent.py, and context_assemble.py to implement the 6-bucket envelope, 4 resource lenses, composable RAG uni...
│       ├── 2026-11-03-subsystem-mental-models-and-worker-fault-transparency.md # Create a blueprint for institutionalizing Subsystem Mental Models across the core engines, wiring blast-radius model injection, and enforcin...
│       ├── 2026-11-04-ast-import-rewriting-file-moves.md # Plan: Moves That Keep Imports Working (Bridge Issue #15, RELOCATE Targets, AST Import Rewriting)
│       ├── 2026-11-04-prompts-tree.md # Plan stub for one prompts tree: canonical templates materialized per repository by scope, overrides that never overwrite, directives as stac...
│       ├── 2026-11-04-system-notices.md # Plan: System Notices, One Mechanism for Everything That Needs Your Attention
│       ├── 2026-11-05-core-extension-sdk-abstractions.md # Consolidates six recurring UI, VFS, and SQLite/Frontmatter patterns across citations, research, ingest, notes, publish, and skills into Ring...
│       ├── 2026-11-07-post-diff-audit-and-mvcc-concurrency.md # Post-Diff Audit Remediation, Greenfield Hygiene & Multi-Actor MVCC Plan
│       ├── 2026-11-08-alternate-engines.md # Alternate Engines: Cloud Workspaces, Offline Capability Handlers, Python in the Browser and a Frontend-Only Deployment
│       ├── 2026-11-09-mddb-and-tracker-streamlining.md # Migrate Tracker from status-folder file shuffling and setDynamicLayoutSlots tab repeaters to the unified md-db record/edge ledger, URI-stabl...
│       ├── 2026-11-09-sutram-backend-adapter-and-akasa-transport-contract.md # Formalize the symmetric Backend Adapter interface in Sutram (mirroring SutramUIAdapter on the chassis edge), ship AkasaBackendAdapter as the...
│       ├── 2026-11-10-agent-loop-and-sandbox.md # One plan for what 'the agent works' means: a run takes a task and returns a staged Yomama stack, a transcript and a result; edits stage in a...
│       ├── 2026-11-10-in-app-help.md # Help that ships inside the package: per-module help declared in manifests, a read-only ctx://help/ volume, a skippable getting-started tutor...
│       ├── 2026-11-10-update-release-pipeline.md # Plan for restructuring the update extension around one release pipeline that works for any project type: a release declaration that travels...
│       ├── 2026-11-11-jit-virtual-context-recipes.md # Plan (Speculative): JIT Virtual Context Recipes, Dual-Tier LRU/TTL Artifact Cache & Gesture-Safe Client Share
│       ├── 2026-11-11-sarga-cognitive-vm-blueprint.md # Create a clean, domain-agnostic architectural blueprint for extracting sarga (the standalone Cognitive Virtual Machine) between akasa and do...
│       ├── 2026-11-11-test-legitimacy-quiescence-and-mutation-gates.md # Plan: Test Suite Legitimacy — Deadlock Timeouts, Worker Quiescence, DAG Execution Assertions & Targeted Mutation Gates
│       ├── 2026-11-12-lens-contract.md # New plan for the lens contract shared by every context provider (roadmap P25).
│       ├── 2026-11-12-memory-and-conversation-ledger.md # New speculative plan: conversation history and long-term memory on one ledger, mapped onto the session ledger, md-db and the lens contract,...
│       ├── 2026-11-12-shared-test-kit.md # New plan for the shared test kit, one pytest plugin package for every Callosemic repository (roadmap P25).
│       ├── agent-briefs/           # Cross-model review briefs and implementation handoff notes.
│       │   ├── .gitkeep            # Git folder retention.
│       │   ├── gemini_agent_harness_and_rag_lane.md # Parallel Lane Brief: Agent Harness, 6-Bucket RAG Funnel & Dogfooding Observability
│       │   └── gemini_offline_bridge_followup.md # Follow-up for Gemini: after the Nov 9 round
│       └── archived/               # Superseded and historical ADR documents.
│           ├── 2026-11-03-s8-confirmed-protected-changes.md # Plan: S8 Confirmed Protected Changes, One Attestation Store, Smoke Test, Last-Good Lifeboat
│           ├── 2026-11-05-sutram-offline-architecture-plan.md # Sutram Autonomous Offline Kernel & Host Policy Inversion Plan
│           └── 2026-11-05-yomama-cell-ir-and-inline-timeline-healing.md # Archive completed Yomama PatchCell identity and inline healing plan.
├── insetu/                         # Python application package.
│   ├── .gitkeep                    # Git folder retention.
│   ├── app.py                      # [Micro-Kernel & Extension Bootloader]
│   │   ├── def load_workspace_extensions() # Two-stage topological bootloader separating Tier 2 Core and Tier 3 extensions with fault quarantine.
│   │   ├── def parse_semver(v_str) # Converts a SemVer string into a comparable integer tuple (major, minor, patch).
│   │   ├── def eval_single_clause(v_tuple, clause) # Evaluates a single comparison clause against a version tuple.
│   │   ├── def satisfies_range(version_str, range_str) # Evaluates compound range expressions (e.g., '>=5.0.0 && <6.0.0').
│   │   ├── def resolve_python_vendors(active_exts) # Statelessly scans core and extension vendor.json manifests to resolve and inject Python dependencies.
│   │   ├── def resolve_js_vendors(active_exts) # Resolves and builds the JS import map for the frontend bootloader statelessly.
│   │   ├── def serve_extension_static(ext_name, filename) # Serves static assets and vendored dependencies directly from an extension directory.
│   │   ├── def serve_extension_js(ext_name) # ADR 0012: Dynamically serve frontend JS from the bundled extension subdirectory.
│   │   ├── def sw()                # Serves the root Service Worker script (/sw.js) with no-cache headers.
│   │   ├── def root_readme()       # Serves the repository README.md over HTTP.
│   │   ├── def manifest()          # Serves the dynamic Progressive Web App manifest (/manifest.json).
│   │   ├── def intercept_local_static_assets() # Intercepts standard static asset routing routes before Flask's native static file engine serves them, checking the local environment first.
│   │   ├── def favicon()           # Serves the application favicon asset.
│   │   ├── def api_system_panic()  # Hard reboot of the OS process, setting the simulated panic flag.
│   │   ├── def recovery_ui()       # Zero-JS escape hatch in case the frontend bundle is completely bricked.
│   │   ├── def compute_build_id()  # Short deterministic content/mtime digest of the frontend boot shell, core modules, and extension entrypoints.
│   │   ├── def index()             # Renders the main SPA entry point with the active importmap, extensions, and X-InSetu-Build-ID header.
│   │   ├── def inject_bypassed_extensions(cfg, workspace_id, **kwargs) # Injects quarantined and bypassed extension diagnostic metadata into the workspace config payload.
│   │   └── def run_app()           # Starts the Flask/Werkzeug server with kernel initialization and background worker ignition.
│   ├── cli.py                      # [Daemon & Process Management]
│   │   ├── def scaffold_profiles(cwd) # Minimal zero-dependency profile bootstrapper for the Immutable Recovery Bootloader.
│   │   ├── def load_recovery_app(cwd) # The lifeboat's run_recovery_app, or the last-good copy's when the current lifeboat will not import (S8).
│   │   └── def main()              # CLI entrypoint dispatching serve, init, service, auth, gui, and mcp-stdio subcommands.
│   ├── core/                       # Core frontend SDK and UI components.
│   │   ├── __init__.py             # Module initialization.
│   │   ├── agent/                  # Autonomous ReAct agent harness and streaming chat interface.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── agent.js            # Agent chat streaming UI, turn history, and session management.
│   │   │   │   └── class InSetuCoreAgent # Primary multi-turn chat view with Two-Part Context Budget HUD, Execution Trace, Staged Patch Stacks, and Web-Chat handoff.
│   │   │   ├── agent_routine_studio.js # Declarative Routine Studio and Routine Catalog UI components extracted from agent.js (God-Objects Wave 3.3).
│   │   │   │   ├── function formatWavefrontBadge(wavefronts) # Formats a compact topological wavefront progression badge string for routine cards.
│   │   │   │   ├── class InSetuAgentRoutineProjection # Visual DAG step builder and raw Markdown-as-Code routine editor projection.
│   │   │   │   └── class InSetuCoreAgentRoutines # Categorized catalog surface for browsing, filtering, and launching declarative routines.
│   │   │   ├── agent_staged_stacks.js # Collapsible DAG Execution Trace ("Thinking") and Staged Patch Stacks components for the Agent Chat view.
│   │   │   │   ├── function hasYomamaPatchBlocks(text) # Returns true when a string contains any Yomama v4 patch or lifecycle directive marker.
│   │   │   │   ├── class InSetuCoreAgentSessions # Sidebar widget listing chat sessions and creating timestamped conversations.
│   │   │   │   ├── class InSetuAgentExecutionTrace # Collapsible per-node and fan-out execution trace component for Agent Chat turns.
│   │   │   │   ├── class InSetuAgentStagedStacks # Staged Yomama patch stack and Query Quickpack review card group component with 1-click Confirm & Commit.
│   │   │   │   └── class InSetuAgentHandoffPanel # External Web-Chat handoff composer with Same-Window Delta vs. New-Window Full context selector.
│   │   │   ├── agent_store.js      # Agent Harness state store (AgentStore) and routine target URI classifier extracted from agent.js (God-Objects Wave 3.3).
│   │   │   │   ├── function preWarmHandoffContext(handoffWrapper) # Pre-warms full or delta handoff context artifacts into the VFS share cache on pause.
│   │   │   │   └── function classifyRoutineTargetUri(rawInc) # Validates a routine include URI against loaded contexts, diffs, prompts, and repositories.
│   │   │   ├── engine_agent.py     # ReAct agent execution loop, prompt packing, and self-healing patch retry logic.
│   │   │   │   ├── def get_routines(ctx) # Lists all available declarative Markdown-as-Code and YAML routines with step timings, problems, and context options.
│   │   │   │   ├── def api_save_routine(ctx) # Validates and saves a declarative routine in ctx://routines/.
│   │   │   │   ├── def api_delete_routine(ctx) # Deletes a workspace or user-template routine override.
│   │   │   │   ├── def api_ensure_plan_file(ctx) # Resolves or creates a canonical Markdown plan file URI for /plan.
│   │   │   │   ├── def api_resolve_test_command(ctx) # Inspects repository files to determine the appropriate test runner command.
│   │   │   │   ├── def api_agent_run_test(ctx) # Executes an approved repository test command with shell=False.
│   │   │   │   ├── def get_sessions(ctx) # Retrieves all chat sessions for the active workspace.
│   │   │   │   ├── def create_session(ctx) # Creates a new chat session record in SQLite.
│   │   │   │   ├── def api_ingest_reply(ctx) # Unified reply ingestion pipeline: compiles a standalone Quickpack for QUERY_CONTEXT blocks, strips patch/probe blocks, and inserts prose into chat_messages.
│   │   │   │   ├── def delete_chat_message(ctx, message_id) # Removes a specific message bubble from chat_messages and invalidates cold compaction blocks from that point forward.
│   │   │   │   ├── def get_messages(ctx, session_id) # Retrieves canonical message history (annotated with compaction tier), compacted view, working-set metrics, and per-tier cost ledger.
│   │   │   │   ├── def cancel_agent_turn(ctx) # Signals an active agent turn to abort before the next LLM or VFS step.
│   │   │   │   ├── def undo_last_agent_turn(ctx) # Reverts the most recent Yomama Bridge transaction for the session.
│   │   │   │   └── def submit_prompt(ctx) # Dispatches a user prompt, handoff resume, or colon-scoped slash routine into the agent worker.
│   │   │   ├── envelope.py         # Unified 6-Bucket RoutineEnvelope, ContextArtifact value object, and Web-Chat delta state machine.
│   │   │   │   ├── class ContextArtifact # Represents a single URI-addressed artifact mounted in one of the 6 canonical context buckets.
│   │   │   │   ├── class RoutineEnvelope # Single state and working-set container for a declarative Routine or Agent turn with Same-Window delta hashing.
│   │   │   │   ├── def reconcile_working_set_ttl(existing_ws) # Single Source of Truth for Session Working-Set Lifecycle (5-turn TTL decay and eviction).
│   │   │   │   ├── def parse_colon_command_tokens(raw_prompt) # Parses universal colon-scoped slash commands (/code, /upkeep:docs, /upkeep:docs:apply, /user:upkeep:docs).
│   │   │   │   ├── def parse_slash_command(raw_prompt, explicit_mode, routine) # Parses leading colon-scoped slash commands (/code, /plan, /ask, /yomama, /upkeep:docs, /user:<id>:<scope>, /undo).
│   │   │   │   └── def record_trace_step(chain_context, context_lock, node_id) # Appends or updates a structured node execution trace record in chain_context['global']['execution_trace'].
│   │   │   ├── expressions.py      # Declarative routine condition evaluator, 256KB scratch vaulter, and Yomama block prose stripper.
│   │   │   │   ├── def normalize_condition_expr(raw_expr, chain_context) # Token-safe normalizer binding {{ var | fallback }} placeholders and 'contains' operators for AST evaluation.
│   │   │   │   ├── def evaluate_when_condition(when_expr, chain_context) # AST-restricted, zero-eval conditional evaluator for 'when' / 'condition' / 'until' expressions.
│   │   │   │   ├── def vault_if_oversized(ctx, node_id, output_dict) # Spills node outputs >= 256 KB to ephemeral scratch storage via ctx.jobs.write_scratch.
│   │   │   │   └── def strip_yomama_blocks_keep_prose(raw_text) # Strips raw Yomama patch blocks and empty code fences while preserving surrounding conversational prose.
│   │   │   ├── orchestrator.py     # Declarative YAML routine DAG interpreter, conditional evaluator, and 256KB scratch vaulter.
│   │   │   │   └── def execute_declarative_routine(ctx, **kwargs) # Runs a declarative routine with origin 'routine' (S8): every tool call, file write and job it starts is marked as machine work, so protected...
│   │   │   ├── prompts/            # Management of global prompt templates and macro inclusions.
│   │   │   │   ├── routine_authoring_guide.md # Authoring guide for declarative Markdown-as-Code (ctx://routines/*.md) wavefront routines.
│   │   │   │   ├── start_session_protocol.md # Initializes an engineering or editorial session with repository landmarks, architectural directives, and the Yomama Patch Protocol.
│   │   │   │   └── test_triage_rubric.md # Diagnostic rubric for triaging test suite failures against implementation code.
│   │   │   ├── routine_check.py    # Routine check: reports every routine whose prompts do not resolve, so a routine pointing at a moved or deleted prompt shows up in Routine St...
│   │   │   │   ├── def check_routine(ctx, routine) # Problems with one loaded routine.
│   │   │   │   ├── def forget_routine_problems(workspace_id, saved_path) # Drops remembered check results: for one workspace when a prompt or routine file may have changed, or all of them.
│   │   │   │   └── def attach_routine_problems(ctx, routines) # Attaches cached prompt-resolution problems to each routine summary for Routine Studio.
│   │   │   ├── routine_loader.py   # Declarative Markdown-as-Code (.md) and YAML (.yaml) routine loader, serializer, and validator (God-Objects Wave 3.2).
│   │   │   │   ├── def extract_doc_referenced_files(ctx, user_prompt, docs_text) # Format- and repository-agnostic file reference extractor for attached plans, tickets, and notes.
│   │   │   │   ├── def collect_live_files_for_patch_healing(ctx, parsed_blocks, readonly_list) # Reads current disk contents of files targeted by a failed Yomama patch so the healing LLM has exact anchors.
│   │   │   │   ├── def clamp_rag_files_to_topology(ctx, candidate_files, allowed_repos, max_files, ...) # Clamps and resolves LLM-selected RAG file URIs against topology_ledger within allowed_repos.
│   │   │   │   ├── def build_context_file_metrics(ctx, constitution_files, reference_files, pinned_files) # Computes memoized estimated token counts per file URI in the active working set.
│   │   │   │   ├── def is_prose_document_uri(uri_or_path) # Returns True when a URI or path represents prose documentation, plans, or notes rather than executable source code.
│   │   │   │   ├── def compile_node_wavefronts(nodes) # Compiles routine nodes into level-order topological wavefronts via Ring 0 resolve_dag_wavefronts.
│   │   │   │   ├── def response_path_error(response_path) # Returns an error message when a routine's response_path does not target a document file, else None.
│   │   │   │   ├── def persist_routine_response(ctx, routine, response_text) # Saves a routine's declared report (response_path) directly through the VFS and returns its URI.
│   │   │   │   ├── def validate_routine_definition(routine_dict, normalize_cond_fn) # Validates routine id, response_path, reserved node IDs, DAG wavefronts, and condition expressions.
│   │   │   │   ├── def parse_routine_content(raw_text, fallback_id, is_markdown) # Parses and LRU-caches Markdown-as-Code (.md) or YAML (.yaml/.yml) routines into deep-copied definitions.
│   │   │   │   ├── def serialize_routine_to_markdown(defn) # Serializes a routine definition dict into Markdown-as-Code (YAML frontmatter + ## <node_id> sections).
│   │   │   │   ├── def list_available_routines(ctx) # Discovers all declarative routines (.md and .yaml) across Built-in Module .templates, Global User Templates, Workspace Overrides, and Share...
│   │   │   │   ├── def resolve_routine_mode(routine, requested_mode) # Resolves a requested slash mode against the routine's declarative `modes:` block.
│   │   │   │   └── def load_routine_definition(ctx, routine_id) # Loads a declarative routine (.md or .yaml) across the 3-Tier Same-Name Override Cascade: 1.
│   │   │   ├── routines/           # Co-located Git declarative DAG routines (/audit and /closeout).
│   │   │   │   ├── ask.md          # Answers architectural and codebase questions using a 2-stage context expansion funnel without mutating files.
│   │   │   │   ├── ask.yaml        # Declarative YAML routine for conversational Q&A and architecture inquiries without workspace mutations.
│   │   │   │   ├── bugfix.md       # Performs root-cause analysis on a bug report or stack trace and applies a minimal, non-regressive Yomama fix.
│   │   │   │   ├── code.md         # Scouts relevant workspace files, generates surgical Yomama patches, and applies them atomically.
│   │   │   │   ├── code.yaml       # Declarative YAML routine for code scouting, surgical Yomama patch generation, and atomic application.
│   │   │   │   ├── debt_ratchet.md # Audits newly committed turn diffs for duplicate helpers, dead code, or boundary leaks and applies a surgical cleanup patch if needed.
│   │   │   │   ├── implement.md    # Executes an architectural plan or ticket into concrete Yomama code patches and runs the Debt Ratchet audit.
│   │   │   │   ├── map_reduce_audit.yaml # Declarative YAML routine for parallel map-reduce auditing across repository buckets.
│   │   │   │   ├── plan.md         # Drafts or refines a persistent Markdown architectural plan using Yomama patches and verifies all referenced file targets via Cartographer.
│   │   │   │   ├── plan.yaml       # Declarative YAML routine for drafting and refining persistent Markdown architectural plans with Cartographer verification.
│   │   │   │   ├── refactor.md     # Executes behavior-preserving structural refactorings using Yomama RELOCATE, RENAME, and SEARCH/REPLACE blocks.
│   │   │   │   ├── scout_context.md # Scores candidate workspace files in parallel using the fast model tier to prune irrelevant context before synthesis.
│   │   │   │   ├── symbol_refactor.yaml # Declarative YAML routine for AST symbol relocation and token-aware renaming across files.
│   │   │   │   ├── test.md         # Resolves and runs the repository test suite in a bounded loop, triaging and patching failures automatically.
│   │   │   │   ├── upkeep.md       # Two-stage maintenance routine for documentation/symbol drift, zero-logic God-object modularization, and test suite relevance.
│   │   │   │   ├── workspace_turn.md # Classifies turn intent, synthesizes response and Yomama patches, and applies code/plan mutations atomically.
│   │   │   │   ├── workspace_turn.yaml # Declarative YAML routine for multi-stage workspace turn intent classification and patch synthesis.
│   │   │   │   ├── yomama.md       # Validates and commits Yomama patch blocks, automatically healing failed hunks against live VFS file contents in a bounded loop.
│   │   │   │   └── yomama.yaml     # Declarative YAML routine for validating, committing, and auto-healing Yomama patch blocks.
│   │   │   ├── schemas/            # Zero-dependency formal response schema registry and prompt directives.
│   │   │   │   ├── __init__.py     # Central formal response schema registry and prompt directive dispatcher.
│   │   │   │   │   ├── def register_schema(name, directive_fn, validator_fn) # Registers a formal response schema contract.
│   │   │   │   │   ├── def list_registered_schemas() # Returns a sorted list of registered schema contract identifiers.
│   │   │   │   │   ├── def get_schema_directive(schema_name) # Returns the prompt instruction directive for the requested schema.
│   │   │   │   │   ├── def validate_schema_response(schema_spec, raw_text) # Validates LLM output against a named registered contract or a JSON Schema dictionary.
│   │   │   │   │   └── def extract_query_context_directives(raw_text) # Extracts bounded <<<<<<< QUERY_CONTEXT read directives from an LLM response, tolerating chevron meltdown.
│   │   │   │   ├── diagnostics.py  # Test diagnostic contracts and JUnit XML parser for post-syntax test verification.
│   │   │   │   │   ├── class TestFailureItem # Structured record of a single failing test assertion or error.
│   │   │   │   │   ├── class TestDiagnosticSchema # Unified test run diagnostic emitted by bridge.test and ingested by test.md.
│   │   │   │   │   ├── def parse_junit_xml(xml_content, exit_code) # Parses JUnit XML output, extracting failure nodes while stripping all passing noise.
│   │   │   │   │   ├── def parse_test_tail_output(output_text, exit_code) # Fallback parser extracting failure slices from raw stdout/stderr when JUnit XML is absent.
│   │   │   │   │   ├── def get_test_diagnostic_directive() # Returns the prompt directive for test diagnostic responses.
│   │   │   │   │   └── def validate_test_diagnostic_response(raw_text) # Validates an LLM output against the TestDiagnosticSchema contract.
│   │   │   │   ├── plan.py         # Hierarchical plan schema and markdown parser for the insetu_plan protocol.
│   │   │   │   │   ├── class PlanTask # Atomic executable task with mandatory targets and test verification contract.
│   │   │   │   │   ├── class PlanSprint # Sequential grouping of atomic tasks within an epic.
│   │   │   │   │   ├── class PlanDocument # Top-level structured representation of an active plan artifact.
│   │   │   │   │   ├── def parse_plan_markdown(raw_text) # Parses plan.md YAML frontmatter and markdown task checklists into a PlanDocument.
│   │   │   │   │   ├── def serialize_plan_markdown(plan) # Serializes a PlanDocument back to canonical markdown with frontmatter.
│   │   │   │   │   ├── def get_plan_schema_directive() # Returns the prompt instruction directive for hierarchical plan generation.
│   │   │   │   │   └── def validate_plan_response(raw_text) # Validates an LLM output against the hierarchical plan contract.
│   │   │   │   └── rag.py          # RAG response contracts for MacroScout and ContextSlice retrieval.
│   │   │   │       ├── class MacroScoutSchema # Output contract for Stage 1 macro file discovery.
│   │   │   │       ├── class ContextSliceReference # A reference-only file slice specifying symbol signatures to retain.
│   │   │   │       ├── class ContextSliceSchema # Output contract for Stage 2 focused AST context assembly.
│   │   │   │       ├── def strip_markdown_fences(raw_text) # Strips markdown code fences and cleans trailing commas from raw LLM JSON text.
│   │   │   │       ├── def get_macro_scout_directive() # Returns the prompt instruction directive for macro file scouting.
│   │   │   │       ├── def validate_macro_scout_response(raw_text) # Validates an LLM output against the MacroScoutSchema contract.
│   │   │   │       ├── def get_context_slice_directive() # Returns the prompt instruction directive for fine-grained context slicing.
│   │   │   │       └── def validate_context_slice_response(raw_text) # Validates an LLM output against the ContextSliceSchema contract.
│   │   │   └── session_ledger.py   # Extract dual-track session transcript compaction, monotonic sequence numbering, and turn session persistence into session_ledger.py (alignin...
│   │   │       ├── def build_message_receipt(role, content, transaction_id, committed_files) # Synthesizes a deterministic 1-line micro-receipt for a canonical chat_messages row.
│   │   │       ├── def next_session_seq(ctx, session_id) # Returns the next monotonic message sequence number (1..N) for a chat session without reusing deleted numbers.
│   │   │       ├── def capture_turn_context_hashes(ctx, uris, limit) # Records the content hash of each file a turn worked with, as it stood when the turn ended.
│   │   │       ├── def compact_session_history(ctx, session_id, rows, existing_summary, ...) # Watermarked Dual-Track History Compaction preserving canonical message_id and monotonic seq coordinates.
│   │   │       ├── def persist_paused_turn_state(ctx, session_id, routine_id, routine_result, ...) # Persists working-set TTL state, web-chat hashes, and resumable checkpoint when a routine pauses for user handoff.
│   │   │       └── def finalize_completed_turn_state(ctx) # Persists assistant message, working-set TTL, Hebbian affinity edges, and session token ledger upon turn completion.
│   │   ├── attestations.py         # The attestation store (S8): one place for every grant a person makes that stays in force.
│   │   │   ├── class AttestationRefused(PermissionError) # Raised when code running for a model, an MCP client or a routine tries to record an approval.
│   │   │   ├── def control_dir_path() # The daemon's control directory, which holds host.json, this store, pending protected changes and the audit log.
│   │   │   ├── def attestations_path() # <control dir>/attestations.json, beside host.json.
│   │   │   ├── def digest_of()     # Stable digest of the exact thing a person approved (a command, a launch configuration).
│   │   │   ├── def describe_actor() # Who is acting, as far as insetu can tell: the call's origin and, for HTTP, the client.
│   │   │   ├── def attest(kind, subject, digest, detail, ...) # Records a person's approval of subject as it is now (digest), replacing any earlier grant; refused unless origin is in HUMAN_ORIGINS.
│   │   │   ├── def get_attestation(kind, subject) # The active grant for subject, or None (expired grants and grants from an earlier run count as absent).
│   │   │   ├── def is_attested(kind, subject, digest) # True when an active grant exists for subject and, if a digest is given, it covers exactly that digest.
│   │   │   ├── def list_attestations(kind) # Active grants, optionally of one kind.
│   │   │   ├── def revoke(kind, subject) # Removes the grant for subject.
│   │   │   └── def prune()         # Drops expired grants and grants from earlier runs.
│   │   ├── bridge/                 # Yomama Sync Bridge and AST validation engine.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── bridge.js           # [Sync Bridge Payload UI]
│   │   │   │   └── class InSetuExtBridge # Multi-surface Yomama Sync Bridge staging, dry-run triage, and live commit component.
│   │   │   ├── bridge_ast.py       # Yomama v4 AST symbol relocation, token-aware renaming, and commit message synthesis.
│   │   │   │   ├── def apply_ast_relocate_in_memory(source_content, target_content, source_uri, target_uri, ...) # Byte-exact AST symbol cut-and-paste (supporting single or comma-separated symbols) from source_content into target_content.
│   │   │   │   ├── def apply_ast_rename_to_content(filepath, content, target_symbol, new_symbol) # Token-aware symbol renamer for a single file buffer.
│   │   │   │   ├── def resolve_scope_files(workspace_id, scope_prefix, allowed_repos) # Resolves a URI prefix or glob pattern (e.g.
│   │   │   │   └── def generate_commit_message_from_ledger(ctx, repo, transaction_id, limit) # Synthesizes a Conventional Commit message and Transaction-ID trailers directly from recent bridge_ledger intent comments (<<<<<<< COMMENT).
│   │   │   ├── bridge_fuzzy.py     # Fuzzy matching and fallback regex algorithms.
│   │   │   │   ├── def heal_chevron_meltdown(text) # Trims conversational garbage or broken markdown fences trailing the final REPLACE block.
│   │   │   │   ├── def heal_latex_vert(text) # Replaces Gemini LaTeX math-mode pipe escapes (\vert{}) back into '|' strictly when bounded by $ ...
│   │   │   │   ├── def heal_citation_artifacts(text) # Strips leaked LLM citation markers (,, [cite_start], [cite_end]).
│   │   │   │   ├── def heal_llm_block_artifacts(text, reference_content) # Unified chatbot artifact healing pipeline for SEARCH and REPLACE blocks.
│   │   │   │   ├── def expand_macros(text, reference_content) # Expands Yomama transport escape macros.
│   │   │   │   ├── def is_effectively_identical(lines_a, lines_b) # Externalized comparison logic.
│   │   │   │   ├── def find_all_block_anchors(file_lines, block_lines, allow_boundary_partial) # Two-Tier Contiguous Block Anchor Scanner: - Tier 0 (Strict Full-Line Scan): Requires every non-empty line in block_lines to match file_lines...
│   │   │   │   ├── def find_sandwich_fuzzy_anchor(file_lines, block_lines) # Tier 2 Deterministic Sandwich-Weighted Anchor Healer: Locates candidate windows in `file_lines` where the top k_top and bottom k_bot lines o...
│   │   │   │   ├── def find_block_anchor(file_lines, block_lines, allow_boundary_partial) # Abstracted 100% contiguous block search engine.
│   │   │   │   ├── def normalize_patch_payload(text, reference_content) # Single Source of Truth normalizer for Yomama SEARCH, REPLACE, TEXTEDIT, and JSON_PATCH payloads.
│   │   │   │   ├── def apply_block_in_memory(content, block, silent, allow_algorithmic_heal) # Applies a SEARCH/REPLACE block in memory using strict, artifact-healed, boundary-partial, and sandwich-fuzzy anchor matching.
│   │   │   │   ├── def rebase_overlapping_block_in_memory(original_content, current_content, block, silent) # Tier 2 Deterministic Overlap Rebaser: When a patch block fails to anchor in `current_content` (A) because an earlier patch in the same batch...
│   │   │   │   ├── def apply_textedit_in_memory(content, block, silent) # Applies a <<<<<<< TEXTEDIT inline prose diff block ({-delete}} / {{+insert}}) using exact or soft-wrap-normalized character span matching.
│   │   │   │   └── def apply_json_patch_in_memory(filepath, content, block, silent) # Applies a <<<<<<< JSON_PATCH block (either a dotted/selector key-path dict or RFC 6902 array) to .json, .yaml/.yml, or .md (YAML frontmatter...
│   │   │   ├── bridge_history.js   # Yomama Sync Bridge ledger receipt history projection (InSetuExtBridgeHistory).
│   │   │   │   └── class InSetuExtBridgeHistory # Ledger receipt history viewer and transaction revert UI component.
│   │   │   ├── bridge_projections.js # Yomama Sync Bridge auxiliary projections: Diff Viewer, Chunk Editor, and Header Repo Filter.
│   │   │   │   ├── class InSetuBridgeDiffProjection # Side-by-side anchor and syntax diff inspection projection.
│   │   │   │   ├── class InSetuBridgeEditProjection # Interactive single-chunk patch editor projection.
│   │   │   │   └── class InSetuExtBridgeActions # Yomama surface header action toolbar and repository filter control.
│   │   │   ├── bridge_store.js     # Yomama Sync Bridge state store (BridgeStore) and declarative gate/flag UI metadata maps.
│   │   │   ├── bridge_test.py      # JUnit XML test runner adapter and exit-code fallback diagnostic extractor.
│   │   │   │   └── def run_repo_test_diagnostics(ctx, repo, command_override, target_files, ...) # Executes the configured test runner for repo and extracts compact diagnostics.
│   │   │   ├── bridge_vfs.py       # Async VFS commit pipelines and concurrency locks.
│   │   │   │   ├── def clear_bridge_eval_cache() # Clears the in-memory content-addressed FileEvalSig and PatchEvalSig caches.
│   │   │   │   ├── def compute_file_eval_signature(workspace_id, target_file, disk_hash, blocks, ...) # Tier 1 Per-File Bundle Signature (FileEvalSig): Pure function of the target file's on-disk SHA-256 hash, the ordered list of active patch bl...
│   │   │   │   ├── def compute_patch_eval_signature(resolved_path, input_buffer_hash, orig_disk_hash, block, ...) # Tier 2 Intra-File Sequential Chunk Signature (PatchEvalSig): Models a single chunk evaluation as a pure state transition from `input_buffer_...
│   │   │   │   ├── class FileTimeline # Single Source of Truth for one file's state progression B_0 -> B_1 -> ...
│   │   │   │   ├── class BridgeWorkingTree # Speculative VFS overlay for a single Bridge transaction.
│   │   │   │   ├── def validate_buffer_syntax(ctx, resolved_path, new_content) # Validates full-buffer syntax for .json, .py, and .js/.ts/.mjs files using Tree-sitter (with ast.parse / node --input-type=module -c verifica...
│   │   │   │   ├── def process_sync_transaction(vfs, workspace_id, data, sister_repos, ...) # Evaluates multi-file patch blocks in memory, enforces syntax/gate checks, and stages transitions.
│   │   │   │   └── def execute_bridge_sync(workspace_id, data, ctx) # Executes a full Yomama Bridge dry-run or live commit transaction with optional n-1 auto-healing.
│   │   │   ├── bridge_window.py    # Stripped-line SequenceMatcher and declaration/symbol window locator for failed Yomama Bridge anchors.
│   │   │   │   ├── def has_distinctive_anchor_line(content, search_str) # Fast pre-check before running multi-tier apply_block_in_memory on fuzzy candidate files: Returns True if `search_str` is empty (genesis) or...
│   │   │   │   ├── def locate_closest_window(file_lines, search_lines, replace_lines, symbol_hint) # Single Source of Truth window locator for failed SEARCH blocks: 1.
│   │   │   │   └── def extract_windowed_buffer_context(filepath, buffer_text, failed_blocks, window_radius, ...) # Extracts high-signal windowed slices from `buffer_text` for the AI patch healer: - Always includes the top module header (`Lines 1..40`) on...
│   │   │   ├── engine_bridge.py    # [Yomama Sync Bridge Transaction Logic]
│   │   │   │   ├── class BridgeLedgerRecord(TypedDict) # Typed schema for a single bridge_ledger database row.
│   │   │   │   ├── class BridgeHistoryResponse(TypedDict) # Response schema returning paginated bridge transaction receipts.
│   │   │   │   ├── def bridge_history(ctx) # Phase C: Returns the ephemeral ledger history for the UI.
│   │   │   │   ├── class BridgeRevertPayload(TypedDict) # Request schema naming the transaction_id and target_state for rollback.
│   │   │   │   ├── def bridge_revert(ctx) # Phase 5: Forward-replay reversion.
│   │   │   │   ├── class PatchResolution(TypedDict) # Per-cell or per-file user resolution override schema (selected_uri, approved_gate).
│   │   │   │   ├── class BridgeSyncPayload(TypedDict) # Request schema for dry-run or live bridge.sync patch transactions.
│   │   │   │   ├── def bridge_sync(ctx) # Receives Yomama payloads from the UI and dispatches the sync.
│   │   │   │   ├── class BridgeAstRelocatePayload(TypedDict) # Request schema for AST symbol relocation between source and target files.
│   │   │   │   ├── def bridge_ast_relocate(ctx) # Dispatches an in-memory or live AST symbol relocation transaction.
│   │   │   │   ├── class BridgeAstRenamePayload(TypedDict) # Request schema for token-aware symbol renaming across a URI scope.
│   │   │   │   ├── def bridge_ast_rename(ctx) # Dispatches a token-aware symbol rename transaction across matching files.
│   │   │   │   ├── class BridgeCommitMessageQuery(TypedDict) # Query schema for synthesizing a Conventional Commit message from bridge_ledger.
│   │   │   │   ├── class BridgeTestPayload(TypedDict) # Request schema for running repository test diagnostics via bridge.test.
│   │   │   │   ├── class BridgeTestApprovePayload(TypedDict) # Request schema for a person approving one custom test command for a repository (P5).
│   │   │   │   ├── def bridge_run_test_gate(ctx) # Executes an approved repository test suite and returns structured JUnit/tail diagnostics.
│   │   │   │   ├── def bridge_approve_test_command(ctx) # Records a person's approval of a custom repository test command; hidden from MCP and banned in routines (P5).
│   │   │   │   ├── def bridge_commit_message(ctx) # Synthesizes a Conventional Commit message from recent bridge_ledger intent comments.
│   │   │   │   ├── class BridgeTurnDiffPayload(TypedDict) # Request schema for collecting unified/interleaved diffs across one or more transaction IDs.
│   │   │   │   ├── def bridge_turn_diff(ctx) # Renders interleaved AST diffs and new/deleted file blocks for specified bridge transactions.
│   │   │   │   ├── class BridgeCompileTelemetryPayload(TypedDict) # Request schema for compiling recent LLM call telemetry and Bridge auto-heal case studies.
│   │   │   │   ├── def compile_ai_telemetry_context(ctx, limit) # Compiles a Gather-chunked diagnostic context payload (ctx://contexts/ai_telemetry_context.txt) containing tagged LLM telemetry and full befo...
│   │   │   │   └── def api_bridge_compile_telemetry(ctx) # Route handler compiling recent LLM telemetry and Yomama Patch Auto-Heal case studies into ctx://contexts/ai_telemetry_context.txt.
│   │   │   ├── parser.py           # Create dedicated Yomama Bridge lexer and lookahead parser module (extracted from utils_core.py) with deterministic block content hashing for...
│   │   │   │   ├── def get_base_step_and_diffs(lines) # Analyzes a block of code to find its true structural base indentation unit (LCD > 1).
│   │   │   │   ├── def compute_block_signature(block, resolution) # Computes a deterministic SHA-256 content signature for a parsed Yomama block and its user resolution.
│   │   │   │   ├── def parse_blocks(text) # Compiler-grade two-phase Lexer + Lookahead Parser for Yomama Bridge payloads: - Heals web-chat chevron meltdown (`> > > REPLACE`, `< < < SEA...
│   │   │   │   ├── def flatten_parsed_blocks(parsed_structure) # Returns a flat list of (raw_target_file, block_index_in_file, block_dict) sorted strictly by the canonical 0..n creation order ('order') in...
│   │   │   │   ├── def serialize_block_chunk(block, filepath, include_file_header, include_id) # Single Source of Truth serializer for a single Yomama block dict.
│   │   │   │   └── def serialize_blocks_to_yomama(file_to_blocks) # Serializes a mapping of filepath -> block dicts into canonical Yomama patch text.
│   │   │   └── prompts/            # Management of global prompt templates and macro inclusions.
│   │   │       └── yomama_patch_protocol.md # Built-in prompt template defining the Yomama Bridge SEARCH/REPLACE patch syntax.
│   │   ├── cartographer/           # Autonomous topology mapping and CODE_INDEX generation.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── cartographer.py     # [VFS Topology Mapper]
│   │   │   │   ├── def extract_existing_comments(index_path, repo_path, vfs_content) # Pass 1: Extracts path-scoped and basename comments from VFS content, falling back to Git history only if empty.
│   │   │   │   ├── def render_ascii_tree(node, comment_map, managed_dirs, prefix, ...) # Pass 2: Builds the new tree and injects the 3-tier waterfall comments and shallow AST symbol children.
│   │   │   │   ├── class CartographerExtractPayload(TypedDict) # Request schema for AST symbol source slice extraction.
│   │   │   │   ├── def api_cartographer_extract(ctx) # Slices and returns the exact AST source block for a target class, method, or function.
│   │   │   │   ├── class CartographerVerifySymbolsPayload(TypedDict) # Request schema for marking symbol body hashes as verified.
│   │   │   │   ├── def api_cartographer_verify_symbols(ctx) # Marks specified symbols as verified at their current AST body_hash, clearing [stale?] flags.
│   │   │   │   ├── class CartographerClaimIndexPayload(TypedDict) # Request schema naming the repository whose CODE_INDEX.md claim should transfer to this workspace.
│   │   │   │   ├── def api_cartographer_claim_index(ctx) # Human-only route transferring a shared clone's CODE_INDEX.md write claim to the active workspace.
│   │   │   │   ├── class CartographerEnrichPayload(TypedDict) # Request schema for fast-tier LLM symbol comment enrichment.
│   │   │   │   ├── def api_cartographer_enrich(ctx) # Batches undocumented or stale symbol snippets into a fast-tier LLM call and updates CODE_INDEX.md.
│   │   │   │   └── def map_repositories(workspace_id, silent, target_repos, extra_comments, ...) # Maps tracked repository file trees and AST symbols into CODE_INDEX.md, honoring shared-clone index claims.
│   │   │   ├── cartographer_enrich.py # Fast-tier LLM symbol enrichment and [stale?] description review for Cartographer.
│   │   │   │   ├── def build_enrich_symbol_context(rel_p, f_content, sym, file_desc) # Builds a high-signal source excerpt for Cartographer symbol enrichment and [stale?] review: - Prepends the enclosing file's 1-sentence descr...
│   │   │   │   ├── def parse_enrich_reply_map(llm_res) # Extracts and parses the JSON key->description map from an llm.complete response.
│   │   │   │   └── def execute_cartographer_enrich(ctx, repo_configs, extract_existing_comments_fn, map_repositories_fn, ...) # Describes '[comment required]' symbols and reviews '[stale?]' ones across batched fast-tier calls.
│   │   │   └── index_claim.py      # Decides which workspace writes a clone's CODE_INDEX.md when several workspaces or insetu instances mount that clone with different index rul...
│   │   │       ├── def index_rules_fingerprint(repo_cfg, workspace_cfg, include_symbols) # Hashes the configuration that shapes a CODE_INDEX.md render, so two workspaces can tell whether their renders agree.
│   │   │       ├── def may_write_index(repo_path, workspace_id, rules, take_over) # Returns (allowed, holder): whether this workspace may write the clone's CODE_INDEX.md, and which workspace holds the claim.
│   │   │       └── def warn_index_owned_elsewhere(repo_dir, workspace_id, holder) # Says once per process that this workspace is leaving a repository's CODE_INDEX.md to the workspace that holds it.
│   │   ├── config/                 # Repository and bucket topology configuration UI.
│   │   │   └── config.js           # UI for managing repository topologies and tracked buckets.
│   │   │       └── class InSetuExtConfig # Repository topology, sieve rules, and sub-bucket configuration editor component.
│   │   ├── directives.py           # directives.py is read by topology, the system routes and the agent, so it lives in core/ beside attestations.py
│   │   │   ├── def resolve_directive_tier_uri(tier, repo) # Maps a directive tier identifier ('user', 'workspace', 'repo_shared', 'repo_local') to its canonical VFS/CTX URI.
│   │   │   ├── def ensure_local_settings_gitignored(ctx, repo) # Ensures `settings.local/` is listed in `vfs://<repo>/.insetu-data/.gitignore` when local repo settings are written.
│   │   │   └── def get_directives(ctx, repo) # Assembles the active agent directives across the four tiers for `repo` (defaulting to the first mounted repo).
│   │   ├── editor/                 # Global CodeMirror editor settings.
│   │   │   └── engine_editor.py    # Editor preferences, language manifest discovery, and local language pack resolution.
│   │   │       ├── def get_preference(ctx) # Retrieves per-file or global editor preferences from SQLite.
│   │   │       ├── def set_preference(ctx) # Persists per-file or global editor preferences in SQLite.
│   │   │       ├── class VendorizePayload(TypedDict) # Request schema naming the CodeMirror language mode to resolve.
│   │   │       ├── class VendorizeResponse(TypedDict) # Response schema describing a resolved local CodeMirror language pack.
│   │   │       ├── def get_editor_languages(ctx) # Returns the merged language manifest; bundled language IDs always take precedence over local entries.
│   │   │       ├── def serve_vendor_asset(ctx, filename) # Serves user-placed local CodeMirror language packs from .insetu/vendor/codemirror/.
│   │   │       └── def vendorize_language(ctx) # Resolves a language pack descriptor locally: bundled manifest entries first, then local packs.
│   │   ├── fs/                     # Virtual File System REST gateway and editing modals.
│   │   │   ├── engine_fs.py        # VFS file operations, upload, and OCC conflict REST gateway.
│   │   │   │   ├── class FileTargetPayload(TypedDict) # Request schema naming a single target VFS/CTX/WS file URI.
│   │   │   │   ├── class FileDownloadZipPayload(TypedDict) # Request schema for exporting selected files and folders as a ZIP archive.
│   │   │   │   ├── def api_fs_download_zip(ctx) # Expands selected files and folders through the Topology Sieve and streams a deflated .zip archive, capped by file count and total size.
│   │   │   │   ├── def api_fs_exists(ctx) # Silent validation route that verifies file existence for the UI.
│   │   │   │   ├── def api_fs_fetch(ctx) # Unified authenticated URI read, binary streaming, and attachment download gateway.
│   │   │   │   ├── class FileGitDiffResponse(TypedDict) # Response schema containing HEAD baseline and current working tree text for a file.
│   │   │   │   ├── class FileProtectionResponse(TypedDict) # Whether a file is protected, with the message the editor shows.
│   │   │   │   ├── def api_fs_protected(ctx) # Reports whether a file is a protected recovery file, so the editor shows its banner and skips autosave (S8).
│   │   │   │   ├── def api_fs_git_diff(ctx) # Retrieves the Git HEAD baseline and current working tree text for a file.
│   │   │   │   ├── class FileSearchPayload(TypedDict) # Request schema for full-text workspace search queries.
│   │   │   │   ├── def api_fs_search(ctx) # Searches workspace files matching a text query and returns line snippets.
│   │   │   │   ├── class FileMovePayload(TypedDict) # Request schema naming source and destination URIs for a VFS move/rename.
│   │   │   │   ├── def api_fs_move(ctx) # Moves or renames a workspace file or directory through the VFS barrier.
│   │   │   │   ├── class FileActionPayload(TypedDict) # Request schema targeting a single VFS file or directory for archive/delete.
│   │   │   │   ├── def api_fs_archive(ctx) # Archives a workspace file or directory into the repository archive folder.
│   │   │   │   ├── def api_fs_delete(ctx) # Deletes a workspace file or empty directory through the VFS barrier.
│   │   │   │   ├── class BulkMutationItem(TypedDict) # Schema describing one file or folder entry in a bulk VFS operation.
│   │   │   │   ├── class FileBulkPayload(TypedDict) # Request schema for atomic multi-item VFS move, archive, or delete batches.
│   │   │   │   ├── def api_fs_bulk(ctx) # Executes an atomic multi-item VFS move, archive, or delete batch off-thread.
│   │   │   │   ├── class FileUploadRequest(TypedDict) # Multipart upload schema for binary files into a target VFS directory.
│   │   │   │   ├── class FileUploadResponse(TypedDict) # Response schema returning the saved canonical URI of an uploaded file.
│   │   │   │   ├── def api_fs_upload(ctx) # Native multipart/form-data uploader for robust binary handling.
│   │   │   │   ├── class FileSavePayload(TypedDict) # Request schema for VFS file writes with optional OCC base_hash.
│   │   │   │   └── def api_fs_save(ctx) # Universal save-back endpoint with 3-way OCC merge and explicit path routing guardrails.
│   │   │   ├── fs.js               # [Virtual File System Modals & UI]
│   │   │   │   ├── function bindDownloadDrag(e, filename, fetchUrl) # Attaches native DownloadURL drag-and-drop metadata to a file card or link.
│   │   │   │   ├── function isFileGitModified(filepath) # Returns true when a file has uncommitted Git modifications in AppStore.manifest.
│   │   │   │   ├── function resolveConflictOriginalPath(filepath) # Strips .conflict_<timestamp> suffixes to resolve the canonical base file URI.
│   │   │   │   ├── function viewTwoFileDiff(leftFilepath, rightFilepath) # Opens a side-by-side spatial diff projection comparing two VFS files.
│   │   │   │   ├── function viewFileGitDiff(filepath) # Opens a spatial diff projection comparing a file against its Git HEAD revision.
│   │   │   │   ├── function routeToSpatialGrid(filepath, label = null, preferre...) # Opens or focuses a document editor projection inside the spatial multi-column layout.
│   │   │   │   ├── function ensureFreshContext(filePath) # Emits insetu:ensure-fresh-artifact before copying or sharing a context artifact.
│   │   │   │   ├── function fetchAndCopy(filePath, explicitUrl = null) # Copies file or context text to the clipboard using the LRU share cache when warm.
│   │   │   │   ├── function fetchAndDownloadState(filePath, explicitUrl = null) # Downloads a file or compiled context artifact as a local attachment.
│   │   │   │   ├── function shareFiles(baseFile, chunks = null, isFS =...) # Shares file or multi-part context chunks via navigator.share with a 0 ms synchronous cache fast-path.
│   │   │   │   ├── function downloadFile(fetchUrl, fallbackFilename, fetc...) # Streams an authenticated file download to the browser.
│   │   │   │   ├── function viewInWindow(filename) # Opens a read-only context or file viewer projection in the spatial grid.
│   │   │   │   ├── function viewAndCopy(filename) # Opens a context artifact in a viewer window and copies its content to the clipboard.
│   │   │   │   ├── function refreshActiveFileViews(oldPath, newPath = null) # Synchronizes open buffer projections when a file is moved or renamed.
│   │   │   │   ├── function updateManifestState(mutations) # Applies surgical VFS mutation deltas to AppStore.manifest and invalidates stale share cache entries.
│   │   │   │   ├── function resolveEntityExportTarget(data = {}) # Resolves the canonical URI and chunk list for entity export actions.
│   │   │   │   ├── function resolveExpandedExportText(data = {}) # Resolves macro-expanded prompt text for copy, share, or download actions.
│   │   │   │   ├── function executeMove() # Submits a single file or folder move/rename request to fs/move.
│   │   │   │   ├── function deleteEmptyFolder(dirPath) # Deletes an empty directory through the VFS delete endpoint.
│   │   │   │   ├── function getGlobalManifest() # Returns a flat list of all tracked VFS and CTX URIs from AppStore.manifest.
│   │   │   │   ├── class InSetuVFSExplorer # Hierarchical VFS file tree explorer and bulk selection component.
│   │   │   │   ├── function pruneSubsumedTargets(items) # Removes child file/folder selections subsumed by a selected ancestor directory.
│   │   │   │   ├── function executeBulkMove(items) # Dispatches an atomic multi-item VFS move batch to fs/bulk.
│   │   │   │   ├── function executeBulkArchive(items) # Dispatches an atomic multi-item VFS archive batch to fs/bulk.
│   │   │   │   ├── function executeDownloadZip(items, archiveName = null) # Downloads selected files and folders as a streamed ZIP archive via fs/download_zip.
│   │   │   │   ├── function executeBulkDelete(items) # Dispatches an atomic multi-item VFS delete batch to fs/bulk.
│   │   │   │   ├── function getFileExtensionWarning(filename, basePath = '') # Warns when a new filename's extension is excluded by the target repository's sieve.
│   │   │   │   ├── function checkFileExtension(filename) # Validates a filename against active repository extension filters.
│   │   │   │   ├── function openNewFileModal(overridePath = null) # Opens the new file creation modal projection targeting overridePath or the active directory.
│   │   │   │   ├── function saveNewFile() # Creates a new file on disk via fs/save and opens it in the spatial editor.
│   │   │   │   ├── function openNewFolderModal(overridePath = null) # Opens the new folder or repository mount modal projection.
│   │   │   │   ├── function saveNewFolder() # Creates a new directory with a .gitkeep sentinel or registers a new repository mount.
│   │   │   │   ├── function viewSourceFile(filepath, isFS = false, bypassHo...) # Routes a file click to a custom editor or the spatial multi-buffer editor projection.
│   │   │   │   ├── function closeBrowseModal() # Closes the active workspace file/folder browser modal projection.
│   │   │   │   ├── function openWorkspaceBrowser(options = {}) # Opens the interactive workspace file or folder picker projection.
│   │   │   │   ├── function openFolderBrowser(callback = null) # Opens the workspace browser configured in folder-selection mode.
│   │   │   │   ├── function confirmFolderSelection() # Confirms the selected folder path in the browser projection and invokes its callback.
│   │   │   │   ├── function openBrowseModal(contextFilename) # Opens the file browser modal anchored to contextFilename's parent directory.
│   │   │   │   ├── function openVirtualFile(filename, content) # Opens an in-memory virtual text blob in a read-only spatial viewer projection.
│   │   │   │   ├── function openPartsModal(filepath) # Opens a selector modal listing all chunks of a multi-part context artifact.
│   │   │   │   ├── function uploadFileToWorkspace(targetDir) # Opens a file picker and uploads selected local files via multipart fs/upload.
│   │   │   │   ├── function openLinkModal(initialQuery = '', initialTab =...) # Opens the Markdown link insertion modal projection.
│   │   │   │   ├── function switchLinkTab(tab) # Switches the link insertion modal between filename and full-text search tabs.
│   │   │   │   ├── function onLinkSearchInput(val) # Updates the link insertion modal search query and triggers debounced search.
│   │   │   │   ├── function executeDeepLinkSearch(overrideQuery = null) # Queries fs/search for deep full-text Markdown link matches.
│   │   │   │   └── function executeLinkSearch(query) # Filters workspace manifest URIs by fuzzy filename match for link insertion.
│   │   │   ├── fs_editor_projection.js # Core VFS Editor, Frontmatter Editor, and File Diff Spatial Projections extracted from fs.js (God-Objects Wave 3.1).
│   │   │   │   ├── class InSetuEditorProjection # Multi-projection VFS document editor supporting CodeMirror 6, frontmatter drawers, macro previews, and Zen mode.
│   │   │   │   ├── class InSetuFrontmatterEditor # Specialized editor projection with YAML frontmatter mode permanently enabled.
│   │   │   │   └── class InSetuFileDiffProjection # Side-by-side Git HEAD and two-file comparison projection backed by sutram-diff-viewer.
│   │   │   ├── fs_modals.js        # VFS Explorer Modal Projections: Move File, New File, New Folder/Repository, Link Insert, and Workspace Browser.
│   │   │   │   ├── class InSetuMoveFileProjection # Spatial projection for moving or renaming a workspace file or directory.
│   │   │   │   ├── class InSetuNewFileProjection # Spatial projection for creating a new workspace file with extension sieve validation.
│   │   │   │   ├── class InSetuNewFolderProjection # Spatial projection for creating a new directory or mounting a new target repository.
│   │   │   │   ├── class InSetuLinkInsertProjection # Modal projection for fuzzy filename and deep full-text markdown link insertion.
│   │   │   │   └── class InSetuBrowserProjection # Interactive workspace file and folder picker projection.
│   │   │   └── fs_store.js         # Core VFS Buffer State Store (FsStore), OCC 3-way buffer reconciliation, auto-save, and hydration helpers (God-Objects Wave 3.1).
│   │   │       ├── function hasMacroSyntax(text) # Returns true when text contains prompt include macros or mustache fallback expressions.
│   │   │       ├── function normalizeVfsURI(path, defaultScheme = 'vfs') # Canonicalizes a path or URI string using InSetuURI with a default scheme fallback.
│   │   │       ├── function isBufferReadOnly(buf) # Determines whether an active editor buffer is read-only due to permissions, truncation, or preview mode.
│   │   │       ├── function canPreviewFileMacros(filepath, content = '') # Checks whether a file buffer supports live macro-expanded previewing.
│   │   │       ├── function resolveLiveBufferPreview(filepath, rawContent, isDirty =...) # Resolves live macro-expanded preview text for an editor buffer via event hook dispatch.
│   │   │       ├── function injectTextToBuffer(filepath, text, isMarkdown, isFS...) # [stale?] Loads raw text into an active buffer, applying 200KB display truncation when needed.
│   │   │       ├── function prepareBufferSavePayload(buf, filepath) # Validates JSON syntax and builds the normalized fs/save request payload with OCC base_hash.
│   │   │       ├── function rebaseConcurrentText(baseText, localText, remoteText) # Performs a 3-way line merge between base, local buffer, and remote disk text.
│   │   │       ├── function saveBufferFile(filepath, autoSave = false) # Commits a dirty VFS buffer to disk with 3-way OCC merge handling and offline outbox pinning.
│   │   │       ├── function reconcileBufferWithDisk(filepath, forceBaselineSync = fa...) # Fetches the latest disk state and rebases or updates the in-memory editor buffer.
│   │   │       ├── function flushAllDirtyBuffers(useKeepalive = false) # Flushes all uncommitted non-protected VFS buffers on window blur, workspace swap, or unload.
│   │   │       ├── function renameFileTracking(oldPath, newPath) # Migrates active buffers, auto-save timers, and layout projections when a file or folder is renamed.
│   │   │       ├── function hydrateVfsBuffer(filepath, { isFS = null, forceRe...) # Fetches file content and S8 protection status into FsStore.activeBuffers with deduplicated promises.
│   │   │       ├── function extractManifestFiles(...args) # Delegates manifest file list extraction to window.inSetu.utils.extractManifestFiles.
│   │   │       ├── function resolveFileFetchUrl(filepath, isFS = false) # Builds the authenticated /api/<ws>/fs/fetch URL for a canonical file URI.
│   │   │       ├── function getChunks(filepath) # Returns the ordered chunk URIs for a compiled context or VFS file from AppStore.manifest.
│   │   │       ├── function cacheShareText(filepath, text) # [comment required]
│   │   │       ├── function getCachedShareText(filepath) # [comment required]
│   │   │       ├── function invalidateShareCache(filepath = null) # [comment required]
│   │   │       ├── function preWarmShareArtifact(baseFile, chunks = null, isFS =...) # [comment required]
│   │   │       ├── function syncVirtualBuffer(virtualUri, fullText = null) # Updates or closes an in-memory virtual editor buffer.
│   │   │       └── function preCacheFiles(filepaths = [], { label = 'selec...) # Warms specified VFS files into the offline IndexedDB cache and updates telemetry.
│   │   ├── gather/                 # RAG Context compiler and manifest synchronizer.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── context_assemble.py # Unified RAG funnel (context.assemble) and Hebbian affinity graph.
│   │   │   │   ├── def scrub_outbound_secrets(text, secret_values) # Scrubs Fernet ciphertext tokens, boot tokens, and workspace secrets from outbound context strings.
│   │   │   │   ├── def collect_workspace_secrets(ctx) # Collects decrypted/raw secret values from the tenant secrets.json vault for outbound scrubbing.
│   │   │   │   ├── def assemble_blast_radius(ctx, edit_targets, user_message, history_summary) # 4-Layer Deterministic Blast Radius: 1.
│   │   │   │   ├── def parse_message_uri(raw_uri) # Canonicalizes any session message reference (`msg://<id>`, `msg://<session_id>/<id>`, or bare `msg_<id>`, with optional `[raw]` / `[full]` q...
│   │   │   │   ├── def project_resource_lens(ctx, uri, lens, **params) # Universal Representational Lens Projector projecting vfs://, ctx://, msg://, and mddb:// URIs across full, diff, slice, outline, and genesis.
│   │   │   │   ├── def detect_external_edits(ctx, filepaths) # SHA-256 External Edit Detection (Section 3.1): Compares live disk SHA-256 of working_set files against the latest bridge_ledger post_patch_h...
│   │   │   │   ├── def assemble_context_payload(ctx, edit_targets, user_message, strategy, ...) # Assembles volatility-ordered 3-tier context + neighborhood CODE_INDEX outline, registers turn_*_context.txt in manifest_ledger, and scrubs secrets.
│   │   │   │   ├── def resolve_query_context(ctx, query_text) # Resolves single-hop topology-confined symbolic/file read directives and msg:// session message recalls.
│   │   │   │   └── def compile_query_quickpack(ctx, raw_text) # Compiles a standalone Quickpack (ctx://contexts/quickpack_*_context.txt) from topology-tracked QUERY_CONTEXT blocks in raw_text.
│   │   │   ├── engine_gather.py    # [Context Compiler and Workflow Batch routing]
│   │   │   │   ├── def compile_context_payload(workspace_id, output_dir, base_uri, header_block, ...) # Universal compiler for all system contexts (Gather, Git, Flow).
│   │   │   │   ├── def handle_topology_resolved(workspace_id, dirty_repos, dirty_buckets, events, **kwargs) # Stage 2 Slew Limiter: Catches resolved topology and schedules a delayed RAG compilation.
│   │   │   │   ├── def get_ordered_compilation_steps(ctx) # Delegates compilation sequence resolution to Akasa's generic DAG orchestrator.
│   │   │   │   ├── def init_gather_workers(workspace_id, **kwargs) # Schedules initial context compilation workers after workspace topology boot completes.
│   │   │   │   ├── def on_gather_settings_updated(workspace_id, **kwargs) # Invalidates manifest caches and triggers recompilation when gather settings change.
│   │   │   │   ├── def hook_vfs_search(workspace_id, query, **kwargs) # Searches tracked workspace files for matching lines on vfs_search hook emissions.
│   │   │   │   ├── def provide_base_workspaces(target_repos, ledger_events, workspace_id, **kwargs) # Base Workspace Provider: Yields schemas for standard repo contexts and media vaults.
│   │   │   │   ├── def get_compiler_lock(wid) # Returns the per-workspace reentrant compilation lock.
│   │   │   │   ├── def generate_context_file(workspace_id, target_repos) # The Master Orchestrator Loop: Executes full sweeps based on declared topology and garbage collects.
│   │   │   │   ├── def vacuum_unaccounted_cache_on_complete(workspace_id, **kwargs) # Terminal Mark-and-Sweep Garbage Collector: Runs strictly AFTER all compilation DAG steps have updated manifest_ledger.
│   │   │   │   ├── class QueryContextPayload(TypedDict) # Request schema for single-hop QUERY_CONTEXT reads or standalone Quickpack compilation.
│   │   │   │   ├── def api_gather_context_assemble(ctx) # Assembles volatility-ordered 3-tier turn context payloads via assemble_context_payload.
│   │   │   │   ├── def api_gather_context_query(ctx) # Resolves single-hop symbolic read directives or compiles a standalone Quickpack when compile_quickpack=True.
│   │   │   │   ├── class ClearQuickpacksResponse(TypedDict) # Response schema reporting deleted quickpack file counts.
│   │   │   │   ├── def api_clear_quickpacks(ctx) # Purges all temporary quickpack context exports and clears the ephemeral artifact ledger.
│   │   │   │   ├── class PackSelectionPayload(TypedDict) # Request schema for packing selected files and folders into a Quickpack.
│   │   │   │   ├── def api_gather_pack_selection(ctx) # Queues an asynchronous background job to compile selected items into a Quickpack.
│   │   │   │   ├── class RepoTemplateResponse(TypedDict) # Response schema returning the default repository configuration template.
│   │   │   │   ├── def api_repo_template(ctx) # Returns the default configuration dictionary template required when appending a new target repository.
│   │   │   │   ├── def mount_gather_volumes(workspace_id, **kwargs) # Ensures legacy context cache directories are migrated into the declarative contexts volume.
│   │   │   │   ├── def hook_request_manifest(workspace_id, **kwargs) # Returns the memoized ctx domain manifest dictionary from manifest_ledger.
│   │   │   │   ├── def hook_request_manifest_chunks(target_key, workspace_id, **kwargs) # Resolves the ordered chunk URIs for a manifest entry.
│   │   │   │   ├── def hook_resolve_payload_chunks(uri, workspace_id, manifest, **kwargs) # Resolves constituent chunk URIs for a logical ctx:// context or diff URI.
│   │   │   │   ├── def hook_save_manifest(manifest_data, is_full_compile, workspace_id, **kwargs) # Persists compiled context entries into manifest_ledger and re-invalidates manifest caches post-commit.
│   │   │   │   ├── def api_manifest_version(ctx) # Returns the latest modification timestamp across the context manifest ledger.
│   │   │   │   ├── def hook_gather_manifest_signatures(workspace_id, since_ts, **kwargs) # Yields lightweight context artifact signatures for the ctx domain.
│   │   │   │   ├── class ManifestEntryQuery(TypedDict) # Query schema naming a single context manifest URI to fetch.
│   │   │   │   ├── class ManifestEntryResponse(TypedDict) # Response schema returning a single manifest_ledger entry.
│   │   │   │   └── def api_gather_manifest_entry(ctx) # Surgically fetches a single manifest entry by context path.
│   │   │   ├── gather.js           # [Context Batch & Workflow UI]
│   │   │   │   ├── function executeCompile(onProgress = null, forceFull = f...) # Triggers full or incremental workspace context compilation and polls progress.
│   │   │   │   ├── function getFlattenedBuckets(repoDirOrConfigs = null, include...) # Flattens configured repositories and sub-buckets into an ordered list of bucket descriptors.
│   │   │   │   ├── function packSelectionPayload(items) # Compiles selected files and folders into a Quickpack and pre-warms its share cache.
│   │   │   │   └── class InSetuExtGather # Categorized Gather context deck UI component with fuzzy search and Quickpack management.
│   │   │   └── rag_proximity.py    # Extract Hebbian affinity graph helpers and blast-radius CODE_INDEX subtree slicer into rag_proximity.py per proximity_filters_and_domain_jum...
│   │   │       ├── def record_affinity_interaction(ctx, file_list, interaction_type, weight) # Updates co-occurrence weights in the persistent SQLite affinity_edges table.
│   │   │       ├── def get_affinity_neighbors(ctx, seed_files, top_k) # Calculates time-decayed Hebbian affinity scores clamped to topology_ledger to return top correlated peer files.
│   │   │       ├── def prune_stale_affinity_edges(ctx, grace_period_seconds) # Garbage-collects affinity_edges rows older than grace_period_seconds whose endpoints are no longer tracked in topology_ledger.
│   │   │       └── def slice_code_index_for_blast_radius(ctx, seed_files, max_chars) # Slices a repository's CODE_INDEX.md to retain top-level landmarks and the directory subtrees matching seed_files.
│   │   ├── languages/              # Pluggable Tree-sitter and AST language provider contracts.
│   │   │   ├── __init__.py         # Create central Tier 2 language analysis package unifying AST symbol indexing, source slice extraction, and interface slicing.
│   │   │   │   ├── def get_language_provider(filepath) # Resolves the appropriate language provider for a file path based on its extension.
│   │   │   │   ├── def extract_file_symbols(filepath, content) # Stage 2 Shallow Static AST Extractor: Extracts public top-level symbols for .py, .rs, and .js/.ts/.mjs/.tsx files.
│   │   │   │   ├── def extract_symbol_source_slice(filepath, content, symbol_query) # Locates a top-level class, method (Class.method or method), or function in `content` and returns its exact source slice (including leading d...
│   │   │   │   ├── def describe_source_file(rel_path, content) # Derives a one-sentence file description for CODE_INDEX.md from docstrings, frontmatter, headers, or metadata.
│   │   │   │   ├── def describe_directory(rel_dir, child_files, read_fn) # Derives a one-sentence directory description from its README.md, __init__.py, package.json, or child script headers.
│   │   │   │   └── def format_interleaved_file_diff(filepath, base_content, current_content, fallback_padding, ...) # Compiles a single-stream, deterministic interleaved diff between `base_content` and `current_content`: - Option 2 (AST-Aware Primary): For s...
│   │   │   ├── base.py             # Define BaseLanguageProvider contract and shared brace-balancing, docstring normalization, and body hashing utilities.
│   │   │   │   ├── def first_sentence(text) # Normalizes the first sentence of a docstring or JSDoc comment for single-line index display, stripping reST/module headers.
│   │   │   │   ├── def compute_normalized_text_body_hash(source_slice) # Computes an 8-char SHA-256 hash of a brace-delimited symbol body with comments and whitespace normalized.
│   │   │   │   ├── def find_brace_balanced_end(lines, start_idx) # Scans forward from start_idx (0-based) to find the closing line of a brace-delimited block, tracking regexes and template literals.
│   │   │   │   └── class BaseLanguageProvider(ABC) # Abstract interface contract for language-specific AST inspection and interface slicing.
│   │   │   ├── javascript.py       # Consolidate JS/TS symbol extraction, JSDoc parsing, file description, and interface slicing in JavaScriptLanguageProvider without importing...
│   │   │   │   ├── def extract_preceding_jsdoc(lines, target_line_idx) # Returns (first_sentence_jsdoc, earliest_start_line_1based) preceding target_line_idx (0-based).
│   │   │   │   └── class JavaScriptLanguageProvider(BaseLanguageProvider) # Resilient JS/TS language provider with Tree-Sitter and regex-based AST extraction and brace balancing.
│   │   │   ├── markdown.py         # Pure general-purpose Markdown language provider for heading AST spans, links, citations, and interface slicing.
│   │   │   │   └── class MarkdownLanguageProvider(BaseLanguageProvider) # General-purpose language provider for Markdown (.md, .markdown) files: - Extracts hierarchical heading trees (# ..
│   │   │   ├── python.py           # Consolidate Python AST symbol extraction, normalized body hashing, file description, and interface slicing in PythonLanguageProvider.
│   │   │   │   ├── def format_py_signature(node) # Formats a canonical, coordinate-free Python class or function signature.
│   │   │   │   ├── def compute_normalized_py_body_hash(node, fallback_slice) # Computes an 8-char SHA-256 hash of a Python AST node's body (excluding leading docstring).
│   │   │   │   └── class PythonLanguageProvider(BaseLanguageProvider) # Python AST language provider with zero external package dependencies.
│   │   │   └── rust.py             # Create RustLanguageProvider in insetu/core/languages/rust.py with body_hash, snippet, and symbol slice extraction.
│   │   │       └── class RustLanguageProvider(BaseLanguageProvider) # Rust language provider for AST inspection and interface extraction.
│   │   ├── llm/                    # Universal multi-provider LLM gateway and streaming proxy.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_llm.py       # Multi-model inference orchestrator (Anthropic, Gemini, Claude CLI).
│   │   │   │   ├── class ChatMessage(TypedDict) # Schema representing a single role/content chat turn message.
│   │   │   │   ├── class ChatCompletionPayload(TypedDict) # Request schema for semantic-tier LLM completion or streaming inference.
│   │   │   │   ├── class LlmDecidePayload(TypedDict) # Request schema for fast decision-tier classification calls.
│   │   │   │   ├── def get_compute_pool_and_profiles(ctx) # Returns the normalized compute endpoint pool, configuration profiles, and active_profile_id.
│   │   │   │   ├── class LlmResolveTargetPayload(TypedDict) # Query schema naming the cognitive tier and profile to resolve.
│   │   │   │   ├── def api_llm_resolve_target(ctx) # Resolves execution target metadata for a cognitive tier without exposing plaintext API keys.
│   │   │   │   ├── def validate_output_schema(raw_text, output_schema) # Universal Output Schema Bouncer: Validates LLM text against named built-in contracts ('yomama_patch', 'intent_classification', 'json') or a...
│   │   │   │   ├── def api_llm_complete(ctx) # Executes an LLM inference turn with tier routing, output_schema retries, and telemetry recording.
│   │   │   │   ├── class AudioTranscribePayload(TypedDict) # Request schema for push-to-talk audio transcription payloads.
│   │   │   │   ├── def api_llm_transcribe(ctx) # Transcribes uploaded audio snippets through the configured speech endpoint.
│   │   │   │   ├── def api_chat_completions(ctx) # Streams Server-Sent Events (SSE) inference chunks for interactive chat completions.
│   │   │   │   ├── class LlmProfilesSavePayload(TypedDict) # Request schema for updating compute endpoints, profiles, or active_profile_id.
│   │   │   │   ├── def api_llm_profiles(ctx) # Lists or updates the Compute Endpoint Pool, Cognitive Configuration Profiles, and active_profile_id.
│   │   │   │   ├── def api_llm_decide(ctx) # Executes a fast binary or multi-class decision evaluation using the 'decision' tier with fallback to 'fast'.
│   │   │   │   ├── def api_llm_catalog(ctx) # Returns or refreshes the cached multi-provider model and token pricing catalog.
│   │   │   │   └── def api_public_llm_catalog() # Free, unauthenticated, CORS-enabled public JSON API endpoint serving the normalized multi-provider model & token pricing catalog (merging Op...
│   │   │   ├── llm_catalog.py      # Multi-source model and token pricing catalog harvester and cognitive tier classifier extracted from engine_llm.py (God-Objects Wave 3.5).
│   │   │   │   ├── def infer_model_cognitive_tier(model_id, input_cost_per_1m, category) # Heuristically classifies a catalog model ID into a semantic cognitive tier (decision, fast, standard, thinking, frontier).
│   │   │   │   ├── def harvest_external_model_catalog(ctx, endpoints) # Harvests and normalizes model availability, context limits, and per-1M token pricing from: 1.
│   │   │   │   └── def export_public_llm_catalog_file(out_path, workspace_id) # Headless static exporter for CI / GitHub Actions / Cloudflare Pages: Harvests the live multi-provider model & token pricing catalog and writ...
│   │   │   ├── llm_drivers.py      # Physical admission control semaphores and streaming/decision protocol drivers extracted from engine_llm.py (God-Objects Wave 3.5).
│   │   │   │   ├── def get_provider_semaphore(provider, max_parallel, endpoint_id) # Physical Admission Control Semaphore per Compute Endpoint (or fallback provider): - claude_cli: hard-clamped to 1 (local pseudo-TTY binary).
│   │   │   │   ├── def stream_anthropic(api_key, model, messages, system_prompt) # Streams SSE inference chunks from the Anthropic Messages API with ephemeral prompt caching.
│   │   │   │   ├── def stream_gemini(api_key, model, messages, system_prompt) # Streams SSE inference chunks from the Google Gemini API with preview model fallback and Python 3.10-safe error formatting.
│   │   │   │   ├── def stream_openai_compatible(base_url, api_key, model, messages, ...) # Streams inference from any OpenAI-compatible /v1/chat/completions endpoint (Ollama, LM Studio, vLLM, llama.cpp, OpenAI).
│   │   │   │   ├── def stream_claude_cli(model, messages, system_prompt) # Hardened subprocess adapter for the Claude CLI binary: - Pipes prompt payload over stdin to avoid OS ARG_MAX limits on large Gather context...
│   │   │   │   ├── def run_decisions_inference(base_url, api_key, model, messages, ...) # Executes a TypeSafe Jev / System-One decision call against POST /api/alpha/decisions (supported natively by OpenRouter and TypeSafe endpoint...
│   │   │   │   └── def run_single_inference(provider, api_key, model, messages, ...) # Acquires the endpoint admission semaphore and aggregates a complete inference response from the active driver.
│   │   │   └── llm_telemetry.py    # Extract LLM call telemetry schema, recording, and per-tier cost aggregation into llm_telemetry.py per Follow-up Brief §2.6 and Sprint A2.1.
│   │   │       ├── def get_cached_catalog_rates(workspace_id) # Reads and caches (input_cost_per_1m, output_cost_per_1m) rates by model ID from model_catalog.json.
│   │   │       ├── def record_llm_call_telemetry(ctx) # Scrubs outbound secrets and inserts a bounded row into llm_telemetry.
│   │   │       └── def compute_session_tier_telemetry(ctx, since_ts) # Aggregates per-tier token usage and estimated USD cost from llm_telemetry joined with model_catalog.json.
│   │   ├── mcp/                    # Model Context Protocol (MCP 2025-03-26) server substrate.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   └── engine_mcp.py       # JSON-RPC 2.0 MCP gateway exposing capabilities as tools, contexts as resources, and prompt templates.
│   │   │       ├── class McpJsonRpcPayload(TypedDict) # Request schema for MCP JSON-RPC 2.0 method calls and notifications.
│   │   │       ├── def handle_mcp_jsonrpc(ctx, rpc_payload) # Evaluates one MCP 2025-03-26 JSON-RPC 2.0 request or notification; tools/call runs with origin 'mcp', and capabilities marked mcp_expose=False are neither listed nor callable.
│   │   │       ├── def api_mcp_rpc(ctx) # Executes an MCP 2025-03-26 JSON-RPC 2.0 request over HTTP or in-process ctx.call('mcp.rpc').
│   │   │       └── def api_mcp_http_root(workspace_id) # Root HTTP POST /api/<workspace_id>/mcp entrypoint for MCP clients.
│   │   ├── offline/                # Local offline data provider and sync reconciliation engine.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_offline.py   # Offline data provider and sync reconciliation handlers.
│   │   │   │   ├── class OfflineRepoTogglePayload(TypedDict) # Request schema for toggling per-repository offline caching eligibility.
│   │   │   │   └── def api_toggle_repo_offline(ctx) # Toggles offline IndexedDB caching participation for a mounted repository.
│   │   │   └── offline_ui.js       # Client offline status indicator and outbox telemetry UI.
│   │   │       ├── class InSetuCoreOfflineLedger # Repository offline switchboard, cache warming, and outbox queue ledger UI component.
│   │   │       └── class InSetuCoreOfflineLog # Live offline synchronization and Service Worker telemetry log viewer.
│   │   ├── prompts/                # Management of global prompt templates and macro inclusions.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_prompts.py   # Prompt discovery and resolution.
│   │   │   │   ├── class PromptsVFSDriver(TemplateOverlayVFSDriver) # VFS Driver routing ctx://prompts/.templates/user via ws://default and .templates/<mod> to active module prompt directories.
│   │   │   │   ├── def inject_prompts_config(cfg, workspace_id, **kwargs) # Injects virtual prompt directories into workspace configuration on load.
│   │   │   │   ├── def migrate_legacy_prompt_macros_on_boot(workspace_id, **kwargs) # One-time boot migration upgrading legacy scheme-less {{include_prompt: ...}} tags in prompt files to canonical ctx://prompts/ URIs.
│   │   │   │   ├── def provide_available_prompts(workspace_id, **kwargs) # Supplies global (ctx://prompts), virtual module templates (ctx://prompts/.templates), repo-scoped (<repo>/.insetu-data/prompts), and peer-mo...
│   │   │   │   ├── class PromptsListResponse(TypedDict) # Response schema listing available workspace and virtual template prompt URIs.
│   │   │   │   ├── class PromptResolveQuery(TypedDict) # Request schema for GET/POST prompt macro expansion and variable interpolation.
│   │   │   │   ├── def read_prompt_with_cascade(ctx, uri_str, report) # Single Source of Truth prompt reader evaluating the 3-Tier Override Cascade: 1.
│   │   │   │   ├── class PromptNotFound(ValueError) # A routine step names a prompt that does not resolve.
│   │   │   │   ├── def require_prompt_text(text, prompt_uri, routine_id) # Returns a resolved prompt, or raises PromptNotFound naming the routine and the URI, so a missing prompt stops the run instead of sending an...
│   │   │   │   ├── def resolve_prompt_text(ctx, target_uri, raw_content, repo, ...) # Expands `{{include_prompt: ...}}` macros and interpolates `{{ var | sys.* | default }}` against the target repository's `sys.*` landmarks an...
│   │   │   │   ├── def api_prompts_list(ctx) # Provides a list of available prompts (including virtual .templates) for the UI.
│   │   │   │   └── def api_prompts_resolve(ctx) # Fetches a canonical prompt URI or live POST buffer and recursively resolves {{include_prompt: ...}} and optional {{include_prompt?: ...}} macros.
│   │   │   └── prompts.js          # Core Prompt Library UI, virtual module .templates browser, and macro embedding.
│   │   │       ├── class InSetuExtPrompts # Prompt Library browser and template fork/preview UI component.
│   │   │       └── function isPromptPath(filepath) # Returns true when a URI belongs to ctx://prompts/ or .insetu-data/prompts/.
│   │   ├── protected_changes.py    # Pending protected changes (S8): a change to a protected file waits here until a person confirms or discards it.
│   │   │   ├── def install()       # Makes this module the kernel's policy for protected writes.
│   │   │   ├── def pending_dir()   # <control dir>/pending_changes/, one JSON record per pending change.
│   │   │   ├── def audit_log_path() # <control dir>/audit/protected_changes.jsonl, the append-only audit log only this module writes.
│   │   │   ├── def last_good_dir() # <control dir>/recovery/last_good/: the most recent version of each recovery file that passed its smoke test.
│   │   │   ├── def recovery_kind(filepath) # 'cli', 'lifeboat' or 'credentials' for a protected recovery file, else None (other protected paths).
│   │   │   ├── def smoke_test(kind, workspace_id, filepath, content, ...) # Checks a version of a recovery file in a subprocess, in an empty temporary directory.
│   │   │   ├── def content_hash(content) # The hash a person confirms: SHA-256 of the UTF-8 text, or DELETE for a delete.
│   │   │   ├── def count_pending() # Number of pending protected changes, read from disk without waiting for queued writes.
│   │   │   ├── def handle_protected_write(request) # The kernel's protected-write handler: stage the change, or refuse it.
│   │   │   ├── def save_from_editor(workspace_id, filepath, content, is_absolute) # A person's own save from the Files editor: written at once, behind the smoke test and the last-good copy.
│   │   │   ├── def propose(workspace_id, filepath, content, is_absolute, ...) # Stages a change to a protected file (content None deletes it) and returns the answer the writer gets.
│   │   │   ├── def list_pending()  # Every pending change, oldest first, with the file as it is now and whether it changed since the proposal.
│   │   │   ├── def confirm(change_id, result_hash) # Writes a pending change, if the person saw exactly this result and the file is still as it was proposed against.
│   │   │   └── def discard(change_id) # Drops a pending change without writing it.
│   │   ├── remote/                 # Remote access: Tailscale identity verification, Serve binding, and trusted hostnames.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   └── engine_remote.py    # Verifies remote devices with tailscale whois, binds Tailscale Serve, and registers trusted hosts.
│   │   │       ├── def tailscale_whois(ip) # Resolves a tailnet address to {'login', 'tags', 'node'} via `tailscale whois --json`.
│   │   │       ├── def tailscale_owner_login() # Returns the login that owns this machine's tailscaled (None for tagged machines or when unavailable).
│   │   │       ├── def reset_identity_caches() # Test harness contract: clears WHOIS and owner caches.
│   │   │       ├── def tailscale_identity_handshake(request, peer, client_ip, config, **kwargs) # Route B provider: authenticates a remote device by its verified Tailscale login.
│   │   │       ├── def migrate_legacy_tailscale_settings() # Copies daemon settings saved by the retired 'tailscale' extension into the 'remote' block once.
│   │   │       ├── def register_configured_hosts() # Registers operator-configured hostnames (comma-separated 'allowed_hosts' setting) with the Host gate.
│   │   │       ├── def init_remote_access(**kwargs) # Boot hook: migrates legacy Tailscale settings and registers configured hostnames.
│   │   │       ├── def set_tailscale_https_serve(port, enable) # Binds or releases 'tailscale serve --https=<port>' for a loopback dev server.
│   │   │       ├── def auto_bind_on_workspace_boot(ctx, workspace_id, **kwargs) # Tenant Boot Hook: Evaluates auto-bind preference off-thread when the workspace mounts.
│   │   │       ├── class TailscaleBindPayload(TypedDict) # Request schema for configuring Tailscale HTTPS serve bindings.
│   │   │       └── def api_bind_tailscale(ctx) # Manually triggers 'tailscale serve' to expose the local inSetu port to the Tailnet.
│   │   ├── sdk/                    # Developer SDK namespace.
│   │   │   └── __init__.py         # Module initialization.
│   │   │       ├── def reset_kernel_state(**kwargs) # Resets Akasa kernel state, closes cached SQLite pools, and resets extension volume mount tracking so subsequent get_context() mounts cleanly.
│   │   │       ├── def mount_declared_volume(workspace_id, scheme, volume) # Mounts volume via its owning InSetuExtension if declared, preserving TemplateOverlayVFSDriver.
│   │   │       ├── class TemplateOverlayVFSDriver(DefaultVFSDriver) # Unified Tier 2 Template Overlay VFS Driver for ctx://prompts and ctx://routines: - Routes ctx://<vol>/.templates/user/...
│   │   │       ├── class InSetuContext(_BaseExtensionContext) # Tier 2 Developer OS Extension Context with dual-root Manifest, RAG compilation, and Frontmatter helpers.
│   │   │       ├── def get_mountable_data_domains() # Returns options for all registered extensions that own a 'data'-tier VFS volume, plus the '*' wildcard.
│   │   │       ├── def resolve_external_dependency_spec(dep_str) # Normalizes an external dependency declaration into (import_specifier, pypi_package_name).
│   │   │       ├── class InSetuExtension(AkasaExtension) # Tier 2 Developer OS Blueprint wrapper supporting declarative VFS volume mounts, dependency contracts, route risk tiers, and InSetuContext injection.
│   │   │       ├── def get_dynamic_routine_banned_capabilities() # Returns capability IDs dynamically banned from routine invocation via risk='ui_only' or 'exec'.
│   │   │       └── def get_dynamic_read_only_capabilities() # Returns capability IDs dynamically marked safe for read-only (/ask) mode via risk='read'.
│   │   ├── step_timer.py           # A small timer that records how long each named step of a request took, so a slow response can report which part was slow.
│   │   │   └── class StepTimer     # Records how long each step took, in milliseconds, measured from the previous mark (or from creation).
│   │   ├── system/                 # System lifecycle, settings, and recovery controllers.
│   │   │   ├── api.js              # Centralized API fetch wrapper and token injector.
│   │   │   │   ├── class SSEPipeline # [stale?] Phase E: Network Hysteresis, Outbox Reconciliation & SSE Pipeline (also carries the pending protected change count).
│   │   │   │   └── function attemptReconciliation() # [comment required]
│   │   │   ├── blueprint.py        # Shared `system_bp` InSetuExtension blueprint and `SYSTEM_SETTINGS_SCHEMA` for the `insetu.core.system` package.
│   │   │   ├── cli_commands.py     # Modular CLI command implementations (init, daemon service, GUI, shortcuts).
│   │   │   │   ├── def handle_init(cwd, args) # Interactive and headless onboarding wizard for initializing an inSetu workspace.
│   │   │   │   ├── def handle_service(action, cwd) # Manages the background systemd daemon for inSetu.
│   │   │   │   ├── def scaffold_extension(ext_name, bundled) # [stale?] Scaffolds a new extension from the default templates.
│   │   │   │   ├── def check_daemon_alive(port) # Pings localhost to check if an inSetu daemon is already running.
│   │   │   │   ├── def launch_gui(cwd) # Launches pywebview desktop shell, attaching to an active daemon or starting an embedded server.
│   │   │   │   ├── def create_desktop_shortcut(cwd) # Generates a native OS application shortcut for inSetu GUI.
│   │   │   │   ├── def rotate_session_token_cli(cwd) # `insetu auth rotate`: replaces the durable session token in <cwd>/.insetu/auth/ and prints the new one once.
│   │   │   │   └── def handle_mcp_stdio(cwd, args) # MCP 2025-03-26 Stdio Bridge: Proxies JSON-RPC messages over stdin/stdout to the running HTTP daemon on 127.0.0.1:<port>, or executes headles...
│   │   │   ├── components/         # Reusable Lit Web Components for the OS.
│   │   │   │   ├── ui_editor.js    # CodeMirror 6 markdown and frontmatter editor wrappers.
│   │   │   │   │   ├── function isMarkdownLinksEnabled() # [comment required]
│   │   │   │   │   ├── function setEditorLanguageManifest(languagesObj) # Replaces the language lookup tables with a manifest's languages (used by tests and hosts that preload it).
│   │   │   │   │   ├── function resolveEditorMode(filename) # [comment required]
│   │   │   │   │   ├── function getActiveEditorPath() # [comment required]
│   │   │   │   │   ├── function getEditorContent() # [comment required]
│   │   │   │   │   ├── function setEditorContent(text) # [comment required]
│   │   │   │   │   ├── function insertTextAtCursor(textToInsert) # [comment required]
│   │   │   │   │   ├── function insertLinkToEditor(path, name) # [comment required]
│   │   │   │   │   ├── function resolveEditorLinkTarget(rawHref, currentFileUri = null) # [comment required]
│   │   │   │   │   ├── function openEditorLinkTarget(rawHref, currentFileUri = null) # [comment required]
│   │   │   │   │   ├── function vendorizeEditorLanguage(lang) # [comment required]
│   │   │   │   │   ├── function canUseMultiWindowPopout() # [comment required]
│   │   │   │   │   ├── function focusActivePopout(filepath) # [comment required]
│   │   │   │   │   ├── function clearActivePopout(filepath, workspaceId = null) # [comment required]
│   │   │   │   │   ├── function popoutProjection(filepath) # [comment required]
│   │   │   │   │   ├── function dockInProjection(filepath = null) # [comment required]
│   │   │   │   │   ├── class InSetuProjectionWindowControls # [comment required]
│   │   │   │   │   └── class InSetuMarkdownEditor # [comment required]
│   │   │   │   ├── ui_file_tree.js # Recursive file tree browser with fuzzy search.
│   │   │   │   │   ├── function buildUriFileTree(uris, rootScope = '') # [comment required]
│   │   │   │   │   └── class InSetuFileTree # [comment required]
│   │   │   │   ├── ui_filter_pills.js # Repository and tag filtering arrays.
│   │   │   │   │   └── class InSetuRepoFilter # [comment required]
│   │   │   │   ├── ui_primitives.js # Base primitives like job trackers and loading spinners.
│   │   │   │   │   ├── class InSetuJobTracker # [comment required]
│   │   │   │   │   ├── class InSetuRebootOverlay # [comment required]
│   │   │   │   │   ├── class InSetConfigBanner # [comment required]
│   │   │   │   │   ├── class InSetuQuarantinedSlotPlaceholder # [comment required]
│   │   │   │   │   ├── class InSetuProjectionWindowControls # [comment required]
│   │   │   │   │   └── class InSetuHostDirPicker # [comment required]
│   │   │   │   ├── ui_protected_changes.js # S8: the review window for pending changes to protected files (the CLI, the lifeboat, the credential store), one change at a time as a diff a...
│   │   │   │   │   ├── function hashReviewedContent(change) # S8: the review window for changes to protected files (the CLI, the lifeboat, the credential store).
│   │   │   │   │   ├── class InSetuProtectedChangesProjection # Shows pending protected changes one at a time as diffs, with Previous and Next, Confirm and Discard.
│   │   │   │   │   └── function openProtectedChangesReview() # Opens the review window beside the current column.
│   │   │   │   ├── ui_schema_repeater.js # Declarative schema-driven repeater component and field condition/default helpers.
│   │   │   │   │   ├── function cascadeRepeaterIdRename(fullSchema = [], formData = {},...) # Propagates a renamed repeater item ID across dependent options_from and target_binding fields in formData.
│   │   │   │   │   └── class InSetuSchemaRepeater # Declarative repeater widget for array-of-object settings schemas with bounds, slug sync, and conditional sub-fields.
│   │   │   │   └── ui_system_settings.js # The 3-Tier Configuration Editor and Settings Hub.
│   │   │   │       └── class InSetuSystemSettings # [comment required]
│   │   │   ├── engine_system.py    # System topology, deltas, and lifecycle REST endpoints.
│   │   │   │   ├── def vault_repeater_secrets_for_schema(ext_name, workspace_id) # [stale?] Universal Repeater Secret Vaulting: Scans any registered settings schema for `type: 'repeater'` fields that contain `secure: True` subfields...
│   │   │   │   ├── def core_system_settings_updated(workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def hydrate_and_migrate_cascade_settings(cfg, workspace_id, **kwargs) # Transparent 3-Tier Cascade Bridge: 1.
│   │   │   │   ├── def provide_vfs_ignores(workspace_id, **kwargs) # Host application declaration of directories the VFS should never traverse natively.
│   │   │   │   ├── def api_system_openapi() # [stale?] Phase 3 Tool Calling: Generates a real-time OpenAPI 3.0 specification from mounted SDK routes.
│   │   │   │   ├── class DeltasQueryPayload(TypedDict) # [comment required]
│   │   │   │   ├── class SystemDeltasResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_system_deltas(ctx) # [comment required]
│   │   │   │   ├── class PipelineSubmitPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_system_pipeline_submit(ctx) # [comment required]
│   │   │   │   ├── def handle_config_pre_save(workspace_id, filepath, content, data, **kwargs) # [comment required]
│   │   │   │   ├── class ProtectedChangeConfirmPayload(TypedDict) # change_id and the result_hash of the content the person reviewed.
│   │   │   │   ├── class ProtectedChangeDiscardPayload(TypedDict) # change_id of the change to drop.
│   │   │   │   ├── def api_protected_pending(ctx) # Lists protected-file changes waiting for a person's confirmation (S8).
│   │   │   │   ├── def api_protected_confirm(ctx) # Human-only: writes a pending protected change the person reviewed (S8).
│   │   │   │   ├── def api_protected_discard(ctx) # Human-only: drops a pending protected change (S8).
│   │   │   │   ├── class DirectivesQueryPayload(TypedDict) # Request schema for querying four-tier directives for a target repository.
│   │   │   │   ├── class DirectivesAcceptPayload(TypedDict) # Request schema for accepting shared repository directives with content digest.
│   │   │   │   ├── class DirectivesRevokePayload(TypedDict) # Request schema for revoking acceptance of shared repository directives.
│   │   │   │   ├── class DirectivesSavePayload(TypedDict) # Request schema for human editor saving of a specific directive tier.
│   │   │   │   ├── def api_directives_get(ctx) # Returns the four directive tiers for a repository (or the first mounted repository when omitted).
│   │   │   │   ├── def api_directives_save(ctx) # Saves a directive tier document from the Settings Hub with EDITOR_SOURCE so UI saves write directly.
│   │   │   │   ├── def api_directives_accept(ctx) # Records a person's acceptance of `vfs://<repo>/.insetu-data/settings/agent.md` at the reviewed digest.
│   │   │   │   ├── def api_directives_revoke(ctx) # Revokes a person's acceptance of a repository's shared directives.
│   │   │   │   ├── def api_system_reboot(ctx) # Clean in-place process replacement to restart the OS daemon.
│   │   │   │   ├── class SystemConfigPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_system_config(ctx) # [comment required]
│   │   │   │   ├── class TopologyResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_system_topology(ctx) # [comment required]
│   │   │   │   ├── class ManifestResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_system_manifest(ctx) # [comment required]
│   │   │   │   ├── class WorkspaceCreatePayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_create_workspace(ctx) # [comment required]
│   │   │   │   ├── class WorkspaceDeletePayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_delete_workspace(ctx) # [comment required]
│   │   │   │   ├── class JobStatusResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_job_status(ctx, job_id) # [comment required]
│   │   │   │   ├── class WorkspacesResponse(TypedDict) # [comment required]
│   │   │   │   ├── class WorkspacesSwitchPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_workspaces(ctx) # [comment required]
│   │   │   │   ├── def api_system_config_test_bucketing(ctx) # [comment required]
│   │   │   │   ├── class ListLocalResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_list_local_host_dirs(ctx) # Stateless directory explorer that reads absolute host paths for workspace mounts.
│   │   │   │   ├── def api_system_memory(ctx) # [comment required]
│   │   │   │   ├── def get_system_config(workspace_id) # [comment required]
│   │   │   │   └── def save_system_config(workspace_id, payload) # [comment required]
│   │   │   ├── ext_manager.py      # Workspace extension (.insetu/extensions/) discovery, symlink/size validation, SHA-256 fingerprinting, and human approval helpers.
│   │   │   │   ├── def get_workspace_extension_reserved_names() # Names a workspace extension cannot take: every bundled extension and core module, plus config, sdk, languages.
│   │   │   │   ├── def get_workspace_extensions_root() # The one folder workspace extensions load from: .insetu/extensions/ under the default workspace root.
│   │   │   │   ├── def snapshot_workspace_extension(ext_dir, with_contents) # Hashes every file of one workspace extension.
│   │   │   │   ├── def current_workspace_extension_fingerprint(ext_dir) # The extension's fingerprint now, rehashed only when a file's size or mtime changed (for per-request checks).
│   │   │   │   ├── def get_workspace_extension_approvals() # Approved workspace extensions from the attestation store: {name: {"fingerprint", "files", "approved_at"}}.
│   │   │   │   ├── def approve_workspace_extension(name, snapshot) # Records a person's approval of one extension's exact files in the attestation store; refused to machine origins.
│   │   │   │   ├── def revoke_workspace_extension(name) # Removes a person's approval for one extension; it stops loading at the next restart.
│   │   │   │   ├── def describe_workspace_extension(name, snapshot, approval, reserved) # Status of one workspace extension for the review screen: approved, changed, unapproved, or invalid.
│   │   │   │   ├── def scan_workspace_extensions(reserved_names, with_contents) # Every folder in .insetu/extensions/ with its status; with_contents adds the "snapshot" for approved ones.
│   │   │   │   ├── class ExtensionInstallDepsPayload(TypedDict) # Request payload naming the extension whose declared Python dependencies should be installed.
│   │   │   │   ├── class WorkspaceExtensionApprovePayload(TypedDict) # Request payload naming a workspace extension and the SHA-256 fingerprint the person reviewed.
│   │   │   │   ├── class WorkspaceExtensionRevokePayload(TypedDict) # Request payload naming a workspace extension whose approval should be revoked.
│   │   │   │   ├── def api_system_install_extension_deps(ctx) # Dispatches a background job to install whitelisted PyPI dependencies for an extension.
│   │   │   │   ├── def api_workspace_extensions(ctx) # [stale?] Lists .insetu/extensions/ folders with approval status, changed files and whether each is running.
│   │   │   │   ├── def api_workspace_extension_approve(ctx) # [stale?] Approves the files a person reviewed: the fingerprint they saw must still match the folder, or nothing is approved.
│   │   │   │   └── def api_workspace_extension_revoke(ctx) # [stale?] Human-only: removes a workspace extension's approval; it stops loading at the next restart.
│   │   │   ├── insetu_element.js   # Base Web Component class providing tenant workspace hydration, scoped API client access, and ecosystem filtering.
│   │   │   │   └── class InSetuElement # Base Web Component class for inSetu core views and extensions with tenant-scoped API, store, and ecosystem bindings.
│   │   │   ├── insetu_sdk.js       # The InSetuElement base class and Zustand store factory.
│   │   │   │   ├── function extractTemplateVariables(text, options = {}) # [comment required]
│   │   │   │   ├── function interpolateTemplateVariables(text, values = {}, options = {}) # [comment required]
│   │   │   │   ├── function cleanCodeArtifacts(text) # [comment required]
│   │   │   │   ├── function createExtensionStore(name, initialState, persistenceS...) # [comment required]
│   │   │   │   └── function createIsolatedSlice(store, sliceKey) # [comment required]
│   │   │   ├── legacy.py           # Self-healing database recovery and legacy sandbox migration.
│   │   │   │   ├── def move_tree_contents(src_dir, dst_dir) # Recursively merges files from src_dir into dst_dir and removes empty source directories.
│   │   │   │   ├── def split_system_json(**kwargs) # Delegates legacy system.json splitting (into host.json and workspaces.json) to the Akasa kernel.
│   │   │   │   └── def migrate_physical_sandboxes(**kwargs) # [stale?] Domain-agnostic kernel migration: consolidates SQLite databases into .insetu/cache/db/ and heals .gitignore.
│   │   │   ├── manifest_sync.js    # Decentralized VFS/CTX manifest delta synchronization and background IndexedDB cache warming queue.
│   │   │   │   ├── function importModuleWithRetry(url, importer = (u) => import(u)...) # Imports a frontend ES module with bounded backoff retries on transient network fetch errors.
│   │   │   │   ├── function classifyBootModuleFailure(url, err, fetchImpl = fetch) # Distinguishes transient network/offline drops from SyntaxError or 404 faults via a HEAD probe.
│   │   │   │   └── function checkManifestVersion() # --- DECENTRALIZED MANIFEST SYNC & KERNEL HEARTBEAT ---
│   │   │   ├── memory_profiler.py  # Process memory telemetry, garbage collection object profiling, and tracemalloc snapshot helpers.
│   │   │   │   └── def collect_process_memory_telemetry(action) # Inspects backend RAM usage, internal caches, top Python object types, and optionally triggers GC/malloc_trim or tracemalloc.
│   │   │   ├── openapi.py          # OpenAPI 3.0 specification builder for mounted Akasa and inSetu extension routes.
│   │   │   │   └── def build_system_openapi_spec(app) # Generates a real-time OpenAPI 3.0 specification dictionary from mounted SDK routes on `app`.
│   │   │   ├── security_io.py      # Child process environment sanitization, outbound HTTP SSRF/byte-cap guard, command attestations, and repeater secret vaulting.
│   │   │   │   ├── def get_approved_commands(workspace_id) # [stale?] Returns the approved command signatures for workspace_id from host.json (P5).
│   │   │   │   ├── def approve_command(workspace_id, kind, repo, command) # [stale?] Records a person's approval of one exact command of a kind ('test', 'preview') for a repository.
│   │   │   │   ├── def is_command_approved(workspace_id, kind, repo, command) # True only when the attestation store holds a person's approval of this exact command of this kind for this repository.
│   │   │   │   ├── def is_test_command_approved(workspace_id, repo, command, default_command) # True for the repository's default test command, or a custom command a person approved; never approves anything itself (P5).
│   │   │   │   ├── def is_secret_env_name(name) # True for environment variable names that look like credentials (API keys, tokens, passwords, SSH_AUTH_SOCK).
│   │   │   │   ├── def get_child_env_passthrough(workspace_id, repo) # The credential-like variable names a person allowed through to this repository's processes.
│   │   │   │   ├── def child_env(purpose, workspace_id, repo, extra) # Builds the environment for a child process.
│   │   │   │   ├── class FetchRefused(Exception) # A URL was refused before or during the fetch: wrong scheme, a non-public address, or a body over the cap.
│   │   │   │   ├── class FetchHTTPError(Exception) # The server answered with an HTTP error status.
│   │   │   │   ├── class FetchResult # A completed fetch: final URL after redirects, status, headers and the decoded (decompressed) body.
│   │   │   │   └── def fetch_url(url) # The one way insetu makes an outbound HTTP request (S4).
│   │   │   ├── store.js            # [Zustand Unified Data Flow (UDF) Store]
│   │   │   ├── system.js           # System settings UI, SSE pipeline listeners, and recovery triggers.
│   │   │   │   ├── function bootServiceWorker() # [comment required]
│   │   │   │   ├── function autoWireSettingsSchemas() # [comment required]
│   │   │   │   ├── function bootExtensions() # [comment required]
│   │   │   │   ├── function updateBootProgress(statusMsg) # [comment required]
│   │   │   │   ├── function executeSecurityHandshake() # [comment required]
│   │   │   │   ├── function executeBootSequence(options = {}) # [comment required]
│   │   │   │   ├── function executeWorkspaceSwap(key, title = null, targetHash =...) # [comment required]
│   │   │   │   ├── function loadWorkspaces() # [comment required]
│   │   │   │   ├── function updateRefreshText() # [comment required]
│   │   │   │   ├── function setGlobalStatus(msg, timeout = 3000, isError = f...) # [comment required]
│   │   │   │   ├── function setSyncStatus(state) # [comment required]
│   │   │   │   ├── function executeWorkspaceMutation(path, payload, options = {}) # [comment required]
│   │   │   │   ├── function simulatePanic() # [comment required]
│   │   │   │   ├── function performSoftRefresh(targetWs = null, targetHash = null) # [comment required]
│   │   │   │   └── function fullRefresh() # [comment required]
│   │   │   ├── types.js            # Root JSDoc type definitions entry point.
│   │   │   ├── uri.js              # Canonical URI and structural bucket address value objects for the inSetu frontend.
│   │   │   │   ├── class BucketAddress # Immutable value object representing a canonical structural bucket address.
│   │   │   │   └── class InSetuURI # [stale?] Lexical URI parser and manipulator enforcing canonical scheme:// prefixes across vfs://, ctx://, and ws:// paths.
│   │   │   └── watchdog.py         # Out-of-band filesystem observer and deterministic content-addressed VFS echo filter.
│   │   │       ├── def start_filesystem_observer(**kwargs) # [stale?] Initializes a unified Watchdog observer for all active workspaces.
│   │   │       └── def stop_filesystem_observer(**kwargs) # [comment required]
│   │   ├── topology/               # Central SSOT for logical workspace topologies.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   └── engine_topology.py  # Tracks the active layout of repositories and buckets, and resolves repository landmarks from core and extension-registered kinds.
│   │   │       ├── def is_conflict_artifact_path(path_or_uri) # True when a path or URI is an OCC fallback file (`*.conflict_<timestamp>.*`).
│   │   │       ├── def hook_topology_manifest_signatures(workspace_id, since_ts, **kwargs) # Yields lightweight repository signatures for the vfs domain, incorporating git_status counts.
│   │   │       ├── def api_topology_vfs_repo(ctx) # Surgically fetches the VFS bucket structure and git modification state for a specific repository.
│   │   │       ├── def force_topology_scan(workspace_id, target_repos, **kwargs) # Synchronously forces a full physical disk walk to rebuild the Topology Ledger.
│   │   │       ├── def hook_request_vfs_manifest(workspace_id, **kwargs) # Returns the vfs manifest derived directly from the topology ledger via raw tuple queries.
│   │   │       ├── def get_omniscient_workspace_files(workspace_id, allowed_repos) # Fast SQL replacement for the old os.walk bridge optimization.
│   │   │       ├── def get_topology_files_for_repo(workspace_id, repo_dir) # SSOT accessor returning canonical vfs://<repo>/<path> URIs from topology_ledger.
│   │   │       ├── def clamp_uris_to_topology(workspace_id, candidate_uris, expand_dirs, gather_only) # Clamps and optionally expands candidate URIs against topology_ledger.
│   │   │       ├── def broadcast_cross_workspace_mutations(mutations, workspace_id, **kwargs) # Phase 4 Event Bus Synchronization: Propagates mutations on shared domains to subscriber workspaces as virtual 'ws://' mutations for reactive...
│   │   │       ├── def buffer_topology_events(mutations, workspace_id, **kwargs) # Stage 1 Slew Limiter: Catches high-velocity disk/watchdog mutations and buffers them in RAM to absorb the I/O storm before hitting SQLite.
│   │   │       ├── def reconcile_topology_on_config_mutated(workspace_id, **kwargs) # Reconciles topology_ledger for repositories whose sieve configuration changed (exts, ignores, mounts).
│   │   │       ├── def resolve_topology_buffer(workspace_id) # Processes any pending events in topology_event_buffer, updates topology_ledger, and emits topology_resolved.
│   │   │       ├── def mount_topology_volumes_dynamically(cfg, workspace_id, **kwargs) # Dynamically remounts VFS volumes whenever the configuration changes.
│   │   │       ├── def init_topology_on_boot(workspace_id, **kwargs) # Topology owns the boot sequence.
│   │   │       ├── def matches_gitignore_patterns(rel_path, patterns) # Evaluates a relative POSIX path against a list of .gitignore-style patterns.
│   │   │       ├── def is_file_tracked_by_sieve(rel_path, config, live_cfg, repo_dir) # Single Source of Truth (SSOT) Hierarchical VFS Sieve.
│   │   │       ├── def get_valid_workspace_files(repo_path, config, workspace_id) # Walks a physical repository directory and returns all files passing the Hierarchical VFS Sieve.
│   │   │       ├── def resolve_file_bucket(filepath, sub_buckets, repo_dir) # Maps a repo-relative filepath to its matching sub-bucket, _dropped sentinel, or Bucket 0 (main).
│   │   │       ├── def resolve_owning_workspaces(event_name, **kwargs) # Domain-aware spatial router for OS lifecycle events.
│   │   │       ├── class VerifyPlanTargetsPayload(TypedDict) # Request schema for verifying plan file targets against the workspace VFS.
│   │   │       ├── def api_topology_overview(ctx) # Compiles a lightweight structural overview of tracked repositories, sub-buckets, and CODE_INDEX.md headers.
│   │   │       ├── def api_topology_verify_plan_targets(ctx) # Verifies that vfs:// file targets referenced in an architectural plan exist or are marked as new files.
│   │   │       ├── def get_landmark_kinds(workspace_id) # Returns (kinds, notices): core landmark kinds followed by valid kinds that enabled extensions register.
│   │   │       ├── def read_repo_tier_settings(ctx, repo, ext_name) # Reads one extension's repository-tier settings, keeping only fields declared `authority: repo_content`.
│   │   │       ├── def resolve_repo_landmarks(ctx, repo) # Resolves where a repository keeps each landmark kind (standards, contracts, ADRs, tests, fitness suites, and kinds registered by extensions).
│   │   │       ├── def resolve_repo_code_index_uri(ctx, repo_dir, repo_cfg) # Resolves the canonical VFS URI for a repository's CODE_INDEX.md.
│   │   │       ├── def infer_target_repo(ctx, explicit_repo, candidate_uris) # Infers the target repository directory from an explicit repo name or a list of candidate URIs (such as `ctx://prompts/<repo>/...`, `vfs://<r...
│   │   │       ├── def build_sys_landmarks_context(ctx, repo_hint, candidate_uris, extra_inputs, ...) # Single Source of Truth builder for the `sys.*` template variable dictionary.
│   │   │       ├── def discover_constitution_files(ctx) # Returns the standards files to auto-pin (Tier 0) across mounted repositories, from each repository's landmarks.
│   │   │       ├── class TopologyLandmarksPayload(TypedDict) # Request schema for topology.landmarks: an optional repository name.
│   │   │       ├── def api_topology_landmarks(ctx) # Resolves repository landmarks for one repository (the first mounted one when none is named).
│   │   │       ├── class AuditUpkeepPayload(TypedDict) # Request schema for running a deterministic codebase upkeep audit.
│   │   │       ├── def api_topology_audit_upkeep(ctx) # Read-only audit of documentation/symbol drift, God-object candidates, test relevance and leftover *.conflict_* files.
│   │   │       ├── class CleanConflictsPayload(TypedDict) # Request schema for topology.clean_conflicts: the conflict files a person reviewed.
│   │   │       └── def api_topology_clean_conflicts(ctx) # Human-only: deletes the listed *.conflict_* files and refuses any other path.
│   │   └── utils_core.py           # [Workspace Physics & Universal Utils]
│   │       ├── def hook_vfs_resolve_path(filename, workspace_id, **kwargs) # [comment required]
│   │       ├── class InSetuURI(AkasaURI) # [stale?] Host application URI class enforcing strict canonical scheme:// prefixes for all internal operations, with explicit boundary parsing for ext...
│   │       ├── class BucketAddress # Immutable value object representing a canonical structural bucket address.
│   │       ├── def load_yaml_string(raw_yaml) # Centralized YAML string parser using the round-trip ruamel.yaml engine with safe fallback.
│   │       ├── def dump_yaml_string(yaml_data) # Centralized YAML string serializer using the round-trip ruamel.yaml engine with safe fallback.
│   │       ├── def parse_frontmatter(content) # [comment required]
│   │       ├── def update_frontmatter(content, new_data) # [comment required]
│   │       ├── def resolve_macro_includes(text, current_filepath, pattern, read_callback, ...) # [stale?] Expands {{include_prompt: ...}} and optional {{include_prompt?: ...}} macros recursively (depth 5), with macro parameters.
│   │       ├── def resolve_context_var_path(path_expr, context, ctx) # [stale?] Resolves a dotted variable reference ('sys.repo_title', 'global.mode', 'nodes.step.text', 'inputs.scope') against a routine or prompt contex...
│   │       ├── def interpolate_mustache_chain(template_str, context, ctx) # Single Source of Truth evaluator for `{{ var | sys.fallback | literal }}` placeholders across both standalone Prompt resolution (`prompts/re...
│   │       ├── def clean_date_str(val) # Safely normalizes varied date inputs into a standard ISO format.
│   │       ├── def get_earlier_date(d1, d2) # Safely compares and returns the earlier of two ISO timestamp strings.
│   │       ├── def parse_list_field(raw_val) # Safely parses comma-separated strings or JSON arrays into a standardized JSON string.
│   │       ├── def parse_string_enum(raw_val) # Safely parses and normalizes string enumerations (e.g., priority, sizes).
│   │       ├── def generate_text_chunks(blocks, chunk_limit) # [comment required]
│   │       ├── def evaluate_circuit_breaker(touched_count, total_count, threshold) # [comment required]
│   │       ├── def extract_manifest_files(manifest_data, target_key, domain, exclude_types, ...) # [comment required]
│   │       ├── def get_domain_cache_path(workspace_id, domain_name) # Resolves and ensures physical existence of .insetu/cache/<domain_name> for disposable compiled outputs.
│   │       ├── def get_domain_data_path(workspace_id, domain_name) # Resolves and ensures physical existence of .insetu/data/<domain_name> for sovereign workspace data.
│   │       ├── def get_safe_repo_id(repo_dir) # [comment required]
│   │       ├── def truncate_filename(filename, max_len, ellipsis) # Standardized filename truncation for compact UI chrome and CLI displays.
│   │       ├── def vacuum_manifest_artifacts(ctx, domain_dir, expected_artifacts_set, exempt_abs_paths) # Centralized garbage collector for compiled context artifacts.
│   │       ├── def reconcile_and_vacuum_domain(ctx, domain_uri_prefix, manifest_deltas, domain_dir, ...) # Make-Before-Break Domain Reconciler: 1.
│   │       ├── def get_flattened_buckets(workspace_id, target_configs) # Backend SSOT helper for resolving flattened sub-buckets with defensive null-safety.
│   │       ├── def get_available_contexts(workspace_id, exclusion_flags, exclude_types, include_types) # [comment required]
│   │       ├── def get_repo_path(repo_dir, workspace_id) # SSOT for resolving a repository's physical override or logical path.
│   │       ├── def get_sister_repos(workspace_id) # [comment required]
│   │       ├── def resolve_logical_path(path, workspace_id) # [comment required]
│   │       ├── def hook_expand_selection(items, workspace_id, gather_only, **kwargs) # [comment required]
│   │       ├── def find_path_candidates(query_path, workspace_id, allowed_repos, **kwargs) # [stale?] Explicit, opt-in candidate finder for path disambiguation.
│   │       ├── def get_default_repo_template(repo_dir, title, domain, description, ...) # [comment required]
│   │       ├── def normalize_repo_domains(target_repos, strip_empty_overrides) # SSOT normalizer for repository, sub-bucket, and meta_map domain strings.
│   │       ├── def heal_manifest_entry_domain(entry, target_repos, workspace_id) # Ensures entry['meta']['domain'] is never blank, inheriting from the parent repository domain when empty.
│   │       ├── def heal_sqlite_uri_column(conn, table, column, default_prefix) # Collision-safe SQLite URI column healer: removes duplicate unprefixed shadow rows before prepending default_prefix.
│   │       ├── def sanitize_workspace_config(cfg) # [comment required]
│   │       ├── def get_repeater_secret(ext_name, workspace_id, repeater_id, item_id, ...) # [stale?] SSOT reader for encrypted repeater item secrets stored in .insetu/secrets.json.
│   │       └── def set_repeater_secret(ext_name, workspace_id, repeater_id, item_id, ...) # SSOT writer for encrypted repeater item secrets in .insetu/secrets.json.
│   ├── defaults/                   # Base templates for workspace scaffolding.
│   │   ├── .gitkeep                # Git folder retention.
│   │   ├── config_json.txt         # Default config.json template for new workspace scaffolding.
│   │   ├── engine_template_py.txt  # Boilerplate Python engine template for new extensions.
│   │   ├── ext_template_js.txt     # Boilerplate Lit component template for new extensions.
│   │   ├── gitignore.txt           # Base .gitignore to protect local SQLite DBs and secrets.
│   │   └── system_json.txt         # Default system.json template for daemon scaffolding.
│   ├── extensions/                 # Tier 3 Domain Extensions (Opt-in functionality).
│   │   ├── __init__.py             # Module initialization.
│   │   ├── citations/              # CSL-JSON Academic Reference Library.
│   │   │   ├── engine_citations.py # [Local CSL Reference Manager]
│   │   │   │   ├── def inject_citation_metadata(cfg, workspace_id, **kwargs) # Dynamically injects virtual UI metadata for citation payloads statelessly.
│   │   │   │   ├── def declare_citations_topology(ctx, target_repos, ledger_events, workspace_id, **kwargs) # Declares global and repo-scoped citation libraries to the Gather engine for centralized compilation.
│   │   │   │   ├── def get_metadata_index(ctx) # [stale?] Leverages SQLite JSON1 C-extensions to calculate aggregates instantly, eliminating Python RAM caching.
│   │   │   │   ├── def get_citations(ctx) # Retrieves all stored academic citations with their associated attachment metadata.
│   │   │   │   ├── class AttachCitationPayload(TypedDict) # [comment required]
│   │   │   │   ├── def attach_citation(ctx, csl_id) # [stale?] Attaches files or metadata pointers to a specific citation ID.
│   │   │   │   ├── class SearchCitationsPayload(TypedDict) # [comment required]
│   │   │   │   ├── def search_global_citations(ctx) # Queries global academic catalogs for citations matching the criteria.
│   │   │   │   ├── class ImportCitationsPayload(TypedDict) # [comment required]
│   │   │   │   ├── def import_citations(ctx) # [stale?] Imports an array of CSL-JSON citation objects into the global library, resolving conflicts based on the chosen strategy.
│   │   │   │   ├── class DeleteCitationPayload(TypedDict) # [comment required]
│   │   │   │   ├── def delete_citation(ctx, csl_id) # [stale?] Permanently removes a citation from the global library.
│   │   │   │   └── def inject_citation_middleware(text, workspace_id, **kwargs) # [stale?] Parses text for citation macros and injects bibliography temp files and citeproc flags into the compiler.
│   │   │   └── ext_citations.js    # [Citations Manager UI & Store]
│   │   │       ├── class InSetuExtCitations # [comment required]
│   │   │       └── class InSetuExtCitationsModals # [comment required]
│   │   ├── cronic/                 # Scheduled cron task management extension.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_cronic.py    # Cron scheduler and execution worker.
│   │   │   │   ├── def has_crontab() # [comment required]
│   │   │   │   ├── def get_status(ctx) # Checks if the underlying OS environment supports crontab scheduling.
│   │   │   │   ├── def list_jobs(ctx) # Lists all configured cronic jobs and their current execution status.
│   │   │   │   ├── class CronicSchedulePayload(TypedDict) # [comment required]
│   │   │   │   ├── def schedule_job(ctx) # Schedules a script file to execute periodically via the system crontab.
│   │   │   │   ├── class CronicTogglePayload(TypedDict) # [comment required]
│   │   │   │   ├── def toggle_job(ctx) # Enables or disables an existing scheduled job.
│   │   │   │   ├── class CronicIdPayload(TypedDict) # [comment required]
│   │   │   │   ├── def delete_job(ctx) # Permanently removes a job from the schedule.
│   │   │   │   ├── def get_logs(ctx) # Retrieves the recent execution logs for a specified job ID.
│   │   │   │   ├── def run_now(ctx) # Manually dispatches a cronic job to run immediately in the background.
│   │   │   │   ├── def kill_job(ctx) # Terminates any currently running processes executing the specified cronic job script.
│   │   │   │   └── def cronic_workspace_boot(workspace_id, **kwargs) # [comment required]
│   │   │   ├── ext_cronic.js       # Cronic UI component and task store.
│   │   │   │   └── class InSetuExtCronic # [comment required]
│   │   │   └── vendor.json         # Map of core third-party UI dependencies (Lit, CodeMirror).
│   │   ├── dev/                    # Developer Dashboard for bridge telemetry and thrashing.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_dev.py       # Bridges and VFS performance logging.
│   │   │   │   ├── def log_vfs_telemetry(ctx, mutations, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def log_bridge_error(ctx, filepath, error_type, details, ...) # [comment required]
│   │   │   │   ├── def log_system_error(ctx, source, error_type, message, ...) # [comment required]
│   │   │   │   ├── class CmdExecPayload(TypedDict) # [comment required]
│   │   │   │   ├── class CmdExecResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_dev_exec(ctx) # Executes an arbitrary shell command within the workspace sandbox for testing and verification.
│   │   │   │   ├── def get_dev_metrics(ctx) # Retrieves system telemetry metrics, including file thrashing limits and bridge errors.
│   │   │   │   ├── def list_sql_databases(ctx) # Lists all available SQLite databases within the tenant cache/db directory.
│   │   │   │   ├── class SqlQueryPayload(TypedDict) # [comment required]
│   │   │   │   ├── def execute_sql_query(ctx) # Executes a constrained SQL query against a target workspace database.
│   │   │   │   ├── def get_backend_logs(ctx) # Retrieves the systemd journal logs for the background backend daemon.
│   │   │   │   ├── def download_boot_logs_worker(ctx) # [comment required]
│   │   │   │   ├── class DownloadLogsPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_download_logs(ctx) # Exports the current backend daemon invocation logs to a downloadable text file.
│   │   │   │   ├── def sweep_telemetry_worker(ctx) # [comment required]
│   │   │   │   └── def init_dev_workers(ctx, workspace_id, **kwargs) # [comment required]
│   │   │   └── ext_dev.js          # Dashboard UI for metrics display.
│   │   │       ├── class InSetuExtDevDash # [comment required]
│   │   │       ├── class InSetuExtDevLogs # [comment required]
│   │   │       ├── class InSetuExtDevSql # [comment required]
│   │   │       └── class InSetuExtDevMemory # [comment required]
│   │   ├── favorites/              # Pinned file and folder quick-access tray.
│   │   │   ├── engine_favorites.py # SQLite store for quick-access items.
│   │   │   │   ├── def list_favorites(ctx) # Lists all favorited files, folders, and resources.
│   │   │   │   ├── class FavoriteAddPayload(TypedDict) # [comment required]
│   │   │   │   ├── def add_favorite(ctx) # Pins a new file or folder to the favorites bar.
│   │   │   │   ├── class FavoriteDeletePayload(TypedDict) # [comment required]
│   │   │   │   └── def delete_favorite(ctx, fav_id) # Removes a pinned item from the favorites bar.
│   │   │   └── ext_favorites.js    # UI tray and management for favorites.
│   │   │       ├── class InSetuFavLabel # [comment required]
│   │   │       ├── class InSetuFavBtn # [comment required]
│   │   │       └── class InSetuExtFavorites # [comment required]
│   │   ├── format/                 # Pandoc document publishing and jsbeautifier formatting.
│   │   │   ├── engine_format.py    # [Document Compilation and formatting logic]
│   │   │   │   ├── class FormatCodePayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_format_code(ctx) # Formats the specified source code file using standard beautifiers (e.g.
│   │   │   │   └── def run_formatter() # [comment required]
│   │   │   └── ext_format.js       # Formatting UI and publishing modals.
│   │   ├── freshdesk/              # Helpdesk integration for threaded B2B support tickets.
│   │   │   ├── engine_freshdesk.py # Helpdesk API interactions and thread logging.
│   │   │   │   ├── class FreshdeskTicketPayload(TypedDict) # [comment required]
│   │   │   │   ├── def resolve_freshdesk_ticket(ctx, ticket_id) # Marks a specific Freshdesk ticket as resolved.
│   │   │   │   ├── class FreshdeskReplyPayload(TypedDict) # [comment required]
│   │   │   │   ├── def post_freshdesk_reply(ctx, ticket_id) # Posts a reply to a specific Freshdesk ticket.
│   │   │   │   ├── def take_freshdesk_ticket(ctx, ticket_id) # Assigns the specified Freshdesk ticket to the current authenticated agent.
│   │   │   │   ├── def get_freshdesk_thread(ctx, ticket_id) # Returns the cached markdown thread for a specific ticket.
│   │   │   │   ├── def get_freshdesk_conversations(ctx, ticket_id) # Fetches the conversation thread for a specific ticket.
│   │   │   │   ├── def get_ignored_tickets(ctx) # Retrieves a list of ticket IDs that the user has chosen to ignore.
│   │   │   │   ├── def ignore_freshdesk_ticket(ctx, ticket_id) # Marks a specific ticket as ignored so it no longer appears in the UI.
│   │   │   │   ├── class FreshdeskFetchPayload(TypedDict) # [comment required]
│   │   │   │   └── def get_freshdesk_tickets(ctx) # Secure proxy endpoint using the asynchronous jobs ledger to prevent event loop starvation.
│   │   │   └── ext_freshdesk.js    # Ticket viewing and response UI.
│   │   │       └── class InSetuExtFreshdesk # [stale?] 2.
│   │   ├── git/                    # Version control, branch management, and workspace sweeping.
│   │   │   ├── engine_git.py       # [Git Operations & Diff Generator]
│   │   │   │   ├── def get_headless_git_env() # Returns the 'tool' child environment with non-interactive SSH settings for git (S3).
│   │   │   │   ├── def execute_git(**kwargs) # Universal Git command wrapper supporting both logical volumes and physical paths.
│   │   │   │   ├── def diffable_changes(changed_files, config, live_cfg) # Keeps the (repo-relative path, status, git path) entries the topology sieve tracks.
│   │   │   │   ├── def generate_diff_context(workspace_id, target_repos, manifest_ref, touched_buckets) # [comment required]
│   │   │   │   ├── def pre_warm_git_sweep(ctx, workspace_id, **kwargs) # Pre-warms the Git sweepable state silently in the background after the topology settles.
│   │   │   │   ├── class GitSweepStatusPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_git_sweep_status(ctx) # Scans workspaces for untracked files or metadata ready to be swept into VCS.
│   │   │   │   ├── class GitSweepPushPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_git_sweep_push(ctx) # Commits and pushes selected untracked/swept files to their respective repositories.
│   │   │   │   ├── class GitCompileDiffsPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_git_compile_diffs(ctx) # Evaluates and compiles fresh ctx://diffs/*_diffs.txt artifacts across dirty or targeted repositories.
│   │   │   │   ├── def api_git_list_dirty_diff_buckets(ctx) # Lists all active ctx://diffs/*_diffs.txt artifacts and their corresponding repositories.
│   │   │   │   ├── class GitRepoPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_git_changelogs(ctx) # Queries the rapid SQLite tracking index to populate recent commit suggestions.
│   │   │   │   ├── class GitPushPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_git_push(ctx) # Commits and pushes staged changes to the remote repository.
│   │   │   │   ├── def provide_available_diffs(ctx, workspace_id, **kwargs) # Soft-dependency provider: Supplies expected diffs to the Gather/Flow UI dropdowns.
│   │   │   │   ├── def api_git_status(ctx) # Retrieves the Git working tree status, active branches, and conflict state for all tracked repositories.
│   │   │   │   ├── class GitResolveStatePayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_git_resolve_state(ctx) # Continues or aborts an active rebase/merge state.
│   │   │   │   ├── class GitInitPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_git_init(ctx) # Initializes a new Git repository locally on a specified branch.
│   │   │   │   ├── def api_git_fetch_preview(ctx) # Fetches the remote repository and previews incoming commits and changes without pulling.
│   │   │   │   ├── class GitPullPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_git_pull(ctx) # Pulls incoming changes from the remote repository using the specified strategy (rebase, merge, ff_only).
│   │   │   │   ├── class GitRemoteAddPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_git_remote_add(ctx) # Connects a local repository to a remote Git URL and pushes.
│   │   │   │   ├── class GitCheckoutPayload(TypedDict) # [comment required]
│   │   │   │   └── def api_git_checkout(ctx) # Checks out an existing branch or creates a new one.
│   │   │   ├── ext_git.js          # [Git Push & Sweep UI]
│   │   │   │   ├── function generateDiffs(force = false) # [comment required]
│   │   │   │   ├── class InSetuExtGitDiffs # [comment required]
│   │   │   │   ├── class InSetuGitPushProjection # [comment required]
│   │   │   │   └── class InSetuExtGitCtrl # [comment required]
│   │   │   ├── prompts/            # Co-located Git prompt templates for diff auditing and session closeout.
│   │   │   │   ├── close_session_protocol.md # Protocol for summarizing session changes and drafting Conventional Commits.
│   │   │   │   └── diff_audit_criteria.md # Pre-commit review criteria for auditing uncommitted diff buckets.
│   │   │   └── routines/           # Co-located Git declarative DAG routines (/audit and /closeout).
│   │   │       ├── close_session.md # End-of-session changelog and commit synthesis routine (/closeout).
│   │   │       └── diff_audit.md   # Parallel per-bucket pre-commit diff audit routine (/audit).
│   │   ├── hooks/                  # IFTTT-style automation hooks based on VFS and topology events.
│   │   │   ├── engine_hooks.py     # Evaluates VFS events against registered hooks.
│   │   │   │   ├── def process_vfs_triggers(dirty_repos, dirty_buckets, workspace_id, events, **kwargs) # Event Bus Hook: evaluates active automation rules for the changed topology, deduplicating unapproved-command warnings per process.
│   │   │   │   ├── def list_rules(ctx) # [stale?] Lists all configured automation rules.
│   │   │   │   ├── class HookSavePayload(TypedDict) # [comment required]
│   │   │   │   ├── def save_rule(ctx) # Creates or updates an automation rule and records a person's approval of its command (human-only).
│   │   │   │   ├── class HookTogglePayload(TypedDict) # [comment required]
│   │   │   │   ├── def toggle_rule(ctx) # Enables or disables an automation rule; enabling approves its command (human-only).
│   │   │   │   ├── class HookApprovePayload(TypedDict) # [comment required]
│   │   │   │   ├── def approve_rule(ctx) # Approves a rule's command as shown on its card.
│   │   │   │   ├── class HookIdPayload(TypedDict) # [comment required]
│   │   │   │   ├── def execute_rule_manual(ctx) # [stale?] Manually executes an automation rule, refused unless its current command is approved.
│   │   │   │   ├── def delete_rule(ctx) # Permanently deletes an automation rule and revokes its approval.
│   │   │   │   └── def get_logs(ctx) # Retrieves logs for executed automation rules.
│   │   │   └── ext_hooks.js        # UI for creating and managing hooks.
│   │   │       └── class InSetuExtHooks # [comment required]
│   │   ├── ingest/                 # URL to Markdown extraction via Jina or BeautifulSoup.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_ingest.py    # URL fetching and parsing logic.
│   │   │   │   ├── def extract_markdown_from_url(ctx, target_url, method) # [stale?] Fetches a URL and converts it to Markdown ('bs4' locally, 'jina' via r.jina.ai); caller URLs must be public unless a person allowed the host (S4).
│   │   │   │   ├── class IngestUrlPayload(TypedDict) # [comment required]
│   │   │   │   └── def api_ingest_url(ctx) # Queues a URL ingest job; parses locally by default, or through r.jina.ai when the caller asks (S4).
│   │   │   └── ext_ingest.js       # UI modal for URL ingestion.
│   │   │       ├── class InSetuExtIngestActions # [comment required]
│   │   │       └── class InSetuExtIngestModals # [comment required]
│   │   ├── notes/                  # Markdown note-taking interface with frontmatter management.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_notes.py     # SQLite ledger tracking for markdown notes.
│   │   │   │   ├── class NotesVFSDriver(DefaultVFSDriver) # VFS Driver for ctx://notes that transparently resolves notes relocated to <repo>/.insetu-data/notes/.
│   │   │   │   ├── def inject_notes_config(cfg, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def hydrate_notes_on_boot(ctx, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def handle_notes_vfs_mutations(ctx, mutations, workspace_id, **kwargs) # Event Bus hook: Keeps the Notes DB synced with both global and repo-scoped disk changes.
│   │   │   │   ├── def api_notes_list(ctx) # [stale?] CQRS read-path: Fetches notes from DB, ensuring post-migration paths are synchronized.
│   │   │   │   ├── class NoteNewPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_notes_new(ctx) # [stale?] Generates a new note file with managed YAML frontmatter.
│   │   │   │   └── def declare_notes_topology(ctx, target_repos, ledger_events, workspace_id, **kwargs) # Declares the notes library to the Gather engine for centralized chunking and context compilation.
│   │   │   └── ext_notes.js        # Note-taking editor and browser.
│   │   │       ├── class InSetuExtNotesModals # [stale?] 2.
│   │   │       ├── class InSetuExtNotesEditor # [stale?] 3.
│   │   │       └── class InSetuExtNotes # [stale?] 4.
│   │   ├── preview/                # Managed dev server supervisor and live web application previewer.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_preview.py   # Multi-profile dev server process supervisor, port allocator, and log ring buffer. Loopback by default; LAN leases and custom-command approval (S2).
│   │   │   │   ├── class PreviewApprovalRequired(Exception) # Raised when a repository's custom launch command has not been approved by a person.
│   │   │   │   ├── def start_repo_server(ctx, repo_dir, overrides, lan_lease) # Starts or restarts a repository's server, on loopback unless a new or still-matching LAN lease applies.
│   │   │   │   ├── def stop_repo_server(ctx, repo_dir) # [comment required]
│   │   │   │   ├── def auto_boot_pinned_preview_servers(ctx, workspace_id, **kwargs) # Phase 2 Boot Hook: Spawns only repositories with explicit auto_start=True.
│   │   │   │   ├── def cleanup_workspace_preview_servers(workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def cleanup_all_preview_servers(**kwargs) # [comment required]
│   │   │   │   ├── class PreviewStartPayload(TypedDict) # [comment required]
│   │   │   │   ├── class PreviewRepoTargetPayload(TypedDict) # [comment required]
│   │   │   │   ├── class PreviewOpenLanPayload(TypedDict) # Request schema for opening a repository's server to the LAN for 'run', '15m', '1h' or '8h' (S2).
│   │   │   │   ├── class PreviewApproveCommandPayload(TypedDict) # Request schema for a person approving one exact custom preview command for a repository (P5).
│   │   │   │   ├── def api_preview_status(ctx) # Passively inspects server status, sticky ports, and detected modes across all workspace repositories.
│   │   │   │   ├── def api_preview_start(ctx) # Starts or restarts a repository's server on loopback; answers 403 needs_approval for an unapproved custom command (S2).
│   │   │   │   ├── def api_preview_open_lan(ctx) # Restarts a repository's server on 0.0.0.0 under a LAN lease a person grants.
│   │   │   │   ├── def api_preview_close_lan(ctx) # Ends a repository's LAN lease early: revokes it and restarts the server on loopback.
│   │   │   │   ├── def api_preview_approve_command(ctx) # Records a person's approval of one exact custom preview command for a repository.
│   │   │   │   ├── def api_preview_stop(ctx) # Terminates a running development server process group for a target repository.
│   │   │   │   └── def api_preview_logs(ctx) # Returns buffered stdout/stderr lines for a repository's managed preview server.
│   │   │   ├── ext_preview.js      # Live iframe preview surface, server toolbar, and output log drawer.
│   │   │   │   ├── class InSetuExtPreview # [comment required]
│   │   │   │   └── function openInPreview(data, isDir = false) # [comment required]
│   │   │   └── vendor.json         # Map of core third-party UI dependencies (Lit, CodeMirror).
│   │   ├── publish/                # Standalone Pandoc/LaTeX document publishing extension.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_publish.py   # Document publishing and compilation engine.
│   │   │   │   ├── def resolve_publish_artifacts(ctx, filename, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── class CompileDocumentPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_publish_compile_document(ctx) # Compiles a Markdown document into a target format (PDF, DOCX, HTML) using Pandoc.
│   │   │   │   └── def compile_document_payload(workspace_id, filepath, target_format) # [comment required]
│   │   │   ├── ext_publish.js      # Document publishing UI and modal controls.
│   │   │   │   └── class InSetuExtPublishModals # [comment required]
│   │   │   └── vendor.json         # Map of core third-party UI dependencies (Lit, CodeMirror).
│   │   ├── research/               # Map-Reduce web scraping, SERP indexing, and AI triage.
│   │   │   ├── engine_research.py  # [Web Search & Triage Inbox]
│   │   │   │   ├── def resolve_research_artifacts(ctx, filename, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── class SearchProvider # [comment required]
│   │   │   │   ├── class DuckDuckGoHTMLProvider(SearchProvider) # [comment required]
│   │   │   │   ├── class GooglePlaywrightProvider(SearchProvider) # [comment required]
│   │   │   │   ├── class SerperDevProvider(SearchProvider) # [comment required]
│   │   │   │   ├── def get_provider(provider_name) # [comment required]
│   │   │   │   ├── def gather_next_page(ctx, research_job_id, job_id) # [stale?] Metronome callback to fetch a single SERP page, preventing rate limits.
│   │   │   │   ├── def scrape_next_link(ctx, research_job_id, job_id) # [stale?] Scrapes one link of a research job through ingest (local parsing by default) inside the shared thread pool.
│   │   │   │   ├── class ResearchStartPayload(TypedDict) # [comment required]
│   │   │   │   ├── def start_job(ctx) # [stale?] Starts an asynchronous research job; searches go through fetch_url and each result is queued for scraping (S4).
│   │   │   │   ├── class ResearchActionPayload(TypedDict) # [comment required]
│   │   │   │   ├── def job_action(ctx, job_id) # [stale?] Performs lifecycle actions (pause, resume, cancel, retry, delete) on a specific research job.
│   │   │   │   ├── def list_jobs(ctx) # Retrieves the history of active and past research jobs.
│   │   │   │   ├── def list_inbox(ctx) # Retrieves scraped research links currently awaiting triage in the inbox.
│   │   │   │   ├── class ExportContextPayload(TypedDict) # [comment required]
│   │   │   │   ├── def export_context(ctx, job_id) # Packs all scraped content for a job into plain text artifacts suitable for LLM injection.
│   │   │   │   ├── class InboxDispositionPayload(TypedDict) # [comment required]
│   │   │   │   └── def inbox_disposition(ctx, inbox_id) # Applies a triage decision (accepted, rejected, force_scrape) to an item in the inbox.
│   │   │   ├── ext_research.js     # [Research Inbox UI & Triage]
│   │   │   │   ├── function getJobPresentation(job, formatDateFn) # [comment required]
│   │   │   │   ├── class InSetuExtResearch # [comment required]
│   │   │   │   └── class InSetuResearchPreviewProjection # [comment required]
│   │   │   └── prompts/            # Management of global prompt templates and macro inclusions.
│   │   │       └── batch_triage_filter.md # Prompt template for AI-assisted batch triage of scraped research inbox items.
│   │   ├── skills/                 # Spaced-repetition tracking for discrete musical/technical skills.
│   │   │   ├── engine_skills.py    # Skill tracking algorithms and SQLite storage.
│   │   │   │   ├── def hydrate_skills_on_boot(ctx, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def get_practice_playlist(ctx) # [stale?] Compiles a unified practice batch across all domains sorted globally.
│   │   │   │   ├── class LogSkillPayload(TypedDict) # [comment required]
│   │   │   │   ├── def log_skill_practice(ctx) # [stale?] Logs a practice run against the user's global profile tracking framework.
│   │   │   │   ├── class UpdateSkillPayload(TypedDict) # [comment required]
│   │   │   │   ├── def update_skill_structure(ctx) # [stale?] Updates structural track properties without affecting the SM-2 spaced repetition clocks.
│   │   │   │   ├── class DeleteSkillPayload(TypedDict) # [comment required]
│   │   │   │   ├── def delete_skill_item(ctx) # [stale?] Permanently purges a skill markdown asset from user space disk and index ledger.
│   │   │   │   ├── def get_all_skills(ctx) # [stale?] Returns every tracking item registered across the user profile layout.
│   │   │   │   ├── class CreateSkillPayload(TypedDict) # [comment required]
│   │   │   │   └── def create_new_skill(ctx) # Generates a physical markdown file structure inside global user space.
│   │   │   └── ext_skills.js       # Spaced-repetition training UI.
│   │   │       ├── class InSetuExtSkills # [comment required]
│   │   │       ├── class InSetuExtSkillsModals # [comment required]
│   │   │       └── class InSetuSkillsSessionProjection # [comment required]
│   │   ├── term/                   # Embedded terminal multiplexer and PTY WebSocket stream.
│   │   │   ├── engine_term.py      # [Terminal Multiplexer API]
│   │   │   │   ├── def set_winsize(fd, row, col, xpix, ...) # Native IOCTL system call to resize the PTY grid.
│   │   │   │   └── def term_status(ctx) # Checks if the underlying system supports PTY streams and Websocket connections.
│   │   │   ├── ext_term.js         # [Terminal Emulator UI]
│   │   │   │   └── class InSetuExtTerm # [comment required]
│   │   │   ├── vendor/             # Vendored third-party runtime assets.
│   │   │   │   ├── LICENSE         # Open-source software license.
│   │   │   │   ├── xterm-addon-fit.js # Vendored xterm-addon-fit runtime asset.
│   │   │   │   ├── xterm.css       # Stylesheet for xterm.
│   │   │   │   └── xterm.js        # Vendored xterm runtime asset.
│   │   │   │       └── function Se() # Bundled by jsDelivr using Rollup v4.62.2 and esbuild v0.28.1.
│   │   │   └── vendor.json         # Map of core third-party UI dependencies (Lit, CodeMirror).
│   │   ├── tracker/                # Local offline Kanban board using Markdown-as-Code tickets.
│   │   │   ├── README.md           # Primary project overview, architecture, and installation guide.
│   │   │   ├── engine_tracker.py   # [Kanban Issue Tracker & Cache]
│   │   │   │   ├── def initialize_tracker_schemas(ctx, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def schedule_tracker_archiving(ctx, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def handle_tracker_vfs_mutations(ctx, mutations, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def inject_tracker_config(cfg, workspace_id, **kwargs) # Dynamically injects the .tracker logic into the core OS pipelines.
│   │   │   │   ├── def get_tracker_path(repo, ticket_type, status) # Resolves the canonical VFS directory URI for a ticket inside vfs://<repo>/.insetu-data/tracker.
│   │   │   │   ├── def create_ticket(ctx, repo, ticket_type, status, ...) # Generates the physical Markdown file with YAML frontmatter.
│   │   │   │   ├── def transition_ticket(ctx, repo, current_rel_path, new_status, ...) # Moves a ticket across the ecosystem and stamps the close date if applicable.
│   │   │   │   ├── def manual_tracker_housekeeping(ctx, workspace_id, **kwargs) # Hydrates Tracker safely after Topology maps the workspace, or on manual refresh.
│   │   │   │   ├── def enforce_declarative_tickets(workspace_id, specific_file) # SSOT Enforcer: Sweeps all .tracker directories (or a specific file).
│   │   │   │   ├── class TrackerSpawnPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_tracker_spawn_template(ctx) # Spawns a new ticket tree from an existing template.
│   │   │   │   ├── def archive_stale_tickets(workspace_id) # Sweeps all repos for tickets passing the dynamic log and archive thresholds.
│   │   │   │   ├── def api_tracker_system_schemas(ctx) # SSOT: Provides the immutable system schemas to the frontend.
│   │   │   │   ├── class TrackerVocabPayload(TypedDict) # [comment required]
│   │   │   │   ├── def save_vocab_settings(ctx) # Intercepts vocabulary changes to trigger the background harmonization engine.
│   │   │   │   ├── class TrackerNewPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_tracker_new(ctx) # Creates a new markdown-based Kanban ticket.
│   │   │   │   ├── def api_tracker_index(ctx) # CQRS Aggregation Path: Leverages SQLite json_each to compile distinct tags and buckets in C.
│   │   │   │   ├── class TrackerFilesResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_tracker_files(ctx) # Returns a JSON array of all active Kanban tickets across the workspace.
│   │   │   │   ├── class TrackerRestorePayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_tracker_restore_metadata(ctx) # Scans Git history to restore wiped metadata (e.g.
│   │   │   │   ├── def restore_ticket_metadata_from_git(workspace_id) # [comment required]
│   │   │   │   ├── class TrackerTransitionPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_tracker_transition(ctx) # Transitions a Kanban ticket to a new status or type, automatically relocating the markdown file on disk.
│   │   │   │   ├── def provide_changelog_suggestions(repo, workspace_id, **kwargs) # Provides recent closed tickets to other extensions (like Git) without exposing DB internals.
│   │   │   │   └── def on_tracker_settings_updated(ctx, workspace_id, **kwargs) # Event Bus hook: Rebuilds context payloads immediately when tracker settings are updated.
│   │   │   ├── ext_tracker.js      # [Kanban Board UI & Store]
│   │   │   │   ├── class InSetuTrackerTicket # [comment required]
│   │   │   │   ├── class InSetuExtTracker # [comment required]
│   │   │   │   ├── class InSetuExtTrackerModals # [comment required]
│   │   │   │   ├── class InSetuTrackerEditProjection # [comment required]
│   │   │   │   └── class InSetuExtTrackerSettings # [stale?] OS Registration Hook
│   │   │   └── prompts/            # Management of global prompt templates and macro inclusions.
│   │   │       ├── housekeeping_tracker_phase.md # Protocol for closing completed tracker tickets in sys.tracker_dir and generating retrospective changelog epics at session closeout.
│   │   │       └── ticket_authoring_guide.md # Prompt template guiding LLMs on authoring Markdown-as-Code Kanban tickets.
│   │   └── update/                 # Automated Python semantic versioning and PyPI distribution.
│   │       ├── __init__.py         # Module initialization.
│   │       ├── engine_update.py    # Python-semantic-release orchestration.
│   │       │   ├── class UpdateRepoPayload(TypedDict) # [comment required]
│   │       │   ├── class UpdatePreviewBumpPayload(TypedDict) # [comment required]
│   │       │   ├── def api_update_preview_first_release(ctx) # Evaluates a dry-run of an initial semantic release and PyPI distribution.
│   │       │   ├── def api_update_preview_bump(ctx) # Evaluates a dry-run semantic version bump based on commit logs.
│   │       │   ├── def api_update_bump(ctx) # Calculates semantic version, bumps pyproject.toml, generates changelog, and pushes the release tag.
│   │       │   ├── def api_update_preview_publish(ctx) # Evaluates a dry-run distribution publish sequence.
│   │       │   ├── def api_update_first_release(ctx) # Builds and distributes the initial baseline release and pushes Git tags.
│   │       │   ├── def api_update_publish(ctx) # Distributes the compiled package to configured registries (e.g.
│   │       │   ├── class UpdateTomlPayload(TypedDict) # [comment required]
│   │       │   ├── def api_update_toml_config(ctx) # Updates semantic release configuration natively in pyproject.toml.
│   │       │   ├── class UpdateManualBuildPayload(TypedDict) # [comment required]
│   │       │   ├── def api_update_manual_build(ctx) # Executes a manual packaging build via the configured build command.
│   │       │   ├── def api_update_status(ctx) # [stale?] Retrieves the current semantic versioning and build status of a repository.
│   │       │   ├── class UpdateForceVersionPayload(TypedDict) # [comment required]
│   │       │   ├── def api_update_force_version(ctx) # Forces an explicit version bump and Git tag.
│   │       │   ├── class UpdateInitPayload(TypedDict) # [comment required]
│   │       │   ├── def api_update_create_dummy_toml(ctx) # Creates a basic pyproject.toml to establish semantic versioning baseline.
│   │       │   ├── def api_update_eligible_repos(ctx) # Returns a mapping of repositories eligible for semantic updates based on the presence of a pyproject.toml file.
│   │       │   └── def api_update_scaffold(ctx) # Injects the semantic-release configuration and establishes the initial version directly through the Event Ledger.
│   │       ├── ext_update.js       # Release preview and publish UI.
│   │       │   └── class InSetuExtUpdate # [comment required]
│   │       └── vendor.json         # Map of core third-party UI dependencies (Lit, CodeMirror).
│   ├── fallback_bridge.py          # Immutable Recovery OS and Lifeboat UI, behind the same token gate and Host check as the app.
│   │   ├── def current_token()     # The token this lifeboat accepts: the app's durable session token, or a lifeboat-only one as a last resort.
│   │   ├── def expand_macros(text) # [stale?] Expands intentional Yomama semantic multiplier macros ({{ c * N }}, ccc).
│   │   ├── def parse_blocks(text)  # Compiler-grade two-phase Lexer + Lookahead Parser for Yomama Bridge payloads: - Heals web-chat chevron meltdown (`> > > REPLACE`, `< < < SEA...
│   │   ├── def apply_block_in_memory(content, block) # [comment required]
│   │   ├── def index_redirect()    # [comment required]
│   │   ├── def recovery_auth_bootstrap() # Allows reboot polling loops (from both main OS and recovery UI) to detect when the server is in recovery mode.
│   │   ├── def index()             # [comment required]
│   │   ├── def panic_details()     # [comment required]
│   │   ├── def bridge_sync()       # [comment required]
│   │   ├── def fs_list()           # [comment required]
│   │   ├── def download(filepath)  # [comment required]
│   │   ├── def api_emergency_dump() # Zero-dependency hardcoded compiler that survives core config corruption.
│   │   ├── def system_reboot()     # [comment required]
│   │   └── def run_recovery_app()  # [comment required]
│   ├── recovery_check.py           # Add stdlib-only smoke tests for cli.py, fallback_bridge.py and credentials.py that check a proposed version without writing it
│   │   ├── def load_source(name, source, path) # Executes source as a fresh module named name whose __file__ is path.
│   │   ├── def check_cli(source, path) # The CLI imports, and `insetu --help` exits cleanly with a usage line.
│   │   ├── def check_lifeboat(source, path) # The lifeboat imports, serves its public page, and reads and verifies its token.
│   │   ├── def check_credentials(source, path) # The credential store creates, reads, verifies and rotates a token in a temporary directory.
│   │   └── def main(argv)          # CLI entry point for syncing and checking sutram and codemirror vendor locks.
│   ├── static/                     # Web server static assets and frontend bundles.
│   │   ├── css/                    # Global CSS stylesheets.
│   │   │   └── style.css           # Global theme variables, utility classes, and layout rules.
│   │   ├── js/                     # [Frontend JavaScript Payloads]
│   │   │   ├── app.js              # [Frontend Bootloader & Core Setup]
│   │   │   └── types.js            # Root JSDoc type definitions entry point.
│   │   ├── manifest.json           # Progressive Web App (PWA) manifest.
│   │   ├── sw.js                   # Service Worker for offline-first asset caching.
│   │   └── vendor.json             # Map of core third-party UI dependencies (Lit, CodeMirror).
│   └── templates/                  # Jinja2 HTML templates.
│       └── index.html              # The master SPA entry point containing the OS crash shell.
├── pyproject.toml                  # Python package definition and semantic-release configurations.
├── scripts/                        # Build, vendorization, and utility shell scripts.
│   ├── .gitkeep                    # Git folder retention.
│   ├── codemirror/                 # Build and dependency specification for insetu-codemirror-bundle.
│   │   ├── build.mjs               # Code-splitting esbuild bundler producing codemirror-core, lang/*, legacy/*, lezer/*, licenses, and languages.json.
│   │   │   ├── function stageEntry(outRelNoExt, code) # [comment required]
│   │   │   └── function readInstalledVersion(pkgName) # 8.
│   │   ├── languages.src.json      # Source manifest for built-in, Layer 1 Lezer, and Layer 2 stream editor languages.
│   │   ├── package-lock.json       # Pinned npm dependency lockfile for reproducible builds.
│   │   └── package.json            # Pinned npm package manifest for insetu-codemirror-bundle.
│   ├── release_check.sh            # New: run a repository's unit and fitness suites on every Python version the CI battery's gate jobs use (read from battery.yml), in fresh cac...
│   ├── vendor_codemirror.sh        # Runs npm ci, executes scripts/codemirror/build.mjs, and syncs codemirror.lock.json.
│   ├── vendor_jsyaml.sh            # Local esbuild vendorization script for js-yaml library.
│   ├── vendor_lit.sh               # Local esbuild vendorization script for Lit library.
│   ├── vendor_lock.py              # Vendors sutram/yenVUI and locks both sutram.lock.json and codemirror.lock.json.
│   │   ├── def tree_digest(vendor_root) # [stale?] Returns (sha256, file_count) over every file under the BUILD_MAP destinations, keyed by relative path.
│   │   ├── def read_sutram_version(sutram_root) # Reads [project].version from sutram's pyproject.toml without tomllib (Python 3.10 has none).
│   │   ├── def read_git_state(sutram_root) # Returns (HEAD commit, dirty) for the vendored paths, or (None, False) when sutram_root is not a git checkout.
│   │   ├── def sync(sutram_root, vendor_root, source) # Vendors sutram into vendor_root, deletes files sutram no longer has, and writes the lock.
│   │   ├── def check(vendor_root, strict) # [stale?] Returns a list of problems with the vendored files against the lock (empty when they match).
│   │   ├── def codemirror_tree_digest(codemirror_dir) # [stale?] Returns (sha256, file_count) over every file in static/vendor/codemirror except codemirror.lock.json.
│   │   ├── def sync_codemirror(package_lock_path, codemirror_dir) # Records the hash of scripts/codemirror/package-lock.json and the tree digest of static/vendor/codemirror/.
│   │   ├── def check_codemirror(codemirror_dir, package_lock_path) # [stale?] Verifies static/vendor/codemirror/ against codemirror.lock.json and scripts/codemirror/package-lock.json.
│   │   └── def main(argv)          # CLI entry point for syncing and checking sutram and codemirror vendor locks.
│   ├── vendor_lucide.sh            # Generates the local Lucide SVG icon sprite dictionary.
│   ├── vendor_sutram.sh            # Resolves a sutram checkout (sibling or fresh clone) and runs vendor_lock.py sync.
│   ├── vendor_zustand.sh           # Local esbuild vendorization script for Zustand modules.
│   └── x-ray-dom-nodes-and-events.js # DOM node and event listener X-Ray diagnostic tool.
└── tests/                          # Automated testing suite.
    ├── fitness/                    # The AST and Regex architectural linter rules.
    │   ├── __init__.py             # Module initialization.
    │   │   └── def run_all()       # [comment required]
    │   ├── core.py                 # Core validation logic and whitelist definitions.
    │   │   ├── def collect_unique_files(directories, extensions) # [comment required]
    │   │   ├── class FitnessState  # [comment required]
    │   │   └── def report_violation(rule_name, filepath, line_num, message) # [comment required]
    │   ├── rules_css.py            # CSS linter enforcing intent tokens and banning !important.
    │   │   └── def check_css_files() # [comment required]
    │   ├── rules_javascript.py     # JS linter enforcing UDF, declarative UI, and API contracts.
    │   │   ├── def strip_lit_expressions(line) # Replaces every Lit ${...} expression on a line with an empty '${}' (brace-balanced, so arrow functions and object literals inside bindings a...
    │   │   ├── def check_vendor_manifest_paths() # [comment required]
    │   │   ├── def check_tier0_domain_purity() # [comment required]
    │   │   └── def check_javascript_files() # [comment required]
    │   ├── rules_python.py         # Python AST linter enforcing async barriers and context accessors.
    │   │   ├── def count_direct_settings_access(source) # [stale?] Number of direct configuration accesses in one file's source (the unit SETTINGS_ACCESS_RATCHET counts).
    │   │   ├── def check_settings_access_ratchet(repo_root, report, ratchet) # [stale?] Compares each file's direct configuration access count with SETTINGS_ACCESS_RATCHET.
    │   │   ├── class BackendFitnessVisitor(ast.NodeVisitor) # [comment required]
    │   │   ├── def check_python_files() # [comment required]
    │   │   ├── def check_internal_imports_resolve(repo_root, report) # Verifies that every `from insetu.<mod> import <name>` across `insetu/` and `tests/` resolves to an existing symbol in `<mod>`.
    │   │   └── def check_module_size_ratchet(repo_root, report) # [stale?] Wave 1 A4.3 (E2): Enforces shrinking line-count ceilings on MODULE_LINE_RATCHET entries and fails if any unlisted Python or JS module in ins...
    │   └── rules_python_floor.py   # Fitness rule PYTHON_VERSION_FLOOR: reports, from any Python version, the syntax and standard-library names that the oldest supported Python...
    │       ├── def read_python_floor(pyproject_text) # Returns the oldest supported Python from a pyproject.toml's `requires-python = ">=3.x"`, or the default.
    │       ├── def floor_violations(source, floor) # Returns (line, reason) for everything in `source` that the floor Python version would reject.
    │       └── def check_python_version_floor() # [comment required]
    ├── fitness_functions.py        # Master CLI runner for the architectural fitness linter suite.
    ├── parity/                     # Parallel logic registry: one entry per Python/JavaScript pair, with its reason and shared cases (see test_parallel_logic_parity.py).
    │   ├── dag_wavefronts.json     # Parallel logic registry entry: dag_wavefronts (pending).
    │   ├── frontmatter_parse.json  # Parallel logic registry entry: frontmatter_parse (pending).
    │   ├── patch_block_splitting.json # Parallel logic registry entry: patch_block_splitting (pending).
    │   ├── slugify.json            # Parallel logic registry entry: slugify (covered).
    │   ├── template_variables_extract.json # Parallel logic registry entry: template_variables_extract (pending).
    │   ├── template_variables_interpolate.json # Parallel logic registry entry: template_variables_interpolate (pending).
    │   ├── three_way_merge.json    # Parallel logic registry entry: three_way_merge (diverges).
    │   └── uri_canonicalize.json   # Parallel logic registry entry: uri_canonicalize (pending).
    ├── performance/                # Performance checks
    │   ├── README.md               # How to run the performance check, why it measures the running app and not a test workspace, and how to add a check.
    │   ├── __init__.py             # Marks tests/performance as the home of checks that measure the running app against response-time budgets.
    │   ├── budgets.json            # The first response-time budget: the routines listing, warm, at about double what was measured on 2026-11-10 after the routine-check and pars...
    │   └── perf_check.py           # A standard-library script that measures the running app against the budgets in budgets.json: it gets a token through the CLI's local handsha...
    │       ├── def find_port(control_dir, explicit) # The app's port: the one given, else INSETU_PORT, else host.json, else the default.
    │       ├── def find_workspace(control_dir, explicit) # The workspace to measure: the one given, else the active one in workspaces.json, else 'default'.
    │       ├── def find_token(control_dir, port, explicit) # The session token: the one given, else INSETU_TOKEN, else the local handshake the CLI uses, else the saved file.
    │       ├── def fetch(port, workspace, path, token) # Requests one API path and returns (milliseconds it took, the JSON it returned).
    │       ├── def summarize(samples) # The median of the whole-request time and of each part the app reported in timings_ms, across the samples.
    │       ├── def over_budget(measured, budget) # One line per budgeted part that ran over, or that the app no longer reports (so a budget cannot go quiet).
    │       ├── def run_check(check, fetch_path) # Warms a check up, samples it, and returns (medians, the parts over budget).
    │       └── def main(argv)      # [comment required]
    ├── run_unit_tests.py           # Master CLI runner for behavioral unit and integration test suite.
    └── unit/                       # Dynamic behavioral unit and integration test suite.
        ├── __init__.py             # Module initialization.
        ├── js_loader.mjs           # Zero-dependency Node.js ESM loader and minimal browser environment shim for inSetu unit tests.
        │   └── class MemoryStorage # 1.
        ├── route_auth_probe.py     # Probe helper for test_route_auth_inventory.py: boots inSetu (or the lifeboat) in a throwaway workspace and reports which routes answer without a valid token.
        │   └── def main(mode, out_path) # [comment required]
        ├── test_agent_orchestrator_and_mcp.py # Unit tests for LLM semantic tier routing, declarative YAML routines, /undo rollback, and MCP JSON-RPC.
        │   └── class TestAgentOrchestratorAndMcp(unittest.TestCase) # [comment required]
        ├── test_akasa_db_and_markdown_ast.py # Unit test suite [S4.T1] verifying akasa/db.py 16-DB pool & declarative constraints, MarkdownLanguageProvider, and topology ctx_events.
        │   └── class TestAkasaDbAndMarkdownAst(unittest.TestCase) # Verification suite [S4.T1] gating Sprint 1 task [S1.T0].
        ├── test_attestations.py    # S8: the attestation store holds every standing human approval, refuses machine origins, and is written only by itself.
        │   ├── class TestAttestationStore(_StoreCase) # [stale?] Grant, replace, revoke, expiry, run scope, machine origins refused, and the store refused to the VFS and the bridge.
        │   ├── class TestDispatchersMarkMachineOrigins(_StoreCase) # MCP tool calls run with origin 'mcp' and routines with 'routine', so neither can approve anything.
        │   ├── class TestHookRulesNeedAPersonsApproval(_StoreCase) # [stale?] Saving or enabling a hook approves its exact command; a rule whose command changed, or that a machine saved, never runs.
        │   └── class TestLegacyHostApprovalMigration(_StoreCase) # host.json approvals move into the store once and leave host.json.
        ├── test_bridge_anchor_invariants.py # Regression and fitness tests for patch anchor matching, blank-line fidelity, no-op detection, chunk blame isolation, and the single patch engine.
        │   └── class TestBridgeAnchorInvariants(unittest.TestCase) # [stale?] Regression and fitness tests for patch anchor matching, no-op detection, chunk blame isolation, and the single patch engine.
        ├── test_canonical_uris.py  # Unit tests for canonical URI enforcement, InSetuURI normalization, and legacy ledger migrations.
        │   └── class TestCanonicalURIs(unittest.TestCase) # [comment required]
        ├── test_cartographer_and_bridge_ast.py # Unit tests for Cartographer AST symbol extraction, 3-tier waterfall indexing, and Yomama RELOCATE/RENAME.
        │   └── class TestCartographerAndBridgeAst(unittest.TestCase) # [comment required]
        ├── test_cartographer_file_descriptions.py # Tests that the Cartographer derives file descriptions from docstrings instead of leaving placeholders.
        │   ├── class TestDescribeSourceFile(unittest.TestCase) # describe_source_file derives a description from the file itself (docstrings, leading comments, frontmatter, metadata), never symbol docs.
        │   └── class TestMapRepositoriesFileFallback(unittest.TestCase) # [stale?] map_repositories describes a new file from its docstring when the index has no line for it.
        ├── test_cartographer_index_claim.py # Checks the CODE_INDEX.md claim: the first workspace to map claims the index, a workspace with other rules leaves it alone, matching rules ma...
        │   └── class TestIndexClaim(unittest.TestCase) # may_write_index arbitrates CODE_INDEX.md writes through a claim file in the clone's git directory.
        ├── test_child_env.py       # S3 tests: purposes, credential stripping for repository code, per-repository passthrough, a real env run showing no token or key, preview's...
        │   ├── class TestChildEnvPurposes(_EnvCase) # Who chose the command decides what it inherits.
        │   ├── class TestRepositoryProcesses(_EnvCase) # Preview servers and test runners use repo_code, and a real child sees neither the token nor a key.
        │   └── class TestChildEnvAndFetchRules(unittest.TestCase) # [stale?] CHILD_ENV_MANDATE, OUTBOUND_FETCH_MANDATE and REMOTE_CODE_URL_BAN flag the raw patterns outside their homes.
        ├── test_codemirror_bundle.py # Genesis unit test suite verifying the CodeMirror bundle manifest, absence of stale files or CDN specifiers, and Node.js parser execution acr...
        │   └── class TestCodeMirrorBundle(unittest.TestCase) # [stale?] Every file in static/vendor/codemirror/ is accounted for, free of CDN shims, and parses samples in Node.
        ├── test_config_cascade.py  # Unit tests for the 3-tier configuration cascade, secret encryption, and lazy migration.
        │   └── class TestConfigurationCascade(unittest.TestCase) # [comment required]
        ├── test_context_part_packing.py # Tests that a context block too large for one part is split across consecutive parts nothing else interrupts, within the byte limit.
        │   └── class TestContextPartPacking(unittest.TestCase) # Split blocks read back whole from consecutive parts, within the byte limit.
        ├── test_dag_fault_quarantine.py # Behavioral unit tests verifying Two-Tier DAG-Aware Fault Quarantine across Tier 2 Core modules and Tier 3 extensions.
        │   └── class TestDagFaultQuarantine(unittest.TestCase) # [stale?] Verifies that a fault in a non-foundational Core module or Tier 3 extension quarantines only its DAG dependents.
        ├── test_dev_exec_exposure.py # Tests that MCP neither lists nor calls dev.exec and that routines cannot use it.
        │   └── class TestDevExecExposure(unittest.TestCase) # MCP neither lists nor calls dev.exec, and routines cannot use it.
        ├── test_directives.py      # New test suite verifying 4-tier directive assembly, acceptance logic, and protected target configuration.
        │   └── class TestDirectivesAndAcceptance(unittest.TestCase) # [stale?] Verifies 4-tier directive assembly, attestation acceptance, route guards, and S8 VFS protection.
        ├── test_editor_vendorize.py # S4 tests: bundled and local language descriptors resolve, local entries cannot shadow bundled ids, unknown packs are not downloaded, and invalid names are refused.
        │   └── class TestEditorVendorize(unittest.TestCase) # [stale?] Bundled and local descriptors resolve; local entries cannot shadow bundled ids; unknown packs are not downloaded; invalid names are refused.
        ├── test_ext_preview_unit.py # Unittest suite for passive framework detection and preview server lifecycle.
        │   └── class TestExtPreviewUnit(unittest.TestCase) # [comment required]
        ├── test_fallback_bridge.py # Unit tests for the Lifeboat recovery bridge block parser, genesis patches, and recovery endpoints.
        │   └── class TestFallbackBridge(unittest.TestCase) # [comment required]
        ├── test_forwarded_header_rule.py # Tests the FORWARDED_HEADER_MEMBRANE fitness rule that keeps forwarding-header reads in akasa.
        │   └── class TestForwardedHeaderMembraneRule(unittest.TestCase) # S1: inSetu never reads client-identity forwarding headers; akasa's classify_peer() is the single source of truth.
        ├── test_git_diff_sieve.py  # New: the anchored vendor pattern, name rules at any depth, extensions, exceptions and force-includes apply to diffs as they do to topology.
        │   └── class TestDiffsFollowTheSieve(unittest.TestCase) # [stale?] Anchored ignore patterns, exceptions, force-includes and extensions apply to diffs exactly as to topology.
        ├── test_import_order.py    # Ensures every core entry point imports first in a fresh interpreter (sdk/utils_core cycle).
        │   └── class TestImportOrder(unittest.TestCase) # Every core entry point must import cleanly as the FIRST insetu import of a fresh interpreter (sdk <-> utils_core cycle).
        ├── test_js_behavioral_units.py # Behavioral unit tests executing real frontend ES modules (insetu_sdk.js, ui_file_tree.js, fs.js, bridge.js) in Node via js_loader.mjs withou...
        │   └── class TestJsBehavioralUnits(unittest.TestCase) # [stale?] Executes real inSetu frontend ES modules in Node.js to verify URI, file tree, manifest, and Bridge state machines.
        ├── test_lifeboat_auth.py   # S8: the lifeboat shares the app's durable token, checks Host, and keeps reads and writes inside the workspace.
        │   ├── class TestLifeboatCredentials(_LifeboatCase) # The lifeboat accepts the app's durable session token, so a signed-in phone keeps working after a crash.
        │   ├── class TestLifeboatHostCheck(_LifeboatCase) # DNS-rebinding guard: loopback, *.ts.net and configured hosts only.
        │   └── class TestLifeboatReadContainment(_LifeboatCase) # /download and /api/fs/list stay inside the workspace, follow symlinks, and never expose the credential store.
        ├── test_lifeboat_targets.py # The lifeboat resolves vfs:// patch targets like the main bridge and never writes outside the workspace.
        │   └── class TestLifeboatTargets(unittest.TestCase) # [stale?] The lifeboat resolves vfs:// patch targets like the main bridge and never writes outside the workspace.
        ├── test_lit_template_rules.py # Tests that Lit ${...} bindings are stripped before sutram-btn label matching.
        │   └── class TestLitTemplateRuleHelpers(unittest.TestCase) # The sutram-btn label rule must not mistake '=>' inside a Lit binding for the end of the tag.
        ├── test_llm_pool_precedence.py # Tests LLM routing precedence: saved pool, then explicit legacy settings, then the default pool.
        │   └── class TestLlmPoolPrecedence(unittest.TestCase) # [stale?] Routing precedence: saved pool/profiles, then explicitly saved legacy settings, then the schema's default pool.
        ├── test_macro_escapes.py   # Tests that transport macros expand in files documenting them, literal tokens via brace macros, and lifeboat parity.
        │   └── class TestMacroEscapes(unittest.TestCase) # The namespaced transport macro always expands, even in files that document it, and both bridges agree.
        ├── test_offline_resilience.py # Behavioral and contract unit tests for Sutram Offline Micro-Kernel resilience and host policy inversion.
        │   └── class TestOfflineResilienceContracts(unittest.TestCase) # [stale?] Verifies offline boot invariants across system.js, api.js, index.html, and executes Sutram offline kernel in Node.js.
        ├── test_outbound_fetch.py  # S4 tests: schemes, private and metadata addresses, person-allowed hosts, redirects into private addresses or other schemes, the connected-ad...
        │   ├── class TestOutboundFetch(unittest.TestCase) # [stale?] fetch_url() against a local server: schemes, address policy, redirects, caps and error bodies.
        │   └── class TestIngestUsesThePolicy(unittest.TestCase) # Ingest refuses file:// and private hosts in both parser modes, unless a person allowed the host.
        ├── test_parallel_logic_parity.py # Parallel Python and JavaScript logic: every pair registered in tests/parity/ runs its shared cases through both implementations.
        │   ├── def load_pairs()    # Reads every registry entry in tests/parity/, keeping its file name for messages.
        │   ├── def resolve_python(spec) # Resolves "module:attr.path" to the Python callable it names.
        │   ├── def python_merge_adapter(fn, args) # Maps (base, disk, incoming) -> (clean, merged) onto {clean, merged}.
        │   ├── def run_javascript(jobs) # Runs every job's inputs through its JavaScript implementation in one Node process.
        │   ├── def matches(expect, actual) # A dict expectation names only the keys that must match; anything else must be equal.
        │   ├── def random_merge_inputs(seed, count) # Seeded small three-way inputs: a base of up to six short lines and two sides with one to three line edits each.
        │   ├── def wide_merge_inputs(seed, count) # Seeded harder three-way inputs: files of up to 200 lines mixing distinct and repeated lines, block edits, duplicated and swapped lines, one...
        │   ├── def differential_inputs(entry) # The seeded random inputs an entry's differential block asks for.
        │   ├── class TestParallelLogicRegistry(unittest.TestCase) # The registry itself: complete entries whose named definitions exist on both sides.
        │   └── class TestParallelLogicCases(unittest.TestCase) # [stale?] The shared cases, run through both implementations.
        ├── test_perf_check.py      # Checks the performance check's logic: medians per part, budget comparison, a budgeted part that is no longer reported, warm-ups not counted,...
        │   └── class TestPerfCheck(unittest.TestCase) # perf_check compares the median of each reported part to its budget.
        ├── test_preview_exposure.py # S2: preview servers bind loopback, open to the LAN only on a person's lease, and run custom commands only once approved.
        │   ├── class TestLoopbackByDefault(_PreviewCase) # Nothing binds beyond loopback unless a person opens it, and auto-start never does.
        │   ├── class TestLanLease(_PreviewCase) # [stale?] A LAN lease needs the repository's permission, and a timed lease falls back to loopback by itself.
        │   ├── class TestLanLeaseInTheAttestationStore(_PreviewCase) # [stale?] Leases live in the store: timed ones survive a restart, run ones end with the run, a changed launch ends them.
        │   ├── class TestCustomCommandApproval(_PreviewCase) # [stale?] Custom commands run only after a person approves that exact command for that repository.
        │   └── class TestServerHardening(_PreviewCase) # The static server hides dotfiles and symlink escapes, sends CORS only on request, and marimo always has a token.
        ├── test_protected_changes.py # S8: a change to a protected file waits as a pending change until a person confirms exactly what they reviewed.
        │   ├── def cli_source(label) # A small but working cli.py: the smoke test imports it and runs `insetu --help`.
        │   ├── class TestProposals(_ProtectedCase) # Machine saves and deletes wait and write nothing; moves, recovery-file deletes and insetu's own records are refused.
        │   ├── class TestConfirmation(_ProtectedCase) # Only a person confirms, only the reviewed content, and only against an unchanged file.
        │   ├── class TestWritersSeeTheHold(_ProtectedCase) # A person's editor save is checked and written; MCP saves and bridge patches come back as pending.
        │   └── class TestProtectedWriteChokepoint(unittest.TestCase) # [stale?] PROTECTED_WRITE_CHOKEPOINT: only the two homes write past the guard or set the policy.
        ├── test_publish_extension.py # Unit tests for document publishing compilation and ephemeral wordcount macro stripping.
        │   └── class TestPublishExtension(unittest.TestCase) # [comment required]
        ├── test_python_version_floor_rule.py # Checks the Python version floor rule: the f-string forms only Python 3.12 accepts, newer-only statements and standard-library names, guarded...
        │   └── class TestPythonVersionFloorRule(unittest.TestCase) # PYTHON_VERSION_FLOOR finds newer-only syntax and standard-library names from any Python version.
        ├── test_recovery_path.py   # Test the smoke tests, the last-good lifeboat and credential store, the panic fallback and auth rotate
        │   ├── class TestRecoveryChecks(unittest.TestCase) # insetu/recovery_check.py passes the shipped recovery files and fails broken versions of each.
        │   ├── class TestConfirmingRecoveryFiles(_ProtectedCase) # Confirmed changes and editor saves to recovery files run the smoke test; the lifeboat keeps a last-good copy.
        │   ├── class TestPanicFallback(unittest.TestCase) # When the current lifeboat will not import, the panic path boots the last-good copy.
        │   └── class TestAuthRotate(unittest.TestCase) # insetu auth rotate replaces the token and prints it once.
        ├── test_remote_identity.py # Tests whois-verified Tailscale identity, bootstrap integration, settings migration, and allowed hosts.
        │   ├── class TestTailscaleIdentityProvider(unittest.TestCase) # S1: Route B authenticates Tailscale devices only after whois verification of the trusted client IP.
        │   ├── class TestRemoteBootstrapIntegration(unittest.TestCase) # [stale?] S1 end to end: akasa's /auth/bootstrap plus the insetu Tailscale provider and Host gate.
        │   └── class TestRemoteSettingsLifecycle(unittest.TestCase) # [stale?] Settings migration from the retired 'tailscale' extension, configured hosts, and the preview helper.
        ├── test_repeater_secret_scopes.py # Tests that repeater secrets are read only from their own scope, so one workspace never reads another's, and that the scope must be stated.
        │   └── class TestRepeaterSecretScopes(unittest.TestCase) # A secret is read only from where its scope writes it, so one workspace never sees another's.
        ├── test_repo_landmarks.py  # Genesis unit test suite verifying Sprint 1 (landmarks discovery on insetu/akasa layouts, overrides, local precedence, path confinement, unde...
        │   └── class TestRepoLandmarks(unittest.TestCase) # [stale?] Landmarks resolve from discovery and repo settings within the repository, and optional includes follow extension state.
        ├── test_route_auth_inventory.py # V4: every HTTP route needs the token unless it is on a reviewed public list, in the app and in the lifeboat.
        │   ├── class TestAppRouteAuthInventory(_InventoryCase) # The main app: one token gate in front of every route, with a short reviewed public list.
        │   └── class TestLifeboatRouteAuthInventory(_InventoryCase) # The lifeboat: the same rules, because it listens on the port Tailscale exposes.
        ├── test_routine_check.py   # The routine check reports prompts that do not resolve, and a run stops on a missing prompt instead of sending an empty one.
        │   ├── class TestRoutineCheck(unittest.TestCase) # check_routine mirrors how a run resolves each LLM step's prompt.
        │   ├── class TestCascadeReportsWhereItFoundAPrompt(unittest.TestCase) # read_prompt_with_cascade tells the check whether a prompt was found directly or only by file name.
        │   └── class TestAMissingPromptStopsTheRun(unittest.TestCase) # require_prompt_text turns a prompt that did not resolve into an error naming the routine and URI.
        ├── test_routine_check_cache.py # Checks that the routine check's results are reused between listings, are safe from callers' edits, and are checked again after a prompt or r...
        │   └── class TestRoutineProblemsCache(unittest.TestCase) # attach_routine_problems checks a routine once, then reuses the result until something it depends on changes.
        ├── test_routine_parse_cache.py # Checks that a routine's text is parsed once, that callers cannot change what the next caller gets, that edited text or a different fallback...
        │   └── class TestRoutineParseCache(unittest.TestCase) # parse_routine_content parses each distinct routine text once and never shares a parsed object between callers.
        ├── test_routine_response_path.py # Tests that routine response_path writes only document files and refuses code targets.
        │   └── class TestRoutineResponsePath(unittest.TestCase) # A routine's response_path writes documents directly; code targets must go through bridge.sync.
        ├── test_sdk_improvements.py # Unit tests for ctx.create_entity_file, declarative volume migrations, and worker contract fitness rules.
        │   └── class TestSdkImprovements(unittest.TestCase) # [comment required]
        ├── test_settings_scope_rule.py # Tests that SETTINGS_SCOPE_MANDATE skips nested item_schema and fields sub-fields.
        │   └── class TestSettingsScopeRule(unittest.TestCase) # SETTINGS_SCOPE_MANDATE applies to top-level setting fields only; nested sub-fields inherit their parent's scope.
        ├── test_step_timer.py      # Checks the step timer: each mark gets the time since the previous one, repeated steps add up, and nested marks are attributed inside out.
        │   └── class TestStepTimer(unittest.TestCase) # StepTimer attributes the time since the previous mark to the named step and passes the step's value through.
        ├── test_sutram_compliance.py # Unit tests verifying Sutram consumer linter and JavaScript fitness compliance across core and extensions.
        │   └── class TestSutramCompliance(unittest.TestCase) # [stale?] Executes Sutram's official consumer linter and inSetu's JavaScript fitness rules against inSetu core UI components and domain extensions to...
        ├── test_test_command_approval.py # P5 tests: no self-approval, approvals per workspace and repo, approval hidden from MCP and banned in routines.
        │   ├── class TestNoSelfApproval(unittest.TestCase) # The run paths take no approval flag, so whoever asks for a command cannot also approve it.
        │   ├── class TestApprovalRecord(unittest.TestCase) # [stale?] Approvals are recorded per workspace and repository, and checking never records one.
        │   └── class TestApprovalStaysHuman(unittest.TestCase) # The approval route exists for people, and is unreachable from MCP and routines.
        ├── test_topology_manifest_freshness.py # Tests that incremental topology events honor .gitignore and that manifest caches never keep pre-commit state.
        │   ├── class TestIncrementalEventsHonorGitignore(_WorkspaceCase) # [stale?] Watcher events for git-ignored files stay out of the ledger, as they do in a full scan.
        │   └── class TestManifestCachesSeeCommittedState(_WorkspaceCase) # A read that lands between a writer's invalidation and its commit must not pin stale data in the 2 s cache.
        ├── test_vendor_lock.py     # Tests sutram.lock.json and codemirror.lock.json provenance, stale-file pruning, drift detection, and the committed vendor trees.
        │   └── class TestVendorLock(unittest.TestCase) # [stale?] sutram.lock.json and codemirror.lock.json record vendored builds and catch drift between the locks and the committed files.
        ├── test_vfs_three_way_merge.py # Unit tests for 3-way OCC text merging, ancestor ring buffers, and conflict fallback files.
        │   └── class TestVfsThreeWayMerge(unittest.TestCase) # [comment required]
        ├── test_wave1_ratchets.py  # Wave 1 line-count ratchets and re-export contract tests for the System & Core Utils decomposition.
        │   └── class TestWave1Ratchets(unittest.TestCase) # [stale?] Enforces Wave 1 file-size ceilings and re-export contracts across Python and JavaScript.
        ├── test_workspace_extension_approval.py # Tests that .insetu/extensions/ code loads and is served only while its files match a person's approval, and that only a person can approve.
        │   └── class TestWorkspaceExtensionApproval(unittest.TestCase) # [stale?] Only approved, unchanged workspace extensions are imported or served; only a person approves.
        ├── test_workspace_mounts.py # Unit tests for InterWorkspaceVFSDriver, ws:// read-only write barriers, and cross-workspace event broadcasting.
        │   └── class TestWorkspaceMounts(unittest.TestCase) # [comment required]
        └── test_workspace_swap_fsm.py # Behavioral unit tests for the synchronous workspace swap FSM and Bound-Scope StoreRegistry hydration.
            └── class TestWorkspaceSwapFSM(unittest.TestCase) # [stale?] Behavioral and structural unit tests for the Synchronous Workspace Swap FSM: - Pattern 1: Bound-Scope Store Persistence (_boundScope, _scope...
```
