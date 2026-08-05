# Architectural Blueprint: Kernel Decoupling & Agnostic Substrate

**Date:** August 3, 2026  
**Status:** Proposed  
**Focus:** Ecosystem Decoupling & Micro-Kernel Extraction  

---

## 1. Executive Summary

Currently, `insetu/kernel/` serves as the foundational micro-framework for the inSetu Developer OS. However, it retains a few hardcoded dependencies on the `insetu/core/` and `insetu/static/` directories. To achieve a truly agnostic architecture—allowing the kernel to be packaged, distributed, and utilized independently (e.g., as a standalone `sutram-kernel` PyPI package)—we must systematically sever these remaining topological entanglements.

---

## 2. Decoupling the Virtual File System (VFS)

**The Leak:** 
Inside `insetu/kernel/vfs.py`, the `VFSTransaction.read()` method explicitly imports `resolve_vfs_file` from `insetu.core.routes_fs` to resolve `system://` URIs.

**The Fix:** 
* Remove the explicit `routes_fs` import from the kernel.
* Rely entirely on the `hooks.emit('vfs_resolve_file')` event bus broadcast. The core OS routes (or individual extensions) will subscribe to this hook and return physical paths, maintaining strict inversion of control.

---

## 3. Abstracting Event Bus Authorization

**The Leak:** 
The `_is_authorized` boundary filter in `insetu/kernel/hooks.py` explicitly checks `if mod.startswith('insetu.core.')` to grant bypass privileges for Tier 2 modules.

**The Fix:**
* Implement a dynamic namespace registry on the `HookRegistry` class (e.g., `hooks.register_trusted_namespace()`).
* The OS bootloader will register `insetu.core` during the boot sequence, allowing the kernel to remain completely blind to the host application's directory structure.

---

## 4. Agnostic Bootloader and Recovery Engine

**The Leak:** 
`insetu/app.py` acts as both the kernel igniter and the OS bootloader, utilizing hardcoded `try/except` blocks to manually look for and mount `insetu.core.routes_system` and `insetu.core.routes_fs`. Additionally, `fallback_bridge.py` hardcodes the `insetu/core/` and `insetu/static/js/core/` directories for its emergency context dumps.

**The Fix:**
* Refactor `app.py` to dynamically discover and mount Tier 2 core modules via a topology registry or programmatic scan, mirroring how Tier 3 extensions are currently handled.
* Extract the `target_dirs` array in `api_emergency_dump` (`fallback_bridge.py`) into a configurable environment variable or a fallback topology configuration file.

---
## 5. Abstracting Core Module Registration (`kernel/utils.py`)

**The Leak:**
`is_core_module()` relies on a hardcoded `CORE_MODULES` set (`{'bridge', 'gather', 'cartographer', 'config', 'fs', 'system', 'workers', 'auth', 'security'}`).

**The Fix:**
* Expose a `register_core_module()` function in the kernel.
* Have the OS bootloader dynamically inject its core modules into the registry at runtime.

---

## 6. Abstracting Extension Namespaces (`kernel/hooks.py`)

**The Leak:**
`_is_authorized` hardcodes the extension boundary check: `if event_name == 'system_boot' and mod.startswith('insetu.extensions.'):`.

**The Fix:**
* Create an untrusted namespace registry (e.g., `register_extension_namespace()`).
* The kernel will validate against this registry instead of assuming the existence of an `insetu.extensions` directory.

---

## 7. Decoupling File Watchers (`kernel/workers.py`)

**The Leak:**
In `start_workers()`, the kernel directly parses inSetu business logic (`cfg.get("target_repos")` and `archive_type`) to configure local `watchdog` observers.

**The Fix:**
* Decouple the worker engine from OS concepts like "target repositories".
* Have the OS emit a `register_filesystem_watchers` event during boot, passing a simple list of physical paths for the kernel to watch agnostically.

---

## 8. Implementation Sequence

1. **VFS Abstraction:** Patch `VFSTransaction.read()` to utilize the event bus exclusively.
2. **Namespace Trust & Registration:** Implement dynamic registries for trusted/untrusted namespaces and core modules (`hooks.py`, `utils.py`).
3. **Bootloader Refactoring:** Convert `app.py` to dynamically discover core modules and register namespaces.
4. **File Watcher Decoupling:** Shift watchdog configuration logic to an OS-level event hook.
5. **Lifeboat Refactoring:** Abstract the `fallback_bridge.py` hardcoded paths.