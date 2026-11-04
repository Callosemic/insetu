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
    - **Lens & Preset Pills:** `⚡ Active Focus` (default), `🌲 Hierarchy`, `📊 Stage Board`, `📥 Queue (<N>)`, `🔴 Defects (<N>)`, and `🏛️ Ur-Index (<N>)`.
    - **Repository & Schema Facets:** `<insetu-repo-filter>` plus compact `<sutram-pill>` / `<sutram-select>` filters for `tier` (`T1 | T2 | T3`), `kind`, and any `facet: true` fields declared in `schema.yaml` (plus an optional `+ Pin` chip for saving a favorite filter combination into `settings.local/tracker.md`).

---

## 4. Cross-Repo RAG Integration (`rag.blast_radius` over `md_edges`)

Because `md_records` and `md_edges` live in the workspace SQLite index alongside `topology_ledger` and `affinity_edges`:
* Attaching a recording or show file (`vfs://vn_music/recordings/...`) to an Agent turn automatically allows `rag.blast_radius` to follow `md_edges` and mount the referenced **Ur-Records** (`ur:work/...`, `ur:form/...`) at `slice` or `full` lens into `data`.
* Conversely, attaching an Ur-Record (e.g., `vfs://vn_music/forms/vong_co.md`) allows a deterministic RAG unit (`rag.attestations`) to pull the exact heading slices (`start_line..end_line`) of every segment across every recording that instantiates `ur:form/vong_co`—without loading the unrelated segments of those recordings!

---

## 5. Physical File Placement Law: Bounded 2-Level Folder Topology

Unbounded directory trees turn file paths into brittle taxonomies, while completely flat directories become unnavigable at scale. Furthermore, moving physical `.md` files on every transient state change (`open` $\rightarrow$ `active` $\rightarrow$ `blocked`) breaks `vfs://` URI stability and pollutes Git history.

`md-db` enforces a **Bounded 2-Level Folder Topology (`Max Physical Depth = 2`)** anchored by fixed root categories:

$$\text{vfs://}\langle\text{repo}\rangle/\underbrace{\langle\text{kind\_root}\rangle}_{\text{Level 0 (Fixed Category)}}/\underbrace{[\langle\text{group\_slug}\rangle/]}_{\text{Level 1 (Optional Partition)}}\underbrace{\langle\text{record\_slug}\rangle.\text{md}}_{\text{Level 2 (File Record + Inline Spans)}}$$

1. **Level 0 — Fixed Root Categories (`kind -> folder`):**
      - Every file-level record `kind` in `schema.yaml` maps to a fixed top-level category directory (e.g., Ur-categories `works/`, `forms/`, `melodies/`, `artists/` and instance categories `shows/`, `recordings/` in a musicology repo; `.insetu-data/tracker/items/` in Tracker).

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

## 6. Canonical Database Schema Contract (`.insetu-data/schema.yaml`)

Every `md-db` repository (and built-in domain extension like `tracker`) is governed by a declarative schema file at `vfs://<repo>/.insetu-data/schema.yaml` (or a built-in preset at `ctx://settings/.templates/<ext>/schema.yaml`).

### 6.1 Universal Core Envelope (Present on Every Record)
Regardless of domain, every file-level and heading-level record normalizes eight universal envelope keys into SQLite columns on `md_records`:
* `id` (`TEXT PRIMARY KEY`): Canonical identifier (e.g., `ur:work/suong_chieu`, `show:pbn_088#seg_2`, `trk-104`).
* `kind` (`TEXT`): Record archetype defined in `schema.yaml` (`recording`, `segment`, `ur_work`, `ur_form`, `manuscript`, `campaign`, `chapter`, `task`).
* `tier` (`INTEGER`): Structural depth tier (`1` = Root, `2` = Interior / Deliverable, `3` = Leaf / Segment, `0` = Timeless Ur-Record).
* `nature` (`TEXT`): Semantic valence mapping to UI intent (`build` [primary], `defect` [danger], `refine` [warning], `inquiry` [highlight]).
* `title` (`TEXT`): Human-readable title (extracted from YAML `title:` or the `## [time_span] Title` heading text).
* `parent_id` (`TEXT`): Containment tree parent (explicit in frontmatter for cross-file parents; implicit from enclosing `#` / `##` heading rank for inline sub-records).
* `seq_order` (`INTEGER`): Deterministic sibling order (`1..N`).
* `status` (`TEXT`): Lifecycle state (`queue | open | active | blocked | done | archived` for work items; optional `draft | verified` for research records).

### 6.2 What `schema.yaml` Declares per Domain
1. **`kinds` Map (Tiers, `allowed_children` & Folder Routing):**
      Defines each valid `kind`, its `tier` (`0..3`), its physical `folder` and `subfolder_by` rule, `id_prefix`, whether it is an `is_ur: true` archetype, and its `allowed_children: [...]` list constraining which child `kinds` may be parented under it.
2. **`fields` Map (Typed Parameters, Edge Targets & Roll-Up Reducers):**
      Defines the canonical YAML keys allowed across the database:
      - **`type`:** `ur_ref` | `ur_ref_list` | `vfs_uri_list` | `enum` | `enum_list` | `int_list` | `integer` | `string` | `timestamp_range`.
      - **`applies_to`:** Optional list of `kinds` for branch-specific parameters (e.g., `cau: [1, 2]` applies to `[segment]`; `word_count_target` applies to `[manuscript, chapter]`).
      - **`targets`:** For `ur_ref` / `ur_ref_list`, constrains which Ur-Record `kinds` may be linked and instructs the indexer to emit typed rows into `md_edges`.
      - **`rollup`:** Declares how parent records aggregate this field from their child segments/tasks (`union` for sets/lists like `performers`, `form`, `lang`, `targets`; `progress_ratio` for `status`; `sum` / `count` for numeric metrics).
      - **`facet`:** When `true`, exposes the parameter as an interactive filter/grouping dimension in the Tree, Board, and Matrix UI lenses and in `InSetuFrontmatterEditor` metadata drawers.
3. **Deterministic Governance & Linting:**
      - **Editor UI:** `InSetuFrontmatterEditor` reads `schema.yaml` to render typed dropdowns, multi-tag pills, and Ur-Record autocomplete selectors for the record's `kind`.
      - **Agent RAG:** When an `llm` node edits or queries an `md-db` repository, `schema.yaml` is mounted in `governance` so the model uses exact canonical field names, valid `allowed_children` pairings, and `ur:` prefixes.
      - **Upkeep Audit:** `topology.audit_upkeep` validates repository `.md` frontmatter and sub-record YAML blocks against `schema.yaml`, flagging undeclared parameter typos, disallowed parent-child `kind` pairings, or dangling `ur:` links.
