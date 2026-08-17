# inSetu Kernel Code Index

This index serves as the architectural map. It outlines the core directories and their operational purpose to maintain a clear mental model of the ecosystem, preventing cognitive overload and logic drift.

```text
insetu/
├── .gitignore                      # Defines intentionally untracked files and volatile state to ignore.
├── .gitkeep                        # Git folder retention.
├── CHANGELOG.md                    # Auto-generated semantic release changelog.
├── CODE_INDEX.md                   # Topological map of the inSetu repository (this file).
├── LICENSE                         # Apache License 2.0 open-source distribution terms.
├── NOTICE                          # Third-party dependency attributions and bundled software notices.
├── README.md                       # Primary project overview, architecture, and installation guide.
├── docs/                           # Internal Documentation and Architecture.
│   ├── 00_index.md                 # Master Index for inSetu.
│   ├── 01_engineering_standards.md # Engineering standards and audit guardrails.
│   ├── 02_extension_api_contract.md # Extension architecture and API contracts.
│   ├── 03_extension_inventory_topology.md # Living inventory of active/planned extensions.
│   ├── 04_ui_design_standards.md   # UI/UX design standards and guardrails.
│   ├── 05_extension_developer_guide.md # Extension developer guide ("Pit of Success").
│   ├── 06_extension_compliance_checklist.md # Extension compliance checklist and audit guardrails.
│   ├── ADR_INDEX.md                # Ledger of Logic for inSetu ADRs.
│   ├── adrs/                       # Architectural Decision Records.
│   │   ├── 0002-workspace-physics-and-extensions.md # Defines the tenant workspace boundaries and extension loading.
│   │   ├── 0004-asynchronous-vfs-commit-pipeline.md # Defines the non-blocking VFS write queue and thread safety.
│   │   ├── 0006-tenant-isolated-compilation-locks.md # Defines thread-local locks for RAG payload compilations.
│   │   ├── 0007-stateless-ui-factory-and-component-decoupling.md # UI decoupling from business logic via Zustand UDF.
│   │   ├── 0008-offline-first-synchronization.md # Offline capabilities and Service Worker caching.
│   │   ├── 0009-ephemeral-artifacts-and-immediate-jobs-ledger.md # Management of short-lived job artifacts and garbage collection.
│   │   ├── 0010-vfs-boundary-exemptions.md # Rules for paths exempt from strict VFS isolation.
│   │   ├── 0011-vfs-barrier-synchronization.md # Synchronization barriers for asynchronous VFS flushes.
│   │   ├── 0013-posix-compliant-pathlib-migration.md # Standardization on POSIX paths for cross-platform parity.
│   │   ├── 0014-event-bus-tenant-authorization.md # Authorization rules for cross-tenant event bus emissions.
│   │   ├── 0015-codemirror6-migration.md # Transition from legacy editors to CodeMirror 6.
│   │   ├── 0016-explicit-api-client-and-fetch-deprecation.md # Mandates the use of the centralized inSetu API client.
│   │   ├── 0017-extension-sdk-and-pit-of-success.md # Defines the InSetuExtension and InSetuElement base classes.
│   │   ├── 0018-event-sourced-vfs-ledger.md # SQLite event sourcing for VFS mutations and Watchdog events.
│   │   ├── 0021_standardized_state_isolation.md # Unidirectional Data Flow and tenant state isolation.
│   │   ├── 0022-differential-context-compilation.md # Surgical updates to RAG contexts avoiding full recompilation.
│   │   ├── 0023-polymorphic-entity-action-card-registry.md # Dynamic context-aware actions for UI entity cards.
│   │   ├── 0024-frontend-sdk-decoupling-and-domain-accessors.md # Front-end SDK abstraction (this.vfs, this.sys, this.editor).
│   │   ├── 0025-declarative-app-shell-and-brokered-resource-management.md # Declarative UI layout definitions and slot brokering.
│   │   ├── 0026-unified-token-gatehouse-and-tailscale-auth.md # Centralized REST/WebSocket authentication and Tailscale WHOIS.
│   │   ├── 0027-global-multi-select-and-batch-action-registry.md # Global UI selection tray and batch action execution.
│   │   ├── 0028-native-hash-routing-and-event-bus.md # Zero-bundler SPA routing using URL hashes.
│   │   ├── 0029-core-kernel-extraction-and-three-tier-architecture.md # Separation of Kernel, Core OS, and Domain Extensions.
│   │   ├── 0030-kernel-utility-bisect-and-domain-relocation.md # Decoupling kernel utilities from core OS domains.
│   │   ├── 0031-sutram-micro-kernel-vendorization-and-vfs-ledger-unification.md # Vendorizing Sutram and merging VFS tracking ledgers.
│   │   ├── 0032-dynamic-polyglot-vendorization-and-importmap-resolution.md # Import map strategies for offline-first vendor libraries.
│   │   ├── 0033-kernel-package-encapsulation-and-root-wrapper-cleanup.md # Moving kernel dependencies to isolated packages (akasa).
│   │   ├── 0034-async-job-action-binding-and-gather-decoupling.md # Binding UI actions directly to background polling jobs.
│   │   ├── 0035-vfs-file-resolution-hooks-and-topology-gateway.md # Centralized resolution of logical vfs:// and ctx:// paths.
│   │   ├── 0036-vfs-manifest-sqlite-cqrs-and-delta-sync.md # Moving manifest indexing from JSON to SQLite CQRS.
│   │   ├── 0037-gather-inversion-of-control-topology.md # Inverting context assembly dependencies to Cartographer.
│   │   ├── 0038-decoupled-topology-engine-partitioned-manifest-two-stage-slew-limiting.md # Stage 1 (VFS) and Stage 2 (CTX) slew limiters.
│   │   ├── 0039-decentralized-manifest-signature-sync-and-topology-boot.md # Syncing manifest signatures statelessly on UI boot.
│   │   ├── 0040-system-configuration-ssot-and-multi-scoped-settings.md # Centralized settings schema definition and hierarchical scope isolation (daemon, workspace, repo).
│   │   ├── 0041-deprecation-of-ui-zones-and-presentation-decoupling.md # Deprecation of UI zones and presentation decoupling.
│   │   └── archived/               # [comment required]
│   │       ├── 0001-insetu-genesis-and-extension-architecture.md # [comment required]
│   │       ├── 0003-stateless-multi-tenant-routing.md # [comment required]
│   │       ├── 0005-transport-shell-decoupling.md # [comment required]
│   │       └── 0012-extension-subdirectory-extraction.md # [comment required]
│   └── sdk_v2_contracts.md         # Interface contracts for the V2 extension SDK.
├── insetu/                         # Python application package.
│   ├── .gitkeep                    # Git folder retention.
│   ├── app.py                      # [Micro-Kernel & Extension Bootloader]
│   ├── cli.py                      # [Daemon & Process Management]
│   ├── core/                       # Core frontend SDK and UI components.
│   │   ├── __init__.py             # Module initialization.
│   │   ├── bridge/                 # Yomama Sync Bridge and AST validation engine.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── bridge_fuzzy.py     # Fuzzy matching and fallback regex algorithms.
│   │   │   ├── bridge_parser.py    # Deprecated string parsing engine.
│   │   │   ├── bridge_vfs.py       # Async VFS commit pipelines and concurrency locks.
│   │   │   └── engine_bridge.py    # [Yomama Sync Bridge Transaction Logic]
│   │   ├── cartographer/           # Autonomous topology mapping and CODE_INDEX generation.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   └── cartographer.py     # [VFS Topology Mapper]
│   │   ├── editor/                 # Global CodeMirror editor settings.
│   │   │   └── engine_editor.py    # Editor preferences and markdown link configurations.
│   │   ├── gather/                 # RAG Context compiler and manifest synchronizer.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   └── engine_gather.py    # [Context Compiler and Workflow Batch routing]
│   │   ├── routes_fs.py            # [VFS Substrate & File Mutations]
│   │   ├── routes_system.py        # [Config & Workspace Transport]
│   │   ├── sdk/                    # Developer SDK namespace.
│   │   │   └── __init__.py         # Module initialization.
│   │   ├── topology/               # Central SSOT for logical workspace topologies.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   └── engine_topology.py  # Tracks the active layout of repositories and buckets.
│   │   └── utils_core.py           # [Workspace Physics & Universal Utils]
│   ├── defaults/                   # Base templates for workspace scaffolding.
│   │   ├── .gitkeep                # Git folder retention.
│   │   ├── config_json.txt         # [comment required]
│   │   ├── engine_template_py.txt  # Boilerplate Python engine template for new extensions.
│   │   ├── ext_template_js.txt     # Boilerplate Lit component template for new extensions.
│   │   ├── gitignore.txt           # Base .gitignore to protect local SQLite DBs and secrets.
│   │   └── system_json.txt         # [comment required]
│   ├── extensions/                 # Tier 3 Domain Extensions (Opt-in functionality).
│   │   ├── __init__.py             # Module initialization.
│   │   ├── citations/              # CSL-JSON Academic Reference Library.
│   │   │   ├── engine_citations.py # [Local CSL Reference Manager]
│   │   │   └── ext_citations.js    # [Citations Manager UI & Store]
│   │   ├── dev/                    # Developer Dashboard for bridge telemetry and thrashing.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_dev.py       # Bridges and VFS performance logging.
│   │   │   └── ext_dev.js          # Dashboard UI for metrics display.
│   │   ├── favorites/              # Pinned file and folder quick-access tray.
│   │   │   ├── engine_favorites.py # SQLite store for quick-access items.
│   │   │   └── ext_favorites.js    # UI tray and management for favorites.
│   │   ├── flow/                   # Workflow batch automation and Prompt template executor.
│   │   │   ├── engine_flow.py      # Automation engine for chained tasks.
│   │   │   └── ext_flow.js         # Workflow builder and execution UI.
│   │   ├── format/                 # Pandoc document publishing and jsbeautifier formatting.
│   │   │   ├── engine_format.py    # [Document Compilation and formatting logic]
│   │   │   └── ext_format.js       # Formatting UI and publishing modals.
│   │   ├── freshdesk/              # Helpdesk integration for threaded B2B support tickets.
│   │   │   ├── engine_freshdesk.py # Helpdesk API interactions and thread logging.
│   │   │   └── ext_freshdesk.js    # Ticket viewing and response UI.
│   │   ├── git/                    # Version control, branch management, and workspace sweeping.
│   │   │   ├── engine_git.py       # [Git Operations & Diff Generator]
│   │   │   └── ext_git.js          # [Git Push & Sweep UI]
│   │   ├── hooks/                  # IFTTT-style automation hooks based on VFS and topology events.
│   │   │   ├── engine_hooks.py     # Evaluates VFS events against registered hooks.
│   │   │   └── ext_hooks.js        # UI for creating and managing hooks.
│   │   ├── ingest/                 # URL to Markdown extraction via Jina or BeautifulSoup.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_ingest.py    # URL fetching and parsing logic.
│   │   │   └── ext_ingest.js       # UI modal for URL ingestion.
│   │   ├── notes/                  # Markdown note-taking interface with frontmatter management.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_notes.py     # SQLite ledger tracking for markdown notes.
│   │   │   └── ext_notes.js        # Note-taking editor and browser.
│   │   ├── prompts/                # Management of global prompt templates and macro inclusions.
│   │   │   ├── engine_prompts.py   # Prompt discovery and resolution.
│   │   │   └── ext_prompts.js      # Prompt UI and embedding tool.
│   │   ├── publish/                # Standalone Pandoc/LaTeX document publishing extension.
│   │   │   ├── __init__.py         # Module initialization.
│   │   │   ├── engine_publish.py   # Document publishing and compilation engine.
│   │   │   ├── ext_publish.js      # Document publishing UI and modal controls.
│   │   │   └── vendor.json         # Map of core third-party UI dependencies (Lit, CodeMirror).
│   │   ├── research/               # Map-Reduce web scraping, SERP indexing, and AI triage.
│   │   │   ├── engine_research.py  # [Web Search & Triage Inbox]
│   │   │   └── ext_research.js     # [Research Inbox UI & Triage]
│   │   ├── skills/                 # Spaced-repetition tracking for discrete musical/technical skills.
│   │   │   ├── engine_skills.py    # Skill tracking algorithms and SQLite storage.
│   │   │   └── ext_skills.js       # Spaced-repetition training UI.
│   │   ├── tailscale/              # Zero-trust networking integration and Tailscale Serve auto-binding.
│   │   │   ├── engine_tailscale.py # Tailscale background worker logic.
│   │   │   └── ext_tailscale.js    # Tailscale configuration UI.
│   │   ├── term/                   # Embedded terminal multiplexer and PTY WebSocket stream.
│   │   │   ├── engine_term.py      # [Terminal Multiplexer API]
│   │   │   ├── ext_term.js         # [Terminal Emulator UI]
│   │   │   └── vendor.json         # Map of core third-party UI dependencies (Lit, CodeMirror).
│   │   ├── tracker/                # Local offline Kanban board using Markdown-as-Code tickets.
│   │   │   ├── engine_tracker.py   # [Kanban Issue Tracker & Cache]
│   │   │   └── ext_tracker.js      # [Kanban Board UI & Store]
│   │   └── update/                 # Automated Python semantic versioning and PyPI distribution.
│   │       ├── __init__.py         # Module initialization.
│   │       ├── engine_update.py    # Python-semantic-release orchestration.
│   │       ├── ext_update.js       # Release preview and publish UI.
│   │       └── vendor.json         # Map of core third-party UI dependencies (Lit, CodeMirror).
│   ├── kernel/                     # Tier 1 Micro-Kernel Substrate (To be extracted to 'akasa').
│   │   ├── auth.py                 # Central REST/WS token gatehouse and Tailscale WHOIS.
│   │   ├── db.py                   # [SQLite Connection Pooling]
│   │   ├── extension.py            # The InSetuExtension and ExtensionContext SDK wrappers.
│   │   ├── fallback_bridge.py      # Immutable Recovery OS and Zero-JS Lifeboat UI.
│   │   ├── hooks.py                # The central synchronous and asynchronous Event Bus.
│   │   ├── sync.py                 # Telemetry aggregation for the UI status heartbeat.
│   │   ├── types.py                # Central Tier 1 Kernel type definitions and protocol contracts.
│   │   ├── utils.py                # Domain-agnostic kernel utilities and physics resolution.
│   │   ├── vfs.py                  # Asynchronous Virtual File System write queue and barriers.
│   │   └── workers.py              # Background Metronome task scheduler and SQLite jobs ledger.
│   ├── static/                     # Web server static assets and frontend bundles.
│   │   ├── css/                    # Global CSS stylesheets.
│   │   │   └── style.css           # Global theme variables, utility classes, and layout rules.
│   │   ├── js/                     # [Frontend JavaScript Payloads]
│   │   │   ├── app.js              # [Frontend Bootloader & Core Setup]
│   │   │   ├── core/               # Core frontend SDK and UI components.
│   │   │   │   ├── api.js          # Centralized API fetch wrapper and token injector.
│   │   │   │   ├── bridge.js       # [Sync Bridge Payload UI]
│   │   │   │   ├── components/     # Reusable Lit Web Components for the OS.
│   │   │   │   │   ├── ui_editor.js # CodeMirror 6 markdown and frontmatter editor wrappers.
│   │   │   │   │   ├── ui_file_tree.js # Recursive file tree browser with fuzzy search.
│   │   │   │   │   ├── ui_filter_pills.js # Repository and tag filtering arrays.
│   │   │   │   │   ├── ui_primitives.js # Base primitives like job trackers and loading spinners.
│   │   │   │   │   └── ui_system_settings.js # The 3-Tier Configuration Editor and OS Settings Hub.
│   │   │   │   ├── config.js       # UI for managing repository topologies and tracked buckets.
│   │   │   │   ├── fs.js           # [Virtual File System Modals & UI]
│   │   │   │   ├── gather.js       # [Context Batch & Workflow UI]
│   │   │   │   ├── sdk.js          # The InSetuElement base class and Zustand store factory.
│   │   │   │   ├── shared_styles.js # Proxy export pointing to the Sutram micro-kernel.
│   │   │   │   ├── store.js        # [Zustand Unified Data Flow (UDF) Store]
│   │   │   │   └── types.js        # Root JSDoc type definitions entry point.
│   │   │   └── types.js            # Root JSDoc type definitions entry point.
│   │   ├── manifest.json           # Progressive Web App (PWA) manifest.
│   │   ├── sw.js                   # Service Worker for offline-first asset caching.
│   │   └── vendor.json             # Map of core third-party UI dependencies (Lit, CodeMirror).
│   └── templates/                  # Jinja2 HTML templates.
│       └── index.html              # The master SPA entry point containing the OS crash shell.
├── pyproject.toml                  # Python package definition and semantic-release configurations.
├── scripts/                        # Build, vendorization, and utility shell scripts.
│   ├── .gitkeep                    # Git folder retention.
│   └── vendor_codemirror.sh        # Bundles CodeMirror 6 core and language modules locally via esbuild.
└── tests/                          # Automated testing suite.
    ├── fitness/                    # The AST and Regex architectural linter rules.
    │   ├── __init__.py             # Module initialization.
    │   ├── core.py                 # Core validation logic and whitelist definitions.
    │   ├── rules_css.py            # CSS linter enforcing intent tokens and banning !important.
    │   ├── rules_javascript.py     # JS linter enforcing UDF, declarative UI, and API contracts.
    │   └── rules_python.py         # Python AST linter enforcing async barriers and context accessors.
    ├── fitness_functions.py        # The master script for executing the architectural validation suite.
    └── results.txt                 # The output log of the last fitness test run.
```
