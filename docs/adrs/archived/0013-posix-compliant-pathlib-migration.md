# 0013: POSIX-Compliant Pathlib Migration

## Status
Accepted (2026-07-05)

## Context
The codebase historically relied on `os.path.join` and manual `.replace('\\', '/')` hacks to manage spatial physics across Windows and UNIX environments. This string-based manipulation is fragile and prone to trailing slash errors during deep directory traversals.

## Decision
We are migrating all spatial resolution algorithms (especially within `utils_core.py` and `cartographer.py`) to leverage Python's native `pathlib.Path` standard. 

* **Boundary Guardrail:** To maintain backward compatibility with JSON serialization layers and frontend manifest routing, all `Path` objects must be cast back to strings using `.as_posix()` before exiting their utility functions. `PosixPath` objects must never leak into the REST transport shell.

## Consequences
* **Positive:** Absolute cross-platform parity without regex or string slicing logic.
* **Positive:** Built-in `.resolve()` and `.parent` interfaces simplify genesis path ambiguity algorithms.
* **Negative:** Gradual refactor debt. Currently, static analysis flags hundreds of `os.path.join` violations across un-migrated route controllers that will require sequential remediation.