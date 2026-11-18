---
title: "Plan (Speculative): Memory and Conversation History on One Ledger"
description: "Conversation history (msg://) and long-term memory as two scopes over one pipeline: an append-only ledger of what happened, and a disposable, variable-depth tree above it that is projected through the lens contract. Mapped onto the session ledger, md-db and the lens contract, with the few constraints that work already in flight must respect so nothing is rebuilt later."
status: "speculative"
created: "2026-11-12"
models:
  - "vfs://insetu/docs/models/agent_orchestrator_and_rag.md"
  - "vfs://insetu/docs/models/mddb_and_tracker.md"
---

# Plan (Speculative): Memory and Conversation History on One Ledger

Draft by Claude, 2026-11-12, from your RFC of the same day ("Unified Foveated Memory & Conversation Architecture"). The direction is yours. Where this plan adds a constraint, it names the model or plan it comes from. Questions marked **OPEN** are yours to answer.

A mental model for this subsystem (`docs/models/memory_and_conversation.md`) waits for your dictation. Until it exists, this plan does not list it under `models:`.

## Roadmap placement (2026-11-12, proposed)

- **b) Demo ready:** Sprint 0 only. It adds constraints to work already in flight (Lane A Sprint A1, agent plan Sprint 1, lens contract Sprint 1) and builds nothing new.
- **After 1.0:** Sprints 1 to 4, after the agent loop, md-db (P20) and the lens contract's second-domain review.
- **Not before:** two lens providers exist (the sarga rule). Memory retrieval is a consumer of the routine engine, not part of it.

## Why

Memory and chat history are not needed for the demo. The risk is structural: the session transcript, its compaction and the lens contract are being built now, and if their shapes differ from where memory has to go, they get rebuilt. This plan records the target and pins the few properties that are cheap today and expensive later.

## Direction (from the RFC)

1. **One pipeline, two scopes.** Conversation history and extracted memory share one storage, indexing, compaction and retrieval pipeline. They differ only by scope.
2. **An append-only ledger, a disposable tree.** The leaves are a record of what happened: conversation turns and memory assertions. Everything above them (categories, summaries, tiers) is a derived view, rebuilt on demand.
3. **Concept stacks.** Assertions that revise one another attach to one canonical concept in order. The default projection is the latest; the history stays addressable through `diff`.
4. **A variable-depth ratchet.** A scope stays flat until a bucket passes a capacity `K`, then splits into sub-clusters, so the top level stays bounded from a hundred records to a million.
5. **Context-seeded rebucketing.** A split first moves pointers, reusing the existing sibling categories as anchors and minting new categories only for what does not fit. Summaries are rewritten second. Branches the split did not touch keep their summaries and hashes.
6. **Two payloads per category.** Each category has a one-line `outline` for routing and a dense `slice` that keeps entities, dates, decisions and state changes. A parent is summarised from its children's slices, never from their outlines, so summaries do not drift over several levels.
7. **Bounded progressive decompression.** A turn pins the top level of each active scope and spends a fixed jump budget opening only the branches it needs, down to `full` or `diff` on the leaves.
8. **Asynchronous consolidation.** Extraction, concept matching and rebucketing run out of band, at compaction boundaries or when idle, never on the turn's path.

## How it maps onto what exists

Most of the RFC already has a home. Building on these keeps it one mechanism.

| RFC concept | Existing mechanism | Source |
| --- | --- | --- |
| Conversation leaves (`msg://`) | `chat_messages` with `seq`, `receipt`, `transaction_id`, `compacted_into_id`; the canonical procession | Lane A Sprint A1 item 4; orchestrator model §9 |
| Cold compaction blocks | `chat_sessions.compacted_view_json`, watermarked, rebuilt when a message is deleted | Lane A Sprint A1 item 4 |
| `msg://` lenses | `full` the complete turn dossier (message + `__envelope__` working set + DAG `execution_trace` + joined `llm_telemetry` & `bridge_heal_audit` records), `diff` the turn's patch (`bridge.turn_diff`), `slice` the turn receipt/trace (or `00_session_overview` for `msg://<session_id>`), `outline` the summary block; powers both `QUERY_CONTEXT` and `.zip`/Gather telemetry exports | Orchestrator model §8.1; lens contract providers table |
| Memory leaves (`mem://`) | md-db records in an extension sidecar scope (for example `ext:memory`), indexed into `md_records` and `md_edges` | md-db model §6.1 |
| Concept stacks (`ur:concept/<slug>`) | md-db Ur-Records (`tier: 0`, workspace-global `ur:` ids) with reverse attestation; supersession as an `md_edges` relation | md-db model §2, §6.5 |
| `derived_from`, `attests_state_at` edges | Typed `md_edges` relations | md-db model §6.5 |
| `LensProvider` | The lens contract: `project`, `neighbours`, `outline_root`, `resolve` | Lens contract (P25) |
| `outline` and `slice` payloads | The `outline` and `slice` lenses | Lens contract |
| Fast-path retrieval | A routine of capability nodes, with distance bands as envelope policy | Agent plan Sprint 1, shared-engine constraints |
| Consolidation DAG | A routine with `map_over`, run under a standing contract (non-code writes only) | Agent plan, standing contracts |
| `sent_hashes` | `web_chat_sent_hashes`, keyed by `(lens, sha256)` | Orchestrator model §7.3 |
| Governance firewall | `authority` and the protected targets | Repo-facts plan §2A, §4.3 |

## Proposed invariants

Each comes from an existing model or plan. Confirm, change or drop each one.

1. **The ledger is the source; everything above it is rebuildable.**
   - Dropping every derived table and cache and rebuilding from the ledger gives an equivalent tree.
   - The derived tree lives in its own tables (or the cache directory). It never uses `md_records.parent_id`, which means authored containment in md-db; LLM-derived categories there would corrupt roll-ups and the tracker.
   - Derived nodes are never VFS files. As files, they would churn the watchdog and topology on every rebucket, against the direction of the JIT recipes plan.
2. **Addresses use the schemes that already exist:** `msg://<message_id>`, md-db record ids, `ur:` archetypes and `vfs://<repo>/<path>`. Do not add `repo://` or `ur://`.
   - Addresses are stable across revisions, never positions or line numbers (lens contract, Addresses).
   - **OPEN:** does memory get its own `mem://` scheme, or are memory leaves addressed as md-db records? Suggestion: md-db records, so memory gets indexing, FTS, proximity filters and the record editor for free.
3. **Point-in-time references and cognitive envelope snapshots are stored at write time.**
   - Every turn that refers to a file records its `sha256` (and, once git moves into core, the repository's commit) in `chat_messages.context_hashes_json`.
   - Every `user` message row also records the pre-turn cognitive envelope snapshot (`__envelope__`: `{mode, routine_id, scope, command_pill, prompt_clean, working_set, active_plan, sent_hashes}`), and every `assistant` message row records the post-turn settled snapshot (`{mode, routine_id, working_set, active_plan, sent_hashes, execution_trace}`), with `turn_msg_id` linking all `llm_telemetry` and `bridge_heal_audit` rows emitted during that turn.
   - **Rewind Orthogonality (`POST agent/rewind`):** Rewinding to a `user` message node $k$ restores `chat_sessions` (`working_set_json`, `active_plan_json`, `web_chat_state_json`, `compacted_view_json`) and the composer (`/mode` trigger + prompt) to the exact pre-Turn-$k$ snapshot while leaving physical disk files untouched (file reversion remains exclusively owned by `bridge.revert` / `/undo` and Git).
   - A URI qualifier grammar (`@rev`, `@ts`) waits for the post-diff plan's revision ledger (Pillar 1, after 1.0).
   - A qualifier must not use a character that can appear in a path: `@` appears in paths such as `node_modules/@types/`.
4. **Machine writers append; people delete.** The orchestrator model §9 already says that removing a message removes it from both the procession and the compacted view.
   - Machine writers (consolidation, agents) only append.
   - Revising a memory means a new leaf that supersedes the old one.
   - A person's delete is a purge. It removes the leaf's content, and the derived summaries along its ancestor path are rebuilt.
   - **OPEN:** when a person deletes a message, are memory leaves derived only from it purged too? Suggestion: yes, so "forget this" means forget.
5. **Storage stays out of repositories by default.**
   - Conversations stay in the workspace control directory (`.insetu/`), where `chat_sessions` and agent runs (`.insetu/data/agent/runs/`) already live.
   - User memory follows the user tier (as `ctx://settings/.templates/user/` does), and workspace memory goes in a `ctx://` volume.
   - Nothing goes under `.insetu-data/` unless a repository opts in. Repository-shared memory would be repository content, used only after a person accepts its exact text, like shared directives and repository prompts (prompts tree, rule a).
   - A fitness rule fails if conversation or memory files are tracked by git.
6. **Memory is data, never instruction.**
   - Memory projections enter the `meta` bucket (episodic state), or `data` when promoted, labelled with their provenance. They never enter `governance`.
   - Consolidation has no write path to `agent.md`, the protected targets or attestations (repo-facts §9.9).
   - A memory that quotes repository content keeps the repository-content label.
7. **Every machine write goes through Yomama.** "Every writer goes through Yomama" (agent plan). Memory writes then get `bridge_ledger` history and `/undo` without a second mechanism.
8. **Deterministic where it can be.**
   - Conversation tiers follow time (session, episode, turn) and need no model.
   - Memory tiers need semantic clustering on the `fast` tier. That output is derived, so its nondeterminism is acceptable, but it must never lose or duplicate a leaf.
9. **The top level is bounded.** The lens contract's `outline_root` currently returns "every addressable item in the scope". That cannot hold at a million records. It also does not hold for code today: the orchestrator model §4.1.2 keeps a full `CODE_INDEX.md` away from thinking models for the same reason.
   - Decided 2026-11-13 (lens contract, "The outline root"): `outline_root(scope, budget)` returns the finest whole outline level that fits a budget fixed for the run (5% of the smallest input token limit among the run's models); every line is a leaf or a group expandable through `neighbours` on the containment basis; it never substitutes a slice.
   - How a provider forms its tiers (symbols, files and categories for code, time for conversations, clustering for memory) stays the provider's business. That keeps the contract domain-neutral.

## Sprints

### Sprint 0: Constraints on work in flight (demo ready)

- [ ] **Lane A Sprint A1, item 4 (the dual-track message log):**
  - Message ids are stable across compaction and deletion, so `msg://<message_id>` never changes meaning.
  - Each turn records the repository commit and the `sha256` of each file in its working set. `transaction_id` already links the files it patched through `bridge_ledger`.
- [ ] **`compacted_view_json` is derived.** A test drops it and rebuilds it from `chat_messages`, and the result matches.
- [x] **Lens contract Sprint 1:** settle invariant 9's OPEN before the contract's first version (settled 2026-11-13).
- [ ] **A fitness rule** that conversation and memory files are never tracked by git. It moves to kiemma with inSetu's adoption.
- Done when: a session can be rebuilt from `chat_messages` alone, and every turn records the state of the repository it saw.

### Sprint 1: The conversation tree as a lens provider (after 1.0)

- [ ] `msg://` on the lens contract (already listed in lens contract Sprint 2), with time-based tiers above `compacted_view_json`.
- [ ] `outline_root` bounded per invariant 9.
- [ ] `QUERY_CONTEXT` recall of any message at `full`, unchanged from Sprint A1.
- Done when: a session of ten thousand turns opens with a bounded top level, and any turn can be promoted to `full`.

### Sprint 2: Memory leaves and concept stacks in md-db (after P20)

- [ ] Memory leaves as md-db records in their own scope, with `derived_from` edges to messages and the point-in-time references from invariant 3.
- [ ] Concepts as `ur:` records; supersession as an `md_edges` relation; `HEAD` by default, the stack through `diff`.
- [ ] Add, edit and delete through the md-db record editor; a delete purges per invariant 4.
- Done when: a person can see, correct and delete every memory, and a deleted memory leaves no trace in any summary.

### Sprint 3: Consolidation and the derived tree

- [ ] **The consolidation routine:**
  - Extraction over new turns with `map_over`.
  - Concept matching.
  - Supersession.
  - Insertion into the root bucket.
  - It runs under a standing contract: non-code writes through Yomama, nothing executable.
- [ ] **The derived tree, in its own tables:**
  - Ratchet at `K`.
  - Context-seeded rebucketing (pointers first, summaries second).
  - Two payloads per category.
  - Dirty-path rollup from child slices only.
  - All of it on the lens contract's categories mechanism ("Categories", 2026-11-13): same-level splits, changes that bubble up and stop early, the drift counter. Memory's grouping is clustering, and the contract's bounds play the role of the ratchet at `K`.
- [ ] **Property tests:**
  - Rebuild equivalence.
  - No leaf lost or duplicated by a rebucket.
  - Untouched branches keep their hashes.
  - A purge clears its ancestor path.
- Done when: consolidation can be stopped, wiped and rerun from the ledger with the same leaves in the tree.

### Sprint 4: Fast-path retrieval

- [ ] A retrieval routine: the decision tier names the scopes and a jump budget; the routine pins each scope's top level and opens branches within the budget.
- [ ] Memory items appear in the working set and the Context Budget HUD like any other artifact, with their lens and tokens.
- [ ] **Performance tier:** `outline_root` stays within budget at 10^2, 10^4 and 10^6 records.
- Done when: a turn's memory context stays under its budget at every scale, and the trace shows which branches were opened and why.

## What this plan does not do

- **No dense vectors first.** The proximity model's rule is SQLite and AST first, dense vectors last.
- **No memory in `governance`,** and no memory that acts as a directive.
- **No sharing across workspaces or people.** One insetu per tenant holds here too.

## Open questions

- **OPEN:** its own `mem://` scheme, or md-db records? (Invariant 2.)
- **OPEN:** does deleting a message purge the memory derived only from it? (Invariant 4.)
- Decided 2026-11-13: `outline_root` is bounded in the lens contract's first version (invariant 9).
- **OPEN:** should consolidation's writes wait for a person's approval until the routine has earned trust? This is the agent plan's open question on standing contracts, applied to memory.
- **OPEN:** user-tier memory follows the person across workspaces, workspace memory stays put. Is that the split you want, and does any memory belong to a repository?
- **OPEN:** a roadmap number, or leave it unplaced until the agent loop ships?
