---
title: "Sutram Base HTML CSS Vacuum & Telemetry Data Primitives"
description: "Plan to standardize bare HTML tables in sharedStyles and add a declarative <sutram-sparkbar> primitive so core and extension telemetry views require zero custom CSS or inline styles."
repo: insetu
domain: "UI & Presentation"
status: planned
created_at: 2026-11-15T17:10:00
tags: [plan, sutram, yenvui, css-vacuum, dev-tools, primitives]
models:
  - docs/04_ui_design_standards.md
  - docs/08_sutram_contracts.md
---

# Sutram Base HTML CSS Vacuum & Telemetry Data Primitives

## 1. Architectural Context & Objective

Per `docs/04_ui_design_standards.md` §0 (*The Zero-CSS & Zero-Inline-Style Mandate*) and `docs/08_sutram_contracts.md` §X (*The Base HTML CSS Vacuum*), `inSetu` core and extension components (`insetu/core/**` and `insetu/extensions/**`) must contain **zero** custom ``css`...` `` blocks (`static styles = [sharedStyles];` only) and **zero** inline `style="..."` layout hacks.

During the extraction of `insetu/extensions/dev/dev_sql_and_memory.js` (`InSetuExtDevSql` and `InSetuExtDevMemory`) from `ext_dev.js`, we removed legacy inline `style="..."` attributes from the SQL Console and Heap Profiler `<table>`, `<th>`, and `<td>` elements. To ensure tabular data readouts and telemetry sparkbars render with first-class typography, borders, and truncation out of the box across Dark, Light, and E-Ink themes, those capabilities belong in `sutram` / `yenvui`.

---

## 2. File-Level Execution Plan

### Sprint 1: Base HTML Table Vacuum in `sutram` (`shared_styles.js` & `theme-tokens.css`)
- [ ] **[T1] (`vfs://sutram/sutram/js/shared_styles.js`, `vfs://sutram/yenvui/css/theme-tokens.css`):** Add baseline table rules to `sharedStyles` and `theme-tokens.css` so bare `<table>`, `<th>`, and `<td>` elements inside any `SutramElement` / `InSetuElement` automatically inherit:
  - `table`: `width: 100%; border-collapse: collapse; font-family: var(--font-mono, monospace); font-size: 0.8rem;`
  - `th`: `text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border); color: var(--text); font-weight: 700;`
  - `td`: `padding: 8px 12px; border-bottom: 1px solid var(--border); color: var(--text);`
  - `td.cell-truncate`: `max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
  - `td.cell-bold`: `font-weight: 700;`

### Sprint 2: Declarative `<sutram-sparkbar>` Telemetry Primitive & `<sutram-entity-actions variant="dropdown">`
- [ ] **[T2.1] (`vfs://sutram/yenvui/js/primitives.js`, `vfs://sutram/sutram/js/primitives.js`, `vfs://insetu/insetu/extensions/dev/ext_dev.js`):** Introduce `<sutram-sparkbar .values=${...} .peak=${...} .threshold=${3}>` to replace the inline-styled `<div style="display: flex; align-items: flex-end; height: 60px; ...">` file-thrashing histogram in `InSetuExtDevDash` (`ext_dev.js`), eliminating the last inline `style` in `ext_dev.js`.
- [ ] **[T2.2] (`vfs://sutram/sutram/js/primitives.js`, `vfs://insetu/insetu/core/agent/agent_handoff_and_plan.js`):** Add `variant="dropdown"` (with `.triggerLabel`, `.triggerIcon`, `.triggerIntent`, `.direction`, `?compact`) to `<sutram-entity-actions>` so single-button entity menus (`file:context` and `text_blob`) render declaratively without helper calls.

### Sprint 3: Vendor Bundle Sync & Lock Verification
- [ ] **[T3] (`scripts/vendor_sutram.sh`, `insetu/static/vendor/sutram.lock.json`):** Rebuild and vendor the `sutram` bundle into `insetu/static/vendor/sutram/` and verify `test_vendor_lock.py` and `test_sutram_compliance.py` pass with zero violations.
