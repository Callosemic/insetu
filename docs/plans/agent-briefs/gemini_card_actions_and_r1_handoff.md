# Lane A Brief: Card Actions and the R1 Handoff

**Created:** 2026-11-18
**Lane:** Gemini Lane A (the standard engineering session), not the Lane B dogfooding session.
**Why now:** the R1 video (the README clip) needs the core loop to look right on camera, and the owner has ruled that nothing is faked for the video and nothing is built that will need reverting. Every item below is a piece of the settled card and action model, built for real.
**Source of the model:** the owner's decisions of 2026-11-18, recorded in the working doc "inSetu UX model and R1 polish" (a Claude Doc, not in this repository). Section 1 restates everything this brief depends on, so this brief is self-contained.
**Review:** send a `git diff` per repository (sutram, then insetu) for Claude's pre-commit review, as usual.

---

## 1. The model this brief builds toward

Read this section first. The sprints build only part of it, but nothing built here may contradict it.

**The card.** Every card has four zones: the selector on the left (tap or left swipe), the body (a tap runs the primary action), marks (small state indicators such as FS's "M"), and actions.

**One rule for action rows: show what fits, then the three-dot menu.** No action row scrolls sideways, anywhere: inline on a wide card, in a narrow card's drawer, or in the selection tray. A row shows as many buttons as fit, in priority order, and puts the rest behind a three-dot button whose dropdown lists them under their group's section heading. Section headings always show.

**Card width tiers come from the card's own width, not the window's.** sutram's column unit is 360 px (`floor(window width / 360)` columns, clamped 1 to 3). A card 720 px wide or more (two units) shows its actions inline. A narrower card keeps them behind the right-side trigger, which opens the drawer. A card in a window spanning two columns is wide even when the shell is in tablet mode, which is why the card measures itself.

**The action schema has three kinds of entry, and none nests inside another:**

| Kind | Holds | Looks and behaves |
| --- | --- | --- |
| Action | One thing to do | A plain button or menu item; one click runs it |
| Variant set | Equivalent ways of doing one thing | A split button: the main part runs the current default variant, the arrow lists all variants (with section headings) |
| Group | Different actions that belong together | A dropdown: a click lists the members; nothing runs until one is picked |

**Variant sets in detail.**
- The default is the variant last used **for that entity type on that device**.
- Before any use, the default is the first available variant from an ordered preference list declared per family of entity types (section 4).
- The button's label is the current variant's own label, so every variant label must read on its own as a complete verb phrase ("Share Expanded", not "Expanded").
- The button is always as wide as its longest *available* label (available on this device, for this item), so it never shifts width.
- An extension adds a variant to a set by naming the set. The set is owned by whoever defines it: core defines Send.

**Send** is one flat variant set: Copy, Download and Share, each Raw or Expanded, in two sections headed "Raw" and "Expanded", plus Publish from the publish extension. Variants that can't work here are hidden (Share without a share sheet; Expanded where the file has no macros). Parts and ZIP stay automatic: the format follows what is being sent.

**Ranking.** Which actions surface first is set by the entity type's author through a `surfaced` rank. There's no per-user customisation for now.

**Confirmation.** An action confirms itself on the button that started it ("Copied"); the status bar keeps the record but is not the only signal.

---

## 2. Ownership

| Repository | Files this brief owns |
| --- | --- |
| sutram | `yenvui/js/card.js`, `yenvui/js/async-btn.js`, `yenvui/js/dropdown.js` (only if the split button needs it), `sutram/js/primitives.js` (`SutramEntityActions`, `SutramCard`, the selection tray), `sutram/js/sutram_sdk.js` (`getEntityActions`, `getAggregatableActions`, the new set registry), `sutram/js/app_shell.js` (only to share the column-unit constant), sutram's tests |
| insetu | `insetu/core/fs/fs.js` (the file action registry), `insetu/core/gather/gather.js`, `insetu/core/gather/engine_gather.py` (part-size fallback only), `insetu/core/prompts/prompts.js`, `insetu/core/bridge/bridge.js` (its `registerExtension` manifest only), `insetu/extensions/publish/ext_publish.js`, the vendored `insetu/static/vendor/sutram/`, a new `tests/unit/test_bridge_chat_wrappers.py` |

**Hands-off.** Everything Lane B owns, per `gemini_offline_bridge_followup.md`, and in particular `engine_bridge.py` and `bridge_fuzzy.py`: the new test exercises the parser without editing it. Also everything in Lane C (Claude), and your own Lane A agent files, which this brief doesn't touch.

**Order.** Do Sprint U1 (sutram) first, release it, and vendor it into insetu before Sprint U2, because insetu consumes the new registry shapes. Sprint U3 (added 2026-11-19) comes after U2: its sutram part is released as 2.11.0 and vendored before its insetu part.

**U3 also owns:** in sutram, all of `sutram/js/app_shell.js`, the `LayoutStore` and the `ExtensionRegistry` in `sutram/js/sutram_sdk.js`, and `SutramEntityActions`, `SutramSelectionTray` and `SutramSubtabMenu` in `sutram/js/primitives.js`. In insetu: `insetu/core/system/insetu_sdk.js` (the registry helpers only), `insetu/core/fs/fs.js` and `insetu/core/fs/fs_actions.js` (Copy only), `insetu/core/gather/gather_quickpack.js` (bulk Copy only), the `PRIVATE_REGISTRY_ACCESS_BAN` exemption in `tests/fitness/rules_javascript.py`, `insetu/templates/index.html`, the gear (`insetu-system-settings` in `insetu/core/system/components/ui_system_settings.js`), `insetu/core/system/components/ui_filter_pills.js`, the default layout in `insetu/core/system/system.js`, and only the repo filter rows in `gather.js`, `extensions/git/ext_git.js`, `core/bridge/bridge_projections.js`, `core/bridge/bridge_history.js` and `extensions/citations/ext_citations.js`. Notes and Tracker stay with Lane B.

---

## 3. Sprint U1: sutram (release as 2.10.0)

**U1.1 No side-scrolling: "fit, then the three-dot menu".**
- Today `yenvui/js/card.js` styles `.actions-wrapper` with `overflow-x: auto` (about line 280) and has swipe-scroll logic around it (`_actionsScrollLeft`, `scrollableContainerSelector: 'actions-wrapper'`).
- `SutramEntityActions` has a `scrollable` mode that wraps its buttons in `sutram-scrub-track`.
- `SutramCard._injectEntityActions` forces the injected row to `flexWrap: 'nowrap'` and `width: 'max-content'`. That is the overflow behind test-take note B5.
- Replace all three with one measured row. Render buttons in priority order (`surfaced` rank first, then `order`), measure the space with a `ResizeObserver` on the row's container, show as many as fit, and put the rest behind a three-dot dropdown that lists them under group section headings.
- The same component serves the wide card's inline row, the narrow card's drawer and the selection tray.
- Keep the left-swipe selector gesture working on the card; only the actions row stops scrolling.

**U1.2 Card width tiers.**
- Export one constant for the column unit (360 px) from sutram and use it where `app_shell.js` and `sutram_sdk.js` compute capacity today (`Math.floor(window.innerWidth / 360)` appears in several places).
- The card measures its own width (a `ResizeObserver`, or a container query plus a property). At 720 px and up (two units), actions render inline and the right-side trigger is hidden. Below that, the trigger opens the drawer, whose contents are U1.1's row.
- The existing card-level container query at 480 px keeps its current styling job.

**U1.3 The variant-set split button.**
- Add a sutram element (suggested name `sutram-variant-btn`) built on the yenvui async button.
- The main part runs the current default variant and shows the async states.
- The arrow opens the variant list, with section headings, through the existing dropdown.
- The label is the current variant's label, and the minimum width is the widest label among the *available* variants.
- In a U1.1 row, a variant set counts as one button. In the three-dot list, it shows as its section of variants.

**U1.4 Actions confirm on their own button.**
- `yenvui/js/async-btn.js` already cycles working, success and error, and already has a `successLabel` property. Two problems hide this:
  - `SutramEntityActions` closes the drawer the moment an action resolves, unless the action sets `keepDrawerOpen` (`primitives.js`, around line 1704), so the success state is never seen.
  - No action passes its own `successLabel`.
- Fix: pass a declared `successLabel` through to the button; when an action resolves, keep the drawer or dropdown open until the success state has shown (about 900 ms), then close it. An action with `keepDrawerOpen` keeps today's behaviour.
- Leave the status-bar message as it is.

**U1.5 Registry: surfaced ranks, variant sets, last-used defaults.**
- **New optional fields on an action:** `surfaced` (a number; lower shows first; absent means "only in the three-dot menu"), `successLabel`, and `set` plus `section` to join a variant set.
- **New registry call for sets:**
  - `registerVariantSet({ id, label, icon, group, sections: [labels in order], defaults: { <familyKey>: [ordered variant action ids] } })`.
  - `familyKey` maps from entity types through a declared table (section 4).
- A variant that names a section the set didn't declare gets that section appended after the declared ones, in registration order. This is how Publish adds its own section to Send.
  - `getEntityActions` returns sets as single entries, each carrying its available variants.
  - `getAggregatableActions` does the same for bulk.
- **One level only:** a variant must be a plain action. Refuse, with a console warning, any registration that puts a set inside a set or a group.
- **Last-used storage:** a small sutram store with `localSync` (as `LayoutStore` does), keyed `<entityType>:<setId>` to the variant id. It is device-local, so no settings file is involved; that's deliberate.
- **Default resolution:** the last used variant, if it's available for this item on this device; otherwise the first available id in the family's preference list.
- **A missing group:** today the menu-bar path files an action with no group under Tools, while the bulk path files it under File. Make both use Tools.
- **A guard:** in development builds, warn when a set shows more than eight variants at once on one device.

**U1 tests and release.**
- **Unit tests:**
  - fit-then-overflow at three container widths;
  - default resolution (last used, an unavailable last used, first-use preference order);
  - the nesting refusal;
  - success-state timing.
- **Consumer linter:** extend it so insetu's `test_sutram_compliance.py` knows the new properties (`surfaced`, `successLabel`, `set`, `section`).
- **Release:** commit with a `feat` message and leave the version and CHANGELOG alone: semantic-release writes both when the owner releases 2.10.0.

---

## 4. Sprint U2: insetu

**U2.1 Vendor sutram 2.10.0.**

**U2.2 The Send set.**
- In `insetu/core/fs/fs.js`, register the set `send` (label "Send", sections "Raw" and "Expanded").
- Join the existing actions to it and relabel them:

| Today | Becomes |
| --- | --- |
| `file-copy` Copy | Copy Raw |
| `file-download` Download | Download Raw |
| `file-share` Share | Share Raw |
| `file-copy-expanded` Copy Expanded | Copy Expanded |
| `file-download-expanded` Download Expanded | Download Expanded |
| `file-share-expanded` Share Expanded | Share Expanded |

- Give Copy Raw and Copy Expanded `successLabel: 'Copied'`, the Downloads 'Downloaded', and the Shares 'Shared'.
- Keep each action's existing `match` test; it is what hides the unavailable variants.
- Publish (`ext_publish.js`, `publish-doc`) joins `send` in a third section, "Publish".
- Give the `send` set `surfaced: 1`. That surfaces it on every card, which is intended: Send is the main verb everywhere. Give Browse `surfaced: 2`; its `match` already limits it to packs and diffs.
- Other entity types keep their current actions, appearing as plain actions in their declared group, until a later pass folds them in.

**First defaults (decided 2026-11-18).** Declare these family keys and preference lists:

| Family | Entity types | Send preference order |
| --- | --- | --- |
| files | `file`, `file:note`, `file:prompt` | Copy Raw, Share Raw, Download Raw |
| structured | `task`, `file:task`, `skill` | Copy Raw, Share Raw, Download Raw |
| packs | `file:context`, `file:diff` | Copy Raw while the pack is one part, then Share Raw, then Download Raw |
| folders | `folder`, `repo`, `config-repo` | Download Raw |
| records | the remaining record types | Copy Raw, where Send applies at all |

"While the pack is one part" is availability, not preference: Copy Raw's `match` should be false for multi-part packs, so resolution falls through to Share Raw or Download Raw.

**U2.3 Bulk Send in the selection tray.**
- The tray builds its list from `getAggregatableActions(items, { group: 'share' })` (sutram `primitives.js`, around line 670).
- Gather already registers bulk Download, Share and Compile Only for any entity (`gather-pack-download`, `gather-pack-share`, `gather-pack-compile` in `gather.js`).
- Join the first two to `send` as Download Raw and Share Raw.
- Add a bulk `gather-pack-copy` (Copy Raw, `successLabel: 'Copied'`) that compiles a quickpack through the existing `pack_selection_task` and copies its text.
- **Mind the WebKit user-gesture rule.** `gather.js` already has a synchronous fast path that preserves the gesture for Share when the quickpack is already compiled. For Copy after an asynchronous compile, use `navigator.clipboard.write([new ClipboardItem({ 'text/plain': promiseOfBlob })])`, which Safari accepts inside the gesture, not `writeText` after an `await`.
- If the compiled quickpack has more than one part, Copy Raw is unavailable for that selection, the same as for packs.
- Expanded variants stay hidden for bulk: quickpacks are compiled raw on purpose. The Yomama protocol's own `{{ymm:...}}` macros are escape codes the model must see literally, so expanding them would corrupt the instructions.
- **Do not change quickpack order:** files land in the order they were ticked. It's what lets the owner tick the protocol first so it lands at the top.

**U2.4 Core prompts.**
- In `insetu/core/prompts/prompts.js`, add a "Core prompts" section at the top of the Prompts view.
- It lists prompts declared by extension manifests in a new optional field, `corePrompts: [<ctx:// URIs>]`.
- Add `corePrompts: ['ctx://prompts/.templates/bridge/yomama_patch_protocol.md']` to the bridge's manifest in `insetu/core/bridge/bridge.js`.
- Declare it in the manifest, not in the prompt file: the protocol has no frontmatter and is sent raw, so a flag in the file would reach the model as noise.
- Cards in the section are ordinary prompt cards: selectable, so they can join a selection with a Gather card.

**U2.5 Default part size 250 kB.** In `compile_context_payload` (`engine_gather.py`, around line 171), change the fallback used when `max_context_size_kb` is 0 from 400 to 250. Leave the setting's default (0) and the lifeboat's 256 kB alone.

**U2.6 Bridge regression test.**
- Add `tests/unit/test_bridge_chat_wrappers.py`.
- Feed `parse_blocks` one valid two-file patch wrapped nine ways, and assert that each parses identically to the clean, fenced patch:
  - bare, with no fences;
  - Gemini's "Plaintext" label line with the fences dropped;
  - "Plaintext" above a fenced block;
  - ChatGPT's "text" and "Copy code" label lines;
  - prose before and after a fence;
  - a label line between two files' blocks;
  - CRLF line endings;
  - non-breaking and zero-width spaces in the prose;
  - trailing spaces on marker lines.
- Add one case asserting that a label line *inside* a REPLACE body is kept verbatim: the parser can't tell it from code, and the dry run is where a person catches it.

---

## 5. Sprint U3: the shell's top row (sutram 2.11.0, then insetu)

**Decided 2026-11-19.** One row instead of two, so the shell gives the content more room in every frame of the clip. Build it after U1 and U2: it reuses U1's measured row, dropdown section headings and width-dependent labels.

**Today.** `sutram/js/app_shell.js` draws two rows.
- **A global header row:** the launcher's category tabs (one Tools button on a phone), the column dots (`mobile-dots-wrapper`, `desktop-dots-wrapper`), and the `header-quickpack`, `header-actions-left` and `header-actions` slots. insetu fills `header-actions` in `templates/index.html` with the selection tray (`sutram-selection-tray`, "Quickpack Deck") and the gear (`insetu-system-settings`).
- **A row per column (`col-header`):** the projection tabs in a sideways-scrolling `sutram-scrub-track class="sub-tabs"`. On the right are the active projection's `headerActionComponent`, any `slots:sub-navigation-actions` entries and `sutram-subtab-menu`.

**The new row, per column, left to right:**
1. **The view's menu (three dots), first, in the same place in every column.** Its top header row is a four-part quick bar (`[   ] [ × ] [   ] | ↻`: three column-jump slots with the active column marked, a divider, and the refresh icon button — owner decision, 2026-11-19), followed by what `sutram-subtab-menu` shows (`menuActions`, `bulkActionGroup`) and anything in its header action component and sub-navigation actions, under section headings.
2. **The tab dropdown on the active tab** ("Yomama ▾"). It merges today's tab strip and launcher:
   - **"Open in this column":** the active tab ticked; each row has × to close and a long press (or drag) to move it to another column or pop it out; the unsaved-changes asterisk shows.
   - **"Add a tab":** the launcher's categories as sections. Items stay draggable into another column, as they are today.
   - **Type to filter:** yenvui's dropdown already supports `searchable`.
3. **Other open tabs inline, as plain tabs, as many as fit** (U1's measured row). Tapping one makes it active. The dropdown always lists them all. The sideways-scrolling tab strip goes.

**The globals: only the last column's row ends with them.**
4. **The selection tray chip,** present only while something is selected; it disappears completely otherwise. Its label is "2 selected" when there's room, and the tray icon with the count when there isn't.
5. **The gear's pinned slot.** It collapses to nothing when nothing is pinned. Build the slot empty; what can be pinned comes later.
6. **The gear** (`insetu-system-settings`). It gains "Repositories in scope", the global repo filter (below), alongside notifications and settings.

**The position bar replaces the dots.** A 4 px bar along the top edge of the row area, full width, highlights the columns on screen.
- Segment widths come from `layoutRatios`.
- Tap a segment to jump there (`setMobileViewport`); swipe along the bar to pan (reuse the dots' pan handler).
- It's hidden when every column fits.

**Width-dependent labels.** Add one sutram helper that shows a label with its icon when there's room and the icon alone when there isn't. U3 uses it for the tray chip; the lens switcher will use it later.

**Touch targets.** Every control in the row gets a 44 px hit area, whatever its drawn size.

**The repo filter moves into the gear (insetu).** The pin is already global: `AppStore.pinnedRepos` and `setPinnedRepos`, synced to the device. The gear shows it once, with `insetu-repo-filter`.
- **Remove the filters that already write the global pin:** the per-view repo filter rows in Gather, Git, Bridge projections and Bridge history, and the Yomama tab's header "Filters" dropdown (`insetu-ext-bridge-actions`, which holds only that filter).
- **Citations:** switch from its own store's `pinnedRepos` to the global pin and drop its filter row. Its extra option (Orphans) moves into its own view menu.
- **Notes and Tracker belong to Lane B** (P20). Leave their filter rows and their pins to Lane B: its brief has them follow the global pin (decided 2026-11-19). Note in your summary any place where they still show a repo filter after U3.

**Default layout for new workspaces (insetu).** Today nothing is pinned in a new workspace, which is why its first screen shows "No projections allocated". Change that for a workspace with no saved layout and no hash target:
- **Column 1:** Prompts (`prompts`), then Files (`files`), with Prompts active.
- **Column 2:** Gather (`gather`).
- **Column 3:** Yomama (`bridge`).
- A phone opens on column 2.
- Pin through `LayoutStore.pinToColumn` with the registered slots, and never replace a saved layout.

**Carried into U3 (decided 2026-11-19).** Three groups. The sutram ones ship in 2.11.0 with the shell work; the insetu ones come after 2.11.0 is vendored.

*Sutram: the registry helpers insetu patches on today.* U2 added four methods to sutram's registry from `insetu_sdk.js` (`collectManifestField`, `collectManifestEntries`, `getRegisteredExtensionNames`, `setActionFilterPredicate`) and wraps the private `_collapseVariantSets`. They belong in sutram, written domain-neutral, with these changes rather than copied as they are:
- **One manifest reader, not two.** Add `getManifestEntries(field, { activeOnly = true })`, returning `[{ extName, value }]` in registration order; `activeOnly` applies the extension filter sutram already has (`setFilterPredicate`). `collectManifestField(field, options)` is a thin helper over it that flattens array values. Today the two versions disagree on whether inactive extensions count; pass `activeOnly: false` explicitly where that's wanted (the settings-schema wiring in `system.js`).
- **`getExtensionNames({ activeOnly = false })`** replaces `getRegisteredExtensionNames`.
- **`setActionFilter(fn)`, a real hook, not a wrap.** sutram calls `fn(action, item, entityType)` inside `getEntityActions` and `getAggregatableActions`, before variant sets are collapsed, so a set never shows a variant the host hid. For bulk, an action survives only if every item passes. One filter per registry; setting it again replaces it.
- **insetu's filter keeps only its own rule.** Its first check (drop actions from inactive extensions) repeats what sutram's extension filter already does in both paths, so delete it. What stays is the shared-asset rule: no mutative action (`MUTATIVE_ACTION_IDS`) on a `ws://` item. The parked entity-descriptor plan (its Sprint 2, `requires: { editable }`) is where that rule moves later; don't start it here.
- **Node tests in sutram** for each method, including the filter running before collapse and the bulk every-item rule.

*Sutram: U1's follow-ups.*
- **Last-used key for a selection:** when every selected item has the same entity type, remember the variant under that type, in the tray and in the sub-tab bulk menu. Use `bulk` only for mixed selections.
- **The eight-variant warning:** development builds only, and once per set and entity type rather than on every render.
- **Clipped buttons:** after a row renders, if it overflows its container, move one more entry into the three-dot menu. That corrects the 7.5 px a character estimate instead of letting the row clip a button.

*insetu, after 2.11.0 is vendored.*
- **Remove the helpers from `insetu_sdk.js`:** the four `typeof … !== 'function'` blocks and the `_collapseVariantSets` wrap. Call the sutram methods directly (`getManifestEntries` or `collectManifestField` in `prompts.js` and `system.js`, `getExtensionNames` in `system.js`, `setActionFilter` in `insetu_sdk.js`), and drop `insetu_sdk.js` from `PRIVATE_REGISTRY_ACCESS_BAN`'s exemptions. `insetu_element.js` keeps its exemption only if it still needs it; say so in your summary.
- **Single-card Copy Raw on Safari:** `file-copy` fetches the text and then calls `navigator.clipboard.writeText`, which Safari can refuse once the click is no longer current. Add one helper in `fs.js` that writes text from a promise through `ClipboardItem` (falling back to `writeText` when `ClipboardItem` is missing), and use it for single-card Copy (both Raw and Expanded) and for the tray's bulk Copy in `gather_quickpack.js`.
- **"Copied" in the tray:** bulk Copy clears the selection as soon as it finishes, so the tray disappears before the confirmation shows. Clear it once the button's confirmation has settled (`yenvui-action-confirmed` with `phase: 'settled'`), not before.

**Not in U3:** the views' own header buttons (the `header-actions` slot inside views, such as Research's New Job and Dev's buttons), the choices for the gear's pinned slot, and the terminal's helper-key row (it gets its own look with the terminal work). All come later.

**Release:** sutram 2.11.0 (semantic-release writes the version and CHANGELOG; don't edit them), vendored into insetu, then the insetu changes.

### Sprint U3 Addendum: Substrate Seams Discovered & Resolved in `sutram` 2.11.0 (For Claude's Review)

While implementing the `sutram` 2.11.0 portion of Sprint U3, five cross-cutting seams surfaced where moving globals into `.col-header` and unifying row mechanics exposed underlying lifecycle or Shadow-DOM boundary gaps. Rather than patching them with local workarounds, we resolved them at the substrate level and locked them with unit and fitness checks:

1. **Cross-Shadow-Slot Container Observation (`SutramContextMixin.observeAssignedContainer` & `resolveAssignedSpatialContainer` in `sutram_sdk.js`):**
   - **The Seam:** Moving `<slot name="header-actions">` (which hosts `<sutram-selection-tray>` and `<insetu-system-settings>` in `index.html`'s Light DOM) into the rightmost visible `.spatial-col` inside `SutramAppShell`'s Shadow DOM meant `this.closest('.spatial-col')` inside `SutramSelectionTray` returned `null` and fell back to the shrink-wrapped `<div slot="header-actions">` (~44 px), permanently forcing the compact icon-only chip even on wide desktop columns.
   - **The Substrate Fix:** Added `resolveAssignedSpatialContainer(selector)` and `observeAssignedContainer(callback, selector)` on `SutramContextMixin`. It walks `cur.assignedSlot || cur.parentElement || cur.getRootNode()?.host` across Shadow DOM boundaries, attaches a managed `ResizeObserver` to the enclosing `.spatial-col` (auto-disconnected in `disconnectedCallback()`), and feeds `SutramSelectionTray` the true column width (`>= 480px` shows `"2 selected"`, `< 480px` shows icon + badge). Also added a configurable `.bulkGroup` property (defaulting to `'share'`) on `SutramSelectionTray`.
2. **Capture-Phase Post-Drag Click Arbitration (`YenvuiGestureController` in `yenvui/js/physics.js`):**
   - **The Seam:** `YenvuiGestureController` fired `onPanEnd` on `pointerup` (which reset `_dragState.active = false`) *before* the browser dispatched the trailing `click` event. Consequently, ad-hoc `if (this._dragState?.active) return;` guards inside `@click` handlers on inline tabs and tab-dropdown items were already `false` when `click` arrived, causing drag gestures to double-fire tab selection/pinning.
   - **The Substrate Fix:** `YenvuiGestureController` now tracks `_gestureCaptured` whenever a gesture crosses the 5 px pan threshold or triggers `onLongPress`. On `pointerup`, if `_gestureCaptured` is true, the controller installs a one-shot capture-phase `click` listener (`stopImmediatePropagation` + `preventDefault`, with an 80 ms cleanup timer if no `click` follows). All manual `if (this._dragState?.active) return;` checks in `SutramAppShell` were removed, and `_activateDrag()` closes any open `.active-tab-dropdown` popover immediately.
3. **Shared Fit-Then-Overflow Engine & Post-Render Clamping on `.col-tabs-area` (`app_shell.js` & `primitives.js`):**
   - **The Seam:** Inline open tabs in `SutramAppShell` initially used a separate character-width loop without `SutramEntityActions`'s post-render `scrollWidth > clientWidth` step-down clamp.
   - **The Substrate Fix:** `SutramAppShell` now imports and reuses `computeFitActionCount` from `primitives.js` and runs `_checkInlineTabsOverflow()` in `updated()`, decrementing `_inlineTabClampCounts[colId]` whenever `areaEl.scrollWidth > areaEl.clientWidth + 1` so wide tab titles drop cleanly into the active tab dropdown without clipping.
4. **Persistent View Menu Subscription Teardown, Sectioning & Slotted Control Dismissal (`SutramSubtabMenu` in `primitives.js`):**
   - **The Seam:** Because `<sutram-subtab-menu>` now stays mounted in every column header (rendering `disabled` when empty so tabs never shift), switching tabs repeatedly called `_bindSlotMenuStores()`, which pushed new `this.subscribe(storeName, ...)` handles onto `_storeUnsubs` without removing the previous tab's store listeners. Additionally, `Clear Selection` lacked its own section heading after a flattened variant set, and legacy `headerActionComponent` / `slots:sub-navigation-actions` nodes slotted into `<div slot="content">` did not close the dropdown after confirmation.
   - **The Substrate Fix:** Added `this.unsubscribe(unsubFn)` to `SutramContextMixin` and called it in `_bindSlotMenuStores()`; placed `Clear Selection` under a dedicated `Selection` section heading; and wired `@yenvui-action-confirmed` (`phase: 'settled'`) on `<div slot="content">` to close the parent dropdown.
5. **Self-Linting `sutram/js` with Consumer Tag Rules (`sutram/tests/fitness/rules_sutram.py`):**
   - **The Seam:** `sutram_consumer_linter.py` checked `<sutram-*>` tag rules (`SUTRAM_INLINE_STYLE_BAN`, `SUTRAM_UNDECLARED_PROPERTY`) on consumer repositories (`insetu`), but `sutram`'s own `rules_sutram.py` did not run `iter_sutram_tags` on `sutram/js/`.
   - **The Substrate Fix:** Wired `iter_sutram_tags` and `undeclared_bindings` into `rules_sutram.py` (catching and removing two `<sutram-icon style="...">` inline styles and dead `.masthead-action-rail-cell` CSS in `app_shell.js`).
6. **Follow-Up Legacy Eradication Queue (To Confirm with Claude):**
   - **In `insetu` U3 (next step):** Delete the 4 monkey-patched registry polyfills and `_collapseVariantSets` wrapper in `insetu_sdk.js`, delete `sutram:is-swapping-scope` once `StoreRegistry.isTransitioning()` is the sole transition check, and add `LEGACY_SHELL_HEADER_SLOT_BAN` in `insetu/tests/fitness/rules_javascript.py` banning `.top-utility-row`, `.mobile-dots-wrapper`, and `.desktop-dots-wrapper`.
   - **Post-U3:** Fold remaining extension `headerActionComponent` and `slots:sub-navigation-actions` usages into declarative `menuActions` (then delete `extraContentNodes`, `headerActionComponent`, and `slots:sub-navigation-actions` completely), and replace `SutramCard._injectEntityActions()`'s imperative `document.createElement` injection with declarative Lit slot rendering under `2026-11-19-entity-descriptor-and-action-coeffects.md` Sprint 2.

---

## 6. Acceptance

- CI green in sutram and insetu, fitness rules included.
- **Manual checks, in portrait on a phone and on a desktop:**
  - No action row scrolls sideways anywhere.
  - In a 480 px panel, a Gather context card shows its row as fit-then-three-dot, with Send as one split button.
  - Copy shows "Copied" on its own button.
  - Tick the Yomama protocol under Core prompts, then the Yomama Beats card in Gather, then Copy Raw in the tray. The clipboard holds the protocol first, then the repository.
  - The selection survives moving between Gather and Prompts. If it doesn't, report it rather than working around it.
  - The Send button's label follows the last variant used, and its width doesn't change when the label does.
- **After U3:**
  - Every column has one row, and no tab strip scrolls sideways.
  - In portrait at 360 px, the view menu, the tab dropdown, the tray chip (only while something is selected) and the gear fit, with the tab label truncating first.
  - The tab dropdown lists the open tabs and the Add sections; tabs can be closed, moved and found by typing.
  - The position bar shows only when columns are off screen, and tapping or swiping it pans.
  - The repo filter appears in the gear and nowhere in Gather, Git, Bridge or Citations.
  - A new workspace opens on Prompts and Files, Gather, Yomama; an existing workspace's layout is unchanged.
  - `insetu_sdk.js` adds nothing to sutram's registry, and no insetu file reads a private registry property.
  - On an iPhone, single-card Copy Raw and the tray's Copy Raw both reach the clipboard, and the tray shows "Copied" before it closes.

## 7. Out of scope (decided, scheduled later; do not build)

- The card tap becoming Open's lens and the lens switcher.
- State marks and toggle actions (favourites).
- Facts lines on cards.
- Bolding the tap's item in menus.
- The editor command registry and menu-bar regrouping.
- Renaming groups to Open, Compare, Send, Run and Organize beyond the Send set.
- First-run empty states (the default layout is in U3).
- Bundled fonts.
- Browse tree mode.
- New comparison targets.
- Customisable ranking.

Raise anything in these that blocks the sprints instead of building it.
