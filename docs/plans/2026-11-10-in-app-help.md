---
title: "Plan: In-App Help"
description: "Help that ships inside the package: per-module help declared in manifests, a read-only ctx://help/ volume, a skippable getting-started tutorial on the demo workspace, and context-sensitive entry points. Replaces the broken System gear -> Documentation route (roadmap R10)."
status: "draft"
created: "2026-11-10"
---

# Plan: In-App Help

Draft by Claude, 2026-11-10, from the user's decisions the same day. The user has answered its questions.

## Roadmap placement (2026-11-10)

- **a) Review ready:** Sprint 1. The route works and shows the bundled overview and getting-started page.
- **b) Demo ready:** Sprints 2 and 3. Declared per-module help on `ctx://help/`, and the tutorial on the P7 demo workspace.
- **c) 1.0:** Sprint 4. Context-sensitive entry points and agent access.

## Premise

Most people who install insetu never mount the insetu repository, so help cannot be read from a workspace: it ships inside the package, matches the installed version, and works offline.

- **User docs live in the app:** what insetu is, getting started, how each module works.
- **Contributor docs stay in the repository and on GitHub:** `docs/`, ADRs, plans, mental models, REVIEWING.md.

## Design

1. **Declared per module.** Each core module and extension may ship a `README.md` (or a `help/` folder) in its package directory and declare it in its manifest. The Help page lists enabled modules only; a module that declares no help does not appear.
2. **Help links on the extensions settings page.** Each module on the enable/disable page links to its help, so a person can read about an extension before enabling it. The Help page itself is not a discovery surface (decided 2026-11-10).
3. **A read-only `ctx://help/` volume** mounted from package resources. Pages render through the Markdown provider: headings make the table of contents, relative links resolve between pages, and the service worker caches them for offline use.
4. **Getting started on the demo workspace** (P7's seeded workspace): pack context, ask in chat, review and apply a patch, undo it, open the tracker. The first version is a checklist that ticks steps off from state the app already has (a commit exists, a stack was approved).
5. **Easy to leave, for power users** (decided 2026-11-10): the tutorial never opens on its own after the first run; "Skip tutorial" ends it in one click from any step; a dismissed tutorial stays dismissed per device; it can be resumed from Help; and a setting turns first-run guidance off entirely.
6. **Context-sensitive entry points:** a "?" on each panel opens that module's page; notices can link to a help anchor; the chat agent can read `ctx://help/` as a context source.

**Decided 2026-11-10:** the menu item is called "Help". Guided highlights in the UI are not planned; the checklist is the tutorial.

## Sprints

### Sprint 1: The route works (review ready)
- [ ] System gear -> Help opens a page rendering a bundled overview and getting-started text from the package.
- [ ] A test that the route renders and that every bundled link resolves.

### Sprint 2: Declared help on ctx://help/ (demo ready)
- [ ] Manifest field for module help; the read-only `ctx://help/` volume; the Help page lists enabled modules' pages.
- [ ] Help links on the extensions settings page.
- [ ] READMEs for the modules that are their own apps first: tracker, skills, Bonsai, hooks.
- [ ] Tests: a disabled module's help is reachable from the settings page but not listed on Help; a module without help is absent; links resolve.

### Sprint 3: The tutorial (demo ready, with P7)
- [ ] The checklist on the demo workspace, ticked from app state.
- [ ] Skip in one click, dismissed per device, resumable from Help, a setting to turn first-run guidance off.

### Sprint 4: Entry points (1.0)
- [ ] "?" per panel, help anchors on notices, `ctx://help/` as an agent context source.
