---
id: "INS-QUEUE-20260806_0200_SUTRAM_PRIMITIVES"
repo: "insetu"
type: "queue"
status: "archived"
title: "Generalize Spinner and Empty-State Components into Vendorized Sutram Primitives"
created_at: '2026-08-06T02:18:32-07:00'
closed_at: '2026-08-06T02:18:32-07:00'
sub_bucket: "None"
tags:
  - Sutram
  - UI
  - Refactor
  - Primitives
tier: 3
---

## Description
Abstract the newly introduced `<insetu-spinner>` and `<insetu-empty-state>` Web Components out of `ui_primitives.js`[cite: 3] and promote them into Tier 0 presentation kernel vendorized primitives inside `insetu/static/vendor/sutram/js/primitives.js`[cite: 1] as `<sutram-spinner>` and `<sutram-empty-state>`.

### Action Items
- [x] **Construct `<sutram-spinner>` & `<sutram-empty-state>` Primitives**:
  - Export `SutramSpinner` and `SutramEmptyState` in `insetu/static/vendor/sutram/js/primitives.js`.
  - Encapsulate theme token variables (`var(--border)`, `var(--intent-primary)`, `var(--text-muted)`) and animation keyframes within component styles.
  - Expose `text` and `icon` properties with default slot fallbacks for flexible template projection.
- [x] **Create Backward-Compatibility Aliases in `ui_primitives.js`**:
  - Update `InSetuSpinner` and `InSetuEmptyState` to subclass `SutramSpinner` and `SutramEmptyState`.
  - Register custom element aliases (`insetu-spinner` and `insetu-empty-state`)[cite: 3] to preserve legacy layout compatibility without breaking existing extension views.
- [x] **Sweep & Replace Raw Inline Spinners**:
  - Audit and replace remaining raw `<div class="spinner">` blocks and hardcoded italicized empty state strings across core and extension Lit templates with declarative `<sutram-spinner>` and `<sutram-empty-state>` components.

## Notes / Execution Log
- Completely eradicated legacy `<insetu-spinner>` and `<insetu-empty-state>` class declarations and custom element definitions from `insetu/core/system/components/ui_primitives.js`.
- Migrated all remaining references across `gather.js`, `fs.js`, `offline_ui.js`, `ui_system_settings.js`, and `ui_file_tree.js` to pure `<sutram-spinner>` and `<sutram-empty-state>` primitives.
- Verified zero references remain via `check_javascript_files()` and `test_sutram_compliance.py`.