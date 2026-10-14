# 0015: CodeMirror 6 Migration & Native ES Modules

## Status
Accepted (2026-07-08)

## Context
The legacy EasyMDE (CodeMirror 5) dependency required heavy CDN script tag loading, violating our zero-bundler import map architecture and causing layout jank during UI initialization.

## Decision
We have migrated the core markdown rendering engine to CodeMirror 6, imported directly via `esm.sh` leveraging native browser ES modules. This aligns the editor with the LitElement import map paradigm.

## Consequences
* **Positive:** Complete removal of legacy `<script>` tags from `index.html`.
* **Positive:** Superior modularity, enabling future Web Component encapsulation.
* **Negative:** CM6's API is fundamentally different from CM5, requiring a temporary proxy wrapper (`mdeInstance`) inside `app.js` to bridge backward compatibility until the full `<insetu-markdown-editor>` Web Component is finalized.