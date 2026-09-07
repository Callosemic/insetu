# ADR 0007: Stateless UI Factory and Component Decoupling

## Status
Accepted (2026-07-03)

## Context
As the frontend evolved toward an extension-driven Unidirectional Data Flow (UDF) architecture, individual JS modules (`ext_tracker.js`, `ext_citations.js`) began implementing their own DOM injection routines for common layout elements like filter pills, nested repository selection trees, and dropdown menus. This violated our DRY (Don't Repeat Yourself) engineering standard and caused visual inconsistencies across tenant configurations. Furthermore, hardcoded layout fragments in `index.html` were forcing the core Micro-Kernel to maintain awareness of optional extension boundaries.

## Decision
We will establish a Singleton `UIFactory` (housed in `ui.js`) to generate all generic, stateless UI primitives (Modals, Dropdowns, Filter Pills, Nested Repo Trees). Extensions must invoke these factory methods and pass strict callback configurations rather than generating raw DOM nodes themselves. Additionally, all domain-specific HTML layout blocks have been stripped from `index.html`. Extension views are now strictly registered via `ExtensionRegistry.registerSubTab` at runtime.

## Consequences
* **Positive:** Complete decoupling of the UI DOM from the core HTML shell. Visual styling is strictly centralized, making broad design changes or theme alterations trivial.
* **Negative:** Slightly higher abstraction overhead when building new extensions, as developers must conform to the generic `UIFactory` parameters rather than writing explicit HTML.