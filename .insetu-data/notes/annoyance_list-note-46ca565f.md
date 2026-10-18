---
id: note-46ca565f
title: inSetu Bug list
repo: insetu
sub_bucket: None
created_at: '2026-08-04T10:11:37'
updated_at: '2026-10-18T11:04:03'
tags: []
---

## Current Bug list

### Current Priorities
- [ ] flow shows contexts like diffs as missing in the editor, but of course diffs are sometimes missing. not a useful view and kinda in the way
- [ ] in yomama, if it's a syntax error, it doesn't need a diff
- [ ] top level icons like Dev that disappear on offline and reappear when reconnect don't get their icons
- [ ] bulk git commit (selecting more than one diff bunch)
- [ ] flow when dirty should change to the construction icon?
- [ ] stabilize insetu's boot tailscale situation ; also stabilize codeserver and axnm
- [ ] {workspace}/.insetu/ should be for insetu preferences and data; a new {workspace}/{repo}/.insetu-data/ should be established for data that should say in the repo, and it should be used by tracker, prompts, and any other modules storing actual domain data in .insetu/ either in files or databases
- [ ] is vfsBound necessary? can't it just be implied by having a vfs:// connection?
- [ ] flow, git + diffs, and notes all have a wrapper on projections so edge to edge isn't really edge to edge.
- [ ] check pop up assets for flow, diffs, prompts
- [ ] is our font use consistent against the OS
- [ ] file creation modal should use a window projection
- [ ] toggles are offset from their text (higher)
- [ ] quickpack sizes for folders and files
- [ ] quickpack dropdown refactor
- [ ] sizes and modification for fs, Sort by Name / Size / Date
- [ ] do quickpacks get cleared on system boot? they shouldn't, i don't think
- [ ] surface share too large error to UI
- [ ] select all in fs
- scrolling between projections should drag floating windows


### unsorted
- [ ] expose deep search to file search
- [ ] ios hangs sometimes on boot ... service worker issue?
- [ ] when refactoring modals, make sure that the dirty states is handled correctly. notes currently does not handle dirty states at all.
- [ ] in eink mode, the "and X more" bottom card is not styled like the other cards
- [ ] bridge can't handle incorrect case in paths?
- [ ] tracker's too big, needs to be broken up

### prep for release
- [ ] update readmes for sutram and insetu
- [ ] apache header on all files (after release is okay)

### prompts
- [ ] the file selector for prompts is UGLY. it doesn't follow the current design langauge at all.

### update
- [ ] the tap tab to refresh is not bound, or it's not correctly seeing that the git tree is clean after sweeping

### flow
- [x] flow filenames should update to match titles
- [ ] flow not respecting the visibility rules
- [ ] flow modal uses a flushed inner wrapper that scrolls on a padded outer wrapper. it should just have a scrolling outer wrapper with inner padding and/or margins on the elements.
- [ ] the flow modal should be embedded into the flow tab itself, which would allow you to tab to yomama and come back to the same place. then the contexts should become a card stack for the file list. that would mean you wouldn't have to leave flow to push diffs at the end of it all, or lose your flow state (lol) to reference something else

### gather
- [ ] need to tweak the compilation chain ... cartographer is at the end, but when it makes a CODE_INDEX.md, it's going to mutate the code base and start another run. i think teh compile chain needs to be two pass - all mutations, THEN compilations, which CANNOT trigger VFS.

### notes extension
- [ ] notes action bar refactor and meta auto-hide
    - [ ] I don't think the bottom buttons are in the actual footer
    - [ ] the entity actions should move to the top. Save changes can stay on the bottom
    - [ ] the title bar's top padding should match its bottom padding (check to see if it's a notes problem or a general modal problem)
- [ ] notes should keep track of dirty states and only show save changes if there are changes
- [ ] checkbox should not fire if your tap is past the end of the line (right now, if the checkbox is the last thing on the line, any tap to the right of it triggers the checkbox)

### Code Editor implementation
- [ ] tab and other shortcut keys should be implemented
- [ ] go links don't work 

### yomama
* on failed search anchor, if a probable file IS found via the path, it should offer diff viewing (between the code and the search anchor)
* .insetu/config.json patch shows now resolution. it says 3 patched, 2 resolved, but the third one simply is not there
* should see if we can interleave wrapped lines in the diff viewer
* if dry run reaches success, should offer both the back button and the patch button directly from there
* on patch unselect, it should only unselect that specific patch, not all patches for that file.
* should gracefully capture failed downloads
* confirm to overwrite doesn't actually have a confirm button
* it doesn't seem to do the "just resolve the filename" and search resolution test
* deep search should happen in place and just return a modal explaining the result and making the change
* yomama receipts revert failing (415 unsupported media type)
* yomama genesis patch not adding to manifest
* genesis patch overwrite confirmation doesn't actually confirm
* instead of saying "target file" it should just give me the filename directly (top card of a patch stack)

### tracker
- [ ] domain strategy change should force a tracker context rebuild ... right now, updating VFS and CTX does squat. have to reboot to see the move.

### dev
- [ ] is it reading the actual disk writes? i'm getting 3 mutations for one yomama patch. a) what's causing three writes to be passed to the vfs; b) is that actually 3 disk writes?; c) should the dev extension be separately monitoring VFS mutation requests and actual disk writes?