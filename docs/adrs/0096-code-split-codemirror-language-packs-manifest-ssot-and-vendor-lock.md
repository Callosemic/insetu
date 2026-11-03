# ADR 0096: Code-Split CodeMirror Language Packs, Manifest-Driven Mode Resolution, Layer-3 Local Packs, and Vendor Lock Verification

* **Status:** Accepted
* **Date:** 2026-10-31
* **Scope:** `scripts/codemirror/*`, `scripts/vendor_codemirror.sh`, `scripts/vendor_lock.py`, `insetu/core/editor/engine_editor.py`, `insetu/core/system/components/ui_editor.js`, `insetu/static/vendor.json`

## Context

Under security decision S4 ("No code downloads at runtime"), editor syntax highlighting must rely strictly on locally bundled or person-placed language packs. Previously:
1. `resolveEditorMode()` in `ui_editor.js` used a hardcoded 15-entry table that mapped `.rs`, `.sh`, and `.go` to packs that did not exist, mapped `.json` and `.ts` to plain JavaScript, and omitted common files like `.toml` and `Dockerfile`.
2. `static/vendor/codemirror/` contained stale `esm.sh` shims (`state.js`, `view.js`, `merge.js`) and standalone `lang-*.js` files that bundled duplicate copies of `@lezer/common`, breaking CodeMirror's object-identity facet checks.
3. `scripts/vendor_codemirror.sh` installed unpinned packages and had no lockfile to detect stale files or hand edits.

## Decision

1. **Single Code-Split Build from Pinned Versions (`scripts/codemirror/`)**:
   * Commit `package.json`, `package-lock.json`, `languages.src.json`, and `build.mjs` in `scripts/codemirror/`.
   * Build `codemirror-core.js`, `lezer/{common,highlight,lr}.js`, `lang/<id>.js` (Layer 1 official Lezer packs), and `legacy/<id>.js` (Layer 2 `@codemirror/legacy-modes` stream parsers) in one `esbuild` invocation with `--splitting --format=esm` so every entry shares a single copy of `@codemirror/*` and `@lezer/*` via `chunks/*.js`.
   * Validate all declared exports in Node at build time, copy per-package MIT licenses into `static/vendor/codemirror/licenses/`, write `languages.json`, and update `static/vendor.json` with exact versions and `@lezer/*` specifiers.
2. **Manifest-Driven Resolution & Layer-3 Local Packs (`engine_editor.py`, `ui_editor.js`)**:
   * Expose `GET /api/<workspace_id>/editor/languages` returning the merged manifest (`static/vendor/codemirror/languages.json` plus valid local packs in `.insetu/vendor/codemirror/languages.json` and bare `lang-<id>.js` files, with bundled IDs always taking precedence).
   * Update `POST /api/<workspace_id>/editor/vendorize` to return full descriptors (`{ status, path, url, kind, export, options }`).
   * Drive `resolveEditorMode()` from the manifest, matching exact `filenames` (`Dockerfile`, `.bashrc`, `CMakeLists.txt`, etc.) before `extensions`.
3. **Cryptographic Vendor Lock (`scripts/vendor_lock.py`)**:
   * Add the `codemirror` target (`sync_codemirror`, `check_codemirror`) recording the SHA-256 of `scripts/codemirror/package-lock.json` and the tree digest of `static/vendor/codemirror/` in `codemirror.lock.json`.

## Consequences

* **Positives:** 39 languages highlight offline out of the box with shared `@lezer/*` singletons; zero stale CDN shims; deterministic builds enforced by `test_codemirror_bundle.py` and `test_vendor_lock.py`.
* **Trade-offs:** Adding or updating bundled languages requires running `bash scripts/vendor_codemirror.sh` and committing the updated bundle and lockfile.
