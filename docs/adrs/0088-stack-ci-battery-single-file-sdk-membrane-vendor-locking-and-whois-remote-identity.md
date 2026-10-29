# ADR 0088: Callosemic Stack CI Battery, Single-File SDK Membrane, Vendored Substrate Provenance Locking, and Whois Remote Identity Verification

## Status
Accepted (2026-10-28)

## Context
As the inSetu Developer OS stabilized its tiered architecture across sibling repositories (`akasa`, `sutram`, `insetu`) and prepared for continuous cross-repository distribution, several integration seams required architectural consolidation:
1. **Cross-Repository Continuous Integration Drift**: CI workflows previously tested `insetu` against unpinned local dependencies, allowing breaking changes in `akasa` or `sutram` to slip past test suites until runtime installation.
2. **Backend SDK Membrane Ambiguity**: While ADR 0072 isolated core engines from direct `akasa.*` imports, the membrane whitelist still permitted four distinct files (`app.py`, `cli.py`, `sdk/__init__.py`, `utils_core.py`) to import from the kernel. This left multiple points of ingress into kernel internals.
3. **Vendored Substrate Integrity & License Compliance**: Vendored client files in `insetu/static/vendor/` lacked automated build verification, stale file pruning, and committed provenance metadata, risking hand-edit drift and un-reproducible releases. Furthermore, third-party library licenses were not systematically distributed beside vendored ESM bundles.
4. **Remote Access Peer Identity Verification**: While ADR 0086 decommissioned the standalone `tailscale` extension in favor of `engine_remote.py`, verifying connecting devices via forwarding headers remained vulnerable to forged proxy headers. Authenticating remote devices required verifying the connecting client IP with the local `tailscaled` daemon via `tailscale whois --json`.

## Decision
1. **Callosemic Stack CI Battery (`battery.yml`, `ci.yml`, `.gitignore`)**:
   - Implemented a unified `battery.yml` reusable workflow executing tests across `akasa`, `sutram`, and `insetu` sequentially on Python 3.10, 3.11, and 3.12.
   - Evaluates two distinct modes: `main` (testing against the latest default branches of sibling checkouts) and `pinned` (testing against the latest semantic release tags from PyPI).
   - Anchored `/workflows/` to the repository root in `.gitignore` to prevent `.github/workflows/` from being ignored.
2. **Single-File Akasa SDK Membrane (`insetu/core/sdk/__init__.py`)**:
   - Tightened `AKASA_MEMBRANE_WHITELIST` in `tests/fitness/core.py` to strictly `("insetu/core/sdk/__init__.py",)`.
   - `insetu/core/sdk/__init__.py` is now the sole entry point in the inSetu repository permitted to import from `akasa.*`. All core engines and extensions import framework primitives through `insetu.core.sdk` or `insetu.core.utils_core`.
3. **Vendored Substrate Provenance Locking & License Distribution (`vendor_lock.py`, `vendor_sutram.sh`, `NOTICE`)**:
   - Built `scripts/vendor_lock.py` to synchronize, stale-prune, and record `sutram`/`yenVUI` build metadata (version, commit, dirty state, file count, and SHA-256 digest) in `sutram.lock.json`.
   - Updated vendor shell scripts (`codemirror`, `jsyaml`, `lit`, `lucide`, `zustand`) to copy upstream `LICENSE` files into their vendor directories.
   - Updated `NOTICE` with comprehensive third-party software licensing acknowledgments.
4. **Remote Access WHOIS Identity Verification (`engine_remote.py`, `test_remote_identity.py`)**:
   - Implemented Route B peer identity authentication in `engine_remote.py` querying `tailscale whois --json` against the trusted client IP resolved by the kernel peer classifier.
   - Enforced owner trust (the login owning the local `tailscaled` is automatically authorized), `allowed_dev_emails` filtering for non-owners, and strict rejection of tagged (non-human) devices.
   - Added thread-safe caching (`_CACHE_LOCK`) with a 60s TTL for successful lookups, a 5s TTL for transient failures, and a 300s TTL for machine owner identity.
   - Added automated settings migration from the legacy `tailscale` block into `remote` daemon settings, and `allowed_hosts` registration with Host validation.
5. **Forwarding Header Membrane Rule (`FORWARDED_HEADER_MEMBRANE`)**:
   - Codified `FORWARDED_HEADER_MEMBRANE` in `rules_python.py`, statically banning direct reads of client-identity forwarding headers (`X-Forwarded-For`, `X-Real-IP`, `Forwarded`, `HTTP_X_FORWARDED_FOR`) across inSetu code.

## Consequences
* **Positive**: Absolute cross-repository CI verification preventing breaking integration drift across `akasa`, `sutram`, and `insetu`.
* **Positive**: Maximum architectural purity with a single backend SDK membrane file (`insetu/core/sdk/__init__.py`).
* **Positive**: Deterministic, reproducible vendored client builds with provenance recorded in `sutram.lock.json`.
* **Positive**: Mathematical security for remote Tailscale access via local daemon WHOIS verification and automatic machine owner trust.
* **Positive**: Complete compliance with third-party software distribution licensing.
