# ADR 0078: Knowledge & Support Extension Suite Modernization: Flask Transport Decoupling, Typed Worker Contracts, and In-App Dependency Installation

## Status
Accepted (2026-10-26)

## Context
Following the core pipeline membrane decoupling (ADR 0072), knowledge suite encapsulation (ADR 0074), and DevOps extension suite alignment (ADR 0077), the Knowledge, Authoring, and Support extensions (`citations`, `freshdesk`, `ingest`, `notes`, `publish`, `research`, `skills`) retained several architectural seams:
1. **Flask Transport Shell Bleed**: Several engines directly imported `from flask import jsonify` and `from flask import request`, directly reading `ctx.req.json` or `ctx.req.args` and violating `FLASK_TRANSPORT_LEAK_BAN`.
2. **Untyped Worker Contracts**: Asynchronous workers across `citations`, `freshdesk`, `ingest`, `publish`, and `research` utilized generic `**kwargs` or un-annotated arguments, preventing synchronous typed contract validation and violating `WORKER_TYPED_SIGNATURE_MANDATE`.
3. **Undeclared & Un-managed Dependencies**: Optional PyPI packages (`beautifulsoup4`, `playwright`, `markdownify`, `mistune`) and host binaries (`pandoc`, `pdflatex`) were declared via ad-hoc module dunders (`__external_depends__`) or undeclared, leaving operators to decipher missing-import errors manually.
4. **Cross-Module Private Import Bleed**: `engine_research.py` directly imported `from insetu.extensions.ingest.engine_ingest import extract_markdown_from_url as _extract_markdown_from_url`, creating tight code coupling and bypassing capability contracts.
5. **Non-Canonical API Route Calls**: Frontend extension scripts invoked endpoints without module prefixes (e.g., `this.api.get('list')` instead of `this.api.get('citations/list')`, `this.api.post('start')` instead of `this.api.post('research/start')`).
6. **Presentation Purity & Cross-Store Leaks**: `ext_citations.js` and `ext_skills.js` contained raw HTML `<input type="radio">`, `<button>`, and `<form>` tags; `ext_notes.js` mutated `OfflineStore` directly (`CROSS_STORE_MUTATION_BAN`); and `ext_publish.js` and `engine_publish.py` used legacy unauthenticated `/download/` routes.

## Decision
1. **Flask Transport Decoupling & Unified Payload Access**:
   - Eradicated `from flask import jsonify` and `from flask import request` across all seven engines. Route handlers return plain Python dictionaries with optional HTTP status codes, letting `AkasaExtension.route` marshal responses at the HTTP edge.
   - Standardized incoming request payload reading on unified `ctx.payload`.
2. **Strict Typed Worker Signatures (`@*.worker`)**:
   - Purged `**kwargs` and un-annotated arguments across 11 background workers in `citations`, `freshdesk`, `ingest`, `publish`, and `research`, declaring explicit Python type annotations on all parameters.
3. **Declarative Extension Dependency Contracts & In-App Installation**:
   - Declared PyPI dependencies, system binaries, and post-install commands directly on `InSetuExtension(...)` constructors (`external_dependencies`, `external_binaries`, `post_install_commands`).
   - Added in-app package installation banners and binary missing diagnostics in `<insetu-ext-ingest-modals>`, `<insetu-ext-publish-modals>`, and `<insetu-ext-research>`.
4. **In-Process Cross-Extension Capability Dispatch (`ctx.call`)**:
   - Replaced private cross-module imports in `engine_research.py` with `ctx.call("ingest.url", url=target_url, method=parser_type, wait=True)`.
5. **Canonical API Route Prefix Normalization**:
   - Prefixed all `this.api.*` calls with explicit `<module>/<endpoint>` identifiers across all seven extension frontend scripts.
6. **Sutram Presentation Purity & Cross-Store Cleanup**:
   - Replaced raw form elements and buttons with Sutram primitives (`<sutram-select>`, `<sutram-btn>`, `<sutram-async-btn>`), removed `InSetuExtResearchActions` in favor of declarative `menuActions` on `slots:sub-navigation`, and purged illegal cross-store mutations in `ext_notes.js`.
7. **Canonical Artifact Fetch & Pathlib Compliance**:
   - Migrated publish and research downloads to `/api/<ws>/fs/fetch?file=...&download=1` and replaced `os.path.exists()` with `Path.exists()` in `engine_notes.py` and `engine_publish.py`.
   - Registered `@research_bp.on('vfs_resolve_file')` handler in `engine_research.py`.

## Consequences
* **Positive**: Absolute transport decoupling with zero `jsonify` imports across extension engines.
* **Positive**: Deterministic, typed background worker contracts enabling automated contract validation.
* **Positive**: Clean in-app dependency installation experience for optional tools.
* **Positive**: Strict Inversion of Control with in-process capability dispatch.
* **Positive**: 100% adherence to canonical API route prefix standards across the frontend.
* **Positive**: Zero-CSS presentation purity and complete elimination of cross-store mutations.