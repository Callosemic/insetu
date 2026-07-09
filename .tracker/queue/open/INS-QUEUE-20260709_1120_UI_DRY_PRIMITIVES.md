---
repo: "insetu"
type: "queue"
status: "open"
id: INS-QUEUE-20260709_1120_UI_DRY_PRIMITIVES
title: "UI DRY Violations: Abstract Global Component Primitives"
created_at: "2026-07-09T11:20:00"
closed_at: null
sub_bucket: "None"
delivery_date: null
tags: ["Frontend", "DRY", "UI Factory", "Refactor"]
---

## Description
Multiple declarative components currently harbor repeating UI patterns hardcoded as raw HTML strings and inline CSS[span_0](start_span)[span_0](end_span). This severely violates Engineering Standard 01 (DRY Utility Centralization) and ADR 0007 (Stateless UI Factory), making broad design system updates dangerously fragile[span_1](start_span)[span_1](end_span).

We need to extract these repeated paradigms into foundational, globally registered Lit Web Components.

### Action Items
- [ ] **Fuzzy Search Wrapper:** Abstract `<div class="fuzzy-search-wrapper">` into a `<insetu-fuzzy-search>` primitive. Currently, this layout is copy-pasted redundantly across `ext_citations.js`, `ext_flow.js`, `ext_git.js`, `ext_prompts.js`, `ext_tracker.js`, `fs.js`, and `gather.js`.
- [ ] **Form Labels & Input Groups:** Centralize the heavily inline-styled `label` and `input`/`select` combinations into an `<insetu-input-group>` component. This will primarily clean up `ext_config.js`, `ext_flow.js`, `ext_skills.js`, and `ext_research.js`.
- [ ] **Loading Spinners & Empty States:** Replace scattered `<div class="spinner">` blocks and hardcoded italicized "No results" paragraphs with standardized `<insetu-spinner>` and `<insetu-empty-state>` components to ensure consistent feedback styling.
- [ ] **Accordions / Expandable Detail Blocks:** Unify the native `<details><summary>` implementation in `ext_skills.js` and the bespoke `_yamlExpanded` div toggle in `ext_tracker.js` into a single, reusable `<insetu-accordion>` primitive.
- [ ] **Imperative Dropdown Menu:** Migrate `UIFactory.createDropdown()` in `ui.js` away from imperative `document.createElement` DOM injections and convert it into a declarative `<insetu-dropdown>` Web Component.

## Notes / Execution Log
