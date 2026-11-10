---
title: "Plan: Two-Axis Markdown Database (md-db) & Tracker Streamlining"
description: "Migrate Tracker from status-folder file shuffling and setDynamicLayoutSlots tab repeaters to the unified md-db record/edge ledger, URI-stable in-place transitions, and single-slot capacity-adaptive lenses."
status: "planned"
repo: insetu
created_at: "2026-11-09"
models:
  - "vfs://insetu/docs/models/mddb_and_tracker.md"
  - "vfs://insetu/docs/models/proximity_filters_and_domain_jumps.md"
coordinates_with:
  - "2026-11-02-decomposing-god-objects-across-the-triad.md"
  - "2026-11-05-core-extension-sdk-abstractions.md"
tags: [plan, tracker, mddb, rag, schema, ui, streamlining]
---

# Plan: Two-Axis Markdown Database (`md-db`) & Tracker Streamlining

## Roadmap placement (2026-11-09)

- **Replaces legacy churn in God-Objects Wave 4.1 (`2026-11-02-decomposing-god-objects-across-the-triad.md`):** Do not split legacy `parent_tabs` / `global_views` repeaters or status-folder file shuffling into new modules only to delete them afterward. Execute this streamlining together with Wave 4.1 (or after 1.0 alongside the `md-db` RAG integration).

---

## 1. Context & What Gets Deleted

The current `tracker` extension (`engine_tracker.py` at ~760 LOC and `ext_tracker.js` at ~1,390 LOC) carries three sources of accidental complexity that violate `vfs://insetu/docs/models/mddb_and_tracker.md`:

1. **Physical File Shuffling on Transient Status Changes:**
   - Moving a ticket from `open` $\rightarrow$ `active` $\rightarrow$ `closed` physically relocates the `.md` file across `.insetu-data/tracker/<type>s/<status>/` directories, breaking `vfs://` URI stability, triggering redundant Watchdog/topology churn, and requiring a 240-line `enforce_declarative_tickets` background reconciliation job.
2. **Dynamic Tab Mutation (`setDynamicLayoutSlots`) & View Repeater Bloat:**
   - `ext_tracker.js` calls `ExtensionRegistry.setDynamicLayoutSlots('tracker', ...)` to inject 6 separate sub-tabs (`epics`, `sprints`, `todos`, `bugs`, `queue`, `log`) and ships ~350 lines of repeater UI (`parent_tabs`, `global_views`) just to filter by `tier` or `ticket_type`.
3. **File-Per-Subtask Fragmentation:**
   - Every 5-minute subtask requires its own physical `.md` file because `engine_tracker.py` only indexes Level-1 file frontmatter rather than Level-2 `##` / `###` heading-scoped sub-record spans.

### What This Plan Deletes
* `parent_tabs` and `global_views` settings schema entries and their repeater UI in `InSetuExtTrackerSettings`.
* `ExtensionRegistry.setDynamicLayoutSlots('tracker', ...)` calls in `ext_tracker.js` (and `setDynamicLayoutSlots` itself once no caller remains).
* Physical folder moves on `open <-> active <-> blocked <-> done` transitions in `transition_ticket` and `enforce_declarative_tickets`.
* Separate `todos`, `bugs`, `queue`, `epics`, `sprints`, and `log` sub-navigation tabs in favor of one canonical `tasks:tracker` slot with toolbar lens/filter pills.

---

## 2. Phased Sprints

### Sprint 1: Two-Tier `md-db` Indexer (`md_records` & `md_edges`), Sidecar vs. Primary Scopes & Layered Schema Resolution
Build the single `md-db` parser and SQLite ledger backing Extension Sidecars (`tracker`, `notes`, `skills`, `research`) and Primary-Surface `md-db` repositories.

- [x] [S1.T0] Upgrade `akasa/db.py` and `insetu/core/languages/`:
  - **Kernel DB Pool & Declarative Constraints (`vfs://akasa/akasa/db.py`):** Raise the per-workspace thread connection LRU limit in `get_connection` from `4` to `16`, and teach `apply_declarative_schema` to support `"__constraints__": [...]` (composite `PRIMARY KEY` / `UNIQUE` clauses) and `"__indexes__": [...]` (`CREATE INDEX IF NOT EXISTS ...` statements).
  - **Pure `MarkdownLanguageProvider` (`vfs://insetu/insetu/core/languages/markdown.py` & `languages/__init__.py`):** Implement a general-purpose `MarkdownLanguageProvider(BaseLanguageProvider)` (decoupled from `md-db` schema concepts) that understands native Markdown primitives and powers AST-enclosing interleaved Git diffs (`format_interleaved_file_diff`) on `.md` files:
    - `definitions()` & `scope_boundaries()`: Heading tree (`#`/`##`/`###`) with exact `start_line..end_line` spans and fenced blocks.
    - `imports()` & `exports()`: Relative/URI Markdown links (`[anchor](./rel.md#sec)`), `[[wikilinks]]`, Pandoc/CSL citation keys (`[@csl_id]`), `{{include_prompt:...}}`, heading anchor slugs, and bold lead-in terms (`**Term:**`), resolving relative links to canonical `vfs://` URIs with anchor/heading context for `assemble_blast_radius`.
    - `slice_interface()` & `extract_symbol_slice()`: Compresses large `.md` files to frontmatter + headings + bold definitions + links under the 12k token ceiling, and slices sections by heading title/slug.
  - **Slew-Limited `ctx://` & `ws://` Data Volume Events (`engine_topology.py`):** Extend `buffer_topology_events` and `_topology_slew_limiter_loop` to fold mutations on sovereign `ctx://` data volumes (excluding `ctx://contexts/` and `ctx://diffs/`) and `ws://` mounts into `topology_resolved` (`ctx_events`).
- [ ] [S1.T1] Create the dedicated Tier 2 Core module `insetu/core/mddb/` (`__init__.py`, `parser.py`, `engine_mddb.py`), register `"mddb"` in `CORE_MODULES_TUPLE` (`sdk/__init__.py`) and `_baseCore` (`insetu_sdk.js`) with a parity unit test, and expose `ctx.mddb` on `InSetuContext` (superseding SDK Abstraction 6's `iter_domain_markdown_entities` and unifying `create_entity_file` writes):
  - **Dedicated `mddb.db` Schema:** Register `md_records` (`PRIMARY KEY (db_scope, id)`) and `md_edges` (`PRIMARY KEY (source_scope, source_id, rel_type, target_scope, target_id)`) with declarative `__constraints__` and `__indexes__` on `mddb_bp`, supporting both intra-scope edges and cross-repo/cross-scope edges (`ur:*`, `cit:*`, `<repo>/<id>`, and cross-repo `vfs://` links), and subscribe to `topology_boot_complete` and `topology_resolved` (`events` + `ctx_events`).
  - **Scope Partitioning (`db_scope`):** Indexes Extension Sidecar roots (`vfs://<repo>/.insetu-data/<ext>/`, `ctx://<ext>/`, and `ws://` mounts under `db_scope = "ext:<ext>"`) separately from Primary-Surface `md-db` repositories (`vfs://<repo>/<kind_folder>/` under `db_scope = "repo:<repo>"`, ignoring `.insetu-data/`).
  - **Level 1 & Level 2 Relational Parsing & Domain Vocabulary Normalization (`insetu/core/mddb/parser.py` building on `MarkdownLanguageProvider`):** Layers `inSetu`'s YAML/`md-db` semantics on top of `MarkdownLanguageProvider` to extract root file records and `##` / `###` heading sub-record spans (`parent_id`, `seq_order = 1..N`, `start_line..end_line`, fenced ```` ```yaml ```` blocks, and `- [ ] [ID]` checklists). Normalizes domain-specific YAML vocabulary into canonical SQLite columns (`kind` / `type` $\rightarrow$ `tier` & `default_nature`; `nature_map` synonyms like `bug`/`error`/`regression` $\rightarrow$ `nature = "defect"`; `status_map` synonyms $\rightarrow$ `queue | open | active | blocked | done | archived`; field role aliases like `name` $\rightarrow$ `title`) while preserving raw domain terms in `properties_json`.
  - **3-Surface `mddb` SDK Contract (`ctx.mddb`, `mddb.*` REST routes, and `window.inSetu.mddb`):** Expose `get_schema`, `resolve_scope_for_uri`, `index_file`, `remove_file`, `sync_scope`, `query`, `get_record`, `get_attestations`, `get_backlinks`, `facets_summary`, `upsert_record`, `patch_record`, `spawn_template`, and `audit_upkeep` on `ctx.mddb` (and corresponding `mddb.*` routes and `window.inSetu.mddb` helpers as specified in `mddb_and_tracker.md` §7).
  - **Multi-Collection Schemas, Citations & Cross-Collection `md_edges` (`engine_mddb.py`):** Supports repositories with multiple distinct collections (`kinds`, e.g., `authors/`, `books_and_journals/`, `articles/`, `concepts/`), `applies_to` field scoping, `targets: [<kind>]` cross-collection foreign keys, and automatic `rel_type = "cites"` edges from resolved relative Markdown links and `[@csl_id]` citations in prose, exposing `mddb/backlinks` for instant `<1ms` citation/wikilink lookup in `ext_citations.js` and `ui_modals.js`.
  - **Centralized Template Variable Interpolation (`utils_core.py` & `insetu_sdk.js`):** Consolidate duplicate `\{\{\s*([^}|]+)(?:\|([^}]+))?\s*\}\}` regex parsers across `prompts`, `routines`, `tracker`, and `mddb` into canonical `extract_template_variables` / `interpolate_template_variables` helpers.
  - **Declarative `sidecar_buckets` on `InSetuExtension` (`sdk/__init__.py`):** Replace imperative `mutate_workspace_config` sub-bucket injection boilerplate in `engine_notes.py` and `engine_tracker.py` with a declarative `sidecar_buckets` specification on `InSetuExtension`.
  - **Core Pipeline Unification (`cartographer.py`, `gather.py`, `bridge.py`, `engine_topology.py`):**
    - Update `cartographer.py` (`exclude_prefixes=[".insetu-data/"]`) so all `.insetu-data/` sidecars are excluded from `CODE_INDEX.md` while Primary-Surface `md-db` folders are mapped.
    - Upgrade `resolve_relational_graph` in `insetu/core/gather/gather.py` to query `md_records` and `md_edges` in `mddb.db` instead of hardcoded `SELECT * FROM tracker_tickets`, expanding relational neighbors across all `md-db` scopes (`tracker`, `notes`, `skills`, and primary-surface repos).
    - Update `extract_ledger_commit_message` in `insetu/core/bridge/bridge.py` to recognize `status: done | closed | archived` and `.insetu-data/tracker/items/archived/`.
    - Extend `api_topology_audit_upkeep` in `engine_topology.py` to invoke `ctx.mddb.audit_upkeep(repo)` (validating bounded 2-level folder depth, `allowed_children`, and `ur:` / foreign-key integrity).
  - **Read-Only Agent & Query Context Integration:** Add `"mddb.query"`, `"mddb.record"`, `"mddb.attestations"`, and `"mddb.backlinks"` to `READ_ONLY_MODE_ALLOWED_CAPABILITIES` in `insetu/core/agent/orchestrator.py` and extend `resolve_query_context` in `insetu/core/gather/context_assemble.py`.
- [ ] [S1.T2] Implement Layered Schema Resolution in `insetu/core/mddb/engine_mddb.py` using `read_repo_tier_settings` (`engine_topology.py` `authority: repo_content`):
  - Register `MDDB_SETTINGS_SCHEMA` on `mddb_bp` declaring `kinds`, `fields`, `proximity_filters`, `domain_jumps`, and `hierarchy_levels` with `authority: "repo_content"` so `read_repo_tier_settings(ctx, repo, "mddb")` validates and caches `.insetu-data/settings/mddb.md` and `.insetu-data/settings.local/mddb.md`.
  - **Extension Sidecars (`ext:<name>`):** Resolve schema frontmatter from built-in extension defaults + `ctx://settings/<ext>.md` + `read_repo_tier_settings(ctx, repo, "<ext>")`.
  - **Primary-Surface Repos (`repo:<repo>`):** Resolve schema frontmatter from `ctx://settings/.templates/user/mddb_<preset>.md` $\rightarrow$ `read_repo_tier_settings(ctx, repo, "mddb")` (`.insetu-data/settings/mddb.md` and `settings.local/mddb.md`), while keeping prose agent directives strictly in `.insetu-data/settings/agent.md` under S8 `repo_directive` attestation.
  - **Repository Creation & Config (`InSetuNewFolderProjection` in `fs_modals.js`, `config.js`, `engine_system.py`):** Add `archive_type` / `repo_type: "mddb"` option when creating or configuring a repository (auto-detected when `.insetu-data/settings/mddb.md` exists), scaffolding `.insetu-data/settings/mddb.md` and defaulting `exts` to `[".md"]`.

### Sprint 2: URI-Stable Tracker Backend & Bounded 2-Level Folder Law (`engine_tracker.py`)
Streamline `engine_tracker.py` around `md_records`, in-place status updates, and one-shot migration of legacy `.insetu-data/tracker/<type>s/<status>/` trees.

- [ ] [S2.T1] Update `create_ticket`, `transition_ticket`, `api_tracker_spawn_template`, and `handle_tracker_vfs_mutations` in `engine_tracker.py` to enforce the **Bounded 2-Level Folder Law** (`.insetu-data/tracker/items/{active,archived,templates}/<id>.md`):
  - Non-terminal transitions (`queue -> open -> active -> blocked -> done`) update YAML frontmatter (or Level-2 heading YAML block) **in-place** without changing the file's `vfs://` URI.
  - Physical file relocation occurs **only** when a root record transitions to `status: archived` (moving into `items/archived/`) or is unarchived back to `items/active/`.
  - Upgrade `_background_spawn_template` to support spawning both multi-file template trees and single-file inline (`##` / `###`) template trees from `items/templates/`, preserving each template node's initial `status` (`open` or `queue`) and remapping `parent_id` and `depends_on` edges.
- [ ] [S2.T2] Add a one-shot, idempotent migration helper `migrate_legacy_tracker_tree(ctx, repo)` (with git-history date preservation) and retire legacy `tracker.db`, `notes.db`, and `skills.db` technical debt:
  - Consolidate existing `.insetu-data/tracker/<type>s/{open,active,closed,log,template}/*.md` tickets into `.insetu-data/tracker/items/{active,archived,templates}/`, mapping legacy `type: bug` $\rightarrow$ `kind: task, nature: defect`, `type: queue` $\rightarrow$ `status: queue`, and `status: template` $\rightarrow$ `items/templates/` (`is_template: true`).
  - Delete `enforce_declarative_tickets`, `_background_harmonize_vocabulary`, `restore_ticket_metadata_from_git`, and `tracker_is_migrating` from `engine_tracker.py`, replacing `tracker_tickets` (`tracker.db`) with `ctx.mddb` (`db_scope = "ext:tracker"`).
  - Migrate `engine_notes.py` (`notes_ledger` / `notes.db`) and `engine_skills.py` (`skills_ledger` / `skills.db`) to use `ctx.mddb` (`db_scope = "ext:notes"` and `db_scope = "ext:skills"`), deleting duplicate `vfs_mutated` / boot-walk / YAML tag-parsing loops and cleaning up orphaned `{tracker,notes,skills}.db` files in `cache/db/`.
  - Replace hardcoded `tracker_dir`/`tracker_closed_dir` in `engine_topology.py` with IoC `_register_tracker_landmark` in `engine_tracker.py`, clean up legacy `.tracker` SQLite migration code in `insetu/core/system/legacy.py`, add an `mddb` preset to `InSetuExtDevSql` (`ext_dev.js`), and update `tracker/README.md`, `housekeeping_tracker_phase.md`, and `ticket_authoring_guide.md` to reflect the Unified Tracker Ontology (`kind`, `nature`, `status: done`, and `{{ sys.tracker_dir }}/items/active/`).

### Sprint 3: Single-Slot UI, Capacity-Adaptive Lenses & `setDynamicLayoutSlots` Retirement (`ext_tracker.js`)
Replace the 1,390-line `ext_tracker.js` monolith with focused modules (`tracker_store.js`, `tracker_modals.js`, `ext_tracker.js`) under 600 lines each.

- [ ] [S3.T1] Mount a single canonical sub-navigation slot (`tasks:tracker`) in `ext_tracker.js`, delete `setDynamicLayoutSlots`, `parent_tabs`, and `global_views`, and implement the **Single-Row `<sutram-toolbar>` + Collapsible Filter & Lens Tray** (`slot="filters"` with `⚡ Active Focus`, `🌲 Hierarchy`, `📊 Stage Board`, `📥 Queue`, `🔴 Defects`, `🏛️ Ur-Index`, `🧬 Templates`, `<insetu-repo-filter>`, `tier`, `kind`, and `nature` pills, plus `<sutram-dag-tree>` template hierarchy rendering).
- [ ] [S3.T2] Implement the **3 Capacity-Adaptive Structural Lenses** in `ext_tracker.js`:
  - **Lens 1 (`tree` — Default Drill-Down):** Full-width `<sutram-card>` items with roll-up progress (`4/6 done • 1 defect`), `↑ Up | /Parent` breadcrumb in `slot="bottom-row"` when drilled in, and click-to-open leaf in the adjacent editor column on `2-Col`/`3-Col` desktop.
  - **Lens 2 (`board` — Adaptive Stage Board):** Stacks `status` stages vertically as `<sutram-collapsible>` sections in `1-Col` portrait mode and flows side-by-side as Kanban columns in wide viewports, paired with `T1 | T2 | T3` depth pills.
  - **Lens 3 (`ur` — Ur-Index & Attestation Explorer):** Lists `tier: 0` Ur-Records and mental models with attestation counts and drills into their reverse attestation instances.
- [ ] [S3.T3] Upgrade `InSetuFrontmatterEditor` (`fs_editor_projection.js`) into a complete schema-driven record editor (implementing and superseding `2026-11-05-core-extension-sdk-abstractions.md` Abstraction 4):
  - Built-in VFS relocation/delete tracking, `.titleKey` binding, typed `fields:` / `targets:` cross-collection entity pickers, and a standard `Delete | Raw Edit | Save` footer—collapsing `InSetuExtNotesEditor` (`ext_notes.js`) and `InSetuTrackerEditProjection` (`ext_tracker.js`) into thin declarative wrappers and deleting ~300 lines of manual frontmatter synchronization boilerplate.
  - Replace hardcoded `.insetu-data/tracker/` editor checks in `fs.js` / `fs_editor_projection.js` with `isManagedRecordPath(filepath)`, unify `insetu:global-manifest-files` / `insetu:global-manifest-whitelist` registration across `ctx://notes/` and `ctx://skills/`, update offline optimistic path generation in `tracker` / `notes` / `skills` to use the Bounded 2-Level Folder Law, and wire `ext_citations.js` (`_openCitationNotes`) and `ui_modals.js` (`LinkModal`) to `mddb/backlinks`.

### Sprint 4: Comprehensive 5-Part Verification & Fitness Test Suite
Each sprint is gated by deterministic unit and architectural fitness tests:

- [x] [S4.T1] **`tests/unit/test_akasa_db_and_markdown_ast.py` (Gating Sprint 1 `S1.T0`):**
  1. `akasa/db.py` 16-connection thread LRU pool (verifying zero connection eviction across 10+ concurrent workspace DBs) and idempotent migration of declarative `__constraints__` (composite primary keys) and `__indexes__`.
  2. Pure `MarkdownLanguageProvider` (`insetu/core/languages/markdown.py`): nested `#`/`##`/`###` section boundaries (`start_line..end_line`), relative `[link](../other.md#sec)` $\rightarrow$ canonical `vfs://` resolution, `[[wikilinks]]`, `[@csl_id]` citation key extraction, `slice_interface()` 12k-token skeleton compression, `extract_symbol_slice()` by heading title/slug, and `format_interleaved_file_diff()` AST section diffs on `.md` files.
  3. `engine_topology.py` slew-limited `ctx_events` in `topology_resolved` (firing for `ctx://notes/` and `ctx://skills/`, ignoring `ctx://contexts/` and `ctx://diffs/`).
- [ ] [S4.T2] **`tests/unit/test_mddb_core.py` (Gating Sprint 1 `S1.T1` & `S1.T2`):**
  1. Level-1 file frontmatter + Level-2 `##`/`###` fenced ```` ```yaml ```` and `- [ ] [ID]` sub-record indexing (`parent_id` inference, `seq_order = 1..N`, `start_line..end_line` slice coordinates).
  2. Domain-specific YAML vocabulary normalization (`kind`/`type` aliases $\rightarrow$ `tier` & `default_nature`; `nature: bug | error | regression` $\rightarrow$ `nature = "defect"`; `status_map` synonyms; `name`/`group` field role aliases) while preserving raw domain terms in `properties_json`.
  3. In-place `ctx.mddb.patch_record` mutations on both Level-1 frontmatter and Level-2 `##` fenced YAML blocks without disturbing surrounding prose or sibling spans.
  4. Layered schema resolution (`authority: repo_content`) from `.insetu-data/settings/mddb.md` and `settings.local/mddb.md`, and strict S8 separation from `agent.md`.
- [ ] [S4.T3] **`tests/unit/test_mddb_multi_collection_and_cross_repo.py` (Gating Sprint 1 Graph & Multi-Collection):**
  1. Multi-collection repository (`authors/`, `books_and_journals/`, `articles/`, `concepts/`) with `applies_to` field scoping, `targets:` cross-collection foreign keys, and prose relative link `cites` edges.
  2. Cross-repo and cross-scope connections (`repo:music` + `repo:theory` + `ext:skills` + `ext:tracker` + `ext:notes` attesting shared `ur:form/vong_co` and `[@csl_id]` targets, verified via `ctx.mddb.get_attestations`, `ctx.mddb.get_backlinks`, and `gather.py` `resolve_relational_graph`).
  3. Forward roll-ups (`done / total`, defect counts, `union` of `performers`/`concepts`) and reverse attestation Markov adjacency (`seq_order ± 1`).
  4. `ctx.mddb.audit_upkeep` catching physical folder depth $> 2$, disallowed `allowed_children` parent-child pairings, undeclared fields, and dangling foreign keys.
- [ ] [S4.T4] **`tests/unit/test_tracker_notes_skills_unification.py` (Gating Sprint 2):**
  1. Bounded 2-Level Folder Law in Tracker: URI invariance across `queue -> open -> active -> blocked -> done` transitions, and physical relocation to `items/archived/` only on `status: archived` (with active `depends_on` blocker enforcement).
  2. One-shot idempotent migration (`migrate_legacy_tracker_tree`) of legacy `.insetu-data/tracker/<type>s/{open,active,closed,log,template}/` fixtures into `items/{active,archived,templates}/` (`bug` $\rightarrow$ `kind: task, nature: defect`, `queue` $\rightarrow$ `status: queue`, `template` $\rightarrow$ `items/templates/`), plus cleanup of retired `{tracker,notes,skills}.db` files.
  3. Shadow Board template spawning (`spawn_template`) across both multi-file and single-file inline `##`/`###` template trees with `{{var | default}}` interpolation, initial `status` preservation, and isomorphic `parent_id`/`depends_on` remapping.
  4. `ext:notes` (with `NotesVFSDriver` repo relocation) and `ext:skills` (with SM-2 `log` interval updates) backed by `ctx.mddb`.
- [ ] [S4.T5] **`tests/unit/test_mddb_ui_and_fitness.py` & `tests/fitness/rules_javascript.py` (Gating Sprint 3 & 4):**
  1. Exact set parity test between `CORE_MODULES_TUPLE` (`sdk/__init__.py`) and `_baseCore` (`insetu_sdk.js`).
  2. `DYNAMIC_LAYOUT_SLOTS_BAN` in `tests/fitness/rules_javascript.py` forbidding `setDynamicLayoutSlots` across extensions and `insetu_sdk.js`.
  3. Component contract verification for `<insetu-ext-tracker>` (single `tasks:tracker` slot, `<sutram-toolbar .enableFilterDropdown=${true}>`, and `tree` / `board` / `ur` lenses) and schema-driven `<insetu-frontmatter-editor>`.
