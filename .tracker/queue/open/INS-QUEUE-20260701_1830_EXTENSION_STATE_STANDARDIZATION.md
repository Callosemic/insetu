---
id: INS-QUEUE-20260701_1830_EXTENSION_STATE_STANDARDIZATION
title: "Standardization: Replicate ext_citations Vanilla Zustand Architecture across Remaining Extensions"
created_at: 2026-07-01T18:30:00
closed_at: null
sub_bucket: "None"
tags: [frontend, architecture, extensions, state-hardening, standardization]
---

## Description
[span_0](start_span)Following the successful state hardening sequence implemented within the Citations extension (`ext_citations.js`)[span_0](end_span)[span_1](start_span), which established a decoupled, vanilla Zustand state tree backed by `devtools` and `subscribeWithSelector` middleware substrates[span_1](end_span), this ticket tracks the pattern's systematic replication across all optional visual extensions. 

[span_2](start_span)[span_3](start_span)Currently, extensions like the Project Kanban Tracker (`ext_tracker.js`)[span_2](end_span)[span_3](end_span) [span_4](start_span)and the Research Triage Inbox (`ext_research.js`)[span_4](end_span) [span_5](start_span)rely on fragmented state mechanics, local variables, or separate `localStorage` evaluation strings[span_5](end_span). [span_6](start_span)Standardizing these layouts onto the new vanilla module pattern enforces strict Unidirectional Data Flow (UDF)[span_6](end_span)[span_7](start_span), isolates business logic from DOM presentation states, and simplifies cache eviction workflows during multi-tenant workspace soft-swaps[span_7](end_span).

## Blueprint Pattern Framework
[span_8](start_span)The standardized extension state model must mirror the structure established in `ext_citations.js`[span_8](end_span):
1. **[span_9](start_span)Vanilla Core Isolation:** Import strictly from `https://esm.sh/zustand/vanilla`[span_9](end_span) to prevent forcing tight runtime UI component dependencies directly on framework-bound scripts.
2. **[span_10](start_span)Middleware Enhancement:** Wrap store initializations using `devtools` for precise runtime traceability and `subscribeWithSelector`[span_10](end_span) [span_11](start_span)to allow target DOM items to listen and react uniquely to specific state fields[span_11](end_span) [span_12](start_span)without layout thrashing[span_12](end_span).
3. **[span_13](start_span)Request-Scoped Synchronization:** Dynamically bind active workspace profiles using uniform selectors linked straight to the centralized `AppStore` state[span_13](end_span)[span_14](start_span), discarding decoupled `localStorage` parsing logic within localized canvas files[span_14](end_span).

## Action Items
- [ ] **Refactor Project Kanban Tracker (`ext_tracker.js`):**
    * [span_15](start_span)Migrate the `KanbanStore` layout[span_15](end_span) [span_16](start_span)to fully leverage the vanilla Zustand middleware stack[span_16](end_span).
    * [span_17](start_span)Terminate standalone workspace parsing functions[span_17](end_span)[span_18](start_span), subscribing directly to the reactive core `AppStore` active workspace token metrics[span_18](end_span).
- [ ] **Refactor Research Triage Module (`ext_research.js`):**
    * [span_19](start_span)Scaffold a dedicated `ResearchStore` utilizing the vanilla blueprint framework[span_19](end_span).
    * Relocate ongoing scraping progress meters, search constraints, and active triage data rows out of volatile local script boundaries into the managed state tree.
- [ ] **Streamline Workspace Eviction Loops (`app.js`):**
    * [span_20](start_span)Catalog all newly generated standalone extension stores, allowing the core `performSoftRefresh` workflow to systematically iterate and clear payload caches[span_20](end_span) [span_21](start_span)without relying on fragile hardcoded checks[span_21](end_span).

## Notes / Execution Log