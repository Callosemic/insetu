---
repo: "insetu"
type: "queue"
status: "open"
id: "INS-QUEUE-20260814_1128_SUTRAM_ZEN_MODE"
title: "Generalize Zen Focus Mode into Vendorized Sutram Primitive"
created_at: "2026-08-14T11:28:03"
closed_at: null
sub_bucket: "UI"
tags: ["sutram", "ui", "refactor", "editor"]
---

## Description
The recently introduced Zen Focus Mode (writing mode) in `InSetuFileModal` (`fs.js`) implements custom CSS fading transitions (`.is-prose.is-focused`), floating reveal buttons, and complex pointer-event tracking (mousemove, touchstart, focusin/out) to create a distraction-free writing environment.

To adhere to the Zero-CSS and Sutram Primitive mandates (ADR 0025, ADR 0007), this behavior must be abstracted out of the `fs.js` file modal and generalized into a reusable Tier 0 presentation component within the `sutram` vendor package.

### Action Items
- [ ] **Construct `<sutram-zen-wrapper>` or Extend `<sutram-modal>`**: 
  - Extract the DOM event listeners (`focusin`, `focusout`, `mousemove`, `touchstart`) into a dedicated Lit component or controller.
  - Implement a `zenActive` reactive property that controls the visibility of slotted headers/footers.
- [ ] **Abstract Styling**:
  - Migrate the `.top-bars-wrapper`, `.modal-footer`, and `.zen-reveal-btn` opacity/visibility CSS transitions into the Sutram component's shadow DOM.
- [ ] **Refactor `InSetuFileModal`**:
  - Strip the manual focus-tracking logic and custom CSS from `InSetuFileModal`.
  - Wrap the content in the new primitive (e.g., `<sutram-zen-wrapper ?active=${this._writingMode}>`) and pass the header/footer elements into the designated auto-fading slots.

## Notes / Execution Log