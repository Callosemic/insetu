# ADR 0077: DevOps Extension Suite Modernization, Flask Transport Decoupling, Typed Worker Contracts, and Canonical Route Normalization

## Status
Accepted (2026-10-26)

## Context
Following the core pipeline membrane decoupling (ADR 0072), knowledge suite modernization (ADR 0074), and workflow management suite alignment (ADR 0075), the DevOps and system extension suite (`dev`, `format`, `git`, `preview`, `tailscale`, `term`, `update`) required a final architectural modernization pass:
1. **Flask Transport Shell Bleed**: Several DevOps engines directly imported `from flask import jsonify` and directly inspected raw request attributes (`ctx.req.json`, `ctx.req.args`), violating `FLASK_TRANSPORT_LEAK_BAN`.
2. **Untyped Worker Contracts**: Worker functions across DevOps extensions utilized generic `**kwargs` or un-annotated arguments, preventing synchronous contract validation and violating `WORKER_TYPED_SIGNATURE_MANDATE`.
3. **Undeclared Extension Dependencies**: Optional PyPI packages (`jsbeautifier`, `autopep8`, `flask-sock`, `semantic_release`, `build`, `twine`, `uvicorn`) and host binaries (`git`, `tailscale`) were declared via ad-hoc module dunders (`__external_depends__`, `__external_binaries__`) rather than structured constructor parameters on `InSetuExtension(...)`.
4. **Non-Canonical API Route Calls**: Frontend extension scripts invoked endpoints without module prefixes (e.g. `this.api.get('metrics')` instead of `this.api.get('dev/metrics')`) or used deprecated `api.workspace.*` / `api.system.*` accessors.
5. **Sub-Navigation Slot Drift**: `ext_dev.js` and `ext_term.js` registered bespoke Web Components in `slots:sub-navigation-actions`, violating `BANNED_SUB_NAV_ACTIONS_SLOT_BAN`.
6. **Pathlib Compliance & Floating Listeners**: File operations retained `os.path.exists()` and `os.path.relpath()` calls, and `ext_git.js` attached a floating `insetu:ensure-fresh-artifact` listener to `window`.

## Decision
1. **Flask Transport Decoupling & Unified Payload Access**:
   - Eradicated `from flask import jsonify` across all seven DevOps engines. Route handlers return plain Python dictionaries with optional HTTP status codes, letting `AkasaExtension.route` marshal responses at the HTTP edge.
   - Replaced all raw `ctx.req.json`, `ctx.req.args`, and `ctx.req.get_json()` reads with unified `ctx.payload`.
2. **Strict Typed Worker Signatures (`@*.worker`)**:
   - Purged `**kwargs` and un-typed parameters across all 26 background workers, declaring explicit Python type annotations (`ctx`, `filepath: Optional[str] = None`, `repo: str`, `prerelease: bool = False`, etc.).
3. **Declarative Extension Dependency Contracts & In-App Installation**:
   - Standardized dependency declarations directly on `InSetuExtension(...)` using `external_dependencies` and `external_binaries`.
   - Added in-app one-click dependency installation buttons (`this.installExtensionDependencies()`) in `<insetu-ext-term>` and `<insetu-ext-update>`.
4. **Canonical API Route Prefix Normalization**:
   - Prefixed all `this.api.*` calls with explicit `<module>/<endpoint>` identifiers across `ext_dev.js`, `ext_git.js`, `ext_preview.js`, `ext_term.js`, and `ext_update.js`.
   - Purged all legacy `api.workspace.*` and `api.system.*` accessors.
5. **Sub-Navigation Menu Consolidation**:
   - Eradicated `InSetuExtDevLogsActions`, `InSetuExtTermActions`, and `slots:sub-navigation-actions` in favor of declarative `menuActions` on `slots:sub-navigation`.
6. **Pathlib Compliance & Lifecycle Encapsulation**:
   - Migrated all file checks to `pathlib.Path` in `engine_format.py`, `engine_git.py`, `engine_preview.py`, and `engine_update.py`.
   - Encapsulated `insetu:ensure-fresh-artifact` within `<insetu-ext-git-diffs>` lifecycle.

## Consequences
* **Positive**: Absolute transport decoupling with zero `jsonify` imports in extension engines.
* **Positive**: Deterministic, typed background worker contracts enabling automated contract validation.
* **Positive**: Clean in-app dependency installation experience for optional tools.
* **Positive**: 100% adherence to canonical API route prefix standards across the frontend.
* **Positive**: Unified sub-navigation header menus adhering to zero-CSS presentation standards.