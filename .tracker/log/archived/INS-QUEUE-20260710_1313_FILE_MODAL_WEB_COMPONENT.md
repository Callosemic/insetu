---
repo: "insetu"
type: "todo"
status: "archived"
id: INS-QUEUE-20260710_1313_FILE_MODAL_WEB_COMPONENT
title: "Declarative UI: Migrate #file-modal Monolith to Web Component"
created_at: 2026-07-10T13:25:35
closed_at: 2026-07-29T09:33:02
sub_bucket: "None"
tags: ["Frontend", "Architecture", "LitElement", "Refactor"]
---

## Description
Despite significant progress in the declarative UI migration, the primary workspace text editor (`#file-modal`) remains a massive 28-line hardcoded monolith inside `index.html`. 

This layout relies on imperative DOM mutations (e.g., `document.getElementById('file-modal').style.display = 'block'`) and violates the Unidirectional Data Flow (UDF) architectural standards by trapping state and layout structure in the raw HTML envelope.

### Action Items
- [ ] **Component Scaffold:** Create a new LitElement Web Component (e.g., `<insetu-file-modal>`) to encapsulate the entire editor interface.
- [ ] **State Binding:** Expand the `FsStore.modals` or `AppStore` to track the active editor state (`isOpen`, `currentFile`, `content`, `isReadOnly`).
- [ ] **Template Extraction:** Move the hardcoded header, action toolbars, truncation banners, and `<insetu-markdown-editor>` integration out of `index.html` and into the component's declarative `render()` function.
- [ ] **CSS Encapsulation:** Migrate the associated styles to the component's `static styles` array to prevent styling bleed.
- [ ] **Cleanup:** Eradicate the `#file-modal` div structure from `index.html` completely.

## Notes / Execution Log