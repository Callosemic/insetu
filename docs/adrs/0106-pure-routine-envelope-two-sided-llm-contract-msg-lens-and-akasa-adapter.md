# ADR 0106: Pure Zero-I/O RoutineEnvelope, Two-Sided LLM Compute Contract, msg:// Turn Dossiers, Conversation Rewind, AkasaBackendAdapter Transport Unification, and S9 Secret Scrubbing

* **Status:** Accepted
* **Date:** 2026-11-18
* **Deciders:** The Architect

## Context
Following ADR 0105, four architectural seams remained across the Agent Harness, RAG Gatherer, Yomama Bridge, and System transport layers:
1. `RoutineEnvelope` (`envelope.py`) still imported Gather quickpack compilers and coexisted with a mutable `chain_context` dictionary (`orchestrator.py`), duplicating working-set and Web-Chat handoff logic across automated API and manual `web_chat` paths.
2. Multi-step execution plans lacked an in-memory reducer (`TASK_MANAGE`) and reversible per-turn cognitive envelope snapshots for conversation rewind without touching physical files on disk.
3. Session and routine telemetry lacked `msg://` lens projections (`00_session_overview.txt` and per-turn `turn_<NNN>_dossier.txt` archives) and `ExecutionFrame` baggage attribution across worker threads.
4. Frontend HTTP/SSE transport (`api.js`, `system.js`) duplicated token/retry/probe plumbing instead of delegating to `AkasaBackendAdapter`, while module-level caches used bespoke dictionaries and `scrub_outbound_secrets` did not decrypt stored Fernet secrets or redact URL query secret parameters.

## Decision
1. **Pure Zero-I/O `RoutineEnvelope` & Two-Sided LLM Compute Contract:** Isolate `RoutineEnvelope` (`insetu/core/agent/envelope.py`) as a pure state container with `to_scope_dict()`, eradicate `chain_context` (`ENVELOPE_ZERO_GATHER_IO_BAN`, `LEGACY_CHAIN_CONTEXT_BAN`), move Gather/Quickpack assembly into `context_assemble.py`, and centralize API and `web_chat` Ingress/Egress pipelines in `insetu/core/agent/llm_contract.py` paired with `plan_ledger.py` (`TASK_MANAGE`).
2. **`msg://` Lens Provider & ExecutionFrame Telemetry Attribution:** Implement `project_session_msg_lens` and `project_turn_dossier` in `insetu/core/gather/msg_lens.py` and `bridge_telemetry.py`, propagate `session_id` and `turn_msg_id` via `ExecutionFrame` baggage (`telemetry_session_scope`), and enforce Two-Level Session Budgeting (`PER_CALL_CONTEXT_RATIO_LIMIT = 0.75` plus ratcheting `budget_limit_usd` / `budget_step_usd` watermarks).
3. **Reversible Cognitive Envelope Snapshots (`agent.rewind`):** Persist pre-turn and post-turn `__envelope__` snapshots in `chat_messages.context_hashes_json` so `POST agent/rewind` restores working-set, plan, and `/mode` state deterministically without reverting files on disk.
4. **`AkasaBackendAdapter` Transport Unification, Build-Manifest Discovery & `BoundedCache`:** Route all frontend HTTP, auth bootstrap, health probes, build-ID sniffing, and SSE streams through `AkasaBackendAdapter`, memoize `resolve_frontend_build_manifest()` in `app.py`, standardize module caches on `BoundedCache`, and harden S9 secret scrubbing (`collect_workspace_secrets` Fernet decryption, URL query redaction, and `ctx.scrub_secrets()`).

## Consequences
* **Positive:** Eliminates `chain_context` state drift, unifies API and `web_chat` turn settlement, provides self-contained per-turn forensic dossiers (`msg://<id>#telemetry`), standardizes module-level caches on `BoundedCache` (enforced by `BESPOKE_MODULE_CACHE_BAN`), and extends S9 scrubbing to persisted telemetry, decrypted vault secrets and URL query secrets (`scrub_outbound_secrets`, `ctx.scrub_secrets()`).
* **Trade-offs:** Requires `BoundedCache` and `AkasaBackendAdapter` registration across all core and test bootstrap paths.
