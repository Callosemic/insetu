# ADR 0018: Event-Sourced VFS Ledger and High-Performance Context Compilation

**Date:** 2026-07-14  
**Status:** Accepted  

## Context
Previously, `engine_gather` relied on a traditional polling state strategy to identify workspace mutations[cite: 1]. Spawning external `git status --porcelain` subprocesses introduced an unacceptable I/O penalty (the "Git Tax") on high-velocity file modifications and tightly coupled state compilation with version control frameworks[cite: 1]. Furthermore, tracking unmanaged local storage vaults required disjointed file logging mechanisms that scaled poorly[cite: 1].

We require a decoupled system capable of mapping filesystem deltas instantaneously in a cross-platform environment[cite: 1].

## Decision
We switch completely to an **Event-Sourced State Machine** configuration powered by a unified disk transaction ledger[cite: 1]. 

* **The Unified Event Ledger**: The core filesystem routers (`routes_fs.py`) and native watchdogs synchronously write all structural mutations (additions, modifications, and deletions) to a central database ledger (`vfs_event_log`)[cite: 1]. Delta discovery complexity drops from $O(N)$ down to a deterministic $O(1)$ constraint[cite: 1].
* **Macro Slew Limiter (5-Second Debounce)**: Implemented a rolling metronome worker task that blocks active context compilation sequences until a consecutive 5-second window of absolute filesystem silence has settled[cite: 1].
* **Bucket Ratio Circuit Breaker**: If the ratio of modified folders to total tracked resource domains reaches a threshold where:
  $$\frac{\text{touched\_buckets}}{\text{total\_known\_buckets}} > 0.5$$
  The compiler aborts localized surgical updates and promotes the operation to a background full sweep to minimize I/O thrashes[cite: 1].
* **Offline Mutation Guard**: Upon compilation, the daemon logs an epoch timestamp to `manifest_cache.json`[cite: 1]. On boot, if the host clock indicates $\text{system\_boot\_time} > \text{last\_full\_compile\_time}$, the engine flags potential external modifications and triggers a self-healing full sweep sequence[cite: 1].

## Consequences
* **Positives**: Complete decoupling of the RAG compilation layer from local version control states[cite: 1]. Reduces background filesystem processing latency to sub-second thresholds.
* **Negatives**: Marginally increases initialization overhead on application boot sequences during the offline delta determination pass[cite: 1].