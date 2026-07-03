---
repo: "insetu"
type: "todo"
status: "open"
id: INS-BUG-20260701_1215_XSS_PREVIEW_INJECTION
title: "Security Hardening: Replace Naive Regex Script Stripping with DOMPurify Sanitization"
created_at: 2026-07-01T12:15:00
closed_at: null
sub_bucket: "None"
tags: [security, frontend, vulnerability, bugs]
---

## Description
The markdown preview canvas inside `fs.js` currently shields the application from cross-site scripting (XSS) by using a global regular expression replacement pattern to drop `<script>` tags. 

Because inSetu operates as a local-first platform with absolute read/write file system access, this naive string filter creates a severe security risk. If an LLM returns task payloads or crawls external research targets that embed clever nested event handling vectors (e.g., `<img src=x onerror="fetch('/api/default/fs/delete', ...)">`), the payloads escape the regex layer entirely and execute malicious system operations directly in the user's workspace context.

## Action Items
- [ ] Incorporate DOMPurify into the frontend assets layout space.
- [ ] Strip out the hardcoded script regex replacements inside `renderMarkdownPreview()` in `fs.js`.
- [ ] Route the parsed marked token output through a strict DOMPurify hook before setting innerHTML properties on the modal container.
- [ ] Audit all visual extension cards to verify complete safety boundaries when rendering untrusted scraped data fields.

## Notes / Execution Log
* **Audit (2026-07-02):** Designated as critical security debt. Replacing the naive regex filter with DOMPurify sanitization is required to ensure safe rendering boundaries.