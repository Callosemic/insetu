# Standup & Architecture Blueprint: Parallel Polyglot Vendorization & Two-Stage Bootstrapping

**Date:** July 29, 2026  
**Status:** Approved / Blueprint  
**Subsystem:** Micro-Kernel / Extension Architecture / Frontend & Backend SDK  

---

## 1. Executive Context & Problem Statement

To satisfy **ADR 0008 (Offline-First Synchronization)** and protect against external CDN outages, the application must operate completely decoupled from third-party networks (e.g., `esm.sh`).

### Architectural Challenges Identified:
1. **Path Leakage & Hardcoding:** Forcing extensions to import dependencies using hardcoded disk paths couples components to physical layouts.
2. **DOM & Custom Element Collisions:** If two extensions vendor the same UI library, the second bundle throws a `NotSupportedError` DOM exception when attempting to re-register a custom element.
3. **The Import Map Boot-Order:** Modern browsers require `<script type="importmap">` to be injected *before* any ES modules are evaluated.
4. **Polyglot Independence:** A Python-only extension shouldn't require JS boilerplate, and a JS-only extension shouldn't require a Python backend to resolve its frontend dependencies.

---

## 2. Three-Tier Topology & Subsystem Boundaries

Vendorization responsibilities are cleanly decoupled into a Parallel Polyglot model:

* **Tier 1 (`sutram`):** The **Sutram Two-Stage Bootloader**. Entirely owns frontend JavaScript/CSS dependency injection, SemVer resolution, and dynamic import map generation natively in the browser.
* **Tier 2 (`insetu-kernel`):** The **Python Vendor Manager**. Entirely owns backend Python dependency injection, dynamically elevating `sys.path` and `sys.meta_path`.
* **Tier 3 (`extensions/*`):** Domain extensions declaring static `vendor.json` contracts.

---

## 3. The Unified Polyglot Contract (`vendor.json`)

Extensions declare dependencies via a static manifest (`vendor.json`). Both Sutram (JS) and the inSetu Kernel (Python) read from this exact same format.

```json
{
  "imports": {
    "xterm": {
      "path": "vendor/xterm.js",
      "version": "5.3.0",
      "range": ">=5.0.0 && <6.0.0"
    }
  },
  "python": {
    "mistune": {
      "path": "vendor/python/mistune",
      "version": "3.0.2",
      "range": ">=3.0.0 && <4.0.0"
    }
  }
}

```

---

## 4. Parallel Bootstrapping Architecture

Instead of the backend dictating the frontend, the system relies on Parallel Bootstrapping:

```text
               [ vendor.json Contracts ]
                       │   │
          ┌────────────┘   └────────────┐
          ▼                             ▼
  [ Sutram Bootloader ]        [ inSetu Python Kernel ]
     (Client-Side)                  (Server-Side)
          │                             │
 1. Fetch JSON manifests       1. Sweep JSON manifests
 2. Resolve SemVer (JS)        2. Resolve SemVer (Python)
 3. Inject <importmap>         3. Prepend to sys.path
 4. Await import(sdk.js)       4. Boot Flask/WSGI

```

### A. The Sutram Two-Stage Bootloader (Tier 1)

To satisfy browser ESM strictness, Sutram uses a Two-Stage boot process:

* **Stage 1 (Synchronous):** `sutram-boot.js` executes. It fetches all `vendor.json` files, evaluates the highest valid versions, and injects the synthesized `<script type="importmap">` directly into the DOM head.
* **Stage 2 (Asynchronous):** Once the map is physically in the DOM, it dynamically imports the main `sdk.js` Micro-Kernel, allowing native bare-specifier imports (e.g., `import { Terminal } from 'xterm'`).

### B. DOM & Web Component Guardrails

To prevent duplicate Web Component registrations from crashing the UI thread:

* **`customElements.define` Interceptor:** Sutram wraps `customElements.define`. If a tag name is already registered, the call logs a soft warning and returns gracefully rather than throwing an unhandled `NotSupportedError`.