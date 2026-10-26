# ADR 0079: Workflow Automation & Task Management Extension Suite Modernization: Flask Transport Decoupling, Typed Worker Contracts, and Canonical Route Normalization

## Status
Accepted (2026-10-26)

## Context
Following the core pipeline membrane decoupling (ADR 0072), DevOps extension suite modernization (ADR 0077), and Knowledge & Support extension suite alignment (ADR 0078), the Workflow Automation and Task Management extensions (`cronic`, `favorites`, `flow`, `hooks`, `tracker`) retained several architectural seams:
1. **Flask Transport Shell Bleed**: Several engines directly imported `from flask import jsonify` or `from flask import request`, reading `ctx.req.json` and `ctx.req.args` directly and violating `FLASK_TRANSPORT_LEAK_BAN`.
2. **Untyped Worker Contracts**: Asynchronous background workers across `cronic`, `flow`, `hooks`, and `tracker` utilized generic `**kwargs` or un-annotated arguments, preventing synchronous typed contract validation and violating `WORKER_TYPED_SIGNATURE_MANDATE`.
3. **Undeclared Host Binaries**: `cronic` executed `crontab` without declaring host CLI dependencies on `InSetuExtension(...)`.
4. **Cross-Store Mutation & Floating Listeners in Flow**: `ext_flow.js` mutated `GatherStore` directly in `fetchBatches` (`CROSS_STORE_MUTATION_BAN`), coupled options to `GatherStore`, and registered an unmanaged floating `window.addEventListener('insetu:ensure-fresh-artifact')` at module scope.
5. **Non-Canonical API Route Calls**: Frontend extension scripts invoked endpoints without module prefixes (e.g. `this.api.post('cronic/toggle')` vs raw relative routes, `this.api.post('flow/batches/save')`, `this.api.post('hooks/save')`, `this.api.postJson('tracker/new')`).
6. **Sub-Navigation Slot Drift in Hooks**: `ext_hooks.js` registered bespoke `InSetuExtHooksActions` in deprecated `slots:sub-navigation-actions`.
7. **Legacy Pathlib and URI Deprecations**: Modules invoked deprecated `parseURI()` rather than `InSetuURI`, and retained `os.path.splitext`, `os.listdir`, `os.path.getmtime`, `os.path.relpath`, and `os.path.expanduser`.

## Decision
1. **Flask Transport Decoupling & Unified Payload Access**:
   - Eradicated all `from flask import jsonify` and `from flask import request` imports across all five engines. Route handlers return plain Python dictionaries with optional HTTP status codes, letting `AkasaExtension.route` marshal responses at the HTTP boundary.
   - Standardized incoming request payload reading on unified `ctx.payload`.
2. **Strict Typed Worker Signatures (`@*.worker`)**:
   - Purged untyped `**kwargs` and un-annotated arguments across 11 background workers in `cronic`, `flow`, `hooks`, and `tracker`, declaring explicit Python type annotations on all parameters and confirming `ctx` as the first positional parameter.
3. **Declarative Host Binary Registration**:
   - Declared `external_binaries=["crontab"]` directly on `InSetuExtension(...)` in `cronic`.
4. **Flow Cross-Store Decoupling, Macro Preview Action Parity, and Encapsulated JIT Artifact Resolution**:
   - Purged cross-store `GatherStore.setState` mutations from `ext_flow.js` and decoupled `availableOptions` from `GatherStore`.
   - Encapsulated `insetu:ensure-fresh-artifact` strictly within `InSetuExtFlow.connectedCallback()` lifecycle management, purging floating window listeners.
   - Added `supportsMacroPreview: true` and `file-copy-expanded` to prompt entity actions in `InSetuFlowViewProjection`.
   - Registered `@flow_bp.on('heal_missing_domain_volume')` in `engine_flow.py` to trigger targeted workflow recompilations when `workflows` cache volumes are missing or cold on disk.
5. **Canonical API Route Prefix Normalization**:
   - Prefixed all `this.api.*` calls across `ext_cronic.js`, `ext_flow.js`, `ext_hooks.js`, and `ext_tracker.js` with explicit `<module>/<endpoint>` identifiers.
6. **Sub-Navigation Menu Consolidation**:
   - Eradicated bespoke `InSetuExtHooksActions` and `slots:sub-navigation-actions` in favor of declarative `menuActions` on `slots:sub-navigation`.
7. **Pathlib Compliance & InSetuURI Adoption**:
   - Replaced `os.path.splitext`, `os.listdir`, `os.path.getmtime`, `os.path.relpath`, and `os.path.expanduser` with `pathlib.Path` methods across `engine_cronic.py`, `engine_hooks.py`, and `engine_tracker.py`.
   - Replaced deprecated `parseURI()` invocations with `new this.utils.InSetuURI()` across `ext_favorites.js`, `ext_flow.js`, and `ext_tracker.js`.
   - Centered automation rule cryptographic approvals around `.insetu/host.json` (`get_daemon_host_config_path()`).

## Consequences
* **Positive**: Absolute transport decoupling with zero `jsonify` imports across extension engines.
* **Positive**: Deterministic, typed background worker contracts enabling automated contract validation.
* **Positive**: Zero cross-store mutations and clean lifecycle-managed artifact event listeners.
* **Positive**: 100% adherence to canonical API route prefix standards across the frontend.
* **Positive**: Zero-CSS presentation purity and unified sub-navigation menus.