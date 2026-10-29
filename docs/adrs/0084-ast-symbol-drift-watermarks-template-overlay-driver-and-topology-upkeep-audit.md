# ADR 0084: AST Symbol Drift Watermarks, Template Overlay VFS Driver Delegation, and Topology Upkeep Audit Substrate

## Status
Accepted (2026-10-28)

## Context
As the inSetu Developer OS scaled its autonomous agent loops and repository topology mapping, several architectural documentation and governance seams required deterministic hardening:
1. **Silent Documentation & Implementation Drift**: While Cartographer previously extracted AST symbols and docstrings into `CODE_INDEX.md`, modifying a function or class implementation without updating its docstring left the existing index comment untouched. Developers and collaborating LLMs were presented with outdated architectural descriptions without visual indication of implementation drift.
2. **Template Overlay Driver Boilerplate Duplication**: `PromptsVFSDriver` in `engine_prompts.py` manually implemented module prompt directory scanning, global user template directory resolution, and path containment checks. This duplicated the reusable `TemplateOverlayVFSDriver` substrate in `insetu.core.sdk`. Furthermore, prompt resolution lacked the 3-Tier Same-Name Override Cascade when resolving `{{include_prompt: ...}}` macros.
3. **Fragmented Repository Upkeep Audits**: Auditing workspace health (missing `CODE_INDEX.md` placeholders, broken documentation links, God-object decomposition candidates, and stale test imports) required running disparate scripts or manual inspections. The autonomous agent lacked a deterministic, single-call endpoint to gather codebase upkeep telemetry.

## Decision
1. **Cartographer AST Symbol Drift Tracking & Ledger Watermarking (`cartographer.py`)**:
   - Introduced `CARTOGRAPHER_SCHEMA` declaring `symbol_ledger` (`symbol_key`, `repo`, `filepath`, `symbol_name`, `signature`, `body_hash`, `verified_hash`, `comment`, `status`, `updated_at`).
   - Built normalized AST body hashing (`_compute_normalized_py_body_hash` and `_compute_normalized_js_body_hash`) that strips docstrings and normalizes whitespace so comment edits do not trigger false drift.
   - Reconciles extracted symbols against `symbol_ledger` during `map_repositories`: when `body_hash != verified_hash`, tags the index comment with `[stale?]` in `CODE_INDEX.md`.
   - Exposed `POST cartographer/verify_symbols` to mark symbols as verified at their current body hash, clearing `[stale?]` tags.
   - Exposed `POST cartographer/enrich` and `@cartographer_bp.worker("enrich_task")` to batch undocumented/stale symbols into fast-tier LLM enrichment.
   - Integrated Markdown frontmatter and heading fallback in `map_repositories` for `.md` documentation files.
2. **Template Overlay VFS Driver Delegation & 3-Tier Prompt Cascade (`engine_prompts.py`)**:
   - Subclassed `PromptsVFSDriver` from `TemplateOverlayVFSDriver(module_subdir="prompts")`, delegating virtual `.templates/` resolution to the SDK.
   - Implemented `_read_with_cascade` in `api_prompts_resolve`, providing the 3-Tier Same-Name Override Cascade (Workspace Override > Global User Template > Built-in Module Template) for both direct prompt resolution and recursive macro includes.
3. **Topology Upkeep Audit Substrate & Plan Verification (`engine_topology.py`)**:
   - Added `GET topology/overview` compiling structured summaries of target repositories, sub-buckets, and `CODE_INDEX.md` headers.
   - Added `POST topology/verify_plan_targets` validating that `vfs://` and `ctx://` URIs referenced in architectural plans exist on disk or are flagged as creation targets.
   - Added `GET/POST topology/audit_upkeep` executing a deterministic 3-pillar upkeep audit:
     1. Documentation & Symbol Drift (`docs_drift`): missing index comments, stale symbols via `symbol_ledger`, and broken `vfs://` links in documentation.
     2. God-Object Decomposition Candidates (`god_objects`): oversized files ($\ge 550$ lines or $\ge 15$ symbols) with symbol span breakdowns.
     3. Test Suite Relevance (`test_relevance`): stale test imports (missing exported symbols) and untested registered capabilities.
     - Auto-populates `target_files` (up to 12 files) for routine / agent triage.

## Consequences
* **Positive**: Absolute visibility into documentation implementation drift via deterministic `[stale?]` watermarks.
* **Positive**: Unified template overlay driver architecture eliminating duplicated filesystem traversal code.
* **Positive**: Deterministic 3-pillar upkeep telemetry enabling automated `/upkeep` agent routines.
* **Positive**: 100% adherence to typed worker signatures and Flask transport decoupling.
