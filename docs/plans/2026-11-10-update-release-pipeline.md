---
title: "Plan: Update as a Release Pipeline, and Repository Links"
description: "Restructures the Semantic Update extension around one release pipeline that works for any project type, with a release declaration that travels with the repository, a responsive list-and-steps UI, and a core concept of links between repositories that update uses for ordering, pin warnings and release trains."
status: "draft"
created: "2026-11-10"
---

# Plan: Update as a Release Pipeline, and Repository Links

Draft by Claude, 2026-11-10, from the user's decisions the same day. Open questions are at the end.

## Roadmap placement (2026-11-10, proposed)

- **b) Demo ready:** Sprints 0 and 1. The new UI on the current backend.
- **c) 1.0:** Sprints 2 and 3. The travelling release declaration, project profiles and publish targets; links in core.
- **d) After 1.0:** Sprint 4. Release trains.

## Premise

Update must not know about any particular project or set of projects. Today it does:

- **The version lives in `pyproject.toml`,** even for projects that are not Python; they get a dummy one.
- **Publishing means PyPI** or "VCS only", as three hardcoded choices.
- **The build defaults to `python -m build`.**
- **Release settings live in the workspace,** so two workspaces that mount one repository can release it differently (the same shape of problem as issue #22).
- **The panel is a page of settings with two "Step" buttons.** A person has to read it to learn what to do next, and its state was not tied to the selected repository (issue #21).

## Decisions (2026-11-10)

1. **Links between repositories are a core concept,** not an update feature.
2. **The release declaration travels with the repository,** so every workspace and insetu instance that mounts it gets identical settings.
3. **A workspace may override it** through the existing cascade: the repository's file is the base, and a file in the workspace's control directory overrides it field by field.
4. **One layout for every width.** The panel is built from sutram's bricks alone and works from a narrow portrait phone to a full desktop. Where a brick lacks a behaviour or a parameter, sutram and insetu change in parallel.

## Design

### 1. One pipeline, declared parts

Every release is **Ready → Version → Build → Publish**. A repository declares four things:

- **Version files:** where the version is written (`pyproject.toml:project.version`, `package.json:version`, a `VERSION` file), or none for tags only.
- **Commit convention:** conventional, emoji, scipy.
- **Build command:** optional.
- **Publish targets:** any number of them. First set: git tag push, GitHub release, PyPI, npm.

A **publish target** is a small adapter with one interface: the secrets it needs, a dry run, a publish, and a check for "is this version published". The UI renders any target the same way, so adding a registry adds no UI.

A **profile** (Python package, Node package, plain repository) detects a project and proposes the four parts. It only proposes: the person confirms, and the declaration is what runs. A project that fits no profile is declared by hand.

To verify in Sprint 2: semantic-release accepts a standalone config file, which would retire the dummy `pyproject.toml`. If it does not, update generates the config it passes to semantic-release from the declaration.

### 2. Where the declaration lives

| Tier | Path | Role |
| --- | --- | --- |
| Repository | `<repo>/.insetu-data/update/` | Travels with the repository. The base. |
| Workspace | `<workspace>/.insetu/update/<repo>/` | Optional override, field by field. |
| Secrets | Workspace secrets, as today | Tokens never go in either file. |

- **The panel shows provenance.** A field overridden in the workspace says so and offers "use the repository's value".
- **Commands that arrive with a repository are approved per workspace.** A build command in a cloned repository is code that insetu would run. It goes through the attestation store like hook commands (a person approves it, the approval is tied to the command's text, and an edited command needs approval again). Publish targets are the same.
- **Format (decided 2026-11-10).** Commented YAML. The declaration is the first file of roadmap P24 (human-readable settings): one strict loader, schema validation on every load, and machine edits that keep comments. Whether it is also an md-db record is open question 1.

### 3. The UI

- **A list of repositories** replaces the dropdown. Each row: name · current version → next version · one state ("Not set up", "Uncommitted changes", "Ready to bump", "Ready to publish", "Released"). Rows keep the workspace's order (dependency order once links exist).
- **Status is stored per repository** (`statusByRepo[repo]`), so a late answer lands in its own slot and the panel cannot show one repository's status under another.
- **One next action.** The selected repository shows the four steps with the current one marked and a single primary button for it: "Set up versioning", "Bump to v0.38.0", "Publish v0.38.0". The dry-run preview before each action stays.
- **Targets as a checklist:** "PyPI: 0.37.1 published", "GitHub release: token missing".
- **Settings out of the way.** Convention, build command, pre-release token and auto-publish sit behind "Release settings". Force version and pre-release sit in a "More" menu.
- **No browser dialogs.** `prompt`, `alert` and `confirm` become sutram modals.

**Responsive rules.** The panel declares structure only: no inline styles, no width checks in the extension.

- **Wide:** list and detail side by side.
- **Narrow:** the list alone; choosing a row opens its detail with a way back.
- **Steps:** a row when there is room, a column when there is not.

Sprint 0 checks which of these sutram's bricks already give. Likely gaps: a list-detail brick that collapses to drill-in, and a steps brick.

### 4. Links between repositories (core)

A link says "A depends on B" or "A vendors B".

- **Inferred where a manifest says so:** a dependency in `pyproject.toml` or `package.json` on a package whose repository is mounted in the workspace.
- **Declared where nothing says so:** vendoring (sutram inside insetu) is listed in the repository's own `.insetu-data/`.
- **Resolved by identity, not mount name.** A link names a package or a remote URL; the workspace resolves it to whichever mount is that repository. Mount names differ between workspaces (issue #22).
- **Other users of the graph:** gather (a linked repository's index as context), an agent run's scope, patches that span repositories, the CI battery's stack.

Update uses the graph three ways:

1. **Order:** rows are listed in dependency order.
2. **Pin warnings:** "insetu pins akasa `<0.10`; akasa is about to become 0.10.0".
3. **Release trains (Sprint 4):** bump linked repositories in order, stopping at each preview, and offer the pin change in the consumer between steps as a staged patch.

## Sprints

### Sprint 0: Brick inventory (S)
- [ ] List what the new layout needs from sutram and what exists. Write the gaps as sutram work items.
- [ ] Add the missing bricks to sutram with their contract tests.

### Sprint 1: The UI on the current backend (M, demo ready)
- [ ] `statusByRepo` in the store; one function chooses the default repository; the person's choice sticks.
- [ ] The repository list, the four steps with one primary action, the targets checklist, settings behind "Release settings".
- [ ] Modals in place of browser dialogs.
- [ ] `ext_update.js` shrinks; lower its line ceiling.
- [ ] Checked at phone and desktop widths.

### Sprint 2: The travelling declaration, profiles and targets (L, 1.0)
- [ ] The declaration schema; repository tier and workspace override; provenance in the panel.
- [ ] Per-workspace approval for build commands and publish targets that arrive with a repository.
- [ ] Publish targets as adapters: git tag, GitHub release, PyPI, npm.
- [ ] Profiles: Python package, Node package, plain repository.
- [ ] Retire the dummy `pyproject.toml`; migrate existing settings into the declaration.
- [ ] Fixes issues #25 (first release leaves the tree dirty) and #26 (hardcoded `CODE_INDEX.md` asset path).

### Sprint 3: Links in core (M, 1.0)
- [ ] The link model in core: inferred from manifests, declared in `.insetu-data/`, resolved by identity.
- [ ] Update: dependency order and pin warnings.
- [ ] Gather offers a linked repository's index.

### Sprint 4: Release trains (M, after 1.0)
- [ ] Bump linked repositories in order with a preview at each stop.
- [ ] The pin change in the consumer as a staged patch between steps.

## Open questions

1. **md-db.** A declaration written as a Markdown record (settings in YAML frontmatter, release notes or a checklist in the body) would be indexed by md-db for free (P20's `md_records`), and links between repositories fit `md_edges`. Recommendation: decide after P20 Sprint 3 shows what md-db indexes well; until then keep the schema format-neutral.
2. **Who builds it.** Proposed: Claude writes Sprint 0's inventory and reviews; Gemini builds Sprints 1 to 3 after the tracker on md-db.
3. **Release history.** Should each release leave a record in the repository (version, date, targets, log)? It would give the panel a history view and md-db another record type.
