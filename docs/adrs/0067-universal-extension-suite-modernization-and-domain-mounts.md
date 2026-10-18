# ADR 0067: Universal Extension Suite Modernization, Cross-Workspace Domain Sharing, and Canonical URI Enforcement

## Status
Accepted (2026-10-18)

## Context
Following the core stabilization milestones of ADR 0065 (Repository Data Containment) and ADR 0066 (Canonical URIs and Inter-Workspace Mounts), the Tier 3 domain extensions required a comprehensive alignment pass:
1. **URI Path Ambiguity in Extensions**: Extensions continued to call `InSetuURI.from_any()`, rely on `@hooks.on('coerce_naked_uri')` shims, or pass un-prefixed relative paths to VFS and database layers.
2. **Inter-Workspace Domain Sharing**: While the kernel substrate supported `ws://` virtual mounts for generic assets, extensions managing structured domain entities (such as `flow` workflow batches and `notes` documents) did not natively discover, display, or safely guard read-only shared entities originating from peer workspaces.
3. **Frontend Store Subscription & Filter Duplication**: Components across extensions manually wired `this.subscribe` listeners with repetitive `autoFetch` calls, and duplicated two-tier repository pinning and fuzzy text filtering logic.
4. **Pop-out Viewport Parity**: Spatial pop-out capabilities (`allow_popout: true`) were restricted to core editors, leaving tracker, notes, and terminal confined to the primary window.

## Decision
1. **Universal Canonical URI Enforcement Across Extensions**:
   - Upgraded all 17 domain extensions (`citations`, `cronic`, `dev`, `favorites`, `flow`, `format`, `freshdesk`, `git`, `hooks`, `ingest`, `notes`, `research`, `skills`, `tailscale`, `term`, `tracker`, `update`) to enforce canonical scheme prefixes (`vfs://`, `ctx://`, `ws://`).
   - Purged `@hooks.on('coerce_naked_uri')` listeners from `engine_flow.py` and `engine_git.py`.
   - Added automatic database migrations upgrading legacy rows to canonical URIs in `tracker_tickets`, `skills_ledger`, `cronic_jobs`, and `favorites`.
   - Standardized document creation on `ctx.create_entity_file()`.
2. **Cross-Workspace Domain Mounts (`flow` & `notes`)**:
   - Implemented `_discover_mounted_batches` in `engine_flow.py`, discovering shared batches from peer workspaces via `ctx.get_shared_mounts(domain="flow")`, rewriting prompt targets to `ws://{ws}/prompts/...`, and enforcing read-only status in the UI (`match: (data) => !data?.is_shared`).
   - Implemented `NotesVFSDriver` and `_discover_mounted_notes` in `engine_notes.py` to transparently resolve co-located notes in `<repo>/.insetu-data/notes/` and shared notes across mounted workspaces.
3. **Universal SDK Ergonomics (`this.bindStore()` & `this.filterItems()`)**:
   - Migrated all extension Web Components to `this.bindStore(Store, selector, { autoFetch })`.
   - Consolidated list and card filtering across `citations`, `flow`, `git`, `notes`, and `tracker` on `this.filterItems(items, options)`.
4. **Spatial Pop-out Viewport Parity**:
   - Enabled `allow_popout: true` on `tracker`, `notes`, and `term`.
   - Wired `<insetu-projection-window-controls>` into terminal action bars and integrated popout focus checks in `NotesStore`.
5. **System Binary & Pacing Hardening**:
   - Routed `engine_tailscale.py` through `execute_binary()`.
   - Fixed `DOWNLOAD_URI_PATH_BAN` in `ext_dev.js` via `window.inSetu.vfs.resolveFileFetchUrl()`.
   - Declared dynamic pacing configuration parameters in `RESEARCH_SETTINGS_SCHEMA`.

## Consequences
* **Positive**: Absolute mathematical certainty across URI boundaries with zero implicit path guessing across the entire extension suite.
* **Positive**: Fluid, secure cross-workspace knowledge sharing for workflow batches and notes.
* **Positive**: Drastic reduction in component boilerplate and complete elimination of render thrashing.
* **Positive**: Universal popout capabilities across developer tools.