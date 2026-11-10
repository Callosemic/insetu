---
tier: "epic"
title: "Plan: Core SDK Abstractions for Domain Extensions (Frontend & Backend)"
description: "Consolidates six recurring UI, VFS, and SQLite/Frontmatter patterns across citations, research, ingest, notes, publish, and skills into Ring 3 Core SDK primitives."
status: "planned"
repo: insetu
created_at: "2026-11-05"
tags: [plan, rfc, sdk, extensions, dry, frontmatter, vfs]
---

# Plan: Core SDK Abstractions for Domain Extensions (Frontend & Backend)

## Roadmap placement (2026-11-07)

- **None of this plan gates 1.0.** The extension SDK is labelled experimental at 1.0 (decided 2026-11-07). The plan is filler for Gemini's lane before 1.0 when other work is blocked, and 1.x otherwise.
- **Abstractions 3 and 5 are live** (post-diff audit, 2026-11-07).
- **Terms updated 2026-11-07** to match what shipped and what the post-diff plan changes:
    - Abstraction 3 is `openNewFileModal`, not `populateNewFileModal`. Its object form takes `fileName`; `fs.js` still also accepts `filename`, which goes once `ext_ingest.js` passes `fileName`.
    - Abstraction 5 hands its URLs to `SutramCacheWarmer` (post-diff 3.1 removes `AppStore.enqueueWarming`).
    - Abstraction 6's `compile_static_domain_context` runs from `gather_declare_topology`, not `compile_contexts`.


## 1. Architectural Context & Motivation

During the compliance audit and refactoring of the six domain extensions (`citations`, `research`, `ingest`, `notes`, `publish`, and `skills`), six recurring structural patterns emerged where extensions hand-roll boilerplate that either already exists partially in `insetu/core/` (`prompts.js`, `fs.js`, `config.js`, `ui_system_settings.js`, `orchestrator.py`) or belongs in the `insetu/core/sdk/` membrane (`insetu_element.js`, `ui_primitives.js`, `fs.js`, `insetu/core/sdk/__init__.py`).

Extracting these six primitives into Core eliminates ~650 lines of duplicated code across extensions while enforcing `01_engineering_standards.md` invariants (`CROSS_STORE_MUTATION_BAN`, `SUTRAM_FORM_CONTROL_MANDATE`, and VFS/SQLite write-through consistency) by construction.

---

## 2. Enumeration of Core Abstractions & Consuming Extensions

### Abstraction 1: Declarative VFS Mutation & Sync-Complete Watcher (`this.watchVfsMutations`)
* **Core Target:** `vfs://insetu/insetu/core/system/insetu_element.js` (`InSetuElement`)
* **API Contract:**
  ```javascript
  this.watchVfsMutations(pathPredicateFn, onMutatedCallback, debounceMs = 300);

```

* **Mechanism:**
Registers both `insetu:vfs-mutated` (filtering `e.detail?.mutations` via `pathPredicateFn(m.filepath)` and debouncing via `this.registerTimeout` so pending timers are automatically cancelled on workspace swap or element disconnect) and `sutram-sync-complete` (triggering `onMutatedCallback()` when the offline outbox finishes draining).
* **Extensions & Core Modules That Will Use It:**
1. **`notes` (`ext_notes.js`):** Replaces the manual `insetu:vfs-mutated` and `sutram-sync-complete` listeners in `InSetuExtNotes.connectedCallback()` with `this.watchVfsMutations(fp => fp.includes('/notes/') || fp.startsWith('ctx://notes/'), () => NotesStore.getState().fetchNotes())`.
2. **`skills` (`ext_skills.js`):** Replaces the manual `insetu:vfs-mutated` and `sutram-sync-complete` listeners in `InSetuExtSkills.connectedCallback()` with `this.watchVfsMutations(fp => fp.includes('/skills/') || fp.startsWith('ctx://skills/'), () => this._reloadAll())`.
3. **`research` (`ext_research.js`):** Replaces the manual `.insetu-data/research/` mutation listener and `sutram-sync-complete` handler in `InSetuExtResearch.connectedCallback()` with `this.watchVfsMutations(fp => fp.includes('.insetu-data/research/'), () => ResearchStore.getState().fetchItems(), 350)`.
4. **`prompts` (`insetu/core/prompts/prompts.js`):** Replaces the duplicate `insetu:vfs-mutated` + `sutram-sync-complete` listeners in `InSetuExtPrompts.connectedCallback()` with `this.watchVfsMutations(isPromptPath, () => syncPromptsState(true))`.



---

### Abstraction 2: Declarative Missing Dependency & Binary Banner (`<insetu-dependency-banner>`)

* **Core Target:** `vfs://insetu/insetu/core/system/components/ui_primitives.js`
* **API Contract:**
```html
<insetu-dependency-banner
    .extName=${'ingest'}
    .packages=${['beautifulsoup4']}
    .binaries=${['pandoc', 'typst']}
    .onInstalled=${() => this.requestUpdate()}>
</insetu-dependency-banner>

```


* **Mechanism:**
Inspects `this.getMissingDependencies(this.extName)` (or explicit `.packages` / `.binaries` overrides) from `AppStore.extensionDependencyMeta`. Renders nothing (`html\```) when all dependencies are satisfied. When Python packages are missing, renders a standardized ``with``and a one-click **Install Now**``bound to`this.installExtensionDependencies(this.extName, this.onInstalled)`. When system PATH binaries are missing, renders the standardized `danger` banner listing the missing binaries.
* **Extensions & Core Modules That Will Use It:**
1. **`ingest` (`ext_ingest.js`):** Replaces the custom `bs4Missing` warning surface in `InSetuExtIngestModals.render()` when `ingestMethod === 'bs4'`.
2. **`publish` (`ext_publish.js`):** Replaces the bespoke missing `pandoc` / `typst` / `weasyprint` binary and Python package warning banners in the Publish view.
3. **`research` (`ext_research.js`):** Surfaces missing optional PDF/scraping dependencies (`pypdf`, `beautifulsoup4`) in the Research import modal without custom markup.
4. **`system` (`ui_system_settings.js`):** Replaces the inline `missingPy` and `missingBins` surfaces in `_renderManageExtensionsDrillDown()`.



---

### Abstraction 3: Host-Owned `New File` Modal Population API (`openNewFileModal`, live)

* **Core Target:** `vfs://insetu/insetu/core/fs/fs.js` & `vfs://insetu/insetu/core/fs/fs_modals.js`
* **API Contract:**
```javascript
window.inSetu.ui.openNewFileModal({ fileName, content, basePath });  // also on window.inSetu.vfs; a string argument is the base path

```


* **Mechanism:**
Owned by `fs.js`, which updates `FsStore.getState().setModal('newFile', ...)` internally (and opens the `vfs:new-file` window if not already open) and listens for `insetu:post-import-url`. This allows any extension plugged into `modal:new-file:actions` to populate the filename and editor body without touching `FsStore` directly (`CROSS_STORE_MUTATION_BAN`).
* **Extensions That Will Use It:**
1. **`ingest` (`ext_ingest.js`):** `InSetuExtIngestBtn` (mounted in `slot: "modal:new-file:actions"`) and `InSetuExtIngestModals` call `this.ui.openNewFileModal({ fileName: `${slug}.md`, content: data.markdown })` when invoked from the New File modal, or `this.vfs.openVirtualFile` when invoked standalone.
2. **`prompts` & `notes`:** Can pre-seed template content into the New File projection via `this.ui.openNewFileModal({ fileName, content })`.



---

### Abstraction 4: Schema-Driven Metadata Bar in `<insetu-frontmatter-editor>`

* **Core Target:** `vfs://insetu/insetu/core/fs/fs.js` (`InSetuEditorProjection` / `InSetuFrontmatterEditor`)
* **API Contract:**
```html
<insetu-frontmatter-editor
    .filepath=${this.activeFilepath}
    .titleKey=${'title'}
    .titlePlaceholder=${'Note Title...'}
    .metadataSchema=${[
        { id: 'category', label: 'Category', type: 'text', placeholder: 'General' },
        { id: 'tags', label: 'Tags', type: 'comma_list', placeholder: 'tag1, tag2' }
    ]}>
</insetu-frontmatter-editor>

```


* **Mechanism:**
Upgrades `InSetuFrontmatterEditor` to optionally render the single-line ghost `<sutram-textarea slot="title-control">` bound to `_yamlData[this.titleKey]` (automatically stripping newlines and updating `updated_at`) and a `<sutram-stack direction="grid" ?compact=${true}>` of typed `<sutram-input>` / `<sutram-select>` controls in `slot="metadata-controls"` driven by `.metadataSchema`.
* **Extensions That Will Use It:**
1. **`notes` (`ext_notes.js`):** Eliminates the entire `InSetuExtNotesEditor` boilerplate class (~95 lines of manual `editForm` state mirroring and `_pushFrontmatter()` plumbing) in favor of `<insetu-frontmatter-editor .titleKey=${'title'} .metadataSchema=${[...]}>`.
2. **`research` (`ext_research.js`):** Replaces custom frontmatter field syncing in `InSetuExtResearchEditor` (for `title`, `authors`, `year`, `doi`, `tags`, `status`) with a declarative `.metadataSchema` array.
3. **`skills` (`ext_skills.js`):** Allows skill `.md` files opened in the spatial editor to edit `name`, `domain`, `group`, `status`, and `tags` frontmatter fields declaratively without a separate structural edit modal.



---

### Abstraction 5: Unified Offline VFS Pre-Warmer (`this.vfs.preCacheFiles`)

* **Core Target:** `vfs://insetu/insetu/core/fs/fs.js` (exposed on `window.inSetu.vfs.preCacheFiles`)
* **API Contract:**
```javascript
await this.vfs.preCacheFiles(filepaths, { label: 'notes' });

```


* **Mechanism:**
Accepts an array of canonical `vfs://` or `ctx://` URIs, filters out `.gitkeep`/`.keep`, resolves fetch URLs via `resolveFileFetchUrl(fp, true)`, hands them to `SutramCacheWarmer` (priority `high` for an explicit pre-cache), which warms `SutramDB` via `window.inSetu.api.fetchImmutableText` while reporting progress to `window.inSetu.offlineLog` and `window.inSetu.ui.setGlobalStatus`.
* **Extensions & Core Modules That Will Use It:**
1. **`notes` (`ext_notes.js`):** Replaces `_preCacheAllNotes()` with a 1-line call: `await window.inSetu.vfs.preCacheFiles(notes.map(n => n.filepath), { label: 'notes' })`.
2. **`config` (`insetu/core/config/config.js`):** Replaces `_preCacheRepo(repoDir)` with `await this.vfs.preCacheFiles(files, { label: repoDir })`.
3. **`skills` & `research`:** Enables 1-line offline pre-caching for skill libraries and research corpora in Settings.



---

### Abstraction 6: Unified `md-db` Sidecar Indexing & Static Context Compiler (`ctx.mddb` — Merged with `2026-11-09-mddb-and-tracker-streamlining.md`)

> **Unification Note (2026-11-09):** Rather than building a separate `ctx.iter_domain_markdown_entities` frontmatter scanner, all extension sidecar Markdown domains (`notes`, `skills`, `research`, `tracker`) and Primary-Surface `md-db` repositories are indexed directly by the dedicated Tier 2 Core module `insetu/core/mddb/` (`parser.py`, `engine_mddb.py`) into `md_records` and `md_edges` (scoped by `db_scope = "ext:<name>"` vs. `"repo:<repo>"`). Extensions query `ctx.mddb` directly instead of maintaining private SQLite tables and directory-walking loops.

* **Core Target:** `vfs://insetu/insetu/core/mddb/` & `vfs://insetu/insetu/core/sdk/__init__.py` (`InSetuContext.mddb`)
* **API Contract:**
```python
records = ctx.mddb.query(db_scope="ext:notes", include_shared=True)
```


and:
```python
ctx.compile_static_domain_context(
    manifest=manifest,
    base_uri="ctx://contexts/notes_context.txt",
    title="Workspace Notes",
    domain="Notes",
    desc="Compiled notes and scratchpads.",
    blocks=text_blocks,
    files=file_uris,
)

```


* **Mechanism:**
* `ctx.iter_domain_markdown_entities` walks `ctx://<domain>`, all tracked `vfs://<repo>/.insetu-data/<domain>` directories, and peer `ws://` shared mounts (`ctx.iter_shared_mount_files(domain=domain)`), parses YAML frontmatter and Markdown body via `parse_frontmatter`, normalizes `is_shared` and `[🌐 <ws>]` title prefixes, and yields uniform dicts ready for SQLite index upserts.
* `ctx.compile_static_domain_context` is called from an extension's `@bp.on('gather_declare_topology')` handler (the `compile_contexts` hook is retired) so extensions build their `ctx://contexts/<ext>_context.txt` entry and assign it into `manifest` in one call.


* **Extensions & Core Modules That Will Use It:**
1. **`notes` (`engine_notes.py`):** Replaces `_scan_and_sync_notes` directory/shared-mount walking and `@notes_bp.on('compile_contexts')` boilerplate.
2. **`skills` (`engine_skills.py`):** Replaces custom `vfs://` + `ctx://skills` + `ws://` walking and frontmatter parsing in skill indexing and context compilation.
3. **`research` (`engine_research.py`):** Simplifies `.insetu-data/research/` Markdown item scanning and context compilation.
4. **`agent` (`insetu/core/agent/orchestrator.py`):** Consolidates shared-mount discovery in `list_available_routines`.



---

## Sprint 1: Frontend SDK Abstractions (`insetu_element.js`, `ui_primitives.js`, `fs.js`)

* [ ] [S1.T1] Add `watchVfsMutations(predicateFn, callback, delayMs = 300)` to `InSetuElement` in `insetu_element.js` and refactor `ext_notes.js`, `ext_skills.js`, `ext_research.js`, and `prompts.js` to use it 
* [ ] [S1.T2] Add `<insetu-dependency-banner>` to `ui_primitives.js` and adopt it in `ext_ingest.js`, `ext_publish.js`, and `ui_system_settings.js` 
* [x] [S1.T3] `openNewFileModal` (object form) and `window.inSetu.vfs.preCacheFiles` are live in `fs.js` and wired into `ext_ingest.js`, `ext_notes.js` and `config.js`. Left: `ext_ingest.js` passes `fileName`, then `fs.js` drops `filename`. 
* [ ] [S1.T4] Upgrade `InSetuFrontmatterEditor` in `fs.js` to support declarative `.titleKey` and `.metadataSchema` props, and simplify `ext_notes.js` and `ext_research.js` 

## Sprint 2: Backend `ctx.mddb` Sidecar Unification & Context Compilation Helpers (`insetu/core/mddb/` & `sdk/__init__.py`)

* [ ] [S2.T1] Expose `ctx.mddb` (backed by `insetu/core/mddb/` from `2026-11-09-mddb-and-tracker-streamlining.md` Sprint 1) and `ctx.compile_static_domain_context` on `InSetuContext` in `insetu/core/sdk/__init__.py`
* [ ] [S2.T2] Refactor `engine_notes.py`, `engine_skills.py`, and `engine_research.py` to query `ctx.mddb` (`db_scope="ext:<name>"`) and `ctx.compile_static_domain_context`, retiring their bespoke directory walkers and private SQLite metadata tables
