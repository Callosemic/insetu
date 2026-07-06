# 0012: Extension Subdirectory Extraction

## Status
Accepted (2026-07-05)

## Context
As the extension ecosystem expanded, domain-specific engines (`engine_git.py`, `engine_tracker.py`) and their corresponding frontend scripts (`ext_git.js`) were polluting the root `insetu/` and `static/js/` directories. This blurred the physical boundary between the core micro-kernel (orchestration) and optional domain capabilities.

## Decision
We established explicit physical boundaries for optional domains:
1. Backend extensions must reside in `insetu/extensions/`.
2. Frontend UI extensions must reside in `insetu/static/js/extensions/`.
3. The dynamic bootloaders in `app.py` and `app.js` will first attempt to load from these `extensions/` subdirectories before falling back to the core chassis for legacy support.

## Consequences
* **Positive:** The core directory structure is pristinely constrained to OS substrates (`app.py`, `engine_bridge.py`, `engine_gather.py`, `utils_core.py`).
* **Positive:** Bulk static analysis and dependency mapping can isolate extensions by directory prefix.
* **Negative:** Requires strict pathway coordination when managing static assets bundled natively inside extension folders.