---
repo: "insetu"
type: "todo"
status: "archived"
id: INS-TODO-20260713_1326_EINK_CSS_PROPERTIES
title: "Abstract E-Ink High Contrast theme overrides into CSS Custom Properties"
created_at: 2026-07-13T13:26:00
closed_at: 2026-07-27T15:33:44
sub_bucket: "None"
tags: ["Frontend", "Tech Debt", "Theming"]
---

## Description
Refactor the high-specificity visual overrides under the `[data-theme="e-ink"]` selector block inside `style.css`.

### Objectives
* Abstract hardcoded visual property adjustments into standard CSS Custom Properties assigned at the `:root` level.
* Eliminate downstream layout overrides that rely on `!important` tags to maintain style definitions.
* Align the high-contrast presentation layer with global design token encapsulation and web component standards.
## Notes / Execution Log
* **Resolution (2026-07-27):** Excised high-specificity, hardcoded `!important` E-Ink mode visual overrides (`textarea`, `button`, `pre`, `.tabs`, `.sub-tab`) directly from `style.css`. Relying on standardized component-level CSS custom properties instead. Legacy `#file-modal` specific overrides were also purged in preparation for full declarative web component migration.