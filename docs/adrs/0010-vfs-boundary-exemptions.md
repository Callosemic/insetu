# 0010: Unified VFS Write-Path & Event Filtering (Recursion Short-Circuiting)

## Status
Accepted (2026-07-05)

## Context
Routing all file modifications through the asynchronous `_VFS_WRITE_QUEUE` (`execute_vfs_save`) is critical for atomic commits. However, routing system artifacts (e.g., `CODE_INDEX.md`, compiled `.txt` contexts) through the VFS triggers the `post_file_save` lifecycle event, which historically caused infinite recursive loops (e.g., Cartographer mapping triggers a save, which triggers Cartographer).

## Decision
Rather than fracturing the write-path by exempting artifacts from the VFS, we maintain a 100% unified write-path. To prevent recursion, we implement **Event Filtering** at the listener level:
1. **The Unified Pipeline:** All engines (`cartographer.py`, `engine_gather.py`, `engine_bridge.py`) MUST write to disk using `execute_vfs_save`.
2. **Short-Circuiting:** Event Bus listeners must inspect the `filepath` payload and immediately return if the file is their own artifact.
    * *Example:* Cartographer listens to `post_file_save`, but if `filepath.endswith('CODE_INDEX.md')`, it short-circuits and ignores the event.
    * *Example:* Gather listens to `post_file_save`, but if `filepath.endswith('_context.txt')`, it short-circuits.
3. **Downstream Propagation:** Because the artifact was saved via VFS, other systems are still free to react to it (e.g., Git sweeping the new `CODE_INDEX.md`).

## Consequences
* **Positive:** Preserves the Virtual File System as the absolute Single Source of Truth (SSOT) for disk I/O.
* **Positive:** Decouples the VFS from needing domain-specific knowledge about what files are being saved.
* **Positive:** Allows artifact generation to safely trigger downstream workflows without infinite looping.