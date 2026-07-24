---
repo: "insetu"
type: "todo"
status: "closed"
id: INS-QUEUE-20260711_1115_BROKERED_RESOURCES
title: "SDK V2 Frontend: Implement Brokered Resource Tracking in InSetuElement Base Class"
created_at: 2026-07-11T11:15:00
closed_at: 2026-07-23T16:00:00
sub_bucket: "None"
tags: ["Architecture", "Frontend", "SDK", "DX"]
---

## Description
To eliminate extension-level cleanup boilerplate and fully enforce absolute multi-tenant lifecycle governance (ADR 0021), the `InSetuElement` base class must transition from a passive subscriber to an active, brokered resource janitor. 

Currently, custom extension authors must manually track and dismantle native browser primitives—such as `setInterval` polling loops and global `window` event listeners—within their `disconnectedCallback` blocks. Forgetting to clear a single listener risks severe memory leaks, cross-tenant data bleeding, and persistent "ghost" layouts during hot-swaps between isolated tenant profiles.

By shifting to a **Brokering Pattern**, the SDK base class will expose managed, single-line resource registration APIs. The framework handles registration tracking implicitly and executes global teardowns deterministically upon element disconnection, driving extension boilerplate to zero.

## Action Items
- [ ] **Extend Base Class Storage (`sdk.js`):**
    - Update the `InSetuElement` constructor to initialize internal tracking arrays: `this._managedIntervals = []` and `this._managedListeners = []`.
- [ ] **Implement Brokered Interval Primitive:**
    - Expose `registerInterval(callback, delayMs)` on the base class. Internally instantiate the standard `setInterval`, push the returning identifier to the tracking array, and return it to the caller.
- [ ] **Implement Brokered Global Listener Primitive:**
    - Expose `registerGlobalListener(eventType, targetNode, callback, options)` on the base class. Safely attach the listener to the targeted node, record the reference parameters in the tracking array, and provide an implicit cancellation mechanism.
- [ ] **Automate Lifecycle Teardown Loops:**
    - Update `disconnectedCallback` inside `InSetuElement` to sequentially loop over and wipe all tracked entries:
        - Invoke `clearInterval()` on all active interval registrations.
        - Invoke `removeEventListener()` on all active node targets.
- [ ] **Audit & Refactor Active Extensions:**
    - Sweep the custom extensions directory (`static/js/extensions/`) to migrate native timer and event listeners to the new brokered primitives, successfully removing manual `disconnectedCallback` boilerplate.
- [ ] **Harden Static Analysis Pass (`tests/fitness_functions.py`):**
    - Add regex evaluation checks to enforce the ban on bare `setInterval` usage inside graduated components, guiding future contributors down the managed SDK pathway.