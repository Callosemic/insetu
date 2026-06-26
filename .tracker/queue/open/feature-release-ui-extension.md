---
title: "Feature: Release Management UI Extension"
status: "Todo"
type: "Extension"
created: "2026-06-26"
---
# Release Management UI Extension

Build a UI control surface around `bump-my-version` to handle version bumps across the workspace without reinventing the underlying Git/regex wheel (adhering to the NIH defense).

### Action Items
- [ ] **Dependency Layer:** Add `bump-my-version` to `pyproject.toml`.
- [ ] **Per-Repo Configurations:** Ensure target repositories (e.g., `axoneme-api`, `glial`) have their own `bump-my-version` config matrices defined in their respective roots.
- [ ] **Context-Aware Backend Bridge:** Expose endpoints that accept a `repo_id`, resolve its physical path via `utils_core.py`, and execute `bump-my-version` strictly within that directory's `cwd`.
- [ ] **Frontend Extension:** Create `insetu/static/js/ext_release.js` to register a new Release tab in the Developer OS.
- [ ] **Multi-Repo UI Implementation:** Build a dashboard where users select a target repository, view its isolated current version, wire up Major/Minor/Patch bump buttons, and render a dry-run preview before committing to that specific repo's release.