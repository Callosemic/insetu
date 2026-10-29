## Session Closeout Protocol

When closing out an engineering session:
1. Summarize all structural changes by repository and domain.
2. Draft a clean Conventional Commit message with `Transaction-ID:` trailers when applicable, choosing the type with the rules below.
3. Note any follow-up tasks or deferred items for the Issue Tracker.

## Choosing the commit type for one diff bucket

Changes are often committed one sub-bucket at a time, each drafted from that bucket's diff alone. The release tooling (semantic-release) turns every `feat:` and `fix:` into a changelog line and a version bump, so the type must describe what this bucket contains, not the session as a whole. Decide from the files in this diff only:

- Only tests (files under `tests/`, `test_*.py`, `*.test.js`): `test(<bucket>): ...`
- Only documentation or indexes (`*.md`, `CODE_INDEX.md`, `README`, `docs/`, prompts and routines that change no behavior): `docs(<bucket>): ...`
- Only CI, packaging or tooling (`.github/`, `pyproject.toml` tool sections, `scripts/`): `ci: ...` or `build: ...`. A dependency bump users need is `fix(deps): ...`.
- Only vendored or generated files (`static/vendor/`, lockfiles): `build(vendor): ...`
- Code whose behavior does not change (renames, moves, cleanup): `refactor(<bucket>): ...`
- Code that adds a capability users can call or see: `feat(<bucket>): ...`
- Code that corrects wrong behavior: `fix(<bucket>): ...`

A diff that mixes kinds takes the most significant kind present (`feat` over `fix` over `refactor` over the rest). `<bucket>` is the sub-bucket's id, so two code buckets in one session still produce two distinguishable changelog lines. Mark a breaking change with `!` (for example `feat(auth)!: ...`) and a `BREAKING CHANGE:` footer only on a code bucket. Never use `feat` or `fix` for a bucket that holds only tests, docs or tooling, even if the session as a whole shipped a feature.
