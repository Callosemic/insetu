---
repo: "insetu"
type: "todo"
status: "logged"
id: INS-QUEUE-20260701_1830_EXTENSION_STATE_STANDARDIZATION
title: "Standardization: Replicate ext_citations Vanilla Zustand Architecture across Remaining Extensions"
created_at: 2026-07-01T18:30:00
closed_at: 2026-07-04T17:30:00
sub_bucket: "None"
---

## Description
Following the successful state hardening sequence implemented within the Citations extension (`ext_citations.js`), which established a decoupled, vanilla Zustand state tree backed by `devtools` and `subscribeWithSelector` middleware substrates, this ticket tracks the pattern's systematic replication across all optional visual extensions. 

Currently, extensions like the Project Kanban Tracker (`ext_tracker.js`) and the Research Triage Inbox (`ext_research.js`) rely on fragmented state mechanics, local variables, or separate `localStorage` evaluation strings. Standardizing these layouts onto the new vanilla module pattern enforces strict Unidirectional Data Flow (UDF), isolates business logic from DOM presentation states, and simplifies cache eviction workflows during multi-tenant workspace soft-swaps.

## Blueprint Pattern Framework
The standardized extension state model must mirror the structure established in `ext_citations.js`:
1. **Vanilla Core Isolation:** Import strictly from `https://esm.sh/zustand/vanilla` to prevent forcing tight runtime UI component dependencies directly on framework-bound scripts.
2. **Middleware Enhancement:** Wrap store initializations using `devtools` for precise runtime traceability and `subscribeWithSelector` to allow target DOM items to listen and react uniquely to specific state fields without layout thrashing.
3. **Request-Scoped Synchronization:** Dynamically bind active workspace profiles using uniform selectors linked straight to the centralized `AppStore` state, discarding decoupled `localStorage` parsing logic within localized canvas files.

## Action Items
- [ ] **Refactor Project Kanban Tracker (`ext_tracker.js`):**
    * Migrate the `KanbanStore` layout to fully leverage the vanilla Zustand middleware stack.
    * Terminate standalone workspace parsing functions, subscribing directly to the reactive core `AppStore` active workspace token metrics.
- [ ] **Refactor Research Triage Module (`ext_research.js`):**
    * Scaffold a dedicated `ResearchStore` utilizing the vanilla blueprint framework.
    * Relocate ongoing scraping progress meters, search constraints, and active triage data rows out of volatile local script boundaries into the managed state tree.
- [ ] **Streamline Workspace Eviction Loops (`app.js`):**
    * Catalog all newly generated standalone extension stores, allowing the core `performSoftRefresh` workflow to systematically iterate and clear payload caches without relying on fragile hardcoded checks.
## Notes / Execution Log
* **Audit (2026-07-02):** Designated as primary architectural debt alongside the `window.inSetu` namespace consolidation. Fragmented DOM state extraction is required to maintain strict UDF compliance.
* **Status Update (2026-07-02):** Partially completed. `KanbanStore` and `CitationStore` have successfully implemented Vanilla Zustand configurations. However, `ext_research.js` relies on a custom `ResearchStore` object that lacks the required `devtools` and `subscribeWithSelector` middleware substrates.
* **Status Update (2026-07-03):** Verified `KanbanStore` and `CitationStore` subscriptions successfully executing DOM rendering, but `ext_research.js` remains a bespoke listener array. Ticket remains open pending complete Zustand migration.
* **Resolution (2026-07-04):** Fully refactored `ext_research.js` to utilize a `ResearchStore` backed by the `zustand/vanilla` core stack. Subscribed rendering modules correctly via selectors, completing the ecosystem-wide state standardization.