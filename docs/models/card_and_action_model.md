---
title: "Mental Model: Cards and Actions"
description: "Every artifact is a card whose entity type decides its actions: four card zones, width tiers from the card's column band, action rows that fit then overflow, and a registry of actions, variant sets and groups."
domain: "Interface Architecture"
tags: [mental-model, cards, entity-actions, sutram, ui, invariants]
---

# Mental Model: Cards and Actions

Everything a person works with in `inSetu` is a **card**: a file, a context pack, a repository, a ticket, a session record. A card's **entity type** (something like a mimetype, for example `file`, `file:context` or `repo`) decides which **entity actions** it has. The same card, with the same actions, works from a phone in portrait to a wide desktop column. This model was settled on 2026-11-18; the shell's top row (section 9) on 2026-11-19. Section 10 lists what is still open.

---

## 1. The card

Every card has four zones:

1. **Select**, on the left. A tap or a left swipe adds the card to the selection; selected cards share the selection tray and its bulk actions.
2. **Body.** The name, a facts line where the entity type declares one (for a pack: size and parts), and the tap. **A tap runs Open with the lens last used for that entity type on that device** (section 5).
3. **Marks.** Small state indicators in one standard place, at the visual weight of the Files view's "M" for git changes. A mark can be a toggle you tap, such as the favourites star.
4. **Actions**, on the right (section 2).

**Width tiers come from the band of the card's column, never the card's own box or the window.** A pane that divides a column (a view with a sidebar) is a column for this rule: its cards follow the pane's width. In a medium or wide column (720 px and up, `docs/models/column_bands.md`) a card shows its actions inline. In a narrow column it keeps them behind the right-side trigger, which opens the drawer. A card in a window spanning two columns takes the window's band, so it shows them inline even when the shell has two columns. *(Changed 2026-11-20: cards used to measure themselves, so a card in a 720 px column, about 675 px inside its padding, never went inline.)*

## 2. Action rows

**One rule for every action row: show what fits, then the three-dot menu.** It holds wherever actions appear in a row: inline on a wide card, in a narrow card's drawer, and in the selection tray.

- A row shows as many buttons as fit, in rank order. The three-dot menu lists the rest under their group's heading.
- **Inline actions never take more than half the card.** The title, path and other content keep at least half the row, because the content is what the card is; actions that do not fit in the other half go to the three-dot menu. *(Added 2026-11-20: a long path on the bridge's Target File card was squeezed to a few characters.)*
- **No action row scrolls sideways.**
- **Rank** comes from the entity type's author (`surfaced`, lower first). There is no per-user reordering for now.
- **Destructive actions** (Archive, Delete) sit last in their group and are never surfaced into a row.
- **A label gives way to its icon.** Where a control has both and the row is short of room, it shows the icon alone: the lens switcher, the selection tray chip. The label returns when there is room.
- **An action confirms itself on the button that started it** ("Copied"). A drawer or menu stays open until that confirmation has shown. The status bar keeps the record, but it is not the only signal.

## 3. The action schema

Every entry in the action registry is exactly one of three structures. Each looks different, so the control tells a person what a click will do.

| Structure | Holds | Looks and behaves |
| --- | --- | --- |
| **Action** | One thing to do | A plain button or menu item. One click runs it. |
| **Variant set** | Equivalent ways of doing one thing | A split button. The main part runs the current default variant; the arrow lists every variant under section headings. |
| **Group** | Different actions that belong together | A dropdown. A click lists the members, and nothing runs until one is picked. |

**Invariants:**

- **One level of navigation.** A variant set or group holds plain actions only, never another set or group. Long lists use section headings, never submenus.
- **Dropdowns always show their section headings.**
- **A set or group is owned by whoever defines it.** An extension adds an action to an existing set by naming it; it never registers a second button for a verb that already exists.
- **Toggle actions declare the state they switch.** The card shows that state as a mark you tap, and menus list it as "Add to …" or "Remove from …".

## 4. Variant sets: defaults, labels and width

- **The default is the variant last used for that entity type on that device.** It is stored on the device, like the layout. *(Leaning; built in R1.)*
- **Before anything has been used,** the default is the first available variant in an ordered preference list declared for the type's family (table below). A variant is available when it can work for this item on this device: Share needs a share sheet; Expanded needs macros. So a phone can start on Share while a desktop starts on Copy.
- **The label is the current variant's own label** ("Share Expanded ▾"). Every variant label must read on its own as a complete phrase.
- **The width is that of the longest available label,** so the button never shifts as the default changes.

**First defaults by family:**

| Family | Entity types | Open: first lens | Send: preference order | Compare: first target |
| --- | --- | --- | --- | --- |
| Files you write | `file`, `file:note`, `file:prompt` | Edit; Preview for notes | Copy Raw, Share Raw, Download Raw | Changes |
| Structured files (a record view over a file) | `task`, `file:task`, `skill` | Details | Copy Raw, Share Raw, Download Raw | Changes |
| Packs and diffs | `file:context`, `file:diff` | Contents for packs, Preview for diffs | Copy Raw while one part, then Share Raw, Download Raw | none for packs; Changes for diffs |
| Folders and repositories | `folder`, `repo`, `config-repo` | Contents | Download Raw (a ZIP, automatically) | Changes |
| Records with no file in the repository | `hook_rule`, `agent_routine`, `agent_session`, `research_job`, `citation`, `patch-receipt`, `yomama`, `yomama-turn`, `freshdesk_ticket` | Details | Copy Raw, where Send applies | usually none |
| Transient things | `text_blob`, `terminal_context`, `system_control`, `virtual_keyboard` | usually none | Copy Raw for `text_blob` only | none |

## 5. The verbs

Actions are grouped by the job a person is doing, not by File and Edit.

- **Open** is a variant set of **lenses**: edit, preview, contents, details, and the agent's lenses (outline and others) as they join. A lens is one concept for people and agents: a way some actor views data. The lens contract defines how a context is viewed, and Open's lenses are the same thing seen by a person. Each lens has a canonical icon. Wherever something is open, the lens switcher is one step away: "[icon] Preview ▾" when there is room, the icon alone when there isn't.
- **Compare** is a variant set of targets: changes, the conflicted copy, and later an older version or another file.
- **Send** is one flat variant set: Copy, Download and Share, each **Raw** or **Expanded**, under those two headings, plus Publish, which the publish extension adds. Unavailable variants are hidden. Parts and ZIP are automatic: the format follows what is being sent.
- **Run** is a group of things that change or rebuild content: Rebuild, Format Code, Clean AI Tags, Schedule.
- **Organize** is a group: Move, Rename, Archive, Delete.

## 6. Menus and the editor

- **Menus are built from the groups and sets that exist for the entity type,** not from a fixed list. A variant set inside a menu lists its variants flat under its headings.
- **In a card's drawer and menus, the item a tap would run is drawn bold,** as desktop context menus mark the default.
- **Two registries.** *(Leaning.)* Entity actions are things that make sense without an open editor. **Editor commands** exist only inside an editing session: undo, redo, find and replace, copying the selection, indent, view modes, save now. They live in their own registry. Both produce the same menu-item shape (label, icon, group, shortcut, enabled), so the editor's menu bar merges them without special cases. Shortcuts share one table, and an editor shortcut wins while the editor has focus. Entity actions already receive the editor's live text, so an action such as Clean AI Tags is one entity action that works from a card and in the editor.
- **The editor's menu bar** reads Edit and View (editor commands), then Send, Compare, Run and Organize (entity actions), showing only groups that have something in them. Edit ▸ Copy copies the selection; Send ▸ Copy Raw sends the file. On a narrow editor the same row rule applies: the lens switcher shows its icon alone, menu headings show as many as fit, and the rest sit behind the three-dot menu under their headings.
- **The editor has no primary action.** It autosaves about two seconds after typing stops, so saving is a status ("saved"), with save-now kept as an editor command.

## 7. Composing a handoff

What goes to an outside chat is **composed by selection**: select the context and the prompt, then Send the selection, which compiles a quickpack. There is no separate preamble setting.

- **Files go into a quickpack raw.** The Yomama patch protocol depends on this: its `{{ymm:…}}` macros are escape codes the model must see literally.
- **Order follows the order things were ticked,** so a prompt ticked first lands at the top.
- **Prompts are never filtered out of a selection,** and a selected pack goes in as its parts.
- **The protocol is reachable from a Core prompts section** at the top of Prompts, declared by the bridge's manifest (`corePrompts`).

## 8. What stopped being a separate action

| Was | Now |
| --- | --- |
| Edit (open for editing) | The card's tap: Open's default lens |
| Preview, and the editor's macro preview toggle | One lens of Open |
| Browse | Open ▸ Contents |
| Copy, Share and Download Expanded | Variants inside Send |
| Download ZIP, View Parts | Automatic: the format follows what is sent |
| Compile Only | Rebuild, rarely needed, because Send compiles a stale pack itself |
| Compare Selected (2) | The selection tray only |
| Favorite | A toggle action shown as a mark |
| Prose mode, Focus Mode | Editor view modes (editor commands) |
| Pop Out | The window controls beside the menu bar |

## 9. The shell's top row

**Each column has one row, and the same rule as an action row: show what fits, then a menu.** There is no separate global header row. *(Settled 2026-11-19.)*

- **Left to right in every column:** the view's menu (three dots), the tab menu (a fixed chevron that opens the tab dropdown), then the open tabs inline, as many as fit. *(Changed 2026-11-20: the dropdown used to ride on the active tab, so it moved along the row.)*
- **Tabs keep their place.** Clicking a visible tab only moves the highlight; nothing moves under the cursor. The active tab is always shown: if it becomes active while hidden (chosen from the tab dropdown, opened from a file or a link), it moves to the front of the line and stays there.
- **The active tab is marked by its highlight alone:** the tinted background and the underline in its intent. Its label and icon stay at full strength, and it is never bold (bold widens it and makes the row re-fit).
- **The view's menu is always first,** in the same place in every column. Its top row is a compact four-part quick-control bar (`[ 1 ] [ 2 ] [ 3 ] | ↻`: quick column jump buttons numbered for columns 1–3, the current column highlighted, a vertical divider, and the active tab's refresh icon button — direct owner decision, 2026-11-19; numbered 2026-11-20, as the dots alone did not say which column a button meant), followed by the active view's own actions and bulk selection actions under section headings.
- **The tab dropdown and the gear menu** share a two-column chip-table layout with a slight bottom padding after each section to distinguish categories: a fixed-width left column holds the inverted section header slug (`[ Context ]`, `[ Edit ]`, `[ Tasks ]`, etc. in the tab dropdown; `[ System ]`, `[ Repos: ]`, `[ Workspace ]`, `[ Theme ]`, `[ Grid ]` in the gear menu, collapsing to a `30 px` inverted icon rail in a compact column (`docs/models/column_bands.md`)), and a separate right column holds the wrapping chip track so wrapped lines never tuck under the header column. At the very top of the tab dropdown—above the `Filter tabs...` input—the tabs open in this column span full-width without a header slug (with the active tab underlined, `×` to close, `*` for unsaved changes, and long-press/drag to pull the spatial HUD), followed by the filter input and the launcher category rows (with monochrome Lucide icons `chevron-left`, `dot`, `chevron-right` indicating tabs already open in the left, center, or right column). Typing filters the launcher chips across rows. Picking a launcher chip opens the tab in this column; if it is already open in a column that is on screen it goes there instead, and if it is open in a column off screen it moves to this column (added 2026-11-20). The dropdown always lists every open tab; the inline tabs are only a shortcut.
- **No tab strip scrolls sideways.**
- **The last column's row ends with the globals:** the selection tray chip, the gear's pinned slot and the gear.
  - The tray chip exists only while something is selected. It reads "2 selected", or the name the app gives the tray with the count ("Deck (2)" in insetu), or the tray icon with the count when room is short.
  - The pinned slot collapses to nothing when nothing is pinned.
  - The gear holds what applies everywhere: repositories in scope, notifications, settings.
- **A global setting appears in one place only.** The repo pin is global, so its filter lives in the gear and in no view. A view with options of its own (Citations' orphans, say) puts them in its own surfaces, not in a second repo filter.
- **The position bar** is a thin bar along the top edge that shows which columns are on screen, sized by the columns' ratios. Tap or swipe it to move. It's hidden when every column fits.
- **Every control in the row has a 44 px hit area,** whatever its drawn size.
- **A new workspace opens on a default layout:** Prompts with Files as its second tab, then Gather, then Yomama. A phone opens on the middle column. A saved layout is never replaced.
- **Later:** the buttons views draw in their own headers fold into the view's menu, and phones may get a bottom row.

## 10. Not yet settled

- **Whether editor commands get their own registry** (section 6, leaning yes).
- **Facts lines:** on every entity type, or only where they change a decision (packs, diffs)?
- **Browse:** seeing what a pack holds moves into Browse, with a tree mode that lists everything (leaning). Is the tree a toggle or the default for packs, and do parts show there?
- **Copy above a size:** warn, or steer to Download or Share?
- **First run:** empty states that name the next step (the default layout is settled in section 9).
- **The protocol's home:** Core prompts, or mounted at the root of Prompts once the prompts tree lands.
- **Coverage:** every module and extension that renders cards must eventually be checked against this model, for all card types and sizes. Yomama uses cards extensively and differently from Gather and Files, and some extensions use them in novel ways.

## 11. Where it lives in code

- **The registry is in sutram** (`sutram/js/sutram_sdk.js`). `getEntityActions(compoundType, data)` merges the actions registered for each part of a compound type (`file:editor` → `file`, `editor`, `file:editor`), filters them by each action's `match` test and sorts them. `getAggregatableActions` serves bulk selection, where `'*'` registrations apply.
- **Rows, the drawer and menus are in sutram** (`SutramEntityActions` and `SutramCard` in `sutram/js/primitives.js`), and the card itself is in yenvui (`yenvui/js/card.js`).
- **The async button is in yenvui** (`yenvui/js/async-btn.js`). It cycles working, done and error, and takes a `successLabel`.
- **insetu registers file actions** in `insetu/core/fs/fs.js`. Extensions register theirs in their own manifests.
- **The R1 slice** (fit-then-overflow rows, width tiers, the variant-set button, confirmation on the button, the Send set, bulk Copy Raw, Core prompts) is specified in `docs/plans/agent-briefs/gemini_card_actions_and_r1_handoff.md`, with the shell's top row as its Sprint U3.
- **The shell is in sutram** (`sutram/js/app_shell.js`, with `LayoutStore` in `sutram/js/sutram_sdk.js`). The global repo pin is `AppStore.pinnedRepos` in insetu.
- **Column bands** (which widths count as narrow, medium, wide and compact) are their own model, `docs/models/column_bands.md`.
