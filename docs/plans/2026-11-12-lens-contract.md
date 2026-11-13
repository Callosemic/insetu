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
| `outline_root` | a scope | every addressable item in the scope, one line each |
| `resolve` | words or a partial address ("bank 1, switch A") | candidate URIs, ranked |

A projection is `{uri, lens, served_lens, text, tokens, sha256, truncated}`. `served_lens` may be lower than the lens asked for when the full projection would break its budget; the envelope records what was actually sent, never what was asked.

## Lenses

Five, from most to least detail. Every provider serves `full` and `outline`; a lens a provider lacks falls back to the next lower one it serves.

| Lens | What it is | Typical use |
| --- | --- | --- |
| `full` | The resource itself, enough to edit it | Edit targets, healing |
| `diff` | A change between two named states (`base..target`) | Review, turn deltas |
| `slice` | What others need to know: names, signatures, references in and out, no bodies | One hop from a target |
| `outline` | One line per addressable item | Orientation, the perimeter |
| `genesis` | A target that does not exist yet | New files and records |

## Addresses

Every unit a model might read or edit has a stable URI, finer than a file when the domain needs it: a symbol, a heading span, an entry inside a structured document. Stable means the same item keeps the same URI across revisions. Array positions and line numbers are never addresses.

Lenses are read-only. Writes go through the domain's verify-and-stage path (Yomama for code). A provider's addresses must be ones that path accepts, so a model can read at an address and patch at the same address.

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
| `msg://` | The message | Turn receipt | Summary block | Turn age |
| `tel://` | Full traceback | Failure batch | Loop ledger line | Loop iteration |

The first provider outside inSetu tests the contract. What it needed goes back into this spec before sarga extraction starts (P25).

## Sprints

### Sprint 1: The contract in code (with agent plan Sprint 1)
- [ ] A `LensProvider` protocol and a registry keyed by scheme and document type.
- [ ] Adapt `vfs://` code and `mddb://` to it.
- [ ] The envelope's `apply_working_set_delta` stores what `project` returned, including `served_lens` and tokens.
- Done when: `orchestrator.py` and `envelope.py` import no lens implementation directly.

### Sprint 2: The rest of the schemes
- [ ] `msg://` and `tel://` on the contract.
- [ ] Budget fallbacks through `served_lens`.
- [ ] A conformance test any provider can run: stable addresses across a revision, bounded `neighbours`, `full` and `outline` always served, tokens reported.

### Sprint 3: Second-domain review
- [ ] Fold back what the provider outside inSetu needed, then freeze the contract's first version.

## Open questions

- **OPEN:** does `resolve` belong in the contract, or is it a capability a triage step calls? Suggestion: in the contract, because every domain needs words-to-address and only the provider knows its addresses.
- **OPEN:** must `diff` always name both states, or does each scheme have a default (code: `head..live`)?
- **OPEN:** one token estimator for all models, or one per model family?
