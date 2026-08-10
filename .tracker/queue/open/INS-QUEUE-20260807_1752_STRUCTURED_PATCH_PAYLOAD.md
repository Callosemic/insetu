---
repo: "insetu"
type: "queue"
status: "open"
id: "INS-QUEUE-20260807_1752_STRUCTURED_PATCH_PAYLOAD"
title: "Migrate Yomama Bridge Request Payload to Structured JSON Intent Array"
created_at: "2026-08-07T17:52:28"
closed_at: null
sub_bucket: "Architecture"
tags: ["Bridge", "Architecture", "Refactor", "API"]
---

## Description
Currently, there is a structural asymmetry in the Yomama Sync Bridge's API contract. While the backend responds with a highly structured JSON array detailing the exact status and available actions for each individual patch, the frontend initiates requests by sending a single, monolithic raw text string alongside global "sledgehammer" boolean flags (`force: true`, `ignore_syntax_errors: true`). 

This forces the backend to continually re-parse the raw text and apply global overrides to all files, which feels hacky and brittle when trying to resolve specific path ambiguities or single-file syntax overrides.

To mature this pipeline and solidify the frontend `BridgeStore` as the absolute Single Source of Truth (SSOT) for ephemeral transaction intent, we must migrate the request payload to a structured JSON array.

### Target Architecture
Instead of passing `textVal`, the frontend will serialize its active UI cells into an array of explicit intent objects:

\`\`\`json
{
  "transaction_intent": [
    {
      "file": "app.py",
      "search": "...",
      "replace": "...",
      "overrides": {
        "ignore_syntax": false,
        "confirmed_candidate": null
      }
    },
    {
      "file": "new_module.py",
      "search": "",
      "replace": "...",
      "overrides": {
        "confirm_genesis": true
      }
    }
  ]
}
\`\`\`

### Action Items
- [ ] **Frontend Serialization (`bridge.js`):** Refactor `BridgeStore.getCompiledPayload()` (or introduce a new selector) to map active cells and their localized UI-confirmed override states into the structured `transaction_intent` array.
- [ ] **Backend Parser Deprecation (`engine_bridge.py` & `bridge_vfs.py`):** Deprecate the `parse_blocks` step on the write path. The engine should accept the pre-parsed JSON array directly.
- [ ] **Granular Override Application:** Refactor `bridge_vfs.py` to evaluate the specific `.get("overrides", {})` block attached to each individual patch, completely deprecating the global `kwargs.get('force')` and `kwargs.get('ignore_syntax_errors')` flags.

## Notes / Execution Log