---
tier: "sprint"
title: "Plan: Test Suite Legitimacy — Deadlock Timeouts, Worker Quiescence, DAG Execution Assertions & Targeted Mutation Gates"
description: "Hardens the inSetu unit and fitness test harness against silent worker deadlocks, cross-test thread/SQLite bleed, skipped-node false positives, and weak assertions in core state engines. Adds branch coverage floors and makes the mutation harness reusable by other repositories."
repo: insetu
domain: "Verification & Quality"
status: proposed
created_at: 2026-11-11T06:48:00
tags: [testing, verification, quiescence, mutation-testing, deadlock-defense, fitness]
models:
  - docs/models/agent_orchestrator_and_rag.md
  - docs/models/yomama_bridge.md
---

# Plan: Test Suite Legitimacy — Deadlock Timeouts, Worker Quiescence, DAG Assertions & Mutation Gates

**Revised 2026-11-12.** inSetu moves to pytest and the shared test kit (`docs/plans/2026-11-12-shared-test-kit.md`, roadmap P25). The watchdog uses `pytest-timeout`, mutation testing uses mutmut, and coverage floors come from the kit. The goals of every sprint stand; only the tools changed. These sprints land with the kit's Sprint 4 (inSetu's move).

## 1. Context & Problem Statement

While `inSetu` already verifies its static AST fitness rules with synthetic negative cases (`test_sdk_improvements.py`) and tests parallel Python/JS pairs with seeded differential fuzzing (`test_parallel_logic_parity.py`), four structural gaps remain in how we verify that our unit tests are legitimate and non-flaky:

1. **Silent Infinite Hangs on Lock / Worker Deadlocks:** A non-reentrant `threading.Lock()` self-deadlock or a starved `wait_for_jobs()` loop freezes `run_unit_tests.py` indefinitely without printing a stack trace until a human sends `SIGINT`.
2. **Cross-Test Daemon Thread & SQLite Bleed:** When a test boots the `Stateless Worker Metronome` or background thread pool and `tearDown()` deletes `self.temp_dir` without quiescing workers first, in-flight threads race against the next test's `workers.db` and volume mounts.
3. **Graceful-Skip False Positives in DAG Routine Tests:** Because `orchestrator.py` marks nodes whose `when:` condition fails as `{"status": "skipped"}` and still completes the routine, a test that only checks `result["status"] == "completed"` can pass even when key nodes were silently skipped.
4. **Unmeasured Assertion Strength on Core State Reducers:** Line coverage does not prove that assertions actually catch off-by-one anchor math, indentation deltas, or condition evaluation bugs in `bridge_fuzzy.py`, `bridge_ast.py`, and `expressions.py`.

---

## 2. Sprint 1: Hard Per-Test Watchdog Timeouts & Stack-Trace Dumping

- [ ] [S1.T1] Per-test timeouts through the shared test kit (`pytest-timeout`, default `15s`, configurable in `pyproject.toml`), dumping all thread stacks on expiry so a deadlocked lock or hung worker fails the test instead of freezing the run. `tests/run_unit_tests.py` becomes a thin wrapper around pytest. <!-- targets: vfs://insetu/tests/run_unit_tests.py, vfs://insetu/tests/conftest.py, test_contract: vfs://insetu/tests/unit/test_perf_check.py -->
- [ ] [S1.T2] Ensure `reset_kernel_state()` in `insetu/core/sdk/__init__.py` always calls `akasa.workers.reset()` (which invokes `_quiesce_background_workers()`) and `akasa.db.reset()` before `temp_dir.cleanup()` so zero worker threads or pooled SQLite handles survive across test boundaries <!-- targets: vfs://insetu/insetu/core/sdk/__init__.py, test_contract: vfs://insetu/tests/unit/test_sdk_improvements.py -->

## 3. Sprint 2: Anti-Tautology Fitness Rules & Explicit DAG Node Assertions

- [ ] [S2.T1] Add a test-hygiene check to `tests/fitness/rules_python.py` (`is_test=True`) that flags `test_*` methods in `tests/unit/test_*.py` that contain zero `self.assert*` / `assert` / `mock.assert_*` calls ("Line Tourism" tests) or bare `except Exception: pass` blocks around assertions <!-- targets: vfs://insetu/tests/fitness/rules_python.py, test_contract: vfs://insetu/tests/unit/test_sdk_improvements.py -->
- [ ] [S2.T2] Audit declarative routine unit tests in `tests/unit/test_agent_orchestrator_and_mcp.py` to assert explicit per-node `status == "completed"` (and `status != "skipped"`) on expected wavefront nodes in `execution_trace` / `chain_context` <!-- targets: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py -->

## 4. Sprint 3: Mutation Testing on the Core Reducers (mutmut, through the kit)

- [ ] [S3.T1] List the pure reducers (`insetu/core/bridge/bridge_fuzzy.py`, `insetu/core/bridge/bridge_ast.py`, `insetu/core/agent/expressions.py`) as mutation targets in `pyproject.toml`, list the files tests read from the repository (`tests/parity/`, `tests/unit/js_loader.mjs`) for mutmut to copy, and run it through the kit weekly or on demand. A surviving mutant becomes a tracker ticket, not a CI failure. <!-- targets: vfs://insetu/pyproject.toml, test_contract: vfs://insetu/tests/unit/test_bridge_anchor_invariants.py -->

## 5. Sprint 4: Branch Coverage Floors

- [ ] [S4.T1] Branch coverage per module through the kit, with a checked-in floors file for the pure reducers (and akasa's `merge.py`, in akasa); a module below its floor fails, a run above it raises the floor. <!-- targets: vfs://insetu/pyproject.toml -->

## 5. Sprint 4: Branch Coverage Floors & a Reusable Mutation Harness

- [ ] [S4.T1] Measure branch coverage (`coverage.py`, a dev-only dependency) in `tests/run_unit_tests.py` behind a flag, reporting per module rather than one global percentage.
- [ ] [S4.T2] Record a coverage floor per module for the pure reducers (`bridge_fuzzy.py`, `bridge_ast.py`, `expressions.py`, `merge.py` in akasa) in a checked-in baseline file; a fitness rule fails when a module drops below its floor, and a run that beats the floor updates the baseline (a ratchet, like `debt_ratchet`).
- [ ] [S4.T3] Keep S3.T1's harness free of inSetu imports (target modules, mutation operators and the test command are arguments), so another repository can copy it unchanged; report surviving mutants as one line each with file, line and operator.
- [ ] [S4.T4] Run mutation weekly or on demand, never per commit; a surviving mutant on a reducer becomes a tracker ticket, not a CI failure.
