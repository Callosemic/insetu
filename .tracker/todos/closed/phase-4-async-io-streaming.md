---
repo: "insetu"
type: "todo"
status: "closed"
id: phase-4-async-io-streaming
title: "Phase 4: Asynchronous I/O & Streaming"
created_at: 2026-07-02T09:18:30
closed_at: 2026-07-29T09:59:28
sub_bucket: "None"
tags: ["Architecture"]
---

## Description
# Asynchronous I/O & Streaming

Prevent the web server from hanging during heavy workspace compilation.
### Action Items
- [ ] Move `engine_gather.py` and `compiler.py` executions into asynchronous background task queues.
- [ ] Offload the thread-blocking `api_generate_diffs()` handler in `app.py` to the metronome task queue to prevent HTTP event loop starvation during deep workspace sweeps.
- [ ] Add a WebSocket or Server-Sent Events (SSE) layer to `app.py`.
- [ ] Eradicate long-polling debt by removing the 3-second layout refresher loop (`setInterval`) inside the `research` extension panel and porting it to use Server-Sent Events.
- [ ] Update frontend to receive streaming progress events (e.g., "Compressing JS...") via the reactive `store.js`. [cite: 3154]
- [ ] Replace blocking HTTP wait states with instant `202 Accepted` responses. [cite: 3155]

## Notes / Execution Log
* **Audit (2026-07-02):** Designated as primary performance debt. Resolving HTTP event loop starvation during deep workspace sweeps is required for system stability and reliable I/O concurrency.
* **Status Update (2026-07-02):** Partially completed. The RAG compiler successfully streams contexts via NDJSON queues. However, diff generation remains synchronous, and `ext_research.js` continues to poll via a blocking `setInterval` loop instead of utilizing SSE.
