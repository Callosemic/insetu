---
id: "INS-QUEUE-20260807_1153_UNIFIED_RESOURCE_EDITOR"
repo: "insetu"
type: "queue"
status: "open"
title: "Unify File Creation, VFS Code Editing, and Frontmatter Drawers into <insetu-resource-editor>"
created_at: null
closed_at: null
sub_bucket: "UI"
tags: ["Architecture", "Frontend", "UI", "Editor", "VFS"]
---

## Description
Consolidate the fragmented modal editing surfaces—VFS code editor (`fs.js`), Frontmatter drawer editor (`ui_editor.js`), and bespoke creation modals (`ext_notes.js`, `ext_tracker.js`)[span_0](start_span)[span_0](end_span)[span_1](start_span)[span_1](end_span)—into a single, polymorphic **`<insetu-resource-editor>`** component.

### Key Architectural Concepts
1. **Uncommitted Buffer State (Genesis Mode)**:
   - Creation mode operates as a state within the editor modal.
   - The metadata drawer opens expanded by default to configure target repository, sub-bucket, tags, and title[span_2](start_span)[span_2](end_span)[span_3](start_span)[span_3](end_span).
   - Hitting `Ctrl+S` or `Save` commits the initial VFS write transaction (`fs/save`)[span_4](start_span)[span_4](end_span)[span_5](start_span)[span_5](end_span) and seamlessly transitions the modal in-place into **Edit Mode** without re-mounting or losing focus.
2. **Polymorphic Rendering**:
   - **Structured Documents (Markdown/YAML)**: Renders the title control and auto-hydrates metadata controls based on frontmatter keys[span_6](start_span)[span_6](end_span)[span_7](start_span)[span_7](end_span).
   - **Plain Code/Text (`.py`, `.js`, `.json`)**: Suppresses title and metadata drawers entirely, allocating 100% of viewport height to the CodeMirror canvas.
3. **Centralized Editing Physics**:
   - Single implementation of dirty-state tracking (`_isDirty()`), unsaved changes guards on modal teardown[span_8](start_span)[span_8](end_span), shortcut handlers (`Ctrl+S`), and atomic VFS commit/delete triggers (`fs/save`, `fs/delete`)[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span).

### Action Items
- [ ] **Construct `<insetu-resource-editor>`**:
  - Scaffold component in `ui_editor.js` inheriting from `InSetuElement`[span_11](start_span)[span_11](end_span).
  - Integrate title `<sutram-textarea>`, collapsible metadata drawer, `<sutram-entity-actions>` toolbar, and main editor canvas[span_12](start_span)[span_12](end_span)[span_13](start_span)[span_13](end_span).
  - Support `isUncommitted` state flag for new resource drafting.
- [ ] **Migrate Extension Editor Instances**:
  - Refactor `ext_notes.js`[span_14](start_span)[span_14](end_span) and `ext_tracker.js`[span_15](start_span)[span_15](end_span) to dispatch creation/editing directly to `<insetu-resource-editor>`.
  - Deprecate bespoke `<insetu-ext-notes-editor>`[span_16](start_span)[span_16](end_span) and `<insetu-ext-tracker-modals>`[span_17](start_span)[span_17](end_span) wrapper elements.
- [ ] **VFS Interceptor Alignment**:
  - Update `zone:file-edit-override` and standard VFS file click handlers in `fs.js` to route all edit payloads into the unified editor shell.