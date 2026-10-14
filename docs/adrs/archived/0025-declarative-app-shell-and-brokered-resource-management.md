# ADR 0025: Declarative App Shell, yenVUI Component Integration & Brokered SDK Resources

## Status
Accepted (2026-07-23)

## Context
As the inSetu Developer OS frontend expanded, layout assembly relied on imperative DOM manipulation (e.g. `registerTab` inserting HTML `div` blocks directly into `document.body` or `#main-tabs-container`), and UI elements hardcoded raw class names (`.file-card`, `.fullscreen-modal`) or manually managed event listeners/interval timers. This violated Unidirectional Data Flow (UDF) rules, led to memory leaks across workspace switches, and caused styling drift.

Furthermore, running cartographer mapping synchronously during context compilation blocked background worker execution.

## Decision
1. **Declarative Application Shell (`<insetu-app-shell>`):** We encapsulate primary navigation tabs, sub-tabs, toolbar action tracks, and global components inside a Lit-based Web Component (`<insetu-app-shell>`). All top-level layout HTML nodes are stripped from `index.html`.
2. **yenVUI Presentation Standard:** All card, modal, button, dropdown, search, pill, and status bar rendering is delegated to standard `<yenvui-*>` primitives.
3. **SDK Brokered Resource Management:** `InSetuElement` provides managed resource registration methods (`this.registerInterval`, `this.registerGlobalListener`). Component disconnection automatically cleans up active intervals and listeners.
4. **Asynchronous Cartographer Execution:** Cartographer repository mapping is decoupled from synchronous compile loops and dispatched as non-blocking background jobs (`submit_immediate_job`).

## Consequences
* **Positive:** Pure declarative UI rendering with zero HTML layout pollution in `index.html`. Absolute Inversion of Control.
* **Positive:** Automatic garbage collection of frontend timers and listeners on workspace swaps, preventing cross-tenant memory leaks.
* **Positive:** Non-blocking context compilation and mapping performance.