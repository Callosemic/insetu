# ADR 0001: inSetu Genesis and Extension Architecture

**Date:** 2026-06-26
**Status:** Accepted

## Context
The internal Tooling Plane became too tightly coupled to its proprietary chassis, violating the principles of agnostic deployment. The monolith restricted our ability to leverage these tools (Context Gatherer, Sync Bridge, Kanban Tracker) across diverse external workspaces without migrating irrelevant legacy logic.

## Decision
We have formally extracted the Developer OS into an independent, pip-installable package named `inSetu`. To support localized feature sets (e.g., Reference Management) without bloating the core OS kernel, we have introduced a dynamic **Extension Architecture**.

## Consequences
* **Positives:** `inSetu` can now be mounted into any codebase via a simple `config.json` payload. Extensions (like `citations` or `term`) remain modular and do not load unless explicitly declared in the workspace configuration, preserving baseline RAM and ASGI cycles.
* **Negatives:** Shared configurations must now be carefully resolved using `utils_core.py` to ensure spatial physics remain accurate regardless of the execution directory, increasing the burden on path-resolution discipline.