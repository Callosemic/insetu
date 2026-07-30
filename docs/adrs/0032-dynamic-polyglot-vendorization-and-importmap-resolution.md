# ADR 0032: Dynamic Polyglot Vendorization, Importmap Resolution, and CDN Import Ban

## Status
Accepted

## Context
To satisfy ADR 0008 (Offline-First Synchronization) and guarantee deterministic execution across offline or isolated network environments, the inSetu Developer OS must operate completely decoupled from third-party Content Delivery Networks (CDNs) such as `esm.sh`, `cdn.jsdelivr.net`, or `unpkg.com`.

Prior to this decision, frontend modules and extensions imported external libraries via hardcoded CDN URLs inside `<script type="importmap">` or ES module `import` statements. This created network vulnerabilities, version drift, and potential custom element tag registration collisions when multiple extensions required the same library.

## Decision
1. **Local Vendorization Requirement:** All third-party JavaScript, CSS, and web components required by the core OS or optional extensions must be vendored locally inside `insetu/static/vendor/` or `insetu/extensions/<ext_name>/vendor/`. Hardcoded CDN imports are strictly banned.
2. **Declarative `vendor.json` Manifests:** Core OS and extensions declare their dependencies via a static `vendor.json` manifest specifying specifier keys, local relative paths, version strings, and compound SemVer range constraints (e.g., `>=3.0.0 && <4.0.0`).
3. **Two-Pass Importmap Assembly:** The kernel bootloader (`app.py`) parses baseline and active extension `vendor.json` declarations during startup via `build_dynamic_importmap()`. It evaluates SemVer ranges to resolve highest-matching localized asset URLs, dynamically rendering the browser-native `<script type="importmap">` payload into `index.html`.
4. **Extension Asset Route:** Static assets and vendored dependencies inside extension directories are served safely via `/static/extensions/<ext_name>/<path:filename>` with strict relative-path traversal checks (`Path.relative_to`).
5. **Automated Fitness Function Guardrail:** The static analysis suite (`tests/fitness/rules_javascript.py`) enforces the `BANNED_CDN_IMPORT` rule, failing the build if any frontend script contains HTTP/HTTPS CDN import specifiers.

## Consequences
* **Positive:** Absolute offline resilience. The OS boots and functions identically with zero internet connectivity.
* **Positive:** Centralized, deterministic version resolution for shared dependencies without bundle duplication or custom element collision exceptions.
* **Negative:** Extensions shipping third-party libraries must commit vendor files and maintain `vendor.json` manifest declarations.