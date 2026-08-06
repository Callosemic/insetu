---
id: "INS-QUEUE-20260806_0200_SUTRAM_PRIMITIVES"
repo: "insetu"
type: "queue"
status: "open"
title: "Generalize Spinner and Empty-State Components into Vendorized Sutram Primitives"
created_at: null
closed_at: null
sub_bucket: "UI"
tags: ["Sutram", "UI", "Refactor", "Primitives"]
---

## Description
Abstract the newly introduced `<insetu-spinner>` and `<insetu-empty-state>` Web Components out of `ui_primitives.js`[cite: 3] and promote them into Tier 0 presentation kernel vendorized primitives inside `insetu/static/vendor/sutram/js/primitives.js`[cite: 1] as `<sutram-spinner>` and `<sutram-empty-state>`.

### Action Items
- [ ] **Construct `<sutram-spinner>` & `<sutram-empty-state>` Primitives**:
  - Export `SutramSpinner` and `SutramEmptyState` in `insetu/static/vendor/sutram/js/primitives.js`.
  - Encapsulate theme token variables (`var(--border)`, `var(--intent-primary)`, `var(--text-muted)`) and animation keyframes within component styles.
  - Expose `text` and `icon` properties with default slot fallbacks for flexible template projection.
- [ ] **Create Backward-Compatibility Aliases in `ui_primitives.js`**:
  - Update `InSetuSpinner` and `InSetuEmptyState` to subclass `SutramSpinner` and `SutramEmptyState`.
  - Register custom element aliases (`insetu-spinner` and `insetu-empty-state`)[cite: 3] to preserve legacy layout compatibility without breaking existing extension views.
- [ ] **Sweep & Replace Raw Inline Spinners**:
  - Audit and replace remaining raw `<div class="spinner">` blocks and hardcoded italicized empty state strings across core and extension Lit templates with declarative `<sutram-spinner>` and `<sutram-empty-state>` components.