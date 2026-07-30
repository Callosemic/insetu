# ADR 0031: Sutram Micro-Kernel Vendorization and Unified VFS Save Transactions

## Status
Accepted

## Context
As the inSetu Developer OS separated into a Three-Tier Architecture (ADR 0029), frontend presentation primitives, shortcut routers, background job pollers, and Zustand store creation logic remained co-located inside core chassis files (`app.js`, `store.js`, `sdk.js`). This hindered presentation decoupling. 

On the backend, `save_json_file()` in `utils.py` used string checks to decide whether to push directly to `_VFS_WRITE_QUEUE` or write directly using native `open()`, violating Event Ledger parity (ADR 0018).

## Decision
1. **Sutram Micro-Kernel Vendorization (`insetu/static/vendor/sutram/`)**:
   - Extracted presentation layout (`sutram-app-shell`), state management (`createSutramStore`), job polling (`createJobPoller`), shortcut routing (`initShortcutRouter`), and shared styles into a vendorized Tier 0 presentation kernel.
   - Refactored `sdk.js`, `store.js`, `fs.js`, `app.js`, and `shared_styles.js` to subclass and wrap Sutram primitives while preserving multi-tenant workspace scoping.
2. **Gather Engine Route & Worker Extraction**:
   - Extracted `_background_compile`, `/submit` route handling, `/api/<workspace_id>/manifest`, and `/download/<path:filename>` out of `app.py` into `engine_gather.py` and `routes_fs.py`.
   - Removed `engine_gather` imports from `routes_fs.py` to enforce strict Tier 1 Kernel isolation.
3. **Unified VFS Save Route**:
   - Updated `save_json_file()` in `utils.py` to process all JSON writes through `VFSTransaction(wid)` with absolute artifact flags.

## Consequences
* **Positive:** Complete presentation-layer decoupling and pure UDF state factories.
* **Positive:** Tier 1 Kernel routes (`routes_fs.py`) operate without importing Tier 2 engines (`engine_gather.py`).
* **Positive:** Unified VFS transaction write path for all JSON state modifications.