---
title: "Brainstorm: Closing Four SOTA Agentic Frontiers on inSetu's Unified Primitives"
description: "High-leverage designs for dynamic stack-trace proximity filters, deterministic Best-of-N patch tournaments, sub-turn streaming probe interception, and closed-loop preview/DOM telemetry."
repo: insetu
domain: "Core Architecture"
status: brainstorm
created_at: 2026-11-09T05:00:00
tags: [brainstorm, agent, orchestrator, rag, proximity-filters, tournament, streaming, preview, telemetry]
models:
  - docs/models/agent_orchestrator_and_rag.md
  - docs/models/proximity_filters_and_domain_jumps.md
  - docs/models/yomama_bridge.md
---

# Brainstorm: Closing Four SOTA Agentic Frontiers on `inSetu`'s Unified Primitives

## 1. Context & Design Philosophy

Large commercial agent teams (Cursor, Cognition/Devin, SWE-agent, OpenHands) invest heavily in five frontier capabilities:
1. **Runtime Execution Trace Grounding** (slicing the exact call stack of a crash into context).
2. **Speculative Branching / Best-of-$N$ Tournaments** (generating multiple candidate patches in parallel and selecting the winner via deterministic verification gates).
3. **Sub-Turn Streaming Tool Interception** (halting LLM generation mid-stream the instant an epistemic probe block closes).
4. **Closed-Loop Visual & Runtime DOM Telemetry** (feeding live browser console/page errors and rendered component state back into UI repair turns).
5. *Custom RL-trained fast-apply models & cloud VM fleets* (deliberately skipped by `inSetu`: deterministic `bridge_fuzzy.py` + `bridge_ast.py` + 1-call `n-1` healing + `child_env('repo_code')` process isolation achieve equivalent reliability locally at zero DevOps/training cost).

Because `inSetu` already possesses a narrow waist of universal primitives—the **6 Volatility-Ordered Context Buckets**, **Foveated Representational Lenses (`full`, `diff`, `slice`, `outline`)**, **Proximity Filters & Domain Jumps**, **Fork-Join `holding` Confinement**, and the **Yomama Sync Bridge**—all four valuable SOTA capabilities can be implemented not as new standalone subsystems, but as **thin parameterizations (~50–100 lines each) of existing engines**.

---

## 2. Frontier 1: Dynamic Stack-Trace Proximity (`basis: telemetry.stack_trace`)

### 2.1 The Gap
When `bridge.test` (or a runtime panic) records a failure in `telemetry`, static AST call graphs only know what *could* be called, whereas the traceback in `telemetry.test_diagnostics` knows the **exact dynamic execution path (`Frame_0 -> Frame_1 -> ... -> Frame_Crash`)** that failed at runtime. Passing raw traceback text alone forces the LLM to guess the implementation of intermediate helper frames that are not currently mounted in `data`.

### 2.2 Unification with Proximity Filters
Treat a runtime stack trace in `telemetry` as a **Directed Execution-Path Basis (`basis: telemetry.stack_trace`)** inside the Proximity Filter algebra (`docs/models/proximity_filters_and_domain_jumps.md`):

* **Seed ($S_0$):** Active failure diagnostics in `telemetry.test_diagnostics` (Python `Traceback (most recent call last):` frames, Node.js `at fn (file:///...:line:col)` frames, and Rust `panicked at` backtraces).
* **Frame Extraction & Canonicalization:**
  - A deterministic 40-line parser extracts ordered `(vfs_uri, line_no, symbol_name)` tuples from `telemetry`, clamping out external stdlib/site-packages frames and resolving `/static/extensions/...` URLs to their canonical `vfs://<repo>/...` paths and `URI#symbol` nodes.
* **Reverse-Frame Distance & Foveated Lens Schedule:**
  - Distance $d$ is measured **backward from the innermost crash site (`d = 0`) up toward the test entry point (`d = k`)**:
    - **`d = 0` (Innermost Crash Frame & Failing Test Method):** Mounted into `data` at **`full`** lens (or `slice_interface(..., requested_symbols=[crash_symbol])` for large files).
    - **`d = 1..2` (Intermediate Caller Frames in the Stack):** Mounted into `data` at **`slice`** lens (`requested_symbols=[frame_symbol]`), exposing the exact intermediate function bodies and signatures that passed bad state into the crash frame.
    - **`d >= 3` (Outer Harness Frames):** Mounted at **`outline`** lens.

```yaml
# Declarative usage inside a test-healing loop (type: loop)
- id: enrich_from_traceback
  type: exec
  capability: rag.apply_proximity
  reads: [telemetry, data]
  writes: data
  payload:
    filters:
      - basis: telemetry.stack_trace
        depth: 3
        lenses:
          0: full      # Innermost crash symbol + failing test method
          1: slice     # 1-2 frames above the crash
          2: slice
          3: outline
```

---

## 3. Frontier 2: Deterministic Best-of-$N$ Verification Tournaments (`reduce_by: bridge_verify`)

### 3.1 The Gap
On complex multi-file edits or subtle bug fixes, a single LLM generation can occasionally hallucinate an anchor, violate a fitness rule (`rules_python.py` / `rules_javascript.py`), or break an edge-case assertion. Commercial SOTA harnesses run 2–3 parallel candidates in separate sandboxes and pick the passing branch.

`inSetu` *already* has:
1. `repeat: N` ensemble execution and `1 -> N` parallel wavefront fan-out writing isolated candidate outputs into `holding[0 .. N-1]` (`docs/models/agent_orchestrator_and_rag.md` §3).
2. Pure in-memory transactional evaluation via `process_sync_transaction(vfs, workspace_id, data={"text": candidate_i, "dry_run": True}, return_buffers=True)` (`bridge_vfs.py`), which checks anchor resolution, AST syntax, and import-time forward references in `< 5ms` without touching disk!

Currently, however, reducing `holding[0 .. N-1]` requires another `llm` node to read all $N$ texts and synthesize a response.

### 3.2 Unification with Fork-Join `holding` & `bridge.sync`
Add a deterministic `type: exec` tournament reducer (`capability: bridge.tournament_select` / `reduce_by: bridge_verify`) that sits at the `N -> 1` convergence sink after a parallel fan-out or `repeat: N` node:

1. **Stage 1 — Zero-Disk In-Memory Gate (`< 15ms` for all $N$ candidates):**
   - For each candidate $i \in [0 \dots N-1]$ in `holding`, run `process_sync_transaction(..., dry_run=True, return_buffers=True)` in memory plus in-memory AST fitness visitors (`BackendFitnessVisitor` on modified buffers).
   - Score each candidate tuple:
     $$\text{Score}_{\text{static}}(i) = \bigl(\text{can\_commit}_i,\; -\text{failed\_patches}_i,\; -\text{fitness\_violations}_i,\; -\text{rebased\_overlaps}_i\bigr)$$
2. **Stage 2 — Optional Live Test Tie-Breaker (`run_tests: true`):**
   - If multiple candidates pass Stage 1 (or if `run_tests: true` is declared), evaluate the top Stage-1 candidates sequentially (or in ephemeral worktree snapshots) against `bridge.test` scoped to the scouted unit tests, selecting the first candidate that achieves `exit_code == 0`.
3. **Zero-LLM Short-Circuit:**
   - If a candidate passes with `can_commit == True` and `exit_code == 0`, the tournament reducer commits that candidate directly to `data` / disk and **skips the downstream LLM synthesis/healing step completely** (0 extra tokens).
   - If all $N$ candidates have partial failures, the reducer selects the highest-scoring candidate (e.g., 4/5 patches resolved vs. 2/5) and pipes only its single failed cell into the self-contained `n-1` healer!

---

## 4. Frontier 3: Sub-Turn Streaming Probe Interception (`stream_stop_on_probe`)

### 4.1 The Gap
Section 10 of `docs/models/agent_orchestrator_and_rag.md` defines in-node epistemic probes (`<<<<<<< QUERY_CONTEXT` and `<<<<<<< CALL_CAPABILITY`). When an API or local model emits a `QUERY_CONTEXT` block at token 150 of its response, without stream interception the model continues generating 1,500 tokens of speculative prose or guesswork patches *before* the stream finishes and the orchestrator can execute the probe and re-evaluate the node.

### 4.2 Unification with `llm_drivers.py` SSE Streaming
In `insetu/core/llm/llm_drivers.py` (`run_single_inference` and the SSE stream loops for `anthropic`, `gemini`, and `openai_compatible`), add a lightweight state-machine watcher over the accumulating response buffer when `max_probes > 0` on the active node:

1. **Streaming Fence Detector:**
   - Track whether the stream has entered a `<<<<<<< QUERY_CONTEXT` or `<<<<<<< CALL_CAPABILITY` block.
   - The instant the closing `>>>>>>> EXECUTE` line is received (and no open `<<<<<<<` block remains), if `stop_on_probe=True`:
     - **Close/abort the HTTP SSE stream immediately.**
     - Return `(accumulated_text, usage_metadata)` to the orchestrator with `interrupted_by_probe: True`.
2. **Immediate Bucket Promotion & Re-Inference:**
   - The orchestrator executes the `QUERY_CONTEXT` / `CALL_CAPABILITY` directive in-process (`< 10ms`), promotes the requested file/symbol lens in `data` (or records capability output in `telemetry`), and immediately starts Pass 2 with the real file in context—saving 70–90% of wasted tail output tokens and cutting probe latency in half.
3. **`web_chat` Parity Preserved:**
   - Because the wire syntax (`<<<<<<< QUERY_CONTEXT ... >>>>>>> EXECUTE`) is identical, automated drivers simply gain early-stop speed while manual `web_chat` handoffs continue to work identically.

---

## 5. Frontier 4: Closed-Loop Preview & DOM Telemetry (`render` Lens & Runtime Console Sensor)

### 5.1 The Gap
When modifying frontend Lit components (`insetu/core/**/*.js`, `sutram/sutram/js/*.js`), static linters (`rules_javascript.py` and `sutram_consumer_linter.py`) catch contract violations at rest, and Node's `js_loader.mjs` tests pure state logic. However, visual layout regressions, Shadow DOM slot mismatches, or runtime browser console errors (`Uncaught TypeError` during `firstUpdated()` or `render()`) only manifest when the component mounts in a real browser DOM.

### 5.2 Unification with the `telemetry` Bucket, `ext_preview`, and the `render` Lens
Rather than building a separate browser-agent harness, wire `ext_preview` and Playwright (already an optional whitelisted dependency in `insetu/extensions/research/engine_research.py`!) as a standard **`type: exec` sensor** and **`render` Lens Provider**:

1. **Client-Side Runtime Error Ring Buffer (`telemetry.ui_errors`):**
   - A tiny 20-line listener in `system.js` (`window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)`) records the last 20 uncaught frontend exceptions and Lit lifecycle errors in memory (and exposes them to the backend on `/api/<ws>/system/ui_telemetry` or via WebSocket/SSE).
   - Whenever an agent turn targets `.js` / `.css` / `.html` files, the orchestrator can project any recent runtime UI exceptions directly into the **`telemetry`** bucket alongside `stack_trace` proximity slicing!
2. **Headless Probe Capability (`preview.probe_dom` -> `telemetry` & `render` Lens):**
   - Expose a deterministic capability `preview.probe_dom` (or `lens: render`) that navigates headless Chromium to a target route (e.g., `/#/<ws>/center/fs:files` or an extension preview URL managed by `ext_preview`), waits for `window.BOOT_COMPLETE`, and captures:
     - **Console & Page Exceptions** $\rightarrow$ Written into `telemetry.browser_diagnostics` (with `exit_code != 0` if any uncaught exception fired during mount).
     - **Computed Shadow DOM Accessibility/Layout Tree (or Viewport PNG)** $\rightarrow$ Mounted into `data` under the **`render`** lens (`vfs://...#render`).
3. **Composable in UI Routines (`/code`, `/test`):**
   - When `edit_targets` include frontend `.js` components, `/test` can run `js_loader.mjs` unit tests + `sutram_consumer_linter` + optional `preview.probe_dom`, giving the healing loop closed-loop visibility into live DOM rendering and runtime console errors.

---

## 6. Implementation Sizing & Sequencing (Post-1.0)

Every one of these four upgrades stays small enough for one person to maintain (zero new daemons, zero new databases, `< 100` lines per feature):

| Frontier Upgrade | Target Module(s) | Est. Lines | Prerequisite |
| :--- | :--- | :--- | :--- |
| **1. `basis: telemetry.stack_trace`** | `insetu/core/gather/rag_proximity.py` (or `context_assemble.py`) | ~60 LOC | Six-Bucket Sprint 2/3 |
| **2. `reduce_by: bridge_verify` Tournament** | `insetu/core/agent/orchestrator.py` & `bridge_vfs.py` | ~75 LOC | Six-Bucket Sprint 1 (`holding` buffer) |
| **3. Streaming Probe Interception** | `insetu/core/llm/llm_drivers.py` | ~35 LOC | Six-Bucket Sprint 4 (`QUERY_CONTEXT`) |
| **4. Runtime UI Error & `render` Sensor** | `insetu/core/system/system.js` & `engine_preview.py` | ~90 LOC | Optional after Six-Bucket Sprint 4 |
