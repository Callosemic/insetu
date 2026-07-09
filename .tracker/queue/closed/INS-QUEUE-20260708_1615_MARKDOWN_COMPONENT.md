---
repo: "insetu"
type: "queue"
status: "closed"
id: INS-QUEUE-20260708_1615_MARKDOWN_COMPONENT
title: "Ecosystem Generalization: Abstract CodeMirror into <insetu-markdown-editor> Web Component"
created_at: 2026-07-08T16:15:00
closed_at: 2026-07-09T09:56:43
sub_bucket: "None"
---

## Description
The current CodeMirror instantiation logic and its associated dark theme CSS resets are heavily trapped inside the `ext_tracker.js` Kanban extension. While functional, this creates significant structural CSS bloat (`.EasyMDEContainer` overrides) and traps a highly reusable primitive in a domain-specific silo.
## Action Items
- [x] Extract the `EditorView` instantiation logic and CSS block out of `ext_tracker.js`.
- [x] Encapsulate this logic into a globally registered `<insetu-markdown-editor>` LitElement Web Component.
- [x] Refactor `ext_tracker.js` to replace its imperative CodeMirror mounting block with the new `<insetu-markdown-editor>` semantic tag, binding its output via standard `@input` or `@change` DOM events.
- [x] Ensure the component supports dynamic prop updates for content hydration without destroying the internal CodeMirror instance.

## Notes / Execution Log
* **Resolution (2026-07-09):** `ext_tracker.js` successfully utilizes `<insetu-markdown-editor>` bound reactively via `@content-changed`, drastically reducing localized styling bloat and ensuring CodeMirror acts as an isolated, reusable primitive.