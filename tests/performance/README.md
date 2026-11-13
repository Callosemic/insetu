# Performance checks

`perf_check.py` measures the running app against the budgets in `budgets.json`.

```
python tests/performance/perf_check.py
```

Run it from the folder inSetu runs in (the one that holds `.insetu`), or pass `--dir`. The app must be running.
It exits 0 within budget, 1 over budget, and 2 when it cannot reach the app.

## Why it measures the running app

Response times depend on the workspace: how many routines, prompts and repositories it has. A test with its own
small workspace would pass any budget, and timing tests are unreliable on CI machines. So this is a check a
person runs against the workspace they use, before a release or after a change that could slow something down.
It is not part of the unit run or the CI battery.

## Adding a check

1. Have the route report its parts: wrap each step in a `StepTimer` (`insetu/core/step_timer.py`) and return
   `timer.ms` as `timings_ms`.
2. Measure it warm a few times.
3. Add an entry to `budgets.json` with budgets of about double what you measured, and say in `why` what was
   measured and when.

A budgeted part that the app stops reporting fails the check, so a budget cannot go quiet.
