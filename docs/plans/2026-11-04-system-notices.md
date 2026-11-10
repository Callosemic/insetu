---
title: "Plan: System Notices, One Mechanism for Everything That Needs Your Attention"
status: "planned"
created: "2026-11-04"
replaces_roadmap_items: [V10, E8, T6]
---
# Plan: System Notices

## Roadmap placement (2026-11-07)

- **1.0:** Sprint 1 in step 2 of the road to 1.0, Sprint 2 in step 3. Neither gates the review-ready cut.
- **New sources:** hook rules waiting for approval (added to Sprint 2 below), and staged conflicts (`waiting`) once the post-diff plan's 4.4 lands.
- **Not a source: "server unreachable".** When the server cannot be reached nothing can be pulled from it, so the boot loader shows that state itself (post-diff 3.1 and Gemini's network-drop item).
- **Placement below predates God-objects Wave 1,** which has shipped. `ui_notices.js` is still a new module.


## Context

The app shell tells you about problems through `insetu-config-banner` (`core/system/components/ui_primitives.js`). It hardcodes four cases, checked in a fixed order, and shows only the first that applies:

1. Quarantined modules (`quarantined_modules`, `degraded_core`)
2. Protected changes waiting for confirmation (`protected_changes_pending`, SSE `protected_changes`)
3. Workspace extensions waiting for approval (`workspace_extensions`)
4. A missing config file (`config_missing`)

Each case has its own boot-state field, its own dismiss flag and its own render branch. A second item hides behind the first until the first is gone.

Three open items would each add another case:

- **V10:** shared repository directives waiting for acceptance drop out of prompts silently. The only place that state shows is Settings → Agent → Directives.
- **E8:** after a bridge commit changes running Python, nothing says a restart is needed.
- **T6:** nothing at startup says whether the server is reachable from other machines.

This plan merges the four existing cases and the three new ones into one mechanism.

## Design

### Notice

A notice is a plain record:

| Field | Meaning |
| --- | --- |
| `id` | Stable within its source, for example `protected_changes` or `repo_directive:insetu` |
| `source` | The registered source that produced it |
| `tier` | `broken`, `waiting` or `info` (below) |
| `scope` | `daemon`, `workspace` or `device`; protected changes are daemon-wide, directives are per workspace, a staged app update is per device |
| `title` | One sentence, written by the source |
| `count` | Optional; for "3 protected changes" |
| `action` | Optional `{label, open}`; `open` names a human-only screen (a settings page, the review window) |
| `digest` | Hash of the notice's content; dismissal is keyed on it |

### Tiers, by what the person has to do

- **`broken`:** something is not running. Quarantined modules, degraded core, missing config.
- **`waiting`:** something is held until a person acts. Protected changes, workspace extensions awaiting approval, shared directives awaiting acceptance.
- **`info`:** worth knowing, nothing is held. Restart needed after a Python change (E8), the server is reachable from other machines (T6), an update is available.

### Sources

- Python sources register through the SDK membrane: `register_notice_source(source_id, fn)`, where `fn(workspace_id)` returns a list of notices. Sources are pulled, never pushed, so the list is always computed from current state and cannot go stale.
- Extensions declare their sources on their blueprint (`@bp.notice_source("<id>")`), which registers the source when the extension mounts and removes it when the extension is disabled, so a disabled extension never leaves a notice behind. Core modules call `register_notice_source` directly.
- A source that raises is skipped and logged; it never hides the other notices.
- When a source's state changes, it calls `notices_changed(scope, workspace_id=None)`. The system recomputes and sends one SSE `notices` event (daemon scope to every tab, workspace scope dropped by tabs on other workspaces, as the multi-tenant plan requires).
- The boot state carries `notices` in place of the per-case fields.
- Some conditions only the browser can see: a newer build staged for the next load (T9), offline mode, changes waiting in the outbox, storage near its quota. Browser sources register in `ui_notices.js` with the same record and the `device` scope, are pulled the same way when their state changes, and merge with the server's list before the banner picks the most urgent. They follow the same tier and action rules; a device notice's action may also be a client action such as Reload.

### Security rules

- Only core sources may raise `broken` notices. Notices from extensions are labelled with the extension's name and limited to `waiting` and `info`.
- Notice text never quotes repository content or extension-supplied prose for core tiers. "insetu suggests new or changed directives" names the repository; it does not show the directives.
- Actions only open screens. Confirming, approving and accepting stay on their existing human-only routes.

These keep a workspace extension or a cloned repository from producing something that looks like a system security warning.

### Display

- One banner shows the most urgent notice (`broken` before `waiting` before `info`, then newest), with "+N more" opening the full list.
- Dismissing hides that notice until its digest changes, so a new pending change or a newly changed `agent.md` comes back.
- `broken` notices can only be dismissed for the current page load.

### Placement

New modules from the start: `insetu/core/system/notices.py` and `insetu/core/system/components/ui_notices.js`. God-objects Wave 1.3 then has nothing to split out of `ui_primitives.js`.

## Sprints

### Sprint 1: Mechanism, and the four existing cases moved onto it

- [ ] `notices.py`: notice record, source registry, `notices_changed`, the `notices` boot field and SSE event. Export `register_notice_source` and `notices_changed` on `insetu.core.sdk`.
- [ ] Sources for quarantine, protected changes, workspace extensions and missing config. `protected_changes` calls `notices_changed("daemon")` where it now sends its own SSE event.
- [ ] `ui_notices.js`: the banner and the list. Delete the four render branches, the `_dismissed*` flags, and the `protected_changes_pending` field and `protected_changes` event.
- [ ] Browser sources and the `device` scope, with the first one: T9's staged update as an `info` notice ("An update is ready") with a Reload action, replacing the `setGlobalStatus` call in `system.js`'s `onUpdateReady`. It stays until the person reloads.
- [ ] Tests: source failure isolation; tier and scope ordering; extension notices refused at `broken`; dismissal returns when the digest changes; workspace notices do not reach other workspaces.

### Sprint 2: The new sources

- [ ] **Directives (V10):** a `waiting` notice per repository whose shared `agent.md` is unaccepted or changed since acceptance, opening Settings → Agent → Directives. Recomputed after bridge commits and file events under `.insetu-data/settings/`.
- [ ] **Restart (E8):** the bridge returns `restart_required: [paths]` when a live commit changes a loaded `.py` module in insetu or akasa (tests excluded); an `info` notice with a Restart action.
- [ ] **Exposure (T6):** an `info` notice at startup with the bound addresses and whether remote access or any exec-class capability is on.
- [ ] **Hook rules waiting for approval:** a `waiting` notice from the hooks extension (`@hooks_bp.notice_source("hooks_unapproved")`) with the number of rules that have no approval, opening the Hooks panel. Rules saved before hook attestations existed stop running without saying so (found 2026-11-07). Recomputed when a rule is saved, approved or deleted.
- [ ] Tests for each source.

## Done when

- `insetu-config-banner` has no case-specific branches; every banner comes from a notice source.
- V10, E8 and T6 are closed by Sprint 2's sources.
- A fitness rule fails if any component other than `ui_notices.js` renders a `<sutram-surface variant="banner">`.
