# ADR 0009: Ephemeral Artifacts and Immediate Jobs Ledger

**Date:** 2026-07-05
**Status:** Accepted

## Context
As the OS offloads heavy operations (Pandoc compilation, RAG context gathering, Git diffing) to background threads, we require a standardized mechanism for the UI to track progress without holding open HTTP sockets. Additionally, these background processes generate transient files that must be systematically garbage-collected to prevent disk bloat. Relying on fragile file-prefix string matching (e.g., `f.startswith("quick_pack_")`) proved unreliable and scaled poorly.

## Decision
1. **Immediate Jobs Ledger:** We have implemented an `immediate_jobs` table in the local SQLite `workers.db`. Dispatched tasks log their status (`processing`, `completed`, `failed`) and emit progress strings to `status_message`. The frontend polls `/api/system/jobs/<job_id>` to emulate streaming feedback.
2. **Ephemeral Artifacts Ledger:** We have implemented an `ephemeral_artifacts` table. When an engine generates a transient file, it registers the path and a precise TTL (Time-To-Live) integer.
3. **Unified Garbage Collection:** A continuous Metronome worker (`sys_garbage_collector`) sweeps both tables every 5 minutes, automatically removing expired artifacts from the physical disk and purging old job records.

## Consequences
* **Positives:** UI applications can safely dispatch long-running tasks and disconnect, querying status statelessly. Temporary artifacts are guaranteed to be destroyed, stabilizing disk footprints.
* **Negatives:** Increased SQLite write-volume on the workers database. All new extensions must rigorously adhere to the `register_ephemeral_artifact` API rather than assuming manual file cleanup.