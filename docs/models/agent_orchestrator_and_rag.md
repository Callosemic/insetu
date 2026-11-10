---
title: "Mental Model: Agent Orchestrator, Routine DAGs & 6-Bucket Context Envelope"
description: "Black-box DAG execution contracts, the 6 volatility-ordered context buckets, fork-join holding confinement, and self-contained healing loops."
domain: "Core Architecture"
tags: [mental-model, agent, orchestrator, routines, prompts, rag, dag, invariants]
---

# Mental Model: Agent Orchestrator, Routine DAGs & 6-Bucket Context Envelope

Code shows what the Agent Orchestrator does today; this document states the architectural invariants that govern how Routines, Prompts, Context Buckets, and Healing Loops compose across every future refactor.

---

## 1. Core Ontology: Routines vs. Prompts

1. **Routine (The Process / Black-Box Computation):**
   - A Routine (`ctx://routines/*.md`) is an executable Directed Acyclic Graph (DAG) linking discrete units of compute (`llm` inference, deterministic `exec` capabilities, `loop` convergence blocks, and nested `routine` calls) to accomplish a task.
   - **Inspectable yet Composable:** While a Routine's internal steps are transparent and editable as Markdown-as-Code, every Routine functions externally as a **black box** with a strict input/output boundary.
   - **Root Entry & Terminal Sink:** A Routine receives an initial state envelope at its root node(s) (`parents: []`) and emits a deterministic outgoing payload and settled envelope from its terminal sink node(s), allowing any Routine to be invoked identically by a human slash command, a scheduled job, an MCP client, or a parent Routine.

2. **Prompt (The Unit Instruction):**
   - A Prompt (`ctx://prompts/*.md` or a `## <node_id>` section) is a pure instruction template telling an LLM what to do within a **single unit** of a Routine's process.
   - Prompts do not own control flow or orchestration state; they project a subset of the Routine's active buckets and the parent node's incoming payload into a single inference request.

---

## 2. The 6 Canonical Context Buckets (Ordered by Volatility)

Rather than passing an unstructured dictionary across steps, a Routine operates over a typed **Execution Envelope** partitioned into **6 canonical buckets**.

The 6 buckets are strictly ordered from **least volatile** (100% static across turns and nodes) to **most volatile** (changing on every node evaluation). Prompt compilers must serialize active buckets in this exact sequence to maximize KV-cache prefix hits across multi-step DAGs and multi-turn sessions:

| Order | Bucket | Volatility | Contents & Role |
| :--- | :--- | :--- | :--- |
| **1** | **`governance`** | Static (Tier 0) | **Constitutional Guardrails:** Engineering standards (`01_engineering_standards.md`), API/SDK contracts, subsystem mental models (`docs/models/*.md`), and active ADRs. Read-only across the entire run. |
| **2** | **`hierarchy`** | Semi-Static | **Structural & Topological Map:** Repository directory trees, `CODE_INDEX.md` AST symbol maps, sub-bucket boundaries, and import/call graphs. Tells nodes *where* things live without paying full-file token costs. |
| **3** | **`meta`** | Low Volatility | **Run & Episodic State:** Active architectural plan/blueprint (`docs/plans/*.md`), session summary, open/active tracker tickets, and working-set TTL metadata. Tracks *why* the run is executing and *where* it is in a multi-step plan. |
| **4** | **`data`** | Medium Volatility | **Concrete Workbench Payload:** The actual source files (full text or AST-sliced interfaces), `_diffs.txt` hunks, and structured artifacts currently being inspected or modified. |
| **5** | **`telemetry`** | High Volatility | **Empirical Sensor Readings:** Structured test diagnostics (`TestDiagnosticSchema` / JUnit XML failures), Yomama Bridge anchor/syntax verification errors, linter outputs, exported `terminal` extension `stdout`/`stderr` buffers, and live app/DOM snapshots (e.g., Playwright). |
| **6** | **`prompt`** | Per-Node (Tail) | **Focal Attention & Pipe Payload:** The current node's instruction text, formal output schema directives, and the `incoming` payload piped directly from its parent node(s). |

---

## 3. Edge Topologies & Fork-Join Confinement (`holding`)

Nodes in a Routine DAG pass payloads along directed edges while reading from and committing mutations to the 6 canonical buckets under strict concurrency laws:

1. **`1 -> 1` (Sequential Pipe & Deterministic Bucket Mutation):**
   - When Node A transitions to a single child Node B, Node A's `outgoing` payload becomes Node B's `prompt.incoming` payload.
   - Because execution is single-threaded at the boundary, Node A may deterministically mutate shared buckets (for example, a deterministic scout reading `hierarchy` and writing discovered files into `data`).

2. **`1 -> N` (Parallel Broadcast Fan-Out):**
   - Node A branches to $N$ concurrent children ($B_1 \dots B_N$) that evaluate different facets of the same payload in parallel.
   - **The Fork Snapshot Invariant:** While $B_1 \dots B_N$ execute concurrently inside a wavefront, the 6 main buckets (`governance`, `hierarchy`, `meta`, `data`, `telemetry`, `prompt`) are **frozen as a read-only snapshot**. Parallel branches may never mutate shared buckets directly.
   - Each branch $B_i$ receives Node A's full `outgoing` payload as its `incoming` payload and writes its result to an isolated slot in a temporary **`holding[B_i]`** buffer.

3. **`1 (split) -> N` (Scatter / `map_over` Fan-Out):**
   - Node A outputs an iterable collection (or references a partitioned collection in `data`).
   - The orchestrator scatters the collection across $N$ parallel worker shards ($B[0] \dots B[N-1]$).
   - Each shard receives read-only access to the frozen main buckets plus **only its assigned shard item** (`incoming.item`), writing its output to **`holding[i]`**.

4. **`N -> 1` (The Reduce / Convergence Sink):**
   - A downstream Reduce node $C$ declares multiple parents (`parents: [B_1, ..., B_N]`) or follows a `map_over` fan-out.
   - **The Convergence Barrier:** Node $C$ executes only after all upstream branches have settled into the temporary `holding` buffer.
   - Node $C$ receives the deterministically ordered `holding` collection as its `incoming` payload and regains **exclusive write authority** to fold and commit mutations back into the main `data`, `meta`, or `telemetry` buckets.

---

## 4. Bucket Masking / Coeffect Projection (`reads` & `writes`)

Not every node in a Routine should pay the token cost or suffer the attention dilution of seeing all 6 buckets:

* **Declarative Projection (`reads`):** Each node projects only the buckets required for its specific cognitive task:
  - **Fast Context/Test Scouts:** Project `[hierarchy, prompt]` (and diff headers in `data` when scouting tests for a diff) to select candidate files without loading `governance` or full `data` bodies.
  - **Architectural Synthesis (`/code`, `/implement`):** Project `[governance, meta, data, prompt]`.
  - **Self-Contained Patch Healers:** Project strictly `[data.target_file, telemetry.bridge_error, prompt.failed_patch]`—giving the healer the complete `n-1` target file buffer, the single failed patch block, and the exact diagnostic error while omitting `governance`, `hierarchy`, `meta`, and all other untouched files in the batch.
* **Declarative Mutation (`writes`):** Nodes explicitly target which bucket their output updates (e.g., `writes: data` for a context assembler, `writes: telemetry` for a test runner or bridge verifier).

---

## 5. Self-Contained Healing Loops (Epistemic Reconciliation)

Outputs from `llm` nodes are treated as **hypotheses** until ratified by a deterministic `exec` sensor (`topology`, `bridge.sync`, or `bridge.test`). Whenever a hypothesis meets a physical system boundary, reconciliation occurs through a **self-contained healing loop**:

1. **Topological Reconciliation:** Candidate file URIs proposed by an LLM scout are clamped against `topology_ledger` (`clamp_uris_to_topology`) before entering `data`.
2. **Syntactic, Anchor & Out-of-Band Collision Reconciliation (Yomama Bridge Loop):**
  - Proposed patch blocks are evaluated in canonical order (`0 .. n`) in memory (`bridge.sync`). If patch `n` fails to anchor or introduces an AST syntax error, an isolated healing loop runs with `[data.pre_buffer_n_minus_1, telemetry.syntax_or_anchor_error, prompt.failed_block_n]` and substitutes the repaired block in-place at index `n`.
  - **Out-of-Band Edit Guard (`snapshot_sha256`):** When `data` mounts a file, the envelope records its `LIVE` disk hash (`snapshot_sha256`). If the developer manually edits and saves the file while an `llm` node is mid-inference, `bridge.sync` detects the hash divergence prior to disk flush, attempts a non-overlapping 3-way rebase against the new `LIVE` state, and—if the modified lines collide—holds the patch in `VIRTUAL` (`diff:live..virtual`) for human review rather than clobbering the out-of-band edit.
3. **Behavioral Reconciliation (Test Diagnostic Loop):** Once patches pass syntax verification, `bridge.test` executes the repository's test suite and writes structured failures (`TestDiagnosticSchema`) into `telemetry`. If `telemetry` reports failures, a bounded convergence loop (`type: loop`) projects `[data.modified_files, telemetry.test_failures]` to repair the regression or atomically rolls back the transaction via `bridge.revert`.

---

## 6. Envelope Seeding, Deterministic Capabilities & JIT Compute Materialization

1. **Everything Deterministic Is a Routine Step (`type: exec`) & No-Intervention Paths:**
    - Any deterministic sequence of operations in `inSetu` exposed as a capability (scouting relevant tests for a diff, auditing symbol drift, assembling blast-radius slices, running tests, committing patches, or executing `git.commit` / `git.push` at a milestone sink) must be composable as standard `type: exec` nodes within a Routine DAG.
    - `exec` nodes execute in-process prior to or between `llm` nodes, reading from and mutating the 6 canonical buckets deterministically.
    - **Declarative Intervention Policy & `/yolo` Mode (`intervention: yolo | none | on_failure | review`):** Routines may declare no-intervention default execution paths—or be invoked under `/yolo` mode—where all manual staging and confirmation gates are bypassed. Provided deterministic gates (`bridge.sync` anchor/syntax verification, `snapshot_sha256` collision check, and `bridge.test` exit code `0`) pass, or heal within bounded convergence loops, the DAG advances straight through disk flush and commit/push sink nodes without human intervention.

2. **Frontmatter `includes:` Are Initial Envelope Seeds (No Prebuilt Workflow Contexts):**
    - A Routine's frontmatter `includes:` list is strictly a declarative seed list that populates the initial buckets (`governance`, `hierarchy`, `meta`, `data`) when the Routine is invoked.
    - Routines do **not** pre-compile static `ctx://workflows/workflow_*_context.txt` files during background Gather sweeps. Context is materialized Just-In-Time (JIT) when execution reaches an `llm` compute node, after all upstream `exec` nodes (such as `topology.scout_tests` or `context.assemble`) have enriched and pruned the buckets.

3. **First-Class `web_chat` Transport Parity at the Compute Boundary:**
    - When execution reaches an `llm` node, the orchestrator partitions the node's projected state into two distinct JIT artifacts:
    1. **The JIT Context Payload (Buckets 1–5):** The volatility-ordered serialization of `governance`, `hierarchy`, `meta`, `data`, and `telemetry` (materialized as an ephemeral, chunk-aware `ctx://contexts/turn_*_context.txt` artifact).
    2. **The Prompt Payload (Bucket 6):** The resolved node instructions, `incoming` pipe data, and formal output schema directives—never polluted with raw `<workspace_context>` file dumps.
    - **Automated Drivers (`anthropic`, `gemini`, `openrouter`, `openai_compatible`, `claude_cli`):** Transmit `(JIT Context Payload, Prompt Payload)` directly to the model endpoint and advance the DAG upon completion.
    - **External Chatbot Driver (`web_chat` / `transport: manual`):** Pauses execution at the `llm` node boundary and surfaces the exact same two JIT artifacts in the Handoff UI (**Context** action menu + **Copy Prompt + Directives** button). Pasting the external model's response fulfills the node contract and resumes downstream DAG execution identically to an automated driver.

---

## 7. Representational Lenses & Composable RAG Execution Units

### 7.1 Resource Identity vs. Representational Lens
Every item in the `data` (or `governance` / `telemetry`) bucket is anchored by its canonical VFS resource URI (`vfs://<repo>/<path>`) paired with a **Representational Lens (`lens`)**. A diff, an AST skeleton, a rendered viewport image, or an audio transcript is not a separate entity from the file—it is a deterministic projection of that resource:

$$\text{Project}(\text{URI}, \text{lens}, \text{params}) \rightarrow \text{Context Representation}$$

* **Standard Code & Document Lenses:**
    1. **`full` (Pure Semantic Data):** The complete current content of the resource on disk. Used for primary edit targets and self-contained `n-1` patch healing.
    2. **`diff` (Temporal Delta + Enclosing AST Scope across the State Triangle):** The single-stream interleaved diff (`format_interleaved_file_diff`) showing `-` / `+` changes inside full enclosing AST function scopes alongside the 1-line signature skeleton of untouched sibling functions. Because a file in `inSetu` spans three temporal states—**`HEAD`** ($S_{\text{git}}$, the last Git commit or pre-turn keyframe snapshot), **`LIVE`** ($S_{\text{live}}$, the current working file on disk/VFS), and **`VIRTUAL`** ($S_{\text{virtual}}$, the staged in-memory buffer produced by a dry-run patch evaluation or unsaved editor buffer)—the `diff` lens parameterizes any pair `(base -> target)` across the triangle:
      - **`diff:head..live` (Working Tree Diff — Default):** Projects $S_{\text{git}} \rightarrow S_{\text{live}}$, showing all uncommitted modifications currently on disk relative to `HEAD` (used by `/wrap`, `/audit`, and `git_diffs`).
      - **`diff:live..virtual` (Staged Turn Delta):** Projects $S_{\text{live}} \rightarrow S_{\text{virtual}}$, isolating the exact delta a staged in-memory patch batch (`bridge.sync` with `dry_run=True`) will apply to the current working file before touching disk.
      - **`diff:head..virtual` (Cumulative Net Diff):** Projects $S_{\text{git}} \rightarrow S_{\text{virtual}}$, showing the net end-to-end change relative to `HEAD` if the virtual in-memory state is committed (eliminating multi-turn churn noise during pre-commit review).
    3. **`slice` (Structural / Interface Guide):** The AST interface projection (`slice_interface`) retaining imports, exports, type/function signatures, docstrings, and requested symbols while eliding implementation bodies.
    4. **`outline` (Coordinate Map):** The ultra-compact 1-line-per-symbol summary (`CODE_INDEX.md` projection) used to orient scouts and show suite-wide test coverage at minimal token cost.
* **Multimodal & Domain Lenses (Extensible via Lens Providers):**
    - **`render`:** Rasterized visual projection of a synthetic model, diagram, or live UI component (e.g., headless browser/Playwright viewport capture).
    - **`transcript`:** Textual projection of an audio or voice recording resource.

Because the canonical URI stays invariant across lenses, a Routine step or user HUD action can **promote or demote** a resource in-place (e.g., `outline` $\rightarrow$ `slice` $\rightarrow$ `diff` $\rightarrow$ `full`) without duplicating entries or losing provenance.

### 7.2 Declarative Input Dependencies (`requires:`) & Default Fallbacks
Routines and RAG execution nodes declare what resource lenses they require and how to populate them when the user does not attach explicit overrides:
* **User-Attachment Precedence:** If the user invokes a routine with explicit attachments matching the dependency (for example, attaching a specific diff bucket or dirty files when invoking `/wrap`), those resources seed `data` under the requested lens.
* **Deterministic Repo/Scope Fallback:** If no matching user attachment is provided, the dependency resolves its `default` selector against `topology_ledger` (for example, selecting all `git_status != ''` files in the target repository—or within the colon-scoped `:sub_bucket`—and mounting them into `data` with `lens: "diff"`).

### 7.3 Proximity Filters, Cross-Domain Jumps & Foveated Lens Decay
*(See `vfs://insetu/docs/models/proximity_filters_and_domain_jumps.md` for the complete formal specification, multiplex schema syntax, and multi-stage pipeline grammar.)*

Rather than hardcoding a single monolithic "blast radius" heuristic, `inSetu` models RAG retrieval as a composable algebra of **Proximity Filters** (within-domain expansion) and **Domain Jumps** (cross-domain projection), grounded in **Multiplex Graph Theory**, **Heterogeneous Information Network (HIN) Meta-Paths**, **Software Traceability**, and **Reciprocal Rank Fusion (RRF)**:

1. **Proximity Filters (Parameterized Traversal Over Multiplex & Continuous Spaces):**
    A Proximity Filter $F(S_0, \text{basis}, k, \text{lens\_schedule})$ takes a seed set $S_0$ (attached URIs, dirty diff symbols, or a query string), measures distance along a specific algorithmic **`basis`** up to depth/band $k$, and emits ranked `(uri, symbol_or_span, distance_band, score, lens)` tuples across four canonical filter families:
    - **Syntactic AST Graph (`basis: ast.call_graph` | `ast.module_imports`):** Discrete hop distance ($d = 1, 2, 3\dots$) across Tree-Sitter / `ast` function call graphs and module import trees.
    - **Evolutionary & Conditioning Graph (`basis: affinity.co_change` | `affinity.conditioning`):** Discrete hop distance weighted by patch-ratified Hebbian co-change (`same_tx`, `adjacent_tx`, `same_session`) and `Read -> Patched` conditioning edges.
    - **Lexical & Fuzzy String Spectrum (`basis: string.<fuzziness>`):** Continuous lexical distance ($d \in [0.0, 1.0]$) with configurable `fuzziness`: `exact` / `regex` ($d=0.0$), `identifier_parts` (splitting `camelCase`/`snake_case` tokens across language boundaries), `bm25` (SQLite FTS5), and `trigram` / `levenshtein` (surviving typos, diacritics, and near-duplicate code blocks).
    - **Semantic Vector Space (`basis: vector.cosine`):** Continuous embedding similarity anchored to structural units (`symbol_ledger` functions, `md_records` heading spans, and `governance` subsections) rather than arbitrary character chunks.
    - **Custom Multiplex Schema Layers (`basis: schema.<name>`):** Repository-declared relational layers in `.insetu-data/schema.yaml` or `settings/topology.md` built from three core relational primitives—`same_property` (equivalence join, e.g., presets sharing a logical `midi_channel`), `numeric_window` (metric adjacency, e.g., a physical `bank_number` $\pm 1$ or `seq_order` $\pm 1$), and `edge_ref` (directed pointer hop, e.g., `Bank Jump` targets or `ur:` links)—allowing the same set of nodes to be traversed along distinct physical vs. logical topologies.

2. **Cross-Domain Jumps (HIN Meta-Paths & Polyglot Traceability):**
    A **Domain Jump** ($\text{Jump}(S_{\text{origin}}, \text{target\_domain}, \text{bridges})$) projects active nodes from an origin domain (e.g., `source`) across an ontological or language boundary into a target domain (`verification.unit`, `verification.behavioral`, `verification.fitness`, `verification.parity`, `governance`, or `work`). To bridge domains even when they share no programming language or direct AST imports (such as Python behavioral tests executing JS modules via Node, or UX tests querying DOM tags), Domain Jumps combine six **Bridge Linkers** via scale-free **Reciprocal Rank Fusion (RRF)**:
    - **`bridge.explicit_contracts`:** Parity registries (`tests/parity/*.json`), plan `test_contract:` annotations, and Tracker ticket target links.
    - **`bridge.cross_lang_refs`:** String-literal specifiers crossing runtime boundaries (`/static/extensions/...` URLs, `<sutram-*>` custom element tags, and `@route` / `ctx.call("<ext>.<verb>")` capability IDs).
    - **`bridge.ast_symbols`:** Same-language imports and cross-language exported identifier occurrences.
    - **`bridge.affinity`:** Language-agnostic Hebbian co-change and co-failure edges from `bridge_ledger`.
    - **`bridge.stem_and_tags`:** Normalized filename/identifier stem alignment and shared frontmatter facets.
    - **`bridge.vector_intent`:** Semantic similarity between source symbol docstrings and behavioral/UX test docstrings.

3. **Foveated Distance-to-Lens Decay (`full` $\rightarrow$ `slice` $\rightarrow$ `outline`):**
    To prevent multi-hop graph expansion ($d \ge 2$) from causing an $O(b^k)$ token explosion, every Proximity Filter and Domain Jump maps hop distance (or RRF rank band) directly to a Representational Lens:
    - **Band 0 (Focal Seeds / Top-K Primary Targets):** Mounted at **`full`** (or **`diff`**) lens.
    - **Band 1 (1-Hop Callers/Callees, Coupled Tests & Same-Channel Peers):** Mounted at **`slice`** lens (signatures, types, docstrings, and YAML metadata).
    - **Band 2+ (Extended Perimeter & Suite Map):** Mounted at **`outline`** lens (1-line coordinates), giving `llm` nodes complete topological awareness with 1-hop `QUERY_CONTEXT` authority to promote any perimeter node to `slice` or `full` on demand.

4. **The Two-Speed Lifecycle: LLM-Synthesized Setup, Deterministic Per-Turn Execution:**
    - **Cold-Start & Major Structural Shifts (LLM-Assisted Schema Authoring):** When a repository is first onboarded—or when `topology.audit_upkeep` detects structural drift (new unmapped directories, new `schema.yaml` kinds/fields, or orphaned test suites with zero bridge edges)—an upkeep/onboarding routine uses the LLM once to propose declarative `proximity_filters` and `domain_jumps` in `.insetu-data/settings/topology.md` or `.insetu-data/schema.yaml` for human review.
    - **Iterative Everyday Turns (100% Deterministic, 0 Tokens):** Once declared (or using the zero-config default RRF recipe for standard code and `md-db` repos), all per-turn execution in `rag.seed_diffs`, `rag.blast_radius`, and `rag.scout_tests` runs deterministically in milliseconds over SQLite (`topology_ledger`, `symbol_ledger`, `md_records`, `affinity_edges`, and FTS5) as standard `type: exec` DAG units.

### 7.4 The Coupling Graph: Hebbian Affinity & Asymmetric Conditioning
To retrieve functionally coupled files and governing documentation that do not share direct AST imports, `rag.blast_radius` and `rag.scout_tests` query a hybrid coupling graph combining **Patch-Ratified Hebbian Affinity** with **Static Citation Anchors**. Raw UI pinning or read-only `/ask` attachments are ignored to prevent conversational noise from polluting the graph.

1. **Symmetric Write $\leftrightarrow$ Write Coupling (3-Tier Patch Co-Occurrence):**
  Derived strictly from committed `bridge_ledger` transactions (enabling zero-config bootstrap from existing ledger/Git history) with multi-day exponential decay:
  - **Intra-Transaction (`same_tx`, Weight `3.0`, 14-Day Half-Life):** Files modified together inside the exact same `bridge.sync` `transaction_id`.
  - **Adjacent-Turn (`adjacent_tx`, Weight `2.0`, 10-to-14-Day Half-Life):** File $A$ patched in Turn $N$ and File $B$ patched in Turn $N+1$, capturing immediate cause-and-effect repair pairs across iterative turns and healing loops.
  - **Intra-Session (`same_session`, Weight `1.0`, 7-Day Half-Life):** Files modified within the same session or rolling transaction window.

2. **Asymmetric Read $\rightarrow$ Write Conditioning (`context_to_patch`):**
  - Because read-only governance files (`docs/models/*.md`, ADRs, contracts) and stable reference modules are rarely patched alongside the code they govern, the graph records directed conditioning edges (`Read(A) -> Patched(B)`).
  - **Patch Ratification Gate:** An edge from unpatched resource $A$ (present in `governance` or `data` during the turn) to target $B$ is reinforced **only** when `bridge.sync` ratifies and commits a patch to $B$. Future mutations or scouts targeting $B$ automatically pull $A$ into the envelope.

3. **Zero-Decay Static Citation & Landmark Edges (`citation_edges`):**
    - During topology scans, the indexer deterministically links `docs/models/*.md`, ADRs, and contracts to the `vfs://` files, directories, and module stems they explicitly cite in prose or frontmatter.
    - These structural edges carry **zero time decay**, guaranteeing that subsystem mental models remain permanently wired to their target modules even before the first session turn is executed.

### 7.5 Cross-Repository Federated RAG (`vfs://<repo>/` Boundary Crossing)
In a multi-repository workspace (such as `insetu`, `sutram`, and `akasa`), architectural changes routinely span repository boundaries—for example, updating a `<sutram-*>` web component in `vfs://sutram/`, a shared schema in `vfs://akasa/`, and a consumer view or capability route in `vfs://insetu/`. Because every URI in the 6-bucket envelope is canonically qualified as `vfs://<repo>/<path>` and indexed in a shared workspace SQLite ledger, RAG units operate natively across repository boundaries:

1. **Workspace-Global Hebbian & Citation Graph:**
    - `bridge_ledger`, `affinity_edges`, and `citation_edges` key all nodes by their full `vfs://<repo>/<path>` URI rather than repo-relative paths.
    - Modifying files across `insetu`, `sutram`, and `akasa` within the same transaction (`same_tx`), adjacent turns (`adjacent_tx`), or session (`same_session`) automatically forms cross-repo Hebbian affinity edges. When a file in `insetu` is later targeted, `rag.blast_radius` automatically mounts its coupled `sutram` or `akasa` counterparts at `slice` lens.

2. **Deterministic Cross-Repo Bridge Linkers:**
    - Beyond direct language imports (`from akasa...`, `@sutram/...`), the symbol indexer links cross-repo boundaries across three workspace bridge surfaces:
    - **UI Custom Elements:** Custom element registrations (`customElements.define('sutram-...', ...)`) in `sutram` $\leftrightarrow$ tag instantiations (`<sutram-...>`) in `insetu`.
    - **Capability & RPC Identifiers:** `@route("<ext>.<verb>")` definitions $\leftrightarrow$ `call("<ext>.<verb>")` client/SDK invocations across repos.
    - **Cross-Repo Doc Citations:** Mental models or contracts in one repo citing `vfs://<other_repo>/...` URIs.

3. **Federated `hierarchy` & Multi-Repo `rag.seed_diffs`:**
    - `topology.overview` and `hierarchy` include `CODE_INDEX.md` symbol maps for the primary repository alongside public export/component maps for federated workspace repositories (`insetu`, `sutram`, `akasa`), enabling `scout_targets` and in-node `QUERY_CONTEXT` probes to select and promote files from any mounted repo in the workspace.
    - When `/wrap` or `rag.seed_diffs` runs without an explicit repo filter, or with `scope: workspace`, it can aggregate dirty diffs across all modified workspace repositories into a unified `data` envelope.

---

## 8. The Session Thread Ledger: Conversational Loops vs. One-Shot Routines

Every Chat Session (`chat_sessions`) is a persistent state ledger maintaining two coupled channels across turns:
1. **The Thread Transcript (`meta.history`):** The chronological log of turns, where each turn records the user prompt (or routine invocation summary), the assistant's clean prose answer, and the explicit list of `files_patched` (`transaction_id`).
2. **The Session Working Set (`data.working_set` & `meta.active_plan`):** The rolling set of files attached or modified across recent turns (`a.py, b.py, c.py, d.py`), governed by the 5-turn TTL lens decay (`full` for 5 turns $\rightarrow$ `slice` at turn 6 $\rightarrow$ evicted at turn 9, with user-pinned files exempt).

All Routines execute within this session ledger and **write** their final turn receipt and any newly patched files back into the session. However, Routines divide into two execution archetypes based on how they **read** from the session and how they leave the composer state:

### 8.1 Sticky Conversational Loop Routines (`/auto`, `/yolo`, `/code`, `/ask`, `/plan`)
* **Purpose:** Iterative, multi-turn human-AI collaboration where each turn builds on the conversational thread (`/yolo` operating as the zero-gate autonomous variant that auto-commits patches and runs bounded test/repair loops without confirmation pauses).
* **Reads Thread History (`use_history: true`):** Ingests the compacted Thread Transcript (4 hot verbatim messages + warm turn receipts including `files_patched` + cold `<session_summary>`) alongside the active Working Set (`data.working_set`).
* **Sticky Composer Behavior (`sticky: true`):** Remains active as the selected mode across consecutive turns so the developer can iterate naturally over the thread without re-selecting `/yolo`, `/code`, or `/plan`.

### 8.2 One-Shot Task Routines (`/test`, `/wrap`, `/closeout`, `/audit`, `/upkeep`, `/ratchet`)
* **Purpose:** Focused, self-contained engineering pipelines invoked at milestones during a session.
* **Ignores Conversational Chatter (`use_history: false`):** Does **not** inject the conversational prompt/answer history into its LLM nodes, preventing prior chat prose from polluting or biasing the task.
* **Pulls Context Selectively from Session & Workspace (`requires:`):** Pulls only the concrete artifacts it needs from the session (for example, `/test` pulls the session's modified/working-set files `a.py, b.py, c.py, d.py` and runs `rag.scout_tests` to attach their relevant unit tests; `/wrap` pulls dirty repository diffs and scouts their tests).
* **Writes Clean Turn Receipt Back to Thread History:** Upon completion, records a structured turn entry in the session's Thread Transcript (e.g., *"Test performed on `a.py, b.py, c.py, d.py`"* + diagnostic/resolution summary + `files_patched`) and updates the Session Working Set so subsequent `/code` turns have full visibility into what the one-shot routine did.
* **One-Shot Composer Reset (`sticky: false`):** Automatically returns the composer trigger to the prior conversational mode once the one-shot execution completes.

---

## 9. Bounded Continuous Convergence Loops (`type: loop`)

Routines support bounded autonomous iteration (`max_iterations: M`, `until: "<condition>"`) across two operational scales without suffering context-window inflation:

### 9.1 The Two Loop Scales
1. **Inner Tactical Convergence Loops (e.g., `max_iterations: 5` — Test & Lint Clearing):**
  - **Objective:** Drive a concrete empirical sensor in `telemetry` to zero errors (`until: "{{ telemetry.test_diagnostics.exit_code }} == 0"`).
  - **Cycle:** `exec (bridge.test)` $\rightarrow$ `llm (triage_and_fix)` $\rightarrow$ `exec (bridge.sync)` $\rightarrow$ repeat until `exit_code == 0` or `iteration == 5`.
2. **Outer Strategic Execution Loops (e.g., `max_iterations: 20` — Plan $\rightarrow$ Execute $\rightarrow$ Test):**
  - **Objective:** Autonomously step through a multi-task architectural plan (`meta.active_plan`) until all tasks are complete (`until: "{{ meta.active_plan.unchecked_count }} == 0"`).
  - **Cycle:** On iteration $k$, a deterministic cursor selects the next unchecked task `- [ ] [S1.T_k]` from `meta.active_plan`, rotates the `data` bucket to mount that task's `targets` (`full` lens), blast-radius interfaces (`slice` lens), and `test_contract` (`full` lens), executes the edit and inner test verification, marks `[x] [S1.T_k] (tx_...)` in `meta.active_plan`, and advances to iteration $k+1$.

### 9.2 Markovian $O(1)$ Context Invariant Across Iterations
Bounded loops must **never** accumulate raw LLM outputs or full test logs from prior iterations into a growing transcript:
* **In-Place Bucket Refresh:** At the start of iteration $k$, `data` reflects the current post-patch VFS files on disk and `telemetry` is **overwritten** with the latest sensor reading (e.g., only the tests still failing on iteration $k$).
* **Compact Episodic Loop Ledger (`meta.loop_ledger`):** Prior iterations are represented solely by a 1-line-per-iteration micro-receipt in `meta.loop_ledger` (e.g., `[Iter 2/5]: Patched c.py (tx_9b2c) -> failed_count dropped 3 -> 1; remaining: test_edge_case`), preventing the model from repeating a failed hypothesis while keeping token usage flat ($O(1)$) from Iteration 1 through Iteration 20.

### 9.3 Loop Safety & Termination Guardrails
Every bounded loop enforces three deterministic circuit breakers in addition to `max_iterations`:
1. **Stagnation & Oscillation Circuit Breaker:** The orchestrator fingerprints `(data_hash, telemetry_failure_signature)` after each iteration. If two consecutive iterations yield an identical failure signature (stagnation) or revisit a prior state hash (A $\leftrightarrow$ B oscillation), the loop halts early (`status: "halted_stagnant"`) rather than burning the remaining turn budget.
2. **Pre-Loop Rollback Anchor (`pre_loop_tx_anchor`):** Before Iteration 1 mutates any file, the orchestrator records a keyframe transaction boundary in `bridge_ledger`. Each iteration's `bridge.sync` commit is appended to the loop's transaction chain, enabling either single-iteration step-back (if an iteration increases failure count) or atomic full-loop rollback (`on_exhaustion: "rollback"`) if the loop fails to converge under `strict_test_enforcement`.
3. **Checkpoint & Cancellation Yielding:** Between every iteration (and at every `web_chat` handoff node), the loop checks `_is_cancelled()` and persists `meta.loop_ledger` + `wavefront_index` to `chat_sessions.checkpoint_json` so long-running 20-turn loops can be paused, inspected, or resumed cleanly.

---

## 10. In-Node Epistemic Probes & Scoped Capability Invocation (`QUERY_CONTEXT` & `CALL_CAPABILITY`)

While predictable pipeline stages (`bridge.sync`, test gates, upfront RAG scouting) are modeled as explicit `type: exec` nodes in the Routine DAG, an `llm` node frequently needs to pull a missing file/symbol into `data` mid-inference or invoke a whitelisted domain capability (such as querying or transitioning a Tracker ticket, extracting a symbol slice, or inspecting a diff) without requiring a hardcoded multi-node sub-graph.

`inSetu` exposes the `InSetuExtension` Capability Registry (`get_registered_capabilities()`) to `llm` nodes through **Scoped Capability Binding**:

1. **Declarative Capability Whitelisting (`capabilities:`):**
  - **Default Read-Only Probes:** Every `llm` node (unless `max_probes: 0`) automatically possesses read-only epistemic probe authority to fetch/promote `vfs://` resource lenses (`full`, `slice`, `diff`, `outline`), slice AST symbols (`cartographer.extract`), and search workspace text (`fs.search`).
  - **Scoped Node Grants:** A node may declare `capabilities: ["<ext>.<verb>", ...]` (or namespace wildcards such as `tracker.*`) to grant the LLM permission to invoke specific registered capabilities during that step.
  - **Hard Security Ceiling (Tier 0 Guardrail):** Capabilities in `ROUTINE_BANNED_CAPABILITIES` (`dev.exec`, `bridge.test.approve`, `preview.open_lan`, `system.extensions.workspace.approve`, etc.) and routes with `mcp_expose=False` can **never** be granted to or invoked by an `llm` node. In read-only modes (`/ask`), grants are further clamped to `READ_ONLY_MODE_ALLOWED_CAPABILITIES`. All source code file modifications must still flow through Yomama `FILE:` patch blocks into `bridge.sync`.

2. **JIT Schema Projection into the `prompt` Bucket:**
  - For each capability granted to an `llm` node, the prompt compiler inspects `get_registered_capabilities()` and projects the route's docstring and `TypedDict` request schema (`typeddict_to_openapi`) into the node's `prompt` bucket.
  - Because only the node's explicitly granted capabilities are projected (rather than all OS routes), token overhead remains minimal and parameter contracts stay 100% synchronized with backend route definitions.

3. **Transport-Agnostic Invocation (`CALL_CAPABILITY` & `QUERY_CONTEXT`):**
  - To maintain 100% parity across cloud APIs, local models, CLI binaries, and manual copy-paste `web_chat`, models request capability execution using structured Yomama blocks (`<<<<<<< CALL_CAPABILITY` with `CAPABILITY: <ext>.<verb>` and `ARGS: {...}`, terminated by the standard execute marker).
  - For file and lens requests, `<<<<<<< QUERY_CONTEXT` serves as a concise alias that promotes or mounts the requested `vfs://` resource and lens directly into `data`.

4. **Deterministic Bucket Routing & Bounded Re-Evaluation (`max_probes: K`):**
  - When an `llm` node emits a `CALL_CAPABILITY` or `QUERY_CONTEXT` block, the orchestrator validates the capability against the node's whitelist, executes `ctx.call(capability, wait=True, **args)` in-process, and routes the result into the canonical bucket rather than appending raw dumps to chat history:
    - **File / Symbol / Diff Reads** $\rightarrow$ Mounted or lens-promoted in-place inside **`data`**.
    - **Topology / Search Queries** $\rightarrow$ Mounted into **`hierarchy`**.
    - **Diagnostic / Domain Capability Outputs** $\rightarrow$ Recorded in **`telemetry`** (under `telemetry.capability_results`).
  - Each `llm` node is governed by a `max_probes` ceiling (defaulting to `max_probes: 2`, configurable from `0` to `3`, max 5 calls per pass). Once `probe_attempt == max_probes` is reached, capability call directives are stripped for the final pass so the model must synthesize its output.
  - **`web_chat` Parity:** Ingesting a `web_chat` reply containing `CALL_CAPABILITY` or `QUERY_CONTEXT` executes the capability in-process, updates the target buckets (`data` / `hierarchy` / `telemetry`), refreshes the JIT **[Context]** artifact in the Handoff UI, and keeps the handoff focused on the current node for the final reply.
