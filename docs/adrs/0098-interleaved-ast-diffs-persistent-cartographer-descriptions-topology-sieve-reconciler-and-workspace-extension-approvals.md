# ADR 0098: Interleaved AST Diffs, Persistent Cartographer Working Memory, Topology Sieve Reconciler, S8 Workspace Extension Approvals, and Universal Zero-CSS Modernization

## Status
Accepted (2026-11-03)

## Context
As the inSetu Developer OS broadened autonomous routine orchestration and cross-repository collaboration, several architectural seams across diff presentation, topographer working memory, topology sieve synchronization, extension security, and frontend presentation required structural consolidation:
1. **Unified Diff Context Scarcity & Window Drift**: Traditional unified diffs (`difflib.unified_diff`) render disjoint 3-line snippets that lack enclosing function or class boundaries. Models and developers reviewing turn diffs frequently suffered context truncation or anchor ambiguity because enclosing function signatures were omitted.
2. **Ephemeral Description Loss on Round-Trip Moves & Remounts**: When a file or directory temporarily left the topology (e.g., during unmounting, moving away and back, or branch switching), Cartographer dropped its description, reverting to `# [comment required]` upon remount. Furthermore, non-code files (Markdown frontmatter, shell scripts, TOML, JSON manifests, and licenses) lacked automated self-description.
3. **Topology Sieve Invalidation & Ignored File Leaks**: While full scans (`force_topology_scan`) queried git ignore rules, incremental edits to `.gitignore` or `config.json` left obsolete ledger rows in SQLite, leaking ignored build outputs into RAG contexts, selections, and Hebbian affinity graphs.
4. **Unsandboxed Workspace Extension Execution (S8)**: Extensions placed in `.insetu/extensions/` lacked cryptographic approval gates, allowing arbitrary code written by an agent or external tool to execute with the daemon's full rights on boot.
5. **Prompt Cascade Bleed & Premature Mustache Stripping**: Evaluating prompt macros previously clobbered outer `{{ sys.* }}` landmarks before routine DAGs could bind runtime repository context. Furthermore, prompts lacked repository-scoped storage under `<repo>/.insetu-data/prompts/`.
6. **Frontend API Inconsistency & Custom CSS Drift**: Modules across the core chassis still imported legacy `api.workspace` and `api.system` namespaces, and several views contained custom CSS blocks violating the Zero-CSS presentation standard (`CUSTOM_COMPONENT_CSS_BAN`).

## Decision
1. **Single-Stream AST-Enclosing Interleaved Diffs (`insetu/core/languages/__init__.py`, `engine_bridge.py`)**:
   - Implemented `format_interleaved_file_diff(filepath, base_content, current_content)`: expands modified hunks in `.py`, `.js`, `.ts`, and `.rs` to their full enclosing function, method, or class definitions, keeps top-level imports, and collapses untouched sibling functions to signatures with `... # [lines X-Y unchanged]` interface skeletons.
   - Upgraded `bridge.turn_diff` to render interleaved AST diffs for modified files alongside explicit blocks for newly created (`=== NEW FILE: {fp} ===`) and deleted (`=== DELETED FILE: {fp} ===`) files.
2. **Persistent Cartographer Working Memory & Directory Descriptions (`cartographer.py`, `languages/__init__.py`)**:
   - Introduced `file_descriptions` SQLite working memory tracking source attribution (`genesis_comment`, `code_index`, `code_index_orphan`) and a 90-day retention TTL (`ORPHANED_DESCRIPTION_TTL_SECONDS = 90 * 24 * 3600`), ensuring descriptions survive round-trip renames, volume remounts, and branch switches.
   - Added `describe_directory()` deriving directory purposes from child `README.md`, `__init__.py`, or `package.json` manifests.
   - Added `describe_source_file()` covering Markdown frontmatter/headings, shell/hash comments, TOML metadata, JSON manifests (`package.json`, `package-lock.json`), and software licenses.
   - Resolved canonical `CODE_INDEX.md` paths via `resolve_repo_code_index_uri()`, honoring `is_core_chassis` and custom repo `index_path` settings.
3. **Topology Sieve Reconciler & Clamped URIs (`engine_topology.py`, `context_assemble.py`)**:
   - Implemented `clamp_uris_to_topology(workspace_id, candidate_uris, expand_dirs=False, gather_only=False)`: clamps candidate paths against `topology_ledger` and expands folder prefixes into valid tracked files.
   - Added `reconcile_topology_on_config_mutated` (`@topology_bp.on('config_mutated', priority=20)`) and `_reconcile_repo_ledger_with_sieve()`: automatically evicts newly ignored or excluded rows and indexes newly tracked files when `.gitignore`, `.git/info/exclude`, or `config.json` changes.
   - Added the `models` landmark kind (`docs/models/*.md`, `docs/*mental_model*.md`) to `DEFAULT_LANDMARK_KINDS`.
   - Removed the 80-line truncation from `api_topology_overview`.
   - Centralized `sys.*` landmark variable construction into `build_sys_landmarks_context()` and deterministic repository inference into `infer_target_repo()`.
   - Implemented `prune_stale_affinity_edges(ctx, grace_period_seconds=14*86400)` in `context_assemble.py`.
4. **Two-Tier Fault Quarantine & S8 Human Approval Gate for Workspace Extensions (`engine_system.py`, `utils_core.py`, `ui_primitives.js`, `cli_commands.py`)**:
   - Implemented Degraded Boot mode: isolates failing Core and Tier 3 extension modules, displays a diagnostic quarantine banner, and preserves pinned layout slots via `<insetu-quarantined-slot-placeholder>`.
   - Built cryptographic fingerprint verification for user extensions in `.insetu/extensions/<name>/`, requiring explicit human approval (`system/extensions/workspace/approve`, `mcp_expose=False`) before code execution.
   - Added in-app "Review Files" and "Approve & Restart" workflows to `<insetu-config-banner>`.
   - Defaulted `insetu create-extension` to scaffold into `.insetu/extensions/`.
5. **Prompt Cascade Reader, Mustache Chaining & Repo-Scoped Prompts (`engine_prompts.py`, `prompts.js`, `utils_core.py`)**:
   - Centralized 3-tier cascade resolution in `read_prompt_with_cascade()` and macro expansion in `resolve_prompt_text()`.
   - Implemented `interpolate_mustache_chain()` and `resolve_context_var_path()` in `utils_core.py` to evaluate fallback chains (`{{ var | sys.* | default }}`) without premature template stripping.
   - Enabled repository-scoped prompt authoring under `vfs://{repo}/.insetu-data/prompts/` with automatic `.gitkeep` discovery and menu creation actions.
6. **Universal Repeater Secret Scoping & Mountable Domain Discovery (`utils_core.py`, `sdk/__init__.py`)**:
   - Centralized `get_repeater_secret()` and `set_repeater_secret()` with mandatory `scope: 'daemon' | 'workspace'`.
   - Added `get_mountable_data_domains()` dynamically enumerating all registered `tier: "data"` VFS volumes.
7. **Zero-CSS Presentation Modernization & Universal Sutram Membrane (`api.js`, `config.js`, `fs.js`, `offline_ui.js`, `ui_system_settings.js`, `ui_file_tree.js`, `ui_filter_pills.js`, `insetu_sdk.js`)**:
   - Completely eradicated `window.inSetu.api.workspace` and `api.system` in favor of flat canonical verbs (`get`, `post`, `delete`, `getJson`, `postJson`, `deleteJson`, `bindJobAction`).
   - Re-exported all symbols from `'sutram'` in `insetu_sdk.js` and purged redundant fallback classes.
   - Eradicated custom CSS blocks across all core modules, converting layouts to pure Sutram Lego primitives.

## Consequences
* **Positive**: Rich, function-enclosing interleaved diffs eliminating context truncation across turn diffs.
* **Positive**: Descriptions survive file moves, remounts, and branch switches via persistent working memory.
* **Positive**: Deterministic, zero-leak topology sieve synchronization on `.gitignore` and configuration edits.
* **Positive**: Cryptographic protection against arbitrary execution of unapproved workspace extension code.
* **Positive**: Clean prompt template composition supporting repository-scoped authoring and robust mustache fallbacks.
* **Positive**: 100% adherence to Zero-CSS presentation standards and flat canonical API routing across the frontend.
