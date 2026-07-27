---
title: "Blueprint: Core Kernel Extraction & Three-Tier Architecture"
date: 2026-07-27
author: Architect
status: approved
tags: ["Architecture", "Kernel", "Decoupling", "Framework"]
---

# Blueprint: Core Kernel Extraction

## 1. Context & Philosophy
The virtual sub-bucket strategy (2026-07-11) partitioned our contextual focus, but virtual boundaries cannot enforce true structural Inversion of Control. Currently, application-specific domain logic (the "Developer OS") sits adjacent to the agnostic application shell (the "Kernel"). 

To evolve inSetu into an easily extractable, local-first framework for building web apps, we are formally adopting a Three-Tier Architecture: **Kernel**, **Core**, and **Extensions**.

## 2. Topological Boundaries

### Tier 1: The Kernel (`insetu/`)
The foundational, domain-agnostic web framework chassis. The Kernel handles physical hardware orchestration, security, and networking. It is entirely blind to LLMs, source code, or AI operations.
*   `app.py` & `cli.py` (Process execution and routing)
*   `auth.py` (Tailscale and token security)
*   `db.py` (SQLite connection pooling and schemas)
*   `workers.py` (Background ThreadPool and metronomes)
*   `hooks.py` (The Universal Event Bus)
*   `routes_fs.py` & `vfs.py` (Asynchronous VFS and atomic buffering, renamed from `context.py`)
*   `routes_system.py` (Agnostic API capabilities)
*   `sdk/` (The Extension Development Kit)

### Tier 2: The Core (`insetu/core/`)
The specific "Developer OS" product suite. These engines are shipped by default, cannot be disabled by the user, and are granted elevated privileges (e.g., bypassing VFS filters or manipulating system manifests).
*   `bridge/` (Yomama Sync Bridge and AST Compilation)
*   `gather/` (Context Assembly and RAG Payload Generation)
*   `cartographer/` (Workspace parsing and CODE_INDEX generation)

### Tier 3: The Extensions (`insetu/extensions/`)
Optional, domain-specific tooling built strictly on top of the SDK. Extensions have no special privileges, must use defined API accessors, and gracefully degrade if turned off.
*   `tracker/`, `git/`, `citations/`, `research/`, `term/`, etc.

## 3. Execution Mandates
To migrate to this topology, the following must occur:
1.  **VFS Clarity:** Rename `context.py` to `vfs.py` to accurately reflect its atomic `VFSTransaction` operations and clear up semantic overloading. Update all relative imports across the ecosystem.
2.  **Core Relocation:** Physically relocate `engine_bridge.py`, `engine_gather.py`, and `cartographer.py` into the new `insetu/core/` directory.
3.  **Bootloader Refactor:** Update `app.py` to securely boot Tier 2 (`core/`) engines before dynamically sweeping and mounting Tier 3 (`extensions/`) modules.
4.  **Frontend Extraction:** Mirror the DAG on the UI. Move `gather.js` and `bridge.js` from `static/js/` to `static/js/core/`.