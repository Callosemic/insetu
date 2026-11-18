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

### 4.1 Interleaved Fast Scout & Plan Loop (`scout_and_plan_loop`: `(scout_targets -> plan_tasks)` $\times 3$), Working-Set Pruning & Subsetted `CODE_INDEX` Projection
1. **Interleaved `(scout_targets -> plan_tasks)` Convergence Loop (`type: loop`, `until: plan_tasks.status == 'ready'`, `max_iterations: 3`):**
   - Asking a fast model to both scout files and construct a multi-step plan in a single JSON response overloads its reasoning, while scouting in a vacuum without planning loses structural alignment with the requested items. `/code` therefore runs a bounded `type: loop` (`scout_and_plan_loop`, up to 3 cycles) that alternates between two focused fast-tier nodes—**`scout_targets`** (file discovery) and **`plan_tasks`** (task synthesis & gap detection):
   - **Step A — `scout_targets` (`tier: fast`, File & Linked-Doc Discovery):**
     - **Sole Cognitive Job:** Find the `vfs://<repo>/<path>` implementation/test files (`requested_files`), shared `.md` docs (`global_files`), and any unread `.md` plans/interfaces (`inspect_files`) for the user's requested items (guided on Cycle 2+ by `loop.prev.plan_tasks.missing_context_notes` and `loop.prev.plan_tasks.tasks`).
     - Any URI placed in `inspect_files` is immediately clamped to `topology_ledger` and read into `attached_docs_content` before `plan_tasks` runs.
   - **Step B — `plan_tasks` (`tier: fast`, Plan Synthesis & Coverage Gate):**
     - **Sole Cognitive Job:** Map every requested item into ordered `tasks` (`T1..TN` with step-pinned `targets`) against `scout_targets.requested_files` and `attached_docs_content`.
     - If any requested item references an unread `.md` plan not yet in `attached_docs_content` or lacks its target implementation file, `plan_tasks` sets `"status": "need_context"`, lists unread docs in `"inspect_files"`, and records `"missing_context_notes"` to drive the next `(scout_targets -> plan_tasks)` cycle.
     - Once all requested items have complete tasks and targets, `plan_tasks` sets `"status": "ready"`, terminating `scout_and_plan_loop`.
   - **Deterministic Self-Consistency Guard:** When `existing_plan` is normalized, every task's `targets` list is automatically enriched with any existing workspace files mentioned in that task's `description` or `test_contract`, and `CODE_INDEX.md` is excluded from `full`/`slice` working-set mounting (since `fetch_context` projects `CODE_INDEX.md` via the neighborhood `outline` lens).
     - **Path & Directory Resolution Discipline:** Only clamped, valid `topology_ledger` URIs are accumulated across hops (a single unresolved path never forces extra LLM hops when valid targets were already resolved, and directory URIs like `vfs://akasa/docs/` resolve to their index/README file).
     - **Strict `pinned_repos` Boundary & Unpinned Repo Consent:** Candidate path disambiguation (`find_path_candidates`) may fall back across repositories **only within the user's active `pinned_repos` set**. If a prompt, plan, or scout references a file that belongs to a mounted repository *outside* the user's active `pinned_repos`, the engine must **never** silently pull that repository into context; instead, it records an explicit unpinned-repository notice/request so the user can choose whether to pin the additional repository.
   - **Non-Blocking Fast-Tier Ambiguity Notes (`plan_tasks.clarifications`):** `scout_and_plan_loop` never halts mid-loop to block on human input. If `plan_tasks` detects a scope ambiguity (e.g., whether to execute Sprint 1 only or Sprints 1–3 of a referenced plan), it locks in the most conservative default for `T1..TN` and attaches an optional `clarifications: [{id, question, options, default}]` array to `active_plan` so `fetch_context` finishes immediately and surfaces a non-blocking 1-click scope pill in `<insetu-agent-plan-stepper>`.
   - The downstream thinking model retains a bounded allowance of up to 2 probes for missing repository context (`<<<<<<< QUERY_CONTEXT`, `max_probes: 2`, as in §13) and a bounded 1-request allowance for genuine human architectural/product decisions (`<<<<<<< ASK_USER`) before producing its final output.
2. **Subsetted `CODE_INDEX` Slices for Thinking Models (No Full-Index Dumps):**
   - Because a repository's full `CODE_INDEX.md` can exceed 200 KB, full `CODE_INDEX.md` files belong to fast-tier scouting rather than thinking-tier synthesis.
   - Thinking models receive a targeted subset of the index derived from an expanded blast-radius walk around the active working set.
3. **Node-by-Node & Wavefront Working-Set Lifecycle:**
   - The active working set is dynamic across the DAG rather than static for the whole turn: it updates as each node adds or removes files.
   - When execution splits into a parallel wavefront (`1 -> N` or `map_over`), the working context reflects all files added across that wavefront while it runs, and evicts branch-local files that are not carried forward into the working set of subsequent nodes.

### 4.2 Unified Plan Schema (`meta.active_plan`), Continuous Thinking-Loop Plan Evaluation & Turn-by-Turn Step Sequencing
Whether a multi-step task originates from a canonical `PlanDocument` file (`docs/plans/*.md`), an unstructured prose review brief (`gemini_offline_bridge_followup.md`), or a broad natural-language instruction (*"look through the code for DRY violations and get rid of them"*), the Agent Harness normalizes it into a single canonical `active_plan` schema (`PlanTask(id, kind, description, completed, transaction_id, targets, test_contract)`) mounted in **`Bucket 3: meta`**:

1. **Stage-2 Plan Lock-In & Continuous Plan Evaluation in the Thinking Loop (`<<<<<<< TASK_MANAGE`):**
   - **Initial Plan Lock-In Before Thinking Step 1:** Either `parse_plan_markdown` (for canonical `- [ ] [ID]` plan files) or the 2-stage `scout_targets` $\rightarrow$ `plan_tasks` fast funnel (for unstructured briefs and multi-part prompts) locks in the initial `active_plan` (separating `global_files` from per-step `tasks[i].targets`) *before* `fetch_context` packs the working set for Turn 1.
   - **First Thinking Step (`generate_patch`):** Receives the locked-in plan with `[T1]` active and only `global_files` + `T1.targets` (`full` lens) + `T1`'s 1-hop blast-radius neighbors (`slice` lens) mounted in `data`. The thinking model is instructed to edit/refine the plan via `<<<<<<< TASK_MANAGE` if necessary and implement the first active step (`[T1]`), using `<<<<<<< QUERY_CONTEXT` only if a file required for the *currently active step* (`[T1]`) is missing from `data` (never to pre-fetch deferred steps `T2..Tn`).
   - **Continuous Plan Evaluation Across Turns (`<<<<<<< TASK_MANAGE`):** Continuous plan evaluation is built directly into the thinking loop across turns: at any step, the thinking model can emit `<<<<<<< TASK_MANAGE` directives (`COMPLETE`, `UPDATE` / `ADD`, `DROP`, `ACTIVE`) to check off completed work, update step descriptions or target files, or break up a complex step into sub-steps (`T2a`, `T2b`), continuing step-by-step until the plan is completely implemented.
2. **Ephemeral Session Plans & Semi-Deterministic Normalization of Unstructured Plans:**
   - **Zero-Friction Turn 1 Execution:** Plans synthesized from unstructured prompts, headingless notes, or narrative briefs live ephemerally in `chat_sessions.active_plan_json` (`is_ephemeral: True`) so Turn 1 proceeds immediately with `[T1]` scoped and source files on disk are never mutated without consent.
   - **Semi-Deterministic Plan Normalization (`agent.normalize_plan`):** When a referenced document is acting as a multi-step plan (`len(tasks) >= 2` and `parse_plan_markdown == False`) or when an ephemeral plan crosses the complexity threshold (`recommend_file_upgrade: True`, $\ge 4$ tasks or $\ge 6$ target files), the Plan Stepper surfaces two 1-click normalization options:
     1. **Option A — Stage In-Place Rewrite (`mode: "in_place"`):** Uses a fast/standard LLM pass combined with deterministic `clamp_rag_files_to_topology` validation to rewrite the referenced `.md` file into canonical `PlanDocument` format—preserving all non-task background prose, warnings, and architectural invariants verbatim under a top `## Context & Invariants` section while converting actionable items into `## Sprint N` headings and `- [ ] [ID] Description <!-- targets: vfs://..., test_contract: vfs://... -->` checklists—and stages the result as a reviewable Yomama patch in `BridgeStore`.
     2. **Option B — Promote to Companion Plan File (`mode: "companion_file"`):** Leaves the original narrative brief untouched on disk (ideal for read-only review briefs in `docs/plans/agent-briefs/`), materializes the normalized `## Context & Invariants` + `- [ ] [ID]` checklist into `vfs://<repo>/docs/plans/<date>-<slug>.md` (with `source_uri` provenance in frontmatter), and binds `chat_sessions.active_plan_path` to the new file.
3. **Foveated Plan Projection & Working-Set Scoping per Turn:**
   - During Turn $k$, `Bucket 3: meta` projects the active task (`active_task_id`) at **`full` lens** (complete description, targets, and test contract) and projects completed (`[x]`) and future (`[ ]`) tasks at **`outline` lens** (1-line coordinates), while `Bucket 4: data` mounts **only** the active task's `targets` (`full` lens) and their 1-hop `assemble_blast_radius` AST/affinity neighbors (`slice` lens).
   - Exploratory steps (`kind: "explore"`) and implementation steps can amend remaining unchecked tasks in `meta.active_plan` as new codebase facts are discovered.
4. **Commit-Driven Step Check-Off & Next-Step Handoff Progression:**
   - When a step's Staged Patch Stack is ratified via **Confirm & Commit** (`agent.record_transaction`), the transaction ID (`tx_...`) is bound to the active `PlanTask`.
   - Depending on the workspace `auto_complete_plan_tasks` setting, the harness either surfaces a one-click **"Mark [ID] Complete & Start Next Step"** button bar (default) or automatically marks the task complete (updating `- [x] [ID] (tx_...)` in-place when backed by a plan file), advances `active_task_id` to the next unchecked task, swaps the working set to the next task's targets, and initiates the next turn's run/handoff.

### 4.3 The Polyglot Workspace & Per-Step Epistemic Reduction Law
`inSetu` never segregates routines into "code routines" vs. "prose routines" vs. "research/`md-db` routines." The workspace is modeled as **inherently polyglot at rest**, and every turn—or every individual `PlanTask` step $T_k$ within a multi-step plan—dynamically reduces to a 3-tuple evaluated Just-In-Time (JIT):

$$\text{StepState}(T_k) = \bigl(\text{EpistemicMode},\; \text{Scope},\; \text{ActiveDomains}(B_{\text{data}})\bigr)$$

1. **Axis 1 — The 6 Universal Epistemic Modes (`epistemic_mode` / `PlanTask.kind`):**
   Both conversational turns and individual plan tasks (`T_k.kind`) draw from the same six domain-neutral epistemic modes:
   - **`explore` (`ORIENT` / `SCOUT`):** Inspect structural outlines (`outline_root`), read candidate specs, or pause for `QUERY_CONTEXT` / `ASK_USER` disambiguation.
   - **`plan` (`ARCHITECT`):** Synthesize, split, or refine `meta.active_plan` (`TASK_MANAGE` or `PlanDocument`).
   - **`edit` (`EXECUTE`):** Mutate the step's scoped target artifacts via Yomama blocks (`SEARCH/REPLACE`, `TEXTEDIT`, `JSON_PATCH`, `RELOCATE`, `RENAME`).
   - **`verify` (`TEST` / `SENSOR`):** Execute deterministic domain sensors (`bridge.test`, `fitness_functions`, `mddb.audit_upkeep`) and repair failures.
   - **`audit` (`REVIEW` / `CRITIQUE`):** Inspect cumulative diffs (`lens: "diff"`) + deterministic sensor telemetry + `governance` standards to identify bugs, drift, or technical/editorial debt (appending remediation tasks `T_{n+1}` via `TASK_MANAGE` or proposing options via `ASK_USER`).
   - **`explain` (`SYNTHESIZE` / `STATUS` / `HORIZON`):** Read-only architectural walkthroughs, progress matrices comparing `[x] T1..TN` against the governing brief, or *"what's next?"* horizon discovery.

2. **Axis 2 — Dynamic Scope Resolution (`scope_mode: step | plan | turn | dirty | backlog`):**
   - **While a Plan Has Unchecked Steps (`active_task_id != None`):** Defaults to **`scope: step`**, mounting only `T_k.targets` (`full` lens) + 1-hop `neighbours(T_k.targets)` (`slice` lens) + `global_files`.
   - **When All Plan Steps Reach `[x]` Complete (`active_task_id == None`) or on `:plan` Scope:** Automatically widens from the final step's targets to **`scope: plan`**:
     - For **`audit`**, **`explain`**, or **`verify`**: Collects all `transaction_id`s recorded across `T1..TN` (`bridge.turn_diff`) to mount the **Cumulative Plan Diff (`lens: "diff"`)** and touched files across all steps alongside the governing brief (`global_files`) and live sensor readings (`telemetry`).
     - For **`horizon` (*"what's next?"*)**: Projects a 1-turn `[COMPLETED PLAN RECEIPT]` in `meta`, inspects remaining unchecked items in the attached `global_files` brief/plan (`docs/plans/*.md`) and open Tracker/notice items, and presents concrete next-horizon options via `<<<<<<< ASK_USER`.

3. **Zero-Extra-Hop Frame Resolution (Deterministic First, Piggybacked Fast-Tier Second):**
   Resolving `(epistemic_mode, scope_mode)` at the start of a turn must **never** add an extra LLM round-trip:
   - **Deterministic Fast-Path (`0ms`, `0 tokens`):** Explicit `/command[:scope]` triggers, Plan Stepper action pills (`[🔍 Review Work]`, `[🧭 What's Next?]`), mid-plan step execution (`active_task.kind` + `scope: step`), and post-plan completion prompts when `unchecked_count == 0` resolve `(epistemic_mode, scope_mode)` deterministically in Python.
   - **Piggybacked Fast-Tier Resolution (`0 extra hops`):** When an un-scoped natural-language prompt enters `/auto` (`classify_intent`) or `/code`'s `scout_and_plan_loop` (`plan_tasks`), the existing fast node's JSON schema emits `epistemic_mode` and `scope_mode` alongside its normal output in the same single call.

4. **Axis 3 — Artifact-Driven Domain Craft Projection (`ActiveDomains(B_data)`):**
   Rather than hardcoding code-specific instructions into routine skeletons, `compile_llm_node_request` inspects the URI schemes and file types actually mounted in `Bucket 4: data` for the current step and projects only the matching **Domain Craft Lenses** into `Bucket 6: prompt` (and runs only the matching deterministic sensors in `Bucket 5: telemetry`):
   - **Code Targets (`.py`, `.js`, `.ts`, `.rs`) in `data`:** Projects AST `SEARCH/REPLACE` & `RELOCATE`/`RENAME` rules, `MODULE_SIZE_RATCHET` / fitness invariants, and pairs edits with `bridge.test` + Tree-Sitter syntax gates.
   - **Two-Axis `md-db` Targets (`mddb://` or managed `.md` records) in `data`:** Projects `JSON_PATCH` frontmatter/sub-record rules, the Bounded 2-Level Folder Law, `allowed_children` & `ur:` attestation invariants, and pairs edits with `ctx.mddb.audit_upkeep`.
   - **Prose / Documentation Targets (`.md`, `.txt`, `.typ`) in `data`:** Projects inline `TEXTEDIT` (`{{-del}}{{+ins}}`) and section `SEARCH/REPLACE` rules, heading hierarchy & `[link]`/`[[wikilink]]`/`[@citation]` integrity checks, and voice/tone directives.
   - **Polyglot Steps (Multiple Domains in `data`):** Composes the active domain lenses for each target type present in the step's working set.
5. **Post-Plan Completion Lifecycle ("Review Your Work" Audit vs. "What's Next?" Horizon Discovery):**
   When all tasks `T1..TN` in `meta.active_plan` reach `completed: True` (`active_task_id: None`), the working set is sitting on only the final step `TN`'s targets. Subsequent turns therefore transition `meta.active_plan` and `data` based on the user's post-plan intent:
   - **Post-Plan Audit & Self-Review (*"review your work and check for bugs and technical debt"* / `/audit`):**
     - Rather than reviewing only `TN`'s files or re-mounting all `T1..TN` files at full text cost, the harness collects the union of all `transaction_id`s recorded across `T1..TN` (`plan.transaction_ids`) and mounts the **cumulative turn diff (`bridge.turn_diff` / `lens: "diff"`)** alongside `full`/`slice` projections of every file modified across the entire plan.
     - An upstream deterministic sensor pass (`bridge.test` / fitness ratchets / `topology.audit_upkeep`) populates `Bucket 5: telemetry` with any test or ratchet violations across the touched repositories.
     - If defects or tech-debt items are found, the thinking model appends remediation tasks (`ADD: T5 | ...`) via `<<<<<<< TASK_MANAGE` and emits the repair patches immediately.
   - **Next-Horizon Discovery (*"what's next?"* /New Multi-Step Request):**
     - Projects the completed plan for one turn as a compact `[COMPLETED PLAN RECEIPT]` in `Bucket 3: meta`, inspects any remaining unchecked sections in the attached `global_files` brief/plan (`docs/plans/*.md`) and active workspace Tracker/notices, and either proposes the next plan via `<<<<<<< ASK_USER` (`single_choice` horizon options) or replaces the completed ephemeral plan with the newly requested `T1..TM` plan.

---

## 5. Observability & Two-Level Budgeting: Mechanical Context Ceiling vs. Cumulative Session Spend

`inSetu` separates token and cost governance into two distinct levels reflected directly in the **Two-Part Context Budget HUD**:

1. **Level 1 — Mechanical Per-Call Context Ceiling (HUD Part 1: Live Working Context):**
   - **What It Measures:** The point-in-time input token load entering the active/next `llm` node, compared against the target model's physical `context_length` from `model_catalog.json` (defaulting to `200,000` tokens when unknown).
   - **75% Mechanical Threshold:** The working set is optimal below `75%` of the target model's `context_length`. Crossing `75%` transitions the HUD to `warning` (`Near Ceiling`) and triggers peripheral lens step-down (`full` $\rightarrow$ `slice` $\rightarrow$ `outline`) on non-pinned artifacts; crossing `90%` transitions the HUD to `danger`. Fast-tier scout calls are bounded only by their own model's physical window.
2. **Level 2 — Cumulative Session Spend Watermark (HUD Part 2: Session Token & Cost Ledger):**
   - **What It Measures:** Cumulative session spend (`total_cost_usd`), computed as $\sum (\text{in\_tok} \times \text{rate}_{\text{in}} + \text{out\_tok} \times \text{rate}_{\text{out}})$ across all cognitive tiers (`decision`, `fast`, `standard`, `thinking`, `frontier`). Because `fast`-tier calls cost a fraction of `thinking`-tier calls, `fast` scouting and compaction naturally consume negligible budget while `thinking`/`frontier` calls dominate the watermark.
   - **`web_chat` Imputed Thinking Cost:** Although `web_chat` (`transport: manual`) does not bill an API key, external web chats enforce rolling message/time limits. `web_chat` turns impute standard `thinking`-tier token rates into the session ledger to provide a consistent gauge of session load.
   - **Ratcheting Session Watermark ($X_{\text{new}} = X_{\text{old}} + Y$):** Each session maintains a cumulative spend ceiling $X$ (`budget_limit_usd`, initialized to $X_0$) and an increment step $Y$ (`budget_step_usd`):
     - **API-Based LLM Nodes:** When `total_cost_usd >= X` prior to an automated API LLM call, the run pauses (`status: "paused_for_budget"`). Clicking **Resume Turn** ratchets the session ceiling by $Y$ ($X_{\text{new}} = X_{\text{old}} + Y$) and continues from the paused wavefront.
     - **`web_chat` Nodes (Warning Pass-Through):** When `web_chat` is the active transport and `total_cost_usd >= X`, the orchestrator does **not** halt with a blocking button gate before the handoff. Instead, it proceeds to the Web-Chat Handoff panel with an inline, buttonless budget warning message; submitting the `web_chat` reply implicitly confirms continuation and ratchets $X_{\text{new}} = X_{\text{old}} + Y$ until an automated API LLM call trips the wire.
3. **Collapsible Per-Node Execution Trace ("Thinking"):**
   - Each turn surfaces a collapsible execution trace showing what the current node is, which nodes have already run, and which node is currently running.
   - When a step fans out into parallel branches or shards, the child executions are listed nested under the parent step.

---

## 6. Self-Contained Healing Loops (Epistemic Reconciliation)

Outputs from `llm` nodes are treated as **hypotheses** until ratified by a deterministic `exec` sensor (`topology`, `bridge.sync`, or `bridge.test`). Whenever a hypothesis meets a physical system boundary, reconciliation occurs through a **self-contained healing loop**:

1. **Topological Reconciliation:** Candidate file URIs proposed by an LLM scout are clamped against `topology_ledger` (`clamp_uris_to_topology`) before entering `data`.
2. **Syntactic, Anchor & Out-of-Band Collision Reconciliation (Yomama Bridge Loop):**
  - Proposed patch blocks are evaluated in canonical order (`0 .. n`) in memory (`bridge.sync`). If patch `n` fails to anchor or introduces an AST syntax error, an isolated healing loop runs with `[data.pre_buffer_n_minus_1, telemetry.syntax_or_anchor_error, prompt.failed_block_n]` and substitutes the repaired block in-place at index `n`.
  - **Out-of-Band Edit Guard (`snapshot_sha256`):** When `data` mounts a file, the envelope records its `LIVE` disk hash (`snapshot_sha256`). If the developer manually edits and saves the file while an `llm` node is mid-inference, `bridge.sync` detects the hash divergence prior to disk flush, attempts a non-overlapping 3-way rebase against the new `LIVE` state, and—if the modified lines collide—holds the patch in `VIRTUAL` (`diff:live..virtual`) for human review rather than clobbering the out-of-band edit.
3. **Behavioral Reconciliation (Test Diagnostic Loop):** Once patches pass syntax verification, `bridge.test` executes the repository's test suite and writes structured failures (`TestDiagnosticSchema`) into `telemetry`. If `telemetry` reports failures, a bounded convergence loop (`type: loop`) projects `[data.modified_files, telemetry.test_failures]` to repair the regression or atomically rolls back the transaction via `bridge.revert`.

---

## 7. Envelope Seeding, Deterministic Capabilities & JIT Compute Materialization

1. **Everything Deterministic Is a Routine Step (`type: exec`) & No-Intervention Paths:**
    - Any deterministic sequence of operations in `inSetu` exposed as a capability (scouting relevant tests for a diff, auditing symbol drift, assembling blast-radius slices, running tests, committing patches, or executing `git.commit` / `git.push` at a milestone sink) must be composable as standard `type: exec` nodes within a Routine DAG.
    - `exec` nodes execute in-process prior to or between `llm` nodes, reading from and mutating the 6 canonical buckets deterministically.
    - **Declarative Intervention Policy & `/yolo` Mode (`intervention: yolo | none | on_failure | review`):** Routines may declare no-intervention default execution paths—or be invoked under `/yolo` mode—where all manual staging and confirmation gates are bypassed. Provided deterministic gates (`bridge.sync` anchor/syntax verification, `snapshot_sha256` collision check, and `bridge.test` exit code `0`) pass, or heal within bounded convergence loops, the DAG advances straight through disk flush and commit/push sink nodes without human intervention.

2. **Frontmatter `includes:` Are Initial Envelope Seeds (No Prebuilt Workflow Contexts):**
    - A Routine's frontmatter `includes:` list is strictly a declarative seed list that populates the initial buckets (`governance`, `hierarchy`, `meta`, `data`) when the Routine is invoked.
    - Routines do **not** pre-compile static `ctx://workflows/workflow_*_context.txt` files during background Gather sweeps. Context is materialized Just-In-Time (JIT) when execution reaches an `llm` compute node, after all upstream `exec` nodes (such as `topology.scout_tests` or `context.assemble`) have enriched and pruned the buckets.

3. **The Two-Sided Formal LLM Compute Contract (Ingress & Egress Parity Across API and `web_chat`):**
    `web_chat` (`transport: manual`) is strictly a transport driver where a human acts as the network wire for a paused `type: llm` node. Every `type: llm` node across the OS obeys a symmetric two-sided contract:
    - **Contract A — `LLMCallEnvelope` (Ingress):**
      Before dispatch, the orchestrator compiles the node into two distinct JIT artifacts:
      1. **The JIT Context Payload (Buckets 1–5):** The volatility-ordered serialization of `governance`, `hierarchy`, `meta`, `data`, and `telemetry` (materialized as both a `Full Context` Quickpack and a content-addressed `Same-Window Delta` Quickpack via `web_chat_sent_hashes`).
      2. **The Prompt Payload (Bucket 6):** The resolved node instructions, `active_plan_prompt_block` banner, `incoming` pipe data, and formal `output_schema` / Yomama Patch Protocol directives—never polluted with raw `<workspace_context>` file dumps.
      Automated drivers transmit `(JIT Context Payload, Prompt Payload)` directly over HTTP/CLI; `web_chat` pauses at the node boundary (`paused_for_user`) and renders the exact same envelope (`_build_handoff_branch`).
    - **Contract B — `process_llm_node_egress` & `process_turn_task_directives` (Egress):**
      The moment a response arrives—whether from an HTTP API call, a resumed `web_chat` handoff (`handoff_responses`), or an ad-hoc paste (`agent/ingest_reply`)—it passes through one canonical egress pipeline:
      1. **Epistemic File/Lens Probes (`<<<<<<< QUERY_CONTEXT`):** Expands requested files/symbols/messages in `RoutineEnvelope` and re-prompts the node (up to 1 hop).
      2. **Epistemic Human Decision Probes (`<<<<<<< ASK_USER`):** Extracts structured clarification questions (`boolean`, `single_choice`, `multi_choice`, `short_text`, up to 1 hop per node when no code patches are present), pauses the node (`status: "paused_for_user"` with `pending_questions`), renders `<insetu-agent-decision-card>` in Chat, and injects the user's structured answers into `Bucket 3: meta` (`recalled_messages_text` / Same-Window Delta) to resume the node.
      3. **Plan Directives (`<<<<<<< TASK_MANAGE` via `process_turn_task_directives`):** Extracts and strips `TASK_MANAGE` blocks, immediately applying plan-initialization/refinement ops (`add`, `update`, `set_active`) via the pure `reduce_plan_actions` reducer while gating completion ops (`complete`, `reopen`, `drop`) as 1-click confirmation actions (or auto-applying when `auto_complete_plan_tasks` is enabled).
      3. **Schema & Patch Validation:** Validates `output_schema` or parses Yomama patch cells (`parse_blocks`) for downstream `bridge.sync` verification and root-boundary prose/patch splitting (`strip_yomama_blocks_keep_prose`).

---

## 8. Universal Context Artifacts, Representational Lenses & Composable RAG

### 8.1 Everything in Context Is a URI-Addressed Artifact (`URI` + `Lens` + `Decay`)
Every item mounted across the 6 buckets—whether a physical source file (`vfs://`), a compiled context or telemetry buffer (`ctx://`), a conversation turn or turn-bound sensor reading (`msg://`), or a structured database record (`mddb://`)—is modeled uniformly as a **Context Artifact** anchored by its canonical URI and projected through a **Representational Lens (`lens`)**:

$$\text{Project}(\text{URI}, \text{lens}, \text{params}) \rightarrow \text{Context Representation}$$

| Artifact Scheme | `full` Lens (Focal / Hot) | `diff` Lens (Temporal Delta) | `slice` Lens (Structural / Warm) | `outline` Lens (Coordinate / Cold) | Decay Axis |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`vfs://` / `ctx://`** *(Files, Docs & `ctx://telemetry/*`)* | Complete current file text (or full failure traceback / terminal buffer) | Interleaved AST diff (`head..live`, `live..virtual`, `head..virtual`) | AST interface signatures & docstrings (`slice_interface`) or structured failure batch (`TestDiagnosticSchema`) | 1-line `CODE_INDEX.md` subtree coordinates or loop ledger receipt (`meta.loop_ledger`) | **Working-Set Idle Turns, Loop Iteration Age & Graph Hop Distance** |
| **`msg://`** *(Session, Turn & Sensor Ledger: `msg://<session_id>` & `msg://<message_id>[#telemetry]`)* | **Turn Dossier (`msg://<msg_id>`):** Prompt, pre/post `__envelope__` working set, DAG `execution_trace`, joined `llm_telemetry` node calls (`prompt_excerpt` + `response_excerpt`), verbatim prose + `raw_content` patches, & `bridge_heal_audit` / test cases | Committed turn patch diff (`bridge.turn_diff` for `transaction_id`) + working-set lens delta | **Session Overview (`msg://<session_id>`)** or **Turn Receipt (`msg://<msg_id>`):** `active_plan` state, tier cost ledger, DAG `execution_trace` tree (`hop1..k`), & 1-line LLM/sensor table | Cold summary block (`compacted_view_json`) or 1-line turn/loop coordinate (`#seq`, mode, tx) | **Turn & Loop Iteration Age** (Hot $\rightarrow$ Warm $\rightarrow$ Cold) |
| **`mddb://`** *(Tracker / Notes / Plan / Records)* | Full Markdown + YAML frontmatter + sub-spans | Record field/body delta | YAML frontmatter + roll-ups + heading tree | 1-line record coordinate (`[id] title • status`) | **Containment / Ur-Graph Distance** |

Because every artifact shares the same `(URI, bucket, lens, tokens)` contract:
* **Uniform Foveated Decay (Level-of-Detail Mipmapping):** As an artifact moves further from the current focal point (in turn age, loop iteration, or graph hop distance), its lens automatically steps down (`full` $\rightarrow$ `slice` $\rightarrow$ `outline`) rather than either bloating the window or vanishing without a trace.
* **Uniform In-Place Promotion (`QUERY_CONTEXT`):** Any `outline` or `slice` artifact across any scheme (`vfs://...`, `ctx://...`, `msg://...`, `mddb://...`) can be promoted back to `full` or `diff` in-place via `<<<<<<< QUERY_CONTEXT`.

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

**The provider contract.** Every scheme above, and any domain provider outside code, implements one lens contract: `project`, `neighbours`, `outline_root` and `resolve`, with distance bands owned by the envelope rather than the provider. See `vfs://insetu/docs/plans/2026-11-12-lens-contract.md` (roadmap P25).

**The outline root.** An outline is always an outline. `outline_root` serves the blurriest lens, the best whole fit for the budget, and never substitutes a slice; a slice may accompany an outline but never replaces one. Every line is a name, a count and a few words. Levels are whole: a provider serves the finest level that fits, never part of one, so the same scope and budget always give the same outline. The budget is a share of the model's input limit (the smallest, when a routine uses several), decided when the run starts and kept. The root has no focus; detail near the targets comes from distance bands.

**Categories.** When a scope's finer levels do not fit, categories sit above them: a derived tree kept by one engine mechanism for any provider, not a feature of code. For code the levels are `CODE_INDEX.md`, then the file tree, then categories as soon as files do not fit. There is no directory-depth level, because folders carry meaning only when people keep them disciplined. The bounds decide the tree's structure, the budget decides how much of it is seen at once, and the targets and the model's own requests decide where it is seen deeper. Nodes split at their own level and depth grows only at the top, so every branch stays the same depth. A change bubbles up and stops at the first level it does not affect. A person's descriptions win. With no model, the folder structure is the deterministic fallback.

### 8.2 Declarative Input Dependencies (`requires:`) & Default Fallbacks
Routines and RAG execution nodes declare what resource lenses they require and how to populate them when the user does not attach explicit overrides:
* **User-Attachment Precedence:** If the user invokes a routine with explicit attachments matching the dependency (for example, attaching a specific diff bucket or dirty files when invoking `/wrap`), those resources seed `data` under the requested lens.
* **Deterministic Repo/Scope Fallback:** If no matching user attachment is provided, the dependency resolves its `default` selector against `topology_ledger` (for example, selecting all `git_status != ''` files in the target repository—or within the colon-scoped `:sub_bucket`—and mounting them into `data` with `lens: "diff"`).

### 8.3 Proximity Filters, Cross-Domain Jumps & Foveated Lens Decay
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

### 8.4 The Coupling Graph: Hebbian Affinity & Asymmetric Conditioning
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

### 8.5 Cross-Repository Federated RAG (`vfs://<repo>/` Boundary Crossing)
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

## 9. The Session Thread Ledger: Conversational Loops, State-Transition Nodes & Rewind Orthogonality

Every Chat Session (`chat_sessions`) is a persistent state ledger maintaining two coupled channels across turns:
1. **The Thread Transcript (`meta.history` — Canonical Procession + Active Compacted View):**
   - **Canonical Procession:** The session maintains the complete, ordered procession of original messages (`user` prompts, `assistant` prose, `raw_content` patches, and `transaction_id` receipts), each with a stable identifier (`msg_<id>`) and monotonic sequence number (`seq`).
   - **Active Compacted View:** In parallel, the session maintains the current compacted representation injected into prompts (recent turns verbatim, intermediate turns as concise receipts, and older turns condensed into a session summary), retaining references to the original message IDs so any earlier turn can always be referenced or recalled in full by the user or agent.
   - Removing a message from the transcript removes it from both the canonical procession and the compacted view.
2. **The Session Working Set (`data.working_set` & `meta.active_plan`):** The rolling set of files attached or modified across recent turns (`a.py, b.py, c.py, d.py`), governed by the 5-turn TTL lens decay (`full` for 5 turns $\rightarrow$ `slice` at turn 6 $\rightarrow$ evicted at turn 9, with explicitly user-pinned files exempt while scout-added files decay normally).

### 9.1 Every Message Node Is a Self-Contained Cognitive Restore Point (Orthogonal to File History)
To support deterministic rewinding and retrying from any prompt in a conversation without turning the chat ledger into a shadow version-control system ("mini-git"), `inSetu` enforces a strict boundary between **Cognitive Session State** and **Physical File State**:
1. **Self-Contained Cognitive Envelope Snapshots & Turn Telemetry Binding per Node:**
   - Every message node in `chat_messages` records not only its text and point-in-time file hashes, but also the **Cognitive Envelope Snapshot** (`context_hashes_json["__envelope__"]`) and foreign-key link (`turn_msg_id`) to all telemetry generated during that turn:
     - **On a `user` Prompt Node (Pre-Turn Entry State):** Records the invoked `mode`, `routine_id`, `scope`, and visible command trigger (`/code`, `/plan`, `/ask`, etc.), alongside the exact pre-turn `working_set` (before that turn's scout ran), `active_plan`, and external `web_chat` `sent_hashes`.
     - **On an `assistant` Reply Node (Post-Turn Settled State & Execution Trace):** Records the settled post-turn `working_set` (`uri`, `lens`, `tokens`), `active_plan`, ratified `sent_hashes`, and the settled `execution_trace` tree (so a turn's DAG trace and hop children remain permanently inspectable after `chat_sessions.checkpoint_json` clears).
     - **Turn-Bound Telemetry (`turn_msg_id` on `llm_telemetry` & `bridge_heal_audit`):** Every LLM inference call (including fast scout hops and `web_chat` handoffs) and every Yomama Bridge auto-heal record executed during a turn is stamped with `turn_msg_id`. Projecting `msg://<session_id>` at `slice` lens (`00_session_overview.txt`) and `msg://<message_id>` at `full` lens (`turn_<NNN>_dossier.txt`) powers both in-chat `QUERY_CONTEXT` recall and downloadable `.zip` / Gather diagnostic bundles without a separate telemetry serializer.
2. **Pure Conversation Rewind (`agent.rewind` — Zero Disk File Reversion):**
   - Rewinding to any `user` prompt node $k$ truncates `chat_messages` from $k$ onward, invalidates any cold compaction blocks overlapping $\ge k$, clears any paused checkpoint, and deterministically restores the session's `working_set`, `active_plan`, `sent_hashes`, and composer `/mode` + prompt text to the exact pre-Turn-$k$ entry snapshot (evicting any files added by Turn $k$'s aborted or superseded scout).
   - Rewinding the conversation **never** reverts physical files on disk. Physical file history and undo belong exclusively to the Yomama Sync Bridge (`bridge_ledger` / `/undo`) and Git (`bonsai`); a rewound prompt always evaluates against the current live state of the workspace files on disk.

---

## 10. Execution Threading, `ctx://`, and `vfs://` I/O Contracts

To prevent worker-pool starvation, mid-turn VFS write echoes, and unmounted-volume failures across production and unit tests, the Agent Harness and RAG pipeline obey four strict execution and storage boundaries:

1. **Law 1 — Single-Hop Worker Dispatch & No Unawaited Routine Jobs:**
   - **HTTP Boundary (`202 Accepted`):** Top-level user actions (`POST agent/prompt`, `POST bridge/sync`, `POST gather/pack_selection`) submit a background job via `ctx.jobs.submit(..., job_category="ui_blocking")` so the HTTP thread returns immediately.
   - **In-Process Composition (`ctx.call(..., wait=True)`):** When a worker or routine invokes a capability in-process, it MUST call `ctx.call(..., wait=True)`. Declarative routines (`orchestrator.py`) execute deterministically wavefront-by-wavefront and MUST NEVER fire unawaited `ctx.call(..., wait=False)` background tasks that outlive the turn or test boundary.
2. **Law 2 — In-Memory `RoutineEnvelope` & Scratch vs. Published `ctx://contexts/` Artifacts:**
   - **In-Flight Turn State (`RoutineEnvelope` & `ctx.jobs.write_scratch`):** Intermediate context projections (`neighborhood_code_index_outline`, `session_transcript_history`, `delta_content`, and node outputs `< 256 KB`) remain **in memory** inside `RoutineEnvelope`. Node outputs $\ge 256\text{ KB}$ spill to `ctx.jobs.write_scratch(...)` (`.insetu/cache/scratch/`), which bypasses the VFS write queue, `topology_ledger`, and `manifest_ledger`.
   - **Published Context Packs (`ctx://contexts/`):** The `ctx://contexts/` volume is reserved exclusively for compiled, manifest-registered context packs written via `ctx.compile_context` (`gather.pack_selection` and `context.assemble`). `orchestrator.py` MUST NOT call raw `ctx.vfs.save("ctx://contexts/...", ...)` during node execution.
   - **Topological Buckets vs. Recipe Snapshots (`manifest_ledger` Lifecycle):** Published `ctx://contexts/` entries divide into two lifecycles: (a) **Topological Buckets** (`meta.type == "gather"`, excluding `Quickpacks` / `Exported Contexts`), which track repository `dirtyBuckets` watermarks and self-heal via `generate_context_file()`; and (b) **Recipe Snapshots** (`meta.domain` in `{"Quickpacks", "Exported Contexts"}` or `meta.type == "telemetry"`), which are point-in-time snapshots that never trigger full-workspace recompiles in the UI and self-heal on cache miss directly from their recorded `manifest_ledger` `files` recipe (or `bridge.compile_telemetry`).
3. **Law 3 — Read-Only `vfs://` Orchestrator Boundary:**
   - During a routine turn, `orchestrator.py` and `context_assemble.py` treat `vfs://<repo>/...` as strictly read-only (`ctx.vfs.read`). All repository mutations flow exclusively through `ctx.call("bridge.sync", ...)` (for code and patches) or `_persist_routine_response` / `agent.ensure_plan_file` (for declared document outputs).
4. **Law 4 — Lazy Declarative Volume Self-Healing (`vfs_mount_missing`):**
   - If a `ctx://<volume>` URI (`ctx://routines`, `ctx://prompts`, `ctx://contexts`, `ctx://diffs`, `ctx://settings`) is read or written before ` workspace_boot` or after a test-harness reset, the `vfs_mount_missing` hook delegates directly to the owning `InSetuExtension.mount_volumes(workspace_id)` so `TemplateOverlayVFSDriver` and custom volume drivers are preserved without clobbering scheme drivers.

## 11. Routine Archetypes: How Routines Read the Session

All Routines execute within this session ledger and **write** their final turn receipt and any newly patched files back into the session. However, Routines divide into two execution archetypes based on how they **read** from the session and how they leave the composer state:

### 11.1 Sticky Conversational Loop Routines (`/auto`, `/yolo`, `/code`, `/ask`, `/plan`)
* **Purpose:** Iterative, multi-turn human-AI collaboration where each turn builds on the conversational thread (`/yolo` operating as the zero-gate autonomous variant that auto-commits patches and runs bounded test/repair loops without confirmation pauses).
* **Reads Thread History (`use_history: true`):** Ingests the compacted Thread Transcript (4 hot verbatim messages + warm turn receipts including `files_patched` + cold `<session_summary>`) alongside the active Working Set (`data.working_set`).
* **Sticky Composer Behavior (`sticky: true`):** Remains active as the selected mode across consecutive turns so the developer can iterate naturally over the thread without re-selecting `/yolo`, `/code`, or `/plan`.

### 11.2 One-Shot Task Routines (`/test`, `/wrap`, `/closeout`, `/audit`, `/upkeep`, `/ratchet`)
* **Purpose:** Focused, self-contained engineering pipelines invoked at milestones during a session.
* **Ignores Conversational Chatter (`use_history: false`):** Does **not** inject the conversational prompt/answer history into its LLM nodes, preventing prior chat prose from polluting or biasing the task.
* **Pulls Context Selectively from Session & Workspace (`requires:`):** Pulls only the concrete artifacts it needs from the session (for example, `/test` pulls the session's modified/working-set files `a.py, b.py, c.py, d.py` and runs `rag.scout_tests` to attach their relevant unit tests; `/wrap` pulls dirty repository diffs and scouts their tests).
* **Writes Clean Turn Receipt Back to Thread History:** Upon completion, records a structured turn entry in the session's Thread Transcript (e.g., *"Test performed on `a.py, b.py, c.py, d.py`"* + diagnostic/resolution summary + `files_patched`) and updates the Session Working Set so subsequent `/code` turns have full visibility into what the one-shot routine did.
* **One-Shot Composer Reset (`sticky: false`):** Automatically returns the composer trigger to the prior conversational mode once the one-shot execution completes.

---

## 12. Bounded Continuous Convergence Loops (`type: loop`)

Routines support bounded autonomous iteration (`max_iterations: M`, `until: "<condition>"`) across two operational scales without suffering context-window inflation:

### 12.1 The Two Loop Scales
1. **Inner Tactical Convergence Loops (e.g., `max_iterations: 5` — Test & Lint Clearing):**
  - **Objective:** Drive a concrete empirical sensor in `telemetry` to zero errors (`until: "{{ telemetry.test_diagnostics.exit_code }} == 0"`).
  - **Cycle:** `exec (bridge.test)` $\rightarrow$ `llm (triage_and_fix)` $\rightarrow$ `exec (bridge.sync)` $\rightarrow$ repeat until `exit_code == 0` or `iteration == 5`.
2. **Outer Strategic Execution Loops (e.g., `max_iterations: 20` — Plan $\rightarrow$ Execute $\rightarrow$ Test):**
  - **Objective:** Autonomously step through a multi-task architectural plan (`meta.active_plan`) until all tasks are complete (`until: "{{ meta.active_plan.unchecked_count }} == 0"`).
  - **Cycle:** On iteration $k$, a deterministic cursor selects the next unchecked task `- [ ] [S1.T_k]` from `meta.active_plan`, rotates the `data` bucket to mount that task's `targets` (`full` lens), blast-radius interfaces (`slice` lens), and `test_contract` (`full` lens), executes the edit and inner test verification, marks `[x] [S1.T_k] (tx_...)` in `meta.active_plan`, and advances to iteration $k+1$.

### 12.2 Markovian $O(1)$ Context Invariant Across Iterations
Bounded loops must **never** accumulate raw LLM outputs or full test logs from prior iterations into a growing transcript:
* **In-Place Bucket Refresh:** At the start of iteration $k$, `data` reflects the current post-patch VFS files on disk and `telemetry` is **overwritten** with the latest sensor reading (e.g., only the tests still failing on iteration $k$).
* **Compact Episodic Loop Ledger (`meta.loop_ledger`):** Prior iterations are represented solely by a 1-line-per-iteration micro-receipt in `meta.loop_ledger` (e.g., `[Iter 2/5]: Patched c.py (tx_9b2c) -> failed_count dropped 3 -> 1; remaining: test_edge_case`), preventing the model from repeating a failed hypothesis while keeping token usage flat ($O(1)$) from Iteration 1 through Iteration 20.

### 12.3 Loop Safety & Termination Guardrails
Every bounded loop enforces three deterministic circuit breakers in addition to `max_iterations`:
1. **Stagnation & Oscillation Circuit Breaker:** The orchestrator fingerprints `(data_hash, telemetry_failure_signature)` after each iteration. If two consecutive iterations yield an identical failure signature (stagnation) or revisit a prior state hash (A $\leftrightarrow$ B oscillation), the loop halts early (`status: "halted_stagnant"`) rather than burning the remaining turn budget.
2. **Pre-Loop Rollback Anchor (`pre_loop_tx_anchor`):** Before Iteration 1 mutates any file, the orchestrator records a keyframe transaction boundary in `bridge_ledger`. Each iteration's `bridge.sync` commit is appended to the loop's transaction chain, enabling either single-iteration step-back (if an iteration increases failure count) or atomic full-loop rollback (`on_exhaustion: "rollback"`) if the loop fails to converge under `strict_test_enforcement`.
3. **Checkpoint & Cancellation Yielding:** Between every iteration (and at every `web_chat` handoff node), the loop checks `_is_cancelled()` and persists `meta.loop_ledger` + `wavefront_index` to `chat_sessions.checkpoint_json` so long-running 20-turn loops can be paused, inspected, or resumed cleanly.

---

## 13. In-Node Epistemic Probes, Human Decision Checkpoints & Scoped Capability Invocation (`QUERY_CONTEXT`, `ASK_USER` & `CALL_CAPABILITY`)

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

5. **Epistemic Human Decision Probes (`<<<<<<< ASK_USER` — Thinking Tier Only) vs. Non-Blocking Fast-Tier Clarifications:**
  - **Strict Anti-Laziness Hierarchy:** An `llm` node must **never** ask the user a question that the repository's files, schemas, or tests can answer—missing codebase facts must always be fetched via `<<<<<<< QUERY_CONTEXT`. `<<<<<<< ASK_USER` is reserved strictly for genuine architectural trade-offs, destructive confirmations, or underspecified product requirements.
  - **Two-Tier Ergonomics (Fast vs. Thinking):**
    1. **Fast Tier (`scout_and_plan_loop`):** Never blocks on `ASK_USER`. If `plan_tasks` spots a scope fork, it picks a sensible default for `T1..TN` and attaches non-blocking `clarifications` metadata to `active_plan` (rendered as optional 1-click scope-flip pills in `<insetu-agent-plan-stepper>`).
    2. **Thinking Tier (`generate_patch`, `/plan`, `/ask`):** May emit a single `<<<<<<< ASK_USER` block (1–3 questions of type `boolean`, `single_choice`, `multi_choice`, or `short_text`, terminated by `>>>>>>> EXECUTE`, max 1 hop per node). Both API and `web_chat` transports pause on the node and render `<insetu-agent-decision-card>` in Chat (with automatic `"Other (specify)..."` fallback inputs on choice questions); submitting the card serializes `=== USER DECISION RESPONSES ===` into `Bucket 3: meta` (`recalled_messages_text` and Same-Window Delta Context) and resumes the node.
