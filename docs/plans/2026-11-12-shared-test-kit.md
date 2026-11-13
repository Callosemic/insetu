---
title: "Plan: kiemma, the Shared Test Kit"
description: "One small Apache 2.0 package and pytest plugin that every Callosemic repository tests with: the fitness rule engine, the fixture-suite runner, test tiers, timeouts, coverage floors, mutation testing through mutmut, and one JSON report. akasa adopts it first, then Axoneme, sutram and inSetu."
status: "draft"
created: "2026-11-12"
roadmap: "P25"
models:
  - "vfs://insetu/docs/plans/2026-11-11-test-legitimacy-quiescence-and-mutation-gates.md"
---

# Plan: kiemma, the Shared Test Kit

Draft by Claude, 2026-11-12, from your direction in chat. Questions marked **OPEN** are yours.

## Decisions (2026-11-12)

1. **pytest is the test engine in every repository.** Existing `unittest.TestCase` tests run unchanged under it. Each repository keeps `tests/run_unit_tests.py` as the command a person types; it becomes a thin wrapper around pytest.
2. **The kit is its own package, named `kiemma`** (Vietnamese *kiểm mã*, "check the code"; decided 2026-11-12), Apache 2.0, published to PyPI like akasa and inSetu with the `Framework :: Pytest` classifier. It is not part of akasa, because sutram and Axoneme must not need the kernel to run their tests.
3. **The kit imports none of the repositories that use it.** akasa depends on the kit, never the other way round.
4. **Adoption order:** akasa, then Axoneme (whose test suite is built on the kit from the start), then sutram, then inSetu.
5. **Version 0.x, pinned exactly by every consumer**, until all four use it; then 1.0.
6. **Standard tools inside, custom code only where none exists:** pytest, `pytest-timeout`, `coverage.py`, mutmut. The kit's own code is the fitness engine, the fixture-suite runner, tiers, coverage floors and the report.

## What the kit holds

| Part | What it does |
| --- | --- |
| pytest plugin | Registered through the `pytest11` entry point, so installing the kit is enough. Reads its settings from `[tool.kiemma]` in the repository's `pyproject.toml`. |
| Tiers | Markers for `fitness`, `unit`, `contract`, `fixtures`, `scenario`, `performance`, `eval`. The default run is everything except `performance` and `eval`. A test with no marker counts as `unit`. |
| Timeouts | A default per-test timeout through `pytest-timeout` (15 s unless the repository sets another), with all thread stacks dumped on expiry. |
| Fitness engine | Rules as data, collected as pytest items: one item per rule, one failure line per violation (`RULE-ID path:line message`). |
| Fixture suites | One helper turns a folder of JSON cases into parametrized tests against any implementation. |
| Coverage floors | Branch coverage per module, compared with a checked-in floors file; a module below its floor fails, a module above it raises the floor. |
| Mutation | A thin wrapper that runs mutmut on the modules a repository lists, and writes surviving mutants to the report. Weekly or on demand, never a per-commit gate. |
| Report | One JSON file per run: results per tier, fitness violations, coverage per module, mutation survivors. Baselines and ratchets read it. |

## What stays in each repository

- Its `conftest.py` with its own reset fixtures: `akasa.reset_state()`, inSetu's kernel reset, Axoneme's in-memory drivers.
- Its fitness rules (the kit runs them; the repository writes them).
- Its fixture folders (`tests/parity/`, the Morningstar corpus, contract conformance cases).
- Its performance checks against a running app (inSetu's `tests/performance/perf_check.py` stays as it is).
- Its JavaScript test harness, for now (sutram's Node shim; see OPEN).

## The fitness engine

A rule is a small object:

| Field | Meaning |
| --- | --- |
| `id` | Stable, upper snake case (`KERNEL_RING_DAG_MANDATE`). Never reused for a different rule. |
| `scope` | Path globs the rule applies to. |
| `check` | A function given one parsed file (Python AST, or text for other languages) that returns violations. |
| `why` | One sentence naming the standard or principle it enforces. |
| `examples` | At least one snippet the rule must flag and one it must allow. The kit turns these into tests, so every rule proves it works (akasa standards §7). |

**Exemptions sit at the line, never in file-name lists:** `# fitness: allow RULE_ID because <reason>` on the line or the one above. An exemption without a reason is itself a violation. Existing whitelists (for example inSetu's `VFS_WRITE_WHITELIST`) are converted to line exemptions during each repository's move.

**Counted debt ratchets:** a rule may declare a baseline count instead of zero. The report records the count; a run above the baseline fails, a run below it lowers the baseline.

## Fixture suites

A suite is a folder of JSON files, each `{"cases": [{"name", "input", "expected"}]}`. A repository binds a suite to one or more implementations; every case runs against every implementation as its own test. This is how Python and JavaScript parity, the lens contract, sarga conformance and the Morningstar round trips are all tested the same way.

## Sprints

### Sprint 1: v0.1, built with akasa's move
- [ ] Package skeleton, the plugin, settings, tiers, timeouts, the report. **Gemini** builds from this brief; **Claude** reviews.
- [ ] The fitness engine; port akasa's rules (`KERNEL_RING_DAG_MANDATE`, `KERNEL_TRANSPORT_ISOLATION`, `STRICT_TOP_LEVEL_IMPORTS_MANDATE`, `FORWARDED_HEADER_MEMBRANE`, `CREDENTIALS_STDLIB_ONLY` and the rest) with their examples.
- [ ] akasa's `conftest.py` with an autouse `reset_state()` fixture.
- Done when: akasa's full suite passes under pytest with the kit, the test count matches the old runner, every fitness rule has passing examples, and the report is written.

### Sprint 2: v0.2, Axoneme
- [ ] Axoneme's A1 test suite on the kit: its standards as fitness rules, the Morningstar corpus as fixture suites, contract tests as a tier.
- [ ] Fold in whatever Axoneme needed that akasa did not.

### Sprint 3: v0.3, sutram
- [ ] sutram's fitness rules and consumer linter on the engine.

### Sprint 4: v0.4, inSetu
- [ ] inSetu's runner, fitness rules (whitelists converted to exemptions), parity fixtures as fixture suites, coverage floors and mutation on the pure reducers (the 11-11 test plan's Sprints 3 and 4).
- Done when: all four repositories use the same kit version; then 1.0.

## Open questions


- **OPEN:** its repository: a new public repository in the Callosemic organisation? Suggestion: yes, so it has its own releases and CI.
- **OPEN:** should the kit later carry a JavaScript side (a shared Node shim), or does sutram keep owning that? Suggestion: decide at Sprint 3, once sutram's move shows what is shared.
- **OPEN:** should the kit also carry the shared first principles document and its check? (See the governance discussion of 2026-11-12.)
