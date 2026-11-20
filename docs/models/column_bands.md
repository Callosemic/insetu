---
title: "Mental Model: Column Bands"
description: "One column unit decides how many columns fit and which layout step every element takes; a separate compact threshold only tightens horizontal spacing. No other widths."
domain: "Interface Architecture"
tags: [mental-model, layout, responsive, sutram, yenvui, columns, invariants]
---

# Mental Model: Column Bands

Every element that adapts to narrowness asks one question: **which band is my column in?** The bands come from two constants and nothing else. No component keeps a width of its own. *(Settled 2026-11-20.)*

---

## 1. Two constants, two jobs

- **The column unit, U = 360 px, answers how much layout fits.** It sets how many columns the shell shows and which layout step every element takes.
- **The compact threshold, 384 px, answers whether this is a small phone in the hand.** It sits between the 13 mini (375) and a standard phone (390 and up), and catches the most common Android width (360). It is not a multiple of U because it measures a hand, not a layout.

Both live in one table in yenvui (`yenvui/js/physics.js`, beside the column unit). Everything else reads them from there.

## 2. The bands

| Band | Column width | Capability |
|------|--------------|------------|
| narrow | below 720 (2U) | 1 |
| medium | 720 to 1080 (2U to 3U) | 2 |
| wide | 1080 (3U) and up | 3 |

**Each band includes its minimum and not its maximum,** so a band's maximum is the next band's minimum and every width falls in exactly one.

**Compact is a variant of narrow, not a band of its own:** a narrow column below 384 px is compact.

## 3. Capability and the column count

**Capability is how many units fit:** 2U holds two columns, 3U three.

**The shell's column count switches halfway between capabilities,** at 1.5U (540) and 2.5U (900), and **only moves in the direction of the resize.** A window growing past 540 goes to two columns, past 900 to three; shrinking below 900 goes to two, below 540 to one. Shrinking never adds a column and growing never removes one: the switch points are the same in both directions, so the count depends only on the width and one function (`columnCountFor`) works it out. The person's own column setting (the gear's Grid) is a ceiling on it, as now.

## 4. What a band is measured on

**A band belongs to the column, never to the element.** An element reads the band of the layout container it sits in:

- a **column**: its share of the window, as the shell allots it, not its padded inner box (so two columns in a 720 px window are 360 each, not a few pixels less);
- a **window** spanning columns: its whole width, so a card in a window spanning two columns is medium even when the shell shows two columns.
- a **pane** dividing a column, such as a view's sidebar: its own width, so the conversation cards in Yomama's 300 px sidebar keep the drawer even in a wide column.

The column and the window are named containers, so the bands also work as container queries from inside any component (container queries see through shadow DOM).

## 5. What may change in each band

- **Layout steps go by band only:** inline actions or the drawer, a card's detail line shown or hidden (hidden in narrow), wrap on or off, side-by-side or stacked, how many grid columns. A medium column (the 720 px columns of a 1440 px window in 2-Col) shows a card's actions inline.
- **Compact only saves horizontal room:** cards edge to edge, no side borders or rounded corners, less padding, and fixed labels giving way to icons (the chip menus' section column becomes a 30 px icon rail; the diff viewer's mode buttons drop their words). **It never changes what is offered or where:** a compact column has the same buttons, drawer and detail line as any narrow column. Compact applies on desktop too: a 360 px column is cramped on any device.
- **Smooth fitting to the parent is allowed:** a caption's font size, how many actions fit before the overflow menu, a chip shrinking to its row. These measure the parent continuously and have no threshold.

## 6. Touch and pointer

**Bands never ask what the pointer is.** Touch and mouse are handled together everywhere. The one device question in the shell is whether a separate pop-out window can exist; it asks for a touch pointer *and* capability 1, reading the table, not a width of its own.

## 7. Enforcement

- A fitness rule (`RAW_BAND_WIDTH_BAN`) bans raw pixel widths in container and media queries, and width comparisons, everywhere except the table: sutram's fitness for sutram and yenvui, insetu's for insetu and its extensions.
- CSS cannot put a variable inside a query, so a helper writes the band queries from the table; JavaScript reads the same table through one function that returns the band (and whether it is compact) for a width.

## 8. Where it lives in code

- **The table, the band function and the query helper** are in yenvui (`yenvui/js/physics.js`), re-exported by sutram.
- **The column count** is in sutram (`LayoutStore` in `sutram/js/sutram_sdk.js`, read by `sutram/js/app_shell.js`).
- **Card width tiers** (`docs/models/card_and_action_model.md` section 1) follow this model.
