# ADR 0029: Core Kernel Extraction and Three-Tier Architecture

## Status
Accepted (2026-07-27)

## Context
As the inSetu Developer OS matured, core OS engines (`engine_bridge.py`, `engine_gather.py`, `cartographer.py`) remained co-located with the agnostic application framework chassis (`app.py`, `cli.py`, `auth.py`, `vfs.py`). Virtual sub-bucket filtering isolated context payloads, but could not enforce structural Inversion of Control or prevent architectural bleed.

## Decision
We formally adopt a Three-Tier Architecture:
1. **Tier 1: The Kernel (`insetu/`)**: Agnostic web framework chassis handling HTTP routing, process lifecycle, security token gatehouse, VFS transaction queue, and SDK base classes.
2. **Tier 2: The Core (`insetu/core/` & `insetu/static/js/core/`)**: Product-specific Developer OS engines (`bridge`, `gather`, `cartographer`) shipped by default with elevated core privileges.
3. **Tier 3: The Extensions (`insetu/extensions/` & `insetu/static/js/extensions/`)**: Optional domain-specific capabilities built strictly on top of the Extension SDK.

All core engines (`bridge`, `gather`, `cartographer`) and their frontend JS counterparts are relocated to `insetu/core/` and `insetu/static/js/core/`.

## Consequences
* **Positive:** Clear architectural boundaries and physical Inversion of Control.
* **Positive:** Enables extraction of Tier 1 Kernel as an independent framework shell.
* **Negative:** Requires updating import paths across Tier 2 engines and Tier 3 extensions.