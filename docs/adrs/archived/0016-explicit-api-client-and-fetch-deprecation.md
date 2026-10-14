# 0016: Explicit API Client and Fetch Rewriter Deprecation

## Status
Accepted (2026-07-09)

## Context
During the V2 multi-tenant migration, we implemented a global interceptor on `window.fetch` to automatically append `X-Workspace-ID` headers and rewrite `/api/...` URL strings into `/api/<workspace_id>/...` to enforce stateless tenant routing. 

While this reduced boilerplate, this "magic" URL rewriting proved overly greedy and brittle, inadvertently intercepting and breaking core OS-level routes (like `/api/system/panic`), which caused the Immutable Recovery Bootloader to fail. Implicitly guessing a developer's network intent via regex string-matching obscures the network contract and makes debugging excessively difficult.

## Decision
1. **Deprecate the Fetch Interceptor:** The global `window.fetch` override and its URL-rewriting magic will be deprecated and eventually removed.
2. **Intent-Driven API Client:** We will establish a dedicated, explicit API client under the `window.inSetu.api` namespace.
    * `window.inSetu.api.workspace(path, options)`: Explicitly for extension and tenant-scoped transactions. The client will securely prepend `/api/<active_workspace>/` to the path and inject required headers.
    * `window.inSetu.api.system(path, options)`: Explicitly for core OS operations. The client will safely prepend `/api/system/` and bypass tenant scope injections while maintaining security token handshakes.
3. **Strict Compliance:** All OS UI components and extensions must be refactored to utilize these explicit methods. Raw `fetch()` calls or manual URL string concatenations inside UI modules are strictly banned.

## Consequences
* **Positive:** Absolute network determinism. The system no longer guesses route destinations.
* **Positive:** Extension developers have a clean, explicit SDK to interact with the backend without needing to manually query the Zustand `AppStore` for the active workspace token.
* **Positive:** Provides a pristine architectural seam to implement the upcoming "Offline Typewriter" (IndexedDB mutation queue) by allowing the `api.workspace` method to natively intercept `POST` requests when the network drops.
* **Negative:** Introduces immediate technical debt requiring a sweeping refactor of all existing frontend `fetch` calls across the extension ecosystem to comply with the new client.