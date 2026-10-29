# ADR 0068: Hierarchical VFS Sieve, Sub-Bucket Pattern Filtering, Unified Settings Hub, and Chatbot Artifact Healing

## Status
Accepted (2026-10-19)

## Context
As the inSetu Workbench expanded its multi-tenant topology and AI-collaborative capabilities, several architectural seams required definitive resolution:
1. **File Sieve Inconsistency & Leaky Ignores**: File exclusion logic was duplicated between `get_valid_workspace_files()` in `engine_topology.py`, `resolve_topology_buffer()`, and the filesystem observer in `utils_core.py`. Pattern matching lacked standard `.gitignore` semantics (such as directory-only trailing slashes `archived/`, root anchors `/build/`, and sequential `!negation` rules). Additionally, repository-level overrides did not cleanly honor the Nullable Override Cascade (where an explicit empty array `[]` overrides global ignores, while `null`/omitted inherits global defaults).
2. **Sub-Bucket Extraction Ambiguity**: When routing files within repositories to specialized Sub-Buckets, operators lacked the ability to omit files entirely from compilation (dropping them from both the sub-bucket and Bucket 0) or to intentionally pass files through to subsequent buckets without claiming them.
3. **Settings UX Fragmentation & Modal Overlay Traps**: Configuration surfaces were scattered across disjoint modals (`<sutram-generic-settings>`, `<insetu-ext-config>`, `manageExtOpen`, `mountsModalOpen`) and horizontal tabs. Editing a repository launched a nested modal inside the configuration modal, creating overlay click-blocking bugs and breaking keyboard navigation.
4. **Chatbot Transport Artifact Bleed**: When receiving Yomama patch sandwiches from diverse LLMs, models frequently appended conversational markdown fences to `>>>>>>> REPLACE` (chevron meltdown), wrapped vertical pipe characters in LaTeX math mode (`$... | ...$`), or leaked internal citation tags (``, ``, ``). These transport artifacts caused anchor matching failures on otherwise mathematically sound patches.
5. **Memory Fragmentation & Truncated Buffer Risk**: Long-running Python daemons on Linux experienced glibc heap fragmentation from thread-pool worker bursts. In the frontend, large text buffers (>200KB) truncated for rendering performance risked irreversible data loss if saved back to disk.

## Decision
1. **Hierarchical VFS Sieve with Standard `.gitignore` Semantics (`engine_topology.py`)**:
   - Centralized all repository file evaluation into `is_file_tracked_by_sieve(rel_path, config, live_cfg, repo_dir)`.
   - Built `matches_gitignore_patterns(rel_path, patterns)` backed by `_compile_gitignore_regex()`, supporting trailing-slash directory matching (`archived/`), root-anchored paths (`/build/`), floating globs, `**` wildcard traversal, and sequential `!negation` overrides with LRU regex compilation caching.
   - Enforced the Nullable Override Cascade: repository-level keys (`repo_ignore_dirs`, `repo_ignore_files`, `repo_ignore_patterns`, `exts`, `repo_managed_dirs`) override global defaults when non-null (even if empty `[]`), and inherit global baselines when `null`/omitted.
   - Routed `resolve_topology_buffer()`, `get_valid_workspace_files()`, and `FileSystemObserver` through this centralized sieve.
2. **Sub-Bucket Sieve Pattern Cascades (`drop_patterns` vs. `ignore_patterns`)**:
   - Enhanced `resolve_file_bucket()` to evaluate two `.gitignore`-syntax pattern arrays per sub-bucket:
     - `drop_patterns`: Omitted from both the sub-bucket context payload and Bucket 0 (`main`). Returns `_DROPPED_BUCKET_SENTINEL` (`id: "_dropped"`, `exclude_from_context: True`, `exclude_from_diffs: True`).
     - `ignore_patterns`: Bypasses the sub-bucket, allowing subsequent sub-buckets or Bucket 0 (`main`) to claim the file.
3. **OS Settings Hub Architectural Consolidation (`ui_system_settings.js`, `config.js`)**:
   - Eradicated fragmented modals and horizontal tabs in favor of a unified Settings Hub featuring breadcrumb navigation (`hub-breadcrumb-bar`), category pills (`All`, `System & Workspace`, `Core Engines`, `Extensions`), and live fuzzy search across module titles, IDs, descriptions, and field schemas.
   - Converted "Virtual Mounts & Asset Sharing" and "Manage Workspace Extensions" into in-place drill-down views with centralized footer action bars.
   - Converted repository configuration in `config.js` into an in-place drill-down view (`renderRepoDrillDown`) with sticky breadcrumb navigation, eliminating nested modal overlays.
   - Set `export_shared_domains` and `shared_mounts` in `SYSTEM_SETTINGS_SCHEMA` to `type: "hidden"`.
4. **Chatbot Transport Artifact Healing Pipeline (`bridge_fuzzy.py`, `bridge_vfs.py`, `bridge.js`)**:
   - Implemented `heal_llm_block_artifacts(text, reference_content)`:
     - `heal_chevron_meltdown`: trims trailing markdown fences and conversational chatter following the final `>>>>>>> REPLACE`.
     - `heal_latex_vert`: repairs Gemini math-mode pipe escapes (`|` to `|`) bounded by `$...$`.
     - `heal_citation_artifacts`: strips leaked LLM citation tags (``, ``, ``, ``).
   - Integrated artifact healing into `apply_block_in_memory` and `_process_sync_transaction`.
   - Added `view-syntax-error` report projection in `bridge.js`.
5. **Process Memory Telemetry & Glibc Arena Management (`engine_system.py`, `cli_commands.py`)**:
   - Added `GET / POST /api/<workspace_id>/system/memory` inspecting process RSS/VmData/VmPeak, kernel caches (`_VFS_READ_CACHE`, `_JSON_CACHE`, `_VFS_WRITE_QUEUE`), top Python object types in GC, tracemalloc snapshots, and active threads, with on-demand `action=trim` memory reclamation.
   - Enforced `MALLOC_ARENA_MAX=2` in systemd units and daemon reboot loops.
6. **VFS Safety Guardrails & Export Standardization (`fs.js`, `gather.js`)**:
   - In `saveBufferFile`, added guard `if (!state || state.isTruncated) return;` preventing truncated 200KB buffers from corrupting files on disk. Enforced `shouldBeReadOnly = !(isFS || forceEdit) || isTruncated`.
   - Centralized export targets across clipboard, share, and download in `resolveEntityExportTarget()`.
   - Added `alwaysInclude: f => f.finalCat === 'Quickpacks'` in Gather `filterItems`.
   - Replaced `ThreadPoolExecutor` calls in `cartographer.py` and `engine_gather.py` with `akasa.workers.run_parallel` and `ctx.jobs.map_parallel`.

## Consequences
* **Positive**: Deterministic, single-source-of-truth file inclusion adhering strictly to industry-standard `.gitignore` semantics.
* **Positive**: Granular sub-bucket filtering via `drop_patterns` and `ignore_patterns`.
* **Positive**: Complete elimination of nested modal overlay traps and click-blocking bugs across Settings and Config surfaces.
* **Positive**: Resilient patch application that absorbs chatbot transport formatting artifacts automatically.
* **Positive**: Hardened process memory management and complete elimination of truncated buffer disk corruption.
* **Negative**: Complex `.gitignore` patterns with extensive `**` paths add minor regex evaluation overhead (mitigated by LRU compilation caching).