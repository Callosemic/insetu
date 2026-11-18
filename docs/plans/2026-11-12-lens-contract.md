---
title: "Plan: The Lens Contract"
description: "One contract for putting any addressable resource into a model's context at a chosen level of detail: lenses, addresses, distance bands, promotion and token accounting. Code is the first provider; the contract must hold for domains that are not code."
status: "draft"
created: "2026-11-12"
roadmap: "P25"
models:
  - "vfs://insetu/docs/models/agent_orchestrator_and_rag.md"
---

# Plan: The Lens Contract

Draft by Claude, 2026-11-12. Questions marked **OPEN** are yours to answer.

## Why

Section 8 of the orchestrator model describes lenses scheme by scheme, but each scheme implements them its own way, and the working set tracks lens state in more than one place. The routine engine also has a second consumer outside code that needs the same mechanism for structured documents: for example, a device configuration of numbered banks whose entries point at each other, where an edit to one bank needs its referenced banks in view but not the other hundred. Writing the contract once, before agent plan Sprint 1 hardens the envelope, keeps it one mechanism.

## The contract

A **lens provider** owns a URI scheme, or a document type within one, and answers four calls. All are synchronous, read-only and free of network I/O nobody asked for.

| Call | Takes | Returns |
| --- | --- | --- |
| `project` | uri, lens, params | a projection (below) |
| `neighbours` | seed URIs, basis, max depth | ranked `(uri, distance, basis, reason)` tuples |
| `outline_root` | a scope and a token budget | the scope's overview as the finest whole outline level that fits: one line per element, each a leaf or an expandable group |
| `resolve` | words or a partial address ("bank 1, switch A") | candidate URIs, ranked |

A projection is `{uri, lens, served_lens, text, tokens, sha256, truncated}`. `served_lens` may be lower than the lens asked for when the full projection would break its budget; the envelope records what was actually sent, never what was asked.

## Lenses

Five, from most to least detail. Every provider serves `full` and `outline`; a lens a provider lacks falls back to the next lower one it serves.

| Lens | What it is | Typical use |
| --- | --- | --- |
| `full` | The resource itself, enough to edit it | Edit targets, healing |
| `diff` | A change between two named states (`base..target`) | Review, turn deltas |
| `slice` | What others need to know: names, signatures, references in and out, no bodies | One hop from a target |
| `outline` | One line per element: a name, a count and a few words | Orientation, the perimeter |
| `genesis` | A target that does not exist yet | New files and records |

## Addresses

Every unit a model might read or edit has a stable URI, finer than a file when the domain needs it: a symbol, a heading span, an entry inside a structured document. Stable means the same item keeps the same URI across revisions. Array positions and line numbers are never addresses.

Lenses are read-only. Writes go through the domain's verify-and-stage path (Yomama for code). A provider's addresses must be ones that path accepts, so a model can read at an address and patch at the same address.

## The outline root (decided 2026-11-13)

- **An outline is always an outline.** `outline_root` serves only the `outline` lens, the blurriest lens: the best whole fit for the budget. It never substitutes a `slice`. A slice may accompany an outline in the same context, but never replaces it.
- **Every line is a name, a count and a few words.** One line is one element: a leaf (a symbol, a record, a message) or a group (a file, a category, a bank, a session) with its count of children and roughly how many tokens sit behind it, expandable through `neighbours` on the containment basis. Nothing longer: a line that grows into an interface has become a slice.
- **Levels are whole, finest first.** A provider declares its outline levels from finest to coarsest and serves the finest level that fits whole. It never opens part of a level, so the same scope and budget always give the same outline.
- **For code, three levels:** `CODE_INDEX.md` (symbols, a few words each) if it fits; else the file tree (files with counts); else categories, as soon as the files do not fit. There is no directory-depth level in between: folders carry meaning only when people keep them disciplined, so categories group by what the code is for.
- **Fit is measured in tokens**, with the envelope's estimator; lines are the unit of expansion, not of measure.
- **The budget is fixed for the run:** 5% of the input token limit of the model the run uses (about 10k tokens for a 200k model), or of the smallest limit when a routine uses several models. The envelope sets it when the run starts and keeps it in the run state, so a resumed run gets the same outline and the outline does not change shape between turns (which would also defeat prompt caching). The 5% is configuration, not code.
- **When even the coarsest level does not fit**, the provider returns as many top-level lines as fit, plus one line saying how many more there are, and sets `truncated`.
- **The root has no focus.** It is the same overview whatever the edit targets are. Detail around a target comes from distance bands and `neighbours`, which are envelope policy.
- **Grouping is the provider's business:** symbols, files and categories for code; time for conversations; containment for structured documents; clustering for memory. A provider whose finest level fits returns every leaf.

## Categories (decided 2026-11-13)

Categories are a derived tree over a provider's leaves; for code, categories above files above symbols. One engine mechanism keeps the tree for any provider. Code's categories are its first user, and the memory plan's derived tree (its Sprint 3) uses the same mechanism.

- **Same depth everywhere.** Every leaf sits at the same depth, so outline levels stay whole. A node splits at its own level, as in a B-tree: if Y outgrows its bounds under A, it becomes Y and Z, both under A. Only when the root overflows does the tree gain a level, added at the top for every branch at once. Nothing moves down.
- **The root is an ordinary node.** The same bounds decide whether a scope needs categories at all: 40 coherent files need none; 200 files split the root, which adds the first category level.
- **Bounds.** Over about 25 children, a node is checked: one coherent group, or two or more? A coherent group is marked and left alone; otherwise it splits along the seam the check names. Over about 60 it splits anyway, because opening it through `neighbours` would cost more than one expansion should. Under 2 it merges into a sibling. The numbers are configuration.
- **The shape never depends on the model or the budget.** The bounds and change propagation keep the tree; the budget only picks which level `outline_root` serves.
- **Changes bubble up and stop early.** When a leaf changes, a deterministic check comes first: if its text or its description is unchanged, stop. Otherwise each level is asked once whether the change affects its description or its membership, and supplies the change if it does. A "no" ends the walk.
- **One pass per level, batched by parent.** The changed nodes at each level go to their parent in one call, so a commit that touches 20 symbols in one file asks about that file once.
- **Membership.** A new leaf is placed top-down, one question per level, then its parent bubbles up. A deletion bubbles up from its old parent. A move is a deletion plus a placement, so both parents are checked.
- **Drift.** Each node counts the changes since its last full review; after about 5 it is reviewed whole, against its children rather than the latest change.
- **A person's edits win.** A description written by hand is revised only when a change makes it wrong, and the revision is marked, as the cartographer treats `CODE_INDEX.md`.
- **Stored, not re-derived.** The tree is stored with the index and read from there, so the same scope and budget always give the same outline.
- **Deterministic fallback: the folder structure.** With no model available (`deterministic` helper mode, or no API key), categories come from directories. Each category is a directory path, so uneven folder nesting still gives one even level. The levels above are cut from those path categories by the same bounds, grouping by shared prefix, never by raw prefix depth, so every branch stays the same depth. A description is the name, the counts, and the first line of a README or index description where one exists. Splits follow subdirectories only; a directory with no subdirectories that passes the hard bound stays whole and is marked oversized. The tree records whether folders or a model built it. When a model becomes available, rebuilding with it is offered as a notice and happens once, when a person accepts; it never changes silently between turns. If the model later becomes unavailable, the stored tree stays, and new leaves are placed by folder and marked for review.

## Distance and bands

`neighbours` measures distance along a named basis: an AST call graph, co-change, containment, or an edge declared in a schema. Mapping distance to lens is envelope policy, not provider policy: distance 0 gets `full`, 1 gets `slice`, 2 or more gets `outline`, unless a routine says otherwise. Every walk is bounded by its max depth; a provider never returns an unbounded closure.

## Promotion and decay

A model asks for more with `QUERY_CONTEXT`, naming a URI and a lens. The envelope calls `project`, replaces the artifact in place under the same URI, and charges the token difference. Decay over turns is the same call with a lower lens.

## Token accounting

The provider reports `tokens` using the envelope's estimator. The envelope owns the budget and decides what to demote or drop; a provider never drops anything on its own.

## Providers at the start

| Scheme | `full` | `slice` | `outline` | `neighbours` bases |
| --- | --- | --- | --- | --- |
| `vfs://` code | File text | `slice_interface` | `CODE_INDEX.md` line | `ast.call_graph`, `ast.module_imports`, `affinity.co_change` |
| `vfs://` prose, `mddb://` | The record | Frontmatter and heading tree | Coordinate line | Containment, ur-links |
| `msg://` *(including `#telemetry` & `#loop_ledger`)* | Turn dossier (`msg://<msg_id>`): prompt, `__envelope__` working set, DAG `execution_trace`, joined `llm_telemetry` calls, prose + `raw_content`, & `bridge_heal_audit` / test tracebacks | Session overview (`msg://<session_id>`) or turn receipt + structured failure batch (`msg://<msg_id>`) | Summary block (`compacted_view_json`), 1-line turn coordinate, or loop ledger line | Turn age, loop iteration & containment (`session -> turn`) |
| `ctx://telemetry/*` | Full terminal / diagnostic buffer (`terminal_last.txt`) | Tail / structured diagnostic summary | 1-line sensor status coordinate | Recency |

The first provider outside inSetu tests the contract. What it needed goes back into this spec before sarga extraction starts (P25).

## Sprints

### Sprint 1: The contract in code (with agent plan Sprint 1)
- [ ] A `LensProvider` protocol and a registry keyed by scheme and document type.
- [ ] Adapt `vfs://` code and `mddb://` to it.
- [ ] `outline_root(scope, budget)` for `vfs://` code (`CODE_INDEX.md`, then the file tree, then categories) and `mddb://` (containment), serving the finest whole level that fits.
- [ ] The envelope fixes the outline budget at run start (5% of the smallest input token limit among the run's models, from configuration) and stores it in the run state.
- [ ] The envelope's `apply_working_set_delta` stores what `project` returned, including `served_lens` and tokens.
- [ ] **Unify `assemble_context_payload` and `pack_envelope_working_set` inside `context_assemble.py` (`ENVELOPE_ZERO_GATHER_IO_BAN`):** Move `pack_working_set_context` (`pack_envelope_working_set`) and `resolve_query_directives` (`resolve_envelope_query_directives`) out of `envelope.py` into `insetu/core/gather/context_assemble.py`, and route `gather.context.assemble` (`assemble_context_payload`) through `pack_envelope_working_set` so there is one 6-bucket context compiler in `gather/` while `envelope.py` remains a pure, zero-I/O state container.
- Done when: `orchestrator.py` and `envelope.py` import no `gather` or lens implementation directly (`ENVELOPE_ZERO_GATHER_IO_BAN`), and `assemble_context_payload` delegates to `pack_envelope_working_set`.

### Sprint 2: The rest of the schemes
- [ ] `msg://` (including `#telemetry` / `#loop_ledger` sub-selectors) and `ctx://telemetry/*` on the contract (retiring the separate `tel://` scheme):
  - **`MsgLensProvider` (`msg://<session_id>` & `msg://<message_id>`):**
    - [x] Stamp `turn_msg_id` on `llm_telemetry` and `bridge_heal_audit` rows and persist `execution_trace` inside `chat_messages.context_hashes_json["__envelope__"]` on turn pause/completion.
    - [x] `project("msg://<session_id>", "slice")` renders the `00_session_overview.txt` map (`active_plan` progression, tier token/cost ledger, chronological turn index with DAG `execution_trace` trees, working-set deltas, and 1-line LLM call table).
    - [x] `project("msg://<message_id>", "full")` renders the self-contained turn dossier (`turn_<NNN>_<mode>_dossier.txt`: user prompt, pre/post `__envelope__` working-set & plan snapshots, DAG `execution_trace`, scrubbed `llm_telemetry` prompt/response excerpts for all hops, assistant reply + patches, and `bridge_heal_audit` cases).
    - [x] Both `POST bridge/compile_telemetry` (Gather card) and `.zip` session telemetry export pull directly from `MsgLensProvider` projections rather than maintaining a separate formatting pipeline.
- [ ] Budget fallbacks through `served_lens`.
- [ ] A conformance test any provider can run: stable addresses across a revision, bounded `neighbours`, `full` and `outline` always served, tokens reported, and `outline_root` serving only `outline`, as one whole level, identical for the same scope and budget, and within budget at 10^2, 10^4 and 10^6 items.

### Sprint 3: Second-domain review
- [ ] Fold back what the provider outside inSetu needed, then freeze the contract's first version.

## Open questions

- **OPEN:** does `resolve` belong in the contract, or is it a capability a triage step calls? Suggestion: in the contract, because every domain needs words-to-address and only the provider knows its addresses.
- **OPEN:** must `diff` always name both states, or does each scheme have a default (code: `head..live`)?
- **OPEN:** one token estimator for all models, or one per model family?
- Settled 2026-11-13: how categories are formed and kept stable (see "Categories").
