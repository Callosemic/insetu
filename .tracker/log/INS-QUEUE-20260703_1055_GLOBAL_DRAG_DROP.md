---
repo: "insetu"
type: "todo"
status: "logged"
id: INS-QUEUE-20260703_1055_GLOBAL_DRAG_DROP
title: "Ecosystem Generalization: Migrate Desktop Drag-and-Drop Export to Global UI Namespace"
created_at: 2026-07-03T10:55:00
closed_at: 2026-07-05T01:55:51
sub_bucket: "None"
tags: [Architecture, Frontend, Standardization]
---

## Description
The native, out-of-browser desktop file export mechanism (`window.bindDownloadDrag`) introduced in `fs.js` provides high-utility spatial interaction, allowing operators to drag dynamic file and context tokens directly out of the web container onto the host machine's desktop environment[cite: 1202, 1206, 1210]. 

Currently, this capability is tightly coupled to individual rendering loops within the Virtual File System viewer [cite: 1241, 1609] and the batch workflow engine[cite: 1801]. To honor the DRY (Don't Repeat Yourself) centralization mandates of our engineering standards, this layout must be generalized and exposed as a core framework behavior.

Abstracting this orchestration layer will allow any optional extension module—such as the Research Inbox triage entries or localized Reference manager datasets—to instantly activate standard desktop drag exports without duplicate code or raw string transformations.

## Resolution
The desktop drag-and-drop mechanism was cleanly abstracted into the `UIFactory` singleton inside `ui.js`. A global `dragstart` event listener was established on the document body to intercept any component tagged with the `.ui-draggable-export` semantic class. Inline event listeners and fragmented configuration blocks were stripped from `fs.js`, `ext_flow.js`, and `gather.js`, standardizing the export flow across all system lists and modals.

