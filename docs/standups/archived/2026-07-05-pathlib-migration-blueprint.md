# Architecture Blueprint: Safely Migrate to Pathlib (POSIX Enforcement)

**Date:** 2026-07-05
**Mission:** To eradicate fragile string concatenations (`os.path.join`) and manual `replace('\\', '/')` hacks, upgrading the OS to Python's modern `pathlib` for true cross-platform Windows/POSIX compatibility.

## The Context and The Risk
The backend OS kernel heavily relies on raw strings to evaluate routing containment, physical I/O boundaries, and JSON manifest generation. 

While migrating to `pathlib` is essential for long-term maintainability, it introduces a severe JSON serialization risk. The VFS pipeline and UI state stores strictly expect POSIX-style string paths. If we miss even a single conversion layer, we risk throwing a `TypeError: Object of type PosixPath is not JSON serializable` at the REST boundary, which would shatter the topology indices and cause fatal VFS commit rollbacks.

This migration must be executed in strict, tested phases to ensure the Cartographer and VFS remain blind to the underlying path object types.

## Phase 1: Utility Refactor (`utils_core.py`)
* Convert `resolve_workspace_path`, `get_valid_workspace_files`, and `get_omniscient_workspace_files` to compute layouts using `pathlib.Path`.
* **CRITICAL GUARDRAIL:** Explicitly cast all outgoing `Path` objects back to strings using `.as_posix()` before they return to callers. The rest of the application must continue to receive standard POSIX strings.

## Phase 2: Cartography & Git Engines
* Refactor manual `os.walk` operations into `Path.rglob()`.
* Maintain the `.as_posix()` boundary enforcement when constructing the `CODE_INDEX.md` outputs or iterating through Git diff manifests. 

## Phase 3: Unit Testing Scaffold (`tests/test_pathlib_migration.py`)
Before the migration is merged, we must implement an explicit unit testing suite to guarantee VFS safety.

1. **Test 1: Security Containment (Traversal Locks)**
   * Pass malicious traversal strings (e.g., `../../etc/passwd` or `....//config.json`) into the new `resolve_workspace_path`.
   * Assert that the Pathlib `resolve()` bounds strictly to the workspace root and denies the escape.

2. **Test 2: JSON Boundary Safety (Serialization)**
   * Mock a `save_json_file` call using the outputs of the newly refactored pathing methods.
   * Assert that `json.dumps()` succeeds, verifying that zero raw `PosixPath` objects bled into the serialization layer.

3. **Test 3: Platform Agnosticism (Windows -> POSIX)**
   * Inject mock Windows-style directory strings (e.g., `C:\\Users\\Dev\\Repo\\file.py`).
   * Assert that `Path(...).as_posix()` successfully normalizes the output to `C:/Users/Dev/Repo/file.py` without stripping root anchors.

## Execution Notes
* Do not attempt a partial migration. The backend sweeps must be exhaustive.