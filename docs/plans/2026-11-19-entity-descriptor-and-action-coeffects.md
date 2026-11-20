---
title: "Plan: Live Entity Descriptors, Polymorphic Artifact Chunks & Declarative Action Coeffects"
description: "Eliminates ad-hoc .entityData property bags and manual getChunks/data.chunks ternaries by introducing a single polymorphic chunk resolver (Sprint 1), a live store-backed InSetuEntityDescriptor in the ExtensionRegistry (Sprint 2), and declarative action capability requirements across all core and extension cards (Sprint 3)."
status: "active"
repo: insetu
created_at: "2026-11-19"
models:
  - "vfs://insetu/docs/models/card_and_action_model.md"
coordinates_with:
  - "docs/plans/agent-briefs/gemini_card_actions_and_r1_handoff.md"
  - "2026-11-12-lens-contract.md"
  - "2026-11-05-core-extension-sdk-abstractions.md"
  - "2026-11-11-jit-virtual-context-recipes.md"
tags: [plan, cards, entity-actions, vfs, sutram, manifest, greenfield, dry]
---

# Plan: Live Entity Descriptors, Polymorphic Artifact Chunks & Declarative Action Coeffects

## 1. Architectural Context & Root Cause

During Sprint U2 (`gemini_card_actions_and_r1_handoff.md`), testing multi-part context packs exposed a recurring structural flaw in how frontend cards and entity actions resolve state:

1. **Ambiguous Cache-Miss Fallback in `extractManifestFiles` (`insetu_sdk.js`):**
   When `extractManifestFiles(manifestData, targetKey)` looked up `targetKey` in `manifestData.ctx` or `manifestData.vfs` and found no entry, it returned `[targetKey]` (a 1-element array) instead of `[]`. Consequently, `getChunks(filepath)` could never distinguish between a confirmed 1-part manifest entry and a manifest cache miss (such as an ephemeral Query Quickpack card, an un-manifested handoff pack, or a unit test fixture).
2. **Seven Duplicated `manifestChunks` vs. `data.chunks` Ternaries:**
   Because `getChunks(filepath)` always returned a non-empty array (`[filepath]`), fallback ternaries across `fs.js` (`resolveEntityExportTarget`, `shareFiles`), `fs_store.js` (`preWarmShareArtifact`), `fs_actions.js` (`file-copy`, `file-view-parts`), and `gather_quickpack.js` (`_isSelectionKnownMultiPart`, `gather-pack-copy`) silently ignored `data.chunks` on un-manifested items, while `agent_handoff_and_plan.js` had to write a bespoke `!(manifestChunks.length === 1 && manifestChunks[0] === wfCtxUri && fallbackChunks.length > 1)` workaround.
3. **Stale `.entityData` Property Bags on `<sutram-card>` and `SelectionStore`:**
   More broadly, `<sutram-card>` templates across views construct ad-hoc `.entityData=${{ filepath, isFS, isSource, isTemplate, git_modified, is_dirty, chunks }}` objects at render time. When a card is ticked into `SelectionStore`, that snapshot freezes in memory—forcing manual cache-invalidation workarounds (like `_notifySelectionTrayMultiPart`) when background compilations or buffer edits change the resource's state.

---

## 2. Roadmap Placement & Relationship to Active Plans

* **Sprint 1 (Immediate Slice — Lands in Sprint U2 before U3):** Fixes `extractManifestFiles`, makes `getChunks(filepathOrData, explicitChunks)` and `isMultiPartArtifact(filepathOrData, explicitChunks)` in `fs_store.js` the single polymorphic SSOT for chunk resolution, replaces all 7 ad-hoc ternaries across `fs`, `gather`, and `agent`, and locks the pattern with `AD_HOC_CHUNK_FALLBACK_TERNARY_BAN` in `rules_javascript.py` and a 3-way matrix test in `test_js_behavioral_units.py`.
* **Sprint 2 (Lands after Sprint U3, alongside the `Open` and `Compare` variant sets from `card_and_action_model.md` §5):** Introduces `InSetuEntityDescriptor` in `insetu_sdk.js` / `uri.js` and `ExtensionRegistry.setEntityResolver` in `sutram` so action matchers and handlers receive a live, store-backed descriptor (`entity.uri`, `entity.chunks`, `entity.isMultiPart`, `entity.isEditable`, `entity.isDirty`, `entity.isGitModified`, `entity.hasMacros`) computed from `InSetuURI`, `AppStore.manifest`, and `FsStore.activeBuffers`.
* **Sprint 3 (Full Codebase Card & Extension Sweep — `card_and_action_model.md` §10 "Coverage"):** Sweeps all remaining core views and Tier 3 extensions (listed in Section 4 below), migrating imperative `match: (data) => ...` boilerplate and `MUTATIVE_ACTION_IDS` onto declarative action capability requirements (`requires: { editable, singlePart, webShare, macros, gitModified }`) and retiring manual `.entityData` property bags.

---

## 3. Phased Implementation Plan

### Sprint 1: Polymorphic `getChunks` & `isMultiPartArtifact` SSOT (Immediate Slice — Done 2026-11-19)

- [x] **[S1.T1] Strict Manifest Lookup Option in `extractManifestFiles` (`vfs://insetu/insetu/core/system/insetu_sdk.js`):**
  - Extend `window.inSetu.utils.extractManifestFiles(manifestData, targetKey = null, domain = 'auto', { fallbackToKey = true } = {})` so passing `{ fallbackToKey: false }` returns `[]` when `targetKey` is not present in `manifestData`, preserving `[targetKey]` as the default for legacy callers.
- [x] **[S1.T2] Polymorphic `getChunks` & `isMultiPartArtifact` in `fs_store.js` & `VFS_PUBLIC_API` (`vfs://insetu/insetu/core/fs/fs_store.js`, `vfs://insetu/insetu/core/fs/fs.js`):**
  - Upgrade `getChunks(filepathOrData, explicitChunks = null)` to accept either a URI string or an entity-data object (`{ filepath, filename, chunks }`) and resolve strictly in priority order:
    1. Live `AppStore.getState().manifest` chunks (via `extractManifestFiles(..., { fallbackToKey: false })`).
    2. Explicit/inline `chunks` array (`filepathOrData.chunks` or `explicitChunks`).
    3. Single-part fallback `[normPath]`.
  - Add `isMultiPartArtifact(filepathOrData, explicitChunks = null)` returning `getChunks(filepathOrData, explicitChunks).length > 1`, and export it from `fs_store.js`, `fs.js`, and `VFS_PUBLIC_API` (`window.inSetu.vfs.isMultiPartArtifact`).
- [x] **[S1.T3] Eradicate Ad-Hoc Chunk Ternaries Across Core Modules (`fs.js`, `fs_actions.js`, `gather_quickpack.js`, `agent_handoff_and_plan.js`):**
  - `fs_store.js` (`preWarmShareArtifact`): `const targetFiles = getChunks(baseFile, chunks);`
  - `fs.js` (`shareFiles`): `const filesToFetch = getChunks(baseFile, chunks);`
  - `fs.js` (`resolveEntityExportTarget`): `const chunks = getChunks(data);`
  - `fs_actions.js` (`file-copy.match` & `file-view-parts.match`): Use `isMultiPartArtifact(data)`.
  - `gather_quickpack.js` (`_isSelectionKnownMultiPart` & `gather-pack-copy.match`): Use `window.inSetu.vfs.isMultiPartArtifact(...)`.
  - `agent_handoff_and_plan.js` (`InSetuAgentHandoffPanel.render`): Replace the 6-line `manifestChunks` vs `fallbackChunks` workaround with `const chunks = this.vfs?.getChunks ? this.vfs.getChunks(wfCtxUri, fallbackChunks) : fallbackChunks;`.
- [x] **[S1.T4] Fitness Rule & 3-Way Matrix Unit Test (`tests/fitness/rules_javascript.py`, `tests/unit/test_js_behavioral_units.py`):**
  - Add `AD_HOC_CHUNK_FALLBACK_TERNARY_BAN` to `rules_javascript.py` banning manual `getChunks(...)` + `.chunks` fallback ternaries outside `fs_store.js`.
  - Add unit assertions in `test_js_behavioral_units.py` verifying `getChunks`, `isMultiPartArtifact`, `resolveEntityExportTarget`, and `getEntityActions` across: (1) manifest-backed multi-part packs with no inline `data.chunks`, (2) un-manifested ephemeral multi-part packs with inline `data.chunks`, and (3) manifest recompilation overriding stale 1-part inline `data.chunks`.

### Sprint 2: Live `InSetuEntityDescriptor` & Declarative Action Coeffects (`sutram` + `insetu`)

- [ ] **[S2.T1] Host Entity Resolver & Declarative `requires` Coeffects in `sutram` (`vfs://sutram/sutram/js/sutram_sdk.js`, `primitives.js`):**
  - Add `ExtensionRegistry.setEntityResolver(resolverFn)` in `sutram_sdk.js`. Before evaluating `getEntityActions(entityType, rawData)` or `getAggregatableActions(items, options)`, normalize `rawData` through `this._entityResolver(entityType, rawData)`.
  - Support optional declarative `requires: { editable, singlePart, multiPart, notDir, isDir, webShare, macros, gitModified, conflictArtifact }` on `entityActions` entries so common capability checks are evaluated uniformly by `ExtensionRegistry` for both single-card and bulk-tray actions.
- [ ] **[S2.T2] `InSetuEntityDescriptor` in `insetu` (`vfs://insetu/insetu/core/system/uri.js`, `insetu_sdk.js`):**
  - Implement `InSetuEntityDescriptor` wrapping `InSetuURI` (lexical properties) + live store getters (`manifestEntry`, `chunks`, `partCount`, `isMultiPart`, `activeBuffer`, `isDirty`, `isGitModified`, `hasMacros`, `isProtected`) while maintaining backward-compatible property access for any seed fields passed in `.entityData`.
  - Retire `MUTATIVE_ACTION_IDS` in `insetu_sdk.js` in favor of `requires: { editable: true }` on mutative VFS actions.
- [ ] **[S2.T3] Reactive `SelectionStore` Re-Evaluation & Declarative `SutramCard` Action Slotting (`sutram/js/primitives.js`, `gather_quickpack.js`):**
  - Have `<sutram-selection-tray>` re-evaluate `getAggregatableActions` when `AppStore.manifest` or `SelectionStore` updates, retiring `_notifySelectionTrayMultiPart()` in `gather_quickpack.js`.
  - Replace `SutramCard._injectEntityActions()`'s imperative `document.createElement('sutram-entity-actions')` injection with declarative Lit slot rendering.

### Sprint 3: Full Codebase Card & Action Coverage Sweep (`insetu/core` & `insetu/extensions`)

- [ ] **[S3.T1] Sweep Unexamined Core Views (`fs_modals.js`, `bridge_history.js`, `bridge_projections.js`, `agent.js`, `agent_routine_studio.js`, `config.js`, `offline_ui.js`, `ui_editor.js`):**
  - Audit every `<sutram-card>` and `<sutram-entity-actions>` binding in the unexamined core modules listed in Section 4.1.
  - Fold `Open` (`Edit`, `Preview`, `Contents`, `Details`), `Compare` (`Changes`, `Conflicted Copy`), `Run` (`Rebuild`, `Clean AI Tags`), and `Organize` (`Move`, `Rename`, `Archive`, `Delete`) into their canonical groups/sets per `card_and_action_model.md` §5 & §8.
- [ ] **[S3.T2] Sweep Tier 3 Extensions (`ext_git.js`, `ext_notes.js`, `ext_tracker.js`, `ext_citations.js`, `ext_research.js`, `ext_ingest.js`, `ext_skills.js`, `ext_favorites.js`, `ext_hooks.js`, `ext_cronic.js`, `ext_preview.js`, `ext_format.js`, `ext_freshdesk.js`, `ext_update.js`, `ext_dev.js`):**
  - Remove manual `chunks:` and redundant `.entityData` properties across extensions (allowing `MANUAL_ENTITY_CHUNKS_PROP_BAN` in `rules_javascript.py` to enforce across both `core/` and `extensions/`).
  - Verify every card type and width tier (`< 720px` drawer vs. `>= 720px` inline row) against `card_and_action_model.md`.
- [ ] **[S3.T3] Retire Legacy View-Header Action Components (`Seam C` — `sutram/js/app_shell.js`, `sutram/js/primitives.js`, `insetu/extensions/*`, `rules_javascript.py`, `sutram_consumer_linter.py`):**
  - Fold all remaining extension `headerActionComponent` and view `slot="header-actions"` controls (such as `ext_ingest.js`, `ext_research.js`, and `ext_dev.js`) into declarative `menuActions` / `menuStores` on their `slots:sub-navigation` definitions (per `card_and_action_model.md` §9).
  - Delete `extraContentNodes` from `SutramSubtabMenu` and delete `headerActionComponent` and `slots:sub-navigation-actions` handling from `SutramAppShell` and `ExtensionRegistry.getLayoutSlots`.
  - Add `HEADER_ACTION_COMPONENT_BAN` in `insetu/tests/fitness/rules_javascript.py` and `sutram/tests/sutram_consumer_linter.py` alongside `BANNED_SUB_NAV_ACTIONS_SLOT_BAN`.

---

## 4. Explicit Sweep Checklist of Unexamined Files (For Sprints 2 & 3)

The following files were **not** loaded into full context during the Sprint 1 audit and must be queried via `QUERY_CONTEXT` before executing Sprints 2 and 3:

1. **Core Modals & Projections:**
   - `vfs://insetu/insetu/core/fs/fs_modals.js` (`InSetuBrowserProjection` parts mode & file picker cards)
   - `vfs://insetu/insetu/core/system/components/ui_editor.js` (`file:editor` action registrations)
   - `vfs://insetu/insetu/core/bridge/bridge_history.js` & `bridge_projections.js` (`yomama-turn` & `patch-receipt` cards)
   - `vfs://insetu/insetu/core/agent/agent.js` & `agent_routine_studio.js` (`agent_routine` cards)
   - `vfs://insetu/insetu/core/config/config.js` & `insetu/core/offline/offline_ui.js` (`repo` & `config-repo` cards)
2. **Tier 3 Domain Extensions:**
   - `vfs://insetu/insetu/extensions/git/ext_git.js` (`file:diff` & `repo` cards)
   - `vfs://insetu/insetu/extensions/notes/ext_notes.js` (`file:note` cards)
   - `vfs://insetu/insetu/extensions/tracker/ext_tracker.js` (`task` / `file:task` cards)
   - `vfs://insetu/insetu/extensions/citations/ext_citations.js`, `research/ext_research.js`, `ingest/ext_ingest.js`
   - `vfs://insetu/insetu/extensions/skills/ext_skills.js`, `favorites/ext_favorites.js`, `hooks/ext_hooks.js`, `cronic/ext_cronic.js`, `preview/ext_preview.js`, `format/ext_format.js`, `freshdesk/ext_freshdesk.js`, `update/ext_update.js`, `dev/ext_dev.js`
3. **Sutram Layer 2 Registry & Action Brokers:**
   - `vfs://sutram/sutram/js/sutram_sdk.js`
   - `vfs://sutram/sutram/js/primitives.js`
