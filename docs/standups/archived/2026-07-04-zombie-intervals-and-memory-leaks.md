# Architecture Blueprint: Zombie Intervals & Cross-Tenant Memory Leaks

**Date:** 2026-07-04
**Mission:** To enforce strict lifecycle teardown protocols for Javascript timers, preventing memory leaks and cross-tenant data contamination during stateless workspace swaps.

## The Problem: Unmanaged Polling
In the transition to a stateless, Single Page Application (SPA) multi-tenant architecture, the browser window never actually refreshes when swapping from "Workspace A" to "Workspace B". 

If an extension in Workspace A initializes an anonymous polling loop (e.g., `setInterval` to check job status), that interval will continue firing indefinitely in the background even after the user swaps to Workspace B.

## Audit Findings (2026-07-04)
### 1. Research Extension Rogue Polling
* **The Debt:** In `ext_research.js`, the code executes `setInterval(() => { ... fetchState(); }, 3000);` without storing the interval ID. 
* **The Bomb:** Every time the extension reloads or a soft-refresh occurs, a *new* interval is spawned. If a user swaps workspaces 5 times, 5 concurrent polling loops will hit the backend every 3 seconds, eventually crashing the ASGI worker pool and corrupting the Zustand store with cross-tenant data.
* **The Fix:** All intervals must be named (e.g., `window._researchPollInterval`). The extension must implement `ExtensionRegistry.registerUnloadHook('research', () => clearInterval(window._researchPollInterval));` to guarantee the loop dies when the extension is unmounted.

### 2. Context Load "Time Ago" Rogue Interval
* **The Debt:** In `app.js` (`finishContextLoad`), the UI spins up `refreshInterval = setInterval(updateRefreshText, 1000);` to update the "Refreshed X seconds ago" UI text.
* **The Bomb:** While it attempts to clear the interval before reassigning it, it exists outside the centralized frontend metronome and outside of the `window.inSetu` namespace. This creates an unmanaged floating clock that violates the UDF teardown contract.
* **The Fix:** Migrate this rogue interval into the newly established Frontend Metronome under a core OS namespace hook.

### 3. The Solution: Centralized Metronome Subscriptions
Moving forward, individual extensions should not use `setInterval` at all. We should implement a centralized Frontend Metronome in `store.js` that emits a global `TICK` event every 1000ms. Extensions can subscribe to this tick (`Store.subscribe()`) and will naturally be garbage collected when their UI unmounts, enforcing perfect lifecycle harmony.