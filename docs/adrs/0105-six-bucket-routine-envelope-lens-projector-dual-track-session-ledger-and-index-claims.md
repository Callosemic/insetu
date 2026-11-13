# ADR 0105: Six-Bucket RoutineEnvelope, Multi-Scheme Lens Projector, Dual-Track Session Ledger, Shared-Clone Index Claims, and Python Floor Gates

* **Status:** Accepted
* **Date:** 2026-11-13
* **Deciders:** The Architect

## Context
As `inSetu` scaled to multi-hop declarative agent routines, external Web-Chat handoffs, multi-workspace clones, and multi-Python CI matrices (`Python 3.10+`), four structural friction points emerged:
1. Mutable working-set lists in `orchestrator.py` drifted across recursive sub-routine hops and re-transmitted unchanged files on iterative Web-Chat handoffs.
2. Session history compaction re-summarized cold turns on every turn and lacked stable message addresses (`msg://<id>`) or point-in-time file SHA-256 provenance.
3. Multiple workspaces mounting the same Git clone with differing sieve or symbol configurations repeatedly overwrote `CODE_INDEX.md` in an endless loop (Issue #22).
4. Newer Python syntax (e.g., PEP 701 f-strings) and unguarded stdlib imports passed locally on Python 3.12+ but failed on the oldest supported CI floor (`Python 3.10`).

## Decision
1. **Six-Bucket `RoutineEnvelope` & Multi-Scheme `project_resource_lens`:** Consolidate working-set state into `RoutineEnvelope` (`insetu/core/agent/envelope.py`) with volatility-ordered buckets (`governance`, `hierarchy`, `meta`, `data`, `telemetry`, `prompt`), content-addressed `sent_hashes` for Same-Window Web-Chat delta quickpacks, and unified `project_resource_lens` projections (`full`, `diff`, `slice`, `outline`, `genesis`) across `vfs://`, `ctx://`, `msg://`, and `mddb://`.
2. **Dual-Track Session Transcript Ledger:** Maintain monotonic `seq_counter` sequences, server-minted `msg_<hex>` IDs, point-in-time `context_hashes_json`, and watermarked `compacted_view_json` blocks that rebuild cleanly from any deleted message boundary.
3. **Shared-Clone `CODE_INDEX.md` Claim Arbitration:** Record the owning workspace control directory and index rules fingerprint in `.git/insetu-index-claim.json` (`insetu/core/cartographer/index_claim.py`), transferring ownership only when unclaimed, stale, matching, or explicitly claimed via human-only `POST cartographer/claim_index`.
4. **Declarative Route Risk Tiers, Python Floor Linter & Step Timing:** Support `risk="ui_only" | "read"` on `InSetuExtension.route()`, enforce `PYTHON_VERSION_FLOOR` (`tests/fitness/rules_python_floor.py`) across all Python files, and instrument hot routes with `StepTimer` + `tests/performance/perf_check.py`.

## Consequences
* **Positive:** Eliminates redundant token transmission on Same-Window Web-Chat turns, prevents shared-clone `CODE_INDEX.md` ping-pong, guarantees reproducible session compaction rebuilds, and catches Python 3.10 incompatibilities locally before CI.
* **Trade-offs:** Adds `.git/insetu-index-claim.json` local clone metadata and requires explicit `cartographer/claim_index` invocation to switch index writers on a shared clone.
