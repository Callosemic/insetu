---
repo: "insetu"
type: "queue"
status: "open"
id: INS-QUEUE-20260705_0141_FORMATTER_HOOKS
title: "Evaluate Exposing JS Formatter as Pre-Commit Hook or File Browser Action"
created_at: 2026-07-05T01:41:52
closed_at: null
sub_bucket: "None"
tags: ["Tooling", "Formatting", "UX"]
---

## Description
The native Python JS Formatter (`run_formatter()` in `engine_format.py`) is currently marooned as an ad-hoc, terminal-only script. It requires manual execution and physical path awareness to run safely.

To increase its utility without violating the "strict, unforgiving parsing on the Write-Path" mandate (which bans auto-formatting during VFS saves), we should evaluate exposing it through one or both of the following channels:

1. **Pre-Commit Hook Integration:** Expose a standard Git hook or configure `engine_git.py` to prompt/execute the formatter immediately before finalizing a local commit or sweep.
2. **File Browser Context Menu:** Inject an action into the `zone:file-card-actions` hook or a global File Browser dropdown to allow users to manually trigger the formatter on a specific file or recursively on a selected folder, directly from the UI.

## Action Items
- [ ] Audit `engine_format.py` to decouple `run_formatter` from `sys.argv` and `os.getcwd()`, enabling it to accept explicit path targets from other internal engines.
- [ ] Determine if a Git pre-commit hook provides a better Developer Experience (DX) than manual UI triggers.
- [ ] Draft an architectural implementation plan based on the chosen integration path.

## Notes / Execution Log