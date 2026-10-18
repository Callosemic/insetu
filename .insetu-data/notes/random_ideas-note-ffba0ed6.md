---
id: note-ffba0ed6
title: Random ideas
repo: insetu
sub_bucket: None
created_at: '2026-08-06T11:15:26'
updated_at: '2026-09-04T21:33:36'
tags: []
---

## Random ideas

### Quickpacks
- [ ] have a more lightweight quickpack "shopping cart" dropdown that (a) persists on the last quickpack created in that section until cleared, like a clipboard; (b) has an action entity arranged vertically to copy and share and download directly
- [ ] quick packs itself should basically become a kind of shopping list rather than a precompiled context; I think the compiling can be JIT

### Notes
- [ ] note pinning (to the top)

### Sutram / yenVUI
- [ ] sutram should provide complete CSS for a user interface from the start, meaning that it needs to establish a baseline for all of its components; i think we should establish inSetu as the defined "house style" of yenvui / sutram, meaning that generally speaking, all insetu CSS should be vacuumed into yenvui, leaving insetu ideally with no CSS at all, and meaning all other consumers need to overwrite those styles OR replace yenvui entirely
- [ ] that takes me to the next point, which is to figure out the ergonomics of building alternative UI visuals on top of sutram / yenvui. Is the only pattern to provide superseding styles, or is there a universe where yenvui is replaceable, i.e. the coder tells sutram to use something else?

### Yomama next steps
- [ ] beyond the v4 additions, there are a few other things to think about like: searching against the file history ~5 turns back, because sometimes, the llm patches against earlier versions instead of the current one, thinking you hadn't applied anything yet.
- [ ] somewhere, i thought we had a document detailing different mechanics for different filetypes: python really needs the precise indentation patterns, but text does not, and neither do languages like js and C++ where whitespace doesn't matter at all. in those languages, matching first, then prettifying the immediate parent is probably ideal
- [ ] there should be separate copy and copy full prompt for errors to send back to an llm for fixing
- [ ] should add an optional "commit comment" to the yomama patch format

### edit modals
- [ ] maybe if they can be tightend up enough, they could first open only in their tab, then break out to full screen. and then they'd persist in their tab, for going back and forth; alternately, we pin them.
- [ ] basically, should editing modals persist, in which ccase we have to replace the current back button with minimize and back buttons. or is pinning the persistence key, and then back => hide when pinned