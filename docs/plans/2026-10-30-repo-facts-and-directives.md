---
status: "active"
---
## Architectural Blueprint: Layered Settings, Repository Facts, and Directives

**Status (2026-11-03).**
* Phase 1 Sprints 1 and 2 shipped in insetu 0.31: `SETTINGS_ACCESS_RATCHET`, the `ctx://settings` mount, landmarks (`resolve_repo_landmarks`, `topology.landmarks`), the `sys.*` prompt variables and `{{include_prompt?: ...}}`.
* S8 is built (release: akasa 0.8.0, then insetu). It delivers everything Sprint 3 depended on: the attestation store, pending protected changes with human-only confirmation, execution-frame origins and the audit log. Sections 2D and 4.3 below describe the store as built.
* Phase 1 Sprints 3 and 4 are next and are written in 4.5 as self-contained briefs, so they can be handed to another model. Phases 2 to 6 have not started.

*Supersedes the 2026-10-30 settings-unification draft. This blueprint keeps that draft's goal (one settings model, Markdown-as-Code, prose directives beside the fields they belong to) and reaches it in phases, each of which removes legacy code rather than adding a parallel path.*

### 1. Context & Motivation

Our session templates (`session-start-base.md`, the 7-phase `housekeeping-base.md`) are wrapped once per repository with hardcoded `{{ macro_* }}` parameters. Every one of those parameters falls into one of three groups:

1. **Where things live in a repository:** standards, contract stack, ADRs, tracker, tests and fitness suites.
2. **How we want an agent to work:** prose directives and guardrail rules.
3. **Steps that only apply when an extension is enabled:** tracker phases, git protocol.

The wrappers also drift. `ticket-protocol.md` writes tickets to `<repo>/.insetu-data/tracker/closed/`, while the insetu close-session wrapper passes `{repo}/.tracker/closed/`. Built-in constitution pinning has the same issue: `discover_constitution_files()` only walks `docs/standards/`, so `docs/01_engineering_standards.md` is never pinned.

Looking for a clean answer showed something larger. insetu already has three mechanisms that each do the same job in slightly different ways:

* **Layered documents, twice.** Prompts and routines resolve through `TemplateOverlayVFSDriver` (module template, then the user's global copy, then the workspace). Settings resolve through `SettingsManager` (schema default, then daemon, then workspace, then repo). Same shape, two implementations, two storage formats.
* **Field and route policy, scattered.** `scope`, `secure` and `mcp_expose` are already declarative policy. *Who may set a value* and *how tiers combine* are not declared anywhere; each extension checks them by hand (for example preview's `_validate_overrides` and its LAN checks).
* **Human attestation, four times.** P5 test-command approval, S2 preview-command approval and LAN leases, S8's confirmed protected changes, and (new here) acceptance of repository directives are all the same act: a person approves exact content, identified by its hash, through a route agents cannot reach.

The target architecture in section 2 merges each pair into one pattern. Section 3 sets the rules that keep the migration from leaving legacy code behind. Section 4 is Phase 1, which delivers the workflow goal and builds on the target shape from the start.

---

### 2. Target Architecture

#### A. One field contract

Every setting is a schema field. Alongside today's `id`, `type`, `default`, `scope` and `secure`, each field declares:

* **`about`:** what the value describes: `user`, `workspace` or `repo`.
* **`authority`:** who may set it.
  * `repo_content`: a file inside the repository may set it (facts).
  * `person`: a person may set it through any of insetu's editors.
  * `human_only`: a person may set it only through a confirmed change (permissions).
* **`merge`:** how tiers combine.
  * `override`: most specific tier wins (facts, most preferences).
  * `append`: concatenate with provenance (prose directives).
  * `narrow`: the effective value is the most restrictive any tier allows, on a declared ordering (permissions). Exposure is the clearest example: loopback, then tailnet, then LAN. A repository can lower it but never raise it.

The facts / preferences / permissions split from the earlier draft becomes field metadata instead of separate files and special cases.

**Facts travel, permissions don't.** The test for `authority: repo_content`: if this value were written by someone hostile, could it reach outside the repository, run something, expose something, or speak to the model with our authority? If not, the repository may own it. A wrong fact produces weaker context. A wrong permission produces exposure.

#### B. One layered-document primitive

Prompts, routines and settings are all Markdown-as-Code documents resolved across tiers by the same overlay. The schema decides what "resolve" means:

* Prompts and routines: whole-document override (as today).
* Settings: frontmatter fields resolve per field by their `merge` rule; the Markdown body holds that extension's directives and resolves by `append`.

Settings documents live at:

| Tier | Path | Notes |
|---|---|---|
| Schema default | `ctx://settings/.templates/<ext>/<ext>.md` | Generated from the schema, plus any shipped body |
| User (global) | `ctx://settings/.templates/user/<ext>.md` | Daemon-scope fields and personal directives |
| Workspace | `ctx://settings/<ext>.md` | Workspace fields and directives |
| Repository, shared | `vfs://<repo>/.insetu-data/settings/<ext>.md` | Only `repo_content` fields; suggested directives. Meant to be committed. |
| Repository, local | `vfs://<repo>/.insetu-data/settings.local/<ext>.md` | Same shape; wins over shared; git-ignored |

So a repository's landmarks live in `.insetu-data/settings/topology.md`, and its suggested directives in the body of `.insetu-data/settings/agent.md`. Each extension owns its own document at every tier, the same way it owns its schema today.

#### C. One write path

Every write to a settings document goes through one parse, validate and policy step, whatever its source: the Settings hub form, the Files editor, a bridge patch, `ctx.settings.set()`, an agent tool, a routine or MCP. Each changed field is checked against its `authority` for the writer and the tier:

* Fields the writer may set at that tier are applied.
* `human_only` fields become a pending confirmation (section 2D).
* Fields that tier may not hold (for example a `human_only` field in a repository file) are refused with a notice.

This is what makes Markdown settings safe to patch with the bridge. Secrets are vaulted on the way in, as today.

#### D. One attestation store (built in S8)

`insetu/core/attestations.py` records every standing or timed approval a person makes as one record in `.insetu/attestations.json`: `{id, kind, subject, digest, approved_at, approved_by, expires_at, run_id, detail}`.

* **Kinds:** `command` (test, preview and hook commands), `workspace_extension`, `lan_lease`, and `repo_directive`, reserved for 4.3's acceptance.
* **One-shot confirmations are events, not grants.** A confirmed protected change is a line in `.insetu/audit/protected_changes.jsonl` (`insetu/core/protected_changes.py`), not an attestation.
* **Rules, all enforced in code:**
  * `attest()` refuses calls whose execution-frame origin is `mcp`, `routine` or `agent`; the request that proposes something can never approve it.
  * Routes that approve are `mcp_expose=False` and listed in `ROUTINE_BANNED_CAPABILITIES`.
  * The digest ties a grant to exact content. If the content changed after the person looked, `is_attested(kind, subject, digest)` is false.
  * Grants can be timed (`expires_at`) or end with the daemon run (`until_restart`). Pending protected changes do not expire (decided 2026-11-03): they wait until a person confirms or discards them.
  * Only `attestations.py` and `protected_changes.py` write past the protected-target guard (`PROTECTED_WRITE_CHOKEPOINT`).

**Known limit.** An approved shell command runs as the user and could call the approval route itself. The store keeps insetu's own surfaces honest. It is not a sandbox.

#### E. One read view, with provenance

`ctx://settings/<ext>.md` can render the **effective** settings, each value annotated with where it came from (`bind_host: 127.0.0.1  # from: workspace`). The same provenance labels directive sections in prompts and explains values in the UI.

#### F. What stays outside, on purpose

* **The boot floor.** Port, allowed hosts, workspace roots and mounts, and credentials. The lifeboat must read them with the standard library alone, which cannot parse YAML. They stay in `host.json`, `workspaces.json` and `.insetu/auth/` as the **single source**, not as mirrors of Markdown. The read view shows them; every edit to them is a `human_only` confirmed change.
* **Secrets**, vaulted in `secrets.json` and masked in every view.

---

### 3. Rules for Reducing Debt Along the Way

Strangler-fig migrations usually go wrong the same way: the old path stays callable, new code keeps using it, nobody can see how much is left, and "done" is declared when the new path works rather than when the old one is gone. These rules prevent that.

1. **Inventory first, as a ratchet.** Before Phase 1 builds anything, a fitness rule (`SETTINGS_ACCESS_RATCHET`) lists every place that reads or writes configuration directly instead of through `ctx.settings` or the topology API: raw `config.json` / `load_config()`, raw `host.json`, raw `workspace.settings.json` / `repo.settings.json`, and direct `ctx.config["target_repos"]` reads. Each entry carries a reason, like V4's reviewed public-route list. A new direct access fails CI. The list may only shrink. As of 2026-10-30 it is roughly 15 files reading `config.json` / `load_config()`, 15 touching `host.json`, and 17 reading `target_repos` directly, with heavy overlap. Boot-floor entries (`fallback_bridge.py`, `cli.py`, `app.py`'s port preseed, akasa's auth and state modules) are permanent and say so.
2. **Every phase names what it deletes, and is not done until it is gone.** The exit criterion is a deletion, not a working feature. A phase that adds a new path ships the removal of the old one in the same release.
3. **One seam, no dual writes.** Storage changes happen behind `ctx.settings`, which is already the seam for about 100 call sites. At no point are two formats written for the same value.
4. **Migrations are one-shot and versioned.** Each storage change has a migration with a fixture of the old format and a test. The reader for the old format is deleted one minor release later, with the date written in the code.
5. **Intertwined code goes on the list, not under the rug.** If a legacy access cannot be removed in its phase, it stays on the ratchet with a reason and the phase that will remove it. Nothing is left in place silently.
6. **Phases fit in one or two sessions.** If a phase cannot, it is split until it can, so no half-migrated state survives between work sessions.

---

### 4. Phase 1: Repository Facts, Optional Includes, Directives

Phase 1 delivers the workflow goal (one shared template per workflow, no per-repository wrappers) and uses the target paths and attestation store from the start, so nothing in it is thrown away later.

#### 4.1 Repository facts

`vfs://<repo>/.insetu-data/settings/topology.md` (and its `settings.local/` counterpart) may hold:

```yaml
---
schema: 1
landmarks:
  standards: ["docs/01_engineering_standards.md", "docs/standards/*.md"]
  contracts: ["docs/02_extension_api_contract.md", "README.md"]
  adrs: "docs/adrs"
  tests: ["tests/unit"]
  fitness: ["tests/fitness", "tests/fitness_functions.py"]
  tracker: ".insetu-data/tracker"
---
```

* **Declared by the schema, not hardcoded.** The `landmarks` fields are added to the topology schema with `authority: repo_content`, `merge: override`. The repository-tier reader accepts only fields declared `repo_content`; anything else in the file is ignored with a notice in the Settings hub. This is the first use of section 2A's `authority`.
* **Confined to the repository.** Every path and glob is relative. Absolute paths and `..` segments are rejected. Matches are resolved against `topology_ledger`, so only files that exist and are tracked are returned.
* **Discovery defaults.** With no file present, landmarks are discovered from conventional names: `docs/standards/`, `*engineering_standards*.md`, `CONTRIBUTING.md`, `docs/adrs|docs/adr|adr`, `tests/unit|tests|test`, `tests/fitness`, `.insetu-data/tracker`. The file only stores what differs.
* insetu adds `settings.local/` to `.insetu-data/.gitignore` when it first creates the folder.

#### 4.2 Optional includes: `{{include_prompt?: <uri>}}`

* When the target is `ctx://prompts/.templates/<ext>/...` and `<ext>` is **disabled** in the workspace, the include resolves to `""` and the surrounding blank lines collapse.
* When `<ext>` is **enabled but the file is missing**, the include still emits `[!] MACRO TARGET NOT FOUND`. A typo must stay visible.
* `?` on a target outside an extension's templates is an error.

#### 4.3 Directives

Directives are the Markdown body of the `agent` settings document at each tier: `ctx://settings/.templates/user/agent.md`, `ctx://settings/agent.md`, and the repository's `.insetu-data/settings/agent.md` and `settings.local/agent.md`. In Phase 1 only the **body** of user and workspace settings documents is read. Their fields still live in JSON until Phase 6, so frontmatter in those files is refused with a notice rather than silently ignored.

`get_directives(ctx, repo)` assembles them in order (user, workspace, repository shared, repository local), each under its own heading, and states that earlier sections win on conflict:

```
## Your directives
## Workspace directives
## Directives suggested by the <repo> repository (repository content)
```

* **Acceptance.** Shared repository directives come from content we may not have written. They are left out of every prompt until a person accepts them: an attestation of kind `repo_directive` whose digest is the hash of the exact text. A `git pull` that changes the text drops them again until re-accepted, and the Settings hub shows the diff. Local repository directives are ours and need no acceptance.
* **Protection.** All four directive documents (user, workspace, repository shared, repository local) are protected targets, so S8's handler holds every write to them from an agent, a routine, MCP or the bridge as a pending change, which a person confirms in the Review Changes window. The repository-local file needs protection most: it skips acceptance, so an agent that could write it could speak to the model with our authority. A person's own save is not held: the Files editor and the Settings hub mark their saves as editor saves (origin `ui`, `SOURCE_KEY` set to `EDITOR_SOURCE`), and those are written directly. Directive files are not recovery files, so no smoke test runs.

#### 4.4 Prompt variables

`orchestrator.py` adds resolved landmarks and directives to `chain_context["sys"]` for the target repository, alongside existing keys such as `sys.last_exit_code`:

| Variable | Value |
|---|---|
| `sys.repo_name`, `sys.repo_title` | Target repository |
| `sys.standards_files`, `sys.contract_files` | Lists of `vfs://` URIs that exist |
| `sys.adr_dir`, `sys.tracker_dir` | One `vfs://` URI, or `""` |
| `sys.test_dirs`, `sys.fitness_dirs` | Lists of `vfs://` URIs |
| `sys.directives` | The assembled block from 4.3 |

Empty values render as empty strings or lists, so a minimal repository gets a shorter prompt, not a broken one.

#### 4.5 Sprints

None of these sprints changes akasa, so no akasa release or pin bump is needed.

Sprints 1 and 2 shipped in insetu 0.31. Sprints 3 and 4 start once S8 is released (akasa 0.8.0, then insetu with `akasa>=0.8.0,<0.9`); they need no akasa changes.

**Sprint 1: Ratchet, landmarks and the `ctx://settings` mount** (shipped, insetu 0.31)

* **Target files:** `tests/fitness/rules_python.py`, `insetu/core/topology/engine_topology.py`, `insetu/core/system/engine_system.py`, `insetu/core/gather/context_assemble.py`, `insetu/core/agent/orchestrator.py`, `insetu/core/agent/engine_agent.py`, `insetu/core/utils_core.py` (URI canonicalization), `insetu_sdk.js`
* **Work:**
  1. Add `SETTINGS_ACCESS_RATCHET` with today's reviewed list (section 3, rule 1).
  2. Mount `ctx://settings` through the existing `TemplateOverlayVFSDriver` (`module_subdir="settings"`), and teach `InSetuURI` and the JS SDK about it.
  3. Add `authority` and `merge` as optional schema keys, used first by the topology `landmarks` fields.
  4. Add the repository-tier reader (through `ctx.vfs`, cached by revision token) and `resolve_repo_landmarks(ctx, repo)`, exposed as `topology.landmarks`.
  5. Rewrite `discover_constitution_files()` and the agent's standards lookup on top of landmarks, and inject the `sys.*` variables.
* **Deletes:** the hardcoded `vfs://{repo}/docs/standards` walks in `context_assemble.py` and `engine_agent.py`.
* **Verification:** `test_repo_landmarks.py` covers discovery on the insetu and akasa layouts, overrides, local precedence, confinement (absolute paths and `..` refused), and undeclared fields ignored. Constitution pinning includes `docs/01_engineering_standards.md`. The ratchet fails on a newly added raw `config.json` read.

**Sprint 2: Optional includes** (shipped, insetu 0.31)

* **Target files:** `insetu/core/utils_core.py`
* **Work:** Implement 4.2.
* **Deletes:** nothing yet; it removes the reason for the per-repository wrappers, which Sprint 4 deletes.
* **Verification:** the tracker phase expands when `tracker` is enabled, resolves to `""` when it is disabled, still errors when enabled but missing, and errors when `?` is used outside extension templates.

**Sprint 3: Directives and acceptance** (next; a self-contained brief)

* **Read first:** this blueprint's 2A, 2D and 4.3; `docs/plans/2026-11-03-s8-confirmed-protected-changes.md`; `docs/01_engineering_standards.md` §9.3 and §9.4; `insetu/core/attestations.py`; `insetu/core/protected_changes.py`; `resolve_repo_landmarks` in `insetu/core/topology/engine_topology.py` (it already reads `.insetu-data/settings/` and `settings.local/` with the confinement and gitignore checks to reuse).
* **Work:**
  * 1. **`get_directives(ctx, repo)`** in `insetu/core/agent/directives.py` (a new module; `orchestrator.py` is already large). It reads the Markdown body of `agent.md` at four tiers, in this order: user `ctx://settings/.templates/user/agent.md`, workspace `ctx://settings/agent.md`, repository shared `vfs://<repo>/.insetu-data/settings/agent.md`, repository local `vfs://<repo>/.insetu-data/settings.local/agent.md`.
    * It returns the assembled block of 4.3: each tier under its own heading, the shared repository tier labeled as repository content, and a line saying earlier sections win on conflict.
    * Frontmatter in the user and workspace documents is refused with a notice and never parsed (fields stay in JSON until Phase 6).
    * Read through `ctx.vfs`; never `open()`.
  * 2. **Acceptance of shared repository directives.**
    * The subject is `f"{workspace_id}|{repo}"`; the digest is `attestations.digest_of(text)` of the exact body.
    * `get_directives` includes the shared tier only when `attestations.is_attested("repo_directive", subject, digest)` is true. Otherwise it leaves that tier out and reports it as waiting, so the UI can say so.
    * Accept and revoke routes in `insetu/core/system/engine_system.py`: `system/directives/accept` takes `{repo, digest}` and refuses with 409 if the digest is not the hash of the text on disk now, as `system/extensions/workspace/approve` does; `system/directives/revoke` takes `{repo}`. Both are `mcp_expose=False` and listed in `ROUTINE_BANNED_CAPABILITIES`. Call `attestations.attest()` and `revoke()` only; `attest()` already refuses machine origins.
    * A read route `system/directives` returns, per repository, the four tiers' text, whether the shared tier is accepted, and the accepted text when it differs, for the diff.
  * 3. **Prompt injection.** Set `chain_context["sys"]["directives"]` from `get_directives` where the other `sys.*` landmark variables are set.
  * 4. **Protection.** Add the four directive documents to `INSETU_PROTECTED_VFS_TARGETS` in `insetu/core/sdk/__init__.py`.
    * Targets are `(folder, filename)` pairs matched on whole path segments; an empty folder matches the name anywhere. So use the narrowest folders that cover the four documents (for example `.insetu-data/settings`, `.insetu-data/settings.local`, and the control-directory folders that `ctx://settings` and its user tier resolve to), never `("", "agent.md")`.
    * Prove the choice with a test (below).
  * 5. **Settings hub.** In `insetu/core/system/components/ui_system_settings.js`, a Directives section per tier.
    * Editing saves through a route that marks the write as an editor save (origin `ui`, `SOURCE_KEY` = `EDITOR_SOURCE`), so it is written at once.
    * The shared repository tier shows "Not in prompts until you accept" with an Accept button that sends the digest it displayed, and a diff against the accepted text when it changed. Use `sutram-diff-viewer` filling a fixed-height view (`sutram-view ?flush ?noScroll`), as the Review Changes window and the file-diff projection do; inside a scrolling list it breaks scrolling and its view toggle.
* **Deletes:** `get_approved_test_commands` (no callers) and `approve_test_command` in `insetu/core/utils_core.py`; `bridge.test.approve` calls `approve_command(workspace_id, "test", repo, command)` directly.
* **Do not:** call `execute_confirmed_protected_write` or `set_protected_write_handler` (the fitness rule fails); add an approval path outside `attestations.py`; add a pending-change mechanism (S8's handler holds directive writes already); read or write `host.json`; change akasa.
* **Verification** (new `tests/unit/test_directives.py`, written like `tests/unit/test_attestations.py`):
  * Unaccepted shared directives never reach `sys.directives`. Accepting adds them; a changed text drops them; revoking drops them.
  * The accept route refuses a stale digest (409) and a machine origin (403). The routes are `mcp_expose=False` and routine-banned.
  * Tier order and headings are as in 4.3; frontmatter in the user and workspace documents is refused with a notice.
  * Each of the four directive URIs is protected (`is_protected_vfs_target`), and `vfs://<repo>/docs/settings/agent.md` is not.
  * An MCP or agent save to each directive document comes back `pending_confirmation` and writes nothing; a `ui` editor save is written.
  * The full suite and `tests/fitness_functions.py` show no new failures; `SETTINGS_ACCESS_RATCHET` may only go down.
* **Docs in the same change:** §9.9 and §9.10 below in `docs/01_engineering_standards.md`; the agent `settings_schema` notes; CODE_INDEX entries. Give every new function and test class a docstring, because the cartographer writes its descriptions from them.
* **Return:** `git diff <before>..<after>` for insetu, for audit (the agent contract in the roadmap's Reference).

**Sprint 4: Port the session templates** (after Sprint 3; a self-contained brief)

* **Read first:** 4.2, 4.4, the built-in `insetu/extensions/git/prompts/close_session_protocol.md` and `upkeep.md`, and the person's current templates and wrappers in `ctx://prompts/` (the person supplies them; they are not in the repository).
* **Work:**
  * 1. Rewrite `housekeeping-base.md` and `session-start-base.md` against the `sys.*` variables and `{{include_prompt?: ...}}`.
  * 2. Move each repository's `guardrail_rules` and `directives` into its `.insetu-data/settings/agent.md` body, and personal ones (tone, language guidelines) into the user-tier `agent.md` body. Writes to those files are held for the person's confirmation (Sprint 3), which is intended: they review the moved text once in Review Changes.
  * 3. Take ticket paths from `sys.tracker_dir`, and add `extensions/tracker/prompts/housekeeping_tracker_phase.md`.
* **Deletes:** the per-repository wrappers (`inSetu/insetu-close-session.md`, `akasa/akasa-close-session.md`, `sutram/close-session.md`, the start-session wrappers), `_templates/git-protocol.md`, and the `.tracker/` vs `.insetu-data/tracker/` mismatch.
* **Verification:** the insetu, akasa and sutram close-session prompts render from one template, and a rendered diff against today's output shows only the intended changes.
* **Return:** `git diff` per repository plus the rendered before-and-after prompts.

---

### 5. Later Phases

Each phase ships on its own, removes what it names, and moves the ratchet toward the boot floor. Order matters: reads move to the seam before writes are unified, and storage moves last, when nothing reads the old files directly.

| Phase | Adds | Deletes | Done when |
|---|---|---|---|
| **2. Field policy everywhere** | `authority` and `merge` required on every schema field; the resolver applies `override`, `append` and `narrow` | Hand-written tier and range checks in extensions (for example preview's `_validate_overrides` and the bind-host LAN comparison become schema rules) | A fitness rule requires `authority` and `merge` on every field, and no extension compares tiers by hand |
| **3. Reads through the seam** | Topology and system APIs for the values code reads raw today (repo list, mounts, sieve, UI ordering) | Raw `config.json` / `load_config()` reads and `ctx.config["target_repos"]` lookups outside the boot floor | `SETTINGS_ACCESS_RATCHET` lists only boot-floor entries for reads |
| **4. One write path** | Section 2C for every writer, including bridge patches to settings documents | Direct `save_json_config` writes to settings files outside the store (the bridge's name-based `cli.py` / `fallback_bridge.py` check is already gone, removed in S8) | The ratchet lists only boot-floor entries for writes, and a test shows each writer type hitting the same policy step |
| **5. Provenance view** | Effective `ctx://settings/<ext>.md` rendering with per-value provenance | Any place the UI recombines tiers itself | The Settings hub reads effective values and provenance from the view |
| **6. Settings storage in Markdown** | Workspace and user settings move into their `.md` documents (one-shot, versioned migration) | `workspace.settings.json`, workspace-held `repo.settings.json`, and the non-boot parts of `config.json`; the old readers one minor release later | Only the boot floor and `secrets.json` remain as JSON, each a single source |

**Bucket layout in repositories** fits after Phase 2. Exclusions (`drop_patterns`, `ignore_patterns`) are `repo_content` facts. Including anything the global sieve ignores, or anything matching secret patterns, decides what leaves for the model, so it is `human_only` with `merge: narrow`, and secret patterns are never includable.

---

### 6. Standards Additions

Add to Tier 0 security guardrails (`01_engineering_standards.md` §9; §9.8 is taken, so these are §9.9 and §9.10, added with Sprint 3):

> **9.9 Repository content is untrusted configuration.** Files inside a repository may set only fields declared `authority: repo_content`, and may suggest directives. They may never grant permissions, widen exposure, run commands, or include data the global sieve ignores. Repository-owned settings are confined to the repository and labeled as repository content when they reach a model. Suggested directives take effect only after a person accepts them.

> **9.10 Human attestations are one mechanism.** Anything that stays approved (commands, exposure leases, workspace extensions, repository directives) is recorded in the attestation store by kind and content hash, through a human-only route, and never by the request that proposed it; one-shot confirmations (protected changes) go to the audit log. Approving a command trusts it with the user's account; this is not a sandbox. (§9.3's "One Attestation Store" bullet already states the store; this section generalizes it to repository content.)

Add to the engineering rules (outside Tier 0):

> **Migrations remove what they replace.** A change that introduces a new path for configuration names the old path it deletes and ships that deletion in the same release. Remaining direct access is tracked by `SETTINGS_ACCESS_RATCHET`, which may only shrink.