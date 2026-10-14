# 0017: Extension SDK & The "Pit of Success" Architecture

## Status
Accepted (2026-07-10)

## Context
As the extension ecosystem expanded, boilerplate code for handling stateless multi-tenant boundaries, VFS routing, and DOM lifecycle subscriptions became brittle. Extension authors were forced to manually sniff tenant headers, manually execute Zustand store teardowns to prevent cross-tenant ghosting, and painstakingly coordinate file writes to avoid bypassing the Cartographer topology triggers.

## Decision
We have implemented a unified Extension SDK (V2) spanning both the backend and frontend.
1. **Backend (`InSetuExtension` & `ExtensionContext`):** Wraps Flask Blueprints to automatically prepend `/api/<workspace_id>/<ext_name>/` to all routes. Injects a pre-scoped `ctx` object offering `ctx.db`, `ctx.vfs.save()`, and `ctx.resolve_path()`, effectively banning direct `os.walk` and `open()` calls in extensions.
2. **Frontend (`InSetuElement`):** A base class extending `LitElement` that manages its own Zustand store subscriptions (`this.subscribe()`) and executes mandatory teardowns during `disconnectedCallback`. It provides an `api` wrapper (`this.api.post`) that automatically points to the correct tenant context via ADR 0016 compliance.
3. **Declarative Schemas:** Replaces manual SQLite table generation hooks with declarative dictionary payloads (`register_schema`) that auto-migrate on OS boot.

## Consequences
* **Positive:** The "easiest" way to write an extension is now mathematically the "safest" way, seamlessly enforcing Engineering Standard 01 constraints.
* **Positive:** Massive reduction in structural boilerplate and manual memory-teardown vulnerabilities.
* **Negative:** Extensions are now tightly coupled to the SDK base classes, raising the abstraction floor for external contributors porting legacy Flask or Vanilla JS tools.