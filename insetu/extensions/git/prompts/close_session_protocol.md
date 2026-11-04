## End-of-Session Housekeeping & Closeout Protocol ({{ project_name | sys.repo_title }})

The attached `_diffs.txt` context payloads contain the deterministic record of all uncommitted local modifications from this session. **Do not rely on conversational memory of this session**—base your analysis and outputs strictly on the provided diff and context payloads.

Complete the following phases in order, providing all file modifications exclusively via the Yomama Bridge protocol:

### Phase 1: State & Ledger Alignment (Changelog & Tasks)
* Analyze the diffs to determine every feature, fix, and refinement implemented in this session.
* Ensure every logical change found in the diffs (even if not explicitly discussed during the session) is accounted for in the project's issue tracker or changelog (following the Tracker Closeout Protocol below when enabled).

### Phase 2: Architectural & Contract Parity Check
* Cross-reference the diffs against the repository's documented architecture, standards, contracts, mental models and indexes:
{{ contract_stack | sys.contract_stack }}
* If a change altered public interfaces, schemas, state flows, or documented contracts without updating the corresponding documentation or index comments, emit the necessary Yomama patches to restore parity. (Never autonomously invent or reverse-engineer `docs/models/*.md` mental models unless transcribing human-dictated invariants.)

### Phase 3: ADR Governance & Threshold Triage
* Evaluate whether the diffs fundamentally alter core architecture, configuration contracts, or security boundaries. If the threshold is reached, draft a new ADR in `{{ adr_dir | sys.adr_dir }}` (and index it if the repository maintains an ADR index).
* Identify any existing ADRs rendered obsolete or superseded by these diffs (recommend moving to `{{ adr_dir | sys.adr_dir }}/superseded/`), or foundational ADRs that are now deeply embedded and ready to move to `{{ adr_dir | sys.adr_dir }}/archived/`.

### Phase 4: The Guardrail Audit
* Perform a thorough audit of the `+` lines in the diff payloads against {{ standards_doc | sys.standards_doc }} and the active directives at the end of this phase.
* **Data Contract & Type Parity:** Verify that modified data models, event payloads, and route handlers conform to canonical type contracts and schemas.
* Report any standards violations, latent bugs, or logical inconsistencies introduced in the diffs (or explicitly confirm compliance). If session friction warrants a new guardrail, propose a concise addition to {{ standards_doc | sys.standards_doc }}.

{{ sys.directives | sys.guardrail_rules }}

### Phase 5: The Overall Codebase Audit
* Using the full files included alongside the diffs as a representative sample of the codebase, audit surrounding code against our highest benchmark implementations.
* Flag any patch artifacts that need cleanup (e.g., duplicate helpers, orphaned imports, indentation drift, or dead code).

### Phase 6: Deterministic Hardening
* If any bug, regression, or friction encountered in this session can be caught deterministically, recommend or patch a static fitness rule or behavioral unit test in {{ hardening_target | sys.hardening_target }}.

### Phase 7: Ecosystem Generalization
* Identify whether any localized pattern introduced in these diffs warrants extraction into shared substrate utilities without over-engineering.

---

## Git Commit Protocol & Choosing the Commit Type for One Diff Bucket

Changes are often committed one sub-bucket at a time, each drafted from that bucket's diff alone. The release tooling (semantic-release) turns every `feat:` and `fix:` into a changelog line and a version bump, so the type must describe what this bucket contains, not the session as a whole. Decide from the files in this diff only:

- Only tests (files under `tests/`, `test_*.py`, `*.test.js`): `test(<bucket>): ...`
- Only documentation or indexes (`*.md`, `CODE_INDEX.md`, `README`, `docs/`, prompts and routines that change no behavior): `docs(<bucket>): ...`
- Only CI, packaging or tooling (`.github/`, `pyproject.toml` tool sections, `scripts/`): `ci: ...` or `build: ...`. A dependency bump users need is `fix(deps): ...`.
- Only vendored or generated files (`static/vendor/`, lockfiles): `build(vendor): ...`
- Code whose behavior does not change (renames, moves, cleanup): `refactor(<bucket>): ...`
- Code that adds a capability users can call or see: `feat(<bucket>): ...`
- Code that corrects wrong behavior: `fix(<bucket>): ...`

A diff that mixes kinds takes the most significant kind present (`feat` over `fix` over `refactor` over the rest). `<bucket>` is the sub-bucket's id, so two code buckets in one session still produce two distinguishable changelog lines. Mark a breaking change with `!` (for example `feat(auth)!: ...`) and a `BREAKING CHANGE:` footer only on a code bucket. Never use `feat` or `fix` for a bucket that holds only tests, docs or tooling, even if the session as a whole shipped a feature.
* Output the clean Conventional Commit message inside a fenced `text` block for easy copy/paste (do not wrap it in a `git commit` shell command).

---

### Language Guidelines
Use neutral, collaborative, and clear technical language. Avoid militaristic metaphors or overly figurative expressions. Focus on terms related to resilience, stability, structural integrity, and architectural symmetry.

---

{{include_prompt?: ctx://prompts/.templates/tracker/housekeeping_tracker_phase.md}}

---

{{include_prompt: ctx://prompts/.templates/bridge/yomama_patch_protocol.md}}
