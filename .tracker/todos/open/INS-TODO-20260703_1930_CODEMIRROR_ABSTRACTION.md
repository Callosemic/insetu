---
repo: "insetu"
type: "todo"
status: "open"
id: INS-TODO-20260703_1930_CODEMIRROR_ABSTRACTION
title: "Ecosystem Generalization: Abstract CodeMirror Mode Mapping"
created_at: 2026-07-03T19:30:56
closed_at: null
sub_bucket: "None"
tags: ["Frontend", "Refactor", "DRY"]
---

## Description
The logic that maps a file's `.ext` extension to its corresponding CodeMirror mode (e.g., `md` to `markdown`, `py` to `python`) is currently duplicated as a hardcoded `modeMap` dictionary across four distinct methods within `fs.js`:
* [span_0](start_span)`toggleModalMode`[span_0](end_span)
* [span_1](start_span)`viewAndCopy`[span_1](end_span)
* [span_2](start_span)`cleanModalFile`[span_2](end_span)
* [span_3](start_span)`viewSourceFile`[span_3](end_span)

To comply with our DRY (Don't Repeat Yourself) engineering standards, this literal dictionary map must be abstracted into a centralized utility function. This ensures that as new languages (e.g., TypeScript, Rust, Go) are supported by the frontend canvas, they only need to be registered in a single location rather than hunting through disconnected layout toggles.

## Action Items
- [ ] Create a centralized helper function `resolveEditorMode(filename)` inside `app.js` or `UIFactory`.
- [ ] Sweep `fs.js` and strip out all localized `modeMap` dictionary definitions.
- [ ] Refactor the four target methods to funnel their extension resolution through the new centralized utility.
- [ ] Expand the centralized dictionary to gracefully support upcoming backend language formats (e.g., `.ts`, `.rs`, `.go`).

## Notes / Execution Log
