---
repo: "insetu"
type: "todo"
status: "open"
id: INS-QUEUE-20260708_1550_FINAL_LIT_MIGRATION
title: "Final UI Component Graduation to LitElement"
created_at: 2026-07-08T15:50:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-07-26"
tags: ["Frontend", "LitElement", "Refactor"]
---

## Description
Systematically refactor \`ext_citations.js\`, \`ext_format.js\`, \`ext_ingest.js\`, and \`ext_term.js\` into declarative LitElement components. 
Clean out all legacy, raw DOM manipulation elements (\`document.getElementById\`), manual container purges (\`replaceChildren()\`), and unmanaged \`innerHTML\` overwrites to achieve 100% compliance with the UDF architecture and zero-bundler import map.

## Notes / Execution Log
