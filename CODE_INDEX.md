# inSetu Developer OS Code Index

This index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.

```text
insetu/
├── .gitkeep                        # Git folder retention.
├── CHANGELOG.md                    # Auto-generated semantic release changelog.
├── CODE_INDEX.md                   # Topological map of the inSetu repository (this file).
├── README.md                       # Primary project overview, architecture, and installation guide.
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
│   └── adrs/                       # Architectural Decision Records.
│       ├── 0061-polymorphic-bulk-entity-actions-subsumption-pruning-and-recursive-vfs-eviction.md # Polymorphic bulk entity actions, subsumption pruning, and recursive VFS eviction.
│       ├── 0062-projection-popouts-occ-concurrency-and-memoized-manifest-cqrs.md # Ephemeral pop-out windows, SHA-256 OCC conflict detection, and memoized manifest derivations.
│       ├── 0063-atomic-vfs-bulk-mutations-popout-presence-and-sw-consolidation.md # Atomic VFS bulk mutations, popout presence heartbeat, and Service Worker consolidation.
│       ├── 0064-core-prompt-engine-virtual-module-templates-and-job-api-unification.md # Core prompt engine graduation, virtual module template projection, and Akasa job API unification.
│       ├── 0065-repository-data-containment-extension-state-hydration-and-security-hardening.md # Repository data containment (.insetu-data/), dual-scope notes migration, and cryptographic hook gating.
│       ├── 0066-canonical-uris-inter-workspace-mounts-and-config-cascade-hardening.md # Canonical scheme:// URIs, inter-workspace ws:// mounts, and 3-tier configuration cascade hardening.
│       ├── 0067-universal-extension-suite-modernization-and-domain-mounts.md # Universal extension suite modernization, declarative domain mounts, and SDK standardization.
│       ├── 0068-hierarchical-vfs-sieve-sub-bucket-filtering-and-settings-hub.md # Hierarchical VFS sieve, .gitignore sub-bucket filtering, and unified OS Settings Hub.
│       ├── 0069-managed-app-server-preview-bulk-vcs-and-memory-telemetry.md # Managed dev server preview supervisor, bulk Git VCS actions, and kernel memory telemetry.
│       ├── 0070-akasa-kernel-lifecycle-encapsulation-and-lifeboat-resilience.md # Akasa kernel lifecycle encapsulation, 4-file membrane isolation, and Lifeboat FS resilience.
│       ├── 0071-synchronous-workspace-swap-fsm-three-way-occ-and-declarative-volumes.md # Synchronous workspace swap FSM, 3-way OCC text merging, and declarative volume mounts.
│       ├── 0072-core-pipeline-akasa-membrane-declarative-volumes-and-jit-healing.md # Core pipeline Akasa membrane decoupling, declarative volumes, and JIT artifact healing.
│       ├── 0073-devops-extension-suite-membrane-decoupling-and-declarative-diff-volumes.md # DevOps extension suite membrane decoupling and declarative diff volume mounts.
│       ├── 0074-knowledge-suite-membrane-decoupling-declarative-volumes-and-substack-publishing.md # Knowledge suite membrane decoupling, declarative volumes, and Substack HTML snippet publishing.
│       ├── 0075-workflow-management-suite-membrane-decoupling-declarative-flow-volumes-and-tracker-hub-embedding.md # Workflow management suite membrane decoupling, declarative flow volumes, and tracker settings hub embedding.
│       ├── 0076-dual-representation-macro-preview-dependency-whitelisting-and-tier2-membrane-decoupling.md # Dual-representation macro preview, dependency whitelisting, and Tier 2 membrane decoupling.
│       ├── 0077-devops-suite-flask-decoupling-typed-workers-and-canonical-routing.md # DevOps extension suite Flask transport decoupling, typed workers, and canonical routing.
│       ├── 0078-knowledge-suite-flask-decoupling-typed-workers-and-canonical-routing.md # Knowledge extension suite Flask transport decoupling, typed workers, and canonical routing.
│       ├── 0079-workflow-management-suite-flask-decoupling-typed-workers-and-canonical-routing.md # Workflow management suite Flask transport decoupling, typed workers, and canonical routing.
│       ├── 0080-mcp-server-declarative-agent-routines-and-ast-refactoring.md # ADR 0080: Model Context Protocol (MCP) Gateway, Declarative Agent Orchestration Routines, AST-Aware Refactoring Primitives, and Recovery Tok...
│       ├── 0081-relational-watermark-derivation-mcp-stdio-bridge-and-reboot-polling-resilience.md # ADR 0081: Reactive Relational Watermark Derivation, MCP Stdio CLI Bridge, AST Refactoring Directives, and Reboot Resilience
│       ├── 0082-yomama-multi-surface-shell-deferred-chunk-healing-and-openai-compatible-gateway.md # ADR 0082: Yomama Multi-Surface Shell Architecture, Deferred Post-Valid Chunk Auto-Healing, OpenAI-Compatible Local Inference Gateway, and Co...
│       ├── 0083-compute-endpoint-pools-cognitive-profiles-markdown-routines-and-yomama-v4-directives.md # ADR 0083: Universal Compute Endpoint Pools, Cognitive Configuration Profiles, Markdown-as-Code Agent Routines, and Yomama Patch Protocol v4...
│       ├── 0084-ast-symbol-drift-watermarks-template-overlay-driver-and-topology-upkeep-audit.md # ADR 0084: AST Symbol Drift Watermarks, Template Overlay VFS Driver Delegation, and Topology Upkeep Audit Substrate
│       ├── 0085-single-file-frontend-membrane-schema-repeaters-and-universal-secret-vaulting.md # ADR 0085: Single-File Frontend Membrane Isolation, Declarative Schema Repeaters, and Universal Repeater Secret Vaulting
│       ├── 0086-git-diff-capabilities-autonomous-routines-and-tailscale-extension-retirement.md # ADR 0086: Git Diff Capabilities, Autonomous Routines, Tailscale Extension Retirement, and Single-File Membrane Compliance
│       ├── 0087-flow-extension-decommissioning-tracker-schema-repeaters-and-hooks-bridge-protection.md # ADR 0087: Flow Extension Decommissioning, Tracker Settings Repeater Migration, and Hooks Bridge Path Protection
│       ├── 0088-stack-ci-battery-single-file-sdk-membrane-vendor-locking-and-whois-remote-identity.md # ADR 0088: Callosemic Stack CI Battery, Single-File SDK Membrane, Vendored Substrate Provenance Locking, and Whois Remote Identity Verificati...
│       ├── 0089-dynamic-code-context-scouting-web-chat-handoff-composer-and-cognitive-target-bindings.md # ADR 0089: Dynamic /code Context Scouting, Interactive Web-Chat Handoff Composer, Yomama Patch Splitting, and Cognitive Profile Target Bindin...
│       ├── 0090-decoupled-llm-target-resolution-reentrant-routine-handoff-and-raw-transcript-preservation.md # ADR 0090: Decoupled LLM Target Resolution, Reentrant Routine Handoff Propagation, and Raw Transcript History Preservation
│       ├── archived/               # Superseded and historical ADR documents.
│       │   ├── 0001-insetu-genesis-and-extension-architecture.md # Original inSetu extraction and extension architecture genesis.
│       │   ├── 0002-workspace-physics-and-extensions.md # Defines the tenant workspace boundaries and extension loading.
│       │   ├── 0003-stateless-multi-tenant-routing.md # Initial stateless request-scoped multi-tenant REST routing setup.
│       │   ├── 0004-asynchronous-vfs-commit-pipeline.md # Defines the non-blocking VFS write queue and thread safety.
│       │   ├── 0005-transport-shell-decoupling.md # Decoupling of HTTP transport shell from pure domain logic.
│       │   ├── 0006-tenant-isolated-compilation-locks.md # Defines thread-local locks for RAG payload compilations.
│       │   ├── 0007-stateless-ui-factory-and-component-decoupling.md # UI decoupling from business logic via Zustand UDF.
│       │   ├── 0008-offline-first-synchronization.md # Offline capabilities and Service Worker caching.
│       │   ├── 0009-ephemeral-artifacts-and-immediate-jobs-ledger.md # Management of short-lived job artifacts and garbage collection.
│       │   ├── 0010-vfs-boundary-exemptions.md # Rules for paths exempt from strict VFS isolation.
│       │   ├── 0011-vfs-barrier-synchronization.md # Synchronization barriers for asynchronous VFS flushes.
│       │   ├── 0012-extension-subdirectory-extraction.md # Extraction of domain extensions into isolated subdirectories.
│       │   ├── 0013-posix-compliant-pathlib-migration.md # Standardization on POSIX paths for cross-platform parity.
│       │   ├── 0014-event-bus-tenant-authorization.md # Authorization rules for cross-tenant event bus emissions.
│       │   ├── 0015-codemirror6-migration.md # Transition from legacy editors to CodeMirror 6.
│       │   ├── 0016-explicit-api-client-and-fetch-deprecation.md # Mandates the use of the centralized inSetu API client.
│       │   ├── 0017-extension-sdk-and-pit-of-success.md # Defines the InSetuExtension and InSetuElement base classes.
│       │   ├── 0018-event-sourced-vfs-ledger.md # SQLite event sourcing for VFS mutations and Watchdog events.
│       │   ├── 0021_standardized_state_isolation.md # Unidirectional Data Flow and tenant state isolation.
│       │   ├── 0022-differential-context-compilation.md # Surgical updates to RAG contexts avoiding full recompilation.
│       │   ├── 0023-polymorphic-entity-action-card-registry.md # Dynamic context-aware actions for UI entity cards.
│       │   ├── 0024-frontend-sdk-decoupling-and-domain-accessors.md # Front-end SDK abstraction (this.vfs, this.sys, this.editor).
│       │   ├── 0025-declarative-app-shell-and-brokered-resource-management.md # Declarative UI layout definitions and slot brokering.
│       │   ├── 0026-unified-token-gatehouse-and-tailscale-auth.md # Centralized REST/WebSocket authentication and Tailscale WHOIS.
│       │   ├── 0027-global-multi-select-and-batch-action-registry.md # Global UI selection tray and batch action execution.
│       │   ├── 0028-native-hash-routing-and-event-bus.md # Zero-bundler SPA routing using URL hashes.
│       │   ├── 0029-core-kernel-extraction-and-three-tier-architecture.md # Separation of Kernel, Core OS, and Domain Extensions.
│       │   ├── 0030-kernel-utility-bisect-and-domain-relocation.md # Decoupling kernel utilities from core OS domains.
│       │   ├── 0031-sutram-micro-kernel-vendorization-and-vfs-ledger-unification.md # Vendorizing Sutram and merging VFS tracking ledgers.
│       │   ├── 0032-dynamic-polyglot-vendorization-and-importmap-resolution.md # Import map strategies for offline-first vendor libraries.
│       │   ├── 0034-async-job-action-binding-and-gather-decoupling.md # Binding UI actions directly to background polling jobs.
│       │   ├── 0035-vfs-file-resolution-hooks-and-topology-gateway.md # Centralized resolution of logical vfs:// and ctx:// paths.
│       │   ├── 0036-vfs-manifest-sqlite-cqrs-and-delta-sync.md # Moving manifest indexing from JSON to SQLite CQRS.
│       │   ├── 0037-gather-inversion-of-control-topology.md # Inverting context assembly dependencies to Cartographer.
│       │   ├── 0038-decoupled-topology-engine-partitioned-manifest-two-stage-slew-limiting.md # Stage 1 (VFS) and Stage 2 (CTX) slew limiters.
│       │   ├── 0039-decentralized-manifest-signature-sync-and-topology-boot.md # Syncing manifest signatures statelessly on UI boot.
│       │   ├── 0041-deprecation-of-ui-zones-and-presentation-decoupling.md # Deprecation of UI zones and presentation decoupling.
│       │   ├── 0042-vfs-logical-uri-boundary-standardization-and-path-heuristic-purge.md # Standardized vfs:// logical URI boundaries and purged legacy path heuristics.
│       │   ├── 0043-client-offline-provider-and-offline-engine.md # Client offline provider, SW core vendorization, and outbox reconciliation.
│       │   ├── 0044-ruamel-yaml-frontmatter-parsing-and-uri-event-canonicalization.md # Round-trip YAML frontmatter parsing and canonical vfs:// event normalization.
│       │   ├── 0045-two-pass-deterministic-boot-sequence.md # Two-pass deterministic boot sequence bisecting spatial discovery and deferred mutation.
│       │   ├── 0046-unified-watchdog-debouncer-and-manifest-caching.md # Unified Watchdog debouncer, pre-I/O intent capture, and thread-local manifest caching.
│       │   ├── 0047-queued-event-barrier-sentinel-vfs-synchronization.md # Queued event-driven barrier sentinel for exact VFS write watermark synchronization.
│       │   ├── 0048-akasa-kernel-package-extraction-and-insetu-uri-wrapper.md # Extraction of Tier 1 Kernel into standalone 'akasa' package and InSetuURI domain wrapper.
│       │   ├── 0049-sse-telemetry-pipeline-ram-slew-limiter-and-on-demand-context-compilation.md # Real-time SSE telemetry pipeline, Stage 1 RAM queue slew limiting, and on-demand context compilation.
│       │   ├── 0050-openapi-spec-gateway-universal-binary-execution-and-workspace-event-routing.md # Real-time OpenAPI 3.0 spec gateway, universal binary execution wrapper, and multi-tenant workspace event routing.
│       │   ├── 0051-generic-dag-compilation-chain-resolution-and-step-anchoring.md # Generic Akasa DAG compilation chain resolution, positional step anchoring, and Watchdog manifest exclusion.
│       │   ├── 0052-polymorphic-uri-coercion-bucket-address-refinement-and-sse-step-telemetry.md # Polymorphic InSetuURI coercion, BucketAddress SSOT refinement, and un-blocked SSE step telemetry.
│       │   ├── 0053-git-state-resolution-autostash-pulls-and-non-fast-forward-resilience.md # Git rebase/merge state resolution, autostash pulls, and multi-repo sweep isolation.
│       │   ├── 0054-multi-column-viewport-projections-and-virtual-buffer-editing.md # Multi-column viewport projections and virtual buffer editing.
│       │   ├── 0055-vfs-parity-action-middleware-and-singleton-modal-deprecation.md # VFS parity gatekeeper action middleware, singleton file modal deprecation, and InSetuURI coercion hooks.
│       │   ├── 0056-system-sdk-module-renaming-spatial-grid-routing-and-syntax-fallback.md # System SDK module renaming, spatial grid routing, and Tree-Sitter syntax fallback.
│       │   ├── 0057-workspace-swap-layout-eviction-and-yv-icon-migration.md # Pre-swap layout eviction, yv-icon migration, and primitive alias purge.
│       │   ├── 0058-universal-llm-gateway-react-agent-harness-and-vfs-modal-projection-decoupling.md # Universal LLM gateway, autonomous ReAct agent harness, and spatial VFS projections.
│       │   ├── 0059-extension-modal-annihilation-spatial-projection-migration-and-store-eviction.md # Extension modal annihilation, spatial viewport projections, and store eviction governance.
│       │   └── 0060-git-aware-topology-manifest-sync-and-spatial-diff-projections.md # Git-aware topology CQRS ledger, real-time manifest delta sync, and spatial diff projections.
│       └── superseded/             # Archived and superseded architectural decision records.
│           ├── .gitkeep            # Git folder retention.
│           ├── 0033-kernel-package-encapsulation-and-root-wrapper-cleanup.md # Moving kernel dependencies to isolated packages (akasa).
│           └── 0040-system-configuration-ssot-and-multi-scoped-settings.md # Centralized settings schema definition and hierarchical scope isolation (daemon, workspace, repo).
├── insetu/                         # Python application package.
│   ├── .gitkeep                    # Git folder retention.
│   ├── app.py                      # [Micro-Kernel & Extension Bootloader]
│   │   ├── def load_workspace_extensions() # [comment required]
│   │   ├── def parse_semver(v_str) # Converts a SemVer string into a comparable integer tuple (major, minor, patch).
│   │   ├── def eval_single_clause(v_tuple, clause) # Evaluates a single comparison clause against a version tuple.
│   │   ├── def satisfies_range(version_str, range_str) # Evaluates compound range expressions (e.g., '>=5.0.0 && <6.0.0').
│   │   ├── def resolve_python_vendors(active_exts) # Statelessly scans core and extension vendor.json manifests to resolve and inject Python dependencies.
│   │   ├── def resolve_js_vendors(active_exts) # Resolves and builds the JS import map for the frontend bootloader statelessly.
│   │   ├── def serve_extension_static(ext_name, filename) # Serves static assets and vendored dependencies directly from an extension directory.
│   │   ├── def serve_extension_js(ext_name) # ADR 0012: Dynamically serve frontend JS from the bundled extension subdirectory.
│   │   ├── def sw()                # [comment required]
│   │   ├── def root_readme()       # [comment required]
│   │   ├── def manifest()          # [comment required]
│   │   ├── def intercept_local_static_assets() # Intercepts standard static asset routing routes before Flask's native static file engine serves them, checking the local environment first.
│   │   ├── def favicon()           # [comment required]
│   │   ├── def api_system_panic()  # Hard reboot of the OS process, setting the simulated panic flag.
│   │   ├── def recovery_ui()       # Zero-JS escape hatch in case the frontend bundle is completely bricked.
│   │   ├── def index()             # [comment required]
│   │   ├── def inject_bypassed_extensions(cfg, workspace_id, **kwargs) # [comment required]
│   │   └── def run_app()           # [comment required]
│   ├── cli.py                      # [Daemon & Process Management]
│   │   ├── def scaffold_profiles(cwd) # Minimal zero-dependency profile bootstrapper for the Immutable Recovery Bootloader.
│   │   └── def main()              # [comment required]
│   ├── core/                       # Core frontend SDK and UI components.
│   │   ├── __init__.py             # Module initialization.
│   │   ├── agent/                  # Autonomous ReAct agent harness and streaming chat interface.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── agent.js            # Agent chat streaming UI, turn history, and session management.
│   │   │   │   ├── class InSetuCoreAgentSessions # [comment required]
│   │   │   │   ├── function classifyRoutineTargetUri(rawInc) # [comment required]
│   │   │   │   ├── class InSetuAgentRoutineProjection # [comment required]
│   │   │   │   ├── class InSetuCoreAgentRoutines # [comment required]
│   │   │   │   └── class InSetuCoreAgent # [comment required]
│   │   │   ├── engine_agent.py     # ReAct agent execution loop, prompt packing, and self-healing patch retry logic.
│   │   │   │   ├── class ChatSessionPayload(TypedDict) # Request schema for creating a new chat session.
│   │   │   │   ├── class ChatPromptPayload(TypedDict) # [stale?] Request schema for submitting a prompt or routine turn.
│   │   │   │   ├── class AgentSessionActionPayload(TypedDict) # Request schema for cancelling or undoing an agent turn.
│   │   │   │   ├── def get_routines(ctx) # Lists all available declarative Markdown-as-Code and YAML routines with context options.
│   │   │   │   ├── class RoutineSavePayload(TypedDict) # Request schema for saving or forking a declarative routine.
│   │   │   │   ├── def api_save_routine(ctx) # Validates and saves a declarative routine in ctx://routines/.
│   │   │   │   ├── class RoutineDeletePayload(TypedDict) # Request schema for deleting a routine override.
│   │   │   │   ├── def api_delete_routine(ctx) # Deletes a workspace or user-template routine override.
│   │   │   │   ├── class EnsurePlanFilePayload(TypedDict) # Request schema for resolving or creating a Markdown plan file.
│   │   │   │   ├── def api_ensure_plan_file(ctx) # Resolves or creates a canonical Markdown plan file URI for /plan.
│   │   │   │   ├── class ResolveTestCommandPayload(TypedDict) # Request schema for resolving a repository test command.
│   │   │   │   ├── def api_resolve_test_command(ctx) # Inspects repository files to determine the appropriate test runner command.
│   │   │   │   ├── class AgentRunTestPayload(TypedDict) # Request schema for executing an approved repository test command.
│   │   │   │   ├── def api_agent_run_test(ctx) # Executes an approved repository test command with shell=False.
│   │   │   │   ├── def get_sessions(ctx) # Retrieves all chat sessions for the active workspace.
│   │   │   │   ├── def create_session(ctx) # Creates a new chat session record in SQLite.
│   │   │   │   ├── def get_messages(ctx, session_id) # Retrieves chronological message history for a chat session.
│   │   │   │   ├── def cancel_agent_turn(ctx) # Signals an active agent turn to abort before the next LLM or VFS step.
│   │   │   │   ├── def undo_last_agent_turn(ctx) # Reverts the most recent Yomama Bridge transaction for the session.
│   │   │   │   └── def submit_prompt(ctx) # [stale?] Dispatches a user prompt or colon-scoped slash routine into the agent worker.
│   │   │   ├── orchestrator.py     # Declarative YAML routine DAG interpreter, conditional evaluator, and 256KB scratch vaulter.
│   │   │   │   ├── def validate_routine_definition(routine_dict) # [stale?] Validates a parsed routine definition dictionary: 1.
│   │   │   │   ├── def parse_routine_content(raw_text, fallback_id, is_markdown) # Parses either a Markdown-as-Code (.md) routine (YAML frontmatter + ## <node_id> sections) or a YAML (.yaml/.yml) routine into a normalized d...
│   │   │   │   ├── def serialize_routine_to_markdown(defn) # Serializes a routine definition dict into Markdown-as-Code (YAML frontmatter + ## <node_id> sections).
│   │   │   │   ├── def list_available_routines(ctx) # Discovers all declarative YAML routines across built-in defaults and workspace .insetu/routines/*.yaml.
│   │   │   │   ├── def resolve_routine_mode(routine, requested_mode) # Resolves a requested slash mode or alias (e.g., 'plan' or 'architect') against the YAML routine's declarative `modes:` block.
│   │   │   │   ├── def load_routine_definition(ctx, routine_id) # Loads a declarative YAML routine from workspace .insetu/routines/<id>.yaml or built-in defaults.
│   │   │   │   ├── def evaluate_when_condition(when_expr, chain_context) # AST-restricted, zero-eval conditional evaluator for YAML 'when' expressions.
│   │   │   │   ├── def strip_yomama_blocks_keep_prose(raw_text) # Strips raw Yomama <<<<<<< FILE: ...
│   │   │   │   ├── def clamp_rag_files_to_topology(ctx, candidate_files, allowed_repos) # Clamps LLM-selected RAG file URIs against topology_ledger within allowed_repos (max MAX_RAG_FILES_PER_HOP).
│   │   │   │   └── def execute_declarative_routine(ctx, session_id, user_prompt, mode, ...) # [stale?] Executes a declarative YAML routine DAG for an Agent turn.
│   │   │   ├── prompts/            # Management of global prompt templates and macro inclusions.
│   │   │   │   ├── routine_authoring_guide.md # Authoring guide for declarative Markdown-as-Code (ctx://routines/*.md) wavefront routines.
│   │   │   │   └── test_triage_rubric.md # Diagnostic rubric for triaging test suite failures against implementation code.
│   │   │   └── routines/           # Co-located Git declarative DAG routines (/audit and /closeout).
│   │   │       ├── ask.md          # Answers architectural and codebase questions using a 2-stage context expansion funnel without mutating files.
│   │   │       ├── bugfix.md       # Performs root-cause analysis on a bug report or stack trace and applies a minimal, non-regressive Yomama fix.
│   │   │       ├── code.md         # Scouts relevant workspace files, generates surgical Yomama patches, and applies them atomically.
│   │   │       ├── debt_ratchet.md # Audits newly committed turn diffs for duplicate helpers, dead code, or boundary leaks and applies a surgical cleanup patch if needed.
│   │   │       ├── implement.md    # Executes an architectural plan or ticket into concrete Yomama code patches and runs the Debt Ratchet audit.
│   │   │       ├── plan.md         # Drafts or refines a persistent Markdown architectural plan using Yomama patches and verifies all referenced file targets via Cartographer.
│   │   │       ├── refactor.md     # Executes behavior-preserving structural refactorings using Yomama RELOCATE, RENAME, and SEARCH/REPLACE blocks.
│   │   │       ├── scout_context.md # Scores candidate workspace files in parallel using the fast model tier to prune irrelevant context before synthesis.
│   │   │       ├── test.md         # Resolves and runs the repository test suite in a bounded loop, triaging and patching failures automatically.
│   │   │       ├── upkeep.md       # Two-stage maintenance routine for documentation/symbol drift, zero-logic God-object modularization, and test suite relevance.
│   │   │       ├── workspace_turn.md # Classifies turn intent, synthesizes response and Yomama patches, and applies code/plan mutations atomically.
│   │   │       └── yomama.md       # Validates and commits Yomama patch blocks, automatically healing failed hunks against live VFS file contents in a bounded loop.
│   │   ├── bridge/                 # Yomama Sync Bridge and AST validation engine.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── bridge.js           # [Sync Bridge Payload UI]
│   │   │   │   ├── class InSetuExtBridge # [comment required]
│   │   │   │   ├── class InSetuBridgeDiffProjection # [comment required]
│   │   │   │   ├── class InSetuBridgeEditProjection # [comment required]
│   │   │   │   ├── class InSetuExtBridgeActions # [comment required]
│   │   │   │   └── class InSetuExtBridgeHistory # [comment required]
│   │   │   ├── bridge_ast.py       # Yomama v4 AST symbol relocation, token-aware renaming, and commit message synthesis.
│   │   │   │   ├── def apply_ast_relocate_in_memory(source_content, target_content, source_uri, target_uri, ...) # Byte-exact AST symbol cut-and-paste from source_content into target_content.
│   │   │   │   ├── def apply_ast_rename_to_content(filepath, content, target_symbol, new_symbol) # Token-aware symbol renamer for a single file buffer.
│   │   │   │   ├── def resolve_scope_files(workspace_id, scope_prefix, allowed_repos) # Resolves a URI prefix or glob pattern (e.g.
│   │   │   │   └── def generate_commit_message_from_ledger(ctx, repo, transaction_id, limit) # Synthesizes a Conventional Commit message and Transaction-ID trailers directly from recent bridge_ledger intent comments (<<<<<<< COMMENT).
│   │   │   ├── bridge_fuzzy.py     # Fuzzy matching and fallback regex algorithms.
│   │   │   │   ├── def heal_chevron_meltdown(text) # Trims conversational garbage or broken markdown fences trailing the final REPLACE block.
│   │   │   │   ├── def heal_latex_vert(text) # Replaces Gemini LaTeX math-mode pipe escapes (\vert{}) back into '|' strictly when bounded by $ ...
│   │   │   │   ├── def heal_citation_artifacts(text) # Strips leaked LLM citation markers (,, [cite_start], [cite_end]).
│   │   │   │   ├── def heal_llm_block_artifacts(text, reference_content) # Unified chatbot artifact healing pipeline for SEARCH and REPLACE blocks.
│   │   │   │   ├── def expand_macros(text, reference_content) # Expands Yomama transport escape macros.
│   │   │   │   ├── def is_effectively_identical(lines_a, lines_b) # [stale?] Externalized comparison logic.
│   │   │   │   ├── def find_all_block_anchors(file_lines, block_lines, allow_boundary_partial) # [stale?] Two-Tier Contiguous Block Anchor Scanner: - Tier 0 (Strict Full-Line Scan): Requires every non-empty line in block_lines to match file_lines...
│   │   │   │   ├── def find_block_anchor(file_lines, block_lines, allow_boundary_partial) # [stale?] Abstracted 100% contiguous block search engine.
│   │   │   │   ├── def normalize_patch_payload(text, reference_content) # Single Source of Truth normalizer for Yomama SEARCH, REPLACE, TEXTEDIT, and JSON_PATCH payloads.
│   │   │   │   ├── def apply_block_in_memory(content, block, silent) # [comment required]
│   │   │   │   ├── def apply_textedit_in_memory(content, block, silent) # [stale?] Applies a <<<<<<< TEXTEDIT inline prose diff block ({-delete}} / {{+insert}}) using exact or soft-wrap-normalized character span matching.
│   │   │   │   └── def apply_json_patch_in_memory(filepath, content, block, silent) # [stale?] Applies a <<<<<<< JSON_PATCH block (either a dotted/selector key-path dict or RFC 6902 array) to .json, .yaml/.yml, or .md (YAML frontmatter...
│   │   │   ├── bridge_vfs.py       # Async VFS commit pipelines and concurrency locks.
│   │   │   │   └── def execute_bridge_sync(workspace_id, data) # [comment required]
│   │   │   ├── engine_bridge.py    # [Yomama Sync Bridge Transaction Logic]
│   │   │   │   ├── class BridgeLedgerRecord(TypedDict) # [comment required]
│   │   │   │   ├── class BridgeHistoryResponse(TypedDict) # [comment required]
│   │   │   │   ├── def bridge_history(ctx) # Phase C: Returns the ephemeral ledger history for the UI.
│   │   │   │   ├── class BridgeRevertPayload(TypedDict) # [comment required]
│   │   │   │   ├── def bridge_revert(ctx) # Phase 5: Forward-replay reversion.
│   │   │   │   ├── class PatchResolution(TypedDict) # [comment required]
│   │   │   │   ├── class BridgeSyncPayload(TypedDict) # [comment required]
│   │   │   │   ├── def bridge_sync(ctx) # Receives Yomama payloads from the UI and dispatches the sync.
│   │   │   │   ├── class BridgeAstRelocatePayload(TypedDict) # [comment required]
│   │   │   │   ├── def bridge_ast_relocate(ctx) # [comment required]
│   │   │   │   ├── class BridgeAstRenamePayload(TypedDict) # [comment required]
│   │   │   │   ├── def bridge_ast_rename(ctx) # [comment required]
│   │   │   │   ├── class BridgeCommitMessageQuery(TypedDict) # [comment required]
│   │   │   │   ├── def bridge_commit_message(ctx) # [comment required]
│   │   │   │   ├── class BridgeMergeBlocksPayload(TypedDict) # [comment required]
│   │   │   │   ├── def bridge_merge_blocks(ctx) # [comment required]
│   │   │   │   ├── class BridgeTurnDiffPayload(TypedDict) # [comment required]
│   │   │   │   └── def bridge_turn_diff(ctx) # [comment required]
│   │   │   └── prompts/            # Management of global prompt templates and macro inclusions.
│   │   │       └── yomama_patch_protocol.md # Built-in prompt template defining the Yomama Bridge SEARCH/REPLACE patch syntax.
│   │   ├── cartographer/           # Autonomous topology mapping and CODE_INDEX generation.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   └── cartographer.py     # [VFS Topology Mapper]
│   │   │       ├── def describe_source_file(rel_path, content) # Derives a one-sentence file description for CODE_INDEX.md from the file itself, so a file that has no description in the index gets one inste...
│   │   │       ├── def extract_file_symbols(filepath, content) # Stage 2 Shallow Static AST Extractor: Extracts public top-level symbols for .py and .js/.ts/.mjs/.tsx files.
│   │   │       ├── def extract_symbol_source_slice(filepath, content, symbol_query) # Locates a top-level class, method (Class.method or method), or function in `content` and returns its exact source slice (including leading d...
│   │   │       ├── def extract_existing_comments(index_path, repo_path, vfs_content) # Pass 1: Extracts path-scoped and basename comments from VFS content, falling back to Git history only if empty.
│   │   │       ├── def render_ascii_tree(node, comment_map, managed_dirs, prefix, ...) # Pass 2: Builds the new tree and injects the 3-tier waterfall comments and shallow AST symbol children.
│   │   │       ├── class CartographerExtractPayload(TypedDict) # Request schema for AST symbol source slice extraction.
│   │   │       ├── def api_cartographer_extract(ctx) # Slices and returns the exact AST source block for a target class, method, or function.
│   │   │       ├── class CartographerVerifySymbolsPayload(TypedDict) # Request schema for marking symbol body hashes as verified.
│   │   │       ├── def api_cartographer_verify_symbols(ctx) # Marks specified symbols as verified at their current AST body_hash, clearing [stale?] flags.
│   │   │       ├── class CartographerEnrichPayload(TypedDict) # Request schema for fast-tier LLM symbol comment enrichment.
│   │   │       ├── def api_cartographer_enrich(ctx) # Batches undocumented or stale symbol snippets into a fast-tier LLM call and updates CODE_INDEX.md.
│   │   │       └── def map_repositories(workspace_id, silent, target_repos, extra_comments) # [stale?] Maps tracked repository file trees and AST symbols into CODE_INDEX.md.
│   │   ├── config/                 # Repository and bucket topology configuration UI.
│   │   │   └── config.js           # UI for managing repository topologies and tracked buckets.
│   │   │       └── class InSetuExtConfig # [comment required]
│   │   ├── editor/                 # Global CodeMirror editor settings.
│   │   │   └── engine_editor.py    # Editor preferences and markdown link configurations.
│   │   │       ├── def get_preference(ctx) # [comment required]
│   │   │       ├── def set_preference(ctx) # [comment required]
│   │   │       ├── class VendorizePayload(TypedDict) # [comment required]
│   │   │       ├── class VendorizeResponse(TypedDict) # [comment required]
│   │   │       ├── def serve_vendor_asset(ctx, filename) # [comment required]
│   │   │       └── def vendorize_language(ctx) # [comment required]
│   │   ├── fs/                     # Virtual File System REST gateway and editing modals.
│   │   │   ├── engine_fs.py        # VFS file operations, upload, and OCC conflict REST gateway.
│   │   │   │   ├── class FileTargetPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_fs_exists(ctx) # Silent validation route that verifies file existence for the UI.
│   │   │   │   ├── def api_fs_fetch(ctx) # Unified authenticated URI read, binary streaming, and attachment download gateway.
│   │   │   │   ├── class FileGitDiffResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_fs_git_diff(ctx) # Retrieves the Git HEAD baseline and current working tree text for a file.
│   │   │   │   ├── class FileSearchPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_fs_search(ctx) # [comment required]
│   │   │   │   ├── class FileMovePayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_fs_move(ctx) # [comment required]
│   │   │   │   ├── class FileActionPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_fs_archive(ctx) # [comment required]
│   │   │   │   ├── def api_fs_delete(ctx) # [comment required]
│   │   │   │   ├── class BulkMutationItem(TypedDict) # [comment required]
│   │   │   │   ├── class FileBulkPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_fs_bulk(ctx) # [comment required]
│   │   │   │   ├── class FileUploadRequest(TypedDict) # [comment required]
│   │   │   │   ├── class FileUploadResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_fs_upload(ctx) # Native multipart/form-data uploader for robust binary handling.
│   │   │   │   ├── class FileSavePayload(TypedDict) # [comment required]
│   │   │   │   └── def api_fs_save(ctx) # Universal save-back endpoint with 3-way OCC merge and explicit path routing guardrails.
│   │   │   └── fs.js               # [Virtual File System Modals & UI]
│   │   │       ├── function bindDownloadDrag(e, filename, fetchUrl) # [comment required]
│   │   │       ├── function normalizeVfsURI(path, defaultScheme = 'vfs') # [comment required]
│   │   │       ├── function isFileGitModified(filepath) # [comment required]
│   │   │       ├── function resolveConflictOriginalPath(filepath) # [comment required]
│   │   │       ├── function viewTwoFileDiff(leftFilepath, rightFilepath) # [comment required]
│   │   │       ├── function viewFileGitDiff(filepath) # [comment required]
│   │   │       ├── function isBufferReadOnly(buf) # [comment required]
│   │   │       ├── function hasMacroSyntax(text) # [comment required]
│   │   │       ├── function canPreviewFileMacros(filepath, content = '') # [comment required]
│   │   │       ├── function resolveLiveBufferPreview(filepath, rawContent, isDirty =...) # [comment required]
│   │   │       ├── function injectTextToBuffer(filepath, text, isSupportedEdito...) # [comment required]
│   │   │       ├── function routeToSpatialGrid(filepath, label = null, preferre...) # [comment required]
│   │   │       ├── function ensureFreshContext(filePath) # [comment required]
│   │   │       ├── function fetchAndCopy(filePath, explicitUrl = null) # [comment required]
│   │   │       ├── function fetchAndDownloadState(filePath, explicitUrl = null) # [comment required]
│   │   │       ├── function shareFiles(baseFile, chunks = null, isFS =...) # [comment required]
│   │   │       ├── function downloadFile() # [comment required]
│   │   │       ├── function viewInWindow(filename) # [comment required]
│   │   │       ├── function viewAndCopy(filename) # [comment required]
│   │   │       ├── function refreshActiveFileViews(oldPath, newPath = null) # [comment required]
│   │   │       ├── function updateManifestState(mutations) # [comment required]
│   │   │       ├── function resolveEntityExportTarget() # [comment required]
│   │   │       ├── function resolveExpandedExportText() # [comment required]
│   │   │       ├── function prepareBufferSavePayload(buf, filepath) # [comment required]
│   │   │       ├── function rebaseConcurrentText(baseText, localText, remoteText) # [comment required]
│   │   │       ├── function saveBufferFile(filepath, autoSave = false) # [comment required]
│   │   │       ├── function reconcileBufferWithDisk(filepath) # [comment required]
│   │   │       ├── function flushAllDirtyBuffers(useKeepalive = false) # [comment required]
│   │   │       ├── function renameFileTracking(oldPath, newPath) # [comment required]
│   │   │       ├── function executeMove() # [comment required]
│   │   │       ├── class InSetuMoveFileProjection # [comment required]
│   │   │       ├── function deleteEmptyFolder(dirPath) # [comment required]
│   │   │       ├── function createFileCard(fileInfo, container) # [comment required]
│   │   │       ├── function getGlobalManifest() # [comment required]
│   │   │       ├── class InSetuVFSExplorer # [comment required]
│   │   │       ├── function pruneSubsumedTargets(items) # [comment required]
│   │   │       ├── function executeBulkMove(items) # [comment required]
│   │   │       ├── function executeBulkArchive(items) # [comment required]
│   │   │       ├── function executeBulkDelete(items) # [comment required]
│   │   │       ├── function getFileExtensionWarning(filename, basePath = '') # [comment required]
│   │   │       ├── function checkFileExtension(filename) # [comment required]
│   │   │       ├── function openNewFileModal(overridePath = null) # [comment required]
│   │   │       ├── function saveNewFile() # [comment required]
│   │   │       ├── function openNewFolderModal(overridePath = null) # [comment required]
│   │   │       ├── function saveNewFolder() # [comment required]
│   │   │       ├── function hydrateVfsBuffer() # [comment required]
│   │   │       ├── function viewSourceFile() # [comment required]
│   │   │       ├── function closeBrowseModal() # [comment required]
│   │   │       ├── function openWorkspaceBrowser() # [comment required]
│   │   │       ├── function openFolderBrowser(callback = null) # [comment required]
│   │   │       ├── function confirmFolderSelection() # [comment required]
│   │   │       ├── function openBrowseModal(contextFilename) # [comment required]
│   │   │       ├── function openVirtualFile(filename, content) # [comment required]
│   │   │       ├── class InSetuEditorProjection # [comment required]
│   │   │       ├── class InSetuFrontmatterEditor # [comment required]
│   │   │       ├── function extractManifestFiles(...args) # [comment required]
│   │   │       ├── function resolveFileFetchUrl(filepath, isFS = false) # [comment required]
│   │   │       ├── function getChunks(filepath) # [comment required]
│   │   │       ├── function openPartsModal(filepath) # [comment required]
│   │   │       ├── function uploadFileToWorkspace(targetDir) # [comment required]
│   │   │       ├── function openLinkModal(initialQuery = '', initialTab =...) # [comment required]
│   │   │       ├── function switchLinkTab(tab) # [comment required]
│   │   │       ├── function onLinkSearchInput(val) # [comment required]
│   │   │       ├── function executeDeepLinkSearch(overrideQuery = null) # [comment required]
│   │   │       ├── function executeLinkSearch(query) # [comment required]
│   │   │       ├── class InSetuNewFileProjection # [comment required]
│   │   │       ├── class InSetuNewFolderProjection # [comment required]
│   │   │       ├── class InSetuLinkInsertProjection # [comment required]
│   │   │       ├── class InSetuBrowserProjection # [comment required]
│   │   │       └── class InSetuFileDiffProjection # [comment required]
│   │   ├── gather/                 # RAG Context compiler and manifest synchronizer.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_gather.py    # [Context Compiler and Workflow Batch routing]
│   │   │   │   ├── def compile_context_payload(workspace_id, output_dir, base_uri, header_block, ...) # Universal compiler for all system contexts (Gather, Git, Flow).
│   │   │   │   ├── def handle_topology_resolved(workspace_id, dirty_repos, dirty_buckets, events, **kwargs) # Stage 2 Slew Limiter: Catches resolved topology and schedules a delayed RAG compilation.
│   │   │   │   ├── def get_ordered_compilation_steps(ctx) # Delegates compilation sequence resolution to Akasa's generic DAG orchestrator.
│   │   │   │   ├── def init_gather_workers(workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def on_gather_settings_updated(workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def hook_vfs_search(workspace_id, query, **kwargs) # [comment required]
│   │   │   │   ├── def provide_base_workspaces(target_repos, ledger_events, workspace_id, **kwargs) # Base Workspace Provider: Yields schemas for standard repo contexts and media vaults.
│   │   │   │   ├── def get_compiler_lock(wid) # [comment required]
│   │   │   │   ├── def generate_context_file(workspace_id, target_repos) # The Master Orchestrator Loop: Executes full sweeps based on declared topology and garbage collects.
│   │   │   │   ├── def vacuum_unaccounted_cache_on_complete(workspace_id, **kwargs) # Terminal Mark-and-Sweep Garbage Collector: Runs strictly AFTER all compilation DAG steps (Topology, Cartographer, Gather, Git, Flow) have up...
│   │   │   │   ├── class ClearQuickpacksResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_clear_quickpacks(ctx) # [comment required]
│   │   │   │   ├── class PackSelectionPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_gather_pack_selection(ctx) # [comment required]
│   │   │   │   ├── class RepoTemplateResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_repo_template(ctx) # [comment required]
│   │   │   │   ├── def mount_gather_volumes(workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def hook_request_manifest(workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def hook_request_manifest_chunks(target_key, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def hook_resolve_payload_chunks(uri, workspace_id, manifest, **kwargs) # [comment required]
│   │   │   │   ├── def hook_save_manifest(manifest_data, is_full_compile, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def api_manifest_version(ctx) # [comment required]
│   │   │   │   ├── def hook_gather_manifest_signatures(workspace_id, since_ts, **kwargs) # Yields lightweight context artifact signatures for the ctx domain.
│   │   │   │   ├── class ManifestEntryQuery(TypedDict) # [comment required]
│   │   │   │   ├── class ManifestEntryResponse(TypedDict) # [comment required]
│   │   │   │   └── def api_gather_manifest_entry(ctx) # Surgically fetches a single manifest entry by context path.
│   │   │   └── gather.js           # [Context Batch & Workflow UI]
│   │   │       ├── function getFlattenedBuckets(repoDirOrConfigs = null, include...) # [comment required]
│   │   │       ├── function packSelectionPayload(items) # [comment required]
│   │   │       └── class InSetuExtGather # [comment required]
│   │   ├── llm/                    # Universal multi-provider LLM gateway and streaming proxy.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   └── engine_llm.py       # Multi-model inference orchestrator (Anthropic, Gemini, Claude CLI).
│   │   │       ├── class ChatMessage(TypedDict) # [comment required]
│   │   │       ├── class ChatCompletionPayload(TypedDict) # [comment required]
│   │   │       ├── class LlmDecidePayload(TypedDict) # [comment required]
│   │   │       ├── def get_compute_pool_and_profiles(ctx) # [stale?] Returns the normalized compute endpoint pool, configuration profiles, and active_profile_id.
│   │   │       ├── class LlmResolveTargetPayload(TypedDict) # [comment required]
│   │   │       ├── def api_llm_resolve_target(ctx) # [comment required]
│   │   │       ├── def validate_output_schema(raw_text, output_schema) # Universal Output Schema Bouncer: Validates LLM text against named built-in contracts ('yomama_patch', 'intent_classification', 'json') or a...
│   │   │       ├── def api_llm_complete(ctx) # [comment required]
│   │   │       ├── class AudioTranscribePayload(TypedDict) # [comment required]
│   │   │       ├── def api_llm_transcribe(ctx) # [comment required]
│   │   │       ├── def api_chat_completions(ctx) # [comment required]
│   │   │       ├── class LlmProfilesSavePayload(TypedDict) # [comment required]
│   │   │       ├── def api_llm_profiles(ctx) # [comment required]
│   │   │       ├── def api_llm_decide(ctx) # [comment required]
│   │   │       ├── def export_public_llm_catalog_file(out_path, workspace_id) # [stale?] Headless static exporter for CI / GitHub Actions / Cloudflare Pages: Harvests the live multi-provider model & token pricing catalog and writ...
│   │   │       ├── def api_llm_catalog(ctx) # [comment required]
│   │   │       └── def api_public_llm_catalog() # Free, unauthenticated, CORS-enabled public JSON API endpoint serving the normalized multi-provider model & token pricing catalog (merging Op...
│   │   ├── mcp/                    # Model Context Protocol (MCP 2025-03-26) server substrate.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   └── engine_mcp.py       # JSON-RPC 2.0 MCP gateway exposing capabilities as tools, contexts as resources, and prompt templates.
│   │   │       ├── class McpJsonRpcPayload(TypedDict) # [comment required]
│   │   │       ├── def handle_mcp_jsonrpc(ctx, rpc_payload) # Evaluates a single MCP 2025-03-26 JSON-RPC 2.0 request or notification dictionary.
│   │   │       ├── def api_mcp_rpc(ctx) # [comment required]
│   │   │       └── def api_mcp_http_root(workspace_id) # [comment required]
│   │   ├── offline/                # Local offline data provider and sync reconciliation engine.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_offline.py   # Offline data provider and sync reconciliation handlers.
│   │   │   └── offline_ui.js       # Client offline status indicator and outbox telemetry UI.
│   │   │       ├── class InSetuCoreOfflineLedger # [comment required]
│   │   │       └── class InSetuCoreOfflineLog # [comment required]
│   │   ├── prompts/                # Management of global prompt templates and macro inclusions.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_prompts.py   # Prompt discovery and resolution.
│   │   │   │   ├── class PromptsVFSDriver(TemplateOverlayVFSDriver) # VFS Driver routing ctx://prompts/.templates/user via ws://default and .templates/<mod> to active module prompt directories.
│   │   │   │   ├── def inject_prompts_config(cfg, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def migrate_legacy_prompt_macros_on_boot(workspace_id, **kwargs) # One-time boot migration upgrading legacy scheme-less {{include_prompt: ...}} tags in prompt files to canonical ctx://prompts/ URIs.
│   │   │   │   ├── def provide_available_prompts(workspace_id, **kwargs) # Supplies global (ctx://prompts), virtual module templates (ctx://prompts/.templates), repo-scoped (<repo>/.insetu-data/prompts), and peer-mo...
│   │   │   │   ├── class PromptsListResponse(TypedDict) # [comment required]
│   │   │   │   ├── class PromptResolveQuery(TypedDict) # [comment required]
│   │   │   │   ├── def api_prompts_list(ctx) # Provides a list of available prompts (including virtual .templates) for the UI.
│   │   │   │   └── def api_prompts_resolve(ctx) # Fetches a canonical prompt URI or live POST buffer and recursively resolves {{include_prompt: ...}} macros.
│   │   │   └── prompts.js          # Core Prompt Library UI, virtual module .templates browser, and macro embedding.
│   │   │       ├── class InSetuExtPrompts # [comment required]
│   │   │       └── function isPromptPath(filepath) # [comment required]
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
│   │   │       ├── class TailscaleBindPayload(TypedDict) # [comment required]
│   │   │       └── def api_bind_tailscale(ctx) # Manually triggers 'tailscale serve' to expose the local inSetu port to the Tailnet.
│   │   ├── sdk/                    # Developer SDK namespace.
│   │   │   └── __init__.py         # Module initialization.
│   │   │       ├── class TemplateOverlayVFSDriver(DefaultVFSDriver) # Unified Tier 2 Template Overlay VFS Driver for ctx://prompts and ctx://routines: - Routes ctx://<vol>/.templates/user/...
│   │   │       ├── class InSetuContext(_BaseExtensionContext) # [stale?] Tier 2 Developer OS Extension Context with dual-root Manifest, RAG compilation, and Frontmatter helpers.
│   │   │       ├── def resolve_external_dependency_spec(dep_str) # Normalizes an external dependency declaration into (import_specifier, pypi_package_name).
│   │   │       └── class InSetuExtension(AkasaExtension) # [stale?] Tier 2 Developer OS Blueprint wrapper supporting declarative VFS volume mounts, dependency contracts, and InSetuContext injection.
│   │   ├── system/                 # System lifecycle, settings, and recovery controllers.
│   │   │   ├── api.js              # Centralized API fetch wrapper and token injector.
│   │   │   │   ├── class SSEPipeline # Phase E: Network Hysteresis, Outbox Reconciliation & SSE Pipeline
│   │   │   │   └── function attemptReconciliation() # [comment required]
│   │   │   ├── cli_commands.py     # Modular CLI command implementations (init, daemon service, GUI, shortcuts).
│   │   │   │   ├── def handle_init(cwd, args) # Interactive and headless onboarding wizard for initializing an inSetu workspace.
│   │   │   │   ├── def handle_service(action, cwd) # Manages the background systemd daemon for inSetu.
│   │   │   │   ├── def scaffold_extension(ext_name) # Scaffolds a new bundled extension directory from default templates.
│   │   │   │   ├── def check_daemon_alive(port) # Pings localhost to check if an inSetu daemon is already running.
│   │   │   │   ├── def launch_gui(cwd) # Launches pywebview desktop shell, attaching to an active daemon or starting an embedded server.
│   │   │   │   ├── def create_desktop_shortcut(cwd) # Generates a native OS application shortcut for inSetu GUI.
│   │   │   │   └── def handle_mcp_stdio(cwd, args) # MCP 2025-03-26 Stdio Bridge: Proxies JSON-RPC messages over stdin/stdout to the running HTTP daemon on 127.0.0.1:<port>, or executes headles...
│   │   │   ├── components/         # Reusable Lit Web Components for the OS.
│   │   │   │   ├── ui_editor.js    # CodeMirror 6 markdown and frontmatter editor wrappers.
│   │   │   │   │   ├── function resolveEditorMode(filename) # [comment required]
│   │   │   │   │   ├── function getActiveEditorPath() # [comment required]
│   │   │   │   │   ├── function getEditorContent() # [comment required]
│   │   │   │   │   ├── function setEditorContent(text) # [comment required]
│   │   │   │   │   ├── function insertTextAtCursor(textToInsert) # [comment required]
│   │   │   │   │   ├── function insertLinkToEditor(path, name) # [comment required]
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
│   │   │   │   │   ├── class InSetuSpinner # [comment required]
│   │   │   │   │   ├── class InSetuEmptyState # [comment required]
│   │   │   │   │   └── class InSetuHostDirPicker # [comment required]
│   │   │   │   └── ui_system_settings.js # The 3-Tier Configuration Editor and Settings Hub.
│   │   │   │       ├── class InSetuSchemaRepeater # [comment required]
│   │   │   │       └── class InSetuSystemSettings # [comment required]
│   │   │   ├── engine_system.py    # System topology, deltas, and lifecycle REST endpoints.
│   │   │   │   ├── def vault_repeater_secrets_for_schema(ext_name, workspace_id) # Universal Repeater Secret Vaulting: Scans any registered settings schema for `type: 'repeater'` fields that contain `secure: True` subfields...
│   │   │   │   ├── def core_system_settings_updated(workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def hydrate_and_migrate_cascade_settings(cfg, workspace_id, **kwargs) # Transparent 3-Tier Cascade Bridge: 1.
│   │   │   │   ├── def provide_vfs_ignores(workspace_id, **kwargs) # Host application declaration of directories the VFS should never traverse natively.
│   │   │   │   ├── def api_system_openapi() # Phase 3 Tool Calling: Generates a real-time OpenAPI 3.0 specification from mounted SDK routes.
│   │   │   │   ├── class DeltasQueryPayload(TypedDict) # [comment required]
│   │   │   │   ├── class SystemDeltasResponse(TypedDict) # [comment required]
│   │   │   │   ├── def api_system_deltas(ctx) # [comment required]
│   │   │   │   ├── class PipelineSubmitPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_system_pipeline_submit(ctx) # [comment required]
│   │   │   │   ├── def handle_config_pre_save(workspace_id, filepath, content, data, **kwargs) # [comment required]
│   │   │   │   ├── def get_system_config(workspace_id) # [comment required]
│   │   │   │   ├── def save_system_config(workspace_id, payload) # [comment required]
│   │   │   │   ├── class ExtensionInstallDepsPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_system_install_extension_deps(ctx) # [comment required]
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
│   │   │   │   └── def api_system_memory(ctx) # [comment required]
│   │   │   ├── insetu_sdk.js       # The InSetuElement base class and Zustand store factory.
│   │   │   │   ├── function extractTemplateVariables() # [comment required]
│   │   │   │   ├── function interpolateTemplateVariables() # [comment required]
│   │   │   │   ├── function cleanCodeArtifacts(text) # [comment required]
│   │   │   │   ├── function createExtensionStore() # [comment required]
│   │   │   │   ├── function createIsolatedSlice(store, sliceKey) # [comment required]
│   │   │   │   ├── class BucketAddress # Immutable value object representing a canonical structural bucket address.
│   │   │   │   ├── class InSetuURI # [comment required]
│   │   │   │   └── class InSetuElement # [comment required]
│   │   │   ├── legacy.py           # Self-healing database recovery and legacy sandbox migration.
│   │   │   │   ├── def move_tree_contents(src_dir, dst_dir) # Recursively merges files from src_dir into dst_dir and removes empty source directories.
│   │   │   │   ├── def split_system_json(**kwargs) # Delegates legacy system.json splitting (into host.json and workspaces.json) to the Akasa kernel.
│   │   │   │   └── def migrate_physical_sandboxes(**kwargs) # Domain-agnostic kernel migration: consolidates SQLite databases into .insetu/cache/db/ and heals .gitignore.
│   │   │   ├── store.js            # [Zustand Unified Data Flow (UDF) Store]
│   │   │   ├── system.js           # System settings UI, SSE pipeline listeners, and recovery triggers.
│   │   │   │   ├── function bootServiceWorker() # [comment required]
│   │   │   │   ├── function autoWireSettingsSchemas() # [comment required]
│   │   │   │   ├── function bootExtensions() # [comment required]
│   │   │   │   ├── function checkManifestVersion() # --- DECENTRALIZED MANIFEST SYNC & KERNEL HEARTBEAT ---
│   │   │   │   ├── function updateBootProgress(statusMsg) # [comment required]
│   │   │   │   ├── function executeSecurityHandshake() # [comment required]
│   │   │   │   ├── function executeBootSequence() # [comment required]
│   │   │   │   ├── function executeWorkspaceSwap(key, title = null, targetHash =...) # [comment required]
│   │   │   │   ├── function loadWorkspaces() # [comment required]
│   │   │   │   ├── function updateRefreshText() # [comment required]
│   │   │   │   ├── function setGlobalStatus(msg, timeout = 3000, isError = f...) # [comment required]
│   │   │   │   ├── function setSyncStatus(state) # [comment required]
│   │   │   │   ├── function executeWorkspaceMutation() # [comment required]
│   │   │   │   ├── function purgeServiceWorkerCaches() # [comment required]
│   │   │   │   ├── function simulatePanic() # [comment required]
│   │   │   │   ├── function performSoftRefresh(targetWs = null, targetHash = null) # [comment required]
│   │   │   │   ├── function fullRefresh() # [comment required]
│   │   │   │   └── function initializeWorkspaceTopology() # [comment required]
│   │   │   └── types.js            # Root JSDoc type definitions entry point.
│   │   ├── topology/               # Central SSOT for logical workspace topologies.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   └── engine_topology.py  # Tracks the active layout of repositories and buckets.
│   │   │       ├── def hook_topology_manifest_signatures(workspace_id, since_ts, **kwargs) # Yields lightweight repository signatures for the vfs domain, incorporating git_status counts.
│   │   │       ├── def api_topology_vfs_repo(ctx) # Surgically fetches the VFS bucket structure and git modification state for a specific repository.
│   │   │       ├── def force_topology_scan(workspace_id, target_repos, **kwargs) # Synchronously forces a full physical disk walk to rebuild the Topology Ledger.
│   │   │       ├── def hook_request_vfs_manifest(workspace_id, **kwargs) # Returns the vfs manifest derived directly from the topology ledger via raw tuple queries.
│   │   │       ├── def get_omniscient_workspace_files(workspace_id, allowed_repos) # Fast SQL replacement for the old os.walk bridge optimization.
│   │   │       ├── def get_topology_files_for_repo(workspace_id, repo_dir) # SSOT accessor returning canonical vfs://<repo>/<path> URIs from topology_ledger.
│   │   │       ├── def broadcast_cross_workspace_mutations(mutations, workspace_id, **kwargs) # Phase 4 Event Bus Synchronization: Propagates mutations on shared domains to subscriber workspaces as virtual 'ws://' mutations for reactive...
│   │   │       ├── def buffer_topology_events(mutations, workspace_id, **kwargs) # Stage 1 Slew Limiter: Catches high-velocity disk/watchdog mutations and buffers them in RAM to absorb the I/O storm before hitting SQLite.
│   │   │       ├── def resolve_topology_buffer(workspace_id) # Processes any pending events in topology_event_buffer, updates topology_ledger, and emits topology_resolved.
│   │   │       ├── def mount_topology_volumes_dynamically(cfg, workspace_id, **kwargs) # Dynamically remounts VFS volumes whenever the configuration changes.
│   │   │       ├── def init_topology_on_boot(workspace_id, **kwargs) # Topology owns the boot sequence.
│   │   │       ├── def matches_gitignore_patterns(rel_path, patterns) # Evaluates a relative POSIX path against a list of .gitignore-style patterns.
│   │   │       ├── def is_file_tracked_by_sieve(rel_path, config, live_cfg, repo_dir) # Single Source of Truth (SSOT) Hierarchical VFS Sieve.
│   │   │       ├── def get_valid_workspace_files(repo_path, config, workspace_id) # [comment required]
│   │   │       ├── def resolve_file_bucket(filepath, sub_buckets, repo_dir) # [comment required]
│   │   │       ├── def resolve_owning_workspaces(event_name, **kwargs) # Domain-aware spatial router for OS lifecycle events.
│   │   │       ├── class VerifyPlanTargetsPayload(TypedDict) # Request schema for verifying plan file targets against the workspace VFS.
│   │   │       ├── def api_topology_overview(ctx) # Compiles a lightweight structural overview of tracked repositories, sub-buckets, and CODE_INDEX.md headers.
│   │   │       ├── def api_topology_verify_plan_targets(ctx) # Verifies that vfs:// file targets referenced in an architectural plan exist or are marked as new files.
│   │   │       ├── class AuditUpkeepPayload(TypedDict) # Request schema for running a deterministic codebase upkeep audit.
│   │   │       └── def api_topology_audit_upkeep(ctx) # Deterministically audits workspace documentation/symbol drift, God-object candidates, and test relevance.
│   │   └── utils_core.py           # [Workspace Physics & Universal Utils]
│   │       ├── def hook_vfs_resolve_path(filename, workspace_id, **kwargs) # [comment required]
│   │       ├── class InSetuURI(AkasaURI) # Host application URI class enforcing strict canonical scheme:// prefixes for all internal operations, with explicit boundary parsing for ext...
│   │       ├── class BucketAddress # Immutable value object representing a canonical structural bucket address.
│   │       ├── def load_yaml_string(raw_yaml) # Centralized YAML string parser using the round-trip ruamel.yaml engine with safe fallback.
│   │       ├── def dump_yaml_string(yaml_data) # Centralized YAML string serializer using the round-trip ruamel.yaml engine with safe fallback.
│   │       ├── def parse_frontmatter(content) # [comment required]
│   │       ├── def update_frontmatter(content, new_data) # [comment required]
│   │       ├── def resolve_macro_includes(text, current_filepath, pattern, read_callback, ...) # [comment required]
│   │       ├── def parse_blocks(text) # [comment required]
│   │       ├── def clean_date_str(val) # Safely normalizes varied date inputs into a standard ISO format.
│   │       ├── def get_earlier_date(d1, d2) # Safely compares and returns the earlier of two ISO timestamp strings.
│   │       ├── def parse_list_field(raw_val) # Safely parses comma-separated strings or JSON arrays into a standardized JSON string.
│   │       ├── def parse_string_enum(raw_val) # Safely parses and normalizes string enumerations (e.g., priority, sizes).
│   │       ├── def start_filesystem_observer(**kwargs) # Initializes a unified Watchdog observer for all active workspaces.
│   │       ├── def stop_filesystem_observer(**kwargs) # [comment required]
│   │       ├── def generate_text_chunks(blocks, chunk_limit) # [comment required]
│   │       ├── def evaluate_circuit_breaker(touched_count, total_count, threshold) # [comment required]
│   │       ├── def extract_manifest_files(manifest_data, target_key, domain, exclude_types, ...) # [comment required]
│   │       ├── def get_domain_cache_path(workspace_id, domain_name) # Resolves and ensures physical existence of .insetu/cache/<domain_name> for disposable compiled outputs.
│   │       ├── def get_domain_data_path(workspace_id, domain_name) # Resolves and ensures physical existence of .insetu/data/<domain_name> for sovereign workspace data.
│   │       ├── def get_domain_artifact_path(workspace_id, domain_name, ext_name) # Backward-compatible router directing compiled artifacts to .insetu/cache/<domain_name>.
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
│   │       ├── def find_path_candidates(query_path, workspace_id, allowed_repos, **kwargs) # Explicit, opt-in candidate finder for path disambiguation.
│   │       ├── def get_default_repo_template(repo_dir, title, domain, description, ...) # [comment required]
│   │       ├── def normalize_repo_domains(target_repos, strip_empty_overrides) # SSOT normalizer for repository, sub-bucket, and meta_map domain strings.
│   │       ├── def heal_manifest_entry_domain(entry, target_repos, workspace_id) # Ensures entry['meta']['domain'] is never blank, inheriting from the parent repository domain when empty.
│   │       ├── def heal_sqlite_uri_column(conn, table, column, default_prefix) # Collision-safe SQLite URI column healer: removes duplicate unprefixed shadow rows before prepending default_prefix.
│   │       └── def sanitize_workspace_config(cfg) # [comment required]
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
│   │   │   │   ├── def get_metadata_index(ctx) # Leverages SQLite JSON1 C-extensions to calculate aggregates instantly, eliminating Python RAM caching.
│   │   │   │   ├── def get_citations(ctx) # Retrieves all stored academic citations with their associated attachment metadata.
│   │   │   │   ├── class AttachCitationPayload(TypedDict) # [comment required]
│   │   │   │   ├── def attach_citation(ctx, csl_id) # Attaches files or metadata pointers to a specific citation ID.
│   │   │   │   ├── class SearchCitationsPayload(TypedDict) # [comment required]
│   │   │   │   ├── def search_global_citations(ctx) # Queries global academic catalogs for citations matching the criteria.
│   │   │   │   ├── class ImportCitationsPayload(TypedDict) # [comment required]
│   │   │   │   ├── def import_citations(ctx) # Imports an array of CSL-JSON citation objects into the global library, resolving conflicts based on the chosen strategy.
│   │   │   │   ├── class DeleteCitationPayload(TypedDict) # [comment required]
│   │   │   │   ├── def delete_citation(ctx, csl_id) # Permanently removes a citation from the global library.
│   │   │   │   └── def inject_citation_middleware(text, workspace_id, **kwargs) # Parses text for citation macros and injects bibliography temp files and citeproc flags into the compiler.
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
│   │   │       └── class InSetuExtFreshdesk # 2.
│   │   ├── git/                    # Version control, branch management, and workspace sweeping.
│   │   │   ├── engine_git.py       # [Git Operations & Diff Generator]
│   │   │   │   ├── def get_headless_git_env() # Returns a secure OS environment block pre-configured for non-interactive SSH connections.
│   │   │   │   ├── def execute_git(**kwargs) # Universal Git command wrapper supporting both logical volumes and physical paths.
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
│   │   │   │   ├── def process_vfs_triggers(dirty_repos, dirty_buckets, workspace_id, events, **kwargs) # Event Bus Hook: Evaluates active automation rules based on resolved topology boundaries.
│   │   │   │   ├── def list_rules(ctx) # Lists all configured automation rules.
│   │   │   │   ├── class HookSavePayload(TypedDict) # [comment required]
│   │   │   │   ├── def save_rule(ctx) # Creates or updates a local automation rule.
│   │   │   │   ├── class HookTogglePayload(TypedDict) # [comment required]
│   │   │   │   ├── def toggle_rule(ctx) # Enables or disables an automation rule.
│   │   │   │   ├── class HookIdPayload(TypedDict) # [comment required]
│   │   │   │   ├── def execute_rule_manual(ctx) # Manually executes an automation rule.
│   │   │   │   ├── def delete_rule(ctx) # Permanently deletes an automation rule.
│   │   │   │   └── def get_logs(ctx) # Retrieves logs for executed automation rules.
│   │   │   └── ext_hooks.js        # UI for creating and managing hooks.
│   │   │       └── class InSetuExtHooks # [comment required]
│   │   ├── ingest/                 # URL to Markdown extraction via Jina or BeautifulSoup.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_ingest.py    # URL fetching and parsing logic.
│   │   │   │   ├── def extract_markdown_from_url(ctx, target_url, method) # [comment required]
│   │   │   │   ├── class IngestUrlPayload(TypedDict) # [comment required]
│   │   │   │   └── def api_ingest_url(ctx) # Fetches content from a URL and converts it into clean Markdown.
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
│   │   │   │   ├── def api_notes_list(ctx) # CQRS read-path: Fetches notes from DB, ensuring post-migration paths are synchronized.
│   │   │   │   ├── class NoteNewPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_notes_new(ctx) # Generates a new note file with managed YAML frontmatter.
│   │   │   │   └── def declare_notes_topology(ctx, target_repos, ledger_events, workspace_id, **kwargs) # Declares the notes library to the Gather engine for centralized chunking and context compilation.
│   │   │   └── ext_notes.js        # Note-taking editor and browser.
│   │   │       ├── class InSetuExtNotesModals # 2.
│   │   │       ├── class InSetuExtNotesEditor # 3.
│   │   │       └── class InSetuExtNotes # 4.
│   │   ├── preview/                # Managed dev server supervisor and live web application previewer.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_preview.py   # Multi-profile dev server process supervisor, port allocator, and log ring buffer.
│   │   │   │   ├── def start_repo_server(ctx, repo_dir, overrides) # [comment required]
│   │   │   │   ├── def stop_repo_server(ctx, repo_dir) # [comment required]
│   │   │   │   ├── def auto_boot_pinned_preview_servers(ctx, workspace_id, **kwargs) # Phase 2 Boot Hook: Spawns only repositories with explicit auto_start=True.
│   │   │   │   ├── def cleanup_workspace_preview_servers(workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def cleanup_all_preview_servers(**kwargs) # [comment required]
│   │   │   │   ├── class PreviewStartPayload(TypedDict) # [comment required]
│   │   │   │   ├── class PreviewRepoTargetPayload(TypedDict) # [comment required]
│   │   │   │   ├── def api_preview_status(ctx) # Passively inspects server status, sticky ports, and detected modes across all workspace repositories.
│   │   │   │   ├── def api_preview_start(ctx) # Starts or restarts a managed development server for a target repository.
│   │   │   │   ├── def api_preview_stop(ctx) # Terminates a running development server process group for a target repository.
│   │   │   │   └── def api_preview_logs(ctx) # Returns buffered stdout/stderr lines for a repository's managed preview server.
│   │   │   ├── ext_preview.js      # Live iframe preview surface, server toolbar, and output log drawer.
│   │   │   │   └── class InSetuExtPreview # [comment required]
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
│   │   │   │   ├── def gather_next_page(ctx, research_job_id, job_id) # Metronome callback to fetch a single SERP page, preventing rate limits.
│   │   │   │   ├── def scrape_next_link(ctx, research_job_id, job_id) # Executes a single link scrape inside the centralized ThreadPool.
│   │   │   │   ├── class ResearchStartPayload(TypedDict) # [comment required]
│   │   │   │   ├── def start_job(ctx) # Starts a new asynchronous research and scraping job.
│   │   │   │   ├── class ResearchActionPayload(TypedDict) # [comment required]
│   │   │   │   ├── def job_action(ctx, job_id) # Performs lifecycle actions (pause, resume, cancel, retry, delete) on a specific research job.
│   │   │   │   ├── def list_jobs(ctx) # Retrieves the history of active and past research jobs.
│   │   │   │   ├── def list_inbox(ctx) # Retrieves scraped research links currently awaiting triage in the inbox.
│   │   │   │   ├── class ExportContextPayload(TypedDict) # [comment required]
│   │   │   │   ├── def export_context(ctx, job_id) # Packs all scraped content for a job into plain text artifacts suitable for LLM injection.
│   │   │   │   ├── class InboxDispositionPayload(TypedDict) # [comment required]
│   │   │   │   └── def inbox_disposition(ctx, inbox_id) # Applies a triage decision (accepted, rejected, force_scrape) to an item in the inbox.
│   │   │   ├── ext_research.js     # [Research Inbox UI & Triage]
│   │   │   │   ├── class InSetuExtResearch # [comment required]
│   │   │   │   └── class InSetuResearchPreviewProjection # [comment required]
│   │   │   └── prompts/            # Management of global prompt templates and macro inclusions.
│   │   │       └── batch_triage_filter.md # Prompt template for AI-assisted batch triage of scraped research inbox items.
│   │   ├── skills/                 # Spaced-repetition tracking for discrete musical/technical skills.
│   │   │   ├── engine_skills.py    # Skill tracking algorithms and SQLite storage.
│   │   │   │   ├── def hydrate_skills_on_boot(ctx, workspace_id, **kwargs) # [comment required]
│   │   │   │   ├── def get_practice_playlist(ctx) # Compiles a unified practice batch across all domains sorted globally.
│   │   │   │   ├── class LogSkillPayload(TypedDict) # [comment required]
│   │   │   │   ├── def log_skill_practice(ctx) # Logs a practice run against the user's global profile tracking framework.
│   │   │   │   ├── class UpdateSkillPayload(TypedDict) # [comment required]
│   │   │   │   ├── def update_skill_structure(ctx) # Updates structural track properties without affecting the SM-2 spaced repetition clocks.
│   │   │   │   ├── class DeleteSkillPayload(TypedDict) # [comment required]
│   │   │   │   ├── def delete_skill_item(ctx) # Permanently purges a skill markdown asset from user space disk and index ledger.
│   │   │   │   ├── def get_all_skills(ctx) # Returns every tracking item registered across the user profile layout.
│   │   │   │   ├── class CreateSkillPayload(TypedDict) # [comment required]
│   │   │   │   └── def create_new_skill(ctx) # Generates a physical markdown file structure inside global user space.
│   │   │   └── ext_skills.js       # Spaced-repetition training UI.
│   │   │       ├── class InSetuExtSkills # [comment required]
│   │   │       └── class InSetuSkillsSessionProjection # [comment required]
│   │   ├── term/                   # Embedded terminal multiplexer and PTY WebSocket stream.
│   │   │   ├── engine_term.py      # [Terminal Multiplexer API]
│   │   │   │   ├── def set_winsize(fd, row, col, xpix, ...) # Native IOCTL system call to resize the PTY grid.
│   │   │   │   └── def term_status(ctx) # Checks if the underlying system supports PTY streams and Websocket connections.
│   │   │   ├── ext_term.js         # [Terminal Emulator UI]
│   │   │   │   └── class InSetuExtTerm # [comment required]
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
│   │       │   ├── def api_update_status(ctx) # Retrieves the current semantic versioning and build status of a repository.
│   │       │   ├── class UpdateForceVersionPayload(TypedDict) # [comment required]
│   │       │   ├── def api_update_force_version(ctx) # Forces an explicit version bump and Git tag.
│   │       │   ├── class UpdateInitPayload(TypedDict) # [comment required]
│   │       │   ├── def api_update_create_dummy_toml(ctx) # Creates a basic pyproject.toml to establish semantic versioning baseline.
│   │       │   ├── def api_update_eligible_repos(ctx) # Returns a mapping of repositories eligible for semantic updates based on the presence of a pyproject.toml file.
│   │       │   └── def api_update_scaffold(ctx) # Injects the semantic-release configuration and establishes the initial version directly through the Event Ledger.
│   │       ├── ext_update.js       # Release preview and publish UI.
│   │       │   └── class InSetuExtUpdate # [comment required]
│   │       └── vendor.json         # Map of core third-party UI dependencies (Lit, CodeMirror).
│   ├── fallback_bridge.py          # Immutable Recovery OS and Zero-JS Lifeboat UI.
│   │   ├── def expand_macros(text) # [stale?] Expands intentional Yomama semantic multiplier macros ({{ c * N }}, ccc).
│   │   ├── def parse_blocks(text)  # [comment required]
│   │   ├── def apply_block_in_memory(content, block) # [comment required]
│   │   ├── def index_redirect()    # [comment required]
│   │   ├── def recovery_auth_bootstrap() # Allows reboot polling loops (from both main OS and recovery UI) to detect when the server is in recovery mode.
│   │   ├── def index()             # [comment required]
│   │   ├── def bridge_sync()       # [comment required]
│   │   ├── def fs_list()           # [comment required]
│   │   ├── def download(filepath)  # [comment required]
│   │   ├── def api_emergency_dump() # Zero-dependency hardcoded compiler that survives core config corruption.
│   │   ├── def system_reboot()     # [comment required]
│   │   └── def run_recovery_app()  # [comment required]
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
│   ├── vendor_codemirror.sh        # Bundles CodeMirror 6 core and language modules locally via esbuild.
│   ├── vendor_jsyaml.sh            # Local esbuild vendorization script for js-yaml library.
│   ├── vendor_lit.sh               # Local esbuild vendorization script for Lit library.
│   ├── vendor_lock.py              # Vendors sutram/yenVUI with stale-file pruning and records the build in sutram.lock.json.
│   │   ├── def tree_digest(vendor_root) # Returns (sha256, file_count) over every file under the BUILD_MAP destinations, keyed by relative path.
│   │   ├── def read_sutram_version(sutram_root) # Reads [project].version from sutram's pyproject.toml without tomllib (Python 3.10 has none).
│   │   ├── def read_git_state(sutram_root) # Returns (HEAD commit, dirty) for the vendored paths, or (None, False) when sutram_root is not a git checkout.
│   │   ├── def sync(sutram_root, vendor_root, source) # Vendors sutram into vendor_root, deletes files sutram no longer has, and writes the lock.
│   │   ├── def check(vendor_root, strict) # Returns a list of problems with the vendored files against the lock (empty when they match).
│   │   └── def main(argv)          # [stale?] CLI entry point: 'sync <sutram_root> <vendor_root> [source]' or 'check <vendor_root>'.
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
    │   └── rules_python.py         # Python AST linter enforcing async barriers and context accessors.
    │       ├── class BackendFitnessVisitor(ast.NodeVisitor) # [comment required]
    │       └── def check_python_files() # [comment required]
    ├── fitness_functions.py        # Master CLI runner for the architectural fitness linter suite.
    ├── run_unit_tests.py           # Master CLI runner for behavioral unit and integration test suite.
    └── unit/                       # Dynamic behavioral unit and integration test suite.
        ├── __init__.py             # Module initialization.
        ├── test_agent_orchestrator_and_mcp.py # Unit tests for LLM semantic tier routing, declarative YAML routines, /undo rollback, and MCP JSON-RPC.
        │   └── class TestAgentOrchestratorAndMcp(unittest.TestCase) # [comment required]
        ├── test_bridge_anchor_invariants.py # Regression and fitness tests for patch anchor matching, blank-line fidelity, no-op detection, chunk blame isolation, and the single patch engine.
        │   └── class TestBridgeAnchorInvariants(unittest.TestCase) # Regression and fitness tests for patch anchor matching, no-op detection, chunk blame isolation, and the single patch engine.
        ├── test_canonical_uris.py  # Unit tests for canonical URI enforcement, InSetuURI normalization, and legacy ledger migrations.
        │   └── class TestCanonicalURIs(unittest.TestCase) # [comment required]
        ├── test_cartographer_and_bridge_ast.py # Unit tests for Cartographer AST symbol extraction, 3-tier waterfall indexing, and Yomama RELOCATE/RENAME.
        │   └── class TestCartographerAndBridgeAst(unittest.TestCase) # [comment required]
        ├── test_cartographer_file_descriptions.py # Tests that the Cartographer derives file descriptions from docstrings instead of leaving placeholders.
        │   ├── class TestDescribeSourceFile(unittest.TestCase) # describe_source_file reads module docstrings and leading file comments, never symbol docs.
        │   └── class TestMapRepositoriesFileFallback(unittest.TestCase) # map_repositories describes a new file from its docstring when the index has no line for it.
        ├── test_config_cascade.py  # Unit tests for the 3-tier configuration cascade, secret encryption, and lazy migration.
        │   └── class TestConfigurationCascade(unittest.TestCase) # [comment required]
        ├── test_ext_preview_unit.py # Unittest suite for passive framework detection and preview server lifecycle.
        │   └── class TestExtPreviewUnit(unittest.TestCase) # [comment required]
        ├── test_fallback_bridge.py # Unit tests for the Lifeboat recovery bridge block parser, genesis patches, and recovery endpoints.
        │   └── class TestFallbackBridge(unittest.TestCase) # [comment required]
        ├── test_forwarded_header_rule.py # Tests the FORWARDED_HEADER_MEMBRANE fitness rule that keeps forwarding-header reads in akasa.
        │   └── class TestForwardedHeaderMembraneRule(unittest.TestCase) # S1: inSetu never reads client-identity forwarding headers; akasa's classify_peer() is the single source of truth.
        ├── test_import_order.py    # Ensures every core entry point imports first in a fresh interpreter (sdk/utils_core cycle).
        │   └── class TestImportOrder(unittest.TestCase) # Every core entry point must import cleanly as the FIRST insetu import of a fresh interpreter (sdk <-> utils_core cycle).
        ├── test_lifeboat_targets.py # The lifeboat resolves vfs:// patch targets like the main bridge and never writes outside the workspace.
        │   └── class TestLifeboatTargets(unittest.TestCase) # The lifeboat resolves vfs:// patch targets like the main bridge and never writes outside the workspace.
        ├── test_lit_template_rules.py # Tests that Lit ${...} bindings are stripped before sutram-btn label matching.
        │   └── class TestLitTemplateRuleHelpers(unittest.TestCase) # The sutram-btn label rule must not mistake '=>' inside a Lit binding for the end of the tag.
        ├── test_llm_pool_precedence.py # Tests LLM routing precedence: saved pool, then explicit legacy settings, then the default pool.
        │   └── class TestLlmPoolPrecedence(unittest.TestCase) # [stale?] Routing precedence: saved pool/profiles, then explicitly saved legacy settings, then the schema's default pool.
        ├── test_macro_escapes.py   # Tests that transport macros expand in files documenting them, literal tokens via brace macros, and lifeboat parity.
        │   └── class TestMacroEscapes(unittest.TestCase) # The namespaced transport macro always expands, even in files that document it, and both bridges agree.
        ├── test_publish_extension.py # Unit tests for document publishing compilation and ephemeral wordcount macro stripping.
        │   └── class TestPublishExtension(unittest.TestCase) # [comment required]
        ├── test_remote_identity.py # Tests whois-verified Tailscale identity, bootstrap integration, settings migration, and allowed hosts.
        │   ├── class TestTailscaleIdentityProvider(unittest.TestCase) # S1: Route B authenticates Tailscale devices only after whois verification of the trusted client IP.
        │   ├── class TestRemoteBootstrapIntegration(unittest.TestCase) # S1 end to end: akasa's /auth/bootstrap plus the insetu Tailscale provider and Host gate.
        │   └── class TestRemoteSettingsLifecycle(unittest.TestCase) # Settings migration from the retired 'tailscale' extension, configured hosts, and the preview helper.
        ├── test_routine_response_path.py # Tests that routine response_path writes only document files and refuses code targets.
        │   └── class TestRoutineResponsePath(unittest.TestCase) # A routine's response_path writes documents directly; code targets must go through bridge.sync.
        ├── test_sdk_improvements.py # Unit tests for ctx.create_entity_file, declarative volume migrations, and worker contract fitness rules.
        │   └── class TestSdkImprovements(unittest.TestCase) # [comment required]
        ├── test_settings_scope_rule.py # Tests that SETTINGS_SCOPE_MANDATE skips nested item_schema and fields sub-fields.
        │   └── class TestSettingsScopeRule(unittest.TestCase) # SETTINGS_SCOPE_MANDATE applies to top-level setting fields only; nested sub-fields inherit their parent's scope.
        ├── test_sutram_compliance.py # Unit tests verifying Sutram consumer linter and JavaScript fitness compliance across core and extensions.
        │   └── class TestSutramCompliance(unittest.TestCase) # [stale?] Executes Sutram's official consumer linter and inSetu's JavaScript fitness rules against inSetu core UI components and domain extensions to...
        ├── test_vendor_lock.py     # Tests sutram.lock.json provenance, stale-file pruning, drift detection, and the committed vendor tree.
        │   └── class TestVendorLock(unittest.TestCase) # sutram.lock.json records the vendored sutram build and catches drift between the lock and the committed files.
        ├── test_vfs_three_way_merge.py # Unit tests for 3-way OCC text merging, ancestor ring buffers, and conflict fallback files.
        │   └── class TestVfsThreeWayMerge(unittest.TestCase) # [comment required]
        ├── test_workspace_mounts.py # Unit tests for InterWorkspaceVFSDriver, ws:// read-only write barriers, and cross-workspace event broadcasting.
        │   └── class TestWorkspaceMounts(unittest.TestCase) # [comment required]
        └── test_workspace_swap_fsm.py # Behavioral unit tests for the synchronous workspace swap FSM and Bound-Scope StoreRegistry hydration.
            └── class TestWorkspaceSwapFSM(unittest.TestCase) # [stale?] Behavioral and structural unit tests for the Synchronous Workspace Swap FSM: - Pattern 1: Bound-Scope Store Persistence (_boundScope, _scope...
```
