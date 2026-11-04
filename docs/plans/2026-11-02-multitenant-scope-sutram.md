---
title: "RFC: Multi-Tenant Scope Isolation, Ordered Quiescence & Fault-Barrier Architecture"
status: "Active Blueprint"
created_at: "2026-11-02"
target_subsystems:
    - "sutram/sutram/js/sutram_sdk.js"
    - "sutram/sutram/js/app_shell.js"
    - "insetu/insetu/core/system/store.js"
    - "insetu/insetu/core/system/api.js"
    - "insetu/insetu/core/system/insetu_sdk.js"
    - "insetu/insetu/core/system/system.js"
    - "insetu/insetu/core/system/components/ui_primitives.js"
    - "insetu/insetu/core/system/components/ui_system_settings.js"
    - "insetu/insetu/core/system/engine_system.py"
    - "akasa/akasa/extension.py"
tags: [blueprint, rfc, sutram, akasa, insetu, multi-tenancy, state-machine, fault-isolation]
---

# RFC: Multi-Tenant Scope Isolation, Ordered Quiescence & Fault-Barrier Architecture

## 1. Architectural Context & Motivation

When `akasa` (the backend Python micro-kernel) was hardened for multi-tenant isolation and sandboxed resets, we solved three classes of cross-tenant race conditions at the kernel level:
1. **Ring-0 Execution Frame Authority (`akasa/context.py`):** Tenant identity (`workspace_id`) is owned by an immutable Ring-0 `ExecutionFrame` (`contextvars`), never inferred circularly from mutable application dictionaries.
2. **Ordered Quiescence Before Identity Swap (`akasa/__init__.py` `reset_state` & `akasa/vfs.py`):** Before changing `daemon_cwd` or tenant pointers, `akasa` first quiesces background workers (`_akasa_workers.reset()`) and drains pending VFS writes (`_akasa_vfs.drain_write_queue()`) while the *old* tenant resolver is still bound, preventing late writes or zombie callbacks from landing in the new tenant's namespace.
3. **Per-Callback Fault Isolation (`akasa/hooks.py` & `akasa/extension.py`):** In `HookRegistry.emit()` and `get_registered_settings_schemas()`, every extension callback is wrapped in an isolated `try...except` fault barrier and re-entrancy guard (`_event_thread_local.active_events` / `_HEAL_LOCAL.active`) so a broken or unmounted extension degrades gracefully to `[]` without taking down the kernel route with an HTTP 500.

On the frontend (`Sutram` ↔ `inSetu`), however, workspace switching evolved organically and currently violates all three of those laws:

### 1.1 The Three Systemic Flaws in the Current Frontend/Backend Swap Path

1. **Circular Identity Resolution:**
   * `StoreRegistry.getActiveScope()` in `sutram_sdk.js` delegates to `_scopeProvider()`, which calls `window.inSetu.utils.getActiveWorkspace()` in `store.js`.
   * `getActiveWorkspace()` reads `AppStore.getState().activeWorkspace`—and `AppStore` is itself a `scope: 'tenant'` store managed by `StoreRegistry`!
   * When `StoreRegistry.switchTenantScope(targetWs)` resets `AppStore` to its boot-time `initialState` (`activeWorkspace: 'default'`), the active tenant identity transiently reverts to `'default'` mid-swap.
2. **Conflated Daemon vs. Tenant Lifecycles in `AppStore` ("The God Store"):**
   * `AppStore` (`store.js`) mixes **Daemon/Process Envelope state** (`authToken`, `workspaces`, `isRebooting`, `isOffline`, `isReconciling`, `quarantinedModules`, `degradedCore`), **Transition Orchestrator FSM state** (`activeWorkspace`, `isSwappingWorkspace`, `swapPhase`), and **Disposable Tenant state** (`manifest`, `derivedVfsFiles`, `dirtyRepos`, `pinnedRepos`, `tabBrowsePaths`, `syncWatermarks`).
   * Because the transition lock (`isSwappingWorkspace`) lives *inside* a tenant store that is being reset, resetting the store momentarily unlocks the transition gate and triggers premature subscriber callbacks (`GET /api/default/system/config`) against the wrong tenant.
3. **Sub-Field Callable Schema Fragility on `/api/<ws>/system/config`:**
   * While `akasa.extension.get_registered_settings_schemas()` guards top-level callable schemas (`callable(schema_spec)`), `SYSTEM_SETTINGS_SCHEMA` in `engine_system.py` embeds a **callable nested inside a repeater's `item_schema` field** (`"options": get_mountable_data_domains` at line 139).
   * When `jsonify()` serializes `meta.settings_schemas` in `get_system_config()`, Python's JSON encoder crashes with `TypeError: Object of type function is not JSON serializable` unless every nested callable field option is resolved (and fault-guarded) prior to serialization!

---

## 2. Target Greenfield Architecture (Inspired by `akasa`)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ RING 0: SUTRAM SCOPE ROUTER & TRANSITION VALVE (sutram_sdk.js)               │
│  • Authoritative _activeScope & _phase ('READY'|'LOCKED'|'TEARDOWN'|         │
│    'IDENTITY_SWAP'|'HYDRATE'|'ROUTING')                                      │
│  • Kernel-level Subscriber Valve: tenant store listeners are muted while     │
│    isTransitioning() === true and fire once atomically on transition end.    │
├──────────────────────────────────────────────────────────────────────────────┤
│ RING 1: DAEMON ENVELOPE STORE (scope: 'global' — Survives Workspace Swaps)   │
│  • DaemonStore: authToken, workspaces, isOffline, isReconciling,             │
│    isRebooting, rebootType, quarantinedModules, degradedCore,                │
│    extensionDependencyMeta                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ RING 2: TENANT WORKSPACE STORES (scope: 'tenant' — 100% Disposable on Swap)  │
│  • AppStore: manifest, derivedVfsFiles, derivedGitModifiedSet, dirtyRepos,   │
│    dirtyBuckets, allRepos, targetConfigs, pinnedRepos, tabBrowsePaths,       │
│    outboxCount, pendingMutations, deletedMutations, syncWatermarks           │
│  • LayoutStore, SelectionStore, FsStore, GatherStore, BridgeStore, etc.      │
└──────────────────────────────────────────────────────────────────────────────┘

Pillar 1: Ring-0 Scope Authority & Ordered Quiescence in StoreRegistry (sutram_sdk.js)
Directly mirroring akasa/context.py (ExecutionFrame) and akasa/__init__.py (reset_state):
* Authoritative Scope Pointer: StoreRegistry owns _activeScope (string) and _phase ('READY' | 'LOCKED' | 'TEARDOWN' | 'IDENTITY_SWAP' | 'HYDRATE' | 'ROUTING').
    * StoreRegistry.getActiveScope() returns this._activeScope directly—never calling into a mutable Zustand store.
    * StoreRegistry.setActiveScope(scopeId) updates _activeScope and persists the scope pointer (sessionStorage / localStorage).
* The Kernel Subscriber Valve (Zero Mid-Swap Tears):
    * Inside SutramContextMixin.subscribe(), when a component subscribes to a store._storeScope === 'tenant' store, the listener wrapper checks StoreRegistry.isTransitioning().
    * While StoreRegistry.isTransitioning() is true (during LOCKED, TEARDOWN, IDENTITY_SWAP, and HYDRATE), component listener callbacks are held at the kernel valve (internal derived-state reducers on the store itself still compute).
    * When StoreRegistry.endScopeTransition() transitions _phase back to 'READY', the valve opens and flushes a single coherent update pass to all mounted subscribers with the fully hydrated new workspace state.
* First-Class StoreRegistry.transitionScope(targetScope, lifecycleHooks):
    await StoreRegistry.transitionScope(targetWs, {
    onTeardown: async (oldWs) => { /* Flush dirty VFS buffers & abort oldWs requests while getActiveScope() === oldWs */ },
    onIdentitySwap: (newWs) => { /* Persist storage pointer & clear active extensions */ },
    onHydrate: async (newWs) => { /* Fetch topology, config, outbox & manifest under newWs while valve is closed */ },
    onRoute: (newWs) => { /* Update URL hash & emit soft-refresh once valve opens */ }
});

Pillar 2: Zero-Cruft Lifetime Partitioning (DaemonStore vs. AppStore in store.js)
Instead of maintaining a preserveOnSwitch escape hatch or a bidirectional compatibility facade, every state key is assigned strictly to the store matching its physical lifetime:
* DaemonStore (createSutramStore('Daemon', ..., { scope: 'global' })):
    * Owns process-wide state that is invariant across workspace switches: authToken, workspaces, isOffline, isReconciling, isRebooting, rebootType, quarantinedModules, degradedCore, extensionDependencyMeta.
    * Because scope === 'global', StoreRegistry.switchTenantScope() never resets or touches DaemonStore.
* AppStore (createExtensionStore('App', ..., { localSync: ['pinnedRepos', 'tabBrowsePaths'] })):
    * Owns strictly tenant-scoped workspace state: manifest, derivedVfsFiles, derivedGitModifiedSet, derivedCtxKeys, dirtyRepos, dirtyBuckets, allRepos, targetConfigs, virtualContexts, categoryOrder, hiddenOutputs, tabOrder, pinnedRepos, tabBrowsePaths, outboxCount, pendingMutations, deletedMutations, syncWatermarks.
    * Zero Legacy Cruft:
    * Delete preserveOnSwitch from sutram_sdk.js and store.js.
    * Delete isSwappingWorkspace, swapPhase, and activeWorkspace from AppStore (StoreRegistry.isTransitioning(), StoreRegistry.phase, and StoreRegistry.getActiveScope() are the single source of truth).
    * Delete the redundant 'sutram:is-swapping-scope' UI hook from insetu_sdk.js and app_shell.js (SutramAppShell already imports StoreRegistry directly!).
Pillar 3: Deep Schema & Metadata Fault Barriers in akasa and inSetu
* Recursive Callable Resolution & Fault Barrier in akasa/extension.py (get_registered_settings_schemas):
    * Upgrade get_registered_settings_schemas(workspace_id) in akasa/extension.py with a recursive _materialize_schema_node(node, workspace_id) helper that:
    * Evaluates top-level callable schemas schema_spec(wid) inside a try...except barrier.
    * Recursively walks fields (type: 'record') and item_schema (type: 'repeater') and evaluates any callable field["options"] or field["default"] (such as "options": get_mountable_data_domains in SYSTEM_SETTINGS_SCHEMA) into pure JSON-serializable lists/primitives!
    * If any callable option resolver raises an exception, logs a warning and falls back to [] so jsonify() in /api/<ws>/system/config can never throw a TypeError: Object of type function is not JSON serializable HTTP 500!
* Per-Extension Metadata Isolation in insetu/core/system/engine_system.py (get_system_config):
    * Wrap each extension's AST/module inspection and dependency resolution (resolve_external_dependency_spec) in get_system_config(workspace_id) in its own try...except fault barrier, recording any failure in meta.available_extensions as a degraded entry rather than aborting the entire /api/<ws>/system/config response.
    * Guard hydrate_and_migrate_cascade_settings with try...except around lazy migration writes so concurrent boot/swap reads never race on disk writes.
3. Phased Implementation Plan
Phase 1: Backend Schema Materialization & Config Fault Barrier (akasa & inSetu)
* [ ] 1.1 akasa/akasa/extension.py: Add _materialize_schema_node(node, wid) inside get_registered_settings_schemas(workspace_id) so nested callable options and default properties inside repeater (item_schema) and record (fields) schemas are recursively evaluated and fault-isolated into pure JSON-serializable structures.
* [ ] 1.2 insetu/insetu/core/system/engine_system.py: Add per-extension fault barriers in get_system_config(workspace_id) and guard lazy migration writes in hydrate_and_migrate_cascade_settings.
Phase 2: Ring-0 Scope Router & Subscriber Valve in Sutram (sutram_sdk.js & app_shell.js)
* [ ] 2.1 sutram/sutram/js/sutram_sdk.js (StoreRegistry):
    * Promote _activeScope and _phase ('READY' | 'LOCKED' | 'TEARDOWN' | 'IDENTITY_SWAP' | 'HYDRATE' | 'ROUTING') into StoreRegistry.
    * Add StoreRegistry.setActiveScope(scopeId) and StoreRegistry.transitionScope(targetScopeId, hooks).
    * Remove the temporary preserveOnSwitch workaround from createSutramStore.
* [ ] 2.2 sutram/sutram/js/sutram_sdk.js (SutramContextMixin.subscribe) & app_shell.js:
    * Gate component subscriber callbacks on tenant-scoped stores while StoreRegistry.isTransitioning() is true, flushing once on sutram:scope-transition-end.
    * Simplify SutramAppShell._compileLayout() to check StoreRegistry.isTransitioning() directly instead of invoking the legacy sutram:is-swapping-scope / sutram:is-swapping-workspace UI hooks.
Phase 3: Zero-Cruft DaemonStore Split & SessionOrchestrator Purification (store.js, api.js, insetu_sdk.js, system.js, ui_primitives.js, ui_system_settings.js)
* [ ] 3.1 insetu/insetu/core/system/store.js:
    * Define DaemonStore (scope: 'global') for process-level state (authToken, workspaces, isOffline, isReconciling, isRebooting, rebootType, quarantinedModules, degradedCore, extensionDependencyMeta) and expose window.inSetu.stores.Daemon = DaemonStore.
    * Strip all daemon and FSM fields (authToken, workspaces, isOffline, isReconciling, isRebooting, rebootType, quarantinedModules, degradedCore, extensionDependencyMeta, activeWorkspace, isSwappingWorkspace, swapPhase) from AppStore so AppStore is 100% pure tenant state.
    * Bind window.inSetu.utils.getActiveWorkspace() directly to StoreRegistry.getActiveScope().
* [ ] 3.2 insetu_sdk.js, api.js, system.js, ui_primitives.js, ui_system_settings.js:
    * Point daemon-state consumers (authToken, workspaces, isOffline, isReconciling, isRebooting, quarantinedModules, extensionDependencyMeta) to DaemonStore.
    * Remove all manual isSwappingWorkspace checks and the retired 'sutram:is-swapping-scope' hook from insetu_sdk.js, api.js, and system.js.
    * Refactor SessionOrchestrator.transitionToWorkspace and refreshCurrentWorkspace in system.js to delegate the phase state machine to StoreRegistry.transitionScope().
Phase 4: Legacy Decommissioning, Constitutional Docs & Fitness Ratchets
* [ ] 4.1 Update Constitutional Documentation ("What We Teach"):
    * Update insetu/docs/01_engineering_standards.md, insetu/docs/08_sutram_contracts.md, and sutram/docs/01_engineering_standards.md to document the 3-Ring Frontend State Architecture (StoreRegistry Ring-0 Scope Router, DaemonStore Ring-1 Global Envelope, AppStore + Extension Stores Ring-2 Disposable Tenant State).
* [ ] 4.2 Static Fitness Ratchets (rules_javascript.py & rules_yenvui.py):
    * Add TENANT_STORE_DAEMON_KEY_BAN: Ban isSwappingWorkspace, swapPhase, preserveOnSwitch, and sutram:is-swapping-scope across sutram and insetu so split-brain transition flags can never be reintroduced.
* [ ] 4.3 Behavioral Invariant Tests (test_workspace_swap_fsm.py):
    * Verify get_registered_settings_schemas() returns 100% json.dumps()-serializable structures even when nested repeater / record subfields declare callable options (get_mountable_data_domains) or raise exceptions.
    * Verify StoreRegistry.transitionScope(), DaemonStore (scope: 'global'), and the SutramContextMixin.subscribe transition valve.

