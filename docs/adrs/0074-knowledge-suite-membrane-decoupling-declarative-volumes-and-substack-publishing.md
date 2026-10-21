# ADR 0074: Knowledge & Authoring Extension Suite Membrane Decoupling, Declarative Volume Schemas, Citations IoC Topology, and Substack Rich-Text Publishing

## Status
Accepted (2026-10-21)

## Context
Following the core pipeline encapsulation (ADR 0070, ADR 0072) and DevOps extension suite stabilization (ADR 0073), the Knowledge & Authoring domain extensions (`citations`, `notes`, `publish`, `research`, `skills`) contained several structural and boundary inconsistencies:
1. **Akasa Membrane Bleed in Knowledge Extensions**: `engine_citations.py`, `engine_notes.py`, `engine_publish.py`, `engine_research.py`, and `engine_skills.py` directly imported kernel modules (`akasa.hooks`, `akasa.vfs`, `akasa.utils`), bypassing the 4-File Membrane (`app.py`, `cli.py`, `sdk/__init__.py`, `utils_core.py`).
2. **Imperative Volume Lifecycle Management**: `engine_notes.py` and `engine_skills.py` imperatively registered custom VFS drivers (`register_driver`), requested directory path keys (`request_paths`), executed filesystem migrations (`move_tree_contents`), and mounted volumes in `@hooks.on('workspace_boot')`.
3. **Citations Monolithic Context Writing**: `engine_citations.py` wrote `.txt` files directly in `@hooks.on('compile_contexts')`, bypassing Gather's Inversion of Control (IoC) topology architecture and lacking differential recall callbacks.
4. **Publishing Format Gap & Macro Bleed**: Document publishing lacked a dedicated Substack / Medium rich-text snippet generation pipeline. Operators compiling to HTML received full document templates with Pandoc auto-generated heading IDs (`id="heading"`), raw frontmatter headers, and un-stripped wordcount macros (`{{wordcount_start}}`, `{{wordcount_stop}}`, `{{wordcount_sum}}`), requiring tedious manual cleanup. Additionally, `ext_publish.js` invoked banned `executeUnload` in component teardown.
5. **Notes Sub-Navigation Action Slot Drift**: `ext_notes.js` registered a standalone Web Component in `slots:sub-navigation-actions` and relied on legacy `@insetu:request-frontmatter` pub/sub events.
6. **Unmanaged Timers and Workspace Swap Races in Research**: `ext_research.js` utilized unmanaged `setTimeout` for polling loops without tenant workspace validation, and diagnostic SERP dumps triggered unnecessary VFS event ledger entries.

## Decision
1. **Akasa Kernel Membrane Decoupling**:
   - Refactored `engine_citations.py`, `engine_notes.py`, `engine_publish.py`, `engine_research.py`, and `engine_skills.py` to import framework primitives strictly from `insetu.core.sdk` and `insetu.core.utils_core`.
   - Converted all raw `@hooks.on(...)` subscriptions across these engines to blueprint-scoped decorators (`@citations_bp.on`, `@notes_bp.on`, `@publish_bp.on`, `@research_bp.on`, `@skills_bp.on`), passing `ctx` as the first argument.
2. **Declarative Volume Schemas on `InSetuExtension`**:
   - Declared `volumes={"notes": {"scheme": "ctx", "tier": "data", "path_key": "notes_dir", "driver": NotesVFSDriver, "legacy_dirs": [...]}}` on `notes_bp`.
   - Declared `volumes={"skills": {"scheme": "ctx", "tier": "data", "path_key": "skills_dir", "legacy_dirs": [...]}}` on `skills_bp`.
   - Purged all imperative `mount_volume`, `register_driver`, `request_paths`, and `move_tree_contents` calls.
3. **Citations IoC Topology Compilation (`gather_declare_topology`)**:
   - Replaced `@hooks.on('compile_contexts')` with `@citations_bp.on('gather_declare_topology')`, yielding generator and recall callbacks (`_make_callbacks`) for both global (`ctx://contexts/citations_context.txt`) and repository-scoped (`ctx://contexts/{repo}_citations_context.txt`) citation libraries.
   - Cached declared virtual contexts in `citations_ui.json` via `ctx.store.set()`, allowing `@citations_bp.on('mutate_workspace_config')` to hydrate UI metadata without issuing blocking SQLite queries during boot.
4. **Substack & Rich-Text HTML Snippet Publishing & Macro Stripping**:
   - Introduced the `html_snippet` format in `engine_publish.py` and `ext_publish.js`.
   - Extracted and excluded YAML frontmatter; stripped Pandoc auto-generated heading IDs (`re.sub(r'(<h[1-6])\s+id="[^"]*"([^>]*>)', r'\1\2', html_str)`); and purged standalone and inline wordcount macros (`strip_macros`) collected from `pre_compile_document`.
   - Enhanced `<insetu-ext-publish-modals>` with instant dual-action clipboard controls: rich-text HTML copy (`copyRichHtml`) and raw HTML tags copy (`copyToClipboard`).
   - Removed component-level `executeUnload` in `ext_publish.js` (satisfying `COMPONENT_EXECUTE_UNLOAD_BAN`).
5. **Notes UI Sub-Navigation Menu Actions & In-Place Frontmatter Push**:
   - Eradicated `<insetu-ext-notes-actions>` and `slots:sub-navigation-actions` in favor of declarative `menuActions` on `slots:sub-navigation`.
   - Replaced `@insetu:request-frontmatter` with in-place `this.shadowRoot?.getElementById('fm-editor')?.syncFrontmatter(yamlPatch, true)`.
   - Added relocation resilience (`delMut?.relocated_to || movedSave?.filepath`) and InSetuURI basename resolution.
6. **Research Extension Lifecycle & Polling Safety**:
   - Bound SERP and scrape polling to `this.registerTimeout()` and `this.clearManagedTimeouts()`.
   - Injected active workspace parity checks (`getActiveWorkspace() !== fetchWs`) to prevent cross-tenant poll leaks.
   - Added `ignore_ledger: True` on diagnostic SERP dump writes.
7. **Skills Ledger URI Normalization & Entity Creation**:
   - Utilized `ctx.db.heal_uri_column` for `skills_ledger` and standardized entity drafting on `ctx.create_entity_file()`.

## Consequences
* **Positive**: Absolute membrane boundary isolation with zero direct `akasa.*` imports across the knowledge extension suite.
* **Positive**: Declarative volume lifecycle management without imperative driver mounting boilerplate.
* **Positive**: Pure Inversion of Control for citation context compilation with surgical recall caching.
* **Positive**: Frictionless document publishing to Substack and rich-text platforms with automated formatting and macro cleanup.
* **Positive**: Eradication of unmanaged polling timers and cross-tenant polling races during workspace swaps.