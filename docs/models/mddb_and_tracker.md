---
title: "Mental Model: Two-Axis Markdown Database (md-db) & Unified Tracker Ontology"
description: "Recursive Markdown-as-a-Database records, heading-scoped sub-record spans, Containment vs. Ur-Record intersection graphs, and zero-hack structural lenses."
domain: "Core Architecture"
tags: [mental-model, mddb, tracker, database, rag, rollup, invariants]
---

# Mental Model: Two-Axis Markdown Database (`md-db`) & Unified Tracker Ontology

`inSetu` treats structured Markdown repositories not as flat collections of text files, but as a **relational, tree-structured document database (`md-db`)**. Whether a repository tracks software engineering work (`Epic -> Sprint -> Task`), *cải lương* recordings (`Play -> Track -> Tân nhạc / Vọng cổ / Lý segments`), or *Paris By Night* productions (`Show -> Liên Khúc -> Song Segment`), every entity obeys the same two-axis graph contract and projects through the same declarative UI lenses.

---

## 1. The Two-Tier Markdown Record Grammar (File Records & Sub-Record Spans)

To prevent filesystem fragmentation (where a 30-second *Lý* interpolation, a single song inside a *Liên Khúc*, or a 5-minute subtask would otherwise require its own `.md` file), `md-db` indexes records at two granularities within any `.md` file:

1. **Level 1 — The Root File Record (YAML Frontmatter):**
   - The top-of-file `--- ... ---` YAML frontmatter defines the file's root entity (`id`, `kind`, `title`, `parent_id`, `status`, plus arbitrary domain properties).
   - If `id` is omitted, it defaults deterministically to `<repo>:<rel_path_stem>`.

2. **Level 2 — Heading-Scoped Sub-Record Spans (`##` / `###` + `yaml` Block):**
   - Any Markdown heading (`##`, `###`, `####`) immediately followed by a fenced ```` ```yaml ```` metadata block (or inline `[ ] [ID]` task signature) is indexed as a **first-class child record** in SQLite.
   - **Implicit Heading Containment:** Within a single file, heading depth defines parent-child containment automatically: a `###` sub-record inside a `##` section has `parent_id` set to the enclosing `##` record; a `##` record has `parent_id` set to the file's root record (`Level 1`), with `seq_order` (`1, 2, ..., N`) preserving exact sequential order and `(start_line, end_line)` anchoring its source slice.
   - **Prose Co-Location:** All Markdown prose following the sub-record's `yaml` block up to the next heading of equal or higher rank belongs to that sub-record's `body` and is targetable in-place by Yomama `JSON_PATCH`, `TEXTEDIT`, and `SEARCH/REPLACE` blocks.

### Example: Multi-Segment Performance & Cover Attestation
```markdown
---
id: show:pbn_088_track_05
parent_id: show:pbn_088
kind: performance
title: "Liên Khúc: Mưa Nửa Đêm & Mưa Đêm Tỉnh Nhỏ"
performers: [ur:artist/huong_lan, ur:artist/che_linh]
arranger: ur:artist/tung_chau
year: 2007
---

General stage production and medley arrangement notes.

## [00:00 - 02:35] Mưa Nửa Đêm
```yaml
id: show:pbn_088_track_05#seg_1
kind: segment
ur: ur:work/mua_nua_dem
form: ur:form/bolero
performers: [ur:artist/huong_lan]
lang: vi
key: Dm
```
Vocal ornamentation notes on the opening verse...

## [02:35 - 05:10] Vọng Cổ Interpolation (Câu 1–2)
```yaml
id: show:pbn_088_track_05#seg_2
kind: segment
ur: [ur:work/mua_dem_tinh_nho, ur:form/vong_co]
vong_co_author: ur:artist/vien_chau
cau: [1, 2]
performers: [ur:artist/huong_lan, ur:artist/che_linh]
accompanist: ur:artist/van_vi
```
Transition from bolero meter into nhịp 32 vọng cổ...
```

---

## 2. The Two-Axis Relational Graph: Containment vs. Ur-Record Intersection

Every record in `md-db` participates in two orthogonal graph axes stored in the workspace SQLite ledger (`md_records` and `md_edges`):

| Axis | Mechanism | Role & Examples |
| :--- | :--- | :--- |
| **Axis 1: Containment (`parent_id` & `seq_order`)** | Tree hierarchy (Cross-file `parent_id` + Intra-file heading nesting) | **Part-Whole Composition:**<br>• `Show (PBN 88)` $\rightarrow$ `Track (Liên Khúc)` $\rightarrow$ `Segment (00:00–02:35)`<br>• `Play (Tiếng Trống Mê Linh)` $\rightarrow$ `Act/Track` $\rightarrow$ `Tân nhạc / Vọng cổ / Lý span`<br>• `Epic` $\rightarrow$ `Sprint` $\rightarrow$ `Task` |
| **Axis 2: Archetype / Ur-Intersection (`ur` & typed `refs`)** | Directed graph edges (`md_edges`: `source_id -> rel_type -> target_id`) | **Instance-to-Canonical Concept ("Ur-Record"):**<br>• A medley segment instantiates `ur:work/suong_chieu` or `ur:work/mua_nua_dem` (covered across 12 different shows in different languages/arrangements).<br>• A segment instantiates structural form `ur:form/vong_co` or tune family `ur:melody/ly_con_sao_go_cong` (which itself has `parent_id: ur:melody/ly_con_sao`).<br>• An engineering Task references `ur` mental models (`docs/models/*.md`) and `vfs://` code targets. |

### 2.1 Forward Roll-Ups (Along the Containment Axis)
Any parent record automatically computes bottom-up aggregations over its descendants in `md_records`:
* **Completion & Status Roll-Up:** Count of children by status (`done / total`), active/blocked indicators.
* **Property & Tag Union:** A recording or show automatically rolls up the union of all `performers`, `ur` works, `form` genres, `lang` codes, or `files_touched` across its child segments/tasks.

### 2.2 Reverse Attestation Roll-Ups (Into Ur-Records)
Every **Ur-Record** (e.g., `ur:work/suong_chieu`, `ur:form/vong_co`, `ur:artist/thanh_nga`, or an architectural Mental Model) automatically receives a computed **Reverse Attestation Ledger** from `md_edges`:
* **Instantiation Table:** Every performance, recording, or medley segment across the entire workspace that references the Ur-Record, complete with its parent show/album, year, performers, language, key, and exact `[start - end]` timestamp or line span.
* **Sequential Transition / Markov Adjacency:** Because child segments carry `seq_order` within their parent track, any Ur-Record (such as `ur:form/vong_co` or `ur:melody/ly_con_sao`) can query which forms or works immediately **precede** (`seq_order - 1`) and **follow** (`seq_order + 1`) it across the corpus.

---

## 3. Unified Tracker Ontology: One Recursive `WorkItem`, Zero Tab Hacks

The `tracker` extension is a specialized domain projection of `md-db` governed by three invariants:

1. **Three-Tier Polymorphic Containment (`tier: 1 | 2 | 3` & `allowed_children`):**
    - All Tracker items share a single SQLite table (`md_records`) and universal core envelope `(id, parent_id, kind, tier, nature, title, status, priority, tags, ur, seq_order)`, while allowing domain-specific `kind` vocabularies (software, writing, marketing, research) across **3 canonical tiers**:
    - **Tier 1 (Strategic Root, `parent_id: null`):** e.g., `epic`, `project`, `initiative`, `series`.
    - **Tier 2 (Deliverable / Phase, parent in Tier 1):** e.g., `sprint`, `manuscript`, `campaign`, `study`.
    - **Tier 3 (Actionable Unit / Leaf, parent in Tier 2 or 1):** e.g., `task`, `chapter`, `review`, `asset`.
    - **Constrained Branching (`allowed_children`):** Rather than an unconstrained free-for-all or a rigid single-type chain, each Tier 1 and Tier 2 `kind` declares `allowed_children: [<kind>, ...]`. This allows **shared polymorphic leaf types** (such as `task`, valid under both `manuscript` and `campaign`) to coexist alongside **branch-specific leaf types** (such as `chapter` and `review`, valid *only* under `manuscript`).
    - **Orthogonal Leaf Valence (`nature`) vs. Scheduling Horizon (`status: queue`):**
    - Legacy trackers conflate **artifact kind** (`task` vs. `chapter`), **work valence** (`bug` vs. `todo`), and **scheduling state** (`queue`) into separate views and directories.
    - In `md-db`, **scheduling horizon** belongs strictly to `status` (`queue -> open -> active -> blocked -> done -> archived`, where `queue` holds unscheduled or unparented triage items), while **work valence** is captured by a universal `nature` facet that maps directly to `<sutram-card>` visual intents across all domains:
        - `build` (`intent: "primary"`): New feature, draft, or primary annotation.
        - `defect` (`intent: "danger"`): Bug, regression, continuity error, or archival discrepancy.
        - `refine` (`intent: "warning"`): Refactor, tech debt, prose polish, or normalization.
        - `inquiry` (`intent: "highlight"`): Spike, research question, or editorial review.
    - Keeping `nature` as a facet on leaves rather than a separate tab allows a Sprint or Manuscript to roll up both its `build` progress and its open `defect` count (`3/5 done • 1 defect`) in one unified tree, while a 1-click toolbar pill filters to `nature: defect` whenever a bug-only view is desired.

2. **Ban on Dynamic Tab Transformation (`setDynamicLayoutSlots` Eradication):**
   - Domain extensions must **never** mutate `LayoutStore` navigation tabs or inject synthetic sub-navigation slots to represent data views or filter presets.
   - `tracker` mounts **one** canonical sub-navigation slot (`tasks:tracker`). All view switching, depth filtering, and grouping happen declaratively inside the component's own toolbar.

3. **Three Capacity-Adaptive Structural Lenses (Single DOM Across 375px Mobile & 3-Col Desktop):**
    Every `md-db` collection (including Tracker and research databases) is projected through three built-in, zero-config lenses using a single DOM tree that adapts automatically to `LayoutStore.capacity` (`1-Col` mobile/portrait vs. `2-Col` / `3-Col` desktop) and `@container` width:
    - **Lens 1: Drill-Down Hierarchy (`tree` — Default):**
    Works identically to `<insetu-file-tree>`: renders full-width `<sutram-card>` items for the current tier with roll-up progress (`4/6 done • 1 defect`) in `detailSuffix`. Tapping a parent card (`Epic`, `Sprint`, `Show`, `Track`) drills into its children and reveals a compact `↑ Up | /Parent` breadcrumb bar in `slot="bottom-row"`—preserving 100% of a 375px portrait viewport for card text while routing leaf edits to the adjacent editor column on `2-Col` / `3-Col` desktop layouts.
    - **Lens 2: Adaptive Stage Board (`board`):**
    Groups records by `status` (`Active`, `Blocked`, `Open`, `Queue`, `Done`) or any chosen enum facet, paired with a **Tier Depth Pill** (`T1` | `T2` | `T3`). In `1-Col` portrait mode (or narrow column widths), stages stack vertically as `<sutram-collapsible>` sections (`Active` and `Blocked` open at the top, `Done` auto-collapsed at the bottom); when expanded in a wide multi-column viewport, the exact same stage groups flow side-by-side as Kanban columns via `<sutram-stack direction="grid">`.
    - **Lens 3: Ur-Index & Attestation Explorer (`ur`):**
    Renders canonical `tier: 0` Ur-Records (`ur:work/suong_chieu`, `ur:form/vong_co`, `ur:artist/thanh_nga`, or Mental Models) as `<sutram-card>` items with their attestation count (`14 segments ›`) in `detailSuffix`. Tapping an Ur-Record opens its Reverse Attestation list (stacked drill-down in `1-Col`, or side-by-side master-detail projection in `2-Col` / `3-Col`), packing facet metadata (`[1968] Thanh Nga • Câu 1–2 • 02:15–07:40`) into the card's subtitle lines.

### 3.4 Single-Row `<sutram-toolbar>` & Collapsible Filter Tray
To maximize vertical reading area on a 375px iPhone mini and eliminate `setDynamicLayoutSlots` tab hacks, `insetu-ext-tracker` (and `<insetu-mddb-view>`) uses a **Single-Row Header** with `<sutram-toolbar .enableFilterDropdown=${true}>`:

1. **Primary Bar (1 Row Only):**
    - Fuzzy search input + the standard Filter toggle button (displaying the active filter badge count).
    - `slot="bottom-row"` remains completely hidden at the root level and appears **only** when drilled into a parent record or Ur-Record (`[↑ Up] / PBN 88 / Track 05`).
2. **Collapsible Filter & Lens Tray (`slot="filters"`):**
    - Opening the filter tray exposes:
    - **Lens & Preset Pills:** `⚡ Active Focus` (default), `🌲 Hierarchy`, `📊 Stage Board`, `📥 Queue (<N>)`, `🔴 Defects (<N>)`, `🏛️ Ur-Index (<N>)`, and `🧬 Templates (<N>)`.
    - **Repository & Schema Facets:** `<insetu-repo-filter>` plus compact `<sutram-pill>` / `<sutram-select>` filters for `tier` (`T1 | T2 | T3`), `kind`, and any `facet: true` fields declared in `.insetu-data/settings/mddb.md` or `settings/<ext>.md` (plus an optional `+ Pin` chip for saving a favorite filter combination into `settings.local/`).

### 3.5 Shadow Board Templates: Parameterized Subgraph Cloning (`is_template: true`)
Reusable workflow blueprints ("Shadow Boards") are first-class citizens in `md-db` and `tracker`, upgraded so they no longer pollute lifecycle `status` values or require 12 separate files on disk:

1. **Physical Partition & Initial-Status Preservation (`.insetu-data/tracker/items/templates/`):**
   - Template records live in the Level-1 `items/templates/` partition (`is_template: true` in `md_records`) rather than overloading `status: "template"`.
   - Because `status` is no longer hijacked to mark a record as a template, each node inside a template tree can declare the actual **initial `status`** (`open` vs. `queue`) that its spawned instance should start in.
2. **Single-File Inline Trees OR Multi-File Trees:**
   - A 3-tier template (`Campaign -> Content Pieces -> Tasks` or `Epic -> Sprints -> Tasks`) can be authored either as separate `.md` files linked by `parent_id` **or** inside a **single `.md` file** using Level-1 frontmatter (Tier 1 root), `##` headings (Tier 2 children), and `###` headings (Tier 3 leaves).
3. **Tree-Wide `{{var | default}}` Extraction & Isomorphic Graph Spawning (`tracker.spawn_template`):**
   - Clicking **🚀 Spawn Instance** walks the template root and all descendants in `md_records`, extracts all `{{var | default}}` placeholders across titles, bodies, and tags (`extractTemplateVariables`), and filters target repositories to those sharing a compatible schema.
   - Upon submission, the spawner interpolates variables, mints collision-free IDs (`id_map[old_id] -> new_id`), and rewrites all internal `parent_id` and `depends_on` edges so the newly spawned hierarchy and blocker graph is 100% isomorphic to the template.
   - Browsing and editing templates uses the standard `tree` drill-down lens and `<sutram-dag-tree>` primitive (activated via the `🧬 Templates` filter pill or sub-tab menu) with `➕ New <Allowed Child>` actions at each tier.

---

## 4. Multiplex Proximity Filters & Cross-Domain RAG Integration

Because `md_records` and `md_edges` live in the workspace SQLite index alongside `topology_ledger`, `symbol_ledger`, and `affinity_edges`, any `md-db` repository automatically participates in `inSetu`'s **Proximity Filter** and **Domain Jump** algebra (`docs/models/agent_orchestrator_and_rag.md` §7.3):

1. **Zero-Config Containment & Ur-Record Proximity:**
   - **Containment Adjacency (`hierarchy.container`):** Expanding from a Level-2 sub-record span (`show:pbn_088_track_05#seg_2`) at depth $k=1$ pulls its enclosing parent record (`show:pbn_088_track_05`) and adjacent sibling spans (`seq_order` $\pm 1$, `numeric_window`) at `slice` or `full` lens.
   - **Ur-Intersection Proximity (`mddb.ur_intersection`):** Hop 1 follows `md_edges` (`edge_ref`) from a segment to its canonical **Ur-Records** (`ur:work/...`, `ur:form/vong_co`); Hop 2 fans out via reverse attestation to pull the exact heading slices (`start_line..end_line`) of peer segments across other recordings that instantiate the same Ur-Record—without loading unrelated segments of those recordings.

2. **Declarative Multiplex Proximity Layers in `.insetu-data/settings/mddb.md` (Physical vs. Logical Topologies):**
   A single set of domain records often participates in multiple orthogonal adjacency graphs (a **Multiplex Graph**). For example, in a hardware controller schema (such as a Morningstar MIDI rig), presets have a **physical topology** (`bank_number` page layout and `numeric_window` adjacent banks $\pm 1`), a **logical bus topology** (`same_property` join on `midi_channel` or `cc_number` across all banks, plus `edge_ref` to the target device manual), and a **state-machine topology** (directed `Bank Jump` edges).
   - By declaring `proximity_filters:` in `.insetu-data/settings/mddb.md` (or `settings/<ext>.md`) using `same_property`, `numeric_window`, and `edge_ref` rules (synthesized with LLM assistance during initial repo setup and maintained deterministically on iterative edits), routines and UI lenses can switch between physical, logical, and conceptual blast radii without custom plugin code.

---

## 5. Physical File Placement Law: Bounded 2-Level Folder Topology

Unbounded directory trees turn file paths into brittle taxonomies, while completely flat directories become unnavigable at scale. Furthermore, moving physical `.md` files on every transient state change (`open` $\rightarrow$ `active` $\rightarrow$ `blocked`) breaks `vfs://` URI stability and pollutes Git history.

`md-db` enforces a **Bounded 2-Level Folder Topology (`Max Physical Depth = 2`)** anchored by fixed root categories:

$$\text{vfs://}\langle\text{repo}\rangle/\underbrace{\langle\text{kind\_root}\rangle}_{\text{Level 0 (Fixed Category)}}/\underbrace{[\langle\text{group\_slug}\rangle/]}_{\text{Level 1 (Optional Partition)}}\underbrace{\langle\text{record\_slug}\rangle.\text{md}}_{\text{Level 2 (File Record + Inline Spans)}}$$

1. **Level 0 — Fixed Root Categories (`kind -> folder`):**
      - Every file-level record `kind` in the active schema maps to a fixed top-level category directory (e.g., Ur-categories `works/`, `forms/`, `melodies/`, `artists/` and instance categories `shows/`, `recordings/` in a musicology repo; `authors/`, `books_and_journals/`, `articles/`, `concepts/` in a research repo; `.insetu-data/tracker/items/` in Tracker).

2. **Level 1 — At Most One Grouping Subfolder (`subfolder_by`):**
      - Below each fixed root category, files may be partitioned by **at most one subfolder level** (`Level 1`), optionally driven by a stable schema property (`subfolder_by: <field>`):
      - `shows/paris_by_night/pbn_088.md` (`subfolder_by: series`)
      - `works/tan_nhac/suong_chieu.md` (`subfolder_by: primary_genre`)
      - `forms/cai_luong/vong_co.md` (`subfolder_by: tradition`)
      - `.insetu-data/tracker/items/active/trk-104.md` vs. `.insetu-data/tracker/items/archived/trk-099.md` (`subfolder_by: lifecycle_bucket`)
      - Creating a third directory level under a root category is forbidden and flagged by `topology.audit_upkeep`.

3. **4 Levels of Total Expressive Depth (2 Physical + 2 Inline):**
      - Because each `.md` file at Level 2 can host `##` (Level 3) and `###` (Level 4) heading-scoped sub-record spans (such as `Show` $\rightarrow$ `## Liên Khúc Track` $\rightarrow$ `### Song/Vọng Cổ Segment`, or `Epic` $\rightarrow$ `## Sprint` $\rightarrow$ `### Task`), a repository achieves 4 levels of hierarchical containment while its physical directory tree never exceeds 2 folders deep.

4. **URI Stability & Terminal Archival (`archive_on_status`):**
      - Non-terminal status transitions (`open -> active -> blocked -> done`) mutate **only** the YAML block in-place via `JSON_PATCH`, keeping the file's `vfs://` URI 100% invariant.
      - A physical VFS move occurs **only** when a root file record transitions into a terminal archival state (`status: archived | closed`) and moves into its Level-1 `archived/` subfolder.

---

## 6. Sidecar vs. Primary-Surface `md-db` Scopes & Unified Layered Schema Contract

Rather than introducing a separate `.yaml` configuration mechanism, `md-db` unifies its schema declarations with `inSetu`'s **Layered Markdown-as-Code Settings (`ctx://settings/`)** architecture (`2026-10-30-repo-facts-and-directives.md`). Every `md-db` schema lives in the YAML frontmatter of `.insetu-data/settings/mddb.md` or `settings/<ext>.md` (governed by `authority: repo_content`), while prose agent instructions remain strictly in `.insetu-data/settings/agent.md` under S8 human attestation!

### 6.1 Two Mounting Scopes: Extension Sidecars vs. Primary-Surface Repositories

`mddb_indexer` indexes Markdown records across two distinct scopes in `md_records` (tagged by `db_scope`):

| Scope Type | Physical Root | Governing Layered Schema | Purpose & Examples |
| :--- | :--- | :--- | :--- |
| **1. Extension Sidecar `md-db`**<br>(`db_scope = "ext:<name>"`) | `vfs://<repo>/.insetu-data/<ext>/` and global `ctx://<ext>/` (plus `ws://` shared mounts) | `ctx://settings/.templates/<ext>/<ext>.md` (shipped default) $\rightarrow$ `ctx://settings/<ext>.md` (workspace) $\rightarrow$ `vfs://<repo>/.insetu-data/settings/<ext>.md` (repo override) | **Internal Git-Backed Extension Data:**<br>Used by `tracker` (`.insetu-data/tracker/items/`), `notes`, `skills`, and `research` inside any repository without polluting the repository's main file tree. |
| **2. Primary-Surface `md-db` Repo**<br>(`db_scope = "repo:<repo>"`) | The repository root itself: `vfs://<repo>/<kind_folder>/` | `ctx://settings/.templates/user/mddb_<preset>.md` (optional user preset) $\rightarrow$ **`vfs://<repo>/.insetu-data/settings/mddb.md`** (shared repo schema + directives) $\rightarrow$ `.insetu-data/settings.local/mddb.md` (local override) | **Dedicated Knowledge / Archival / Hardware Repos:**<br>Used when the repository itself *is* the database (e.g., `vn-traditional-music/` with top-level `works/`, `forms/`, `artists/`, `shows/`, `recordings/` folders, or a MIDI controller rig repo). |

* **Coexistence in the Same Repository:** Because Extension Sidecars are confined to `.insetu-data/<ext>/` (`db_scope = "ext:tracker"`) and Primary-Surface repositories index top-level domain folders (`db_scope = "repo:<repo>"`, automatically ignoring `.insetu-data/`), a Primary-Surface repository like `vn-traditional-music/` can simultaneously use its root folders for musicological records **and** use `.insetu-data/tracker/` for editorial tasks without any collision!
* **Repository Creation & Onboarding (`repo_type: "mddb"`):**
  - When creating or configuring a repository in `InSetuNewFolderProjection` or `Workspace Manager`, the user can select **Repository Type: `Code / General`** or **`Markdown Database (md-db)`** (or `inSetu` auto-detects `md-db` mode whenever `.insetu-data/settings/mddb.md` is present).
  - Selecting `md-db` scaffolds `.insetu-data/settings/mddb.md` (either from a user preset or via the cold-start LLM schema synthesizer) and defaults tracked extensions to `.md`.

### 6.2 Universal Core Envelope & Domain-Specific YAML Normalization
Regardless of domain, every file-level and heading-level record normalizes universal envelope keys into SQLite columns on `md_records` (`PRIMARY KEY (db_scope, id)`):
* `db_scope` (`TEXT`): Partition scope (`"ext:tracker"`, `"ext:notes"`, `"ext:skills"`, or `"repo:<repo>"`).
* `id` (`TEXT`): Canonical identifier (e.g., `ur:work/suong_chieu`, `show:pbn_088#seg_2`, `trk-104`).
* `kind` (`TEXT`): Record collection/archetype defined in the active schema (`recording`, `segment`, `ur_work`, `ur_form`, `author`, `publication`, `article`, `concept`, `manuscript`, `campaign`, `chapter`, `task`).
* `tier` (`INTEGER`): Structural depth tier (`1` = Root, `2` = Interior / Deliverable, `3` = Leaf / Segment, `0` = Timeless Ur-Record / Reference Entity).
* `nature` (`TEXT`): Canonical semantic valence mapping to UI intent (`build` [primary], `defect` [danger], `refine` [warning], `inquiry` [highlight]).
* `title` (`TEXT`): Human-readable title (extracted from YAML `title:` / `name:` or the `## [time_span] Title` heading text).
* `parent_id` (`TEXT`): Containment tree parent (explicit in frontmatter for cross-file parents; implicit from enclosing `#` / `##` heading rank for inline sub-records).
* `seq_order` (`INTEGER`): Deterministic sibling order (`1..N`).
* `status` (`TEXT`): Canonical lifecycle state (`queue | open | active | blocked | done | archived`).

#### 6.2.1 Domain-Specific YAML Authoring $\rightarrow$ Canonical Internal Mapping
Authors and LLMs write natural, domain-specific terms in Markdown YAML frontmatter and sub-record blocks; `mddb` normalizes those terms into the canonical SQLite columns at index time using the repository's resolved schema while preserving the author's domain terms in `properties_json`:
1. **Domain `kind` (and `type` alias) $\rightarrow$ `tier` & `default_nature`:**
   - Different repositories can define Tier 1 as `epic` vs. `project` vs. `series` vs. `publication`, Tier 2 as `sprint` vs. `manuscript` vs. `campaign` vs. `article`, and Tier 3 as `task` vs. `chapter` vs. `segment` vs. `excerpt`.
   - Each `kind` in `kinds:` declares its `tier` (`0..3`), optional `default_nature` (e.g., a repo that defines `bug` as a `kind` or alias maps `bug` $\rightarrow$ `tier: 3, default_nature: defect`), and `aliases: [...]` (accepting `type:` as a synonym for `kind:`).
2. **Domain `nature` Synonyms (`nature_map`) $\rightarrow$ Canonical `{build, defect, refine, inquiry}`:**
   - A user or LLM can write `nature: bug`, `nature: error`, `nature: regression`, or `nature: continuity_error` in YAML, and `mddb` normalizes it to `nature = "defect"` in SQLite (so the `🔴 Defects` filter pill, danger card intent, and parent defect roll-up counts work identically across all repos):
     - `build` $\leftarrow$ `build, feature, todo, draft, create, primary, annotation`
     - `defect` $\leftarrow$ `defect, bug, error, regression, hotfix, discrepancy, continuity_error`
     - `refine` $\leftarrow$ `refine, refactor, polish, edit, cleanup, tech_debt`
     - `inquiry` $\leftarrow$ `inquiry, spike, research, review, question, audit`
   - Repositories can extend `nature_map` in `.insetu-data/settings/mddb.md` or `settings/tracker.md`.
3. **Domain `status` Synonyms (`status_map`) $\rightarrow$ Canonical `{queue, open, active, blocked, done, archived}`:**
   - Domain-specific workflow stages (e.g., `untouched -> memorizing -> memorized -> mastered` in `skills`, or `triage -> draft -> review -> published` in writing) map to canonical `status` buckets via `status_map` so cross-repo progress roll-ups (`done / total`) and stage boards work out of the box while preserving `raw_status` in `properties_json` for domain-specific stage labels.
4. **Field Role Aliases (`title_key`, `parent_key`):**
   - Schemas may alias domain keys to envelope columns (e.g., `name` $\rightarrow$ `title` and `group` $\rightarrow$ `parent_id` in `ext:skills`), allowing existing domain files to be indexed without rewriting their YAML keys.

### 6.3 Kernel & Core Alignment Invariants (`akasa` + `insetu/core`)
1. **`akasa/db.py` First-Class Declarative Constraints, Indexes & Connection Pool (`mddb.db`):**
   - Raise the per-workspace thread connection LRU cap in `akasa/db.py` (`get_connection`) from `4` to `16` so core and domain databases (`workers`, `topology`, `cartographer`, `vfs_index`, `mddb`) never thrash connections during compilation or RAG turns.
   - Upgrade `apply_declarative_schema` in `akasa/db.py` to support optional `"__constraints__": [...]` (table-level `PRIMARY KEY (...)` / `UNIQUE (...)` clauses) and `"__indexes__": [...]` (`CREATE INDEX IF NOT EXISTS ...` statements executed automatically during migration and skipped during column-diffing), allowing `mddb_bp` to own a dedicated `mddb.db` (`schema=MDDB_SCHEMA`) with composite primary keys and declarative indexes.
2. **Strict Separation Between Pure `MarkdownLanguageProvider` (`languages/markdown.py`) and `md-db` (`mddb/parser.py`):**
   - **Layer 1 — Pure Markdown Syntax & Semantics (`insetu/core/languages/markdown.py`):**
     Knows *nothing* about `md-db` schemas (`tier`, `kind`, `ur:`, `nature`). It understands native Markdown primitives across *all* `.md` files in `inSetu`:
     - `definitions()` & `scope_boundaries()`: Parses `#` / `##` / `###` heading hierarchies with exact `start_line..end_line` section spans and fenced code blocks.
     - `imports()`: Extracts standard Markdown links (`[anchor](./rel/path.md#heading)`), wiki-links (`[[target|anchor]]`), Pandoc/CSL citation keys (`[@csl_id]`), reference links, and `{{include_prompt: ...}}` macros—resolving relative paths (`./`, `../`) to canonical `vfs://` URIs and recording the **anchor text** and **enclosing heading** as semantic edge context.
     - `exports()`: Exposes document titles, heading slugs (`#section-slug`), and bold definition lead-ins (`**Term:**`).
     - `slice_interface()`: Compresses large Markdown documents under the 12k token ceiling by retaining frontmatter, `#`/`##`/`###` headings, bold lead-in definitions (`**...**`), blockquotes, and link lines while eliding long paragraphs.
     - `extract_symbol_slice()`: Slices any Markdown section by heading title or slug for `cartographer.extract` and `<<<<<<< QUERY_CONTEXT`.
   - **Layer 2 — `md-db` Relational Record & Edge Extractor (`insetu/core/mddb/parser.py`):**
     Consumes `MarkdownLanguageProvider`'s output and applies the active `md-db` schema (`kinds`, `tier`, `parent_id`, fenced ```` ```yaml ```` sub-records under `##`/`###` headings, `- [ ] [ID]` tasks, `targets:` foreign keys, and `ur:` edges)—automatically converting resolved relative Markdown links (`[Bakhtin](../authors/bakhtin.md)`) and citation keys (`[@bakhtin1981]`) into `rel_type = "cites"` edges in `md_edges`!
3. **Unified Slew-Limited `topology_resolved` for Both `vfs://` and Sovereign `ctx://` / `ws://` Data Volumes:**
   - Extend `buffer_topology_events` and `_topology_slew_limiter_loop` in `engine_topology.py` to fold mutations on sovereign `ctx://` data volumes (excluding compiled `ctx://contexts/` and `ctx://diffs/` outputs) and `ws://` mounts into `topology_resolved` (`ctx_events`), so `mddb_bp` and other extensions subscribe to a single debounced event stream.
4. **IoC Landmark & `CORE_MODULES` Parity:**
   - Remove hardcoded `tracker_dir` / `tracker_closed_dir` logic from `build_sys_landmarks_context` in `engine_topology.py`; `engine_tracker.py` registers its own landmarks via `register_repo_landmarks`.
   - Maintain strict parity between `CORE_MODULES_TUPLE` (`insetu/core/sdk/__init__.py`) and `_baseCore` (`insetu/core/system/insetu_sdk.js`), enforced by a unit test.
5. **S8 Security & Directive Separation (`authority: repo_content` vs. `agent.md`):**
   - `mddb_bp` registers `MDDB_SETTINGS_SCHEMA` with `authority: "repo_content"` so `read_repo_tier_settings(ctx, repo, "mddb")` permits `kinds`, `fields`, `proximity_filters`, and `domain_jumps` in `.insetu-data/settings/mddb.md` and `settings.local/mddb.md`.
   - Prose agent instructions remain exclusively in `.insetu-data/settings/agent.md` (protected by `INSETU_PROTECTED_VFS_TARGETS` and `repo_directive` human attestation in `directives.py`).

### 6.4 Multi-Collection Repositories & Schema Contract (`.insetu-data/settings/mddb.md` or `settings/<ext>.md`)
An `md-db` repository is **not** restricted to a single table or a single hierarchy. A single repository (for example, a humanities/literature database with `authors/`, `books_and_journals/`, `articles/`, and `concepts/`, or a musicology repo with `works/`, `forms/`, `melodies/`, `artists/`, `shows/`, `recordings/`) can host **multiple distinct collections (`kinds`)** that cross-reference one another:

1. **`kinds` Map (Collections, Root Folders, `tier`, `is_ur` & `allowed_children`):**
      - Each entry in `kinds:` defines a distinct collection ("table") with its own top-level `folder` (relative to the scope root, confined by `authority: repo_content` with no `..` traversal), optional `subfolder_by` rule, `tier` (`0` for timeless reference collections/Ur-Records like `author`, `concept`, `ur_work`, `ur_form`; `1..3` for hierarchical containers/items like `publication -> article -> excerpt` or `epic -> sprint -> task`), `id_prefix`, `is_ur: true | false`, `inline_only: true | false` (for heading-scoped spans), and `allowed_children: [<kind>, ...]`.
2. **`fields` Map (Typed Parameters, `applies_to` Table Scoping, `targets` Cross-Collection Foreign Keys & Roll-Up Reducers):**
      Defines the canonical YAML keys allowed across the database:
      - **`type`:** `ur_ref` | `ur_ref_list` | `vfs_uri_list` | `enum` | `enum_list` | `int_list` | `integer` | `string` | `timestamp_range`.
      - **`applies_to`:** List of `kinds` that own this field (e.g., `tradition` applies to `[concept, author]`; `cau: [1, 2]` applies to `[segment]`; `word_count_target` applies to `[manuscript, chapter]`), scoping both `<insetu-frontmatter-editor>` and the Filter Tray when a collection is selected.
      - **`targets`:** Constrains which target collection `kinds` may be linked (e.g., `authors: {type: ur_ref_list, applies_to: [publication, article], targets: [author]}` or `concepts: {type: ur_ref_list, applies_to: [article, excerpt], targets: [concept]}`), acting as a **typed cross-collection foreign key** in `md_edges` (`rel_type = "<field_name>"`).
      - **`rollup`:** Declares how parent records aggregate this field from their child segments/tasks (`union` for sets/lists like `performers`, `authors`, `concepts`, `form`, `lang`, `targets`; `progress_ratio` for `status`; `sum` / `count` for numeric metrics).
      - **`facet`:** When `true`, exposes the parameter as an interactive filter/grouping dimension in the Tree, Board, and Ur-Index UI lenses and in `InSetuFrontmatterEditor` metadata drawers.
3. **`proximity_filters` & `domain_jumps`:**
      - Declares custom multiplex RAG edge builders (`same_property`, `numeric_window`, `edge_ref`) and cross-axis jump templates (`mddb.ur_intersection`, `mddb.containment_ancestors`, `mddb.containment_children`, `mddb.property_window`) as specified in `vfs://insetu/docs/models/proximity_filters_and_domain_jumps.md`.
4. **Deterministic Governance & Linting:**
      - **Editor UI:** `InSetuFrontmatterEditor` reads the resolved schema to render typed dropdowns, multi-tag pills, and cross-collection/Ur-Record autocomplete selectors for the record's `kind`.
      - **Agent RAG:** When an `llm` node edits or queries an `md-db` repository, the resolved schema is mounted in `governance` so the model uses exact canonical field names, valid `allowed_children` pairings, and `ur:` prefixes.
      - **Upkeep Audit:** `topology.audit_upkeep` validates repository `.md` frontmatter and sub-record YAML blocks against the resolved schema, flagging undeclared parameter typos, disallowed parent-child `kind` pairings, physical folder depth $> 2$, or dangling `ur:` / foreign-key links.

### 6.5 Cross-Repository & Cross-Scope Graph Connections
Because all scopes within a workspace (`"repo:<repo_a>"`, `"repo:<repo_b>"`, `"ext:tracker"`, `"ext:notes"`, `"ext:skills"`) share the workspace's `mddb.db` ledger, `md_edges` stores `(source_scope, source_id, rel_type, target_scope, target_id, context_text)` and supports seamless cross-database links:
1. **Workspace-Global Archetypes (`ur:<category>/<slug>` & `cit:<csl_id>`):**
   - `ur:` and `cit:` identifiers are globally addressable across every repository and extension sidecar in the workspace (`target_scope = "*"`).
   - A performance segment in `repo:vn-music-archive`, a theoretical essay in `repo:cultural-theory`, a practice item in `ext:skills`, a note in `ext:notes`, and an editorial ticket in `ext:tracker` can all reference `ur:form/vong_co` (or `[@bakhtin1981]`). Querying `ctx.mddb.get_attestations("ur:form/vong_co")` or `ctx.mddb.get_backlinks("cit:bakhtin1981")` returns attestations across **all** repositories and sidecars in a single SQL query, grouped by `source_scope` and `kind`.
2. **Qualified Cross-Repo Instance Foreign Keys (`<repo>:<id>` or `<repo>/<id>`):**
   - Any `parent_id`, `depends_on`, or `targets:` foreign-key field can reference an instance record in another repository using `<repo>:<id>` or `<repo>/<id>` (resolving `target_scope = "repo:<repo>"` or `"ext:tracker"`).
3. **Cross-Repo Markdown & VFS Links (`vfs://<other_repo>/...`):**
   - Relative or `vfs://` Markdown links in prose that point to a file or `#heading` in another repository are resolved by `MarkdownLanguageProvider.imports()` and indexed in `md_edges` (`rel_type = "cites"`, `target_scope = "repo:<other_repo>"`), allowing `gather.py` (`resolve_relational_graph`) and `assemble_blast_radius` to traverse across repository boundaries.

---

## 7. The 3-Surface `mddb` API Contract (Python SDK, REST/Capabilities & Frontend JS)

All core modules (`gather`, `cartographer`, `bridge`, `topology`, `orchestrator`) and domain extensions (`tracker`, `notes`, `skills`, `citations`, `research`) interact with `md-db` exclusively through this unified contract:

### 7.1 Backend Python SDK (`ctx.mddb` on `InSetuContext`)
* **Schema & Scope Discovery:**
  - `ctx.mddb.get_schema(db_scope: str, repo: Optional[str] = None) -> Dict[str, Any]`
  - `ctx.mddb.resolve_scope_for_uri(uri: str) -> Optional[Tuple[str, str]]`
* **Indexing & Reconciliation:**
  - `ctx.mddb.index_file(uri: str, content: Optional[str] = None) -> List[Dict[str, Any]]`
  - `ctx.mddb.remove_file(uri: str) -> int`
  - `ctx.mddb.sync_scope(db_scope: Optional[str] = None, repo: Optional[str] = None) -> int`
* **Relational & Graph Queries:**
  - `ctx.mddb.query(db_scope: Optional[str] = None, *, repos=None, kinds=None, tiers=None, statuses=None, natures=None, parent_id=None, is_template=False, tags=None, facets=None, search=None, include_rollups=True, include_archived=False) -> List[Dict[str, Any]]`
  - `ctx.mddb.get_record(record_id: str, db_scope: Optional[str] = None, *, include_body=True, include_children=True, include_edges=True) -> Optional[Dict[str, Any]]`
  - `ctx.mddb.get_attestations(ur_id: str, db_scope: Optional[str] = None) -> Dict[str, Any]` (Reverse attestation instances + `seq_order ± 1` Markov adjacency)
  - `ctx.mddb.get_backlinks(target_id_or_uri: str) -> List[Dict[str, Any]]` (Instant `<1ms` lookup of all incoming `cites`, `ur`, `depends_on`, and `targets` edges)
  - `ctx.mddb.facets_summary(db_scope: str, repo: Optional[str] = None) -> Dict[str, Any]`
* **URI-Stable Mutations, Template Spawning & Upkeep:**
  - `ctx.mddb.upsert_record(db_scope: str, *, repo: str, kind: str, title: str, status: str = "open", nature: Optional[str] = None, parent_id: Optional[str] = None, properties: Optional[Dict[str, Any]] = None, body: str = "", record_id: Optional[str] = None, is_template: bool = False) -> Dict[str, Any]`
  - `ctx.mddb.patch_record(record_id: str, db_scope: str, *, updates: Dict[str, Any], body: Optional[str] = None) -> Dict[str, Any]` (Mutates Level-1 frontmatter or Level-2 `##` fenced YAML spans in-place; physically relocates root files only when entering/leaving `status: archived`)
  - `ctx.mddb.spawn_template(db_scope: str, template_id: str, *, target_repo: str, variables: Dict[str, str]) -> List[Dict[str, Any]]`
  - `ctx.mddb.audit_upkeep(repo: str) -> List[Dict[str, Any]]`

### 7.2 REST Endpoints & Agent Capabilities (`mddb.*` on `mddb_bp`)
* Read-Only Safe Capabilities (permitted in `/ask` and read-only routines):
  - `mddb.schema` (`GET /api/<ws>/mddb/schema`)
  - `mddb.query` (`POST /api/<ws>/mddb/query`)
  - `mddb.record` (`GET /api/<ws>/mddb/record`)
  - `mddb.attestations` (`GET /api/<ws>/mddb/attestations`)
  - `mddb.backlinks` (`GET /api/<ws>/mddb/backlinks`)
  - `mddb.facets` (`GET /api/<ws>/mddb/facets`)
* Mutation Capabilities:
  - `mddb.upsert` (`POST /api/<ws>/mddb/upsert`)
  - `mddb.patch` (`POST /api/<ws>/mddb/patch`)
  - `mddb.spawn_template` (`POST /api/<ws>/mddb/spawn_template`)

### 7.3 Frontend SDK (`window.inSetu.mddb` in `insetu_sdk.js`)
* `window.inSetu.mddb.getSchema(dbScope, repo)` — Cached schema resolver for `<insetu-frontmatter-editor>`, `<insetu-ext-tracker>`, and `<insetu-mddb-view>`.
* `window.inSetu.mddb.isManagedRecordPath(filepath)` — Identifies whether any `vfs://`, `ctx://`, or `ws://` URI belongs to an `md-db` scope and returns `{ dbScope, repo, kind }`.
* `window.inSetu.mddb.computeIntendedPath(schema, repo, record)` — Deterministic Bounded 2-Level Folder path generator for offline optimistic mutations.
