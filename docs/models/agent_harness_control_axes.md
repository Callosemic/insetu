---
title: "Appendix: The 6 Axes of Harness Control & v2 Extension Roadmap"
description: "Mapping the 6 theoretical harness control axes onto inSetu invariants, plus bleeding-edge v2 architectural extensions."
domain: "Core Architecture"
tags: [mental-model, agent, harness, control-axes, roadmap, invariants]
---

# Appendix: The 6 Axes of Harness Control & v2 Extension Roadmap

This appendix maps the six foundational control axes of AI agent harness engineering onto `inSetu`'s runtime invariants, followed by six bleeding-edge extensions designed to layer cleanly onto existing abstractions in future iterations.

---

## 1. The 6 Harness Control Axes Mapped to `inSetu`

| Control Axis | Core Question & Failure Mode Prevented | How `inSetu` Implements It |
| :--- | :--- | :--- |
| **1. Epistemic** *(Knowledge & Truth)* | *What is true, and how certain are we?*<br>Prevents hallucination, false confidence, and stale assumptions. | **6 Volatility-Ordered Buckets + Deterministic Sensors.** LLM outputs are treated strictly as hypotheses until ratified by `topology_ledger`, `bridge.sync` (AST/anchor gates), and `bridge.test`. `QUERY_CONTEXT` forces agents to promote `outline` $\rightarrow$ `slice` $\rightarrow$ `full` instead of guessing, while self-contained `n-1` patch healers isolate syntax and anchor failures. |
| **2. Scope** *(Boundaries & Permissions)* | *Where can it act, and what can it touch?*<br>Prevents unauthorized mutations, blast-radius expansion, and cross-repo bleed. | **Coeffect Masks (`reads`/`writes`) + Read-Only `vfs://` + `pinned_repos`.** Nodes declare explicit bucket read/write permissions. `vfs://` is read-only during routine evaluation, funneling all mutations through `bridge.sync` with `snapshot_sha256` collision guards, while `ROUTINE_BANNED_CAPABILITIES` enforces hard Tier-0 ceilings. |
| **3. Autonomy / Initiative** *(Agency & Escalation)* | *When should it act vs. ask vs. yield?*<br>Balances autonomous execution against human checkpoints. | **2-Tier Escalation (`clarifications` vs. `ASK_USER`) + `/yolo` Policies.** Fast scouts never block—they pick conservative defaults and emit 1-click scope-flip pills (`plan_tasks.clarifications`). Thinking nodes pause via `ASK_USER` cards only for genuine architectural trade-offs, while `/yolo` bypasses manual staging gates when deterministic tests pass. |
| **4. Temporal / Horizon** *(Time, State & Memory)* | *How long does state persist, and when does it reset?*<br>Prevents context rot, infinite retry loops, and tangled undo states. | **Foveated Lens Decay + Markovian $O(1)$ Loops + Cognitive Rewind.** Working-set files decay over turns (`full` $\rightarrow$ `slice` $\rightarrow$ `outline`). Loops overwrite `telemetry` in-place and maintain a 1-line `meta.loop_ledger` ($O(1)$ token usage) with stagnation circuit breakers. Chat nodes act as cognitive restore points orthogonal to physical disk state (`bridge_ledger`). |
| **5. Resource / Economic** *(Compute, Latency & Cost)* | *How much compute, latency, and budget can this spend?*<br>Prevents KV-cache misses, context overflow, and runaway spend. | **KV-Cache Ordering + Two-Level Budgeting.** Ordering buckets from static (`governance`) to per-node (`prompt`) maximizes prefix cache hits. A 75% per-call mechanical threshold triggers automatic lens step-downs (`full` $\rightarrow$ `slice` $\rightarrow$ `outline`), paired with a ratcheting session spend watermark ($X_{\text{new}} = X_{\text{old}} + Y$). |
| **6. Multi-Agent / Topological** *(Coordination)* | *Who owns what state, and how do branches hand off?*<br>Prevents parallel race conditions, context pollution, and shared blind spots. | **Fork-Join `holding[B_i]` Confinement.** During `1 -> N` and `map_over` wavefronts, the 6 main buckets freeze as a read-only snapshot. Parallel branches write strictly to isolated `holding[B_i]` slots, and only the `N -> 1` reduce barrier regains exclusive write authority to commit mutations back. |

---

## 2. Bleeding-Edge Harness Extensions (v2 Roadmap)

None of these capabilities require altering `inSetu`'s foundational invariants; each plugs directly into existing envelope, lens, or ledger contracts:

1. **Programmatic Tool Composition (Code-as-Action — Post-S5 Sandbox):**
   - **Concept:** Allow an `llm` node to execute a short, ephemeral read-only Python/Pyodide or AST-query script inside a strictly contained sandbox (no secrets, no network, read-only VFS snapshot) to chain multiple read probes, filter massive log outputs, or traverse ASTs in a single turn—returning only the distilled summary to context.
   - **Integration Seam:** Complements declarative `QUERY_CONTEXT` and `CALL_CAPABILITY` probes (`max_probes: 2`) for high-fanout data gathering without multi-turn inference round-trips.

2. **Speculative Parallel Execution & Best-of-N Tournament Selection:**
   - **Concept:** Spawn $K$ competing parallel branches with distinct hypotheses on difficult bugs, evaluate deterministic test suites across all $K$ concurrently, and select or synthesize the winning diff.
   - **Integration Seam:** Extends `holding[B_i]` fork-join confinement by adding a competitive `race` / `tournament` reduce policy alongside the standard `merge` reduce policy.

3. **Cross-Session Procedural Memory & Skill Crystallization:**
   - **Concept:** Automatically extract verified `(trigger_symptom -> fix_pattern)` lessons from successful healing loops and persist them as retrievable playbooks across sessions.
   - **Integration Seam:** Complements `affinity_edges` (which record *which* files co-change) by storing *why* a non-obvious repository workaround succeeded as `md-db` records (`ext:skills` / `ext:memory`) mounted into `Bucket 3: meta` or `Bucket 4: data` via `affinity.conditioning` (respecting the Memory Governance Firewall: machine-extracted memory never enters `Bucket 1: governance` without S8 human attestation).

4. **Adversarial / Context-Stripped Critic Isolation:**
   - **Concept:** Execute post-patch review and audit nodes in a clean context window stripped of the generator's conversation history and reasoning trace so the model cannot rationalize its own subtle defects.
   - **Integration Seam:** Enforced declaratively via bucket masking (`use_history: false`, `reads: [governance, meta.active_plan, data, telemetry, prompt]`, explicitly excluding `meta.history` conversational rationalizations on `/audit` and P18 independent review nodes) over `diff:head..live` / `diff:head..virtual`.

5. **Live Runtime & Visual Introspection Loops:**
   - **Concept:** Attach live browser console/network traces and pre/post visual diffs into `telemetry` so UI tasks are verified visually rather than relying solely on static checks and unit test exit codes.
   - **Integration Seam:** Pairs the existing `lens: "render"` provider with an automated pre/post visual-diff sensor in `Bucket 5: telemetry`.

6. **Closed-Loop Telemetry Replay & Automated Harness Optimization:**
   - **Concept:** Replay historical turn dossiers offline to measure scout recall misses, probe bottlenecks, and loop stagnation rates, using those traces to tune RRF weights and prompt projections.
   - **Integration Seam:** Uses existing `msg://<message_id>` turn dossiers (which already capture pre/post `__envelope__` snapshots and `turn_msg_id` telemetry) as a deterministic evaluation dataset.
