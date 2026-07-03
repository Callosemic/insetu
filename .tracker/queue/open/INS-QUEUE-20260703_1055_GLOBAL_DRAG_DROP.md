---
repo: "insetu"
type: "queue"
status: "open"
id: INS-QUEUE-20260703_1055_GLOBAL_DRAG_DROP
title: "Ecosystem Generalization: Migrate Desktop Drag-and-Drop Export to Global UI Namespace"
created_at: 2026-07-03T10:55:00
closed_at: null
sub_bucket: "None"
tags: ["Architecture", "Frontend", "Standardization"]
---

## Description
The native, out-of-browser desktop file export mechanism (`window.bindDownloadDrag`) introduced in `fs.js` provides high-utility spatial interaction, allowing operators to drag dynamic file and context tokens directly out of the web container onto the host machine's desktop environment[cite: 1202, 1206, 1210]. 

Currently, this capability is tightly coupled to individual rendering loops within the Virtual File System viewer [cite: 1241, 1609] and the batch workflow engine[cite: 1801]. To honor the DRY (Don't Repeat Yourself) centralization mandates of our engineering standards, this layout must be generalized and exposed as a core framework behavior.

Abstracting this orchestration layer will allow any optional extension module—such as the Research Inbox triage entries or localized Reference manager datasets—to instantly activate standard desktop drag exports without duplicate code or raw string transformations.

## Action Items
- [ ] **Extract and Centralize Infrastructure:** Move `bindDownloadDrag` from `fs.js` [cite: 1202] into a core global utility layout layer (e.g., `window.ExtensionRegistry.utils.bindDownloadDrag` or `window.inSetu.ui.bindDownloadDrag`).
- [ ] **Standardize Parameter Mappings:** Refactor the utility signature to cleanly accept an agnostic execution context consisting of standard MIME types, fallback filenames, and direct download source URLs[cite: 1202, 1203].
- [ ] **Implement Event Delegation/Mixin Layer:** Introduce a declarative global event initializer or lightweight mixin that automatically binds the standard OS `DownloadURL` dataTransfer payload to any element decorated with a designated semantic marker (e.g., class `.ui-draggable-export`)[cite: 1210].
- [ ] **Refactor Existing Implementations:** Sweep core presentation layouts across `fs.js` [cite: 1241] and `gather.js` [cite: 1801] to strip out inline elements and loop-specific event registrations, funneling their configurations securely through the unified system utility.