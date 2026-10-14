# ADR 0060: Git-Aware Topology CQRS Ledger, Real-Time Manifest Delta Sync, and Spatial Viewport Diff Projections

## Status
Accepted (2026-10-14)

## Context
Previously, tracking version control modifications across active workspaces was decoupled from the Virtual File System (VFS) and Topology engine. While `engine_git.py` provided repository-level diff generation and sweeps, the file tree UI (`InSetuFileTree`) and VFS manifest were blind to uncommitted Git modifications. Users were forced to navigate away from their active file tree into the Git extension to inspect whether files were dirty.

Furthermore, viewing differences between working buffers and Git HEAD was unavailable within spatial viewport columns. In the Yomama Sync Bridge, syntax errors and anchor mismatches were either represented as raw character streams in console telemetry or pushed into generic report projections without CodeMirror-grade side-by-side diff controls.

## Decision
1. **Topology Ledger Git Status Column (`engine_topology.py`)**:
   - Expanded `TOPOLOGY_SCHEMA` to include `"git_status": "TEXT DEFAULT ''"` in `topology_ledger`.
   - Updated `force_topology_scan` and `resolve_topology_buffer` to execute `git -c core.quotepath=false status --porcelain` via `execute_binary()`, caching relative path status codes directly in SQLite.
2. **Decentralized Manifest Signature Sync & Partitioned VFS Reflection**:
   - Updated `hook_topology_manifest_signatures` to include git modification counts (`mod_cnt`) in repository heartbeat signatures (`{cnt}-{max_ts}-{mod_cnt}`).
   - Updated `hook_request_vfs_manifest` and `/api/topology/vfs` to yield `git_modified: []` arrays per bucket.
3. **Synchronous Git Diff REST Gateway (`engine_fs.py`)**:
   - Implemented `GET /api/<workspace_id>/fs/git_diff` returning the `FileGitDiffResponse` contract (`filepath`, `repo`, `head_content`, `working_content`, `is_untracked`, `is_modified`).
   - Retrieves Git HEAD baseline content via `execute_binary(['git', 'show', f'HEAD:{rel_path}'])`.
4. **Spatial Viewport Diff Projections (`fs.js`, `bridge.js`)**:
   - Created `<insetu-file-diff-projection>` (`vfs:diff:<normPath>`) pinned to `LayoutStore`, rendering side-by-side comparisons between Git HEAD and working buffer content via `<sutram-diff-viewer>`.
   - Created `<insetu-bridge-diff-projection>` (`bridge:syntax-diff`) for side-by-side patch syntax and anchor mismatch diffs.
   - Added `_previewDiff` toggle in `<insetu-bridge-edit-projection>` to inspect SEARCH vs REPLACE blocks side-by-side during patch editing.
   - Registered `file-git-diff` polymorphic entity action on modified files.
5. **Directory Traversal Normalization**:
   - Standardized tree traversal and directory state calculation in `ui_file_tree.js` and `openWorkspaceBrowser` (`fs.js`) on Sutram's `resolveDirectoryState` utility.

## Consequences
* **Positive**: Real-time Git dirty state visibility in the file tree without running ad-hoc Git subprocesses during rendering.
* **Positive**: Non-blocking side-by-side diff inspection for working tree files and incoming Yomama patch blocks within spatial viewport columns.
* **Positive**: Strict UDF flow from the SQLite topology ledger through manifest signatures down to Web Components.
* **Negative**: Adds a minor subprocess execution overhead to `resolve_topology_buffer` for touched repositories (bounded by dirty repo sets).