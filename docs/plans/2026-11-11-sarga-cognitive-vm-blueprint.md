---
status: speculative
tier: epic
title: "Sarga: The Standalone Cognitive Virtual Machine & Multi-Profile Runtime"
description: "Architectural blueprint for extracting the declarative Routine DAG engine, 6-Bucket Coeffect Context Algebra, Representational Lenses, and Verification Bouncer into a standalone Ring-1.5 substrate (sarga) sitting between akasa and domain applications."
created_at: 2026-11-11
tags: [plan, speculative, architecture, sarga, akasa, sutram]
---

# Sarga: The Standalone Cognitive Virtual Machine & Multi-Profile Runtime

## 0. Sequencing and Package Decisions (2026-11-12)

Status stays speculative. What is settled:

1. **A separate package**, Apache 2.0, with no `akasa` imports. `akasa` is one host; a cloud service can be another.
2. **Sarga is a spec plus a step engine:** the routine schema, a function that takes a routine and a serializable run state and returns the next state and the nodes now ready, and a conformance suite every host must pass. The host owns the loop, threads, storage and queues.
3. **Two contracts:** downward, a host interface (invoke a capability, persist and reload run state, run nodes in parallel, store oversized payloads); upward, capabilities registered by name. The lens contract (P25) is the first upward contract.
4. **Headless.** Routine Studio and the execution trace UI stay in inSetu.
5. **Starts after two lens providers exist**, so the interface is drawn from two domains, not guessed from one. Until then the work is the agent loop and the lens contract inside inSetu.

**OPEN:** replace the four-method `SargaDomain` protocol (section 3) with reserved capability names (`lens.project`, `verify.stage`, `sensor.run`, `landmarks.resolve`) on the existing capability bus? Suggestion: yes, so there is one mechanism, not two.

## 1. Executive Summary & Architectural Vision

The agent orchestrator and context assembly engine developed inside `inSetu` is not inherently a code-editing tool; software engineering was simply the proving ground used to harden it. Stripped of developer-specific AST and Git plumbing, the core engine is a **Deterministic Cognitive Virtual Machine** that treats LLMs as stateless ALUs slotted inside a compiler-grade operating system.

By extracting this cognitive runtime into a standalone Ring-1.5 layer named **`sarga`** (*Sanskrit:* creation, emission, and the structured cantos/movements of an epic), we establish a strict, four-layer architecture capable of powering both local stateful workbenches (`inSetu`) and stateless multi-tenant cloud services:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Ring 3: Domain Applications & Cartridges                                    │
│  ┌────────────────────────────────────┐  ┌────────────────────────────────┐  │
│  │ inSetu (Developer OS Workbench)    │  │ Downstream Domain Applications │  │
│  │ • Code/AST Lenses (Cartographer)   │  │ • Domain-Specific Ontologies   │  │
│  │ • Yomama Patch Bridge Gate         │  │ • Custom Schema & Rule Gates   │  │
│  │ • Multi-Buffer Editor & Bonsai Git │  │ • Headless API or Sutram UI    │  │
│  └─────────────────┬──────────────────┘  └────────────────┬───────────────┘  │
├────────────────────┼──────────────────────────────────────┼──────────────────┤
│                    ▼         SargaDomain Protocol         ▼                  │
│  Ring 1.5: sarga (The Cognitive Virtual Machine)                             │
│  • Markdown-as-Code (.md) Routine DAG Compiler & Wavefront Scheduler         │
│  • 6-Bucket Coeffect Context Envelope (Volatility-Ordered KV Prefix Cache)   │
│  • Universal Representational Lens Dispatcher (full, slice, outline, diff)   │
│  • Structural Bouncer & Isolated n-1 Healer (Patches, JSON Patch & Fractures)│
│  • Markovian O(1) Convergence Loops, Dual-Track Compaction & LLM/MCP Gateway │
├──────────────────────────────────────────────────────────────────────────────┤
│  Ring 1: akasa (The Pluggable Kernel Substrate — Synchronous Worker Core)    │
│  • VFS Engine, DB Pool, Worker Queue, Hook Bus, Attestations & Auth          │
│  • Pluggable Driver Profiles (Local Stateful vs. Stateless Cloud)            │
└──────────────────────────────────────────────────────────────────────────────┘

```

---

## 2. Core Responsibilities of `sarga` (Domain-Agnostic Cognitive Substrate)

`sarga` interfaces directly with `akasa` (`ExtensionContext`) using 100% synchronous, thread-safe Python primitives (avoiding `async/await` function-coloring infection) and maintains zero coupling to Git, CodeMirror, or language-specific ASTs:

1. **Declarative Routine DAG Engine (`sarga.orchestrator`, `sarga.routine_loader`, `sarga.expressions`):**
* Compiles Markdown-as-Code (`.md`) routines (YAML frontmatter + `## <node_id>` prompt sections) into level-order topological wavefronts.
* Executes `1:N` parallel fan-out (`map_over`, `repeat`) and `N:1` synchronization barriers via `ctx.jobs.map_parallel`.
* Evaluates AST-restricted `when` / `until` conditions and manages 256 KB hybrid memory vaulting (`vault_if_oversized` $\rightarrow$ `ctx.jobs.write_scratch`).
* Enforces Markovian $O(1)$ convergence on `type: loop` nodes, overwriting sensor telemetry in-place and recording 1-line micro-receipts in `meta.loop_ledger` to prevent linear transcript bloat.


2. **The 6-Bucket Coeffect Context Envelope (`sarga.envelope`):**
* Models working-set state via `RoutineEnvelope` and `ContextArtifact(uri, bucket, lens, source, idle_turns, tokens)` across 6 volatility-ordered buckets:
`governance` $\rightarrow$ `hierarchy` $\rightarrow$ `meta` $\rightarrow$ `data` $\rightarrow$ `telemetry` $\rightarrow$ `prompt`.
* Enforces 5-turn working-set TTL decay (`full` $\rightarrow$ `slice` $\rightarrow$ eviction) while protecting `user_pinned` artifacts.
* Guarantees **Transport Isomorphism**: automated cloud APIs, local inference endpoints, CLI tools, and manual `web_chat` copy-paste handoffs (with content-addressed `sent_hashes` Same-Window Delta packing) share the exact same execution contract.


3. **Universal Schema Bouncer, TypeScript Distiller & $n-1$ Fracture Healer (`sarga.schemas`, `sarga.bouncer`):**
* **TypeScript Interface Distillation:** Compiles formal data models (Pydantic / TypedDict) into compact TypeScript `interface` definitions for prompt injection (~65% token reduction compared to raw JSON Schema).
* **Localized Fracture State Extraction:** When structured validation fails, ascends the validation error path to isolate only the broken subtree ($\le 1,500$ chars) and dispatches an isolated fast-tier $n-1$ repair pass (via RFC 6902 JSON Patch or block diff) without polluting the primary reasoning transcript.


4. **Two-Axis `md-db` & Watermarked History Compaction (`sarga.mddb`, `sarga.history`):**
* Indexes Markdown documents along the Containment Axis (`Folder` $\rightarrow$ `Record` $\rightarrow$ `## Heading Span`) and Archetype Axis (`Ur-Records`).
* Maintains watermarked Hot/Warm/Cold session transcript compaction with addressable `msg://<id>` recall via `<<<<<<< QUERY_CONTEXT`.


5. **Universal LLM & MCP Gateway (`sarga.llm`, `sarga.mcp`):**
* Manages the compute endpoint pool, semantic cognitive tiers (`decision`, `fast`, `standard`, `thinking`, `frontier`), per-call cost telemetry, and MCP 2025-03-26 JSON-RPC 2.0 server exposure.



---

## 3. The Upward `SargaDomain` Adapter Protocol

Host applications plug into `sarga` by registering a `SargaDomain` implementation with four standardized contracts:

1. **`project_lens(ctx, uri, lens, **params) -> ProjectedArtifact`:**
* Projects a domain URI into `full`, `slice` (interface/summary), `outline` (structural table of contents), `diff` (state delta), or `genesis` (uncreated target scaffold).
* *In `inSetu`:* Routes `vfs://` source files through `cartographer` (`outline` subtree of `CODE_INDEX.md`), `languages` (`slice` AST declarations), and `bonsai` (`diff`).


2. **`verify_and_stage(ctx, hypothesis, envelope) -> VerificationResult`:**
* Evaluates untrusted LLM outputs inside an in-memory staging transaction before any physical commit, returning structured diagnostics for $n-1$ self-healing if verification fails.
* *In `inSetu`:* The Yomama Bridge (`BridgeWorkingTree` in-memory patch application + Tree-Sitter syntax bouncer + staged patch stacks).


3. **`run_sensor(ctx, scope, targets) -> SensorDiagnostic`:**
* Executes deterministic domain verification gates (unit tests, linters, or round-trip parity checks) and formats failures for the `telemetry` bucket.
* *In `inSetu`:* `bridge.test` (JUnit XML + failure tail slicer).


4. **`resolve_landmarks(ctx, scope) -> Dict[str, Any]`:**
* Resolves domain-level governance documents, active directives, and structural landmarks for the `governance` and `sys` namespaces.
* *In `inSetu`:* Repository landmarks, `01_engineering_standards.md` constitution files, and 4-tier `agent.md` directives.



---

## 4. Impact on `inSetu` Core Modules

Extracting `sarga` leaves `insetu/core` as a clean, focused Software Engineering Workbench and `SargaDomain` provider:

* **`fs` & `editor`:** Remain 100% in `insetu/core`, interfacing directly with `akasa`'s VFS for multi-buffer editing, 3-way OCC merges, and spatial grid projections.
* **`bridge`:** Remains in `insetu/core` as the standalone Yomama Sync Bridge and registers as `inSetu`'s `SargaDomain.verify_and_stage` and `run_sensor` provider.
* **`gather`:** Splits cleanly—`engine_gather.py` and `gather.js` remain in `insetu/core` for workspace bucket compilation, while generic context algebra (`RoutineEnvelope`, lens dispatching, `QUERY_CONTEXT`, and Hebbian affinity) moves to `sarga`.
* **`agent`, `llm`, `mcp`:** The generic DAG orchestrator, envelope state machine, LLM tier router, MCP gateway, Routine Studio, and Execution Trace UI move to `sarga`, leaving a lightweight `InSetuSargaAdapter` and the built-in software engineering routine pack (`code.md`, `plan.md`, `ask.md`, `yomama.md`, `test.md`, `upkeep.md`, `debt_ratchet.md`) in `insetu/core/agent`.

---

## 5. Synchronous Multi-Profile Execution in `akasa`

To support both local single-daemon deployments and stateless horizontal cloud deployments without introducing `async/await` viral complexity:

* All `akasa`, `sarga`, and `SargaDomain` methods execute as standard synchronous Python functions on bounded worker threads.
* `akasa` abstracts storage (`ctx.vfs`, `ctx.db`), secret vaulting (`ctx.secrets`), and parallel job fan-out (`ctx.jobs.map_parallel`, `ctx.jobs.submit`) behind pluggable driver profiles—allowing the exact same `sarga` routines and domain adapters to run against local SQLite/disk in development and distributed cloud storage/queues in production.
