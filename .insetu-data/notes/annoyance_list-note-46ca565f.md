---
id: note-46ca565f
title: inSetu Bug list
repo: insetu
sub_bucket: None
created_at: '2026-08-04T10:11:37'
updated_at: '2026-10-19T23:24:54'
tags: []
---

## Current Bug list

### Current Priorities
- [ ] yomama should confirm genesis patch over-writes
- [ ] files module seems like it has se
unclosed html tag or something like that. adjacent file tags have different font sizes
- [ ] got a flow compilation error in another workplace that didn't have flow installed
- [ ] can't pop from raw edit back to yaml, and let's put raw edit permanently next to delete, so that it doesn't occupy the same place as save when save is not there (only save is anchored right)
- [ ] if a projection is launched behind a window or focused but is behind a window, have its tab-bar fade to teh front briefly to show that it's there.
- [ ] Files search should also match folders
- [ ] rename broken?
- [ ] git diffs bulk selection for push and commit opens a button on the quickpacks dropdown, but the proper pattern would be to have a second-row right-side menu that exposes a bulk push/commit command.
- [ ] restore tap active tab to refresh functionality across os
- [ ] quickpack action drawer should be width constrained and side scrollable like all action bars.
- [ ] update tracker prompt or maybe tracker itself; maybe it should just expose a tracker://{repo}/ mount that can be written to, hiding ./insetu-data/tracker/ ? - this also provides a pattern for global tickets
- [ ] update akasa to testing standards of insetu and sutram
- [ ] malloc code at top of both app.py and cli.py - move to akasa and import?
- [ ] (akasa) Key Rotation Error Resilience: In akasa/auth/__init__.py, rotate_master_key iterates across all workspaces and re-encrypts their secrets.json. If an individual tenant's secrets.json fails to re-encrypt (for example, due to an unhandled permission issue on disk), the function prints a warning and proceeds to overwrite master_key.txt. While suitable for single-host local operations, staging the rotated secrets in memory and committing them along with master_key.txt in a two-phase check would prevent partial key rotation in multi-tenant edge cases.
- [ ] on first attempt at popout of a text file, it brought up a blank window with this error:
ext_term.js:358 WebSocket connection to 'wss://gookcentre.tail8e12bd.ts.net:9005/api/default/term/stream?token=5902e4d96014258709a102190345fd31' failed: Invalid frame header
_connectWebSocket @ ext_term.js:358
- [ ] (Flow) every little vfs update seems to refresh/flash the Batch Workflow popup modal?
- [ ] move tailscale to core?
- [ ] filter seems to filter out quickpacks
- [ ] when resizing smaller, can't gain columns
- [ ] bulk move should start from current directory
- [ ] system error ledger errors should be copy-pastable
- [ ] update repo selection box is empty
- [ ] flow shows contexts like diffs as missing in the editor, but of course diffs are sometimes missing. not a useful view and kinda in the way
- [ ] in yomama, if it's a syntax error, it doesn't need a diff, just needs a text box for viewing the error
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
- [ ] bridge testing suite


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