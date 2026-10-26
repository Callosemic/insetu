# ADR 0076: Dual-Representation Macro Previews, Declarative Dependency Whitelisting, Flask Transport Decoupling, and Tier 2 Membrane Decoupling

## Status
Accepted (2026-10-26)

## Context
As the inSetu Developer OS broadened support for prompt engineering workflows, automated agent loops, and modular extensions, several architectural seams required definitive consolidation:
1. **Destructive Macro Overwrites**: When operators opened template documents containing `{{include_prompt:...}}` or `{{ macro_* }}` parameters, resolving macros at fetch time caused the expanded output to overwrite the raw macro template syntax upon save. Conversely, viewing raw text prevented operators from verifying parameter substitutions in real time.
2. **External Extension Dependency Drift**: Optional extensions (e.g., `research`, `ingest`, `format`) declared PyPI and system binary requirements across ad-hoc module dunders (`__external_depends__`, `__external_binaries__`). When dependencies were missing, operators were forced into terminal shells to decipher import errors and manually execute `pip install`.
3. **Flask Transport Shell Bleed in Core Engines**: Several Tier 2 core engines (`engine_editor.py`, `engine_fs.py`, `engine_system.py`) directly imported `from flask import jsonify` and directly inspected request transport streams (`ctx.req.args`, `ctx.req.json`). This coupled domain engines to the Flask WSGI chassis, violating `FLASK_TRANSPORT_LEAK_BAN`.
4. **Hardcoded Tier 3 Extension Checks in Tier 2**: `ui_editor.js`, `system.js`, and `api.js` contained explicit string checks for specific domain extensions (e.g., `notes`, `tracker`, `term`, `flow`), violating Inversion of Control and the 4-File Akasa Membrane boundary.
5. **InSetuURI Memory Parity & Pathlib Compliance**: `InSetuURI` lacked `__slots__ = ()`, generating unnecessary `__dict__` instances and breaking memory layout parity with `AkasaURI`. Furthermore, `InSetuURI.mtime()` invoked deprecated `os.path.getmtime`.
6. **Legacy `/download` Route**: The unauthenticated global `/download/<path:filename>` Flask route bypassed tenant-scoped VFS routing and WSGI slash normalization.

## Decision
1. **Dual-Representation Buffer & Macro Preview Architecture (`fs.js`, `ui_editor.js`, `utils_core.py`)**:
   - Standardized editable VFS buffers to strictly fetch unexpanded raw source text from `/fs/fetch`, guaranteeing that `{{include_prompt:...}}` and `{{ macro_* }}` directives are never destructively overwritten on save.
   - Integrated live macro preview into `FsStore.activeBuffers` (`previewMode`, `previewContent`, `previewLoading`, `toggleBufferPreview`).
   - Enhanced `InSetuEditorProjection` with an in-place macro preview banner, locking out keystrokes and auto-saves while in preview mode.
   - Registered `file-preview` and `editor-toggle-macro-preview` entity actions, along with expanded clipboard/export actions (`file-copy-expanded`, `file-share-expanded`, `file-download-expanded`).
   - Upgraded `resolve_macro_includes` in `utils_core.py` with balanced brace/quote scanning (`_extract_balanced_include_macros`) and parameter parsing (`_parse_macro_params`), supporting recursive nested macros and default fallback values (`{{ macro_var | default_val }}`).
2. **Declarative Dependency Contracts & Whitelisted In-App Installation (`sdk/__init__.py`, `engine_system.py`, `ui_system_settings.js`, `insetu_sdk.js`, `store.js`)**:
   - Added `external_dependencies`, `external_binaries`, `post_install_commands`, and `requires_reboot_on_install` parameters to `InSetuExtension.__init__`.
   - Added `EXTERNAL_DEP_SPEC_MAP` and `resolve_external_dependency_spec()` to eliminate package name vs. import specifier mismatches (e.g., `bs4` $\leftrightarrow$ `beautifulsoup4`).
   - Implemented `_get_whitelisted_extension_packages()` and `@system_bp.worker("install_extension_deps_task")` background worker executing pip installs and post-install commands strictly against whitelisted packages.
   - Added `getMissingDependencies()` and `installExtensionDependencies()` helpers to `InSetuElement`, rendering in-place "Install Now" async buttons in the Settings Hub.
3. **Flask Transport Shell Decoupling & Unified Payload (`engine_editor.py`, `engine_fs.py`, `engine_system.py`)**:
   - Eradicated `from flask import jsonify` across all core engine routes, returning plain Python dictionaries and letting `AkasaExtension.route` handle HTTP JSON serialization.
   - Replaced direct `ctx.req.args` and `ctx.req.json` accesses with unified `ctx.payload` across all route handlers.
   - Purged the unauthenticated global `/download/<path:filename>` Flask route and consolidated file reads, binary streaming, and downloads into `api_fs_fetch` via `/api/<workspace_id>/fs/fetch?file=...&download=1`.
4. **Tier 2 Domain & Extension Decoupling (`ui_editor.js`, `system.js`, `api.js`, `ui_file_tree.js`)**:
   - In `ui_editor.js`, purged hardcoded Tier 3 extension checks in `sutram:restore-docked-projection`, delegating to `ExtensionRegistry.resolveCustomEditor()` and `InSetuURI.isEditable`.
   - In `system.js`, made popout script discovery agnostic by matching `ctxMatch = targetPath.match(/^ctx:\/\/([a-z0-9_]+)\//)`.
   - In `api.js`, decoupled `isOfflineCapable` from hardcoded extension lists, evaluating declarative `extManifest.offline_mode` and `window.inSetu.isCore()`.
   - In `ui_file_tree.js`, offloaded fuzzy search to `SutramWorker.dispatch('FUZZY_SEARCH')` for sets $> 500$ items.
5. **InSetuURI Slotted Purity & Pathlib Normalization (`utils_core.py`, `legacy.py`, `cli_commands.py`)**:
   - Added `__slots__ = ()` to `InSetuURI` to prevent `__dict__` overhead and maintain slotted memory parity with `AkasaURI`.
   - Migrated `InSetuURI.mtime()` from `os.path.getmtime` to `Path(phys).stat().st_mtime`.
   - Added fallback simple YAML parser and serializer in `utils_core.py` for resilience when `ruamel.yaml` is absent.
   - Delegated legacy `system.json` splitting in `legacy.py` to kernel `heal_daemon_config_files()`.
   - Consolidated `cli_commands.py` profile scaffolding and working directory resolution via `set_daemon_cwd()`.

## Consequences
* **Positive**: Absolute protection of prompt macro templates from destructive save overwrites.
* **Positive**: One-click, in-app installation of extension dependencies with mathematical package whitelisting.
* **Positive**: Pure framework decoupling with zero `jsonify` imports in core engines.
* **Positive**: Complete Inversion of Control across editor projection routing and offline capabilities.
* **Positive**: High-performance slotted URI parsing and non-blocking Web Worker fuzzy searches.
* **Negative**: In-app package installations require outbound internet connectivity to PyPI.