---
title: "Mental Model: Proximity Filters, Multiplex Topologies & Cross-Domain Jumps"
description: "Composable RAG retrieval algebra unifying AST call graphs, Hebbian affinity, string fuzziness, vector embeddings, custom multiplex schemas, and cross-domain test/governance projections."
domain: "Core Architecture"
tags: [mental-model, rag, proximity-filters, domain-jumps, multiplex-graph, traceability, rrf, lenses, invariants]
---

# Mental Model: Proximity Filters, Multiplex Topologies & Cross-Domain Jumps

Rather than treating "search" (locating entry points), "blast radius" (expanding outward along code imports), and "test scouting" (finding verification suites) as separate hardcoded heuristics, `inSetu` models all context retrieval as a single composable algebra of **Proximity Filters** and **Cross-Domain Jumps** paired with **Foveated Lens Decay** (`full` $\rightarrow$ `slice` $\rightarrow$ `outline`).

This document codifies the architectural invariants and mathematical foundations of that retrieval engine across polyglot codebases, `md-db` research corpora, and domain-specific hardware/data schemas.

---

## 1. Theoretical Foundations & Why Flat RAG Fails

Every piece of `inSetu`'s retrieval architecture builds on established computer science and network theory, adapted to the constraints of bounded LLM context windows:

1. **Multiplex Graph Theory (Multi-Layer Networks):**
   - The same set of nodes $V$ (files, AST symbols, `md-db` sub-records, or hardware presets) participates simultaneously in multiple distinct edge layers $E_1, E_2, \dots, E_m$.
   - For example, in a Morningstar MIDI controller schema, a single preset (`Bank 03, Switch D`) sits inside a **physical layer** (other switches on `Bank 03` or adjacent banks `02` and `04`), a **logical bus layer** (presets across any bank transmitting on `MIDI Channel 5`), and a **state-machine layer** (directed `Bank Jump` edges).
2. **Heterogeneous Information Networks (HINs) & Meta-Paths:**
   - Workspaces contain nodes of different ontological domains (`source`, `verification.unit`, `verification.behavioral`, `verification.fitness`, `verification.parity`, `governance`, `work`).
   - Crossing from one domain to another (a **Domain Jump**) follows a typed **Meta-Path** (for example: $\text{JS Source} \xrightarrow{\text{defines}} \text{CustomElement Tag} \xrightarrow{\text{queried\_by}} \text{Python/Node Behavioral Test}$).
3. **Software Traceability & Evolutionary Coupling:**
   - Static AST analysis alone cannot cross language boundaries, dynamic RPC dispatches (`ctx.call`), or black-box UX tests. Combining static references with patch-ratified co-change history (`bridge_ledger` $\rightarrow$ `affinity_edges`) and Information Retrieval (IR) bridges recovers true functional coupling.
4. **Hybrid IR & Reciprocal Rank Fusion (RRF):**
   - Discrete graph hops, BM25/trigram lexical scores, and dense vector cosine similarities live on incompatible numerical scales. Merging candidate lists via **Reciprocal Rank Fusion (RRF)** combines rankings without brittle weight calibration:
     $$\text{Score}_{\text{RRF}}(v) = \sum_{f \in \mathcal{F}} w_f \cdot \frac{1}{k_0 + \text{rank}_f(v)} \quad (k_0 = 60)$$
5. **Foveated Distance-to-Lens Decay (`full` $\rightarrow$ `slice` $\rightarrow$ `outline`):**
   - Commercial coding tools avoid multi-hop graph traversal because dumping full files at hop depth $d \ge 2$ causes an $O(b^d)$ token explosion, forcing them to rely on slow, expensive multi-turn "agentic `grep`" loops (which also fail completely on 1-shot `web_chat` handoffs).
   - `inSetu` solves the branching-factor cliff by coupling **distance** to **Representational Lenses**: focal seeds ($d=0$) mount at `full` (or `diff`), immediate neighbors ($d=1$) mount at `slice` (signatures, types, docstrings, YAML metadata), and the extended perimeter ($d=2+$) mounts at `outline` (1-line coordinates), backed by 1-hop `QUERY_CONTEXT` promotion on demand.

### 1.2 The Hourglass Architecture: Opinionated Physics, Open Ontology

`inSetu` sits in the structural middle between code-only agentic CLI harnesses and unstructured PKM note tools by separating **Opinionated Kernel Physics** from **Open Domain Ontology**:

* **Opinionated Physics (The Narrow Waist):** The 6 volatility-ordered context buckets (`governance` $\rightarrow$ `hierarchy` $\rightarrow$ `meta` $\rightarrow$ `data` $\rightarrow$ `telemetry` $\rightarrow$ `prompt`), the 4 representational lenses (`full`, `diff`, `slice`, `outline`), Foveated Lens Decay, deterministic epistemic verification (`bridge.sync`, `bridge.test`, `attestations.py`), and zero-config defaults (`resolve_repo_landmarks`, `URI#symbol` AST graphs, FTS5, and `affinity_edges`) are fixed kernel laws.
* **Wide-Open Ontology (The Composable Algebra):** Any domain—polyglot software repositories, `md-db` archival corpora, or hardware state-machine schemas—can project its domain entities and relationships onto the engine using declarative Proximity Filters and Cross-Domain Jumps, executing identically across automated API/local drivers and 1-shot `web_chat` handoffs.

---

## 2. Primitive 1: Proximity Filters (Within-Domain Traversal & Search)

A **Proximity Filter** $F$ is a parameterized operator that takes a seed set $S_0$ (attached resource URIs, dirty diff symbols, or a query string/embedding), traverses or scores candidates along an algorithmic **`basis`** up to **`depth`** $k$, and assigns a representational lens per distance band:

$$F(S_0, \text{basis}, k, \text{lens\_schedule}) \rightarrow \{ (v, \text{span}, \text{band}, \text{score}, \text{lens}) \}$$

### 2.1 Discrete Graph Proximity Families (Hop Distance $d \in \mathbb{N}$)

| Filter Basis | Underlying Ledger / Parser | What Defines Adjacency (1 Hop) | Directionality |
| :--- | :--- | :--- | :--- |
| **`ast.call_graph`** | `insetu/core/languages/` (Tree-Sitter + `ast`) & `symbol_ledger` | **Symbol-to-Symbol (`URI#symbol_A -> URI#symbol_B`):** Function/method $A$ invokes symbol $B$, or class $A$ inherits from $B$, scoped strictly to the symbol and its intra-file callees rather than the whole file. | `outbound` (callees), `inbound` (callers), or `both` |
| **`ast.module_imports`** | `BaseLanguageProvider.imports` / `exports` | File $A$ imports symbol $s$ from File $B$ (piercing barrel re-exports in `sdk/__init__.py` and `insetu_sdk.js` directly to the defining leaf symbol `URI_leaf#s`). | `outbound`, `inbound`, `both` |
| **`affinity.co_change`** | `bridge_ledger` $\rightarrow$ `affinity_edges` | Symmetric write $\leftrightarrow$ write coupling (`same_tx` $3.0$, `adjacent_tx` $2.0$, `same_session` $1.0$) with multi-day exponential decay. | `undirected` |
| **`affinity.conditioning`** | `affinity_edges` (`context_to_patch`) | Asymmetric read $\rightarrow$ write conditioning: resource $A$ was mounted in context when patch to $B$ was ratified. | `inbound` to target $B$ |
| **`hierarchy.container`** | `topology_ledger` & `md_records` | Sibling files in the same directory/sub-bucket, or parent/child/sibling `##` sub-records (`parent_id`, `seq_order` $\pm k$). | `undirected` / `tree` |
| **`mddb.ur_intersection`** | `md_records` & `md_edges` | Hop 1: instance segment $\rightarrow$ canonical `ur:` archetype (`ur:work/...`, `ur:form/...`). Hop 2: `ur:` $\rightarrow$ peer segments across the corpus. | `bipartite` ($d=1, 2$) |
| **`schema.<custom>`** | `.insetu-data/schema.yaml` / `md_records` | Repository-declared multiplex rules (`same_property`, `numeric_window`, `edge_ref`). | Declarative |

### 2.2 Graph Traversal Strategies: Discrete Hop Walk (`bfs`) vs. Personalized PageRank (`ppr`)

Because `inSetu` decouples the **edge substrate (`basis`)** from the **graph walk operator (`traversal`)**, any discrete graph filter (`ast.*`, `affinity.*`, `mddb.*`, `schema.*`) can be traversed using either a deterministic hop boundary or a continuous random-walk diffusion:

1. **Discrete $k$-Hop Walk (`traversal: bfs`, Default — Parameterized by `depth: 1 | 2 | 3`):**
   - **Mechanics:** Strict breadth-first hop distance ($d = 1, 2, \dots, k$) from the seed set $S_0$.
   - **When to Use:** Surgical implementation and verification tasks (`/code`, `/test`, `/wrap`) where you know the focal symbol/file and want its exact immediate callers, callees, and coupled unit tests without probabilistic drift.
2. **Personalized PageRank Diffusion (`traversal: ppr` — Parameterized by `damping: 0.85`, `max_iterations: 20`):**
   - **Mechanics:** Runs power-iteration Personalized PageRank (the algorithm behind Aider's RepoMap, generalized across all multiplex layers) with teleportation/restart probability $(1 - \alpha)$ anchored on the seed set $S_0$. Probability mass flows outward along directed/undirected edges, dividing by out-degree ($\frac{\text{PR}(u)}{\text{out\_degree}(u)}$) at each step.
   - **Why It Complements `bfs`:** Instead of a rigid hop cutoff, PPR naturally surfaces **structural crossroads**—nodes reached by multiple independent paths from $S_0$ accumulate high stationary probability, while high-degree hub noise is automatically dampened by out-degree division.
   - **Multiplex Generality:** Unlike static code-only RepoMaps, `traversal: ppr` in `inSetu` can run over `ast.call_graph` (at `URI#symbol` granularity), `affinity.co_change` (finding the evolutionary epicenter of recent work), or `mddb.ur_intersection` (finding central repertoire/collaborator hubs across recordings).
   - **Percentile-to-Lens Mapping:** Stationary PageRank scores map directly to Representational Lenses (`top_3: full`, `top_10: slice`, `top_30: outline`).

### 2.3 Continuous Feature & Metric Proximity Families ($d \in [0.0, 1.0]$)

Continuous filters accept either a text query/prompt or an existing node's content as $S_0$ and quantize continuous similarity into discrete **Distance Bands (`Band 0`, `Band 1`, `Band 2`)** so they map onto Representational Lenses identically to discrete graph hop counts:

| Band / Depth | Discrete Graph Filter (`ast.*`, `affinity.*`, `schema.*`) | String Filter (`string.*`) | Vector Filter (`vector.*`) | Default Lens |
| :--- | :--- | :--- | :--- | :--- |
| **Band 0 (Focal / Exact)** | Seed resource/symbol ($d = 0$) | Exact literal or regex match ($d = 0.0$) | Near-duplicate / identical chunk ($\text{sim} \ge 0.92$) | **`full`** (or **`diff`**) |
| **Band 1 (Close)** | 1 hop away (direct caller/callee, same MIDI bank) | `identifier_parts` / stem / token-set match ($d \le 0.20$) | High semantic similarity ($0.80 \le \text{sim} < 0.92$, Top 1–3) | **`slice`** |
| **Band 2 (Perimeter)** | 2 hops away (caller of caller, adjacent bank $\pm 1$) | FTS5 `bm25` / `trigram` / Levenshtein neighborhood ($d \le 0.45$) | Moderate conceptual similarity ($0.70 \le \text{sim} < 0.80$, Top 4–10) | **`outline`** |


   - **`exact` / `regex` (`Band 0`, $d = 0.0$):** Deterministic literal or regex match over tracked files, AST symbols, or frontmatter keys.
   - **`identifier_parts` (`Band 1`, $d \le 0.25$):** Splits `camelCase`, `PascalCase`, `snake_case`, and `kebab-case` into normalized token sets and stems (bridging `hydrateVfsBuffer` in JS $\leftrightarrow$ `vfs_buffer` in Python).
   - **`bm25` (`Band 1..2`):** Zero-dependency SQLite FTS5 `bm25()` keyword ranking over `symbol_ledger` docstrings, `file_descriptions`, and `md_records`.
   - **`trigram` / `levenshtein` (`Band 2`, $d \le 0.45$):** SQLite FTS5 `trigram` tokenizer and bounded edit/line-sequence similarity (`SequenceMatcher`), surviving typos, diacritic variations (`Vọng cổ` vs. `vong co`), and structural code clones.
2. **Dense Vector Proximity (`basis: vector.cosine`):**
   - Keyed in SQLite by `(uri, symbol_or_span_id, body_hash)`—reusing Cartographer's normalized `body_hash` so unchanged functions and `md-db` sub-records are never re-embedded.
   - Supports both **Query-to-Node** (finding entry points from a natural-language prompt when no files are attached) and **Node-to-Node** (finding conceptually analogous implementations or arrangements across the workspace).

### 2.4 Symbol-Level Resolution on Connector & Utility Files (Eliminating the "Super-Hub" Problem)

When a RAG graph treats **whole files** as nodes, shared utility modules (`utils_core.py`) and SDK barrels (`sdk/__init__.py`, `insetu_sdk.js`) become artificial "super-hubs" that falsely couple every module in the workspace to every other module. `inSetu` eliminates super-hub contamination by resolving code relationships at **Symbol Granularity (`URI#symbol`)** combined with **Semantic Function Intent**:

1. **Sub-File Symbol Isolation (`URI#symbol` Nodes, Not File Nodes):**
   - Importing or calling `resolve_macro_includes` from `utils_core.py` creates an edge strictly to `vfs://insetu/insetu/core/utils_core.py#resolve_macro_includes`—never to the other 35 unrelated functions in `utils_core.py`.
   - Outbound hops from `utils_core.py#resolve_macro_includes` follow only the intra-file and cross-file symbols called *inside `resolve_macro_includes`'s own AST body*. Uncalled sibling functions in `utils_core.py` remain completely disconnected.
2. **Transparent Barrel & Membrane Piercing (Zero Hop Cost):**
   - Boundary barrels (`insetu/core/sdk/__init__.py`, `insetu/core/system/insetu_sdk.js`, `akasa/__init__.py`, `sutram_sdk.js`) re-export symbols from internal leaf modules.
   - The symbol indexer resolves barrel re-exports as **zero-cost pointer aliases** directly to the canonical leaf definition (e.g., `from insetu.core.sdk import fetch_url` resolves directly to `vfs://insetu/insetu/core/system/security_io.py#fetch_url`), so barrel files never act as graph hubs.
3. **Task-Conditioned Symbol Transmission (What the Function Actually Does):**
   - When expanding *inbound* callers at Hop $d \ge 2$ through a shared helper symbol $u$ (e.g., deciding whether to pull in other callers of `resolve_macro_includes` vs. other callers of ubiquitous plumbing like `InSetuURI`), traversal is gated by what symbol $u$ actually does relative to the active task:
     $$\text{Transmission}(u) = \text{Sim}_{\text{task}}\bigl(\text{doc\_and\_body}(u), \text{query}\bigr) \cdot \log\!\left(\frac{|V_{\text{symbols}}|}{1 + \text{in\_degree}(u)}\right)$$
   - Domain-specific helpers whose docstring and AST body align with the task intent (`resolve_macro_includes` during a prompt-macro task) transmit the walk to their peer callers (`orchestrator.py`, `routine_check.py`), whereas ubiquitous value objects (`InSetuURI`) provide their own interface signature without fanning out to 200 unrelated callers.
4. **Surgical Symbol Slicing (`slice_interface(..., requested_symbols=[...])`):**
   - When a symbol inside a large utility file is mounted into `data`, `slice_interface` and `extract_symbol_source_slice` project only the matched symbol(s) (and their intra-file dependencies) rather than dumping the entire utility file's skeleton.

### 2.5 Declarative Multiplex Schema Filters (`schema.<name>`)

To uphold the **Target-Repository Agnosticism Mandate** (`01_engineering_standards.md` §0), core `inSetu` never hardcodes domain-specific schemas. Instead, core provides three relational edge builders that any repository can compose inside the YAML frontmatter of `.insetu-data/settings/mddb.md` or `.insetu-data/settings/topology.md` (and automatically derives default filters from any field marked `facet: true` or `targets:` in the active `mddb` schema):

* **`same_property` (Equivalence Class Join):** Connects records sharing the value of `field` (e.g., all MIDI presets sending on `midi_channel: 5`, or all segments in `key: Dm`).
* **`numeric_window` (Metric / Sequential Adjacency):** Connects records where $|A.\text{field} - B.\text{field}| \le \text{window}$ (e.g., physical `bank_number` $\pm 1$, or medley `seq_order` $\pm 1$).
* **`edge_ref` (Directed Foreign-Key Hop):** Connects record $A$ to record $B$ when $A.\text{field}$ references $B.\text{id}$ (e.g., a `Bank Jump` message pointing to `bank:12`, or a `target_device` field pointing to `ur:device/strymon_timeline`).

**Example — Multiplex Physical vs. Logical Layers in a Morningstar MIDI Controller Rig (`.insetu-data/schema.yaml`):**
```yaml
proximity_filters:
  # 1. Physical Layer: Switches on the same pedalboard bank (d=1) or adjacent banks +/- 1 (d=2)
  physical_bank:
    label: "Physical Bank Layout"
    rule: same_property
    field: bank_number
    adjacent_window: 1

  # 2. Logical Bus Layer: Presets across any bank transmitting on the same MIDI channel + target device map
  midi_channel_bus:
    label: "MIDI Channel & Device Bus"
    combine: union
    compose:
      - rule: same_property
        field: midi_channel
      - rule: edge_ref
        field: target_device_ur

  # 3. Navigational Layer: Directed Bank Jump state-machine flow across songs
  performance_flow:
    label: "Bank Jump Navigation Graph"
    rule: edge_ref
    field: jump_to_bank
    direction: both
```

Multiple filters within a stage can be combined via **`rrf`** (Reciprocal Rank Fusion), **`union`** (disjunctive expansion), **`intersect`** (conjunctive filtering, e.g., `physical_bank` $\cap$ `midi_channel_bus`), or **`weighted_sum`**.

---

## 3. Primitive 2: Cross-Domain Jumps (Polyglot & Behavioral Traceability)

When a prompt or Routine step needs to move from implementation code (`domain: source`) to its tests (`domain: verification.*`), governing specifications (`domain: governance`), or open backlog items (`domain: work`), it executes a **Domain Jump**:

$$\text{Jump}(S_{\text{origin}}, \text{target\_domain}, \text{bridges}) \rightarrow \{ (v \in \text{target\_domain}, \text{band}, \text{score}, \text{lens}) \}$$

### 3.1 Ontological Target Domains
Resolved dynamically from `resolve_repo_landmarks()` and `.insetu-data/schema.yaml`:
* **`source`:** Primary implementation files and domain data records.
* **`verification.unit`:** Direct unit test modules (`sys.test_dirs`).
* **`verification.behavioral`:** Cross-runtime, UX, DOM, or integration harnesses (e.g., Python tests executing JS modules via Node `js_loader.mjs`, Playwright viewport tests, or state-machine property tests).
* **`verification.fitness`:** Architectural AST/regex linters and ratchets (`sys.fitness_dirs`).
* **`verification.parity`:** Cross-language conformance registries (`tests/parity/*.json`).
* **`governance`:** Engineering standards, API/SDK contracts, mental models (`docs/models/*.md`), and ADRs.
* **`work`:** Tracker records (`Epic`, `Sprint`, `Task`, `Defect`).

### 3.2 The 6 Cross-Domain Bridge Linkers
Because tests and governance documents frequently live in a different language or interact with source code indirectly (via DOM tags, HTTP/RPC routes, or behavioral descriptions), a Domain Jump fuses six bridge linkers via RRF:

| Bridge Linker | How It Crosses the Domain / Language Boundary | Primary Target Domains |
| :--- | :--- | :--- |
| **`bridge.explicit_contracts`** | Reads `tests/parity/*.json` (`python` $\leftrightarrow$ `javascript` symbol pairs), plan `test_contract:` tags, and Tracker `targets:` links. | `verification.parity`, `verification.unit`, `work` |
| **`bridge.cross_lang_refs`** | Matches string literals across languages: `/static/extensions/...` module paths, `customElements.define('sutram-...')` $\leftrightarrow$ `<sutram-*>` DOM tags, and `@route` $\leftrightarrow$ `ctx.call("<ext>.<verb>")` capability IDs. | `verification.behavioral`, `verification.unit`, `source` (cross-repo) |
| **`bridge.ast_symbols`** | Direct same-language `import` statements plus cross-language occurrences of exported function/class/store identifiers (e.g., `BridgeStore` or `classifyBootModuleFailure` inside embedded Node test scripts). | `verification.unit`, `verification.behavioral`, `verification.fitness` |
| **`bridge.affinity`** | Language-agnostic `bridge_ledger` co-change (`same_tx`, `adjacent_tx`) and `context_to_patch` conditioning edges. | All `verification.*` and `governance` |
| **`bridge.stem_and_tags`** | Normalized filename stem alignment (`manifest_sync.js` / `offline.js` $\leftrightarrow$ `test_offline_resilience.py`) and shared frontmatter `tags:` / `domain:`. | `verification.unit`, `governance`, `work` |
| **`bridge.vector_intent`** | Cosine similarity between source symbol docstrings/bodies and test method docstrings (`"""An import failing with a fetch TypeError is retried..."""`) or ADR sections. | `verification.behavioral`, `governance` |

### 3.3 Cross-Domain Jump Archetypes Beyond Code-to-Tests
Because `domain_jump` operates over declared landmarks and `schema.yaml` domains, the same projection engine powers cross-domain jumps across UI, archival, and hardware workspaces:
1. **UI Chassis Primitive $\rightarrow$ Consumer Views & Design Contracts:** Jumping from a `<sutram-*>` component in `vfs://sutram/` (`domain: chassis`) $\rightarrow$ `domain: consumer_views` in `vfs://insetu/` via `bridge.cross_lang_refs` (locating every template rendering that tag) and $\rightarrow$ `domain: governance` (`04_ui_design_standards.md`, `08_sutram_contracts.md`).
2. **Musicology Recording $\rightarrow$ Canonical Ur-Works, Essays & Transcriptions:** Jumping from a performance segment (`domain: recordings`, `show:pbn_088#seg_2`) $\rightarrow$ `domain: ur_works` (`ur:work/mua_nua_dem`) via `edge_ref`, and from there $\rightarrow$ `domain: essays` or `domain: transcriptions` via `mddb.citation_edges` + `bridge.vector_intent`.
3. **Hardware Preset $\rightarrow$ Device Manual & Live Setlist:** Jumping from `Bank 03, Switch D` (`domain: presets`, sending `CC#102` on Channel 5) $\rightarrow$ `domain: device_manuals` (`strymon_timeline_midi_map.md` via `bridge.cross_lang_refs`) and $\rightarrow$ `domain: setlists` (songs whose `performance_flow` jumps into `Bank 03`).

---

## 4. Multi-Stage Chaining & Foveated Lens Assignment

Proximity Filters and Domain Jumps compose into deterministic multi-stage pipelines (`locate_seeds` $\rightarrow$ `expand_within_domain` $\rightarrow$ `jump_across_domains`) where each stage's rank bands map to Representational Lenses (`full`, `diff`, `slice`, `outline`):

```yaml
# Canonical Multi-Stage RAG Pipeline (Declarative Routine / Schema Contract)
rag_pipeline:
  # Stage 1: Seed Discovery (runs only when the user did not attach explicit files)
  - stage: locate_seeds
    when: "{{ empty(inputs.attached_files) }}"
    domain: source
    combine: rrf
    filters:
      - basis: string.identifier_parts
        fuzziness: 0.2
        weight: 1.5
      - basis: string.bm25
        weight: 1.0
      - basis: vector.cosine
        min_similarity: 0.78
        weight: 1.0
    lenses:
      top_3: full

  # Stage 2: Within-Domain Structural & Multiplex Expansion
  - stage: expand_source
    from: "{{ nodes.locate_seeds | inputs.attached_files }}"
    domain: source
    combine: rrf
    filters:
      - basis: ast.call_graph
        depth: 2
        granularity: symbol
        pierce_barrels: true
      - basis: affinity.co_change
        depth: 1
        min_weight: 1.5
    lenses:
      band_0: full      # Focal edit targets
      band_1: slice     # 1-hop callers, callees & co-change peers
      band_2: outline   # 2-hop perimeter coordinates

  # Stage 3: Cross-Domain Jump to Verification Suites (Unit, Behavioral, Parity, Fitness)
  - stage: jump_to_verification
    from: [locate_seeds, expand_source]
    jump_to: [verification.unit, verification.behavioral, verification.parity, verification.fitness]
    combine: rrf
    bridges:
      - basis: bridge.explicit_contracts
        weight: 4.0
      - basis: bridge.cross_lang_refs
        weight: 3.0
      - basis: bridge.ast_symbols
        weight: 2.5
      - basis: bridge.affinity
        weight: 2.0
      - basis: bridge.stem_and_tags
        weight: 1.5
      - basis: bridge.vector_intent
        weight: 1.0
    lenses:
      top_3: full       # Top 3 directly coupled unit/behavioral tests
      top_8: slice      # Next 5 tests and fitness rules
      rest: outline     # Suite-wide coordinate map

  # Stage 4: Cross-Domain Jump to Governance (Mental Models & Contracts)
  - stage: jump_to_governance
    from: [locate_seeds, expand_source]
    jump_to: governance
    combine: rrf
    bridges:
      - basis: mddb.citation_edges
        weight: 3.0
      - basis: affinity.conditioning
        weight: 2.0
      - basis: bridge.vector_intent
        weight: 1.0
    lenses:
      top_2: full
```

---

## 5. The Two-Speed Operational Lifecycle

To deliver custom domain precision without configuration fatigue or per-turn LLM latency, `inSetu` separates **Cold-Start Ontology Synthesis** from **Steady-State Deterministic Execution**:

1. **Speed 1 — Cold-Start & Major Structural Shifts (LLM-Assisted Schema Synthesis):**
   - When a repository is first onboarded (or when a major architectural shift introduces a new language, a new test harness, or a new `.insetu-data/schema.yaml` domain), an onboarding/upkeep routine (`/upkeep:topology`) inspects the repository's directory tree, sample files, and `CODE_INDEX.md`.
   - The LLM proposes the repository's declarative `proximity_filters` and `domain_jumps` in `.insetu-data/settings/topology.md` or `.insetu-data/schema.yaml`.
   - Protected by S8/P13 repository-settings guardrails, the human architect reviews and accepts the declarative configuration once.
2. **Speed 2 — Iterative Everyday Turns (100% Deterministic, 0 Tokens, `<10ms`):**
   - During everyday `/code`, `/test`, `/wrap`, and `/ask` turns, **zero LLM calls** are required to compute context.
   - Incremental background indexers keep `topology_ledger`, `symbol_ledger`, `md_records`, `md_edges`, `affinity_edges`, and SQLite FTS5 synchronized as files change.
   - The deterministic RAG engine executes the declared Proximity Filters and Domain Jumps directly over SQLite, applies inverse-degree hub penalties and RRF ranking, and mounts the resulting files into the 6-bucket envelope at their scheduled lenses.
3. **Deterministic Drift Sensor in `topology.audit_upkeep`:**
   - `topology.audit_upkeep` monitors for **Retrieval Coverage Drift**: unmapped file extensions/directories, `schema.yaml` facets without corresponding proximity rules, or verification files whose maximum bridge score to `source` drops to zero (orphaned tests).
   - Only when `topology.audit_upkeep` flags structural drift does `/upkeep` prompt the LLM to propose an updated filter or bridge rule.

---

## 6. Interactive UI Deep Search as a 1-Shot Retrieval Projection

UI search bars across `inSetu` (`Files`, `Gather`, `Tracker`, `Notes`, `Prompts`, `Skills`, and the Link Insert projection) do not maintain a separate "deep search" backend. Instead, **UI Deep Search is a 1-shot interactive invocation of Stage 1 (`locate_seeds`) + optional Stage 2 (`expand` / `domain_jump`) of the unified retrieval engine** seeded with whatever the user types into the search box ($S_0 = \text{query}$):

1. **Tier 0 — Instant Client-Side Filter (0ms, In-Memory):**
   - Typing in any `<sutram-search>` input immediately filters loaded card metadata (filenames, titles, frontmatter tags) in memory via `fuzzyFilterObjects`.
2. **Tier 1 — 1-Shot Deep Retrieval Probe (`rag.query`):**
   - Activating **Deep Search** in any search box (via toggle or `Enter`) dispatches `{ query, scope_domain, pinned_repos, filters }` to the deterministic retrieval capability:
     - **Default Deep Search Recipe:** Runs RRF over `string.exact`, `string.identifier_parts` (`camelCase`/`snake_case` token splitting), SQLite FTS5 `string.bm25`, and `string.trigram` across `symbol_ledger` (functions, classes, docstrings), `md_records` (Level-1 files and Level-2 `##` heading sub-records), and tracked `vfs://` file bodies.
     - **Optional 1-Hop Neighborhood / Domain Jump Toggle:** From any deep-search result card, the user (or search filter pill) can toggle 1-hop expansion (`ast.call_graph`, `affinity.co_change`, `schema.*`, or `jump_to: verification.*`)—using the exact same retrieval algebra to preview a symbol's blast radius or stage the matched neighborhood directly into Quickpack or the active Agent session.
3. **Legacy Endpoint Consolidation:**
   - The standalone `POST /api/<ws>/fs/search` deep-search endpoint used by the Link Insert projection (`fs.js`) is subsumed by `rag.query`, ensuring link insertion, file explorer search, extension search bars, and agent seed discovery share a single indexing and ranking pipeline.

---

## 7. Anti-Overengineering & Phased Implementation Guardrails

To ensure this retrieval architecture remains lightweight, local-first, and zero-ceremony in practice:

1. **Zero-Config Must Cover 95% of Turns:**
   - Repositories never require a `.insetu-data/schema.yaml` or custom `proximity_filters` block to function.
   - Code repositories automatically run the default deterministic RRF recipe (`ast.call_graph` at `URI#symbol` granularity with barrel-piercing + `affinity.co_change` + `bridge.cross_lang_refs` + SQLite FTS5 `bm25`/`trigram`).
   - `md-db` repositories automatically synthesize `same_property` and `edge_ref` proximity filters from fields already marked `facet: true` or `targets:` in their `schema.yaml`.
2. **Zero-Dependency SQLite & AST First; Dense Vectors Last:**
   - All Tier 0 filters (`ast.*`, `affinity.*`, `mddb.*`, `schema.*`, `string.exact`, `string.identifier_parts`, and SQLite FTS5 `bm25`/`trigram`) plus power-iteration Personalized PageRank (`traversal: ppr`, ~25 lines of pure Python) run 100% deterministically on Python's standard library + Tree-Sitter with zero model-loading or RAM overhead.
   - Dense vector embeddings (`vector.cosine`) are treated as an optional late-stage plug-in (keyed by Cartographer `body_hash` in `vfs_index.db`) enabled only when conceptual paraphrase matching over pure prose is needed.
3. **Single-Module Footprint Ceiling (`rag_proximity.py`):**
   - Because `topology_ledger`, `symbol_ledger`, `md_records`, `md_edges`, `affinity_edges`, and `slice_interface(..., requested_symbols=...)` already exist in SQLite, the entire Proximity Filter, Domain Jump, RRF, and PPR execution engine is confined to a single `< 400`-line module (`insetu/core/gather/rag_proximity.py`).
